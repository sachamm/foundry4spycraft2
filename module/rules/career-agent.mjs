import { loc } from "../i18n.mjs";
export const careerAgentMissionKey = system =>
  "mission_" + encodeURIComponent(String(system.usagePeriods?.mission ?? "initial")).replaceAll(".", "%2E");
export function careerAgentRewardSource(system) {
  if (!system.activeFeatNames?.includes("Career Agent")) throw new Error(loc`An active Career Agent feat is required.`);
  if (!["faction", "freelance"].includes(system.affiliationType))
    throw new Error(loc`Choose the character’s actual Faction or Freelance affiliation.`);
  const freelance = system.affiliationType === "freelance";
  return {
    source: "Career Agent",
    affiliation: system.affiliationType,
    field: freelance ? "netWorth" : "reputation",
    amount: freelance ? 50000 : 1
  };
}
/** pp.60,208: the affiliation determines the additional end-of-mission resource. */
export function careerAgentRewardPlan(
  system,
  { missionCompleteConfirmed = false, activeAtMissionEndConfirmed = false, id = "", at = 0 } = {}
) {
  const source = careerAgentRewardSource(system),
    key = careerAgentMissionKey(system);
  if (missionCompleteConfirmed !== true || activeAtMissionEndConfirmed !== true)
    throw new Error(loc`Confirm the mission has ended and Career Agent was active at its end.`);
  if (system.careerAgentRewards?.[key])
    throw new Error(loc`The Career Agent reward for this mission is already recorded.`);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error(loc`A unique Career Agent reward receipt is required.`);
  const before = system[source.field],
    after = before + source.amount;
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after))
    throw new Error(loc`Review the resource balance before granting the mission reward.`);
  return {
    key,
    field: source.field,
    before,
    after,
    record: {
      version: 1,
      id,
      ...source,
      epoch: String(system.usagePeriods?.mission ?? "initial"),
      before,
      after,
      missionCompleteConfirmed: true,
      activeAtMissionEndConfirmed: true,
      at
    }
  };
}
export function getCareerAgentReview(actor) {
  const saved = actor.flags?.spycraft2?.careerAgentRewardReview,
    local = globalThis.game?.spycraft2?.pendingCareerAgentRewards?.[actor.uuid];
  if (saved?.needsReview) return saved;
  if (local?.needsReview && !(saved?.id === local.id && saved.needsReview === false)) return local;
  return saved ?? {};
}
export function careerAgentReviewPlan(
  review,
  { reputation, netWorth, retainReward, reason = "", confirmed = false } = {}
) {
  const t = review?.transaction,
    r = t?.record;
  if (
    !review?.needsReview ||
    !t ||
    review.id !== r?.id ||
    r.version !== 1 ||
    r.source !== "Career Agent" ||
    typeof r.epoch !== "string" ||
    t.key !== "mission_" + encodeURIComponent(r.epoch).replaceAll(".", "%2E") ||
    !["reputation", "netWorth"].includes(t.field) ||
    t.field !== r.field ||
    r.amount !== (r.field === "reputation" ? 1 : 50000) ||
    r.affiliation !== (r.field === "reputation" ? "faction" : "freelance") ||
    r.before !== t.before ||
    r.after !== t.after ||
    !Number.isSafeInteger(t.before) ||
    !Number.isSafeInteger(t.after) ||
    t.after !== t.before + r.amount
  )
    throw new Error(loc`The Career Agent review has no valid mission transaction.`);
  if (
    confirmed !== true ||
    typeof retainReward !== "boolean" ||
    !Number.isSafeInteger(reputation) ||
    !Number.isSafeInteger(netWorth) ||
    typeof reason !== "string" ||
    !reason.trim() ||
    reason.length > 1000
  )
    throw new Error(loc`Confirm both actual resource balances, the reward disposition and a reason.`);
  return {
    key: t.key,
    record: retainReward ? { ...r, reviewReason: reason.trim() } : null,
    reputation,
    netWorth,
    reason: reason.trim()
  };
}
