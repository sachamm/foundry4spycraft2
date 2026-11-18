/** Shaken grades and numerical effects, p.342. Sources add grades; no effects beyond IV are invented. */
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4 };
const statusGrade = id => {
  const match = String(id)
    .toLowerCase()
    .match(/^shaken(?:[-_]?([1-4]|iv|iii|ii|i))?$/);
  return match ? (match[1] ? (ROMAN[match[1]] ?? Number(match[1])) : 1) : null;
};
const explicitGrade = id => String(id).toLowerCase() !== "shaken" && statusGrade(id) !== null;
function state(totalGrade, sources = [], warnings = [], sourceKind = "context") {
  const valid = Number.isSafeInteger(totalGrade) && totalGrade >= 0 && !warnings.length,
    grade = valid ? Math.min(4, totalGrade) : null;
  return {
    sourceKind,
    grade,
    totalGrade: valid ? totalGrade : null,
    sources,
    needsReview: !valid,
    warnings,
    label: valid ? (grade ? "Shaken " + ["", "I", "II", "III", "IV"][grade] : "") : "Shaken — source review required"
  };
}
export function shakenStateFromActor(actor) {
  const own = [...(actor?.effects ?? [])],
    applied = actor?.appliedEffects ?? own.filter(e => e.active ?? (!e.disabled && !e.isSuppressed)),
    sources = [],
    warnings = [];
  let total = 0;
  for (const effect of new Set(applied)) {
    const ids = [...(effect.statuses ?? [])],
      recognized = ids.filter(id => statusGrade(id) !== null),
      unknown = ids.some(id => /^shaken[-_]?(?:\d+|[iv]+)$/i.test(String(id)) && statusGrade(id) === null);
    if (!recognized.length && !unknown) continue;
    const grades = [...new Set(recognized.filter(explicitGrade).map(statusGrade))],
      flag = effect.flags?.spycraft2?.shakenGrade;
    let grade = flag === undefined ? (grades[0] ?? 1) : flag;
    if (
      unknown ||
      grades.length > 1 ||
      !Number.isSafeInteger(grade) ||
      grade < 1 ||
      (grades.length && Math.min(4, grade) !== grades[0])
    ) {
      warnings.push("Review the Shaken grade for " + (effect.name ?? effect.id ?? "an active source") + ".");
      grade = null;
    }
    const metadata = effect.flags?.spycraft2 ?? {},
      rawSelf = Object.hasOwn(metadata, "shakenSelfInflicted")
        ? metadata.shakenSelfInflicted
        : metadata.shakenApplication?.selfInflicted;
    sources.push({
      id: effect.id,
      uuid: effect.uuid ?? effect.id,
      name: effect.name ?? "Shaken",
      grade,
      selfInflicted: typeof rawSelf === "boolean" ? rawSelf : null
    });
    if (grade !== null) total += grade;
  }
  if (!sources.length && [...(actor?.statuses ?? [])].some(id => statusGrade(id) !== null))
    warnings.push("Shaken has no identified active effect source.");
  if (actor && getShakenApplicationReview(actor).needsReview)
    warnings.push("Review the interrupted Shaken application before using its current grade.");
  if (!Number.isSafeInteger(total)) warnings.push("The accumulated Shaken grade is unsafe.");
  return state(total, sources, warnings, "effects");
}
export function shakenStateFromContext(context = {}) {
  const value = context.shakenGrade ?? (context.shaken === true ? 1 : 0);
  return state(value, [], Number.isSafeInteger(value) && value >= 0 ? [] : ["Review the current Shaken grade."]);
}
export function shakenRules(system) {
  const current =
      system.shakenState?.sourceKind === "effects"
        ? system.shakenState
        : shakenStateFromContext(system.conditionContext),
    grade = current.grade ?? 0;
  return {
    ...current,
    skillPenalty: grade >= 1 ? -4 : 0,
    fixedResultsForbidden: grade >= 1,
    initiativePenalty: grade >= 2 ? -4 : 0,
    reflexWillPenalty: grade >= 3 ? -4 : 0,
    attackPenalty: grade >= 4 ? -4 : 0,
    extraDice: grade >= 3 ? 2 : grade === 2 ? 1 : 0,
    spendingForbidden: grade >= 4
  };
}
export const shakenSkillPenalty = (system, ability) =>
  ["cha", "wis"].includes(ability) ? shakenRules(system).skillPenalty : 0;

/** The reviewed surcharge applies once per benefit after cost waivers; transfer-only payments still obey IV's spend ban. */
export function shakenActionDieCost(system, { baseCost = 0, benefitCount = 1, surchargePaid = 0, payer = true } = {}) {
  const rules = shakenRules(system);
  if (rules.needsReview)
    return { blocked: true, reason: "Review the current Shaken sources before action-die spending." };
  if (
    !Number.isSafeInteger(baseCost) ||
    baseCost < 0 ||
    !Number.isSafeInteger(benefitCount) ||
    benefitCount < 0 ||
    !Number.isSafeInteger(2 * benefitCount) ||
    !Number.isSafeInteger(surchargePaid) ||
    surchargePaid < 0 ||
    surchargePaid > 2 * benefitCount ||
    typeof payer !== "boolean"
  )
    return { blocked: true, reason: "Review the whole-die cost, benefit count and previously paid surcharge." };
  const requiredSurcharge = benefitCount * rules.extraDice,
    surcharge = Math.max(0, requiredSurcharge - surchargePaid),
    cost = baseCost + surcharge;
  if (!Number.isSafeInteger(cost)) return { blocked: true, reason: "The action-die cost is unsafe." };
  if (payer && rules.spendingForbidden && cost > 0)
    return { blocked: true, reason: "Shaken IV: no action dice may be spent at all (p.342)." };
  return {
    blocked: false,
    baseCost,
    benefitCount,
    requiredSurcharge,
    surchargePaid,
    surcharge,
    cost,
    grade: rules.grade,
    totalGrade: rules.totalGrade,
    payer,
    spendingForbidden: rules.spendingForbidden
  };
}

