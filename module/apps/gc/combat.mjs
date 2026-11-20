/**
 * Combat tracker support for Spycraft's order of combat (pp.323–324):
 * flat-footed at the start, tie-breaking by Initiative bonus, fluid initiative at the end of each
 * round, Delay / Press / Ready, group initiative for NPCs and surprise rounds.
 */
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
import { loc } from "../../i18n.mjs";
import { HALF_ACTIONS_PER_TURN, actionBudget, resetActions, spendAction } from "../../rules/action-budget.mjs";

const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const ask = (title, content) =>
  foundry.applications.api.DialogV2.input({
    window: { title },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${content}</div>`
  });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const setting = key => {
  try {
    return game.settings.get("spycraft2", key);
  } catch {
    return false;
  }
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
    console.warn(loc`Spycraft 2.0 | ${label} not applied to ${actor.name}`, error);
  }
}

/** Order combatants by Count, then Initiative bonus, then a stored roll-off (p.323). */
export function fluidCombatClass(Base) {
  return class extends Base {
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
    await combatant.update({ initiative: result.count, "flags.spycraft2.fluid": { ...state, delayed: result.used } });
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

/** Dialog: choose a combatant and an event. */
export async function fluidEventDialog(combat = game.combat, preset = null) {
  if (!combat?.started) return ui.notifications.warn(loc`Start the combat first.`);
  const mine = combat.combatants.filter(combatant => combatant.isOwner);
  if (!mine.length) return ui.notifications.warn(loc`You control no combatant in this fight.`);
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
    <label>${loc`Times it applies (attacks, dice spent, damage points, Counts delayed)`} <input type="number" name="times" min="1" value="1" /></label>
    <label>${loc`Rolled Count loss (Diversion only)`} <input type="number" name="amount" min="1" max="8" /></label>
    <label>${loc`Weapon (proficiency penalty only)`} <input name="weapon" /></label>
    <label>${loc`Count at which the Ready trigger occurred`} <input type="number" name="triggerCount" value="${combat.combatant?.initiative ?? 0}" /></label>`
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
    return ui.notifications.warn(error.message);
  }
}

/** The actions a combatant has spent on the current turn. */
const actionsOf = combatant =>
  actionBudget(combatant.flags?.spycraft2?.actions, {
    round: combatant.parent?.round ?? 0,
    turn: combatant.parent?.turn ?? 0
  });

/** Spend a half or full action from a combatant's turn, or give the turn's actions back with kind "reset". */
export async function spendTurnAction(combatant, kind) {
  if (!combatant) return null;
  const state = actionsOf(combatant);
  if (kind === "reset") return combatant.update({ "flags.spycraft2.actions": resetActions(state) });
  const result = spendAction(state, kind);
  if (!result.ok) {
    ui.notifications.warn(loc`${combatant.name} has ${result.left} half action(s) left this turn.`);
    return null;
  }
  await combatant.update({ "flags.spycraft2.actions": result.state });
  return result;
}

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
  if (!combat) return ui.notifications.warn(loc`There is no active combat.`);
  const pending = combat.combatants.filter(
    combatant => !combatant.hasPlayerOwner && combatant.initiative === null && combatant.actor
  );
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
  if (lines.length) await say(`<b>${loc`Group Initiative`}</b><br>${lines.join("<br>")}`, { whisper: true });
  return lines.length;
}

/** Surprise round (p.323): enter each group's opposed result; winners are flagged and announced. */
export async function surpriseRoundDialog(combat = game.combat) {
  if (!game.user.isGM) return null;
  if (!combat) return ui.notifications.warn(loc`Create the combat first.`);
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
    )}</select></label>`
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
    return ui.notifications.warn(error.message);
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

export function installFluidInitiativeHooks() {
  // Everyone starts a fight flat-footed unless he joins it deliberately after it begins (p.323).
  Hooks.on("combatStart", async combat => {
    if (!isLeadGM() || !setting("startFlatFooted")) return;
    for (const combatant of combat.combatants) await condition(combatant.actor, "flat-footed", "Flat-footed");
  });
  Hooks.on("updateCombat", async (combat, changed, options) => {
    if (!isLeadGM() || !Object.hasOwn(changed, "round") || !setting("fluidInitiative")) return;
    const previous = combat.previous?.round ?? changed.round - 1;
    if (!(options?.direction > 0 || changed.round > previous) || previous < 1) return;
    let settle;
    endOfRoundPass = new Promise(resolve => (settle = resolve));
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
      settle();
    }
  });
  Hooks.on("updateCombatant", (combatant, changed) => {
    if (Object.hasOwn(changed, "initiative") && isLeadGM()) rollTiebreaks(combatant.parent).catch(() => {});
  });
  // Show what is left of the acting combatant's turn beside its name.
  Hooks.on("renderCombatTracker", (_app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const combatant = game.combat?.combatant;
    const row = combatant && root?.querySelector?.(`[data-combatant-id="${combatant.id}"]`);
    const name = row?.querySelector?.(".token-name .name, .token-name");
    if (!name || name.querySelector(".spycraft2-actions-left")) return;
    const left = HALF_ACTIONS_PER_TURN - actionsOf(combatant).used;
    const badge = document.createElement("span");
    badge.className = "spycraft2-actions-left";
    badge.textContent = ` (${loc`${left} half action(s) left`})`;
    name.append(badge);
  });
  // Combat tracker entries: record an event for one combatant.
  Hooks.on("getCombatantContextOptions", (_app, entries) => {
    const picked = li => game.combat?.combatants.get((li instanceof HTMLElement ? li : li?.[0])?.dataset?.combatantId);
    for (const [kind, name, icon] of [
      ["half", loc`Spend a half action`, "fa-circle-half-stroke"],
      ["full", loc`Spend a full action`, "fa-circle"],
      ["reset", loc`Give back this turn's actions`, "fa-rotate-left"]
    ])
      entries.push({
        name,
        icon: `<i class="fa-solid ${icon}"></i>`,
        condition: li => picked(li)?.isOwner === true,
        callback: li => spendTurnAction(picked(li), kind)
      });
    entries.push({
      name: loc`Fluid initiative event`,
      icon: '<i class="fa-solid fa-arrows-up-down"></i>',
      callback: li => {
        const el = li instanceof HTMLElement ? li : li?.[0];
        fluidEventDialog(game.combat, game.combat?.combatants.get(el?.dataset?.combatantId));
      }
    });
  });
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
    <label>${loc`Location (encounter)`} <select name="location">${options(Object.keys(ENCOUNTER_DISTANCES).map(key => [key, ENCOUNTER_LABELS[key]]))}</select></label>
    <label>${loc`Range increment to the target (deviation)`} <input type="number" name="increment" min="1" max="10" value="1" /></label>
    <label>${loc`Rounds since release (gas)`} <input type="number" name="rounds" min="0" value="0" /></label>
    <label>${loc`Wind (gas)`} <select name="wind">${options([
      ["none", loc`Still`],
      ["light", loc`Light`],
      ["moderate", loc`Moderate`],
      ["strong", loc`Strong or severe`]
    ])}</select></label>
    <label>${loc`Surface`} <select name="surface">${options(Object.keys(SURFACES).map(key => [key, SURFACE_LABELS[key]]))}</select></label>
    <label>${loc`Speed for the move (surface)`} <input type="number" name="speed" min="0" value="30" /></label>`
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
