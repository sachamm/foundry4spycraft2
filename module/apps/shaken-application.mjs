import {getShakenApplicationReview,shakenApplicationSnapshot,shakenApplicationPlan} from '../rules/shaken.mjs';
import {queueResources} from '../rules/transactions.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),clone=structuredClone;
const matches=(actual,expected)=>expected&&typeof expected==='object'&&!Array.isArray(expected)?actual&&Object.entries(expected).every(([k,v])=>matches(actual[k],v)):same(actual,expected);
const tagged=(a,id)=>[...(a.effects??[])].filter(e=>e.flags?.spycraft2?.shakenApplication?.id===id);
function hold(actor,review){game.spycraft2??={};game.spycraft2.pendingShakenReviews??={};game.spycraft2.pendingShakenReviews[actor.uuid]=review;}
export async function applyShaken(actor,options={}){
 if(!['agent','npc'].includes(actor.type)||!actor.isOwner)return null;
 const expected=shakenApplicationSnapshot(actor);let input=options;
 if(!Object.keys(input).length){input=await foundry.applications.api.DialogV2.input({window:{title:'Apply a new Shaken source'},rejectClose:false,content:'<div class="spycraft2-roll-options"><p>Grades from separate Shaken applications add together (p.342). This records a direct condition after its required saves and immunities have been resolved. It does not add stress damage or schedule stress recovery.</p><label>Event reference <input name="id" /></label><label>Source <input name="source" /></label><label>Incoming grade <select name="grade"><option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option></select></label><label><input name="selfInflicted" type="checkbox" /> This condition is caused by my own action (Uncanny Dodge IV does not halve its Count penalty)</label><label><input name="confirmed" type="checkbox" /> The GC confirms this new condition applies after all saves and immunities</label></div>'});if(!input)return null;input={...input,grade:Number(input.grade)};}
 if(input.confirmed!==true)return null;
 return queueResources([actor],()=>applyShakenLocked(actor,expected,input));
}
/** Call only inside queueResources with this actor already locked. */
export async function applyShakenLocked(actor,expected,input){
  if(!actor.isOwner)throw new Error('Ownership changed.');
  if(actor.type==='npc'&&actor.system.npcProfile?.enabled&&actor.system.npcProfile.qualities?.some(q=>q.id==='construct'))throw new Error('Constructs never gain Shaken.');
  if(getShakenApplicationReview(actor).needsReview)throw new Error('The GC must review the interrupted Shaken application first.');
  const plan=shakenApplicationPlan(shakenApplicationSnapshot(actor),expected,input,actor.flags?.spycraft2?.shakenApplications,game.time.worldTime);if(plan.duplicate)return plan.record;
  const {record}=plan,tag={id:record.id,grade:record.grade,source:record.source,at:record.at,selfInflicted:record.selfInflicted};let created=null;
  try{
   const [effect]=await actor.createEmbeddedDocuments('ActiveEffect',[{name:'Shaken '+['','I','II','III','IV'][record.grade]+' — '+record.source,img:'icons/svg/terror.svg',statuses:['shaken-'+record.grade],flags:{spycraft2:{shakenGrade:record.grade,shakenApplication:tag,...(typeof record.selfInflicted==='boolean'?{shakenSelfInflicted:record.selfInflicted}:{})}}}]);
   if(!effect)throw new Error('The new Shaken source was not created.');record.effectId=effect.id;
   const data=effect.toObject(),status='shaken-'+record.grade;
   if(!same([...effect.statuses],[status])||effect.flags?.spycraft2?.shakenGrade!==record.grade||!same(effect.flags?.spycraft2?.shakenApplication,tag)||(data.changes??[]).length||Object.keys(data.flags??{}).some(k=>k!=='spycraft2')||Object.keys(data.flags?.spycraft2??{}).some(k=>!['shakenGrade','shakenApplication','shakenSelfInflicted'].includes(k))||[data.duration?.seconds,data.duration?.rounds,data.duration?.turns].some(n=>n!=null&&n!==0))throw new Error('Preserve independent data added to the new Shaken source for review.');
   created=clone(data);
   await actor.update({['flags.spycraft2.shakenApplications.'+record.id]:record});return record;
  }catch(error){
   if(matches(actor.flags?.spycraft2?.shakenApplications?.[record.id],record))return record;
   const failures=[];
   for(const effect of tagged(actor,record.id)){
    if(!created||!same(effect.toObject(),created)){failures.push(new Error('Preserve the changed or unproved new Shaken source for review.'));continue;}
    try{await actor.deleteEmbeddedDocuments('ActiveEffect',[effect.id]);}catch(e){if(tagged(actor,record.id).some(row=>row.id===effect.id))failures.push(e);}
   }
   if(failures.length||!same(shakenApplicationSnapshot(actor),expected)){
    const review={id:record.id,source:record.source,record,needsReview:true,reason:'The interrupted Shaken event could not be fully restored. Review its actual source before resolving it.'};hold(actor,review);try{await actor.update({'flags.spycraft2.shakenApplicationReview':review});}catch{}
    throw new AggregateError([error,...failures],'Shaken application needs GC review.');
   }
   throw error;
  }
}
export async function reviewShakenApplication(actor,options={}){
 if(!game.user.isGM||!actor.isOwner)throw new Error('Only the GC can resolve an interrupted Shaken event.');
 const review=clone(getShakenApplicationReview(actor)),expected=shakenApplicationSnapshot(actor);if(!review.needsReview)return null;
 let input=options;
 if(!Object.keys(input).length){const esc=foundry.utils.escapeHTML;input=await foundry.applications.api.DialogV2.input({window:{title:'Review interrupted Shaken application'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${esc(review.source??'Unknown source')}. Review and correct the actual source effects first. Keeping the event records its receipt; cancelling it requires ending its active Shaken source first. Neither choice removes independent effects.</p><label>Disposition <select name="disposition"><option value="keep">Record the event as resolved</option><option value="cancel">Cancel the event</option></select></label><label>Review note <input name="resolution" /></label><label><input name="confirmed" type="checkbox" /> I reviewed the actual source effects</label></div>`});if(!input)return null;}
 if(input.confirmed!==true||!['keep','cancel'].includes(input.disposition)||typeof input.resolution!=='string'||!input.resolution.trim()||input.resolution.length>500)throw new Error('Confirm the source review and record a bounded explanation.');
 return queueResources([actor],async()=>{
  if(!game.user.isGM||!actor.isOwner||!same(getShakenApplicationReview(actor),review)||!same(shakenApplicationSnapshot(actor),expected))throw new Error('The Shaken review or its sources changed. Open it again.');
  // Validate the recovered event identity before using it in a document update path.
  shakenApplicationPlan({state:{totalGrade:0}},{state:{totalGrade:0}},{...review.record,selfInflicted:typeof review.record.selfInflicted==='boolean'?review.record.selfInflicted:undefined,confirmed:true},{},game.time.worldTime);
  if(input.disposition==='cancel'&&tagged(actor,review.id).some(e=>(e.active??(!e.disabled&&!e.isSuppressed))&&[...e.statuses].some(s=>/^shaken(?:[-_]?(?:[1-4]|iv|iii|ii|i))?$/i.test(s))))throw new Error('End this event’s active Shaken source before cancelling its receipt.');
  const actualSources=tagged(actor,review.id);if(actualSources.length>1)throw new Error('Remove duplicated event tags or extra sources before resolving this application.');
  const record={...review.record,effectId:actualSources[0]?.id??review.record.effectId,state:input.disposition==='cancel'?'cancelled':'reviewed',resolution:input.resolution.trim(),reviewer:game.user.id},completed={...review,needsReview:false,record};
  try{await actor.update({['flags.spycraft2.shakenApplications.'+record.id]:record,'flags.spycraft2.shakenApplicationReview':completed});}catch(error){if(!matches(actor.flags?.spycraft2?.shakenApplications?.[record.id],record)||!matches(actor.flags?.spycraft2?.shakenApplicationReview,completed))throw error;}
  delete game.spycraft2?.pendingShakenReviews?.[actor.uuid];return record;
 });
}
