export const CANDIDATE_KEYS=['str','dex','con','int','wis','cha'];
export const CANDIDATE_CHOICES=Object.fromEntries(CANDIDATE_KEYS.flatMap((key,i)=>CANDIDATE_KEYS.slice(i+1).map(other=>[[key,other].join(','),`${key.toUpperCase()} and ${other.toUpperCase()}`])));
const validScores=scores=>scores&&CANDIDATE_KEYS.every(key=>Number.isSafeInteger(scores[key]));
/** p.208: the two lowest acquisition-time attributes, with the player's tie choice. */
export function candidatePlan(system,feat){
 const choice=feat?.system?.choice??'',basis=feat?.system?.candidateBasis,keys=choice.split(',');
 if(!Object.hasOwn(CANDIDATE_CHOICES,choice))throw new Error('Candidate: choose two different attributes, resolving any lowest-score tie.');
 if((feat.system.acquiredAtLevel||1)!==1||basis?.level!==1||!validScores(basis.scores)||basis.choice!==choice||!['firstLevel','historicalReview'].includes(basis.source))throw new Error('Candidate: review the original first-level attributes and selected pair; a later change needs a GC history correction.');
 if(basis.source==='historicalReview'&&(!basis.confirmed||typeof basis.reason!=='string'||!basis.reason.trim()))throw new Error('Candidate: confirm and explain the original first-level attribute history.');
 const lowest=CANDIDATE_KEYS.map(k=>basis.scores[k]).sort((a,b)=>a-b).slice(0,2),chosen=keys.map(k=>basis.scores[k]).sort((a,b)=>a-b);
 if(chosen.some((value,i)=>value!==lowest[i]))throw new Error('Candidate: both selected attributes must be the two lowest before this feat; choose freely only among tied scores.');
 if(system.level===1&&validScores(system.candidateScores)&&CANDIDATE_KEYS.some(k=>system.candidateScores[k]!==basis.scores[k]))throw new Error('Candidate: first-level attributes changed; save the choice again after finishing the starting attributes and origin.');
 return {keys,scores:{...basis.scores},bonuses:keys.map(key=>({target:'abilities.'+key,value:'1'}))};
}
/** Stored at first-level selection, before Candidate or temporary attribute bonuses. */
export function captureCandidateBasis(system,choice=''){
 if(system.level!==1||!validScores(system.candidateScores))throw new Error('Finish the first class level and starting attribute setup before selecting Candidate.');
 return {level:1,source:'firstLevel',choice,scores:Object.fromEntries(CANDIDATE_KEYS.map(k=>[k,system.candidateScores[k]]))};
}
export function reviewedCandidateBasis(scores,choice,{reason='',confirmed=false}={}){
 if(confirmed!==true||typeof reason!=='string'||!reason.trim()||reason.length>1000)throw new Error('Confirm and explain the original Candidate attribute history.');
 const basis={level:1,source:'historicalReview',choice,scores:Object.fromEntries(CANDIDATE_KEYS.map(k=>[k,scores?.[k]])),confirmed:true,reason:reason.trim()};candidatePlan({}, {system:{choice,candidateBasis:basis,acquiredAtLevel:1}});return basis;
}
