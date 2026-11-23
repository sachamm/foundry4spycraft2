/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/**
 * The stylesheets a world loads, in the manifest's order, as one string. A layout test that loads a hand-picked
 * subset measures a cascade nobody sees, because later files override earlier ones.
 */
export function systemCss() {
  return JSON.parse(read("system.json"))
    .styles.map(path => read(path).replace(/@import[^;]+;/g, ""))
    .join("\n");
}
