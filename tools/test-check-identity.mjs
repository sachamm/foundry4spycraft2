/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from "node:test";
import assert from "node:assert/strict";
import { SKILLS } from "../module/rules/tables.mjs";
import { checkFocus, isHideCheck } from "../module/rules/check-identity.mjs";

test("every named check has an id unique in its skill, and its focus is its English name without the suffix", () => {
  let count = 0;
  for (const skill of SKILLS) {
    const ids = new Set();
    for (const check of skill.checks ?? []) {
      assert.ok(check.id, `${skill.key}: ${check.name}`);
      assert.ok(!ids.has(check.id), `${skill.key}.${check.id} repeated`);
      ids.add(check.id);
      assert.equal(checkFocus(skill.key, check), check.name.replace(/ Check$/, ""));
      count += 1;
    }
  }
  assert.ok(count >= 100);
});

test("a translated display name changes neither the focus nor which check is Hide", () => {
  const hide = SKILLS.find(skill => skill.key === "sneak").checks.find(check => check.id === "hide");
  const shown = { ...hide, name: "Se cacher" };
  assert.equal(checkFocus("sneak", shown), "Hide");
  assert.equal(isHideCheck("sneak", shown), true);
  assert.equal(isHideCheck("sneak", hide), true);
  const only = SKILLS.flatMap(skill => (skill.checks ?? []).filter(check => isHideCheck(skill.key, check)));
  assert.deepEqual(
    only.map(check => check.id),
    ["hide"]
  );
  assert.equal(isHideCheck("acrobatics", { id: "hide", name: "Hide Check" }), false);
});

test("a check outside the tables falls back to its name", () => {
  assert.equal(checkFocus("science", { name: "Chemistry Check" }), "Chemistry");
  assert.equal(isHideCheck("sneak", { name: "Hide" }), true);
});
