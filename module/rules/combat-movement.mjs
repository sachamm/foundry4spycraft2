import {attributeActionBlock} from './attributes.mjs';
import {restraintActionBlock} from './restraints.mjs';
/** Movement actions pp.326,348,359,361; Combat Mobility/Mobile Defense pp.172,175. */
export function combatMovementRules(system){
 const mobility=system.activeFeatNames?.includes('Combat Mobility')===true,mobileDefense=system.activeFeatNames?.includes('Mobile Defense')===true;
 const fullArmor=(system.armor?.adjustments??[]).some(row=>row.slot==='body'&&row.type==='F');
 const speed=Number.isFinite(system.speed)&&system.speed>=0?system.speed:null;
 return {mobility,mobileDefense,fullArmor,speed,standardMoveFeet:speed,totalDefenseMoveFeet:speed===null?null:speed*(mobility?2:1),runMultiplier:fullArmor?3:4,runFeet:speed===null?null:speed*(fullArmor?3:4),maximumRunTurns:mobility?Math.max(1,system.abilities?.dex?.mod??0):0,maximumRunTurnDegrees:mobility?90:0,runFlatFooted:!mobileDefense&&system.uncannyDodge?.cannotBeFlatFooted!==true};
}
export function combatMovementPlan(system,{action='standardMove',distanceFeet,turnDegrees=[],adjacentThreateningOpponent=false,passesThreateningAdjacency=false,routeConfirmed=false}={}){
 if(!['standardMove','run','totalDefense'].includes(action))throw new Error('Choose Standard Move, Run or Total Defense.');
 if([adjacentThreateningOpponent,passesThreateningAdjacency,routeConfirmed].some(v=>typeof v!=='boolean'))throw new Error('Confirm each movement circumstance.');
 if(routeConfirmed!==true)throw new Error('The GC must confirm the route, counted distance, terrain and threatening-opponent circumstances.');
 const block=restraintActionBlock(system)||attributeActionBlock(system,{kind:'skill',ability:'dex'});if(block||system.wounds?.value<0)throw new Error(block||'This character cannot take a movement action.');
 const rules=combatMovementRules(system);if(rules.speed===null||system.conditionSpeedReview)throw new Error('Resolve the character’s current Speed before checking movement.');
 if(!Number.isFinite(distanceFeet)||distanceFeet<0)throw new Error('Enter a nonnegative counted movement distance in feet.');
 if(!Array.isArray(turnDegrees)||turnDegrees.some(d=>!Number.isFinite(d)||d<0||d>180))throw new Error('Enter each actual direction change as an angle from 0 to 180 degrees.');
 if(adjacentThreateningOpponent&&!(action==='standardMove'&&rules.mobility))throw new Error('While adjacent to a threatening opponent, use Withdraw or an actual movement exception (p.326). Combat Mobility permits Standard Move away.');
 if(passesThreateningAdjacency)throw new Error('Stop upon entering adjacency with a threatening opponent (p.326); Combat Mobility does not remove this stopping rule.');
 if(action==='run'&&system.canRun!==true)throw new Error('This character cannot Run in the current condition.');
 if((action==='standardMove'||distanceFeet>0&&action==='totalDefense')&&system.postureMovement?.standardMove===false)throw new Error('The current posture or immobility prevents Standard Move movement.');
 const maximumFeet=action==='run'?rules.runFeet:action==='totalDefense'?rules.totalDefenseMoveFeet:rules.standardMoveFeet;
 if(distanceFeet>maximumFeet)throw new Error('The declared counted distance exceeds this action’s '+maximumFeet+' ft. allowance.');
 const turns=turnDegrees.filter(d=>d>0);if(action==='run'&&(turns.length>rules.maximumRunTurns||turns.some(d=>d>rules.maximumRunTurnDegrees)))throw new Error('Run permits '+rules.maximumRunTurns+' direction change(s), each at most '+rules.maximumRunTurnDegrees+' degrees.');
 return {...rules,action,distanceFeet,turnDegrees:[...turnDegrees],maximumFeet,actionCost:action==='standardMove'?'1 half action':'1 full action',errorIncrease:action==='run'?1:0,becomesFlatFooted:action==='run'&&rules.runFlatFooted,dodgeBonus:action==='totalDefense'?4:0,routeConfirmed,notes:['Count every other diagonal square as 10 ft.; include terrain and other movement costs in the declared distance (pp.325–326).','Threatening adjacency excludes bound, flat-footed, helpless, hidden, invisible, stunned, unconscious and dead opponents (p.326).',...(action==='totalDefense'?['Total Defense grants +4 dodge Defense for 1 full round and one Standard Move; Combat Mobility doubles only that movement allowance.']:[]),...(action==='run'?['Run is a full action with error range +1; full armor reduces its distance multiplier to 3.']:[]),'This checks the declared route and action allowance. Move the token, spend the action and resolve its condition/Defense effects at the table.']};
}
