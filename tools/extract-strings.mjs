#!/usr/bin/env node
/**
 * Collects every loc`…` template in the system's JavaScript into lang/en.json (under SPYCRAFT.Text).
 *
 *   npm run strings           rewrite the English entries
 *   npm run strings -- --check  fail if lang/en.json is out of date (used by the tests)
 *
 * The key of an entry is derived from its English pattern (module/i18n.mjs), so the language file never needs
 * editing by hand for English: write loc`…` in the source and run this.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
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

/** Every distinct pattern used with the `loc` tag: Map<key, pattern>. Throws if two patterns share a key. */
export function collectStrings(root = ROOT) {
  const found = new Map();
  for (const file of [...sources(join(root, "module")), join(root, "spycraft2.mjs")]) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("loc`")) continue;
    const ast = espree.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    (function visit(node) {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "TaggedTemplateExpression" && node.tag.type === "Identifier" && node.tag.name === "loc") {
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
  for (const text of configStrings(SPYCRAFT)) found.set(keyOf(text), text);
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const path = join(ROOT, "lang/en.json");
  const lang = JSON.parse(readFileSync(path, "utf8"));
  const next = Object.fromEntries(collectStrings());
  const current = lang.SPYCRAFT.Text ?? {};
  const same = JSON.stringify(current) === JSON.stringify(next);
  if (process.argv.includes("--check")) {
    if (!same) {
      console.error("lang/en.json is out of date with the loc`…` strings in the source. Run `npm run strings`.");
      process.exit(1);
    }
    console.log(`lang/en.json: ${Object.keys(next).length} source strings, up to date.`);
  } else {
    lang.SPYCRAFT.Text = next;
    writeFileSync(path, JSON.stringify(lang, null, 1) + "\n");
    console.log(`lang/en.json: ${Object.keys(next).length} source strings written${same ? " (no change)" : ""}.`);
  }
}
