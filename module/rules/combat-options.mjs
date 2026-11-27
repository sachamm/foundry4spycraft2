/**
 * Combat actions that had no tool yet (pp.354–361):
 *
 *   Anticipate     half action; Sense Motive (Wis) against DC 10 + the opponent's base attack bonus; Vision. Success: a
 *                  dodge bonus equal to Wisdom modifier (minimum +1) against that opponent for a full round. Critical
 *                  success: that opponent's threat range against the character also falls by the Wisdom modifier.
 *                  Critical failure: flat-footed. A new Anticipate against the same opponent replaces the old one.
 *   Joint Action   full action, error +1; Tactics (Int) against DC 10 per teammate, up to Charisma modifier + 1
 *                  (minimum 1) of them; Disposition, Hearing, Language. Next round they all act on this Count.
 *   Stand Off      free action when attacked within melee or CQB range: spend 1 action die and 5 Initiative Count
 *                  for a Reflex save (DC 10 + the attacker's base attack bonus). Each round after, opposed Resolve
 *                  (Wis) with the Vision tag; each loser takes 1d6 + the winner's Wisdom modifier stress (minimum 1).
 *   Tire           half action, error +1; opposed Resolve (Con) with the Armor Check Penalty tag against an adjacent
 *                  opponent. Win: 1d4+1 subdual (2d4+2 on a critical). Lose: flat-footed (and 1d4+1 subdual on a
 *                  critical against you).
 *   Coup de Grace  a survivor makes a Fortitude save (DC 10 + the damage) or drops to –10 wounds.
 *   Ready          cancelling the readied action when it triggers takes a Reflex save (DC 15).
 *
 * The checks join the skill dialogs as named checks; this module is pure.
 */
import { campaignRules } from "./campaign-rules.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { ownCountDurationActive, validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";

export const READY_CANCEL_DC = 15;
export const STAND_OFF_COUNT = 5;

const bab = value => {
  const number = Math.trunc(Number(value));
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(loc`Enter the opponent's base attack bonus.`);
  return number;
};
const wisdom = system => Math.trunc(Number(system?.abilities?.wis?.mod) || 0);

/** The DC to Anticipate an opponent, or to make a Stand Off save against one. */
export const opponentDC = baseAttack => 10 + bab(baseAttack);

/**
 * What an Anticipate result gives.
 * @param {"success"|"critical"|"failure"|"criticalFailure"} outcome
 */
export function anticipatePlan(system, { outcome, opponentUuid = "", opponentName = "", combat = null } = {}) {
  if (!["success", "critical", "failure", "criticalFailure"].includes(outcome))
    throw new Error(loc`Choose the Anticipate result.`);
  if (["success", "critical"].includes(outcome) && (!opponentUuid || !String(opponentName).trim()))
    throw new Error(loc`Choose the opponent anticipated.`);
  const mod = wisdom(system);
  return {
    version: 1,
    outcome,
    opponentUuid: String(opponentUuid),
    opponentName: String(opponentName).trim().slice(0, 200),
    dodge: ["success", "critical"].includes(outcome) ? Math.max(1, mod) : 0,
    threatReduction: outcome === "critical" ? Math.max(0, mod) : 0,
    flatFooted: outcome === "criticalFailure",
    // One full round: until the start of the character's Count next round (p.346).
    ...(validOwnCountClock(combat)
      ? { combatId: combat.id, combatantId: combat.combatantId, startRound: combat.round, dueRound: combat.round + 1 }
      : { combatId: null })
  };
}

/** Whether a recorded Anticipate still holds. Outside combat it holds until replaced or cleared. */
export function anticipateActive(record, combat = null) {
  if (!record?.dodge) return false;
  if (!record.combatId) return true;
  return ownCountDurationActive(record, combat);
}

/** The dodge bonus from Anticipate against one attack; lost when vulnerable, like every dodge bonus. */
export const anticipateDodge = (record, { fromOpponent = false, vulnerable = false, combat = null } = {}) =>
  fromOpponent && !vulnerable && anticipateActive(record, combat) ? record.dodge : 0;

/** Joint Action: how many teammates may join, and the Tactics DC for the number chosen. */
export function jointActionPlan(system, teammates = 1) {
  const most = Math.max(1, Math.trunc(Number(system?.abilities?.cha?.mod) || 0) + 1),
    count = Math.trunc(Number(teammates));
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(loc`Choose at least one teammate.`);
  if (count > most) throw new Error(loc`At most ${most} teammate(s) can join this Joint Action.`);
  return { most, teammates: count, dc: 10 * count };
}

