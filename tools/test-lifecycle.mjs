import test from "node:test";
import assert from "node:assert/strict";

globalThis.Actor = class {
  constructor(items = []) {
    this.type = "agent";
    this.isOwner = true;
    this.items = items;
    this.system = { progression: [], classLevels: {} };
    this.created = [];
    this.deleted = [];
    this.updated = [];
  }
  async deleteEmbeddedDocuments(_type, ids) {
    this.deleted.push(...ids);
    this.items = this.items.filter(i => !ids.includes(i.id));
  }
  async createEmbeddedDocuments(_type, docs) {
    this.created.push(...docs);
    docs.forEach((d,i)=>this.items.push({ ...d, id:"new"+(this.created.length+i),
      system:{...d.system} }));
  }
  async updateEmbeddedDocuments(_type, docs) {
    this.updated.push(...docs);
    for(const d of docs) {
      const item=this.items.find(i=>i.id===d._id);
      if(item && "system.acquiredAtLevel" in d) item.system.acquiredAtLevel=d["system.acquiredAtLevel"];
    }
  }
};
globalThis.game = {packs:{get:()=>null}};
const { SpycraftActor } = await import("../module/documents/actor.mjs");

test("manual feat takes precedence over duplicated granted feat", async () => {
  const actor = new SpycraftActor([
    {id:"origin",name:"Agent",type:"origin",system:{grants:["Quick Draw"]}},
    {id:"manual",name:"Quick Draw",type:"feat",system:{granted:false}},
    {id:"grant",name:"Quick Draw",type:"feat",system:{granted:true}}
  ]);
  await actor.syncGrantedFeats();
  assert.deepEqual(actor.deleted,["grant"]);
  assert.equal(actor.created.length,0);
  assert.ok(actor.items.some(i=>i.id==="manual"));
});

test("grant synchronisation creates one copy and removes it when the origin disappears", async () => {
  const actor = new SpycraftActor([
    {id:"origin",name:"Agent",type:"origin",system:{grants:["Quick Draw"]}}
  ]);
  await actor.syncGrantedFeats();
  assert.equal(actor.created.length,1);
  assert.equal(actor.created[0].system.acquiredAtLevel,1);
  await actor.syncGrantedFeats();
  assert.equal(actor.created.length,1);
  actor.items = actor.items.filter(i=>i.id!=="origin");
  await actor.syncGrantedFeats();
  assert.equal(actor.items.filter(i=>i.type==="feat").length,0);
});

test("legacy granted feat receives its actual class acquisition level", async () => {
  const actor = new SpycraftActor([
    {id:"class",name:"Pointman",type:"class",system:{identifier:"pointman",featGrants:[{level:2,feat:"Quick Draw"}]}},
    {id:"grant",name:"Quick Draw",type:"feat",system:{granted:true,acquiredAtLevel:0}}
  ]);
  actor.system.progression=[{classId:"pointman"},{classId:"soldier"},{classId:"pointman"}];
  actor.system.classLevels={pointman:2};
  await actor.syncGrantedFeats();
  assert.equal(actor.items.find(i=>i.id==="grant").system.acquiredAtLevel,3);
});
