import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { DISARM_SIZES } from "./disarm.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** p.354; user-confirmed ruling: borrow only Maneuver's skill/attribute, not its named-check benefits. */
export const CONVEYANCE_BULL_RUSH_PROFILES = {
  acrobatics: { kind: "personalVehicle", label: "personal vehicle", ability: "dex" },
  drive: { kind: "vehicle", label: "non-personal vehicle without crew", ability: "dex", focusRequired: true },
  survival: { kind: "mount", label: "animal mount", ability: "cha" },
  tactics: { kind: "crewedVehicle", label: "vehicle with crew", ability: "cha" }
};
export const CONVEYANCE_BULL_RUSH_SIZES = DISARM_SIZES;
export function conveyanceBullRushSkillChecks(key, checks = []) {
  const profile = CONVEYANCE_BULL_RUSH_PROFILES[key];
  if (!profile) return checks;
  return [
    ...checks.filter(c => c.id !== "conveyance-bull-rush"),
    {
      id: "conveyance-bull-rush",
      name: "Bull Rush (conveyance)",
      attributes: [profile.ability],
      mode: "Active",
      tags: "",
      error: 1,
      time: "1 Full Action",
      page: 354,
      synergies: [],
      combatAction: "bull-rush",
      role: "attacker",
      operatorKind: profile.kind
    }
  ];
}
/** Conveyance stats are explicit current GC declarations until a structured vehicle/mount model supplies them. */
export function conveyanceBullRushPlan(
  system,
  key,
  check,
  {
    method = "roll",
    focus = "",
    purelyMentalConfirmed = false,
    conveyanceBullRushName = "",
    conveyanceBullRushTargetName = "",
    conveyanceBullRushSize = "",
    conveyanceBullRushTargetSize = "",
    conveyanceBullRushAllowanceFeet = null,
    conveyanceBullRushDistanceFeet = null,
    conveyanceBullRushTargetThreatening = false,
    conveyanceBullRushOtherThreatAdjacency = false,
    conveyanceBullRushPassesOtherThreat = false,
    conveyanceBullRushControlConfirmed = false,
    conveyanceBullRushStatsConfirmed = false,
    conveyanceBullRushRouteConfirmed = false,
    conveyanceBullRushContactConfirmed = false,
    conveyanceBullRushFullActionConfirmed = false,
    conveyanceBullRushCombat = null
  } = {}
) {
  const empty = { evidence: null, sizeBonus: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (check?.id !== "conveyance-bull-rush") return empty;
  const profile = CONVEYANCE_BULL_RUSH_PROFILES[key];
  if (!profile) return reject(loc`Choose the appropriate Acrobatics, Drive, Survival or Tactics operator skill.`);
  if (method !== "roll")
    return reject(loc`Bull Rush is an opposed combat action; taking10/20 is unavailable (pp.91,352).`);
  if (
    !validOwnCountClock(conveyanceBullRushCombat) ||
    conveyanceBullRushCombat.turn !== conveyanceBullRushCombat.ownTurnIndex
  )
    return reject(loc`Take this full-action conveyance Bull Rush during your Initiative Count in a started combat.`);
  const named = v => typeof v === "string" && v.trim() && v.trim().length <= 200;
  if (
    !named(conveyanceBullRushName) ||
    !named(conveyanceBullRushTargetName) ||
    ![
      conveyanceBullRushControlConfirmed,
      conveyanceBullRushStatsConfirmed,
      conveyanceBullRushRouteConfirmed,
      conveyanceBullRushContactConfirmed,
      conveyanceBullRushFullActionConfirmed
    ].every(v => v === true) ||
    ![
      conveyanceBullRushTargetThreatening,
      conveyanceBullRushOtherThreatAdjacency,
      conveyanceBullRushPassesOtherThreat,
      purelyMentalConfirmed
    ].every(v => typeof v === "boolean")
  )
    return reject(
      loc`The GC must confirm this actual conveyance/mount, appropriate controlling skill/focus, current Sizes/action allowance, direct legal route/contact and available full action.`
    );
  if (conveyanceBullRushOtherThreatAdjacency || conveyanceBullRushPassesOtherThreat)
    return reject(
      loc`Other threatening opponents stop this Bull Rush; the chosen-target exception does not waive their movement restrictions.`
    );
  const ownIndex = DISARM_SIZES.indexOf(conveyanceBullRushSize),
    targetIndex = DISARM_SIZES.indexOf(conveyanceBullRushTargetSize);
  if (ownIndex < 0 || targetIndex < 0)
    return reject(loc`Choose the actual rushing conveyance/mount and target Size categories.`);
  const sizeDifference = ownIndex - targetIndex;
  if (sizeDifference < -1)
    return reject(loc`The target cannot be more than one Size category larger than the rushing conveyance/mount.`);
  if (typeof focus !== "string" || focus.trim().length > 200 || (profile.focusRequired && !focus.trim()))
    return reject(
      loc`Choose the appropriate Drive focus for this actual vehicle; normal unowned-focus rules still apply.`
    );
  if (
    typeof conveyanceBullRushAllowanceFeet !== "number" ||
    !Number.isFinite(conveyanceBullRushAllowanceFeet) ||
    conveyanceBullRushAllowanceFeet <= 0 ||
    typeof conveyanceBullRushDistanceFeet !== "number" ||
    !Number.isFinite(conveyanceBullRushDistanceFeet) ||
    conveyanceBullRushDistanceFeet <= 0 ||
    conveyanceBullRushDistanceFeet > conveyanceBullRushAllowanceFeet
  )
    return reject(
      loc`Enter the GC-confirmed current full-action conveyance movement allowance and a positive counted direct distance within it, in feet. Do not substitute the operator’s foot Speed.`
    );
  const blocked =
    restraintActionBlock(system) ||
    attributeActionBlock(system, { kind: "skill", ability: profile.ability, purelyMentalConfirmed });
  if (blocked || system.conditionContext?.prone || system.conditionContext?.sprawled || system.wounds?.value < 0)
    return reject(blocked || loc`The operator’s current condition prevents this full-action Bull Rush.`);
  const sizeBonus = 4 * Math.max(0, sizeDifference),
    evidence = {
      version: 1,
      skillKey: key,
      checkId: check.id,
      kind: profile.kind,
      baseAbility: profile.ability,
      maneuverBenefits: false,
      armorCheckIgnored: true,
      conveyanceName: conveyanceBullRushName.trim(),
      targetName: conveyanceBullRushTargetName.trim(),
      conveyanceSize: conveyanceBullRushSize,
      targetSize: conveyanceBullRushTargetSize,
      sizeDifference,
      sizeBonus,
      allowanceFeet: conveyanceBullRushAllowanceFeet,
      distanceFeet: conveyanceBullRushDistanceFeet,
      focus: focus.trim(),
      purelyMentalConfirmed,
      targetThreatening: conveyanceBullRushTargetThreatening,
      chosenTargetAdjacencyException: true,
      otherThreatAdjacency: false,
      passesOtherThreat: false,
      controlConfirmed: true,
      statsConfirmed: true,
      routeConfirmed: true,
      contactConfirmed: true,
      fullActionConfirmed: true,
      combat: structuredClone(conveyanceBullRushCombat)
    };
  return {
    ...empty,
    evidence,
    sizeBonus,
    notes: [
      loc`Bull Rush with ${evidence.conveyanceName}: ${key.toUpperCase()}(${profile.ability.toUpperCase()}), full action; ${evidence.distanceFeet}/${evidence.allowanceFeet} GC-confirmed counted ft.; rushing Size ${evidence.conveyanceSize}, target ${evidence.targetSize}, Size bonus +${sizeBonus} (p.354).`,
      loc`Only the controlling skill and attribute are borrowed. Armor Check Penalty has no effect; Maneuver-only bonuses, synergies, tags, taking permissions and free-action benefits do not apply. Generic applicable skill/focus benefits still apply.`,
      loc`The GC supplies current conveyance facts and resolves movement, opposed outcome, pushing, obstructions, damage and other consequences. This does not model vehicle statistics or move a token.`
    ]
  };
}
export function validateConveyanceBullRushProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", ability, attributeSubstitution, combat } = {}
) {
  if (!proof) return;
  const p = conveyanceBullRushPlan(
    system,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      focus: proof.focus,
      purelyMentalConfirmed: proof.purelyMentalConfirmed,
      conveyanceBullRushName: proof.conveyanceName,
      conveyanceBullRushTargetName: proof.targetName,
      conveyanceBullRushSize: proof.conveyanceSize,
      conveyanceBullRushTargetSize: proof.targetSize,
      conveyanceBullRushAllowanceFeet: proof.allowanceFeet,
      conveyanceBullRushDistanceFeet: proof.distanceFeet,
      conveyanceBullRushTargetThreatening: proof.targetThreatening,
      conveyanceBullRushOtherThreatAdjacency: proof.otherThreatAdjacency,
      conveyanceBullRushPassesOtherThreat: proof.passesOtherThreat,
      conveyanceBullRushControlConfirmed: proof.controlConfirmed,
      conveyanceBullRushStatsConfirmed: proof.statsConfirmed,
      conveyanceBullRushRouteConfirmed: proof.routeConfirmed,
      conveyanceBullRushContactConfirmed: proof.contactConfirmed,
      conveyanceBullRushFullActionConfirmed: proof.fullActionConfirmed,
      conveyanceBullRushCombat: combat
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
    base = CONVEYANCE_BULL_RUSH_PROFILES[skillKey]?.ability,
    substituted =
      attributeSubstitution?.source === "All According to Plan" &&
      attributeSubstitution.originalAbility === base &&
      attributeSubstitution.ability === "int" &&
      (system.classLevels?.schemer ?? 0) >= 4;
  if (ability !== undefined && ability !== (substituted ? "int" : base))
    throw Error(loc`The conveyance Bull Rush attribute or actual substitution source changed before posting.`);
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(
      loc`The conveyance Bull Rush declaration, operator condition or Initiative Count changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "conveyanceBullRush",
  order: 1400,
  record: ["conveyanceBullRush"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey, ability }) =>
    validateConveyanceBullRushProof(actor.system, options.conveyanceBullRush, {
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
  id: "conveyanceBullRushChecks",
  order: 5110,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => conveyanceBullRushSkillChecks(skillKey, checks)
});
