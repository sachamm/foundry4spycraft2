/**
 * The game clock: what time it is, the GC moving it on, timers that anyone can set, and conditions that end by it.
 * It is built on Foundry's own timekeeping wherever Foundry has the piece:
 *
 *  - World time is `game.time`, moved with `game.time.advance`. A combat round adds 6 seconds through
 *    `CONFIG.time.roundTime` (world setting "Advance the clock each combat round").
 *  - Dates come from the world calendar (`game.time.calendar`), written by a formatter registered in
 *    `CONFIG.time.formatters`. The one piece of our own is an offset between world time and the date shown, so the
 *    GC can name the date without time passing: Foundry can only set a date by moving world time, which would end
 *    every running timer and onset.
 *  - A timer on a character is an Active Effect with a duration. Foundry counts it down in combat rounds or game
 *    time, shows the time left and marks it expired; this module adds the notice to the user who set it. A user
 *    with no character keeps timers on his own user (`flags.spycraft2.timers`) instead, checked by his own client.
 *  - A condition with a time limit is likewise an effect with a duration (`flags.spycraft2.timed`). When Foundry
 *    expires it the active GC's client lifts it.
 *
 * The rules are in module/rules/timers.mjs.
 */
import { readSetting } from "../settings.mjs";
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import {
  ROUND_SECONDS,
  TIME_UNITS,
  createTimer,
  dueTimers,
  durationLabel,
  effectDuration,
  elapsedClock,
  expiredConditionAction,
  extendTimer,
  markNotified,
  removeTimer,
  timerStatus,
  unitLabel,
  unitSeconds,
  validTimers
} from "../rules/timers.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc, locKey } from "../i18n.mjs";
import { periodMoneyModifier, setCampaignYearSource } from "../rules/period-money.mjs";

const pad = n => String(n).padStart(2, "0");
const now = () => Math.max(0, Math.floor(Number(game.time?.worldTime) || 0));
const setting = key => {
  return readSetting(key, undefined);
};

/* -------------------------------------------- */
/*  What time it is                              */
/* -------------------------------------------- */

/** The offset between world time and the date shown, or null while the GC has set no date. */
export function clockEpoch() {
  const epoch = setting("clock")?.epoch;
  return Number.isSafeInteger(epoch) ? epoch : null;
}

/** The year the clock shows, or null while the GC has set no date. The gear browser hides gear newer than this. */
export function clockYear(time = now()) {
  const epoch = clockEpoch(),
    calendar = game.time?.calendar;
  if (epoch === null || typeof calendar?.timeToComponents !== "function") return null;
  const year = calendar.timeToComponents(time + epoch)?.year;
  return Number.isSafeInteger(year) ? year : null;
}

/** Players see the clock unless the GC hides it; their timers show time left either way. */
// Money under the Historical quality follows the year the clock shows (Table 7.4).
setCampaignYearSource(() => clockYear());

export const clockVisible = () => game.user?.isGM === true || setting("clockVisibleToPlayers") !== false;

/** A world time as the table reads it: a date when the GC has set one, a day count otherwise. */
export function clockLabel(time = now()) {
  const epoch = clockEpoch(),
    calendar = game.time?.calendar;
  if (epoch === null || !calendar) {
    const e = elapsedClock(time);
    return loc`Day ${e.day}, ${showSeconds() ? e.clock : `${pad(e.hour)}:${pad(e.minute)}`}`;
  }
  return calendar.format(time + epoch, CLOCK_FORMATTER);
}

const CLOCK_FORMATTER = "spycraft2Clock";
/** Seconds only matter while combat rounds are moving the clock in 6-second steps. */
const showSeconds = () => globalThis.game?.combat?.started === true;
/** A date and time in words, for `CONFIG.time.formatters`: "Thursday 18 November 2026, 09:30" (seconds in combat). */
function formatClock(calendar, c) {
  const month = calendar.months?.values?.[c.month],
    weekday = calendar.days?.values?.[c.dayOfWeek];
  const name = entry => (entry?.name ? game.i18n.localize(entry.name) : "");
  return loc`${name(weekday)} ${c.dayOfMonth + 1} ${name(month)} ${c.year}, ${pad(c.hour)}:${pad(c.minute)}${showSeconds() ? `:${pad(c.second)}` : ""}`;
}

