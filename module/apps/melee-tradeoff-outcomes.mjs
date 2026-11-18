import { queueResources } from "../rules/transactions.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { attackDamageUseRows, reviewAttackDamageBenefit, attackTradeoffProof } from "./attack-damage-benefits.mjs";
import { loc } from "../i18n.mjs";
const miss = c => {
  const p = attackTradeoffProof(c);
  return (
    c?.checkKind === "attack" &&
    c.resolved === true &&
    c.successConfirmed === false &&
    !c.superseded &&
    p?.penalty > 0 &&
    ((p.source === "All-out Attack" && c.attackContext?.ranged === false) ||
      (p.source === "Bullseye" &&
        c.attackContext?.ranged === true &&
        c.attackContext.attackAction === "standard" &&
        p.singleShotConfirmed === true))
  );
};
export async function settleMeleeTradeoffMiss(actor, message) {
  if (!actor.isOwner || message?.flags?.spycraft2?.actorUuid !== actor.uuid || (message.blind && !game.user.isGM))
    throw Error(loc`Choose your own resolved attack-tradeoff miss; the GC resolves secret results.`);
  return queueResources(
    [actor],
    async () => {
      const c = message.flags.spycraft2;
      if (!miss(c)) throw Error(loc`Confirm and resolve the actual recorded attack miss first.`);
      if (c.meleeTradeoffSettlement) return c.meleeTradeoffSettlement;
      const evidence = rollEvidence(c);
      await setConditionStatus(actor, "flat-footed", true, {
        label: loc`Flat-footed`,
        aliases: ["flatFooted"],
        operationId: message.uuid
      });
      if (rollEvidence(message.flags.spycraft2) !== evidence)
        throw Error(loc`The recorded attack miss changed during settlement. Review its condition.`);
      const settlement = {
        version: 1,
        source: attackTradeoffProof(c).source,
        sourceMessage: message.uuid,
        flatFooted: true
      };
      await message.update({ "flags.spycraft2.meleeTradeoffSettlement": settlement });
      return settlement;
    },
    { messages: [message] }
  );
}
export async function manageMeleeTradeoff(actor, input = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "operation")) {
    const esc = foundry.utils.escapeHTML,
      entries = [...game.messages]
        .filter(
          m =>
            m.visible !== false &&
            m.isContentVisible !== false &&
            (!m.blind || game.user.isGM) &&
            m.flags?.spycraft2?.actorUuid === actor.uuid &&
            miss(m.flags.spycraft2) &&
            !m.flags.spycraft2.meleeTradeoffSettlement
        )
        .map(m => ({
          value: "miss:" + m.uuid,
          label: loc`Apply flat-footed: ${attackTradeoffProof(m.flags.spycraft2).source} miss${m.flags.spycraft2.rollCombat?.round ? loc` in round ${m.flags.spycraft2.rollCombat.round}` : ""}`
        }));
    if (game.user.isGM)
      for (const r of attackDamageUseRows(actor.system).filter(r => !r.receiptUuid))
        entries.push({ value: "damage:" + r.reservationId, label: loc`Review interrupted recorded attack damage` });
    if (!entries.length)
      return ui.notifications.info(loc`No recorded attack miss or interrupted damage bonus is awaiting review.`);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Recorded attack benefits` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Confirm and resolve the attack in chat first. An All-out Attack or Bullseye miss makes you flat-footed. Its recorded hit supplies a damage bonus once through Gear; choose that same attack and target when rolling damage.`}</p><label>${loc`Operation`} <select name="operation">${entries.map(e => `<option value="${esc(e.value)}">${esc(e.label)}</option>`).join("")}</select></label><label><input type="checkbox" name="confirmed" /> ${loc`I reviewed this outcome; for interrupted damage, no client is still executing it and I checked for a posted receipt`}</label></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true || typeof input.operation !== "string")
    throw Error(loc`Confirm the recorded outcome or interrupted damage review.`);
  if (input.operation.startsWith("miss:"))
    return settleMeleeTradeoffMiss(actor, await fromUuid(input.operation.slice(5)));
  if (input.operation.startsWith("damage:"))
    return reviewAttackDamageBenefit(actor, { reservationId: input.operation.slice(7), confirmed: true });
  throw Error(loc`Choose a recorded attack outcome.`);
}
