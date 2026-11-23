/**
 * Hazards a character carries: contagions (disease, poison, radiation) and being on fire (pp.287–288, 335–338).
 *
 * A contagion incubates for its primary onset time, then calls for a Fortitude save. Success ends it. Failure
 * applies the phase's effect and starts the secondary onset time; the secondary save repeats until one succeeds.
 * Extra doses of the same contagion lower the saves by 1 each, to –10. An antidote ends it at once.
 *
 * A burning character takes the fire's damage as each round begins, and the same amount as stress for any
 * vitality or wounds lost. Dropping and rolling halves the fire; water, a blanket or an extinguisher lower it.
 * Twenty-five points from one fire call for a Fortitude save against a point of permanent Charisma damage.
 *
 * This module is pure: it plans changes to `system.hazards` and never rolls dice or touches documents.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";

const SECONDS = { round: 6, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 };
const ABILITIES = { str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha" };
export const DOSE_PENALTY_LIMIT = 10;
export const SCAR_THRESHOLD = 25;
export const SCAR_SAVE_DC = 15;
export const SEALED_SUIT_BONUS = 10;

/** "3d4 days" → { formula: "3d4", unit: "day", seconds: 86400 } */
export function parseOnset(text) {
  const match = String(text ?? "")
    .trim()
    .match(/^(\d+(?:d\d+)?)\s+(round|minute|hour|day|week|month|year)s?$/i);
  if (!match) throw new Error(loc`Unreadable onset time: ${String(text)}`);
  const unit = match[2].toLowerCase();
  return { formula: match[1], unit, seconds: SECONDS[unit] };
}

/**
 * A phase's effect as a list of things to apply.
 *   "1d4 Con (half permanent), 1 Str" → attribute losses
 *   "Stunned for 1d6 rounds"          → a condition with a duration
 *   "2d6 lethal damage"               → lethal damage
 * Anything else is returned as { kind: "note" } for the GC to apply.
 */
export function parseEffects(text) {
  const effects = [];
  for (const raw of String(text ?? "").split(/,\s*(?![^(]*\))/)) {
    const part = raw.trim();
    if (!part) continue;
    const attribute = part.match(/^(\d+(?:d\d+)?)\s+(Str|Dex|Con|Int|Wis|Cha)(?:\s+\((half permanent|permanent)\))?$/i);
    if (attribute) {
      effects.push({
        kind: "attribute",
        formula: attribute[1],
        ability: ABILITIES[attribute[2].toLowerCase()],
        permanent: !attribute[3] ? "none" : attribute[3].toLowerCase() === "permanent" ? "all" : "half"
      });
      continue;
    }
    const condition = part.match(/^([A-Za-z]+) for (\d+(?:d\d+)?)\s+(round|minute|hour|day)s?$/i);
    if (condition) {
      effects.push({
        kind: "condition",
        condition: condition[1].toLowerCase(),
        formula: condition[2],
        unit: condition[3].toLowerCase(),
        seconds: SECONDS[condition[3].toLowerCase()]
      });
      continue;
    }
    const lethal = part.match(/^(\d+(?:d\d+)?)\s+lethal damage$/i);
    if (lethal) {
      effects.push({ kind: "lethal", formula: lethal[1] });
      continue;
    }
    effects.push({ kind: "note", text: part });
  }
  return effects;
}

/** A rolled attribute loss split into its temporary and permanent parts; half permanent rounds down. */
export function attributeLoss(effect, rolled) {
  const amount = Math.max(0, Math.trunc(Number(rolled) || 0));
  const permanent = effect.permanent === "all" ? amount : effect.permanent === "half" ? Math.floor(amount / 2) : 0;
  return [
    { ability: effect.ability, kind: "permanent", amount: permanent },
    { ability: effect.ability, kind: "temporary", amount: amount - permanent }
  ].filter(loss => loss.amount > 0);
}

