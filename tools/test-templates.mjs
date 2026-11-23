/**
 * The real templates, compiled and rendered outside Foundry. Catches a template that no longer parses, a partial
 * path that points nowhere, a helper nobody registers, and a helper that throws on the values a sheet can pass.
 */
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { registeredActions } from "./lib/sheet-actions.mjs";
import {
  BUILTIN_HELPERS,
  createEnvironment,
  everything,
  foundryHelperNames,
  inlinedSource,
  ROOT,
  sourceOf,
  templateCalls,
  templatePaths
} from "./lib/hbs-harness.mjs";

const SYSTEM = "systems/spycraft2/templates/";
const paths = templatePaths();
const known = new Set([...BUILTIN_HELPERS, ...foundryHelperNames(), "signed", "sc2eq", "sc2lt", "sc2tip"]);

test("every template parses and calls only registered helpers and existing partials", () => {
  assert.ok(paths.length > 20, "templates found");
  const problems = [];
  for (const path of paths) {
    const { helpers, partials } = templateCalls(sourceOf(path));
    for (const helper of helpers) if (!known.has(helper)) problems.push(`${path}: unknown helper ${helper}`);
    for (const partial of partials) if (!paths.includes(partial)) problems.push(`${path}: missing partial ${partial}`);
  }
  assert.deepEqual(problems, []);
});

test("the templates use the common helpers the stand-ins cover", () => {
  const used = new Set(paths.flatMap(path => [...templateCalls(sourceOf(path)).helpers]));
  for (const name of ["localize", "selectOptions", "checked", "signed", "sc2tip"]) assert.ok(used.has(name), name);
});

test("every template renders with every branch taken, and with none", () => {
  const env = createEnvironment();
  for (const path of paths) {
    for (const [label, context] of [
      ["full", everything()],
      ["empty", {}]
    ]) {
      let html;
      assert.doesNotThrow(() => {
        html = env.render(path, context, { root: context });
      }, `${path} (${label} context)`);
      assert.equal(typeof html, "string");
      // With nothing set, "TYPES.Item.undefined" from a concat is expected; a stray object or NaN never is.
      const raw = label === "full" ? /\[object Object\]|undefined|NaN/ : /\[object Object\]|NaN/;
      assert.doesNotMatch(html, raw, `${path} (${label}) printed a raw value`);
    }
  }
});

