/**
 * Fortunate, p.189. As a free action the character asks the GC for one extra d4 action die; the GC, or an opponent
 * the GC chooses, gains one d4 as well. The character's die is lost if unused by the end of the scene. Uses per
 * session: the number of Chance feats the character has.
 *
 * The character's die is an unrestricted bonus pool (module/rules/bonus-pools.mjs) that expires at scene end. Like
 * every gained die it improves under Fortune Favors the Bold. The GC grants it from the sheet, since the feat is a
 * request to the GC; the matching die goes to the GC pool or is noted for the chosen opponent.
 */
import { actionDiceGain, allowsAdditionalActionDice } from "./action-dice.mjs";
import { loc } from "../i18n.mjs";

export const FORTUNATE = "Fortunate";
const epoch = (periods, key) => String(periods?.[key] ?? "initial");

/** Chance feats the character has, counted once each. */
export function chanceFeatCount(system) {
  const names = new Set((system.activeFeatSelections ?? []).filter(f => f?.tree === "Chance").map(f => f.name));
  return names.size;
}

export function fortunateSpec(system) {
  if (!allowsAdditionalActionDice(system)) return null;
  if (!system.activeFeatNames?.includes(FORTUNATE)) return null;
  return {
    id: "fortunate",
    name: loc`Fortunate (one per Chance feat each session)`,
    period: "session",
    limit: chanceFeatCount(system),
    workflow: "fortunate"
  };
}

/** The scene-long d4 bonus pool the character gains. */
export function fortunatePool(system, { id, periods = system.usagePeriods } = {}) {
  if (!allowsAdditionalActionDice(system)) throw new Error(loc`This companion cannot gain additional action dice.`);
  if (!system.activeFeatNames?.includes(FORTUNATE)) throw Error(loc`Fortunate has not been earned.`);
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id) || system.bonusActionDice?.[id])
    throw Error(loc`Review the new Fortunate grant identifier.`);
  if (!Number.isFinite(system.worldTime)) throw Error(loc`Review the current world time.`);
  const bold = system.activeFeatNames.includes("Fortune Favors the Bold") === true,
    gain = actionDiceGain(system, 4);
  return {
    id,
    source: "fortunate",
    label: loc`Fortunate`,
    unrestricted: true,
    baseDie: 4,
    baseCount: 1,
    bold,
    die: gain.die,
    granted: gain.units,
    remaining: gain.units,
    scene: epoch(periods, "scene"),
    session: epoch(periods, "session"),
    mission: epoch(periods, "mission"),
    at: system.worldTime,
    needsReview: false
  };
}

/** Whether a saved pool has Fortunate's exact shape (used by the shared pool status check). */
export const validFortunatePool = pool =>
  pool?.source === "fortunate" &&
  pool.baseDie === 4 &&
  pool.baseCount === 1 &&
  typeof pool.bold === "boolean" &&
  pool.die === (pool.bold ? 6 : 4) &&
  pool.granted === 1;

export const FORTUNATE_MATCH = Object.freeze(["gc", "opponent"]);
export function fortunateMatchNote(match, opponentName = "") {
  if (match === "gc") return loc`The GC gains 1 d4 action die.`;
  return loc`The GC gives the matching d4 action die to ${opponentName.trim() || loc`an opponent of the GC’s choice`}.`;
}
