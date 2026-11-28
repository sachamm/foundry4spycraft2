import { queueResources } from "../../services/transactions.mjs";
import {
  attackDamageBasis,
  newDamageHitLedger,
  reserveDamageHit,
  damageHitClaim
} from "../../rules/attack-damage-hits.mjs";
import { loc } from "../../i18n.mjs";

const leases = new WeakMap();
const book = actor => actor.flags?.spycraft2?.attackDamageHits ?? {};
const flags = message => message?.flags?.spycraft2;
const posted = (actor, claimId) =>
  [...(game.messages ?? [])].find(
    m => flags(m)?.actorUuid === actor.uuid && flags(m)?.sourceAttack?.claimId === claimId
  );
const write = (actor, id, ledger) => actor.update({ [`flags.spycraft2.attackDamageHits.${id}`]: ledger });

async function change(lease, work) {
  const data = leases.get(lease);
  if (!data) throw Error(loc`Use the original damage roll's reserved hit.`);
  return queueResources([data.actor], async () => {
    const source = await fromUuid(data.sourceUuid);
    const basis = attackDamageBasis(flags(source), { actorUuid: data.actor.uuid, weaponUuid: data.weaponUuid });
    const ledger = structuredClone(book(data.actor)[source.id]);
    const row = damageHitClaim(ledger, basis, data.proof);
    await work(row, data);
    await write(data.actor, source.id, ledger);
  });
}

export function acquireDamageHit(ctx) {
  if (ctx.checkKind !== "damage" || !ctx.options.sourceAttack?.uuid || ctx.options.damageHitLease) return null;
  return async next => {
    const source = await fromUuid(ctx.options.sourceAttack.uuid);
    if (!source) throw Error(loc`The source attack is missing. Ask the GC to review its damage history.`);
    const lease = {},
      actor = ctx.actor;
    let proof;
    await queueResources(
      [actor],
      async () => {
        const check = flags(source);
        if (check.coverInterception?.state === "complete")
          throw Error(loc`Use the original reviewed cover-damage cards. No new hit damage is available.`);
        const basis = attackDamageBasis(check, { actorUuid: actor.uuid, weaponUuid: ctx.weaponUuid });
        let ledger = book(actor)[source.id];
        if (!ledger && check.damageHitsVersion !== 1)
          throw Error(loc`The GC must review this older attack's already rolled hits before more damage is rolled.`);
        ledger = reserveDamageHit(ledger ?? newDamageHitLedger(basis), basis, foundry.utils.randomID());
        const row = ledger.slots.at(-1);
        proof = {
          ...ctx.options.sourceAttack,
          hitIndex: row.index,
          claimId: row.claimId,
          criticalSource: {
            criticalSuccess: check.criticalSuccess === true,
            criticalActivation: structuredClone(check.criticalActivation ?? null),
            ...(check.coverAwaiting && check.coverAwaiting.basis.directHits === 0
              ? {
                  coverCriticalScope: {
                    kind: "cover",
                    id: check.coverAwaiting.id,
                    actorUuid:
                      check.coverAwaiting.criticalTarget?.actorUuid ?? check.coverAwaiting.criticalActorUuid ?? null
                  }
                }
              : {}),
            attackResolution: { hits: basis.hits }
          }
        };
        await write(actor, source.id, ledger);
        leases.set(lease, { actor, sourceUuid: source.uuid, weaponUuid: ctx.weaponUuid, proof, started: false });
      },
      { messages: [source] }
    );
    const settle = async message =>
      change(lease, (row, data) => {
        if (message) {
          row.state = "posted";
          row.messageUuid = message.uuid;
        } else if (row.state !== "rolled") row.state = data.started ? "needsReview" : "cancelled";
      });
    try {
      const result = await next({
        sourceAttack: proof,
        damageHitLease: lease,
        recordRolledResult: async result => {
          await ctx.options.recordRolledResult?.(result);
          await change(lease, row => {
            row.state = "rolled";
            row.actualCheck = structuredClone(result.check);
            row.actualRolls = [result.roll, ...result.alternativeRolls].map(r => r.toJSON());
          });
        }
      });
      const message = posted(actor, proof.claimId);
      await settle(message);
      return message ?? result;
    } catch (error) {
      const message = posted(actor, proof.claimId);
      await settle(message);
      if (message) return message;
      throw error;
    }
  };
}

