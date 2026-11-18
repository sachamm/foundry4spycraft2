/**
 * Living Cipher, p.209, on Analysis/Decipher (writing or cracking a code): without a computer the character counts as
 * using one with a Power Rating equal to their Intelligence modifier; with one, its Power Rating counts as 1 higher
 * (maximum 10). Computer Power Rating is not otherwise modelled on this check, so the card states the figures.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function livingCipherPlan(system, key, check) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (key !== "analysis" || check?.id !== "decipher" || !system?.activeFeatNames?.includes("Living Cipher"))
    return empty;
  const pr = Math.max(0, Math.min(10, Number(system.abilities?.int?.mod) || 0));
  return {
    ...empty,
    notes: [
      loc`Living Cipher: without a computer you count as using one of Power Rating ${pr} (and may take the Computers synergy); with a computer, its Power Rating counts as 1 higher, to a maximum of 10 (p.209).`
    ]
  };
}

rollPipeline.register({
  id: "livingCipherSkillTerm",
  kinds: ["skill"],
  order: 9233,
  terms({ system, skillKey, check }) {
    return skillPlanTerm("livingCipher", livingCipherPlan(system, skillKey, check), { noteAt: 43 });
  }
});
