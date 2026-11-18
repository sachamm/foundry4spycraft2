import { accurizedAttackPlan } from "./accurized.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
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