test("every partial a template calls is preloaded by the sheet part that renders it", () => {
  const sheets = ["module/sheets/actor-sheet.mjs", "module/sheets/item-sheet.mjs", "module/sheets/vehicle-sheet.mjs"]
    .map(file => readFileSync(join(ROOT, file), "utf8"))
    .join("\n");
  const partials = new Set(paths.flatMap(path => [...templateCalls(sourceOf(path)).partials]));
  assert.ok(partials.size > 10);
  for (const partial of partials) {
    const rest = partial.slice(SYSTEM.length),
      inFolder = rest.replace(/^(actor|item)\//, ""),
      name = rest
        .split("/")
        .pop()
        .replace(/\.hbs$/, "");
    // Listed by full path, as `${TPL}/…`, or by name in the Play tab's list of partials.
    const listed =
      sheets.includes(`"${partial}"`) ||
      sheets.includes(`\${TPL}/${inFolder}\``) ||
      (rest.startsWith("actor/play/") && sheets.includes(`"${name}"`));
    assert.ok(listed, `${partial} is preloaded by a sheet part`);
  }
});

test("the Play tab renders the same markup as one file did (whitespace aside)", () => {
  const env = createEnvironment(),
    whole = createEnvironment({
      sources: { [`${SYSTEM}actor/agent-main.hbs`]: inlinedSource(`${SYSTEM}actor/agent-main.hbs`) }
    });
  const squash = html => html.replace(/\s+/g, " ");
  for (const context of [everything(), {}]) {
    const split = env.render(`${SYSTEM}actor/agent-main.hbs`, context, { root: context });
    assert.equal(squash(split), squash(whole.render(`${SYSTEM}actor/agent-main.hbs`, context, { root: context })));
  }
});

const SHEET_TEMPLATES = paths.filter(path =>
  /templates\/(actor\/(agent-|play\/|parts\/|npc-|vehicle-sheet)|item\/|apps\/)/.test(path)
);

test("sheet, catalog and console templates author buttons, not action links, and every button has a name", () => {
  assert.ok(SHEET_TEMPLATES.length > 20);
  const env = createEnvironment();
  for (const path of SHEET_TEMPLATES) {
    const source = sourceOf(path);
    const links = [...source.matchAll(/<a [^>]*data-action="(?!tab")[^"]*"/g)].map(([link]) => link);
    assert.deepEqual(links, [], `${path} still authors action links`);
    const context = everything();
    const html = env.render(path, context, { root: context });
    for (const [button, attrs, inner] of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      assert.ok(text || /aria-label="[^"]+"/.test(attrs), `${path}: unnamed button ${button.slice(0, 120)}`);
      assert.match(attrs, /type="button"/, `${path}: ${button.slice(0, 120)}`);
    }
  }
});

test("every class-ability control runs a sheet action and shows an English string", async () => {
  const { CLASS_ABILITY_CONTROLS, classAbilityControl } = await import("../module/sheets/class-ability-controls.mjs");
  const actions = registeredActions(join(ROOT, "module/sheets"));
  const english = JSON.parse(readFileSync(join(ROOT, "lang/en.json"), "utf8"));
  const lookup = key => key.split(".").reduce((node, part) => node?.[part], english);
  const controls = [...Object.values(CLASS_ABILITY_CONTROLS), classAbilityControl("unknown")];
  assert.ok(controls.length > 30);
  for (const control of controls) {
    if (control.action) assert.ok(actions.has(control.action), control.action);
    for (const key of [control.label, control.text, control.playerText].filter(Boolean))
      assert.equal(typeof lookup(key), "string", key);
    assert.ok(control.action || control.text, JSON.stringify(control));
  }
  assert.equal(classAbilityControl(undefined), classAbilityControl("unknown"));
});

test("every action a template names is registered by a sheet or an application", () => {
  const registered = registeredActions(join(ROOT, "module/sheets"), join(ROOT, "module/apps"));
  // Actions Foundry's own document sheets provide.
  const core = new Set(["editImage"]);
  const templates = readdirSync(join(ROOT, "templates"), { recursive: true }).filter(file => file.endsWith(".hbs"));
  assert.ok(templates.length > 30);
  const missing = [];
  let seen = 0;
  for (const file of templates)
    for (const [, action] of readFileSync(join(ROOT, "templates", file), "utf8").matchAll(
      /data-action="([A-Za-z]\w*)"/g
    )) {
      seen += 1;
      if (!registered.has(action) && !core.has(action)) missing.push(`${file}: ${action}`);
    }
  assert.ok(seen > 400, `only ${seen} template actions found`);
  assert.deepEqual(missing, [], "A button names an action no sheet or application registers.");
});

// Most template lines are far too long to review, and reformatting them all at once would hide real changes. Until a
// file is reformatted, these limits stop the long lines from growing in number or in length. Lower them as files are
// reformatted (render the file before and after to prove the markup did not change).
const LONG_LINE_LIMITS = { over200: 439, over500: 100, over1000: 14, longest: 1542 };

test("template line lengths do not get worse", () => {
  const lengths = paths.flatMap(path => sourceOf(path).split("\n")).map(line => line.length);
  const count = limit => lengths.filter(length => length > limit).length;
  assert.ok(count(200) <= LONG_LINE_LIMITS.over200, `${count(200)} lines over 200 characters`);
  assert.ok(count(500) <= LONG_LINE_LIMITS.over500, `${count(500)} lines over 500 characters`);
  assert.ok(count(1000) <= LONG_LINE_LIMITS.over1000, `${count(1000)} lines over 1,000 characters`);
  assert.ok(Math.max(...lengths) <= LONG_LINE_LIMITS.longest, `longest line is ${Math.max(...lengths)} characters`);
});
