/** Companions on the owner's sheet: creating an Animal Partner or Personal Lieutenant, and a companion's death. */
import { refuse } from "../error-notices.mjs";
import {
  ANIMAL_PARTNER,
  PERSONAL_LIEUTENANT,
  companionSlots,
  lieutenantAdvancement,
  animalPartnerCap,
  partnerThreatLevel
} from "../rules/companions.mjs";
import { defaultNpcProfile } from "../rules/npcs.mjs";
import { loc } from "../i18n.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { ruleName } from "../rules/rule-name.mjs";
import { queueResources } from "../services/transactions.mjs";
import { same } from "../rules/equal.mjs";
import { esc } from "../html.mjs";
import {
  companionLossKey,
  companionMission,
  companionLossPlan,
  companionLossStatus,
  companionLossUndoEntry,
  reviewCompanionLossPlan
} from "../rules/companion-losses.mjs";
import { postUndo } from "./undo.mjs";

const losses = owner => owner.flags?.spycraft2?.companionLosses ?? {};
const mission = () => companionMission(game.settings?.get?.("spycraft2", "usagePeriods"));
const lossPath = uuid => `flags.spycraft2.companionLosses.${companionLossKey(uuid)}`;

/** The companions linked to this owner. */
export function linkedCompanions(owner) {
  const records = losses(owner),
    current = mission(),
    linked = [...(game.actors ?? [])].filter(a => a.system?.companionOf?.ownerUuid === owner.uuid),
    rows = linked.map(a => ({
      uuid: a.uuid,
      id: a.id,
      name: a.name,
      feat: a.system.companionOf.feat,
      warnings: a.system.warnings ?? [],
      ...companionLossStatus(records[companionLossKey(a.uuid)], current)
    }));
  for (const record of Object.values(records))
    if (
      record?.ownerUuid === owner.uuid &&
      record.state !== "cancelled" &&
      !rows.some(row => row.uuid === record.companionUuid)
    )
      rows.push({
        uuid: record.companionUuid,
        name: record.companionName,
        feat: record.feat,
        missing: true,
        warnings: [],
        ...companionLossStatus(record, current)
      });
  return rows;
}

/** The Main tab's Companions context, or null when the character has neither feat. */
export function companionsContext(owner) {
  const feats = owner.system.activeFeatNames ?? [];
  const linked = linkedCompanions(owner);
  const acquired = [...(owner.items ?? [])].find(item => item.type === "feat" && ruleName(item) === PERSONAL_LIEUTENANT)
      ?.system.acquiredAtLevel,
    advancement = lieutenantAdvancement({ companionOf: { ownerLevelAtAcquisition: acquired } }, owner.system);
  const creationNeedsReview = owner.flags?.spycraft2?.companionCreation?.state === "creating";
  const occupied = linked.filter(row => !row.replacementAvailable),
    partnerLimit = (owner.system.activeFeatSelections ?? []).filter(feat => feat.name === ANIMAL_PARTNER).length,
    lieutenantLimit = feats.includes(PERSONAL_LIEUTENANT) ? 1 : 0;
  if (!linked.length && !creationNeedsReview && !feats.includes(ANIMAL_PARTNER) && !feats.includes(PERSONAL_LIEUTENANT))
    return null;
  return {
    linked,
    creationNeedsReview,
    overLimit:
      occupied.filter(row => row.feat === ANIMAL_PARTNER).length > partnerLimit ||
      occupied.filter(row => row.feat === PERSONAL_LIEUTENANT).length > lieutenantLimit,
    slots: creationNeedsReview ? { animalPartner: 0, personalLieutenant: 0 } : companionSlots(owner.system, linked),
    partnerCap: animalPartnerCap(owner.system),
    lieutenantLevel: advancement.level,
    lieutenantHistoryNeedsReview: advancement.needsReview
  };
}

export async function createCompanion(owner, feat) {
  if (!owner.isOwner) return null;
  if (![ANIMAL_PARTNER, PERSONAL_LIEUTENANT].includes(feat)) return refuse(loc`Choose a companion feat.`);
  return queueResources([owner], () => createCompanionLocked(owner, feat));
}

