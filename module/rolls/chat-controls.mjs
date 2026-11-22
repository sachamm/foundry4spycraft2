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
 * Within a row, a control with emphasis "primary" (the card's next step) comes first and is styled as the main action;
 * "quiet" controls (closing the outcome) come last as small text buttons.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { automaticSkillSuccessSources, cunningPlanCheck, manualAdjustmentSource } from "../rules/class-checks.mjs";
import { rerollEligibility } from "../rules/limited-uses.mjs";
import { checkCandidates, errorDecisionPending, viewerFlavor } from "../rules/outcomes.mjs";
import { shakenRules } from "../rules/shaken.mjs";
import { actionDieBoostPlan } from "../rules/action-dice.mjs";
import { loc } from "../i18n.mjs";
import { renderCheckGuidance } from "./chat-guidance.mjs";
import { runChatAction } from "../apps/chat-action-feedback.mjs";
import { targetResponseControls } from "../apps/target-response.mjs";
import { appliedDamageEntries } from "../rules/damage-application.mjs";

/** The viewer rolled this check (or is the GC) and it carries a result. */
const ownsResult = ({ message, check, user }) => Number.isFinite(check.rawTotal) && (message.isAuthor || user.isGM);
/** Damage that has been applied is settled: boosting or confirming it any further would change nothing. */
const settledDamage = check => check.checkKind === "damage" && appliedDamageEntries(check).length > 0;
const open = ctx => ownsResult(ctx) && !ctx.check.resolved && !settledDamage(ctx.check);
const resolved = ctx => ownsResult(ctx) && !!ctx.check.resolved;
const card = (label, run, emphasis) => [{ label, run, placement: "card", ...(emphasis ? { emphasis } : {}) }];
const content = (label, run) => [{ label, run, placement: "content" }];
const manualAdjustment = ({ actor, check }) =>
  check.checkKind === "skill" && manualAdjustmentSource(actor.system)?.skills.includes(check.skillKey);

/** A teammate who could give a Generous die: another agent this user owns with the Pointman core class. */
export const generousDonorExists = actor =>
  [...(globalThis.game?.actors ?? [])].some(
    a => a.type === "agent" && a.uuid !== actor.uuid && a.isOwner && a.system?.coreClassIds?.includes("pointman")
  );

/** True during a surprise round or the first round of the active combat. */
export const openingRound = () => {
  const combat = globalThis.game?.combat;
  return !!combat?.started && Number(combat.round) <= 1;
};

/**
 * The one-click boost: one ordinary action die, when nothing needs choosing first (no Shaken surcharge to fund, no
 * error decision pending, at least one die left). Returns the boost's input, or null to leave it to the dialog.
 */
export function quickBoost(actor, check) {
  const system = actor.system ?? {};
  if ((system.actionDice?.value ?? 0) < 1 || errorDecisionPending(check)) return null;
  let shaken;
  try {
    shaken = shakenRules(actor.actionDiceFundingSystem ?? system);
  } catch {
    return null;
  }
  if (shaken.extraDice || shaken.needsReview || shaken.spendingForbidden) return null;
  const input = {
    count: 1,
    bonusPoolId: "",
    openingRound: openingRound(),
    calculating: (system.coreClassIds ?? []).includes("schemer")
  };
  // Some abilities roll two dice for one spent (Accurate, for one): the button names the dice actually rolled,
  // planned with the same options the boost itself uses.
  let rolls = 1;
  try {
    const plan = actionDieBoostPlan(actor.actionDiceFundingSystem ?? system, check, input);
    if (!plan.blocked && Number.isSafeInteger(plan.rolls) && plan.rolls > 0) rolls = plan.rolls;
  } catch {
    /* the dialog route still works it out */
  }
  return { die: system.actionDice?.die ?? 4, rolls, input };
}

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
  // An NPC's own threat is paid from the GC pool by its own button (module/apps/gc/npc-card-dice.mjs).
  if (actor.type === "npc" && !check.errorConfirmed) return null;
  return card("Activate critical", () => actor.activateCritical(message));
});

/** Only agents carry action dice: an NPC's card has no boost of its own (the GC's dice are spent from the GC tools). */
const spendsActionDice = ({ actor, check }) => actor?.type === "agent" && check.actionDiceAllowed !== false;

core("quickBoostControl", 9135, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || !spendsActionDice(ctx)) return null;
  const quick = quickBoost(actor, check);
  if (!quick) return null;
  return card(loc`Spend 1 action die (+${quick.rolls ?? 1}d${quick.die})`, () =>
    actor.boostCheck(message, quick.input)
  );
});

core("boostControl", 9140, ctx => {
  const { message, actor } = ctx;
  if (!open(ctx) || !spendsActionDice(ctx)) return null;
  return card("Boost before outcome", () => actor.boostCheck(message));
});

