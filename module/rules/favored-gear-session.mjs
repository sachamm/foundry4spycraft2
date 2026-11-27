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

/** p.197: finalize all favored items once for the benefits of a new career level, without another session award. */
export function favoredGearLevelChoicePlan(
  system,
  items,
  { id, actorUuid, missionCaliber, careerDie, note, confirmed = false, emptyStartConfirmed = false, userId } = {}
) {
  const level = system.level,
    saved = current(system),
    reset = system.sessionDiceReset;
  if (system.classLevels && Object.values(system.classLevels).reduce((sum, n) => sum + n, 0) !== level)
    throw Error(loc`Finish the actual class progression before recording new-level favored items.`);
  if (
    !Number.isSafeInteger(level) ||
    level < 1 ||
    level > 20 ||
    !Number.isFinite(system.worldTime) ||
    typeof actorUuid !== "string" ||
    !actorUuid ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,60}$/.test(id)
  )
    throw Error(loc`Review the character, current career level and level-choice reference.`);
  if (
    confirmed !== true ||
    typeof note !== "string" ||
    !note.trim() ||
    note.trim().length > 500 ||
    typeof userId !== "string" ||
    !userId
  )
    throw Error(loc`The GC must confirm the complete new-level selection and record its source.`);
  if (system.actionDieAwardReview?.needsReview || system.actionDiceSettlementReview?.needsReview)
    throw Error(loc`Review interrupted action-die records before recording favored-item replacements.`);
  if (
    saved &&
    (saved.version !== 1 ||
      saved.state !== "complete" ||
      saved.actorUuid !== actorUuid ||
      saved.session !== epoch(system, "session") ||
      !Array.isArray(saved.items))
  )
    throw Error(loc`Settle or review the existing favored-item session record first.`);
  const priorLevel = saved?.lastSelectionLevel ?? saved?.sessionStartLevel ?? saved?.level ?? reset?.level;
  const rows = favoredGearSessionItems(system, items, missionCaliber);
  const sources = (system.activeFeatSelections ?? []).filter(f => f.name === "Favored Gear");
  if (!sources.length || rows.length !== sources.length)
    throw Error(loc`Choose one approved favored item for each active Favored Gear feat before finalizing this level.`);
  if (saved && !Array.isArray(saved.levelChoices ?? []))
    throw Error(loc`Review the favored-item level-choice history.`);
  if (saved?.lastSelectionLevel === level) {
    const sameItems =
      rows.length === saved.items.length &&
      rows.every(row => saved.items.some(e => e.itemUuid === row.itemUuid && e.caliber === row.caliber));
    if (sameItems) return { duplicate: true, receipt: saved, retiredPools: [] };
    throw Error(loc`This career level's favored items were already chosen. The GC must review a correction.`);
  }
  if (!Number.isSafeInteger(priorLevel) || priorLevel < 1 || priorLevel >= level)
    throw Error(
      loc`A favored-item replacement requires a recorded earlier career level and the benefits of a new level.`
    );
  if (
    !saved &&
    (reset?.session !== epoch(system, "session") ||
      reset?.actorUuid !== actorUuid ||
      reset.favoredGearPending === true ||
      emptyStartConfirmed !== true)
  )
    throw Error(loc`The GC must verify the session-start record and confirm that no favored items were held then.`);
  if (
    ![4, 6, 8, 10, 12].includes(careerDie) ||
    !Number.isSafeInteger(system.actionDice?.value) ||
    system.actionDice.value < 0
  )
    throw Error(loc`Review the actual action-die balance and career die.`);
  const before = saved?.items ?? [],
    retiredPools = [];
  const entries = rows.map(row => {
    const old = before.find(e => e.itemUuid === row.itemUuid && e.caliber === row.caliber);
    if (old) return structuredClone(old);
    return {
      ...row,
      status: row.unavailable ? "unavailable" : "levelChoice",
      cost: 0,
      selectionLevel: level,
      selectionMission: epoch(system, "mission"),
      selectionMissionCaliber: missionCaliber
    };
  });
  for (const old of before)
    if (!entries.some(e => e.itemUuid === old.itemUuid && e.caliber === old.caliber) && old.poolId) {
      const pool = system.bonusActionDice?.[old.poolId];
      if (
        !pool ||
        pool.source !== "favoredGear" ||
        pool.receiptId !== saved.id ||
        pool.itemUuid !== old.itemUuid ||
        !Number.isSafeInteger(pool.remaining) ||
        pool.remaining < 0
      )
        throw Error(loc`Review the original item's remaining bonus dice before replacing it.`);
      retiredPools.push({ id: old.poolId, remaining: pool.remaining });
    }
  const receipt = saved
    ? structuredClone(saved)
    : {
        version: 1,
        state: "complete",
        id,
        actorUuid,
        session: epoch(system, "session"),
        mission: epoch(system, "mission"),
        missionCaliber,
        careerDie,
        level: priorLevel,
        at: system.worldTime,
        beforeBalance: system.actionDice.value,
        afterBalance: system.actionDice.value,
        discarded: 0,
        items: [],
        emptyStartReview: { userId, note: note.trim(), reset: structuredClone(reset) }
      };
  receipt.lastSelectionLevel = level;
  receipt.items = entries;
  receipt.levelChoices = [
    ...(receipt.levelChoices ?? []),
    {
      id,
      level,
      previousLevel: priorLevel,
      at: system.worldTime,
      userId,
      note: note.trim(),
      mission: epoch(system, "mission"),
      featSources: structuredClone(sources),
      beforeItems: structuredClone(before),
      items: structuredClone(entries),
      retiredPools
    }
  ];
  return { duplicate: false, receipt, retiredPools };
}

