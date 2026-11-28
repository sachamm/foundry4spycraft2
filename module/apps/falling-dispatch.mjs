import { loc } from "../i18n.mjs";
/** Share the landing entry point without importing the damage application back into its own callers. */
let handler = null;
export function registerFallingDamageHandler(fn) {
  handler = fn;
}
export function recordFallingLanding(actor, input) {
  if (!handler) throw Error(loc`Open the Falling tool after the system is ready.`);
  return handler(actor, input);
}
