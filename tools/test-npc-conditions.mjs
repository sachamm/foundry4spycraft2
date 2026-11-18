import test from "node:test";
import assert from "node:assert/strict";
import { defaultNpcProfile, computeNpcProfile, npcSkillBonus } from "../module/rules/npcs.mjs";
import {
  conditionNpcProfile,
  conditionNpcSkillBonus,
  npcSkillConditionContext
} from "../module/rules/npc-conditions.mjs";
import { stepLookup } from "../module/rules/formula.mjs";
import { TABLES } from "../module/rules/tables.mjs";
import { SPYCRAFT } from "../module/config.mjs";
const profile = () => ({ ...defaultNpcProfile(), enabled: true });
test("all NPC types, grades and Threat Levels halve skill/Competence bonuses once, and Incompetent zeros them with precedence", () => {
  for (const type of ["standard", "special", "villain", "animal"])
    for (let grade = 1; grade <= 10; grade++)
      for (let level = 1; level <= 20; level++) {
        const p = profile();
        p.grades.competence = grade;
        p.skills = [{ key: "notice", grade: 11 - grade }];
        const raw = computeNpcProfile(p, type, level),
          before = structuredClone(raw),
          half = conditionNpcProfile(raw, { baffled: true }),
          zero = conditionNpcProfile(raw, { incompetent: true, baffled: true });
        assert.equal(half.competence, Math.ceil(raw.competence / 2));
        assert.equal(zero.competence, 0);
        if (type === "animal") assert.equal(half.competence, 0);
        for (const [result, expected] of [
          [half, Math.ceil(raw.skills[0].bonus / 2)],
          [zero, 0]
        ]) {
          const s = result.skills[0];
          assert.equal(s.bonus, expected);
          assert.equal(s.ranks, expected);
          assert.equal(s.cap, stepLookup(TABLES.skillCap, expected));
          assert.equal(s.classSkill, true);
          assert.equal(s.grade, raw.skills[0].grade);
          assert.equal(result.xp, raw.xp);
          assert.deepEqual(result.health, raw.health);
          assert.deepEqual(result.stats, raw.stats);
          assert.deepEqual(result.attributes, raw.attributes);
          assert.deepEqual(result.warnings, raw.warnings);
        }
        assert.deepEqual(raw, before);
        assert.deepEqual(conditionNpcProfile(half, { baffled: true }), half);
        assert.equal(conditionNpcProfile(half, {}).skills[0].bonus, raw.skills[0].bonus);
      }
});
test("listed and unlisted bonuses use the higher original bonus; NPC effective ranks/caps follow that current number under p.452", () => {
  const p = profile();
  p.grades.competence = 9;
  p.skills = [{ key: "notice", grade: 10 }];
  for (const key of ["notice", "search"]) {
    const row = npcSkillBonus(p, key, 12),
      r = conditionNpcSkillBonus(row, { baffled: true });
    assert.equal(r.bonus, Math.ceil(Math.max(row.competence, row.listed ?? 0) / 2));
    assert.equal(r.ranks, r.bonus);
    assert.equal(r.cap, stepLookup(TABLES.skillCap, r.bonus));
    assert.equal(r.classSkill, key === "notice");
    assert.equal(conditionNpcSkillBonus(r, { incompetent: true }).bonus, 0);
    assert.deepEqual(conditionNpcSkillBonus(r, {}), conditionNpcSkillBonus(row, {}));
  }
  assert.deepEqual(npcSkillConditionContext({ statuses: new Set(["baffled", "bound"]) }), {
    baffled: true,
    incompetent: false
  });
});
class StubSheet {
  constructor(actor) {
    this.actor = actor;
    this.isEditable = true;
  }
}
class Field {
  constructor(options) {
    this.options = options;
  }
}
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: B => B, ApplicationV2: StubSheet },
    sheets: { ActorSheetV2: StubSheet }
  },
  abstract: { TypeDataModel: class {} },
  data: {
    fields: Object.fromEntries(
      ["ArrayField", "BooleanField", "HTMLField", "NumberField", "ObjectField", "SchemaField", "StringField"].map(k => [
        k,
        Field
      ])
    )
  }
};
globalThis.CONFIG = { SPYCRAFT };
const { NpcData } = await import("../module/data/actor.mjs"),
  { SpycraftNpcSheet } = await import("../module/sheets/actor-sheet.mjs");
function model() {
  const m = Object.assign(new NpcData(), {
    parent: { uuid: "Actor.npc", statuses: new Set(["baffled"]), flags: {} },
    npcProfile: profile(),
    npcType: "standard",
    threatLevel: 12,
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 10 }])),
    saves: { fort: { base: 0 }, ref: { base: 0 }, will: { base: 0 } },
    defense: { bonus: 0 },
    initiative: { bonus: 0 },
    vitality: { value: 0, max: 0 },
    wounds: { value: 0, max: 0 }
  });
  m.npcProfile.grades.competence = 9;
  m.npcProfile.skills = [{ key: "notice", grade: 10 }];
  return m;
}
test("the actual graded data model and NPC sheet agree after apply, coexistence, clearing and repeated preparation without changing the profile", () => {
  const m = model(),
    before = structuredClone(m.npcProfile);
  for (const statuses of [["baffled"], ["baffled", "incompetent"], ["incompetent"], [], ["baffled"]]) {
    m.parent.statuses = new Set(statuses);
    m.prepareDerivedData();
    const result = new SpycraftNpcSheet({ system: m, statuses: m.parent.statuses })._npcContext().result;
    assert.equal(result.competence, m.competence);
    assert.deepEqual(result.skills, m.npcBuild.skills);
    assert.deepEqual(m.npcProfile, before);
    assert.deepEqual(m.conditionContext, {
      baffled: statuses.includes("baffled"),
      incompetent: statuses.includes("incompetent")
    });
  }
  const normal = computeNpcProfile(m.npcProfile, m.npcType, m.threatLevel, m.abilities);
  assert.equal(m.competence, Math.ceil(normal.competence / 2));
  assert.equal(m.damageSave, normal.health);
});
test("manual NPCs expose actual skill-condition/save context without replacing their legacy combat statistics", () => {
  const m = model();
  m.npcProfile.enabled = false;
  m.bab = 7;
  m.prepareDerivedData();
  assert.equal(m.bab, 7);
  assert.equal(m.conditionContext.baffled, true);
});
