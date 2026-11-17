import {whirlingStancePlan} from './whirling-stance.mjs';
import {sharpshooterDefensePlan} from './sharpshooter.mjs';
import {guardDefensePlan} from './guard.mjs';
import {greatSwordDefensePlan} from './great-sword-defense.mjs';
import {totalDefenseState} from './total-defense.mjs';
import {coverPlan} from './cover.mjs';
import {circlingDefensePlan} from './knife-basics.mjs';
import {knownSneakAttackImmunity} from './sneak-attack.mjs';
import {attributeCollapsePlan,attributeDefensePlan} from './attributes.mjs';
/** pp.29,33,37–38,84: combine legacy grades, capped by the highest class offering. */
export function uncannyDodgePlan(system){
 const sources=[];
 for(const classId of ['explorer','intruder','triggerman']){
  const level=system.classLevels?.[classId]??0,maxGrade=classId==='triggerman'?2:5;
  if(Number.isSafeInteger(level)&&level>0)sources.push({classId,grade:Math.min(maxGrade,Math.floor(level/4)),maxGrade});
 }
 for(const entry of system.inheritedClassChoices??[])if(['Explorer: Uncanny dodge I','Intruder: Uncanny dodge I'].includes(entry.name))sources.push({classId:entry.ownerClass??entry.ownerId,grade:1,maxGrade:1,borrowed:true});
 const grade=Math.min(Math.max(0,...sources.map(s=>s.maxGrade)),sources.reduce((n,s)=>n+s.grade,0));
 return {grade,sources,retainDexterity:grade>=1,cannotBeFlanked:grade>=2,securityBonus:grade>=3?4:0,halveIncomingInitiative:grade>=4,cannotBeFlatFooted:grade>=5};
}
export function initiativeLossPlan(system,{loss,selfInflicted=false}={}){
 if(!Number.isSafeInteger(loss)||loss<0||typeof selfInflicted!=='boolean')throw new Error('Enter a nonnegative whole Initiative Count loss and declare whether it comes from your own action.');
 const uncanny=uncannyDodgePlan(system),halved=uncanny.halveIncomingInitiative&&!selfInflicted;
 return {listedLoss:loss,selfInflicted,halved,loss:halved?Math.floor(loss/2):loss,grade:uncanny.grade};
}
/** Read-only incoming-attack context. Does not resolve attacks, damage or Coup de Grace. */
export function incomingDefensePlan(system,options={}){
 const {flatFooted=false,invisibleAttacker=false,flanked=false,securityDevice=false,adjacent=false,withinMeleeRange=false,ranged=false,coupDeGraceException=false,coupDeGraceExceptionSource=''}=options;
 const whirling=whirlingStancePlan(system,{flanked:flanked&&!uncannyDodgePlan(system).cannotBeFlanked,attackerLevel:options.whirlingAttackerLevel??null});
 const totalDefense=totalDefenseState(system);if(totalDefense.needsReview)throw new Error(totalDefense.reason);
 if([flatFooted,invisibleAttacker,flanked,securityDevice,adjacent,withinMeleeRange,ranged,coupDeGraceException].some(v=>typeof v!=='boolean'))throw new Error('Declare each incoming-attack circumstance.');
 if(coupDeGraceException&&(typeof coupDeGraceExceptionSource!=='string'||!coupDeGraceExceptionSource.trim()||coupDeGraceExceptionSource.length>500))throw new Error('Name the actual character option permitting Coup de Grace without helplessness.');
 if(!Number.isFinite(system.defense?.total)||!Number.isFinite(system.abilities?.dex?.mod))throw new Error('Prepare the character Defense before checking an attack.');
 const uncanny=uncannyDodgePlan(system),manual=system.conditionContext??{},collapse=system.attributeCollapse??attributeCollapsePlan(system);
 const state=attributeDefensePlan({...system,uncannyDodge:uncanny,conditionContext:{...manual,flatFooted:manual.flatFooted||flatFooted}});
 const vulnerable=state.vulnerable||invisibleAttacker,dexterity=state.vulnerable?state.dexterity:invisibleAttacker&&!uncanny.retainDexterity?Math.min(0,system.abilities.dex.mod):system.abilities.dex.mod;
 const dodgeLost=vulnerable?system.defense.dodgeBonuses??0:0;
 const securityBonus=securityDevice?uncanny.securityBonus:0;
 const triggerman=system.classLevels?.triggerman??0,eyeOfStorm=adjacent&&triggerman>=4?3:0;
 const extraDodge=vulnerable?0:eyeOfStorm;
 const circling=circlingDefensePlan({...options.circling,ranged,dodgeBonus:vulnerable?0:(system.defense.dodgeBonuses??0)+extraDodge});
 const cover=coverPlan({...options.cover,defenderSystem:system,ranged});
 const sharpshooter=sharpshooterDefensePlan(system,{...options.cover,ranged}),greatSword=greatSwordDefensePlan(system,{ranged}),guard=guardDefensePlan(system,{ranged});
 const total=-circling.dodgeReduction-sharpshooter.sizeReduction+guard.bonus+greatSword.increment+cover.defenseBonus+system.defense.total+(system.defense.dodgeLost??0)-(system.defense.dexterity??system.abilities.dex.mod)+dexterity-dodgeLost+securityBonus+extraDodge;
 const restrictedException=manual.held||manual.pinned||manual.paralyzed||manual.unconscious||system.mentalLeapState?.unconscious||collapse.conditions.some(c=>['Paralyzed','Unconscious'].includes(c));
 const pinnedAttackerBonus=manual.pinned===true&&adjacent&&!ranged?4:0;
 const crouchedAttackerPenalty=manual.crouched===true&&ranged&&!adjacent?-1:0,proneAttackerPenalty=manual.prone===true&&ranged&&!adjacent?-2:0;
 return {circling,whirling,sharpshooter,guard,greatSword,cover,armorMasteryRequiresHelpless:system.armorFeatRules?.coupDeGraceRequiresHelpless===true,sneakAttackImmune:knownSneakAttackImmunity(system).immune,listedDR:system.armorDRByAttack??null,coupDeGraceException,coupDeGraceExceptionSource:coupDeGraceException?coupDeGraceExceptionSource.trim():'',pinnedAttackerBonus,proneAttackerPenalty,crouchedAttackerPenalty,total,dexterity,dodgeLost,securityBonus,eyeOfStorm:extraDodge,vulnerable,helpless:state.helpless,flatFooted:!!(manual.flatFooted||flatFooted)&&!uncanny.cannotBeFlatFooted,flanked:whirling.flanked&&!uncanny.cannotBeFlanked,
  blindedAttackerBonus:(manual.blinded===true||manual.sleeping===true)?2:0,helplessAttackerBonus:state.helpless&&(withinMeleeRange||adjacent)?4:0,attackerBonus:pinnedAttackerBonus+proneAttackerPenalty+crouchedAttackerPenalty+((manual.blinded===true||manual.sleeping===true)?2:0)+(state.helpless&&(withinMeleeRange||adjacent)?4:0),coupDeGraceEligible:adjacent&&(state.helpless||coupDeGraceException)&&(uncanny.grade<5||!!restrictedException)&&(!system.armorFeatRules?.coupDeGraceRequiresHelpless||state.helpless),uncanny,
  notes:[...(whirling.stance?[`Whirling Stance: career level ${whirling.defenderLevel}; ${whirling.declared?'this attacker level '+whirling.attackerLevel+(whirling.prevented?' cannot flank you.':' retains ordinary flanking eligibility.'):'review the actual attacker’s career level if flanking is declared.'} No unconditional Defense bonus (p.179).`]:[]),...(circling.stance?[circling.active?`Circling Stance: this melee attacker has an unoccupied adjacent square, so your dodge bonus to Defense +${circling.originalDodgeBonus} becomes +${circling.retainedDodgeBonus}, rounded up, against this attack (p.179).`:`Circling Stance: no reduction (${circling.unoccupiedAdjacentConfirmed?'no positive dodge bonus applies to this attack':'no unoccupied square adjacent to the attacker was confirmed'}) (p.179).`]:[]),...(sharpshooter.active?[`Sharpshooter Basics: target Size Defense bonus +${sharpshooter.originalSizeBonus} becomes +${sharpshooter.retainedSizeBonus}, rounded down, against this ranged attack (p.182).`]:[]),...(guard.bonus?[`Guard (GAR): +${guard.bonus} Defense against this melee/unarmed attack from ${guard.weapons.map(w=>w.name+' (+'+w.bonus+')').join(', ')}; both readied weapons stack with actual appropriate proficiency (p.301). This is separate from gear and dodge bonuses.`]:[]),...(greatSword.source?[`Great Sword Basics: +2 gear Defense against this melee attack; existing gear bonus +${greatSword.existingGearBonus}, additional Defense +${greatSword.increment} (pp.179,329). This is not a dodge bonus.`]:[]),'Pinned grants adjacent unarmed/melee attackers +4; Held alone grants no such bonus (p.342).','The helpless-target +4 applies only within Melee Range. Coup de Grace normally requires an adjacent helpless opponent and its normal full action/shot; other character options require their actual exceptions. This check does not resolve the attack.',...(system.armorFeatRules?.coupDeGraceRequiresHelpless?['Armor Mastery prevents other character options from permitting Coup de Grace against a non-helpless wearer.']:[]),'Invisible-attacker blindness also affects vision checks and other attack effects; those are separate from this Defense calculation.']};
}

