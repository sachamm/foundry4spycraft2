import {systemDialog} from '../apps/dialog-theme.mjs';
import {rollPipeline} from '../rolls/index.mjs';
import {formulaWithModifiers} from '../rules/roll-pipeline.mjs';
import {missionSettlementDefaults} from "../apps/gc/mission-defaults.mjs";
import {enhanceSkillDialog} from "../apps/skill-dialog-ux.mjs";
import {reachIncreaseFeet} from '../rules/reach.mjs';
import {reachContextContent,reachContextInput} from '../apps/reach.mjs';
import {fendTiming} from '../rules/fend.mjs';
import {whirlingAttackProof} from '../apps/whirling-stance.mjs';
import {validateTripCounterIntent} from '../apps/counter-trip.mjs';
import {tripAttackContent,tripAttackTargetInput} from '../apps/trip-attack.mjs';
import {manageTakedown,rollTakedown,settleTakedown} from '../apps/takedown.mjs';
import {grantedMeleeQuality,meleeTrickSourceFacts} from '../rules/melee-tricks.mjs';
import {manageMeleeTradeoff} from '../apps/melee-tradeoff-outcomes.mjs';
import {eligibleAttackDamageHits,makeAttackDamageProof} from '../apps/attack-damage-benefits.mjs';
import {grippingAttackProof} from '../rules/gripping-stance.mjs';
import {eligibleSideStanceHits,makeSideStanceDamageProof} from '../apps/side-stance-damage.mjs';
import {combatStanceProof,combatStanceState} from '../rules/combat-stance.mjs';
import {endCombatStance} from '../apps/combat-stance.mjs';
import {missTrickSourceFacts} from '../rules/miss-tricks.mjs';
import {validateCheapShotTarget} from '../apps/cheap-shot.mjs';
import {manageCheapShots,settleCheapShot,rollCheapShotRecovery,settleCheapShotRecovery} from '../apps/cheap-shot-effects.mjs';
import {conveyanceBullRushContent} from '../apps/conveyance-bull-rush.mjs';
import {bullRushAttackContent} from '../apps/bull-rush-attack.mjs';
import {bullRushDefenseContent} from '../apps/bull-rush.mjs';
import {stillStandingSaveContent} from '../apps/still-standing.mjs';
import {stillStandingTakedownPlan} from '../rules/still-standing.mjs';
import {tumblePathContent} from '../apps/tumble.mjs';
import {feintContent,feintTargetInput} from '../apps/feint.mjs';
import {tripDefenseContent,tripDefenseTargetInput} from '../apps/trip.mjs';
import {fallDistanceContent} from '../apps/fall-distance.mjs';
import {balanceSurfaceContent} from '../apps/balance.mjs';
import {hideCircumstanceContent} from '../apps/hide-circumstances.mjs';
import {detectionObserverContext,detectionObserverContent} from '../apps/detection-observer.mjs';
import {attributeDamageEvidence,validateAttributeDamageProof} from '../rules/attribute-damage.mjs';
import {targetSkillContext,targetSkillEffectContent} from '../apps/target-skill-effects.mjs';
import {stoneColdSavePlan} from '../rules/stone-cold.mjs';
import {withJinxReservation} from '../apps/jinx.mjs';
import {jinxCostPlan} from '../rules/jinx.mjs';
import {useMark,discloseMark,correctMark} from '../apps/mark.mjs';
import {oldSchoolContext} from '../apps/old-school.mjs';
import {oneHandManeuverUseProof} from '../rules/maneuver-actions.mjs';
import {useSafeHouse,placeSafeHouse,correctSafeHouseRecord} from '../apps/safe-house.mjs';
import {useCareerAgentReward,reviewCareerAgentReward} from '../apps/career-agent.mjs';
import {useWellFunded} from '../apps/well-funded.mjs';
import {useToolShed} from '../apps/tool-shed.mjs';
import {improvisedSearchPlan,improvisedMasterySpec,IMPROVISED_WEAPON_ROWS} from '../rules/improvised-weapons.mjs';
import {featFreeActionPlan,FREE_ACTION_FEATS,QUICK_DRAW_ACTIONS} from '../rules/feat-free-actions.mjs';
import {characterTargetContent,completeCharacterTarget,validateCharacterTarget,cleaveTargetRequired,attackCharacterTargetChoices,observedAttackTargetContent} from '../apps/character-target.mjs';
import {cleaveLegacyTargetEligible} from '../rules/cleave.mjs';
import {FINAL_ATTACK_WORKFLOWS,withFinalRoundReservation,validateFinalRoundReservation} from '../rules/final-round.mjs';
import {dartingStyleState} from '../rules/darting-state.mjs';
import {superiorCoverState} from '../rules/superior-cover.mjs';
import {rollCareerVitality,reviewCareerVitality} from '../apps/vitality.mjs';
import {validateDamageSaveRoll} from '../rules/damage-saves.mjs';
import {saveCoverPlan} from '../rules/cover.mjs';
import {saveCoverContent} from '../apps/save-cover.mjs';
import {meleeTrickContent,meleeTrickInput,bullseyeContent,bullseyeInput,allOutAttackContent,allOutAttackInput,meleeFireContextContent,quickRangedAimContent,quickRangedAimInput,quickAttackActionContent,quickAttackActionInput} from '../apps/standard-attack-context.mjs';
import {cqbRangePlan,cqbRangedWeapon} from '../rules/cqb.mjs';
import {twoWeaponStyleState} from '../rules/two-weapon-state.mjs';
import {rollCriticalInjury,reviewCriticalInjury} from '../apps/critical-injuries.mjs';
import {damageTargetChoices,resolveDamageTarget,sneakAttackTargetSnapshot} from '../apps/damage-target.mjs';
import {mixedHealingFundingControl,mixedHealingFundingInput,healFromMultipleSources} from '../apps/healing-payments.mjs';
import {applyShaken,reviewShakenApplication} from '../apps/shaken-application.mjs';
import {shakenInitiativeReviews,reviewShakenInitiative,changeInitiativeCountPreservingShaken} from '../apps/shaken-initiative.mjs';
import {actionDieBenefitQuote} from '../rules/benefit-payments.mjs';
import {payActionDieBenefitLocked,surchargeFundingControl,surchargeFundingInput,splitSurchargeFundingControl,unrolledPaymentFundingControl,unrolledPaymentFundingInput} from '../apps/action-die-benefits.mjs';
import {boostPaymentQuote,paidBoostSurcharge,generousSurchargeQuote} from '../rules/boost-payments.mjs';
import {applyPaidCheckBoost} from '../apps/paid-check-boost.mjs';
import {getActionDieSettlementReview,setPendingActionDieReview,clearPendingActionDieReview,multipartRefundPatch,paymentRecordMatches} from '../rules/action-die-payments.mjs';
import {payMultipartActionDiceLocked,reviewMultipartActionDice,markMultipartActionDieReview} from '../apps/action-die-payments.mjs';
import {shakenRules,getShakenApplicationReview,shakenSourceEntries} from '../rules/shaken.mjs';
import {applyRestraintEscape,reviewRestraintRelease,confirmRestraintEscapeMove} from '../apps/restraint-release.mjs';
import {restraintActionBlock,restraintSourceSnapshot} from '../rules/restraints.mjs';
import {reviewReserveTransaction} from '../apps/reserve-review.mjs';
import {applyBaffled,reviewBaffledApplication} from '../apps/baffled-application.mjs';
import {getBaffledReview} from '../rules/baffled.mjs';
import {adrenalineSource,woundEventKey,recordedWoundEvent,adrenalineWoundPlan} from '../rules/adrenaline.mjs';
import {strutGainPlan,strutPool} from '../rules/strut.mjs';
import {startingDiceEntryPlan} from '../rules/starting-dice.mjs';
import {drunkRepositionPlan,freezeDrunkReposition,drunkRepositionCompletion,drunkTokenMovementPlan} from '../rules/condition-movement.mjs';
import {fatigueApplicationPlan,fatigueStateSignature,fatigueRestRecord,fatigueRestCompletionPlan} from '../rules/fatigue.mjs';
import {setConditionStatus} from '../rules/condition-status.mjs';
import {uncannyDodgePlan,initiativeLossPlan,evasionPlan,evasionSaveContext} from '../rules/defense.mjs';
import {mentalLeapSource,mentalLeapRecord,endMentalLeapPlan,detachMentalLeapPlan,mentalLeapFatigueEvent,unconsciousSleepPlan,unconsciousSleepCompletionPlan} from "../rules/mental-leap.mjs";
import {sleepingSourceSnapshot,sleepWakePlan} from '../rules/sleeping.mjs';
import {attributeCollapsePlan,wisdomCollapseEpisode,attributeActionBlock,conditionRollPenalties,conditionAbilityPenalty} from "../rules/attributes.mjs";
import {assistantSource,assistantSummonPlan,assistantGroupStatus,assistantWithdrawalPlan,sceneSequence} from "../rules/summoned-assistants.mjs";
import {deferredSkillPools,deferredSkillPlan,deferredSkillDeadline} from "../rules/deferred-skills.mjs";
import {temporaryFocusPlan} from "../rules/training.mjs";
import {resolveFeatChoices} from '../rules/feats.mjs';
import {underwaterCheckPlan} from '../rules/environment.mjs';
import {unnervingGrade,unnervingEligible,unnervingPlan} from '../rules/unnerving.mjs';
import {hasFinalDeduction,finalDeductionStudy,finalDeductionPlan} from '../rules/final-deduction.mjs';
import {globalSearchSource,globalSearchPlan} from '../rules/global-search.mjs';
import {littleDetailsSource} from '../rules/little-details.mjs';
import {TERRAIN_TYPES,LOCAL_HERO_OPPOSITION_SKILLS,terrainSavePlan} from '../rules/terrain.mjs';
import {TRACKING_SURFACES} from '../rules/tracking.mjs';
import {taskPressureUseProof} from '../rules/task-pressure.mjs';
import {validateAnalysisTaskRoll} from '../rules/analysis-tasks.mjs';
import {manageAnalysisTasks,createAnalysisTask,expireAnalysisTask,settleAnalysisTask,reviewAnalysisTaskSettlement,prepareAnalysisTaskPressure,applyAnalysisTaskPressureStress} from '../apps/analysis-tasks.mjs';
import {hasSneakAttackSource,sneakAttackDamagePlan} from '../rules/sneak-attack.mjs';
import {gameHunterAttack} from '../rules/class-checks.mjs';
import {AMBIENT_LIGHT,FOG_SMOKE} from '../rules/senses.mjs';
import {eagleEyeDiePlan,eagleEyeRecord,millionDollarSkillPlan} from '../rules/sniper.mjs';
import {breakthroughPlan,nestPlan} from '../rules/breakthrough.mjs';
import {brightIdeaPoolStatus,brightIdeaMigrationPlan,brightIdeaLegacyReviewSpec} from '../rules/bright-idea.mjs';
import {hintSources,hintResponsePlan} from '../rules/hints.mjs';
import {actionDiceFundingContext,actionDicePaymentPlan,actionDicePaymentRefund,actionDicePoolFingerprint,unrestrictedBonusPools,masterPlanGainPlan,masterPlanPool,difficultSkillBonusPlan,checkBonusPool,bonusPoolForCheck,checkBonusBoostPlan,availableCheckBonusPools,hardKnocksGainPlan,transferableCheckBonusPool} from '../rules/bonus-pools.mjs';
import {improvisationPlan} from '../rules/class-gear.mjs';
import {missionCaliberOptions,missionCaliberPlan} from "../rules/mission-gear.mjs";
import {oneInAMillionEligible,masterThiefPlan,automaticSkillSuccessSources,automaticSkillSuccessPlan,manualAdjustmentPlan,tenSecondSolutionEligible,cunningPlanEffect,cunningPlanCheck} from "../rules/class-checks.mjs";
import {queueResources,isResourceLock,recoverResourceTransaction,RULE_RESOURCE_LOCK_ID} from "../rules/transactions.mjs";
import {FIRE_MODES,bracedReflexPenalty} from "../rules/firearms.mjs";
import {allocateMissionReserves,rollGearAcquisition,finishGearAcquisition,claimGearAcquisition} from "../apps/gear-acquisition.mjs";
import {gcDiceStatus,spendGCDice,gcDiceController,refreshGCDiceTransaction,withGCDicePool} from "../rules/gc-dice.mjs";
import {criticalPlan} from "../rules/criticals.mjs";
import {checkCandidates,errorDecisionPending,adjudicateCheck,checkFlavor,rollEvidence} from "../rules/outcomes.mjs";
import {healingPlan,healingResult,defenseBoostPlan,refreshPlan,fortunesOfWarPlan,noFearPlan} from "../rules/health.mjs";
import {specialistApplies} from "../rules/weapon-specialist.mjs";
import {SHARE_ABILITIES,temporarySharePlan,renaissanceManPlan,intelTemporaryFeatSource,intelTemporaryFeatPlan,anyTimeAnyPlaceSource,anyTimeAnyPlacePlan,knowItAllSource,knowItAllChoiceOptions,knowItAllPlan,everydayGeniusSource,everydayGeniusPlan} from "../rules/temporary-feats.mjs";
import {resourceStatus,resourceUsePlan,resourceCounterReviewPlan,resourceCounterRestorePatch,rerollEligibility} from "../rules/limited-uses.mjs";
import {actionDieBoostPlan,actionDieBoostResult,generousBoostPlan,pointmanLevel,actionDieAwardPlan,missionXPPlan} from "../rules/action-dice.mjs";
import {resolveKnowledgeCheck} from "../rules/knowledge.mjs";
import {featAcquisition,captureFeatAcquisition} from "../rules/feat-acquisition.mjs";
import {weaponAttack,weaponDamage,equipmentCategory,possessionUnavailable,cleanAndPolishedApplies,armorGrantPlan,bigStickPlan} from "../rules/gear.mjs";
import {resolveSkillResult} from "../rules/checks.mjs";
import {resolveSkillCheck} from "../rules/skills.mjs";
import {checkPrerequisites} from "../rules/prerequisites.mjs";
import {prerequisiteContext,computeAgent} from "../rules/engine.mjs";

const FEAT_PACK = "spycraft2.feats";

class LimitedUseCancelled extends Error {}

export class SpycraftActor extends Actor {
  /** @override */
  getRollData() {
    return this.system.getRollData?.() ?? { ...super.getRollData() };
  }

  /** Runtime resource mutexes must never become copied inventory or exported character data. */
  async _preCreate(data,options,user){
    if(await super._preCreate(data,options,user)===false)return false;
    const updates={};
    if(Array.isArray(data.items)){
      const items=data.items.filter(item=>!isResourceLock(item));
      if(items.length!==data.items.length){data.items=items;updates.items=items;}
    }
    if((data.type??this.type)==='agent'){
      const creation={id:foundry.utils.randomID(),session:String(this.usagePeriods.session??'initial'),at:game.time?.worldTime??0,claimed:false},flags={...(data.flags??this.flags??{}),spycraft2:{...(data.flags?.spycraft2??this.flags?.spycraft2??{}),startingDiceCreation:creation}};
      data.flags=flags;updates.flags=flags;
    }
    if(Object.keys(updates).length)this.updateSource(updates,{recursive:false});
  }

  toCompendium(pack,options={}){
    const data=super.toCompendium(pack,options);
    if(Array.isArray(data.items))data.items=data.items.filter(item=>!isResourceLock(item));
    return data;
  }

  /* -------------------------------------------- */
  /*  Rolls                                        */
  /* -------------------------------------------- */

  /**
   * Roll a d20 check and post it to chat with threat/error annotations.
   * @param {string} formula   e.g. "1d20 + @mod"
   * @param {object} data
   * @param {object} opts      { flavor, threat=20, error=1, cap }
   */
  async rollCheck(formula, data, options = {}) {
    let { flavor = "", threat = 20, error = 1, cap = null, rollMode, actionDiceAllowed = true, checkMethod = "roll", checkKind="check", ability="", skillKey="", checkId="", focus="", rerollResources=[], practiceMakesPerfect=false, criticalFailureCostIncrease=0, crossCheck=false, chooseTwice=false, choiceSource="Bright Idea", choiceResourceId="", weaponUuid="", weaponProficiency="", weaponQualities="", cleanAndPolished=false, gearUuid="", gearAttempt=null, attackContext=null, unarmed=false, improvised=false, cannotError=false, resultSource="", opponentResult=null, requiredBonusPoolId=null } = options;
    const attributeDamage=attributeDamageEvidence(this.system,checkKind);
    if(Object.hasOwn(options,'attributeDamage'))validateAttributeDamageProof(this.system,options.attributeDamage,{checkKind});
    options={...options,attributeDamage};
    if(['skill','knowledge','attack'].includes(checkKind)&&dartingStyleState(this.system).needsReview)throw new Error(dartingStyleState(this.system).reason);
    if(['skill','knowledge','attack'].includes(checkKind)&&superiorCoverState(this.system).needsReview)throw new Error(superiorCoverState(this.system).reason);
    if(['skill','knowledge','attack'].includes(checkKind)&&twoWeaponStyleState(this.system).needsReview)throw new Error(twoWeaponStyleState(this.system).reason);
    const conditionDamagePenalty=checkKind==='damage'?(options.conditionDamagePenalty??conditionRollPenalties(this.system).damage):0;
    if(conditionDamagePenalty&&!options.conditionDamageIncluded&&!options.drivingStance)formula=`max(0, (${formula}) + (${conditionDamagePenalty}))`;
    if(checkKind==='save'&&checkMethod!=='roll'){
      if(checkMethod!=='take10'||checkId!=='ref'||!evasionPlan(this.system).canTake10||chooseTwice||options.oneInAMillion||options.tenSecondSolution||!/^1d20\b/.test(formula))throw new Error('Only Evasion III may take 10 on a Reflex save, without roll-choice or forced-20 abilities.');
      formula=formula.replace(/^1d20\b/,'10');actionDiceAllowed=false;resultSource='evasion';
    }
    if(checkKind==='skill'&&skillKey==='search'&&checkMethod==='roll'&&(this.system.classLevels?.fieldAnalyst??0)>=8){
      if(rollMode==='blindroll'&&!game.user?.isGM)throw new Error('The GC resolves Eye for Detail for a secret or passive Search check.');
      chooseTwice=true;choiceSource='Eye for Detail';
    }
    const million=!!options.oneInAMillion,solution=!!options.tenSecondSolution,twenty=million||solution;
    let cunning=typeof options.cunningPlan==='object'?options.cunningPlan:null;
    if(options.cunningPlan===true){
      cunning=cunningPlanEffect(this.system,error);
      if(!options.cunningPlanCommitted){
        const extras=(options.additionalUses??[]).filter(s=>s.id!=='cunningPlan');
        if(!million&&!solution)return this.useLimitedAbility('cunningPlan',(status,payment)=>this.rollCheck(formula,data,{...options,preRollFunding:this.preRollPaymentReceipt(payment)??options.preRollFunding,cunningPlanCommitted:true}),{workflow:'cunningPlan',additionalCost:options.additionalCost??0,additionalBenefitCount:options.additionalBenefitCount??((options.additionalCost??0)>0?1:0),...surchargeFundingInput(options),...unrolledPaymentFundingInput(options),additionalUses:extras,bonusPoolId:options.bonusPoolId??''});
        options={...options,cunningPlanCommitted:true,additionalUses:[...extras,{id:'cunningPlan',workflow:'cunningPlan'}]};
      }
      error=cunning.error;
    }

    if(million&&solution)throw new Error('Choose one declared natural-20 ability.');
    if(solution&&!options.solutionCommitted){
      if(!tenSecondSolutionEligible(this.system,{...options,chooseTwice})||!/^1d20\b/.test(formula))throw new Error('10-Second Solution requires Scientist 14 and a standalone rolled Intelligence skill or Knowledge check, without another roll-choice ability.');
      if(rollMode==='blindroll'&&!game.user?.isGM)throw new Error('The GC resolves 10-Second Solution for a secret check.');
      return this.useLimitedAbility('tenSecondSolution',(status,payment)=>{
        if(!tenSecondSolutionEligible(this.system,{...options,chooseTwice}))throw new Error('10-Second Solution no longer qualifies for this check.');
        if(options.refreshPaidSkill)return options.refreshPaidSkill(payment,{solutionCommitted:true,millionCommitted:options.millionCommitted===true});
        return this.rollCheck(formula,data,{...options,preRollFunding:this.preRollPaymentReceipt(payment)??options.preRollFunding,solutionCommitted:true});
      },{workflow:'tenSecondSolution',additionalCost:options.additionalCost??0,additionalBenefitCount:options.additionalBenefitCount??((options.additionalCost??0)>0?1:0),...surchargeFundingInput(options),...unrolledPaymentFundingInput(options),additionalUses:options.additionalUses??[],bonusPoolId:options.bonusPoolId??''});
    }
    if(million&&!options.millionCommitted){
      if(!oneInAMillionEligible(this.system,{...options,chooseTwice})||!/^1d20\b/.test(formula))throw new Error('One in a Million requires Soldier 14 and a rolled attack, Fortitude save or Strength/Constitution skill check. It cannot combine with Bright Idea.');
      if(rollMode==='blindroll'&&!game.user?.isGM)throw new Error('The GC resolves One in a Million for a secret check.');
      return this.useLimitedAbility('oneInAMillion',(status,payment)=>{
        if(!oneInAMillionEligible(this.system,{...options,chooseTwice}))throw new Error('This check no longer qualifies for One in a Million.');
        if(options.refreshPaidSkill)return options.refreshPaidSkill(payment,{millionCommitted:true,solutionCommitted:options.solutionCommitted===true});
        return this.rollCheck(formula,data,{...options,preRollFunding:this.preRollPaymentReceipt(payment)??options.preRollFunding,millionCommitted:true});
      },{workflow:'oneInAMillion',additionalCost:options.additionalCost??0,additionalBenefitCount:options.additionalBenefitCount??((options.additionalCost??0)>0?1:0),...surchargeFundingInput(options),...unrolledPaymentFundingInput(options),additionalUses:options.additionalUses??[],bonusPoolId:options.bonusPoolId??''});
    }
    // Reservations, validation, modifiers and extra record fields come from the roll pipeline (module/rolls).
    const rollContext = {actor: this, options, checkKind, checkId, checkMethod, formula, data, weaponUuid, weaponProficiency, weaponQualities, skillKey, ability, attributeDamage, phase: 'before'};
    const reservation = rollPipeline.acquire(rollContext);
    if (reservation) return reservation(extra => this.rollCheck(formula, data, {...options, ...extra}));
    const oldSchoolScope={ability,checkKind,resultSource},oldSchoolResult=await oldSchoolContext(this,oldSchoolScope,options);
    if(oldSchoolResult.cancelled)return null;
    const oldSchool=oldSchoolResult.evidence;
    rollContext.oldSchoolScope = oldSchoolScope;
    rollContext.oldSchool = oldSchool;
    for(const payment of [options.preRollFunding,options.rerollFunding])if(payment?.shakenSignature&&payment.shakenSignature!==JSON.stringify(shakenRules(this.actionDiceFundingSystem)))throw new Error('The Shaken condition changed before this paid check.');
    await rollPipeline.validate(rollContext);
    // Contributor modifiers apply to the dice only; the recorded formula stays as declared so a reroll adds them once.
    const pipelineModifiers = rollPipeline.modifiers(rollContext), rollFormula = formulaWithModifiers(formula, pipelineModifiers.total);
    const sleepSnapshot=checkKind==='skill'&&skillKey==='notice'&&checkId==='awareness'?sleepingSourceSnapshot(this):null;
    if(checkKind==='attack'&&!options.rerollOf&&options.attackContext?.ranged===true)await endCombatStance(this,this.system.combatStance?.id);
    let roll = await new Roll(twenty?rollFormula.replace(/^1d20\b/,'20'):rollFormula, data).evaluate();
    let alternatives=null,chosenIndex=0;
    if(chooseTwice){
      const second=await new Roll(rollFormula,data).evaluate(),rolls=[roll,second];
      alternatives=rolls.map(r=>({total:r.total,naturalDie:r.dice[0]?.total??null}));
      const selection=await systemDialog.input({window:{title:`${choiceSource}: choose the preferred result`},rejectClose:false,content:`<label>Result <select name="chosen">${alternatives.map((r,index)=>`<option value="${index}">Roll ${index+1}: ${r.total} (natural ${r.naturalDie})</option>`).join("")}</select></label><p>Closing this dialog keeps the first result.</p>`});
      chosenIndex=Number(selection?.chosen)===1?1:0;roll=rolls[chosenIndex];
    }
    for(const payment of [options.preRollFunding,options.rerollFunding])if(payment?.shakenSignature&&payment.shakenSignature!==JSON.stringify(shakenRules(this.actionDiceFundingSystem)))throw new Error('The Shaken condition changed while resolving this paid check.');
    rollContext.phase = 'after';
    await rollPipeline.validate(rollContext);
    const die = twenty?20:checkMethod === "roll" && checkKind!=="damage" ? roll.dice[0]?.total ?? null : null;
    const minimumAdjustment=practiceMakesPerfect&&die!==null&&die>error&&die<10?10-die:0;
    const normalThreat=threat;
    if(twenty)threat=20;
    const rawTotal=roll.total+minimumAdjustment+(oldSchool?.bonus??0),resolved=resolveSkillResult(rawTotal,die,{cap,threat});
    const rollCombat=this.participatingCombat,recordedCombat=rollCombat?.started?this.mentalLeapCombatContext(rollCombat):null;
    const shaken=shakenRules(this.system);
    if(shaken.needsReview&&['skill','knowledge','attack','ability','save','initiative'].includes(options.checkKind))throw new Error('Review the current Shaken sources before rolling.');
    const shakenContext=Object.hasOwn(options,'shakenContext')?options.shakenContext:shaken.grade&&['skill','knowledge','attack','ability','save','initiative'].includes(options.checkKind)?{grade:shaken.grade,totalGrade:shaken.totalGrade,label:shaken.label}:null;
    validateAnalysisTaskRoll(this.system,options.analysisTask,{now:game.time?.worldTime??null,checkKind,skillKey,checkId,inCombat:!!this.participatingCombat});
    const check={...rollPipeline.flags(rollContext),...(pipelineModifiers.rows.length?{pipelineModifiers:pipelineModifiers.rows}:{}),tripAttack:options.tripAttack??null,meleeArmorPiercing:options.meleeArmorPiercing??null,drivingStance:options.drivingStance??null,takedown:options.takedown??null,attackDamageBenefit:options.attackDamageBenefit??null,stalkingStance:options.stalkingStance??null,sideStanceDamage:options.sideStanceDamage??null,cheapShotRecovery:options.cheapShotRecovery??null,feint:options.feint??null,attributeDamage,meleeSkillFeats:options.meleeSkillFeats??null,conveyanceBullRush:options.conveyanceBullRush??null,bullRushAttack:options.bullRushAttack??null,bullRushDefense:options.bullRushDefense??null,stillStandingSave:options.stillStandingSave??null,tumblePath:options.tumblePath??null,tripDefense:options.tripDefense??null,fallDistance:options.fallDistance??null,balanceSurface:options.balanceSurface??null,hideCircumstances:options.hideCircumstances??null,detectionObserver:options.detectionObserver??null,hideMovement:options.hideMovement??null,targetSkillEffect:options.targetSkillEffect??null,rankSynergyFeats:options.rankSynergyFeats??null,stoneCold:options.stoneCold??null,threaten:options.threaten??null,bugConcealment:options.bugConcealment??null,documentation:options.documentation??null,trackingFeat:options.trackingFeat??null,trackingMasteryTask:options.trackingMasteryTask??null,terrainSaveSource:options.terrainSaveSource??null,oldSchool,analysisTask:options.analysisTask?{...options.analysisTask,...(options.analysisTask.stage==='pressure'?{pressureUse:taskPressureUseProof(this.system,options.analysisTask),pressureRollId:foundry.utils.randomID()}:{}),completedAt:game.time?.worldTime??null}:null,forensicGenius:options.forensicGenius??null,closedCourseFeat:options.closedCourseFeat??null,wheelFeat:options.wheelFeat?{...options.wheelFeat,...(options.wheelFeat.free&&!options.wheelFeat.use?{use:structuredClone(this.system.resourceUses?.oneHandManeuver??null)}:{})}:null,requestBenefit:options.requestBenefit??null,rerollSource:options.rerollSource??null,practiceFeat:options.practiceFeat??null,fundedTaking:options.fundedTaking??null,gearAllowance:options.gearAllowance??null,gearCheckContext:options.gearCheckContext??null,improvisedSearch:options.improvisedSearch??null,terrainFeat:options.terrainFeat??null,pursuitFeat:options.pursuitFeat??null,professionalFeat:options.professionalFeat??null,contactFeat:options.contactFeat??null,polyglot:options.polyglot??null,photographicMemory:options.photographicMemory??null,charmer:options.charmer??null,cardSharkKnowledge:options.cardSharkKnowledge??null,cardSharkProfession:options.cardSharkProfession??null,appearanceModifiers:options.appearanceModifiers??null,hardCore:options.hardCore??null,finalAttackRound:options.finalAttackRound??null,finesseDamage:options.finesseDamage??null,damageSave:options.damageSave??null,coverSave:options.coverSave??null,cqbRange:options.cqbRange??null,finalAttack:options.finalAttack??null,twoWeaponFinalAttack:options.twoWeaponFinalAttack??null,shakenContext,restraintEscape:options.restraintEscape??null,skillBonusCondition:options.skillBonusCondition??null,skillCheckAdjustment:options.skillCheckAdjustment??null,weaponFocusWork:options.weaponFocusWork??null,baffledSaveBonus:options.baffledSaveBonus??0,gamblingDice:options.gamblingDice??null,rollCombat:recordedCombat?{id:recordedCombat.id,round:recordedCombat.round,combatantId:recordedCombat.combatantId}:null,preRollFunding:options.preRollFunding??null,hailMary:options.hailMary??null,rerollFunding:options.rerollFunding??null,rerollReceiptId:options.rerollReceiptId??null,rerollOf:options.rerollOf??null,sleepSnapshot,conditionAbilityAdjustment:options.conditionAbilityAdjustment??0,conditionDamagePenalty,evasionContext:options.evasionContext??null,securityBonus:options.securityBonus??0,fatigueBonus:options.fatigueBonus??0,fatigueCondition:options.fatigueCondition??'',underwaterContext:options.underwaterContext??null,mortarOperation:options.mortarOperation??null,launcherOperation:options.launcherOperation??null,unnervingAvailableGrade:options.unnervingAvailableGrade??0,unnervingStress:options.unnervingStress??null,qualityChecks:options.qualityChecks??null,medical:options.medical??null,littleDetails:options.littleDetails?{...options.littleDetails,round:this.system.resourceUses?.littleDetailsRound?.epoch??options.littleDetails.round}:null,sensoryConditions:options.sensoryConditions??null,skillTags:options.skillTags??null,skillGear:options.skillGear??null,fogSmoke:options.fogSmoke??null,terrainSave:options.terrainSave??null,localHeroOpposition:options.localHeroOpposition??null,cunningPlan:cunning,attributeSubstitution:options.attributeSubstitution??null,terrain:options.terrain??null,senses:options.senses??null,tracking:options.tracking??null,gcTakingPermissionConfirmed:options.gcTakingPermissionConfirmed===true,ambush:options.ambush??null,sneakAttackTarget:options.sneakAttackTarget??null,sneakAttack:options.sneakAttack??null,ambientLight:options.ambientLight??null,nest:options.nest??null,breakthrough:options.breakthrough??null,requiredBonusPoolId,requiredBonusSpent:false,cannotError:!!cannotError,resultSource,opponentResult,oneInAMillion:million,tenSecondSolution:solution,standaloneCheckConfirmed:!!options.standaloneCheckConfirmed,forcedThreat:twenty,noForcedReroll:twenty,normalThreat:options.normalThreat??normalThreat,rawTotal,rolledTotal:roll.total,minimumAdjustment,practiceMakesPerfect,criticalFailureCostIncrease,crossCheck,alternatives,chosenIndex,choiceSource:chooseTwice?choiceSource:null,choiceResourceId:chooseTwice?choiceResourceId:null,
      effectiveTotal:resolved.total,actorUuid:this.uuid,checkKind,ability,skillKey,checkId,focus,rerollResources,formula,rollData:structuredClone(data),rollMode,weaponUuid,weaponProficiency,weaponQualities,cleanAndPolished,gearUuid,gearAttempt,attackContext,unarmed,improvised,threat,error,cap,baseFlavor:flavor,boostTotal:0,boostSpent:0,
      capped:resolved.limited,naturalDie:die,checkMethod,actionDiceAllowed:checkMethod==="roll"&&actionDiceAllowed,successConfirmed:null,errorConfirmed:false,threatConfirmed:false,triumphed:false};
    try{if(check.drivingStance)return await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:String(roll.total),rolls:[roll],blind:check.drivingStance.visibility.blind,whisper:check.drivingStance.visibility.whisper,flavor:checkFlavor(check),flags:{spycraft2:check}});return await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:this}),flavor:checkFlavor(check),flags:{spycraft2:check}},{rollMode});}
    catch(error){if(check.analysisTask?.pressureRollId){const posted=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags.spycraft2.analysisTask?.pressureRollId===check.analysisTask.pressureRollId&&rollEvidence(m.flags.spycraft2)===rollEvidence(check));if(posted)return posted;}const receipt=check.preRollFunding?.id,posted=receipt&&[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.preRollFunding?.id===receipt);if(posted)return posted;throw error;}

  }

  async rollAbility(key,options={}) {
    if(!Object.hasOwn(CONFIG.SPYCRAFT.abilities,key))return null;
    const blocked=restraintActionBlock(this.system)||attributeActionBlock(this.system,{kind:'ability',ability:key,purelyMentalConfirmed:options.purelyMentalConfirmed});if(blocked)return ui.notifications.warn(blocked);
    const conditionAbilityAdjustment=conditionAbilityPenalty(this.system,key),mod=(this.system.abilities[key]?.mod??0)+conditionAbilityAdjustment;
    return this.rollCheck("1d20 + @mod",{mod},{flavor:game.i18n.localize(CONFIG.SPYCRAFT.abilities[key])+(conditionAbilityAdjustment?' — Drunk −2':''),checkKind:'ability',ability:key,conditionAbilityAdjustment,...(Object.hasOwn(options,'oldSchool')?{oldSchool:options.oldSchool}:{})});
  }

  applyRestraintEscape(message,options={}){return applyRestraintEscape(this,message,options);}
  confirmRestraintEscapeMove(message,options={}){return confirmRestraintEscapeMove(this,message,options);}
  async reviewRestraintRelease(options={}){const review=this.system.restraintReleaseReview;if(!review?.needsReview)return null;const message=await fromUuid(review.messageUuid);if(!message)throw new Error('The original grapple message is unavailable.');return reviewRestraintRelease(this,message,options);}
  rollCriticalInjury(options={}){return rollCriticalInjury(this,options);}
  reviewCriticalInjury(id,options={}){return reviewCriticalInjury(this,id,options);}
  applyShaken(options={}){return applyShaken(this,options);}
  reviewShakenApplication(options={}){return reviewShakenApplication(this,options);}
  get shakenSourceEntries(){return shakenSourceEntries(this);}
  get shakenApplicationReview(){return getShakenApplicationReview(this);}
  async editShakenSource(uuid){const effect=await fromUuid(uuid);if(!effect||!effect.isOwner)throw new Error('Choose an editable Shaken source effect.');if(![...this.appliedEffects,...this.effects].some(e=>e.uuid===effect.uuid))throw new Error('This effect no longer supplies this character.');return effect.sheet.render({force:true});}
  applyBaffled(options={}){return applyBaffled(this,options);}
  reviewBaffledApplication(options={}){return reviewBaffledApplication(this,options);}
  setSickened(options={}){return this.setReviewedCondition('sickened',options);}
  async setReviewedCondition(condition,options={}){
    const rules={nauseated:{label:'Nauseated',text:'No Concentration skill checks and at most one final attack per round across all sources. Only one half action per round; the GC tracks that action budget at the table (p.342).'},held:{label:'Held',text:'Vulnerable; no movement or non-free actions except a full-action Athletics (STR) Escape check with Armor Check Penalty (p.342). Escape success is adjudicated with the holder; this control reviews the current state.'},pinned:{label:'Pinned',text:'Held and vulnerable; no movement or actions except a full-action Athletics (STR) Escape check with Armor Check Penalty. Adjacent melee/unarmed attackers gain +4. The holder controls speech and receives half cover; the GC resolves those interactions (p.342).'},baffled:{label:'Baffled',text:'Skill bonuses are halved, rounded up; saves resisting further Baffled gain +8. A second new application replaces Baffled with Incompetent (p.340). This control reviews the current state.'},incompetent:{label:'Incompetent',text:'Skill bonuses become +0; ranks, caps and separate check modifiers remain (p.342). This control reviews the current state.'},prone:{label:'Prone',text:'No Standard Move, Bull Rush, Run or Withdraw. May crawl with ordinary 5-ft. bonus steps and Brace as a free action. Melee attacks −2; non-adjacent ranged attackers −2 (p.342).'},sprawled:{label:'Sprawled',text:'Vulnerable; attack checks −2. Movement actions are limited to Crouch, Drop Prone or Stand Up (p.342).'},mute:{label:'Mute',text:'Cannot speak, shout, or make skill checks with the Language tag (p.342).'},crouched:{aliases:['crouching'],label:'Crouched',text:'Half base Speed, rounded down. Non-adjacent attackers suffer −1 with ranged attacks against you (p.340).'},sleeping:{id:'sleep',aliases:['sleeping','asleep'],label:'Sleeping',text:'Only passive actions; blinded and helpless. Wakes upon a new touch, any damage, or a successful Notice/Awareness check (p.342). Confirm waking with the GC; other sources of blindness or unconsciousness remain separate.'},drunk:{label:'Drunk',text:'−2 Dexterity-/Wisdom-based checks. At each round start while standing, reposition 5 ft. randomly without counting against allowed movement. Recovery requires four full hours asleep (p.341); the GC resolves random repositioning.'},blinded:{id:'blind',aliases:['blinded'],label:'Blinded',text:'Vulnerable; half Speed. Vision checks −8 and cap −20; targets gain +8 Defense and opponents gain +2 attacks against you. Cannot make checks requiring eyesight or eye-hand coordination (pp.340,351).'},deafened:{id:'deaf',aliases:['deafened'],label:'Deafened',text:'Hearing checks −8 and cap −10; Language checks targeting you have cap −20. Cannot make checks requiring hearing (pp.340,351).'},sickened:{label:'Sickened',text:'−2 to attacks, skills, damage rolls and saves (p.342).'},entangled:{label:'Entangled',text:'−2 attacks; −4 Dexterity skill checks; half Speed; no Run, Refresh, Regroup, Jump or Tumble (p.341).'},bound:{label:'Bound',text:'Entangled and helpless; cannot move or take Grasp/Hands-On actions (p.340).'}};
    if(!this.isOwner||!Object.hasOwn(rules,condition)||(this.type!=='agent'&&!(this.type==='npc'&&['baffled','incompetent'].includes(condition))))return null;
    const rule=rules[condition];let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:rule.label+' condition'},rejectClose:false,content:`<label>Condition <select name="active"><option value="true"${this.system.conditionContext?.[condition]?'':' selected'}>Apply ${rule.label}</option><option value="false"${this.system.conditionContext?.[condition]?' selected':''}>Clear ${rule.label}</option></select></label><label><input name="confirmed" type="checkbox" /> The GC confirms the condition applies or its cause has ended</label><p>${rule.text}</p>`});if(!input)return null;input={...input,active:input.active==='true'?true:input.active==='false'?false:null};}
    if(input.confirmed!==true||typeof input.active!=='boolean')return ui.notifications.warn('Confirm whether '+rule.label+' applies.');
    try{return await queueResources([this],()=>setConditionStatus(this,rule.id??condition,input.active,{label:rule.label,aliases:rule.aliases??[]}));}catch(error){ui.notifications.warn(error.message);throw error;}
  }

  async settleSleepWake(event,{cause,confirmed=false,check=null}={}){
    if(this.type!=='agent'||!this.isOwner)throw new Error('Choose an owned character to resolve waking.');
    const plan=sleepWakePlan(sleepingSourceSnapshot(this),event,{cause,confirmed,check});
    if(plan.blocked)throw new Error(plan.reason);
    if(!plan.changed)return {state:'awake',changed:false,cause};
    await setConditionStatus(this,'sleep',false,{label:'Sleeping',aliases:['sleeping','asleep']});
    return {state:'awake',changed:true,cause};
  }

  async wakeFromSleep(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const event=sleepingSourceSnapshot(this);if(event.state==='awake')return {state:'awake',changed:false};
    let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Wake from sleep'},rejectClose:false,content:'<label>New event <select name="cause"><option value="newTouch">New touch</option><option value="damage">Damage received</option></select></label><label><input name="confirmed" type="checkbox" /> The GC confirms this new event occurred after this sleep began</label><p>Ongoing contact is not a new touch. Successful Notice/Awareness wakes through its recorded outcome. Source-specific effects remain subject to their own rules (p.342).</p>'});if(!input)return null;}
    if(!['newTouch','damage'].includes(input.cause)||input.confirmed!==true)return ui.notifications.warn('Confirm the new waking event with the GC.');
    return queueResources([this],()=>this.settleSleepWake(event,{cause:input.cause,confirmed:true}));
  }

  /** Resolve an incoming initiative loss, distinct from penalties inflicted by the character's own actions. */
  async sufferInitiativeLoss(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    let input=options;
    if(!Object.keys(input).length){
      const combat=game.combat,own=[...(combat?.combatants??[])].filter(c=>c.actor?.uuid===this.uuid),esc=foundry.utils.escapeHTML;
      if(!combat?.started||!own.length)return ui.notifications.warn('Choose this character in a started combat.');
      input=await systemDialog.input({window:{title:'Apply Initiative Count loss'},rejectClose:false,content:`<div class="spycraft2-roll-options"><label>Combatant <select name="combatantId">${own.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Listed loss <input name="loss" type="number" min="0" step="1" value="1" /></label><label><input name="selfInflicted" type="checkbox" /> This penalty is inflicted by my own action (Uncanny Dodge does not halve it)</label><label><input name="confirmed" type="checkbox" /> The GC confirms this loss and its source</label><p>Incoming losses are halved, rounded down, with Uncanny Dodge IV. No action die is spent.</p></div>`});
      if(!input)return null;input={...input,loss:typeof input.loss==='string'&&input.loss.trim()===''?NaN:Number(input.loss),selfInflicted:input.selfInflicted===true};
    }
    if(input.confirmed!==true)return ui.notifications.warn('Confirm the Initiative Count loss and its source.');
    return queueResources([this],async()=>{
      const combat=game.combat,own=[...(combat?.combatants??[])].filter(c=>c.actor?.uuid===this.uuid),c=own.find(c=>c.id===input.combatantId)??(own.length===1&&!input.combatantId?own[0]:null);
      if(!combat?.started||!c||!Number.isFinite(c.initiative))throw new Error('Select this character’s combatant with a numeric Initiative Count in the current started combat.');
      const plan=initiativeLossPlan(this.system,input),before=c.initiative,after=before-plan.loss,initiativeLossReceiptId=foundry.utils.randomID();
      if(!Number.isFinite(after))throw new Error('The resulting Initiative Count is invalid.');
      if(plan.loss)await changeInitiativeCountPreservingShaken(c,after);
      try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:foundry.utils.escapeHTML(`${this.name}: Initiative Count ${before} → ${after}; listed loss ${plan.listedLoss}${plan.halved?' halved by Uncanny Dodge IV (round down)':''}${plan.selfInflicted?' from own action':''}.`),flags:{spycraft2:{actorUuid:this.uuid,checkKind:'initiativeLoss',initiativeLossReceiptId,initiativeLoss:{...plan,combatId:combat.id,combatantId:c.id,before,after},actionDiceAllowed:false}}});}
      catch(error){const posted=[...(game.messages?.values?.()??game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.initiativeLossReceiptId===initiativeLossReceiptId);if(posted)return {...plan,before,after};if(plan.loss){if(c.initiative!==after){ui.notifications.warn('Initiative changed again; review the unposted loss before applying another.');throw error;}try{await changeInitiativeCountPreservingShaken(c,before);}catch(rollback){ui.notifications.warn('Initiative rollback failed; review the current Initiative Count before retrying.');throw new AggregateError([error,rollback],'Initiative loss requires review.');}}throw error;}
      return {...plan,before,after};
    });
  }

  async rollSave(key,options={}) {
    let input=options;
    if(!CONFIG.SPYCRAFT.saves[key])return null;
    if(attributeCollapsePlan(this.system).dead||this.system.conditionContext?.dead||this.statuses?.has('dead'))return ui.notifications.warn('A dead character cannot make a saving throw.');
    const feats=new Set(this.system.activeFeatNames??[]),manualStandingContent=stillStandingSaveContent(this.system,key),stillStandingContent=options.takedown&&manualStandingContent?'<p>This recorded Fortitude save resists takedown. Earned Still Standing applies automatically.</p>':manualStandingContent;
    if(input.askContext&&(key==='ref'||feats.has('Swamp Training')||feats.has('Firefighter Training')||feats.has('Disease Basics')||feats.has('Poison Basics')||this.system.mentalLeapState?.fatigueSaveBonus||this.system.conditionContext?.baffled===true||!!stillStandingContent)){
      input=await systemDialog.input({window:{title:game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label)},rejectClose:false,content:`<div class="spycraft2-roll-options">${stillStandingContent}${this.system.conditionContext?.baffled===true?'<label><input type="checkbox" name="resistingBaffled" /> This save resists becoming Baffled (+8)</label>':''}${this.system.mentalLeapState?.fatigueSaveBonus?'<label>Fatigue-related save <select name="fatigueCondition"><option value="">Other save</option><option value="fatigue">Resists becoming fatigued</option><option value="exhaustion">Resists becoming exhausted</option></select></label>':''}${key==='ref'?saveCoverContent(this.system):''}${key==='ref'?'<label><input type="checkbox" name="reflexReducesDamage" /> The source allows this Reflex save to reduce damage</label><label><input type="checkbox" name="flatFooted" /> I am flat-footed against this attack or event</label>':''}${key==='ref'&&evasionPlan(this.system).canTake10?'<label>Method <select name="checkMethod"><option value="roll">Roll d20</option><option value="take10">Take 10 (Evasion III)</option></select></label>':''}${key==='ref'&&uncannyDodgePlan(this.system).securityBonus?'<label><input type="checkbox" name="securityDevice" /> This Reflex save avoids a security device (Uncanny Dodge +4)</label>':''}${key==='ref'?'<label><input type="checkbox" name="braced" /> I am currently braced (apply the Brace Reflex penalty)</label><label><input type="checkbox" name="underwater" /> I am underwater</label>':''}${feats.has('Swamp Training')||feats.has('Poison Basics')?'<label><input type="checkbox" name="poison" /> This save resists poison (owned Poison Basics / Swamp Training)</label>':''}${feats.has('Disease Basics')?'<label><input type="checkbox" name="disease" /> This save resists disease (Disease Basics)</label>':''}${feats.has('Firefighter Training')&&key==='ref'?'<label><input type="checkbox" name="avoidCatchingFire" /> This Reflex save avoids catching fire (Firefighter Training)</label>':''}${feats.has('Firefighter Training')&&key==='fort'?'<label><input type="checkbox" name="smokeInhalation" /> This Fortitude save resists smoke inhalation (Firefighter Training)</label>':''}</div>`});
      if(!input)return null;
    }
    if(options.takedown)input={...input,resistingTakedown:true,takedownAttackConfirmed:true};
    let stillStandingSave;try{stillStandingSave=stillStandingTakedownPlan(this.system,{...input,saveKey:key});}catch(error){return ui.notifications.warn(error.message);}
    const coverSave=saveCoverPlan(key,input,this.system),stoneCold=stoneColdSavePlan(this.system,key,this.mentalLeapCombatContext());
    const penalty=key==='ref'&&input.braced?bracedReflexPenalty(this.system):0,terrainSave=terrainSavePlan(this.system,key,input);
    const underwaterContext=underwaterCheckPlan(this.system,{...input,kind:'save',saveKey:key});
    const fatigueBonus=input.fatigueCondition==='fatigue'?this.system.mentalLeapState?.fatigueSaveBonus??0:input.fatigueCondition==='exhaustion'?this.system.mentalLeapState?.exhaustionSaveBonus??0:0;
    if(input.resistingBaffled===true&&getBaffledReview(this).needsReview)return ui.notifications.warn('The GC must review the interrupted Baffled event before this resistance save.');
    const baffledSaveBonus=this.system.conditionContext?.baffled===true&&input.resistingBaffled===true?8:0;
    const checkMethod=input.checkMethod??'roll';
    if(shakenRules(this.system).needsReview)return ui.notifications.warn('Review the current Shaken sources before saving throws.');
    if(['take10','take20'].includes(checkMethod)&&shakenRules(this.system).fixedResultsForbidden)return ui.notifications.warn('Shaken: taking 10 or 20 is unavailable (p.342).');
    if(checkMethod!=='roll'&&(checkMethod!=='take10'||key!=='ref'||!evasionPlan(this.system).canTake10))return ui.notifications.warn('Only Evasion III permits taking 10 with a Reflex save.');
    const evasionContext=key==='ref'?evasionSaveContext(this.system,{flatFooted:input.flatFooted===true,reflexReducesDamage:input.reflexReducesDamage===true}):null;
    const securityBonus=key==='ref'&&input.securityDevice===true?uncannyDodgePlan(this.system).securityBonus:0;
    const total = (this.system.saves?.[key]?.total ?? 0)+(stillStandingSave?.bonus??0)+(stoneCold?.bonus??0)+penalty+terrainSave.adjustment+underwaterContext.penalty+fatigueBonus+securityBonus+baffledSaveBonus+(coverSave?.bonus??0);
    return this.rollCheck("1d20 + @total", { total }, { flavor: game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label)+(checkMethod==='take10'?' — Evasion III: take 10':'')+(options.takedown?(' — Takedown DC'+Number(options.takedown.dc)):'')+(options.damageSave?` — Damage event DC${Number(options.damageSave.dc)}`:'')+(coverSave?.bonus?` — Cover/Reflex +${coverSave.bonus}`:'')+(securityBonus?` — Uncanny Dodge/security device +${securityBonus}`:'')+(baffledSaveBonus?' — Baffled resistance +8':'')+(fatigueBonus?` — Fatigue/exhaustion resistance +${fatigueBonus}`:'')+(stillStandingSave?.bonus?' — Still Standing: takedown Fortitude +8':'')+(stoneCold?' — Stone Cold: combat Will +1':'')+(penalty?` — Brace ${penalty}`:'')+(underwaterContext.notes.length?` — ${underwaterContext.notes.join(' ')}`:'')+(terrainSave.notes.length?` — ${terrainSave.notes.join(' ')}`:''),takedown:options.takedown??null,takedownLease:options.takedownLease,cheapShotRecovery:options.cheapShotRecovery??null,validateCheapShotRecovery:options.validateCheapShotRecovery,damageSave:options.damageSave??null,validateDamageSave:options.validateDamageSave,coverSave,stoneCold,stillStandingSave,checkMethod,evasionContext,securityBonus,baffledSaveBonus,fatigueBonus,fatigueCondition:input.fatigueCondition??'',underwaterContext,terrainSave,terrainSaveSource:terrainSave.bonuses.length?{version:1,checkId:key,plan:terrainSave}:null,validateSaveContext:terrainSave.bonuses.length||stillStandingSave?()=>{if(JSON.stringify(terrainSavePlan(this.system,key,input))!==JSON.stringify(terrainSave)||JSON.stringify(stillStandingTakedownPlan(this.system,{...input,saveKey:key}))!==JSON.stringify(stillStandingSave))throw new Error('The conditional save feat, Still Standing source or confirmed save purpose changed before posting.');}:undefined,checkKind:"save",checkId:key,threat:0,error:0,oneInAMillion:!!input.oneInAMillion });
  }

  prepareAnalysisTaskPressure(id,message,options={}){return prepareAnalysisTaskPressure(this,id,message,options);}
  applyAnalysisTaskPressureStress(id,message,options={}){return applyAnalysisTaskPressureStress(this,id,message,options);}
  useMark(options={}){return useMark(this,options);}
  discloseMark(id,options={}){return discloseMark(this,id,options);}
  correctMark(id,options={}){return correctMark(this,id,options);}
  manageAnalysisTasks(options={}){return manageAnalysisTasks(this,options);}
  createAnalysisTask(options={}){return createAnalysisTask(this,options);}
  expireAnalysisTask(id,options={}){return expireAnalysisTask(this,id,options);}
  settleAnalysisTask(id,message,options={}){return settleAnalysisTask(this,id,message,options);}
  reviewAnalysisTaskSettlement(options={}){return reviewAnalysisTaskSettlement(this,options);}

  async rollSkill(key, ability = null, options = {}) {
    if(options.tripCounter)validateTripCounterIntent(this,options.tripCounter,options.tripCounterLease);
    const restraintRollSource=restraintSourceSnapshot(this),restraintRollSize=this.system.size;
    const skill = this.system.skillTotals?.[key];
    const optionalRules=game.settings?.get("spycraft2","linguistics")?["linguistics"]:[];
    const checks = rollPipeline.skillChecks({actor: this, checkKind: 'skill', skillKey: key, options, optionalRules}, CONFIG.SPYCRAFT.skills[key]?.checks ?? []);
    if (!skill || !checks.length) return null;
    let input = options;
    if (!input.check) {
      const esc = foundry.utils.escapeHTML;
      const choices = checks.map(check => `<option value="${check.id}"${options.initialCheck===check.id?' selected':''}>${esc(check.name)} (${check.attributes.join("/").toUpperCase()}, ${esc(check.mode)}, error 1–${check.error})</option>`).join("");
      const abilities = skill.totals.map(t => `<option value="${t.ability}"${t.ability === (ability ?? skill.ability) ? " selected" : ""}>${t.ability.toUpperCase()}</option>`).join("");
      input = await systemDialog.input({
        window: { title: skill.name }, rejectClose: false,
        ok: {label: "Roll check"},
        render: (event, dialog) => enhanceSkillDialog(event, dialog, checks),
        content: `<div class="spycraft2-roll-options">${key==='athletics'&&(this.system.conditionContext?.held||this.system.conditionContext?.pinned)?'<fieldset><legend>Opposed Grapple escape</legend><label>Applicable proficiency <select name="grappleProficient"><option value="">Choose for this Grapple</option><option value="true">Proficient</option><option value="false">Not proficient: two full actions, error +2</option></select></label><label>My Size categories minus opponent Size categories <input name="grappleSizeDifference" type="number" step="1" min="-20" max="20" value="0" /></label><label><input name="grappleContextConfirmed" type="checkbox" /> The GC confirms the participants, applicable proficiency and Size difference</label><p>Each larger participant gains +4 per Size category on their own check. This check uses Grasp and Armor Check Penalty; static-restraint Escape has separate rules.</p></fieldset>':''}${key==='athletics'&&restraintRollSource.sources.length?`<p>Current restraint sources: ${restraintRollSource.sources.map(s=>esc(s.name??s.id)).join(', ')}.</p>`:''}${key==='athletics'&&restraintRollSource.sources.length>1?'<label><input name="grappleAllSourcesConfirmed" type="checkbox" /> The GC confirms all current Held/Pinned sources belong to this same grapple; unrelated sources require separate adjudication</label>':''}<label>Skill check <select name="check">${choices}</select></label>
          <label>Attribute (when permitted) <select name="ability">${abilities}</select></label>
          ${(key==='analysis'||key==='resolve'&&Object.values(this.system.analysisTasks??{}).some(t=>t.pressured&&t.status==='active'))?'<details><summary>Complex Analysis Task</summary>':''}
            ${key==='analysis'&&this.system.activeFeatNames?.some(n=>['Forensic Genius','Tracking Mastery'].includes(n))?`<fieldset><legend>Complex Analysis challenge count</legend><label><input type="checkbox" name="complexAnalysisTask" /> Declare an unrecorded Complex Analysis Task</label><label>GC’s unmodified number of Challenges <input name="analysisBaseChallenges" type="number" min="2" step="1" /></label><p>Forensic Genius reduces the required count by2; Tracking Mastery reduces an Analysis/Forensics task by1(minimum1 after all reductions). A selected recorded task supplies its own count; use this declaration only for an unrecorded task (pp.207,209).</p></fieldset>`:''}
            ${(key==='analysis'||key==='resolve'&&Object.values(this.system.analysisTasks??{}).some(t=>t.pressured&&t.status==='active'))?`<label>Recorded Complex Analysis Task <select name="analysisTaskId"><option value="">None</option>${Object.entries(this.system.analysisTasks??{}).filter(([,t])=>t.status==='active'&&(key==='analysis'||t.pressured)).map(([id,t])=>`<option value="${esc(id)}">${esc(t.title)} (${esc(t.completed)}/${esc(t.requiredChallenges)})</option>`).join('')}</select></label>`:''}
            ${key==='resolve'&&Object.values(this.system.analysisTasks??{}).some(t=>t.pressured&&t.status==='active')?`<label>Upcoming Challenge DC (Task Pressure only)<input name="taskChallengeDC" type="number" step="1" min="0" /></label><label><input name="taskChallengeDCConfirmed" type="checkbox" /> The GC confirms this is the actual upcoming Challenge DC</label>`:''}
          ${(key==='analysis'||key==='resolve'&&Object.values(this.system.analysisTasks??{}).some(t=>t.pressured&&t.status==='active'))?'</details>':''}
          ${['intimidate','resolve'].includes(key)?`<details><summary>Threaten action / response (pp.180,361)</summary><p>Choose Threaten (Intimidate/Wis) or Resist Threaten (Resolve/Wis) above. These are opposed checks with Hearing and Language tags; taking10/20 is unavailable. The GC resolves the opposed outcome, stress/fright and next-attack effects.</p><label>Opposing character name <input name="threatenOpponentName" maxlength="200" /></label><label><input name="threatenOpponentConfirmed" type="checkbox" /> The named character is my opponent</label><label><input name="threatenContextConfirmed" type="checkbox" /> The GC confirms these Threaten circumstances and participants</label><label>Held/readied ranged weapon for CQB benefits <select name="threatenWeaponId"><option value="">None</option>${(this.system.readiedRangedWeapons??[]).map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></label>${key==='intimidate'?'<label>Measured target distance (ft.) <input name="threatenDistanceFeet" type="number" min="0" step="any" /></label><label>Vitality lost to my attacks <input name="threatenVitalityLoss" type="number" min="0" step="1" value="0" /></label><label>Wounds lost to my attacks <input name="threatenWoundLoss" type="number" min="0" step="1" value="0" /></label><label><input name="threatenInjuryFromYourAttacksConfirmed" type="checkbox" /> The GC confirms these losses were caused by my attacks</label><p>The target must have lost5vitality or1wound to your attacks. CQB Mastery waives this requirement while you hold a readied ranged weapon. Glint of Madness waives it without requiring a weapon. Use your own Initiative Count.</p>':'<label><input name="threatenIncomingLegalConfirmed" type="checkbox" /> The GC confirms this responds to a legal incoming Threaten action, including the attacker’s CQB Range and prior-injury requirement or exception</label>'}</details>`:''}
          ${targetSkillEffectContent(key)}${detectionObserverContent(key)}
          ${conveyanceBullRushContent(key)}${bullRushAttackContent(key)}${bullRushDefenseContent(key)}${tumblePathContent(key)}${tripAttackContent(key,this)}${tripDefenseContent(key,this)}${feintContent(key,this)}${fallDistanceContent(key)}${balanceSurfaceContent(key)}${hideCircumstanceContent(key)}
          ${key==='sneak'&&['side','stalking'].includes(combatStanceState(this.system)?.key)?'<label>Combat stance: distance this Hide route adds toward the 20 ft. round limit (ft.; required only for included movement) <input name="stanceDistanceFeet" type="number" min="0" step="any" /></label><p>Check the recorded total on Main; record the completed round total after moving.</p>':''}
          ${key==='sneak'?'<details><summary>Included Hide ground movement</summary><p>For a rolled Sneak/Hide check. This includes the ground movement check modifier and separate error increase. Ghost Basics doubles the included current-Speed allowance. Resolve other movement modes separately.</p><label><input name="hideMovement" type="checkbox" /> Declare movement included in this Hide action</label><label>Counted movement (ft.) <input name="hideDistanceFeet" type="number" min="0" step="any" value="0" /></label><label><input name="hideAdjacentThreat" type="checkbox" /> Starting adjacent to a threatening opponent</label><label><input name="hidePassesThreat" type="checkbox" /> Continuing after entering threatening adjacency</label><label><input name="hideRouteConfirmed" type="checkbox" /> The GC confirms this ordinary ground route, counted distance and terrain costs; no balancing, climbing, swimming or water entry/exit</label><label><input name="hideActionConfirmed" type="checkbox" /> I take the legal action required for this Hide check (normally one full action)</label></details>':''}
          ${key==='sneak'&&this.system.activeFeatNames?.includes('Ghost Basics')?'<details><summary>Ghost Basics Hide targets</summary><p>Only Sneak/Hide. Normal strongest-positive synergy stacking applies.</p><label>Hide target type <select name="ghostHideTargetKind"><option value="">No Ghost Basics target synergy</option><option value="sensor">Security sensor</option><option value="living">Living opponent</option><option value="both">Both security sensors and living opponents</option></select></label><label>Actual sensor / living opponent <input name="ghostHideTargetName" maxlength="200" /></label><label><input name="ghostHideConfirmed" type="checkbox" /> The GC confirms this Hide check evades the named target types</label></details>':''}
          <details><summary>Focus, forte and synergy</summary>
            <label>Applicable focus (blank uses the check name) <input name="focus" /></label>
            <label><input type="checkbox" name="forte" /> An owned forte applies</label>
            <label>Synergy skill <select name="synergySkill"><option value="auto">Best listed unconditional synergy</option><option value="none">None</option>${Object.entries(CONFIG.SPYCRAFT.skills).map(([key,skill])=>`<option value="${key}">${esc(skill.name)}</option>`).join("")}</select></label>
            ${key==='impress'&&this.system.activeFeatNames?.includes('Professional Driver - Closed Course')?`<fieldset><legend>Professional Driver — Closed Course</legend><label><input type="checkbox" name="closedCourseSeesYou" /> The target has line of sight to you</label><label><input type="checkbox" name="closedCourseSeesVehicle" /> The target has line of sight to your vehicle</label><p>Both are required for Acrobatics or Drive synergy (p.193).</p></fieldset>`:''}
            <label>Synergy focus <input name="synergyFocus" /></label>
            <label><input type="checkbox" name="synergyConditionMet" /> Listed synergy circumstances apply</label>
            <label><input type="checkbox" name="gcApprovedSynergy" /> GC approved an additional synergy</label>
          </details>
          <details><summary>Weapon work — Weapon Focus</summary>
            <label><input name="weaponWork" type="checkbox" /> Apply Weapon Focus to this weapon Build, Modify or Repair DC</label>
            <label>Owned target weapon/model <select name="weaponWorkItemId"><option value="">GC-confirmed model or other target below</option>${(this.items?.filter(i=>i.type==='weapon')??[]).map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></label>
            <label>Other target weapon/model <input name="weaponWorkName" /></label>
            <label>Other target proficiency <select name="weaponWorkProficiency">${Object.entries(CONFIG.SPYCRAFT.proficiencies).filter(([k])=>k!=='unarmed').map(([k,n])=>`<option value="${esc(k)}">${esc(n.label??n)}</option>`).join('')}</select></label>
            <label>DC before Weapon Focus <input name="weaponWorkDC" type="number" min="0" step="1" /></label>
            <label><input name="weaponWorkConfirmed" type="checkbox" /> The GC confirms the target weapon, proficiency and unmodified DC</label>
            <p>The selected owned weapon supplies its actual proficiency. For an unowned or not-yet-built model, confirm its specifications with the GC. Weapon Focus changes the DC, not the roll total.</p>
          </details>
          <details><summary>Required gear and kits</summary>
            <label>Required gear <select name="gearStatus"><option value="unknown">Confirm for Gear / Gear Only checks</option><option value="available">All required gear is available</option><option value="missing">Required gear is missing</option></select></label>
            <label><input type="checkbox" name="kitAtLocation" /> I am at the selected non-portable kit’s recorded location</label>
            <label>Gear being used <select name="gearItem"><option value="">None</option>${(this.items?.filter(item=>['weapon','armor','gear'].includes(item.type)&&!isResourceLock(item)&&!item.system.reserve&&!item.system.destroyed&&item.system.quantity!==0&&!possessionUnavailable(item.system))??[]).map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join("")}</select></label>
          </details>
          ${key==='networking'?`<label>Contact being called <select name="contactName"><option value="">Unspecified / not a Contact check</option>${(this.system.contacts??[]).filter(c=>c.name?.trim()).map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select></label><label>Current mission Threat Level (for the selected Contact check) <input name="contactThreatLevel" type="number" min="1" max="20" step="1" /></label><p>For a contact feat’s initial associate, select their uniquely named Training record and configure that feat’s primary contact and GC-approved theme.</p>`:''}
          <details><summary>Time and class circumstances</summary>
            <label><input type="checkbox" name="inCombat" /> Additional combat for this Medicine check</label>
            <label><input type="checkbox" name="combatInSight" /> Surgery: combat occurred within line of sight at any time during the check</label>
            <label><input type="checkbox" name="complexTaskNearby" /> Therapy: someone is performing a Complex Task in my presence</label>
            <label><input type="checkbox" name="dramaticConflictNearby" /> Therapy: someone is performing a Dramatic Conflict in my presence</label>
            ${(this.system.originEffects??[]).some(effect=>effect.qualityKey==='seductive')?'<label><input type="checkbox" name="shiftingDisposition" /> Seductive: this check actually shifts disposition</label><label><input type="checkbox" name="seductionConflict" /> Seductive: this check is part of a seduction Dramatic Conflict</label>':''}
            <label><input type="checkbox" name="oneHanded" /> Only one hand available for this Hands-On check</label>
            <label><input type="checkbox" name="noSharedLanguage" /> No shared language or relevant local tongue for this Language check</label>
            <label><input type="checkbox" name="bound" /> Additional bound condition for this check</label>
            <label><input type="checkbox" name="conveyingMessage" /> Innuendo: I am conveying a message (adds Hands-On)</label>
            <label>Ambush preparation (Tactics/Ambush only) <select name="ambushPreparation"><option value="slow">Slow: 10 minutes, no quick-check error increase</option><option value="quick">Quick: 1 minute, error range +2</option></select></label>
            <label>Ambush role <select name="ambushRole"><option value="">Unspecified</option><option value="leader">Leader</option><option value="helper">Helper</option></select></label>
            <label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10</option><option value="take20">Take 20</option></select></label>
            <label><input type="checkbox" name="safeToTake" /> Neither distracted nor endangered</label>
            <label><input type="checkbox" name="gcTakingPermissionConfirmed" /> GC permits taking 10/20 when this named check requires permission</label>
            ${key==='blend'&&this.system.activeFeatNames?.some(n=>['Gorgeous','The Look','Simply Irresistible'].includes(n))?'<label><input type="checkbox" name="manhuntPrey" /> This Blend check is made as the Prey during a manhunt (Gorgeous/The Look/Simply Irresistible)</label>':''}
            ${key==='impress'&&this.system.activeFeatNames?.includes('Charmer')?`<fieldset><legend>Charmer — Influence timing (p.202)</legend><label><input type="checkbox" name="charmer" /> Use Charmer</label><label>NPC name <input type="text" name="charmerTarget" maxlength="200" /></label><label>Disposition toward you <select name="charmerDisposition"><option value="">Choose disposition</option><option value="neutral">Neutral</option><option value="intrigued">Intrigued</option><option value="friendly">Friendly</option></select></label><label>Influence duration <select name="charmerDuration"><option value="quick">Quick: scene benefit (normally 1 minute)</option><option value="slow">Slow: mission benefit (normally 10 minutes)</option></select></label><label><input type="checkbox" name="charmerNPCConfirmed" /> GC confirms this named NPC and their disposition toward me</label><p>Select one Influence timing feat. Actions and resulting disposition remain resolved at the table.</p></fieldset>`:''}
            ${key==='impress'&&this.system.activeFeatNames?.includes('Hard Core')?`<fieldset><legend>Hard Core — Influence timing (p.203)</legend><label><input type="checkbox" name="hardCore" /> Use Hard Core</label><label>NPC name <input type="text" name="hardCoreTarget" maxlength="200" /></label><label>Disposition toward you <select name="hardCoreDisposition"><option value="">Choose disposition</option><option value="aloof">Aloof</option><option value="unfriendly">Unfriendly</option><option value="hostile">Hostile</option></select></label><label>Influence duration <select name="influenceDuration"><option value="quick">Quick: scene benefit (normally 1 minute)</option><option value="slow">Slow: mission benefit (normally 10 minutes)</option></select></label><label><input type="checkbox" name="hardCoreNPCConfirmed" /> GC confirms this named NPC and their disposition toward me</label><p>The single chosen time reduction applies before taking 10/20 or Cross-Check. Actions and resulting disposition remain resolved at the table.</p></fieldset>`:''}
            ${this.system.activeFeatNames?.includes('One Hand on the Wheel')?`<fieldset><legend>One Hand on the Wheel</legend><label><input type="checkbox" name="wheelFreeManeuver" /> Use a free Maneuver (${this.limitedUseStatus.find(s=>s.id==='oneHandManeuver')?.remaining??0} / ${this.limitedUseStatus.find(s=>s.id==='oneHandManeuver')?.limit??0} uses this scene; Maneuver checks only)</label><label><input type="checkbox" name="wheelFreeActionConfirmed" /> The GC confirms this legal Maneuver may be a free action now (my Initiative Count in combat)</label></fieldset>`:''}
            <label>Time reduction (one source, p.102) <select name="timingReduction"><option value="auto">Choose fastest available (review minima for variable times)</option><option value="none">No reduction</option><option value="take10">Normal-time take 10 (class ability / forte)</option><option value="falseStart">False Start (take 20)</option><option value="professional">Mark of a Professional (unopposed)</option><option value="class">Applicable class time reduction</option><option value="ambushMastery">Ambush Mastery (quick ambush; error +2)</option><option value="ambushSupremacy">Ambush Supremacy (slow ambush; error +2)</option><option value="irresistible">Simply Irresistible (Impress/Networking)</option><option value="contactMission">Lower-Threat mission Contact time</option><option value="contactFeat">Initial contact feat (chosen contact)</option><option value="charmer">Charmer (confirmed Influence NPC)</option><option value="hardCore">Hard Core (confirmed Influence NPC)</option><option value="solution">10-Second Solution (declare below)</option><option value="questionsI">All the Right Questions I (Field Analyst 3; error +1)</option><option value="questionsII">All the Right Questions II (Field Analyst 7; error +2)</option></select></label>
            <label><input type="checkbox" name="unopposed" /> Unopposed check</label>
            ${this.system.activeFeatNames?.some(n=>['Always Get Your Man','Escape and Evasion Training'].includes(n))?'<label>Role for this manhunt check <select name="manhuntRole"><option value="">Not a manhunt</option><option value="predator">Predator</option><option value="prey">Prey</option></select></label><label>Role for this chase Maneuver <select name="chaseRole"><option value="">Not a chase Maneuver</option><option value="predator">Predator</option><option value="prey">Prey</option></select></label>':''}
            <label><input type="checkbox" name="crossCheckActive" /> Cross-Check: triple time for an active check</label>
            ${key==='bluff'&&this.system.activeFeatNames?.includes('Superior Documentation')?'<fieldset><legend>Superior Documentation</legend><label><input name="usingCoverIdentity" type="checkbox" /> Use the +1 gear bonus while using a cover identity</label><label>Cover identity name <input name="coverIdentityName" maxlength="200" /></label><label><input name="coverIdentityConfirmed" type="checkbox" /> The GC confirms I am using this cover identity for this Bluff check</label></fieldset>':''}
            ${['sleightOfHand','sneak'].includes(key)&&this.system.activeFeatNames?.includes('Bug Basics')?'<fieldset><legend>Bug Basics — Stash Item only</legend><label><input name="concealingBug" type="checkbox" /> Use the +2 gear bonus to conceal a bug</label><label>Bug name <input name="bugName" maxlength="200" /></label><label><input name="bugConcealmentConfirmed" type="checkbox" /> The GC confirms this Stash Item check conceals this bug</label></fieldset>':''}
            <label><input type="checkbox" name="usingComputer" /> Research is being performed using a computer</label>
            <label><input type="checkbox" name="installingTrap" /> Installation is setting a trap</label>
            <label><input type="checkbox" name="surprise" /> This check determines surprise</label>
            <label><input type="checkbox" name="deafened" /> Additional deafness for this check (Improved hearing cannot apply)</label>
            <label><input type="checkbox" name="blinded" /> Additional blindness for this check</label>
            <label><input type="checkbox" name="targetDeafened" /> This check targets a deafened character (Language cap −20)</label>
            <label><input type="checkbox" name="requiresEyesight" /> The GC confirms this check requires eyesight or eye-hand coordination</label>
            <label><input type="checkbox" name="requiresHearing" /> The GC confirms this check requires hearing</label>
            <label><input type="checkbox" name="targetCharacter" /> Night Training: this check targets a character</label>
            <label>Distance to that character (ft., Night Training) <input name="distanceFeet" type="number" min="0" step="any" /></label>
            <label><input type="checkbox" name="scentUsable" /> I can rely on scent for this Tracking check (Improved scent)</label>
            <label>Fog/smoke <select name="obscurant"><option value="">Unspecified</option><option value="fog">Fog</option><option value="smoke">Smoke</option></select></label>
            <label>Fog/smoke density <select name="obscurantDensity"><option value="">Unspecified</option>${Object.entries(FOG_SMOKE).map(([id,row])=>`<option value="${id}">${row.label}</option>`).join('')}</select></label>
            <label>Ambient light <select name="ambientLight"><option value="">Unspecified / resolve at table</option>${Object.entries(AMBIENT_LIGHT).map(([id,row])=>`<option value="${id}">${row.label}</option>`).join('')}</select></label>
          </details>
          <details><summary>Terrain feat circumstances</summary>
            <label><input type="checkbox" name="homeTurf" /> Within my home turf: five-block urban radius or one-mile wilderness radius of home</label>
            <label>Local Hero: opposing skill <select name="opposingSkill"><option value="">Choose only for Local Hero opposition</option>${LOCAL_HERO_OPPOSITION_SKILLS.map(key=>`<option value="${key}">${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`).join('')}</select></label>
            <label><input type="checkbox" name="targetingYou" /> The opposing check targets me (Local Hero)</label>
            <label>Terrain <select name="terrain"><option value="">Unspecified</option>${Object.entries(TERRAIN_TYPES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>
            <label><input type="checkbox" name="underwater" /> I am underwater (general check penalty; Aquatic Training circumstances)</label>
            <label><input type="checkbox" name="navigating" /> This check is made to navigate</label>
            <label><input type="checkbox" name="naturalSurface" /> This footing/climbing check uses a natural surface</label>
            <label><input type="checkbox" name="hearingCheck" /> This Notice check uses hearing (Swamp Training)</label>
            <label>City population here (0 outside a city) <input type="number" name="cityPopulation" min="0" step="1" value="0" /></label>
            <label><input type="checkbox" name="nightAmbush" /> This ambush is planned at night or in darkness (Night Training)</label>
          </details>
          <details><summary>Tracking circumstances</summary>
            <label>Surface (required for Survival/Tracking) <select name="trackingSurface"><option value="">Choose the trail surface</option>${Object.entries(TRACKING_SURFACES).map(([id,row])=>`<option value="${id}">${row.label}</option>`).join('')}</select></label>
            <label>Hours since tracks were left <input type="number" name="trackingAgeHours" min="0" step="any" value="0" /></label>
            <label>Hours of rain/snow since tracks were left <input type="number" name="trackingWeatherHours" min="0" step="any" value="0" /></label>
            <label><input type="checkbox" name="trackingLargeGroup" /> Target group has more than three characters</label>
            <label>Tracking pace <select name="trackingPace"><option value="half">Up to half Speed</option><option value="full">Up to full Speed</option><option value="faster">Faster than full Speed</option></select></label>
            <label><input type="checkbox" name="followingPhysicalTrail" /> I am following a physical trail (Tracking Mastery surprise bonus)</label>
          </details>
          <details><summary>Nest — Sniper Perfect Killer</summary>
            <label><input type="checkbox" name="nest" /> Substitute Tactics skill bonus for Hide to avoid being spotted</label>
            <label><input type="checkbox" name="nestHalfCoverConfirmed" /> I benefit from at least half cover and this check avoids being spotted</label>
            <label>Tactics attribute <select name="nestAbility"><option value="">Tactics default</option><option value="wis">WIS</option><option value="cha">CHA</option></select></label>
          </details>
          ${this.system.activeFeatNames?.includes('I Can Swim')?'<label><input type="checkbox" name="iCanSwim" /> I Can Swim: spend saved skill points in this skill as a free action before this check</label>':''}
          <details><summary>Limited abilities and action dice</summary>
            <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce this error range by INT modifier (once/scene; twice at 7)</label>
            <label><input type="checkbox" name="allAccordingToPlan" /> All According to Plan: Schemer 4, use Intelligence for this check (session uses equal starting action dice)</label>
            <label><input type="checkbox" name="iKnowWhatDoing" /> …I Know What I’m Doing.: Stuntman 8, required bonus d10 for this STR/DEX check (once/scene)</label><label>DC for this bonus <input type="number" name="difficultyClass" step="1" placeholder="Must exceed Career Level +20" /></label>
            <label><input type="checkbox" name="tenSecondSolution" /> 10-Second Solution: Scientist 14, natural 20 on this Intelligence skill (once/session)</label><label><input type="checkbox" name="standaloneCheckConfirmed" /> This check is outside any Complex Task or Dramatic Conflict</label>
            <label><input type="checkbox" name="littleDetails" /> Little Details: Athletics/Smash as a free action (shared session and round limits)</label>
            <label><input type="checkbox" name="oneInAMillion" /> One in a Million: Soldier 14, natural 20 on a STR/CON skill check (once/session)</label>
            <label><input type="checkbox" name="breakthrough" /> Breakthrough: Virtuoso 10, substitute the key skill’s total bonus (once/scene)</label><label>Key skill attribute <select name="breakthroughAbility"><option value="">Key skill default</option>${['str','dex','con','int','wis','cha'].map(a=>`<option value="${a}">${a.toUpperCase()}</option>`).join('')}</select></label>
            <label>Bright Idea source <select name="brightIdeaSource"><option value="">Automatic available source</option>${this.limitedUseStatus.filter(s=>s.workflow==='brightIdea').map(s=>`<option value="${esc(s.id)}">${esc(s.name)}: ${s.remaining} remaining</option>`).join('')}</select></label>
            <label><input type="checkbox" name="brightIdea" /> Bright Idea: roll twice and choose (INT/WIS skill checks)</label>
            ${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({perBenefit:true,unrolled:true})}<label><input type="checkbox" name="hailMaryUntrained" /> Hail Mary: remove untrained error increase (1 die)</label>
            <label><input type="checkbox" name="hailMaryUncap" /> Hail Mary: lift the result cap (3 dice)</label>
            <label><input type="checkbox" name="hailMaryActive" /> Hail Mary: make passive/secret check active (4 dice)</label>
          </details>
          ${attributeCollapsePlan(this.system).conditions.includes('Paralyzed')||this.system.conditionContext?.paralyzed?'<label><input type="checkbox" name="purelyMentalConfirmed" /> The GC confirmed this is a purely mental action (paralysis)</label>':''}
          <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
          <label><input type="checkbox" name="secret" /> Secret when the check permits either type</label></div>`
      });
      if (!input) return null;
    }
    for(const field of ['stanceDistanceFeet','conveyanceBullRushAllowanceFeet','conveyanceBullRushDistanceFeet','bullRushAttackSizeDifference','bullRushAttackDistanceFeet','bullRushSizeDifference','tumbleDistanceFeet','tumbleAdjacentEnemySquares','tumbleOccupiedSquares','tripAttackSizeDifference','tripSizeDifference','fallDistanceFeet','balanceDistanceFeet','hideAreaPeople','hideDistanceFeet','threatenDistanceFeet','threatenVitalityLoss','threatenWoundLoss'])if(typeof input[field]==='string')input={...input,[field]:input[field].trim()?Number(input[field]):null};
    if(typeof input.grappleProficient==='string')input={...input,grappleProficient:input.grappleProficient==='true'?true:input.grappleProficient==='false'?false:null};
    if(typeof input.grappleSizeDifference==='string')input={...input,grappleSizeDifference:input.grappleSizeDifference.trim()?Number(input.grappleSizeDifference):null};
    const check = checks.find(c => c.id === input.check);
    const gearItem=input.gearItem?this.items?.get?.(input.gearItem):null;
    const workTarget=()=>input.weaponWork===true&&input.weaponWorkItemId?this.items?.get?.(input.weaponWorkItemId):null;
    if(input.weaponWork===true&&input.weaponWorkItemId&&workTarget()?.type!=='weapon')return ui.notifications.warn('Choose an actual target weapon/model or confirm its specifications again.');
    if(input.gearItem&&(!gearItem||!['weapon','armor','gear'].includes(gearItem.type)||isResourceLock(gearItem)||gearItem.system.reserve||gearItem.system.destroyed||gearItem.system.quantity===0||possessionUnavailable(gearItem.system)))return ui.notifications.warn("Choose available gear being used for this check.");
    if(check?.id==='restraint-escape'&&restraintRollSource.sources.length>1&&input.grappleAllSourcesConfirmed!==true)throw new Error('Confirm which restraint sources belong to this grapple before rolling.');
    if(check?.id==='restraint-escape'&&this.system.size!==restraintRollSize)throw new Error('Size changed while choosing this grapple check.');
    if(check?.id==='restraint-escape'&&JSON.stringify(restraintSourceSnapshot(this))!==JSON.stringify(restraintRollSource))throw new Error('The grapple sources changed while choosing this check.');
    let result = resolveSkillCheck(this.system, key, check, { ...this.sensoryContext(input),...feintTargetInput(input,this),...tripAttackTargetInput(input,this,{key,check}),...tripDefenseTargetInput(input,this,{key,check}),...targetSkillContext(input,key),...detectionObserverContext(input), gearItem,weaponWorkItem:workTarget(),gearCategory:equipmentCategory(gearItem), optionalRules, ability: input.ability ?? ability });
    if (!result) return null;
    if (result.blocked) return ui.notifications.warn(result.blockedReason);
    if(!result.actionDiceCost){const split=unrolledPaymentFundingInput(input),fee=surchargeFundingInput(input);if(split.allocations!==undefined||fee.surchargeAllocations!==undefined){try{actionDieBenefitQuote(this,{baseCost:0,benefitCount:0,...split,...fee});}catch(error){return ui.notifications.warn(error.message);}}}
    if(input.iCanSwim===true){const allocation=await this.spendDeferredSkillPoints(key,{...(input.deferredSkillPoints??{}),beforeSkillCheckConfirmed:true});if(!allocation||allocation.review)return null;result=resolveSkillCheck(this.system,key,check,{...this.sensoryContext(input),...feintTargetInput(input,this),...tripAttackTargetInput(input,this,{key,check}),...tripDefenseTargetInput(input,this,{key,check}),...targetSkillContext(input,key),...detectionObserverContext(input),gearItem,weaponWorkItem:workTarget(),gearCategory:equipmentCategory(gearItem),optionalRules,ability:input.ability??ability});if(!result||result.blocked)return ui.notifications.warn(result?.blockedReason??'This check is no longer available.');}

    if(input.breakthrough)breakthroughPlan(this.system,this.items,CONFIG.SPYCRAFT,result,{sourceAbility:input.breakthroughAbility,modifier:input.modifier});
    if(input.nest)nestPlan(this.system,CONFIG.SPYCRAFT,result,{skillKey:key,checkId:check.id,halfCoverConfirmed:input.nestHalfCoverConfirmed,sourceAbility:input.nestAbility,breakthrough:!!input.breakthrough});
    const additionalUses=[...(result.analysisTask?.stage==='pressure'?[{id:result.analysisTask.pressureUseId,workflow:'taskPressure'}]:[]),...(input.wheelFreeManeuver===true?[{id:'oneHandManeuver',workflow:'freeManeuver'}]:[]),...(input.littleDetails===true?[{id:'littleDetails',workflow:'littleDetails'},{id:'littleDetailsRound',workflow:'littleDetailsRound'}]:[]),...(input.breakthrough?[{id:'breakthrough',workflow:'breakthrough'}]:[]),...(input.allAccordingToPlan?[{id:'allAccordingToPlan',workflow:'attributeSubstitution'}]:[]),...(input.cunningPlan?[{id:'cunningPlan',workflow:'cunningPlan'}]:[])];
    const esc = foundry.utils.escapeHTML;
    if([input.oneInAMillion,input.brightIdea,input.iKnowWhatDoing,input.tenSecondSolution].filter(Boolean).length>1)throw new Error("Choose one pre-roll class ability for this check.");
    if(input.iKnowWhatDoing){difficultSkillBonusPlan(this.system,result,{dc:result.weaponFocusWork?.effectiveDC??input.difficultyClass});if(result.rollMode==='blindroll'&&!game.user?.isGM)throw new Error("The GC resolves this bonus for a secret or passive check.");}
    if(input.brightIdea&&key==='search'&&(this.system.classLevels?.fieldAnalyst??0)>=8)return ui.notifications.warn('Eye for Detail already rolls Search twice. Clear Bright Idea to preserve its limited use.');
    if(input.brightIdea&&(result.method!=="roll"||!["int","wis"].includes(result.ability)))return ui.notifications.warn("Bright Idea requires a rolled Intelligence- or Wisdom-based skill check.");
    if(input.brightIdea&&result.rollMode==="blindroll"&&!game.user?.isGM)return ui.notifications.warn("Ask the GC to resolve Bright Idea for this secret or passive check.");
    const brightSource=input.brightIdea?this.resolveBrightIdeaSource(input.brightIdeaSource):null;
    if(input.brightIdea&&!brightSource)return null;
    let difficultGain=null;
    const perform=(requiredBonusPoolId=null,payment=null,{solutionCommitted=false,millionCommitted=false}={})=>{
      if(solutionCommitted&&input.tenSecondSolution!==true||millionCommitted&&input.oneInAMillion!==true)throw new Error('The paid class declaration changed before the skill roll.');
      if(input.weaponWork===true&&input.weaponWorkItemId&&workTarget()?.type!=='weapon')throw new Error('The target weapon/model is no longer available. Confirm the check again.');
      const currentGear=input.gearItem?this.items?.get?.(input.gearItem):null;
      if(input.gearItem&&(!currentGear||isResourceLock(currentGear)||currentGear.system.reserve||currentGear.system.destroyed||currentGear.system.quantity===0||possessionUnavailable(currentGear.system)))throw new Error('The selected gear is no longer available.');
      if(check?.id==='restraint-escape'&&this.system.size!==restraintRollSize)throw new Error('Size changed before this grapple check.');
      if(check?.id==='restraint-escape'&&JSON.stringify(restraintSourceSnapshot(this))!==JSON.stringify(restraintRollSource))throw new Error('The grapple sources changed before the roll.');
      const fresh=resolveSkillCheck(this.system,key,check,{...this.sensoryContext(input),...feintTargetInput(input,this),...tripAttackTargetInput(input,this,{key,check}),...tripDefenseTargetInput(input,this,{key,check}),...targetSkillContext(input,key),...detectionObserverContext(input),gearItem:currentGear,weaponWorkItem:workTarget(),gearCategory:equipmentCategory(currentGear),optionalRules,ability:input.ability??ability});
      let wheelUseProof=null;
      if(!fresh||fresh.blocked||fresh.actionDiceCost!==result.actionDiceCost||fresh.actionDiceBenefits!==result.actionDiceBenefits)throw new Error(fresh?.blockedReason||'This check’s requirements changed. Review it before rolling again.');
      if(input.brightIdea&&key==='search'&&(this.system.classLevels?.fieldAnalyst??0)>=8)throw new Error('Eye for Detail now covers this Search check; preserve Bright Idea and roll again without it.');
      if(input.brightIdea&&(fresh.method!=='roll'||!['int','wis'].includes(fresh.ability)||fresh.rollMode==='blindroll'&&!game.user?.isGM))throw new Error('Bright Idea no longer qualifies for this check.');
      if(input.breakthrough)Object.assign(fresh,breakthroughPlan(this.system,this.items,CONFIG.SPYCRAFT,fresh,{sourceAbility:input.breakthroughAbility,modifier:input.modifier}));
      if(input.nest)Object.assign(fresh,nestPlan(this.system,CONFIG.SPYCRAFT,fresh,{skillKey:key,checkId:check.id,halfCoverConfirmed:input.nestHalfCoverConfirmed,sourceAbility:input.nestAbility,breakthrough:!!input.breakthrough}));
      if(input.iKnowWhatDoing){difficultGain=difficultSkillBonusPlan(this.system,fresh,{dc:fresh.weaponFocusWork?.effectiveDC??input.difficultyClass});if(fresh.rollMode==='blindroll'&&!game.user?.isGM)throw new Error('The GC resolves this secret bonus.');}
      return this.rollCheck(fresh.fixedDie ? `${fresh.fixedDie} + @total` : "1d20 + @total", { total: fresh.total }, {
      flavor: `${esc(skill.name)} / ${esc(check.name)} (${fresh.ability.toUpperCase()})<br><small>${esc(fresh.notes)}</small>`,
      ...(Object.hasOwn(input,'oldSchool')?{oldSchool:input.oldSchool}:{}),solutionCommitted,millionCommitted,tripCounterLease:input.tripCounterLease,stalkingStance:fresh.stalkingStance,feint:fresh.feint,meleeSkillFeats:fresh.meleeSkillFeats,conveyanceBullRush:fresh.conveyanceBullRush,bullRushAttack:fresh.bullRushAttack,bullRushDefense:fresh.bullRushDefense,tumblePath:fresh.tumblePath,tripAttack:fresh.tripAttack,tripDefense:fresh.tripDefense,fallDistance:fresh.fallDistance,balanceSurface:fresh.balanceSurface,hideCircumstances:fresh.hideCircumstances,detectionObserver:fresh.detectionObserver,hideMovement:fresh.hideMovement,targetSkillEffect:fresh.targetSkillEffect,rankSynergyFeats:fresh.rankSynergyFeats,stoneCold:fresh.stoneCold,threaten:fresh.threaten,bugConcealment:fresh.bugConcealment,documentation:fresh.documentation,analysisTask:fresh.analysisTask,trackingFeat:fresh.trackingFeat,trackingMasteryTask:fresh.trackingMasteryTask,forensicGenius:fresh.forensicGenius,closedCourseFeat:fresh.closedCourseFeat,wheelFeat:fresh.wheelFeat,practiceFeat:fresh.practiceFeat,fundedTaking:fresh.fundedTaking,terrainFeat:fresh.terrainFeat,pursuitFeat:fresh.pursuitFeat,professionalFeat:fresh.professionalFeat,refreshPaidSkill:fresh.gamblingDice?(paid,committed)=>perform(requiredBonusPoolId,paid,committed):undefined,contactFeat:fresh.contactFeat,polyglot:fresh.polyglot,charmer:fresh.charmer,cardSharkProfession:fresh.cardSharkProfession,appearanceModifiers:fresh.appearanceModifiers,hardCore:fresh.hardCore,validateSkillContext:fresh.stalkingStance||fresh.feint||fresh.meleeSkillFeats||fresh.conveyanceBullRush||fresh.bullRushAttack||fresh.bullRushDefense||fresh.tumblePath||fresh.tripDefense||fresh.fallDistance||fresh.balanceSurface||fresh.hideCircumstances||fresh.detectionObserver||fresh.hideMovement||fresh.targetSkillEffect||fresh.rankSynergyFeats||fresh.stoneCold||fresh.threaten||fresh.bugConcealment||fresh.documentation||fresh.analysisTask||fresh.trackingFeat||fresh.trackingMasteryTask||fresh.forensicGenius||fresh.closedCourseFeat||fresh.wheelFeat||fresh.practiceFeat||fresh.fundedTaking||fresh.skillGear?.toolShedKit||fresh.terrainFeat||fresh.pursuitFeat||fresh.professionalFeat||fresh.contactFeat||fresh.polyglot||fresh.gamblingDice||fresh.charmer||fresh.hardCore||fresh.appearanceModifiers||fresh.cardSharkProfession?()=>{if(fresh.wheelFeat?.free)wheelUseProof=oneHandManeuverUseProof(this.system,fresh.wheelFeat,wheelUseProof);const liveGear=input.gearItem?this.items?.get?.(input.gearItem):null,now=resolveSkillCheck(this.system,key,check,{...this.sensoryContext(input),...feintTargetInput(input,this),...tripAttackTargetInput(input,this,{key,check}),...tripDefenseTargetInput(input,this,{key,check}),...targetSkillContext(input,key),...detectionObserverContext(input),gearItem:liveGear,weaponWorkItem:workTarget(),gearCategory:equipmentCategory(liveGear),optionalRules,ability:input.ability??ability});if(!now||now.blocked||JSON.stringify([now.stalkingStance,now.feint,now.meleeSkillFeats,now.conveyanceBullRush,now.bullRushAttack,now.bullRushDefense,now.tumblePath,now.tripDefense,now.fallDistance,now.balanceSurface,now.hideCircumstances,now.detectionObserver,now.hideMovement,now.targetSkillEffect,now.rankSynergyFeats,now.stoneCold,now.threaten,now.bugConcealment,now.documentation,now.analysisTask,now.trackingFeat,now.trackingMasteryTask,now.forensicGenius,now.closedCourseFeat,now.wheelFeat,now.practiceFeat,now.fundedTaking,now.skillGear?.toolShedKit,now.terrainFeat,now.pursuitFeat,now.professionalFeat,now.contactFeat,now.polyglot,now.hardCore,now.appearanceModifiers,now.cardSharkProfession,now.charmer,now.gamblingDice])!==JSON.stringify([fresh.stalkingStance,fresh.feint,fresh.meleeSkillFeats,fresh.conveyanceBullRush,fresh.bullRushAttack,fresh.bullRushDefense,fresh.tumblePath,fresh.tripDefense,fresh.fallDistance,fresh.balanceSurface,fresh.hideCircumstances,fresh.detectionObserver,fresh.hideMovement,fresh.targetSkillEffect,fresh.rankSynergyFeats,fresh.stoneCold,fresh.threaten,fresh.bugConcealment,fresh.documentation,fresh.analysisTask,fresh.trackingFeat,fresh.trackingMasteryTask,fresh.forensicGenius,fresh.closedCourseFeat,fresh.wheelFeat,fresh.practiceFeat,fresh.fundedTaking,fresh.skillGear?.toolShedKit,fresh.terrainFeat,fresh.pursuitFeat,fresh.professionalFeat,fresh.contactFeat,fresh.polyglot,fresh.hardCore,fresh.appearanceModifiers,fresh.cardSharkProfession,fresh.charmer,fresh.gamblingDice]))throw new Error('The declared skill modifiers or their feat sources changed before the check was posted.');}:undefined,weaponFocusWork:fresh.weaponFocusWork,restraintEscape:fresh.restraintEscape?{...fresh.restraintEscape,sourceSnapshot:restraintRollSource,sourceScopeConfirmed:restraintRollSource.sources.length===1||input.grappleAllSourcesConfirmed===true}:null,skillBonusCondition:fresh.skillBonusCondition,skillCheckAdjustment:fresh.checkAdjustment,gamblingDice:fresh.gamblingDice,preRollFunding:this.preRollPaymentReceipt(payment),bonusPoolId:input.bonusPoolId??'',hailMary:{untrained:input.hailMaryUntrained===true,uncap:input.hailMaryUncap===true,active:input.hailMaryActive===true,cost:fresh.actionDiceCost},threat: fresh.threat, error: fresh.error, cap: fresh.cap, rollMode: fresh.rollMode, actionDiceAllowed:fresh.actionDiceAllowed, checkMethod:fresh.method,checkKind:"skill",ability:fresh.ability,skillKey:key,checkId:check.id,focus:input.focus||check.name.replace(/ Check$/, ""),practiceMakesPerfect:fresh.practiceMakesPerfect,criticalFailureCostIncrease:fresh.criticalFailureCostIncrease,cleanAndPolished:cleanAndPolishedApplies(this.system,currentGear?.system),gearUuid:currentGear?.uuid??"",crossCheck:fresh.crossCheck,requiredBonusPoolId,oneInAMillion:!!input.oneInAMillion,tenSecondSolution:!!input.tenSecondSolution,standaloneCheckConfirmed:!!input.standaloneCheckConfirmed,inComplexTask:!!input.inComplexTask||!!fresh.analysisTask||key==='analysis'&&input.complexAnalysisTask===true,inDramaticConflict:input.inDramaticConflict===true||input.seductionConflict===true||!!input.manhuntRole||!!input.chaseRole||input.manhuntPrey===true,additionalCost:fresh.actionDiceCost,additionalBenefitCount:fresh.actionDiceBenefits,...surchargeFundingInput(input),...unrolledPaymentFundingInput(input),additionalUses,cunningPlan:fresh.cunningPlan,attributeSubstitution:fresh.attributeSubstitution,localHeroOpposition:fresh.localHeroOpposition,terrain:fresh.terrain,senses:fresh.senses,sensoryConditions:fresh.sensoryConditions,tracking:fresh.tracking,gcTakingPermissionConfirmed:fresh.gcTakingPermissionConfirmed,ambush:fresh.ambush,underwaterContext:fresh.underwaterContext,qualityChecks:fresh.qualityChecks,medical:fresh.medical,littleDetails:fresh.littleDetails?{...fresh.littleDetails,round:this.usagePeriods.round??'initial'}:null,skillTags:fresh.skillTags,skillGear:fresh.skillGear,fogSmoke:fresh.fogSmoke,ambientLight:fresh.ambientLight,nest:fresh.nest,breakthrough:fresh.breakthrough,chooseTwice:!!input.brightIdea,choiceSource:brightSource?.name,choiceResourceId:brightSource?.id,weaponUuid:currentGear?.type==="weapon"?currentGear.uuid:"",weaponQualities:currentGear?.type==="weapon"?currentGear.system.qualities:""
    });
    };
    if(input.iKnowWhatDoing)return this.useLimitedAbility('iKnowWhatDoing',async(status,payment)=>{
      const id=foundry.utils.randomID();if(this.system.bonusActionDice?.[id])throw new Error('This bonus-pool identifier already exists.');
      let message;
      try{
        message=await perform(id,payment);
        const check=message.flags?.spycraft2,pool=checkBonusPool(this.system,difficultGain,{id,messageUuid:message.uuid??message.id,skillKey:key,ability:check.ability,periods:this.usagePeriods});
        await this.update({[`system.bonusActionDice.${id}`]:pool});return message;
      }catch(error){
        if(message){try{await message.delete();}catch(cleanupError){ui.notifications.warn('The skill result may still exist after a bonus-grant failure. Its use and costs remain spent; ask the GC to review the check and bonus before retrying.');return message;}}
        if(this.system.bonusActionDice?.[id])await this.update({[`system.bonusActionDice.-=${id}`]:null});
        throw error;
      }
    },{workflow:'difficultSkillBonus',additionalCost:result.actionDiceCost,additionalBenefitCount:result.actionDiceBenefits,...surchargeFundingInput(input),...unrolledPaymentFundingInput(input),additionalUses,bonusPoolId:input.bonusPoolId??''});
    if(input.oneInAMillion||input.tenSecondSolution)return perform();
    if(input.brightIdea)return this.useLimitedAbility(brightSource.id,(status,payment)=>perform(null,payment),{workflow:"brightIdea",additionalCost:result.actionDiceCost,additionalBenefitCount:result.actionDiceBenefits,...surchargeFundingInput(input),...unrolledPaymentFundingInput(input),additionalUses,bonusPoolId:input.bonusPoolId??''});
    if(additionalUses.length){const [first,...others]=additionalUses;return this.useLimitedAbility(first.id,(status,payment)=>perform(null,payment),{workflow:first.workflow,additionalCost:result.actionDiceCost,additionalBenefitCount:result.actionDiceBenefits,...surchargeFundingInput(input),...unrolledPaymentFundingInput(input),additionalUses:others,bonusPoolId:input.bonusPoolId??''});}
    return result.actionDiceCost?this.spendActionDiceBenefit(result.actionDiceCost,payment=>perform(null,payment),{benefitCount:result.actionDiceBenefits,bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),...unrolledPaymentFundingInput(input),purpose:'Hail Mary skill options',benefit:'hailMary'}):perform();
  }

  async useFinalDeduction(options={}){
    if(!this.isOwner||!hasFinalDeduction(this.system))return ui.notifications.warn('Final Deduction is not currently available.');
    const epoch=String(this.usagePeriods.session??'initial'),study=finalDeductionStudy(this.flags?.spycraft2?.finalDeduction,epoch),esc=foundry.utils.escapeHTML;
    let input=options;
    if(!Object.hasOwn(input,'expectedRound')){
      input=await systemDialog.input({window:{title:'Final Deduction study'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${study?`Continue ${esc(study.target)} after ${study.rounds} completed full rounds. Interruptions within this session preserve progress.`:'Begin one special-character study this session. First observe the target for at least one round in person or by audio/visual recording.'} Each confirmation records one additional completed full round. The GC supplies all revelations; ties and final ordering belong to the GC.</p><label>Target special character <input name="target" value="${esc(study?.target??'')}" ${study?'readonly':''} required /></label>${study?'':'<label><input name="specialCharacterConfirmed" type="checkbox" /> The target is a special character</label><label><input name="observedRoundConfirmed" type="checkbox" /> I previously observed this target for at least one round</label>'}<label><input name="fullRoundConfirmed" type="checkbox" /> I completed another full round studying this target</label>${(study?.rounds??0)>=4?'<label>Next information <select name="stage"><option value="classes">Next class and level</option><option value="skills">Next skill and ranks</option><option value="remaining">Remaining Subplots and proficiencies</option></select></label><label><input name="allClassesKnownConfirmed" type="checkbox" /> All target class names and levels are already known</label><label><input name="allSkillsKnownConfirmed" type="checkbox" /> All target skill names and ranks are already known</label>':''}</div>`});
      if(!input)return null;input={...input,expectedEpoch:epoch,expectedRound:study?.rounds??0};
    }
    return queueResources([this],async()=>{
      if(!this.isOwner)throw new Error('You must own this actor.');
      const currentEpoch=String(this.usagePeriods.session??'initial'),before=structuredClone(this.flags?.spycraft2?.finalDeduction),plan=finalDeductionPlan(this.system,before,currentEpoch,input),updates={'flags.spycraft2.finalDeduction':{epoch:plan.epoch,target:plan.target,rounds:plan.rounds,stage:plan.stage}};
      const previousUse=structuredClone(this.system.resourceUses?.finalDeduction);
      const spec=this.system.limitedUses?.find(s=>s.id==='finalDeduction'&&s.workflow==='finalDeduction');
      if(!spec)throw new Error('Final Deduction is no longer available.');
      if(plan.starting){const use=resourceUsePlan(spec,this.system.resourceUses,this.usagePeriods,this.system.actionDice?.value??0);if(use.blocked)return ui.notifications.warn(use.reason);updates['system.resourceUses.finalDeduction']=use.record;}
      else{const status=resourceStatus(spec,this.system.resourceUses,this.usagePeriods);if(status.counterReview||status.used!==1)throw new Error('The GC must review this study’s session use count.');}
      await this.update(updates);
      try{return await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Final Deduction: ${esc(plan.target)}, study round ${plan.rounds}. The GC supplies: ${esc(plan.revelation)}.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'informationRequest',actionDiceAllowed:false,finalDeduction:plan}}});}
      catch(error){await this.update({...before?{'flags.spycraft2.finalDeduction':before}:{'flags.spycraft2.-=finalDeduction':null},...(plan.starting?(previousUse===undefined?{'system.resourceUses.-=finalDeduction':null}:{'system.resourceUses.finalDeduction':previousUse}):{})});throw error;}
    });
  }

  async useGlobalSearch(options={}){
    const source=globalSearchSource(this.system);if(!this.isOwner||!source)return ui.notifications.warn('Global Search is not currently available.');
    let input=options;
    if(!input.target){input=await systemDialog.input({window:{title:'Record completed Global Search'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Complete ${source.hoursPerLevel} hours × target level while taking only free actions, then record this use. The GC supplies the city or 20-mile × 20-mile area.</p><label>Target special character <input name="target" required /></label><label>GC-supplied target level <input name="targetLevel" type="number" min="1" step="1" required /></label><label>Hours completed <input name="hoursCompleted" type="number" min="0" step="any" required /></label><label><input name="specialCharacterConfirmed" type="checkbox" /> The target is a special character</label><label><input name="onlyFreeActionsConfirmed" type="checkbox" /> I performed no other non-free actions during the required search time</label></div>`});if(!input)return null;}
    globalSearchPlan(this.system,input);
    return this.useLimitedAbility('globalSearch',()=>{const plan=globalSearchPlan(this.system,input);return ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Global Search: ${foundry.utils.escapeHTML(plan.target)}; ${plan.requiredHours} hours completed. The GC supplies the city or 20-mile × 20-mile area containing this special character.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'informationRequest',actionDiceAllowed:false,globalSearch:plan}}});},{workflow:'globalSearch'});
  }

  async useLittleDetails(options={}){
    if(!this.isOwner||!littleDetailsSource(this.system))return ui.notifications.warn('Little Details is not currently available.');
    let input=options;
    if(!input.action){input=await systemDialog.input({window:{title:'Little Details'},rejectClose:false,content:'<div class="spycraft2-roll-options"><label>Free action <select name="action"><option value="smash">Athletics/Smash</option><option value="disarm">Disarm</option><option value="feint">Feint</option><option value="tire">Tire</option></select></label><label>Target / note <input name="target" /></label><label>Smash situational modifier <input type="number" name="modifier" value="0" /></label><label><input type="checkbox" name="actionLegalConfirmed" /> Normal target/action requirements are satisfied; spend the free action</label><p>Consumes one session use and this round’s allowance. Disarm/Feint/Tire resolution remains at the table. Smash rolls normally, including skill cap/error and any applicable conditions.</p></div>'});if(!input)return null;}
    if(!['smash','disarm','feint','tire'].includes(input.action)||input.actionLegalConfirmed!==true)throw new Error('Confirm one legal Little Details action and its normal requirements.');
    if(input.action==='smash')return this.rollSkill('athletics','str',{...input,check:'smash',littleDetails:true});
    return this.useLimitedAbility('littleDetails',()=>ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Little Details: ${foundry.utils.escapeHTML(input.action)} as a free action${input.target?' targeting '+foundry.utils.escapeHTML(input.target):''}. Resolve the normal action at the table.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'actionDeclaration',actionDiceAllowed:false,littleDetails:{action:input.action,target:String(input.target??''),round:this.system.resourceUses?.littleDetailsRound?.epoch??this.usagePeriods.round??'initial',freeAction:true}}}}),{workflow:'littleDetails',additionalUses:[{id:'littleDetailsRound',workflow:'littleDetailsRound'}]});
  }

  resolveBrightIdeaSource(id=''){
    const status=brightIdeaPoolStatus(this.system,this.usagePeriods);
    if(status.needsReview){ui.notifications.warn('The GC must allocate legacy combined Bright Idea uses on Classes first.');return null;}
    const available=this.limitedUseStatus.filter(s=>s.workflow==='brightIdea');
    const source=id?available.find(s=>s.id===id):available.find(s=>s.remaining>0)??available[0];
    if(!source){ui.notifications.warn('No matching Bright Idea source is available.');return null;}
    return source;
  }

  async rollKnowledge(options={}) {
    let input=options;const esc=foundry.utils.escapeHTML;
    if(!input.skill){
      input=await systemDialog.input({window:{title:"Knowledge"},rejectClose:false,content:`<div class="spycraft2-roll-options">
        <label>Question or task <input name="topic" /></label><label><input name="underwater" type="checkbox" /> I am underwater (standard skill-check penalty)</label>
        <label>GC-selected relevant skill <select name="skill">${Object.entries(CONFIG.SPYCRAFT.skills).map(([key,skill])=>`<option value="${key}">${esc(skill.name)}</option>`).join("")}</select></label>
        ${this.system.activeFeatNames?.includes('Card Shark')?'<label>Card Shark gambling Knowledge <select name="gamblingKnowledge"><option value="">Ordinary Knowledge scope</option><option value="rules">Gambling rules</option><option value="people">Major gamblers, their winnings and debts</option><option value="locations">Casinos and other gaming locations</option></select></label><p>A question in a selected Card Shark category is active. Taking 10/20 still requires Photographic Memory.</p>':''}
        <label>Relevant focus <input name="focus" /></label>
        <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
        <label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10 — 1 round (Photographic Memory)</option><option value="take20">Take 20 — 1 minute (Photographic Memory)</option></select></label>
        <label><input type="checkbox" name="active" /> Active check (Photographic Memory)</label>
        <label><input type="checkbox" name="safeToTake" /> Neither distracted nor endangered</label>
        <label><input type="checkbox" name="breakthrough" /> Breakthrough: Virtuoso 10, substitute the key skill’s total bonus (once/scene)</label><label>Key skill attribute <select name="breakthroughAbility"><option value="">Key skill default</option>${['str','dex','con','int','wis','cha'].map(a=>`<option value="${a}">${a.toUpperCase()}</option>`).join('')}</select></label>
            <label>Bright Idea source <select name="brightIdeaSource"><option value="">Automatic available source</option>${this.limitedUseStatus.filter(s=>s.workflow==='brightIdea').map(s=>`<option value="${esc(s.id)}">${esc(s.name)}: ${s.remaining} remaining</option>`).join('')}</select></label>
        <label><input type="checkbox" name="brightIdea" /> Bright Idea: roll twice and choose (uses the same source pool as Skills)</label>
        <label><input type="checkbox" name="tenSecondSolution" /> 10-Second Solution: Scientist 14, natural 20 (same session use as Skills; minimum 1 full action)</label>
        <label><input type="checkbox" name="standaloneCheckConfirmed" /> This check is outside any Complex Task or Dramatic Conflict</label>
        <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce the error range (shared scene uses)</label><p>The GC resolves class abilities on passive Knowledge checks. Named-skill abilities do not apply merely because that skill supplies Knowledge synergy.</p></div>`});
      if(!input)return null;
    }
    const result=resolveKnowledgeCheck(this.system,input);
    if(result.blocked)return ui.notifications.warn(result.blockedReason);
    if(input.breakthrough)breakthroughPlan(this.system,this.items,CONFIG.SPYCRAFT,result,{checkKind:'knowledge',sourceAbility:input.breakthroughAbility,modifier:input.modifier});
    const additionalUses=[...(input.breakthrough?[{id:'breakthrough',workflow:'breakthrough'}]:[]),...(input.cunningPlan?[{id:'cunningPlan',workflow:'cunningPlan'}]:[])];
    if(input.brightIdea&&input.tenSecondSolution)throw new Error('Choose one pre-roll class ability for Knowledge.');
    if(input.brightIdea&&result.method!=='roll')throw new Error('Bright Idea requires a rolled Knowledge check.');
    if((input.brightIdea||input.tenSecondSolution)&&result.rollMode==='blindroll'&&!game.user?.isGM)throw new Error('The GC resolves class abilities for passive Knowledge checks.');
    const brightSource=input.brightIdea?this.resolveBrightIdeaSource(input.brightIdeaSource):null;if(input.brightIdea&&!brightSource)return null;
    const perform=()=>{
      const fresh=resolveKnowledgeCheck(this.system,input);if(fresh.blocked)throw new Error(fresh.blockedReason);
      if(input.breakthrough)Object.assign(fresh,breakthroughPlan(this.system,this.items,CONFIG.SPYCRAFT,fresh,{checkKind:'knowledge',sourceAbility:input.breakthroughAbility,modifier:input.modifier}));
      if((input.brightIdea||input.tenSecondSolution)&&fresh.rollMode==='blindroll'&&!game.user?.isGM)throw new Error('The GC resolves this passive Knowledge ability.');
      return this.rollCheck(fresh.fixedDie?`${fresh.fixedDie} + @total`:"1d20 + @total",{total:fresh.total},{photographicMemory:fresh.photographicMemory,cardSharkKnowledge:fresh.cardSharkKnowledge,validateSkillContext:fresh.cardSharkKnowledge||fresh.photographicMemory?()=>{const now=resolveKnowledgeCheck(this.system,input);if(now.blocked||JSON.stringify([now.cardSharkKnowledge,now.photographicMemory])!==JSON.stringify([fresh.cardSharkKnowledge,fresh.photographicMemory]))throw new Error('The Knowledge scope, method or supporting feat source changed before posting.');}:undefined,flavor:`Knowledge${input.topic?`: ${esc(input.topic)}`:""}<br><small>${esc(fresh.notes)}</small>`,threat:fresh.threat,error:fresh.error,cap:fresh.cap,rollMode:fresh.rollMode,actionDiceAllowed:fresh.actionDiceAllowed,checkMethod:fresh.method,checkKind:"knowledge",...(Object.hasOwn(input,'oldSchool')?{oldSchool:input.oldSchool}:{}),skillBonusCondition:fresh.skillBonusCondition,skillCheckAdjustment:fresh.checkAdjustment,underwaterContext:fresh.underwaterContext,skillKey:input.skill,focus:input.focus||"",ability:"int",cunningPlan:fresh.cunningPlan,breakthrough:fresh.breakthrough,additionalUses,chooseTwice:!!input.brightIdea,choiceSource:brightSource?.name,choiceResourceId:brightSource?.id,tenSecondSolution:!!input.tenSecondSolution,standaloneCheckConfirmed:!!input.standaloneCheckConfirmed,inComplexTask:!!input.inComplexTask,inDramaticConflict:!!input.inDramaticConflict});
    };
    if(input.brightIdea)return this.useLimitedAbility(brightSource.id,()=>perform(),{workflow:'brightIdea',additionalUses});
    if(additionalUses.length&&!input.tenSecondSolution){const [first,...others]=additionalUses;return this.useLimitedAbility(first.id,()=>perform(),{workflow:first.workflow,additionalUses:others});}
    return perform();
  }

  manageTakedown(input={}){return manageTakedown(this,input);}
  rollTakedown(input={}){return rollTakedown(this,input);}
  settleTakedown(message){return settleTakedown(this,message);}
  manageMeleeTradeoff(){return manageMeleeTradeoff(this);}
  manageCheapShots(){return manageCheapShots(this);}
  settleCheapShot(message){return settleCheapShot(this,message);}
  rollCheapShotRecovery(source){return rollCheapShotRecovery(this,source);}
  settleCheapShotRecovery(message){return settleCheapShotRecovery(this,message);}

  async rollAttack(item,options={}) {
    await validateCheapShotTarget(this,options.cheapShot,{targetUuid:options.characterTarget?.actorUuid||options.targetActorUuid||options.finalAttack?.opponentUuid||options.finalAttack?.targetUuid});
    if(options.freeFinalAttack&&options.disarm)throw new Error('A final attack cannot combine with a Disarm action.');
    if(options.freeFinalAttack&&(!(options.twoWeaponFinalAttack||options.finalAttack)||typeof options.validateFinalAttack!=='function'))throw new Error('Use the final-attack control to reserve this opportunity.');
    if(options.freeFinalAttack){const reservation=this._finalAttackReservation,sourceValidator=options.validateFinalAttack;validateFinalRoundReservation(this,reservation);options={...options,finalAttackRound:{...reservation.record,nauseated:reservation.nauseated},validateFinalAttack:async()=>{validateFinalRoundReservation(this,reservation);await sourceValidator();validateFinalRoundReservation(this,reservation);}};}
    const initialCQB=cqbRangePlan(this.system,item.system,options);
    if(options.askContext||gameHunterAttack(this.system).earned&&typeof options.targetAnimal!=='boolean'||initialCQB.active&&(!initialCQB.known||initialCQB.mastery&&initialCQB.within&&typeof options.targetOpponentConfirmed!=='boolean')){
      const needsCQB=cqbRangePlan(this.system,item.system,options).active;
      const input=await systemDialog.input({window:{title:'Attack circumstances'},rejectClose:false,content:`<div class="spycraft2-roll-options">${reachIncreaseFeet(item.system.qualities??'')?reachContextContent(options):''}${cleaveTargetRequired(this,item.system)?characterTargetContent(this,options):observedAttackTargetContent(this,options)}<label><input type="checkbox" name="targetFlanked" /> I am flanking this opponent with this attack, satisfying the applicable position, ready-weapon and Reach/CQB requirements (p.341)</label><label><input type="checkbox" name="targetPinnedAdjacent" /> Target is pinned and I am adjacent (+4 melee/unarmed attack)</label><label><input type="checkbox" name="targetAnimal" /> This attack targets an animal (Scout Game Hunter, p.43)</label>${cqbRangedWeapon(item.system)?meleeFireContextContent(options)+quickRangedAimContent(options)+bullseyeContent(this,options):quickAttackActionContent(options)+allOutAttackContent(this,options)+meleeTrickContent(this,options)}${needsCQB?`<label>CQB target distance (feet) <input name="distanceFeet" type="number" min="0" step="any" required value="${Number.isFinite(options.distanceFeet)?options.distanceFeet:''}" /></label><label><input name="targetOpponentConfirmed" type="checkbox" /> This attack targets an opponent (CQB Mastery threat benefit)</label>`:''}</div>`});
      if(!input)return null;
      const cqbInput=needsCQB?{distanceFeet:typeof input.distanceFeet==='number'?input.distanceFeet:typeof input.distanceFeet==='string'&&input.distanceFeet.trim()?Number(input.distanceFeet):NaN,targetOpponentConfirmed:input.targetOpponentConfirmed===true}:{};
      if(needsCQB&&(!Number.isFinite(cqbInput.distanceFeet)||cqbInput.distanceFeet<0))throw new Error('Enter the actual finite nonnegative CQB attack distance.');
      options={...options,...(cqbRangedWeapon(item.system)?quickRangedAimInput(input):quickAttackActionInput(input)),...reachContextInput(input),...allOutAttackInput(input),...bullseyeInput(input),...meleeTrickInput(input),...cqbInput,...(Object.hasOwn(input,'targetActorUuid')?{targetActorUuid:input.targetActorUuid,targetCharacterType:input.targetCharacterType,targetName:input.targetName,characterTarget:undefined}:{}),firingOutOfMelee:input.firingOutOfMelee===true,firingIntoMelee:input.firingIntoMelee===true,askContext:false,targetPinnedAdjacent:input.targetPinnedAdjacent===true,targetAnimal:!!input.targetAnimal,targetFlanked:!!input.targetFlanked};
    }
    if(options.disarm?.role!=='defender'&&reachIncreaseFeet(item.system.qualities??'')&&(typeof options.reachAdjacent!=='boolean'||options.reachGeometryConfirmed!==true)){
      const input=await systemDialog.input({window:{title:'Reach weapon — actual target geometry'},rejectClose:false,content:'<div class="spycraft2-roll-options">'+reachContextContent(options)+'</div>'});if(!input)return null;options={...options,...reachContextInput(input)};
      if(typeof options.reachAdjacent!=='boolean'||options.reachGeometryConfirmed!==true)throw Error('Confirm actual target adjacency and legal Reach geometry before this attack.');
    }
    const completedTarget=await completeCharacterTarget(this,item.system,options,{prompt:!options.freeFinalAttack});if(!completedTarget)return null;options=completedTarget;
    const declaredTargetUuid=options.characterTarget?.actorUuid||options.targetActorUuid||null;
    const validateDeclaredTarget=()=>{if((options.characterTarget?.actorUuid||options.targetActorUuid||null)!==declaredTargetUuid||declaredTargetUuid&&!attackCharacterTargetChoices().some(a=>a.uuid===declaredTargetUuid))throw Error('The explicitly selected attack target changed or is no longer an observed character.');};validateDeclaredTarget();
    let feintBonusProof=null,sideStanceProof=null;const feintContext=()=>({...options,feintBonusProof,sideStanceProof});
    const w = item.system;
    const atk = this.weaponAttack(item,feintContext());
    feintBonusProof=atk.feintBonus.attackBonus?{...atk.feintBonus,attemptId:foundry.utils.randomID()}:atk.feintBonus;
    sideStanceProof=atk.sideStance.dice?{...atk.sideStance,attemptId:foundry.utils.randomID()}:atk.sideStance;
    if(atk.blocked)return ui.notifications.warn(atk.reason);
    if(options.attackAction==="standard"&&atk.firearm&&atk.fireMode!=="single")return ui.notifications.warn("A Standard Attack requires Single-Shot mode.");
    const meleeSnapshot=atk.meleeFire?.applies?JSON.stringify(atk.meleeFire):null;
    const trainedOnly=atk.trainedOnly?{...atk.trainedOnly,weaponId:item.id??item._id??null}:null;
    const quirky=atk.quirky?{...atk.quirky,weaponId:item.id??item._id??null}:null;
    const superiorAccuracy=atk.superiorAccuracy?{...atk.superiorAccuracy,weaponId:item.id??item._id??null}:null;
    const accurized=atk.accurized?{...atk.accurized,weaponId:item.id??item._id??null}:null;
    const finesseSnapshot=JSON.stringify({reach:atk.reach,whirling:atk.flanking?.whirling??null,meleeArmorPiercing:atk.meleeArmorPiercing.evidence,meleeTrick:meleeTrickSourceFacts(atk.meleeTrick),bullseye:atk.bullseye,meleeTradeoff:atk.meleeTradeoff,sideStance:atk.sideStance,feintBonus:atk.feintBonus,missTrickSources:missTrickSourceFacts(atk.missTrickSources),cheapShot:atk.cheapShot,quirky,superiorAccuracy,trainedOnly,accurized,increase:atk.finesseThreatIncrease??0,cleaveThreat:atk.cleave?.threatIncrease??0,ranged:atk.ranged,basic:atk.finesseBasic,massive:atk.massive});
    const validateAttackContext=async()=>{validateDeclaredTarget();await validateCharacterTarget(options.characterTarget);await options.validateAttackContext?.();await validateCharacterTarget(options.characterTarget);const current=item.id&&this.items?.get?this.items.get(item.id):item;if(!current)throw new Error('The attack weapon no longer exists.');const preview=this.weaponAttack(current,feintContext());if(meleeSnapshot&&JSON.stringify(preview.meleeFire)!==meleeSnapshot)throw new Error('The ranged melee-fire circumstances or CQB waiver source changed during the attack.');if(JSON.stringify({reach:preview.reach,whirling:preview.flanking?.whirling??null,meleeArmorPiercing:preview.meleeArmorPiercing.evidence,meleeTrick:meleeTrickSourceFacts(preview.meleeTrick),bullseye:preview.bullseye,meleeTradeoff:preview.meleeTradeoff,sideStance:preview.sideStance,feintBonus:preview.feintBonus,missTrickSources:missTrickSourceFacts(preview.missTrickSources),cheapShot:preview.cheapShot,quirky:preview.quirky?{...preview.quirky,weaponId:current.id??current._id??null}:null,superiorAccuracy:preview.superiorAccuracy?{...preview.superiorAccuracy,weaponId:current.id??current._id??null}:null,trainedOnly:preview.trainedOnly?{...preview.trainedOnly,weaponId:current.id??current._id??null}:null,accurized:preview.accurized?{...preview.accurized,weaponId:current.id??current._id??null}:null,increase:preview.finesseThreatIncrease??0,cleaveThreat:preview.cleave?.threatIncrease??0,ranged:preview.ranged,basic:preview.finesseBasic,massive:preview.massive})!==finesseSnapshot)throw new Error('The attack weapon, proficiency or Finesse threat source changed during the attack (including conditional weapon qualities and Cleave threat).');};
    const cqbSnapshot=atk.cqbRange?.active?JSON.stringify(atk.cqbRange):null;
    const validateCQBRange=cqbSnapshot?()=>{const current=item.id&&this.items?.get?this.items.get(item.id):item;if(!current||JSON.stringify(this.weaponAttack(current,feintContext()).cqbRange)!==cqbSnapshot)throw new Error('CQB source, weapon or range changed during this attack.');}:null;
    const millionDollar=!!options.millionDollarSkill;
    if(millionDollar){
      const plan=millionDollarSkillPlan(this.system,w,options);if(plan.blocked)return ui.notifications.warn(plan.reason);
      if(options.oneInAMillion)return ui.notifications.warn('Choose one attack roll-choice/declaration ability.');
      if(!options.millionDollarSkillCommitted)return this.useLimitedAbility('millionDollarSkill',()=>{
        const current=item.id&&this.items?.get?this.items.get(item.id):item;if(!current)throw new Error('The chosen weapon was removed.');
        const eligible=millionDollarSkillPlan(this.system,current.system,options),preview=this.weaponAttack(current,feintContext());
        if(eligible.blocked||preview.blocked||options.attackAction==='standard'&&preview.firearm&&preview.fireMode!=='single')throw new Error(eligible.reason||preview.reason||'The current attack no longer qualifies.');
        return this.rollAttack(current,{...options,millionDollarSkillCommitted:true});
      },{workflow:'millionDollarSkill',additionalUses:options.cunningPlan?[{id:'cunningPlan',workflow:'cunningPlan'}]:[]});
    }
    const cunning=millionDollar&&options.cunningPlan?cunningPlanEffect(this.system,atk.error):null;

    const tripPenalty=options.finalAttack?.source==='trip'?4:0;
    const message=await this.rollCheck("1d20 + @total", { total: atk.total-tripPenalty }, {
      flavor: `${game.i18n.localize("SPYCRAFT.Attack")}: ${foundry.utils.escapeHTML(item.name)}${tripPenalty?' — Trip final attack −4':''}${atk.trained ? "" : ` — ${game.i18n.localize("SPYCRAFT.Weapon.Untrained")}`}${atk.notes?`<br><small>${foundry.utils.escapeHTML(atk.notes)}</small>`:""}`,
      strikingLease:options.strikingLease,tripFinalLease:options.tripFinalLease,validateCQBRange,finalAttackRound:options.finalAttackRound,finalAttack:options.finalAttack,twoWeaponFinalAttack:options.twoWeaponFinalAttack,validateFinalAttack:options.validateFinalAttack,validateAttackContext,threat: atk.threat, error: cunning?.error??atk.error,cunningPlan:cunning??!!options.cunningPlan,chooseTwice:millionDollar,choiceSource:'Million Dollar Skill',choiceResourceId:millionDollar?'millionDollarSkill':'',oneInAMillion:!!options.oneInAMillion,checkKind:"attack",ability:atk.ability,weaponUuid:item.uuid,weaponProficiency:atk.proficiency??w.proficiency,meleeArmorPiercing:atk.meleeArmorPiercing.evidence,weaponQualities:atk.effectiveQualities??w.qualities,cleanAndPolished:cleanAndPolishedApplies(this.system,w),gearUuid:item.uuid,attackContext:{reach:atk.reach,reachAdjacent:options.reachAdjacent??null,reachGeometryConfirmed:options.reachGeometryConfirmed===true,meleeFeatTrick:atk.meleeTrick?.key??null,meleeTrick:atk.meleeTrick,bullseye:atk.bullseye,meleeTradeoff:atk.meleeTradeoff,grippingStance:grippingAttackProof(this.system,{...w,id:item.id??item._id},{ranged:atk.ranged,hands:options.hands??w.useHands??0}),sideStance:sideStanceProof,feintBonus:feintBonusProof,combatStance:combatStanceProof(this.system,{ranged:atk.ranged}),targetActorUuid:declaredTargetUuid,missTrickSources:atk.missTrickSources,cheapShot:atk.cheapShot?.active?atk.cheapShot:null,quirky,superiorAccuracy,trainedOnly,accurized,characterTarget:options.characterTarget??null,cleaveThreatIncrease:atk.cleave?.threatIncrease??0,finesseBasic:atk.finesseBasic,massive:atk.massive,finesseThreatIncrease:atk.finesseThreatIncrease??0,meleeFire:atk.meleeFire?.applies?atk.meleeFire:null,cqbRange:atk.cqbRange?.active?atk.cqbRange:null,disarm:atk.disarm?.active?atk.disarm:null,targetPinnedAdjacent:options.targetPinnedAdjacent===true,pinnedTargetBonus:atk.pinnedTargetBonus,targetProneNonAdjacent:options.targetProneNonAdjacent===true,targetCrouchedNonAdjacent:options.targetCrouchedNonAdjacent===true,targetPosturePenalty:atk.targetPosturePenalty,sensoryConditions:atk.sensoryConditions,mortarOperation:atk.mortarOperation,launcherOperation:atk.launcherOperation,conditionAttackPenalty:atk.conditionAttackPenalty,twoWeaponWaiver:atk.twoWeaponWaiver,targetFlanked:options.targetFlanked===true,flanking:atk.flanking,targetAnimal:options.targetAnimal===true,gameHunter:atk.gameHunter,fogSmoke:atk.fogSmoke,ambientLight:atk.ambientLight,targetVulnerable:options.targetVulnerable===true,millionDollarSkillDeclared:millionDollar,targetFlatFooted:options.targetFlatFooted===true,sniper:atk.sniper,fireMode:atk.fireMode??null,recoil:atk.recoil??0,recoilStrength:atk.recoilStrength??null,recoilPenalty:atk.recoilPenalty,rangeKnown:atk.rangeKnown,distanceFeet:atk.distanceFeet??null,rangeIncrement:atk.range,rangePenalty:atk.rangePenalty,rangePenaltyPerIncrement:atk.rangePenaltyPerIncrement,rangePenaltyBase:atk.rangePenaltyBase??atk.rangePenalty,improvedVisionReduction:atk.improvedVisionReduction??0,sensoryTarget:atk.sensoryTarget??null,maximumRange:atk.maximumRange??null,hands:atk.hands,trained:atk.trained,ranged:atk.ranged,weaponOperation:atk.operation,vehicleMounted:typeof options.vehicleMounted==='boolean'?options.vehicleMounted:undefined,aimed:!!atk.stance.aimed,braced:!!atk.stance.braced,attackAction:atk.stance.attackAction,aimBonus:atk.stance.aimBonus,braceBonus:atk.stance.braceBonus,braceAction:atk.stance.braceAction,ammunitionId:w.loadedAmmoId||null},improvised:!!item.system.improvised
    });
    return message;
  }

  async useOneInAMillion(options={}){
    let input=options;
    if(!input.kind){
      const esc=foundry.utils.escapeHTML;
      input=await systemDialog.input({window:{title:'One in a Million: declare before rolling'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Once per session, Soldier 14 may declare a natural 20 before an attack, Fortitude save or STR/CON skill check. For skills, choose this ability in the skill dialog instead.</p><label>Check <select name="kind"><option value="attack">Weapon attack</option><option value="fort">Fortitude save</option></select></label><label>Weapon for attack <select name="weaponId">${this.items.filter(i=>i.type==='weapon'&&!isResourceLock(i)).map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label></div>`});
      if(!input)return null;
    }
    if(input.kind==='fort')return this.rollSave('fort',{oneInAMillion:true});
    const weapon=this.items.get(input.weaponId);
    if(input.kind!=='attack'||!weapon||weapon.type!=='weapon')throw new Error('Choose an owned weapon or Fortitude save.');
    return this.rollAttack(weapon,{oneInAMillion:true});
  }

  async rollRangedAttack(item,options={}) {
    if(!this.isOwner)return null;
    let input=options;
    if(!Object.keys(input).length){
      const preview=this.weaponAttack(item),esc=foundry.utils.escapeHTML;
      input=await systemDialog.input({window:{title:`Ranged attack: ${item.name}`},rejectClose:false,content:`
        <p>Range increment ${preview.range} ft. Recoil uses your current Strength. Confirm Aim/Brace conditions for this roll. Action costs and Initiative Count changes are applied at the table.</p>
        <label>Target distance (feet) <input type="number" name="distanceFeet" min="0" step="any" required /></label>
        <div class="spycraft2-roll-options">
        <label><input type="checkbox" name="oneInAMillion" /> One in a Million (Soldier 14; once/session)</label>
        <label><input type="checkbox" name="millionDollarSkill" /> Million Dollar Skill: Sniper 10, roll twice and choose (once/round; eligible weapon)</label><label><input type="checkbox" name="targetVulnerable" /> This opponent is vulnerable against this attack</label>
        <label><input type="checkbox" name="targetFlanked" /> I am flanking this opponent with this attack; applicable position, ready-weapon and Reach/CQB requirements are met (p.341)</label>
        <label><input type="checkbox" name="targetPinnedAdjacent" /> Target is pinned and I am adjacent (+4 melee/unarmed attack)</label><label><input type="checkbox" name="targetOpponentConfirmed" /> This attack targets an opponent (CQB Mastery threat benefit)</label><label><input type="checkbox" name="targetAnimal" /> This attack targets an animal (Scout Game Hunter)</label><label><input type="checkbox" name="targetCrouchedNonAdjacent" /> Target is crouched and I am not adjacent (−1 ranged attack)</label><label><input type="checkbox" name="targetProneNonAdjacent" /> Target is prone and I am not adjacent (−2 ranged attack)</label>
        <label><input type="checkbox" name="targetFlatFooted" /> This opponent is flat-footed against this attack (Surprise Shot)</label>
        <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce error range (shared scene uses)</label>
        <label><input type="checkbox" name="vehicleMounted" /> This weapon is mounted on a vehicle for this attack</label>
        <label>Mounted weapon’s normal firing time <select name="weaponOperationTime"><option value="">Unspecified / use its source</option><option value="half">1 half action</option><option value="full">1 full action</option><option value="twoHalf">2 half actions</option></select></label>
        <label>Fog/smoke <select name="obscurant"><option value="">Unspecified</option><option value="fog">Fog</option><option value="smoke">Smoke</option></select></label>
            <label>Fog/smoke density <select name="obscurantDensity"><option value="">Unspecified</option>${Object.entries(FOG_SMOKE).map(([id,row])=>`<option value="${id}">${row.label}</option>`).join('')}</select></label>
            <label>Ambient light <select name="ambientLight"><option value="">Unspecified / resolve at table</option>${Object.entries(AMBIENT_LIGHT).map(([id,row])=>`<option value="${id}">${row.label}</option>`).join('')}</select></label>
        <label><input type="checkbox" name="blinded" /> Additional blindness for this attack</label><label><input type="checkbox" name="deafened" /> Additional deafness for this attack</label><label><input type="checkbox" name="targetCharacter" /> Target is a character (Night Training's nearby hearing exception)</label>
        ${item.system.weaponCategory==='mortar'?'<label><input name="mortarSpaceConfirmed" type="checkbox" /> Mortar is outdoors or in a very large indoor area suitable for its high-arc trajectory</label>':''}${item.system.weaponCategory==='grenadeLauncher'?'<label><input type="checkbox" name="indirectFire" /> Grenade launcher: indirect fire at a target outside line of sight (Indirect/INT; otherwise Tactical/DEX)</label>':''}${['underbarrel','optionalUnderbarrel'].includes(item.system.mountRequirement)?'<label><input type="checkbox" name="underbarrelMountConfirmed" /> Underbarrel version is attached to a compatible rifle’s available underbarrel location</label>':''}${item.system.mountRequirement==='tripodOrVehicle'?'<label><input type="checkbox" name="usingIntegralTripod" /> Automatic grenade launcher: integral tripod is in use (or declare vehicle attachment above)</label>':''}
        ${meleeFireContextContent(options)}<label>Attack action <select name="attackAction"><option value="other">Other attack (resolve its action modifiers at the table)</option><option value="standard">Standard Attack (Single-Shot for firearms)</option></select></label>
        <label><input type="checkbox" name="aimed" /> Aim remains valid for this target; it has not moved more than 5 ft.</label>
        ${preview.firearm?`<label><input type="checkbox" name="braced" /> Brace remains valid: I have not moved and the target is in the chosen 90-degree cone</label><label><input type="checkbox" name="stableSurface" /> I have a stable surface to brace against (unnecessary with Marksmanship Basics)</label>`:""}
        ${preview.firearm?`<label>Fire mode <select name="fireMode">${preview.modes.map(mode=>`<option value="${mode}" ${mode===preview.fireMode?'selected':''}>${esc(FIRE_MODES[mode]??mode)}</option>`).join("")}</select></label>`:""}</div>`});
      if(!input)return null;
    }
    if(input.distanceFeet===''||input.distanceFeet==null)return ui.notifications.warn("Enter the target distance before making a measured attack.");
    return this.rollAttack(item,{...input,vehicleMounted:!!input.vehicleMounted,distanceFeet:Number(input.distanceFeet)});
  }

  async resolveUnnerving(message,options={}){
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid||message.blind&&!game.user.isGM)throw new Error('Use an owned visible damage record.');
    if(!unnervingEligible(this.system,message.flags.spycraft2))return ui.notifications.warn('Unnerving is not available for this damage record.');
    let input=options;
    if(!input.target){input=await systemDialog.input({window:{title:'Unnerving: additional stress'},rejectClose:false,content:'<div class="spycraft2-roll-options"><label>Target <input name="target" required /></label><label><input type="checkbox" name="damageInflictedConfirmed" /> This unarmed/melee attack actually inflicted at least one point of damage after defenses</label><p>Rolls 1d4 stress per selected grade, maximum 3d4. Apply the target’s stress defenses separately. Record each attack’s added stress once.</p></div>'});if(!input)return null;}
    unnervingPlan(this.system,message.flags.spycraft2,input);
    return queueResources([this],async()=>{
      if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)throw new Error('Ownership or the acting character changed.');
      const check=message.flags.spycraft2,plan=unnervingPlan(this.system,check,input),before=structuredClone(check.unnerving);
      await message.update({'flags.spycraft2.unnerving':{...plan,recorded:true}});
      try{return await this.rollCheck(plan.formula,this.getRollData(),{flavor:`Unnerving: ${foundry.utils.escapeHTML(plan.target)} — ${plan.formula} additional stress damage (p.451). Apply stress defenses separately.`,checkKind:'damage',unnervingStress:{...plan,parentMessageUuid:message.uuid??message.id},unarmed:check.unarmed===true,weaponUuid:check.weaponUuid??'',weaponProficiency:check.weaponProficiency??'',threat:0,error:0});}
      catch(error){await message.update(before===undefined?{'flags.spycraft2.-=unnerving':null}:{'flags.spycraft2.unnerving':before});throw error;}
    },{messages:[message]});
  }

  async rollDamage(item,options={}) {
    const targetChoices=damageTargetChoices(),sideHits=eligibleSideStanceHits(this,item),attackBonusHits=eligibleAttackDamageHits(this,item),automaticAttackBonus=attackBonusHits.length===1&&(!sideHits.length||sideHits.length===1&&sideHits[0].proof.attackUuid===attackBonusHits[0].proof.attackUuid)?attackBonusHits[0]:null;
    if(item.system.weaponCategory==='mortar'&&/\d*d\d+/i.test(item.system.damage)&&!Object.hasOwn(options,'mortarSpaceConfirmed')){
      const input=await systemDialog.input({window:{title:'Mortar damage circumstances'},rejectClose:false,content:'<div class="spycraft2-roll-options"><label><input name="mortarSpaceConfirmed" type="checkbox" /> Mortar fired outdoors or in a very large indoor area suitable for its high-arc trajectory</label></div>'});if(!input)return null;options={...options,...input};
    }
    if(item.system.weaponCategory==='grenadeLauncher'&&item.system.mountRequirement&&/\d*d\d+/i.test(item.system.damage)&&!['underbarrelMountConfirmed','usingIntegralTripod','vehicleMounted'].some(key=>Object.hasOwn(options,key))){
      const input=await systemDialog.input({window:{title:'Launcher damage circumstances'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Confirm the mount and firing mode used for the attack producing this damage.</p>${['underbarrel','optionalUnderbarrel'].includes(item.system.mountRequirement)?'<label><input type="checkbox" name="underbarrelMountConfirmed" /> Underbarrel version was attached to a compatible rifle’s available underbarrel location</label>':''}${item.system.mountRequirement==='tripodOrVehicle'?'<label><input type="checkbox" name="usingIntegralTripod" /> Integral tripod was in use</label><label><input type="checkbox" name="vehicleMounted" /> Launcher was attached to a vehicle</label>':''}<label><input type="checkbox" name="indirectFire" /> Target was outside line of sight (Indirect/INT)</label></div>`});if(!input)return null;options={...options,...input};
    }
    if(options.includeSneakAttack===undefined&&(hasSneakAttackSource(this.system,item.system)||sideHits.length||attackBonusHits.length)){const trickSneakHit=automaticAttackBonus?.proof.sneakDice?automaticAttackBonus:null;
      const input=await systemDialog.input({window:{title:attackBonusHits.length?'Damage and attack benefits':'Damage and sneak attack'},rejectClose:false,content:`<div class="spycraft2-roll-options"><label>Target sheet <select name="targetActorUuid"><option value="">Manual target: confirm immunities below</option>${targetChoices.actors.map(a=>`<option value="${foundry.utils.escapeHTML(a.uuid)}"${(sideHits.length===1?sideHits[0].proof.targetUuid:automaticAttackBonus?.proof.targetUuid??targetChoices.selected)===a.uuid?' selected':''}>${foundry.utils.escapeHTML(a.name??'Character')}</option>`).join('')}</select></label><p>A selected target sheet supplies its known armor protection. Other immunities and reachable vitals still require confirmation.</p>
        ${attackBonusHits.length?`<label>Recorded attack damage bonus <select name="attackDamageSourceUuid"><option value="">No recorded attack bonus</option>${attackBonusHits.map(h=>`<option value="${foundry.utils.escapeHTML(h.message.uuid)}"${automaticAttackBonus===h?' selected':''}>${foundry.utils.escapeHTML(h.proof.source)} ${h.proof.sneakDice?`+${h.proof.sneakDice}d6 sneak`:`+${h.proof.bonus}`} — ${foundry.utils.escapeHTML(targetChoices.actors.find(a=>a.uuid===h.proof.targetUuid)?.name??h.proof.manualTargetName??'Recorded target')}</option>`).join('')}</select></label><p>Use this exact recorded successful attack and target. Its damage bonus applies once and combines with ordinary weapon modifiers before minimum damage.</p>`:''}
        <label><input type="checkbox" name="includeSneakAttack"${sideHits.length===1||trickSneakHit?' checked':''} /> Include earned sneak attack damage</label>${sideHits.length?`<label>Side Stance hit <select name="sideStanceSourceUuid"><option value="">Other attack / no Side Stance die</option>${sideHits.map(h=>`<option value="${foundry.utils.escapeHTML(h.message.uuid)}"${sideHits.length===1?' selected':''}>Round ${h.message.flags.spycraft2.rollCombat?.round??'?'} — ${foundry.utils.escapeHTML(targetChoices.actors.find(a=>a.uuid===h.proof.targetUuid)?.name??'Recorded opponent')}</option>`).join('')}</select></label><p>The selected hit supplies one earned die, once. It is combined with this attack’s other sneak damage; leaving the stance after the hit does not remove its recorded entitlement.</p>`:''}
        <label><input type="checkbox" name="successfulStandardAttack"${sideHits.length===1?' checked':''} /> This was a successful Standard Attack</label>
        <label><input type="checkbox" name="targetCharacter"${sideHits.length===1?' checked':''} /> Target is a character, not an object</label>
        <label><input type="checkbox" name="targetFlanked" /> I am flanking this target with this attack</label><label><input type="checkbox" name="targetHelpless" /> Target is helpless</label><label><input type="checkbox" name="targetVulnerable" /> Target is vulnerable</label>
        <label><input type="checkbox" name="targetVitalsConfirmed" /> Target is not immune to critical hits or sneak attack damage, is not hidden to me and has reachable vitals</label>
        <label>Damage type <select name="damageType"><option value="lethal">Lethal</option><option value="subdual">Subdual</option></select></label>
        <label>Conversion <select name="damageConversion"><option value="none">None</option><option value="lethalToSubdual">Lethal to subdual (requires Bludgeon)</option><option value="subdualToLethal">Subdual to lethal (no sneak attack)</option></select></label>
        <label>Ranged target distance (feet) <input type="number" name="distanceFeet" min="0" step="any" /></label>
        <label><input type="checkbox" name="braced" /> I was bracing this two-handed firearm/hurled weapon for this attack (Sniper dice)</label>
      </div>`});if(!input)return null;options={...options,...input,includeSneakAttack:!!input.includeSneakAttack};
    }
    const cqbPreview=cqbRangePlan(this.system,item.system,options,'damage');
    if(cqbPreview.active&&cqbPreview.basics&&!cqbPreview.known){
      const input=await systemDialog.input({window:{title:'CQB damage target distance'},rejectClose:false,content:'<div class="spycraft2-roll-options"><p>CQB Basics adds1 damage against targets within current CQB Range. Enter the actual target distance for this damage; this does not take another attack or spend dice.</p><label>Target distance (feet) <input name="distanceFeet" type="number" min="0" step="any" required /></label></div>'});if(!input)return null;const n=typeof input.distanceFeet==='number'?input.distanceFeet:typeof input.distanceFeet==='string'&&input.distanceFeet.trim()?Number(input.distanceFeet):NaN;if(!Number.isFinite(n)||n<0)throw new Error('Enter the actual finite nonnegative CQB damage distance.');options={...options,distanceFeet:n};
    }
    if(specialistApplies(this.system,item.system,"Killer Instinct")&&!item.system.isMelee&&!['unarmed','blunt','exoticBlunt','edged','exoticEdged'].includes(item.system.proficiency)&&options.withinCQB===undefined){
      const input=await systemDialog.input({window:{title:"Killer Instinct range"},rejectClose:false,content:`<label><input type="checkbox" name="withinCQB" /> The target is beyond Reach and within CQB range (${this.system.cqbRange??30} ft.)</label>`});
      if(!input)return null;options={...options,...input};
    }
    const attackDamageBenefit=options.attackDamageSourceUuid?makeAttackDamageProof(this,item,options.attackDamageSourceUuid,{targetUuid:options.targetActorUuid||options.targetActor?.uuid}):null;options={...options,attackDamageBonus:attackDamageBenefit?.bonus??0,...(attackDamageBenefit?.hands?{hands:attackDamageBenefit.hands}:{})};
    const damageWeaponSource=current=>({...current.system,id:current.id??current._id,name:current.name,qualities:grantedMeleeQuality(current.system.qualities??'',attackDamageBenefit?.grantedQuality)});
    const damageWeaponContext=current=>{const context=this.weaponContext(current,options),p=attackDamageBenefit?.projectile;if(p)context.ammunition={name:p.label??('Recorded '+p.kind),ammunitionKind:p.kind,ammunitionOnly:p.ammunitionOnly,damage:p.damage,errorThreat:p.errorThreat,explosiveAmmunition:p.explosive,quantity:1};return context;};
    const damage = weaponDamage(this.system,damageWeaponSource(item),damageWeaponContext(item),this.type);
    if(damage?.blocked)return ui.notifications.warn(damage.blockedReason);
    const finesseDamage={meleeArmorPiercing:damage?.meleeArmorPiercing?.evidence,formula:damage?.formula,damageText:damage?.damageText,basic:damage?.finesseBasic,used:damage?.finesse,bonus:damage?.bonus,grip:damage?.grip};
    const validateFinesseDamage=async()=>{await options.validateAttackContext?.();const current=item.id&&this.items?.get?this.items.get(item.id):item;if(!current)throw new Error('The finesse damage weapon was removed.');const next=weaponDamage(this.system,damageWeaponSource(current),damageWeaponContext(current),this.type);if(JSON.stringify({meleeArmorPiercing:next?.meleeArmorPiercing?.evidence,formula:next?.formula,damageText:next?.damageText,basic:next?.finesseBasic,used:next?.finesse,bonus:next?.bonus,grip:next?.grip})!==JSON.stringify(finesseDamage))throw new Error('The finesse damage source or modifier changed during the roll.');};
    const cqbDamageSnapshot=damage?.cqbRange?.active?JSON.stringify(damage.cqbRange):null,validateCQBRange=cqbDamageSnapshot?()=>{const current=item.id&&this.items?.get?this.items.get(item.id):item;if(!current)throw new Error('The CQB damage weapon was removed.');const next=weaponDamage(this.system,damageWeaponSource(current),damageWeaponContext(current),this.type);if(JSON.stringify(next?.cqbRange)!==cqbDamageSnapshot)throw new Error('CQB source, weapon or range changed during this damage roll.');}:null;
    const sideStanceDamage=options.includeSneakAttack===true&&options.sideStanceSourceUuid?makeSideStanceDamageProof(this,item,options.sideStanceSourceUuid,{targetUuid:options.targetActorUuid||options.targetActor?.uuid}):null;if(sideStanceDamage){if(attackDamageBenefit&&attackDamageBenefit.attackUuid!==sideStanceDamage.attackUuid)throw Error('Choose the same recorded attack for its damage bonus and Side Stance die.');options={...options,targetActorUuid:sideStanceDamage.targetUuid};}if(attackDamageBenefit)options={...options,targetActorUuid:attackDamageBenefit.manualTargetName?'':attackDamageBenefit.targetUuid};
    const targetUuid=Object.hasOwn(options,'targetActorUuid')?options.targetActorUuid:options.targetActor?.uuid??targetChoices.selected,targetActor=await resolveDamageTarget(targetUuid);
    const sneak=sneakAttackDamagePlan(this.system,{...item.system,range:this.weaponAttack(item,options).range},{...options,sideStanceDie:!!sideStanceDamage,trickSneak:options.includeSneakAttack===true&&attackDamageBenefit?.sneakDice?{source:attackDamageBenefit.sneakSource,dice:attackDamageBenefit.sneakDice}:null,whirlingFlankingProof:whirlingAttackProof(this,{targetFlanked:options.targetFlanked,targetActorUuid:targetActor?.uuid}),targetSystem:targetActor?.system??null}),sneakAttackTarget=sneak.active?sneakAttackTargetSnapshot(targetActor):null;
    const formula = damage?.formula&&sneak.active?`${damage.formula} + ${sneak.formula}`:damage?.formula;
    if (!formula) return ui.notifications.warn(game.i18n.format("SPYCRAFT.Weapon.NoDamage", { name: item.name }));
    return this.rollCheck(formula,this.getRollData(),{meleeArmorPiercing:damage.meleeArmorPiercing.evidence,attackDamageBenefit,sideStanceDamage,finesseDamage,validateAttackContext:validateFinesseDamage,weaponQualities:damage.effectiveQualities,flavor:`${game.i18n.localize("SPYCRAFT.Damage")}: ${foundry.utils.escapeHTML(item.name)} (${foundry.utils.escapeHTML(damage.damageText??item.system.damage)})${damage.ammunition?` — ${foundry.utils.escapeHTML(damage.ammunition)}`:""}${damage.meleeArmorPiercing.evidence?`<br><small>${foundry.utils.escapeHTML(damage.meleeArmorPiercing.notes.join(" "))}</small>`:""}${attackDamageBenefit?`<br><small>${foundry.utils.escapeHTML(attackDamageBenefit.source)}: recorded attack damage +${attackDamageBenefit.bonus}, once against ${foundry.utils.escapeHTML(attackDamageBenefit.manualTargetName??'the recorded target')}.${attackDamageBenefit.sneakDice?` ${attackDamageBenefit.sneakSource}: its hit supplies ${attackDamageBenefit.sneakDice} die of sneak attack damage when the sneak attack conditions are met.`:''}${attackDamageBenefit.grantedQuality==='TKD'?' Takedown: if a character suffers damage, resolve Fortitude at pre-DR damage (+10 DC if wounds were lost); failure causes sprawled.':''}</small>`:""}${sneak.active?`<br><small>${foundry.utils.escapeHTML(sneak.notes)}</small>`:""}${damage.cqbRange?.active?`<br><small>${foundry.utils.escapeHTML(damage.cqbRange.notes.join(" "))}</small>`:""}${damage.markDamage?.active?`<br><small>${foundry.utils.escapeHTML(damage.markDamage.note)}</small>`:""}`,validateCQBRange,cqbRange:damage.cqbRange?.active?damage.cqbRange:null,mortarOperation:damage.mortarOperation?.applicable?damage.mortarOperation:null,launcherOperation:damage.launcherOperation?.applicable?damage.launcherOperation:null,unnervingAvailableGrade:unnervingGrade(this.system),weaponUuid:item.uuid,weaponProficiency:damage.launcherOperation?.proficiency??item.system.proficiency,sneakAttackTarget,sneakAttack:sneak.active?sneak:null,conditionDamagePenalty:damage.conditionDamagePenalty,conditionDamageIncluded:true,checkKind:"damage",threat:0,error:0,unarmed:item.system.proficiency==="unarmed"||/\bNKL\b/.test(item.system.qualities??""),improvised:!!item.system.improvised});
  }

  get shakenInitiativeReviews(){return shakenInitiativeReviews(this);}
  reviewShakenInitiative(combatId,combatantId,options={}){return reviewShakenInitiative(this,combatId,combatantId,options);}
  get actionDiceFundingSystem(){return {...this.system,...this.attributeRuleContext,bonusPoolCombats:Object.fromEntries([...(game.combats??[])].map(c=>[c.id,{id:c.id,started:c.started,round:c.round}])),actionDieAwardReview:this.flags?.spycraft2?.actionDieAwardReview??this.system.actionDieAwardReview,actionDiceSettlementReview:getActionDieSettlementReview(this)};}
  preRollPaymentReceipt(payment){return payment?{id:payment.id??globalThis.foundry?.utils?.randomID?.()??('preRoll-'+(this._preRollReceiptSequence=(this._preRollReceiptSequence??0)+1)),bonusPoolId:payment.bonusPoolId,die:payment.die,count:payment.count,...(payment.allocations?.length?{baseCost:payment.baseCost,surcharge:payment.surcharge,benefitCount:payment.benefitCount,allocations:payment.allocations}:{}),...(payment.shakenSignature?{shakenSignature:payment.shakenSignature}:{})}:null;}
  actionDiceFundingControl(){const pools=unrestrictedBonusPools(this.actionDiceFundingSystem,this.usagePeriods).filter(p=>p.available),esc=foundry.utils.escapeHTML,selected=(this.system.actionDice?.value??0)>0?'':pools[0]?.id??'';return `<label>Funding <select name="bonusPoolId"><option value=""${selected?'':' selected'}>Ordinary action dice (${this.system.actionDice?.value??0})</option>${pools.map(p=>`<option value="${esc(p.id)}"${selected===p.id?' selected':''}>${esc(p.label)}: ${p.available} d${p.die}, until ${p.expiryLabel}</option>`).join('')}</select></label>`;}

  /** Spend and roll the selected action die, retaining the granted die type. */
  async rollActionDie(options={}) {
    const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));let input=options;if(!Object.keys(input).length&&(shakenRules(this.actionDiceFundingSystem).extraDice||unrestrictedBonusPools(this.actionDiceFundingSystem,this.usagePeriods).some(p=>p.available))){input=await systemDialog.input({window:{title:'Spend an action die'},rejectClose:false,content:`<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>Roll one benefit die. Surcharge dice are spent without being rolled.</p></div>`});if(!input)return null;}
    return this.spendActionDiceBenefit(1,async payment=>{
      const ad=payment.system.actionDice,roll=await new Roll(`1d${ad.die}x>=${ad.explodeAt??ad.die}${ad.bonus?` + ${ad.bonus}`:''}`).evaluate();
      if(JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken)throw new Error('The Shaken condition changed while rolling this action die.');
      const actionDieReceiptId=globalThis.foundry?.utils?.randomID?.()??('actionDie-'+(this._actionDieReceiptSequence=(this._actionDieReceiptSequence??0)+1));
      try{return await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:this}),flavor:game.i18n.localize('SPYCRAFT.ActionDice.Spend')+(payment.surcharge?` — ${payment.cost} spent: one benefit die + ${payment.surcharge} Shaken surcharge`:'' ),flags:{spycraft2:{actorUuid:this.uuid,checkKind:'actionDie',actionDieReceiptId,actionDiceAllowed:false,funding:{bonusPoolId:payment.bonusPoolId,die:payment.die,count:1,...(payment.surcharge?{paymentId:payment.id,surcharge:payment.surcharge,totalCost:payment.cost,allocations:payment.allocations}:{})}}}});}
      catch(error){const posted=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.actionDieReceiptId===actionDieReceiptId);if(posted)return posted;throw error;}

    },{bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),purpose:'Manual action-die benefit',benefit:'manualDie',expectedShaken});
  }

  /** Spend action dice on a recorded result, preserving the original roll and its cap. */
  boostCheck(message,options={}) {
    const work=async()=>{
      if(!this.isOwner)return ui.notifications.warn("You must own the actor spending action dice.");
      let check=message.flags?.spycraft2;
      if(!check||check.actorUuid!==this.uuid)return ui.notifications.warn("Choose a recorded roll made by this actor.");
      if(message.blind&&!game.user?.isGM)return ui.notifications.warn("The GC resolves secret results.");
      const expected=rollEvidence(check);
      const currentShaken=shakenRules(this.actionDiceFundingSystem);if(currentShaken.needsReview||currentShaken.spendingForbidden)return ui.notifications.warn(currentShaken.needsReview?'Review the current Shaken sources before boosting.':'Shaken IV: no action dice may be spent at all (p.342).');
      let input=options;
      if(!Object.keys(input).length||input.askOptions){
        const pools=availableCheckBonusPools(this.system,message,this.usagePeriods),esc=foundry.utils.escapeHTML;
        input=await systemDialog.input({window:{title:"Boost result before its outcome is described"},rejectClose:false,content:`<div class="spycraft2-roll-options">
          <label>Funding <select name="bonusPoolId"><option value="" ${!input.bonusPoolId?'selected':''} ${check.actionDiceAllowed===false?'disabled':''}>Ordinary action dice</option>${pools.map(pool=>`<option value="${pool.id}" ${input.bonusPoolId===pool.id?'selected':''}>${esc(pool.label)}: ${pool.remaining} d${pool.die}${pool.unrestricted?', until scene end':', this check only'}</option>`).join('')}</select></label>
          ${currentShaken.extraDice?`<p>Shaken surcharge: ${Math.max(0,currentShaken.extraDice-paidBoostSurcharge(this,message))} extra action dice for this check. Surcharge dice do not add to the result; later boosts of this check pay only any remaining surcharge.</p><label>Surcharge funding <select name="surchargeBonusPoolId"><option value="same">Boost source if unrestricted, otherwise ordinary dice</option><option value="">Ordinary action dice</option>${unrestrictedBonusPools(this.actionDiceFundingSystem,this.usagePeriods).filter(p=>p.available).map(p=>`<option value="${esc(p.id)}">${esc(p.label)}: ${p.available} d${p.die}</option>`).join('')}</select></label>${currentShaken.extraDice>paidBoostSurcharge(this,message)?splitSurchargeFundingControl(this):''}`:''}
          <label>Boosting dice (excluding surcharge) <input type="number" name="count" min="1" value="1" /></label>
          <label><input type="checkbox" name="openingRound" /> Surprise round or first standard combat round</label>
          ${errorDecisionPending(check)?`<label><input type="checkbox" name="errorDeclined" /> Opponents declined to activate this error as a critical failure</label>`:""}
          <label><input type="checkbox" name="calculating" /> Use Calculating if replacing the lowest action die improves the result</label></div>`});
        if(!input)return null;
      }
      check=message.flags?.spycraft2;
      if(input.bonusPoolId&&errorDecisionPending(check)&&input.errorDeclined===undefined){
        const decision=await systemDialog.input({window:{title:'Decide the error before spending the bonus'},rejectClose:false,content:'<p>Opponents decide whether to activate this error first. Close this dialog to resolve a critical failure.</p><label><input type="checkbox" name="errorDeclined" /> Opponents declined to activate the error</label>'});
        if(!decision)return null;input={...input,errorDeclined:!!decision.errorDeclined};
      }
      if(rollEvidence(check)!==expected)throw new Error('This result changed while the boost was being prepared. Review the current result.');
      const plan=input.bonusPoolId?checkBonusBoostPlan(this.system,message,{...input,count:Number(input.count??1),periods:this.usagePeriods}):actionDieBoostPlan(this.system,check,{...input,count:Number(input.count??1)});
      if(plan.blocked)return ui.notifications.warn(plan.reason);
      input={...input,...surchargeFundingInput(input)};
      const boostQuote=currentShaken.extraDice||input.surchargeAllocations!==undefined?boostPaymentQuote(this,message,{...input,count:plan.count}):null;
      const roll=await new Roll(plan.formula).evaluate();
      if(shakenRules(this.actionDiceFundingSystem).grade!==currentShaken.grade)throw new Error("The Shaken grade changed while preparing this boost. Review it again.");
      if(rollEvidence(message.flags?.spycraft2)!==expected)throw new Error('The result changed during the action-die roll. Review it before retrying.');
      const fresh=plan.bonusPoolId?checkBonusBoostPlan(this.actionDiceFundingSystem,message,{...input,count:plan.count,periods:this.usagePeriods}):actionDieBoostPlan(this.actionDiceFundingSystem,message.flags.spycraft2,{...input,count:plan.count});
      const signature=p=>JSON.stringify([p.die,p.explodeAt,p.rolls,p.bonusEach,p.calculating,p.intelligence,p.wellRounded]);
      if(fresh.blocked||signature(fresh)!==signature(plan)||plan.bonusPoolId&&(fresh.pool?.remaining!==plan.pool.remaining||actionDicePoolFingerprint(fresh.pool)!==actionDicePoolFingerprint(plan.pool)))throw new Error(fresh.reason||'The action-die source changed before payment. Review the current grant.');
      if(boostQuote)return applyPaidCheckBoost(this,message,{check,expected,input,plan,roll,quote:boostQuote});
      const result=actionDieBoostResult(check,plan,roll.dice.map(die=>die.total)),paymentPath=plan.bonusPoolId?`system.bonusActionDice.${plan.bonusPoolId}.remaining`:'system.actionDice.value',balance=plan.bonusPoolId?plan.pool.remaining:this.system.actionDice.value;
      const payment={bonusPoolId:plan.bonusPoolId??'',count:plan.count,balance,afterBalance:balance-plan.count,paymentPath,die:plan.die,label:plan.pool?.label??'Ordinary action dice',poolFingerprint:plan.bonusPoolId?actionDicePoolFingerprint(plan.pool):null},paymentReceiptId=globalThis.foundry?.utils?.randomID?.()??('boost-'+(this._boostReceiptSequence=(this._boostReceiptSequence??0)+1)),reviewDetails={purpose:'check boost',messageUuid:message.uuid??message.id};
      try{await this.update({[paymentPath]:payment.afterBalance});}
      catch(error){
        const observed=plan.bonusPoolId?this.system.bonusActionDice?.[plan.bonusPoolId]?.remaining:this.system.actionDice.value;
        if(observed===payment.afterBalance)try{await this.refundActionDicePayment(payment);}catch(rollback){await this.markActionDiceSettlementReview(payment,rollback,reviewDetails);throw new AggregateError([error,rollback],'The interrupted boost payment needs GC review.');}
        else if(observed!==balance)await this.markActionDiceSettlementReview(payment,error,reviewDetails);
        throw error;
      }
      const next={...check,...result,lastBoostPayment:{id:paymentReceiptId,bonusPoolId:payment.bonusPoolId,die:payment.die,count:payment.count,surcharge:0,totalCost:payment.count,allocations:[{bonusPoolId:payment.bonusPoolId,count:payment.count,scope:'boost'}]},...(plan.bonusPoolId?{...(plan.bonusPoolId===check.requiredBonusPoolId?{requiredBonusSpent:balance-plan.count===0}:{}),bonusBoosts:[...(check.bonusBoosts??[]),{poolId:plan.bonusPoolId,label:plan.pool.label,die:plan.die,count:plan.count}]}:{}),lastBoostDice:roll.dice.map(die=>die.total),successConfirmed:null,errorConfirmed:false,threatConfirmed:false,triumphed:false,flawlessSearch:null,automaticSkillSuccess:null,errorActivationDeclined:!!check.errorActivationDeclined||!!input.errorDeclined};
      let restoreWeapon;
      try{
        restoreWeapon=await this.syncRollErrorEffect(next,message.uuid??message.id);
        await message.update({"flags.spycraft2":next,flavor:checkFlavor(next)});
      }catch(error){
        if(message.flags?.spycraft2?.lastBoostPayment?.id!==paymentReceiptId){
          try{await restoreWeapon?.();}catch(rollback){await this.markActionDiceSettlementReview(payment,rollback,reviewDetails);throw new AggregateError([error,rollback],'The boosted effect needs GC review.');}
          try{await this.refundActionDicePayment(payment);}catch(rollback){await this.markActionDiceSettlementReview(payment,rollback,reviewDetails);throw new AggregateError([error,rollback],'The selected boost balance needs GC review.');}
          throw error;
        }
      }

      try{await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:this}),flavor:`Spent ${plan.count} ${plan.bonusPoolId?'bonus ':''}action ${plan.count===1?"die":"dice"}${plan.bonusPoolId?` from ${foundry.utils.escapeHTML(plan.pool.label)}`:''}; rolled ${plan.rolls}. Added +${result.added} after modifiers${result.replaced?" and Calculating":""}.`});}
      catch(error){ui.notifications.warn('The boost was applied to the original result, but its supplementary chat message could not be posted. The dice remain spent; check the original result before retrying.');}
      return result;
    };
    return queueResources([this],work,{messages:[message]});
  }

  async boostWithGenerous(message,options={}) {
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)return ui.notifications.warn("The GC resolves secret results.");
    const expected=rollEvidence(message.flags.spycraft2),expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem)),expectedPaid=paidBoostSurcharge(this,message);
    if(getActionDieSettlementReview(this).needsReview)return ui.notifications.warn('Resolve this teammate’s interrupted payment before Generous.');
    let input=options;
    if(!Object.keys(input).length){
      const donors=[...(game.actors??[])].filter(a=>a.type==="agent"&&a.uuid!==this.uuid&&a.isOwner&&a.system.coreClassIds?.includes("pointman")),esc=foundry.utils.escapeHTML;
      const pools=donors.flatMap(a=>unrestrictedBonusPools(a.actionDiceFundingSystem,a.usagePeriods).filter(p=>p.available).map(p=>`<option value="${esc(a.uuid+'|'+p.id)}">${esc(a.name)} — ${esc(p.label)} (${p.available} d${p.die})</option>`)).join('');
      input=await systemDialog.input({window:{title:"Generous: one teammate action die"},rejectClose:false,content:`<div class="spycraft2-roll-options">
        ${shakenRules(this.actionDiceFundingSystem).extraDice?`<p>The receiving teammate must pay ${Math.max(0,shakenRules(this.actionDiceFundingSystem).extraDice-expectedPaid)} remaining Shaken surcharge dice. Only the Pointman's one die is rolled; the fee is once per check.</p>${this.actionDiceFundingControl().replace('name="bonusPoolId"','name="surchargeBonusPoolId"').replace('<label>Funding','<label>Teammate surcharge funding')}${shakenRules(this.actionDiceFundingSystem).extraDice>expectedPaid?splitSurchargeFundingControl(this):''}`:''}
        <label>Donor <select name="donorId">${donors.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
        <label>Funding from the donor <select name="funding"><option value="">Ordinary action dice</option>${pools}</select></label>
        <label><input type="checkbox" name="teammate" /> Donor is a teammate</label>
        <label><input type="checkbox" name="perceivedAtRoll" /> The acting character could see or hear the donor when this roll was made</label>
        ${errorDecisionPending(message.flags.spycraft2)?'<label><input type="checkbox" name="errorDeclined" /> Opponents declined error activation before this boost</label>':''}
        <label><input type="checkbox" name="calculating" /> Use the donor’s Calculating if applicable</label>
        <p>Only one Generous die may benefit a roll. The donor uses their own die and modifiers. The GC can resolve donations from other players’ actors.</p></div>`});
      if(!input)return null;
    }
    const donor=input.donor??game.actors?.get(input.donorId);if(donor?.type!=="agent"||!donor.isOwner)return ui.notifications.warn("Choose an owned donor or ask the GC to resolve the donation.");
    let bonusPoolId=input.bonusPoolId??'';
    if(input.funding){const [uuid,id,...extra]=String(input.funding).split('|');if(uuid!==donor.uuid||!id||extra.length)return ui.notifications.warn('Choose funding belonging to the selected donor.');bonusPoolId=id;}
    const work=async()=>{
      if(rollEvidence(message.flags.spycraft2)!==expected)return ui.notifications.warn('This result changed while Generous was being prepared. Review the current result.');
      if(JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken||paidBoostSurcharge(this,message)!==expectedPaid)throw new Error('The teammate’s condition or previously paid surcharge changed. Confirm Generous again.');
      let surcharge;try{surcharge=generousSurchargeQuote(this,message,{...surchargeFundingInput(input),surchargeBonusPoolId:input.surchargeBonusPoolId??''});}catch(error){return ui.notifications.warn(error.message);}
      let recipientPayment=null,donorCallbackStarted=false;
      const check=message.flags.spycraft2,funding=actionDiceFundingContext(donor.actionDiceFundingSystem,{bonusPoolId,periods:donor.usagePeriods});if(funding.blocked)return ui.notifications.warn(funding.reason);
      const plan=generousBoostPlan(funding.system,check,{...input,sameActor:donor.uuid===this.uuid});if(plan.blocked)return ui.notifications.warn(plan.reason);
      const donate=async()=>{const donated=await donor.payActionDiceLocked(1,async payment=>{
        donorCallbackStarted=true;
        const roll=await new Roll(plan.formula).evaluate();
        if(JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken||surcharge.payments.some(p=>p.bonusPoolId&&actionDicePoolFingerprint(this.system.bonusActionDice?.[p.bonusPoolId])!==p.poolFingerprint))throw new Error('The receiving teammate’s condition or surcharge source changed during the donor roll.');
        if(rollEvidence(message.flags.spycraft2)!==expected)throw new Error('The target result changed during the donor roll. Review it before retrying.');
        let currentFunding={...donor.actionDiceFundingSystem,actionDice:{...donor.system.actionDice,value:1}};
        if(bonusPoolId){const pool=donor.system.bonusActionDice?.[bonusPoolId];if(actionDicePoolFingerprint(pool)!==payment.poolFingerprint)throw new Error('The donor bonus grant changed during its roll.');const fresh=actionDiceFundingContext({...donor.actionDiceFundingSystem,bonusActionDice:{...donor.system.bonusActionDice,[bonusPoolId]:{...pool,remaining:pool.remaining+1}}},{bonusPoolId,periods:donor.usagePeriods});if(fresh.blocked)throw new Error(fresh.reason);currentFunding=fresh.system;}
        const stillValid=generousBoostPlan(currentFunding,message.flags.spycraft2,{...input,sameActor:donor.uuid===this.uuid});if(stillValid.blocked||stillValid.die!==plan.die||stillValid.explodeAt!==plan.explodeAt||stillValid.bonusEach!==plan.bonusEach)throw new Error(stillValid.reason??'The donor benefit changed during its roll.');
        const dice=roll.dice.map(d=>d.total),result=actionDieBoostResult(check,plan,dice),paymentReceiptId=globalThis.foundry?.utils?.randomID?.()??('generous-'+(donor._generousReceiptSequence=(donor._generousReceiptSequence??0)+1));
        const next={...check,...result,successConfirmed:null,errorConfirmed:false,threatConfirmed:false,triumphed:false,flawlessSearch:null,automaticSkillSuccess:null,errorActivationDeclined:!!check.errorActivationDeclined||!!input.errorDeclined,generousBoost:{donorUuid:donor.uuid,die:plan.die,bonusEach:plan.bonusEach,dice,added:result.added,replaced:result.replaced,paymentReceiptId,funding:{bonusPoolId:payment.bonusPoolId,count:1},recipientSurcharge:{paymentId:recipientPayment?.id??null,count:surcharge.surcharge,allocations:surcharge.allocations}}};
        let restoreWeapon;
        try{restoreWeapon=await this.syncRollErrorEffect(next,message.uuid??message.id);await message.update({"flags.spycraft2":next,flavor:checkFlavor(next)});}
        catch(error){
          if(message.flags?.spycraft2?.generousBoost?.paymentReceiptId===paymentReceiptId)return result;
          try{await restoreWeapon?.();}catch(rollback){const failure=new AggregateError([error,rollback],'The donated boost needs GC review.');failure.actionDiceSettlementReview={purpose:'Generous',targetActorUuid:this.uuid,messageUuid:message.uuid??message.id};throw failure;}
          throw error;
        }
        return result;
      },{bonusPoolId});if(!donorCallbackStarted)throw new Error('The donor payment changed before Generous.');return donated;};
      if(!surcharge.surcharge)return donate();
      return this.payMultipartActionDiceLocked(surcharge.allocations,async payment=>{recipientPayment=payment;try{return await donate();}catch(error){if(getActionDieSettlementReview(donor).needsReview)error.actionDiceSettlementReview={...error.actionDiceSettlementReview,purpose:'Generous donor and recipient',donorActorUuid:donor.uuid,messageUuid:message.uuid??message.id};throw error;}},{message,purpose:'Generous receiver surcharge',details:{benefit:'checkBoost',boostCount:0,surcharge:surcharge.surcharge,generousDonorUuid:donor.uuid,conditionGrade:surcharge.grade,evidenceBefore:expected}});
    };
    return queueResources([this,donor],work,{messages:[message]});
  }

  /** Apply only destruction belonging to this roll; unrelated manual damage is preserved. */
  async syncRollErrorEffect(check,messageId) {
    const weapon=check.weaponUuid&&typeof fromUuidSync!=="undefined"?fromUuidSync(check.weaponUuid):null;
    if(!weapon||!check.improvised||check.checkKind!=="attack")return null;
    const before={destroyed:!!weapon.system.destroyed,destroyedByRoll:weapon.system.destroyedByRoll??""};
    const tracks=before.destroyedByRoll===messageId,shouldDestroy=!!check.errorConfirmed&&!check.criticalFailure;
    if(shouldDestroy&&(!before.destroyed||tracks))await weapon.update({"system.destroyed":true,"system.destroyedByRoll":messageId});
    else if(!shouldDestroy&&tracks)await weapon.update({"system.destroyed":false,"system.destroyedByRoll":""});
    else return null;
    return ()=>weapon.update({"system.destroyed":before.destroyed,"system.destroyedByRoll":before.destroyedByRoll});
  }

  async useCunningPlan(message,options={}){
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)return ui.notifications.warn('The GC resolves secret results.');
    const expected=rollEvidence(message.flags.spycraft2);
    try{cunningPlanCheck(this.system,message.flags.spycraft2);}catch(e){return ui.notifications.warn(e.message);}
    if(!options.freeActionConfirmed){
      const input=await systemDialog.input({window:{title:'Cunning Plan'},rejectClose:false,content:'<p>Reduce this check’s error range by your Intelligence modifier (minimum zero). Its rolled result is retained; a negative result still operates like an error.</p><label><input type="checkbox" name="freeActionConfirmed" /> I spend the required free action before this check is resolved or a critical is activated</label>'});
      if(!input?.freeActionConfirmed)return null;
    }
    return this.useLimitedAbility('cunningPlan',async()=>{
      const check=message.flags.spycraft2;if(rollEvidence(check)!==expected)throw new Error('This roll changed before Cunning Plan. Review its current result.');
      const next=cunningPlanCheck(this.system,check);
      if(typeof check.successConfirmed==='boolean')Object.assign(next,adjudicateCheck(next,check.successConfirmed));
      let restoreWeapon;try{restoreWeapon=await this.syncRollErrorEffect(next,message.uuid??message.id);await message.update({'flags.spycraft2':next,flavor:checkFlavor(next)});}
      catch(error){await restoreWeapon?.();throw error;}
      return next;
    },{workflow:'cunningPlan',messages:[message]});
  }

  async confirmCheckOutcome(message,options={}) {
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)return ui.notifications.warn("The GC resolves secret results.");
    const expected=rollEvidence(message.flags.spycraft2);
    let succeeded=options.succeeded,difficultyClass=options.difficultyClass;
    if(typeof succeeded!=="boolean"){
      const input=await systemDialog.input({window:{title:"Confirm the check's outcome"},rejectClose:false,content:`${message.flags.spycraft2.damageSave?`<p>Recorded damage-event save DC${Number(message.flags.spycraft2.damageSave.dc)}; final result ${Number(message.flags.spycraft2.effectiveTotal)}.</p>`:""}<label>GC-confirmed result <select name="outcome" required><option value="">Choose…</option><option value="success">Succeeded</option><option value="failure">Failed</option></select></label>${automaticSkillSuccessSources(this.system,message.flags.spycraft2).length>0?'<label>GC-confirmed DC / final opposing result (required for a class automatic-success fallback) <input type="number" name="difficultyClass" step="1" /></label>':''}<p>A natural range is not an automatic success or failure. Negative skill, Knowledge and attack results operate like errors (pp.96–97,330).</p>`});
      if(!input)return null;
      if(!["success","failure"].includes(input.outcome)){ui.notifications.warn("Choose the GC-confirmed outcome.");return null;}
      succeeded=input.outcome==="success";difficultyClass=input.difficultyClass;
    }
    const work=async()=>{
      const check=message.flags?.spycraft2;
      if(!Number.isFinite(check?.rawTotal))return ui.notifications.warn("Choose a recorded check result.");
      if(check.resolved||check.superseded)return ui.notifications.warn("This check has already been resolved or replaced.");
      if(rollEvidence(check)!==expected)return ui.notifications.warn("This roll changed while its outcome was being confirmed. Review the current result.");
      if(check.takedown&&succeeded!==(check.effectiveTotal>=check.takedown.dc))return ui.notifications.warn('The confirmed takedown outcome must match its final result and fixed Fortitude DC.');
      validateDamageSaveRoll(this,check.damageSave,check.checkKind,check.checkId);
      if(check.analysisTask?.stage==='pressure'&&succeeded!==(check.effectiveTotal>=check.analysisTask.challengeDC))return ui.notifications.warn('The pressure outcome must match its final result and recorded Challenge DC.');
      if(check.damageSave&&succeeded!==(check.effectiveTotal>=check.damageSave.dc))return ui.notifications.warn('The confirmed outcome must match this damage save’s final result and recorded DC.');
      let next={...check,...adjudicateCheck(check,succeeded),flawlessSearch:null,automaticSkillSuccess:null};
      const automatic=automaticSkillSuccessPlan(this.system,next,{difficultyClass});
      if(automatic)next={...next,...adjudicateCheck(check,true),automaticSkillSuccess:automatic,flawlessSearch:automatic.id==='flawlessSearch'?automatic:null};
      let restoreWeapon;
      try{restoreWeapon=await this.syncRollErrorEffect(next,message.uuid??message.id);await message.update({"flags.spycraft2":next,flavor:checkFlavor(next)});}
      catch(error){await restoreWeapon?.();throw error;}
      if(next.successConfirmed===true&&next.checkKind==='skill'&&next.skillKey==='notice'&&next.checkId==='awareness'&&next.sleepSnapshot?.state==='sleeping'){
        // Outcome commits first. Waking is a historical event; never undo it when a later receipt write fails.
        try{
          const wake=await this.settleSleepWake(next.sleepSnapshot,{cause:'awareness',confirmed:true,check:next});
          next={...next,sleepWake:wake};
          await message.update({'flags.spycraft2.sleepWake':wake});
        }catch(error){ui.notifications.warn('Awareness outcome recorded; waking needs review or retry: '+error.message);}
      }
      return next;
    };
    return queueResources([this],work,{messages:[message]});
  }

  /** The GC can resolve an owned opponent's payment; cross-client authority remains a separate workflow. */
  async activateCritical(message,options={}) {
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)return ui.notifications.warn("The GC resolves secret results.");
    const expected=rollEvidence(message.flags.spycraft2);
    let input=options;
    if(!Object.keys(input).length){
      const check=message.flags.spycraft2,others=[...(game.actors??[])].filter(a=>a.type==="agent"&&a.uuid!==this.uuid&&a.isOwner),esc=foundry.utils.escapeHTML;
      const fundingActors=[this,...others],poolOptions=fundingActors.flatMap(a=>unrestrictedBonusPools(a.actionDiceFundingSystem,a.usagePeriods).filter(p=>p.available).map(p=>`<option value="${esc(a.uuid+'|'+p.id)}">${esc(a.name)} — ${esc(p.label)} (${p.available} d${p.die})</option>`)).join('');
      input=await systemDialog.input({window:{title:"Activate a confirmed critical result"},rejectClose:false,content:`<div class="spycraft2-roll-options">
        <label>Result <select name="kind">${check.threatConfirmed?'<option value="success">Own critical success / hit</option>':''}${check.errorConfirmed?'<option value="failure">Opponent activates critical failure / miss</option>':''}</select></label>
        ${message.flags.spycraft2.checkKind==='attack'&&typeof message.flags.spycraft2.attackContext?.vehicleMounted!=='boolean'&&(this.system.classOptionSelections??[]).some(e=>e.classId==='wheelman'&&e.name==='Most Lethal')?'<label><input type="checkbox" name="vehicleMountedConfirmed" /> Unrecorded attack platform: confirm this weapon was vehicle-mounted when the attack was rolled (Most Lethal)</label>':''}
        ${cleaveLegacyTargetEligible(this.system,check)?'<label><input type="checkbox" name="legacyStandardTargetConfirmed" /> Unrecorded original target: the GC confirms this melee attack was against a standard character (Cleave Supremacy)</label>':''}
        <label>Opponent paying for a failure <select name="payerId"><option value="">Choose opponent…</option>${game.user?.isGM?'<option value="gc">GC action-die pool</option>':''}${others.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
        <label>Funding from the paying character <select name="funding"><option value="">Ordinary action dice / GC pool</option>${poolOptions}</select></label>
        <label>Shaken surcharge funding <select name="feeFunding"><option value="same">Same source as the base cost</option><option value="">Paying character's ordinary dice</option>${poolOptions}</select></label>
        <details><summary>Split the entire payment across this payer's wallets (optional)</summary><p>If any contribution is entered, these fields replace both source selectors. Total the final cost after automatic reductions and the payer's Shaken surcharge; only the selected payer may contribute.</p>${fundingActors.map(a=>`<label>${esc(a.name)}: ordinary dice (${a.system.actionDice?.value??0}) <input name="criticalFund_${a.id}" type="number" min="0" value="0" /></label>${unrestrictedBonusPools(a.actionDiceFundingSystem,a.usagePeriods).filter(p=>p.available).map(p=>`<label>${esc(a.name)}: ${esc(p.label)} (${p.available} d${p.die}) <input name="criticalPool_${a.id}_${p.id}" type="number" min="0" value="0" /></label>`).join('')}`).join('')}</details>
        <label><input type="checkbox" name="jinx" /> Use the paying opponent’s earned Jinx (−1cost, minimum0; one Chance-based session use)</label>
        <label>Base action-die cost from the applicable effect <input type="number" name="baseCost" min="1" value="1" /></label>
        <label>Critical effect <textarea name="effect" required></textarea></label>
        <label><input type="checkbox" name="effectConfirmed" /> The GC confirms this effect is possible and its base cost is correct before the automatic modifiers below</label>
        <label><input type="checkbox" name="beforeDamage" /> Critical hit: damage has not been rolled</label>
        <label><input type="checkbox" name="opponent" /> Failure payer is an opponent</label>
        <label><input type="checkbox" name="lineOfSight" /> Failure payer has line of sight to the acting character</label>
        <p>Attack Triumph, Cleave Supremacy, Finesse Supremacy, Grand Skill Mastery, Most Lethal, Sharpshooter Supremacy, Most Deadly, Overkill, Driven, Practice Makes Perfect, Simply Irresistible, Clean and Polished, Dependable and Unreliable adjust the base cost automatically. Selected Jinx reduces the paying opponent’s adjusted cost by1(minimum0), using its own session allowance. The paying character adds the Shaken II/III surcharge after those adjustments, even if the base cost becomes zero. Surcharge dice are not rolled. Apply the recorded effect at the table. The GC can handle payments from other players’ actors; the GC may also use the session’s separate pool.</p></div>`});
      if(!input)return null;
      input.splitFunding=fundingActors.flatMap(a=>[{actorUuid:a.uuid,bonusPoolId:'',count:Number(input['criticalFund_'+a.id]??0)},...unrestrictedBonusPools(a.actionDiceFundingSystem,a.usagePeriods).filter(p=>p.available).map(p=>({actorUuid:a.uuid,bonusPoolId:p.id,count:Number(input['criticalPool_'+a.id+'_'+p.id]??0)}))]).filter(p=>p.count);
    }
    const useGC=input.kind==="failure"&&(input.payerId==="gc"||input.payer==="gc");
    if(useGC&&!game.user?.isGM)return ui.notifications.warn("Only the GC can spend the GC pool.");
    const controller=useGC?gcDiceController({required:false}):null;
    const payer=useGC?null:input.kind==="failure"?(input.payer??game.actors?.get(input.payerId)):this;
    if(!useGC&&(payer?.type!=="agent"||!payer.isOwner))return ui.notifications.warn("Choose a paying character you can update, or ask the GC to resolve the payment.");
    let bonusPoolId=input.bonusPoolId??'';
    if(input.funding){const [payerUuid,id,...extra]=String(input.funding).split('|');if(useGC||payerUuid!==payer.uuid||!id||extra.length)return ui.notifications.warn('Choose a bonus pool belonging to the paying character.');bonusPoolId=id;}
    if(useGC&&bonusPoolId)return ui.notifications.warn('The GC pool cannot spend a character bonus grant.');
    let surchargeBonusPoolId=input.surchargeBonusPoolId??'same';if(input.feeFunding!==undefined&&input.feeFunding!=='same'){if(input.feeFunding==='')surchargeBonusPoolId='';else{const [uuid,id,...extra]=String(input.feeFunding).split('|');if(useGC||uuid!==payer.uuid||!id||extra.length)return ui.notifications.warn('Choose surcharge funding belonging to the paying character.');surchargeBonusPoolId=id;}}
    if(input.splitFunding!==undefined&&!Array.isArray(input.splitFunding))return ui.notifications.warn('Choose valid split contributions for the paying character.');
    if(input.splitFunding?.some(p=>useGC||p.actorUuid!==payer.uuid))return ui.notifications.warn('Split contributions must belong to the selected paying character.');
    const allocations=input.splitFunding?.length?input.splitFunding.map(({bonusPoolId,count})=>({bonusPoolId,count})):input.paymentAllocations;
    if(useGC&&allocations?.length)return ui.notifications.warn('The GC pool uses one GC payment, not character wallets.');
    const expectedShaken=useGC?null:JSON.stringify(shakenRules(payer.actionDiceFundingSystem));
    const work=async()=>{
      if(getActionDieSettlementReview(this).needsReview)return ui.notifications.warn('Review this character’s interrupted action-die settlement before activating another critical result.');
      if(rollEvidence(message.flags.spycraft2)!==expected)return ui.notifications.warn('This result changed while its critical activation was being prepared. Review the current result.');
      if(useGC)await refreshGCDiceTransaction(controller);
      const check=message.flags.spycraft2,base={...input,baseCost:Number(input.baseCost??1),samePayer:!useGC&&payer.uuid===this.uuid};
      let plan=criticalPlan(this.system,check,{...base,available:Number.MAX_SAFE_INTEGER});if(plan.blocked)return ui.notifications.warn(plan.reason);
      const jinxOptions={jinx:input.jinx??false,payerUuid:useGC?'GC':payer.uuid,actingActorUuid:this.uuid};
      plan=jinxCostPlan(useGC?{}:{...payer.system,usagePeriods:payer.usagePeriods},plan,jinxOptions);
      let jinxReservation=null;
      const validateJinxCost=()=>{const fresh=jinxCostPlan({...payer.system,usagePeriods:payer.usagePeriods},criticalPlan(this.system,message.flags.spycraft2,{...base,available:Number.MAX_SAFE_INTEGER}),jinxOptions);if(JSON.stringify(fresh)!==JSON.stringify(plan))throw new Error('The critical effect cost or Jinx source changed before activation.');};
      if(plan.cost&&!allocations?.length){const funding=useGC?{blocked:false,balance:gcDiceStatus().value}:actionDiceFundingContext(payer.actionDiceFundingSystem,{bonusPoolId,periods:payer.usagePeriods});if(funding.blocked)return ui.notifications.warn(funding.reason);if(plan.jinx){if(plan.cost>funding.balance)return ui.notifications.warn('Not enough action dice remain in the paying character’s pool.');}else{plan=criticalPlan(this.system,check,{...base,available:funding.balance});if(plan.blocked)return ui.notifications.warn(plan.reason);}}
      const paymentReceiptId=globalThis.foundry?.utils?.randomID?.()??('critical-'+(this._criticalReceiptSequence=(this._criticalReceiptSequence??0)+1));
      const perform=async(payment=null)=>{
        jinxReservation?.guard();
        const paidPlan=payment?.surcharge?{...plan,adjustedBaseCost:plan.cost,surcharge:payment.surcharge,cost:payment.cost,sources:[...plan.sources,`Shaken surcharge +${payment.surcharge}`]}:plan;
        const gain=hardKnocksGainPlan(this.system,check,{kind:plan.kind,careerDie:globalThis.CONFIG?.SPYCRAFT?.tables?.levels?.[this.system.level??0]?.actionDie??4});
        const next={...check,...(plan.vehicleMountDeclared||plan.targetStandardDeclared?{attackContext:{...check.attackContext,...(plan.vehicleMountDeclared?{vehicleMounted:true,vehicleMountDeclaredAtActivation:true}:{}),...(plan.targetStandardDeclared?{characterTarget:{version:1,source:'gcLegacy',standard:true,confirmedAtActivation:true}}:{})}}:{}),[plan.kind==="success"?"criticalSuccess":"criticalFailure"]:true,criticalActivation:{...(plan.jinx?{jinx:{...plan.jinx,use:structuredClone(jinxReservation.record)}}:{}),kind:plan.kind,payerUuid:useGC?"GC":payer.uuid,cost:paidPlan.cost,baseCost:plan.baseCost,...(payment?.surcharge?{adjustedBaseCost:plan.cost,surcharge:payment.surcharge}:{}),effect:plan.effect,sources:paidPlan.sources,paymentReceiptId,funding:payment?{bonusPoolId:payment.bonusPoolId,die:payment.die,count:plan.cost,...(payment.surcharge||allocations?.length?{surcharge:payment.surcharge,totalCost:payment.cost,allocations:payment.allocations}:{})}:null},...(gain?{schoolOfHardKnocks:{count:1,units:gain.units,die:gain.die}}:{})};
        const creditPath='flags.spycraft2.hardKnocksCredit',previousCredit=structuredClone(this.flags?.spycraft2?.hardKnocksCredit),beforeDice=this.system.actionDice.value;
        const credit={id:paymentReceiptId,messageUuid:message.uuid??message.id,units:gain?.units??0,die:gain?.die??null,session:String(this.usagePeriods.session??'initial')},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),currentCredit=()=>this.flags?.spycraft2?.hardKnocksCredit;
        let restoreWeapon,gained=false,creditAttempted=false;
        try{
          if(gain){creditAttempted=true;try{await this.update({'system.actionDice.value':gain.value,...this.actorRecordRestorePatch(creditPath,credit)});}catch(error){if(!same(currentCredit(),credit))throw error;}gained=true;}
          jinxReservation?.guard();restoreWeapon=await this.syncRollErrorEffect(next,message.uuid??message.id);jinxReservation?.guard();await message.update({"flags.spycraft2":next,flavor:checkFlavor(next)});
        }catch(error){
          if(message.flags?.spycraft2?.criticalActivation?.paymentReceiptId===paymentReceiptId)return paidPlan;
          const failures=[];
          try{await restoreWeapon?.();}catch(rollback){failures.push(rollback);}
          if(gained){
            const balance=this.system.actionDice.value-gain.units;
            if(!same(currentCredit(),credit)||!Number.isSafeInteger(balance)||balance<0)failures.push(new Error('The School of Hard Knocks credit changed before restoration.'));
            else try{await this.update({'system.actionDice.value':balance,...this.actorRecordRestorePatch(creditPath,previousCredit)});}catch(rollback){if(this.system.actionDice.value!==balance||!same(currentCredit(),previousCredit))failures.push(rollback);}
          }else if(creditAttempted&&(!same(currentCredit(),previousCredit)||this.system.actionDice.value!==beforeDice))failures.push(new Error('The class die credit could not be confirmed.'));
          if(failures.length){
            const failure=new AggregateError([error,...failures],'The critical effect could not be safely restored.');failure.actionDiceSettlementReview={purpose:'critical activation',messageUuid:message.uuid??message.id};
            if(gain)await this.markActionDiceSettlementReview({count:gain.units,balance:beforeDice,paymentPath:'system.actionDice.value',bonusPoolId:'',die:gain.die,label:'School of Hard Knocks credit'},failure,{purpose:'School of Hard Knocks credit',messageUuid:message.uuid??message.id});
            throw failure;
          }
          throw error;
        }
        return paidPlan;
      };
      const pay=()=>{
       if(useGC&&plan.cost)return spendGCDice(plan.cost,perform,{purpose:"Critical activation",messageUuid:message.uuid??message.id});
       if(!useGC)return payer.payActionDiceBenefitLocked(plan.cost,perform,{bonusPoolId,surchargeBonusPoolId,allocations,purpose:'Critical activation',benefit:plan.kind==='success'?'criticalSuccess':'criticalFailure',expectedShaken,message,details:{actingActorUuid:this.uuid,kind:plan.kind,...(jinxReservation?{limitedUseSettlement:[jinxReservation.settlement]}:{})}});
       return perform();
      };
      if(plan.jinx)return withJinxReservation(payer,plan,message,reservation=>{jinxReservation=reservation;return pay();},{validateCost:validateJinxCost});
      return pay();
    };
    // One activation at a time across actors avoids reciprocal payment queues deadlocking.
    return queueResources(useGC?[this]:[this,payer],work,{messages:[message]});
  }

  async finishCheck(message,options={}) {
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)return ui.notifications.warn("The GC resolves secret results.");
    const check=message.flags.spycraft2;
    if(check.gearAttempt)return finishGearAcquisition(this,message);
    if(check.requiredBonusPoolId&&bonusPoolForCheck(this.system,check.requiredBonusPoolId,message,{periods:this.usagePeriods}).available)return ui.notifications.warn('Spend the required class bonus die before resolving this check.');
    const candidates=checkCandidates(check);
    if(typeof check.successConfirmed!=="boolean"&&(check.takedown||check.damageSave||candidates.error||candidates.threat||candidates.triumph||automaticSkillSuccessSources(this.system,check).length>0)){
      const result=await this.confirmCheckOutcome(message,options);if(!result)return null;
    }
    const expected=rollEvidence(message.flags.spycraft2);
    return queueResources([this],async()=>{
      const current=message.flags.spycraft2;
      if(current.resolved||current.superseded)return ui.notifications.warn("This result is already resolved or replaced.");
      if(rollEvidence(current)!==expected)return ui.notifications.warn("This roll changed before resolution. Review and confirm its current result.");
      if(current.requiredBonusPoolId&&bonusPoolForCheck(this.system,current.requiredBonusPoolId,message,{periods:this.usagePeriods}).available)return ui.notifications.warn('Spend the required class bonus die before resolving this check.');
      const result=await message.update({"flags.spycraft2.resolved":true,flavor:checkFlavor({...current,resolved:true})});await this.retireCheckBonusPool(message);return result;
    },{messages:[message]});
  }

  async retireCheckBonusPool(message){
    const id=message.flags?.spycraft2?.requiredBonusPoolId,pool=this.system.bonusActionDice?.[id];
    if(!pool||pool.messageUuid!==(message.uuid??message.id)||!pool.remaining)return;
    try{await this.update({[`system.bonusActionDice.${id}.remaining`]:0,[`system.bonusActionDice.${id}.forfeited`]:true});}
    catch(error){ui.notifications.warn('The check is already resolved or replaced, but its unused bonus bookkeeping needs GC review. Do not retry the resolved check.');}
  }

  get participatingCombat() {
    const participates=combat=>combat?.started&&combat.combatants?.some(c=>c.actor?.uuid===this.uuid);
    if(participates(globalThis.game?.combat))return game.combat;
    return [...(globalThis.game?.combats??[])].find(participates)??null;
  }

  async migrateBrightIdeaUses(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    let status=brightIdeaPoolStatus(this.system,this.usagePeriods);if(!status.pending)return null;
    let allocations=options.allocations;
    if(allocations!==undefined&&!game.user?.isGM)throw new Error('The GC reviews allocations of past combined Bright Idea uses.');
    if(allocations===undefined&&!status.automatic){
      if(!game.user?.isGM)throw new Error('Ask the GC to allocate past combined Bright Idea uses.');
      if(status.legacyUsed===null)throw new Error('Review the malformed old Bright Idea counter before allocation.');
      const esc=foundry.utils.escapeHTML,input=await systemDialog.input({window:{title:'Allocate past Bright Idea uses'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>The old combined pool records ${status.legacyUsed} uses this session. Confirm which class supplied each use; the allocated total must match. This preserves past use and grants no dice.</p>${status.sources.map((s,index)=>`<label>${esc(s.name)} (${s.remaining} allowance remaining) <input type="number" name="source_${index}" value="0" min="0" max="${s.remaining}" /></label>`).join('')}</div>`});
      if(!input)return null;allocations=Object.fromEntries(status.sources.map((s,index)=>[s.id,Number(input[`source_${index}`]??0)]));
    }
    return queueResources([this],async()=>{
      if(allocations!==undefined&&!game.user?.isGM)throw new Error('Only the GC may allocate the old combined uses.');
      const plan=brightIdeaMigrationPlan(this.system,this.usagePeriods,allocations,{at:Date.now(),reviewedBy:game.user?.id??'automatic single source'});if(plan)await this.update(plan.updates);return plan;
    });
  }

  async useManualAdjustment(message,options={}){
    if(this.type!=='agent'||!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)throw new Error('The GC resolves Manual Adjustment for a secret check.');
    const expected=rollEvidence(message.flags.spycraft2);let input=options;
    if(!Object.keys(input).length){
      input=await systemDialog.input({window:{title:'Manual Adjustment: reverse a failed check'},rejectClose:false,content:'<div class="spycraft2-roll-options"><p>Use after a failed eligible check, before any critical failure is activated. One half action reverses a retryable failure within effective class level +20, at the lowest positive grade. No action die is spent; one session use is consumed.</p><label>GC-confirmed DC <input type="number" name="difficultyClass" step="1" required /></label><label>Target device <input name="device" required /></label><label><input type="checkbox" name="retryConfirmed" /> The GC confirms this check may be retried</label><label><input type="checkbox" name="halfActionConfirmed" /> Spend one half action</label><label><input type="checkbox" name="whackConfirmed" /> Give the target device a whack</label></div>'});if(!input)return null;
    }
    manualAdjustmentPlan(this.system,message.flags.spycraft2,input);
    return this.useLimitedAbility('manualAdjustment',async()=>{
      const check=message.flags.spycraft2;if(rollEvidence(check)!==expected)throw new Error('This result changed while Manual Adjustment was being declared. Review the current check.');
      const plan=manualAdjustmentPlan(this.system,check,input),safe={...check,cannotError:true};
      const next={...safe,...adjudicateCheck(safe,true),manualAdjustment:plan,cannotErrorBeforeManual:!!check.cannotError};
      let restoreWeapon;try{restoreWeapon=await this.syncRollErrorEffect(next,message.uuid??message.id);await message.update({'flags.spycraft2':next,flavor:checkFlavor(next)});}catch(error){await restoreWeapon?.();throw error;}
      return next;
    },{workflow:'manualAdjustment',messages:[message]});
  }

  async recordHintResponse(options={}){
    if(this.type!=="agent"||!this.isOwner||!game.user?.isGM)throw new Error('The GC records the hint response for an owned agent.');
    let input=options;
    if(!input.outcome){
      const esc=foundry.utils.escapeHTML,sources=hintSources(this.system,[...this.items]);
      input=await systemDialog.input({window:{title:'Record free-hint response'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Record one request after the GC provides or refuses the hint. No action die is charged and the GC gains no die. A refusal grants the source’s bonus dice, without award XP.</p><label>Source <select name="source">${sources.map(spec=>`<option value="${esc(spec.id)}" ${options.source===spec.id?'selected':''}>${esc(spec.name)} (${spec.refusalDice} refusal dice)</option>`).join('')}</select></label><label>GC response <select name="outcome"><option value="provided">Hint provided</option><option value="refused">Hint refused</option></select></label><label>Hint / refusal note <textarea name="text"></textarea></label><label><input type="checkbox" name="minuteConfirmed" /> The agent spends one minute (required for Intuition)</label></div>`});
      if(!input)return null;
    }
    const plan=()=>hintResponsePlan(this.system,[...this.items],{...input,careerDie:CONFIG.SPYCRAFT.tables.levels[this.system.level??0]?.actionDie??4});
    plan();
    return this.useLimitedAbility(input.source,async()=>{
      if(!game.user?.isGM)throw new Error('Only the GC may record a hint response.');
      if(getActionDieSettlementReview(this).needsReview)throw new Error('Review the interrupted action-die settlement before recording another hint.');
      const current=plan(),esc=foundry.utils.escapeHTML,id=foundry.utils.randomID?.()??('hint-'+(this._hintReceiptSequence=(this._hintReceiptSequence??0)+1));
      const path='flags.spycraft2.hintCredit',previous=structuredClone(this.flags?.spycraft2?.hintCredit),before=this.system.actionDice.value,receipt={id,source:input.source,outcome:current.outcome,units:current.units,die:current.die},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),credit=()=>this.flags?.spycraft2?.hintCredit;
      let credited=false,attempted=false;
      try{
        if(current.units){attempted=true;try{await this.update({'system.actionDice.value':current.value,...this.actorRecordRestorePatch(path,receipt)});}catch(error){if(!same(credit(),receipt))throw error;}credited=true;}
        return await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`<p>${esc(current.spec.name)}: ${current.outcome==='provided'?'hint provided':`hint refused; gain ${current.units}d${current.die}`}.</p>${current.text?`<p>${esc(current.text)}</p>`:''}`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'hintResponse',actionDiceAllowed:false,receiptId:id,source:input.source,outcome:current.outcome,bonusDice:current.units,bonusDie:current.die}}});
      }catch(error){
        const posted=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags.spycraft2.checkKind==='hintResponse'&&m.flags.spycraft2.receiptId===id);if(posted)return posted;
        let uncertain=attempted&&!credited&&(!same(credit(),previous)||this.system.actionDice.value!==before),rollbackError=null;
        if(credited){const restored=this.system.actionDice.value-current.units;
          if(!same(credit(),receipt)||!Number.isSafeInteger(restored)||restored<0)uncertain=true;
          else try{await this.update({'system.actionDice.value':restored,...this.actorRecordRestorePatch(path,previous)});}catch(rollback){if(this.system.actionDice.value!==restored||!same(credit(),previous)){uncertain=true;rollbackError=rollback;}}
        }
        if(uncertain){const failure=new AggregateError([error,...(rollbackError?[rollbackError]:[])],'The hint credit needs GC review.');await this.markActionDiceSettlementReview({count:current.units,balance:before,paymentPath:'system.actionDice.value',bonusPoolId:'',die:current.die,label:current.spec.name},failure,{purpose:'hint response credit',hintReceipt:receipt});throw failure;}
        throw error;
      }
    },{workflow:'hintResponse'});
  }

  async useMasterThief(options={}){
    if(this.type!=="agent"||!this.isOwner)throw new Error('You must own the agent using Master Thief.');
    let input=options;
    if(!Object.keys(input).length){
      const esc=foundry.utils.escapeHTML,skills=CONFIG.SPYCRAFT.classFeatures.intruder.classSkills.filter(key=>(this.system.skillTotals?.[key]?.ranks??0)>=4);
      input=await systemDialog.input({window:{title:'Master Thief: replace an opposed skill roll'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Once per session, set one opposed Intruder class-skill result to the opponent’s final result +1. Requires at least four ranks in that skill. No die is rolled, so no action-die boost applies. This result cannot be an error or threat.</p><label>Skill <select name="skillKey">${skills.map(key=>`<option value="${key}">${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`).join('')}</select></label><label>Focus / check, if applicable <input name="focus" /></label><label>Opponent’s final result <input type="number" name="opponentResult" step="1" required /></label><label><input type="checkbox" name="opposedConfirmed" /> This is an opposed skill check</label><label><input type="checkbox" name="opponentFinalConfirmed" /> The GC confirms this opponent’s final result</label><label><input type="checkbox" name="declaredBeforeRolling" /> I declare Master Thief instead of rolling this check</label><label><input type="checkbox" name="secret" /> Secret result (resolved by the GC)</label></div>`});
      if(!input)return null;
    }
    masterThiefPlan(this.system,CONFIG.SPYCRAFT,input);
    if(input.secret&&!game.user?.isGM)throw new Error('The GC resolves a secret Master Thief result.');
    return this.useLimitedAbility('masterThief',async()=>{
      const plan=masterThiefPlan(this.system,CONFIG.SPYCRAFT,input),esc=foundry.utils.escapeHTML;
      return this.rollCheck('@total',{total:plan.total},{...plan,checkKind:'skill',resultSource:'masterThief',rollMode:input.secret?'blindroll':undefined,flavor:`Master Thief: ${esc(CONFIG.SPYCRAFT.skills[plan.skillKey].name)}${plan.focus?` / ${esc(plan.focus)}`:''}`});
    },{workflow:'masterThief'});
  }

  useSafeHouse(options={}){return useSafeHouse(this,options);}
  correctSafeHouseRecord(id,options={}){return correctSafeHouseRecord(this,id,options);}
  placeSafeHouse(id,options={}){return placeSafeHouse(this,id,options);}

  useCareerAgentReward(options={}){return useCareerAgentReward(this,options);}
  reviewCareerAgentReward(options={}){return reviewCareerAgentReward(this,options);}

  useWellFunded(options={}){return useWellFunded(this,options);}

  useToolShed(options={}){return useToolShed(this,options);}

  async improviseCommonItem(options={}){
    if(this.type!=="agent"||!this.isOwner)throw new Error('You must own the agent improvising an item.');
    let input=options;
    if(!Object.keys(input).length){
      input=await systemDialog.input({window:{title:'Improvisation: make one Common Item'},rejectClose:false,content:'<div class="spycraft2-roll-options"><p>Use one Improvisation mission use to make a Common Item from materials at hand. No Gear check, Reserve Item or action die is spent. The full action is resolved at the table.</p><label>Common Item <input name="name" required /></label><label>Weight in pounds <input type="number" name="weight" value="0" min="0" step="any" /></label><label>Description <textarea name="description"></textarea></label><label><input type="checkbox" name="commonConfirmed" /> The GC confirms this object qualifies as a Common Item</label><label><input type="checkbox" name="fullActionConfirmed" /> I spend the required full action</label></div>'});
      if(!input)return null;
    }
    // Validate before charging, then repeat against fresh actor state inside the native queue.
    const id=foundry.utils.randomID();improvisationPlan(this.system,{...input,id});
    return this.useLimitedAbility('improvisation',async()=>{
      const plan=improvisationPlan({...this.system,usagePeriods:this.usagePeriods},{...input,id,at:Date.now()}),esc=foundry.utils.escapeHTML;
      let item,recorded=false;
      try{
        [item]=await this.createEmbeddedDocuments('Item',[{name:plan.name,type:'gear',system:{common:true,quantity:1,weight:plan.weight,caliber:0,pick:'',classGearGrant:plan.stamp,description:`<p>${esc(plan.description)}</p>`}}]);
        await this.update({[`system.classGearGrants.${id}`]:{...plan.record,itemId:item.id}});recorded=true;
        await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Improvisation: ${esc(plan.name)} created with one full action and one mission use. No Gear check, reserve or action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'improvisation',actionDiceAllowed:false,grantId:id,itemUuid:item.uuid}}});
        return item;
      }catch(error){
        if(item){
          try{await this.deleteEmbeddedDocuments('Item',[item.id]);}
          catch(cleanupError){ui.notifications.warn('The improvised item may still exist after a technical failure. Its mission use remains spent; ask the GC to review the item and grant before retrying.');return item;}
        }
        if(recorded)await this.update({[`system.classGearGrants.-=${id}`]:null});
        throw error;
      }
    },{workflow:'improvisation'});
  }

  async selectMissionCaliberGear(options={}){
    if(this.type!=="agent"||!this.isOwner)throw new Error('You must own the agent to select mission gear.');
    let input=options;
    if(!input.itemId){
      const sources=missionCaliberOptions(this.system,[...this.items]).options,esc=foundry.utils.escapeHTML;
      if(!sources.length)throw new Error('No reviewed mission-Caliber ability is available.');
      input=await systemDialog.input({window:{title:'Higher-Caliber mission pick'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Record mission Caliber in reserve setup first. Import the item and assign its ordinary paid mission pick. This ability permits one higher-Caliber pick; it does not grant an extra pick. Caliber V grants upgrades instead, with purchasing/effects adjudicated separately.</p><label>Ability <select name="source">${sources.map(s=>`<option value="${s.key}" ${input.source===s.key?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Item <select name="itemId">${this.items.filter(i=>['weapon','armor','gear'].includes(i.type)&&!isResourceLock(i)).map(i=>`<option value="${i.id}">${esc(i.name)} (Caliber ${i.system.caliber})</option>`).join('')}</select></label><label><input type="checkbox" name="intelConfirmed" /> Chosen as mission gear during Intel</label></div>`});
      if(!input)return null;
    }
    return queueResources([this],async()=>{
      const plan=missionCaliberPlan(this.system,[...this.items],input),item=this.items.get(input.itemId),oldStamp=structuredClone(item.system.missionCaliberGrant??null);
      await item.update({'system.missionCaliberGrant':plan.stamp});
      try{await this.update({[`system.missionCaliberPicks.${plan.key}`]:plan.record});}
      catch(error){await item.update({'system.missionCaliberGrant':oldStamp});throw error;}
      return plan.record;
    });
  }

  async selectBigStickGear(options={}){
    if(this.type!=="agent"||!this.isOwner)throw new Error('You must own the agent to select Big Stick gear.');
    let input=options;
    if(!input.itemId){
      const esc=foundry.utils.escapeHTML;
      input=await systemDialog.input({window:{title:'Big Stick: mission weapon'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Record mission Caliber in the reserve setup first. Import the weapon and assign its normal paid Weapon pick. Big Stick permits one covered pick at one higher Caliber; it does not grant another pick. At Caliber V it grants extra upgrades instead; upgrade purchasing still requires separate adjudication.</p><label>Weapon <select name="itemId">${this.items.filter(i=>i.type==='weapon').map(item=>`<option value="${item.id}">${esc(item.name)} (Caliber ${item.system.caliber})</option>`).join('')}</select></label><label><input type="checkbox" name="intelConfirmed" /> This was chosen as mission gear during Intel</label></div>`});
      if(!input)return null;
    }
    return queueResources([this],async()=>{
      const plan=bigStickPlan(this.system,[...this.items],input),item=this.items.get(input.itemId),oldStamp=structuredClone(item.system.bigStickMissionPick??null);
      await item.update({'system.bigStickMissionPick':plan.stamp});
      try{await this.update({'system.bigStickMissionPick':plan.record});}
      catch(error){await item.update({'system.bigStickMissionPick':oldStamp});throw error;}
      return plan.record;
    });
  }

  async selectArmorUseGear(options={}){
    if(this.type!=="agent"||!this.isOwner)throw new Error('You must own the agent to select Armor Use gear.');
    let input=options;
    if(!input.itemId){
      const esc=foundry.utils.escapeHTML;
      const armor=this.items.filter(item=>item.type==='armor');
      input=await systemDialog.input({window:{title:'Armor Use: mission armor'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Import the desired armor first, leaving its acquisition fields unassigned. Armor Use grants one piece within your earned grade, once per mission, without spending a mission pick. Existing selections cannot be replaced by deleting their item.</p><label>Armor <select name="itemId">${armor.map(item=>`<option value="${item.id}">${esc(item.name)} (Caliber ${item.system.caliber})</option>`).join('')}</select></label><label><input type="checkbox" name="intelConfirmed" /> This selection was made during the Intel Phase</label></div>`});
      if(!input)return null;
    }
    return queueResources([this],async()=>{
      const plan=armorGrantPlan(this.system,[...this.items],input),item=this.items.get(input.itemId);
      const oldStamp=structuredClone(item.system.armorMissionGrant??null);
      await item.update({'system.armorMissionGrant':plan.stamp});
      try{await this.update({'system.armorMissionGrant':plan.record});}
      catch(error){await item.update({'system.armorMissionGrant':oldStamp});throw error;}
      return plan.record;
    });
  }

  reviewReserveTransaction(options={}){return reviewReserveTransaction(this,options);}
  allocateMissionReserves(options={}) {return allocateMissionReserves(this,options);}
  rollGearAcquisition(options={}) {return rollGearAcquisition(this,options);}
  claimGearAcquisition(options={}) {return claimGearAcquisition(this,options);}

  async findImprovisedWeapon(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));
    let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Find an improvised weapon'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Spend one action die on a Gear check to turn up an improvised weapon no more than 4 squares away (pp.346–347). Improvised Weapon Basics adds +3. The GC describes the object and its exact location. Choose weapon statistics from your final result's Table 5.12 row or a lower row.</p><label><input name="nonBarrenConfirmed" type="checkbox" /> This location is not barren</label>${this.system.activeFeatNames?.includes('Personal Stash')?'<label><input name="atHome" type="checkbox" /> I am inside my home (Personal Stash)</label>':''}${this.system.activeFeatNames?.includes('Improvised Weapon Mastery')?`<p>Mastery: the object is adjacent. One search payment may be waived per combat; Shaken surcharges still apply.</p><label><input name="useMastery" type="checkbox" /> Use Mastery's once-per-combat payment waiver (${this.participatingCombat?(this.limitedUseStatus.find(s=>s.id===improvisedMasterySpec(this.system,this.participatingCombat?.id)?.id)?.remaining??0):0} remaining)</label>`:''}${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({unrolled:true})}</div>`});if(!input)return null;}
    const plan=()=>improvisedSearchPlan(this.system,{...input,combatId:this.participatingCombat?.id??''}),first=plan();
    const perform=async payment=>{
      const fresh=plan();if(JSON.stringify(fresh)!==JSON.stringify(first))throw new Error('The improvised search source changed before payment completed.');
      const waiverReceipt=fresh.useMastery?structuredClone(this.system.resourceUses?.[fresh.waiverId]):null;
      if(fresh.useMastery&&(waiverReceipt?.epoch!==fresh.combatId||waiverReceipt?.used!==1))throw new Error('The Mastery combat allowance changed before this search.');
      const snapshot={...fresh,waiverReceipt};
      return this.rollCheck('1d20 + @total',{total:fresh.bonus},{flavor:`Find an improvised weapon: Gear bonus ${fresh.baseGearBonus}${fresh.homeGearBonus?` +${fresh.homeGearBonus} Personal Stash (inside home)`:''}${fresh.basics?' +3 Improvised Weapon Basics':''}. ${fresh.mastery?'Adjacent object (Mastery); player and GC confirm the object and location':'Within 4 squares; GC determines the exact object and location'}.${fresh.useMastery?' Mastery waives the base action-die payment.':''}<br>Table 5.12 — ${IMPROVISED_WEAPON_ROWS.map((row,i)=>`${row.minimum}${i===4?'+':'–'+(IMPROVISED_WEAPON_ROWS[i+1].minimum-1)}: ${row.weapons.join(' or ')}`).join('; ')}. Choose a listed weapon from the final result's row or a lower row.`,checkKind:'gear',checkId:'find-improvised-weapon',threat:0,error:0,cap:null,improvisedSearch:snapshot,preRollFunding:this.preRollPaymentReceipt(payment),validateSkillContext:()=>{if(JSON.stringify(plan())!==JSON.stringify(fresh)||fresh.useMastery&&JSON.stringify(this.system.resourceUses?.[fresh.waiverId])!==JSON.stringify(waiverReceipt))throw new Error('The improvised search source or combat allowance changed before the check was posted.');}});
    };
    const paymentOptions={benefitCount:1,bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),...unrolledPaymentFundingInput(input),purpose:'Find an improvised weapon',benefit:'improvisedSearch',expectedShaken};
    if(first.useMastery)return this.useLimitedAbility(first.waiverId,async()=>{let started=false;const result=await this.payActionDiceBenefitLocked(0,payment=>{started=true;return perform(payment);},paymentOptions);return started?result:null;},{workflow:'improvisedSearch'});
    return this.spendActionDiceBenefit(1,perform,paymentOptions);
  }

  actorRecordValue(path){return path.split('.').reduce((value,key)=>value?.[key],this);}
  actorRecordRestorePatch(path,before){
    if(before===undefined){const keys=path.split('.'),last=keys.pop();return {[keys.join('.')+'.-='+last]:null};}
    const patch={[path]:structuredClone(before)},walk=(at,old,current)=>{if(!old||!current||typeof old!=='object'||typeof current!=='object'||Array.isArray(old)||Array.isArray(current))return;for(const key of Object.keys(current)){if(!Object.hasOwn(old,key))patch[at+'.-='+key]=null;else walk(at+'.'+key,old[key],current[key]);}};walk(path,before,this.actorRecordValue(path));return patch;
  }

  async settleActionDiceHealing(fresh,payment,{kind='healing',eligibility=()=>({blocked:false}),updates={}}={}){
    const roll=fresh.formula?await new Roll(fresh.formula).evaluate():null,eligible=eligibility();if(eligible.blocked)throw new Error(eligible.reason);
    const previousReceipt=structuredClone(this.flags?.spycraft2?.healingReceipt),receiptId=globalThis.foundry?.utils?.randomID?.()??('healing-'+(this._healingReceiptSequence=(this._healingReceiptSequence??0)+1)),beforeExtras=Object.fromEntries(Object.keys(updates).map(path=>[path,structuredClone(this.actorRecordValue(path))]));
    const before={vitality:this.system.vitality.value,wounds:this.system.wounds.value},healed=healingResult(this.system,fresh,roll?.dice.map(d=>d.total)??[]),result={...healed,...(payment.surcharge?{baseCost:healed.cost,surcharge:payment.surcharge,benefitCount:payment.benefitCount,cost:payment.cost}:{})},target={vitality:result.vitality,wounds:result.wounds},funding={bonusPoolId:payment.bonusPoolId,die:payment.healingSources?null:payment.die,count:fresh.cost,...(payment.surcharge||payment.healingSources?{paymentId:payment.id,surcharge:payment.surcharge??0,totalCost:payment.cost,allocations:payment.allocations}:{}),...(payment.healingSources?{healingSources:payment.healingSources}:{})};let healthWriteCompleted=false;
    const extrasMatch=expected=>Object.entries(expected).every(([path,value])=>JSON.stringify(this.actorRecordValue(path))===JSON.stringify(value));
    try{
      await this.update({'system.vitality.value':target.vitality,'system.wounds.value':target.wounds,...updates,...this.actorRecordRestorePatch('flags.spycraft2.healingReceipt',{id:receiptId,kind,at:game.time?.worldTime??this.system.worldTime??0,before,target,funding})});healthWriteCompleted=true;
      const message={speaker:ChatMessage.getSpeaker({actor:this}),flags:{spycraft2:{actorUuid:this.uuid,checkKind:kind,healingReceiptId:receiptId,actionDiceAllowed:false,funding,...result}}},text=`${kind==='refresh'?'Refresh completed. ':''}Spent ${payment.count} action dice${payment.surcharge?` (${payment.surcharge} surcharge; ${fresh.cost} benefit dice)`:''}; recovered ${result.healedVitality} vitality and ${result.healedWounds} wounds.`;
      if(roll)await roll.toMessage({...message,flavor:text});else await ChatMessage.create({...message,content:text});return result;
    }catch(error){
      const now=()=>({vitality:this.system.vitality.value,wounds:this.system.wounds.value}),same=(a,b)=>a.vitality===b.vitality&&a.wounds===b.wounds,currentReceipt=()=>this.flags?.spycraft2?.healingReceipt,previousMatches=()=>JSON.stringify(currentReceipt())===JSON.stringify(previousReceipt),ourReceipt=()=>currentReceipt()?.id===receiptId;
      const posted=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.healingReceiptId===receiptId&&m.flags.spycraft2.vitality===target.vitality&&m.flags.spycraft2.wounds===target.wounds);if(posted&&(healthWriteCompleted||ourReceipt()))return result;
      if(!healthWriteCompleted&&!ourReceipt()&&previousMatches()&&extrasMatch(beforeExtras))throw error;
      if((healthWriteCompleted&&(!currentReceipt()||ourReceipt())||ourReceipt())&&extrasMatch(updates)){
        const restored={vitality:Math.max(0,this.system.vitality.value-result.healedVitality),wounds:this.system.wounds.value-result.healedWounds},restoreExtras=Object.assign({},...Object.entries(beforeExtras).map(([path,value])=>this.actorRecordRestorePatch(path,value)));
        try{await this.update({'system.vitality.value':restored.vitality,'system.wounds.value':restored.wounds,...restoreExtras,...this.actorRecordRestorePatch('flags.spycraft2.healingReceipt',previousReceipt)});}catch(rollback){if(!previousMatches()||!same(now(),restored)||!extrasMatch(beforeExtras)){const failure=new AggregateError([error,rollback],'Healing could not be safely restored.');failure.actionDiceSettlementReview={purpose:kind,before,target,observed:now(),beforeExtras:Object.entries(beforeExtras).map(([path,value])=>({path,value})),targetExtras:Object.entries(updates).map(([path,value])=>({path,value}))};throw failure;}}
        throw error;
      }
      error.actionDiceSettlementReview={purpose:kind,before,target,observed:now(),beforeExtras:Object.entries(beforeExtras).map(([path,value])=>({path,value})),targetExtras:Object.entries(updates).map(([path,value])=>({path,value}))};throw error;
    }
  }

  async healWithActionDice(options={}) {
    if(this.type!=='agent'||!this.isOwner)return null;let input=options;const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Heal outside combat with action dice'},rejectClose:false,content:`<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>Choose all healing benefit dice for this use. The Shaken surcharge is paid once for this healing use and restores no health.</p><label>Benefit dice for vitality <input type="number" name="vitalityDice" min="0" value="1" /></label><label>Benefit dice for wounds (2 points each) <input type="number" name="woundDice" min="0" value="0" /></label>${mixedHealingFundingControl(this)}<p>Vitality dice explode normally. Healing cannot exceed the current maximum. Combat healing requires Refresh.</p></div>`});if(!input)return null;}
    const healingAllocations=mixedHealingFundingInput(input);if(healingAllocations!==undefined)return healFromMultipleSources(this,{healingAllocations,...surchargeFundingInput(input)},expectedShaken);
    const selected={vitalityDice:Number(input.vitalityDice??0),woundDice:Number(input.woundDice??0)},context=()=>({...selected,inCombat:!!this.participatingCombat,dead:this.statuses?.has('dead')??false}),funding=actionDiceFundingContext(this.actionDiceFundingSystem,{bonusPoolId:input.bonusPoolId??'',periods:this.usagePeriods});if(funding.blocked)return ui.notifications.warn(funding.reason);
    const plan=healingPlan(funding.system,context());if(plan.blocked)return ui.notifications.warn(plan.reason);
    return this.spendActionDiceBenefit(plan.cost,async payment=>{
      const eligibility=()=>JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken?{blocked:true,reason:'The Shaken condition changed while resolving healing.'}:healingPlan({...this.system,actionDice:payment.system.actionDice},context()),fresh=eligibility();if(fresh.blocked)throw new Error(fresh.reason);
      return this.settleActionDiceHealing(fresh,payment,{eligibility});
    },{bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),purpose:'Outside-combat healing',benefit:'healing',expectedShaken});
  }

  async refreshWithActionDie(options={}) {
    if(this.type!=="agent"||!this.isOwner)return null;
    let input=options;const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));
    if(!Object.keys(input).length){
      const waiting=this.system.refreshAction?.state==="waiting";
      input=await systemDialog.input({window:{title:"Refresh: full round, then wait until next initiative"},rejectClose:false,content:`<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>Payment occurs only when you complete Refresh.</p>
        <label>Step <select name="phase"><option value="start" ${waiting?"":"selected"}>Begin Refresh</option><option value="complete" ${waiting?"selected":""}>Complete at next initiative</option><option value="targeted">Record an attack during the wait</option><option value="cancel">Cancel pending Refresh</option></select></label>
        <label><input type="checkbox" name="forfeitActions" /> Beginning: forfeit this round’s chance to act</label>
        <label><input type="checkbox" name="atStartOfInitiative" /> Completing: this is the start of my next initiative</label>
        <label><input type="checkbox" name="notTargeted" /> Completing: no attack targeted me since Refresh began, including misses</label>
        <label>Recover <select name="resource"><option value="vitality">One action die’s result in vitality</option><option value="wounds">2 wounds</option></select></label>
        <p>Begin with no conditions. Complete at the start of your next initiative. The GC confirms action timing. Attack targeting is confirmed manually, including attacks made outside this system.</p></div>`});
      if(!input)return null;
    }
    input={...input,phase:input.phase??"start"};
    const context=()=>{
      const combat=this.participatingCombat,current=combat?.combatant;
      const member=current?.actor?.uuid===this.uuid?current:combat?.combatants?.find(c=>c.actor?.uuid===this.uuid);
      return {combat:combat?{id:combat.id,round:combat.round,started:combat.started}:null,options:{...input,combatantId:member?.id,currentCombatantId:current?.id,conditions:[...(this.statuses??[])],dead:this.statuses?.has("dead")??false}};
    };
    if(["targeted","cancel"].includes(input.phase)){
      const work=async()=>{
        const record=this.system.refreshAction;if(record?.state!=="waiting")return ui.notifications.warn("There is no pending Refresh.");
        return this.update(input.phase==="targeted"?{"system.refreshAction.targeted":true}:{"system.refreshAction.state":"cancelled"});
      };
      return queueResources([this],work);
    }
    if(input.phase==="start"){
      const work=async()=>{const now=context(),plan=refreshPlan(this.system,now.combat,now.options);if(plan.blocked)return ui.notifications.warn(plan.reason);await this.update({"system.refreshAction":plan.record});return plan.record;};
      return queueResources([this],work);
    }
    const funding=actionDiceFundingContext(this.actionDiceFundingSystem,{bonusPoolId:input.bonusPoolId??'',periods:this.usagePeriods});if(funding.blocked)return ui.notifications.warn(funding.reason);
    const now=context(),plan=refreshPlan(funding.system,now.combat,now.options);if(plan.blocked)return ui.notifications.warn(plan.reason);
    return this.spendActionDiceBenefit(1,async payment=>{
      const eligibility=()=>{if(JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken)return {blocked:true,reason:'The Shaken condition changed while completing Refresh.'};const current=context();return refreshPlan({...this.system,actionDice:payment.system.actionDice},current.combat,current.options);},fresh=eligibility();if(fresh.blocked)throw new Error(fresh.reason);
      return this.settleActionDiceHealing(fresh,payment,{kind:'refresh',eligibility,updates:{'system.refreshAction':fresh.record}});
    },{bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),purpose:'Refresh healing',benefit:'refresh',expectedShaken});
  }

  async activateNoFear(){
    if(this.type!=="agent"||!this.isOwner)return null;
    const context=()=>{const combat=this.participatingCombat,own=combat?.turns?.find(c=>c.actor?.uuid===this.uuid);return combat?{id:combat.id,round:combat.round,started:combat.started,turn:combat.turn,combatantId:own?.id,ownTurnIndex:combat.turns?.findIndex(c=>c.id===own?.id)??-1}:null;};
    const first=noFearPlan({...this.system,usagePeriods:this.usagePeriods},context());if(first.blocked)return ui.notifications.warn(first.reason);
    return this.useLimitedAbility('noFear',async()=>{
      const plan=noFearPlan({...this.system,usagePeriods:this.usagePeriods},context());if(plan.blocked)throw new Error(plan.reason);
      const before=structuredClone(this.system.noFearBoost??null);await this.update({'system.noFearBoost':plan.record});
      try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`No Fear II: stress damage resistance ${plan.record.resistance} for ${plan.record.rounds} rounds, until own initiative in round ${plan.record.dueRound}. One session use spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'noFear',actionDiceAllowed:false,...plan.record}}});}
      catch(error){await this.update({'system.noFearBoost':before});throw error;}
      return plan.record;
    },{workflow:'noFear'});
  }

  async boostFortunesOfWar(){
    if(this.type!=="agent"||!this.isOwner)return null;
    const context=()=>{const combat=this.participatingCombat,own=combat?.turns?.find(c=>c.actor?.uuid===this.uuid);return combat?{id:combat.id,round:combat.round,started:combat.started,turn:combat.turn,combatantId:own?.id,ownTurnIndex:combat.turns?.findIndex(c=>c.id===own?.id)??-1}:null;};
    const initial=fortunesOfWarPlan(this.system,context());if(initial.blocked)return ui.notifications.warn(initial.reason);
    return this.useLimitedAbility("fortunesOfWar",async()=>{
      const current={...this.system,usagePeriods:this.usagePeriods},plan=fortunesOfWarPlan(current,context());if(plan.blocked)throw new Error(plan.reason);
      const before=structuredClone(this.system.fortunesOfWarBoost??null);await this.update({"system.fortunesOfWarBoost":plan.record});
      try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Fortunes of War: double only its own DR until the start of this character’s initiative in round ${plan.record.dueRound}. One session use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:"fortunesOfWar",actionDiceAllowed:false,...plan.record}}});}
      catch(error){await this.update({"system.fortunesOfWarBoost":before});throw error;}
      return plan.record;
    },{workflow:"fortunesOfWar"});
  }

  async boostDefenseWithActionDie(options={}) {
    if(this.type!=='agent'||!this.isOwner)return null;let input=options;const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));
    const roundSignature=()=>{const c=this.participatingCombat;return JSON.stringify(c?{id:c.id,round:c.round}:null);},expectedRound=roundSignature();
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Boost Defense for rolled rounds'},rejectClose:false,content:`<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>Spend one benefit die for +2 Defense. The selected die's result determines duration in rounds.</p><label><input name="atStartOfRound" type="checkbox" /> This is the start of the combat round</label><label><input name="replaceExisting" type="checkbox" /> Replace any existing action-die Defense boost</label>${this.system.coreClassIds?.includes('transporter')?'<p>Watchful Initiative is resolved by the GC while its roll interpretation is pending.</p>':''}</div>`});if(!input)return null;}
    const context=()=>{const c=this.participatingCombat;return {combat:c?{id:c.id,round:c.round,started:c.started}:null,options:{...input,combatant:c?.combatants?.some(m=>m.actor?.uuid===this.uuid)??false}};},funding=actionDiceFundingContext(this.actionDiceFundingSystem,{bonusPoolId:input.bonusPoolId??'',periods:this.usagePeriods});if(funding.blocked)return ui.notifications.warn(funding.reason);
    const first=context(),plan=defenseBoostPlan(funding.system,first.combat,first.options);if(plan.blocked)return ui.notifications.warn(plan.reason);
    return this.spendActionDiceBenefit(1,async payment=>{
      if(roundSignature()!==expectedRound)throw new Error('The Defense declaration belongs to an earlier combat round. Confirm the current round start.');
      const now=context(),fresh=defenseBoostPlan({...this.system,actionDice:payment.system.actionDice},now.combat,now.options);if(fresh.blocked)throw new Error(fresh.reason);
      const roll=await new Roll(fresh.formula).evaluate();if(JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken)throw new Error('The Shaken condition changed while resolving Defense.');const rounds=Math.max(0,Math.trunc(roll.total));if(!Number.isSafeInteger(rounds)||!Number.isSafeInteger(now.combat.round+rounds))throw new Error('Review the rolled Defense duration before applying it.');
      const before=structuredClone(this.system.defenseBoost??null),receiptId=globalThis.foundry?.utils?.randomID?.()??('defense-'+(this._defenseReceiptSequence=(this._defenseReceiptSequence??0)+1)),fundingInfo={bonusPoolId:payment.bonusPoolId,die:payment.die,count:1,...(payment.surcharge?{paymentId:payment.id,surcharge:payment.surcharge,totalCost:payment.cost,allocations:payment.allocations}:{})},boost={combatId:now.combat.id,startRound:now.combat.round,expiresAtRound:now.combat.round+rounds,rounds,actionDiceReceiptId:receiptId,funding:fundingInfo};let writeCompleted=false;
      try{
        await this.update(this.actorRecordRestorePatch('system.defenseBoost',boost));writeCompleted=true;
        await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:this}),flavor:`Spent ${payment.count} action ${payment.count===1?'die':'dice'}${payment.surcharge?` (${payment.surcharge} surcharge; one benefit die rolled)`:''}: +2 Defense for ${rounds} rounds (through round ${boost.expiresAtRound-1}).`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'defenseDuration',defenseReceiptId:receiptId,actionDiceAllowed:false,...boost}}});return boost;
      }catch(error){
        const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),current=()=>this.system.defenseBoost??null,ourReceipt=()=>current()?.actionDiceReceiptId===receiptId,posted=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.defenseReceiptId===receiptId);
        if(posted&&(writeCompleted||ourReceipt()))return boost;
        if(!writeCompleted&&!ourReceipt()&&same(current(),before))throw error;
        if(ourReceipt()&&same(current(),boost)){
          try{await this.update(this.actorRecordRestorePatch('system.defenseBoost',before));}catch(rollback){if(!same(current(),before)){const failure=new AggregateError([error,rollback],'Defense could not be safely restored.');failure.actionDiceSettlementReview={purpose:'Defense boost',beforeBoost:before,targetBoost:boost,observedBoost:current()};throw failure;}}throw error;
        }
        error.actionDiceSettlementReview={purpose:'Defense boost',beforeBoost:before,targetBoost:boost,observedBoost:current()};throw error;
      }
    },{bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),purpose:'Defense boost',benefit:'defenseBoost',expectedShaken});
  }

  async refundActionDicePayment(payment){
    if(payment.payments){if(!paymentRecordMatches(this,payment)||payment.state!=='reserved')throw new Error('Review the original payment reservation before refunding.');const patch=multipartRefundPatch(this.actionDiceFundingSystem,payment),expected=patch['flags.spycraft2.actionDiePayments.'+payment.id];try{await this.update(patch);}catch(error){if(!paymentRecordMatches(this,expected))throw error;}return;}
    const patch=actionDicePaymentRefund(this.actionDiceFundingSystem,payment),expected=patch[payment.paymentPath];
    try{await this.update(patch);}catch(error){const current=payment.bonusPoolId?this.system.bonusActionDice?.[payment.bonusPoolId]:null,balance=payment.bonusPoolId?current?.remaining:this.system.actionDice.value;if(balance!==expected||payment.bonusPoolId&&actionDicePoolFingerprint(current)!==payment.poolFingerprint)throw error;}
  }

  async reviewActionDiceSettlement(options={}){
    if(!game.user?.isGM)throw new Error('Only the GC may review an interrupted action-die settlement.');if(this.type!=='agent'||!this.isOwner)return null;
    const saved=getActionDieSettlementReview(this);if(!saved?.needsReview)return null;if(saved.payments)return reviewMultipartActionDice(this,options);
    const source=saved.payment;if(!source||typeof source.bonusPoolId!=='string'||source.bonusPoolId&&!/^[A-Za-z0-9_-]+$/.test(source.bonusPoolId)||source.paymentPath!==(source.bonusPoolId?'system.bonusActionDice.'+source.bonusPoolId+'.remaining':'system.actionDice.value'))throw new Error('Review the saved payment source before reconciling action dice.');
    const state=()=>{const r=getActionDieSettlementReview(this),p=r?.payment,pool=p?.bonusPoolId?this.system.bonusActionDice?.[p.bonusPoolId]:null;const related=r?.messageUuid&&game.messages?.get?.(String(r.messageUuid).split('.').at(-1));return {review:r,messageEvidence:related?rollEvidence(related.flags?.spycraft2??{}):null,poolFingerprint:actionDicePoolFingerprint(pool),balance:p?.bonusPoolId?pool?.remaining:this.system.actionDice.value,vitality:this.system.vitality.value,wounds:this.system.wounds.value,refreshAction:this.system.refreshAction,defenseBoost:this.system.defenseBoost,eagleEyeBoost:this.system.eagleEyeBoost,resourceUses:this.system.resourceUses};},expected=JSON.stringify(state());let input=options;
    if(input.healthReviewed===undefined){const esc=foundry.utils.escapeHTML,current=state();input=await systemDialog.input({window:{title:'Review interrupted action-die use'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${esc(saved.payment.label)}; current health ${current.vitality} vitality / ${current.wounds} wounds. If health needs correction, close this dialog, correct health on Main, and reopen this review before confirming.</p><p>${esc(saved.reason)}</p><label>Confirmed action-die balance <input name="balance" type="number" min="0" step="1" value="${current.balance??0}" /></label>${saved.limitedUseSettlement?.length?'<label><input name="restoreLimitedUses" type="checkbox" /> No replacement result or other activation effect remains; restore this activation’s recorded limited uses</label>':''}<label>Resolution <input name="resolution" required /></label><label><input name="healthReviewed" type="checkbox" /> The GC reviewed actual health, action state and action-die balances and completed any required corrections</label></div>`});if(!input)return null;}
    return queueResources([this],async()=>{
      if(!game.user?.isGM)throw new Error('Only the GC may review an interrupted action-die settlement.');
      if(JSON.stringify(state())!==expected)throw new Error('Health, dice or the saved review changed. Review the current values again.');
      const review=getActionDieSettlementReview(this),p=review.payment,pool=p.bonusPoolId?this.system.bonusActionDice?.[p.bonusPoolId]:null,balance=Number(input.balance);
      if(input.healthReviewed!==true||typeof input.resolution!=='string'||!input.resolution.trim()||!Number.isSafeInteger(balance)||balance<0)throw new Error('The GC must confirm the corrected whole-die balance and record the resolution.');
      if(p.bonusPoolId&&(actionDicePoolFingerprint(pool)!==p.poolFingerprint||balance>pool.granted))throw new Error('The original bonus grant changed or the confirmed balance exceeds its grant.');
      const useUpdates={};
      if(input.restoreLimitedUses===true){
        const rows=review.limitedUseSettlement;if(!Array.isArray(rows)||!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Review the recorded limited-use sources.');
        for(const row of rows){
          const valid=v=>v&&typeof v.epoch==='string'&&Number.isSafeInteger(v.used)&&v.used>=0;
          if(typeof row.id!=='string'||!/^[A-Za-z0-9_%:-]+$/.test(row.id)||!valid(row.reserved)||row.before!==null&&!valid(row.before)||row.before?.epoch===row.reserved.epoch&&row.before.used!==row.reserved.used-1||JSON.stringify(this.system.resourceUses?.[row.id])!==JSON.stringify(row.reserved))throw new Error('The limited-use source changed or its saved restoration is invalid. Review its current count.');
          Object.assign(useUpdates,this.actorRecordRestorePatch('system.resourceUses.'+row.id,row.before===null?undefined:row.before));
        }
      }
      const completed={...review,limitedUsesRestored:input.restoreLimitedUses===true,needsReview:false,resolvedAt:game.time?.worldTime??this.system.worldTime??0,reviewedBy:game.user.id??'GC',resolution:input.resolution.trim(),settledBalance:balance};
      const patch={...useUpdates,[p.paymentPath]:balance,...(review.grantReview===true&&p.bonusPoolId?{['system.bonusActionDice.'+p.bonusPoolId+'.needsReview']:false}:{}),'flags.spycraft2.actionDiceSettlementReview':completed};try{await this.update(patch);}catch(error){if(JSON.stringify(this.flags?.spycraft2?.actionDiceSettlementReview)!==JSON.stringify(completed))throw error;}clearPendingActionDieReview(this,review.id);this.system.actionDiceSettlementReview=completed;return completed;
    });
  }

  async markActionDiceSettlementReview(payment,error,details={}){
    if(payment.payments)return markMultipartActionDieReview(this,payment,error,details);
    const review={id:globalThis.foundry?.utils?.randomID?.()??('settlement-'+(this._settlementSequence=(this._settlementSequence??0)+1)),needsReview:true,at:game.time?.worldTime??this.system.worldTime??0,reason:error.message,payment:{count:payment.count,balance:payment.balance,paymentPath:payment.paymentPath,bonusPoolId:payment.bonusPoolId,die:payment.die,label:payment.label,poolFingerprint:payment.poolFingerprint??null},...details};
    setPendingActionDieReview(this,review);try{await this.update(this.actorRecordRestorePatch('flags.spycraft2.actionDiceSettlementReview',review));}catch{}ui.notifications.warn(details.grantReview?'The bonus-die grant needs GC review. Its mission use remains spent; review the grant and receipt.':'The action-die settlement needs GC review. Its reserved dice remain spent; review health and the selected balance before retrying.');return review;
  }

  actionDiceSurchargeControl(options={}){return surchargeFundingControl(this,options)+(options.unrolled?unrolledPaymentFundingControl(this):'');}
  spendActionDiceBenefit(baseCost,perform,options={}){return queueResources([this],()=>this.payActionDiceBenefitLocked(baseCost,perform,options));}
  payActionDiceBenefitLocked(baseCost,perform,options={}){return payActionDieBenefitLocked(this,baseCost,perform,options);}

  spendMultipartActionDice(allocations,perform,options={}){return queueResources([this],()=>this.payMultipartActionDiceLocked(allocations,perform,options));}
  payMultipartActionDiceLocked(allocations,perform,options={}){return payMultipartActionDiceLocked(this,allocations,perform,options);}

  spendActionDice(count,perform,options={}) {
    return queueResources([this],()=>this.payActionDiceLocked(count,perform,options));
  }

  /** Caller must already hold this actor's resource transaction. */
  async payActionDiceLocked(count,perform,{bonusPoolId=''}={}) {
      if(!this.isOwner)throw new Error('You must own the actor spending action dice.');
      const payment=actionDicePaymentPlan(this.actionDiceFundingSystem,{count,bonusPoolId,periods:this.usagePeriods});if(payment.blocked)return ui.notifications.warn(payment.reason);
      try{await this.update({[payment.paymentPath]:payment.afterBalance});}catch(error){
        const balance=bonusPoolId?this.system.bonusActionDice?.[bonusPoolId]?.remaining:this.system.actionDice.value;
        if(balance===payment.afterBalance)try{await this.refundActionDicePayment(payment);}catch(rollback){await this.markActionDiceSettlementReview(payment,rollback,{purpose:'payment reservation'});throw new AggregateError([error,rollback],'Review the interrupted payment reservation.');}
        else if(balance!==payment.balance)await this.markActionDiceSettlementReview(payment,error,{purpose:'payment reservation'});throw error;
      }
      try{return await perform(payment);}catch(error){
        if(error.actionDiceSettlementReview){await this.markActionDiceSettlementReview(payment,error,error.actionDiceSettlementReview);throw error;}
        try{await this.refundActionDicePayment(payment);}catch(rollback){await this.markActionDiceSettlementReview(payment,rollback,{purpose:'payment refund'});throw new AggregateError([error,rollback],'The selected action-die balance needs review.');}throw error;
      }
  }

  async markActionDieAwardReview(transaction,error){
    const review={needsReview:true,transaction:structuredClone(transaction),reason:error.message,at:game.time?.worldTime??0};
    try{await this.update(this.actorRecordRestorePatch('flags.spycraft2.actionDieAwardReview',review));}catch{}
    ui.notifications.warn('The award needs GC review before awarding or spending more dice. Check player dice, the award ledger and the GC pool.');
    return review;
  }

  async awardActionDice(options={}){
    if(!game.user?.isGM)throw new Error('Only the GC can award action dice.');
    if(this.type!=='agent'||!this.isOwner)return null;
    if(this.startingDiceEntry?.blocked===false)throw new Error('Begin this character’s first session with starting dice before recording awards.');
    if(this.flags?.spycraft2?.missionXPReview?.needsReview)throw new Error('Review the interrupted mission XP settlement before recording more awards.');
    if(this.flags?.spycraft2?.actionDieAwardReview?.needsReview)throw new Error('Review the interrupted award before adding another award.');
    let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Award roleplay action dice'},rejectClose:false,content:'<p>Ordinary GC awards add player dice, one GC die per awarded die, and counts for mission XP settlement. Bonus dice from abilities use their own rules.</p><label>Dice awarded <input name="count" type="number" min="1" step="1" value="1" required /></label><label>Reason <input name="reason" required /></label>'});if(!input)return null;}
    return queueResources([this],()=>withGCDicePool(async(pool)=>{
      if(this.startingDiceEntry?.blocked===false)throw new Error('Begin this character’s first session with starting dice before recording awards.');
      if(this.flags?.spycraft2?.missionXPReview?.needsReview)throw new Error('Review the interrupted mission XP settlement before recording more awards.');
      if(!game.user?.isGM||this.flags?.spycraft2?.actionDieAwardReview?.needsReview)throw new Error('Only the GC may award dice after resolving any interrupted award.');
      const id=foundry.utils.randomID(),periods=this.usagePeriods,plan=actionDieAwardPlan(this.system,{count:Number(input.count??1),reason:input.reason,careerDie:globalThis.CONFIG?.SPYCRAFT?.tables?.levels?.[this.system.level??0]?.actionDie??4,mission:periods.mission??'initial',session:periods.session??'initial',id,at:Date.now()}),value=pool.value+plan.gcGain;
      if(!Number.isSafeInteger(value))throw new Error('The GC balance exceeds a safe whole number.');
      const beforeLedger=structuredClone(this.system.actionDieAwards?.[plan.key]??null),beforeBalance=this.system.actionDice.value,next={...pool,value,lastReason:'Player action-die award: '+this.name},transaction={id,key:plan.key,mission:String(periods.mission??'initial'),session:String(periods.session??'initial'),units:plan.units,count:plan.count,die:plan.die,beforeBalance,beforeLedger,afterLedger:plan.record,gcBefore:pool,gcAfter:next},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),ledger=()=>this.system.actionDieAwards?.[plan.key]??null,gc=()=>game.settings.get('spycraft2','gcActionDice');
      try{await this.update({'system.actionDice.value':plan.value,...this.actorRecordRestorePatch('system.actionDieAwards.'+plan.key,plan.record)});}
      catch(error){if(!same(ledger(),plan.record)){if(!same(ledger(),beforeLedger)||this.system.actionDice.value!==beforeBalance)await this.markActionDieAwardReview(transaction,error);throw error;}}
      try{
        try{await game.settings.set('spycraft2','gcActionDice',next);}catch(error){if(!same(gc(),next))throw error;}
        try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`${foundry.utils.escapeHTML(this.name)} receives ${plan.units} d${plan.die} action dice from ${plan.count} GC awards; GC pool +${plan.gcGain}. ${foundry.utils.escapeHTML(String(input.reason).trim())} Award count recorded for mission XP settlement.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'actionDieAward',awardId:id,count:plan.count,units:plan.units,die:plan.die,actionDiceAllowed:false}}});}
        catch(error){if(![...(game.messages??[])].some(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.awardId===id))throw error;}
        return plan;
      }catch(error){
        if(!same(ledger(),plan.record)||!Number.isSafeInteger(this.system.actionDice.value)||this.system.actionDice.value<plan.units||!same(gc(),pool)&&!same(gc(),next)){await this.markActionDieAwardReview(transaction,error);throw error;}
        const balance=this.system.actionDice.value-plan.units,updates={'system.actionDice.value':balance,...this.actorRecordRestorePatch('system.actionDieAwards.'+plan.key,beforeLedger===null?undefined:beforeLedger)};
        try{await this.update(updates);}catch(rollback){if(this.system.actionDice.value!==balance||!same(ledger(),beforeLedger)){await this.markActionDieAwardReview(transaction,rollback);throw new AggregateError([error,rollback],'The player award could not be safely restored.');}}
        if(same(gc(),next))try{await game.settings.set('spycraft2','gcActionDice',pool);}catch(rollback){if(!same(gc(),pool)){await this.markActionDieAwardReview(transaction,rollback);throw new AggregateError([error,rollback],'The GC award could not be safely restored.');}}
        throw error;
      }
    }));
  }

  async reviewActionDieAward(options={}){
    if(!game.user?.isGM)throw new Error('Only the GC may review an interrupted award.');
    if(this.type!=='agent'||!this.isOwner)return null;
    const saved=this.flags?.spycraft2?.actionDieAwardReview;if(!saved?.needsReview)return null;
    const tx=saved.transaction,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),key=tx&&encodeURIComponent(String(tx.mission)).replaceAll('.','%2E');
    if(!tx||tx.key!==key||!tx.id||!Array.isArray(tx.afterLedger?.events)||!tx.afterLedger.events.some(e=>e.id===tx.id)||tx.afterLedger.mission!==tx.mission||!Number.isSafeInteger(tx.afterLedger.count)||tx.afterLedger.count<1)throw new Error('Review the saved award source before reconciling it.');
    const state=()=>({review:this.flags?.spycraft2?.actionDieAwardReview,player:this.system.actionDice.value,ledger:this.system.actionDieAwards?.[key]??null,gc:game.settings.get('spycraft2','gcActionDice')}),expected=JSON.stringify(state());let input=options;
    if(input.confirmed===undefined){const current=state(),esc=foundry.utils.escapeHTML;input=await systemDialog.input({window:{title:'Review interrupted award'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${esc(saved.reason)}</p><p>Review the actual player dice, recorded award, GC pool and any posted receipt. Initialize this session’s GC pool first if the session changed.</p><label>Award <select name="retainAward"><option value="retain">Retain this award in the mission XP ledger</option><option value="cancel">Cancel this award in the mission XP ledger</option></select></label><label>Confirmed player dice <input name="playerBalance" type="number" min="0" step="1" value="${current.player}" /></label><label>Confirmed GC dice <input name="gcBalance" type="number" min="0" step="1" value="${current.gc?.value??0}" /></label><label>Resolution <input name="resolution" required /></label><label><input name="confirmed" type="checkbox" /> The GC reviewed the award, actual balances and receipt</label></div>`});if(!input)return null;input={...input,retainAward:input.retainAward==='retain'?true:input.retainAward==='cancel'?false:null};}
    return queueResources([this],()=>withGCDicePool(async(pool)=>{
      if(!game.user?.isGM)throw new Error('Only the GC may review an interrupted award.');
      if(JSON.stringify(state())!==expected)throw new Error('The award or balances changed. Review the current values again.');
      const number=v=>typeof v==='string'&&!v.trim()?NaN:Number(v),playerBalance=number(input.playerBalance),gcBalance=number(input.gcBalance);
      if(input.confirmed!==true||typeof input.retainAward!=='boolean'||![playerBalance,gcBalance].every(v=>Number.isSafeInteger(v)&&v>=0)||typeof input.resolution!=='string'||!input.resolution.trim())throw new Error('Confirm the award disposition, whole-die balances and resolution.');
      const current=this.system.actionDieAwards?.[key]??null;if(!same(current,tx.beforeLedger)&&!same(current,tx.afterLedger))throw new Error('The mission award ledger changed; review its other entries before restoring this award.');
      await this.update({'system.actionDice.value':playerBalance,...this.actorRecordRestorePatch('system.actionDieAwards.'+key,input.retainAward?tx.afterLedger:tx.beforeLedger===null?undefined:tx.beforeLedger)});
      const next={...pool,value:gcBalance,lastReason:'Reviewed interrupted award: '+this.name};
      try{await game.settings.set('spycraft2','gcActionDice',next);}catch(error){if(!same(game.settings.get('spycraft2','gcActionDice'),next))throw error;}
      const completed={...saved,needsReview:false,retained:input.retainAward,playerBalance,gcBalance,resolution:input.resolution.trim(),reviewedBy:game.user.id??'GC',resolvedAt:game.time?.worldTime??0};
      try{await this.update(this.actorRecordRestorePatch('flags.spycraft2.actionDieAwardReview',completed));}catch(error){if(!same(this.flags?.spycraft2?.actionDieAwardReview,completed))throw error;}
      return completed;
    },{allowAwardReview:true}));
  }

  async settleMissionXP(options={}){
    if(this.flags?.spycraft2?.missionXPReview?.needsReview)throw new Error('Review the interrupted mission XP settlement before settling again.');
    if(this.flags?.spycraft2?.actionDieAwardReview?.needsReview)throw new Error('Review the interrupted award before settling mission XP.');
    if(!game.user?.isGM)throw new Error("Only the GC can settle mission XP.");
    if(this.type!=="agent"||!this.isOwner)return null;
    const settlementContext=()=>{const mission=String(this.usagePeriods.mission??'initial'),key=encodeURIComponent(mission).replaceAll('.','%2E');return JSON.stringify({mission,level:this.system.level,xp:this.system.xp,awards:this.system.actionDieAwards?.[key]??null,reward:this.system.missionXPRewards?.[key]??null});},expectedContext=settlementContext();
    let input=options;
    if(!Object.keys(input).length){
      input=await systemDialog.input({window:{title:"Settle mission XP — p.440"},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Base mission XP gains 25 per awarded action die, capped at 25 × Career Level. Multiply that combined base by the lower of Career Level and Threat Level. Current award count: ${this.system.actionDieAwardSummary?.count??0}.</p><label>Base mission XP before action-die awards <input type="number" name="baseXP" min="0" value="${missionSettlementDefaults().baseXP}" required /></label><label>Team Threat Level <input type="number" name="threatLevel" min="1" value="${missionSettlementDefaults().threatLevel??Math.max(1,this.system.level)}" required /></label><label>Additional post-multiplier XP <input type="number" name="additionalXP" min="0" value="0" /></label><label>Source of additional XP <input name="modifierReason" placeholder="GC-calculated Crossroads, Triumph or other bonus" /></label><p>Crossroads and Triumph percentages are not calculated by this control. Review their eligibility and rounding, then enter their final XP contribution above. A Crossroads Title first earned this mission starts its benefits next mission.</p><label><input type="checkbox" name="missionCompleteConfirmed" /> The mission has ended; all post-multiplier modifiers were reviewed and included</label></div>`});if(!input)return null;
    }
    return queueResources([this],async()=>{
      if(!game.user?.isGM)throw new Error('Only the GC can settle mission XP.');
      if(this.flags?.spycraft2?.missionXPReview?.needsReview)throw new Error('Review the interrupted mission XP settlement before settling again.');
      if(this.flags?.spycraft2?.actionDieAwardReview?.needsReview)throw new Error('Review the interrupted award before settling mission XP.');
      if(settlementContext()!==expectedContext)throw new Error('Mission, level, XP or award counts changed while settlement was being prepared. Review the current mission.');
      const mission=this.usagePeriods.mission??'initial',plan=missionXPPlan(this.system,{baseXP:Number(input.baseXP??0),threatLevel:Number(input.threatLevel??1),additionalXP:Number(input.additionalXP??0),modifierReason:input.modifierReason,missionCompleteConfirmed:!!input.missionCompleteConfirmed,mission,at:Date.now()});
      const settlementId=foundry.utils.randomID(),record={...plan.record,settlementId},beforeXP=this.system.xp,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),current=()=>this.system.missionXPRewards?.[plan.key]??null,transaction={id:settlementId,key:plan.key,mission:String(mission),beforeXP,record};
      const markReview=async error=>{try{await this.update(this.actorRecordRestorePatch('flags.spycraft2.missionXPReview',{needsReview:true,transaction,reason:error.message,at:game.time?.worldTime??0}));}catch{}ui.notifications.warn('The mission XP settlement needs GC review. Check actual XP and the recorded mission reward before retrying.');};
      try{await this.update({'system.xp':plan.xp,...this.actorRecordRestorePatch('system.missionXPRewards.'+plan.key,record)});}
      catch(error){if(!same(current(),record)){if(current()!==null||this.system.xp!==beforeXP)await markReview(error);throw error;}}
      try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Mission XP: (${plan.record.baseXP} base + ${plan.record.awardBaseBonus} action-die award base XP) × ${plan.record.multiplier} + ${plan.record.additionalXP} declared post-multiplier XP = ${plan.record.totalXP} XP. ${foundry.utils.escapeHTML(plan.record.modifierReason)}`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:"missionXP",...record,actionDiceAllowed:false}}});}
      catch(error){
        if([...(game.messages??[])].some(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.checkKind==='missionXP'&&m.flags.spycraft2.settlementId===settlementId))return record;
        if(!same(current(),record)||!Number.isSafeInteger(this.system.xp)||this.system.xp<record.totalXP){await markReview(error);throw error;}
        const restoredXP=this.system.xp-record.totalXP;
        try{await this.update({'system.xp':restoredXP,[`system.missionXPRewards.-=${plan.key}`]:null});}catch(rollback){if(this.system.xp!==restoredXP||current()!==null){await markReview(rollback);throw new AggregateError([error,rollback],'The mission XP could not be safely restored.');}}
        throw error;
      }
      return record;
    });
  }

  async reviewMissionXP(options={}){
    if(!game.user?.isGM)throw new Error('Only the GC may review an interrupted XP settlement.');
    if(this.type!=='agent'||!this.isOwner)return null;
    const saved=this.flags?.spycraft2?.missionXPReview;if(!saved?.needsReview)return null;
    const tx=saved.transaction,key=tx&&encodeURIComponent(String(tx.mission)).replaceAll('.','%2E'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(!tx||tx.key!==key||!tx.id||tx.record?.settlementId!==tx.id||tx.record?.mission!==tx.mission||!Number.isSafeInteger(tx.record.totalXP)||tx.record.totalXP<0)throw new Error('Review the saved mission XP source before reconciling it.');
    const r=tx.record,whole=v=>Number.isSafeInteger(v)&&v>=0,baseBonus=25*Math.min(r.awardedDice,r.level),multiplier=Math.min(r.level,r.threatLevel);
    if(![r.baseXP,r.awardedDice,r.additionalXP,r.totalXP].every(whole)||!Number.isSafeInteger(r.level)||r.level<1||r.level>20||!Number.isSafeInteger(r.threatLevel)||r.threatLevel<1||r.awardBaseBonus!==baseBonus||r.combinedBase!==r.baseXP+baseBonus||r.multiplier!==multiplier||r.coreXP!==(r.baseXP+baseBonus)*multiplier||r.totalXP!==r.coreXP+r.additionalXP||r.source!=='p.440 (user-confirmed)')throw new Error('The saved mission XP formula is invalid; review its source before restoring it.');
    const state=()=>({review:this.flags?.spycraft2?.missionXPReview,xp:this.system.xp,reward:this.system.missionXPRewards?.[key]??null}),expected=JSON.stringify(state());let input=options;
    if(input.confirmed===undefined){input=await systemDialog.input({window:{title:'Review interrupted mission XP'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${foundry.utils.escapeHTML(saved.reason)}</p><label>Mission reward <select name="retainSettlement"><option value="retain">Retain the recorded mission settlement</option><option value="cancel">Cancel this settlement</option></select></label><label>Confirmed total XP <input name="xp" type="number" min="0" step="1" value="${this.system.xp}" /></label><label>Resolution <input name="resolution" required /></label><label><input name="confirmed" type="checkbox" /> The GC reviewed actual XP, mission reward and any posted receipt</label><p>This sets the confirmed XP balance; it does not add the reward again.</p></div>`});if(!input)return null;input={...input,retainSettlement:input.retainSettlement==='retain'?true:input.retainSettlement==='cancel'?false:null};}
    return queueResources([this],async()=>{
      if(!game.user?.isGM)throw new Error('Only the GC may review an interrupted XP settlement.');
      if(JSON.stringify(state())!==expected)throw new Error('XP or the saved mission settlement changed. Review the current values.');
      const xp=typeof input.xp==='string'&&!input.xp.trim()?NaN:Number(input.xp);
      if(input.confirmed!==true||typeof input.retainSettlement!=='boolean'||!Number.isSafeInteger(xp)||xp<0||typeof input.resolution!=='string'||!input.resolution.trim())throw new Error('Confirm the whole XP balance, settlement disposition and resolution.');
      const current=this.system.missionXPRewards?.[key]??null;if(current!==null&&!same(current,tx.record))throw new Error('The mission reward changed; preserve it for review.');
      const completed={...saved,needsReview:false,retained:input.retainSettlement,xp,resolution:input.resolution.trim(),reviewedBy:game.user.id??'GC',resolvedAt:game.time?.worldTime??0},target=input.retainSettlement?tx.record:null;
      try{await this.update({'system.xp':xp,...this.actorRecordRestorePatch('system.missionXPRewards.'+key,target===null?undefined:target),...this.actorRecordRestorePatch('flags.spycraft2.missionXPReview',completed)});}
      catch(error){if(this.system.xp!==xp||!same(this.system.missionXPRewards?.[key]??null,target)||!same(this.flags?.spycraft2?.missionXPReview,completed))throw error;}
      return completed;
    });
  }

  get startingDiceEntry(){return startingDiceEntryPlan({...this.actionDiceFundingSystem,missionXPReview:this.flags?.spycraft2?.missionXPReview},this.flags?.spycraft2?.startingDiceCreation,{session:this.usagePeriods.session??'initial',resetReceipt:this.flags?.spycraft2?.sessionDiceReset});}

  initializeStartingDice(){
    if(this.type!=='agent'||!this.isOwner)return null;
    return queueResources([this],async()=>{
      if(!this.isOwner)throw new Error('Choose an owned character.');
      const plan=this.startingDiceEntry;if(plan.blocked)return ui.notifications.warn(plan.reason);
      const receiptId=foundry.utils.randomID(),record={...this.flags.spycraft2.startingDiceCreation,claimed:true,starting:plan.value,die:plan.die,receiptId,claimedAt:game.time?.worldTime??0};
      try{await this.update({'system.actionDice.value':plan.value,...this.actorRecordRestorePatch('flags.spycraft2.startingDiceCreation',record)});}
      catch(error){if(this.flags?.spycraft2?.startingDiceCreation?.receiptId!==receiptId)throw error;}
      return record;
    });
  }

  resetActionDice(){throw new Error('Starting action dice refresh when the GC starts a new session. Use the new-session control.');}
  recoverResourceTransaction(){return recoverResourceTransaction(this,{scope:[...(this.items??[])].some(i=>i.id===RULE_RESOURCE_LOCK_ID&&isResourceLock(i))?RULE_RESOURCE_LOCK_ID:undefined});}

  get usagePeriods() {
    const periods={...(globalThis.game?.settings?.get("spycraft2","usagePeriods")??{})};
    const combat=this.participatingCombat;
    if(this.system.twoWeaponStyle?.id)periods['two-weapon declaration']=this.system.twoWeaponStyle.id;
    if(this.system.dartingStyle?.id)periods['darting declaration']=this.system.dartingStyle.id;
    if(combat?.started)periods.combat=combat.id;
    if(combat)periods.round=`${combat.id}:${combat.round}`;
    return periods;
  }

  get limitedUseStatus() {
    const status=brightIdeaPoolStatus(this.system,this.usagePeriods);
    const mastery=improvisedMasterySpec(this.system,this.participatingCombat?.id);
    return [...(this.system.limitedUses??[]),...(mastery?[mastery]:[])].map(spec=>{const value=resourceStatus(spec,status.virtualUses,this.usagePeriods);if(spec.workflow==='brightIdea'&&status.sources.find(s=>s.id===spec.id)?.used===null)return {...value,remaining:0,counterReview:true};return spec.workflow==='brightIdea'&&status.needsReview?{...value,remaining:0,legacyReview:true}:value;});
  }

  counterReviewSpec(id){const mastery=improvisedMasterySpec(this.system,this.participatingCombat?.id);return id==='brightIdea'?brightIdeaLegacyReviewSpec(this.system,this.usagePeriods):this.system.limitedUses?.find(s=>s.id===id)??(mastery?.id===id?mastery:null);}

  async reviewLimitedUseCounter(id,options={}){
    if(!game.user?.isGM||!this.isOwner)throw new Error('Only an owning GC can correct a saved use counter.');
    const candidate=this.counterReviewSpec(id),spec=candidate?{...candidate}:null,before=JSON.stringify(this.system.resourceUses?.[id]),epoch=String(this.usagePeriods[spec?.period]??'initial');
    if(spec?.combatScoped&&!this.participatingCombat?.started)throw new Error('Start the character’s combat before reviewing its current combat or round allowance.');
    if(!spec||!spec.manualReviewable&&!resourceStatus(spec,this.system.resourceUses,this.usagePeriods).counterReview)return ui.notifications.warn('This saved counter does not need review.');
    if(!Number.isSafeInteger(spec.limit)||spec.limit<0)throw new Error('Correct this ability’s source/limit before reviewing its use count.');
    let input=options;
    if(!Object.hasOwn(input,'used')){
      const esc=foundry.utils.escapeHTML;
      input=await systemDialog.input({window:{title:`Review saved uses: ${spec.name}`},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${resourceStatus(spec,this.system.resourceUses,this.usagePeriods).counterReview?'This use history needs verification.':'Review the actual uses already resolved, including uses handled at the table or through other controls.'} Confirm the actual uses already spent in the current ${esc(spec.period)}. No unused allowance is assumed. Current source allowance: ${esc(spec.limitLabel??String(spec.limit))}.</p><details><summary>Saved record for review</summary><pre>${esc(JSON.stringify(this.system.resourceUses?.[id])??'missing')}</pre></details><label>Uses already spent <input name="used" type="number" min="0" step="1" required /></label><label>Reason / source of corrected history <input name="reason" required /></label><label><input name="confirmed" type="checkbox" /> This is the GC-confirmed count for the current period</label></div>`});
      if(!input)return null;
    }
    const used=typeof input.used==='number'?input.used:typeof input.used==='string'&&input.used.trim()?Number(input.used):NaN;
    return queueResources([this],async()=>{
      if(!game.user?.isGM||!this.isOwner)throw new Error('Only an owning GC can correct this counter.');
      const fresh=this.counterReviewSpec(id);
      if(fresh?.combatScoped&&!this.participatingCombat?.started)throw new Error('The combat ended during review; the saved history was retained.');
      if(!fresh||fresh.limit!==spec.limit||fresh.period!==spec.period||String(this.usagePeriods[fresh.period]??'initial')!==epoch||JSON.stringify(this.system.resourceUses?.[id])!==before)throw new Error('This source, period or counter changed during review. Review its current history again.');
      const plan=resourceCounterReviewPlan(fresh,this.system.resourceUses,this.usagePeriods,{used,reason:input.reason,confirmed:!!input.confirmed});
      await this.update({[`system.resourceUses.${id}`]:plan.record});
      try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),whisper:ChatMessage.getWhisperRecipients('GM').map(u=>u.id),content:`Saved-use review: ${foundry.utils.escapeHTML(fresh.name)}; ${used} already spent this ${foundry.utils.escapeHTML(fresh.period)}. ${foundry.utils.escapeHTML(plan.reason)}`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'resourceReview',resource:id,period:fresh.period,epoch,used,reason:plan.reason,previousUseRecord:plan.previous,reviewedBy:game.user.id,reviewedAt:Date.now(),actionDiceAllowed:false}}});}
      catch(error){try{await this.update(resourceCounterRestorePatch(id,plan.previous));}catch(restoreError){ui.notifications.warn('The corrected count may remain after a review-receipt failure. Inspect the current count before retrying.');return plan.record;}throw error;}
      return plan.record;
    });
  }

  async useManualLimitedAbility(id,options={}){
    if(!this.isOwner)return null;const spec=this.system.limitedUses?.find(s=>s.id===id&&s.workflow==='manual');if(!spec)throw new Error('Choose an available manual class ability.');let input=options;
    if(spec.cost>0&&!Object.keys(input).length){input=await systemDialog.input({window:{title:spec.name},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Use ${foundry.utils.escapeHTML(spec.name)}. Base cost ${spec.cost} action dice. Apply its stated actions, circumstances and effect at the table.</p>${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({unrolled:true})}</div>`});if(!input)return null;}
    return this.useLimitedAbility(id,async(status,payment)=>{const receiptId=foundry.utils.randomID(),funding=payment?{paymentId:payment.id??null,bonusPoolId:payment.bonusPoolId,count:payment.count,baseCost:spec.cost,surcharge:payment.surcharge??0,allocations:payment.allocations??null}:null;
      try{return await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:foundry.utils.escapeHTML(`${this.name} uses ${spec.name}.${payment?` Spent ${payment.count} action dice${payment.surcharge?` (${payment.surcharge} Shaken surcharge)`:''}.`:''} Apply the ability's stated actions and circumstances at the table.`),flags:{spycraft2:{actorUuid:this.uuid,checkKind:'manualAbility',actionDiceAllowed:false,abilityUseReceiptId:receiptId,resourceId:id,funding}}});}
      catch(error){const posted=[...(game.messages?.values?.()??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags.spycraft2.abilityUseReceiptId===receiptId);if(posted)return posted;throw error;}
    },{workflow:'manual',bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),...unrolledPaymentFundingInput(input)});
  }

  async useFeatFreeAction(source,options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!Object.hasOwn(FREE_ACTION_FEATS,source))throw new Error('Choose a supported free-action feat.');
    let input=options;const esc=foundry.utils.escapeHTML;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:FREE_ACTION_FEATS[source]},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${source==='quickDraw'?'Twice per round, take Draw Weapon, Holster Weapon, Pick Up Weapon or Reload as a free action. Each action retains its ordinary limits (one two-handed weapon or two one-handed weapons for Draw/Holster/Pick Up; normal Reload amount).'+(this.system.knifeBasics?.active?' Knife Basics already makes drawing a knife a free action: do not spend a Quick Draw use to draw a knife.':''):'Once per round, take one additional non-attack half action as a free action; session uses equal starting action dice.'}</p>${source==='quickDraw'?`<label>Action <select name="action">${Object.entries(QUICK_DRAW_ACTIONS).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('')}</select></label>`:'<input type="hidden" name="action" value="nonAttackHalfAction" /><label><input type="checkbox" name="nonAttackHalfActionConfirmed" /> This is one non-attack half action</label><label><input type="checkbox" name="purelyMentalConfirmed" /> GC confirms this is purely mental</label>'}<label>Action and weapon(s) / circumstances <textarea name="description" maxlength="1000" required></textarea></label><label><input type="checkbox" name="confirmed" /> GC confirms this action is otherwise legal now; resolve its checks, movement, gear and ammunition changes at the table</label></div>`});if(!input)return null;}
    const plan=()=>featFreeActionPlan(this.system,this.mentalLeapCombatContext(),{...input,source}),expected=plan();
    return this.useLimitedAbility(source,async()=>{
      const fresh=plan();if(JSON.stringify(fresh)!==JSON.stringify(expected))throw new Error('The free-action source, combat or declaration changed.');
      const receiptId=foundry.utils.randomID();
      try{return await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:esc(`${this.name}: ${fresh.source} — ${fresh.action} as a free action. ${fresh.description} Resolve the ordinary action and its remaining requirements at the table.`),flags:{spycraft2:{actorUuid:this.uuid,checkKind:'featFreeAction',actionDiceAllowed:false,abilityUseReceiptId:receiptId,resourceId:source,featFreeAction:fresh}}});}
      catch(error){const posted=[...(game.messages?.values?.()??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags.spycraft2.abilityUseReceiptId===receiptId);if(posted)return posted;throw error;}
    },{workflow:'featFreeAction',additionalUses:source==='surgeOfSpeed'?[{id:'surgeOfSpeedRound',workflow:'featFreeActionRound'}]:[]});
  }

  /** Queue resource costs with action-die boosts so rapid clicks cannot overspend locally. */
  useLimitedAbility(id,perform,{workflow="manual",additionalCost=0,additionalBenefitCount=additionalCost?1:0,additionalUses=[],messages=[],bonusPoolId='',surchargeBonusPoolId='same',surchargeAllocations,allocations}={}) {
    const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));
    const work=async()=>{
      if(!this.isOwner)throw new Error("You must own this actor.");
      const mastery=workflow==='improvisedSearch'?improvisedMasterySpec(this.system,this.participatingCombat?.id):null;
      const spec=this.system.limitedUses?.find(entry=>entry.id===id)??(mastery?.id===id?mastery:null);
      if(!spec||spec.workflow!==workflow)throw new Error("Use this ability through its appropriate roll control.");
      if(!Number.isSafeInteger(additionalCost)||additionalCost<0||!Number.isSafeInteger(additionalBenefitCount)||additionalBenefitCount<0||additionalBenefitCount>additionalCost||additionalCost>0&&additionalBenefitCount===0)throw new Error("Invalid additional action-die cost or benefit count.");
      if(workflow==='brightIdea'){
        const source=brightIdeaPoolStatus(this.system,this.usagePeriods).sources.find(s=>s.id===id);
        if(!source||source.used===null)throw new Error('Review this Bright Idea source and its saved use count before rolling.');
        const migration=brightIdeaMigrationPlan(this.system,this.usagePeriods,undefined,{at:Date.now(),reviewedBy:'single-source automatic migration'});
        if(migration)await this.update(migration.updates);
      }
      if(!Array.isArray(additionalUses)||new Set([id,...additionalUses.map(s=>s.id)]).size!==additionalUses.length+1)throw new Error('Choose distinct additional ability sources.');
      const specs=[{...spec,cost:spec.cost+additionalCost},...additionalUses.map(request=>{
        const extra=this.system.limitedUses?.find(s=>s.id===request.id);
        if(!extra||extra.workflow!==request.workflow||extra.workflow==='brightIdea')throw new Error('An additional ability no longer qualifies for this check.');
        return extra;
      })];
      if(FINAL_ATTACK_WORKFLOWS.has(workflow)){const shared=this.system.limitedUses.find(s=>s.id==='finalAttackRound');if(!shared||shared.workflow!=='finalAttackRound')throw new Error('The shared final-attack counter is unavailable. Reload before attacking.');if(specs.some(s=>s.id===shared.id))throw new Error('Do not select the shared final-attack counter as an additional source.');specs.push({...shared});}
      if(specs.some(s=>!Number.isSafeInteger(s.cost)||s.cost<0))throw new Error('Invalid action-die cost for an ability source.');
      const benefitCount=Number(spec.cost>0)+specs.slice(1).filter(s=>s.cost>0).length+additionalBenefitCount;
      const cost=specs.reduce((n,s)=>n+s.cost,0);if(!Number.isSafeInteger(cost)||cost<0)throw new Error('Invalid combined ability cost.');
      if(allocations!==undefined&&workflow==='eagleEye')throw new Error('Eagle Eye must retain one selected benefit die source; split only its surcharge.');
      if(allocations!==undefined||cost&&(shakenRules(this.actionDiceFundingSystem).extraDice||shakenRules(this.actionDiceFundingSystem).needsReview)){try{actionDieBenefitQuote(this,{baseCost:cost,benefitCount,bonusPoolId,surchargeBonusPoolId,surchargeAllocations,allocations});}catch(error){return ui.notifications.warn(error.message);}}
      const split=Array.isArray(allocations)&&allocations.length>0;
      const funding=split?{blocked:false,balance:cost}:cost?actionDiceFundingContext(this.actionDiceFundingSystem,{bonusPoolId,periods:this.usagePeriods}):{blocked:false,balance:0};if(funding.blocked)return ui.notifications.warn(funding.reason);
      const plans=specs.map(s=>resourceUsePlan(s,this.system.resourceUses,this.usagePeriods,funding.balance));
      const blocked=plans.find(p=>p.blocked);if(blocked)return ui.notifications.warn(blocked.reason);
      if(cost>funding.balance)return ui.notifications.warn('Not enough action dice remain for these abilities.');
      const before=specs.map(s=>structuredClone(this.system.resourceUses?.[s.id])),settlementBefore=JSON.stringify(getActionDieSettlementReview(this));
      let callbackStarted=false;
      const refundUses=async()=>{
        const refund={};
        for(const [i,s] of specs.entries()){
          const current=this.system.resourceUses?.[s.id],record=plans[i].record;
          if(current?.epoch===record.epoch){
            if(current.used===record.used){
              if(before[i]===undefined)refund[`system.resourceUses.-=${s.id}`]=null;
              else refund[`system.resourceUses.${s.id}`]=before[i];
            }else if(current.used>record.used)refund[`system.resourceUses.${s.id}.used`]=current.used-1;
          }
        }
        if(Object.keys(refund).length)await this.update(refund);
      };
      try{
        await this.update(Object.fromEntries(specs.map((s,i)=>[`system.resourceUses.${s.id}`,plans[i].record])));
        const run=async payment=>{callbackStarted=true;const sharedIndex=specs.findIndex(s=>s.id==='finalAttackRound'),reservation=sharedIndex<0?null:{record:structuredClone(plans[sharedIndex].record),nauseated:specs[sharedIndex].limit===1};const result=await withFinalRoundReservation(this,reservation,()=>perform?.(plans[0].status,payment));if(result===null)throw new LimitedUseCancelled('The ability was cancelled before completion.');return result??plans[0].status;};
        const result=cost?await this.payActionDiceBenefitLocked(cost,run,{benefitCount,bonusPoolId,surchargeBonusPoolId,surchargeAllocations,allocations,expectedShaken,message:messages[0]??null,purpose:('Class use: '+specs.map(s=>s.name??s.id).join(' + ')+(additionalCost?'; additional action-die benefits':'')).slice(0,500),benefit:'classAbility',details:{abilities:specs.map(s=>s.id),additionalCost,additionalBenefitCount,limitedUseSettlement:specs.map((s,i)=>({id:s.id,before:before[i]??null,reserved:plans[i].record}))}}):await run(null);
        if(!callbackStarted)await refundUses();
        return result;
      }catch(error){
        if(getActionDieSettlementReview(this).needsReview&&(cost>0||JSON.stringify(getActionDieSettlementReview(this))!==settlementBefore)){
          const review={...getActionDieSettlementReview(this),limitedUseSettlement:specs.map((spec,i)=>({id:spec.id,before:before[i]??null,reserved:plans[i].record}))};
          setPendingActionDieReview(this,review);try{await this.update(this.actorRecordRestorePatch('flags.spycraft2.actionDiceSettlementReview',review));}catch{ui.notifications.warn('The payment and limited-use counters remain reserved; include both in GC review.');}
          throw error;
        }
        try{await refundUses();}catch(rollback){throw new AggregateError([error,rollback],'The limited-use count needs GC review before retrying.');}
        if(error instanceof LimitedUseCancelled)return null;
        throw error;
      }
    };
    return queueResources([this],work,{messages});
  }

  async configureFortuneTeammates(options={}){
    if(this.type!=="agent"||!this.isOwner)return null;
    const candidates=[...(game.actors??[])].filter(actor=>actor.id!==this.id&&pointmanLevel(actor)>=10);
    let input=options;
    if(!input.ids){
      const esc=foundry.utils.escapeHTML;
      input=await systemDialog.input({window:{title:'Improved Fortune teammates'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Choose actual Pointman teammates. Their Improved Fortune combines with your own, up to +3 starting action dice. Current dice are not refilled by changing this list.</p>${candidates.map(actor=>`<label><input type="checkbox" name="ally_${actor.id}" ${this.system.fortuneTeammateIds?.includes(actor.id)?'checked':''} /> ${esc(actor.name)} (Pointman ${pointmanLevel(actor)})</label>`).join('')}<label><input type="checkbox" name="teammatesConfirmed" /> These characters are teammates who provide Improved Fortune</label></div>`});
      if(!input)return null;input.ids=candidates.filter(actor=>input[`ally_${actor.id}`]).map(actor=>actor.id);
    }
    if(!Array.isArray(input.ids)||input.ids.some(id=>!candidates.some(actor=>actor.id===id))||input.ids.length&&!input.teammatesConfirmed)return ui.notifications.warn('Choose actual qualifying teammates and confirm their team membership.');
    return this.update({'system.fortuneTeammateIds':[...new Set(input.ids)]});
  }

  async useEagleEye(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    let input=options;const expectedShaken=JSON.stringify(shakenRules(this.actionDiceFundingSystem));
    if(!Object.keys(input).length&&(shakenRules(this.actionDiceFundingSystem).extraDice||unrestrictedBonusPools(this.actionDiceFundingSystem,this.usagePeriods).some(p=>p.available))){input=await systemDialog.input({window:{title:'Eagle Eye'},rejectClose:false,content:'<div class="spycraft2-roll-options">'+this.actionDiceFundingControl()+this.actionDiceSurchargeControl()+'<p>Roll one selected action die. Its result ×10 adds to the range increment of your two-handed firearms and hurled weapons for this scene.</p></div>'});if(!input)return null;}
    return this.useLimitedAbility('eagleEye',async(status,payment)=>{
      const scene=String(this.usagePeriods.scene??'initial'),guard=()=>{if(JSON.stringify(shakenRules(this.actionDiceFundingSystem))!==expectedShaken)throw new Error('The Shaken condition changed while resolving Eagle Eye.');const blocked=attributeActionBlock(this.system,{kind:'mentalAbility'});if(blocked)throw new Error(blocked);if(!this.system.coreClassIds?.includes('sniper')||String(this.usagePeriods.scene??'initial')!==scene||status.epoch!==scene)throw new Error('Eagle Eye source or scene changed.');};guard();
      const plan=eagleEyeDiePlan({...this.system,actionDice:payment.system.actionDice}),before=structuredClone(this.system.eagleEyeBoost??null),roll=await new Roll(plan.formula).evaluate();guard();
      const actionDiceReceiptId=globalThis.foundry?.utils?.randomID?.()??('eagleEye-'+(this._eagleEyeReceiptSequence=(this._eagleEyeReceiptSequence??0)+1)),record={...eagleEyeRecord(this.system,plan,roll,{scene}),actionDiceReceiptId,funding:{bonusPoolId:payment.bonusPoolId,die:payment.die,count:1,...(payment.surcharge?{paymentId:payment.id,surcharge:payment.surcharge,totalCost:payment.cost,allocations:payment.allocations}:{})}};
      const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),current=()=>this.system.eagleEyeBoost??null;
      let wrote=false;
      try{
        await this.update(this.actorRecordRestorePatch('system.eagleEyeBoost',record));wrote=true;guard();
        await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:this}),flavor:`Eagle Eye: spent ${payment.count} action dice${payment.surcharge?` (one benefit die + ${payment.surcharge} Shaken surcharge)`:''}; result ${record.result}. Range increment +${record.rangeIncrease} ft. with any 2-handed firearm or hurled weapon for this scene (p.80).`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'eagleEye',...record,eagleEyeReceiptId:actionDiceReceiptId,actionDiceAllowed:false}}});return record;
      }catch(error){
        if([...(game.messages??[])].some(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.eagleEyeReceiptId===actionDiceReceiptId)&&(wrote||current()?.actionDiceReceiptId===actionDiceReceiptId))return record;
        if(!wrote&&current()?.actionDiceReceiptId!==actionDiceReceiptId&&same(current(),before))throw error;
        if(same(current(),record)){
          try{await this.update(this.actorRecordRestorePatch('system.eagleEyeBoost',before));}catch(rollback){if(!same(current(),before)){const failure=new AggregateError([error,rollback],'Eagle Eye could not be safely restored.');failure.actionDiceSettlementReview={purpose:'Eagle Eye',beforeBoost:before,targetBoost:record,observedBoost:current()};throw failure;}}
          throw error;
        }
        error.actionDiceSettlementReview={purpose:'Eagle Eye',beforeBoost:before,targetBoost:record,observedBoost:current()};throw error;
      }
    },{workflow:'eagleEye',bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input)});
  }

  async useIntelTemporaryFeats(ability,options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const source=intelTemporaryFeatSource(this.system,ability);if(!source)return ui.notifications.warn('This Intel-phase feat grant has not been earned.');
    const pack=game.packs?.get('spycraft2.feats');if(!pack)throw new Error('The system feat compendium is unavailable.');
    let input=options;
    if(!input.featIds){
      const index=await pack.getIndex({fields:['system.tree']}),esc=foundry.utils.escapeHTML;
      const choices=index.filter(i=>i.type==='feat'&&i.system.tree===source.tree).sort((a,b)=>a.name.localeCompare(b.name));
      const proficiencies=Object.entries(CONFIG.SPYCRAFT.proficiencies).filter(([key])=>key!=='unarmed').map(([key,row])=>`<option value="${esc(key)}">${esc(row.label)}</option>`).join('');
      input=await systemDialog.input({window:{title:source.name},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Choose ${source.count} temporary ${esc(CONFIG.SPYCRAFT.featTrees[source.tree]??source.tree)} feat(s) in acquisition order, until this mission ends. All prerequisites apply. A prior temporary selection can qualify a later temporary selection; it cannot qualify permanent feats or expert classes.</p>${Array.from({length:source.count},(_,i)=>`<label>Feat ${i+1} <select name="feat${i}"><option value="">Choose a feat</option>${choices.map(f=>`<option value="${esc(f._id)}">${esc(f.name)}</option>`).join('')}</select></label>${source.tree==='basicCombat'?`<label>Choice for selection ${i+1}: Weapon Focus proficiency or Armor Basics/Mastery type <select name="choice${i}"><option value="">Choose only if required by this feat</option><optgroup label="Armor type"><option value="P">Partial</option><option value="M">Moderate</option><option value="F">Full</option></optgroup><optgroup label="Weapon Focus proficiency">${proficiencies}</optgroup></select></label>`:''}`).join('')}<label><input name="intelPhaseConfirmed" type="checkbox" /> I choose these during the current mission’s Intel Phase</label></div>`});
      if(!input)return null;input={...input,featIds:Array.from({length:source.count},(_,i)=>input[`feat${i}`]),featChoices:Array.from({length:source.count},(_,i)=>input[`choice${i}`]??'')};
    }
    if(input.intelPhaseConfirmed!==true)return ui.notifications.warn('Confirm the current mission’s Intel Phase.');
    return this.useLimitedAbility(ability,async()=>{
      const fresh=intelTemporaryFeatSource(this.system,ability);if(!fresh)throw new Error('This temporary-feat source changed.');
      if(!Array.isArray(input.featIds)||input.featIds.length!==fresh.count)throw new Error(`Choose exactly ${fresh.count} feat(s).`);
      const feats=[];for(const id of input.featIds)feats.push(await pack.getDocument(id));
      const epoch=String(this.usagePeriods.mission??'initial'),data=intelTemporaryFeatPlan(this.system,[...this.items],ability,feats,{cfg:CONFIG.SPYCRAFT,epoch,sourceActorUuid:this.uuid,intelPhaseConfirmed:input.intelPhaseConfirmed,featChoices:input.featChoices??[]}),created=[];
      const guard=()=>{const current=intelTemporaryFeatSource(this.system,ability);if(!this.isOwner||!current||current.count!==fresh.count||String(this.usagePeriods.mission??'initial')!==epoch)throw new Error('This temporary-feat source or mission changed.');};
      try{
        for(const entry of data){
          guard();
          const eligible=this.checkPrerequisites(entry.system.prerequisites,{temporary:true});if(!eligible.ok)throw new Error(`Temporary feat prerequisites not met: ${eligible.unmet.join('; ')}.`);
          const candidate={...entry,id:'__intelCandidate__'},items=[...this.items,candidate],active=new Set(items.filter(i=>i===candidate||this.system.featStatus?.[i.id]?.ok).map(i=>i.id)),choice=resolveFeatChoices(candidate,this.system,items,CONFIG.SPYCRAFT,active);
          if(choice.pending.length||choice.warnings.length)throw new Error([...choice.pending,...choice.warnings].join('; '));
          const [item]=await this.createEmbeddedDocuments('Item',[entry]);if(!item)throw new Error('Temporary feat creation failed.');created.push(item);
        }
        guard();
        await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`${fresh.name}: gained ${created.map(i=>foundry.utils.escapeHTML(i.name)).join(', ')} during Intel, until the end of this mission. One mission use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'temporaryFeat',ability,mission:epoch,featUuids:created.map(i=>i.uuid),actionDiceAllowed:false}}});return created;
      }catch(error){
        if(created.length)try{await this.deleteEmbeddedDocuments('Item',created.map(i=>i.id));}catch(cleanupError){ui.notifications.warn('Some temporary feats may remain after cleanup failed. The mission use remains spent; review the granted feats before retrying.');return created;}
        throw error;
      }
    },{workflow:'intelTemporaryFeat'});
  }

  /** Choices stay on the temporary feat so expiry removes the focus/forte itself. */
  async chooseTemporaryFocuses(options={}){
    if(this.type!=="agent"||!this.isOwner)return null;
    const feat=this.items.get(options.featId);if(!feat||feat.name!=="Depth of Study"||feat.system.featKind!=="temporary"||!this.system.featStatus?.[feat.id]?.ok)return ui.notifications.warn("Choose an active temporary Depth of Study feat.");
    const epoch=String(this.usagePeriods.mission??'initial'),esc=foundry.utils.escapeHTML;let choices=options.choices;
    if(choices===undefined){
      const groups=['cultures','drive','profession','science'],existing=feat.system.focusChoices??[];
      const selected=(a,b)=>a===b?' selected':'';
      const input=await systemDialog.input({window:{title:'Temporary Depth of Study choices'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Choose two focuses or fortes in order. A forte must name a subdivision of a focus already possessed, including an earlier choice. Profession names and forte subdivisions require the GC’s ordinary approval. These choices expire with this feat.</p>${[0,1].map(i=>{const row=existing[i]??{};return `<fieldset><legend>Choice ${i+1}</legend><label>Type <select name="kind${i}"><option value="focus"${selected(row.kind,'focus')}>Focus</option><option value="forte"${selected(row.kind,'forte')}>Forte</option></select></label><label>Skill <select name="skill${i}">${groups.map(key=>`<option value="${key}"${selected(row.skill,key)}>${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`).join('')}</select></label><label>Focus <input name="focus${i}" type="text" list="temporary-focus-names" value="${esc(row.focus??'')}" /></label><label>Forte subdivision (forte only) <input name="forte${i}" type="text" value="${esc(row.forte??'')}" /></label></fieldset>`;}).join('')}<datalist id="temporary-focus-names">${Object.values(CONFIG.SPYCRAFT.focuses).flat().map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist></div>`});
      if(!input)return null;choices=[0,1].map(i=>({kind:input[`kind${i}`],skill:input[`skill${i}`],focus:input[`focus${i}`],forte:input[`forte${i}`]}));
    }
    return queueResources([this],async()=>{
      const guard=()=>{if(!this.isOwner||!this.items.get(feat.id)||!this.system.featStatus?.[feat.id]?.ok||String(this.usagePeriods.mission??'initial')!==epoch)throw new Error('The temporary focus source or mission changed.');};guard();
      const system=this.system.toObject?.()??foundry.utils.deepClone(this.system);system.usagePeriods=this.usagePeriods;Object.assign(system,this.attributeRuleContext);
      const items=this.items.map(i=>({id:i.id,name:i.name,type:i.type,system:{...(i.system.toObject?.()??foundry.utils.deepClone(i.system)),...(i.id===feat.id?{focusChoices:[]}:{} )}}));
      computeAgent(system,items,CONFIG.SPYCRAFT);
      const current=this.items.get(feat.id),next=temporaryFocusPlan(system,items.find(i=>i.id===feat.id),choices,CONFIG.SPYCRAFT),previous=foundry.utils.deepClone(current.system.focusChoices??[]);
      try{await current.update({'system.focusChoices':next});guard();await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Temporary Depth of Study: ${next.map(row=>esc(`${CONFIG.SPYCRAFT.skills[row.skill].name}: ${row.focus}${row.forte?' / '+row.forte:''}`)).join('; ')}. Choices expire with their source feat.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'temporaryFocus',sourceFeatUuid:feat.uuid,mission:epoch,actionDiceAllowed:false}}});guard();return next;}
      catch(error){const remaining=this.items.get(feat.id);if(remaining)await remaining.update({'system.focusChoices':previous});throw error;}
    });
  }

  async useKnowItAll(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!knowItAllSource(this.system))return ui.notifications.warn('Know It All has not been earned.');
    const pack=game.packs?.get('spycraft2.feats');if(!pack)throw new Error('The system feat compendium is unavailable.');
    let input=options;const interactive=!input.featIds,esc=foundry.utils.escapeHTML;
    if(interactive){const index=await pack.getIndex({fields:['system.tree']}),feats=index.filter(f=>f.type==='feat'&&f.system.tree==='advancedSkill').sort((a,b)=>a.name.localeCompare(b.name));input=await systemDialog.input({window:{title:'Know It All'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Gain two temporary Advanced Skill feats in acquisition order until this mission ends. All prerequisites apply; level-one-only feats remain unavailable at Scientist 10+. Repeatable self-grants follow each feat’s own restrictions.</p>${[0,1].map(i=>`<label>Feat ${i+1} <select name="feat${i}"><option value="">Choose a feat</option>${feats.map(f=>`<option value="${esc(f._id)}">${esc(f.name)}</option>`).join('')}</select></label>`).join('')}<label><input name="freeActionConfirmed" type="checkbox" /> I spend the required free action (during my initiative if in combat)</label></div>`});if(!input)return null;input={...input,featIds:[input.feat0,input.feat1]};}
    if(input.freeActionConfirmed!==true)return ui.notifications.warn('Confirm the required free action.');
    if(!Array.isArray(input.featIds)||input.featIds.length!==2||input.featIds.some(id=>typeof id!=='string'||!id))return ui.notifications.warn('Choose exactly two Advanced Skill feats.');
    if(interactive){const selected=[];for(const id of input.featIds)selected.push(await pack.getDocument(id));if(selected.some(f=>!f||f.type!=='feat'||f.system.tree!=='advancedSkill'))throw new Error('Choose Advanced Skill feats.');const descriptors=selected.map(f=>knowItAllChoiceOptions(this.system,f,CONFIG.SPYCRAFT));if(descriptors.some(d=>d.kind!=='none')){const fields=descriptors.map((d,i)=>`<fieldset><legend>${esc(selected[i].name)}</legend>${d.kind==='training'?`<p>Allocate five rank points; one rank per point, subject to current limits. Unspent points require I Can Swim, possessed now or as an earlier selection.</p><div class="form-fields-grid">${Object.entries(CONFIG.SPYCRAFT.skills).map(([key,s])=>`<label>${esc(s.name)} <input name="training${i}_${esc(key)}" type="number" min="0" max="5" step="1" value="0" /></label>`).join('')}</div>`:['basicSkill','skill'].includes(d.kind)?`<label>Choice <select name="choice${i}"><option value="">Choose a target</option>${Object.entries(d.options).map(([key,label])=>`<option value="${esc(key)}">${esc(label)}</option>`).join('')}</select></label>`:'<p>No additional choice.</p>'}</fieldset>`).join('');const detail=await systemDialog.input({window:{title:'Know It All choices'},rejectClose:false,content:`<div class="spycraft2-roll-options">${fields}</div>`});if(!detail)return null;input={...input,featChoices:[detail.choice0??'',detail.choice1??''],trainingSkills:[0,1].map(i=>Object.fromEntries(Object.keys(CONFIG.SPYCRAFT.skills).map(key=>[key,Number(detail[`training${i}_${key}`]??0)])))};}}
    return this.useLimitedAbility('knowItAll',async()=>{
      const epoch=String(this.usagePeriods.mission??'initial'),guard=(checkTurn=true)=>{const source=knowItAllSource(this.system),combat=this.participatingCombat;if(!this.isOwner||!source||(this.system.resourceUses?.knowItAll?.used??0)>source.limit||String(this.usagePeriods.mission??'initial')!==epoch)throw new Error('Know It All source or mission changed.');if(checkTurn&&combat?.started&&combat.combatant?.actor?.uuid!==this.uuid)throw new Error('Take this free action during this character’s initiative.');};
      guard();const feats=[];for(const id of input.featIds)feats.push(await pack.getDocument(id));const data=knowItAllPlan(this.system,[...this.items],feats,{cfg:CONFIG.SPYCRAFT,epoch,sourceActorUuid:this.uuid,featChoices:input.featChoices??[],trainingSkills:input.trainingSkills??[]}),created=[];
      try{for(const entry of data){guard();const eligible=this.checkPrerequisites(entry.system.prerequisites,{temporary:true});if(!eligible.ok)throw new Error(`Temporary feat prerequisites not met: ${eligible.unmet.join('; ')}.`);const candidate={...entry,id:'__knowItAllCandidate__'},items=[...this.items,candidate],active=new Set(items.filter(i=>i===candidate||this.system.featStatus?.[i.id]?.ok).map(i=>i.id)),choice=resolveFeatChoices(candidate,this.system,items,CONFIG.SPYCRAFT,active);if(choice.pending.length||choice.warnings.length)throw new Error([...choice.pending,...choice.warnings].join('; '));if(entry.name==='Training'&&Object.values(entry.system.trainingSkills??{}).reduce((n,v)=>n+v,0)<5&&!this.system.activeFeatNames?.includes('I Can Swim'))throw new Error('Unspent Training points require I Can Swim.');for(const [key,points]of Object.entries(entry.system.trainingSkills??{})){const skill=this.system.skillTotals?.[key];if(!skill||!Number.isFinite(skill.maxRanks)||skill.ranks+points>skill.maxRanks)throw new Error(`Training exceeds the current rank limit for ${key}.`);}const [item]=await this.createEmbeddedDocuments('Item',[entry]);if(!item)throw new Error('Temporary feat creation failed.');created.push(item);}
        guard(false);await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Know It All: free action; gained ${created.map(i=>esc(i.name)).join(', ')} until the end of this mission. One mission use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'temporaryFeat',ability:'knowItAll',mission:epoch,featUuids:created.map(i=>i.uuid),actionDiceAllowed:false}}});return created;
      }catch(error){if(created.length)try{await this.deleteEmbeddedDocuments('Item',created.map(i=>i.id));}catch(cleanupError){ui.notifications.warn('Some Know It All feats may remain after cleanup failed. The mission use remains spent; review the granted feats before retrying.');return created;}throw error;}
    },{workflow:'selfAdvancedFeats'});
  }

  async useAnyTimeAnyPlace(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!anyTimeAnyPlaceSource(this.system))return ui.notifications.warn('Any Time, Any Place has not been earned.');
    const pack=game.packs?.get('spycraft2.feats');if(!pack)throw new Error('The system feat compendium is unavailable.');
    let input=options;
    if(!input.featId){const index=await pack.getIndex({fields:['system.tree']}),esc=foundry.utils.escapeHTML,feats=index.filter(i=>i.type==='feat'&&i.system.tree==='terrain').sort((a,b)=>a.name.localeCompare(b.name));input=await systemDialog.input({window:{title:'Any Time, Any Place'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Gain one temporary Terrain feat until this mission ends. All prerequisites apply. One use is earned at Guide 4 and another at Guide 8.</p><label>Feat <select name="featId">${feats.map(f=>`<option value="${esc(f._id)}">${esc(f.name)}</option>`).join('')}</select></label><label><input name="freeActionConfirmed" type="checkbox" /> I spend the required free action (during my initiative if in combat)</label></div>`});if(!input)return null;}
    if(input.freeActionConfirmed!==true)return ui.notifications.warn('Confirm the required free action.');
    return this.useLimitedAbility('anyTimeAnyPlace',async()=>{
      const epoch=String(this.usagePeriods.mission??'initial');
      const guard=(checkTurn=true)=>{const source=anyTimeAnyPlaceSource(this.system),used=this.system.resourceUses?.anyTimeAnyPlace?.used??0,combat=this.participatingCombat;if(!this.isOwner||!source||used>source.limit||String(this.usagePeriods.mission??'initial')!==epoch)throw new Error('The Terrain-feat source or mission changed.');if(checkTurn&&combat?.started&&combat.combatant?.actor?.uuid!==this.uuid)throw new Error('Take this free action during this character’s initiative.');};
      guard();const feat=await pack.getDocument(input.featId);guard();const data=anyTimeAnyPlacePlan(this.system,[...this.items],feat,{epoch,sourceActorUuid:this.uuid}),eligible=this.checkPrerequisites(data.system.prerequisites,{temporary:true});if(!eligible.ok)throw new Error(`Temporary Terrain feat prerequisites not met: ${eligible.unmet.join('; ')}.`);
      let created;try{[created]=await this.createEmbeddedDocuments('Item',[data]);if(!created)throw new Error('Temporary Terrain feat creation failed.');guard(false);await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Any Time, Any Place: free action; gained ${foundry.utils.escapeHTML(created.name)} until the end of this mission. One mission use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'temporaryFeat',ability:'anyTimeAnyPlace',mission:epoch,featUuid:created.uuid,actionDiceAllowed:false}}});return created;}
      catch(error){if(created)try{await this.deleteEmbeddedDocuments('Item',[created.id]);}catch(cleanupError){ui.notifications.warn('The temporary Terrain feat remains after cleanup failed. Its mission use remains spent; review the existing feat before retrying.');return created;}throw error;}
    },{workflow:'selfTerrainFeat'});
  }

  get attributeRuleContext(){return {worldTime:globalThis.game?.time?.worldTime??this.system.worldTime,mentalLeapCombats:this.system.mentalLeapCombats??{},conditionContext:this.system.conditionContext??{},mentalLeapState:this.system.mentalLeapState};}

  mentalLeapCombatContext(combat=this.participatingCombat){
    if(!combat)return null;const own=combat.turns?.find(c=>c.actor?.uuid===this.uuid);return {id:combat.id,started:combat.started,round:combat.round,turn:combat.turn,combatantId:own?.id,ownTurnIndex:combat.turns?.findIndex(c=>c.id===own?.id)??-1};
  }

  async activateMentalLeap(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!mentalLeapSource(this.system))return ui.notifications.warn('Mental Leap has not been earned.');
    let input=options;
    if(!input.ability){input=await systemDialog.input({window:{title:'Mental Leap'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Add your current starting action-die count (${this.system.actionDice.max}) to one attribute for ten rounds. When it ends, exhaustion lasts twice the active rounds. Ending during the activation initiative counts as one round and two exhausted rounds. Existing unnamed Mental Leap bonuses may overlap; repeated exhaustion causes unconsciousness.</p><label>Attribute <select name="ability"><option value="dex">Dexterity</option><option value="int">Intelligence</option><option value="wis">Wisdom</option></select></label><label><input name="confirmed" type="checkbox" /> I activate Mental Leap now (during my initiative if in combat)</label></div>`});if(!input)return null;}
    if(input.confirmed!==true)return ui.notifications.warn('Confirm Mental Leap activation.');
    return this.useLimitedAbility('mentalLeap',async()=>{
      const incapacity=attributeActionBlock(this.system,{kind:'mentalAbility'});if(incapacity)throw new Error(`This character cannot currently activate Mental Leap: ${incapacity}`);
      const session=String(this.usagePeriods.session??'initial'),before=foundry.utils.deepClone(this.system.mentalLeaps??[]),source=mentalLeapSource(this.system),record=mentalLeapRecord({...this.system,...this.attributeRuleContext},{id:foundry.utils.randomID(),ability:input.ability,combat:this.mentalLeapCombatContext()});
      const guard=()=>{const now=mentalLeapSource(this.system);if(!this.isOwner||!now||(this.system.resourceUses?.mentalLeap?.used??0)>now.limit||String(this.usagePeriods.session??'initial')!==session)throw new Error('Mental Leap source, allowance or session changed.');};guard();
      try{await this.update({'system.mentalLeaps':[...before,record]});guard();await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Mental Leap: +${record.bonus} ${record.ability.toUpperCase()} for ten rounds, followed by twenty rounds exhausted unless ended earlier. One session use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'mentalLeap',recordId:record.id,session,ability:record.ability,bonus:record.bonus,actionDiceAllowed:false}}});guard();return record;}
      catch(error){try{await this.update({'system.mentalLeaps':before});}catch(rollbackError){ui.notifications.warn('Mental Leap may remain after rollback failed. Its use remains spent; review the effect before trying again.');return record;}throw error;}
    },{workflow:'mentalLeap'});
  }

  async endMentalLeap(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    let input=options;const active=(this.system.mentalLeapState?.rows??[]).filter(r=>r.phase==='boost'),esc=foundry.utils.escapeHTML;
    if(!active.length)return ui.notifications.warn('No Mental Leap is currently active.');
    if(input.freeActionConfirmed===undefined){input=await systemDialog.input({window:{title:'End Mental Leap'},rejectClose:false,content:`<div class="spycraft2-roll-options"><label>Active benefit <select name="id">${active.map(r=>`<option value="${esc(r.id)}" ${r.id===options.id?'selected':''}>${r.ability.toUpperCase()} +${r.bonus}; ${Math.ceil(r.remainingSeconds/6)} round(s) remain</option>`).join('')}</select></label><label><input name="freeActionConfirmed" type="checkbox" /> I end this effect as a free action during my initiative (if in combat)</label><p>At least one active round counts, even if you end it during its activation initiative. Exhaustion follows immediately for twice the active rounds.</p></div>`});if(!input)return null;}
    return queueResources([this],async()=>{
      const incapacity=restraintActionBlock(this.system,{free:true})||attributeActionBlock(this.system,{kind:'mentalAbility'});if(incapacity)throw new Error(incapacity);
      const before=foundry.utils.deepClone(this.system.mentalLeaps??[]),index=before.findIndex(r=>r.id===input.id);if(index<0)throw new Error('This Mental Leap record is unavailable.');
      const ended=endMentalLeapPlan({...this.system,...this.attributeRuleContext},before[index],{...input,combat:this.mentalLeapCombatContext()}),next=[...before];next[index]=ended;
      try{await this.update({'system.mentalLeaps':next});await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Mental Leap ended as a free action after ${ended.ended.rounds} active round(s). Exhausted for ${2*ended.ended.rounds} rounds; the session use stays spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'mentalLeapEnd',recordId:ended.id,activeRounds:ended.ended.rounds,exhaustionRounds:2*ended.ended.rounds,actionDiceAllowed:false}}});return ended;}
      catch(error){await this.update({'system.mentalLeaps':before});throw error;}
    });
  }

  async detachMentalLeapCombat(combat){
    if(this.type!=='agent'||!this.isOwner||!(this.system.mentalLeaps??[]).some(r=>r.combatId===combat.id&&!r.detached))return null;
    return queueResources([this],async()=>{const current=foundry.utils.deepClone(this.system.mentalLeaps??[]),context=this.mentalLeapCombatContext(combat),next=current.map(r=>detachMentalLeapPlan({...this.system,...this.attributeRuleContext},r,context));await this.update({'system.mentalLeaps':next});return next;});
  }

  async recordAdrenalineWoundLoss(options={}){
    if(this.type!=='agent'||!this.isOwner||!game.user?.isGM)throw new Error('The GC records an owned Stuntman’s final wound-loss event.');
    const state=()=>JSON.stringify({wounds:this.system.wounds.value,level:this.system.level,source:adrenalineSource(this.system),bold:this.system.activeFeatNames?.includes('Fortune Favors the Bold')===true,periods:this.usagePeriods,counter:this.system.resourceUses?.adrenalineJunkie??null}),expected=state();
    if(!adrenalineSource(this.system))throw new Error('This character does not have the Adrenaline Junkie core ability.');let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Adrenaline Junkie — record wound loss'},rejectClose:false,content:'<p>Record one event after the GC resolves defenses and determines final wound loss. This subtracts that wound loss and grants at most one bonus die for an eligible event, within the session limit. It does not resolve damage defenses, critical injuries or death.</p><label>Unique attack/fall/damage-event reference <input name="eventRef" required /></label><label>Final wound loss <input type="number" min="1" step="1" name="loss" value="1" /></label><label>Cause <select name="cause"><option value="attack">Attack</option><option value="fall">Falling damage</option><option value="explosion">Explosive damage</option><option value="other">Other wound loss</option></select></label><label><input type="checkbox" name="opponentAttack" /> Attack: made by an opponent</label><label><input type="checkbox" name="confirmed" /> The GC confirms this single event and final wound loss have not already been applied</label>'});if(!input)return null;input={...input,loss:typeof input.loss==='number'?input.loss:typeof input.loss==='string'&&input.loss.trim()?Number(input.loss):NaN,opponentAttack:input.opponentAttack===true};}
    const key=woundEventKey(input.eventRef);
    return queueResources([this],async()=>{
      if(!game.user?.isGM)throw new Error('Only the GC may record this wound loss.');
      if(input.confirmed!==true)throw new Error('Confirm the actual wound-loss event.');
      const existing=recordedWoundEvent(this.flags?.spycraft2?.woundEvents?.[key],{...input,opponentAttack:input.opponentAttack??false,actorUuid:this.uuid});if(existing){ui.notifications.info?.('This wound event was already recorded; no new wound loss or dice were applied.');return existing;}
      if(state()!==expected)throw new Error('Wounds, source, allowance or usage period changed. Review the actual event again.');
      const spec=adrenalineSource(this.system),status=resourceStatus(spec,this.system.resourceUses,this.usagePeriods),id=foundry.utils.randomID(),plan=adrenalineWoundPlan({...this.system,...this.attributeRuleContext},input,{actorUuid:this.uuid,id,careerDie:CONFIG.SPYCRAFT.tables.levels[this.system.level??0]?.actionDie,periods:this.usagePeriods,status}),path='flags.spycraft2.woundEvents.'+key;
      const patch={'system.wounds.value':plan.record.afterWounds,[path]:plan.record,...(plan.pool?{['system.bonusActionDice.'+id]:plan.pool,'system.resourceUses.adrenalineJunkie':plan.counter}:{})};
      try{await this.update(patch);}catch(error){const saved=this.flags?.spycraft2?.woundEvents?.[key];if(JSON.stringify(saved)!==JSON.stringify(plan.record))throw error;}
      try{await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Wound-loss event ${foundry.utils.escapeHTML(input.eventRef)}: lose ${plan.record.loss} wounds (${plan.record.beforeWounds} → ${plan.record.afterWounds}). ${plan.record.granted?`Adrenaline Junkie: gain ${plan.record.units} bonus d${plan.record.die}, expiring at scene end; session grants ${plan.record.usedAfter}/${plan.record.limit}.`:'No Adrenaline die granted: ineligible cause or session limit reached.'} Resolve any critical injury/death consequences with the GC.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'woundLoss',woundEventKey:key,actionDiceAllowed:false}}});}
      catch(error){if(![...(game.messages??[])].some(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags.spycraft2.woundEventKey===key))ui.notifications.warn('The wound loss and any Adrenaline die are already recorded; the chat receipt failed. Do not apply the event again.');}
      return plan.record;
    });
  }

  async useStrut(message,options={}){
    if(this.type!=='agent'||!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)throw new Error('The GC resolves secret Strut results.');
    const expected=rollEvidence(message.flags.spycraft2),combat=this.mentalLeapCombatContext(),signature=JSON.stringify(combat),careerDie=CONFIG.SPYCRAFT.tables.levels[this.system.level??0]?.actionDie??4;
    const plan=confirmed=>strutGainPlan(this.actionDiceFundingSystem,message.flags.spycraft2,{actorUuid:this.uuid,messageUuid:message.uuid??message.id,combat:this.mentalLeapCombatContext(),careerDie,nextHalfActionConfirmed:confirmed});
    plan(true);let input=options;
    if(input.nextHalfActionConfirmed===undefined){input=await systemDialog.input({window:{title:'Strut — next half action'},rejectClose:false,content:'<p>Gain one default-type bonus action die, improved by Fortune Favors the Bold if applicable. Unspent dice expire at combat end, without award XP.</p><label><input type="checkbox" name="nextHalfActionConfirmed" /> The GC confirms that my next half action after this attack was spent posturing</label>'});if(!input)return null;}
    return queueResources([this],async()=>{
      if(rollEvidence(message.flags.spycraft2)!==expected||JSON.stringify(this.mentalLeapCombatContext())!==signature)throw new Error('The attack or initiative changed. Review the current Strut action.');
      if(message.blind&&!game.user?.isGM)throw new Error('The GC resolves secret Strut results.');
      const gain=plan(input.nextHalfActionConfirmed),id=foundry.utils.randomID(),pool=strutPool({...this.actionDiceFundingSystem,worldTime:game.time?.worldTime??this.system.worldTime},gain,{id,messageUuid:message.uuid??message.id,combat:this.mentalLeapCombatContext(),periods:this.usagePeriods}),path='system.bonusActionDice.'+id;
      const present=()=>this.system.bonusActionDice?.[id],same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
      try{
        try{await this.update({[path]:pool});}catch(error){if(!same(present(),pool))throw error;}
        try{await message.update({'flags.spycraft2.strutPoolId':id});}catch(error){if(message.flags?.spycraft2?.strutPoolId!==id)throw error;}
        return pool;
      }catch(error){
        if(message.flags?.spycraft2?.strutPoolId===id&&same(present(),pool))return pool;
        if(!present())throw error;
        let rollback;
        if(same(present(),pool))try{await this.update({['system.bonusActionDice.-='+id]:null});}catch(e){if(present())rollback=e;}
        else rollback=new Error('The Strut grant changed during restoration.');
        if(rollback){try{await this.update({[path+'.needsReview']:true});}catch{}await this.markActionDiceSettlementReview({count:pool.granted,balance:pool.granted,paymentPath:path+'.remaining',bonusPoolId:id,die:pool.die,label:'Strut',poolFingerprint:actionDicePoolFingerprint(pool)},rollback,{purpose:'Strut grant',grantReview:true,messageUuid:message.uuid??message.id});throw new AggregateError([error,rollback],'The Strut grant needs GC review.');}
        throw error;
      }
    },{messages:[message]});
  }

  async activateMasterPlan(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const initial=masterPlanGainPlan(this.system),periods=this.usagePeriods,expected=JSON.stringify(['scene','session','mission'].map(k=>String(periods[k]??'initial')));let input=options;
    if(input.freeActionConfirmed===undefined){input=await systemDialog.input({window:{title:'Master Plan'},rejectClose:false,content:`<p>Gain ${initial.units} bonus d${initial.die} action dice as a free action, once per mission. Unused dice expire at the end of this scene. Current Intelligence modifier ${initial.intelligenceModifier} is frozen when granted.</p><label><input name="freeActionConfirmed" type="checkbox" /> The GC confirms this free action may be taken now</label>`});if(!input)return null;}
    if(input.freeActionConfirmed!==true)return ui.notifications.warn('Confirm the Master Plan free action.');
    return this.useLimitedAbility('masterPlan',async()=>{
      const blocked=restraintActionBlock(this.system,{free:true})||attributeActionBlock(this.system,{kind:'mentalAbility'});if(blocked)throw new Error(blocked);
      const combat=this.participatingCombat;if(combat?.started&&combat.combatant?.actor?.uuid!==this.uuid)throw new Error('Take this free action during this character’s initiative.');
      if(JSON.stringify(['scene','session','mission'].map(k=>String(this.usagePeriods[k]??'initial')))!==expected)throw new Error('The scene, session or mission changed while confirming Master Plan.');
      const gain=masterPlanGainPlan(this.system);if(gain.intelligenceModifier!==initial.intelligenceModifier||gain.die!==initial.die)throw new Error('The Intelligence modifier or gained die type changed; confirm the current Master Plan benefit.');
      const id=foundry.utils.randomID(),pool=masterPlanPool({...this.system,...this.attributeRuleContext},gain,{id,periods:this.usagePeriods});let message;
      try{await this.update({['system.bonusActionDice.'+id]:pool});message=await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Master Plan: ${pool.granted} bonus d${pool.die} action dice; unused dice are lost at scene end. Free action; one mission use.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'masterPlan',masterPlanPoolId:id,actionDiceAllowed:false}}});return pool;}
      catch(error){
        const receipt=message??[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.masterPlanPoolId===id);let cleanupError;
        if(receipt)try{await receipt.delete();}catch(failure){cleanupError=failure;}
        if(!cleanupError&&this.system.bonusActionDice?.[id]){const current=this.system.bonusActionDice[id];if(current.remaining!==pool.granted)cleanupError=new Error('The granted dice changed; preserve their use for review.');else try{await this.update({['system.bonusActionDice.-='+id]:null});}catch(failure){if(this.system.bonusActionDice?.[id])cleanupError=failure;}}
        if(cleanupError){try{if(this.system.bonusActionDice?.[id])await this.update({['system.bonusActionDice.'+id+'.needsReview']:true});}catch{}if(this.system.bonusActionDice?.[id])await this.markActionDiceSettlementReview({count:0,balance:this.system.bonusActionDice[id].remaining,paymentPath:'system.bonusActionDice.'+id+'.remaining',bonusPoolId:id,die:pool.die,label:pool.label,poolFingerprint:actionDicePoolFingerprint(this.system.bonusActionDice[id])},cleanupError,{purpose:'Master Plan grant',grantReview:true});else ui.notifications.warn('Master Plan could not be fully restored. Its mission use remains spent; ask the GC to review the grant and receipt.');return {...pool,needsReview:true};}
        throw error;
      }
    },{workflow:'masterPlan'});
  }

  async rollDrunkReposition(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const combat=this.participatingCombat,expected=combat?.id+':'+combat?.round;let input=options;
    if(!combat)return ui.notifications.warn('Use this round-start tracker in a started participating combat. The GC resolves rounds outside combat.');
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Drunk round-start reposition'},rejectClose:false,content:'<div class="spycraft2-roll-options"><label>At the start of this round <select name="standing"><option value="true">Standing — roll the five-foot reposition</option><option value="false">Not standing — no reposition this round</option></select></label><label><input name="roundStartConfirmed" type="checkbox" /> The GC confirms this round-start condition and posture</label><p>Direction 1 points to the top of the scene; 2–8 proceed clockwise. This involuntary movement does not count against allowed movement. The GC resolves the actual position, walls and hazards; recording a roll alone does not move a token.</p></div>'});if(!input)return null;input={...input,standing:input.standing==='true'?true:input.standing==='false'?false:null};}
    return queueResources([this],async()=>{
      const current=this.participatingCombat;if(current?.id+':'+current?.round!==(input.expectedRound??expected))throw new Error('The combat round changed while confirming the reposition.');
      const system=()=>({...this.system,...this.attributeRuleContext}),plan=drunkRepositionPlan(system(),current,input);let record=plan.record;
      if(!plan.reused){
        // Reserve this round before drawing. An interrupted draw requires review, never another random result.
        await this.update({'system.drunkRepositions':[...(this.system.drunkRepositions??[]),record]});
        if(record.standing){const roll=await new Roll('1d8').evaluate();record=freezeDrunkReposition(record,{die:roll.total,rollJSON:JSON.stringify(roll.toJSON())});await this.update({'system.drunkRepositions':this.system.drunkRepositions.map(r=>r.id===record.id?record:r)});}
      }
      const existing=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.drunkRepositionId===record.id);
      if(!existing){const message={speaker:ChatMessage.getSpeaker({actor:this}),flags:{spycraft2:{actorUuid:this.uuid,checkKind:'drunkReposition',drunkRepositionId:record.id,actionDiceAllowed:false}},flavor:record.standing?`Drunk: reposition 5 ft. ${record.direction} (d8 ${record.die}); no allowed movement is spent. The GC applies the position and resolves obstacles/hazards.`:'Drunk: not standing at round start; no reposition this round.'};if(record.standing)await Roll.fromJSON(record.rollJSON).toMessage(message);else await ChatMessage.create({...message,content:message.flavor});}
      return record;
    });
  }

  get drunkMovementTokens(){return this.isToken?[this.token]:[...(game.scenes??[])].flatMap(scene=>[...scene.tokens].filter(token=>token.actor?.uuid===this.uuid&&token.isOwner));}
  drunkTokenSnapshot(token){const scene=token.parent,grid=scene.toObject().grid,d=scene.dimensions;return {uuid:token.uuid,actorUuid:token.actor?.uuid,isOwner:token.isOwner===true,x:token.x,y:token.y,width:token.width,height:token.height,sceneUuid:scene.uuid,grid:{type:grid.type,size:grid.size,distance:grid.distance,units:grid.units},sceneRect:{x:d.sceneX,y:d.sceneY,width:d.sceneWidth,height:d.sceneHeight}};}

  async applyDrunkReposition(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;let input=options;
    const signature=r=>JSON.stringify(r?{id:r.id,die:r.die,direction:r.direction,rollJSON:r.rollJSON}:null),expected=signature(this.system.drunkRepositions?.find(r=>r.id===input.id)),tokens=this.drunkMovementTokens,positions=new Map(tokens.map(t=>[t.uuid,JSON.stringify(this.drunkTokenSnapshot(t))]));
    if(input.routeConfirmed===undefined){const esc=foundry.utils.escapeHTML,answer=await systemDialog.input({window:{title:'Apply Drunk five-foot reposition'},rejectClose:false,content:`<div class="spycraft2-roll-options"><label>Token <select name="tokenUuid">${tokens.map(t=>`<option value="${esc(t.uuid)}">${esc(t.name)} (${esc(t.parent.name)})</option>`).join('')}</select></label><label><input name="routeConfirmed" type="checkbox" /> The GC confirms the recorded direction and forced movement path; obstacles and hazards are resolved</label><p>The selected token moves exactly five feet in the frozen direction without spending allowed movement. Other grids and unresolved paths use manual reposition confirmation.</p></div>`});if(!answer)return null;input={...input,...answer};}
    return queueResources([this],async()=>{
      let record=this.system.drunkRepositions?.find(r=>r.id===input.id);if(signature(record)!==expected)throw new Error('The frozen direction changed during movement confirmation.');
      if(record?.state==='applied')return record;
      const token=this.drunkMovementTokens.find(t=>t.uuid===input.tokenUuid);if(!token)throw new Error('Choose an owned token for this character.');
      if(record?.state!=='moving'&&JSON.stringify(this.drunkTokenSnapshot(token))!==(input.expectedTokenSnapshot??positions.get(token.uuid)))throw new Error('The token position or scene grid changed during confirmation. Review its new position.');
      const plan=drunkTokenMovementPlan({...this.system,...this.attributeRuleContext,actorUuid:this.uuid},this.participatingCombat,{...input,token:this.drunkTokenSnapshot(token)});if(plan.reused)return plan.record;
      record=plan.record;if(this.system.drunkRepositions.find(r=>r.id===record.id)?.state!=='moving')await this.update({'system.drunkRepositions':this.system.drunkRepositions.map(r=>r.id===record.id?record:r)});
      const destination=plan.movementPlan.to;
      if(plan.moveRequired){try{await token.update({x:destination.x,y:destination.y});}catch(error){if(token.x!==destination.x||token.y!==destination.y)throw error;}}
      if(token.x!==destination.x||token.y!==destination.y)throw new Error('The token position changed during movement. Preserve it and review the pending reposition.');
      const completed={...record,state:'applied',movementConfirmed:true,appliedAt:game.time.worldTime};await this.update({'system.drunkRepositions':this.system.drunkRepositions.map(r=>r.id===record.id?completed:r)});return completed;
    });
  }

  async confirmDrunkReposition(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;let input=options;const signature=r=>JSON.stringify(r?{id:r.id,die:r.die,direction:r.direction,rollJSON:r.rollJSON,movementPlan:r.movementPlan}:null),expected=signature(this.system.drunkRepositions?.find(r=>r.id===input.id));
    if(input.movementConfirmed===undefined){const answer=await systemDialog.input({window:{title:'Confirm Drunk reposition'},rejectClose:false,content:`${this.system.drunkRepositions?.find(r=>r.id===input.id)?.state==='moving'?'<label><input name="interruptedMovementReviewed" type="checkbox" /> The GC reviewed the interrupted token movement and its actual resolution</label>':''}<label><input name="movementConfirmed" type="checkbox" /> The GC confirms the recorded five-foot movement actually occurred and did not reduce allowed movement; obstacles and hazards were resolved</label>`});if(!answer)return null;input={...input,...answer};}
    return queueResources([this],async()=>{if(signature(this.system.drunkRepositions?.find(r=>r.id===input.id))!==expected)throw new Error('The recorded direction changed during movement confirmation. Review the frozen roll.');const plan=drunkRepositionCompletion({...this.system,...this.attributeRuleContext},input);if(!plan.reused)await this.update({'system.drunkRepositions':this.system.drunkRepositions.map(r=>r.id===plan.record.id?plan.record:r)});return plan.record;});
  }

  beginDrunkSleep(options={}){return this.beginFatigueRest(options,'drunk');}
  completeDrunkSleep(options={}){return this.completeFatigueRest(options,'drunk');}

  ordinaryFatigueSources(condition){
    if(!['fatigued','exhausted','drunk'].includes(condition))throw new Error('Choose ordinary Fatigued, Exhausted or Drunk recovery.');
    const own=[...this.effects];if((this.appliedEffects??[]).some(e=>e.statuses.has(condition)&&!own.includes(e)))throw new Error('This condition is still supplied by an item or another source. Review that source before ordinary recovery.');
    return own.filter(e=>e.active&&e.statuses.has(condition)).map(e=>e.id).sort();
  }

  async beginFatigueRest(options={},restKind='fatigue'){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!['fatigue','drunk'].includes(restKind))return null;const restKey=restKind==='drunk'?'drunkSleep':'fatigueRest';
    const available=restKind==='drunk'?(this.system.conditionContext?.drunk?['drunk']:[]):this.system.conditionContext?.exhausted?['exhausted']:this.system.conditionContext?.fatigued?['fatigued']:[];
    if(!available.length)return ui.notifications.warn('No matching ordinary condition applies. A condition with its own duration follows its source recovery rule.');
    const expectedSources=Object.fromEntries(available.map(condition=>[condition,[...this.effects].filter(e=>e.active&&e.statuses.has(condition)).map(e=>e.id).sort()]));
    let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:restKind==='drunk'?'Begin Drunk sleep':'Begin fatigue recovery'},rejectClose:false,content:`<div class="spycraft2-roll-options"><label>Recovery <select name="condition">${available.map(c=>`<option value="${c}">${c==='drunk'?'Drunk — 4 full hours asleep':c==='exhausted'?'Exhausted — 1 full hour asleep':'Fatigued — 8 hours of inactive rest'}</option>`).join('')}</select></label><label><input name="ordinaryRuleConfirmed" type="checkbox" /> This condition uses its ordinary recovery rule; any special source restrictions are met</label><label><input name="confirmed" type="checkbox" /> The GC confirms the required sleep/rest begins now</label>${this.system[restKey]?.completedAt===null?'<label><input name="restart" type="checkbox" /> Restart the tracked rest period from now</label>':''}<p>Actual sleep/rest must be confirmed after enough game time has passed. Natural healing is separate.</p></div>`});if(!input)return null;input={...input,restart:input.restart===true};}
    try{return await queueResources([this],async()=>{const condition=input.condition??available[0];if(!available.includes(condition))throw new Error('Choose a condition in this recovery family.');const ids=this.ordinaryFatigueSources(condition);if(JSON.stringify(ids)!==JSON.stringify(input.expectedSourceIds??expectedSources[condition]))throw new Error('The condition sources changed while recovery was being started. Review the current condition.');const plan=fatigueRestRecord({...this.system,...this.attributeRuleContext,fatigueRest:this.system[restKey]??null},{...input,condition,ids,restKind});if(plan.reused)return plan.record;await this.update({['system.'+restKey]:plan.record});return plan.record;});}catch(error){ui.notifications.warn(error.message);throw error;}
  }

  async completeFatigueRest(options={},restKind='fatigue'){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!['fatigue','drunk'].includes(restKind))return null;const restKey=restKind==='drunk'?'drunkSleep':'fatigueRest';
    const expectedRest=JSON.stringify(this.system[restKey]??null);let input=options;
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:restKind==='drunk'?'Confirm Drunk recovery':'Confirm fatigue recovery'},rejectClose:false,content:'<div class="spycraft2-roll-options"><label><input name="fullRecoveryConfirmed" type="checkbox" /> The GC confirms the full required period of actual sleep or inactive rest was completed</label><p>The game clock must also reach the required duration. This clears only the tracked ordinary condition; other conditions and health remain unchanged.</p></div>'});if(!input)return null;}
    try{return await queueResources([this],async()=>{
      if(JSON.stringify(this.system[restKey]??null)!==(input.expectedRest??expectedRest))throw new Error('The rest record changed while recovery was being confirmed. Review the current rest.');
      const before=foundry.utils.deepClone(this.system[restKey]??null),ids=before?this.ordinaryFatigueSources(before.condition):[],plan=fatigueRestCompletionPlan({...this.system,...this.attributeRuleContext,fatigueRest:this.system[restKey]??null},{...input,ids,restKind});if(plan.duplicate)return plan.record;
      const sources=plan.alreadyAbsent?[]:[...this.effects].filter(e=>e.active&&e.statuses.has(before.condition)).map(e=>({data:e.toObject(),after:null}));
      try{if(!plan.alreadyAbsent){await setConditionStatus(this,before.condition,false,{label:before.condition});for(const row of sources)row.after=this.effects.get(row.data._id)?.toObject()??null;}await this.update({['system.'+restKey]:plan.record});return plan.record;}
      catch(error){const failures=[];for(const row of sources){const current=this.effects.get(row.data._id);if(row.after===null){if(!current)try{await this.createEmbeddedDocuments('ActiveEffect',[row.data],{keepId:true});}catch(e){failures.push(e);}else if(JSON.stringify(current.toObject())!==JSON.stringify(row.data))failures.push(new Error('The original condition source changed; review it.'));}else if(current){const statuses=[...current.statuses];if(JSON.stringify(statuses)===JSON.stringify(row.after.statuses))try{await this.updateEmbeddedDocuments('ActiveEffect',[{_id:current.id,statuses:row.data.statuses}]);}catch(e){failures.push(e);}else if(JSON.stringify(statuses)!==JSON.stringify(row.data.statuses))failures.push(new Error('Condition statuses changed again; preserve them for review.'));}else failures.push(new Error('The condition source was removed; review it.'));}
        const current=JSON.stringify(this.system[restKey]??null);if(![JSON.stringify(before),JSON.stringify(plan.record)].includes(current))failures.push(new Error('Rest history changed again; preserve it for review.'));
        if(!failures.length)try{await this.update({['system.'+restKey]:before});}catch(e){failures.push(e);}
        if(failures.length||error instanceof AggregateError){try{if([JSON.stringify(before),JSON.stringify(plan.record)].includes(JSON.stringify(this.system[restKey]??null)))await this.update({['system.'+restKey]:{...before,needsReview:true}});}catch(e){failures.push(e);}throw new AggregateError([error,...failures],'Condition recovery needs review after incomplete restoration.');}throw error;
      }
    });}catch(error){ui.notifications.warn(error.message);throw error;}
  }

  async applyFatigue(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    let input=options;const expectedState=fatigueStateSignature({...this.system,...this.attributeRuleContext});
    if(!Object.keys(input).length){input=await systemDialog.input({window:{title:'Apply fatigue or exhaustion'},rejectClose:false,content:'<div class="spycraft2-roll-options"><label>Incoming condition <select name="kind"><option value="fatigued">Fatigued</option><option value="exhausted">Exhausted</option></select></label><label>Source of this application <input name="source" required /></label><label><input name="confirmed" type="checkbox" /> The GC confirms this is a new application of the selected condition</label><p>A second fatigue replaces Fatigued with Exhausted. Fatigue or exhaustion received while already Exhausted causes unconsciousness (pp.340–342). No action die is spent.</p></div>'});if(!input)return null;}
    const id=input.id??foundry.utils.randomID(),request={...input,id,expectedState:input.expectedState??expectedState};
    try{return await queueResources([this],async()=>{
      const plan=fatigueApplicationPlan({...this.system,...this.attributeRuleContext},request);if(plan.duplicate)return plan.record;
      const history=foundry.utils.deepClone(this.system.fatigueApplications??[]),events=foundry.utils.deepClone(this.system.mentalLeapFatigueEvents??[]),nextHistory=[...history,plan.record],nextEvents=plan.event?[...events,plan.event]:events;
      const beforeSources=plan.clearFatigued?[...this.effects].filter(e=>e.active&&e.statuses.has('fatigued')).map(e=>({data:e.toObject(),after:null})):[];
      let created=null;
      try{
        if(plan.clearFatigued){await setConditionStatus(this,'fatigued',false,{label:'Fatigued'});for(const row of beforeSources)row.after=this.effects.get(row.data._id)?.toObject()??null;}
        if(plan.applyStatus){const changed=await setConditionStatus(this,plan.applyStatus,true,{label:plan.applyStatus==='fatigued'?'Fatigued':'Exhausted'});if(changed.effectId)created=this.effects.get(changed.effectId)?.toObject()??null;}
        await this.update({'system.fatigueApplications':nextHistory,...(plan.event?{'system.mentalLeapFatigueEvents':nextEvents}:{})});
        return plan.record;
      }catch(error){
        const failures=[];
        if(created){const current=this.effects.get(created._id);if(current){if(JSON.stringify(current.toObject())===JSON.stringify(created))try{await this.deleteEmbeddedDocuments('ActiveEffect',[created._id]);}catch(e){failures.push(e);}else failures.push(new Error('The new condition source changed again; preserve it for review.'));}}
        for(const row of beforeSources){const current=this.effects.get(row.data._id);if(row.after===null){if(!current)try{await this.createEmbeddedDocuments('ActiveEffect',[row.data],{keepId:true});}catch(e){failures.push(e);}else if(JSON.stringify(current.toObject())!==JSON.stringify(row.data))failures.push(new Error('The original fatigue source changed; review it.'));}else if(current){const statuses=[...current.statuses];if(JSON.stringify(statuses)===JSON.stringify(row.after.statuses))try{await this.updateEmbeddedDocuments('ActiveEffect',[{_id:current.id,statuses:row.data.statuses}]);}catch(e){failures.push(e);}else if(JSON.stringify(statuses)!==JSON.stringify(row.data.statuses))failures.push(new Error('Fatigue statuses changed again; review them.'));}else failures.push(new Error('The original fatigue source was removed; review it.'));}
        const currentHistory=this.system.fatigueApplications??[],currentEvents=this.system.mentalLeapFatigueEvents??[];
        if(![JSON.stringify(history),JSON.stringify(nextHistory)].includes(JSON.stringify(currentHistory))||![JSON.stringify(events),JSON.stringify(nextEvents)].includes(JSON.stringify(currentEvents)))failures.push(new Error('Fatigue history changed again; preserve it for review.'));
        if(!failures.length)try{await this.update({'system.fatigueApplications':history,'system.mentalLeapFatigueEvents':events});}catch(e){failures.push(e);}
        if(failures.length||error instanceof AggregateError){try{if(!(this.system.fatigueApplications??[]).some(r=>r.id===id))await this.update({'system.fatigueApplications':[...(this.system.fatigueApplications??[]),{...plan.record,needsReview:true}]});else await this.update({'system.fatigueApplications':this.system.fatigueApplications.map(r=>r.id===id?{...r,needsReview:true}:r)});}catch(e){failures.push(e);}throw new AggregateError([error,...failures],'Fatigue application needs review after incomplete restoration.');}
        throw error;
      }
    });}catch(error){ui.notifications.warn(error.message);throw error;}
  }

  async recordFatigueEscalation(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;let input=options;
    if(input.confirmed===undefined){input=await systemDialog.input({window:{title:'Repeated fatigue / exhaustion'},rejectClose:false,content:'<div class="spycraft2-roll-options"><p>Receiving fatigue or exhaustion while already exhausted causes unconsciousness (p.341).</p><label><input name="confirmed" type="checkbox" /> The GC confirmed another application while this character is already exhausted</label></div>'});if(!input)return null;}
    return queueResources([this],async()=>{const before=foundry.utils.deepClone(this.system.mentalLeapFatigueEvents??[]),event=mentalLeapFatigueEvent({...this.system,...this.attributeRuleContext},{...input,id:foundry.utils.randomID()});try{await this.update({'system.mentalLeapFatigueEvents':[...before,event]});await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:'Fatigued or exhausted again while already exhausted: unconscious. The GC resolves the required sleep recovery (p.341).',flags:{spycraft2:{actorUuid:this.uuid,checkKind:'fatigueEscalation',eventId:event.id,actionDiceAllowed:false}}});return event;}catch(error){await this.update({'system.mentalLeapFatigueEvents':before});throw error;}});
  }

  async startMentalLeapSleep(options={}){
    if(this.type!=='agent'||!this.isOwner||!this.system.mentalLeapState?.recoveryAvailable)return null;
    const causes=this.system.mentalLeapState.unconsciousCauses??[],expected=JSON.stringify(causes.map(c=>c.key).sort()),beforeInput=this.system.mentalLeapSleep,known=beforeInput?.completedAt===null&&Array.isArray(beforeInput.causeKeys)?beforeInput.causeKeys:[],newCauses=causes.filter(c=>!known.includes(c.key)),esc=foundry.utils.escapeHTML;
    let input=options;
    if(input.confirmed===undefined){
      input=await systemDialog.input({window:{title:'Unconsciousness sleep requirements'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Each applicable new cause receives a frozen 2d4-hour sleep requirement. The GC decides whether another application can affect an already unconscious character (p.340). Existing rolled requirements remain in force.</p>${newCauses.map((c,i)=>`<label><input name="cause${i}" type="checkbox" checked /> ${esc(c.label)} — apply a new sleep duration</label>`).join('')}${beforeInput?.completedAt===null&&!Array.isArray(beforeInput.causeKeys)?'<label><input name="reviewLegacyNoNewCause" type="checkbox" /> The GC confirms all current causes were already covered when the earlier tracked sleep began</label>':''}${beforeInput?.completedAt===null?'<label><input name="restart" type="checkbox" /> Restart the current tracked sleep period from now</label>':''}<label><input name="confirmed" type="checkbox" /> The GC confirms these causes and the beginning or continuation of actual sleep</label></div>`});
      if(!input)return null;input={...input,restart:input.restart===true,ignoredCauseKeys:input.reviewLegacyNoNewCause===true?[]:newCauses.filter((c,i)=>input['cause'+i]!==true).map(c=>c.key)};
    }
    if(input.confirmed!==true)return ui.notifications.warn('Confirm the sleep requirement with the GC.');
    return queueResources([this],async()=>{
      const current=JSON.stringify((this.system.mentalLeapState.unconsciousCauses??[]).map(c=>c.key).sort());if(current!==(input.expectedCauses??expected))throw new Error('Unconsciousness causes changed while sleep was being confirmed. Review the current causes.');
      const before=foundry.utils.deepClone(this.system.mentalLeapSleep??null),request={confirmed:true,restart:input.restart??false,reviewLegacyNoNewCause:input.reviewLegacyNoNewCause===true,ignoredCauseKeys:input.ignoredCauseKeys??[]},rollHoursByCause={},rolls=[];
      let plan=unconsciousSleepPlan({...this.system,...this.attributeRuleContext},{...request,rollHoursByCause});
      for(const cause of plan.needsRoll){const roll=await new Roll('2d4').evaluate();rolls.push(roll);rollHoursByCause[cause.key]=roll.total;}
      if(JSON.stringify((this.system.mentalLeapState.unconsciousCauses??[]).map(c=>c.key).sort())!==current)throw new Error('Unconsciousness causes changed during the rolls. Review them before tracking sleep.');
      plan=unconsciousSleepPlan({...this.system,...this.attributeRuleContext},{...request,rollHoursByCause});if(!plan.record)throw new Error('All new applicable causes need their sleep rolls.');
      try{
        await this.update({'system.mentalLeapSleep':plan.record});
        const text=`Sleep requirements retained: ${plan.record.requirements.map(r=>r.requiredHours+' full hours').join('; ')}. Confirm actual sleep for every retained requirement after its deadline.`,message={speaker:ChatMessage.getSpeaker({actor:this}),flags:{spycraft2:{actorUuid:this.uuid,checkKind:'unconsciousSleep',requiredHours:plan.record.requiredHours,newRequirementCount:rolls.length,requirements:plan.record.requirements,reusedRequirement:!rolls.length,actionDiceAllowed:false}}};
        await ChatMessage.create({...message,...(rolls.length?{rolls,flavor:text}:{content:text})});return plan.record;
      }catch(error){await this.update({'system.mentalLeapSleep':before});throw error;}
    });
  }

  async completeMentalLeapSleep(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;let input=options;
    if(input.fullSleepConfirmed===undefined){const sleep=this.system.mentalLeapSleep,requirements=Array.isArray(sleep?.requirements)?sleep.requirements:[];input=await systemDialog.input({window:{title:'Confirm full sleep recovery'},rejectClose:false,content:`<div class="spycraft2-roll-options">${requirements.map(r=>`<p>Retained requirement: ${r.requiredHours} full hours asleep.</p>`).join('')}<label><input name="fullSleepConfirmed" type="checkbox" /> The GC confirms all required actual sleep for every retained requirement was completed</label>${sleep&&!Array.isArray(sleep.causeKeys)?'<label><input name="reviewLegacyNoNewCause" type="checkbox" /> The GC confirms no additional cause was omitted from this earlier sleep record</label>':''}${sleep?.legacyReviewRequired||sleep&&!Array.isArray(sleep.requirements)&&sleep.previousDueAt>sleep.at+sleep.requiredHours*3600?'<label><input name="earlierRequirementsConfirmed" type="checkbox" /> The GC reviewed and satisfied all earlier retained sleep requirements</label>':''}<p>The game clock must also reach every deadline. Other conditions and health remain separate.</p></div>`});if(!input)return null;}
    return queueResources([this],async()=>{
      const plan=unconsciousSleepCompletionPlan({...this.system,...this.attributeRuleContext},input),before=foundry.utils.deepClone(this.system.mentalLeapRecovery??null),oldSleep=foundry.utils.deepClone(this.system.mentalLeapSleep);
      try{await this.update({'system.mentalLeapRecovery':plan.record,'system.mentalLeapSleep':plan.completedSleep});await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:'Recovered from the recorded unconsciousness causes after all retained GC-confirmed sleep requirements were satisfied. Other conditions remain separate.',flags:{spycraft2:{actorUuid:this.uuid,checkKind:'unconsciousRecovery',requiredHours:plan.record.requiredHours,requirements:plan.completedSleep.requirements,actionDiceAllowed:false}}});return plan.record;}
      catch(error){await this.update({'system.mentalLeapRecovery':before,'system.mentalLeapSleep':oldSleep});throw error;}
    });
  }

  async rollWisdomCollapse(options={}){
    if(this.type!=='agent'||!this.isOwner||!attributeCollapsePlan(this.system).wisdomEpisode)return null;
    let input=options;
    if(!input.confirmed){input=await systemDialog.input({window:{title:'Wisdom-collapse episode'},rejectClose:false,content:'<div class="spycraft2-roll-options"><p>The GC determines a new Frenzied/Terrified episode with equal probability every 2d10 minutes while Wisdom is zero or lower. This records the roll; the GC applies the condition and tracks the next episode.</p><label><input type="checkbox" name="sleeping" /> Currently asleep</label><label><input type="checkbox" name="stunned" /> Currently stunned</label><label><input type="checkbox" name="unconscious" /> Currently unconscious</label><label><input type="checkbox" name="confirmed" /> The GC confirmed a new episode is due now</label></div>'});if(!input)return null;}
    if(input.confirmed!==true)return ui.notifications.warn('Confirm with the GC that a new Wisdom-collapse episode is due.');
    const choice=await new Roll('1d2').evaluate(),duration=await new Roll('2d10').evaluate(),values=duration.dice[0]?.results.filter(d=>d.active!==false).map(d=>d.result);
    const episode=wisdomCollapseEpisode(this.system,{choiceDie:choice.total,durationDice:values,sleeping:input.sleeping===true||!!this.statuses?.has('sleeping')||!!this.statuses?.has('sleep')||!!this.statuses?.has('asleep'),stunned:input.stunned===true||this.system.conditionContext?.stunned===true||!!this.statuses?.has('stunned')||!!this.statuses?.has('stun'),unconscious:input.unconscious===true||!!this.statuses?.has('unconscious')});
    await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Wisdom collapse: ${episode.condition} for ${episode.minutes} minutes${episode.doubleDuration?' (duration doubled for sleep/stun/unconsciousness)':''}. The GC applies the condition and determines when the next episode is due (p.15). No action die spent.`,rolls:[choice,duration],flags:{spycraft2:{actorUuid:this.uuid,checkKind:'attributeCollapse',...episode,actionDiceAllowed:false}}});return episode;
  }

  async summonClassAssistants(sourceId,options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const source=assistantSource(this.system,sourceId);if(!source)return ui.notifications.warn('This assistant option has not been earned.');
    let input=options;const esc=foundry.utils.escapeHTML;
    if(!input.city){input=await systemDialog.input({window:{title:source.name},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Summon ${this.system.actionDice.max} Tier II ${esc(source.template)} assistants until the end of the following scene. This records the group; the GC supplies its NPCs and adjudicates their help. No action die is spent.</p><label>Current city <input name="city" type="text" /></label><label>City population <input name="population" type="number" min="10000" step="1" /></label><label><input name="quickContactConfirmed" type="checkbox" /> A method of quick contact is available</label><label><input name="nonCombatConfirmed" type="checkbox" /> The requested help is non-combat work within their skills/equipment</label><label><input name="gcHelpApproved" type="checkbox" /> The GC approved this assistance</label>${source.kitGrade?'<p>For required-kit skill checks while helping, these standard NPCs are assumed to possess one appropriate grade I kit.</p>':''}</div>`});if(!input)return null;input={...input,population:Number(input.population)};}
    return this.useLimitedAbility(sourceId,async()=>{
      const periods=this.usagePeriods,mission=String(periods.mission??'initial'),scene=String(periods.scene??'initial'),sequence=sceneSequence(periods),before=foundry.utils.deepClone(this.system.assistantGroups??[]);
      const plan=assistantSummonPlan(this.system,sourceId,{...input,groupId:foundry.utils.randomID()});
      const guard=()=>{if(!this.isOwner||!assistantSource(this.system,sourceId)||String(this.usagePeriods.mission??'initial')!==mission||String(this.usagePeriods.scene??'initial')!==scene||sceneSequence(this.usagePeriods)!==sequence)throw new Error('The assistant source or usage period changed.');};guard();
      try{await this.update({'system.assistantGroups':[...before,plan]});guard();await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`${esc(source.name)}: ${plan.count} Tier II ${esc(plan.template)} assistants in ${esc(plan.city)}; non-combat help at the GC’s discretion until the end of the following scene, subject to their withdrawal conditions.${plan.kitGrade?' Required-kit checks assume one appropriate grade I kit.':''} One mission use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'assistantGroup',source:sourceId,groupId:plan.id,mission,scene,count:plan.count,tier:2,actionDiceAllowed:false}}});guard();return plan;}
      catch(error){try{await this.update({'system.assistantGroups':before});}catch(rollbackError){ui.notifications.warn('The assistant group may remain after rollback failed. Its mission use remains spent; review the group before trying again.');return plan;}throw error;}
    },{workflow:'summonAssistants'});
  }

  async withdrawClassAssistants(groupId,options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const group=(this.system.assistantGroups??[]).find(g=>g.id===groupId);if(!group||!assistantGroupStatus(this.system,group).active)return ui.notifications.warn('This assistant group is not active.');
    let input=options;const police=group.source==='friendsOnForce';
    if(!input.event){input=await systemDialog.input({window:{title:'Assistant group withdrawal'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>The entire group leaves when any one member meets a stated withdrawal condition.</p><label>Condition <select name="event"><option value="failedMorale">Failed Morale check</option><option value="criticalInjury">Critical injury</option>${police?'<option value="vitalityLoss">Lost more than half maximum vitality (rounded down)</option><option value="woundLoss">Lost at least one wound point</option>':'<option value="failedDamageSave">Failed Damage save</option>'}</select></label>${police?'<label>Officer maximum vitality <input name="maxVitality" type="number" min="1" step="1" value="1" /></label><label>Total vitality lost by that officer <input name="vitalityLost" type="number" min="0" step="1" value="0" /></label><label>Wounds lost by that officer <input name="woundsLost" type="number" min="0" step="1" value="0" /></label>':''}<label><input name="confirmed" type="checkbox" /> The GC confirmed at least one member met this condition</label></div>`});if(!input)return null;input={...input,...(police?{maxVitality:Number(input.maxVitality),vitalityLost:Number(input.vitalityLost),woundsLost:Number(input.woundsLost)}:{})};}
    return queueResources([this],async()=>{
      if(!this.isOwner)throw new Error('Ownership changed before group withdrawal.');
      const before=foundry.utils.deepClone(this.system.assistantGroups??[]),index=before.findIndex(g=>g.id===groupId),next=assistantWithdrawalPlan(this.system,before[index],input),groups=[...before];groups[index]=next;
      try{await this.update({'system.assistantGroups':groups});await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`${foundry.utils.escapeHTML(next.name)}: the entire group withdraws. ${foundry.utils.escapeHTML(next.withdrawal.reason)} Its spent mission use is unchanged.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'assistantWithdrawal',groupId,event:input.event,actionDiceAllowed:false}}});return next;}
      catch(error){await this.update({'system.assistantGroups':before});throw error;}
    });
  }

  async spendDeferredSkillPoints(key,options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const pools=deferredSkillPools(this.system,[...this.items]);if(!pools||!Object.hasOwn(CONFIG.SPYCRAFT.skills,key))return ui.notifications.warn('I Can Swim is not available for this skill.');
    const level=pools.level,esc=foundry.utils.escapeHTML;let input=options;
    if(input.points===undefined&&input.trainingPoints===undefined){
      input=await systemDialog.input({window:{title:`I Can Swim — ${CONFIG.SPYCRAFT.skills[key].name}`},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Before this skill check, spend current-level points only in ${esc(CONFIG.SPYCRAFT.skills[key].name)}. Class/cross-class costs, discounts, linked ranks and rank limits apply normally. Training costs one point per rank. Allocated ranks remain purchased even if the following check is cancelled.</p><label>Career-level ${level} points (${pools.careerPoints} available) <input name="points" type="number" min="0" max="${pools.careerPoints}" step="1" value="0" /></label>${pools.training.map(p=>`<label>Training ${esc(p.id)} (${p.remaining} available) <input name="training_${esc(p.id)}" type="number" min="0" max="${p.remaining}" step="1" value="0" /></label>`).join('')}<label><input type="checkbox" name="freeActionConfirmed" /> I spend the free action before this skill check (during my initiative if in combat)</label></div>`});
      if(!input)return null;input={...input,points:Number(input.points),trainingPoints:Object.fromEntries(pools.training.map(p=>[p.id,Number(input[`training_${p.id}`]??0)])),beforeSkillCheckConfirmed:options.beforeSkillCheckConfirmed};
    }
    return queueResources([this],async()=>{
      if(!this.isOwner)throw new Error('Ownership changed before this purchase.');
      const combat=this.participatingCombat;if(combat?.started&&combat.combatant?.actor?.uuid!==this.uuid)throw new Error('Take this free action during this character’s initiative.');
      const current=this.system.toObject?.()??foundry.utils.deepClone(this.system);current.usagePeriods=this.usagePeriods;Object.assign(current,this.attributeRuleContext);
      const items=this.items.filter(i=>!isResourceLock(i)).map(i=>({id:i.id,name:i.name,type:i.type,system:i.system.toObject?.()??foundry.utils.deepClone(i.system)})),plan=deferredSkillPlan({...current,abilities:Object.fromEntries(Object.entries(this.system.abilities).map(([key,value])=>[key,{...value}])),activeFeatNames:this.system.activeFeatNames,skillPoints:this.system.skillPoints,skillTotals:this.system.skillTotals,skillPurchaseIssues:this.system.skillPurchaseIssues,featStatus:this.system.featStatus,level:this.system.level},items,CONFIG.SPYCRAFT,key,{...input,level}),previous=foundry.utils.deepClone(this.system.progression),restore=plan.updates.map(u=>({_id:u._id,'system.trainingSkills':foundry.utils.deepClone(this.items.get(u._id).system.trainingSkills)}));
      const epoch=String(this.usagePeriods.mission??'initial'),session=String(this.usagePeriods.session??'initial'),guard=()=>{if(this.system.level!==level||!this.system.activeFeatNames.includes('I Can Swim')||String(this.usagePeriods.mission??'initial')!==epoch||String(this.usagePeriods.session??'initial')!==session||plan.updates.some(u=>!this.system.featStatus?.[u._id]?.ok))throw new Error('The level, period or deferred skill source changed during the purchase.');};
      try{if(plan.updates.length)await this.updateEmbeddedDocuments('Item',plan.updates);if(plan.points)await this.update({'system.progression':plan.progression});guard();await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`I Can Swim: free action before ${esc(CONFIG.SPYCRAFT.skills[key].name)}; spent ${plan.totalPoints} saved skill point(s) for ${plan.ranks} rank(s). No action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'skillPurchase',source:'iCanSwim',skillKey:key,careerLevel:level,careerPoints:plan.points,trainingPoints:plan.trainingPoints,ranks:plan.ranks,actionDiceAllowed:false}}});guard();return plan;}
      catch(error){try{if(restore.length)await this.updateEmbeddedDocuments('Item',restore);if(plan.points)await this.update({'system.progression':previous});}catch(rollbackError){ui.notifications.warn('The deferred purchase needs review after rollback failed. Check its skill points and ranks before rolling or trying again.');return {review:true};}throw error;}
    });
  }

  async useEverydayGenius(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    if(!everydayGeniusSource(this.system))return ui.notifications.warn('Everyday Genius is not currently available.');
    const pack=game.packs?.get('spycraft2.feats');if(!pack)throw new Error('The system feat compendium is unavailable.');
    let input=options;const esc=foundry.utils.escapeHTML;
    if(!input.featId){const index=await pack.getIndex({fields:['system.tree']}),feats=index.filter(f=>f.type==='feat'&&f.system.tree==='basicSkill').sort((a,b)=>a.name.localeCompare(b.name));input=await systemDialog.input({window:{title:'Everyday Genius'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>As a full action, gain one unpossessed non-virtual Basic Skill feat until this session ends. Uses per mission equal your number of eligible Advanced Skill feats; granted Basic Skill feats do not increase this limit.</p><label>Basic Skill feat <select name="featId">${feats.map(f=>`<option value="${esc(f._id)}">${esc(f.name)}</option>`).join('')}</select></label><label><input type="checkbox" name="fullActionConfirmed" /> I spend the required full action (during my initiative if in combat)</label></div>`});if(!input)return null;}
    if(input.fullActionConfirmed!==true)return ui.notifications.warn('Confirm the required full action.');
    return this.useLimitedAbility('everydayGenius',async()=>{
      const mission=String(this.usagePeriods.mission??'initial'),session=String(this.usagePeriods.session??'initial');
      const guard=(checkTurn=true)=>{const source=everydayGeniusSource(this.system),combat=this.participatingCombat;if(!this.isOwner||!source||(this.system.resourceUses?.everydayGenius?.used??0)>source.limit||String(this.usagePeriods.mission??'initial')!==mission||String(this.usagePeriods.session??'initial')!==session)throw new Error('Everyday Genius source, allowance or period changed.');if(checkTurn&&combat?.started&&combat.combatant?.actor?.uuid!==this.uuid)throw new Error('Take this full action during this character’s initiative.');};
      guard();const feat=await pack.getDocument(input.featId);guard();const data=everydayGeniusPlan(this.system,[...this.items],feat,{epoch:session,sourceActorUuid:this.uuid}),eligible=this.checkPrerequisites(data.system.prerequisites,{temporary:true});if(!eligible.ok)throw new Error(`Temporary Basic Skill prerequisites not met: ${eligible.unmet.join('; ')}.`);
      let created;try{[created]=await this.createEmbeddedDocuments('Item',[data]);if(!created)throw new Error('Temporary Basic Skill feat creation failed.');guard(false);await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Everyday Genius: full action; gained ${esc(created.name)} until the end of this session. One mission use spent; no action die spent.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'temporaryFeat',ability:'everydayGenius',mission,session,featUuid:created.uuid,actionDiceAllowed:false}}});guard(false);return created;}
      catch(error){if(created)try{await this.deleteEmbeddedDocuments('Item',[created.id]);}catch(cleanupError){ui.notifications.warn('The temporary Basic Skill feat remains after cleanup failed. Its mission use remains spent; review the existing feat before retrying.');return created;}throw error;}
    },{workflow:'sessionBasicFeat'});
  }

  async useRenaissanceMan(options={}){
    if(this.type!=='agent'||!this.isOwner)return null;
    const pack=game.packs?.get('spycraft2.feats');if(!pack)throw new Error('The system feat compendium is unavailable.');
    let input=options;
    if(!input.featId){
      const index=await pack.getIndex({fields:['system.tree']}),esc=foundry.utils.escapeHTML;
      const choices=index.filter(i=>i.type==='feat'&&i.system.tree==='basicSkill').sort((a,b)=>a.name.localeCompare(b.name));
      input=await systemDialog.input({window:{title:'Renaissance Man'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Gain one temporary Basic Skill feat until this mission ends. Choose a feat you do not already possess. It supplies no permanent feat slot or permanent prerequisite qualification.</p><label>Feat <select name="featId">${choices.map(i=>`<option value="${esc(i._id)}">${esc(i.name)}</option>`).join('')}</select></label><label><input type="checkbox" name="freeActionConfirmed" /> I spend the required free action</label></div>`});
      if(!input)return null;
    }
    if(!input.freeActionConfirmed)return ui.notifications.warn('Confirm the required free action.');
    return this.useLimitedAbility('renaissanceMan',async()=>{
      const feat=await pack.getDocument(input.featId),epoch=String(this.usagePeriods.mission??'initial');
      const data=renaissanceManPlan(this.system,this.items,feat,{epoch,sourceActorUuid:this.uuid});
      const eligible=this.checkPrerequisites(data.system.prerequisites,{temporary:true});
      if(!eligible.ok)throw new Error(`This temporary feat's prerequisites are not met: ${eligible.unmet.join('; ')}.`);
      let created;
      try{
        [created]=await this.createEmbeddedDocuments('Item',[data]);if(!created)throw new Error('The temporary feat was not created.');
        await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this}),content:`Renaissance Man: free action; gained ${foundry.utils.escapeHTML(created.name)} until the end of this mission.`,flags:{spycraft2:{actorUuid:this.uuid,checkKind:'temporaryFeat',ability:'renaissanceMan',featUuid:created.uuid,mission:epoch,actionDiceAllowed:false}}});
        return created;
      }catch(error){
        if(created)try{await this.deleteEmbeddedDocuments('Item',[created.id]);}catch(cleanupError){ui.notifications.warn('The temporary feat remains after a posting/cleanup failure. Its use remains spent; review the existing feat before retrying.');return created;}
        throw error;
      }
    },{workflow:'selfTemporaryFeat'});
  }

  async shareTemporaryFeats(ability,options={}) {
    if(!this.isOwner)throw new Error("You must own the source actor.");
    let input=options;
    const definition=SHARE_ABILITIES[ability];if(!definition)throw new Error("Unknown sharing ability.");
    if(!input.featIds){
      const esc=foundry.utils.escapeHTML;
      const eligible=this.items.filter(item=>item.type==="feat"&&item.system.tree===definition.tree&&!['temporary','virtual'].includes(item.system.featKind)&&this.system.featStatus?.[item.id]?.ok);
      const recipients=[...game.actors].filter(actor=>actor.type==="agent"&&actor.id!==this.id&&actor.isOwner);
      input=await systemDialog.input({window:{title:`${definition.name}: share temporary feats`},rejectClose:false,content:`
        <p>Choose up to ${this.system.actionDice.max} owned ${definition.tree} feats at session start. Recipients must meet the prerequisites to benefit. A GC can apply this to teammates owned by other players.</p>
        ${eligible.map(item=>`<label><input type="checkbox" name="feat_${item.id}" /> ${esc(item.name)}</label>`).join("")}
        <h4>Teammates</h4>${recipients.map(actor=>`<label><input type="checkbox" name="recipient_${actor.id}" /> ${esc(actor.name)}</label>`).join("")}
        <label><input type="checkbox" name="atSessionStart" /> This selection is being made at the start of the session</label>`});
      if(!input)return null;
      input.featIds=eligible.filter(item=>input[`feat_${item.id}`]).map(item=>item.id);
      input.recipients=recipients.filter(actor=>input[`recipient_${actor.id}`]);
    }
    const work=async()=>{
      const epoch=String(this.usagePeriods.session??'initial');
      const data=temporarySharePlan(this.system,this.items,ability,input.featIds,{epoch,atSessionStart:!!input.atSessionStart,sourceActorUuid:this.uuid});
      const recipients=[...new Set(input.recipients??[])];
      if(!recipients.length||recipients.some(actor=>actor===this||actor.type!=="agent"||!actor.isOwner))throw new Error("Choose teammates you can update; ask the GC to apply sharing for other players.");
      const created=[];
      try{
        for(const actor of recipients){
          const recipientData=structuredClone(data);for(const feat of recipientData)feat.system.acquiredAtLevel=Math.max(1,actor.system?.level??1);
          const docs=await actor.createEmbeddedDocuments("Item",recipientData);
          created.push({actor,ids:docs.map(doc=>doc.id)});
        }
        if(String(this.usagePeriods.session??'initial')!==epoch)throw new Error("The session changed during sharing; repeat the selection.");
        await this.update({"system.temporaryShares":{...this.system.temporaryShares,[ability]:{epoch,featIds:[...input.featIds],recipients:recipients.map(actor=>actor.uuid)}}});
        return created;
      }catch(error){for(const entry of created.reverse())await entry.actor.deleteEmbeddedDocuments("Item",entry.ids);throw error;}
    };
    return queueResources([this],work);
  }

  async rerollCheck(message,options={}) {
    if(!this.isOwner||message.flags?.spycraft2?.actorUuid!==this.uuid)return null;
    if(message.blind&&!game.user?.isGM)return ui.notifications.warn("The GC resolves secret results.");
    const expected=rollEvidence(message.flags.spycraft2);
    let input=options;const esc=foundry.utils.escapeHTML;
    if(!input.resource){
      const available=this.limitedUseStatus.filter(spec=>spec.workflow==="reroll"&&spec.remaining&&rerollEligibility(spec,message.flags.spycraft2,{failed:true,criticalFailure:!!message.flags.spycraft2.criticalFailure}));
      if(!available.length)return ui.notifications.warn("No available reroll ability applies to this check.");
      input=await systemDialog.input({window:{title:"Reroll check"},rejectClose:false,content:`<div class="spycraft2-roll-options">
        ${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({perBenefit:true,unrolled:true})}<label>Ability <select name="resource">${available.map(spec=>`<option value="${esc(spec.id)}">${esc(spec.name)} (${spec.remaining}/${spec.limit}, ${spec.cost} action dice)</option>`).join("")}</select></label>
        <label><input type="checkbox" name="failed" /> The GC confirmed this check failed</label>
        <label><input type="checkbox" name="criticalFailure" /> This is an activated critical failure</label></div>`});
      if(!input)return null;
    }
    // Re-read and validate inside the spending queue, after any dialog or earlier click.
    return this.useLimitedAbility(input.resource,async(status,payment)=>{
      const check=message.flags?.spycraft2,spec=this.system.limitedUses.find(entry=>entry.id===input.resource);
      if(rollEvidence(check)!==expected)throw new Error('This roll changed while the reroll was being prepared. Review the current result.');
      validateAttributeDamageProof(this.system,check.attributeDamage??null,{checkKind:check.checkKind});
      if(!rerollEligibility(spec,check,input))throw new Error("This ability cannot reroll the selected check in its current state.");
      const {epoch:sourceEpoch,used:reservedUsed,remaining:reservedRemaining,counterReview:reservedReview,...reservedSource}=status,sourceSignature=JSON.stringify(reservedSource),rerollSource={version:1,id:spec.id,name:spec.name??spec.id,mastery:spec.mastery??'',period:spec.period,epoch:sourceEpoch,skills:structuredClone(spec.skills??[])};
      const validateRerollContext=()=>{const live=this.system.limitedUses?.find(s=>s.id===spec.id);if(JSON.stringify(live)!==sourceSignature||String(this.usagePeriods[spec.period]??'initial')!==sourceEpoch||rollEvidence(message.flags?.spycraft2)!==expected||!rerollEligibility(live,message.flags?.spycraft2,input))throw new Error('The reroll source, period or original check changed before the replacement was posted.');};
      const pending=transferableCheckBonusPool(this.system,message,this.usagePeriods);
      const resources=[...(check.rerollResources??[]),spec.id];
      const rerollReceiptId=globalThis.foundry?.utils?.randomID?.()??('reroll-'+(this._rerollReceiptSequence=(this._rerollReceiptSequence??0)+1));
      let replacement;
      try{replacement=await this.rollCheck(check.formula,check.rollData,{...check,rerollSource,validateRerollContext,preRollFunding:null,rerollFunding:this.preRollPaymentReceipt(payment),rerollReceiptId,rerollOf:message.uuid??message.id,shakenContext:check.shakenContext??null,flavor:`${check.baseFlavor??"Check"} — ${spec.name} reroll`,requiredBonusPoolId:pending?.id??null,oneInAMillion:false,millionCommitted:false,tenSecondSolution:false,solutionCommitted:false,noForcedReroll:false,forcedThreat:false,cannotError:check.manualAdjustment?(check.cannotErrorBeforeManual??false):check.cannotError,threat:check.oneInAMillion||check.tenSecondSolution?check.normalThreat:check.threat,rerollResources:resources});}
      catch(error){replacement=[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===this.uuid&&m.flags?.spycraft2?.rerollReceiptId===rerollReceiptId);if(!replacement)throw error;}
      const weapon=check.weaponUuid&&typeof fromUuidSync!=="undefined"?fromUuidSync(check.weaponUuid):null;
      const tracksDestruction=!!weapon&&weapon.system.destroyedByRoll===(message.uuid??message.id);
      const previousWeapon=tracksDestruction?{destroyed:weapon.system.destroyed,destroyedByRoll:weapon.system.destroyedByRoll}:null;
      let transferred=false;
      try{
        if(rollEvidence(message.flags.spycraft2)!==expected)throw new Error('The original result changed during the replacement roll. Review it before retrying.');
        if(pending){await this.update({[`system.bonusActionDice.${pending.id}.messageUuid`]:replacement.uuid??replacement.id});transferred=true;}
        if(tracksDestruction){
          const next= replacement.flags?.spycraft2??replacement.data?.flags?.spycraft2;
          const destroyed=!!next?.errorConfirmed;
          await weapon.update({"system.destroyed":destroyed,"system.destroyedByRoll":destroyed?(replacement.uuid??replacement.id):""});
        }
        await message.update({"flags.spycraft2.superseded":replacement.uuid??replacement.id,"flags.spycraft2.resolved":true,...(pending?{"flags.spycraft2.bonusTransferredTo":replacement.uuid??replacement.id}:{}),flavor:checkFlavor({...check,resolved:true,superseded:replacement.uuid??replacement.id,...(pending?{bonusTransferredTo:replacement.uuid??replacement.id}:{})})});
      }catch(error){
        if(message.flags?.spycraft2?.superseded===(replacement.uuid??replacement.id)&&message.flags?.spycraft2?.resolved){await this.retireCheckBonusPool(message);return replacement;}
        const failures=[];
        if(pending&&(transferred||this.system.bonusActionDice?.[pending.id]?.messageUuid===(replacement.uuid??replacement.id)))try{await this.update({[`system.bonusActionDice.${pending.id}.messageUuid`]:pending.messageUuid});}catch(e){failures.push(e);}
        if(previousWeapon)try{await weapon.update({"system.destroyed":previousWeapon.destroyed,"system.destroyedByRoll":previousWeapon.destroyedByRoll});}catch(e){failures.push(e);}
        try{await replacement.delete?.();}catch(e){if([...(game.messages??[])].some(m=>m.uuid===(replacement.uuid??replacement.id)||m.id===replacement.id))failures.push(e);}
        if(failures.length){const failure=new AggregateError([error,...failures],'The replacement result needs GC review before retrying.');failure.actionDiceSettlementReview={purpose:'class reroll',messageUuid:message.uuid??message.id,replacementUuid:replacement.uuid??replacement.id};throw failure;}
        throw error;
      }
      await this.retireCheckBonusPool(message);return replacement;
    },{workflow:"reroll",messages:[message],bonusPoolId:input.bonusPoolId??'',...surchargeFundingInput(input),...unrolledPaymentFundingInput(input)});
  }

  /** Attack bonus for a weapon, including proficiency and forte. */
  sensoryContext(options={}){
    return {...options,spearChargeCombat:this.mentalLeapCombatContext(),stalkingCombat:this.mentalLeapCombatContext(),cheapShotCombat:this.mentalLeapCombatContext(),feintCombat:this.mentalLeapCombatContext(),tripAttackCombat:this.mentalLeapCombatContext(),tripDefenseCombat:this.mentalLeapCombatContext(),conveyanceBullRushCombat:this.mentalLeapCombatContext(),bullRushAttackCombat:this.mentalLeapCombatContext(),threatenCombat:this.mentalLeapCombatContext(),taskWorldTime:game.time?.worldTime??null,maneuverCombat:this.mentalLeapCombatContext(),inCombat:options.inCombat===true||!!this.participatingCombat,bound:options.bound===true||!!this.statuses?.has('bound'),blinded:!!options.blinded||!!this.statuses?.has('blind')||!!this.statuses?.has('blinded'),deafened:!!options.deafened||!!this.statuses?.has('deaf')||!!this.statuses?.has('deafened')};
  }
  weaponContext(item,options={}) {
    const ammunition=item.system.loadedAmmoId?this.items?.get?.(item.system.loadedAmmoId):null;
    return {...this.sensoryContext(options),whirlingFlankingProof:whirlingAttackProof(this,options),...(options.meleeTrick==='fend'?{fendTiming:fendTiming(this)}:{}),ammunition:ammunition?{...ammunition.system,name:ammunition.name}:null};
  }

  weaponAttack(item,options={}) {
    return weaponAttack(this.system,{...item.system,id:item.id??item._id,name:item.name},CONFIG.SPYCRAFT,this.type,this.weaponContext(item,options));
  }

  /* -------------------------------------------- */
  /*  Character building                            */
  /* -------------------------------------------- */

  /**
   * Add a career level in a class. Creates the class item on the actor if needed.
   * @param {Item|object} classData  a class Item (world/compendium/embedded) or its data
   */
  async addClassLevel(classData, { promptVitality = true } = {}) {
    if(this.type!=="agent"||!this.isOwner)return null;
    let level;
    const cls=await queueResources([this],async()=>{const before=this.system.progression.length,result=await this._addClassLevel(classData);if(this.system.progression.length>before)level=this.system.progression.length;return result;});
    if(level&&promptVitality&&level>1&&cls?.system.vitalityDie){const roll=await systemDialog.confirm({window:{title:game.i18n.localize("SPYCRAFT.VitalityRoll")},content:`<p>${game.i18n.format("SPYCRAFT.VitalityPrompt",{level,name:cls.name,die:cls.system.vitalityDie})}</p>`});if(roll)await this.rollVitality(level-1);}
    return cls;
  }

  async _addClassLevel(classData) {
    if (this.type !== "agent") return;
    const sys = this.system;
    if(sys.skillPurchaseIssues?.length)return ui.notifications.warn(`Repair invalid skill-purchase history before gaining a level: ${sys.skillPurchaseIssues.map(issue=>issue.message).join('; ')}`);
    const deferred=deferredSkillDeadline(sys,[...this.items]);if(deferred.length)return ui.notifications.warn(`Spend all deferred skill points before gaining another level (I Can Swim, p.200): ${deferred.join('; ')}.`);
    if (sys.progression.length >= 20) return ui.notifications.warn(game.i18n.localize("SPYCRAFT.Class.MaxLevel"));
    const ident = classData.system?.identifier || classData.name;
    let cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === ident);
    const definition=cls?.system??classData.system;
    const firstExpertLevel=definition.expert&&!(sys.classLevels?.[ident]);
    if(firstExpertLevel&&sys.level<4)return ui.notifications.warn(game.i18n.format("SPYCRAFT.Class.ExpertTooEarly",{name:classData.name}));
    const expertEntry=firstExpertLevel&&definition.requirements?this.checkPrerequisites(definition.requirements,{classEntry:true}):null;
    if(expertEntry&&!expertEntry.ok)return ui.notifications.warn(`Expert-class entry requirements are not met: ${expertEntry.unmet.join("; ")}.`);
    if (!cls) {
      const data = classData.toObject?.() ?? foundry.utils.deepClone(classData);
      delete data._id;
      [cls] = await this.createEmbeddedDocuments("Item", [data]);
    }
    const progression = [...sys.progression.map(p => ({ ...p })),
      { classId: ident, careerEntryId: foundry.utils.randomID(), vitality: 0, skills: {}, expertEntry }];
    const preview=this.system.toObject?.()??foundry.utils.deepClone(this.system);
    Object.assign(preview,this.attributeRuleContext);preview.progression=progression;
    computeAgent(preview,this.items.map(item=>({id:item.id,name:item.name,type:item.type,system:item.system})),CONFIG.SPYCRAFT);
    progression.at(-1).intelligenceModifier=Math.floor((preview.abilities.int.value-(preview.abilities.int.misc??0)-(preview.abilities.int.temporaryBonus??0)-10)/2);
    await this.update({ "system.progression": progression });
    await this.syncGrantedFeats();
    for(const feat of this.items.filter(item=>item.type==="feat"&&!item.system.granted&&!item.system.acquisitionCheck&&(item.system.acquiredAtLevel||1)===progression.length))await feat.update({"system.acquisitionCheck":captureFeatAcquisition(this,feat.system,feat.id)});
    return cls;
  }

  /**
   * Roll the class vitality die for one career level and store the result.
   * @param {number} index  zero-based index into the level progression (level 1 is always the maximum)
   */
  rollVitality(index) {return rollCareerVitality(this,index);}
  reviewVitality(index,options={}) {return reviewCareerVitality(this,index,options);}

  /** Remove the most recent career level. Deletes the class item when no levels remain. */
  async removeLastLevel() {
    if(this.type!=="agent"||!this.isOwner)return null;
    return queueResources([this],()=>this._removeLastLevel());
  }

  async _removeLastLevel() {
    const progression = [...this.system.progression];
    const last = progression.pop();
    if (!last) return;
    await this.update({ "system.progression": progression });
    if (!progression.some(p => p.classId === last.classId)) {
      const cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === last.classId);
      if (cls) await cls.delete();
    }
    await this.syncGrantedFeats();
  }

  async initializeStartingResources({keepCurrent=false}={}) {
    if(!this.isOwner||this.type!=="agent")return null;
    if(this.system.resourcesInitialized)return ui.notifications.warn("Starting resources have already been initialized; current earnings are preserved.");
    if(keepCurrent)return this.update({"system.resourcesInitialized":true});
    if(![0,2].includes(this.system.reputation)||![0,100000].includes(this.system.netWorth))return ui.notifications.warn("These values contain existing earnings. Use 'Keep current resources' to preserve them.");
    const freelance=this.system.affiliationType==="freelance";
    return this.update({"system.reputation":freelance?0:2,"system.netWorth":freelance?100000:0,"system.resourcesInitialized":true});
  }

  /** Feat names currently granted by origins and class levels → source label. */
  requiredGrants() {
    const out = new Map();
    for (const i of this.items) {
      if (i.type === "origin") for (const f of i.system.grants ?? []) out.set(f, i.name);
      if (i.type === "class") {
        const lvl = this.system.classLevels?.[i.system.identifier || i.name] ?? 0;
        for (const g of i.system.featGrants ?? []) if (g.level <= lvl) out.set(g.feat, `${i.name} ${g.level}`);
      }
    }
    return out;
  }

  /** Create/remove "granted" feat items so they match origins & class levels (calls are serialized). */
  syncGrantedFeats() {
    if (this.type !== "agent" || !this.isOwner) return Promise.resolve();
    this._grantSync = (this._grantSync ?? Promise.resolve()).then(() => this.#syncGrantedFeats()).catch(err => console.error(err));
    return this._grantSync;
  }

  /** Specific grants, including the chosen Basic Skill feat for mastery grants. */
  requiredGrantSpecs() {
    const specs = new Map();
    const add = spec => {
      const key = `${spec.name.trim().toLowerCase()}|${(spec.choice ?? "").trim().toLowerCase()}`;
      if (!specs.has(key) || spec.level < specs.get(key).level) specs.set(key, spec);
    };
    for (const item of this.items) {
      if (item.type === "origin") for (const name of item.system.grants ?? []) add({ name, source: item.name, level: 1 });
      if (item.type !== "class") continue;
      const id = item.system.identifier || item.name;
      for (const grant of item.system.featGrants ?? []) {
        let count = 0;
        for (const [index, entry] of this.system.progression.entries()) {
          if (entry.classId !== id) continue;
          if (++count < grant.level) continue;
          add({ name: grant.feat, choice: grant.choice ?? "", source: `${item.name} ${grant.level}`, level: index + 1 });
          break;
        }
      }
    }
    for(const grant of this.system.inheritedFeatureGrants??[])add(grant);
    return [...specs.values()];
  }

  async #syncGrantedFeats() {
    const required = this.requiredGrantSpecs();
    const norm = s => String(s ?? "").trim().toLowerCase();
    const feats = this.items.filter(i => i.type === "feat");
    const kept = new Set(), toCreate = [], toUpdate = [];
    const missing = [];
    for (const spec of required) {
      const copies = feats.filter(f => norm(f.name) === norm(spec.name)
        && f.system.featKind !== "temporary"
        && (!spec.choice || norm(f.system.choice) === norm(spec.choice)));
      const existing = copies.find(f => !f.system.granted) ?? copies[0];
      if (!existing) { missing.push(spec); continue; }
      kept.add(existing.id);
      if (existing.system.granted) {
        const update = { _id: existing.id };
        if (existing.system.acquiredAtLevel !== spec.level) update["system.acquiredAtLevel"] = spec.level;
        if (existing.system.grantSource !== spec.source) update["system.grantSource"] = spec.source;
        if (Object.keys(update).length > 1) toUpdate.push(update);
      }
    }
    if (missing.length) {
      const pack = game.packs.get(FEAT_PACK);
      const index = pack ? await pack.getIndex() : [];
      for (const spec of missing) {
        const entry = index.find?.(e => norm(e.name) === norm(spec.name));
        let data;
        if (entry) {
          const doc = await pack.getDocument(entry._id);
          data = doc.toObject();
          delete data._id;
        } else data = { name: spec.name, type: "feat", system: {} };
        Object.assign(data.system, { granted: true, grantSource: spec.source, acquiredAtLevel: spec.level });
        if (spec.choice) data.system.choice = spec.choice;
        toCreate.push(data);
      }
    }
    const toDelete = feats.filter(f => f.system.granted && f.system.featKind!=="temporary" && !kept.has(f.id)).map(f => f.id);
    if (toDelete.length) await this.deleteEmbeddedDocuments("Item", toDelete);
    if (toUpdate.length) await this.updateEmbeddedDocuments("Item", toUpdate);
    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
  }

  /** Prerequisite check for an arbitrary feat/class document against this actor. */
  checkPrerequisites(tree, { classEntry = false, temporary = false, acquisitionSource = "", featTree = "", manualConfirmed=false, excludeFeatId=null } = {}) {
    // Temporary feats only qualify temporary feats; virtual feats cannot qualify classes.
    const feats = this.items.filter(i => i.type === "feat" && i.id!==excludeFeatId
      && (temporary || i.system.featKind !== "temporary")
      && (!classEntry || i.system.featKind !== "virtual")
      && ((i.system.granted&&i.system.featKind!=="temporary") || this.system.featStatus?.[i.id]?.ok !== false));
    const virtual = classEntry ? [] : this.system.virtualFeats ?? [];
    const featNames = new Set([...feats.map(i => i.name.trim().toLowerCase()), ...virtual.map(f => f.name.trim().toLowerCase())]);
    const featTrees = {};
    for (const f of feats) featTrees[f.system.tree] = (featTrees[f.system.tree] ?? 0) + 1;
    for (const f of virtual) featTrees[f.tree] = (featTrees[f.tree] ?? 0) + 1;
    const skillRanks = Object.fromEntries(Object.entries(this.system.skillTotals ?? {}).map(([k, v]) => [k, v.ranks]));
    let contextSystem=this.system;
    const rebuild=classEntry||!temporary&&this.items.some(item=>item.type==="feat"&&item.system.featKind==="temporary")||excludeFeatId&&this.items.some(item=>item.id===excludeFeatId);
    if(rebuild){
      contextSystem=this.system.toObject?.()??foundry.utils.deepClone(this.system);
      contextSystem.usagePeriods=this.usagePeriods;Object.assign(contextSystem,this.attributeRuleContext);
      computeAgent(contextSystem,this.items.filter(item=>item.id!==excludeFeatId&&(item.type!=="feat"||((temporary||item.system.featKind!=="temporary")&&(!classEntry||item.system.featKind!=="virtual")))).map(item=>({id:item.id,name:item.name,type:item.type,system:item.system})),CONFIG.SPYCRAFT);
      featNames.clear();for(const key of Object.keys(featTrees))delete featTrees[key];
      for(const feat of feats.filter(feat=>(feat.system.granted&&feat.system.featKind!=="temporary")||contextSystem.featStatus?.[feat.id]?.ok)){featNames.add(feat.name.trim().toLowerCase());featTrees[feat.system.tree]=(featTrees[feat.system.tree]??0)+1;}
      for(const feat of classEntry?[]:contextSystem.virtualFeats??[]){featNames.add(feat.name.trim().toLowerCase());featTrees[feat.tree]=(featTrees[feat.tree]??0)+1;}
    }
    if(contextSystem.skillPurchaseIssues?.length)return {ok:false,unmet:contextSystem.skillPurchaseIssues.map(issue=>`Repair skill history: ${issue.message}`)};
    const ctx = prerequisiteContext(contextSystem, featNames, featTrees, rebuild?Object.fromEntries(Object.entries(contextSystem.skillTotals??{}).map(([key,skill])=>[key,skill.ranks])):skillRanks,{featTree:classEntry?'':featTree,featChoices:feats.filter(f=>!rebuild||(f.system.granted&&f.system.featKind!=='temporary')||contextSystem.featStatus?.[f.id]?.ok)});
    if(acquisitionSource&&!classEntry){
      const acquisition=featAcquisition({id:excludeFeatId??"__preview__",type:"feat",system:{acquisitionSource,tree:featTree,acquiredAtLevel:this.system.level}},this.system.featAcquisitionSources??[],this.items.filter(()=>true),{preview:true});
      if(!acquisition.ok)return {ok:false,unmet:[acquisition.reason]};
      ctx.prerequisiteLevel=acquisition.effectiveLevel;ctx.acquisitionLevel=this.system.level;
    }
    ctx.manualConfirmed=manualConfirmed;
    return checkPrerequisites(tree, ctx);
  }
}
