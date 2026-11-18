/**
 * Dueling Basics, p.178.
 *
 * - During their Initiative Count the character may choose 1 opponent they are aware of: +2 dodge to Defense against
 *   that opponent’s attacks for 1 full round. Without a chosen opponent: +1 dodge against all attacks for 1 full
 *   round. `system.duelingBasics` records the declaration; the +1 is prepared with Defense, and the +2 applies in the
 *   Incoming attack preview when the attack is declared to come from the chosen opponent.
 * - Once per round, a melee attack may target an opponent 5 ft. beyond Reach; if it misses, the character becomes
 *   flat-footed. The attack records `duelingReach`; the card offers the flat-footed result on a miss.
 */
import { ownCountDurationActive, validOwnCountClock } from "./own-count-duration.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function duelingBasicsState(system) {
  const r = system?.duelingBasics;
  if (!r || r.version !== 1 || !system.activeFeatNames?.includes("Dueling Basics")) return { active: false };
  if (!ownCountDurationActive(r, system.duelingCombatContext)) return { active: false };
  return { active: true, opponentUuid: r.opponentUuid || "", opponentName: r.opponentName || "", dueRound: r.dueRound };
}

/** The dodge bonus against all attackers (+1 without a chosen opponent). */
export const duelingAllDodge = system => {
  const s = duelingBasicsState(system);
  return s.active && !s.opponentUuid ? 1 : 0;
};

/** The extra dodge against the chosen opponent’s attack (+2), when the preview declares it. */
export const duelingChosenDodge = (system, fromChosenOpponent) => {
  const s = duelingBasicsState(system);
  return s.active && s.opponentUuid && fromChosenOpponent === true ? 2 : 0;
};

export function duelingBasicsPlan(system, combat, { opponentUuid = "", opponentName = "", confirmed = false } = {}) {
  if (!system?.activeFeatNames?.includes("Dueling Basics")) throw new Error(loc`Dueling Basics has not been earned.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Choose during your own Initiative Count in a started combat.`);
  if (confirmed !== true) throw new Error(loc`Confirm you are aware of the chosen opponent.`);
  return {
    version: 1,
    combatId: combat.id,
    combatantId: combat.combatantId,
    startRound: combat.round,
    dueRound: combat.round + 1,
    opponentUuid: String(opponentUuid ?? ""),
    opponentName: String(opponentName ?? "").slice(0, 200)
  };
}

export function duelingReachPlan(system, weapon, { duelingReach = false, ranged = false, usedThisRound = false } = {}) {
  if (duelingReach !== true) return null;
  if (!system?.activeFeatNames?.includes("Dueling Basics"))
    return { blocked: true, reason: loc`Dueling Basics has not been earned.` };
  if (ranged) return { blocked: true, reason: loc`The extra 5 ft. of Reach applies to a melee attack.` };
  if (usedThisRound) return { blocked: true, reason: loc`Dueling Basics’ extra Reach was already used this round.` };
  return {
    blocked: false,
    version: 1,
    note: loc`Dueling Basics: this melee attack targets an opponent 5 ft. beyond your Reach; if it misses you become flat-footed (p.178).`
  };
}

rollPipeline.register({
  id: "duelingReachContent:attack",
  dialogs: ["attack"],
  order: 74,
  dialog: ({ actor }) => [
    {
      at: 64,
      html: actor?.system?.activeFeatNames?.includes("Dueling Basics")
        ? `<label><input type="checkbox" name="duelingReach" /> ${loc`Dueling Basics: target an opponent 5 ft. beyond Reach (once per round; a miss leaves you flat-footed)`}</label>`
        : ""
    }
  ],
  read: ({ entered, actor }) =>
    entered?.duelingReach === true
      ? {
          duelingReach: true,
          // Once per round: look for this round's earlier attack that used it.
          duelingReachUsed: [...(globalThis.game?.messages ?? [])].some(m => {
            const c = m.flags?.spycraft2,
              combat = actor?.participatingCombat;
            return (
              c?.actorUuid === actor?.uuid &&
              c.attackContext?.duelingReach &&
              !c.superseded &&
              c.rollCombat?.id === combat?.id &&
              c.rollCombat?.round === combat?.round
            );
          })
        }
      : null
});

rollPipeline.register({
  id: "duelingReachAttackTerm",
  kinds: ["attack"],
  order: 9190,
  terms({ system, weapon, options, ranged }) {
    const plan = duelingReachPlan(system, weapon, {
      duelingReach: options.duelingReach === true,
      ranged,
      usedThisRound: options.duelingReachUsed === true
    });
    return {
      key: "duelingReach",
      plan: plan && !plan.blocked ? plan : null,
      blockAt: 200,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 500,
      notes: plan && !plan.blocked ? [plan.note] : []
    };
  }
});
