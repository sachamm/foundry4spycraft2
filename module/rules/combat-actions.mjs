/**
 * Baseline combat actions that change an attack or stand in for one (pp.353–361, 343).
 *
 *   Burst            a trick on a firearm Standard Attack in Burst mode: 3 shots, error +1
 *   Autofire         full action, Full Auto: 3 shots a volley, –1 per volley, error +2
 *   Strafe           full action, Full Auto: 3 shots a square, recoil doubled, error +2
 *   Cover Fire       full action, 5 shots: the target saves or is hampered for a round
 *   Suppressive Fire full action, 5 shots: final attacks at –4 on whoever crosses the square
 *   Pummel           full action: an unarmed Standard Attack for double subdual damage
 *   Grapple          opposed Athletics checks that hold, pin and earn grapple benefits
 *   Blast            damage that halves with each blast increment from Ground Zero
 *
 * This module is pure. The fire actions join an attack as a term of its plan (module/rules/roll-pipeline.mjs).
 */
import { campaignRules } from "./campaign-rules.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { specialtyAttackAction, specialtyAttackBonus } from "./specialty-attacks.mjs";
import { unlimitedAmmunition } from "./ammunition-use.mjs";

/**
 * The time each sheet action takes, where the action table gives one (pp.352–353). Most sheet tools record or
 * resolve something already declared and have no time of their own, so they are absent here.
 */
export const ACTION_COSTS = Object.freeze({
  rollAttack: "half",
  rollDisarm: "half",
  reloadWeapon: "half",
  takeTotalDefense: "full",
  standOff: "free"
});

/** Fire actions that take the whole turn (pp.355–361). */
const FULL_ACTION_FIRE = new Set(["autofire", "strafe", "coverFire", "suppressiveFire"]);

/**
 * The time an attack took, read from what it produced: a full action for Autofire, Strafe, Cover Fire, Suppressive
 * Fire, Pummel and an untrained Disarm, otherwise a half action.
 */
export function attackActionCost(result) {
  const context = result?.flags?.spycraft2?.attackContext ?? {};
  const fire = result?.fireAction ?? context.fireAction?.action ?? context.fireAction;
  if (FULL_ACTION_FIRE.has(fire)) return "full";
  if (context.pummel && !context.pummel.blocked) return "full";
  if (context.disarm?.fullAction === true) return "full";
  return "half";
}

export const FIRE_ACTIONS = {
  burst: { mode: "burst", shots: 3, error: 1 },
  // Autofire Basics, p.180: a Burst that adds only 1 shot and never hits a third time.
  twoShotBurst: { modes: ["single", "burst"], shots: 2, error: 1, maxHits: 2, feat: "Autofire Basics" },
  autofire: { mode: "auto", minimumShots: 6, shotsEach: 3, most: 10, error: 2 },
  strafe: { mode: "auto", minimumShots: 9, shotsEach: 3, most: 10, error: 2 },
  suppressiveFinal: { shots: 1, error: 1, attack: -4 }
};
/**
 * Steel Rain, p.182: a hurled weapon (not one with a blast increment, nor firing blast ammunition) may be used for the
 * Burst trick, Cover Fire and Suppressive Fire. Shots are the hurled weapons thrown.
 */
export const steelRainWeapon = (system, weapon) =>
  system?.activeFeatNames?.includes("Steel Rain") === true &&
  ["hurled", "exoticHurled"].includes(weapon?.proficiency) &&
  !/\bBLS\b/.test(weapon?.qualities ?? "");
export const COVER_FIRE = { shots: 5, base: 10, penalty: -4, finalAttackMargin: 5 };
export const SUPPRESSIVE_FIRE = { shots: 5, penalty: -4 };
const count = value => (Number.isSafeInteger(value) ? value : NaN);

/** Rock and Roll!: 2 shots a volley, and as many volleys as half the shots left (rounded down). */
export const rockAndRollRule = rule => ({
  ...rule,
  shotsEach: 2,
  minimumShots: (rule.minimumShots / rule.shotsEach) * 2,
  most: Number.MAX_SAFE_INTEGER
});

