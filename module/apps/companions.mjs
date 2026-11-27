/** Companions on the owner's sheet: creating an Animal Partner or Personal Lieutenant, and a companion's death. */
import { refuse } from "../error-notices.mjs";
import {
  ANIMAL_PARTNER,
  PERSONAL_LIEUTENANT,
  companionSlots,
  companionLoss,
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

/** The companions linked to this owner. */
export const linkedCompanions = owner =>
  [...(game.actors ?? [])]
    .filter(a => a.system?.companionOf?.ownerUuid === owner.uuid)
    .map(a => ({
      uuid: a.uuid,
      id: a.id,
      name: a.name,
      feat: a.system.companionOf.feat,
      warnings: a.system.warnings ?? []
    }));

/** The Main tab's Companions context, or null when the character has neither feat. */
export function companionsContext(owner) {
  const feats = owner.system.activeFeatNames ?? [];
  if (!feats.includes(ANIMAL_PARTNER) && !feats.includes(PERSONAL_LIEUTENANT)) return null;
  const linked = linkedCompanions(owner);
  return {
    linked,
    slots: companionSlots(owner.system, linked),
    partnerCap: animalPartnerCap(owner.system),
    lieutenantLevel: Math.floor((owner.system.level ?? 0) / 2)
  };
}

export async function createCompanion(owner, feat) {
  if (!owner.isOwner) return null;
  if (![ANIMAL_PARTNER, PERSONAL_LIEUTENANT].includes(feat)) return refuse(loc`Choose a companion feat.`);
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
  let actor;
  try {
    actor = await Actor.create(data);
  } catch {
    return refuse(loc`Only a user who may create actors (usually the GC) can add the companion.`);
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: foundry.utils.escapeHTML(
      feat === ANIMAL_PARTNER
        ? loc`Animal Partner: ${owner.name} gains ${actor.name}. Build it as an animal with an XP reward up to ${animalPartnerCap(owner.system)}, plus 2 free trained qualities; it uses Threat Level ${partnerThreatLevel(owner.system.level)}, special-character health one grade higher, no action dice of its own, and is Helpful to ${owner.name} (p.201).`
        : loc`Personal Lieutenant: ${owner.name} gains ${actor.name}, a special character of career level up to ${Math.floor((owner.system.level ?? 0) / 2)}, with 32 attribute points, 1 action die and no Wealth, contacts, Interests or Subplots of their own (p.204).`
    )
  });
  actor.sheet?.render(true);
  return actor;
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
  if (!companion) return null;
  const confirmed = await systemDialog.confirm({
    window: { title: loc`Companion lost` },
    content: `<p>${foundry.utils.escapeHTML(
      loc`Record ${companion.name}’s death? ${owner.name} loses Reputation equal to their career level (or Net Worth for a freelancer), and the companion is unlinked; a replacement arrives at the start of the next mission.`
    )}</p>`,
    rejectClose: false
  });
  if (!confirmed) return null;
  const loss = companionLoss(owner.system),
    freelance = owner.system.affiliationType === "freelance";
  await owner.update(
    freelance
      ? { "system.netWorth": (owner.system.netWorth ?? 0) - loss.netWorth }
      : { "system.reputation": (owner.system.reputation ?? 0) - loss.reputation }
  );
  await companion.update({ "system.companionOf": null });
  const amount = loss.netWorth.toLocaleString("en-US");
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: foundry.utils.escapeHTML(
      freelance
        ? loc`${companion.name} has died: ${owner.name} loses ${amount} dollars of Net Worth; a new companion arrives at the start of the next mission.`
        : loc`${companion.name} has died: ${owner.name} loses ${loss.reputation} Reputation; a new companion arrives at the start of the next mission.`
    )
  });
}
