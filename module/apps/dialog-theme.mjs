/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Keep Foundry's dialog behavior and callbacks; opt system-owned dialogs into the skin. */
function themedOptions(options = {}) {
  return { ...options, classes: [...new Set([...(options.classes ?? []), "spycraft2", "sc2-dialog"])] };
}

export const systemDialog = {
  input: options => foundry.applications.api.DialogV2.input(themedOptions(options)),
  confirm: options => foundry.applications.api.DialogV2.confirm(themedOptions(options)),
  prompt: options => foundry.applications.api.DialogV2.prompt(themedOptions(options)),
  wait: options => foundry.applications.api.DialogV2.wait(themedOptions(options))
};

/** Existing roll-option dialogs identify themselves through their system-owned content. */
export function themeSystemDialog(dialog) {
  const element = dialog.element;
  if (!element || (!element.classList.contains("sc2-dialog") && !element.querySelector(".spycraft2-roll-options")))
    return;
  element.classList.add("spycraft2", "sc2-dialog");
}

export function installDialogThemeHooks() {
  Hooks.on("renderDialogV2", themeSystemDialog);
}
