import {
  coverInterceptionBasis,
  coverInterceptionPlan,
  coveredAttackOutcome,
  validateCoverAttackBasis
} from "../rules/cover-interception.mjs";
import { characterTargetPlan } from "../rules/character-target.mjs";
import { targetRoleCriticalRules } from "../rules/npc-qualities.mjs";
import { finesseCriticalEligible } from "../rules/finesse.mjs";
import { damageSaveDC } from "../rules/vehicles.mjs";
import { sameValues } from "../rules/equal.mjs";
import { queueResources } from "../services/transactions.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

const checkOf = message => message?.flags?.spycraft2;
const requireGC = () => {
  if (!game.user?.isGM) throw Error(loc`The GC reviews actual cover and its Damage saves.`);
};

export function interceptedBasis(message, attacker, resolution) {
  const check = checkOf(message);
  if (!resolution.cover || !resolution.targetUuid) return null;
  const basis = coverInterceptionBasis(check, {
    attackUuid: message.uuid,
    targetUuid: resolution.targetUuid,
    baseDefense: resolution.defense - resolution.cover.bonus,
    grade: resolution.cover.grade,
    feats: resolution.gcDefenseBoost?.feats ?? check.npcDefenseReroll?.feats ?? attacker.system.activeFeatNames ?? []
  });
  return basis.interceptedHits ? basis : null;
}

/** Identify the actual first contact before critical activation or any damage roll. */
export async function prepareCoverAttack(message, attacker, resolution, { npcDefenseReviewId = "", input } = {}) {
  requireGC();
  let check = checkOf(message);
  if (check.coverAwaiting) return confirmPreparedCover(message, attacker);
  const original = structuredClone(check),
    initial = interceptedBasis(message, attacker, resolution);
  if (!initial) return null;
  if (check.criticalSuccess || check.criticalFailure)
    throw Error(loc`Review the already activated critical before changing this attack to cover.`);
  if (initial.directHits === 0 && !input) {
    const actors = [...game.actors].filter(
      a => ["agent", "npc", "vehicle"].includes(a.type) && a.uuid !== attacker.uuid && a.uuid !== resolution.targetUuid
    );
    input = await systemDialog.input({
      window: { title: loc`Cover struck before the protected target` },
      rejectClose: false,
      ok: { label: loc`Confirm cover contact` },
      content: `<div class="spycraft2-roll-options"><p>${loc`This attack would hit without cover. It counts as successful against the cover before damage; any critical applies to its first actual contact. Total cover must be penetrated (p.345).`}</p><label>${loc`First cover struck`} <select name="actorUuid"><option value="">${loc`Scenery or an unrecorded character`}</option>${actors.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label>${loc`Cover name, if unrecorded`} <input name="name" maxlength="200" /></label><label>${loc`GC-confirmed type for unrecorded cover or an animal`} <select name="characterType"><option value="object">${loc`Object or scenery`}</option><option value="standard">${loc`Standard character`}</option><option value="special">${loc`Special character`}</option></select></label><p class="hint">${loc`For combined cover, randomly determine personal cover, scenery or both, then use their actual order. Use the best personal and scenery grades, capped at total cover. The later save review records each actual contact and any damage remaining.`}</p></div>`
    });
    if (!input) return null;
  }
  const coverActor = initial.directHits === 0 && input?.actorUuid ? await fromUuid(input.actorUuid) : null;
  if (
    input?.actorUuid &&
    (!coverActor ||
      !coverActor.isOwner ||
      coverActor.uuid === resolution.targetUuid ||
      coverActor.uuid === attacker.uuid)
  )
    throw Error(loc`Choose the actual cover, separate from attacker and protected target.`);
  let criticalTarget = null,
    criticalName = resolution.targetName,
    criticalRole = null;
  if (initial.directHits === 0) {
    criticalName = coverActor?.name ?? input?.name;
    criticalTarget =
      coverActor && ["agent", "npc"].includes(coverActor.type)
        ? characterTargetPlan(
            {
              uuid: coverActor.uuid,
              type: coverActor.type,
              npcType: coverActor.system.npcType,
              createdTime: coverActor._stats?.createdTime
            },
            { targetCharacterType: coverActor.system.npcType === "animal" ? input.characterType : "" }
          )
        : characterTargetPlan(null, {
            targetCharacterType: coverActor ? "object" : input?.characterType,
            targetName: criticalName
          });
    criticalRole = criticalTarget.characterType === "object" ? null : targetRoleCriticalRules(coverActor?.system);
  }
  const coverCleave =
    attacker.system.activeFeatNames?.includes("Cleave Mastery") &&
    finesseCriticalEligible(check) &&
    criticalTarget?.standard
      ? 1
      : 0;
  const threat =
    initial.directHits === 0 && check.threat > 0
      ? check.threat -
        (check.attackContext?.targetRole?.threatRangeReduction ?? 0) +
        (criticalRole?.threatRangeReduction ?? 0) +
        (check.attackContext?.cleaveThreatIncrease ?? 0) -
        coverCleave
      : check.threat;
  const next = { ...check, ...(threat === undefined ? {} : { threat }) };
  const basis = coverInterceptionBasis(next, initial);
  const pending = {
    version: 1,
    id: foundry.utils.randomID(),
    basis,
    criticalTarget,
    criticalName,
    criticalActorUuid: coverActor?.uuid ?? null,
    criticalRole,
    npcDefenseReviewId
  };
  await queueResources(
    [attacker],
    async () => {
      check = checkOf(message);
      if (!sameValues(check, original) || check.resolved || check.superseded)
        throw Error(loc`The attack changed while its cover contact was being confirmed.`);
      if ((attacker.flags?.spycraft2?.attackDamageHits?.[message.id]?.slots ?? []).some(r => r.state !== "cancelled"))
        throw Error(loc`Keep this attack's original damage; the GC must review its existing history.`);
      await message.update({
        "flags.spycraft2.coverAwaiting": pending,
        "flags.spycraft2.successConfirmed": null,
        "flags.spycraft2.threatConfirmed": false,
        "flags.spycraft2.errorConfirmed": false,
        ...(threat === undefined ? {} : { "flags.spycraft2.threat": threat }),
        "flags.spycraft2.attackResolution": {
          ...resolution,
          hit: basis.directHits > 0,
          hits: basis.directHits,
          hitsCover: true
        }
      });
    },
    { messages: [message] }
  );
  return confirmPreparedCover(message, attacker);
}

