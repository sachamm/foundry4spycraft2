/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { featActions } from "../module/sheets/feat-actions.mjs";

const actions = (item, options) => featActions(item, options).map(entry => entry.action);

test("a feat offers its play buttons by rule name, so a renamed item keeps them", () => {
  assert.deepEqual(actions({ name: "Quick Draw" }), ["useFeatFreeAction"]);
  assert.equal(featActions({ name: "Surge of Speed" })[0].resource, "surgeOfSpeed");
  assert.deepEqual(actions({ name: "Dégainer", flags: { spycraft2: { ruleName: "Quick Draw" } } }), [
    "useFeatFreeAction"
  ]);
  assert.deepEqual(actions({ name: "Marque", flags: { babele: { originalName: "Mark" } } }), ["useMark"]);
  assert.deepEqual(actions({ name: "Some other feat" }), []);
});

test("no button for an unqualified feat, and the GC-only button is hidden from players", () => {
  assert.deepEqual(actions({ name: "Mark" }, { qualified: false }), []);
  assert.deepEqual(actions({ name: "Silver Tongue" }, { isGM: false }), []);
  assert.deepEqual(actions({ name: "Silver Tongue" }, { isGM: true }), ["settleSilverTongueVictory"]);
});

test("templates and styles do not choose behaviour from a displayed name", () => {
  const feats = readFileSync(new URL("../templates/actor/agent-feats.hbs", import.meta.url), "utf8");
  assert.doesNotMatch(feats, /sc2eq item\.name "/);
  const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
  for (const name of ["Everyday Genius", "Quick Draw", "Surge of Speed", "Silver Tongue", "Mark"])
    for (const entry of featActions({ name }, { isGM: true })) {
      const value = entry.label.split(".").reduce((node, part) => node?.[part], en);
      assert.equal(typeof value, "string", entry.label);
    }
  for (const file of ["retro.css", "components.css", "spycraft2.css", "sheet-agent.css"])
    assert.doesNotMatch(readFileSync(new URL(`../styles/${file}`, import.meta.url), "utf8"), /\[aria-label[~|^$*]?=/);
});
