import {
  crossroadsMissionKey,
  crossroadsMissionXPPolicy,
  crossroadsMissionXPReviewPlan,
  crossroadsTitleChoices
} from "../rules/crossroads-xp.mjs";
import { queueResources } from "../services/transactions.mjs";
import { withUndo } from "./undo.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { sameValues } from "../rules/equal.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";
export const crossroadsXPContext = actor => ({
  ...actor.system,
  worldTime: globalThis.game?.time?.worldTime ?? actor.system.worldTime,
  actorUuid: actor.uuid,
  usagePeriods: actor.usagePeriods ?? actor.system.usagePeriods,
  crossroadsMissionReviews:
    actor.flags?.spycraft2?.crossroadsMissionReviews ?? actor.system.crossroadsMissionReviews ?? {}
});

export async function reviewCrossroadsMissionXP(actor, options = {}) {
  if (actor?.type !== "agent" || !actor.isOwner || !game.user?.isGM)
    throw Error(loc`The owning GC reviews Crossroads XP eligibility.`);
  const context = crossroadsXPContext(actor),
    mission = String(context.usagePeriods?.mission ?? "initial"),
    key = crossroadsMissionKey(mission),
    availableTitles = crossroadsTitleChoices(context);
  let policy;
  try {
    policy = crossroadsMissionXPPolicy(context);
  } catch {
    policy = { eligibleTitle: null };
  }
  const fingerprint = () => {
    const current = crossroadsXPContext(actor);
    return structuredClone({
      mission: current.usagePeriods?.mission ?? "initial",
      owned: current.crossroadsTitle,
      level: current.level,
      snapshot: current.usagePeriods?.missionCareerLevels,
      review: current.crossroadsMissionReviews?.[key] ?? null
    });
  };
  const before = fingerprint();
  let input = options;
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Review mission Crossroads XP eligibility` },
      position: { width: 620 },
      rejectClose: false,
      ok: { label: loc`Record eligibility` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Record the title whose XP benefit was already eligible when this mission began. A title earned during this mission starts its XP benefit next mission. This records eligibility only; it does not change the held title, award XP or replay an earlier settlement.`}</p><label>${loc`Title eligible for this mission`} <select name="eligibleTitle" required><option value="choose">${loc`Choose the actual mission-start eligibility`}</option><option value="none"${policy.eligibleTitle === "" ? " selected" : ""}>${loc`No Crossroads XP benefit yet`}</option>${availableTitles
        .map(
          row =>
            `<option value="${row.value}"${policy.eligibleTitle === row.value ? " selected" : ""}>${esc(row.label)} — ${row.percent}%</option>`
        )
        .join(
          ""
        )}</select></label><label>${loc`GC review note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`I checked when the title was earned and which title benefit this mission may use`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner || !game.user?.isGM || !sameValues(before, fingerprint()))
      throw Error(loc`The mission, held title or eligibility history changed during review.`);
    const id = foundry.utils.randomID(),
      record = crossroadsMissionXPReviewPlan(crossroadsXPContext(actor), {
        ...input,
        eligibleTitle: input.eligibleTitle === "none" ? "" : input.eligibleTitle,
        id,
        mission,
        actorUuid: actor.uuid,
        reviewerId: game.user.id
      });
    const path = `flags.spycraft2.crossroadsMissionReviews.${key}`,
      history = { before: before.review, record };
    const patch = {
      ...recordReplacementPatch(path, record, before.review),
      [`flags.spycraft2.crossroadsMissionReviewHistory.${id}`]: history
    };
    await withUndo([actor], loc`${actor.name}: review Crossroads XP eligibility for this mission`, async () => {
      try {
        await actor.update(patch);
      } catch (error) {
        if (
          !sameValues(actor.flags?.spycraft2?.crossroadsMissionReviews?.[key], record) ||
          !sameValues(actor.flags?.spycraft2?.crossroadsMissionReviewHistory?.[id], history)
        )
          throw error;
      }
    });
    return record;
  });
}
