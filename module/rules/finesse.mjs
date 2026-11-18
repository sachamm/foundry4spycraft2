import { loc } from "../i18n.mjs";
/** Finesse Mastery/Supremacy p.178. Melee scope includes unarmed, never hurled attacks. */
const meleeProficiencies = new Set(["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"]);
export const finesseMeleeWeapon = weapon => meleeProficiencies.has(weapon?.proficiency);
export function finesseThreatIncrease(system, weapon) {
  return finesseMeleeWeapon(weapon)
    ? Number(system.activeFeatNames?.includes("Finesse Mastery") === true) +
        Number(system.activeFeatNames?.includes("Finesse Supremacy") === true)
    : 0;
}
export function finesseCriticalEligible(check) {
  return (
    check?.checkKind === "attack" &&
    (typeof check.attackContext?.ranged === "boolean"
      ? !check.attackContext.ranged
      : meleeProficiencies.has(check.weaponProficiency))
  );
}
/** Basics grants the quality optionally; choosing Dexterity damage remains a separate option. */
export function finesseWeaponPlan(system, weapon) {
  const required = Number(String(weapon.sizeHands ?? "").match(/\/\s*([12])h/i)?.[1] ?? 0),
    eligible = finesseMeleeWeapon(weapon) && weapon.proficiency !== "unarmed" && required === 1,
    intrinsic = /\bFIN\b/.test(weapon.qualities ?? ""),
    requested = weapon.grantFinesse === true,
    granted = eligible && requested && system.activeFeatNames?.includes("Finesse Basics") === true;
  return {
    eligible,
    intrinsic,
    requested,
    granted,
    effectiveQualities:
      granted && !intrinsic
        ? [/^[—–-]+$/.test(String(weapon.qualities ?? "").trim()) ? "" : String(weapon.qualities ?? "").trim(), "FIN"]
            .filter(Boolean)
            .join(", ")
        : String(weapon.qualities ?? "")
  };
}
/** Massive p.302; the Basics waiver affects only the Massive Initiative loss, not weak-Strength attacks. */
export function massiveWeaponPlan(system, weapon) {
  if (!/\bMAS\b/.test(weapon.qualities ?? ""))
    return { active: false, attackPenalty: 0, listedInitiativeLoss: 0, initiativeLoss: 0, waived: false, notes: [] };
  const strength = system.abilities?.str;
  if (!Number.isSafeInteger(strength?.value) || !Number.isSafeInteger(strength?.mod))
    throw new Error(loc`Review the actual Strength score and modifier before using a Massive weapon.`);
  const required = Number(String(weapon.sizeHands ?? "").match(/\/\s*([12])h/i)?.[1] ?? 0),
    waived =
      finesseMeleeWeapon(weapon) &&
      weapon.proficiency !== "unarmed" &&
      required === 2 &&
      system.activeFeatNames?.includes("Finesse Basics") === true,
    listedInitiativeLoss = Math.max(0, 4 - strength.mod),
    initiativeLoss = waived ? 0 : listedInitiativeLoss,
    attackPenalty = strength.value <= 14 ? -4 : 0;
  return {
    active: true,
    strength: strength.value,
    strengthModifier: strength.mod,
    attackPenalty,
    listedInitiativeLoss,
    initiativeLoss,
    waived,
    notes: [
      ...(attackPenalty ? [loc`Massive: Strength14 or lower, attack −4 (p.302).`] : []),
      waived
        ? loc`Finesse Basics: Massive Initiative loss waived for this two-handed melee weapon (p.178).`
        : loc`Massive: Initiative Count −${initiativeLoss} for this attack; apply the loss in combat (p.302).`
    ]
  };
}
