import { npcDefensePlan, npcDefenseResult } from "../../rules/gc/npc-defense.mjs";
import { activeDefenseBoost } from "../../rules/health.mjs";
import { actionDieTotal, gcDieType } from "../../rules/gc/gc-spend.mjs";
import { spendProfile } from "./npc-play.mjs";
import { isDramaticScene } from "./state.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { gcDiceStatus, spendGCDice as payGC, reviewGCDiceSettlement } from "../../services/gc-dice.mjs";
import { recordReplacementPatch } from "../../rules/record-patch.mjs";
import { sameValues } from "../../rules/equal.mjs";
import { snapshot, flatten, undoEntry, postUndo } from "../undo.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";

const recordOf = message => message.flags?.spycraft2?.gcDefenseDelivery;
const hasReceipt = message =>
  [...(game.messages ?? [])].some(m => m.flags?.spycraft2?.undo?.gcDefenseDeliveryUuid === message.uuid);
const requireGC = actor => {
  if (!game.user?.isGM || actor?.type !== "npc" || !actor.isOwner)
    throw Error(loc`The owning GC boosts an NPC's Defense.`);
};
export { writeDelivery as writeNpcDefenseDelivery };

/** Caller holds the NPC/result transaction; every natural is durable before the next roll. */
export async function deliverNpcDefenseDie(actor, message, record, { beforeRoll, apply, receipt: postReceipt } = {}) {
  requireGC(actor);
  let started = false;
  try {
    const result = await payGC(
      1,
      async () => {
        try {
          const paid = gcDiceStatus().settlementReview;
          if (paid?.session !== record.session)
            throw Error(loc`The GC session changed before this Defense die could be rolled.`);
          await beforeRoll();
          await writeDelivery(message, { ...record, state: "rolling", paymentId: paid.id });
          const rolls = [],
            objects = [];
          for (let i = 0; i < 100; i++) {
            started = true;
            const die = await new Roll(`1d${record.die}`).evaluate();
            rolls.push(die.total);
            objects.push(die);
            const current = { ...recordOf(message), rolls: [...rolls] };
            await writeDelivery(message, current, { rolls: objects });
            if (actionDieTotal(record.die, rolls, { explodeLow: record.explodeLow }).complete) {
              await writeDelivery(message, { ...current, state: "rolled" });
              return await apply(rolls);
            }
          }
          throw Error(loc`Review the interrupted exploding Defense die before continuing.`);
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          if (started) error.actionDiceSettlementReview = true;
          throw error;
        }
      },
      { purpose: loc`NPC Defense boost ${record.id}`, messageUuid: message.uuid }
    );
    await postReceipt?.();
    return result;
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (started) {
      error.actionDiceSettlementReview = true;
      try {
        await message.update({
          content: `<p class="bad">${loc`NPC Defense boost interrupted. Recover this delivery before continuing.`}</p>`
        });
      } catch {}
    } else
      await writeDelivery(
        message,
        { ...record, state: "cancelled" },
        { content: `<p>${loc`NPC Defense reservation cancelled before rolling.`}</p>` }
      );
    throw error;
  }
}
async function writeDelivery(message, record, extra = {}) {
  try {
    await message.update({ "flags.spycraft2.gcDefenseDelivery": record, ...extra });
  } catch (error) {
    if (!sameValues(recordOf(message), record)) throw error;
  }
}
function originalSnapshot(actor, beforeRecord) {
  const before = snapshot(actor),
    path = "system.defenseBoost";
  for (const key of Object.keys(before.data)) if (key === path || key.startsWith(path + ".")) delete before.data[key];
  if (beforeRecord === null) before.data[path] = null;
  else flatten(beforeRecord, path, before.data);
  return before;
}
async function receipt(actor, message) {
  const record = recordOf(message);
  if (hasReceipt(message)) return;
  const entry = undoEntry(actor, originalSnapshot(actor, record.beforeRecord), snapshot(actor));
  await postUndo(loc`${actor.name}: GC die gives +2 Defense for ${record.result.rounds} rounds`, entry ? [entry] : [], {
    gcDice: 1,
    gcDiceSession: record.session,
    gcDefenseDeliveryUuid: message.uuid
  });
}
async function applyResult(actor, message, rolls, { recovering = false, note = "" } = {}) {
  const record = recordOf(message),
    result = npcDefenseResult(record, rolls),
    live = actor.toObject().system.defenseBoost ?? null;
  if (record.state === "complete") return record;
  if (!sameValues(live, record.beforeRecord) && live?.actionDiceReceiptId !== record.id)
    throw Error(loc`The NPC's Defense state changed. Review both sources before completing this boost.`);
  if (!recovering) {
    const combat = game.combats?.get?.(record.combatId);
    if (
      !combat?.started ||
      combat.round !== record.startRound ||
      isDramaticScene() !== record.explodeLow ||
      gcDieType(spendProfile(actor)) !== record.die
    )
      throw Error(
        loc`The combat round, dramatic scene or NPC die changed during the roll. Recover the recorded boost.`
      );
    npcDefensePlan(actor.system, combat, {
      die: record.die,
      balance: 1,
      combatant: [...combat.combatants].some(c => c.actor?.uuid === actor.uuid),
      atStartOfRound: true,
      replaceExisting: record.replaceExisting === true
    });
  }
  try {
    await actor.update(recordReplacementPatch("system.defenseBoost", result, live));
  } catch (error) {
    if (!sameValues(actor.toObject().system.defenseBoost, result)) throw error;
  }
  const complete = {
    ...record,
    rolls,
    result,
    state: "complete",
    ...(recovering ? { recovery: { note, reviewerId: game.user.id } } : {})
  };
  await writeDelivery(message, complete, {
    content: `<p>${loc`${esc(actor.name)}: +2 Defense for ${result.rounds} rounds, through round ${result.expiresAtRound - 1}.`}</p>`
  });
  return complete;
}

