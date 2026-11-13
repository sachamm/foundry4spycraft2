import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultNpcProfile} from '../module/rules/npcs.mjs';
import {SPYCRAFT} from '../module/config.mjs';
class StubSheet {
 constructor(actor){this.actor=actor;this.isEditable=true;}
 _prepareSubmitData(_e,_f,form){return form.object;}
}
class Field {constructor(options){this.options=options;}}
globalThis.foundry={applications:{api:{HandlebarsApplicationMixin:B=>B,ApplicationV2:StubSheet},sheets:{ActorSheetV2:StubSheet}},abstract:{TypeDataModel:class{}},data:{fields:Object.fromEntries(['ArrayField','BooleanField','HTMLField','NumberField','ObjectField','SchemaField','StringField'].map(k=>[k,Field]))}};
globalThis.CONFIG={SPYCRAFT};
const {SpycraftNpcSheet}=await import('../module/sheets/actor-sheet.mjs');
const {NpcData}=await import('../module/data/actor.mjs');
const make=()=>({npcProfile:{...defaultNpcProfile(),enabled:true},threatLevel:7,npcType:'standard',abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{value:k==='dex'?14:10}])),vitality:{value:0,max:0},wounds:{value:0,max:0},saves:{fort:{base:0},ref:{base:0},will:{base:0}},defense:{bonus:0},initiative:{bonus:0}});
test('NPC sheet persists skills, quality parameters and equipment arrays without mutating source',()=>{
 const sys=make();sys.npcProfile.skills=[{key:'science',grade:1}];sys.npcProfile.qualities=[{id:'feat',units:1,details:''}];
 const sheet=new SpycraftNpcSheet({system:sys});
 const data=sheet._prepareSubmitData(null,null,{object:{'npcSkill.0.key':'notice','npcSkill.0.grade':'7','npcQuality.0.id':'natural-attack','npcQuality.0.caliber':'5','npcQuality.0.units':'2','npcQuality.0.details':'claws','npcPick.weapons.0':'3','system.threatLevel':'12'}},{});
 assert.deepEqual(data['system.npcProfile.skills'],[{key:'notice',grade:7}]);
 assert.deepEqual(data['system.npcProfile.equipment'].weapons,[3]);
 assert.equal(data['system.npcProfile.qualities'][0].caliber,5);
 assert.equal(data['system.npcProfile.qualities'][0].units,2);
 assert.equal(sys.npcProfile.skills[0].grade,1);
 assert.ok(!Object.keys(data).some(k=>/^npc(Skill|Quality|Pick)/.test(k)));
});
test('graded model uses independent table values and adds attribute modifiers exactly once',()=>{
 const model=Object.assign(new NpcData(),make());
 model.npcProfile.grades={initiative:5,attack:5,defense:5,resilience:5,health:5,competence:5,wealth:1};
 model.prepareDerivedData();
 assert.equal(model.bab,5);assert.equal(model.attack.ranged,7);
 assert.equal(model.initiative.total,6);assert.equal(model.defense.total,16);
 assert.equal(model.saves.fort.total,4);assert.equal(model.saves.ref.total,6);
 assert.equal(model.damageSave,8);assert.equal(model.vitality.max,0);
 model.npcType='special';model.prepareDerivedData();
 assert.equal(model.vitality.max,35);assert.equal(model.wounds.max,18);assert.equal(model.damageSave,null);
});
test('legacy manual NPCs retain existing stats and resources',()=>{
 const sys=make();sys.npcProfile.enabled=false;sys.bab=8;sys.vitality.max=50;sys.wounds.max=16;
 const model=Object.assign(new NpcData(),sys);model.prepareDerivedData();
 assert.equal(model.bab,8);assert.equal(model.vitality.max,50);assert.equal(model.wounds.max,16);
});
test('NPC add/remove actions refuse changes on read-only sheets',async()=>{
 const sheet=new SpycraftNpcSheet({system:make(),update:()=>assert.fail('Read-only mutation')});sheet.isEditable=false;
 for(const action of ['npcEnable','npcAddSkill','npcAddQuality','npcAddPick','npcRemoveRow'])await SpycraftNpcSheet.DEFAULT_OPTIONS.actions[action].call(sheet,null,{dataset:{category:'gear',list:'skills',index:'0'}});
});
test('NPC context exposes quality costs and all level columns for reference tables',()=>{
 const sheet=new SpycraftNpcSheet({system:make()});const ctx=sheet._npcContext();
 assert.equal(ctx.referenceTables.length,8);assert.equal(ctx.levels.length,20);
 assert.ok(Object.keys(ctx.qualityOptions).length>30);assert.equal(ctx.grades.length,7);
});
