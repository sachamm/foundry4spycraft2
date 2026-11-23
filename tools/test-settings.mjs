/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from "node:test";
import assert from "node:assert/strict";
import { readSetting } from "../module/settings.mjs";

test("readSetting returns the stored value, and the fallback only when the read fails", () => {
  const prior = globalThis.game;
  try {
    globalThis.game = undefined;
    assert.equal(readSetting("roundReminders", true), true);
    globalThis.game = {
      settings: {
        get: (scope, key) => {
          assert.equal(scope, "spycraft2");
          if (key === "missing") throw new Error("not registered");
          return key === "off" ? false : undefined;
        }
      }
    };
    assert.equal(readSetting("off", true), false);
    assert.equal(readSetting("unset", true), undefined);
    assert.equal(readSetting("missing", "fallback"), "fallback");
  } finally {
    globalThis.game = prior;
  }
});
