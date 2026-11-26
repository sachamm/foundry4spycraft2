/** Numeric creation changes from campaign qualities (pp.407–408). No world reads or document writes. */
export function campaignAttributeLevels(effects = {}, standard = [4, 8, 12, 16, 20]) {
  const interval = effects.attributeInterval;
  return Number.isSafeInteger(interval) && interval >= 2 && interval <= 20
    ? Array.from({ length: Math.floor(20 / interval) }, (_, i) => (i + 1) * interval)
    : standard;
}
export function campaignFeatCount(level, standard, effects = {}) {
  const interval = effects.featInterval;
  return Number.isSafeInteger(interval) && interval >= 2 && level > 0 ? 1 + Math.floor(level / interval) : standard;
}
export function campaignProficiencyCount(level, standard, effects = {}) {
  const interval = effects.proficiencyInterval;
  return Number.isSafeInteger(interval) && interval >= 1 ? Math.floor(Math.max(0, level - 1) / interval) : standard;
}
export function campaignXP(value, effects = {}) {
  return Number.isFinite(value) ? Math.floor(value * (effects.xpToLevelFraction ?? 1)) : value;
}
export function campaignVitalityDie(die, effects = {}) {
  const value = effects.fixedVitalityByDie?.[die];
  return Number.isSafeInteger(value) && value >= 1 && value <= die ? value : null;
}
/** User ruling: the first additional Interest remains at level 2; the quality changes subsequent spacing. */
export function campaignInterestCount(level, standard, effects = {}) {
  const interval = effects.interestInterval;
  return Number.isSafeInteger(interval) && interval >= 1
    ? 2 + (level >= 2 ? 1 + Math.floor((level - 2) / interval) : 0)
    : standard;
}

const treeKey = value =>
  String(value)
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
export function campaignFeatReplacementAllowed(source, target, effects = {}) {
  if (source === target || source === "any") return false;
  if (!(effects.bonusFeatTrees ?? []).some(tree => treeKey(tree) === treeKey(target))) return false;
  // Elite Ops replaces choices outside the whole Skill family, not an Advanced Skill choice.
  return !(target === "basicSkill" && ["basicSkill", "advancedSkill"].includes(source));
}

/** Match restricted choices to allowed campaign alternatives without creating extra feat slots.
 * Residual edges allow an earlier flexible match to move when a later target has fewer eligible sources.
 */
export function campaignFeatSlots(given, spent, effects = {}) {
  const slots = { ...given },
    replacements = [];
  if (!effects.bonusFeatTrees?.length) return { slots, replacements };
  const keys = Object.keys(slots)
    .filter(k => k !== "any")
    .sort();
  const graph = new Map();
  const edges = [];
  const add = (from, to, capacity) => {
    if (!graph.has(from)) graph.set(from, []);
    if (!graph.has(to)) graph.set(to, []);
    const edge = { from, to, capacity, initial: capacity },
      reverse = { from: to, to: from, capacity: 0 };
    edge.reverse = reverse;
    reverse.reverse = edge;
    graph.get(from).push(edge);
    graph.get(to).push(reverse);
    return edge;
  };
  const need = key => Math.max(0, spent[key] ?? 0);
  const totalNeed = keys.reduce((n, k) => n + need(k), 0);
  for (const source of keys) {
    add("start", "from:" + source, Math.max(0, slots[source]));
    for (const target of [source, ...keys.filter(k => k !== source)])
      if (need(target) && (source === target || campaignFeatReplacementAllowed(source, target, effects)))
        edges.push({ source, target, edge: add("from:" + source, "to:" + target, totalNeed) });
  }
  for (const target of keys) add("to:" + target, "end", need(target));
  while (true) {
    const previous = new Map([["start", null]]),
      queue = ["start"];
    for (let i = 0; i < queue.length && !previous.has("end"); i++)
      for (const edge of graph.get(queue[i]) ?? [])
        if (edge.capacity > 0 && !previous.has(edge.to)) {
          previous.set(edge.to, edge);
          queue.push(edge.to);
        }
    if (!previous.has("end")) break;
    let count = Infinity;
    for (let at = "end"; at !== "start"; at = previous.get(at).from) count = Math.min(count, previous.get(at).capacity);
    for (let at = "end"; at !== "start"; at = previous.get(at).from) {
      const edge = previous.get(at);
      edge.capacity -= count;
      edge.reverse.capacity += count;
    }
  }
  for (const { source, target, edge } of edges) {
    const count = edge.initial - edge.capacity;
    if (!count || source === target) continue;
    slots[source] -= count;
    slots[target] += count;
    replacements.push({ source, target, count });
  }
  return { slots, replacements };
}
