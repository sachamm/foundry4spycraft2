/** Selective catalog refresh. Build selections and earned actor resources are not catalog fields. */
export const REFRESH_FIELDS = {
  gear: ["kitType", "kitGrade", "kitSize", "kitNonPortable", "caliber", "weight", "source"],
  class: [
    "table",
    "classSkills",
    "bonuses",
    "abilities",
    "choiceLists",
    "choiceSchedule",
    "requirements",
    "featGrants",
    "coreAbility",
    "skillPoints",
    "vitalityDie",
    "proficiencies",
    "source"
  ],
  origin: ["bonuses", "grants", "source", "originType"],
  feat: ["tree", "prerequisites", "prerequisitesNotChecked", "repeatable", "maxSelections", "bonuses", "source"],
  weapon: [
    "bundleSize",
    "maxRangeIncrements",
    "weaponCategory",
    "mountRequirement",
    "assemblyHalfActions",
    "fireModes",
    "explosiveAmmunition",
    "ammunitionOnly",
    "ammunitionKind",
    "stockpileSize",
    "shotWeight",
    "upgradeCost",
    "upgradeAllowance",
    "commonItemCost",
    "noStrengthDamage",
    "caliber",
    "gearCategory",
    "proficiency",
    "damage",
    "errorThreat",
    "error",
    "threat",
    "ammo",
    "ammoChamber",
    "ammoCodeOptions",
    "recoil",
    "range",
    "sizeHands",
    "qualities",
    "weight",
    "untrainedPenalty",
    "attackAbility",
    "source"
  ],
  armor: [
    "gearCategory",
    "damageReduction",
    "damageReductionSubdual",
    "resistances",
    "defensePenalty",
    "armorCheck",
    "speedPenalty",
    "notice",
    "armorType",
    "armorSlot",
    "sealed",
    "visionPenalty",
    "weight",
    "source"
  ]
};
export function equivalent(a, b) {
  const sorted = value =>
    Array.isArray(value)
      ? value.map(sorted)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map(key => [key, sorted(value[key])])
          )
        : value;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}
export function rulesRefreshChanges(item, canonical) {
  if (item.type !== canonical.type) return [];
  const changes = [];
  if (item.name !== canonical.name)
    changes.push({ itemId: item.id, itemName: item.name, path: "name", before: item.name, after: canonical.name });
  for (const field of REFRESH_FIELDS[item.type] ?? []) {
    const before = item.system[field],
      after = canonical.system[field];
    if (after !== undefined && !equivalent(before, after))
      changes.push({
        itemId: item.id,
        itemName: item.name,
        path: `system.${field}`,
        before: structuredClone(before),
        after: structuredClone(after)
      });
  }
  return changes;
}
const assignUpdate = (update, path, value) => {
  if (value === undefined) {
    const at = path.lastIndexOf(".");
    update[`${path.slice(0, at + 1)}-=${path.slice(at + 1)}`] = null;
  } else update[path] = structuredClone(value);
};
const readPath = (item, path) => (path === "name" ? item.name : item.system[path.slice(7)]);
export async function applyRulesRefresh(actor, changes) {
  if (!actor.isOwner) throw new Error("You must own this character to refresh its rules.");
  const updates = new Map();
  for (const change of changes) {
    const item = actor.items.get(change.itemId);
    if (!item || !equivalent(readPath(item, change.path), change.before))
      throw new Error(`${change.itemName}: the document changed after the preview; reopen the review.`);
    const update = updates.get(change.itemId) ?? { _id: change.itemId };
    assignUpdate(update, change.path, change.after);
    updates.set(change.itemId, update);
  }
  if (!updates.size) return [];
  const backup = { date: new Date().toISOString(), changes: structuredClone(changes) };
  await actor.update({ "flags.spycraft2.rulesRefreshBackup": backup });
  try {
    return await actor.updateEmbeddedDocuments("Item", [...updates.values()]);
  } catch (error) {
    const rollback = new Map();
    for (const change of changes) {
      const update = rollback.get(change.itemId) ?? { _id: change.itemId };
      assignUpdate(update, change.path, change.before);
      rollback.set(change.itemId, update);
    }
    try {
      await actor.updateEmbeddedDocuments("Item", [...rollback.values()]);
    } catch {}
    throw error;
  }
}
