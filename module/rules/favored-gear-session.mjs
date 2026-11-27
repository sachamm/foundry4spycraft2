import { actionDiceGain } from "./action-dice.mjs";
import { loc } from "../i18n.mjs";

export const favoredPeriodKey = value => encodeURIComponent(value).replaceAll(".", "%2E");
const epoch = (system, period) => String(system.usagePeriods?.[period] ?? "initial");
const selected = items =>
  items.filter(i => ["weapon", "armor", "gear"].includes(i.type) && i.system?.possessionSource === "favoredGear");
const validCaliber = value => Number.isSafeInteger(value) && value >= 1 && value <= 5;
const current = system => system.favoredGearSessions?.[favoredPeriodKey(epoch(system, "session"))];

/** p.197: session-start differences use the item's actual Caliber and the mission's actual Caliber. */
export function favoredGearSessionItems(system, items, missionCaliber) {
  if (!validCaliber(missionCaliber))
    throw Error(loc`Record the mission's actual Caliber (I–V) before settling Favored Gear.`);
  const favored = selected(items),
    allowance = (system.activeFeatSelections ?? []).filter(f => f.name === "Favored Gear").length;
  if (favored.length > allowance) throw Error(loc`Each favored item needs its own active Favored Gear feat.`);
  const cap = Math.min(5, Math.ceil((system.level ?? 0) / 3));
  return favored.map(item => {
    if (
      typeof item.uuid !== "string" ||
      !item.uuid ||
      !validCaliber(item.system.caliber) ||
      item.system.caliber > cap ||
      item.system.possessionApproved !== true ||
      item.system.pick ||
      item.system.reserveAcquisition
    )
      throw Error(loc`${item.name}: review its approved favored Possession and career-level Caliber limit.`);
    const forfeit = system.favoredGearForfeits?.[favoredPeriodKey(item.uuid)];
    if (
      forfeit &&
      (forfeit.itemUuid !== item.uuid || typeof forfeit.mission !== "string" || typeof forfeit.receiptId !== "string")
    )
      throw Error(loc`Review the favored item's recorded loss of access.`);
    return {
      itemUuid: item.uuid,
      itemId: item.id ?? item._id,
      name: item.name,
      caliber: item.system.caliber,
      difference: missionCaliber - item.system.caliber,
      unavailable: forfeit?.mission === epoch(system, "mission")
    };
  });
}

/** One atomic actor update can retain the session receipt, ordinary discard, item access and separate bonus wallets. */
export function favoredGearSessionPlan(system, items, { id, actorUuid, missionCaliber, careerDie, choices = {} } = {}) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,60}$/.test(id) || typeof actorUuid !== "string" || !actorUuid)
    throw Error(loc`Record the owning character and a new Favored Gear settlement reference.`);
  if (current(system))
    throw Error(
      loc`Favored Gear already has a record for this session. Review that record instead of granting or discarding dice again.`
    );
  const balance = system.actionDice?.value;
  if (system.actionDieAwardReview?.needsReview || system.actionDiceSettlementReview?.needsReview)
    throw Error(loc`Review interrupted action-die records before settling Favored Gear.`);
  if (!Number.isSafeInteger(balance) || balance < 0 || ![4, 6, 8, 10, 12].includes(careerDie))
    throw Error(loc`Review the character's current action dice before settling Favored Gear.`);
  if (!Number.isFinite(system.worldTime)) throw Error(loc`Record the current world time before settling Favored Gear.`);
  const rows = favoredGearSessionItems(system, items, missionCaliber),
    session = epoch(system, "session"),
    mission = epoch(system, "mission");
  const pools = {},
    forfeits = {},
    entries = [];
  let discarded = 0;
  for (const [index, row] of rows.entries()) {
    let status = row.unavailable ? "unavailable" : "equal";
    const entry = { ...row, status, cost: 0 };
    if (!row.unavailable && row.difference < 0) {
      const choice = choices[row.itemUuid];
      if (!["pay", "forfeit"].includes(choice))
        throw Error(
          loc`Choose whether to discard ${-row.difference} action dice for ${row.name}, or lose access for this mission.`
        );
      if (choice === "pay") {
        entry.status = "paid";
        entry.cost = -row.difference;
        discarded += entry.cost;
      } else {
        entry.status = "forfeited";
        forfeits[favoredPeriodKey(row.itemUuid)] = { itemUuid: row.itemUuid, mission, receiptId: id };
      }
    } else if (!row.unavailable && row.difference > 0) {
      const poolId = `${id}_${index}`;
      if (system.bonusActionDice?.[poolId]) throw Error(loc`This Favored Gear bonus-die reference is already used.`);
      const gain = actionDiceGain(system, careerDie, row.difference);
      entry.status = "bonus";
      entry.poolId = poolId;
      pools[poolId] = {
        id: poolId,
        source: "favoredGear",
        unrestricted: false,
        label: loc`Favored Gear: ${row.name}`,
        actorUuid,
        itemUuid: row.itemUuid,
        itemCaliber: row.caliber,
        missionCaliber,
        receiptId: id,
        session,
        mission,
        at: system.worldTime,
        baseCount: row.difference,
        baseDie: careerDie,
        die: gain.die,
        granted: gain.units,
        remaining: gain.units
      };
    }
    entries.push(entry);
  }
  if (discarded > balance)
    throw Error(
      loc`Not enough action dice remain for these favored items. Choose which items to forfeit for the mission.`
    );
  return {
    version: 1,
    state: "complete",
    id,
    actorUuid,
    session,
    mission,
    missionCaliber,
    careerDie,
    level: system.level,
    at: system.worldTime,
    beforeBalance: balance,
    afterBalance: balance - discarded,
    discarded,
    items: entries,
    pools,
    forfeits
  };
}

