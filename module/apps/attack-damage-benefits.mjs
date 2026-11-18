import { validateRecordedMeleeArmorPiercing } from "../rules/melee-armor-piercing.mjs";
import { validRecordedMeleeTrick } from "../rules/melee-tricks.mjs";
import { bullseyeDamageSourceFacts } from "../rules/bullseye.mjs";
import { ownedWeaponTraining, weaponSourceIdentity } from "../rules/weapon-training.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { impaleDamageBonus } from "../rules/sword-basics.mjs";
import { loc } from "../i18n.mjs";
const leases = new WeakMap(),
  active = new Map(),
  stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map(k => [k, x[k]])
          )
        : x
    ),
  values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const message = id =>
  globalThis.fromUuidSync?.(id) ?? values(globalThis.game?.messages).find(m => m.uuid === id || m.id === id);
export function attackDamageUseRows(system) {
  const rows = system.attackDamageUses ?? [],
    seen = new Set();
  if (!Array.isArray(rows)) throw Error(loc`Review the recorded attack damage bonus uses.`);
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
      throw Error(loc`Review the recorded attack damage bonus uses.`);
    seen.add(r.rootAttackUuid);
  }
  return rows;
}
export const attackTradeoffProof = c =>
  c?.attackContext?.meleeTradeoff && c?.attackContext?.bullseye
    ? null
    : (c?.attackContext?.meleeTradeoff ?? c?.attackContext?.bullseye ?? null);
const damageDeclaration = c =>
  c?.attackContext?.meleeTrick
    ? { tradeoff: attackTradeoffProof(c), trick: c.attackContext.meleeTrick }
    : attackTradeoffProof(c);
