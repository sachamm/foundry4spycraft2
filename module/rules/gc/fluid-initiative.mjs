/**
 * Fluid initiative (pp.323–324, Table 5.2) and the dramatic-scene Initiative rule (p.424).
 * Most modifiers are recorded during the round and applied together when it ends, limited to
 * ±10 per round. Delay, Press and a triggered Ready change the Count at once.
 */
import { GC_DATA } from "../gc-tables.mjs";

const F = GC_DATA.core.fluidInitiative;
const D = GC_DATA.core.dramaticScene;
export const FLUID_EVENTS = F.events;
const eventById = id => F.events.find(event => event.id === id);
const count = value => Number.isSafeInteger(value);

/**
 * Turn one declared event into a recorded modifier.
 *  times  – how many times it applies (attacks, dice spent, points of damage, Counts delayed…)
 *  amount – required for variable events: Regroup's Int bonus is added to 5; Diversion's rolled 1d4/2d4
 */
export function fluidModifier(id, { times = 1, amount = null, weapon = "", intBonus = 0 } = {}) {
  const event = eventById(id);
  if (!event) throw new Error("Unknown fluid initiative event.");
  if (!count(times) || times < 1) throw new Error("Enter how many times the event applies.");
  let value;
  if (event.variable === "regroup") value = 5 + Math.max(0, count(intBonus) ? intBonus : 0);
  else if (event.variable === "diversion") {
    if (!count(amount) || amount < 1 || amount > 8) throw new Error("Enter the rolled 1d4 (or 2d4) Count loss.");
    value = -amount;
  } else if (event.setCount) throw new Error("A triggered Ready action sets the Count directly.");
  else value = event.amount * (event.oncePerRound ? 1 : times);
  return {
    id,
    label: event.label,
    amount: value,
    uncapped: !!event.uncapped,
    oncePerRound: !!event.oncePerRound,
    immediate: !!event.immediate,
    ...(id === "unproficient" && weapon ? { weapon } : {})
  };
}

/** Drop repeats the table forbids: once-per-round conditions, one unproficient penalty per weapon, one injury modifier per injury. */
export function addFluidModifier(list, modifier) {
  const current = [...(list ?? [])];
  if (modifier.oncePerRound && current.some(entry => entry.id === modifier.id))
    return { list: current, added: false, reason: `${modifier.label} applies only once per round.` };
  if (
    modifier.id === "unproficient" &&
    current.some(entry => entry.id === "unproficient" && (entry.weapon ?? "") === (modifier.weapon ?? ""))
  )
    return { list: current, added: false, reason: "That weapon’s proficiency penalty already applied this round." };
  current.push(modifier);
  return { list: current, added: true };
}

/** End of round: sum the recorded modifiers, cap at ±10 (Press is outside the cap), then apply the 0 and 50 thresholds. */
export function endOfRound(countNow, modifiers = [], { alreadyApplied = 0 } = {}) {
  if (!Number.isFinite(countNow))
    return { count: countNow, delta: 0, capped: false, reeling: false, mustPress: false, rows: [] };
  const pending = modifiers.filter(entry => !entry.immediate);
  const raw = pending.filter(entry => !entry.uncapped).reduce((sum, entry) => sum + entry.amount, 0);
  // Immediate capped changes this round (Delay) count toward the same ±10 limit.
  const room = { up: F.roundCap - Math.max(0, alreadyApplied), down: -F.roundCap - Math.min(0, alreadyApplied) };
  const capped = Math.max(room.down, Math.min(room.up, raw));
  const uncapped = pending.filter(entry => entry.uncapped).reduce((sum, entry) => sum + entry.amount, 0);
  const result = thresholds(countNow + capped + uncapped);
  return { ...result, delta: capped + uncapped, raw, capped: capped !== raw, rows: pending };
}

