/**
 * What the Classes tab shows beside a limited-use class ability, by the ability's workflow: a button that runs it, a
 * note on where to use it instead, or a GC-only button with a note for players. One table instead of a chain of
 * {{#if}} branches in agent-classes.hbs.
 *
 * Fields: action (the sheet action a button runs), label (its text), resource / named (the button also carries the
 * ability's id / name), text (a note after or instead of the button), gcOnly + playerText (only the GC gets the
 * button; players read the note), separator (" · " before it), spaced (a space before the button).
 */
const CONTROLS = {
  freeManeuver: { text: "SPYCRAFT.Template.ActorAgentClasses.UseTheOneHandOnThe" },
  wellFundedCash: { action: "useWellFunded", label: "SPYCRAFT.Template.ActorAgentClasses.ReceiveCashAtHome" },
  toolShedKit: { action: "useToolShed", label: "SPYCRAFT.Template.ActorAgentClasses.FindAGradeIIIKitAt" },
  personalStashGear: { text: "SPYCRAFT.Template.ActorAgentClasses.UseTheRequestGearCheckDialog" },
  improvisedSearch: { text: "SPYCRAFT.Template.ActorAgentClasses.UseTheImprovisedWeaponSearchOn" },
  adrenalineJunkie: {
    gcOnly: true,
    action: "recordAdrenalineWoundLoss",
    label: "SPYCRAFT.Template.ActorAgentClasses.RecordFinalWoundLossEvent",
    playerText: "SPYCRAFT.Template.ActorAgentClasses.TheGCRecordsTheActualWound"
  },
  masterPlan: {
    action: "activateMasterPlan",
    label: "SPYCRAFT.Template.ActorAgentClasses.GainSceneBonusDiceFreeAction"
  },
  mentalLeap: {
    action: "activateMentalLeap",
    label: "SPYCRAFT.Template.ActorAgentClasses.ActivateTemporaryAttributeBonus"
  },
  summonAssistants: {
    action: "summonClassAssistants",
    resource: true,
    label: "SPYCRAFT.Template.ActorAgentClasses.SummonNonCombatAssistants"
  },
  sessionBasicFeat: {
    action: "useEverydayGenius",
    label: "SPYCRAFT.Template.ActorAgentClasses.GainATemporaryBasicSkillFeat"
  },
  selfAdvancedFeats: {
    action: "useKnowItAll",
    label: "SPYCRAFT.Template.ActorAgentClasses.ChooseTwoTemporaryAdvancedSkillFeats"
  },
  selfTerrainFeat: {
    action: "useAnyTimeAnyPlace",
    label: "SPYCRAFT.Template.ActorAgentClasses.GainATemporaryTerrainFeat"
  },
  intelTemporaryFeat: {
    action: "useIntelTemporaryFeats",
    resource: true,
    label: "SPYCRAFT.Template.ActorAgentClasses.ChooseTemporaryFeatsDuringIntel"
  },
  noFear: { action: "activateNoFear", label: "SPYCRAFT.Template.ActorAgentClasses.ActivateStressResistance" },
  finalDeduction: { action: "useFinalDeduction", label: "SPYCRAFT.Template.ActorAgentClasses.RecordFullStudyRound" },
  globalSearch: { action: "useGlobalSearch", label: "SPYCRAFT.Template.ActorAgentClasses.RecordCompletedSearch" },
  littleDetails: { action: "useLittleDetails", label: "SPYCRAFT.Template.ActorAgentClasses.DeclareFreeAction" },
  manual: {
    spaced: true,
    action: "useLimitedAbility",
    resource: true,
    named: true,
    label: "SPYCRAFT.Template.ActorAgentClasses.Use"
  },
  reroll: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.UseTheRollSRerollControl" },
  oneInAMillion: {
    separator: true,
    action: "useOneInAMillion",
    label: "SPYCRAFT.Template.ActorAgentClasses.DeclareAttackFortitudeSave",
    text: "SPYCRAFT.Template.ActorAgentClasses.SkillsUseTheirRollDialog"
  },
  improvisation: {
    separator: true,
    action: "improviseCommonItem",
    label: "SPYCRAFT.Template.ActorAgentClasses.ImproviseACommonItem"
  },
  masterThief: {
    separator: true,
    action: "useMasterThief",
    label: "SPYCRAFT.Template.ActorAgentClasses.ReplaceAnOpposedSkillRoll"
  },
  hintResponse: {
    separator: true,
    gcOnly: true,
    action: "recordHintResponse",
    resource: true,
    label: "SPYCRAFT.Template.ActorAgentClasses.RecordHintResponse",
    playerText: "SPYCRAFT.Template.ActorAgentClasses.TheGCRecordsTheHintResponse"
  },
  requestBenefit: {
    separator: true,
    action: "rollGearAcquisition",
    resource: true,
    label: "SPYCRAFT.Template.ActorAgentClasses.UseRequestDialog"
  },
  manualAdjustment: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.UseTheFailedRollSManual" },
  millionDollarSkill: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.ChooseInTheRangedAttackDialog" },
  eagleEye: {
    separator: true,
    action: "useEagleEye",
    label: "SPYCRAFT.Template.ActorAgentClasses.SpendAndRollForSceneRange"
  },
  selfTemporaryFeat: {
    separator: true,
    action: "useRenaissanceMan",
    label: "SPYCRAFT.Template.ActorAgentClasses.GainATemporaryBasicSkillFeat2"
  },
  cunningPlan: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.UseARollDialogOrThe" },
  fortunesOfWar: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.UseTheFortunesOfWarControl" },
  breakthrough: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.ChooseInTheSkillOrKnowledge" },
  brightIdea: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.ChooseInTheSkillOrKnowledge" },
  tenSecondSolution: { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.ChooseInTheSkillOrKnowledge" }
};

const OTHERWISE = { separator: true, text: "SPYCRAFT.Template.ActorAgentClasses.ChooseBeforeRollingASkill" };

/**
 * @param {string} [workflow]
 * @returns {object}
 */
export function classAbilityControl(workflow) {
  return Object.hasOwn(CONTROLS, workflow ?? "") ? CONTROLS[workflow] : OTHERWISE;
}

export const CLASS_ABILITY_CONTROLS = CONTROLS;
