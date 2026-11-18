import { validFendTiming } from "./fend.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { spearChargeMovementPlan } from "./spear-charge.mjs";
import { readiedMeleeFeatSource } from "./readied-weapons.mjs";
import { tradeoffTarget } from "./melee-tradeoff.mjs";
import { ownedWeaponTraining, weaponSourceIdentity } from "./weapon-training.mjs";
import { bullseyeDamageSourceFacts } from "./bullseye.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { feintAttackTarget } from "./feint-bonus.mjs";
import { swordBasicsActive, swordBasicsInactiveReason } from "./sword-basics.mjs";
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
export const MELEE_ATTACK_TRICKS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      threadNeedle: {
        source: "Thread the Needle",
        feat: "Staff Basics",
        family: "staff",
        weaponLabel: "staff",
        attackBonus: 0,
        damageBonus: 0,
        threatIncrease: 0,
        fullAction: false
      },
      fend: {
        source: "Fend",
        feat: "Polearm Basics",
        family: "polearm",
        weaponLabel: "polearm",
        attackBonus: 0,
        damageBonus: 0,
        threatIncrease: 0,
        fullAction: false
      },
      spearCharge: {
        source: "Spear Charge",
        feat: "Spear Basics",
        family: "spear",
        weaponLabel: "spear",
        attackBonus: -2,
        damageBonus: 3,
        threatIncrease: 3,
        page: 179
      },
      hack: {
        source: "Hack!",
        feat: "Great Sword Basics",
        family: "twoHandedSword",
        weaponLabel: "two-handed sword",
        attackBonus: 1,
        damageBonus: 4,
        threatIncrease: 1,
        page: 179
      },
      chop: {
        source: "Chop!",
        feat: "Axe Basics",
        family: "axe",
        weaponLabel: "axe",
        attackBonus: 3,
        damageBonus: 3,
        threatIncrease: 0,
        grantedQuality: "TKD",
        page: 176
      },
      crush: {
        source: "Crush!",
        feat: "Hammer Basics",
        family: "hammer",
        weaponLabel: "hammer",
        attackBonus: 2,
        damageBonus: 5,
        threatIncrease: 0,
        page: 179
      },
      betweenRibs: {
        source: "Between the Ribs",
        feat: "Knife Basics",
        family: "knife",
        weaponLabel: "knife",
        attackBonus: 0,
        damageBonus: 0,
        threatIncrease: 0,
        sneakDice: 1
      },
      impale: {
        source: "Impale",
        feat: "Sword Basics",
        family: "oneHandedSword",
        weaponLabel: "one-handed sword without the finesse quality",
        attackBonus: 0,
        damageBonus: 0,
        threatIncrease: 0,
        fullAction: false,
        finesse: false,
        variableDamage: "impale",
        page: 180
      },
      outOfThePark: {
        source: "Out of the Park",
        feat: "Club Basics",
        family: "club",
        weaponLabel: "club",
        attackBonus: 2,
        damageBonus: 2,
        threatIncrease: 2,
        page: 177
      }
    }).map(([k, v]) => [k, Object.freeze(v)])
  )
);
/** p.179. A declaration does not spend an action or create an attack opportunity. */
export function meleeTrickPlan(
  system,
  weapon,
  {
    trick = "",
    ranged = false,
    action = "other",
    fullActionConfirmed = false,
    onlyFeatTrickConfirmed = false,
    freeFinalAttack = false,
    disarm = false,
    targetUuid = null,
    targetName = "",
    targetConfirmed = false,
    grip = {},
    spearChargeMovement = null,
    fendTiming = null
  } = {}
) {
  if (!trick) return null;
  const d = Object.hasOwn(MELEE_ATTACK_TRICKS, trick) ? MELEE_ATTACK_TRICKS[trick] : null;
  if (
    !d ||
    ranged ||
    action !== "standard" ||
    (d.fullAction !== false && fullActionConfirmed !== true) ||
    onlyFeatTrickConfirmed !== true ||
    (freeFinalAttack && d.fullAction !== false) ||
    disarm
  )
    throw Error(
      d?.fullAction === false
        ? loc`${d.source} requires a melee Standard Attack and confirmation that it is the only Melee/Unarmed Combat feat trick applied.`
        : loc`This melee feat trick requires a full-action melee Standard Attack and confirmation that it is the only Melee/Unarmed Combat feat trick applied.`
    );
  if (d.feat === "Sword Basics" && !swordBasicsActive(system)) throw Error(swordBasicsInactiveReason(system));
  const source = readiedMeleeFeatSource(system, {
      name: d.feat,
      family: d.family,
      bonus: d.attackBonus,
      ...(d.finesse === false ? { finesse: false } : {})
    }),
    held = source?.weapons.find(w => w.id === weapon.id);
  if (
    !held ||
    weapon.meleeFamily !== d.family ||
    held.proficiency !== weapon.proficiency ||
    held.hands !== grip.hands ||
    held.requiredHands !== grip.required
  )
    throw Error(
      loc`${d.source} requires its earned ${d.feat} feat and this actual readied ${d.weaponLabel} with a legal grip.`
    );
  if (trick === "threadNeedle" && (typeof targetUuid !== "string" || !targetUuid || targetUuid.startsWith("manual:")))
    throw Error(loc`Thread the Needle requires its actual observed character target.`);
  if (trick === "fend" && !validFendTiming(fendTiming))
    throw Error(loc`Declare Fend with the actual active participant or out-of-combat world time.`);
  const movement = trick === "spearCharge" ? spearChargeMovementPlan(system, spearChargeMovement ?? {}) : null;
  return {
    version: 1,
    ...(movement ? { movement } : {}),
    ...(trick === "fend" ? { timing: structuredClone(fendTiming) } : {}),
    key: trick,
    source: d.source,
    feat: d.feat,
    weaponId: weapon.id,
    ...tradeoffTarget({ targetUuid, targetName, targetConfirmed }),
    attackAction: "standard",
    fullActionConfirmed: d.fullAction !== false,
    onlyFeatTrickConfirmed: true,
    attackBonus: d.attackBonus,
    damageBonus: d.damageBonus,
    threatIncrease: d.threatIncrease,
    ...(d.grantedQuality ? { grantedQuality: d.grantedQuality } : {}),
    ...(d.sneakDice ? { sneakDice: d.sneakDice } : {}),
    grip: { hands: grip.hands, required: grip.required, attackPenalty: grip.attackPenalty },
    weaponSource: weaponSourceIdentity(weapon),
    damageSource: bullseyeDamageSourceFacts(weapon)
  };
}
function validRecordedSpearCharge(m) {
  if (
    !m ||
    m.version !== 1 ||
    !Number.isFinite(m.speed) ||
    !Number.isFinite(m.distanceFeet) ||
    m.distanceFeet < 10 ||
    m.distanceFeet > m.speed ||
    !Number.isFinite(m.towardFeet) ||
    m.towardFeet < 10 ||
    m.towardFeet > m.distanceFeet ||
    m.routeConfirmed !== true ||
    m.movementCompleted !== true ||
    !validOwnCountClock(m.combat) ||
    m.combat.turn !== m.combat.ownTurnIndex ||
    m.roundMovement?.key !== m.combat.id + ":" + m.combat.round ||
    !Number.isFinite(m.roundMovement.feet) ||
    m.roundMovement.feet < m.distanceFeet
  )
    return false;
  return true;
}
export function validRecordedMeleeTrick(p, c) {
  const d = p && Object.hasOwn(MELEE_ATTACK_TRICKS, p.key) ? MELEE_ATTACK_TRICKS[p.key] : null;
  return (
    !!d &&
    p.version === 1 &&
    (p.key !== "spearCharge" || validRecordedSpearCharge(p.movement)) &&
    (p.key !== "fend" || validFendTiming(p.timing)) &&
    p.source === d.source &&
    p.feat === d.feat &&
    p.attackBonus === d.attackBonus &&
    p.damageBonus === d.damageBonus &&
    p.threatIncrease === d.threatIncrease &&
    p.grantedQuality === d.grantedQuality &&
    p.sneakDice === d.sneakDice &&
    p.attackAction === "standard" &&
    p.fullActionConfirmed === (d.fullAction !== false) &&
    p.onlyFeatTrickConfirmed === true &&
    c?.meleeFeatTrick === p.key &&
    c.ranged === false &&
    c.attackAction === "standard" &&
    c.disarm?.active !== true &&
    (p.key === "hack" ? p.grip?.required === 2 : [1, 2].includes(p.grip?.required)) &&
    [1, 2].includes(p.grip?.hands)
  );
}
export function validateMeleeTrickProof(
  actor,
  proof,
  { checkKind, weaponUuid, weaponProficiency, attackContext = {}, rerollOf, finalAttack, weaponQualities } = {}
) {
  if (!proof) return;
  const item = actor.items?.get?.(proof.weaponId) ?? actor.items?.find?.(i => i.id === proof.weaponId);
  if (checkKind !== "attack" || !item || item.uuid !== weaponUuid)
    throw Error(loc`The actual owned melee trick weapon changed.`);
  ownedWeaponTraining(actor, proof, { checkKind, weaponUuid, weaponProficiency, attackContext });
  if (rerollOf) {
    const c = globalThis.fromUuidSync?.(rerollOf)?.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      c.weaponUuid !== weaponUuid ||
      c.resolved ||
      c.superseded ||
      stable(c.attackContext?.meleeTrick) !== stable(proof) ||
      (proof.grantedQuality && c.weaponQualities !== weaponQualities)
    )
      throw Error(loc`Use the original owned melee trick attack for its replacement.`);
    return;
  }
  if (finalAttack && MELEE_ATTACK_TRICKS[proof.key]?.fullAction !== false)
    throw Error(loc`This melee feat trick requires its own full action, not a final attack opportunity.`);
  const p = actor.weaponAttack(item, {
    ...attackContext,
    ambientLight: typeof attackContext.ambientLight === "string" ? attackContext.ambientLight : "",
    meleeTrick: proof.key,
    meleeTrickFullActionConfirmed: proof.fullActionConfirmed,
    meleeTrickOnlyConfirmed: proof.onlyFeatTrickConfirmed,
    meleeTrickTargetName: proof.manualTargetName ?? "",
    meleeTrickTargetConfirmed: proof.targetConfirmed === true,
    spearChargeDistanceFeet: proof.movement?.distanceFeet,
    spearChargeTowardFeet: proof.movement?.towardFeet,
    spearChargeRouteConfirmed: proof.movement?.routeConfirmed,
    spearChargeMovementCompleted: proof.movement?.movementCompleted,
    feintBonusProof: attackContext.feintBonus,
    sideStanceProof: attackContext.sideStance
  });
  if (
    p.blocked ||
    stable(meleeTrickSourceFacts(p.meleeTrick)) !== stable(meleeTrickSourceFacts(proof)) ||
    (proof.grantedQuality && p.effectiveQualities !== weaponQualities)
  )
    throw Error(loc`The actual melee trick, qualified source, readied weapon, grip or target changed before posting.`);
}

