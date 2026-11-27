/**
 * Add NPC to scene: the GC picks an NPC from the world or from the system's NPC compendiums and one or more tokens
 * are placed around the centre of the current view, on free squares, with numbered names. A compendium NPC is
 * imported once; later placements reuse that world actor instead of filling the Actors directory with copies.
 */
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";
import { cancellable, cancelButton, freeCancel, holdUntilValid } from "../dialog-kit.mjs";
import { antagonistRecorded, markAntagonistsFaced, recordAntagonist } from "./mission.mjs";
import { getMission, teamActors } from "./state.mjs";
import { minionSquad } from "../../rules/npc-qualities.mjs";

const kindLabel = type =>
  ({ standard: loc`standard`, special: loc`special`, villain: loc`special`, animal: loc`animal` })[type] ?? "";

/**
 * The NPCs to choose from, world actors first, then each NPC compendium's, each list by name.
 * @returns {Promise<{uuid: string, name: string, source: string}[]>}
 */
export async function npcChoices({ actors = game.actors, packs = game.packs } = {}) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const world = [...(actors ?? [])]
    .filter(actor => actor.type === "npc")
    .map(actor => ({ uuid: actor.uuid, name: actor.name, source: loc`World`, kind: kindLabel(actor.system?.npcType) }))
    .sort(byName);
  const fromPacks = [];
  for (const pack of packs ?? []) {
    if (pack.documentName !== "Actor") continue;
    const index = await pack.getIndex({ fields: ["type", "system.npcType"] });
    const rows = [...index]
      .filter(entry => entry.type === "npc")
      .map(entry => ({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.Actor.${entry._id}`,
        name: entry.name,
        source: pack.title,
        kind: kindLabel(entry.system?.npcType)
      }))
      .sort(byName);
    fromPacks.push(...rows);
  }
  return [...world, ...fromPacks];
}

/** A world actor already imported from this compendium entry, so it can be placed again without a copy. */
export function importedCopy(uuid, actors = game.actors) {
  return (
    [...(actors ?? [])].find(
      actor => actor._stats?.compendiumSource === uuid || actor.flags?.core?.sourceId === uuid
    ) ?? null
  );
}

/** The top-left corner that puts a token of this many grid squares at the centre of the view, on the grid. */
export function viewCentreCorner({ centre, gridSize, width = 1, height = 1, snap = point => point }) {
  return snap({ x: centre.x - (width * gridSize) / 2, y: centre.y - (height * gridSize) / 2 });
}

/**
 * Top-left corners for a number of tokens, starting at the origin square and working outward ring by ring, skipping
 * squares something already stands on. All values are in pixels; the origin is already on the grid.
 * @param {{origin: {x:number,y:number}, count: number, gridSize: number, width?: number, height?: number,
 *   occupied?: {x:number,y:number,width?:number,height?:number}[]}} facts
 */
export function spreadCorners({ origin, count, gridSize, width = 1, height = 1, occupied = [] }) {
  const stepX = width * gridSize,
    stepY = height * gridSize;
  const taken = occupied.map(token => ({
    x: token.x,
    y: token.y,
    w: (token.width ?? 1) * gridSize,
    h: (token.height ?? 1) * gridSize
  }));
  const free = point =>
    !taken.some(
      box => point.x < box.x + box.w && point.x + stepX > box.x && point.y < box.y + box.h && point.y + stepY > box.y
    );
  const placed = [];
  for (let ring = 0; placed.length < count && ring < 40; ring++)
    for (let dy = -ring; dy <= ring && placed.length < count; dy++)
      for (let dx = -ring; dx <= ring && placed.length < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const point = { x: origin.x + dx * stepX, y: origin.y + dy * stepY };
        if (point.x < 0 || point.y < 0 || !free(point)) continue;
        placed.push(point);
        taken.push({ x: point.x, y: point.y, w: stepX, h: stepY });
      }
  return placed;
}

/**
 * Names for new tokens of one NPC. A lone token on a scene with no other keeps the plain name; otherwise each gets
 * the next free number, so the tracker, the map and the chat cards can tell them apart.
 */
export function numberedNames(name, count, existing = []) {
  // A squad's Commander carries a mark after its number, and still counts.
  const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: (\\d+))?(?: \\(.+\\))?$`);
  const used = existing.map(other => pattern.exec(other)).filter(Boolean);
  if (count === 1 && !used.length) return [name];
  let next = Math.max(0, ...used.map(match => Number(match[1] ?? 1))) + 1;
  return Array.from({ length: count }, () => `${name} ${next++}`);
}

function filterList(dialog) {
  const root = dialog?.element;
  const search = root?.querySelector('[name="search"]'),
    list = root?.querySelector('[name="uuid"]');
  if (!search || !list) return;
  search.addEventListener("input", () => {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let first = null;
    for (const option of list.options) {
      const shown = words.every(word => option.textContent.toLowerCase().includes(word));
      option.hidden = !shown;
      if (shown && !first) first = option;
    }
    // A source with no match does not leave its heading behind.
    for (const group of list.querySelectorAll("optgroup"))
      group.hidden = [...group.children].every(option => option.hidden);
    // With no match nothing stays selected, so the dialog cannot place an NPC the list no longer shows.
    if (!first) list.value = "";
    else if (list.selectedOptions[0]?.hidden !== false) list.value = first.value;
  });
  search.focus();
}

const DISPOSITIONS = { hostile: -1, neutral: 0, friendly: 1 };

/**
 * Token data for a placement: where each copy goes, what it is called and how it stands toward the team.
 * @returns {object[]} One creation object per token.
 */
export function placementData(
  prototype,
  { corners, names, disposition = "hostile", hidden = false, commanderIndex = null }
) {
  return corners.map((corner, index) => ({
    ...prototype,
    ...corner,
    name:
      index === commanderIndex ? loc`${names[index] ?? prototype.name} (Commander)` : (names[index] ?? prototype.name),
    // The squad's Commander is built at Threat Level +2 (p.447); the mark lives on this token's own data.
    ...(index === commanderIndex ? { delta: { ...(prototype.delta ?? {}), system: { commander: true } } } : {}),
    hidden,
    ...(disposition in DISPOSITIONS ? { disposition: DISPOSITIONS[disposition] } : {}),
    // Several copies of one NPC are separate people: each keeps its own damage.
    ...(corners.length > 1 ? { actorLink: false } : {}),
    // A numbered name is final: Foundry's own numbering is not added on top.
    ...(names[index] && names[index] !== prototype.name ? { appendNumber: false } : {})
  }));
}

/** Put new tokens into the running fight. One of a kind that has already rolled joins on that kind's Count. */
export async function joinFight(combat, tokens) {
  if (!combat || !tokens.length) return [];
  const known = token =>
    combat.combatants.find?.(other => other.actorId === token.actorId && Number.isFinite(other.initiative))
      ?.initiative ?? null;
  return combat.createEmbeddedDocuments(
    "Combatant",
    tokens.map(token => ({
      tokenId: token.id,
      sceneId: token.parent?.id ?? canvas.scene?.id,
      actorId: token.actorId,
      hidden: !!token.hidden,
      ...(known(token) === null ? {} : { initiative: known(token) })
    }))
  );
}

export async function addNpcToScene() {
  if (!game.user.isGM) return null;
  if (!canvas?.ready || !canvas.scene) return refuse(loc`View a scene first, then add the NPC to it.`);
  const sceneId = canvas.scene.id;
  const choices = await npcChoices();
  if (!choices.length) return refuse(loc`There are no NPCs in the world or in the NPC compendiums.`);
  const groups = new Map();
  for (const choice of choices) groups.set(choice.source, [...(groups.get(choice.source) ?? []), choice]);
  const fight = game.combat ?? null,
    mission = getMission();
  const input = await cancellable(systemDialog.input, {
    window: { title: loc`Add NPC to scene` },
    position: { width: 520 },
    rejectClose: false,
    ok: { label: loc`Place on the scene` },
    buttons: [cancelButton()],
    render: (_event, dialog) => {
      freeCancel(dialog?.element);
      // An entry with no NPC picked stays open with the reason, so the search and the other choices are kept.
      holdUntilValid(dialog?.element, values =>
        values.uuid ? "" : loc`No NPC is chosen. Clear the search or pick one from the list.`
      );
      return filterList(dialog);
    },
    content: `<div class="spycraft2-roll-options"><label>${loc`Search`} <input name="search" type="search" autocomplete="off" autofocus /></label><label>${loc`NPC`} <select name="uuid" size="10" class="sc2-pick-list">${[
      ...groups
    ]
      .map(
        ([source, rows], g) =>
          `<optgroup label="${esc(source)}">${rows.map((row, i) => `<option value="${esc(row.uuid)}"${g === 0 && i === 0 ? " selected" : ""}>${esc(row.name)}${row.kind ? ` (${esc(row.kind)})` : ""}</option>`).join("")}</optgroup>`
      )
      .join("")}</select></label>
      <label>${loc`How many`} <input name="copies" type="number" min="1" max="20" placeholder="${esc(loc`1, or a Minion squad`)}" /></label>
      <label>${loc`Stands toward the team as`} <select name="disposition"><option value="hostile" selected>${loc`Hostile`}</option><option value="neutral">${loc`Neutral`}</option><option value="friendly">${loc`Friendly`}</option><option value="keep">${loc`As its own token is set`}</option></select></label>
      <label><input type="checkbox" name="hidden" /> ${loc`Hidden from the players`}</label>
      ${fight ? `<label><input type="checkbox" name="join" checked /> ${loc`Join the fight on the tracker`}</label>` : ""}
      ${mission.name || mission.active ? `<label><input type="checkbox" name="record" /> ${loc`Also record it for mission XP, if its type is not listed yet`}</label>` : ""}
      <p class="hint">${loc`A compendium NPC is imported the first time and reused after that. Tokens go on free squares around the centre of your view, numbered when there is more than one.`} ${loc`Left blank, a Minion comes as a squad the team's size (twice that with Horde), one of them its Commander if it has that quality (pp.447–448).`}</p></div>`
  });
  if (!input) return null;
  if (!input.uuid) return refuse(loc`No NPC is chosen. Clear the search or pick one from the list.`);
  // The dialog does not block the map: the scene it was opened for must still be the one in view.
  const scene = canvas?.scene;
  if (!scene || scene.id !== sceneId)
    return refuse(loc`The scene changed while the dialog was open. Nothing was added.`);
  let actor = await fromUuid(input.uuid);
  if (actor?.pack)
    actor = importedCopy(input.uuid) ?? (await game.actors.importFromCompendium(game.packs.get(actor.pack), actor.id));
  if (actor?.type !== "npc") return refuse(loc`That NPC could not be found.`);
  const prototype = await actor.getTokenDocument();
  // A Minion squad has as many members as the team, twice as many under Horde (pp.447–448).
  const squad = actor.system?.npcProfile?.enabled
      ? minionSquad(actor.system.npcProfile.qualities, teamActors(mission).length)
      : null,
    typed = Math.trunc(Number(input.copies)) || 0;
  const count = Math.min(20, Math.max(1, typed || squad?.size || 1));
  const origin = viewCentreCorner({
    centre: canvas.stage.pivot,
    gridSize: canvas.grid.size,
    width: prototype.width,
    height: prototype.height,
    snap: point => canvas.grid.getTopLeftPoint?.(point) ?? point
  });
  const others = [...scene.tokens];
  const corners = spreadCorners({
    origin,
    count,
    gridSize: canvas.grid.size,
    width: prototype.width,
    height: prototype.height,
    occupied: others.map(token => ({ x: token.x, y: token.y, width: token.width, height: token.height }))
  });
  if (!corners.length) return refuse(loc`There is no free square near the centre of the view.`);
  const names = numberedNames(
    prototype.name || actor.name,
    corners.length,
    others.filter(token => token.actorId === actor.id).map(token => token.name)
  );
  const tokens = await scene.createEmbeddedDocuments(
    "Token",
    placementData(prototype.toObject(), {
      corners,
      names,
      disposition: input.disposition,
      hidden: !!input.hidden,
      commanderIndex: squad?.commander && corners.length > 1 ? 0 : null
    })
  );
  const done = [loc`${tokens.length} × ${actor.name} added to ${scene.name}`];
  if (!typed && squad) done.push(loc`a Minion squad the team's size`);
  if (squad?.commander && corners.length > 1) done.push(loc`led by its Commander at Threat Level +2`);
  let joined = false;
  if (input.join && fight) {
    // A fight deleted meanwhile leaves the tokens placed; the notice says they did not join.
    joined = !!game.combats?.get?.(fight.id) && !!(await joinFight(fight, tokens).catch(() => null));
    done.push(joined ? loc`joined the fight` : loc`the fight is gone, so they did not join it`);
  }
  if (input.record && !antagonistRecorded(actor)) {
    // An NPC that walks straight into a fight has been faced.
    const entry = await recordAntagonist(actor, { encountered: joined });
    done.push(entry?.xp ? loc`recorded for mission XP` : loc`recorded for mission XP with 0 XP: enter its reward`);
  }
  // A type already on the list is faced once it walks into a fight.
  if (joined) await markAntagonistsFaced([actor]).catch(() => 0);
  ui.notifications.info(`${done.join("; ")}.`);
  return tokens.length === 1 ? tokens[0] : tokens;
}
