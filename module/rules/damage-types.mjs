/**
 * The damage types other than plain lethal damage (pp.333–340), and the survival hazards that call for a Fortitude
 * save growing harder each time (p.349): suffocation, smoke, sleep loss, hunger, thirst and deep-water pressure.
 *
 * Fire and contagions live in module/rules/hazards.mjs; stress and subdual totals in accumulated-damage.mjs. This
 * module covers the rest:
 *
 *   acid        lethal; Reflex save halves the first hit; it lingers, halving each round and with each wash
 *   bang        a Fortitude DC instead of damage: stunned for half the margin, deafened twice as long
 *   cold, heat  subdual from the surroundings; a failed save also fatigues and costs a temporary attribute point
 *   collision   lethal; a quarter of what is lost comes back as stress
 *   electrical  subdual; a failed save nauseates and costs Initiative Count
 *   explosive   lethal; a Reflex save halves it, a Fortitude save avoids being stunned
 *   flash       a Fortitude DC instead of damage: blinded for a quarter of the margin
 *   laser       lethal; one die fewer per range increment past the first; ignores dodge bonuses
 *   vacuum      5d6 lethal a round; the first round's Fortitude save halves it
 *
 * Most of them also deal stress for the vitality and wounds they take, and several call for a Fortitude save against
 * a point of permanent attribute damage once enough of them has been taken.
 *
 * This module is pure: it plans and never rolls dice or touches documents.
 */
import { loc } from "../i18n.mjs";
import { campaignSkillDC } from "./campaign-rules.mjs";

/** Fortitude save against a lasting injury from heavy damage of one type (pp.333–340). */
export const INJURY_SAVE_DC = 15;

/**
 * What each type does. `stress` is the share of the vitality and wounds lost that also comes back as stress damage;
 * `injuries` are the totals that call for the injury save and what a failure costs.
 */
export const DAMAGE_TYPES = {
  acid: {
    page: 333,
    damage: "lethal",
    stress: { share: 1 / 2, round: "down" },
    injuries: [{ at: 25, ability: "cha" }],
    convertible: false
  },
  bang: { page: 334, damage: "save", save: "fort", armorPiercing: "all" },
  cold: {
    page: 334,
    damage: "subdual",
    armorPiercing: "all",
    injuries: [{ at: 50, ability: "con" }],
    failedSave: { fatigued: true, ability: "con" }
  },
  collision: { page: 334, damage: "lethal", stress: { share: 1 / 4, round: "down" } },
  electrical: {
    page: 335,
    damage: "subdual",
    armorPiercing: "damage",
    stress: { share: 1 / 4, round: "down" },
    injuries: [
      { at: 25, ability: "dex" },
      { at: 50, condition: "paralysis", duration: "2d6" }
    ]
  },
  explosive: {
    page: 336,
    damage: "lethal",
    stress: { share: 1 / 4, round: "down", flat: "1d4" },
    takedownOver: 20,
    convertible: false
  },
  flash: { page: 338, damage: "save", save: "fort", armorPiercing: "all" },
  heat: {
    page: 338,
    damage: "subdual",
    armorPiercing: "all",
    injuries: [{ at: 50, ability: "str" }],
    failedSave: { fatigued: true, ability: "str" }
  },
  laser: {
    page: 338,
    damage: "lethal",
    armorPiercing: "damage",
    stress: { share: 1 / 4, round: "down" },
    convertible: false
  },
  vacuum: {
    page: 340,
    damage: "lethal",
    armorPiercing: "all",
    stress: { share: 1 / 2, round: "up" },
    injuries: [{ at: 25, ability: "wis" }]
  }
};

export const DAMAGE_TYPE_LABELS = {
  get acid() {
    return loc`Acid`;
  },
  get bang() {
    return loc`Bang`;
  },
  get cold() {
    return loc`Cold`;
  },
  get collision() {
    return loc`Collision`;
  },
  get electrical() {
    return loc`Electrical`;
  },
  get explosive() {
    return loc`Explosive`;
  },
  get flash() {
    return loc`Flash`;
  },
  get heat() {
    return loc`Heat`;
  },
  get laser() {
    return loc`Laser`;
  },
  get vacuum() {
    return loc`Vacuum`;
  }
};

