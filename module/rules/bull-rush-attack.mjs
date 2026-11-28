import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { responseOwnSize } from "./trip.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** p.354 on-foot Bull Rush, chosen-target adjacency exception follows the user-confirmed p.326/p.354 ruling. */
export function bullRushAttackSkillChecks(key, checks = []) {
  if (key !== "athletics") return checks;
  return [
    ...checks.filter(c => c.id !== "bull-rush"),
    {
      id: "bull-rush",
      name: loc`Bull Rush (on foot)`,
      attributes: ["str"],
      mode: "Active",
      tags: "Armor Check Penalty",
      error: 1,
      time: "1 Full Action",
      page: 354,
      synergies: [],
      combatAction: "bull-rush",
      role: "attacker"
    }
  ];
}
export function bullRushAttackPlan(
  system,
  key,
  check,
  {
    method = "roll",
    bullRushAttackOpponentName = "",
    bullRushAttackSizeDifference = null,
    bullRushAttackDistanceFeet = null,
    bullRushAttackOnFootConfirmed = false,
    bullRushAttackRouteConfirmed = false,
    bullRushAttackContactConfirmed = false,
    bullRushAttackFullActionConfirmed = false,
    bullRushAttackTargetThreatening = false,
    bullRushAttackOtherThreatAdjacency = false,
    bullRushAttackPassesOtherThreat = false,
    bullRushAttackCombat = null
  } = {}
) {
  const empty = { evidence: null, sizeBonus: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (key !== "athletics" || check?.id !== "bull-rush") return empty;
  if (method !== "roll")
    return reject(loc`Bull Rush is an opposed combat action; taking 10/20 is unavailable (pp.91,352).`);
  if (!validOwnCountClock(bullRushAttackCombat) || bullRushAttackCombat.turn !== bullRushAttackCombat.ownTurnIndex)
    return reject(loc`Take this normal full-action Bull Rush during your Initiative Count in a started combat.`);
  if (
    typeof bullRushAttackOpponentName !== "string" ||
    !bullRushAttackOpponentName.trim() ||
    bullRushAttackOpponentName.trim().length > 200 ||
    ![
      bullRushAttackOnFootConfirmed,
      bullRushAttackRouteConfirmed,
      bullRushAttackContactConfirmed,
      bullRushAttackFullActionConfirmed
    ].every(v => v === true) ||
    ![bullRushAttackTargetThreatening, bullRushAttackOtherThreatAdjacency, bullRushAttackPassesOtherThreat].every(
      v => typeof v === "boolean"
    ) ||
    !Number.isSafeInteger(bullRushAttackSizeDifference) ||
    Math.abs(bullRushAttackSizeDifference) > 11
  )
    return reject(
      loc`The GC must confirm the actual on-foot opponent, straight legal route/contact, full action, threatening adjacency and actual Size difference (your Size minus the target’s).`
    );
  if (bullRushAttackOtherThreatAdjacency || bullRushAttackPassesOtherThreat)
    return reject(
      loc`Another threatening opponent prevents this ordinary movement route (p.326); review an actual movement exception separately.`
    );
  if (bullRushAttackSizeDifference < -1)
    return reject(loc`The ordinary Bull Rush target cannot be more than one Size category larger than you (p.354).`);
  const blocked = restraintActionBlock(system) || attributeActionBlock(system, { kind: "skill", ability: "str" });
  if (
    blocked ||
    system.postureMovement?.bullRush === false ||
    system.incapacitatedForMovement === true ||
    system.encumbrance?.immobile === true ||
    system.wounds?.value < 0
  )
    return reject(blocked || loc`The current posture, condition or immobility prevents Bull Rush movement.`);
  const speed = system.speed;
  if (!Number.isFinite(speed) || speed <= 0 || system.conditionSpeedReview)
    return reject(loc`Review current Speed before this Bull Rush movement.`);
  if (
    typeof bullRushAttackDistanceFeet !== "number" ||
    !Number.isFinite(bullRushAttackDistanceFeet) ||
    bullRushAttackDistanceFeet <= 0 ||
    bullRushAttackDistanceFeet > speed
  )
    return reject(
      loc`Enter positive counted direct movement no greater than current Speed; this full action does not use the Run or Total Defense allowance.`
    );
  let ownSize;
  try {
    ownSize = responseOwnSize(system);
  } catch (error) {
    return reject(error.message);
  }
  const sizeBonus = 4 * Math.max(0, bullRushAttackSizeDifference),
    evidence = {
      version: 1,
      skillKey: key,
      checkId: check.id,
      scope: "on-foot-target",
      ownSize,
      opponentName: bullRushAttackOpponentName.trim(),
      sizeDifference: bullRushAttackSizeDifference,
      sizeBonus,
      distanceFeet: bullRushAttackDistanceFeet,
      speed,
      maximumFeet: speed,
      onFootConfirmed: true,
      routeConfirmed: true,
      contactConfirmed: true,
      fullActionConfirmed: true,
      targetThreatening: bullRushAttackTargetThreatening,
      chosenTargetAdjacencyException: true,
      otherThreatAdjacency: false,
      passesOtherThreat: false,
      combat: structuredClone(bullRushAttackCombat)
    };
  return {
    ...empty,
    evidence,
    sizeBonus,
    notes: [
      loc`Bull Rush: one full action, opposed Athletics(STR), Armor Check Penalty and action error+0; ${bullRushAttackDistanceFeet}/${speed} counted ft. directly toward the target; your Size bonus +${sizeBonus} (p.354).`,
      loc`Still Standing applies to resistance, not this attacking check. The chosen target’s threatening adjacency does not stop this Bull Rush; other threatening opponents still do. Take the legal full action and resolve movement, opposed result, pushing, obstructions, damage, conditions and final attacks separately.`
    ]
  };
}
export function validateBullRushAttackProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", ability, attributeSubstitution, combat } = {}
) {
  if (!proof) return;
  const p = bullRushAttackPlan(
    system,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      bullRushAttackOpponentName: proof.opponentName,
      bullRushAttackSizeDifference: proof.sizeDifference,
      bullRushAttackDistanceFeet: proof.distanceFeet,
      bullRushAttackOnFootConfirmed: proof.onFootConfirmed,
      bullRushAttackRouteConfirmed: proof.routeConfirmed,
      bullRushAttackContactConfirmed: proof.contactConfirmed,
      bullRushAttackFullActionConfirmed: proof.fullActionConfirmed,
      bullRushAttackTargetThreatening: proof.targetThreatening,
      bullRushAttackOtherThreatAdjacency: proof.otherThreatAdjacency,
      bullRushAttackPassesOtherThreat: proof.passesOtherThreat,
      bullRushAttackCombat: combat
    }
  );
  const substituted =
    attributeSubstitution?.source === "All According to Plan" &&
    attributeSubstitution.originalAbility === "str" &&
    attributeSubstitution.ability === "int" &&
    (system.classLevels?.schemer ?? 0) >= 4;
  if (ability !== undefined && ability !== (substituted ? "int" : "str"))
    throw Error(loc`The Bull Rush attacker attribute or actual substitution source changed before posting.`);
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(
      loc`The Bull Rush attack route, current Size/Speed, posture or Initiative Count changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "bullRushAttack",
  order: 1410,
  record: ["bullRushAttack"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey, ability }) =>
    validateBullRushAttackProof(actor.system, options.bullRushAttack, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      ability,
      attributeSubstitution: options.attributeSubstitution,
      combat: actor.mentalLeapCombatContext()
    })
});
rollPipeline.register({
  id: "bullRushAttackChecks",
  order: 5100,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => bullRushAttackSkillChecks(skillKey, checks)
});

// A Bull Rush on foot, in a skill check's plan.
rollPipeline.register({
  id: "bullRushAttackSkillTerm",
  kinds: ["skill"],
  order: 9250,
  terms({ system, skillKey, check, method, input }) {
    const {
      bullRushAttackOpponentName = "",
      bullRushAttackSizeDifference = null,
      bullRushAttackDistanceFeet = null,
      bullRushAttackOnFootConfirmed = false,
      bullRushAttackRouteConfirmed = false,
      bullRushAttackContactConfirmed = false,
      bullRushAttackFullActionConfirmed = false,
      bullRushAttackTargetThreatening = false,
      bullRushAttackOtherThreatAdjacency = false,
      bullRushAttackPassesOtherThreat = false,
      bullRushAttackCombat = null
    } = input;
    const plan = bullRushAttackPlan(system, skillKey, check, {
      method,
      bullRushAttackOpponentName,
      bullRushAttackSizeDifference,
      bullRushAttackDistanceFeet,
      bullRushAttackOnFootConfirmed,
      bullRushAttackRouteConfirmed,
      bullRushAttackContactConfirmed,
      bullRushAttackFullActionConfirmed,
      bullRushAttackTargetThreatening,
      bullRushAttackOtherThreatAdjacency,
      bullRushAttackPassesOtherThreat,
      bullRushAttackCombat
    });
    return skillPlanTerm("bullRushAttack", plan, { noteAt: 60, blockAt: 40 });
  }
});
