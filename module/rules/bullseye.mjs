import { tradeoffTarget } from "./melee-tradeoff.mjs";
import { cqbRangedWeapon } from "./cqb.mjs";
import { ownedWeaponTraining, weaponSourceIdentity } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { feintAttackTarget } from "./feint-bonus.mjs";
import { stable } from "./equal.mjs";
/** Retain the actual damage profile; stockpile counts do not describe a fired projectile. */
export function bullseyeDamageSourceFacts(weapon, ammunition = null) {
  return {
    damage: weapon.damage ?? "",
    qualities: weapon.qualities ?? "",
    sizeHands: weapon.sizeHands ?? "",
    useHands: weapon.useHands ?? 0,
    hurledNoStrength:
      weapon.noStrengthDamage === true ||
      ["Dart", "Shuriken"].includes(weapon.name) ||
      /grenade|bomb|explosive/i.test(weapon.name ?? ""),
    loadedAmmoId: weapon.loadedAmmoId ?? "",
    ammunition: ammunition
      ? {
          kind: ammunition.ammunitionKind || (/bolt/i.test(ammunition.name ?? "") ? "bolt" : "arrow"),
          ammunitionOnly:
            ammunition.ammunitionOnly === true || ["Standard arrow", "Explosive arrow"].includes(ammunition.name),
          damage: ammunition.damage ?? "",
          errorThreat: ammunition.errorThreat ?? "",
          explosive: ammunition.explosiveAmmunition === true || /explosive/i.test(ammunition.name ?? "")
        }
      : null
  };
}
/** p.180: only a ranged Standard Attack using exactly one shot. */
export function bullseyePlan(
  system,
  weapon,
  {
    penalty = 0,
    sourceWeapon = weapon,
    ranged = false,
    trained = false,
    action = "other",
    firing = {},
    grip = {},
    aimBrace = {},
    stableSurface = false,
    singleShotConfirmed = false,
    targetUuid = null,
    targetName = "",
    targetConfirmed = false,
    ammunition = null,
    disarm = false
  } = {}
) {
  if (penalty === 0) return null;
  if (!Number.isSafeInteger(penalty) || penalty < 0)
    throw Error(loc`Choose a nonnegative whole Bullseye penalty before rolling.`);
  const maximum = (system.abilities?.dex?.mod ?? NaN) + 2;
  if (
    !system.activeFeatNames?.includes("Bullseye") ||
    ranged !== true ||
    action !== "standard" ||
    disarm ||
    singleShotConfirmed !== true ||
    firing.blocked ||
    aimBrace.blocked ||
    (firing.firearm ? firing.fireMode !== "single" : !cqbRangedWeapon(weapon))
  )
    throw Error(
      loc`Bullseye requires its earned feat and a ranged Standard Attack using exactly one shot; confirm that no burst or additional-shot trick applies.`
    );
  if (!Number.isFinite(maximum) || penalty > maximum)
    throw Error(loc`The Bullseye penalty cannot exceed current Dexterity modifier +2.`);
  return {
    version: 1,
    source: "Bullseye",
    weaponId: weapon.id ?? null,
    ...tradeoffTarget({ targetUuid, targetName, targetConfirmed }),
    penalty,
    maximum,
    attackPenalty: -penalty,
    damageBonus: penalty,
    attackAction: "standard",
    singleShotConfirmed: true,
    trained: trained === true,
    firearm: firing.firearm === true,
    fireMode: firing.firearm ? firing.fireMode : null,
    recoil: firing.firearm
      ? { recoil: firing.recoil, recoilStrength: firing.recoilStrength, recoilPenalty: firing.recoilPenalty }
      : null,
    grip: { required: grip.required ?? 0, hands: grip.hands ?? 0, attackPenalty: grip.attackPenalty ?? 0 },
    aimBrace: {
      aimed: aimBrace.aimed === true,
      braced: aimBrace.braced === true,
      stableSurface: stableSurface === true,
      aimBonus: aimBrace.aimBonus ?? 0,
      braceBonus: aimBrace.braceBonus ?? 0,
      threatIncrease: aimBrace.threatIncrease ?? 0,
      aimAction: aimBrace.aimAction ?? null,
      braceAction: aimBrace.braceAction ?? null
    },
    weaponSource: weaponSourceIdentity(sourceWeapon, { operatingProficiency: weapon.proficiency }),
    projectileLabel: ammunition?.name ?? null,
    damageSource: bullseyeDamageSourceFacts(sourceWeapon, ammunition)
  };
}
export function validateBullseyeProof(
  actor,
  proof,
  { checkKind, weaponUuid, weaponProficiency, attackContext = {}, rerollOf } = {}
) {
  if (!proof) return;
  const item = actor.items?.get?.(proof.weaponId) ?? [...(actor.items ?? [])].find(i => i.id === proof.weaponId);
  if (checkKind !== "attack" || !item || item.type !== "weapon" || item.uuid !== weaponUuid)
    throw Error(loc`The actual Bullseye weapon changed.`);
  ownedWeaponTraining(actor, proof, { checkKind, weaponUuid, weaponProficiency, attackContext });
  if (rerollOf) {
    const c = globalThis.fromUuidSync?.(rerollOf)?.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      c.weaponUuid !== weaponUuid ||
      c.resolved ||
      c.superseded ||
      stable(c.attackContext?.bullseye) !== stable(proof)
    )
      throw Error(loc`Use the original owned Bullseye attack for its replacement.`);
    return;
  }
  const preview = actor.weaponAttack(item, {
    ...attackContext,
    ...attackContext.launcherOperation,
    indirectFire: attackContext.launcherOperation?.mode === "indirect",
    ambientLight: typeof attackContext.ambientLight === "string" ? attackContext.ambientLight : "",
    stableSurface: proof.aimBrace.stableSurface,
    bullseyePenalty: proof.penalty,
    bullseyeSingleShotConfirmed: proof.singleShotConfirmed,
    bullseyeTargetName: proof.manualTargetName ?? "",
    bullseyeTargetConfirmed: proof.targetConfirmed === true,
    feintBonusProof: attackContext.feintBonus,
    sideStanceProof: attackContext.sideStance
  });
  if (preview.blocked || stable(preview.bullseye) !== stable(proof))
    throw Error(
      loc`The Bullseye declaration, Dexterity, actual shot, recoil/grip, weapon or qualified source changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "bullseye",
  order: 1130,
  validate: ({ actor, options, checkKind, weaponUuid, weaponProficiency }) =>
    validateBullseyeProof(actor, options.attackContext?.bullseye, {
      checkKind,
      weaponUuid,
      weaponProficiency,
      attackContext: options.attackContext,
      rerollOf: options.rerollOf
    })
});

// Bullseye as part of an attack plan.
rollPipeline.register({
  id: "bullseyeAttackTerm",
  kinds: ["attack"],
  order: 9020,
  terms({ system, weapon, sourceWeapon, options, ranged, trained, stance, firing, grip, stableSurface }) {
    let plan = null,
      review = "";
    try {
      const manual = options.characterTarget?.source === "gcManual" ? options.characterTarget : null;
      if (manual && options.bullseyeTargetName?.trim() && manual.name !== options.bullseyeTargetName.trim())
        throw Error(loc`Use the same named target for this attack’s classification and Bullseye.`);
      plan = bullseyePlan(system, weapon, {
        sourceWeapon,
        penalty: options.bullseyePenalty ?? 0,
        ranged,
        trained,
        action: stance.attackAction,
        firing,
        grip,
        aimBrace: stance,
        stableSurface,
        singleShotConfirmed: options.bullseyeSingleShotConfirmed,
        targetUuid: feintAttackTarget(options),
        targetName: manual?.name ?? options.bullseyeTargetName ?? "",
        targetConfirmed: !!manual || options.bullseyeTargetConfirmed === true,
        ammunition: options.ammunition ?? null,
        disarm: !!options.disarm
      });
    } catch (error) {
      review = error.message;
    }
    return {
      key: "bullseye",
      plan,
      rowAt: 30,
      rows: [[loc`Bullseye`, plan?.attackPenalty ?? 0]],
      blockAt: 50,
      blocked: review,
      noteAt: 60,
      notes: plan
        ? [
            loc`Bullseye: single-shot ranged Standard Attack −${plan.penalty}, this attack’s damage +${plan.damageBonus}; a miss makes you flat-footed (p.180).`
          ]
        : []
    };
  }
});
