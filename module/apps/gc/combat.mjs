/**
 * Combat tracker support for Spycraft's order of combat (pp.323–324):
 * flat-footed at the start, tie-breaking by Initiative bonus, fluid initiative at the end of each
 * round, Delay / Press / Ready, group initiative for NPCs and surprise rounds.
 */
import { readSetting } from "../../settings.mjs";
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import {
  FLUID_EVENTS,
  fluidModifier,
  addFluidModifier,
  endOfRound,
  delay,
  press,
  readyTrigger,
  compareCombatants,
  surpriseRound
} from "../../rules/gc/fluid-initiative.mjs";
import { setConditionStatus } from "../../rules/condition-status.mjs";
import {
  ENCOUNTER_DISTANCES,
  ENCOUNTER_LABELS,
  SURFACES,
  SURFACE_LABELS,
  deviationDie,
  encounterDistance,
  gasClearing,
  gasIncrements,
  ricochetSquares,
  senseLimit,
  surfaceMove
} from "../../rules/gc/combat-reference.mjs";
import { queueInitiative } from "../../services/combat-queue.mjs";
import { loc, locKey } from "../../i18n.mjs";
import {
  ACTION_COST,
  HALF_ACTIONS_PER_TURN,
  actionBudget,
  resetActions,
  setActionsUsed,
  spendAction
} from "../../rules/action-budget.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { woundState } from "../../rules/damage-application.mjs";
import { npcIsSpecial } from "./npc-play.mjs";
import { markAntagonistsFaced } from "./mission.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { settledCountEvents } from "../../documents/actor/count-shifts.mjs";
import { postUndo, withUndo } from "../undo.mjs";
import { isLeadGM } from "../../writers.mjs";

const ask = (title, content, ok, validate = null, dialog = undefined) =>
  formDialog({ title, ok, validate, fields: [raw(content)], ...(dialog ? { dialog } : {}) });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const setting = key => {
  return readSetting(key, false);
};
const fluid = combatant =>
  combatant.flags?.spycraft2?.fluid ?? { round: null, modifiers: [], delayed: 0, pressed: false };
const fluidForRound = (combatant, round) => {
  const saved = fluid(combatant);
  return saved.round === round ? saved : { round, modifiers: [], delayed: 0, pressed: false };
};
const bonusOf = combatant => combatant.actor?.system?.initiative?.total ?? 0;
const say = (content, { whisper = false } = {}) =>
  ChatMessage.create({
    speaker: { alias: loc`Game Control` },
    content,
    ...(whisper ? { whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id) } : {})
  });

async function condition(actor, id, label) {
  if (!actor) return;
  try {
    await setConditionStatus(actor, id, true, { label });
  } catch (error) {
    console.warn(loc`Field Agent's Handbook | ${label} not applied to ${actor.name}`, error);
  }
}

/** Order combatants by Count, then Initiative bonus, then a stored roll-off (p.323). */
/** Combatants still without an Initiative Count, leaving out the defeated. */
export const unrolledCombatants = combat =>
  [...(combat?.combatants ?? [])].filter(c => !c.isDefeated && !Number.isFinite(c.initiative));

/**
 * Before a fight begins, say who has no Initiative yet. A character who rolls after the start sorts in above the
 * current turn and loses the first round, so the GC can roll for NPCs and remind players first.
 * @returns {Promise<boolean>} whether to begin now
 */
export async function confirmInitiativeBeforeStart(combat) {
  let missing = unrolledCombatants(combat);
  if (!missing.length || !game.user?.isGM) return true;
  const npcs = missing.filter(c => !c.hasPlayerOwner);
  const names = missing.map(c => esc(c.name)).join(", ");
  const choice = await systemDialog.wait({
    window: { title: loc`Begin combat` },
    content: `<p>${loc`No Initiative yet: ${names}.`}</p><p>${loc`Anyone who rolls after the fight begins sorts in above the current turn and misses the first round.`}</p>`,
    rejectClose: false,
    buttons: [
      ...(npcs.length ? [{ action: "roll", label: loc`Roll for NPCs and remind players`, default: true }] : []),
      { action: "remind", label: loc`Remind players`, default: !npcs.length },
      { action: "begin", label: loc`Begin anyway` }
    ]
  });
  if (!choice) return false;
  if (choice === "begin") return true;
  if (choice === "roll" && npcs.length) await combat.rollInitiative(npcs.map(c => c.id));
  missing = unrolledCombatants(combat).filter(c => c.hasPlayerOwner);
  if (missing.length) {
    const owners = [...new Set(missing.flatMap(c => c.players?.map(user => user.id) ?? []))];
    await ChatMessage.create({
      content: `<p>${loc`Roll Initiative before the fight begins: ${missing.map(c => esc(c.name)).join(", ")}.`}</p>`,
      whisper: owners
    });
    ui.notifications.info(loc`Players reminded. Begin combat again once everyone has rolled.`);
    return false;
  }
  return true;
}

export function fluidCombatClass(Base) {
  return class extends Base {
    async startCombat() {
      if (!(await confirmInitiativeBeforeStart(this))) return this;
      return super.startCombat();
    }

    _sortCombatants(a, b) {
      return compareCombatants(
        { id: a.id, count: a.initiative, bonus: bonusOf(a), tiebreak: a.flags?.spycraft2?.tiebreak },
        { id: b.id, count: b.initiative, bonus: bonusOf(b), tiebreak: b.flags?.spycraft2?.tiebreak }
      );
    }
  };
}

/**
 * What recordFluidEvent would refuse for these values, worked out without writing anything, so the dialog can say it
 * and stay open with the choices kept. "" when the event can be recorded.
 */
export function fluidEventRefusal(combatant, id, input = {}) {
  if (!combatant) return loc`Choose a combatant.`;
  if (!combatant.isOwner) return loc`You do not control that combatant.`;
  const count = combatant.initiative;
  if (!Number.isFinite(count)) return loc`${combatant.name} has not rolled Initiative yet: roll it first.`;
  const state = fluidForRound(combatant, combatant.parent?.round);
  try {
    if (id === "delay")
      delay(count, Number(input.times) || 1, { initiativeBonus: bonusOf(combatant), usedThisRound: state.delayed });
    else if (id === "press") press(count, { pressedThisRound: state.pressed });
    else if (id === "ready") readyTrigger(count, Number(input.triggerCount));
    else {
      const modifier = fluidModifier(id, {
        times: Number(input.times) || 1,
        amount: input.amount === undefined || input.amount === "" ? null : Number(input.amount),
        weapon: input.weapon ?? "",
        intBonus: Math.max(0, combatant.actor?.system?.abilities?.int?.mod ?? 0)
      });
      const added = addFluidModifier(state.modifiers, modifier);
      if (!added.added) return added.reason;
    }
  } catch (error) {
    return error.message;
  }
  return "";
}

