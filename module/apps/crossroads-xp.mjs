import {
  crossroadsMissionKey,
  crossroadsMissionXPPolicy,
  crossroadsMissionXPReviewPlan,
  crossroadsTitleChoices
} from "../rules/crossroads-xp.mjs";
import { crossroadsSessionPolicy, crossroadsSessionReviewPlan } from "../rules/crossroads-session.mjs";
import { crossroadsAwardChoices, crossroadsAwardPlan } from "../rules/crossroads-awards.mjs";
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
  sessionDiceReset: actor.flags?.spycraft2?.sessionDiceReset ?? actor.system.sessionDiceReset,
  crossroadsSessionReviews:
    actor.flags?.spycraft2?.crossroadsSessionReviews ?? actor.system.crossroadsSessionReviews ?? {},
  crossroadsMissionReviews:
    actor.flags?.spycraft2?.crossroadsMissionReviews ?? actor.system.crossroadsMissionReviews ?? {}
});

export const reviewCrossroadsMissionXP = (actor, options = {}) => reviewCrossroads(actor, options, false);
export const reviewCrossroadsSession = (actor, options = {}) => reviewCrossroads(actor, options, true);

async function reviewCrossroads(actor, options, sessionMode) {
  if (actor?.type !== "agent" || !actor.isOwner || !game.user?.isGM)
    throw Error(loc`The owning GC reviews Crossroads eligibility.`);
  const context = crossroadsXPContext(actor),
    period = sessionMode ? "session" : "mission",
    reviewsField = sessionMode ? "crossroadsSessionReviews" : "crossroadsMissionReviews",
    historyField = sessionMode ? "crossroadsSessionReviewHistory" : "crossroadsMissionReviewHistory",
    mission = String(context.usagePeriods?.[period] ?? "initial"),
    key = crossroadsMissionKey(mission),
    availableTitles = crossroadsTitleChoices(context);
  let policy;
  try {
    policy = sessionMode ? crossroadsSessionPolicy(context) : crossroadsMissionXPPolicy(context);
  } catch {
    policy = { eligibleTitle: null };
  }
  const fingerprint = () => {
    const current = crossroadsXPContext(actor);
    return structuredClone({
      mission: current.usagePeriods?.[period] ?? "initial",
      owned: current.crossroadsTitle,
      level: current.level,
      classLevels: current.classLevels,
      snapshot: sessionMode ? current.sessionDiceReset : current.usagePeriods?.missionCareerLevels,
      review: current[reviewsField]?.[key] ?? null
    });
  };
  const before = fingerprint();
  let input = options;
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: {
        title: sessionMode
          ? loc`Review session Crossroads dice eligibility`
          : loc`Review mission Crossroads XP eligibility`
      },
      position: { width: 620 },
      rejectClose: false,
      ok: { label: loc`Record eligibility` },
      content: `<div class="spycraft2-roll-options"><p>${
        sessionMode
          ? loc`Record the title benefit eligible when this session began. A title earned during this session changes starting dice next session. This review preserves the current dice balance and held title.`
          : loc`Record the title whose XP benefit was already eligible when this mission began. A title earned during this mission starts its XP benefit next mission. This records eligibility only; it does not change the held title, award XP or replay an earlier settlement.`
      }</p><label>${sessionMode ? loc`Title eligible for this session` : loc`Title eligible for this mission`} <select name="eligibleTitle" required><option value="choose">${loc`Choose the actual starting eligibility`}</option><option value="none"${policy.eligibleTitle === "" ? " selected" : ""}>${loc`No Crossroads benefit yet`}</option>${availableTitles
        .map(
          row =>
            `<option value="${row.value}"${policy.eligibleTitle === row.value ? " selected" : ""}>${esc(row.label)}${sessionMode ? "" : ` — ${row.percent}%`}</option>`
        )
        .join(
          ""
        )}</select></label><label>${loc`GC review note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${sessionMode ? loc`I checked which title benefit this session may use` : loc`I checked when the title was earned and which title benefit this mission may use`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner || !game.user?.isGM || !sameValues(before, fingerprint()))
      throw Error(loc`The mission, held title or eligibility history changed during review.`);
    const id = foundry.utils.randomID(),
      record = (sessionMode ? crossroadsSessionReviewPlan : crossroadsMissionXPReviewPlan)(crossroadsXPContext(actor), {
        ...input,
        eligibleTitle: input.eligibleTitle === "none" ? "" : input.eligibleTitle,
        id,
        mission,
        actorUuid: actor.uuid,
        reviewerId: game.user.id
      });
    const path = `flags.spycraft2.${reviewsField}.${key}`,
      history = { before: before.review, record };
    const patch = {
      ...recordReplacementPatch(path, record, before.review),
      [`flags.spycraft2.${historyField}.${id}`]: history
    };
    await withUndo(
      [actor],
      sessionMode
        ? loc`${actor.name}: review Crossroads dice eligibility for this session`
        : loc`${actor.name}: review Crossroads XP eligibility for this mission`,
      async () => {
        try {
          await actor.update(patch);
        } catch (error) {
          if (
            !sameValues(actor.flags?.spycraft2?.[reviewsField]?.[key], record) ||
            !sameValues(actor.flags?.spycraft2?.[historyField]?.[id], history)
          )
            throw error;
        }
      }
    );
    return record;
  });
}

