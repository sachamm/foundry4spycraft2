import { skillConditionEntries, substituteConditionedBonus } from "./skill-conditions.mjs";
import { stackedBonuses } from "./knowledge.mjs";
import { resolveSkillCheck } from "./skills.mjs";
/** Retain named-check modifiers, applying normal typed stacking against the replacement bonus. */
export function substituteSkillBonus(source, result, { modifier = 0 } = {}) {
  const normal = source.normalSkillBonus ?? source.skillBonus ?? source.total,
    entries = source.skillBonusEntries ?? [],
    checks = result.checkBonusEntries ?? [],
    nonSynergy = checks.filter(e => e.type !== "synergy");
  const preservedSkill = stackedBonuses([...entries, ...nonSynergy]) - stackedBonuses(entries),
    preservedCheck = stackedBonuses([...entries, ...checks]) - stackedBonuses([...entries, ...nonSynergy]);
  const adjusted = substituteConditionedBonus(source, result, normal, preservedSkill, preservedCheck),
    { bonus, preservedBonus } = adjusted,
    preservedAdjustment = result.checkAdjustment ?? (Number(modifier) || 0),
    total = bonus + preservedBonus + preservedAdjustment;
  if (!Number.isFinite(total))
    throw new Error("Review the replacement skill bonus and check modifiers before rolling.");
  return { bonus, preservedBonus, preservedAdjustment, total, skillBonusCondition: adjusted.condition };
}
/** Virtuoso 10, p.85: substitute the key skill's total bonus, not its threat/cap/error rules. */
export function breakthroughPlan(
  system,
  items,
  cfg,
  result,
  { checkKind = "skill", sourceAbility = "", modifier = 0 } = {}
) {
  if (
    (system.classLevels?.virtuoso ?? 0) < 10 ||
    !["skill", "knowledge"].includes(checkKind) ||
    (checkKind === "skill" && !["int", "wis"].includes(result?.ability))
  )
    throw new Error("Breakthrough requires Virtuoso 10 and an INT/WIS skill or Knowledge check.");
  const virtuoso = items.find(i => i.type === "class" && i.system.identifier === "virtuoso"),
    key = virtuoso?.system.keySkill,
    skill = system.skillTotals?.[key];
  if (!cfg.skills[key] || !skill || skill.ranks < 6)
    throw new Error("Choose a valid Virtuoso key skill with at least six ranks.");
  const ability = sourceAbility || skill.ability || skill.totals?.[0]?.ability;
  if (!skill.totals?.some(row => row.ability === ability))
    throw new Error("Choose an attribute used by the key skill.");
  const focus = skill.focus ? virtuoso.system.keyFocus || "" : "";
  const source = resolveSkillCheck(
    system,
    key,
    {
      id: "breakthroughSource",
      name: "Breakthrough source",
      attributes: [ability],
      error: 1,
      tags: "",
      mode: "Active",
      time: "Free action",
      page: 85
    },
    { ability, focus, synergySkill: "none" }
  );
  if (!source || source.blocked || source.missingFocus)
    throw new Error("Complete the key skill and its chosen focus before using Breakthrough.");
  const replacement = substituteSkillBonus(source, result, { modifier }),
    { total } = replacement;
  const record = {
    skill: key,
    focus,
    ability,
    ...replacement,
    replacedTotal: result.total,
    replacedSkillBonus: result.skillBonus ?? result.total
  };
  return {
    ...result,
    total,
    breakthrough: record,
    notes: `${result.notes ?? ""} Breakthrough: substitute ${skill.name ?? key}${focus ? ` (${focus})` : ""} (${ability.toUpperCase()}) total bonus ${replacement.bonus}; check modifiers ${replacement.preservedBonus + replacement.preservedAdjustment >= 0 ? "+" : ""}${replacement.preservedBonus + replacement.preservedAdjustment} retained with normal named-bonus stacking. Target skill threat, error, cap and action permissions remain in effect (pp.85,87,92,101).`
  };
}

/** Perfect Killer: Nest, p.80. The replacement does not change Hide's key attribute. */
export function nestPlan(
  system,
  cfg,
  result,
  { skillKey = "", checkId = "", halfCoverConfirmed = false, sourceAbility = "", breakthrough = false } = {}
) {
  if (
    (system.classLevels?.sniper ?? 0) < 4 ||
    !(system.classOptionSelections ?? []).some(s => s.classId === "sniper" && s.name === "Nest")
  )
    throw new Error("Nest requires the earned Sniper Perfect Killer choice.");
  if (skillKey !== "sneak" || checkId !== "hide")
    throw new Error("Nest applies to Hide checks to avoid being spotted, not Stash Item or other skills.");
  if (halfCoverConfirmed !== true)
    throw new Error("Confirm at least half cover and that this Hide check avoids being spotted.");
  if (breakthrough) throw new Error("Choose Nest or Breakthrough to replace the skill bonus.");
  const skill = system.skillTotals?.tactics,
    ability = sourceAbility || skill?.ability || skill?.totals?.[0]?.ability;
  const row = skill?.totals?.find(t => t.ability === ability);
  if (!cfg.skills.tactics.abilities.includes(ability) || !Number.isFinite(row?.total))
    throw new Error("Choose a valid Tactics attribute and review its skill bonus.");
  const replacement = substituteSkillBonus(
    {
      normalSkillBonus: row.normalSkillBonus ?? row.total,
      skillBonus: row.skillBonus ?? row.total,
      skillBonusEntries: skillConditionEntries(system, skill.bonusEntries ?? []),
      skillBonusCondition: result.skillBonusCondition
    },
    result
  );
  return {
    ...result,
    total: replacement.total,
    nest: {
      skill: "tactics",
      ability,
      halfCoverConfirmed: true,
      ...replacement,
      replacedTotal: result.total,
      replacedSkillBonus: result.skillBonus ?? result.total
    },
    notes: `${result.notes ?? ""} Nest: at least half cover; Tactics (${ability.toUpperCase()}) skill bonus ${replacement.bonus} replaces Sneak's bonus to avoid being spotted. Hide's attribute, check modifiers, threat, error and cap remain in effect (p.80).`
  };
}
