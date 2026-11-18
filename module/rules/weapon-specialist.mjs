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
      result.warnings.push(`Weapon Specialist ${at}: invalid selection mode.`);
      continue;
    }
    if (field.needsProficiency) {
      const key = selection.proficiency;
      if (!key) result.pending.push(`Weapon Specialist ${at}: choose a possessed proficiency.`);
      else if (!cfg.proficiencies[key] || !system.proficiencyTotals?.[key]?.proficient)
        result.warnings.push(`Weapon Specialist ${at}: the selected proficiency must be possessed.`);
      else if (proficiencies.has(key)) result.warnings.push(`Weapon Specialist ${at}: choose a different proficiency.`);
      else proficiencies.add(key);
    }
    if (mode !== "proficiency") {
      const index = soldier.system.choiceSchedule?.findIndex(
        slot => slot.list === "weaponSpecialist" && slot.level === at
      );
      const value = soldier.system.choices?.[index],
        option = value == null || value === "" ? null : list?.options.find(option => option.index === Number(value));
      if (!option) result.pending.push(`Weapon Specialist ${at}: choose an ability.`);
      else if (selected.has(option.name))
        result.warnings.push(`Weapon Specialist ${at}: each ability may be chosen only once.`);
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
export function specialistDefense(system, proficiency) {
  return specialistApplies(system, { proficiency }, "Foibles")
    ? { dodge: 1, damageReduction: 1 }
    : { dodge: 0, damageReduction: 0 };
}
