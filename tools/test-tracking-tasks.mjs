import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { analysisTaskValid } from "../module/rules/analysis-tasks.mjs";

import {
  analysisChallengeCount,
  forensicGeniusPlan,
  validateTrackingTaskProof
} from "../module/rules/forensic-genius.mjs";

import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
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
const create = (a, patch = {}) =>
    a.createAnalysisTask({
      title: "Forensics examination",
      baseChallenges: 6,
      unpressuredConfirmed: true,
      forensicsOnlyConfirmed: true,
      ...patch
    }),
  roll = (a, t, check = "forensics") =>
    a.rollSkill("analysis", null, { check, analysisTaskId: t.id, gearStatus: "available" }),
  source = (a, names = ["Tracking Mastery"]) => {
    a.system.activeFeatNames = names;
    return a;
  };
test("all source combinations and counts2–100 apply the two unnamed reductions once with the minimum only after combining them", () => {
  for (const genius of [false, true])
    for (const tracking of [false, true])
      for (const forensics of [false, true])
        for (let base = 2; base <= 100; base++) {
          const s = {
              activeFeatNames: [...(genius ? ["Forensic Genius"] : []), ...(tracking ? ["Tracking Mastery"] : [])]
            },
            p = analysisChallengeCount(s, base, { forensics }),
            reduction = (genius ? 2 : 0) + (tracking && forensics ? 1 : 0);
          assert.equal(p.required, Math.max(1, base - reduction));
          assert.equal(p.reduction, reduction);
          assert.equal(p.trackingMastery, tracking && forensics);
        }
  for (const base of [null, "", 0, 1, -1, 1.5, NaN, Infinity, true, {}, "oops"])
    assert.throws(() => analysisChallengeCount({}, base));
});
test("only Analysis/Forensics receives Tracking Mastery and every other named use retains its ordinary count and synergy", () => {
  for (const skill of Object.values(cfg.skills))
    for (const check of skill.checks) {
      const p = forensicGeniusPlan({ activeFeatNames: ["Tracking Mastery"] }, skill.key, check, {
        complexAnalysisTask: true,
        analysisBaseChallenges: 6
      });
      assert.equal(!!p.trackingEvidence, skill.key === "analysis" && check.id === "forensics");
      if (p.trackingEvidence) assert.equal(p.trackingEvidence.challenges.required, 5);
      assert.equal(p.evidence, null);
      assert.deepEqual(p.synergies, []);
    }
  const s = state();
  s.activeFeatNames = ["Forensic Genius", "Tracking Mastery"];
  const p = forensicGeniusPlan(
    s,
    "analysis",
    { id: "forensics" },
    { complexAnalysisTask: true, analysisBaseChallenges: 6 }
  );
  assert.equal(p.evidence.challenges.required, 3);
  assert.equal(p.trackingEvidence.challenges.required, 3);
  assert.equal(p.evidence.challenges.reduction, 2);
  assert.equal(p.trackingEvidence.challenges.reduction, 1);
});
test("recorded Forensics task creation freezes both sources and its scope while generic and legacy tasks remain unchanged", async () => {
  for (const names of [[], ["Tracking Mastery"], ["Forensic Genius"], ["Tracking Mastery", "Forensic Genius"]]) {
    const a = source(actor(), names),
      t = await create(a),
      reduction = (names.includes("Tracking Mastery") ? 1 : 0) + (names.includes("Forensic Genius") ? 2 : 0);
    assert.equal(t.requiredChallenges, 6 - reduction);
    assert.equal(t.forensicsOnly, true);
    assert.equal(t.trackingMastery, names.includes("Tracking Mastery"));
    assert.equal(analysisTaskValid(t), true);
    const ordinary = await create(a, { forensicsOnlyConfirmed: false });
    assert.equal(ordinary.requiredChallenges, names.includes("Forensic Genius") ? 4 : 6);
    assert.equal(Object.hasOwn(ordinary, "trackingMastery"), false);
    assert.equal(Object.hasOwn(ordinary, "forensicsOnly"), false);
  }
  await assert.rejects(create(source(actor()), { forensicsOnlyConfirmed: "true" }));
});
test("actual bound receipts accept only Forensics Challenges and carry the exact combined count and source evidence", async () => {
  const a = source(actor(), ["Forensic Genius", "Tracking Mastery"]),
    t = await create(a);
  for (const check of cfg.skills.analysis.checks)
    if (check.id !== "forensics") {
      await roll(a, t, check.id);
      assert.equal(posts.length, 0);
    }
  const m = await roll(a, t);
  assert.equal(m.flags.spycraft2.analysisTask.requiredChallenges, 3);
  assert.equal(m.flags.spycraft2.analysisTask.forensicsOnly, true);
  assert.equal(m.flags.spycraft2.analysisTask.trackingMastery, true);
  assert.equal(m.flags.spycraft2.trackingMasteryTask.challenges.required, 3);
  assert.equal(m.flags.spycraft2.forensicGenius.challenges.required, 3);
  await a.confirmCheckOutcome(m, { succeeded: true });
  await a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true });
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  assert.equal(analysisTaskValid(a.system.analysisTasks[t.id]), true);
});
test("unrecorded actual Forensics checks freeze one-only or combined reductions without spending resources or changing other Analysis uses", async () => {
  for (const names of [["Tracking Mastery"], ["Forensic Genius", "Tracking Mastery"]]) {
    const a = source(actor(), names),
      opts = { check: "forensics", complexAnalysisTask: true, analysisBaseChallenges: 6, gearStatus: "available" },
      m = await a.rollSkill("analysis", null, opts);
    assert.equal(m.flags.spycraft2.trackingMasteryTask.challenges.required, names.length === 2 ? 3 : 5);
    assert.equal(a.system.actionDice.value, 0);
    assert.deepEqual(a.system.resourceUses, {});
    const n = await a.rollSkill("analysis", null, { ...opts, check: "appraise" });
    assert.equal(n.flags.spycraft2.trackingMasteryTask, null);
    assert.equal(n.flags.spycraft2.forensicGenius?.challenges.required ?? 6, names.length === 2 ? 4 : 6);
  }
});
test("an ordinary mixed-use task never receives a Forensics-only reduction merely because its current check uses Forensics", async () => {
  const a = source(actor(), ["Forensic Genius", "Tracking Mastery"]),
    t = await create(a, { forensicsOnlyConfirmed: false }),
    m = await roll(a, t);
  assert.equal(t.requiredChallenges, 4);
  assert.equal(m.flags.spycraft2.analysisTask.requiredChallenges, 4);
  assert.equal(m.flags.spycraft2.forensicGenius.challenges.required, 4);
  assert.equal(m.flags.spycraft2.trackingMasteryTask, null);
});
test("source loss, newly gained source, malformed scope/history and mutated declarations cannot silently change task counts", async () => {
  for (const names of [[], ["Tracking Mastery"]]) {
    const a = source(actor(), names),
      t = await create(a);
    a.system.activeFeatNames = names.length ? [] : ["Tracking Mastery"];
    await roll(a, t);
    assert.equal(posts.length, 0);
  }
  for (const phase of ["source", "count"]) {
    const a = source(actor()),
      input = { check: "forensics", complexAnalysisTask: true, analysisBaseChallenges: 6, gearStatus: "available" };
    hook = () => {
      if (phase === "source") a.system.activeFeatNames = [];
      else input.analysisBaseChallenges = 7;
    };
    await assert.rejects(a.rollSkill("analysis", null, input), /source|changed/);
    assert.equal(posts.length, 0);
  }
  const a = source(actor()),
    t = await create(a);
  for (const patch of [
    { forensicsOnly: "true" },
    { trackingMastery: "true" },
    { forensicsOnly: false },
    { requiredChallenges: 6 }
  ])
    assert.equal(analysisTaskValid({ ...t, ...patch }), false);
});
test("new Tracking task evidence is immutable, validates direct/replacement checks, and retains legacy receipts without it", async () => {
  const a = source(actor()),
    m = await a.rollSkill("analysis", null, {
      check: "forensics",
      complexAnalysisTask: true,
      analysisBaseChallenges: 6,
      gearStatus: "available"
    }),
    c = m.flags.spycraft2,
    e = rollEvidence(c);
  for (const key of ["forensicGenius", "checkId", "challenges"]) {
    const changed = structuredClone(c);
    changed.trackingMasteryTask[key] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false);
  }
  validateTrackingTaskProof(a.system, c.trackingMasteryTask, c);
  a.system.activeFeatNames = [];
  assert.throws(() => validateTrackingTaskProof(a.system, c.trackingMasteryTask, c), /source|changed/);
  validateTrackingTaskProof(a.system, null, c);
  const legacy = { checkKind: "skill", rawTotal: 12 };
  assert.equal(rollEvidenceMatches(rollEvidence(legacy), legacy), true);
});
test("pressured and timed Forensics tasks retain their scope through Resolve clearance and reject the wrong Challenge use", async () => {
  const a = source(actor(), ["Forensic Genius", "Tracking Mastery"]),
    t = await create(a, { unpressuredConfirmed: false, pressuredConfirmed: true, timeLimitSeconds: 60 }),
    m = await a.rollSkill("resolve", "con", {
      check: "task-pressure",
      analysisTaskId: t.id,
      taskChallengeDC: 5,
      taskChallengeDCConfirmed: true
    });
  assert.equal(m.flags.spycraft2.analysisTask.trackingMastery, true);
  await a.confirmCheckOutcome(m, { succeeded: true });
  await a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true });
  assert.equal(a.system.analysisTasks[t.id].completed, 0);
  const n = posts.length;
  await roll(a, t, "appraise");
  assert.equal(posts.length, n);
  const c = await roll(a, t);
  assert.equal(c.flags.spycraft2.analysisTask.forensicsOnly, true);
  assert.equal(c.flags.spycraft2.trackingMasteryTask.challenges.required, 3);
  await a.confirmCheckOutcome(c, { succeeded: true });
  await a.settleAnalysisTask(t.id, c, { sourceEffectsResolved: true });
  assert.equal(analysisTaskValid(a.system.analysisTasks[t.id]), true);
});
test("Forensics task finalization failure retains exact scope/count in GC recovery and does not advance twice", async () => {
  const a = source(actor(), ["Forensic Genius", "Tracking Mastery"]),
    t = await create(a),
    m = await roll(a, t);
  await a.confirmCheckOutcome(m, { succeeded: true });
  const update = m.update.bind(m);
  m.update = async p => {
    if (p["flags.spycraft2"]?.analysisTaskSettlement?.state === "settled")
      throw Error("Final Forensics receipt failed");
    return update(p);
  };
  assert.equal((await a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true })).needsReview, true);
  m.update = update;
  await a.reviewAnalysisTaskSettlement({
    keep: true,
    reason: "Keep the recorded one of three Forensics Challenges",
    confirmed: true
  });
  assert.equal(a.system.analysisTasks[t.id].requiredChallenges, 3);
  assert.equal(a.system.analysisTasks[t.id].completed, 1);
  assert.equal(a.system.analysisTasks[t.id].trackingMastery, true);
  await assert.rejects(a.settleAnalysisTask(t.id, m, { sourceEffectsResolved: true }));
});

