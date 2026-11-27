import { editPortrait } from "../apps/portrait-picker.mjs";
import { refuse, refuseStep } from "../error-notices.mjs";
import { placeSheet, rememberSheetPlacement } from "./sheet-placement.mjs";
import { enrich } from "./enrich.mjs";
import { chosenPicks, ruleTip } from "./rule-tips.mjs";
import { abilityTip, agentBonusTips, npcSkillTip, saveTip, skillTip, weaponAttackTip } from "./bonus-tips.mjs";
import { classAbilityControl } from "./class-ability-controls.mjs";
import { HALF_ACTIONS_PER_TURN, actionBudget } from "../rules/action-budget.mjs";
import { manageNpcPackages } from "../apps/npc-packages.mjs";
import { systemDialog } from "../apps/dialog-theme.mjs";
import { formDialog } from "../apps/dialog-kit.mjs";
import { weaponFacts } from "./play-rows.mjs";
import { formatRange } from "../rules/outcome-labels.mjs";
import { originRuleName } from "../rules/rule-name.mjs";
import { SaveFeedback } from "./save-feedback.mjs";
import { KeepPlace } from "./keep-place.mjs";
import { installResolutionGuide } from "../apps/resolution-guide.mjs";
import { vehicleClass } from "../rules/vehicles.mjs";
import {
  buildSetupGuide,
  combatToolVisibility,
  focusSetupTask,
  activeConditionLabels,
  conditionStamps,
  activeEffectLines,
  defenseBoostState,
  flatFootedDefense,
  enhanceAgentSheet,
  buildCreationTrack
} from "./agent-ux.mjs";
import { COMBAT_STANCES } from "../rules/combat-stance.mjs";
import { manageThreadNeedle } from "../apps/thread-needle.mjs";
import { takeStrikingAttack, reviewStrikingAttack } from "../apps/striking-stance.mjs";
import { recordFendMovement } from "../apps/fend.mjs";
import { takeCounterTrip, reviewCounterTrip } from "../apps/counter-trip.mjs";
import { takeTripFinalAttack, reviewTripFinalAttack } from "../apps/trip-final-attack.mjs";
import { manageTripOutcomes } from "../apps/trip-outcomes.mjs";
import { managePowerStanceInitiative } from "../apps/power-stance.mjs";
import { manageDrivingStance } from "../apps/driving-stance.mjs";
import { manageStanceDamage } from "../apps/stance-damage.mjs";
import { reviewStanceMovement } from "../apps/stance-movement.mjs";
import { reviewFeintBenefits } from "../apps/feint-review.mjs";
import { manageFeintOutcomes } from "../apps/feint-outcomes.mjs";
import { declareCombatStance, managePunishingDamage } from "../apps/combat-stance.mjs";
import {
  settleSilverTongueVictory,
  resumeSilverTongueVictory,
  correctSilverTongueVictory,
  recoverSilverTongueAtMissionEnd,
  silverVictoryRows
} from "../apps/silver-tongue.mjs";
import { markRows } from "../rules/mark.mjs";
import { safeHouseSource, safeHouseRows } from "../rules/safe-house.mjs";
import { careerAgentMissionKey, getCareerAgentReview } from "../rules/career-agent.mjs";
import { wellFundedCashHistory } from "../rules/well-funded.mjs";
import { toolShedKitState, toolShedSource } from "../rules/tool-shed.mjs";
import { declareDarting, takeDartingFinalAttack, reviewDarting } from "../apps/darting.mjs";
import { declareSuperiorCover, reviewSuperiorCover } from "../apps/superior-cover.mjs";
import { careerFormPlan, mergeCareerForm } from "../rules/career-form.mjs";
import { settlePendingDamageSave } from "../apps/damage-settlement.mjs";
import { rollPendingDamageSave } from "../apps/damage-saves.mjs";
import { reviewDamageLedger, applyAccumulatedDamage } from "../apps/damage-ledger.mjs";
import { checkAccumulatedDamage } from "../apps/accumulated-damage.mjs";
import { nonLethalMeters } from "../rules/accumulated-damage.mjs";
import { settleGrapple } from "../apps/combat-actions.mjs";
import {
  acidStep,
  endSurvivalHazard,
  endTypedExposure,
  exposureFailedSave,
  sufferTypedDamage,
  survivalSave
} from "../apps/damage-types.mjs";
import { cancelReady, coupDeGraceSave, recordAnticipate, standOff, tireResult } from "../apps/combat-options.mjs";
import {
  burningRound,
  cureHazard,
  exposeToContagion,
  exposeToFire,
  extinguish,
  fightFire,
  hazardsView,
  rollContagionSave,
  rollFireSave
} from "../apps/hazards.mjs";
import { takeMobileOffense } from "../apps/mobile-offense.mjs";
import { takeContempt } from "../apps/contempt.mjs";
import { takeCombatInstincts } from "../apps/combat-instincts.mjs";
import { takeDropFollowUp, reviewTriggeredAttacks } from "../apps/drop-follow-up.mjs";
import { takeOpportunist } from "../apps/opportunist.mjs";
import { grantFortunate } from "../apps/fortunate.mjs";
import { applyBlackCat } from "../apps/black-cat.mjs";
import { enterBerserkerRage, endBerserkerRage } from "../apps/berserker.mjs";
import { useGunslingersEye } from "../apps/gunslinger.mjs";
import { takeFireTeamSupremacy } from "../apps/team-final-attack.mjs";
import { declareDuelingBasics } from "../apps/dueling-basics.mjs";
import { declareFightDefensively, declareIntenseStance } from "../apps/fight-defensively.mjs";
import { declareSnakeStrike } from "../apps/snake-strike.mjs";
import { companionsContext, createCompanion, recordCompanionDeath } from "../apps/companions.mjs";
import { editIdentity, removeIdentity, enterIdentity, leaveIdentity } from "../apps/flawless-identity.mjs";
import { rollDisarmResponse } from "../apps/disarm-response.mjs";
import { takeMissTrick } from "../apps/miss-tricks.mjs";
import { rollCheapShot } from "../apps/cheap-shot.mjs";
import { rollDisarm } from "../apps/disarm.mjs";
import { declareTwoWeapon, reviewTwoWeapon, takeTwoWeaponFinalAttack } from "../apps/two-weapon.mjs";
import { checkNumericalAdvantage } from "../apps/numerical-advantage.mjs";
import { criticalInjuryReviews } from "../apps/critical-injuries.mjs";
import { takeTotalDefense } from "../apps/total-defense.mjs";
import { checkCombatMovement } from "../apps/combat-movement.mjs";
import { activateCombatExpertise } from "../apps/combat-expertise.mjs";
import { checkReflexDamage } from "../apps/reflex-damage.mjs";
import { checkIncomingDefense } from "../apps/incoming-defense.mjs";
import { checkBurrowMaterial } from "../apps/burrow-material.mjs";
import { computeAgent } from "../rules/engine.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";
import { selectCakewalkSkills } from "../apps/cakewalk.mjs";
import { recordUncontrolledFall } from "../apps/falling-damage.mjs";
import { cakewalkSelectionState } from "../rules/cakewalk.mjs";
import { campaignVitalityDie } from "../rules/campaign-creation.mjs";
import { calculateRecoveryRates } from "../apps/recovery-rates.mjs";
import { restAndRecover, rollDying } from "../apps/healing.mjs";
import { ACTION_COSTS, attackActionCost } from "../rules/combat-actions.mjs";
import { nonLethalTotals, resolveQuickAttack } from "../apps/damage-application.mjs";
import { woundState } from "../rules/damage-application.mjs";
import { reloadWeapon, resupplyWeapon, weaponAmmunition } from "../apps/ammunition-use.mjs";
import { ammunitionLabel } from "../rules/ammunition-use.mjs";
import { planAmmunitionStockpile } from "../apps/ammunition-planner.mjs";
import { ammunitionConfiguration, compatibleAmmunition } from "../rules/ammunition.mjs";
import { CAMOUFLAGE_TERRAINS, camouflageTerrain } from "../rules/quality-checks.mjs";
import { RESISTANCE_TYPES, resistanceType } from "../rules/resistances.mjs";
import { brightIdeaPoolStatus } from "../rules/bright-idea.mjs";
import { queueResources, isResourceLock } from "../services/transactions.mjs";
import { conditionNpcProfile, npcSkillConditionContext } from "../rules/npc-conditions.mjs";
import { NPC_RULES, NPC_STATS, NPC_CATEGORIES, defaultNpcProfile, computeNpcProfile } from "../rules/npcs.mjs";
import { reviewActorRules } from "../apps/rules-refresh.mjs";
import { classSkillSelections, orderedClassChoices } from "../rules/class-skills.mjs";
import { armorSlot } from "../rules/gear.mjs";
import { renderTemplate } from "../rules/formula.mjs";
import { describe as describePrereq } from "../rules/prerequisites.mjs";
import { SpycraftBrowser } from "../apps/browser.mjs";
import {
  rollNpcSkill,
  callQualitySave,
  npcDamageSaveWithUndo,
  resetDamageTrack,
  manageDisposition,
  damageSaveState,
  npcIsSpecial,
  dispositionRows
} from "../apps/gc/npc-play.mjs";
import { costsAction } from "../apps/gc/combat.mjs";
import { manageSceneDisposition } from "../apps/scene-disposition.mjs";
import { reviewSkillPurchasePolicy } from "../apps/skill-purchase-policy.mjs";
import { usesSceneDisposition } from "../rules/scene-disposition.mjs";
import { loc } from "../i18n.mjs";
import { featActions } from "./feat-actions.mjs";
import { quickAttackOptions, quickAttackHasTarget, skipDialog } from "../apps/remembered-choices.mjs";
import { enableHotbarDrag } from "../apps/hotbar.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TPL = "systems/spycraft2/templates/actor";

/* -------------------------------------------------------------------------- */
/*  Agent sheet                                                               */
/* -------------------------------------------------------------------------- */

/** A weapon's counted shots for the sheets, or null when it has none to count. */
function weaponShots(item) {
  const state = weaponAmmunition(item);
  return state ? { ...state, label: ammunitionLabel(state), empty: state.loaded === 0 } : null;
}
/** What an NPC's feat items add, as the sheet shows it. */
function npcFeatPlay(effects) {
  if (!effects?.rows?.length && !effects?.uncounted?.length) return null;
  const signed = value => (value >= 0 ? `+${value}` : `${value}`);
  const healthLeft = !effects.healthApplied && !effects.damageSaveHealth && (effects.vitality || effects.wounds);
  return {
    title: loc`Feats in play`,
    rows: effects.rows.map(row => loc`${row.name}: ${row.label} ${signed(row.value)}`),
    health: effects.damageSaveHealth
      ? effects.damageSaveHealth.needsReview
        ? loc`Health bonuses would adjust the Damage save by ${signed(effects.damageSaveHealth.automatic)}. Review the existing manual adjustment before adding them.`
        : loc`Health bonuses add ${signed(effects.damageSaveHealth.applied)} to the Damage save; the manual adjustment is separate.`
      : healthLeft
        ? loc`Vitality ${signed(effects.vitality)} and wounds ${signed(effects.wounds)} are not added to typed-in maximums: include them in the numbers above.`
        : "",
    uncounted: effects.uncounted.length
      ? loc`These feats have other bonuses that are not worked out; apply them by hand: ${effects.uncounted.join(", ")}.`
      : ""
  };
}

const playLabels = () => ({
  reload: loc`Reload`,
  resupply: loc`Restore the printed supply`,
  rest: loc`Rest and recover`,
  stress: loc`Stress damage`,
  subdual: loc`Subdual damage`,
  nextSetup: loc`Next setup step`,
  dying: loc`Dying: roll to stabilize`
});

/**
 * A Shift-click attack rolls at once only when it has one target; without one it would post with no range or
 * Defense, so the dialog opens instead and says why.
 */
function quickAttack(event, actor) {
  if (!skipDialog(event)) return false;
  if (quickAttackHasTarget(actor)) return true;
  ui.notifications.info(loc`No single target: the attack dialog opens so the range can be entered.`);
  return false;
}

/** Sheet actions for buttons whose whole job is to call the Actor method named like the action. */
const actorMethods = (...names) =>
  Object.fromEntries(
    names.map(name => [
      name,
      function () {
        return this.actor[name]();
      }
    ])
  );

