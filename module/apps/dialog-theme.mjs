/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readSetting } from "../settings.mjs";
import { loc, locKey } from "../i18n.mjs";

/** Keep Foundry's dialog behavior and callbacks; opt system-owned dialogs into the skin. */
function themedOptions(options = {}) {
  return { ...options, classes: [...new Set([...(options.classes ?? []), "spycraft2", "sc2-dialog"])] };
}

/**
 * An option dialog that answers null when closed also gets a Cancel button, which answers the same way, so no dialog
 * has only its main button and the corner cross to leave by. A dialog that names its own buttons is left as written.
 */
export function withCancel(options = {}) {
  if (options.rejectClose !== false || (options.buttons ?? []).length) return options;
  return { ...options, buttons: [{ action: "cancel", label: loc`Cancel` }] };
}
async function inputWithCancel(options) {
  const result = await foundry.applications.api.DialogV2.input(themedOptions(withCancel(options)));
  return result === "cancel" ? null : result;
}

export const systemDialog = {
  input: options => inputWithCancel(options),
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
  nameMainButton(element);
  // Cancel always closes: it skips the browser's field checks, which would otherwise hold the dialog open.
  for (const button of element.querySelectorAll?.('button[data-action="cancel"]') ?? []) button.formNoValidate = true;
  if (tableTrusted()) trustConfirmations(element);
  // The GC is the one these boxes ask: they open ticked for the GC, who unticks any that do not hold.
  else if (globalThis.game?.user?.isGM) trustConfirmations(element, { asGC: true });
}

/**
 * A main button still carrying Foundry's stock "Confirm" takes the dialog's own title, so it says what it will do
 * (style guide, Dialogs). A long title or a question is left alone. Returns the label set, or "".
 */
export function nameMainButton(element) {
  const button = element.querySelector?.('.form-footer button[data-action="ok"]'),
    title = element.querySelector?.(".window-title")?.textContent?.trim() ?? "";
  if (!button || !title || title.length > 36 || /[?:…]$/.test(title)) return "";
  const stock = globalThis.game?.i18n?.localize?.("Confirm") ?? "Confirm",
    text = button.querySelector("span") ?? button;
  if (text.textContent.trim() !== stock) return "";
  text.textContent = title;
  return title;
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

/** The control that had the keyboard before a dialog took it, so closing the dialog can hand it back. */
let lastOutsideFocus = null;
const inDialog = element => !!element?.closest?.("dialog, .application.dialog, .sc2-dialog");

/** Remember which control opened a system dialog (the `renderDialogV2` hook, after theming). */
export function rememberOpener(dialog) {
  if (!dialog?.element?.classList?.contains("sc2-dialog") || dialog._sc2Opener !== undefined) return;
  dialog._sc2Opener = lastOutsideFocus;
}

/**
 * When a system dialog closes, the keyboard goes back to the control that opened it if that control is still on the
 * page, and any hover help left up by the press is taken down (the `closeDialogV2` hook).
 */
export function returnFocusToOpener(dialog) {
  if (!dialog?.element?.classList?.contains("sc2-dialog")) return false;
  globalThis.game?.tooltip?.deactivate?.();
  const opener = dialog._sc2Opener;
  if (!opener?.isConnected || opener.disabled) return false;
  // After the close has finished moving focus, so the hand-back is the last word.
  (globalThis.requestAnimationFrame ?? (run => run()))(() => {
    if (opener.isConnected && !inDialog(globalThis.document?.activeElement)) opener.focus?.({ preventScroll: true });
  });
  return true;
}

export function installDialogThemeHooks() {
  Hooks.on("renderDialogV2", themeSystemDialog);
  Hooks.on("renderDialogV2", rememberOpener);
  Hooks.on("closeDialogV2", returnFocusToOpener);
  globalThis.document?.addEventListener?.(
    "focusin",
    event => {
      if (!inDialog(event.target)) lastOutsideFocus = event.target;
    },
    { capture: true, passive: true }
  );
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