/** Record one Table 5.2 event against a combatant for the current round; immediate ones change the Count now. */
export async function recordFluidEvent(combatant, id, input = {}) {
  return queueResources(
    [combatant?.actor],
    () => recordFluidEventLocked(combatant.parent?.combatants.get?.(combatant.id) ?? combatant, id, input),
    { messages: [combatant?.parent].filter(Boolean) }
  );
}
async function recordFluidEventLocked(combatant, id, input = {}) {
  if (combatant?.flags?.spycraft2?.fluidSettlement?.state === "effectsPending")
    throw Error(loc`Finish this combatant's recorded end-of-round conditions from Fluid initiative event first.`);
  if (!combatant?.isOwner) throw new Error(loc`You do not control that combatant.`);
  const combat = combatant.parent,
    round = combat.round,
    state = fluidForRound(combatant, round);
  const count = combatant.initiative;
  if (!Number.isFinite(count)) throw new Error(loc`Roll Initiative first.`);
  if (id === "delay") {
    const result = delay(count, Number(input.times) || 1, {
      initiativeBonus: bonusOf(combatant),
      usedThisRound: state.delayed
    });
    const wasActing = combat?.started && combat.combatant?.id === combatant.id,
      turnBefore = combat?.turn;
    // The acting character stepping down hands the turn on; anyone else's Count change leaves the turn where it is.
    // The delaying character steps down the order; the turn goes to whoever now stands in that place, so the
    // characters between the old and the new Count still act this round (p.356). The lead GM moves the turn and
    // starts the next one (keepActingTurn), so a player who delays needs no right to change the fight.
    await combatant.update(
      { initiative: result.count, "flags.spycraft2.fluid": { ...state, delayed: result.used } },
      wasActing && Number.isInteger(turnBefore) ? { spycraft2HandOver: true, spycraft2HandOverTurn: turnBefore } : {}
    );
    return { count: result.count };
  }
  if (id === "press") {
    const result = press(count, { pressedThisRound: state.pressed });
    await combatant.update({
      initiative: result.count,
      "flags.spycraft2.fluid": { ...state, pressed: true },
      "flags.spycraft2.mustPress": false
    });
    return { count: result.count, note: loc`Gains 1 extra half action now; other actions happen at the new Count.` };
  }
  if (id === "ready") {
    const result = readyTrigger(count, Number(input.triggerCount));
    await combatant.update({ initiative: result.count, "flags.spycraft2.fluid": state });
    return { count: result.count };
  }
  const modifier = fluidModifier(id, {
    times: Number(input.times) || 1,
    amount: input.amount === undefined || input.amount === "" ? null : Number(input.amount),
    weapon: input.weapon ?? "",
    intBonus: Math.max(0, combatant.actor?.system?.abilities?.int?.mod ?? 0)
  });
  const added = addFluidModifier(state.modifiers, modifier);
  if (!added.added) throw new Error(added.reason);
  await combatant.update({ "flags.spycraft2.fluid": { ...state, modifiers: added.list } });
  return { count, pending: added.list.reduce((sum, entry) => sum + entry.amount, 0) };
}

/**
 * Record a fluid initiative event that damage application caused (wound loss, a critical hit with wound loss) on the
 * actor's combatant in the active combat, unless the GC has turned this off. Returns a report line, or null when
 * nothing was recorded (no combat, not a combatant, not allowed, or already recorded this round).
 */
export async function recordAutomaticFluidEvent(actor, id) {
  const enabled = readSetting("autoFluidEvents", true) !== false;
  if (!enabled || !actor) return null;
  // The character's own fight, whichever scene this client is viewing; the viewed fight is tried first.
  const fights = [game.combat, ...(game.combats ?? [])].filter(
      (combat, i, all) => combat?.started && all.indexOf(combat) === i
    ),
    all = fights.flatMap(combat => [...combat.combatants]),
    exact = all.filter(entry => entry.actor === actor || (entry.actor?.uuid && entry.actor.uuid === actor.uuid)),
    // A world actor whose one token in the fights is unlinked is still that combatant.
    loose = exact.length || actor.isToken ? [] : all.filter(entry => entry.actorId === actor.id),
    combatant = exact[0] ?? (loose.length === 1 ? loose[0] : null);
  if (!combatant?.isOwner || !Number.isFinite(combatant.initiative)) return null;
  const event = FLUID_EVENTS.find(entry => entry.id === id);
  try {
    await recordFluidEvent(combatant, id);
  } catch (error) {
    console.warn("Field Agent's Handbook | Fluid initiative was not recorded from damage.", error);
    return loc`Fluid initiative was not recorded for this (${error?.message ?? ""}); add it with Fluid initiative event.`;
  }
  return loc`Initiative ${event?.amount ?? ""} at the end of the round (${event?.label ?? id}); change it with Fluid initiative event if it should not count.`;
}

export function registerAutomaticFluidSetting() {
  game.settings.register("spycraft2", "autoFluidEvents", {
    name: locKey`Record fluid initiative from damage`,
    hint: locKey`When applied damage costs a combatant wounds, the matching end-of-round Initiative change is recorded for you.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

/** Dialog: choose a combatant and an event. */
/**
 * Each combatant's name as the console shows it: a name several combatants share gets "#1", "#2"… in turn order, so
 * three "Guard" rows, the acting heading and a notice can be told apart.
 */
export function combatantLabels(combat) {
  const turns = [...(combat?.turns ?? [])],
    totals = new Map(),
    seen = new Map();
  for (const combatant of turns) totals.set(combatant.name, (totals.get(combatant.name) ?? 0) + 1);
  return new Map(
    turns.map(combatant => {
      if (totals.get(combatant.name) < 2) return [combatant.id, combatant.name];
      const number = (seen.get(combatant.name) ?? 0) + 1;
      seen.set(combatant.name, number);
      return [combatant.id, `${combatant.name} #${number}`];
    })
  );
}

/** The recorded event a "combatantId:index" choice names, or null when it is no longer there. */
function removalOf(combat, choice) {
  const [id, at] = String(choice ?? "").split(":"),
    combatant = combat?.combatants?.get?.(id),
    index = Number(at),
    entry = combatant ? fluidForRound(combatant, combat.round).modifiers[index] : null;
  return entry && combatant.isOwner ? { combatant, index, entry } : null;
}
/** Take one recorded end-of-round event off a combatant; nothing has been applied yet, so the Count stays. */
export async function removeFluidEvent(combatant, index, expected = null) {
  return queueResources(
    [combatant?.actor],
    async () => {
      const fresh = combatant.parent?.combatants.get?.(combatant.id) ?? combatant,
        state = fluidForRound(fresh, fresh.parent?.round),
        entry = state.modifiers[index];
      if (!entry || (expected && (entry.id !== expected.id || entry.amount !== expected.amount)))
        throw Error(loc`That event is no longer recorded.`);
      await fresh.update({
        "flags.spycraft2.fluid": { ...state, modifiers: state.modifiers.filter((_, at) => at !== index) }
      });
      return entry;
    },
    { messages: [combatant?.parent].filter(Boolean) }
  );
}
/** One line saying when the chosen event moves the Count: at once, or with the rest at the end of the round. */
export function fluidPreviewLine(id, { count, due, immediate } = {}) {
  if (id === "remove") return loc`Nothing has been applied yet: the event just stops counting at the end of the round.`;
  if (immediate) return loc`Changes the Count at once${Number.isFinite(count) ? loc` (now ${count})` : ""}.`;
  if (!due || !Number.isFinite(count)) return loc`Applies when the round ends.`;
  const sign = value => `${value > 0 ? "+" : ""}${value}`;
  return due.rows.length
    ? loc`Applies when the round ends. As recorded so far: ${count} → ${due.count} (${sign(due.delta)}${due.capped ? loc`, limited to ±10` : ""}).`
    : loc`Applies when the round ends; nothing is recorded for this combatant yet.`;
}

