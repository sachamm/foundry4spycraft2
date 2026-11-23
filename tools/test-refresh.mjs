/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from "node:test";
import assert from "node:assert/strict";
import { renderOpenSheet } from "../module/services/refresh.mjs";
import { registerGCSettings } from "../module/apps/gc/state.mjs";

test("an open sheet is redrawn; a closed one is left alone and no sheet is built to find out", () => {
  let renders = 0;
  const sheet = rendered => ({ rendered, render: () => (renders += 1) });
  assert.equal(renderOpenSheet({ _sheet: sheet(true) }), true);
  assert.equal(renderOpenSheet({ _sheet: sheet(false) }), false);
  assert.equal(renders, 1);
  let built = 0;
  const lazy = {
    _sheet: null,
    get sheet() {
      built += 1;
      return sheet(false);
    }
  };
  assert.equal(renderOpenSheet(lazy), false);
  assert.equal(built, 0);
  // A document that keeps no `_sheet` (a test stub, or a different core) falls back to its sheet.
  assert.equal(renderOpenSheet({ sheet: sheet(true) }), true);
  assert.equal(renderOpenSheet({ sheet: { render: () => (renders += 1) } }), true);
  assert.equal(renders, 3);
  assert.equal(renderOpenSheet(null), false);
});

test("mission and campaign changes reset every actor; scene state and conflicts redraw only the console", () => {
  const prior = { game: globalThis.game, canvas: globalThis.canvas };
  const registered = {};
  const log = [];
  const actor = (name, rendered) => ({
    reset: () => log.push(`reset ${name}`),
    _sheet: { rendered, render: () => log.push(`render ${name}`) }
  });
  try {
    globalThis.canvas = undefined;
    globalThis.game = {
      settings: { register: (scope, key, config) => (registered[key] = config) },
      actors: [actor("open", true), actor("closed", false)],
      spycraft2: { gc: { console: { render: () => log.push("console") } } }
    };
    registerGCSettings();
    for (const key of ["mission", "campaign"]) {
      log.length = 0;
      registered[key].onChange();
      assert.deepEqual(log, ["reset open", "render open", "reset closed", "console"], key);
    }
    for (const key of ["sceneState", "conflicts"]) {
      log.length = 0;
      registered[key].onChange();
      assert.deepEqual(log, ["console"], key);
    }
  } finally {
    globalThis.game = prior.game;
    globalThis.canvas = prior.canvas;
  }
});
