/**
 * The system's own Handlebars helpers. spycraft2.mjs registers them at init; the template test registers the same
 * functions on its own Handlebars, so a template that compiles there uses the helpers the sheets do.
 */

// A missing value shows a dash rather than "NaN".
export const signed = n => (!Number.isFinite(Number(n)) ? "—" : Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`);

/**
 * The lines of a breakdown tooltip. A row is `[label, value]`, shown with a sign ("DEX +2"); a third entry changes
 * that: "plain" prints the value without a sign ("Base 12"), "total" marks the closing line, which is set in bold,
 * and "plain total" does both. A row without a value prints its label alone.
 * @param {Array<[string, number?, string?]>} rows
 * @returns {Array<{text: string, total: boolean}>}
 */
export function tipLines(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(Array.isArray)
    .map(([label, value, kind]) => ({
      text: `${label ?? ""} ${value === undefined || value === null ? "" : /plain/.test(kind) ? value : signed(value)}`.trim(),
      total: /total/.test(kind)
    }))
    .filter(line => line.text);
}

/** The same lines as markup, one per line. `esc` escapes text for HTML. */
export const tipHtml = (lines, esc) =>
  lines.map(line => (line.total ? `<strong>${esc(line.text)}</strong>` : esc(line.text))).join("<br>");

/** @param {typeof Handlebars} handlebars */
export function registerSystemHelpers(handlebars) {
  handlebars.registerHelper("signed", signed);
  handlebars.registerHelper("sc2eq", (a, b) => a == b); // loose on purpose: templates compare numbers with strings
  handlebars.registerHelper("sc2lt", (a, b) => Number(a) < Number(b));
  // Tooltip attributes for a breakdown: plain text plus an HTML version with one row per line.
  handlebars.registerHelper("sc2tip", rows => {
    const lines = tipLines(rows);
    if (!lines.length) return "";
    const esc = handlebars.escapeExpression;
    return new handlebars.SafeString(
      `data-tooltip="${esc(lines.map(line => line.text).join(" · "))}" data-tooltip-html="${esc(tipHtml(lines, esc))}"`
    );
  });
  // Tooltip attributes for a pick's rules summary, from ruleTip() in module/sheets/rule-tips.mjs.
  handlebars.registerHelper("sc2ruletip", tip => {
    if (!tip?.text) return "";
    const esc = handlebars.escapeExpression;
    return new handlebars.SafeString(`data-tooltip="${esc(tip.text)}" data-tooltip-html="${esc(tip.html)}"`);
  });
}
