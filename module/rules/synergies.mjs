const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
export function skillSynergy(
  system,
  check,
  { synergySkill = "auto", synergyFocus = "", synergyConditionMet = false, gcApprovedSynergy = false, maximum = 5 } = {}
) {
  if (synergySkill === "none" || check.mode.includes("Passive")) return { value: 0 };
  const rows = check.synergies ?? [],
    ownedFocus = (key, focus) =>
      (system.focusTotals?.[key] ?? system.focuses?.[key] ?? []).some(value => normal(value) === normal(focus));
  const eligible = row => {
    if (row.condition && !synergyConditionMet) return false;
    if (row.focusSkill) {
      const focus = row.focus || synergyFocus;
      if (!focus || !ownedFocus(row.skill, focus)) return false;
      if (synergyFocus && row.focus && normal(synergyFocus) !== normal(row.focus)) return false;
    }
    return true;
  };
  if (synergySkill === "auto") {
    const available = rows
      .filter(row => !row.condition && eligible(row))
      .map(row => ({
        value: Math.min(maximum, Math.floor((system.skillTotals?.[row.skill]?.ranks ?? 0) / 5)),
        skill: row.skill,
        focus: row.focus || synergyFocus
      }));
    return available.sort((a, b) => b.value - a.value)[0] ?? { value: 0 };
  }
  const skill = system.skillTotals?.[synergySkill];
  if (!skill) return { value: 0, reason: "Choose an existing skill for synergy." };
  const matches = rows.filter(row => row.skill === synergySkill);
  if (!matches.length && !gcApprovedSynergy)
    return { value: 0, reason: "This synergy is not listed for the chosen use; GC approval is required (p.92)." };
  const candidates = matches.length ? matches : [{ skill: synergySkill, focusSkill: skill.focus, condition: "" }];
  const row = candidates.find(eligible);
  if (!row)
    return {
      value: 0,
      reason: `The chosen synergy needs its listed circumstances and an owned applicable focus: ${
        matches
          .map(row => [row.focus, row.condition].filter(Boolean).join(" — "))
          .filter(Boolean)
          .join("; ") ||
        synergyFocus ||
        "select the applicable focus"
      }.`
    };
  return {
    value: Math.min(maximum, Math.floor(skill.ranks / 5)),
    skill: synergySkill,
    focus: row.focus || synergyFocus
  };
}