/** The save penalty for doses beyond the first. */
export function dosePenalty(doses) {
  const extra = Math.max(0, Math.trunc(Number(doses) || 1) - 1);
  return extra ? -Math.min(DOSE_PENALTY_LIMIT, extra) : 0;
}

const empty = () => ({ contagions: {}, recovered: [], fire: null, acid: null, exposure: null, survival: {} });

/** A character's hazards with every part present. */
export function hazardState(system) {
  const stored = system?.hazards;
  return {
    contagions: { ...(stored?.contagions ?? {}) },
    recovered: [...(stored?.recovered ?? [])],
    fire: stored?.fire ? { ...stored.fire } : null,
    // Other damage types and survival saves (module/rules/damage-types.mjs).
    acid: stored?.acid ? { ...stored.acid } : null,
    exposure: stored?.exposure
      ? { ...stored.exposure, injuriesChecked: [...(stored.exposure.injuriesChecked ?? [])] }
      : null,
    survival: { ...(stored?.survival ?? {}) }
  };
}

/** The name a contagion is tracked under: its grade is part of what it is. */
export function contagionLabel(contagion) {
  return contagion.grade ? `${contagion.name} (${contagion.grade})` : contagion.name;
}

/**
 * Expose a character to a contagion.
 * @param {object} hazards    hazardState(system)
 * @param {object} contagion  a row of the Contagions table
 * @param {object} options    { id, worldTime, onsetRoll: the rolled primary onset in its unit, doses }
 * @returns {{hazards: object, entry: object, added: boolean}} added is false when the dose joined an active case
 */
export function exposurePlan(hazards = empty(), contagion, { id, worldTime, onsetRoll, doses = 1 } = {}) {
  if (!contagion?.name || !contagion.primary || !contagion.secondary) throw new Error(loc`Choose a contagion.`);
  if (!Number.isSafeInteger(doses) || doses < 1) throw new Error(loc`Give a whole number of doses, 1 or more.`);
  if (!Number.isFinite(worldTime)) throw new Error(loc`The current game time is needed to track a contagion.`);
  const label = contagionLabel(contagion);
  if ((contagion.notes ?? []).includes("oneTime") && hazards.recovered.includes(label))
    throw new Error(loc`${label} cannot be caught a second time.`);
  const next = { ...hazards, contagions: { ...hazards.contagions } };
  const active = Object.values(next.contagions).find(entry => entry.label === label);
  if (active) {
    const entry = { ...active, doses: active.doses + doses };
    next.contagions[active.id] = entry;
    return { hazards: next, entry, added: false };
  }
  if (typeof id !== "string" || !id) throw new Error(loc`A contagion needs an identifier.`);
  const onset = parseOnset(contagion.primary.onset);
  if (!Number.isSafeInteger(onsetRoll) || onsetRoll < 1) throw new Error(loc`Roll the onset time (${onset.formula}).`);
  const entry = {
    id,
    label,
    name: contagion.name,
    grade: contagion.grade ?? "",
    kind: contagion.kind ?? "",
    notes: [...(contagion.notes ?? [])],
    doses,
    phase: "primary",
    saves: 0,
    exposedAt: worldTime,
    dueAt: worldTime + onsetRoll * onset.seconds,
    primary: { ...contagion.primary },
    secondary: { ...contagion.secondary }
  };
  next.contagions[id] = entry;
  return { hazards: next, entry, added: true };
}

/** Whether a contagion's next save has come due. */
export function contagionDue(entry, worldTime) {
  return Number.isFinite(worldTime) && worldTime >= entry.dueAt;
}

/** The Fortitude save a contagion calls for now. */
export function contagionSavePlan(entry, { sealedSuit = false } = {}) {
  const phase = entry.phase === "primary" ? entry.primary : entry.secondary;
  // A sealed suit helps only against a radiation contagion's first save (p.287).
  const suit = sealedSuit && entry.phase === "primary" && /radiation/i.test(entry.name) ? SEALED_SUIT_BONUS : 0;
  return {
    id: entry.id,
    label: entry.label,
    phase: entry.phase,
    dc: phase.saveDC,
    dosePenalty: dosePenalty(entry.doses),
    suitBonus: suit,
    effect: phase.effect
  };
}

