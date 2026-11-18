import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
/** p.361 paired ordinary/counter outcomes. Weapon TRP variants remain separate. */
export function tripOutcomePlan(
  a,
  d,
  {
    attackerUuid,
    defenderUuid,
    combat,
    tieResolvedConfirmed = false,
    allowCriticalAttackerWin = false,
    allowCriticalCounter = false,
    activeCombatantId = null,
    sweep = false
  } = {}
) {
  const p = a?.tripAttack,
    q = d?.tripDefense,
    counter = p?.version === 2;
  if (
    !attackerUuid ||
    !defenderUuid ||
    attackerUuid === defenderUuid ||
    a?.actorUuid !== attackerUuid ||
    d?.actorUuid !== defenderUuid ||
    a.checkKind !== "skill" ||
    d.checkKind !== "skill" ||
    a.skillKey !== "acrobatics" ||
    d.skillKey !== "acrobatics" ||
    a.checkId !== (counter ? "counter-trip" : "trip") ||
    d.checkId !== "resist-trip" ||
    ![1, 2].includes(p?.version) ||
    q?.version !== 3 ||
    p.role !== "attacker" ||
    q.role !== "defender" ||
    p.opponentUuid !== defenderUuid ||
    q.opponentUuid !== attackerUuid
  )
    throw Error(
      loc`Pair actual attacking and defending ordinary Trip receipts with reciprocal recorded character identities; name-only responses require manual adjudication.`
    );
  if (
    counter &&
    (p.counterTrip?.version !== 1 ||
      p.counterTrip.depth !== 1 ||
      p.counterTrip.actorUuid !== attackerUuid ||
      p.counterTrip.targetUuid !== defenderUuid ||
      p.counterTrip.activeCombatantId !== q.combat?.combatantId)
  )
    throw Error(loc`The counter-Trip must retain its actual reciprocal parent participants and one-step chain.`);
  for (const c of [a, d])
    if (
      c.resolved !== true ||
      c.superseded ||
      typeof c.successConfirmed !== "boolean" ||
      (c.checkMethod ?? "roll") !== "roll" ||
      !Number.isFinite(c.effectiveTotal) ||
      !Number.isFinite(c.rollData?.total)
    )
      throw Error(loc`Confirm and finish both adopted Trip checks, including boosts and critical activation.`);
  for (const c of [a, d])
    if ((c.criticalSuccess && c.successConfirmed !== true) || (c.criticalFailure && c.successConfirmed !== false))
      throw Error(loc`The activated critical Trip must agree with its confirmed winner or loser.`);
  const criticalFinal = a.successConfirmed === true && (a.criticalSuccess === true || d.criticalFailure === true),
    // Sweep (Kicking Basics, p.186): the attacker's own critical failure gives the opponent no free counter-Trip.
    criticalCounter =
      a.successConfirmed === false && (d.criticalSuccess === true || (a.criticalFailure === true && !sweep));
  if ((criticalFinal && allowCriticalAttackerWin !== true) || (criticalCounter && allowCriticalCounter !== true))
    throw Error(
      loc`This critical Trip needs its final-attack or counter-Trip sequence adjudicated separately; ordinary settlement is unavailable.`
    );
  if (a.successConfirmed === d.successConfirmed) throw Error(loc`The opposed Trip must have one winner and one loser.`);
  if (
    !validOwnCountClock(p.combat) ||
    !validOwnCountClock(q.combat) ||
    p.combat.id !== q.combat.id ||
    p.combat.round !== q.combat.round ||
    p.combat.turn !== q.combat.turn ||
    (!counter && p.combat.turn !== p.combat.ownTurnIndex) ||
    (counter && (q.combat.turn !== q.combat.ownTurnIndex || activeCombatantId !== p.counterTrip.activeCombatantId)) ||
    p.combat.combatantId === q.combat.combatantId ||
    !validOwnCountClock(combat) ||
    combat.combatantId !== p.combat.combatantId ||
    combat.id !== p.combat.id ||
    combat.round !== p.combat.round ||
    combat.turn !== p.combat.turn
  )
    throw Error(loc`Settle the ordinary Trip during the actual original round and attacking Initiative Count.`);
  if (
    p.adjacent !== true ||
    q.adjacent !== true ||
    p.participantsConfirmed !== true ||
    p.halfActionConfirmed !== (counter ? false : true) ||
    q.incomingConfirmed !== true ||
    !Number.isSafeInteger(p.sizeDifference) ||
    p.sizeDifference < -1 ||
    p.sizeDifference > 11 ||
    q.sizeDifference !== -p.sizeDifference ||
    p.ownSize !== q.opponentSize ||
    p.opponentSize !== q.ownSize ||
    p.sizeBonus !== 4 * Math.max(0, p.sizeDifference) ||
    q.sizeBonus !== 4 * Math.max(0, q.sizeDifference)
  )
    throw Error(loc`The recorded participants, adjacency or reciprocal Trip Size declarations disagree.`);
  const delta = a.effectiveTotal - d.effectiveTotal,
    bonus = a.rollData.total - d.rollData.total,
    expected = delta ? delta > 0 : bonus ? bonus > 0 : null;
  if (expected !== null && a.successConfirmed !== expected)
    throw Error(loc`The declared Trip winner disagrees with the opposed totals or higher skill bonus on a tie.`);
  if (expected === null && tieResolvedConfirmed !== true)
    throw Error(loc`Equal totals and skill bonuses require confirmation of the GC’s p.91 random 1d20 tie-break.`);
  return {
    version: counter ? 4 : criticalFinal ? 2 : criticalCounter ? 3 : 1,
    ...(counter
      ? { counterTripDepth: 1, criticalOpportunity: criticalFinal ? "finalAttack" : null }
      : criticalCounter
        ? { counterTripDepth: 0, criticalOpportunity: "counterTrip" }
        : {}),
    ...(criticalFinal ? { criticalOpportunity: "finalAttack", finalAttackPenalty: 4 } : {}),
    attackerUuid,
    defenderUuid,
    attackerWon: a.successConfirmed,
    // Sweep: a lost Trip leaves the attacker flat-footed only on their critical failure.
    condition: a.successConfirmed ? "sprawled" : sweep && a.criticalFailure !== true ? null : "flat-footed",
    conditionActorUuid: a.successConfirmed ? defenderUuid : attackerUuid,
    combatId: p.combat.id,
    round: p.combat.round,
    turn: p.combat.turn,
    tieResolved: expected === null
  };
}
