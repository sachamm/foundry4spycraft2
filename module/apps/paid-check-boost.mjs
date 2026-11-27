import { actionDieBoostResult } from "../rules/action-dice.mjs";
import { rollEvidence, checkFlavor } from "../rules/outcomes.mjs";
import { boostPaymentQuote, boostPaymentSignature } from "../rules/boost-payments.mjs";
import { loc } from "../i18n.mjs";
import { rememberDamageBoost, assertDamageNotStarted } from "../documents/actor/damage-hits.mjs";
/** Caller owns the actor/result transaction. Only plan.rolls dice contribute; surcharge dice are payment only. */
export async function applyPaidCheckBoost(actor, message, { check, expected, input, plan, roll, quote }) {
  assertDamageNotStarted(actor, message);
  const fresh = boostPaymentQuote(actor, message, { ...input, count: plan.count });
  if (
    boostPaymentSignature(fresh) !== boostPaymentSignature(quote) ||
    rollEvidence(message.flags?.spycraft2) !== expected
  )
    throw new Error(loc`The condition, surcharge, funding or original result changed. Review this boost again.`);
  const result = actionDieBoostResult(
    check,
    plan,
    roll.dice.map(d => d.total)
  );
  const applied = await actor.payMultipartActionDiceLocked(
    quote.allocations,
    async payment => {
      if (rollEvidence(message.flags?.spycraft2) !== expected)
        throw new Error(loc`The original result changed before its boost was applied.`);
      const boostPayment = {
        id: payment.id,
        bonusPoolId: plan.bonusPoolId ?? "",
        die: plan.die,
        count: plan.count,
        surcharge: quote.surcharge,
        totalCost: quote.cost,
        allocations: payment.allocations
      };
      const next = {
        ...check,
        ...result,
        lastBoostPayment: boostPayment,
        ...(plan.bonusPoolId
          ? {
              ...(plan.bonusPoolId === check.requiredBonusPoolId
                ? {
                    requiredBonusSpent:
                      payment.payments.find(p => p.bonusPoolId === plan.bonusPoolId).afterBalance === 0
                  }
                : {}),
              bonusBoosts: [
                ...(check.bonusBoosts ?? []),
                { poolId: plan.bonusPoolId, label: plan.pool.label, die: plan.die, count: plan.count }
              ]
            }
          : {}),
        lastBoostDice: roll.dice.map(d => d.total),
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
        restoreWeapon = await actor.syncRollErrorEffect(next, message.uuid ?? message.id);
        await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
      } catch (error) {
        if (message.flags?.spycraft2?.lastBoostPayment?.id !== payment.id) {
          try {
            await restoreWeapon?.();
          } catch (rollback) {
            const failure = new AggregateError([error, rollback], loc`The boosted effect needs GC review.`);
            failure.actionDiceSettlementReview = {
              purpose: "Check boost effect",
              messageUuid: message.uuid ?? message.id
            };
            throw failure;
          }
          throw error;
        }
      }
      await rememberDamageBoost(actor, message, next);
      return result;
    },
    {
      message,
      purpose: "Check boost",
      details: {
        benefit: "checkBoost",
        boostCount: plan.count,
        surcharge: quote.surcharge,
        conditionGrade: quote.grade,
        evidenceBefore: expected
      }
    }
  );
  try {
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: loc`Spent ${quote.cost} action dice: ${plan.count} boosting ${plan.count === 1 ? "die" : "dice"} and ${quote.surcharge} Shaken surcharge ${quote.surcharge === 1 ? "die" : "dice"}. Rolled ${plan.rolls}; added +${result.added} after modifiers${result.replaced ? loc` and Calculating` : ""}.`
    });
  } catch {
    ui.notifications.warn(
      loc`The original result contains the paid boost. Its supplementary chat message could not be posted; check the original result before retrying.`
    );
  }
  return applied;
}