/**
 * What a contagion save leads to.
 * @param {object} options { succeeded, worldTime, onsetRoll: the rolled secondary onset (needed on a failure) }
 * @returns {{hazards: object, recovered: boolean, effects: object[], entry: object|null}}
 */
export function contagionSaveOutcome(hazards, id, { succeeded, worldTime, onsetRoll } = {}) {
  const entry = hazards?.contagions?.[id];
  if (!entry) throw new Error(loc`This contagion is no longer being tracked.`);
  if (typeof succeeded !== "boolean") throw new Error(loc`The save needs a result first.`);
  const next = { ...hazards, contagions: { ...hazards.contagions }, recovered: [...hazards.recovered] };
  if (succeeded) {
    delete next.contagions[id];
    if (entry.notes.includes("oneTime") && !next.recovered.includes(entry.label)) next.recovered.push(entry.label);
    return { hazards: next, recovered: true, effects: [], entry: null };
  }
  const phase = entry.phase === "primary" ? entry.primary : entry.secondary,
    onset = parseOnset(entry.secondary.onset);
  if (!Number.isFinite(worldTime)) throw new Error(loc`The current game time is needed to track a contagion.`);
  if (!Number.isSafeInteger(onsetRoll) || onsetRoll < 1) throw new Error(loc`Roll the onset time (${onset.formula}).`);
  const advanced = {
    ...entry,
    phase: "secondary",
    saves: entry.saves + 1,
    dueAt: worldTime + onsetRoll * onset.seconds
  };
  next.contagions[id] = advanced;
  return { hazards: next, recovered: false, effects: parseEffects(phase.effect), entry: advanced };
}

/** End a contagion with its antidote (or by the GC's word). A one-time disease that had taken hold stays known. */
export function cureContagion(hazards, id) {
  const entry = hazards?.contagions?.[id];
  if (!entry) return hazards;
  const next = { ...hazards, contagions: { ...hazards.contagions }, recovered: [...hazards.recovered] };
  delete next.contagions[id];
  if (entry.notes.includes("oneTime") && entry.saves > 0 && !next.recovered.includes(entry.label))
    next.recovered.push(entry.label);
  return next;
}

/* -------------------------------------------- */
/*  Fire                                         */
/* -------------------------------------------- */

/** Table 5.7: the armor-piercing value of fire by temperature (°F). */
export const FIRE_AP = [
  { id: "t500", upTo: 500, ap: 4 },
  { id: "t750", upTo: 750, ap: 8 },
  { id: "t1000", upTo: 1000, ap: 12 },
  { id: "t1500", upTo: 1500, ap: 16 },
  { id: "t3000", upTo: 3000, ap: 20 },
  { id: "t6000", upTo: 6000, ap: 24 },
  { id: "hotter", upTo: Infinity, ap: 28 }
];

/** The armor-piercing value of a fire at a temperature in °F. */
export function fireAP(temperature) {
  const value = Number(temperature);
  if (!Number.isFinite(value) || value < 250) return 0;
  return FIRE_AP.find(band => value <= band.upTo).ap;
}

const fireDamage = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(loc`Fire damage is a whole number, 0 or more.`);
  return value;
};

/** Set a character on fire with the damage that lit them. A hotter fire replaces a cooler one. */
export function ignitePlan(hazards = empty(), { damage, ap = 0, worldTime = null } = {}) {
  fireDamage(damage);
  if (damage === 0) return hazards;
  const current = hazards.fire;
  if (current && current.damage >= damage) return hazards;
  return {
    ...hazards,
    fire: {
      damage,
      ap: Math.max(0, Math.trunc(Number(ap) || 0)),
      suffered: current?.suffered ?? 0,
      scarChecked: current?.scarChecked ?? false,
      startedAt: current?.startedAt ?? worldTime
    }
  };
}

