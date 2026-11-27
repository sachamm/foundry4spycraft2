import {
  temporarySharePlan,
  SHARE_ABILITIES,
  temporaryFeatActive,
  sameFeatSelection
} from "../../rules/temporary-feats.mjs";
import { recordReplacementPatch } from "../../rules/record-patch.mjs";
import { sameValues } from "../../rules/equal.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";

const current = (actor, ability) => actor.system.temporaryShares?.[ability];
const epoch = actor => String(actor.usagePeriods.session ?? "initial");
const pending = claim => ["pending", "needsReview"].includes(claim?.state);
const grantOf = item => item.system?.temporaryGrant;
const matching = (actor, claim, sourceFeatId) =>
  [...actor.items].filter(
    item =>
      item.type === "feat" &&
      item.system.featKind === "temporary" &&
      grantOf(item)?.sourceActorUuid === claim.sourceActorUuid &&
      grantOf(item)?.grantId === claim.id &&
      (sourceFeatId === undefined || grantOf(item).sourceFeatId === sourceFeatId)
  );

function validateClaim(source, claim) {
  if (
    !source.isOwner ||
    claim?.version !== 1 ||
    !claim.id ||
    claim.sourceActorUuid !== source.uuid ||
    !SHARE_ABILITIES[claim.ability] ||
    !Array.isArray(claim.recipients) ||
    !claim.recipients.length ||
    !Array.isArray(claim.grants) ||
    claim.grants.length !== claim.featIds?.length ||
    !Array.isArray(claim.delivered)
  )
    throw Error(loc`Review the original shared-feat selection and its recipient history.`);
  for (const [index, data] of claim.grants.entries()) {
    const g = data.system?.temporaryGrant;
    if (
      data.type !== "feat" ||
      data.system.featKind !== "temporary" ||
      !data.system.granted ||
      g?.grantId !== claim.id ||
      g.sourceActorUuid !== source.uuid ||
      g.epoch !== claim.epoch ||
      g.sourceFeatId !== claim.featIds[index] ||
      g.ability !== claim.ability
    )
      throw Error(loc`The recorded shared feats changed. Ask the GC to review the original selection.`);
  }
}
async function recipientsOf(source, claim) {
  validateClaim(source, claim);
  const actors = await Promise.all(claim.recipients.map(uuid => fromUuid(uuid)));
  if (actors.some(a => !a?.isOwner || a.type !== "agent" || a.uuid === source.uuid))
    throw Error(loc`Choose teammates you can update; ask the GC to review unavailable recipients.`);
  return actors;
}
async function writeClaim(source, claim) {
  const before = source.system.temporaryShares ?? {},
    next = { ...structuredClone(before), [claim.ability]: structuredClone(claim) };
  try {
    await source.update(recordReplacementPatch("system.temporaryShares", next, before));
  } catch (error) {
    if (!sameValues(current(source, claim.ability), claim)) throw error;
  }
}
function cardContent(claim) {
  return `<div class="spycraft2 chat-note"><p>${loc`${SHARE_ABILITIES[claim.ability].name}: ${esc(claim.grants.map(f => f.name).join(", "))}. ${claim.state === "complete" ? loc`Recipient grants recorded.` : claim.state === "withdrawn" ? loc`Recipient grants undone; the session selection remains consumed.` : loc`Delivery needs GC review before another selection.`}`}</p></div>`;
}
async function updateCard(source, claim, message = null) {
  message ??= claim.messageUuid ? await fromUuid(claim.messageUuid) : null;
  if (
    message &&
    (message.flags?.spycraft2?.actorUuid !== source.uuid || message.flags?.spycraft2?.temporaryShare?.id !== claim.id)
  )
    message = null;
  if (message) {
    if (!(message.isAuthor || game.user?.isGM)) throw Error(loc`The GC must update the original shared-feat card.`);
    await message.update({ "flags.spycraft2.temporaryShare": claim, content: cardContent(claim) });
    return message;
  }
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    whisper: claim.audience ?? [
      ...new Set([game.user.id, ...(ChatMessage.getWhisperRecipients?.("GM") ?? []).map(u => u.id)])
    ],
    content: cardContent(claim),
    flags: { spycraft2: { actorUuid: source.uuid, checkKind: "temporaryShare", temporaryShare: claim } }
  });
}
async function ensureCard(source, claim) {
  const message = await updateCard(source, claim);
  if (claim.messageUuid !== message.uuid) {
    claim = { ...claim, messageUuid: message.uuid };
    await writeClaim(source, claim);
    await updateCard(source, claim, message);
  }
  return claim;
}
async function flagReview(source, claim, error) {
  const next = {
    ...(current(source, claim.ability) ?? claim),
    state: "needsReview",
    reason: String(error.message ?? error)
  };
  try {
    await writeClaim(source, next);
    await updateCard(source, next);
  } catch {
    /* The original durable claim still blocks another selection. */
  }
}

