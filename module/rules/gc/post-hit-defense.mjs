import { attackOutcome } from "../damage-application.mjs";
import { rollEvidence } from "../outcomes.mjs";
import { actionDieTotal } from "./gc-spend.mjs";
import { loc } from "../../i18n.mjs";

function validateReview(review) {
  if (
    review?.version !== 1 ||
    typeof review.id !== "string" ||
    !review.id ||
    !["pending", "finalizing", "complete"].includes(review.state) ||
    typeof review.attackerUuid !== "string" ||
    !review.attackerUuid ||
    typeof review.targetUuid !== "string" ||
    !review.targetUuid ||
    typeof review.session !== "string" ||
    !review.session ||
    typeof review.scene !== "string" ||
    !review.scene ||
    typeof review.evidence !== "string" ||
    !review.evidence ||
    !Array.isArray(review.boosts) ||
    !Array.isArray(review.feats) ||
    review.feats.some(name => typeof name !== "string") ||
    review.original?.targetUuid !== review.targetUuid ||
    !Number.isSafeInteger(review.original.defense) ||
    review.original.defense < 0 ||
    review.original.hit !== true ||
    !Number.isFinite(review.original.total) ||
    review.original.total < review.original.defense ||
    (review.original.cover &&
      (!Number.isSafeInteger(review.original.cover.grade) ||
        review.original.cover.grade < 1 ||
        review.original.cover.grade > 3 ||
        review.original.cover.bonus !== review.original.cover.grade * 2 ||
        review.original.defense < review.original.cover.bonus))
  )
    throw Error(loc`Review the saved NPC post-hit Defense decision.`);
  const ids = new Set();
  for (const boost of review.boosts) {
    if (
      typeof boost.id !== "string" ||
      !boost.id ||
      ids.has(boost.id) ||
      typeof boost.sourceUuid !== "string" ||
      !boost.sourceUuid ||
      ![4, 6, 8, 10, 12].includes(boost.die) ||
      !Array.isArray(boost.rolls) ||
      !boost.rolls.length
    )
      throw Error(loc`Review the recorded NPC Defense dice and their source receipts.`);
    const result = actionDieTotal(boost.die, boost.rolls, { explodeLow: true });
    if (!result.complete || result.used !== boost.rolls.length || result.total !== boost.total)
      throw Error(loc`The saved Defense boost must contain its complete actual dramatic-scene die.`);
    ids.add(boost.id);
  }
}

export function beginNpcHitDefense(
  check,
  resolution,
  { id, attackerUuid, targetUuid, session, scene, combat = null, feats = [] } = {}
) {
  if (
    check?.checkKind !== "attack" ||
    check.resolved ||
    check.superseded ||
    check.actorUuid !== attackerUuid ||
    resolution?.total !== check.effectiveTotal ||
    !resolution.hit ||
    !Array.isArray(feats) ||
    feats.some(name => typeof name !== "string")
  )
    throw Error(loc`Only an unresolved hit on the actual NPC can enter its Defense decision.`);
  const review = {
    version: 1,
    id,
    state: "pending",
    attackerUuid,
    targetUuid,
    session,
    scene,
    combat: structuredClone(combat),
    feats: [...feats],
    original: structuredClone(resolution),
    evidence: rollEvidence(check),
    boosts: []
  };
  validateReview(review);
  return review;
}

export function npcHitDefenseOutcome(review, check) {
  validateReview(review);
  if (
    check.actorUuid !== review.attackerUuid ||
    check.checkKind !== "attack" ||
    check.superseded ||
    check.resolved ||
    rollEvidence(check) !== review.evidence
  )
    throw Error(loc`The attack changed during the NPC Defense decision. Review its original result before continuing.`);
  const boost = review.boosts.reduce((sum, row) => sum + row.total, 0),
    defense = review.original.defense + boost;
  if (!Number.isSafeInteger(defense)) throw Error(loc`The combined NPC Defense exceeds the supported range.`);
  const result = attackOutcome({
    total: check.effectiveTotal,
    defense,
    fireAction: check.attackContext?.fireAction ?? null,
    feats: review.feats
  });
  const baseDefense = review.original.defense - (review.original.cover?.bonus ?? 0);
  return {
    ...structuredClone(review.original),
    defense,
    ...result,
    hitsCover: !!review.original.cover && !result.hit && check.effectiveTotal >= baseDefense + boost,
    gcDefenseBoost: {
      version: 1,
      reviewId: review.id,
      total: boost,
      sources: review.boosts.map(row => ({ id: row.id, sourceUuid: row.sourceUuid }))
    }
  };
}

export function addNpcHitDefenseDie(review, check, boost) {
  const before = npcHitDefenseOutcome(review, check);
  const old = review.boosts.find(row => row.id === boost.id);
  if (old) {
    if (JSON.stringify(old) !== JSON.stringify(boost))
      throw Error(loc`This Defense receipt conflicts with its saved die.`);
    return structuredClone(review);
  }
  if (review.state !== "pending" || !before.hit)
    throw Error(loc`Another Defense die is available only while this attack still hits the NPC.`);
  const next = { ...structuredClone(review), boosts: [...structuredClone(review.boosts), structuredClone(boost)] };
  validateReview(next);
  npcHitDefenseOutcome(next, check);
  return next;
}
