import {shakenRules} from './shaken.mjs';
/** v14 native embedded-document uniqueness serializes resource transactions across clients.
 * Uses the authenticated document API and existing ownership, without a privileged socket relay.
 */
export const RESOURCE_LOCK_ID='sc2ResourceLock1';
export const GC_RESOURCE_LOCK_ID='sc2GCResourceLk1';
const scopeQueues=new Map();
const lockKey=(actor,scope)=>`${actor.uuid}:${scope}`;
const held=new Map();
export const isResourceLock=item=>[RESOURCE_LOCK_ID,GC_RESOURCE_LOCK_ID].includes(item?.id??item?._id)&&!!item.flags?.spycraft2?.resourceLock?.token;
export class ResourceBusyError extends Error {}
function requireSettledPeriod(allow){const stored=globalThis.game?.settings?.get?.('spycraft2','usagePeriodReview'),review=stored?.needsReview?stored:globalThis.game?.spycraft2?.pendingUsagePeriodReview??stored;if(!allow&&review?.needsReview)throw new ResourceBusyError('The GC must review the interrupted start before further resource use.');}


/** One local barrier for every participant, acquired together to prevent reciprocal-queue deadlocks. */
export function queueResources(actors,work,{messages=[],allowPeriodReview=false}={}){
 const unique=[...new Map(actors.filter(Boolean).map(actor=>[actor.uuid,actor])).values()].sort((a,b)=>(a.uuid<b.uuid?-1:a.uuid>b.uuid?1:0));
 const previous=unique.map(actor=>(actor._actionDieQueue??Promise.resolve()).catch(()=>{}));
 const pending=Promise.all(previous).then(()=>{
  requireSettledPeriod(allowPeriodReview);
  const backend=globalThis.game?.spycraft2?.resourceLocks;
  if(globalThis.game?.ready&&!backend)throw new Error('The resource transaction service is unavailable. Reload the world before spending.');
  return backend?backend.run(unique,work,{messages,allowPeriodReview}):work();
 }).catch(error=>{if(error instanceof ResourceBusyError){globalThis.ui?.notifications?.warn(error.message);return null;}throw error;});
 for(const actor of unique)actor._actionDieQueue=pending.catch(()=>{});
 return pending;
}

/** Call only inside queueResources with the paying actor included in its participants. */
export async function payLockedActionDice(actor,count,perform){
 if(!actor.isOwner)throw new Error('You must own the paying character.');
 const shaken=shakenRules(actor.system);if(shaken.needsReview||shaken.spendingForbidden)throw new Error(shaken.needsReview?'Review the paying character’s Shaken sources.':'Shaken IV: this character may not spend action dice for any purpose (p.342).');
 if(!Number.isSafeInteger(count)||count<1||count>(actor.system.actionDice?.value??0))throw new Error('Not enough action dice remain.');
 await actor.update({'system.actionDice.value':actor.system.actionDice.value-count});
 try{return await perform();}
 catch(error){await actor.update({'system.actionDice.value':actor.system.actionDice.value+count});throw error;}
}

