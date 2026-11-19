/**
 * Buttons under a posted check: the core outcome workflow (boost, confirm, critical, reroll, resolve) and the two
 * follow-ups a resolved check can still need. Rules that add their own button register it from their own module.
 *
 * `renderCheckControls` is the one chat hook: it asks the pipeline for the buttons and lays them out.
 * A button is translated through lang/*.json under SPYCRAFT.RollControl.<contributor id>; a contributor whose
 * button text varies (the grapple escape steps) is shown as it supplies it.
 *   placement "card"    — one row under the whole card
 *   placement "content" — one row inside the message body
 *   placement "plain"   — a button of its own under the card (the default)
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { automaticSkillSuccessSources, cunningPlanCheck, manualAdjustmentSource } from "../rules/class-checks.mjs";
import { rerollEligibility } from "../rules/limited-uses.mjs";
import { checkCandidates, viewerFlavor } from "../rules/outcomes.mjs";
import { loc } from "../i18n.mjs";

/** The viewer rolled this check (or is the GC) and it carries a result. */
const ownsResult = ({ message, check, user }) => Number.isFinite(check.rawTotal) && (message.isAuthor || user.isGM);
const open = ctx => ownsResult(ctx) && !ctx.check.resolved;
const resolved = ctx => ownsResult(ctx) && !!ctx.check.resolved;
const card = (label, run) => [{ label, run, placement: "card" }];
const content = (label, run) => [{ label, run, placement: "content" }];
const manualAdjustment = ({ actor, check }) =>
  check.checkKind === "skill" && manualAdjustmentSource(actor.system)?.skills.includes(check.skillKey);

const core = (id, order, chatControls) => rollPipeline.register({ id, order, chatControls });

/* ---- A resolved check that still has something to complete ---- */

core("restraintEscapeControl", 9000, ctx => {
  const { message, check, actor, user } = ctx;
  if (!resolved(ctx) || !check.restraintEscape?.sourceSnapshot) return null;
  const receipt = actor.flags?.spycraft2?.restraintReleases?.[message.id];
  const review = actor.system.restraintReleaseReview;
  if (review?.needsReview && review.id === message.id) {
    return user.isGM ? content(loc`GC review grapple release`, () => actor.reviewRestraintRelease()) : null;
  }
  if (receipt?.movement?.state === "required") {
    return content(loc`Confirm actual escape movement`, () => actor.confirmRestraintEscapeMove(message));
  }
  if (!receipt && check.successConfirmed === true && !check.superseded && !check.criticalFailure) {
    return content(loc`Apply grapple escape benefit`, () => actor.applyRestraintEscape(message));
  }
  return null;
});

core("gearAcquisitionControl", 9010, ctx => {
  const { message, check, actor } = ctx;
  if (!resolved(ctx) || check.restraintEscape?.sourceSnapshot) return null;
  const receipt = check.gearAttempt?.settlement;
  const attempt = actor.system.missionReserves?.attempts?.[check.gearAttempt?.id];
  if (!receipt || check.superseded || attempt?.settlementId === receipt.id) return null;
  return content("Complete acquisition record", () => actor.finishCheck(message));
});

/* ---- A check whose outcome is still open: one row, in this order ---- */

core("cunningPlanControl", 9100, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx)) return null;
  try {
    cunningPlanCheck(actor.system, check);
  } catch {
    return null;
  }
  if (!actor.limitedUseStatus.some(s => s.id === "cunningPlan" && s.remaining > 0)) return null;
  return card("Cunning Plan", () => actor.useCunningPlan(message));
});

core("manualAdjustmentControl", 9110, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || !manualAdjustment(ctx)) return null;
  if (check.successConfirmed !== false || check.criticalFailure || check.manualAdjustment) return null;
  return card("Manual Adjustment", () => actor.useManualAdjustment(message));
});

core("requiredBonusControl", 9120, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || !check.requiredBonusPoolId || check.requiredBonusSpent || check.criticalFailure) return null;
  return card(loc`Spend required class bonus die`, () =>
    actor.boostCheck(message, { bonusPoolId: check.requiredBonusPoolId, count: 1, askOptions: true })
  );
});

core("criticalControl", 9130, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || !(check.threatConfirmed || check.errorConfirmed)) return null;
  if (check.criticalSuccess || check.criticalFailure) return null;
  return card("Activate critical", () => actor.activateCritical(message));
});

core("boostControl", 9140, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || check.actionDiceAllowed === false) return null;
  return card("Boost before outcome", () => actor.boostCheck(message));
});

core("generousControl", 9150, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || check.actionDiceAllowed === false || check.generousBoost) return null;
  return card("Generous teammate die", () => actor.boostWithGenerous(message));
});

core("rerollControl", 9160, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || check.checkMethod !== "roll") return null;
  const outcome = { failed: true, criticalFailure: !!check.criticalFailure };
  if (!actor.limitedUseStatus?.some(spec => spec.remaining && rerollEligibility(spec, check, outcome))) return null;
  return card("Reroll with ability", () => actor.rerollCheck(message));
});

core("confirmControl", 9170, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx)) return null;
  const candidates = checkCandidates(check);
  const needed =
    candidates.error ||
    candidates.threat ||
    candidates.triumph ||
    automaticSkillSuccessSources(actor.system, check).length > 0 ||
    manualAdjustment(ctx);
  return needed ? card("Confirm result", () => actor.confirmCheckOutcome(message)) : null;
});

core("finishControl", 9180, ctx =>
  open(ctx) ? card("Outcome resolved", () => ctx.actor.finishCheck(ctx.message)) : null
);

/* ---- The chat hook ---- */

/** A button's text: the translation keyed by its contributor id, or the contributor's own English label. */
export function localizedLabel(control, i18n = globalThis.game?.i18n) {
  const key = `SPYCRAFT.RollControl.${control.id}`;
  return i18n?.has?.(key) ? i18n.localize(key) : control.label;
}

function button(control) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = localizedLabel(control);
  element.setAttribute("aria-label", element.textContent);
  element.dataset.rollControl = control.id;
  element.addEventListener("click", async () => {
    element.disabled = true;
    try {
      await control.run();
    } finally {
      element.disabled = false;
    }
  });
  return element;
}

function row(controls) {
  const element = document.createElement("div");
  element.className = "spycraft2 roll-controls";
  element.append(...controls.map(button));
  return element;
}

/** Add this system's buttons to a rendered chat message (the `renderChatMessageHTML` hook). */
export function renderCheckControls(message, html) {
  const check = message.flags?.spycraft2;
  if (!check?.actorUuid || (message.blind && !game.user.isGM)) return;
  // Posted in another language: show this viewer the record's notes in their own.
  const translated = viewerFlavor(check, game.i18n?.lang);
  const flavor = translated ? html.querySelector(".flavor-text") : null;
  if (flavor) flavor.innerHTML = translated;
  const actor = fromUuidSync(check.actorUuid);
  if (!actor?.isOwner) return;
  const controls = rollPipeline.chatControls({ message, check, actor, user: game.user, checkKind: check.checkKind });
  const inContent = controls.filter(c => c.placement === "content");
  const onCard = controls.filter(c => c.placement === "card");
  if (inContent.length) html.querySelector(".message-content")?.append(row(inContent));
  if (onCard.length) html.append(row(onCard));
  for (const control of controls.filter(c => c.placement === "plain")) html.append(button(control));
}