export async function fluidEventDialog(combat = game.combat, preset = null) {
  const pendingRounds = [
    ...new Set(
      [...(combat?.combatants ?? [])]
        .map(c => c.flags?.spycraft2?.fluidSettlement)
        .filter(s => s?.state === "effectsPending")
        .map(s => s.round)
    )
  ];
  for (const round of pendingRounds) await applyEndOfRound(combat, round);
  if (!combat?.started) return refuse(loc`Start the combat first.`);
  // The acting combatant first, then the rest in turn order, numbered when they share a name.
  const labels = combatantLabels(combat),
    mine = (combat.turns ?? [...combat.combatants])
      .filter(combatant => combatant.isOwner)
      .sort((a, b) => (b.id === combat.combatant?.id) - (a.id === combat.combatant?.id));
  if (!mine.length) return refuse(loc`You control no combatant in this fight.`);
  const signedCount = value => `${value > 0 ? "+" : ""}${value}`;
  // What the round's end will do to each Count as things stand: the raw sum, and what the ±10 limit leaves of it.
  const outlook = combatant => {
    const state = fluidForRound(combatant, combat.round);
    return endOfRound(combatant.initiative, state.modifiers, { alreadyApplied: -(Number(state.delayed) || 0) });
  };
  const rows = mine.map(combatant => {
    const due = outlook(combatant),
      raw = due.rows.reduce((sum, entry) => sum + entry.amount, 0);
    return [
      combatant.id,
      `${labels.get(combatant.id) ?? combatant.name}: ${combatant.initiative ?? loc`not rolled`}${
        raw
          ? due.capped
            ? loc` (${signedCount(raw)} pending, ${signedCount(due.delta)} after the ±10 limit)`
            : loc` (${signedCount(raw)} pending)`
          : ""
      }`
    ];
  });
  // Events already recorded this round, so a mistaken one can be taken back.
  const recorded = mine.flatMap(combatant =>
    fluidForRound(combatant, combat.round).modifiers.map((entry, index) => [
      `${combatant.id}:${index}`,
      `${labels.get(combatant.id) ?? combatant.name}: ${entry.label} (${signedCount(entry.amount)})`
    ])
  );
  const groups = [...new Set(FLUID_EVENTS.map(event => event.group))];
  const eventOptions =
    groups
      .map(
        group =>
          `<optgroup label="${esc(group)}">${options(FLUID_EVENTS.filter(event => event.group === group).map(event => [event.id, `${event.label}${event.amount === null ? "" : ` (${event.amount > 0 ? "+" : ""}${event.amount})`}`]))}</optgroup>`
      )
      .join("") +
    (recorded.length
      ? `<optgroup label="${esc(loc`Corrections`)}">${options([["remove", loc`Take back a recorded event`]])}</optgroup>`
      : "");
  const immediate = new Set(["delay", "press", "ready"]);
  const input = await ask(
    loc`Fluid initiative — Table 5.2`,
    `
    <p>${loc`Recorded modifiers apply when the round ends, limited to ±10 in a round. Delay, Press and a triggered Ready change the Count at once.`}</p>
    <label>${loc`Combatant and Initiative Count`} <select name="combatantId">${options(rows, preset?.id ?? combat.combatant?.id)}</select></label>
    <label>${loc`Event`} <select name="id">${eventOptions}</select></label>
    <p class="hint" data-fluid-preview aria-live="polite"></p>
    ${recorded.length ? `<label data-when="id=remove">${loc`Recorded event to take back`} <select name="removal">${options(recorded)}</select></label>` : ""}
    <label data-when="id!=press|ready|bleeding|fatigued|exhausted|shaken2|criticalInjury|diversion|regroup|remove">${loc`Times it applies (attacks, dice spent, damage points, Counts delayed)`} <input type="number" name="times" min="1" value="1" /></label>
    <label data-when="id=diversion">${loc`Rolled Count loss (Diversion only)`} <input type="number" name="amount" min="1" max="8" /></label>
    <label data-when="id=unproficient">${loc`Weapon (proficiency penalty only)`} <input name="weapon" /></label>
    <label data-when="id=ready">${loc`Count at which the Ready trigger occurred`} <input type="number" name="triggerCount" value="${combat.combatant?.initiative ?? 0}" /></label>`,
    loc`Record event`,
    // Refused inside the dialog, so the combatant and event chosen stay chosen.
    values => {
      if (values.id === "remove") return removalOf(combat, values.removal) ? "" : loc`Choose the event to take back.`;
      if (values.id === "diversion" && !(Number(values.amount) >= 1))
        return loc`Enter the rolled Count loss for Diversion.`;
      const timed = !/^(press|ready|bleeding|fatigued|exhausted|shaken2|criticalInjury|diversion|regroup)$/.test(
        values.id
      );
      if (timed && !(Number(values.times) >= 1)) return loc`Times it applies must be 1 or more.`;
      return fluidEventRefusal(combat.combatants.get(values.combatantId), values.id, values);
    },
    {
      // One line under the event says when the Count moves: now, or with the rest when the round ends.
      render: (event, app) => {
        const root = app?.element ?? event?.target,
          line = root?.querySelector?.("[data-fluid-preview]"),
          who = root?.querySelector?.('[name="combatantId"]'),
          what = root?.querySelector?.('[name="id"]');
        if (!line || !who || !what) return;
        const show = () => {
          const combatant = combat.combatants.get(who.value);
          line.textContent = fluidPreviewLine(what.value, {
            count: combatant?.initiative,
            due: combatant ? outlook(combatant) : null,
            immediate: immediate.has(what.value)
          });
        };
        for (const field of [who, what]) field.addEventListener("change", show);
        show();
      }
    }
  );
  if (!input) return null;
  if (input.id === "remove") {
    const removal = removalOf(combat, input.removal);
    if (!removal) return refuse(loc`That event is no longer recorded.`);
    try {
      await withUndo(
        [removal.combatant.actor],
        loc`Fluid initiative: ${removal.combatant.name}, ${removal.entry.label} taken back`,
        () => removeFluidEvent(removal.combatant, removal.index, removal.entry)
      );
      await say(
        loc`${esc(removal.combatant.name)}: ${esc(removal.entry.label)} (${signedCount(removal.entry.amount)}) taken back; it no longer counts at the end of the round.`
      );
      return { removed: removal.entry };
    } catch (error) {
      return refuse(error.message);
    }
  }
  const combatant = combat.combatants.get(input.combatantId);
  try {
    // The Undo note puts the Count and the round's fluid record back, as long as nothing changed them since.
    const label = FLUID_EVENTS.find(event => event.id === input.id)?.label ?? input.id;
    const result = await withUndo([combatant.actor], loc`Fluid initiative: ${combatant.name}, ${label}`, () =>
      recordFluidEvent(combatant, input.id, input)
    );
    await say(
      `${esc(combatant.name)}: ${esc(label)} — ${result.pending === undefined ? `${loc`Initiative Count is now`} <b>${result.count}</b>.` : loc`${result.pending > 0 ? "+" : ""}${result.pending} pending at the end of the round.`}${result.note ? ` ${esc(result.note)}` : ""}`
    );
    return result;
  } catch (error) {
    return refuse(error.message);
  }
}

/** The actions a combatant has spent on the current turn. */
const actionsOf = combatant =>
  actionBudget(combatant.flags?.spycraft2?.actions, { round: combatant.parent?.round ?? 0 });

/** A Press this round buys one more half action. */
const extraHalfActions = combatant => (fluidForRound(combatant, combatant.parent?.round).pressed ? 1 : 0);

/** Half actions a combatant still has this turn, counting a Press. */
export const halfActionsLeft = combatant =>
  HALF_ACTIONS_PER_TURN + extraHalfActions(combatant) - actionsOf(combatant).used;

/** Spend a half or full action from a combatant's turn, or give the turn's actions back with kind "reset". */
export async function spendTurnAction(combatant, kind, { quiet = false, label = loc`the GC Console` } = {}) {
  if (!combatant) return null;
  const state = actionsOf(combatant);
  if (kind === "reset") return combatant.update({ "flags.spycraft2.actions": resetActions(state) });
  const result = spendAction(state, kind, { extra: extraHalfActions(combatant), label });
  if (!result.ok) {
    // As with an attack that goes over: what is left is used up and the GC is told, rather than nothing recorded.
    if (!quiet)
      ui.notifications.warn(
        loc`${combatant.name} had ${result.left} half action(s) left this turn; this took more, and the turn is now used up.`
      );
    if (result.left > 0)
      await combatant.update({
        "flags.spycraft2.actions": setActionsUsed(state, state.used + result.left, label)
      });
    return null;
  }
  await combatant.update({ "flags.spycraft2.actions": result.state });
  return result;
}

/**
 * Before an action from the sheet: say so when the acting character's turn has too little left for it, so the
 * warning comes before the roll and not after. `need` is the half actions the action takes at least.
 * @returns {boolean} whether a warning was shown
 */
export function warnBeforeOverspend(actor, need = 1) {
  const combat = actor?.participatingCombat;
  const combatant = combat?.started ? combat.combatant : null;
  if (!combatant || combatant.actor?.uuid !== actor.uuid) return false;
  const left = halfActionsLeft(combatant);
  if (left >= need) return false;
  ui.notifications.warn(
    left > 0
      ? loc`${combatant.name} has ${left} half action left this turn, and this takes ${need}. The GC decides whether it stands.`
      : loc`${combatant.name} has no half actions left this turn. The GC decides whether this stands.`
  );
  return true;
}

