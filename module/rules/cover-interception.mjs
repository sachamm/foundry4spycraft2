import { attackOutcome } from "./damage-application.mjs";
import { sameValues, stable } from "./equal.mjs";
import { loc } from "../i18n.mjs";
import { validCharacterTarget } from "./character-target.mjs";

const identity = value => typeof value === "string" && !!value.trim() && value === value.trim() && value.length <= 2048;
const integer = value => Number.isSafeInteger(value) && value >= 0;

/** Attack dice/context only: later cover adjudication and NPC Defense decisions do not replace that evidence. */
export function coverAttackEvidence(check) {
  return stable(
    Object.fromEntries(
      [
        "checkKind",
        "actorUuid",
        "weaponUuid",
        "rawTotal",
        "effectiveTotal",
        "naturalDie",
        "rawNaturalDie",
        "boostTotal",
        "error",
        "threat",
        "weaponProficiency",
        "weaponQualities",
        "attackContext",
        "rerollOf",
        "superseded"
      ].map(key => [key, check?.[key] ?? null])
    )
  );
}

/** p.345: every shot that would hit without cover either passes it directly or intercepts it. Total cover intercepts all. */
export function coverInterceptionBasis(check, { attackUuid, targetUuid, baseDefense, grade, feats = [] } = {}) {
  if (
    check?.checkKind !== "attack" ||
    check.superseded ||
    !identity(attackUuid) ||
    !identity(check.actorUuid) ||
    !identity(check.weaponUuid) ||
    !identity(targetUuid) ||
    !integer(baseDefense) ||
    !Number.isSafeInteger(grade) ||
    grade < 1 ||
    grade > 4 ||
    !integer(baseDefense + grade * 2) ||
    !Array.isArray(feats) ||
    feats.some(name => typeof name !== "string")
  )
    throw Error(loc`Review the original attack, target, Defense and final cover grade.`);
  const fireAction = structuredClone(check.attackContext?.fireAction ?? null),
    ordinary = attackOutcome({ total: check.effectiveTotal, defense: baseDefense, fireAction, feats }),
    covered = attackOutcome({ total: check.effectiveTotal, defense: baseDefense + grade * 2, fireAction, feats }),
    directHits = grade === 4 ? 0 : covered.hits;
  return {
    version: 1,
    attackUuid,
    actorUuid: check.actorUuid,
    weaponUuid: check.weaponUuid,
    targetUuid,
    sourceEvidence: coverAttackEvidence(check),
    total: check.effectiveTotal,
    baseDefense,
    grade,
    coveredDefense: baseDefense + grade * 2,
    fireAction,
    feats: [...feats],
    potentialHits: ordinary.hits,
    directHits,
    interceptedHits: ordinary.hits - directHits,
    coverCritical: check.effectiveTotal >= 75 && directHits === 0
  };
}

/** Store already-rolled damage. Unreviewed cover stays pending and never invents new save or damage dice. */
export function coverInterceptionPlan(basis, rows, { id, confirmed = false } = {}) {
  if (
    basis?.version !== 1 ||
    !identity(id) ||
    confirmed !== true ||
    !integer(basis.potentialHits) ||
    basis.interceptedHits < 1 ||
    !Array.isArray(rows) ||
    rows.length !== basis.potentialHits
  )
    throw Error(loc`Confirm the original damage for every potential hit before resolving cover.`);
  let canonical;
  try {
    canonical = coverInterceptionBasis(JSON.parse(basis.sourceEvidence), basis);
  } catch {
    throw Error(loc`Review the saved cover interception's original attack evidence.`);
  }
  if (!sameValues(canonical, basis)) throw Error(loc`The saved cover interception does not match its original attack.`);
  const seen = new Set();
  const saved = rows.map((row, index) => {
    if (
      !row ||
      !identity(row.damageUuid) ||
      seen.has(row.damageUuid) ||
      !Number.isSafeInteger(row.originalDamage) ||
      !integer(row.remainingDamage) ||
      row.remainingDamage > Math.max(0, row.originalDamage) ||
      !["direct", "unreviewed", "held", "penetrated"].includes(row.result) ||
      typeof row.note !== "string" ||
      row.note.length > 2048 ||
      (["held", "penetrated"].includes(row.result) && !row.note.trim()) ||
      (row.result === "held" && row.remainingDamage !== 0) ||
      (row.result === "direct" && row.remainingDamage !== Math.max(0, row.originalDamage))
    )
      throw Error(loc`Review each original damage card, cover-save outcome and remaining damage.`);
    seen.add(row.damageUuid);
    return {
      index: index + 1,
      damageUuid: row.damageUuid,
      originalDamage: row.originalDamage,
      result: row.result,
      remainingDamage: row.remainingDamage,
      note: row.note.trim()
    };
  });
  return { version: 1, id, basis: structuredClone(basis), rows: saved };
}

