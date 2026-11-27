import { beginNpcHitDefense, npcHitDefenseOutcome, addNpcHitDefenseDie } from "../../rules/gc/post-hit-defense.mjs";
import { rollEvidence } from "../../rules/outcomes.mjs";
import { actionDieTotal, gcDieType } from "../../rules/gc/gc-spend.mjs";
import { spendProfile } from "./npc-play.mjs";
import { isDramaticScene } from "./state.mjs";
import { readSetting } from "../../settings.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { gcDiceStatus } from "../../services/gc-dice.mjs";
import { sameValues } from "../../rules/equal.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { postUndo } from "../undo.mjs";
import { deliverNpcDefenseDie, writeNpcDefenseDelivery, recoverNpcDefense } from "./npc-defense.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";

const periods = () => {
  const p = readSetting("usagePeriods", {});
  return { session: String(p?.session ?? "initial"), scene: String(p?.scene ?? "initial") };
};
const pending = message => message?.flags?.spycraft2?.npcDefensePending;
const delivery = message => message?.flags?.spycraft2?.gcDefenseDelivery;
const requireGC = () => {
  if (!game.user?.isGM) throw Error(loc`The GC decides post-hit NPC Defense.`);
};
async function writeReview(message, record) {
  try {
    await message.update({ "flags.spycraft2.npcDefensePending": record });
  } catch (error) {
    if (!sameValues(pending(message), record)) throw error;
  }
}
async function context(attack) {
  requireGC();
  const review = pending(attack),
    check = attack?.flags?.spycraft2;
  if (!review || review.attackerUuid !== check?.actorUuid)
    throw Error(loc`Choose an attack waiting for the GC's NPC Defense decision.`);
  const npc = await fromUuid(review.targetUuid),
    attacker = await fromUuid(review.attackerUuid);
  if (npc?.type !== "npc" || !npc.isOwner || !attacker?.isOwner)
    throw Error(loc`The actual NPC or attacking character is unavailable for this decision.`);
  return { review, check, npc, attacker };
}
function unresolvedDelivery(npc, attackUuid = null) {
  return [...(game.messages ?? [])].find(
    m =>
      delivery(m)?.actorUuid === npc.uuid &&
      (!attackUuid || delivery(m).attackUuid === attackUuid) &&
      ["reserved", "rolling", "rolled"].includes(delivery(m).state)
  );
}

/** Record the hit first; defer all hit/miss settlements until the GC finishes its reaction. */
export async function beginNpcDefenseReview(message, attacker, target, resolution) {
  if (!isDramaticScene() || target?.type !== "npc" || !resolution.hit) return null;
  const expected = rollEvidence(message.flags.spycraft2);
  return queueResources(
    [attacker],
    async () => {
      const check = message.flags.spycraft2;
      if (!attacker.isOwner || rollEvidence(check) !== expected || check.resolved || check.superseded)
        throw Error(loc`The attack changed before its NPC Defense decision could be recorded.`);
      if (pending(message)) return pending(message);
      const review = beginNpcHitDefense(check, resolution, {
        id: foundry.utils.randomID(),
        attackerUuid: attacker.uuid,
        targetUuid: target.uuid,
        ...periods(),
        combat: check.rollCombat ?? null,
        feats: attacker.system.activeFeatNames ?? []
      });
      await writeReview(message, review);
      return review;
    },
    { messages: [message] }
  );
}

function actualDie(record, rolls) {
  if (
    record?.kind !== "postHit" ||
    record.explodeLow !== true ||
    ![4, 6, 8, 10, 12].includes(record.die) ||
    !Array.isArray(rolls) ||
    !rolls.length
  )
    throw Error(loc`Review the actual dramatic post-hit Defense die.`);
  const r = actionDieTotal(record.die, rolls, { explodeLow: true });
  if (!r.complete || r.used !== rolls.length) throw Error(loc`Record the complete actual exploding Defense die.`);
  return r.total;
}
async function applyHitDie(npc, source, rolls, { recovering = false, note = "" } = {}) {
  const record = delivery(source);
  if (record.state === "complete") return record;
  const total = actualDie(record, rolls),
    attack = await fromUuid(record.attackUuid),
    ctx = await context(attack);
  if (ctx.npc.uuid !== npc.uuid || ctx.review.id !== record.reviewId)
    throw Error(loc`The post-hit Defense delivery no longer matches its actual NPC and attack.`);
  if (
    !recovering &&
    (!isDramaticScene() ||
      periods().scene !== record.scene ||
      periods().session !== record.session ||
      gcDieType(spendProfile(npc)) !== record.die)
  )
    throw Error(loc`The scene, session or NPC die changed. Recover the saved post-hit Defense die.`);
  const boost = { id: record.id, sourceUuid: source.uuid, die: record.die, rolls: [...rolls], total },
    next = addNpcHitDefenseDie(record.beforeReview, ctx.check, boost);
  if (!sameValues(ctx.review, record.beforeReview) && !sameValues(ctx.review, next))
    throw Error(
      loc`Another decision changed this attack. Review its existing Defense dice before completing this delivery.`
    );
  await writeReview(attack, next);
  const outcome = npcHitDefenseOutcome(next, ctx.check),
    complete = {
      ...record,
      rolls: [...rolls],
      state: "complete",
      afterReview: next,
      result: { total, defense: outcome.defense, hit: outcome.hit, hits: outcome.hits },
      ...(recovering ? { recovery: { reviewerId: game.user.id, note } } : {})
    };
  await writeNpcDefenseDelivery(source, complete, {
    content: `<p>${loc`${esc(npc.name)}: Defense +${total} against this attack only. The attack now ${outcome.hit ? loc`hits` : loc`misses`}; finish its GC decision before damage.`}</p>`
  });
  return complete;
}
async function hitReceipt(npc, source) {
  if ([...(game.messages ?? [])].some(m => m.flags?.spycraft2?.undo?.gcDefenseDeliveryUuid === source.uuid)) return;
  const record = delivery(source);
  await postUndo(loc`${npc.name}: +${record.result.total} Defense against one pending attack`, [], {
    gcDice: 1,
    gcDiceSession: record.session,
    gcDefenseDeliveryUuid: source.uuid,
    npcHitDefenseUndo: {
      actorUuid: npc.uuid,
      attackUuid: record.attackUuid,
      reviewId: record.reviewId,
      before: record.beforeReview,
      after: record.afterReview
    }
  });
}

