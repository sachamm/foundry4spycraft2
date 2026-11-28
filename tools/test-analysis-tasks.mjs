import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";

import { createAnalysisTaskPlan, analysisTaskValid, analysisTaskCheckPlan } from "../module/rules/analysis-tasks.mjs";
import { analysisTaskReview } from "../module/apps/analysis-tasks.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
let scene = "s",
  posts = [],
  failPost = false,
  hook = null,
  serial = 0;
const source = "Forensic Genius";
const state = () => ({
  activeFeatNames: [source],
  activeFeatSelections: [],
  resourceUses: {},
  usagePeriods: { scene, session: "t", mission: "m" },
  actionDice: { value: 0, max: 3, die: 4 },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      {
        name: s.name,
        ranks: s.key === "analysis" ? 14 : 0,
        cap: 30,
        threat: 20,
        bonusEntries: [],
        totals: s.abilities.map(ability => ({ ability, total: 7 }))
      }
    ])
  )
});
function apply(a, p) {
  for (const [path, value] of Object.entries(p)) {
    const keys = path.split(".");
    let o = a;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    const last = keys.at(-1);
    if (last.startsWith("-=")) delete o[last.slice(2)];
    else o[last] = structuredClone(value);
  }
}
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.wheel" + ++serial;
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.items = new Map();
    this.items.filter = fn => [...this.items.values()].filter(fn);
    this.system = state();
    this.system.limitedUses = limitedUseAbilities(this.system, [], cfg);
  }
  async update(p) {
    apply(this, p);
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { isGM: true },
  settings: { get: () => ({ scene, session: "t", mission: "m" }) },
  i18n: { localize: String, format: String }
};
globalThis.foundry = {
  utils: { randomID: () => String(++serial), escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: () => ({ native: true }) } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(formula, data) {
    const fixed = /^10\b/.test(formula) || /^20\b/.test(formula),
      die = fixed ? parseInt(formula) : 7;
    this.total = die + (data.total ?? 0);
    this.dice = fixed ? [] : [{ total: die }];
  }
  async evaluate() {
    await hook?.();
    return this;
  }
  async toMessage(data) {
    if (failPost) throw Error("post failed");
    const m = {
      ...data,
      id: "r" + ++serial,
      uuid: "ChatMessage.r" + serial,
      async update(p) {
        apply(this, p);
        return this;
      }
    };
    posts.push(m);
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor(count = 2) {
  scene = "s";
  posts = [];
  failPost = false;
  hook = null;
  const a = new SpycraftActor();
  a.system = state();
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  return a;
}

globalThis.fromUuid = async id => posts.find(m => m.uuid === id) ?? null;
game.messages = {
  get contents() {
    return posts;
  },
  [Symbol.iterator]() {
    return posts[Symbol.iterator]();
  }
};
game.time = { worldTime: 0 };
const analysis = cfg.skills.analysis.checks[0].id;
function reset() {
  game.time.worldTime = 0;
  const a = actor();
  game.spycraft2 = {};
  game.user.isGM = true;
  foundry.utils.randomID = () => String(++serial);
  a.system.analysisTasks = {};
  return a;
}
const create = async (a, n = 6) =>
    a.createAnalysisTask({ title: "Forensic investigation", baseChallenges: n, unpressuredUntimedConfirmed: true }),
  roll = async (a, id) =>
    a.rollSkill("analysis", null, { check: analysis, gearStatus: "available", analysisTaskId: id }),
  result = (m, success, critical = "") =>
    Object.assign(m.flags.spycraft2, {
      successConfirmed: success,
      ...(critical
        ? {
            [critical === "success" ? "criticalSuccess" : "criticalFailure"]: true,
            criticalActivation: { kind: critical, cost: 1 }
          }
        : {})
    });
const settle = (a, t, m) => a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true });

