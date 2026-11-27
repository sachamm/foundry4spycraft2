import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deferredSkillPools, deferredSkillPlan, deferredSkillDeadline } from "../module/rules/deferred-skills.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  defs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
  scientist = classes.find(c => c.key === "scientist"),
  cls = {
    id: "s",
    name: scientist.name,
    type: "class",
    system: { ...scientist, identifier: "scientist", vitalityDie: scientist.vitality }
  },
  feat = (name, id = name, extra = {}) => {
    const f = defs.find(f => f.name === name);
    return {
      id,
      name,
      type: "feat",
      system: {
        ...structuredClone(f),
        tree: f.tree === "Advanced Skill" ? "advancedSkill" : "basicSkill",
        acquiredAtLevel: 1,
        ...extra
      }
    };
  },
  baseItems = () => [structuredClone(cls), feat("I Can Swim")],
  source = (level = 1) => ({
    actorUuid: "Actor.qa",
    usagePeriods: { mission: "a" },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: Array.from({ length: level }, () => ({ classId: "scientist", vitality: 6, skills: {} })),
    actionDice: { value: 0 }
  }),
  compute = (s = source(), is = baseItems()) => computeAgent(s, is, cfg),
  declare = { freeActionConfirmed: true, beforeSkillCheckConfirmed: true };
