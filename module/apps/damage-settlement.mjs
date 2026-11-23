import { damageLedgerSnapshot } from "../rules/accumulated-damage.mjs";
import { pendingDamageSave, currentDamageSaveMessage } from "../rules/damage-saves.mjs";
import { damageSettlementPlan, validateDamageSettlement } from "../rules/damage-settlement.mjs";
import { shakenApplicationSnapshot } from "../rules/shaken.mjs";
import { applyShakenLocked } from "./shaken-application.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { conditionDuration } from "../rules/timers.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
async function write(actor, patch, proof) {
  try {
    await actor.update(patch);
  } catch (error) {
    if (!proof()) throw error;
  }
  if (!proof()) throw new Error(loc`Review the actual damage-settlement receipt before retrying.`);
}
export async function settlePendingDamageSave(actor, options = {}) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const old = options.eventId && actor.flags?.spycraft2?.damageEvents?.[options.eventId];
  if (old?.state === "settled") return old;
  const record = pendingDamageSave(actor, options.eventId, { allowSettling: true });
  if (!record) return null;
  const message = currentDamageSaveMessage(actor, record, game.messages ?? []);
  if (!message) throw new Error(loc`Roll the pending save, confirm its outcome and finish it in chat first.`);
  if (message.blind && !game.user.isGM) throw new Error(loc`The GC resolves this secret result.`);
  const expected = damageLedgerSnapshot(actor);
  let input = options;
  if (input.confirmed !== true) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Settle next damage save` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`${esc(record.source)}: ${record.kind === "stress" ? loc`Will` : loc`Fortitude`} DC${record.save.dc}. Confirm and finish this save in chat before continuing.`}</p>${
        record.kind === "stress"
          ? `<label><input name="selfInflicted" type="checkbox"${record.settlement?.selfInflicted ? " checked" : ""} /> ${loc`This stress source was caused by the character's own action`}</label>`
          : ""
      }<label><input name="confirmed" type="checkbox" /> ${
        record.kind === "stress"
          ? loc`The GC confirmed the finished result and source. Settle success, or apply the failed stress save’s Shaken grade once`
          : loc`The GC confirmed the finished result. Settle success, or knock the character out on a failed save`
      }</label><label><input name="outcomeHandled" type="checkbox" /> ${loc`A Drained or GC-decided outcome has been applied by hand`}</label><p>${loc`Accumulated damage remains until separately recovered. An interrupted settlement resumes its original recorded details.`}</p></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) return null;
  return queueResources(
    [actor],
    async () => {
      if (!actor.isOwner) throw new Error(loc`Ownership changed before damage settlement.`);
      let current = actor.flags?.spycraft2?.damageEvents?.[record.id];
      if (current?.state === "settled") return current;
      if (!same(damageLedgerSnapshot(actor), expected))
        throw new Error(loc`The damage ledger changed before settlement. Review it again.`);
      pendingDamageSave(actor, record.id, { allowSettling: true });
      const actual = currentDamageSaveMessage(actor, current, game.messages ?? []);
      if (actual?.id !== message.id) throw new Error(loc`The current damage-save result changed.`);
      let plan;
      if (current.state === "settling") {
        plan = validateDamageSettlement(current, actual, current.settlement);
        if (plan.grade && input.selfInflicted !== undefined && input.selfInflicted !== plan.selfInflicted)
          throw new Error(
            loc`Resume the original settlement source details, or have the GC review them before changing them.`
          );
      } else {
        plan = damageSettlementPlan(current, actual, input, foundry.utils.randomID(), game.time.worldTime);
        const staged = { ...current, state: "settling", settlement: plan };
        await write(actor, { ["flags.spycraft2.damageEvents." + record.id]: staged }, () =>
          same(actor.flags?.spycraft2?.damageEvents?.[record.id], staged)
        );
        current = staged;
      }
      validateDamageSettlement(current, actual, plan);
      if (plan.grade)
        await applyShakenLocked(actor, shakenApplicationSnapshot(actor), {
          id: plan.applicationId,
          grade: plan.grade,
          source: "Stress damage: " + current.source,
          confirmed: true,
          selfInflicted: plan.selfInflicted
        });
      if (plan.unconscious && !actor.statuses?.has("unconscious")) {
        const duration = conditionDuration(plan.knockout);
        await setConditionStatus(actor, "unconscious", true, {
          label: loc`Unconscious`,
          ...(duration ? { duration } : {})
        });
      }
      validateDamageSettlement(actor.flags.spycraft2.damageEvents[record.id], actual, plan);
      const ledger = actor.system.accumulatedDamage;
      if (ledger.pending[0] !== record.id || !Number.isSafeInteger(ledger.revision + 1))
        throw new Error(loc`Review the damage ledger before completing settlement.`);
      const completed = {
          ...current,
          state: "settled",
          settlement: { ...plan, state: "completed", completedAt: game.time.worldTime }
        },
        next = { ...ledger, revision: ledger.revision + 1, pending: ledger.pending.slice(1) };
      await write(
        actor,
        { "system.accumulatedDamage": next, ["flags.spycraft2.damageEvents." + record.id]: completed },
        () =>
          same(actor.system.accumulatedDamage, next) &&
          same(actor.flags?.spycraft2?.damageEvents?.[record.id], completed)
      );
      if (plan.unconscious && globalThis.ChatMessage?.create) {
        const name = foundry.utils.escapeHTML(actor.name ?? "");
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="spycraft2 chat-note"><p>${
            plan.knockout
              ? loc`${name} fails the save and is unconscious for ${plan.knockout.count} ${plan.knockout.unit}(s).`
              : loc`${name} fails the save and is unconscious; the GC sets how long.`
          }</p></div>`
        });
      }
      return completed;
    },
    { messages: [message] }
  );
}
