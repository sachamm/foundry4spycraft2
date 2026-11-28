/** NPC feat purchases: retain feat prerequisites, waive numerical requirements (p.447). */
import { checkPrerequisites } from "./prerequisites.mjs";
import { NPC_RULES } from "./npc-tables.mjs";
import { ruleName } from "./rule-name.mjs";

const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const treeKey = value => normal(value).replace(/[^a-z]/g, "");
const featData = feat => feat.system ?? feat;
const waived = new Set([
  "base",
  "level",
  "ability",
  "skill",
  "proficiency",
  "focus",
  "sneakAttack",
  "lifestyle",
  "keySkill",
  "manual"
]);

export function npcFeatPrerequisiteTree(node) {
  if (!node || waived.has(node.type)) return null;
  if (["all", "any"].includes(node.type)) {
    const of = (node.of ?? []).map(npcFeatPrerequisiteTree).filter(Boolean);
    return of.length ? { ...node, of } : null;
  }
  // Preserve named feats, chosen feats and feat-tree counts. Unknown requirements fail validation.
  return node;
}

export function npcFeatLimit(qualities = []) {
  const ids = new Set(qualities.map(quality => quality.id));
  return ids.has("mastermind") ? 15 : ids.has("henchman") || ids.has("foil") ? 10 : 5;
}

const skillChoices = new Set([
  "Advanced Skill Mastery",
  "Grand Skill Mastery",
  "Perfect Skill Mastery",
  "False Start",
  "Mark of a Professional",
  "Practice Makes Perfect"
]);

/** Validate a whole purchase, independent of list order; no feat may supply its own prerequisite. */
export function validateNpcFeats(selections, catalog, { qualities = [] } = {}) {
  const errors = [],
    resolved = [],
    counts = new Map();
  const cost = NPC_RULES.qualities.find(quality => quality.id === "feat").cost;
  if (selections.length > npcFeatLimit(qualities))
    errors.push(`At most ${npcFeatLimit(qualities)} feat purchases are allowed.`);
  for (const selection of selections) {
    const source = catalog.find(feat => normal(ruleName(feat)) === normal(selection.name));
    if (!source) {
      errors.push(`Unknown feat: ${selection.name}.`);
      continue;
    }
    const data = featData(source),
      name = ruleName(source),
      choice = String(selection.choice ?? "").trim();
    const held = counts.get(name) ?? [];
    if (held.length && (!data.repeatable || held.includes(normal(choice))))
      errors.push(`${name}: duplicate feat selection.`);
    held.push(normal(choice));
    counts.set(name, held);
    if (data.maxSelections > 0 && held.length > data.maxSelections) errors.push(`${name}: selection limit exceeded.`);
    if (
      data.grantsNpcQuality ||
      data.npcQualityGrants?.length ||
      source.flags?.spycraft2?.grantsNpcQuality ||
      (data.bonuses ?? []).some(bonus => /npcQualit/i.test(bonus.target))
    ) {
      errors.push(`${name}: a feat purchase cannot grant an NPC quality.`);
      continue;
    }
    if (skillChoices.has(name)) {
      const target = catalog.find(feat => normal(ruleName(feat)) === normal(choice));
      if (!target || treeKey(featData(target).tree) !== "basicskill")
        errors.push(`${name}: choose a Basic Skill feat.`);
    }
    resolved.push({ name, choice, source, cost, ...(typeof selection.id === "string" ? { id: selection.id } : {}) });
  }
  const qualified = [];
  const pending = [...resolved];
  const test = entry => {
    const named = name => qualified.some(feat => normal(feat.name) === normal(name));
    const chosen = (name, choice) =>
      qualified.some(feat => normal(feat.name) === normal(name) && normal(feat.choice) === normal(choice));
    const featTrees = {};
    for (const feat of qualified) {
      const key = treeKey(featData(feat.source).tree);
      featTrees[key] = (featTrees[key] ?? 0) + 1;
    }
    // Match canonical tree keys without depending on source labels such as "Basic Skill".
    const projectTrees = node =>
      !node
        ? null
        : node.type === "featTree"
          ? { ...node, tree: treeKey(node.tree) }
          : node.of
            ? { ...node, of: node.of.map(projectTrees) }
            : node;
    const result = checkPrerequisites(projectTrees(npcFeatPrerequisiteTree(featData(entry.source).prerequisites)), {
      hasFeat: named,
      hasFeatChoice: chosen,
      featTrees
    });
    const unmet = [...result.unmet];
    if (skillChoices.has(entry.name) && !named(entry.choice))
      unmet.push(`chosen Basic Skill feat ${entry.choice || "(missing)"}`);
    const previous = {
      "Grand Skill Mastery": "Advanced Skill Mastery",
      "Perfect Skill Mastery": "Grand Skill Mastery",
      "Mark of a Professional": "False Start"
    }[entry.name];
    if (previous && !chosen(previous, entry.choice)) unmet.push(`${previous} (${entry.choice})`);
    return unmet;
  };
  let changed = true;
  while (pending.length && changed) {
    changed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (test(pending[i]).length) continue;
      qualified.push(pending.splice(i, 1)[0]);
      changed = true;
    }
  }
  for (const entry of pending) errors.push(`${entry.name}: missing feat prerequisite(s): ${test(entry).join(", ")}.`);
  return {
    ok: errors.length === 0,
    errors,
    selections: resolved,
    ...(selections.some(s => typeof s.id === "string") ? { qualifiedIds: qualified.map(f => f.id) } : {}),
    xp: resolved.reduce((sum, feat) => sum + feat.cost, 0)
  };
}
