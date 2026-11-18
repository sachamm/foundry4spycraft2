/**
 * Mark of Conflict / Strife / Turmoil (Chance feats, p.190).
 *
 * Each Mark adds 1 to damage rolls of its attack category and counts base
 * attack bonus and career level as 3 higher when checking prerequisites of
 * feats in its combat tree. The starting disposition of any character with two
 * or more feats of that tree worsens by 2 grades; that drawback is reported
 * for the GC and is not applied automatically.
 */
const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
export const MARK_PREREQUISITE_BONUS = 3;
export const MARKS = Object.freeze({
  "Mark of Conflict": Object.freeze({ tree: "rangedCombat", category: "ranged", label: "ranged" }),
  "Mark of Strife": Object.freeze({ tree: "unarmedCombat", category: "unarmed", label: "unarmed" }),
  "Mark of Turmoil": Object.freeze({ tree: "meleeCombat", category: "melee", label: "melee" })
});
const MELEE = ["blunt", "exoticBlunt", "edged", "exoticEdged"];

/** Attack category of a weapon's damage roll: unarmed (including knuckle weapons), melee or ranged. */
export function markDamageCategory(weapon = {}) {
  if (weapon.proficiency === "unarmed" || /(?:^|[,\s])NKL(?:[,\s]|$)/.test(weapon.qualities ?? "")) return "unarmed";
  return MELEE.includes(weapon.proficiency) ? "melee" : "ranged";
}

/** +1 damage from the possessed Mark matching this weapon's attack category. */
export function markDamagePlan(system = {}, weapon = {}) {
  const category = markDamageCategory(weapon),
    owned = new Set((system.activeFeatNames ?? []).map(normal));
  const source = Object.keys(MARKS).find(name => MARKS[name].category === category && owned.has(normal(name))) ?? null;
  return {
    active: !!source,
    source,
    category,
    bonus: source ? 1 : 0,
    note: source ? `${source}: +1 ${MARKS[source].label} damage.` : "",
    drawback: source ? markDrawback(source) : ""
  };
}

/** Amount added to base attack bonus and career level for prerequisites of a feat in this tree. */
export function markPrerequisiteBonus(hasFeat, featTree = "") {
  const source = Object.keys(MARKS).find(name => MARKS[name].tree === featTree);
  return source && hasFeat(source) ? MARK_PREREQUISITE_BONUS : 0;
}

/** Table-managed disposition drawback text for a possessed Mark. */
export function markDrawback(name) {
  const mark = MARKS[name];
  if (!mark) return "";
  const tree = { rangedCombat: "Ranged Combat", unarmedCombat: "Unarmed Combat", meleeCombat: "Melee Combat" }[
    mark.tree
  ];
  return `${name}: starting disposition of any character with 2 or more ${tree} feats worsens by 2 grades (GC applies).`;
}
