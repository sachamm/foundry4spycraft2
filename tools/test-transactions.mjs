import test from 'node:test';import assert from 'node:assert/strict';
import {RESOURCE_LOCK_ID,GC_RESOURCE_LOCK_ID,ResourceBusyError,isResourceLock,queueResources,payLockedActionDice,runNativeResourceTransaction,recoverResourceTransaction,periodResourceActors} from '../module/rules/transactions.mjs';
const records=new Map(),warnings=[];let nonce=0,reads=0;
globalThis.foundry={utils:{randomID:()=>`token-${++nonce}`,escapeHTML:s=>s}};
globalThis.game={user:{id:'owner',isGM:true},users:{get:()=>({name:'Owner'})}};
globalThis.ui={notifications:{warn:text=>warnings.push(text),info:text=>text}};
import {initializeGCDice,adjustGCDice,spendGCDice,gcDiceStatus,gcDiceController,recoverGCBookkeeping} from '../module/rules/gc-dice.mjs';
const copy=structuredClone;
class NativeActor{
 constructor(id,balance=1,{source=null,uuid=`Actor.${id}`,isToken=false}={}){this.id=id;this.uuid=uuid;this.name=id;this.documentName='Actor';this.isOwner=true;this.isToken=isToken;this.updateSource(source??{_id:id,system:{actionDice:{value:balance}},items:[]});if(!source)records.set(uuid,copy(this.source));}
 updateSource(source){this.source=copy(source);this.system=this.source.system;this.items=new Map(this.source.items.map(i=>[i._id,{...i,id:i._id}]));}
 toObject(){return copy(this.source);}
 async createEmbeddedDocuments(type,data){const stored=records.get(this.uuid);for(const item of data)if(stored.items.some(i=>i._id===item._id))throw Error(`The _id [${item._id}] already exists within the parent collection`);stored.items.push(...copy(data));this.source.items.push(...copy(data));this.items=new Map(this.source.items.map(i=>[i._id,{...i,id:i._id}]));return data.map(i=>({...copy(i),id:i._id}));}
 async deleteEmbeddedDocuments(type,ids){if(this.failCleanup)throw Error('cleanup failed');const stored=records.get(this.uuid);stored.items=stored.items.filter(i=>!ids.includes(i._id));this.source.items=this.source.items.filter(i=>!ids.includes(i._id));this.items=new Map(this.source.items.map(i=>[i._id,{...i,id:i._id}]));return ids;}
 async update(data){const stored=records.get(this.uuid);if(data['system.actionDice.value']!==undefined)stored.system.actionDice.value=data['system.actionDice.value'];this.updateSource(stored);}
 static database={get:async(Type,{query})=>{reads++;const source=records.get(`Actor.${query._id}`);return source?[new NativeActor(query._id,0,{source})]:[];}};
}
const lock=token=>({_id:RESOURCE_LOCK_ID,name:'Resource lock',type:'gear',system:{quantity:0,carried:false},flags:{spycraft2:{resourceLock:{token,userId:'owner'}}}});
function reset(){records.clear();warnings.length=0;reads=0;game.user.isGM=true;delete game.spycraft2;delete game.settings;delete game.actors;delete game.scenes;}
test('two independent clients cannot both spend the same die; server-side embedded uniqueness admits one resource transaction',async()=>{
 reset();const a=new NativeActor('a'),b=new NativeActor('a',0,{source:copy(records.get('Actor.a'))});let performed=0;
 const run=actor=>runNativeResourceTransaction([actor],()=>payLockedActionDice(actor,1,async()=>++performed));
 const results=await Promise.allSettled([run(a),run(b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(results.some(r=>r.status==='rejected'&&r.reason instanceof ResourceBusyError));assert.equal(performed,1);assert.equal(records.get('Actor.a').system.actionDice.value,0);assert.equal(records.get('Actor.a').items.length,0);
});
test('a stale client refreshes the committed server balance before validating payment',async()=>{
 reset();const actor=new NativeActor('a');records.get(actor.uuid).system.actionDice.value=0;let performed=false;
 await assert.rejects(runNativeResourceTransaction([actor],()=>payLockedActionDice(actor,1,()=>{performed=true;})),/Not enough/);
 assert.equal(performed,false);assert.equal(actor.system.actionDice.value,0);assert.equal(records.get(actor.uuid).items.length,0);assert.ok(reads>=2);
});
test('an occupied later participant releases every earlier lock without spending any resources',async()=>{
 reset();const a=new NativeActor('a'),b=new NativeActor('b');records.get(b.uuid).items.push(lock('other-client'));let performed=false;
 await assert.rejects(runNativeResourceTransaction([b,a],()=>{performed=true;}),ResourceBusyError);
 assert.equal(performed,false);assert.equal(records.get(a.uuid).items.length,0);assert.equal(records.get(a.uuid).system.actionDice.value,1);assert.equal(records.get(b.uuid).items[0].flags.spycraft2.resourceLock.token,'other-client');
});
test('failed execution refunds the paying actor and removes the transaction lock',async()=>{
 reset();const actor=new NativeActor('a');await assert.rejects(runNativeResourceTransaction([actor],()=>payLockedActionDice(actor,1,async()=>{throw Error('posting failed');})),/posting failed/);
 assert.equal(records.get(actor.uuid).system.actionDice.value,1);assert.equal(records.get(actor.uuid).items.length,0);
});
test('cleanup failure preserves a committed payment and reports recovery rather than inviting a duplicate retry',async()=>{
 reset();const actor=new NativeActor('a');actor.failCleanup=true;const result=await runNativeResourceTransaction([actor],()=>payLockedActionDice(actor,1,async()=>true));
 assert.equal(result,true);assert.equal(records.get(actor.uuid).system.actionDice.value,0);assert.equal(records.get(actor.uuid).items.length,1);assert.ok(warnings.some(w=>/Check the recorded result/.test(w)));
 actor.failCleanup=false;await recoverResourceTransaction(actor,{confirmed:true});assert.equal(records.get(actor.uuid).items.length,0);
});
test('cleanup never deletes a replacement lock belonging to a different transaction',async()=>{
 reset();const actor=new NativeActor('a');await runNativeResourceTransaction([actor],async()=>{records.get(actor.uuid).items=[lock('replacement')];});
 assert.equal(records.get(actor.uuid).items[0].flags.spycraft2.resourceLock.token,'replacement');
});
test('recovery requires the GC and cannot clear a transaction still running in this client',async()=>{
 reset();const actor=new NativeActor('a');await runNativeResourceTransaction([actor],async()=>{await assert.rejects(recoverResourceTransaction(actor,{confirmed:true}),/still executing/);});
 game.user.isGM=false;await assert.rejects(recoverResourceTransaction(actor,{confirmed:true}),/Only the GC/);game.user.isGM=true;
});
test('unlinked-token balances refresh from the Scene ActorDelta instead of the base actor',async()=>{
 reset();const uuid='Scene.s.Token.t.Actor.base',actor=new NativeActor('base',1,{uuid,isToken:true});records.get(uuid).system.actionDice.value=0;
 class Scene{static database={get:async()=>[{tokens:new Map([['t',{actor:new NativeActor('base',0,{source:records.get(uuid),uuid})}]])}]};}
 actor.token={id:'t',parent:Object.assign(new Scene(),{id:'s',documentName:'Scene'})};
 await assert.rejects(runNativeResourceTransaction([actor],()=>payLockedActionDice(actor,1,async()=>true)),/Not enough/);assert.equal(actor.system.actionDice.value,0);assert.equal(records.get(uuid).items.length,0);
});
test('multi-actor local barriers serialize reciprocal payments and ordinary spending without nested-queue deadlocks',async()=>{
 reset();const a=new NativeActor('a',3),b=new NativeActor('b',3),order=[];
 game.spycraft2={resourceLocks:{run:runNativeResourceTransaction}};
 await Promise.all([queueResources([a,b],()=>payLockedActionDice(a,1,async()=>{order.push('first');})),queueResources([b,a],()=>payLockedActionDice(b,1,async()=>{order.push('second');})),queueResources([a],()=>payLockedActionDice(a,1,async()=>{order.push('third');}))]);
 assert.deepEqual(order,['first','second','third']);assert.equal(records.get(a.uuid).system.actionDice.value,1);assert.equal(records.get(b.uuid).system.actionDice.value,2);
});
test('stored message flags refresh with the actor so a previously activated critical cannot be paid twice',async()=>{
 reset();const actor=new NativeActor('a');let performed=false;
 class Message{constructor(flags){this.id='m';this.documentName='ChatMessage';this.flags=flags;}toObject(){return {flags:this.flags};}updateSource(source){this.flags=copy(source.flags);}static database={get:async()=>[new Message({spycraft2:{criticalSuccess:true}})]};}
 const message=new Message({spycraft2:{criticalSuccess:false}});
 await runNativeResourceTransaction([actor],async()=>{if(!message.flags.spycraft2.criticalSuccess){performed=true;await payLockedActionDice(actor,1,async()=>true);}},{messages:[message]});
 assert.equal(performed,false);assert.equal(records.get(actor.uuid).system.actionDice.value,1);
});
test('transaction metadata is hidden only for its reserved ID and valid lock token, never an ordinary gear item',()=>{
 assert.match(RESOURCE_LOCK_ID,/^[a-zA-Z0-9]{16}$/);assert.match(GC_RESOURCE_LOCK_ID,/^[a-zA-Z0-9]{16}$/);
 assert.equal(isResourceLock({...lock('token'),id:RESOURCE_LOCK_ID}),true);assert.equal(isResourceLock({id:RESOURCE_LOCK_ID,type:'gear'}),false);assert.equal(isResourceLock({...lock('token'),id:'other'}),false);
});

class Values extends Map{[Symbol.iterator](){return this.values();}}
function nativeGC(){
 reset();const server=new Map(),cache=new Map();
 class Setting{
  constructor(key,value={},id=null){this.key=key;this.value=copy(value);this.id=id;}
  toObject(){return {_id:this.id,key:this.key,value:copy(this.value)};}
  updateSource(data){this.id=data._id;this.key=data.key;this.value=copy(data.value);}
  static database={get:async(_type,{query})=>{const row=server.get(query.key);return row?[new Setting(query.key,row.value,row._id)]:[];}};
 }
 const get=(key)=>{if(!cache.has(key))cache.set(key,new Setting(key));return cache.get(key);};
 game.settings={get:(ns,key,options={})=>{const doc=get(`${ns}.${key}`);return options.document?doc:doc.value;},set:async(ns,key,value)=>{const name=`${ns}.${key}`,row={_id:`setting-${key}`,key:name,value:copy(value)};server.set(name,row);get(name).updateSource(row);return copy(value);},storage:{get:()=>({set:(id,doc)=>cache.set(doc.key,doc),delete:id=>{for(const [key,doc] of cache)if(doc.id===id)cache.delete(key);}})}};
 game.spycraft2={resourceLocks:{native:true,run:runNativeResourceTransaction}};
 const a=new NativeActor('a'),b=new NativeActor('b');a._stats={createdTime:1};b._stats={createdTime:2};game.actors=new Values([[a.id,a],[b.id,b]]);
 return {a,b,server,cache};
}
test('native GC transactions bind one existing bookkeeping actor and refresh server currency before each spend',async()=>{
 const {a,server}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'s'});const initial=await initializeGCDice({playersPresent:0,caliber:1});assert.equal(initial.controllerId,a.id);assert.equal(initial.value,2);
 server.get('spycraft2.gcActionDice').value.value=1;const outcomes=await Promise.allSettled([adjustGCDice(-1,'First spend'),adjustGCDice(-1,'Second spend')]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(gcDiceStatus().value,0);assert.equal(records.get(a.uuid).items.length,0);
});
test('a GC critical already holding the shared controller does not enter a nested queue or deadlock behind an adjustment',async()=>{
 const {a,b}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'s'});await initializeGCDice({playersPresent:0,caliber:1});await adjustGCDice(-1,'Fixture balance one');
 const critical=queueResources([a,b],()=>spendGCDice(1,async()=>true));
 const award=adjustGCDice(1,'Later award');const result=await Promise.all([critical,award]);assert.equal(result[0],true);assert.equal(gcDiceStatus().value,1);assert.equal(records.get(a.uuid).items.length,0);assert.equal(records.get(b.uuid).items.length,0);
});
test('removing the GC bookkeeping actor blocks spending; explicit recovery rebinds it without refilling currency',async()=>{
 const {a,b}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'s'});await initializeGCDice({playersPresent:0,caliber:1});await adjustGCDice(-1,'Fixture balance one');game.actors.delete(a.id);records.delete(a.uuid);
 await assert.rejects(adjustGCDice(-1,'Unavailable controller'),/removed/);await assert.rejects(recoverGCBookkeeping(),/stopped/);
 await recoverGCBookkeeping({confirmed:true});assert.equal(gcDiceController().id,b.id);assert.equal(gcDiceStatus().value,1);assert.equal(gcDiceStatus().session,'s');
});
test('a session change on the server expires a stale client’s GC pool before any further payment',async()=>{
 const {server}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'s'});await initializeGCDice({playersPresent:0,caliber:1});server.get('spycraft2.usagePeriods').value.session='next';let performed=false;
 await assert.rejects(spendGCDice(1,async()=>{performed=true;}),/Initialize/);assert.equal(performed,false);assert.equal(gcDiceStatus().current,false);assert.equal(server.get('spycraft2.gcActionDice').value.value,2);
});
test('period transitions include distinct unlinked agent tokens and do not reset usage while a resource action is still executing',async()=>{
 const {a}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'s'});
 const synthetic=new NativeActor('token',1,{uuid:'Scene.s.Token.t.Actor.token',isToken:true});synthetic.type='agent';
 game.scenes=[{tokens:[{actor:a},{actor:synthetic}]}];const actors=periodResourceActors();assert.equal(actors.filter(actor=>actor.uuid===a.uuid).length,1);assert.ok(actors.includes(synthetic));
 let release;const gate=new Promise(resolve=>{release=resolve;}),action=queueResources([a],()=>payLockedActionDice(a,1,()=>gate));
 const transition=queueResources([a],()=>game.settings.set('spycraft2','usagePeriods',{session:'next'}));
 await new Promise(resolve=>setTimeout(resolve,5));assert.equal(game.settings.get('spycraft2','usagePeriods').session,'s');release(true);await Promise.all([action,transition]);assert.equal(game.settings.get('spycraft2','usagePeriods').session,'next');
});

