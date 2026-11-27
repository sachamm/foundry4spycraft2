import test from "node:test";
import assert from "node:assert/strict";
import { advancementPlan, missionLevelSnapshot } from "../module/rules/advancement.mjs";
import { ActorProgression } from "../module/documents/actor/progression.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollCareerVitality, reviewCareerVitality } from "../module/apps/vitality.mjs";

const source = (level = 1, xp = 1000000) => ({
  xp,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
  progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 4, skills: {} }))
});
const context = (baseline = 1, effects = {}) => ({
  actorUuid: "Actor.level",
  effects,
  periods: {
    mission: "first",
    missionCareerLevels: { version: 1, mission: "first", levels: { "Actor.level": baseline } }
  }
});

test("normal and Fast Growth ceilings use the last mission's actual starting level at all career levels", () => {
  for (let baseline = 1; baseline < 20; baseline++) {
    assert.equal(advancementPlan(source(baseline), cfg, context(baseline)).allowed, true);
    assert.equal(advancementPlan(source(baseline + 1), cfg, context(baseline)).allowed, false);
    const fast = context(baseline, { betweenMissionLevels: 2, xpToLevelFraction: 0.5 });
    assert.equal(advancementPlan(source(baseline), cfg, fast).allowed, true);
    assert.equal(advancementPlan(source(baseline + 1), cfg, fast).allowed, baseline + 1 < 20);
    if (baseline + 2 <= 20) assert.equal(advancementPlan(source(baseline + 2), cfg, fast).allowed, false);
  }
});

test("active missions, unknown history and insufficient Growth-adjusted XP block advancement; initial creation and explicit GC grants remain available", () => {
  assert.match(advancementPlan(source(), cfg, { ...context(), missionActive: true }).reason, /between missions/);
  assert.match(
    advancementPlan(source(), cfg, { actorUuid: "Actor.level", periods: { mission: "first" } }).reason,
    /GC must review/
  );
  for (const fraction of [0.5, 1, 2]) {
    const minimum = Math.floor(cfg.tables.levels[2].xp * fraction);
    assert.equal(advancementPlan(source(1, minimum), cfg, context(1, { xpToLevelFraction: fraction })).allowed, true);
    assert.equal(
      advancementPlan(source(1, minimum - 1), cfg, context(1, { xpToLevelFraction: fraction })).allowed,
      false
    );
  }
  assert.equal(advancementPlan(source(10, 0), cfg, {}).allowed, true);
  assert.equal(advancementPlan(source(0, 0), cfg, { ...context(), missionActive: true }).allowed, true);
  const grant = {
    version: 1,
    mission: "first",
    mode: "grant",
    ceiling: 5,
    confirmed: true,
    note: "GC approved new starting level"
  };
  assert.equal(advancementPlan(source(4, 0), cfg, { ...context(), missionActive: true, review: grant }).allowed, true);
  assert.equal(advancementPlan(source(5, 0), cfg, { ...context(), missionActive: true, review: grant }).allowed, false);
  assert.equal(
    advancementPlan(source(4, 0), cfg, { ...context(), missionActive: true, review: { ...grant, mission: "old" } })
      .allowed,
    false
  );
});

test("mission snapshots include independent PCs, exclude companions/NPCs, and reject malformed levels", () => {
  const a = { type: "agent", uuid: "Actor.level", system: source(4) };
  const snapshot = missionLevelSnapshot(
    [
      a,
      { type: "npc", uuid: "Actor.npc", system: {} },
      { ...a, uuid: "Actor.companion", system: { ...source(4), companionOf: { ownerUuid: a.uuid } } }
    ],
    "first"
  );
  assert.deepEqual(snapshot, { version: 1, mission: "first", levels: { "Actor.level": 4 } });
  assert.throws(() => missionLevelSnapshot([{ ...a, system: { level: -1 } }], "first"), /Review character levels/);
});

const cls = {
  id: "test",
  name: "Test",
  type: "class",
  system: { identifier: "test", vitalityDie: 8, skillPoints: 0, classSkills: [], table: [] }
};
function actor(effects = {}) {
  const periods = context().periods;
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = {
    user: { id: "gc", isGM: true },
    i18n: { localize: s => s },
    settings: {
      get: (_id, key) =>
        key === "usagePeriods"
          ? periods
          : key === "campaign"
            ? { qualities: effects.betweenMissionLevels === 2 ? ["fast-growth"] : [] }
            : {}
    }
  };
  globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => `career-${Date.now()}` } };
  globalThis.ui = { notifications: { warn: () => {} } };
  const C = ActorProgression(class {});
  const a = Object.assign(new C(), {
    type: "agent",
    isOwner: true,
    uuid: "Actor.level",
    flags: {},
    items: [cls],
    system: computeAgent(source(), [cls], cfg),
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let at = this;
        for (const key of keys.slice(0, -1)) at = at[key] ??= {};
        at[keys.at(-1)] = structuredClone(value);
      }
      computeAgent(this.system, this.items, cfg, { campaignEffects: effects });
    },
    async syncGrantedFeats() {}
  });
  return { a, periods };
}