const plan = (s, is, key, opts) => deferredSkillPlan(s, is, cfg, key, { ...declare, ...opts });
test("all thirty skills use current-level class/cross-class point costs and current rank caps; neither ranks nor saved source change during planning", () => {
  assert.equal(Object.keys(cfg.skills).length, 30);
  for (const key of Object.keys(cfg.skills)) {
    const is = baseItems(),
      s = compute(source(), is),
      before = structuredClone(s),
      cost = s.skillPoints[0].classSkills.includes(key) ? 1 : 2,
      p = plan(s, is, key, { points: cost });
    assert.equal(p.ranks, 1, key);
    assert.equal(p.progression[0].skills[key], cost);
    assert.deepEqual(s, before);
    assert.equal(p.updates.length, 0);
  }
  const is = baseItems(),
    s = compute(source(), is);
  assert.throws(() => plan(s, is, "acrobatics", { points: 1 }), /whole-rank/);
  assert.throws(() => plan(s, is, "analysis", { points: 5 }), /maximum rank/);
});
test("Well Rounded discounts and Talented linked ranks follow the existing purchase engine instead of a separate price rule", () => {
  let is = [...baseItems(), feat("Training", "training", { trainingSkills: {} }), feat("Well Rounded")],
    s = compute(source(), is);
  assert.equal(plan(s, is, "acrobatics", { points: 1 }).ranks, 1);
  is = [...baseItems(), feat("Talented", "talented", { choice: "Scholar" })];
  s = compute(source(), is);
  const p = plan(s, is, "science", { points: 1 }),
    after = compute({ ...source(), progression: p.progression }, is);
  assert.equal(after.skillTotals.science.ranks, 1);
  assert.equal(after.skillTotals.bureaucracy.ranks, 1);
});
test("Training remains one point per rank, uses only active current-level sources, shares rank limits and preserves temporary prerequisite exclusion", () => {
  const training = feat("Training", "t", {
      featKind: "temporary",
      acquiredAtLevel: 10,
      trainingSkills: {},
      temporaryGrant: {
        period: "mission",
        epoch: "a",
        ability: "knowItAll",
        selfGranted: true,
        sourceActorUuid: "Actor.qa"
      }
    }),
    is = [...baseItems(), training],
    s = compute(source(10), is),
    p = plan(s, is, "acrobatics", { points: 0, trainingPoints: { t: 5 } });
  assert.equal(p.ranks, 5);
  assert.equal(p.updates[0]["system.trainingSkills"].acrobatics, 5);
  assert.equal(p.progression.at(-1).skills.acrobatics, undefined);
  const older = structuredClone(training);
  older.system.acquiredAtLevel = 9;
  assert.equal(
    deferredSkillPools(compute(source(10), [...baseItems(), older]), [...baseItems(), older]).training.length,
    0
  );
  const expired = source(10);
  expired.usagePeriods.mission = "b";
  assert.equal(deferredSkillPools(compute(expired, is), is).training.length, 0);
  assert.throws(() => plan(s, is, "analysis", { trainingPoints: { wrong: 1 } }), /current-level Training/);
  assert.throws(() => plan(s, is, "analysis", { trainingPoints: { t: 6 } }), /available whole/);
});
test("invalid declarations, points, keys, stale levels, unavailable sources and empty purchases cannot mutate a build", () => {
  const is = baseItems(),
    s = compute(source(), is);
  for (const points of [-1, 0, 0.5, Infinity, "1", 100000]) assert.throws(() => plan(s, is, "analysis", { points }));
  assert.throws(() => plan(s, is, "constructor", { points: 1 }), /existing/);
  assert.throws(() => plan(s, is, "analysis", { points: 1, level: 2 }), /level changed/);
  assert.throws(() => plan(s, is, "analysis", { points: 1, freeActionConfirmed: "true" }), /free action/);
  assert.throws(() => plan(s, is, "analysis", { points: 1, beforeSkillCheckConfirmed: false }), /before/);
  assert.throws(() => plan(s, is, "analysis", { trainingPoints: [] }), /Training/);
  assert.equal(deferredSkillPools(compute(source(), [cls]), [cls]), null);
});
let mission = "a",
  failPost = false,
  failUpdate = false,
  failRestore = false,
  postHook = null,
  posts = [],
  warnings = [];
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.qa";
    this.type = "agent";
    this.isOwner = true;
    this.items = baseItems();
    this.items.get = id => this.items.find(f => f.id === id);
    this.system = source();
    this.derive();
  }
  derive() {
    computeAgent(this.system, this.items, cfg);
  }
  async update(patch) {
    if (failUpdate || (failRestore && patch["system.progression"]?.[0]?.skills?.analysis === undefined))
      throw Error("update failed");
    if (patch["system.progression"]) this.system.progression = structuredClone(patch["system.progression"]);
    this.derive();
    return this;
  }
  async updateEmbeddedDocuments(_type, data) {
    for (const u of data) {
      const f = this.items.get(u._id);
      if (!f) throw Error("missing feat");
      f.system.trainingSkills = structuredClone(u["system.trainingSkills"]);
    }
    this.derive();
    return data;
  }
  getRollData() {
    return {};
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s), deepClone: structuredClone, randomID: () => "deferred-career-entry" },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.game = { user: { isGM: true }, settings: { get: () => ({ mission }) }, combat: null };
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return null;
    }
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  async create(d) {
    if (failPost) throw Error("post failed");
    await postHook?.();
    posts.push(d);
    return d;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function reset() {
  mission = "a";
  failPost = false;
  failUpdate = false;
  failRestore = false;
  postHook = null;
  posts = [];
  warnings = [];
  game.combat = null;
  return new SpycraftActor();
}
test("actor skill purchase is a zero-die free action before the check, with explicit cancellation, fresh point balances and serialized concurrent purchases", async () => {
  const a = reset();
  assert.equal(await a.spendDeferredSkillPoints("analysis", { beforeSkillCheckConfirmed: true }), null);
  await Promise.all([
    a.spendDeferredSkillPoints("analysis", { ...declare, points: 1 }),
    a.spendDeferredSkillPoints("analysis", { ...declare, points: 1 })
  ]);
  assert.equal(a.system.skillTotals.analysis.ranks, 2);
  assert.equal(a.system.progression[0].skills.analysis, 2);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].flags.spycraft2.ranks, 1);
  game.combat = {
    started: true,
    combatants: [{ actor: { uuid: a.uuid } }],
    combatant: { actor: { uuid: "Actor.other" } }
  };
  await assert.rejects(a.spendDeferredSkillPoints("analysis", { ...declare, points: 1 }), /initiative/);
  game.combat = null;
});
test("failed posting restores Career and Training allocations; a rollback failure stops the subsequent check for review", async () => {
  let a = reset();
  a.items.push(feat("Training", "t", { trainingSkills: {} }));
  a.derive();
  failPost = true;
  await assert.rejects(
    a.spendDeferredSkillPoints("analysis", { ...declare, points: 1, trainingPoints: { t: 1 } }),
    /post failed/
  );
  assert.equal(a.system.skillTotals.analysis.ranks, 0);
  assert.deepEqual(a.items.get("t").system.trainingSkills, {});
  assert.equal(a.system.progression[0].skills.analysis, undefined);
  a = reset();
  failPost = true;
  failRestore = true;
  assert.equal((await a.spendDeferredSkillPoints("analysis", { ...declare, points: 1 })).review, true);
  assert.match(warnings.at(-1), /needs review/);
});
test("skill roll allocation happens before result calculation and cannot spill into another skill or act without the source", async () => {
  const a = reset();
  let rolled;
  a.rollCheck = async (formula, data, opts) => {
    rolled = { formula, data, opts };
    return rolled;
  };
  await a.rollSkill("analysis", "int", {
    check: "appraise",
    iCanSwim: true,
    deferredSkillPoints: { points: 1, freeActionConfirmed: true },
    gearStatus: "available",
    synergySkill: "none"
  });
  assert.equal(a.system.skillTotals.analysis.ranks, 1);
  assert.equal(rolled.data.total, a.system.skillTotals.analysis.totals.find(t => t.ability === "int").total);
  assert.equal(rolled.opts.error, 1);
  const b = reset();
  b.items = b.items.filter(i => i.name !== "I Can Swim");
  b.derive();
  assert.equal(await b.spendDeferredSkillPoints("analysis", { ...declare, points: 1 }), false);
});
test("the next-level deadline includes Career and Training points and permits a completed allocation without consuming resources", async () => {
  const a = reset();
  assert.ok(deferredSkillDeadline(a.system, a.items).some(p => p.includes("level 1")));
  const before = a.system.level;
  assert.equal(await a.addClassLevel(cls, { promptVitality: false }), null);
  assert.equal(a.system.level, before);
  let left = a.system.skillPoints[0].available,
    alloc = {};
  for (const key of a.system.skillPoints[0].classSkills) {
    const n = Math.min(4, left);
    alloc[key] = n;
    left -= n;
    if (!left) break;
  }
  assert.equal(left, 0);
  await a.update({ "system.progression": [{ classId: "scientist", vitality: 6, skills: alloc }] });
  assert.deepEqual(deferredSkillDeadline(a.system, a.items), []);
  a.items.push(feat("Training", "t", { trainingSkills: {} }));
  a.derive();
  assert.ok(deferredSkillDeadline(a.system, a.items).some(p => p.includes("Training")));
  a.items.get("t").system.trainingSkills = { science: 5 };
  a.derive();
  assert.deepEqual(deferredSkillDeadline(a.system, a.items), []);
});

