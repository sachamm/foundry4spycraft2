import test from "node:test";
import assert from "node:assert/strict";
import { hasStrut, strutGainPlan, strutPool } from "../module/rules/strut.mjs";
import {
  actionDiceFundingContext,
  unrestrictedBonusPoolStatus,
  actionDicePaymentPlan,
  actionDicePaymentRefund
} from "../module/rules/bonus-pools.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const clone = structuredClone;
let sequence = 0,
  periods,
  dialog,
  posts,
  formulas;
const base = () => ({
  level: 9,
  worldTime: 0,
  classLevels: { brawler: 5 },
  classOptionSelections: [{ classId: "brawler", name: "Strut" }],
  activeFeatNames: [],
  conditionContext: {},
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  actionDice: { value: 0, die: 6, explodeAt: 6 },
  bonusActionDice: {},
  actionDieAwards: {},
  xp: 7,
  vitality: { value: 4, max: 12 },
  wounds: { value: 4, max: 14 }
});
const check = () => ({
  actorUuid: "Actor.strut",
  checkKind: "attack",
  weaponProficiency: "blunt",
  attackContext: { ranged: false },
  threatConfirmed: true,
  successConfirmed: true,
  rollCombat: { id: "combat", round: 1, combatantId: "own" },
  rawTotal: 20,
  effectiveTotal: 20
});
const combat = () => ({ id: "combat", started: true, round: 1, turn: 0, combatantId: "own", ownTurnIndex: 0 });
function put(object, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split(".");
    let o = object;
    for (const key of keys.slice(0, -1)) o = o[key] ??= {};
    const key = keys.at(-1);
    if (key.startsWith("-=")) delete o[key.slice(2)];
    else o[key] = clone(value);
  }
}
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.strut";
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.system = base();
    this.items = [];
  }
  async update(patch) {
    put(this, patch);
    return this;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { isGM: true, id: "gc" },
  time: { worldTime: 0 },
  combats: [],
  messages: [],
  settings: { get: (_s, key) => (key === "usagePeriods" ? periods : {}) },
  i18n: { localize: s => s }
};
globalThis.foundry = {
  utils: { randomID: () => `strut${++sequence}`, escapeHTML: String },
  applications: { api: { DialogV2: { input: async options => dialog?.(options) } } }
};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(formula) {
    formulas.push(formula);
    this.total = 3;
    this.dice = [{ total: 3 }];
  }
  async evaluate() {
    return this;
  }
  async toMessage(data) {
    const m = { ...data, id: "post" + posts.length };
    posts.push(m);
    game.messages.push(m);
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function fixture() {
  periods = { scene: "scene", session: "session", mission: "mission" };
  posts = [];
  formulas = [];
  dialog = null;
  game.user.isGM = true;
  const a = new SpycraftActor(),
    own = { id: "own", actor: a };
  game.combat = { id: "combat", started: true, round: 1, turn: 0, turns: [own], combatants: [own], combatant: own };
  game.combats = [game.combat];
  const m = {
    id: "attack",
    uuid: "ChatMessage.attack",
    flags: { spycraft2: check() },
    async update(patch) {
      put(this, patch);
      return this;
    }
  };
  game.messages = [m];
  return { a, m };
}
const input = { nextHalfActionConfirmed: true };
test("RAW p.66 Strut requires the chosen ploy, confirmed unarmed/melee threat or critical hit, recorded combat and next half action", () => {
  const s = base(),
    c = check(),
    args = { actorUuid: "Actor.strut", messageUuid: "ChatMessage.attack", combat: combat(), careerDie: 6, ...input };
  assert.equal(hasStrut(s), true);
  assert.equal(strutGainPlan(s, c, args).units, 1);
  for (const change of [
    s => (s.classOptionSelections = []),
    s => (s.classLevels.brawler = 2),
    s => (s.conditionContext.held = true),
    s => (s.conditionContext.pinned = true),
    s => (s.conditionContext.sleeping = true)
  ]) {
    const b = base();
    change(b);
    assert.throws(() => strutGainPlan(b, c, args));
  }
  for (const patch of [
    { actorUuid: "other" },
    { checkKind: "skill" },
    { threatConfirmed: false },
    { superseded: "other" },
    { criticalFailure: true },
    { attackContext: { ranged: true } },
    { rollCombat: null },
    { rollCombat: { id: "old", round: 1, combatantId: "own" } },
    { strutPoolId: "used" }
  ])
    assert.throws(() => strutGainPlan(s, { ...c, ...patch }, args));
  for (const patch of [{ started: false }, { turn: 1 }, { ownTurnIndex: -1 }, { id: "other" }])
    assert.throws(() => strutGainPlan(s, c, { ...args, combat: { ...combat(), ...patch } }));
  assert.throws(() => strutGainPlan(s, c, { ...args, nextHalfActionConfirmed: false }));
  assert.equal(strutGainPlan(s, { ...c, threatConfirmed: false, criticalSuccess: true }, args).units, 1);
  assert.equal(
    strutGainPlan(s, { ...c, weaponProficiency: "unarmed", attackContext: null, unarmed: true }, args).units,
    1
  );
});
test("Strut freezes career die/Bold once and expires at combat end, preserving scene/mission transitions during the combat", () => {
  for (const careerDie of [4, 6, 8, 10, 12])
    for (const bold of [false, true]) {
      const s = base();
      s.usagePeriods = { scene: "scene", session: "session", mission: "mission" };
      if (bold) s.activeFeatNames = ["Fortune Favors the Bold"];
      const gain = strutGainPlan(s, check(), {
          actorUuid: "Actor.strut",
          messageUuid: "ChatMessage.attack",
          combat: combat(),
          careerDie,
          ...input
        }),
        pool = strutPool(s, gain, { id: "grant", messageUuid: "ChatMessage.attack", combat: combat() });
      s.bonusActionDice.grant = pool;
      s.bonusPoolCombats = { combat: { started: true, round: 2 } };
      assert.equal(pool.die, bold ? (careerDie === 12 ? 6 : careerDie + 2) : careerDie);
      assert.equal(pool.granted, bold && careerDie === 12 ? 2 : 1);
      assert.equal(unrestrictedBonusPoolStatus(s, "grant").available, pool.granted);
      s.usagePeriods.scene = "later";
      s.usagePeriods.mission = "later";
      assert.equal(unrestrictedBonusPoolStatus(s, "grant").available, pool.granted);
      s.bonusPoolCombats.combat.started = false;
      assert.equal(unrestrictedBonusPoolStatus(s, "grant").available, 0);
    }
});
test("actual Strut grants once without ordinary awards/XP and its typed dice pay their own source", async () => {
  const { a, m } = fixture();
  a.system.level = 20;
  a.system.activeFeatNames = ["Fortune Favors the Bold"];
  const pool = await a.useStrut(m, input);
  assert.equal(pool.die, 12);
  assert.equal(pool.remaining, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.xp, 7);
  assert.deepEqual(a.system.actionDieAwards, {});
  assert.equal(m.flags.spycraft2.strutPoolId, pool.id);
  await assert.rejects(a.useStrut(m, input), /already supplied/);
  await a.rollActionDie({ bonusPoolId: pool.id });
  assert.match(formulas[0], /1d12/);
  assert.equal(a.system.bonusActionDice[pool.id].remaining, 0);
  game.combat.started = false;
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: pool.id, periods }).blocked, true);
});
test("grant and source-receipt errors after commitment retain one Strut grant", async () => {
  for (const boundary of ["grant", "receipt"]) {
    const { a, m } = fixture(),
      update = a.update.bind(a),
      post = m.update.bind(m);
    let fired = false;
    a.update = async patch => {
      await update(patch);
      if (boundary === "grant" && Object.values(patch).some(v => v?.source === "strut") && !fired) {
        fired = true;
        throw Error("grant committed");
      }
    };
    m.update = async patch => {
      await post(patch);
      if (boundary === "receipt") throw Error("receipt committed");
    };
    const pool = await a.useStrut(m, input);
    assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
    assert.equal(m.flags.spycraft2.strutPoolId, pool.id);
  }
});
test("rejected receipts remove only their Strut pool; committed cleanup errors do not hold a false review", async () => {
  for (const after of [false, true]) {
    const { a, m } = fixture(),
      update = a.update.bind(a);
    a.system.bonusActionDice.other = { marker: "preserve" };
    m.update = async () => {
      throw Error("receipt rejected");
    };
    a.update = async patch => {
      await update(patch);
      if (after && Object.keys(patch).some(k => k.startsWith("system.bonusActionDice.-=")))
        throw Error("cleanup committed");
    };
    await assert.rejects(a.useStrut(m, input), /receipt rejected/);
    assert.deepEqual(a.system.bonusActionDice, { other: { marker: "preserve" } });
    assert.equal(a.flags.spycraft2?.actionDiceSettlementReview, undefined);
  }
});
test("unconfirmed Strut cleanup retains one blocked grant and its GC review rather than allowing another grant", async () => {
  const { a, m } = fixture(),
    update = a.update.bind(a);
  m.update = async () => {
    throw Error("receipt rejected");
  };
  a.update = async patch => {
    if (Object.keys(patch).some(k => k.startsWith("system.bonusActionDice.-="))) throw Error("cleanup rejected");
    return update(patch);
  };
  await assert.rejects(a.useStrut(m, input), /GC review/);
  const pool = Object.values(a.system.bonusActionDice)[0];
  assert.equal(pool.needsReview, true);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: pool.id, periods }).blocked, true);
  await assert.rejects(a.useStrut(m, input));
  assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
});
test("Strut rejects changed attack/source/initiative after its dialog and concurrent claims cannot double grant", async () => {
  for (const change of [
    (a, m) => m.flags.spycraft2.effectiveTotal++,
    (a, m) => (m.flags.spycraft2.rollCombat.id = "other"),
    a => (a.system.classOptionSelections = []),
    () => (game.combat.turn = 1)
  ]) {
    const { a, m } = fixture();
    dialog = async () => {
      change(a, m);
      return input;
    };
    await assert.rejects(a.useStrut(m));
    assert.equal(Object.keys(a.system.bonusActionDice).length, 0);
  }
  const { a, m } = fixture();
  const results = await Promise.allSettled([a.useStrut(m, input), a.useStrut(m, input)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
});
test("Strut pool validation and refund fingerprints preserve the original combat and attack binding", () => {
  const { a, m } = fixture(),
    gain = strutGainPlan(a.system, m.flags.spycraft2, {
      actorUuid: a.uuid,
      messageUuid: m.uuid,
      combat: combat(),
      careerDie: 6,
      ...input
    }),
    pool = strutPool(a.system, gain, { id: "grant", messageUuid: m.uuid, combat: combat(), periods });
  a.system.bonusActionDice.grant = pool;
  const source = a.actionDiceFundingSystem,
    payment = actionDicePaymentPlan(source, { count: 1, bonusPoolId: "grant", periods });
  assert.equal(payment.blocked, false);
  a.system.bonusActionDice.grant.remaining = 0;
  a.system.bonusActionDice.grant.combatId = "other";
  assert.throws(() => actionDicePaymentRefund(a.actionDiceFundingSystem, payment), /changed/);
  for (const patch of [
    { bold: undefined },
    { baseCount: 2 },
    { granted: 3 },
    { nextHalfActionConfirmed: false },
    { messageUuid: "" }
  ]) {
    a.system.bonusActionDice.grant = { ...pool, ...patch };
    assert.equal(unrestrictedBonusPoolStatus(a.actionDiceFundingSystem, "grant", { periods }).available, 0);
  }
});

test("secret Strut results require the GC and malformed combat clocks cannot keep a grant spendable", async () => {
  const { a, m } = fixture();
  m.blind = true;
  game.user.isGM = false;
  await assert.rejects(a.useStrut(m, input), /GC resolves secret/);
  game.user.isGM = true;
  const pool = await a.useStrut(m, input);
  for (const clock of [{ started: true }, { started: "true", round: 2 }, { started: true, round: 0 }]) {
    const system = { ...a.system, worldTime: 0, bonusPoolCombats: { combat: clock } };
    assert.equal(unrestrictedBonusPoolStatus(system, pool.id, { periods }).available, 0);
  }
});
