/** What happens to a check after it is posted: boosts, confirmation, criticals, rerolls and resolution. */
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { validateAttributeDamageProof } from "../../rules/attribute-damage.mjs";
import { withJinxReservation } from "../../apps/jinx.mjs";
import { jinxCostPlan } from "../../rules/jinx.mjs";
import { cleaveLegacyTargetEligible } from "../../rules/cleave.mjs";
import { validateDamageSaveRoll } from "../../rules/damage-saves.mjs";
import {
  surchargeFundingInput,
  splitSurchargeFundingControl,
  unrolledPaymentFundingInput
} from "../../apps/action-die-benefits.mjs";
import { boostPaymentQuote, paidBoostSurcharge, generousSurchargeQuote } from "../../rules/boost-payments.mjs";
import { applyPaidCheckBoost } from "../../apps/paid-check-boost.mjs";
import { getActionDieSettlementReview } from "../../rules/action-die-payments.mjs";
import { shakenRules } from "../../rules/shaken.mjs";
import { brightIdeaPoolStatus, brightIdeaMigrationPlan } from "../../rules/bright-idea.mjs";
import { hintSources, hintResponsePlan } from "../../rules/hints.mjs";
import {
  actionDiceFundingContext,
  actionDicePoolFingerprint,
  unrestrictedBonusPools,
  bonusPoolForCheck,
  checkBonusBoostPlan,
  availableCheckBonusPools,
  hardKnocksGainPlan,
  transferableCheckBonusPool
} from "../../rules/bonus-pools.mjs";
import {
  automaticSkillSuccessSources,
  automaticSkillSuccessPlan,
  manualAdjustmentPlan,
  cunningPlanCheck
} from "../../rules/class-checks.mjs";
import { queueResources } from "../../rules/transactions.mjs";
import { finishGearAcquisition } from "../../apps/gear-acquisition.mjs";
import { gcDiceStatus, spendGCDice, gcDiceController, refreshGCDiceTransaction } from "../../rules/gc-dice.mjs";
import { criticalPlan } from "../../rules/criticals.mjs";
import {
  checkCandidates,
  errorDecisionPending,
  adjudicateCheck,
  checkFlavor,
  rollEvidence
} from "../../rules/outcomes.mjs";
import { rerollEligibility } from "../../rules/limited-uses.mjs";
import { actionDieBoostPlan, actionDieBoostResult, generousBoostPlan } from "../../rules/action-dice.mjs";
import { loc } from "../../i18n.mjs";