async function createCompanionLocked(owner, feat) {
  if (owner.flags?.spycraft2?.companionCreation?.state === "creating")
    return refuse(loc`The GC must review the interrupted companion creation before another character is created.`);
  const slots = companionSlots(owner.system, linkedCompanions(owner));
  if (feat === ANIMAL_PARTNER && !slots.animalPartner)
    return refuse(loc`Each Animal Partner selection grants one animal; all are linked.`);
  if (feat === PERSONAL_LIEUTENANT && !slots.personalLieutenant)
    return refuse(
      loc`Personal Lieutenant requires an active feat, an owner with a Career Level, and no lieutenant already linked.`
    );
  const ownership = { ...owner.ownership },
    companionOf = { ownerUuid: owner.uuid, feat };
  if (feat === PERSONAL_LIEUTENANT) {
    const source = [...owner.items].find(item => item.type === "feat" && ruleName(item) === feat),
      acquired = source?.system.acquiredAtLevel;
    if (Number.isSafeInteger(acquired) && acquired >= 1 && acquired <= owner.system.level)
      companionOf.ownerLevelAtAcquisition = acquired;
  }
  const data =
    feat === ANIMAL_PARTNER
      ? {
          name: loc`${owner.name}’s animal partner`,
          type: "npc",
          ownership,
          // One particular animal: its token is linked, so changes made through it reach this actor.
          prototypeToken: { actorLink: true },
          system: {
            companionOf,
            npcType: "animal",
            abilities: { int: { value: 2 } },
            followMission: false,
            threatLevel: partnerThreatLevel(owner.system.level),
            npcProfile: { ...defaultNpcProfile(), enabled: true, equipment: { weapons: [], gear: [], vehicles: [] } }
          }
        }
      : {
          name: loc`${owner.name}’s lieutenant`,
          type: "agent",
          ownership,
          system: { companionOf, pointBuyBudget: 32 }
        };
  const replacement = Object.values(losses(owner)).find(
      record =>
        record.feat === feat && !record.replacement && companionLossStatus(record, mission()).replacementAvailable
    ),
    intent = {
      id: foundry.utils.randomID(),
      feat,
      state: "creating",
      mission: mission(),
      ownerUuid: owner.uuid,
      replacementOf: replacement?.companionUuid ?? ""
    };
  const intentPatch = { "flags.spycraft2.companionCreation": intent };
  if (replacement)
    intentPatch[lossPath(replacement.companionUuid)] = {
      ...replacement,
      replacement: { id: intent.id, state: "pending" }
    };
  await owner.update(intentPatch);
  data.flags = { spycraft2: { companionCreation: { id: intent.id, ownerUuid: owner.uuid } } };
  let actor;
  try {
    actor = await Actor.create(data);
  } catch {
    return refuse(
      loc`The companion's creation result is uncertain. The GC must check for the actual character before another attempt.`
    );
  }
  if (!actor)
    return refuse(loc`No companion was returned. The GC must review this creation attempt before trying again.`);
  const completed = { "flags.spycraft2.companionCreation": { ...intent, state: "created", actorUuid: actor.uuid } };
  if (replacement)
    completed[lossPath(replacement.companionUuid)] = {
      ...replacement,
      replacement: { id: intent.id, state: "created", actorUuid: actor.uuid }
    };
  await owner.update(completed);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: foundry.utils.escapeHTML(
      feat === ANIMAL_PARTNER
        ? loc`Animal Partner: ${owner.name} gains ${actor.name}. Build it as an animal with an XP reward up to ${animalPartnerCap(owner.system)}, plus 2 free trained qualities; it uses Threat Level ${partnerThreatLevel(owner.system.level)}, special-character health one grade higher, no action dice of its own, and is Helpful to ${owner.name} (p.201).`
        : loc`Personal Lieutenant: ${owner.name} gains ${actor.name}. Build its Career Level from the recorded feat acquisition and subsequent owner advancement, with 32 attribute points, 1 action die and no personal Wealth, contacts, Interests or Subplots (p.204).`
    )
  });
  actor.sheet?.render(true);
  return actor;
}

