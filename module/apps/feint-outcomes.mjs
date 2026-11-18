import { grantSideStanceFeint } from "./side-stance.mjs";
import { grantFeintCriticalBonus } from "./feint-bonus.mjs";
import { feintOutcomePlan, feintHistoryPlan } from "../rules/feint-outcomes.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
export async function settleFeintOutcome(actor, actingMessage, defendingMessage, input = {}) {
  const acting = actingMessage?.flags?.spycraft2,
    defending = defendingMessage?.flags?.spycraft2,
    opponent = attackCharacterTargetChoices().find(a => a.uuid === acting?.feint?.opponentUuid);
  if (
    !actor.isOwner ||
    acting?.actorUuid !== actor.uuid ||
    !opponent?.isOwner ||
    defending?.actorUuid !== opponent.uuid
  )
    throw Error("An owner of both actual Feint participants must settle their recorded checks.");
  if (input.opposedConfirmed !== true) throw Error("Confirm these are the two checks for the same opposed Feint.");
  return queueResources(
    [actor, opponent],
    async () => {
      const a = actingMessage.flags.spycraft2,
        d = defendingMessage.flags.spycraft2,
        evidence = [rollEvidence(a), rollEvidence(d)],
        saved = a.feintSettlement ?? d.feintSettlement;
      if (saved) {
        if (
          saved.sourceMessage !== actingMessage.uuid ||
          saved.defenderMessage !== defendingMessage.uuid ||
          JSON.stringify(saved.sourceEvidence) !== JSON.stringify(evidence)
        )
          throw Error("The settled Feint evidence changed; ask the GC to review it.");
        if (!a.feintSettlement) await actingMessage.update({ "flags.spycraft2.feintSettlement": saved });
        if (!d.feintSettlement) await defendingMessage.update({ "flags.spycraft2.feintSettlement": saved });
        if (saved.criticalAttackBonus === 2 && saved.criticalBenefitVersion !== 1)
          ui.notifications.info(
            "This older critical Feint has no automatic consumption history; the GC must apply its remaining benefit manually."
          );
        return saved;
      }
      const plan = feintOutcomePlan(a, d, {
          attackerUuid: actor.uuid,
          defenderUuid: opponent.uuid,
          combat: actor.mentalLeapCombatContext(),
          tieResolvedConfirmed: input.tieResolvedConfirmed
        }),
        history = feintHistoryPlan(opponent.system, plan, {
          sourceMessage: actingMessage.uuid,
          defenderMessage: defendingMessage.uuid
        });
      if (history && !history.existing)
        await opponent.update({ "system.feintHistory": [...(opponent.system.feintHistory ?? []), history.record] });
      await setConditionStatus(plan.attackerWon ? opponent : actor, "flat-footed", true, {
        label: "Flat-footed",
        aliases: ["flatFooted"],
        operationId: actingMessage.uuid
      });
      if (
        JSON.stringify([
          rollEvidence(actingMessage.flags.spycraft2),
          rollEvidence(defendingMessage.flags.spycraft2)
        ]) !== JSON.stringify(evidence)
      )
        throw Error("The Feint receipts changed during settlement; review the recorded condition/history.");
      const settlement = {
        ...plan,
        sourceMessage: actingMessage.uuid,
        defenderMessage: defendingMessage.uuid,
        sourceEvidence: evidence,
        criticalBenefitVersion: 1,
        sideBenefitVersion: 1
      };
      await grantFeintCriticalBonus(plan.attackerWon ? actor : opponent, settlement);
      if (plan.attackerWon) await grantSideStanceFeint(actor, settlement, a.feint);
      await actingMessage.update({ "flags.spycraft2.feintSettlement": settlement });
      await defendingMessage.update({ "flags.spycraft2.feintSettlement": settlement });
      if (plan.criticalAttackBonus)
        ui.notifications.info(
          `Feint: ${plan.winnerUuid} gains +2 with the next attack against ${plan.loserUuid}, expiring at the end of round ${plan.criticalDueRound}. Select that actual opponent in the next attack dialog to apply and consume it.`
        );
      return settlement;
    },
    { messages: [actingMessage, defendingMessage] }
  );
}
export async function manageFeintOutcomes(actor, input = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "actingMessage")) {
    const esc = foundry.utils.escapeHTML,
      visible = [...game.messages].filter(
        m =>
          m.visible !== false &&
          m.isContentVisible !== false &&
          (!m.blind || game.user.isGM) &&
          m.flags?.spycraft2?.feint?.version === 3 &&
          m.flags.spycraft2.resolved &&
          !m.flags.spycraft2.superseded
      ),
      acting = visible.filter(
        m => m.flags.spycraft2.actorUuid === actor.uuid && m.flags.spycraft2.feint.role === "attacker"
      ),
      defending = visible.filter(m => m.flags.spycraft2.feint.role === "defender"),
      options = ms =>
        ms
          .map(
            m =>
              `<option value="${esc(m.uuid)}">${esc(attackCharacterTargetChoices().find(a => a.uuid === m.flags.spycraft2.actorUuid)?.name ?? m.flags.spycraft2.actorUuid)} · round ${m.flags.spycraft2.feint.combat.round} · result ${m.flags.spycraft2.effectiveTotal}</option>`
          )
          .join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Feint opposed outcome" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Choose the two resolved participant checks for one recorded Feint. Finish boosts/critical activation and mark one winner and one loser in chat. Settlement applies flat-footed to the loser and records a successful target’s round restriction. Own both sheets, or have the GC settle.</p><label>Acting Sleight of Hand check <select name="actingMessage">${options(acting)}</select></label><label>Opposing Notice check <select name="defendingMessage">${options(defending)}</select></label><label><input type="checkbox" name="opposedConfirmed" /> These checks are the same opposed Feint, with the winner confirmed</label><label><input type="checkbox" name="tieResolvedConfirmed" /> If results AND skill bonuses tie, the GC used the p.91 random 1d20 tie-break to determine the declared winner</label><p>A winning critical success or losing critical failure grants the winner +2 on the next attack against the loser until the end of the following round; select the actual opponent on that next attack to apply and consume the bonus.</p></div>`
    });
    if (!input) return null;
  }
  return settleFeintOutcome(actor, await fromUuid(input.actingMessage), await fromUuid(input.defendingMessage), input);
}