export async function boostNpcHitDefense(attack, { public: publicResult = false, expectedReview } = {}) {
  const first = await context(attack);
  const expected = structuredClone(expectedReview ?? first.review);
  return queueResources(
    [first.npc, first.attacker],
    async () => {
      const ctx = await context(attack),
        p = periods(),
        pool = gcDiceStatus();
      if (!sameValues(ctx.review, expected))
        throw Error(loc`Another Defense decision changed this attack. Review the current state before spending.`);
      if (ctx.review.state !== "pending" || !npcHitDefenseOutcome(ctx.review, ctx.check).hit)
        throw Error(loc`The attack must still hit before another NPC Defense die is spent.`);
      if (!isDramaticScene() || p.scene !== ctx.review.scene || p.session !== ctx.review.session)
        throw Error(
          loc`The original dramatic scene or session ended. Finalize or review the saved attack without a new die.`
        );
      if (!pool.current || pool.value < 1) throw Error(loc`No initialized GC die is available for this reaction.`);
      if (unresolvedDelivery(ctx.npc))
        throw Error(loc`Recover the NPC's interrupted Defense delivery before rolling again.`);
      const record = {
          version: 1,
          kind: "postHit",
          id: foundry.utils.randomID(),
          actorUuid: ctx.npc.uuid,
          attackUuid: attack.uuid,
          reviewId: ctx.review.id,
          ...p,
          die: gcDieType(spendProfile(ctx.npc)),
          explodeLow: true,
          state: "reserved",
          rolls: [],
          beforeReview: structuredClone(ctx.review)
        },
        source = await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: ctx.npc }),
          whisper: publicResult ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id),
          content: `<p>${loc`${esc(ctx.npc.name)}: post-hit Defense die reserved for this attack.`}</p>`,
          flags: {
            spycraft2: {
              actorUuid: ctx.npc.uuid,
              checkKind: "gcDefenseDelivery",
              actionDiceAllowed: false,
              gcDefenseDelivery: record
            }
          }
        });
      return deliverNpcDefenseDie(ctx.npc, source, record, {
        beforeRoll: async () => {
          const live = await context(attack);
          if (
            !sameValues(live.review, record.beforeReview) ||
            !isDramaticScene() ||
            periods().scene !== record.scene ||
            gcDieType(spendProfile(live.npc)) !== record.die
          )
            throw Error(loc`The pending attack or NPC changed before the Defense die could be rolled.`);
          npcHitDefenseOutcome(live.review, live.check);
        },
        apply: rolls => applyHitDie(ctx.npc, source, rolls),
        receipt: () => hitReceipt(ctx.npc, source)
      });
    },
    { messages: [attack] }
  );
}

export async function recoverNpcHitDefense(npc, source, input = {}) {
  requireGC();
  const record = delivery(source);
  if (record?.kind !== "postHit" || record.actorUuid !== npc.uuid)
    throw Error(loc`Choose the NPC's actual post-hit Defense delivery.`);
  const attack = await fromUuid(record.attackUuid),
    ctx = await context(attack);
  return recoverNpcDefense(npc, source, input, {
    kind: "postHit",
    actors: [ctx.attacker],
    messages: [attack],
    validate: actualDie,
    apply: applyHitDie,
    receipt: hitReceipt
  });
}

