/**
 * Sheet buttons, dialogs and chat-card buttons run async handlers whose refusals ("roll the save first", "the
 * ledger changed") are thrown as errors. Foundry does not catch a rejected action handler, so without this the
 * message only reaches the browser console and the button seems to do nothing. Show this system's own refusals
 * on screen instead.
 */
const SYSTEM_PATH = "/systems/spycraft2/";

/**
 * Show a refusal and return false. `return ui.notifications.warn(…)` returns the notification, which is truthy, so
 * callers counting results or relaying them read a refused step as done. false is never a cancelled dialog (null).
 * @param {string} message
 * @returns {false}
 */
export function refuse(message) {
  globalThis.ui?.notifications?.warn(message);
  return false;
}

/** The message to show for a rejection, or null when it did not come from this system's code. */
export function systemErrorNotice(reason) {
  if (!(reason instanceof Error) || !reason.message) return null;
  if (!String(reason.stack ?? "").includes(SYSTEM_PATH)) return null;
  return reason.message;
}

/**
 * Whether a rejection is a rule refusal rather than a fault. The system throws a plain Error to refuse a step ("roll
 * the save first"); a TypeError, RangeError and the like mean the code itself went wrong.
 */
export const isRefusal = reason => reason instanceof Error && Object.getPrototypeOf(reason) === Error.prototype;

export function registerErrorNotices(target = globalThis.window) {
  target?.addEventListener?.("unhandledrejection", event => {
    const message = systemErrorNotice(event.reason);
    if (!message || !globalThis.ui?.notifications) return;
    event.preventDefault();
    // A refusal is a warning on screen, not an error with a stack trace in the console.
    if (isRefusal(event.reason)) {
      ui.notifications.warn(message);
      console.debug(event.reason);
      return;
    }
    ui.notifications.error(message);
    console.error(event.reason);
  });
}