test("creation calculates all legal unmodified counts with and without Forensic Genius and validates names, timing scope and duplicates", async () => {
  for (const active of [false, true])
    for (let n = 2; n <= 100; n++) {
      const s = state();
      s.activeFeatNames = active ? [source] : [];
      const t = createAnalysisTaskPlan(s, {
        id: "task_x",
        title: "Task",
        baseChallenges: n,
        unpressuredUntimedConfirmed: true
      });
      assert.equal(t.requiredChallenges, Math.max(1, n - (active ? 2 : 0)));
      assert.equal(analysisTaskValid(t), true);
    }
  for (const patch of [
    { baseChallenges: 0 },
    { baseChallenges: 1 },
    { baseChallenges: 1.5 },
    { baseChallenges: "4" },
    { title: "" },
    { title: "x".repeat(161) },
    { unpressuredUntimedConfirmed: false },
    { unpressuredUntimedConfirmed: "true" }
  ])
    assert.throws(() =>
      createAnalysisTaskPlan(state(), {
        id: "task_x",
        title: "Task",
        baseChallenges: 6,
        unpressuredUntimedConfirmed: true,
        ...patch
      })
    );
  const a = reset(),
    t = await create(a);
  assert.equal(analysisTaskValid(t), true);
  assert.throws(() => createAnalysisTaskPlan(a.system, { ...t, unpressuredUntimedConfirmed: true }));
});
test("actual Analysis rolls bind the current task revision and use its original challenge count exactly once; other skills, ended/malformed records and changed sources cannot bind", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  assert.equal(m.flags.spycraft2.analysisTask.requiredChallenges, 4);
  assert.equal(m.flags.spycraft2.forensicGenius.challenges.required, 4);
  const n = posts.length;
  await a.rollSkill("search", null, { check: cfg.skills.search.checks[0].id, analysisTaskId: t.id });
  assert.equal(posts.length, n);
  a.system.activeFeatNames = [];
  await roll(a, t.id);
  assert.equal(posts.length, n);
  a.system.activeFeatNames = [source];
  a.system.analysisTasks[t.id].completed = 3;
  await roll(a, t.id);
  assert.equal(posts.length, n);
  assert.equal(resolveSkillCheck(a.system, "analysis", null, { analysisTaskId: t.id }), null);
});
test("success completes one, ordinary failure makes no progress and an activated critical success completes two; settled receipts cannot be reused or boosted", async () => {
  const a = reset(),
    t = await create(a);
  let m = await roll(a, t.id);
  result(m, true);
  let r = await settle(a, t, m);
  assert.equal(r.completed, 1);
  assert.equal(m.flags.spycraft2.resolved, true);
  assert.equal(m.flags.spycraft2.analysisTaskSettlement.state, "settled");
  await assert.rejects(settle(a, t, m));
  m = await roll(a, t.id);
  result(m, false);
  r = await settle(a, t, m);
  assert.equal(r.completed, 1);
  m = await roll(a, t.id);
  result(m, true, "success");
  r = await settle(a, t, m);
  assert.equal(r.completed, 3);
  m = await roll(a, t.id);
  result(m, true, "success");
  r = await settle(a, t, m);
  assert.equal(r.completed, 4);
  assert.equal(r.status, "complete");
  assert.equal(analysisTaskValid(r), true);
  const n = posts.length;
  await roll(a, t.id);
  assert.equal(posts.length, n);
  assert.equal(a.system.actionDice.value, 0);
  const { actionDieBoostPlan } = await import("../module/rules/action-dice.mjs");
  const boost = actionDieBoostPlan({ actionDice: { value: 3 } }, m.flags.spycraft2, { count: 1 });
  assert.equal(boost.blocked, true);
  assert.match(boost.reason, /resolved/);
});
test("critical failure undoes the recorded number of dice, including zero-cost and surcharge totals; progress below zero permanently fails the task", async () => {
  for (const cost of [0, 1, 2, 4]) {
    const a = reset();
    a.system.activeFeatNames = [];
    const t = await create(a, 8);
    for (let i = 0; i < 2; i++) {
      const m = await roll(a, t.id);
      result(m, true);
      await settle(a, t, m);
    }
    const m = await roll(a, t.id);
    result(m, false, "failure");
    Object.assign(m.flags.spycraft2, { naturalDie: 1, error: 1, errorActivationDeclined: false });
    m.flags.spycraft2.criticalActivation.cost = cost;
    const r = await settle(a, t, m);
    assert.equal(r.completed, 2 - cost);
    assert.equal(r.status, cost > 2 ? "failed" : "active");
    assert.equal(r.events.at(-1).activationCount, cost);
    assert.equal(analysisTaskValid(r), true);
    if (cost > 2) {
      const n = posts.length;
      await roll(a, t.id);
      assert.equal(posts.length, n);
    }
  }
});
test("outcomes must be adjudicated, error decisions resolved and actual critical costs recorded; unrelated, stale, replaced and already-used receipts are rejected", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id),
    original = structuredClone(m.flags.spycraft2);
  for (const patch of [
    {},
    { successConfirmed: false, naturalDie: 1, error: 1 },
    { successConfirmed: true, actorUuid: "Actor.other" },
    { successConfirmed: true, skillKey: "search" },
    { successConfirmed: true, superseded: true },
    { successConfirmed: true, analysisTask: { ...original.analysisTask, revision: 1 } },
    { successConfirmed: true, criticalSuccess: true },
    { successConfirmed: false, criticalFailure: true, criticalActivation: { kind: "failure", cost: "2" } }
  ]) {
    m.flags.spycraft2 = { ...structuredClone(original), ...patch };
    await assert.rejects(settle(a, t, m));
    assert.equal(a.system.analysisTasks[t.id].completed, 0);
  }
  m.flags.spycraft2 = structuredClone(original);
  result(m, true);
  await assert.rejects(a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: false }));
  const stale = await roll(a, t.id);
  result(stale, true);
  await settle(a, t, m);
  await assert.rejects(settle(a, t, stale));
});
test("concurrent settlements can advance a bound Challenge only once and live task changes during RNG prevent posting", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  result(m, true);
  const r = await Promise.allSettled([settle(a, t, m), settle(a, t, m)]);
  assert.equal(r.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  const n = posts.length;
  hook = () => {
    a.system.analysisTasks[t.id].title = "Changed";
  };
  /* title changes alone do not change this Challenge’s mechanics */ await roll(a, t.id);
  assert.equal(posts.length, n + 1);
  hook = () => {
    a.system.analysisTasks[t.id].forensicGenius = false;
  };
  await assert.rejects(roll(a, t.id), /changed|review/);
  assert.equal(posts.length, n + 1);
});
test("failed receipt reservation and failed task saving restore an unused Challenge; committed-then-rejected saves are recognized without duplication", async () => {
  for (const phase of ["reserve", "task", "committed"]) {
    const a = reset(),
      t = await create(a),
      m = await roll(a, t.id);
    result(m, true);
    const update = a.update.bind(a),
      post = m.update.bind(m);
    if (phase === "reserve")
      m.update = async () => {
        throw Error("reserve failed");
      };
    else
      a.update = async p => {
        if (Object.keys(p).some(k => k.startsWith("system.analysisTasks."))) {
          if (phase === "committed") await update(p);
          throw Error("task failed");
        }
        return update(p);
      };
    if (phase === "committed") {
      const r = await settle(a, t, m);
      assert.equal(r.completed, 1);
    } else {
      await assert.rejects(settle(a, t, m), /failed/);
      assert.equal(a.system.analysisTasks[t.id].completed, 0);
      assert.equal(m.flags.spycraft2.analysisTaskSettlement, undefined);
    }
    m.update = post;
  }
});
test("a failed final receipt write holds progress for exact GC keep/undo recovery and both choices avoid adding a Challenge twice", async () => {
  for (const keep of [true, false]) {
    const a = reset(),
      t = await create(a),
      m = await roll(a, t.id);
    result(m, true);
    const update = m.update.bind(m);
    let calls = 0;
    m.update = async p => {
      if (++calls === 2) throw Error("final receipt failed");
      return update(p);
    };
    const r = await settle(a, t, m);
    assert.equal(r.needsReview, true);
    assert.equal(a.system.analysisTasks[t.id].completed, 1);
    assert.ok(analysisTaskReview(a));
    await assert.rejects(settle(a, t, m), /Review/);
    m.update = update;
    await a.reviewAnalysisTaskSettlement({ keep, reason: "Checked saved task and receipt", confirmed: true });
    assert.equal(a.system.analysisTasks[t.id].completed, keep ? 1 : 0);
    assert.equal(!!m.flags.spycraft2.analysisTaskSettlement, keep);
    assert.equal(analysisTaskReview(a), null);
    assert.equal(a.flags.spycraft2.analysisTaskReviews.length, 1);
  }
});
test("partial task writes and failed review-flag persistence remain held through local fallback until a GC chooses an exact final state", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  result(m, true);
  const update = a.update.bind(a);
  a.update = async p => {
    if (Object.keys(p).some(k => k.startsWith("system.analysisTasks."))) {
      a.system.analysisTasks[t.id].completed = 1;
      throw Error("partial");
    }
    if (p["flags.spycraft2.analysisTaskReview"]) throw Error("flag unavailable");
    return update(p);
  };
  const r = await settle(a, t, m);
  assert.equal(r.needsReview, true);
  assert.ok(game.spycraft2.pendingAnalysisTasks[a.uuid]);
  await assert.rejects(create(a), /Review/);
  a.update = update;
  await a.reviewAnalysisTaskSettlement({ keep: true, reason: "Confirmed saved Challenge", confirmed: true });
  assert.equal(analysisTaskValid(a.system.analysisTasks[t.id]), true);
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  assert.equal(analysisTaskReview(a), null);
});
test("partial creation can be reviewed and undone; non-GCs, non-owners, cancelled/stale dialogs and malformed history cannot change tasks", async () => {
  let a = reset();
  const update = a.update.bind(a);
  a.update = async p => {
    const k = Object.keys(p).find(k => k.startsWith("system.analysisTasks."));
    if (k) {
      apply(a, { [k]: { title: "partial" } });
      throw Error("partial create");
    }
    return update(p);
  };
  assert.equal((await create(a)).needsReview, true);
  a.update = update;
  await a.reviewAnalysisTaskSettlement({ keep: false, reason: "Discard incomplete task creation", confirmed: true });
  assert.deepEqual(a.system.analysisTasks, {});
  a = reset();
  game.user.isGM = false;
  await assert.rejects(create(a), /GC/);
  game.user.isGM = true;
  a.isOwner = false;
  await assert.rejects(create(a), /GC/);
  a.isOwner = true;
  const dialog = foundry.applications.api.DialogV2.input;
  assert.equal(await a.manageAnalysisTasks(), null);
  foundry.applications.api.DialogV2.input = async () => {
    a.system.activeFeatNames = [];
    return { action: "create", title: "changed", baseChallenges: 4, unpressuredUntimedConfirmed: true };
  };
  await assert.rejects(a.manageAnalysisTasks(), /changed/);
  foundry.applications.api.DialogV2.input = dialog;
  assert.deepEqual(a.system.analysisTasks, {});
  const t = await create(a),
    m = await roll(a, t.id);
  result(m, true);
  await settle(a, t, m);
  const bad = structuredClone(a.system.analysisTasks[t.id]);
  bad.events[0].change = 0;
  assert.equal(analysisTaskValid(bad), false);
});
test("task binding is part of immutable outcome evidence", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id),
    { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs"),
    f = m.flags.spycraft2,
    e = rollEvidence(f),
    bad = structuredClone(f);
  bad.analysisTask.requiredChallenges++;
  assert.equal(rollEvidenceMatches(e, bad), false);
});

