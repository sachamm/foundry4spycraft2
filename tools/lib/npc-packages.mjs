/** Compile optional packages through the same feat, loadout and XP validators as fixed templates. */
import { npcPackageBands } from "../../module/rules/npc-packages.mjs";
import { buildNpcTemplates } from "./npc-templates.mjs";

export function buildNpcPackages(definitions, templates, packs, options) {
  const roles = {};
  for (const row of definitions.roles) {
    const template = templates.templates.find(t => t.id === row.templateId);
    if (!template || roles[row.templateId]) throw new Error(`Unknown or duplicate package role: ${row.templateId}`);
    const fixed = packs["core-npcs"].docs.find(a => a.flags.spycraft2.npcTemplate === row.templateId);
    const ids = new Set();
    const packages = row.packages.map(p => {
      if (!p.id || p.id === "fixed" || ids.has(p.id)) throw new Error(`${template.name}: duplicate package ID.`);
      ids.add(p.id);
      const variant = { ...template, feats: p.feats ?? template.feats, loadout: p.loadout ?? template.loadout };
      const doc = buildNpcTemplates({ ...templates, templates: [variant] }, packs, options).docs[0];
      return {
        id: p.id,
        label: p.label,
        minTL: p.minTL,
        maxTL: p.maxTL,
        profile: doc.system.npcProfile,
        items: doc.embedded.items
      };
    });
    roles[row.templateId] = {
      name: template.name,
      packages: [
        { id: "fixed", label: "Fixed loadout", profile: fixed.system.npcProfile, items: fixed.embedded.items },
        ...packages
      ]
    };
  }
  if (Object.keys(roles).length !== templates.templates.length) throw new Error("Every core template needs packages.");
  for (const role of Object.values(roles)) npcPackageBands(role);
  const featCatalog = packs.feats.docs.map(feat => {
    const { description: _description, ...system } = feat.system;
    return {
      name: feat.name,
      system,
      flags: { spycraft2: { ruleName: feat.flags?.spycraft2?.ruleName ?? feat.name } }
    };
  });
  return { version: 1, roles, featCatalog };
}
