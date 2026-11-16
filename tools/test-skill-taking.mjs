// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SPYCRAFT as cfg} from '../module/config.mjs';
import {resolveSkillCheck} from '../module/rules/skills.mjs';
const check={name:'Test Check',id:'test',attributes:['int'],mode:'Active',tags:'',error:1,time:'1 Minute (Take 10/Take 20)',page:97};
const system=multiplier=>({skillTotals:{analysis:{name:'Analysis',ranks:1,cap:20,threat:19,totals:[{ability:'int',total:30}],take10TimeMultiplier:multiplier}},abilities:{int:{mod:0}}});

test('RAW pp.97–98: fixed checks use the correct time multiplier and cannot threaten or receive action-die boosts',()=>{
 for(const [method,multiplier] of [['take10',2],['take20',20]]){
  const result=resolveSkillCheck(system(2),'analysis',check,{gearStatus:'available',method,safeToTake:true});
  assert.equal(result.blocked,false);assert.equal(result.fixedDie,method==='take10'?10:20);assert.equal(result.timeMultiplier,multiplier);
  assert.equal(result.threat,0);assert.equal(result.error,0);assert.equal(result.cap,20);assert.equal(result.actionDiceAllowed,false);
 }
 assert.equal(resolveSkillCheck(system(1),'analysis',check,{gearStatus:'available',method:'take10',safeToTake:true}).timeMultiplier,1);
 assert.equal(resolveSkillCheck(system(1),'analysis',check,{gearStatus:'available',method:'take20',safeToTake:true}).timeMultiplier,20);
});

test('RAW pp.97–98: taking requires safety, error <=1, no Concentration tag, and permission for that named use',()=>{
 for(const method of ['take10','take20']){
  assert.ok(resolveSkillCheck(system(2),'analysis',check,{gearStatus:'available',method}).blockedReason.includes('distracted'));
  assert.ok(resolveSkillCheck(system(2),'analysis',{...check,error:2},{gearStatus:'available',method,safeToTake:true}).blockedReason.includes('error range'));
  assert.ok(resolveSkillCheck(system(2),'analysis',{...check,tags:'Concentration'},{gearStatus:'available',method,safeToTake:true}).blockedReason.includes('Concentration'));
  assert.ok(resolveSkillCheck(system(2),'analysis',{...check,time:'1 Minute'},{gearStatus:'available',method,safeToTake:true}).blockedReason.includes('does not permit'));
 }
 const sys=system(1);sys.skillTotals.analysis.errorReduction=2;sys.skillTotals.analysis.errorFloor=1;
 assert.equal(resolveSkillCheck(sys,'analysis',{...check,error:3},{gearStatus:'available',method:'take10',safeToTake:true}).blocked,false);
 sys.skillTotals.analysis.ranks=0; // The untrained increase is applied before the eligibility check.
 assert.equal(resolveSkillCheck(sys,'analysis',{...check,error:3},{gearStatus:'available',method:'take10',safeToTake:true}).blocked,true);
});

