/**
 * Berserker Basics, Mastery and Supremacy, pp.183–184.
 *
 * A berserker rage lasts a rolled number of rounds: 2d4+2 (Basics), up to 3d4+3 (Mastery) or 4d4+4 (Supremacy).
 * During it Strength and Constitution rise by 3 (Basics) or 5 (Mastery and above) and the character is enraged.
 * Entering takes a full action (free with Mastery); ending early takes a half action (free with Supremacy). Afterwards
 * the character is exhausted (fatigued with Supremacy) for as many minutes as rounds spent raging. Uses per session:
 * the character's starting action dice.
 *
 * A rage is tracked in combat rounds, so it starts in a started combat. `system.berserkerRage` holds
 * { version, id, combatId, startRound, rounds, bonus, tier }; the engine adds the bonus while
 * `berserkerRageState` reports it active. Supremacy's +4 to saves against becoming frenzied is a reminder on the
 * save, since saves do not record what they resist.
 */
import { loc } from "../i18n.mjs";

export const BERSERKER_TIERS = Object.freeze([
  { feat: "Berserker Supremacy", duration: "4d4+4", bonus: 5, enter: "free", end: "free", after: "fatigued" },
  { feat: "Berserker Mastery", duration: "3d4+3", bonus: 5, enter: "free", end: "half", after: "exhausted" },
  { feat: "Berserker Basics", duration: "2d4+2", bonus: 3, enter: "full", end: "half", after: "exhausted" }
]);

/** The best tier the character has, or null. Mastery's free entry and Supremacy's free end carry down the tiers. */
export function berserkerTier(system) {
  const names = system?.activeFeatNames ?? [];
  if (!names.includes("Berserker Basics")) return null;
  return BERSERKER_TIERS.find(t => names.includes(t.feat)) ?? null;
}

export function berserkerSpec(system) {
  const max = system?.actionDice?.max;
  return berserkerTier(system)
    ? {
        id: "berserkerRage",
        name: loc`Berserker rage`,
        period: "session",
        limit: Number.isSafeInteger(max) && max > 0 ? max : 0,
        workflow: "berserkerRage"
      }
    : null;
}

/** Whether a stored rage is running in this combat round, has run out, or is absent. */
export function berserkerRageState(rage, combat) {
  if (!rage || rage.version !== 1) return { active: false, record: null };
  const sameCombat = combat?.id === rage.combatId && Number.isSafeInteger(combat?.round),
    elapsed = sameCombat ? combat.round - rage.startRound : null,
    over = !sameCombat || elapsed >= rage.rounds;
  return {
    active: !over,
    expired: over,
    record: rage,
    elapsed: sameCombat ? Math.max(0, elapsed) : rage.rounds,
    remaining: over ? 0 : rage.rounds - elapsed
  };
}

/** Start a rage: the rolled duration, the tier's bonus and the round it began. */
export function berserkerStartPlan(system, combat, { id, rolledRounds, actionConfirmed = false } = {}) {
  const tier = berserkerTier(system);
  if (!tier) throw Error(loc`Berserker Basics has not been earned.`);
  if (!combat?.started || typeof combat.id !== "string" || !Number.isSafeInteger(combat.round))
    throw Error(loc`A berserker rage is counted in rounds: start it in a started combat.`);
  if (berserkerRageState(system.berserkerRage, combat).active) throw Error(loc`This character is already raging.`);
  if (tier.enter === "full" && actionConfirmed !== true) throw Error(loc`Entering a rage takes a full action.`);
  if (!Number.isSafeInteger(rolledRounds) || rolledRounds < 1) throw Error(loc`Roll the rage’s duration.`);
  if (typeof id !== "string" || !id) throw Error(loc`A new rage needs an identifier.`);
  return {
    version: 1,
    id,
    combatId: combat.id,
    startRound: combat.round,
    rounds: rolledRounds,
    bonus: tier.bonus,
    tier: tier.feat
  };
}

/** End a rage, early or when it runs out: the condition that follows and for how many minutes. */
export function berserkerEndPlan(system, combat, { actionConfirmed = false } = {}) {
  const tier = berserkerTier(system),
    state = berserkerRageState(system.berserkerRage, combat);
  if (!state.record) throw Error(loc`This character is not raging.`);
  if (state.active && tier?.end === "half" && actionConfirmed !== true)
    throw Error(loc`Calming down early takes a half action.`);
  const rounds = Math.max(1, state.active ? state.elapsed : state.record.rounds);
  return { after: tier?.after ?? "exhausted", minutes: rounds, rounds, early: state.active };
}

export const berserkerNote = (name, plan) =>
  plan.after === "fatigued"
    ? loc`${name}’s rage ends after ${plan.rounds} rounds: fatigued for ${plan.minutes} minutes (Berserker Supremacy).`
    : loc`${name}’s rage ends after ${plan.rounds} rounds: exhausted for ${plan.minutes} minutes.`;