/** Every positive delivery is retained even if the feat is subsequently removed. */
async function deliver(source, claim, actors, { finishMissing = true } = {}) {
  let next = structuredClone(claim);
  for (const actor of actors)
    for (const [index, template] of next.grants.entries()) {
      const sourceFeatId = next.featIds[index];
      if (next.delivered.some(d => d.actorUuid === actor.uuid && d.sourceFeatId === sourceFeatId)) continue;
      const existing = matching(actor, next, sourceFeatId);
      if (existing.length > 1) throw Error(loc`Duplicate shared grants need GC review before delivery can finish.`);
      let item = existing[0],
        outcome = "recorded";
      if (!item && finishMissing) {
        if (epoch(source) !== next.epoch)
          throw Error(loc`The session changed. Review existing grants without adding expired feats.`);
        const possessed = [...actor.items].find(
          f =>
            f.type === "feat" &&
            temporaryFeatActive({ ...actor.system, usagePeriods: actor.usagePeriods }, f) &&
            sameFeatSelection(template, f, CONFIG.SPYCRAFT)
        );
        if (possessed) {
          item = possessed;
          outcome = "alreadyOwned";
        } else {
          const data = structuredClone(template);
          data.system.acquiredAtLevel = Math.max(1, actor.system.level ?? 1);
          const docs = await actor.createEmbeddedDocuments("Item", [data]);
          item = docs[0];
          outcome = "created";
          if (!item?.id)
            throw Error(loc`The shared feat's delivery could not be confirmed. Ask the GC to review its recipient.`);
        }
      }
      next = {
        ...next,
        delivered: [
          ...next.delivered,
          { actorUuid: actor.uuid, sourceFeatId, id: item?.id ?? "", outcome: item ? outcome : "reviewedMissing" }
        ]
      };
      await writeClaim(source, next);
    }
  next = { ...next, state: "complete" };
  delete next.reason;
  await writeClaim(source, next);
  await updateCard(source, next);
  return next;
}

export async function shareFeats(source, ability, input) {
  if (!source.isOwner) throw Error(loc`You must own the source actor.`);
  if (
    !Array.isArray(input.recipients) ||
    input.recipients.some(a => !a?.isOwner || a.type !== "agent" || typeof a.uuid !== "string" || !a.uuid)
  )
    throw Error(loc`Choose teammates you can update; ask the GC to apply sharing for other players.`);
  const actors = [...new Map((input.recipients ?? []).map(a => [a.uuid, a])).values()];
  if (!actors.length || actors.some(a => a.uuid === source.uuid || a.type !== "agent" || !a.isOwner))
    throw Error(loc`Choose teammates you can update; ask the GC to apply sharing for other players.`);
  return queueResources([source, ...actors], async () => {
    if (pending(current(source, ability)))
      throw Error(loc`Review the interrupted shared-feat delivery before another selection.`);
    const data = temporarySharePlan(source.system, source.items, ability, input.featIds, {
      epoch: epoch(source),
      atSessionStart: !!input.atSessionStart,
      sourceActorUuid: source.uuid
    });
    const id = globalThis.foundry?.utils?.randomID?.() ?? globalThis.crypto.randomUUID();
    let claim = {
      version: 1,
      id,
      sourceActorUuid: source.uuid,
      ability,
      epoch: epoch(source),
      state: "pending",
      featIds: [...input.featIds],
      recipients: actors.map(a => a.uuid),
      audience: [
        ...new Set([
          game.user.id,
          ...(ChatMessage.getWhisperRecipients?.("GM") ?? []).map(u => u.id),
          ...[...(game.users ?? [])]
            .filter(u => [source, ...actors].some(a => a.testUserPermission?.(u, "OWNER")))
            .map(u => u.id)
        ])
      ],
      delivered: [],
      grants: data.map((row, index) => ({
        ...row,
        system: {
          ...row.system,
          temporaryGrant: { ...row.system.temporaryGrant, grantId: id, sourceFeatId: input.featIds[index] }
        }
      }))
    };
    await writeClaim(source, claim);
    try {
      claim = await ensureCard(source, claim);
      return await deliver(source, claim, actors);
    } catch (error) {
      await flagReview(source, claim, error);
      throw error;
    }
  });
}

