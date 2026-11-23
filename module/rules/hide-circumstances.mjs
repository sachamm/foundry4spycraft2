import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Current Hide circumstances, p.161; Ghost Supremacy's hiding-place exception, p.195. */
export function hideCircumstancePlan(
  system,
  key,
  check,
  {
    hideCircumstances = false,
    hideAreaPeople = null,
    hideApparentPlace = true,
    hideLocationKnown = false,
    hideDistractionOpportunity = false,
    hideCircumstancesConfirmed = false
  } = {}
) {
  const empty = { evidence: null, baseAbility: null, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (hideCircumstances === false) return empty;
  if (hideCircumstances !== true || key !== "sneak" || check?.id !== "hide")
    return reject(loc`Declare these current circumstances only for a Sneak/Hide check.`);
  if (
    hideCircumstancesConfirmed !== true ||
    [hideApparentPlace, hideLocationKnown, hideDistractionOpportunity].some(v => typeof v !== "boolean") ||
    !Number.isSafeInteger(hideAreaPeople) ||
    hideAreaPeople < 0
  )
    return reject(
      loc`The GC must confirm the actual people in this 30-ft. × 30-ft. area, apparent hiding place and observer/distraction circumstances.`
    );
  if (hideLocationKnown && !hideDistractionOpportunity)
    return reject(
      loc`An observer who knows your location must have an actual distraction opportunity before you can escape detection with Hide (p.161), including with Ghost Supremacy.`
    );
  const sources = [];
  if (!hideApparentPlace) {
    if (!Array.isArray(system?.activeFeatNames) || system.activeFeatNames.some(n => typeof n !== "string" || !n.trim()))
      return reject(loc`Review the character’s current qualified Ghost sources.`);
    if (!system.activeFeatNames.includes("Ghost Supremacy"))
      return reject(loc`Hiding without an apparent place requires current qualified Ghost Supremacy (p.195).`);
    sources.push("Ghost Supremacy");
  }
  const baseAbility = hideAreaPeople < 10 ? "dex" : "cha";
  const evidence = {
    version: 1,
    skillKey: key,
    checkId: check.id,
    areaFeet: 30,
    areaPeople: hideAreaPeople,
    apparentPlace: hideApparentPlace,
    locationKnown: hideLocationKnown,
    distractionOpportunity: hideDistractionOpportunity,
    confirmed: true,
    baseAbility,
    sources
  };
  return {
    evidence,
    baseAbility,
    blockedReason: "",
    notes: [
      loc`GC-confirmed Hide area: ${hideAreaPeople} people in 30 ft. × 30 ft.; normal key attribute ${baseAbility.toUpperCase()} (p.161), before any actual attribute substitution.`,
      ...(sources.length ? [loc`Ghost Supremacy permits this check without an apparent hiding place (p.195).`] : []),
      ...(hideLocationKnown
        ? [
            loc`The observer knows your location; the GC confirms an actual opportunity to duck away while distracted (p.161).`
          ]
        : []),
      loc`Resolve the opposed observer result and any gained/lost hidden state separately.`
    ]
  };
}
export function validateHideCircumstanceProof(
  system,
  proof,
  { checkKind, skillKey, checkId, ability, attributeSubstitution } = {}
) {
  if (!proof) return;
  const p = hideCircumstancePlan(
    system,
    skillKey,
    { id: checkId },
    {
      hideCircumstances: true,
      hideAreaPeople: proof.areaPeople,
      hideApparentPlace: proof.apparentPlace,
      hideLocationKnown: proof.locationKnown,
      hideDistractionOpportunity: proof.distractionOpportunity,
      hideCircumstancesConfirmed: proof.confirmed
    }
  );
  const substituted =
    attributeSubstitution?.source === "All According to Plan" &&
    attributeSubstitution.originalAbility === proof.baseAbility &&
    attributeSubstitution.ability === "int" &&
    (system.classLevels?.schemer ?? 0) >= 4;
  if (ability !== undefined && ability !== (substituted ? "int" : proof.baseAbility))
    throw Error(loc`The Hide key attribute or actual substitution source changed before posting.`);
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(loc`The Hide circumstances or qualified Ghost Supremacy source changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "hideCircumstance",
  order: 1530,
  record: ["hideCircumstances"],
  validate: ({ actor, options, checkKind, checkId, skillKey, ability }) =>
    validateHideCircumstanceProof(actor.system, options.hideCircumstances, {
      checkKind,
      skillKey,
      checkId,
      ability,
      attributeSubstitution: options.attributeSubstitution
    })
});
