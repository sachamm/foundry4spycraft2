/**
 * Add NPC to scene: the GC picks an NPC from the world or from the system's NPC compendiums and it is placed at the
 * centre of the current view. A compendium NPC is imported once; later placements reuse that world actor instead of
 * filling the Actors directory with copies.
 */
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";

/**
 * The NPCs to choose from, world actors first, then each NPC compendium's, each list by name.
 * @returns {Promise<{uuid: string, name: string, source: string}[]>}
 */
export async function npcChoices({ actors = game.actors, packs = game.packs } = {}) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const world = [...(actors ?? [])]
    .filter(actor => actor.type === "npc")
    .map(actor => ({ uuid: actor.uuid, name: actor.name, source: loc`World` }))
    .sort(byName);
  const fromPacks = [];
  for (const pack of packs ?? []) {
    if (pack.documentName !== "Actor") continue;
    const index = await pack.getIndex({ fields: ["type"] });
    const rows = [...index]
      .filter(entry => entry.type === "npc")
      .map(entry => ({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.Actor.${entry._id}`,
        name: entry.name,
        source: pack.title
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
    if (list.selectedOptions[0]?.hidden !== false && first) list.value = first.value;
  });
  search.focus();
}

export async function addNpcToScene() {
  if (!game.user.isGM) return null;
  if (!canvas?.ready || !canvas.scene) return refuse(loc`View a scene first, then add the NPC to it.`);
  const choices = await npcChoices();
  if (!choices.length) return refuse(loc`There are no NPCs in the world or in the NPC compendiums.`);
  const groups = new Map();
  for (const choice of choices) groups.set(choice.source, [...(groups.get(choice.source) ?? []), choice]);
  const input = await systemDialog.input({
    window: { title: loc`Add NPC to scene` },
    rejectClose: false,
    ok: { label: loc`Place at view centre` },
    render: (_event, dialog) => filterList(dialog),
    content: `<div class="spycraft2-roll-options"><label>${loc`Search`} <input name="search" type="search" autocomplete="off" /></label><label>${loc`NPC`} <select name="uuid" size="12" required>${[
      ...groups
    ]
      .map(
        ([source, rows], g) =>
          `<optgroup label="${esc(source)}">${rows.map((row, i) => `<option value="${esc(row.uuid)}"${g === 0 && i === 0 ? " selected" : ""}>${esc(row.name)}</option>`).join("")}</optgroup>`
      )
      .join(
        ""
      )}</select></label><p class="hint">${loc`A compendium NPC is imported the first time and reused after that. The token is placed at the centre of your view; drag it from there.`}</p></div>`
  });
  if (!input?.uuid) return null;
  let actor = await fromUuid(input.uuid);
  if (actor?.pack)
    actor = importedCopy(input.uuid) ?? (await game.actors.importFromCompendium(game.packs.get(actor.pack), actor.id));
  if (actor?.type !== "npc") return refuse(loc`That NPC could not be found.`);
  const prototype = await actor.getTokenDocument();
  const { x, y } = viewCentreCorner({
    centre: canvas.stage.pivot,
    gridSize: canvas.grid.size,
    width: prototype.width,
    height: prototype.height,
    snap: point => canvas.grid.getTopLeftPoint?.(point) ?? point
  });
  const [token] = await canvas.scene.createEmbeddedDocuments("Token", [{ ...prototype.toObject(), x, y }]);
  ui.notifications.info(loc`${actor.name} added to ${canvas.scene.name}.`);
  return token;
}
