/**
 * An NPC's organization (p.394): its Tools Rating sets the highest Caliber its people can carry in each gear
 * category. The GC's organizations live in a world setting, read through a source that module/apps/gc/state.mjs
 * registers, so the NPC rules stay free of Foundry calls.
 */
let source = () => ({});
const read = () => {
  try {
    return source() ?? {};
  } catch {
    return {};
  }
};

/** Register the function that returns { [id]: { name, calibers: { E, G, R, S, T, V, W } } }. */
export function setOrganizationToolsSource(fn) {
  source = typeof fn === "function" ? fn : () => ({});
}

/** The organizations an NPC may belong to, as [id, name] pairs. */
export const organizationChoices = () => Object.entries(read()).map(([id, org]) => [id, org.name || id]);

/**
 * The highest Caliber an organization's NPC may hold in each NPC equipment category: weapons follow W, vehicles V,
 * and other gear the best of E, G, R, S and T. Null when the NPC has no recorded organization.
 */
export function organizationNpcCaps(id) {
  const org = id ? read()[id] : null;
  if (!org?.calibers) return null;
  const c = org.calibers;
  return {
    name: org.name || id,
    weapons: c.W ?? 2,
    vehicles: c.V ?? 2,
    gear: Math.max(...["E", "G", "R", "S", "T"].map(key => c[key] ?? 2))
  };
}
