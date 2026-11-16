/** Bug Basics p.208: only the two named Stash Item checks made to conceal bugs. */
export function bugConcealmentPlan(system,key,check,{concealingBug=false,bugName='',bugConcealmentConfirmed=false}={}){
 const empty={evidence:null,bonuses:[],blockedReason:'',notes:[]};
 if(!['sleightOfHand','sneak'].includes(key)||check.id!=='stash-item'||concealingBug!==true)return empty;
 if(!system.activeFeatNames?.includes('Bug Basics'))return {...empty,blockedReason:'Bug Basics must be currently available.'};
 if(bugConcealmentConfirmed!==true||typeof bugName!=='string'||!bugName.trim()||bugName.trim().length>200)return {...empty,blockedReason:'Name the bug and confirm with the GC that this Stash Item check conceals it.'};
 const evidence={version:1,source:'Bug Basics',skillKey:key,checkId:check.id,concealingBug:true,bugName:bugName.trim(),bugConcealmentConfirmed:true,bonus:{type:'gear',value:2}};
 return {evidence,bonuses:[{source:evidence.source,...evidence.bonus}],blockedReason:'',notes:[`Bug Basics: +2 gear on Stash Item to conceal bug “${evidence.bugName}”; normal gear bonus stacking applies (p.208).`]};
}
export function validateBugConcealmentProof(system,proof,{checkKind,skillKey,checkId}={}){
 if(!proof)return;const current=bugConcealmentPlan(system,skillKey,{id:checkId},proof);
 if(checkKind!=='skill'||proof.skillKey!==skillKey||proof.checkId!==checkId||!current.evidence||JSON.stringify(current.evidence)!==JSON.stringify(proof))throw new Error('The Bug Basics source or declared bug concealment changed before posting.');
}
