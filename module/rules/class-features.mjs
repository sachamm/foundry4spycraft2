import { checkPrerequisites } from "./prerequisites.mjs";

/** Owned class levels remain available for base progression and previously acquired skills and feats. */
export const classFeatureLevels = system => system?.activeClassLevels ?? system?.classLevels ?? {};
export const classFeatureLevel = (system, id) => classFeatureLevels(system)[id] ?? 0;

export function expertClassQualification(definition, entry, context, { entryCareer = null } = {}) {
  const current = checkPrerequisites(definition.requirements, context);
  const recorded = entry?.expertEntry;
  const entryKnown =
    typeof recorded?.ok === "boolean" &&
    Array.isArray(recorded.unmet) &&
    recorded.unmet.every(s => typeof s === "string") &&
    recorded.ok === (recorded.unmet.length === 0);
  const malformedEntry = recorded != null && !entryKnown;
  const earlyEntry = Number.isSafeInteger(entryCareer) && entryCareer < 5;
  return {
    active: current.ok && !earlyEntry && !malformedEntry && (!entryKnown || recorded.ok),
    current,
    entry: entryKnown ? structuredClone(recorded) : null,
    entryNeedsReview: !entryKnown,
    malformedEntry,
    earlyEntry
  };
}