export async function restoreShareCard(source, ability) {
  return queueResources([source], async () => {
    const claim = current(source, ability);
    validateClaim(source, claim);
    const existing = claim.messageUuid ? await fromUuid(claim.messageUuid) : null;
    if (
      existing?.flags?.spycraft2?.actorUuid === source.uuid &&
      existing.flags.spycraft2.temporaryShare?.id === claim.id
    )
      return claim;
    return ensureCard(source, claim);
  });
}

export async function recoverShare(source, ability, input, ask) {
  if (!game.user?.isGM) throw Error(loc`The GC reviews interrupted shared-feat grants.`);
  const initial = structuredClone(current(source, ability));
  validateClaim(source, initial);
  if (input.grantId && input.grantId !== initial.id)
    throw Error(loc`Review the shared-feat selection on its current source card.`);
  if (!pending(initial)) return initial;
  if (input.confirmed !== true) {
    input = await ask({
      window: { title: loc`Review shared-feat grants` },
      rejectClose: false,
      ok: { label: loc`Record delivery review` },
      content: `<p>${loc`Stop the original action and inspect each recipient. Recorded deliveries stay consumed even if their feats were later removed. Keep the original selection; do not choose new feats.`}</p><label>${loc`Recovery`} <select name="action"><option value="consume">${loc`Keep existing grants; retain consumption of missing grants`}</option><option value="finish">${loc`Complete only grants confirmed never delivered`}</option></select></label><label>${loc`GC review note`} <input name="note" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The original action has stopped and the GC checked recipient history`}</label>`
    });
  }
  if (!input) return null;
  const actors = await recipientsOf(source, initial);
  return queueResources(
    [source, ...actors],
    async () => {
      let claim = current(source, ability);
      if (
        !sameValues(claim, initial) ||
        input.confirmed !== true ||
        !["consume", "finish"].includes(input.action) ||
        !String(input.note ?? "").trim()
      )
        throw Error(loc`Review the unchanged selection, actual recipient history and GC note.`);
      claim = {
        ...claim,
        recovery: { note: String(input.note).trim(), reviewerId: game.user.id, action: input.action }
      };
      try {
        await writeClaim(source, claim);
        claim = await ensureCard(source, claim);
        return await deliver(source, claim, actors, { finishMissing: input.action === "finish" });
      } catch (error) {
        await flagReview(source, claim, error);
        throw error;
      }
    },
    { messages: initial.messageUuid ? [await fromUuid(initial.messageUuid)].filter(Boolean) : [] }
  );
}

export async function withdrawShare(source, ability, input, ask) {
  if (!game.user?.isGM) throw Error(loc`The GC undoes shared-feat grants.`);
  const messageUuid = input.messageUuid ?? current(source, ability)?.messageUuid,
    message = messageUuid ? await fromUuid(messageUuid) : null,
    card = message?.flags?.spycraft2?.temporaryShare,
    latest = current(source, ability),
    initial = structuredClone(card && latest?.id !== card.id ? card : latest);
  validateClaim(source, initial);
  const actors = await recipientsOf(source, initial);
  if (input.confirmed !== true) {
    input = await ask({
      window: { title: loc`Undo shared-feat grants` },
      rejectClose: false,
      ok: { label: loc`Undo recipient grants` },
      content: `<p>${loc`Remove only temporary feats created by this selection. Previously owned feats remain. The source's session selection stays consumed.`}</p><label><input name="confirmed" type="checkbox" /> ${loc`Undo this selection's recipient grants`}</label>`
    });
  }
  if (!input?.confirmed) return null;
  return queueResources(
    [source, ...actors],
    async () => {
      const live = current(source, ability),
        fresh = live?.id === initial.id ? live : message?.flags?.spycraft2?.temporaryShare;
      if (!sameValues(fresh, initial)) throw Error(loc`The shared-feat record changed. Review its current grants.`);
      for (const actor of actors) {
        const ids = matching(actor, initial).map(i => i.id);
        if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
      }
      const next = { ...initial, state: "withdrawn" };
      if (current(source, ability)?.id === initial.id) {
        await writeClaim(source, next);
        await ensureCard(source, next);
      } else await updateCard(source, next, message);
      return next;
    },
    { messages: message ? [message] : [] }
  );
}
