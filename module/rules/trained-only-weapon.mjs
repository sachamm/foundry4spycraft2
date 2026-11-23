import { trainedOnlyAttackPlan } from "./trained-only.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
export function trainedOnlyWeaponPlan(
  weapon,
  { trained = false, operatingProficiency = weapon?.proficiency ?? null } = {}
) {
  const p = trainedOnlyAttackPlan(weapon, { trained });
  return { ...p, evidence: { ...p.evidence, ...weaponSourceIdentity(weapon, { operatingProficiency }) } };
}
export function validateTrainedOnlyWeaponProof(actor, proof, context = {}) {
  if (!proof) return;
  const { weapon, operatingProficiency, trained } = ownedWeaponTraining(actor, proof, context),
    current = trainedOnlyWeaponPlan(weapon, { trained, operatingProficiency });
  if (current.blocked || stable(current.evidence) !== stable(proof))
    throw Error(
      loc`The Trained Only weapon quality or actual operating proficiency changed or no longer permits this attack.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "trainedOnlyWeapon",
  order: 1260,
  validate: ({ actor, options, checkKind }) =>
    validateTrainedOnlyWeaponProof(actor, options.attackContext?.trainedOnly, {
      checkKind,
      weaponProficiency: options.weaponProficiency,
      weaponUuid: options.weaponUuid,
      attackContext: options.attackContext
    })
});
