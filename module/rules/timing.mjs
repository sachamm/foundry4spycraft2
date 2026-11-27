import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
/** User ruling: p.329 additive multipliers, with one reducing effect under p.102. */
export function skillTimingPlan({
  method = "roll",
  take10Normal = false,
  take10Base = 2,
  falseStart = false,
  professional = false,
  classEffect = {},
  time = "",
  reduction = "auto",
  crossCheck = false,
  timeEffects = [],
  minimumRequired = 0
} = {}) {
  if (!Number.isFinite(take10Base) || take10Base < 1)
    throw new Error(loc`Review the campaign's take-10 time multiplier.`);
  const base = method === "take10" ? take10Base : method === "take20" ? 20 : 1;
  if (
    !classEffect ||
    typeof classEffect !== "object" ||
    Array.isArray(classEffect) ||
    (classEffect.timeChoices !== undefined && !Array.isArray(classEffect.timeChoices)) ||
    (classEffect.timeMultiplier !== undefined &&
      (!Number.isFinite(classEffect.timeMultiplier) || classEffect.timeMultiplier < 0))
  )
    throw Error(loc`Review the class's time modifiers before resolving this check.`);
  if (
    !Array.isArray(timeEffects) ||
    timeEffects.some(
      effect =>
        !effect ||
        typeof effect.id !== "string" ||
        !effect.id ||
        !Number.isFinite(effect.multiplier) ||
        effect.multiplier < 0
    ) ||
    new Set(timeEffects.map(effect => effect.id)).size !== timeEffects.length
  )
    throw Error(loc`Review the skill check's additional time effects.`);
  const withBase = choice => {
    if (
      typeof choice.id !== "string" ||
      !choice.id ||
      !Number.isFinite(choice.multiplier) ||
      choice.multiplier < 0 ||
      (choice.fixedSeconds !== undefined &&
        (!Number.isFinite(choice.fixedSeconds) || choice.fixedSeconds < 0 || choice.multiplier !== 0)) ||
      (choice.automatic !== undefined && typeof choice.automatic !== "boolean")
    )
      throw Error(loc`Review the source of this skill time option.`);
    return {
      ...choice,
      minimum: choice.minimum ?? 0,
      rounding: choice.rounding ?? null,
      // A zero factor encodes a fixed-time override, rather than a printed multiplication by zero.
      multiplier: choice.multiplier === 0 ? 0 : base - 1 + choice.multiplier
    };
  };
  const choices = [{ id: "none", name: loc`No time reduction`, multiplier: base, minimum: 0, rounding: null }];
  if (method === "take10" && take10Normal)
    choices.push({ id: "take10", name: loc`Normal-time take 10`, multiplier: 1, minimum: 0, rounding: null });
  if (method === "take20" && falseStart)
    choices.push({ id: "falseStart", name: loc`False Start`, multiplier: 15, minimum: 0, rounding: null });
  if (professional)
    choices.push(
      withBase({
        id: "professional",
        name: loc`Mark of a Professional`,
        multiplier: 0.5,
        minimum: 6,
        rounding: null
      })
    );
  if (classEffect.timeMultiplier < 1)
    choices.push(
      withBase({
        id: "class",
        name: classEffect.timeSource ?? "Class time reduction",
        multiplier: classEffect.timeMultiplier,
        minimum: classEffect.minimumTimeSeconds ?? 0,
        rounding: classEffect.timeRounding ?? null
      })
    );
  for (const choice of classEffect.timeChoices ?? []) choices.push(withBase(choice));
  for (const effect of timeEffects.filter(effect => effect.multiplier < 1))
    choices.push(withBase({ ...effect, name: effect.name ?? effect.id }));
  if (
    new Set(choices.map(choice => choice.id)).size !== choices.length ||
    choices.some(
      choice =>
        !Number.isFinite(choice.multiplier) ||
        choice.multiplier < 0 ||
        !Number.isFinite(choice.minimum) ||
        choice.minimum < 0 ||
        ![null, "up", "down"].includes(choice.rounding)
    )
  )
    throw Error(loc`Review the available skill time reductions, minima and rounding.`);
  const cross = crossCheck ? 3 : 1,
    increasing =
      cross + timeEffects.filter(effect => effect.multiplier >= 1).reduce((n, effect) => n + effect.multiplier - 1, 0),
    multiplierOf = choice =>
      choice.fixedSeconds !== undefined
        ? seconds > 0
          ? (choice.fixedSeconds / seconds) * (base + increasing - 1)
          : 0
        : choice.multiplier === 0
          ? 0
          : choice.multiplier + (increasing - 1),
    minimumOf = choice =>
      Math.max(
        Math.max(choice.minimum, minimumRequired) * increasing,
        choice.fixedSeconds === undefined ? 0 : choice.fixedSeconds * (base + increasing - 1)
      );
  if (!Number.isFinite(increasing) || !Number.isFinite(minimumRequired) || minimumRequired < 0)
    throw Error(loc`Review the combined time multipliers and minimum duration.`);
  const duration = String(time).match(
    /^\s*(\d+(?:\.\d+)?)\s+(Second|Half Action|Full Action|Round|Minute|Hour|Day)s?\b/i
  );
  const units = { second: 1, "half action": 3, "full action": 6, round: 6, minute: 60, hour: 3600, day: 86400 };
  const seconds = duration ? Number(duration[1]) * units[duration[2].toLowerCase()] : null;
  const compare = (a, b) =>
    (seconds === null
      ? a.multiplier - b.multiplier
      : requiredSkillSeconds(seconds, {
          timeMultiplier: multiplierOf(a),
          minimumTimeSeconds: minimumOf(a),
          timeRounding: a.rounding
        }) -
        requiredSkillSeconds(seconds, {
          timeMultiplier: multiplierOf(b),
          minimumTimeSeconds: minimumOf(b),
          timeRounding: b.rounding
        })) ||
    a.multiplier - b.multiplier ||
    Math.max(a.minimum, minimumRequired) - Math.max(b.minimum, minimumRequired) ||
    ({ down: 0, up: 2 }[a.rounding] ?? 1) - ({ down: 0, up: 2 }[b.rounding] ?? 1);
  const selected =
    reduction === "auto"
      ? choices.filter(c => c.automatic !== false).sort(compare)[0]
      : choices.find(c => c.id === reduction);
  if (!selected) throw new Error(loc`The selected time reduction is not available for this check and method.`);
  const minimum = minimumOf(selected),
    multiplier = multiplierOf(selected);
  if (!Number.isFinite(multiplier) || !Number.isFinite(minimum))
    throw Error(loc`The combined skill duration exceeds the supported numeric range.`);
  const minimumTime =
    minimum === 0
      ? null
      : minimum % 60 === 0
        ? `${minimum / 60} ${minimum === 60 ? "minute" : "minutes"}`
        : minimum % 6 === 0
          ? `${minimum / 6} ${minimum === 6 ? "round" : "rounds"}`
          : minimum === 3
            ? "1 half action"
            : `${minimum} seconds`;
  return {
    timeMultiplier: multiplier,
    timeBaseMultiplier:
      selected.fixedSeconds !== undefined && seconds > 0
        ? (selected.fixedSeconds / seconds) * base
        : selected.multiplier,
    crossCheckMultiplier: cross,
    timeRoundingBeforeCrossCheck: false,
    minimumTimeSeconds: minimum,
    minimumTime,
    timeRounding: selected.rounding,
    timeReduction: selected.id,
    timeReductionOptions: choices,
    errorIncrease: selected.errorIncrease ?? 0,
    skillTiming: {
      version: 1,
      policy: "additive-one-reduction",
      method,
      base,
      reduction: {
        id: selected.id,
        multiplier: selected.multiplier,
        minimum: selected.minimum,
        rounding: selected.rounding,
        ...(selected.fixedSeconds === undefined ? {} : { fixedSeconds: selected.fixedSeconds })
      },
      crossCheck: !!crossCheck,
      effects: timeEffects.map(effect => ({ id: effect.id, multiplier: effect.multiplier })),
      multiplier,
      minimum,
      rounding: selected.rounding,
      ...(selected.fixedSeconds === undefined ? {} : { fixedMultiplier: base + increasing - 1 })
    },
    notes:
      (selected.id === "none"
        ? ""
        : loc`${selected.name}: the single applied time reduction (p.102).${selected.errorIncrease ? loc` Error range +${selected.errorIncrease}.` : ""}`) +
      (selected.multiplier === 0
        ? loc` Fixed duration: ${minimum} seconds after required time increases.`
        : crossCheck || timeEffects.length
          ? loc` Time multipliers combine additively: ${multiplier}× listed time${minimum ? loc`, minimum ${minimum} seconds` : ""}.`
          : "") +
      (selected.rounding
        ? loc` Round ${selected.rounding} after combining time effects, respecting the minimum.`
        : "") +
      (seconds === null && reduction === "auto" && selected.id !== "none"
        ? loc` Variable time: automatic selection compares multipliers and minima; choose a source explicitly if its minimum would make another option faster.`
        : "")
  };
}