test("source loss after a completed roll preserves its earned result while external receipt edits after task saving are held rather than overwritten", async () => {
  let a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  result(m, true);
  let update = m.update.bind(m);
  m.update = async p => {
    await update(p);
    if (p["flags.spycraft2"]?.analysisTaskSettlement?.state === "reserved") a.system.activeFeatNames = [];
    return m;
  };
  await settle(a, t, m);
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  assert.equal(m.flags.spycraft2.analysisTaskSettlement.state, "settled");
  assert.deepEqual(a.system.activeFeatNames, []);
  a = reset();
  t = await create(a);
  m = await roll(a, t.id);
  result(m, true);
  update = a.update.bind(a);
  a.update = async p => {
    await update(p);
    if (Object.keys(p).some(k => k.startsWith("system.analysisTasks."))) m.flags.spycraft2.successConfirmed = false;
  };
  const r = await settle(a, t, m);
  assert.equal(r.needsReview, true);
  assert.equal(m.flags.spycraft2.successConfirmed, false);
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  await assert.rejects(
    a.reviewAnalysisTaskSettlement({ keep: true, reason: "Changed outside transaction", confirmed: true }),
    /outside/
  );
});

test("the unpressured workflow refuses known combat and explicit pressure rather than skipping Resolve prerequisites", async () => {
  const a = reset(),
    t = await create(a);
  assert.match(
    analysisTaskCheckPlan(a.system, "analysis", { id: analysis }, { analysisTaskId: t.id, taskPressure: true })
      .blockedReason,
    /pressure/
  );
  await a.rollSkill("analysis", null, {
    check: analysis,
    analysisTaskId: t.id,
    gearStatus: "available",
    inCombat: true
  });
  assert.equal(posts.length, 0);
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
});

