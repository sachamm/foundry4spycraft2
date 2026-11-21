/**
 * The shared kit for dialogs and chat cards built in code: escaping, refusals and the lead-GC check. One import
 * instead of a local copy of each helper in every file.
 */
export { esc, markup, markupFragment, raw, RawHTML } from "../html.mjs";
export { refuse } from "../error-notices.mjs";
export { isLeadGM, primaryWriterFor } from "../writers.mjs";
