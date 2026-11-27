/**
 * Indirect fire and hang time (p.300).
 *
 * A character who cannot see the target square fires on a forward observer's word: the observer's Tactics check
 * (DC 15) caps the attack's result, and each later successful relay on the same square adds +1 morale, up to the
 * attacker's Wisdom bonus. Slow or far-flying weapons strike some rounds after firing, by the number of range
 * increments to the square (Table 4.79), and the attack check waits for the attacker's Count in that round.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { campaignSkillDC } from "./campaign-rules.mjs";

export const OBSERVER_DC = 15;

/** Table 4.79: [most range increments, rounds of hang time]. */
export const HANG_TIME = [
  [1, 0],
  [3, 1],
  [6, 2],
  [10, 3]
];

const HANG_TIME_NAMES = /mortar|grenade launcher|missile|rocket|artillery|bomb|torpedo/i;

/** Weapons the rules make wait out hang time: indirect fire, mortars, launchers, artillery, bombs and torpedoes. */
export function hangTimeApplies(weapon = {}, { indirectFire = false } = {}) {
  if (/cruise/i.test(weapon.name ?? "")) return false;
  return (
    indirectFire === true ||
    weapon.proficiency === "indirectFire" ||
    ["mortar", "grenadeLauncher"].includes(weapon.weaponCategory) ||
    HANG_TIME_NAMES.test(weapon.name ?? "")
  );
}

/** Rounds of hang time at a distance, or null when the distance or increment is unknown. */
export function hangTimeRounds(distanceFeet, increment) {
  if (distanceFeet === "" || distanceFeet === null || distanceFeet === undefined) return null;
  const distance = Number(distanceFeet),
    step = Number(increment);
  if (!(distance >= 0) || !(step > 0)) return null;
  const increments = Math.max(1, Math.ceil(distance / step));
  return (HANG_TIME.find(([most]) => increments <= most) ?? HANG_TIME.at(-1))[1];
}

/** Whether an attack is indirect fire: an Indirect weapon, or a launcher fired indirectly. */
export const indirectAttack = (weapon = {}, options = {}) =>
  options.indirectFire === true || weapon.proficiency === "indirectFire";

/**
 * The forward observer's relay and any adjust-fire relays for one attack. `observerResult` is the observer's
 * Tactics result (blank when the attacker sees the square); `adjustments` counts the successful adjust-fire relays
 * on this square so far.
 */
export function indirectFirePlan(system, { observerResult = null, adjustments = 0 } = {}) {
  const observed = observerResult !== null && observerResult !== undefined && observerResult !== "";
  const result = observed ? Number(observerResult) : null;
  if (observed && !Number.isSafeInteger(result))
    return { blocked: true, reason: loc`Enter the forward observer's Tactics result as a whole number.` };
  const observerDC = campaignSkillDC(OBSERVER_DC);
  if (observed && result < observerDC)
    return {
      blocked: true,
      reason: loc`The forward observer's Tactics check (${result}) missed DC ${observerDC}, so the coordinates did not get through. The observer may try again with another half action.`
    };
  const relays = Number(adjustments) || 0;
  if (!Number.isSafeInteger(relays) || relays < 0)
    return { blocked: true, reason: loc`Count the adjust-fire relays as a whole number, 0 or more.` };
  const most = Math.max(0, Number(system?.abilities?.wis?.mod) || 0),
    bonus = Math.min(relays, most);
  const notes = [];
  if (observed) notes.push(loc`Forward observer: the attack result cannot exceed ${result} (p.300).`);
  if (relays)
    notes.push(
      bonus < relays
        ? loc`Adjust fire: +${bonus} morale, the most your Wisdom allows (p.300).`
        : loc`Adjust fire: +${bonus} morale on this square (p.300).`
    );
  return { blocked: false, cap: observed ? result : null, bonus, relays, notes };
}

rollPipeline.register({
  id: "indirectFireContent:rangedAttack",
  dialogs: ["rangedAttack"],
  order: 79,
  dialog: ({ item }) => {
    const weapon = { ...item?.system, name: item?.name };
    const possible = weapon.proficiency === "indirectFire" || weapon.weaponCategory === "grenadeLauncher";
    return [
      {
        at: 95,
        html: possible
          ? `<fieldset><legend>${loc`Indirect fire (p.300)`}</legend><label>${loc`Forward observer's Tactics result (leave blank if you can see the square)`} <input type="number" name="observerResult" min="0" step="1" /></label><label>${loc`Successful adjust-fire relays on this square so far`} <input type="number" name="adjustFire" min="0" step="1" value="0" /></label></fieldset>`
          : ""
      }
    ];
  },
  read: ({ entered }) => {
    const observer = entered?.observerResult,
      relays = Number(entered?.adjustFire);
    const out = {};
    if (observer !== undefined && observer !== null && String(observer).trim() !== "")
      out.observerResult = Number(observer);
    if (Number.isSafeInteger(relays) && relays > 0) out.adjustFire = relays;
    return Object.keys(out).length ? out : null;
  }
});

rollPipeline.register({
  id: "indirectFireAttackTerm",
  kinds: ["attack"],
  order: 9197,
  terms({ system, weapon, options, rangeIncrement }) {
    const notes = [];
    let plan = null;
    if (indirectAttack(weapon, options) && (options.observerResult !== undefined || options.adjustFire)) {
      plan = indirectFirePlan(system, { observerResult: options.observerResult, adjustments: options.adjustFire });
      if (plan.blocked) return { key: "indirectFire", blockAt: 203, blocked: plan.reason };
      notes.push(...plan.notes);
    }
    if (hangTimeApplies(weapon, options)) {
      const rounds = hangTimeRounds(options.distanceFeet, rangeIncrement);
      if (rounds)
        notes.push(
          loc`Hang time: ${rounds} round(s). Target a square, and resolve this check on your Initiative Count when it ends (Table 4.79).`
        );
    }
    if (!plan && !notes.length) return null;
    return {
      key: "indirectFire",
      plan,
      rowAt: 292,
      rows: plan?.bonus ? [[loc`Adjust fire`, plan.bonus]] : [],
      cap: plan?.cap ?? null,
      noteAt: 504,
      notes
    };
  }
});