/** How many volleys or squares the shots left in a weapon allow. */
export function fireActionLimit(action, shotsRemaining, rule = FIRE_ACTIONS[action]) {
  if (!rule?.shotsEach || !Number.isSafeInteger(shotsRemaining)) return 0;
  return shotsRemaining < rule.minimumShots ? 0 : Math.min(rule.most, Math.floor(shotsRemaining / rule.shotsEach));
}

/**
 * A declared fire action as it bears on the attack check.
 * @param {object} facts    { firearm, fireMode, attackAction, recoilPenalty } from the attack being planned
 * @param {object} declared { action, volleys, squares, shotsRemaining }
 * @returns {object|null} null when no fire action is declared
 */
export function fireActionPlan(facts = {}, declared = {}) {
  // Flamethrower Basics, p.181: a flamethrower attack uses half the usual shots, rounded up. Each shot left in the
  // weapon covers two of the action's shots, so the base checks see twice the shots left.
  const halved = facts.flamethrower === true && (facts.feats ?? []).includes("Flamethrower Basics");
  if (!halved) return baseFireActionPlan(facts, declared);
  const left = declared.shotsRemaining,
    doubled = left === null || left === "" || left === undefined ? left : Number(left) * 2,
    plan = baseFireActionPlan(facts, { ...declared, shotsRemaining: doubled });
  if (!plan || plan.blocked) return plan;
  const shots = Math.ceil(plan.shots / 2);
  return {
    ...plan,
    shots,
    notes: [...plan.notes, loc`Flamethrower Basics: this uses ${shots} shot(s) instead of ${plan.shots} (p.181).`]
  };
}
function baseFireActionPlan(facts = {}, { action = "", volleys = null, squares = null, shotsRemaining = null } = {}) {
  if (!action) return null;
  // Rock and Roll!, p.182: Autofire and Strafe volleys take 2 shots each, up to half the shots left.
  const rock = (facts.feats ?? []).includes("Rock and Roll") && ["autofire", "strafe"].includes(action);
  const rule = rock ? rockAndRollRule(FIRE_ACTIONS[action]) : FIRE_ACTIONS[action];
  const stop = reason => ({ action, blocked: true, reason, attack: 0, extraRecoil: 0, error: 0, shots: 0, notes: [] });
  if (!rule) return stop(loc`Choose a listed fire action.`);
  if (!facts.firearm) return stop(loc`This action needs a firearm.`);
  const feats = facts.feats ?? [];
  // Autofire Mastery, p.180: Burst and Two-Shot Burst add no error range.
  const burstError = feats.includes("Autofire Mastery") ? 0 : 1;
  if (action === "twoShotBurst") {
    if (!feats.includes(rule.feat)) return stop(loc`Two-Shot Burst needs Autofire Basics.`);
    if (!rule.modes.includes(facts.fireMode)) return stop(loc`A Two-Shot Burst is fired in Single-Shot or Burst mode.`);
    if (facts.attackAction !== "standard") return stop(loc`A Two-Shot Burst is a trick on a Standard Attack.`);
    const left =
      facts.unlimitedShots || shotsRemaining === null || shotsRemaining === "" ? null : count(Number(shotsRemaining));
    if (left !== null && left < rule.shots) return stop(loc`A Two-Shot Burst needs 2 shots in the weapon.`);
    return {
      action,
      blocked: false,
      attack: 0,
      extraRecoil: 0,
      error: burstError,
      shots: rule.shots,
      notes: [
        loc`Two-Shot Burst: 2 shots${burstError ? loc`, error range +1` : ""}. One shot hits; two if the result beats Defense by 5; never a third (p.180).`
      ]
    };
  }
  if (rule.mode && facts.fireMode !== rule.mode)
    return stop(
      rule.mode === "burst"
        ? loc`A Burst needs the weapon set to Burst mode.`
        : loc`This action needs the weapon set to Full Auto mode.`
    );
  const remaining =
    facts.unlimitedShots || shotsRemaining === null || shotsRemaining === "" ? null : count(Number(shotsRemaining));
  if (remaining !== null && (!Number.isSafeInteger(remaining) || remaining < 0))
    return stop(loc`Enter the shots left in the weapon as a whole number.`);
  if (action === "burst") {
    if (facts.attackAction !== "standard") return stop(loc`A Burst is a trick on a Standard Attack.`);
    if (remaining !== null && remaining < rule.shots) return stop(loc`A Burst needs 3 shots in the weapon.`);
    return {
      action,
      blocked: false,
      attack: 0,
      extraRecoil: 0,
      error: burstError,
      shots: rule.shots,
      notes: [
        loc`Burst: 3 shots, error range +${burstError}. One shot hits; two if the result beats Defense by 5, all three by 10. A critical hit applies only the first shot to wounds (p.354).`
      ]
    };
  }
  if (action === "suppressiveFinal") {
    return {
      action,
      blocked: false,
      attack: rule.attack,
      extraRecoil: 0,
      error: rule.error,
      shots: rule.shots,
      notes: [loc`Suppressive Fire: final attack at –4 on an opponent crossing the square; no Aim bonus (p.361).`]
    };
  }
  if (remaining === null && !facts.unlimitedShots) return stop(loc`Enter the shots left in the weapon.`);
  const limit = facts.unlimitedShots
    ? Math.min(rule.most, Math.floor(Number.MAX_SAFE_INTEGER / rule.shotsEach))
    : fireActionLimit(action, remaining, rule);
  if (!limit)
    return stop(
      action === "autofire"
        ? loc`Autofire needs ${rule.minimumShots} or more shots in the weapon.`
        : loc`Strafe needs ${rule.minimumShots} or more shots in the weapon.`
    );
  const chosen = count(Number(action === "autofire" ? volleys : squares));
  if (!Number.isSafeInteger(chosen) || chosen < 1 || chosen > limit)
    return stop(
      action === "autofire"
        ? loc`Choose 1 to ${limit} volleys (${rule.shotsEach} shots each${rock ? "" : loc`, 10 at most`}).`
        : loc`Choose 1 to ${limit} squares (${rule.shotsEach} shots each${rock ? "" : loc`, 10 at most`}).`
    );
  if (action === "autofire")
    return {
      action,
      blocked: false,
      volleys: chosen,
      attack: -chosen,
      extraRecoil: 0,
      error: rule.error,
      shots: chosen * rule.shotsEach,
      notes: [
        loc`Autofire: ${chosen} volley(s), ${chosen * rule.shotsEach} shots, attack –${chosen}, error range +2. One shot hits, plus one more for each 4 points the result is over Defense, up to ${chosen}. A critical hit applies only the first shot to wounds (p.353).`
      ]
    };
  // The check's recoil penalty counts twice.
  const recoil = Math.min(0, Number(facts.recoilPenalty) || 0);
  return {
    action,
    blocked: false,
    squares: chosen,
    attack: 0,
    extraRecoil: recoil,
    error: rule.error,
    shots: chosen * rule.shotsEach,
    notes: [
      loc`Strafe: ${chosen} adjacent square(s), ${chosen * rule.shotsEach} shots, recoil penalty doubled (${2 * recoil} in all), error range +2. One result against each target in turn, whose Defense rises by 2 for each target so far. A critical hit applies to one opponent's wounds (p.359).`
    ]
  };
}