/**
 * Mark the time an action took on the acting character's turn, after the action went through. Only the combatant whose
 * turn it is spends; an action taken outside one's own turn (a reaction, a free attack) leaves the record alone. When
 * the turn has too little left the action still stands, as the GC decides, and the player is told.
 * @param {Actor} actor
 * @param {"half"|"full"} kind
 * @returns {Promise<object|null>} the spend, or null when nothing was marked
 */
export async function markActionSpent(actor, kind, { label = "", warned = false } = {}) {
  const combat = actor?.participatingCombat;
  const combatant = combat?.started ? combat.combatant : null;
  if (!combatant || combatant.actor?.uuid !== actor.uuid || !combatant.isOwner) return null;
  const result = spendAction(actionsOf(combatant), kind, { extra: extraHalfActions(combatant), label });
  if (!result.ok) {
    // The action stands, as the GC ruled by taking it; the turn is recorded as used up (the same as a Spend). When
    // the sheet already said so before the action, it is not said twice.
    if (!warned)
      ui.notifications.warn(
        game.user?.isGM
          ? loc`${combatant.name} had ${result.left} half action(s) left this turn; this took more, and the turn is now used up.`
          : loc`${combatant.name} had ${result.left} half action(s) left this turn; this took more. The GC decides whether it stands.`
      );
    // The turn is recorded as used up, so anything further this turn warns as well.
    if (result.left > 0)
      await combatant.update({
        "flags.spycraft2.actions": setActionsUsed(actionsOf(combatant), actionsOf(combatant).used + result.left, label)
      });
    return null;
  }
  await combatant.update({ "flags.spycraft2.actions": result.state });
  return result;
}

/**
 * Wrap a sheet action so that, once it goes through, it marks its time on the actor's turn. `kind` is the time, or a
 * function that reads it from the action's result (an attack's cost depends on what was declared).
 */
export const costsAction = (kind, handler, label = "") =>
  async function (event, target) {
    // A fixed cost is known before the action; one read from the result takes a half action at least. `label`
    // names the action on the pip it marks; an action that may cost nothing (no label) is not warned about.
    const warned = label ? warnBeforeOverspend(this.actor, typeof kind === "string" ? ACTION_COST[kind] : 1) : false;
    const result = await handler.call(this, event, target);
    const spent = typeof kind === "function" ? kind(result) : kind;
    const name = typeof label === "function" ? label() : label;
    if (result && spent && (await markActionSpent(this.actor, spent, { label: name, warned }))) this.render?.();
    return result;
  };

/** Apply every combatant's recorded modifiers for the round that just ended. */
export function applyEndOfRound(combat, endedRound) {
  // Queued with the dramatic-scene doubling, so each reads the Count the other wrote.
  return queueInitiative(() => endOfRoundWork(combat, endedRound));
}
async function endOfRoundWork(combat, endedRound) {
  const lines = [];
  for (const candidate of [...combat.combatants]) {
    await queueResources(
      [candidate.actor],
      async () => {
        const combatant = combat.combatants.get?.(candidate.id) ?? candidate;
        const prior = combatant.flags?.spycraft2?.fluidSettlement;
        if (prior?.round === endedRound && prior.state === "effectsPending") {
          await finishFluidConditions(combatant, prior);
          return;
        }
        if (prior?.round === endedRound && prior.state === "complete") return;
        const state = fluid(combatant);
        if ((state.round !== null && state.round !== endedRound) || !Number.isFinite(combatant.initiative)) return;
        // Counts given up to Delay this round use up the same ±10 limit (p.324).
        const result = endOfRound(combatant.initiative, state.round === endedRound ? state.modifiers : [], {
          alreadyApplied: state.round === endedRound ? -(Number(state.delayed) || 0) : 0
        });
        const pieces = result.rows.map(row => `${row.label} ${row.amount > 0 ? "+" : ""}${row.amount}`);
        if (!result.delta && !result.reeling && !result.mustPress) {
          if (state.modifiers.length || state.delayed || state.pressed)
            await combatant.update({
              "flags.spycraft2.fluid": { round: null, modifiers: [], delayed: 0, pressed: false },
              ...settledCountEvents(combatant, endedRound)
            });
          return;
        }
        await combatant.update({
          initiative: result.count,
          "flags.spycraft2.fluid": { round: null, modifiers: [], delayed: 0, pressed: false },
          "flags.spycraft2.mustPress": result.mustPress,
          "flags.spycraft2.fluidSettlement": {
            round: endedRound,
            result,
            state: result.reeling ? "effectsPending" : "complete"
          },
          ...settledCountEvents(combatant, endedRound)
        });
        if (result.reeling) await finishFluidConditions(combatant, { round: endedRound, result });
        lines.push(
          `${esc(combatant.name)}: ${combatant.initiative}${pieces.length ? ` (${esc(pieces.join(", "))}${result.capped ? loc`; limited to ±10` : ""})` : ""}${result.reeling ? ` — <b>${loc`reeling and flat-footed`}</b>${loc`: Count was 0 or less, +20`}` : ""}${result.mustPress ? ` — <b>${loc`must Press`}</b> ${loc`as the first action (Count 50+)`}` : ""}`
        );
      },
      { messages: [combat] }
    );
  }
  if (lines.length) await say(`<b>${loc`Fluid initiative — end of round ${endedRound}`}</b><br>${lines.join("<br>")}`);
  return lines;
}

async function finishFluidConditions(combatant, settlement) {
  for (const [id, label] of [
    ["reeling", loc`Reeling`],
    ["flat-footed", loc`Flat-footed`]
  ])
    await setConditionStatus(combatant.actor, id, true, {
      label,
      operationId: `fluid-${combatant.id}-${settlement.round}-${id}`
    });
  await combatant.update({ "flags.spycraft2.fluidSettlement.state": "complete" });
}

/**
 * Break remaining ties (same Count and bonus) with a d20 roll-off stored on the combatants. Only members with no
 * stored roll-off roll, so two tied combatants never swap places when a third joins them; one pass runs at a time
 * for each fight.
 */
const tiebreakRuns = new Map();
export function rollTiebreaks(combat = game.combat) {
  const key = combat?.id ?? "";
  const run = (tiebreakRuns.get(key) ?? Promise.resolve()).catch(() => 0).then(() => rollTiebreaksNow(combat));
  tiebreakRuns.set(key, run);
  return run;
}
async function rollTiebreaksNow(combat) {
  const groups = new Map();
  for (const combatant of combat?.combatants ?? []) {
    if (!Number.isFinite(combatant.initiative)) continue;
    const key = `${combatant.initiative}|${bonusOf(combatant)}`;
    groups.set(key, [...(groups.get(key) ?? []), combatant]);
  }
  let rolled = 0;
  for (const tied of groups.values()) {
    const stored = combatant => Number.isFinite(combatant.flags?.spycraft2?.tiebreak);
    if (tied.length < 2 || tied.every(stored)) continue;
    const seen = new Set(tied.filter(stored).map(combatant => combatant.flags.spycraft2.tiebreak));
    for (const combatant of tied.filter(entry => !stored(entry))) {
      let value;
      do {
        value = (await new Roll("1d20").evaluate()).total + Math.random();
      } while (seen.has(value));
      seen.add(value);
      rolled++;
      await combatant.update({ "flags.spycraft2.tiebreak": value });
    }
  }
  return rolled;
}

/** One Initiative check for a set of NPCs (p.323): by default every unrolled non-player combatant, grouped by actor. */
const combatantsOf = combat => [...(combat?.combatants ?? [])];