/** Follow only the actually adopted replacement chain, with the same earned declaration. */
function attackRoot(actor, attack, proof) {
  const seen = new Set();
  let current = attack;
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const c = current.flags?.spycraft2;
    if (c?.actorUuid !== actor.uuid || c.checkKind !== "attack" || stable(damageDeclaration(c)) !== stable(proof))
      throw Error(loc`The original earned attack bonus changed.`);
    if (!c.rerollOf) return current.uuid;
    const previous = message(c.rerollOf);
    if (previous?.flags?.spycraft2?.superseded !== current.uuid || previous.flags.spycraft2.weaponUuid !== c.weaponUuid)
      throw Error(loc`Use the actually adopted original attack replacement chain.`);
    current = previous;
  }
  throw Error(loc`The original attack chain is missing or cyclic.`);
}
/** Historical facts authorize bookkeeping, never a new roll or a substitute Item. */
function recordedAttackDamageFacts(actor, attack, { targetUuid, impaleDefense } = {}) {
  const c = attack?.flags?.spycraft2,
    trade = attackTradeoffProof(c),
    declaredTrick = c?.attackContext?.meleeTrick,
    trick =
      declaredTrick?.damageBonus === 0 &&
      !declaredTrick?.grantedQuality &&
      !declaredTrick?.sneakDice &&
      declaredTrick?.key !== "impale"
        ? null
        : declaredTrick,
    p = trade ?? trick,
    bullseye = trade?.source === "Bullseye",
    allOut = trade?.source === "All-out Attack";
  const validTrade =
      trade &&
      (bullseye || allOut) &&
      trade.version === 1 &&
      Number.isSafeInteger(trade.penalty) &&
      trade.penalty >= 1 &&
      trade.damageBonus === (bullseye ? trade.penalty : 2 * trade.penalty),
    validTrick = trick && validRecordedMeleeTrick(trick, c?.attackContext);
  if (
    declaredTrick &&
    !trick &&
    (!validRecordedMeleeTrick(declaredTrick, c?.attackContext) ||
      (trade && declaredTrick.targetUuid !== trade.targetUuid))
  )
    throw Error(loc`The original zero-bonus melee trick declaration or target changed.`);
  if (
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "attack" ||
    c.superseded ||
    c.resolved !== true ||
    c.successConfirmed !== true ||
    c.attackContext?.ranged !== (bullseye ? true : false) ||
    c.attackContext?.disarm?.active === true ||
    (!validTrade && !validTrick) ||
    (trade && !validTrade) ||
    (trick && !validTrick) ||
    (trick?.grantedQuality === "TKD" && !/\bTKD\b/.test(c.weaponQualities ?? "")) ||
    (trade && trick && (bullseye || trade.targetUuid !== trick.targetUuid || trade.weaponId !== trick.weaponId)) ||
    !p?.targetUuid ||
    typeof c.weaponUuid !== "string" ||
    !c.weaponUuid ||
    (bullseye &&
      (c.attackContext.attackAction !== "standard" ||
        p.singleShotConfirmed !== true ||
        (p.firearm && c.attackContext.fireMode !== "single") ||
        (c.attackContext.fireMode ?? null) !== p.fireMode))
  )
    throw Error(loc`Choose a resolved successful recorded attack with this exact weapon and its earned damage bonus.`);
  const named =
    c.attackContext.characterTarget?.source === "gcManual" ? c.attackContext.characterTarget.name : p.manualTargetName;
  if (
    p.manualTargetName &&
    (typeof named !== "string" ||
      !named.trim() ||
      named.length > 200 ||
      p.targetConfirmed !== true ||
      named !== p.manualTargetName)
  )
    throw Error(loc`Review the recorded GC-confirmed target name.`);
  if (
    trick &&
    stable({
      targetUuid: trick.targetUuid,
      manualTargetName: trick.manualTargetName,
      targetConfirmed: trick.targetConfirmed
    }) !==
      stable({ targetUuid: p.targetUuid, manualTargetName: p.manualTargetName, targetConfirmed: p.targetConfirmed })
  )
    throw Error(loc`Use the same actual target for the melee trick and attack damage.`);
  const actualTarget =
    c.attackContext.targetActorUuid ||
    c.attackContext.characterTarget?.actorUuid ||
    c.attackContext.cheapShot?.targetUuid ||
    c.finalAttack?.opponentUuid ||
    c.finalAttack?.targetUuid ||
    (p.manualTargetName ? "manual:" + named : null);
  if (actualTarget !== p.targetUuid || (targetUuid && targetUuid !== p.targetUuid))
    throw Error(loc`Use the recorded attack’s actual target.`);
  const rootAttackUuid = attackRoot(actor, attack, damageDeclaration(c));
  // Impale's bonus comes from the GC-confirmed Defense, which is recorded with the damage.
  const impale =
    trick?.key === "impale" && impaleDefense !== undefined
      ? {
          defense: impaleDefense,
          attackResult: c.effectiveTotal,
          bonus: impaleDamageBonus(c.effectiveTotal, impaleDefense)
        }
      : null;
  return {
    version: 1,
    rootAttackUuid,
    attackUuid: attack.uuid,
    targetUuid: p.targetUuid,
    weaponUuid: c.weaponUuid,
    sourceEvidence: rollEvidence(c),
    source: [trade?.source, trick?.source].filter(Boolean).join(" + "),
    bonus: (trade?.damageBonus ?? 0) + (trick?.damageBonus ?? 0) + (impale?.bonus ?? 0),
    ...(impale ? { impale } : {}),
    ...(trick?.grantedQuality ? { grantedQuality: trick.grantedQuality } : {}),
    ...(trick?.sneakDice ? { sneakDice: trick.sneakDice, sneakSource: trick.source } : {}),
    ...(p.manualTargetName ? { manualTargetName: p.manualTargetName } : {}),
    ...(bullseye || trick
      ? {
          operatingProficiency: c.weaponProficiency,
          hands: (trick ?? p).grip.hands,
          ...(bullseye && /as (?:arrow|bolt)/i.test(p.damageSource.damage) && p.damageSource.ammunition
            ? { projectile: { ...p.damageSource.ammunition, label: p.projectileLabel } }
            : {})
        }
      : {})
  };
}

