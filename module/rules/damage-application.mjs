/**
 * An attack settled against its target, and its damage taken by that target (pp.328–333).
 *
 * Pure rules: what a result does against a Defense, what a weapon's printed damage says about its kind and
 * armor-piercing value, and what a hit does to a special character's vitality and wounds. The Foundry side is in
 * module/apps/damage-application.mjs.
 */
import { criticalInjuryBand } from "./campaign-rules.mjs";
import { autofireHits, burstHits } from "./combat-actions.mjs";
import { accumulatedDamagePlan } from "./accumulated-damage.mjs";
import { loc } from "../i18n.mjs";

const whole = value => Number.isSafeInteger(value) && value >= 0;
const int = value => Math.trunc(Number(value) || 0);

/**
 * An attack result against a Defense: equal or higher hits. A natural 20 does not hit by itself and a natural 1
 * does not miss by itself (pp.329–330).
 * @param {object} facts { total, defense, fireAction: the attack's declared fire action or null, feats }
 * @returns {{hit: boolean, margin: number, hits: number}} hits counts the shots of a Burst or Autofire that land
 */
export function attackOutcome({ total, defense, fireAction = null, feats = [] } = {}) {
  if (!Number.isFinite(total)) throw new Error(loc`This attack has no result to compare.`);
  if (!Number.isSafeInteger(defense) || defense < 0) throw new Error(loc`Enter the target's Defense, 0 or more.`);
  const margin = total - defense,
    hit = margin >= 0;
  let hits = hit ? 1 : 0;
  if (hit && fireAction?.action === "burst") hits = burstHits(total, defense);
  else if (hit && fireAction?.action === "twoShotBurst") hits = burstHits(total, defense, 2);
  else if (hit && fireAction?.action === "autofire")
    hits = autofireHits(total, defense, fireAction.volleys, {
      perPoints: feats.includes("Autofire Supremacy") ? 3 : 4
    });
  return { hit, margin, hits };
}

/**
 * What a printed damage entry and quality list say about a hit, as starting values for the GC to correct.
 * @returns {{kind: "lethal"|"subdual", type: string, armorPiercing: number, blast: boolean}}
 */
