/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Single-colour glyphs for the verbs that repeat across the interface, from the Font Awesome set
// that ships with Foundry. Game-specific tools keep their label; their artwork is opt-in.
export const VERB_ICONS = {
  add: "fa-plus",
  addAntagonist: "fa-plus",
  addNpcToScene: "fa-user-plus",
  addBonus: "fa-plus",
  addComplication: "fa-plus",
  addLevel: "fa-plus",
  addObjective: "fa-plus",
  addRow: "fa-plus",
  createItem: "fa-plus",
  removeLevel: "fa-minus",
  removeRow: "fa-xmark",
  removeIdentity: "fa-trash",
  itemDelete: "fa-trash",
  deleteTimer: "fa-trash",
  "entry:remove": "fa-trash",
  itemEdit: "fa-pen",
  editIdentity: "fa-pen",
  editMission: "fa-pen",
  toggleEditMode: "fa-pen-to-square",
  itemChat: "fa-comment",
  toChat: "fa-comment",
  itemEquip: "fa-hand",
  browse: "fa-book-open",
  open: "fa-arrow-up-right-from-square",
  openSource: "fa-arrow-up-right-from-square",
  syncGrants: "fa-rotate",
  reloadWeapon: "fa-rotate",
  resupplyWeapon: "fa-box-open",
  spendActionDie: "fa-dice",
  healActionDice: "fa-heart-pulse",
  refreshAction: "fa-hourglass-half",
  boostDefense: "fa-shield",
  restAndRecover: "fa-bed",
  initializeStartingDice: "fa-play",
  startMission: "fa-play",
  beginSession: "fa-play",
  nextScene: "fa-forward-step",
  endMission: "fa-flag-checkered",
  clearMission: "fa-eraser",
  reviewLimitedUseCounter: "fa-clipboard-check",
  "entry:complete": "fa-check",
  "entry:critical": "fa-star",
  "entry:ignored": "fa-eye-slash",
  "entry:encountered": "fa-crosshairs",
  clockStep: "fa-forward",
  step: "fa-forward",
  clockAdvance: "fa-clock",
  advance: "fa-clock",
  clockDate: "fa-calendar-day",
  setDate: "fa-calendar-day",
  clockOpen: "fa-stopwatch",
  quickTimer: "fa-stopwatch",
  extendTimer: "fa-plus",
  enterIdentity: "fa-masks-theater",
  leaveIdentity: "fa-right-from-bracket",
  pinTool: "fa-thumbtack"
};

/** The glyph class for a control's verb, or null when the verb has none. */
export function verbIcon(action = "", data = {}) {
  const variant = action === "entry" ? data.change : undefined;
  return VERB_ICONS[variant !== undefined ? `${action}:${variant}` : action] ?? VERB_ICONS[action] ?? null;
}
