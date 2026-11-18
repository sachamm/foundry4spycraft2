import { loc } from "../i18n.mjs";
/** Cross-class ability choices, pp.40–41; assumed-level clarification in Second Printing p.40. */
const menus = {
  "Advocate:Networks": "network",
  "Explorer:Bonus feat": "bonusFeat",
  "Faceman:Masks": "masks",
  "Hacker:Bonus feat": "bonusFeat",
  "Intruder:Bonus feat": "bonusFeat",
  "Scientist:Intense study": "intenseStudy",
  "Scout:Bonus feat": "bonusFeat",
  "Sleuth:Bonus feat": "bonusFeat",
  "Snoop:Bonus feat": "bonusFeat",
  "Soldier:Fight on": "fightOn",
  "Wheelman:Driving school": "crashCourse"
};
export function inheritedClassFeatures(items, progression, cfg) {
  const result = { entries: [], sources: [], featSources: [], grants: [], skillRules: [], pending: [], warnings: [] };
  const counts = {};
  for (const entry of progression) counts[entry.classId] = (counts[entry.classId] ?? 0) + 1;
  for (const owner of items.filter(i => i.type === "class")) {
    const ownerClass = owner.system.identifier || owner.name,
      careers = progression.flatMap((entry, index) => (entry.classId === ownerClass ? [index + 1] : []));
    const lists = Object.fromEntries((owner.system.choiceLists ?? []).map(list => [list.key, list])),
      taken = new Map();
    (owner.system.choiceSchedule ?? []).forEach((slot, index) => {
      const list = lists[slot.list];
      if (list?.kind !== "crossClass" || slot.level > careers.length) return;
      const pick = owner.system.choices?.[index];
      if (pick == null || pick === "") return;
      const option = list.options.find(o => o.index === Number(pick));
      if (!option) return;
      const n = taken.get(option.abilityId) ?? 0;
      taken.set(option.abilityId, n + 1);
      if (n >= (option.maxSelections ?? 1) || (counts[option.classId] ?? 0) >= option.assumedClassLevel) return;
      const template = cfg.classFeatures?.[option.classId],
        key = `cross${index}`,
        selection = owner.system.inheritedChoices?.[key] ?? {};
      const entry = {
        ownerId: owner.id,
        ownerClass,
        key,
        index,
        classLevel: slot.level,
        career: careers[slot.level - 1],
        name: option.name,
        emulatedClass: option.classId,
        assumedLevel: option.assumedClassLevel
      };
      const bonuses = [];
      const addSkill = (skill, name, grantsClassSkill) => {
        result.skillRules.push({
          classId: option.classId,
          classLevel: option.assumedClassLevel,
          career: entry.career,
          sourceClassId: ownerClass,
          sourceClassLevel: slot.level,
          skill,
          name,
          source: `${owner.name}: ${option.name}`,
          grantsClassSkill,
          errorReduction: 2,
          take10Normal: true
        });
      };
      if (option.abilityId === "Soldier:Fortunes of war I")
        bonuses.push({ target: "naturalDR", value: "1", bonusType: "class:Fortunes of War" });
      if (option.abilityId === "Faceman:1,000 faces")
        result.grants.push({ name: "Flawless Identity", source: `${owner.name}: ${option.name}`, level: entry.career });
      const menuKey = menus[option.abilityId],
        menu = template?.choiceLists.find(list => list.key === menuKey);
      if (menu) {
        entry.menu = menu;
        entry.option = selection.option ?? "";
        const selected =
          selection.option == null || selection.option === ""
            ? null
            : menu.options.find(o => o.index === Number(selection.option));
        if (!selected) result.pending.push(loc`${owner.name}: choose an option for ${option.name}.`);
        else {
          entry.selectedName = selected.name;
          bonuses.push(...(selected.bonuses ?? []));
          if (selected.name === "Skill Mastery") {
            entry.skillChoice = true;
            entry.skill = selection.skill ?? "";
            entry.skillOptions = template.classSkills;
            if (!cfg.skills[selection.skill])
              result.pending.push(
                loc`${owner.name}: choose the ${template.name} class skill for inherited Skill Mastery.`
              );
            else if (!template.classSkills.includes(selection.skill))
              result.warnings.push(loc`${owner.name}: inherited Skill Mastery must use an emulated class skill.`);
            else addSkill(selection.skill, "Skill Mastery", false);
          }
          for (const bonus of selected.bonuses ?? []) {
            const tree = bonus.target.match(/^featSlots\.(\w+)$/)?.[1];
            if (!tree) continue;
            for (let n = 0; n < Number(bonus.value); n++)
              result.featSources.push({
                id: `${owner.id}:${key}:${n}`,
                classId: ownerClass,
                classLevel: slot.level,
                career: entry.career,
                tree,
                levelAllowance: menuKey === "intenseStudy" ? 2 : 0,
                label: `${owner.name} ${slot.level}: ${option.name} — ${selected.name}`
              });
          }
        }
      }
      if (option.abilityId === "Advocate:By any means" || option.abilityId === "Scientist:Ph.D. (1 skill)") {
        entry.skillChoice = true;
        entry.skill = selection.skill ?? "";
        entry.skillOptions = option.classId === "scientist" ? (template?.classSkills ?? []) : Object.keys(cfg.skills);
        if (!cfg.skills[selection.skill]) result.pending.push(`${owner.name}: choose a skill for ${option.name}.`);
        else if (!entry.skillOptions.includes(selection.skill))
          result.warnings.push(loc`${owner.name}: inherited Ph.D. must choose a Scientist class skill.`);
        else if (option.classId === "scientist")
          bonuses.push({ target: `skills.${selection.skill}.maxRanks`, value: "5" });
        else addSkill(selection.skill, "By Any Means", true);
      }
      result.entries.push(entry);
      if (bonuses.length)
        result.sources.push({
          name: `${owner.name}: ${option.name}`,
          bonuses,
          rank: 1,
          classId: ownerClass,
          requiredClassLevel: slot.level
        });
    });
  }
  return result;
}