/** GC reconstruction records actual balances without replaying a historical gain or discard. */
export function favoredGearReviewPlan(
  system,
  items,
  { id, actorUuid, missionCaliber, careerDie, ordinaryBalance, rows, note, reviewerId } = {}
) {
  if (
    !Number.isSafeInteger(ordinaryBalance) ||
    ordinaryBalance < 0 ||
    typeof note !== "string" ||
    !note.trim() ||
    note.length > 500 ||
    typeof reviewerId !== "string" ||
    !reviewerId ||
    !Array.isArray(rows)
  )
    throw Error(loc`The GC must record actual ordinary dice, each item's history and a review note.`);
  const favored = favoredGearSessionItems({ ...system, favoredGearForfeits: {} }, items, missionCaliber);
  if (
    rows.length !== favored.length ||
    new Set(rows.map(r => r.itemUuid)).size !== favored.length ||
    favored.some(item => !rows.some(r => r.itemUuid === item.itemUuid))
  )
    throw Error(loc`Review every current favored item exactly once.`);
  const session = epoch(system, "session"),
    mission = epoch(system, "mission"),
    sessions = { ...system.favoredGearSessions },
    forfeits = { ...system.favoredGearForfeits };
  delete sessions[favoredPeriodKey(session)];
  const choices = {},
    reviewForfeits = {};
  let maximumCost = 0;
  for (const item of favored) {
    const row = rows.find(r => r.itemUuid === item.itemUuid);
    if (!(item.difference < 0 ? ["pay", "forfeit"] : ["available", "forfeit"]).includes(row.mode))
      throw Error(loc`Record ${item.name}'s actual paid, available or forfeited status.`);
    delete forfeits[favoredPeriodKey(item.itemUuid)];
    if (row.mode === "forfeit")
      forfeits[favoredPeriodKey(item.itemUuid)] = reviewForfeits[favoredPeriodKey(item.itemUuid)] = {
        itemUuid: item.itemUuid,
        mission,
        receiptId: id
      };
    else if (item.difference < 0) {
      choices[item.itemUuid] = "pay";
      maximumCost -= item.difference;
    }
  }
  const plan = favoredGearSessionPlan(
    {
      ...system,
      favoredGearSessions: sessions,
      favoredGearForfeits: forfeits,
      actionDice: { ...system.actionDice, value: Math.max(system.actionDice?.value ?? 0, maximumCost) }
    },
    items,
    { id, actorUuid, missionCaliber, careerDie, choices }
  );
  for (const pool of Object.values(plan.pools)) {
    const row = rows.find(r => r.itemUuid === pool.itemUuid),
      upgraded = careerDie === 12 ? 6 : careerDie + 2;
    if (![careerDie, upgraded].includes(row.die))
      throw Error(loc`Record the actual career die or its Fortune Favors the Bold improvement.`);
    const granted = pool.baseCount * (careerDie === 12 && row.die === 6 ? 2 : 1);
    if (!Number.isSafeInteger(row.remaining) || row.remaining < 0 || row.remaining > granted)
      throw Error(loc`Record ${pool.label}'s actual remaining dice from 0 to ${granted}.`);
    Object.assign(pool, { die: row.die, granted, remaining: row.remaining });
  }
  return {
    ...plan,
    forfeits: { ...plan.forfeits, ...reviewForfeits },
    beforeBalance: system.actionDice.value,
    afterBalance: ordinaryBalance,
    reviewedDiscarded: plan.discarded,
    discarded: 0,
    review: { reviewerId, note: note.trim(), at: system.worldTime }
  };
}

