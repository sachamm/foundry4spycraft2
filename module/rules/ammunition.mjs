/** Ammunition codes and supplied stockpiles, pp.258,265,319–320. This configures a code; it does not grant or spend ammunition. */
const CONTAINERS = {
  M: ["magazine", "magazines"],
  S: ["internal supply", "internal supplies"],
  B: ["belt", "belts"],
  D: ["drum", "drums"]
};
export function parseAmmunitionCode(value) {
  if (typeof value !== "string") return null;
  const code = value
      .trim()
      .replace(/[\s*†∆Ω]+$/g, "")
      .toUpperCase(),
    match = code.match(/^(\d+(?:\+\d+)*)([MSBD])(\d+)$/);
  if (!match) return null;
  const capacities = match[1].split("+").map(Number),
    loads = Number(match[3]),
    capacity = capacities.reduce((a, b) => a + b, 0),
    shots = capacity * loads;
  if (
    capacities.some(n => !Number.isSafeInteger(n) || n < 1) ||
    !Number.isSafeInteger(capacity) ||
    !Number.isSafeInteger(loads) ||
    loads < 0 ||
    !Number.isSafeInteger(shots)
  )
    return null;
  const canonical = capacities.join("+") + match[2] + loads,
    container = CONTAINERS[match[2]][loads === 1 ? 0 : 1];
  return {
    code: canonical,
    capacities,
    capacity,
    loads,
    shots,
    containerType: match[2],
    container,
    label: `${canonical} — ${shots} shots (${loads} × ${capacities.join("+")}-round ${container})`
  };
}
export function ammunitionConfiguration(weapon) {
  const empty = {
    applicable: false,
    options: [],
    selected: null,
    selectedCode: "",
    requiresChoice: false,
    needsReview: false,
    reason: ""
  };
  if (weapon.ammunitionOnly) return empty;
  const raw = String(weapon.ammo ?? "").trim(),
    explicit = weapon.ammoCodeOptions;
  const invalidExplicit =
    explicit !== undefined && (!Array.isArray(explicit) || explicit.some(v => typeof v !== "string"));
  if (invalidExplicit)
    return {
      ...empty,
      applicable: true,
      needsReview: true,
      reason: "Review the source’s special or malformed ammunition-stockpile rule before choosing a supplied code."
    };
  if ((!raw || /^[—–-]+$/.test(raw) || /^\d+$/.test(raw)) && !explicit?.length) return empty;
  const values = Array.isArray(explicit) && explicit.length ? explicit : raw.split(/\s+or\s+/i),
    parsed = values.map(parseAmmunitionCode);
  if (invalidExplicit || parsed.some(v => !v) || new Set(parsed.map(v => v?.code)).size !== parsed.length)
    return {
      ...empty,
      applicable: true,
      needsReview: true,
      reason: "Review the source’s special or malformed ammunition-stockpile rule before choosing a supplied code."
    };
  const choice = weapon.ammoCodeChoice ?? "";
  if (typeof choice !== "string")
    return {
      ...empty,
      applicable: true,
      options: parsed,
      requiresChoice: true,
      needsReview: true,
      reason: "Review the saved ammunition-code choice."
    };
  const normalized = choice ? parseAmmunitionCode(choice)?.code : "",
    selected = choice ? parsed.find(v => v.code === normalized) : parsed.length === 1 ? parsed[0] : null;
  if (choice && !selected)
    return {
      ...empty,
      applicable: true,
      options: parsed,
      requiresChoice: true,
      needsReview: true,
      reason:
        "The saved ammunition code no longer matches this weapon’s supplied configurations. Choose a current source option."
    };
  return {
    ...empty,
    applicable: true,
    options: parsed,
    selected: selected ?? null,
    selectedCode: selected?.code ?? "",
    requiresChoice: !selected,
    reason: selected ? "" : "Choose one supplied ammunition configuration."
  };
}