export async function confirmPreparedCover(message, attacker) {
  requireGC();
  const check = checkOf(message),
    pending = check.coverAwaiting;
  validateCoverAttackBasis(check, pending?.basis);
  if (check.coverContactConfirmed !== pending.id) {
    const confirmed = await attacker.confirmCheckOutcome(message, {
      succeeded: true,
      coverReviewId: pending.id,
      ...(pending.npcDefenseReviewId ? { npcDefenseReviewId: pending.npcDefenseReviewId } : {})
    });
    if (!confirmed && checkOf(message).successConfirmed !== true) return null;
    await message.update({ "flags.spycraft2.coverContactConfirmed": pending.id });
  }
  if (pending.npcDefenseReviewId && checkOf(message).npcDefensePending)
    await message.update({
      "flags.spycraft2.gcPostHitDefense": checkOf(message).npcDefensePending.final.gcDefenseBoost,
      "flags.spycraft2.-=npcDefensePending": null
    });
  return pending;
}

/** Freeze the actual once-per-hit cards before the GC uses them for cover saves. */
export async function originalCoverDamage(message, attacker) {
  requireGC();
  return queueResources(
    [attacker],
    async () => {
      const check = checkOf(message),
        pending = check.coverAwaiting;
      validateCoverAttackBasis(check, pending?.basis);
      const ledger = attacker.flags?.spycraft2?.attackDamageHits?.[message.id];
      const rows = [];
      for (let index = 1; index <= pending.basis.potentialHits; index++) {
        const slot = ledger?.slots?.find(r => r.index === index && r.state !== "cancelled");
        const card = slot?.messageUuid ? await fromUuid(slot.messageUuid) : null;
        const c = checkOf(card);
        if (
          slot?.state !== "posted" ||
          !c ||
          c.sourceAttack?.claimId !== slot.claimId ||
          c.sourceAttack?.uuid !== message.uuid ||
          c.actorUuid !== attacker.uuid ||
          !Number.isSafeInteger(c.effectiveTotal) ||
          c.damageApplicationStarted
        )
          throw Error(
            loc`Finish or recover each original damage card before reviewing cover saves. Do not roll replacement damage.`
          );
        rows.push({
          index,
          damageUuid: card.uuid,
          originalDamage: c.effectiveTotal,
          sourceEvidence: JSON.stringify(c)
        });
      }
      for (const row of rows) {
        const card = await fromUuid(row.damageUuid);
        if (JSON.stringify(checkOf(card)) !== row.sourceEvidence)
          throw Error(loc`A damage card changed before its cover-save review.`);
        await card.update({ "flags.spycraft2.coverDamageFrozen": pending.id });
      }
      return rows;
    },
    { messages: [message] }
  );
}

