import { renderOpenSheet } from "./refresh.mjs";
import { getActionDieSettlementReview } from "../rules/action-die-payments.mjs";
import { getRestraintReleaseReview, getPendingRestraintMoves } from "../rules/restraints.mjs";
import { getReserveReview } from "../rules/reserve-transactions.mjs";
import { getBaffledReview } from "../rules/baffled.mjs";
import { queueResources, periodResourceActors, periodRefreshActors } from "./transactions.mjs";
import { withGCPeriodLock } from "./gc-dice.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
import { missionLevelSnapshot } from "../rules/advancement.mjs";
import { nextSessionStartingDice } from "../rules/crossroads-session.mjs";
const clone = structuredClone;
const periodState = () => game.settings.get("spycraft2", "usagePeriods") ?? {};
export function getUsagePeriodReview() {
  const stored = game.settings.get("spycraft2", "usagePeriodReview");
  return stored?.needsReview ? stored : (game.spycraft2?.pendingUsagePeriodReview ?? stored ?? {});
}
const snapshot = (actor, field) => {
  const flags = actor.flags?.spycraft2 ?? {};
  return { present: Object.hasOwn(flags, field), value: Object.hasOwn(flags, field) ? clone(flags[field]) : null };
};
function flagPatch(actor, field, state) {
  if (!["sessionDiceReset", "startingDiceCreation"].includes(field))
    throw new Error(loc`Review the starting-dice record source.`);
  if (!state.present) return { ["flags.spycraft2.-=" + field]: null };
  const path = "flags.spycraft2." + field,
    patch = { [path]: clone(state.value) },
    current = actor.flags?.spycraft2?.[field];
  if (
    state.value &&
    typeof state.value === "object" &&
    !Array.isArray(state.value) &&
    current &&
    typeof current === "object"
  )
    for (const key of Object.keys(current)) if (!Object.hasOwn(state.value, key)) patch[path + ".-=" + key] = null;
  return patch;
}
const tracked = () => periodResourceActors();
const roster = actors => actors.map(a => a.uuid).sort();
const individualReview = actor =>
  getActionDieSettlementReview(actor).needsReview ||
  getRestraintReleaseReview(actor).needsReview ||
  getPendingRestraintMoves(actor).length > 0 ||
  getReserveReview(actor).needsReview ||
  getBaffledReview(actor).needsReview ||
  ["actionDieAwardReview", "actionDiceSettlementReview", "missionXPReview"].some(
    key => actor.flags?.spycraft2?.[key]?.needsReview
  );
