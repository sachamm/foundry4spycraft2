import { isLeadGM } from "./writers.mjs";
import { ensureSampleCompanions } from "./sample-agents.mjs";

const SYSTEM = "spycraft2";
const SETTING = "actorFolderSetup";
const SAMPLES = "sampleActorSetup";
const FOLDERS = ["Masterminds", "Henchmen", "Minions", "Sample PCs"];
let pending;

export function registerActorFolderSetup() {
  game.settings.register(SYSTEM, SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(SYSTEM, SAMPLES, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

/** The leading GM seeds each world once; receipts preserve later edits, moves and deletions. */
export async function setupActorFolders() {
  if (!isLeadGM()) return;
  if (pending) return pending;
  pending = seedActors();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

async function seedActors() {
  let state = game.settings.get(SYSTEM, SAMPLES);
  if (state.status === "done") return;
  try {
    const folders = new Map();
    for (const [index, name] of FOLDERS.entries()) {
      let existing = game.folders.find(folder => folder.type === "Actor" && !folder.folder && folder.name === name);
      if (!existing && name === "Sample PCs") {
        existing = game.folders.find(
          folder => folder.type === "Actor" && !folder.folder && folder.name === "Sample Level-1 Agents"
        );
        if (existing) await existing.update({ name });
      }
      const sort = (index + 1) * 100000;
      if (existing) {
        if (existing.sort !== sort) await existing.update({ sort });
      } else {
        existing = await globalThis.Folder.create({ name, type: "Actor", folder: null, sort, sorting: "a" });
      }
      folders.set(name, existing);
    }
    await game.settings.set(SYSTEM, SETTING, true);
    state = { status: "pending", imported: { ...state.imported } };
    await game.settings.set(SYSTEM, SAMPLES, state);

    // Read both packs before making copies; a missing release asset must remain retryable.
    const batches = [];
    for (const [name, flag, count] of [
      ["sample-npcs", "sampleNpc", 12],
      ["sample-agents", "sampleAgent", 16]
    ]) {
      const pack = game.packs.get(`${SYSTEM}.${name}`);
      if (!pack) throw new Error(`Missing starter Actor compendium: ${name}`);
      const documents = await pack.getDocuments();
      if (documents.length !== count || new Set(documents.map(doc => doc.getFlag(SYSTEM, flag))).size !== count)
        throw new Error(`Incomplete starter Actor compendium: ${name}`);
      for (const document of documents) {
        const slug = document.getFlag(SYSTEM, flag);
        const folder = folders.get(
          name === "sample-agents" ? "Sample PCs" : document.getFlag(SYSTEM, "npcTemplateCategory")
        );
        if (!slug || !folder) throw new Error(`Invalid starter Actor: ${document.name}`);
        batches.push({ document, flag, slug, folder });
      }
    }
    for (const { document, flag, slug, folder } of batches) {
      const key = `${flag}:${slug}`;
      if (state.imported[key]) continue;
      // This also finds a copy committed just before a disconnected settings write.
      let actor = game.actors.find(actor => actor.getFlag(SYSTEM, flag) === slug);
      if (actor) {
        if (actor.folder?.id !== folder.id) await actor.update({ folder: folder.id });
      } else {
        const data = document.toObject();
        delete data._id;
        data.folder = folder.id;
        data.ownership = { default: 0 };
        data.flags ??= {};
        data.flags.core = { ...data.flags.core, sourceId: document.uuid };
        actor = await globalThis.Actor.create(data);
      }
      const companionResult = await ensureSampleCompanions(actor);
      if (companionResult?.error) throw companionResult.error;
      state.imported[key] = actor.id;
      await game.settings.set(SYSTEM, SAMPLES, structuredClone(state));
    }
    await game.settings.set(SYSTEM, SAMPLES, { ...state, status: "done" });
  } catch (error) {
    console.error("Field Agent's Handbook | Starter Actor setup failed; retrying on the next GM launch", error);
  }
}
