import { attackOutcome } from "../damage-application.mjs";
import { coveredAttackOutcome, validateCoverAttack } from "../cover-interception.mjs";
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
    (review.original.total < review.original.defense && review.original.total < 75) ||
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
  let result = attackOutcome({
    total: check.effectiveTotal,
    defense,
    fireAction: check.attackContext?.fireAction ?? null,
    feats: review.feats
  });
  if (check.coverAwaiting && !check.coverAwaiting.npcDefenseReviewId) {
    validateCoverAttack(check, check.coverInterception?.record);
    result = coveredAttackOutcome(check.coverInterception.record, { defense });
    if (result.needsCoverReview.length)
      throw Error(
        loc`The raised Defense requires additional actual cover saves. Keep the original damage for GC review.`
      );
  }
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
      feats: [...review.feats],
      sources: review.boosts.map(row => ({ id: row.id, sourceUuid: row.sourceUuid }))
    }
  };
}

/** Further Defense can reduce extra shots, but cannot remove the one hit guaranteed by an attack Triumph. */
export function npcHitDefenseCanBenefit(review, check) {
  const result = npcHitDefenseOutcome(review, check);
  return result.hit && (check.effectiveTotal < 75 || result.hits > 1);
}

/** A legal failed-attack reroll keeps every paid Defense increase against that same attack. */
export function npcDefenseRerollProof(check, sourceAttackUuid) {
  const previous = check?.npcDefenseReroll,
    current = check?.gcPostHitDefense,
    resolution = check?.attackResolution;
  if (
    check?.checkKind !== "attack" ||
    check.resolved ||
    check.superseded ||
    check.criticalFailure ||
    check.successConfirmed !== false ||
    resolution?.hit !== false ||
    !sourceAttackUuid ||
    (!previous && !current)
  )
    throw Error(loc`Resolve the original failed attack and its paid NPC Defense before rerolling.`);
  const feats = current?.feats ?? previous?.feats;
  if (!Array.isArray(feats) || feats.some(name => typeof name !== "string"))
    throw Error(loc`The original NPC Defense feat snapshot needs GC review before this legacy attack can reroll.`);
  const sources = [...(previous?.boost?.sources ?? []), ...(current?.sources ?? [])],
    total = (previous?.boost?.total ?? 0) + (current?.total ?? 0);
  const { gcDefenseBoost: _lastBoost, ...original } = resolution;
  const proof = {
    version: 1,
    sourceAttackUuid,
    attackerUuid: check.actorUuid,
    targetUuid: resolution.targetUuid,
    resolution: structuredClone(original),
    feats: [...feats],
    boost: { total, sources: structuredClone(sources) }
  };
  npcDefenseRerollOutcome(proof, check);
  return proof;
}

export function npcDefenseRerollOutcome(proof, check) {
  const saved = proof?.resolution,
    boost = proof?.boost;
  if (
    proof?.version !== 1 ||
    typeof proof.sourceAttackUuid !== "string" ||
    !proof.sourceAttackUuid ||
    typeof proof.attackerUuid !== "string" ||
    proof.attackerUuid !== check?.actorUuid ||
    typeof proof.targetUuid !== "string" ||
    !proof.targetUuid ||
    saved?.targetUuid !== proof.targetUuid ||
    !Number.isSafeInteger(saved.defense) ||
    saved.defense < 0 ||
    !Number.isSafeInteger(boost?.total) ||
    boost.total < 0 ||
    boost.total > saved.defense ||
    !Array.isArray(boost.sources) ||
    !Array.isArray(proof.feats) ||
    proof.feats.some(name => typeof name !== "string") ||
    boost.sources.some(
      row => typeof row.id !== "string" || !row.id || typeof row.sourceUuid !== "string" || !row.sourceUuid
    ) ||
    new Set(boost.sources.map(row => row.id)).size !== boost.sources.length ||
    check?.checkKind !== "attack" ||
    !Number.isFinite(check.effectiveTotal) ||
    (saved.cover &&
      (!Number.isSafeInteger(saved.cover.grade) ||
        saved.cover.grade < 1 ||
        saved.cover.grade > 3 ||
        saved.cover.bonus !== saved.cover.grade * 2 ||
        saved.defense < saved.cover.bonus))
  )
    throw Error(loc`Review the original target, Defense and paid dice before resolving this replacement attack.`);
  const result = attackOutcome({
    total: check.effectiveTotal,
    defense: saved.defense,
    fireAction: check.attackContext?.fireAction ?? null,
    feats: proof.feats
  });
  return {
    ...structuredClone(saved),
    total: check.effectiveTotal,
    ...result,
    hitsCover: !!saved.cover && !result.hit && check.effectiveTotal >= saved.defense - saved.cover.bonus
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
