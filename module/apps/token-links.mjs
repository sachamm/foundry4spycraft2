/**
 * Agent tokens linked to their characters.
 *
 * An agent is one particular person, so its token on a scene must be the same character as the one in the Actors
 * list. Foundry calls this "Link Actor Data". An unlinked token keeps its own copy of every change made through it
 * (its "delta"), so a player who opens the sheet from the token edits that copy and the character in the list never
 * sees it. The same holds for an agent's companion. New agents and companions are created linked
 * (module/rules/creation-defaults.mjs, module/apps/companions.mjs); this module repairs tokens placed before that, or
 * from a character that was left unlinked.
 *
 * A token with no changes of its own is linked by the version 5 world migration. A token that holds changes is put
 * to the GC in one review on the lead GC's client: a ticked row copies the token's changes to the character, then
 * links the token, so the token shows exactly what it showed before and the character in the list now matches it.
 * An unticked row is not offered again.
 *
 * The version 7 migration does that review's work without asking (rescueTokenCharacters below), and also rescues a
 * character that lives only on a token because its entry in the Actors list was deleted. Tokens placed afterwards are
 * linked as they are created when they hold nothing of their own, and an imported character keeps a linked prototype
 * token, so the review is left for tokens that were copied with their own changes or unlinked by hand.
 */
import { loc } from "../i18n.mjs";
import { isLeadGM } from "../writers.mjs";
import {
  companionRetargets,
  deltaChanges,
  deltaIsEmpty,
  deltaSource,
  isPersonalCharacter
} from "../rules/token-delta.mjs";
import { isResourceLock } from "../rules/resource-locks.mjs";
import { PERSONAL_LIEUTENANT } from "../rules/companions.mjs";
import { POOL_MAX_FLAG } from "../rules/pool-max.mjs";
import { systemDialog } from "./dialog-theme.mjs";

const SYSTEM = "spycraft2";
const DISMISSED_SETTING = "tokenLinkReviewDismissed";
/** Token flag: the version 7 rescue left this token for the GC review because another token's changes went first. */
const LEFT_FLAG = "rescueLeftForReview";
/** Actor flag: the token a character was rebuilt from by the version 7 rescue. */
const RESCUED_FLAG = "rescuedFromToken";

/** A token of an agent or companion that is not linked to its character, with what linking it would copy, or null. */
export function linkProposal(token, scene = token?.parent) {
  if (!token || token.actorLink) return null;
  const actor = token.baseActor ?? globalThis.game?.actors?.get?.(token.actorId);
  if (!isPersonalCharacter(actor)) return null;
  const changes = deltaChanges(deltaSource(token), actor.toObject?.() ?? actor);
  return { token, scene, actor, changes, key: token.uuid ?? `${scene?.id}.${token.id}` };
}

/** The proposals still to put to the GC: every unlinked agent or companion token except those the GC declined. */
export function pendingLinkProposals(scenes, { dismissed = {} } = {}) {
  const out = [];
  for (const scene of scenes ?? [])
    for (const token of scene?.tokens ?? []) {
      const proposal = linkProposal(token, scene);
      if (proposal && !dismissed[proposal.key]) out.push(proposal);
    }
  return out;
}

/** One line of plain text describing what linking a token does. */
export function describeLinkProposal({ token, scene, actor, changes }) {
  const where = scene?.name ? loc`${token.name ?? actor.name} on ${scene.name}` : (token.name ?? actor.name);
  if (!changes.count) return loc`${where}: link to ${actor.name}. The token has no changes of its own.`;
  return loc`${where}: copy the ${changes.count} change(s) made through this token to ${actor.name}, then link it.`;
}

/**
 * Copy a token's own changes to its character, then link the token and the character's prototype token. If a copy
 * fails the token is left unlinked, so nothing it holds is lost.
 */
