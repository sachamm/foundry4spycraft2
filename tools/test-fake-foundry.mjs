/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from "node:test";
import assert from "node:assert/strict";
import { escapeHTML, installFoundry, randomID } from "./lib/fake-foundry.mjs";
import { readSetting } from "../module/settings.mjs";
import { refuseStep, decline } from "../module/error-notices.mjs";

test("the stand-in escapes markup, so a test can see a missing escape", () => {
  assert.equal(
    escapeHTML(`<b title="x">Tom & 'Jo'</b>`),
    "&lt;b title=&quot;x&quot;&gt;Tom &amp; &#x27;Jo&#x27;&lt;/b&gt;"
  );
  assert.notEqual(randomID(), randomID());
  assert.equal(randomID().length, 16);
});

test("settings: a stored value is read, an unregistered key throws, and a change calls onChange", async () => {
  const world = installFoundry({ settings: { roundReminders: false } });
  try {
    assert.equal(readSetting("roundReminders", true), false);
    assert.equal(readSetting("neverRegistered", "fallback"), "fallback");
    let seen;
    game.settings.register("spycraft2", "turnNotice", { default: true, onChange: value => (seen = value) });
    assert.equal(readSetting("turnNotice", false), true);
    await game.settings.set("spycraft2", "turnNotice", false);
    assert.equal(seen, false);
  } finally {
    world.restore();
  }
});

test("notices, chat messages and dialogs are recorded, and restore puts the globals back", async () => {
  const before = globalThis.game;
  const world = installFoundry({ user: { isGM: true }, dialog: kind => (kind === "confirm" ? true : null) });
  assert.equal(refuseStep("Not enough action dice."), null);
  assert.equal(decline("Nothing to do."), null);
  assert.deepEqual(
    world.notices.map(entry => entry.level),
    ["warn", "info"]
  );
  await ChatMessage.create({ content: "<p>card</p>" });
  assert.equal(world.messages.length, 1);
  assert.equal(await foundry.applications.api.DialogV2.confirm({ window: { title: "Sure?" } }), true);
  assert.equal(await foundry.applications.api.DialogV2.input({ window: { title: "Options" } }), null);
  assert.deepEqual(
    world.dialogs.map(entry => entry.kind),
    ["confirm", "input"]
  );
  assert.equal(game.user.isGM, true);
  world.restore();
  assert.equal(globalThis.game, before);
});