/** Stress a stand-off loser takes: 1d6 + the winner's Wisdom modifier, at least 1. */
export const standOffStress = (rolled, winnerWisdomMod) =>
  Math.max(1, Math.trunc(Number(rolled) || 0) + Math.trunc(Number(winnerWisdomMod) || 0));

/** Tire: the subdual damage and condition for each result of the opposed check. */
export function tireOutcome(result) {
  switch (result) {
    case "won":
      return { target: "opponent", damage: "1d4+1", flatFooted: false };
    case "wonCritical":
      return { target: "opponent", damage: "2d4+2", flatFooted: false };
    case "lost":
      return { target: "self", damage: null, flatFooted: true };
    case "lostCritical":
      return { target: "self", damage: "1d4+1", flatFooted: true };
    default:
      throw new Error(loc`Choose the result of the opposed check.`);
  }
}

/** Coup de Grace: a target that survives the damage saves against DC 10 + the damage or drops to –10 wounds. */
export function coupDeGracePlan(damage) {
  const amount = Math.trunc(Number(damage));
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(loc`Enter the damage the Coup de Grace dealt.`);
  return { dc: 10 + amount, woundsOnFailure: -10 };
}

/* -------------------------------------------- */
/*  Named checks                                 */
/* -------------------------------------------- */

const CHECKS = {
  senseMotive: [
    {
      id: "anticipate",
      get name() {
        return loc`Anticipate Action`;
      },
      attributes: ["wis"],
      mode: "Active",
      tags: "Vision",
      error: 1,
      time: "1 Half Action",
      page: 354,
      synergies: [],
      combatAction: "anticipate"
    }
  ],
  tactics: [
    {
      id: "joint-action",
      get name() {
        return loc`Joint Action`;
      },
      attributes: ["int"],
      mode: "Active",
      tags: "Disposition, Hearing, Language",
      error: 2,
      time: "1 Full Action",
      page: 357,
      synergies: [],
      combatAction: "joint-action"
    }
  ],
  resolve: [
    {
      id: "stand-off",
      get name() {
        return loc`Stand Off Check`;
      },
      attributes: ["wis"],
      mode: "Active",
      tags: "Vision",
      error: 1,
      time: "Start of each round",
      page: 359,
      synergies: [],
      combatAction: "stand-off"
    },
    {
      id: "tire",
      get name() {
        return loc`Tire Action`;
      },
      attributes: ["con"],
      mode: "Active",
      tags: "Armor Check Penalty",
      error: 2,
      time: "1 Half Action",
      page: 361,
      synergies: [],
      combatAction: "tire"
    }
  ]
};

/** The combat-action checks a skill offers, added to its named checks. */
export function combatOptionChecks(key, checks = []) {
  const added = CHECKS[key];
  if (!added) return checks;
  const ids = new Set(added.map(c => c.id));
  return [...checks.filter(c => !ids.has(c.id)), ...added.map(c => ({ ...c, name: c.name }))];
}

const NOTES = {
  anticipate: () =>
    loc`Anticipate: DC 10 + the opponent's base attack bonus. Success gives a dodge bonus against that opponent for a full round; record it with "Anticipate result" on the sheet (p.354).`,
  "joint-action": system =>
    loc`Joint Action: DC 10 per teammate, at most ${jointActionPlan(system, 1).most}. On a success everyone chosen acts on this Count next round; any failed check ends it (p.357).`,
  "stand-off": () =>
    campaignRules().closedStandOffs
      ? loc`Stand Off: opposed. Each loser takes 1d6 + the winner's Wisdom modifier stress; record it with "Stand off" on the sheet (p.359). Under Gladiators nobody may interrupt or join it (p.407).`
      : loc`Stand Off: opposed. Each loser takes 1d6 + the winner's Wisdom modifier stress; record it with "Stand off" on the sheet (p.359).`,
  tire: () =>
    loc`Tire: opposed by the adjacent opponent's Resolve (Con). Settle it with "Tire result" on the sheet (p.361).`
};

rollPipeline.register({
  id: "combatOptionChecks",
  order: 5030,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => combatOptionChecks(skillKey, checks)
});

rollPipeline.register({
  id: "combatOptionSkillTerm",
  kinds: ["skill"],
  order: 9320,
  terms({ system, check }) {
    const note = NOTES[check?.id]?.(system);
    if (
      !note ||
      !Object.values(CHECKS)
        .flat()
        .some(c => c.id === check.id)
    )
      return null;
    return { key: "combatOption", plan: null, noteAt: 900, segment: `${note} ` };
  }
});
