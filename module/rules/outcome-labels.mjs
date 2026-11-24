/**
 * Shared wording for results and ranges, so every card, sheet and dialog prints them the same way
 * (docs/ui-style-guide.md, sections 4.2 and 4.4).
 */
import { loc } from "../i18n.mjs";

/**
 * A threat or error range as the faces of the die it covers. The rules store one bound: a threat range runs from
 * its bound up to 20, an error range from 1 up to its bound. A one-face range prints the face; no range prints a dash.
 * @param {"threat"|"error"} kind
 * @param {number} bound
 */
export function formatRange(kind, bound) {
  const n = Number(bound);
  if (!Number.isFinite(n) || n <= 0) return "—";
  // A bound above 20 is a range a rule has closed (a villain role): no face threatens.
  if (kind === "threat") return n > 20 ? "—" : n === 20 ? "20" : `${Math.trunc(n)}–20`;
  return n <= 1 ? "1" : `1–${Math.min(20, Math.trunc(n))}`;
}

/**
 * The word for a result. Attacks hit and miss; every other check succeeds or fails.
 * @param {{checkKind?: string}} check
 * @param {"criticalSuccess"|"criticalFailure"|"success"|"failure"|"threat"|"error"} result
 */
export function outcomeLabel(check, result) {
  const attack = check?.checkKind === "attack";
  switch (result) {
    case "criticalSuccess":
      return attack ? loc`Critical hit` : loc`Critical success`;
    case "criticalFailure":
      return attack ? loc`Critical miss` : loc`Critical failure`;
    case "success":
      return attack ? loc`Hit` : loc`Success`;
    case "failure":
      return attack ? loc`Miss` : loc`Failure`;
    case "threat":
      return loc`Threat, if it succeeds`;
    case "error":
      return loc`Error, if it fails`;
    default:
      return "";
  }
}
