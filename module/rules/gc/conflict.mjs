/**
 * Dramatic Conflicts (pp.363–388): Lead, secret Strategies, an opposed check and Advantages.
 * The Predator wins at Lead 0 or less, the Prey at Lead 10 or more.
 * This module tracks the round structure and the numbers; each Advantage's narrative effect is
 * reported for the GC to apply.
 */
import { GC_DATA } from "../gc-tables.mjs";
import { loc } from "../../i18n.mjs";

const C = GC_DATA.conflicts;
export const CONFLICT_TYPES = C.types;
const SIDES = ["predator", "prey"];
const other = side => (side === "predator" ? "prey" : "predator");
const whole = value => Number.isSafeInteger(value);
const type = id => {
  const found = C.types[id];
  if (!found) throw new Error(loc`Unknown Dramatic Conflict type.`);
  return found;
};

/**
 * Chase feats the tracker carries out (pp.192–193). Each side records which of them its participant has.
 * - Jackrabbit Start (Prey) / Relentless Pursuit (Predator), chase or manhunt: starting Lead ±2 in their favour, and
 *   every Strategy offers them the Lead Advantage.
 * - Daredevil, chase: Strategies are chosen as if Acceleration and Turning were 2 higher, and Stunt is open.
 * - Defensive Driving (Prey Strategies) / Offensive Driving (Predator Strategies), chase: the Strategy's penalty is
 *   halved, rounded down. Each also has a once-per-chase use, recorded with `useConflictFeat`.
 * - Photo Finish, chase: the side lowers its own Acceleration and Turning by 2, and every other participant's by 2.
 * - Breaking Points (Predator) / Hold Out (Prey), interrogation or brainwashing (pp.208–209): starting Lead ±1 in
 *   the side's favour; any Strategy of the side's own list regardless of its requirements; and, for +1 error range on
 *   the side's check, the round's duration is halved (Breaking Points) or doubled (Hold Out), via `declarePace`.
 */
export const CONFLICT_FEATS = Object.freeze([
  "Jackrabbit Start",
  "Relentless Pursuit",
  "Daredevil",
  "Defensive Driving",
  "Offensive Driving",
  "Photo Finish",
  "Breaking Points",
  "Hold Out"
]);
const has = (conflict, side, feat) => (conflict[side]?.feats ?? []).includes(feat);
const LEAD_FEATS = { prey: "Jackrabbit Start", predator: "Relentless Pursuit" };
const leadFeat = (conflict, side) =>
  ["chase", "manhunt"].includes(conflict.type) && has(conflict, side, LEAD_FEATS[side]);
const MIND_FEATS = { predator: "Breaking Points", prey: "Hold Out" };
const mindFeat = (conflict, side) =>
  ["interrogation", "brainwashing"].includes(conflict.type) && has(conflict, side, MIND_FEATS[side]);

/** A side's ratings with Photo Finish reductions applied. */
export function conflictRatings(conflict, side) {
  const ratings = { ...(conflict[side]?.ratings ?? {}) },
    drop = 2 * (conflict.photoFinish ?? 0);
  if (drop)
    for (const key of ["Acceleration", "Turning"])
      if (key in ratings) ratings[key] = Math.max(0, (ratings[key] ?? 0) - drop);
  return ratings;
}

