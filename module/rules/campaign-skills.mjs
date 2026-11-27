import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function campaignSkillPolicy(system) {
  const effects = system.campaignEffects ?? {};
  for (const key of ["uncappedSkills", "activeSkillChecks"])
    if (![undefined, 0, 1].includes(effects[key]))
      throw Error(loc`Review the campaign's skill cap and active-check rules.`);
  return effects.uncappedSkills === 1 || effects.activeSkillChecks === 1
    ? { version: 1, uncapped: effects.uncappedSkills === 1, active: effects.activeSkillChecks === 1 }
    : null;
}

export function campaignSkillChecks(
  system,
  key,
  check,
  { surprise = false, shiftingDisposition = false, persuadingAction = false } = {}
) {
  const policy = campaignSkillPolicy(system),
    effects = system.campaignEffects ?? {},
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
    policy,
    bonuses,
    evidence:
      bonuses.length || policy
        ? {
            version: policy ? 2 : 1,
            skillKey: key,
            checkId: check.id,
            surprise: surprise === true,
            shiftingDisposition: shift,
            persuadingAction: persuasion || persuadingAction === true,
            bonus,
            penalty,
            ...(policy ? { policy } : {})
          }
        : null,
    notes: [
      ...(bonuses.length
        ? [loc`Paranoid: morale bonus +${bonus}, morale penalty ${penalty}; each uses normal named-bonus stacking.`]
        : []),
      ...(policy
        ? [
            loc`Omni-Competent: ${policy.active ? loc`active check` : loc`normal check mode`}; ${policy.uncapped ? loc`no skill result cap` : loc`normal result cap`}.`
          ]
        : [])
    ]
  };
}

/** Skill-check penalties remain separate from the bonus halved by Baffled or removed by Incompetent. */
export function moraleSkillPenalty(entries, shaken = 0) {
  return Math.min(0, shaken, ...entries.filter(e => e.type === "morale" && e.value < 0).map(e => e.value));
}
export const isMoralePenalty = entry => entry.type === "morale" && entry.value < 0;
rollPipeline.register({ id: "campaignSkillChecksRecord", order: 9746, record: ["campaignSkillChecks"] });
