/** Limited-use class and feat abilities, analysis tasks, temporary feats and assistants. */
import { refuse, refuseStep } from "../../error-notices.mjs";
import { ruleName } from "../../rules/rule-name.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { useMark, discloseMark, correctMark } from "../../apps/mark.mjs";
import { improvisedMasterySpec } from "../../rules/improvised-weapons.mjs";
import {
  featFreeActionPlan,
  FREE_ACTION_FEATS,
  QUICK_DRAW_ACTIONS,
  ROUND_ACTION_FEATS
} from "../../rules/feat-free-actions.mjs";
import { FINAL_ATTACK_WORKFLOWS, withFinalRoundReservation } from "../../rules/final-round.mjs";
import { actionDieBenefitQuote } from "../../rules/benefit-payments.mjs";
import { surchargeFundingInput, unrolledPaymentFundingInput } from "../../apps/action-die-benefits.mjs";
import { getActionDieSettlementReview, setPendingActionDieReview } from "../../rules/action-die-payments.mjs";
import { shakenRules } from "../../rules/shaken.mjs";
import { restraintActionBlock } from "../../rules/restraints.mjs";
import { adrenalineSource, woundEventKey, recordedWoundEvent, adrenalineWoundPlan } from "../../rules/adrenaline.mjs";
import { strutGainPlan, strutPool } from "../../rules/strut.mjs";
import {
  mentalLeapSource,
  mentalLeapRecord,
  endMentalLeapPlan,
  detachMentalLeapPlan
} from "../../rules/mental-leap.mjs";
import { attributeActionBlock } from "../../rules/attributes.mjs";
import {
  assistantSource,
  assistantSummonPlan,
  assistantGroupStatus,
  assistantWithdrawalPlan,
  sceneSequence
} from "../../rules/summoned-assistants.mjs";
import { deferredSkillPools, deferredSkillPlan } from "../../rules/deferred-skills.mjs";
import { temporaryFocusPlan } from "../../rules/training.mjs";
import { resolveFeatChoices } from "../../rules/feats.mjs";
import {
  manageAnalysisTasks,
  createAnalysisTask,
  expireAnalysisTask,
  settleAnalysisTask,
  reviewAnalysisTaskSettlement,
  prepareAnalysisTaskPressure,
  applyAnalysisTaskPressureStress
} from "../../apps/analysis-tasks.mjs";
import { eagleEyeDiePlan, eagleEyeRecord } from "../../rules/sniper.mjs";
import { brightIdeaPoolStatus, brightIdeaMigrationPlan, brightIdeaLegacyReviewSpec } from "../../rules/bright-idea.mjs";
import {
  actionDiceFundingContext,
  actionDicePoolFingerprint,
  unrestrictedBonusPools,
  masterPlanGainPlan,
  masterPlanPool
} from "../../rules/bonus-pools.mjs";
import { queueResources, isResourceLock } from "../../services/transactions.mjs";
import { rollEvidence } from "../../rules/outcomes.mjs";
import {
  SHARE_ABILITIES,
  temporarySharePlan,
  renaissanceManPlan,
  intelTemporaryFeatSource,
  intelTemporaryFeatPlan,
  anyTimeAnyPlaceSource,
  anyTimeAnyPlacePlan,
  knowItAllSource,
  knowItAllChoiceOptions,
  knowItAllPlan,
  everydayGeniusSource,
  everydayGeniusPlan
} from "../../rules/temporary-feats.mjs";
import {
  resourceStatus,
  resourceUsePlan,
  resourceCounterReviewPlan,
  resourceCounterRestorePatch
} from "../../rules/limited-uses.mjs";
import { pointmanLevel } from "../../rules/action-dice.mjs";
import { computeAgent } from "../../rules/engine.mjs";
import { LimitedUseCancelled } from "./shared.mjs";
import { loc } from "../../i18n.mjs";