export function attackDamageBenefitSource(actor, attack, item, { targetUuid, historical = false, impaleDefense } = {}) {
  const facts = recordedAttackDamageFacts(actor, attack, { targetUuid, impaleDefense }),
    c = attack.flags.spycraft2,
    p = attackTradeoffProof(c) ?? c.attackContext.meleeTrick,
    profile = c.attackContext.meleeTrick ?? (p.source === "Bullseye" ? p : null);
  if (item?.uuid !== c.weaponUuid) throw Error(loc`Choose the recorded attack’s exact weapon.`);
  const owned = actor.items?.get?.(item.id) ?? values(actor.items).find(i => i.id === item.id);
  if (!owned || owned.uuid !== c.weaponUuid || owned.type !== "weapon" || p.weaponId !== owned.id)
    throw Error(loc`Use the actual owned weapon and operating proficiency of the recorded attack.`);
  const training = ownedWeaponTraining(actor, p, {
    checkKind: "attack",
    weaponUuid: c.weaponUuid,
    weaponProficiency: c.weaponProficiency,
    attackContext: c.attackContext
  });
  if (profile) {
    if (
      stable(profile.weaponSource) !==
      stable(
        weaponSourceIdentity({ ...owned.system, id: owned.id }, { operatingProficiency: training.operatingProficiency })
      )
    )
      throw Error(loc`The recorded attack weapon identity or operating proficiency changed.`);
    if (!historical) {
      const ammo = owned.system.loadedAmmoId
          ? (actor.items?.get?.(owned.system.loadedAmmoId) ??
            values(actor.items).find(i => i.id === owned.system.loadedAmmoId))
          : null,
        ammunition = ammo ? { ...ammo.system, name: ammo.name } : null;
      if (
        stable(profile.damageSource) !==
        stable(bullseyeDamageSourceFacts({ ...owned.system, name: owned.name }, ammunition))
      )
        throw Error(
          loc`The recorded attack weapon or ammunition damage profile changed. Use the original shot’s configuration.`
        );
    }
  }
  return facts;
}
export function eligibleAttackDamageHits(actor, item) {
  const used = new Set(attackDamageUseRows(actor.system).map(r => r.rootAttackUuid));
  return values(game.messages)
    .filter(m => m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM))
    .flatMap(m => {
      try {
        const proof = attackDamageBenefitSource(actor, m, item);
        return used.has(proof.rootAttackUuid) ? [] : [{ message: m, proof }];
      } catch {
        return [];
      }
    });
}
/** Whether a recorded hit is an Impale attack, whose damage needs the target's Defense. */
export const impaleHit = attack => attack?.flags?.spycraft2?.attackContext?.meleeTrick?.key === "impale";
export function makeAttackDamageProof(actor, item, attackUuid, { targetUuid, impaleDefense } = {}) {
  const attack = message(attackUuid);
  if (impaleHit(attack) && impaleDefense === undefined)
    throw Error(loc`Enter the target’s Defense against the Impale attack to roll its damage.`);
  return {
    ...attackDamageBenefitSource(actor, attack, item, { targetUuid, impaleDefense }),
    reservationId: foundry.utils.randomID()
  };
}
export function hasAttackDamageLease(actor, proof, lease) {
  const p = lease && leases.get(lease);
  return p?.actor === actor && p.reservationId === proof?.reservationId;
}
function validateSource(actor, proof, { historical = false } = {}) {
  const attack = message(proof.attackUuid),
    item =
      actor.items?.get?.(proof.weaponUuid?.split(".").at(-1)) ??
      values(actor.items).find(i => i.uuid === proof.weaponUuid);
  const expected = attackDamageBenefitSource(actor, attack, item, {
      targetUuid: proof.targetUuid,
      historical,
      impaleDefense: proof.impale?.defense
    }),
    { reservationId, ...facts } = proof;
  if (typeof reservationId !== "string" || !reservationId || stable(expected) !== stable(facts))
    throw Error(loc`The original recorded attack bonus hit, target or damage source changed.`);
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
    stable(c.attackDamageBenefit) !== stable(proof)
  )
    throw Error(loc`Use the actual original damage receipt to replace its recorded attack bonus die.`);
  const use = attackDamageUseRows(actor.system).find(
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
      stable(previous.flags.spycraft2.attackDamageBenefit) !== stable(proof)
    )
      break;
    current = previous;
  }
  throw Error(loc`This damage receipt does not own the recorded recorded attack bonus use.`);
}
/** A melee-trick sneak die exists only inside the damage of its own recorded hit. */
export function validateTrickSneakSource(proof, sneakAttack) {
  const rows = (sneakAttack?.sources ?? []).filter(s => s.source === "Between the Ribs");
  if (!rows.length) return;
  if (rows.length !== 1 || rows[0].dice !== 1 || proof?.sneakDice !== 1 || proof.sneakSource !== "Between the Ribs")
    throw Error(loc`Between the Ribs sneak attack damage requires its exact recorded knife hit.`);
}
export function validateAttackDamageProof(
  actor,
  proof,
  { checkKind, weaponUuid, weaponProficiency, weaponQualities, lease, rerollOf } = {}
) {
  if (!proof) return;
  if (checkKind !== "damage" || weaponUuid !== proof.weaponUuid)
    throw Error(loc`The recorded attack bonus must augment its exact weapon’s damage.`);
  if (proof.operatingProficiency && weaponProficiency !== proof.operatingProficiency)
    throw Error(loc`Use the recorded shot’s original operating proficiency for its damage.`);
  if (
    proof.grantedQuality &&
    (!/\bTKD\b/.test(weaponQualities ?? "") ||
      (rerollOf && message(rerollOf)?.flags?.spycraft2?.weaponQualities !== weaponQualities))
  )
    throw Error(loc`The earned takedown quality must remain on this exact recorded damage result.`);
  if (rerollOf) {
    originalDamage(actor, proof, rerollOf);
    validateSource(actor, proof, { historical: true });
    return;
  }
  validateSource(actor, proof);
  if (
    !hasAttackDamageLease(actor, proof, lease) ||
    !attackDamageUseRows(actor.system).some(
      r => r.rootAttackUuid === proof.rootAttackUuid && r.reservationId === proof.reservationId && !r.receiptUuid
    )
  )
    throw Error(loc`Reserve this damage bonus through the original hit.`);
}
export async function withAttackDamageBenefit(actor, proof, perform) {
  const lease = {};
  await queueRuleState(actor, async () => {
    validateSource(actor, proof);
    const rows = attackDamageUseRows(actor.system);
    if (rows.some(r => r.rootAttackUuid === proof.rootAttackUuid))
      throw Error(
        loc`This recorded attack bonus attack already has damage, or an interrupted damage use awaiting GC review.`
      );
    await actor.update({
      "system.attackDamageUses": [
        ...rows,
        {
          version: 1,
          rootAttackUuid: proof.rootAttackUuid,
          attackUuid: proof.attackUuid,
          reservationId: proof.reservationId,
          targetUuid: proof.targetUuid,
          weaponUuid: proof.weaponUuid,
          sourceEvidence: proof.sourceEvidence,
          receiptUuid: null
        }
      ]
    });
  });
  leases.set(lease, { actor, reservationId: proof.reservationId });
  active.set(actor.uuid + ":" + proof.reservationId, lease);
  const posted = () =>
      values(game.messages).find(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.checkKind === "damage" &&
          m.flags.spycraft2.attackDamageBenefit?.reservationId === proof.reservationId
      ),
    settle = receipt =>
      queueRuleState(actor, async () => {
        const rows = attackDamageUseRows(actor.system),
          use = rows.find(r => r.rootAttackUuid === proof.rootAttackUuid);
        if (use?.reservationId !== proof.reservationId)
          throw Error(loc`The attack damage bonus reservation changed; ask the GC to review it.`);
        await actor.update({
          "system.attackDamageUses": receipt
            ? rows.map(r => (r.rootAttackUuid === proof.rootAttackUuid ? { ...r, receiptUuid: receipt.uuid } : r))
            : rows.filter(r => r.reservationId !== proof.reservationId)
        });
      });
  try {
    const result = await perform(lease),
      receipt =
        result?.flags?.spycraft2?.attackDamageBenefit?.reservationId === proof.reservationId && result.uuid
          ? result
          : posted();
    await settle(receipt);
    return receipt ?? result;
  } catch (error) {
    const receipt = posted();
    try {
      await settle(receipt);
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        loc`The attack damage bonus needs GC review; inspect its receipt before retrying.`
      );
    }
    if (receipt) return receipt;
    throw error;
  } finally {
    leases.delete(lease);
    active.delete(actor.uuid + ":" + proof.reservationId);
  }
}
export async function reviewAttackDamageBenefit(actor, { reservationId, confirmed = false } = {}) {
  if (!game.user.isGM || !actor.isOwner || confirmed !== true)
    throw Error(loc`The GC must confirm the interrupted attack damage bonus was reviewed.`);
  if (active.has(actor.uuid + ":" + reservationId)) throw Error(loc`This client is still executing that damage roll.`);
  return queueRuleState(actor, async () => {
    const rows = attackDamageUseRows(actor.system),
      use = rows.find(r => r.reservationId === reservationId && !r.receiptUuid);
    if (!use) return null;
    const posted = values(game.messages).filter(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.checkKind === "damage" &&
        m.flags.spycraft2.attackDamageBenefit?.reservationId === reservationId
    );
    if (posted.length > 1) throw Error(loc`Multiple damage receipts require manual GC review.`);
    const receipt = posted[0];
    if (receipt) validateRecordedMeleeArmorPiercing(receipt.flags.spycraft2);
    if (
      receipt?.flags.spycraft2.attackDamageBenefit.grantedQuality &&
      !/\bTKD\b/.test(receipt.flags.spycraft2.weaponQualities ?? "")
    )
      throw Error(loc`The posted damage lost its earned takedown quality.`);
    if (receipt) {
      const { reservationId: nonce, ...facts } = receipt.flags.spycraft2.attackDamageBenefit,
        expected = recordedAttackDamageFacts(actor, message(use.attackUuid), {
          targetUuid: use.targetUuid,
          impaleDefense: facts.impale?.defense
        });
      if (nonce !== use.reservationId || stable(expected) !== stable(facts))
        throw Error(loc`The posted damage bonus or original recorded hit changed.`);
    }
    if (
      receipt &&
      (receipt.flags.spycraft2.attackDamageBenefit.rootAttackUuid !== use.rootAttackUuid ||
        receipt.flags.spycraft2.attackDamageBenefit.sourceEvidence !== use.sourceEvidence)
    )
      throw Error(loc`The posted damage does not match its interrupted recorded attack bonus hit.`);
    await actor.update({
      "system.attackDamageUses": receipt
        ? rows.map(r => (r.reservationId === reservationId ? { ...r, receiptUuid: receipt.uuid } : r))
        : rows.filter(r => r.reservationId !== reservationId)
    });
    return { version: 1, reservationId, receiptUuid: receipt?.uuid ?? null, released: !receipt };
  });
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "trickSneakSource",
  order: 1100,
  record: ["sneakAttack"],
  validate: ({ options }) => validateTrickSneakSource(options.attackDamageBenefit, options.sneakAttack)
});
rollPipeline.register({
  id: "attackDamage",
  order: 1110,
  record: ["attackDamageBenefit"],
  validate: ({ actor, options, checkKind, weaponUuid, weaponProficiency, weaponQualities }) =>
    validateAttackDamageProof(actor, options.attackDamageBenefit, {
      checkKind,
      weaponUuid,
      lease: options.attackDamageLease,
      weaponProficiency,
      weaponQualities,
      rerollOf: options.rerollOf
    })
});
rollPipeline.register({
  order: 20,
  id: "attackDamageLease",
  acquire({ actor, options }) {
    const proof = options.attackDamageBenefit;
    if (!proof || options.rerollOf || hasAttackDamageLease(actor, proof, options.attackDamageLease)) return null;
    return next => withAttackDamageBenefit(actor, proof, lease => next({ attackDamageLease: lease }));
  }
});

// Impale: the damage dialog asks for the target's Defense when an Impale hit is on offer.
const wholeNumber = v => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isSafeInteger(n) ? n : undefined;
};
rollPipeline.register({
  id: "impaleDefenseContent:damage",
  dialogs: ["damage"],
  order: 31,
  dialog: ({ attackBonusHits = [] }) => [
    {
      at: 45,
      html: attackBonusHits.some(h => impaleHit(h.message))
        ? `<label>${loc`Target’s Defense against the Impale hit (GC confirms; +1 damage per 2 points the attack beat it)`} <input type="number" name="impaleDefense" min="0" step="1" /></label>`
        : ""
    }
  ],
  read: (context, input) => {
    const n = wholeNumber(input?.impaleDefense);
    return n === undefined ? null : { impaleDefense: n };
  }
});
