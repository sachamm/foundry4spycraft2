/**
 * The game clock and the timers that run on it.
 *
 * World time is a count of seconds and a combat round is 6 of them (CONFIG.time.roundTime). A timer on a character
 * and a condition with a time limit are Active Effects with a duration, which Foundry counts down and expires
 * itself; this module turns our units into its own. A timer kept by a user with no character is a start, an end and
 * the unit it was set in. Pure rules; the Foundry side is in module/apps/game-clock.mjs.
 */
import { loc } from "../i18n.mjs";

export const ROUND_SECONDS = 6;

/** Units a timer or a clock step can be set in, shortest first. */
export const TIME_UNITS = {
  round: ROUND_SECONDS,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800
};

export const unitLabel = unit =>
  ({
    round: loc`Rounds`,
    minute: loc`Minutes`,
    hour: loc`Hours`,
    day: loc`Days`,
    week: loc`Weeks`
  })[unit] ?? unit;

const whole = value => Number.isSafeInteger(value) && value >= 0;

/** Seconds in a count of a unit. Throws on a unit or count the clock cannot use. */
export function unitSeconds(count, unit = "round") {
  if (!Object.hasOwn(TIME_UNITS, unit)) throw new Error(loc`Choose rounds, minutes, hours, days or weeks.`);
  if (!Number.isFinite(count) || count <= 0) throw new Error(loc`Enter a length of time above 0.`);
  const seconds = Math.round(count * TIME_UNITS[unit]);
  if (!Number.isSafeInteger(seconds) || seconds < 1) throw new Error(loc`Enter a length of time above 0.`);
  return seconds;
}

/**
 * A new timer.
 * @param {object} input { label, count, unit, shared, id }
 * @param {number} now   world time in seconds
 */
export function createTimer({ label = "", count = 1, unit = "round", shared = false, id } = {}, now = 0) {
  if (!whole(now)) throw new Error(loc`The game clock has no time to start from.`);
  if (typeof id !== "string" || !id) throw new Error(loc`A timer needs an id.`);
  const seconds = unitSeconds(Number(count), unit);
  const name = String(label ?? "")
    .trim()
    .slice(0, 120);
  return {
    id,
    label: name || loc`Timer`,
    unit,
    start: now,
    end: now + seconds,
    shared: shared === true,
    notified: false
  };
}

/** Only well-formed timers, so one bad stored entry cannot break the list. */
export function validTimers(list) {
  return (Array.isArray(list) ? list : []).filter(
    t =>
      t &&
      typeof t === "object" &&
      typeof t.id === "string" &&
      t.id &&
      whole(t.start) &&
      whole(t.end) &&
      t.end >= t.start
  );
}

/** Timers whose time has come and whose owner has not been told yet. */
export function dueTimers(list, now) {
  if (!Number.isFinite(now)) return [];
  return validTimers(list).filter(t => !t.notified && t.end <= now);
}

/** The list with these timers marked as announced. */
export function markNotified(list, ids) {
  const done = new Set(ids);
  return validTimers(list).map(t => (done.has(t.id) ? { ...t, notified: true } : t));
}

export const removeTimer = (list, id) => validTimers(list).filter(t => t.id !== id);

/** Push a timer's end back (or forward, with a negative amount) without changing when it began. */
export function extendTimer(list, id, count, unit = "round") {
  const sign = count < 0 ? -1 : 1,
    seconds = sign * unitSeconds(Math.abs(Number(count)), unit);
  return validTimers(list).map(t =>
    t.id === id ? { ...t, end: Math.max(t.start, t.end + seconds), notified: false } : t
  );
}

/**
 * A length of time in words, largest units first: "2 h 5 min", "18 s".
 * @param {number} seconds
 * @param {object} [options] { maxTerms }
 */
export function durationLabel(seconds, { maxTerms = 2 } = {}) {
  let left = Math.max(0, Math.round(Number(seconds) || 0));
  if (!left) return loc`0 s`;
  const parts = [];
  for (const [size, label] of [
    [604800, n => loc`${n} wk`],
    [86400, n => loc`${n} d`],
    [3600, n => loc`${n} h`],
    [60, n => loc`${n} min`],
    [1, n => loc`${n} s`]
  ]) {
    const n = Math.floor(left / size);
    if (!n) continue;
    parts.push(label(n));
    left -= n * size;
    if (parts.length >= maxTerms) break;
  }
  return parts.join(" ");
}

/**
 * How a timer stands now.
 * @returns {{seconds: number, expired: boolean, label: string, fraction: number}} fraction is the part elapsed, 0–1
 */
export function timerStatus(timer, now) {
  const seconds = Math.max(0, timer.end - now),
    length = Math.max(1, timer.end - timer.start),
    expired = seconds <= 0;
  let label;
  if (expired) label = loc`Done`;
  else if (timer.unit === "round") {
    const rounds = Math.ceil(seconds / ROUND_SECONDS);
    label = rounds === 1 ? loc`1 round left` : loc`${rounds} rounds left`;
  } else label = loc`${durationLabel(seconds)} left`;
  return { seconds, expired, label, fraction: Math.min(1, Math.max(0, (now - timer.start) / length)) };
}

/* -------------------------------------------- */
/*  The clock face                               */
/* -------------------------------------------- */

const pad = n => String(n).padStart(2, "0");

/**
 * The time of day and the day count of a world time that has no calendar date set.
 * @returns {{day: number, hour: number, minute: number, second: number, clock: string}}
 */
export function elapsedClock(worldTime) {
  const t = Math.max(0, Math.floor(Number(worldTime) || 0)),
    day = Math.floor(t / 86400),
    rest = t - day * 86400,
    hour = Math.floor(rest / 3600),
    minute = Math.floor((rest % 3600) / 60),
    second = rest % 60;
  return { day: day + 1, hour, minute, second, clock: `${pad(hour)}:${pad(minute)}:${pad(second)}` };
}

/* -------------------------------------------- */
/*  Conditions that end by the clock             */
/* -------------------------------------------- */

/** The units Foundry's own effect durations use for each of ours. A week is seven of its days. */
const EFFECT_UNITS = {
  round: ["rounds", 1],
  minute: ["minutes", 1],
  hour: ["hours", 1],
  day: ["days", 1],
  week: ["days", 7]
};

/**
 * A length of time as an Active Effect duration ({ value, units }), which Foundry counts down and expires itself.
 * A count that is not whole in its own unit is given in seconds.
 */
export function effectDuration(count, unit = "round") {
  const seconds = unitSeconds(Number(count), unit),
    [units, factor] = EFFECT_UNITS[unit],
    value = Number(count) * factor;
  return Number.isSafeInteger(value) ? { value, units } : { value: seconds, units: "seconds" };
}

/** The effect duration of { count, unit } ("round", "minute", …), or null when the length is not known. */
export function conditionDuration(time) {
  try {
    return effectDuration(time?.count, time?.unit);
  } catch {
    return null;
  }
}

/**
 * What to do with a timed condition once its time is up: "remove" it, or "keep" it without a time limit.
 * An unconscious character at 0 wounds or fewer does not wake when a knockout runs out.
 * @param {object} facts { statuses: string[], wounds, special }
 */
export function expiredConditionAction({ statuses = [], wounds = null, special = false } = {}) {
  return special && Number.isFinite(wounds) && wounds <= 0 && statuses.includes("unconscious") ? "keep" : "remove";
}
