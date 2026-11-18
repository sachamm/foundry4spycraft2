import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { analysisTaskValid } from "../module/rules/analysis-tasks.mjs";
import { taskPressureState, taskPressureUseSpec } from "../module/rules/task-pressure.mjs";

let serial = 0,
  posts = [],
  actors = [],
  natural = 7,
  stressDie = 4,
  evaluations = { d20: 0, stress: 0 },
  failPost = "",
  hook = null;
function apply(o, p) {
  for (const [path, value] of Object.entries(p)) {
    const keys = path.split(".");
    let target = o;
    for (const key of keys.slice(0, -1)) target = target[key] ??= {};
    const last = keys.at(-1);
    if (last.startsWith("-=")) delete target[last.slice(2)];
    else target[last] = structuredClone(value);
  }
}
const state = () => ({
  activeFeatNames: ["Forensic Genius"],
  activeFeatSelections: [],
  resourceUses: {},
  usagePeriods: { scene: "s", session: "t", mission: "m" },
  actionDice: { value: 0, max: 3, die: 4 },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      {
        name: s.name,
        ranks: s.key === "analysis" ? 6 : 0,
        cap: 30,
        threat: 20,
        bonusEntries: [],
        totals: s.abilities.map(ability => ({ ability, total: 7 }))
      }
    ])
  ),
  analysisTasks: {},
  accumulatedDamage: { version: 1, revision: 1, stress: 0, subdual: 0, pending: [] },
  survivalStats: { resistances: {}, resistanceSources: [], noFear: null },
  stressThreshold: 14,
  subdualThreshold: 14,
  saves: { will: { total: 2 }, fort: { total: 2 }, ref: { total: 2 } }
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.pressure" + ++serial;
    this.name = "Pressure fixture";
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.items = new Map();
    this.items.filter = fn => [...this.items.values()].filter(fn);
    this.items.find = fn => [...this.items.values()].find(fn);
    this.extraUses = [];
    this.system = state();
  }
  async update(p) {
    apply(this, p);
    this.system.limitedUses = [...limitedUseAbilities(this.system, [], cfg), ...this.extraUses];
    return this;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gm", isGM: true },
  settings: { get: () => ({ scene: "s", session: "t", mission: "m" }) },
  time: { worldTime: 0 },
  i18n: { localize: String, format: String },
  messages: {
    get contents() {
      return posts;
    },
    [Symbol.iterator]() {
      return posts[Symbol.iterator]();
    }
  },
  actors: {
    get contents() {
      return actors;
    },
    get: id => actors.find(a => a.id === id),
    [Symbol.iterator]() {
      return actors[Symbol.iterator]();
    }
  },
  combats: []
};
globalThis.foundry = {
  utils: { randomID: () => String(++serial), escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: message => ({ native: true, message }) } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.fromUuid = async uuid => posts.find(m => m.uuid === uuid) ?? actors.find(a => a.uuid === uuid) ?? null;
globalThis.Roll = class {
  constructor(formula, data = {}) {
    this.formula = formula;
    const stress = formula.replace(/\s/g, "") === "1d6",
      fixed = /^(10|20)\b/.test(formula);
    this.total = (stress ? stressDie : fixed ? parseInt(formula) : natural) + (data.total ?? 0);
    this.dice = fixed
      ? []
      : [
          {
            number: 1,
            faces: stress ? 6 : 20,
            total: stress ? stressDie : natural,
            results: [{ result: stress ? stressDie : natural, active: true }]
          }
        ];
    this._evaluated = false;
  }
  async evaluate() {
    this._evaluated = true;
    evaluations[this.formula.replace(/\s/g, "") === "1d6" ? "stress" : "d20"]++;
    await hook?.("evaluate", this);
    return this;
  }
  toJSON() {
    return { formula: this.formula, total: this.total, dice: structuredClone(this.dice), _evaluated: this._evaluated };
  }
  static fromJSON(json) {
    const data = JSON.parse(json),
      r = new Roll(data.formula);
    Object.assign(r, data);
    return r;
  }
  async toMessage(data) {
    await hook?.("post", this, data);
    if (failPost === "before") throw Error("post failed");
    const m = {
      ...data,
      id: "r" + ++serial,
      uuid: "ChatMessage.r" + serial,
      rolls: [this],
      async update(p) {
        apply(this, p);
        return this;
      }
    };
    posts.push(m);
    if (failPost === "committed") throw Error("post committed then rejected");
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  posts = [];
  actors = [];
  natural = 7;
  stressDie = 4;
  evaluations = { d20: 0, stress: 0 };
  failPost = "";
  hook = null;
  game.time.worldTime = 0;
  game.spycraft2 = {};
  game.user.isGM = true;
  const a = new SpycraftActor();
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  actors.push(a);
  return a;
}
const opts = { sourceEffectsResolved: true };
const create = (a, patch = {}) =>
    a.createAnalysisTask({ title: "Pressure investigation", baseChallenges: 6, pressuredConfirmed: true, ...patch }),
  pressure = (a, t, patch = {}) =>
    a.rollSkill("resolve", "con", {
      check: "task-pressure",
      analysisTaskId: t.id,
      taskChallengeDC: 10,
      taskChallengeDCConfirmed: true,
      ...patch
    }),
  challenge = (a, t) =>
    a.rollSkill("analysis", null, { check: "appraise", analysisTaskId: t.id, gearStatus: "available" }),
  confirm = (a, m, succeeded) => a.confirmCheckOutcome(m, { succeeded }),
  settle = (a, t, m, patch = {}) => a.settleAnalysisTask(t.id, m, { ...opts, ...patch }),
  prepare = (a, t, m, patch = {}) => a.prepareAnalysisTaskPressure(t.id, m, { ...opts, ...patch }),
  damage = (a, t, m) => a.applyAnalysisTaskPressureStress(t.id, m, opts);
test("pressured creation requires a reviewed health ledger and an exclusive GC declaration; an Analysis Challenge is gated by Resolve(Con)", async () => {
  const a = actor();
  a.system.accumulatedDamage = null;
  await assert.rejects(create(a), /ledger/);
  a.system.accumulatedDamage = state().accumulatedDamage;
  await assert.rejects(create(a, { unpressuredConfirmed: true }), /one pressure/);
  const t = await create(a);
  assert.equal(analysisTaskValid(t), true);
  await challenge(a, t);
  assert.equal(posts.length, 0);
  for (const patch of [
    { taskChallengeDC: null },
    { taskChallengeDC: -1 },
    { taskChallengeDC: 1.5 },
    { taskChallengeDCConfirmed: false },
    { taskChallengeDCConfirmed: "true" },
    { method: "take10", safeToTake: true }
  ]) {
    await pressure(a, t, patch);
    assert.equal(posts.length, 0);
  }
  const m = await pressure(a, t);
  assert.equal(m.flags.spycraft2.ability, "con");
  assert.equal(m.flags.spycraft2.analysisTask.stage, "pressure");
  assert.equal(m.flags.spycraft2.analysisTask.challengeDC, 10);
  assert.equal(m.flags.spycraft2.analysisTask.pressureUse.used, 1);
  assert.equal(a.system.actionDice.value, 0);
});
test("ordinary pressure success clears only the current Challenge and carries its actual DC into the bound Analysis receipt", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t);
  await confirm(a, m, false);
  assert.equal(m.flags.spycraft2.successConfirmed, null);
  await confirm(a, m, true);
  await settle(a, t, m);
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
  assert.equal(taskPressureState(a.system.analysisTasks[t.id]).ready, true);
  const n = posts.length;
  await pressure(a, t);
  assert.equal(posts.length, n);
  const c = await challenge(a, t);
  assert.equal(c.flags.spycraft2.analysisTask.challengeDC, 10);
  game.time.worldTime = 2;
  await confirm(a, c, true);
  const after = await settle(a, t, c);
  assert.equal(after.completed, 1);
  assert.equal(analysisTaskValid(after), true);
  assert.equal(taskPressureState(after).needsCheck, true);
  await challenge(a, t);
  assert.equal(posts.length, n + 1);
  const next = await pressure(a, after);
  assert.notEqual(next.flags.spycraft2.analysisTask.pressureUseId, m.flags.spycraft2.analysisTask.pressureUseId);
});
test("two concurrent attempts reserve one pressure use and failed or committed posting cannot grant an extra attempt", async () => {
  let a = actor(),
    t = await create(a);
  await Promise.all([pressure(a, t), pressure(a, t)]);
  assert.equal(posts.length, 1);
  assert.equal(a.system.resourceUses[taskPressureUseSpec(t).id].used, 1);
  a = actor();
  t = await create(a);
  failPost = "before";
  await assert.rejects(pressure(a, t), /post failed/);
  assert.equal(posts.length, 0);
  assert.equal(a.system.resourceUses[taskPressureUseSpec(t).id], undefined);
  failPost = "committed";
  const m = await pressure(a, t);
  assert.ok(m.flags.spycraft2.analysisTask.pressureRollId);
  assert.equal(posts.length, 1);
  assert.equal(a.system.resourceUses[taskPressureUseSpec(t).id].used, 1);
});
test("source loss and deadline expiry during a pressure roll refund the unused attempt without producing a receipt", async () => {
  for (const phase of ["source", "clock"]) {
    const a = actor(),
      t = await create(a, phase === "clock" ? { timeLimitSeconds: 1 } : {});
    hook = () => {
      if (phase === "source") a.system.activeFeatNames = [];
      else game.time.worldTime = 1;
    };
    await assert.rejects(pressure(a, t), /changed|eligibility|deadline/);
    assert.equal(posts.length, 0);
    assert.equal(a.system.resourceUses[taskPressureUseSpec(t).id], undefined);
    assert.equal(a.system.actionDice.value, 0);
  }
});
test("an actual activated critical success makes later Challenges pressure-immune without adding Challenge progress", async () => {
  const a = actor(),
    t = await create(a);
  natural = 20;
  a.system.actionDice.value = 1;
  const m = await pressure(a, t);
  await confirm(a, m, true);
  await a.activateCritical(m, {
    kind: "success",
    baseCost: 1,
    effect: "Pressure immunity for this task",
    effectConfirmed: true
  });
  assert.equal(m.flags.spycraft2.criticalSuccess, true);
  assert.equal(a.system.actionDice.value, 0);
  await settle(a, t, m);
  assert.equal(taskPressureState(a.system.analysisTasks[t.id]).immune, true);
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
  const c = await challenge(a, t);
  await confirm(a, c, true);
  await settle(a, t, c);
  assert.equal(taskPressureState(a.system.analysisTasks[t.id]).needsCheck, false);
  const next = await challenge(a, t);
  assert.equal(next.flags.spycraft2.analysisTask.pressureImmune, true);
});
test("declared Soldier14 natural20 and the pressure attempt reserve atomically through the actual class wrapper", async () => {
  const a = actor();
  a.system.classLevels = { soldier: 14 };
  await a.update({});
  const t = await create(a),
    m = await pressure(a, t, { oneInAMillion: true });
  assert.equal(m.flags.spycraft2.naturalDie, 20);
  assert.equal(m.flags.spycraft2.analysisTask.pressureUse.used, 1);
  assert.equal(a.system.resourceUses.oneInAMillion.used, 1);
  assert.equal(a.system.resourceUses[m.flags.spycraft2.analysisTask.pressureUseId].used, 1);
  assert.equal(a.system.actionDice.value, 0);
});
test("failed pressure locks and freezes one stress die, applies it once through the actual health ledger and advances no Challenge", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  await assert.rejects(settle(a, t, m), /locked|stress|receipt/);
  const stress = await prepare(a, t, m);
  assert.equal(m.flags.spycraft2.resolved, true);
  assert.equal(stress.flags.spycraft2.rawTotal, 4);
  assert.equal(evaluations.stress, 1);
  assert.equal((await prepare(a, t, m)).uuid, stress.uuid);
  assert.equal(evaluations.stress, 1);
  const applied = await damage(a, t, m);
  assert.equal(applied.newDamage, 4);
  assert.equal(a.system.accumulatedDamage.stress, 4);
  assert.equal((await damage(a, t, m)).id, applied.id);
  const after = await settle(a, t, m);
  assert.equal(after.completed, 0);
  assert.equal(after.pressureAttempts.length, 1);
  assert.equal(taskPressureState(after).errorIncrease, 0);
  assert.equal(analysisTaskValid(after), true);
  assert.equal((await damage(a, t, m)).id, applied.id);
  assert.equal((await prepare(a, t, m)).uuid, stress.uuid);
  assert.equal(a.system.accumulatedDamage.stress, 4);
  assert.equal(evaluations.stress, 1);
  assert.equal(a.system.actionDice.value, 0);
});
test("an actual pressure critical failure applies stress and increases only later Challenge error ranges by one", async () => {
  const a = actor(),
    t = await create(a);
  natural = 1;
  const m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  const b = new SpycraftActor();
  b.system.actionDice.value = 1;
  await b.update({});
  actors.push(b);
  await a.activateCritical(m, {
    kind: "failure",
    baseCost: 1,
    effect: "Pressure failure: stress and future Challenge error+1",
    effectConfirmed: true,
    opponent: true,
    lineOfSight: true,
    payer: b
  });
  assert.equal(m.flags.spycraft2.criticalFailure, true);
  assert.equal(b.system.actionDice.value, 0);
  await prepare(a, t, m);
  await damage(a, t, m);
  await settle(a, t, m);
  assert.equal(taskPressureState(a.system.analysisTasks[t.id]).errorIncrease, 1);
  natural = 7;
  const retry = await pressure(a, t);
  assert.equal(retry.flags.spycraft2.error, 3);
  await confirm(a, retry, true);
  await settle(a, t, retry);
  const c = await challenge(a, t);
  assert.equal(c.flags.spycraft2.error, 2);
  assert.equal(c.flags.spycraft2.analysisTask.pressureErrorIncrease, 1);
});
test("mandatory stress saves block pressure completion until the existing Health workflow resolves them", async () => {
  const a = actor(),
    t = await create(a);
  a.system.accumulatedDamage.stress = 14;
  const m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  await prepare(a, t, m);
  const applied = await damage(a, t, m);
  assert.equal(applied.state, "pending");
  assert.equal(applied.save.key, "will");
  await assert.rejects(settle(a, t, m), /Health|save/);
  assert.equal(a.system.analysisTasks[t.id].pressureAttempts.length, 0);
  /* The separately tested Health controller completes the required save here. */ a.flags.spycraft2.damageEvents[
    applied.id
  ].state = "settled";
  a.system.accumulatedDamage.pending = [];
  await settle(a, t, m);
  assert.equal(a.system.analysisTasks[t.id].pressureAttempts.length, 1);
});
test("prepared resistance may completely absorb ordinary pressure stress without changing its rolled dose or requiring a save", async () => {
  const a = actor(),
    t = await create(a);
  a.system.survivalStats.resistances.stress = "all";
  const m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  await prepare(a, t, m);
  const applied = await damage(a, t, m);
  assert.equal(applied.newDamage, 0);
  assert.equal(applied.request.newDamage, 4);
  assert.equal(applied.save, null);
  const after = await settle(a, t, m);
  assert.equal(after.pressureAttempts[0].stressRaw, 4);
  assert.equal(a.system.accumulatedDamage.stress, 0);
});
test("failed stress posting retries the same frozen die rather than evaluating a second one", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  failPost = "before";
  await assert.rejects(prepare(a, t, m), /post failed/);
  assert.equal(m.flags.spycraft2.taskPressurePreparation.state, "rolled");
  assert.equal(evaluations.stress, 1);
  failPost = "";
  stressDie = 6;
  const r = await prepare(a, t, m);
  assert.equal(r.flags.spycraft2.rawTotal, 4);
  assert.equal(evaluations.stress, 1);
  assert.equal(posts.length, 2);
});
test("an interrupted frozen-die save requires GC retention and cannot undo or reroll an already evaluated stress die", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  const update = m.update.bind(m);
  m.update = async p => {
    if (p["flags.spycraft2"]?.taskPressurePreparation?.state === "rolled") throw Error("frozen save failed");
    return update(p);
  };
  assert.equal((await prepare(a, t, m)).needsReview, true);
  assert.equal(evaluations.stress, 1);
  await assert.rejects(
    a.reviewAnalysisTaskSettlement({ keep: false, reason: "Do not reroll", confirmed: true }),
    /already rolled/
  );
  m.update = update;
  await a.reviewAnalysisTaskSettlement({ keep: true, reason: "Retain the actual frozen stress die", confirmed: true });
  stressDie = 6;
  const r = await prepare(a, t, m);
  assert.equal(r.flags.spycraft2.rawTotal, 4);
  assert.equal(evaluations.stress, 1);
});
test("task keep/undo recovery leaves applied pressure damage intact and can resettle the prepared result without reapplying it", async () => {
  for (const keep of [true, false]) {
    const a = actor(),
      t = await create(a),
      m = await pressure(a, t, { taskChallengeDC: 50 });
    await confirm(a, m, false);
    await prepare(a, t, m);
    const hit = await damage(a, t, m),
      update = m.update.bind(m);
    m.update = async p => {
      if (p["flags.spycraft2"]?.analysisTaskSettlement?.state === "settled") throw Error("final save failed");
      return update(p);
    };
    assert.equal((await settle(a, t, m)).needsReview, true);
    m.update = update;
    await a.reviewAnalysisTaskSettlement({ keep, reason: "Check task event without healing stress", confirmed: true });
    assert.equal(a.system.accumulatedDamage.stress, 4);
    assert.equal(a.system.analysisTasks[t.id].pressureAttempts.length, keep ? 1 : 0);
    if (!keep) {
      assert.equal(m.flags.spycraft2.resolved, true);
      await settle(a, t, m);
    }
    assert.equal((await damage(a, t, m)).id, hit.id);
    assert.equal(evaluations.stress, 1);
    assert.equal(a.system.accumulatedDamage.stress, 4);
  }
});
test("a permitted replacement roll preserves the one-pressure-attempt reservation and does not create another initial use", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  a.extraUses.push({
    id: "perfect",
    name: "Perfect",
    workflow: "reroll",
    mastery: "Perfect Skill Mastery",
    period: "session",
    limit: 3,
    cost: 0
  });
  await a.update({});
  natural = 20;
  const r = await a.rerollCheck(m, { resource: "perfect", failed: true });
  assert.equal(a.system.resourceUses[r.flags.spycraft2.analysisTask.pressureUseId].used, 1);
  assert.equal(r.flags.spycraft2.analysisTask.pressureUse.used, 1);
  assert.equal(a.system.resourceUses.perfect.used, 1);
  assert.equal(r.flags.spycraft2.rerollOf, m.uuid);
});

