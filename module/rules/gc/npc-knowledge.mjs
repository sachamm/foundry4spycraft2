/**
 * Snitches (p.458) and Table 7.15 (p.460): what a questioned NPC can tell the team. An opposed Impress/Persuasion or
 * Intimidate/Coercion check against the NPC's Competence or Sense Motive gives the row for the margin, but no higher
 * than the NPC's Competence grade, grade III for anyone who is not one of the mission's villains, and grade VII for a
 * villain who is not a henchman or the mastermind. Each grade includes all lower grades.
 */
import { GC_DATA } from "../gc-tables.mjs";
import { ratingDetails, RATINGS } from "./organization.mjs";
import { loc } from "../../i18n.mjs";

export const NPC_KNOWLEDGE = GC_DATA.tables.npcKnowledge;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** The NPC's place in the mission: "mastermind", "henchman", "villain" (a minion or other villain) or "other". */
export function knowledgeRole(npc = {}) {
  const ids = new Set((npc.qualities ?? []).map(quality => quality.id ?? quality));
  if (ids.has("mastermind")) return "mastermind";
  if (ids.has("henchman")) return "henchman";
  if (ids.has("minion") || npc.npcType === "villain") return "villain";
  return "other";
}

/** The highest grade this role allows. */
export const roleCap = role =>
  role === "mastermind" || role === "henchman"
    ? 10
    : role === "villain"
      ? NPC_KNOWLEDGE.villainMax
      : NPC_KNOWLEDGE.nonVillainMax;

/** Action dice the GC spends to rule that the NPC knows nothing; null when the GC may not (a mastermind). */
export function knowsNothingCost(role, npcType = "standard") {
  if (role === "mastermind") return null;
  if (role === "henchman") return NPC_KNOWLEDGE.knowsNothingCost.henchman;
  if (role === "villain" && npcType !== "special") return NPC_KNOWLEDGE.knowsNothingCost.minion;
  return npcType === "special" ? NPC_KNOWLEDGE.knowsNothingCost.special : NPC_KNOWLEDGE.knowsNothingCost.standard;
}

/**
 * The result of questioning: `difference` is the team's check result minus the NPC's. A tie or loss yields nothing.
 * Returns the grade reached, what held it back, the lines learned (lowest first) and how many organization Ratings
 * the team learns in full.
 */
export function npcKnowledge({ difference, competence, role = "other" }) {
  const margin = Number(difference),
    grade = Math.max(0, Math.min(10, Math.trunc(Number(competence) || 0)));
  if (!Number.isFinite(margin) || margin <= 0)
    return { grade: 0, byMargin: 0, limit: null, rows: [], ratings: 0, flawed: false };
  const byMargin = NPC_KNOWLEDGE.rows.filter(row => margin >= Math.max(1, row.min)).at(-1)?.grade ?? 0,
    cap = roleCap(role),
    reached = Math.min(byMargin, grade, cap);
  const limit = reached >= byMargin ? null : reached === grade ? "competence" : "role";
  const rows = NPC_KNOWLEDGE.rows.filter(row => row.grade <= reached);
  return {
    grade: reached,
    byMargin,
    limit,
    rows,
    ratings: Math.max(0, ...rows.map(row => row.ratings)),
    flawed: reached > 0 && reached <= 3
  };
}

export const knowledgeGrade = grade => ROMAN[grade - 1] ?? "—";

/** Lines for a GC card: what was learned and, when an enemy organization is recorded, the Ratings it gives away. */
export function knowledgeLines(result, organization = null, chosenRatings = null) {
  const lines = result.rows.map(row => `${knowledgeGrade(row.grade)}: ${row.label}`);
  if (result.ratings && organization) {
    const keys = (chosenRatings?.length ? chosenRatings : RATINGS).slice(0, result.ratings);
    for (const key of keys) lines.push(ratingDetails(organization, key));
  } else if (result.ratings) lines.push(loc`Full details of ${result.ratings} of the enemy organization's Ratings.`);
  return lines;
}
