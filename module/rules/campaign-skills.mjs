import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function campaignSkillChecks(
  system,
  key,
  check,
  { surprise = false, shiftingDisposition = false, persuadingAction = false } = {}
) {
  const effects = system.campaignEffects ?? {},
    special =
      !system.npcType ||
      ["special", "villain"].includes(system.npcType) ||
      system.promoted === true ||
      system.promotion?.mission === String(system.usagePeriods?.mission ?? "initial"),
    stealth = (key === "blend" && check.id === "stealth") || (key === "sneak" && check.id === "hide"),
    persuasion = key === "impress" && check.id === "persuasion",
    shift =
      shiftingDisposition === true ||
      (key === "impress" && ["influence", "seduction"].includes(check.id)) ||
      (key === "intimidate" && check.id === "domination") ||
      (key === "manipulate" && check.id === "slander") ||
      (key === "networking" && check.id === "endorsement"),
    bonus = special && stealth && surprise === true ? (effects.surpriseStealthMorale ?? 0) : 0,
    penalty = shift || persuasion || persuadingAction === true ? (effects.socialCheckMorale ?? 0) : 0;
  if (!Number.isSafeInteger(bonus) || bonus < 0 || !Number.isSafeInteger(penalty) || penalty > 0)
    throw Error(loc`Review the campaign's morale modifiers for this skill check.`);
  const bonuses = [
    ...(bonus ? [{ source: "Paranoid", type: "morale", value: bonus }] : []),
    ...(penalty ? [{ source: "Paranoid", type: "morale", value: penalty }] : [])
  ];
  return {
    bonuses,
    evidence: bonuses.length
      ? {
          version: 1,
          skillKey: key,
          checkId: check.id,
          surprise: surprise === true,
          shiftingDisposition: shift,
          persuadingAction: persuasion || persuadingAction === true,
          bonus,
          penalty
        }
      : null,
    notes: bonuses.length
      ? [loc`Paranoid: morale bonus +${bonus}, morale penalty ${penalty}; each uses normal named-bonus stacking.`]
      : []
  };
}

/** Skill-check penalties remain separate from the bonus halved by Baffled or removed by Incompetent. */
export function moraleSkillPenalty(entries, shaken = 0) {
  return Math.min(0, shaken, ...entries.filter(e => e.type === "morale" && e.value < 0).map(e => e.value));
}
export const isMoralePenalty = entry => entry.type === "morale" && entry.value < 0;
rollPipeline.register({ id: "campaignSkillChecksRecord", order: 9746, record: ["campaignSkillChecks"] });