/** Starting Lead from the type's printed rule: the listed default unless the GC picks one of its conditional values. */
export function startConflict(typeId, { lead = null, predator = {}, prey = {}, name = "" } = {}) {
  const rules = type(typeId);
  const start = lead ?? rules.startingLead?.default;
  if (start === null || start === undefined)
    throw new Error(loc`Enter the starting Lead: ${rules.startingLead?.summary ?? loc`see the Conflict description`}`);
  if (!whole(start) || start <= C.leadMin || start >= C.leadMax)
    throw new Error(loc`The starting Lead must be from ${C.leadMin + 1} to ${C.leadMax - 1}.`);
  const side = data => ({
    name: data.name ?? "",
    actorUuid: data.actorUuid ?? null,
    ratings: { ...(data.ratings ?? {}) },
    feats: (data.feats ?? []).filter(feat => CONFLICT_FEATS.includes(feat)),
    strategy: null,
    result: null,
    critical: null
  });
  const conflict = {
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
  // Jackrabbit Start raises the starting Lead by 2, Relentless Pursuit lowers it by 2; it stays inside the track.
  const shift =
    (leadFeat(conflict, "prey") ? 2 : 0) -
    (leadFeat(conflict, "predator") ? 2 : 0) +
    (mindFeat(conflict, "prey") ? 1 : 0) -
    (mindFeat(conflict, "predator") ? 1 : 0);
  if (shift) {
    conflict.lead = Math.min(C.leadMax - 1, Math.max(C.leadMin + 1, start + shift));
    conflict.startingLeadFeats = { before: start, shift };
  }
  return conflict;
}

/** Strategies a side may choose now. Requirements the tracker cannot verify are returned as `other` for the GC. */
export function availableStrategies(conflict, side) {
  if (!SIDES.includes(side)) throw new Error(loc`Choose Predator or Prey.`);
  const rules = type(conflict.type),
    daredevil = conflict.type === "chase" && has(conflict, side, "Daredevil"),
    ratings = conflictRatings(conflict, side);
  if (daredevil) for (const key of ["Acceleration", "Turning"]) ratings[key] = (ratings[key] ?? 0) + 2;
  return rules.strategies
    .filter(strategy => strategy.side === "general" || strategy.side === side)
    .map(strategy => {
      const reasons = [];
      if (strategy.leadMin !== null && conflict.lead < strategy.leadMin) reasons.push(loc`Lead ${strategy.leadMin}+`);
      if (strategy.leadMax !== null && conflict.lead > strategy.leadMax)
        reasons.push(loc`Lead ${strategy.leadMax} or less`);
      const needs = strategy.ratings ?? [];
      if (needs.length) {
        const met = needs.map(need => (ratings[need.rating] ?? 0) >= need.min);
        const ok = strategy.ratingsMode === "all" ? met.every(Boolean) : met.some(Boolean);
        if (!ok)
          reasons.push(
            needs.map(need => `${need.rating} ${need.min}+`).join(strategy.ratingsMode === "all" ? " and " : " or ")
          );
      }
      // Daredevil supplies the Stunt Strategy's feat requirement.
      let confirm = daredevil && strategy.id === "stunt" ? "" : strategy.other || "";
      // Breaking Points and Hold Out open every Strategy of the side's own list, whatever it requires.
      if (strategy.side === side && mindFeat(conflict, side)) {
        reasons.length = 0;
        confirm = "";
      }
      return { ...strategy, available: reasons.length === 0, reasons, confirm };
    });
}

/** Step 1: each side secretly commits one Strategy; there is no backing out once chosen. */
export function chooseStrategy(conflict, side, strategyId, { confirmOther = false } = {}) {
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
  if (conflict.step !== "strategies") throw new Error(loc`Strategies are chosen at the start of the Conflict round.`);
  const choice = availableStrategies(conflict, side).find(strategy => strategy.id === strategyId);
  if (!choice) throw new Error(loc`That Strategy is not open to this side.`);
  if (!choice.available) throw new Error(loc`${choice.name} requires ${choice.reasons.join("; ")}.`);
  if (choice.confirm && !confirmOther) throw new Error(loc`${choice.name}: the GC must confirm “${choice.confirm}”.`);
  if (conflict[side].strategy) throw new Error(loc`A chosen Strategy cannot be changed.`);
  const next = structuredClone(conflict);
  next[side].strategy = strategyId;
  if (SIDES.every(key => next[key].strategy)) next.step = "check";
  return next;
}

/** The Strategy's printed modifier to that side's opposed skill check, after Defensive or Offensive Driving. */
export function strategyModifier(conflict, side) {
  const strategy = type(conflict.type).strategies.find(entry => entry.id === conflict[side].strategy),
    printed = strategy?.modifier ?? 0;
  const halves =
    conflict.type === "chase" &&
    printed < 0 &&
    ((strategy.side === "prey" && has(conflict, side, "Defensive Driving")) ||
      (strategy.side === "predator" && has(conflict, side, "Offensive Driving")));
  return halves ? -Math.floor(-printed / 2) : printed;
}

/**
 * Step 2: opposed check. Results are final totals including the Strategy modifier.
 * The winner takes 1 Advantage plus 1 per full 4 points of margin. A winner's critical success
 * and a loser's critical failure each move the Lead 1 in the winner's favour.
 * A tie is broken as any opposed check (p.91): pass `tieWinner`.
 */
export function resolveCheck(conflict, { predator, prey, tieWinner = null }) {
  if (conflict.step !== "check") throw new Error(loc`Both sides must choose a Strategy first.`);
  for (const [side, entry] of Object.entries({ predator, prey }))
    if (!Number.isFinite(entry?.result)) throw new Error(loc`Enter the ${side}'s check result.`);
  let winner = predator.result > prey.result ? "predator" : prey.result > predator.result ? "prey" : tieWinner;
  if (!SIDES.includes(winner))
    throw new Error(loc`The opposed check is tied: break the tie (p.91) and name the winner.`);
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
  const names = strategy?.advantages ?? [],
    alwaysLead = leadFeat(conflict, conflict.pending.winner);
  return rules.advantages.filter(advantage =>
    names.includes("*") ? !advantage.victory : names.includes(advantage.name) || (alwaysLead && advantage.id === "lead")
  );
}

/**
 * Step 3: the winner spends his Advantage picks. `picks` is a list of advantage ids (repeats allowed).
 * `leadShift` overrides the computed Lead change when an Advantage's repeat rule needs the GC's count.
 */
export function chooseAdvantages(conflict, picks, { leadShift = null } = {}) {
  if (conflict.step !== "advantages" || !conflict.pending) throw new Error(loc`Resolve the opposed check first.`);
  const options = advantageOptions(conflict),
    { winner, advantages: allowed } = conflict.pending;
  if (!Array.isArray(picks) || picks.length < 1 || picks.length > allowed)
    throw new Error(loc`Choose 1 to ${allowed} Advantage(s).`);
  const chosen = picks.map(id => {
    const found = options.find(option => option.id === id);
    if (!found) throw new Error(loc`That Advantage is not listed with the winning Strategy.`);
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
  if (!whole(shift) || shift < 0) throw new Error(loc`Enter the Lead change as a whole number.`);
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
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
  if (conflict.step !== "outside") throw new Error(loc`Finish the current Conflict round first.`);
  const next = structuredClone(conflict);
  next.round += 1;
  next.step = "strategies";
  for (const side of SIDES) Object.assign(next[side], { strategy: null, result: null, critical: null });
  return next;
}

/** Photo Finish: the side lowers its own Acceleration and Turning by 2, and each other participant's by 2. */
export function photoFinish(conflict, side) {
  if (!SIDES.includes(side)) throw new Error(loc`Choose Predator or Prey.`);
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
  if (conflict.type !== "chase" || !has(conflict, side, "Photo Finish"))
    throw new Error(loc`Photo Finish needs a chase participant with the feat.`);
  return { ...structuredClone(conflict), photoFinish: (conflict.photoFinish ?? 0) + 1 };
}

const ONCE_PER_CHASE = {
  "Defensive Driving": () => loc`forces 1 opponent to suffer the effects of a Crisis Advantage`,
  "Offensive Driving": () => loc`ignores 1 Crisis without a skill check or save`
};
/** Defensive or Offensive Driving's once-per-chase use; the effect itself is resolved at the table. */
export function useConflictFeat(conflict, side, feat) {
  if (!SIDES.includes(side)) throw new Error(loc`Choose Predator or Prey.`);
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
  if (conflict.type !== "chase" || !Object.hasOwn(ONCE_PER_CHASE, feat) || !has(conflict, side, feat))
    throw new Error(loc`That side has no once-per-chase use of this feat.`);
  if (conflict.featUses?.[side]?.includes(feat)) throw new Error(loc`${feat} was already used this chase.`);
  const next = structuredClone(conflict);
  next.featUses = { ...(next.featUses ?? {}), [side]: [...(next.featUses?.[side] ?? []), feat] };
  return { next, note: `${feat}: ${ONCE_PER_CHASE[feat]()}.` };
}

/**
 * Breaking Points / Hold Out: for +1 error range on the side's check this round, the round's duration is halved or
 * doubled. Declared while Strategies are being chosen or before the check; one declaration per side per round.
 */
export function declarePace(conflict, side) {
  if (!SIDES.includes(side)) throw new Error(loc`Choose Predator or Prey.`);
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
  if (!mindFeat(conflict, side)) throw new Error(loc`That side cannot change the round’s duration.`);
  if (!["strategies", "check"].includes(conflict.step))
    throw new Error(loc`Declare it before the opposed check is resolved.`);
  if (conflict.pace?.round === conflict.round && conflict.pace.sides?.includes(side))
    throw new Error(loc`Already declared this round.`);
  const next = structuredClone(conflict),
    sides = next.pace?.round === next.round ? [...next.pace.sides, side] : [side];
  next.pace = { round: next.round, sides };
  const halved = side === "predator";
  return {
    next,
    note: halved
      ? loc`Breaking Points: this round takes half its usual time; the Predator’s check has +1 error range.`
      : loc`Hold Out: this round takes twice its usual time; the Prey’s check has +1 error range.`
  };
}

/** A side may concede at any time: the opponent applies its Victory result. */
export function concede(conflict, side) {
  if (!SIDES.includes(side)) throw new Error(loc`Choose Predator or Prey.`);
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
  return { ...structuredClone(conflict), winner: other(side), step: "ended", conceded: side };
}

/** GC correction or an outside effect that moves the Lead directly. */
export function adjustLead(conflict, lead) {
  if (!whole(lead)) throw new Error(loc`Enter the Lead as a whole number.`);
  if (conflict.winner) throw new Error(loc`This conflict is over.`);
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
