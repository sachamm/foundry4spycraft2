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
  refusals++;
  lastRefusal = message;
  globalThis.ui?.notifications?.warn(message);
  return false;
}

/**
 * Show a refusal and return null, for a step whose result can travel back through a limited-use callback: there
 * null (like a throw) hands the use and its dice back, while false would keep them spent. Callers that need to know
 * a refusal happened compare refusalCount() before and after.
 * @param {string} message
 * @returns {null}
 */
export function refuseStep(message) {
  refuse(message);
  return null;
}

/** As refuseStep(), for "there is nothing to do here": an information notice rather than a warning. */
export function decline(message) {
  refusals++;
  lastRefusal = message;
  globalThis.ui?.notifications?.info(message);
  return null;
}

let refusals = 0;
let lastRefusal = "";

/**
 * How many steps this client has refused so far. A caller that cannot see a nested step's return value (a chat-card
 * button whose handler swallows it, or a busy character reported as null) compares the count before and after.
 */
export const refusalCount = () => refusals;

/** The text of the most recent refusal, for showing beside the control that was pressed. */
export const lastRefusalMessage = () => lastRefusal;

/**
 * A rule said no: "roll the save first", "the character is busy". Throw this rather than a plain Error for a
 * refusal, so that a fault in the code can be told apart from it.
 */
export class Refusal extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "Refusal";
  }
}

/** The message to show for a rejection, or null when it did not come from this system's code. */
export function systemErrorNotice(reason) {
  if (!(reason instanceof Error) || !reason.message) return null;
  if (!String(reason.stack ?? "").includes(SYSTEM_PATH)) return null;
  return reason.message;
}

/**
 * Whether a rejection is a rule refusal rather than a fault. The system throws a plain Error to refuse a step ("roll
 * the save first"), and newer code throws Refusal; a TypeError, RangeError and the like mean the code itself went
 * wrong. Plain errors stay refusals until every refusing throw has moved to Refusal.
 */
export const isRefusal = reason =>
  reason instanceof Refusal || (reason instanceof Error && Object.getPrototypeOf(reason) === Error.prototype);

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