/** Shots of a Burst that hit: 1, 2 at Defense +5, 3 at Defense +10. */
export function burstHits(attackTotal, defense, maxHits = 3) {
  const margin = attackTotal - defense;
  return Math.min(maxHits, margin < 0 ? 0 : margin >= 10 ? 3 : margin >= 5 ? 2 : 1);
}

/** Shots of an Autofire attack that hit: 1, plus 1 per 4 over Defense (per 3 with Autofire Supremacy), up to the volleys. */
export function autofireHits(attackTotal, defense, volleys, { perPoints = 4 } = {}) {
  const margin = attackTotal - defense;
  if (margin < 0 || !Number.isSafeInteger(volleys) || volleys < 1) return 0;
  return Math.min(volleys, 1 + Math.floor(margin / perPoints));
}

/** A Strafe against each target in order: Defense rises by 2 per target so far, counting the target itself. */
export function strafeHits(attackTotal, defenses = [], { step = 2 } = {}) {
  return defenses.map((defense, index) => {
    const raised = defense + step * (index + 1);
    return { index, defense, raised, hit: attackTotal >= raised };
  });
}

/** The Will save DC a Cover Fire target faces. */
export function coverFireDC(rangedAttackBonus) {
  return COVER_FIRE.base + (Math.trunc(Number(rangedAttackBonus)) || 0);
}

