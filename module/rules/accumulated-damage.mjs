import {subdualDefensePlan} from './subdual-defense.mjs';
import {stressDefensePlan} from './stress-defense.mjs';
const bands=[
 {tier:1,dc:12,stress:'Shaken I',knockout:'1 round'},
 {tier:2,dc:16,stress:'Shaken II',knockout:'1 minute'},
 {tier:3,dc:20,stress:'Shaken III',knockout:'1 hour'},
 {tier:4,dc:24,stress:'Shaken IV',knockout:'1 day'},
 {tier:5,dc:28,stress:'Drained (1 level)',knockout:'1 week'}
];
/** pp.339–340: declared accumulated damage and new damage AFTER all separately adjudicated defenses. */
export function accumulatedDamagePlan(system,{kind,currentDamage,newDamage,criticalHit=false,confirmed=false}={}){
 if(!['stress','subdual'].includes(kind))throw new Error('Choose stress or subdual damage.');
 if(confirmed!==true||typeof criticalHit!=='boolean')throw new Error('The GC must confirm the existing total, new damage after all defenses, and whether this is a critical hit.');
 if(![currentDamage,newDamage].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isSafeInteger(currentDamage+newDamage))throw new Error('Enter safe nonnegative whole accumulated and new damage totals.');
 const ability=kind==='stress'?'wis':'con',threshold=system[kind+'Threshold']??system.abilities?.[ability]?.value;
 if(!Number.isSafeInteger(threshold)||threshold<0||!Number.isSafeInteger(threshold*5))throw new Error('Prepare a valid current '+kind+' threshold before calculating its saves.');
 const total=currentDamage+newDamage,rows=bands.map(row=>({...row,thresholdValue:threshold*row.tier})),band=rows.findLast(row=>total>row.thresholdValue)??null,tier=band?.tier??0,saveRequired=newDamage>0&&(tier>0||criticalHit),dc=saveRequired?(criticalHit?(band?band.dc+4:16):band.dc):null;
 return {kind,ability,threshold,currentDamage,newDamage,total,criticalHit,tier,saveRequired,saveKey:kind==='stress'?'will':'fort',dc,rows,failureOutcome:saveRequired&&band?(kind==='stress'?band.stress:'Unconscious'):null,knockoutBase:saveRequired&&band&&kind==='subdual'?band.knockout:null,needsOutcomeReview:saveRequired&&!band,actionDiceDamageAllowed:false,criticalInjuries:false,appliesToVitalityWounds:false};
}

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const eventId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id);
export function validateDamageLedger(ledger){
 if(!ledger||ledger.version!==1||!whole(ledger.revision)||ledger.revision<1||!whole(ledger.stress)||!whole(ledger.subdual)||!Array.isArray(ledger.pending)||ledger.pending.some(id=>!eventId(id))||new Set(ledger.pending).size!==ledger.pending.length)throw new Error('The GC must initialize or review the accumulated-damage ledger.');
 return ledger;
}
export function damageLedgerSnapshot(actor){return {ledger:structuredClone(actor.system.accumulatedDamage??null),events:structuredClone(actor.flags?.spycraft2?.damageEvents??{})};}
function assertSnapshot(current,expected){if(!same(current,expected))throw new Error('The accumulated-damage ledger changed. Review it again.');}
function nextRevision(ledger){const n=(ledger?.revision??0)+1;if(!Number.isSafeInteger(n))throw new Error('The damage-ledger revision is unsafe.');return n;}
export function reviewDamageLedgerPlan(current,expected,{stress,subdual,note,confirmed}={},id,reviewer,at){
 assertSnapshot(current,expected);if(current.ledger)validateDamageLedger(current.ledger);
 if(current.ledger?.pending.length)throw new Error('Resolve the pending damage saves before correcting accumulated totals.');
 if(!whole(stress)||!whole(subdual)||confirmed!==true||typeof note!=='string'||!note.trim()||note.length>500||!eventId(id)||typeof reviewer!=='string'||!reviewer||!Number.isFinite(at))throw new Error('Confirm actual whole stress/subdual totals and a bounded GC review note.');
 const review={id,reviewer,at,note:note.trim(),before:current.ledger?{stress:current.ledger.stress,subdual:current.ledger.subdual}:null,stress,subdual},ledger={version:1,revision:nextRevision(current.ledger),stress,subdual,pending:[],lastReview:review};
 return {ledger,review};
}
export function damageLedgerEventPlan(system,current,expected,{source,kind,newDamage,criticalHit=false,confirmed,damageMode='net',attackKind,armorPiercing=0,armorPiercingAll=false}={},id,at){
 const ledger=validateDamageLedger(current.ledger);
 if(typeof source!=='string'||!source.trim()||source.length>300||!eventId(id)||!Number.isFinite(at))throw new Error('Name this unique damage event with a bounded source reference.');
 if(!current.events||typeof current.events!=='object'||Array.isArray(current.events))throw new Error('Review the damage-event receipt history.');
 const records=Object.values(current.events);if(records.some(r=>!r||r.version!==1||!eventId(r.id)||typeof r.source!=='string'))throw new Error('Review the damage-event receipt history.');
 for(const pending of ledger.pending)if(!current.events[pending]||current.events[pending].state!=='pending')throw new Error('Review the pending damage-save receipts.');
 if(!['net','stressBeforeResistance','fireStressBeforeDefenses','subdualBeforeDefenses'].includes(damageMode)||['stressBeforeResistance','fireStressBeforeDefenses'].includes(damageMode)&&kind!=='stress'||damageMode==='subdualBeforeDefenses'&&kind!=='subdual')throw new Error('Choose resolved net damage or the matching stress/subdual defense calculation.');
 const request={kind,newDamage,criticalHit,damageMode,...(damageMode==='subdualBeforeDefenses'?{attackKind,armorPiercing:armorPiercingAll?0:armorPiercing,armorPiercingAll}:{})};
 const previous=records.find(r=>r.source===source.trim());
 if(previous){if(!same(previous.request??{kind:previous.kind,newDamage:previous.newDamage,criticalHit:previous.criticalHit,damageMode:'net'},request)||confirmed!==true)throw new Error('This source reference already records different damage.');return {duplicate:true,record:previous,ledger};}
 assertSnapshot(current,expected);if(Object.hasOwn(current.events,id))throw new Error('The damage-event reference is already in use.');
 const defenseContext=['stressBeforeResistance','fireStressBeforeDefenses'].includes(damageMode)?stressDefensePlan(system,newDamage,{fromFire:damageMode==='fireStressBeforeDefenses'}):damageMode==='subdualBeforeDefenses'?subdualDefensePlan(system,{rawDamage:newDamage,attackKind,armorPiercing,armorPiercingAll,criticalHit}):null;
 if(defenseContext?.criticalBruisingReview)throw new Error('The GC must resolve whether this critical hit’s bruising retains the critical save before it can be recorded automatically.');
 const appliedDamage=defenseContext?.netDamage??newDamage;
 const plan=accumulatedDamagePlan(system,{kind,currentDamage:ledger[kind],newDamage:appliedDamage,criticalHit,confirmed}),record={version:1,id,source:source.trim(),at,kind,newDamage:appliedDamage,request,defenseContext,criticalHit,before:plan.currentDamage,total:plan.total,state:plan.saveRequired?'pending':'recorded',save:plan.saveRequired?{key:plan.saveKey,dc:plan.dc,threshold:plan.threshold,tier:plan.tier,failureOutcome:plan.failureOutcome,knockoutBase:plan.knockoutBase,needsOutcomeReview:plan.needsOutcomeReview}:null};
 return {duplicate:false,record,ledger:{...ledger,revision:nextRevision(ledger),[kind]:plan.total,pending:[...ledger.pending,...(plan.saveRequired?[id]:[])]}};
}
