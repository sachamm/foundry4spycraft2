import { classFeatureLevels } from "./class-features.mjs";
import { equipmentCategory, bigStickMatches, bigStickStatus, armorGrantStatus } from "./gear.mjs";
import { currentReserves, missionEpoch, reserveAllocations } from "./gear-acquisition.mjs";
import { historicalCaliber } from "./gear-era.mjs";
import { loc } from "../i18n.mjs";
import { campaignPickCaliber } from "./campaign-gear.mjs";
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
    : (classFeatureLevels(system)?.[source.classId] ?? 0) >= source.level;
  return (
    native ||
    (!!source.inherited && (system.inheritedClassChoices ?? []).some(entry => entry.name === source.inherited))
  );
}
const recordItemIds = record =>
  record?.itemId ? [record.itemId, ...(Array.isArray(record.additionalItemIds) ? record.additionalItemIds : [])] : [];
export function missionCaliberLimit(system, key) {
  const source = MISSION_CALIBER_SOURCES[key];
  return source?.extraAt && (classFeatureLevels(system)?.[source.classId] ?? 0) >= source.extraAt ? 2 : 1;
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
    Number.isSafeInteger(mission.caliber) &&
    mission.caliber >= 1 &&
    mission.caliber < 5 &&
    stamp.epoch === epoch &&
    record?.epoch === epoch &&
    recordItemIds(record).slice(0, missionCaliberLimit(system, stamp.source)).includes(item.id) &&
    record.missionCaliber === mission.caliber &&
    eligibleItem(system, item, source) &&
    (historicalCaliber(item.system).caliber ?? 6) <=
      campaignPickCaliber(Math.min(5, mission.caliber + 1), system.campaignEffects).caliber
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

/** Extra Caliber I mission items are linked to actual funded source picks, rather than becoming unrestricted picks. */
export function campaignMissionBonusPicks(system, items = []) {
  const mission = currentReserves(system),
    effects = system.campaignEffects ?? {};
  const gear = items.filter(i => ["weapon", "armor", "gear", "vehicle"].includes(i.type));
  const extras = gear.filter(i => i.system.campaignBonusOf && !i.system.possessionSource);
  const requested = new Set(extras.map(i => i.system.campaignBonusOf));
  const sources = [],
    warnings = [],
    assignments = [];
  const reservations = reserveAllocations(system);
  const remaining = Object.fromEntries(
    Object.entries(system.gearPicks ?? {}).map(([key, value]) => [
      key,
      Number.isSafeInteger(value.available) ? Math.max(0, value.available - (reservations[key] ?? 0)) : 0
    ])
  );
  const bigStick = bigStickStatus(system, items);
  const validMission = Number.isSafeInteger(mission?.caliber) && mission.caliber >= 1 && mission.caliber <= 5;
  const allowedCHA = system.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"];
  if (validMission) {
    const primary = gear
      .filter(
        i =>
          i.system.pick &&
          !i.system.campaignBonusOf &&
          !i.system.possessionSource &&
          !i.system.reserveAcquisition &&
          !i.system.reserve &&
          !i.system.common &&
          !i.system.ammunitionOnly
      )
      .sort((a, b) => Number(requested.has(b.id)) - Number(requested.has(a.id)));
    for (const item of primary) {
      const s = item.system,
        count = s.pickCount ?? 1,
        category = equipmentCategory(item);
      if (
        !Number.isSafeInteger(count) ||
        count < 1 ||
        !category ||
        (s.pick !== category && !(s.pick === "CHA" && allowedCHA.includes(category)))
      )
        continue;
      const funded = Math.min(count, remaining[s.pick] ?? 0);
      remaining[s.pick] = Math.max(0, (remaining[s.pick] ?? 0) - funded);
      const raised =
        missionCaliberMatches(system, item) ||
        (bigStick.active && !bigStick.warnings.length && bigStickMatches(system, item));
      const allowance = campaignPickCaliber(Math.min(5, mission.caliber + (raised ? 1 : 0)), effects);
      if (
        funded &&
        allowance.extraI &&
        Number.isSafeInteger(s.caliber) &&
        s.caliber >= 1 &&
        s.caliber <= allowance.caliber
      )
        sources.push({ id: item.id, name: item.name, category, count: funded, remaining: funded });
    }
  }
  const armor = armorGrantStatus(system, items);
  if (
    armor.used &&
    !armor.warnings.length &&
    armor.baseCaliber &&
    campaignPickCaliber(armor.baseCaliber, effects).extraI
  ) {
    const item = gear.find(i => i.id === armor.itemId);
    if (item)
      sources.push({
        id: item.id,
        name: item.name,
        category: equipmentCategory(item),
        type: "armor",
        count: 1,
        remaining: 1
      });
  }
  for (const item of extras) {
    const s = item.system,
      source = sources.find(row => row.id === s.campaignBonusOf),
      count = s.pickCount ?? 1;
    const valid =
      source &&
      s.caliber === 1 &&
      !s.pick &&
      !s.reserveAcquisition &&
      !s.reserve &&
      !s.common &&
      !s.ammunitionOnly &&
      equipmentCategory(item) === source.category &&
      (!source.type || item.type === source.type) &&
      Number.isSafeInteger(count) &&
      count >= 1 &&
      Number.isSafeInteger(s.quantity ?? 1) &&
      (s.quantity ?? 1) >= 0 &&
      (s.quantity ?? 1) <= (s.bundleSize ?? 1) * count;
    const funded = valid ? Math.min(count, source.remaining) : 0;
    if (valid) source.remaining -= funded;
    assignments.push({ id: item.id, sourceItemId: s.campaignBonusOf, count, funded });
    if (!valid || funded < count)
      warnings.push(
        loc`${item.name}: review its Big Budget extra mission item. It needs an unused same-category Caliber I allowance and cannot also spend a paid pick or exceed its bundle quantity.`
      );
  }
  const ordinary = validMission ? campaignPickCaliber(mission.caliber, effects) : null;
  const summary = ordinary
    ? ordinary.lost
      ? loc`Ordinary mission gear picks are lost under this campaign's Caliber modifier.`
      : loc`Ordinary mission gear limit: Caliber ${["", "I", "II", "III", "IV", "V"][ordinary.caliber]}.`
    : loc`Record mission Caliber in reserve setup to review the campaign's gear allowance.`;
  return {
    sources,
    assignments,
    warnings,
    summary,
    unassigned: sources.reduce((n, source) => n + source.remaining, 0)
  };
}
export function missionCaliberPlan(system, items, { source: key, itemId, intelConfirmed = false } = {}) {
  const source = MISSION_CALIBER_SOURCES[key],
    mission = currentReserves(system),
    epoch = missionEpoch(system);
  if (!source || !missionCaliberSourceActive(system, key))
    throw new Error(loc`Choose an earned mission-Caliber ability.`);
  if (!intelConfirmed) throw new Error(loc`Confirm this item was chosen as mission gear during Intel.`);
  if (!mission) throw new Error(loc`Record mission Caliber in reserve setup first; zero reserves are allowed.`);
  if (!Number.isSafeInteger(mission.caliber) || mission.caliber < 1 || mission.caliber > 5)
    throw new Error(loc`Review the recorded mission Caliber before assigning an exception.`);
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
  const maximumCaliber = campaignPickCaliber(Math.min(5, mission.caliber + 1), system.campaignEffects).caliber;
  if (!eligibleItem(system, item, source) || item.system.caliber > maximumCaliber)
    throw new Error(
      loc`Choose one paid ${source.category === "*" ? "matching-category" : source.category} mission pick within this ability's adjusted Caliber limit (${maximumCaliber}).`
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
