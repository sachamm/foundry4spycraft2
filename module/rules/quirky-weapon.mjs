import { quirkyAttackPlan } from "./quirky.mjs";
import { weaponSourceIdentity, ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
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
