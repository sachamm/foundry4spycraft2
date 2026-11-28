/**
 * NPCs imported from the system's compendiums (B-064). Foundry's Import puts the copy at the root of the Actors
 * directory, closes the compendium sheet and says nothing, so the GC is left with two actors of the same name and no
 * idea which is new. The copy is filed in an "Imported NPCs" folder instead, and an import the GC made by hand opens
 * the new actor's sheet with a note saying where it went. Add NPC to scene imports for itself and only files the copy.
 */
import { loc } from "../i18n.mjs";

export const IMPORT_FOLDER = () => loc`Imported NPCs`;

/** Whether a new actor is an NPC copied from one of this system's compendiums and not yet in a folder. */
export function isImportedNpc(data) {
  const source = data?._stats?.compendiumSource ?? data?.flags?.core?.sourceId ?? "";
  return data?.type === "npc" && !data.folder && String(source).startsWith("Compendium.spycraft2.");
}

async function importFolder() {
  const name = IMPORT_FOLDER();
  const found = [...(game.folders ?? [])].find(
    folder => folder.type === "Actor" && !folder.folder && folder.name === name
  );
  return found ?? (await CONFIG.Folder.documentClass.create({ name, type: "Actor", folder: null, sorting: "a" }));
}

export function installNpcImport() {
  Hooks.on("createActor", async (actor, options, userId) => {
    if (userId !== game.user?.id || !isImportedNpc(actor)) return;
    try {
      const folder = await importFolder();
      if (folder) await actor.update({ folder: folder.id });
    } catch (error) {
      console.warn("Field Agent's Handbook | The imported NPC could not be filed.", error);
    }
    if (options?.spycraft2Placing) return;
    ui.notifications.info(loc`${actor.name} was imported into the ${IMPORT_FOLDER()} folder.`);
    actor.sheet?.render(true);
  });
}
