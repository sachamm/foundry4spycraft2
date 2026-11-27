/**
 * Cooperative skill checks (p.91): one leader, several helpers.
 *
 * The leader rolls first. Each helper then makes the same check against DC 15 (when the task has a set DC) or the
 * leader's result less 10, never below 15. Successful helpers give the leader a synergy bonus of +1 each, +5 at
 * most; each helper's critical success adds a further +1 that is not a synergy bonus. One helper's critical
 * failure ruins the task. Nobody takes 10 or 20. Table 2.9 says how many helpers a check allows.
 */
import { triumphAt } from "./check-candidates.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { resolveSkillResult } from "./checks.mjs";
import { loc } from "../i18n.mjs";
import { campaignSkillDC } from "./campaign-rules.mjs";

export const HELPER_BASE_DC = 15;
/** The helpers' base DC after Cakewalk or Comedy of Errors (p.406). */
export const helperBaseDC = () => campaignSkillDC(HELPER_BASE_DC);
export const HELPER_SYNERGY_LIMIT = 5;

/**
 * How many helpers a named check allows.
 * @param {object} check  a named check with its `cooperative` entry: { max: n | "cha" | null, smallItem?, special? }
 * @returns {{allowed: boolean, max: number|null, special: boolean, smallItem: boolean}} max null means no stated limit
 */
export function helperLimit(check, { charismaMod = 0 } = {}) {
  const rule = check?.cooperative;
  if (!rule) return { allowed: false, max: 0, special: false, smallItem: false };
  if (rule.special) return { allowed: true, max: null, special: true, smallItem: false };
  const max = rule.max === "cha" ? Math.max(0, Math.trunc(Number(charismaMod) || 0)) : (rule.max ?? null);
  return { allowed: max === null || max > 0, max, special: false, smallItem: rule.smallItem === true };
}

/**
 * The DC each helper rolls against: 10, or the leader's result less 10 when that is higher (p.91). Cakewalk and
 * Comedy of Errors shift the whole DC, whichever it is.
 */
export function helperDC({ setDC = false, leaderResult = null } = {}) {
  if (setDC) return helperBaseDC();
  if (!Number.isFinite(leaderResult)) throw new Error(loc`The leader's result is needed to set the helpers' DC.`);
  return campaignSkillDC(Math.max(HELPER_BASE_DC, leaderResult - 10));
}

/**
 * What the helpers add to the leader's result.
 * @param {{success: boolean, critical?: boolean, criticalFailure?: boolean}[]} helpers
 * @param {object} options  { priorSynergy: synergy bonus already in the leader's result, max: helper limit }
 */
export function cooperativeOutcome(helpers = [], { priorSynergy = 0, max = null } = {}) {
  const counted = max === null ? helpers : helpers.slice(0, Math.max(0, max));
  const successes = counted.filter(h => h.success === true && h.criticalFailure !== true).length,
    criticals = counted.filter(h => h.critical === true && h.criticalFailure !== true).length,
    ruined = counted.some(h => h.criticalFailure === true);
  const synergy = Math.min(HELPER_SYNERGY_LIMIT, successes);
  // Synergy bonuses do not stack: only what the helpers give beyond the leader's own synergy counts.
  const synergyGain = Math.max(0, synergy - Math.max(0, Number(priorSynergy) || 0));
  return {
    helpers: counted.length,
    ignored: helpers.length - counted.length,
    successes,
    criticals,
    synergy,
    synergyGain,
    unnamed: criticals,
    bonus: ruined ? 0 : synergyGain + criticals,
    ruined
  };
}

/** A helper's posted check, as the leader's tally reads it. */
export function helperResult(check) {
  const dc = check?.cooperative?.dc;
  const success =
    typeof check?.successConfirmed === "boolean"
      ? check.successConfirmed
      : Number.isFinite(check?.effectiveTotal) && Number.isFinite(dc) && check.effectiveTotal >= dc;
  return {
    total: check?.effectiveTotal ?? null,
    dc: dc ?? null,
    success: success && check?.criticalFailure !== true,
    critical: check?.criticalSuccess === true,
    criticalFailure: check?.criticalFailure === true
  };
}