/**
 * Fire damage a character takes, from a burning square or from being on fire.
 * @param {object|null} fire  the fire burning the character, when there is one
 * @param {number} damage     the damage taken now
 * @returns {{fire: object|null, damage: number, scarSaveDue: boolean}}
 */
export function fireDamagePlan(fire, damage) {
  fireDamage(damage);
  if (!fire) return { fire: null, damage, scarSaveDue: false };
  const suffered = fire.suffered + damage;
  return {
    fire: { ...fire, suffered },
    damage,
    scarSaveDue: !fire.scarChecked && suffered >= SCAR_THRESHOLD
  };
}

/** The start of a burning character's round: they take the fire's damage. */
export function burningRoundPlan(hazards) {
  if (!hazards?.fire) throw new Error(loc`This character is not on fire.`);
  const plan = fireDamagePlan(hazards.fire, hazards.fire.damage);
  return { ...plan, hazards: { ...hazards, fire: plan.fire } };
}

/** Lower a fire by an amount (water, a blanket, an extinguisher); at 0 it is out. */
export function reduceFire(hazards, amount) {
  if (!hazards?.fire) return hazards;
  const reduction = Math.max(0, Math.trunc(Number(amount) || 0)),
    damage = Math.max(0, hazards.fire.damage - reduction);
  return { ...hazards, fire: damage ? { ...hazards.fire, damage } : null };
}

/** A half action spent rolling on unburnt ground: the fire is halved, rounded down. */
export function rollOnGround(hazards) {
  if (!hazards?.fire) return hazards;
  const damage = Math.floor(hazards.fire.damage / 2);
  return { ...hazards, fire: damage ? { ...hazards.fire, damage } : null };
}

/** Record that the scarring save for this fire has been made. */
export function scarChecked(hazards) {
  return hazards?.fire ? { ...hazards, fire: { ...hazards.fire, scarChecked: true } } : hazards;
}

/** Ways to fight a fire and the dice each takes off it (p.337). */
export const FIRE_REDUCTIONS = [
  { id: "water", formula: "1d6" },
  { id: "blanket", formula: "1d4" },
  { id: "extinguisher", formula: "2d6" }
];

/**
 * Lethal damage taken off vitality first, then wounds.
 * @returns {{vitality: number, wounds: number, vitalityLoss: number, woundLoss: number}}
 */
export function lethalDamagePlan(system, amount) {
  const damage = Math.max(0, Math.trunc(Number(amount) || 0)),
    vitality = Math.max(0, Math.trunc(Number(system?.vitality?.value) || 0)),
    wounds = Math.trunc(Number(system?.wounds?.value) || 0);
  const vitalityLoss = Math.min(vitality, damage),
    woundLoss = damage - vitalityLoss;
  return { vitality: vitality - vitalityLoss, wounds: wounds - woundLoss, vitalityLoss, woundLoss };
}

/* -------------------------------------------- */
/*  Saves against hazards                        */
/* -------------------------------------------- */

// A save made against a hazard carries the hazard's DC and its own modifiers as a term of the save plan.
rollPipeline.register({
  id: "hazardSaveTerm",
  kinds: ["save"],
  order: 9495,
  terms({ options }) {
    const save = options?.hazardSave;
    if (!save) return null;
    return {
      rowAt: 110,
      rows: [
        [loc`Extra doses`, save.dosePenalty ?? 0],
        [loc`Sealed suit`, save.suitBonus ?? 0],
        // A hazard's own situational modifier (movement before an explosion, half actions given up to acid, armor
        // against heat), labelled by the rule that set it.
        ...(Number(save.bonus) ? [[String(save.bonusLabel ?? loc`Hazard modifier`), Number(save.bonus)]] : [])
      ],
      flavorAt: 45,
      flavor: loc` — ${esc(save.label)} DC ${Number(save.dc)}`,
      options: { hazardSave: save }
    };
  }
});
rollPipeline.register({ id: "hazardsRecord", order: 9597, record: ["hazardSave"] });
