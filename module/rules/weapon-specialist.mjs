import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
/** Soldier Weapon Specialist, pp.49–50. At 6 gain both; later gain one or the other. */
export function weaponSpecialist(system, items, cfg) {
  const result = { fields: [], proficiencies: [], abilities: [], pending: [], warnings: [] };
  const soldier = items.find(item => item.type === "class" && (item.system.identifier || item.name) === "soldier");
  const level = system.classLevels?.soldier ?? 0;
  if (!soldier || level < 6) return result;
  const list = soldier.system.choiceLists?.find(list => list.key === "weaponSpecialist");
  const selected = new Set(),
    proficiencies = new Set();
  for (const at of [6, 9, 12, 15, 18]) {
    if (at > level) continue;
    const selection = soldier.system.weaponSpecialist?.[at] ?? {},
      mode = at === 6 ? "both" : selection.mode || "ability";
    const field = {
      itemId: soldier.id,
      level: at,
      mode,
      first: at === 6,
      proficiency: selection.proficiency ?? "",
      needsProficiency: mode === "both" || mode === "proficiency"
    };
    result.fields.push(field);
    if (!["both", "ability", "proficiency"].includes(mode) || (at !== 6 && mode === "both")) {
      result.warnings.push(loc`Weapon Specialist ${at}: invalid selection mode.`);
      continue;
    }
    if (field.needsProficiency) {
      const key = selection.proficiency;
      if (!key) result.pending.push(loc`Weapon Specialist ${at}: choose a possessed proficiency.`);
      else if (!cfg.proficiencies[key] || !system.proficiencyTotals?.[key]?.proficient)
        result.warnings.push(loc`Weapon Specialist ${at}: the selected proficiency must be possessed.`);
      else if (proficiencies.has(key))
        result.warnings.push(loc`Weapon Specialist ${at}: choose a different proficiency.`);
      else proficiencies.add(key);
    }
    if (mode !== "proficiency") {
      const index = soldier.system.choiceSchedule?.findIndex(
        slot => slot.list === "weaponSpecialist" && slot.level === at
      );
      const value = soldier.system.choices?.[index],
        option = value == null || value === "" ? null : list?.options.find(option => option.index === Number(value));
      if (!option) result.pending.push(loc`Weapon Specialist ${at}: choose an ability.`);
      else if (selected.has(option.name))
        result.warnings.push(loc`Weapon Specialist ${at}: each ability may be chosen only once.`);
      else selected.add(option.name);
    }
  }
  result.proficiencies = [...proficiencies];
  result.abilities = [...selected];
  return result;
}
export function specialistApplies(system, weapon, ability) {
  return (
    system.weaponSpecialist?.proficiencies?.includes(weapon.proficiency) &&
    system.weaponSpecialist.abilities.includes(ability)
  );
}
/**
 * Foibles (p.50): +1 dodge bonus to Defense and DR 1/— more against attacks with weapons of the chosen proficiencies.
 * A character who has lost dodge bonuses (flat-footed, helpless) keeps only the DR.
 */
export function specialistDefense(system, proficiency, { vulnerable = system?.vulnerable === true } = {}) {
  if (!proficiency || !specialistApplies(system, { proficiency }, "Foibles")) return { dodge: 0, damageReduction: 0 };
  return { dodge: vulnerable ? 0 : 1, damageReduction: 1 };
}

// Weapon Specialist "No Worries" as part of an attack plan.
rollPipeline.register({
  id: "weaponSpecialistAttackTerm",
  kinds: ["attack"],
  order: 9130,
  terms({ system, weapon }) {
    return { errorReduction: specialistApplies(system, weapon, "No Worries") ? 2 : 0 };
  }
});