/** pp.29,37,83: Evasion's separate legacy progression. */
export function evasionPlan(system){
 const sources=[],intruder=system.classLevels?.intruder??0,transporter=system.classLevels?.transporter??0;
 if(Number.isSafeInteger(intruder)&&intruder>0)sources.push({classId:'intruder',grade:intruder>=19?3:intruder>=11?2:intruder>=2?1:0,maxGrade:3});
 if(Number.isSafeInteger(transporter)&&transporter>0)sources.push({classId:'transporter',grade:transporter>=6?1:0,maxGrade:1});
 for(const entry of system.inheritedClassChoices??[])if(entry.name==='Intruder: Evasion I')sources.push({classId:entry.ownerClass??entry.ownerId,grade:1,maxGrade:1,borrowed:true});
 const grade=Math.min(Math.max(0,...sources.map(s=>s.maxGrade)),sources.reduce((n,s)=>n+s.grade,0));
 return {grade,sources,canTake10:grade>=3};
}
export function evasionSaveContext(system,{flatFooted=false,reflexReducesDamage=false}={}){
 if(typeof flatFooted!=='boolean'||typeof reflexReducesDamage!=='boolean')throw new Error('Declare flat-footedness and whether this Reflex save can reduce damage.');
 return {version:1,grade:evasionPlan(system).grade,flatFooted:!uncannyDodgePlan(system).cannotBeFlatFooted&&(flatFooted||system.conditionContext?.flatFooted===true),reflexReducesDamage};
}
/** Evasion adjustment only: apply other damage reductions and health settlement separately. */
export function reflexDamagePlan(check,{damage,normalSuccessDamage,succeeded=check.successConfirmed,confirmed=false}={}){
 const context=check.evasionContext;
 if(check.checkKind!=='save'||check.checkId!=='ref'||check.superseded||!context||context.version!==1||!Number.isSafeInteger(context.grade)||context.grade<0||context.grade>3||typeof context.flatFooted!=='boolean'||typeof context.reflexReducesDamage!=='boolean')throw new Error('Choose an original Reflex save with its recorded Evasion context.');
 if(confirmed!==true||typeof succeeded!=='boolean')throw new Error('The GC must confirm the source damage, ordinary successful-save damage and outcome.');
 if(typeof check.successConfirmed==='boolean'&&succeeded!==check.successConfirmed)throw new Error('The save outcome changed; use its currently confirmed outcome.');
 if(!Number.isSafeInteger(damage)||damage<0||!Number.isSafeInteger(normalSuccessDamage)||normalSuccessDamage<0||normalSuccessDamage>damage)throw new Error('Enter whole source damage and ordinary successful-save damage between zero and the source damage.');
 const ordinary=succeeded?normalSuccessDamage:damage,eligible=context.reflexReducesDamage&&!context.flatFooted&&context.grade>=1;
 const evaded=eligible&&succeeded,halved=eligible&&!succeeded&&context.grade>=2;
 const total=evaded?0:halved?Math.floor(damage/2):ordinary;
 return {damage,normalSuccessDamage,succeeded,ordinary,total,evaded,halved,eligible,context:{...context}};
}
