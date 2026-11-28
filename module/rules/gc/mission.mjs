/**
 * Mission record: Threat Level, Caliber, objectives, complications and XP (pp.423–440, 452).
 * Pure functions; the Foundry state lives in module/apps/gc/state.mjs.
 */
import { GC_DATA } from "../gc-tables.mjs";
import { loc } from "../../i18n.mjs";
import { periodMoney } from "../period-money.mjs";

const M = GC_DATA.core.mission;
const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const count = value => (whole(value, 0, 1000) ? value : 0);

/** p.452: what one standard or special antagonist adds to the mission reward (a special one counts 4 times). */
export function antagonistReward(entry) {
  const xp = Math.max(0, Math.trunc(Number(entry?.xp) || 0)),
    multiplier = entry?.type === "special" ? M.specialMultiplier : 1;
  return { xp, multiplier, total: xp * multiplier, special: multiplier > 1 };
}

export function defaultMission() {
  return {
    version: 1,
    name: "",
    active: false,
    ended: false,
    caliber: 1,
    threatAdjust: 0,
    threatOverride: null,
    threatLevel: null,
    team: [],
    objectives: [],
    antagonists: [],
    dramaticScenes: 1,
    security: [],
    gearRestrictions: [],
    exposure: [],
    bundle: [],
    bundleCommonItems: 0,
    timeLimit: false,
    qualities: [],
    otherComplications: [],
    // GC events the mission must bring in (pp.399–400), such as a Marked for Death event from a liquidation roll.
    scriptedEvents: [],
    infractions: [],
    scenesPlayed: 0,
    standingPaid: {},
    notes: ""
  };
}

/**
 * What a session has already given an agent in starting-dice changes, from the stored flag. The flag was once just
 * the session id, with no amount: that reads as "adjusted, amount unknown" (change null), so nothing is given twice.
 * @returns {{change: number|null}|null} null when this session has given nothing yet
 */
export function sessionDiceApplied(flag, session) {
  if (!flag) return null;
  if (typeof flag === "string") return flag === session ? { change: null } : null;
  if (flag.session !== session) return null;
  return { change: Number.isSafeInteger(flag.change) ? flag.change : null };
}

/** p.423: sum of career levels ÷ 5, rounded up, minimum 1; the GC may shift it by up to 2; never above 20. */
export function defaultThreatLevel(levels) {
  const valid = (levels ?? []).filter(level => whole(level, 0, 100));
  const sum = valid.reduce((total, level) => total + level, 0);
  return Math.min(M.threatLevel.maximum, Math.max(M.threatLevel.minimum, Math.ceil(sum / M.threatLevel.divisor)));
}

export function threatLevel(mission, levels) {
  if (whole(mission?.threatOverride, 1, 20))
    return { base: mission.threatOverride, adjust: 0, value: mission.threatOverride, override: true };
  const base = defaultThreatLevel(levels);
  const adjust = whole(mission?.threatAdjust, -M.threatLevel.maxAdjust, M.threatLevel.maxAdjust)
    ? mission.threatAdjust
    : 0;
  return {
    base,
    adjust,
    value: Math.min(M.threatLevel.maximum, Math.max(M.threatLevel.minimum, base + adjust)),
    override: false
  };
}

/** p.61: +1 starting action die per 2 full points the mission TL exceeds the team's average career level. */
export function threatBonusActionDice(tl, levels) {
  const valid = (levels ?? []).filter(level => whole(level, 0, 100));
  if (!valid.length) return 0;
  const average = valid.reduce((total, level) => total + level, 0) / valid.length;
  return Math.max(0, Math.floor((tl - average) / M.threatLevel.bonusDiePerLevels));
}

/** Table 7.10 plus the Table 7.5 adjustment for a shifted Threat Level. */
export function missionStanding(mission) {
  const row = M.reputationByCaliber.find(entry => entry.caliber === mission?.caliber);
  if (!row) return null;
  // Once a Threat Level is fixed, the reward follows the adjustment in it; a later edit counts once applied.
  const applied =
    whole(mission?.threatLevel, 1, 20) &&
    whole(mission?.threatAdjustApplied, -M.threatLevel.maxAdjust, M.threatLevel.maxAdjust);
  const adjust = applied
    ? mission.threatAdjustApplied
    : whole(mission?.threatAdjust, -M.threatLevel.maxAdjust, M.threatLevel.maxAdjust) &&
        !whole(mission?.threatOverride, 1, 20)
      ? mission.threatAdjust
      : 0;
  return {
    reputation: row.reputation + adjust * M.threatLevel.reputationPerStep,
    // Table 7.4 under the Historical quality (p.407).
    netWorth: periodMoney(row.netWorth + adjust * M.threatLevel.netWorthPerStep)
  };
}

