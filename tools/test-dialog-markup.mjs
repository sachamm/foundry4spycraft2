/**
 * Dialogs and chat cards built as HTML strings in module/ get no template check, so their markup is checked here:
 * controls are real buttons that cannot submit the dialog by accident, and every field has a name a screen reader
 * can announce without the runtime guess in ui-tooltips.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/hbs-harness.mjs";

const MODULE = join(ROOT, "module");
const sources = readdirSync(MODULE, { recursive: true })
  .filter(file => file.endsWith(".mjs"))
  .map(file => ({ file, source: readFileSync(join(MODULE, file), "utf8") }));
const lineOf = (source, index) => source.slice(0, index).split("\n").length;

test("string-built markup uses buttons for actions, each typed so it cannot submit its dialog", () => {
  assert.ok(sources.length > 100);
  const problems = [];
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/<a\s[^>]*data-(action|roll-control)=/g))
      problems.push(`${file}:${lineOf(source, match.index)} action link`);
    for (const match of source.matchAll(/<button\b[^>]*>/g))
      if (!/\btype=/.test(match[0])) problems.push(`${file}:${lineOf(source, match.index)} button without a type`);
  }
  assert.deepEqual(problems, []);
});

test("every field in string-built markup has a label, an aria-label or a for= label", () => {
  let fields = 0;
  const problems = [];
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
      const attrs = match[2];
      if (/\btype="hidden"/.test(attrs)) continue;
      fields += 1;
      if (/\baria-label(ledby)?=/.test(attrs)) continue;
      // Inside a <label> that is still open where the field starts.
      const before = source.slice(0, match.index);
      if (before.lastIndexOf("<label") > before.lastIndexOf("</label>")) continue;
      const id = attrs.match(/\bid="([^"]+)"/)?.[1];
      if (id && source.includes(`for="${id}"`)) continue;
      problems.push(`${file}:${lineOf(source, match.index)} <${match[1]}${attrs.slice(0, 60)}`);
    }
  }
  assert.ok(fields > 300, `only ${fields} fields found`);
  assert.deepEqual(problems, []);
});

test("refusals return false through refuse(), not the truthy notification (only the reviewed exceptions remain)", () => {
  // Each remaining site returns into a hook, a Foundry method or queued resource work, where false can mean
  // something else, so they were left for review one by one. New code uses refuse() from the dialog kit.
  const sites = sources.flatMap(({ file, source }) =>
    [...source.matchAll(/return ui\.notifications\.warn\(/g)].map(match => `${file}:${lineOf(source, match.index)}`)
  );
  assert.ok(sites.length <= 42, `${sites.length} sites return a notification:\n${sites.join("\n")}`);
});
