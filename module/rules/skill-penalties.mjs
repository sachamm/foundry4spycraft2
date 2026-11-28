import { campaignRules } from "./campaign-rules.mjs";
import { loc } from "../i18n.mjs";

export function skillPenaltyDivisor(system) {
  const value = (system?.campaignEffects ?? campaignRules()).skillPenaltyDivisor ?? 1;
  if (![1, 2].includes(value)) throw Error(loc`Review the campaign's skill penalty reduction.`);
  return value;
}
/** User ruling: halve each penalty's magnitude, round down, retain at least −1. */
export function skillPenaltyValue(system, value) {
  if (!Number.isFinite(value)) throw Error(loc`Review the individual skill-check modifier.`);
  return skillPenaltyDivisor(system) === 2 && value < 0 ? -Math.max(1, Math.floor(Math.abs(value) / 2)) : value;
}
export const skillPenaltyEntries = (system, entries) =>
  entries.map(entry => ({
    ...entry,
    value: skillPenaltyValue(system, entry.value),
    ...(skillPenaltyDivisor(system) === 2 && entry.value < 0 ? { originalValue: entry.value } : {})
  }));
export const skillPenaltyDelta = (system, values) =>
  values.reduce((n, value) => n + skillPenaltyValue(system, value) - value, 0);
export const intrinsicSkillPenaltyDelta = (system, ability, ...values) =>
  skillPenaltyDelta(system, [system.abilities?.[ability]?.mod ?? 0, ...values]);
export function skillPenaltyNotes(system, rows) {
  return skillPenaltyDivisor(system) === 2
    ? loc`Omni-Competent penalties (each rounded separately, minimum −1): ${rows
        .filter(row => row.value < 0)
        .map(row => `${row.label}: ${row.value} → ${skillPenaltyValue(system, row.value)}`)
        .join("; ")}.`
    : "";
}