export function requiredSkillSeconds(baseSeconds, timing) {
  const multiplier = timing?.timeMultiplier,
    raw = baseSeconds * multiplier,
    minimum = timing?.minimumTimeSeconds ?? 0;
  if (
    ![baseSeconds, multiplier, raw, minimum].every(Number.isFinite) ||
    baseSeconds < 0 ||
    raw < 0 ||
    minimum < 0 ||
    ![undefined, null, "up", "down"].includes(timing?.timeRounding)
  )
    throw Error(loc`Review the skill duration and its recorded timing modifiers.`);
  const rounded =
    timing.timeRounding === "up"
      ? Math.ceil(raw)
      : timing.timeRounding === "down"
        ? Math.floor(raw)
        : Number(raw.toFixed(6));
  return Math.max(rounded, minimum);
}
rollPipeline.register({ id: "skillTimingRecord", order: 9771.7, record: ["skillTiming"] });

/**
 * False Start, p.200 (Table 3.1): after failing an unopposed check that takes longer than 1 round, the character may
 * stop and begin again from the next whole step of the standard time, spending only half the materials.
 * Returns the restart step for a listed time, or "" when the check is too short or its time is not fixed.
 */
export function falseStartRestart(time = "") {
  const m = String(time).match(/^\s*(\d+(?:\.\d+)?)\s+(Round|Minute|Hour|Day|Week|Month|Year)s?\b/i);
  if (!m) return "";
  const units = { round: 6, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 },
    seconds = Number(m[1]) * units[m[2].toLowerCase()];
  if (seconds < 6) return "";
  const steps = [
    [60, loc`round`],
    [600, loc`minute`],
    [3600, loc`10 minutes`],
    [86400, loc`hour`],
    [604800, loc`day`],
    [2592000, loc`week`],
    [31536000, loc`month`]
  ];
  return steps.find(([limit]) => seconds <= limit)?.[1] ?? "";
}
