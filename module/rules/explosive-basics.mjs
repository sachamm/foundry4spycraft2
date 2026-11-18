/**
 * Explosive Basics, p.174.
 *
 * Setting a mine or other explosive is an attack with the Explosives proficiency (p.336). With this feat its error
 * range falls by 2 (never below 1), and the posted check records that the Reflex save DC against the explosive's
 * damage rises by 2 and the DC to locate it by 4, for the GC to apply when it goes off or is searched for.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const explosiveBasicsApplies = (system, weapon) =>
  system?.activeFeatNames?.includes("Explosive Basics") === true && weapon?.proficiency === "explosives";

rollPipeline.register({
  id: "explosiveBasicsAttackTerm",
  kinds: ["attack"],
  order: 9192,
  terms({ system, weapon }) {
    if (!explosiveBasicsApplies(system, weapon)) return null;
    return {
      key: "explosiveBasics",
      plan: { version: 1, errorReduction: 2, reflexDC: 2, locateDC: 4 },
      errorReduction: 2,
      noteAt: 500,
      notes: [
        loc`Explosive Basics: error range −2 (minimum 1); Reflex saves against this explosive’s damage are DC +2, and finding it is DC +4 (p.174).`
      ]
    };
  }
});
