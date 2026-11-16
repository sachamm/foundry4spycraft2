/** Superior Accuracy (SPA), p.302: all three qualifications apply to this attack. */
export function superiorAccuracyAttackPlan(weapon,{trained=false,aimed=false,braced=false}={}){
 if([trained,aimed,braced].some(v=>typeof v!=='boolean'))throw Error('Review actual weapon proficiency, valid Aim and valid Brace before applying Superior Accuracy.');
 const qualities=weapon?.qualities??'';
 if(typeof qualities!=='string')throw Error('Review the actual weapon qualities before applying Superior Accuracy.');
 const superiorAccuracy=/\bSPA\b/.test(qualities);
 if(superiorAccuracy&&/\b(?:INA|IMP)\b/.test(qualities))throw Error('Review Superior Accuracy: it may not be added to an Inaccurate or Imprecise weapon (p.302).');
 return {version:1,superiorAccuracy,trained,aimed,braced,threatIncrease:superiorAccuracy&&trained&&aimed&&braced?1:0};
}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateSuperiorAccuracyProof(weapon,proof,{checkKind,trained=false,aimed=false,braced=false}={}){
 if(!proof)return;
 if(checkKind!=='attack'||stable(superiorAccuracyAttackPlan(weapon,{trained,aimed,braced}))!==stable(proof))throw Error('The Superior Accuracy weapon quality, actual proficiency, valid Aim or valid Brace changed before posting.');
}
