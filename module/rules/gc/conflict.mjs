/**
 * Dramatic Conflicts (pp.363–388): Lead, secret Strategies, an opposed check and Advantages.
 * The Predator wins at Lead 0 or less, the Prey at Lead 10 or more.
 * This module tracks the round structure and the numbers; each Advantage's narrative effect is
 * reported for the GC to apply.
 */
import { GC_DATA } from "../gc-tables.mjs";

const C = GC_DATA.conflicts;
export const CONFLICT_TYPES = C.types;
const SIDES = ["predator", "prey"];
const other = side => (side === "predator" ? "prey" : "predator");
const whole = value => Number.isSafeInteger(value);
const type = id => {
  const found = C.types[id];
  if (!found) throw new Error("Unknown Dramatic Conflict type.");
  return found;
};

/** Starting Lead from the type's printed rule: the listed default unless the GC picks one of its conditional values. */
export function startConflict(typeId, { lead = null, predator = {}, prey = {}, name = "" } = {}) {
  const rules = type(typeId);
  const start = lead ?? rules.startingLead?.default;
  if (start === null || start === undefined)
    throw new Error(`Enter the starting Lead: ${rules.startingLead?.summary ?? "see the Conflict description"}`);
  if (!whole(start) || start <= C.leadMin || start >= C.leadMax)
    throw new Error(`The starting Lead must be from ${C.leadMin + 1} to ${C.leadMax - 1}.`);
  const side = data => ({
    name: data.name ?? "",
    actorUuid: data.actorUuid ?? null,
    ratings: { ...(data.ratings ?? {}) },
    strategy: null,
    result: null,
    critical: null
  });
  return {
    version: 1,
    type: typeId,
    name: name || rules.name,
    round: 1,
    step: "strategies",
    lead: start,
    predator: side(predator),
    prey: side(prey),
    winner: null,
    history: [],
    carry: {}
  };
}

/** Strategies a side may choose now. Requirements the tracker cannot verify are returned as `other` for the GC. */
export function availableStrategies(conflict, side) {
  if (!SIDES.includes(side)) throw new Error("Choose Predator or Prey.");
  const rules = type(conflict.type),
    ratings = conflict[side].ratings ?? {};
  return rules.strategies
    .filter(strategy => strategy.side === "general" || strategy.side === side)
    .map(strategy => {
      const reasons = [];
      if (strategy.leadMin !== null && conflict.lead < strategy.leadMin) reasons.push(`Lead ${strategy.leadMin}+`);
      if (strategy.leadMax !== null && conflict.lead > strategy.leadMax)
        reasons.push(`Lead ${strategy.leadMax} or less`);
      const needs = strategy.ratings ?? [];
      if (needs.length) {
        const met = needs.map(need => (ratings[need.rating] ?? 0) >= need.min);
        const ok = strategy.ratingsMode === "all" ? met.every(Boolean) : met.some(Boolean);
        if (!ok)
          reasons.push(
            needs.map(need => `${need.rating} ${need.min}+`).join(strategy.ratingsMode === "all" ? " and " : " or ")
          );
      }
      return { ...strategy, available: reasons.length === 0, reasons, confirm: strategy.other || "" };
    });
}

/** Step 1: each side secretly commits one Strategy; there is no backing out once chosen. */
export function chooseStrategy(conflict, side, strategyId, { confirmOther = false } = {}) {
  if (conflict.winner) throw new Error("This conflict is over.");
  if (conflict.step !== "strategies") throw new Error("Strategies are chosen at the start of the Conflict round.");
  const choice = availableStrategies(conflict, side).find(strategy => strategy.id === strategyId);
  if (!choice) throw new Error("That Strategy is not open to this side.");
  if (!choice.available) throw new Error(`${choice.name} requires ${choice.reasons.join("; ")}.`);
  if (choice.confirm && !confirmOther) throw new Error(`${choice.name}: the GC must confirm “${choice.confirm}”.`);
  if (conflict[side].strategy) throw new Error("A chosen Strategy cannot be changed.");
  const next = structuredClone(conflict);
  next[side].strategy = strategyId;
  if (SIDES.every(key => next[key].strategy)) next.step = "check";
  return next;
}

/** The Strategy's printed modifier to that side's opposed skill check. */
export function strategyModifier(conflict, side) {
  const strategy = type(conflict.type).strategies.find(entry => entry.id === conflict[side].strategy);
  return strategy?.modifier ?? 0;
}

/**
 * Step 2: opposed check. Results are final totals including the Strategy modifier.
 * The winner takes 1 Advantage plus 1 per full 4 points of margin. A winner's critical success
 * and a loser's critical failure each move the Lead 1 in the winner's favour.
 * A tie is broken as any opposed check (p.91): pass `tieWinner`.
 */
export function resolveCheck(conflict, { predator, prey, tieWinner = null }) {
  if (conflict.step !== "check") throw new Error("Both sides must choose a Strategy first.");
  for (const [side, entry] of Object.entries({ predator, prey }))
    if (!Number.isFinite(entry?.result)) throw new Error(`Enter the ${side}'s check result.`);
  let winner = predator.result > prey.result ? "predator" : prey.result > predator.result ? "prey" : tieWinner;
  if (!SIDES.includes(winner)) throw new Error("The opposed check is tied: break the tie (p.91) and name the winner.");
  const loser = other(winner),
    results = { predator, prey };
  const margin = Math.abs(predator.result - prey.result);
  const next = structuredClone(conflict);
  for (const side of SIDES) {
    next[side].result = results[side].result;
    next[side].critical = results[side].critical ?? null;
  }
  let criticalShift = 0;
  if (results[winner].critical === "success") criticalShift += 1;
  if (results[loser].critical === "failure") criticalShift += 1;
  next.lead = moveLead(next.lead, winner, criticalShift);
  next.pending = { winner, margin, advantages: 1 + Math.floor(margin / 4), criticalShift, chosen: [] };
  next.step = "advantages";
  return finish(next);
}

