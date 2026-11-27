import { SKILLS } from "./tables.mjs";
import { loc } from "../i18n.mjs";

const keys = new Set(SKILLS.map(skill => skill.key));
export const cakewalkMission = system => String(system.usagePeriods?.mission ?? "initial");
export function cakewalkSelectionState(system) {
  const enabled = system.campaignEffects?.cakewalkIntel === true && !system.companionOf && !system.npcType,
    record = system.cakewalkSkills,
    current = record?.epoch === cakewalkMission(system),
    valid =
      current &&
      record.version === 1 &&
      Number.isSafeInteger(record.intelligenceModifier) &&
      Array.isArray(record.skills) &&
      new Set(record.skills).size === record.skills.length &&
      record.skills.length <= Math.max(0, record.intelligenceModifier) &&
      record.skills.every(key => keys.has(key));
  return { enabled, selected: valid ? record.skills : [], recorded: !!valid, needsReview: !!current && !valid };
}

export function cakewalkSelectionPlan(
  system,
  { skills, intelPhaseConfirmed, review = false, note = "" } = {},
  { isGM = false } = {}
) {
  const state = cakewalkSelectionState(system),
    modifier = system.abilities?.int?.mod;
  if (!state.enabled)
    throw Error(loc`Cakewalk Intel selections apply only to player characters while Cakewalk is active.`);
  if (intelPhaseConfirmed !== true)
    throw Error(loc`Confirm that these skills were chosen during this mission's Intel Phase.`);
  if (!Number.isSafeInteger(modifier)) throw Error(loc`Review Intelligence before choosing Cakewalk skills.`);
  if (
    !Array.isArray(skills) ||
    skills.some(key => !keys.has(key)) ||
    new Set(skills).size !== skills.length ||
    skills.length > Math.max(0, modifier)
  )
    throw Error(loc`Choose distinct skills, up to the Intelligence modifier (minimum zero).`);
  if (state.recorded || state.needsReview) {
    if (!isGM || review !== true || !String(note).trim())
      throw Error(
        loc`Cakewalk skills are already recorded for this mission. The GC may correct them with a review note.`
      );
  }
  return {
    version: 1,
    epoch: cakewalkMission(system),
    intelligenceModifier: modifier,
    skills: [...skills].sort(),
    ...(review ? { note: String(note).trim() } : {})
  };
}

export function cakewalkSkillSelected(system, key) {
  const state = cakewalkSelectionState(system);
  return state.enabled && state.selected.includes(key);
}
