import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** User ruling: Supremacy reduces the standard slow ambush from ten minutes to one.
 * Tactics/Ambush p.168, Ambush feats p.193. Outcome rewards remain subject to successful opposition. */
export function ambushCheckPlan(system, key, check, { ambushPreparation = "slow", ambushRole = "" } = {}) {
  if (key !== "tactics" || check.id !== "ambush")
    return {
      applicable: false,
      errorIncrease: 0,
      threatIncrease: 0,
      crossCheckGranted: false,
      timeChoices: [],
      notes: []
    };
  if (!["quick", "slow"].includes(ambushPreparation)) throw new Error(loc`Choose a quick or slow Ambush preparation.`);
  if (!["", "leader", "helper"].includes(ambushRole))
    throw new Error(loc`Choose leader, helper or an unspecified role for this Ambush.`);
  const feats = new Set(system.activeFeatNames ?? []),
    quick = ambushPreparation === "quick",
    mastery = feats.has("Ambush Mastery"),
    supremacy = feats.has("Ambush Supremacy"),
    crossCheckGranted = feats.has("Ambush Basics") && ["leader", "helper"].includes(ambushRole);
  return {
    applicable: true,
    preparation: ambushPreparation,
    role: ambushRole,
    baseSeconds: quick ? 60 : 600,
    time: loc`${quick ? 1 : 10} Minute${quick ? "" : "s"} (Take 10/Take 20 with permission)`,
    errorIncrease: quick ? 2 : 0,
    threatIncrease: mastery ? 1 : 0,
    crossCheckGranted,
    initiativeBonus: quick ? 2 : 5,
    surpriseSneakDice: quick ? 1 : 2,
    timeChoices:
      quick && mastery
        ? [
            {
              id: "ambushMastery",
              name: loc`Ambush Mastery (quick ambush)`,
              multiplier: 0,
              fixedSeconds: 6,
              minimum: 0,
              rounding: null,
              errorIncrease: 2,
              automatic: false
            }
          ]
        : !quick && supremacy
          ? [
              {
                id: "ambushSupremacy",
                name: loc`Ambush Supremacy (slow ambush)`,
                multiplier: 0,
                fixedSeconds: 60,
                minimum: 0,
                rounding: null,
                errorIncrease: 2,
                automatic: false
              }
            ]
          : [],
    notes: [
      loc`${quick ? loc`Quick` : loc`Slow`} Ambush: normal preparation ${quick ? loc`1 minute` : loc`10 minutes`}${quick ? loc`; base error range +2` : ""}. With success, leader/helpers gain one standard half-action surprise round, +${quick ? 2 : 5} Initiative and ${quick ? 1 : 2}d6 sneak attack damage during that surprise round; adjudicate opposition and rewards at the table (p.168).`,
      ...(crossCheckGranted ? [loc`Ambush Basics grants Cross-Check for this declared leader/helper (p.193).`] : []),
      ...(mastery
        ? [
            loc`Ambush Mastery: threat range +1 for Tactics/Ambush. Sense Motive is already a listed synergy on p.168; its bonus is not added twice.`
          ]
        : [])
    ]
  };
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "ambushRecord", order: 9615, record: ["ambush"] });