export function damageProfile(damageText = "", qualities = "") {
  const text = String(damageText ?? ""),
    tags = String(qualities ?? "");
  const type = ["explosive", "electrical", "flash", "bang", "fire"].find(word => new RegExp(word, "i").test(text));
  const piercing = text.match(/AP\s*\(?\s*(\d+)/i) ?? tags.match(/\bAP\s*\(?\s*(\d+)/);
  return {
    kind: /\bsub(dual)?\b/i.test(text) ? "subdual" : "lethal",
    type: type ?? "",
    armorPiercing: piercing ? Number(piercing[1]) : 0,
    blast: /\bBLS\b/.test(tags)
  };
}

/** The note an attack card carries once it has been settled against a Defense. */
export function attackResolutionNote(check) {
  const r = check?.attackResolution;
  if (!r) return "";
  if (r.defenseHidden) {
    const who = r.targetName || loc`the target`;
    if (!r.hit) return loc`Against ${who}: a miss.`;
    return r.hits > 1 ? loc`Against ${who}: a hit; ${r.hits} shots hit.` : loc`Against ${who}: a hit.`;
  }
  const base = r.targetName ? loc`${r.targetName}'s Defense ${r.defense}` : loc`Defense ${r.defense}`;
  const against = r.cover ? loc`${base} (with ${r.cover.label} cover, +${r.cover.bonus})` : base;
  if (!r.hit && r.hitsCover) return loc`Against ${against}: a miss by ${-r.margin}. The shot hits the cover.`;
  if (!r.hit) return loc`Against ${against}: a miss by ${-r.margin}.`;
  return r.hits > 1
    ? loc`Against ${against}: a hit by ${r.margin}; ${r.hits} shots hit.`
    : loc`Against ${against}: a hit by ${r.margin}.`;
}

/** Damage after damage reduction, which armor-piercing lowers first (p.332). */
export function reducedDamage({ damage, dr = 0, armorPiercing = 0, armorPiercingAll = false } = {}) {
  if (!whole(damage)) throw new Error(loc`Enter the damage as a whole number, 0 or more.`);
  if (!whole(dr) || !whole(armorPiercing))
    throw new Error(loc`Enter damage reduction and armor-piercing as whole numbers.`);
  const effectiveDR = armorPiercingAll ? 0 : Math.max(0, dr - armorPiercing),
    net = Math.max(0, damage - effectiveDR);
  return { damage, dr: effectiveDR, net, stopped: damage > 0 && net === 0 };
}

/** The ready-made critical effects that buy a Table of Ouch injury instead of wounds (p.329). */
const OUCH_PRESETS = new Set(["hit.ouch", "hit.ouchAtZero"]);

/**
 * What an activated critical hit sets when one of its damage cards is applied.
 * - Its size is the effect bought (its base cost), not the dice paid: discounts and a Shaken surcharge change the price,
 *   not the effect. A standard NPC fails that many more Damage saves (pp.329, 332).
 * - A Table of Ouch effect replaces the wounds effect, so the damage is applied normally and the injury is rolled.
 * - Only the first shot of a Burst or Autofire is critical (pp.354-355); once one card has applied it as a critical
 *   hit, the attack's other cards default to normal hits.
 * @param {object|null} attack       the attack card's flags.spycraft2
 * @param {string} [damageMessageId] the damage card being applied
 * @returns {{critical: boolean, criticalDice: number, ouch: boolean, laterShot: boolean}}
 */
export function criticalDamageDefaults(attack, damageMessageId = "") {
  const none = { critical: false, criticalDice: 0, ouch: false, laterShot: false };
  if (attack?.criticalSuccess !== true) return none;
  const activation = attack.criticalActivation ?? {},
    dice = Math.max(1, Math.trunc(Number(activation.baseCost ?? activation.cost) || 1)),
    taken = attack.criticalShotApplied?.damageMessageId;
  if ((Number(attack.attackResolution?.hits) || 1) > 1 && taken && taken !== damageMessageId)
    return { ...none, laterShot: true };
  if (OUCH_PRESETS.has(activation.preset)) return { ...none, ouch: true };
  return { critical: true, criticalDice: dice, ouch: false, laterShot: false };
}

/**
 * Every "damage applied" record on a damage card. Records used to be one array, rewritten whole on each apply, so two
 * close applies could drop one; new records are keyed under damageAppliedBy, and old cards keep their array.
 * @param {object} check  the card's flags.spycraft2
 */
export function appliedDamageEntries(check = {}) {
  const keyed = check?.damageAppliedBy && typeof check.damageAppliedBy === "object" ? check.damageAppliedBy : {};
  return [...(Array.isArray(check?.damageApplied) ? check.damageApplied : []), ...Object.values(keyed)];
}

/**
 * The condition a wound total puts a special character in (p.331), or "" while above 0.
 * @param {number} wounds
 * @param {number} [death]  the wound total at which this character dies: -10, or another value for its Size (p.349)
 */
export function woundState(wounds, death = -10) {
  const threshold = Number.isSafeInteger(death) && death < 0 ? death : -10;
  if (wounds <= -25) return "destroyed";
  if (wounds <= threshold) return "dead";
  if (wounds <= -1) return "dying";
  if (wounds === 0) return "unconscious";
  return "";
}

/**
 * Lethal damage on a special character (p.331): vitality first, wounds once vitality is gone, and straight to
 * wounds for a critical hit while vitality remains.
 * @param {object} facts  { vitality, wounds, woundsMax }
 * @param {object} hit    { damage, dr, armorPiercing, armorPiercingAll, critical }
 */
export function lethalHitPlan(facts = {}, hit = {}) {
  const vitality = Math.max(0, int(facts.vitality)),
    wounds = int(facts.wounds),
    woundsMax = int(facts.woundsMax),
    death = facts.deathThreshold;
  const reduced = reducedDamage(hit),
    net = reduced.net,
    band = hit.injuryBand ?? criticalInjuryBand();
  const toWounds = hit.critical === true && vitality > 0,
    vitalityLoss = toWounds ? 0 : Math.min(vitality, net),
    woundLoss = net - vitalityLoss;
  const after = { vitality: vitality - vitalityLoss, wounds: wounds - woundLoss };
  // Fatigue comes once: when vitality first reaches 0 or wounds first drop below their maximum.
  const wasWorn = vitality === 0 || wounds < woundsMax,
    isWorn = after.vitality === 0 || after.wounds < woundsMax;
  const before = woundState(wounds, death),
    state = woundLoss > 0 || before ? woundState(after.wounds, death) : "";
  return {
    ...reduced,
    critical: toWounds,
    vitalityLoss,
    woundLoss,
    vitality: after.vitality,
    wounds: after.wounds,
    fatigued: net > 0 && !wasWorn && isWorn,
    state,
    stateChanged: state !== before,
    // DR that stops a hit still bruises: 1 point of subdual damage (p.332).
    bruise: reduced.stopped ? 1 : 0,
    // One hit of 25 or more calls for a Fortitude save against a critical injury; 50 or more also threatens –9 wounds.
    // Bulletproof and Gritty move both numbers (p.406).
    massive:
      net >= band.min
        ? { dc: Math.floor(net / 2), toMinusNine: net >= band.massive, min: band.min, threshold: band.massive }
        : null
  };
}

/** The lines that report a lethal hit on a special character. */
export function lethalHitLines(name, plan) {
  const lines = [];
  if (plan.stopped) lines.push(loc`${name}: damage reduction ${plan.dr} stops all ${plan.damage} damage.`);
  else
    lines.push(
      plan.dr
        ? loc`${name} takes ${plan.net} damage (${plan.damage} less damage reduction ${plan.dr}).`
        : loc`${name} takes ${plan.net} damage.`
    );
  if (plan.critical) lines.push(loc`Critical hit: the damage goes to wounds.`);
  if (plan.vitalityLoss) lines.push(loc`Vitality –${plan.vitalityLoss}, now ${plan.vitality}.`);
  if (plan.woundLoss) lines.push(loc`Wounds –${plan.woundLoss}, now ${plan.wounds}.`);
  if (plan.fatigued) lines.push(loc`Becomes fatigued.`);
  if (plan.stateChanged && plan.state === "unconscious") lines.push(loc`At 0 wounds: unconscious.`);
  if (plan.stateChanged && plan.state === "dying") lines.push(loc`Below 0 wounds: unconscious and dying.`);
  if (plan.stateChanged && plan.state === "dead") lines.push(loc`At –10 wounds or lower: dead.`);
  if (plan.stateChanged && plan.state === "destroyed") lines.push(loc`At –25 wounds or lower: the body is destroyed.`);
  if (plan.massive)
    lines.push(
      plan.massive.toMinusNine
        ? loc`A hit of ${plan.massive.threshold ?? 50} or more: Fortitude save DC ${plan.massive.dc}; on a failure roll a critical injury and wounds drop to –9 (p.331).`
        : loc`A hit of ${plan.massive.min ?? 25} or more: Fortitude save DC ${plan.massive.dc}; on a failure roll a critical injury (p.331).`
    );
  return lines;
}

/** Which DR column an attack uses: armor lists one value against melee and another against everything else. */
export function drForAttack(system = {}, attackKind = "other") {
  const listed = system.armorDRByAttack?.[attackKind];
  if (whole(listed)) return listed;
  const melee = ["unarmed", "meleeWeapon"].includes(attackKind);
  const fromArmor = melee ? system.dr?.melee : system.dr?.other;
  if (whole(fromArmor)) return fromArmor;
  return whole(system.qualityEffects?.damageReduction) ? system.qualityEffects.damageReduction : 0;
}

/** The DR category of a weapon, from its proficiency and whether the attack was ranged. */
export function attackKindOf({ proficiency = "", ranged = false, unarmed = false, blast = false } = {}) {
  if (unarmed || proficiency === "unarmed") return "unarmed";
  // A grenade or other blast is not a "non-grenade hurled weapon": it takes the "other damage" column.
  if (blast) return "other";
  if (["hurled", "exoticHurled"].includes(proficiency)) return "hurledWeapon";
  const melee = ["blunt", "exoticBlunt", "edged", "exoticEdged"].includes(proficiency);
  // A melee weapon used at range was thrown.
  if (ranged) return melee ? "hurledWeapon" : "rangedWeapon";
  if (melee) return "meleeWeapon";
  return proficiency ? "rangedWeapon" : "other";
}

/* -------------------------------------------- */
/*  Healing                                      */
/* -------------------------------------------- */

/**
 * Rest for a special character (p.333): vitality by the hour and wounds by the day, never past the maximum.
 * @param {object} facts { vitality, vitalityMax, wounds, woundsMax }
 * @param {object} rest  { hours, days, vitalityPerHour, woundsPerDay }
 */
export function restPlan(facts = {}, { hours = 0, days = 0, vitalityPerHour = 0, woundsPerDay = 0 } = {}) {
  if (![hours, days].every(n => Number.isFinite(n) && n >= 0))
    throw new Error(loc`Enter the hours and days of rest, 0 or more.`);
  if (![vitalityPerHour, woundsPerDay].every(n => Number.isFinite(n) && n >= 0))
    throw new Error(loc`The recovery rates must be 0 or more.`);
  const vitality = Math.min(int(facts.vitalityMax), int(facts.vitality) + Math.floor(vitalityPerHour * hours)),
    wounds = Math.min(int(facts.woundsMax), int(facts.wounds) + Math.floor(woundsPerDay * days));
  return {
    vitality: Math.max(int(facts.vitality), vitality),
    wounds: Math.max(int(facts.wounds), wounds),
    vitalityGain: Math.max(0, vitality - int(facts.vitality)),
    woundGain: Math.max(0, wounds - int(facts.wounds))
  };
}

/**
 * A successful First Aid check on a special character (pp.141, 333): rolled wounds and subdual damage back, and
 * vitality equal to career level.
 * @param {object} facts  { vitality, vitalityMax, wounds, woundsMax, subdual, level }
 * @param {object} rolled { wounds, subdual } — each a 1d4+1 result
 */
export function firstAidPlan(facts = {}, rolled = {}) {
  if (![rolled.wounds, rolled.subdual].every(n => Number.isSafeInteger(n) && n >= 2 && n <= 5))
    throw new Error(loc`First Aid restores 1d4+1 wounds and 1d4+1 subdual damage.`);
  const level = Math.max(0, int(facts.level));
  const vitality = Math.min(int(facts.vitalityMax), int(facts.vitality) + level),
    wounds = Math.min(int(facts.woundsMax), int(facts.wounds) + rolled.wounds),
    subdual = Math.max(0, int(facts.subdual) - rolled.subdual);
  return {
    vitality: Math.max(int(facts.vitality), vitality),
    wounds: Math.max(int(facts.wounds), wounds),
    subdual,
    vitalityGain: Math.max(0, vitality - int(facts.vitality)),
    woundGain: Math.max(0, wounds - int(facts.wounds)),
    subdualHealed: int(facts.subdual) - subdual
  };
}

/** First Aid on a standard character: half the accumulated damage goes, rounded up (p.333). */
export function firstAidStandard(accumulated) {
  if (!whole(accumulated)) throw new Error(loc`Enter the damage as a whole number.`);
  const healed = Math.ceil(accumulated / 2);
  return { healed, accumulated: accumulated - healed };
}

/* -------------------------------------------- */
/*  Opposed checks                               */
/* -------------------------------------------- */

/**
 * Two results of an opposed check (p.91): the higher wins; equal results go to the higher bonus when a winner is
 * needed, and stay tied when the bonuses are equal too (a d20 roll-off then decides).
 * @returns {"first"|"second"|"tie"}
 */
export function opposedOutcome(first = {}, second = {}, { breakTies = true } = {}) {
  if (!Number.isFinite(first.total) || !Number.isFinite(second.total))
    throw new Error(loc`Both results are needed to settle an opposed check.`);
  if (first.total !== second.total) return first.total > second.total ? "first" : "second";
  if (!breakTies || !Number.isFinite(first.bonus) || !Number.isFinite(second.bonus)) return "tie";
  if (first.bonus !== second.bonus) return first.bonus > second.bonus ? "first" : "second";
  return "tie";
}

/**
 * A dying character's roll at the end of a round (p.341): d% at or under Constitution stabilizes at 0 wounds;
 * otherwise 1 more wound is lost.
 */
export function dyingPlan({ wounds, constitution, deathThreshold = -10 } = {}, roll) {
  if (!Number.isSafeInteger(wounds) || woundState(wounds, deathThreshold) !== "dying")
    throw new Error(loc`Only a dying character (below 0 wounds, above the death threshold) rolls to stabilize.`);
  if (!Number.isSafeInteger(roll) || roll < 1 || roll > 100) throw new Error(loc`Roll d% for a dying character.`);
  const stabilized = roll <= int(constitution),
    after = stabilized ? 0 : wounds - 1;
  return { stabilized, wounds: after, state: woundState(after, deathThreshold) };
}

/** The note a check carries once it has been compared with an opposing result. */
export function opposedNote(check) {
  const o = check?.opposed;
  if (!o) return "";
  const against = o.name ? loc`${o.name}'s ${o.total}` : loc`${o.total}`;
  return o.outcome === "tie"
    ? loc`Opposed by ${against}: a tie.`
    : o.outcome === "won"
      ? loc`Opposed by ${against}: won.`
      : loc`Opposed by ${against}: lost.`;
}

/* -------------------------------------------- */
/*  Stress and subdual damage without a ledger   */
/* -------------------------------------------- */

/**
 * Stress or subdual damage on a character whose running totals are plain numbers (a special NPC), pp.339–340.
 * Damage reduction is twice as effective against subdual damage; stress damage ignores it.
 * @param {object} system  the character's system data (thresholds or attribute scores)
 * @param {object} totals  { stress, subdual } accumulated so far
 * @param {object} hit     { kind, damage, dr, armorPiercing, armorPiercingAll, critical }
 */
export function nonLethalHitPlan(system, totals = {}, hit = {}) {
  const kind = hit.kind;
  if (!["stress", "subdual"].includes(kind)) throw new Error(loc`Choose stress or subdual damage.`);
  const reduced =
    kind === "subdual"
      ? reducedDamage({
          damage: hit.damage,
          dr: hit.armorPiercingAll ? 0 : 2 * Math.max(0, int(hit.dr) - int(hit.armorPiercing)),
          armorPiercing: 0
        })
      : reducedDamage({ damage: hit.damage });
  const current = Math.max(0, int(totals[kind]));
  const plan = accumulatedDamagePlan(system, {
    kind,
    currentDamage: current,
    newDamage: reduced.net,
    criticalHit: hit.critical === true,
    confirmed: true
  });
  return { ...plan, ...reduced, damage: hit.damage, totals: { ...totals, [kind]: plan.total } };
}

const KNOCKOUT_UNITS = ["round", "minute", "hour", "day", "week"];
/** How long a failed subdual save knocks a character out: the band's unit × half the margin (p.339), at least 1. */
export function knockoutDuration(base, dc, result) {
  const unit = KNOCKOUT_UNITS.find(word => String(base ?? "").includes(word));
  if (!unit || !Number.isFinite(dc) || !Number.isFinite(result)) return null;
  return { count: Math.max(1, Math.floor((dc - result) / 2)), unit };
}

/**
 * Stress or subdual damage wearing off outside combat (Tables 5.8 and 5.9): the highest threshold still exceeded
 * sets the rate, so recovery speeds up as the total falls.
 * @param {number} total    accumulated damage now
 * @param {object[]} rates  recoveryRatePlan's rows: [{ thresholdValue, points, seconds }], lowest threshold first
 * @param {number} seconds  time spent out of combat
 */
export function wearOffPlan(total, rates = [], seconds = 0) {
  let left = Math.max(0, int(total)),
    time = Math.max(0, Number(seconds) || 0);
  const usable = rates.filter(row => Number.isFinite(row?.thresholdValue) && row.seconds > 0);
  if (!usable.length) return { total: left, recovered: 0 };
  const start = left;
  for (let guard = 0; guard < 64 && left > 0 && time > 0; guard++) {
    // Below the first threshold the first row's rate still applies.
    const band = usable.findLast(row => left > row.thresholdValue) ?? usable[0];
    if (!(band.points > 0)) break;
    const floor = band === usable[0] ? 0 : band.thresholdValue;
    const needed = Math.ceil((left - floor) / band.points),
      possible = Math.floor(time / band.seconds),
      steps = Math.min(needed, possible);
    if (steps < 1) break;
    left = Math.max(floor, left - steps * band.points);
    time -= steps * band.seconds;
  }
  return { total: left, recovered: start - left };
}

/** Blast damage at a distance from Ground Zero: halved for each whole increment out (p.343). */
export function blastDamageAt(damage, distanceFeet, incrementFeet = 5) {
  const step = Math.max(5, int(incrementFeet) || 5),
    rings = Math.floor(Math.max(0, Number(distanceFeet) || 0) / step);
  let value = Math.max(0, int(damage));
  for (let i = 0; i < rings && value > 0; i++) value = Math.floor(value / 2);
  return { rings, damage: value };
}
