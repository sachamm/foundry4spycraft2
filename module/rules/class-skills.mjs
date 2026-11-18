import { loc } from "../i18n.mjs";
/** Keep saved array indices stable while processing/displaying milestones in chronological order. */
export const orderedClassChoices = item =>
  (item.system.choiceSchedule ?? [])
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => a.slot.level - b.slot.level || a.index - b.index);
/** Targeted class skills: individual class descriptions, pp.31,35–52. */
export function classSkillSelections(item, classLevel) {
  const id = item.system.identifier || item.name,
    fields = [];
  const versatility =
    id === "pointman"
      ? [
          [1, 4],
          [5, 1],
          [10, 1],
          [15, 1],
          [20, 1]
        ]
      : id === "virtuoso"
        ? [
            [2, 2],
            [7, 2]
          ]
        : [];
  for (const [level, count] of versatility)
    if (classLevel >= level)
      for (let n = 0; n < count; n++)
        fields.push({
          key: `versatility${level}_${n}`,
          level,
          name: loc`Versatility`,
          anySkill: true,
          grantsClassSkill: true,
          versatility: true,
          ordinal: n + 1
        });
  if (id === "advocate")
    for (const level of [4, 8, 12, 16, 20])
      if (classLevel >= level)
        fields.push({
          key: `byAnyMeans${level}`,
          level,
          name: loc`By Any Means`,
          anySkill: true,
          grantsClassSkill: true
        });
  const lists = Object.fromEntries((item.system.choiceLists ?? []).map(list => [list.key, list]));
  const used = new Set();
  orderedClassChoices(item).forEach(({ slot, index }) => {
    if (slot.level > classLevel) return;
    const pick = item.system.choices?.[index];
    if (pick == null || pick === "") return;
    const list = lists[slot.list],
      option = list?.options.find(o => o.index === Number(pick));
    if (option?.name !== "Skill Mastery" || used.has(slot.list)) return;
    used.add(slot.list);
    fields.push({
      key: `choice${index}`,
      level: slot.level,
      name: loc`Skill Mastery`,
      anySkill: false,
      grantsClassSkill: false
    });
  });
  return fields;
}

export function resolveClassSkillSelections(items, progression, cfg, isClassSkill) {
  const rules = [],
    pending = [],
    // The same reminders with a wording for several at once, for the setup checklist.
    pendingTasks = [],
    warnings = [];
  for (const item of items.filter(i => i.type === "class")) {
    const classId = item.system.identifier || item.name;
    const careers = progression.flatMap((entry, index) => (entry.classId === classId ? [index + 1] : []));
    const selected = new Map();
    for (const field of classSkillSelections(item, careers.length)) {
      const skill = item.system.skillChoices?.[field.key],
        career = careers[field.level - 1];
      if (!skill) {
        const text = loc`${item.name}: choose a skill for ${field.name} at class level ${field.level}.`;
        pending.push(text);
        pendingTasks.push({
          text,
          plural: count =>
            loc`${item.name}: choose ${count} more skills for ${field.name} at class level ${field.level}.`
        });
        continue;
      }
      if (!cfg.skills[skill]) {
        warnings.push(loc`${item.name}: ${field.name} has an unknown skill selection.`);
        continue;
      }
      if (field.versatility && isClassSkill(skill, career, item)) {
        warnings.push(loc`${item.name}: Versatility must select a cross-class skill at acquisition.`);
        continue;
      }
      if (!field.anySkill && !isClassSkill(skill, career, item)) {
        warnings.push(loc`${item.name}: ${field.name} requires one of that class's skills at acquisition.`);
        continue;
      }
      const seen = selected.get(field.name) ?? new Set();
      if (seen.has(skill)) {
        warnings.push(loc`${item.name}: ${field.name} cannot select ${cfg.skills[skill].name} more than once.`);
        continue;
      }
      seen.add(skill);
      selected.set(field.name, seen);
      rules.push({
        classId,
        skill,
        career,
        classLevel: field.level,
        name: field.name,
        source: `${item.name}: ${field.name}`,
        grantsClassSkill: field.grantsClassSkill,
        errorReduction: field.versatility ? 0 : 2,
        take10Normal: !field.versatility
      });
    }
  }
  return { rules, pending, pendingTasks, warnings };
}