export async function rollGroupInitiative(combat = game.combat, { single = false } = {}) {
  if (!game.user.isGM) return null;
  if (!combat) return refuse(loc`There is no active combat.`);
  // NPCs only: an agent nobody owns today (an absent player's character) still rolls its own check, so it can be
  // boosted, and is named in the report instead.
  const unrolled = combat.combatants.filter(
      combatant => combatant.initiative === null && combatant.actor && !combatant.isDefeated
    ),
    // An NPC a player runs is that player's to roll.
    pending = unrolled.filter(combatant => combatant.actor.type === "npc" && !combatant.hasPlayerOwner),
    left = unrolled.filter(combatant => combatant.actor.type !== "npc" && !combatant.hasPlayerOwner);
  const groups = new Map();
  for (const combatant of pending) {
    const key = single
      ? "all"
      : combatant.actor.isToken
        ? (combatant.token?.baseActor?.id ?? combatant.actorId)
        : combatant.actorId;
    groups.set(key, [...(groups.get(key) ?? []), combatant]);
  }
  const lines = [];
  let rolled = 0;
  const keyOf = combatant =>
    combatant.actor?.isToken ? (combatant.token?.baseActor?.id ?? combatant.actorId) : combatant.actorId;
  for (const [key, group] of groups) {
    // A late arrival of a kind already rolled joins that kind's Count instead of rolling its own (p.323).
    const rolledKin = single
      ? null
      : combatantsOf(combat).find(
          other => Number.isFinite(other.initiative) && other.actor?.type === "npc" && keyOf(other) === key
        );
    if (rolledKin) {
      for (const combatant of group) await combatant.update({ initiative: rolledKin.initiative });
      lines.push(
        loc`${esc(group.map(member => member.name).join(", "))}: joins ${esc(rolledKin.name)} on Count ${rolledKin.initiative}`
      );
      rolled += 1;
      continue;
    }
    // Each member's own Initiative roll is asked for first, so a Shaken source waiting for review holds that member
    // back, as it would on a roll of its own.
    const members = [],
      held = [];
    for (const combatant of group) {
      try {
        combatant.getInitiativeRoll?.();
        members.push(combatant);
      } catch (error) {
        held.push(loc`${esc(combatant.name)}: not rolled (${esc(error.message)})`);
      }
    }
    lines.push(...held);
    if (!members.length) continue;
    // The group's d20 comes from the first member's own roll, so Lightning Reflexes (roll twice, keep one) applies.
    let roll;
    try {
      roll = await (members[0].getInitiativeRoll?.() ?? new Roll("1d20")).evaluate();
    } catch (error) {
      lines.push(loc`${esc(members.map(member => member.name).join(", "))}: not rolled (${esc(error.message)})`);
      continue;
    }
    const d20 = Number.isFinite(roll.dice?.[0]?.total) ? roll.dice[0].total : roll.total - bonusOf(members[0]);
    for (const combatant of members) await combatant.update({ initiative: d20 + bonusOf(combatant) });
    // The card gives each member's Count, with the shared die beside it.
    lines.push(
      loc`d20 ${d20}: ${esc(members.map(member => loc`${member.name} Count ${member.initiative}`).join(", "))}`
    );
    rolled += 1;
  }
  if (left.length)
    lines.push(
      loc`Not rolled, no player owns them: ${esc(left.map(member => member.name).join(", "))}. Roll from the sheet or the tracker.`
    );
  if (lines.length) await say(`<b>${loc`Group Initiative`}</b><br>${lines.join("<br>")}`, { whisper: true });
  else ui.notifications?.info(loc`Every NPC in this fight already has an Initiative Count.`);
  return rolled;
}