test('taking a fixed result still rejects a result cap below 5',()=>{
 const sys=system(1);sys.skillTotals.analysis.cap=0;
 assert.equal(resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',method:'take10',safeToTake:true}).blocked,true);
});

globalThis.Actor=class {};
globalThis.CONFIG={SPYCRAFT:cfg};
globalThis.foundry={utils:{escapeHTML:s=>s}};
globalThis.game={i18n:{localize:s=>s,format:s=>s}};
globalThis.ChatMessage={getSpeaker:()=>({})};
const notices=[];globalThis.ui={notifications:{warn:message=>{notices.push(message);return null;}}};
let formula;
globalThis.Roll=class {
 constructor(value,data){formula=value;this.total=Number(value.split(' ')[0])+data.total;this.dice=[];}
 async evaluate(){return this;}
 async toMessage(data,options){return {data,options};}
};
const {SpycraftActor}=await import('../module/documents/actor.mjs');

test('document integration posts a capped fixed 20 with no natural die, threat, error or action-die permission',async()=>{
 const [key,use]=Object.values(cfg.skills).flatMap(skill=>skill.checks.filter(c=>c.time.includes('Take 20')&&!c.tags.includes('Concentration')&&c.error===1).map(c=>[skill.key,c]))[0];
 const actor=new SpycraftActor();actor.system={skillTotals:{[key]:{name:'Test',ranks:1,cap:20,threat:19,totals:use.attributes.map(ability=>({ability,total:30}))}}};
 const result=await actor.rollSkill(key,null,{gearStatus:'available',check:use.id,method:'take20',safeToTake:true});
 assert.equal(formula,'20 + @total');
 assert.equal(result.data.flags.spycraft2.effectiveTotal,20);assert.equal(result.data.flags.spycraft2.rawTotal,50);
 assert.equal(result.data.flags.spycraft2.naturalDie,null);assert.equal(result.data.flags.spycraft2.actionDiceAllowed,false);
 assert.ok(!result.data.flavor.includes('spycraft2-threat'));assert.ok(!result.data.flavor.includes('spycraft2-error'));
 const blocked=await actor.rollSkill(key,null,{gearStatus:'available',check:use.id,method:'take20'});
 assert.equal(blocked,null);assert.ok(notices.at(-1).includes('distracted'));
});

test('all nine permission-qualified uses require an explicit GC declaration for each supported fixed method',()=>{
 const rows=Object.values(cfg.skills).flatMap(skill=>skill.checks.filter(c=>/with permission/i.test(c.time)).map(check=>({skill,check})));assert.equal(rows.length,9);for(const {skill,check} of rows){const s={skillTotals:{[skill.key]:{name:skill.name,ranks:6,cap:30,threat:20,totals:check.attributes.map(ability=>({ability,total:9}))}}};for(const method of ['take10','take20'].filter(m=>check.time.includes(m==='take10'?'Take 10':'Take 20'))){for(const gcTakingPermissionConfirmed of [undefined,false,'true',1]){const p=resolveSkillCheck(s,skill.key,check,{gearStatus:'available',method,safeToTake:true,gcTakingPermissionConfirmed});assert.equal(p.blocked,true);assert.match(p.blockedReason,/GC’s permission/);}const valid=resolveSkillCheck(s,skill.key,check,{gearStatus:'available',method,safeToTake:true,gcTakingPermissionConfirmed:true});assert.doesNotMatch(valid.blockedReason,/GC’s permission/);assert.equal(valid.gcTakingPermissionConfirmed,true);assert.match(valid.notes,/permission.*confirmed/);}}
});
test('ordinary named taking uses do not gain a new permission requirement; rolled checks need no fixed-result permission',()=>{
 for(const skill of Object.values(cfg.skills))for(const check of skill.checks){const s={skillTotals:{[skill.key]:{name:skill.name,ranks:6,cap:30,threat:20,totals:check.attributes.map(ability=>({ability,total:9}))}}};const rolled=resolveSkillCheck(s,skill.key,check,{gearStatus:'available'});assert.doesNotMatch(rolled.blockedReason,/GC’s permission/);assert.equal(rolled.gcTakingPermissionConfirmed,false);if(!/with permission/i.test(check.time))for(const method of ['take10','take20'])assert.doesNotMatch(resolveSkillCheck(s,skill.key,check,{gearStatus:'available',method,safeToTake:true}).blockedReason,/GC’s permission/);}
});
test('normal-time class taking does not waive a named permission requirement, and permission does not waive safety or unsupported methods',()=>{
 const check=cfg.skills.tactics.checks.find(c=>c.id==='ambush'),s={skillTotals:{tactics:{name:'Tactics',ranks:6,cap:30,threat:20,totals:[{ability:'wis',total:9}],take10TimeMultiplier:1}}};assert.match(resolveSkillCheck(s,'tactics',check,{gearStatus:'available',method:'take10',safeToTake:true}).blockedReason,/GC’s permission/);assert.match(resolveSkillCheck(s,'tactics',check,{gearStatus:'available',method:'take10',gcTakingPermissionConfirmed:true}).blockedReason,/distracted/);const maneuver=cfg.skills.tactics.checks.find(c=>c.id==='maneuver');s.skillTotals.tactics.totals.push({ability:'cha',total:9});assert.match(resolveSkillCheck(s,'tactics',maneuver,{gearStatus:'available',method:'take20',safeToTake:true,gcTakingPermissionConfirmed:true}).blockedReason,/does not permit/);
});
test('the real fixed-check path rejects missing permission before rolling and records the explicit declaration on success',async()=>{
 const a=new SpycraftActor();a.system={skillTotals:{tactics:{name:'Tactics',ranks:6,cap:30,threat:20,totals:[{ability:'wis',total:9}]}}};const options={check:'ambush',method:'take10',safeToTake:true};assert.equal(await a.rollSkill('tactics','wis',{gearStatus:'available',...(options)}),null);assert.match(notices.at(-1),/GC’s permission/);const m=await a.rollSkill('tactics','wis',{gearStatus:'available',...options,gcTakingPermissionConfirmed:true});assert.equal(m.data.flags.spycraft2.gcTakingPermissionConfirmed,true);assert.equal(m.data.flags.spycraft2.naturalDie,null);assert.equal(m.data.flags.spycraft2.actionDiceAllowed,false);assert.equal(m.data.flags.spycraft2.ambush.requiredPreparationSeconds,1200);
});

test('Well-Funded waives only the final error-range restriction for Bureaucracy Bribe take 10 across every named skill use',()=>{let found=0;for(const skill of Object.values(cfg.skills))for(const check of skill.checks){const s={activeFeatNames:['Well-Funded'],skillTotals:{[skill.key]:{name:skill.name,ranks:6,cap:30,threat:20,totals:check.attributes.map(ability=>({ability,total:9}))}}},use={...check,error:3,time:'1 Minute (Take 10/Take 20)',tags:''};for(const method of ['roll','take10','take20']){const p=resolveSkillCheck(s,skill.key,use,{gearStatus:'available',method,safeToTake:true}),eligible=skill.key==='bureaucracy'&&check.id==='bribe'&&method==='take10';assert.equal(!!p.fundedTaking,eligible,skill.key+':'+check.id+':'+method);if(method==='take10'||method==='take20')assert.equal(/final error range/.test(p.blockedReason),!eligible);if(eligible){found++;assert.equal(p.fundedTaking.errorBefore,3);assert.equal(p.timeMultiplier,2);assert.equal(p.fixedDie,10);assert.equal(p.actionDiceAllowed,false);assert.equal(p.threat,0);assert.equal(p.error,0);}}}assert.equal(found,1);});
test('Well-Funded does not waive safety, Concentration, unsupported methods or caps and requires the active feat',()=>{const c=cfg.skills.bureaucracy.checks.find(c=>c.id==='bribe'),s={activeFeatNames:['Well-Funded'],skillTotals:{bureaucracy:{name:'Bureaucracy',ranks:6,cap:30,threat:20,totals:c.attributes.map(ability=>({ability,total:9}))}}},opts={method:'take10',gearStatus:'available',safeToTake:true};assert.match(resolveSkillCheck(s,'bureaucracy',{...c,error:5},{...opts,safeToTake:false}).blockedReason,/distracted/);assert.match(resolveSkillCheck(s,'bureaucracy',{...c,error:5,tags:'Concentration'},opts).blockedReason,/Concentration/);assert.equal(resolveSkillCheck(s,'bureaucracy',{...c,error:5,time:'1 Full Action'},opts).blocked,false);s.skillTotals.bureaucracy.cap=4;assert.match(resolveSkillCheck(s,'bureaucracy',{...c,error:5},opts).blockedReason,/below 5/);s.skillTotals.bureaucracy.cap=30;s.activeFeatNames=[];assert.match(resolveSkillCheck(s,'bureaucracy',{...c,error:5},opts).blockedReason,/error range/);});
test('the actual Bribe fixed-result receipt records and freezes the Well-Funded permission; source loss during evaluation blocks posting',async()=>{const a=new SpycraftActor();a.system={activeFeatNames:['Well-Funded'],skillTotals:{bureaucracy:{name:'Bureaucracy',ranks:0,cap:20,threat:20,totals:[{ability:'cha',total:3}]}}};a.items=new Map();const opts={check:'bribe',method:'take10',safeToTake:true,gearStatus:'available'};const m=await a.rollSkill('bureaucracy','cha',opts);assert.equal(m.data.flags.spycraft2.fundedTaking.source,'Well-Funded');assert.ok(m.data.flags.spycraft2.fundedTaking.errorBefore>1);assert.equal(m.data.flags.spycraft2.naturalDie,null);assert.equal(m.data.flags.spycraft2.actionDiceAllowed,false);const{rollEvidence,rollEvidenceMatches}=await import('../module/rules/outcomes.mjs');const f=m.data.flags.spycraft2,changed=structuredClone(f);changed.fundedTaking.errorBefore++;assert.notEqual(rollEvidence(f),rollEvidence(changed));assert.equal(rollEvidenceMatches(rollEvidence(f),changed),false);const original=Roll.prototype.evaluate;Roll.prototype.evaluate=async function(){a.system.activeFeatNames=[];return this;};try{await assert.rejects(a.rollSkill('bureaucracy','cha',opts),/changed/);}finally{Roll.prototype.evaluate=original;}});