const halfUp = xp =>
  xp >= 0 ? Math.ceil(xp * M.ignoredComplicationFraction) : -Math.ceil(-xp * M.ignoredComplicationFraction);
const complication = (label, xp, entry) => ({ label, xp: entry?.ignored ? halfUp(xp) : xp, ignored: !!entry?.ignored });

/**
 * Base mission XP before each character's own adjustments (p.440).
 * `lookup` supplies catalog XP: {quality(id), security(id), gearRestriction(id), exposure(id)}.
 * Objectives earn grade × 25 only when completed (unless `planned` asks for the scripted total).
 */
export function missionBaseXP(mission, lookup = {}, { planned = false } = {}) {
  const rows = [],
    warnings = [];
  const add = (group, label, xp, extra = {}) => rows.push({ group, label, xp, ...extra });

  for (const objective of mission.objectives ?? []) {
    if (!whole(objective.grade, 1, 5)) {
      warnings.push(loc`${objective.name || loc`Objective`}: choose a grade from 1 to 5.`);
      continue;
    }
    const scenes = Math.max(1, count(objective.scenes ?? 1));
    const xp = objective.grade * M.objectiveGradeXP * scenes;
    if (planned || objective.complete)
      add(
        "Objectives",
        `${objective.name || "Objective"} (grade ${objective.grade}${scenes > 1 ? ` × ${scenes} scenes` : ""})`,
        xp,
        { critical: !!objective.critical }
      );
  }
  const critical = (mission.objectives ?? []).filter(objective => objective.critical).length;
  if (critical === 0) add("Complications", "No critical objectives", M.criticalObjectives.noneXP);
  else if (critical > M.criticalObjectives.free)
    add(
      "Complications",
      `${critical - M.criticalObjectives.free} extra critical objective(s)`,
      (critical - M.criticalObjectives.free) * M.criticalObjectives.extraXP
    );

  const dramatic = count(mission.dramaticScenes);
  if (dramatic === 0) add("Complications", "No scripted dramatic scene", M.dramaticScenes.noneXP);
  else if (dramatic > M.dramaticScenes.free)
    add(
      "Complications",
      `${dramatic - M.dramaticScenes.free} extra scripted dramatic scene(s)`,
      (dramatic - M.dramaticScenes.free) * M.dramaticScenes.extraXP
    );

  const catalog = (group, entries, find, noun) => {
    for (const entry of entries ?? []) {
      // Entries may carry their own resolved XP (security devices scale with a Power Rating).
      const found = Number.isFinite(entry.xp) ? { name: entry.name || entry.id, xp: entry.xp } : find?.(entry.id);
      if (!found) {
        warnings.push(loc`Unknown ${noun}: ${entry.id}.`);
        continue;
      }
      if (!Number.isFinite(found.xp)) {
        warnings.push(loc`${found.name}: enter its XP value by hand (formula in the rules).`);
        continue;
      }
      const times = Math.max(1, count(entry.count ?? 1));
      rows.push({ group, ...complication(`${found.name}${times > 1 ? ` × ${times}` : ""}`, found.xp * times, entry) });
    }
  };
  catalog(
    "Complications",
    (mission.qualities ?? []).filter(entry => entry.scripted !== false),
    lookup.quality,
    "campaign quality"
  );
  catalog("Complications", mission.security, lookup.security, "security device");
  catalog("Complications", mission.gearRestrictions, lookup.gearRestriction, "gear restriction");
  catalog("Complications", mission.exposure, lookup.exposure, "exposure objective");
  if (mission.timeLimit)
    rows.push({
      group: "Complications",
      ...complication("Time limit", M.timeLimitXP, typeof mission.timeLimit === "object" ? mission.timeLimit : null)
    });
  for (const other of mission.otherComplications ?? []) {
    if (!Number.isFinite(other.xp)) continue;
    rows.push({
      group: "Complications",
      ...complication(other.name || "Other complication", Math.trunc(other.xp), other)
    });
  }

  for (const pick of mission.bundle ?? []) {
    if (!whole(pick.caliber, 1, 5)) {
      warnings.push(loc`${pick.name || loc`Bundle pick`}: choose a Caliber from I to V.`);
      continue;
    }
    const times = Math.max(1, count(pick.count ?? 1));
    add(
      "Mission bundle",
      `${pick.name || "Gear pick"} (Caliber ${pick.caliber}${times > 1 ? ` × ${times}` : ""})`,
      pick.caliber * M.bundle.xpPerCaliber * times
    );
  }
  if (count(mission.bundleCommonItems))
    add(
      "Mission bundle",
      `${mission.bundleCommonItems} Common Item(s)`,
      mission.bundleCommonItems * M.bundle.commonItemXP
    );

  const seen = new Set();
  for (const npc of mission.antagonists ?? []) {
    const label = npc.name || loc`Antagonist`;
    if (!planned && !npc.encountered) continue;
    if (npc.full || npc.promoted) {
      // p.452 'full' special NPCs and p.398 promoted standard NPCs: 300 XP per scene in which they appear.
      const scenes = Math.max(1, count(npc.scenes ?? 1));
      add(
        "Antagonists",
        `${label} (${npc.promoted ? "promoted" : "full special"}, ${scenes} scene${scenes > 1 ? "s" : ""})`,
        M.fullSpecialXPPerScene * scenes
      );
      continue;
    }
    if (!Number.isFinite(npc.xp) || npc.xp < 0) {
      warnings.push(loc`${label}: finish the NPC's XP reward.`);
      continue;
    }
    const key = npc.typeKey || npc.uuid || label;
    if (seen.has(key)) continue; // each NPC type counts once per mission (p.452)
    seen.add(key);
    const special = npc.type === "special";
    add(
      "Antagonists",
      `${label}${special ? ` (special × ${M.specialMultiplier})` : ""}`,
      npc.xp * (special ? M.specialMultiplier : 1)
    );
  }

  const total = rows.reduce((sum, row) => sum + row.xp, 0);
  const scenes = Math.max(count(mission.scenesPlayed), 0);
  if (scenes && total / scenes > M.sceneXPMaximum)
    warnings.push(
      loc`This is more than ${M.sceneXPMaximum} base XP per scene (p.440 recommends about ${M.sceneXPTarget}).`
    );
  return { rows, total: Math.max(0, total), rawTotal: total, warnings };
}

