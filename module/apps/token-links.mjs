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
 */
import { loc } from "../i18n.mjs";
import { isLeadGM } from "../writers.mjs";
import { companionRetargets, deltaChanges, deltaSource, isPersonalCharacter } from "../rules/token-delta.mjs";
import { systemDialog } from "./dialog-theme.mjs";

const SYSTEM = "spycraft2";
const DISMISSED_SETTING = "tokenLinkReviewDismissed";

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
      console.error(`Spycraft 2.0 | Could not point the companion ${actor.name ?? actor.id} at its agent`, error);
    }
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
      console.error(`Spycraft 2.0 | Could not link the token ${proposal.key}`, error);
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
      console.error("Spycraft 2.0 | Agent token link review failed", error);
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
  Hooks.on("createToken", token => {
    if (!token.actorLink && isPersonalCharacter(token.baseActor)) queueTokenLinkReview();
  });
  Hooks.on("updateToken", (token, changed) => {
    if (changed.actorLink === false && isPersonalCharacter(token.baseActor)) queueTokenLinkReview();
  });
}
