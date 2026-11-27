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
  const context = npcSkillConditionContext({ statuses: new Set(["baffled", "bound", "flat-footed"]) });
  assert.equal(context.baffled, true);
  assert.equal(context.incompetent, false);
  assert.equal(context.bound, true);
  assert.equal(context.flatFooted, true);
  assert.equal(context.sickened, false);
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
    assert.equal(m.conditionContext.baffled, statuses.includes("baffled"));
    assert.equal(m.conditionContext.incompetent, statuses.includes("incompetent"));
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
test("an NPC's statuses reach its Defense, attacks, saves and initiative as an agent's do (pp.340–342)", () => {
  const m = model();
  m.abilities.dex.value = 16;
  const prepare = statuses => {
    m.parent.statuses = new Set(statuses);
    m.prepareDerivedData();
    return {
      defense: m.defense.total,
      melee: m.attack.melee,
      ranged: m.attack.ranged,
      fort: m.saves.fort.total,
      ref: m.saves.ref.total,
      will: m.saves.will.total,
      init: m.initiative.total
    };
  };
  const base = prepare([]);
  assert.equal(base.defense, 10 + m.defense.bonus + 3);
  for (const status of ["flat-footed", "sprawled", "stunned", "blinded", "helpless"])
    assert.equal(prepare([status]).defense, base.defense - 3, status);
  const sick = prepare(["sickened"]);
  for (const key of ["melee", "ranged", "fort", "ref", "will"]) assert.equal(sick[key], base[key] - 2, key);
  assert.equal(prepare(["entangled"]).melee, base.melee - 2);
  const prone = prepare(["prone"]);
  assert.equal(prone.melee, base.melee - 2);
  assert.equal(prone.ranged, base.ranged);
  const drunk = prepare(["drunk"]);
  assert.equal(drunk.ranged, base.ranged - 2);
  assert.equal(drunk.melee, base.melee);
  assert.equal(drunk.fort, base.fort);
  for (const key of ["ref", "will", "init"]) assert.equal(drunk[key], base[key] - 2, key);
  // A negative Dexterity stays even when flat-footed.
  m.abilities.dex.value = 6;
  assert.equal(prepare(["flat-footed"]).defense, prepare([]).defense);
});
test("Hulking and Undersized give an NPC the Size table's Defense, attack, Hide, wounds and death point (pp.349, 448, 452)", () => {
  const m = model();
  m.parent.statuses = new Set();
  m.npcType = "special";
  m.prepareDerivedData();
  const medium = { defense: m.defense.total, melee: m.attack.melee, wounds: m.wounds.max, save: m.saves.fort.total };
  assert.ok(medium.wounds > 0);
  assert.equal(m.sizeModifier, 0);
  assert.equal(m.deathThreshold, -10);
  m.npcProfile.qualities = [{ id: "hulking", units: 1 }];
  m.prepareDerivedData();
  assert.equal(m.size, "Large");
  assert.equal(m.defense.total, medium.defense - 1);
  assert.equal(m.attack.melee, medium.melee - 1);
  assert.equal(m.sizeHideModifier, -4);
  assert.equal(m.wounds.max, Math.floor(medium.wounds * 1.5));
  assert.equal(m.saves.fort.total, medium.save);
  assert.equal(m.deathThreshold, -10);
  m.npcProfile.qualities = [{ id: "undersized", units: 2 }];
  m.prepareDerivedData();
  assert.equal(m.size, "Tiny");
  assert.equal(m.defense.total, medium.defense + 2);
  assert.equal(m.sizeHideModifier, 8);
  assert.equal(m.wounds.max, Math.ceil(medium.wounds / 2));
  assert.equal(m.deathThreshold, -5);
  // A standard NPC keeps its Damage save whatever its Size.
  m.npcType = "standard";
  m.npcProfile.qualities = [];
  m.prepareDerivedData();
  const save = m.damageSave;
  m.npcProfile.qualities = [{ id: "hulking", units: 2 }];
  m.prepareDerivedData();
  assert.equal(m.damageSave, save);
  assert.equal(m.sizeModifier, -2);
});
