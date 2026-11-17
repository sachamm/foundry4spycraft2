/** Quirky (QKY), p.302: worsen the operating profile's untrained attack penalty. */
export function quirkyAttackPlan(weapon,{trained=false,untrainedPenalty=weapon?.untrainedPenalty??-4}={}){
 if(typeof trained!=='boolean'||!Number.isSafeInteger(untrainedPenalty)||untrainedPenalty>0)throw Error('Review actual weapon training and the base untrained attack penalty before applying Quirky.');
 const qualities=weapon?.qualities??'';
 if(typeof qualities!=='string')throw Error('Review the actual weapon qualities before applying Quirky.');
 const quirky=/\bQKY\b/.test(qualities),adjustment=quirky?-4:0;
 return {version:1,quirky,trained,baseUntrainedPenalty:untrainedPenalty,adjustment,attackPenalty:trained?0:untrainedPenalty+adjustment};
}