/** Move the clock on (or back, with a negative amount). GC only. */
export async function advanceClock(seconds) {
  if (!game.user.isGM) return refuse(loc`Only the GC moves the game clock.`);
  const amount = Math.trunc(Number(seconds) || 0);
  if (!amount) return null;
  if (now() + amount < 0) return refuse(loc`The clock cannot go back past its start.`);
  await game.time.advance(amount);
  return now();
}

const unitOptions = chosen =>
  Object.keys(TIME_UNITS)
    .map(unit => `<option value="${unit}"${unit === chosen ? " selected" : ""}>${esc(unitLabel(unit))}</option>`)
    .join("");

/** Ask the GC how far to move the clock. */
export async function advanceClockDialog() {
  if (!game.user.isGM) return refuse(loc`Only the GC moves the game clock.`);
  const input = await systemDialog.input({
    window: { title: loc`Move the clock` },
    rejectClose: false,
    ok: { label: loc`Move` },
    content: `<div class="spycraft2-roll-options"><p>${loc`Now: ${esc(clockLabel())}`}</p><label>${loc`Amount`} <input type="number" name="count" min="1" step="1" value="1" required /></label><label>${loc`Unit`} <select name="unit">${unitOptions("hour")}</select></label><label><input type="checkbox" name="back" /> ${loc`Move the clock back instead`}</label><p class="hint">${loc`Timers, onset times and conditions with an end time follow the clock. Moving it back does not restore anything that already ended.`}</p></div>`
  });
  if (!input) return null;
  let seconds;
  try {
    seconds = unitSeconds(Number(input.count), input.unit);
  } catch (error) {
    return refuse(error.message);
  }
  return advanceClock(input.back === true ? -seconds : seconds);
}

/** Days before a month in a year of the world calendar. */
function daysBefore(calendar, year, monthIndex) {
  const leap = calendar.isLeapYear?.(year) === true;
  return calendar.months.values
    .slice(0, monthIndex)
    .reduce((sum, month) => sum + (leap ? (month.leapDays ?? month.days) : month.days), 0);
}

/** Choose the date and time the clock shows now. Only the display changes: world time stays where it is. */
export async function setClockDateDialog() {
  if (!game.user.isGM) return refuse(loc`Only the GC sets the date.`);
  const calendar = game.time.calendar,
    epoch = clockEpoch(),
    real = new Date(),
    shown =
      epoch === null
        ? { year: real.getFullYear(), month: real.getMonth(), dayOfMonth: real.getDate() - 1, hour: 8, minute: 0 }
        : calendar.timeToComponents(now() + epoch);
  const months = calendar.months.values
    .map(
      (month, index) =>
        `<option value="${index}"${index === shown.month ? " selected" : ""}>${esc(game.i18n.localize(month.name))}</option>`
    )
    .join("");
  const input = await systemDialog.input({
    window: { title: loc`Set the date and time` },
    rejectClose: false,
    ok: { label: loc`Set` },
    content: `<div class="spycraft2-roll-options"><label>${loc`Year`} <input type="number" name="year" min="1" step="1" value="${shown.year}" required /></label><label>${loc`Month`} <select name="month">${months}</select></label><label>${loc`Day`} <input type="number" name="day" min="1" max="31" step="1" value="${shown.dayOfMonth + 1}" required /></label><label>${loc`Hour (0–23)`} <input type="number" name="hour" min="0" max="23" step="1" value="${shown.hour}" required /></label><label>${loc`Minute`} <input type="number" name="minute" min="0" max="59" step="1" value="${shown.minute}" required /></label><label><input type="checkbox" name="clear" /> ${loc`Show a day count instead of a date`}</label><p class="hint">${loc`This names the present moment. No time passes, so timers and onset times are untouched.`}</p></div>`
  });
  if (!input) return null;
  if (input.clear === true) {
    await game.settings.set("spycraft2", "clock", { epoch: null });
    return null;
  }
  const year = Number(input.year),
    month = Number(input.month),
    day = Number(input.day),
    hour = Number(input.hour),
    minute = Number(input.minute),
    listed = calendar.months.values[month];
  const length = listed ? (calendar.isLeapYear?.(year) ? (listed.leapDays ?? listed.days) : listed.days) : 0;
  if (
    ![year, day, hour, minute].every(Number.isSafeInteger) ||
    year < 1 ||
    !listed ||
    day < 1 ||
    day > length ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  )
    return refuse(loc`Enter a date that exists and a time of day.`);
  const second = now() % 60,
    target = calendar.componentsToTime({
      year,
      day: daysBefore(calendar, year, month) + day - 1,
      hour,
      minute,
      second
    });
  await game.settings.set("spycraft2", "clock", { epoch: target - now() });
  return target;
}

