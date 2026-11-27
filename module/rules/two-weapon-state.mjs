import { classFeatureLevels } from "./class-features.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { ownCountDurationActive } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
const empty = () => ({
  active: false,
  needsReview: false,
  penalty: 0,
  skillPenalty: 0,
  extraAttacks: 0,
  allowedAttacks: 0,
  handgunSkillWaiver: false
});
export function twoWeaponStyleState(system) {
  const r = system.twoWeaponStyle;
  if (!r) return empty();
  const valid =
    typeof r.combatId === "string" &&
    !!r.combatId &&
    typeof r.combatantId === "string" &&
    !!r.combatantId &&
    Number.isSafeInteger(r.startRound) &&
    r.startRound >= 1 &&
    Number.isSafeInteger(r.dueRound) &&
    r.dueRound === r.startRound + 1 &&
    typeof r.id === "string" &&
    !!r.id &&
    [1, 2].includes(r.extraAttacks) &&
    r.penalty === r.extraAttacks * 2 &&
    Array.isArray(r.weaponIds) &&
    r.weaponIds.length === 2 &&
    r.weaponIds.every(v => typeof v === "string" && v) &&
    new Set(r.weaponIds).size === 2 &&
    Array.isArray(r.weaponProficiencies) &&
    r.weaponProficiencies.length === 2 &&
    r.weaponProficiencies.every(v => typeof v === "string" && v) &&
    r.atStartOfInitiative === true &&
    r.armedConfirmed === true;
  if (!valid)
    return { ...empty(), needsReview: true, reason: loc`The GC must review the saved two-weapon declaration.` };
  if (!ownCountDurationActive(r, system.twoWeaponCombatContext)) return empty();
  const capstone = classFeatureLevels(system)?.triggerman === 10,
    handguns = r.weaponProficiencies.filter(p => p === "handgun").length,
    mixedPending = capstone && handguns === 1;
  const handgunSkillWaiver = capstone && handguns === 2,
    allowedAttacks = r.extraAttacks;
  return {
    active: true,
    id: r.id,
    penalty: r.penalty,
    skillPenalty: handgunSkillWaiver ? 0 : r.penalty,
    extraAttacks: r.extraAttacks,
    allowedAttacks,
    handgunSkillWaiver,
    dueRound: r.dueRound,
    needsReview: mixedPending,
    reason: mixedPending ? loc`Resolve Both Guns Blazing’s mixed handgun/melee two-weapon scope before checks.` : ""
  };
}
/** Only the accepted two-weapon attack penalty is waived; unrelated conditions/recoil remain separate. */
export function twoWeaponHandgunWaiver(system, weapon) {
  const s = twoWeaponStyleState(system);
  return s.active && !s.needsReview && classFeatureLevels(system)?.triggerman === 10 && weapon.proficiency === "handgun"
    ? s.penalty
    : 0;
}

export function twoWeaponSkillNote(system) {
  const s = twoWeaponStyleState(system);
  return s.active
    ? s.skillPenalty
      ? loc`Two-weapon style: skill check penalty −${s.skillPenalty}. `
      : loc`Both Guns Blazing: two-weapon skill penalty waived. `
    : "";
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "twoWeaponStateRecord", order: 9785, record: ["twoWeaponFinalAttack"] });