/** A raised NPC Defense may require new cover saves, while retaining every original damage result. */
export function coveredAttackOutcome(record, { defense = record?.basis?.baseDefense } = {}) {
  const basis = record?.basis;
  if (
    !basis ||
    !sameValues(record, coverInterceptionPlan(basis, record.rows, { id: record.id, confirmed: true })) ||
    !integer(defense) ||
    defense < basis.baseDefense ||
    !integer(defense + basis.grade * 2)
  )
    throw Error(loc`Review the saved cover interception and actual final Defense.`);
  const raw = attackOutcome({ total: basis.total, defense, fireAction: basis.fireAction, feats: basis.feats }),
    direct =
      basis.grade === 4
        ? 0
        : attackOutcome({
            total: basis.total,
            defense: defense + basis.grade * 2,
            fireAction: basis.fireAction,
            feats: basis.feats
          }).hits,
    needsCoverReview = [],
    damage = [];
  for (const row of record.rows.slice(0, raw.hits)) {
    if (row.index <= direct) damage.push({ ...row, amount: Math.max(0, row.originalDamage), direct: true });
    else if (["direct", "unreviewed"].includes(row.result)) needsCoverReview.push(row.index);
    else if (row.result === "penetrated") damage.push({ ...row, amount: row.remainingDamage, direct: false });
  }
  return {
    ...raw,
    hit: damage.length > 0,
    hits: damage.length,
    potentialHits: raw.hits,
    needsCoverReview,
    damage,
    checkSucceeded: raw.hits > 0,
    coverCritical: basis.total >= 75 && direct === 0,
    targetCriticalAllowed: direct > 0
  };
}

export function validateCoverAttack(check, record) {
  validateCoverAttackBasis(check, record?.basis);
  coveredAttackOutcome(record);
  return true;
}

export function validateCoverAttackBasis(check, basis) {
  if (coverAttackEvidence(check) !== basis?.sourceEvidence)
    throw Error(loc`The original attack changed after cover damage was recorded. Keep its actual dice for GC review.`);
  if (!sameValues(coverInterceptionBasis(check, basis), basis))
    throw Error(loc`Review the original cover Defense and intercepted hits.`);
  return true;
}

/** Critical pricing uses the first struck cover, while the original attack continues to name its protected target. */
export function coverCriticalContext(check) {
  const pending = check?.coverAwaiting;
  if (!pending || pending.basis?.directHits > 0) return { check, scope: null };
  if (
    pending.version !== 1 ||
    !identity(pending.id) ||
    !validCharacterTarget(pending.criticalTarget) ||
    !identity(pending.criticalName) ||
    pending.criticalName.length > 200 ||
    (pending.criticalRole &&
      (!Number.isSafeInteger(pending.criticalRole.extraDiceToActivate) || pending.criticalRole.extraDiceToActivate < 0))
  )
    throw Error(loc`The GC must identify the actual cover struck before activating its critical.`);
  const actorUuid = pending.criticalTarget.actorUuid ?? pending.criticalActorUuid ?? null;
  if (
    pending.criticalTarget.actorUuid &&
    pending.criticalActorUuid &&
    pending.criticalTarget.actorUuid !== pending.criticalActorUuid
  )
    throw Error(loc`Review the actual cover character before paying for this critical.`);
  const role = pending.criticalTarget.characterType === "object" ? null : (pending.criticalRole ?? null);
  return {
    check: {
      ...check,
      attackContext: {
        ...check.attackContext,
        characterTarget: structuredClone(pending.criticalTarget),
        targetRole: structuredClone(role)
      }
    },
    scope: { kind: "cover", id: pending.id, actorUuid, name: pending.criticalName }
  };
}
