import { accurizedAttackPlan } from "./accurized.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Source identity stays the actual Item even when an operation substitutes proficiency. */
export function accurizedWeaponPlan(
  weapon,
  { trained = false, aimed = false, operatingProficiency = weapon?.proficiency ?? null } = {}
) {
  return {
    ...accurizedAttackPlan(weapon, { trained, aimed }),
    ...weaponSourceIdentity(weapon, { operatingProficiency })
  };
}
export function validateAccurizedWeaponProof(actor, proof, context = {}) {
  if (!proof) return;
  const { weapon, operatingProficiency, trained } = ownedWeaponTraining(actor, proof, context),
    current = accurizedWeaponPlan(weapon, {
      trained,
      aimed: context.attackContext?.aimed === true,
      operatingProficiency
    });
  if (stable(current) !== stable(proof))
    throw Error(loc`The Accurized weapon source, actual operating proficiency or valid Aim changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "accurizedWeapon",
  order: 1270,
  validate: ({ actor, options, checkKind }) =>
    validateAccurizedWeaponProof(actor, options.attackContext?.accurized, {
      checkKind,
      weaponProficiency: options.weaponProficiency,
      weaponUuid: options.weaponUuid,
      attackContext: options.attackContext
    })
});