/* -------------------------------------------- */
/*  Timers                                       */
/* -------------------------------------------- */

const TIMER_ICON = "icons/svg/clockwork.svg";
const timerFlag = effect => effect?.flags?.spycraft2?.timer ?? null;

/** World actors, and the unlinked tokens of the scenes in use. */
function clockActors() {
  const actors = [...(game.actors ?? [])];
  for (const scene of game.scenes ?? []) {
    if (!scene.active && !scene.isView) continue;
    for (const token of scene.tokens ?? []) if (!token.actorLink && token.actor) actors.push(token.actor);
  }
  return actors;
}

/** Characters this user can keep a timer on, the likeliest first: [{ uuid, name }]. */
export function timerHolders() {
  const found = new Map();
  const add = actor => {
    if (actor?.isOwner && ["agent", "npc"].includes(actor.type) && !found.has(actor.uuid))
      found.set(actor.uuid, { uuid: actor.uuid, name: actor.name });
  };
  add(game.user.character);
  for (const token of globalThis.canvas?.tokens?.controlled ?? []) add(token.actor);
  // A player's own few characters; the GC owns everyone, so only the ones picked out above are offered to him.
  if (!game.user.isGM) for (const actor of game.actors ?? []) add(actor);
  return [...found.values()];
}

/** A timer kept on a character: an Active Effect whose duration Foundry counts down. */
function effectTimerRow(effect, { own }) {
  const duration = effect.duration ?? {},
    expired = duration.expired === true || duration.remaining <= 0,
    total = Number(duration.seconds),
    left = Number(duration.secondsRemaining);
  return {
    id: effect.uuid,
    kind: "effect",
    label: effect.name,
    holder: effect.actor?.name ?? "",
    owner: own ? "" : (game.users.get(timerFlag(effect)?.userId)?.name ?? ""),
    own,
    expired,
    status: expired ? loc`Done` : loc`${duration.label} left`,
    fraction: expired ? 1 : total > 0 && Number.isFinite(left) ? Math.min(1, Math.max(0, 1 - left / total)) : 0,
    order: expired ? -1 : Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER,
    units: duration.units
  };
}

/** A user's personal timers: the ones not kept on any character. */
export const timersOf = (user = game.user) => validTimers(user?.flags?.spycraft2?.timers);

function personalTimerRow(timer, { own, owner = "" }) {
  const status = timerStatus(timer, now());
  return {
    id: timer.id,
    kind: "personal",
    label: timer.label,
    holder: "",
    owner,
    own,
    expired: status.expired,
    status: status.label,
    fraction: status.fraction,
    order: status.expired ? -1 : status.seconds,
    units: timer.unit
  };
}

/** Every timer this user set, soonest first. */
export function myTimers() {
  const rows = timersOf().map(timer => personalTimerRow(timer, { own: true }));
  for (const actor of clockActors())
    for (const effect of actor.effects ?? [])
      if (timerFlag(effect)?.userId === game.user.id) rows.push(effectTimerRow(effect, { own: true }));
  return rows.sort((a, b) => a.order - b.order);
}

/** Timers other users have chosen to show everyone. */
export function sharedTimers() {
  const rows = [];
  for (const user of game.users ?? [])
    if (user.id !== game.user.id)
      for (const timer of timersOf(user))
        if (timer.shared) rows.push(personalTimerRow(timer, { own: false, owner: user.name }));
  for (const actor of clockActors())
    for (const effect of actor.effects ?? []) {
      const flag = timerFlag(effect);
      if (flag?.shared && flag.userId !== game.user.id) rows.push(effectTimerRow(effect, { own: false }));
    }
  return rows.sort((a, b) => a.order - b.order);
}

// A user's writes to his own flags follow one another, so two changes made in quick succession cannot drop one.
let writing = Promise.resolve();
function changeTimers(change) {
  const run = async () => {
    const next = change(timersOf());
    if (next) await game.user.setFlag("spycraft2", "timers", next);
    return next;
  };
  writing = writing.then(run, run);
  return writing;
}

