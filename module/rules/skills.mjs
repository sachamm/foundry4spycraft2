import { checkFocus, isHideCheck } from "./check-identity.mjs";
import { campaignSkillDCPolicy } from "./campaign-skill-dc.mjs";
import { cakewalkSkillSelected } from "./cakewalk.mjs";
import { signatureBonus } from "./favored-gear.mjs";
import { tripAttackSkillChecks, tripCounterSkillCheck } from "./trip-attack.mjs";
import "./stalking-stance.mjs";
import "./melee-skill-feats.mjs";
import "./conveyance-bull-rush.mjs";
import "./bull-rush-attack.mjs";
import "./bull-rush.mjs";
import { tumblePathPlan } from "./tumble.mjs";
import { feintSkillChecks } from "./feint.mjs";
import { spiderClimbCheck } from "./spider.mjs";
import "./trip.mjs";
import { fallDistanceSkillPlan } from "./fall-distance.mjs";
import { balanceSurfacePlan } from "./balance.mjs";
import { hideCircumstancePlan } from "./hide-circumstances.mjs";
import { detectionObserverPlan } from "./detection-observer.mjs";
import { hideMovementPlan } from "./hide-movement.mjs";
import { targetSkillEffectPlan } from "./target-skill-effects.mjs";
import { dispositionSkillPlan } from "./disposition-skills.mjs";
import "./rank-synergy-feats.mjs";
import { stoneColdSkillPlan } from "./stone-cold.mjs";
import "./threaten.mjs";
import "./taunt.mjs";
import "./diversion.mjs";
import "./grapple-check.mjs";
import "./bug-basics.mjs";
import "./documentation.mjs";
import { oneHandManeuverPlan } from "./maneuver-actions.mjs";
import { pursuitSkillPlan } from "./pursuit-feats.mjs";
import { contactFeatCheckPlan, contactTimeLabel } from "./contact-feats.mjs";
import "./polyglot.mjs";
import "./card-shark.mjs";
import "./skill-feat-terms.mjs";
import { appearanceCheckPlan } from "./appearance.mjs";
import { hardCoreInfluencePlan, charmerInfluencePlan } from "./hard-core.mjs";
import { dartingStyleState } from "./darting-state.mjs";
import { superiorCoverState } from "./superior-cover.mjs";
import { twoWeaponStyleState, twoWeaponSkillNote } from "./two-weapon-state.mjs";
import { SPYCRAFT as weaponWorkConfig } from "../config.mjs";
import { weaponFocusWorkPlan } from "./weapon-work.mjs";
import { combatExpertiseState } from "./combat-expertise.mjs";
import { shakenRules } from "./shaken.mjs";
import { restraintActionBlock, restraintSkillContext } from "./restraints.mjs";
import { skillBonusCondition, skillConditionEntries, skillConditionCheckPenalty } from "./skill-conditions.mjs";
import { possessedActionDice } from "./bonus-pools.mjs";
import { attributeActionBlock, conditionAbilityPenalty, conditionRollPenalties } from "./attributes.mjs";
import { underwaterCheckPlan } from "./environment.mjs";
import { qualitySkillChecks } from "./quality-checks.mjs";
import { campaignSkillChecks, moraleSkillPenalty, isMoralePenalty } from "./campaign-skills.mjs";
import { shakenSkillPenalty } from "./shaken.mjs";
import { medicalSkillPlan } from "./medical.mjs";
import { littleDetailsSkillPlan } from "./little-details.mjs";
import { skillTagPlan } from "./skill-tags.mjs";
import { skillGearPlan } from "./skill-gear.mjs";
import { gearUsePlan } from "./gear-play-rules.mjs";
import { terrainSkillPlan, localHeroOppositionPlan } from "./terrain.mjs";
import { trackingSkillPlan, trackingFeatEvidence } from "./tracking.mjs";
import { ambushCheckPlan } from "./ambush.mjs";
import { fogSmokePlan, ambientLightPlan, sensorySkillEffects, sensorySkillConditionPlan } from "./senses.mjs";
import { falseStartRestart, skillTimingPlan, requiredSkillSeconds } from "./timing.mjs";
import {
  classCheckEffects,
  tenSecondSolutionEligible,
  cunningPlanEffect,
  intelligenceAnalysisNote,
  boobyTrapNote
} from "./class-checks.mjs";
import { appliesToSkill } from "./limited-uses.mjs";
import { analysisTaskCheckPlan } from "./analysis-tasks.mjs";
import { forensicGeniusPlan } from "./forensic-genius.mjs";
import { closedCoursePlan } from "./closed-course.mjs";
import { skillSynergy } from "./synergies.mjs";
import { stackedBonuses as stacked } from "./knowledge.mjs";
import { planTerms, planTotal } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Rules common to the 100 named checks (pp.87–169). Context tags remain explicit. */
export function resolveSkillCheck(system, key, check, input = {}) {
  const {
    ability,
    modifier = 0,
    secret = false,
    focus = "",
    forte = false,
    method = "roll",
    safeToTake = false,
    synergySkill = "auto",
    synergyFocus = "",
    synergyConditionMet = false,
    gcApprovedSynergy = false,
    optionalRules = [],
    unopposed = false,
    crossCheckActive = false,
    hailMaryUntrained = false,
    hailMaryUncap = false,
    hailMaryActive = false,
    gearCategory = "",
    usingComputer = false,
    installingTrap = false,
    surprise = false,
    timingReduction = "auto",
    tenSecondSolution = false,
    standaloneCheckConfirmed = false,
    allAccordingToPlan = false,
    cunningPlan = false,
    ambientLight = "",
    obscurant = "",
    obscurantDensity = "",
    ambushPreparation = "slow",
    ambushRole = "",
    gcTakingPermissionConfirmed = false,
    trackingSurface = "",
    trackingAgeHours = 0,
    trackingWeatherHours = 0,
    trackingLargeGroup = false,
    trackingPace = "half",
    followingPhysicalTrail = false,
    scentUsable = false,
    terrain = "",
    underwater = false,
    navigating = false,
    naturalSurface = false,
    hearingCheck = false,
    cityPopulation = 0,
    nightAmbush = false,
    homeTurf = false,
    opposingSkill = "",
    targetingYou = false,
    gearStatus = "unknown",
    gearItem = null,
    kitAtLocation = false,
    oneHanded = false,
    noSharedLanguage = false,
    bound = false,
    conveyingMessage = false,
    littleDetails = false,
    inCombat = false,
    combatInSight = false,
    complexTaskNearby = false,
    dramaticConflictNearby = false,
    shiftingDisposition = false,
    persuadingAction = false,
    seductionConflict = false,
    purelyMentalConfirmed = false,
    blinded = false,
    targetDeafened = false,
    requiresEyesight = false,
    requiresHearing = false,
    targetCharacter = false,
    distanceFeet = null,
    grappleProficient = null,
    grappleSizeDifference = null,
    grappleContextConfirmed = false,
    weaponWork = false,
    weaponWorkProficiency = "",
    weaponWorkDC = null,
    weaponWorkName = "",
    weaponWorkConfirmed = false,
    weaponWorkItem = null,
    hardCore = false,
    hardCoreTarget = "",
    hardCoreDisposition = "",
    hardCoreNPCConfirmed = false,
    influenceDuration = "",
    charmer = false,
    charmerTarget = "",
    charmerDisposition = "",
    charmerNPCConfirmed = false,
    charmerDuration = "",
    manhuntPrey = false,
    manhuntRole = "",
    chaseRole = "",
    contactName = "",
    contactThreatLevel = null,
    wheelFreeManeuver = false,
    wheelFreeActionConfirmed = false,
    maneuverCombat = null,
    vehicleErrorIncrease = 0,
    vehicleControl = null,
    closedCourseSeesYou = false,
    closedCourseSeesVehicle = false,
    analysisTaskId = "",
    taskWorldTime = null,
    taskChallengeDC = null,
    taskChallengeDCConfirmed = false,
    targetSkillSystem = null,
    targetSkillActorUuid = "",
    targetSkillActorName = "",
    targetSkillConfirmed = false,
    targetSkillPurpose = "",
    dispositionTarget = null,
    stanceDistanceFeet = null,
    hideMovement = false,
    hideDistanceFeet = 0,
    hideMovementMode = "ground",
    hideRouteConfirmed = false,
    hideActionConfirmed = false,
    hideAdjacentThreat = false,
    hidePassesThreat = false,
    tumbleCircumstances = false,
    tumbleDistanceFeet = 0,
    tumbleAdjacentEnemySquares = 0,
    tumbleOccupiedSquares = 0,
    tumbleRouteConfirmed = false,
    feintCombat = null,
    fallDeclared = false,
    fallDistanceFeet = null,
    fallSoftSurface = false,
    fallConfirmed = false,
    balanceCircumstances = false,
    balanceSurface = "",
    balanceDistanceFeet = 0,
    balanceBuckled = false,
    balanceSlippery = false,
    balanceConfirmed = false,
    hideCircumstances = false,
    hideAreaPeople = null,
    hideApparentPlace = true,
    hideLocationKnown = false,
    hideDistractionOpportunity = false,
    hideCircumstancesConfirmed = false,
    detectionDistraction = "",
    detectionTargetSystem = null,
    detectionActorUuid = "",
    detectionActorName = "",
    detectionConfirmed = false
  } = input;
  let {
    inComplexTask = false,
    inDramaticConflict = false,
    deafened = false,
    complexAnalysisTask = false,
    analysisBaseChallenges = null
  } = input;
  check =
    key === "acrobatics" && check?.id === "counter-trip"
      ? tripCounterSkillCheck()
      : (tripAttackSkillChecks(key, []).find(c => c.id === check?.id) ??
        feintSkillChecks(key, [], system).find(c => c.id === check?.id) ??
        check);
  inDramaticConflict =
    inDramaticConflict === true ||
    seductionConflict === true ||
    manhuntRole !== "" ||
    chaseRole !== "" ||
    manhuntPrey === true;
  const skill = system.skillTotals?.[key];
  if (!skill || !check) return null;
  const tumblePath = tumblePathPlan(system, key, check, {
    method,
    tumbleCircumstances,
    tumbleDistanceFeet,
    tumbleAdjacentEnemySquares,
    tumbleOccupiedSquares,
    tumbleRouteConfirmed
  });
  const fallDistance = fallDistanceSkillPlan(system, key, check, {
    fallDeclared,
    fallDistanceFeet,
    fallSoftSurface,
    fallConfirmed
  });
  const balance = balanceSurfacePlan(system, key, check, {
    balanceCircumstances,
    balanceSurface,
    balanceDistanceFeet,
    balanceBuckled,
    balanceSlippery,
    balanceConfirmed
  });
  check = balance.check;
  const hideCircumstance = hideCircumstancePlan(system, key, check, {
    hideCircumstances,
    hideAreaPeople,
    hideApparentPlace,
    hideLocationKnown,
    hideDistractionOpportunity,
    hideCircumstancesConfirmed
  });
  const detectionObserver = detectionObserverPlan(detectionTargetSystem, key, check, {
    actorUuid: detectionActorUuid,
    actorName: detectionActorName,
    severity: detectionDistraction,
    confirmed: detectionConfirmed,
    method
  });
  const targetSkillEffect = targetSkillEffectPlan(targetSkillSystem, key, check, {
    actorUuid: targetSkillActorUuid,
    actorName: targetSkillActorName,
    confirmed: targetSkillConfirmed,
    purpose: targetSkillPurpose
  });
  const disposition = dispositionSkillPlan(system, key, check, dispositionTarget);
  const analysisTask = analysisTaskCheckPlan(system, key, check, {
    analysisTaskId,
    inCombat,
    taskWorldTime,
    taskChallengeDC,
    taskChallengeDCConfirmed
  });
  if (analysisTask.context) {
    inComplexTask = true;
    if (key === "analysis") {
      complexAnalysisTask = true;
      analysisBaseChallenges = analysisTask.context.baseChallenges;
    }
  }
  if (key === "analysis" && complexAnalysisTask === true) inComplexTask = true;
  const restraint = restraintSkillContext(system, key, check, {
    grappleProficient,
    grappleSizeDifference,
    grappleContextConfirmed
  });
  check = restraint.check;
  // Feat and action parts of the plan come from the rules that own them (module/rules/roll-pipeline.mjs, planTerms).
  const terms = planTerms("skill", { system, skillKey: key, check, method, input });
  const conditionSystem =
    bound === true ? { ...system, conditionContext: { ...system.conditionContext, bound: true } } : system;
  const originalAbility =
    hideCircumstance.baseAbility ?? (check.attributes.includes(ability) ? ability : check.attributes[0]);
  const accordingEligible = (system.classLevels?.schemer ?? 0) >= 4;
  const substituted = !!allAccordingToPlan && accordingEligible,
    selected = substituted ? "int" : originalAbility;
  const originalRow = skill.totals.find(t => t.ability === originalAbility),
    originalTotal =
      originalRow?.normalSkillBonus ?? originalRow?.total - skillConditionCheckPenalty(system, originalAbility);
  const total =
    originalTotal +
    (substituted ? (system.abilities?.int?.mod ?? 0) - (system.abilities?.[originalAbility]?.mod ?? 0) : 0);
  if (!Number.isFinite(total)) return null;
  const fogSmoke = fogSmokePlan(system, { obscurant, obscurantDensity, visionCheck: check.tags.includes("Vision") });
  const medical = medicalSkillPlan(system, key, check, {
    inCombat,
    combatInSight,
    complexTaskNearby,
    dramaticConflictNearby,
    inComplexTask,
    inDramaticConflict
  });
  const details = littleDetailsSkillPlan(system, key, check, { littleDetails, method });
  const forensic = forensicGeniusPlan(system, key, check, {
    complexAnalysisTask,
    analysisBaseChallenges,
    forensicsTask: analysisTask.context ? analysisTask.context.forensicsOnly === true : check.id === "forensics"
  });
  const closedCourse = closedCoursePlan(system, key, check, { closedCourseSeesYou, closedCourseSeesVehicle });
  const wheel = oneHandManeuverPlan(system, key, check, {
    wheelFreeManeuver,
    wheelFreeActionConfirmed,
    maneuverCombat,
    timingReduction,
    tenSecondSolution
  });
  // Spider Basics plans a Climb without its Hands-On and Vision tags or the missing-kit penalty (p.196).
  const spider = spiderClimbCheck(system, key, check);
  check = spider.check;
  const skillTags = skillTagPlan(system, key, check, { oneHanded, noSharedLanguage, bound, conveyingMessage });
  const stoneCold = stoneColdSkillPlan(system, key, check);
  const skillGear = skillGearPlan(stoneCold.check, { gearStatus, gearItem, kitAtLocation, system });
  // A non-kit item adds its result cap and any gear bonus to the checks it supports (pp.276–288).
  const gearUse = gearUsePlan(key, stoneCold.check?.id, gearItem);
  const light = ambientLightPlan(system, { ambientLight, visionCheck: check.tags.includes("Vision") });
  const ambush = ambushCheckPlan(system, key, check, { ambushPreparation, ambushRole });
  const tracking = trackingSkillPlan(system, key, check, {
    trackingSurface,
    trackingAgeHours,
    trackingWeatherHours,
    trackingLargeGroup,
    trackingPace,
    followingPhysicalTrail,
    surprise
  });
  const armor = check.tags.includes("Armor Check Penalty")
    ? Math.min(0, system.armor?.check ?? 0, system.encumbrance?.check ?? 0)
    : 0;
  const vision = check.tags.includes("Vision") ? (system.armor?.visionCheck ?? 0) : 0;
  const norm = value =>
    String(value ?? "")
      .trim()
      .toLowerCase();
  const applicableFocus = focus || checkFocus(key, check);
  const owned = system.focusTotals?.[key] ?? system.focuses?.[key] ?? [];
  const missingFocus = skill.focus && !owned.some(value => norm(value) === norm(applicableFocus));
  const rankAdjustment = missingFocus ? -Math.ceil(skill.ranks / 2) : 0;
  const hasForte =
    !!forte &&
    (system.skillForteTotals ?? system.skillFortes ?? []).some(
      row => row.skill === key && norm(row.focus) === norm(applicableFocus) && row.forte?.trim()
    );
  const conditional = (system.conditionalSkillBonuses ?? []).filter(
    row => row.skill === key && norm(row.focus) === norm(applicableFocus)
  );
  const misc = conditional.filter(row => row.kind === "misc");
  const classEffects = classCheckEffects(system, key, check, { gearCategory, usingComputer, installingTrap, surprise });
  const contactFeat = contactFeatCheckPlan(system, key, check, { contactName, contactThreatLevel });
  classEffects.timeChoices.push(...contactFeat.timeChoices, ...(wheel.timeChoice ? [wheel.timeChoice] : []));
  classEffects.errorReductionZero += contactFeat.errorReduction + balance.errorReduction;
  const hideMovementPlanResult = hideMovementPlan(system, key, check, {
    method,
    hideMovement,
    hideDistanceFeet,
    hideMovementMode,
    hideRouteConfirmed,
    hideActionConfirmed,
    hideAdjacentThreat,
    hidePassesThreat,
    stanceDistanceFeet,
    stanceCombat: feintCombat
  });
  const pursuit = pursuitSkillPlan(system, key, check, { manhuntRole, chaseRole, manhuntPrey });
  const appearancePlan = appearanceCheckPlan(system, key, check, {
    manhuntPrey: manhuntPrey === true || manhuntRole === "prey"
  });
  classEffects.timeChoices.push(...(appearancePlan.timeChoices ?? []));
  const hardCorePlan = hardCoreInfluencePlan(system, key, check, {
    hardCore,
    hardCoreTarget,
    hardCoreDisposition,
    hardCoreNPCConfirmed,
    influenceDuration
  });
  const charmerPlan = charmerInfluencePlan(system, key, check, {
    charmer,
    charmerTarget,
    charmerDisposition,
    charmerNPCConfirmed,
    charmerDuration
  });
  classEffects.timeChoices.push(...hardCorePlan.timeChoices, ...charmerPlan.timeChoices);
  const listedTime =
    contactFeat.baseTime ??
    charmerPlan.baseTime ??
    hardCorePlan.baseTime ??
    (details.active ? details.time : (ambush.time ?? check.time));
  deafened = deafened === true || system.conditionContext?.deafened === true;
  const senses = sensorySkillEffects(system, key, check, { surprise, deafened, scentUsable });
  const sensoryConditions = sensorySkillConditionPlan(system, check, {
    blinded,
    deafened,
    targetDeafened,
    requiresEyesight,
    requiresHearing,
    targetCharacter,
    distanceFeet
  });
  const underwaterContext = underwaterCheckPlan(system, {
    underwater,
    kind: "skill",
    skillKey: key,
    checkName: check.name
  });
  const terrainPlan = terrainSkillPlan(system, key, check, {
    terrain,
    underwater,
    navigating,
    surprise,
    naturalSurface,
    installingTrap,
    hearingCheck,
    deafened,
    cityPopulation,
    nightAmbush,
    homeTurf
  });
  const localHeroOpposition = localHeroOppositionPlan(system, key, check, {
    homeTurf,
    opposingSkill,
    targetingYou,
    method
  });
  const qualityChecks = qualitySkillChecks(system, key, check, { shiftingDisposition, seductionConflict, terrain });
  const campaignChecks = campaignSkillChecks(system, key, check, { surprise, shiftingDisposition, persuadingAction });
  classEffects.timeChoices.push(...ambush.timeChoices);
  // Bonuses to this named check: the class abilities' own, the check's circumstances, and each registered term's.
  classEffects.bonuses = terms.merge("bonuses", [
    [0, classEffects.bonuses],
    [100, pursuit.bonuses],
    [110, appearancePlan.bonuses],
    [150, qualityChecks.bonuses],
    [155, campaignChecks.bonuses],
    [156, disposition.bonus ? [{ source: "Disposition", type: "", value: disposition.bonus }] : []],
    [
      160,
      [
        ...skillGear.bonuses.filter(b => !(spider.waiveMissingGear && b.source === "Missing required gear")),
        ...gearUse.bonuses,
        ...(signatureBonus(system, gearItem?.id)
          ? [{ type: "morale", value: signatureBonus(system, gearItem.id), source: gearItem.name }]
          : [])
      ]
    ],
    [170, terrainPlan.bonuses],
    [180, senses.bonuses],
    [190, tracking.bonuses]
  ]);
  const solutionEligible = tenSecondSolutionEligible(system, {
    checkKind: "skill",
    ability: selected,
    checkMethod: method,
    standaloneCheckConfirmed,
    inComplexTask,
    inDramaticConflict
  });
  if (tenSecondSolution && solutionEligible)
    classEffects.timeChoices.push({
      id: "solution",
      name: loc`10-Second Solution`,
      multiplier: 0.5,
      minimum: 6,
      rounding: "down"
    });
  const activeCore =
    (key === "bluff" && system.coreClassIds?.includes("conArtist")) ||
    (key === "notice" && ["fieldAnalyst", "guide"].some(id => system.coreClassIds?.includes(id)));
  const attention = system.activeFeatNames?.includes("Attention to Detail");
  const originallySecret = check.mode === "Secret" || (!!secret && check.mode.includes("Secret"));
  const crossCheckAvailable =
    ambush.crossCheckGranted || check.tags.includes("Cross-Check") || (!!attention && originallySecret);
  const forceActive = activeCore || hailMaryActive || (crossCheckActive && crossCheckAvailable);
  const mode = forceActive ? "Active" : check.mode;
  const synergy = skillSynergy(
    system,
    {
      ...check,
      synergies: [
        ...(check.synergies ?? []),
        ...tracking.synergies,
        ...terrainPlan.synergies,
        ...pursuit.synergies,
        ...closedCourse.synergies,
        ...forensic.synergies,
        ...terms.all("synergies")
      ],
      mode
    },
    { synergySkill, synergyFocus, synergyConditionMet, gcApprovedSynergy, maximum: pursuit.maximum }
  );
  const hotDice =
    key === "streetwise" && check.id === "gambling" && system.activeFeatNames?.includes("The Dice are Hot");
  let gamblingDice = null,
    gamblingReview = "";
  if (hotDice)
    try {
      gamblingDice = possessedActionDice(system);
    } catch (error) {
      gamblingReview = error.message;
    }
  const synergyValues = [
    { type: "synergy", value: synergy.value },
    ...(hotDice ? [{ type: "synergy", value: gamblingDice?.total ?? 0 }] : [])
  ];
  const conditionalThreat =
    Math.min(
      skill.threat + (skill.threatAdjustment ?? 0),
      ...conditional.filter(row => row.kind === "baseThreat").map(row => row.value)
    ) - (skill.threatAdjustment ?? 0);
  const reduction =
    (skill.errorReduction ?? 0) +
    conditional.filter(row => row.kind === "errorReduction").reduce((n, row) => n + row.value, 0) +
    terms.sum("errorReduction");
  const campaign = system.campaignEffects ?? {};
  const attributeScores = ["str", "dex", "con", "int", "wis", "cha"].map(k => system.abilities?.[k]?.value);
  const lowestAttribute =
    attributeScores.every(Number.isFinite) && system.abilities?.[selected]?.value === Math.min(...attributeScores);
  const campaignErrorIncrease =
    (lowestAttribute ? (campaign.lowestAttributeSkillError ?? 0) : 0) +
    (key === "medicine" ? Math.max(0, campaign.medicineError ?? 0) : 0);
  const cakewalk = cakewalkSkillSelected(system, key);
  const campaignErrorReduction =
    (key === "medicine" ? Math.max(0, -(campaign.medicineError ?? 0)) : 0) + (cakewalk ? 2 : 0);
  const errorFloor = Math.max(
    skill.errorFloor ?? 0,
    ...conditional.filter(row => row.kind === "errorFloor").map(row => row.value)
  );
  const originalError = Math.max(
    contactFeat.minimumError ?? 0,
    check.error +
      campaignErrorIncrease +
      tumblePath.errorIncrease +
      balance.errorIncrease +
      detectionObserver.errorIncrease +
      hideMovementPlanResult.errorIncrease +
      targetSkillEffect.errorIncrease +
      disposition.errorIncrease +
      (analysisTask.context?.pressureErrorIncrease ?? 0) +
      (contactFeat.errorIncrease ?? 0) +
      appearancePlan.errorIncrease +
      restraint.errorIncrease +
      ambush.errorIncrease +
      tracking.errorIncrease +
      medical.errorIncrease +
      Math.max(0, Math.trunc(Number(vehicleErrorIncrease) || 0)) +
      ((skill.ranks === 0 && !hailMaryUntrained) || missingFocus ? 2 : 0)
  );
  const zeroReduction =
    classEffects.errorReductionZero +
    (skill.errorReductionZero ?? 0) +
    conditional.filter(row => row.kind === "errorReductionZero").reduce((n, row) => n + row.value, 0);

  const skillFeats = (system.skillFeatRules ?? []).filter(rule => appliesToSkill(rule, key, applicableFocus));
  const hasFeat = name => skillFeats.some(rule => rule.name === name);
  const cap =
    hotDice || hailMaryUncap
      ? null
      : Math.max(
          0,
          skill.cap +
            skillTags.capAdjustment +
            skillGear.capIncrease +
            gearUse.capIncrease +
            terrainPlan.homeTurfCapIncrease +
            conditional.filter(row => row.kind === "cap").reduce((n, row) => n + row.value, 0) +
            sensoryConditions.capAdjustment
        );
  const weaponFocusWork = weaponFocusWorkPlan(system, weaponWorkConfig, key, check, {
    weaponWork,
    weaponWorkProficiency,
    weaponWorkDC,
    weaponWorkName,
    weaponWorkConfirmed,
    weaponWorkItem
  });
  const blockedReasons = terms.merge("blocked", [
    [60, tumblePath.blockedReason],
    [90, fallDistance.blockedReason],
    [100, balance.blockedReason],
    [110, hideCircumstance.blockedReason],
    [120, detectionObserver.blockedReason],
    [130, hideMovementPlanResult.blockedReason],
    [
      140,
      targetSkillEffect.timeMultiplier === 3 && (inComplexTask || inDramaticConflict || check.tags?.includes("Complex"))
        ? loc`Faceless timing for an entire Complex Task or Dramatic Conflict remains a separate workflow; use this entry only for a standalone check.`
        : ""
    ],
    [150, targetSkillEffect.blockedReason],
    [151, disposition.blockedReason],
    [
      200,
      analysisTask.context?.stage && method !== "roll"
        ? loc`Taking10/20 is unavailable while this task is under pressure.`
        : ""
    ],
    [210, analysisTask.blockedReason],
    [220, forensic.blockedReason],
    [230, wheel.blockedReason],
    [240, contactFeat.blockedReason]
  ]);
  if (charmerPlan.blockedReason) blockedReasons.push(charmerPlan.blockedReason);
  if (charmer === true && hardCore === true)
    blockedReasons.push(loc`Choose one Influence timing feat and one target for this check.`);
  if (hardCorePlan.blockedReason) blockedReasons.push(hardCorePlan.blockedReason);
  if (dartingStyleState(system).needsReview) blockedReasons.push(dartingStyleState(system).reason);
  if (twoWeaponStyleState(system).needsReview) blockedReasons.push(twoWeaponStyleState(system).reason);
  if (weaponFocusWork.blockedReason) blockedReasons.push(weaponFocusWork.blockedReason);
  if (shakenRules(system).fixedResultsForbidden && ["take10", "take20"].includes(method))
    blockedReasons.push(loc`Shaken: taking 10 or 20 is unavailable (p.342).`);
  if (restraint.blockedReason) blockedReasons.push(restraint.blockedReason);
  if (system.baffledApplicationReview?.needsReview)
    blockedReasons.push(loc`The GC must review the interrupted Baffled event before skill checks.`);
  if (gamblingReview) blockedReasons.push(gamblingReview);
  if (sensoryConditions.blockedReason) blockedReasons.push(sensoryConditions.blockedReason);
  if (
    (conditionSystem.conditionContext?.entangled || conditionSystem.conditionContext?.bound) &&
    key === "acrobatics" &&
    ["jump", "tumble"].includes(check.id)
  )
    blockedReasons.push(loc`Entangled/Bound: Jump and Tumble checks are unavailable (p.341).`);
  const sleepingCoreReview =
    system.conditionContext?.sleeping === true && key === "notice" && check.id === "awareness" && activeCore;
  if (sleepingCoreReview)
    blockedReasons.push(loc`Sleeping Awareness with Keen/Cultured requires the pending GC ruling on its active mode.`);
  if (system.conditionContext?.sleeping === true && (cunningPlan || tenSecondSolution))
    blockedReasons.push(loc`Sleeping: this option requires a deliberate action; only passive actions are available.`);
  if (restraint.state === "pinned" && cunningPlan)
    blockedReasons.push(loc`Pinned: Cunning Plan requires a separate free action.`);
  const restraintBlock = restraintActionBlock(system, {
    passive: mode.includes("Passive") && method === "roll" && !cunningPlan && !tenSecondSolution,
    free:
      /free action/i.test(check.time ?? "") ||
      (mode.includes("Passive") && method === "roll" && cunningPlan && !tenSecondSolution),
    escape: restraint.escape && originalAbility === "str"
  });
  if (restraintBlock) blockedReasons.push(restraintBlock);
  const incapacity = attributeActionBlock(system, {
    kind: "skill",
    ability: selected,
    purelyMentalConfirmed,
    passiveAction: mode.includes("Passive") || sleepingCoreReview
  });
  if (incapacity) blockedReasons.push(incapacity);
  if (medical.blockedReason) blockedReasons.push(medical.blockedReason);
  if (details.blockedReason) blockedReasons.push(details.blockedReason);
  if (skillTags.blockedReason) blockedReasons.push(skillTags.blockedReason);
  if (skillGear.blockedReason) blockedReasons.push(skillGear.blockedReason);
  if (gearUse.blockedReason) blockedReasons.push(gearUse.blockedReason);
  if (localHeroOpposition.blockedReason) blockedReasons.push(localHeroOpposition.blockedReason);
  if (tracking.blockedReason) blockedReasons.push(tracking.blockedReason);
  if (
    allAccordingToPlan &&
    (!Number.isFinite(system.abilities?.int?.mod) || !Number.isFinite(system.abilities?.[originalAbility]?.mod))
  )
    blockedReasons.push(loc`Review the attributes before substituting Intelligence.`);
  if (allAccordingToPlan && !accordingEligible) blockedReasons.push(loc`All According to Plan requires Schemer 4.`);
  if (tenSecondSolution && !solutionEligible)
    blockedReasons.push(
      loc`10-Second Solution requires Scientist 14, a rolled Intelligence skill and confirmation it is outside Complex Tasks and Dramatic Conflicts.`
    );
  if (check.optionalRule && !optionalRules.includes(check.optionalRule))
    blockedReasons.push(loc`This optional skill use is disabled by the campaign rules.`);
  if (crossCheckActive && !crossCheckAvailable) blockedReasons.push(loc`This check does not have the Cross-Check tag.`);
  if (hailMaryActive && !originallySecret && !check.mode.includes("Passive"))
    blockedReasons.push(loc`This Hail Mary option applies only to passive or secret checks.`);
  if (hailMaryUntrained && skill.ranks > 0)
    blockedReasons.push(loc`This Hail Mary option applies only to untrained checks.`);
  if (synergy.reason) blockedReasons.push(synergy.reason);
  if (cap !== null && cap < 5)
    blockedReasons.push(loc`This check cannot be used while its result cap is below 5 (p.88).`);
  if (!["roll", "take10", "take20"].includes(method)) blockedReasons.push(loc`Unknown check method.`);
  const wellFundedBribe =
    method === "take10" &&
    key === "bureaucracy" &&
    check.id === "bribe" &&
    system.activeFeatNames?.includes("Well-Funded");
  const taking = method === "take10" || method === "take20",
    fixedDie = method === "take10" ? 10 : method === "take20" ? 20 : null;
  const professional = unopposed === true && hasFeat("Mark of a Professional");
  let timing;
  try {
    timing = skillTimingPlan({
      method,
      take10Base: campaign.take10Base ?? 2,
      take10Normal:
        cakewalk ||
        tracking.take10Normal ||
        hasForte ||
        skill.take10TimeMultiplier === 1 ||
        ((system.classLevels?.schemer ?? 0) >= 10 && selected === "int"),
      falseStart: hasFeat("False Start"),
      professional,
      classEffect: classEffects,
      timeEffects: [
        ...(targetSkillEffect.timeMultiplier === 3 ? [{ id: "faceless", name: "Faceless", multiplier: 3 }] : []),
        ...(disposition.priority !== 1
          ? [
              {
                id: "disposition",
                name: loc`Target disposition`,
                multiplier: disposition.priority,
                rounding: disposition.priority < 1 ? "up" : null
              }
            ]
          : [])
      ],
      time: listedTime,
      reduction: restraint.timeLocked ? "none" : wheel.selected ? "oneHandManeuver" : timingReduction,
      minimumRequired: tenSecondSolution ? 6 : 0,
      crossCheck: crossCheckActive && crossCheckAvailable
    });
  } catch (error) {
    blockedReasons.push(error.message);
    timing = skillTimingPlan({ method, time: listedTime, take10Base: campaign.take10Base ?? 2 });
  }
  const { timeMultiplier, minimumTimeSeconds, minimumTime } = timing;
  const requiredPreparationSeconds = ambush.applicable ? requiredSkillSeconds(ambush.baseSeconds, timing) : null;
  let error = Math.max(
    0,
    Math.max(
      Math.min(originalError + timing.errorIncrease, errorFloor),
      originalError + timing.errorIncrease - reduction
    ) - zeroReduction
  );
  if (campaignErrorReduction) error = Math.max(Math.min(error, 1), error - campaignErrorReduction);
  const actionDiceCost = (hailMaryUntrained ? 1 : 0) + (hailMaryUncap ? 3 : 0) + (hailMaryActive ? 4 : 0);
  let cunning = null;
  if (cunningPlan)
    try {
      cunning = cunningPlanEffect(system, error);
      error = cunning.error;
    } catch (e) {
      blockedReasons.push(e.message);
    }
  if (taking && actionDiceCost)
    blockedReasons.push(loc`Choose a rolled check when spending action dice for Hail Mary.`);
  if (taking) {
    if (method === "take10" && campaign.forbidTake10 === true)
      blockedReasons.push(loc`Tense campaign quality: taking 10 on skill checks is unavailable (p.408).`);
    if (!safeToTake)
      blockedReasons.push(loc`Taking 10/20 requires being neither distracted nor endangered (pp.97–98).`);
    if (/with permission/i.test(check.time) && gcTakingPermissionConfirmed !== true)
      blockedReasons.push(
        loc`This named check requires the GC’s permission to take 10/20; confirm that permission separately from safety.`
      );
    if (
      !wellFundedBribe &&
      !(method === "take20" && tracking.take20IgnoresError) &&
      error > (method === "take20" && attention ? 2 : 1)
    )
      blockedReasons.push(
        loc`Taking ${fixedDie} requires a final error range no worse than ${method === "take20" && attention ? 2 : 1} (pp.97–98,200).`
      );
    if (check.tags.includes("Concentration"))
      blockedReasons.push(loc`Taking 10/20 is unavailable for a Concentration check (pp.97–98).`);
    if (
      !wellFundedBribe &&
      !check.time.includes(`Take ${fixedDie}`) &&
      !(fixedDie === 10 ? tracking.take10Allowed : tracking.take20Allowed)
    )
      blockedReasons.push(loc`This use does not permit taking ${fixedDie}.`);
  }
  // pp.87,92,101: distinguish the substituted skill bonus from modifiers on this named check.
  const baseSkillEntries = skillConditionEntries(system, skill.bonusEntries ?? []),
    allSkillEntries = [...baseSkillEntries, ...misc],
    allCheckEntries = [...classEffects.bonuses, ...synergyValues],
    skillBonusEntries = allSkillEntries.filter(e => !isMoralePenalty(e)),
    checkBonusEntries = allCheckEntries.filter(e => !isMoralePenalty(e)),
    shakenPenalty = shakenSkillPenalty(conditionSystem, selected),
    moralePenalty = moraleSkillPenalty([...allSkillEntries, ...allCheckEntries], shakenPenalty);
  const normalSkillBonus = total + rankAdjustment + stacked(skillBonusEntries) - stacked(baseSkillEntries),
    skillBonus = skillBonusCondition(system, normalSkillBonus).total;
  const nonSynergy = checkBonusEntries.filter(e => e.type !== "synergy"),
    skillExtra = stacked([...skillBonusEntries, ...nonSynergy]) - stacked(skillBonusEntries),
    synergyExtra =
      stacked([...skillBonusEntries, ...checkBonusEntries]) - stacked([...skillBonusEntries, ...nonSynergy]),
    condition = skillBonusCondition(system, normalSkillBonus + skillExtra);
  const checkAdjustment =
    skillConditionCheckPenalty(conditionSystem, selected) +
    moralePenalty -
    shakenPenalty +
    disposition.penalty +
    (isHideCheck(key, check) ? (system.sizeHideModifier ?? 0) : 0) +
    (hasForte ? 1 : 0) +
    armor +
    vision +
    (Number(modifier) || 0) +
    skillTags.handPenalty +
    light.skillModifier +
    fogSmoke.skillModifier +
    underwaterContext.penalty +
    sensoryConditions.skillModifier +
    restraint.sizeBonus +
    hideMovementPlanResult.penalty +
    detectionObserver.penalty +
    terms.sum("adjustment");
  const terrainFeat =
    terrainPlan.homeTurf ||
    terrainPlan.bonuses.length ||
    terrainPlan.synergySources.length ||
    terrainPlan.opponentSurprisePenalty
      ? {
          version: 1,
          context: { ...structuredClone(terrainPlan), surprise: surprise === true },
          synergyRanks: Object.fromEntries(
            terrainPlan.synergies.map(row => [row.skill, system.skillTotals?.[row.skill]?.ranks ?? 0])
          ),
          selectedSynergy: { skill: synergy.skill ?? "", value: synergy.value },
          appliedSynergy: synergyExtra
        }
      : null;
  const wheelFeat =
    wheel.evidence || skillTags.wheelWaiver
      ? {
          version: 1,
          source: "One Hand on the Wheel",
          skillKey: key,
          checkId: check.id,
          method,
          handWaiver: skillTags.wheelWaiver,
          handPenaltyBefore: skillTags.handPenaltyBeforeWheel,
          handPenaltyAfter: skillTags.handPenalty,
          free: wheel.selected,
          actionCost: wheel.selected ? "free" : null,
          timing: { source: timing.timeReduction, multiplier: timeMultiplier, minimumSeconds: minimumTimeSeconds },
          ...(wheel.evidence ?? {})
        }
      : null;
  const practiceFeat = hasFeat("Practice Makes Perfect")
    ? {
        version: 1,
        source: "Practice Makes Perfect",
        skillKey: key,
        checkId: check.id,
        focus: applicableFocus,
        rules: skillFeats.filter(rule => rule.name === "Practice Makes Perfect").map(rule => structuredClone(rule)),
        method,
        error
      }
    : null;
  const professionalFeat = hasFeat("Mark of a Professional")
    ? {
        version: 1,
        source: "Mark of a Professional",
        skillKey: key,
        checkId: check.id,
        focus: applicableFocus,
        rules: skillFeats.filter(rule => rule.name === "Mark of a Professional").map(rule => structuredClone(rule)),
        unopposed: unopposed === true,
        method,
        errorBefore: originalError,
        errorAfter: error,
        timing: {
          applied: timing.timeReduction === "professional",
          source: timing.timeReduction,
          multiplier: timeMultiplier,
          minimumSeconds: minimumTimeSeconds,
          rounding: timing.timeRounding
        }
      }
    : null;
  const fundedTaking = wellFundedBribe
    ? { version: 1, source: "Well-Funded", skillKey: key, checkId: check.id, method, errorBefore: error }
    : null;
  // The note text is a run of segments: the check's own, and one from each registered term, in a fixed order.
  const noteSegments = terms.merge("segment", [
    [
      5,
      campaignErrorIncrease || campaignErrorReduction
        ? loc`Campaign error range: +${campaignErrorIncrease}, reduction ${campaignErrorReduction}. `
        : ""
    ],
    [
      6,
      method === "take10" && campaign.take10Base
        ? loc`Campaign take-10 base time: ${campaign.take10Base}×, before any applicable time benefit. `
        : ""
    ],
    [10, vehicleControl?.note ? `${vehicleControl.note} ` : ""],
    [80, `${tumblePath.notes.join(" ")} `],
    [110, `${fallDistance.notes.join(" ")} `],
    [120, `${balance.notes.join(" ")} `],
    [130, `${hideCircumstance.notes.join(" ")} `],
    [140, `${detectionObserver.notes.join(" ")} `],
    [150, `${hideMovementPlanResult.notes.join(" ")} `],
    [160, `${targetSkillEffect.notes.join(" ")} `],
    [180, `${stoneCold.notes.join(" ")} `],
    [220, `${analysisTask.notes.join(" ")} `],
    [230, `${forensic.notes.join(" ")} `],
    [240, `${closedCourse.notes.join(" ")} `],
    [250, `${wheel.notes} `],
    [260, wellFundedBribe ? loc`Well-Funded: Bribe take 10 ignores the error-range restriction (p.198). ` : ""],
    [270, `${pursuit.notes.join(" ")} `],
    [
      280,
      contactFeat.evidence
        ? loc`Contact ${contactFeat.evidence.contact.name}: DC ${contactFeat.evidence.dc}, summon ${contactTimeLabel(requiredSkillSeconds(contactFeat.baseSeconds, timing))}; after success, response ${contactFeat.evidence.response.formula} hours ×${contactFeat.evidence.response.missionMultiplier} (Table 2.35, p.144; response/outcomes resolved separately). `
        : ""
    ],
    [
      290,
      contactFeat.evidence?.source
        ? loc`${contactFeat.evidence.source}: primary contact ${contactFeat.evidence.contact.name}; error range −${contactFeat.errorReduction} (minimum 0), optional half time rounded down. `
        : ""
    ],
    [
      310,
      dartingStyleState(system).active
        ? loc`Darting Weapon: attack/skill check penalty −${dartingStyleState(system).penalty}. `
        : ""
    ],
    [320, superiorCoverState(system).active ? loc`Superior Cover: attack/skill check penalty −2. ` : ""],
    [330, twoWeaponSkillNote(system)],
    [340, weaponFocusWork.notes],
    [350, weaponFocusWork.notes ? " " : ""],
    [
      370,
      combatExpertiseState(system).active
        ? loc`Combat Expertise: attack/skill check penalty −${combatExpertiseState(system).penalty}. `
        : ""
    ],
    [
      380,
      condition.state
        ? loc`${condition.state === "baffled" ? loc`Baffled` : loc`Incompetent`}: skill bonus ${condition.normal} → ${condition.total}; separate check modifiers remain. `
        : ""
    ],
    [
      390,
      gamblingDice
        ? loc`The Dice are Hot: ${gamblingDice.total} possessed action dice (${gamblingDice.ordinary} ordinary + ${gamblingDice.bonus} bonus); Gambling synergy uses normal named-bonus stacking. `
        : ""
    ],
    [
      400,
      conditionRollPenalties(conditionSystem).entangled && selected === "dex"
        ? loc`Entangled/Bound: Dexterity-based skill penalty −4. `
        : ""
    ],
    [
      410,
      conditionAbilityPenalty(conditionSystem, selected) ? loc`Drunk: Dexterity-/Wisdom-based check penalty −2. ` : ""
    ],
    [430, `${appearancePlan.notes.join(" ")} `],
    [440, `${charmerPlan.notes.join(" ")} `],
    [450, `${hardCorePlan.notes.join(" ")} `],
    [460, `${underwaterContext.notes.join(" ")} `],
    [470, `${qualityChecks.notes.join(" ")} `],
    [471, `${campaignChecks.notes.join(" ")} `],
    [472, `${disposition.notes.join(" ")} `],
    [480, `${medical.notes.join(" ")} `],
    [490, `${details.notes.join(" ")} `],
    [500, `${skillTags.notes.join(" ")} `],
    [510, `${skillGear.notes.join(" ")} `],
    [520, `${gearUse.notes.join(" ")} `],
    [530, `${fogSmoke.notes.join(" ")} `],
    [540, `${localHeroOpposition.notes.join(" ")} `],
    [550, `${terrainPlan.notes.join(" ")} `],
    [560, `${senses.notes.join(" ")} `],
    [570, `${sensoryConditions.notes.join(" ")} `],
    [580, `${tracking.notes.join(" ")} `],
    [590, `${ambush.notes.join(" ")} `],
    [600, `${ambush.applicable ? loc`Required Ambush preparation: ${requiredPreparationSeconds} seconds. ` : ""} `],
    [
      605,
      hasFeat("False Start") && unopposed === true && method === "roll" && falseStartRestart(listedTime)
        ? loc`False Start: if this check fails you may stop and begin again from the next ${falseStartRestart(listedTime)}, spending only half the money or materials (p.200). `
        : ""
    ],
    [610, `${light.notes.join(" ")} `],
    [
      620,
      cunning ? loc`Cunning Plan: free action; error range ${cunning.originalError} → ${cunning.error} (p.79). ` : ""
    ],
    [630, substituted ? loc`All According to Plan: Intelligence replaces the check’s key attribute (p.79). ` : ""],
    [
      640,
      (system.classLevels?.schemer ?? 0) >= 10 && selected === "int" && method === "take10"
        ? loc`Hyperconscious: take 10 without doubling time. `
        : ""
    ],
    [
      650,
      `${classEffects.notes.filter(note => note !== intelligenceAnalysisNote() && note !== boobyTrapNote()).join(" ")} `
    ],
    [660, `${timing.notes} `],
    [
      670,
      charmerPlan.evidence
        ? loc`Required Influence time: ${requiredSkillSeconds(charmerPlan.baseSeconds, timing)} seconds. `
        : ""
    ],
    [
      680,
      hardCorePlan.evidence
        ? loc`Required Influence time: ${requiredSkillSeconds(hardCorePlan.baseSeconds, timing)} seconds. `
        : ""
    ],
    [690, armor ? loc`Armor/load check penalty ${armor}. ` : ""],
    [700, vision ? loc`Vision ${vision}. ` : ""],
    [710, hasForte ? loc`Forte +1. ` : ""],
    [720, Number(modifier) ? loc`Situational modifier ${Number(modifier) >= 0 ? "+" : ""}${Number(modifier)}. ` : ""],
    [730, synergy.value ? loc`Synergy +${synergy.value} (${synergy.skill}). ` : ""],
    [
      740,
      taking && /with permission/i.test(check.time) && gcTakingPermissionConfirmed === true
        ? loc`GC permission to take this fixed result confirmed. `
        : ""
    ],
    [750, taking ? loc`Taking ${fixedDie}: ${timeMultiplier}× the listed time; no threat or action-die boost. ` : ""],
    [760, timing.timeReduction === "take10" ? loc`Taking 10 uses normal time. ` : ""],
    [770, crossCheckActive && crossCheckAvailable ? loc`Cross-Check: triple the required time; active check. ` : ""],
    [780, minimumTime ? loc`Minimum time ${minimumTime}. ` : ""],
    [790, attention ? loc`Secret checks have the Cross-Check tag. ` : ""],
    [800, loc`${listedTime}. ${mode}. ${check.tags || loc`No tags`}. Rules p.${check.page}.`],
    [
      840,
      restraint.escape
        ? loc` Opposed Grapple: Size bonus +${restraint.sizeBonus}; ${restraint.timeLocked ? loc`untrained Proficiency: error +2, two full actions, no time reduction.` : loc`proficient: one full action.`}`
        : ""
    ]
  ]);
  return {
    ...terms.plans,
    tumblePath: tumblePath.evidence,
    fallDistance: fallDistance.evidence,
    balanceSurface: balance.evidence,
    hideCircumstances: hideCircumstance.evidence,
    detectionObserver: detectionObserver.evidence,
    hideMovement: hideMovementPlanResult.evidence,
    targetSkillEffect: targetSkillEffect.evidence,
    skillTiming: timing.skillTiming,
    dispositionSkill: disposition.evidence,
    stoneCold: stoneCold.evidence,
    analysisTask: analysisTask.context,
    trackingFeat: trackingFeatEvidence(system, key, check, {
      method,
      trackingSurface,
      trackingAgeHours,
      trackingWeatherHours,
      trackingLargeGroup,
      trackingPace,
      followingPhysicalTrail,
      surprise
    }),
    trackingMasteryTask: forensic.trackingEvidence,
    forensicGenius: forensic.evidence
      ? {
          ...forensic.evidence,
          selectedSynergy: { skill: synergy.skill ?? "", value: synergy.value },
          totalSynergy: synergyExtra
        }
      : null,
    closedCourseFeat: closedCourse.evidence
      ? {
          ...closedCourse.evidence,
          selectedSynergy: { skill: synergy.skill ?? "", value: synergy.value },
          totalSynergy: synergyExtra
        }
      : null,
    wheelFeat,
    practiceFeat,
    fundedTaking,
    terrainFeat,
    pursuitFeat: pursuit.evidence
      ? {
          ...pursuit.evidence,
          selectedSynergy: { skill: synergy.skill ?? "", value: synergy.value },
          totalSynergy: synergyExtra
        }
      : null,
    professionalFeat,
    restraintEscape: restraint.escape
      ? {
          condition: restraint.state,
          kind: "opposedGrapple",
          fullActions: restraint.timeLocked ? 2 : 1,
          armorCheckPenalty: true,
          grasp: true,
          proficient: restraint.proficient,
          sizeDifference: restraint.sizeDifference,
          sizeBonus: restraint.sizeBonus,
          timeLocked: restraint.timeLocked
        }
      : null,
    contactFeat: contactFeat.evidence
      ? {
          ...contactFeat.evidence,
          errorReduction: contactFeat.errorReduction,
          requiredSeconds: requiredSkillSeconds(contactFeat.baseSeconds, timing),
          timing: {
            applied: timing.timeReduction === "contactFeat",
            source: timing.timeReduction,
            multiplier: timeMultiplier,
            rounding: timing.timeRounding
          }
        }
      : null,
    charmer: charmerPlan.evidence
      ? {
          ...charmerPlan.evidence,
          applied: timing.timeReduction === "charmer",
          reduction: timing.timeReduction,
          timeMultiplier,
          requiredSeconds: requiredSkillSeconds(charmerPlan.baseSeconds, timing)
        }
      : null,
    appearanceModifiers: appearancePlan.evidence
      ? {
          ...appearancePlan.evidence,
          ...(appearancePlan.timeChoices?.length
            ? {
                timing: {
                  source: timing.timeReduction,
                  multiplier: timeMultiplier,
                  minimumSeconds: minimumTimeSeconds,
                  rounding: timing.timeRounding
                }
              }
            : {})
        }
      : null,
    hardCore: hardCorePlan.evidence
      ? {
          ...hardCorePlan.evidence,
          applied: timing.timeReduction === "hardCore",
          reduction: timing.timeReduction,
          timeMultiplier,
          requiredSeconds: requiredSkillSeconds(hardCorePlan.baseSeconds, timing)
        }
      : null,
    weaponFocusWork: weaponFocusWork.applicable ? weaponFocusWork : null,
    campaignSkillDCPolicy: campaignSkillDCPolicy(campaign),
    gamblingDice,
    mode,
    sleepingCoreReview,
    sensoryConditions,
    underwaterContext,
    qualityChecks,
    campaignSkillChecks: campaignChecks.evidence,
    medical: medical.applicable ? medical : null,
    littleDetails: details.active ? details : null,
    skillTags,
    skillGear: skillGear.required ? skillGear : null,
    localHeroOpposition: localHeroOpposition.applicable ? localHeroOpposition : null,
    fogSmoke,
    terrain: terrainPlan,
    senses,
    tracking: tracking.applicable || tracking.bonuses.length ? tracking : null,
    gcTakingPermissionConfirmed: taking && /with permission/i.test(check.time) && gcTakingPermissionConfirmed === true,
    ambush: ambush.applicable ? { ...ambush, requiredPreparationSeconds } : null,
    ambientLight: light,
    normalSkillBonus,
    skillBonusCondition: condition,
    skillBonus,
    skillBonusEntries,
    checkBonusEntries,
    checkAdjustment,
    method,
    fixedDie,
    timeMultiplier,
    actionDiceCost,
    actionDiceBenefits: Number(hailMaryUntrained) + Number(hailMaryUncap) + Number(hailMaryActive),
    crossCheckAvailable,
    minimumTime,
    minimumTimeSeconds,
    timeRounding: timing.timeRounding,
    timeBaseMultiplier: timing.timeBaseMultiplier,
    crossCheckMultiplier: timing.crossCheckMultiplier,
    timeRoundingBeforeCrossCheck: timing.timeRoundingBeforeCrossCheck,
    timeReduction: timing.timeReduction,
    timeReductionOptions: timing.timeReductionOptions,
    practiceMakesPerfect: hasFeat("Practice Makes Perfect"),
    criticalFailureCostIncrease: hasFeat("Practice Makes Perfect") ? 1 : 0,
    crossCheck: !!attention,
    actionDiceAllowed: !taking && !mode.includes("Passive"),
    blockedReason: blockedReasons.join(" "),
    cunningPlan: cunning,
    attributeSubstitution: substituted ? { source: "All According to Plan", originalAbility, ability: "int" } : null,
    ability: selected,
    synergy: synergy.value,
    synergySkill: synergy.skill,
    // The synergy bonus actually inside the total, after named-bonus stacking.
    synergyBonus: synergyExtra,
    ...planTotal("skill", { system, skillKey: key, check, ability: selected, method }, [
      [loc`Skill bonus`, condition.total],
      [loc`Synergy`, synergyExtra],
      [loc`Check adjustments`, checkAdjustment]
    ]),
    armor,
    missingFocus: !!missingFocus,
    threat: taking
      ? 0
      : conditionalThreat
        ? Math.max(
            1,
            conditionalThreat - ambush.threatIncrease - terms.sum("threatIncrease") - disposition.threatIncrease
          )
        : 0,
    error: taking ? 0 : error,
    cap: method === "take20" && attention ? null : cap,
    blocked: blockedReasons.length > 0,
    rollMode: mode.includes("Passive") || mode === "Secret" || (!forceActive && secret) ? "blindroll" : undefined,
    take10TimeMultiplier:
      cakewalk || ((system.classLevels?.schemer ?? 0) >= 10 && selected === "int")
        ? 1
        : skill.take10TimeMultiplier === 1
          ? 1
          : (campaign.take10Base ?? skill.take10TimeMultiplier ?? 2),
    notes: noteSegments.join("")
  };
}
