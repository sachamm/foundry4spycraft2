import { loc } from "../i18n.mjs";
import { campaignXP } from "./campaign-creation.mjs";

const levelOf = system => system.progression?.length ?? system.level ?? 0;
const careerLevel = value => Number.isSafeInteger(value) && value >= 0 && value <= 20;

/** Kept in the same settings transaction as the mission period, including its rollback journal. */
export function missionLevelSnapshot(actors, mission) {
  const levels = {};
  for (const actor of actors.filter(a => a.type === "agent" && !a.system.companionOf?.ownerUuid)) {
    const level = levelOf(actor.system);
    if (!careerLevel(level) || typeof actor.uuid !== "string" || !actor.uuid)
      throw new Error(loc`Review character levels before starting the mission.`);
    levels[actor.uuid] = level;
  }
  return { version: 1, mission, levels };
}

export function advancementPlan(
  system,
  cfg,
  { actorUuid, periods = {}, missionActive = false, effects = {}, review = null } = {}
) {
  const level = levelOf(system),
    next = level + 1;
  const mission = String(periods.mission ?? "initial");
  const fail = reason => ({ allowed: false, reason, mission, next });
  if (!careerLevel(level) || next > 20) return fail(loc`A career cannot exceed level 20.`);
  if (system.companionOf?.ownerUuid || next === 1 || (mission === "initial" && !missionActive))
    return { allowed: true, mission, next, creation: true };
  const reviewed =
    review?.version === 1 &&
    review.mission === mission &&
    review.confirmed === true &&
    typeof review.note === "string" &&
    !!review.note.trim();
  if (reviewed && review.mode === "grant" && careerLevel(review.ceiling) && next <= review.ceiling)
    return { allowed: true, mission, next, gcGrant: true };
  if (missionActive)
    return fail(
      loc`Gain career levels between missions. The GC can review a new character's starting level or a specific level grant.`
    );
  const snapshot = periods.missionCareerLevels;
  const baseline =
    reviewed && review.mode === "history"
      ? review.baseline
      : snapshot?.version === 1 && snapshot.mission === mission && Object.hasOwn(snapshot.levels ?? {}, actorUuid)
        ? snapshot.levels[actorUuid]
        : null;
  if (!careerLevel(baseline))
    return fail(loc`The GC must review this character's level at the start of the last mission before advancement.`);
  const limit = effects.betweenMissionLevels ?? 1;
  if (![1, 2].includes(limit)) return fail(loc`Review the campaign's between-mission level limit.`);
  if (next > baseline + limit)
    return fail(
      loc`Only ${limit} career level(s) may be gained between these missions. Keep excess XP for advancement after the next mission.`
    );
  const minimumXP = campaignXP(cfg.tables.levels[next]?.xp, effects);
  if (!Number.isFinite(minimumXP) || !Number.isFinite(system.xp) || system.xp < minimumXP)
    return fail(loc`Career Level ${next} requires ${minimumXP} XP. The GC can review a specific level grant.`);
  return { allowed: true, mission, next, baseline, limit, minimumXP };
}
