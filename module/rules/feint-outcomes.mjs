import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
export function feintOutcomePlan(
  acting,
  defending,
  { attackerUuid, defenderUuid, combat, tieResolvedConfirmed = false } = {}
) {
  const p = acting?.feint,
    q = defending?.feint;
  if (
    !attackerUuid ||
    !defenderUuid ||
    attackerUuid === defenderUuid ||
    acting?.actorUuid !== attackerUuid ||
    defending?.actorUuid !== defenderUuid ||
    acting.checkKind !== "skill" ||
    defending.checkKind !== "skill" ||
    acting.skillKey !== "sleightOfHand" ||
    acting.checkId !== "feint" ||
    defending.skillKey !== "notice" ||
    defending.checkId !== "resist-feint" ||
    p?.version !== 3 ||
    q?.version !== 3 ||
    p.role !== "attacker" ||
    q.role !== "defender" ||
    p.opponentUuid !== defenderUuid ||
    q.opponentUuid !== attackerUuid
  )
    throw Error(
      loc`Pair the actual acting Sleight of Hand and opposing Notice Feint receipts with reciprocal recorded opponents.`
    );
  for (const c of [acting, defending])
    if (
      c.superseded ||
      c.resolved !== true ||
      typeof c.successConfirmed !== "boolean" ||
      (c.checkMethod ?? "roll") !== "roll" ||
      !Number.isFinite(c.effectiveTotal) ||
      !Number.isFinite(c.rollData?.total)
    )
      throw Error(
        loc`Confirm and resolve both original Feint checks in chat, including boosts and critical activation.`
      );
  if (acting.successConfirmed === defending.successConfirmed)
    throw Error(loc`The opposed Feint must have one winner and one loser.`);
  if (
    !validOwnCountClock(p.combat) ||
    !validOwnCountClock(q.combat) ||
    p.combat.id !== q.combat.id ||
    p.combat.round !== q.combat.round ||
    p.combat.turn !== q.combat.turn ||
    p.combat.turn !== p.combat.ownTurnIndex ||
    !validOwnCountClock(combat) ||
    combat.combatantId !== p.combat.combatantId ||
    p.combat.combatantId === q.combat.combatantId ||
    combat.id !== p.combat.id ||
    combat.round !== p.combat.round ||
    combat.turn !== p.combat.turn
  )
    throw Error(loc`Resolve the paired Feint during its original combat round and Initiative Count.`);
  const delta = acting.effectiveTotal - defending.effectiveTotal,
    bonusDelta = acting.rollData.total - defending.rollData.total,
    expected = delta ? delta > 0 : bonusDelta ? bonusDelta > 0 : null;
  if (expected !== null && acting.successConfirmed !== expected)
    throw Error(loc`The declared Feint winner does not match the opposed totals (or the higher skill bonus on a tie).`);
  if (expected === null && tieResolvedConfirmed !== true)
    throw Error(loc`Equal results and skill bonuses require the GC’s random 1d20 tie-break confirmation (p.91).`);
  const attackerWon = acting.successConfirmed,
    winner = attackerWon ? acting : defending,
    loser = attackerWon ? defending : acting;
  return {
    version: 1,
    attackerUuid,
    defenderUuid,
    attackerWon,
    winnerUuid: winner.actorUuid,
    loserUuid: loser.actorUuid,
    combatId: p.combat.id,
    round: p.combat.round,
    turn: p.combat.turn,
    criticalAttackBonus: winner.criticalSuccess === true || loser.criticalFailure === true ? 2 : 0,
    criticalDueRound: p.combat.round + 1,
    tieResolved: expected === null
  };
}
export function feintHistoryPlan(system, plan, { sourceMessage, defenderMessage } = {}) {
  if (!plan.attackerWon) return null;
  const rows = system.feintHistory ?? [];
  if (!Array.isArray(rows)) throw Error(loc`Review the target’s successful Feint history.`);
  for (const r of rows) {
    if (
      r?.version !== 1 ||
      typeof r.sourceMessage !== "string" ||
      typeof r.combatId !== "string" ||
      !Number.isSafeInteger(r.round) ||
      r.round < 1
    )
      throw Error(loc`Review the target’s successful Feint history.`);
    if (r.sourceMessage === sourceMessage) {
      if (
        r.defenderMessage !== defenderMessage ||
        r.attackerUuid !== plan.attackerUuid ||
        r.combatId !== plan.combatId ||
        r.round !== plan.round
      )
        throw Error(loc`This Feint source is already recorded with a different outcome.`);
      return { existing: true, record: r };
    }
    if (r.combatId === plan.combatId && r.round === plan.round)
      throw Error(loc`The target has already been successfully Feinted this round.`);
  }
  if (typeof sourceMessage !== "string" || !sourceMessage || typeof defenderMessage !== "string" || !defenderMessage)
    throw Error(loc`Retain both actual Feint receipts.`);
  return {
    existing: false,
    record: {
      version: 1,
      sourceMessage,
      defenderMessage,
      attackerUuid: plan.attackerUuid,
      combatId: plan.combatId,
      round: plan.round
    }
  };
}
