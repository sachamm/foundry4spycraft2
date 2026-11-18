import { loc } from "../i18n.mjs";
/** Charmer p.202 / Hard Core p.203; Influence quick/slow checks p.132. */
function influenceTimingPlan(
  system,
  key,
  check,
  { requested, target, disposition, npcConfirmed, duration },
  { feat, id, page, dispositions }
) {
  if (requested !== true) return { active: false, timeChoices: [], blockedReason: "", notes: [] };
  const fail = reason => ({ active: true, timeChoices: [], blockedReason: reason, notes: [] });
  if (key !== "impress" || check?.id !== "influence")
    return fail(loc`${feat} applies only to Impress/Influence (p.${page}).`);
  if (!system.activeFeatNames?.includes(feat)) return fail(loc`${feat} is not currently earned.`);
  if (npcConfirmed !== true || typeof target !== "string" || !target.trim() || target.length > 200)
    return fail(loc`Confirm one named NPC and their disposition toward you for ${feat}.`);
  if (!dispositions.includes(disposition))
    return fail(loc`${feat} requires an NPC whose disposition toward you is ${dispositions.join(", ")}.`);
  if (!["quick", "slow"].includes(duration))
    return fail(loc`Choose quick (1-minute) or slow (10-minute) Influence for ${feat}.`);
  const baseSeconds = duration === "quick" ? 60 : 600,
    baseTime = duration === "quick" ? "1 Minute (Take 10/Take 20)" : "10 Minutes (Take 10/Take 20)";
  return {
    active: true,
    baseSeconds,
    baseTime,
    evidence: {
      version: 1,
      source: "gcConfirmed",
      target: target.trim(),
      npcConfirmed: true,
      disposition,
      duration,
      baseSeconds
    },
    timeChoices: [{ id, name: feat, multiplier: 0.1, minimum: 0, rounding: null }],
    blockedReason: "",
    notes: [
      loc`${feat}: GC-confirmed ${disposition} NPC ${target.trim()}; ${duration === "quick" ? loc`quick Influence (scene duration), 1 minute → 1 full action` : loc`slow Influence (mission duration), 10 minutes → 1 minute`} before check-method multipliers; only one time reduction applies (pp.132,${page}).`
    ]
  };
}
export function hardCoreInfluencePlan(
  system,
  key,
  check,
  {
    hardCore = false,
    hardCoreTarget = "",
    hardCoreDisposition = "",
    hardCoreNPCConfirmed = false,
    influenceDuration = ""
  } = {}
) {
  return influenceTimingPlan(
    system,
    key,
    check,
    {
      requested: hardCore,
      target: hardCoreTarget,
      disposition: hardCoreDisposition,
      npcConfirmed: hardCoreNPCConfirmed,
      duration: influenceDuration
    },
    { feat: "Hard Core", id: "hardCore", page: 203, dispositions: ["aloof", "unfriendly", "hostile"] }
  );
}
export function charmerInfluencePlan(
  system,
  key,
  check,
  {
    charmer = false,
    charmerTarget = "",
    charmerDisposition = "",
    charmerNPCConfirmed = false,
    charmerDuration = ""
  } = {}
) {
  return influenceTimingPlan(
    system,
    key,
    check,
    {
      requested: charmer,
      target: charmerTarget,
      disposition: charmerDisposition,
      npcConfirmed: charmerNPCConfirmed,
      duration: charmerDuration
    },
    { feat: "Charmer", id: "charmer", page: 202, dispositions: ["neutral", "intrigued", "friendly"] }
  );
}
