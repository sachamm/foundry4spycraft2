import { queueResources } from "../../services/transactions.mjs";
import { recordReplacementPatch } from "../../rules/record-patch.mjs";
import { grappleDamageAward } from "../../rules/grapple-damage.mjs";
import { sameValues } from "../../rules/equal.mjs";
import { loc } from "../../i18n.mjs";

const book = actor => actor.flags?.spycraft2?.grappleDamage ?? {};
const path = key => `flags.spycraft2.grappleDamage.${key}`;
const save = (actor, key, row) => actor.update(recordReplacementPatch(path(key), row, book(actor)[key]));
const card = claimId => [...(game.messages ?? [])].find(m => m.flags?.spycraft2?.grappleDamage?.claimId === claimId);
function claim(actor, proof) {
  const row = book(actor)[proof?.key];
  if (!row || !sameValues(row.proof, proof) || proof.actorUuid !== actor.uuid || row.state === "cancelled")
    throw Error(loc`Use the original earned grapple benefit and its saved damage.`);
  return row;
}

export async function reserveGrappleDamage(
  actor,
  source,
  index,
  plan,
  selection,
  { resources = [], prepare = null, validate = null } = {}
) {
  if (!actor?.isOwner) throw Error(loc`The grapple winner's owner or GC rolls its benefit damage.`);
  const award = grappleDamageAward(source, index, actor.uuid),
    key = `${source.id}-${index}`;
  return queueResources([actor, ...resources], async () => {
    await validate?.();
    if (!sameValues(award, grappleDamageAward(source, index, actor.uuid)))
      throw Error(loc`The earned grapple benefit changed before its damage was reserved.`);
    const old = book(actor)[key];
    if (old && old.state !== "cancelled")
      throw Error(loc`This benefit already has original damage or needs GC review. Do not roll it again.`);
    const proof = { ...award, key, claimId: foundry.utils.randomID() };
    await save(actor, key, {
      version: 1,
      proof,
      plan: structuredClone(plan),
      selection: structuredClone(selection),
      state: "reserved"
    });
    if (prepare) {
      await save(actor, key, { ...book(actor)[key], state: "started" });
      const prepared = await prepare();
      await save(actor, key, { ...book(actor)[key], state: "reserved", prepared });
    }
    return proof;
  });
}

export async function validateGrappleDamage(actor, proof, plan) {
  return queueResources([actor], async () => {
    const row = claim(actor, proof),
      source = await fromUuid(proof.sourceUuid);
    if (
      !sameValues(
        grappleDamageAward(source, proof.index, actor.uuid),
        Object.fromEntries(Object.entries(proof).filter(([k]) => !["key", "claimId"].includes(k)))
      ) ||
      !sameValues(plan, row.plan) ||
      !["reserved", "started", "rolled"].includes(row.state)
    )
      throw Error(loc`The winner, weapon or earned benefit changed. Preserve any actual damage for GC review.`);
    if (row.state === "reserved") await save(actor, proof.key, { ...row, state: "started" });
  });
}

export async function recordGrappleDamageDice(actor, proof, result) {
  return queueResources([actor], async () => {
    const row = claim(actor, proof);
    if (row.state !== "started") throw Error(loc`The original grapple damage roll is not waiting for its actual dice.`);
    await save(actor, proof.key, {
      ...row,
      state: "rolled",
      actualCheck: structuredClone(result.check),
      actualRolls: [result.roll, ...result.alternativeRolls].map(r => r.toJSON())
    });
  });
}

export async function settleGrappleDamageRoll(actor, proof) {
  return queueResources([actor], async () => {
    const row = claim(actor, proof),
      posted = card(proof.claimId);
    await save(actor, proof.key, {
      ...row,
      state: posted ? "posted" : row.state === "reserved" ? "cancelled" : row.actualRolls ? "rolled" : "needsReview",
      ...(posted ? { messageUuid: posted.uuid } : {})
    });
    return posted;
  });
}

/** Called inside the actor's existing payment/application transaction. */
export async function rememberGrappleDamage(actor, message, check) {
  if (!check.grappleDamage?.claimId) return;
  const row = claim(actor, check.grappleDamage);
  if (!row.actualCheck || !row.actualRolls)
    throw Error(loc`Review this benefit's original damage dice before changing its card.`);
  await save(actor, check.grappleDamage.key, {
    ...row,
    actualCheck: structuredClone(check),
    actualRolls: [...message.rolls].map(r => r.toJSON())
  });
}

export async function reviewGrappleDamage(actor, key, { decision = "restore", note = "" } = {}) {
  if (!game.user?.isGM || !actor?.isOwner) throw Error(loc`The GC reviews interrupted grapple damage.`);
  return queueResources([actor], async () => {
    const row = structuredClone(book(actor)[key]);
    if (!row?.proof) throw Error(loc`Choose the original grapple damage benefit.`);
    if (decision === "keep") {
      if (typeof note !== "string" || !note.trim())
        throw Error(loc`Record what actually happened before keeping this benefit consumed.`);
      await save(actor, key, { ...row, state: "consumed", review: { note: note.trim(), userId: game.user.id } });
      return null;
    }
    if (decision !== "restore" || !row.actualRolls?.length || !row.actualCheck)
      throw Error(loc`This benefit has no saved actual dice to restore. Keep unknown dice consumed after GC review.`);
    let message = card(row.proof.claimId);
    if (!message)
      message = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: row.actualCheck.baseFlavor ?? "",
        rolls: row.actualRolls.map(r => Roll.fromJSON(typeof r === "string" ? r : JSON.stringify(r))),
        flags: { spycraft2: row.actualCheck }
      });
    await save(actor, key, { ...row, state: "posted", messageUuid: message.uuid });
    return message;
  });
}

export async function validateGrappleDamageDelivery(message, targetUuid) {
  const check = message.flags?.spycraft2,
    proof = check?.grappleDamage;
  if (!proof) return null;
  const actor = await fromUuid(proof.actorUuid),
    row = actor && claim(actor, proof);
  if (
    !row?.actualCheck ||
    !["rolled", "posted"].includes(row.state) ||
    row.actualCheck.effectiveTotal !== check.effectiveTotal ||
    targetUuid !== proof.targetUuid ||
    !sameValues(row.plan.profile, check.damageProfile)
  )
    throw Error(
      loc`Apply the original earned grapple damage only to its recorded opponent, with its recorded damage type.`
    );
  return row.plan;
}