test("a period change during posting restores the purchase and a final purchase serializes with the next level without holding a vitality prompt lock", async () => {
  let a = reset();
  postHook = () => {
    mission = "changed";
    a.system.usagePeriods.mission = mission;
    a.derive();
  };
  await assert.rejects(a.spendDeferredSkillPoints("analysis", { ...declare, points: 1 }), /period/);
  assert.equal(a.system.progression[0].skills.analysis, undefined);
  a = reset();
  let left = a.system.skillPoints[0].available - 1,
    alloc = {};
  for (const key of a.system.skillPoints[0].classSkills.filter(k => k !== "science")) {
    const n = Math.min(left, 4);
    if (n) alloc[key] = n;
    left -= n;
    if (!left) break;
  }
  assert.equal(left, 0);
  await a.update({ "system.progression": [{ classId: "scientist", vitality: 6, skills: alloc }] });
  a.system.xp = 1000000;
  a.syncGrantedFeats = async () => {};
  let release, started;
  const entered = new Promise(r => (started = r)),
    held = new Promise(r => (release = r));
  postHook = async () => {
    started();
    await held;
  };
  const purchasing = a.spendDeferredSkillPoints("science", { ...declare, points: 1 });
  await entered;
  const leveling = a.addClassLevel(cls, { promptVitality: false });
  assert.equal(a.system.level, 1);
  release();
  await Promise.all([purchasing, leveling]);
  assert.equal(a.system.level, 2);
  assert.equal(a.system.progression[0].skills.science, 1);
});
test("a stored-data projection without derived ability values cannot bypass the free-action incapacity guard", async () => {
  const a = reset();
  a.system.abilities.str.misc = -12;
  a.derive();
  a.system.toObject = () => ({
    ...source(),
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12, misc: k === "str" ? -12 : 0 }])
    )
  });
  await assert.rejects(a.spendDeferredSkillPoints("analysis", { ...declare, points: 1 }), /no actions/);
  assert.equal(a.system.skillTotals.analysis.ranks, 0);
  assert.equal(posts.length, 0);
});

