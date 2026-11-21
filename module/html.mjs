/**
 * Escaping for HTML built as strings (dialog content, chat cards, flavor). Pure: no Foundry UI, so rules modules may
 * use it as well as apps. Escaping goes through Foundry's own escapeHTML when it is loaded, so the output matches
 * what the rest of the system writes.
 */

// Foundry's escapeHTML, written out for code that runs before Foundry loads (and for tests of pure rules).
const fallback = text =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

/** Text made safe to place in HTML: element content or a quoted attribute value. null and undefined become "". */
export const esc = value => (globalThis.foundry?.utils?.escapeHTML ?? fallback)(String(value ?? ""));

/** Markup that `markup` inserts as it is. Only for HTML this system wrote itself, never for a name or a user's text. */
export class RawHTML {
  constructor(markup) {
    this.markup = String(markup ?? "");
  }
  toString() {
    return this.markup;
  }
}

/** Mark trusted markup (a fragment this code built) so `markup` does not escape it again. */
export const raw = text => (text instanceof RawHTML ? text : new RawHTML(text));

const piece = value => {
  if (value instanceof RawHTML) return value.markup;
  if (Array.isArray(value)) return value.map(piece).join("");
  if (value === null || value === undefined || value === false) return "";
  return esc(value);
};

/**
 * A template tag that escapes every interpolated value, for a finished piece of markup (a dialog's content, a chat
 * card). Arrays are joined, and null, undefined and false print nothing. A piece built with `markupFragment` or marked
 * with `raw` goes in as it is; any other string is escaped, including the plain string another `markup` call
 * returned, so build nested pieces with `markupFragment`:
 *
 *   markup`<ul>${rows.map(row => markupFragment`<li>${row.name}</li>`)}</ul>`
 *
 * The tag is not called html because Prettier reformats templates tagged html, which would change their output.
 */
export function markup(strings, ...values) {
  return String(markupFragment(strings, ...values));
}

/** Like `markup`, but returns RawHTML, for a piece that goes inside another `markup` or `markupFragment` template. */
export function markupFragment(strings, ...values) {
  let out = strings[0];
  values.forEach((value, index) => {
    out += piece(value) + strings[index + 1];
  });
  return new RawHTML(out);
}
