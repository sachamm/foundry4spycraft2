/**
 * Gear Restrictions (Table 7.8, p.437): a mission complication that takes mission gear picks from every agent, or
 * limits weapon or gadget picks to a short list the GC keeps with the mission.
 *
 * The mission record is world state, so this module does not read it itself. The GC layer registers a source
 * (`setGearRestrictionSource`, from module/apps/gc/state.mjs) that returns the restrictions of the mission under way;
 * with no source no restriction applies. Tests pass the restriction directly.
 */
import { loc } from "../i18n.mjs";

let source = () => null;

/** Register the function that returns the mission's restrictions (`missionGearRestrictions(getMission(), rows)`). */
export function setGearRestrictionSource(fn) {
  source = typeof fn === "function" ? fn : () => null;
}

/** The restrictions in force, or null when there are none or the world is not ready. */
export function gearRestrictionsInForce() {
  try {
    return source() ?? null;
  } catch {
    return null;
  }
}

/**
 * The restrictions a mission record scripts, from its `gearRestrictions` entries and the Table 7.8 rows.
 * Only a mission under way restricts anything.
 * @returns {{picks: number, chooser: "player"|"gc", lists: Array<{category: string, names: string[]}>}|null}
 */
export function missionGearRestrictions(mission, rows = []) {
  if (!mission?.active || mission.ended) return null;
  let picks = 0,
    gcPicks = 0;
  const lists = [];
  for (const entry of mission.gearRestrictions ?? []) {
    const row = rows.find(r => r.id === entry.id);
    if (!row) continue;
    const count = Math.max(1, Math.trunc(Number(entry.count) || 1));
    if (Number.isSafeInteger(row.data?.picks) && row.data.picks < 0) {
      picks += -row.data.picks * count;
      if (row.data.chooser === "gc") gcPicks += -row.data.picks * count;
    }
    if (row.data?.category)
      lists.push({
        category: row.data.category,
        names: (entry.names ?? []).map(name => String(name).trim()).filter(Boolean)
      });
  }
  if (!picks && !lists.length) return null;
  // When both kinds are scripted, the GC's choice decides: the GC may assign every lost pick.
  return { picks, chooser: gcPicks ? "gc" : "player", lists };
}

/** The GC's list for a list restriction: one name per line, blank lines dropped, refused past the row's limit. */
export function gearRestrictionNames(text, limit = 12) {
  const names = [
    ...new Set(
      String(text ?? "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
    )
  ];
  if (names.length > limit)
    throw new Error(loc`This Gear Restriction allows ${limit} entries; ${names.length} were listed (p.437).`);
  return names;
}

const LIST_CATEGORY = { weapons: "W", gadgets: "G" };

/**
 * Take a restriction's lost picks from the pick budget, in the categories recorded in `losses` (chosen at Intel by
 * the player or the GC, as the row says), and warn on any pick outside a list the GC keeps with the mission.
 * Changes `picks` in place and returns the warnings.
 */
export function applyGearRestrictions(picks, losses = {}, items = [], restriction = gearRestrictionsInForce()) {
  const warnings = [];
  const keys = Object.keys(picks).filter(key => key !== "CHA");
  const assigned = keys.reduce((n, key) => n + Math.max(0, Math.trunc(Number(losses?.[key]) || 0)), 0);
  const required = restriction?.picks ?? 0;
  if (assigned !== required)
    warnings.push(
      required
        ? restriction.chooser === "gc"
          ? loc`Gear Restriction: the GC removes ${required} mission gear pick(s); ${assigned} assigned so far (p.437).`
          : loc`Gear Restriction: remove ${required} mission gear pick(s) of your choice; ${assigned} assigned so far (p.437).`
        : loc`No Gear Restriction is in force; clear the ${assigned} restricted pick(s) recorded on this sheet.`
    );
  if (required)
    for (const key of keys) {
      const value = Math.max(0, Math.trunc(Number(losses?.[key]) || 0));
      if (!value) continue;
      picks[key].available = Math.max(0, picks[key].available - value);
      picks[key].remaining = picks[key].available - picks[key].spent;
      picks[key].restricted = value;
      if (picks[key].remaining < 0)
        warnings.push(loc`After the Gear Restriction, ${key} mission gear picks are overspent (p.437).`);
    }
  for (const list of restriction?.lists ?? []) {
    const category = LIST_CATEGORY[list.category];
    if (!category || !list.names.length) continue;
    const allowed = new Set(list.names.map(name => name.toLowerCase()));
    for (const item of items) {
      if (!item.system?.pick || item.system.possessionSource) continue;
      if (category === "W") {
        if (item.type === "weapon" && !allowed.has(String(item.name).toLowerCase()))
          warnings.push(
            loc`${item.name}: not on the GC's list of weapons allowed on this mission (Gear Restriction, p.437).`
          );
        continue;
      }
      if (item.type !== "gear" || item.system.pick !== "G") continue;
      // A built gadget is checked by its Mechanisms; a bare housing (Table 4.66) has none to check.
      const installed = (item.system.gadget?.mechanisms ?? []).map(m => m.name).filter(Boolean);
      const names = installed.length ? installed : item.system.sourceTable === "4.66" ? [] : [item.name];
      for (const name of names.filter(name => !allowed.has(String(name).toLowerCase())))
        warnings.push(
          loc`${name}: not on the GC's list of Mechanisms allowed on this mission (Gear Restriction, p.437).`
        );
    }
  }
  return warnings;
}