/** Bind an interrupted creation to its actual actor, or explicitly confirm that no actor was created. */
export async function reviewCompanionCreation(owner) {
  if (!owner?.isOwner || !game.user?.isGM) return null;
  const original = structuredClone(owner.flags?.spycraft2?.companionCreation ?? null);
  if (original?.state !== "creating") return null;
  const replacement = original.replacementOf
    ? structuredClone(losses(owner)[companionLossKey(original.replacementOf)] ?? null)
    : null;
  const input = await systemDialog.input({
    window: { title: loc`Review companion creation` },
    rejectClose: false,
    ok: { label: loc`Record review` },
    content: `<p>${loc`Find the character from this attempt before allowing another creation. Use its UUID if it exists, or confirm that no character was created.`}</p><label>${loc`Actual companion UUID, if created`} <input name="actorUuid" /></label><label><input type="checkbox" name="notCreated" /> ${loc`The GC verified that this attempt created no character`}</label><label>${loc`What actually happened`} <textarea name="note" maxlength="500" required></textarea></label>`
  });
  if (!input) return null;
  return queueResources([owner], async () => {
    if (
      !same(owner.flags?.spycraft2?.companionCreation, original) ||
      (original.replacementOf && !same(losses(owner)[companionLossKey(original.replacementOf)], replacement))
    )
      throw Error(loc`The creation or replacement record changed. Reopen the review.`);
    const actorUuid = String(input.actorUuid ?? "").trim(),
      actor = actorUuid ? fromUuidSync(actorUuid) : null,
      candidates = [...(game.actors ?? [])].filter(
        a =>
          a.uuid !== owner.uuid &&
          a.flags?.spycraft2?.companionCreation?.id === original.id &&
          a.flags.spycraft2.companionCreation.ownerUuid === owner.uuid
      );
    if (
      !String(input.note ?? "").trim() ||
      (actorUuid
        ? input.notCreated === true ||
          !actor ||
          actor.system.companionOf?.ownerUuid !== owner.uuid ||
          actor.system.companionOf?.feat !== original.feat ||
          actor.flags?.spycraft2?.companionCreation?.id !== original.id
        : input.notCreated !== true || candidates.length > 0)
    )
      throw Error(loc`Verify this attempt's actual companion, or confirm that none exists, and record the reason.`);
    const next = {
        ...original,
        state: actor ? "created" : "cancelled",
        actorUuid: actor?.uuid ?? "",
        review: { reviewer: game.user.id, note: String(input.note).trim(), at: game.time.worldTime }
      },
      change = { "flags.spycraft2.companionCreation": next };
    let nextLoss;
    if (replacement) {
      nextLoss = { ...replacement };
      if (actor) nextLoss.replacement = { id: original.id, state: "created", actorUuid: actor.uuid };
      else delete nextLoss.replacement;
      change[`flags.spycraft2.companionLosses.==${companionLossKey(original.replacementOf)}`] = nextLoss;
    }
    await owner.update(change);
    try {
      const path = "flags.spycraft2.companionCreation",
        previous = [[path, original]],
        expected = [[path, next]];
      if (replacement) {
        previous.push([lossPath(original.replacementOf), replacement]);
        expected.push([lossPath(original.replacementOf), nextLoss]);
      }
      await postUndo(loc`Companion creation reviewed: ${owner.name}`, [
        {
          uuid: owner.uuid,
          name: owner.name,
          restore: previous,
          expect: expected,
          whole: previous.map(([key]) => key),
          unset: [],
          created: [],
          removed: [],
          combatants: []
        }
      ]);
    } catch {
      return refuse(
        loc`The creation review was saved, but its Undo note could not be posted. The GC must verify any later correction by hand.`
      );
    }
    return next;
  });
}

/** The GC verifies unknown or corrected acquisition history without rebuilding the lieutenant. */
export async function reviewLieutenantHistory(actor) {
  if (!actor?.isOwner || !game.user?.isGM || actor.system.companionOf?.feat !== PERSONAL_LIEUTENANT) return null;
  const original = structuredClone(actor.system.companionOf);
  const input = await systemDialog.input({
    window: { title: loc`Review lieutenant advancement` },
    rejectClose: false,
    ok: { label: loc`Record review` },
    content: `<p>${loc`Verify when the owner gained Personal Lieutenant. Keep the lieutenant's existing build and original dice; correct any level difference through normal advancement.`}</p><label>${loc`Owner UUID`} <input name="ownerUuid" value="${esc(original.ownerUuid)}" required /></label><label>${loc`Owner Career Level when the feat was gained`} <input type="number" name="ownerLevelAtAcquisition" min="1" max="20" step="1" value="${original.ownerLevelAtAcquisition ?? ""}" required /></label><label>${loc`Reason for this history correction`} <textarea name="note" maxlength="500" required></textarea></label>`
  });
  if (!input) return null;
  const owner = fromUuidSync(String(input.ownerUuid).trim());
  if (!owner || owner.type !== "agent")
    return refuse(loc`Choose the actual owner character before recording this history.`);
  return queueResources([actor, owner], async () => {
    if (!same(actor.system.companionOf, original)) throw Error(loc`The companion link changed. Reopen the review.`);
    const acquired = Number(input.ownerLevelAtAcquisition),
      note = String(input.note ?? "").trim();
    if (
      !Number.isSafeInteger(acquired) ||
      acquired < 1 ||
      acquired > owner.system.level ||
      !note ||
      !owner.system.activeFeatNames?.includes(PERSONAL_LIEUTENANT)
    )
      throw Error(loc`Verify the owner's active feat, its original Career Level and the correction reason.`);
    const next = {
      ...original,
      ownerUuid: owner.uuid,
      ownerLevelAtAcquisition: acquired,
      historyReview: { reviewer: game.user.id, at: game.time.worldTime, note }
    };
    await actor.update({ "system.==companionOf": next });
    return next;
  });
}

