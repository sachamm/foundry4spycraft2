import test from 'node:test';import assert from 'node:assert/strict';
import {startingGCDice,gcDiceStatus,initializeGCDice,adjustGCDice,spendGCDice,withGCDicePool,reviewGCDiceSettlement,withGCPeriodLock,recordGCHint} from '../module/rules/gc-dice.mjs';
let settings={usagePeriods:{session:'session1'},gcActionDice:{}};
globalThis.game={user:{isGM:true},settings:{get:(_scope,key)=>settings[key],set:async(_scope,key,value)=>{settings[key]=structuredClone(value);return value;}}};
test('RAW p.397: GC starts with present player characters plus twice mission Caliber, without a fixed die type',()=>{
 assert.equal(startingGCDice(5,4),13);for(let caliber=1;caliber<=5;caliber++)assert.equal(startingGCDice(3,caliber),3+2*caliber);
 for(const [players,caliber] of [[-1,1],[1.5,2],[2,0],[2,6],[2,2.5]])assert.throws(()=>startingGCDice(players,caliber));
});
test('GC initialization is explicit, rejects accidental replacement, and session changes expire unspent dice',async()=>{
 settings={usagePeriods:{session:'session1'},gcActionDice:{}};await initializeGCDice({playersPresent:5,caliber:4});assert.equal(gcDiceStatus().value,13);assert.equal(gcDiceStatus().current,true);
 await assert.rejects(initializeGCDice({playersPresent:1,caliber:1}),/already initialized/);
 settings.usagePeriods.session='session2';assert.equal(gcDiceStatus().value,0);assert.equal(gcDiceStatus().current,false);
 await initializeGCDice({playersPresent:3,caliber:2});assert.equal(gcDiceStatus().value,7);
});
test('only the GC can change or spend the pool; adjustments need reasons and may not overdraw',async()=>{
 game.user.isGM=false;await assert.rejects(adjustGCDice(1,'Hint'),/Only the GC/);await assert.rejects(spendGCDice(1,async()=>{}),/Only the GC/);game.user.isGM=true;
 await adjustGCDice(1,'Helpful hint');assert.equal(gcDiceStatus().value,8);await adjustGCDice(4,'Caliber II to IV');assert.equal(gcDiceStatus().value,12);
 await assert.rejects(adjustGCDice(-13,'Event'),/Not enough/);await assert.rejects(adjustGCDice(1,''),/reason/);
});
test('queued GC payments cannot overspend and failed execution refunds only the reserved dice',async()=>{
 await initializeGCDice({playersPresent:0,caliber:1,replaceExisting:true});
 const results=await Promise.allSettled([spendGCDice(2,async()=>true),spendGCDice(1,async()=>true)]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.equal(gcDiceStatus().value,0);
 await adjustGCDice(3,'Award gains');await assert.rejects(spendGCDice(2,async()=>{settings.gcActionDice.value++;throw Error('message failed');}),/message failed/);assert.equal(gcDiceStatus().value,4);
 await assert.rejects(spendGCDice(1,async()=>{settings.usagePeriods.session='session3';settings.gcActionDice={value:9,session:'session3'};throw Error('session changed');}),/session changed/);assert.equal(gcDiceStatus().value,9);await reviewGCDiceSettlement({value:9,confirmed:true,resolution:'New session pool verified'});
});
globalThis.Actor=class{constructor(){this.uuid='Actor.test';this.type='agent';this.isOwner=true;this.system={actionDice:{value:4}};}};globalThis.ui={notifications:{warn:()=>null}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
test('GC critical activation charges the session pool rather than the acting character, and failed messages refund it',async()=>{
 const actor=new SpycraftActor();const check={actorUuid:actor.uuid,checkKind:'skill',errorConfirmed:true};
 const message={flags:{spycraft2:check},async update(data){this.flags.spycraft2=data['flags.spycraft2'];}};
 const options={kind:'failure',payerId:'gc',effect:'False information',effectConfirmed:true,baseCost:1,opponent:true,lineOfSight:true};
 await actor.activateCritical(message,options);assert.equal(gcDiceStatus().value,8);assert.equal(actor.system.actionDice.value,4);assert.equal(message.flags.spycraft2.criticalActivation.payerUuid,'GC');
 const bad={flags:{spycraft2:check},async update(){throw Error('message failed');}};await assert.rejects(actor.activateCritical(bad,options),/message failed/);assert.equal(gcDiceStatus().value,8);
});

test('malformed current GC balances block spending, awards and adjustments without changing records; correction requires explicit replacement',async()=>{
 game.user.isGM=true;for(const value of [-1,0.5,'4',null,undefined,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){settings={usagePeriods:{session:'review'},gcActionDice:{session:'review',value}};const before=structuredClone(settings.gcActionDice);assert.equal(gcDiceStatus().counterReview,true);assert.equal(gcDiceStatus().value,0);let called=0;await assert.rejects(spendGCDice(1,async()=>called++),/Review/);await assert.rejects(adjustGCDice(1,'Hint'),/Review/);await assert.rejects(withGCDicePool(()=>called++),/Review/);await assert.rejects(initializeGCDice({playersPresent:1,caliber:1}),/already initialized/);assert.equal(called,0);assert.deepEqual(settings.gcActionDice,before);}
 await initializeGCDice({playersPresent:1,caliber:1,replaceExisting:true});assert.equal(gcDiceStatus().value,3);assert.equal(gcDiceStatus().counterReview,undefined);settings.usagePeriods.session='new';settings.gcActionDice.value='invalid old balance';assert.equal(gcDiceStatus().counterReview,undefined);await initializeGCDice({playersPresent:0,caliber:1});assert.equal(gcDiceStatus().value,2);
});
test('GC initialization, adjustment and refunds reject unsafe arithmetic instead of losing the recorded balance',async()=>{
 assert.throws(()=>startingGCDice(Number.MAX_SAFE_INTEGER,1),/safe whole/);settings={usagePeriods:{session:'safe'},gcActionDice:{session:'safe',value:Number.MAX_SAFE_INTEGER}};await assert.rejects(adjustGCDice(1,'Hint'),/safe whole/);assert.equal(settings.gcActionDice.value,Number.MAX_SAFE_INTEGER);settings.gcActionDice.value=2;await assert.rejects(spendGCDice(1,async()=>{settings.gcActionDice.value='corrupt';throw Error('post failed');}),/post failed/);assert.equal(settings.gcActionDice.value,'corrupt');
});

function fresh(){settings={usagePeriods:{session:'fault'},gcActionDice:{session:'fault',value:5}};game.user={isGM:true,id:'gm'};game.spycraft2={};game.settings.set=async(_s,key,value)=>{settings[key]=structuredClone(value);return value;};}
test('GC reservation errors before commit apply no effect; committed reservations execute once',async()=>{
 fresh();const set=game.settings.set;let called=0;game.settings.set=async()=>{throw Error('reserve rejected');};await assert.rejects(spendGCDice(1,async()=>called++),/rejected/);assert.equal(called,0);assert.equal(settings.gcActionDice.value,5);
 game.settings.set=async(...args)=>{await set(...args);throw Error('committed write');};assert.equal(await spendGCDice(2,async()=>++called),1);assert.equal(settings.gcActionDice.value,3);assert.equal(settings.gcActionDice.settlementReview.outcome,'spent');
});
test('GC failed effects refund their delta, including committed refund errors, preserving later gains',async()=>{
 fresh();const set=game.settings.set;game.settings.set=async(...args)=>{await set(...args);if(args[2].settlementReview?.outcome==='refunded')throw Error('refund committed');};await assert.rejects(spendGCDice(2,async()=>{settings.gcActionDice.value+=3;throw Error('effect failed');}),/effect failed/);assert.equal(settings.gcActionDice.value,8);assert.equal(settings.gcActionDice.settlementReview.needsReview,false);
});
test('uncertain GC effects retain one payment and block spending, awards, adjustment, replacement and period changes until absolute review',async()=>{
 fresh();await assert.rejects(spendGCDice(2,async()=>{const e=Error('cleanup uncertain');e.actionDiceSettlementReview={};throw e;},{messageUuid:'ChatMessage.test'}),/uncertain/);assert.equal(settings.gcActionDice.value,3);assert.equal(settings.gcActionDice.settlementReview.messageUuid,'ChatMessage.test');
 for(const work of [()=>spendGCDice(1,async()=>{}),()=>withGCDicePool(()=>{}),()=>adjustGCDice(1,'hint'),()=>initializeGCDice({playersPresent:1,caliber:1,replaceExisting:true}),()=>withGCPeriodLock(()=>{})])await assert.rejects(work(),/interrupted GC payment/);
 for(const value of [null,true,'',-1,1.5])await assert.rejects(reviewGCDiceSettlement({value,confirmed:true,resolution:'checked'}),/whole-die/);
 await reviewGCDiceSettlement({value:3,confirmed:true,resolution:'Effect retained; debit correct'});assert.equal(settings.gcActionDice.value,3);assert.equal(game.spycraft2.pendingGCDiceReview,undefined);await assert.rejects(reviewGCDiceSettlement({value:5,confirmed:true,resolution:'duplicate'}),/no interrupted/);
});
test('failed GC refunds and final payment records remain reviewable; committed review writes resolve without duplicate credit',async()=>{
 fresh();const set=game.settings.set;game.settings.set=async(...args)=>{if(args[2].settlementReview?.outcome==='refunded')throw Error('refund rejected');return set(...args);};await assert.rejects(spendGCDice(1,async()=>{throw Error('effect rejected');}),/needs review/);assert.equal(settings.gcActionDice.value,4);assert.equal(settings.gcActionDice.settlementReview.needsReview,true);
 game.settings.set=async(...args)=>{await set(...args);throw Error('review committed');};await reviewGCDiceSettlement({value:5,confirmed:true,resolution:'No effect; refund confirmed'});assert.equal(settings.gcActionDice.value,5);
 fresh();const normal=game.settings.set;let effects=0;game.settings.set=async(...args)=>{if(args[2].settlementReview?.outcome==='spent')throw Error('final rejected');return normal(...args);};await assert.rejects(spendGCDice(1,async()=>effects++),/final rejected/);assert.equal(effects,1);assert.equal(settings.gcActionDice.value,4);assert.equal(settings.gcActionDice.settlementReview.needsReview,true);game.settings.set=normal;await reviewGCDiceSettlement({value:4,confirmed:true,resolution:'Effect committed'});assert.equal(settings.gcActionDice.value,4);
});
test('GC reconciliation freezes balance, session, receipt and role while its dialog is open',async()=>{
 for(const change of [()=>settings.gcActionDice.value++,()=>settings.usagePeriods.session='other',()=>settings.gcActionDice.settlementReview.count++,()=>game.user.isGM=false]){
  fresh();await assert.rejects(spendGCDice(1,async()=>{const e=Error('hold');e.actionDiceSettlementReview={};throw e;}));globalThis.foundry={utils:{escapeHTML:String},applications:{api:{DialogV2:{input:async()=>{change();return {value:4,confirmed:true,resolution:'checked'};}}}}};await assert.rejects(reviewGCDiceSettlement(),/changed|Only the GC/);assert.equal(settings.gcActionDice.settlementReview.needsReview,true);
 }
 fresh();
});

test('RAW p.398 ordinary helpful hints add one GC die and no character dice, XP or awards',async()=>{
 fresh();foundry.utils.escapeHTML=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');const posts=[];game.messages=posts;globalThis.ChatMessage={create:async data=>{const m={...data,id:'hint',uuid:'ChatMessage.hint'};posts.push(m);return m;}};
 for(const input of [{text:''},{text:'clue'},{text:'clue',helpfulConfirmed:false}])await assert.rejects(recordGCHint(input),/helpful hint/);
 const a=new SpycraftActor(),before=structuredClone(a.system);await recordGCHint({text:'<clue>',helpfulConfirmed:true});assert.equal(settings.gcActionDice.value,6);assert.deepEqual(a.system,before);assert.equal(posts.length,1);assert.match(posts[0].content,/&lt;clue&gt;/);assert.ok(!posts[0].content.includes('<clue>'));assert.equal(posts[0].flags.spycraft2.actionDiceAllowed,false);
 game.user.isGM=false;await assert.rejects(recordGCHint({text:'clue',helpfulConfirmed:true}),/Only the GC/);game.user.isGM=true;settings.gcActionDice.value=Number.MAX_SAFE_INTEGER;await assert.rejects(recordGCHint({text:'clue',helpfulConfirmed:true}),/safe whole/);
});
test('GC hint committed credit/post/final writes keep one credit; rejected posts restore only their own gain',async()=>{
 for(const boundary of ['credit','post','final','reject']){
  fresh();const posts=[];game.messages=posts;const set=game.settings.set;globalThis.ChatMessage={create:async data=>{if(boundary==='reject'){settings.gcActionDice.value+=2;throw Error('post rejected');}const m={...data,uuid:'ChatMessage.hint'};posts.push(m);if(boundary==='post')throw Error('post committed');return m;}};
  game.settings.set=async(...args)=>{await set(...args);if(boundary==='credit'&&args[2].settlementReview?.needsReview||boundary==='final'&&args[2].settlementReview?.outcome==='credited')throw Error('setting committed');};
  if(boundary==='reject'){await assert.rejects(recordGCHint({text:'clue',helpfulConfirmed:true}),/post rejected/);assert.equal(settings.gcActionDice.value,7);assert.equal(posts.length,0);}else{await recordGCHint({text:'clue',helpfulConfirmed:true});assert.equal(settings.gcActionDice.value,6);assert.equal(posts.length,1);}assert.equal(settings.gcActionDice.settlementReview.needsReview,false);
 }
});
test('uncertain GC hint restoration holds the actual balance for review without posting another hint',async()=>{
 fresh();const set=game.settings.set;game.messages=[];globalThis.ChatMessage={create:async()=>{throw Error('post rejected');}};game.settings.set=async(...args)=>{if(args[2].settlementReview?.outcome==='cancelled')throw Error('rollback rejected');return set(...args);};await assert.rejects(recordGCHint({text:'clue',helpfulConfirmed:true}),/needs review/);assert.equal(settings.gcActionDice.value,6);await assert.rejects(recordGCHint({text:'another',helpfulConfirmed:true}),/interrupted/);game.settings.set=set;await reviewGCDiceSettlement({value:5,confirmed:true,resolution:'No hint posted; confirmed credit removed'});assert.equal(settings.gcActionDice.value,5);
});