const whole = (value, what) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(loc`${what} must be a whole number, 0 or more.`);
  return number;
};
const rule = type => {
  const found = DAMAGE_TYPES[type];
  if (!found) throw new Error(loc`Choose a listed damage type.`);
  return found;
};

/**
 * Stress damage that comes with vitality and wounds lost to a damage type. Explosive damage adds a flat 1d4 even
 * when nothing is lost; the formula is returned for the caller to roll.
 * @returns {{points: number, formula: string|null}}
 */
export function typedStress(type, lost) {
  const stress = rule(type).stress;
  const amount = whole(lost, loc`Vitality and wounds lost`);
  if (!stress) return { points: 0, formula: null };
  const share = amount * stress.share,
    points = stress.round === "up" ? Math.ceil(share) : Math.floor(share);
  return { points, formula: stress.flat ?? null };
}

/** Falling damage: 2 stress per die of lethal damage, from 30 ft. up (p.336). */
export function fallingStress(feet, lethalDice) {
  return whole(feet, loc`Fall distance`) >= 30 ? 2 * whole(lethalDice, loc`Damage dice`) : 0;
}

/** The largest fall the book prices: 20d6 (p.336). */
export const FALLING_MAX_DICE = 20;

/**
 * A fall before its dice are rolled (p.336): 1d6 per full 10 ft. of the damage distance, 20d6 at most; lethal onto a
 * solid surface and subdual into a fluid one; a soft or yielding landing counts the fall as 10 ft. shorter; armor
 * piercing 1 per 10 ft. fallen.
 * @param {object} fall  { feet: the damage distance, surface: "solid"|"fluid", soft }
 */
export function fallingPlan({ feet, surface = "solid", soft = false } = {}) {
  const distance = whole(feet, loc`Fall distance`);
  if (!["solid", "fluid"].includes(surface)) throw new Error(loc`Choose a solid or a fluid landing surface.`);
  const counted = Math.max(0, distance - (soft ? 10 : 0)),
    dice = Math.min(FALLING_MAX_DICE, Math.floor(counted / 10));
  return {
    feet: distance,
    counted,
    dice,
    formula: dice ? `${dice}d6` : null,
    kind: surface === "fluid" ? "subdual" : "lethal",
    armorPiercing: Math.floor(distance / 10)
  };
}

/** The Acrobatics/Falling DC (20) after Cakewalk or Comedy of Errors (p.406). */
export const fallingDC = () => campaignSkillDC(20);

/**
 * The damage a fall deals once rolled (pp.106, 336). A made Acrobatics/Falling check (DC 20) lands the character on
 * their feet and takes a quarter of its result off the damage, never below 1 per die; otherwise they land sprawled.
 * Damage reduction counts after the fall's armor piercing. A lethal fall of 30 ft. or more adds 2 stress per die.
 * `halve` is Wire Fu's halving for a player or special character (p.408).
 * @param {object} plan     from fallingPlan
 * @param {object} outcome  { rolled, checkResult: the Falling check's result when it succeeded, dr, halve }
 */
export function fallingOutcome(plan, { rolled, checkResult = null, dr = 0, halve = false } = {}) {
  const total = whole(rolled, loc`Falling damage`),
    landed = Number.isFinite(checkResult) && checkResult >= fallingDC();
  let damage = landed ? Math.max(plan.dice, total - Math.floor(checkResult / 4)) : total;
  if (halve) damage = Math.floor(damage / 2);
  const reduction = Math.max(0, whole(dr, loc`Damage reduction`) - plan.armorPiercing),
    net = Math.max(0, damage - reduction);
  return {
    damage,
    reduction,
    net,
    kind: plan.kind,
    sprawled: !landed,
    landed,
    halved: !!halve,
    stress: plan.kind === "lethal" && net > 0 ? fallingStress(plan.feet, plan.dice) : 0
  };
}

/**
 * Injury saves that a running total of one type has newly earned.
 * @param {string} type
 * @param {number} before  the total taken from this source before now
 * @param {number} after   the total now
 * @returns {object[]} the injuries reached, each {at, ability?|condition?, duration?}
 */
