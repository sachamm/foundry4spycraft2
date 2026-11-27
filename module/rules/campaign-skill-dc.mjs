import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";

/** Freeze just the DC policy when a skill check is planned. Opposing results are not fixed DCs. */
export function campaignSkillDCPolicy(effects = {}) {
  if (!(effects.skillDC || effects.medicineDC)) return null;
  return {
    version: 1,
    skillDC: effects.skillDC ?? 0,
    skillDCMinimum: effects.skillDCMinimum ?? null,
    medicineDC: effects.medicineDC ?? 0
  };
}

export function campaignSkillDCPlan(check, { baseDC, confirmed = false } = {}) {
  const policy = check.campaignSkillDCPolicy;
  if (check.checkKind !== "skill" || check.superseded || !policy || policy.version !== 1)
    throw new Error(loc`Choose an original skill check with its recorded campaign DC policy.`);
  if (confirmed !== true || !Number.isSafeInteger(baseDC) || baseDC < 0 || !Number.isFinite(check.effectiveTotal))
    throw new Error(loc`Confirm the source's whole base DC and this check's final result.`);
  const dc = skillDCFromPolicy(baseDC, policy, check.skillKey);
  return {
    version: 1,
    baseDC,
    dc,
    total: check.effectiveTotal,
    succeeded: check.effectiveTotal >= dc,
    policy: { ...policy }
  };
}

/** Apply the saved campaign changes before a separately declared GC die increase. */
export function skillDCFromPolicy(baseDC, policy, skillKey) {
  if (!Number.isSafeInteger(baseDC) || baseDC < 0) throw new Error(loc`Confirm the source's whole base DC.`);
  if (policy == null) return baseDC;
  if (
    policy.version !== 1 ||
    ![policy.skillDC, policy.medicineDC].every(Number.isSafeInteger) ||
    (policy.skillDCMinimum !== null && !Number.isSafeInteger(policy.skillDCMinimum))
  )
    throw new Error(loc`Review the check's recorded campaign DC modifiers.`);
  const general =
    policy.skillDC < 0 && policy.skillDCMinimum !== null
      ? Math.max(Math.min(baseDC, policy.skillDCMinimum), baseDC + policy.skillDC)
      : baseDC + policy.skillDC;
  const dc = general + (skillKey === "medicine" ? policy.medicineDC : 0);
  if (!Number.isSafeInteger(dc)) throw new Error(loc`The adjusted DC is outside the supported whole-number range.`);
  return dc;
}

rollPipeline.register({
  id: "campaignSkillDC",
  order: 9596,
  kinds: ["skill"],
  record: ["campaignSkillDCPolicy"]
});
