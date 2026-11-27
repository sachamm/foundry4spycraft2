import { classFeatureLevels } from "./class-features.mjs";
import { loc } from "../i18n.mjs";
/** Sleuth p.45: one shared session allowance, no more than once per round. */
export function littleDetailsSource(system) {
  const native = classFeatureLevels(system)?.sleuth ?? 0,
    borrowed = (system.inheritedClassChoices ?? []).some(e => e.name === "Sleuth: Little details (1/session)"),
    level = Math.max(native, borrowed ? 3 : 0);
  return level >= 3 ? { level, limit: 1 + Math.floor((level - 3) / 4) } : null;
}
export function littleDetailsSkillPlan(system, key, check, { littleDetails = false, method = "roll" } = {}) {
  if (littleDetails !== true) return { active: false, blockedReason: "", notes: [] };
  const source = littleDetailsSource(system),
    reasons = [];
  if (!source) reasons.push(loc`Little Details requires earned Sleuth level 3 or a validated borrowed source.`);
  if (key !== "athletics" || check.id !== "smash")
    reasons.push(
      loc`Little Details only makes Athletics/Smash a free-action skill check. Declare Disarm, Feint or Tire separately.`
    );
  if (method !== "roll") reasons.push(loc`Choose a rolled Smash check for Little Details.`);
  return {
    active: true,
    source,
    action: "smash",
    time: "1 Free Action",
    blockedReason: reasons.join(" "),
    notes: [
      loc`Little Details: Athletics/Smash as one free action; one session use and this round’s allowance are consumed (p.45).`
    ]
  };
}