export function injuriesReached(type, before, after) {
  const from = whole(before, loc`Damage before`),
    to = whole(after, loc`Damage after`);
  return (rule(type).injuries ?? []).filter(injury => from < injury.at && to >= injury.at);
}

/** The rounds a failed bang, flash or explosive Fortitude save lasts: a share of the margin, rounded up. */
export function marginRounds(dc, result, divisor) {
  const margin = Number(dc) - Number(result);
  if (!Number.isFinite(margin) || margin <= 0) return 0;
  return Math.ceil(margin / divisor);
}

/**
 * Bang damage (p.334): a failed Fortitude save stuns for half the margin and deafens twice as long; a stun brings
 * 1d4 stress. Over 20 points also has the takedown effect. A deafened character is not affected.
 */
export function bangOutcome(dc, result, { deafened = false } = {}) {
  if (deafened) return { affected: false, stunned: 0, deafened: 0, stress: null, takedown: false };
  const stunned = marginRounds(dc, result, 2);
  return {
    affected: true,
    stunned,
    deafened: stunned * 2,
    stress: stunned ? "1d4" : null,
    takedown: Number(dc) > 20
  };
}

/** Flash damage (p.338): a failed Fortitude save blinds for a quarter of the margin, with 1d4 stress. */
export function flashOutcome(dc, result, { blinded = false, lineOfSight = true } = {}) {
  if (blinded || !lineOfSight) return { affected: false, blinded: 0, stress: null };
  const rounds = marginRounds(dc, result, 4);
  return { affected: true, blinded: rounds, stress: rounds ? "1d4" : null };
}

/** The bonus to both explosive saves for moving in the last Initiative Count: +4 half action, +8 full action. */
export const EXPLOSIVE_MOVE_BONUS = { none: 0, half: 4, full: 8 };

/**
 * The two saves explosive damage calls for (p.336). Both are against the damage in the character's square.
 * A character who cannot move away and has less than half cover fails the Reflex save outright.
 */
export function explosiveSavePlan(damage, { moved = "none", cannotMove = false, halfCover = false } = {}) {
  const dc = whole(damage, loc`Explosive damage`);
  if (!Object.hasOwn(EXPLOSIVE_MOVE_BONUS, moved)) throw new Error(loc`Choose how far the character moved.`);
  return {
    dc,
    bonus: EXPLOSIVE_MOVE_BONUS[moved],
    reflexFails: cannotMove === true && halfCover !== true,
    takedown: dc > 20
  };
}

/** A made Reflex save against explosive damage halves it, rounded down, to at least 1. */
export function explosiveDamageTaken(damage, reflexSucceeded) {
  const amount = whole(damage, loc`Explosive damage`);
  return reflexSucceeded && amount > 0 ? Math.max(1, Math.floor(amount / 2)) : amount;
}

/** A failed Fortitude save against explosive damage stuns for a quarter of the margin. */
export const explosiveStunRounds = (dc, result) => marginRounds(dc, result, 4);

/**
 * Laser damage (p.338): one damage die fewer for each range increment past the first.
 * @param {string} formula  "3d6", "2d8+2"
 * @param {number} increment  the range increment the target is in (1 for the first)
 * @returns {{formula: string, dice: number, removed: number}}
 */
export function laserDamage(formula, increment = 1) {
  const match = String(formula ?? "")
    .replace(/\s+/g, "")
    .match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) throw new Error(loc`Enter the laser's damage as dice, such as 3d6.`);
  const step = Math.max(1, Math.trunc(Number(increment) || 1)),
    dice = Number(match[1]),
    removed = Math.min(dice, step - 1),
    left = dice - removed;
  return { formula: left ? `${left}d${match[2]}${match[3] ?? ""}` : "0", dice: left, removed };
}

/* -------------------------------------------- */
/*  Acid                                         */
/* -------------------------------------------- */

/** The highest d6 roll at which acid strikes the armor rather than the clothes (p.333). */
export const ACID_ARMOR_HIT = { none: 0, partial: 2, moderate: 3, full: 4 };

