import test from 'node:test';import assert from 'node:assert/strict';
import {rulesRefreshChanges,applyRulesRefresh,equivalent} from '../module/rules/refresh.mjs';import {actorRulesRefreshPreview} from '../module/apps/rules-refresh.mjs';
const item=(patch={})=>({id:'weapon',name:'Old name',type:'weapon',system:{damage:'1d6',weight:2,quantity:3,equipped:true,pick:'W',reserve:true,...patch}});

test('rules refresh changes catalog statistics but preserves inventory and character build fields',()=>{
 const before=item(),canonical={name:'Correct name',type:'weapon',system:{damage:'1d8',weight:4,quantity:1,equipped:false,pick:'',reserve:false}};
 const changes=rulesRefreshChanges(before,canonical);assert.deepEqual(changes.map(c=>c.path),['name','system.damage','system.weight']);
 const classItem={id:'class',type:'class',name:'Class',system:{table:[{level:1,bab:0}],choices:{0:2},skillChoices:{versatility1_0:'bluff'},phdSkill:'science'}};
 const next={name:'Class',type:'class',system:{table:[{level:1,bab:1}],choices:{},skillChoices:{},phdSkill:''}};
 assert.deepEqual(rulesRefreshChanges(classItem,next).map(c=>c.path),['system.table']);
 assert.equal(equivalent({a:1,b:2},{b:2,a:1}),true);
});

test('refresh applies only selected fields and stores a before/after backup',async()=>{
 const current=item(),actor={isOwner:true,items:new Map([[current.id,current]]),writes:[],async update(data){this.backup=data['flags.spycraft2.rulesRefreshBackup'];},async updateEmbeddedDocuments(_type,updates){this.writes.push(updates);return updates;}};
 const changes=rulesRefreshChanges(current,{name:current.name,type:'weapon',system:{damage:'1d8',weight:4}});
 await applyRulesRefresh(actor,[changes[0]]);assert.deepEqual(actor.writes[0],[{_id:'weapon','system.damage':'1d8'}]);assert.equal(actor.backup.changes[0].before,'1d6');assert.equal(actor.backup.changes[0].after,'1d8');
});

test('stale refresh previews abort before mutation and update failures restore original selected fields',async()=>{
 const current=item(),canonical={name:current.name,type:'weapon',system:{damage:'1d8'}},changes=rulesRefreshChanges(current,canonical);
 let writes=0;const actor={isOwner:true,items:new Map([[current.id,current]]),async update(){},async updateEmbeddedDocuments(_type,updates){writes++;if(writes===1)throw new Error('update failed');return updates;}};
 current.system.damage='1d10';await assert.rejects(applyRulesRefresh(actor,changes),/changed after the preview/);assert.equal(writes,0);
 current.system.damage='1d6';await assert.rejects(applyRulesRefresh(actor,changes),/update failed/);assert.equal(writes,2);
});

test('refresh matches preserved source IDs and unique legacy names; homebrew and class-ID mismatches remain untouched',async()=>{
 const renamed={_id:'canonical',name:'Correct name',type:'weapon',system:{damage:'1d8'},flags:{spycraft2:{legacyName:'Old name'}}};
 const classCanonical={_id:'class',name:'Class',type:'class',system:{identifier:'canonical',table:[]}};
 globalThis.game={packs:new Map([['spycraft2.weapons',{async getIndex(){return [renamed];},async getDocument(id){return id==='canonical'?renamed:null;}}],['spycraft2.classes',{async getIndex(){return [classCanonical];},async getDocument(){return classCanonical;}}]])};
 const byId=item();byId._stats={compendiumSource:'Compendium.spycraft2.weapons.Item.canonical'};
 const legacy=item();legacy.id='legacy';
 const homebrew=item();homebrew.id='custom';homebrew.name='Unique homebrew';
 const cls={id:'class',name:'Class',type:'class',system:{identifier:'custom'}};
 const preview=await actorRulesRefreshPreview({items:[byId,legacy,homebrew,cls]});
 assert.ok(preview.changes.some(c=>c.itemId==='weapon'));assert.ok(preview.changes.some(c=>c.itemId==='legacy'));
 assert.equal(preview.unmatched.length,2);assert.ok(preview.unmatched.some(s=>s.includes('class identifiers differ')));
});


test('rollback of a formerly absent field uses Foundry deletion syntax, including backup JSON round-trips',async()=>{
 const current=item();delete current.system.source;
 const changes=rulesRefreshChanges(current,{...current,system:{...current.system,source:'p.299'}});let backup,writes=[];
 const actor={isOwner:true,items:new Map([[current.id,current]]),async update(data){backup=JSON.parse(JSON.stringify(data['flags.spycraft2.rulesRefreshBackup']));},async updateEmbeddedDocuments(type,data){writes.push(data);}};
 await applyRulesRefresh(actor,changes);assert.equal(writes[0][0]['system.source'],'p.299');
 current.system.source='p.299';const reversed=backup.changes.map(c=>({...c,before:c.after,after:c.before}));await applyRulesRefresh(actor,reversed);
 assert.equal(writes[1][0]['system.-=source'],null);assert.equal(Object.hasOwn(writes[1][0],'system.source'),false);
});

test('kit catalog refresh preserves its chosen location, quantity, acquisition category and carried state',()=>{
 const owned={id:'kit',name:'Appraisal Kit III',type:'gear',system:{kitType:'Appraisal Kit',kitGrade:2,kitSize:'Medium',kitNonPortable:false,kitLocation:'Safehouse laboratory',weight:20,caliber:2,quantity:2,pick:'E',carried:false}},canonical={name:owned.name,type:'gear',system:{kitType:'Appraisal Kit',kitGrade:3,kitSize:'Large',kitNonPortable:true,kitLocation:'',weight:0,caliber:3,quantity:1,pick:'',carried:true}},changes=rulesRefreshChanges(owned,canonical);assert.ok(changes.some(c=>c.path==='system.kitGrade'&&c.after===3));for(const field of ['kitLocation','quantity','pick','carried'])assert.equal(changes.some(c=>c.path==='system.'+field),false);
});

test('weapon refresh carries reviewed additional-upgrade allowances while retaining inventory state',()=>{const before=item({upgradeAllowance:null}),canonical={name:before.name,type:'weapon',system:{upgradeAllowance:3,quantity:1,pick:''}};assert.deepEqual(rulesRefreshChanges(before,canonical).map(c=>[c.path,c.before,c.after]),[['system.upgradeAllowance',null,3]]);});
