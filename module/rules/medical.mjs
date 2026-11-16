/** Named Medicine combat restrictions, pp.141–143; Bandage's error-range benefit, p.172. */
export function medicalSkillPlan(system,key,check,{inCombat=false,combatInSight=false,complexTaskNearby=false,dramaticConflictNearby=false,inComplexTask=false,inDramaticConflict=false}={}){
 if(key!=='medicine')return {applicable:false,errorIncrease:0,blockedReason:'',notes:[]};
 const bandage=system.activeFeatNames?.includes('Bandage')===true,activeCombat=inCombat===true,surgeryCombat=check.id==='surgery'&&combatInSight===true;
 const errorIncrease=['first-aid','stabilize'].includes(check.id)&&activeCombat?(bandage?1:2):surgeryCombat?(bandage?3:6):0;
 const nearbyTask=complexTaskNearby===true||inComplexTask===true,nearbyConflict=dramaticConflictNearby===true||inDramaticConflict===true,blockedReason=check.id==='therapy'&&(activeCombat||nearbyTask||nearbyConflict)?'Therapy cannot occur during combat or while anyone performs a Complex Task or Dramatic Conflict in your presence (p.143).':'';
 const notes=errorIncrease?[`Medicine combat error increase +${errorIncrease}${bandage?' (Bandage halves the normal increase)':''}${surgeryCombat?'; combat occurred within line of sight during Surgery':''}.`]:[];
 return {applicable:true,inCombat:activeCombat,combatInSight:combatInSight===true,complexTaskNearby:nearbyTask,dramaticConflictNearby:nearbyConflict,bandage,errorIncrease,blockedReason,notes};
}
