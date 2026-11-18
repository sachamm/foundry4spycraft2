const SYSTEM = "spycraft2";
const SETTING = "actorFolderSetup";
const FOLDERS = ["Masterminds", "Henchmen", "Minions", "Sample Level-1 Agents"];

export function registerActorFolderSetup() {
  game.settings.register(SYSTEM, SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
}

/** Create the default Actor folders once, resuming safely after interrupted setup. */
export async function setupActorFolders() {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (game.settings.get(SYSTEM, SETTING)) return;
  try {
    for (const [index, name] of FOLDERS.entries()) {
      const existing = game.folders.find(folder => folder.type === "Actor" && !folder.folder && folder.name === name);
      const sort = (index + 1) * 100000;
      if (existing) {
        if (existing.sort !== sort) await existing.update({ sort });
      } else {
        await globalThis.Folder.create({ name, type: "Actor", folder: null, sort, sorting: "a" });
      }
    }
    await game.settings.set(SYSTEM, SETTING, true);
  } catch (error) {
    console.error("Spycraft 2.0 | Actor folder setup failed; retrying on the next GM launch", error);
  }
}