export async function reviewNpcHitDefense(attack, { action, finalize } = {}) {
  let ctx = await context(attack);
  const shown = structuredClone(ctx.review);
  if (unresolvedDelivery(ctx.npc, attack.uuid))
    throw Error(loc`Recover the pending Defense die before finalizing this attack.`);
  const result = ctx.review.state === "finalizing" ? ctx.review.final : npcHitDefenseOutcome(ctx.review, ctx.check);
  if (!action) {
    const pool = gcDiceStatus(),
      canBoost =
        ctx.review.state === "pending" &&
        result.hit &&
        isDramaticScene() &&
        periods().scene === ctx.review.scene &&
        periods().session === ctx.review.session &&
        pool.current &&
        pool.value > 0;
    const input = await systemDialog.input({
      window: { title: loc`NPC Defense decision: ${ctx.npc.name}` },
      rejectClose: false,
      ok: { label: loc`Apply decision` },
      content: `<p>${loc`Attack result ${ctx.check.effectiveTotal}; Defense ${result.defense}. This is ${result.hit ? loc`a hit` : loc`a miss`}${result.hits > 1 ? loc` (${result.hits} hits)` : ""}. Damage and on-hit effects wait for final settlement.`}</p><label>${loc`Decision`} <select name="action"><option value="finalize">${loc`Finalize the recorded outcome`}</option>${canBoost ? `<option value="boost">${loc`Spend 1 GC die on Defense against this attack only`}</option>` : ""}${ctx.review.state === "pending" && ctx.review.boosts.length === 0 ? `<option value="correct">${loc`Return the attack for a Defense correction (no dice spent)`}</option>` : ""}</select></label>`
    });
    if (!input) return null;
    action = input.action;
  }
  if (action === "boost") return boostNpcHitDefense(attack, { expectedReview: shown });
  if (action === "correct")
    return queueResources(
      [ctx.npc, ctx.attacker],
      async () => {
        const live = await context(attack);
        if (
          !sameValues(live.review, shown) ||
          live.review.state !== "pending" ||
          live.review.boosts.length ||
          unresolvedDelivery(live.npc, attack.uuid)
        )
          throw Error(loc`Undo any paid Defense dice before returning this attack for correction.`);
        await attack.update({ "flags.spycraft2.-=npcDefensePending": null });
        return null;
      },
      { messages: [attack] }
    );
  if (action !== "finalize" || typeof finalize !== "function")
    throw Error(loc`Finalize this decision from the original attack card.`);
  const expected = shown;
  const prepared = await queueResources(
    [ctx.npc, ctx.attacker],
    async () => {
      ctx = await context(attack);
      if (!sameValues(ctx.review, expected) || unresolvedDelivery(ctx.npc, attack.uuid))
        throw Error(loc`The pending Defense decision changed. Review it again.`);
      if (ctx.review.state === "finalizing") return ctx.review;
      const final = npcHitDefenseOutcome(ctx.review, ctx.check),
        next = { ...ctx.review, state: "finalizing", final, reviewerId: game.user.id };
      await writeReview(attack, next);
      return next;
    },
    { messages: [attack] }
  );
  // The actor's own settlement acquires its resources; do not nest that actor transaction here.
  return finalize(prepared.final, ctx.npc, prepared.id);
}

export async function spendPostHitDefenseForNPC(npc, input = {}) {
  requireGC();
  if (npc?.type !== "npc" || !npc.isOwner)
    throw Error(loc`Choose the actual NPC receiving this post-hit Defense boost.`);
  let uuid = input.attackUuid;
  if (!uuid) {
    const choices = [...(game.messages ?? [])].filter(
      m => pending(m)?.targetUuid === npc.uuid && pending(m).state === "pending"
    );
    if (!choices.length)
      throw Error(loc`Resolve an actual hit against this NPC first; its pending decision identifies the attack.`);
    const picked = await systemDialog.input({
      window: { title: loc`${npc.name}: post-hit Defense die` },
      rejectClose: false,
      ok: { label: loc`Spend 1 GC die` },
      content: `<label>${loc`Pending attack`} <select name="attackUuid">${choices.map(m => `<option value="${esc(m.uuid)}">${esc(pending(m).original.targetName)} · ${loc`attack result ${m.flags.spycraft2.effectiveTotal}`}</option>`).join("")}</select></label>`
    });
    if (!picked) return null;
    uuid = picked.attackUuid;
  }
  const attack = await fromUuid(uuid);
  if (pending(attack)?.targetUuid !== npc.uuid) throw Error(loc`Choose a pending hit on this exact NPC.`);
  return boostNpcHitDefense(attack, { public: input.public === true });
}

export function npcHitDeliveryControls({ check, actor, message, user }) {
  const r = check?.gcDefenseDelivery;
  if (!user?.isGM || actor?.type !== "npc" || r?.kind !== "postHit" || r.state === "cancelled") return [];
  const held = gcDiceStatus().settlementReview,
    hasUndo = [...(game.messages ?? [])].some(m => m.flags?.spycraft2?.undo?.gcDefenseDeliveryUuid === message.uuid);
  return r.state !== "complete" || !hasUndo || (held?.needsReview && held.messageUuid === message.uuid)
    ? [
        {
          label: r.state === "reserved" ? loc`Release unrolled reservation` : loc`Recover post-hit Defense die`,
          placement: "card",
          run: () => recoverNpcHitDefense(actor, message)
        }
      ]
    : [];
}
