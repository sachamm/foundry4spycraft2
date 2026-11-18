import { loc } from "../i18n.mjs";
/** City prerequisites p.28; native option groups pp.42,46,51. Class prose specifies Tier II. */
export const ASSISTANT_SOURCES = {
  faculty: { classId: "scientist", name: "Faculty", template: "academic", page: 42, kitGrade: 1 },
  friendsOnForce: {
    classId: "sleuth",
    name: "Friends on the Force",
    template: "police officer",
    page: 46,
    kitGrade: 0
  },
  pitCrew: { classId: "wheelman", name: "Pit Crew", template: "tool-pusher", page: 51, kitGrade: 1 }
};
export function assistantSource(system, id) {
  const source = Object.hasOwn(ASSISTANT_SOURCES, id) ? ASSISTANT_SOURCES[id] : null;
  return source &&
    (system.classOptionSelections ?? []).some(s => s.classId === source.classId && s.name === source.name)
    ? { ...source, id }
    : null;
}
export function sceneSequence(periods) {
  const n = periods?.sceneSequence ?? 0;
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(loc`Review the saved scene sequence before tracking assistant duration.`);
  return n;
}
export function assistantSummonPlan(
  system,
  id,
  {
    groupId,
    city = "",
    population,
    quickContactConfirmed = false,
    nonCombatConfirmed = false,
    gcHelpApproved = false
  } = {}
) {
  const source = assistantSource(system, id);
  if (!source) throw new Error(loc`This summoned-assistant option is not currently earned.`);
  if (
    typeof groupId !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(groupId) ||
    (system.assistantGroups ?? []).some(g => g.id === groupId)
  )
    throw new Error(loc`A new group identifier is required.`);
  if (
    typeof city !== "string" ||
    !city.trim() ||
    !Number.isSafeInteger(population) ||
    population < 10000 ||
    quickContactConfirmed !== true
  )
    throw new Error(
      loc`Use this city ability in a named city of at least 10,000 people with a method of quick contact.`
    );
  if (nonCombatConfirmed !== true || gcHelpApproved !== true)
    throw new Error(loc`The GC must approve non-combat help within the group’s skills and equipment.`);
  const count = system.actionDice?.max;
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error(loc`Review the character’s starting action-die count.`);
  const sequence = sceneSequence(system.usagePeriods);
  if (!Number.isSafeInteger(sequence + 2))
    throw new Error(loc`The scene sequence cannot safely track another two scenes.`);
  return {
    id: groupId,
    source: id,
    name: source.name,
    template: source.template,
    tier: 2,
    count,
    kitGrade: source.kitGrade,
    city: city.trim(),
    population,
    mission: String(system.usagePeriods?.mission ?? "initial"),
    scene: String(system.usagePeriods?.scene ?? "initial"),
    sceneSequence: sequence,
    expiresAtSceneSequence: sequence + 2,
    status: "active"
  };
}
export function assistantGroupStatus(system, group) {
  const source = Object.hasOwn(ASSISTANT_SOURCES, group?.source) ? ASSISTANT_SOURCES[group.source] : null;
  let sequence;
  try {
    sequence = sceneSequence(system.usagePeriods);
  } catch (error) {
    return { ...group, active: false, review: true, state: "Review scene history" };
  }
  const valid =
    source &&
    typeof group.id === "string" &&
    Number.isSafeInteger(group.count) &&
    group.count > 0 &&
    group.tier === 2 &&
    typeof group.city === "string" &&
    group.city.trim() &&
    Number.isSafeInteger(group.population) &&
    group.population >= 10000 &&
    typeof group.scene === "string" &&
    typeof group.mission === "string" &&
    Number.isSafeInteger(group.sceneSequence) &&
    group.sceneSequence >= 0 &&
    Number.isSafeInteger(group.expiresAtSceneSequence) &&
    group.expiresAtSceneSequence === group.sceneSequence + 2 &&
    ["active", "withdrawn"].includes(group.status);
  if (
    !valid ||
    sequence < group.sceneSequence ||
    (sequence === group.sceneSequence && String(system.usagePeriods?.scene ?? "initial") !== group.scene)
  )
    return { ...group, active: false, review: true, state: loc`Review saved group history` };
  if (group.status === "withdrawn") return { ...group, active: false, state: "Withdrawn" };
  if (sequence >= group.expiresAtSceneSequence)
    return { ...group, active: false, state: loc`Expired at end of following scene` };
  return {
    ...group,
    ...{ name: source.name, template: source.template, kitGrade: source.kitGrade },
    active: true,
    state:
      sequence === group.sceneSequence
        ? loc`Current scene; also available through the following scene`
        : loc`Following scene; leaves when this scene ends`
  };
}
export function assistantWithdrawalPlan(
  system,
  group,
  { event = "", confirmed = false, maxVitality = 0, vitalityLost = 0, woundsLost = 0 } = {}
) {
  const status = assistantGroupStatus(system, group);
  if (!status.active) throw new Error(loc`Only an active, valid assistant group can withdraw.`);
  if (confirmed !== true) throw new Error(loc`Confirm that at least one group member met the withdrawal condition.`);
  let reason = "";
  if (event === "failedMorale") reason = loc`A member failed a Morale check.`;
  else if (event === "criticalInjury") reason = loc`A member suffered a critical injury.`;
  else if (group.source !== "friendsOnForce" && event === "failedDamageSave")
    reason = loc`A member failed a Damage save.`;
  else if (group.source === "friendsOnForce" && event === "vitalityLoss") {
    if (
      !Number.isSafeInteger(maxVitality) ||
      maxVitality < 1 ||
      !Number.isSafeInteger(vitalityLost) ||
      vitalityLost < 0 ||
      vitalityLost > maxVitality
    )
      throw new Error(loc`Enter a valid maximum vitality and total vitality lost by one police officer.`);
    if (vitalityLost <= Math.floor(maxVitality / 2))
      throw new Error(loc`The officer must lose more than half maximum vitality, rounded down.`);
    reason = loc`An officer lost ${vitalityLost} of ${maxVitality} vitality (more than ${Math.floor(maxVitality / 2)}).`;
  } else if (group.source === "friendsOnForce" && event === "woundLoss") {
    if (!Number.isSafeInteger(woundsLost) || woundsLost < 1)
      throw new Error(loc`An officer must lose at least one wound point.`);
    reason = loc`An officer lost ${woundsLost} wound point(s).`;
  } else throw new Error(loc`Choose a withdrawal condition stated by this class ability.`);
  return {
    ...group,
    status: "withdrawn",
    withdrawal: {
      event,
      reason,
      scene: String(system.usagePeriods?.scene ?? "initial"),
      sceneSequence: sceneSequence(system.usagePeriods)
    }
  };
}
