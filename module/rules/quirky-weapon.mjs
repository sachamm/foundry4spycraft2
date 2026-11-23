import { quirkyAttackPlan } from "./quirky.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
export function quirkyWeaponPlan(
  weapon,
  {
    trained = false,
    operatingProficiency = weapon?.proficiency ?? null,
    untrainedPenalty = weapon?.untrainedPenalty ?? -4
  } = {}
) {
  return {
    ...quirkyAttackPlan(weapon, { trained, untrainedPenalty }),
    ...weaponSourceIdentity(weapon, { operatingProficiency })
  };
}
export function validateQuirkyWeaponProof(actor, proof, context = {}) {
  if (!proof) return;
  const { weapon, operatingProficiency, trained, launcherOperation } = ownedWeaponTraining(actor, proof, context),
    untrainedPenalty = launcherOperation.applicable
      ? launcherOperation.untrainedPenalty
      : (weapon.untrainedPenalty ?? -4),
    current = quirkyWeaponPlan(weapon, { trained, operatingProficiency, untrainedPenalty });
  if (stable(current) !== stable(proof))
    throw Error(
      loc`The Quirky weapon source, actual operating proficiency or base untrained penalty changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "quirkyWeapon",
  order: 1330,
  validate: ({ actor, options, checkKind }) =>
    validateQuirkyWeaponProof(actor, options.attackContext?.quirky, {
      checkKind,
      weaponProficiency: options.weaponProficiency,
      weaponUuid: options.weaponUuid,
      attackContext: options.attackContext
    })
});
