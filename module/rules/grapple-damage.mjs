import { npcWeaponTraining } from "./npc-weapons.mjs";
import { weaponDamage } from "./gear.mjs";
import { damageProfile } from "./damage-application.mjs";
import { weaponGrip } from "./weapon-use.mjs";
import { DAMAGE_TYPES } from "./damage-types.mjs";
import { loc } from "../i18n.mjs";

export const GRAPPLE_DAMAGE_BENEFITS = ["injure", "sprawl", "throw", "useWeapon"];

/** Standard damage from an earned benefit, with conversion paid on the prior Athletics check. */
export function grappleDamagePlan(
  system,
  benefit,
  { weapon = null, kind = "", conversionConfirmed = false, actorType = "agent" } = {}
) {
  if (!GRAPPLE_DAMAGE_BENEFITS.includes(benefit)) throw Error(loc`Choose an earned grapple damage benefit.`);
  const strength = system.abilities?.str?.mod;
  if (!Number.isSafeInteger(strength))
    throw Error(loc`Review the winner's current Strength modifier before rolling grapple damage.`);
  if (benefit === "sprawl") {
    if (weapon || (kind && kind !== "subdual")) throw Error(loc`Sprawl uses 1d4 plus Strength subdual damage.`);
    return {
      benefit,
      formula: `max(0, 1d4 + (${strength}))`,
      profile: damageProfile("1d4 subdual"),
      weaponProficiency: "unarmed",
      weaponUuid: null,
      conditionDamageIncluded: false
    };
  }
  if (benefit === "throw" && weapon)
    throw Error(loc`Throw uses standard unarmed damage, with at least one extra Strength damage.`);
  if (benefit === "useWeapon" && !weapon) throw Error(loc`Choose the pinned opponent's actual one-handed weapon.`);
  let source,
    adjustment = 0;
  if (weapon) {
    if (
      weapon.type !== "weapon" ||
      weapon.system?.equipped !== true ||
      weapon.system?.carried === false ||
      weaponGrip(system, weapon.system).required !== 1 ||
      weaponGrip(system, weapon.system).blocked
    )
      throw Error(loc`This grapple benefit requires an actual readied one-handed weapon.`);
    source = { ...weapon.system, id: weapon.id, name: weapon.name };
  } else {
    const trained =
      actorType === "npc"
        ? npcWeaponTraining(system, { proficiency: "unarmed" }).trained
        : system.proficiencyTotals?.unarmed?.proficient === true;
    const u = system.unarmed ?? { die: trained ? 4 : 3, extraDice: 0, damageBonus: strength };
    if (
      ![3, 4, 6, 8, 10, 12, 20].includes(u.die) ||
      !Number.isSafeInteger(u.extraDice ?? 0) ||
      (u.extraDice ?? 0) < 0 ||
      !Number.isSafeInteger(u.damageBonus)
    )
      throw Error(loc`Review the winner's standard unarmed damage before rolling this benefit.`);
    source = {
      proficiency: "unarmed",
      damage: `${1 + (u.extraDice ?? 0)}d${u.die} ${trained ? "lethal" : "subdual"}`,
      sizeHands: "Tiny/1h",
      equipped: true,
      carried: true,
      name: loc`Unarmed`
    };
    adjustment = u.damageBonus - strength;
  }
  const damage = weaponDamage(system, source, { attackDamageBonus: adjustment }, actorType);
  if (!damage?.formula || damage.blocked)
    throw Error(damage?.blockedReason ?? loc`The selected standard damage needs GC review.`);
  const profile = damageProfile(damage.damageText, damage.effectiveQualities);
  const desired = kind || profile.kind;
  if (!["lethal", "subdual"].includes(desired)) throw Error(loc`Choose lethal or subdual grapple damage.`);
  if (
    desired !== profile.kind &&
    (benefit === "throw" || conversionConfirmed !== true || DAMAGE_TYPES[profile.type]?.convertible === false)
  )
    throw Error(
      loc`Damage conversion requires its actual penalty or waiver on the opposed Athletics check; Throw retains standard unarmed damage.`
    );
  return {
    benefit,
    formula: benefit === "throw" ? `${damage.formula} + (${Math.max(1, strength)})` : damage.formula,
    profile: { ...profile, kind: desired },
    weaponProficiency: source.proficiency,
    weaponUuid: weapon?.uuid ?? null,
    conditionDamageIncluded: true,
    conditionDamagePenalty: damage.conditionDamagePenalty,
    ...(desired !== profile.kind ? { conversionConfirmed: true } : {})
  };
}

export function grappleDamageAward(source, index, actorUuid) {
  const award = source?.flags?.spycraft2?.grappleBenefits;
  if (
    award?.version !== 1 ||
    award.winnerUuid !== actorUuid ||
    !award.loserUuid ||
    award.loserUuid === actorUuid ||
    !Array.isArray(award.benefits) ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= award.benefits.length ||
    !GRAPPLE_DAMAGE_BENEFITS.includes(award.benefits[index])
  )
    throw Error(loc`Use the actual winner's earned damage benefit on its original grapple card.`);
  const eligibility = award.eligibility?.[index];
  if (!eligibility?.heldTarget || (award.benefits[index] === "useWeapon" && !eligibility.pinnedTarget))
    throw Error(loc`The original grapple card must record the held or pinned target required by this benefit.`);
  return {
    sourceUuid: source.uuid,
    index,
    benefit: award.benefits[index],
    actorUuid,
    targetUuid: award.loserUuid,
    sourceEvidence: JSON.stringify(award)
  };
}