/**
 * Start a timer for the current user. With a character it is an Active Effect on that character, whose duration
 * Foundry counts down in rounds or time and expires itself; without one it is kept on the user.
 * @param {object} input { label, count, unit, shared, actorUuid }
 */
export async function addTimer(input = {}) {
  const count = Number(input.count),
    unit = input.unit ?? "round",
    shared = input.shared === true;
  try {
    const holder = input.actorUuid ? await fromUuid(input.actorUuid) : null;
    if (holder) {
      if (!holder.isOwner) throw new Error(loc`You can keep a timer only on a character you own.`);
      const label =
        String(input.label ?? "")
          .trim()
          .slice(0, 120) || loc`Timer`;
      const show = globalThis.CONST?.ACTIVE_EFFECT_SHOW_ICON ?? {};
      const [effect] = await holder.createEmbeddedDocuments("ActiveEffect", [
        {
          name: label,
          img: TIMER_ICON,
          // No expiry event: the timer ends as soon as its duration has run, in or out of combat.
          duration: { ...effectDuration(count, unit), expiry: null },
          // A private timer puts no icon on the token for others to see.
          showIcon: shared ? (show.CONDITIONAL ?? 1) : (show.NEVER ?? 0),
          flags: { spycraft2: { timer: { userId: game.user.id, shared, notified: false } } }
        }
      ]);
      return effect ?? null;
    }
    const timer = createTimer({ label: input.label, count, unit, shared, id: foundry.utils.randomID() }, now());
    await changeTimers(list => [...list, timer]);
    return timer;
  } catch (error) {
    ui.notifications.warn(error.message);
    return null;
  }
}

/** Remove one of the current user's timers by the id its row carries. */
export async function deleteTimer(id) {
  const effect = String(id).includes(".") ? await fromUuid(id) : null;
  if (effect) return timerFlag(effect) && effect.isOwner ? effect.delete() : null;
  return changeTimers(list => removeTimer(list, id));
}

/** Add time to a running or finished timer. A timer on a character takes it in the unit it was set in. */
export async function extendTimerBy(id, count, unit) {
  const amount = Number(count),
    effect = String(id).includes(".") ? await fromUuid(id) : null;
  if (effect) {
    if (!timerFlag(effect) || !effect.isOwner || !Number.isSafeInteger(amount) || amount < 1)
      return refuse(loc`Enter a whole amount of time, 1 or more.`);
    return effect.update({
      "duration.value": (Number(effect._source.duration.value) || 0) + amount,
      "duration.expired": false,
      "flags.spycraft2.timer.notified": false
    });
  }
  try {
    unitSeconds(Math.abs(amount), unit);
  } catch (error) {
    return refuse(error.message);
  }
  return changeTimers(list => extendTimer(list, id, amount, unit));
}

const holderOptions = chosen => {
  const holders = timerHolders(),
    selected = chosen ?? holders[0]?.uuid ?? "";
  return `${holders
    .map(
      holder =>
        `<option value="${esc(holder.uuid)}"${holder.uuid === selected ? " selected" : ""}>${esc(holder.name)}</option>`
    )
    .join("")}<option value=""${selected ? "" : " selected"}>${loc`No character`}</option>`;
};

/** Ask for a timer's name and length. Rounds are offered first. */
export async function addTimerDialog(preset = {}) {
  const input = await systemDialog.input({
    window: { title: loc`New timer` },
    rejectClose: false,
    ok: { label: loc`Start` },
    content: `<div class="spycraft2-roll-options"><label>${loc`What it is for`} <input type="text" name="label" maxlength="120" value="${esc(preset.label ?? "")}" autofocus /></label><label>${loc`Length`} <input type="number" name="count" min="1" step="1" value="${Number(preset.count) || 1}" required /></label><label>${loc`Unit`} <select name="unit">${unitOptions(preset.unit ?? "round")}</select></label><label>${loc`Kept on`} <select name="actorUuid">${holderOptions(preset.actorUuid)}</select></label><label><input type="checkbox" name="shared" /> ${loc`Show this timer to everyone at the table`}</label><p class="hint">${loc`A timer on a character is one of its effects: it counts combat rounds while the character is in a fight and game time otherwise. A round is ${ROUND_SECONDS} seconds. You are told when it ends.`}</p></div>`
  });
  return input ? addTimer(input) : null;
}

