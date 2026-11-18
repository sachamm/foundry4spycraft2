import { loc } from "../i18n.mjs";
/** p.102: at most one time-reducing option/effect; p.101 Cross-Check triples required time. */
export function skillTimingPlan({
  method = "roll",
  take10Normal = false,
  falseStart = false,
  professional = false,
  classEffect = {},
  time = "",
  reduction = "auto",
  crossCheck = false,
  minimumRequired = 0
} = {}) {
  const base = method === "take10" ? 2 : method === "take20" ? 20 : 1;
  const choices = [{ id: "none", name: "No time reduction", multiplier: base, minimum: 0, rounding: null }];
  if (method === "take10" && take10Normal)
    choices.push({ id: "take10", name: "Normal-time take 10", multiplier: 1, minimum: 0, rounding: null });
  if (method === "take20" && falseStart)
    choices.push({ id: "falseStart", name: "False Start", multiplier: 15, minimum: 0, rounding: null });
  if (professional)
    choices.push({
      id: "professional",
      name: "Mark of a Professional",
      multiplier: base * 0.5,
      minimum: 6,
      rounding: null
    });
  if (classEffect.timeMultiplier < 1)
    choices.push({
      id: "class",
      name: classEffect.timeSource ?? "Class time reduction",
      multiplier: base * classEffect.timeMultiplier,
      minimum: classEffect.minimumTimeSeconds ?? 0,
      rounding: classEffect.timeRounding ?? null
    });
  for (const choice of classEffect.timeChoices ?? []) choices.push({ ...choice, multiplier: base * choice.multiplier });
  const duration = String(time).match(
    /^\s*(\d+(?:\.\d+)?)\s+(Second|Half Action|Full Action|Round|Minute|Hour|Day)s?\b/i
  );
  const units = { second: 1, "half action": 3, "full action": 6, round: 6, minute: 60, hour: 3600, day: 86400 };
  const seconds = duration ? Number(duration[1]) * units[duration[2].toLowerCase()] : null;
  const compare = (a, b) =>
    (seconds === null
      ? a.multiplier - b.multiplier
      : Math.max(seconds * a.multiplier, a.minimum, minimumRequired) -
        Math.max(seconds * b.multiplier, b.minimum, minimumRequired)) ||
    a.multiplier - b.multiplier ||
    Math.max(a.minimum, minimumRequired) - Math.max(b.minimum, minimumRequired) ||
    ({ down: 0, up: 2 }[a.rounding] ?? 1) - ({ down: 0, up: 2 }[b.rounding] ?? 1);
  const selected =
    reduction === "auto"
      ? choices.filter(c => c.automatic !== false).sort(compare)[0]
      : choices.find(c => c.id === reduction);
  if (!selected) throw new Error(loc`The selected time reduction is not available for this check and method.`);
  const cross = crossCheck ? 3 : 1,
    minimum = Math.max(selected.minimum, minimumRequired) * cross;
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
    timeMultiplier: selected.multiplier * cross,
    timeBaseMultiplier: selected.multiplier,
    crossCheckMultiplier: cross,
    timeRoundingBeforeCrossCheck: !!selected.rounding && crossCheck,
    minimumTimeSeconds: minimum,
    minimumTime,
    timeRounding: selected.rounding,
    timeReduction: selected.id,
    timeReductionOptions: choices,
    errorIncrease: selected.errorIncrease ?? 0,
    notes:
      selected.id === "none"
        ? ""
        : loc`${selected.name}: the single applied time reduction (p.102); ${selected.multiplier}× listed time${crossCheck ? loc` before Cross-Check` : ""}.${selected.errorIncrease ? loc` Error range +${selected.errorIncrease}.` : ""}${selected.rounding ? loc` Round ${selected.rounding}${crossCheck ? loc` before tripling for Cross-Check` : ""}.` : ""}${seconds === null && reduction === "auto" ? loc` Variable time: automatic selection compares multipliers and minima; choose a source explicitly if its minimum would make another option faster.` : ""}`
  };
}
