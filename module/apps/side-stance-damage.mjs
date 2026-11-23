import { sideStanceAttackRoot } from "./side-stance.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "../rules/equal.mjs";
import { reservedDamageUse } from "./damage-reservation.mjs";
const leases = new WeakMap(),
  active = new Map(),
  values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const message = id =>
  globalThis.fromUuidSync?.(id) ?? values(globalThis.game?.messages).find(m => m.uuid === id || m.id === id);
export function sideDamageUseRows(system) {
  const rows = system.sideStanceDamageUses ?? [],
    seen = new Set();
  if (!Array.isArray(rows)) throw Error(loc`Review the recorded Side Stance damage uses.`);
  for (const r of rows) {
    if (
      r?.version !== 1 ||
      typeof r.rootAttackUuid !== "string" ||
      !r.rootAttackUuid ||
      seen.has(r.rootAttackUuid) ||
      typeof r.attackUuid !== "string" ||
      !r.attackUuid ||
      typeof r.reservationId !== "string" ||
      !r.reservationId ||
      typeof r.targetUuid !== "string" ||
      !r.targetUuid ||
      typeof r.weaponUuid !== "string" ||
      !r.weaponUuid ||
      typeof r.sourceEvidence !== "string" ||
      !r.sourceEvidence ||
      (r.receiptUuid != null && (typeof r.receiptUuid !== "string" || !r.receiptUuid))
    )
      throw Error(loc`Review the recorded Side Stance damage uses.`);
    seen.add(r.rootAttackUuid);
  }
  return rows;
}
export function sideStanceDamageSource(actor, attack, item, { targetUuid } = {}) {
  const c = attack?.flags?.spycraft2,
    p = c?.attackContext?.sideStance;
  if (
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "attack" ||
    c.superseded ||
    c.resolved !== true ||
    c.successConfirmed !== true ||
    c.attackContext?.attackAction !== "standard" ||
    c.attackContext?.ranged !== false ||
    p?.dice !== 1 ||
    !p.attemptId ||
    !p.targetUuid ||
    typeof c.weaponUuid !== "string" ||
    !c.weaponUuid ||
    item?.uuid !== c.weaponUuid
  )
    throw Error(
      loc`Choose a resolved successful Standard Attack with this exact weapon and its recorded Side Stance die.`
    );
  const owned = actor.items?.get?.(item.id) ?? values(actor.items).find(i => i.id === item.id);
  if (
    !owned ||
    owned.uuid !== c.weaponUuid ||
    owned.type !== "weapon" ||
    owned.system.proficiency !== c.weaponProficiency ||
    item.system.proficiency !== c.weaponProficiency
  )
    throw Error(loc`Use the actual owned weapon and operating proficiency of the recorded Side Stance attack.`);
  const actualTarget =
    c.attackContext.targetActorUuid ||
    c.attackContext.characterTarget?.actorUuid ||
    c.attackContext.cheapShot?.targetUuid ||
    c.finalAttack?.opponentUuid ||
    c.finalAttack?.targetUuid;
  if (actualTarget !== p.targetUuid || (targetUuid && targetUuid !== p.targetUuid))
    throw Error(loc`Use the recorded Side Stance attack’s actual target.`);
  const rootAttackUuid = sideStanceAttackRoot(actor, p, attack);
  return {
    version: 1,
    rootAttackUuid,
    attackUuid: attack.uuid,
    sourceAttemptId: p.attemptId,
    stanceId: p.stanceId,
    targetUuid: p.targetUuid,
    weaponUuid: c.weaponUuid,
    sourceEvidence: rollEvidence(c),
    dice: 1
  };
}
export function eligibleSideStanceHits(actor, item) {
  const used = new Set(sideDamageUseRows(actor.system).map(r => r.rootAttackUuid));
  return values(game.messages)
    .filter(m => m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM))
    .flatMap(m => {
      try {
        const proof = sideStanceDamageSource(actor, m, item);
        return used.has(proof.rootAttackUuid) ? [] : [{ message: m, proof }];
      } catch {
        return [];
      }
    });
}
export function makeSideStanceDamageProof(actor, item, attackUuid, { targetUuid } = {}) {
  return {
    ...sideStanceDamageSource(actor, message(attackUuid), item, { targetUuid }),
    reservationId: foundry.utils.randomID()
  };
}
export function hasSideStanceDamageLease(actor, proof, lease) {
  const p = lease && leases.get(lease);
  return p?.actor === actor && p.reservationId === proof?.reservationId;
}
function validateSource(actor, proof) {
  const attack = message(proof.attackUuid),
    item =
      actor.items?.get?.(proof.weaponUuid?.split(".").at(-1)) ??
      values(actor.items).find(i => i.uuid === proof.weaponUuid);
  const expected = sideStanceDamageSource(actor, attack, item, { targetUuid: proof.targetUuid }),
    { reservationId, ...facts } = proof;
  if (typeof reservationId !== "string" || !reservationId || stable(expected) !== stable(facts))
    throw Error(loc`The original Side Stance hit, target or damage source changed.`);
  return expected;
}
function originalDamage(actor, proof, rerollOf) {
  let current = message(rerollOf),
    c = current?.flags?.spycraft2;
  if (
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "damage" ||
    c.resolved ||
    c.superseded ||
    stable(c.sideStanceDamage) !== stable(proof)
  )
    throw Error(loc`Use the actual original damage receipt to replace its Side Stance die.`);
  const use = sideDamageUseRows(actor.system).find(
      r => r.rootAttackUuid === proof.rootAttackUuid && r.reservationId === proof.reservationId
    ),
    seen = new Set();
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    if (current.uuid === use?.receiptUuid) return;
    const previous = message(current.flags?.spycraft2?.rerollOf);
    if (
      !previous ||
      previous.flags?.spycraft2?.actorUuid !== actor.uuid ||
      stable(previous.flags.spycraft2.sideStanceDamage) !== stable(proof)
    )
      break;
    current = previous;
  }
  throw Error(loc`This damage receipt does not own the recorded Side Stance use.`);
}
export function validateSideStanceDamageProof(
  actor,
  proof,
  { checkKind, weaponUuid, sneakAttack, lease, rerollOf } = {}
) {
  if (!proof) return;
  if (
    checkKind !== "damage" ||
    weaponUuid !== proof.weaponUuid ||
    sneakAttack?.active !== true ||
    !sneakAttack.sources?.some(s => s.source === "Side Stance" && s.dice === 1)
  )
    throw Error(loc`Side Stance must augment this recorded attack’s combined sneak damage.`);
  validateSource(actor, proof);
  if (rerollOf) {
    originalDamage(actor, proof, rerollOf);
    return;
  }
  if (
    !hasSideStanceDamageLease(actor, proof, lease) ||
    !sideDamageUseRows(actor.system).some(
      r => r.rootAttackUuid === proof.rootAttackUuid && r.reservationId === proof.reservationId && !r.receiptUuid
    )
  )
    throw Error(loc`Reserve this Side Stance damage use through the original hit.`);
}
export const withSideStanceDamage = reservedDamageUse({
  field: "system.sideStanceDamageUses",
  flag: "sideStanceDamage",
  rows: system => sideDamageUseRows(system),
  validateSource: (actor, proof) => validateSource(actor, proof),
  leases,
  active,
  messages: () => ({
    taken: loc`This Side Stance attack already has damage, or an interrupted damage use awaiting GC review.`,
    changed: loc`The Side Stance damage reservation changed; ask the GC to review it.`,
    review: loc`The Side Stance damage needs GC review; inspect its receipt before retrying.`
  })
});
export async function reviewSideStanceDamage(actor, { reservationId, confirmed = false } = {}) {
  if (!game.user.isGM || !actor.isOwner || confirmed !== true)
    throw Error(loc`The GC must confirm the interrupted Side Stance damage was reviewed.`);
  if (active.has(actor.uuid + ":" + reservationId)) throw Error(loc`This client is still executing that damage roll.`);
  return queueRuleState(actor, async () => {
    const rows = sideDamageUseRows(actor.system),
      use = rows.find(r => r.reservationId === reservationId && !r.receiptUuid);
    if (!use) return null;
    const posted = values(game.messages).filter(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.checkKind === "damage" &&
        m.flags.spycraft2.sideStanceDamage?.reservationId === reservationId
    );
    if (posted.length > 1) throw Error(loc`Multiple damage receipts require manual GC review.`);
    const receipt = posted[0];
    if (
      receipt &&
      (receipt.flags.spycraft2.sideStanceDamage.rootAttackUuid !== use.rootAttackUuid ||
        receipt.flags.spycraft2.sideStanceDamage.sourceEvidence !== use.sourceEvidence)
    )
      throw Error(loc`The posted damage does not match its interrupted Side Stance hit.`);
    await actor.update({
      "system.sideStanceDamageUses": receipt
        ? rows.map(r => (r.reservationId === reservationId ? { ...r, receiptUuid: receipt.uuid } : r))
        : rows.filter(r => r.reservationId !== reservationId)
    });
    return { version: 1, reservationId, receiptUuid: receipt?.uuid ?? null, released: !receipt };
  });
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "sideStanceDamage",
  order: 1050,
  record: ["sideStanceDamage"],
  validate: ({ actor, options, checkKind, weaponUuid }) =>
    validateSideStanceDamageProof(actor, options.sideStanceDamage, {
      checkKind,
      weaponUuid,
      sneakAttack: options.sneakAttack,
      lease: options.sideStanceDamageLease,
      rerollOf: options.rerollOf
    })
});
rollPipeline.register({
  order: 40,
  id: "sideStanceDamageLease",
  acquire({ actor, options }) {
    const proof = options.sideStanceDamage;
    if (!proof || options.rerollOf || hasSideStanceDamageLease(actor, proof, options.sideStanceDamageLease))
      return null;
    return next => withSideStanceDamage(actor, proof, lease => next({ sideStanceDamageLease: lease }));
  }
});