/** p.324: at 0 or less the character reels, becomes flat-footed and gains 20 (or goes to 1 if higher); at 50+ he must Press. */
export function thresholds(value) {
  let next = value,
    reeling = false;
  if (next <= F.reelAt) {
    reeling = true;
    next = Math.max(next + F.reelRecovery, F.reelMinimum);
  }
  return { count: next, reeling, flatFooted: reeling, mustPress: next >= F.pressAt };
}

/** Delay: lower the Count by 1 per use, at most Initiative bonus + 10 times a round, never below 5. */
export function delay(countNow, steps, { initiativeBonus = 0, usedThisRound = 0 } = {}) {
  if (!count(steps) || steps < 1) throw new Error("Enter how many Counts to delay.");
  const limit = Math.max(0, initiativeBonus + 10 - usedThisRound);
  if (steps > limit) throw new Error(`Only ${limit} more Delay action(s) are available this round.`);
  if (countNow - steps < F.delayFloor) throw new Error(`Delay cannot lower the Count below ${F.delayFloor}.`);
  return { count: countNow - steps, used: usedThisRound + steps };
}

/** Press: Count 25+, once per round, −20 for one extra half action now. */
export function press(countNow, { pressedThisRound = false } = {}) {
  if (pressedThisRound) throw new Error("A character may Press only once per round.");
  if (countNow < F.pressMinimumCount)
    throw new Error(`Press needs an Initiative Count of ${F.pressMinimumCount} or higher.`);
  return { count: countNow - F.pressCost };
}

/** Ready: when the trigger happens at a lower Count, the character drops to it; otherwise unchanged. */
export function readyTrigger(countNow, triggerCount) {
  if (!Number.isFinite(triggerCount)) throw new Error("Enter the Count at which the trigger occurred.");
  return { count: Math.min(countNow, triggerCount) };
}

/** Order of action: Count, then Initiative bonus; remaining ties need a d20 roll-off (p.323). */
export function compareCombatants(a, b) {
  const ca = Number.isFinite(a.count) ? a.count : -Infinity,
    cb = Number.isFinite(b.count) ? b.count : -Infinity;
  if (cb !== ca) return cb - ca;
  const ba = Number.isFinite(a.bonus) ? a.bonus : -Infinity,
    bb = Number.isFinite(b.bonus) ? b.bonus : -Infinity;
  if (bb !== ba) return bb - ba;
  const ta = Number.isFinite(a.tiebreak) ? a.tiebreak : 0,
    tb = Number.isFinite(b.tiebreak) ? b.tiebreak : 0;
  if (tb !== ta) return tb - ta;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/** Dramatic scene: opponents' starting or current Initiative Count is doubled, to at most 50 (p.424). */
export function dramaticInitiative(countNow) {
  if (!Number.isFinite(countNow)) return countNow;
  return Math.min(D.initiativeMaximum, Math.max(countNow, countNow * D.initiativeMultiplier));
}

/** Surprise round (p.323): only members of the winning group act, with one free, half or full action that cannot be split. */
export function surpriseRound({ groups, aware = "none", actingGroup = null }) {
  if (aware === "all")
    return { occurs: false, winners: [], reason: "All groups are aware of each other: no surprise round." };
  const valid = (groups ?? []).filter(group => group?.id && Number.isFinite(group.result));
  if (valid.length < 2) throw new Error("Enter an opposed Blend/Stealth or Sneak/Hide result for at least two groups.");
  const best = Math.max(...valid.map(group => group.result)),
    top = valid.filter(group => group.result === best);
  if (top.length > 1)
    return {
      occurs: false,
      winners: [],
      tie: top.map(group => group.id),
      reason: "The opposed check is tied: break the tie (p.91) and enter the results again."
    };
  if (aware === "some") {
    if (!actingGroup) throw new Error("Choose the group that is trying to conceal itself.");
    return top[0].id === actingGroup
      ? { occurs: true, winners: [actingGroup] }
      : { occurs: false, winners: [], reason: "The acting group lost the opposed check: no surprise round." };
  }
  return { occurs: true, winners: [top[0].id] };
}