export async function applyLinkProposal({ token, actor, changes }, options = { spycraft2TokenLink: true }) {
  if (changes.actor) await actor.update(changes.actor, options);
  for (const [name, plan] of [
    ["Item", changes.items],
    ["ActiveEffect", changes.effects]
  ]) {
    if (plan.delete.length) await actor.deleteEmbeddedDocuments(name, plan.delete, options);
    if (plan.update.length) await actor.updateEmbeddedDocuments(name, plan.update, options);
    if (plan.create.length) await actor.createEmbeddedDocuments(name, plan.create, { ...options, keepId: true });
  }
  // Item hooks skip granted-feat upkeep during the copy; it runs once now that every item is in place.
  if (changes.items.create.length + changes.items.update.length + changes.items.delete.length)
    await actor.syncGrantedFeats?.();
  // Companions made from the token's sheet point at the agent before the token is linked, so a failure here leaves
  // the token unlinked and still offered for review.
  const sceneId = token.parent?.id;
  for (const { actor: companion, update } of companionRetargets(
    globalThis.game?.actors ?? [],
    (scene, id) => scene === sceneId && id === token.id
  ))
    await companion.update(update, options);
  await token.update({ actorLink: true }, options);
  if (actor.prototypeToken?.actorLink === false) await actor.update({ "prototypeToken.actorLink": true }, options);
}

/**
 * Point any companion still naming a linked token's copy as its owner at the agent itself. Run on each load, so a
 * repoint that failed earlier is tried again.
 */
export async function retargetLinkedCompanions(game = globalThis.game) {
  const linked = (sceneId, tokenId) => game?.scenes?.get?.(sceneId)?.tokens?.get?.(tokenId)?.actorLink === true;
  for (const { actor, update } of companionRetargets(game?.actors ?? [], linked))
    try {
      await actor.update(update);
    } catch (error) {
      console.error(
        `Field Agent's Handbook | Could not point the companion ${actor.name ?? actor.id} at its agent`,
        error
      );
    }
}

/**
 * The character data an unlinked token holds when its character is no longer in the Actors list, as data for a new
 * character, or null when the token holds no agent or companion. Foundry cannot show such a token's sheet, so without
 * this everything the token kept would be lost.
 */
export function orphanCharacterData(token) {
  const delta = deltaSource(token);
  if (!delta) return null;
  const system = structuredClone(delta.system ?? {});
  const items = (delta.items ?? [])
    .filter(item => item?._id && item._tombstone !== true && !isResourceLock(item))
    .map(item => structuredClone(item));
  const effects = (delta.effects ?? [])
    .filter(effect => effect?._id && effect._tombstone !== true)
    .map(effect => structuredClone(effect));
  for (const entry of [...items, ...effects]) delete entry._tombstone;
  // A delta records its type only when it differs from the character's, so an agent is known by its build.
  const looksLikeAgent = (system.progression?.length ?? 0) > 0 || items.some(item => item.type === "class");
  // A Personal Lieutenant is an agent even before its build starts; an Animal Partner is an NPC.
  const companion = system.companionOf?.ownerUuid ? system.companionOf : null;
  const type =
    delta.type ?? (looksLikeAgent || companion?.feat === PERSONAL_LIEUTENANT ? "agent" : companion ? "npc" : null);
  if (!isPersonalCharacter({ type, system })) return null;
  const img = delta.img ?? token.texture?.src;
  // The recorded pool maximums belonged to the deleted character; the rebuilt one records its own on preparation,
  // so its vitality, wounds and action dice stay where the token had them.
  const flags = structuredClone(delta.flags ?? {});
  if (flags[SYSTEM]) delete flags[SYSTEM][POOL_MAX_FLAG];
  flags[SYSTEM] = { ...(flags[SYSTEM] ?? {}), [RESCUED_FLAG]: rescueKey(token) };
  return {
    name: delta.name || token.name || loc`Recovered agent`,
    type,
    ...(img ? { img } : {}),
    system,
    items,
    effects,
    flags,
    ...(delta.ownership ? { ownership: structuredClone(delta.ownership) } : {}),
    prototypeToken: { name: token.name ?? delta.name ?? "", actorLink: true, ...(img ? { texture: { src: img } } : {}) }
  };
}

