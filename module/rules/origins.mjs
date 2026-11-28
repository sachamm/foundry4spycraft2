import { camouflageTerrain } from "./quality-checks.mjs";
import { resistanceType } from "./resistances.mjs";
import { evaluate } from "./formula.mjs";
import { loc } from "../i18n.mjs";
import { originRuleName } from "./rule-name.mjs";

const KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/** Resolve creation-time Origin selections without silently choosing for the player. */
export function resolveOriginChoices(item, system, items, cfg) {
  const rule = cfg.tables.originChoices?.[originRuleName(item)] ?? {};
  const choices = item.system.originChoices ?? {};
  const bonuses = [],
    pending = [],
    warnings = [];
  const level = system.progression?.length ?? 0;
  const count = 1 + Math.floor(level / 4);
  const bases = Object.fromEntries(KEYS.map(k => [k, system.abilities[k].base]));
  // A Specialty is applied after the Talent (creation steps 1 and 2).
  if (item.system.originType === "specialty") {
    for (const talent of items.filter(i => i.type === "origin" && i.system.originType === "talent")) {
      for (const bonus of talent.system.bonuses ?? []) {
        const key = bonus.target?.match(/^abilities\.(\w+)$/)?.[1];
        if (KEYS.includes(key)) bases[key] += evaluate(bonus.value);
      }
      if (cfg.tables.originChoices?.[originRuleName(talent)]?.attributes) {
        if (KEYS.includes(talent.system.originChoices?.up)) bases[talent.system.originChoices.up] += 2;
        if (KEYS.includes(talent.system.originChoices?.down)) bases[talent.system.originChoices.down] -= 2;
      }
    }
  }
  if (rule.attributes) {
    for (const [key, sign] of [
      ["up", 2],
      ["down", -2]
    ]) {
      const selected = choices[key];
      if (!KEYS.includes(selected)) {
        pending.push(`choose the ${sign > 0 ? "+2" : "−2"} attribute`);
        continue;
      }
      const high = rule.attributes === "highLow" ? key === "up" : rule.attributes === "lowHigh" ? key === "down" : null;
      const extreme = high === null ? null : (high ? Math.max : Math.min)(...Object.values(bases));
      if (extreme !== null && bases[selected] !== extreme) {
        warnings.push(
          loc`${item.name}: ${selected.toUpperCase()} must be ${high ? loc`a highest` : loc`a lowest`} creation attribute.`
        );
        continue;
      }
      if (rule.maxAttribute && sign > 0 && bases[selected] + sign > rule.maxAttribute) {
        warnings.push(loc`${item.name}: the attribute increase may not exceed ${rule.maxAttribute}.`);
        continue;
      }
      bonuses.push({ target: `abilities.${selected}`, value: String(sign) });
    }
  }
  for (const [kind, slots] of [
    ["classSkill", rule.classSkills === "scaling" ? count : (rule.classSkills ?? 0)],
    ["maxRank", rule.maxRankSkills === "scaling" ? count : 0]
  ]) {
    const selected = new Set();
    for (let index = 0; index < slots; index++) {
      const skill = choices[`${kind}${index}`];
      if (!cfg.skills[skill]) {
        pending.push(`choose ${kind === "classSkill" ? "class skill" : "maximum-rank skill"} ${index + 1}`);
        continue;
      }
      if (selected.has(skill)) {
        warnings.push(loc`${item.name}: choose different ${kind} skills.`);
        continue;
      }
      selected.add(skill);
      if (kind === "classSkill") {
        bonuses.push({ target: `skills.${skill}.classSkill`, value: "1", level: index * 4 });
        if (rule.classSkillCap) bonuses.push({ target: `skills.${skill}.cap`, value: "5", level: index * 4 });
      } else bonuses.push({ target: `skills.${skill}.maxRanks`, value: "1", level: index * 4 });
    }
  }
  if (rule.threatSkill) {
    if (cfg.skills[choices.threatSkill])
      bonuses.push({ target: `skills.${choices.threatSkill}.threat`, value: "1 + floor(@level / 5)" });
    else pending.push(loc`choose the skill with increased threat range`);
  }
  const notes = [];
  if (rule.npcQualities) {
    const selected = new Set(),
      camouflageSelections = new Set();
    for (let index = 0; index < rule.npcQualities; index++) {
      const key = choices[`npcQuality${index}`];
      const quality = cfg.tables.testSubjectQualities?.[key];
      if (!quality) {
        pending.push(loc`choose NPC quality ${index + 1} (GC approval required)`);
        continue;
      }
      // General NPC-quality rules allow repeated applications only when specified.
      if (selected.has(key) && !quality.repeatable) {
        warnings.push(loc`${item.name}: ${quality.label} may only be chosen once.`);
        continue;
      }
      selected.add(key);
      const terrain = key === "camouflaged" ? camouflageTerrain(choices[`npcDetails${index}`]) : null;
      if (key === "camouflaged" && !terrain) pending.push(loc`choose the terrain for quality ${index + 1}`);
      if (terrain && camouflageSelections.has(terrain)) {
        warnings.push(loc`${item.name}: Camouflaged must select different terrain types.`);
        continue;
      }
      if (terrain) camouflageSelections.add(terrain);
      const resistance = key === "damageResistance" ? resistanceType(choices[`npcDetails${index}`]) : null;
      if (key === "damageResistance" && !resistance) pending.push(loc`choose the damage type for quality ${index + 1}`);
      if (["augmented", "naturalAttack"].includes(key) && !String(choices[`npcDetails${index}`] ?? "").trim())
        pending.push(loc`choose the built-in item for quality ${index + 1}`);
      if (key !== "fleet") bonuses.push(...quality.bonuses);
      notes.push({
        qualityKey: key,
        terrain,
        resistanceType: resistance,
        source: item.name,
        name: quality.label,
        text: quality.notes,
        details: choices[`npcDetails${index}`] ?? ""
      });
    }
  }
  return { bonuses, pending, warnings, rule, notes };
}

/**
 * Test Subject's Augmented and Natural Attack (pp.446, 449): the chosen item is built in, so its wielder is always
 * proficient with it, readies it as a free action and cannot be disarmed of it. Returns the quality's label, or "".
 */
export function builtInQuality(system, item) {
  const npcSource = system.npcBuiltIn?.sources?.find(row => row.itemId === (item?.id ?? item?._id));
  if (npcSource) return npcSource.key === "augmented" ? loc`Augmented` : loc`Natural Attack`;
  const name = String(item?.name ?? "")
    .trim()
    .toLowerCase();
  if (!name) return "";
  const effect = (system?.originEffects ?? []).find(
    e =>
      ["augmented", "naturalAttack"].includes(e.qualityKey) &&
      String(e.details ?? "")
        .trim()
        .toLowerCase() === name
  );
  return effect?.name ?? "";
}