test("the real level-add workflow serializes concurrent advances, retains XP and only reopens its ceiling after a new mission", async () => {
  const { a, periods } = actor();
  await Promise.all([a.addClassLevel(cls, { promptVitality: false }), a.addClassLevel(cls, { promptVitality: false })]);
  assert.equal(a.system.level, 2);
  assert.equal(a.system.xp, 1000000);
  periods.mission = "second";
  periods.missionCareerLevels = missionLevelSnapshot([a], "second");
  await a.addClassLevel(cls, { promptVitality: false });
  assert.equal(a.system.level, 3);
  const fast = actor({ betweenMissionLevels: 2, xpToLevelFraction: 0.5 }).a;
  for (let n = 0; n < 3; n++) await fast.addClassLevel(cls, { promptVitality: false });
  assert.equal(fast.system.level, 3);
});

test("the owning GC can repair unknown advancement history with an audited record, without modifying levels or XP", async () => {
  const { a, periods } = actor();
  delete periods.missionCareerLevels;
  assert.equal(await a.addClassLevel(cls, { promptVitality: false }), null);
  const before = structuredClone(a.system);
  const record = await a.reviewAdvancement({
    mode: "history",
    baseline: 1,
    confirmed: true,
    note: "Original mission roster checked"
  });
  assert.equal(record.mission, "first");
  assert.deepEqual(a.system, before);
  await a.addClassLevel(cls, { promptVitality: false });
  assert.equal(a.system.level, 2);
  game.user.isGM = false;
  await assert.rejects(
    a.reviewAdvancement({ mode: "grant", ceiling: 20, confirmed: true, note: "Unapproved" }),
    /owning GC/
  );
});

test("removing and rebuilding a career level preserves its original roll, identity and Intelligence history", async () => {
  const { a } = actor();
  let serial = 0,
    rng = 0;
  game.time = { worldTime: 0 };
  game.messages = [];
  game.spycraft2 = {};
  foundry.utils.randomID = () => `retained${++serial}`;
  foundry.utils.escapeHTML = String;
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }
    async evaluate() {
      rng++;
      this.total = 4;
      this._evaluated = true;
      return this;
    }
    toJSON() {
      return { formula: this.formula, total: this.total, evaluated: this._evaluated };
    }
    static fromJSON(text) {
      const d = JSON.parse(text),
        r = new this(d.formula);
      r.total = d.total;
      r._evaluated = d.evaluated;
      return r;
    }
    async toMessage(data) {
      const m = { ...data, id: `chat${++serial}` };
      game.messages.push(m);
      return m;
    }
  };
  await a.addClassLevel(cls, { promptVitality: false });
  await rollCareerVitality(a, 1);
  const original = structuredClone(a.system.progression[1]);
  await a.removeLastLevel();
  a.system.abilities.int.base = 18;
  await a.addClassLevel(cls, { promptVitality: false });
  const rebuilt = a.system.progression[1];
  for (const key of ["vitality", "vitalityRollId", "careerEntryId", "intelligenceModifier"])
    assert.equal(rebuilt[key], original[key], key);
  game.messages.length = 0;
  assert.equal((await rollCareerVitality(a, 1)).total, 4);
  assert.equal(rng, 1, "deleting chat does not permit another vitality roll");

  await a.removeLastLevel();
  const other = {
    id: "other",
    name: "Other",
    type: "class",
    system: { ...cls.system, identifier: "other", vitalityDie: 12 },
    async delete() {
      a.items = a.items.filter(i => i !== this);
    }
  };
  a.items.push(other);
  await a.addClassLevel(other, { promptVitality: false });
  assert.equal(a.system.progression[1].vitality, 0);
  assert.ok(a.system.progression[1].vitalityHistoryId);
  assert.ok(a.system.todo.some(t => t.text.includes("do not reroll")));
  await assert.rejects(rollCareerVitality(a, 1), /recorded history/);
  assert.equal(rng, 1);
  await reviewCareerVitality(a, 1, { value: 5, confirmed: true, note: "GC reviewed corrected class die result" });
  assert.equal((await rollCareerVitality(a, 1)).total, 5);
  await a.removeLastLevel();
  await a.addClassLevel(cls, { promptVitality: false });
  assert.equal(
    a.system.progression[1].vitality,
    4,
    "returning to the original class restores that source's original result"
  );
  assert.equal(a.system.progression[1].vitalityRollId, original.vitalityRollId);
  assert.equal(rng, 1);
  try {
    cls.system.vitalityDie = 12;
    await a.removeLastLevel();
    await a.addClassLevel(cls, { promptVitality: false });
    assert.equal(a.system.progression[1].vitality, 0, "editing the class die cannot relabel an old roll");
    await assert.rejects(rollCareerVitality(a, 1), /recorded history/);
    cls.system.vitalityDie = 8;
    await a.removeLastLevel();
    await a.addClassLevel(cls, { promptVitality: false });
    assert.equal(
      a.system.progression[1].vitality,
      4,
      "removing an unresolved rebuild does not erase the original result"
    );
    assert.equal(a.system.progression[1].vitalityRollId, original.vitalityRollId);
    assert.equal(rng, 1);
  } finally {
    cls.system.vitalityDie = 8;
  }
});

test("level removal records vitality atomically and recognizes an already committed removal after response loss", async () => {
  const { a } = actor();
  await a.addClassLevel(cls, { promptVitality: false });
  const update = a.update;
  a.update = async () => {
    throw Error("write refused");
  };
  await assert.rejects(a.removeLastLevel(), /write refused/);
  assert.equal(a.system.level, 2);
  assert.equal(a.flags.spycraft2?.removedLevelVitality, undefined);
  a.update = async patch => {
    await update.call(a, patch);
    throw Error("response lost");
  };
  await a.removeLastLevel();
  assert.equal(a.system.level, 1);
  assert.equal(Object.keys(a.flags.spycraft2.removedLevelVitality).length, 1);
});