test("the user’s ruling keeps the separate pressure error increase when resistance absorbs all stress", async () => {
  const a = actor(),
    t = await create(a);
  a.system.survivalStats.resistances.stress = "all";
  natural = 1;
  const m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  const b = new SpycraftActor();
  b.system.actionDice.value = 1;
  await b.update({});
  actors.push(b);
  await a.activateCritical(m, {
    kind: "failure",
    baseCost: 1,
    effect: "Pressure critical failure",
    effectConfirmed: true,
    opponent: true,
    lineOfSight: true,
    payer: b
  });
  await prepare(a, t, m);
  const hit = await damage(a, t, m);
  assert.equal(hit.newDamage, 0);
  assert.equal(hit.request.newDamage, 4);
  const r = await settle(a, t, m);
  assert.equal(taskPressureState(r).errorIncrease, 1);
  assert.equal(r.pressureAttempts[0].criticalFailure, true);
  assert.equal(a.system.accumulatedDamage.stress, 0);
});
test("only an owning GC can prepare or apply pressure stress; cancellation and ambiguous pressure declarations make no task changes", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  game.user.isGM = false;
  await assert.rejects(prepare(a, t, m), /GC/);
  await assert.rejects(damage(a, t, m), /GC/);
  game.user.isGM = true;
  a.isOwner = false;
  await assert.rejects(prepare(a, t, m), /GC/);
  a.isOwner = true;
  assert.equal(await a.manageAnalysisTasks(), null);
  await assert.rejects(create(a, { pressuredConfirmed: "true", unpressuredConfirmed: true }), /boolean/);
  assert.equal(m.flags.spycraft2.taskPressurePreparation, undefined);
  assert.equal(evaluations.stress, 0);
});
test("timed failure preparation remains a valid owed consequence after the deadline and prevents premature task expiry", async () => {
  const a = actor(),
    t = await create(a, { timeLimitSeconds: 2 }),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  game.time.worldTime = 3;
  await prepare(a, t, m);
  await assert.rejects(a.expireAnalysisTask(t.id, { confirmed: true }), /timely/);
  await damage(a, t, m);
  await settle(a, t, m);
  const after = await a.expireAnalysisTask(t.id, { confirmed: true });
  assert.equal(after.status, "failed");
  assert.equal(after.pressureAttempts.length, 1);
  assert.equal(a.system.accumulatedDamage.stress, 4);
});
test("permitted attribute substitution still applies to pressure, while standalone-only10-Second Solution cannot bypass the Complex Task", async () => {
  const a = actor();
  a.system.classLevels = { schemer: 4, scientist: 14 };
  await a.update({});
  const t = await create(a);
  await pressure(a, t, { allAccordingToPlan: true, tenSecondSolution: true, standaloneCheckConfirmed: true });
  assert.equal(posts.length, 0);
  assert.deepEqual(a.system.resourceUses, {});
  const m = await pressure(a, t, { allAccordingToPlan: true });
  assert.equal(m.flags.spycraft2.ability, "int");
  assert.equal(m.flags.spycraft2.attributeSubstitution.originalAbility, "con");
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
  assert.equal(m.flags.spycraft2.analysisTask.pressureUse.used, 1);
});

