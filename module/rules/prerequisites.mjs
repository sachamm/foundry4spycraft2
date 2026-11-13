/**
 * Prerequisite trees (feats, expert classes).
 *
 * Node shapes:
 *   { type: "all"|"any", of: [...] }
 *   { type: "feat", name }                 { type: "featTree", tree, min }
 *   { type: "base", key: "bab"|"defense", min }
 *   { type: "level", min } | { type: "level", eq }
 *   { type: "ability", key, min }          { type: "skill", key, min }
 *   { type: "proficiency", key }           { type: "focus", skill, group, any? }
 *   { type: "lifestyle", min }             { type: "keySkill", min }
 *   { type: "never" } | { type: "unknown" }
 */

/**
 * @param {object|null} node
 * @param {object} ctx   Values from SpycraftActor#prerequisiteContext
 * @returns {{ok: boolean, unmet: string[]}}
 */
export function checkPrerequisites(node, ctx) {
  if (!node) return { ok: true, unmet: [] };
  const unmet = [];
  const ok = test(node, ctx, unmet);
  return { ok, unmet };
}

function test(n, ctx, unmet) {
  let ok;
  switch (n.type) {
    case "all": {
      ok = true;
      for (const c of n.of) ok = test(c, ctx, unmet) && ok;
      return ok;
    }
    case "any": {
      const sub = [];
      ok = n.of.some(c => test(c, ctx, sub));
      if (!ok) unmet.push(describe(n));
      return ok;
    }
    case "feat": ok = ctx.hasFeat(n.name); break;
    case "featTree": ok = (ctx.featTrees[n.tree] ?? 0) >= n.min; break;
    case "base": ok = (ctx.base[n.key] ?? 0) >= n.min; break;
    case "level": ok = n.eq !== undefined ? ctx.level === n.eq : ctx.level >= n.min; break;
    case "ability": ok = (ctx.abilities[n.key] ?? 0) >= n.min; break;
    case "skill": ok = (ctx.skills[n.key] ?? 0) >= n.min; break;
    case "proficiency": ok = !!ctx.proficient(n.key); break;
    case "focus": ok = (n.any ?? [n.group]).some(g => ctx.focus(n.skill, g)); break;
    case "lifestyle": ok = (ctx.lifestyle ?? 0) >= n.min; break;
    case "keySkill": ok = (ctx.keySkillRanks ?? 0) >= n.min; break;
    case "never": ok = false; break;
    default: ok = false; // Unsupported requirements must not be reported as satisfied
  }
  if (!ok) unmet.push(describe(n));
  return ok;
}

const ABIL = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

/** Human-readable prerequisite text. */
export function describe(n) {
  if (!n) return "";
  const cfg = globalThis.CONFIG?.SPYCRAFT;
  const skill = k => cfg?.skills?.[k]?.name ?? k;
  const tree = k => cfg?.featTrees?.[k] ?? k;
  const prof = k => cfg?.proficiencies?.[k]?.label ?? k;
  switch (n.type) {
    case "all": return n.of.map(describe).join(", ");
    case "any": return `(${n.of.map(describe).join(" or ")})`;
    case "feat": return n.name;
    case "featTree": return n.min > 1 ? `${n.min} ${tree(n.tree)} feats` : `any ${tree(n.tree)} feat`;
    case "base": return n.key === "bab" ? `BAB +${n.min}` : `Base Defense +${n.min}`;
    case "level": return n.eq !== undefined ? `Career Level ${n.eq}` : `Career Level ${n.min}+`;
    case "ability": return `${ABIL[n.key]} ${n.min}+`;
    case "skill": return `${skill(n.key)} ${n.min}+ ranks`;
    case "proficiency": return `${prof(n.key)} proficiency`;
    case "focus": return `${skill(n.skill)} focus (any ${n.group})`;
    case "lifestyle": return `Lifestyle ${n.min}+`;
    case "keySkill": return `Key skill ${n.min}+ ranks`;
    case "never": return "Not available";
    default: return "Special";
  }
}
