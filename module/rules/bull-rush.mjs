import { responseOwnSize } from "./trip.mjs";
import { stillStandingResistancePlan } from "./still-standing.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
/** Ordinary target's on-foot Bull Rush response, p.354; action modifier+0, p.352. */
export function bullRushDefenseSkillChecks(key, checks = []) {
  if (key !== "athletics") return checks;
  return [
    ...checks.filter(c => c.id !== "resist-bull-rush"),
    {
      id: "resist-bull-rush",
      name: "Resist Bull Rush (on foot)",
      attributes: ["str"],
      mode: "Active",
      tags: "Armor Check Penalty",
      error: 1,
      time: "Opposed response",
      page: 354,
      synergies: [],
      combatAction: "bull-rush",
      role: "defender"
    }
  ];
}
export function bullRushDefensePlan(
  system,
  key,
  check,
  {
    method = "roll",
    bullRushOpponentName = "",
    bullRushSizeDifference = null,
    bullRushIncomingConfirmed = false,
    bullRushOnFootConfirmed = false,
    bullRushContactConfirmed = false
  } = {}
) {
  const empty = { evidence: null, bonuses: [], sizeBonus: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (key !== "athletics" || check?.id !== "resist-bull-rush") return empty;
  if (method !== "roll")
    return reject("Bull Rush is opposed and part of a combat action; taking10/20 is unavailable (pp.91,352).");
  if (
    typeof bullRushOpponentName !== "string" ||
    !bullRushOpponentName.trim() ||
    bullRushOpponentName.trim().length > 200 ||
    bullRushIncomingConfirmed !== true ||
    bullRushOnFootConfirmed !== true ||
    bullRushContactConfirmed !== true ||
    !Number.isSafeInteger(bullRushSizeDifference) ||
    Math.abs(bullRushSizeDifference) > 11
  )
    return reject(
      "Name the actual rushing opponent and confirm a legal on-foot targeted Bull Rush, contact in your square and actual Size difference (your Size minus the attacker’s). Mounted/vehicle and intervening-character checks use separate rules."
    );
  if (bullRushSizeDifference > 1)
    return reject(
      "An ordinary Bull Rush cannot target someone more than one Size category larger than the rushing character (p.354); review actual exceptions separately."
    );
  let stillStanding, ownSize;
  try {
    stillStanding = stillStandingResistancePlan(system, "bull-rush");
    ownSize = responseOwnSize(system);
  } catch (error) {
    return reject(error.message);
  }
  const sizeBonus = 4 * Math.max(0, bullRushSizeDifference),
    evidence = {
      version: 1,
      skillKey: key,
      checkId: check.id,
      ownSize,
      scope: "on-foot-target",
      opponentName: bullRushOpponentName.trim(),
      incomingConfirmed: true,
      onFootConfirmed: true,
      contactConfirmed: true,
      sizeDifference: bullRushSizeDifference,
      sizeBonus,
      stillStanding
    };
  return {
    ...empty,
    evidence,
    sizeBonus,
    bonuses: stillStanding.bonus ? [{ source: "Still Standing", type: "", value: stillStanding.bonus }] : [],
    notes: [
      `Resist Bull Rush: opposed Athletics(STR), Armor Check Penalty, action error modifier+0; larger participant +4 per Size category. Your Size bonus +${sizeBonus} (pp.352,354).`,
      ...(stillStanding.source
        ? [
            "Still Standing: +4 unnamed bonus to this skill check resisting Bull Rush (p.66); this is not a dodge bonus."
          ]
        : []),
      "This is the ordinary targeted response with both characters on foot. The GC resolves the opposed result, pushed distance, obstructions, damage, sprawled/final attacks and other consequences separately."
    ]
  };
}
export function validateBullRushDefenseProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", ability, attributeSubstitution } = {}
) {
  if (!proof) return;
  const p = bullRushDefensePlan(
    system,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      bullRushOpponentName: proof.opponentName,
      bullRushSizeDifference: proof.sizeDifference,
      bullRushIncomingConfirmed: proof.incomingConfirmed,
      bullRushOnFootConfirmed: proof.onFootConfirmed,
      bullRushContactConfirmed: proof.contactConfirmed
    }
  );
  const stable = v =>
      JSON.stringify(v, (_k, x) =>
        x && typeof x === "object" && !Array.isArray(x)
          ? Object.fromEntries(
              Object.keys(x)
                .sort()
                .map(k => [k, x[k]])
            )
          : x
      ),
    substituted =
      attributeSubstitution?.source === "All According to Plan" &&
      attributeSubstitution.originalAbility === "str" &&
      attributeSubstitution.ability === "int" &&
      (system.classLevels?.schemer ?? 0) >= 4;
  if (ability !== undefined && ability !== (substituted ? "int" : "str"))
    throw Error("The Bull Rush response attribute or actual substitution source changed before posting.");
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error("The Bull Rush response, actual Size or Still Standing source changed before posting.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "bullRushDefense",
  order: 1420,
  record: ["bullRushDefense"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey, ability }) =>
    validateBullRushDefenseProof(actor.system, options.bullRushDefense, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      ability,
      attributeSubstitution: options.attributeSubstitution
    })
});
rollPipeline.register({
  id: "bullRushDefenseChecks",
  order: 5090,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => bullRushDefenseSkillChecks(skillKey, checks)
});
