import { shakenRules } from "./shaken.mjs";
import { uncannyDodgePlan, initiativeLossPlan } from "./defense.mjs";
const countValid = n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER;
const penaltyValid = n => n === 0 || n === -2 || n === -4;
const sourceProof = rules =>
  rules.sources
    .map(s => ({
      id: s.uuid ?? s.id,
      grade: s.grade,
      selfInflicted: typeof s.selfInflicted === "boolean" ? s.selfInflicted : null
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
/** A newly entered or rolled Initiative is its final Count; Uncanny Dodge never halves its check modifier. */
export function shakenInitiativeMarker(system, initiative) {
  const rules = shakenRules(system),
    sources = sourceProof(rules);
  if (initiative === null)
    return {
      version: 1,
      count: null,
      includedPenalty: 0,
      shakenSources: sources,
      needsReview: false,
      reason: null,
      id: null
    };
  if (!countValid(initiative)) throw new Error("Review the finite Initiative Count.");
  if (rules.needsReview) throw new Error("Review the Shaken sources before setting Initiative.");
  return {
    version: 1,
    count: initiative,
    includedPenalty: rules.initiativePenalty,
    shakenSources: sources,
    needsReview: false,
    reason: null,
    id: null
  };
}
/** Change only the known component. Protection applies when a new incoming effect causes the Count loss. */
export function shakenInitiativePlan(system, { initiative, record } = {}, { selfInflicted } = {}) {
  if (initiative === null)
    return {
      changed:
        record?.version !== 1 || record.count !== null || record.includedPenalty !== 0 || record.needsReview === true,
      initiative: null,
      record: shakenInitiativeMarker(system, null),
      delta: 0
    };
  const review = reason => ({ needsReview: true, reason, initiative, record, delta: 0, changed: false });
  if (!countValid(initiative)) return review("Review the finite Initiative Count.");
  const rules = shakenRules(system);
  if (rules.needsReview) return review("Review the current Shaken sources before adjusting Initiative Count.");
  if (record?.needsReview) return review(record.reason ?? "Review this Initiative Count’s included Shaken penalty.");
  if (record?.version !== 1 || !penaltyValid(record.includedPenalty) || !countValid(record.count))
    return review(
      "This existing Initiative Count has no verified Shaken component. Confirm its included full or protected penalty."
    );
  if (record.count !== initiative)
    return review("Initiative Count changed without its Shaken record. Confirm its included penalty.");
  if (
    rules.initiativePenalty &&
    uncannyDodgePlan(system).halveIncomingInitiative &&
    !Array.isArray(record.shakenSources)
  )
    return review(
      "Review this older Count component against Uncanny Dodge IV; it may include a full check penalty or an incoming effect loss."
    );
  const sources = sourceProof(rules);
  let component = rules.initiativePenalty ? record.includedPenalty || -4 : 0;
  if (
    rules.initiativePenalty &&
    (record.includedPenalty === 0 || selfInflicted !== undefined) &&
    uncannyDodgePlan(system).halveIncomingInitiative
  ) {
    if (selfInflicted !== undefined && typeof selfInflicted !== "boolean")
      return review("Confirm whether this Count loss is caused by the character’s own action.");
    let own = selfInflicted;
    if (own === undefined) {
      const old = Array.isArray(record.shakenSources) ? record.shakenSources : [],
        changed = sources.filter(s => {
          const previous = old.find(p => p.id === s.id);
          return !previous || s.grade > previous.grade;
        });
      const kinds = new Set(changed.map(s => s.selfInflicted));
      if (changed.length && kinds.size === 1 && typeof changed[0].selfInflicted === "boolean")
        own = changed[0].selfInflicted;
    }
    if (typeof own !== "boolean")
      return review(
        "Uncanny Dodge IV: confirm whether the new Shaken Count loss came from an incoming attack/effect or the character’s own action."
      );
    component = -initiativeLossPlan(system, { loss: 4, selfInflicted: own }).loss;
  }
  const delta = component - record.includedPenalty,
    next = initiative + delta;
  if (!countValid(next)) return review("The adjusted Initiative Count is unsafe.");
  const nextRecord = { ...shakenInitiativeMarker(system, next), includedPenalty: component };
  return {
    changed: delta !== 0 || JSON.stringify(record.shakenSources) !== JSON.stringify(sources),
    initiative: next,
    record: nextRecord,
    delta
  };
}
export function reviewedShakenInitiativePlan(
  system,
  { initiative, record } = {},
  includedPenalty,
  { selfInflicted } = {}
) {
  if (!penaltyValid(includedPenalty))
    throw new Error(
      "Confirm whether the current Count includes no penalty, the protected −2 or the full −4 Shaken penalty."
    );
  const plan = shakenInitiativePlan(
    system,
    {
      initiative,
      record: {
        ...record,
        version: 1,
        count: initiative,
        includedPenalty,
        shakenSources: Array.isArray(record?.shakenSources) ? record.shakenSources : [],
        needsReview: false
      }
    },
    { selfInflicted }
  );
  if (plan.needsReview) throw new Error(plan.reason);
  return { ...plan, changed: true };
}