/** Surprise round (p.323): enter each group's opposed result; winners are flagged and announced. */
export async function surpriseRoundDialog(combat = game.combat) {
  if (!game.user.isGM) return null;
  if (!combat) return refuse(loc`Create the combat first.`);
  const input = await ask(
    loc`Surprise round — p.323`,
    `
    <p>${loc`Enter each side's opposed team Blend/Stealth or Sneak/Hide result. The winners get a single free, half or full action in Initiative order (no splitting a full action, one free action at most).`}</p>
    <label>${loc`Awareness`} <select name="aware">${options(
      [
        ["none", loc`Neither side knows the other is there`],
        ["some", loc`One group is concealing itself`],
        ["all", loc`Everyone is aware (no surprise round)`]
      ],
      "none"
    )}</select></label>
    <label>${loc`Player characters’ result`} <input type="number" name="players" value="0" /></label>
    <label>${loc`Opponents’ result`} <input type="number" name="opponents" value="0" /></label>
    <label>${loc`Concealing group`} <select name="actingGroup">${options(
      [
        ["players", loc`Player characters`],
        ["opponents", loc`Opponents`]
      ],
      "opponents"
    )}</select></label>`,
    loc`Set the surprise round`
  );
  if (!input) return null;
  let result;
  try {
    result = surpriseRound({
      groups: [
        { id: "players", result: Number(input.players) },
        { id: "opponents", result: Number(input.opponents) }
      ],
      aware: input.aware,
      actingGroup: input.actingGroup
    });
  } catch (error) {
    return refuse(error.message);
  }
  const was = combat.flags?.spycraft2?.surprise ?? null;
  await combat.update({
    "flags.spycraft2.surprise": result.occurs ? { winners: result.winners, round: combat.round } : null
  });
  // Undo sets the fight's surprise mark back to what it was before.
  await postUndo(loc`Surprise round set`, [], { combatSurprise: { combat: combat.id, was } }).catch(() => null);
  await say(
    result.occurs
      ? `<b>${loc`Surprise round:`}</b> ${loc`${result.winners[0] === "players" ? "the player characters" : "the opponents"} act — 1 free, half or full action each, in Initiative order. Everyone else waits for round 1.`}`
      : `<b>${loc`No surprise round.`}</b> ${esc(result.reason)}`
  );
  return result;
}

// The end-of-round pass of the latest round change; other hooks wait for it before reading the new order.
let endOfRoundPass = Promise.resolve();
/** Resolves once fluid initiative has finished reordering the combat for the latest round change. */
export const fluidRoundSettled = () => endOfRoundPass;

/**
 * Whether a combatant's flat-footedness ends as its turn begins: it is about to act (p.342). Not in a surprise round
 * the combatant's side did not win, since it takes no action then.
 * @param {{round:number, surprise?:{winners:string[], round:number}|null}} combat
 * @param {{playerSide:boolean}} combatant
 */
export function flatFootedEndsOnTurn(combat, { playerSide }) {
  const surprise = combat?.surprise;
  if (surprise && surprise.round === combat.round)
    return (surprise.winners ?? []).includes(playerSide ? "players" : "opponents");
  return true;
}

// The flat-footed marking at the start of the latest combat; the first turn waits for it before clearing.
let startPass = Promise.resolve();

/** Whose turn it is in each fight, as the lead GM last saw it, and the fights whose round is being settled. */
const actingIn = new Map(),
  settling = new Set();
/**
 * A Count that changes re-sorts the order, but the fight stores its turn as a place in that order, so the turn
 * would pass to whoever now stands in the old place. Unless the acting character stepped down on purpose, the
 * lead GM points the turn back at the same character.
 */
export async function keepActingTurn(combat, { handOver = false, handOverTurn = null } = {}) {
  if (!combat?.started || settling.has(combat.id)) return null;
  combat.setupTurns?.();
  const expected = actingIn.get(combat.id);
  const index = expected ? (combat.turns?.findIndex?.(entry => entry.id === expected) ?? -1) : -1;
  if (handOver && Number.isInteger(handOverTurn)) {
    // The acting character delayed: whoever now stands in its old place acts next, with its turn start.
    if (combat.turn !== handOverTurn)
      await combat.update({ turn: handOverTurn }, { spycraft2KeepTurn: true, turnEvents: false });
    actingIn.set(combat.id, combat.combatant?.id ?? null);
    await turnStart(combat, combat.combatant);
    return null;
  }
  if (handOver || index < 0) {
    actingIn.set(combat.id, combat.combatant?.id ?? null);
    return null;
  }
  if (index === combat.turn) return null;
  return combat.update({ turn: index }, { spycraft2KeepTurn: true, turnEvents: false });
}

/**
 * What happens as a combatant's turn begins, whichever way the turn reached it (Next turn, a Delay handing it on): a
 * readied action left from an earlier round lapses, and flat-footedness ends (p.342).
 */
export async function turnStart(combat, combatant) {
  const actor = combatant?.actor;
  if (!combat?.started || !combatant) return;
  const readied = combatant.flags?.spycraft2?.readied;
  if (readied && readied.round !== combat.round) await combatant.update({ "flags.spycraft2.readied": null });
  if (!actor?.statuses?.has?.("flat-footed")) return;
  const facts = { round: combat.round, surprise: combat.flags?.spycraft2?.surprise ?? null };
  if (!flatFootedEndsOnTurn(facts, { playerSide: actor.hasPlayerOwner === true })) return;
  try {
    await setConditionStatus(actor, "flat-footed", false, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
  } catch {
    /* supplied by another source: left for the GC */
  }
}

/** Fights whose start has already made everyone flat-footed: the pass runs once per fight. */
const flatFootedFights = new Set();

export function installFluidInitiativeHooks() {
  // Everyone starts a fight flat-footed unless he joins it deliberately after it begins (p.323).
  // The start is read from the combat's own update, which every client sees: the lead GM marks the fight whoever
  // pressed Begin combat.
  Hooks.on("updateCombat", (combat, changed, options) => {
    if (changed?.round !== 1 || options?.direction < 0) return;
    if (!isLeadGM() || !setting("startFlatFooted")) return;
    // Round 1 can be entered twice (back to round 0 and forward again): the fight starts flat-footed once.
    if (flatFootedFights.has(combat.id)) return;
    flatFootedFights.add(combat.id);
    startPass = (async () => {
      for (const combatant of combat.combatants) await condition(combatant.actor, "flat-footed", "Flat-footed");
    })();
    return startPass;
  });
  // An NPC in a running fight has been faced: its row in the mission's XP list is marked, once, by the lead GM.
  const faced = combatants =>
    isLeadGM() &&
    markAntagonistsFaced([...combatants].map(combatant => game.actors?.get?.(combatant.actorId))).catch(() => 0);
  Hooks.on("updateCombat", (combat, changed, options) => {
    if (changed?.round === 1 && !(options?.direction < 0)) faced(combat.combatants);
  });
  Hooks.on("createCombatant", combatant => {
    if (combatant.combat?.started) faced([combatant]);
  });
  // Flat-footedness ends when the character acts (p.342): clear it as the combatant's turn begins.
  Hooks.on("updateCombat", (combat, changed) => {
    if (Object.hasOwn(changed, "turn") || Object.hasOwn(changed, "round"))
      actingIn.set(combat.id, combat.combatant?.id ?? null);
  });
  Hooks.on("deleteCombat", combat => {
    actingIn.delete(combat.id);
    flatFootedFights.delete(combat.id);
  });
  // After a reload the lead GM learns who is acting before any Count can move.
  const learn = () => {
    for (const combat of game.combats ?? []) if (combat.started) actingIn.set(combat.id, combat.combatant?.id ?? null);
  };
  if (game.ready) learn();
  else Hooks.once("ready", learn);
  Hooks.on("updateCombat", async (combat, changed, options) => {
    if (!isLeadGM() || !combat?.started) return;
    if (!Object.hasOwn(changed, "turn") && !Object.hasOwn(changed, "round")) return;
    // The same character is still acting: only its place in the order moved.
    if (options?.direction < 0 || options?.spycraft2KeepTurn) return;
    // Who this turn belongs to is read now: a quick second Next turn must not make this pass act on someone else.
    const captured = combat.combatant;
    await startPass;
    if (Object.hasOwn(changed, "round")) {
      await null;
      await fluidRoundSettled();
      // A new round may have been reordered; its first turn is whoever leads the new order.
      return turnStart(combat, combat.combatant);
    }
    return turnStart(combat, captured);
  });
  Hooks.on("updateCombat", async (combat, changed, options) => {
    if (!isLeadGM() || !Object.hasOwn(changed, "round") || !setting("fluidInitiative")) return;
    const previous = combat.previous?.round ?? changed.round - 1;
    if (!(options?.direction > 0 || changed.round > previous) || previous < 1) return;
    let settle;
    endOfRoundPass = new Promise(resolve => (settle = resolve));
    settling.add(combat.id);
    try {
      const changedCounts = await applyEndOfRound(combat, previous);
      // Tiebreaks and the turn reset wait their place on the Initiative queue, behind any dramatic doubling the
      // pass set off, so the new order already holds the doubled Counts.
      await queueInitiative(async () => {
        await rollTiebreaks(combat);
        // The new round starts from the top of the revised order, not from whoever led the last one.
        if (changedCounts.length) {
          combat.setupTurns?.();
          if (combat.turn !== 0) await combat.update({ turn: 0 });
        }
      });
      ui.combat?.render();
    } catch (error) {
      ui.notifications.warn(loc`Fluid initiative needs review: ${error.message}`);
    } finally {
      settling.delete(combat.id);
      actingIn.set(combat.id, combat.combatant?.id ?? null);
      settle();
    }
  });
  Hooks.on("updateCombatant", (combatant, changed, options) => {
    // The sheet's half-action pips read the same record as the tracker's menu.
    if (changed.flags?.spycraft2?.actions && combatant.actor?.sheet?.rendered) combatant.actor.sheet.render();
    if (!isLeadGM()) return;
    const moved = Object.hasOwn(changed, "initiative");
    if (moved || Object.hasOwn(changed.flags?.spycraft2 ?? {}, "tiebreak"))
      keepActingTurn(combatant.parent, {
        handOver: options?.spycraft2HandOver === true,
        handOverTurn: options?.spycraft2HandOverTurn
      }).catch(() => {});
    if (moved) rollTiebreaks(combatant.parent).catch(() => {});
  });
  // Beside each name: what is left of the acting combatant's turn, and the states that change how it is attacked.
  Hooks.on("renderCombatTracker", (_app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const combat = game.combat;
    for (const combatant of combat?.combatants ?? []) {
      const row = root?.querySelector?.(`[data-combatant-id="${combatant.id}"]`);
      const name = row?.querySelector?.(".token-name .name, .token-name");
      if (!name || name.querySelector(".spycraft2-row-state")) continue;
      const notes = [];
      if (combatant.id === combat.combatant?.id) {
        const left = HALF_ACTIONS_PER_TURN + extraHalfActions(combatant) - actionsOf(combatant).used;
        notes.push(left === 1 ? loc`1 half action left` : loc`${left} half actions left`);
      }
      // Health is shown only to someone who may open the sheet; a flat-footed character is plain to all.
      if (combatant.flags?.spycraft2?.readied) notes.push(loc`readied action`);
      notes.push(...trackerRowStates(combatant.actor, { health: combatant.actor?.isOwner === true }));
      if (!notes.length) continue;
      const badge = document.createElement("span");
      badge.className = "spycraft2-actions-left spycraft2-row-state";
      // One line beside the name; a narrow tracker cuts it short and the tooltip keeps the whole of it.
      badge.textContent = notes.join(" · ");
      badge.dataset.tooltip = notes.join(", ");
      name.classList.add("spycraft2-row-name");
      name.append(badge);
    }
  });
  // Foundry 14 builds the tracker's right-click menu under the tracker's own class name.
  Hooks.on("getCombatTrackerContextOptions", (_app, entries) => {
    entries.push(...trackerMenuEntries());
  });
}

const rowCombatant = li => {
  const id = (li?.dataset ?? li?.[0]?.dataset)?.combatantId;
  return (ui.combat?.viewed ?? game.combat)?.combatants?.get(id) ?? game.combat?.combatants?.get(id) ?? null;
};

/** Report one immediate fluid event for a combatant, or say why it cannot be recorded. */
/** An NPC no player runs: what it plans stays between the GCs. */
const gcOnly = combatant => ({ whisper: !combatant?.hasPlayerOwner });
/** Whether the combatant's place in this round's order is already behind the turn pointer. */
const hasActed = combatant => {
  const combat = combatant?.parent,
    at = combat?.turns?.findIndex?.(entry => entry.id === combatant.id) ?? -1;
  return !!combat?.started && Number.isInteger(combat.turn) && at >= 0 && at < combat.turn;
};

async function quickFluidEvent(combatant, id, input, label) {
  if (!combatant) return null;
  if (!combatant.parent?.started) return refuse(loc`Start the combat first.`);
  try {
    const result = await recordFluidEvent(combatant, id, input);
    await say(
      `${esc(combatant.name)}: ${esc(label)} — ${loc`Initiative Count is now`} <b>${result.count}</b>.`,
      gcOnly(combatant)
    );
    return result;
  } catch (error) {
    return refuse(error.message);
  }
}

/** Delay by a number of Counts; with no number, ask for one. */
export async function delayCombatant(combatant, counts = null) {
  if (!combatant) return null;
  // Delay is chosen on a character's own turn, or before it: after it, a lower Count would be a second turn.
  if (hasActed(combatant))
    return refuse(
      loc`${combatant.name} has already acted this round. To move its Count anyway, use Fluid initiative event.`
    );
  let times = counts;
  if (times === null) {
    // The GC names the Count to act on; the ones still to come this round are listed to choose from.
    const now = combatant.initiative ?? 0,
      later = (combatant.parent?.turns ?? []).filter(
        other => other.id !== combatant.id && Number.isFinite(other.initiative) && other.initiative < now
      ),
      suggested = later.length ? later[0].initiative - 1 : now - 1;
    const stepsFor = values => now - Math.trunc(Number(values.count));
    const input = await formDialog({
      title: loc`Delay: ${combatant.name}`,
      ok: loc`Delay to this Count`,
      fields: [
        raw(
          `<label>${loc`Act on Count (now ${now})`} <input type="number" name="count" max="${now - 1}" value="${suggested}" /></label>${
            later.length
              ? `<p class="hint">${esc(loc`Still to act this round: ${later.map(other => `${other.name} ${other.initiative}`).join(", ")}. One below a Count acts after that character.`)}</p>`
              : ""
          }`
        )
      ],
      validate: values => {
        const steps = stepsFor(values);
        if (!Number.isSafeInteger(steps) || steps < 1) return loc`Choose a Count below ${now}.`;
        return fluidEventRefusal(combatant, "delay", { times: steps });
      }
    });
    if (!input) return null;
    times = stepsFor(input);
  }
  return quickFluidEvent(combatant, "delay", { times }, loc`Delay`);
}

/**
 * Step back one turn. The first turn of round 1 is as far back as a fight goes: stepping past it would un-start the
 * fight, and starting it again would mark everyone flat-footed a second time.
 */
export function stepBackTurn(combat) {
  if (!combat?.started) return null;
  if (combat.round <= 1 && !(combat.turn > 0)) {
    ui.notifications.info(loc`This is the first turn of the fight.`);
    return null;
  }
  // A defeated combatant takes no turn, so stepping back passes over it to the one who acted before.
  const turns = combat.turns ?? [];
  for (let index = (combat.turn ?? 0) - 1; index >= 0; index--)
    if (!turns[index]?.isDefeated) return combat.update({ turn: index }, { direction: -1 });
  return combat.previousTurn();
}

/** Mark a combatant as holding a readied action: a half action now, and a note on its tracker row. */
export async function readyCombatant(combatant) {
  if (!combatant) return null;
  const combat = combatant.parent;
  if (!combat?.started) return refuse(loc`Start the combat first.`);
  if (combatant.flags?.spycraft2?.readied) return refuse(loc`${combatant.name} already has a readied action.`);
  // Readying is a half action taken on the character's own turn; only its trigger comes at another time.
  if (combat.combatant?.id !== combatant.id)
    return refuse(loc`${combatant.name} can ready an action only on its own turn.`);
  const spend = spendAction(actionsOf(combatant), "half", { extra: extraHalfActions(combatant) });
  if (!spend.ok) return refuse(loc`${combatant.name} has no half action left this turn to ready with.`);
  // What sets it off and what it does are written down, so the trigger can be recognised when it comes.
  const input = await formDialog({
    title: loc`Ready an action: ${combatant.name}`,
    ok: loc`Ready the action`,
    fields: [
      raw(`<label>${loc`Trigger and action`} <input type="text" name="trigger" placeholder="${esc(loc`e.g. fire at the first guard through the door`)}" /></label>
      <label><input type="checkbox" name="endTurn" checked /> ${loc`Then end the turn`}</label>`)
    ]
  });
  if (!input) return null;
  // The dialog may have stayed open while the turn moved on or a half action was spent elsewhere: check again, and
  // take the half action from the budget as it stands now.
  if (combat.combatant?.id !== combatant.id || combatant.flags?.spycraft2?.readied)
    return refuse(loc`${combatant.name}'s turn changed while the dialog was open. Nothing was readied.`);
  const now = spendAction(actionsOf(combatant), "half", { extra: extraHalfActions(combatant) });
  if (!now.ok) return refuse(loc`${combatant.name} has no half action left this turn to ready with.`);
  const trigger = String(input.trigger ?? "")
    .trim()
    .slice(0, 200);
  // One write for the half action and the readied mark, so a second press finds the mark already there.
  await combatant.update({
    "flags.spycraft2.actions": now.state,
    "flags.spycraft2.readied": { round: combat.round, ...(trigger ? { trigger } : {}) }
  });
  await say(
    trigger
      ? loc`${esc(combatant.name)} readies an action: ${esc(trigger)}. When it happens, press Readied action triggered in the GC Console or on its tracker row.`
      : loc`${esc(combatant.name)} readies an action. When its trigger happens, press Readied action triggered in the GC Console or on its tracker row.`,
    gcOnly(combatant)
  );
  if (input.endTurn && combat.combatant?.id === combatant.id) await combat.nextTurn();
  return true;
}

/** The readied action goes off now: the combatant drops to the acting combatant's Count if that is lower. */
export async function triggerReadied(combatant) {
  if (!combatant) return null;
  const combat = combatant.parent,
    at = combat?.combatant?.initiative ?? combatant.initiative;
  const acted = hasActed(combatant),
    readied = combatant.flags?.spycraft2?.readied ?? null;
  // The marker comes off before the Count moves and the card posts, so nobody sees a readied action that went off.
  await combatant.update({ "flags.spycraft2.readied": null });
  let result;
  try {
    result = await quickFluidEvent(combatant, "ready", { triggerCount: at }, loc`Readied action triggered`);
  } catch (error) {
    await combatant.update({ "flags.spycraft2.readied": readied });
    throw error;
  }
  if (!result) {
    await combatant.update({ "flags.spycraft2.readied": readied });
    return result;
  }
  // The readied action was this round's action. If the new Count puts the combatant ahead of the turn pointer
  // again, its turn is marked as used up so the tracker and console show nothing left to do.
  const again = acted && !hasActed(combatant) && combat.combatant?.id !== combatant.id;
  if (again)
    await combatant.update({
      "flags.spycraft2.actions": {
        round: combat.round,
        used: HALF_ACTIONS_PER_TURN + Math.max(0, extraHalfActions(combatant))
      }
    });
  if (again)
    ui.notifications.info(
      loc`${combatant.name} has acted this round: pass its turn when it comes up again at the new Count.`
    );
  return result;
}

/**
 * The system's entries for the combat tracker's right-click menu, in the shape Foundry 14 reads: a label, an icon
 * class, a visibility test and a click handler that both receive the row.
 */
export function trackerMenuEntries() {
  const mine = li => rowCombatant(li)?.isOwner === true,
    started = li => mine(li) && rowCombatant(li)?.parent?.started === true,
    readied = li => !!rowCombatant(li)?.flags?.spycraft2?.readied;
  const entry = (label, icon, visible, run) => ({
    label,
    icon: `fa-solid ${icon}`,
    visible,
    onClick: (_event, li) => run(rowCombatant(li))
  });
  return [
    // Named as the GC Console names the same steps, so the two read as one tool.
    entry(loc`Spend half action`, "fa-circle-half-stroke", mine, c => spendTurnAction(c, "half")),
    entry(loc`Spend full action`, "fa-circle", mine, c => spendTurnAction(c, "full")),
    entry(loc`Give back this turn's actions`, "fa-rotate-left", mine, c => spendTurnAction(c, "reset")),
    entry(loc`Delay 1 Count`, "fa-arrow-down", started, c => delayCombatant(c, 1)),
    entry(loc`Delay…`, "fa-arrow-down-wide-short", started, c => delayCombatant(c)),
    entry(
      loc`Ready an action`,
      "fa-hourglass-half",
      li => started(li) && !readied(li),
      c => readyCombatant(c)
    ),
    entry(
      loc`Readied action triggered`,
      "fa-bolt",
      li => started(li) && readied(li),
      c => triggerReadied(c)
    ),
    entry(loc`Fluid initiative event…`, "fa-arrows-up-down", started, c => fluidEventDialog(c?.parent, c))
  ];
}

/** The short state words a tracker row shows for an actor: flat-footed, and the wound state when it may be seen. */
export function trackerRowStates(actor, { health = false } = {}) {
  const states = [];
  if (!actor) return states;
  if (actor.statuses?.has?.("flat-footed")) states.push(loc`flat-footed`);
  if (health && actor.system?.wounds && (actor.type !== "npc" || npcIsSpecial(actor))) {
    const state = woundState(Number(actor.system.wounds.value), actor.system.deathThreshold);
    const word = {
      unconscious: loc`unconscious`,
      dying: loc`dying`,
      dead: loc`dead`,
      destroyed: loc`destroyed`
    }[state];
    if (word) states.push(word);
  }
  return states;
}

/* -------------------------------------------- */
/*  Combat references (Tables 5.1, 5.3, 5.11)   */
/* -------------------------------------------- */

/** GC dialog: roll a base encounter distance, a deviation or a gas cloud's spread, or look up a surface. */
export async function combatReferenceDialog() {
  const input = await ask(
    loc`Combat references`,
    `<label>${loc`Look up`} <select name="tool">${options([
      ["encounter", loc`Base encounter distance (Table 5.1)`],
      ["deviation", loc`Deviation of a miss (Table 5.11)`],
      ["gas", loc`Gas cloud spread`],
      ["surface", loc`Special surface (Table 5.3)`]
    ])}</select></label>
    <label data-when="tool=encounter">${loc`Location (encounter)`} <select name="location">${options(Object.keys(ENCOUNTER_DISTANCES).map(key => [key, ENCOUNTER_LABELS[key]]))}</select></label>
    <label data-when="tool=deviation">${loc`Range increment to the target (deviation)`} <input type="number" name="increment" min="1" max="10" value="1" /></label>
    <label data-when="tool=gas">${loc`Rounds since release (gas)`} <input type="number" name="rounds" min="0" value="0" /></label>
    <label data-when="tool=gas">${loc`Wind (gas)`} <select name="wind">${options([
      ["none", loc`Still`],
      ["light", loc`Light`],
      ["moderate", loc`Moderate`],
      ["strong", loc`Strong or severe`]
    ])}</select></label>
    <label data-when="tool=surface">${loc`Surface`} <select name="surface">${options(Object.keys(SURFACES).map(key => [key, SURFACE_LABELS[key]]))}</select></label>
    <label data-when="tool=surface">${loc`Speed for the move (surface)`} <input type="number" name="speed" min="0" value="30" /></label>`,
    loc`Look up`,
    // Refused inside the dialog, so the tool and the figures chosen stay; nothing is quietly clamped.
    values => {
      const whole = (value, min, max = Infinity) =>
        Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max && String(value).trim() !== "";
      if (values.tool === "deviation" && !whole(values.increment, 1, 10))
        return loc`Enter a range increment from 1 to 10.`;
      if (values.tool === "gas" && !whole(values.rounds, 0))
        return loc`Enter the whole rounds since release, 0 or more.`;
      if (values.tool === "surface" && !whole(values.speed, 0)) return loc`Enter the Speed in feet, 0 or more.`;
      return null;
    }
  );
  if (!input) return null;
  const roll = async formula => new Roll(formula).evaluate();
  if (input.tool === "encounter") {
    const entry = ENCOUNTER_DISTANCES[input.location];
    if (!entry?.dice) return say(loc`Encounter distance: line of sight.`, { whisper: true });
    const dice = await roll(entry.dice),
      limit = Math.max(0, ...[...(game.scenes?.viewed?.tokens ?? [])].map(t => senseLimit(t.actor?.system))),
      result = encounterDistance(input.location, dice.total, limit || null);
    return ChatMessage.create({
      speaker: { alias: loc`Game Control` },
      whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id),
      rolls: [dice],
      content: `<p>${loc`Encounter distance: ${result.feet} ft.`}${result.limited ? ` ${loc`(cut from ${result.rolledFeet} ft. to the farthest anyone on the scene can see or hear)`}` : ""}</p>`
    });
  }
  if (input.tool === "deviation") {
    const distance = await roll(deviationDie(input.increment)),
      direction = await roll("1d8");
    return ChatMessage.create({
      speaker: { alias: loc`Game Control` },
      whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id),
      rolls: [distance, direction],
      content: `<p>${loc`The miss strays ${distance.total} square(s) in direction ${direction.total} of the Deviation Diagram (p.346). Off something with a Damage save of +10 or better it ricochets, with ${ricochetSquares(distance.total)} square(s) left.`}</p>`
    });
  }
  if (input.tool === "gas") {
    const increments = gasIncrements(input.rounds, input.wind),
      linger = await roll("2d4"),
      clearing = gasClearing(linger.total, input.wind);
    return ChatMessage.create({
      speaker: { alias: loc`Game Control` },
      whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id),
      rolls: [linger],
      content: `<p>${loc`The cloud covers ${increments} blast increment(s).`} ${
        clearing.immediate
          ? loc`The wind clears it at once.`
          : loc`Once fully grown it lingers ${clearing.lingerMinutes} minute(s), then loses an increment every ${clearing.minutesPerIncrement} minute(s).`
      }</p>`
    });
  }
  const move = surfaceMove(input.surface, input.speed);
  return say(
    move.squares === null
      ? loc`${SURFACE_LABELS[input.surface]}: no movement across it without the check.`
      : loc`${SURFACE_LABELS[input.surface]}: a ${Number(input.speed) || 0} ft. move covers ${move.feet} ft.${move.bonusStep ? "" : loc` No bonus 5-ft. step across it.`}`,
    { whisper: true }
  );
}