export async function validateDamageHit(ctx) {
  if (ctx.checkKind !== "damage" || !ctx.options.sourceAttack?.uuid) return;
  const lease = ctx.options.damageHitLease,
    data = leases.get(lease);
  if (
    !data ||
    data.actor !== ctx.actor ||
    data.weaponUuid !== ctx.weaponUuid ||
    JSON.stringify(data.proof) !== JSON.stringify(ctx.options.sourceAttack)
  )
    throw Error(loc`Use the original damage roll's reserved hit.`);
  await change(lease, (row, claim) => {
    if (ctx.phase === "before") {
      if (row.state !== "reserved") throw Error(loc`This hit already started its damage roll.`);
      row.state = "started";
      claim.started = true;
    } else if (row.state !== "started") throw Error(loc`Review this hit's interrupted damage roll.`);
  });
}

export function damageHitCount(actor, attack) {
  const ledger = book(actor)[attack.id];
  return ledger ? ledger.legacyUsed + ledger.slots.filter(r => r.state !== "cancelled").length : null;
}

export function assertDamageNotStarted(actor, message) {
  const check = flags(message);
  if (
    (check?.checkKind === "attack" && damageHitCount(actor, message) > 0) ||
    check?.damageApplicationStarted ||
    check?.coverDamageFrozen
  )
    throw Error(
      loc`Damage already started. Review its original hit and application receipts before changing this result.`
    );
}

export async function reviewDamageHits(actor, source, { legacyUsed, consumeClaimId, restoreClaimId } = {}) {
  if (!game.user?.isGM || !actor?.isOwner) throw Error(loc`Only the GC reviews an attack's damage history.`);
  return queueResources(
    [actor],
    async () => {
      const check = flags(source);
      const basis = attackDamageBasis(check, { actorUuid: actor.uuid, weaponUuid: check.weaponUuid });
      let ledger = structuredClone(book(actor)[source.id]);
      if (!ledger) {
        if (!Number.isSafeInteger(legacyUsed)) throw Error(loc`Enter the reviewed number of already rolled hits.`);
        ledger = newDamageHitLedger(basis, { legacyUsed });
        await write(actor, source.id, ledger);
        return ledger;
      }
      const claimId = consumeClaimId ?? restoreClaimId;
      const saved = ledger.slots.find(r => r.claimId === claimId);
      if (!saved) throw Error(loc`Choose the original reserved hit to review.`);
      const row = damageHitClaim(ledger, basis, { claimId, hitIndex: saved.index });
      if (consumeClaimId) row.state = "consumed";
      else {
        const existing = posted(actor, claimId);
        if (existing) return existing;
        if (!row.actualCheck || !row.actualRolls?.length)
          throw Error(loc`This hit has no saved actual result. Review and consume it without rolling again.`);
        const message = await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: String(row.actualCheck.effectiveTotal),
          rolls: row.actualRolls.map(r => Roll.fromJSON(typeof r === "string" ? r : JSON.stringify(r))),
          whisper: [...(source.whisper ?? [])],
          blind: !!source.blind,
          flags: { spycraft2: structuredClone(row.actualCheck) }
        });
        row.state = "posted";
        row.messageUuid = message.uuid;
      }
      await write(actor, source.id, ledger);
      return ledger;
    },
    { messages: [source] }
  );
}

/** Called inside the spender's resource transaction after a paid damage boost. */
export async function rememberDamageBoost(actor, message, check) {
  if (check.checkKind !== "damage" || !check.sourceAttack?.claimId) return;
  const source = await fromUuid(check.sourceAttack.uuid);
  const ledger = structuredClone(book(actor)[source?.id]);
  const row = ledger?.slots?.find(r => r.claimId === check.sourceAttack.claimId);
  if (!row || !row.actualCheck || row.index !== check.sourceAttack.hitIndex)
    throw Error(loc`Review the original damage hit before boosting its saved result.`);
  row.actualCheck = structuredClone(check);
  row.actualRolls = [...message.rolls].map(r => r.toJSON());
  await write(actor, source.id, ledger);
}

export async function markDamageApplicationStart(message, value) {
  if (!flags(message)?.sourceAttack?.claimId) {
    await message.update({ "flags.spycraft2.damageApplicationStarted": value });
    return true;
  }
  const actor = await fromUuid(flags(message)?.actorUuid);
  if (!actor?.isOwner) throw Error(loc`The damage roll's owner or GC must record its application.`);
  return queueResources(
    [actor],
    async () => {
      await message.update({ "flags.spycraft2.damageApplicationStarted": value });
      await rememberDamageBoost(actor, message, flags(message));
      return true;
    },
    { messages: [message] }
  );
}
