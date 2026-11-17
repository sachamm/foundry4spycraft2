import {buildSetupGuide, combatToolVisibility, focusSetupTask, activeConditionLabels, enhanceAgentSheet} from "./agent-ux.mjs";
import {COMBAT_STANCES} from "../rules/combat-stance.mjs";
import {manageThreadNeedle} from '../apps/thread-needle.mjs';
import {takeStrikingAttack,reviewStrikingAttack} from '../apps/striking-stance.mjs';
import {recordFendMovement} from '../apps/fend.mjs';
import {takeCounterTrip,reviewCounterTrip} from '../apps/counter-trip.mjs';
import {takeTripFinalAttack,reviewTripFinalAttack} from '../apps/trip-final-attack.mjs';
import {manageTripOutcomes} from '../apps/trip-outcomes.mjs';
import {managePowerStanceInitiative} from '../apps/power-stance.mjs';
import {manageDrivingStance} from '../apps/driving-stance.mjs';
import {manageStanceDamage} from '../apps/stance-damage.mjs';
import {reviewStanceMovement} from '../apps/stance-movement.mjs';
import {reviewFeintBenefits} from '../apps/feint-review.mjs';
import {manageFeintOutcomes} from '../apps/feint-outcomes.mjs';
import {declareCombatStance,managePunishingDamage} from '../apps/combat-stance.mjs';
import {settleSilverTongueVictory,resumeSilverTongueVictory,correctSilverTongueVictory,recoverSilverTongueAtMissionEnd,silverVictoryRows} from '../apps/silver-tongue.mjs';
import {markRows} from '../rules/mark.mjs';
import {safeHouseSource,safeHouseRows} from '../rules/safe-house.mjs';
import {careerAgentMissionKey,getCareerAgentReview} from '../rules/career-agent.mjs';
import {wellFundedCashHistory} from '../rules/well-funded.mjs';
import {toolShedKitState,toolShedSource} from '../rules/tool-shed.mjs';
import {declareDarting,takeDartingFinalAttack,reviewDarting} from '../apps/darting.mjs';
import {declareSuperiorCover,reviewSuperiorCover} from '../apps/superior-cover.mjs';
import {careerFormPlan,mergeCareerForm} from '../rules/career-form.mjs';
import {settlePendingDamageSave} from '../apps/damage-settlement.mjs';
import {rollPendingDamageSave} from '../apps/damage-saves.mjs';
import {reviewDamageLedger,applyAccumulatedDamage} from '../apps/damage-ledger.mjs';
import {checkAccumulatedDamage} from '../apps/accumulated-damage.mjs';
import {takeMobileOffense} from '../apps/mobile-offense.mjs';
import {takeContempt} from '../apps/contempt.mjs';
import {takeCombatInstincts} from '../apps/combat-instincts.mjs';
import {rollDisarmResponse} from '../apps/disarm-response.mjs';
import {takeMissTrick} from '../apps/miss-tricks.mjs';
import {rollCheapShot} from '../apps/cheap-shot.mjs';
import {rollDisarm} from '../apps/disarm.mjs';
import {declareTwoWeapon,reviewTwoWeapon,takeTwoWeaponFinalAttack} from '../apps/two-weapon.mjs';
import {checkNumericalAdvantage} from '../apps/numerical-advantage.mjs';
import {criticalInjuryReviews} from '../apps/critical-injuries.mjs';
import {takeTotalDefense} from '../apps/total-defense.mjs';
import {checkCombatMovement} from '../apps/combat-movement.mjs';
import {activateCombatExpertise} from '../apps/combat-expertise.mjs';
import {checkReflexDamage} from '../apps/reflex-damage.mjs';
import {checkIncomingDefense} from '../apps/incoming-defense.mjs';
import {checkBurrowMaterial} from "../apps/burrow-material.mjs";
import {computeAgent} from "../rules/engine.mjs";
import {calculateRecoveryRates} from '../apps/recovery-rates.mjs';
import {planAmmunitionStockpile} from '../apps/ammunition-planner.mjs';
import {ammunitionConfiguration,compatibleAmmunition} from '../rules/ammunition.mjs';
import {CAMOUFLAGE_TERRAINS,camouflageTerrain} from '../rules/quality-checks.mjs';
import {RESISTANCE_TYPES,resistanceType} from '../rules/resistances.mjs';
import {brightIdeaPoolStatus} from '../rules/bright-idea.mjs';
import {queueResources,isResourceLock} from "../rules/transactions.mjs";
import {conditionNpcProfile,npcSkillConditionContext} from '../rules/npc-conditions.mjs';
import { NPC_RULES, NPC_STATS, NPC_CATEGORIES, defaultNpcProfile, computeNpcProfile } from "../rules/npcs.mjs";
import {reviewActorRules} from "../apps/rules-refresh.mjs";
import { classSkillSelections,orderedClassChoices } from "../rules/class-skills.mjs";
import { armorSlot } from "../rules/gear.mjs";
import { renderTemplate } from "../rules/formula.mjs";
import { describe as describePrereq } from "../rules/prerequisites.mjs";
import { SpycraftBrowser } from "../apps/browser.mjs";
import {rollNpcSkill,npcDamageSave,resetDamageTrack,manageDisposition,damageSaveState,npcIsSpecial,dispositionRows} from "../apps/gc/npc-play.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TPL = "systems/spycraft2/templates/actor";

/* -------------------------------------------------------------------------- */
/*  Agent sheet                                                               */
/* -------------------------------------------------------------------------- */

