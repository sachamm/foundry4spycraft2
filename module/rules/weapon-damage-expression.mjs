/** Printed numeric damage: whole constants and dice joined by +/−.
 * Metadata (types, AP, calibers, minimums and footnotes) is not arithmetic.
 * No arbitrary Roll expression or executable text is admitted by this parser.
 */
export function weaponDamageExpression(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/[–−]/g, "-"),
    m = text.match(/^\s*([+-]?\s*(?:\d*d\d+|\d+)(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)/i);
  if (!m) return null;
  const expression = m[1].replace(/\s/g, "").replace(/^\+/, ""),
    suffix = text.slice(m[0].length).trim();
  if (
    /^[+\-/.×]/.test(suffix) ||
    /^[dD](?:\d|[+-]|$)/.test(suffix) ||
    /^[eE][+-]?\d/.test(suffix) ||
    /^\d*d\d+/i.test(suffix) ||
    (/^(?:\*|[xX])/.test(suffix) && !/^\*+(?:\s|$|\()/.test(suffix))
  )
    return null;
  for (const dice of expression.matchAll(/(\d*)d(\d+)/gi)) {
    const count = Number(dice[1] || 1),
      faces = Number(dice[2]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(faces) || faces < 1) return null;
  }
  const constants = expression
    .replace(/\d*d\d+/gi, "0")
    .split(/[+-]/)
    .filter(Boolean);
  if (constants.some(n => !/^\d+$/.test(n) || !Number.isSafeInteger(Number(n)))) return null;
  // A leading unmarked constant followed by a labelled dice component is not
  // silently flattened into one damage type. Resolve those components separately.
  const componentReview =
    /^[+-]?\s*\d+\s*\+\s*\d*d\d+/i.test(m[1]) &&
    /^(?:subdual|stress|acid|cold|electrical|explosive|fire|flash|bang|heat|sonic|vacuum)\b/i.test(suffix);
  return { expression, minimum: /min\.?\s*0/i.test(text) ? 0 : 1, componentReview };
}
