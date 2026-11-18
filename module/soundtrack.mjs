import { loc } from "./i18n.mjs";
const SYSTEM = "spycraft2";
const SETTING = "soundtrackSetup";
const ALBUM = "where-the-trains-run-under";

export function registerSoundtrackSetup() {
  game.settings.register(SYSTEM, SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
}

/** Import once per world; a deleted album stays deleted after setup finishes. */
export async function setupSoundtrack() {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
  try {
    // Update previously imported WAV editions without changing track settings or order.
    for (const playlist of game.playlists) {
      if (playlist.getFlag(SYSTEM, "soundtrack") !== ALBUM) continue;
      const updates = (playlist.sounds?.contents ?? [])
        .filter(
          sound => sound.path?.startsWith(`systems/spycraft2/assets/audio/${ALBUM}/`) && sound.path.endsWith(".wav")
        )
        .map(sound => ({ _id: sound.id, path: sound.path.replace(/\.wav$/, ".ogg") }));
      if (updates.length) await playlist.updateEmbeddedDocuments("PlaylistSound", updates);
    }
    if (game.settings.get(SYSTEM, SETTING)) return;
    if (!game.playlists.some(playlist => playlist.getFlag(SYSTEM, "soundtrack") === ALBUM)) {
      const pack = game.packs.get("spycraft2.soundtrack");
      if (!pack) throw new Error("Soundtrack compendium is unavailable.");
      const documents = await pack.getDocuments();
      const album = documents.find(document => document.getFlag(SYSTEM, "soundtrack") === ALBUM);
      if (!album || album.sounds.size !== 11) throw new Error("Soundtrack compendium is incomplete.");
      const data = album.toObject();
      delete data._id;
      data.folder = null;
      data.playing = false;
      await globalThis.Playlist.create(data);
    }
    await game.settings.set(SYSTEM, SETTING, true);
  } catch (error) {
    console.error("Spycraft 2.0 | Soundtrack setup failed", error);
    ui.notifications.warn(
      loc`Soundtrack setup could not finish. It will retry on the next GM launch; you can also import the album from the Soundtrack compendium.`
    );
  }
}
