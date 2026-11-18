import { validOwnCountClock } from "./own-count-duration.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
/** Stone Cold p.205: being considered armed satisfies Intimidate's exact weapon gear requirement. */
export function stoneColdSkillPlan(system, key, check) {
  if (key !== "intimidate" || !system.activeFeatNames?.includes("Stone Cold"))
    return { evidence: null, check, notes: [] };
  const tagsBefore = String(check.tags ?? ""),
    tags = tagsBefore.replace(/\bGear \(weapon\)/gi, "");
  return {
    evidence: {
      version: 1,
      source: "Stone Cold",
      kind: "skill",
      skillKey: key,
      checkId: check.id,
      armed: true,
      tagsBefore,
      tagsAfter: tags,
      weaponGearWaived: tags !== tagsBefore
    },
    check: { ...check, tags },
    notes: [
      "Stone Cold: considered armed for this Intimidate check; an exact Gear (weapon) requirement is satisfied without creating a weapon (p.205)."
    ]
  };
}
/** The Will benefit is untyped and applies during the character's actual started combat, including off Count. */
export function stoneColdSavePlan(system, key, combat) {
  if (key !== "will" || !system.activeFeatNames?.includes("Stone Cold") || !validOwnCountClock(combat)) return null;
  return {
    version: 1,
    source: "Stone Cold",
    kind: "save",
    checkId: key,
    bonus: 1,
    type: "",
    combat: { id: combat.id, combatantId: combat.combatantId, started: true }
  };
}
export function validateStoneColdProof(system, proof, { checkKind, skillKey, checkId, combat = null } = {}) {
  if (!proof) return;
  const current =
    proof.kind === "save"
      ? stoneColdSavePlan(system, checkId, combat)
      : stoneColdSkillPlan(system, skillKey, { id: checkId, tags: proof.tagsBefore }).evidence;
  if (
    checkKind !== proof.kind ||
    proof.checkId !== checkId ||
    !current ||
    JSON.stringify(current) !== JSON.stringify(proof)
  )
    throw new Error("The Stone Cold source, armed check or combat save context changed before posting.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "stoneCold",
  order: 1560,
  record: ["stoneCold"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateStoneColdProof(actor.system, options.stoneCold, {
      checkKind,
      skillKey,
      checkId,
      combat: actor.mentalLeapCombatContext()
    })
});
