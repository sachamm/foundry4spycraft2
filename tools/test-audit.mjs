import test from "node:test";
import assert from "node:assert/strict";
import {resolveSkillResult, purchasedSkillRanks, availableSkillPoints} from "../module/rules/checks.mjs";
import {checkPrerequisites} from "../module/rules/prerequisites.mjs";
import {evaluate} from "../module/rules/formula.mjs";
import {grantAcquisitionLevel} from "../module/rules/progression.mjs";

test("skill result cap actually limits non-threat checks", () => {
  assert.deepEqual(resolveSkillResult(43, 17, {cap: 40}), {rawTotal:43,total:40,limited:true,threat:false,triumph:false});
});
test("a threat lifts the result cap", () => {
  assert.equal(resolveSkillResult(43, 20, {cap:40}).total, 43);
});
test("action dice add to cap, not the uncapped total", () => {
  assert.equal(resolveSkillResult(43, 17, {cap:40,actionDieBonus:6}).total, 46);
});
test("triumph overrides cap when total reaches 75", () => {
  assert.equal(resolveSkillResult(75, 17, {cap:40}).total, 75);
});
test("unbounded results stay unchanged", () => {
  assert.equal(resolveSkillResult(31, 15).total, 31);
});
test("unsupported prerequisite types fail closed", () => {
  assert.equal(checkPrerequisites({type:"mistyped-rule"},{}).ok,false);
});
test("prerequisite combinations respect all and any", () => {
  const ctx={level:5,abilities:{dex:14}};
  assert.equal(checkPrerequisites({type:"all",of:[{type:"level",min:4},{type:"ability",key:"dex",min:14}]},ctx).ok,true);
  assert.equal(checkPrerequisites({type:"any",of:[{type:"level",min:10},{type:"ability",key:"dex",min:14}]},ctx).ok,true);
});
test("formula evaluator rejects executable expressions", () => {
  assert.equal(evaluate("globalThis.process.exit(1)",{}),0);
  assert.equal(evaluate("max(1, @abilities.int.mod)",{abilities:{int:{mod:3}}}),3);
});

test("cross-class skill purchases never award half ranks", () => {
  assert.deepEqual(purchasedSkillRanks(3,false),{ranks:1,valid:false});
  assert.deepEqual(purchasedSkillRanks(4,false),{ranks:2,valid:true});
  assert.deepEqual(purchasedSkillRanks(3,true),{ranks:3,valid:true});
});
test("skill points never drop below 1 per level, or 4 at career level 1", () => {
  assert.equal(availableSkillPoints(2,-5,0,1),4);
  assert.equal(availableSkillPoints(2,-5,0,3),1);
  assert.equal(availableSkillPoints(6,2,1,1),36);
});

test("class grants activate at the career level the class milestone was reached", () => {
  const items=[{type:"class",name:"Pointman",system:{identifier:"pointman",featGrants:[{level:2,feat:"Quick Draw"}]}}];
  const levels=[{classId:"pointman"},{classId:"soldier"},{classId:"pointman"}];
  assert.equal(grantAcquisitionLevel(items,levels,"Quick Draw"),3);
  assert.equal(grantAcquisitionLevel(items,levels,"Not Granted"),0);
});
test("origin granting the same feat advances its acquisition to career level one", () => {
  const items=[
    {type:"class",name:"Pointman",system:{identifier:"pointman",featGrants:[{level:2,feat:"Quick Draw"}]}},
    {type:"origin",name:"Adaptable",system:{grants:["Quick Draw"]}}
  ];
  assert.equal(grantAcquisitionLevel(items,[{classId:"pointman"},{classId:"pointman"}],"Quick Draw"),1);
});
