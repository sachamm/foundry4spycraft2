import { equipmentCategory } from "./gear.mjs";
import { currentReserves, missionEpoch } from "./gear-acquisition.mjs";
import { loc } from "../i18n.mjs";
/** Reviewed mission-pick exceptions. Upgrade buying/effects at Caliber V remain separate. */
export const MISSION_CALIBER_SOURCES = {
  heavilyArmed: {
    name: "Heavily Armed",
    category: "W",
    types: ["weapon"],
    classId: "grunt",
    level: 5,
    extraAt: 9,
    page: 72
  },
  spyVsSpy: { name: "Spy vs. Spy", category: "T", classId: "snoop", option: "Spy vs. Spy", page: 48 },
  executiveDecision: {
    name: "Executive Decision (Resource pick)",
    category: "R",
    classId: "politico",
    level: 10,
    page: 77
  },
  cuttingEdge: { name: "Cutting Edge", category: "G", classId: "raptor", level: 3, page: 78 },
  gearPrep: {
    name: "Gear Prep",
    category: "*",
    types: ["weapon", "armor", "gear"],
    classId: "intruder",
    level: 1,
    inherited: "Intruder: Gear prep",
    page: 37
  },
  customRide: {
    name: "Custom Ride",
    category: "V",
    types: ["gear", "vehicle"],
    classId: "wheelman",
    level: 1,
    inherited: "Wheelman: Custom ride",
    page: 50
  }
};
export function missionCaliberSourceActive(system, key) {
  const source = MISSION_CALIBER_SOURCES[key];
  if (!source) return false;
  const native = source.option
    ? (system.classOptionSelections ?? []).some(
        entry => entry.classId === source.classId && entry.name === source.option
      )
    : (system.classLevels?.[source.classId] ?? 0) >= source.level;
  return (
    native ||
    (!!source.inherited && (system.inheritedClassChoices ?? []).some(entry => entry.name === source.inherited))
  );
}
const recordItemIds = record =>
  record?.itemId ? [record.itemId, ...(Array.isArray(record.additionalItemIds) ? record.additionalItemIds : [])] : [];
