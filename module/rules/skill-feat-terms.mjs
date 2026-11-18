/** Feats whose whole effect on a skill check is one bonus: each is a term of the skill check plan. */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const GUTS_CHECKS = ["forced-march", "power-lifting", "speed-push"];

rollPipeline.register({
  id: "gutsSkillTerm",
  kinds: ["skill"],
  order: 9340,
  terms({ system, skillKey, check }) {
    const applies =
      skillKey === "athletics" && GUTS_CHECKS.includes(check.id) && system.activeFeatNames?.includes("Guts");
    return {
      bonusAt: 140,
      bonuses: applies ? [{ source: "Guts", value: 4, type: "" }] : [],
      noteAt: 360,
      segment: applies ? loc`Guts: +4 with this named Athletics check. ` : ""
    };
  }
});

// Recorded on the posted check as the roll was given them.
rollPipeline.register({
  id: "skillFeatTermsRecord",
  order: 9750,
  record: ["fundedTaking", "practiceFeat", "professionalFeat", "gamblingDice"]
});
