/**
 * Checks that must hold both before and after the dice are rolled.
 * Each entry stops the roll by throwing. Entries that were not given their option do nothing.
 * Order is significant: the first failure is the one reported.
 *
 * To add one, register it from the module that owns the rule (or here, at the position it must run):
 *   rollPipeline.register({id: 'myRule', validate: ({actor, options, checkKind}) => validateMyRule(actor, options.myRule, {checkKind})});
 */
import {rollPipeline} from '../rules/roll-pipeline.mjs';
import {validateTrickSneakSource, validateAttackDamageProof} from '../apps/attack-damage-benefits.mjs';
import {validateCheapShotTarget} from '../apps/cheap-shot.mjs';
import {validateTripCounterProof} from '../apps/counter-trip.mjs';
import {validateSneakAttackTarget} from '../apps/damage-target.mjs';
import {validateDetectionObserverProof} from '../apps/detection-observer.mjs';
import {validateDrivingDamageProof} from '../apps/driving-stance.mjs';
import {validateFeintAttackBonusProof} from '../apps/feint-bonus.mjs';
import {validateFeintTarget} from '../apps/feint.mjs';
import {validateOldSchool} from '../apps/old-school.mjs';
import {validateSideStanceDamageProof} from '../apps/side-stance-damage.mjs';
import {validateSideStanceAttackProof} from '../apps/side-stance.mjs';
import {validateStrikingAttackProof} from '../apps/striking-stance.mjs';
import {validateTakedownSaveProof} from '../apps/takedown.mjs';
import {validateTargetSkillEffectProof} from '../apps/target-skill-effects.mjs';
import {validateTripAttackTarget} from '../apps/trip-attack.mjs';
import {validateTripFinalAttackProof} from '../apps/trip-final-attack.mjs';
import {validateTripDefenseTarget} from '../apps/trip.mjs';
import {validateWhirlingAttackProof} from '../apps/whirling-stance.mjs';
import {validateAccurizedWeaponProof} from '../rules/accurized-weapon.mjs';
import {validateAnalysisTaskRoll} from '../rules/analysis-tasks.mjs';
import {validateAttributeDamageProof} from '../rules/attribute-damage.mjs';
import {validateAxeDisarmProof} from '../rules/axe-disarm.mjs';
import {validateBalanceSurfaceProof} from '../rules/balance.mjs';
import {validateBugConcealmentProof} from '../rules/bug-basics.mjs';
import {validateBullRushAttackProof} from '../rules/bull-rush-attack.mjs';
import {validateBullRushDefenseProof} from '../rules/bull-rush.mjs';
import {validateBullseyeProof} from '../rules/bullseye.mjs';
import {validateCheapShotRecoveryProof} from '../rules/cheap-shot-effects.mjs';
import {validateCheapShotProof} from '../rules/cheap-shot.mjs';
import {validateCombatStanceProof} from '../rules/combat-stance.mjs';
import {validateConveyanceBullRushProof} from '../rules/conveyance-bull-rush.mjs';
import {validateCoverSaveSource} from '../rules/cover.mjs';
import {validateDamageSaveRoll} from '../rules/damage-saves.mjs';
import {validateDisarmResponseProof} from '../rules/disarm-response.mjs';
import {validateDocumentationProof} from '../rules/documentation.mjs';
import {validateFallDistanceProof} from '../rules/fall-distance.mjs';
import {validateFeintProof} from '../rules/feint.mjs';
import {validateFencingDisarmProof} from '../rules/fencing-disarm.mjs';
import {validateTrackingTaskProof} from '../rules/forensic-genius.mjs';
import {validateGrippingAttackProof} from '../rules/gripping-stance.mjs';
import {validateHideCircumstanceProof} from '../rules/hide-circumstances.mjs';
import {validateHideMovementProof} from '../rules/hide-movement.mjs';
import {validateMeleeArmorPiercingProof} from '../rules/melee-armor-piercing.mjs';
import {validateMeleeSkillFeatProof} from '../rules/melee-skill-feats.mjs';
import {validateMeleeTradeoffProof} from '../rules/melee-tradeoff.mjs';
import {validateMeleeTrickProof} from '../rules/melee-tricks.mjs';
import {validateMissTrickSources} from '../rules/miss-tricks.mjs';
import {validateQuirkyWeaponProof} from '../rules/quirky-weapon.mjs';
import {validateRankSynergyFeatProof} from '../rules/rank-synergy-feats.mjs';
import {validateReachWeaponProof} from '../rules/reach-weapon.mjs';
import {disarmMeleeSystemForCheck} from '../rules/readied-replacement.mjs';
import {validateStalkingStanceProof} from '../rules/stalking-stance.mjs';
import {validateStillStandingSaveProof} from '../rules/still-standing.mjs';
import {validateStoneColdProof} from '../rules/stone-cold.mjs';
import {validateSuperiorAccuracyWeaponProof} from '../rules/superior-accuracy-weapon.mjs';
import {validateTerrainSaveSource} from '../rules/terrain.mjs';
import {validateThreatenProof} from '../rules/threaten.mjs';
import {validateTrackingFeatProof} from '../rules/tracking.mjs';
import {validateTrainedOnlyWeaponProof} from '../rules/trained-only-weapon.mjs';
import {validateTripAttackProof} from '../rules/trip-attack.mjs';
import {validateTripDefenseProof} from '../rules/trip.mjs';
import {validateTumblePathProof} from '../rules/tumble.mjs';

