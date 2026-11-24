/**
 * The system's own Handlebars helpers. spycraft2.mjs registers them at init; the template test registers the same
 * functions on its own Handlebars, so a template that compiles there uses the helpers the sheets do.
 */

// A missing value shows a dash rather than "NaN".
export const signed = n => (!Number.isFinite(Number(n)) ? "—" : Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`);

/** @param {typeof Handlebars} handlebars */
export function registerSystemHelpers(handlebars) {
  handlebars.registerHelper("signed", signed);
  handlebars.registerHelper("sc2eq", (a, b) => a == b); // loose on purpose: templates compare numbers with strings
  handlebars.registerHelper("sc2lt", (a, b) => Number(a) < Number(b));
  // Tooltip attributes for a breakdown: rows of [label, value]. Plain text plus an HTML version with one row per line.
  handlebars.registerHelper("sc2tip", rows => {
    if (!Array.isArray(rows) || !rows.length) return "";
    const esc = handlebars.escapeExpression;
    const lines = rows.map(([label, value]) => `${label ?? ""} ${signed(value)}`.trim());
    return new handlebars.SafeString(
      `data-tooltip="${esc(lines.join(" · "))}" data-tooltip-html="${esc(lines.map(esc).join("<br>"))}"`
    );
  });
  // Tooltip attributes for a pick's rules summary, from ruleTip() in module/sheets/rule-tips.mjs.
  handlebars.registerHelper("sc2ruletip", tip => {
    if (!tip?.text) return "";
    const esc = handlebars.escapeExpression;
    return new handlebars.SafeString(`data-tooltip="${esc(tip.text)}" data-tooltip-html="${esc(tip.html)}"`);
  });
}