/** The GC records a companion's death: the owner loses Reputation, or Net Worth for a freelancer (pp.201,204). */
export async function recordCompanionDeath(owner, companionUuid) {
  if (!game.user?.isGM) return refuse(loc`The GC records a companion’s death.`);
  const companion = fromUuidSync(companionUuid);
  if (!owner?.isOwner || !companion || companion.system.companionOf?.ownerUuid !== owner.uuid)
    return refuse(loc`Verify this companion's actual owner before recording a loss.`);
  if (
    losses(owner)[companionLossKey(companionUuid)]?.state !== "cancelled" &&
    losses(owner)[companionLossKey(companionUuid)]
  )
    return refuse(loc`This companion already has a loss record. Use its GC review instead of charging again.`);
  const confirmed = await systemDialog.confirm({
    window: { title: loc`Companion lost` },
    content: `<p>${foundry.utils.escapeHTML(
      loc`Record ${companion.name}’s death? ${owner.name} loses Reputation equal to their career level (or Net Worth for a freelancer). Keep the character and its history; a replacement becomes available next mission.`
    )}</p>`,
    rejectClose: false
  });
  if (!confirmed) return null;
  return queueResources([owner, companion], async () => {
    const previous = structuredClone(losses(owner)[companionLossKey(companionUuid)] ?? null);
    if (previous && previous.state !== "cancelled")
      return refuse(loc`This companion already has a loss record. Use its GC review instead of charging again.`);
    const record = companionLossPlan(owner.system, companion.system.companionOf, {
      id: foundry.utils.randomID(),
      ownerUuid: owner.uuid,
      companionUuid,
      companionName: companion.name,
      mission: mission(),
      at: game.time.worldTime
    });
    await owner.update({ [lossPath(companionUuid)]: record });
    if (owner.system[record.resource] !== record.before || mission() !== record.mission)
      throw Error(loc`The balance or mission changed while recording this loss. The GC must review the saved intent.`);
    const charged = { ...record, state: "charged" };
    try {
      await owner.update({ [`system.${record.resource}`]: record.after, [lossPath(companionUuid)]: charged });
    } catch (error) {
      if (!same(losses(owner)[companionLossKey(companionUuid)], charged)) throw error;
    }
    try {
      return await postUndo(
        loc`${companion.name} lost: ${owner.name} loses ${record.amount} ${record.resource === "netWorth" ? loc`Net Worth` : loc`Reputation`}. Replacement available next mission.`,
        [companionLossUndoEntry(owner, charged, { previous })]
      );
    } catch {
      return refuse(
        loc`The loss was recorded, but its Undo note could not be posted. Use the companion's GC loss review; do not charge again.`
      );
    }
  });
}

/** Resolve uncertain delivery or reverse a mistaken loss using an explicitly verified present balance. */
export async function reviewCompanionLoss(owner, companionUuid) {
  if (!owner?.isOwner || !game.user?.isGM) return null;
  const original = structuredClone(losses(owner)[companionLossKey(companionUuid)] ?? null);
  if (!original) return refuse(loc`This companion has no saved loss to review.`);
  if (original.replacement?.state === "pending")
    return refuse(loc`Review the interrupted companion creation before correcting its original loss.`);
  const beforeBalance = owner.system[original.resource];
  const input = await systemDialog.input({
    window: { title: loc`Review companion loss` },
    rejectClose: false,
    ok: { label: loc`Record review` },
    content: `<p>${esc(original.companionName)}: ${esc(loc`Verify the original loss and the owner's present balance. An uncertain charge is never repeated automatically. To reverse a mistake, include the refund in the actual balance below.`)}</p><p>${loc`Original balance change`}: ${original.before} → ${original.after}</p><label>${loc`Verified outcome`} <select name="outcome"><option value="charged">${loc`Companion lost; replacement next mission`}</option><option value="cancelled">${loc`Loss reversed; companion remains`}</option></select></label><label>${loc`Actual present balance after resolving this loss`} <input type="number" name="balance" step="1" value="${beforeBalance}" required /></label><label>${loc`What actually happened`} <textarea name="note" maxlength="500" required></textarea></label>`
  });
  if (!input) return null;
  return queueResources([owner], async () => {
    if (
      !same(losses(owner)[companionLossKey(companionUuid)], original) ||
      owner.system[original.resource] !== beforeBalance
    )
      throw Error(loc`The loss or balance changed. Reopen the review and verify the present outcome.`);
    const plan = reviewCompanionLossPlan(original, {
      ...input,
      balance: Number(input.balance),
      reviewer: game.user.id,
      at: game.time.worldTime
    });
    await owner.update({ [`system.${original.resource}`]: plan.balance, [lossPath(companionUuid)]: plan.record });
    try {
      return await postUndo(loc`Companion loss reviewed: ${original.companionName}`, [
        companionLossUndoEntry(owner, plan.record, { previous: original, beforeBalance, afterBalance: plan.balance })
      ]);
    } catch {
      return refuse(
        loc`The review was saved, but its Undo note could not be posted. Use the loss review again to correct it.`
      );
    }
  });
}
