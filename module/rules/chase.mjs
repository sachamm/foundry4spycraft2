/**
 * Chase support for the Dramatic Conflict tracker (pp.364–367): ratings from vehicles, Maneuvering Room, starting
 * Lead, distance per Lead point and the fastest-vehicle bonus. Pure functions: no Foundry access.
 */
import { VEHICLE_RULES } from "./tables.mjs";
import { SIZE_CODES, sizeCode, vehicleCondition } from "./vehicles.mjs";
import { loc } from "../i18n.mjs";

/** Table 6.1 (p.364): chase speed factor, top-MPH bonus and Crisis DC for each Maneuvering Room grade. */
export const MANEUVERING_ROOM = Object.freeze({
  open: { label: "Open", speedFactor: 1, topMphBonus: 6, crisisDC: 15 },
  close: { label: "Close", speedFactor: 3 / 4, topMphBonus: 4, crisisDC: 20 },
  crowded: { label: "Crowded", speedFactor: 1 / 2, topMphBonus: 2, crisisDC: 30 },
  tight: { label: "Tight", speedFactor: 1 / 4, topMphBonus: 0, crisisDC: 40 }
});
export const FOOT_LEAD_FEET = 20;

const room = key => {
  const r = MANEUVERING_ROOM[key];
  if (!r) throw new Error(loc`Choose the Maneuvering Room: Open, Close, Crowded or Tight.`);
  return r;
};

/**
 * A chase participant's ratings. A vehicle supplies its current Acceleration, Turning and top MPH (after damage);
 * someone on foot uses Strength and Dexterity modifiers (minimum 0) and has no top MPH.
 */
export function participantRatings(source) {
  if (!source) return { kind: "none", Acceleration: 0, Turning: 0, topMph: null, leadFeet: null };
  if (source.kind === "vehicle") {
    const s = source.system,
      now = vehicleCondition(s, s.damage ?? {});
    const cls = VEHICLE_RULES.classes.find(c => c.code === s.vehicleClass);
    let leadFeet = cls?.chaseLeadFeet ?? null;
    // Service aircraft: light (200 ft.) up to Large, heavy (100 ft.) above (Table 6.2).
    if (s.vehicleClass === "SVA")
      leadFeet = SIZE_CODES.indexOf(sizeCode(s.size)) <= SIZE_CODES.indexOf("L") ? 200 : 100;
    return {
      kind: "vehicle",
      Acceleration: now.acceleration ?? 0,
      Turning: now.turning ?? 0,
      topMph: now.topMph ?? s.topMph ?? null,
      leadFeet,
      immobilized: now.immobilized
    };
  }
  const abilities = source.system?.abilities ?? {};
  return {
    kind: "foot",
    Acceleration: Math.max(0, abilities.str?.mod ?? 0),
    Turning: Math.max(0, abilities.dex?.mod ?? 0),
    topMph: null,
    leadFeet: FOOT_LEAD_FEET
  };
}

/** Starting Lead (p.364): Acceleration in Open or Close room, Turning in Crowded or Tight; 2+ higher shifts it by 1. */
export function startingLead(roomKey, predator, prey) {
  const rating = ["open", "close"].includes(roomKey) ? "Acceleration" : "Turning";
  room(roomKey);
  const diff = (predator?.[rating] ?? 0) - (prey?.[rating] ?? 0);
  return { lead: diff >= 2 ? 4 : diff <= -2 ? 6 : 5, rating, difference: diff };
}

/** Chase scale and pace for the participants: distance per Lead point, mismatch, chase speed and who gets the bonus. */
export function chaseScale(roomKey, predator, prey) {
  const r = room(roomKey),
    sides = { predator, prey };
  const feet = [predator?.leadFeet, prey?.leadFeet].filter(Number.isFinite);
  const leadFeet = feet.length ? Math.min(...feet) : null;
  const mismatched = feet.length === 2 && Math.max(...feet) > 2 * Math.min(...feet);
  const tops = Object.entries(sides).filter(([, s]) => Number.isFinite(s?.topMph));
  const speed = tops.length ? Math.floor(Math.min(...tops.map(([, s]) => s.topMph)) * r.speedFactor) : null;
  let fastest = null;
  if (tops.length === 2 && tops[0][1].topMph !== tops[1][1].topMph)
    fastest = tops[0][1].topMph > tops[1][1].topMph ? tops[0][0] : tops[1][0];
  else if (tops.length === 1) fastest = tops[0][0];
  return {
    room: r,
    leadFeet,
    mismatched,
    speedMph: speed,
    fastest,
    topMphBonus: fastest ? r.topMphBonus : 0,
    crisisDC: r.crisisDC
  };
}

/** Distance between the participants at a given Lead. */
export const leadDistance = (lead, leadFeet) => (Number.isFinite(leadFeet) ? lead * leadFeet : null);

/* ---------------------------------------------------------------------- */
/*  Altitude: Smash points (p.365)                                        */
/* ---------------------------------------------------------------------- */

/** Only a pilot in a powered air vehicle can hold Smash points. */
export function smashEligible(system) {
  const s = system ?? {};
  return (
    VEHICLE_RULES.smash.airClasses.includes(s.vehicleClass) && !/\bUNP\b/.test(s.qualitiesNow ?? s.qualities ?? "")
  );
}

/** Normalised Smash record: {side, points}, or null when nobody holds any. */
export function smashState(smash) {
  const points = Math.floor(Number(smash?.points) || 0);
  return smash && ["predator", "prey"].includes(smash.side) && points > 0 ? { side: smash.side, points } : null;
}

/**
 * Smash after an opposed check or a Maneuver threat: the holder gains 1 when they win (or score the threat) and
 * loses 1 when anyone else does. At 0 the points are gone and the pilot must qualify again.
 */
export function smashAfterWin(smash, winner) {
  const now = smashState(smash);
  if (!now || !["predator", "prey"].includes(winner)) return now;
  return smashState({ side: now.side, points: now.points + (winner === now.side ? 1 : -1) });
}

/**
 * Spending 1 Smash point after winning an opposed check: a Predator cuts the Lead by 1; a Prey gains +4 Defense
 * until the start of its next Initiative Count.
 */
export function spendSmash(smash, lead) {
  const now = smashState(smash);
  if (!now) throw new Error(loc`Nobody holds Smash points.`);
  const { predatorLeadCut, preyDefenseBonus } = VEHICLE_RULES.smash;
  const after = smashState({ side: now.side, points: now.points - 1 });
  return now.side === "predator"
    ? { smash: after, lead: lead - predatorLeadCut, note: loc`Smash spent: Lead −${predatorLeadCut}.` }
    : {
        smash: after,
        lead,
        defenseBonus: preyDefenseBonus,
        note: loc`Smash spent: +${preyDefenseBonus} Defense until the start of the Prey's next Initiative Count.`
      };
}

/** Lead used for the range of attacks against the Smash holder: the current Lead plus their Smash points. */
export const smashRangeLead = (lead, smash) => lead + (smashState(smash)?.points ?? 0);