export const ActorAbilities = Base =>
  class ActorAbilities extends Base {
    prepareAnalysisTaskPressure(id, message, options = {}) {
      return prepareAnalysisTaskPressure(this, id, message, options);
    }

    applyAnalysisTaskPressureStress(id, message, options = {}) {
      return applyAnalysisTaskPressureStress(this, id, message, options);
    }

    useMark(options = {}) {
      return useMark(this, options);
    }

    discloseMark(id, options = {}) {
      return discloseMark(this, id, options);
    }

    correctMark(id, options = {}) {
      return correctMark(this, id, options);
    }

    manageAnalysisTasks(options = {}) {
      return manageAnalysisTasks(this, options);
    }

    createAnalysisTask(options = {}) {
      return createAnalysisTask(this, options);
    }

    expireAnalysisTask(id, options = {}) {
      return expireAnalysisTask(this, id, options);
    }

    settleAnalysisTask(id, message, options = {}) {
      return settleAnalysisTask(this, id, message, options);
    }

    reviewAnalysisTaskSettlement(options = {}) {
      return reviewAnalysisTaskSettlement(this, options);
    }

    get usagePeriods() {
      const periods = { ...(globalThis.game?.settings?.get("spycraft2", "usagePeriods") ?? {}) };
      const combat = this.participatingCombat;
      if (this.system.twoWeaponStyle?.id) periods["two-weapon declaration"] = this.system.twoWeaponStyle.id;
      if (this.system.dartingStyle?.id) periods["darting declaration"] = this.system.dartingStyle.id;
      if (combat?.started) periods.combat = combat.id;
      if (combat) periods.round = `${combat.id}:${combat.round}`;
      return periods;
    }

    get limitedUseStatus() {
      const status = brightIdeaPoolStatus(this.system, this.usagePeriods);
      const mastery = improvisedMasterySpec(this.system, this.participatingCombat?.id);
      return [...(this.system.limitedUses ?? []), ...(mastery ? [mastery] : [])].map(spec => {
        const value = resourceStatus(spec, status.virtualUses, this.usagePeriods);
        if (spec.workflow === "brightIdea" && status.sources.find(s => s.id === spec.id)?.used === null)
          return { ...value, remaining: 0, counterReview: true };
        return spec.workflow === "brightIdea" && status.needsReview
          ? { ...value, remaining: 0, legacyReview: true }
          : value;
      });
    }

    counterReviewSpec(id) {
      const mastery = improvisedMasterySpec(this.system, this.participatingCombat?.id);
      return id === "brightIdea"
        ? brightIdeaLegacyReviewSpec(this.system, this.usagePeriods)
        : (this.system.limitedUses?.find(s => s.id === id) ?? (mastery?.id === id ? mastery : null));
    }

    async reviewLimitedUseCounter(id, options = {}) {
      if (!game.user?.isGM || !this.isOwner) throw new Error(loc`Only an owning GC can correct a saved use counter.`);
      const candidate = this.counterReviewSpec(id),
        spec = candidate ? { ...candidate } : null,
        before = JSON.stringify(this.system.resourceUses?.[id]),
        epoch = String(this.usagePeriods[spec?.period] ?? "initial");
      if (spec?.combatScoped && !this.participatingCombat?.started)
        throw new Error(loc`Start the character’s combat before reviewing its current combat or round allowance.`);
      if (
        !spec ||
        (!spec.manualReviewable && !resourceStatus(spec, this.system.resourceUses, this.usagePeriods).counterReview)
      )
        return refuse(loc`This saved counter does not need review.`);
      if (!Number.isSafeInteger(spec.limit) || spec.limit < 0)
        throw new Error(loc`Correct this ability’s source/limit before reviewing its use count.`);
      let input = options;
      if (!Object.hasOwn(input, "used")) {
        const esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: loc`Review saved uses: ${spec.name}` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`${resourceStatus(spec, this.system.resourceUses, this.usagePeriods).counterReview ? loc`This use history needs verification.` : loc`Review the actual uses already resolved, including uses handled at the table or through other controls.`} Confirm the actual uses already spent in the current ${esc(spec.period)}. No unused allowance is assumed. Current source allowance: ${esc(spec.limitLabel ?? String(spec.limit))}.`}</p><details><summary>${loc`Saved record for review`}</summary><pre>${esc(JSON.stringify(this.system.resourceUses?.[id]) ?? "missing")}</pre></details><label>${loc`Uses already spent`} <input name="used" type="number" min="0" step="1" required /></label><label>${loc`Reason / source of corrected history`} <input name="reason" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`This is the GC-confirmed count for the current period`}</label></div>`
        });
        if (!input) return null;
      }
      const used =
        typeof input.used === "number"
          ? input.used
          : typeof input.used === "string" && input.used.trim()
            ? Number(input.used)
            : NaN;
      return queueResources([this], async () => {
        if (!game.user?.isGM || !this.isOwner) throw new Error(loc`Only an owning GC can correct this counter.`);
        const fresh = this.counterReviewSpec(id);
        if (fresh?.combatScoped && !this.participatingCombat?.started)
          throw new Error(loc`The combat ended during review; the saved history was retained.`);
        if (
          !fresh ||
          fresh.limit !== spec.limit ||
          fresh.period !== spec.period ||
          String(this.usagePeriods[fresh.period] ?? "initial") !== epoch ||
          JSON.stringify(this.system.resourceUses?.[id]) !== before
        )
          throw new Error(loc`This source, period or counter changed during review. Review its current history again.`);
        const plan = resourceCounterReviewPlan(fresh, this.system.resourceUses, this.usagePeriods, {
          used,
          reason: input.reason,
          confirmed: !!input.confirmed
        });
        await this.update({ [`system.resourceUses.${id}`]: plan.record });
        try {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
            content: loc`Saved-use review: ${foundry.utils.escapeHTML(fresh.name)}; ${used} already spent this ${foundry.utils.escapeHTML(fresh.period)}. ${foundry.utils.escapeHTML(plan.reason)}`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "resourceReview",
                resource: id,
                period: fresh.period,
                epoch,
                used,
                reason: plan.reason,
                previousUseRecord: plan.previous,
                reviewedBy: game.user.id,
                reviewedAt: Date.now(),
                actionDiceAllowed: false
              }
            }
          });
        } catch (error) {
          try {
            await this.update(resourceCounterRestorePatch(id, plan.previous));
          } catch (restoreError) {
            ui.notifications.warn(
              loc`The corrected count may remain after a review-receipt failure. Inspect the current count before retrying.`
            );
            return plan.record;
          }
          throw error;
        }
        return plan.record;
      });
    }

    async useManualLimitedAbility(id, options = {}) {
      if (!this.isOwner) return null;
      const spec = this.system.limitedUses?.find(s => s.id === id && s.workflow === "manual");
      if (!spec) throw new Error(loc`Choose an available manual class ability.`);
      let input = options;
      if (spec.cost > 0 && !Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: spec.name },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Use ${foundry.utils.escapeHTML(spec.name)}. Base cost ${spec.cost} action dice. Apply its stated actions, circumstances and effect at the table.`}</p>${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({ unrolled: true })}</div>`
        });
        if (!input) return null;
      }
      return this.useLimitedAbility(
        id,
        async (status, payment) => {
          const receiptId = foundry.utils.randomID(),
            funding = payment
              ? {
                  paymentId: payment.id ?? null,
                  bonusPoolId: payment.bonusPoolId,
                  count: payment.count,
                  baseCost: spec.cost,
                  surcharge: payment.surcharge ?? 0,
                  allocations: payment.allocations ?? null
                }
              : null;
          try {
            return await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: foundry.utils.escapeHTML(
                loc`${this.name} uses ${spec.name}.${payment ? loc` Spent ${payment.count} action dice${payment.surcharge ? loc` (${payment.surcharge} Shaken surcharge)` : ""}.` : ""} Apply the ability's stated actions and circumstances at the table.`
              ),
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "manualAbility",
                  actionDiceAllowed: false,
                  abilityUseReceiptId: receiptId,
                  resourceId: id,
                  funding
                }
              }
            });
          } catch (error) {
            const posted = [...(game.messages?.values?.() ?? [])].find(
              m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags.spycraft2.abilityUseReceiptId === receiptId
            );
            if (posted) return posted;
            throw error;
          }
        },
        {
          workflow: "manual",
          bonusPoolId: input.bonusPoolId ?? "",
          ...surchargeFundingInput(input),
          ...unrolledPaymentFundingInput(input)
        }
      );
    }

    async useFeatFreeAction(source, options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!Object.hasOwn(FREE_ACTION_FEATS, source)) throw new Error(loc`Choose a supported free-action feat.`);
      let input = options;
      const esc = foundry.utils.escapeHTML;
      const round = ROUND_ACTION_FEATS[source];
      if (round && !Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: FREE_ACTION_FEATS[source] },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`${round.perRound} per round: take the action below as a ${round.cost} action. Resolve the action itself normally at the table.`}</p><label>${loc`Action`} <select name="action">${round.actions
            .map(a => `<option value="${esc(a)}">${esc(a)}</option>`)
            .join("")}</select></label>${
            round.advantage
              ? `<label><input type="checkbox" name="advantageConfirmed" /> ${loc`The GC confirms your side has a 2-to-1 or greater advantage`}</label>`
              : ""
          }<label>${loc`Target and circumstances`} <textarea name="description" maxlength="1000" required></textarea></label><label><input type="checkbox" name="confirmed" /> ${loc`GC confirms this action is otherwise legal now`}</label></div>`
        });
        if (!input) return null;
      }
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: FREE_ACTION_FEATS[source] },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${source === "quickDraw" ? loc`Twice per round, take Draw Weapon, Holster Weapon, Pick Up Weapon or Reload as a free action. Each action retains its ordinary limits (one two-handed weapon or two one-handed weapons for Draw/Holster/Pick Up; normal Reload amount).` + (this.system.knifeBasics?.active ? loc` Knife Basics already makes drawing a knife a free action: do not spend a Quick Draw use to draw a knife.` : "") : loc`Once per round, take one additional non-attack half action as a free action; session uses equal starting action dice.`}</p>${
            source === "quickDraw"
              ? `<label>${loc`Action`} <select name="action">${Object.entries(QUICK_DRAW_ACTIONS)
                  .map(([id, name]) => `<option value="${id}">${esc(name)}</option>`)
                  .join("")}</select></label>`
              : `<input type="hidden" name="action" value="nonAttackHalfAction" /><label><input type="checkbox" name="nonAttackHalfActionConfirmed" /> ${loc`This is one non-attack half action`}</label><label><input type="checkbox" name="purelyMentalConfirmed" /> ${loc`GC confirms this is purely mental`}</label>`
          }<label>${loc`Action and weapon(s) / circumstances`} <textarea name="description" maxlength="1000" required></textarea></label><label><input type="checkbox" name="confirmed" /> ${loc`GC confirms this action is otherwise legal now; resolve its checks, movement, gear and ammunition changes at the table`}</label></div>`
        });
        if (!input) return null;
      }
      const plan = () => featFreeActionPlan(this.system, this.mentalLeapCombatContext(), { ...input, source }),
        expected = plan();
      return this.useLimitedAbility(
        source,
        async () => {
          const fresh = plan();
          if (JSON.stringify(fresh) !== JSON.stringify(expected))
            throw new Error(loc`The free-action source, combat or declaration changed.`);
          const receiptId = foundry.utils.randomID();
          try {
            return await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: esc(
                fresh.actionCost === "half"
                  ? loc`${this.name}: ${fresh.source} — ${fresh.action} as a half action. ${fresh.description} Resolve the ordinary action and its remaining requirements at the table.`
                  : loc`${this.name}: ${fresh.source} — ${fresh.action} as a free action. ${fresh.description} Resolve the ordinary action and its remaining requirements at the table.`
              ),
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "featFreeAction",
                  actionDiceAllowed: false,
                  abilityUseReceiptId: receiptId,
                  resourceId: source,
                  featFreeAction: fresh
                }
              }
            });
          } catch (error) {
            const posted = [...(game.messages?.values?.() ?? [])].find(
              m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags.spycraft2.abilityUseReceiptId === receiptId
            );
            if (posted) return posted;
            throw error;
          }
        },
        {
          workflow: "featFreeAction",
          additionalUses:
            source === "surgeOfSpeed" ? [{ id: "surgeOfSpeedRound", workflow: "featFreeActionRound" }] : []
        }
      );
    }

    /** Queue resource costs with action-die boosts so rapid clicks cannot overspend locally. */
    useLimitedAbility(
      id,
      perform,
      {
        workflow = "manual",
        additionalCost = 0,
        additionalBenefitCount = additionalCost ? 1 : 0,
        additionalUses = [],
        messages = [],
        bonusPoolId = "",
        surchargeBonusPoolId = "same",
        surchargeAllocations,
        allocations
      } = {}
    ) {
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      const work = async () => {
        if (!this.isOwner) throw new Error(loc`You must own this actor.`);
        const mastery =
          workflow === "improvisedSearch" ? improvisedMasterySpec(this.system, this.participatingCombat?.id) : null;
        const spec = this.system.limitedUses?.find(entry => entry.id === id) ?? (mastery?.id === id ? mastery : null);
        if (!spec || spec.workflow !== workflow)
          throw new Error(loc`Use this ability through its appropriate roll control.`);
        if (
          !Number.isSafeInteger(additionalCost) ||
          additionalCost < 0 ||
          !Number.isSafeInteger(additionalBenefitCount) ||
          additionalBenefitCount < 0 ||
          additionalBenefitCount > additionalCost ||
          (additionalCost > 0 && additionalBenefitCount === 0)
        )
          throw new Error(loc`Invalid additional action-die cost or benefit count.`);
        if (workflow === "brightIdea") {
          const source = brightIdeaPoolStatus(this.system, this.usagePeriods).sources.find(s => s.id === id);
          if (!source || source.used === null)
            throw new Error(loc`Review this Bright Idea source and its saved use count before rolling.`);
          const migration = brightIdeaMigrationPlan(this.system, this.usagePeriods, undefined, {
            at: Date.now(),
            reviewedBy: loc`single-source automatic migration`
          });
          if (migration) await this.update(migration.updates);
        }
        if (
          !Array.isArray(additionalUses) ||
          new Set([id, ...additionalUses.map(s => s.id)]).size !== additionalUses.length + 1
        )
          throw new Error(loc`Choose distinct additional ability sources.`);
        const specs = [
          { ...spec, cost: spec.cost + additionalCost },
          ...additionalUses.map(request => {
            const extra = this.system.limitedUses?.find(s => s.id === request.id);
            if (!extra || extra.workflow !== request.workflow || extra.workflow === "brightIdea")
              throw new Error(loc`An additional ability no longer qualifies for this check.`);
            return extra;
          })
        ];
        if (FINAL_ATTACK_WORKFLOWS.has(workflow)) {
          const shared = this.system.limitedUses.find(s => s.id === "finalAttackRound");
          if (!shared || shared.workflow !== "finalAttackRound")
            throw new Error(loc`The shared final-attack counter is unavailable. Reload before attacking.`);
          if (specs.some(s => s.id === shared.id))
            throw new Error(loc`Do not select the shared final-attack counter as an additional source.`);
          specs.push({ ...shared });
        }
        if (specs.some(s => !Number.isSafeInteger(s.cost) || s.cost < 0))
          throw new Error(loc`Invalid action-die cost for an ability source.`);
        const benefitCount =
          Number(spec.cost > 0) + specs.slice(1).filter(s => s.cost > 0).length + additionalBenefitCount;
        const cost = specs.reduce((n, s) => n + s.cost, 0);
        if (!Number.isSafeInteger(cost) || cost < 0) throw new Error(loc`Invalid combined ability cost.`);
        if (allocations !== undefined && workflow === "eagleEye")
          throw new Error(loc`Eagle Eye must retain one selected benefit die source; split only its surcharge.`);
        if (
          allocations !== undefined ||
          (cost &&
            (shakenRules(this.actionDiceFundingSystem).extraDice ||
              shakenRules(this.actionDiceFundingSystem).needsReview))
        ) {
          try {
            actionDieBenefitQuote(this, {
              baseCost: cost,
              benefitCount,
              bonusPoolId,
              surchargeBonusPoolId,
              surchargeAllocations,
              allocations
            });
          } catch (error) {
            return refuseStep(error.message);
          }
        }
        const split = Array.isArray(allocations) && allocations.length > 0;
        const funding = split
          ? { blocked: false, balance: cost }
          : cost
            ? actionDiceFundingContext(this.actionDiceFundingSystem, { bonusPoolId, periods: this.usagePeriods })
            : { blocked: false, balance: 0 };
        if (funding.blocked) return refuseStep(funding.reason);
        const plans = specs.map(s => resourceUsePlan(s, this.system.resourceUses, this.usagePeriods, funding.balance));
        const blocked = plans.find(p => p.blocked);
        if (blocked) return refuseStep(blocked.reason);
        if (cost > funding.balance) return refuseStep(loc`Not enough action dice remain for these abilities.`);
        const before = specs.map(s => structuredClone(this.system.resourceUses?.[s.id])),
          settlementBefore = JSON.stringify(getActionDieSettlementReview(this));
        let callbackStarted = false;
        const refundUses = async () => {
          const refund = {};
          for (const [i, s] of specs.entries()) {
            const current = this.system.resourceUses?.[s.id],
              record = plans[i].record;
            if (current?.epoch === record.epoch) {
              if (current.used === record.used) {
                if (before[i] === undefined) refund[`system.resourceUses.-=${s.id}`] = null;
                else refund[`system.resourceUses.${s.id}`] = before[i];
              } else if (current.used > record.used) refund[`system.resourceUses.${s.id}.used`] = current.used - 1;
            }
          }
          if (Object.keys(refund).length) await this.update(refund);
        };
        try {
          await this.update(Object.fromEntries(specs.map((s, i) => [`system.resourceUses.${s.id}`, plans[i].record])));
          const run = async payment => {
            callbackStarted = true;
            const sharedIndex = specs.findIndex(s => s.id === "finalAttackRound"),
              reservation =
                sharedIndex < 0
                  ? null
                  : { record: structuredClone(plans[sharedIndex].record), nauseated: specs[sharedIndex].limit === 1 };
            const result = await withFinalRoundReservation(this, reservation, () =>
              perform?.(plans[0].status, payment)
            );
            if (result === null) throw new LimitedUseCancelled(loc`The ability was cancelled before completion.`);
            return result ?? plans[0].status;
          };
          const result = cost
            ? await this.payActionDiceBenefitLocked(cost, run, {
                benefitCount,
                bonusPoolId,
                surchargeBonusPoolId,
                surchargeAllocations,
                allocations,
                expectedShaken,
                message: messages[0] ?? null,
                purpose: (
                  "Class use: " +
                  specs.map(s => s.name ?? s.id).join(" + ") +
                  (additionalCost ? loc`; additional action-die benefits` : "")
                ).slice(0, 500),
                benefit: "classAbility",
                details: {
                  abilities: specs.map(s => s.id),
                  additionalCost,
                  additionalBenefitCount,
                  limitedUseSettlement: specs.map((s, i) => ({
                    id: s.id,
                    before: before[i] ?? null,
                    reserved: plans[i].record
                  }))
                }
              })
            : await run(null);
          if (!callbackStarted) await refundUses();
          return result;
        } catch (error) {
          if (
            getActionDieSettlementReview(this).needsReview &&
            (cost > 0 || JSON.stringify(getActionDieSettlementReview(this)) !== settlementBefore)
          ) {
            const review = {
              ...getActionDieSettlementReview(this),
              limitedUseSettlement: specs.map((spec, i) => ({
                id: spec.id,
                before: before[i] ?? null,
                reserved: plans[i].record
              }))
            };
            setPendingActionDieReview(this, review);
            try {
              await this.update(this.actorRecordRestorePatch("flags.spycraft2.actionDiceSettlementReview", review));
            } catch {
              ui.notifications.warn(
                loc`The payment and limited-use counters remain reserved; include both in GC review.`
              );
            }
            throw error;
          }
          try {
            await refundUses();
          } catch (rollback) {
            throw new AggregateError([error, rollback], loc`The limited-use count needs GC review before retrying.`);
          }
          if (error instanceof LimitedUseCancelled) return null;
          throw error;
        }
      };
      return queueResources([this], work, { messages });
    }

    async configureFortuneTeammates(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const candidates = [...(game.actors ?? [])].filter(actor => actor.id !== this.id && pointmanLevel(actor) >= 10);
      let input = options;
      if (!input.ids) {
        const esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: loc`Improved Fortune teammates` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Choose actual Pointman teammates. Their Improved Fortune combines with your own, up to +3 starting action dice. Current dice are not refilled by changing this list.`}</p>${candidates.map(actor => `<label><input type="checkbox" name="ally_${actor.id}" ${this.system.fortuneTeammateIds?.includes(actor.id) ? "checked" : ""} /> ${loc`${esc(actor.name)} (Pointman ${pointmanLevel(actor)})`}</label>`).join("")}<label><input type="checkbox" name="teammatesConfirmed" /> ${loc`These characters are teammates who provide Improved Fortune`}</label></div>`
        });
        if (!input) return null;
        input.ids = candidates.filter(actor => input[`ally_${actor.id}`]).map(actor => actor.id);
      }
      if (
        !Array.isArray(input.ids) ||
        input.ids.some(id => !candidates.some(actor => actor.id === id)) ||
        (input.ids.length && !input.teammatesConfirmed)
      )
        return refuse(loc`Choose actual qualifying teammates and confirm their team membership.`);
      return this.update({ "system.fortuneTeammateIds": [...new Set(input.ids)] });
    }

    async useEagleEye(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      if (
        !Object.keys(input).length &&
        (shakenRules(this.actionDiceFundingSystem).extraDice ||
          unrestrictedBonusPools(this.actionDiceFundingSystem, this.usagePeriods).some(p => p.available))
      ) {
        input = await systemDialog.input({
          window: { title: loc`Eagle Eye` },
          rejectClose: false,
          content:
            '<div class="spycraft2-roll-options">' +
            this.actionDiceFundingControl() +
            this.actionDiceSurchargeControl() +
            `<p>${loc`Roll one selected action die. Its result ×10 adds to the range increment of your two-handed firearms and hurled weapons for this scene.`}</p></div>`
        });
        if (!input) return null;
      }
      return this.useLimitedAbility(
        "eagleEye",
        async (status, payment) => {
          const scene = String(this.usagePeriods.scene ?? "initial"),
            guard = () => {
              if (JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken)
                throw new Error(loc`The Shaken condition changed while resolving Eagle Eye.`);
              const blocked = attributeActionBlock(this.system, { kind: "mentalAbility" });
              if (blocked) throw new Error(blocked);
              if (
                !this.system.coreClassIds?.includes("sniper") ||
                String(this.usagePeriods.scene ?? "initial") !== scene ||
                status.epoch !== scene
              )
                throw new Error(loc`Eagle Eye source or scene changed.`);
            };
          guard();
          const plan = eagleEyeDiePlan({ ...this.system, actionDice: payment.system.actionDice }),
            before = structuredClone(this.system.eagleEyeBoost ?? null),
            roll = await new Roll(plan.formula).evaluate();
          guard();
          const actionDiceReceiptId =
              globalThis.foundry?.utils?.randomID?.() ??
              "eagleEye-" + (this._eagleEyeReceiptSequence = (this._eagleEyeReceiptSequence ?? 0) + 1),
            record = {
              ...eagleEyeRecord(this.system, plan, roll, { scene }),
              actionDiceReceiptId,
              funding: {
                bonusPoolId: payment.bonusPoolId,
                die: payment.die,
                count: 1,
                ...(payment.surcharge
                  ? {
                      paymentId: payment.id,
                      surcharge: payment.surcharge,
                      totalCost: payment.cost,
                      allocations: payment.allocations
                    }
                  : {})
              }
            };
          const same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
            current = () => this.system.eagleEyeBoost ?? null;
          let wrote = false;
          try {
            await this.update(this.actorRecordRestorePatch("system.eagleEyeBoost", record));
            wrote = true;
            guard();
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              flavor: loc`Eagle Eye: spent ${payment.count} action dice${payment.surcharge ? loc` (one benefit die + ${payment.surcharge} Shaken surcharge)` : ""}; result ${record.result}. Range increment +${record.rangeIncrease} ft. with any 2-handed firearm or hurled weapon for this scene (p.80).`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "eagleEye",
                  ...record,
                  eagleEyeReceiptId: actionDiceReceiptId,
                  actionDiceAllowed: false
                }
              }
            });
            return record;
          } catch (error) {
            if (
              [...(game.messages ?? [])].some(
                m =>
                  m.flags?.spycraft2?.actorUuid === this.uuid &&
                  m.flags?.spycraft2?.eagleEyeReceiptId === actionDiceReceiptId
              ) &&
              (wrote || current()?.actionDiceReceiptId === actionDiceReceiptId)
            )
              return record;
            if (!wrote && current()?.actionDiceReceiptId !== actionDiceReceiptId && same(current(), before))
              throw error;
            if (same(current(), record)) {
              try {
                await this.update(this.actorRecordRestorePatch("system.eagleEyeBoost", before));
              } catch (rollback) {
                if (!same(current(), before)) {
                  const failure = new AggregateError([error, rollback], loc`Eagle Eye could not be safely restored.`);
                  failure.actionDiceSettlementReview = {
                    purpose: "Eagle Eye",
                    beforeBoost: before,
                    targetBoost: record,
                    observedBoost: current()
                  };
                  throw failure;
                }
              }
              throw error;
            }
            error.actionDiceSettlementReview = {
              purpose: "Eagle Eye",
              beforeBoost: before,
              targetBoost: record,
              observedBoost: current()
            };
            throw error;
          }
        },
        { workflow: "eagleEye", bonusPoolId: input.bonusPoolId ?? "", ...surchargeFundingInput(input) }
      );
    }

    async useIntelTemporaryFeats(ability, options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const source = intelTemporaryFeatSource(this.system, ability);
      if (!source) return refuse(loc`This Intel-phase feat grant has not been earned.`);
      const pack = game.packs?.get("spycraft2.feats");
      if (!pack) throw new Error(loc`The system feat compendium is unavailable.`);
      let input = options;
      if (!input.featIds) {
        const index = await pack.getIndex({ fields: ["system.tree"] }),
          esc = foundry.utils.escapeHTML;
        const choices = index
          .filter(i => i.type === "feat" && i.system.tree === source.tree)
          .sort((a, b) => a.name.localeCompare(b.name));
        const proficiencies = Object.entries(CONFIG.SPYCRAFT.proficiencies)
          .filter(([key]) => key !== "unarmed")
          .map(([key, row]) => `<option value="${esc(key)}">${esc(row.label)}</option>`)
          .join("");
        input = await systemDialog.input({
          window: { title: source.name },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Choose ${source.count} temporary ${esc(CONFIG.SPYCRAFT.featTrees[source.tree] ?? source.tree)} feat(s) in acquisition order, until this mission ends. All prerequisites apply. A prior temporary selection can qualify a later temporary selection; it cannot qualify permanent feats or expert classes.`}</p>${Array.from({ length: source.count }, (_, i) => `<label>${loc`Feat ${i + 1}`} <select name="feat${i}"><option value="">${loc`Choose a feat`}</option>${choices.map(f => `<option value="${esc(f._id)}">${esc(f.name)}</option>`).join("")}</select></label>${source.tree === "basicCombat" ? `<label>${loc`Choice for selection ${i + 1}: Weapon Focus proficiency or Armor Basics/Mastery type`} <select name="choice${i}"><option value="">${loc`Choose only if required by this feat`}</option><optgroup label="Armor type"><option value="P">${loc`Partial`}</option><option value="M">${loc`Moderate`}</option><option value="F">${loc`Full`}</option></optgroup><optgroup label="Weapon Focus proficiency">${proficiencies}</optgroup></select></label>` : ""}`).join("")}<label><input name="intelPhaseConfirmed" type="checkbox" /> ${loc`I choose these during the current mission’s Intel Phase`}</label></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          featIds: Array.from({ length: source.count }, (_, i) => input[`feat${i}`]),
          featChoices: Array.from({ length: source.count }, (_, i) => input[`choice${i}`] ?? "")
        };
      }
      if (input.intelPhaseConfirmed !== true) return refuse(loc`Confirm the current mission’s Intel Phase.`);
      return this.useLimitedAbility(
        ability,
        async () => {
          const fresh = intelTemporaryFeatSource(this.system, ability);
          if (!fresh) throw new Error(loc`This temporary-feat source changed.`);
          if (!Array.isArray(input.featIds) || input.featIds.length !== fresh.count)
            throw new Error(loc`Choose exactly ${fresh.count} feat(s).`);
          const feats = [];
          for (const id of input.featIds) feats.push(await pack.getDocument(id));
          const epoch = String(this.usagePeriods.mission ?? "initial"),
            data = intelTemporaryFeatPlan(this.system, [...this.items], ability, feats, {
              cfg: CONFIG.SPYCRAFT,
              epoch,
              sourceActorUuid: this.uuid,
              intelPhaseConfirmed: input.intelPhaseConfirmed,
              featChoices: input.featChoices ?? []
            }),
            created = [];
          const guard = () => {
            const current = intelTemporaryFeatSource(this.system, ability);
            if (
              !this.isOwner ||
              !current ||
              current.count !== fresh.count ||
              String(this.usagePeriods.mission ?? "initial") !== epoch
            )
              throw new Error(loc`This temporary-feat source or mission changed.`);
          };
          try {
            for (const entry of data) {
              guard();
              const eligible = this.checkPrerequisites(entry.system.prerequisites, { temporary: true });
              if (!eligible.ok)
                throw new Error(loc`Temporary feat prerequisites not met: ${eligible.unmet.join("; ")}.`);
              const candidate = { ...entry, id: "__intelCandidate__" },
                items = [...this.items, candidate],
                active = new Set(
                  items.filter(i => i === candidate || this.system.featStatus?.[i.id]?.ok).map(i => i.id)
                ),
                choice = resolveFeatChoices(candidate, this.system, items, CONFIG.SPYCRAFT, active);
              if (choice.pending.length || choice.warnings.length)
                throw new Error([...choice.pending, ...choice.warnings].join("; "));
              const [item] = await this.createEmbeddedDocuments("Item", [entry]);
              if (!item) throw new Error(loc`Temporary feat creation failed.`);
              created.push(item);
            }
            guard();
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`${fresh.name}: gained ${created.map(i => foundry.utils.escapeHTML(i.name)).join(", ")} during Intel, until the end of this mission. One mission use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "temporaryFeat",
                  ability,
                  mission: epoch,
                  featUuids: created.map(i => i.uuid),
                  actionDiceAllowed: false
                }
              }
            });
            return created;
          } catch (error) {
            if (created.length)
              try {
                await this.deleteEmbeddedDocuments(
                  "Item",
                  created.map(i => i.id)
                );
              } catch (cleanupError) {
                ui.notifications.warn(
                  loc`Some temporary feats may remain after cleanup failed. The mission use remains spent; review the granted feats before retrying.`
                );
                return created;
              }
            throw error;
          }
        },
        { workflow: "intelTemporaryFeat" }
      );
    }

    /** Choices stay on the temporary feat so expiry removes the focus/forte itself. */
    async chooseTemporaryFocuses(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const feat = this.items.get(options.featId);
      if (
        !feat ||
        ruleName(feat) !== "Depth of Study" ||
        feat.system.featKind !== "temporary" ||
        !this.system.featStatus?.[feat.id]?.ok
      )
        return refuse(loc`Choose an active temporary Depth of Study feat.`);
      const epoch = String(this.usagePeriods.mission ?? "initial"),
        esc = foundry.utils.escapeHTML;
      let choices = options.choices;
      if (choices === undefined) {
        const groups = ["cultures", "drive", "profession", "science"],
          existing = feat.system.focusChoices ?? [];
        const selected = (a, b) => (a === b ? " selected" : "");
        const input = await systemDialog.input({
          window: { title: loc`Temporary Depth of Study choices` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Choose two focuses or fortes in order. A forte must name a subdivision of a focus already possessed, including an earlier choice. Profession names and forte subdivisions require the GC’s ordinary approval. These choices expire with this feat.`}</p>${[
            0, 1
          ]
            .map(i => {
              const row = existing[i] ?? {};
              return `<fieldset><legend>${loc`Choice ${i + 1}`}</legend><label>${loc`Type`} <select name="kind${i}"><option value="focus"${selected(row.kind, "focus")}>${loc`Focus`}</option><option value="forte"${selected(row.kind, "forte")}>${loc`Forte`}</option></select></label><label>${loc`Skill`} <select name="skill${i}">${groups.map(key => `<option value="${key}"${selected(row.skill, key)}>${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`).join("")}</select></label><label>${loc`Focus`} <input name="focus${i}" type="text" list="temporary-focus-names" value="${esc(row.focus ?? "")}" /></label><label>${loc`Forte subdivision (forte only)`} <input name="forte${i}" type="text" value="${esc(row.forte ?? "")}" /></label></fieldset>`;
            })
            .join("")}<datalist id="temporary-focus-names">${Object.values(CONFIG.SPYCRAFT.focuses)
            .flat()
            .map(name => `<option value="${esc(name)}"></option>`)
            .join("")}</datalist></div>`
        });
        if (!input) return null;
        choices = [0, 1].map(i => ({
          kind: input[`kind${i}`],
          skill: input[`skill${i}`],
          focus: input[`focus${i}`],
          forte: input[`forte${i}`]
        }));
      }
      return queueResources([this], async () => {
        const guard = () => {
          if (
            !this.isOwner ||
            !this.items.get(feat.id) ||
            !this.system.featStatus?.[feat.id]?.ok ||
            String(this.usagePeriods.mission ?? "initial") !== epoch
          )
            throw new Error(loc`The temporary focus source or mission changed.`);
        };
        guard();
        const system = this.system.toObject?.() ?? foundry.utils.deepClone(this.system);
        system.usagePeriods = this.usagePeriods;
        Object.assign(system, this.attributeRuleContext);
        const items = this.items.map(i => ({
          id: i.id,
          name: i.name,
          type: i.type,
          system: {
            ...(i.system.toObject?.() ?? foundry.utils.deepClone(i.system)),
            ...(i.id === feat.id ? { focusChoices: [] } : {})
          }
        }));
        computeAgent(system, items, CONFIG.SPYCRAFT);
        const current = this.items.get(feat.id),
          next = temporaryFocusPlan(
            system,
            items.find(i => i.id === feat.id),
            choices,
            CONFIG.SPYCRAFT
          ),
          previous = foundry.utils.deepClone(current.system.focusChoices ?? []);
        try {
          await current.update({ "system.focusChoices": next });
          guard();
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Temporary Depth of Study: ${next.map(row => esc(`${CONFIG.SPYCRAFT.skills[row.skill].name}: ${row.focus}${row.forte ? " / " + row.forte : ""}`)).join("; ")}. Choices expire with their source feat.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "temporaryFocus",
                sourceFeatUuid: feat.uuid,
                mission: epoch,
                actionDiceAllowed: false
              }
            }
          });
          guard();
          return next;
        } catch (error) {
          const remaining = this.items.get(feat.id);
          if (remaining) await remaining.update({ "system.focusChoices": previous });
          throw error;
        }
      });
    }

    async useKnowItAll(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!knowItAllSource(this.system)) return refuse(loc`Know It All has not been earned.`);
      const pack = game.packs?.get("spycraft2.feats");
      if (!pack) throw new Error(loc`The system feat compendium is unavailable.`);
      let input = options;
      const interactive = !input.featIds,
        esc = foundry.utils.escapeHTML;
      if (interactive) {
        const index = await pack.getIndex({ fields: ["system.tree"] }),
          feats = index
            .filter(f => f.type === "feat" && f.system.tree === "advancedSkill")
            .sort((a, b) => a.name.localeCompare(b.name));
        input = await systemDialog.input({
          window: { title: loc`Know It All` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Gain two temporary Advanced Skill feats in acquisition order until this mission ends. All prerequisites apply; level-one-only feats remain unavailable at Scientist 10+. Repeatable self-grants follow each feat’s own restrictions.`}</p>${[0, 1].map(i => `<label>${loc`Feat ${i + 1}`} <select name="feat${i}"><option value="">${loc`Choose a feat`}</option>${feats.map(f => `<option value="${esc(f._id)}">${esc(f.name)}</option>`).join("")}</select></label>`).join("")}<label><input name="freeActionConfirmed" type="checkbox" /> ${loc`I spend the required free action (during my initiative if in combat)`}</label></div>`
        });
        if (!input) return null;
        input = { ...input, featIds: [input.feat0, input.feat1] };
      }
      if (input.freeActionConfirmed !== true) return refuse(loc`Confirm the required free action.`);
      if (
        !Array.isArray(input.featIds) ||
        input.featIds.length !== 2 ||
        input.featIds.some(id => typeof id !== "string" || !id)
      )
        return refuse(loc`Choose exactly two Advanced Skill feats.`);
      if (interactive) {
        const selected = [];
        for (const id of input.featIds) selected.push(await pack.getDocument(id));
        if (selected.some(f => !f || f.type !== "feat" || f.system.tree !== "advancedSkill"))
          throw new Error(loc`Choose Advanced Skill feats.`);
        const descriptors = selected.map(f => knowItAllChoiceOptions(this.system, f, CONFIG.SPYCRAFT));
        if (descriptors.some(d => d.kind !== "none")) {
          const fields = descriptors
            .map(
              (d, i) =>
                `<fieldset><legend>${esc(selected[i].name)}</legend>${
                  d.kind === "training"
                    ? `<p>${loc`Allocate five rank points; one rank per point, subject to current limits. Unspent points require I Can Swim, possessed now or as an earlier selection.`}</p><div class="form-fields-grid">${Object.entries(
                        CONFIG.SPYCRAFT.skills
                      )
                        .map(
                          ([key, s]) =>
                            `<label>${esc(s.name)} <input name="training${i}_${esc(key)}" type="number" min="0" max="5" step="1" value="0" /></label>`
                        )
                        .join("")}</div>`
                    : ["basicSkill", "skill"].includes(d.kind)
                      ? `<label>${loc`Choice`} <select name="choice${i}"><option value="">${loc`Choose a target`}</option>${Object.entries(
                          d.options
                        )
                          .map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`)
                          .join("")}</select></label>`
                      : `<p>${loc`No additional choice.`}</p>`
                }</fieldset>`
            )
            .join("");
          const detail = await systemDialog.input({
            window: { title: loc`Know It All choices` },
            rejectClose: false,
            content: `<div class="spycraft2-roll-options">${fields}</div>`
          });
          if (!detail) return null;
          input = {
            ...input,
            featChoices: [detail.choice0 ?? "", detail.choice1 ?? ""],
            trainingSkills: [0, 1].map(i =>
              Object.fromEntries(
                Object.keys(CONFIG.SPYCRAFT.skills).map(key => [key, Number(detail[`training${i}_${key}`] ?? 0)])
              )
            )
          };
        }
      }
      return this.useLimitedAbility(
        "knowItAll",
        async () => {
          const epoch = String(this.usagePeriods.mission ?? "initial"),
            guard = (checkTurn = true) => {
              const source = knowItAllSource(this.system),
                combat = this.participatingCombat;
              if (
                !this.isOwner ||
                !source ||
                (this.system.resourceUses?.knowItAll?.used ?? 0) > source.limit ||
                String(this.usagePeriods.mission ?? "initial") !== epoch
              )
                throw new Error(loc`Know It All source or mission changed.`);
              if (checkTurn && combat?.started && combat.combatant?.actor?.uuid !== this.uuid)
                throw new Error(loc`Take this free action during this character’s initiative.`);
            };
          guard();
          const feats = [];
          for (const id of input.featIds) feats.push(await pack.getDocument(id));
          const data = knowItAllPlan(this.system, [...this.items], feats, {
              cfg: CONFIG.SPYCRAFT,
              epoch,
              sourceActorUuid: this.uuid,
              featChoices: input.featChoices ?? [],
              trainingSkills: input.trainingSkills ?? []
            }),
            created = [];
          try {
            for (const entry of data) {
              guard();
              const eligible = this.checkPrerequisites(entry.system.prerequisites, { temporary: true });
              if (!eligible.ok)
                throw new Error(loc`Temporary feat prerequisites not met: ${eligible.unmet.join("; ")}.`);
              const candidate = { ...entry, id: "__knowItAllCandidate__" },
                items = [...this.items, candidate],
                active = new Set(
                  items.filter(i => i === candidate || this.system.featStatus?.[i.id]?.ok).map(i => i.id)
                ),
                choice = resolveFeatChoices(candidate, this.system, items, CONFIG.SPYCRAFT, active);
              if (choice.pending.length || choice.warnings.length)
                throw new Error([...choice.pending, ...choice.warnings].join("; "));
              if (
                entry.name === "Training" &&
                Object.values(entry.system.trainingSkills ?? {}).reduce((n, v) => n + v, 0) < 5 &&
                !this.system.activeFeatNames?.includes("I Can Swim")
              )
                throw new Error(loc`Unspent Training points require I Can Swim.`);
              for (const [key, points] of Object.entries(entry.system.trainingSkills ?? {})) {
                const skill = this.system.skillTotals?.[key];
                if (!skill || !Number.isFinite(skill.maxRanks) || skill.ranks + points > skill.maxRanks)
                  throw new Error(loc`Training exceeds the current rank limit for ${key}.`);
              }
              const [item] = await this.createEmbeddedDocuments("Item", [entry]);
              if (!item) throw new Error(loc`Temporary feat creation failed.`);
              created.push(item);
            }
            guard(false);
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Know It All: free action; gained ${created.map(i => esc(i.name)).join(", ")} until the end of this mission. One mission use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "temporaryFeat",
                  ability: "knowItAll",
                  mission: epoch,
                  featUuids: created.map(i => i.uuid),
                  actionDiceAllowed: false
                }
              }
            });
            return created;
          } catch (error) {
            if (created.length)
              try {
                await this.deleteEmbeddedDocuments(
                  "Item",
                  created.map(i => i.id)
                );
              } catch (cleanupError) {
                ui.notifications.warn(
                  loc`Some Know It All feats may remain after cleanup failed. The mission use remains spent; review the granted feats before retrying.`
                );
                return created;
              }
            throw error;
          }
        },
        { workflow: "selfAdvancedFeats" }
      );
    }

    async useAnyTimeAnyPlace(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!anyTimeAnyPlaceSource(this.system)) return refuse(loc`Any Time, Any Place has not been earned.`);
      const pack = game.packs?.get("spycraft2.feats");
      if (!pack) throw new Error(loc`The system feat compendium is unavailable.`);
      let input = options;
      if (!input.featId) {
        const index = await pack.getIndex({ fields: ["system.tree"] }),
          esc = foundry.utils.escapeHTML,
          feats = index
            .filter(i => i.type === "feat" && i.system.tree === "terrain")
            .sort((a, b) => a.name.localeCompare(b.name));
        input = await systemDialog.input({
          window: { title: loc`Any Time, Any Place` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Gain one temporary Terrain feat until this mission ends. All prerequisites apply. One use is earned at Guide 4 and another at Guide 8.`}</p><label>${loc`Feat`} <select name="featId">${feats.map(f => `<option value="${esc(f._id)}">${esc(f.name)}</option>`).join("")}</select></label><label><input name="freeActionConfirmed" type="checkbox" /> ${loc`I spend the required free action (during my initiative if in combat)`}</label></div>`
        });
        if (!input) return null;
      }
      if (input.freeActionConfirmed !== true) return refuse(loc`Confirm the required free action.`);
      return this.useLimitedAbility(
        "anyTimeAnyPlace",
        async () => {
          const epoch = String(this.usagePeriods.mission ?? "initial");
          const guard = (checkTurn = true) => {
            const source = anyTimeAnyPlaceSource(this.system),
              used = this.system.resourceUses?.anyTimeAnyPlace?.used ?? 0,
              combat = this.participatingCombat;
            if (
              !this.isOwner ||
              !source ||
              used > source.limit ||
              String(this.usagePeriods.mission ?? "initial") !== epoch
            )
              throw new Error(loc`The Terrain-feat source or mission changed.`);
            if (checkTurn && combat?.started && combat.combatant?.actor?.uuid !== this.uuid)
              throw new Error(loc`Take this free action during this character’s initiative.`);
          };
          guard();
          const feat = await pack.getDocument(input.featId);
          guard();
          const data = anyTimeAnyPlacePlan(this.system, [...this.items], feat, { epoch, sourceActorUuid: this.uuid }),
            eligible = this.checkPrerequisites(data.system.prerequisites, { temporary: true });
          if (!eligible.ok)
            throw new Error(loc`Temporary Terrain feat prerequisites not met: ${eligible.unmet.join("; ")}.`);
          let created;
          try {
            [created] = await this.createEmbeddedDocuments("Item", [data]);
            if (!created) throw new Error(loc`Temporary Terrain feat creation failed.`);
            guard(false);
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Any Time, Any Place: free action; gained ${foundry.utils.escapeHTML(created.name)} until the end of this mission. One mission use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "temporaryFeat",
                  ability: "anyTimeAnyPlace",
                  mission: epoch,
                  featUuid: created.uuid,
                  actionDiceAllowed: false
                }
              }
            });
            return created;
          } catch (error) {
            if (created)
              try {
                await this.deleteEmbeddedDocuments("Item", [created.id]);
              } catch (cleanupError) {
                ui.notifications.warn(
                  loc`The temporary Terrain feat remains after cleanup failed. Its mission use remains spent; review the existing feat before retrying.`
                );
                return created;
              }
            throw error;
          }
        },
        { workflow: "selfTerrainFeat" }
      );
    }

    get attributeRuleContext() {
      return {
        worldTime: globalThis.game?.time?.worldTime ?? this.system.worldTime,
        mentalLeapCombats: this.system.mentalLeapCombats ?? {},
        conditionContext: this.system.conditionContext ?? {},
        mentalLeapState: this.system.mentalLeapState
      };
    }

    mentalLeapCombatContext(combat = this.participatingCombat) {
      if (!combat) return null;
      const own = combat.turns?.find(c => c.actor?.uuid === this.uuid);
      return {
        id: combat.id,
        started: combat.started,
        round: combat.round,
        turn: combat.turn,
        combatantId: own?.id,
        ownTurnIndex: combat.turns?.findIndex(c => c.id === own?.id) ?? -1
      };
    }

    async activateMentalLeap(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!mentalLeapSource(this.system)) return refuse(loc`Mental Leap has not been earned.`);
      let input = options;
      if (!input.ability) {
        input = await systemDialog.input({
          window: { title: loc`Mental Leap` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Add your current starting action-die count (${this.system.actionDice.max}) to one attribute for ten rounds. When it ends, exhaustion lasts twice the active rounds. Ending during the activation initiative counts as one round and two exhausted rounds. Existing unnamed Mental Leap bonuses may overlap; repeated exhaustion causes unconsciousness.`}</p><label>${loc`Attribute`} <select name="ability"><option value="dex">${loc`Dexterity`}</option><option value="int">${loc`Intelligence`}</option><option value="wis">${loc`Wisdom`}</option></select></label><label><input name="confirmed" type="checkbox" /> ${loc`I activate Mental Leap now (during my initiative if in combat)`}</label></div>`
        });
        if (!input) return null;
      }
      if (input.confirmed !== true) return refuse(loc`Confirm Mental Leap activation.`);
      return this.useLimitedAbility(
        "mentalLeap",
        async () => {
          const incapacity = attributeActionBlock(this.system, { kind: "mentalAbility" });
          if (incapacity) throw new Error(loc`This character cannot currently activate Mental Leap: ${incapacity}`);
          const session = String(this.usagePeriods.session ?? "initial"),
            before = foundry.utils.deepClone(this.system.mentalLeaps ?? []),
            source = mentalLeapSource(this.system),
            record = mentalLeapRecord(
              { ...this.system, ...this.attributeRuleContext },
              { id: foundry.utils.randomID(), ability: input.ability, combat: this.mentalLeapCombatContext() }
            );
          const guard = () => {
            const now = mentalLeapSource(this.system);
            if (
              !this.isOwner ||
              !now ||
              (this.system.resourceUses?.mentalLeap?.used ?? 0) > now.limit ||
              String(this.usagePeriods.session ?? "initial") !== session
            )
              throw new Error(loc`Mental Leap source, allowance or session changed.`);
          };
          guard();
          try {
            await this.update({ "system.mentalLeaps": [...before, record] });
            guard();
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Mental Leap: +${record.bonus} ${record.ability.toUpperCase()} for ten rounds, followed by twenty rounds exhausted unless ended earlier. One session use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "mentalLeap",
                  recordId: record.id,
                  session,
                  ability: record.ability,
                  bonus: record.bonus,
                  actionDiceAllowed: false
                }
              }
            });
            guard();
            return record;
          } catch (error) {
            try {
              await this.update({ "system.mentalLeaps": before });
            } catch (rollbackError) {
              ui.notifications.warn(
                loc`Mental Leap may remain after rollback failed. Its use remains spent; review the effect before trying again.`
              );
              return record;
            }
            throw error;
          }
        },
        { workflow: "mentalLeap" }
      );
    }

    async endMentalLeap(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const active = (this.system.mentalLeapState?.rows ?? []).filter(r => r.phase === "boost"),
        esc = foundry.utils.escapeHTML;
      if (!active.length) return refuse(loc`No Mental Leap is currently active.`);
      if (input.freeActionConfirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`End Mental Leap` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`Active benefit`} <select name="id">${active.map(r => `<option value="${esc(r.id)}" ${r.id === options.id ? "selected" : ""}>${loc`${r.ability.toUpperCase()} +${r.bonus}; ${Math.ceil(r.remainingSeconds / 6)} round(s) remain`}</option>`).join("")}</select></label><label><input name="freeActionConfirmed" type="checkbox" /> ${loc`I end this effect as a free action during my initiative (if in combat)`}</label><p>${loc`At least one active round counts, even if you end it during its activation initiative. Exhaustion follows immediately for twice the active rounds.`}</p></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        const incapacity =
          restraintActionBlock(this.system, { free: true }) ||
          attributeActionBlock(this.system, { kind: "mentalAbility" });
        if (incapacity) throw new Error(incapacity);
        const before = foundry.utils.deepClone(this.system.mentalLeaps ?? []),
          index = before.findIndex(r => r.id === input.id);
        if (index < 0) throw new Error(loc`This Mental Leap record is unavailable.`);
        const ended = endMentalLeapPlan({ ...this.system, ...this.attributeRuleContext }, before[index], {
            ...input,
            combat: this.mentalLeapCombatContext()
          }),
          next = [...before];
        next[index] = ended;
        try {
          await this.update({ "system.mentalLeaps": next });
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Mental Leap ended as a free action after ${ended.ended.rounds} active round(s). Exhausted for ${2 * ended.ended.rounds} rounds; the session use stays spent.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "mentalLeapEnd",
                recordId: ended.id,
                activeRounds: ended.ended.rounds,
                exhaustionRounds: 2 * ended.ended.rounds,
                actionDiceAllowed: false
              }
            }
          });
          return ended;
        } catch (error) {
          await this.update({ "system.mentalLeaps": before });
          throw error;
        }
      });
    }

    async detachMentalLeapCombat(combat) {
      if (
        this.type !== "agent" ||
        !this.isOwner ||
        !(this.system.mentalLeaps ?? []).some(r => r.combatId === combat.id && !r.detached)
      )
        return null;
      return queueResources([this], async () => {
        const current = foundry.utils.deepClone(this.system.mentalLeaps ?? []),
          context = this.mentalLeapCombatContext(combat),
          next = current.map(r => detachMentalLeapPlan({ ...this.system, ...this.attributeRuleContext }, r, context));
        await this.update({ "system.mentalLeaps": next });
        return next;
      });
    }

    async recordAdrenalineWoundLoss(options = {}) {
      if (this.type !== "agent" || !this.isOwner || !game.user?.isGM)
        throw new Error(loc`The GC records an owned Stuntman’s final wound-loss event.`);
      const state = () =>
          JSON.stringify({
            wounds: this.system.wounds.value,
            level: this.system.level,
            source: adrenalineSource(this.system),
            bold: this.system.activeFeatNames?.includes("Fortune Favors the Bold") === true,
            periods: this.usagePeriods,
            counter: this.system.resourceUses?.adrenalineJunkie ?? null
          }),
        expected = state();
      if (!adrenalineSource(this.system))
        throw new Error(loc`This character does not have the Adrenaline Junkie core ability.`);
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Adrenaline Junkie — record wound loss` },
          rejectClose: false,
          content: `<p>${loc`Record one event after the GC resolves defenses and determines final wound loss. This subtracts that wound loss and grants at most one bonus die for an eligible event, within the session limit. It does not resolve damage defenses, critical injuries or death.`}</p><label>${loc`Unique attack/fall/damage-event reference`} <input name="eventRef" required /></label><label>${loc`Final wound loss`} <input type="number" min="1" step="1" name="loss" value="1" /></label><label>${loc`Cause`} <select name="cause"><option value="attack">${loc`Attack`}</option><option value="fall">${loc`Falling damage`}</option><option value="explosion">${loc`Explosive damage`}</option><option value="other">${loc`Other wound loss`}</option></select></label><label><input type="checkbox" name="opponentAttack" /> ${loc`Attack: made by an opponent`}</label><label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms this single event and final wound loss have not already been applied`}</label>`
        });
        if (!input) return null;
        input = {
          ...input,
          loss:
            typeof input.loss === "number"
              ? input.loss
              : typeof input.loss === "string" && input.loss.trim()
                ? Number(input.loss)
                : NaN,
          opponentAttack: input.opponentAttack === true
        };
      }
      const key = woundEventKey(input.eventRef);
      return queueResources([this], async () => {
        if (!game.user?.isGM) throw new Error(loc`Only the GC may record this wound loss.`);
        if (input.confirmed !== true) throw new Error(loc`Confirm the actual wound-loss event.`);
        const existing = recordedWoundEvent(this.flags?.spycraft2?.woundEvents?.[key], {
          ...input,
          opponentAttack: input.opponentAttack ?? false,
          actorUuid: this.uuid
        });
        if (existing) {
          ui.notifications.info?.(loc`This wound event was already recorded; no new wound loss or dice were applied.`);
          return existing;
        }
        if (state() !== expected)
          throw new Error(loc`Wounds, source, allowance or usage period changed. Review the actual event again.`);
        const spec = adrenalineSource(this.system),
          status = resourceStatus(spec, this.system.resourceUses, this.usagePeriods),
          id = foundry.utils.randomID(),
          plan = adrenalineWoundPlan({ ...this.system, ...this.attributeRuleContext }, input, {
            actorUuid: this.uuid,
            id,
            careerDie: CONFIG.SPYCRAFT.tables.levels[this.system.level ?? 0]?.actionDie,
            periods: this.usagePeriods,
            status
          }),
          path = "flags.spycraft2.woundEvents." + key;
        const patch = {
          "system.wounds.value": plan.record.afterWounds,
          [path]: plan.record,
          ...(plan.pool
            ? { ["system.bonusActionDice." + id]: plan.pool, "system.resourceUses.adrenalineJunkie": plan.counter }
            : {})
        };
        try {
          await this.update(patch);
        } catch (error) {
          const saved = this.flags?.spycraft2?.woundEvents?.[key];
          if (JSON.stringify(saved) !== JSON.stringify(plan.record)) throw error;
        }
        try {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Wound-loss event ${foundry.utils.escapeHTML(input.eventRef)}: lose ${plan.record.loss} wounds (${plan.record.beforeWounds} → ${plan.record.afterWounds}). ${plan.record.granted ? loc`Adrenaline Junkie: gain ${plan.record.units} bonus d${plan.record.die}, expiring at scene end; session grants ${plan.record.usedAfter}/${plan.record.limit}.` : loc`No Adrenaline die granted: ineligible cause or session limit reached.`} Resolve any critical injury/death consequences with the GC.`,
            flags: {
              spycraft2: { actorUuid: this.uuid, checkKind: "woundLoss", woundEventKey: key, actionDiceAllowed: false }
            }
          });
        } catch (error) {
          if (
            ![...(game.messages ?? [])].some(
              m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags.spycraft2.woundEventKey === key
            )
          )
            ui.notifications.warn(
              loc`The wound loss and any Adrenaline die are already recorded; the chat receipt failed. Do not apply the event again.`
            );
        }
        return plan.record;
      });
    }

    async useStrut(message, options = {}) {
      if (this.type !== "agent" || !this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) throw new Error(loc`The GC resolves secret Strut results.`);
      const expected = rollEvidence(message.flags.spycraft2),
        combat = this.mentalLeapCombatContext(),
        signature = JSON.stringify(combat),
        careerDie = CONFIG.SPYCRAFT.tables.levels[this.system.level ?? 0]?.actionDie ?? 4;
      const plan = confirmed =>
        strutGainPlan(this.actionDiceFundingSystem, message.flags.spycraft2, {
          actorUuid: this.uuid,
          messageUuid: message.uuid ?? message.id,
          combat: this.mentalLeapCombatContext(),
          careerDie,
          nextHalfActionConfirmed: confirmed
        });
      plan(true);
      let input = options;
      if (input.nextHalfActionConfirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Strut — next half action` },
          rejectClose: false,
          content: `<p>${loc`Gain one default-type bonus action die, improved by Fortune Favors the Bold if applicable. Unspent dice expire at combat end, without award XP.`}</p><label><input type="checkbox" name="nextHalfActionConfirmed" /> ${loc`The GC confirms that my next half action after this attack was spent posturing`}</label>`
        });
        if (!input) return null;
      }
      return queueResources(
        [this],
        async () => {
          if (
            rollEvidence(message.flags.spycraft2) !== expected ||
            JSON.stringify(this.mentalLeapCombatContext()) !== signature
          )
            throw new Error(loc`The attack or initiative changed. Review the current Strut action.`);
          if (message.blind && !game.user?.isGM) throw new Error(loc`The GC resolves secret Strut results.`);
          const gain = plan(input.nextHalfActionConfirmed),
            id = foundry.utils.randomID(),
            pool = strutPool(
              { ...this.actionDiceFundingSystem, worldTime: game.time?.worldTime ?? this.system.worldTime },
              gain,
              {
                id,
                messageUuid: message.uuid ?? message.id,
                combat: this.mentalLeapCombatContext(),
                periods: this.usagePeriods
              }
            ),
            path = "system.bonusActionDice." + id;
          const present = () => this.system.bonusActionDice?.[id],
            same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
          try {
            try {
              await this.update({ [path]: pool });
            } catch (error) {
              if (!same(present(), pool)) throw error;
            }
            try {
              await message.update({ "flags.spycraft2.strutPoolId": id });
            } catch (error) {
              if (message.flags?.spycraft2?.strutPoolId !== id) throw error;
            }
            return pool;
          } catch (error) {
            if (message.flags?.spycraft2?.strutPoolId === id && same(present(), pool)) return pool;
            if (!present()) throw error;
            let rollback;
            if (same(present(), pool))
              try {
                await this.update({ ["system.bonusActionDice.-=" + id]: null });
              } catch (e) {
                if (present()) rollback = e;
              }
            else rollback = new Error(loc`The Strut grant changed during restoration.`);
            if (rollback) {
              try {
                await this.update({ [path + ".needsReview"]: true });
              } catch {}
              await this.markActionDiceSettlementReview(
                {
                  count: pool.granted,
                  balance: pool.granted,
                  paymentPath: path + ".remaining",
                  bonusPoolId: id,
                  die: pool.die,
                  label: loc`Strut`,
                  poolFingerprint: actionDicePoolFingerprint(pool)
                },
                rollback,
                { purpose: "Strut grant", grantReview: true, messageUuid: message.uuid ?? message.id }
              );
              throw new AggregateError([error, rollback], loc`The Strut grant needs GC review.`);
            }
            throw error;
          }
        },
        { messages: [message] }
      );
    }

    async activateMasterPlan(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const initial = masterPlanGainPlan(this.system),
        periods = this.usagePeriods,
        expected = JSON.stringify(["scene", "session", "mission"].map(k => String(periods[k] ?? "initial")));
      let input = options;
      if (input.freeActionConfirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Master Plan` },
          rejectClose: false,
          content: `<p>${loc`Gain ${initial.units} bonus d${initial.die} action dice as a free action, once per mission. Unused dice expire at the end of this scene. Current Intelligence modifier ${initial.intelligenceModifier} is frozen when granted.`}</p><label><input name="freeActionConfirmed" type="checkbox" /> ${loc`The GC confirms this free action may be taken now`}</label>`
        });
        if (!input) return null;
      }
      if (input.freeActionConfirmed !== true) return refuse(loc`Confirm the Master Plan free action.`);
      return this.useLimitedAbility(
        "masterPlan",
        async () => {
          const blocked =
            restraintActionBlock(this.system, { free: true }) ||
            attributeActionBlock(this.system, { kind: "mentalAbility" });
          if (blocked) throw new Error(blocked);
          const combat = this.participatingCombat;
          if (combat?.started && combat.combatant?.actor?.uuid !== this.uuid)
            throw new Error(loc`Take this free action during this character’s initiative.`);
          if (
            JSON.stringify(["scene", "session", "mission"].map(k => String(this.usagePeriods[k] ?? "initial"))) !==
            expected
          )
            throw new Error(loc`The scene, session or mission changed while confirming Master Plan.`);
          const gain = masterPlanGainPlan(this.system);
          if (gain.intelligenceModifier !== initial.intelligenceModifier || gain.die !== initial.die)
            throw new Error(
              loc`The Intelligence modifier or gained die type changed; confirm the current Master Plan benefit.`
            );
          const id = foundry.utils.randomID(),
            pool = masterPlanPool({ ...this.system, ...this.attributeRuleContext }, gain, {
              id,
              periods: this.usagePeriods
            });
          let message;
          try {
            await this.update({ ["system.bonusActionDice." + id]: pool });
            message = await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Master Plan: ${pool.granted} bonus d${pool.die} action dice; unused dice are lost at scene end. Free action; one mission use.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "masterPlan",
                  masterPlanPoolId: id,
                  actionDiceAllowed: false
                }
              }
            });
            return pool;
          } catch (error) {
            const receipt =
              message ??
              [...(game.messages ?? [])].find(
                m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags?.spycraft2?.masterPlanPoolId === id
              );
            let cleanupError;
            if (receipt)
              try {
                await receipt.delete();
              } catch (failure) {
                cleanupError = failure;
              }
            if (!cleanupError && this.system.bonusActionDice?.[id]) {
              const current = this.system.bonusActionDice[id];
              if (current.remaining !== pool.granted)
                cleanupError = new Error(loc`The granted dice changed; preserve their use for review.`);
              else
                try {
                  await this.update({ ["system.bonusActionDice.-=" + id]: null });
                } catch (failure) {
                  if (this.system.bonusActionDice?.[id]) cleanupError = failure;
                }
            }
            if (cleanupError) {
              try {
                if (this.system.bonusActionDice?.[id])
                  await this.update({ ["system.bonusActionDice." + id + ".needsReview"]: true });
              } catch {}
              if (this.system.bonusActionDice?.[id])
                await this.markActionDiceSettlementReview(
                  {
                    count: 0,
                    balance: this.system.bonusActionDice[id].remaining,
                    paymentPath: "system.bonusActionDice." + id + ".remaining",
                    bonusPoolId: id,
                    die: pool.die,
                    label: pool.label,
                    poolFingerprint: actionDicePoolFingerprint(this.system.bonusActionDice[id])
                  },
                  cleanupError,
                  { purpose: "Master Plan grant", grantReview: true }
                );
              else
                ui.notifications.warn(
                  loc`Master Plan could not be fully restored. Its mission use remains spent; ask the GC to review the grant and receipt.`
                );
              return { ...pool, needsReview: true };
            }
            throw error;
          }
        },
        { workflow: "masterPlan" }
      );
    }

    async summonClassAssistants(sourceId, options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const source = assistantSource(this.system, sourceId);
      if (!source) return refuse(loc`This assistant option has not been earned.`);
      let input = options;
      const esc = foundry.utils.escapeHTML;
      if (!input.city) {
        input = await systemDialog.input({
          window: { title: source.name },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Summon ${this.system.actionDice.max} Tier II ${esc(source.template)} assistants until the end of the following scene. This records the group; the GC supplies its NPCs and adjudicates their help. No action die is spent.`}</p><label>${loc`Current city`} <input name="city" type="text" /></label><label>${loc`City population`} <input name="population" type="number" min="10000" step="1" /></label><label><input name="quickContactConfirmed" type="checkbox" /> ${loc`A method of quick contact is available`}</label><label><input name="nonCombatConfirmed" type="checkbox" /> ${loc`The requested help is non-combat work within their skills/equipment`}</label><label><input name="gcHelpApproved" type="checkbox" /> ${loc`The GC approved this assistance`}</label>${source.kitGrade ? `<p>${loc`For required-kit skill checks while helping, these standard NPCs are assumed to possess one appropriate grade I kit.`}</p>` : ""}</div>`
        });
        if (!input) return null;
        input = { ...input, population: Number(input.population) };
      }
      return this.useLimitedAbility(
        sourceId,
        async () => {
          const periods = this.usagePeriods,
            mission = String(periods.mission ?? "initial"),
            scene = String(periods.scene ?? "initial"),
            sequence = sceneSequence(periods),
            before = foundry.utils.deepClone(this.system.assistantGroups ?? []);
          const plan = assistantSummonPlan(this.system, sourceId, { ...input, groupId: foundry.utils.randomID() });
          const guard = () => {
            if (
              !this.isOwner ||
              !assistantSource(this.system, sourceId) ||
              String(this.usagePeriods.mission ?? "initial") !== mission ||
              String(this.usagePeriods.scene ?? "initial") !== scene ||
              sceneSequence(this.usagePeriods) !== sequence
            )
              throw new Error(loc`The assistant source or usage period changed.`);
          };
          guard();
          try {
            await this.update({ "system.assistantGroups": [...before, plan] });
            guard();
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`${esc(source.name)}: ${plan.count} Tier II ${esc(plan.template)} assistants in ${esc(plan.city)}; non-combat help at the GC’s discretion until the end of the following scene, subject to their withdrawal conditions.${plan.kitGrade ? loc` Required-kit checks assume one appropriate grade I kit.` : ""} One mission use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "assistantGroup",
                  source: sourceId,
                  groupId: plan.id,
                  mission,
                  scene,
                  count: plan.count,
                  tier: 2,
                  actionDiceAllowed: false
                }
              }
            });
            guard();
            return plan;
          } catch (error) {
            try {
              await this.update({ "system.assistantGroups": before });
            } catch (rollbackError) {
              ui.notifications.warn(
                loc`The assistant group may remain after rollback failed. Its mission use remains spent; review the group before trying again.`
              );
              return plan;
            }
            throw error;
          }
        },
        { workflow: "summonAssistants" }
      );
    }

    async withdrawClassAssistants(groupId, options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const group = (this.system.assistantGroups ?? []).find(g => g.id === groupId);
      if (!group || !assistantGroupStatus(this.system, group).active)
        return refuse(loc`This assistant group is not active.`);
      let input = options;
      const police = group.source === "friendsOnForce";
      if (!input.event) {
        input = await systemDialog.input({
          window: { title: loc`Assistant group withdrawal` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`The entire group leaves when any one member meets a stated withdrawal condition.`}</p><label>${loc`Condition`} <select name="event"><option value="failedMorale">${loc`Failed Morale check`}</option><option value="criticalInjury">${loc`Critical injury`}</option>${police ? `<option value="vitalityLoss">${loc`Lost more than half maximum vitality (rounded down)`}</option><option value="woundLoss">${loc`Lost at least one wound point`}</option>` : `<option value="failedDamageSave">${loc`Failed Damage save`}</option>`}</select></label>${police ? `<label>${loc`Officer maximum vitality`} <input name="maxVitality" type="number" min="1" step="1" value="1" /></label><label>${loc`Total vitality lost by that officer`} <input name="vitalityLost" type="number" min="0" step="1" value="0" /></label><label>${loc`Wounds lost by that officer`} <input name="woundsLost" type="number" min="0" step="1" value="0" /></label>` : ""}<label><input name="confirmed" type="checkbox" /> ${loc`The GC confirmed at least one member met this condition`}</label></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          ...(police
            ? {
                maxVitality: Number(input.maxVitality),
                vitalityLost: Number(input.vitalityLost),
                woundsLost: Number(input.woundsLost)
              }
            : {})
        };
      }
      return queueResources([this], async () => {
        if (!this.isOwner) throw new Error(loc`Ownership changed before group withdrawal.`);
        const before = foundry.utils.deepClone(this.system.assistantGroups ?? []),
          index = before.findIndex(g => g.id === groupId),
          next = assistantWithdrawalPlan(this.system, before[index], input),
          groups = [...before];
        groups[index] = next;
        try {
          await this.update({ "system.assistantGroups": groups });
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`${foundry.utils.escapeHTML(next.name)}: the entire group withdraws. ${foundry.utils.escapeHTML(next.withdrawal.reason)} Its spent mission use is unchanged.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "assistantWithdrawal",
                groupId,
                event: input.event,
                actionDiceAllowed: false
              }
            }
          });
          return next;
        } catch (error) {
          await this.update({ "system.assistantGroups": before });
          throw error;
        }
      });
    }

    async spendDeferredSkillPoints(key, options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const pools = deferredSkillPools(this.system, [...this.items]);
      if (!pools || !Object.hasOwn(CONFIG.SPYCRAFT.skills, key))
        return refuse(loc`I Can Swim is not available for this skill.`);
      const level = pools.level,
        esc = foundry.utils.escapeHTML;
      let input = options;
      if (input.points === undefined && input.trainingPoints === undefined) {
        input = await systemDialog.input({
          window: { title: loc`I Can Swim — ${CONFIG.SPYCRAFT.skills[key].name}` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Before this skill check, spend current-level points only in ${esc(CONFIG.SPYCRAFT.skills[key].name)}. Class/cross-class costs, discounts, linked ranks and rank limits apply normally. Training costs one point per rank. Allocated ranks remain purchased even if the following check is cancelled.`}</p><label>${loc`Career-level ${level} points (${pools.careerPoints} available)`} <input name="points" type="number" min="0" max="${pools.careerPoints}" step="1" value="0" /></label>${pools.training.map(p => `<label>${loc`Training ${esc(p.id)} (${p.remaining} available)`} <input name="training_${esc(p.id)}" type="number" min="0" max="${p.remaining}" step="1" value="0" /></label>`).join("")}<label><input type="checkbox" name="freeActionConfirmed" /> ${loc`I spend the free action before this skill check (during my initiative if in combat)`}</label></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          points: Number(input.points),
          trainingPoints: Object.fromEntries(pools.training.map(p => [p.id, Number(input[`training_${p.id}`] ?? 0)])),
          beforeSkillCheckConfirmed: options.beforeSkillCheckConfirmed
        };
      }
      return queueResources([this], async () => {
        if (!this.isOwner) throw new Error(loc`Ownership changed before this purchase.`);
        const combat = this.participatingCombat;
        if (combat?.started && combat.combatant?.actor?.uuid !== this.uuid)
          throw new Error(loc`Take this free action during this character’s initiative.`);
        const current = this.system.toObject?.() ?? foundry.utils.deepClone(this.system);
        current.usagePeriods = this.usagePeriods;
        Object.assign(current, this.attributeRuleContext);
        const items = this.items
            .filter(i => !isResourceLock(i))
            .map(i => ({
              id: i.id,
              name: i.name,
              type: i.type,
              system: i.system.toObject?.() ?? foundry.utils.deepClone(i.system)
            })),
          plan = deferredSkillPlan(
            {
              ...current,
              abilities: Object.fromEntries(
                Object.entries(this.system.abilities).map(([key, value]) => [key, { ...value }])
              ),
              activeFeatNames: this.system.activeFeatNames,
              skillPoints: this.system.skillPoints,
              skillTotals: this.system.skillTotals,
              skillPurchaseIssues: this.system.skillPurchaseIssues,
              featStatus: this.system.featStatus,
              level: this.system.level
            },
            items,
            CONFIG.SPYCRAFT,
            key,
            { ...input, level }
          ),
          previous = foundry.utils.deepClone(this.system.progression),
          restore = plan.updates.map(u => ({
            _id: u._id,
            "system.trainingSkills": foundry.utils.deepClone(this.items.get(u._id).system.trainingSkills)
          }));
        const epoch = String(this.usagePeriods.mission ?? "initial"),
          session = String(this.usagePeriods.session ?? "initial"),
          guard = () => {
            if (
              this.system.level !== level ||
              !this.system.activeFeatNames.includes("I Can Swim") ||
              String(this.usagePeriods.mission ?? "initial") !== epoch ||
              String(this.usagePeriods.session ?? "initial") !== session ||
              plan.updates.some(u => !this.system.featStatus?.[u._id]?.ok)
            )
              throw new Error(loc`The level, period or deferred skill source changed during the purchase.`);
          };
        try {
          if (plan.updates.length) await this.updateEmbeddedDocuments("Item", plan.updates);
          if (plan.points) await this.update({ "system.progression": plan.progression });
          guard();
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`I Can Swim: free action before ${esc(CONFIG.SPYCRAFT.skills[key].name)}; spent ${plan.totalPoints} saved skill point(s) for ${plan.ranks} rank(s). No action die spent.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "skillPurchase",
                source: "iCanSwim",
                skillKey: key,
                careerLevel: level,
                careerPoints: plan.points,
                trainingPoints: plan.trainingPoints,
                ranks: plan.ranks,
                actionDiceAllowed: false
              }
            }
          });
          guard();
          return plan;
        } catch (error) {
          try {
            if (restore.length) await this.updateEmbeddedDocuments("Item", restore);
            if (plan.points) await this.update({ "system.progression": previous });
          } catch (rollbackError) {
            ui.notifications.warn(
              loc`The deferred purchase needs review after rollback failed. Check its skill points and ranks before rolling or trying again.`
            );
            return { review: true };
          }
          throw error;
        }
      });
    }

    async useEverydayGenius(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!everydayGeniusSource(this.system)) return refuse(loc`Everyday Genius is not currently available.`);
      const pack = game.packs?.get("spycraft2.feats");
      if (!pack) throw new Error(loc`The system feat compendium is unavailable.`);
      let input = options;
      const esc = foundry.utils.escapeHTML;
      if (!input.featId) {
        const index = await pack.getIndex({ fields: ["system.tree"] }),
          feats = index
            .filter(f => f.type === "feat" && f.system.tree === "basicSkill")
            .sort((a, b) => a.name.localeCompare(b.name));
        input = await systemDialog.input({
          window: { title: loc`Everyday Genius` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`As a full action, gain one unpossessed non-virtual Basic Skill feat until this session ends. Uses per mission equal your number of eligible Advanced Skill feats; granted Basic Skill feats do not increase this limit.`}</p><label>${loc`Basic Skill feat`} <select name="featId">${feats.map(f => `<option value="${esc(f._id)}">${esc(f.name)}</option>`).join("")}</select></label><label><input type="checkbox" name="fullActionConfirmed" /> ${loc`I spend the required full action (during my initiative if in combat)`}</label></div>`
        });
        if (!input) return null;
      }
      if (input.fullActionConfirmed !== true) return refuse(loc`Confirm the required full action.`);
      return this.useLimitedAbility(
        "everydayGenius",
        async () => {
          const mission = String(this.usagePeriods.mission ?? "initial"),
            session = String(this.usagePeriods.session ?? "initial");
          const guard = (checkTurn = true) => {
            const source = everydayGeniusSource(this.system),
              combat = this.participatingCombat;
            if (
              !this.isOwner ||
              !source ||
              (this.system.resourceUses?.everydayGenius?.used ?? 0) > source.limit ||
              String(this.usagePeriods.mission ?? "initial") !== mission ||
              String(this.usagePeriods.session ?? "initial") !== session
            )
              throw new Error(loc`Everyday Genius source, allowance or period changed.`);
            if (checkTurn && combat?.started && combat.combatant?.actor?.uuid !== this.uuid)
              throw new Error(loc`Take this full action during this character’s initiative.`);
          };
          guard();
          const feat = await pack.getDocument(input.featId);
          guard();
          const data = everydayGeniusPlan(this.system, [...this.items], feat, {
              epoch: session,
              sourceActorUuid: this.uuid
            }),
            eligible = this.checkPrerequisites(data.system.prerequisites, { temporary: true });
          if (!eligible.ok)
            throw new Error(loc`Temporary Basic Skill prerequisites not met: ${eligible.unmet.join("; ")}.`);
          let created;
          try {
            [created] = await this.createEmbeddedDocuments("Item", [data]);
            if (!created) throw new Error(loc`Temporary Basic Skill feat creation failed.`);
            guard(false);
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Everyday Genius: full action; gained ${esc(created.name)} until the end of this session. One mission use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "temporaryFeat",
                  ability: "everydayGenius",
                  mission,
                  session,
                  featUuid: created.uuid,
                  actionDiceAllowed: false
                }
              }
            });
            guard(false);
            return created;
          } catch (error) {
            if (created)
              try {
                await this.deleteEmbeddedDocuments("Item", [created.id]);
              } catch (cleanupError) {
                ui.notifications.warn(
                  loc`The temporary Basic Skill feat remains after cleanup failed. Its mission use remains spent; review the existing feat before retrying.`
                );
                return created;
              }
            throw error;
          }
        },
        { workflow: "sessionBasicFeat" }
      );
    }

    async useRenaissanceMan(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const pack = game.packs?.get("spycraft2.feats");
      if (!pack) throw new Error(loc`The system feat compendium is unavailable.`);
      let input = options;
      if (!input.featId) {
        const index = await pack.getIndex({ fields: ["system.tree"] }),
          esc = foundry.utils.escapeHTML;
        const choices = index
          .filter(i => i.type === "feat" && i.system.tree === "basicSkill")
          .sort((a, b) => a.name.localeCompare(b.name));
        input = await systemDialog.input({
          window: { title: loc`Renaissance Man` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Gain one temporary Basic Skill feat until this mission ends. Choose a feat you do not already possess. It supplies no permanent feat slot or permanent prerequisite qualification.`}</p><label>${loc`Feat`} <select name="featId">${choices.map(i => `<option value="${esc(i._id)}">${esc(i.name)}</option>`).join("")}</select></label><label><input type="checkbox" name="freeActionConfirmed" /> ${loc`I spend the required free action`}</label></div>`
        });
        if (!input) return null;
      }
      if (!input.freeActionConfirmed) return refuse(loc`Confirm the required free action.`);
      return this.useLimitedAbility(
        "renaissanceMan",
        async () => {
          const feat = await pack.getDocument(input.featId),
            epoch = String(this.usagePeriods.mission ?? "initial");
          const data = renaissanceManPlan(this.system, this.items, feat, { epoch, sourceActorUuid: this.uuid });
          const eligible = this.checkPrerequisites(data.system.prerequisites, { temporary: true });
          if (!eligible.ok)
            throw new Error(loc`This temporary feat's prerequisites are not met: ${eligible.unmet.join("; ")}.`);
          let created;
          try {
            [created] = await this.createEmbeddedDocuments("Item", [data]);
            if (!created) throw new Error(loc`The temporary feat was not created.`);
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Renaissance Man: free action; gained ${foundry.utils.escapeHTML(created.name)} until the end of this mission.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "temporaryFeat",
                  ability: "renaissanceMan",
                  featUuid: created.uuid,
                  mission: epoch,
                  actionDiceAllowed: false
                }
              }
            });
            return created;
          } catch (error) {
            if (created)
              try {
                await this.deleteEmbeddedDocuments("Item", [created.id]);
              } catch (cleanupError) {
                ui.notifications.warn(
                  loc`The temporary feat remains after a posting/cleanup failure. Its use remains spent; review the existing feat before retrying.`
                );
                return created;
              }
            throw error;
          }
        },
        { workflow: "selfTemporaryFeat" }
      );
    }

    async shareTemporaryFeats(ability, options = {}) {
      if (!this.isOwner) throw new Error(loc`You must own the source actor.`);
      let input = options;
      const definition = SHARE_ABILITIES[ability];
      if (!definition) throw new Error(loc`Unknown sharing ability.`);
      if (!input.featIds) {
        const esc = foundry.utils.escapeHTML;
        const eligible = this.items.filter(
          item =>
            item.type === "feat" &&
            item.system.tree === definition.tree &&
            !["temporary", "virtual"].includes(item.system.featKind) &&
            this.system.featStatus?.[item.id]?.ok
        );
        const recipients = [...game.actors].filter(
          actor => actor.type === "agent" && actor.id !== this.id && actor.isOwner
        );
        input = await systemDialog.input({
          window: { title: loc`${definition.name}: share temporary feats` },
          rejectClose: false,
          content: `
        <p>${loc`Choose up to ${this.system.actionDice.max} owned ${definition.tree} feats at session start. Recipients must meet the prerequisites to benefit. A GC can apply this to teammates owned by other players.`}</p>
        ${eligible.map(item => `<label><input type="checkbox" name="feat_${item.id}" /> ${esc(item.name)}</label>`).join("")}
        <h4>${loc`Teammates`}</h4>${recipients.map(actor => `<label><input type="checkbox" name="recipient_${actor.id}" /> ${esc(actor.name)}</label>`).join("")}
        <label><input type="checkbox" name="atSessionStart" /> ${loc`This selection is being made at the start of the session`}</label>`
        });
        if (!input) return null;
        input.featIds = eligible.filter(item => input[`feat_${item.id}`]).map(item => item.id);
        input.recipients = recipients.filter(actor => input[`recipient_${actor.id}`]);
      }
      const work = async () => {
        const epoch = String(this.usagePeriods.session ?? "initial");
        const data = temporarySharePlan(this.system, this.items, ability, input.featIds, {
          epoch,
          atSessionStart: !!input.atSessionStart,
          sourceActorUuid: this.uuid
        });
        const recipients = [...new Set(input.recipients ?? [])];
        if (!recipients.length || recipients.some(actor => actor === this || actor.type !== "agent" || !actor.isOwner))
          throw new Error(loc`Choose teammates you can update; ask the GC to apply sharing for other players.`);
        const created = [];
        try {
          for (const actor of recipients) {
            const recipientData = structuredClone(data);
            for (const feat of recipientData) feat.system.acquiredAtLevel = Math.max(1, actor.system?.level ?? 1);
            const docs = await actor.createEmbeddedDocuments("Item", recipientData);
            created.push({ actor, ids: docs.map(doc => doc.id) });
          }
          if (String(this.usagePeriods.session ?? "initial") !== epoch)
            throw new Error(loc`The session changed during sharing; repeat the selection.`);
          await this.update({
            "system.temporaryShares": {
              ...this.system.temporaryShares,
              [ability]: { epoch, featIds: [...input.featIds], recipients: recipients.map(actor => actor.uuid) }
            }
          });
          return created;
        } catch (error) {
          for (const entry of created.reverse()) await entry.actor.deleteEmbeddedDocuments("Item", entry.ids);
          throw error;
        }
      };
      return queueResources([this], work);
    }
  };
