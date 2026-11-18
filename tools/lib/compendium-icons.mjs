/** Explicit icon assignments keep catalog coverage reviewable and fail on unassigned entries. */
export function iconPath(data, iconId) {
  if (!data.icons.some(icon => icon.id === iconId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(iconId))
    throw new Error(`Unknown compendium icon: ${iconId}`);
  return `systems/spycraft2/assets/icons/${iconId}.webp`;
}

export function applyCompendiumIcons(packs, data) {
  const ids = data.icons.map(icon => icon.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate compendium icon IDs.");
  for (const icon of data.icons) iconPath(data, icon.id);
  for (const [packId, pack] of Object.entries(packs)) {
    if (!["Item", "RollTable"].includes(pack.type ?? "Item")) continue;
    const rows = data.packs[packId];
    if (!rows) throw new Error(`Missing icon assignments for ${packId}.`);
    const assignments = new Map(rows.map(row => [row.id, row]));
    if (assignments.size !== rows.length) throw new Error(`Duplicate icon assignments in ${packId}.`);
    if (assignments.size !== pack.docs.length) throw new Error(`Stale icon assignment count for ${packId}.`);
    for (const doc of pack.docs) {
      const row = assignments.get(doc._id);
      if (!row || row.name !== doc.name) throw new Error(`Missing or stale icon assignment: ${packId}/${doc.name}`);
      doc.img = iconPath(data, row.icon);
      doc.flags = { ...doc.flags, spycraft2: { ...doc.flags?.spycraft2, compendiumIcon: row.icon } };
      for (const result of doc.embedded?.results ?? []) result.img = doc.img;
    }
  }
  for (const packId of Object.keys(data.packs))
    if (!packs[packId]) throw new Error(`Unknown icon assignment pack: ${packId}`);
}
