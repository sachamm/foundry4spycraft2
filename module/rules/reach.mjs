import { loc } from "../i18n.mjs";
/** Reach (RCH), p.302. Quality distances are feet; prepared character Reach
 * uses squares. Keep the weapon's added distance separate from that base. */
export function reachIncreaseFeet(qualities = "") {
  if (typeof qualities !== "string") throw Error(loc`Review the actual Reach weapon qualities.`);
  if (!/\bRCH\b/i.test(qualities)) return 0;
  const entries = [...qualities.matchAll(/\bRCH\b\s*\(([^)]*)\)/gi)],
    rest = qualities.replace(/\bRCH\b\s*\([^)]*\)/gi, "");
  if (!entries.length || /\bRCH\b/i.test(rest) || entries.some(m => !/^\s*\+?\d+\s*ft\.?\s*$/i.test(m[1])))
    throw Error(loc`Review the Reach quality’s positive distance in feet.`);
  const values = entries.map(m => Number(m[1].match(/\d+/)[0]));
  if (values.some(n => !Number.isSafeInteger(n) || n <= 0) || new Set(values).size !== 1)
    throw Error(loc`Review the weapon’s single Reach distance.`);
  return values[0];
}
export function reachAttackPlan(
  weapon,
  {
    trained = false,
    ranged = false,
    adjacent = null,
    geometryConfirmed = false,
    polearmBasics = false,
    defensive = false
  } = {}
) {
  if (
    [trained, ranged, geometryConfirmed, polearmBasics, defensive].some(v => typeof v !== "boolean") ||
    (adjacent !== null && typeof adjacent !== "boolean")
  )
    throw Error(loc`Review actual Reach training, adjacency and geometry declarations.`);
  const listedFeet = reachIncreaseFeet(weapon?.qualities ?? ""),
    polearm = weapon?.meleeFamily === "polearm" && weapon?.proficiency === "exoticEdged" && !ranged,
    waiver = !defensive && !!listedFeet && polearm && polearmBasics;
  const evidence = {
    version: 1,
    listedFeet,
    trained,
    ranged,
    defensive,
    adjacent: listedFeet && !defensive ? adjacent : null,
    geometryConfirmed: !!listedFeet && !defensive && geometryConfirmed,
    extraReachFeet: trained && !defensive ? listedFeet : 0,
    polearmWaiver: waiver,
    attackPenalty: !defensive && listedFeet && adjacent === true && trained && !waiver ? -5 : 0
  };
  const pending = !defensive && !!listedFeet && adjacent === true && !trained && !waiver;
  return {
    evidence,
    blocked: pending,
    blockedReason: pending
      ? loc`Untrained Reach against an adjacent target needs the pending p.302 ruling; no adjacent penalty has been assumed.`
      : "",
    notes:
      listedFeet && !defensive
        ? [
            loc`Reach (RCH): ${trained ? "+" + listedFeet + loc` ft. with this trained attack` : loc`no extra Reach with this untrained attack`}.`,
            ...(adjacent === null
              ? [loc`Confirm actual adjacency and legal Reach geometry before rolling.`]
              : !geometryConfirmed
                ? [loc`The GC must confirm the actual target and legal Reach geometry.`]
                : []),
            ...(waiver && adjacent === true
              ? [loc`Polearm Basics: this actual polearm ignores the adjacent-target −5 penalty (p.179).`]
              : evidence.attackPenalty
                ? [loc`Reach: adjacent target, attack −5 (p.302).`]
                : [])
          ]
        : []
  };
}
