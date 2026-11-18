/** NPC loadouts use equipment picks, Common Items and included ammunition as distinct allowances. */
import { iconPath } from "./compendium-icons.mjs";
import {
  ammunitionConfiguration,
  ammunitionProfile,
  ammunitionStockpilePlan,
  compatibleAmmunition
} from "../../module/rules/ammunition.mjs";
import { NPC_RULES, NPC_CATEGORIES } from "../../module/rules/npcs.mjs";

const esc = value =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function buildNpcLoadout(
  template,
  packs,
  { id, stats, commonCatalog = [], ammoCatalog = [], iconData = null, type = "standard" }
) {
  const packName = "core-npcs",
    items = [],
    equipment = Object.fromEntries(NPC_CATEGORIES.map(category => [category, []]));
  const stockpiles = [],
    baseAmmo = NPC_RULES.equipment.ammo[type];
  let weaponIndex = 0,
    extraStockpiles = 0;
  for (const [index, entry] of template.loadout.entries()) {
    const source = packs[entry.pack]?.docs.find(item => item.name === entry.name);
    if (!source) throw new Error(`${template.name}: missing loadout item ${entry.pack}/${entry.name}`);
    const allowed = { weapons: ["weapon"], gear: ["gear", "armor"], vehicles: ["vehicle"] }[entry.category];
    if (!allowed?.includes(source.type) || source.system.ammunitionOnly)
      throw new Error(`${template.name}: ${entry.name} is not a ${entry.category} pick.`);
    const caliber = source.system.caliber;
    if (!Number.isInteger(caliber) || caliber < 1 || caliber > 5)
      throw new Error(`${template.name}: ${entry.name} has no ordinary NPC Caliber`);
    equipment[entry.category].push(caliber);
    const item = structuredClone(source);
    item._id = id(packName, template.id, entry.pack, source._id, String(index));
    item.folder = null;
    item.sort = (index + 1) * 100000;
    Object.assign(item.system, {
      carried: true,
      reserve: false,
      equipped: item.type === "armor" || (item.type === "weapon" && weaponIndex++ === 0)
    });
    item.flags = {
      ...item.flags,
      core: { ...item.flags?.core, sourceId: `Compendium.spycraft2.${entry.pack}.Item.${source._id}` },
      spycraft2: { ...item.flags?.spycraft2, npcEquipment: { kind: "pick", category: entry.category, caliber } }
    };
    items.push(item);
    if (!ammunitionProfile(item.system)) {
      if (entry.ammunition)
        throw new Error(`${template.name}: ${entry.name} does not use a supported ammunition family.`);
      continue;
    }
    const spec = entry.ammunition;
    if (!spec) throw new Error(`${template.name}: choose ammunition for ${entry.name}.`);
    if (spec.code) item.system.ammoCodeChoice = spec.code;
    const config = ammunitionConfiguration(item.system);
    if (config.needsReview || config.requiresChoice || !config.selected)
      throw new Error(`${template.name}: choose a valid supplied ammunition code for ${entry.name}.`);
    item.system.ammoCodeChoice = config.selectedCode;
    const ammo = compatibleAmmunition(item.system, ammoCatalog).find(ammo => ammo.id === spec.id);
    if (!ammo?.firstStockpile)
      throw new Error(`${template.name}: ${entry.name} needs an ordinary included-stockpile ammunition choice.`);
    const count = spec.stockpiles ?? baseAmmo;
    if (!Number.isSafeInteger(count) || count < baseAmmo)
      throw new Error(`${template.name}: ${entry.name} needs at least ${baseAmmo} stockpile(s).`);
    extraStockpiles += count - baseAmmo;
    const plan = ammunitionStockpilePlan(item.system, ammoCatalog, {
      ammunitionId: ammo.id,
      stockpiles: 1,
      initial: true
    });
    const ammoId = id(packName, template.id, "ammunition", item._id, ammo.id);
    item.flags.spycraft2.npcStockpileId = ammoId;
    stockpiles.push({
      _id: ammoId,
      name: `${ammo.name} ammunition — ${item.name}`,
      type: "gear",
      img: iconData ? iconPath(iconData, iconData.npcAmmunition) : "icons/svg/item-bag.svg",
      folder: null,
      system: {
        description: `<p>${esc(item.name)}: ${esc(ammo.name)}, ${esc(plan.code)}. Each stockpile contains ${plan.shotsPerStockpile} shots. The listed quantity counts stockpiles, not individual shots.</p><p>${baseAmmo} stockpile(s) come with this NPC weapon. Additional stockpiles use the NPC ammunition allowance. Record expenditure through the existing inventory and ammunition workflows.</p>`,
        source: `Spycraft 2.0 p.445; Table 4.62 p.${ammo.sourcePage}`,
        quantity: count,
        weight: plan.totalWeight,
        caliber: 0,
        gearCategory: "W",
        pick: "",
        common: false,
        carried: true,
        equipped: false,
        reserve: false
      },
      flags: {
        spycraft2: {
          npcEquipment: {
            kind: "ammunition",
            weaponId: item._id,
            ammunitionId: ammo.id,
            code: plan.code,
            includedStockpiles: baseAmmo,
            shotsPerStockpile: plan.shotsPerStockpile
          }
        }
      },
      effects: [],
      ownership: { default: 0 },
      _stats: stats
    });
  }
  if (extraStockpiles % 2)
    throw new Error(`${template.name}: additional ammunition must be bought in pairs of stockpiles.`);
  const seen = new Set();
  const commonItems = (template.commonItems ?? []).map(key => {
    const entry = commonCatalog.find(item => item.id === key);
    if (!entry || seen.has(key)) throw new Error(`${template.name}: missing or duplicate Common Item ${key}.`);
    seen.add(key);
    return {
      _id: id(packName, template.id, "common", key),
      name: entry.name,
      type: "gear",
      img: iconData ? iconPath(iconData, iconData.npcCommonItems[key]) : "icons/svg/item-bag.svg",
      folder: null,
      system: {
        description: `<p>${esc(entry.description)}</p><p>Common Item selected for this NPC. The GC adjudicates its use; this inventory entry supplies no automatic bonus. Assign its weight if tracking carried load.</p>`,
        source: "Common Item — GC loadout; Spycraft 2.0 pp.212–213",
        quantity: 1,
        caliber: 0,
        common: true,
        carried: true,
        equipped: false,
        reserve: false,
        pick: ""
      },
      flags: { spycraft2: { npcEquipment: { kind: "common", commonItemId: key, weightNeedsReview: true } } },
      effects: [],
      ownership: { default: 0 },
      _stats: stats
    };
  });
  items.push(...stockpiles, ...commonItems);
  for (const [index, item] of items.entries()) item.sort = (index + 1) * 100000;
  return { items, equipment, extraAmmoPairs: extraStockpiles / 2 };
}