const check = (id, validate) => rollPipeline.register({id, validate});

check('sneakAttackTarget', ({options}) =>
  validateSneakAttackTarget(options.sneakAttackTarget));
check('meleeArmorPiercing', ({actor, options, checkKind, weaponUuid, weaponProficiency, weaponQualities}) =>
  validateMeleeArmorPiercingProof(actor, options.meleeArmorPiercing, {checkKind, weaponUuid, weaponProficiency, weaponQualities, attackContext: options.attackContext, grantedQuality: options.attackDamageBenefit?.grantedQuality, rerollOf: options.rerollOf}));
check('drivingDamage', ({actor, options, checkKind, checkId, checkMethod, formula, data, weaponUuid}) =>
  validateDrivingDamageProof(actor, options.drivingStance, {checkKind, checkId, checkMethod, formula, data, weaponUuid, lease: options.drivingStanceLease, rerollOf: options.rerollOf}));
check('takedownSave', ({actor, options, checkKind, checkId, checkMethod}) =>
  validateTakedownSaveProof(actor, options.takedown, {checkKind, checkId, checkMethod, lease: options.takedownLease, rerollOf: options.rerollOf}));
check('sideStanceDamage', ({actor, options, checkKind, weaponUuid}) =>
  validateSideStanceDamageProof(actor, options.sideStanceDamage, {checkKind, weaponUuid, sneakAttack: options.sneakAttack, lease: options.sideStanceDamageLease, rerollOf: options.rerollOf}));
check('tripFinalAttack', ({actor, options, checkKind, weaponUuid}) =>
  validateTripFinalAttackProof(actor, options.finalAttack, {checkKind, weaponUuid, attackContext: options.attackContext, lease: options.tripFinalLease, rerollOf: options.rerollOf}));
check('strikingAttack', ({actor, options, checkKind, formula, data, weaponUuid}) =>
  validateStrikingAttackProof(actor, options.finalAttack, {checkKind, weaponUuid, attackContext: options.attackContext, lease: options.strikingLease, rerollOf: options.rerollOf, formula, data}));
check('callbackFinalAttack', async ({options}) =>
  options.validateFinalAttack?.());
check('callbackAttackContext', async ({options}) =>
  options.validateAttackContext?.());
check('trickSneakSource', ({options}) =>
  validateTrickSneakSource(options.attackDamageBenefit, options.sneakAttack));
check('attackDamage', ({actor, options, checkKind, weaponUuid, weaponProficiency, weaponQualities}) =>
  validateAttackDamageProof(actor, options.attackDamageBenefit, {checkKind, weaponUuid, lease: options.attackDamageLease, weaponProficiency, weaponQualities, rerollOf: options.rerollOf}));
check('meleeTrick', ({actor, options, checkKind, weaponUuid, weaponProficiency, weaponQualities}) =>
  validateMeleeTrickProof(actor, options.attackContext?.meleeTrick, {checkKind, weaponUuid, weaponProficiency, attackContext: options.attackContext, rerollOf: options.rerollOf, finalAttack: options.finalAttack, weaponQualities}));