core("generousControl", 9150, ctx => {
  const { message, check, actor } = ctx;
  if (!open(ctx) || !spendsActionDice(ctx) || check.generousBoost || !generousDonorExists(actor)) return null;
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

/**
 * Closing the outcome is a minor step. An attack waiting to be resolved against a Defense does not offer it: closing
 * it first would leave no way to roll the damage from the card.
 */
export const awaitingAttackResolution = check =>
  check.checkKind === "attack" &&
  !check.attackResolution &&
  check.successConfirmed === undefined &&
  !check.criticalFailure &&
  check.attackContext?.fireAction?.action !== "strafe";

core("finishControl", 9180, ctx => {
  if (!open(ctx) || awaitingAttackResolution(ctx.check)) return null;
  return card("Outcome resolved", () => ctx.actor.finishCheck(ctx.message), "quiet");
});

/* ---- The chat hook ---- */

/** A button's text: the translation keyed by its contributor id, or the contributor's own English label. */
export function localizedLabel(control, i18n = globalThis.game?.i18n) {
  const key = `SPYCRAFT.RollControl.${control.id}`;
  return i18n?.has?.(key) ? i18n.localize(key) : control.label;
}

function button(control) {
  const element = document.createElement("button");
  element.type = "button";
  if (control.emphasis === "primary") element.className = "sc2-primary-action";
  else if (control.emphasis === "quiet") element.className = "sc2-quiet-action";
  element.textContent = localizedLabel(control);
  // The face stays short enough for the chat column; the full wording is the name and the tooltip.
  const full = control.hint || element.textContent;
  element.setAttribute("aria-label", full);
  element.setAttribute("data-tooltip", full);
  element.dataset.rollControl = control.id;
  element.addEventListener("click", () => runChatAction(element, () => control.run()));
  return element;
}

// The notes a check card's flavor may carry. Everything else in it becomes plain text.
const FLAVOR_TAGS = new Set(["B", "BR", "EM", "I", "SMALL", "SPAN", "STRONG"]);

/**
 * The translated flavor as nodes, keeping only simple inline markup and class names. It is built from the card's
 * flags, which the poster's client wrote, and shown on every other client, so it never goes in as raw HTML.
 */
export function safeFlavor(markup, doc = document) {
  const template = doc.createElement("template");
  template.innerHTML = markup;
  const clean = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1 || !FLAVOR_TAGS.has(child.tagName)) {
        child.replaceWith(doc.createTextNode(child.nodeType === 1 ? child.textContent : ""));
        continue;
      }
      for (const attr of [...child.attributes]) if (attr.name !== "class") child.removeAttribute(attr.name);
      clean(child);
    }
  };
  clean(template.content);
  return template.content;
}

const EMPHASIS_ORDER = { primary: 0, quiet: 2 };
/** Controls in display order: the primary step first, quiet ones last, the rest as the pipeline ordered them. */
export const byEmphasis = controls =>
  controls
    .map((control, index) => ({ control, index }))
    .sort(
      (a, b) =>
        (EMPHASIS_ORDER[a.control.emphasis] ?? 1) - (EMPHASIS_ORDER[b.control.emphasis] ?? 1) || a.index - b.index
    )
    .map(entry => entry.control);

function row(controls) {
  const element = document.createElement("div");
  element.className = "spycraft2 roll-controls";
  element.append(...byEmphasis(controls).map(button));
  return element;
}

/** Add this system's buttons to a rendered chat message (the `renderChatMessageHTML` hook). */
export function renderCheckControls(message, html) {
  const check = message.flags?.spycraft2;
  if (!check?.actorUuid) return;
  if (message.blind && !game.user.isGM) {
    // A secret or passive check hides its result from the player who made it: say where it went.
    if (message.isAuthor && !html.querySelector(".sc2-secret-note")) {
      const note = document.createElement("p");
      note.className = "spycraft2 sc2-secret-note";
      note.textContent = loc`Secret check: the rules keep this result from you. It went to the GC, who tells you the outcome.`;
      (html.querySelector(".message-content") ?? html).append(note);
    }
    return;
  }
  // Posted in another language: show this viewer the record's notes in their own.
  const translated = viewerFlavor(check, game.i18n?.lang);
  const flavor = translated ? html.querySelector(".flavor-text") : null;
  if (flavor) flavor.replaceChildren(safeFlavor(translated, flavor.ownerDocument));
  const actor = fromUuidSync(check.actorUuid);
  // The player whose agent is the target answers from the same card.
  const response = targetResponseControls({ message, check, user: game.user });
  if (response.length) html.append(row(response.map(control => ({ ...control, placement: "card" }))));
  if (!actor?.isOwner) return;
  renderCheckGuidance(message, check, html, game.user);
  const controls = rollPipeline.chatControls({ message, check, actor, user: game.user, checkKind: check.checkKind });
  const inContent = controls.filter(c => c.placement === "content");
  const onCard = controls.filter(c => c.placement === "card");
  if (inContent.length) html.querySelector(".message-content")?.append(row(inContent));
  if (onCard.length) html.append(row(onCard));
  for (const control of controls.filter(c => c.placement === "plain")) html.append(button(control));
}
