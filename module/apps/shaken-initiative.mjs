import {preferredInitiativeRoll} from './initiative-choice.mjs';
import {uncannyDodgePlan} from '../rules/defense.mjs';
import {shakenStateFromActor,shakenRules} from '../rules/shaken.mjs';
import {shakenInitiativeMarker,shakenInitiativePlan,reviewedShakenInitiativePlan} from '../rules/shaken-initiative.mjs';
import {queueResources,isResourceLock,periodResourceActors} from '../rules/transactions.mjs';
const localReviews=new WeakMap();
const record=c=>{const local=localReviews.get(c),saved=c.flags?.spycraft2?.shakenInitiative;if(local&&saved?.resolvesReviewId===local.id&&!saved.needsReview){localReviews.delete(c);return saved;}return local??saved;};
const hold=(c,reason)=>{const previous=record(c),id=typeof previous?.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(previous.id)?previous.id:foundry.utils.randomID(),held={...previous,id,version:1,count:c.initiative,includedPenalty:previous?.includedPenalty??null,needsReview:true,reason};localReviews.set(c,held);return held;};
const system=a=>({...a.system,shakenState:shakenStateFromActor(a)});
const planFor=c=>{if(c.group&&Number.isFinite(c.group.initiative)){const rules=shakenRules(system(c.actor)),saved=record(c);if(!rules.needsReview&&!rules.initiativePenalty&&![ -2,-4 ].includes(saved?.includedPenalty)&&!saved?.needsReview)return {changed:false,initiative:c.initiative,record:saved,delta:0};return {needsReview:true,reason:'This shared Initiative group needs individual Count adjudication. Remove this combatant from the shared group before reconciling its Shaken penalty.'};}return shakenInitiativePlan(system(c.actor),{initiative:c.initiative,record:record(c)});};
const combatants=a=>[...(globalThis.game?.combats??[])].flatMap(c=>[...(c.combatants??[])]).filter(c=>c.actor?.uuid===a.uuid);
export const shakenInitiativeEvidence=c=>JSON.stringify({actor:c.actor?.uuid,count:c.initiative,record:record(c),shaken:shakenStateFromActor(c.actor),uncanny:uncannyDodgePlan(c.actor?.system??{})});
export function shakenInitiativeReviews(actor){return combatants(actor).flatMap(c=>{const p=planFor(c);return p.needsReview?[{id:c.id,combatId:c.parent.id,name:c.parent.name??'Combat',count:c.initiative,reason:p.reason}]:[];});}
const markerMatches=(saved,marker)=>Array.isArray(marker)?Array.isArray(saved)&&saved.length===marker.length&&marker.every((v,i)=>markerMatches(saved[i],v)):marker&&typeof marker==='object'?saved&&Object.entries(marker).every(([key,value])=>markerMatches(saved[key],value)):saved===marker;
async function writePlan(c,plan,expected){
 const marker={...(record(c)?.review?{review:record(c).review}:{}),...plan.record,operationId:foundry.utils.randomID()};
 try{await c.update({initiative:plan.initiative,'flags.spycraft2.shakenInitiative':marker},{spycraft2ShakenInitiative:{expected,marker}});}
 catch(error){if(c.initiative===plan.initiative&&markerMatches(record(c),marker))return plan;throw error;}
 if(c.initiative!==plan.initiative||!markerMatches(record(c),marker))throw new Error('Initiative Count did not settle. Review its current value.');
 return plan;
}
export function reconcileShakenInitiative(actor){return queueResources([actor],async()=>{
 for(const c of combatants(actor)){
  const expected=shakenInitiativeEvidence(c),plan=planFor(c);
  if(plan.needsReview){const held=hold(c,plan.reason);if(JSON.stringify(c.flags?.spycraft2?.shakenInitiative)!==JSON.stringify(held))await c.update({'flags.spycraft2.shakenInitiative':held});continue;}
  if(!plan.changed)continue;
  try{await writePlan(c,plan,expected);}
  catch(error){const held=hold(c,'The Shaken Initiative Count update could not be verified: '+error.message);try{await c.update({'flags.spycraft2.shakenInitiative':held});}catch{}throw error;}
 }
 actor.sheet?.render(false);
},{allowPeriodReview:true});}
export async function reviewShakenInitiative(actor,combatId,combatantId,options={}){
 if(!game.user.isGM)throw new Error('Only the GC can review an existing Initiative Count.');
 const c=game.combats.get(combatId)?.combatants.get(combatantId);if(!c||c.actor?.uuid!==actor.uuid)throw new Error('Choose this character’s tracked combatant.');
 if(c.group&&Number.isFinite(c.group.initiative))throw new Error(planFor(c).reason);
 const expected=shakenInitiativeEvidence(c);let input=options;
 if(!Object.keys(input).length){const esc=foundry.utils.escapeHTML;input=await foundry.applications.api.DialogV2.input({window:{title:'Review Shaken Initiative Count'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${esc(actor.name)}: current Count ${c.initiative}. ${esc(planFor(c).reason??'Confirm its included component.')}</p><p>Confirm the penalty already in this current number. The current Shaken grade determines what should remain after reconciliation. A newly entered or rolled Count is its final value, including current modifiers. Its Initiative check penalty remains −4. Choose a cause below only when applying or correcting a condition-induced Count loss.</p><label>Current Count includes <select name="includedPenalty"><option value="">Choose explicitly</option><option value="0">No Shaken penalty</option><option value="-2">The protected −2 Shaken penalty</option><option value="-4">The full −4 Shaken penalty</option></select></label><label>Cause of a missing or corrected Count loss (Uncanny Dodge IV) <select name="incomingSelfInflicted"><option value="">Use verified source information</option><option value="false">Incoming attack or effect</option><option value="true">My own action</option></select></label><label>Review note <input name="resolution" /></label></div>`});if(!input)return null;}
 const included=[0,-2,-4].find(n=>input.includedPenalty===n||input.includedPenalty===String(n))??null;
 const selfInflicted=input.incomingSelfInflicted===false||input.incomingSelfInflicted==='false'?false:input.incomingSelfInflicted===true||input.incomingSelfInflicted==='true'?true:undefined;
 if(input.incomingSelfInflicted!==undefined&&input.incomingSelfInflicted!==''&&selfInflicted===undefined)throw new Error('Choose the cause of the missing Count loss.');
 if(included===null||typeof input.resolution!=='string'||!input.resolution.trim()||input.resolution.length>500)throw new Error('Choose the included penalty and record a review note.');
 return queueResources([actor],async()=>{
  if(shakenInitiativeEvidence(c)!==expected)throw new Error('The Count, Shaken sources or saved record changed. Review them again.');
  const plan=reviewedShakenInitiativePlan(system(actor),{initiative:c.initiative,record:record(c)},included,{selfInflicted});
  plan.record={...plan.record,resolvesReviewId:record(c)?.id??null,review:{by:game.user.id,note:input.resolution.trim(),includedPenalty:included,...(selfInflicted!==undefined?{selfInflicted}:{})}};
  const result=await writePlan(c,plan,expected);actor.sheet?.render(false);return result;
 },{allowPeriodReview:true});
}
export function guardShakenInitiativeUpdate(c,changed,options={}){
 if(!c.actor)return;
 const own=options.spycraft2ShakenInitiative;
 if(own){if(shakenInitiativeEvidence(c)!==own.expected)throw new Error('The Count or Shaken sources changed before their update.');changed['flags.spycraft2.shakenInitiative']=own.marker;return;}
 if(['actorId','tokenId','sceneId','group'].some(k=>Object.hasOwn(changed,k))){changed['flags.spycraft2.shakenInitiative']={version:1,count:changed.initiative??c.initiative,includedPenalty:null,needsReview:true,reason:'The combatant’s character changed. Review its included Shaken penalty.'};return;}
 if(Object.hasOwn(changed,'initiative'))changed['flags.spycraft2.shakenInitiative']={...shakenInitiativeMarker(system(c.actor),changed.initiative),...(record(c)?.id?{resolvesReviewId:record(c).id}:{})};
}
/** Factory avoids accessing Foundry globals when importing the controller in Node tests. */
export const shakenCombatantClass=Base=>class extends Base{
 getInitiativeRoll(formula){
  if(this.actor&&shakenRules(system(this.actor)).needsReview)throw new Error('Review the Shaken sources before rolling Initiative.');
  const roll=super.getInitiativeRoll(formula);if(!this.actor?.system.activeFeatNames?.includes('Lightning Reflexes'))return roll;
  const evidence=()=>JSON.stringify({shaken:shakenInitiativeEvidence(this),initiative:this.actor?.system.initiative?.total,owner:this.isOwner,combat:this.parent?{id:this.parent.id,round:this.parent.round,turn:this.parent.turn,started:this.parent.started}:null}),expected=evidence(),actorUuid=this.actor.uuid;
  return preferredInitiativeRoll(roll,{actorUuid,combatantUuid:this.uuid??'',validate:()=>{if(!this.isOwner||this.actor?.uuid!==actorUuid||!this.actor?.system.activeFeatNames?.includes('Lightning Reflexes')||evidence()!==expected)throw new Error('The character, Initiative Count or condition changed. Confirm Initiative again.');}});
 }
};
export function installShakenInitiativeHooks(){
 const pending=new WeakMap();
 const schedule=actor=>{
  if(!actor||!['agent','npc'].includes(actor.type)||!actor.isOwner||!combatants(actor).length)return;
  const gm=game.users?.activeGM,owner=gm??[...(game.users??[])].filter(u=>u.active&&actor.testUserPermission(u,'OWNER')).sort((a,b)=>a.id.localeCompare(b.id))[0];if(owner?.id!==game.user.id)return;
  const queued=pending.get(actor);if(queued){queued.again=true;return;}
  const state={again:true};pending.set(actor,state);
  state.promise=Promise.resolve().then(async()=>{do{state.again=false;await reconcileShakenInitiative(actor);}while(state.again);}).catch(error=>ui.notifications.warn('Shaken Initiative Count needs review: '+error.message)).finally(()=>pending.delete(actor));
 };
 Hooks.on('preCreateCombatant',c=>{try{if(c.actor)c.updateSource({'flags.spycraft2.shakenInitiative':shakenInitiativeMarker(system(c.actor),c.initiative??null)});}catch(error){ui.notifications.warn(error.message);return false;}});
 Hooks.on('preUpdateCombatant',(c,changed,options)=>{try{guardShakenInitiativeUpdate(c,changed,options);}catch(error){ui.notifications.warn(error.message);return false;}});
 Hooks.on('createCombatant',c=>schedule(c.actor));
 Hooks.on('updateActor',schedule);
 for(const event of ['createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(event,e=>schedule(e.parent?.documentName==='Actor'?e.parent:e.parent?.parent));
 for(const event of ['createItem','updateItem','deleteItem'])Hooks.on(event,item=>{if(!isResourceLock(item))schedule(item.parent);});
 Hooks.once('ready',()=>{for(const actor of periodResourceActors())schedule(actor);});
}

/** Already inside the Actor transaction: another Count loss must retain the actual Shaken component. */
export async function changeInitiativeCountPreservingShaken(c,initiative){
 if(!c?.actor||!Number.isFinite(c.initiative))throw new Error('Choose a character with an existing numeric Initiative Count.');
 if(c.group&&Number.isFinite(c.group.initiative))throw new Error('An individual Count loss in a shared Initiative group needs GC adjudication.');
 const expected=shakenInitiativeEvidence(c),current=planFor(c);if(current.needsReview||current.delta)throw new Error(current.reason??'Reconcile the pending Shaken Count adjustment before another Initiative loss.');
 const valid=shakenInitiativeMarker(system(c.actor),initiative),plan={...current,initiative,record:{...current.record,count:valid.count}};
 return writePlan(c,plan,expected);
}
