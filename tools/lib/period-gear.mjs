/**
 * Era data for the pack build: our dates for undated entries (src/data/gear-years.json) and the house items for
 * period games (src/data/period-gear.json).
 */

const GEAR_LISTS = ["electronics", "gadgets", "resources", "security", "tradecraft"];

/** The year a weapon row's printed table gives, kept in its rules note as "First year: N." */
export function bookWeaponYear(row) {
  return /First year: ([^.]+)\./.exec(row.rulesNote ?? "")?.[1]?.trim() ?? "";
}

/**
 * Append the house items to the loaded data, so the pack build treats them like any other row.
 * @returns {Set<string>} the house items' names
 */
export function addPeriodGear({ equipment, gear, gearSummaries, vehicles, upgrades }, period) {
  const names = new Set();
  const add = (list, rows) => {
    for (const row of rows ?? []) {
      if (!row.basedOn) throw new Error(`period-gear.json: ${row.name} needs basedOn`);
      if (!row.year) throw new Error(`period-gear.json: ${row.name} needs a year`);
      if (names.has(row.name)) throw new Error(`period-gear.json: ${row.name} appears twice`);
      names.add(row.name);
      list.push(row);
    }
  };
  add(equipment.weapons, period.weapons);
  for (const [list, rows] of Object.entries(period.gear ?? {})) {
    if (!GEAR_LISTS.includes(list)) throw new Error(`period-gear.json: unknown gear list ${list}`);
    for (const row of rows) {
      if (!row.summary) throw new Error(`period-gear.json: ${row.name} needs a summary`);
      gearSummaries[row.name] = row.summary;
      // Checks the source entry helps with (GEAR_RULES.skillUses, read by name at play time) carry over.
      if (gear.skillUses?.[row.basedOn] && !gear.skillUses[row.name])
        gear.skillUses[row.name] = structuredClone(gear.skillUses[row.basedOn]);
    }
    add(gear[list], rows);
  }
  add(vehicles.vehicles, period.vehicles);
  add(upgrades.weapons, period.upgrades?.weapons);
  add(upgrades.detonators, period.upgrades?.detonators);
  return names;
}

/**
 * Give every row a `year`: the book's where it prints one, ours otherwise ("" for "always").
 * A row with neither is an error, so new data cannot arrive undated.
 */
export function dateGear({ equipment, gear, vehicles, upgrades, kits, ammunition }, years) {
  const missing = [];
  const date = (group, row, key = row.name) => {
    if (row.year) return;
    const ours = years[group]?.[key];
    if (ours === undefined) missing.push(`${group}: ${key}`);
    else row.year = ours === "always" ? "" : ours;
  };
  for (const row of equipment.weapons) {
    const printed = bookWeaponYear(row);
    if (printed) row.year = printed;
    else date("weapons", row);
  }
  for (const row of equipment.armor) date("armor", row);
  for (const list of GEAR_LISTS) for (const row of gear[list]) date("gear", row);
  for (const row of vehicles.vehicles) date("vehicles", row);
  for (const row of vehicles.upgrades) date("vehicle-upgrades", row);
  for (const row of [...upgrades.weapons, ...upgrades.armor, ...upgrades.detonators]) date("equipment-upgrades", row);
  for (const row of kits) date("kits", row);
  for (const row of ammunition) date("ammunition", row, row.id);
  if (missing.length)
    throw new Error(`No year for ${missing.length} entries (src/data/gear-years.json):\n  ${missing.join("\n  ")}`);
}

/** Mark the house items in the built packs: their source names the book entry they are adapted from. */
export function markHouseItems(packs, names, period) {
  const basedOn = new Map();
  const rows = [
    ...(period.weapons ?? []),
    ...Object.values(period.gear ?? {}).flat(),
    ...(period.vehicles ?? []),
    ...(period.upgrades?.weapons ?? []),
    ...(period.upgrades?.detonators ?? [])
  ];
  for (const row of rows) basedOn.set(row.name, row);
  let marked = 0;
  for (const pack of Object.values(packs))
    for (const doc of pack.docs ?? []) {
      const row = names.has(doc.name) ? basedOn.get(doc.name) : null;
      if (!row) continue;
      doc.system.source = `House item, adapted from ${row.basedOn} (Spycraft 2.0 p.${row.sourcePage})`;
      if (doc.type !== "weapon")
        doc.system.description = `<p>House item for period games, adapted from ${row.basedOn}.</p>${doc.system.description ?? ""}`;
      doc.flags = { ...doc.flags, spycraft2: { ...doc.flags?.spycraft2, periodItem: true } };
      marked += 1;
    }
  if (marked !== names.size) throw new Error(`Marked ${marked} of ${names.size} house items`);
}

const DATED_PACKS = ["weapons", "armor", "gear", "kits", "vehicles", "vehicle-upgrades", "equipment-upgrades"];

/**
 * The generated module the world migration reads: each dated compendium entry's year, by compendium id and by
 * type and name, and the house items a world may need copies of.
 */
export function gearYearIndex(packs) {
  const byId = {},
    byName = {},
    ambiguous = new Set(),
    periodItems = [];
  for (const packId of DATED_PACKS)
    for (const doc of packs[packId]?.docs ?? []) {
      const year = doc.system?.year ?? "";
      const key = `${doc.type}|${doc.name}`;
      if (year) byId[`spycraft2.${packId}.${doc._id}`] = year;
      if (key in byName && byName[key] !== year) ambiguous.add(key);
      byName[key] = year;
      if (doc.flags?.spycraft2?.periodItem)
        periodItems.push({ pack: `spycraft2.${packId}`, id: doc._id, name: doc.name, type: doc.type });
    }
  for (const key of ambiguous) delete byName[key];
  for (const [key, year] of Object.entries(byName)) if (!year) delete byName[key];
  return `// GENERATED by tools/build-packs.mjs from src/data (gear-years.json, period-gear.json and the gear tables) — do not edit by hand.
/** Year labels of dated compendium entries, by "pack.id" and by "type|name". */
export const GEAR_YEARS = ${JSON.stringify({ byId, byName })};
/** House items for period games, which the version 6 migration copies into worlds that keep imported gear. */
export const PERIOD_ITEMS = ${JSON.stringify(periodItems, null, 1)};
`;
}
