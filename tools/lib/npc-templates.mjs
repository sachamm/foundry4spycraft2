/** Assemble original campaign templates from the same graded profiles the NPC sheet edits. */
import { buildNpcLoadout } from "./npc-loadouts.mjs";
import { validateNpcFeats } from "../../module/rules/npc-feats.mjs";
import { computeNpcProfile, defaultNpcProfile, NPC_CATEGORIES } from "../../module/rules/npcs.mjs";

const esc = text =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function buildNpcTemplates(data, packs, { id, stats, skillKeys, commonCatalog = [], ammoCatalog = [] }) {
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
    if (profile.qualities.some(quality => quality.id === "feat"))
      throw new Error(`${template.name}: list feats in the feats field; Feat quality pricing is generated.`);
    const featPurchase = validateNpcFeats(template.feats ?? [], packs.feats.docs, { qualities: profile.qualities });
    if (!featPurchase.ok) throw new Error(`${template.name}: ${featPurchase.errors.join("; ")}`);
    profile.qualities.push(
      ...featPurchase.selections.map(feat => ({
        id: "feat",
        units: 1,
        details: feat.name + (feat.choice ? ` (${feat.choice})` : "")
      }))
    );
    const loadout = buildNpcLoadout(template, packs, { id, stats, commonCatalog, ammoCatalog, type: "standard" });
    const items = loadout.items;
    profile.equipment = loadout.equipment;
    profile.extraAmmoPairs = loadout.extraAmmoPairs;
    const featItems = featPurchase.selections.map((feat, index) => {
      const item = structuredClone(feat.source);
      item._id = id(packName, template.id, "feat", feat.source._id, feat.choice);
      item.folder = null;
      item.sort = (items.length + index + 1) * 100000;
      Object.assign(item.system, { choice: feat.choice, featKind: "permanent", granted: false, acquiredAtLevel: 0 });
      item.flags = {
        ...item.flags,
        core: { ...item.flags?.core, sourceId: `Compendium.spycraft2.feats.Item.${feat.source._id}` }
      };
      return item;
    });
    for (const item of [...items, ...featItems]) {
      item.flags.spycraft2 = { ...item.flags.spycraft2, npcPackageManaged: template.id };
    }
    const result = computeNpcProfile(profile, "standard", data.defaultThreatLevel, abilities);
    if (!result.complete) throw new Error(`${template.name}: ${result.warnings.join("; ")}`);
    const actorId = id(packName, "npc", template.id);
    const biography = [
      `<p>${esc(template.description)}</p>`,
      `<h3>At the table</h3><p>${esc(template.behavior)}</p>`,
      `<h3>Campaign choices</h3><p>${esc(template.customization)}</p>`,
      `<p>Import a copy, give it a campaign identity and adjust its graded profile. It follows the active mission's Threat Level; without an active mission it uses its own Threat Level.</p>`,
      `<h3>Included equipment</h3><ul>${items.map(item => `<li>${esc(item.name)}</li>`).join("")}</ul>`,
      `<h3>Feats</h3><ul>${featPurchase.selections.map(feat => `<li>${esc(feat.name)}${feat.choice ? ` (${esc(feat.choice)})` : ""}</li>`).join("")}</ul>`,
      `<p>Feat purchases add ${featPurchase.xp} XP before any special-NPC multiplier. Required feats are included; numerical requirements are waived under the NPC rules (p.447). Use the attached feat items for their benefits and any GC adjudication.</p>`,
      ...(template.group && profile.equipment.vehicles.length
        ? ["<p>The vehicle pick serves the whole group. Assign one vehicle when placing multiple copies.</p>"]
        : []),
      `<h3>Personal effects</h3><p>${(template.personalEffects ?? []).map(esc).join(", ")}. Clothing and personal accessories are lifestyle details; they do not grant equipment bonuses.</p>`,
      "<p>Common Items are recorded separately from priced gear picks. Their weights need GC review when tracking load. Weapon ammunition has its own stockpile entries; quantity counts stockpiles, with the selected ammunition code shown on each weapon.</p>"
    ].join("");
    return {
      _id: actorId,
      name: template.name,
      type: "npc",
      img: template.portrait ?? "icons/svg/mystery-man.svg",
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
        texture: { src: template.token ?? template.portrait ?? "icons/svg/mystery-man.svg" }
      },
      items: [...items, ...featItems].map(item => item._id),
      effects: [],
      folder: folders.find(folder => folder.name === template.category)._id,
      sort: (index + 1) * 100000,
      ownership: { default: 0 },
      flags: { spycraft2: { npcTemplate: template.id, npcTemplateCategory: template.category } },
      _stats: stats,
      embedded: { items: [...items, ...featItems] }
    };
  });
  return { label: data.label, type: "Actor", collection: "actors", folders, docs };
}
