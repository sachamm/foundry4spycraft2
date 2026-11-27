import {
  favoredGearSessionItems,
  favoredGearSessionPlan,
  favoredGearReviewPlan,
  favoredGearLevelChoicePlan,
  favoredGearReviewItems,
  favoredPeriodKey
} from "../rules/favored-gear-session.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { sameValues } from "../rules/equal.mjs";
import { queueResources } from "../services/transactions.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { withUndo } from "./undo.mjs";
import { getMission } from "./gc/state.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

const session = actor => String(actor.usagePeriods?.session ?? actor.system.usagePeriods?.session ?? "initial");
const numeric = value =>
  typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
const record = actor => actor.flags?.spycraft2?.favoredGearSessions?.[favoredPeriodKey(session(actor))];
const source = actor => ({
  ...actor.actionDiceFundingSystem,
  usagePeriods: actor.usagePeriods ?? actor.system.usagePeriods,
  favoredGearSessions: actor.flags?.spycraft2?.favoredGearSessions ?? {},
  favoredGearForfeits: actor.flags?.spycraft2?.favoredGearForfeits ?? {},
  sessionDiceReset: actor.flags?.spycraft2?.sessionDiceReset ?? null
});

export async function recordFavoredGearLevelChoices(actor, options = {}) {
  if (actor?.type !== "agent" || !actor.isOwner || !game.user?.isGM)
    throw Error(loc`The owning GC records favored-item choices after applying a new career level.`);
  const initial = source(actor),
    missionCaliber = options.missionCaliber ?? getMission().caliber;
  const rows = favoredGearSessionItems(initial, [...actor.items], missionCaliber);
  const fingerprint = system =>
    structuredClone({
      level: system.level,
      periods: system.usagePeriods,
      feats: system.activeFeatSelections,
      sessions: system.favoredGearSessions,
      forfeits: system.favoredGearForfeits,
      pools: system.bonusActionDice,
      reset: system.sessionDiceReset,
      balance: system.actionDice?.value
    });
  const before = fingerprint(initial);
  let input = options;
  if (options.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Favored items for a new career level` },
      position: { width: 620 },
      rejectClose: false,
      ok: { label: loc`Record level choices` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Career Level ${actor.system.level}: first mark one approved favored Possession for every active Favored Gear feat. This records the complete new-level selection once. Replacement items gain no session dice and cost no session dice now. Old item dice stay with unchanged items; dice for replaced items are retired. Mission forfeits remain.`}</p><ul>${rows.map(row => `<li>${esc(row.name)} — ${loc`Caliber ${row.caliber}`}</li>`).join("")}</ul>${!record(actor) ? `<label><input name="emptyStartConfirmed" type="checkbox" /> ${loc`The GC checked the session-start record: no favored items were held at that time`}</label>` : ""}<label>${loc`GC review note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`All benefits of this new level are applied; these are the complete favored-item choices for that level`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (
      !actor.isOwner ||
      !game.user?.isGM ||
      !sameValues(before, fingerprint(source(actor))) ||
      !sameValues(rows, favoredGearSessionItems(source(actor), [...actor.items], missionCaliber))
    )
      throw Error(loc`The level, favored items or session resources changed. Review the current level choices again.`);
    const plan = favoredGearLevelChoicePlan(source(actor), [...actor.items], {
      ...input,
      missionCaliber,
      id: foundry.utils.randomID(),
      actorUuid: actor.uuid,
      careerDie: CONFIG.SPYCRAFT.tables.levels[initial.level]?.actionDie,
      userId: game.user.id
    });
    if (plan.duplicate) return plan.receipt;
    const changes = { [`flags.spycraft2.favoredGearSessions.${favoredPeriodKey(plan.receipt.session)}`]: plan.receipt };
    for (const pool of plan.retiredPools) changes[`system.bonusActionDice.${pool.id}.remaining`] = 0;
    await withUndo([actor], loc`${actor.name}: record favored items for Career Level ${initial.level}`, async () => {
      try {
        await actor.update(changes);
      } catch (error) {
        if (
          !sameValues(record(actor), plan.receipt) ||
          plan.retiredPools.some(p => actor.system.bonusActionDice?.[p.id]?.remaining !== 0)
        )
          throw error;
      }
    });
    return plan.receipt;
  });
}
function retained(actor) {
  const saved = record(actor);
  if (!saved) return null;
  if (
    saved.version !== 1 ||
    saved.actorUuid !== actor.uuid ||
    saved.session !== session(actor) ||
    !Array.isArray(saved.items) ||
    !["pending", "complete"].includes(saved.state) ||
    !saved.id
  )
    throw Error(loc`This session's Favored Gear record needs GC review. Do not grant or discard its dice again.`);
  return saved.state === "complete" ? saved : null;
}

/** Reconcile manual or interrupted history with actual balances; preserve the earlier evidence and provide Undo. */
export async function reviewFavoredGearSession(actor, options = {}) {
  if (!game.user?.isGM || actor?.type !== "agent" || !actor.isOwner)
    throw Error(loc`The owning GC reviews Favored Gear history.`);
  const expectedSession = session(actor),
    expectedContextRecord = structuredClone(record(actor) ?? null);
  if (options.missionCaliber === undefined && !options.rows) {
    const saved = record(actor),
      context = await systemDialog.input({
        window: { title: loc`${actor.name}: review session context` },
        rejectClose: false,
        ok: { label: loc`Review item balances` },
        content: `<div class="spycraft2-roll-options"><p>${loc`Use the mission Caliber and Career Level from the start of the session being reviewed.`}</p><label>${loc`Mission Caliber at session start`} <input name="missionCaliber" type="number" min="1" max="5" step="1" value="${saved?.missionCaliber ?? getMission().caliber}" required /></label><label>${loc`Career level at session start`} <input name="careerLevel" type="number" min="1" max="20" step="1" value="${saved?.sessionStartLevel ?? saved?.level ?? actor.flags?.spycraft2?.sessionDiceReset?.level ?? actor.system.level}" required /></label></div>`
      });
    if (!context) return null;
    options = {
      ...options,
      missionCaliber: numeric(context.missionCaliber),
      careerLevel: numeric(context.careerLevel)
    };
  }
  if (session(actor) !== expectedSession || !sameValues(record(actor) ?? null, expectedContextRecord))
    throw Error(loc`The session changed while its history was being selected. Review the current session.`);
  const initial = source(actor),
    missionCaliber = options.missionCaliber ?? record(actor)?.missionCaliber ?? getMission().caliber;
  const items = favoredGearReviewItems(initial, [...actor.items], missionCaliber);
  if (!items.length) return null;
  const snapshot = structuredClone({
    session: session(actor),
    mission: initial.usagePeriods?.mission ?? "initial",
    level: actor.system.level,
    ordinary: actor.system.actionDice.value,
    pools: actor.system.bonusActionDice ?? {},
    record: record(actor) ?? null,
    forfeits: initial.favoredGearForfeits
  });
  let input = options;
  if (!input.rows) {
    input = await systemDialog.input({
      window: { title: loc`${actor.name}: review favored item history` },
      rejectClose: false,
      ok: { label: loc`Record actual favored item balances` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Record actual remaining dice after any earlier Favored Gear adjustments. Separate item-restricted dice from ordinary dice.`}</p><label>${loc`Career level at session start`} <input name="careerLevel" type="number" min="1" max="20" step="1" value="${options.careerLevel ?? actor.flags?.spycraft2?.sessionDiceReset?.level ?? actor.system.level}" required /></label><label>${loc`Actual ordinary dice remaining`} <input name="ordinaryBalance" type="number" min="0" step="1" value="${actor.system.actionDice.value}" required /></label>${items.map((item, i) => `<fieldset><legend>${esc(item.name)} — ${loc`Caliber ${item.caliber}`}</legend><label>${loc`Actual item access`} <select name="access_${i}" required><option value="">${loc`Choose actual history`}</option><option value="${item.difference < 0 && !item.levelChoice ? "pay" : "available"}">${item.difference < 0 && !item.levelChoice ? loc`The required ${-item.difference} dice were already discarded` : loc`Available this mission`}</option><option value="forfeit">${loc`Access lost for this mission`}</option></select></label>${item.difference > 0 && !item.levelChoice ? `<div data-when="access_${i}=available"><label>${loc`Actual item-restricted die`} <select name="die_${i}">${[4, 6, 8, 10, 12].map(d => `<option value="${d}">d${d}</option>`).join("")}</select></label><label>${loc`Actual item-restricted dice remaining`} <input name="remaining_${i}" type="number" min="0" step="1" required /></label></div>` : ""}</fieldset>`).join("")}<label>${loc`GC review note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms these actual balances and each item's access history`}</label></div>`
    });
    if (!input) return null;
    input.rows = items.map((item, i) => ({
      itemUuid: item.itemUuid,
      mode: input[`access_${i}`],
      die: numeric(input[`die_${i}`]),
      remaining: numeric(input[`remaining_${i}`])
    }));
  }
  if (input.confirmed !== true) throw Error(loc`The GC must confirm the actual Favored Gear history.`);
  const careerLevel = numeric(input.careerLevel),
    careerDie = CONFIG.SPYCRAFT.tables.levels[careerLevel]?.actionDie;
  if (!Number.isSafeInteger(careerLevel) || careerLevel < 1 || careerLevel > 20)
    throw Error(loc`Record the actual session-start Career Level from 1 to 20.`);
  return queueResources([actor], async () => {
    const now = source(actor),
      currentSnapshot = {
        session: session(actor),
        mission: now.usagePeriods?.mission ?? "initial",
        level: actor.system.level,
        ordinary: actor.system.actionDice.value,
        pools: actor.system.bonusActionDice ?? {},
        record: record(actor) ?? null,
        forfeits: now.favoredGearForfeits
      };
    if (
      !sameValues(currentSnapshot, snapshot) ||
      !sameValues(favoredGearReviewItems(now, [...actor.items], missionCaliber), items)
    )
      throw Error(loc`The actual balances, session or favored items changed during review. Review them again.`);
    const id = foundry.utils.randomID(),
      plan = favoredGearReviewPlan(now, [...actor.items], {
        id,
        actorUuid: actor.uuid,
        missionCaliber,
        careerDie,
        ordinaryBalance: numeric(input.ordinaryBalance),
        rows: input.rows,
        note: input.note,
        reviewerId: game.user.id
      });
    const receipt = { ...plan, sessionStartLevel: careerLevel };
    delete receipt.pools;
    delete receipt.forfeits;
    const path = `flags.spycraft2.favoredGearSessions.${favoredPeriodKey(plan.session)}`;
    const changes = {
      "system.actionDice.value": plan.afterBalance,
      ...recordReplacementPatch(path, receipt, record(actor)),
      [`flags.spycraft2.favoredGearReviews.${id}`]: { ...snapshot, review: plan.review }
    };
    for (const [poolId, pool] of Object.entries(actor.system.bonusActionDice ?? {}))
      if (pool.source === "favoredGear") changes[`system.bonusActionDice.${poolId}.remaining`] = 0;
    for (const [poolId, pool] of Object.entries(plan.pools)) changes[`system.bonusActionDice.${poolId}`] = pool;
    for (const item of items) {
      const key = favoredPeriodKey(item.itemUuid);
      if (plan.forfeits[key]) changes[`flags.spycraft2.favoredGearForfeits.${key}`] = plan.forfeits[key];
      else if (actor.flags?.spycraft2?.favoredGearForfeits?.[key])
        changes[`flags.spycraft2.favoredGearForfeits.-=${key}`] = null;
    }
    await withUndo([actor], loc`${actor.name}: review actual Favored Gear balances and access`, async () => {
      try {
        await actor.update(changes);
      } catch (error) {
        if (
          !sameValues(record(actor), receipt) ||
          actor.system.actionDice.value !== plan.afterBalance ||
          !Object.entries(plan.pools).every(([poolId, pool]) =>
            sameValues(actor.system.bonusActionDice?.[poolId], pool)
          ) ||
          !Object.entries(snapshot.pools)
            .filter(([, pool]) => pool.source === "favoredGear")
            .every(([poolId]) => actor.system.bonusActionDice?.[poolId]?.remaining === 0) ||
          !items.every(item =>
            sameValues(
              actor.flags?.spycraft2?.favoredGearForfeits?.[favoredPeriodKey(item.itemUuid)],
              plan.forfeits[favoredPeriodKey(item.itemUuid)]
            )
          )
        )
          throw error;
      }
    });
    return receipt;
  });
}

/** Atomic dice/access settlement, with a durable receipt before any optional chat refresh. */
export async function settleFavoredGearSession(actor, options = {}) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  if (retained(actor)) return retained(actor);
  if (!game.user?.isGM) throw Error(loc`The GC settles Favored Gear at session start or reviews unknown history.`);
  const reset = actor.flags?.spycraft2?.sessionDiceReset;
  if (
    reset?.session === session(actor) &&
    reset.actorUuid === actor.uuid &&
    Number.isSafeInteger(reset.level) &&
    reset.level < actor.system.level &&
    reset.favoredGearPending !== true
  )
    throw Error(
      loc`Record the new-level favored items instead of replaying session-start dice for a feat acquired after the session began.`
    );
  const missionCaliber = options.missionCaliber ?? getMission().caliber;
  const rows = favoredGearSessionItems(source(actor), [...actor.items], missionCaliber);
  if (!rows.length) return null;
  const careerDie = CONFIG.SPYCRAFT.tables.levels[actor.system.level]?.actionDie;
  const pending = await queueResources([actor], async () => {
    const saved = retained(actor);
    if (saved) return saved;
    const previous = record(actor);
    if (previous) {
      if (
        previous.missionCaliber !== missionCaliber ||
        previous.mission !== String(source(actor).usagePeriods?.mission ?? "initial") ||
        previous.careerDie !== careerDie ||
        !sameValues(previous.items, rows)
      )
        throw Error(
          loc`The unresolved Favored Gear choices changed. The GC must review the original session and item history.`
        );
      return structuredClone(previous);
    }
    const entry = {
      version: 1,
      state: "pending",
      id: foundry.utils.randomID(),
      actorUuid: actor.uuid,
      session: session(actor),
      mission: String(source(actor).usagePeriods?.mission ?? "initial"),
      missionCaliber,
      careerDie,
      items: rows
    };
    try {
      await actor.update({ [`flags.spycraft2.favoredGearSessions.${favoredPeriodKey(entry.session)}`]: entry });
    } catch (error) {
      if (!sameValues(record(actor), entry)) throw error;
    }
    return entry;
  });
  if (pending.state === "complete") return pending;
  const expectedSession = session(actor),
    before = source(actor),
    startingBalance = actor.system.actionDice.value;
  let input = options;
  if (options.fresh !== true || (rows.some(row => !row.unavailable && row.difference < 0) && !options.choices)) {
    input = await systemDialog.input({
      window: { title: loc`${actor.name}: Favored Gear for this session` },
      rejectClose: false,
      ok: { label: loc`Settle favored items` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Settle each item once for this session, using the mission's actual Caliber. Bonus dice stay with their specific item.`}</p><p>${loc`Ordinary action dice available: ${startingBalance}. Mission Caliber: ${missionCaliber}.`}</p>${rows.map((row, i) => `<fieldset><legend>${esc(row.name)} — ${loc`Caliber ${row.caliber}`}</legend>${row.unavailable ? `<p>${loc`Access was already lost for this mission.`}</p>` : row.difference > 0 ? `<p>${loc`Gain ${row.difference} item-restricted action dice before any die-type improvement.`}</p>` : row.difference === 0 ? `<p>${loc`No dice gained or discarded.`}</p>` : `<label>${loc`Keep access this mission`} <select name="choice_${i}"><option value="pay">${loc`Discard ${-row.difference} ordinary action dice`}</option><option value="forfeit">${loc`Lose access for this mission`}</option></select></label>`}</fieldset>`).join("")}${options.fresh === true ? "" : `<label><input name="firstSettlementConfirmed" type="checkbox" /> ${loc`The GC confirms these Favored Gear adjustments have not already been handled this session`}</label><p class="hint">${loc`If already handled manually, cancel and have the GC review the actual dice and access history before recording another settlement.`}</p>`}</div>`
    });
    if (!input) return null;
    if (options.fresh !== true && (!game.user?.isGM || input.firstSettlementConfirmed !== true))
      throw Error(loc`The GC must review unknown Favored Gear history before adding or discarding dice.`);
    input.choices = Object.fromEntries(rows.map((row, i) => [row.itemUuid, input[`choice_${i}`]]));
  }
  return queueResources([actor], async () => {
    const saved = retained(actor);
    if (saved) return saved;
    if (
      session(actor) !== expectedSession ||
      !sameValues(record(actor), pending) ||
      actor.system.actionDice.value !== startingBalance ||
      !sameValues(favoredGearSessionItems(source(actor), [...actor.items], missionCaliber), rows) ||
      source(actor).usagePeriods?.mission !== before.usagePeriods?.mission
    )
      throw Error(loc`The session, favored items or dice changed. Review the current choices again.`);
    const planning = { ...source(actor), favoredGearSessions: { ...source(actor).favoredGearSessions } };
    delete planning.favoredGearSessions[favoredPeriodKey(pending.session)];
    const plan = favoredGearSessionPlan(planning, [...actor.items], {
      id: pending.id,
      actorUuid: actor.uuid,
      missionCaliber,
      careerDie,
      choices: input.choices
    });
    const receipt = { ...plan };
    delete receipt.pools;
    delete receipt.forfeits;
    const changes = {
      "system.actionDice.value": plan.afterBalance,
      [`flags.spycraft2.favoredGearSessions.${favoredPeriodKey(plan.session)}`]: receipt
    };
    for (const [id, pool] of Object.entries(plan.pools)) changes[`system.bonusActionDice.${id}`] = pool;
    for (const [key, forfeit] of Object.entries(plan.forfeits))
      changes[`flags.spycraft2.favoredGearForfeits.${key}`] = forfeit;
    await withUndo([actor], loc`${actor.name}: settle Favored Gear for session Caliber ${missionCaliber}`, async () => {
      try {
        await actor.update(changes);
      } catch (error) {
        if (
          !sameValues(record(actor), receipt) ||
          actor.system.actionDice.value !== plan.afterBalance ||
          !Object.entries(plan.pools).every(([id, pool]) => sameValues(actor.system.bonusActionDice?.[id], pool)) ||
          !Object.entries(plan.forfeits).every(([id, forfeit]) =>
            sameValues(actor.flags?.spycraft2?.favoredGearForfeits?.[id], forfeit)
          )
        )
          throw error;
      }
    });
    return receipt;
  });
}