test('a base actor and its unlinked token can participate in one period transaction without conflicting on the inherited mutex',async()=>{
 reset();const root=new NativeActor('a'),uuid='Scene.s.Token.t.Actor.a',token=new NativeActor('a',1,{uuid,isToken:true});
 class Scene{static database={get:async()=>{const source=copy(records.get(uuid));source.items=[...copy(records.get(root.uuid).items),...source.items];return [{tokens:new Map([['t',{actor:new NativeActor('a',0,{source,uuid})}]])}];}};}
 token.token={id:'t',actorId:'a',parent:Object.assign(new Scene(),{id:'s',documentName:'Scene'})};
 let performed=false;await runNativeResourceTransaction([token,root],async()=>{performed=true;await assert.rejects(recoverResourceTransaction(token,{confirmed:true}),/still executing/);});
 assert.equal(performed,true);assert.equal(records.get(root.uuid).items.length,0);assert.equal(records.get(uuid).items.length,0);
});
test('an unrelated character resource action and GC pool adjustment use independent mutex scopes',async()=>{
 const {a}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'s'});await initializeGCDice({playersPresent:0,caliber:1});
 await queueResources([a],async()=>{const pool=await adjustGCDice(1,'Concurrent independent award');assert.equal(pool.value,3);});
 assert.equal(gcDiceStatus().value,3);assert.equal(records.get(a.uuid).items.length,0);
});

