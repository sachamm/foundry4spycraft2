import test from "node:test";
import assert from "node:assert/strict";
import {
  adrenalineSource,
  woundEventKey,
  recordedWoundEvent,
  adrenalineWoundPlan
} from "../module/rules/adrenaline.mjs";
import { resourceStatus, limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { actionDiceFundingContext, unrestrictedBonusPoolStatus } from "../module/rules/bonus-pools.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
let periods,
  posts,
  postFailure,
  dialog,
  sequence = 0,
  warnings;
const base = () => ({
  level: 12,
  worldTime: 0,
  classLevels: { stuntman: 8 },
  coreClassIds: ["stuntman"],
  activeFeatNames: [],
  conditionContext: {},
  actionDice: { value: 0, max: 5, die: 8, explodeAt: 8 },
  resourceUses: {},
  bonusActionDice: {},
  xp: 10,
  actionDieAwards: { mission: { count: 2 } },
  vitality: { value: 4, max: 20 },
  wounds: { value: 12, max: 14 }
});
const input = (eventRef = "attack-1", loss = 1, cause = "attack", opponentAttack = true) => ({
  eventRef,
  loss,
  cause,
  opponentAttack,
  confirmed: true
});
function plan(s, i = input()) {
  return adrenalineWoundPlan(s, i, {
    actorUuid: "Actor.adrenaline",
    id: "grant",
    careerDie: 8,
    periods,
    status: resourceStatus(adrenalineSource(s), s.resourceUses, periods)
  });
}
function patch(object, data) {
  for (const [path, value] of Object.entries(data)) {
    const keys = path.split(".");
    let o = object;
    for (const key of keys.slice(0, -1)) o = o[key] ??= {};
    const key = keys.at(-1);
    if (key.startsWith("-=")) delete o[key.slice(2)];
    else o[key] = structuredClone(value);
  }
}
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.adrenaline";
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.system = base();
    this.items = [];
  }
  async update(data) {
    patch(this, data);
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
  i18n: { localize: String }
};
globalThis.foundry = {
  utils: { randomID: () => `adrenaline${++sequence}`, escapeHTML: s => String(s).replaceAll("<", "&lt;") },
  applications: { api: { DialogV2: { input: async opts => dialog?.(opts) } } }
};
globalThis.ui = { notifications: { warn: s => warnings.push(s) } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (postFailure === "before") throw Error("post rejected");
    const m = { ...data, id: "receipt" + posts.length };
    posts.push(m);
    game.messages.push(m);
    if (postFailure === "after") throw Error("post committed");
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function fixture() {
  periods = { session: "session", scene: "scene", mission: "mission" };
  posts = [];
  game.messages = [];
  postFailure = null;
  dialog = null;
  warnings = [];
  game.user.isGM = true;
  return new SpycraftActor();
}
test("RAW p.81 Adrenaline requires the Stuntman core, grants once per eligible event rather than wound point, and uses starting dice as its session limit", () => {
  fixture();
  const s = base();
  assert.equal(adrenalineSource({ ...s, coreClassIds: [] }), null);
  assert.equal(adrenalineSource({ ...s, classLevels: {} }), null);
  assert.equal(adrenalineSource(s).limit, 5);
  assert.equal(limitedUseAbilities(s, [], cfg).find(x => x.id === "adrenalineJunkie").workflow, "adrenalineJunkie");
  for (const loss of [1, 2, 8]) {
    const p = plan(s, input("event", loss));
    assert.equal(p.record.afterWounds, 12 - loss);
    assert.equal(p.pool.granted, 1);
    assert.equal(p.counter.used, 1);
  }
  for (const [cause, opponent, granted] of [
    ["attack", true, true],
    ["attack", false, false],
    ["fall", false, true],
    ["explosion", false, true],
    ["other", true, false]
  ])
    assert.equal(plan(s, input("event", 1, cause, opponent)).record.granted, granted);
  s.resourceUses.adrenalineJunkie = { epoch: "session", used: 5 };
  const capped = plan(s);
  assert.equal(capped.record.afterWounds, 11);
  assert.equal(capped.pool, null);
  assert.equal(capped.counter, null);
  assert.equal(capped.record.usedAfter, 5);
});
test("actual recording atomically applies final wound loss, one typed grant/counter and no ordinary awards, XP, vitality or GC changes", async () => {
  const a = fixture(),
    record = await a.recordAdrenalineWoundLoss(input("ChatMessage.damage1", 3));
  assert.equal(a.system.wounds.value, 9);
  assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
  assert.equal(a.system.bonusActionDice[record.poolId].die, 8);
  assert.equal(a.system.bonusActionDice[record.poolId].remaining, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.xp, 10);
  assert.equal(a.system.actionDieAwards.mission.count, 2);
  assert.equal(a.flags.spycraft2.woundEvents[woundEventKey("ChatMessage.damage1")].loss, 3);
  assert.equal(posts.length, 1);
});
test("repeated and concurrent event submissions cannot repeat wound loss or the grant, including after a session change", async () => {
  const a = fixture();
  const records = await Promise.all([a.recordAdrenalineWoundLoss(input()), a.recordAdrenalineWoundLoss(input())]);
  assert.deepEqual(records[0], records[1]);
  assert.equal(a.system.wounds.value, 11);
  assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
  assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
  assert.equal(posts.length, 1);
  periods.session = "later";
  await a.recordAdrenalineWoundLoss(input());
  assert.equal(a.system.wounds.value, 11);
  await assert.rejects(a.recordAdrenalineWoundLoss(input("attack-1", 2)), /different wound loss/);
});
test("default career grants improve once with Bold, remain independent of ordinary dice, and expire by scene or session", async () => {
  const a = fixture();
  a.system.level = 20;
  a.system.activeFeatNames = ["Fortune Favors the Bold"];
  const record = await a.recordAdrenalineWoundLoss(input()),
    pool = a.system.bonusActionDice[record.poolId];
  assert.equal(pool.baseDie, 10);
  assert.equal(pool.die, 12);
  assert.equal(pool.granted, 1);
  assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
  assert.equal(unrestrictedBonusPoolStatus({ ...a.system, worldTime: 0 }, pool.id, { periods }).available, 1);
  periods.scene = "later";
  assert.equal(unrestrictedBonusPoolStatus({ ...a.system, worldTime: 0 }, pool.id, { periods }).available, 0);
  periods.scene = "scene";
  periods.session = "later";
  assert.equal(
    actionDiceFundingContext({ ...a.system, worldTime: 0 }, { bonusPoolId: pool.id, periods }).blocked,
    true
  );
});
test("before-commit errors apply nothing; committed actor errors retain exactly one wound event and grant", async () => {
  for (const after of [false, true]) {
    const a = fixture(),
      update = a.update.bind(a);
    a.update = async data => {
      if (after) await update(data);
      throw Error(after ? "write committed" : "write rejected");
    };
    if (after) {
      await a.recordAdrenalineWoundLoss(input());
      assert.equal(a.system.wounds.value, 11);
      assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
      assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
    } else {
      await assert.rejects(a.recordAdrenalineWoundLoss(input()), /write rejected/);
      assert.equal(a.system.wounds.value, 12);
      assert.equal(a.flags.spycraft2, undefined);
      assert.equal(Object.keys(a.system.bonusActionDice).length, 0);
    }
  }
});
test("optional chat receipt failures retain actual wounds and one grant and cannot duplicate the event", async () => {
  for (const boundary of ["before", "after"]) {
    const a = fixture();
    postFailure = boundary;
    const record = await a.recordAdrenalineWoundLoss(input());
    assert.equal(a.system.wounds.value, 11);
    assert.equal(a.system.bonusActionDice[record.poolId].remaining, 1);
    await a.recordAdrenalineWoundLoss(input());
    assert.equal(a.system.wounds.value, 11);
    assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
    assert.equal(posts.length, boundary === "before" ? 0 : 1);
    assert.equal(warnings.length, boundary === "before" ? 1 : 0);
  }
});
test("cap exhaustion and ineligible causes still record actual damage without a grant or counter refill", async () => {
  const a = fixture();
  a.system.actionDice.max = 1;
  await a.recordAdrenalineWoundLoss(input("first"));
  const second = await a.recordAdrenalineWoundLoss(input("second", 2, "fall", false));
  assert.equal(second.granted, false);
  assert.equal(a.system.wounds.value, 9);
  assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
  assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
  periods.session = "next";
  const third = await a.recordAdrenalineWoundLoss(input("third", 1, "explosion", false));
  assert.equal(third.granted, true);
  assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
  const other = await a.recordAdrenalineWoundLoss(input("fourth", 1, "other", false));
  assert.equal(other.granted, false);
  assert.equal(a.system.resourceUses.adrenalineJunkie.used, 1);
});
test("GC authority, loss types, malformed counters, event references and stale dialogs cannot change health", async () => {
  const a = fixture();
  game.user.isGM = false;
  await assert.rejects(a.recordAdrenalineWoundLoss(input()), /GC records/);
  game.user.isGM = true;
  for (const data of [
    { ...input(), loss: 0 },
    { ...input(), loss: 1.5 },
    { ...input(), loss: "1" },
    { ...input(), loss: true },
    { ...input(), cause: "unknown" },
    { ...input(), confirmed: false },
    { ...input(), eventRef: "bad/event" }
  ])
    await assert.rejects(a.recordAdrenalineWoundLoss(data));
  assert.equal(a.system.wounds.value, 12);
  a.system.resourceUses.adrenalineJunkie = { used: 1 };
  await assert.rejects(a.recordAdrenalineWoundLoss(input()), /saved session/);
  assert.equal(a.system.wounds.value, 12);
  for (const change of [
    a => a.system.wounds.value--,
    a => a.system.actionDice.max++,
    a => (a.system.activeFeatNames = ["Fortune Favors the Bold"]),
    () => (periods.scene = "later"),
    () => (game.user.isGM = false)
  ]) {
    const a = fixture();
    dialog = async () => {
      change(a);
      return { ...input(), loss: "1" };
    };
    await assert.rejects(a.recordAdrenalineWoundLoss(), /changed|Only the GC/);
    assert.equal(Object.keys(a.system.bonusActionDice).length, 0);
  }
});
test("the wound-loss reaction requires no voluntary action and historical receipts reject malformed or changed evidence", async () => {
  const a = fixture();
  a.system.conditionContext = { unconscious: true, stunned: true };
  const r = await a.recordAdrenalineWoundLoss(input());
  assert.equal(r.granted, true);
  assert.equal(recordedWoundEvent(r, { ...input(), actorUuid: a.uuid }), r);
  assert.throws(
    () => recordedWoundEvent({ ...r, afterWounds: 99 }, { ...input(), actorUuid: a.uuid }),
    /saved wound event/
  );
  for (const value of ["", null, "../x", "x/y"]) assert.throws(() => woundEventKey(value));
});

test("the native numeric-dialog value is accepted while booleans, blanks and null cannot become damage", async () => {
  for (const loss of [1, "1"]) {
    const a = fixture();
    dialog = async () => ({ ...input(), loss });
    const r = await a.recordAdrenalineWoundLoss();
    assert.equal(r.loss, 1);
    assert.equal(a.system.wounds.value, 11);
  }
  for (const loss of [true, null, ""]) {
    const a = fixture();
    dialog = async () => ({ ...input(), loss });
    await assert.rejects(a.recordAdrenalineWoundLoss(), /positive whole/);
    assert.equal(a.system.wounds.value, 12);
  }
});
