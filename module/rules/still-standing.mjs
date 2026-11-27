import { classFeatureLevels } from "./class-features.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Brawler Ploy: Still Standing, p.66. Actual derived class selection, not a feat name. */
export function stillStandingSource(system) {
  const level = classFeatureLevels(system)?.brawler ?? 0;
  if (!Number.isSafeInteger(level) || level < 0 || level > 10)
    throw Error(loc`Review the actual Brawler class level before applying Still Standing.`);
  if (level < 3) return null;
  if (
    !Array.isArray(system.classOptionSelections) ||
    system.classOptionSelections.some(s => !s || typeof s !== "object")
  )
    throw Error(loc`Review the current Brawler Ploy selections.`);
  const choices = system.classOptionSelections.filter(s => s.classId === "brawler" && s.name === "Still Standing");
  if (!choices.length) return null;
  if (choices.length !== 1 || ![3, 5, 7, 9].includes(choices[0].level) || choices[0].level > level)
    throw Error(loc`Review the earned Still Standing Ploy slot; this option is chosen only once.`);
  return {
    version: 1,
    classId: "brawler",
    ability: "Still Standing",
    classLevel: level,
    selectionLevel: choices[0].level
  };
}
/** Called only after the enclosing controller establishes an actual skill response. */
export function stillStandingResistancePlan(system, response) {
  if (!["trip", "bull-rush"].includes(response))
    throw Error(loc`Still Standing resistance applies only to actual Trip or Bull Rush skill responses.`);
  const source = stillStandingSource(system);
  return { version: 1, response, source, bonus: source ? 4 : 0 };
}
export function stillStandingTakedownPlan(
  system,
  { saveKey = "fort", resistingTakedown = false, takedownAttackConfirmed = false } = {}
) {
  if (resistingTakedown === false) return null;
  if (resistingTakedown !== true || saveKey !== "fort" || takedownAttackConfirmed !== true)
    throw Error(
      loc`The GC must confirm this Fortitude save to stay standing after a real hit from a takedown-quality attack (p.66).`
    );
  const source = stillStandingSource(system);
  return {
    version: 1,
    saveKey: "fort",
    resistingTakedown: true,
    takedownAttackConfirmed: true,
    source,
    bonus: source ? 8 : 0
  };
}
export function validateStillStandingResistanceProof(system, proof, response) {
  if (!proof) return;
  if (stable(stillStandingResistancePlan(system, response)) !== stable(proof))
    throw Error(loc`The Still Standing Ploy or resistance context changed before posting.`);
}
export function validateStillStandingSaveProof(system, proof, { checkKind, checkId } = {}) {
  if (!proof) return;
  if (
    checkKind !== "save" ||
    checkId !== "fort" ||
    stable(
      stillStandingTakedownPlan(system, {
        saveKey: checkId,
        resistingTakedown: proof.resistingTakedown,
        takedownAttackConfirmed: proof.takedownAttackConfirmed
      })
    ) !== stable(proof)
  )
    throw Error(loc`The Still Standing Ploy or confirmed takedown Fortitude save changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "stillStandingSave",
  order: 1430,
  record: ["stillStandingSave"],
  validate: ({ actor, options, checkKind, checkId }) =>
    validateStillStandingSaveProof(actor.system, options.stillStandingSave, { checkKind, checkId })
});

// Still Standing's part of a save plan: its bonus against a takedown, guarded until the save is posted.
rollPipeline.register({
  id: "stillStandingSaveTerm",
  kinds: ["save"],
  order: 9410,
  terms({ system, saveKey, input }) {
    let plan;
    try {
      plan = stillStandingTakedownPlan(system, { ...input, saveKey });
    } catch (error) {
      return { blockAt: 10, blocked: error.message };
    }
    return {
      rowAt: 20,
      rows: [[loc`Still Standing`, plan?.bonus ?? 0]],
      flavorAt: 90,
      flavor: plan?.bonus ? loc` — Still Standing: takedown Fortitude +8` : "",
      options: { stillStandingSave: plan },
      guarded: !!plan,
      facts: () => JSON.stringify(stillStandingTakedownPlan(system, { ...input, saveKey }))
    };
  }
});
