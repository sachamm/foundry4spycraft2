import { superiorAccuracyAttackPlan } from "./superior-accuracy.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
export function superiorAccuracyWeaponPlan(
  weapon,
  { trained = false, aimed = false, braced = false, operatingProficiency = weapon?.proficiency ?? null } = {}
) {
  return {
    ...superiorAccuracyAttackPlan(weapon, { trained, aimed, braced }),
    ...weaponSourceIdentity(weapon, { operatingProficiency })
  };
}
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
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
      "The Superior Accuracy weapon source, actual operating proficiency, valid Aim or valid Brace changed before posting."
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
