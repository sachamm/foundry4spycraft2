import { cakewalkSelectionPlan, cakewalkSelectionState, cakewalkMission } from "../rules/cakewalk.mjs";
import { SKILLS } from "../rules/tables.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";
import { sameValues } from "../rules/equal.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { queueResources } from "../services/transactions.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

export async function selectCakewalkSkills(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const system = () => ({
    ...actor.system,
    campaignEffects: currentCampaignRules().effects,
    usagePeriods: game.settings.get("spycraft2", "usagePeriods")
  });
  const snapshot = () => {
    const s = system();
    return {
      enabled: s.campaignEffects.cakewalkIntel === true,
      companionOf: s.companionOf ?? null,
      modifier: s.abilities?.int?.mod,
      epoch: cakewalkMission(s),
      record: s.cakewalkSkills ?? null
    };
  };
  const expected = structuredClone(snapshot()),
    state = cakewalkSelectionState(system());
  let input = options;
  if (!Array.isArray(input.skills)) {
    input = await systemDialog.input({
      window: { title: loc`Cakewalk mission skills` },
      rejectClose: false,
      ok: { label: loc`Record skills` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Choose up to ${Math.max(0, expected.modifier ?? 0)} skills during Intel. For this mission, their error range decreases by 2 (minimum 1), and taking 10 uses standard time.`}</p>${SKILLS.map(s => `<label><input name="skill-${s.key}" type="checkbox"${state.selected.includes(s.key) ? " checked" : ""} /> ${esc(CONFIG.SPYCRAFT.skills[s.key]?.name ?? s.key)}</label>`).join("")}<label><input name="intelPhaseConfirmed" type="checkbox" /> ${loc`These skills were chosen during this mission's Intel Phase`}</label>${game.user.isGM ? `<label><input name="review" type="checkbox" /> ${loc`Correct an existing mission selection`}</label><label>${loc`GC review note`} <input name="note" /></label>` : ""}</div>`
    });
    if (!input) return null;
    input.skills = SKILLS.filter(s => input[`skill-${s.key}`] === true).map(s => s.key);
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner || !sameValues(snapshot(), expected))
      throw Error(loc`The character, mission or prior Cakewalk choices changed. Review the current selection.`);
    const record = cakewalkSelectionPlan(system(), input, { isGM: game.user.isGM });
    try {
      await actor.update(recordReplacementPatch("system.cakewalkSkills", record, actor.system.cakewalkSkills));
    } catch (error) {
      if (!sameValues(actor.system.cakewalkSkills, record)) throw error;
    }
    return record;
  });
}