function announce({ label, shared, length }) {
  ui.notifications.info(loc`Timer ended: ${label}`, { permanent: true });
  try {
    foundry.audio.AudioHelper.play({ src: "sounds/notify.wav", volume: 0.8, autoplay: true, loop: false }, false);
  } catch {
    /* no sound is not a reason to lose the notice */
  }
  return ChatMessage.create({
    speaker: { alias: loc`Game clock` },
    ...(shared ? {} : { whisper: [game.user.id] }),
    content: `<div class="spycraft2 chat-note sc2-timer-ended"><p><b>${loc`Timer ended: ${esc(label)}`}</b></p><p>${length ? loc`Set by ${esc(game.user.name)} for ${esc(length)}. It is now ${esc(clockLabel())}.` : loc`Set by ${esc(game.user.name)}. It is now ${esc(clockLabel())}.`}</p></div>`
  });
}

const announcing = new Set();
/** Tell the user who set a timer on a character that Foundry has expired it. */
async function announceEffectTimer(effect) {
  const flag = timerFlag(effect);
  if (!flag || flag.userId !== game.user.id || flag.notified || announcing.has(effect.uuid)) return;
  announcing.add(effect.uuid);
  try {
    const source = effect._source.duration ?? {};
    await announce({
      label: effect.actor ? loc`${effect.name} (${effect.actor.name})` : effect.name,
      shared: flag.shared === true,
      length: Number.isFinite(source.value)
        ? `${source.value} ${source.value === 1 ? String(source.units).replace(/s$/, "") : source.units}`
        : ""
    });
    if (effect.isOwner) await effect.update({ "flags.spycraft2.timer.notified": true });
  } catch (error) {
    console.error(error);
  } finally {
    announcing.delete(effect.uuid);
  }
}

/** Tell the current user about each of his timers that has ended, including any that ended while he was away. */
export function checkTimers() {
  for (const actor of clockActors())
    for (const effect of actor.effects ?? [])
      if (timerFlag(effect) && effect.duration?.expired === true) announceEffectTimer(effect);
  return changeTimers(list => {
    const due = dueTimers(list, now());
    if (!due.length) return null;
    for (const timer of due)
      announce({ label: timer.label, shared: timer.shared, length: durationLabel(timer.end - timer.start) }).catch(
        error => console.error(error)
      );
    return markNotified(
      list,
      due.map(t => t.id)
    );
  });
}

/* -------------------------------------------- */
/*  Conditions with a time limit                 */
/* -------------------------------------------- */

const isTimedCondition = effect => effect?.flags?.spycraft2?.timed === true;

/** Conditions with time left on the characters this user owns, soonest first. */
export function timedConditionRows() {
  const rows = [];
  for (const actor of clockActors()) {
    if (!actor.isOwner) continue;
    for (const effect of actor.effects ?? []) {
      if (!isTimedCondition(effect) || !Number.isFinite(effect.duration?.value) || effect.duration.expired) continue;
      rows.push({
        actor: actor.name,
        name: effect.name,
        label: effect.duration.label,
        order: Number(effect.duration.secondsRemaining) || 0
      });
    }
  }
  return rows.sort((a, b) => a.order - b.order);
}

const lifting = new Set();
/**
 * Foundry has marked a timed condition expired: lift it and say so. Only the active GC's client does the work.
 * An unconscious character at 0 wounds or fewer keeps the condition, now without a time limit.
 */
