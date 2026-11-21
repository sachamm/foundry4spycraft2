#!/usr/bin/env node
/**
 * Looks for runs of words in our data and UI strings that also appear, word for word, in a local text copy of the
 * rulebook. AGENTS.md forbids copying the book's wording; this is the check to run before committing new text.
 *
 * The rulebook is not in the repository and never will be, so the check needs a path to your own copy:
 *
 *   SPYCRAFT_RULEBOOK_TEXT=/path/to/rulebook.md npm run check:copy
 *   npm run check:copy -- /path/to/rulebook.md [--min 12] [--report 8]
 *
 * Labels are allowed (AGENTS.md), and lists of them (skill names, vehicle quality codes, table titles) often match
 * the book for many words. So a run only counts as prose when at least 30% of its words are function words such as
 * "the", "of" or "your"; label lists score far lower. Prose runs of at least --report words (default 8) are listed,
 * and the check fails when one reaches --min words (default 12). --all also lists the label runs.
 * Without a rulebook path the check prints a note and exits 0.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [, value] = args.splice(i, 2);
  return Number.parseInt(value, 10);
};
const minRun = option("--min", 12);
const reportRun = option("--report", 8);
const showAll = args.includes("--all") && Boolean(args.splice(args.indexOf("--all"), 1));
const bookPath = args[0] ?? process.env.SPYCRAFT_RULEBOOK_TEXT;
const FUNCTION_WORDS = new Set(
  "a an the of to you your is are and or in on with it this that by for as be if at its their they them from into each any one not no can may must when while than then who which per has have had was were do does".split(
    " "
  )
);
const proseShare = run => run.filter(w => FUNCTION_WORDS.has(w)).length / run.length;

if (!bookPath || !existsSync(bookPath)) {
  console.log("check-copied-text: no rulebook text given (SPYCRAFT_RULEBOOK_TEXT or a path argument); skipped.");
  process.exit(0);
}

/** Lower-case words with typographic quotes and dashes folded, so “don’t” and "don't" compare equal. */
const words = text =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .toLowerCase()
    .match(/[a-z0-9']+/g) ?? [];

const N = reportRun;
const bookWords = words(readFileSync(bookPath, "utf8"));
const shingles = new Set();
for (let i = 0; i + N <= bookWords.length; i++) shingles.add(bookWords.slice(i, i + N).join(" "));

function* strings(value, path = "") {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}/${k}`);
}

const files = [
  ...readdirSync(join(root, "src/data"))
    .filter(f => f.endsWith(".json"))
    .map(f => join(root, "src/data", f)),
  join(root, "lang/en.json")
];

const hits = [];
for (const file of files) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  for (const [path, text] of strings(data)) {
    const w = words(text);
    let run = 0,
      best = 0,
      bestStart = 0,
      start = 0;
    for (let i = 0; i + N <= w.length; i++) {
      if (shingles.has(w.slice(i, i + N).join(" "))) {
        if (!run) start = i;
        run++;
        if (run > best) [best, bestStart] = [run, start];
      } else run = 0;
    }
    if (best) {
      const length = best + N - 1,
        run = w.slice(bestStart, bestStart + length);
      const prose = proseShare(run) >= 0.3;
      if (prose || showAll) hits.push({ file: relative(root, file), path, length, prose, run: run.join(" ") });
    }
  }
}

hits.sort((a, b) => b.length - a.length);
const failing = hits.filter(h => h.prose && h.length >= minRun);
for (const h of hits) {
  const mark = failing.includes(h) ? "FAIL" : h.prose ? "note" : "label";
  console.log(`${mark} ${h.length} words  ${h.file} ${h.path}\n      ${h.run.slice(0, 200)}`);
}
console.log(
  `check-copied-text: ${hits.filter(h => h.prose).length} string(s) share a prose run of ${reportRun}+ words with the rulebook; ${failing.length} reach ${minRun}.`
);
process.exit(failing.length ? 1 : 0);