/** GC records actual saves and remaining damage; the saved original dice are never evaluated again. */
export async function reviewCoverSaves(message, attacker, { input } = {}) {
  requireGC();
  const pending = structuredClone(checkOf(message).coverAwaiting),
    originals = await originalCoverDamage(message, attacker);
  const previous = checkOf(message).coverInterception?.record;
  if (!input) {
    input = await systemDialog.input({
      window: { title: loc`Cover saves and penetrating damage` },
      rejectClose: false,
      ok: { label: loc`Record cover results` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Use the original damage shown for each shot. Record actual cover contacts in physical order, Damage save results, penetration and damage remaining. Special-character cover uses its Constitution score for its Damage save (p.345); scenery and items use p.224. Record damage to the cover separately, or apply the original card to its recorded first contact after this review.`}</p>${originals
        .map(row => {
          const direct = row.index <= pending.basis.directHits,
            saved = previous?.rows?.[row.index - 1];
          return `<fieldset><legend>${loc`Shot ${row.index}: original damage ${row.originalDamage}`}</legend>${direct ? `<p>${loc`Direct hit: full original damage reaches the protected target.`}</p>` : `${row.originalDamage > 0 ? `<p>${loc`Item/scenery Damage save DC ${damageSaveDC(row.originalDamage)} before any applicable damage reduction. Review AP, melee/hurled Strength, blast and critical failed-save adjustments (p.224).`}</p>` : ""}<label>${loc`Cover outcome`} <select name="result${row.index}" required><option value="">${loc`Choose actual outcome…`}</option><option value="held"${saved?.result === "held" ? " selected" : ""}>${loc`Cover stopped the shot`}</option><option value="penetrated"${saved?.result === "penetrated" ? " selected" : ""}>${loc`Shot penetrated all intervening cover`}</option></select></label><label>${loc`Damage remaining after cover`} <input name="remaining${row.index}" type="number" min="0" max="${Math.max(0, row.originalDamage)}" step="1" value="${saved?.remainingDamage ?? 0}" required /></label><label>${loc`Actual contacts, save results and cover damage record`} <textarea name="note${row.index}" maxlength="2048" required>${esc(saved?.note ?? "")}</textarea></label>`}</fieldset>`;
        })
        .join(
          ""
        )}<label><input name="confirmed" type="checkbox" required /> ${loc`I reviewed the actual saves and each original damage card; no replacement damage was rolled.`}</label></div>`
    });
    if (!input) return null;
  }
  const rows = originals.map(row => ({
    damageUuid: row.damageUuid,
    originalDamage: row.originalDamage,
    result: row.index <= pending.basis.directHits ? "direct" : input[`result${row.index}`],
    remainingDamage:
      row.index <= pending.basis.directHits ? Math.max(0, row.originalDamage) : Number(input[`remaining${row.index}`]),
    note: row.index <= pending.basis.directHits ? "" : input[`note${row.index}`]
  }));
  const record = coverInterceptionPlan(pending.basis, rows, { id: pending.id, confirmed: input.confirmed === true });
  if (coveredAttackOutcome(record).needsCoverReview.length)
    throw Error(loc`Finish every intercepted shot's actual cover-save review.`);
  await queueResources(
    [attacker],
    async () => {
      if (
        !sameValues(checkOf(message).coverAwaiting, pending) ||
        checkOf(message).coverInterception?.state === "complete"
      )
        throw Error(loc`This cover review changed or already finished.`);
      for (const row of originals) {
        const c = checkOf(await fromUuid(row.damageUuid));
        if (
          c?.effectiveTotal !== row.originalDamage ||
          c.coverDamageFrozen !== pending.id ||
          c.damageApplicationStarted
        )
          throw Error(loc`Keep the original frozen damage cards for this cover review.`);
      }
      await message.update({
        "flags.spycraft2.coverInterception": { state: "reviewed", record, reviewerId: game.user.id }
      });
    },
    { messages: [message] }
  );
  return record;
}