const moveLead = (lead, winner, points) => lead + (winner === "prey" ? points : -points);

/** Advantages the winner may pick: those listed with the winner's Strategy ("*" opens every one except Victory). */
export function advantageOptions(conflict) {
  if (!conflict.pending) return [];
  const rules = type(conflict.type),
    strategy = rules.strategies.find(entry => entry.id === conflict[conflict.pending.winner].strategy);
  const names = strategy?.advantages ?? [];
  return rules.advantages.filter(advantage =>
    names.includes("*") ? !advantage.victory : names.includes(advantage.name)
  );
}

/**
 * Step 3: the winner spends his Advantage picks. `picks` is a list of advantage ids (repeats allowed).
 * `leadShift` overrides the computed Lead change when an Advantage's repeat rule needs the GC's count.
 */
export function chooseAdvantages(conflict, picks, { leadShift = null } = {}) {
  if (conflict.step !== "advantages" || !conflict.pending) throw new Error("Resolve the opposed check first.");
  const options = advantageOptions(conflict),
    { winner, advantages: allowed } = conflict.pending;
  if (!Array.isArray(picks) || picks.length < 1 || picks.length > allowed)
    throw new Error(`Choose 1 to ${allowed} Advantage(s).`);
  const chosen = picks.map(id => {
    const found = options.find(option => option.id === id);
    if (!found) throw new Error("That Advantage is not listed with the winning Strategy.");
    return found;
  });
  const counts = {};
  for (const advantage of chosen) counts[advantage.id] = (counts[advantage.id] ?? 0) + 1;
  // The Lead Advantage moves the Lead once, plus once more per `repeatEvery` further picks in the same round.
  const computed = Object.entries(counts).reduce((sum, [id, times]) => {
    const advantage = options.find(option => option.id === id),
      base = advantage.leadShift ?? 0;
    return (
      sum + (base ? base * (1 + (advantage.repeatEvery ? Math.floor((times - 1) / advantage.repeatEvery) : 0)) : 0)
    );
  }, 0);
  const shift = leadShift === null ? computed : leadShift;
  if (!whole(shift) || shift < 0) throw new Error("Enter the Lead change as a whole number.");
  let next = structuredClone(conflict);
  next.lead = moveLead(next.lead, winner, shift);
  const victory = chosen.some(advantage => advantage.victory);
  const swap = chosen.find(advantage => advantage.swapRoles);
  if (swap && !victory) {
    // Predator and Prey trade places, then the Lead changes by the printed flat amount.
    [next.predator, next.prey] = [next.prey, next.predator];
    next.lead += swap.absoluteLeadChange ?? 0;
    next.swapped = (next.swapped ?? 0) + 1;
  }
  const halted = chosen.some(advantage => advantage.endsConflictNoWinner);
  next.history.push({
    round: next.round,
    lead: next.lead,
    winner,
    margin: next.pending.margin,
    criticalShift: next.pending.criticalShift,
    strategies: { predator: next.predator.strategy, prey: next.prey.strategy },
    results: { predator: next.predator.result, prey: next.prey.result },
    advantages: chosen.map(advantage => advantage.id),
    leadShift: shift
  });
  next.pending = null;
  next.step = "outside";
  next.history.at(-1).notes = chosen
    .filter(advantage => !advantage.leadShift && !advantage.victory)
    .map(
      advantage =>
        `${advantage.name}${counts[advantage.id] > 1 ? ` × ${counts[advantage.id]}` : ""}: ${advantage.summary}${counts[advantage.id] > 1 && advantage.repeat ? ` ${advantage.repeat}` : ""}`
    );
  if (victory) {
    next.winner = winner;
    next.step = "ended";
    return next;
  }
  if (halted) {
    next.winner = "none";
    next.step = "ended";
    return next;
  }
  return finish(next);
}

function finish(conflict) {
  if (conflict.lead <= C.leadMin) {
    conflict.winner = "predator";
    conflict.step = "ended";
  } else if (conflict.lead >= C.leadMax) {
    conflict.winner = "prey";
    conflict.step = "ended";
  }
  return conflict;
}

/** Step 4 done: begin the next Conflict round with fresh Strategies. */
export function nextRound(conflict) {
  if (conflict.winner) throw new Error("This conflict is over.");
  if (conflict.step !== "outside") throw new Error("Finish the current Conflict round first.");
  const next = structuredClone(conflict);
  next.round += 1;
  next.step = "strategies";
  for (const side of SIDES) Object.assign(next[side], { strategy: null, result: null, critical: null });
  return next;
}

/** A side may concede at any time: the opponent applies its Victory result. */
export function concede(conflict, side) {
  if (!SIDES.includes(side)) throw new Error("Choose Predator or Prey.");
  if (conflict.winner) throw new Error("This conflict is over.");
  return { ...structuredClone(conflict), winner: other(side), step: "ended", conceded: side };
}

/** GC correction or an outside effect that moves the Lead directly. */
export function adjustLead(conflict, lead) {
  if (!whole(lead)) throw new Error("Enter the Lead as a whole number.");
  if (conflict.winner) throw new Error("This conflict is over.");
  return finish({ ...structuredClone(conflict), lead });
}

export function conflictSummary(conflict) {
  const rules = type(conflict.type);
  return {
    type: rules.name,
    round: conflict.round,
    step: conflict.step,
    lead: conflict.lead,
    winner: conflict.winner,
    result: conflict.winner ? (rules.victory?.[conflict.winner] ?? "") : "",
    roundTime: rules.roundTime,
    outsideActions: rules.outsideActions ?? ""
  };
}