export async function liftExpiredCondition(effect) {
  if (!isTimedCondition(effect) || game.users?.activeGM?.isSelf !== true || lifting.has(effect.uuid)) return;
  const actor = effect.actor;
  if (!actor) return;
  lifting.add(effect.uuid);
  try {
    const action = expiredConditionAction({
      statuses: [...(effect.statuses ?? [])],
      wounds: actor.system?.wounds?.value ?? null,
      special: Number(actor.system?.wounds?.max) > 0
    });
    if (action === "keep")
      await effect.update({ duration: { value: null, expiry: null, expired: false }, "flags.spycraft2.-=timed": null });
    else {
      const name = effect.name;
      await effect.delete();
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="spycraft2 chat-note"><p>${loc`${esc(actor.name)}: ${esc(name)} has run its time and ends.`}</p></div>`
      });
    }
  } catch (error) {
    console.error(loc`Field Agent's Handbook | Could not end a timed condition`, error);
  } finally {
    lifting.delete(effect.uuid);
  }
}

/** Lift any timed condition Foundry expired while no hook was listening (a reload, a GC who joined later). */
export function sweepTimedConditions() {
  if (game.users?.activeGM?.isSelf !== true) return;
  for (const actor of clockActors())
    for (const effect of actor.effects ?? [])
      if (isTimedCondition(effect) && effect.duration?.expired === true) liftExpiredCondition(effect);
}

/* -------------------------------------------- */
/*  Onset times the clock has reached            */
/* -------------------------------------------- */

const announcedOnsets = new Set();
/** Tell a character's owner, once, when a contagion's next save has come due. */
export function announceDueHazards() {
  for (const actor of clockActors()) {
    if (!actor.isOwner) continue;
    for (const entry of Object.values(actor.system?.hazards?.contagions ?? {})) {
      if (!Number.isFinite(entry?.dueAt) || entry.dueAt > now()) continue;
      const key = `${actor.uuid}:${entry.id}:${entry.dueAt}`;
      if (announcedOnsets.has(key)) continue;
      announcedOnsets.add(key);
      ui.notifications.info(loc`${actor.name}: a save against ${entry.label ?? loc`a contagion`} is due.`);
    }
  }
}

/* -------------------------------------------- */
/*  The Clock window                             */
/* -------------------------------------------- */

const STEPS = [
  [ROUND_SECONDS, () => loc`+1 round`],
  [60, () => loc`+1 min`],
  [600, () => loc`+10 min`],
  [3600, () => loc`+1 hour`],
  [28800, () => loc`+8 hours`],
  [86400, () => loc`+1 day`]
];

/** The quick steps the GC can move the clock by: [{ seconds, label }]. */
export const clockSteps = () => STEPS.map(([seconds, label]) => ({ seconds, label: label() }));

function timerRow(row) {
  return `<li class="sc2-timer${row.expired ? " done" : ""}"><div class="sc2-timer-line"><b>${esc(row.label)}</b>${row.holder ? ` <span class="muted">${esc(row.holder)}</span>` : ""}${row.owner ? ` <span class="muted">(${esc(row.owner)})</span>` : ""}<span class="sc2-timer-left">${esc(row.status)}</span></div><progress max="1" value="${row.fraction}"></progress>${
    row.own
      ? `<div class="sc2-timer-controls"><button type="button" data-action="extendTimer" data-id="${esc(row.id)}" data-kind="${row.kind}" data-units="${esc(row.units ?? "")}">${loc`Add time`}</button><button type="button" data-action="deleteTimer" data-id="${esc(row.id)}">${loc`Remove`}</button></div>`
      : ""
  }</li>`;
}

let GameClock = null;
/** The Clock window's class, made on first use so this module loads without Foundry's application classes. */
function clockClass() {
  if (GameClock) return GameClock;
  GameClock = class GameClock extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "spycraft2-game-clock",
      classes: ["spycraft2", "sc2-game-clock"],
      position: { width: 380, height: "auto" },
      window: {
        get title() {
          return loc`Clock and timers`;
        },
        icon: "fa-solid fa-clock",
        resizable: true
      },
      actions: {
        step: (event, target) => advanceClock(Number(target.dataset.seconds)),
        advance: () => advanceClockDialog(),
        setDate: () => setClockDateDialog(),
        newTimer: () => addTimerDialog(),
        quickTimer: async (event, target) => {
          const root = target.closest(".sc2-game-clock-body"),
            label = root.querySelector("[name=label]");
          const timer = await addTimer({
            label: label?.value,
            count: root.querySelector("[name=count]")?.value,
            unit: root.querySelector("[name=unit]")?.value,
            actorUuid: root.querySelector("[name=actorUuid]")?.value,
            shared: root.querySelector("[name=shared]")?.checked === true
          });
          // Started: empty the name so the next timer does not inherit it.
          if (timer && label) label.value = "";
          for (const field of document.querySelectorAll("#spycraft2-game-clock .sc2-timer-new [name=label]"))
            if (timer) field.value = "";
          return timer;
        },
        deleteTimer: (event, target) => deleteTimer(target.dataset.id),
        extendTimer: async (event, target) => {
          // A timer on a character grows in the unit Foundry counts it in; a personal one in any unit.
          const onEffect = target.dataset.kind === "effect";
          const input = await systemDialog.input({
            window: { title: loc`Add time to the timer` },
            rejectClose: false,
            ok: { label: loc`Add` },
            content: `<div class="spycraft2-roll-options"><label>${onEffect ? loc`Amount (${esc(target.dataset.units)})` : loc`Amount`} <input type="number" name="count" min="1" step="1" value="1" required /></label>${onEffect ? "" : `<label>${loc`Unit`} <select name="unit">${unitOptions("round")}</select></label>`}</div>`
          });
          if (input) await extendTimerBy(target.dataset.id, Number(input.count), input.unit);
        }
      }
    };

    async _renderHTML() {
      const own = myTimers(),
        shared = sharedTimers(),
        conditions = timedConditionRows(),
        combat = game.combat?.started ? game.combat : null;
      const gc = game.user.isGM
        ? `<p class="sc2-clock-steps">${clockSteps()
            .map(
              step =>
                `<button type="button" data-action="step" data-seconds="${step.seconds}">${esc(step.label)}</button>`
            )
            .join(
              ""
            )}</p><p class="sc2-clock-steps"><button type="button" data-action="advance">${loc`Move the clock…`}</button><button type="button" data-action="setDate">${loc`Set the date…`}</button></p>`
        : "";
      return `<section class="sc2-game-clock-body">${
        clockVisible()
          ? `<p class="sc2-clock-now">${esc(clockLabel())}</p>`
          : `<p class="muted">${loc`The GC keeps the time.`}</p>`
      }${combat ? `<p class="muted">${loc`Combat round ${combat.round}. Each round is ${ROUND_SECONDS} seconds.`}</p>` : ""}${gc}<h3>${loc`My timers`}</h3><ul class="sc2-timers">${
        own.map(timerRow).join("") || `<li class="muted">${loc`None running.`}</li>`
      }</ul><div class="sc2-timer-new"><input type="text" name="label" maxlength="120" placeholder="${loc`What it is for`}" aria-label="${loc`Timer name`}" /><input type="number" name="count" min="1" step="1" value="1" aria-label="${loc`Length`}" /><select name="unit" aria-label="${loc`Unit`}">${unitOptions("round")}</select><select name="actorUuid" class="sc2-timer-holder" aria-label="${loc`Kept on`}">${holderOptions()}</select><label class="sc2-timer-shared"><input type="checkbox" name="shared" /> ${loc`Show everyone`}</label><button type="button" data-action="quickTimer">${loc`Start timer`}</button></div>${
        shared.length
          ? `<h3>${loc`Shared timers`}</h3><ul class="sc2-timers">${shared.map(timerRow).join("")}</ul>`
          : ""
      }${
        conditions.length
          ? `<h3>${loc`Conditions with a time limit`}</h3><ul class="sc2-timers">${conditions
              .map(
                row =>
                  `<li><div class="sc2-timer-line"><b>${esc(row.actor)}</b>: ${esc(row.name)}<span class="sc2-timer-left">${esc(loc`${row.label} left`)}</span></div></li>`
              )
              .join("")}</ul>`
          : ""
      }</section>`;
    }

    _replaceHTML(result, content) {
      // Keep what is being typed into the new-timer row across a refresh.
      const typed = Object.fromEntries(
        [...content.querySelectorAll(".sc2-timer-new [name]")].map(field => [
          field.name,
          field.type === "checkbox" ? field.checked : field.value
        ])
      );
      const focused = content.querySelector(".sc2-timer-new :focus")?.name;
      content.innerHTML = result;
      for (const field of content.querySelectorAll(".sc2-timer-new [name]")) {
        if (!Object.hasOwn(typed, field.name)) continue;
        if (field.type === "checkbox") field.checked = typed[field.name];
        else field.value = typed[field.name];
      }
      if (focused) content.querySelector(`.sc2-timer-new [name="${focused}"]`)?.focus();
    }
  };
  return GameClock;
}

