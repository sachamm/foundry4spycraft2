import { loc } from "../i18n.mjs";

/** A creation trade exchanges choices, never specific granted feats or later advancement choices. */
export function modularCreationPlan(record, available = {}, budget = 36, enabled = false) {
  const empty = { valid: true, bought: 0, surrendered: {}, pointAdjustment: 0, sources: [], warnings: [] };
  if (!record) return empty;
  const fail = reason => ({ ...empty, valid: false, warnings: [reason] });
  if (!enabled) return fail(loc`Modular: review this trade against the character's original campaign creation rules.`);
  if (
    record.version !== 1 ||
    record.confirmed !== true ||
    typeof record.note !== "string" ||
    !record.note.trim() ||
    !Number.isSafeInteger(record.bought) ||
    record.bought < 0 ||
    record.bought > Math.floor(budget / 2) ||
    !record.surrendered ||
    typeof record.surrendered !== "object" ||
    Array.isArray(record.surrendered)
  )
    return fail(loc`Modular: record whole-number creation trades and a confirmed review note.`);
  let lost = 0;
  for (const [tree, count] of Object.entries(record.surrendered)) {
    if (!Object.hasOwn(available, tree) || !Number.isSafeInteger(count) || count < 0 || count > available[tree])
      return fail(loc`Modular: surrendered choices exceed the original level-one allowance for ${tree}.`);
    lost += count;
  }
  if (record.bought && lost) return fail(loc`Modular: choose either buying feats or surrendering choices.`);
  return {
    ...empty,
    bought: record.bought,
    surrendered: { ...record.surrendered },
    pointAdjustment: 2 * (lost - record.bought),
    sources: Array.from({ length: record.bought }, (_, index) => ({
      id: `modular:${index}`,
      kind: "modular",
      tree: "any",
      career: 1,
      levelAllowance: 0,
      label: loc`Modular creation feat ${index + 1}`
    }))
  };
}