test("an actual permitted replacement roll retains Forensics count proof and refunds its unused reroll allowance after source loss", async () => {
  const a = source(actor()),
    m = await a.rollSkill("analysis", null, {
      check: "forensics",
      complexAnalysisTask: true,
      analysisBaseChallenges: 6,
      gearStatus: "available"
    });
  await a.confirmCheckOutcome(m, { succeeded: false });
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
  a.system.activeFeatNames = [];
  await assert.rejects(a.rerollCheck(m, { resource: "perfect", failed: true }), /Tracking Mastery|source|changed/);
  assert.equal(a.system.resourceUses.perfect, undefined);
  assert.equal(posts.length, 1);
  a.system.activeFeatNames = ["Tracking Mastery"];
  const replacement = await a.rerollCheck(m, { resource: "perfect", failed: true });
  assert.deepEqual(replacement.flags.spycraft2.trackingMasteryTask, m.flags.spycraft2.trackingMasteryTask);
  assert.equal(a.system.resourceUses.perfect.used, 1);
  assert.equal(posts.length, 2);
});

test("actual surprise receipts keep Tracking source evidence and reject feat, insight-source or declaration drift during RNG", async () => {
  for (const phase of ["source", "insight", "context"]) {
    const a = source(actor(), ["Tracking Basics", "Tracking Mastery"]),
      input = { check: "awareness", surprise: true, followingPhysicalTrail: true, gearStatus: "available" };
    hook = () => {
      if (phase === "source") a.system.activeFeatNames = [];
      if (phase === "insight") a.system.activeFeatNames.push("Unfair Advantage");
      if (phase === "context") input.followingPhysicalTrail = false;
    };
    await assert.rejects(a.rollSkill("notice", null, input), /Tracking|source|changed/);
    assert.equal(posts.length, 0);
  }
  const a = source(actor(), ["Tracking Basics", "Tracking Mastery"]),
    m = await a.rollSkill("notice", null, {
      check: "awareness",
      surprise: true,
      followingPhysicalTrail: true,
      gearStatus: "available"
    });
  assert.equal(m.flags.spycraft2.rollData.total, 12);
  assert.equal(m.flags.spycraft2.tracking.bonuses[0].value, 5);
  assert.equal(m.flags.spycraft2.trackingFeat.mastery, true);
  const e = rollEvidence(m.flags.spycraft2),
    changed = structuredClone(m.flags.spycraft2);
  changed.trackingFeat.context.followingPhysicalTrail = false;
  assert.equal(rollEvidenceMatches(e, changed), false);
});
test("actual take20 Tracking uses the exception with no errors or dice boosts and refuses source loss before posting", async () => {
  const a = source(actor(), ["Tracking Basics", "Tracking Mastery"]),
    input = { check: "tracking", method: "take20", safeToTake: true, trackingSurface: "hard", gearStatus: "available" },
    m = await a.rollSkill("survival", null, input);
  assert.equal(m.flags.spycraft2.error, 0);
  assert.equal(m.flags.spycraft2.threat, 0);
  assert.equal(m.flags.spycraft2.tracking.errorIncrease, 3);
  assert.equal(m.flags.spycraft2.trackingFeat.mastery, true);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  const b = source(actor(), ["Tracking Basics", "Tracking Mastery"]);
  hook = () => {
    b.system.activeFeatNames = ["Tracking Basics"];
  };
  await assert.rejects(b.rollSkill("survival", null, input), /Tracking|source|changed/);
  assert.equal(posts.length, 0);
});

test("printed minimum two applies before reductions, retains the reduced minimum one and leaves tasks above ten legal", async () => {
  for (const names of [[], ["Forensic Genius"], ["Tracking Mastery"], ["Forensic Genius", "Tracking Mastery"]]) {
    const a = source(actor(), names);
    await assert.rejects(create(a, { baseChallenges: 1 }), /at least 2/);
    assert.equal(Object.keys(a.system.analysisTasks ?? {}).length, 0);
    const t = await create(a, { baseChallenges: 2 }),
      expected = names.length ? 1 : 2;
    assert.equal(t.requiredChallenges, expected);
    assert.equal(analysisTaskValid(t), true);
    const larger = await create(a, { baseChallenges: 100 });
    assert.equal(larger.baseChallenges, 100);
    assert.equal(analysisTaskValid(larger), true);
    const legacy = { ...t, id: "task_legacy", baseChallenges: 1, requiredChallenges: 1 };
    assert.equal(analysisTaskValid(legacy), false);
    a.system.analysisTasks[legacy.id] = legacy;
    const n = posts.length;
    await roll(a, legacy);
    assert.equal(posts.length, n);
    assert.equal(a.system.actionDice.value, 0);
  }
});