/** What a Cover Fire target's save leads to. */
export function coverFireOutcome(dc, saveTotal) {
  const failed = saveTotal < dc;
  return {
    failed,
    penalty: failed ? COVER_FIRE.penalty : 0,
    finalAttack: failed && dc - saveTotal >= COVER_FIRE.finalAttackMargin
  };
}

/** Blast damage a number of increments out from Ground Zero: halved, rounded down, each time. */
export function blastDamage(damage, increments) {
  let value = Math.max(0, Math.trunc(Number(damage) || 0));
  for (let i = 0; i < Math.max(0, Math.trunc(Number(increments) || 0)); i++) value = Math.floor(value / 2);
  return value;
}

/** The whole taper of a blast: [{ increment, fromFeet, toFeet, damage }] while 1 or more remains. */
export function blastProfile(damage, incrementFeet = 5) {
  const rows = [],
    step = Math.max(5, Math.trunc(Number(incrementFeet) || 5));
  for (let increment = 0; increment < 32; increment++) {
    const value = blastDamage(damage, increment);
    if (value < 1) break;
    rows.push({ increment, fromFeet: increment * step, toFeet: (increment + 1) * step, damage: value });
  }
  return rows;
}

/** A blast increment in feet from a weapon's qualities ("BLS (25 ft.)"), or the default single square. */
export function blastIncrementFeet(qualities = "", campaignEffects = campaignRules()) {
  const match = String(qualities).match(/\bBLS\s*\((\d[\d,]*)\s*ft\.?/i);
  const multiplier = campaignEffects.blastIncrementMultiplier ?? 1;
  if (!Number.isFinite(multiplier) || multiplier < 1)
    throw new Error(loc`Review the campaign's blast-increment multiplier.`);
  return (match ? Number(match[1].replace(/,/g, "")) : 5) * multiplier;
}

/* -------------------------------------------- */
/*  Grapple                                      */
/* -------------------------------------------- */

const SIZES = ["Nuisance", "Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal"];

/** Size steps between two characters: positive when the first is bigger. */
export function sizeDifference(size, otherSize) {
  const a = SIZES.indexOf(size),
    b = SIZES.indexOf(otherSize);
  return a < 0 || b < 0 ? 0 : a - b;
}

/** The bigger grappler's bonus: +4 per Size category of difference; the smaller one gets nothing. */
export function grappleSizeBonus(difference) {
  return Math.max(0, Math.trunc(Number(difference) || 0)) * 4;
}

/** Whether a character may start a grapple on a target: adjacent and no more than one Size bigger. */
export function grappleAllowed(difference) {
  return Math.trunc(Number(difference) || 0) >= -1;
}

/** Recorded Size takes precedence over a manual difference; unknown history requires an explicit declaration. */
export function grappleOpeningContext(
  system,
  opponentSystem,
  {
    sizeDifference: declared,
    grappleContextConfirmed = false,
    otherGrapplers = 0,
    heldOpponents = 0,
    secondOpponentBenefit = false
  } = {}
) {
  const knownSize = source => {
    const value = source?.size ?? source?.qualityEffects?.size;
    const base = typeof value === "string" ? value.replace(/\s*\(.*\)$/, "") : "";
    return SIZES.includes(base) ? base : null;
  };
  const size = knownSize(system),
    otherSize = knownSize(opponentSystem);
  const recorded = !!(size && otherSize);
  const difference = recorded ? sizeDifference(size, otherSize) : declared;
  if (grappleContextConfirmed !== true)
    throw new Error(loc`Confirm adjacency and the current participants' Sizes before starting a grapple.`);
  if (!Number.isSafeInteger(difference) || Math.abs(difference) >= SIZES.length)
    throw new Error(loc`Record a valid Size difference for the grapple participants.`);
  if (!grappleAllowed(difference))
    throw new Error(loc`The target is more than one Size category larger; this opening grapple is not allowed.`);
  if (
    !Number.isSafeInteger(heldOpponents) ||
    heldOpponents < 0 ||
    heldOpponents > 2 ||
    heldOpponents >= 2 ||
    (heldOpponents === 1 && secondOpponentBenefit !== true) ||
    (secondOpponentBenefit === true && heldOpponents !== 1)
  )
    throw new Error(
      loc`A new hold requires no held opponent, or exactly one held (not pinned) opponent and the earned second-opponent benefit; never a third target.`
    );
  const limit = grapplerLimit(-difference);
  if (!Number.isSafeInteger(otherGrapplers) || otherGrapplers < 0)
    throw new Error(loc`Enter the actual number of other characters grappling this target.`);
  if (otherGrapplers + 1 > limit)
    throw new Error(loc`This target already has the maximum ${limit} grapplers for the acting character's Size.`);
  return {
    difference,
    size,
    otherSize,
    recorded,
    grapplers: otherGrapplers + 1,
    limit,
    secondOpponent: heldOpponents === 1
  };
}

/** The most characters who may grapple one target, by the target's Size relative to theirs (p.357). */
export function grapplerLimit(targetDifference) {
  if (!Number.isSafeInteger(targetDifference))
    throw new Error(loc`Record a whole Size difference for the grappler limit.`);
  const d = targetDifference;
  return d < 0 ? 2 : d === 0 ? 4 : d === 1 ? 8 : 0;
}

/** Grapple benefits (p.357). Summaries are our own; the page has the full terms. */
export const GRAPPLE_BENEFITS = [
  { id: "breakPin", needs: "pinnedParticipant" },
  { id: "disarm" },
  { id: "draw" },
  { id: "escape", needs: "heldParticipant" },
  { id: "injure" },
  { id: "second" },
  { id: "gear" },
  { id: "move" },
  { id: "mute" },
  { id: "pin" },
  { id: "sprawl" },
  { id: "throw" },
  { id: "useWeapon", needs: "pinnedOpponent" }
];

/**
 * The conditions a chosen grapple benefit changes (p.357): { winner: {add, remove}, loser: {add, remove} }.
 * Benefits with no entry change no condition.
 */
export const GRAPPLE_BENEFIT_CONDITIONS = {
  breakPin: { winner: { remove: ["pinned"], add: ["held"] } },
  escape: { winner: { remove: ["held", "pinned"] } },
  mute: { loser: { add: ["mute"] } },
  pin: { loser: { add: ["pinned"] } },
  sprawl: { loser: { add: ["sprawled"] }, winner: { add: ["prone"] } },
  throw: { loser: { add: ["sprawled"], remove: ["held", "pinned"] } }
};

/** What chosen benefits do to each side's conditions, in order: [{ side, id, active }]. */
export function grappleBenefitChanges(benefits = []) {
  const changes = [];
  for (const id of benefits) {
    if (!GRAPPLE_BENEFITS.some(benefit => benefit.id === id)) throw new Error(loc`Choose a listed grapple benefit.`);
    for (const side of ["winner", "loser"]) {
      const effect = GRAPPLE_BENEFIT_CONDITIONS[id]?.[side];
      for (const condition of effect?.remove ?? []) changes.push({ side, id: condition, active: false });
      for (const condition of effect?.add ?? []) changes.push({ side, id: condition, active: true });
    }
  }
  return changes;
}

/** Check ordered prerequisites before any benefit changes conditions or rolls damage. */
export function grappleBenefitEligibility(
  benefits,
  {
    winnerStatuses = [],
    loserStatuses = [],
    winnerUuid = "winner",
    loserUuid = "loser",
    recipients = [],
    recipientsConfirmed = false
  } = {}
) {
  const winner = new Set(winnerStatuses),
    loser = new Set(loserStatuses),
    participants = new Map([
      [winnerUuid, winner],
      [loserUuid, loser]
    ]),
    result = [];
  for (const recipient of recipients) {
    if (recipient?.uuid && !participants.has(recipient.uuid))
      participants.set(recipient.uuid, new Set(recipient.statuses ?? []));
  }
  for (const [index, id] of benefits.entries()) {
    if (!GRAPPLE_BENEFITS.some(b => b.id === id)) throw Error(loc`Choose a listed grapple benefit.`);
    const recipient = recipients[index],
      assisted = recipient?.uuid && recipient.uuid !== winnerUuid;
    if (assisted && (!["breakPin", "escape"].includes(id) || recipientsConfirmed !== true))
      throw Error(
        loc`Only Break Pin or Escape Hold may help another participant. Confirm the actual recipient belongs to this grapple.`
      );
    const freed = assisted ? participants.get(recipient.uuid) : winner,
      held = loser.has("held") || loser.has("pinned"),
      pinned = loser.has("pinned");
    if (
      (id === "breakPin" && !freed.has("pinned")) ||
      (id === "escape" && !freed.has("held") && !freed.has("pinned")) ||
      (id === "useWeapon" && !pinned) ||
      (["injure", "pin", "mute", "sprawl", "throw"].includes(id) && !held)
    )
      throw Error(
        loc`This benefit needs an actual held or pinned participant in the chosen order. Review the current grapple.`
      );
    result.push({ heldTarget: held, pinnedTarget: pinned, ...(assisted ? { recipientUuid: recipient.uuid } : {}) });
    for (const change of grappleBenefitChanges([id])) {
      const statuses = change.side === "winner" ? (["breakPin", "escape"].includes(id) ? freed : winner) : loser;
      if (change.active) statuses.add(change.id);
      else statuses.delete(change.id);
    }
  }
  return result;
}

/** Names and one-line summaries of the grapple benefits, in the reader's language. */
export function grappleBenefitText(id) {
  return {
    breakPin: [loc`Break Pin`, loc`A pinned participant is freed from the pin but stays held.`],
    disarm: [loc`Disarm`, loc`A held or pinned opponent drops one weapon in the grapple square.`],
    draw: [loc`Draw Weapon/Item`, loc`Draw a one-handed weapon or object; anything already in hand falls.`],
    escape: [loc`Escape Hold`, loc`A held participant gets free and must at once move 5 ft. or more.`],
    injure: [loc`Injure Opponent`, loc`Deal unarmed damage, or the damage of a one-handed weapon in hand.`],
    second: [loc`Grapple Second Opponent`, loc`Start a grapple on an adjacent opponent at –4; two at most.`],
    gear: [loc`Manipulate Opponent's Gear`, loc`Use one exposed non-weapon item the opponent carries.`],
    move: [loc`Move`, loc`A 5-ft. step with held opponents, or a Standard Move when all are pinned.`],
    mute: [loc`Mute`, loc`Silence the opponent, at –2 to your own Athletics checks while it lasts.`],
    pin: [loc`Pin`, loc`A held opponent becomes pinned.`],
    sprawl: [loc`Sprawl Opponent`, loc`The opponent is sprawled and takes 1d4 + Str subdual; you end prone.`],
    throw: [
      loc`Throw`,
      loc`Empty adjacent square; standard unarmed damage + Str bonus (min +1); sprawled and released.`
    ],
    useWeapon: [loc`Use Opponent's Weapon`, loc`Turn a pinned opponent's one-handed weapon on its wielder.`]
  }[id];
}

/**
 * The result of an opposed grapple check.
 * @param {object} check { opening: the check that starts the grapple, total, opponentTotal, critical,
 *                         opponentCriticalFailure, opponentCritical, criticalFailure }
 * @returns {{winner: "actor"|"opponent"|"tie", benefits: number, effects: string[]}}
 */
export function grappleOutcome({
  opening = false,
  total,
  opponentTotal,
  critical = false,
  criticalFailure = false,
  opponentCritical = false,
  opponentCriticalFailure = false
} = {}) {
  if (!Number.isFinite(total) || !Number.isFinite(opponentTotal))
    throw new Error(loc`Both Athletics results are needed to settle a grapple.`);
  // A critical failure loses the check whatever the totals.
  const winner =
    criticalFailure && !opponentCriticalFailure
      ? "opponent"
      : opponentCriticalFailure && !criticalFailure
        ? "actor"
        : total > opponentTotal
          ? "actor"
          : total < opponentTotal
            ? "opponent"
            : "tie";
  if (winner === "tie") return { winner, benefits: 0, effects: [loc`The results are equal: nothing changes.`] };
  const decisive = winner === "actor" ? critical || opponentCriticalFailure : opponentCritical || criticalFailure;
  if (!opening)
    return {
      winner,
      benefits: decisive ? 2 : 1,
      effects: [
        winner === "actor"
          ? loc`You win the check and gain ${decisive ? 2 : 1} grapple benefit(s).`
          : loc`The opponent wins the check and gains ${decisive ? 2 : 1} grapple benefit(s).`
      ]
    };
  if (winner === "actor")
    return {
      winner,
      benefits: decisive ? 1 : 0,
      effects: [
        loc`The opponent is held in their own square; while the hold lasts you are vulnerable.`,
        ...(decisive ? [loc`A decisive win: gain 1 grapple benefit at once.`] : [])
      ]
    };
  return {
    winner,
    benefits: 0,
    effects: [
      decisive
        ? loc`You are pushed back to your own square and become sprawled.`
        : loc`You are pushed back to your own square and become flat-footed.`
    ]
  };
}

/* -------------------------------------------- */
/*  Pummel                                       */
/* -------------------------------------------- */

/** Pummel on an unarmed Standard Attack: double subdual damage, and a harder knockout save. */
export function pummelPlan(facts = {}, { pummel = false, strengthMod = 0 } = {}) {
  if (!pummel) return null;
  const stop = reason => ({ blocked: true, reason, notes: [] });
  if (!facts.unarmed) return stop(loc`Pummel is an unarmed attack.`);
  if (facts.attackAction !== "standard") return stop(loc`Pummel is made as an unarmed Standard Attack.`);
  const saveIncrease = Math.max(1, Math.trunc(Number(strengthMod) || 0));
  return {
    blocked: false,
    saveIncrease,
    notes: [
      loc`Pummel: a full action against an adjacent opponent. A hit deals double subdual damage, never lethal, and the knockout save DC rises by ${saveIncrease} (p.358).`
    ]
  };
}

// The declared fire action or Pummel as a term of the attack plan.
rollPipeline.register({ id: "combatActionsRecord", order: 9598, record: ["pummelDamage"] });
rollPipeline.register({
  id: "fireActionAttackTerm",
  kinds: ["attack"],
  order: 9140,
  terms({ system, weapon, options, firing, stance }) {
    const plan = fireActionPlan(
      {
        firearm: firing.firearm || steelRainWeapon(system, weapon),
        flamethrower: weapon.weaponCategory === "flamethrower",
        fireMode: firing.firearm ? firing.fireMode : "burst",
        attackAction: stance.attackAction,
        feats: system.activeFeatNames ?? [],
        recoilPenalty: firing.recoilPenalty,
        unlimitedShots: unlimitedAmmunition(weapon, system.campaignEffects)
      },
      {
        action: options.fireAction ?? "",
        volleys: options.fireVolleys ?? null,
        squares: options.fireSquares ?? null,
        shotsRemaining: unlimitedAmmunition(weapon, system.campaignEffects) ? null : (options.shotsRemaining ?? null)
      }
    );
    const pummel = pummelPlan(
      {
        unarmed: weapon.proficiency === "unarmed" || /\bNKL\b/.test(weapon.qualities ?? ""),
        attackAction: stance.attackAction
      },
      { pummel: options.pummel === true, strengthMod: system.abilities?.str?.mod ?? 0 }
    );
    const blocked = [plan, pummel].find(part => part?.blocked);
    const specialty = specialtyAttackBonus(
      system,
      specialtyAttackAction(plan && !plan.blocked ? plan.action : "", pummel && !pummel.blocked)
    );
    return [
      {
        key: "fireAction",
        plan: plan && !plan.blocked ? plan : null,
        rowAt: 255,
        rows: [
          ...(plan
            ? [
                [loc`Fire action`, plan.attack],
                [loc`Strafe recoil`, plan.extraRecoil]
              ]
            : []),
          ...(specialty ? [[loc`Specialty: ${system.specialtyName}`, specialty]] : [])
        ],
        error: plan?.error ?? 0,
        blockAt: 195,
        blocked: blocked?.reason ?? "",
        noteAt: 495,
        notes: [
          ...(plan?.notes ?? []),
          ...(pummel?.notes ?? []),
          // Shadow Walk (Spirit Supremacy, p.187).
          ...(pummel && !pummel.blocked && system.activeFeatNames?.includes("Spirit Supremacy")
            ? [
                loc`Shadow Walk: you may first move up to your Speed, and opponents and the squares around them don’t block you (p.187).`
              ]
            : [])
        ]
      },
      { key: "pummel", plan: pummel && !pummel.blocked ? pummel : null }
    ];
  }
});