export async function completeCrossroads(actor, options = {}) {
  if (actor?.type !== "agent" || !actor.isOwner || !game.user?.isGM)
    throw Error(loc`The owning GC completes a Crossroads and awards its title.`);
  if (
    crossroadsSessionPolicy(crossroadsXPContext(actor)).needsReview &&
    !(await reviewCrossroadsSession(actor, options.sessionReview ?? {}))
  )
    return null;
  if (
    crossroadsMissionXPPolicy(crossroadsXPContext(actor)).needsReview &&
    !(await reviewCrossroadsMissionXP(actor, options.missionReview ?? {}))
  )
    return null;
  const choices = crossroadsAwardChoices(actor.system);
  if (!choices.length) throw Error(loc`There is no unfinished typed Crossroads Subplot to complete.`);
  const fingerprint = () => {
    const s = crossroadsXPContext(actor);
    return structuredClone({
      owned: s.crossroadsTitle,
      level: s.level,
      classLevels: s.classLevels,
      subplots: s.subplots,
      picks: s.subplotPicks,
      effects: s.campaignEffects,
      periods: s.usagePeriods,
      reset: s.sessionDiceReset,
      sessions: s.crossroadsSessionReviews,
      missions: s.crossroadsMissionReviews
    });
  };
  const before = fingerprint();
  let input = options;
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Complete Crossroads and award title` },
      position: { width: 620 },
      rejectClose: false,
      ok: { label: loc`Complete and award title` },
      content: `<div class="spycraft2-roll-options"><p>${loc`The GC confirms the completed story and its entry requirements. This completes the chosen Subplot and records its title. Starting dice and mission XP keep their current eligibility until their next periods. Current dice and XP are preserved; include the standard Subplot XP through normal mission settlement once.`}</p><label>${loc`Crossroads Subplot`} <select name="index" required><option value="">${loc`Choose the completed Crossroads`}</option>${choices.map(row => `<option value="${row.index}"${row.error ? " disabled" : ""}>${esc(row.label)}${row.error ? ` — ${esc(row.error)}` : ""}</option>`).join("")}</select></label><label>${loc`GC completion note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`I confirmed completion and the requirements when this Crossroads began`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner || !game.user?.isGM || !sameValues(before, fingerprint()))
      throw Error(loc`The Crossroads, title, eligibility or campaign rules changed during completion.`);
    const id = foundry.utils.randomID(),
      s = crossroadsXPContext(actor),
      plan = crossroadsAwardPlan(s, { ...input, id, reviewerId: game.user.id }),
      sessionKey = crossroadsMissionKey(plan.sessionReview.session),
      missionKey = crossroadsMissionKey(plan.missionReview.mission),
      record = {
        ...plan.record,
        beforeEligibility: {
          session: s.crossroadsSessionReviews?.[sessionKey] ?? null,
          mission: s.crossroadsMissionReviews?.[missionKey] ?? null
        }
      },
      patch = {
        "system.crossroadsTitle": plan.title,
        "system.subplots": plan.subplots,
        ...recordReplacementPatch(
          `flags.spycraft2.crossroadsSessionReviews.${sessionKey}`,
          plan.sessionReview,
          record.beforeEligibility.session
        ),
        ...recordReplacementPatch(
          `flags.spycraft2.crossroadsMissionReviews.${missionKey}`,
          plan.missionReview,
          record.beforeEligibility.mission
        ),
        [`flags.spycraft2.crossroadsAwards.${id}`]: record
      };
    await withUndo([actor], loc`${actor.name}: complete Crossroads and award ${plan.title}`, async () => {
      try {
        await actor.update(patch);
      } catch (error) {
        if (
          actor.system.crossroadsTitle !== plan.title ||
          !sameValues(actor.system.subplots, plan.subplots) ||
          !sameValues(actor.flags?.spycraft2?.crossroadsAwards?.[id], record) ||
          !sameValues(actor.flags?.spycraft2?.crossroadsSessionReviews?.[sessionKey], plan.sessionReview) ||
          !sameValues(actor.flags?.spycraft2?.crossroadsMissionReviews?.[missionKey], plan.missionReview)
        )
          throw error;
      }
    });
    return record;
  });
}
