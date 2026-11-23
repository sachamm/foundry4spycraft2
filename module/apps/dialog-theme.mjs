/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readSetting } from "../settings.mjs";
import { loc, locKey } from "../i18n.mjs";

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
  if (tableTrusted()) trustConfirmations(element);
  // The GC is the one these boxes ask: they open ticked for the GC, who unticks any that do not hold.
  else if (globalThis.game?.user?.isGM) trustConfirmations(element, { asGC: true });
}

/** The world setting that lets players' declarations stand without ticking each GC confirmation. */
export function tableTrusted() {
  return readSetting("trustTheTable", false) === true;
}

/**
 * Tick every unticked confirmation box ("…Confirmed") in a dialog and say so at the top, so the declarations still
 * show and any that do not hold can be unticked. Returns how many were ticked. `asGC` words the note for the GC,
 * whose own dialogs open ticked whatever the setting says.
 */
export function trustConfirmations(element, { asGC = false } = {}) {
  const boxes = [...(element.querySelectorAll?.('input[type="checkbox"][name$="Confirmed"]') ?? [])].filter(
    box => !box.checked && !box.disabled
  );
  for (const box of boxes) {
    box.checked = true;
    box.classList.add("sc2-trusted");
    box.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (boxes.length && globalThis.document) {
    const holder = element.querySelector(".spycraft2-roll-options") ?? element.querySelector("form") ?? element;
    const note = document.createElement("p");
    note.className = "hint sc2-trusted-note";
    note.textContent = asGC
      ? loc`You are the GC: ${boxes.length} confirmation(s) ticked for you. Untick any that do not hold.`
      : loc`Trusting the table: ${boxes.length} confirmation(s) ticked for you. Untick any that do not hold.`;
    holder.prepend?.(note);
  }
  return boxes.length;
}

export function installDialogThemeHooks() {
  Hooks.on("renderDialogV2", themeSystemDialog);
}

/** Register the table-trust setting. Call during `init`. */
export function registerTableTrustSetting() {
  game.settings.register("spycraft2", "trustTheTable", {
    name: locKey`Trust the table`,
    hint: locKey`Dialogs open with every "the GC confirms" box already ticked, so declarations stand unless someone unticks them. Leave off to confirm each one.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
}
