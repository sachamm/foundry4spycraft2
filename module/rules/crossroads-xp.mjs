import { TABLES } from "./tables.mjs";
import { loc } from "../i18n.mjs";
const titles = TABLES.crossroads;
const keys = Object.keys(titles).sort((a, b) => titles[a].level - titles[b].level);
export const crossroadsMissionKey = mission => encodeURIComponent(String(mission)).replaceAll(".", "%2E");
const rank = title => (title === "" ? -1 : keys.indexOf(title));
const valid = title => title === "" || (typeof title === "string" && Object.hasOwn(titles, title));

export function ownedCrossroadsTitle(system) {
  const title = system.crossroadsTitle ?? "";
  if (title && system.classLevels && Object.values(system.classLevels).reduce((sum, n) => sum + n, 0) !== system.level)
    throw Error(loc`Review the character's actual class progression before applying Crossroads title benefits.`);
  if (!valid(title) || (title && (!Number.isSafeInteger(system.level) || system.level < titles[title].level)))
    throw Error(loc`Review the character's actual GC-confirmed Crossroads title and minimum career level.`);
  return title;
}

/** A mission-start entry, including an empty title, prevents a later award from modifying the same mission's XP. */
export function crossroadsMissionXPPolicy(
  system,
  { mission = system.usagePeriods?.mission ?? "initial", actorUuid = system.actorUuid } = {}
) {
  const ownedTitle = ownedCrossroadsTitle(system),
    percent = ownedTitle ? titles[ownedTitle].xpPercent : 0;
  const base = { version: 1, mission: String(mission), actorUuid, ownedTitle };
  if (!percent) return { ...base, eligibleTitle: null, percent: 0, source: "no-xp-difference", needsReview: false };
  if (typeof actorUuid !== "string" || !actorUuid)
    throw Error(loc`Identify the actual character before resolving Crossroads XP eligibility.`);
  const review = system.crossroadsMissionReviews?.[crossroadsMissionKey(mission)],
    snapshot = system.usagePeriods?.missionCareerLevels;
  let eligibleTitle, source, reviewId;
  if (review) {
    if (
      review.version !== 1 ||
      review.confirmed !== true ||
      review.mission !== String(mission) ||
      review.actorUuid !== actorUuid ||
      !valid(review.eligibleTitle) ||
      !valid(review.ownedTitle) ||
      rank(review.eligibleTitle) > rank(review.ownedTitle) ||
      typeof review.id !== "string" ||
      !review.id ||
      typeof review.note !== "string" ||
      !review.note.trim() ||
      typeof review.reviewerId !== "string" ||
      !review.reviewerId
    )
      throw Error(loc`Review the saved Crossroads XP eligibility record before settling this mission.`);
    eligibleTitle = review.eligibleTitle;
    source = "gc-review";
    reviewId = review.id;
  } else if (
    snapshot?.version === 1 &&
    snapshot.mission === String(mission) &&
    Object.hasOwn(snapshot.crossroadsTitles ?? {}, actorUuid)
  ) {
    eligibleTitle = snapshot.crossroadsTitles[actorUuid];
    source = "mission-start";
    if (!valid(eligibleTitle)) throw Error(loc`Review the mission-start Crossroads title record.`);
    if (
      eligibleTitle &&
      (!Number.isSafeInteger(snapshot.levels?.[actorUuid]) || snapshot.levels[actorUuid] < titles[eligibleTitle].level)
    )
      throw Error(loc`Review the mission-start career level for this Crossroads title.`);
  } else return { ...base, eligibleTitle: null, percent: null, source: "unknown-history", needsReview: true };
  const effectiveTitle = rank(eligibleTitle) > rank(ownedTitle) ? ownedTitle : eligibleTitle;
  return {
    ...base,
    eligibleTitle: effectiveTitle,
    percent: effectiveTitle ? titles[effectiveTitle].xpPercent : 0,
    source,
    ...(reviewId ? { reviewId } : {}),
    needsReview: false
  };
}

/** User ruling: round the separate Crossroads XP bonus up, after the p.440 mission multiplier. */
export function crossroadsMissionXPBonus(coreXP, policy) {
  if (
    !Number.isSafeInteger(coreXP) ||
    coreXP < 0 ||
    policy?.version !== 1 ||
    policy.needsReview ||
    ![0, 5, 10].includes(policy.percent)
  )
    throw Error(loc`The GC must establish this mission's Crossroads XP eligibility before calculating its bonus.`);
  return Number((BigInt(coreXP) * BigInt(policy.percent) + 99n) / 100n);
}

export function crossroadsMissionXPReviewPlan(
  system,
  { id, mission, actorUuid, eligibleTitle, note, reviewerId, confirmed = false } = {}
) {
  const ownedTitle = ownedCrossroadsTitle(system);
  if (
    confirmed !== true ||
    !valid(eligibleTitle) ||
    rank(eligibleTitle) > rank(ownedTitle) ||
    typeof note !== "string" ||
    !note.trim() ||
    note.trim().length > 500 ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,60}$/.test(id) ||
    typeof reviewerId !== "string" ||
    !reviewerId ||
    typeof actorUuid !== "string" ||
    !actorUuid ||
    String(mission) !== String(system.usagePeriods?.mission ?? "initial") ||
    !Number.isFinite(system.worldTime)
  )
    throw Error(
      loc`Confirm the title actually eligible when this mission began, the current mission and a bounded GC review note.`
    );
  return {
    version: 1,
    id,
    mission: String(mission),
    actorUuid,
    eligibleTitle,
    ownedTitle,
    note: note.trim(),
    reviewerId,
    confirmed: true,
    at: system.worldTime
  };
}

export const crossroadsTitleChoices = system => {
  const owned = ownedCrossroadsTitle(system);
  return keys
    .filter(key => rank(key) <= rank(owned))
    .map(key => ({ value: key, label: titles[key].label, percent: titles[key].xpPercent }));
};