const BULLET_CATEGORIES = [
  "backupPistol",
  "holdoutPistol",
  "servicePistol",
  "backupRevolver",
  "huntingRevolver",
  "serviceRevolver",
  "assaultRifle",
  "boltActionRifle",
  "semiAutomaticRifle",
  "lightSMG",
  "heavySMG",
  "saw",
  "gpmg",
  "hmg"
];
const RIFLE_MACHINE_CATEGORIES = ["assaultRifle", "boltActionRifle", "semiAutomaticRifle", "saw", "gpmg", "hmg"];
const chamberKey = value =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function ammunitionProfile(weapon) {
  if (weapon.ammunitionOnly) return null;
  const arrow = String(weapon.damage ?? "").match(/as (arrow|bolt)/i);
  if (arrow) return { family: "arrowBolt", projectileKind: arrow[1].toLowerCase(), chamber: "" };
  const category = weapon.weaponCategory;
  if (BULLET_CATEGORIES.includes(category)) return { family: "bullet", chamber: "", category };
  if (["breakActionShotgun", "pumpActionShotgun", "semiAutomaticShotgun"].includes(category))
    return { family: "shell", chamber: "", category };
  const family = { grenadeLauncher: "grenade", mortar: "mortar", rocketLauncher: "rocket" }[category];
  return family ? { family, chamber: chamberKey(weapon.ammoChamber), category } : null;
}
export function compatibleAmmunition(weapon, catalog) {
  const profile = ammunitionProfile(weapon);
  if (!profile) return [];
  return catalog.filter(ammo => {
    if (ammo.family !== profile.family) return false;
    if (profile.family === "bullet") {
      const allowed =
        {
          "any pistol, revolver, rifle, SMG, or machine gun": BULLET_CATEGORIES,
          "any pistol, revolver, rifle, or machine gun": BULLET_CATEGORIES.filter(
            c => !["lightSMG", "heavySMG"].includes(c)
          ),
          "any rifle or machine gun": RIFLE_MACHINE_CATEGORIES
        }[ammo.availableFor] ?? [];
      return allowed.includes(profile.category);
    }
    if (["arrowBolt", "shell"].includes(profile.family)) return true;
    if (profile.chamber === "bs1") return ammo.family === "grenade" && ammo.name === "30mm HEAT";
    return !!profile.chamber && profile.chamber === chamberKey(ammo.chamber);
  });
}
/** Reference calculation for one weapon; entitlement, payment, inventory and effects use separate workflows. */
export function ammunitionStockpilePlan(weapon, catalog, { ammunitionId, stockpiles = 1, initial = false } = {}) {
  if (!Number.isSafeInteger(stockpiles) || stockpiles < 1)
    throw new Error("Choose a positive whole number of stockpiles.");
  const profile = ammunitionProfile(weapon),
    compatible = compatibleAmmunition(weapon, catalog),
    ammo = compatible.find(a => a.id === ammunitionId);
  if (!ammo) throw new Error("Choose ammunition offered for this weapon category and projectile caliber/model.");
  if (
    !Number.isFinite(ammo.unitWeight) ||
    ammo.unitWeight <= 0 ||
    !Number.isSafeInteger(ammo.upgradeCost) ||
    ammo.upgradeCost < 1 ||
    (ammo.commonItemCost !== null && (!Number.isSafeInteger(ammo.commonItemCost) || ammo.commonItemCost < 1)) ||
    typeof ammo.firstStockpile !== "boolean"
  )
    throw new Error("Review the ammunition source’s weight and stockpile costs.");
  if (initial !== true && initial !== false) throw new Error("Choose an explicit included-stockpile calculation.");
  if (initial && (stockpiles !== 1 || !compatible.some(a => a.firstStockpile === true)))
    throw new Error("An included-stockpile calculation requires one supplied first stockpile for this weapon.");
  const configuration = ammunitionConfiguration(weapon),
    shotsPerStockpile = ammo.fixedStockpileSize ?? configuration.selected?.shots;
  if (!Number.isSafeInteger(shotsPerStockpile) || shotsPerStockpile < 1)
    throw new Error(
      configuration.reason || "Choose a supplied ammunition configuration with a positive stockpile size."
    );
  const totalShots = shotsPerStockpile * stockpiles,
    unitUpgradeCost = profile.chamber === "bs1" ? shotsPerStockpile : ammo.upgradeCost;
  const convertedInitial = initial && !ammo.firstStockpile,
    upgradeCost = initial ? (ammo.firstStockpile ? 0 : Math.max(0, unitUpgradeCost - 1)) : unitUpgradeCost * stockpiles;
  const commonItemCost =
    ammo.commonItemCost === null
      ? null
      : initial
        ? ammo.firstStockpile
          ? 0
          : Math.max(0, ammo.commonItemCost - 3)
        : ammo.commonItemCost * stockpiles;
  const totalWeight = totalShots * ammo.unitWeight;
  if (
    !Number.isSafeInteger(totalShots) ||
    !Number.isSafeInteger(upgradeCost) ||
    (commonItemCost !== null && !Number.isSafeInteger(commonItemCost)) ||
    !Number.isFinite(totalWeight)
  )
    throw new Error("The stockpile calculation exceeds safe arithmetic.");
  return {
    ammunitionId: ammo.id,
    ammunitionName: ammo.name,
    family: profile.family,
    chamber: ammo.chamber,
    projectileKind: profile.projectileKind ?? null,
    code: configuration.selectedCode,
    stockpiles,
    shotsPerStockpile,
    totalShots,
    unitWeight: ammo.unitWeight,
    totalWeight,
    initial,
    convertedInitial,
    upgradeCost,
    commonItemCost,
    reviewNotes: [...(ammo.reviewNotes ?? [])],
    sourcePage: ammo.sourcePage
  };
}
