/**
 * Translatable text written in place.
 *
 *   loc`Focus, forte and synergy`
 *   loc`Roll ${index}: ${total} (natural ${die})`
 *
 * The English stays in the source. Its pattern ("Roll {0}: {1} (natural {2})") names a key under SPYCRAFT.Text in
 * a language file; `npm run strings` collects every pattern into lang/text-template.json for translators. English
 * needs no entries: lang/en.json holds only the few keys Foundry localises by itself (see locKey). When the active
 * language has a translation for the key it is used, with the values placed at their numbered positions (a translation may
 * reorder them); otherwise the English is returned exactly as a plain template literal would produce it.
 *
 * Changing the English changes the key, so a translation is tied to the wording it was written for.
 * This module is pure: without Foundry's `game.i18n` it simply returns the English.
 */

const PREFIX = "SPYCRAFT.Text.";
const entries = new WeakMap();

/** The pattern of a template: its text with {0}, {1}, … where the values go. */
export function patternOf(strings) {
  let pattern = strings[0];
  for (let i = 1; i < strings.length; i++) pattern += `{${i - 1}}${strings[i]}`;
  return pattern;
}

/** A short stable hash of a pattern (FNV-1a, 32 bits, base 36). */
export function hashOf(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** A readable slug from the first words of a pattern, ignoring markup and placeholders. */
export function slugOf(pattern) {
  const words = pattern
    .replace(/<[^>]*>/g, " ")
    .replace(/\{\d+\}/g, " ")
    .match(/[A-Za-z0-9]+/g);
  const slug = (words ?? [])
    .slice(0, 6)
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join("")
    .slice(0, 40);
  return slug || "Text";
}

/** The language-file key for a pattern, below SPYCRAFT.Text. */
export function keyOf(pattern) {
  return `${slugOf(pattern)}_${hashOf(pattern)}`;
}

/** Put values into a pattern at their numbered positions. */
export function fill(pattern, values) {
  if (!values.length) return pattern;
  return pattern.replace(/\{(\d+)\}/g, (match, index) => (index < values.length ? String(values[index]) : match));
}

/**
 * Template tag for text that Foundry itself localises when it is shown (a setting's name, hint or choices): returns
 * the key, which `npm run strings` keeps in lang/en.json. Use it where the text is fixed before the language has
 * loaded, such as in `init`. It takes no values.
 */
export function locKey(strings, ...values) {
  if (values.length) throw new Error("locKey takes plain text; use loc for text with values.");
  return PREFIX + keyOf(strings[0]);
}

/** Template tag: the text in the active language, or the English written in the source. */
export function loc(strings, ...values) {
  let entry = entries.get(strings);
  if (!entry) {
    const pattern = patternOf(strings);
    entry = { pattern, key: PREFIX + keyOf(pattern) };
    entries.set(strings, entry);
  }
  const i18n = globalThis.game?.i18n;
  if (i18n?.has?.(entry.key)) {
    const translated = i18n.localize(entry.key);
    if (typeof translated === "string" && translated !== entry.key) return fill(translated, values);
  }
  // Same result as the untagged template literal.
  let text = strings[0];
  for (let i = 1; i < strings.length; i++) text += String(values[i - 1]) + strings[i];
  return text;
}
