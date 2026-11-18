/** Optional authored packages. Threat Level suggests a package; it never applies one. */
import { computeNpcProfile, NPC_CATEGORIES } from "./npcs.mjs";
import { validateNpcFeats } from "./npc-feats.mjs";

const clone = value => structuredClone(value);
const esc = value =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const fail = message => {
  throw new Error(message);
};
export function npcPackageBands(role, overrides = null) {
  const rows = role.packages
    .filter(p => p.id !== "fixed")
    .map(p => ({
      id: p.id,
      label: p.label,
      minTL: Number(overrides?.[p.id]?.minTL ?? p.minTL),
      maxTL: Number(overrides?.[p.id]?.maxTL ?? p.maxTL)
    }));
  for (const row of rows) {
    if (
      !Number.isInteger(row.minTL) ||
      !Number.isInteger(row.maxTL) ||
      row.minTL < 1 ||
      row.maxTL > 20 ||
      row.minTL > row.maxTL
    )
      fail("Package bands must contain whole Threat Levels from 1 to 20.");
  }
  const sorted = [...rows].sort((a, b) => a.minTL - b.minTL);
  if (
    sorted[0]?.minTL !== 1 ||
    sorted.at(-1)?.maxTL !== 20 ||
    sorted.some((r, i) => i && r.minTL !== sorted[i - 1].maxTL + 1)
  )
    fail("Package bands must cover Threat Levels 1–20 without gaps or overlaps.");
  return rows;
}
export function recommendedNpcPackage(role, threatLevel, overrides) {
  return npcPackageBands(role, overrides).find(p => threatLevel >= p.minTL && threatLevel <= p.maxTL)?.id ?? "fixed";
}
const featLabel = selection => selection.name + (selection.choice ? ` (${selection.choice})` : "");
const featSelection = item => ({
  name: item.flags?.spycraft2?.ruleName ?? item.name,
  choice: item.system.choice ?? ""
});
function subtract(values, remove, label) {
  const result = clone(values);
  for (const value of remove) {
    const index = result.findIndex(entry => JSON.stringify(entry) === JSON.stringify(value));
    if (index < 0)
      fail(`The current ${label} no longer matches the last package. Restore its allowance or use a fresh template.`);
    result.splice(index, 1);
  }
  return result;
}

/** Prepare the entire resulting inventory and profile before a single actor update. */
export function planNpcPackage(snapshot, data, packageId, { threatLevel = snapshot.system.threatLevel } = {}) {
  const roleId = snapshot.flags?.spycraft2?.npcTemplate,
    role = data.roles[roleId];
  if (!role) fail("This actor is not one of the core NPC templates.");
  if (snapshot.type !== "npc" || snapshot.system.npcType !== "standard" || !snapshot.system.npcProfile?.enabled)
    fail("Packages require a standard NPC using graded creation.");
  const previous = role.packages.find(p => p.id === (snapshot.flags.spycraft2.npcPackage?.id ?? "fixed"));
  const next = role.packages.find(p => p.id === packageId);
  if (!previous || !next) fail("Unknown NPC package.");
  const profile = clone(snapshot.system.npcProfile);
  const oldFeats = previous.profile.qualities.filter(q => q.id === "feat");
  const remaining = [...profile.qualities];
  for (const old of oldFeats) {
    const index = remaining.findIndex(q => q.id === "feat" && q.units === 1 && q.details === old.details);
    if (index < 0)
      fail("The current feat purchases no longer match the last package. Restore them or use a fresh template.");
    remaining.splice(index, 1);
  }
  profile.qualities = [...remaining, ...clone(next.profile.qualities.filter(q => q.id === "feat"))];
  for (const category of NPC_CATEGORIES)
    profile.equipment[category] = [
      ...subtract(profile.equipment[category], previous.profile.equipment[category], `${category} picks`),
      ...next.profile.equipment[category]
    ];
  profile.extraAmmoPairs = profile.extraAmmoPairs - previous.profile.extraAmmoPairs + next.profile.extraAmmoPairs;
  if (profile.extraAmmoPairs < 0) fail("The ammunition allowance no longer matches the last package.");
  const knownIds = new Set(role.packages.flatMap(p => p.items.map(i => i._id)));
  const replaced = snapshot.items.filter(i => i.flags?.spycraft2?.npcPackageManaged === roleId || knownIds.has(i._id));
  const retained = snapshot.items.filter(i => !replaced.includes(i));
  const items = [...clone(retained), ...clone(next.items)];
  if (new Set(items.map(i => i._id)).size !== items.length) fail("An item ID conflicts with this package.");
  const purchases = validateNpcFeats(items.filter(i => i.type === "feat").map(featSelection), data.featCatalog, {
    qualities: profile.qualities
  });
  if (!purchases.ok) fail(purchases.errors.join(" "));
  const pricedFeats = profile.qualities.filter(q => q.id === "feat");
  if (
    pricedFeats.some(q => q.units !== 1) ||
    JSON.stringify(pricedFeats.map(q => q.details).sort()) !==
      JSON.stringify(purchases.selections.map(featLabel).sort())
  )
    fail("Every inventory feat must have one matching Feat quality purchase.");
  for (const category of NPC_CATEGORIES) {
    const used = items
      .filter(
        i =>
          ({ weapon: "weapons", armor: "gear", gear: "gear", vehicle: "vehicles" })[i.type] === category &&
          i.system.caliber > 0
      )
      .map(i => i.system.caliber);
    subtract(profile.equipment[category], used, `${category} inventory allowance`);
  }
  const before = computeNpcProfile(snapshot.system.npcProfile, "standard", threatLevel, snapshot.system.abilities);
  const after = computeNpcProfile(profile, "standard", threatLevel, snapshot.system.abilities);
  if (!before.complete || !after.complete) fail([...before.warnings, ...after.warnings].join(" "));
  let biography = snapshot.system.biography ?? "";
  const equipmentSection = `<h3>Included equipment</h3><p>Current package: ${esc(next.label)}. Inventory entries show ammunition quantities and equipment details.</p><ul>${items
    .filter(i => i.type !== "feat")
    .map(i => `<li>${esc(i.name)}</li>`)
    .join(
      ""
    )}</ul><h3>Feats</h3><ul>${purchases.selections.map(f => `<li>${esc(featLabel(f))}</li>`).join("")}</ul><p>Feat purchases add ${purchases.xp} XP. ${profile.group && profile.equipment.vehicles.length ? "The group shares its vehicle picks." : ""}</p>`;
  biography = biography.replace(/<h3>Included equipment<\/h3>[\s\S]*?(?=<h3>Personal effects<\/h3>)/, equipmentSection);
  return {
    roleId,
    packageId,
    label: next.label,
    profile,
    items,
    before,
    after,
    biography,
    replaced,
    retained,
    added: next.items,
    receipt: { id: next.id, label: next.label, threatLevel: after.effectiveLevel }
  };
}

export function npcPackageStamp(snapshot, threatLevel) {
  return JSON.stringify({
    system: snapshot.system,
    items: snapshot.items,
    effects: snapshot.effects,
    flags: snapshot.flags,
    threatLevel
  });
}