const timed = (a, seconds = 2) =>
  a.createAnalysisTask({
    title: "Timed investigation",
    baseChallenges: 6,
    unpressuredConfirmed: true,
    timeLimitSeconds: seconds
  });
test("timed tasks validate positive finite durations and preserve existing untimed declarations and records", async () => {
  for (const seconds of [0.5, 1, 60, 3600]) {
    const a = reset(),
      t = await timed(a, seconds);
    assert.deepEqual(t.timing, { startedAt: 0, limitSeconds: seconds, deadline: seconds });
    assert.equal(analysisTaskValid(t), true);
  }
  for (const seconds of [0, -1, Infinity, NaN, "2", false]) {
    const a = reset();
    await assert.rejects(timed(a, seconds), /positive finite/);
  }
  const a = reset();
  await assert.rejects(
    a.createAnalysisTask({
      title: "Contradictory scope",
      baseChallenges: 3,
      timeLimitSeconds: 2,
      unpressuredUntimedConfirmed: true
    }),
    /unpressured/
  );
  const legacy = await create(a);
  assert.equal(legacy.timing, undefined);
  assert.equal(analysisTaskValid(legacy), true);
});
test("actual task rolls stamp their completion time and the actor’s clock overrides a forged client clock at the exact deadline", async () => {
  const a = reset(),
    t = await timed(a);
  game.time.worldTime = 1;
  const m = await roll(a, t.id);
  assert.equal(m.flags.spycraft2.analysisTask.completedAt, 1);
  game.time.worldTime = 2;
  const n = posts.length;
  await a.rollSkill("analysis", null, {
    check: analysis,
    gearStatus: "available",
    analysisTaskId: t.id,
    taskWorldTime: 0
  });
  assert.equal(posts.length, n);
  await assert.rejects(
    a.rollCheck(
      "1d20 + @total",
      { total: 7 },
      { checkKind: "skill", skillKey: "analysis", checkId: analysis, analysisTask: m.flags.spycraft2.analysisTask }
    ),
    /deadline/
  );
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
});
test("expiry during RNG prevents posting and leaves task progress and resources unchanged", async () => {
  const a = reset(),
    t = await timed(a);
  hook = () => {
    game.time.worldTime = 2;
  };
  await assert.rejects(roll(a, t.id), /deadline/);
  assert.equal(posts.length, 0);
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
  assert.equal(a.system.actionDice.value, 0);
  assert.deepEqual(a.system.resourceUses, {});
});
test("a timely Challenge may be adjudicated and settled after the deadline using its frozen actual completion time", async () => {
  const a = reset(),
    t = await timed(a);
  game.time.worldTime = 1;
  const m = await roll(a, t.id);
  game.time.worldTime = 99;
  result(m, true);
  const after = await settle(a, t, m);
  assert.equal(after.completed, 1);
  assert.equal(after.events[0].completedAt, 1);
  assert.equal(after.events[0].at, 99);
  assert.equal(analysisTaskValid(after), true);
  const n = posts.length;
  await roll(a, t.id);
  assert.equal(posts.length, n);
});
test("missing, late or future completion times cannot settle a timed task and timing evidence is immutable", async () => {
  const a = reset(),
    t = await timed(a),
    m = await roll(a, t.id);
  result(m, true);
  const original = structuredClone(m.flags.spycraft2);
  for (const completedAt of [undefined, null, 2, 3, -1, 0.5]) {
    m.flags.spycraft2 = structuredClone(original);
    m.flags.spycraft2.analysisTask.completedAt = completedAt;
    await assert.rejects(settle(a, t, m));
  }
  m.flags.spycraft2 = structuredClone(original);
  const { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs"),
    e = rollEvidence(m.flags.spycraft2),
    bad = structuredClone(m.flags.spycraft2);
  bad.analysisTask.completedAt++;
  assert.equal(rollEvidenceMatches(e, bad), false);
});
test("expired tasks fail permanently only after any timely pending Challenge is settled; early or unconfirmed expiry cannot change progress", async () => {
  const a = reset(),
    t = await timed(a),
    m = await roll(a, t.id);
  await assert.rejects(a.expireAnalysisTask(t.id, { confirmed: true }), /elapsed/);
  game.time.worldTime = 2;
  await assert.rejects(a.expireAnalysisTask(t.id), /confirm/);
  await assert.rejects(a.expireAnalysisTask(t.id, { confirmed: true }), /timely/);
  result(m, false);
  await settle(a, t, m);
  const r = await a.expireAnalysisTask(t.id, { confirmed: true });
  assert.equal(r.status, "failed");
  assert.equal(r.timedOutAt, 2);
  assert.equal(r.completed, 0);
  assert.equal(analysisTaskValid(r), true);
  await assert.rejects(a.expireAnalysisTask(t.id, { confirmed: true }), /active/);
  const n = posts.length;
  await roll(a, t.id);
  assert.equal(posts.length, n);
});
test("partial deadline writes use the same exact keep/undo recovery without adding or discarding Challenge progress", async () => {
  for (const keep of [true, false]) {
    const a = reset(),
      t = await timed(a);
    game.time.worldTime = 2;
    const update = a.update.bind(a);
    a.update = async p => {
      if (Object.keys(p).some(k => k.startsWith("system.analysisTasks."))) {
        a.system.analysisTasks[t.id].status = "failed";
        throw Error("partial expiry");
      }
      return update(p);
    };
    assert.equal((await a.expireAnalysisTask(t.id, { confirmed: true })).needsReview, true);
    a.update = update;
    await a.reviewAnalysisTaskSettlement({ keep, reason: "Checked deadline and task state", confirmed: true });
    assert.equal(a.system.analysisTasks[t.id].status, keep ? "failed" : "active");
    assert.equal(a.system.analysisTasks[t.id].completed, 0);
    assert.equal(analysisTaskValid(a.system.analysisTasks[t.id]), true);
  }
});

test("replacement rolls recheck the current task clock and refund an unused reroll allowance after expiry", async () => {
  const a = reset(),
    t = await timed(a),
    m = await roll(a, t.id);
  result(m, false);
  a.system.limitedUses.push({
    id: "perfect",
    name: "Perfect",
    workflow: "reroll",
    mastery: "Perfect Skill Mastery",
    period: "session",
    limit: 3,
    cost: 0
  });
  game.time.worldTime = 2;
  await assert.rejects(a.rerollCheck(m, { resource: "perfect", failed: true }), /deadline/);
  assert.equal(posts.length, 1);
  assert.equal(a.system.resourceUses.perfect?.used ?? 0, 0);
});

test("deadline expiry in a final asynchronous validation cannot create a late receipt", async () => {
  const a = reset(),
    t = await timed(a);
  const plan = analysisTaskCheckPlan(
    a.system,
    "analysis",
    { id: analysis },
    { analysisTaskId: t.id, taskWorldTime: 0 }
  );
  let calls = 0;
  await assert.rejects(
    a.rollCheck(
      "1d20 + @total",
      { total: 7 },
      {
        checkKind: "skill",
        skillKey: "analysis",
        checkId: analysis,
        analysisTask: plan.context,
        validateRerollContext: async () => {
          if (++calls === 2) game.time.worldTime = 2;
        }
      }
    ),
    /deadline/
  );
  assert.equal(posts.length, 0);
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
});

const pendingError = m =>
  Object.assign(m.flags.spycraft2, { successConfirmed: false, errorConfirmed: true, naturalDie: 1, error: 1 });
test("GC-confirmed declined errors settle ordinary failure without dice, boosting or a critical activation, and require a strict separate declaration", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  pendingError(m);
  for (const value of [undefined, false, "true", 1])
    await assert.rejects(
      a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true, errorActivationDeclinedConfirmed: value }),
      /declined/
    );
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
  assert.equal(m.flags.spycraft2.errorActivationDeclined, undefined);
  const r = await a.settleAnalysisTask(t.id, m, {
    sourceEffectsResolved: true,
    errorActivationDeclinedConfirmed: true
  });
  assert.equal(r.completed, 0);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].errorActivationDeclined, true);
  assert.equal(m.flags.spycraft2.errorActivationDeclined, true);
  assert.equal(m.flags.spycraft2.analysisTaskSettlement.errorDeclinedByGC, true);
  assert.equal(m.flags.spycraft2.criticalFailure, undefined);
  assert.equal(a.system.actionDice.value, 0);
  assert.deepEqual(a.system.resourceUses, {});
  const { criticalPlan } = await import("../module/rules/criticals.mjs");
  assert.equal(
    criticalPlan(a.system, m.flags.spycraft2, {
      kind: "failure",
      baseCost: 1,
      effect: "Too late",
      effectConfirmed: true,
      opponent: true,
      lineOfSight: true,
      samePayer: false,
      available: 3
    }).blocked,
    true
  );
});
test("negative-result errors also accept the explicit GC decline, while already activated critical failures retain their paid setback", async () => {
  let a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  Object.assign(m.flags.spycraft2, { successConfirmed: false, effectiveTotal: -1 });
  await a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true, errorActivationDeclinedConfirmed: true });
  assert.equal(m.flags.spycraft2.errorActivationDeclined, true);
  a = reset();
  t = await create(a);
  m = await roll(a, t.id);
  pendingError(m);
  Object.assign(m.flags.spycraft2, { criticalFailure: true, criticalActivation: { kind: "failure", cost: 1 } });
  const r = await a.settleAnalysisTask(t.id, m, {
    sourceEffectsResolved: true,
    errorActivationDeclinedConfirmed: true
  });
  assert.equal(r.completed, -1);
  assert.equal(r.status, "failed");
  assert.equal(m.flags.spycraft2.errorActivationDeclined, undefined);
  assert.equal(m.flags.spycraft2.analysisTaskSettlement.errorDeclinedByGC, false);
});
test("a failed unused task save restores the original pending error; committed saves retain one declined-failure event", async () => {
  for (const committed of [false, true]) {
    const a = reset(),
      t = await create(a),
      m = await roll(a, t.id);
    pendingError(m);
    const update = a.update.bind(a);
    a.update = async p => {
      if (Object.keys(p).some(k => k.startsWith("system.analysisTasks."))) {
        if (committed) await update(p);
        throw Error("save failed");
      }
      return update(p);
    };
    const work = () =>
      a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true, errorActivationDeclinedConfirmed: true });
    if (committed) {
      const r = await work();
      assert.equal(r.events.length, 1);
      assert.equal(m.flags.spycraft2.errorActivationDeclined, true);
    } else {
      await assert.rejects(work, /save failed/);
      assert.equal(a.system.analysisTasks[t.id].events.length, 0);
      assert.equal(m.flags.spycraft2.errorActivationDeclined, undefined);
      assert.equal(m.flags.spycraft2.analysisTaskSettlement, undefined);
    }
  }
});
test("GC keep/undo recovery preserves or removes the recorded decline together with its exact zero-progress event", async () => {
  for (const keep of [true, false]) {
    const a = reset(),
      t = await create(a),
      m = await roll(a, t.id);
    pendingError(m);
    const update = m.update.bind(m);
    m.update = async p => {
      if (p["flags.spycraft2"]?.analysisTaskSettlement?.state === "settled") throw Error("final save failed");
      return update(p);
    };
    const r = await a.settleAnalysisTask(t.id, m, {
      sourceEffectsResolved: true,
      errorActivationDeclinedConfirmed: true
    });
    assert.equal(r.needsReview, true);
    m.update = update;
    await a.reviewAnalysisTaskSettlement({
      keep,
      reason: "Checked the opponents’ decision and unchanged progress",
      confirmed: true
    });
    assert.equal(a.system.analysisTasks[t.id].completed, 0);
    assert.equal(a.system.analysisTasks[t.id].events.length, keep ? 1 : 0);
    assert.equal(m.flags.spycraft2.errorActivationDeclined, keep ? true : undefined);
  }
});
test("a player cannot record the GC’s decline and a non-error confirmation does not invent a declined error", async () => {
  let a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  pendingError(m);
  game.user.isGM = false;
  await assert.rejects(
    a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true, errorActivationDeclinedConfirmed: true }),
    /GC/
  );
  assert.equal(m.flags.spycraft2.errorActivationDeclined, undefined);
  a = reset();
  t = await create(a);
  m = await roll(a, t.id);
  result(m, false);
  await a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true, errorActivationDeclinedConfirmed: true });
  assert.equal(m.flags.spycraft2.errorActivationDeclined, undefined);
  assert.equal(m.flags.spycraft2.analysisTaskSettlement.errorDeclinedByGC, false);
});

test("a chat-finalized ordinary Analysis result can still be recorded in its task once", async () => {
  const a = reset(),
    t = await create(a),
    m = await roll(a, t.id);
  result(m, true);
  await a.finishCheck(m);
  assert.equal(m.flags.spycraft2.resolved, true);
  const r = await settle(a, t, m);
  assert.equal(r.completed, 1);
  await assert.rejects(settle(a, t, m));
});
