/** Brawler Ploy: Still Standing, p.66. Actual derived class selection, not a feat name. */
export function stillStandingSource(system){
 const level=system?.classLevels?.brawler??0;
 if(!Number.isSafeInteger(level)||level<0||level>10)throw Error('Review the actual Brawler class level before applying Still Standing.');
 if(level<3)return null;
 if(!Array.isArray(system.classOptionSelections)||system.classOptionSelections.some(s=>!s||typeof s!=='object'))throw Error('Review the current Brawler Ploy selections.');
 const choices=system.classOptionSelections.filter(s=>s.classId==='brawler'&&s.name==='Still Standing');
 if(!choices.length)return null;
 if(choices.length!==1||![3,5,7,9].includes(choices[0].level)||choices[0].level>level)throw Error('Review the earned Still Standing Ploy slot; this option is chosen only once.');
 return {version:1,classId:'brawler',ability:'Still Standing',classLevel:level,selectionLevel:choices[0].level};
}
/** Called only after the enclosing controller establishes an actual skill response. */
export function stillStandingResistancePlan(system,response){
 if(!['trip','bull-rush'].includes(response))throw Error('Still Standing resistance applies only to actual Trip or Bull Rush skill responses.');
 const source=stillStandingSource(system);
 return {version:1,response,source,bonus:source?4:0};
}
export function stillStandingTakedownPlan(system,{saveKey='fort',resistingTakedown=false,takedownAttackConfirmed=false}={}){
 if(resistingTakedown===false)return null;
 if(resistingTakedown!==true||saveKey!=='fort'||takedownAttackConfirmed!==true)throw Error('The GC must confirm this Fortitude save to stay standing after a real hit from a takedown-quality attack (p.66).');
 const source=stillStandingSource(system);
 return {version:1,saveKey:'fort',resistingTakedown:true,takedownAttackConfirmed:true,source,bonus:source?8:0};
}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateStillStandingResistanceProof(system,proof,response){
 if(!proof)return;
 if(stable(stillStandingResistancePlan(system,response))!==stable(proof))throw Error('The Still Standing Ploy or resistance context changed before posting.');
}
export function validateStillStandingSaveProof(system,proof,{checkKind,checkId}={}){
 if(!proof)return;
 if(checkKind!=='save'||checkId!=='fort'||stable(stillStandingTakedownPlan(system,{saveKey:checkId,resistingTakedown:proof.resistingTakedown,takedownAttackConfirmed:proof.takedownAttackConfirmed}))!==stable(proof))throw Error('The Still Standing Ploy or confirmed takedown Fortitude save changed before posting.');
}