/** Whether acid strikes the armor; when it does not, the armor's damage reduction does not apply. */
export function acidHitsArmor(armor, roll) {
  if (!Object.hasOwn(ACID_ARMOR_HIT, armor)) throw new Error(loc`Choose the armor the character wears.`);
  return Number(roll) <= ACID_ARMOR_HIT[armor];
}

/** The Reflex save against acid: DC equal to the damage, +1 for each half action given up next Count (up to 2). */
export function acidSavePlan(damage, halfActionsGivenUp = 0) {
  const dc = whole(damage, loc`Acid damage`),
    given = Math.min(2, whole(halfActionsGivenUp, loc`Half actions given up`));
  return { dc, bonus: given };
}

/** The first acid damage applied: halved (rounded down) by a made Reflex save. */
export const acidFirstDamage = (damage, saved) => (saved ? Math.floor(damage / 2) : damage);

const acidEntry = acid =>
  acid
    ? {
        damage: whole(acid.damage, loc`Acid damage`),
        suffered: whole(acid.suffered ?? 0, loc`Acid damage taken`),
        injuryChecked: acid.injuryChecked === true,
        startedAt: acid.startedAt ?? null
      }
    : null;

/** Put acid on a character, or more on top of acid already there (the larger amount lingers). */
export function applyAcid(hazards, { damage, suffered = 0, worldTime = null } = {}) {
  const amount = whole(damage, loc`Acid damage`),
    current = acidEntry(hazards?.acid);
  const lingering = Math.max(current?.damage ?? 0, amount);
  if (!lingering) return { ...hazards, acid: current };
  return {
    ...hazards,
    acid: {
      damage: lingering,
      suffered: (current?.suffered ?? 0) + whole(suffered, loc`Acid damage taken`),
      injuryChecked: current?.injuryChecked ?? false,
      startedAt: current?.startedAt ?? worldTime
    }
  };
}

/** The start of a round: the lingering acid's damage is taken again. */
export function acidRoundPlan(hazards) {
  const acid = acidEntry(hazards?.acid);
  if (!acid) throw new Error(loc`No acid is on this character.`);
  const suffered = acid.suffered + acid.damage;
  return {
    damage: acid.damage,
    injurySaveDue: !acid.injuryChecked && suffered >= DAMAGE_TYPES.acid.injuries[0].at,
    hazards: { ...hazards, acid: { ...acid, suffered } }
  };
}

/** The end of a round, or a full action washing it off: the acid is halved, rounded down; at 0 it is gone. */
export function halveAcid(hazards) {
  const acid = acidEntry(hazards?.acid);
  if (!acid) return hazards;
  const damage = Math.floor(acid.damage / 2);
  return { ...hazards, acid: damage ? { ...acid, damage } : null };
}

/** Record that this acid's injury save has been made. */
export function acidInjuryChecked(hazards) {
  return hazards?.acid ? { ...hazards, acid: { ...hazards.acid, injuryChecked: true } } : hazards;
}

/* -------------------------------------------- */
/*  Electrical, cold, heat and vacuum            */
/* -------------------------------------------- */

/**
 * A failed Fortitude save against electrical subdual damage (p.335): nauseated for 1d6 rounds and an Initiative Count
 * penalty of half the damage. When that would send the character reeling, they fall unconscious instead, for as many
 * minutes as the Count falls below 0.
 */
export function electricalFailure(damage, count = null) {
  const amount = whole(damage, loc`Electrical damage`),
    countLoss = Math.floor(amount / 2);
  const after = Number.isFinite(count) ? count - countLoss : null;
  return {
    nauseated: "1d6",
    countLoss,
    countAfter: after,
    unconsciousMinutes: after !== null && after <= 0 ? -after : null
  };
}

/** Fortitude penalty against heat subdual damage for the armor worn (p.338). */
export const HEAT_ARMOR_PENALTY = { none: 0, partial: -2, moderate: -4, full: -8 };

/**
 * How often cold or heat from the surroundings deals its damage (pp.334, 338), in seconds; null when the
 * temperature deals none.
 * @param {"cold"|"heat"} type
 * @param {number} temperature  °F
 * @param {"air"|"liquid"} medium
 */