/** What a character rebuilt from an orphan token records of that token, so a retry finds it again. */
const rescueKey = token => token.uuid ?? `Scene.${token.parent?.id}.Token.${token.id}`;

/** Scenes in the order the rescue walks them: the scene the GC is on first, then the active one, then the rest. */
function scenesInOrder(scenes, first = []) {
  const out = [];
  for (const scene of [...first, ...(scenes ?? [])]) if (scene && !out.includes(scene)) out.push(scene);
  return out;
}

/**
 * Version 7: put every agent or companion that an unlinked token holds into the Actors list, and link the token to
 * it. A token of a character in the list has its changes copied to that character (as a ticked review row would);
 * a token whose character was deleted becomes a new character. When two unlinked tokens of one character both hold
 * changes, only the first (on the current scene first) is copied without asking; the other stays for the GC review,
 * so neither token's changes overwrite the other's unseen.
 * @param {{scenes?: Iterable, currentScenes?: object[], worldActors?: Iterable, createActor?: Function}} world
 * @returns {{linked: number, created: number, left: number}}
 */
export async function rescueTokenCharacters(world, options = { spycraft2TokenLink: true }) {
  const actors = [...(world?.worldActors ?? [])].filter(actor => !actor.isToken);
  const find = id => (id ? actors.find(actor => actor.id === id) : null);
  const copied = new Set();
  const report = { linked: 0, created: 0, left: 0 };
  const errors = [];
  for (const scene of scenesInOrder(world?.scenes, world?.currentScenes))
    for (const token of [...(scene?.tokens ?? [])]) {
      if (token.actorLink) continue;
      try {
        const actor = find(token.actorId);
        if (actor) {
          if (!isPersonalCharacter(actor)) continue;
          const changes = deltaChanges(deltaSource(token), actor.toObject?.() ?? actor);
          // A token set aside on an earlier run stays set aside, even once the other token is linked.
          if (changes.count && (copied.has(actor.id) || token.flags?.[SYSTEM]?.[LEFT_FLAG])) {
            if (!token.flags?.[SYSTEM]?.[LEFT_FLAG])
              await token.update({ [`flags.${SYSTEM}.${LEFT_FLAG}`]: true }, options);
            report.left++;
            continue;
          }
          if (changes.count) copied.add(actor.id);
          await applyLinkProposal({ token, scene, actor, changes }, options);
          report.linked++;
          continue;
        }
        const data = orphanCharacterData(token);
        if (!data || typeof world?.createActor !== "function") continue;
        // A retry after a failed relink reuses the character the earlier run built, instead of building another.
        const key = rescueKey(token);
        let created = actors.find(actor => actor.flags?.[SYSTEM]?.[RESCUED_FLAG] === key);
        if (!created) {
          created = await world.createActor(data, options);
          if (!created?.id) throw new Error(loc`The rescued character ${data.name} was not created.`);
          actors.push(created);
        }
        // Companions made from this token's sheet named its copy as their owner; they follow the new character.
        const ownerUuid = `Scene.${scene.id}.Token.${token.id}.Actor.`;
        for (const companion of actors)
          if (companion.system?.companionOf?.ownerUuid?.startsWith(ownerUuid))
            await companion.update({ "system.companionOf.ownerUuid": `Actor.${created.id}` }, options);
        await token.update({ actorId: created.id, actorLink: true }, options);
        report.created++;
      } catch (error) {
        errors.push(error);
        console.error(
          `Field Agent's Handbook | Could not rescue the character on token ${token.uuid ?? token.id}`,
          error
        );
      }
    }
  // A failure keeps the world's old version, so the rescue runs again next time; tokens already linked are skipped.
  if (errors.length) throw new Error(loc`${errors.length} token(s) could not be linked to a character.`);
  return report;
}

/**
 * Whether a token being created should be linked to its character: an agent or companion token that is not linked
 * and holds nothing of its own, so it would only ever be the character in the list (a character imported from an old
 * export can carry an unlinked prototype token). A copy that holds its own changes is left for the GC review.
 */