/** p.440: (base + 25 per awarded die, capped at 25 × level) × the lower of career level and Threat Level. */
export function characterMissionXP({ baseXP, awards = 0, level, threatLevel: tl }) {
  if (!Number.isFinite(baseXP) || baseXP < 0 || !whole(level, 1, 20) || !whole(tl, 1, 20) || !whole(awards, 0, 10000))
    throw new Error(loc`Enter the base XP, award count, career level and Threat Level.`);
  const awardXP = Math.min(awards * M.actionDieAwardXP, level * M.actionDieAwardXP);
  const multiplier = Math.min(level, tl);
  return { awardXP, multiplier, total: (Math.trunc(baseXP) + awardXP) * multiplier };
}

/**
 * Exposure (p.435): an infraction costs its listed penalty; committed to stop an equal or worse
 * infraction it costs half, rounded up. Penalties are negative numbers in the data.
 */
export function exposurePenalty(infraction, { preventing = false, halve = false, honorMultiplier = 1 } = {}) {
  const scale = value => {
    if (!Number.isFinite(value) || value === 0) return 0;
    let magnitude = Math.abs(value);
    if (preventing) magnitude = Math.ceil(magnitude / 2);
    if (halve) magnitude = Math.floor(magnitude / 2); // Corrupt campaign quality
    // An honor-code breach: doubled under Virtuous, halved (rounded down) under Corrupt (p.408).
    if (Number.isFinite(honorMultiplier) && honorMultiplier > 0 && honorMultiplier !== 1)
      magnitude = Math.floor(magnitude * honorMultiplier);
    return -magnitude;
  };
  // Net Worth is in modern dollars; under Historical it follows Table 7.4 like every other amount.
  return { reputation: scale(infraction?.reputation), netWorth: periodMoney(scale(infraction?.netWorth)) };
}

/**
 * What one antagonist row will add to the mission's XP, in words, for the Record for XP dialog: the same arithmetic as
 * missionXP (p.452), so the line matches the report.
 */
export function antagonistPreview({ xp, special = false, full = false, scenes = 1 } = {}) {
  if (full) {
    const n = Math.max(1, Math.trunc(Number(scenes) || 1));
    return loc`Adds ${M.fullSpecialXPPerScene * n} XP: ${M.fullSpecialXPPerScene} for each of ${n} scene(s).`;
  }
  if (!Number.isFinite(Number(xp)) || Number(xp) < 0) return loc`Enter the NPC's XP reward.`;
  return special
    ? loc`Adds ${Number(xp) * M.specialMultiplier} XP: ${Number(xp)} × ${M.specialMultiplier} for a special NPC, once per mission.`
    : loc`Adds ${Number(xp)} XP, once per mission however many appear.`;
}