test("the GC recovery dialog shows the frozen stress value and omits the unavailable Undo choice", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  const update = m.update.bind(m);
  m.update = async p => {
    if (p["flags.spycraft2"]?.taskPressurePreparation?.state === "rolled") throw Error("frozen save failed");
    return update(p);
  };
  await prepare(a, t, m);
  const old = foundry.applications.api.DialogV2.input;
  let content = "";
  foundry.applications.api.DialogV2.input = async options => {
    content = options.content;
    return null;
  };
  try {
    await a.manageAnalysisTasks();
    assert.match(content, /Frozen stress die: 4/);
    assert.doesNotMatch(content, /value="reviewUndo"/);
    assert.match(content, /value="reviewKeep"/);
  } finally {
    foundry.applications.api.DialogV2.input = old;
  }
});

test("already finalized pressure and Analysis receipts remain settleable exactly once through their task", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t);
  await confirm(a, m, true);
  await a.finishCheck(m);
  assert.equal(m.flags.spycraft2.resolved, true);
  await settle(a, t, m);
  assert.equal(taskPressureState(a.system.analysisTasks[t.id]).ready, true);
  const c = await challenge(a, t);
  await confirm(a, c, true);
  await a.finishCheck(c);
  await settle(a, t, c);
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  await assert.rejects(settle(a, t, c));
});
test("a finalized failed pressure result can still lock its unique stress consequence without reopening the skill roll", async () => {
  const a = actor(),
    t = await create(a),
    m = await pressure(a, t, { taskChallengeDC: 50 });
  await confirm(a, m, false);
  await a.finishCheck(m);
  await prepare(a, t, m);
  await damage(a, t, m);
  await settle(a, t, m);
  assert.equal(a.system.analysisTasks[t.id].pressureAttempts.length, 1);
  assert.equal(a.system.accumulatedDamage.stress, 4);
  assert.equal(m.flags.spycraft2.resolved, true);
  assert.equal(evaluations.stress, 1);
});