const applicationIdValid = id =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !["constructor", "prototype", "__proto__"].includes(id);
export function getShakenApplicationReview(actor) {
  const saved = actor.flags?.spycraft2?.shakenApplicationReview,
    local = globalThis.game?.spycraft2?.pendingShakenReviews?.[actor.uuid];
  if (saved?.needsReview) return saved;
  if (local?.needsReview && !(saved?.id === local.id && saved.needsReview === false)) return local;
  for (const effect of actor.effects ?? []) {
    const tag = effect.flags?.spycraft2?.shakenApplication;
    if (!tag) continue;
    const history = actor.flags?.spycraft2?.shakenApplications,
      entry = applicationIdValid(tag.id) && Object.hasOwn(history ?? {}, tag.id) ? history[tag.id] : null,
      active = effect.active ?? (!effect.disabled && !effect.isSuppressed);
    if (
      entry &&
      entry.effectId === effect.id &&
      entry.grade === tag.grade &&
      entry.source === tag.source &&
      ["applied", "reviewed"].includes(entry.state)
    )
      continue;
    if (entry?.state === "cancelled" && (!active || ![...(effect.statuses ?? [])].some(s => statusGrade(s) !== null)))
      continue;
    return {
      id: tag.id,
      source: tag.source,
      record: { ...tag, effectId: effect.id },
      needsReview: true,
      reason:
        "A Shaken source has no matching completed application receipt. Review its actual effect before applying another event."
    };
  }
  return saved ?? {};
}
export function shakenApplicationSnapshot(actor) {
  const own = [...(actor.effects ?? [])],
    applied = actor.appliedEffects ?? own.filter(e => e.active ?? (!e.disabled && !e.isSuppressed));
  return {
    state: shakenStateFromActor(actor),
    sources: [...new Set([...own, ...applied])]
      .filter(e => e.flags?.spycraft2?.shakenApplication || [...(e.statuses ?? [])].some(s => statusGrade(s) !== null))
      .map(e => ({
        uuid: e.uuid ?? e.id,
        own: own.includes(e),
        data: e.toObject?.() ?? {
          id: e.id,
          statuses: [...(e.statuses ?? [])],
          flags: e.flags ?? {},
          disabled: e.disabled ?? false
        }
      }))
      .sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)))
  };
}
export function shakenApplicationPlan(
  current,
  expected,
  { id, grade, source, confirmed, selfInflicted } = {},
  history = {},
  at = 0
) {
  if (
    !applicationIdValid(id) ||
    !Number.isSafeInteger(grade) ||
    grade < 1 ||
    grade > 4 ||
    typeof source !== "string" ||
    !source.trim() ||
    source.length > 500 ||
    confirmed !== true ||
    !Number.isFinite(at)
  )
    throw new Error("Confirm a new Shaken event with its unique reference, source and grade I–IV.");
  if (selfInflicted !== undefined && typeof selfInflicted !== "boolean")
    throw new Error("Declare whether this new source is caused by the character’s own action.");
  const previous = Object.hasOwn(history, id) ? history[id] : null;
  if (previous) {
    if (
      previous.source !== source.trim() ||
      previous.grade !== grade ||
      (selfInflicted !== undefined &&
        typeof previous.selfInflicted === "boolean" &&
        previous.selfInflicted !== selfInflicted)
    )
      throw new Error("This Shaken reference already records another event.");
    return { duplicate: true, record: previous };
  }
  if (JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error("Shaken sources changed. Review them before applying this event.");
  if (current.state.needsReview) throw new Error("Review the existing Shaken sources before applying another event.");
  const total = current.state.totalGrade + grade;
  if (!Number.isSafeInteger(total)) throw new Error("The accumulated Shaken grade is unsafe.");
  return {
    duplicate: false,
    record: {
      id,
      grade,
      source: source.trim(),
      selfInflicted: selfInflicted ?? null,
      at,
      beforeGrade: current.state.totalGrade,
      afterGrade: total,
      state: "applied"
    }
  };
}

/** Include ended owned sources so their native editors remain reachable for corrections. */
export function shakenSourceEntries(actor) {
  const own = [...(actor.effects ?? [])],
    applied = actor.appliedEffects ?? own.filter(e => e.active ?? (!e.disabled && !e.isSuppressed)),
    recognized = e =>
      [...(e.statuses ?? [])].some(s => statusGrade(s) !== null || /^shaken[-_]?(?:\d+|[iv]+)$/i.test(String(s)));
  return [...new Set([...own, ...applied])]
    .filter(e => e.flags?.spycraft2?.shakenApplication || recognized(e))
    .map(e => ({
      id: e.id,
      uuid: e.uuid ?? e.id,
      name: e.name ?? "Shaken source",
      grade: e.flags?.spycraft2?.shakenGrade ?? [...(e.statuses ?? [])].map(statusGrade).find(n => n !== null) ?? null,
      active: (e.active ?? (!e.disabled && !e.isSuppressed)) && recognized(e),
      editable: e.isOwner === true
    }));
}