test('a stored roll cannot switch its acting character while a transaction is being prepared',async()=>{
 reset();const actor=new NativeActor('a');let performed=false;
 class Message{constructor(actorUuid){this.id='m';this.documentName='ChatMessage';this.flags={spycraft2:{actorUuid}};}toObject(){return {flags:this.flags};}updateSource(source){this.flags=copy(source.flags);}static database={get:async()=>[new Message('Actor.other')]};}
 const message=new Message(actor.uuid);await assert.rejects(runNativeResourceTransaction([actor],async()=>{performed=true;},{messages:[message]}),/acting character changed/);assert.equal(performed,false);assert.equal(records.get(actor.uuid).items.length,0);
});

test('recovering expired GC bookkeeping preserves its old session and never initializes a zero pool for the new session',async()=>{
 const {server}=nativeGC();await game.settings.set('spycraft2','usagePeriods',{session:'old'});await initializeGCDice({playersPresent:0,caliber:1});await game.settings.set('spycraft2','usagePeriods',{session:'new'});
 await recoverGCBookkeeping({confirmed:true});const stored=server.get('spycraft2.gcActionDice').value;assert.equal(stored.session,'old');assert.equal(stored.value,2);assert.equal(gcDiceStatus().current,false);
 const current=await initializeGCDice({playersPresent:1,caliber:1});assert.equal(current.session,'new');assert.equal(current.value,3);
});