export function exposureInterval(type, temperature, medium = "air") {
  const t = Number(temperature);
  if (!Number.isFinite(t)) throw new Error(loc`Enter the temperature in °F.`);
  if (!["air", "liquid"].includes(medium)) throw new Error(loc`Choose air or liquid.`);
  const HOUR = 3600,
    MINUTE = 60,
    ROUND = 6;
  if (type === "cold") {
    if (medium === "liquid") return t <= 39 ? ROUND : t <= 60 ? MINUTE : null;
    return t <= -50 ? 5 * MINUTE : t <= 0 ? 10 * MINUTE : t <= 30 ? HOUR : null;
  }
  if (type === "heat") {
    if (medium === "liquid") return t >= 201 ? ROUND : t >= 110 ? MINUTE : null;
    return t >= 140 ? 5 * MINUTE : t >= 110 ? 10 * MINUTE : t >= 90 ? HOUR : null;
  }
  throw new Error(loc`Only cold and heat are applied over time.`);
}

/** Vacuum (p.340): 5d6 a round; in the first round only, a made Fortitude save (DC 15) halves it, rounded down. */
export const VACUUM = { formula: "5d6", saveDC: 15 };
export const vacuumDamage = (rolled, { firstRound = false, saved = false } = {}) =>
  firstRound && saved ? Math.floor(whole(rolled, loc`Vacuum damage`) / 2) : whole(rolled, loc`Vacuum damage`);

/**
 * A running total of cold, heat, vacuum or electrical damage from one source, kept so the injury saves come due
 * (`hazards.exposure`). Starting a new source resets it.
 */
export function addExposure(hazards, { type, amount, source = "", worldTime = null, interval = null } = {}) {
  rule(type);
  const current = hazards?.exposure?.type === type && hazards.exposure.source === source ? hazards.exposure : null;
  const before = current?.suffered ?? 0,
    after = before + whole(amount, loc`Damage`);
  return {
    hazards: {
      ...hazards,
      exposure: {
        type,
        source,
        suffered: after,
        interval: interval ?? current?.interval ?? null,
        startedAt: current?.startedAt ?? worldTime,
        injuriesChecked: current?.injuriesChecked ?? []
      }
    },
    injuries: injuriesReached(type, before, after).filter(
      injury => !(current?.injuriesChecked ?? []).includes(injury.at)
    )
  };
}

/** The character leaves the source: the running total ends (fatigue from cold or heat may now recover). */
export const endExposure = hazards => ({ ...hazards, exposure: null });

/* -------------------------------------------- */
/*  Escalating survival saves (p.349)            */
/* -------------------------------------------- */

/** Base DCs; each save made against the same hazard adds 1. */
export const SURVIVAL_SAVES = {
  suffocation: { base: 10, page: 349 },
  smoke: { base: 15, page: 349 },
  sleep: { base: 15, page: 349 },
  starvation: { base: 10, page: 349 },
  thirst: { base: 10, page: 349 },
  pressure: { base: 15, page: 349 }
};

export const SURVIVAL_LABELS = {
  get suffocation() {
    return loc`Suffocation (after holding breath)`;
  },
  get smoke() {
    return loc`Smoke inhalation`;
  },
  get sleep() {
    return loc`Sleep deprivation (each day past the first)`;
  },
  get starvation() {
    return loc`Starvation (from the 4th day)`;
  },
  get thirst() {
    return loc`Thirst (each day)`;
  },
  get pressure() {
    return loc`Water pressure (100 ft. or deeper, each minute)`;
  }
};

/** How many rounds a character can hold their breath: twice Constitution. */
export const breathRounds = system => 2 * Math.max(0, Math.trunc(Number(system?.abilities?.con?.value) || 0));

/** The DC of the next save against a survival hazard. */
export function survivalSavePlan(hazards, kind) {
  const entry = SURVIVAL_SAVES[kind];
  if (!entry) throw new Error(loc`Choose a listed survival hazard.`);
  const saves = Math.max(0, Math.trunc(Number(hazards?.survival?.[kind]?.saves) || 0));
  return { kind, dc: entry.base + saves, saves, page: entry.page };
}

