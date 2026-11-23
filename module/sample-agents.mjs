import { isLeadGM } from "./writers.mjs";
import { SAMPLE_COMPANIONS } from "./data/sample-agent-companions.mjs";
import { loc } from "./i18n.mjs";
const SYSTEM = "spycraft2";
const pending = new Map();

/** An ordinary compendium import creates the included companion once, linked to that world copy. */
export async function ensureSampleCompanions(owner) {
  if (!isLeadGM() || owner.pack || owner.type !== "agent" || !owner.getFlag(SYSTEM, "sampleAgent")) return;
  if (pending.has(owner.uuid)) return pending.get(owner.uuid);
  const work = importCompanions(owner);
  pending.set(owner.uuid, work);
  try {
    return await work;
  } finally {
    pending.delete(owner.uuid);
  }
}
async function importCompanions(owner) {
  try {
    const key = owner.getFlag(SYSTEM, "sampleAgent");
    const templates = SAMPLE_COMPANIONS.filter(doc => doc.flags.spycraft2.sampleOwner === key);
    const previous = owner.getFlag(SYSTEM, "sampleCompanionImports");
    const receipt = previous?.ownerUuid === owner.uuid ? structuredClone(previous) : { ownerUuid: owner.uuid, ids: {} };
    let created = 0;
    for (const template of templates) {
      const feat = template.system.companionOf.feat;
      if (!owner.system.activeFeatNames?.includes(feat)) continue;
      const companionKey = template.flags.spycraft2.sampleCompanion;
      if (receipt.ids[companionKey]) continue;
      let companion = game.actors.find(
        actor =>
          actor.system?.companionOf?.ownerUuid === owner.uuid &&
          actor.getFlag(SYSTEM, "sampleCompanion") === companionKey
      );
      if (!companion) {
        const data = structuredClone(template);
        delete data._id;
        data.folder = owner.folder?.id ?? null;
        data.ownership = { ...owner.ownership };
        data.system.companionOf.ownerUuid = owner.uuid;
        companion = await globalThis.Actor.create(data);
        created++;
      }
      receipt.ids[companionKey] = companion.id;
      await owner.setFlag(SYSTEM, "sampleCompanionImports", receipt);
    }
    return { created };
  } catch (error) {
    console.error("Spycraft 2.0 | Sample companion import failed", error);
    ui.notifications.warn(
      loc`The sample companion could not finish importing. It will retry the next time the GC opens the world.`
    );
    return { error };
  }
}
export function installSampleAgentHooks() {
  Hooks.on("createActor", owner => ensureSampleCompanions(owner));
  Hooks.once("ready", async () => {
    if (!isLeadGM()) return;
    for (const actor of game.actors) await ensureSampleCompanions(actor);
  });
}