test('GC bookkeeping bootstrap chooses the same parent for tied creation times independently of browser collation',async()=>{
 nativeGC();const upper=new NativeActor('Aaaaaaaaaaaaaaaa'),lower=new NativeActor('aaaaaaaaaaaaaaaa');upper._stats=lower._stats={createdTime:1};game.actors=new Values([[lower.id,lower],[upper.id,upper]]);
 await game.settings.set('spycraft2','usagePeriods',{session:'s'});const pool=await initializeGCDice({playersPresent:0,caliber:1});assert.equal(pool.controllerId,upper.id);
});

test('a ready world cannot silently fall back to client-only spending if its transaction service is unavailable',async()=>{
 reset();game.ready=true;const actor=new NativeActor('a');let performed=false;
 try{await assert.rejects(queueResources([actor],async()=>{performed=true;}),/service is unavailable/);await assert.rejects(initializeGCDice({playersPresent:1,caliber:1}),/service is unavailable/);assert.equal(performed,false);assert.equal(records.get(actor.uuid).system.actionDice.value,1);}
 finally{delete game.ready;}
});
test('the low-level paying gateway rejects Shaken IV and invalid sources without a debit or callback',async()=>{for(const state of [{conditionContext:{shakenGrade:4}},{shakenState:{sourceKind:'effects',needsReview:true,grade:null}}]){const a=new NativeActor('shaken'+(++nonce),2);Object.assign(a.system,state);let called=false;await assert.rejects(payLockedActionDice(a,1,async()=>{called=true;}),/Shaken/);assert.equal(called,false);assert.equal(a.system.actionDice.value,2);}});