export const ActorOutcomes = Base =>
  class ActorOutcomes extends Base {
    /** Spend action dice on a recorded result, preserving the original roll and its cap. */
    boostCheck(message, options = {}) {
      const work = async () => {
        if (!this.isOwner) return ui.notifications.warn(loc`You must own the actor spending action dice.`);
        let check = message.flags?.spycraft2;
        if (!check || check.actorUuid !== this.uuid)
          return ui.notifications.warn(loc`Choose a recorded roll made by this actor.`);
        if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
        const expected = rollEvidence(check);
        const currentShaken = shakenRules(this.actionDiceFundingSystem);
        if (currentShaken.needsReview || currentShaken.spendingForbidden)
          return ui.notifications.warn(
            currentShaken.needsReview
              ? loc`Review the current Shaken sources before boosting.`
              : loc`Shaken IV: no action dice may be spent at all (p.342).`
          );
        let input = options;
        if (!Object.keys(input).length || input.askOptions) {
          const pools = availableCheckBonusPools(this.system, message, this.usagePeriods),
            esc = foundry.utils.escapeHTML;
          input = await systemDialog.input({
            window: { title: loc`Boost result before its outcome is described` },
            rejectClose: false,
            content: `<div class="spycraft2-roll-options">
          <label>${loc`Funding`} <select name="bonusPoolId"><option value="" ${!input.bonusPoolId ? "selected" : ""} ${check.actionDiceAllowed === false ? "disabled" : ""}>${loc`Ordinary action dice`}</option>${pools.map(pool => `<option value="${pool.id}" ${input.bonusPoolId === pool.id ? "selected" : ""}>${esc(pool.label)}: ${pool.remaining} d${pool.die}${pool.unrestricted ? ", until scene end" : ", this check only"}</option>`).join("")}</select></label>
          ${
            currentShaken.extraDice
              ? `<p>${loc`Shaken surcharge: ${Math.max(0, currentShaken.extraDice - paidBoostSurcharge(this, message))} extra action dice for this check. Surcharge dice do not add to the result; later boosts of this check pay only any remaining surcharge.`}</p><label>${loc`Surcharge funding`} <select name="surchargeBonusPoolId"><option value="same">${loc`Boost source if unrestricted, otherwise ordinary dice`}</option><option value="">${loc`Ordinary action dice`}</option>${unrestrictedBonusPools(
                  this.actionDiceFundingSystem,
                  this.usagePeriods
                )
                  .filter(p => p.available)
                  .map(p => `<option value="${esc(p.id)}">${esc(p.label)}: ${p.available} d${p.die}</option>`)
                  .join(
                    ""
                  )}</select></label>${currentShaken.extraDice > paidBoostSurcharge(this, message) ? splitSurchargeFundingControl(this) : ""}`
              : ""
          }
          <label>${loc`Boosting dice (excluding surcharge)`} <input type="number" name="count" min="1" value="1" /></label>
          <label><input type="checkbox" name="openingRound" /> ${loc`Surprise round or first standard combat round`}</label>
          ${errorDecisionPending(check) ? `<label><input type="checkbox" name="errorDeclined" /> ${loc`Opponents declined to activate this error as a critical failure`}</label>` : ""}
          <label><input type="checkbox" name="calculating" /> ${loc`Use Calculating if replacing the lowest action die improves the result`}</label></div>`
          });
          if (!input) return null;
        }
        check = message.flags?.spycraft2;
        if (input.bonusPoolId && errorDecisionPending(check) && input.errorDeclined === undefined) {
          const decision = await systemDialog.input({
            window: { title: loc`Decide the error before spending the bonus` },
            rejectClose: false,
            content: `<p>${loc`Opponents decide whether to activate this error first. Close this dialog to resolve a critical failure.`}</p><label><input type="checkbox" name="errorDeclined" /> ${loc`Opponents declined to activate the error`}</label>`
          });
          if (!decision) return null;
          input = { ...input, errorDeclined: !!decision.errorDeclined };
        }
        if (rollEvidence(check) !== expected)
          throw new Error(loc`This result changed while the boost was being prepared. Review the current result.`);
        const plan = input.bonusPoolId
          ? checkBonusBoostPlan(this.system, message, {
              ...input,
              count: Number(input.count ?? 1),
              periods: this.usagePeriods
            })
          : actionDieBoostPlan(this.system, check, { ...input, count: Number(input.count ?? 1) });
        if (plan.blocked) return ui.notifications.warn(plan.reason);
        input = { ...input, ...surchargeFundingInput(input) };
        const boostQuote =
          currentShaken.extraDice || input.surchargeAllocations !== undefined
            ? boostPaymentQuote(this, message, { ...input, count: plan.count })
            : null;
        const roll = await new Roll(plan.formula).evaluate();
        if (shakenRules(this.actionDiceFundingSystem).grade !== currentShaken.grade)
          throw new Error(loc`The Shaken grade changed while preparing this boost. Review it again.`);
        if (rollEvidence(message.flags?.spycraft2) !== expected)
          throw new Error(loc`The result changed during the action-die roll. Review it before retrying.`);
        const fresh = plan.bonusPoolId
          ? checkBonusBoostPlan(this.actionDiceFundingSystem, message, {
              ...input,
              count: plan.count,
              periods: this.usagePeriods
            })
          : actionDieBoostPlan(this.actionDiceFundingSystem, message.flags.spycraft2, { ...input, count: plan.count });
        const signature = p =>
          JSON.stringify([p.die, p.explodeAt, p.rolls, p.bonusEach, p.calculating, p.intelligence, p.wellRounded]);
        if (
          fresh.blocked ||
          signature(fresh) !== signature(plan) ||
          (plan.bonusPoolId &&
            (fresh.pool?.remaining !== plan.pool.remaining ||
              actionDicePoolFingerprint(fresh.pool) !== actionDicePoolFingerprint(plan.pool)))
        )
          throw new Error(fresh.reason || loc`The action-die source changed before payment. Review the current grant.`);
        if (boostQuote)
          return applyPaidCheckBoost(this, message, { check, expected, input, plan, roll, quote: boostQuote });
        const result = actionDieBoostResult(
            check,
            plan,
            roll.dice.map(die => die.total)
          ),
          paymentPath = plan.bonusPoolId
            ? `system.bonusActionDice.${plan.bonusPoolId}.remaining`
            : "system.actionDice.value",
          balance = plan.bonusPoolId ? plan.pool.remaining : this.system.actionDice.value;
        const payment = {
            bonusPoolId: plan.bonusPoolId ?? "",
            count: plan.count,
            balance,
            afterBalance: balance - plan.count,
            paymentPath,
            die: plan.die,
            label: plan.pool?.label ?? loc`Ordinary action dice`,
            poolFingerprint: plan.bonusPoolId ? actionDicePoolFingerprint(plan.pool) : null
          },
          paymentReceiptId =
            globalThis.foundry?.utils?.randomID?.() ??
            "boost-" + (this._boostReceiptSequence = (this._boostReceiptSequence ?? 0) + 1),
          reviewDetails = { purpose: "check boost", messageUuid: message.uuid ?? message.id };
        try {
          await this.update({ [paymentPath]: payment.afterBalance });
        } catch (error) {
          const observed = plan.bonusPoolId
            ? this.system.bonusActionDice?.[plan.bonusPoolId]?.remaining
            : this.system.actionDice.value;
          if (observed === payment.afterBalance)
            try {
              await this.refundActionDicePayment(payment);
            } catch (rollback) {
              await this.markActionDiceSettlementReview(payment, rollback, reviewDetails);
              throw new AggregateError([error, rollback], loc`The interrupted boost payment needs GC review.`);
            }
          else if (observed !== balance) await this.markActionDiceSettlementReview(payment, error, reviewDetails);
          throw error;
        }
        const next = {
          ...check,
          ...result,
          lastBoostPayment: {
            id: paymentReceiptId,
            bonusPoolId: payment.bonusPoolId,
            die: payment.die,
            count: payment.count,
            surcharge: 0,
            totalCost: payment.count,
            allocations: [{ bonusPoolId: payment.bonusPoolId, count: payment.count, scope: "boost" }]
          },
          ...(plan.bonusPoolId
            ? {
                ...(plan.bonusPoolId === check.requiredBonusPoolId
                  ? { requiredBonusSpent: balance - plan.count === 0 }
                  : {}),
                bonusBoosts: [
                  ...(check.bonusBoosts ?? []),
                  { poolId: plan.bonusPoolId, label: plan.pool.label, die: plan.die, count: plan.count }
                ]
              }
            : {}),
          lastBoostDice: roll.dice.map(die => die.total),
          successConfirmed: null,
          errorConfirmed: false,
          threatConfirmed: false,
          triumphed: false,
          flawlessSearch: null,
          automaticSkillSuccess: null,
          errorActivationDeclined: !!check.errorActivationDeclined || !!input.errorDeclined
        };
        let restoreWeapon;
        try {
          restoreWeapon = await this.syncRollErrorEffect(next, message.uuid ?? message.id);
          await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
        } catch (error) {
          if (message.flags?.spycraft2?.lastBoostPayment?.id !== paymentReceiptId) {
            try {
              await restoreWeapon?.();
            } catch (rollback) {
              await this.markActionDiceSettlementReview(payment, rollback, reviewDetails);
              throw new AggregateError([error, rollback], loc`The boosted effect needs GC review.`);
            }
            try {
              await this.refundActionDicePayment(payment);
            } catch (rollback) {
              await this.markActionDiceSettlementReview(payment, rollback, reviewDetails);
              throw new AggregateError([error, rollback], loc`The selected boost balance needs GC review.`);
            }
            throw error;
          }
        }

        try {
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: loc`Spent ${plan.count} ${plan.bonusPoolId ? "bonus " : ""}action ${plan.count === 1 ? "die" : "dice"}${plan.bonusPoolId ? ` from ${foundry.utils.escapeHTML(plan.pool.label)}` : ""}; rolled ${plan.rolls}. Added +${result.added} after modifiers${result.replaced ? loc` and Calculating` : ""}.`
          });
        } catch (error) {
          ui.notifications.warn(
            loc`The boost was applied to the original result, but its supplementary chat message could not be posted. The dice remain spent; check the original result before retrying.`
          );
        }
        return result;
      };
      return queueResources([this], work, { messages: [message] });
    }

    async boostWithGenerous(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
      const expected = rollEvidence(message.flags.spycraft2),
        expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem)),
        expectedPaid = paidBoostSurcharge(this, message);
      if (getActionDieSettlementReview(this).needsReview)
        return ui.notifications.warn(loc`Resolve this teammate’s interrupted payment before Generous.`);
      let input = options;
      if (!Object.keys(input).length) {
        const donors = [...(game.actors ?? [])].filter(
            a => a.type === "agent" && a.uuid !== this.uuid && a.isOwner && a.system.coreClassIds?.includes("pointman")
          ),
          esc = foundry.utils.escapeHTML;
        const pools = donors
          .flatMap(a =>
            unrestrictedBonusPools(a.actionDiceFundingSystem, a.usagePeriods)
              .filter(p => p.available)
              .map(
                p =>
                  `<option value="${esc(a.uuid + "|" + p.id)}">${esc(a.name)} — ${esc(p.label)} (${p.available} d${p.die})</option>`
              )
          )
          .join("");
        input = await systemDialog.input({
          window: { title: loc`Generous: one teammate action die` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">
        ${
          shakenRules(this.actionDiceFundingSystem).extraDice
            ? `<p>${loc`The receiving teammate must pay ${Math.max(0, shakenRules(this.actionDiceFundingSystem).extraDice - expectedPaid)} remaining Shaken surcharge dice. Only the Pointman's one die is rolled; the fee is once per check.`}</p>${this.actionDiceFundingControl()
                .replace('name="bonusPoolId"', 'name="surchargeBonusPoolId"')
                .replace(
                  `<label>${loc`Funding`}`,
                  `<label>${loc`Teammate surcharge funding`}`
                )}${shakenRules(this.actionDiceFundingSystem).extraDice > expectedPaid ? splitSurchargeFundingControl(this) : ""}`
            : ""
        }
        <label>${loc`Donor`} <select name="donorId">${donors.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
        <label>${loc`Funding from the donor`} <select name="funding"><option value="">${loc`Ordinary action dice`}</option>${pools}</select></label>
        <label><input type="checkbox" name="teammate" /> ${loc`Donor is a teammate`}</label>
        <label><input type="checkbox" name="perceivedAtRoll" /> ${loc`The acting character could see or hear the donor when this roll was made`}</label>
        ${errorDecisionPending(message.flags.spycraft2) ? `<label><input type="checkbox" name="errorDeclined" /> ${loc`Opponents declined error activation before this boost`}</label>` : ""}
        <label><input type="checkbox" name="calculating" /> ${loc`Use the donor’s Calculating if applicable`}</label>
        <p>${loc`Only one Generous die may benefit a roll. The donor uses their own die and modifiers. The GC can resolve donations from other players’ actors.`}</p></div>`
        });
        if (!input) return null;
      }
      const donor = input.donor ?? game.actors?.get(input.donorId);
      if (donor?.type !== "agent" || !donor.isOwner)
        return ui.notifications.warn(loc`Choose an owned donor or ask the GC to resolve the donation.`);
      let bonusPoolId = input.bonusPoolId ?? "";
      if (input.funding) {
        const [uuid, id, ...extra] = String(input.funding).split("|");
        if (uuid !== donor.uuid || !id || extra.length)
          return ui.notifications.warn(loc`Choose funding belonging to the selected donor.`);
        bonusPoolId = id;
      }
      const work = async () => {
        if (rollEvidence(message.flags.spycraft2) !== expected)
          return ui.notifications.warn(
            loc`This result changed while Generous was being prepared. Review the current result.`
          );
        if (
          JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken ||
          paidBoostSurcharge(this, message) !== expectedPaid
        )
          throw new Error(loc`The teammate’s condition or previously paid surcharge changed. Confirm Generous again.`);
        let surcharge;
        try {
          surcharge = generousSurchargeQuote(this, message, {
            ...surchargeFundingInput(input),
            surchargeBonusPoolId: input.surchargeBonusPoolId ?? ""
          });
        } catch (error) {
          return ui.notifications.warn(error.message);
        }
        let recipientPayment = null,
          donorCallbackStarted = false;
        const check = message.flags.spycraft2,
          funding = actionDiceFundingContext(donor.actionDiceFundingSystem, {
            bonusPoolId,
            periods: donor.usagePeriods
          });
        if (funding.blocked) return ui.notifications.warn(funding.reason);
        const plan = generousBoostPlan(funding.system, check, { ...input, sameActor: donor.uuid === this.uuid });
        if (plan.blocked) return ui.notifications.warn(plan.reason);
        const donate = async () => {
          const donated = await donor.payActionDiceLocked(
            1,
            async payment => {
              donorCallbackStarted = true;
              const roll = await new Roll(plan.formula).evaluate();
              if (
                JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken ||
                surcharge.payments.some(
                  p =>
                    p.bonusPoolId &&
                    actionDicePoolFingerprint(this.system.bonusActionDice?.[p.bonusPoolId]) !== p.poolFingerprint
                )
              )
                throw new Error(
                  loc`The receiving teammate’s condition or surcharge source changed during the donor roll.`
                );
              if (rollEvidence(message.flags.spycraft2) !== expected)
                throw new Error(loc`The target result changed during the donor roll. Review it before retrying.`);
              let currentFunding = {
                ...donor.actionDiceFundingSystem,
                actionDice: { ...donor.system.actionDice, value: 1 }
              };
              if (bonusPoolId) {
                const pool = donor.system.bonusActionDice?.[bonusPoolId];
                if (actionDicePoolFingerprint(pool) !== payment.poolFingerprint)
                  throw new Error(loc`The donor bonus grant changed during its roll.`);
                const fresh = actionDiceFundingContext(
                  {
                    ...donor.actionDiceFundingSystem,
                    bonusActionDice: {
                      ...donor.system.bonusActionDice,
                      [bonusPoolId]: { ...pool, remaining: pool.remaining + 1 }
                    }
                  },
                  { bonusPoolId, periods: donor.usagePeriods }
                );
                if (fresh.blocked) throw new Error(fresh.reason);
                currentFunding = fresh.system;
              }
              const stillValid = generousBoostPlan(currentFunding, message.flags.spycraft2, {
                ...input,
                sameActor: donor.uuid === this.uuid
              });
              if (
                stillValid.blocked ||
                stillValid.die !== plan.die ||
                stillValid.explodeAt !== plan.explodeAt ||
                stillValid.bonusEach !== plan.bonusEach
              )
                throw new Error(stillValid.reason ?? loc`The donor benefit changed during its roll.`);
              const dice = roll.dice.map(d => d.total),
                result = actionDieBoostResult(check, plan, dice),
                paymentReceiptId =
                  globalThis.foundry?.utils?.randomID?.() ??
                  "generous-" + (donor._generousReceiptSequence = (donor._generousReceiptSequence ?? 0) + 1);
              const next = {
                ...check,
                ...result,
                successConfirmed: null,
                errorConfirmed: false,
                threatConfirmed: false,
                triumphed: false,
                flawlessSearch: null,
                automaticSkillSuccess: null,
                errorActivationDeclined: !!check.errorActivationDeclined || !!input.errorDeclined,
                generousBoost: {
                  donorUuid: donor.uuid,
                  die: plan.die,
                  bonusEach: plan.bonusEach,
                  dice,
                  added: result.added,
                  replaced: result.replaced,
                  paymentReceiptId,
                  funding: { bonusPoolId: payment.bonusPoolId, count: 1 },
                  recipientSurcharge: {
                    paymentId: recipientPayment?.id ?? null,
                    count: surcharge.surcharge,
                    allocations: surcharge.allocations
                  }
                }
              };
              let restoreWeapon;
              try {
                restoreWeapon = await this.syncRollErrorEffect(next, message.uuid ?? message.id);
                await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
              } catch (error) {
                if (message.flags?.spycraft2?.generousBoost?.paymentReceiptId === paymentReceiptId) return result;
                try {
                  await restoreWeapon?.();
                } catch (rollback) {
                  const failure = new AggregateError([error, rollback], loc`The donated boost needs GC review.`);
                  failure.actionDiceSettlementReview = {
                    purpose: "Generous",
                    targetActorUuid: this.uuid,
                    messageUuid: message.uuid ?? message.id
                  };
                  throw failure;
                }
                throw error;
              }
              return result;
            },
            { bonusPoolId }
          );
          if (!donorCallbackStarted) throw new Error(loc`The donor payment changed before Generous.`);
          return donated;
        };
        if (!surcharge.surcharge) return donate();
        return this.payMultipartActionDiceLocked(
          surcharge.allocations,
          async payment => {
            recipientPayment = payment;
            try {
              return await donate();
            } catch (error) {
              if (getActionDieSettlementReview(donor).needsReview)
                error.actionDiceSettlementReview = {
                  ...error.actionDiceSettlementReview,
                  purpose: "Generous donor and recipient",
                  donorActorUuid: donor.uuid,
                  messageUuid: message.uuid ?? message.id
                };
              throw error;
            }
          },
          {
            message,
            purpose: "Generous receiver surcharge",
            details: {
              benefit: "checkBoost",
              boostCount: 0,
              surcharge: surcharge.surcharge,
              generousDonorUuid: donor.uuid,
              conditionGrade: surcharge.grade,
              evidenceBefore: expected
            }
          }
        );
      };
      return queueResources([this, donor], work, { messages: [message] });
    }

    /** Apply only destruction belonging to this roll; unrelated manual damage is preserved. */
    async syncRollErrorEffect(check, messageId) {
      const weapon = check.weaponUuid && typeof fromUuidSync !== "undefined" ? fromUuidSync(check.weaponUuid) : null;
      if (!weapon || !check.improvised || check.checkKind !== "attack") return null;
      const before = { destroyed: !!weapon.system.destroyed, destroyedByRoll: weapon.system.destroyedByRoll ?? "" };
      const tracks = before.destroyedByRoll === messageId,
        shouldDestroy = !!check.errorConfirmed && !check.criticalFailure;
      if (shouldDestroy && (!before.destroyed || tracks))
        await weapon.update({ "system.destroyed": true, "system.destroyedByRoll": messageId });
      else if (!shouldDestroy && tracks)
        await weapon.update({ "system.destroyed": false, "system.destroyedByRoll": "" });
      else return null;
      return () =>
        weapon.update({ "system.destroyed": before.destroyed, "system.destroyedByRoll": before.destroyedByRoll });
    }

    async useCunningPlan(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
      const expected = rollEvidence(message.flags.spycraft2);
      try {
        cunningPlanCheck(this.system, message.flags.spycraft2);
      } catch (e) {
        return ui.notifications.warn(e.message);
      }
      if (!options.freeActionConfirmed) {
        const input = await systemDialog.input({
          window: { title: loc`Cunning Plan` },
          rejectClose: false,
          content: `<p>${loc`Reduce this check’s error range by your Intelligence modifier (minimum zero). Its rolled result is retained; a negative result still operates like an error.`}</p><label><input type="checkbox" name="freeActionConfirmed" /> ${loc`I spend the required free action before this check is resolved or a critical is activated`}</label>`
        });
        if (!input?.freeActionConfirmed) return null;
      }
      return this.useLimitedAbility(
        "cunningPlan",
        async () => {
          const check = message.flags.spycraft2;
          if (rollEvidence(check) !== expected)
            throw new Error(loc`This roll changed before Cunning Plan. Review its current result.`);
          const next = cunningPlanCheck(this.system, check);
          if (typeof check.successConfirmed === "boolean")
            Object.assign(next, adjudicateCheck(next, check.successConfirmed));
          let restoreWeapon;
          try {
            restoreWeapon = await this.syncRollErrorEffect(next, message.uuid ?? message.id);
            await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
          } catch (error) {
            await restoreWeapon?.();
            throw error;
          }
          return next;
        },
        { workflow: "cunningPlan", messages: [message] }
      );
    }

    async confirmCheckOutcome(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
      const expected = rollEvidence(message.flags.spycraft2);
      let succeeded = options.succeeded,
        difficultyClass = options.difficultyClass;
      if (typeof succeeded !== "boolean") {
        const input = await systemDialog.input({
          window: { title: loc`Confirm the check's outcome` },
          rejectClose: false,
          content: `${message.flags.spycraft2.damageSave ? `<p>${loc`Recorded damage-event save DC${Number(message.flags.spycraft2.damageSave.dc)}; final result ${Number(message.flags.spycraft2.effectiveTotal)}.`}</p>` : ""}<label>${loc`GC-confirmed result`} <select name="outcome" required><option value="">${loc`Choose…`}</option><option value="success">${loc`Succeeded`}</option><option value="failure">${loc`Failed`}</option></select></label>${automaticSkillSuccessSources(this.system, message.flags.spycraft2).length > 0 ? `<label>${loc`GC-confirmed DC / final opposing result (required for a class automatic-success fallback)`} <input type="number" name="difficultyClass" step="1" /></label>` : ""}<p>${loc`A natural range is not an automatic success or failure. Negative skill, Knowledge and attack results operate like errors (pp.96–97,330).`}</p>`
        });
        if (!input) return null;
        if (!["success", "failure"].includes(input.outcome)) {
          ui.notifications.warn(loc`Choose the GC-confirmed outcome.`);
          return null;
        }
        succeeded = input.outcome === "success";
        difficultyClass = input.difficultyClass;
      }
      const work = async () => {
        const check = message.flags?.spycraft2;
        if (!Number.isFinite(check?.rawTotal)) return ui.notifications.warn(loc`Choose a recorded check result.`);
        if (check.resolved || check.superseded)
          return ui.notifications.warn(loc`This check has already been resolved or replaced.`);
        if (rollEvidence(check) !== expected)
          return ui.notifications.warn(
            loc`This roll changed while its outcome was being confirmed. Review the current result.`
          );
        if (check.takedown && succeeded !== check.effectiveTotal >= check.takedown.dc)
          return ui.notifications.warn(
            loc`The confirmed takedown outcome must match its final result and fixed Fortitude DC.`
          );
        validateDamageSaveRoll(this, check.damageSave, check.checkKind, check.checkId);
        if (
          check.analysisTask?.stage === "pressure" &&
          succeeded !== check.effectiveTotal >= check.analysisTask.challengeDC
        )
          return ui.notifications.warn(
            loc`The pressure outcome must match its final result and recorded Challenge DC.`
          );
        if (check.damageSave && succeeded !== check.effectiveTotal >= check.damageSave.dc)
          return ui.notifications.warn(
            loc`The confirmed outcome must match this damage save’s final result and recorded DC.`
          );
        let next = {
          ...check,
          ...adjudicateCheck(check, succeeded),
          flawlessSearch: null,
          automaticSkillSuccess: null
        };
        const automatic = automaticSkillSuccessPlan(this.system, next, { difficultyClass });
        if (automatic)
          next = {
            ...next,
            ...adjudicateCheck(check, true),
            automaticSkillSuccess: automatic,
            flawlessSearch: automatic.id === "flawlessSearch" ? automatic : null
          };
        let restoreWeapon;
        try {
          restoreWeapon = await this.syncRollErrorEffect(next, message.uuid ?? message.id);
          await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
        } catch (error) {
          await restoreWeapon?.();
          throw error;
        }
        if (
          next.successConfirmed === true &&
          next.checkKind === "skill" &&
          next.skillKey === "notice" &&
          next.checkId === "awareness" &&
          next.sleepSnapshot?.state === "sleeping"
        ) {
          // Outcome commits first. Waking is a historical event; never undo it when a later receipt write fails.
          try {
            const wake = await this.settleSleepWake(next.sleepSnapshot, {
              cause: "awareness",
              confirmed: true,
              check: next
            });
            next = { ...next, sleepWake: wake };
            await message.update({ "flags.spycraft2.sleepWake": wake });
          } catch (error) {
            ui.notifications.warn(loc`Awareness outcome recorded; waking needs review or retry: ` + error.message);
          }
        }
        return next;
      };
      return queueResources([this], work, { messages: [message] });
    }

    /** The GC can resolve an owned opponent's payment; cross-client authority remains a separate workflow. */
    async activateCritical(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
      const expected = rollEvidence(message.flags.spycraft2);
      let input = options;
      if (!Object.keys(input).length) {
        const check = message.flags.spycraft2,
          others = [...(game.actors ?? [])].filter(a => a.type === "agent" && a.uuid !== this.uuid && a.isOwner),
          esc = foundry.utils.escapeHTML;
        const fundingActors = [this, ...others],
          poolOptions = fundingActors
            .flatMap(a =>
              unrestrictedBonusPools(a.actionDiceFundingSystem, a.usagePeriods)
                .filter(p => p.available)
                .map(
                  p =>
                    `<option value="${esc(a.uuid + "|" + p.id)}">${esc(a.name)} — ${esc(p.label)} (${p.available} d${p.die})</option>`
                )
            )
            .join("");
        input = await systemDialog.input({
          window: { title: loc`Activate a confirmed critical result` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">
        <label>${loc`Result`} <select name="kind">${check.threatConfirmed ? `<option value="success">${loc`Own critical success / hit`}</option>` : ""}${check.errorConfirmed ? `<option value="failure">${loc`Opponent activates critical failure / miss`}</option>` : ""}</select></label>
        ${message.flags.spycraft2.checkKind === "attack" && typeof message.flags.spycraft2.attackContext?.vehicleMounted !== "boolean" && (this.system.classOptionSelections ?? []).some(e => e.classId === "wheelman" && e.name === "Most Lethal") ? `<label><input type="checkbox" name="vehicleMountedConfirmed" /> ${loc`Unrecorded attack platform: confirm this weapon was vehicle-mounted when the attack was rolled (Most Lethal)`}</label>` : ""}
        ${cleaveLegacyTargetEligible(this.system, check) ? `<label><input type="checkbox" name="legacyStandardTargetConfirmed" /> ${loc`Unrecorded original target: the GC confirms this melee attack was against a standard character (Cleave Supremacy)`}</label>` : ""}
        <label>${loc`Opponent paying for a failure`} <select name="payerId"><option value="">${loc`Choose opponent…`}</option>${game.user?.isGM ? `<option value="gc">${loc`GC action-die pool`}</option>` : ""}${others.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
        <label>${loc`Funding from the paying character`} <select name="funding"><option value="">${loc`Ordinary action dice / GC pool`}</option>${poolOptions}</select></label>
        <label>${loc`Shaken surcharge funding`} <select name="feeFunding"><option value="same">${loc`Same source as the base cost`}</option><option value="">${loc`Paying character's ordinary dice`}</option>${poolOptions}</select></label>
        <details><summary>${loc`Split the entire payment across this payer's wallets (optional)`}</summary><p>${loc`If any contribution is entered, these fields replace both source selectors. Total the final cost after automatic reductions and the payer's Shaken surcharge; only the selected payer may contribute.`}</p>${fundingActors
          .map(
            a =>
              `<label>${loc`${esc(a.name)}: ordinary dice (${a.system.actionDice?.value ?? 0})`} <input name="criticalFund_${a.id}" type="number" min="0" value="0" /></label>${unrestrictedBonusPools(
                a.actionDiceFundingSystem,
                a.usagePeriods
              )
                .filter(p => p.available)
                .map(
                  p =>
                    `<label>${esc(a.name)}: ${esc(p.label)} (${p.available} d${p.die}) <input name="criticalPool_${a.id}_${p.id}" type="number" min="0" value="0" /></label>`
                )
                .join("")}`
          )
          .join("")}</details>
        <label><input type="checkbox" name="jinx" /> ${loc`Use the paying opponent’s earned Jinx (−1cost, minimum0; one Chance-based session use)`}</label>
        <label>${loc`Base action-die cost from the applicable effect`} <input type="number" name="baseCost" min="1" value="1" /></label>
        <label>${loc`Critical effect`} <textarea name="effect" required></textarea></label>
        <label><input type="checkbox" name="effectConfirmed" /> ${loc`The GC confirms this effect is possible and its base cost is correct before the automatic modifiers below`}</label>
        <label><input type="checkbox" name="beforeDamage" /> ${loc`Critical hit: damage has not been rolled`}</label>
        <label><input type="checkbox" name="opponent" /> ${loc`Failure payer is an opponent`}</label>
        <label><input type="checkbox" name="lineOfSight" /> ${loc`Failure payer has line of sight to the acting character`}</label>
        <p>${loc`Attack Triumph, Cleave Supremacy, Finesse Supremacy, Grand Skill Mastery, Most Lethal, Sharpshooter Supremacy, Most Deadly, Overkill, Driven, Practice Makes Perfect, Simply Irresistible, Clean and Polished, Dependable and Unreliable adjust the base cost automatically. Selected Jinx reduces the paying opponent’s adjusted cost by1(minimum0), using its own session allowance. The paying character adds the Shaken II/III surcharge after those adjustments, even if the base cost becomes zero. Surcharge dice are not rolled. Apply the recorded effect at the table. The GC can handle payments from other players’ actors; the GC may also use the session’s separate pool.`}</p></div>`
        });
        if (!input) return null;
        input.splitFunding = fundingActors
          .flatMap(a => [
            { actorUuid: a.uuid, bonusPoolId: "", count: Number(input["criticalFund_" + a.id] ?? 0) },
            ...unrestrictedBonusPools(a.actionDiceFundingSystem, a.usagePeriods)
              .filter(p => p.available)
              .map(p => ({
                actorUuid: a.uuid,
                bonusPoolId: p.id,
                count: Number(input["criticalPool_" + a.id + "_" + p.id] ?? 0)
              }))
          ])
          .filter(p => p.count);
      }
      const useGC = input.kind === "failure" && (input.payerId === "gc" || input.payer === "gc");
      if (useGC && !game.user?.isGM) return ui.notifications.warn(loc`Only the GC can spend the GC pool.`);
      const controller = useGC ? gcDiceController({ required: false }) : null;
      const payer = useGC ? null : input.kind === "failure" ? (input.payer ?? game.actors?.get(input.payerId)) : this;
      if (!useGC && (payer?.type !== "agent" || !payer.isOwner))
        return ui.notifications.warn(
          loc`Choose a paying character you can update, or ask the GC to resolve the payment.`
        );
      let bonusPoolId = input.bonusPoolId ?? "";
      if (input.funding) {
        const [payerUuid, id, ...extra] = String(input.funding).split("|");
        if (useGC || payerUuid !== payer.uuid || !id || extra.length)
          return ui.notifications.warn(loc`Choose a bonus pool belonging to the paying character.`);
        bonusPoolId = id;
      }
      if (useGC && bonusPoolId) return ui.notifications.warn(loc`The GC pool cannot spend a character bonus grant.`);
      let surchargeBonusPoolId = input.surchargeBonusPoolId ?? "same";
      if (input.feeFunding !== undefined && input.feeFunding !== "same") {
        if (input.feeFunding === "") surchargeBonusPoolId = "";
        else {
          const [uuid, id, ...extra] = String(input.feeFunding).split("|");
          if (useGC || uuid !== payer.uuid || !id || extra.length)
            return ui.notifications.warn(loc`Choose surcharge funding belonging to the paying character.`);
          surchargeBonusPoolId = id;
        }
      }
      if (input.splitFunding !== undefined && !Array.isArray(input.splitFunding))
        return ui.notifications.warn(loc`Choose valid split contributions for the paying character.`);
      if (input.splitFunding?.some(p => useGC || p.actorUuid !== payer.uuid))
        return ui.notifications.warn(loc`Split contributions must belong to the selected paying character.`);
      const allocations = input.splitFunding?.length
        ? input.splitFunding.map(({ bonusPoolId, count }) => ({ bonusPoolId, count }))
        : input.paymentAllocations;
      if (useGC && allocations?.length)
        return ui.notifications.warn(loc`The GC pool uses one GC payment, not character wallets.`);
      const expectedShaken = useGC ? null : JSON.stringify(shakenRules(payer.actionDiceFundingSystem));
      const work = async () => {
        if (getActionDieSettlementReview(this).needsReview)
          return ui.notifications.warn(
            loc`Review this character’s interrupted action-die settlement before activating another critical result.`
          );
        if (rollEvidence(message.flags.spycraft2) !== expected)
          return ui.notifications.warn(
            loc`This result changed while its critical activation was being prepared. Review the current result.`
          );
        if (useGC) await refreshGCDiceTransaction(controller);
        const check = message.flags.spycraft2,
          base = { ...input, baseCost: Number(input.baseCost ?? 1), samePayer: !useGC && payer.uuid === this.uuid };
        let plan = criticalPlan(this.system, check, { ...base, available: Number.MAX_SAFE_INTEGER });
        if (plan.blocked) return ui.notifications.warn(plan.reason);
        const jinxOptions = {
          jinx: input.jinx ?? false,
          payerUuid: useGC ? "GC" : payer.uuid,
          actingActorUuid: this.uuid
        };
        plan = jinxCostPlan(useGC ? {} : { ...payer.system, usagePeriods: payer.usagePeriods }, plan, jinxOptions);
        let jinxReservation = null;
        const validateJinxCost = () => {
          const fresh = jinxCostPlan(
            { ...payer.system, usagePeriods: payer.usagePeriods },
            criticalPlan(this.system, message.flags.spycraft2, { ...base, available: Number.MAX_SAFE_INTEGER }),
            jinxOptions
          );
          if (JSON.stringify(fresh) !== JSON.stringify(plan))
            throw new Error(loc`The critical effect cost or Jinx source changed before activation.`);
        };
        if (plan.cost && !allocations?.length) {
          const funding = useGC
            ? { blocked: false, balance: gcDiceStatus().value }
            : actionDiceFundingContext(payer.actionDiceFundingSystem, { bonusPoolId, periods: payer.usagePeriods });
          if (funding.blocked) return ui.notifications.warn(funding.reason);
          if (plan.jinx) {
            if (plan.cost > funding.balance)
              return ui.notifications.warn(loc`Not enough action dice remain in the paying character’s pool.`);
          } else {
            plan = criticalPlan(this.system, check, { ...base, available: funding.balance });
            if (plan.blocked) return ui.notifications.warn(plan.reason);
          }
        }
        const paymentReceiptId =
          globalThis.foundry?.utils?.randomID?.() ??
          "critical-" + (this._criticalReceiptSequence = (this._criticalReceiptSequence ?? 0) + 1);
        const perform = async (payment = null) => {
          jinxReservation?.guard();
          const paidPlan = payment?.surcharge
            ? {
                ...plan,
                adjustedBaseCost: plan.cost,
                surcharge: payment.surcharge,
                cost: payment.cost,
                sources: [...plan.sources, `Shaken surcharge +${payment.surcharge}`]
              }
            : plan;
          const gain = hardKnocksGainPlan(this.system, check, {
            kind: plan.kind,
            careerDie: globalThis.CONFIG?.SPYCRAFT?.tables?.levels?.[this.system.level ?? 0]?.actionDie ?? 4
          });
          const next = {
            ...check,
            ...(plan.vehicleMountDeclared || plan.targetStandardDeclared
              ? {
                  attackContext: {
                    ...check.attackContext,
                    ...(plan.vehicleMountDeclared
                      ? { vehicleMounted: true, vehicleMountDeclaredAtActivation: true }
                      : {}),
                    ...(plan.targetStandardDeclared
                      ? {
                          characterTarget: {
                            version: 1,
                            source: "gcLegacy",
                            standard: true,
                            confirmedAtActivation: true
                          }
                        }
                      : {})
                  }
                }
              : {}),
            [plan.kind === "success" ? "criticalSuccess" : "criticalFailure"]: true,
            criticalActivation: {
              ...(plan.jinx ? { jinx: { ...plan.jinx, use: structuredClone(jinxReservation.record) } } : {}),
              kind: plan.kind,
              payerUuid: useGC ? "GC" : payer.uuid,
              cost: paidPlan.cost,
              baseCost: plan.baseCost,
              ...(payment?.surcharge ? { adjustedBaseCost: plan.cost, surcharge: payment.surcharge } : {}),
              effect: plan.effect,
              sources: paidPlan.sources,
              paymentReceiptId,
              funding: payment
                ? {
                    bonusPoolId: payment.bonusPoolId,
                    die: payment.die,
                    count: plan.cost,
                    ...(payment.surcharge || allocations?.length
                      ? { surcharge: payment.surcharge, totalCost: payment.cost, allocations: payment.allocations }
                      : {})
                  }
                : null
            },
            ...(gain ? { schoolOfHardKnocks: { count: 1, units: gain.units, die: gain.die } } : {})
          };
          const creditPath = "flags.spycraft2.hardKnocksCredit",
            previousCredit = structuredClone(this.flags?.spycraft2?.hardKnocksCredit),
            beforeDice = this.system.actionDice.value;
          const credit = {
              id: paymentReceiptId,
              messageUuid: message.uuid ?? message.id,
              units: gain?.units ?? 0,
              die: gain?.die ?? null,
              session: String(this.usagePeriods.session ?? "initial")
            },
            same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
            currentCredit = () => this.flags?.spycraft2?.hardKnocksCredit;
          let restoreWeapon,
            gained = false,
            creditAttempted = false;
          try {
            if (gain) {
              creditAttempted = true;
              try {
                await this.update({
                  "system.actionDice.value": gain.value,
                  ...this.actorRecordRestorePatch(creditPath, credit)
                });
              } catch (error) {
                if (!same(currentCredit(), credit)) throw error;
              }
              gained = true;
            }
            jinxReservation?.guard();
            restoreWeapon = await this.syncRollErrorEffect(next, message.uuid ?? message.id);
            jinxReservation?.guard();
            await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
          } catch (error) {
            if (message.flags?.spycraft2?.criticalActivation?.paymentReceiptId === paymentReceiptId) return paidPlan;
            const failures = [];
            try {
              await restoreWeapon?.();
            } catch (rollback) {
              failures.push(rollback);
            }
            if (gained) {
              const balance = this.system.actionDice.value - gain.units;
              if (!same(currentCredit(), credit) || !Number.isSafeInteger(balance) || balance < 0)
                failures.push(new Error(loc`The School of Hard Knocks credit changed before restoration.`));
              else
                try {
                  await this.update({
                    "system.actionDice.value": balance,
                    ...this.actorRecordRestorePatch(creditPath, previousCredit)
                  });
                } catch (rollback) {
                  if (this.system.actionDice.value !== balance || !same(currentCredit(), previousCredit))
                    failures.push(rollback);
                }
            } else if (
              creditAttempted &&
              (!same(currentCredit(), previousCredit) || this.system.actionDice.value !== beforeDice)
            )
              failures.push(new Error(loc`The class die credit could not be confirmed.`));
            if (failures.length) {
              const failure = new AggregateError(
                [error, ...failures],
                loc`The critical effect could not be safely restored.`
              );
              failure.actionDiceSettlementReview = {
                purpose: "critical activation",
                messageUuid: message.uuid ?? message.id
              };
              if (gain)
                await this.markActionDiceSettlementReview(
                  {
                    count: gain.units,
                    balance: beforeDice,
                    paymentPath: "system.actionDice.value",
                    bonusPoolId: "",
                    die: gain.die,
                    label: loc`School of Hard Knocks credit`
                  },
                  failure,
                  { purpose: "School of Hard Knocks credit", messageUuid: message.uuid ?? message.id }
                );
              throw failure;
            }
            throw error;
          }
          return paidPlan;
        };
        const pay = () => {
          if (useGC && plan.cost)
            return spendGCDice(plan.cost, perform, {
              purpose: "Critical activation",
              messageUuid: message.uuid ?? message.id
            });
          if (!useGC)
            return payer.payActionDiceBenefitLocked(plan.cost, perform, {
              bonusPoolId,
              surchargeBonusPoolId,
              allocations,
              purpose: "Critical activation",
              benefit: plan.kind === "success" ? "criticalSuccess" : "criticalFailure",
              expectedShaken,
              message,
              details: {
                actingActorUuid: this.uuid,
                kind: plan.kind,
                ...(jinxReservation ? { limitedUseSettlement: [jinxReservation.settlement] } : {})
              }
            });
          return perform();
        };
        if (plan.jinx)
          return withJinxReservation(
            payer,
            plan,
            message,
            reservation => {
              jinxReservation = reservation;
              return pay();
            },
            { validateCost: validateJinxCost }
          );
        return pay();
      };
      // One activation at a time across actors avoids reciprocal payment queues deadlocking.
      return queueResources(useGC ? [this] : [this, payer], work, { messages: [message] });
    }

    async finishCheck(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
      const check = message.flags.spycraft2;
      if (check.gearAttempt) return finishGearAcquisition(this, message);
      if (
        check.requiredBonusPoolId &&
        bonusPoolForCheck(this.system, check.requiredBonusPoolId, message, { periods: this.usagePeriods }).available
      )
        return ui.notifications.warn(loc`Spend the required class bonus die before resolving this check.`);
      const candidates = checkCandidates(check);
      if (
        typeof check.successConfirmed !== "boolean" &&
        (check.takedown ||
          check.damageSave ||
          candidates.error ||
          candidates.threat ||
          candidates.triumph ||
          automaticSkillSuccessSources(this.system, check).length > 0)
      ) {
        const result = await this.confirmCheckOutcome(message, options);
        if (!result) return null;
      }
      const expected = rollEvidence(message.flags.spycraft2);
      return queueResources(
        [this],
        async () => {
          const current = message.flags.spycraft2;
          if (current.resolved || current.superseded)
            return ui.notifications.warn(loc`This result is already resolved or replaced.`);
          if (rollEvidence(current) !== expected)
            return ui.notifications.warn(
              loc`This roll changed before resolution. Review and confirm its current result.`
            );
          if (
            current.requiredBonusPoolId &&
            bonusPoolForCheck(this.system, current.requiredBonusPoolId, message, { periods: this.usagePeriods })
              .available
          )
            return ui.notifications.warn(loc`Spend the required class bonus die before resolving this check.`);
          const result = await message.update({
            "flags.spycraft2.resolved": true,
            flavor: checkFlavor({ ...current, resolved: true })
          });
          await this.retireCheckBonusPool(message);
          return result;
        },
        { messages: [message] }
      );
    }

    async retireCheckBonusPool(message) {
      const id = message.flags?.spycraft2?.requiredBonusPoolId,
        pool = this.system.bonusActionDice?.[id];
      if (!pool || pool.messageUuid !== (message.uuid ?? message.id) || !pool.remaining) return;
      try {
        await this.update({
          [`system.bonusActionDice.${id}.remaining`]: 0,
          [`system.bonusActionDice.${id}.forfeited`]: true
        });
      } catch (error) {
        ui.notifications.warn(
          loc`The check is already resolved or replaced, but its unused bonus bookkeeping needs GC review. Do not retry the resolved check.`
        );
      }
    }

    async migrateBrightIdeaUses(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let status = brightIdeaPoolStatus(this.system, this.usagePeriods);
      if (!status.pending) return null;
      let allocations = options.allocations;
      if (allocations !== undefined && !game.user?.isGM)
        throw new Error(loc`The GC reviews allocations of past combined Bright Idea uses.`);
      if (allocations === undefined && !status.automatic) {
        if (!game.user?.isGM) throw new Error(loc`Ask the GC to allocate past combined Bright Idea uses.`);
        if (status.legacyUsed === null)
          throw new Error(loc`Review the malformed old Bright Idea counter before allocation.`);
        const esc = foundry.utils.escapeHTML,
          input = await systemDialog.input({
            window: { title: loc`Allocate past Bright Idea uses` },
            rejectClose: false,
            content: `<div class="spycraft2-roll-options"><p>${loc`The old combined pool records ${status.legacyUsed} uses this session. Confirm which class supplied each use; the allocated total must match. This preserves past use and grants no dice.`}</p>${status.sources.map((s, index) => `<label>${loc`${esc(s.name)} (${s.remaining} allowance remaining)`} <input type="number" name="source_${index}" value="0" min="0" max="${s.remaining}" /></label>`).join("")}</div>`
          });
        if (!input) return null;
        allocations = Object.fromEntries(
          status.sources.map((s, index) => [s.id, Number(input[`source_${index}`] ?? 0)])
        );
      }
      return queueResources([this], async () => {
        if (allocations !== undefined && !game.user?.isGM)
          throw new Error(loc`Only the GC may allocate the old combined uses.`);
        const plan = brightIdeaMigrationPlan(this.system, this.usagePeriods, allocations, {
          at: Date.now(),
          reviewedBy: game.user?.id ?? "automatic single source"
        });
        if (plan) await this.update(plan.updates);
        return plan;
      });
    }

    async useManualAdjustment(message, options = {}) {
      if (this.type !== "agent" || !this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM)
        throw new Error(loc`The GC resolves Manual Adjustment for a secret check.`);
      const expected = rollEvidence(message.flags.spycraft2);
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Manual Adjustment: reverse a failed check` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Use after a failed eligible check, before any critical failure is activated. One half action reverses a retryable failure within effective class level +20, at the lowest positive grade. No action die is spent; one session use is consumed.`}</p><label>${loc`GC-confirmed DC`} <input type="number" name="difficultyClass" step="1" required /></label><label>${loc`Target device`} <input name="device" required /></label><label><input type="checkbox" name="retryConfirmed" /> ${loc`The GC confirms this check may be retried`}</label><label><input type="checkbox" name="halfActionConfirmed" /> ${loc`Spend one half action`}</label><label><input type="checkbox" name="whackConfirmed" /> ${loc`Give the target device a whack`}</label></div>`
        });
        if (!input) return null;
      }
      manualAdjustmentPlan(this.system, message.flags.spycraft2, input);
      return this.useLimitedAbility(
        "manualAdjustment",
        async () => {
          const check = message.flags.spycraft2;
          if (rollEvidence(check) !== expected)
            throw new Error(
              loc`This result changed while Manual Adjustment was being declared. Review the current check.`
            );
          const plan = manualAdjustmentPlan(this.system, check, input),
            safe = { ...check, cannotError: true };
          const next = {
            ...safe,
            ...adjudicateCheck(safe, true),
            manualAdjustment: plan,
            cannotErrorBeforeManual: !!check.cannotError
          };
          let restoreWeapon;
          try {
            restoreWeapon = await this.syncRollErrorEffect(next, message.uuid ?? message.id);
            await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
          } catch (error) {
            await restoreWeapon?.();
            throw error;
          }
          return next;
        },
        { workflow: "manualAdjustment", messages: [message] }
      );
    }

    async recordHintResponse(options = {}) {
      if (this.type !== "agent" || !this.isOwner || !game.user?.isGM)
        throw new Error(loc`The GC records the hint response for an owned agent.`);
      let input = options;
      if (!input.outcome) {
        const esc = foundry.utils.escapeHTML,
          sources = hintSources(this.system, [...this.items]);
        input = await systemDialog.input({
          window: { title: loc`Record free-hint response` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Record one request after the GC provides or refuses the hint. No action die is charged and the GC gains no die. A refusal grants the source’s bonus dice, without award XP.`}</p><label>${loc`Source`} <select name="source">${sources.map(spec => `<option value="${esc(spec.id)}" ${options.source === spec.id ? "selected" : ""}>${loc`${esc(spec.name)} (${spec.refusalDice} refusal dice)`}</option>`).join("")}</select></label><label>${loc`GC response`} <select name="outcome"><option value="provided">${loc`Hint provided`}</option><option value="refused">${loc`Hint refused`}</option></select></label><label>${loc`Hint / refusal note`} <textarea name="text"></textarea></label><label><input type="checkbox" name="minuteConfirmed" /> ${loc`The agent spends one minute (required for Intuition)`}</label></div>`
        });
        if (!input) return null;
      }
      const plan = () =>
        hintResponsePlan(this.system, [...this.items], {
          ...input,
          careerDie: CONFIG.SPYCRAFT.tables.levels[this.system.level ?? 0]?.actionDie ?? 4
        });
      plan();
      return this.useLimitedAbility(
        input.source,
        async () => {
          if (!game.user?.isGM) throw new Error(loc`Only the GC may record a hint response.`);
          if (getActionDieSettlementReview(this).needsReview)
            throw new Error(loc`Review the interrupted action-die settlement before recording another hint.`);
          const current = plan(),
            esc = foundry.utils.escapeHTML,
            id =
              foundry.utils.randomID?.() ??
              "hint-" + (this._hintReceiptSequence = (this._hintReceiptSequence ?? 0) + 1);
          const path = "flags.spycraft2.hintCredit",
            previous = structuredClone(this.flags?.spycraft2?.hintCredit),
            before = this.system.actionDice.value,
            receipt = { id, source: input.source, outcome: current.outcome, units: current.units, die: current.die },
            same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
            credit = () => this.flags?.spycraft2?.hintCredit;
          let credited = false,
            attempted = false;
          try {
            if (current.units) {
              attempted = true;
              try {
                await this.update({
                  "system.actionDice.value": current.value,
                  ...this.actorRecordRestorePatch(path, receipt)
                });
              } catch (error) {
                if (!same(credit(), receipt)) throw error;
              }
              credited = true;
            }
            return await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: `<p>${esc(current.spec.name)}: ${current.outcome === "provided" ? loc`hint provided` : loc`hint refused; gain ${current.units}d${current.die}`}.</p>${current.text ? `<p>${esc(current.text)}</p>` : ""}`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "hintResponse",
                  actionDiceAllowed: false,
                  receiptId: id,
                  source: input.source,
                  outcome: current.outcome,
                  bonusDice: current.units,
                  bonusDie: current.die
                }
              }
            });
          } catch (error) {
            const posted = [...(game.messages ?? [])].find(
              m =>
                m.flags?.spycraft2?.actorUuid === this.uuid &&
                m.flags.spycraft2.checkKind === "hintResponse" &&
                m.flags.spycraft2.receiptId === id
            );
            if (posted) return posted;
            let uncertain =
                attempted && !credited && (!same(credit(), previous) || this.system.actionDice.value !== before),
              rollbackError = null;
            if (credited) {
              const restored = this.system.actionDice.value - current.units;
              if (!same(credit(), receipt) || !Number.isSafeInteger(restored) || restored < 0) uncertain = true;
              else
                try {
                  await this.update({
                    "system.actionDice.value": restored,
                    ...this.actorRecordRestorePatch(path, previous)
                  });
                } catch (rollback) {
                  if (this.system.actionDice.value !== restored || !same(credit(), previous)) {
                    uncertain = true;
                    rollbackError = rollback;
                  }
                }
            }
            if (uncertain) {
              const failure = new AggregateError(
                [error, ...(rollbackError ? [rollbackError] : [])],
                loc`The hint credit needs GC review.`
              );
              await this.markActionDiceSettlementReview(
                {
                  count: current.units,
                  balance: before,
                  paymentPath: "system.actionDice.value",
                  bonusPoolId: "",
                  die: current.die,
                  label: current.spec.name
                },
                failure,
                { purpose: "hint response credit", hintReceipt: receipt }
              );
              throw failure;
            }
            throw error;
          }
        },
        { workflow: "hintResponse" }
      );
    }

    async rerollCheck(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid) return null;
      if (message.blind && !game.user?.isGM) return ui.notifications.warn(loc`The GC resolves secret results.`);
      const expected = rollEvidence(message.flags.spycraft2);
      let input = options;
      const esc = foundry.utils.escapeHTML;
      if (!input.resource) {
        const available = this.limitedUseStatus.filter(
          spec =>
            spec.workflow === "reroll" &&
            spec.remaining &&
            rerollEligibility(spec, message.flags.spycraft2, {
              failed: true,
              criticalFailure: !!message.flags.spycraft2.criticalFailure
            })
        );
        if (!available.length) return ui.notifications.warn(loc`No available reroll ability applies to this check.`);
        input = await systemDialog.input({
          window: { title: loc`Reroll check` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">
        ${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({ perBenefit: true, unrolled: true })}<label>${loc`Ability`} <select name="resource">${available.map(spec => `<option value="${esc(spec.id)}">${loc`${esc(spec.name)} (${spec.remaining}/${spec.limit}, ${spec.cost} action dice)`}</option>`).join("")}</select></label>
        <label><input type="checkbox" name="failed" /> ${loc`The GC confirmed this check failed`}</label>
        <label><input type="checkbox" name="criticalFailure" /> ${loc`This is an activated critical failure`}</label></div>`
        });
        if (!input) return null;
      }
      // Re-read and validate inside the spending queue, after any dialog or earlier click.
      return this.useLimitedAbility(
        input.resource,
        async (status, payment) => {
          const check = message.flags?.spycraft2,
            spec = this.system.limitedUses.find(entry => entry.id === input.resource);
          if (rollEvidence(check) !== expected)
            throw new Error(loc`This roll changed while the reroll was being prepared. Review the current result.`);
          validateAttributeDamageProof(this.system, check.attributeDamage ?? null, { checkKind: check.checkKind });
          if (!rerollEligibility(spec, check, input))
            throw new Error(loc`This ability cannot reroll the selected check in its current state.`);
          const {
              epoch: sourceEpoch,
              used: reservedUsed,
              remaining: reservedRemaining,
              counterReview: reservedReview,
              ...reservedSource
            } = status,
            sourceSignature = JSON.stringify(reservedSource),
            rerollSource = {
              version: 1,
              id: spec.id,
              name: spec.name ?? spec.id,
              mastery: spec.mastery ?? "",
              period: spec.period,
              epoch: sourceEpoch,
              skills: structuredClone(spec.skills ?? [])
            };
          const validateRerollContext = () => {
            const live = this.system.limitedUses?.find(s => s.id === spec.id);
            if (
              JSON.stringify(live) !== sourceSignature ||
              String(this.usagePeriods[spec.period] ?? "initial") !== sourceEpoch ||
              rollEvidence(message.flags?.spycraft2) !== expected ||
              !rerollEligibility(live, message.flags?.spycraft2, input)
            )
              throw new Error(
                loc`The reroll source, period or original check changed before the replacement was posted.`
              );
          };
          const pending = transferableCheckBonusPool(this.system, message, this.usagePeriods);
          const resources = [...(check.rerollResources ?? []), spec.id];
          const rerollReceiptId =
            globalThis.foundry?.utils?.randomID?.() ??
            "reroll-" + (this._rerollReceiptSequence = (this._rerollReceiptSequence ?? 0) + 1);
          let replacement;
          try {
            replacement = await this.rollCheck(check.formula, check.rollData, {
              ...check,
              rerollSource,
              validateRerollContext,
              preRollFunding: null,
              rerollFunding: this.preRollPaymentReceipt(payment),
              rerollReceiptId,
              rerollOf: message.uuid ?? message.id,
              shakenContext: check.shakenContext ?? null,
              flavor: loc`${check.baseFlavor ?? loc`Check`} — ${spec.name} reroll`,
              requiredBonusPoolId: pending?.id ?? null,
              oneInAMillion: false,
              millionCommitted: false,
              tenSecondSolution: false,
              solutionCommitted: false,
              noForcedReroll: false,
              forcedThreat: false,
              cannotError: check.manualAdjustment ? (check.cannotErrorBeforeManual ?? false) : check.cannotError,
              threat: check.oneInAMillion || check.tenSecondSolution ? check.normalThreat : check.threat,
              rerollResources: resources
            });
          } catch (error) {
            replacement = [...(game.messages ?? [])].find(
              m =>
                m.flags?.spycraft2?.actorUuid === this.uuid && m.flags?.spycraft2?.rerollReceiptId === rerollReceiptId
            );
            if (!replacement) throw error;
          }
          const weapon =
            check.weaponUuid && typeof fromUuidSync !== "undefined" ? fromUuidSync(check.weaponUuid) : null;
          const tracksDestruction = !!weapon && weapon.system.destroyedByRoll === (message.uuid ?? message.id);
          const previousWeapon = tracksDestruction
            ? { destroyed: weapon.system.destroyed, destroyedByRoll: weapon.system.destroyedByRoll }
            : null;
          let transferred = false;
          try {
            if (rollEvidence(message.flags.spycraft2) !== expected)
              throw new Error(loc`The original result changed during the replacement roll. Review it before retrying.`);
            if (pending) {
              await this.update({
                [`system.bonusActionDice.${pending.id}.messageUuid`]: replacement.uuid ?? replacement.id
              });
              transferred = true;
            }
            if (tracksDestruction) {
              const next = replacement.flags?.spycraft2 ?? replacement.data?.flags?.spycraft2;
              const destroyed = !!next?.errorConfirmed;
              await weapon.update({
                "system.destroyed": destroyed,
                "system.destroyedByRoll": destroyed ? (replacement.uuid ?? replacement.id) : ""
              });
            }
            await message.update({
              "flags.spycraft2.superseded": replacement.uuid ?? replacement.id,
              "flags.spycraft2.resolved": true,
              ...(pending ? { "flags.spycraft2.bonusTransferredTo": replacement.uuid ?? replacement.id } : {}),
              flavor: checkFlavor({
                ...check,
                resolved: true,
                superseded: replacement.uuid ?? replacement.id,
                ...(pending ? { bonusTransferredTo: replacement.uuid ?? replacement.id } : {})
              })
            });
          } catch (error) {
            if (
              message.flags?.spycraft2?.superseded === (replacement.uuid ?? replacement.id) &&
              message.flags?.spycraft2?.resolved
            ) {
              await this.retireCheckBonusPool(message);
              return replacement;
            }
            const failures = [];
            if (
              pending &&
              (transferred ||
                this.system.bonusActionDice?.[pending.id]?.messageUuid === (replacement.uuid ?? replacement.id))
            )
              try {
                await this.update({ [`system.bonusActionDice.${pending.id}.messageUuid`]: pending.messageUuid });
              } catch (e) {
                failures.push(e);
              }
            if (previousWeapon)
              try {
                await weapon.update({
                  "system.destroyed": previousWeapon.destroyed,
                  "system.destroyedByRoll": previousWeapon.destroyedByRoll
                });
              } catch (e) {
                failures.push(e);
              }
            try {
              await replacement.delete?.();
            } catch (e) {
              if (
                [...(game.messages ?? [])].some(
                  m => m.uuid === (replacement.uuid ?? replacement.id) || m.id === replacement.id
                )
              )
                failures.push(e);
            }
            if (failures.length) {
              const failure = new AggregateError(
                [error, ...failures],
                loc`The replacement result needs GC review before retrying.`
              );
              failure.actionDiceSettlementReview = {
                purpose: "class reroll",
                messageUuid: message.uuid ?? message.id,
                replacementUuid: replacement.uuid ?? replacement.id
              };
              throw failure;
            }
            throw error;
          }
          await this.retireCheckBonusPool(message);
          return replacement;
        },
        {
          workflow: "reroll",
          messages: [message],
          bonusPoolId: input.bonusPoolId ?? "",
          ...surchargeFundingInput(input),
          ...unrolledPaymentFundingInput(input)
        }
      );
    }
  };