/** The engine has already applied Fortune Favors the Bold to the prepared starting count and die. */
export function sessionGain(system, starting) {
  const die = system?.actionDice?.die;
  return { units: starting, die };
}
/** p.27: discard old ordinary dice and use starting counts. */
export function sessionDicePlan(actors) {
  return actors
    .filter(actor => actor.type === "agent")
    .map(actor => {
      let starting;
      try {
        starting = nextSessionStartingDice(actor.system);
      } catch (error) {
        throw new Error(loc`${actor.name}: review starting dice before starting a session. ${error.message}`);
      }
      const before = actor.system.actionDice?.value;
      if (!Number.isSafeInteger(starting) || starting < 0 || !Number.isSafeInteger(before) || before < 0)
        throw new Error(loc`${actor.name}: review the starting/current action-die count before starting a session.`);
      return {
        actor,
        before,
        // Fortune Favors the Bold (p.189) improves the dice gained at the start of each session.
        value: sessionGain(actor.system, starting).units,
        starting,
        crossroadsTitle: actor.system.crossroadsTitle ?? "",
        // Characters used to wait for a "Begin play" entry before their first session; none do now. A review saved
        // by an older version can still hold such an entry, so the review below keeps reading it.
        deferred: false,
        level: actor.system.level,
        die: actor.system.actionDice?.die ?? null
      };
    });
}
async function markReview(journal, error) {
  const review = { ...journal, needsReview: true, reason: error.message, at: Date.now() };
  game.spycraft2 ??= {};
  game.spycraft2.pendingUsagePeriodReview = review;
  try {
    await game.settings.set("spycraft2", "usagePeriodReview", review);
  } catch {}
  ui.notifications.warn(
    loc`The interrupted start needs GC review before further resource use. Review starting dice and counters.`
  );
  return review;
}
export async function startUsagePeriod(period) {
  if (!game.user?.isGM) throw new Error(loc`Only the GC can start a new usage period.`);
  if (!["scene", "session", "mission", "round"].includes(period)) throw new Error(loc`Unknown usage period.`);
  if (getUsagePeriodReview().needsReview)
    throw new Error(loc`Review the interrupted start before starting another scene or session.`);
  const actors = tracked(),
    expectedPeriods = clone(periodState()),
    expectedRoster = roster(actors);
  return queueResources(actors, () =>
    withGCPeriodLock(async () => {
      if (!game.user?.isGM) throw new Error(loc`Only the GC can start a new usage period.`);
      if (!same(periodState(), expectedPeriods) || !same(roster(tracked()), expectedRoster))
        throw new Error(
          loc`The counters or participating characters changed. Review the current state before starting again.`
        );
      if (actors.some(individualReview))
        throw new Error(loc`Resolve interrupted character resources before starting another period.`);
      const beforePeriods = clone(periodState()),
        id = foundry.utils.randomID(),
        afterPeriods = { ...beforePeriods, [period]: id };
      if (period === "mission") afterPeriods.missionCareerLevels = missionLevelSnapshot(actors, id);
      if (period === "scene") {
        const n = afterPeriods.sceneSequence ?? 0;
        if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(n + 1))
          throw new Error(loc`Review the scene sequence before starting a new scene.`);
        afterPeriods.sceneSequence = n + 1;
      }
      const plans = period === "session" ? sessionDicePlan(actors) : [],
        attempted = [],
        at = Date.now();
      for (const p of plans) {
        p.field = p.deferred ? "startingDiceCreation" : "sessionDiceReset";
        p.beforeRecord = snapshot(p.actor, p.field);
        p.record = p.deferred
          ? { ...p.beforeRecord.value, session: id }
          : {
              id,
              session: id,
              actorUuid: p.actor.uuid,
              value: p.value,
              previousSession: String(beforePeriods.session ?? "initial"),
              die: p.starting > 0 && p.die ? sessionGain(p.actor.system, p.starting).die : p.die,
              level: p.level ?? null,
              crossroadsTitle: p.crossroadsTitle,
              ...([...(p.actor.items ?? [])].some(i => i.system?.possessionSource === "favoredGear")
                ? { favoredGearPending: true }
                : {}),
              at
            };
      }
      const journal = {
        id,
        period,
        beforePeriods,
        afterPeriods,
        entries: plans.map(p => ({
          uuid: p.actor.uuid,
          name: p.actor.name,
          before: p.before,
          value: p.value,
          starting: p.starting,
          deferred: p.deferred,
          field: p.field,
          beforeRecord: p.beforeRecord,
          record: p.record
        }))
      };
      try {
        for (const p of plans) {
          if (
            p.actor.system.actionDice.value !== p.before ||
            nextSessionStartingDice(p.actor.system) !== p.starting ||
            (p.actor.system.crossroadsTitle ?? "") !== p.crossroadsTitle ||
            p.actor.system.level !== p.level ||
            !same(snapshot(p.actor, p.field), p.beforeRecord)
          )
            throw new Error(loc`${p.actor.name}: starting dice changed during preparation.`);
          attempted.push(p);
          try {
            await p.actor.update({
              "system.actionDice.value": p.value,
              ...flagPatch(p.actor, p.field, { present: true, value: p.record })
            });
          } catch (error) {
            if (
              p.actor.system.actionDice.value !== p.value ||
              !same(snapshot(p.actor, p.field), { present: true, value: p.record })
            )
              throw error;
          }
        }
        if (
          !same(periodState(), beforePeriods) ||
          plans.some(
            p =>
              nextSessionStartingDice(p.actor.system) !== p.starting ||
              (p.actor.system.crossroadsTitle ?? "") !== p.crossroadsTitle ||
              p.actor.system.level !== p.level
          )
        )
          throw new Error(loc`Starting counts or counters changed during the start.`);
        try {
          await game.settings.set("spycraft2", "usagePeriods", afterPeriods);
        } catch (error) {
          if (!same(periodState(), afterPeriods)) throw error;
        }
      } catch (error) {
        const failures = [];
        for (const p of attempted.reverse()) {
          const current = snapshot(p.actor, p.field);
          if (same(current, p.beforeRecord)) continue;
          if (!same(current, { present: true, value: p.record })) {
            failures.push(new Error(loc`${p.actor.name}: the starting-dice record changed again.`));
            continue;
          }
          const restored = p.actor.system.actionDice.value + p.before - p.value;
          if (!Number.isSafeInteger(restored) || restored < 0) {
            failures.push(new Error(loc`${p.actor.name}: later dice changes need review.`));
            continue;
          }
          try {
            await p.actor.update({
              "system.actionDice.value": restored,
              ...flagPatch(p.actor, p.field, p.beforeRecord)
            });
          } catch (rollback) {
            if (p.actor.system.actionDice.value !== restored || !same(snapshot(p.actor, p.field), p.beforeRecord))
              failures.push(rollback);
          }
        }
        if (failures.length || !same(periodState(), beforePeriods))
          await markReview(
            journal,
            new AggregateError([error, ...failures], loc`Starting dice or counters could not be safely restored.`)
          );
        throw error;
      }
      for (const actor of actors)
        try {
          renderOpenSheet(actor);
        } catch {
          ui.notifications.warn(
            loc`The new period is already recorded. Reopen a character sheet if it did not refresh.`
          );
        }
      return afterPeriods;
    })
  );
}
/**
 * What taking back a "Next scene" would write, or the reason it cannot be taken back. Pure, so it can be tested.
 * @param {object} periods  the stored usage periods now
 * @param {object} change   { before: {scene, sceneSequence}, after: scene id the step set }
 */
