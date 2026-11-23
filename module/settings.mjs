/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export const SYSTEM_ID = "spycraft2";

/**
 * Read one of this system's settings where the read may come before the setting is registered (early hooks, tests).
 * `fallback` is returned when the read fails; pass the setting's registered default, so a table rule that is on by
 * default is never switched off by a failed read.
 */
export function readSetting(key, fallback) {
  try {
    return globalThis.game.settings.get(SYSTEM_ID, key);
  } catch {
    return fallback;
  }
}
