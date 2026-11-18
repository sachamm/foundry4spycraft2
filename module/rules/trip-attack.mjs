import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { responseOwnSize, tripSizeIndex } from "./trip.mjs";
export { TRIP_SIZES } from "./trip.mjs";
/** Ordinary half-action Trip p.361. Weapon qualities, free actions and settlement are separate. */
export function tripAttackSkillChecks(key, checks = []) {
  if (key !== "acrobatics") return checks;
  return [
    ...checks.filter(c => c.id !== "trip"),
    {
      id: "trip",
      name: "Trip Action",
      attributes: ["dex"],
      mode: "Active",
      tags: "Armor Check Penalty",
      error: 2,
      time: "1 Half Action",
      page: 361,
      synergies: [],
      combatAction: "trip",
      role: "attacker"
    }
  ];
}
export function tripCounterSkillCheck() {
  return {
    ...tripAttackSkillChecks("acrobatics")[0],
    id: "counter-trip",
    name: "Earned Counter-Trip",
    time: "Free action"
  };
}
export function tripAttackPlan(
  system,
  key,
  check,
  {
    method = "roll",
    tripAttackOpponentName = "",
    tripAttackOpponentUuid = "",
    tripAttackOpponentSize = null,
    tripAttackAdjacent = false,
    tripAttackSizeDifference = null,
    tripAttackParticipantsConfirmed = false,
    tripAttackHalfActionConfirmed = false,
    tripAttackCombat = null,
    tripCounter = null
  } = {}
) {
  const empty = { evidence: null, sizeBonus: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (key !== "acrobatics" || !["trip", "counter-trip"].includes(check?.id)) return empty;
  const counter = check.id === "counter-trip";
  if (counter) {
    if (
      tripCounter?.version !== 1 ||
      tripCounter.depth !== 1 ||
      !["id", "sourceMessage", "defenderMessage", "operationId", "actorUuid", "targetUuid", "activeCombatantId"].every(
        k => typeof tripCounter[k] === "string" && tripCounter[k] && tripCounter[k].length <= 500
      ) ||
      tripCounter.targetUuid !== tripAttackOpponentUuid
    )
      return reject("An actual earned counter-Trip source and its original opponent are required.");
  } else if (tripCounter) return reject("Use the earned Counter-Trip control for that free action.");
  if (method !== "roll") return reject("Trip is an opposed combat action; taking10/20 is unavailable (pp.91,352).");
  if (!validOwnCountClock(tripAttackCombat) || (!counter && tripAttackCombat.turn !== tripAttackCombat.ownTurnIndex))
    return reject(
      counter
        ? "Take the earned free counter-Trip in its started combat during the original participant’s Count."
        : "Take the ordinary Trip half action during your Initiative Count in a started combat."
    );
  const unavailable = attributeActionBlock(system, { kind: "skill", ability: "dex" }) || restraintActionBlock(system);
  if (unavailable) return reject(unavailable);
  if (
    typeof tripAttackOpponentName !== "string" ||
    !tripAttackOpponentName.trim() ||
    tripAttackOpponentName.trim().length > 200 ||
    typeof tripAttackOpponentUuid !== "string" ||
    tripAttackOpponentUuid.length > 500 ||
    ![tripAttackAdjacent, tripAttackParticipantsConfirmed, ...(counter ? [] : [tripAttackHalfActionConfirmed])].every(
      v => v === true
    ) ||
    !Number.isSafeInteger(tripAttackSizeDifference) ||
    Math.abs(tripAttackSizeDifference) > 11
  )
    return reject(
      counter
        ? "Confirm the actual adjacent original attacker, both Sizes and a legal earned free reaction."
        : "Name the actual adjacent opposing character and confirm the participants, actual Size difference and available half action."
    );
  if (tripAttackSizeDifference < -1)
    return reject("An ordinary Trip cannot target an opponent more than one Size category larger than you (p.361).");
  let ownSize;
  try {
    ownSize = responseOwnSize(system);
  } catch (error) {
    return reject(error.message);
  }
  if (
    tripAttackOpponentSize !== null &&
    (typeof tripAttackOpponentSize !== "string" ||
      !tripAttackOpponentSize.trim() ||
      tripAttackOpponentSize.length > 200)
  )
    return reject("Review the opponent’s actual current Size.");
  const ownIndex = tripSizeIndex(ownSize),
    opponentIndex = tripSizeIndex(tripAttackOpponentSize);
  if (ownIndex >= 0 && opponentIndex >= 0 && ownIndex - opponentIndex !== tripAttackSizeDifference)
    return reject("The reviewed Size difference does not match these characters’ known current Sizes.");
  const sizeBonus = 4 * Math.max(0, tripAttackSizeDifference),
    evidence = {
      version: counter ? 2 : 1,
      ...(counter ? { counterTrip: structuredClone(tripCounter) } : {}),
      skillKey: key,
      checkId: check.id,
      role: "attacker",
      ownSize,
      opponentUuid: tripAttackOpponentUuid,
      opponentName: tripAttackOpponentName.trim(),
      opponentSize: tripAttackOpponentSize,
      adjacent: true,
      participantsConfirmed: true,
      halfActionConfirmed: !counter,
      sizeDifference: tripAttackSizeDifference,
      sizeBonus,
      combat: structuredClone(tripAttackCombat)
    };
  return {
    ...empty,
    evidence,
    sizeBonus,
    notes: [
      `${counter ? "Earned free counter-Trip" : "Trip"} against ${tripAttackOpponentName.trim()}: ${counter ? "one earned free action" : "one half action"}, opposed Acrobatics(DEX), Armor Check Penalty, base error1 plus action error+1; only the larger participant gains+4per Size category. Your Size bonus +${sizeBonus} (pp.352,361).`,
      "For reciprocal recorded characters, finish both checks in chat and use Main’s Trip outcomes, then Trip final attack for an earned winning critical follow-up at−4. An original critical defensive win earns Main’s Counter-Trip; the second Trip never grants a third. Unrecorded opponents and weapon-quality variants remain separate."
    ]
  };
}
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
export function validateTripAttackProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", ability, attributeSubstitution, combat } = {}
) {
  if (!proof) return;
  const p = tripAttackPlan(
      system,
      skillKey,
      { id: checkId },
      {
        method: checkMethod,
        tripAttackOpponentName: proof.opponentName,
        tripAttackOpponentUuid: proof.opponentUuid,
        tripAttackOpponentSize: proof.opponentSize,
        tripAttackAdjacent: proof.adjacent,
        tripAttackSizeDifference: proof.sizeDifference,
        tripAttackParticipantsConfirmed: proof.participantsConfirmed,
        tripAttackHalfActionConfirmed: proof.halfActionConfirmed,
        tripAttackCombat: combat,
        ...(proof.version === 2 ? { tripCounter: proof.counterTrip } : {})
      }
    ),
    substituted =
      attributeSubstitution?.source === "All According to Plan" &&
      attributeSubstitution.originalAbility === "dex" &&
      attributeSubstitution.ability === "int" &&
      (system.classLevels?.schemer ?? 0) >= 4;
  if (ability !== undefined && ability !== (substituted ? "int" : "dex"))
    throw Error("The Trip attacker attribute or actual substitution source changed before posting.");
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(
      "The Trip attacker, actual opponent, adjacency, Size or legal Trip action context changed before posting."
    );
}
