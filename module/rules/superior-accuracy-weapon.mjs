import { superiorAccuracyAttackPlan } from "./superior-accuracy.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
export function superiorAccuracyWeaponPlan(
  weapon,
  { trained = false, aimed = false, braced = false, operatingProficiency = weapon?.proficiency ?? null } = {}
) {
  return {
    ...superiorAccuracyAttackPlan(weapon, { trained, aimed, braced }),
    ...weaponSourceIdentity(weapon, { operatingProficiency })
  };
}
export function validateSuperiorAccuracyWeaponProof(actor, proof, context = {}) {
  if (!proof) return;
  const { weapon, operatingProficiency, trained } = ownedWeaponTraining(actor, proof, context),
    current = superiorAccuracyWeaponPlan(weapon, {
      trained,
      aimed: context.attackContext?.aimed === true,
      braced: context.attackContext?.braced === true,
      operatingProficiency
    });
  if (stable(current) !== stable(proof))
    throw Error(
      loc`The Superior Accuracy weapon source, actual operating proficiency, valid Aim or valid Brace changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "superiorAccuracyWeapon",
  order: 1340,
  validate: ({ actor, options, checkKind }) =>
    validateSuperiorAccuracyWeaponProof(actor, options.attackContext?.superiorAccuracy, {
      checkKind,
      weaponProficiency: options.weaponProficiency,
      weaponUuid: options.weaponUuid,
      attackContext: options.attackContext
    })
});
