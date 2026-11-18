/**
 * All or Nothing, p.189: once per session, before a roll, the character widens its error and threat ranges by 5.
 * If an error comes up, an opponent may activate it as a critical failure or miss even when the result would
 * otherwise succeed.
 *
 * It applies to rolled skill checks, Knowledge checks and attacks: rolls with both ranges. Saves have neither
 * range here, and a take-10/take-20 has no roll. The declaration is recorded on the check as `allOrNothing`, which
 * the outcome rules (module/rules/outcomes.mjs) read to keep the error open on a success.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const ALL_OR_NOTHING = "All or Nothing";
const KINDS = ["skill", "knowledge", "attack"];

export function allOrNothingSpec(system) {
  return system.activeFeatNames?.includes(ALL_OR_NOTHING)
    ? { id: "allOrNothing", name: loc`All or Nothing`, period: "session", limit: 1, workflow: "allOrNothing" }
    : null;
}

export function allOrNothingEligible(system, { checkKind, checkMethod = "roll", formula = "" } = {}) {
  return (
    system.activeFeatNames?.includes(ALL_OR_NOTHING) === true &&
    KINDS.includes(checkKind) &&
    checkMethod === "roll" &&
    /^1d20\b/.test(formula)
  );
}

/** Threat range 20 becomes 15–20 and error range 1 becomes 1–6. A roll with no range of a kind keeps none. */
export function allOrNothingRanges({ threat = 20, error = 1 } = {}) {
  return {
    threat: threat > 0 ? Math.max(2, threat - 5) : threat,
    error: error > 0 ? Math.min(19, error + 5) : error
  };
}

export const allOrNothingNote = check =>
  check?.allOrNothing
    ? loc`All or Nothing: error and threat ranges widened by 5; an error may be activated as a critical failure or miss even on a success (p.189).`
    : "";

// The declaration on the skill, Knowledge and attack dialogs.
const content = ({ actor }) => [
  {
    at: 58,
    html: actor?.system?.activeFeatNames?.includes(ALL_OR_NOTHING)
      ? `<label><input type="checkbox" name="allOrNothing" /> ${loc`All or Nothing: widen this roll’s error and threat ranges by 5 (once per session)`}</label>`
      : ""
  }
];
const read = ({ entered }, input) => ((entered ?? input)?.allOrNothing === true ? { allOrNothing: true } : null);
rollPipeline.register({ id: "allOrNothingContent:attack", dialogs: ["attack"], order: 68, dialog: content, read });
rollPipeline.register({
  id: "allOrNothingContent:rangedAttack",
  dialogs: ["rangedAttack"],
  order: 9742,
  dialog: ctx => content(ctx).map(p => ({ ...p, at: 177 })),
  read
});
rollPipeline.register({
  id: "allOrNothingContent:skill",
  dialogs: ["skill"],
  order: 9743,
  dialog: ctx => content(ctx).map(p => ({ ...p, at: 765 })),
  read
});
rollPipeline.register({
  id: "allOrNothingContent:knowledge",
  dialogs: ["knowledge"],
  order: 9744,
  dialog: ctx => content(ctx).map(p => ({ ...p, at: 95 })),
  read
});
