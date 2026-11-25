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
import { loc, locKey } from "../../i18n.mjs";
import { HALF_ACTIONS_PER_TURN, actionBudget, resetActions, spendAction } from "../../rules/action-budget.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { woundState } from "../../rules/damage-application.mjs";
import { npcIsSpecial } from "./npc-play.mjs";
import { markAntagonistsFaced } from "./mission.mjs";

const ask = (title, content, ok) => formDialog({ title, ok, fields: [raw(content)] });
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
const isLeadGM = () => game.users?.activeGM?.id === game.user.id;
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

/** Record one Table 5.2 event against a combatant for the current round; immediate ones change the Count now. */
export async function recordFluidEvent(combatant, id, input = {}) {
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
    await combatant.update(
      { initiative: result.count, "flags.spycraft2.fluid": { ...state, delayed: result.used } },
      wasActing ? { spycraft2HandOver: true } : {}
    );
    // The delaying character steps down the order; the turn goes to whoever now stands in that place, so the
    // characters between the old and the new Count still act this round (p.356).
    if (wasActing && Number.isInteger(turnBefore)) {
      combat.setupTurns?.();
      const now = combat.turns?.findIndex?.(c => c.id === combatant.id) ?? -1;
      if (now > turnBefore) await combat.update({ turn: turnBefore });
    }
    return { count: result.count };
  }
  if (id === "press") {
    const result = press(count, { pressedThisRound: state.pressed });
    await combatant.update({ initiative: result.count, "flags.spycraft2.fluid": { ...state, pressed: true } });
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
export async function fluidEventDialog(combat = game.combat, preset = null) {
  if (!combat?.started) return refuse(loc`Start the combat first.`);
  const mine = combat.combatants.filter(combatant => combatant.isOwner);
  if (!mine.length) return refuse(loc`You control no combatant in this fight.`);
  const rows = mine.map(combatant => {
    const pending = fluidForRound(combatant, combat.round).modifiers.reduce((sum, entry) => sum + entry.amount, 0);
    return [
      combatant.id,
      `${combatant.name} — Count ${combatant.initiative ?? "—"}${pending ? ` (${pending > 0 ? "+" : ""}${pending} pending)` : ""}`
    ];
  });
  const groups = [...new Set(FLUID_EVENTS.map(event => event.group))];
  const eventOptions = groups
    .map(
      group =>
        `<optgroup label="${esc(group)}">${options(FLUID_EVENTS.filter(event => event.group === group).map(event => [event.id, `${event.label}${event.amount === null ? "" : ` (${event.amount > 0 ? "+" : ""}${event.amount})`}`]))}</optgroup>`
    )
    .join("");
  const input = await ask(
    loc`Fluid initiative — Table 5.2`,
    `
    <p>${loc`Recorded modifiers apply when the round ends, limited to ±10 in a round. Delay, Press and a triggered Ready change the Count at once.`}</p>
    <label>${loc`Combatant`} <select name="combatantId">${options(rows, preset?.id ?? combat.combatant?.id)}</select></label>
    <label>${loc`Event`} <select name="id">${eventOptions}</select></label>
    <label data-when="id!=press|ready|bleeding|fatigued|exhausted|shaken2|criticalInjury|diversion|regroup">${loc`Times it applies (attacks, dice spent, damage points, Counts delayed)`} <input type="number" name="times" min="1" value="1" /></label>
    <label data-when="id=diversion">${loc`Rolled Count loss (Diversion only)`} <input type="number" name="amount" min="1" max="8" /></label>
    <label data-when="id=unproficient">${loc`Weapon (proficiency penalty only)`} <input name="weapon" /></label>
    <label data-when="id=ready">${loc`Count at which the Ready trigger occurred`} <input type="number" name="triggerCount" value="${combat.combatant?.initiative ?? 0}" /></label>`,
    loc`Record event`
  );
  if (!input) return null;
  const combatant = combat.combatants.get(input.combatantId);
  try {
    const result = await recordFluidEvent(combatant, input.id, input);
    const label = FLUID_EVENTS.find(event => event.id === input.id).label;
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
export async function spendTurnAction(combatant, kind) {
  if (!combatant) return null;
  const state = actionsOf(combatant);
  if (kind === "reset") return combatant.update({ "flags.spycraft2.actions": resetActions(state) });
  const result = spendAction(state, kind, { extra: extraHalfActions(combatant) });
  if (!result.ok) {
    ui.notifications.warn(loc`${combatant.name} has ${result.left} half action(s) left this turn.`);
    return null;
  }
  await combatant.update({ "flags.spycraft2.actions": result.state });
  return result;
}

/**
 * Mark the time an action took on the acting character's turn, after the action went through. Only the combatant whose
 * turn it is spends; an action taken outside one's own turn (a reaction, a free attack) leaves the record alone. When
 * the turn has too little left the action still stands, as the GC decides, and the player is told.
 * @param {Actor} actor
 * @param {"half"|"full"} kind
 * @returns {Promise<object|null>} the spend, or null when nothing was marked
 */
export async function markActionSpent(actor, kind) {
  const combat = actor?.participatingCombat;
  const combatant = combat?.started ? combat.combatant : null;
  if (!combatant || combatant.actor?.uuid !== actor.uuid || !combatant.isOwner) return null;
  const result = spendAction(actionsOf(combatant), kind, { extra: extraHalfActions(combatant) });
  if (!result.ok) {
    ui.notifications.warn(
      loc`${combatant.name} had ${result.left} half action(s) left this turn; this took more. Check with the GC.`
    );
    // The turn is recorded as used up, so anything further this turn warns as well.
    if (result.left > 0)
      await combatant.update({
        "flags.spycraft2.actions": { ...actionsOf(combatant), used: actionsOf(combatant).used + result.left }
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
export const costsAction = (kind, handler) =>
  async function (event, target) {
    const result = await handler.call(this, event, target);
    const spent = typeof kind === "function" ? kind(result) : kind;
    if (result && spent && (await markActionSpent(this.actor, spent))) this.render?.();
    return result;
  };

/** Apply every combatant's recorded modifiers for the round that just ended. */
export async function applyEndOfRound(combat, endedRound) {
  const lines = [];
  for (const combatant of combat.combatants) {
    const state = fluid(combatant);
    if (state.round !== endedRound || !Number.isFinite(combatant.initiative)) continue;
    const result = endOfRound(combatant.initiative, state.modifiers);
    const pieces = result.rows.map(row => `${row.label} ${row.amount > 0 ? "+" : ""}${row.amount}`);
    if (!result.delta && !result.reeling && !result.mustPress) {
      if (state.modifiers.length || state.delayed || state.pressed)
        await combatant.update({ "flags.spycraft2.fluid": { round: null, modifiers: [], delayed: 0, pressed: false } });
      continue;
    }
    await combatant.update({
      initiative: result.count,
      "flags.spycraft2.fluid": { round: null, modifiers: [], delayed: 0, pressed: false },
      "flags.spycraft2.mustPress": result.mustPress
    });
    if (result.reeling) {
      await condition(combatant.actor, "reeling", "Reeling");
      await condition(combatant.actor, "flat-footed", "Flat-footed");
    }
    lines.push(
      `${esc(combatant.name)}: ${combatant.initiative}${pieces.length ? ` (${esc(pieces.join(", "))}${result.capped ? loc`; limited to ±10` : ""})` : ""}${result.reeling ? ` — <b>${loc`reeling and flat-footed`}</b>${loc`: Count was 0 or less, +20`}` : ""}${result.mustPress ? ` — <b>${loc`must Press`}</b> ${loc`as the first action (Count 50+)`}` : ""}`
    );
  }
  if (lines.length) await say(`<b>${loc`Fluid initiative — end of round ${endedRound}`}</b><br>${lines.join("<br>")}`);
  return lines;
}

/** Break remaining ties (same Count and bonus) with a d20 roll-off stored on the combatants. */
export async function rollTiebreaks(combat = game.combat) {
  const groups = new Map();
  for (const combatant of combat?.combatants ?? []) {
    if (!Number.isFinite(combatant.initiative)) continue;
    const key = `${combatant.initiative}|${bonusOf(combatant)}`;
    groups.set(key, [...(groups.get(key) ?? []), combatant]);
  }
  let rolled = 0;
  for (const tied of groups.values()) {
    if (tied.length < 2 || tied.every(combatant => Number.isFinite(combatant.flags?.spycraft2?.tiebreak))) continue;
    const seen = new Set();
    for (const combatant of tied) {
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
  for (const members of groups.values()) {
    const roll = await new Roll("1d20").evaluate();
    for (const combatant of members) await combatant.update({ initiative: roll.total + bonusOf(combatant) });
    lines.push(`${esc(members.map(member => member.name).join(", "))}: d20 ${roll.total}`);
  }
  if (left.length)
    lines.push(
      loc`Not rolled, no player owns them: ${esc(left.map(member => member.name).join(", "))}. Roll from the sheet or the tracker.`
    );
  if (lines.length) await say(`<b>${loc`Group Initiative`}</b><br>${lines.join("<br>")}`, { whisper: true });
  else ui.notifications?.info(loc`Every NPC in this fight already has an Initiative Count.`);
  return lines.length - (left.length ? 1 : 0);
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
  await combat.update({
    "flags.spycraft2.surprise": result.occurs ? { winners: result.winners, round: combat.round } : null
  });
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
export async function keepActingTurn(combat, { handOver = false } = {}) {
  if (!combat?.started || settling.has(combat.id)) return null;
  combat.setupTurns?.();
  const expected = actingIn.get(combat.id);
  const index = expected ? (combat.turns?.findIndex?.(entry => entry.id === expected) ?? -1) : -1;
  if (handOver || index < 0) {
    actingIn.set(combat.id, combat.combatant?.id ?? null);
    return null;
  }
  if (index === combat.turn) return null;
  return combat.update({ turn: index }, { spycraft2KeepTurn: true, turnEvents: false });
}

export function installFluidInitiativeHooks() {
  // Everyone starts a fight flat-footed unless he joins it deliberately after it begins (p.323).
  // The start is read from the combat's own update, which every client sees: the lead GM marks the fight whoever
  // pressed Begin combat.
  Hooks.on("updateCombat", (combat, changed, options) => {
    if (changed?.round !== 1 || options?.direction < 0) return;
    if (!isLeadGM() || !setting("startFlatFooted")) return;
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
  Hooks.on("deleteCombat", combat => actingIn.delete(combat.id));
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
    await startPass;
    if (Object.hasOwn(changed, "round")) {
      await null;
      await fluidRoundSettled();
    }
    const combatant = combat.combatant,
      actor = combatant?.actor;
    // A readied action that never went off is lost when the character's next turn comes round.
    const readied = combatant?.flags?.spycraft2?.readied;
    if (readied && readied.round !== combat.round) await combatant.update({ "flags.spycraft2.readied": null });
    if (!actor?.statuses?.has?.("flat-footed")) return;
    const facts = { round: combat.round, surprise: combat.flags?.spycraft2?.surprise ?? null };
    if (!flatFootedEndsOnTurn(facts, { playerSide: actor.hasPlayerOwner === true })) return;
    try {
      await setConditionStatus(actor, "flat-footed", false, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
    } catch {
      /* supplied by another source: left for the GC */
    }
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
      await rollTiebreaks(combat);
      // The new round starts from the top of the revised order, not from whoever led the last one.
      if (changedCounts.length) {
        combat.setupTurns?.();
        if (combat.turn !== 0) await combat.update({ turn: 0 });
      }
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
      keepActingTurn(combatant.parent, { handOver: options?.spycraft2HandOver === true }).catch(() => {});
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
      badge.textContent = ` (${notes.join(", ")})`;
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
    const input = await formDialog({
      title: loc`Delay — ${combatant.name}`,
      ok: loc`Delay`,
      fields: [
        raw(
          `<label>${loc`Counts to step down (now at ${combatant.initiative ?? "—"})`} <input type="number" name="times" min="1" value="1" /></label>`
        )
      ]
    });
    if (!input) return null;
    times = Number(input.times) || 1;
  }
  return quickFluidEvent(combatant, "delay", { times }, loc`Delay`);
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
  // One write for the half action and the readied mark, so a second press finds the mark already there.
  await combatant.update({
    "flags.spycraft2.actions": spend.state,
    "flags.spycraft2.readied": { round: combat.round }
  });
  await say(
    loc`${esc(combatant.name)} readies an action. When its trigger happens, use Readied action triggered on its tracker row.`,
    gcOnly(combatant)
  );
  return true;
}

/** The readied action goes off now: the combatant drops to the acting combatant's Count if that is lower. */
export async function triggerReadied(combatant) {
  if (!combatant) return null;
  const combat = combatant.parent,
    at = combat?.combatant?.initiative ?? combatant.initiative;
  const acted = hasActed(combatant);
  const result = await quickFluidEvent(combatant, "ready", { triggerCount: at }, loc`Readied action triggered`);
  if (!result) return result;
  // The readied action was this round's action. If the new Count puts the combatant ahead of the turn pointer
  // again, its turn is marked as used up so the tracker and console show nothing left to do.
  const again = acted && !hasActed(combatant) && combat.combatant?.id !== combatant.id;
  await combatant.update({
    "flags.spycraft2.readied": null,
    ...(again
      ? {
          "flags.spycraft2.actions": {
            round: combat.round,
            used: HALF_ACTIONS_PER_TURN + Math.max(0, extraHalfActions(combatant))
          }
        }
      : {})
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
    entry(loc`Spend a half action`, "fa-circle-half-stroke", mine, c => spendTurnAction(c, "half")),
    entry(loc`Spend a full action`, "fa-circle", mine, c => spendTurnAction(c, "full")),
    entry(loc`Give back this round's actions`, "fa-rotate-left", mine, c => spendTurnAction(c, "reset")),
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
    loc`Look up`
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
