/** Incoming Baffled events, distinct from reviewing the current condition (p.340). */
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function baffledSourceSnapshot(actor){
 const own=[...(actor.effects??[])],applied=actor.appliedEffects??own.filter(e=>e.active??(!e.disabled&&!e.isSuppressed));
 return {baffled:actor.statuses?.has('baffled')===true,incompetent:actor.statuses?.has('incompetent')===true,sources:applied.filter(e=>['baffled','incompetent'].some(s=>e.statuses?.has(s))).map(e=>({id:e.uuid??e.id,own:own.includes(e),statuses:[...e.statuses].sort(),origin:e.origin??null,operation:e.flags?.spycraft2?.conditionOperation??null,duration:e.toObject?.().duration??e.duration??null})).sort((a,b)=>String(a.id).localeCompare(String(b.id)))};
}
export function getBaffledReview(actor){
 const stored=actor.flags?.spycraft2?.baffledApplicationReview,local=globalThis.game?.spycraft2?.pendingBaffledReviews?.[actor.uuid];
 return stored?.needsReview?stored:stored?.id===local?.id&&stored?.needsReview===false?stored:local??stored??{};
}
export function baffledApplicationPlan(current,expected,{id,source,confirmed},history={},at=0){
 if(typeof id!=='string'||(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||['constructor','prototype','__proto__'].includes(id))||typeof source!=='string'||!source.trim()||source.length>500||confirmed!==true||!Number.isFinite(at))throw new Error('Confirm a new Baffled event with its unique reference and source.');
 const previous=Object.hasOwn(history,id)?history[id]:null;if(previous){if(previous.source!==source.trim())throw new Error('This Baffled reference already records another source.');return {duplicate:true,record:previous};}
 if(!same(current,expected))throw new Error('Baffled sources changed. Review the current state before applying a new event.');
 if(current.baffled&&!current.sources.some(s=>s.statuses.includes('baffled'))||current.incompetent&&!current.sources.some(s=>s.statuses.includes('incompetent')))throw new Error('Review the missing condition source before applying Baffled.');
 return {duplicate:false,record:{id,source:source.trim(),at,before:{baffled:current.baffled,incompetent:current.incompetent},after:{baffled:!current.baffled,incompetent:current.incompetent||current.baffled},state:'applied'}};
}