let clockWindow = null;
/** Open the Clock window. */
export function openGameClock() {
  clockWindow ??= new (clockClass())();
  clockWindow.render({ force: true });
  return clockWindow;
}

/* -------------------------------------------- */
/*  The clock in the players list                */
/* -------------------------------------------- */

function badgeText() {
  const next = myTimers().find(row => !row.expired);
  const time = clockVisible() ? clockLabel() : loc`Timers`;
  return next ? loc`${time} · ${next.label}: ${next.status}` : time;
}

function mountClockBadge(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".sc2-clock-badge")) return;
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "sc2-clock-badge";
  badge.dataset.tooltip = loc`Clock and timers`;
  badge.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i> <span></span>`;
  badge.querySelector("span").textContent = badgeText();
  badge.addEventListener("click", () => openGameClock());
  root.prepend(badge);
}

let lastMoneyModifier = null;
/** Agents' spending cash follows the clock's year under Historical (Table 7.4): recompute them when that changes. */
function refreshMoneyForYear() {
  let modifier;
  try {
    modifier = periodMoneyModifier();
  } catch {
    return;
  }
  const changed = lastMoneyModifier !== null && modifier !== lastMoneyModifier;
  lastMoneyModifier = modifier;
  if (!changed) return;
  for (const actor of game.actors ?? [])
    if (actor.type === "agent") {
      actor.reset();
      if (actor.sheet?.rendered) actor.sheet.render(false);
    }
}

function refreshClock() {
  refreshMoneyForYear();
  for (const span of document.querySelectorAll(".sc2-clock-badge span")) span.textContent = badgeText();
  if (clockWindow?.rendered) clockWindow.render();
  game.spycraft2?.gc?.console?.render?.(false);
  // Open item browsers hide gear by the clock's year.
  for (const app of foundry.applications.instances.values())
    if (app.rendered && typeof app.refreshForClock === "function") app.refreshForClock();
}

/* -------------------------------------------- */
/*  Setup                                        */
/* -------------------------------------------- */

/** Register the settings and hooks. Call during `init`. */
export function installGameClock() {
  game.settings.register("spycraft2", "clock", {
    scope: "world",
    config: false,
    type: Object,
    default: { epoch: null },
    onChange: refreshClock
  });
  game.settings.register("spycraft2", "advanceClockInCombat", {
    name: locKey`Advance the clock each combat round`,
    hint: loc`Each combat round adds ${ROUND_SECONDS} seconds to the game clock, so timers, onset times and timed conditions keep pace with the fight. Going back a round takes the time off again.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      CONFIG.time.roundTime = value === false ? 0 : ROUND_SECONDS;
    }
  });
  game.settings.register("spycraft2", "clockVisibleToPlayers", {
    name: locKey`Show the clock to players`,
    hint: locKey`When off, players still set timers and see the time each has left, but not the time of day.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: refreshClock
  });
  CONFIG.time.roundTime = setting("advanceClockInCombat") === false ? 0 : ROUND_SECONDS;
  CONFIG.time.turnTime = 0;
  CONFIG.time.formatters[CLOCK_FORMATTER] = formatClock;

  Hooks.on("renderPlayers", mountClockBadge);
  const tick = () => {
    refreshClock();
    checkTimers().catch(error => console.error(error));
    sweepTimedConditions();
    announceDueHazards();
  };
  Hooks.on("updateWorldTime", tick);
  Hooks.once("ready", tick);
  Hooks.on("updateUser", (user, changed) => {
    if (
      changed.flags?.spycraft2 &&
      (user.isSelf || timersOf(user).some(timer => timer.shared) || clockWindow?.rendered)
    )
      refreshClock();
  });
  // Foundry marks an effect expired when its duration has run; that is the moment to announce or lift it.
  Hooks.on("updateActiveEffect", (effect, changed) => {
    if (changed.duration?.expired === true) {
      announceEffectTimer(effect);
      liftExpiredCondition(effect);
    }
    if (timerFlag(effect) || isTimedCondition(effect)) refreshClock();
  });
  for (const event of ["createActiveEffect", "deleteActiveEffect"])
    Hooks.on(event, effect => {
      if (timerFlag(effect) || isTimedCondition(effect)) refreshClock();
    });
  for (const event of ["updateCombat", "deleteCombat", "controlToken"])
    Hooks.on(event, () => {
      if (clockWindow?.rendered) clockWindow.render();
    });
}