export function linksOnCreate(token, data = {}) {
  const linked = data.actorLink ?? token?.actorLink;
  if (linked !== false) return false;
  const actor = token?.baseActor ?? globalThis.game?.actors?.get?.(data.actorId ?? token?.actorId);
  if (!isPersonalCharacter(actor)) return false;
  return deltaIsEmpty(data.delta ?? deltaSource(token), actor.toObject?.() ?? actor);
}

/** Ask the GC about each unlinked agent or companion token; link ticked rows and remember unticked ones. */
export async function reviewTokenLinks(proposals) {
  if (!proposals.length) return { linked: 0 };
  const esc = foundry.utils.escapeHTML;
  const rows = proposals
    .map(
      (proposal, index) =>
        `<label class="sc2-ownership-row"><input type="checkbox" name="link-${index}" checked /> ${esc(describeLinkProposal(proposal))}</label>`
    )
    .join("");
  const input = await systemDialog.input({
    window: { title: loc`Link character tokens` },
    position: { width: 560 },
    rejectClose: false,
    content: `<p>${loc`These tokens of agents and their companions are not linked to their characters, so changes made through them do not reach the character in the Actors list. Ticked rows are linked; unticked rows are not offered again. Close the window to decide later.`}</p><div class="spycraft2-roll-options">${rows}</div>`,
    ok: { label: loc`Link ticked tokens` }
  });
  if (!input) return { linked: 0 };
  const dismissed = { ...(game.settings.get(SYSTEM, DISMISSED_SETTING) ?? {}) };
  let linked = 0,
    failed = 0;
  for (const [index, proposal] of proposals.entries()) {
    if (!input[`link-${index}`]) {
      dismissed[proposal.key] = true;
      continue;
    }
    // Read the token again: a player may have changed it while the dialog was open.
    const fresh = linkProposal(proposal.token, proposal.scene);
    if (!fresh) continue;
    try {
      await applyLinkProposal(fresh);
      delete dismissed[proposal.key];
      linked++;
    } catch (error) {
      failed++;
      console.error(`Field Agent's Handbook | Could not link the token ${proposal.key}`, error);
    }
  }
  await game.settings.set(SYSTEM, DISMISSED_SETTING, dismissed);
  if (linked) ui.notifications?.info(loc`Linked ${linked} token(s) to their characters.`);
  if (failed)
    ui.notifications?.error(
      loc`${failed} token(s) could not be linked and still hold their own changes. Reload the world to try again; the console has the details.`
    );
  return { linked, failed };
}

let timer = null;
let reviewing = false;
/** Open one review on the lead GC's client shortly afterwards. */
export function queueTokenLinkReview() {
  if (!isLeadGM() || timer) return;
  timer = setTimeout(async () => {
    timer = null;
    if (reviewing) return queueTokenLinkReview();
    reviewing = true;
    try {
      await reviewTokenLinks(
        pendingLinkProposals(game.scenes, { dismissed: game.settings.get(SYSTEM, DISMISSED_SETTING) ?? {} })
      );
    } catch (error) {
      console.error("Field Agent's Handbook | Agent token link review failed", error);
    } finally {
      reviewing = false;
    }
  }, 750);
}

/** Register the setting and hooks. Call during `init`. */
export function installTokenLinks() {
  game.settings.register(SYSTEM, DISMISSED_SETTING, { scope: "world", config: false, type: Object, default: {} });
  // After the world migration has linked every token that had no changes of its own.
  Hooks.once("spycraft2.ready", () => {
    if (isLeadGM()) retargetLinkedCompanions();
    queueTokenLinkReview();
  });
  Hooks.on("preCreateToken", (token, data) => {
    if (linksOnCreate(token, data)) token.updateSource({ actorLink: true });
  });
  Hooks.on("createToken", token => {
    if (!token.actorLink && isPersonalCharacter(token.baseActor)) queueTokenLinkReview();
  });
  Hooks.on("updateToken", (token, changed) => {
    if (changed.actorLink === false && isPersonalCharacter(token.baseActor)) queueTokenLinkReview();
  });
}
