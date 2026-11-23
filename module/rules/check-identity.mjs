/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { SKILLS } from "./tables.mjs";

const focusOf = name => String(name ?? "").replace(/ Check$/, "");

/**
 * The English focus name of every named check, read from the tables when this module loads. Display names in the
 * tables are replaced with translations once a language is ready, and stored focuses are English, so the rules must
 * not work a focus out of the name a check shows.
 */
const FOCUS = new Map(
  SKILLS.flatMap(skill => (skill.checks ?? []).map(check => [`${skill.key}.${check.id}`, focusOf(check.name)]))
);

/** The focus a named check falls under, as stored on characters. A check the tables do not list uses its name. */
export function checkFocus(skillKey, check) {
  return FOCUS.get(`${skillKey}.${check?.id}`) ?? focusOf(check?.name);
}

/** Whether this is the Sneak skill's Hide check, the one a character's Size modifies. */
export function isHideCheck(skillKey, check) {
  return (
    skillKey === "sneak" &&
    (check?.id === "hide" || (check?.id === undefined && /^Hide(?: Check)?$/.test(check?.name ?? "")))
  );
}