/**
 * Put the selected tokens into a fight on this scene, starting one when there is none: the console's way into a fight,
 * so the GC does not need Foundry's tracker for it. Tokens already in that fight are left alone.
 */
export async function addSelectedToFight() {
  const scene = globalThis.canvas?.scene,
    tokens = [...(globalThis.canvas?.tokens?.controlled ?? [])].map(token => token.document).filter(Boolean);
  if (!scene) return refuse(loc`Open a scene first.`);
  if (!tokens.length) return refuse(loc`Select the tokens to add on the map first (click, or drag a box round them).`);
  // The fight the GC is viewing comes first, linked to a scene or not; only with none is one looked for or made here.
  let fight =
    game.combat ?? [...(game.combats ?? [])].find(entry => entry.scene?.id === scene.id && entry.active) ?? null;
  fight ??= await CONFIG.Combat.documentClass.create({ scene: scene.id, active: true });
  if (!fight) return null;
  const present = new Set([...(fight.combatants ?? [])].map(combatant => combatant.tokenId));
  const fresh = tokens.filter(token => !present.has(token.id));
  if (!fresh.length) {
    ui.notifications.info(loc`Every selected token is already in the fight.`);
    return fight;
  }
  await fight.createEmbeddedDocuments(
    "Combatant",
    fresh.map(token => ({ tokenId: token.id, sceneId: scene.id, actorId: token.actorId, hidden: token.hidden }))
  );
  ui.notifications.info(
    fresh.length === 1
      ? loc`${fresh[0].name} joins the fight.`
      : loc`${fresh.length} join the fight: ${fresh.map(token => token.name).join(", ")}.`
  );
  return fight;
}

/** End the fight the console runs; Foundry's own end-combat question confirms it. */
export async function endFight(fight = game.combat) {
  if (!fight) return refuse(loc`No fight is running.`);
  return fight.endCombat();
}
