#!/usr/bin/env node
/**
 * Collects every loc`…` and locKey`…` template in the system's JavaScript.
 *
 *   npm run strings           rewrite the generated entries
 *   npm run strings -- --check  fail if they are out of date (used by the tests)
 *
 * Everything goes to lang/text-template.json (under SPYCRAFT.Text), the file a translator copies. It is not listed
 * in system.json, so no client loads it: English text is already in the source. Only the locKey`…` entries, which
 * Foundry localises by itself, are also written to lang/en.json.
 *
 * The key of an entry is derived from its English pattern (module/i18n.mjs), so neither file needs editing by hand
 * for English: write loc`…` in the source and run this.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as espree from "espree";
import { keyOf, patternOf } from "../module/i18n.mjs";
import { configStrings } from "../module/i18n-data.mjs";
import { SPYCRAFT } from "../module/config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = dir =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".mjs") ? [path] : [];
  });

/**
 * Every distinct pattern used with the `loc` or `locKey` tag: Map<key, pattern>. Throws if two patterns share a key.
 * With `only: "locKey"`, just the patterns Foundry localises by itself.
 */
export function collectStrings(root = ROOT, { only = null } = {}) {
  const found = new Map();
  const tags = only ? [only] : ["loc", "locKey"];
  for (const file of [...sources(join(root, "module")), join(root, "spycraft2.mjs")]) {
    const source = readFileSync(file, "utf8");
    if (!/\bloc(Key)?`/.test(source)) continue;
    const ast = espree.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    (function visit(node) {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "TaggedTemplateExpression" && node.tag.type === "Identifier" && tags.includes(node.tag.name)) {
        const pattern = patternOf(node.quasi.quasis.map(quasi => quasi.value.cooked));
        const key = keyOf(pattern);
        if (found.has(key) && found.get(key) !== pattern) {
          throw new Error(`Two patterns share the key ${key}: "${found.get(key)}" and "${pattern}"`);
        }
        found.set(key, pattern);
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    })(ast);
  }
  // Display names held in the rules data (skills, named checks, feat trees, pick categories, bonus targets).
  if (!only) for (const text of configStrings(SPYCRAFT)) found.set(keyOf(text), text);
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const targets = [
    { path: "lang/text-template.json", next: Object.fromEntries(collectStrings()) },
    { path: "lang/en.json", next: Object.fromEntries(collectStrings(ROOT, { only: "locKey" })) }
  ];
  let stale = false;
  for (const { path, next } of targets) {
    const file = join(ROOT, path);
    const lang = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { SPYCRAFT: {} };
    const same = JSON.stringify(lang.SPYCRAFT.Text ?? {}) === JSON.stringify(next);
    if (process.argv.includes("--check")) {
      if (!same) {
        console.error(`${path} is out of date with the strings in the source. Run \`npm run strings\`.`);
        stale = true;
      } else console.log(`${path}: ${Object.keys(next).length} source strings, up to date.`);
      continue;
    }
    lang.SPYCRAFT.Text = next;
    writeFileSync(file, JSON.stringify(lang, null, 1) + "\n");
    console.log(`${path}: ${Object.keys(next).length} source strings written${same ? " (no change)" : ""}.`);
  }
  if (stale) process.exit(1);
}
