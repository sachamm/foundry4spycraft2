/**
 * What an NPC's feat items do to its numbers.
 *
 * A feat item carries bonuses as target and value pairs (the same ones the agent engine reads). For an NPC the ones
 * that are plain numbers on its sheet are worked out here: saves, Initiative, Speed, vitality, wounds and skill
 * checks. Anything else stays a name with its reminder, and is listed so the GC knows it is not counted.
 * Pure rules; module/data/actor.mjs applies the result.
 */
import { evaluate } from "./formula.mjs";
import { loc } from "../i18n.mjs";
import { SKILLS } from "./tables.mjs";
import { damageSaveAdjustment } from "./gc/npc-damage.mjs";

/** Preserve legacy manual health adjustments until the GC chooses how their feat bonuses were counted. */
export function npcHealthSaveAdjustment(effects, { damageSaveAdjust = 0, damageSaveHealthMode = "review" } = {}) {
  const automatic = damageSaveAdjustment(effects),
    needsReview = damageSaveHealthMode === "review" && damageSaveAdjust !== 0 && automatic !== 0,
    applied = damageSaveHealthMode === "manual" || needsReview ? 0 : automatic;
  return { automatic, applied, needsReview };
}

/** A skill key as the table reads it, localised when the system config is loaded. */
const skillName = key =>
  globalThis.CONFIG?.SPYCRAFT?.skills?.[key]?.name ?? SKILLS.find(s => s.key === key)?.name ?? key;

const SAVES = { "baseSave.fort": "fort", "baseSave.ref": "ref", "baseSave.will": "will" };
const empty = () => ({
  saves: { fort: 0, ref: 0, will: 0 },
  initiative: 0,
  speed: 0,
  vitality: 0,
  wounds: 0,
  skills: {},
  rows: [],
  uncounted: []
});

/**
 * @param {object[]} items   the NPC's items: [{ type, name, system: { bonuses: [{ target, value }], ranks } }]
 * @param {object} context   { level: the NPC's Threat Level, base: { fort, ref, will } base save bonuses }
 * @returns {object} totals by statistic, `rows` saying where each came from, and `uncounted` feat names whose
 *                   bonuses are not numbers on an NPC sheet
 */
export function npcFeatEffects(items, { level = 1, base = {} } = {}) {
  const out = empty();
  for (const item of items ?? []) {
    if (item?.type !== "feat") continue;
    const bonuses = Array.isArray(item.system?.bonuses) ? item.system.bonuses : [],
      rank = Math.max(1, Math.trunc(Number(item.system?.ranks) || 1));
    let missed = false;
    for (const bonus of bonuses) {
      const target = String(bonus?.target ?? ""),
        value = Math.trunc(Number(evaluate(bonus?.value, { rank, level, base })) || 0),
        skill = target.match(/^skills\.(\w+)\.misc$/)?.[1];
      let label = "";
      if (Object.hasOwn(SAVES, target)) {
        out.saves[SAVES[target]] += value;
        label = { fort: loc`Fortitude`, ref: loc`Reflex`, will: loc`Will` }[SAVES[target]];
      } else if (target === "initiative") {
        out.initiative += value;
        label = loc`Initiative`;
      } else if (target === "speed") {
        out.speed += value;
        label = loc`Speed`;
      } else if (target === "vitality") {
        out.vitality += value;
        label = loc`Vitality`;
      } else if (target === "wounds") {
        out.wounds += value;
        label = loc`Wounds`;
      } else if (skill) {
        out.skills[skill] = (out.skills[skill] ?? 0) + value;
        label = loc`${skillName(skill)} checks`;
      } else {
        missed = true;
        continue;
      }
      if (value) out.rows.push({ name: item.name, label, value });
    }
    if (missed) out.uncounted.push(item.name);
  }
  out.uncounted = [...new Set(out.uncounted)];
  return out;
}
