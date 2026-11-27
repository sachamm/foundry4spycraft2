import { classFeatureLevels } from "./class-features.mjs";
import { loc } from "../i18n.mjs";

/** pp.29,33,37–38,84: combine legacy grades, capped by the highest class offering. */
export function uncannyDodgePlan(system) {
  const sources = [];
  for (const classId of ["explorer", "intruder", "triggerman"]) {
    const level = classFeatureLevels(system)?.[classId] ?? 0,
      maxGrade = classId === "triggerman" ? 2 : 5;
    if (Number.isSafeInteger(level) && level > 0)
      sources.push({ classId, grade: Math.min(maxGrade, Math.floor(level / 4)), maxGrade });
  }
  for (const entry of system.inheritedClassChoices ?? [])
    if (["Explorer: Uncanny dodge I", "Intruder: Uncanny dodge I"].includes(entry.name))
      sources.push({ classId: entry.ownerClass ?? entry.ownerId, grade: 1, maxGrade: 1, borrowed: true });
  const grade = Math.min(
    Math.max(0, ...sources.map(s => s.maxGrade)),
    sources.reduce((n, s) => n + s.grade, 0)
  );
  return {
    grade,
    sources,
    retainDexterity: grade >= 1,
    cannotBeFlanked: grade >= 2,
    securityBonus: grade >= 3 ? 4 : 0,
    halveIncomingInitiative: grade >= 4,
    cannotBeFlatFooted: grade >= 5
  };
}
/** pp.29,37,83: Evasion's separate legacy progression. */
export function evasionPlan(system) {
  const sources = [],
    intruder = classFeatureLevels(system)?.intruder ?? 0,
    transporter = classFeatureLevels(system)?.transporter ?? 0;
  if (Number.isSafeInteger(intruder) && intruder > 0)
    sources.push({
      classId: "intruder",
      grade: intruder >= 19 ? 3 : intruder >= 11 ? 2 : intruder >= 2 ? 1 : 0,
      maxGrade: 3
    });
  if (Number.isSafeInteger(transporter) && transporter > 0)
    sources.push({ classId: "transporter", grade: transporter >= 6 ? 1 : 0, maxGrade: 1 });
  for (const entry of system.inheritedClassChoices ?? [])
    if (entry.name === "Intruder: Evasion I")
      sources.push({ classId: entry.ownerClass ?? entry.ownerId, grade: 1, maxGrade: 1, borrowed: true });
  if (system.animalPartner === true && system.companionBenefits?.evasion === 1)
    sources.push({ classId: "animalPartner", grade: 1, maxGrade: 1, companion: true });
  const grade = Math.min(
    Math.max(0, ...sources.map(s => s.maxGrade)),
    sources.reduce((n, s) => n + s.grade, 0)
  );
  return { grade, sources, canTake10: grade >= 3 };
}
export function evasionSaveContext(system, { flatFooted = false, reflexReducesDamage = false } = {}) {
  if (typeof flatFooted !== "boolean" || typeof reflexReducesDamage !== "boolean")
    throw new Error(loc`Declare flat-footedness and whether this Reflex save can reduce damage.`);
  return {
    version: 1,
    grade: evasionPlan(system).grade,
    flatFooted:
      !uncannyDodgePlan(system).cannotBeFlatFooted && (flatFooted || system.conditionContext?.flatFooted === true),
    reflexReducesDamage
  };
}
/** Evasion adjustment only: apply other damage reductions and health settlement separately. */
export function reflexDamagePlan(
  check,
  { damage, normalSuccessDamage, succeeded = check.successConfirmed, confirmed = false } = {}
) {
  const context = check.evasionContext;
  if (
    check.checkKind !== "save" ||
    check.checkId !== "ref" ||
    check.superseded ||
    !context ||
    context.version !== 1 ||
    !Number.isSafeInteger(context.grade) ||
    context.grade < 0 ||
    context.grade > 3 ||
    typeof context.flatFooted !== "boolean" ||
    typeof context.reflexReducesDamage !== "boolean"
  )
    throw new Error(loc`Choose an original Reflex save with its recorded Evasion context.`);
  if (confirmed !== true || typeof succeeded !== "boolean")
    throw new Error(loc`The GC must confirm the source damage, ordinary successful-save damage and outcome.`);
  if (typeof check.successConfirmed === "boolean" && succeeded !== check.successConfirmed)
    throw new Error(loc`The save outcome changed; use its currently confirmed outcome.`);
  if (
    !Number.isSafeInteger(damage) ||
    damage < 0 ||
    !Number.isSafeInteger(normalSuccessDamage) ||
    normalSuccessDamage < 0 ||
    normalSuccessDamage > damage
  )
    throw new Error(
      loc`Enter whole source damage and ordinary successful-save damage between zero and the source damage.`
    );
  const ordinary = succeeded ? normalSuccessDamage : damage,
    eligible = context.reflexReducesDamage && !context.flatFooted && context.grade >= 1;
  const evaded = eligible && succeeded,
    halved = eligible && !succeeded && context.grade >= 2;
  const total = evaded ? 0 : halved ? Math.floor(damage / 2) : ordinary;
  return { damage, normalSuccessDamage, succeeded, ordinary, total, evaded, halved, eligible, context: { ...context } };
}