check('bullseye', ({actor, options, checkKind, weaponUuid, weaponProficiency}) =>
  validateBullseyeProof(actor, options.attackContext?.bullseye, {checkKind, weaponUuid, weaponProficiency, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('meleeTradeoff', ({actor, options, checkKind, weaponUuid, weaponProficiency}) =>
  validateMeleeTradeoffProof(actor, options.attackContext?.meleeTradeoff, {checkKind, weaponUuid, weaponProficiency, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('grippingAttack', ({actor, options, checkKind, weaponUuid}) =>
  validateGrippingAttackProof(actor, options.attackContext?.grippingStance, {checkKind, weaponUuid, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('combatStance', ({actor, options, checkKind}) =>
  validateCombatStanceProof(actor, options.attackContext?.combatStance, {checkKind, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('feintTarget', ({actor, options}) =>
  validateFeintTarget(actor, options.feint));
check('sideStanceAttack', ({actor, options, checkKind}) =>
  validateSideStanceAttackProof(actor, options.attackContext?.sideStance, {checkKind, attackContext: options.attackContext, lease: options.sideStanceLease, rerollOf: options.rerollOf, finalAttack: options.finalAttack}));
check('feintAttackBonus', ({actor, options, checkKind}) =>
  validateFeintAttackBonusProof(actor, options.attackContext?.feintBonus, {checkKind, attackContext: options.attackContext, lease: options.feintBonusLease, rerollOf: options.rerollOf, finalAttack: options.finalAttack}));
check('callbackCQBRange', async ({options}) =>
  options.validateCQBRange?.());
check('analysisTaskRoll', ({actor, options, checkKind, checkId, skillKey}) =>
  validateAnalysisTaskRoll(actor.system, options.analysisTask, {now: game.time?.worldTime ?? null, checkKind, skillKey, checkId, inCombat: !!actor.participatingCombat}));
check('attributeDamage', ({actor, checkKind, attributeDamage}) =>
  validateAttributeDamageProof(actor.system, attributeDamage, {checkKind}));
check('targetSkillEffect', ({options, checkKind, checkId, skillKey}) =>
  validateTargetSkillEffectProof(options.targetSkillEffect, {checkKind, skillKey, checkId}));
check('detectionObserver', ({options, checkKind, checkId, checkMethod, skillKey}) =>
  validateDetectionObserverProof(options.detectionObserver, {checkKind, skillKey, checkId, checkMethod}));
check('reachWeapon', ({actor, options, checkKind}) =>
  validateReachWeaponProof(actor, options.attackContext?.reach, {checkKind, weaponProficiency: options.weaponProficiency, weaponUuid: options.weaponUuid, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('trainedOnlyWeapon', ({actor, options, checkKind}) =>
  validateTrainedOnlyWeaponProof(actor, options.attackContext?.trainedOnly, {checkKind, weaponProficiency: options.weaponProficiency, weaponUuid: options.weaponUuid, attackContext: options.attackContext}));
check('accurizedWeapon', ({actor, options, checkKind}) =>
  validateAccurizedWeaponProof(actor, options.attackContext?.accurized, {checkKind, weaponProficiency: options.weaponProficiency, weaponUuid: options.weaponUuid, attackContext: options.attackContext}));
check('missTrickSources', ({actor, options, checkKind}) =>
  validateMissTrickSources(actor, options.attackContext?.missTrickSources, {checkKind, weaponUuid: options.weaponUuid, weaponProficiency: options.weaponProficiency, attackContext: options.attackContext, rerollOf: options.rerollOf, combat: actor.mentalLeapCombatContext()}));
check('cheapShotTarget', ({actor, options}) =>
  validateCheapShotTarget(actor, options.attackContext?.cheapShot, {targetUuid: options.attackContext?.characterTarget?.actorUuid || options.finalAttack?.opponentUuid || options.finalAttack?.targetUuid}));
check('cheapShot', ({actor, options, checkKind}) =>
  validateCheapShotProof(actor, options.attackContext?.cheapShot, {checkKind, weaponUuid: options.weaponUuid, weaponProficiency: options.weaponProficiency, attackContext: options.attackContext, rerollOf: options.rerollOf, combat: actor.mentalLeapCombatContext(), finalAttack: !!(options.finalAttack || options.twoWeaponFinalAttack)}));
check('fencingDisarm', ({actor, options, checkKind}) =>
  validateFencingDisarmProof(actor, options.attackContext?.disarm, {checkKind, weaponProficiency: options.weaponProficiency, rerollOf: options.rerollOf}));
check('disarmResponse', ({actor, options, checkKind}) =>
  validateDisarmResponseProof(actor, options.attackContext?.disarm, {checkKind, weaponProficiency: options.weaponProficiency, weaponUuid: options.weaponUuid, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('quirkyWeapon', ({actor, options, checkKind}) =>
  validateQuirkyWeaponProof(actor, options.attackContext?.quirky, {checkKind, weaponProficiency: options.weaponProficiency, weaponUuid: options.weaponUuid, attackContext: options.attackContext}));
check('superiorAccuracyWeapon', ({actor, options, checkKind}) =>
  validateSuperiorAccuracyWeaponProof(actor, options.attackContext?.superiorAccuracy, {checkKind, weaponProficiency: options.weaponProficiency, weaponUuid: options.weaponUuid, attackContext: options.attackContext}));
check('axeDisarm', ({actor, options, checkKind}) =>
  validateAxeDisarmProof(options.rerollOf ? disarmMeleeSystemForCheck(actor, options) : actor.system, options.attackContext?.disarm, {checkKind, weaponProficiency: options.weaponProficiency, rerollOf: options.rerollOf}));
check('whirlingAttack', ({actor, options, checkKind}) =>
  validateWhirlingAttackProof(actor, options.attackContext?.flanking?.whirling, {checkKind, attackContext: options.attackContext, rerollOf: options.rerollOf}));
check('whirlingSneakAttack', ({actor, options, checkKind}) =>
  validateWhirlingAttackProof(actor, options.sneakAttack?.whirling, {checkKind, attackContext: {targetFlanked: true, targetActorUuid: options.sneakAttackTarget?.actorUuid}, rerollOf: options.rerollOf, sneakAttack: options.sneakAttack}));
check('meleeSkillFeat', ({actor, options, checkKind, checkId, skillKey}) =>
  validateMeleeSkillFeatProof(actor.system, options.meleeSkillFeats, {checkKind, skillKey, checkId}));
check('stalkingStance', ({actor, options, checkKind, checkId, skillKey}) =>
  validateStalkingStanceProof(actor, options.stalkingStance, {checkKind, skillKey, checkId, rerollOf: options.rerollOf}));
check('conveyanceBullRush', ({actor, options, checkKind, checkId, checkMethod, skillKey, ability}) =>
  validateConveyanceBullRushProof(actor.system, options.conveyanceBullRush, {checkKind, skillKey, checkId, checkMethod, ability, attributeSubstitution: options.attributeSubstitution, combat: actor.mentalLeapCombatContext()}));
check('bullRushAttack', ({actor, options, checkKind, checkId, checkMethod, skillKey, ability}) =>
  validateBullRushAttackProof(actor.system, options.bullRushAttack, {checkKind, skillKey, checkId, checkMethod, ability, attributeSubstitution: options.attributeSubstitution, combat: actor.mentalLeapCombatContext()}));
check('bullRushDefense', ({actor, options, checkKind, checkId, checkMethod, skillKey, ability}) =>
  validateBullRushDefenseProof(actor.system, options.bullRushDefense, {checkKind, skillKey, checkId, checkMethod, ability, attributeSubstitution: options.attributeSubstitution}));
check('stillStandingSave', ({actor, options, checkKind, checkId}) =>
  validateStillStandingSaveProof(actor.system, options.stillStandingSave, {checkKind, checkId}));
check('tumblePath', ({actor, options, checkKind, checkId, checkMethod, skillKey}) =>
  validateTumblePathProof(actor.system, options.tumblePath, {checkKind, skillKey, checkId, checkMethod}));
check('feint', ({actor, options, checkKind, checkId, checkMethod, skillKey, ability}) =>
  validateFeintProof(actor, options.feint, {checkKind, skillKey, checkId, checkMethod, ability, attributeSubstitution: options.attributeSubstitution, combat: actor.mentalLeapCombatContext()}));
check('tripAttack', ({actor, options, checkKind, checkId, checkMethod, skillKey, ability}) =>
  validateTripAttackProof(actor.system, options.tripAttack, {checkKind, skillKey, checkId, checkMethod, ability, attributeSubstitution: options.attributeSubstitution, combat: actor.mentalLeapCombatContext()}));
check('tripCounter', ({actor, options, checkKind, checkId, skillKey}) =>
  validateTripCounterProof(actor, options.tripAttack, {checkKind, skillKey, checkId, lease: options.tripCounterLease, rerollOf: options.rerollOf}));
check('tripAttackTarget', ({actor, options}) =>
  validateTripAttackTarget(actor, options.tripAttack));
check('tripDefense', ({actor, options, checkKind, checkId, checkMethod, skillKey, ability}) =>
  validateTripDefenseProof(actor.system, options.tripDefense, {checkKind, skillKey, checkId, checkMethod, ability, attributeSubstitution: options.attributeSubstitution, combat: actor.mentalLeapCombatContext()}));
check('tripDefenseTarget', ({actor, options}) =>
  validateTripDefenseTarget(actor, options.tripDefense));
check('fallDistance', ({actor, options, checkKind, checkId, skillKey}) =>
  validateFallDistanceProof(actor.system, options.fallDistance, {checkKind, skillKey, checkId}));
check('balanceSurface', ({actor, options, checkKind, checkId, skillKey}) =>
  validateBalanceSurfaceProof(actor.system, options.balanceSurface, {checkKind, skillKey, checkId}));
check('hideCircumstance', ({actor, options, checkKind, checkId, skillKey, ability}) =>
  validateHideCircumstanceProof(actor.system, options.hideCircumstances, {checkKind, skillKey, checkId, ability, attributeSubstitution: options.attributeSubstitution}));
check('hideMovement', ({actor, options, checkKind, checkId, checkMethod, skillKey}) =>
  validateHideMovementProof(actor.system, options.hideMovement, {checkKind, skillKey, checkId, checkMethod, actor, rerollOf: options.rerollOf, stanceCombat: actor.mentalLeapCombatContext()}));
check('rankSynergyFeat', ({actor, options, checkKind, checkId, skillKey}) =>
  validateRankSynergyFeatProof(actor.system, options.rankSynergyFeats, {checkKind, skillKey, checkId}));
check('stoneCold', ({actor, options, checkKind, checkId, skillKey}) =>
  validateStoneColdProof(actor.system, options.stoneCold, {checkKind, skillKey, checkId, combat: actor.mentalLeapCombatContext()}));
check('threaten', ({actor, options, checkKind, checkId, checkMethod, skillKey}) =>
  validateThreatenProof(actor.system, options.threaten, {checkKind, skillKey, checkId, checkMethod, combat: actor.mentalLeapCombatContext()}));
check('bugConcealment', ({actor, options, checkKind, checkId, skillKey}) =>
  validateBugConcealmentProof(actor.system, options.bugConcealment, {checkKind, skillKey, checkId}));
check('documentation', ({actor, options, checkKind, checkId, skillKey}) =>
  validateDocumentationProof(actor.system, options.documentation, {checkKind, skillKey, checkId}));
check('trackingFeat', ({actor, options, checkKind, checkId, checkMethod, skillKey}) =>
  validateTrackingFeatProof(actor.system, options.trackingFeat, {checkKind, skillKey, checkId, checkMethod}));
check('trackingTask', ({actor, options, checkKind, checkId, skillKey}) =>
  validateTrackingTaskProof(actor.system, options.trackingMasteryTask, {checkKind, skillKey, checkId}));
check('cheapShotRecovery', ({actor, options, checkKind, checkId, checkMethod}) =>
  validateCheapShotRecoveryProof(actor, options.cheapShotRecovery, {checkKind, checkId, checkMethod}));
check('callbackCheapShotRecovery', async ({options}) =>
  options.validateCheapShotRecovery?.());
check('callbackSkillContext', async ({options}) =>
  options.validateSkillContext?.());
check('callbackRerollContext', async ({options}) =>
  options.validateRerollContext?.());
check('oldSchool', ({actor, oldSchoolScope, oldSchool}) =>
  validateOldSchool(actor, oldSchoolScope, oldSchool));
check('damageSaveRoll', ({actor, options, checkKind, checkId}) =>
  validateDamageSaveRoll(actor, options.damageSave, checkKind, checkId));
check('callbackDamageSave', async ({options}) =>
  options.validateDamageSave?.());
check('coverSaveSource', ({actor, options, checkKind, checkId}) =>
  validateCoverSaveSource(actor.system, options.coverSave, {checkKind, checkId}));
check('terrainSaveSource', ({actor, options, checkKind, checkId}) =>
  validateTerrainSaveSource(actor.system, options.terrainSaveSource, {checkKind, checkId}));
check('callbackSaveContext', async ({options}) =>
  options.validateSaveContext?.());