export function missionCaliberLimit(system, key) {
  const source = MISSION_CALIBER_SOURCES[key];
  return source?.extraAt && (system.classLevels?.[source.classId] ?? 0) >= source.extraAt ? 2 : 1;
}
function eligibleItem(system, item, source) {
  const gear = item?.system;
  const allowedCHA = system.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"];
  const category = equipmentCategory(item);
  return (
    (source.types ?? ["gear"]).includes(item?.type) &&
    ["E", "G", "R", "S", "T", "V", "W"].includes(category) &&
    (source.category === "*" || category === source.category) &&
    (gear.pick === category || (gear.pick === "CHA" && allowedCHA.includes(category))) &&
    !gear.possessionSource &&
    !gear.reserveAcquisition &&
    !gear.armorMissionGrant &&
    !gear.common &&
    !gear.reserve &&
    !gear.ammunitionOnly &&
    !["Standard arrow", "Explosive arrow"].includes(item.name) &&
    (gear.pickCount ?? 1) === 1 &&
    Number.isSafeInteger(gear.caliber) &&
    gear.caliber >= 1
  );
}
export function missionCaliberMatches(system, item) {
  const stamp = item?.system?.missionCaliberGrant,
    source = MISSION_CALIBER_SOURCES[stamp?.source],
    epoch = missionEpoch(system),
    mission = currentReserves(system),
    record = system.missionCaliberPicks?.[stamp?.source];
  return (
    !!source &&
    missionCaliberSourceActive(system, stamp.source) &&
    !!mission &&
    mission.caliber < 5 &&
    stamp.epoch === epoch &&
    record?.epoch === epoch &&
    recordItemIds(record).slice(0, missionCaliberLimit(system, stamp.source)).includes(item.id) &&
    record.missionCaliber === mission.caliber &&
    eligibleItem(system, item, source) &&
    item.system.caliber <= mission.caliber + 1
  );
}
export function missionCaliberOptions(system, items = []) {
  const epoch = missionEpoch(system),
    mission = currentReserves(system),
    warnings = [];
  const options = Object.entries(MISSION_CALIBER_SOURCES)
    .filter(([key]) => missionCaliberSourceActive(system, key))
    .map(([key, source]) => {
      const record = system.missionCaliberPicks?.[key],
        current = record?.epoch === epoch,
        ids = current ? recordItemIds(record) : [],
        limit = missionCaliberLimit(system, key),
        selected = current ? Math.max(1, ids.length) : 0,
        used = selected >= limit;
      if (current) {
        if (!ids.length || ids.length > limit || new Set(ids).size !== ids.length)
          warnings.push(loc`${source.name}: review the recorded number of selected picks against its current limit.`);
        for (const id of ids) {
          const item = items.find(i => i.id === id);
          if (!item)
            warnings.push(loc`${source.name}: a selected mission item is missing; its exception remains used.`);
          else if (!missionCaliberMatches(system, item))
            warnings.push(loc`${item.name}: review its ${source.name} selection and paid mission pick.`);
        }
      }
      return {
        key,
        name: source.name,
        category: source.category === "*" ? "any category" : source.category,
        used,
        selected,
        limit,
        remaining: Math.max(0, limit - selected),
        caliber: mission?.caliber ?? 0,
        upgradeAllowance: mission?.caliber === 5 ? (system.actionDice?.max ?? 0) : 0
      };
    });
  for (const item of items.filter(i => i.system?.missionCaliberGrant)) {
    if (item.system.missionCaliberGrant.epoch !== epoch)
      warnings.push(
        loc`${item.name}: its mission-Caliber exception belongs to an earlier mission; review its acquisition.`
      );
    else if (!missionCaliberMatches(system, item))
      warnings.push(
        loc`${item.name}: its mission-Caliber exception is no longer valid; review source, provenance, category and Caliber.`
      );
  }
  return { options, warnings };
}
export function missionCaliberPlan(system, items, { source: key, itemId, intelConfirmed = false } = {}) {
  const source = MISSION_CALIBER_SOURCES[key],
    mission = currentReserves(system),
    epoch = missionEpoch(system);
  if (!source || !missionCaliberSourceActive(system, key))
    throw new Error(loc`Choose an earned mission-Caliber ability.`);
  if (!intelConfirmed) throw new Error(loc`Confirm this item was chosen as mission gear during Intel.`);
  if (!mission) throw new Error(loc`Record mission Caliber in reserve setup first; zero reserves are allowed.`);
  if (mission.caliber === 5)
    throw new Error(
      loc`${source.name} grants extra upgrades at Caliber V instead; upgrade purchasing and effects require separate adjudication.`
    );
  const previous = system.missionCaliberPicks?.[key]?.epoch === epoch ? system.missionCaliberPicks[key] : null,
    ids = recordItemIds(previous);
  if (
    previous &&
    (!previous.itemId ||
      (previous.additionalItemIds !== undefined && !Array.isArray(previous.additionalItemIds)) ||
      previous.missionCaliber !== mission.caliber)
  )
    throw new Error(loc`Review the existing mission selection before assigning another pick.`);
  if (previous && ids.length >= missionCaliberLimit(system, key))
    throw new Error(loc`${source.name} has already been selected this mission.`);
  if (ids.includes(itemId)) throw new Error(loc`This pick has already been selected for this ability.`);
  const item = items.find(i => i.id === itemId);
  if (!eligibleItem(system, item, source) || item.system.caliber > mission.caliber + 1)
    throw new Error(
      loc`Choose one paid ${source.category === "*" ? "matching-category" : source.category} mission pick at most one Caliber above the mission.`
    );
  if ((item.system.quantity ?? 1) < 1 || (item.system.quantity ?? 1) > (item.system.bundleSize ?? 1))
    throw new Error(loc`Choose one available paid mission bundle.`);
  if (item.system.missionCaliberGrant?.epoch === epoch || item.system.bigStickMissionPick?.epoch === epoch)
    throw new Error(loc`An item cannot combine mission-Caliber exceptions.`);
  return {
    key,
    record: {
      epoch,
      itemId: previous?.itemId ?? itemId,
      additionalItemIds: previous ? [...(previous.additionalItemIds ?? []), itemId] : [],
      missionCaliber: mission.caliber
    },
    stamp: { epoch, source: key, name: source.name }
  };
}