/**
 * The leader's check with the helpers' bonus applied. Running it again with new helper results replaces the old
 * bonus, so the tally can be redone as helpers finish.
 */
export function applyCooperativeBonus(check, helpers, { max = null } = {}) {
  if (check?.cooperative?.role !== "leader") throw new Error(loc`Only the leader's check takes the helpers' bonus.`);
  const previous = check.cooperative.result?.bonus ?? 0,
    baseRaw = check.rawTotal - previous;
  const outcome = cooperativeOutcome(helpers, { priorSynergy: check.cooperative.priorSynergy ?? 0, max });
  const rawTotal = baseRaw + outcome.bonus;
  const resolved = resolveSkillResult(rawTotal, check.naturalDie, {
    cap: check.boostCap ?? check.cap ?? null,
    threat: check.threat ?? 0,
    actionDieBonus: check.boostTotal ?? 0,
    triumphAt: triumphAt(check)
  });
  return {
    ...check,
    rawTotal,
    effectiveTotal: resolved.total,
    capped: resolved.limited,
    cooperative: { ...check.cooperative, result: { ...outcome, helperResults: helpers } }
  };
}

/** The lines a posted check shows about its part in a cooperative check. */
export function cooperativeNotes(check) {
  const coop = check?.cooperative;
  if (!coop) return [];
  if (coop.role === "helper")
    return [loc`Helping ${coop.leaderName || loc`the leader`} with a cooperative check: DC ${coop.dc} (p.91).`];
  if (coop.role !== "leader") return [];
  const limit = coop.max === null || coop.max === undefined ? loc`no stated limit` : loc`up to ${coop.max} helper(s)`;
  const notes = [
    coop.setDC
      ? loc`Cooperative check, leader: ${limit}; each helper rolls against DC ${helperBaseDC()} (p.91).`
      : loc`Cooperative check, leader: ${limit}; each helper rolls against this result less 10, at least ${helperBaseDC()} (p.91).`
  ];
  const result = coop.result;
  if (result?.ruined) notes.push(loc`A helper's critical failure ruined the task; it has to be started again.`);
  else if (result)
    notes.push(
      loc`Helpers: ${result.successes} of ${result.helpers} succeeded, synergy +${result.synergy} (${result.synergyGain} beyond the synergy already counted); ${result.criticals} critical success(es) +${result.unnamed}. Result raised by ${result.bonus}.`
    );
  if (result?.ignored) notes.push(loc`${result.ignored} helper(s) beyond the limit were not counted.`);
  return notes;
}

/** Check a declared cooperative role against the named check; throws when it cannot stand. */
export function validateCooperative(cooperative, { check, checkMethod = "roll", charismaMod = 0 } = {}) {
  if (!cooperative) return;
  if (!["leader", "helper"].includes(cooperative.role)) throw new Error(loc`Choose leader or helper.`);
  if (checkMethod !== "roll") throw new Error(loc`Nobody takes 10 or 20 in a cooperative check (p.91).`);
  const limit = helperLimit(check, { charismaMod });
  if (cooperative.role === "leader" && !limit.allowed)
    throw new Error(
      check?.cooperative
        ? loc`This leader's Charisma bonus allows no helpers for this check.`
        : loc`This check cannot be made as a cooperative check (Table 2.9).`
    );
  if (cooperative.role === "helper") {
    if (!check?.cooperative) throw new Error(loc`This check cannot be made as a cooperative check (Table 2.9).`);
    if (!Number.isFinite(cooperative.dc) || cooperative.dc < helperBaseDC())
      throw new Error(loc`A helper needs the DC set by the leader's check, at least ${helperBaseDC()}.`);
  }
}

rollPipeline.register({
  id: "cooperativeCheck",
  kinds: ["skill"],
  order: 9700,
  validate({ actor, options, checkMethod, skillKey, checkId, phase }) {
    if (!options.cooperative || phase !== "before") return;
    const check = (globalThis.CONFIG?.SPYCRAFT?.skills?.[skillKey]?.checks ?? []).find(c => c.id === checkId);
    validateCooperative(options.cooperative, {
      check,
      checkMethod,
      charismaMod: actor?.system?.abilities?.cha?.mod ?? 0
    });
  },
  record: ["cooperative"]
});