export class SpycraftAgentSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** Career level whose skill points are being edited on the Skills tab. */
  _skillLevel = null;

  /** Local disclosure preferences survive complete and partial sheet renders. */
  _open = { todo: false, warnings: false };

  /** A local view preference, never stored on the character. */
  _editMode = false;
  _skillSearch = "";
  _trainedOnly = false;

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "agent"],
    position: { width: 820, height: 860 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleEditMode(){
        if (!this.isEditable) return;
        this._editMode = !this._editMode;
        return this.render();
      },
      setupTask: SpycraftAgentSheet.#onSetupTask,
      applyShaken(){return this.actor.applyShaken();},
      reviewShakenApplication(){return this.actor.reviewShakenApplication();},
      editShakenSource(event,target){return this.actor.editShakenSource(target.dataset.sourceUuid);},
      reviewShakenInitiative(event,target){return this.actor.reviewShakenInitiative(target.dataset.combatId,target.dataset.combatantId);},
      reviewMissionXP(){return this.actor.reviewMissionXP();},
      reviewActionDieAward(){return this.actor.reviewActionDieAward();},
      reviewActionDiceSettlement(){return this.actor.reviewActionDiceSettlement();},
      activateMasterPlan(){return this.actor.activateMasterPlan();},
      rollDrunkReposition(){return this.actor.rollDrunkReposition();},
      applyDrunkReposition(event,target){return this.actor.applyDrunkReposition({id:target.dataset.recordId});},
      confirmDrunkReposition(event,target){return this.actor.confirmDrunkReposition({id:target.dataset.recordId});},
      beginDrunkSleep(){return this.actor.beginDrunkSleep();},
      completeDrunkSleep(){return this.actor.completeDrunkSleep();},
      beginFatigueRest(){return this.actor.beginFatigueRest();},
      completeFatigueRest(){return this.actor.completeFatigueRest();},
      reviewRestraintRelease(){return this.actor.reviewRestraintRelease();},
      confirmRestraintEscapeMove(event,target){const message=game.messages.get(target.dataset.messageId);if(!message)return ui.notifications.warn('Load the original grapple message before confirming movement.');return this.actor.confirmRestraintEscapeMove(message);},
      escapeRestraint(){return this.actor.rollSkill('athletics','str',{initialCheck:'restraint-escape'});},
      applyBaffled(){return this.actor.applyBaffled();},
      reviewBaffledApplication(){return this.actor.reviewBaffledApplication();},
      applyFatigue(){return this.actor.applyFatigue();},
      wakeFromSleep(){return this.actor.wakeFromSleep();},
      setMovementCondition(event,target){return this.actor.setReviewedCondition(target.dataset.condition);},
      setSickened(){return this.actor.setSickened();},
      checkReflexDamage(){return checkReflexDamage(this.actor);},
      rollCriticalInjury(){return this.actor.rollCriticalInjury();},
      reviewCriticalInjury(event,target){return this.actor.reviewCriticalInjury(target.dataset.injury);},
      takeTotalDefense(){return takeTotalDefense(this.actor);},
      takeMobileOffense(){return takeMobileOffense(this.actor);},
      takeContempt(){return takeContempt(this.actor);},
      takeCombatInstincts(){return takeCombatInstincts(this.actor);},
      manageCheapShots(){return this.actor.manageCheapShots();},
      reviewFeintBonuses(){return reviewFeintBenefits(this.actor);},
      takeCounterTrip(){return takeCounterTrip(this.actor);},
      reviewCounterTrip(){return reviewCounterTrip(this.actor);},
      takeTripFinalAttack(){return takeTripFinalAttack(this.actor);},
      reviewTripFinalAttack(){return reviewTripFinalAttack(this.actor);},
      manageTripOutcomes(){return manageTripOutcomes(this.actor);},
      manageFeintOutcomes(){return manageFeintOutcomes(this.actor);},
      takeStrikingAttack(){return takeStrikingAttack(this.actor);},
      reviewStrikingAttack(){return reviewStrikingAttack(this.actor);},
      manageThreadNeedle(){return manageThreadNeedle(this.actor);},
      recordFendMovement(){return recordFendMovement(this.actor);},
      reviewStanceMovement(){return reviewStanceMovement(this.actor);},
      reviewPowerStanceInitiative(){return managePowerStanceInitiative(this.actor);},
      declareCombatStance(){return declareCombatStance(this.actor);},
      manageDrivingStance(){return manageDrivingStance(this.actor);},
      manageStanceDamage(){return manageStanceDamage(this.actor);},
      managePunishingDamage(){return managePunishingDamage(this.actor);},
      takeMissTrick(){return takeMissTrick(this.actor);},
      rollCheapShot(){return rollCheapShot(this.actor);},
      rollDisarm(){return rollDisarm(this.actor);},
      rollDisarmResponse(event,target){return rollDisarmResponse(this.actor,{weaponId:target.closest('[data-item-id]')?.dataset.itemId});},
      declareTwoWeapon(){return declareTwoWeapon(this.actor);},
      takeTwoWeaponFinalAttack(){return takeTwoWeaponFinalAttack(this.actor);},
      reviewTwoWeapon(){return reviewTwoWeapon(this.actor);},
      checkNumericalAdvantage(){return checkNumericalAdvantage(this.actor);},
      manageAnalysisTasks(){return this.actor.manageAnalysisTasks();},
      checkCombatMovement(){return checkCombatMovement(this.actor);},
      declareDarting(){return declareDarting(this.actor);},
      takeDartingFinalAttack(){return takeDartingFinalAttack(this.actor);},
      reviewDarting(){return reviewDarting(this.actor);},
      declareSuperiorCover(){return declareSuperiorCover(this.actor);},
      reviewSuperiorCover(){return reviewSuperiorCover(this.actor);},
      activateCombatExpertise(){return activateCombatExpertise(this.actor);},
      settlePendingDamageSave(){return settlePendingDamageSave(this.actor);},
      rollPendingDamageSave(){return rollPendingDamageSave(this.actor);},
      reviewDamageLedger(){return reviewDamageLedger(this.actor);},
      applyAccumulatedDamage(){return applyAccumulatedDamage(this.actor);},
      checkAccumulatedDamage(){return checkAccumulatedDamage(this.actor);},
      manageTakedown(){return this.actor.manageTakedown();},
      manageMeleeTradeoff(){return this.actor.manageMeleeTradeoff();},
      checkIncomingDefense(){return checkIncomingDefense(this.actor);},
      sufferInitiativeLoss(){return this.actor.sufferInitiativeLoss();},
      checkBurrowMaterial(){return checkBurrowMaterial(this.actor);},
      planAmmunition(event,target){return planAmmunitionStockpile(this.actor.items.get(target.closest("[data-item-id]").dataset.itemId));},
      rollAbility: SpycraftAgentSheet.#onRollAbility,
      rollSave: SpycraftAgentSheet.#onRollSave,
      rollSkill: SpycraftAgentSheet.#onRollSkill,
      shareTemporaryFeats(event,target){return this.actor.shareTemporaryFeats(target.dataset.ability);},
      reviewLimitedUseCounter(event,target){return this.actor.reviewLimitedUseCounter(target.dataset.resource);},
      useEagleEye(){return this.actor.useEagleEye();},
      chooseTemporaryFocuses(event,target){return this.actor.chooseTemporaryFocuses({featId:target.dataset.itemId});},
      useRenaissanceMan(){return this.actor.useRenaissanceMan();},
      settleSilverTongueVictory(){return settleSilverTongueVictory(this.actor);},
      resumeSilverTongueVictory(event,target){return resumeSilverTongueVictory(this.actor,target.dataset.victory);},
      correctSilverTongueVictory(event,target){return correctSilverTongueVictory(this.actor,target.dataset.victory);},
      recoverSilverTongueAtMissionEnd(){return recoverSilverTongueAtMissionEnd(this.actor);},
      useMark(){return this.actor.useMark();},
      discloseMark(event,target){return this.actor.discloseMark(target.dataset.observation);},
      correctMark(event,target){return this.actor.correctMark(target.dataset.observation);},
      useFeatFreeAction(event,target){return this.actor.useFeatFreeAction(target.dataset.resource);},
      useLimitedAbility(event,target){return this.actor.useManualLimitedAbility(target.dataset.resource);},
      migrateBrightIdeaUses(){return this.actor.migrateBrightIdeaUses();},
      recordAdrenalineWoundLoss(){return this.actor.recordAdrenalineWoundLoss();},
      recordHintResponse(event,target){return this.actor.recordHintResponse({source:target.dataset.resource});},
      useFinalDeduction(){return this.actor.useFinalDeduction();},
      useGlobalSearch(){return this.actor.useGlobalSearch();},
      useLittleDetails(){return this.actor.useLittleDetails();},
      useMasterThief(){return this.actor.useMasterThief();},
      useSafeHouse(){return this.actor.useSafeHouse();},
      correctSafeHouseRecord(event,target){return this.actor.correctSafeHouseRecord(target.dataset.house);},
      placeSafeHouse(event,target){return this.actor.placeSafeHouse(target.dataset.house);},
      reviewSafeHouseMission(){return this.actor.reviewLimitedUseCounter('safeHouseMission');},
      reviewSafeHouseScene(){return this.actor.reviewLimitedUseCounter('safeHouseScene');},
      useCareerAgentReward(){return this.actor.useCareerAgentReward();},
      reviewCareerAgentReward(){return this.actor.reviewCareerAgentReward();},
      useWellFunded(){return this.actor.useWellFunded();},
      reviewWellFundedCounter(){return this.actor.reviewLimitedUseCounter('wellFunded');},
      useToolShed(){return this.actor.useToolShed();},
      reviewToolShedCounter(){return this.actor.reviewLimitedUseCounter('toolShed');},
      improviseCommonItem(){return this.actor.improviseCommonItem();},
      useOneInAMillion(){return this.actor.useOneInAMillion();},
      selectMissionCaliberGear(event,target){return this.actor.selectMissionCaliberGear({source:target.dataset.source});},
      selectBigStickGear(){return this.actor.selectBigStickGear();},
      selectArmorUseGear(){return this.actor.selectArmorUseGear();},
      reviewReserveTransaction(){return this.actor.reviewReserveTransaction();},
      allocateMissionReserves(){return this.actor.allocateMissionReserves();},
      findImprovisedWeapon(){return this.actor.findImprovisedWeapon();},
      rollGearAcquisition(event,target){return this.actor.rollGearAcquisition(target?.dataset.resource?{requestAbility:target.dataset.resource}:{});},
      claimGearAcquisition(){return this.actor.claimGearAcquisition();},
      recoverResourceTransaction(){return this.actor.recoverResourceTransaction();},
      settleMissionXP(){return this.actor.settleMissionXP();},
      awardActionDice(){return this.actor.awardActionDice();},
      manageGCDice(){return game.spycraft2.gcDice.manage();},
      reviewUsagePeriod(){return game.spycraft2.reviewUsagePeriod();},
      async resetUsagePeriod(event,target){await game.spycraft2.resetUsagePeriod(target.dataset.period);this.render();},
      rollKnowledge(){return this.actor.rollKnowledge();},
      initializeResources(){return this.actor.initializeStartingResources();},
      keepResources(){return this.actor.initializeStartingResources({keepCurrent:true});},
      reviewRules(){return reviewActorRules(this.actor);},
      restoreRules(){return reviewActorRules(this.actor,{restore:true});},
      rollAttack: SpycraftAgentSheet.#onRollAttack,
      rollRangedAttack(event,target){return this.actor.rollRangedAttack(this._item(target));},
      rollDamage: SpycraftAgentSheet.#onRollDamage,
      rollInitiative: SpycraftAgentSheet.#onRollInitiative,
      rollVitality: SpycraftAgentSheet.#onRollVitality,
      reviewVitality(event,target){return this.actor.reviewVitality(Number(target.dataset.index));},
      todo: SpycraftAgentSheet.#onTodo,
      healActionDice(){return this.actor.healWithActionDice();},
      refreshAction(){return this.actor.refreshWithActionDie();},
      configureFortuneTeammates(){return this.actor.configureFortuneTeammates();},
      calculateRecoveryRates(){return calculateRecoveryRates(this.actor);},
      activateMentalLeap(){return this.actor.activateMentalLeap();},
      endMentalLeap(event,target){return this.actor.endMentalLeap({id:target.dataset.recordId});},
      recordFatigueEscalation(){return this.actor.recordFatigueEscalation();},
      startMentalLeapSleep(){return this.actor.startMentalLeapSleep();},
      completeMentalLeapSleep(){return this.actor.completeMentalLeapSleep();},
      rollWisdomCollapse(){return this.actor.rollWisdomCollapse();},
      summonClassAssistants(event,target){return this.actor.summonClassAssistants(target.dataset.resource);},
      withdrawClassAssistants(event,target){return this.actor.withdrawClassAssistants(target.dataset.groupId);},
      useEverydayGenius(){return this.actor.useEverydayGenius();},
      useKnowItAll(){return this.actor.useKnowItAll();},
      useAnyTimeAnyPlace(){return this.actor.useAnyTimeAnyPlace();},
      useIntelTemporaryFeats(event,target){return this.actor.useIntelTemporaryFeats(target.dataset.resource);},
      activateNoFear(){return this.actor.activateNoFear();},
      boostFortunesOfWar(){return this.actor.boostFortunesOfWar();},
      boostDefense(){return this.actor.boostDefenseWithActionDie();},
      initializeStartingDice(){return this.actor.initializeStartingDice();},
      spendActionDie: SpycraftAgentSheet.#onSpendActionDie,
      addLevel: SpycraftAgentSheet.#onAddLevel,
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
    header: { template: `${TPL}/agent-header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: `${TPL}/agent-main.hbs`, scrollable: [""] },
    classes: { template: `${TPL}/agent-classes.hbs`, scrollable: [""] },
    skills: { template: `${TPL}/agent-skills.hbs`, scrollable: [""] },
    feats: { template: `${TPL}/agent-feats.hbs`, scrollable: [""] },
    training: { template: `${TPL}/agent-training.hbs`, scrollable: [""] },
    gear: { template: `${TPL}/agent-gear.hbs`, scrollable: [""] },
    bio: { template: `${TPL}/agent-bio.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "SPYCRAFT.Tab.Main" },
        { id: "classes", label: "SPYCRAFT.Tab.Classes" },
        { id: "skills", label: "SPYCRAFT.Tab.Skills" },
        { id: "feats", label: "SPYCRAFT.Tab.Feats" },
        { id: "training", label: "SPYCRAFT.Tab.Training" },
        { id: "gear", label: "SPYCRAFT.Tab.Gear" },
        { id: "bio", label: "SPYCRAFT.Tab.Bio" }
      ],
      initial: "main"
    }
  };

  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const sys = actor.system;
    const cfg = CONFIG.SPYCRAFT;
    const rollData = actor.getRollData();
    Object.assign(context, {
      actor, system: sys, shakenInitiativeReviews:actor.shakenInitiativeReviews, usagePeriodReview:game.spycraft2?.getUsagePeriodReview?.()??{}, startingDiceEntry:actor.startingDiceEntry, source: actor.system._source, config: cfg, editable: this.isEditable,
      tabs: this._prepareTabs("primary"),
      warnings: sys.warnings ?? [], setupGuide: buildSetupGuide(sys.todo), open: this._open,
      editMode: this.isEditable && this._editMode, activeConditions: activeConditionLabels(sys),
      combatTools: combatToolVisibility(sys, COMBAT_STANCES)
    });

    // Hover breakdowns: fixed parts first, then every origin/feat/class bonus the engine recorded.
    const src = sys.bonusSources ?? {};
    const misc = sys.misc ?? {};
    const tip = (parts, ...targets) => {
      const rows = parts.filter(([, v]) => v);
      for (const t of targets) for (const s of src[t] ?? []) rows.push([s.source, s.value]);
      return rows;
    };
    const abilTip = k => [k.toUpperCase(), sys.abilities[k].mod];
    const miscLabel = game.i18n.localize("SPYCRAFT.Misc");
    const classLabel = game.i18n.localize("SPYCRAFT.Class.Label");
    const armorLabel = game.i18n.localize("SPYCRAFT.Armor");
    const vitBonus = (src.vitality ?? []).reduce((n, s) => n + s.value, 0);
    const conPart = sys.abilities.con.mod * sys.level;
    context.tips = {
      defense: tip([[game.i18n.localize("SPYCRAFT.Base"), 10], [classLabel, sys.defense.base], ["DEX",sys.defense.dexterity], ["Vulnerable: dodge bonuses lost",-sys.defense.dodgeLost], [armorLabel, sys.defense.armor], ["Size", sys.sizeModifier], [miscLabel, misc.defense]], "defense"),
      initiative: tip([[classLabel, sys.initiative.base], abilTip("dex"), [miscLabel, misc.initiative]], "initiative"),
      speed: tip([[game.i18n.localize("SPYCRAFT.Base"), 30], [armorLabel, sys.armor?.speed], [miscLabel, misc.speed]], "speed"),
      knowledge: tip([[game.i18n.localize("SPYCRAFT.Level"), sys.level], abilTip("int"), [miscLabel, misc.knowledge],["Baffled/Incompetent",sys.knowledgeSkillBonusCondition?.adjustment??0]], "knowledge"),
      vitality: tip([[game.i18n.localize("SPYCRAFT.VitalityDice"), sys.vitalityBreakdown?.dice ?? 0],
        [`CON × ${sys.level}`, conPart], ["Minimum 1 per level", sys.vitalityBreakdown?.minimumAdjustment], [miscLabel, misc.vitality]], "vitality"),
      wounds: tip([["CON", sys.abilities.con.value], ["Size", sys.wounds.max - sys.abilities.con.value - (misc.wounds ?? 0) - (src.wounds ?? []).reduce((n,s)=>n+s.value,0)], [miscLabel, misc.wounds]], "wounds"),
      actionDice: tip([[game.i18n.localize("SPYCRAFT.Level"), sys.actionDice.max - (src["actionDice.count"] ?? []).reduce((n, s) => n + s.value, 0) - (misc.actionDice ?? 0)],
        [miscLabel, misc.actionDice]], "actionDice.count")
    };

    // Abilities
    context.abilities = Object.entries(cfg.abilities).map(([key, label]) => ({
      key, label: game.i18n.localize(label), abbr: key.toUpperCase(), ...sys.abilities[key]
    }));
    context.increaseLevels = cfg.abilityIncreaseLevels.map(l => ({
      level: l, key: `l${l}`, value: sys.abilityIncreases[`l${l}`], reached: sys.level >= l
    }));
    context.abilityOptions = Object.fromEntries(Object.entries(cfg.abilities).map(([k, v]) => [k, game.i18n.localize(v)]));

    context.saves = Object.entries(cfg.saves).map(([key, s]) => ({
      key, label: game.i18n.localize(s.label), ...sys.saves[key],
      tip: tip([[classLabel, sys.saves[key].base], abilTip(s.ability), key === "ref" ? [armorLabel, sys.armor?.check] : [armorLabel, 0], [miscLabel, misc[key]]], `saves.${key}`)
    }));

    // Items by type
    const items = actor.items.contents.filter(i=>!isResourceLock(i)).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const byType = t => items.filter(i => i.type === t);
    context.talent = byType("origin").find(i => i.system.originType === "talent");
    context.specialty = byType("origin").find(i => i.system.originType === "specialty");
    context.originSelections = byType("origin").map(item => {
      const rule = cfg.tables.originChoices?.[item.name] ?? {};
      const choices = item.system.originChoices ?? {};
      const fields = [];
      const focusRule=cfg.tables.originFocuses?.[item.name];
      if(focusRule?.choiceSkill){
        const skill=focusRule.choiceSkill;
        fields.push({key:"grantedFocus",label:`Granted ${cfg.skills[skill].name} focus`,value:choices.grantedFocus,text:skill==="profession",options:skill==="profession"?null:Object.fromEntries((focusRule.domain??cfg.focuses[skill]).map(focus=>[focus,focus]))});
      }
      if (rule.attributes) {
        fields.push({ key: "up", label: "+2 attribute", value: choices.up, options: context.abilityOptions });
        fields.push({ key: "down", label: "−2 attribute", value: choices.down, options: context.abilityOptions });
      }
      const skillOptions = Object.fromEntries(Object.values(cfg.skills).map(s => [s.key, s.name]));
      for (const [kind, number, label] of [
        ["classSkill", rule.classSkills === "scaling" ? 1 + Math.floor(sys.level / 4) : rule.classSkills ?? 0, "Class skill"],
        ["maxRank", rule.maxRankSkills === "scaling" ? 1 + Math.floor(sys.level / 4) : 0, "Maximum-rank skill"]
      ]) for (let index = 0; index < number; index++) fields.push({ key: `${kind}${index}`, label: `${label} ${index + 1}`, value: choices[`${kind}${index}`], options: skillOptions });
      if (rule.threatSkill) fields.push({ key: "threatSkill", label: "Threat-range skill", value: choices.threatSkill, options: skillOptions });
      if (rule.npcQualities) {
        const options = Object.fromEntries(Object.entries(cfg.tables.testSubjectQualities).map(([key, quality]) => [key, quality.label]));
        for (let index = 0; index < rule.npcQualities; index++) {
          fields.push({ key: `npcQuality${index}`, label: `NPC quality ${index + 1} (GC approval)`, value: choices[`npcQuality${index}`], options });
          if(choices[`npcQuality${index}`]==='damageResistance')fields.push({key:`npcDetails${index}`,label:`Quality ${index + 1} resisted damage type`,value:resistanceType(choices[`npcDetails${index}`]),options:RESISTANCE_TYPES});
          else if(choices[`npcQuality${index}`]==='camouflaged')fields.push({key:`npcDetails${index}`,label:`Quality ${index + 1} camouflage terrain`,value:camouflageTerrain(choices[`npcDetails${index}`]),options:CAMOUFLAGE_TERRAINS});
          else fields.push({ key: `npcDetails${index}`, label: `Quality ${index + 1} details / chosen item`, value: choices[`npcDetails${index}`], text: true });
        }
      }
      return { id: item.id, name: item.name, fields, description: item.system.description };
    });

    // Classes & progression
    const classItems = byType("class");
    const classById = Object.fromEntries(classItems.map(c => [c.system.identifier || c.name, c]));
    context.finalAttackRound=this.actor.limitedUseStatus?.find(s=>s.id==='finalAttackRound');
    context.dartingFinalAttack=this.actor.limitedUseStatus?.find(s=>s.id==='dartingFinalAttack');
    context.canRecordVitality=this.actor.isOwner===true;
    context.progression = sys.progression.map((p, i) => {
      const ci = classById[p.classId];
      const counts = sys.progression.slice(0, i + 1).filter(x => x.classId === p.classId).length;
      return {
        index: i, level: i + 1, classId: p.classId, className: ci?.name ?? p.classId, classLevel: counts,
        vitalityDie: ci?.system.vitalityDie, vitality: p.vitality, first: i === 0, isLast: i === sys.progression.length - 1,
        skillPoints: sys.skillPoints?.[i]
      };
    });
    context.classes = classItems.map(ci => {
      const ident = ci.system.identifier || ci.name;
      const lvl = sys.classLevels?.[ident] ?? 0;
      const lists = Object.fromEntries((ci.system.choiceLists ?? []).map(L => [L.key, L]));
      return {
        specialistFields:(sys.weaponSpecialist?.fields??[]).filter(field=>field.itemId===ci.id),
        specialistModes:{ability:"Another ability",proficiency:"Another possessed proficiency"},
        specialistProficiencies:Object.fromEntries(Object.entries(cfg.proficiencies).filter(([key])=>sys.proficiencyTotals?.[key]?.proficient).map(([key,value])=>[key,value.label])),
        inheritedChoices:(sys.inheritedClassChoices??[]).filter(entry=>entry.ownerId===ci.id).map(entry=>({...entry,options:Object.fromEntries((entry.menu?.options??[]).map(option=>[option.index,option.name])),skillOptions:Object.fromEntries((entry.skillOptions??[]).map(key=>[key,cfg.skills[key]?.name??key]))})),
        skillChoiceFields:classSkillSelections(ci,lvl).map(field=>({...field,value:ci.system.skillChoices?.[field.key]??"",options:Object.fromEntries(Object.values(cfg.skills).filter(skill=>field.anySkill||ci.system.classSkills?.includes(skill.key)||sys.universalClassSkills?.includes(skill.key)||sys.skills?.[skill.key]?.classSkill).map(skill=>[skill.key,skill.name]))})),
        phdOptions:Object.fromEntries((ci.system.classSkills??[]).map(key=>[key,cfg.skills[key]?.name??key])),
        phdFields:ident==="scientist"?[[2,"phdSkill"],[11,"phdSkill1"],[19,"phdSkill2"]].filter(([level])=>lvl>=level).map(([level,key])=>({level,key,value:ci.system[key]})):[],
        item: ci, levels: lvl, isVirtuoso: ident === "virtuoso",
        skillOptions: Object.fromEntries(Object.values(cfg.skills).map(s=>[s.key,s.name])),
        abilities: (ci.system.abilities ?? []).filter(a => a.level <= lvl).map(a => ({
          ...a, text: renderTemplate(a.description, { ...rollData, classes: { ...rollData.classes } })
        })),
        choices: orderedClassChoices(ci).map(({slot,index:idx}) => ({
          idx, level: slot.level, list: lists[slot.list]?.name ?? slot.list, active: slot.level <= lvl&&!(ident==="soldier"&&slot.list==="weaponSpecialist"&&slot.level>6&&ci.system.weaponSpecialist?.[slot.level]?.mode==="proficiency"),
          value: ci.system.choices?.[idx] ?? "",
          options: Object.fromEntries((lists[slot.list]?.options ?? []).map(o => [o.index, o.name])),
          description: lists[slot.list]?.options?.find(o => o.index === Number(ci.system.choices?.[idx]))?.description ?? ""
        })).filter(c => c.active)
      };
    });
    context.xpNext = sys.xpNext;

    // Skills
    const lvl = Math.clamp(this._skillLevel ?? sys.level, 1, Math.max(1, sys.level));
    context.skillLevel = sys.level ? lvl : null;
    const entry = sys.progression[lvl - 1];
    const lvlClass = entry ? classById[entry.classId] : null;
    context.skillLevelInfo = sys.skillPoints?.[lvl - 1];
    context.skillLevels = sys.progression.map((p, i) => ({ level: i + 1, active: i + 1 === lvl }));
    context.skills = Object.values(sys.skillTotals ?? {}).map(s => ({
      ...s,
      points: entry?.skills?.[s.key] ?? 0,
      historicalRanks:context.skillLevelInfo?.skills?.[s.key]?.ranks??s.ranks,
      purchaseMaxRanks:context.skillLevelInfo?.skills?.[s.key]?.maxRanks??s.maxRanks,
      classAtLevel: !!sys.skillPoints?.[lvl-1]?.classSkills?.includes(s.key),
      abilityLabel: s.abilities.map(a => a.toUpperCase()).join("/"),
      totalsLabel: s.totals.map(t => `${t.total >= 0 ? "+" : ""}${t.total}`).join(" / "),
      bonusTip: tip([[miscLabel, s.misc]], `skills.${s.key}.misc`),
      threatTip: tip([], `skills.${s.key}.threat`),
      capTip: tip([], `skills.${s.key}.cap`),
      totals: s.totals.map(t => ({
        ...t, tip: tip([[game.i18n.localize("SPYCRAFT.Skill.Ranks"), s.ranks], abilTip(t.ability), ["Attribute-based condition penalty",s.abilityPenalties?.[t.ability]??0],["Baffled/Incompetent",t.conditionBonusAdjustment??0], [miscLabel, s.misc]], `skills.${s.key}.misc`)
      }))
    }));

    // Feats
    context.feats = byType("feat").map(f => ({
      item: f, treeLabel: cfg.featTrees[f.system.tree] ?? f.system.tree,
      status: sys.featStatus?.[f.id] ?? { ok: true, unmet: [] },
      prereqText: describePrereq(f.system.prerequisites)
    })).sort((a, b) => a.treeLabel.localeCompare(b.treeLabel) || a.item.name.localeCompare(b.item.name));
    context.featTrees = Object.entries(sys.feats?.trees ?? {}).filter(([, v]) => v.slots || v.spent || v.owned)
      .map(([k, v]) => ({ key: k, label: cfg.featTrees[k], ...v }));
    context.coreAbilities = sys.coreAbilities ?? [];
    context.criticalInjuryReviews=criticalInjuryReviews(this.actor);
    context.startedCharacterCombat=this.actor.participatingCombat?.started===true;
    context.mobileOffense=(this.actor.limitedUseStatus??[]).find(s=>s.id==='mobileOffense');
    context.contempt=(this.actor.limitedUseStatus??[]).find(s=>s.id==='contempt');
    context.contemptRound=(this.actor.limitedUseStatus??[]).find(s=>s.id==='contemptRound');
    context.combatInstincts=(this.actor.limitedUseStatus??[]).find(s=>s.id==='combatInstincts');
    context.twoWeaponFinalAttack=(this.actor.limitedUseStatus??[]).find(s=>s.id==='twoWeaponFinalAttack');
    context.jinxUse=(this.actor.limitedUseStatus??[]).find(s=>s.id==='jinx');
    context.markUse=(this.actor.limitedUseStatus??[]).find(s=>s.id==='mark');
    context.silverVictories=silverVictoryRows(this.actor);
    context.attributeDamageRows=Object.entries(sys.attributeDamageState?.byAbility??{}).filter(([_k,v])=>v.total>0).map(([key,v])=>({key,label:game.i18n.localize(cfg.abilities[key]),...v}));
    context.attributeDamageHistory=!!sys.attributeDamageState?.events?.length;
    context.attributeMissionRecovered=(sys.attributeDamage?.recoveries??[]).some(r=>r.kind==='missionEnd'&&r.missionId===(this.actor.usagePeriods?.mission??'initial'));
    context.markObservations=markRows(this.actor.flags.spycraft2?.markObservations,cfg);
    context.featFreeActions=(this.actor.limitedUseStatus??[]).filter(spec=>['featFreeAction','featFreeActionRound'].includes(spec.workflow));
    context.limitedUses=(this.actor.limitedUseStatus??[]).filter(spec=>!spec.hidden||spec.counterReview);
    context.combatReviewNeeded = !!(context.usagePeriodReview.needsReview
      || actor.flags.spycraft2?.missionXPReview?.needsReview
      || actor.flags.spycraft2?.actionDieAwardReview?.needsReview
      || sys.actionDiceSettlementReview?.needsReview);
    const brightStatus=brightIdeaPoolStatus(sys,this.actor.usagePeriods);context.brightIdeaLegacy=brightStatus.needsReview;context.brightIdeaLegacyMalformed=brightStatus.legacyUsed===null;
    context.isGM=game.user.isGM;
    context.professor=sys.coreClassIds?.includes("scientist");context.trailblazer=sys.coreClassIds?.includes("scout");

    // Training
    context.proficiencies = Object.entries(cfg.proficiencies).map(([k, p]) => ({
      key: k, label: p.label, ...(sys.proficiencyTotals ?? sys.proficiencies)[k], hint: sys.proficiencyPicks?.hints?.[k]
    }));
    context.focusGroups = ["cultures", "drive", "science"].map(skill => ({
      skill, label: cfg.skills[skill].name, picks: sys.focusPicks?.[skill],
      options: cfg.focuses[skill].map(name => ({ name, checked: (sys.focusTotals?.[skill] ?? sys.focuses[skill]).includes(name), granted: sys.forcedFocuses?.[skill]?.includes(name) }))
    }));
    context.professionText = sys.focuses.profession.join("\n");
    context.forteSkills = {cultures:"Cultures",drive:"Drive",profession:"Profession",science:"Science"};
    context.crossroadsTitles = Object.fromEntries(Object.entries(cfg.tables.crossroads).map(([key,value])=>[key,value.label]));
    context.fortesText = sys.focuses.fortes.join("\n");
    context.hasContactFeatUpgrades=!!sys.contactFeatBindings?.length||sys.contacts.some(c=>c.networkingFeat||c.networkingMilestone);
    context.contactFeatOptions=Object.fromEntries([['','No contact feat'],...(sys.contactFeatBindings??[]).map(b=>[b.name,b.name]),...sys.contacts.filter(c=>c.networkingFeat&&!sys.contactFeatBindings?.some(b=>b.name===c.networkingFeat)).map(c=>[c.networkingFeat,c.networkingFeat+' — source unavailable'])]);
    const contactMilestones=new Set(Array.from({length:Math.floor((sys.skillTotals?.networking?.purchasedRanks??0)/4)},(_,i)=>(i+1)*4));
    for(const c of sys.contacts)if(c.networkingMilestone)contactMilestones.add(c.networkingMilestone);
    context.contactMilestones=Object.fromEntries([['0','No Networking feat upgrade'],...[...contactMilestones].sort((a,b)=>a-b).map(n=>[n,'Networking '+n+' purchased ranks'])]);
    context.contactGrades = Object.fromEntries(cfg.tables.contacts.map(c => [c.rank, `${c.rank} — ${c.grade}`]));

    // Gear
    context.weapons = byType("weapon").map(w => ({ item: w, canResistDisarm:!sys.disarmWeapons?.blockedReason&&sys.disarmWeapons?.weapons?.some(source=>source.id===w.id)===true, ammoConfiguration:ammunitionConfiguration(w.system), canPlanAmmunition:compatibleAmmunition(w.system,CONFIG.SPYCRAFT.tables?.ammunitionCatalog??[]).length>0, attack: actor.weaponAttack(w), caliber: cfg.calibers[w.system.caliber] }));
    context.armor = byType("armor").map(a => ({ item: a, caliber: cfg.calibers[a.system.caliber] }));
    context.safeHouseSource=safeHouseSource(sys);context.safeHouses=safeHouseRows(sys,cfg);
    context.careerAgentReward={active:sys.activeFeatNames?.includes('Career Agent'),record:sys.careerAgentRewards?.[careerAgentMissionKey(sys)],review:getCareerAgentReview(this.actor)};
    context.wellFundedActive=sys.activeFeatNames?.includes('Well-Funded');context.wellFundedCash=wellFundedCashHistory(sys);
    context.toolShedSource=toolShedSource(sys);
    context.gear = byType("gear").map(g => ({ item: g, caliber: cfg.calibers[g.system.caliber],toolShed:toolShedKitState(sys,g) }));
    context.gearPicks = Object.entries(sys.gearPicks ?? {}).map(([k, v]) => ({ key: k, label: cfg.gearPicks[k], ...v }));
    context.pickOptions = Object.fromEntries([["", "—"], ...Object.entries(cfg.gearPicks).map(([k]) => [k, k])]);

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.biography, { secrets: actor.isOwner, rollData });
    return context;
  }

  /** Remember which header panels the player has opened or closed. */
  _onRender(context, options) {
    super._onRender(context, options);
    enhanceAgentSheet(this.element, context, this, text => game.i18n.localize(text));
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
    const rows = { contacts: sys.contacts.map(r => ({ ...r })), subplots: sys.subplots.map(r => ({ ...r })), skillFortes: (sys.skillFortes ?? []).map(r => ({ ...r })) };
    const changed = new Set();
    const careerRequests=[];
    const itemUpdates = {};
    const skillIdx = Math.clamp(this._skillLevel ?? sys.level, 1, Math.max(1, sys.level)) - 1;

    for (const [k, v] of Object.entries(flat)) {
      let m;
      if ((m = k.match(/^progression\.(\d+)\.vitality$/))) {
        // Raw vitality is recorded through its source/audit control, not a plain form edit.
      } else if ((m = k.match(/^progression\.(\d+)\.intelligenceModifier$/))) {
        const value=v === "" || v == null ? null : Number(v);
        careerRequests.push({index:Number(m[1]),field:"intelligenceModifier",value});
        if (progression[m[1]]) progression[m[1]].intelligenceModifier=value;
        changed.add("progression");
      } else if ((m = k.match(/^system\.skills\.(\w+)\.classSkill$/))) {
        if (v && !sys.skills?.[m[1]]?.classSkill) flat[`system.skills.${m[1]}.classSkillAt`] = skillIdx + 1;
        continue;
      } else if ((m = k.match(/^skillpts\.(\w+)$/))) {
        if (progression[skillIdx]) {
          const n = v === "" || v == null ? 0 : Number(v);
          careerRequests.push({index:skillIdx,field:"skill",key:m[1],value:n});
          if (n) progression[skillIdx].skills[m[1]] = n;
          else delete progression[skillIdx].skills[m[1]];
        }
        changed.add("progression");
      } else if ((m = k.match(/^inheritedChoice\.(\w+)\.(\w+)\.(option|skill)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.inheritedChoices.${m[2]}.${m[3]}`] = m[3]==="option"?(v===""||v==null?null:Number(v)):v;
      } else if ((m = k.match(/^specialistChoice\.(\w+)\.(\d+)\.(mode|proficiency)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.weaponSpecialist.${m[2]}.${m[3]}`] = v;
      } else if ((m = k.match(/^classSkillChoice\.(\w+)\.(\w+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.skillChoices.${m[2]}`] = v;
      } else if ((m = k.match(/^classField\.(\w+)\.(\w+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.${m[2]}`] = v;
      } else if ((m = k.match(/^originChoice\.(\w+)\.(\w+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.originChoices.${m[2]}`] = v;
      } else if ((m = k.match(/^choice\.(\w+)\.(\d+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.choices.${m[2]}`] = v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      } else if ((m = k.match(/^(contacts|subplots|skillFortes)\.(\d+)\.(\w+)$/))) {
        if (rows[m[1]][m[2]]) rows[m[1]][m[2]][m[3]] = v;
        changed.add(m[1]);
      } else if (k === "system.startingIntelligenceModifier") {
        flat[k] = v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
        continue;
      } else if (k === "professionText" || k === "fortesText") {
        flat[`system.focuses.${k === "professionText" ? "profession" : "fortes"}`] =
          String(v).split(/\n+/).map(s => s.trim()).filter(Boolean);
      } else continue;
      delete flat[k];
    }
    this._pendingCareerForm=changed.has("progression")?careerFormPlan(sys.progression,careerRequests):null;
    if (changed.has("progression")) flat["system.progression"] = progression;
    for (const key of ["contacts", "subplots", "skillFortes"]) if (changed.has(key)) flat[`system.${key}`] = rows[key];
    this._pendingItemUpdates = itemUpdates;
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  async _processSubmitData(event, form, submitData, options) {
    const itemUpdates = Object.entries(this._pendingItemUpdates ?? {}).map(([_id, u]) => ({ _id, ...u }));
    this._pendingItemUpdates = null;
    const careerPlan=this._pendingCareerForm;this._pendingCareerForm=null;
    if(Object.hasOwn(submitData,"system.progression")&&!careerPlan)throw new Error("Use the career form controls to edit progression.");
    if(careerPlan&&!careerPlan.edits.length)delete submitData["system.progression"];
    const resources=['system.actionDice.value','system.vitality.value','system.wounds.value','system.reputation','system.netWorth','system.xp'];
    const edited=event?.target?.name;
    // A full auto-submit includes stale resource inputs. Only an explicitly edited resource may overwrite its value.
    for(const path of resources)if(path!==edited){delete submitData[path];const keys=path.split('.');let parent=submitData;for(const key of keys.slice(0,-1))parent=parent?.[key];if(parent)delete parent[keys.at(-1)];}
    if(this.actor.system?.focusPicks?.generic.reservedAvailable){
      const system=foundry.utils.mergeObject(this.actor.system.toObject(),foundry.utils.expandObject(submitData).system??{}, {inplace:false});system.usagePeriods=this.actor.usagePeriods;Object.assign(system,this.actor.attributeRuleContext);
      computeAgent(system,this.actor.items.map(i=>({id:i.id,name:i.name,type:i.type,system:i.system})),CONFIG.SPYCRAFT);
      if(system.focusPicks.generic.unscopedRemaining<Math.min(0,this.actor.system.focusPicks.generic.unscopedRemaining)){this.render();return ui.notifications.warn("Use each temporary Depth of Study source to spend its reserved focus/forte picks.");}
    }
    const save=async()=>{
      if(careerPlan?.edits.length){if(this.actor.isOwner!==true)throw new Error("You must own the character before editing its career.");mergeCareerForm(this.actor.system.progression,careerPlan);}
      if(itemUpdates.length)await this.actor.updateEmbeddedDocuments("Item",itemUpdates);
      if(careerPlan?.edits.length)submitData["system.progression"]=mergeCareerForm(this.actor.system.progression,careerPlan);
      return super._processSubmitData(event,form,submitData,options);
    };
    return resources.includes(edited)||careerPlan?.edits.length?queueResources([this.actor],save):save();
  }

  /** Dropping a class adds a level; origins replace the existing talent/specialty. */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;
    if (item.parent === this.actor) return super._onDropItem(event, item);
    if (item.type === "class") return this.actor.addClassLevel(item);
    if (item.type === "feat") {
      if (!item.system.repeatable && this.actor.items.some(i => i.type === "feat" && i.name.trim().toLowerCase() === item.name.trim().toLowerCase())) {
        return ui.notifications.warn(`${item.name} may only be selected once.`);
      }
      const data = item.toObject?.() ?? foundry.utils.deepClone(item);
      delete data._id;
      data.system.acquiredAtLevel = Math.max(1, this.actor.system.level ?? 1);
      return this.actor.createEmbeddedDocuments("Item", [data]);
    }
    if (item.type === "origin") {
      const old = this.actor.items.filter(i => i.type === "origin" && i.system.originType === item.system.originType);
      if (old.length) await this.actor.deleteEmbeddedDocuments("Item", old.map(i => i.id));
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

  static #onRollAbility(event, target) { return this.actor.rollAbility(target.dataset.ability); }
  static #onRollSave(event, target) { return this.actor.rollSave(target.dataset.save,{askContext:true}); }
  static #onRollSkill(event, target) { return this.actor.rollSkill(target.dataset.skill, target.dataset.ability || null); }
  static #onRollAttack(event, target) { return this.actor.rollAttack(this._item(target),{askContext:true}); }
  static #onRollDamage(event, target) { return this.actor.rollDamage(this._item(target)); }
  static #onRollInitiative() { return this.actor.rollInitiative({ createCombatants: true }); }
  static #onRollVitality(event,target) {return this.actor.rollVitality(Number(target.dataset.index));}
  /** Jump from a to-do entry to the tab where it gets resolved. */
  static async #onTodo(event, target) {
    const { tab, skillLevel } = target.dataset;
    if (skillLevel) this._skillLevel = Number(skillLevel);
    this.changeTab(tab, "primary");
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
  static #onSpendActionDie() { return this.actor.rollActionDie(); }
  static #onAddLevel() { return new SpycraftBrowser({ actor: this.actor, itemType: "class" }).render(true); }
  static async #onRemoveLevel() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SPYCRAFT.Class.RemoveLevel") },
      content: `<p>${game.i18n.localize("SPYCRAFT.Class.RemoveLevelConfirm")}</p>`
    });
    if (ok) return this.actor.removeLastLevel();
  }
  static #onBrowse(event, target) {
    return new SpycraftBrowser({ actor: this.actor, itemType: target.dataset.type, originType: target.dataset.originType }).render(true);
  }
  static #onItemEdit(event, target) { return this._item(target)?.sheet.render(true); }
  static async #onItemDelete(event, target) { return this._item(target)?.deleteDialog(); }
  static #onItemChat(event, target) { return this._item(target)?.toChat(); }
  static #onItemEquip(event, target) {
    const item = this._item(target);
    if (!item) return;
    if (item.type === "armor" && !item.system.equipped) {
      // Toggle all suits in one embedded-document update, so never count two.
      return this.actor.updateEmbeddedDocuments("Item", [
        ...this.actor.items.filter(i => i.type === "armor" && i.system.equipped && (armorSlot(i) === armorSlot(item) || (item.system.sealed && armorSlot(i) === "helmet") || (armorSlot(item) === "helmet" && i.system.sealed)))
          .map(i => ({ _id: i.id, "system.equipped": false })),
        { _id: item.id, "system.equipped": true }
      ]);
    }
    return item.update({ "system.equipped": !item.system.equipped });
  }
  static #onCreateItem(event, target) {
    const type = target.dataset.type;
    return this.actor.createEmbeddedDocuments("Item", [{ name: game.i18n.format("DOCUMENT.New", { type: game.i18n.localize(`TYPES.Item.${type}`) }), type }]);
  }
  static #onToggleFocus(event, target) {
    const { skill, value } = target.dataset;
    const aliases = CONFIG.SPYCRAFT.tables.focusAliases ?? {};
    const list = new Set(this.actor.system.focuses[skill].map(value=>aliases[value] ?? value));
    if (list.has(value)) list.delete(value); else {
      const picks=this.actor.system.focusPicks;
      if(picks.generic.reservedAvailable&&picks[skill].remaining<=0&&picks.generic.unscopedRemaining<=0){this.render();return ui.notifications.warn("Use the temporary Depth of Study control on Training to spend its source-scoped picks.");}
      list.add(value);
    }
    return this.actor.update({ [`system.focuses.${skill}`]: [...list] });
  }
  static #onAddRow(event, target) {
    const key = target.dataset.list;
    const row = key === "contacts" ? { name: "", rank: 1, notes: "" } : key === "skillFortes" ? {skill:"drive",focus:"",forte:""} : { name: "", notes: "", complete: false };
    return this.actor.update({ [`system.${key}`]: [...(this.actor.system[key] ?? []).map(r => ({ ...r })), row] });
  }
  static #onRemoveRow(event, target) {
    const key = target.dataset.list;
    const rows = this.actor.system[key].map(r => ({ ...r }));
    rows.splice(Number(target.dataset.index), 1);
    return this.actor.update({ [`system.${key}`]: rows });
  }
  static #onSkillLevel(event, target) {
    this._skillLevel = Number(target.dataset.level);
    return this.render({ parts: ["skills"] });
  }
  static #onSyncGrants() { return this.actor.syncGrantedFeats(); }
}

