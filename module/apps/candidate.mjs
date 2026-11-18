import { ruleName } from "../rules/rule-name.mjs";
import { CANDIDATE_KEYS, CANDIDATE_CHOICES, reviewedCandidateBasis } from "../rules/candidate.mjs";
import { loc } from "../i18n.mjs";
/** An explicit correction of missing/imported acquisition history, never a later free re-choice. */
export async function reviewCandidate(item, options = {}) {
  if (
    !game.user?.isGM ||
    !item.isOwner ||
    item.type !== "feat" ||
    ruleName(item) !== "Candidate" ||
    item.parent?.type !== "agent"
  )
    throw new Error(loc`Only an owning GC can correct Candidate attribute history.`);
  if ((item.system.acquiredAtLevel || 1) !== 1)
    throw new Error(loc`Candidate must have been acquired at the first career level.`);
  const before = JSON.stringify([
      item.name,
      item.system.choice,
      item.system.candidateBasis,
      item.system.acquiredAtLevel
    ]),
    esc = foundry.utils.escapeHTML;
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review Candidate first-level attributes` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Use the original first-level scores before Candidate. This corrects acquisition history; later increases, temporary bonuses and damage do not allow a new choice.`}</p>${CANDIDATE_KEYS.map(key => `<label>${key.toUpperCase()} <input name="${key}" type="number" step="1" required value="${Number.isSafeInteger(item.system.candidateBasis?.scores?.[key]) ? item.system.candidateBasis.scores[key] : ""}" /></label>`).join("")}<label>${loc`Original selected pair`} <select name="choice">${Object.entries(
        CANDIDATE_CHOICES
      )
        .map(
          ([key, label]) => `<option value="${key}"${key === item.system.choice ? " selected" : ""}>${label}</option>`
        )
        .join(
          ""
        )}</select></label><label>${loc`Original source / reason for correction`} <input name="reason" maxlength="1000" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`These are the original scores and selection; I confirm this history correction`}</label></div>`
    });
    if (!input) return null;
  }
  if (
    !game.user?.isGM ||
    !item.isOwner ||
    JSON.stringify([item.name, item.system.choice, item.system.candidateBasis, item.system.acquiredAtLevel]) !== before
  )
    throw new Error(loc`Candidate history or ownership changed during review.`);
  const scores = Object.fromEntries(
      CANDIDATE_KEYS.map(key => [
        key,
        typeof input[key] === "number"
          ? input[key]
          : typeof input[key] === "string" && input[key].trim()
            ? Number(input[key])
            : NaN
      ])
    ),
    basis = reviewedCandidateBasis(scores, input.choice, input);
  return item.update({
    "system.choice": input.choice,
    "system.candidateBasis": { ...basis, reviewedBy: game.user.id, reviewedAt: game.time?.worldTime ?? 0 }
  });
}
