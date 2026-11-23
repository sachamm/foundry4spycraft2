import { readiedMeleeFeatSource } from "./readied-weapons.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Readied melee feat skill benefits, pp.176,179–180. Other benefits remain separate. */
const definitions = [
  { name: "Axe Basics", family: "axe", scopes: ["trip"], bonus: 1 },
  { name: "Spear Basics", family: "spear", scopes: ["trip", "bull-rush"], bonus: 2 },
  { name: "Whip Basics", family: "whip", scopes: ["trip", "jump"], bonus: 2 },
  { name: "Staff Basics", family: "staff", scopes: ["jump"], bonus: 3 },
  { name: "Hammer Basics", family: "hammer", scopes: ["intimidate"], bonus: 2 },
  { name: "Great Sword Basics", family: "twoHandedSword", scopes: ["trip-defense"], bonus: 2 }
];
/** Exact currently implemented uses; caller combatAction/role cannot widen scope. */
export function meleeSkillScope(key, check) {
  if (key === "acrobatics" && ["trip", "counter-trip"].includes(check?.id)) return "trip";
  if (key === "acrobatics" && check?.id === "resist-trip") return "trip-defense";
  if (key === "acrobatics" && check?.id === "jump") return "jump";
  if (
    (key === "athletics" && ["bull-rush", "resist-bull-rush"].includes(check?.id)) ||
    (["acrobatics", "drive", "survival", "tactics"].includes(key) && check?.id === "conveyance-bull-rush")
  )
    return "bull-rush";
  if (key === "intimidate") return "intimidate";
  return "";
}
export function meleeSkillFeatPlan(system, key, check) {
  const scope = meleeSkillScope(key, check),
    empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (!scope) return empty;
  const relevant = definitions.filter(
    d => d.scopes.includes(scope) || (scope === "trip-defense" && d.scopes.includes("trip"))
  );
  const sources = [];
  try {
    for (const d of relevant) {
      const source = readiedMeleeFeatSource(system, d);
      if (source) sources.push(source);
    }
  } catch (error) {
    return { ...empty, blockedReason: error.message };
  }
  const evidence = { version: 1, skillKey: key, checkId: check.id, scope, sources };
  return {
    ...empty,
    evidence,
    bonuses: sources.map(s => ({ source: s.feat, type: "gear", value: s.bonus })),
    notes: sources.map(
      s =>
        loc`${s.feat}: +${s.bonus} gear with this ${scope} skill check while holding a readied ${s.family}; gear bonuses do not stack (pp.176,179–180,329).`
    )
  };
}
export function validateMeleeSkillFeatProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const p = meleeSkillFeatPlan(system, skillKey, { id: checkId });
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(loc`The readied melee weapon, qualified feat or named skill use changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "meleeSkillFeat",
  order: 1380,
  record: ["meleeSkillFeats"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateMeleeSkillFeatProof(actor.system, options.meleeSkillFeats, { checkKind, skillKey, checkId })
});

// The melee feats' bonuses to named skill checks.
rollPipeline.register({
  id: "meleeSkillFeatsSkillTerm",
  kinds: ["skill"],
  order: 9230,
  terms({ system, skillKey, check }) {
    const plan = meleeSkillFeatPlan(system, skillKey, check);
    return skillPlanTerm("meleeSkillFeats", plan, { noteAt: 40, blockAt: 20, bonusAt: 120 });
  }
});
