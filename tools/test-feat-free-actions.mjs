import test from "node:test";
import assert from "node:assert/strict";
import { featFreeActionPlan as plan, QUICK_DRAW_ACTIONS } from "../module/rules/feat-free-actions.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const clock = () => ({ id: "combat", started: true, round: 1, turn: 1, combatantId: "self", ownTurnIndex: 1 }),
  sys = () => ({
    activeFeatNames: ["Quick Draw", "Surge of Speed"],
    actionDice: { value: 0, max: 3 },
    resourceUses: {},
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
    conditionContext: {}
  }),
  input = (source = "quickDraw") => ({
    source,
    action: source === "quickDraw" ? "draw" : "nonAttackHalfAction",
    description: "One otherwise legal action confirmed by the GC",
    confirmed: true,
    nonAttackHalfActionConfirmed: true
  });
test("Quick Draw accepts all four listed action conversions, preserving a declared two-one-handed weapon action without counting it twice", () => {
  for (const action of Object.keys(QUICK_DRAW_ACTIONS)) {
    const p = plan(sys(), clock(), { ...input(), action, description: "Draw two one-handed weapons" });
    assert.equal(p.action, QUICK_DRAW_ACTIONS[action]);
    assert.equal(p.actionCost, "free");
    assert.equal(p.resourceId, "quickDraw");
  }
  for (const action of ["attack", "run", "aim", "__proto__", ""])
    assert.throws(() => plan(sys(), clock(), { ...input(), action }));
});
test("Surge of Speed accepts one non-attack half action only; a mental action is declared explicitly", () => {
  const p = plan(sys(), clock(), input("surgeOfSpeed"));
  assert.equal(p.nonAttackHalfActionConfirmed, true);
  for (const patch of [{ action: "attack" }, { action: "fullAction" }, { nonAttackHalfActionConfirmed: false }])
    assert.throws(() => plan(sys(), clock(), { ...input("surgeOfSpeed"), ...patch }));
  const s = sys();
  s.conditionContext.paralyzed = true;
  assert.throws(() => plan(s, clock(), input("surgeOfSpeed")));
  assert.equal(plan(s, clock(), { ...input("surgeOfSpeed"), purelyMentalConfirmed: true }).purelyMentalConfirmed, true);
  assert.throws(() => plan(s, clock(), { ...input(), purelyMentalConfirmed: true }));
});
test("both feats require earned sources, a valid own Count, confirmed bounded descriptions, and an ability to act", () => {
  for (const source of ["quickDraw", "surgeOfSpeed"]) {
    for (const patch of [
      { confirmed: false },
      { description: "" },
      { description: "x".repeat(1001) },
      { description: 4 }
    ])
      assert.throws(() => plan(sys(), clock(), { ...input(source), ...patch }));
    assert.throws(() => plan({ ...sys(), activeFeatNames: [] }, clock(), input(source)));
    for (const patch of [{ started: false }, { turn: 0 }, { round: 0 }, { combatantId: "" }])
      assert.throws(() => plan(sys(), { ...clock(), ...patch }, input(source)));
    for (const c of ["pinned", "sleeping", "stunned", "dazed", "dead", "unconscious"])
      assert.throws(() => plan({ ...sys(), conditionContext: { [c]: true } }, clock(), input(source)));
    assert.throws(() =>
      plan({ ...sys(), refreshAction: { state: "waiting", combatId: "combat", startRound: 1 } }, clock(), input(source))
    );
  }
  assert.throws(() => plan({ ...sys(), conditionContext: { bound: true } }, clock(), input()));
});

globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry = { utils: { escapeHTML: String, randomID: () => String(++serial) } };
globalThis.ui = { notifications: { warn: () => null } };
let serial = 0,
  fail = "",
  afterHook = null;