/** Count a save made against a survival hazard. */
export function survivalSaveMade(hazards, kind, { worldTime = null } = {}) {
  const plan = survivalSavePlan(hazards, kind);
  return {
    ...hazards,
    survival: {
      ...(hazards?.survival ?? {}),
      [kind]: { saves: plan.saves + 1, lastAt: worldTime }
    }
  };
}

/** The hazard ends (the character breathes, sleeps, eats, drinks or surfaces): the count starts again. */
export function survivalReset(hazards, kind) {
  if (!SURVIVAL_SAVES[kind]) throw new Error(loc`Choose a listed survival hazard.`);
  const survival = { ...(hazards?.survival ?? {}) };
  delete survival[kind];
  return { ...hazards, survival };
}

/**
 * What a failed survival save does.
 * @param {string} kind
 * @param {object} facts  {standard, days, depth}: a standard character; days without food or water; depth in feet
 * @returns {{lethal: string|null, subdual: string|null, conditions: object[], notes: string[]}}
 */
export function survivalFailure(kind, { standard = false, days = 1, depth = 100 } = {}) {
  const day = Math.max(1, Math.trunc(Number(days) || 1));
  switch (kind) {
    case "suffocation":
      return {
        lethal: null,
        subdual: null,
        vitalityToZero: !standard,
        conditions: standard ? [{ id: "unconscious" }] : [],
        notes: [
          loc`Next round, at the start of the character's Count, they must breathe if they can; if not, wounds drop to 0 and they are dying (p.349).`
        ]
      };
    case "smoke":
      return {
        lethal: "1d4",
        subdual: null,
        conditions: [],
        notes: [loc`The character loses the chance to act this round (p.349).`]
      };
    case "sleep":
      return {
        lethal: null,
        subdual: null,
        conditions: [{ id: "unconscious", duration: "1d4+4", unit: "hour" }],
        notes: [loc`Asleep where they stand for 1d4+4 hours (p.349).`]
      };
    case "starvation":
    case "thirst":
      return {
        lethal: `1d6+${day}d4`,
        subdual: null,
        conditions: [{ id: "fatigued" }],
        notes: [
          kind === "starvation"
            ? loc`Fatigued until the character eats a full day's food (p.349).`
            : loc`Fatigued until the character drinks a full day's water (p.349).`
        ]
      };
    case "pressure": {
      const extra = Math.floor(Math.max(0, Number(depth) || 0) / 50);
      return {
        lethal: null,
        subdual: `1d6${extra ? `+${extra}d6` : ""}`,
        conditions: [],
        notes: [loc`The DC keeps rising until the character rises above 60 ft. (p.349).`]
      };
    }
    default:
      throw new Error(loc`Choose a listed survival hazard.`);
  }
}

/** Whether a weapon deals laser damage: its damage entry says so, or a GC marked its damage type. */
export const laserWeapon = (weapon = {}) =>
  weapon.damageType === "laser" || /\blaser\b/i.test(String(weapon.damage ?? ""));

/**
 * A laser hit's dice at a measured distance (p.338): one die fewer for each range increment past the first, applied to
 * the first dice term of a damage expression. Without a distance or increment the expression is unchanged.
 * @returns {{expression: string, removed: number, increments: number|null, note: string}}
 */
export function laserDistancePlan(expression, { distanceFeet, increment } = {}) {
  const distance =
      distanceFeet === "" || distanceFeet === null || distanceFeet === undefined ? NaN : Number(distanceFeet),
    step = Number(increment);
  if (!(distance >= 0) || !(step > 0))
    return {
      expression,
      removed: 0,
      increments: null,
      note: loc`Laser: enter the target distance to drop one damage die per range increment past the first (p.338).`
    };
  const increments = Math.max(1, Math.ceil(distance / step));
  const match = String(expression).match(/(\d*)d(\d+)/i);
  if (!match || increments === 1) return { expression, removed: 0, increments, note: "" };
  const dice = Number(match[1] || 1),
    removed = Math.min(dice, increments - 1),
    left = dice - removed;
  const replaced = left ? `${left}d${match[2]}` : "0";
  return {
    expression: String(expression).replace(match[0], replaced),
    removed,
    increments,
    note: loc`Laser: range increment ${increments}, ${removed} damage die fewer (p.338).`
  };
}
