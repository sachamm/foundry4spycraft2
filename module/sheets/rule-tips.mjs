/**
 * Hover help for a character's picks (talent, specialty, feats): what the pick does, in the system's own short
 * summary, then the choices the owner made for it. Built from the text a viewer may already read, so anyone who can
 * open the sheet sees the same rules the owner sees on the item.
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", times: "×" };

/**
 * Plain text of stored or rendered rich text: secret blocks and tags dropped, block ends kept apart, document links
 * reduced to their label, common entities decoded.
 */
export function summaryText(html) {
  return (
    String(html ?? "")
      // A last guard only: callers pass text already rendered with secrets off (see enrich()).
      .replace(/<section\b[^>]*\bclass=(["'])[^"']*\bsecret\b[^"']*\1[^>]*>[\s\S]*?<\/section>/gi, " ")
      .replace(/@\w+\[([^\]]*)\](?:\{([^}]*)\})?/g, (whole, target, label) => label ?? target.split(".").at(-1))
      .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "$& ")
      .replace(/<[^>]*>/g, "")
      .replace(/&(#x?[0-9a-f]+|\w+);/gi, (whole, code) => {
        if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
        const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
      })
      .replace(/\s+/g, " ")
      .trim()
  );
}

const escape = text =>
  String(text ?? "").replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

/**
 * Tooltip text for one pick.
 * @param {object} pick
 * @param {string} pick.kind what sort of pick this is ("Talent", "Combat feat"), shown first
 * @param {string} [pick.summary] the rules summary, as rendered HTML or plain text
 * @param {{label: string, value: string}[]} [pick.picks] choices made for it, shown one per line
 * @returns {{text: string, html: string}|null} plain text for `data-tooltip` and markup for `data-tooltip-html`
 */
export function ruleTip({ kind, summary, picks = [] }) {
  const body = summaryText(summary);
  const rows = picks.filter(row => row?.value);
  if (!body && !rows.length) return null;
  const lead = [kind, body].filter(Boolean).join(": ");
  const lines = rows.map(row => `${row.label}: ${row.value}`);
  return {
    text: [lead, ...lines].join(" · "),
    html: [
      `<strong>${escape(kind)}</strong>${body ? ` ${escape(body)}` : ""}`,
      ...rows.map(row => `${escape(row.label)}: <b>${escape(row.value)}</b>`)
    ].join("<br>")
  };
}

/** The choices made on an origin's fields, with each option's label rather than its stored key. */
export function chosenPicks(fields = []) {
  return fields
    .filter(field => field.value !== undefined && field.value !== null && field.value !== "")
    .map(field => ({ label: field.label, value: String(field.options?.[field.value] ?? field.value) }));
}
