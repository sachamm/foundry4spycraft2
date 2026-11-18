/** Assemble original campaign templates from the same graded profiles the NPC sheet edits. */
import { computeNpcProfile, defaultNpcProfile, NPC_CATEGORIES } from "../../module/rules/npcs.mjs";

const esc = text =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function buildNpcTemplates(data, packs, { id, stats, skillKeys }) {
  const packName = "core-npcs";
  const categories = [...new Set(data.templates.map(template => template.category))];
  const folders = categories.map((name, index) => ({
    _id: id(packName, "folder", name),
    name,
    type: "Actor",
    folder: null,
    sorting: "a",
    sort: (index + 1) * 100000,
    color: null,
    flags: {},
    _stats: stats
  }));
  const ids = new Set();
  const docs = data.templates.map((template, index) => {
    if (!template.id || ids.has(template.id)) throw new Error(`Duplicate or missing NPC template id: ${template.id}`);
    ids.add(template.id);
    for (const skill of template.skills)
      if (!skillKeys.has(skill.key)) throw new Error(`${template.name}: unknown skill ${skill.key}`);
    const abilities = Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: template.abilities[key] ?? 10 }])
    );
    const profile = {
      ...defaultNpcProfile(),
      enabled: true,
      tier: data.defaultTier,
      group: template.group,
      grades: structuredClone(template.grades),
      skills: structuredClone(template.skills),
      qualities: structuredClone(template.qualities),
      equipment: Object.fromEntries(NPC_CATEGORIES.map(category => [category, []]))
    };
    let weaponIndex = 0;
    const items = template.loadout.map((entry, itemIndex) => {
      const source = packs[entry.pack]?.docs.find(item => item.name === entry.name);
      if (!source) throw new Error(`${template.name}: missing loadout item ${entry.pack}/${entry.name}`);
      if (!NPC_CATEGORIES.includes(entry.category)) throw new Error(`${template.name}: invalid loadout category`);
      const caliber = source.system.caliber;
      if (!Number.isInteger(caliber) || caliber < 1 || caliber > 5)
        throw new Error(`${template.name}: ${entry.name} has no ordinary NPC Caliber`);
      profile.equipment[entry.category].push(caliber);
      const item = structuredClone(source);
      item._id = id(packName, template.id, entry.pack, source._id, String(itemIndex));
      item.folder = null;
      item.sort = (itemIndex + 1) * 100000;
      item.system.carried = true;
      item.system.reserve = false;
      item.system.equipped = item.type === "armor" || (item.type === "weapon" && weaponIndex++ === 0);
      item.flags = {
        ...item.flags,
        core: { ...item.flags?.core, sourceId: `Compendium.spycraft2.${entry.pack}.Item.${source._id}` }
      };
      return item;
    });
    const result = computeNpcProfile(profile, "standard", data.defaultThreatLevel, abilities);
    if (!result.complete) throw new Error(`${template.name}: ${result.warnings.join("; ")}`);
    const actorId = id(packName, "npc", template.id);
    const biography = [
      `<p>${esc(template.description)}</p>`,
      `<h3>At the table</h3><p>${esc(template.behavior)}</p>`,
      `<h3>Campaign choices</h3><p>${esc(template.customization)}</p>`,
      `<p>Import a copy, give it a campaign identity and adjust its graded profile. It follows the active mission's Threat Level; without an active mission it uses its own Threat Level.</p>`,
      `<h3>Included equipment</h3><ul>${items.map(item => `<li>${esc(item.name)}</li>`).join("")}</ul>`,
      ...(template.group && profile.equipment.vehicles.length
        ? ["<p>The vehicle pick serves the whole group. Assign one vehicle when placing multiple copies.</p>"]
        : []),
      "<p>Weapon ammunition allowances come from the NPC profile. Assign ammunition documents when using tracked ammunition. Unlisted everyday possessions are for the GC to choose.</p>"
    ].join("");
    return {
      _id: actorId,
      name: template.name,
      type: "npc",
      img: "icons/svg/mystery-man.svg",
      system: {
        npcType: "standard",
        threatLevel: data.defaultThreatLevel,
        followMission: true,
        abilities,
        vitality: { value: 0, max: 0 },
        wounds: { value: 0, max: 0 },
        npcProfile: profile,
        biography
      },
      prototypeToken: {
        name: template.name,
        actorLink: false,
        disposition: 0,
        texture: { src: "icons/svg/mystery-man.svg" }
      },
      items: items.map(item => item._id),
      effects: [],
      folder: folders.find(folder => folder.name === template.category)._id,
      sort: (index + 1) * 100000,
      ownership: { default: 0 },
      flags: { spycraft2: { npcTemplate: template.id, npcTemplateCategory: template.category } },
      _stats: stats,
      embedded: { items }
    };
  });
  return { label: data.label, type: "Actor", collection: "actors", folders, docs };
}
