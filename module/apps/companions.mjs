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
  const slots = companionSlots(owner.system, linkedCompanions(owner));
  if (feat === ANIMAL_PARTNER && !slots.animalPartner)
    return refuse(loc`Each Animal Partner selection grants one animal; all are linked.`);
  if (feat === PERSONAL_LIEUTENANT && !slots.personalLieutenant)
    return refuse(loc`Personal Lieutenant needs the feat, career level 6+ and no lieutenant already linked.`);
  const ownership = { ...owner.ownership },
    companionOf = { ownerUuid: owner.uuid, feat };
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
            threatLevel: partnerThreatLevel(owner.system.level),
            npcProfile: { ...defaultNpcProfile(), enabled: true }
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