/** GC reconstruction records actual balances without replaying a historical gain or discard. */
export function favoredGearReviewItems(system, items, missionCaliber) {
  const saved = current(system);
  return favoredGearSessionItems({ ...system, favoredGearForfeits: {} }, items, missionCaliber).map(row => {
    const prior = saved?.items?.find(
      e => e.itemUuid === row.itemUuid && e.caliber === row.caliber && Number.isSafeInteger(e.selectionLevel)
    );
    const known =
      prior &&
      Array.isArray(saved.levelChoices) &&
      saved.levelChoices.some(
        choice =>
          choice.level === prior.selectionLevel &&
          choice.items?.some(e => e.itemUuid === row.itemUuid && e.caliber === row.caliber)
      );
    return known ? { ...row, levelChoice: structuredClone(prior) } : row;
  });
}

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
  const favored = favoredGearReviewItems(system, items, missionCaliber);
  const saved = current(system);
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
    if (!(item.difference < 0 && !item.levelChoice ? ["pay", "forfeit"] : ["available", "forfeit"]).includes(row.mode))
      throw Error(loc`Record ${item.name}'s actual paid, available or forfeited status.`);
    delete forfeits[favoredPeriodKey(item.itemUuid)];
    if (row.mode === "forfeit")
      forfeits[favoredPeriodKey(item.itemUuid)] = reviewForfeits[favoredPeriodKey(item.itemUuid)] = {
        itemUuid: item.itemUuid,
        mission,
        receiptId: id
      };
    else if (item.difference < 0 && !item.levelChoice) {
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
    items.filter(item => !favored.some(row => row.itemUuid === item.uuid && row.levelChoice)),
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
    items: [
      ...plan.items,
      ...favored
        .filter(item => item.levelChoice)
        .map(item => ({
          ...item.levelChoice,
          status: rows.find(row => row.itemUuid === item.itemUuid).mode === "forfeit" ? "unavailable" : "levelChoice",
          cost: 0
        }))
    ],
    ...(saved?.levelChoices
      ? { levelChoices: structuredClone(saved.levelChoices), lastSelectionLevel: saved.lastSelectionLevel }
      : {}),
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
