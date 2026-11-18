import { NPC_RULES } from "../../module/rules/npcs.mjs";
import { buildNpcTemplates } from "./npc-templates.mjs";

/** Named villains and reusable minions retain the core library's priced gear and feats. */
export function buildSampleNpcs(data, library, packs, options) {
  const templates = data.cast.map(entry => {
    const base = library.templates.find(template => template.id === entry.base);
    if (!base) throw new Error(`Unknown sample NPC base: ${entry.base}`);
    const { role, ...overrides } = entry;
    delete overrides.base;
    const template = { ...structuredClone(base), ...structuredClone(overrides) };
    template.npcType = role === "minion" ? "standard" : "special";
    for (const pick of template.loadout) {
      if (pick.ammunition)
        pick.ammunition.stockpiles = Math.max(
          pick.ammunition.stockpiles ?? 0,
          NPC_RULES.equipment.ammo[template.npcType]
        );
    }
    template.group = role === "minion";
    template.qualities = [
      ...template.qualities.filter(quality =>
        NPC_RULES.qualities.find(rule => rule.id === quality.id)?.types.includes(template.npcType)
      ),
      { id: role, units: 1, details: "" }
    ];
    return template;
  });
  const pack = buildNpcTemplates({ ...data, templates }, packs, { ...options, packName: "sample-npcs" });
  for (const doc of pack.docs) {
    doc.flags.spycraft2.sampleNpc = doc.flags.spycraft2.npcTemplate;
  }
  return pack;
}