/** Local derived view only; never edits the source Item or accepts arbitrary qualities. */
export function grantedMeleeQuality(qualities = "", quality) {
  if (!quality) return qualities;
  if (quality !== "TKD") throw Error(loc`Unsupported earned melee trick quality.`);
  return /\bTKD\b/.test(qualities) ? qualities : [qualities, "TKD"].filter(Boolean).join(", ");
}

/** Compare Fend’s actual participant identity, preserving the original published numerical turn indices. */
export function meleeTrickSourceFacts(proof) {
  if (proof?.key !== "fend" || !proof.timing?.combat) return proof;
  const c = proof.timing.combat;
  return { ...proof, timing: { ...proof.timing, combat: { id: c.id, round: c.round, combatantId: c.combatantId } } };
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "meleeTrick",
  order: 1120,
  validate: ({ actor, options, checkKind, weaponUuid, weaponProficiency, weaponQualities }) =>
    validateMeleeTrickProof(actor, options.attackContext?.meleeTrick, {
      checkKind,
      weaponUuid,
      weaponProficiency,
      attackContext: options.attackContext,
      rerollOf: options.rerollOf,
      finalAttack: options.finalAttack,
      weaponQualities
    })
});

// The Melee and Unarmed Combat feat tricks as part of an attack plan. Planned after All-out Attack, whose target a
// trick has to share.
rollPipeline.register({
  id: "meleeTrickAttackTerm",
  kinds: ["attack"],
  order: 9030,
  terms({ system, sourceWeapon, options, ranged, stance, grip, plans }) {
    let plan = null,
      review = "";
    try {
      if (options.meleeTrick && options.meleeFeatTrick && options.meleeFeatTrick !== options.meleeTrick)
        throw Error(loc`Only one Melee/Unarmed Combat feat trick may apply to this action.`);
      const manual = options.characterTarget?.source === "gcManual" ? options.characterTarget : null;
      if (manual && options.meleeTrickTargetName?.trim() && manual.name !== options.meleeTrickTargetName.trim())
        throw Error(loc`Use the same named target for this attack and melee trick.`);
      plan = meleeTrickPlan(system, sourceWeapon, {
        trick: options.meleeTrick,
        ranged,
        action: stance.attackAction,
        fullActionConfirmed: options.meleeTrickFullActionConfirmed,
        onlyFeatTrickConfirmed: options.meleeTrickOnlyConfirmed,
        freeFinalAttack: options.freeFinalAttack === true,
        disarm: !!options.disarm,
        targetUuid: feintAttackTarget(options),
        targetName: manual?.name ?? options.meleeTrickTargetName ?? "",
        targetConfirmed: !!manual || options.meleeTrickTargetConfirmed === true,
        grip,
        spearChargeMovement: {
          distanceFeet: options.spearChargeDistanceFeet,
          towardFeet: options.spearChargeTowardFeet,
          routeConfirmed: options.spearChargeRouteConfirmed,
          movementCompleted: options.spearChargeMovementCompleted,
          combat: options.spearChargeCombat
        },
        fendTiming: options.fendTiming
      });
      if (plan && plans.meleeTradeoff && plan.targetUuid !== plans.meleeTradeoff.targetUuid)
        throw Error(loc`Use the same actual target for this melee feat trick and All-out Attack.`);
    } catch (error) {
      review = error.message;
    }
    return {
      key: "meleeTrick",
      plan,
      rowAt: 20,
      rows: [[loc`Melee trick`, plan?.attackBonus ?? 0]],
      threat: plan?.threatIncrease ?? 0,
      grantedQuality: plan?.grantedQuality,
      blockAt: 40,
      blocked: review,
      noteAt: 50,
      notes: plan
        ? [
            plan.key === "betweenRibs"
              ? loc`Between the Ribs: full-action Standard Attack with this readied knife. A hit inflicts 1 die of sneak attack damage: roll damage from this recorded hit and include its sneak attack die. The general sneak attack conditions still apply (p.179).`
              : plan.key === "threadNeedle"
                ? loc`Thread the Needle: standard weapon damage on a hit; use Main’s Thread the Needle outcome to apply its source-specific Held condition. Escape, release or holder movement beyond5ft ends this hold (p.180).`
                : plan.key === "impale"
                  ? loc`Impale: on a hit, +1 damage for every 2 points by which this attack result beats the target’s Defense. Roll damage from this recorded hit; the GC confirms the target’s Defense then (p.180).`
                  : plan.key === "fend"
                    ? loc`Fend: after this Standard Attack, hit or miss, you may immediately move5ft. Record the completed move through Main’s Fend movement; this declaration does not move tokens or spend an additional action (p.179).`
                    : loc` ${plan.source}: full-action Standard Attack; ${plan.attackBonus >= 0 ? "+" : ""}${plan.attackBonus} attack, +${plan.damageBonus} recorded-hit damage${plan.threatIncrease ? `, +${plan.threatIncrease} threat range` : ""}${plan.grantedQuality ? ", takedown quality" : ""} (p.${MELEE_ATTACK_TRICKS[plan.key].page}).`
          ]
        : []
    };
  }
});
