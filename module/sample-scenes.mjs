import { loc } from "./i18n.mjs";
const SYSTEM = "spycraft2";
const SETTING = "sampleSceneSetup";
const PACK = "spycraft2.sample-scenes";

export function registerSampleSceneSetup() {
  game.settings.register(SYSTEM, SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

/** Seed empty worlds once. Persist intent before creating anything so interrupted imports can resume. */
export async function setupSampleScenes() {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
  let state = game.settings.get(SYSTEM, SETTING);
  if (state.status === "done") return;
  try {
    if (state.status !== "pending") {
      if (game.scenes.size) {
        await game.settings.set(SYSTEM, SETTING, { status: "done" });
        return;
      }
      state = { status: "pending" };
      await game.settings.set(SYSTEM, SETTING, state);
    }
    const pack = game.packs.get(PACK);
    if (!pack) throw new Error(loc`Sample Scenes compendium is unavailable.`);
    const documents = await pack.getDocuments();
    if (documents.length !== 3) throw new Error(loc`Sample Scenes compendium is incomplete.`);
    for (const document of documents) {
      const slug = document.getFlag(SYSTEM, "sampleScene");
      if (!slug) throw new Error(loc`Sample scene identifier is missing.`);
      if (game.scenes.some(scene => scene.getFlag(SYSTEM, "sampleScene") === slug)) continue;
      const data = document.toObject();
      delete data._id;
      data.folder = null;
      data.active = false;
      data.navigation = true;
      await globalThis.Scene.create(data);
    }
    await game.settings.set(SYSTEM, SETTING, { status: "done" });
    ui.notifications.info(loc`Three sample scenes are ready in the Scenes tab.`);
  } catch (error) {
    console.error(loc`Spycraft 2.0 | Sample scene setup failed`, error);
    ui.notifications.warn(
      loc`Sample scene setup could not finish. It will retry on the next GM launch; you can also import scenes from the Sample Scenes compendium.`
    );
  }
}