/* -------------------------------------------------------------------------- */
/*  NPC sheet (simple stat block)                                             */
/* -------------------------------------------------------------------------- */

export class SpycraftNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "npc"],
    position: { width: 800, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      applyShaken(){return this.actor.applyShaken();},
      reviewShakenApplication(){return this.actor.reviewShakenApplication();},
      editShakenSource(event,target){return this.actor.editShakenSource(target.dataset.sourceUuid);},
      reviewShakenInitiative(event,target){return this.actor.reviewShakenInitiative(target.dataset.combatId,target.dataset.combatantId);},
      applyBaffled(){return this.actor.applyBaffled();},
      reviewBaffledApplication(){return this.actor.reviewBaffledApplication();},
      setNpcSkillCondition(event,target){return this.actor.setReviewedCondition(target.dataset.condition);},
      rollNpcSkill(){return rollNpcSkill(this.actor);},
      npcDamageSave(){return npcDamageSave(this.actor);},
      async resetDamageTrack(){await resetDamageTrack(this.actor);this.render();},
      manageDisposition(){return manageDisposition(this.actor);},
      async endPromotion(){await this.actor.update({'system.promotion':null});},
      npcEnable: SpycraftNpcSheet.#onEnable,
      npcAddSkill: SpycraftNpcSheet.#onAddSkill,
      npcAddQuality: SpycraftNpcSheet.#onAddQuality,
      npcAddPick: SpycraftNpcSheet.#onAddPick,
      npcRemoveRow: SpycraftNpcSheet.#onRemoveRow,
      manageCheapShots(){return this.actor.manageCheapShots();},
      rollAbility: SpycraftNpcSheet.#onRollAbility,
      rollSave: SpycraftNpcSheet.#onRollSave,
      rollAttack: SpycraftNpcSheet.#onRollAttack,
      rollDamage: SpycraftNpcSheet.#onRollDamage,
      itemEdit: SpycraftNpcSheet.#onItemEdit,
      itemDelete: SpycraftNpcSheet.#onItemDelete
    }
  };

  static PARTS = { main: { template: `${TPL}/npc-sheet.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.actor.system;
    Object.assign(context, {
      actor: this.actor, system: sys, shakenInitiativeReviews:this.actor.shakenInitiativeReviews, isGM:game.user.isGM, config: CONFIG.SPYCRAFT, editable: this.isEditable,
      abilities: Object.entries(CONFIG.SPYCRAFT.abilities).map(([key, label]) => ({ key, label: game.i18n.localize(label), ...sys.abilities[key] })),
      saves: Object.entries(CONFIG.SPYCRAFT.saves).map(([key, s]) => ({ key, label: game.i18n.localize(s.label), ...sys.saves[key] })),
      weapons: this.actor.items.filter(i => i.type === "weapon").map(w => ({ item: w, ammoConfiguration:ammunitionConfiguration(w.system), canPlanAmmunition:compatibleAmmunition(w.system,CONFIG.SPYCRAFT.tables?.ammunitionCatalog??[]).length>0, attack: this.actor.weaponAttack(w) })),
      otherItems: this.actor.items.filter(i => i.type !== "weapon"&&!isResourceLock(i)),
      npcTypes: { standard: "Standard", special: "Special", villain: "Villain (legacy special)", animal: "Animal" },
      npc: this._npcContext(),
      manualRoles: {'': 'None', minion: 'Minion', henchman: 'Henchman', mastermind: 'Mastermind'},
      gcPlay: {damage: damageSaveState(this.actor), special: npcIsSpecial(this.actor), dispositions: dispositionRows(this.actor), baseDisposition: sys.disposition?.base ?? 'neutral'},
      enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.biography, { secrets: this.actor.isOwner })
    });
    return context;
  }

  _npcContext() {
    const sys = this.actor.system, profile = sys.npcProfile ?? defaultNpcProfile();
    const result = conditionNpcProfile(computeNpcProfile(profile, sys.npcType, sys.effectiveThreatLevel ?? sys.threatLevel, sys.abilities),npcSkillConditionContext(this.actor));
    const gradeOptions = Object.fromEntries(NPC_RULES.grades.map((g, i) => [i + 1, g]));
    const skillOptions = Object.fromEntries(Object.entries(CONFIG.SPYCRAFT.skills).map(([k, v]) => [k, v.name]));
    return { profile, result, gradeOptions, wealthOptions: {0:"None", ...gradeOptions},
      tierOptions: Object.fromEntries(NPC_RULES.tiers.map(t => [t.tier, `${NPC_RULES.grades[t.tier - 1]} (${t.offset >= 0 ? "+" : ""}${t.offset} TL)`])),
      caliberOptions: Object.fromEntries(NPC_RULES.grades.slice(0, 5).map((g, i) => [i + 1, g])), skillOptions,
      grades: Object.entries(NPC_STATS).filter(([key]) => !(result.type === "animal" && ["competence", "wealth"].includes(key))).map(([key, label]) => ({key, label: key === "health" ? result.type === "special" ? "Vitality / wounds" : "Damage save" : label, value: profile.grades[key], options: key === "wealth" ? {0:"None",...gradeOptions} : gradeOptions})),
      skills: profile.skills.map((s, index) => ({...s,index, resolved:result.skills?.[index]})),
      equipment: NPC_CATEGORIES.map(category => ({category, picks: (profile.equipment[category] ?? []).map((caliber, index) => ({caliber,index,category}))})),
      qualityOptions: Object.fromEntries(NPC_RULES.qualities.filter(q => q.types.includes(result.type) && q.mode !== "dedicated").map(q => [q.id, `${q.name} (${q.costLabel})`])),
      qualities: profile.qualities.map((q, index) => {const rule=NPC_RULES.qualities.find(r=>r.id===q.id);return {...q,index,rule,classLevel:rule?.mode==="classLevel",decision:rule?.mode==="decision",linked:rule?.mode==="linked",movement:rule?.mode==="movement",caliberCost:rule?.mode==="caliber"};}),
      referenceTables: Object.entries(NPC_RULES.tables).map(([key, rows]) => ({label:key,rows:rows.map((values,i)=>({grade:NPC_RULES.grades[i],values:values.map(v=>Array.isArray(v)?v.join("/"):v)}))})),
      levels:Array.from({length:20},(_,i)=>i+1),catalog:NPC_RULES.qualities,source:NPC_RULES.source,
      special: result.type === "special",animal:result.type === "animal"
    };
  }

  _prepareSubmitData(event, form, formData, updateData) {
    const flat=formData.object, profile=structuredClone(this.actor.system.npcProfile ?? defaultNpcProfile());
    const changed=new Set();
    for(const [key,value] of Object.entries(flat)) {
      let m;
      if((m=key.match(/^npcSkill\.(\d+)\.(key|grade)$/))) {
        if(profile.skills[m[1]])profile.skills[m[1]][m[2]]=m[2]==="grade"?Number(value):value;
        changed.add("skills");
      } else if((m=key.match(/^npcQuality\.(\d+)\.(id|units|details|level|modifier|linkedCost|limited|caliber)$/))) {
        if(profile.qualities[m[1]])profile.qualities[m[1]][m[2]]=["id","details"].includes(m[2])?value:m[2]==="limited"?!!value:Number(value);
        changed.add("qualities");
      } else if((m=key.match(/^npcPick\.(weapons|gear|vehicles)\.(\d+)$/))) {
        if(profile.equipment[m[1]])profile.equipment[m[1]][m[2]]=Number(value);
        changed.add("equipment");
      } else continue;
      delete flat[key];
    }
    for(const key of changed)flat[`system.npcProfile.${key}`]=profile[key];
    return super._prepareSubmitData(event,form,formData,updateData);
  }

  static #onEnable() {
    if(!this.isEditable)return;
    return this.actor.update({"system.npcProfile.enabled":!this.actor.system.npcProfile?.enabled});
  }
  static #onAddSkill() {
    if(!this.isEditable)return;
    const rows=structuredClone(this.actor.system.npcProfile.skills);
    const key=Object.keys(CONFIG.SPYCRAFT.skills).find(key=>!rows.some(s=>s.key===key));
    if(key)rows.push({key,grade:1});
    return this.actor.update({"system.npcProfile.skills":rows});
  }
  static #onAddQuality() {
    if(!this.isEditable)return;
    return this.actor.update({"system.npcProfile.qualities":[...structuredClone(this.actor.system.npcProfile.qualities),{id:"all-thumbs",units:1,details:"",level:1,modifier:0,linkedCost:1,limited:false,caliber:1}]});
  }
  static #onAddPick(event,target) {
    if(!this.isEditable || !NPC_CATEGORIES.includes(target.dataset.category))return;
    const equipment=structuredClone(this.actor.system.npcProfile.equipment);equipment[target.dataset.category].push(1);
    return this.actor.update({"system.npcProfile.equipment":equipment});
  }
  static #onRemoveRow(event,target) {
    if(!this.isEditable)return;
    const {list,index,category}=target.dataset;
    if(!["skills","qualities","equipment"].includes(list))return;
    const rows=structuredClone(this.actor.system.npcProfile[list]);
    const array=list==="equipment"?rows[category]:rows;
    if(!Array.isArray(array))return;
    array.splice(Number(index),1);
    return this.actor.update({[`system.npcProfile.${list}`]:rows});
  }

  _item(target) { return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId); }
  static #onRollAbility(event, target) { return this.actor.rollAbility(target.dataset.ability); }
  static #onRollSave(event, target) { return this.actor.rollSave(target.dataset.save,{askContext:true}); }
  static #onRollAttack(event, target) { return this.actor.rollAttack(this._item(target),{askContext:true}); }
  static #onRollDamage(event, target) { return this.actor.rollDamage(this._item(target)); }
  static #onItemEdit(event, target) { return this._item(target)?.sheet.render(true); }
  static #onItemDelete(event, target) { return this._item(target)?.deleteDialog(); }
}
