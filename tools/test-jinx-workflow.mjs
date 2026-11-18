import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";

import { getActionDieSettlementReview } from "../module/rules/action-die-payments.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
let serial = 0,
  posts = [],
  actors = [],
  natural = 7,
  stressDie = 4,
  evaluations = { d20: 0, stress: 0 },
  failPost = "",
  hook = null,
  periods = { scene: "s", session: "t", mission: "m" };
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
  activeFeatNames: ["Black Cat", "Jinx"],
  activeFeatSelections: [
    { name: "Black Cat", tree: "chance" },
    { name: "Jinx", tree: "chance" }
  ],
  vitality: { value: 4, max: 8 },
  wounds: { value: 4, max: 14 },
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
  settings: { get: () => periods },
  time: { worldTime: 0 },
  i18n: { localize: String, format: String },
  messages: {
    values: () => posts.values(),
    get: id => posts.find(m => m.id === id),
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
  periods = { scene: "s", session: "t", mission: "m" };
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
const options = payer => ({
  kind: "failure",
  payer,
  baseCost: 1,
  effect: "GC-confirmed failure effect",
  effectConfirmed: true,
  opponent: true,
  lineOfSight: true,
  jinx: true
});
async function fixture() {
  const a = actor(),
    b = new SpycraftActor();
  actors.push(b);
  b.system.limitedUses = limitedUseAbilities(b.system, [], cfg);
  natural = 1;
  const m = await a.rollCheck(
    "1d20 + @total",
    { total: 7 },
    { checkKind: "skill", skillKey: "mechanics", checkId: "repair", ability: "int" }
  );
  await a.confirmCheckOutcome(m, { succeeded: false });
  assert.equal(m.flags.spycraft2.errorConfirmed, true);
  return { a, b, m };
}
test("actual critical activation consumes exactly one payer session use and waives a one-die cost with an empty pool", async () => {
  const { a, b, m } = await fixture();
  await a.activateCritical(m, options(b));
  const c = m.flags.spycraft2;
  assert.equal(c.criticalFailure, true);
  assert.equal(c.criticalActivation.cost, 0);
  assert.equal(c.criticalActivation.jinx.costBefore, 1);
  assert.equal(c.criticalActivation.jinx.costAfter, 0);
  assert.equal(c.criticalActivation.jinx.payerUuid, b.uuid);
  assert.equal(c.criticalActivation.jinx.use.used, 1);
  assert.equal(b.system.resourceUses.jinx.used, 1);
  assert.equal(a.system.resourceUses.jinx, undefined);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(b.system.actionDice.value, 0);
});
test("actual paid activation discounts only the payer cost and leaves the original table cost and target dice unchanged", async () => {
  const { a, b, m } = await fixture();
  b.system.actionDice.value = 3;
  await a.activateCritical(m, { ...options(b), baseCost: 2 });
  assert.equal(m.flags.spycraft2.criticalActivation.baseCost, 2);
  assert.equal(m.flags.spycraft2.criticalActivation.cost, 1);
  assert.equal(b.system.actionDice.value, 2);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(b.system.resourceUses.jinx.used, 1);
});
test("Shaken II and III pay their ordinary unrolled fee after the base becomes zero; forbidden or unaffordable uses do not consume Jinx", async () => {
  for (const grade of [2, 3]) {
    const { a, b, m } = await fixture();
    b.system.conditionContext = { shakenGrade: grade };
    b.system.actionDice.value = grade - 1;
    const before = evaluations.d20;
    await a.activateCritical(m, options(b));
    assert.equal(m.flags.spycraft2.criticalActivation.adjustedBaseCost, 0);
    assert.equal(m.flags.spycraft2.criticalActivation.surcharge, grade - 1);
    assert.equal(m.flags.spycraft2.criticalActivation.cost, grade - 1);
    assert.equal(b.system.actionDice.value, 0);
    assert.equal(b.system.resourceUses.jinx.used, 1);
    assert.equal(evaluations.d20, before);
  }
  for (const grade of [2, 4]) {
    const { a, b, m } = await fixture();
    b.system.conditionContext = { shakenGrade: grade };
    b.system.actionDice.value = grade === 4 ? 5 : 0;
    await a.activateCritical(m, options(b));
    assert.equal(!!m.flags.spycraft2.criticalFailure, false);
    assert.equal(b.system.resourceUses.jinx, undefined);
    assert.equal(b.system.actionDice.value, grade === 4 ? 5 : 0);
  }
});
test("concurrent errors share the same Chance session allowance and reacquisition does not refresh it", async () => {
  const { a, b, m } = await fixture(),
    messages = [m];
  for (let i = 0; i < 2; i++) {
    const c = await a.rollCheck(
      "1d20 + @total",
      { total: 7 },
      { checkKind: "skill", skillKey: "mechanics", checkId: "repair", ability: "int" }
    );
    await a.confirmCheckOutcome(c, { succeeded: false });
    messages.push(c);
  }
  await Promise.allSettled(messages.map(c => a.activateCritical(c, options(b))));
  assert.equal(messages.filter(m => m.flags.spycraft2.criticalFailure).length, 2);
  assert.equal(b.system.resourceUses.jinx.used, 2);
  b.system.activeFeatNames = [];
  b.system.activeFeatNames = ["Black Cat", "Jinx"];
  await assert.rejects(a.activateCritical(messages[2], options(b)), /uses|used|remain|limit/i);
  assert.equal(b.system.resourceUses.jinx.used, 2);
});
test("failed activation saves refund the session use, while committed-then-rejected saves retain the real activation exactly once", async () => {
  for (const committed of [false, true]) {
    const { a, b, m } = await fixture(),
      update = m.update.bind(m);
    m.update = async p => {
      if (committed) await update(p);
      throw Error("Critical save failed");
    };
    if (committed) {
      await a.activateCritical(m, options(b));
      assert.equal(m.flags.spycraft2.criticalFailure, true);
      assert.equal(b.system.resourceUses.jinx.used, 1);
    } else {
      await assert.rejects(a.activateCritical(m, options(b)), /Critical save failed/);
      assert.equal(b.system.resourceUses.jinx, undefined);
      m.update = update;
      await a.activateCritical(m, options(b));
      assert.equal(b.system.resourceUses.jinx.used, 1);
    }
    await a.activateCritical(m, options(b));
    assert.equal(b.system.resourceUses.jinx.used, 1);
  }
});
test("source, session, Chance allowance and target cost drift while reserving Jinx prevent activation and restore the unused counter", async () => {
  for (const phase of ["source", "session", "chance", "target"]) {
    const { a, b, m } = await fixture(),
      update = b.update.bind(b);
    let once = false;
    b.update = async p => {
      const result = await update(p);
      if (p["system.resourceUses.jinx"] && !once) {
        once = true;
        if (phase === "source") b.system.activeFeatNames = [];
        if (phase === "session") periods.session = "next";
        if (phase === "chance") b.system.activeFeatSelections.push({ tree: "chance" });
        if (phase === "target") a.system.coreClassIds = ["wheelman"];
      }
      return result;
    };
    await assert.rejects(a.activateCritical(m, options(b)), /Jinx|cost|source|changed/);
    assert.equal(!!m.flags.spycraft2.criticalFailure, false);
    assert.equal(b.system.resourceUses.jinx, undefined);
  }
});
test("a failed fee refund retains Jinx in the same multipart GC review and actual cancellation review restores both fee and unused allowance", async () => {
  const { a, b, m } = await fixture();
  b.system.conditionContext = { shakenGrade: 2 };
  b.system.actionDice.value = 1;
  const update = b.update.bind(b),
    messageUpdate = m.update.bind(m);
  m.update = async () => {
    throw Error("Critical activation rejected");
  };
  b.update = async p => {
    if (p["system.actionDice.value"] === 1 && b.system.actionDice.value === 0) throw Error("Fee refund failed");
    return update(p);
  };
  await assert.rejects(a.activateCritical(m, options(b)));
  let review = getActionDieSettlementReview(b);
  assert.equal(review.needsReview, true);
  assert.equal(review.limitedUseSettlement[0].id, "jinx");
  assert.equal(b.system.resourceUses.jinx.used, 1);
  assert.equal(b.system.actionDice.value, 0);
  b.update = update;
  m.update = messageUpdate;
  await b.reviewActionDiceSettlement({
    balances: [1],
    benefitRemains: false,
    restoreLimitedUses: true,
    resolution: "Confirmed no critical effect or replacement remained; restore fee and reserved Jinx",
    healthReviewed: true
  });
  assert.equal(b.system.actionDice.value, 1);
  assert.equal(b.system.resourceUses.jinx, undefined);
  assert.equal(getActionDieSettlementReview(b).needsReview, false);
  await a.activateCritical(m, options(b));
  assert.equal(m.flags.spycraft2.criticalFailure, true);
  assert.equal(b.system.actionDice.value, 0);
  assert.equal(b.system.resourceUses.jinx.used, 1);
});
test("Jinx accepts a declared split payer payment and freezes its source proof in outcome evidence", async () => {
  const { a, b, m } = await fixture();
  b.system.conditionContext = { shakenGrade: 2 };
  b.system.actionDice.value = 2;
  await a.activateCritical(m, { ...options(b), baseCost: 2, paymentAllocations: [{ bonusPoolId: "", count: 2 }] });
  assert.equal(m.flags.spycraft2.criticalActivation.cost, 2);
  assert.equal(b.system.actionDice.value, 0);
  const evidence = rollEvidence(m.flags.spycraft2),
    changed = structuredClone(m.flags.spycraft2);
  changed.criticalActivation.jinx.costBefore = 9;
  assert.equal(rollEvidenceMatches(evidence, changed), false);
});
test("the actual critical dialog exposes an explicit payer-owned Jinx choice and cancellation spends nothing", async () => {
  const { a, b, m } = await fixture();
  let content;
  const input = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async o => {
    content = o.content;
    return null;
  };
  try {
    assert.equal(await a.activateCritical(m), null);
    assert.match(content, /name="jinx"/);
    assert.match(content, /paying opponent/);
    assert.equal(b.system.resourceUses.jinx, undefined);
  } finally {
    foundry.applications.api.DialogV2.input = input;
  }
});