async function readDocument(doc){
 const result=await doc.constructor.database.get(doc.constructor,{query:{_id:doc.id}});
 if(result.length!==1)throw new Error(`Cannot refresh ${doc.documentName} before its resource transaction.`);
 return result[0];
}
async function readActor(actor){
 if(!actor.isToken)return readDocument(actor);
 // An unlinked token's resource overrides live in its Scene's ActorDelta, not its base Actor.
 const token=actor.token,scene=await readDocument(token.parent),fresh=scene.tokens.get(token.id)?.actor;
 if(!fresh)throw new Error('The token was removed before its resource transaction.');
 return fresh;
}
async function refreshActor(actor){
 const fresh=await readActor(actor);actor.updateSource(fresh.toObject(),{recursive:false});
 if(!actor.isOwner)throw new Error('Ownership changed while starting this resource transaction.');
 return actor;
}
async function acquire(actor,scope=RESOURCE_LOCK_ID){
 if(!actor.isOwner)throw new Error('You must own each character whose resources are being used.');
 const existing=actor.items.get(scope);
 if(existing){if(isResourceLock(existing))throw new ResourceBusyError(`${actor.name}: a resource transaction is in progress. Retry after it finishes; the GC can recover an interrupted transaction.`);throw new Error(`${actor.name}: the reserved resource-document ID is already used by another item.`);}
 const token=foundry.utils.randomID(),data={_id:scope,name:'Spycraft resource transaction',type:'gear',system:{quantity:0,weight:0,carried:false},flags:{spycraft2:{resourceLock:{token,userId:game.user.id,started:Date.now()}}}};
 let docs;
 try{docs=await actor.createEmbeddedDocuments('Item',[data],{keepId:true,render:false});}
 catch(error){if(/already exists/.test(error.message))throw new ResourceBusyError(`${actor.name}: another client started a resource transaction. Retry after it finishes.`);throw error;}
 const lock=docs[0];
 if(docs.length!==1||lock.id!==scope||lock.flags.spycraft2.resourceLock.token!==token)throw new Error('The server did not create the expected resource transaction lock.');
 held.set(lockKey(actor,scope),token);return token;
}
async function release(actor,token,scope=RESOURCE_LOCK_ID){
 try{
  const fresh=await readActor(actor),lock=fresh.items.get(scope);
  if(lock?.flags?.spycraft2?.resourceLock?.token===token){if(scope===RESOURCE_LOCK_ID)actor.updateSource(fresh.toObject(),{recursive:false});else if(!actor.items.has(scope))actor.updateSource({items:fresh.toObject().items},{recursive:false});await actor.deleteEmbeddedDocuments('Item',[scope],{render:false});}
 }finally{if(held.get(lockKey(actor,scope))===token)held.delete(lockKey(actor,scope));}
}
export async function runNativeResourceTransaction(actors,work,{messages=[],allowPeriodReview=false}={}){
 const locks=[];let result;
 try{
  for(const actor of [...actors].sort((a,b)=>(a.uuid<b.uuid?-1:a.uuid>b.uuid?1:0))){
   const root=actor.isToken&&locks.find(lock=>!lock.actor.isToken&&lock.actor.id===actor.token?.actorId);
   if(root){
    const fresh=await readActor(actor),inherited=fresh.items.get(RESOURCE_LOCK_ID);
    if(inherited?.flags?.spycraft2?.resourceLock?.token===root.token){held.set(lockKey(actor,RESOURCE_LOCK_ID),root.token);locks.push({actor,token:root.token,covered:true});continue;}
   }
   locks.push({actor,token:await acquire(actor)});
  }
  await refreshWorldSetting('spycraft2','usagePeriods');
  await refreshWorldSetting('spycraft2','usagePeriodReview');requireSettledPeriod(allowPeriodReview);
  for(const actor of actors)await refreshActor(actor);
  for(const message of [...new Set(messages)]){
   const originalActor=message.flags?.spycraft2?.actorUuid,fresh=await readDocument(message);
   if(fresh.flags?.spycraft2?.actorUuid!==originalActor)throw new Error('The roll’s acting character changed before this transaction.');
   message.updateSource(fresh.toObject(),{recursive:false});
   if(message.blind&&!game.user.isGM)throw new Error('The GC resolves secret results.');
  }
  result=await work();
 }finally{
  const failures=[];
  for(const lock of locks.reverse())try{if(lock.covered)held.delete(lockKey(lock.actor,RESOURCE_LOCK_ID));else await release(lock.actor,lock.token);}catch(error){failures.push(error);}
  // Cleanup failure must not pretend a committed resource action failed and invite a duplicate retry.
  if(failures.length)ui.notifications.warn('Resource transaction finished, but its lock needs GC recovery. Check the recorded result before retrying.');
 }
 return result;
}
export async function recoverResourceTransaction(actor,{confirmed=false,scope=RESOURCE_LOCK_ID}={}){
 if(!game.user.isGM)throw new Error('Only the GC can recover an interrupted resource transaction.');
 if(held.has(lockKey(actor,scope)))throw new Error('This client is still executing that resource transaction.');
 const fresh=await readActor(actor),lock=fresh.items.get(scope);
 if(!isResourceLock(lock))return ui.notifications.info('There is no interrupted resource transaction to recover.');
 if(!confirmed){
  const user=game.users.get(lock.flags.spycraft2.resourceLock.userId),input=await foundry.applications.api.DialogV2.input({window:{title:'Recover interrupted resource transaction'},rejectClose:false,content:`<p>Check the recorded result and current resources before retrying. Coordinate with ${foundry.utils.escapeHTML(user?.name??'the original user')} to ensure their action has stopped.</p><label><input type="checkbox" name="confirmed" /> No client is still executing this resource transaction</label>`});
  if(!input?.confirmed)return null;
 }
 // Re-read after the declaration so a replacement transaction is never cleared accidentally.
 const current=await readActor(actor);
 if(current.items.get(scope)?.flags?.spycraft2?.resourceLock?.token!==lock.flags.spycraft2.resourceLock.token)throw new Error('The resource transaction changed; it was not cleared.');
 if(scope===RESOURCE_LOCK_ID)actor.updateSource(current.toObject(),{recursive:false});else if(!actor.items.has(scope))actor.updateSource({items:current.toObject().items},{recursive:false});
 return actor.deleteEmbeddedDocuments('Item',[scope],{render:false});
}
export const nativeResourceLocks={native:true,run:runNativeResourceTransaction,recover:recoverResourceTransaction};