export async function boostNpcDefense(actor, input = {}) {
  requireGC(actor);
  const combatsForActor = () =>
    [...(game.combats ?? [])].filter(c => c.started && [...c.combatants].some(t => t.actor?.uuid === actor.uuid));
  if (input.atStartOfRound !== true) {
    const available = combatsForActor();
    if (!available.length) throw Error(loc`The NPC must participate in a started combat to boost Defense.`);
    const active = activeDefenseBoost({
      ...actor.system,
      combatContext: available.find(c => c.id === actor.system.defenseBoost?.combatId)
    });
    const picked = await systemDialog.input({
      window: { title: loc`${actor.name}: boost Defense` },
      rejectClose: false,
      ok: { label: loc`Spend 1 GC die` },
      content: `<p>${loc`One GC die grants +2 Defense; its actual result sets the duration in rounds. Declare this free action at the start of a combat round. An existing action-die boost cannot stack with it.`}</p><label>${loc`Combat`} <select name="combatId">${available.map(c => `<option value="${esc(c.id)}">${esc(c.name ?? c.id)} · ${loc`round ${c.round}`}</option>`).join("")}</select></label>${active ? `<label><input name="replaceExisting" type="checkbox" /> ${loc`Replace the active boost; pay for a new duration without stacking`}</label>` : ""}<label><input name="atStartOfRound" type="checkbox" /> ${loc`Declared at the start of this round`}</label>`
    });
    if (!picked) return null;
    input = { ...input, ...picked };
  }
  return queueResources(
    [actor],
    async () => {
      requireGC(actor);
      if (
        [...game.messages].some(
          m => recordOf(m)?.actorUuid === actor.uuid && ["reserved", "rolling", "rolled"].includes(recordOf(m).state)
        )
      )
        throw Error(loc`Recover the NPC's interrupted Defense delivery before spending or rolling again.`);
      const combats = combatsForActor(),
        combat = input.combatId ? combats.find(c => c.id === input.combatId) : combats.length === 1 ? combats[0] : null;
      if (!combat) throw Error(loc`Choose the NPC's single active combat before boosting Defense.`);
      const status = gcDiceStatus(),
        plan = npcDefensePlan(actor.system, combat, {
          die: gcDieType(spendProfile(actor)),
          balance: status.value,
          combatant: true,
          atStartOfRound: input.atStartOfRound,
          replaceExisting: input.replaceExisting === true
        }),
        record = {
          version: 1,
          id: foundry.utils.randomID(),
          actorUuid: actor.uuid,
          session: status.session,
          ...plan,
          explodeLow: isDramaticScene(),
          replaceExisting: input.replaceExisting === true,
          beforeRecord: structuredClone(actor.toObject().system.defenseBoost ?? null),
          state: "reserved",
          rolls: []
        },
        message = await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<p>${loc`${esc(actor.name)}: NPC Defense boost reserved; waiting for its actual die.`}</p>`,
          whisper: input.public ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id),
          flags: {
            spycraft2: {
              actorUuid: actor.uuid,
              checkKind: "gcDefenseDelivery",
              actionDiceAllowed: false,
              gcDefenseDelivery: record
            }
          }
        });
      let rolling = false;
      try {
        const result = await payGC(
          1,
          async () => {
            try {
              const paid = gcDiceStatus().settlementReview;
              if (paid?.session !== record.session)
                throw Error(loc`The GC session changed before this Defense die could be rolled.`);
              const currentCombat = game.combats?.get?.(record.combatId);
              if (
                !currentCombat?.started ||
                currentCombat.round !== record.startRound ||
                isDramaticScene() !== record.explodeLow ||
                gcDieType(spendProfile(actor)) !== record.die ||
                !sameValues(actor.toObject().system.defenseBoost ?? null, record.beforeRecord)
              )
                throw Error(loc`The NPC, combat round or dramatic scene changed before this die could be rolled.`);
              npcDefensePlan(actor.system, currentCombat, {
                die: record.die,
                balance: 1,
                combatant: [...currentCombat.combatants].some(c => c.actor?.uuid === actor.uuid),
                atStartOfRound: true,
                replaceExisting: record.replaceExisting
              });
              await writeDelivery(message, { ...record, state: "rolling", paymentId: paid.id });
              const rolls = [],
                objects = [];
              for (let i = 0; i < 100; i++) {
                rolling = true;
                const die = await new Roll(`1d${record.die}`).evaluate();
                rolls.push(die.total);
                objects.push(die);
                const current = { ...recordOf(message), rolls: [...rolls] };
                await writeDelivery(message, current, { rolls: objects });
                if (actionDieTotal(record.die, rolls, { explodeLow: record.explodeLow }).complete) {
                  await writeDelivery(message, { ...current, state: "rolled" });
                  return await applyResult(actor, message, rolls);
                }
              }
              throw Error(loc`Review the interrupted exploding die before completing this Defense boost.`);
            } catch (cause) {
              const error = cause instanceof Error ? cause : new Error(String(cause));
              if (rolling) error.actionDiceSettlementReview = true;
              throw error;
            }
          },
          { purpose: loc`NPC Defense boost ${record.id}`, messageUuid: message.uuid }
        );
        await receipt(actor, message);
        return result;
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        if (rolling) {
          error.actionDiceSettlementReview = true;
          try {
            await message.update({
              content: `<p class="bad">${loc`NPC Defense boost interrupted. Review this delivery before spending or rolling again.`}</p>`
            });
          } catch {}
        } else
          await writeDelivery(
            message,
            { ...record, state: "cancelled" },
            { content: `<p>${loc`NPC Defense reservation cancelled before rolling.`}</p>` }
          );
        throw error;
      }
    },
    { workflow: "npcDefenseBoost" }
  );
}

export async function recoverNpcDefense(actor, message, input = {}, handlers = {}) {
  requireGC(actor);
  const initial = recordOf(message);
  if (initial?.kind === "postHit" && handlers.kind !== "postHit")
    throw Error(loc`Use this attack's post-hit Defense recovery.`);
  if (!initial || initial.actorUuid !== actor.uuid || initial.state === "cancelled")
    throw Error(loc`Choose this NPC's interrupted Defense delivery.`);
  const recoveryHelp =
      initial.kind === "postHit"
        ? loc`Use the actual natural results from this die, including explosions, in their original order. Recovery changes only the saved attack's Defense. It rolls no die and makes no new payment. Review the corresponding GC payment as spent.`
        : loc`Use the actual natural results from this one die, including explosions. Saved results must stay in order. No die is rolled and no new payment is made. The boost keeps its original combat round; review the corresponding GC payment as spent.`,
    recoveryConfirmation =
      initial.kind === "postHit"
        ? loc`The GC confirms the actual die, saved attack and paid pool`
        : loc`The GC confirms the actual die, original round and paid pool`;
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Recover NPC Defense boost` },
      rejectClose: false,
      ok: { label: initial.state === "reserved" ? loc`Release unrolled reservation` : loc`Complete recorded boost` },
      content:
        initial.state === "reserved"
          ? `<p>${loc`This reservation never reached the die roll. Release it and return its held payment to the same session's pool, if any. No die is rolled.`}</p><label>${loc`GC review note`} <input name="note" required /></label><label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms this reservation is unrolled`}</label>`
          : `<p>${recoveryHelp}</p><label>${loc`Actual die results (comma separated)`} <input name="results" value="${esc((initial.rolls ?? []).join(", "))}" /></label><label>${loc`GC review note`} <input name="note" required /></label><label><input type="checkbox" name="confirmed" /> ${recoveryConfirmation}</label>`
    });
  }
  if (!input) return null;
  return queueResources(
    [actor, ...(handlers.actors ?? [])],
    async () => {
      requireGC(actor);
      if (recordOf(message)?.state === "reserved") {
        const pool = gcDiceStatus(),
          paid = pool.settlementReview;
        if (input.confirmed !== true || !String(input.note ?? "").trim() || !sameValues(initial, recordOf(message)))
          throw Error(loc`Confirm the unchanged, unrolled reservation before releasing it.`);
        if (paid?.needsReview) {
          if (
            paid.messageUuid !== message.uuid ||
            paid.count !== 1 ||
            paid.session !== pool.session ||
            pool.value !== paid.before - 1
          )
            throw Error(loc`Review the other held GC payment before releasing this reservation.`);
          await reviewGCDiceSettlement({ value: paid.before, resolution: input.note, confirmed: true });
        }
        await writeDelivery(message, {
          ...initial,
          state: "cancelled",
          recovery: { note: input.note, reviewerId: game.user.id }
        });
        return recordOf(message);
      }
      const record = recordOf(message),
        rolls = String(input.results ?? "")
          .split(",")
          .map(v => Number(v.trim()));
      if (
        !sameValues(record, initial) ||
        input.confirmed !== true ||
        !String(input.note ?? "").trim() ||
        !["rolling", "rolled", "complete"].includes(record.state) ||
        (record.rolls ?? []).some((value, idx) => value !== rolls[idx])
      )
        throw Error(loc`Review the current delivery and preserve every saved natural result.`);
      (handlers.validate ?? npcDefenseResult)(record, rolls);
      const pool = gcDiceStatus(),
        payment = pool.settlementReview;
      if (pool.session !== record.session)
        throw Error(loc`The original GC session changed. Review the old payment separately.`);
      if (
        payment?.needsReview &&
        (payment.id !== record.paymentId ||
          payment.messageUuid !== message.uuid ||
          payment.count !== 1 ||
          pool.value !== payment.before - 1)
      )
        throw Error(loc`The held GC payment does not match this Defense delivery.`);
      if (!payment?.needsReview && record.state !== "complete")
        throw Error(loc`Review the missing or changed GC payment before completing this delivery.`);
      const result = await (handlers.apply ?? applyResult)(actor, message, rolls, {
        recovering: true,
        note: String(input.note).trim()
      });
      if (payment?.needsReview)
        await reviewGCDiceSettlement({ value: pool.value, resolution: input.note, confirmed: true });
      await (handlers.receipt ?? receipt)(actor, message);
      return result;
    },
    { workflow: "npcDefenseRecovery", messages: [message, ...(handlers.messages ?? [])] }
  );
}

export function npcDefenseDeliveryControls({ check, actor, message, user }) {
  const source = check?.gcDefenseDelivery;
  if (!user?.isGM || actor?.type !== "npc" || !source || source.kind === "postHit") return [];
  const held = gcDiceStatus().settlementReview;
  return ["reserved", "rolling", "rolled", "complete"].includes(source?.state) &&
    (source.state !== "complete" || !hasReceipt(message) || (held?.needsReview && held.messageUuid === message.uuid))
    ? [
        {
          label: source.state === "reserved" ? loc`Release unrolled reservation` : loc`Recover NPC Defense boost`,
          placement: "card",
          run: () => recoverNpcDefense(actor, message)
        }
      ]
    : [];
}
