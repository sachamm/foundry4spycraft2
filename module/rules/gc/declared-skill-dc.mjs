import { actionDieTotal } from "./gc-spend.mjs";
import { skillDCFromPolicy } from "../campaign-skill-dc.mjs";
import { loc } from "../../i18n.mjs";

const nonempty = value => typeof value === "string" && value.trim().length > 0;

/** A declaration describes one forthcoming check, never a result already rolled. */
export function declaredDCRecord(input) {
  const {
    id,
    actorUuid,
    skillKey,
    checkId = "",
    kind = "skill",
    baseDC,
    count = 1,
    dramatic = false,
    policy = null,
    scene,
    session
  } = input;
  if (
    ![id, actorUuid, skillKey, scene, session].every(nonempty) ||
    typeof checkId !== "string" ||
    !["skill", "knowledge"].includes(kind) ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > (dramatic ? 3 : 1)
  )
    throw Error(loc`Declare one character's skill check and spend at most 1 die, or 3 dice in a dramatic scene.`);
  const campaignDC = skillDCFromPolicy(baseDC, policy, skillKey);
  return {
    version: 1,
    id,
    actorUuid,
    skillKey,
    checkId,
    kind,
    baseDC,
    campaignDC,
    count,
    die: 12,
    explodeLow: dramatic,
    policy: structuredClone(policy),
    scene,
    session,
    state: "reserved",
    dice: []
  };
}

export function validateDCRecord(record) {
  const expected = declaredDCRecord({ ...record, dramatic: record?.explodeLow });
  if (
    record.version !== 1 ||
    record.die !== 12 ||
    typeof record.explodeLow !== "boolean" ||
    expected.campaignDC !== record.campaignDC ||
    !Array.isArray(record.dice) ||
    record.dice.length > record.count ||
    !["reserved", "rolling", "rolled", "ready", "cancelled"].includes(record.state)
  )
    throw Error(loc`Review the saved DC declaration before using it.`);
  return record;
}

/** Validate every natural, including a durable incomplete prefix during recovery. */
export function declaredDCResult(record, { complete = true } = {}) {
  validateDCRecord(record);
  let total = 0;
  for (const [index, rolls] of record.dice.entries()) {
    if (!Array.isArray(rolls) || !rolls.length) throw Error(loc`Review the actual d12 results for this DC.`);
    const die = actionDieTotal(12, rolls, { explodeLow: record.explodeLow });
    if (die.used !== rolls.length || (!die.complete && (complete || index !== record.dice.length - 1)))
      throw Error(loc`Keep each DC die's complete explosion sequence in its original order.`);
    total += die.total;
  }
  if (complete && record.dice.length !== record.count)
    throw Error(loc`Record all paid DC dice before using this declaration.`);
  const dc = record.campaignDC + total;
  if (!Number.isSafeInteger(dc)) throw Error(loc`The boosted DC exceeds the supported whole-number range.`);
  return { total, dc };
}

export function declaredDCScope(record, { actorUuid, checkKind, skillKey, checkId = "" }) {
  return (
    record?.actorUuid === actorUuid &&
    record.kind === checkKind &&
    record.skillKey === skillKey &&
    record.checkId === checkId
  );
}

export function declaredDCProof(record, { sourceUuid, claimId }) {
  if (record.state !== "ready" || ![sourceUuid, claimId].every(nonempty))
    throw Error(loc`Use a completed DC declaration reserved for this check.`);
  const result = declaredDCResult(record);
  return { ...structuredClone(record), sourceUuid, claimId, boost: result.total, dc: result.dc };
}

export function declaredDCOutcome(check) {
  const proof = check?.declaredSkillDC;
  if (
    !proof ||
    !declaredDCScope(proof, check) ||
    check.superseded ||
    check.resolved ||
    check.criticalFailure ||
    !Number.isFinite(check.effectiveTotal)
  )
    throw Error(loc`Choose the actual skill check with its reserved DC declaration.`);
  const expected = declaredDCProof(proof, proof);
  if (expected.boost !== proof.boost || expected.dc !== proof.dc)
    throw Error(loc`The check's declared DC changed. Ask the GC to review it.`);
  return { dc: proof.dc, succeeded: check.effectiveTotal >= proof.dc };
}