export const nativeResourceTransactionsEnabled=()=>globalThis.game?.spycraft2?.resourceLocks?.native===true;
/** Refresh only a known world setting through its authenticated document API. */
export async function refreshWorldSetting(namespace,key){
 const doc=globalThis.game?.settings?.get?.(namespace,key,{document:true});
 if(!doc?.constructor?.database)return null;
 const matches=await doc.constructor.database.get(doc.constructor,{query:{key:`${namespace}.${key}`}});
 if(matches.length>1)throw new Error(`Ambiguous world setting ${namespace}.${key}.`);
 if(!matches.length)return null;
 const fresh=matches[0];
 if(doc.id===fresh.id)doc.updateSource(fresh.toObject(),{recursive:false});
 else{const storage=game.settings.storage.get('world');if(doc.id)storage.delete(doc.id);storage.set(fresh.id,fresh);}
 return fresh.value;
}
/** Period changes wait for every tracked actor/token resource action to finish. */
export function periodResourceActors(){
 const actors=[...(globalThis.game?.actors??[])];
 for(const scene of globalThis.game?.scenes??[])for(const token of scene.tokens??[]){const actor=token.actor;if(actor?.type==='agent'&&actor.isToken)actors.push(actor);}
 return [...new Map(actors.map(actor=>[actor.uuid,actor])).values()];
}

/** Shared settings use a distinct native mutex on the fixed bookkeeping parent, independent of its own dice. */
export function queueResourceScope(actor,scope,work){
 const key=lockKey(actor,scope),previous=scopeQueues.get(key)??Promise.resolve();
 const pending=previous.then(async()=>{
  const token=await acquire(actor,scope);
  try{return await work();}
  finally{try{await release(actor,token,scope);}catch(error){ui.notifications.warn('GC resource transaction finished, but its lock needs recovery. Check the result before retrying.');}}
 }).catch(error=>{if(error instanceof ResourceBusyError){ui.notifications.warn(error.message);return null;}throw error;});
 scopeQueues.set(key,pending.catch(()=>{}));return pending;
}
