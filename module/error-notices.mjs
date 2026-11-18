/**
 * Sheet buttons, dialogs and chat-card buttons run async handlers whose refusals ("roll the save first", "the
 * ledger changed") are thrown as errors. Foundry does not catch a rejected action handler, so without this the
 * message only reaches the browser console and the button seems to do nothing. Show this system's own refusals
 * on screen instead.
 */
const SYSTEM_PATH = "/systems/spycraft2/";

/** The message to show for a rejection, or null when it did not come from this system's code. */
export function systemErrorNotice(reason) {
  if (!(reason instanceof Error) || !reason.message) return null;
  if (!String(reason.stack ?? "").includes(SYSTEM_PATH)) return null;
  return reason.message;
}

export function registerErrorNotices(target = globalThis.window) {
  target?.addEventListener?.("unhandledrejection", event => {
    const message = systemErrorNotice(event.reason);
    if (!message || !globalThis.ui?.notifications) return;
    ui.notifications.error(message);
    event.preventDefault();
    console.error(event.reason);
  });
}
