import { armorTotals } from "./gear.mjs";
import { armorTrainingDRForAttack, armorTrainingRules } from "./armor-training.mjs";
import { ruleName } from "./rule-name.mjs";

/** Owned armor uses the same slots, availability and training as agent armor (pp.225,284,447). */
export function npcArmorPlan(system, items = []) {
  const feats = items.map((item, index) => ({
    type: item.type,
    system: item.system,
    id: item.id ?? item._id ?? String(index),
    name: ruleName(item)
  }));
  const armorTraining = armorTrainingRules(feats, new Set(feats.map(item => item.id)));
  const equipped = armorTotals(items, { armorTraining });
  const armor = equipped.armor;
  const natural = system.qualityEffects?.damageReduction ?? 0;
  const fields = {
    armor,
    armorTraining,
    armorFeatRules: armor?.training ?? {},
    damageReductionComponents: {
      natural,
      class: 0,
      feat: 0,
      armorMelee: armor?.dr ?? 0,
      armorOther: armor?.drRanged ?? 0
    },
    dr: { melee: Math.max(natural, armor?.dr ?? 0), other: Math.max(natural, armor?.drRanged ?? 0) }
  };
  fields.armorDRByAttack = Object.fromEntries(
    ["unarmed", "meleeWeapon", "hurledWeapon", "rangedWeapon", "other"].map(kind => [
      kind,
      armorTrainingDRForAttack(fields, kind)
    ])
  );
  return {
    fields,
    warnings: equipped.warnings,
    defense: armor?.defense ?? 0,
    reflex: armor?.check ?? 0,
    speed: armor?.speed ?? 0
  };
}
