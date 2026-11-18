/**
 * The "knowledge" roll dialog as ordered parts. Each part is one piece of the form; a rule adds its own piece by
 * registering a `dialog` contributor for "knowledge" with an `at` between the parts it belongs with.
 * KNOWLEDGE_DIALOG.anchors gives the position just inside the end of each named section.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";

/** [position, render(context)] — context holds the acting character and the values the roll has worked out so far. */
const parts = [
  [
    10,
    () => `<div class="spycraft2-roll-options">
        <label>Question or task <input name="topic" /></label><label><input name="underwater" type="checkbox" /> I am underwater (standard skill-check penalty)</label>
        <label>GC-selected relevant skill <select name="skill">`
  ],
  [
    20,
    ({ esc }) =>
      Object.entries(CONFIG.SPYCRAFT.skills)
        .map(([key, skill]) => `<option value="${key}">${esc(skill.name)}</option>`)
        .join("")
  ],
  [
    30,
    () => `</select></label>
        `
  ],
  [
    40,
    ({ actor }) =>
      actor.system.activeFeatNames?.includes("Card Shark")
        ? '<label>Card Shark gambling Knowledge <select name="gamblingKnowledge"><option value="">Ordinary Knowledge scope</option><option value="rules">Gambling rules</option><option value="people">Major gamblers, their winnings and debts</option><option value="locations">Casinos and other gaming locations</option></select></label><p>A question in a selected Card Shark category is active. Taking 10/20 still requires Photographic Memory.</p>'
        : ""
  ],
  [
    50,
    () => `
        <label>Relevant focus <input name="focus" /></label>
        <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
        <label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10 — 1 round (Photographic Memory)</option><option value="take20">Take 20 — 1 minute (Photographic Memory)</option></select></label>
        <label><input type="checkbox" name="active" /> Active check (Photographic Memory)</label>
        <label><input type="checkbox" name="safeToTake" /> Neither distracted nor endangered</label>
        <label><input type="checkbox" name="breakthrough" /> Breakthrough: Virtuoso 10, substitute the key skill’s total bonus (once/scene)</label><label>Key skill attribute <select name="breakthroughAbility"><option value="">Key skill default</option>`
  ],
  [
    60,
    () =>
      ["str", "dex", "con", "int", "wis", "cha"].map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join("")
  ],
  [
    70,
    () => `</select></label>
            <label>Bright Idea source <select name="brightIdeaSource"><option value="">Automatic available source</option>`
  ],
  [
    80,
    ({ actor, esc }) =>
      actor.limitedUseStatus
        .filter(s => s.workflow === "brightIdea")
        .map(s => `<option value="${esc(s.id)}">${esc(s.name)}: ${s.remaining} remaining</option>`)
        .join("")
  ],
  [
    90,
    () => `</select></label>
        <label><input type="checkbox" name="brightIdea" /> Bright Idea: roll twice and choose (uses the same source pool as Skills)</label>
        <label><input type="checkbox" name="tenSecondSolution" /> 10-Second Solution: Scientist 14, natural 20 (same session use as Skills; minimum 1 full action)</label>
        <label><input type="checkbox" name="standaloneCheckConfirmed" /> This check is outside any Complex Task or Dramatic Conflict</label>
        <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce the error range (shared scene uses)</label><p>The GC resolves class abilities on passive Knowledge checks. Named-skill abilities do not apply merely because that skill supplies Knowledge synergy.</p></div>`
  ]
];

export const KNOWLEDGE_DIALOG = Object.freeze({ id: "knowledge", anchors: Object.freeze({}) });

rollPipeline.register({
  id: "knowledgeDialog",
  dialogs: ["knowledge"],
  dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
});