globalThis.game = { user: { id: "gc", isGM: true }, settings: { get: () => ({}) }, messages: [] };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (fail === "before") throw Error("unposted");
    const m = { id: String(++serial), ...data };
    game.messages.push(m);
    if (afterHook) await afterHook();
    if (fail === "after") throw Error("posted");
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  fail = "";
  afterHook = null;
  game.messages = [];
  const a = {
    uuid: "Actor.free",
    name: "Free actions",
    type: "agent",
    isOwner: true,
    flags: {},
    system: sys(),
    usagePeriods: { round: "combat:1", session: "session" },
    clock: clock(),
    async update(p) {
      for (const [path, value] of Object.entries(p)) {
        const ks = path.split(".");
        let o = this;
        for (const k of ks.slice(0, -1)) o = o[k] ??= {};
        const k = ks.at(-1);
        if (k.startsWith("-=")) delete o[k.slice(2)];
        else o[k] = structuredClone(value);
      }
    }
  };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.actionDiceFundingSystem = a.system;
  a.mentalLeapCombatContext = () => a.clock;
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.use = async (source, patch = {}) =>
    SpycraftActor.prototype.useFeatFreeAction.call(a, source, { ...input(source), ...patch });
  a.next = () => {
    a.clock.round++;
    a.usagePeriods.round = "combat:" + a.clock.round;
  };
  return a;
}
test("actual Quick Draw dispatch shares its two-use round allowance across actions and concurrent clicks; reacquisition cannot refill it", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 4;
  await Promise.all([
    a.use("quickDraw"),
    a.use("quickDraw", { action: "reload" }),
    a.use("quickDraw", { action: "holster" })
  ]);
  assert.equal(game.messages.length, 2);
  assert.equal(a.system.resourceUses.quickDraw.used, 2);
  assert.equal(a.system.actionDice.value, 0);
  a.system.activeFeatNames = [];
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  await assert.rejects(() => a.use("quickDraw"));
  a.system.activeFeatNames = ["Quick Draw"];
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  await a.use("quickDraw");
  assert.equal(game.messages.length, 2);
  a.next();
  await a.use("quickDraw", { action: "pickUp" });
  assert.equal(game.messages.length, 3);
  assert.equal(a.system.resourceUses.quickDraw.used, 1);
});
test("actual Surge dispatch enforces both once per round and starting-dice session limits while spending no action dice", async () => {
  const a = actor();
  for (let round = 1; round <= 3; round++) {
    await Promise.all([a.use("surgeOfSpeed"), a.use("surgeOfSpeed")]);
    assert.equal(game.messages.length, round);
    a.next();
  }
  await a.use("surgeOfSpeed");
  assert.equal(game.messages.length, 3);
  assert.equal(a.system.resourceUses.surgeOfSpeed.used, 3);
  assert.equal(a.system.actionDice.value, 0);
  a.usagePeriods.session = "nextSession";
  await a.use("surgeOfSpeed");
  assert.equal(game.messages.length, 4);
  assert.equal(a.system.resourceUses.surgeOfSpeed.used, 1);
});
test("failed posting refunds each reserved allowance; a persisted receipt is retained if create subsequently reports an error", async () => {
  for (const source of ["quickDraw", "surgeOfSpeed"]) {
    const a = actor();
    fail = "before";
    await assert.rejects(() => a.use(source), /unposted/);
    assert.deepEqual(a.system.resourceUses, {});
    fail = "after";
    const m = await a.use(source);
    assert.equal(m.flags.spycraft2.featFreeAction.source, source === "quickDraw" ? "Quick Draw" : "Surge of Speed");
    assert.equal(a.system.resourceUses[source].used, 1);
    if (source === "surgeOfSpeed") assert.equal(a.system.resourceUses.surgeOfSpeedRound.used, 1);
    assert.equal(game.messages.length, 1);
  }
});
test("source, Count or description changes while queued do not post and refund their reserved counters", async () => {
  for (const change of [a => (a.system.activeFeatNames = []), a => (a.clock.turn = 0), a => a.clock.round++]) {
    const a = actor();
    a._actionDieQueue = Promise.resolve().then(() => change(a));
    await assert.rejects(() => a.use("quickDraw"));
    assert.equal(game.messages.length, 0);
    assert.deepEqual(a.system.resourceUses, {});
  }
});
test("unsupported and non-owner calls cannot consume counters or create receipts", async () => {
  const a = actor();
  await assert.rejects(() => a.use("other"));
  a.isOwner = false;
  assert.equal(await a.use("quickDraw"), null);
  assert.deepEqual(a.system.resourceUses, {});
  assert.equal(game.messages.length, 0);
});