/** Sheet actions for buttons whose whole job is to hand the actor to a workflow function. */
const actorWorkflows = workflows =>
  Object.fromEntries(
    Object.entries(workflows).map(([name, workflow]) => [
      name,
      function () {
        return workflow(this.actor);
      }
    ])
  );

export class SpycraftAgentSheet extends KeepPlace(HandlebarsApplicationMixin(SaveFeedback(ActorSheetV2))) {
  /** Career level whose skill points are being edited on the Skills tab. */
  _skillLevel = null;

  /** Local disclosure preferences survive complete and partial sheet renders. */
  _open = { todo: false, warnings: false };

  /** A local view preference, never stored on the character. */
  _editMode = null;
  _showAllTools = false;
  /** While set, choosing a combat tool pins or unpins it instead of using it. */
  _pinMode = false;
  _toolSearch = "";
  _skillSearch = "";
  _trainedOnly = false;

  /** Open where this user last left a agent sheet, or against the left edge, clear of the map's centre and the chat. */
  _initializeApplicationOptions(options) {
    return placeSheet(super._initializeApplicationOptions(options), options, "agent");
  }

  /** Remember where the sheet was, so the next one opens there. */
  _onClose(options) {
    super._onClose(options);
    rememberSheetPlacement("agent", this.position);
  }

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "agent"],
    // Wide enough for the rail and one pane, narrow enough to leave the map and the chat in view.
    position: { width: 860, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      // Players without Foundry's file browser can still change the picture (module/apps/portrait-picker.mjs).
      editImage: editPortrait,
      // Buttons that call the Actor method of the same name.
      ...actorMethods(
        "applyShaken",
        "reviewShakenApplication",
        "reviewMissionXP",
        "reviewActionDieAward",
        "reviewActionDiceSettlement",
        "activateMasterPlan",
        "rollDrunkReposition",
        "beginDrunkSleep",
        "completeDrunkSleep",
        "beginFatigueRest",
        "completeFatigueRest",
        "reviewRestraintRelease",
        "applyBaffled",
        "reviewBaffledApplication",
        "applyFatigue",
        "wakeFromSleep",
        "setSickened",
        "rollCriticalInjury",
        "manageCheapShots",
        "manageAnalysisTasks",
        "manageTakedown",
        "manageMeleeTradeoff",
        "sufferInitiativeLoss",
        "useEagleEye",
        "useRenaissanceMan",
        "useMark",
        "migrateBrightIdeaUses",
        "recordAdrenalineWoundLoss",
        "useFinalDeduction",
        "useGlobalSearch",
        "useLittleDetails",
        "useMasterThief",
        "useSafeHouse",
        "useCareerAgentReward",
        "reviewCareerAgentReward",
        "useWellFunded",
        "useToolShed",
        "improviseCommonItem",
        "useOneInAMillion",
        "selectBigStickGear",
        "selectArmorUseGear",
        "reviewReserveTransaction",
        "allocateMissionReserves",
        "settleFavoredGearSession",
        "reviewFavoredGearSession",
        "recordFavoredGearLevelChoices",
        "findImprovisedWeapon",
        "claimGearAcquisition",
        "recoverResourceTransaction",
        "settleMissionXP",
        "reviewCrossroadsMissionXP",
        "reviewCrossroadsSession",
        "completeCrossroads",
        "purchaseFeatChoice",
        "reviewStartingAttributes",
        "reviewCreationPolicy",
        "configureModularCreation",
        "reviewAdvancement",
        "awardActionDice",
        "rollKnowledge",
        "configureFortuneTeammates",
        "activateMentalLeap",
        "recordFatigueEscalation",
        "startMentalLeapSleep",
        "completeMentalLeapSleep",
        "rollWisdomCollapse",
        "useEverydayGenius",
        "useKnowItAll",
        "useAnyTimeAnyPlace",
        "activateNoFear",
        "boostFortunesOfWar"
      ),
      // Buttons that hand the actor to a workflow.
      ...actorWorkflows({
        manageSceneDisposition,
        reviewSkillPurchasePolicy,
        selectCakewalkSkills,
        recordUncontrolledFall,
        checkReflexDamage,
        takeMobileOffense,
        takeContempt,
        takeCombatInstincts,
        takeOpportunist,
        grantFortunate,
        applyBlackCat,
        enterBerserkerRage,
        useGunslingersEye,
        takeFireTeamSupremacy,
        declareDuelingBasics,
        declareFightDefensively,
        declareIntenseStance,
        declareSnakeStrike,
        leaveIdentity,
        endBerserkerRage,
        reviewFeintBonuses: reviewFeintBenefits,
        takeCounterTrip,
        reviewCounterTrip,
        reviewTriggeredAttacks,
        takeTripFinalAttack,
        reviewTripFinalAttack,
        manageTripOutcomes,
        manageFeintOutcomes,
        takeStrikingAttack,
        reviewStrikingAttack,
        manageThreadNeedle,
        recordFendMovement,
        reviewStanceMovement,
        reviewPowerStanceInitiative: managePowerStanceInitiative,
        declareCombatStance,
        manageDrivingStance,
        manageStanceDamage,
        managePunishingDamage,
        takeMissTrick,
        rollCheapShot,
        declareTwoWeapon,
        takeTwoWeaponFinalAttack,
        reviewTwoWeapon,
        checkNumericalAdvantage,
        checkCombatMovement,
        declareDarting,
        takeDartingFinalAttack,
        reviewDarting,
        declareSuperiorCover,
        reviewSuperiorCover,
        activateCombatExpertise,
        settlePendingDamageSave,
        rollPendingDamageSave,
        reviewDamageLedger,
        applyAccumulatedDamage,
        checkAccumulatedDamage,
        exposeToContagion,
        settleGrapple,
        sufferTypedDamage,
        survivalSave,
        exposureFailedSave,
        endTypedExposure,
        recordAnticipate,
        standOff,
        tireResult,
        coupDeGraceSave,
        cancelReady,
        exposeToFire,
        burningRound,
        extinguishFire: extinguish,
        checkIncomingDefense,
        checkBurrowMaterial,
        settleSilverTongueVictory,
        recoverSilverTongueAtMissionEnd,
        reviewRules: reviewActorRules,
        restAndRecover,
        rollDying,
        calculateRecoveryRates
      }),
      toggleEditMode() {
        if (!this.isEditable) return;
        this._editMode = !this._editMode;
        return this.render();
      },
      toggleAllTools(event, target) {
        if (!game.user.isGM) return;
        this._showAllTools = target.checked;
        return this.render();
      },
      togglePinMode() {
        this._pinMode = !this._pinMode;
        return this.render();
      },
      async toggleHalfAction(event, target) {
        if (!this.isEditable) return;
        const combat = this.actor.participatingCombat;
        if (!combat?.started) return;
        const combatant = this._roundCombatant();
        if (!combatant) return;
        const index = Number(target.dataset.index);
        const spent = this._roundActionsSpent();
        // Choosing the last spent pip frees it; choosing any other marks everything up to it as spent.
        const next = spent === index + 1 ? index : index + 1;
        // The same record the combat tracker's menu keeps, so the two always agree.
        await combatant.update({ "flags.spycraft2.actions": { round: combat.round, used: next } });
        return this.render();
      },
      setupTask: SpycraftAgentSheet.#onSetupTask,
      editShakenSource(event, target) {
        return this.actor.editShakenSource(target.dataset.sourceUuid);
      },
      reviewShakenInitiative(event, target) {
        return this.actor.reviewShakenInitiative(target.dataset.combatId, target.dataset.combatantId);
      },
      applyDrunkReposition(event, target) {
        return this.actor.applyDrunkReposition({ id: target.dataset.recordId });
      },
      confirmDrunkReposition(event, target) {
        return this.actor.confirmDrunkReposition({ id: target.dataset.recordId });
      },
      confirmRestraintEscapeMove(event, target) {
        const message = game.messages.get(target.dataset.messageId);
        if (!message) return refuse(loc`Load the original grapple message before confirming movement.`);
        return this.actor.confirmRestraintEscapeMove(message);
      },
      escapeRestraint() {
        return this.actor.rollSkill("athletics", "str", { initialCheck: "restraint-escape" });
      },
      setMovementCondition(event, target) {
        return this.actor.setReviewedCondition(target.dataset.condition);
      },
      reviewCriticalInjury(event, target) {
        return this.actor.reviewCriticalInjury(target.dataset.injury);
      },
      takeTotalDefense: costsAction("full", function () {
        return takeTotalDefense(this.actor);
      }),
      takeCleaveBasics() {
        return takeDropFollowUp(this.actor, "cleaveBasics");
      },
      takeSnapShot() {
        return takeDropFollowUp(this.actor, "snapShot");
      },
      createCompanion(event, target) {
        return createCompanion(this.actor, target.dataset.feat);
      },
      openCompanion(event, target) {
        return fromUuidSync(target.dataset.uuid)?.sheet?.render(true);
      },
      companionDied(event, target) {
        return recordCompanionDeath(this.actor, target.dataset.uuid);
      },
      editIdentity(event, target) {
        return editIdentity(this.actor, target.dataset.id ?? "");
      },
      removeIdentity(event, target) {
        return removeIdentity(this.actor, target.dataset.id);
      },
      enterIdentity(event, target) {
        return enterIdentity(this.actor, target.dataset.id);
      },
      rollDisarm: costsAction(attackActionCost, function () {
        return rollDisarm(this.actor);
      }),
      rollDisarmResponse(event, target) {
        return rollDisarmResponse(this.actor, { weaponId: target.closest("[data-item-id]")?.dataset.itemId });
      },
      declareFollowUp() {
        return declareDarting(this.actor, { kind: "followUp" });
      },
      declareTwoHit() {
        return declareDarting(this.actor, { kind: "twoHit" });
      },
      acidStep(event, target) {
        return acidStep(this.actor, target.dataset.step);
      },
      endSurvivalHazard(event, target) {
        return endSurvivalHazard(this.actor, target.dataset.kind);
      },
      rollContagionSave(event, target) {
        return rollContagionSave(this.actor, target.dataset.id);
      },
      cureHazard(event, target) {
        return cureHazard(this.actor, target.dataset.id);
      },
      fightFire(event, target) {
        return fightFire(this.actor, target.dataset.method);
      },
      rollFireSave(event, target) {
        return rollFireSave(this.actor, target.dataset.kind);
      },
      planAmmunition(event, target) {
        return planAmmunitionStockpile(this.actor.items.get(target.closest("[data-item-id]").dataset.itemId));
      },
      rollAbility: SpycraftAgentSheet.#onRollAbility,
      rollSave: SpycraftAgentSheet.#onRollSave,
      rollSkill: SpycraftAgentSheet.#onRollSkill,
      shareTemporaryFeats(event, target) {
        return this.actor.shareTemporaryFeats(target.dataset.ability);
      },
      reviewLimitedUseCounter(event, target) {
        return this.actor.reviewLimitedUseCounter(target.dataset.resource);
      },
      chooseTemporaryFocuses(event, target) {
        return this.actor.chooseTemporaryFocuses({ featId: target.dataset.itemId });
      },
      resumeSilverTongueVictory(event, target) {
        return resumeSilverTongueVictory(this.actor, target.dataset.victory);
      },
      correctSilverTongueVictory(event, target) {
        return correctSilverTongueVictory(this.actor, target.dataset.victory);
      },
      discloseMark(event, target) {
        return this.actor.discloseMark(target.dataset.observation);
      },
      correctMark(event, target) {
        return this.actor.correctMark(target.dataset.observation);
      },
      useFeatFreeAction(event, target) {
        return this.actor.useFeatFreeAction(target.dataset.resource);
      },
      useLimitedAbility(event, target) {
        return this.actor.useManualLimitedAbility(target.dataset.resource);
      },
      recordHintResponse(event, target) {
        return this.actor.recordHintResponse({ source: target.dataset.resource });
      },
      correctSafeHouseRecord(event, target) {
        return this.actor.correctSafeHouseRecord(target.dataset.house);
      },
      placeSafeHouse(event, target) {
        return this.actor.placeSafeHouse(target.dataset.house);
      },
      reviewSafeHouseMission() {
        return this.actor.reviewLimitedUseCounter("safeHouseMission");
      },
      reviewSafeHouseScene() {
        return this.actor.reviewLimitedUseCounter("safeHouseScene");
      },
      reviewWellFundedCounter() {
        return this.actor.reviewLimitedUseCounter("wellFunded");
      },
      reviewToolShedCounter() {
        return this.actor.reviewLimitedUseCounter("toolShed");
      },
      selectMissionCaliberGear(event, target) {
        return this.actor.selectMissionCaliberGear({ source: target.dataset.source });
      },
      rollGearAcquisition(event, target) {
        return this.actor.rollGearAcquisition(
          target?.dataset.resource ? { requestAbility: target.dataset.resource } : {}
        );
      },
      manageGCDice() {
        return game.spycraft2.gcDice.manage();
      },
      reviewUsagePeriod() {
        return game.spycraft2.reviewUsagePeriod();
      },
      async resetUsagePeriod(event, target) {
        await game.spycraft2.resetUsagePeriod(target.dataset.period);
        this.render();
      },
      initializeResources() {
        return this.actor.initializeStartingResources();
      },
      keepResources() {
        return this.actor.initializeStartingResources({ keepCurrent: true });
      },
      restoreRules() {
        return reviewActorRules(this.actor, { restore: true });
      },
      reloadWeapon: costsAction("half", function (event, target) {
        return reloadWeapon(this._item(target));
      }),
      resupplyWeapon(event, target) {
        return resupplyWeapon(this._item(target));
      },
      rollAttack: costsAction(attackActionCost, SpycraftAgentSheet.#onRollAttack),
      rollRangedAttack: costsAction(attackActionCost, function (event, target) {
        return this.actor.rollRangedAttack(this._item(target));
      }),
      rollDamage: SpycraftAgentSheet.#onRollDamage,
      rollInitiative: SpycraftAgentSheet.#onRollInitiative,
      rollVitality: SpycraftAgentSheet.#onRollVitality,
      reviewVitality(event, target) {
        return this.actor.reviewVitality(Number(target.dataset.index));
      },
      todo: SpycraftAgentSheet.#onTodo,
      healActionDice() {
        return this.actor.healWithActionDice();
      },
      refreshAction() {
        return this.actor.refreshWithActionDie();
      },
      endMentalLeap(event, target) {
        return this.actor.endMentalLeap({ id: target.dataset.recordId });
      },
      summonClassAssistants(event, target) {
        return this.actor.summonClassAssistants(target.dataset.resource);
      },
      withdrawClassAssistants(event, target) {
        return this.actor.withdrawClassAssistants(target.dataset.groupId);
      },
      useIntelTemporaryFeats(event, target) {
        return this.actor.useIntelTemporaryFeats(target.dataset.resource);
      },
      boostDefense() {
        return this.actor.boostDefenseWithActionDie();
      },
      async endTurn() {
        const combat = this.actor.participatingCombat;
        if (!combat?.started) return refuse(loc`${this.actor.name} is not in a running combat.`);
        if (combat.combatant?.actor?.uuid !== this.actor.uuid)
          return refuse(loc`It is not ${this.actor.name}'s turn, so there is no turn to end.`);
        return combat.nextTurn();
      },
      async adjustActionDice() {
        if (!this.isEditable) return null;
        const held = this.actor.system.actionDice?.value ?? 0;
        const input = await formDialog({
          title: loc`Adjust action dice`,
          intro: loc`${this.actor.name} holds ${held} action dice. Use this to correct the count; spending and awards change it for you.`,
          fields: [{ number: "value", label: loc`Action dice held`, min: 0, step: 1, value: held, required: true }]
        });
        const value = Math.trunc(Number(input?.value));
        if (!input || !Number.isSafeInteger(value) || value < 0 || value === held) return null;
        return this.actor.update({ "system.actionDice.value": value });
      },
      spendActionDie: SpycraftAgentSheet.#onSpendActionDie,
      addLevel: SpycraftAgentSheet.#onAddLevel,
      addLevelInClass: SpycraftAgentSheet.#onAddLevelInClass,
      removeLevel: SpycraftAgentSheet.#onRemoveLevel,
      browse: SpycraftAgentSheet.#onBrowse,
      itemEdit: SpycraftAgentSheet.#onItemEdit,
      itemDelete: SpycraftAgentSheet.#onItemDelete,
      itemChat: SpycraftAgentSheet.#onItemChat,
      itemEquip: SpycraftAgentSheet.#onItemEquip,
      createItem: SpycraftAgentSheet.#onCreateItem,
      toggleFocus: SpycraftAgentSheet.#onToggleFocus,
      addRow: SpycraftAgentSheet.#onAddRow,
      removeRow: SpycraftAgentSheet.#onRemoveRow,
      skillLevel: SpycraftAgentSheet.#onSkillLevel,
      syncGrants: SpycraftAgentSheet.#onSyncGrants
    }
  };

  static PARTS = {
    rail: { template: `${TPL}/agent-rail.hbs`, scrollable: [""] },
    track: { template: `${TPL}/agent-track.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    // The Play tab is one part built from partials, so it keeps one scroll position and one pinned-tools row.
    play: {
      template: `${TPL}/agent-main.hbs`,
      templates: [
        ...[
          "dashboard",
          "identities",
          "reference-abilities",
          "reference-combat",
          "combat-attacks",
          "combat-movement",
          "combat-defense",
          "combat-outcomes",
          "combat-conditions",
          "combat-review",
          "round-counter",
          "gc-review"
        ].map(name => `${TPL}/play/${name}.hbs`),
        `${TPL}/parts/hazards.hbs`,
        `${TPL}/parts/weapon-row.hbs`,
        `${TPL}/parts/use-counter.hbs`
      ],
      scrollable: [""]
    },
    skills: { template: `${TPL}/agent-skills.hbs`, scrollable: [""] },
    gear: {
      template: `${TPL}/agent-gear.hbs`,
      templates: [`${TPL}/parts/gear-heading.hbs`, `${TPL}/parts/gear-row-controls.hbs`],
      scrollable: [""]
    },
    abilities: {
      template: `${TPL}/agent-abilities.hbs`,
      templates: [
        `${TPL}/agent-feats.hbs`,
        `${TPL}/agent-classes.hbs`,
        `${TPL}/play/gc-review.hbs`,
        `${TPL}/parts/use-counter.hbs`
      ],
      scrollable: [""]
    },
    dossier: {
      template: `${TPL}/agent-dossier.hbs`,
      templates: [`${TPL}/agent-training.hbs`, `${TPL}/agent-bio.hbs`],
      scrollable: [""]
    }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "play", label: "SPYCRAFT.Tab.Play" },
        { id: "skills", label: "SPYCRAFT.Tab.Skills" },
        { id: "gear", label: "SPYCRAFT.Tab.Gear" },
        { id: "abilities", label: "SPYCRAFT.Tab.Abilities" },
        { id: "dossier", label: "SPYCRAFT.Tab.Dossier" }
      ],
      initial: "play"
    }
  };

  /** Build reminders name the pane that resolves them; several panes share a tab. */
  static PANE_TABS = { main: "play", classes: "abilities", feats: "abilities", training: "dossier", bio: "dossier" };

  /** This character's combatant in the fight it is taking part in. */
  _roundCombatant() {
    const combat = this.actor.participatingCombat;
    return combat?.started ? (combat.combatants.find(c => c.actor?.uuid === this.actor.uuid) ?? null) : null;
  }

  /** Half actions this round: two, and one more after a Press. */
  _roundActionLimit() {
    const combatant = this._roundCombatant(),
      fluid = combatant?.flags?.spycraft2?.fluid;
    return HALF_ACTIONS_PER_TURN + (fluid?.pressed && fluid.round === combatant.parent.round ? 1 : 0);
  }

  /** Half actions marked as spent in the round now being played; an older record counts as none. */
  _roundActionsSpent() {
    const combatant = this._roundCombatant();
    if (!combatant) return 0;
    const record = actionBudget(combatant.flags?.spycraft2?.actions, { round: combatant.parent.round });
    return Math.min(this._roundActionLimit(), Math.max(0, Number(record.used) || 0));
  }

  /** Pin a combat tool to the top of Play, or take it down. */
  togglePin(tool) {
    if (!this.isEditable || !tool) return;
    const pinned = new Set(this.actor.getFlag("spycraft2", "pinnedTools") ?? []);
    if (!pinned.delete(tool)) pinned.add(tool);
    return this.actor.setFlag("spycraft2", "pinnedTools", [...pinned]);
  }

  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const sys = actor.system;
    const cakewalk = cakewalkSelectionState(sys);
    context.cakewalk = cakewalk.enabled
      ? {
          label: loc`Cakewalk mission skills`,
          selected: cakewalk.selected.map(key => CONFIG.SPYCRAFT.skills[key]?.name ?? key).join(", ") || loc`None`,
          warning: cakewalk.needsReview ? loc`The saved selection is invalid; the GC must review it.` : "",
          action: cakewalk.recorded ? loc`Review mission skills` : loc`Choose mission skills`,
          canChoose: this.isEditable && ((!cakewalk.recorded && !cakewalk.needsReview) || game.user.isGM)
        }
      : null;
    // The status getter is not cached: it reads a setting, scans the combats and maps every limited-use ability.
    // Read it once per render.
    const uses = actor.limitedUseStatus ?? [];
    // A new or unfinished character opens ready for building: Career Level 0, or setup reminders still open before
    // its first session (a GC session start records sessionDiceReset; a claimed creation entry is the older record).
    const played =
      !!actor.flags?.spycraft2?.sessionDiceReset || !!actor.flags?.spycraft2?.startingDiceCreation?.claimed;
    this._editMode ??= this.isEditable && (sys.level === 0 || (!played && buildSetupGuide(sys.todo).count > 0));
    const cfg = CONFIG.SPYCRAFT;
    const rollData = actor.getRollData();
    Object.assign(context, {
      actor,
      // Prefix for element ids, so two open sheets never share one.
      appId: this.id,
      system: sys,
      shakenInitiativeReviews: actor.shakenInitiativeReviews,
      usagePeriodReview: game.spycraft2?.getUsagePeriodReview?.() ?? {},
      source: actor.system._source,
      config: cfg,
      editable: this.isEditable,
      tabs: this._prepareTabs("primary"),
      warnings: sys.warnings ?? [],
      setupGuide: buildSetupGuide(sys.todo),
      track: buildCreationTrack(sys.todo),
      pinnedTools: actor.getFlag("spycraft2", "pinnedTools") ?? [],
      pinMode: this.isEditable && this._pinMode,
      actionCosts: Object.fromEntries(
        Object.entries(ACTION_COSTS).map(([action, cost]) => [
          action,
          game.i18n.localize(`SPYCRAFT.ActionTime.${cost}`)
        ])
      ),
      open: this._open,
      editMode: this.isEditable && this._editMode,
      activeConditions: activeConditionLabels(sys),
      conditionStamps: conditionStamps(sys),
      flatFootedDefense: flatFootedDefense(sys),
      defenseBoost: defenseBoostState(
        sys,
        actor.participatingCombat,
        actor.participatingCombat?.combatants?.some(member => member.actor?.uuid === actor.uuid) ?? false
      ),
      nonLethalMeters: nonLethalMeters(sys),
      showAllTools: game.user.isGM && this._showAllTools,
      combatTools: combatToolVisibility(sys, COMBAT_STANCES, { showAll: game.user.isGM && this._showAllTools })
    });

    // Hover breakdowns: fixed parts first, then every origin/feat/class bonus the engine recorded.
    const src = sys.bonusSources ?? {};
    const misc = sys.misc ?? {};
    const tip = (parts, ...targets) => {
      const rows = parts.filter(([, v]) => v);
      for (const t of targets) for (const s of src[t] ?? []) rows.push([s.source, s.value]);
      return rows;
    };
    const miscLabel = game.i18n.localize("SPYCRAFT.Misc");
    const classLabel = game.i18n.localize("SPYCRAFT.Class.Label");
    const armorLabel = game.i18n.localize("SPYCRAFT.Armor");
    const vitBonus = (src.vitality ?? []).reduce((n, s) => n + s.value, 0);
    const conPart = sys.abilities.con.mod * sys.level;
    context.tips = {
      // Roll bonuses: every part, then a total that matches the button (module/sheets/bonus-tips.mjs).
      ...agentBonusTips(sys),
      defense: tip(
        [
          [game.i18n.localize("SPYCRAFT.Base"), 10],
          [classLabel, sys.defense.base],
          ["DEX", sys.defense.dexterity],
          [loc`Vulnerable: dodge bonuses lost`, -sys.defense.dodgeLost],
          [armorLabel, sys.defense.armor],
          [loc`Size`, sys.sizeModifier],
          [miscLabel, misc.defense]
        ],
        "defense"
      ),
      speed: tip(
        [
          [game.i18n.localize("SPYCRAFT.Base"), 30],
          [armorLabel, sys.armor?.speed],
          [miscLabel, misc.speed]
        ],
        "speed"
      ),
      vitality: tip(
        [
          [game.i18n.localize("SPYCRAFT.VitalityDice"), sys.vitalityBreakdown?.dice ?? 0],
          [`CON × ${sys.level}`, conPart],
          [loc`Minimum 1 per level`, sys.vitalityBreakdown?.minimumAdjustment],
          [miscLabel, misc.vitality]
        ],
        "vitality"
      ),
      wounds: tip(
        [
          ["CON", sys.abilities.con.value],
          [
            loc`Size`,
            sys.wounds.max -
              sys.abilities.con.value -
              (misc.wounds ?? 0) -
              (src.wounds ?? []).reduce((n, s) => n + s.value, 0)
          ],
          [miscLabel, misc.wounds]
        ],
        "wounds"
      ),
      actionDice: tip(
        [
          [
            game.i18n.localize("SPYCRAFT.Level"),
            sys.actionDice.max -
              (src["actionDice.count"] ?? []).reduce((n, s) => n + s.value, 0) -
              (misc.actionDice ?? 0)
          ],
          [miscLabel, misc.actionDice]
        ],
        "actionDice.count"
      )
    };

    // Abilities
    context.abilities = Object.entries(cfg.abilities).map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      abbr: game.i18n.localize(`SPYCRAFT.AbilityAbbr.${key}`),
      ...sys.abilities[key],
      tip: abilityTip(sys, key, game.i18n.localize(label))
    }));
    context.increaseLevels = (sys.abilityIncreaseLevels ?? cfg.abilityIncreaseLevels).map(l => ({
      level: l,
      key: `l${l}`,
      value: sys.abilityIncreases[`l${l}`],
      reached: sys.level >= l
    }));
    context.abilityOptions = Object.fromEntries(
      Object.entries(cfg.abilities).map(([k, v]) => [k, game.i18n.localize(v)])
    );

    context.saves = Object.entries(cfg.saves).map(([key, s]) => ({
      key,
      label: game.i18n.localize(s.label),
      ...sys.saves[key],
      tip: saveTip(sys, key, s.ability)
    }));

    // Items by type
    const items = actor.items.contents.filter(i => !isResourceLock(i)).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const byType = t => items.filter(i => i.type === t);
    context.talent = byType("origin").find(i => i.system.originType === "talent");
    context.specialty = byType("origin").find(i => i.system.originType === "specialty");
    context.originSelections = byType("origin").map(item => {
      const rule = cfg.tables.originChoices?.[originRuleName(item)] ?? {};
      const choices = item.system.originChoices ?? {};
      const fields = [];
      const focusRule = cfg.tables.originFocuses?.[originRuleName(item)];
      if (focusRule?.choiceSkill) {
        const skill = focusRule.choiceSkill;
        fields.push({
          key: "grantedFocus",
          label: loc`Granted ${cfg.skills[skill].name} focus`,
          value: choices.grantedFocus,
          text: skill === "profession",
          options:
            skill === "profession"
              ? null
              : Object.fromEntries((focusRule.domain ?? cfg.focuses[skill]).map(focus => [focus, focus]))
        });
      }
      if (rule.attributes) {
        fields.push({ key: "up", label: loc`+2 attribute`, value: choices.up, options: context.abilityOptions });
        fields.push({ key: "down", label: loc`−2 attribute`, value: choices.down, options: context.abilityOptions });
      }
      const skillOptions = Object.fromEntries(Object.values(cfg.skills).map(s => [s.key, s.name]));
      for (const [kind, number, label] of [
        [
          "classSkill",
          rule.classSkills === "scaling" ? 1 + Math.floor(sys.level / 4) : (rule.classSkills ?? 0),
          loc`Class skill`
        ],
        ["maxRank", rule.maxRankSkills === "scaling" ? 1 + Math.floor(sys.level / 4) : 0, loc`Maximum-rank skill`]
      ])
        for (let index = 0; index < number; index++)
          fields.push({
            key: `${kind}${index}`,
            label: `${label} ${index + 1}`,
            value: choices[`${kind}${index}`],
            options: skillOptions
          });
      if (rule.threatSkill)
        fields.push({
          key: "threatSkill",
          label: loc`Threat-range skill`,
          value: choices.threatSkill,
          options: skillOptions
        });
      if (rule.npcQualities) {
        const options = Object.fromEntries(
          Object.entries(cfg.tables.testSubjectQualities).map(([key, quality]) => [key, quality.label])
        );
        for (let index = 0; index < rule.npcQualities; index++) {
          fields.push({
            key: `npcQuality${index}`,
            label: loc`NPC quality ${index + 1} (GC approval)`,
            value: choices[`npcQuality${index}`],
            options
          });
          if (choices[`npcQuality${index}`] === "damageResistance")
            fields.push({
              key: `npcDetails${index}`,
              label: loc`Quality ${index + 1} resisted damage type`,
              value: resistanceType(choices[`npcDetails${index}`]),
              options: RESISTANCE_TYPES
            });
          else if (choices[`npcQuality${index}`] === "camouflaged")
            fields.push({
              key: `npcDetails${index}`,
              label: loc`Quality ${index + 1} camouflage terrain`,
              value: camouflageTerrain(choices[`npcDetails${index}`]),
              options: CAMOUFLAGE_TERRAINS
            });
          else if (["augmented", "naturalAttack"].includes(choices[`npcQuality${index}`])) {
            // The built-in item is one the agent carries: a weapon for a natural attack, any weapon or gear if augmented.
            const kinds = choices[`npcQuality${index}`] === "naturalAttack" ? ["weapon"] : ["weapon", "armor", "gear"];
            fields.push({
              key: `npcDetails${index}`,
              label: loc`Quality ${index + 1} built-in item`,
              value: choices[`npcDetails${index}`],
              options: Object.fromEntries(items.filter(i => kinds.includes(i.type)).map(i => [i.name, i.name]))
            });
          } else
            fields.push({
              key: `npcDetails${index}`,
              label: loc`Quality ${index + 1} details / chosen item`,
              value: choices[`npcDetails${index}`],
              text: true
            });
        }
      }
      return { id: item.id, name: item.name, fields, item };
    });
    // Origin text is the item's own rich text: its secrets are for the item's owners and its links resolve from it.
    for (const origin of context.originSelections) {
      origin.description = await enrich(origin.item.system.description, origin.item);
      // What the pick does and how its owner set it up, for the rail chip and for viewers who cannot edit it.
      origin.picks = chosenPicks(origin.fields);
      // The tooltip shows to anyone, so it leaves out the secret blocks an owner sees in the description.
      origin.tip = ruleTip({
        kind: game.i18n.localize(`SPYCRAFT.Origin.${origin.item.system.originType}`),
        summary: await enrich(origin.item.system.description, origin.item, { secrets: false }),
        picks: origin.picks
      });
      delete origin.item;
    }
    const originTip = item => context.originSelections.find(origin => origin.id === item?.id)?.tip ?? null;
    context.talentTip = originTip(context.talent);
    context.specialtyTip = originTip(context.specialty);

    // Classes & progression
    const classItems = byType("class");
    const classById = Object.fromEntries(classItems.map(c => [c.system.identifier || c.name, c]));
    context.finalAttackRound = uses.find(s => s.id === "finalAttackRound");
    context.dartingFinalAttack = uses.find(s => s.id === "dartingFinalAttack");
    context.canRecordVitality = this.actor.isOwner === true;
    context.progression = sys.progression.map((p, i) => {
      const ci = classById[p.classId];
      const fixed = i > 0 ? campaignVitalityDie(ci?.system.vitalityDie, sys.campaignEffects) : null;
      const counts = sys.progression.slice(0, i + 1).filter(x => x.classId === p.classId).length;
      return {
        index: i,
        level: i + 1,
        classId: p.classId,
        className: ci?.name ?? p.classId,
        classLevel: counts,
        vitalityDie: ci?.system.vitalityDie,
        vitality: fixed ?? p.vitality,
        needsVitalityReview: !!p.vitalityHistoryId && !p.vitality,
        fixedVitality: fixed !== null,
        fixedVitalityLabel: fixed !== null ? loc`Fragile: fixed class gain.` : "",
        first: i === 0,
        isLast: i === sys.progression.length - 1,
        skillPoints: sys.skillPoints?.[i]
      };
    });
    context.classes = classItems.map(ci => {
      const ident = ci.system.identifier || ci.name;
      const lvl = sys.classLevels?.[ident] ?? 0;
      const lists = Object.fromEntries((ci.system.choiceLists ?? []).map(L => [L.key, L]));
      return {
        specialistFields: (sys.weaponSpecialist?.fields ?? []).filter(field => field.itemId === ci.id),
        specialistModes: { ability: loc`Another ability`, proficiency: loc`Another possessed proficiency` },
        specialistProficiencies: Object.fromEntries(
          Object.entries(cfg.proficiencies)
            .filter(([key]) => sys.proficiencyTotals?.[key]?.proficient)
            .map(([key, value]) => [key, value.label])
        ),
        inheritedChoices: (sys.inheritedClassChoices ?? [])
          .filter(entry => entry.ownerId === ci.id)
          .map(entry => ({
            ...entry,
            options: Object.fromEntries((entry.menu?.options ?? []).map(option => [option.index, option.name])),
            skillOptions: Object.fromEntries((entry.skillOptions ?? []).map(key => [key, cfg.skills[key]?.name ?? key]))
          })),
        skillChoiceFields: classSkillSelections(ci, lvl).map(field => ({
          ...field,
          value: ci.system.skillChoices?.[field.key] ?? "",
          options: Object.fromEntries(
            Object.values(cfg.skills)
              .filter(
                skill =>
                  field.anySkill ||
                  ci.system.classSkills?.includes(skill.key) ||
                  sys.universalClassSkills?.includes(skill.key) ||
                  sys.skills?.[skill.key]?.classSkill
              )
              .map(skill => [skill.key, skill.name])
          )
        })),
        phdOptions: Object.fromEntries((ci.system.classSkills ?? []).map(key => [key, cfg.skills[key]?.name ?? key])),
        phdFields:
          ident === "scientist"
            ? [
                [2, "phdSkill"],
                [11, "phdSkill1"],
                [19, "phdSkill2"]
              ]
                .filter(([level]) => lvl >= level)
                .map(([level, key]) => ({ level, key, value: ci.system[key] }))
            : [],
        item: ci,
        levels: lvl,
        isVirtuoso: ident === "virtuoso",
        skillOptions: Object.fromEntries(Object.values(cfg.skills).map(s => [s.key, s.name])),
        abilities: (ci.system.abilities ?? [])
          .filter(a => a.level <= lvl)
          .map(a => ({
            ...a,
            text: renderTemplate(a.description, { ...rollData, classes: { ...rollData.classes } })
          })),
        choices: orderedClassChoices(ci)
          .map(({ slot, index: idx }) => ({
            idx,
            level: slot.level,
            list: lists[slot.list]?.name ?? slot.list,
            active:
              slot.level <= lvl &&
              !(
                ident === "soldier" &&
                slot.list === "weaponSpecialist" &&
                slot.level > 6 &&
                ci.system.weaponSpecialist?.[slot.level]?.mode === "proficiency"
              ),
            value: ci.system.choices?.[idx] ?? "",
            options: Object.fromEntries((lists[slot.list]?.options ?? []).map(o => [o.index, o.name])),
            description:
              lists[slot.list]?.options?.find(o => o.index === Number(ci.system.choices?.[idx]))?.description ?? ""
          }))
          .filter(c => c.active)
      };
    });
    context.xpNext = sys.xpNext;
    // Enough experience for the next Career Level: the rail offers to add it.
    context.levelUpReady = Number.isFinite(sys.xpNext) && Number(sys.xp) >= sys.xpNext && sys.level < 20;

    // Skills
    const lvl = Math.clamp(this._skillLevel ?? sys.level, 1, Math.max(1, sys.level));
    context.skillLevel = sys.level ? lvl : null;
    const entry = sys.progression[lvl - 1];
    const lvlClass = entry ? classById[entry.classId] : null;
    context.skillLevelInfo = sys.skillPoints?.[lvl - 1];
    context.canReviewSkillPurchasePolicy = game.user.isGM && sys.level > 0 && !sys.companionOf?.ownerUuid;
    context.skillPurchasePolicyLabel = loc`Review skill-cost history`;
    const costPolicy = context.skillLevelInfo?.skillPolicy;
    context.skillPurchasePolicyNeedsReview = costPolicy?.needsReview === true;
    context.skillPurchasePolicyHint = costPolicy?.needsReview
      ? loc`Review this level's purchase-time campaign rules before relying on its skill ranks.`
      : costPolicy?.allSkillsClass
        ? loc`Jack-of-All-Trades applied when these points were spent; historical class-skill costs are retained.`
        : costPolicy?.recorded && sys.campaignEffects?.allSkillsClass === 1
          ? loc`This level retains its recorded normal class-skill costs despite the current Jack-of-All-Trades quality.`
          : "";
    context.skillLevels = sys.progression.map((p, i) => ({ level: i + 1, active: i + 1 === lvl }));
    context.skills = Object.values(sys.skillTotals ?? {}).map(s => ({
      ...s,
      rollLabel: loc`Roll ${s.name}`,
      capLabel: s.cap === null ? loc`No cap` : s.cap,
      points: entry?.skills?.[s.key] ?? 0,
      historicalRanks: context.skillLevelInfo?.skills?.[s.key]?.ranks ?? s.ranks,
      purchaseMaxRanks: context.skillLevelInfo?.skills?.[s.key]?.maxRanks ?? s.maxRanks,
      classAtLevel: !!sys.skillPoints?.[lvl - 1]?.classSkills?.includes(s.key),
      abilityLabel: s.abilities.map(a => a.toUpperCase()).join("/"),
      totalsLabel: s.totals.map(t => `${t.total >= 0 ? "+" : ""}${t.total}`).join(" / "),
      bonusTip: tip([[miscLabel, s.misc]], `skills.${s.key}.misc`),
      threatTip: tip([], `skills.${s.key}.threat`),
      threatLabel: formatRange("threat", s.threat),
      capTip: tip([], `skills.${s.key}.cap`),
      totals: s.totals.map(t => ({
        ...t,
        rollLabel: loc`Roll ${s.name} (${t.ability.toUpperCase()})`,
        tip: skillTip(sys, s.key, [t.ability])
      })),
      // The Play tab's button shows every total at once.
      playTip: skillTip(
        sys,
        s.key,
        s.totals.map(t => t.ability)
      )
    }));

    // Feats
    context.feats = byType("feat")
      .map(f => {
        const status = sys.featStatus?.[f.id] ?? { ok: true, unmet: [] };
        const treeLabel = cfg.featTrees[f.system.tree] ?? f.system.tree;
        return {
          item: f,
          treeLabel,
          tipKind: treeLabel ? loc`${treeLabel} feat` : game.i18n.localize("TYPES.Item.feat"),
          status,
          actions: featActions(f, { qualified: status.ok, isGM: game.user.isGM }),
          prereqText: describePrereq(f.system.prerequisites)
        };
      })
      .sort((a, b) => a.treeLabel.localeCompare(b.treeLabel) || a.item.name.localeCompare(b.item.name));
    // Hover help shows to anyone who can open the sheet, so it is rendered with every secret block left out.
    await Promise.all(
      context.feats.map(async feat => {
        feat.tip = ruleTip({
          kind: feat.tipKind,
          summary: await enrich(feat.item.system.description, feat.item, { secrets: false })
        });
      })
    );
    context.featTrees = Object.entries(sys.feats?.trees ?? {})
      .filter(([, v]) => v.slots || v.spent || v.owned)
      .map(([k, v]) => ({ key: k, label: cfg.featTrees[k], ...v }));
    context.campaignFeatReplacements = (sys.feats?.campaignReplacements ?? []).map(
      r => loc`Campaign feat replacement: ${cfg.featTrees[r.source]} → ${cfg.featTrees[r.target]}; ${r.count} used.`
    );
    context.coreAbilities = sys.coreAbilities ?? [];
    context.criticalInjuryReviews = criticalInjuryReviews(this.actor);
    context.startedCharacterCombat = this.actor.participatingCombat?.started === true;
    context.mobileOffense = uses.find(s => s.id === "mobileOffense");
    context.contempt = uses.find(s => s.id === "contempt");
    context.contemptRound = uses.find(s => s.id === "contemptRound");
    context.combatInstincts = uses.find(s => s.id === "combatInstincts");
    context.cleaveBasics = uses.find(s => s.id === "cleaveBasics");
    context.snapShot = uses.find(s => s.id === "snapShot");
    context.opportunist = uses.find(s => s.id === "opportunist");
    context.fortunate = uses.find(s => s.id === "fortunate");
    context.blackCat = uses.find(s => s.id === "blackCat");
    context.berserker = uses.find(s => s.id === "berserkerRage");
    context.gunslinger = uses.find(s => s.id === "gunslingersEye");
    context.fireTeamSupremacy = uses.find(s => s.id === "fireTeamSupremacy");
    context.companions = this.actor.type === "agent" ? companionsContext(this.actor) : null;
    context.flawlessIdentity = this.actor.system.activeFeatNames?.includes("Flawless Identity") === true;
    context.twoWeaponFinalAttack = uses.find(s => s.id === "twoWeaponFinalAttack");
    context.jinxUse = uses.find(s => s.id === "jinx");
    context.markUse = uses.find(s => s.id === "mark");
    context.silverVictories = silverVictoryRows(this.actor);
    context.attributeDamageRows = Object.entries(sys.attributeDamageState?.byAbility ?? {})
      .filter(([_k, v]) => v.total > 0)
      .map(([key, v]) => ({ key, label: game.i18n.localize(cfg.abilities[key]), ...v }));
    context.attributeDamageHistory = !!sys.attributeDamageState?.events?.length;
    context.attributeMissionRecovered = (sys.attributeDamage?.recoveries ?? []).some(
      r => r.kind === "missionEnd" && r.missionId === (this.actor.usagePeriods?.mission ?? "initial")
    );
    context.markObservations = markRows(this.actor.flags.spycraft2?.markObservations, cfg);
    context.featFreeActions = uses.filter(spec => ["featFreeAction", "featFreeActionRound"].includes(spec.workflow));
    context.limitedUses = uses
      .filter(spec => !spec.hidden || spec.counterReview)
      .map(spec => ({ ...spec, control: classAbilityControl(spec.workflow) }));
    context.combatReviewNeeded = !!(
      context.usagePeriodReview.needsReview ||
      actor.flags.spycraft2?.missionXPReview?.needsReview ||
      actor.flags.spycraft2?.actionDieAwardReview?.needsReview ||
      sys.actionDiceSettlementReview?.needsReview ||
      Object.values(actor.flags.spycraft2?.triggeredAttacks ?? {}).some(r => r?.state === "reserved")
    );
    const brightStatus = brightIdeaPoolStatus(sys, this.actor.usagePeriods);
    context.brightIdeaLegacy = brightStatus.needsReview;
    context.brightIdeaLegacyMalformed = brightStatus.legacyUsed === null;
    context.isGM = game.user.isGM;
    context.favoredGearSessionControl =
      game.user.isGM && this.actor.items.some(i => i.system?.possessionSource === "favoredGear");
    context.favoredGearSessionLabel = loc`Settle favored items for session`;
    context.canSettleFavoredGear = !Object.values(this.actor.flags?.spycraft2?.favoredGearSessions ?? {}).some(
      r =>
        r?.session === String(this.actor.usagePeriods?.session ?? "initial") &&
        r.state === "complete" &&
        r.actorUuid === this.actor.uuid
    );
    context.favoredGearReviewLabel = loc`Review favored item history`;
    const favoredReceipt = Object.values(this.actor.flags?.spycraft2?.favoredGearSessions ?? {}).find(
      r => r?.session === String(this.actor.usagePeriods?.session ?? "initial") && r.actorUuid === this.actor.uuid
    );
    const favoredPriorLevel =
      favoredReceipt?.lastSelectionLevel ??
      favoredReceipt?.sessionStartLevel ??
      favoredReceipt?.level ??
      this.actor.flags?.spycraft2?.sessionDiceReset?.level;
    context.canRecordFavoredLevelChoices =
      context.favoredGearSessionControl && Number.isSafeInteger(favoredPriorLevel) && favoredPriorLevel < sys.level;
    context.favoredGearLevelLabel = loc`Record new-level favored items`;
    if (context.canRecordFavoredLevelChoices && !favoredReceipt) context.canSettleFavoredGear = false;
    context.hazards = hazardsView(this.actor);
    context.professor = sys.coreClassIds?.includes("scientist");
    context.trailblazer = sys.coreClassIds?.includes("scout");

    // Training
    context.proficiencies = Object.entries(cfg.proficiencies).map(([k, p]) => ({
      key: k,
      label: p.label,
      ...(sys.proficiencyTotals ?? sys.proficiencies)[k],
      hint: sys.proficiencyPicks?.hints?.[k]
    }));
    context.focusGroups = ["cultures", "drive", "science"].map(skill => ({
      skill,
      label: cfg.skills[skill].name,
      picks: sys.focusPicks?.[skill],
      options: cfg.focuses[skill].map(name => ({
        name,
        checked: (sys.focusTotals?.[skill] ?? sys.focuses[skill]).includes(name),
        granted: sys.forcedFocuses?.[skill]?.includes(name)
      }))
    }));
    context.professionText = sys.focuses.profession.join("\n");
    context.forteSkills = {
      cultures: loc`Cultures`,
      drive: loc`Drive`,
      profession: loc`Profession`,
      science: loc`Science`
    };
    context.crossroadsTitles = Object.fromEntries(
      Object.entries(cfg.tables.crossroads).map(([key, value]) => [key, value.label])
    );
    if (sys.crossroadsTitle && !Object.hasOwn(context.crossroadsTitles, sys.crossroadsTitle))
      context.crossroadsTitles = {
        ...context.crossroadsTitles,
        [sys.crossroadsTitle]: loc`${sys.crossroadsTitle} — review saved title`
      };
    context.subplotKindLabel = loc`Subplot type`;
    context.crossroadsXPReviewLabel = loc`Review mission title XP`;
    context.canManageSceneDisposition = game.user.isGM && usesSceneDisposition(this.actor.type, sys);
    context.sceneDispositionLabel = loc`Scene disposition effects`;
    context.crossroadsSessionReviewLabel = loc`Review session title dice`;
    context.completeCrossroadsLabel = loc`Complete Crossroads and award title`;
    context.canCompleteCrossroads = sys.subplots.some(
      row => !row.complete && Object.hasOwn(cfg.tables.crossroads, row.kind)
    );
    context.subplotNameLabel = loc`Subplot name`;
    context.subplotNotesLabel = loc`Subplot notes`;
    context.subplotCompleteLabel = loc`Completed Subplot`;
    context.routineSubplotHint =
      sys.campaignEffects?.forbidCrossroads === true
        ? loc`Routine: choose standard Subplots. Completed Crossroads history and existing titles remain recorded.`
        : "";
    context.subplotRows = sys.subplots.map(row => ({
      ...row,
      kindLabel: Object.hasOwn(cfg.tables.crossroads, row.kind)
        ? loc`Crossroads: ${cfg.tables.crossroads[row.kind].label}`
        : row.kind === "standard"
          ? loc`Standard Subplot`
          : loc`Review Subplot type`,
      kinds: [
        { value: "", label: loc`Choose actual Subplot type` },
        { value: "standard", label: loc`Standard Subplot` },
        ...(row.kind && row.kind !== "standard" && !Object.hasOwn(cfg.tables.crossroads, row.kind)
          ? [{ value: row.kind, label: loc`${row.kind} — review saved type` }]
          : []),
        ...Object.entries(cfg.tables.crossroads).map(([value, title]) => ({
          value,
          label: loc`Crossroads: ${title.label}`
        }))
      ].map(option => ({
        ...option,
        selected: option.value === (row.kind ?? ""),
        disabled:
          sys.campaignEffects?.forbidCrossroads === true &&
          !row.complete &&
          option.value !== "" &&
          option.value !== "standard" &&
          option.value !== row.kind
      }))
    }));
    context.fortesText = sys.focuses.fortes.join("\n");
    context.hasContactFeatUpgrades =
      !!sys.contactFeatBindings?.length || sys.contacts.some(c => c.networkingFeat || c.networkingMilestone);
    context.contactFeatOptions = Object.fromEntries([
      ["", loc`No contact feat`],
      ...(sys.contactFeatBindings ?? []).map(b => [b.name, b.name]),
      ...sys.contacts
        .filter(c => c.networkingFeat && !sys.contactFeatBindings?.some(b => b.name === c.networkingFeat))
        .map(c => [c.networkingFeat, c.networkingFeat + " — source unavailable"])
    ]);
    const contactMilestones = new Set(
      Array.from({ length: Math.floor((sys.skillTotals?.networking?.purchasedRanks ?? 0) / 4) }, (_, i) => (i + 1) * 4)
    );
    for (const c of sys.contacts) if (c.networkingMilestone) contactMilestones.add(c.networkingMilestone);
    context.contactMilestones = Object.fromEntries([
      ["0", loc`No Networking feat upgrade`],
      ...[...contactMilestones].sort((a, b) => a - b).map(n => [n, "Networking " + n + " purchased ranks"])
    ]);
    context.contactGrades = Object.fromEntries(cfg.tables.contacts.map(c => [c.rank, `${c.rank} — ${c.grade}`]));

    // Gear
    context.weapons = byType("weapon").map(w => ({
      item: w,
      canResistDisarm:
        !sys.disarmWeapons?.blockedReason && sys.disarmWeapons?.weapons?.some(source => source.id === w.id) === true,
      ammoConfiguration: ammunitionConfiguration(w.system),
      canPlanAmmunition: compatibleAmmunition(w.system, CONFIG.SPYCRAFT.tables?.ammunitionCatalog ?? []).length > 0,
      attack: actor.weaponAttack(w),
      shots: weaponShots(w),
      caliber: cfg.calibers[w.system.caliber]
    }));
    for (const row of context.weapons) {
      row.untrained = row.attack?.trained === false;
      row.attackTip = weaponAttackTip(row.attack);
      row.facts = weaponFacts(row.attack);
      row.threatLabel = formatRange("threat", row.attack?.threat);
      row.errorLabel = formatRange("error", row.attack?.error);
    }
    // Play: the skills the character is trained in, one click from a roll.
    context.miscLabels = miscModifierLabels(cfg);
    context.playSkills = context.skills.filter(skill => skill.ranks > 0);
    context.activeEffects = activeEffectLines(sys);
    context.ownTurn =
      actor.participatingCombat?.started === true && actor.participatingCombat.combatant?.actor?.uuid === actor.uuid;
    context.playLabels = playLabels();
    // One pip per action die the agent could hold; filled pips are dice in hand.
    const diceHeld = Math.max(0, Number(sys.actionDice?.value) || 0);
    const diceShown = Math.min(12, Math.max(diceHeld, Number(sys.actionDice?.max) || 0));
    context.actionDicePips = Array.from({ length: diceShown }, (_, index) => index < diceHeld);
    const halfSpent = this._roundActionsSpent();
    context.roundActions = Array.from({ length: this._roundActionLimit() }, (_, index) => ({
      index,
      spent: index < halfSpent
    }));
    context.dying = woundState(Number(sys.wounds?.value), sys.deathThreshold) === "dying";
    context.armor = byType("armor").map(a => ({ item: a, caliber: cfg.calibers[a.system.caliber] }));
    context.safeHouseSource = safeHouseSource(sys);
    context.safeHouses = safeHouseRows(sys, cfg);
    context.careerAgentReward = {
      active: sys.activeFeatNames?.includes("Career Agent"),
      record: sys.careerAgentRewards?.[careerAgentMissionKey(sys)],
      review: getCareerAgentReview(this.actor)
    };
    context.wellFundedActive = sys.activeFeatNames?.includes("Well-Funded");
    context.wellFundedCash = wellFundedCashHistory(sys);
    context.toolShedSource = toolShedSource(sys);
    context.gear = byType("gear").map(g => ({
      item: g,
      caliber: cfg.calibers[g.system.caliber],
      toolShed: toolShedKitState(sys, g)
    }));
    context.vehicles = byType("vehicle").map(v => ({
      item: v,
      caliber: cfg.calibers[v.system.caliber],
      classLabel: vehicleClass(v.system.vehicleClass)?.label ?? ""
    }));
    context.gearPicks = Object.entries(sys.gearPicks ?? {}).map(([k, v]) => ({
      key: k,
      label: cfg.gearPicks[k],
      ...v
    }));
    context.pickOptions = Object.fromEntries([["", "—"], ...Object.entries(cfg.gearPicks).map(([k]) => [k, k])]);

    context.enrichedBiography = await enrich(sys.biography, actor, { rollData });
    return context;
  }

  /** Remember which header panels the player has opened or closed. */
  _onRender(context, options) {
    super._onRender(context, options);
    enhanceAgentSheet(this.element, context, this);
    enableHotbarDrag(this.element, this.actor);
    installResolutionGuide(this.element.querySelector(".play-dashboard"), "play");
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */
  /*  Form handling                                */
  /* -------------------------------------------- */

  /** Merge array/embedded edits (progression, contacts, subplots, class choices) before update. */
  _prepareSubmitData(event, form, formData, updateData) {
    const flat = formData.object;
    const sys = this.actor.system;
    const progression = sys.progression.map(p => ({ ...p, skills: { ...p.skills } }));
    const rows = {
      contacts: sys.contacts.map(r => ({ ...r })),
      subplots: sys.subplots.map(r => ({ ...r })),
      skillFortes: (sys.skillFortes ?? []).map(r => ({ ...r }))
    };
    const changed = new Set();
    const careerRequests = [];
    const itemUpdates = {};
    const skillIdx = Math.clamp(this._skillLevel ?? sys.level, 1, Math.max(1, sys.level)) - 1;

    for (const [k, v] of Object.entries(flat)) {
      let m;
      if ((m = k.match(/^progression\.(\d+)\.vitality$/))) {
        // Raw vitality is recorded through its source/audit control, not a plain form edit.
      } else if ((m = k.match(/^progression\.(\d+)\.intelligenceModifier$/))) {
        const value = v === "" || v == null ? null : Number(v);
        careerRequests.push({ index: Number(m[1]), field: "intelligenceModifier", value });
        if (progression[m[1]]) progression[m[1]].intelligenceModifier = value;
        changed.add("progression");
      } else if ((m = k.match(/^system\.skills\.(\w+)\.classSkill$/))) {
        if (v && !sys.skills?.[m[1]]?.classSkill) flat[`system.skills.${m[1]}.classSkillAt`] = skillIdx + 1;
        continue;
      } else if ((m = k.match(/^skillpts\.(\w+)$/))) {
        if (progression[skillIdx]) {
          const n = v === "" || v == null ? 0 : Number(v);
          careerRequests.push({ index: skillIdx, field: "skill", key: m[1], value: n });
          if (n) progression[skillIdx].skills[m[1]] = n;
          else delete progression[skillIdx].skills[m[1]];
        }
        changed.add("progression");
      } else if ((m = k.match(/^inheritedChoice\.(\w+)\.(\w+)\.(option|skill)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.inheritedChoices.${m[2]}.${m[3]}`] =
          m[3] === "option" ? (v === "" || v == null ? null : Number(v)) : v;
      } else if ((m = k.match(/^specialistChoice\.(\w+)\.(\d+)\.(mode|proficiency)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.weaponSpecialist.${m[2]}.${m[3]}`] = v;
      } else if ((m = k.match(/^classSkillChoice\.(\w+)\.(\w+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.skillChoices.${m[2]}`] = v;
      } else if ((m = k.match(/^classField\.(\w+)\.(\w+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.${m[2]}`] = v;
      } else if ((m = k.match(/^originChoice\.(\w+)\.(\w+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.originChoices.${m[2]}`] = v;
      } else if ((m = k.match(/^choice\.(\w+)\.(\d+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.choices.${m[2]}`] =
          v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      } else if ((m = k.match(/^(contacts|subplots|skillFortes)\.(\d+)\.(\w+)$/))) {
        if (rows[m[1]][m[2]]) rows[m[1]][m[2]][m[3]] = v;
        changed.add(m[1]);
      } else if (k === "system.startingIntelligenceModifier") {
        flat[k] = v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
        continue;
      } else if (k === "professionText" || k === "fortesText") {
        flat[`system.focuses.${k === "professionText" ? "profession" : "fortes"}`] = String(v)
          .split(/\n+/)
          .map(s => s.trim())
          .filter(Boolean);
      } else continue;
      delete flat[k];
    }
    this._pendingCareerForm = changed.has("progression") ? careerFormPlan(sys.progression, careerRequests) : null;
    if (changed.has("progression")) flat["system.progression"] = progression;
    for (const key of ["contacts", "subplots", "skillFortes"]) if (changed.has(key)) flat[`system.${key}`] = rows[key];
    this._pendingItemUpdates = itemUpdates;
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  async _processSubmitData(event, form, submitData, options) {
    const itemUpdates = Object.entries(this._pendingItemUpdates ?? {}).map(([_id, u]) => ({ _id, ...u }));
    this._pendingItemUpdates = null;
    const careerPlan = this._pendingCareerForm;
    this._pendingCareerForm = null;
    if (Object.hasOwn(submitData, "system.progression") && !careerPlan)
      throw new Error(loc`Use the career form controls to edit progression.`);
    // Submit data arrives nested (system.progression), not as a flat key; clear both shapes, so an unedited career
    // never writes back the copy captured when the form was drawn.
    if (careerPlan && !careerPlan.edits.length) {
      delete submitData["system.progression"];
      foundry.utils.deleteProperty(submitData, "system.progression");
    }
    const resources = [
      "system.actionDice.value",
      "system.vitality.value",
      "system.wounds.value",
      "system.reputation",
      "system.netWorth",
      "system.xp"
    ];
    const edited = event?.target?.name;
    // A full auto-submit includes stale resource inputs. Only an explicitly edited resource may overwrite its value.
    for (const path of resources)
      if (path !== edited) {
        delete submitData[path];
        const keys = path.split(".");
        let parent = submitData;
        for (const key of keys.slice(0, -1)) parent = parent?.[key];
        if (parent) delete parent[keys.at(-1)];
      }
    if (this.actor.system?.focusPicks?.generic.reservedAvailable) {
      const system = foundry.utils.mergeObject(
        this.actor.system.toObject(),
        foundry.utils.expandObject(submitData).system ?? {},
        { inplace: false }
      );
      system.usagePeriods = this.actor.usagePeriods;
      Object.assign(system, this.actor.attributeRuleContext);
      computeAgent(
        system,
        this.actor.items.map(i => ({ id: i.id, name: i.name, type: i.type, system: i.system })),
        CONFIG.SPYCRAFT,
        { campaignEffects: currentCampaignRules().effects }
      );
      if (
        system.focusPicks.generic.unscopedRemaining <
        Math.min(0, this.actor.system.focusPicks.generic.unscopedRemaining)
      ) {
        this.render();
        return refuseStep(loc`Use each temporary Depth of Study source to spend its reserved focus/forte picks.`);
      }
    }
    const save = async () => {
      if (careerPlan?.edits.length) {
        if (this.actor.isOwner !== true) throw new Error(loc`You must own the character before editing its career.`);
        mergeCareerForm(this.actor.system.progression, careerPlan);
      }
      if (itemUpdates.length) await this.actor.updateEmbeddedDocuments("Item", itemUpdates);
      if (careerPlan?.edits.length)
        submitData["system.progression"] = mergeCareerForm(this.actor.system.progression, careerPlan);
      return super._processSubmitData(event, form, submitData, options);
    };
    return resources.includes(edited) || careerPlan?.edits.length ? queueResources([this.actor], save) : save();
  }

  /** Dropping a class adds a level; origins replace the existing talent/specialty. */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;
    if (item.parent === this.actor) return super._onDropItem(event, item);
    if (item.type === "class") return this.actor.addClassLevel(item);
    if (item.type === "feat") {
      if (
        !item.system.repeatable &&
        this.actor.items.some(i => i.type === "feat" && i.name.trim().toLowerCase() === item.name.trim().toLowerCase())
      ) {
        return refuseStep(loc`${item.name} may only be selected once.`);
      }
      const data = item.toObject?.() ?? foundry.utils.deepClone(item);
      delete data._id;
      data.system.acquiredAtLevel = Math.max(1, this.actor.system.level ?? 1);
      return this.actor.createEmbeddedDocuments("Item", [data]);
    }
    if (item.type === "origin") {
      const old = this.actor.items.filter(i => i.type === "origin" && i.system.originType === item.system.originType);
      if (old.length)
        await this.actor.deleteEmbeddedDocuments(
          "Item",
          old.map(i => i.id)
        );
    }
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */
  /*  Actions                                      */
  /* -------------------------------------------- */

  _item(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
  }

  static #onRollAbility(event, target) {
    return this.actor.rollAbility(target.dataset.ability);
  }
  static #onRollSave(event, target) {
    return this.actor.rollSave(target.dataset.save, { askContext: !skipDialog(event) });
  }
  static #onRollSkill(event, target) {
    return this.actor.rollSkill(target.dataset.skill, target.dataset.ability || null, {
      ...(skipDialog(event) ? { quick: true } : {})
    });
  }
  static #onRollAttack(event, target) {
    const item = this._item(target);
    return this.actor.rollAttack(
      item,
      quickAttack(event, this.actor) ? quickAttackOptions(this.actor, item) : { askContext: true }
    );
  }
  static #onRollDamage(event, target) {
    return this.actor.rollDamage(this._item(target));
  }
  static #onRollInitiative() {
    return this.actor.rollInitiative({ createCombatants: true });
  }
  static #onRollVitality(event, target) {
    return this.actor.rollVitality(Number(target.dataset.index));
  }
  /** Jump from a to-do entry to the tab where it gets resolved. */
  static async #onTodo(event, target) {
    const { tab, skillLevel } = target.dataset;
    if (skillLevel) this._skillLevel = Number(skillLevel);
    this.changeTab(SpycraftAgentSheet.PANE_TABS[tab] ?? tab, "primary");
    this._editMode = this.isEditable;
    this._open.todo = false;
    if (tab === "main") this._open.origins = true;
    await this.render();
    focusSetupTask(this.element, target.dataset);
  }
  static async #onSetupTask(event, target) {
    if (!this.isEditable) return;
    await SpycraftAgentSheet.#onTodo.call(this, event, target);
    if (target.dataset.type) return SpycraftAgentSheet.#onBrowse.call(this, event, target);
  }
  static #onSpendActionDie() {
    return this.actor.rollActionDie();
  }
  static #onAddLevel() {
    return new SpycraftBrowser({ actor: this.actor, itemType: "class" }).render(true);
  }
  /** Another level in a class the character already has, without opening the class browser. */
  static #onAddLevelInClass(event, target) {
    const cls = this._item(target);
    return cls?.type === "class" ? this.actor.addClassLevel(cls) : null;
  }
  static async #onRemoveLevel() {
    const ok = await systemDialog.confirm({
      window: { title: game.i18n.localize("SPYCRAFT.Class.RemoveLevel") },
      content: `<p>${game.i18n.localize("SPYCRAFT.Class.RemoveLevelConfirm")}</p>`
    });
    if (ok) return this.actor.removeLastLevel();
  }
  static #onBrowse(event, target) {
    return new SpycraftBrowser({
      actor: this.actor,
      itemType: target.dataset.type,
      originType: target.dataset.originType
    }).render(true);
  }
  static #onItemEdit(event, target) {
    return this._item(target)?.sheet.render(true);
  }
  static async #onItemDelete(event, target) {
    return this._item(target)?.deleteDialog();
  }
  static #onItemChat(event, target) {
    return this._item(target)?.toChat();
  }
  static #onItemEquip(event, target) {
    const item = this._item(target);
    if (!item) return;
    if (item.type === "armor" && !item.system.equipped) {
      // Toggle all suits in one embedded-document update, so never count two.
      return this.actor.updateEmbeddedDocuments("Item", [
        ...this.actor.items
          .filter(
            i =>
              i.type === "armor" &&
              i.system.equipped &&
              (armorSlot(i) === armorSlot(item) ||
                (item.system.sealed && armorSlot(i) === "helmet") ||
                (armorSlot(item) === "helmet" && i.system.sealed))
          )
          .map(i => ({ _id: i.id, "system.equipped": false })),
        { _id: item.id, "system.equipped": true }
      ]);
    }
    return item.update({ "system.equipped": !item.system.equipped });
  }
  static #onCreateItem(event, target) {
    const type = target.dataset.type;
    return this.actor.createEmbeddedDocuments("Item", [
      { name: game.i18n.format("DOCUMENT.New", { type: game.i18n.localize(`TYPES.Item.${type}`) }), type }
    ]);
  }
  static #onToggleFocus(event, target) {
    const { skill, value } = target.dataset;
    const aliases = CONFIG.SPYCRAFT.tables.focusAliases ?? {};
    const list = new Set(this.actor.system.focuses[skill].map(value => aliases[value] ?? value));
    if (list.has(value)) list.delete(value);
    else {
      const picks = this.actor.system.focusPicks;
      if (picks.generic.reservedAvailable && picks[skill].remaining <= 0 && picks.generic.unscopedRemaining <= 0) {
        this.render();
        return refuse(loc`Use the temporary Depth of Study control on Training to spend its source-scoped picks.`);
      }
      list.add(value);
    }
    return this.actor.update({ [`system.focuses.${skill}`]: [...list] });
  }
  static async #onAddRow(event, target) {
    const key = target.dataset.list;
    // Leaving a field to press this button starts a save; build the new list on its result, not on the old rows.
    await this.whenSaved();
    const row =
      key === "contacts"
        ? { name: "", rank: 1, notes: "" }
        : key === "skillFortes"
          ? { skill: "drive", focus: "", forte: "" }
          : { name: "", notes: "", complete: false, kind: "standard" };
    return this.actor.update({ [`system.${key}`]: [...(this.actor.system[key] ?? []).map(r => ({ ...r })), row] });
  }
  static async #onRemoveRow(event, target) {
    const key = target.dataset.list;
    await this.whenSaved();
    const rows = this.actor.system[key].map(r => ({ ...r }));
    rows.splice(Number(target.dataset.index), 1);
    return this.actor.update({ [`system.${key}`]: rows });
  }
  static #onSkillLevel(event, target) {
    this._skillLevel = Number(target.dataset.level);
    return this.render({ parts: ["skills"] });
  }
  static #onSyncGrants() {
    return this.actor.syncGrantedFeats();
  }
}

