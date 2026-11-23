import { ownedWeaponTraining } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { feintAttackTarget } from "./feint-bonus.mjs";
import { stable } from "./equal.mjs";
/** All-out Attack, p.176: choose before the melee attack, not at damage time. */
export function meleeTradeoffPlan(
  system,
  weapon,
  { penalty = 0, ranged = false, defensive = false, targetUuid = null, targetName = "", targetConfirmed = false } = {}
) {
  if (penalty === 0) return null;
  if (!Number.isSafeInteger(penalty) || penalty < 0)
    throw Error(loc`Choose a nonnegative whole All-out Attack penalty before rolling.`);
  const maximum = (system.abilities?.str?.mod ?? NaN) + 2;
  if (
    !system.activeFeatNames?.includes("All-out Attack") ||
    ranged ||
    defensive ||
    !Number.isFinite(maximum) ||
    penalty > maximum
  )
    throw Error(
      loc`All-out Attack requires its earned feat, a melee attack and a penalty no greater than Strength modifier +2.`
    );
  const target = tradeoffTarget({ targetUuid, targetName, targetConfirmed });
  return {
    version: 1,
    source: "All-out Attack",
    weaponId: weapon.id ?? null,
    ...target,
    penalty,
    maximum,
    attackPenalty: -penalty,
    damageBonus: 2 * penalty
  };
}
export function validateMeleeTradeoffProof(
  actor,
  proof,
  { checkKind, weaponUuid, weaponProficiency, attackContext = {}, rerollOf } = {}
) {
  if (!proof) return;
  const item = actor.items?.get?.(proof.weaponId) ?? [...(actor.items ?? [])].find(i => i.id === proof.weaponId);
  if (checkKind !== "attack" || !item || item.type !== "weapon" || item.uuid !== weaponUuid)
    throw Error(loc`The actual All-out Attack weapon changed.`);
  ownedWeaponTraining(actor, proof, { checkKind, weaponUuid, weaponProficiency, attackContext });
  if (rerollOf) {
    const c = globalThis.fromUuidSync?.(rerollOf)?.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      c.weaponUuid !== weaponUuid ||
      c.resolved ||
      c.superseded ||
      stable(c.attackContext?.meleeTradeoff) !== stable(proof)
    )
      throw Error(loc`Use the original owned All-out Attack for its replacement.`);
    return;
  }
  const targetUuid =
      attackContext.targetActorUuid ||
      attackContext.characterTarget?.actorUuid ||
      attackContext.cheapShot?.targetUuid ||
      null,
    p = meleeTradeoffPlan(
      actor.system,
      { ...item.system, id: item.id },
      {
        penalty: proof.penalty,
        ranged: attackContext.ranged === true,
        defensive: attackContext.disarm?.role === "defender",
        targetUuid,
        targetName:
          attackContext.characterTarget?.source === "gcManual"
            ? attackContext.characterTarget.name
            : proof.manualTargetName,
        targetConfirmed: proof.targetConfirmed
      }
    );
  if (stable(p) !== stable(proof))
    throw Error(loc`The All-out Attack choice, actual target, Strength or qualified source changed before posting.`);
}

export function tradeoffTarget({ targetUuid = null, targetName = "", targetConfirmed = false } = {}) {
  let manualTargetName;
  if (typeof targetUuid !== "string" || !targetUuid) {
    if (typeof targetName !== "string" || !targetName.trim() || targetName.length > 200 || targetConfirmed !== true)
      throw Error(
        loc`Choose the actual target, or name the unrecorded target and obtain GC confirmation before making this recorded attack.`
      );
    manualTargetName = targetName.trim();
    targetUuid = "manual:" + manualTargetName;
  }
  return { targetUuid, ...(manualTargetName ? { manualTargetName, targetConfirmed: true } : {}) };
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "meleeTradeoff",
  order: 1140,
  validate: ({ actor, options, checkKind, weaponUuid, weaponProficiency }) =>
    validateMeleeTradeoffProof(actor, options.attackContext?.meleeTradeoff, {
      checkKind,
      weaponUuid,
      weaponProficiency,
      attackContext: options.attackContext,
      rerollOf: options.rerollOf
    })
});

// All-out Attack as part of an attack plan.
rollPipeline.register({
  id: "meleeTradeoffAttackTerm",
  kinds: ["attack"],
  order: 9010,
  terms({ system, weapon, options, ranged }) {
    let plan = null,
      review = "";
    try {
      const manual = options.characterTarget?.source === "gcManual" ? options.characterTarget : null;
      if (manual && options.allOutTargetName?.trim() && manual.name !== options.allOutTargetName.trim())
        throw Error(loc`Use the same named target for this attack’s classification and All-out Attack.`);
      plan = meleeTradeoffPlan(system, weapon, {
        penalty: options.allOutPenalty ?? 0,
        ranged,
        defensive: options.disarm?.role === "defender",
        targetUuid: feintAttackTarget(options),
        targetName: manual?.name ?? options.allOutTargetName ?? "",
        targetConfirmed: !!manual || options.allOutTargetConfirmed === true
      });
    } catch (error) {
      review = error.message;
    }
    return {
      key: "meleeTradeoff",
      plan,
      rowAt: 40,
      rows: [[loc`Melee trade-off`, plan?.attackPenalty ?? 0]],
      blockAt: 60,
      blocked: review,
      noteAt: 70,
      notes: plan
        ? [
            loc`All-out Attack: attack −${plan.penalty}, this attack’s damage +${plan.damageBonus}; a miss makes you flat-footed (p.176).`
          ]
        : []
    };
  }
});
