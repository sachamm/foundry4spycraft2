import {MANEUVER_SKILLS} from './maneuver-actions.mjs';
/** p.193. The target must see both the driver and vehicle for the Impress benefit. */
export function closedCoursePlan(system,key,check,{closedCourseSeesYou=false,closedCourseSeesVehicle=false}={}){
 const source='Professional Driver - Closed Course',active=system.activeFeatNames?.includes(source),maneuver=check.id==='maneuver'&&MANEUVER_SKILLS.includes(key),impress=key==='impress';
 if(!active||!maneuver&&!impress)return {synergies:[],evidence:null,notes:[]};
 const visible=closedCourseSeesYou===true&&closedCourseSeesVehicle===true,skills=maneuver?['impress']:visible?['acrobatics','drive']:[];
 return {synergies:skills.map(skill=>({skill,focusSkill:false,focus:'',condition:''})),evidence:{version:1,source,skillKey:key,checkId:check.id,targetSeesYou:impress&&closedCourseSeesYou===true,targetSeesVehicle:impress&&closedCourseSeesVehicle===true,synergyRanks:Object.fromEntries(skills.map(k=>[k,system.skillTotals?.[k]?.ranks??0]))},notes:[`${source}: ${maneuver?'Impress synergy is available for this Maneuver.':visible?'Acrobatics or Drive synergy is available; the target sees you and your vehicle.':'Acrobatics/Drive synergy requires the target to see both you and your vehicle.'} Apply the normal single highest synergy bonus (p.193).`]};
}