test("invalid early skill purchases cannot qualify new feats/classes or advance; repairing history restores qualification without rewriting stored data", async () => {
  const a = reset();
  a.system = source(10);
  a.system.progression[0].skills.science = 5;
  a.derive();
  assert.equal(a.system.skillTotals.science.ranks, 5);
  assert.equal(a.system.skillTotals.science.maxRanks, 13);
  const tree = { type: "skill", key: "science", min: 5 };
  const before = structuredClone(a.system.progression);
  assert.equal(a.checkPrerequisites(tree).ok, false);
  assert.equal(a.checkPrerequisites(tree, { classEntry: true }).ok, false);
  assert.equal(await a.addClassLevel(cls, { promptVitality: false }), null);
  assert.match(warnings.at(-1), /Repair invalid skill-purchase history/);
  assert.deepEqual(a.system.progression, before);
  a.system.progression[0].skills.science = 4;
  a.system.progression[1].skills.science = 1;
  a.derive();
  assert.deepEqual(a.system.skillPurchaseIssues, []);
  assert.equal(a.checkPrerequisites(tree).ok, true);
  assert.equal(a.checkPrerequisites(tree, { classEntry: true }).ok, true);
});

test("Unlocked Potential deficits block advancement and qualification until each historical maximum is purchased", async () => {
  const a = reset();
  a.items.push(feat("Unlocked Potential", "unlocked", { choice: "science" }));
  a.system = source(2);
  a.system.progression[0].skills.science = 6;
  a.system.progression[1].skills.science = 2;
  a.derive();
  assert.equal(a.system.skillTotals.science.ranks, 8);
  assert.equal(a.system.skillTotals.science.maxRanks, 8);
  assert.ok(
    a.system.skillPurchaseIssues.some(i => i.code === "unlocked-potential" && i.level === 1 && i.skill === "science")
  );
  const p = structuredClone(a.system.progression);
  assert.equal(a.checkPrerequisites({ type: "skill", key: "science", min: 8 }).ok, false);
  assert.equal(await a.addClassLevel(cls, { promptVitality: false }), null);
  assert.deepEqual(a.system.progression, p);
  a.system.progression[0].skills.science = 7;
  a.system.progression[1].skills.science = 1;
  a.derive();
  assert.deepEqual(a.system.skillPurchaseIssues, []);
  assert.equal(a.checkPrerequisites({ type: "skill", key: "science", min: 8 }).ok, true);
});
test("deferred spending must maximize Unlocked Potential before buying another skill, while allowing incremental purchases of its chosen skill", () => {
  const is = [...baseItems(), feat("Unlocked Potential", "unlocked", { choice: "science" })],
    s = compute(source(), is),
    before = structuredClone(s);
  assert.throws(() => plan(s, is, "analysis", { points: 1 }), /Unlocked Potential/);
  const p = plan(s, is, "science", { points: 1 });
  assert.equal(p.ranks, 1);
  assert.deepEqual(s, before);
  const full = compute(
    { ...source(), progression: [{ classId: "scientist", vitality: 6, skills: { science: 7 } }] },
    is
  );
  assert.equal(plan(full, is, "analysis", { points: 1 }).ranks, 1);
});