/** Readable names for the manual modifier fields, which are stored under short keys. */
function miscModifierLabels(cfg) {
  const named = key => game.i18n.localize(key);
  const gear = letter => loc`Gear picks: ${cfg.gearPicks?.[letter] ?? letter}`;
  return {
    bab: named("SPYCRAFT.BAB"),
    fort: loc`Fortitude save`,
    ref: loc`Reflex save`,
    will: loc`Will save`,
    defense: named("SPYCRAFT.Defense"),
    initiative: named("SPYCRAFT.Initiative"),
    wealth: loc`Wealth`,
    vitality: named("SPYCRAFT.Vitality"),
    wounds: named("SPYCRAFT.Wounds"),
    speed: named("SPYCRAFT.Speed"),
    actionDice: named("SPYCRAFT.ActionDice.Label"),
    knowledge: named("SPYCRAFT.Knowledge"),
    request: named("SPYCRAFT.Request"),
    gearCheck: named("SPYCRAFT.GearCheck"),
    gearR: gear("R"),
    gearT: gear("T"),
    gearV: gear("V"),
    gearS: gear("S"),
    gearG: gear("G"),
    gearW: gear("W"),
    gearE: gear("E")
  };
}

/** A standard NPC's Damage save track state, as a word for the sheet. */
const damageStateLabel = state =>
  ({ active: loc`Up`, unconscious: loc`Unconscious`, dead: loc`Dead`, destroyed: loc`Destroyed` })[state] ??
  String(state ?? "");

