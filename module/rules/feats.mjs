import { candidatePlan } from "./candidate.mjs";
import { armorTypeChoice } from "./armor-training.mjs";
import { evaluate } from "./formula.mjs";
import { loc } from "../i18n.mjs";
const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/** Canonical category used by Extra Gear benefits and source-specific prerequisites. */
export function extraGearCategory(choice) {
  const categories = {
      electronics: "E",
      gadgets: "G",
      resources: "R",
      security: "S",
      tradecraft: "T",
      vehicles: "V",
      weapons: "W"
    },
    text = String(choice ?? "").trim();
  return (
    categories[normal(text)] ?? (Object.values(categories).includes(text.toUpperCase()) ? text.toUpperCase() : null)
  );
}

/** Chosen feat benefits; one embedded item represents one feat selection. */
export function resolveFeatChoices(feat, system, items, cfg, active) {
  const name = feat.name,
    choice = feat.system.choice ?? "";
  const virtuoso = items.find(
    i =>
      i.type === "class" &&
      (i.system.identifier || i.name) === "virtuoso" &&
      system.classLevels?.virtuoso &&
      cfg.skills[i.system.keySkill]
  );
  const pairs = {
    ...(cfg.tables.basicSkillFeats ?? {}),
    ...(virtuoso ? { "Field of Expertise": [...new Set([virtuoso.system.keySkill, "profession"])] } : {})
  };
  const basic = Object.keys(pairs).find(key => normal(key) === normal(choice));
  const skill = cfg.skills[choice]
    ? choice
    : Object.values(cfg.skills).find(s => normal(s.name) === normal(choice))?.key;
  const bonuses = [],
    pending = [],
    warnings = [],
    linkedSkills = [];
  const activeFeat = name => items.find(i => i.type === "feat" && normal(i.name) === normal(name) && active.has(i.id));
  const hasChosen = (name, target) =>
    items.some(
      i => i.type === "feat" && i.name === name && normal(i.system.choice) === normal(target) && active.has(i.id)
    );
  const add = (target, value, bonusType = "") => bonuses.push({ target, value: String(value), bonusType });
  if (name === "Candidate") {
    try {
      bonuses.push(...candidatePlan(system, feat).bonuses);
    } catch (error) {
      pending.push(error.message);
    }
  }
  const uniqueChoices = [
    "Advanced Skill Mastery",
    "Grand Skill Mastery",
    "Perfect Skill Mastery",
    "False Start",
    "Mark of a Professional",
    "Weapon Focus"
  ];
  if (
    uniqueChoices.includes(name) &&
    choice &&
    items
      .slice(
        0,
        items.findIndex(i => i.id === feat.id)
      )
      .some(i => i.type === "feat" && i.name === name && normal(i.system.choice) === normal(choice) && active.has(i.id))
  )
    return { bonuses, pending, warnings: [loc`${name}: choose a different target for each selection.`], linkedSkills };
  const mastery = {
    "Advanced Skill Mastery": [3, 18],
    "Grand Skill Mastery": [4, 17],
    "Perfect Skill Mastery": [5, 16]
  };
  if (
    name in mastery ||
    ["Talented", "False Start", "Mark of a Professional", "Practice Makes Perfect"].includes(name)
  ) {
    if (!basic) pending.push("choose a Basic Skill feat in the feat's Choice field");
    else {
      const skills = pairs[basic];
      if (name !== "Talented" && !activeFeat(basic) && !(basic === "Field of Expertise" && virtuoso))
        warnings.push(loc`${name}: the chosen Basic Skill feat (${basic}) must be possessed and usable.`);
      else if (name === "Talented") {
        for (const key of skills) {
          add(`skills.${key}.classSkill`, 1);
          add(`skills.${key}.cap`, 5);
        }
        linkedSkills.push(skills);
      } else if (name in mastery) {
        const previous =
          name === "Grand Skill Mastery"
            ? "Advanced Skill Mastery"
            : name === "Perfect Skill Mastery"
              ? "Grand Skill Mastery"
              : null;
        if (previous && !hasChosen(previous, basic))
          warnings.push(loc`${name}: choose the same Basic Skill feat as its prerequisite mastery.`);
        else
          for (const key of skills) {
            add(`skills.${key}.misc`, mastery[name][0], "insight");
            add(`skills.${key}.baseThreat`, mastery[name][1]);
          }
      } else if (name === "Mark of a Professional") {
        if (!hasChosen("False Start", basic))
          warnings.push(loc`${name}: choose the same Basic Skill feat as a possessed False Start selection.`);
        else
          for (const key of skills) {
            add(`skills.${key}.errorReduction`, 1);
            add(`skills.${key}.errorFloor`, 1);
          }
      } else if (name === "Practice Makes Perfect" && !hasChosen("Mark of a Professional", basic))
        warnings.push(loc`${name}: choose the same Basic Skill feat as a possessed Mark of a Professional selection.`);
    }
  }
  if (["Armor Basics", "Armor Mastery"].includes(name) && !activeFeat("Armor Supremacy")) {
    const type = armorTypeChoice(choice);
    if (!type) pending.push(loc`choose an armor type: partial, moderate or full`);
    else if (name === "Armor Mastery" && armorTypeChoice(activeFeat("Armor Basics")?.system.choice) === type)
      warnings.push(loc`Armor Mastery: choose an additional armor type different from Armor Basics.`);
  }
  if (name === "Extra Gear") {
    const key = extraGearCategory(choice);
    if (!key)
      pending.push(
        loc`choose an Extra Gear category: Electronics, Gadgets, Resources, Security, Tradecraft, Vehicles or Weapons`
      );
    else if (
      items.some(
        other =>
          other.id !== feat.id &&
          other.type === "feat" &&
          other.name === name &&
          active.has(other.id) &&
          extraGearCategory(other.system.choice) === key
      )
    )
      warnings.push(loc`Extra Gear: each selection must choose a new category.`);
    else add(`gear.${key}`, 1);
  }
  if (name === "Unlocked Potential") {
    if (!skill) pending.push("choose the skill for Unlocked Potential");
    else {
      add(`skills.${skill}.classSkill`, 1);
      add(`skills.${skill}.maxRanks`, 3);
    }
  }
  if (name === "Weapon Focus") {
    const key = cfg.proficiencies[choice]
      ? choice
      : Object.keys(cfg.proficiencies).find(k => normal(cfg.proficiencies[k].label) === normal(choice));
    if (!key || key === "unarmed") pending.push("choose a possessed weapon proficiency other than Unarmed");
    else if (
      !system.proficiencies?.[key]?.proficient &&
      !items.some(
        i =>
          i.type === "origin" &&
          i.system.bonuses?.some(b => b.target === `prof.${key}` && evaluate(b.value, { level: system.level }) > 0)
      )
    )
      warnings.push(loc`Weapon Focus: ${choice} proficiency is required.`);
    else add(`forte.${key}`, 1);
  }
  if (name === "Martial Arts") {
    const key = ["str", "dex", "con", "int", "wis", "cha"].includes(choice) ? choice : null;
    if (!key) pending.push(loc`choose an attribute (str, dex, con, int, wis or cha)`);
    else {
      add("unarmedDie", 6);
      add("unarmedBaseThreat", 19);
      if (!activeFeat("Master's Art")) {
        if (key === "str") {
          add("defense", "@abilities.str.mod - @abilities.dex.mod");
          add("initiative", "@abilities.str.mod - @abilities.dex.mod");
        } else {
          add("unarmedAttack", `@abilities.${key}.mod - @abilities.str.mod`);
          add("unarmedDamage", `@abilities.${key}.mod - @abilities.str.mod`);
        }
      }
    }
  }
  if (name === "Master's Art") {
    const key = activeFeat("Martial Arts")?.system.choice;
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(key))
      pending.push("choose the Martial Arts attribute first");
    else {
      for (const target of ["unarmedAttack", "unarmedDamage", "defense", "initiative"])
        add(target, `@abilities.${key}.mod`);
      add("unarmedBaseThreat", 17);
      add("unarmedExtraDice", 1);
    }
  }
  return { bonuses, pending, warnings, linkedSkills };
}
