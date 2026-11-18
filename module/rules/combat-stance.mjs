import { attributeDefensePlan, conditionRollPenalties } from "./attributes.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export const COMBAT_STANCES = {
  striking: { name: "Striking Stance", feat: "Polearm Basics", page: 179, movementLimitFeet: 5 },
  whirling: { name: "Whirling Stance", feat: "Staff Basics", page: 179 },
  power: { name: "Power Stance", feat: "Great Sword Basics", page: 179, movementLimitFeet: 10 },
  driving: { name: "Driving Stance", feat: "Hammer Basics", page: 179 },
  menacing: { name: "Menacing Stance", feat: "Axe Basics", page: 176 },
  punishing: { name: "Punishing Stance", feat: "Flail Basics", page: 178 },
  side: { name: "Side Stance", feat: "Fencing Basics", page: 178, movementLimitFeet: 20 },
  gripping: { name: "Gripping Stance", feat: "Spear Basics", page: 179 },
  stalking: { name: "Stalking Stance", feat: "Garrote Basics", page: 179, movementLimitFeet: 20 },
  circling: { name: "Circling Stance", feat: "Knife Basics", page: 179 },
  furious: { name: "Furious Stance", feat: "Club Basics", page: 177 }
};
export function stanceForcedExit(system) {
  const c = conditionRollPenalties(system);
  return attributeDefensePlan(system).helpless || c.prone || c.sprawled;
}
export function combatStanceState(system) {
  const r = system.combatStance,
    s = COMBAT_STANCES[r?.key];
  if (
    !s ||
    r.version !== 1 ||
    typeof r.id !== "string" ||
    !r.id ||
    !(system.activeFeatNames ?? []).includes(s.feat) ||
    stanceForcedExit(system)
  )
    return null;
  return { version: 1, id: r.id, key: r.key, name: s.name, feat: s.feat };
}
export function combatStanceProof(system, { ranged = false } = {}) {
  return { version: 1, stance: ranged ? null : combatStanceState(system) };
}
export function validateCombatStanceProof(actor, proof, { checkKind, attackContext, rerollOf } = {}) {
  if (!proof) return;
  if (rerollOf) {
    const original =
        globalThis.fromUuidSync?.(rerollOf) ??
        [...(globalThis.game?.messages ?? [])].find(m => m.uuid === rerollOf || m.id === rerollOf),
      c = original?.flags?.spycraft2,
      stable = v =>
        JSON.stringify(v, (_k, x) =>
          x && typeof x === "object" && !Array.isArray(x)
            ? Object.fromEntries(
                Object.keys(x)
                  .sort()
                  .map(k => [k, x[k]])
              )
            : x
        ),
      s = COMBAT_STANCES[proof.stance?.key];
    if (
      checkKind !== "attack" ||
      proof.version !== 1 ||
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      c.resolved ||
      c.superseded ||
      stable(c.attackContext?.combatStance) !== stable(proof) ||
      (proof.stance && (!s || proof.stance.feat !== s.feat || !actor.system.activeFeatNames?.includes(s.feat)))
    )
      throw Error(loc`The original owned combat-stance attack or its qualified source changed.`);
    return;
  }
  if (
    checkKind !== "attack" ||
    JSON.stringify(proof) !==
      JSON.stringify(combatStanceProof(actor.system, { ranged: attackContext?.ranged === true }))
  )
    throw Error(loc`The combat stance or its qualified source changed before posting.`);
}
export function combatStanceDeclaration(
  system,
  key,
  { combat = null, halfActionConfirmed = false, legalConfirmed = false } = {}
) {
  if (!Object.hasOwn(COMBAT_STANCES, key) && key !== "normal")
    throw Error(loc`Choose a supported stance or normal stance.`);
  if (legalConfirmed !== true) throw Error(loc`Confirm this stance action is legal now.`);
  const block =
    attributeActionBlock(system, { purelyMental: false }) || restraintActionBlock(system, { free: key === "normal" });
  if (block) throw Error(block);
  if (key === "normal") return null;
  if (!(system.activeFeatNames ?? []).includes(COMBAT_STANCES[key].feat))
    throw Error(loc`The stance feat has not been earned.`);
  if (stanceForcedExit(system)) throw Error(loc`Helpless, prone or sprawled characters must use normal stance.`);
  if (halfActionConfirmed !== true || (combat && (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)))
    throw Error(loc`Entering a stance requires one legal half action on your own Initiative Count.`);
  return { version: 1, key };
}
export function stanceDamagePlan(check, { expectedKey = null } = {}) {
  const p = check?.attackContext?.combatStance?.stance,
    types = { punishing: "subdual", menacing: "stress" },
    definition = Object.hasOwn(types, p?.key) ? COMBAT_STANCES[p.key] : null,
    name = COMBAT_STANCES[expectedKey]?.name ?? "a supported damage stance";
  if (
    check?.checkKind !== "attack" ||
    check.superseded ||
    check.resolved !== true ||
    check.successConfirmed !== true ||
    check.attackContext?.ranged !== false ||
    check.attackContext?.disarm?.role === "defender" ||
    p?.version !== 1 ||
    !definition ||
    (expectedKey && p.key !== expectedKey) ||
    !p.id ||
    p.feat !== definition.feat
  )
    throw Error(loc`Choose a resolved successful melee attack made in ` + name + ".");
  return { version: 1, stanceId: p.id, amount: 2, damageType: types[p.key], actionDiceAllowed: false };
}
export function punishingDamagePlan(check) {
  return stanceDamagePlan(check, { expectedKey: "punishing" });
}
export function menacingDamagePlan(check) {
  return stanceDamagePlan(check, { expectedKey: "menacing" });
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "combatStance",
  order: 1160,
  validate: ({ actor, options, checkKind }) =>
    validateCombatStanceProof(actor, options.attackContext?.combatStance, {
      checkKind,
      attackContext: options.attackContext,
      rerollOf: options.rerollOf
    })
});