export function scenePeriodRevert(periods = {}, change = {}) {
  if (!change?.after || String(periods?.scene ?? "initial") !== String(change.after))
    return { reason: loc`A later scene has begun since, so that Next scene can no longer be taken back.` };
  const target = { ...periods };
  if (change.before?.scene === undefined || change.before.scene === null) delete target.scene;
  else target.scene = change.before.scene;
  if (Number.isSafeInteger(change.before?.sceneSequence)) target.sceneSequence = change.before.sceneSequence;
  else delete target.sceneSequence;
  return { target };
}
/** Take back a "Next scene": the scene period returns to the scene before it, so that scene's records read again. */
export async function revertScenePeriod(change) {
  if (!game.user?.isGM) throw new Error(loc`Only the GC can start a new usage period.`);
  if (getUsagePeriodReview().needsReview)
    throw new Error(loc`Review the interrupted start before starting another scene or session.`);
  const actors = tracked();
  return queueResources(actors, () =>
    withGCPeriodLock(async () => {
      const { target, reason } = scenePeriodRevert(periodState(), change);
      if (reason) throw new Error(reason);
      try {
        await game.settings.set("spycraft2", "usagePeriods", target);
      } catch (error) {
        if (!same(periodState(), target)) throw error;
      }
      refreshUsagePeriodActors();
      return target;
    })
  );
}
export async function reviewUsagePeriod(options = {}) {
  if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted start.`);
  const saved = clone(getUsagePeriodReview());
  if (!saved.needsReview) return null;
  if (
    !["scene", "session", "mission", "round"].includes(saved.period) ||
    typeof saved.id !== "string" ||
    saved.afterPeriods?.[saved.period] !== saved.id ||
    !saved.beforePeriods ||
    !Array.isArray(saved.entries) ||
    new Set(saved.entries.map(e => e.uuid)).size !== saved.entries.length ||
    saved.entries.some(
      e =>
        e.field !== (e.deferred ? "startingDiceCreation" : "sessionDiceReset") ||
        !e.beforeRecord ||
        typeof e.beforeRecord.present !== "boolean" ||
        !e.record ||
        typeof e.record !== "object" ||
        !Number.isSafeInteger(e.before) ||
        e.before < 0 ||
        !Number.isSafeInteger(e.value) ||
        e.value < 0 ||
        !Number.isSafeInteger(e.starting) ||
        e.starting < 0
    )
  )
    throw new Error(loc`Review the saved starting-dice sources.`);
  const actors = tracked(),
    agents = actors.filter(a => a.type === "agent").sort((a, b) => a.uuid.localeCompare(b.uuid)),
    byId = new Map(agents.map(a => [a.uuid, a])),
    known = new Map(saved.entries.map(e => [e.uuid, e])),
    missing = saved.entries.filter(e => !byId.has(e.uuid));
  const rows =
    saved.period === "session"
      ? agents.map(actor => ({
          actor,
          entry: known.get(actor.uuid) ?? null,
          creation: actor.flags?.spycraft2?.startingDiceCreation ?? null
        }))
      : [];
  const state = () =>
      JSON.stringify({
        review: getUsagePeriodReview(),
        periods: periodState(),
        actors: tracked()
          .map(a => ({
            uuid: a.uuid,
            type: a.type,
            name: a.name,
            dice: a.system.actionDice?.value,
            starting: a.system.actionDice?.max,
            creation: snapshot(a, "startingDiceCreation"),
            reset: snapshot(a, "sessionDiceReset")
          }))
          .sort((a, b) => a.uuid.localeCompare(b.uuid))
      }),
    expected = state();
  let input = options;
  if (input.confirmed === undefined) {
    const esc = foundry.utils.escapeHTML;
    const rowHTML = rows
      .map((r, i) => {
        const a = r.actor,
          entry = r.entry,
          optional = !!entry?.deferred,
          entered = r.creation?.claimed === true || a.system.actionDice.value > 0;
        return (
          "<p><b>" +
          esc(a.name) +
          "</b> — " +
          (entry ? "before " + entry.before : loc`added during the interrupted start`) +
          "; starting " +
          a.system.actionDice.max +
          "; now " +
          a.system.actionDice.value +
          `.</p><label>${loc`Confirmed current dice`} <input name="dice_` +
          i +
          loc`" type="number" min="0" step="1" value="` +
          a.system.actionDice.value +
          '" /></label>' +
          (optional
            ? '<label><input name="entered_' +
              i +
              '" type="checkbox" ' +
              (entered ? "checked" : "") +
              ` ${loc`/> This character has entered play with starting dice`}</label>`
            : "")
        );
      })
      .join("");
    const content =
      '<div class="spycraft2-roll-options"><p>' +
      esc(saved.reason ?? loc`Interrupted start`) +
      `</p><p>${loc`A new session discards old ordinary dice. Account for starting pools and any later changes. This review sets confirmed balances and counters; it does not add dice.`}</p><label>${loc`Counters`} <select name="mode"><option value="new">${loc`Retain the requested new start`}</option><option value="old">${loc`Cancel it and restore previous counters`}</option><option value="current">${loc`Keep the currently recorded counters`}</option></select></label>` +
      rowHTML +
      (missing.length
        ? `<p>${loc`Missing participants:`} ` +
          missing.map(e => esc(e.name)).join(", ") +
          `.</p><label><input name="missingReviewed" type="checkbox" /> ${loc`The GC confirms these participants were removed from play`}</label>`
        : "") +
      `<label>${loc`Resolution`} <input name="resolution" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC reviewed actual starting dice, counters and actions during the interruption`}</label></div>`;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review interrupted start` },
      rejectClose: false,
      content
    });
    if (!input) return null;
  }
  return queueResources(
    actors,
    () =>
      withGCPeriodLock(async () => {
        if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted start.`);
        if (state() !== expected)
          throw new Error(loc`Starting dice, characters or counters changed. Review the current state again.`);
        const mode = input.mode ?? (typeof input.keepStart === "boolean" ? (input.keepStart ? "new" : "old") : null);
        if (
          input.confirmed !== true ||
          !["new", "old", "current"].includes(mode) ||
          typeof input.resolution !== "string" ||
          !input.resolution.trim() ||
          (missing.length && input.missingReviewed !== true)
        )
          throw new Error(loc`Confirm the counter choice, actual balances, missing participants and resolution.`);
        const target = clone(
            mode === "new" ? saved.afterPeriods : mode === "old" ? saved.beforePeriods : periodState()
          ),
          session = String(target.session ?? "initial");
        const writes = rows.map((r, i) => {
          const raw = Array.isArray(input.balances)
              ? input.balances[i]
              : (input.balances?.[r.actor.uuid] ?? input["dice_" + i]),
            balance = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
          if (!Number.isSafeInteger(balance) || balance < 0)
            throw new Error(loc`Confirm a whole nonnegative balance for ` + r.actor.name + ".");
          const optional = !!r.entry?.deferred,
            entered = optional ? (input.entered?.[r.actor.uuid] ?? input["entered_" + i] === true) : true,
            patch = { "system.actionDice.value": balance };
          if (typeof entered !== "boolean") throw new Error(loc`Confirm whether ${r.actor.name} has entered play.`);
          const knownCreation = r.creation ?? (r.entry?.deferred ? r.entry.beforeRecord.value : null);
          if (optional && !entered) {
            if (
              balance !== 0 ||
              r.actor.system.actionDice.value !== 0 ||
              !knownCreation ||
              knownCreation.claimed !== false
            )
              throw new Error(loc`Account for ${r.actor.name} entering play before retaining a dice balance.`);
            Object.assign(
              patch,
              flagPatch(r.actor, "startingDiceCreation", { present: true, value: { ...knownCreation, session } })
            );
          } else if (r.entry?.deferred) {
            const creation = {
              ...knownCreation,
              session,
              claimed: true,
              starting: knownCreation?.claimed ? knownCreation.starting : r.actor.system.actionDice.max,
              die: knownCreation?.claimed ? knownCreation.die : r.actor.system.actionDice.die,
              receiptId: knownCreation?.receiptId ?? foundry.utils.randomID(),
              claimedAt: knownCreation?.claimedAt ?? Date.now()
            };
            Object.assign(patch, flagPatch(r.actor, "startingDiceCreation", { present: true, value: creation }));
          } else if (mode === "old" && r.entry) {
            const initial = r.creation?.claimed === false && !r.entry.beforeRecord.present && balance > 0;
            Object.assign(
              patch,
              flagPatch(
                r.actor,
                "sessionDiceReset",
                initial
                  ? {
                      present: true,
                      value: {
                        id: session,
                        session,
                        actorUuid: r.actor.uuid,
                        value: r.actor.system.actionDice.max,
                        reviewedStart: saved.id
                      }
                    }
                  : r.entry.beforeRecord
              )
            );
          } else {
            const current = r.actor.flags?.spycraft2?.sessionDiceReset,
              known =
                mode === "new" && r.entry
                  ? r.entry.record
                  : current?.session === session
                    ? current
                    : r.entry?.record?.session === session
                      ? r.entry.record
                      : r.entry?.beforeRecord?.value?.session === session
                        ? r.entry.beforeRecord.value
                        : null;
            Object.assign(
              patch,
              flagPatch(r.actor, "sessionDiceReset", {
                present: true,
                value: {
                  ...(known ?? {}),
                  id: session,
                  session,
                  actorUuid: r.actor.uuid,
                  value: known?.value ?? (!r.entry ? r.actor.system.actionDice.max : null),
                  confirmedBalance: balance,
                  reviewedStart: saved.id
                }
              })
            );
          }
          return { actor: r.actor, patch };
        });
        for (const w of writes) await w.actor.update(w.patch);
        try {
          await game.settings.set("spycraft2", "usagePeriods", target);
        } catch (error) {
          if (!same(periodState(), target)) throw error;
        }
        const completed = {
          ...saved,
          needsReview: false,
          mode,
          resolution: input.resolution.trim(),
          reviewedBy: game.user.id ?? "GC",
          resolvedAt: Date.now(),
          settledPeriods: target,
          settledBalances: rows.map((r, i) => ({
            uuid: r.actor.uuid,
            value: writes[i].patch["system.actionDice.value"]
          })),
          removedParticipants: missing.map(e => e.uuid)
        };
        try {
          await game.settings.set("spycraft2", "usagePeriodReview", completed);
        } catch (error) {
          if (!same(game.settings.get("spycraft2", "usagePeriodReview"), completed)) throw error;
        }
        if (game.spycraft2) delete game.spycraft2.pendingUsagePeriodReview;
        refreshUsagePeriodActors();
        return completed;
      }),
    { allowPeriodReview: true }
  );
}

/** Refresh linked and unlinked actors when an epoch changes on any client. */
export function refreshUsagePeriodActors() {
  for (const actor of periodRefreshActors())
    try {
      actor.reset?.();
      renderOpenSheet(actor);
    } catch (error) {
      globalThis.ui?.notifications?.warn(loc`Usage periods changed. Reopen any character sheet that did not refresh.`);
    }
}
