/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Golden output for computeAgent: every derived property of the sample agents, at level 1 and advanced to levels
 * 5, 10 and 20 in their class, is fingerprinted and compared with tools/golden/engine.json. A refactor of
 * the engine must leave every fingerprint alone. After an intended rules change, review the properties the failure
 * names and rewrite the file with `UPDATE_GOLDEN=1 node --test tools/test-engine-golden.mjs`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT } from "../module/config.mjs";

const FILE = new URL("./golden/engine.json", import.meta.url);

/** JSON with sorted keys; sets, maps and functions are written so that a change in them shows. */
const plain = value => {
  if (value instanceof Set) return { $set: [...value].map(plain) };
  if (value instanceof Map) return { $map: [...value].map(([k, v]) => [plain(k), plain(v)]) };
  if (typeof value === "function") return "$function";
  if (value === undefined) return "$undefined";
  if (typeof value === "number" && !Number.isFinite(value)) return `$${value}`;
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, plain(value[key])])
    );
  return value;
};
const print = value =>
  createHash("sha256")
    .update(JSON.stringify(plain(value)))
    .digest("hex")
    .slice(0, 16);

const pack = buildPacks().packs["sample-agents"];
const derive = (doc, level) => {
  const system = structuredClone(doc.system);
  // Later levels repeat the first: skill points, feats and choices are left unspent, which is what the to-do
  // list, the warnings and the budgets are for.
  while (system.progression.length < level) system.progression.push(structuredClone(system.progression[0]));
  return computeAgent(
    system,
    doc.embedded.items.map(item => ({ ...structuredClone(item), id: item._id })),
    SPYCRAFT
  );
};

const derived = {};
for (const doc of pack.docs) for (const level of [1, 5, 10, 20]) derived[`${doc.name} L${level}`] = derive(doc, level);
// One column per derived property, eight characters per fingerprint, so the file stays small.
const properties = [...new Set(Object.values(derived).flatMap(Object.keys))].sort();
const WIDTH = 8;
const row = system =>
  properties.map(key => (key in system ? print(system[key]).slice(0, WIDTH) : "-".repeat(WIDTH))).join("");
const actual = { properties, agents: Object.fromEntries(Object.entries(derived).map(([name, s]) => [name, row(s)])) };

test("computeAgent derives the same value for every property of every sample agent", () => {
  if (process.env.UPDATE_GOLDEN) {
    writeFileSync(FILE, `${JSON.stringify(actual, null, 1)}\n`);
    return;
  }
  assert.ok(existsSync(FILE), "tools/golden/engine.json is missing");
  const expected = JSON.parse(readFileSync(FILE, "utf8"));
  assert.deepEqual(actual.properties, expected.properties, "the set of derived properties changed");
  assert.deepEqual(Object.keys(actual.agents), Object.keys(expected.agents));
  for (const [agent, prints] of Object.entries(expected.agents)) {
    const changed = properties.filter(
      (key, i) => prints.slice(i * WIDTH, (i + 1) * WIDTH) !== actual.agents[agent].slice(i * WIDTH, (i + 1) * WIDTH)
    );
    assert.deepEqual(changed, [], `${agent}: derived properties changed`);
  }
});

test("the same input derives the same output twice", () => {
  const doc = pack.docs[0];
  assert.equal(print(derive(doc, 10)), print(derive(doc, 10)));
});
