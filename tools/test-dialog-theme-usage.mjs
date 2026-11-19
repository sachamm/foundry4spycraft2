/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// System dialogs get the dossier skin either through systemDialog or because their
// content carries the .spycraft2-roll-options marker. A bare DialogV2 call in a file
// with neither opens in Foundry's own style beside themed ones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function moduleFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return moduleFiles(path);
    return path.endsWith(".mjs") ? [path] : [];
  });
}

test("every DialogV2 call site is themed", () => {
  const unthemed = moduleFiles("module").filter(path => {
    if (path.endsWith("dialog-theme.mjs")) return false;
    const source = readFileSync(path, "utf8");
    if (!/DialogV2\.(input|confirm|prompt|wait)\(/.test(source)) return false;
    return !source.includes("spycraft2-roll-options");
  });
  assert.deepEqual(unthemed, [], "use systemDialog from module/apps/dialog-theme.mjs");
});
