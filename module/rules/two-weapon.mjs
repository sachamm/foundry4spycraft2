import {twoWeaponStyleState} from './two-weapon-state.mjs';
import {validOwnCountClock} from './own-count-duration.mjs';
import {weaponGrip,possessionUnavailable} from './gear.mjs';
import {attributeActionBlock} from './attributes.mjs';
import {restraintActionBlock} from './restraints.mjs';
export function twoWeaponDeclarationPlan(system,combat,items,{weaponIds,extraAttacks=1,atStartOfInitiative=false,armedConfirmed=false}={}){
 if(!system.activeFeatNames?.includes('Two-Weapon Basics'))throw new Error('Two-Weapon Basics has not been earned.');
 if(![1,2].includes(extraAttacks)||extraAttacks===2&&!system.activeFeatNames.includes('Two-Weapon Mastery'))throw new Error('Choose one final attack with Basics, or two with earned Mastery.');
 if(!validOwnCountClock(combat)||!Number.isSafeInteger(combat.round+1)||combat.turn!==combat.ownTurnIndex||atStartOfInitiative!==true)throw new Error('Declare this choice at the start of your Initiative Count in a started combat.');
 const old=twoWeaponStyleState({...system,twoWeaponCombatContext:system.twoWeaponCombatContext??combat});if(old.active||old.needsReview)throw new Error(old.reason||'An accepted two-weapon tradeoff is already active for this full round.');
 const block=restraintActionBlock(system,{free:true})||attributeActionBlock(system,{kind:'attack'});if(block||system.wounds?.value<0||system.mentalLeapState?.unconscious)throw new Error(block||'This character cannot take the two-weapon declaration.');
 const refresh=system.refreshAction;if(refresh?.state==='waiting'&&refresh.combatId===combat.id&&refresh.startRound===combat.round)throw new Error('Refresh forfeited this round’s chance to act.');
 if(!Array.isArray(weaponIds)||weaponIds.length!==2||new Set(weaponIds).size!==2||armedConfirmed!==true)throw new Error('Confirm two distinct owned one-handed weapons readied at the start of this Count.');
 const pair=weaponIds.map(id=>items.find(i=>i.id===id));
 for(const item of pair){const s=item?.system;if(item?.type!=='weapon'||typeof s.proficiency!=='string'||!s.proficiency||s.equipped!==true||s.carried===false||s.reserve||s.destroyed||!Number.isSafeInteger(s.quantity??1)||(s.quantity??1)<1||possessionUnavailable(s))throw new Error('Both selected weapons must be actually readied, carried and available.');const grip=weaponGrip(system,s);if(grip.blocked||grip.required!==1||grip.hands!==1)throw new Error('This declaration requires two one-handed weapons each usable in one hand; Size and grip restrictions still apply.');}
 const proficiencies=pair.map(i=>i.system.proficiency);if(system.classLevels?.triggerman===10&&proficiencies.filter(p=>p==='handgun').length===1)throw new Error('Both Guns Blazing with a mixed weapon pair requires the pending scope ruling.');
 return {combatId:combat.id,combatantId:combat.combatantId,startRound:combat.round,dueRound:combat.round+1,weaponIds:[...weaponIds],weaponProficiencies:proficiencies,penalty:extraAttacks*2,extraAttacks,atStartOfInitiative:true,armedConfirmed:true};
}

/** Validate one already-granted free-action Standard Attack; the other weapon need not remain readied. */
export function twoWeaponFinalAttackPlan(system,combat,items,{weaponId,leastUsedConfirmed=false}={}){
 const state=twoWeaponStyleState({...system,twoWeaponCombatContext:combat}),record=system.twoWeaponStyle;
 if(!state.active||state.needsReview)throw new Error(state.reason||'No current two-weapon final attacks are granted.');
 if(!validOwnCountClock(combat)||combat.turn!==combat.ownTurnIndex||combat.round!==record.startRound)throw new Error('Take this free final attack during the declaring Initiative Count.');
 const block=restraintActionBlock(system,{free:true})||attributeActionBlock(system,{kind:'attack'});
 if(block||system.conditionContext?.sleeping||system.wounds?.value<0||system.mentalLeapState?.unconscious)throw new Error(block||'This character cannot attack.');
 if(system.refreshAction?.state==='waiting'&&system.refreshAction.combatId===combat.id&&system.refreshAction.startRound===combat.round)throw new Error('Refresh forfeited this round’s chance to act.');
 if(leastUsedConfirmed!==true||!record.weaponIds.includes(weaponId))throw new Error('The GC must confirm the least-used original weapon; choose either in a tie.');
 const item=items.find(i=>i.id===weaponId),w=item?.system;
 if(item?.type!=='weapon'||w.equipped!==true||w.carried===false||w.reserve||w.destroyed||!Number.isSafeInteger(w.quantity??1)||(w.quantity??1)<1||possessionUnavailable(w))throw new Error('The chosen original weapon must still be owned, readied and usable.');
 const grip=weaponGrip(system,w);if(grip.blocked)throw new Error(grip.reason||'The current weapon grip is unavailable.');
 return {declarationId:record.id,weaponId,extraAttacks:record.extraAttacks,combatId:combat.id,round:combat.round,combatantId:combat.combatantId,leastUsedConfirmed:true,attackAction:'standard',free:true};
}
