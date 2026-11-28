/**
 * Character (agent) ownership defaults.
 *
 * New agents start with every player able to observe them (a world setting picks the level). On the lead GC's
 * client, agents whose players cannot observe them, or which belong to an identifiable player who does not own them,
 * are gathered into one review dialog; nothing changes until the GC confirms. A player is identified by the
 * character assigned to them in User Configuration, or failing that by their user name appearing in the agent's name
 * ("Breakwater (Sacha)", "Sacha's agent"). A row the GC unticks is not offered again until the proposal changes.
 */
import { readSetting } from "../settings.mjs";
import { loc, locKey } from "../i18n.mjs";
import { isLeadGM } from "../writers.mjs";
import { systemDialog } from "./dialog-theme.mjs";

const SYSTEM = "spycraft2";
const DEFAULT_SETTING = "characterDefaultOwnership";
const REVIEW_SETTING = "reviewCharacterOwnership";
const DISMISSED_SETTING = "ownershipReviewDismissed";
export const OWNERSHIP = Object.freeze({ NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 });

/** Lower-case words of a name, without accents or a possessive "'s". */
export function nameWords(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const characterIdOf = user => user?.character?.id ?? (typeof user?.character === "string" ? user.character : null);

/**
 * The one player an agent belongs to, or null: the player it is assigned to, otherwise the one player whose whole
 * user name appears among the words of the agent's name. Two candidates mean nobody is guessed.
 */
export function matchingPlayer(actor, users = []) {
  const players = [...users].filter(user => user && !user.isGM);
  const assigned = players.filter(user => characterIdOf(user) === actor?.id);
  if (assigned.length === 1) return { user: assigned[0], reason: "assigned" };
  if (assigned.length > 1) return null;
  const words = new Set(nameWords(actor?.name));
  const named = players.filter(user => {
    const own = nameWords(user.name);
    return own.join("").length >= 2 && own.every(word => words.has(word));
  });
  return named.length === 1 ? { user: named[0], reason: "name" } : null;
}

/**
 * The ownership changes an agent needs, or null when none: raise the default to `defaultLevel`, and make the
 * identified player its owner when no player owns it yet.
 */
export function ownershipProposal(actor, users = [], { defaultLevel = OWNERSHIP.OBSERVER } = {}) {
  if (actor?.type !== "agent" || actor.pack) return null;
  const ownership = actor.ownership ?? {};
  const changes = {};
  if (defaultLevel > OWNERSHIP.NONE && (ownership.default ?? OWNERSHIP.NONE) < defaultLevel)
    changes.default = defaultLevel;
  const players = [...users].filter(user => user && !user.isGM);
  const playerOwned = players.some(user => (ownership[user.id] ?? OWNERSHIP.NONE) >= OWNERSHIP.OWNER);
  const match = playerOwned ? null : matchingPlayer(actor, players);
  if (match) changes[match.user.id] = OWNERSHIP.OWNER;
  if (!Object.keys(changes).length) return null;
  const signature = JSON.stringify(Object.entries(changes).sort(([a], [b]) => a.localeCompare(b)));
  return { actor, changes, player: match?.user ?? null, reason: match?.reason ?? null, signature };
}

/** The proposals still to put to the GC: everything except rows the GC already declined in that exact form. */
export function pendingProposals(actors, users, { defaultLevel = OWNERSHIP.OBSERVER, dismissed = {} } = {}) {
  return [...actors]
    .map(actor => ownershipProposal(actor, users, { defaultLevel }))
    .filter(proposal => proposal && dismissed[proposal.actor.id] !== proposal.signature);
}

const levelLabel = level =>
  ({
    [OWNERSHIP.LIMITED]: loc`Limited`,
    [OWNERSHIP.OBSERVER]: loc`Observer`,
    [OWNERSHIP.OWNER]: loc`Owner`
  })[level] ?? loc`None`;

/** One line of plain text describing what a proposal would change. */
export function describeProposal(proposal) {
  const parts = [];
  if (Object.hasOwn(proposal.changes, "default")) parts.push(loc`all players: ${levelLabel(proposal.changes.default)}`);
  if (proposal.player)
    parts.push(
      proposal.reason === "assigned"
        ? loc`${proposal.player.name}: Owner (assigned character)`
        : loc`${proposal.player.name}: Owner (name match)`
    );
  return parts.join("; ");
}

function setting(key, fallback) {
  return readSetting(key, fallback);
}

/** The default ownership level new agents receive (0 leaves Foundry's own default). */
export const defaultCharacterOwnership = () => Number(setting(DEFAULT_SETTING, OWNERSHIP.OBSERVER)) || 0;

/** Give a new agent the world's default ownership unless its data already grants at least that much. */
export function applyDefaultOwnership(actor, _data, options = {}, userId) {
  if (actor?.type !== "agent" || options?.spycraft2KeepOwnership) return;
  if (userId && globalThis.game?.user && userId !== game.user.id) return;
  const level = defaultCharacterOwnership();
  if (!level || (actor._source?.ownership?.default ?? OWNERSHIP.NONE) >= level) return;
  actor.updateSource({ "ownership.default": level });
}

/** The proposal an agent needs now, from the current users and setting. */
const currentProposal = actor =>
  ownershipProposal(globalThis.game?.actors?.get?.(actor.id) ?? actor, [...(globalThis.game?.users ?? [])], {
    defaultLevel: defaultCharacterOwnership()
  });

/**
 * Ask the GC about each proposal; apply ticked rows and remember unticked ones. A row whose agent or players changed
 * while the dialog was open is neither applied nor remembered; it is offered again in a fresh review.
 */
export async function reviewOwnership(proposals, { recheck = currentProposal } = {}) {
  if (!proposals.length) return { applied: 0 };
  const esc = foundry.utils.escapeHTML;
  const rows = proposals
    .map(
      proposal =>
        `<label class="sc2-ownership-row"><input type="checkbox" name="apply-${esc(proposal.actor.id)}" checked /> <span><strong>${esc(proposal.actor.name)}</strong>: ${esc(describeProposal(proposal))}</span></label>`
    )
    .join("");
  const input = await systemDialog.input({
    window: { title: loc`Review character ownership` },
    position: { width: 520 },
    rejectClose: false,
    content: `<p>${loc`These characters are missing the ownership the system would give them. Ticked rows are applied; unticked rows are not offered again unless something changes. Close the window to decide later.`}</p><div class="spycraft2-roll-options">${rows}</div>`,
    ok: { label: loc`Apply ticked changes` }
  });
  if (!input) return { applied: 0 };
  const dismissed = { ...(setting(DISMISSED_SETTING, {}) ?? {}) };
  const applied = [];
  const changed = [];
  for (const proposal of proposals) {
    const now = recheck(proposal.actor);
    if (now?.signature !== proposal.signature) {
      changed.push(proposal.actor);
      continue;
    }
    if (input[`apply-${proposal.actor.id}`]) {
      await (now.actor ?? proposal.actor).update({ ownership: proposal.changes });
      delete dismissed[proposal.actor.id];
      applied.push(now);
    } else dismissed[proposal.actor.id] = proposal.signature;
  }
  await game.settings.set(SYSTEM, DISMISSED_SETTING, dismissed);
  // Name each change when there are few; a first load that opens many sheets to the table gets one line.
  if (applied.length > 3) ui.notifications?.info(loc`Updated ownership on ${applied.length} characters.`);
  else for (const proposal of applied) ui.notifications?.info(appliedMessage(proposal));
  if (changed.length) queueOwnershipReview(changed);
  return { applied: applied.length, changed: changed.length };
}

/** What the GC is told after a row is applied: who can now edit which character. */
export function appliedMessage(proposal) {
  const name = proposal.actor.name;
  if (proposal.player) return loc`${proposal.player.name} now owns ${name} and can edit the sheet.`;
  return loc`Every player can now see ${name}.`;
}

/**
 * On a player's own client: say so when the GC has just made them the owner of an agent, so the change is visible
 * where they are looking. Their open sheet re-renders by itself.
 */
export function announceNewOwnership(actor, changed, _options, userId) {
  const user = globalThis.game?.user;
  if (!user || user.isGM || actor?.type !== "agent" || userId === user.id) return false;
  const level = changed?.ownership?.[user.id];
  if (level === undefined || level < OWNERSHIP.OWNER) return false;
  ui.notifications?.info(loc`The GC made you the owner of ${actor.name}. You can now edit the sheet.`);
  return true;
}

let queued = null;
let reviewing = false;
/** Gather agents (all when none are named) and open one review on the lead GC's client shortly afterwards. */
export function queueOwnershipReview(actors = null) {
  if (!isLeadGM() || !setting(REVIEW_SETTING, true)) return;
  const all = actors === null;
  queued ??= { all: false, ids: new Set() };
  if (all) queued.all = true;
  else for (const actor of actors) if (actor?.type === "agent") queued.ids.add(actor.id);
  if (queued.timer) return;
  queued.timer = setTimeout(async () => {
    const batch = queued;
    queued = null;
    if (reviewing) return queueOwnershipReview(batch.all ? null : [...batch.ids].map(id => game.actors.get(id)));
    reviewing = true;
    try {
      const actors = batch.all ? [...game.actors] : [...batch.ids].map(id => game.actors.get(id)).filter(Boolean);
      await reviewOwnership(
        pendingProposals(actors, [...game.users], {
          defaultLevel: defaultCharacterOwnership(),
          dismissed: setting(DISMISSED_SETTING, {}) ?? {}
        })
      );
    } catch (error) {
      console.error("Field Agent's Handbook | Character ownership review failed", error);
    } finally {
      reviewing = false;
    }
  }, 750);
}

/** Register the settings and hooks. Call during `init`. */
export function installCharacterOwnership() {
  game.settings.register(SYSTEM, DEFAULT_SETTING, {
    name: locKey`Default player access to new characters`,
    hint: locKey`What every player can do with a newly created agent. Observer lets the table see each other's sheets; the owning player still needs Owner, which the ownership review can set.`,
    scope: "world",
    config: true,
    type: Number,
    choices: {
      [OWNERSHIP.NONE]: locKey`None (Foundry's default)`,
      [OWNERSHIP.LIMITED]: locKey`Limited`,
      [OWNERSHIP.OBSERVER]: locKey`Observer`
    },
    default: OWNERSHIP.OBSERVER
  });
  game.settings.register(SYSTEM, REVIEW_SETTING, {
    name: locKey`Review character ownership`,
    hint: locKey`When the world loads, and when a character is created, renamed or assigned to a player, offer the GC any missing ownership: the default player access above, and Owner for the player the character is assigned to or whose user name appears in its name. Nothing changes until the GC confirms.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SYSTEM, DISMISSED_SETTING, { scope: "world", config: false, type: Object, default: {} });
  Hooks.on("preCreateActor", applyDefaultOwnership);
  Hooks.on("createActor", actor => queueOwnershipReview([actor]));
  Hooks.on("updateActor", announceNewOwnership);
  Hooks.on("updateActor", (actor, changed) => {
    // A GC lowering ownership by hand is not second-guessed; only a new name can identify a new player.
    if (Object.hasOwn(changed, "name")) queueOwnershipReview([actor]);
  });
  Hooks.on("updateUser", (user, changed) => {
    if (!Object.hasOwn(changed, "character")) return;
    const actor = game.actors?.get(changed.character);
    if (actor) queueOwnershipReview([actor]);
  });
  Hooks.once("spycraft2.ready", () => queueOwnershipReview());
  Hooks.on("renderActorDirectory", (_app, html) => actorDirectoryHelp(html));
}

/**
 * One step for the GC: a new agent, owned by the chosen player and assigned as that player's character, opened on its
 * sheet. Returns the actor, or null when cancelled.
 */
export async function newAgentForPlayer(input = null) {
  if (!game.user?.isGM) return null;
  const players = [...(game.users ?? [])].filter(user => !user.isGM);
  if (!players.length) {
    ui.notifications?.warn?.(loc`There are no player users yet. Add one under Configure Players first.`);
    return null;
  }
  const esc = foundry.utils.escapeHTML;
  input ??= await systemDialog.input({
    window: { title: loc`New agent for a player` },
    rejectClose: false,
    ok: { label: loc`Create agent` },
    content: `<div class="spycraft2-roll-options">
      <label>${loc`Player`} <select name="userId">${players.map(user => `<option value="${esc(user.id)}">${esc(user.name)}</option>`).join("")}</select></label>
      <label>${loc`Agent name`} <input name="name" placeholder="${esc(loc`Leave blank to name it after the player`)}" /></label>
      <p class="hint">${loc`The player owns the agent and has it as their character; the sheet opens on character creation.`}</p></div>`
  });
  if (!input) return null;
  const user = game.users.get(input.userId);
  if (!user || user.isGM) return null;
  const name = String(input.name ?? "").trim() || loc`${user.name}'s agent`;
  const actor = await Actor.create({ name, type: "agent", ownership: { [user.id]: OWNERSHIP.OWNER } });
  if (!actor) return null;
  await user.update({ character: actor.id });
  ui.notifications?.info?.(loc`${name} created for ${user.name}, who owns it and has it as their character.`);
  actor.sheet?.render?.(true);
  return actor;
}

/** The Actors tab: a "New agent for a player" button for the GC, and a line for a player who has nothing there yet. */
export function actorDirectoryHelp(html, user = game.user, actors = game.actors) {
  const root = html?.querySelector ? html : html?.[0];
  if (!root || root.querySelector(".sc2-directory-help")) return;
  const holder = document.createElement("div");
  holder.className = "sc2-directory-help";
  if (user?.isGM) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = loc`New agent for a player`;
    button.addEventListener("click", () => newAgentForPlayer());
    holder.append(button);
  } else if (![...(actors ?? [])].some(actor => actor.isOwner)) {
    const note = document.createElement("p");
    note.textContent = loc`No agent of yours yet. Your GC creates one for you, or gives you permission to create actors.`;
    holder.append(note);
  } else return;
  const header = root.querySelector(".directory-header") ?? root.querySelector("header");
  if (header) header.after(holder);
  else root.prepend(holder);
}
