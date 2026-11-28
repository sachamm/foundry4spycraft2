/**
 * The style guide's lints (docs/ui-style-guide.md, section 11.2). None needs the rulebook, so they run with `npm test`.
 *
 * A lint whose count is already nought is a hard rule. One with a backlog of old strings is a ratchet: its count may
 * fall but never rise, so new text follows the guide while the old text is reworded as its surface is touched. When a
 * count falls, lower its cap here in the same change.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const flat = (object, prefix = "", out = {}) => {
  for (const [key, value] of Object.entries(object))
    if (typeof value === "string") out[prefix + key] = value;
    else flat(value, `${prefix}${key}.`, out);
  return out;
};
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const en = flat(JSON.parse(read("lang/en.json")));
// Every `loc` string in the code, as `npm run strings` collects them.
const text = flat(JSON.parse(read("lang/text-template.json")));
const strings = Object.entries({ ...en, ...text });
const files = (dir, ext) =>
  fs
    .readdirSync(new URL(`../${dir}`, import.meta.url), { recursive: true })
    .filter(name => name.endsWith(ext))
    .map(name => path.posix.join(dir, name.split(path.sep).join("/")));
const hits = pattern => strings.filter(([, value]) => pattern.test(value));
const sample = list =>
  list
    .slice(0, 5)
    .map(([key, value]) => `\n  ${key}: ${String(value).slice(0, 90)}`)
    .join("");
const lineHits = (list, pattern, skip = () => false) =>
  list.flatMap(file =>
    read(file)
      .split("\n")
      .map((line, index) => [`${file}:${index + 1}`, line])
      .filter(([, line]) => pattern.test(line) && !skip(line))
  );

const HARD = {
  "banned terms (4.2)":
    /\b(GM|HP|VP|WP|AD)\b|Game Master|Game Controller|game moderator|Threat level|GC pool|session pool|[Ss]aving throw|[Ff]lat ?[Ff]ooted|defence|Tyre/,
  "a number glued to a word (4.4)": /\b(by|minimum|maximum|level|than|to|of|at|Use)\d|[a-z]{3,}\d+[a-z]/,
  "a hyphen in a number range; use the en dash (4.4)": /\d+-\d+/,
  "developer words (4.3)": /\bRAW\b|\bnpm\b|flags must/
};
for (const [name, pattern] of Object.entries(HARD))
  test(`no user-facing string has ${name}`, () => {
    const found = hits(pattern);
    assert.equal(found.length, 0, `${found.length} found:${sample(found)}`);
  });

// Old text still to be reworded (backlog B-155 to B-158). Lower a cap whenever its count falls.
const RATCHET = {
  "a fragment: starts or ends with a separator or bracket": [/^[)·—,/]|[(·—]$/, 159],
  'the internal word "receipt"': [/receipt/i, 132],
  'the internal word "actual"': [/\bactual\b/i, 742],
  'the internal word "recorded"': [/\brecorded\b/i, 454],
  "the first person": [/^I |I am/, 90],
  "more than 160 characters": [/^.{161,}$/s, 410],
  "more than 300 characters": [/^.{301,}$/s, 51]
};
for (const [name, [pattern, cap]] of Object.entries(RATCHET))
  test(`strings with ${name} do not grow past ${cap}`, () => {
    const found = hits(pattern);
    assert.ok(
      found.length <= cap,
      `${found.length} strings, cap ${cap}. Reword the new one:${sample(found.slice(-5))}`
    );
  });

test("templates use buttons for actions, data-tooltip for help and no branch on an item's name", () => {
  const templates = files("templates", ".hbs");
  const anchors = lineHits(templates, /<a [^>]*data-action/);
  assert.equal(anchors.length, 0, `An action is a <button>, not a link:${sample(anchors)}`);
  // A partial's own `title=` parameter is a heading, not a native tooltip.
  const titles = lineHits(templates, /\stitle="/, line => /\{\{>[^}]*\stitle="/.test(line));
  assert.equal(titles.length, 0, `Hover help goes in data-tooltip:${sample(titles)}`);
  const names = lineHits(templates, /sc2eq item\.name/);
  assert.equal(names.length, 0, `Behaviour is declared in data, not keyed on a name:${sample(names)}`);
});

test("stylesheets take colours from the tokens and keep text at 13px or more", () => {
  const sheets = files("styles", ".css").filter(file => !file.endsWith("tokens.css"));
  const colours = lineHits(sheets, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, line => /^\s*(\/\*|\*)/.test(line));
  // Fallbacks inside var(…, #hex) written before the tokens were complete; do not add more.
  assert.ok(colours.length <= 16, `${colours.length} literal colours, cap 16:${sample(colours.slice(-5))}`);
  // One token vocabulary: the colour names of the first design pass are gone and stay gone.
  const old = lineHits(files("styles", ".css"), /--sc2-(teal|bad|paper|brass|on-teal)\b/);
  assert.equal(old.length, 0, `Use the role tokens (action, danger, surface, rule):${sample(old)}`);
  const small = lineHits(sheets, /font(-size)?:[^;]*\b(9|10|11|12)px/);
  assert.equal(small.length, 0, `Text under 13px:${sample(small)}`);
});
