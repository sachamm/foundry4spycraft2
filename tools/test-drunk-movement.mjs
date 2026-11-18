import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVIATION_DIRECTIONS,
  drunkRepositionHistory,
  drunkRepositionPlan,
  freezeDrunkReposition,
  drunkRepositionCompletion,
  drunkTokenMovementPlan
} from "../module/rules/condition-movement.mjs";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
let draws = 0,
  posts = 0,
  nextDie = 3,
  postFailure = null;
globalThis.Roll = class {
  constructor(formula) {
    this.formula = formula;
  }
  async evaluate() {
    draws++;
    this.total = nextDie;
    return this;
  }
  toJSON() {
    return {
      formula: this.formula,
      total: this.total,
      evaluated: true,
      terms: [{ number: 1, faces: 8, modifiers: [], results: [{ result: this.total, active: true }] }]
    };
  }
  static fromJSON(json) {
    const data = JSON.parse(json),
      r = new this(data.formula);
    r.total = data.total;
    return r;
  }
  async toMessage(data) {
    return ChatMessage.create({ ...data, rolls: [this] });
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  async create(data) {
    posts++;
    if (postFailure === "before") {
      postFailure = null;
      throw Error("post failed");
    }
    const m = { ...data, id: "message" + posts, uuid: "ChatMessage.message" + posts };
    game.messages.push(m);
    if (postFailure === "after") {
      postFailure = null;
      throw Error("post committed then failed");
    }
    return m;
  }
};
const combat = { id: "combat", started: true, round: 1 },
  base = () => ({ worldTime: 0, conditionContext: { drunk: true } }),
  request = { standing: true, roundStartConfirmed: true },
  rollJSON = die =>
    JSON.stringify({
      formula: "1d8",
      total: die,
      evaluated: true,
      terms: [{ number: 1, faces: 8, modifiers: [], results: [{ result: die, active: true }] }]
    });
function actor() {
  game.time.worldTime = 0;
  game.messages = [];
  draws = posts = 0;
  nextDie = 3;
  postFailure = null;
  const a = makeFatigueActor([{ _id: "drunk-source", name: "Drunk", statuses: ["drunk"] }]);
  game.combat = { ...combat, combatants: [{ actor: a }] };
  game.combats = [game.combat];
  return a;
}
test("all eight deviation results retain the exact diagram order, five-foot distance and zero movement cost", () => {
  assert.deepEqual(DEVIATION_DIRECTIONS, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  const p = drunkRepositionPlan(base(), combat, request);
  assert.equal(p.record.state, "awaitingRoll");
  for (let die = 1; die <= 8; die++) {
    const r = freezeDrunkReposition(p.record, { die, rollJSON: rollJSON(die) });
    assert.equal(r.direction, DEVIATION_DIRECTIONS[die - 1]);
    assert.equal(r.distanceFeet, 5);
    assert.equal(r.movementAllowanceCost, 0);
    assert.equal(drunkRepositionHistory({ ...base(), drunkRepositions: [r] }).warnings.length, 0);
  }
  for (const die of [0, 9, 1.5, null])
    assert.throws(() => freezeDrunkReposition(p.record, { die, rollJSON: rollJSON(die) }));
  assert.throws(() => freezeDrunkReposition(p.record, { die: 3, rollJSON: rollJSON(4) }));
  const edited = JSON.parse(rollJSON(3));
  edited.terms[0].results[0].result = 8;
  assert.throws(() => freezeDrunkReposition(p.record, { die: 3, rollJSON: JSON.stringify(edited) }));
});
test("posture is recorded once at round start: not standing skips without a die and later standing cannot add another result", () => {
  const s = base(),
    r = drunkRepositionPlan(s, combat, { ...request, standing: false }).record;
  assert.equal(r.state, "skipped");
  assert.equal(r.die, null);
  const p = drunkRepositionPlan({ ...s, drunkRepositions: [r] }, combat, request);
  assert.equal(p.reused, true);
  assert.equal(p.record.state, "skipped");
  assert.throws(() => drunkRepositionPlan(s, combat, { standing: true }), /GC/);
  assert.throws(() => drunkRepositionPlan({ ...s, conditionContext: {} }, combat, request), /active Drunk/);
});
test("malformed, duplicate, future, interrupted or edited-roll histories require review and cannot draw again", () => {
  const r = freezeDrunkReposition(drunkRepositionPlan(base(), combat, request).record, {
    die: 3,
    rollJSON: rollJSON(3)
  });
  for (const records of [
    [r, r],
    [{ ...r, at: 1 }],
    [{ ...r, direction: "N" }],
    [{ ...r, rollJSON: rollJSON(4) }],
    [{ ...r, movementAllowanceCost: 5 }],
    [{ ...r, needsReview: true }],
    [{ ...r, state: "awaitingRoll", die: null }]
  ])
    assert.throws(() => drunkRepositionPlan({ ...base(), drunkRepositions: records }, combat, request), /review/i);
});
test("a frozen result is completed only after actual movement confirmation, and later rounds retain earlier pending obligations", () => {
  const one = freezeDrunkReposition(drunkRepositionPlan(base(), combat, request).record, {
      die: 3,
      rollJSON: rollJSON(3)
    }),
    s = { ...base(), drunkRepositions: [one] };
  assert.throws(() => drunkRepositionCompletion(s, { id: one.id }), /actually occurred/);
  const done = drunkRepositionCompletion(s, { id: one.id, movementConfirmed: true });
  assert.equal(done.record.state, "applied");
  assert.equal(drunkRepositionCompletion({ ...s, drunkRepositions: [done.record] }, { id: one.id }).reused, true);
  const two = drunkRepositionPlan(s, { ...combat, round: 2 }, request);
  assert.equal(two.record.id, "combat:2");
  assert.equal(s.drunkRepositions[0].state, "pending");
});
test("actual competing/repeated confirmations draw and post once; movement confirmation does not spend health, dice or allowed movement", async () => {
  const a = actor();
  await Promise.all([a.rollDrunkReposition(request), a.rollDrunkReposition(request)]);
  assert.equal(draws, 1);
  assert.equal(posts, 1);
  assert.equal(a.system.drunkRepositions.length, 1);
  assert.equal(a.system.drunkRepositions[0].direction, "E");
  await a.confirmDrunkReposition({ id: "combat:1", movementConfirmed: true });
  await a.confirmDrunkReposition({ id: "combat:1", movementConfirmed: true });
  assert.equal(a.system.drunkRepositions[0].state, "applied");
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
  assert.equal(a.system.speed, 30);
  assert.equal(game.messages[0].flags.spycraft2.actionDiceAllowed, false);
});
test("failed or committed chat posts retain the original frozen roll; retries recover its receipt without rerolling or duplicating committed messages", async () => {
  for (const failure of ["before", "after"]) {
    const a = actor();
    postFailure = failure;
    await assert.rejects(a.rollDrunkReposition(request), /post/);
    assert.equal(a.system.drunkRepositions[0].die, 3);
    nextDie = 8;
    await a.rollDrunkReposition(request);
    assert.equal(draws, 1);
    assert.equal(game.messages.length, 1);
    assert.equal(game.messages[0].rolls[0].total, 3);
    assert.equal(a.system.drunkRepositions[0].die, 3);
  }
});
test("an interrupted result write retains a reserved round for review and cannot fish for another direction", async () => {
  const a = actor(),
    update = a.update;
  let failed = false;
  a.update = async patch => {
    if (patch["system.drunkRepositions"]?.[0]?.state === "pending" && !failed) {
      failed = true;
      throw Error("result write failed");
    }
    return update(patch);
  };
  await assert.rejects(a.rollDrunkReposition(request), /result write/);
  assert.equal(draws, 1);
  assert.equal(a.system.drunkRepositions[0].state, "awaitingRoll");
  await assert.rejects(a.rollDrunkReposition(request), /review/i);
  assert.equal(draws, 1);
});
test("actual not-standing rounds draw no die, stale rounds are rejected, and involuntary reposition is distinct from voluntary actions", async () => {
  const a = actor();
  await a.rollDrunkReposition({ ...request, standing: false });
  assert.equal(draws, 0);
  assert.equal(posts, 1);
  await a.rollDrunkReposition(request);
  assert.equal(draws, 0);
  game.combat.round = 2;
  await assert.rejects(a.rollDrunkReposition({ ...request, expectedRound: "combat:1" }), /round changed/);
  a.raw.abilities.cha.base = 0;
  a.derive();
  assert.equal(a.system.attributeCollapse.conditions.includes("Unconscious"), true);
  await a.rollDrunkReposition(request);
  assert.equal(draws, 1, "GC posture declaration governs this involuntary effect; no voluntary action is granted");
});

const snapshot = (a, extra = {}) => ({
  uuid: "Scene.s.Token.t",
  actorUuid: a.uuid,
  isOwner: true,
  x: 100,
  y: 100,
  width: 1,
  height: 1,
  sceneUuid: "Scene.s",
  grid: { type: 1, size: 100, distance: 5, units: "ft" },
  sceneRect: { x: 0, y: 0, width: 1000, height: 1000 },
  ...extra
});
function withToken(a) {
  let moves = 0;
  const scene = {
      uuid: "Scene.s",
      name: "Test scene",
      dimensions: { sceneX: 0, sceneY: 0, sceneWidth: 1000, sceneHeight: 1000 },
      grid: { type: 1, size: 100, distance: 5, units: "ft" },
      toObject() {
        return { grid: { ...this.grid } };
      }
    },
    t = {
      ...snapshot(a),
      name: "Test token",
      actor: a,
      parent: scene,
      fail: null,
      hook: null,
      async update(patch) {
        if (this.fail === "before") {
          this.fail = null;
          throw Error("token write failed");
        }
        Object.assign(this, patch);
        moves++;
        await this.hook?.();
        if (this.fail === "after") {
          this.fail = null;
          throw Error("token write committed then failed");
        }
        return this;
      }
    };
  scene.tokens = [t];
  game.scenes = [scene];
  return { token: t, scene, moves: () => moves };
}
const apply = (a, extra = {}) =>
  a.applyDrunkReposition({ id: "combat:1", tokenUuid: "Scene.s.Token.t", routeConfirmed: true, ...extra });
test("all frozen directions move exactly one five-foot grid step and preserve token size/scene bounds", () => {
  for (let die = 1; die <= 8; die++)
    for (const distance of [5, 10]) {
      const a = { uuid: "Actor.test" },
        token = snapshot(a, { grid: { type: 1, size: 100, distance, units: "feet" } }),
        r = freezeDrunkReposition(drunkRepositionPlan(base(), combat, request).record, {
          die,
          rollJSON: rollJSON(die)
        }),
        p = drunkTokenMovementPlan({ ...base(), actorUuid: a.uuid, drunkRepositions: [r] }, combat, {
          id: r.id,
          token,
          routeConfirmed: true
        }),
        offsets = [
          [0, -1],
          [1, -1],
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [-1, -1]
        ],
        step = (100 * 5) / distance;
      assert.deepEqual(p.movementPlan.to, { x: 100 + offsets[die - 1][0] * step, y: 100 + offsets[die - 1][1] * step });
      assert.equal(p.record.state, "moving");
      assert.equal(p.moveRequired, true);
      assert.equal(p.record.movementAllowanceCost, 0);
    }
});
test("automatic token movement rejects other actors, unowned tokens, unconfirmed paths, unsupported grids, off-map paths and earlier rounds", () => {
  const a = { uuid: "Actor.test" },
    r = freezeDrunkReposition(drunkRepositionPlan(base(), combat, request).record, { die: 3, rollJSON: rollJSON(3) }),
    s = { ...base(), actorUuid: a.uuid, drunkRepositions: [r] },
    token = snapshot(a);
  for (const bad of [
    { actorUuid: "Other" },
    { isOwner: false },
    { grid: { type: 0, size: 100, distance: 5, units: "ft" } },
    { grid: { type: 1, size: 100, distance: 5, units: "m" } },
    { grid: { type: 1, size: 100, distance: 3, units: "ft" } },
    { x: 900 },
    { width: 10 }
  ])
    assert.throws(() =>
      drunkTokenMovementPlan(s, combat, { id: r.id, token: { ...token, ...bad }, routeConfirmed: true })
    );
  assert.throws(() => drunkTokenMovementPlan(s, combat, { id: r.id, token }), /GC/);
  assert.throws(
    () => drunkTokenMovementPlan(s, { ...combat, round: 2 }, { id: r.id, token, routeConfirmed: true }),
    /current Drunk/
  );
});
test("actual token application reserves before moving and repeated requests never move twice or spend resources", async () => {
  const a = actor(),
    t = withToken(a);
  await a.rollDrunkReposition(request);
  const update = a.update,
    order = [];
  a.update = async patch => {
    order.push(patch["system.drunkRepositions"]?.[0]?.state);
    return update(patch);
  };
  t.token.hook = async () => {
    assert.equal(a.system.drunkRepositions[0].state, "moving");
    order.push("token");
  };
  await apply(a);
  await apply(a);
  assert.deepEqual(order, ["moving", "token", "applied"]);
  assert.equal(t.moves(), 1);
  assert.equal(t.token.x, 200);
  assert.equal(t.token.y, 100);
  assert.equal(a.system.drunkRepositions[0].state, "applied");
  assert.equal(draws, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.wounds.value, 4);
});
test("a token update failure before or after its write resumes without a second move", async () => {
  for (const failure of ["before", "after"]) {
    const a = actor(),
      t = withToken(a);
    await a.rollDrunkReposition(request);
    t.token.fail = failure;
    if (failure === "before") {
      await assert.rejects(apply(a), /token write/);
      assert.equal(a.system.drunkRepositions[0].state, "moving");
      assert.equal(t.moves(), 0);
    } else await apply(a);
    await apply(a);
    assert.equal(t.moves(), 1);
    assert.equal(t.token.x, 200);
    assert.equal(a.system.drunkRepositions[0].state, "applied");
    assert.equal(draws, 1);
  }
});
test("failed completion bookkeeping repairs an already moved token even after the round/condition changes", async () => {
  const a = actor(),
    t = withToken(a);
  await a.rollDrunkReposition(request);
  const update = a.update;
  let fail = true;
  a.update = async patch => {
    if (fail && patch["system.drunkRepositions"]?.[0]?.state === "applied") {
      fail = false;
      throw Error("completion failed");
    }
    return update(patch);
  };
  await assert.rejects(apply(a), /completion/);
  assert.equal(t.token.x, 200);
  assert.equal(a.system.drunkRepositions[0].state, "moving");
  game.combat.round = 2;
  await a.deleteEmbeddedDocuments("ActiveEffect", ["drunk-source"]);
  await apply(a);
  assert.equal(t.moves(), 1);
  assert.equal(a.system.drunkRepositions[0].state, "applied");
  assert.equal(a.system.conditionContext.drunk, false);
});
test("a reservation write that commits before failing retains the original start and permits exactly one subsequent move", async () => {
  const a = actor(),
    t = withToken(a);
  await a.rollDrunkReposition(request);
  const update = a.update;
  let fail = true;
  a.update = async patch => {
    await update(patch);
    if (fail && patch["system.drunkRepositions"]?.[0]?.state === "moving") {
      fail = false;
      throw Error("reservation committed then failed");
    }
    return a;
  };
  await assert.rejects(apply(a), /reservation/);
  assert.equal(t.moves(), 0);
  assert.equal(a.system.drunkRepositions[0].state, "moving");
  await apply(a);
  assert.equal(t.moves(), 1);
  assert.equal(a.system.drunkRepositions[0].state, "applied");
});
test("newer token positions are preserved and interrupted movement requires a separate explicit GC review before manual completion", async () => {
  const a = actor(),
    t = withToken(a);
  await a.rollDrunkReposition(request);
  t.token.hook = async () => {
    t.token.x = 350;
  };
  await assert.rejects(apply(a), /position changed/);
  assert.equal(a.system.drunkRepositions[0].state, "moving");
  await assert.rejects(apply(a), /another position/);
  assert.equal(t.token.x, 350);
  assert.equal(t.moves(), 1);
  await assert.rejects(a.confirmDrunkReposition({ id: "combat:1", movementConfirmed: true }), /interrupted/);
  await a.confirmDrunkReposition({ id: "combat:1", movementConfirmed: true, interruptedMovementReviewed: true });
  assert.equal(a.system.drunkRepositions[0].interruptedMovementReviewed, true);
  assert.equal(t.token.x, 350);
});
test("stale token snapshots and changed grids block the move while a missing token cannot transfer its obligation to another token", async () => {
  const a = actor(),
    t = withToken(a);
  await a.rollDrunkReposition(request);
  await assert.rejects(apply(a, { expectedTokenSnapshot: "stale" }), /position or scene grid changed/);
  assert.equal(t.moves(), 0);
  t.token.fail = "before";
  await assert.rejects(apply(a));
  t.scene.grid.distance = 10;
  await assert.rejects(apply(a), /size or scene grid changed/);
  t.scene.tokens = [];
  await assert.rejects(apply(a), /owned token/);
  assert.equal(t.moves(), 0);
});