/* -------------------------------------------------------------------------- */
/*  NPC sheet (simple stat block)                                             */
/* -------------------------------------------------------------------------- */

/** An NPC with no graded profile, package or items has nothing to play yet. */
export function npcNeedsSetup(actor) {
  return !actor.system?.npcProfile?.enabled && !actor.flags?.spycraft2?.npcTemplate && !(actor.items?.size > 0);
}

export class SpycraftNpcSheet extends KeepPlace(HandlebarsApplicationMixin(SaveFeedback(ActorSheetV2))) {
  /** A local view preference. Null until first render, when an NPC with nothing built yet opens in setup. */
  _editMode = null;

  /** Open where this user last left a npc sheet, or against the left edge, clear of the map's centre and the chat. */
  _initializeApplicationOptions(options) {
    return placeSheet(super._initializeApplicationOptions(options), options, "npc");
  }

  /** Remember where the sheet was, so the next one opens there. */
  _onClose(options) {
    super._onClose(options);
    rememberSheetPlacement("npc", this.position);
  }

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "npc"],
    position: { width: 480, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      // Players without Foundry's file browser can still change the picture (module/apps/portrait-picker.mjs).
      editImage: editPortrait,
      // Buttons that call the Actor method of the same name.
      ...actorMethods(
        "manageTakedown",
        "applyShaken",
        "reviewShakenApplication",
        "applyBaffled",
        "reviewBaffledApplication",
        "manageCheapShots"
      ),
      // Buttons that hand the actor to a workflow.
      ...actorWorkflows({
        npcDamageSave: npcDamageSaveWithUndo,
        recordUncontrolledFall,
        manageDisposition,
        npcPackages: manageNpcPackages,
        restAndRecover,
        rollDying,
        exposeToContagion,
        exposeToFire,
        burningRound,
        extinguishFire: extinguish,
        sufferTypedDamage,
        survivalSave,
        exposureFailedSave,
        endTypedExposure
      }),
      toggleEditMode() {
        if (!this.isEditable) return;
        this._editMode = !this._editMode;
        return this.render();
      },
      editShakenSource(event, target) {
        return this.actor.editShakenSource(target.dataset.sourceUuid);
      },
      reviewShakenInitiative(event, target) {
        return this.actor.reviewShakenInitiative(target.dataset.combatId, target.dataset.combatantId);
      },
      setNpcSkillCondition(event, target) {
        return this.actor.setReviewedCondition(target.dataset.condition);
      },
      rollNpcSkill(event, target) {
        // A skill named on the sheet rolls at once with the usual defaults; "Skill check" opens the full dialog.
        const key = target?.dataset?.skill;
        return rollNpcSkill(this.actor, key ? { key, ability: "", modifier: 0, error: 1 } : null);
      },
      callQualitySave(event, target) {
        return callQualitySave(this.actor, target.dataset.id);
      },
      async resetDamageTrack() {
        await resetDamageTrack(this.actor);
        this.render();
      },
      async endPromotion() {
        await this.actor.update({ "system.promotion": null });
      },
      npcPackageBands() {
        return manageNpcPackages(this.actor, { editBands: true });
      },
      npcEnable: SpycraftNpcSheet.#onEnable,
      npcAddSkill: SpycraftNpcSheet.#onAddSkill,
      npcAddQuality: SpycraftNpcSheet.#onAddQuality,
      npcAddPick: SpycraftNpcSheet.#onAddPick,
      npcRemoveRow: SpycraftNpcSheet.#onRemoveRow,
      rollAbility: SpycraftNpcSheet.#onRollAbility,
      rollSave: SpycraftNpcSheet.#onRollSave,
      reloadWeapon: costsAction("half", function (event, target) {
        return reloadWeapon(this._item(target));
      }),
      resupplyWeapon(event, target) {
        return resupplyWeapon(this._item(target));
      },
      rollContagionSave(event, target) {
        return rollContagionSave(this.actor, target.dataset.id);
      },
      cureHazard(event, target) {
        return cureHazard(this.actor, target.dataset.id);
      },
      fightFire(event, target) {
        return fightFire(this.actor, target.dataset.method);
      },
      rollFireSave(event, target) {
        return rollFireSave(this.actor, target.dataset.kind);
      },
      acidStep(event, target) {
        return acidStep(this.actor, target.dataset.step);
      },
      endSurvivalHazard(event, target) {
        return endSurvivalHazard(this.actor, target.dataset.kind);
      },
      rollAttack: costsAction(attackActionCost, SpycraftNpcSheet.#onRollAttack),
      rollDamage: SpycraftNpcSheet.#onRollDamage,
      itemEdit: SpycraftNpcSheet.#onItemEdit,
      itemDelete: SpycraftNpcSheet.#onItemDelete
    }
  };

  static PARTS = {
    main: {
      template: `${TPL}/npc-sheet.hbs`,
      templates: [
        `${TPL}/parts/hazards.hbs`,
        `${TPL}/parts/weapon-row.hbs`,
        `${TPL}/npc-graded-play.hbs`,
        `${TPL}/npc-builder.hbs`,
        "systems/spycraft2/templates/parts/editor.hbs"
      ],
      scrollable: [""]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.actor.system;
    this._editMode ??= npcNeedsSetup(this.actor);
    Object.assign(context, {
      actor: this.actor,
      // Prefix for element ids: a token's copy of an actor shares the actor's id, but not the sheet's.
      appId: this.id,
      system: sys,
      editMode: this.isEditable && this._editMode,
      shakenInitiativeReviews: this.actor.shakenInitiativeReviews,
      isGM: game.user.isGM,
      config: CONFIG.SPYCRAFT,
      editable: this.isEditable,
      abilities: Object.entries(CONFIG.SPYCRAFT.abilities).map(([key, label]) => ({
        key,
        label: game.i18n.localize(label),
        abbr: game.i18n.localize(`SPYCRAFT.AbilityAbbr.${key}`),
        ...sys.abilities[key],
        tip: abilityTip(sys, key, game.i18n.localize(label))
      })),
      saves: Object.entries(CONFIG.SPYCRAFT.saves).map(([key, s]) => ({
        key,
        label: game.i18n.localize(s.label),
        ...sys.saves[key]
      })),
      weapons: this.actor.items
        .filter(i => i.type === "weapon")
        .map(w => ({
          item: w,
          ammoConfiguration: ammunitionConfiguration(w.system),
          canPlanAmmunition: compatibleAmmunition(w.system, CONFIG.SPYCRAFT.tables?.ammunitionCatalog ?? []).length > 0,
          attack: this.actor.weaponAttack(w),
          shots: weaponShots(w)
        }))
        .map(row => ({ ...row, facts: weaponFacts(row.attack), attackTip: weaponAttackTip(row.attack) })),
      playLabels: playLabels(),
      featPlay: npcFeatPlay(sys.featEffects),
      damageSaveHealthModes: {
        review: loc`Review existing adjustment`,
        automatic: loc`Add feat and effect health bonuses`,
        manual: loc`Health bonuses already included manually`
      },
      hazards: hazardsView(this.actor),
      nonLethal: nonLethalTotals(this.actor),
      dying: woundState(Number(this.actor.system.wounds?.value), this.actor.system.deathThreshold) === "dying",
      otherItems: this.actor.items.filter(i => i.type !== "weapon" && !isResourceLock(i)),
      npcTypes: {
        standard: loc`Standard`,
        special: loc`Special`,
        villain: loc`Villain (legacy special)`,
        animal: loc`Animal`
      },
      npcPackages: this.actor.flags?.spycraft2?.npcTemplate
        ? {
            label: this.actor.flags?.spycraft2?.npcPackage?.label ?? loc`Fixed loadout`,
            current: loc`Current package`,
            note: loc`TL packages are optional. Changing Threat Level leaves the current feats and equipment in place.`,
            preview: loc`Preview a package`,
            bands: loc`Edit TL bands`
          }
        : null,
      npc: this._npcContext(),
      manualRoles: { "": loc`None`, minion: loc`Minion`, henchman: loc`Henchman`, mastermind: loc`Mastermind` },
      healthChip: npcIsSpecial(this.actor)
        ? loc`vitality ${sys.vitality?.value ?? 0}/${sys.vitality?.max ?? 0} · wounds ${sys.wounds?.value ?? 0}/${sys.wounds?.max ?? 0}`
        : loc`Damage save: ${damageStateLabel(damageSaveState(this.actor).track.state)}`,
      // The conditions set on the token or the actor, by their Spycraft names.
      conditionStamps: [...(this.actor.statuses ?? [])]
        .map(id => CONFIG.statusEffects?.find(effect => effect.id === id)?.name)
        .filter(Boolean)
        .map(name => game.i18n.localize(name)),
      gcPlay: {
        damage: (state => ({ ...state, stateLabel: damageStateLabel(state.track.state) }))(damageSaveState(this.actor)),
        special: npcIsSpecial(this.actor),
        sceneDisposition: usesSceneDisposition(this.actor.type, sys),
        sceneDispositionLabel: loc`Scene disposition effects`,
        dispositions: dispositionRows(this.actor),
        baseDisposition: sys.disposition?.base ?? "neutral"
      },
      enrichedBiography: await enrich(sys.biography, this.actor)
    });
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.toggle("play-mode", !context.editMode);
    this.element.classList.toggle("edit-mode", !!context.editMode);
    enableHotbarDrag(this.element, this.actor);
  }

  _npcContext() {
    const sys = this.actor.system,
      profile = sys.npcProfile ?? defaultNpcProfile();
    const result = conditionNpcProfile(
      computeNpcProfile(profile, sys.npcType, sys.effectiveThreatLevel ?? sys.threatLevel, sys.abilities),
      npcSkillConditionContext(this.actor)
    );
    const gradeOptions = Object.fromEntries(NPC_RULES.grades.map((g, i) => [i + 1, g]));
    const skillOptions = Object.fromEntries(Object.entries(CONFIG.SPYCRAFT.skills).map(([k, v]) => [k, v.name]));
    return {
      profile,
      result,
      gradeOptions,
      wealthOptions: { 0: loc`None`, ...gradeOptions },
      tierOptions: Object.fromEntries(
        NPC_RULES.tiers.map(t => [
          t.tier,
          `${NPC_RULES.grades[t.tier - 1]} (${t.offset >= 0 ? "+" : ""}${t.offset} TL)`
        ])
      ),
      caliberOptions: Object.fromEntries(NPC_RULES.grades.slice(0, 5).map((g, i) => [i + 1, g])),
      skillOptions,
      grades: Object.entries(NPC_STATS)
        .filter(([key]) => !(result.type === "animal" && ["competence", "wealth"].includes(key)))
        .map(([key, label]) => ({
          key,
          label: key === "health" ? (result.type === "special" ? loc`Vitality / wounds` : loc`Damage save`) : label,
          value: profile.grades[key],
          options: key === "wealth" ? { 0: loc`None`, ...gradeOptions } : gradeOptions
        })),
      skills: profile.skills.map((s, index) => ({
        ...s,
        index,
        resolved: result.skills?.[index],
        tip: npcSkillTip(result.skills?.[index])
      })),
      equipment: NPC_CATEGORIES.map(category => ({
        category,
        picks: (profile.equipment[category] ?? []).map((caliber, index) => ({ caliber, index, category }))
      })),
      qualityOptions: Object.fromEntries(
        NPC_RULES.qualities
          .filter(q => q.types.includes(result.type) && q.mode !== "dedicated")
          .map(q => [q.id, `${q.name} (${q.costLabel})`])
      ),
      qualities: profile.qualities.map((q, index) => {
        const rule = NPC_RULES.qualities.find(r => r.id === q.id);
        return {
          ...q,
          index,
          rule,
          classLevel: rule?.mode === "classLevel",
          decision: rule?.mode === "decision",
          linked: rule?.mode === "linked",
          movement: rule?.mode === "movement",
          caliberCost: rule?.mode === "caliber"
        };
      }),
      referenceTables: Object.entries(NPC_RULES.tables).map(([key, rows]) => ({
        label: key,
        rows: rows.map((values, i) => ({
          grade: NPC_RULES.grades[i],
          values: values.map(v => (Array.isArray(v) ? v.join("/") : v))
        }))
      })),
      levels: Array.from({ length: 20 }, (_, i) => i + 1),
      catalog: NPC_RULES.qualities,
      source: NPC_RULES.source,
      special: result.type === "special",
      animal: result.type === "animal"
    };
  }

  _prepareSubmitData(event, form, formData, updateData) {
    const flat = formData.object,
      profile = structuredClone(this.actor.system.npcProfile ?? defaultNpcProfile());
    const changed = new Set();
    for (const [key, value] of Object.entries(flat)) {
      let m;
      if ((m = key.match(/^npcSkill\.(\d+)\.(key|grade)$/))) {
        if (profile.skills[m[1]]) profile.skills[m[1]][m[2]] = m[2] === "grade" ? Number(value) : value;
        changed.add("skills");
      } else if ((m = key.match(/^npcQuality\.(\d+)\.(id|units|details|level|modifier|linkedCost|limited|caliber)$/))) {
        if (profile.qualities[m[1]])
          profile.qualities[m[1]][m[2]] = ["id", "details"].includes(m[2])
            ? value
            : m[2] === "limited"
              ? !!value
              : Number(value);
        changed.add("qualities");
      } else if ((m = key.match(/^npcPick\.(weapons|gear|vehicles)\.(\d+)$/))) {
        if (profile.equipment[m[1]]) profile.equipment[m[1]][m[2]] = Number(value);
        changed.add("equipment");
      } else continue;
      delete flat[key];
    }
    for (const key of changed) flat[`system.npcProfile.${key}`] = profile[key];
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  static #onEnable() {
    if (!this.isEditable) return;
    return this.actor.update({ "system.npcProfile.enabled": !this.actor.system.npcProfile?.enabled });
  }
  static #onAddSkill() {
    if (!this.isEditable) return;
    const rows = structuredClone(this.actor.system.npcProfile.skills);
    const key = Object.keys(CONFIG.SPYCRAFT.skills).find(key => !rows.some(s => s.key === key));
    if (key) rows.push({ key, grade: 1 });
    return this.actor.update({ "system.npcProfile.skills": rows });
  }
  static #onAddQuality() {
    if (!this.isEditable) return;
    return this.actor.update({
      "system.npcProfile.qualities": [
        ...structuredClone(this.actor.system.npcProfile.qualities),
        { id: "all-thumbs", units: 1, details: "", level: 1, modifier: 0, linkedCost: 1, limited: false, caliber: 1 }
      ]
    });
  }
  static async #onAddPick(event, target) {
    if (!this.isEditable || !NPC_CATEGORIES.includes(target.dataset.category)) return;
    await this.whenSaved();
    const equipment = structuredClone(this.actor.system.npcProfile.equipment);
    equipment[target.dataset.category].push(1);
    return this.actor.update({ "system.npcProfile.equipment": equipment });
  }
  static async #onRemoveRow(event, target) {
    if (!this.isEditable) return;
    const { list, index, category } = target.dataset;
    if (!["skills", "qualities", "equipment"].includes(list)) return;
    await this.whenSaved();
    const rows = structuredClone(this.actor.system.npcProfile[list]);
    const array = list === "equipment" ? rows[category] : rows;
    if (!Array.isArray(array)) return;
    array.splice(Number(index), 1);
    return this.actor.update({ [`system.npcProfile.${list}`]: rows });
  }

  _item(target) {
    return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }
  static #onRollAbility(event, target) {
    return this.actor.rollAbility(target.dataset.ability);
  }
  static #onRollSave(event, target) {
    return this.actor.rollSave(target.dataset.save, { askContext: !skipDialog(event) });
  }
  static async #onRollAttack(event, target) {
    const item = this._item(target);
    if (!quickAttack(event, this.actor)) return this.actor.rollAttack(item, { askContext: true });
    // A quick NPC attack on a targeted token goes straight on to hit or miss.
    return resolveQuickAttack(await this.actor.rollAttack(item, quickAttackOptions(this.actor, item)));
  }
  static #onRollDamage(event, target) {
    return this.actor.rollDamage(this._item(target));
  }
  static #onItemEdit(event, target) {
    return this._item(target)?.sheet.render(true);
  }
  static #onItemDelete(event, target) {
    return this._item(target)?.deleteDialog();
  }
}
