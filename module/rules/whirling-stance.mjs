import {combatStanceState} from './combat-stance.mjs';
/** p.452: an ordinary NPC's career level is current TL, not its Tier-adjusted statistic row. */
export function characterCareerLevel(type,system){const level=type==='npc'?system.threatLevel:type==='agent'?system.level:null;return Number.isSafeInteger(level)&&level>=1&&level<=20?level:null;}
/** p.179: a lower-level character cannot flank this defender; peers/higher levels retain ordinary rules. */
export function whirlingStancePlan(system,{flanked=false,attackerLevel=null}={}){
 if(typeof flanked!=='boolean')throw Error('Confirm whether the actual attacker otherwise flanks this character.');
 const stance=combatStanceState(system),active=stance?.key==='whirling',defenderLevel=active?characterCareerLevel('agent',system):null;
 if(active&&defenderLevel===null)throw Error('Review the Whirling Stance character’s actual career level.');
 if(active&&flanked&&(!Number.isSafeInteger(attackerLevel)||attackerLevel<1||attackerLevel>20))throw Error('Review this flanking attacker’s actual career level before applying Whirling Stance.');
 const prevented=active&&flanked&&attackerLevel<defenderLevel;
 return {version:1,stance:active?stance:null,defenderLevel,attackerLevel:active&&flanked?attackerLevel:null,declared:flanked,prevented,flanked:flanked&&!prevented};
}
