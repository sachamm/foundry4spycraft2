import { TABLES } from "./tables.mjs";
import { ownedCrossroadsTitle, crossroadsMissionKey } from "./crossroads-xp.mjs";
import { loc } from "../i18n.mjs";

const titles = TABLES.crossroads;
const keys = Object.keys(titles).sort((a, b) => titles[a].level - titles[b].level);
const rank = title => (title === "" ? -1 : keys.indexOf(title));
const valid = title => title === "" || (typeof title === "string" && Object.hasOwn(titles, title));

/** p.54: a title earned during this session first changes starting dice next session. */
export function crossroadsSessionPolicy(system) {
  const ownedTitle = ownedCrossroadsTitle(system),
    session = String(system.usagePeriods?.session ?? "initial"),
    base = { version: 1, session, actorUuid: system.actorUuid, ownedTitle };
  if (!ownedTitle)
    return { ...base, eligibleTitle: "", bonus: 0, nextBonus: 0, source: "no-title", needsReview: false };
  const nextBonus = titles[ownedTitle].actionDice,
    review = system.crossroadsSessionReviews?.[crossroadsMissionKey(session)],
    reset = system.sessionDiceReset;
  let eligibleTitle, source, reviewId;
  if (review) {
    if (
      review.version !== 1 ||
      review.confirmed !== true ||
      review.session !== session ||
      review.actorUuid !== system.actorUuid ||
      !valid(review.eligibleTitle) ||
      !valid(review.ownedTitle) ||
      rank(review.eligibleTitle) > rank(review.ownedTitle) ||
      !review.id ||
      typeof review.note !== "string" ||
      !review.note.trim() ||
      !review.reviewerId
    )
      throw Error(loc`Review the saved session Crossroads eligibility record.`);
    eligibleTitle = review.eligibleTitle;
    source = "gc-review";
    reviewId = review.id;
  } else if (reset?.session === session && Object.hasOwn(reset, "crossroadsTitle")) {
    if (
      reset.actorUuid !== system.actorUuid ||
      !valid(reset.crossroadsTitle) ||
      (reset.crossroadsTitle &&
        (!Number.isSafeInteger(reset.level) || reset.level < titles[reset.crossroadsTitle].level))
    )
      throw Error(loc`Review the session-start Crossroads title and career level.`);
    eligibleTitle = reset.crossroadsTitle;
    source = "session-start";
  } else {
    // Preserve legacy prepared counts and all actual balances until the GC establishes their history.
    return { ...base, eligibleTitle: null, bonus: nextBonus, nextBonus, source: "unknown-history", needsReview: true };
  }
  if (rank(eligibleTitle) > rank(ownedTitle)) eligibleTitle = ownedTitle;
  return {
    ...base,
    eligibleTitle,
    bonus: eligibleTitle ? titles[eligibleTitle].actionDice : 0,
    nextBonus,
    source,
    ...(reviewId ? { reviewId } : {}),
    needsReview: false
  };
}

export function crossroadsSessionReviewPlan(system, { id, eligibleTitle, note, reviewerId, confirmed } = {}) {
  const ownedTitle = ownedCrossroadsTitle(system);
  if (
    confirmed !== true ||
    !valid(eligibleTitle) ||
    rank(eligibleTitle) > rank(ownedTitle) ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,60}$/.test(id) ||
    typeof note !== "string" ||
    !note.trim() ||
    note.trim().length > 500 ||
    typeof reviewerId !== "string" ||
    !reviewerId ||
    typeof system.actorUuid !== "string" ||
    !system.actorUuid ||
    !Number.isFinite(system.worldTime)
  )
    throw Error(loc`Confirm this session's actual title eligibility and a bounded GC review note.`);
  return {
    version: 1,
    id,
    session: String(system.usagePeriods?.session ?? "initial"),
    actorUuid: system.actorUuid,
    ownedTitle,
    eligibleTitle,
    note: note.trim(),
    reviewerId,
    confirmed: true,
    at: system.worldTime
  };
}

/** The engine records the original die's Fortune multiplier; a prepared d12 alone does not imply doubling. */
export function nextSessionStartingDice(system) {
  const starting = system.actionDice?.max,
    calculation = system.actionDice?.crossroadsCalculation;
  if (!Number.isSafeInteger(starting) || starting < 0) throw Error(loc`Review the prepared starting action-die count.`);
  if (!system.crossroadsTitle) return starting;
  const owned = ownedCrossroadsTitle(system);
  if (
    !calculation ||
    calculation.ownedTitle !== owned ||
    ![0, 1, 2].includes(calculation.currentBonus) ||
    calculation.nextBonus !== titles[owned].actionDice ||
    ![1, 2].includes(calculation.multiplier)
  )
    throw Error(loc`Prepare the character's Crossroads starting-dice calculation before beginning a session.`);
  const result = calculation.fixed
    ? starting
    : starting + (calculation.nextBonus - calculation.currentBonus) * calculation.multiplier;
  if (!Number.isSafeInteger(result) || result < 0)
    throw Error(loc`Review the next session's starting action-die count.`);
  return result;
}