/** Loss lasts for the mission even after another session begins or the item is temporarily unmarked. */
export function favoredGearAccess(system, itemUuid, gear) {
  const forfeit = system.favoredGearForfeits?.[favoredPeriodKey(itemUuid)];
  if (forfeit && forfeit.itemUuid === itemUuid && forfeit.mission === epoch(system, "mission"))
    return loc`This favored item was forfeited for the current mission.`;
  if (gear?.possessionSource !== "favoredGear") return "";
  const receipt = current(system);
  if (!receipt)
    return system.favoredGearPendingSession === epoch(system, "session")
      ? loc`Settle this session's Favored Gear choices before using this item.`
      : "";
  if (receipt.state === "pending") return loc`Settle this session's Favored Gear choices before using this item.`;
  if (receipt.version !== 1 || receipt.session !== epoch(system, "session") || !Array.isArray(receipt.items))
    return loc`Review this session's Favored Gear record before using the item.`;
  const entry = receipt.items.find(row => row.itemUuid === itemUuid);
  if (!entry || entry.caliber !== gear.caliber)
    return loc`This favored item changed after the session's settlement. The GC must review the replacement.`;
  return "";
}

/** Restricted dice fund this item's skill boosts and threat activation, never attacks, damage boosts, fees or other items. */
export function favoredGearPoolStatus(
  system,
  id,
  { check = null, purpose = "boost", items = system.favoredGearSources ?? [] } = {}
) {
  const pool = system.bonusActionDice?.[id],
    receipt = system.favoredGearSessions?.[favoredPeriodKey(pool?.session ?? epoch(system, "session"))];
  let reason = "";
  const entry = (Array.isArray(receipt?.items) ? receipt.items : []).find(row => row.poolId === id),
    item = items.find(i => i.uuid === pool?.itemUuid),
    difference = (pool?.missionCaliber ?? 0) - (pool?.itemCaliber ?? 0);
  const valid =
    pool?.source === "favoredGear" &&
    pool.id === id &&
    pool.unrestricted === false &&
    receipt?.version === 1 &&
    receipt.id === pool.receiptId &&
    receipt.state === "complete" &&
    receipt.careerDie === pool.baseDie &&
    receipt.actorUuid === pool.actorUuid &&
    (!system.actorUuid || system.actorUuid === pool.actorUuid) &&
    pool.session === receipt.session &&
    receipt.missionCaliber === pool.missionCaliber &&
    entry?.status === "bonus" &&
    entry.itemUuid === pool.itemUuid &&
    entry.caliber === pool.itemCaliber &&
    validCaliber(pool.itemCaliber) &&
    validCaliber(pool.missionCaliber) &&
    difference > 0 &&
    pool.baseCount === difference &&
    [4, 6, 8, 10, 12].includes(pool.baseDie) &&
    [4, 6, 8, 10, 12].includes(pool.die) &&
    ((pool.die === pool.baseDie && pool.granted === difference) ||
      (pool.baseDie < 12 && pool.die === pool.baseDie + 2 && pool.granted === difference) ||
      (pool.baseDie === 12 && pool.die === 6 && pool.granted === 2 * difference)) &&
    Number.isSafeInteger(pool.remaining) &&
    pool.remaining >= 0 &&
    pool.remaining <= pool.granted &&
    Number.isFinite(pool.at) &&
    pool.at === receipt.at &&
    Number.isFinite(system.worldTime) &&
    pool.at <= system.worldTime;
  if (!valid) reason = loc`Review this favored item's recorded bonus dice.`;
  else if (pool.session !== epoch(system, "session")) reason = loc`These favored-item dice expired at session end.`;
  else if (
    !item ||
    !(system.activeFeatSelections ?? []).some(f => f.name === "Favored Gear") ||
    selected(items).length > (system.activeFeatSelections ?? []).filter(f => f.name === "Favored Gear").length ||
    item.system?.possessionSource !== "favoredGear" ||
    item.system.caliber !== pool.itemCaliber ||
    item.system.possessionApproved !== true ||
    item.system.pick ||
    item.system.reserveAcquisition ||
    favoredGearAccess(system, item.uuid, item.system)
  )
    reason = loc`These dice require the original approved favored item.`;
  else if (!pool.remaining) reason = loc`These favored-item dice are already spent.`;
  else if (
    check &&
    (check.actorUuid !== pool.actorUuid ||
      check.resolved ||
      check.superseded ||
      check.criticalFailure ||
      ![check.gearUuid, check.weaponUuid].includes(pool.itemUuid) ||
      (purpose === "boost"
        ? check.checkKind !== "skill"
        : purpose !== "threat" ||
          check.criticalSuccess ||
          check.threatConfirmed !== true ||
          check.successConfirmed !== true))
  )
    reason = loc`These dice may only boost skill checks or activate threats using their specific favored item.`;
  return {
    ...pool,
    id,
    available: reason ? 0 : pool.remaining,
    reason,
    needsReview: !valid,
    expiryLabel: "session end",
    restrictionLabel: loc`this favored item; until session end`
  };
}
