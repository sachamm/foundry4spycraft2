/**
 * The breakdown tooltip on a roll card: hovering (or focusing) the formula and total lists the die, each part of
 * the bonus and the total they reach, so nobody has to ask where "+7" came from. The card itself stays as short as
 * it was (style guide 7.5); the parts were recorded when the roll was made (`breakdown` on the check record).
 */
import { loc } from "../i18n.mjs";
import { tipHtml, tipLines } from "../handlebars-helpers.mjs";
import { checkBreakdown } from "../rules/bonus-breakdown.mjs";

const escape = text =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** The tooltip's rows for a check record, or null when the card has nothing to explain. */
export function breakdownTipRows(check) {
  const breakdown = checkBreakdown(check);
  if (!breakdown) return null;
  const rows = breakdown.rows.map(row => [row.label, row.value]);
  if (breakdown.damage) return [...rows, [loc`Damage bonus`, breakdown.total, "total"]];
  const fixed = (check.checkMethod ?? "roll") !== "roll";
  return [
    [fixed ? loc`Taken` : loc`Die`, breakdown.die, "plain"],
    ...rows,
    [loc`Total`, breakdown.total, "plain total"]
  ];
}

/**
 * Whether this viewer is shown the parts. An agent's are open to the table, as its formula is. An NPC's stay with
 * whoever may open that NPC: an open NPC roll tells the players the result, not what the NPC is made of (7.2).
 */
function mayExplain(message, check, user) {
  if (message.isContentVisible === false || (message.blind && !user?.isGM)) return false;
  if (user?.isGM || message.isAuthor) return true;
  let actor = null;
  try {
    actor = check.actorUuid ? globalThis.fromUuidSync?.(check.actorUuid) : null;
  } catch {
    actor = null;
  }
  return !!actor && (actor.isOwner === true || actor.type === "agent");
}

/** Put the breakdown on a rendered roll card (the `renderChatMessageHTML` hook). */
export function renderCheckBreakdown(message, html, user = globalThis.game?.user) {
  const check = message.flags?.spycraft2;
  const result = html?.querySelector?.(".message-content .dice-result");
  if (!check || !result || result.dataset.sc2Breakdown || !mayExplain(message, check, user)) return;
  const rows = breakdownTipRows(check);
  if (!rows) return;
  const lines = tipLines(rows);
  const text = lines.map(line => line.text).join(" · ");
  result.dataset.sc2Breakdown = "true";
  result.dataset.tooltip = text;
  result.dataset.tooltipHtml = tipHtml(lines, escape);
  // Reachable by keyboard, and read out after the formula and total.
  result.tabIndex = 0;
  result.setAttribute("aria-description", text);
}
