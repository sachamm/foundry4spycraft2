import test from "node:test";
import assert from "node:assert/strict";
import {
  masterPlanGainPlan,
  masterPlanPool,
  actionDiceFundingContext,
  actionDicePaymentPlan,
  actionDicePaymentRefund,
  actionDicePoolFingerprint
} from "../module/rules/bonus-pools.mjs";
import { actionDieBoostPlan } from "../module/rules/action-dice.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
let warnings = [],
  periods,
  posts,
  formulas,
  postFailure,
  postHook,
  rollHook,
  sequence = 0;
const clone = structuredClone;
const mergeRecord = (a, b) => {
  const out = clone(a ?? {});
  for (const [k, v] of Object.entries(b))
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? mergeRecord(out[k], v) : clone(v);
  return out;
};
const base = () => ({
  worldTime: 0,
  level: 12,
  classLevels: { schemer: 8 },
  coreClassIds: ["schemer"],
  activeFeatNames: [],
  abilities: Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: k === "int" ? 4 : 2 }])
  ),
  actionDice: { value: 0, die: 8, explodeAt: 7, bonus: 1 },
  bonusActionDice: {},
  usagePeriods: periods,
  conditionContext: {},
  vitality: { value: 4, max: 20 },
  wounds: { value: 4, max: 14 },
  actionDieAwards: {},
  xp: 0
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.typed";
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.system = base();
    this.system.bonusActionDice.mp = masterPlanPool(this.system, masterPlanGainPlan(this.system), { id: "mp" });
    this.statuses = new Set();
    this.fail = {};
  }
  async update(patch) {
    const applyHealth =
        Object.hasOwn(patch, "flags.spycraft2.healingReceipt") &&
        patch["flags.spycraft2.healingReceipt"]?.id === "id" + sequence,
      health = Object.hasOwn(patch, "system.vitality.value"),
      balance = patch["system.bonusActionDice.mp.remaining"],
      reserve = balance != null && balance < this.system.bonusActionDice.mp.remaining,
      refund = balance != null && balance > this.system.bonusActionDice.mp.remaining,
      defense = Object.hasOwn(patch, "system.defenseBoost"),
      kind = health
        ? applyHealth
          ? "health"
          : "rollback"
        : defense
          ? patch["system.defenseBoost"]?.actionDiceReceiptId === "id" + sequence
            ? "defense"
            : "defenseRollback"
          : reserve
            ? "reservation"
            : refund
              ? "refund"
              : null;
    if (kind && this.fail[kind + "Before"]) {
      this.fail[kind + "Before"] = false;
      await this.failureHook?.(kind, "before");
      throw Error(kind + " failed before commit");
    }
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = this;
      for (const key of keys.slice(0, -1)) o = o[key] ??= {};
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete o[key.slice(2)];
      else
        o[key] =
          [
            "system.refreshAction",
            "system.defenseBoost",
            "flags.spycraft2.healingReceipt",
            "flags.spycraft2.actionDiceSettlementReview"
          ].includes(path) &&
          value &&
          typeof value === "object"
            ? mergeRecord(o[key], value)
            : clone(value);
    }
    this.system.actionDiceSettlementReview = this.flags.spycraft2?.actionDiceSettlementReview ?? null;
    if (kind && this.fail[kind + "After"]) {
      this.fail[kind + "After"] = false;
      await this.failureHook?.(kind, "after");
      throw Error(kind + " committed then failed");
    }
    return this;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { isGM: true, id: "gc" },
  time: { worldTime: 0 },
  combat: null,
  combats: [],
  messages: [],
  settings: { get: () => periods },
  i18n: { localize: s => s }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s), randomID: () => `id${++sequence}` },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = {
  notifications: {
    warn: message => {
      warnings.push(message);
      return null;
    }
  }
};
async function post(data) {
  await postHook?.();
  if (postFailure === "before") throw Error("post failed");
  const message = { ...clone(data), id: "message" + posts.length };
  message.delete = async () => {
    game.messages = game.messages.filter(m => m !== message);
  };
  posts.push(message);
  game.messages.push(message);
  if (postFailure === "after") throw Error("post committed then failed");
  return message;
}
globalThis.ChatMessage = { getSpeaker: () => ({}), create: post };
globalThis.Roll = class {
  constructor(formula) {
    this.formula = formula;
    formulas.push(formula);
    const count = (formula.match(/1d/g) ?? []).length;
    this.dice = Array.from({ length: count }, () => ({ total: 2 }));
    this.total = count * 3;
  }
  async evaluate() {
    await rollHook?.();
    return this;
  }
  async toMessage(data) {
    return post({ ...data, rolls: [{ formula: this.formula, total: this.total }] });
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  periods = { scene: "scene", session: "session", mission: "mission" };
  warnings = [];
  posts = [];
  formulas = [];
  postFailure = null;
  postHook = rollHook = null;
  game.messages = [];
  game.user.isGM = true;
  game.combat = null;
  game.combats = [];
  return new SpycraftActor();
}
const heal = (a, extra = {}) => a.healWithActionDice({ bonusPoolId: "mp", vitalityDice: 1, ...extra });
test("typed funding retains its own die, explosion adjustment and modifiers while compulsory check dice cannot pay unrestricted costs", () => {
  const a = actor(),
    p = actionDicePaymentPlan(a.system, { count: 1, bonusPoolId: "mp" });
  assert.equal(p.die, 4);
  assert.equal(p.system.actionDice.explodeAt, 3);
  assert.equal(p.system.actionDice.bonus, 1);
  assert.equal(p.balance, 4);
  assert.equal(p.afterBalance, 3);
  assert.equal(p.paymentPath, "system.bonusActionDice.mp.remaining");
  a.system.bonusActionDice.bound = { id: "bound", source: "iKnowWhatDoing", die: 10, remaining: 1, granted: 1 };
  assert.equal(actionDiceFundingContext(a.system, { bonusPoolId: "bound" }).blocked, true);
  assert.equal(actionDicePaymentPlan(a.system, { count: 5, bonusPoolId: "mp" }).blocked, true);
  for (const count of [0, -1, 1.5]) assert.throws(() => actionDicePaymentPlan(a.system, { count, bonusPoolId: "mp" }));
  assert.equal(actionDicePaymentPlan(a.system, { count: 1 }).blocked, true);
});
test("generic typed payment and callback failure debit/refund only that grant and preserve ordinary dice, XP and awards", async () => {
  const a = actor();
  await assert.rejects(
    a.spendActionDice(
      1,
      async p => {
        assert.equal(p.system.actionDice.die, 4);
        assert.equal(a.system.bonusActionDice.mp.remaining, 3);
        assert.equal(a.system.actionDice.value, 0);
        throw Error("work failed");
      },
      { bonusPoolId: "mp" }
    ),
    /work failed/
  );
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.xp, 0);
  assert.deepEqual(a.system.actionDieAwards, {});
});
test("reservation failures before/after commit run no callback and restore exact selected funds, including a committed refund error", async () => {
  for (const failure of ["reservationBefore", "reservationAfter"]) {
    const a = actor();
    a.fail[failure] = true;
    if (failure === "reservationAfter") a.fail.refundAfter = true;
    let called = false;
    await assert.rejects(
      a.spendActionDice(
        1,
        async () => {
          called = true;
        },
        { bonusPoolId: "mp" }
      )
    );
    assert.equal(called, false);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.flags.spycraft2?.actionDiceSettlementReview, undefined);
  }
});
test("standalone spending rolls the selected d4 and records its source without spending a career d8", async () => {
  const a = actor(),
    m = await a.rollActionDie({ bonusPoolId: "mp" });
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(m.flags.spycraft2.funding.die, 4);
  assert.equal(m.flags.spycraft2.funding.bonusPoolId, "mp");
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
});
test("typed vitality healing rolls the granted die with modifiers, while wound healing restores two without a roll", async () => {
  const a = actor(),
    r = await heal(a);
  assert.equal(r.healedVitality, 3);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(posts[0].flags.spycraft2.funding.die, 4);
  const count = formulas.length;
  await heal(a, { vitalityDice: 0, woundDice: 1 });
  assert.equal(formulas.length, count);
  assert.equal(a.system.wounds.value, 6);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(a.system.actionDice.value, 0);
});
test("typed healing respects maxima, death, combat and expiry without charging blocked attempts", async () => {
  let a = actor();
  a.system.vitality.max = 5;
  assert.equal((await heal(a)).healedVitality, 1);
  for (const blocked of ["dead", "combat", "expiry"]) {
    a = actor();
    if (blocked === "dead") a.statuses.add("dead");
    if (blocked === "combat") game.combat = { started: true, id: "c", round: 1, combatants: [{ actor: a }] };
    if (blocked === "expiry") periods.scene = "new";
    assert.equal(await heal(a), false, blocked);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(formulas.length, 0);
  }
});
test("a failed healing post reverses only its own gains, preserves unrelated damage and refunds the selected source", async () => {
  const a = actor();
  postFailure = "before";
  postHook = () => {
    a.system.wounds.value--;
  };
  await assert.rejects(heal(a, { vitalityDice: 0, woundDice: 1 }), /post failed/);
  assert.equal(a.system.wounds.value, 3);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.flags.spycraft2.healingReceipt, undefined);
  assert.equal(a.system.actionDice.value, 0);
});
test("a health write that commits before failing is proved by its receipt, even if subsequent damage returns health to its old value", async () => {
  const a = actor();
  a.fail.healthAfter = true;
  a.failureHook = kind => {
    if (kind === "health") a.system.wounds.value -= 2;
  };
  await assert.rejects(heal(a, { vitalityDice: 0, woundDice: 1 }), /committed/);
  assert.equal(a.system.wounds.value, 2, "remove our healing while preserving the independent two-wound loss");
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.flags.spycraft2.healingReceipt, undefined);
});
test("a failed pre-commit health write does not subtract an unrelated coincidentally equal healing gain", async () => {
  const a = actor();
  a.fail.healthBefore = true;
  a.failureHook = () => {
    a.system.vitality.value = 7;
  };
  await assert.rejects(heal(a), /before commit/);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.flags.spycraft2?.healingReceipt, undefined);
});
test("a healing receipt that commits before the post reports failure retains the actual healing and one payment", async () => {
  const a = actor();
  postFailure = "after";
  const r = await heal(a);
  assert.equal(r.healedVitality, 3);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].flags.spycraft2.healingReceiptId, a.flags.spycraft2.healingReceipt.id);
});
test("failed health restoration keeps payment spent, blocks more dice use and requires explicit GC reconciliation", async () => {
  const a = actor();
  postFailure = "before";
  a.fail.rollbackBefore = true;
  await assert.rejects(heal(a), /safely restored/);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: "mp" }).blocked, true);
  assert.equal(actionDieBoostPlan(a.actionDiceFundingSystem, { actionDiceAllowed: true }, { count: 1 }).blocked, true);
  game.user.isGM = false;
  await assert.rejects(
    a.reviewActionDiceSettlement({ balance: 3, resolution: "Verified", healthReviewed: true }),
    /Only the GC/
  );
  game.user.isGM = true;
  await a.reviewActionDiceSettlement({
    balance: 3,
    resolution: "Verified actual healing; retained the paid die",
    healthReviewed: true
  });
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, false);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: "mp" }).blocked, false);
});
test("a failed refund preserves its review until the GC confirms a bounded whole-die balance and records the resolution", async () => {
  const a = actor();
  postFailure = "before";
  a.fail.refundBefore = true;
  await assert.rejects(heal(a), /balance needs review/);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  for (const patch of [
    { balance: 5 },
    { balance: -1 },
    { balance: 1.5 },
    { healthReviewed: false },
    { resolution: "" }
  ])
    await assert.rejects(
      a.reviewActionDiceSettlement({
        balance: 4,
        resolution: "Restored health; refund die",
        healthReviewed: true,
        ...patch
      })
    );
  await a.reviewActionDiceSettlement({
    balance: 4,
    resolution: "Health restored; refunded reserved die",
    healthReviewed: true
  });
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, false);
  assert.equal(a.system.actionDice.value, 0);
});
test("committed rollback/refund errors are reconciled without double restoration or a spurious review lock", async () => {
  for (const failure of ["rollbackAfter", "refundAfter"]) {
    const a = actor();
    postFailure = "before";
    a.fail[failure] = true;
    await assert.rejects(heal(a), /post failed/);
    assert.equal(a.system.vitality.value, 4);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.flags.spycraft2?.actionDiceSettlementReview, undefined);
  }
});
test("a different or changed grant cannot receive an old refund; its uncertain payment stays visible for review", async () => {
  const a = actor(),
    p = actionDicePaymentPlan(a.system, { count: 1, bonusPoolId: "mp" });
  a.system.bonusActionDice.mp.remaining = 3;
  a.system.bonusActionDice.mp.die = 6;
  assert.throws(() => actionDicePaymentRefund(a.system, p), /grant changed/);
  assert.notEqual(actionDicePoolFingerprint(a.system.bonusActionDice.mp), p.poolFingerprint);
});
test("death during a healing roll blocks settlement and restores the reserved dice without reviving or healing", async () => {
  const a = actor();
  rollHook = () => a.statuses.add("dead");
  await assert.rejects(heal(a), /dead character/);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(posts.length, 0);
});

test("GC reconciliation never follows an edited payment path or malformed source identifier", async () => {
  const a = actor();
  postFailure = "before";
  a.fail.rollbackBefore = true;
  await assert.rejects(heal(a));
  const r = a.flags.spycraft2.actionDiceSettlementReview;
  r.payment.paymentPath = "ownership.default";
  await assert.rejects(
    a.reviewActionDiceSettlement({ balance: 3, resolution: "Review", healthReviewed: true }),
    /payment source/
  );
  assert.equal(a.ownership, undefined);
  r.payment.bonusPoolId = "mp.invalid";
  r.payment.paymentPath = "system.bonusActionDice.mp.invalid.remaining";
  await assert.rejects(
    a.reviewActionDiceSettlement({ balance: 3, resolution: "Review", healthReviewed: true }),
    /payment source/
  );
});
test("GC review rechecks role and stale health after its dialog rather than approving an earlier snapshot", async () => {
  for (const changed of ["role", "health"]) {
    const a = actor();
    postFailure = "before";
    a.fail.rollbackBefore = true;
    await assert.rejects(heal(a));
    const old = foundry.applications.api.DialogV2.input;
    foundry.applications.api.DialogV2.input = async () => {
      if (changed === "role") game.user.isGM = false;
      else a.system.wounds.value--;
      return { balance: 3, resolution: "Review", healthReviewed: true };
    };
    try {
      await assert.rejects(a.reviewActionDiceSettlement(), changed === "role" ? /Only the GC/ : /changed/);
      assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
    } finally {
      foundry.applications.api.DialogV2.input = old;
      game.user.isGM = true;
    }
  }
});

test("GC reconciliation repairs an interrupted Master Plan grant without refunding its mission activation", async () => {
  const a = actor(),
    pool = a.system.bonusActionDice.mp;
  a.system.resourceUses = { masterPlan: { epoch: "mission", used: 1 } };
  pool.needsReview = true;
  await a.markActionDiceSettlementReview(
    {
      count: 0,
      balance: 4,
      paymentPath: "system.bonusActionDice.mp.remaining",
      bonusPoolId: "mp",
      die: 4,
      label: "Master Plan",
      poolFingerprint: actionDicePoolFingerprint(pool)
    },
    Error("grant receipt cleanup failed"),
    { purpose: "Master Plan grant", grantReview: true }
  );
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: "mp" }).blocked, true);
  await a.reviewActionDiceSettlement({
    balance: 4,
    resolution: "Verified the grant and receipt; retained mission use",
    healthReviewed: true
  });
  assert.equal(a.system.bonusActionDice.mp.needsReview, false);
  assert.equal(a.system.resourceUses.masterPlan.used, 1);
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: "mp" }).blocked, false);
});

function combatFor(a) {
  const member = { id: "pc", actor: a };
  game.combat = {
    id: "combat",
    round: 1,
    started: true,
    turn: 0,
    combatant: member,
    combatants: [member],
    turns: [member]
  };
  game.combats = [game.combat];
  return game.combat;
}
async function waitingRefresh(a) {
  const c = combatFor(a);
  await a.refreshWithActionDie({ phase: "start", forfeitActions: true });
  c.round = 2;
  return c;
}
const completeRefresh = (a, extra = {}) =>
    a.refreshWithActionDie({
      phase: "complete",
      resource: "vitality",
      notTargeted: true,
      atStartOfInitiative: true,
      bonusPoolId: "mp",
      ...extra
    }),
  defend = (a, extra = {}) => a.boostDefenseWithActionDie({ atStartOfRound: true, bonusPoolId: "mp", ...extra });
test("typed Refresh starts at zero ordinary dice, spends at the next initiative and uses the selected healing die", async () => {
  const a = actor(),
    c = await waitingRefresh(a);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.system.refreshAction.state, "waiting");
  const r = await completeRefresh(a);
  assert.equal(r.healedVitality, 3);
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(a.system.refreshAction.state, "completed");
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(posts[0].flags.spycraft2.checkKind, "refresh");
  assert.equal(posts[0].flags.spycraft2.funding.die, 4);
  assert.equal(await completeRefresh(a), false);
  assert.equal(c.round, 2);
});
test("typed Refresh preserves the initiative/attack window and expires funding without charging or completing the action", async () => {
  for (const kind of ["early", "attacked", "expired", "wrongTurn"]) {
    const a = actor(),
      c = await waitingRefresh(a);
    if (kind === "early") c.round = 1;
    if (kind === "attacked") a.system.refreshAction.targeted = true;
    if (kind === "expired") periods.scene = "new";
    if (kind === "wrongTurn") c.combatant = { id: "other", actor: { uuid: "Other" } };
    assert.equal(await completeRefresh(a), false, kind);
    assert.equal(a.system.refreshAction.state, "waiting");
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.system.vitality.value, 4);
  }
});
test("Refresh health writes failing before/after commit restore the pending action, exact source and prior receipt", async () => {
  for (const failure of ["healthBefore", "healthAfter"]) {
    const a = actor();
    a.flags.spycraft2 = { healingReceipt: { id: "old", custom: { preserve: 7 }, funding: { legacy: "keep" } } };
    await waitingRefresh(a);
    const before = clone(a.system.refreshAction),
      receipt = clone(a.flags.spycraft2.healingReceipt);
    a.fail[failure] = true;
    await assert.rejects(completeRefresh(a));
    assert.deepEqual(a.system.refreshAction, before);
    assert.deepEqual(a.flags.spycraft2.healingReceipt, receipt);
    assert.equal(a.system.vitality.value, 4);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  }
});
test("a failed Refresh post removes its own gains and restores the waiting record while preserving unrelated damage", async () => {
  const a = actor();
  await waitingRefresh(a);
  const before = clone(a.system.refreshAction);
  postFailure = "before";
  postHook = () => {
    a.system.wounds.value--;
  };
  await assert.rejects(completeRefresh(a), /post failed/);
  assert.deepEqual(a.system.refreshAction, before);
  assert.equal(a.system.wounds.value, 3);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
});
test("a committed Refresh post keeps one payment, while a newer action edit during a failed post is retained for review", async () => {
  let a = actor();
  await waitingRefresh(a);
  postFailure = "after";
  await completeRefresh(a);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.refreshAction.state, "completed");
  assert.equal(posts.length, 1);
  a = actor();
  await waitingRefresh(a);
  postFailure = "before";
  postHook = () => {
    a.system.refreshAction.externalNote = "newer";
  };
  await assert.rejects(completeRefresh(a));
  assert.equal(a.system.refreshAction.externalNote, "newer");
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
});
test("typed Defense rolls its source die for duration, spends one and does not stack an active boost", async () => {
  const a = actor();
  combatFor(a);
  const r = await defend(a);
  assert.equal(r.rounds, 3);
  assert.equal(r.expiresAtRound, 4);
  assert.equal(r.funding.die, 4);
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(await defend(a), false);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
});
test("Defense record failures and failed replacement posts restore the exact old effect despite recursive ObjectField merging", async () => {
  for (const failure of ["defenseBefore", "defenseAfter", "post"]) {
    const a = actor();
    combatFor(a);
    a.system.defenseBoost = {
      combatId: "combat",
      startRound: 0,
      expiresAtRound: 1,
      custom: { preserve: true },
      oldOnly: "keep"
    };
    const before = clone(a.system.defenseBoost);
    if (failure === "post") postFailure = "before";
    else a.fail[failure] = true;
    await assert.rejects(defend(a, { replaceExisting: true }));
    assert.deepEqual(a.system.defenseBoost, before);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.system.actionDice.value, 0);
  }
});
test("a Defense receipt that commits before failing retains one valid effect and payment; uncertain restoration keeps its payment for review", async () => {
  let a = actor();
  combatFor(a);
  postFailure = "after";
  await defend(a);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.defenseBoost.rounds, 3);
  assert.equal(posts.length, 1);
  a = actor();
  combatFor(a);
  postFailure = "before";
  a.fail.defenseRollbackBefore = true;
  await assert.rejects(defend(a), /safely restored/);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.defenseBoost.rounds, 3);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
});
test("Defense is a free action: no-action states, sleep, negative wounds and a forfeited Refresh round cannot declare it", async () => {
  for (const condition of ["unconscious", "stunned", "dazed", "dead", "sleeping"]) {
    const a = actor();
    combatFor(a);
    a.system.conditionContext = { [condition]: true };
    assert.equal(await defend(a), false, condition);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  }
  let a = actor();
  combatFor(a);
  a.system.wounds.value = -1;
  assert.equal(await defend(a), false);
  a = actor();
  const c = combatFor(a);
  await a.refreshWithActionDie({ phase: "start", forfeitActions: true });
  assert.equal(await defend(a), false);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(c.round, 1);
});
test("Defense declarations cannot drift into another round while their dialog is open", async () => {
  const a = actor(),
    c = combatFor(a),
    old = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    c.round = 2;
    return { atStartOfRound: true, bonusPoolId: "mp" };
  };
  try {
    await assert.rejects(a.boostDefenseWithActionDie(), /earlier combat round/);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.system.defenseBoost, undefined);
  } finally {
    foundry.applications.api.DialogV2.input = old;
  }
});
test("a new settlement review replaces old resolved metadata rather than inheriting a former grant-review decision", async () => {
  const a = actor();
  a.flags.spycraft2 = {
    actionDiceSettlementReview: {
      needsReview: false,
      grantReview: true,
      settledBalance: 4,
      resolution: "old",
      obsolete: { remove: true }
    }
  };
  await a.markActionDiceSettlementReview(
    {
      count: 1,
      balance: 4,
      paymentPath: "system.bonusActionDice.mp.remaining",
      bonusPoolId: "mp",
      die: 4,
      label: "Master Plan",
      poolFingerprint: actionDicePoolFingerprint(a.system.bonusActionDice.mp)
    },
    Error("new failure"),
    { purpose: "payment refund" }
  );
  const r = a.flags.spycraft2.actionDiceSettlementReview;
  assert.equal(r.needsReview, true);
  for (const key of ["grantReview", "settledBalance", "resolution", "obsolete"])
    assert.equal(Object.hasOwn(r, key), false, key);
});

const criticalOptions = {
  kind: "success",
  baseCost: 1,
  effect: "Confirmed critical effect",
  effectConfirmed: true,
  beforeDamage: true,
  bonusPoolId: "mp"
};
function criticalMessage(a, { failure = false, fail = null } = {}) {
  const m = {
    uuid: "ChatMessage.typedCritical",
    flags: {
      spycraft2: {
        actorUuid: a.uuid,
        checkKind: "attack",
        weaponProficiency: "rifle",
        threatConfirmed: !failure,
        errorConfirmed: failure,
        rawTotal: 30,
        effectiveTotal: 30,
        naturalDie: 20
      }
    }
  };
  m.update = async patch => {
    if (fail === "before") throw Error("critical post failed");
    if (patch["flags.spycraft2"]) m.flags.spycraft2 = clone(patch["flags.spycraft2"]);
    if (fail === "after") throw Error("critical post committed then failed");
  };
  a.syncRollErrorEffect = async () => null;
  return m;
}
test("own critical activation spends only the selected unrestricted grant and records one typed receipt", async () => {
  const a = actor(),
    m = criticalMessage(a);
  await a.activateCritical(m, criticalOptions);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.deepEqual(m.flags.spycraft2.criticalActivation.funding, { bonusPoolId: "mp", die: 4, count: 1 });
  assert.ok(m.flags.spycraft2.criticalActivation.paymentReceiptId);
  await a.activateCritical(m, criticalOptions);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
});
test("opponent critical-failure funding charges its own grant, preserves both ordinary balances and avoids nested-queue deadlock", async () => {
  const a = actor(),
    b = new SpycraftActor();
  b.uuid = "Actor.opponent";
  const m = criticalMessage(a, { failure: true });
  await a.activateCritical(m, { ...criticalOptions, kind: "failure", payer: b, opponent: true, lineOfSight: true });
  assert.equal(b.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(b.system.actionDice.value, 0);
  assert.equal(m.flags.spycraft2.criticalActivation.payerUuid, b.uuid);
});
test("free critical activation requires no balance, valid grant or payment and does not consume expired dice", async () => {
  const a = actor(),
    m = criticalMessage(a);
  a.system.weaponSpecialist = { proficiencies: ["rifle"], abilities: ["Most Deadly"] };
  periods.scene = "newScene";
  await a.activateCritical(m, criticalOptions);
  assert.equal(m.flags.spycraft2.criticalSuccess, true);
  assert.equal(m.flags.spycraft2.criticalActivation.cost, 0);
  assert.equal(m.flags.spycraft2.criticalActivation.funding, null);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.system.actionDice.value, 0);
});
test("paid criticals reject expired, check-bound, insufficient and mismatched-payer funding without an activation", async () => {
  for (const variant of ["expired", "bound", "insufficient", "wrongPayer"]) {
    const a = actor(),
      m = criticalMessage(a);
    let opts = { ...criticalOptions };
    if (variant === "expired") periods.scene = "new";
    if (variant === "bound") a.system.bonusActionDice.mp.source = "iKnowWhatDoing";
    if (variant === "insufficient") {
      opts.baseCost = 4;
      a.system.bonusActionDice.mp.remaining = 1;
    }
    if (variant === "wrongPayer") opts.funding = "Actor.someoneElse|mp";
    assert.ok([false, null].includes(await a.activateCritical(m, opts)), variant);
    assert.equal(a.system.bonusActionDice.mp.remaining, variant === "insufficient" ? 1 : 4);
    assert.equal(m.flags.spycraft2.criticalSuccess, undefined);
  }
});
test("failed critical receipt refunds the exact selected grant while a committed receipt keeps exactly one payment", async () => {
  for (const fail of ["before", "after"]) {
    const a = actor(),
      m = criticalMessage(a, { fail });
    if (fail === "before") await assert.rejects(a.activateCritical(m, criticalOptions), /post failed/);
    else await a.activateCritical(m, criticalOptions);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(m.flags.spycraft2.criticalSuccess, fail === "before" ? undefined : true);
  }
});
test("an unprovable critical refund retains reserved funds and a durable review, blocking another paid activation", async () => {
  const a = actor(),
    m = criticalMessage(a, { fail: "before" });
  a.fail.refundBefore = true;
  await assert.rejects(a.activateCritical(m, criticalOptions), /balance needs review/);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  const next = criticalMessage(a);
  assert.equal(await a.activateCritical(next, criticalOptions), null);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(next.flags.spycraft2.criticalSuccess, undefined);
});

const rerollSpec = {
  id: "meticulous",
  name: "Meticulous",
  workflow: "reroll",
  skill: "analysis",
  focuses: [],
  period: "scene",
  limit: 1,
  cost: 1
};
function rerollActor() {
  const a = actor();
  a.system.limitedUses = [rerollSpec];
  a.system.resourceUses = {};
  return a;
}
function rerollMessage(a, { fail = null } = {}) {
  const m = {
    uuid: "ChatMessage.failedCheck",
    flags: {
      spycraft2: {
        actorUuid: a.uuid,
        formula: "1d20 + @total",
        rollData: { total: 4 },
        checkKind: "skill",
        skillKey: "analysis",
        checkId: "examination",
        checkMethod: "roll",
        rawTotal: 8,
        effectiveTotal: 8,
        naturalDie: 4,
        error: 1,
        threat: 20,
        cap: 30,
        successConfirmed: false
      }
    }
  };
  m.update = async patch => {
    if (fail === "before") throw Error("original receipt failed");
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = m;
      for (const key of keys.slice(0, -1)) o = o[key] ??= {};
      o[keys.at(-1)] = clone(value);
    }
    if (fail === "after") throw Error("original receipt committed then failed");
  };
  return m;
}
const rerollOptions = { resource: "meticulous", failed: true, bonusPoolId: "mp" };
test("limited-use payment combines costs from one selected grant and passes its typed funding without altering ordinary dice", async () => {
  const a = rerollActor();
  a.system.limitedUses.push({ id: "extra", name: "Extra", workflow: "extra", period: "scene", limit: 1, cost: 1 });
  await a.useLimitedAbility(
    "meticulous",
    async (status, payment) => {
      assert.equal(status.id, "meticulous");
      assert.equal(payment.count, 3);
      assert.equal(payment.die, 4);
      assert.equal(a.system.bonusActionDice.mp.remaining, 1);
    },
    { workflow: "reroll", additionalCost: 1, additionalUses: [{ id: "extra", workflow: "extra" }], bonusPoolId: "mp" }
  );
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.meticulous.used, 1);
  assert.equal(a.system.resourceUses.extra.used, 1);
});
test("failed limited-use work restores both counters and selected funds; a committed counter reservation error cannot consume a use", async () => {
  const a = rerollActor();
  await assert.rejects(
    a.useLimitedAbility(
      "meticulous",
      async () => {
        throw Error("work failed");
      },
      { workflow: "reroll", bonusPoolId: "mp" }
    ),
    /work failed/
  );
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.system.resourceUses.meticulous, undefined);
  const b = rerollActor(),
    update = b.update.bind(b);
  let once = true;
  b.update = async patch => {
    await update(patch);
    if (once && patch["system.resourceUses.meticulous"]) {
      once = false;
      throw Error("counter committed then failed");
    }
  };
  await assert.rejects(
    b.useLimitedAbility(
      "meticulous",
      async () => {
        throw Error("must not run");
      },
      { workflow: "reroll", bonusPoolId: "mp" }
    ),
    /counter committed/
  );
  assert.equal(b.system.resourceUses.meticulous, undefined);
  assert.equal(b.system.bonusActionDice.mp.remaining, 4);
});
test("class reroll uses the selected grant once and freezes typed funding on its replacement", async () => {
  const a = rerollActor(),
    m = rerollMessage(a),
    replacement = await a.rerollCheck(m, rerollOptions);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.meticulous.used, 1);
  assert.equal(m.flags.spycraft2.resolved, true);
  assert.equal(m.flags.spycraft2.superseded, replacement.id);
  assert.equal(replacement.flags.spycraft2.rerollFunding.bonusPoolId, "mp");
  assert.equal(replacement.flags.spycraft2.rerollFunding.die, 4);
  assert.equal(replacement.flags.spycraft2.rerollFunding.count, 1);
  assert.ok(replacement.flags.spycraft2.rerollFunding.id);
  assert.equal(replacement.flags.spycraft2.rerollOf, m.uuid);
  assert.ok(replacement.flags.spycraft2.rerollReceiptId);
});
test("replacement-post failure refunds use/payment before commit and recovers a committed replacement without rerolling", async () => {
  for (const fail of ["before", "after"]) {
    const a = rerollActor(),
      m = rerollMessage(a);
    postFailure = fail;
    if (fail === "before") await assert.rejects(a.rerollCheck(m, rerollOptions), /post failed/);
    else await a.rerollCheck(m, rerollOptions);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(a.system.resourceUses.meticulous?.used, fail === "before" ? undefined : 1);
    assert.equal(formulas.length, 1);
    assert.equal(m.flags.spycraft2.resolved, fail === "before" ? undefined : true);
  }
});
test("original-result receipt failure deletes the replacement and refunds, while a committed supersession retains both result and one payment", async () => {
  for (const fail of ["before", "after"]) {
    const a = rerollActor(),
      m = rerollMessage(a, { fail });
    if (fail === "before") await assert.rejects(a.rerollCheck(m, rerollOptions), /original receipt failed/);
    else await a.rerollCheck(m, rerollOptions);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(a.system.resourceUses.meticulous?.used, fail === "before" ? undefined : 1);
    assert.equal(game.messages.length, fail === "before" ? 0 : 1);
  }
});
test("uncertain reroll refund preserves its spent use and blocks subsequent paid use until GC review", async () => {
  const a = rerollActor(),
    m = rerollMessage(a, { fail: "before" });
  a.fail.refundBefore = true;
  await assert.rejects(a.rerollCheck(m, rerollOptions), /balance needs review/);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.resourceUses.meticulous.used, 1);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
});

test("GC review can restore a held reroll use with its selected funds only after attesting no replacement effect remains", async () => {
  const a = rerollActor(),
    m = rerollMessage(a, { fail: "before" });
  a.fail.refundBefore = true;
  await assert.rejects(a.rerollCheck(m, rerollOptions));
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.limitedUseSettlement[0].id, "meticulous");
  await a.reviewActionDiceSettlement({
    balance: 4,
    restoreLimitedUses: true,
    resolution: "No replacement retained; restored use and die",
    healthReviewed: true
  });
  assert.equal(a.system.resourceUses.meticulous, undefined);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.limitedUsesRestored, true);
});
test("GC use restoration rejects newer counts and edited source paths rather than overwriting them", async () => {
  for (const variant of ["count", "path"]) {
    const a = rerollActor(),
      m = rerollMessage(a, { fail: "before" });
    a.fail.refundBefore = true;
    await assert.rejects(a.rerollCheck(m, rerollOptions));
    if (variant === "count") a.system.resourceUses.meticulous.used = 2;
    else a.flags.spycraft2.actionDiceSettlementReview.limitedUseSettlement[0].id = "ownership.default";
    await assert.rejects(
      a.reviewActionDiceSettlement({
        balance: 4,
        restoreLimitedUses: true,
        resolution: "Review",
        healthReviewed: true
      }),
      /source changed|restoration is invalid/
    );
    assert.equal(a.system.bonusActionDice.mp.remaining, 3);
    assert.equal(a.ownership, undefined);
  }
});

import { eagleEyeState } from "../module/rules/sniper.mjs";
function eagleActor() {
  const a = actor();
  a.system.coreClassIds = ["sniper"];
  a.system.limitedUses = [
    { id: "eagleEye", name: "Eagle Eye", period: "scene", workflow: "eagleEye", cost: 1, limit: 1 }
  ];
  a.system.resourceUses = {};
  return a;
}
test("Eagle Eye rolls the selected d4 and exact explosion/bonus rather than a career d8, freezing range, funding and scene", async () => {
  const a = eagleActor(),
    r = await a.useEagleEye({ bonusPoolId: "mp" });
  assert.equal(r.die, 4);
  assert.equal(r.explodeAt, 3);
  assert.equal(r.result, 3);
  assert.equal(r.rangeIncrease, 30);
  assert.equal(r.funding.bonusPoolId, "mp");
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
  assert.equal(eagleEyeState(a.system).active, true);
  assert.equal(await a.useEagleEye({ bonusPoolId: "mp" }), null);
  assert.equal(formulas.length, 1);
  periods.scene = "other";
  assert.equal(eagleEyeState(a.system).active, false);
});
test("Eagle Eye receipt failure restores the exact previous modifier and selected funds, while committed posts keep one payment/use", async () => {
  for (const fail of ["before", "after"]) {
    const a = eagleActor(),
      before = {
        source: "eagleEye",
        scene: "old",
        die: 8,
        explodeAt: 8,
        bonus: 0,
        rolled: 2,
        result: 2,
        rangeIncrease: 20,
        custom: { keep: 1 }
      };
    a.system.eagleEyeBoost = clone(before);
    postFailure = fail;
    if (fail === "before") {
      await assert.rejects(a.useEagleEye({ bonusPoolId: "mp" }), /post failed/);
      assert.deepEqual(a.system.eagleEyeBoost, before);
    } else await a.useEagleEye({ bonusPoolId: "mp" });
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(a.system.resourceUses.eagleEye?.used, fail === "before" ? undefined : 1);
  }
});
test("source, scene and no-action changes while the die rolls cannot leave an Eagle Eye effect or charge", async () => {
  for (const change of ["source", "scene", "sleep"]) {
    const a = eagleActor();
    rollHook = () => {
      if (change === "source") a.system.coreClassIds = [];
      if (change === "scene") periods.scene = "changed";
      if (change === "sleep") a.system.conditionContext.sleeping = true;
    };
    await assert.rejects(a.useEagleEye({ bonusPoolId: "mp" }));
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.system.eagleEyeBoost, undefined);
    assert.equal(a.system.resourceUses.eagleEye, undefined);
  }
});
test("Eagle Eye uncertain effect rollback holds its paid die/use and preserves the actual range effect for reviewed settlement", async () => {
  const a = eagleActor(),
    update = a.update.bind(a);
  a.update = async patch => {
    if (patch["system.eagleEyeBoost"] === null) throw Error("restore failed");
    return update(patch);
  };
  postFailure = "before";
  await assert.rejects(a.useEagleEye({ bonusPoolId: "mp" }), /safely restored/);
  assert.equal(a.system.eagleEyeBoost.rangeIncrease, 30);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  await a.reviewActionDiceSettlement({
    balance: 3,
    healthReviewed: true,
    resolution: "Verified and retained actual range effect, die and use"
  });
  assert.equal(a.system.eagleEyeBoost.rangeIncrease, 30);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
});

function hailActor(key = "analysis") {
  const a = actor();
  a.items = [];
  a.system.skillTotals = {
    [key]: {
      key,
      name: key,
      ranks: 0,
      cap: 15,
      focus: false,
      totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 2 })),
      threat: 20,
      bonusEntries: []
    }
  };
  return a;
}
const hailOptions = {
  check: "appraise",
  gearStatus: "available",
  synergySkill: "none",
  hailMaryUntrained: true,
  bonusPoolId: "mp"
};
test("Hail Mary prepays its exact cost from the selected grant without creating a compulsory pool object", async () => {
  const a = hailActor(),
    m = await a.rollSkill("analysis", undefined, hailOptions);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(m.flags.spycraft2.requiredBonusPoolId, null);
  assert.deepEqual(m.flags.spycraft2.hailMary, { untrained: true, uncap: false, active: false, cost: 1 });
  assert.equal(m.flags.spycraft2.preRollFunding.bonusPoolId, "mp");
  assert.equal(m.flags.spycraft2.preRollFunding.count, 1);
  assert.ok(m.flags.spycraft2.preRollFunding.id);
});
test("ordinary Hail Mary payment remains ordinary and its payment callback never leaks into a check-bound identifier", async () => {
  const a = hailActor();
  a.system.actionDice.value = 2;
  const m = await a.rollSkill("analysis", undefined, { ...hailOptions, bonusPoolId: "" });
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(m.flags.spycraft2.requiredBonusPoolId, null);
  assert.equal(m.flags.spycraft2.preRollFunding.bonusPoolId, "");
  assert.equal(m.flags.spycraft2.preRollFunding.die, 8);
});
test("all Hail Mary benefits charge their combined count once, retaining cap removal and active conversion", async () => {
  for (const variant of ["uncap", "active", "combined"]) {
    const key = variant === "uncap" ? "analysis" : "blend",
      a = hailActor(key),
      options = {
        check: cfg.skills[key].checks[0].id,
        gearStatus: "available",
        synergySkill: "none",
        bonusPoolId: "mp",
        hailMaryUncap: variant !== "active",
        hailMaryActive: variant !== "uncap",
        hailMaryUntrained: variant === "combined"
      },
      cost = variant === "uncap" ? 3 : variant === "active" ? 4 : 8;
    if (cost > 4) {
      a.system.abilities.int.mod = 8;
      delete a.system.bonusActionDice.mp;
      a.system.bonusActionDice.mp = masterPlanPool(a.system, masterPlanGainPlan(a.system), { id: "mp" });
    }
    const before = a.system.bonusActionDice.mp.remaining,
      m = await a.rollSkill(key, undefined, options);
    assert.equal(a.system.bonusActionDice.mp.remaining, before - cost);
    assert.equal(m.flags.spycraft2.preRollFunding.count, cost);
    if (options.hailMaryUncap) assert.equal(m.flags.spycraft2.cap, null);
    if (options.hailMaryActive) {
      assert.equal(m.flags.spycraft2.actionDiceAllowed, true);
      assert.notEqual(m.flags.spycraft2.rollMode, "blindroll");
    }
  }
});
test("Hail Mary with Cunning Plan shares one typed payment and one correct scene use", async () => {
  const a = hailActor();
  a.system.limitedUses = [
    { id: "cunningPlan", name: "Cunning Plan", period: "scene", workflow: "cunningPlan", cost: 0, limit: 1 }
  ];
  a.system.resourceUses = {};
  const m = await a.rollSkill("analysis", undefined, { ...hailOptions, cunningPlan: true });
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.resourceUses.cunningPlan.used, 1);
  assert.equal(m.flags.spycraft2.preRollFunding.count, 1);
  assert.equal(m.flags.spycraft2.requiredBonusPoolId, null);
});
test("Hail Mary with declared natural 20 funds its recursive class activation exactly once", async () => {
  const a = hailActor("athletics");
  a.system.classLevels.soldier = 14;
  a.system.limitedUses = [
    { id: "oneInAMillion", name: "One in a Million", period: "session", workflow: "oneInAMillion", cost: 0, limit: 1 }
  ];
  a.system.resourceUses = {};
  const m = await a.rollSkill("athletics", undefined, { ...hailOptions, check: "smash", oneInAMillion: true });
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.resourceUses.oneInAMillion.used, 1);
  assert.equal(m.flags.spycraft2.oneInAMillion, true);
  assert.equal(m.flags.spycraft2.naturalDie, 20);
  assert.equal(m.flags.spycraft2.preRollFunding.count, 1);
});
test("Hail Mary result-post failures refund before commit and keep a committed result/payment without a second roll", async () => {
  for (const fail of ["before", "after"]) {
    const a = hailActor();
    postFailure = fail;
    if (fail === "before") await assert.rejects(a.rollSkill("analysis", undefined, hailOptions), /post failed/);
    else await a.rollSkill("analysis", undefined, hailOptions);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(formulas.length, 1);
    assert.equal(game.messages.length, fail === "before" ? 0 : 1);
  }
});

function generousFixture({ fail = null } = {}) {
  const target = actor(),
    donor = new SpycraftActor();
  target.uuid = "Actor.target";
  donor.uuid = "Actor.donor";
  donor.system.coreClassIds = ["pointman"];
  target.syncRollErrorEffect = async () => null;
  const m = {
    uuid: "ChatMessage.donation",
    flags: {
      spycraft2: {
        actorUuid: target.uuid,
        checkKind: "skill",
        checkMethod: "roll",
        rawTotal: 12,
        effectiveTotal: 12,
        naturalDie: 10,
        cap: 30,
        actionDiceAllowed: true,
        boostTotal: 0,
        boostSpent: 0
      }
    }
  };
  m.update = async patch => {
    if (fail === "before") throw Error("donation receipt failed");
    m.flags.spycraft2 = clone(patch["flags.spycraft2"]);
    if (fail === "after") throw Error("donation receipt committed then failed");
  };
  return { target, donor, m, opts: { donor, teammate: true, perceivedAtRoll: true, bonusPoolId: "mp" } };
}
test("Generous rolls one selected donor d4 with donor modifiers and charges only that typed grant", async () => {
  const { target, donor, m, opts } = generousFixture();
  await target.boostWithGenerous(m, opts);
  assert.match(formulas[0], /^1d4x>=3$/);
  assert.equal(donor.system.bonusActionDice.mp.remaining, 3);
  assert.equal(target.system.bonusActionDice.mp.remaining, 4);
  assert.equal(donor.system.actionDice.value, 0);
  assert.equal(target.system.actionDice.value, 0);
  assert.equal(m.flags.spycraft2.generousBoost.die, 4);
  assert.equal(m.flags.spycraft2.generousBoost.bonusEach, 1);
  assert.equal(m.flags.spycraft2.generousBoost.funding.bonusPoolId, "mp");
  assert.ok(m.flags.spycraft2.generousBoost.paymentReceiptId);
  assert.equal(m.flags.spycraft2.boostTotal, 3);
  await target.boostWithGenerous(m, opts);
  assert.equal(donor.system.bonusActionDice.mp.remaining, 3);
  assert.equal(formulas.length, 1);
});
test("Generous can spend the last typed die but cannot donate a target’s grant or a check-bound source", async () => {
  let f = generousFixture();
  f.donor.system.bonusActionDice.mp.remaining = 1;
  await f.target.boostWithGenerous(f.m, f.opts);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 0);
  for (const invalid of ["owner", "bound", "expired", "passive"]) {
    f = generousFixture();
    if (invalid === "owner") f.opts.funding = "Actor.target|mp";
    if (invalid === "bound") f.donor.system.bonusActionDice.mp.source = "iKnowWhatDoing";
    if (invalid === "expired") periods.scene = "new";
    if (invalid === "passive") f.m.flags.spycraft2.actionDiceAllowed = false;
    assert.ok([false, null].includes(await f.target.boostWithGenerous(f.m, f.opts)), invalid);
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
  }
});
test("Generous refunds a rejected target receipt and retains exactly one donor payment after a committed receipt error", async () => {
  for (const fail of ["before", "after"]) {
    const f = generousFixture({ fail });
    if (fail === "before") await assert.rejects(f.target.boostWithGenerous(f.m, f.opts), /donation receipt failed/);
    else await f.target.boostWithGenerous(f.m, f.opts);
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(f.m.flags.spycraft2.generousBoost?.die, fail === "before" ? undefined : 4);
  }
});
test("a target result change or donor source expiry during the roll preserves the newer result and refunds the donor", async () => {
  for (const change of ["target", "expiry", "core"]) {
    const f = generousFixture();
    rollHook = () => {
      if (change === "target") f.m.flags.spycraft2.rawTotal = 15;
      if (change === "expiry") periods.scene = "new";
      if (change === "core") f.donor.system.coreClassIds = [];
    };
    await assert.rejects(f.target.boostWithGenerous(f.m, f.opts));
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
    assert.equal(f.m.flags.spycraft2.generousBoost, undefined);
    if (change === "target") assert.equal(f.m.flags.spycraft2.rawTotal, 15);
  }
});

function boostMessage(a, { fail = null, kind = "skill" } = {}) {
  const m = {
    uuid: "ChatMessage.boost",
    id: "boost",
    flags: {
      spycraft2: {
        actorUuid: a.uuid,
        checkKind: kind,
        checkMethod: "roll",
        skillKey: "athletics",
        checkId: "smash",
        ability: "str",
        rawTotal: 12,
        effectiveTotal: 12,
        naturalDie: 10,
        cap: 30,
        threat: 20,
        error: 1,
        actionDiceAllowed: true,
        boostSpent: 0,
        boostTotal: 0
      }
    }
  };
  m.update = async patch => {
    if (fail === "before") throw Error("boost receipt failed");
    m.flags.spycraft2 = clone(patch["flags.spycraft2"]);
    if (fail === "after") throw Error("boost receipt committed then failed");
  };
  a.syncRollErrorEffect = async () => null;
  return m;
}
test("ordinary and typed boosts keep exactly one payment when their target receipt commits before an error", async () => {
  for (const typed of [false, true]) {
    const a = actor();
    a.system.actionDice.value = 2;
    const m = boostMessage(a, { fail: "after" });
    await a.boostCheck(m, { bonusPoolId: typed ? "mp" : "", count: 1 });
    assert.equal(m.flags.spycraft2.boostSpent, 1);
    assert.ok(m.flags.spycraft2.lastBoostPayment.id);
    assert.equal(a.system.actionDice.value, typed ? 2 : 1);
    assert.equal(a.system.bonusActionDice.mp.remaining, typed ? 3 : 4);
    assert.equal(m.flags.spycraft2.lastBoostPayment.bonusPoolId, typed ? "mp" : "");
  }
});
test("failed boost reservation before/after commit applies no result and restores its exact selected source", async () => {
  for (const boundary of ["Before", "After"]) {
    const a = actor(),
      m = boostMessage(a);
    a.fail["reservation" + boundary] = true;
    await assert.rejects(a.boostCheck(m, { bonusPoolId: "mp", count: 1 }));
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(m.flags.spycraft2.boostSpent, 0);
    assert.equal(m.flags.spycraft2.lastBoostPayment, undefined);
  }
});
test("a failed boost receipt refunds while an unprovable refund keeps the debit and a related-check review", async () => {
  for (const failure of [false, true]) {
    const a = actor(),
      m = boostMessage(a, { fail: "before" });
    if (failure) a.fail.refundBefore = true;
    await assert.rejects(a.boostCheck(m, { bonusPoolId: "mp", count: 1 }));
    assert.equal(a.system.bonusActionDice.mp.remaining, failure ? 3 : 4);
    assert.equal(m.flags.spycraft2.boostSpent, 0);
    if (failure) {
      assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
      assert.equal(a.flags.spycraft2.actionDiceSettlementReview.messageUuid, m.uuid);
    }
  }
});
test("boost preparation rejects changed cap, ability, binding or roll data without overwriting the newer evidence", async () => {
  for (const field of ["cap", "ability", "requiredBonusPoolId", "rollData"]) {
    const a = actor(),
      m = boostMessage(a);
    rollHook = () => {
      m.flags.spycraft2[field] = field === "cap" ? 40 : field === "rollData" ? { total: 9 } : "changed";
    };
    await assert.rejects(a.boostCheck(m, { bonusPoolId: "mp", count: 1 }), /result changed/);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(m.flags.spycraft2.boostSpent, 0);
  }
});
test("check-bound compulsory boost receipts are recovered without refunding their spent die or losing the compulsory-spent flag", async () => {
  for (const fail of ["before", "after"]) {
    const a = actor(),
      m = boostMessage(a, { fail });
    m.flags.spycraft2.requiredBonusPoolId = "bound";
    m.flags.spycraft2.actionDiceAllowed = false;
    a.system.bonusActionDice.bound = {
      id: "bound",
      source: "iKnowWhatDoing",
      label: "Compulsory",
      die: 10,
      granted: 1,
      remaining: 1,
      mandatory: true,
      messageUuid: m.uuid,
      originalMessageUuid: m.uuid,
      skillKey: "athletics",
      ability: "str",
      scene: periods.scene,
      session: periods.session
    };
    if (fail === "before") await assert.rejects(a.boostCheck(m, { bonusPoolId: "bound", count: 1 }), /receipt failed/);
    else await a.boostCheck(m, { bonusPoolId: "bound", count: 1 });
    assert.equal(a.system.bonusActionDice.bound.remaining, fail === "before" ? 1 : 0);
    assert.equal(m.flags.spycraft2.requiredBonusSpent, fail === "before" ? undefined : true);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.system.actionDice.value, 0);
  }
});
test("refund fingerprints include check-bound ownership and cannot return dice to a grant rebound to a different result", () => {
  const a = actor(),
    pool = {
      id: "bound",
      source: "iKnowWhatDoing",
      die: 10,
      granted: 1,
      remaining: 0,
      mandatory: true,
      messageUuid: "ChatMessage.old",
      skillKey: "athletics",
      ability: "str",
      scene: periods.scene,
      session: periods.session
    };
  a.system.bonusActionDice.bound = pool;
  const payment = {
    count: 1,
    bonusPoolId: "bound",
    paymentPath: "system.bonusActionDice.bound.remaining",
    poolFingerprint: actionDicePoolFingerprint(pool)
  };
  pool.messageUuid = "ChatMessage.new";
  assert.throws(() => actionDicePaymentRefund(a.system, payment), /grant changed/);
  assert.equal(pool.remaining, 0);
});
test("boost settlement review rejects a target check edited while its GC dialog is open", async () => {
  const a = actor(),
    m = boostMessage(a, { fail: "before" });
  a.fail.refundBefore = true;
  await assert.rejects(a.boostCheck(m, { bonusPoolId: "mp", count: 1 }));
  game.messages = [m];
  game.messages.get = id => game.messages.find(m => m.id === id);
  const original = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    m.flags.spycraft2.cap = 40;
    return { balance: 4, resolution: "Review", healthReviewed: true };
  };
  try {
    await assert.rejects(a.reviewActionDiceSettlement(), /changed/);
    assert.equal(a.system.bonusActionDice.mp.remaining, 3);
    assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  } finally {
    foundry.applications.api.DialogV2.input = original;
  }
});

test("standalone action-die posts refund before commitment and keep exactly one payment when the roll receipt committed", async () => {
  for (const typed of [false, true])
    for (const fail of ["before", "after"]) {
      const a = actor();
      a.system.actionDice.value = 1;
      postFailure = fail;
      if (fail === "before") await assert.rejects(a.rollActionDie({ bonusPoolId: typed ? "mp" : "" }), /post failed/);
      else {
        const m = await a.rollActionDie({ bonusPoolId: typed ? "mp" : "" });
        assert.ok(m.flags.spycraft2.actionDieReceiptId);
      }
      assert.equal(a.system.bonusActionDice.mp.remaining, typed && fail === "after" ? 3 : 4);
      assert.equal(a.system.actionDice.value, !typed && fail === "after" ? 0 : 1);
      assert.equal(formulas.length, 1);
    }
});

test("Shaken II charges a boost surcharge once per check, identically for batched and sequential dice", async () => {
  const results = [];
  for (const sequential of [false, true]) {
    const a = actor(),
      m = boostMessage(a);
    a.system.conditionContext.shakenGrade = 2;
    a.system.actionDice.value = 5;
    if (sequential) {
      await a.boostCheck(m, { count: 1 });
      assert.equal(a.system.actionDice.value, 3);
      await a.boostCheck(m, { count: 1 });
    } else await a.boostCheck(m, { count: 2 });
    results.push({
      dice: a.system.actionDice.value,
      spent: m.flags.spycraft2.boostSpent,
      total: m.flags.spycraft2.boostTotal,
      rolled: formulas.reduce((n, f) => n + (f.match(/1d/g) ?? []).length, 0)
    });
    assert.equal(m.flags.spycraft2.lastBoostPayment.surcharge, sequential ? 0 : 1);
  }
  assert.deepEqual(results, [
    { dice: 2, spent: 2, total: 6, rolled: 2 },
    { dice: 2, spent: 2, total: 6, rolled: 2 }
  ]);
});
test("Shaken III fee dice never increase core doubled rolls or consume the damage boost allowance", async () => {
  const a = actor(),
    m = boostMessage(a, { kind: "damage" });
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 3;
  a.system.coreClassIds = ["brawler"];
  m.flags.spycraft2.unarmed = true;
  await a.boostCheck(m, { count: 1 });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(m.flags.spycraft2.boostSpent, 1);
  assert.equal(m.flags.spycraft2.lastBoostPayment.totalCost, 3);
  assert.equal(m.flags.spycraft2.lastBoostDice.length, 2);
  assert.equal(m.flags.spycraft2.boostTotal, 6);
  assert.equal(formulas[0].match(/1d/g).length, 2);
  assert.equal(await a.boostCheck(m, { count: 1 }), null);
});
test("a compulsory boost uses its bound d10 and pays its Shaken III fee with ordinary dice", async () => {
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 2;
  m.flags.spycraft2.requiredBonusPoolId = "bound";
  m.flags.spycraft2.actionDiceAllowed = false;
  a.system.bonusActionDice.bound = {
    id: "bound",
    source: "iKnowWhatDoing",
    label: "Compulsory",
    die: 10,
    granted: 1,
    remaining: 1,
    mandatory: true,
    messageUuid: m.uuid,
    originalMessageUuid: m.uuid,
    skillKey: "athletics",
    ability: "str",
    scene: periods.scene,
    session: periods.session
  };
  await a.boostCheck(m, { bonusPoolId: "bound", count: 1 });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.bound.remaining, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(m.flags.spycraft2.requiredBonusSpent, true);
  assert.match(formulas[0], /^1d10/);
  assert.equal(m.flags.spycraft2.lastBoostDice.length, 1);
});
test("boost and fee may use different unrestricted wallets, and insufficient combined funds are rejected before rolling", async () => {
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 1;
  await a.boostCheck(m, { count: 1, surchargeBonusPoolId: "mp" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(m.flags.spycraft2.lastBoostDice.length, 1);
  const b = actor(),
    n = boostMessage(b);
  b.system.conditionContext.shakenGrade = 3;
  b.system.actionDice.value = 2;
  await assert.rejects(b.boostCheck(n, { count: 1 }), /Not enough/);
  assert.equal(formulas.length, 0);
  assert.equal(b.system.actionDice.value, 2);
});
test("an increased Shaken grade pays only the new fee difference; a lower grade never refunds an earlier surcharge", async () => {
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  a.system.actionDice.value = 8;
  await a.boostCheck(m, { count: 1 });
  a.system.conditionContext.shakenGrade = 3;
  await a.boostCheck(m, { count: 1 });
  assert.equal(m.flags.spycraft2.lastBoostPayment.surcharge, 1);
  a.system.conditionContext.shakenGrade = 2;
  await a.boostCheck(m, { count: 1 });
  assert.equal(m.flags.spycraft2.lastBoostPayment.surcharge, 0);
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(m.flags.spycraft2.boostSpent, 3);
});
test("the surcharge ledger survives a fresh actor instance and ignores unsupported roll counters", async () => {
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  a.system.actionDice.value = 5;
  await a.boostCheck(m, { count: 1 });
  const b = actor();
  b.system = clone(a.system);
  b.flags = clone(a.flags);
  b.uuid = a.uuid;
  b.syncRollErrorEffect = async () => null;
  m.flags.spycraft2.boostSurchargePaid = 999;
  await b.boostCheck(m, { count: 1 });
  assert.equal(b.system.actionDice.value, 2);
  assert.equal(m.flags.spycraft2.lastBoostPayment.surcharge, 0);
});
test("a failed Shaken boost receipt refunds both sources; a committed receipt keeps exactly one payment", async () => {
  for (const fail of ["before", "after"]) {
    const a = actor(),
      m = boostMessage(a, { fail });
    a.system.conditionContext.shakenGrade = 3;
    a.system.actionDice.value = 1;
    if (fail === "before")
      await assert.rejects(a.boostCheck(m, { count: 1, surchargeBonusPoolId: "mp" }), /receipt failed/);
    else await a.boostCheck(m, { count: 1, surchargeBonusPoolId: "mp" });
    assert.equal(a.system.actionDice.value, fail === "before" ? 1 : 0);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 2);
    assert.equal(m.flags.spycraft2.boostSpent, fail === "before" ? 0 : 1);
    assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, fail === "before" ? "refunded" : "spent");
  }
});
test("Shaken IV blocks both ordinary and typed boosting before any dice are rolled", async () => {
  for (const bonusPoolId of ["", "mp"]) {
    const a = actor(),
      m = boostMessage(a);
    a.system.conditionContext.shakenGrade = 4;
    a.system.actionDice.value = 5;
    assert.equal(await a.boostCheck(m, { count: 1, bonusPoolId }), null);
    assert.equal(formulas.length, 0);
    assert.equal(a.system.actionDice.value, 5);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  }
});
test("Shaken boosts reject condition or surcharge-wallet changes during dice evaluation without spending", async () => {
  for (const change of ["grade", "wallet"]) {
    const a = actor(),
      m = boostMessage(a);
    a.system.conditionContext.shakenGrade = 2;
    a.system.actionDice.value = 2;
    rollHook = () => {
      if (change === "grade") a.system.conditionContext.shakenGrade = 3;
      else a.system.bonusActionDice.mp.remaining--;
    };
    await assert.rejects(a.boostCheck(m, { count: 1, surchargeBonusPoolId: "mp" }), /changed/);
    assert.equal(a.system.actionDice.value, 2);
    assert.equal(m.flags.spycraft2.boostSpent, 0);
  }
});
test("distinct checks each owe their own surcharge, while malformed prior payment evidence blocks a repeat", async () => {
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  a.system.actionDice.value = 5;
  await a.boostCheck(m, { count: 1 });
  const n = boostMessage(a);
  n.uuid = "ChatMessage.other";
  await a.boostCheck(n, { count: 1 });
  assert.equal(a.system.actionDice.value, 1);
  Object.values(a.flags.spycraft2.actionDiePayments)[0].details.surcharge = 2;
  await assert.rejects(a.boostCheck(m, { count: 1 }), /evidence/);
  assert.equal(a.system.actionDice.value, 1);
});
test("clearing and reapplying Shaken preserves the already paid check fee and records each current payment accurately", async () => {
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  a.system.actionDice.value = 6;
  await a.boostCheck(m, { count: 1 });
  a.system.conditionContext.shakenGrade = 0;
  await a.boostCheck(m, { count: 1 });
  assert.equal(m.flags.spycraft2.lastBoostPayment.surcharge, 0);
  assert.equal(m.flags.spycraft2.lastBoostPayment.totalCost, 1);
  assert.equal(m.flags.spycraft2.lastBoostPayment.allocations.length, 1);
  a.system.conditionContext.shakenGrade = 2;
  await a.boostCheck(m, { count: 1 });
  assert.equal(m.flags.spycraft2.lastBoostPayment.surcharge, 0);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(m.flags.spycraft2.boostSpent, 3);
});
test("Shaken IV forbids generic spending and rolls, healing, Refresh, Defense, Eagle Eye and donations without debiting dice or counters", async () => {
  for (const workflow of ["callback", "roll", "heal", "refresh", "defense", "eagleEye", "generous"]) {
    const a = actor();
    a.system.conditionContext.shakenGrade = 4;
    a.system.actionDice.value = 5;
    let called = false;
    if (workflow === "callback")
      assert.equal(
        await a.spendActionDice(
          1,
          async () => {
            called = true;
          },
          { bonusPoolId: "mp" }
        ),
        false
      );
    if (workflow === "roll") assert.equal(await a.rollActionDie({ bonusPoolId: "mp" }), false);
    if (workflow === "heal") assert.equal(await heal(a), false);
    if (workflow === "refresh") {
      a.system.conditionContext.shakenGrade = 0;
      await waitingRefresh(a);
      a.system.conditionContext.shakenGrade = 4;
      assert.equal(await completeRefresh(a), false);
      assert.equal(a.system.refreshAction.state, "waiting");
    }
    if (workflow === "defense") {
      combatFor(a);
      assert.equal(await defend(a), false);
      assert.equal(a.system.defenseBoost, undefined);
    }
    if (workflow === "eagleEye") {
      a.system.coreClassIds = ["sniper"];
      a.system.limitedUses = [
        { id: "eagleEye", name: "Eagle Eye", period: "scene", workflow: "eagleEye", cost: 1, limit: 1 }
      ];
      a.system.resourceUses = {};
      assert.equal(await a.useEagleEye({ bonusPoolId: "mp" }), null);
      assert.equal(a.system.resourceUses.eagleEye, undefined);
      assert.equal(a.system.eagleEyeBoost, undefined);
    }
    if (workflow === "generous") {
      const f = generousFixture();
      f.donor.system.conditionContext.shakenGrade = 4;
      assert.equal(await f.target.boostWithGenerous(f.m, f.opts), null);
      assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
    }
    assert.equal(called, false);
    assert.equal(a.system.actionDice.value, 5, workflow);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4, workflow);
    assert.equal(a.system.vitality.value, 4);
    assert.equal(a.system.wounds.value, 4);
    assert.equal(formulas.length, 0, workflow);
  }
});
test("Shaken IV still permits grants, non-paying funding quotes and refunds", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 4;
  const quote = actionDiceFundingContext(a.actionDiceFundingSystem, { bonusPoolId: "mp" });
  assert.equal(quote.blocked, false);
  const payment = {
    count: 1,
    bonusPoolId: "mp",
    paymentPath: "system.bonusActionDice.mp.remaining",
    poolFingerprint: actionDicePoolFingerprint(a.system.bonusActionDice.mp)
  };
  a.system.bonusActionDice.mp.remaining = 3;
  await a.refundActionDicePayment(payment);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(masterPlanGainPlan(a.system).units, 4);
  assert.equal(actionDicePaymentPlan(a.actionDiceFundingSystem, { count: 1, bonusPoolId: "mp" }).blocked, true);
});
test("the IV ban follows an opponent critical-failure payer while an affected target does not spend that opponent’s dice", async () => {
  for (const affectedPayer of [true, false]) {
    const a = actor(),
      b = new SpycraftActor();
    b.uuid = "Actor.opponent";
    const m = criticalMessage(a, { failure: true });
    (affectedPayer ? b : a).system.conditionContext.shakenGrade = 4;
    await a.activateCritical(m, { ...criticalOptions, kind: "failure", payer: b, opponent: true, lineOfSight: true });
    assert.equal(b.system.bonusActionDice.mp.remaining, affectedPayer ? 4 : 3);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(m.flags.spycraft2.criticalFailure, affectedPayer ? undefined : true);
  }
});
test("Shaken Defense pays one surcharge per activation and rolls only its one benefit die", async () => {
  for (const grade of [2, 3]) {
    const a = actor();
    a.system.conditionContext.shakenGrade = grade;
    combatFor(a);
    const result = await defend(a);
    assert.equal(a.system.bonusActionDice.mp.remaining, grade === 2 ? 2 : 1);
    assert.equal(result.rounds, 3);
    assert.equal(result.funding.count, 1);
    assert.equal(result.funding.surcharge, grade === 2 ? 1 : 2);
    assert.equal(result.funding.totalCost, grade === 2 ? 2 : 3);
    assert.equal(formulas.length, 1);
    assert.equal(formulas[0].match(/1d/g).length, 1);
    assert.match(formulas[0], /^1d4x>=3/);
    assert.equal(posts[0].flags.spycraft2.funding.surcharge, grade === 2 ? 1 : 2);
  }
});
test("Defense retains the primary die while a different wallet pays its surcharge", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  combatFor(a);
  const result = await defend(a, { surchargeBonusPoolId: "" });
  assert.equal(result.funding.die, 4);
  assert.equal(result.rounds, 3);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(result.funding.allocations.length, 2);
  assert.equal(formulas.length, 1);
});
test("Defense rejects insufficient combined funds and a changed condition before payment or duration rolling", async () => {
  let a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 2;
  combatFor(a);
  assert.equal(await defend(a), false);
  assert.equal(formulas.length, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  a = actor();
  a.system.conditionContext.shakenGrade = 2;
  combatFor(a);
  const previous = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    a.system.conditionContext.shakenGrade = 3;
    return { bonusPoolId: "mp", atStartOfRound: true };
  };
  try {
    await assert.rejects(a.boostDefenseWithActionDie(), /Shaken condition changed/);
    assert.equal(formulas.length, 0);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  } finally {
    foundry.applications.api.DialogV2.input = previous;
  }
});
test("a rejected Shaken Defense receipt restores the boost and both balances; a committed post retains them", async () => {
  for (const fail of ["before", "after"]) {
    const a = actor();
    a.system.conditionContext.shakenGrade = 3;
    a.system.bonusActionDice.mp.remaining = 1;
    a.system.actionDice.value = 2;
    combatFor(a);
    postFailure = fail;
    if (fail === "before") await assert.rejects(defend(a, { surchargeBonusPoolId: "" }), /post failed/);
    else await defend(a, { surchargeBonusPoolId: "" });
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 1 : 0);
    assert.equal(a.system.actionDice.value, fail === "before" ? 2 : 0);
    assert.equal(a.system.defenseBoost?.rounds, fail === "before" ? undefined : 3);
  }
});
import { actionDieBenefitQuote } from "../module/rules/benefit-payments.mjs";
test("benefit quotes apply a surcharge after zero base cost and distinguish multiple benefits from multiple benefit dice", () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 4;
  assert.equal(actionDieBenefitQuote(a, { baseCost: 0 }).cost, 2);
  assert.equal(actionDieBenefitQuote(a, { baseCost: 2 }).cost, 4);
  assert.equal(actionDieBenefitQuote(a, { baseCost: 0, benefitCount: 2 }).cost, 4);
  assert.equal(actionDieBenefitQuote(a, { baseCost: 0, benefitCount: 0 }).cost, 0);
});
test("benefit quotes reject missing costs and preserve pending-payment holds even for a waived benefit", () => {
  const a = actor();
  for (const baseCost of [undefined, null, true, -1, 1.5])
    assert.throws(() => actionDieBenefitQuote(a, { baseCost }), /base action-die cost/);
  a.flags.spycraft2 = { actionDiceSettlementReview: { needsReview: true } };
  assert.throws(() => actionDieBenefitQuote(a, { baseCost: 0 }), /interrupted/);
});
test("Generous charges the receiving teammate’s Shaken fee while rolling only the donor die and modifiers", async () => {
  for (const grade of [2, 3]) {
    const f = generousFixture();
    f.target.system.conditionContext.shakenGrade = grade;
    f.target.system.actionDice.value = grade === 2 ? 1 : 2;
    f.target.system.actionDice.bonus = 50;
    f.donor.system.conditionContext.shakenGrade = 2;
    await f.target.boostWithGenerous(f.m, f.opts);
    assert.equal(f.target.system.actionDice.value, 0);
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
    assert.equal(f.target.system.bonusActionDice.mp.remaining, 4);
    assert.equal(f.m.flags.spycraft2.generousBoost.recipientSurcharge.count, grade === 2 ? 1 : 2);
    assert.equal(f.m.flags.spycraft2.boostTotal, 3);
    assert.equal(f.m.flags.spycraft2.boostSpent, 1);
    assert.equal(formulas.length, 1);
    assert.equal(formulas[0].match(/1d/g).length, 1);
    assert.match(formulas[0], /^1d4x>=3/);
  }
});
test("the teammate may select their own unrestricted pool for Generous fees but cannot shift the fee to the donor", async () => {
  const f = generousFixture();
  f.target.system.conditionContext.shakenGrade = 3;
  await f.target.boostWithGenerous(f.m, { ...f.opts, surchargeBonusPoolId: "mp" });
  assert.equal(f.target.system.bonusActionDice.mp.remaining, 2);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
  const blocked = generousFixture();
  blocked.target.system.conditionContext.shakenGrade = 3;
  assert.equal(await blocked.target.boostWithGenerous(blocked.m, blocked.opts), null);
  assert.equal(blocked.donor.system.bonusActionDice.mp.remaining, 4);
  assert.equal(blocked.target.system.bonusActionDice.mp.remaining, 4);
  assert.equal(formulas.length, 0);
});
test("Generous and an own boost share one check surcharge in either payment order", async () => {
  for (const generousFirst of [false, true]) {
    const f = generousFixture();
    f.target.system.conditionContext.shakenGrade = 2;
    f.target.system.actionDice.value = 5;
    if (generousFirst) {
      await f.target.boostWithGenerous(f.m, f.opts);
      await f.target.boostCheck(f.m, { count: 1 });
      assert.equal(f.m.flags.spycraft2.lastBoostPayment.surcharge, 0);
    } else {
      await f.target.boostCheck(f.m, { count: 1 });
      await f.target.boostWithGenerous(f.m, f.opts);
      assert.equal(f.m.flags.spycraft2.generousBoost.recipientSurcharge.count, 0);
    }
    assert.equal(f.target.system.actionDice.value, 3);
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
    assert.equal(f.m.flags.spycraft2.boostSpent, 2);
  }
});
test("a Shaken IV teammate cannot pay a new Generous surcharge; a previously paid full fee requires no new recipient spending", async () => {
  let f = generousFixture();
  f.target.system.conditionContext.shakenGrade = 4;
  f.target.system.actionDice.value = 5;
  assert.equal(await f.target.boostWithGenerous(f.m, f.opts), null);
  assert.equal(f.target.system.actionDice.value, 5);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
  f = generousFixture();
  f.target.system.conditionContext.shakenGrade = 3;
  f.target.system.actionDice.value = 5;
  await f.target.boostCheck(f.m, { count: 1 });
  assert.equal(f.target.system.actionDice.value, 2);
  f.target.system.conditionContext.shakenGrade = 4;
  await f.target.boostWithGenerous(f.m, f.opts);
  assert.equal(f.target.system.actionDice.value, 2);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
  assert.equal(f.m.flags.spycraft2.generousBoost.recipientSurcharge.count, 0);
});
test("failed Generous result receipts restore both characters while committed results retain one donor die and the fee", async () => {
  for (const fail of ["before", "after"]) {
    const f = generousFixture({ fail });
    f.target.system.conditionContext.shakenGrade = 3;
    f.target.system.actionDice.value = 2;
    if (fail === "before") await assert.rejects(f.target.boostWithGenerous(f.m, f.opts), /receipt failed/);
    else await f.target.boostWithGenerous(f.m, f.opts);
    assert.equal(f.target.system.actionDice.value, fail === "before" ? 2 : 0);
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 3);
    assert.equal(
      Object.values(f.target.flags.spycraft2.actionDiePayments)[0].state,
      fail === "before" ? "refunded" : "spent"
    );
  }
});
test("an unproved donor refund holds both characters for review and preserves both payment records", async () => {
  const f = generousFixture({ fail: "before" });
  f.target.system.conditionContext.shakenGrade = 3;
  f.target.system.actionDice.value = 2;
  f.donor.fail.refundBefore = true;
  await assert.rejects(f.target.boostWithGenerous(f.m, f.opts));
  assert.equal(f.target.system.actionDice.value, 0);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
  assert.equal(f.target.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(f.donor.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(f.target.system.actionDiceSettlementReview.donorActorUuid, f.donor.uuid);
  assert.equal(f.m.flags.spycraft2.generousBoost, undefined);
  await f.target.reviewActionDiceSettlement({
    balance: 2,
    benefitRemains: false,
    healthReviewed: true,
    resolution: "No donation applied; restored recipient fee"
  });
  await f.donor.reviewActionDiceSettlement({
    balance: 4,
    healthReviewed: true,
    resolution: "No donation applied; restored donor die"
  });
  assert.equal(f.target.system.actionDice.value, 2);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
});
test("recipient fee reservation failure never rolls or charges the donor, and condition changes during rolling refund both", async () => {
  let f = generousFixture();
  f.target.system.conditionContext.shakenGrade = 3;
  f.target.fail.reservationBefore = true;
  await assert.rejects(f.target.boostWithGenerous(f.m, { ...f.opts, surchargeBonusPoolId: "mp" }));
  assert.equal(f.target.system.bonusActionDice.mp.remaining, 4);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
  assert.equal(formulas.length, 0);
  f = generousFixture();
  f.target.system.conditionContext.shakenGrade = 2;
  f.target.system.actionDice.value = 1;
  rollHook = () => {
    f.target.system.conditionContext.shakenGrade = 3;
  };
  await assert.rejects(f.target.boostWithGenerous(f.m, f.opts), /teammate’s condition/);
  assert.equal(f.target.system.actionDice.value, 1);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
  assert.equal(f.m.flags.spycraft2.generousBoost, undefined);
});
test("a committed Generous result with a rejected recipient final marker remains applied and requires review instead of a second donation", async () => {
  const f = generousFixture();
  f.target.system.conditionContext.shakenGrade = 2;
  f.target.system.actionDice.value = 1;
  const update = f.target.update;
  f.target.update = async function (p) {
    if (Object.entries(p).some(([k, v]) => k.startsWith("flags.spycraft2.actionDiePayments.") && v.state === "spent"))
      throw Error("final receipt rejected");
    return update.call(this, p);
  };
  await f.target.boostWithGenerous(f.m, f.opts);
  assert.equal(f.target.system.actionDice.value, 0);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
  assert.equal(f.m.flags.spycraft2.boostSpent, 1);
  assert.equal(f.target.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(await f.target.boostWithGenerous(f.m, f.opts), false);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
});
test("one outside-combat healing use pays one Shaken fee for its selected benefit dice, including mixed vitality/wound healing", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  const r = await heal(a, { vitalityDice: 1, woundDice: 1 });
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(r.healedVitality, 3);
  assert.equal(r.healedWounds, 2);
  assert.equal(r.baseCost, 2);
  assert.equal(r.surcharge, 2);
  assert.equal(r.cost, 4);
  assert.equal(r.benefitCount, 1);
  assert.equal(formulas.length, 1);
  assert.equal(formulas[0].match(/1d/g).length, 1);
  assert.equal(posts[0].flags.spycraft2.funding.count, 2);
  assert.equal(posts[0].flags.spycraft2.funding.totalCost, 4);
});
test("multiple vitality benefit dice roll and heal normally while a single activation fee remains unrolled", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 2;
  const r = await heal(a, { vitalityDice: 2 });
  assert.equal(r.healedVitality, 6);
  assert.equal(r.cost, 3);
  assert.equal(r.surcharge, 1);
  assert.equal(a.system.bonusActionDice.mp.remaining, 1);
  assert.equal(formulas[0].match(/1d/g).length, 2);
});
test("separate-wallet wound healing restores exactly two wounds and never rolls the Shaken fee", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  const r = await heal(a, { vitalityDice: 0, woundDice: 1, surchargeBonusPoolId: "" });
  assert.equal(r.healedWounds, 2);
  assert.equal(r.healedVitality, 0);
  assert.equal(r.cost, 3);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(formulas.length, 0);
  assert.equal(posts[0].flags.spycraft2.funding.allocations.length, 2);
});
test("healing and Defense abort changed conditions after evaluation and refund both the benefit and fee", async () => {
  for (const workflow of ["heal", "defense"]) {
    const a = actor();
    a.system.conditionContext.shakenGrade = 2;
    if (workflow === "defense") combatFor(a);
    rollHook = () => {
      a.system.conditionContext.shakenGrade = 3;
    };
    await assert.rejects(workflow === "heal" ? heal(a) : defend(a), /Shaken condition changed/);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(a.system.vitality.value, 4);
    assert.equal(a.system.wounds.value, 4);
    assert.equal(a.system.defenseBoost, undefined);
    assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, "refunded");
  }
});
test("insufficient Shaken healing funds stop before evaluation and do not restore health or consume a partial payment", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 2;
  assert.equal(await heal(a), false);
  assert.equal(formulas.length, 0);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
});
test("Refresh can complete after becoming Shaken during its wait, paying its fee but rolling only the one healing die", async () => {
  const a = actor();
  await waitingRefresh(a);
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  const r = await completeRefresh(a, { surchargeBonusPoolId: "" });
  assert.equal(r.healedVitality, 3);
  assert.equal(r.cost, 3);
  assert.equal(r.baseCost, 1);
  assert.equal(r.surcharge, 2);
  assert.equal(a.system.refreshAction.state, "completed");
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(formulas.length, 1);
  assert.equal(formulas[0].match(/1d/g).length, 1);
});
test("Shaken Refresh wound recovery restores only two wounds without any die roll", async () => {
  const a = actor();
  await waitingRefresh(a);
  a.system.conditionContext.shakenGrade = 2;
  const r = await completeRefresh(a, { resource: "wounds" });
  assert.equal(r.healedWounds, 2);
  assert.equal(r.healedVitality, 0);
  assert.equal(r.cost, 2);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(formulas.length, 0);
});
test("failed Shaken healing and Refresh posts restore both selected wallets and only their own health/action gains", async () => {
  for (const workflow of ["heal", "refresh"])
    for (const fail of ["before", "after"]) {
      const a = actor();
      if (workflow === "refresh") await waitingRefresh(a);
      a.system.conditionContext.shakenGrade = 3;
      a.system.bonusActionDice.mp.remaining = 1;
      a.system.actionDice.value = 2;
      postFailure = fail;
      const perform = () =>
        workflow === "heal" ? heal(a, { surchargeBonusPoolId: "" }) : completeRefresh(a, { surchargeBonusPoolId: "" });
      if (fail === "before") await assert.rejects(perform(), /post failed/);
      else await perform();
      assert.equal(a.system.vitality.value, fail === "before" ? 4 : 7);
      assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 1 : 0);
      assert.equal(a.system.actionDice.value, fail === "before" ? 2 : 0);
      if (workflow === "refresh")
        assert.equal(a.system.refreshAction.state, fail === "before" ? "waiting" : "completed");
    }
});
test("uncertain Shaken healing restoration holds every selected balance and preserves the actual health for GC review", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  postFailure = "before";
  a.fail.rollbackBefore = true;
  await assert.rejects(heal(a, { surchargeBonusPoolId: "" }), /safely restored/);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(a.system.actionDiceSettlementReview.payments.length, 2);
});
test("critical activation adds the payer’s Shaken fee once without rolling any payment dice", async () => {
  for (const grade of [2, 3]) {
    const a = actor(),
      m = criticalMessage(a);
    a.system.conditionContext.shakenGrade = grade;
    const r = await a.activateCritical(m, criticalOptions),
      fee = grade === 2 ? 1 : 2;
    assert.equal(r.cost, 1 + fee);
    assert.equal(r.adjustedBaseCost, 1);
    assert.equal(r.surcharge, fee);
    assert.equal(a.system.bonusActionDice.mp.remaining, 3 - fee);
    assert.equal(m.flags.spycraft2.criticalActivation.cost, 1 + fee);
    assert.equal(m.flags.spycraft2.criticalActivation.funding.count, 1);
    assert.equal(m.flags.spycraft2.criticalActivation.funding.surcharge, fee);
    assert.equal(formulas.length, 0);
  }
});
test("a critical cost reduced to zero still pays Shaken from a different source; IV cannot pay even this waived activation", async () => {
  for (const grade of [3, 4]) {
    const a = actor(),
      m = criticalMessage(a);
    a.system.conditionContext.shakenGrade = grade;
    a.system.weaponSpecialist = { proficiencies: ["rifle"], abilities: ["Most Deadly"] };
    const r = await a.activateCritical(m, { ...criticalOptions, bonusPoolId: "", surchargeBonusPoolId: "mp" });
    if (grade === 4) {
      assert.equal(r, false);
      assert.equal(a.system.bonusActionDice.mp.remaining, 4);
      assert.equal(m.flags.spycraft2.criticalSuccess, undefined);
    } else {
      assert.equal(r.cost, 2);
      assert.equal(r.adjustedBaseCost, 0);
      assert.equal(m.flags.spycraft2.criticalActivation.baseCost, 1);
      assert.equal(m.flags.spycraft2.criticalActivation.adjustedBaseCost, 0);
      assert.equal(m.flags.spycraft2.criticalActivation.funding.count, 0);
      assert.equal(a.system.bonusActionDice.mp.remaining, 2);
    }
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(formulas.length, 0);
  }
});
test("an opponent critical-failure activation uses the opponent’s fee and never the affected target’s grade", async () => {
  for (const payerGrade of [0, 2, 3]) {
    const a = actor(),
      b = new SpycraftActor();
    b.uuid = "Actor.opponent";
    a.system.conditionContext.shakenGrade = 4;
    b.system.conditionContext.shakenGrade = payerGrade;
    const m = criticalMessage(a, { failure: true }),
      r = await a.activateCritical(m, {
        ...criticalOptions,
        kind: "failure",
        payer: b,
        opponent: true,
        lineOfSight: true
      });
    const cost = payerGrade === 3 ? 3 : payerGrade === 2 ? 2 : 1;
    assert.equal(r.cost, cost);
    assert.equal(b.system.bonusActionDice.mp.remaining, 4 - cost);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(m.flags.spycraft2.criticalActivation.payerUuid, b.uuid);
  }
});
test("critical costs may split across eligible wallets when no individual wallet covers the adjusted base cost", async () => {
  const a = actor(),
    m = criticalMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  a.system.actionDice.value = 2;
  a.system.bonusActionDice.mp.remaining = 2;
  const r = await a.activateCritical(m, {
    ...criticalOptions,
    baseCost: 3,
    paymentAllocations: [{ count: 2 }, { bonusPoolId: "mp", count: 2 }]
  });
  assert.equal(r.cost, 4);
  assert.equal(r.adjustedBaseCost, 3);
  assert.equal(r.surcharge, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(m.flags.spycraft2.criticalActivation.funding.allocations.length, 2);
  assert.equal(formulas.length, 0);
});
test("untaxed criticals may also use one atomic split-wallet payment", async () => {
  const a = actor(),
    m = criticalMessage(a);
  a.system.actionDice.value = 2;
  a.system.bonusActionDice.mp.remaining = 2;
  const r = await a.activateCritical(m, {
    ...criticalOptions,
    baseCost: 4,
    paymentAllocations: [{ count: 2 }, { bonusPoolId: "mp", count: 2 }]
  });
  assert.equal(r.cost, 4);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(m.flags.spycraft2.criticalActivation.funding.surcharge, 0);
  assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, "spent");
});
test("critical split contributions must equal the final cost, use valid sources and belong to the selected payer", async () => {
  for (const variant of ["total", "bound", "foreign"]) {
    const a = actor(),
      m = criticalMessage(a);
    a.system.conditionContext.shakenGrade = 2;
    a.system.actionDice.value = 2;
    a.system.bonusActionDice.mp.remaining = 2;
    let opts = { ...criticalOptions, baseCost: 3, paymentAllocations: [{ count: 2 }, { bonusPoolId: "mp", count: 2 }] };
    if (variant === "total") opts.paymentAllocations[0].count = 1;
    if (variant === "bound") a.system.bonusActionDice.mp.source = "iKnowWhatDoing";
    if (variant === "foreign")
      opts = { ...opts, splitFunding: [{ actorUuid: "Actor.other", count: 4, bonusPoolId: "" }] };
    assert.equal(await a.activateCritical(m, opts), false);
    assert.equal(a.system.actionDice.value, 2);
    assert.equal(a.system.bonusActionDice.mp.remaining, 2);
    assert.equal(m.flags.spycraft2.criticalSuccess, undefined);
  }
});
test("separate critical base/fee sources keep the actual source allocations and do not charge another actor’s named pool", async () => {
  const a = actor(),
    m = criticalMessage(a);
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 2;
  a.system.bonusActionDice.mp.remaining = 1;
  const r = await a.activateCritical(m, { ...criticalOptions, surchargeBonusPoolId: "" });
  assert.equal(r.cost, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(m.flags.spycraft2.criticalActivation.funding.allocations.length, 2);
  const b = actor(),
    n = criticalMessage(b);
  b.system.conditionContext.shakenGrade = 2;
  assert.equal(await b.activateCritical(n, { ...criticalOptions, feeFunding: "Actor.other|mp" }), false);
  assert.equal(b.system.bonusActionDice.mp.remaining, 4);
});
test("failed critical result writes restore the base and fee, while committed receipts keep exactly one activation", async () => {
  for (const fail of ["before", "after"]) {
    const a = actor(),
      m = criticalMessage(a, { fail });
    a.system.conditionContext.shakenGrade = 3;
    a.system.actionDice.value = 2;
    a.system.bonusActionDice.mp.remaining = 1;
    if (fail === "before")
      await assert.rejects(a.activateCritical(m, { ...criticalOptions, surchargeBonusPoolId: "" }), /post failed/);
    else await a.activateCritical(m, { ...criticalOptions, surchargeBonusPoolId: "" });
    assert.equal(a.system.actionDice.value, fail === "before" ? 2 : 0);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 1 : 0);
    assert.equal(m.flags.spycraft2.criticalSuccess, fail === "before" ? undefined : true);
    assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, fail === "before" ? "refunded" : "spent");
  }
});
test("a rejected final critical payment marker retains the activated effect and blocks another activation pending review", async () => {
  const a = actor(),
    m = criticalMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  const update = a.update;
  a.update = async function (p) {
    if (Object.values(p).some(v => v?.state === "spent")) throw Error("final marker rejected");
    return update.call(this, p);
  };
  const r = await a.activateCritical(m, criticalOptions);
  assert.equal(r.cost, 2);
  assert.equal(m.flags.spycraft2.criticalSuccess, true);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(a.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(a.system.actionDiceSettlementReview.messageUuid, m.uuid);
  assert.equal(await a.activateCritical(m, criticalOptions), null);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
});
test("critical payment rechecks the confirmed payer condition after waiting for its transaction", async () => {
  const a = actor(),
    m = criticalMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  let release;
  a._actionDieQueue = new Promise(resolve => {
    release = resolve;
  });
  const pending = a.activateCritical(m, criticalOptions);
  a.system.conditionContext.shakenGrade = 3;
  release();
  await assert.rejects(pending, /Shaken condition changed/);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(m.flags.spycraft2.criticalSuccess, undefined);
});
test("the School of Hard Knocks credit remains one class die despite an opponent paying a three-die critical activation", async () => {
  const a = actor(),
    b = new SpycraftActor();
  b.uuid = "Actor.opponent";
  a.system.coreClassIds = ["stuntman"];
  a.system.classLevels = { intruder: 4, stuntman: 8 };
  b.system.conditionContext.shakenGrade = 3;
  const m = criticalMessage(a, { failure: true });
  await a.activateCritical(m, { ...criticalOptions, kind: "failure", payer: b, opponent: true, lineOfSight: true });
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(a.system.xp, 0);
  assert.equal(b.system.bonusActionDice.mp.remaining, 1);
  assert.equal(m.flags.spycraft2.schoolOfHardKnocks.units, 1);
  assert.equal(m.flags.spycraft2.criticalActivation.cost, 3);
  assert.equal(formulas.length, 0);
});
test("a failed Hard Knocks credit restoration holds its recipient and the opponent’s full taxed payment separately", async () => {
  const a = actor(),
    b = new SpycraftActor();
  b.uuid = "Actor.opponent";
  a.system.coreClassIds = ["stuntman"];
  a.system.classLevels = { intruder: 4, stuntman: 8 };
  b.system.conditionContext.shakenGrade = 3;
  const m = criticalMessage(a, { failure: true, fail: "before" }),
    update = a.update;
  a.update = async function (p) {
    if (p["system.actionDice.value"] === 0) throw Error("credit restore rejected");
    return update.call(this, p);
  };
  await assert.rejects(
    a.activateCritical(m, { ...criticalOptions, kind: "failure", payer: b, opponent: true, lineOfSight: true })
  );
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(b.system.bonusActionDice.mp.remaining, 1);
  assert.equal(a.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(b.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(a.system.actionDiceSettlementReview.purpose, "School of Hard Knocks credit");
  assert.equal(b.system.actionDiceSettlementReview.messageUuid, m.uuid);
  assert.equal(m.flags.spycraft2.criticalFailure, undefined);
});
test("unrolled-benefit split quotes reject malformed allocations and zero-cost overpayment", () => {
  const a = actor();
  for (const allocations of [
    true,
    {},
    [{ count: true }],
    [{ count: NaN }],
    [{ count: 0 }],
    Array(33).fill({ count: 1 })
  ])
    assert.throws(() => actionDieBenefitQuote(a, { baseCost: 1, allocations }));
  assert.throws(() => actionDieBenefitQuote(a, { baseCost: 0, allocations: [{ count: 1 }] }), /final 0-die cost/);
});
test("a failure cost waived by Unreliable still charges its opponent payer’s fee and remains forbidden for an IV payer", async () => {
  for (const grade of [3, 4]) {
    const a = actor(),
      b = new SpycraftActor();
    b.uuid = "Actor.opponent";
    b.system.conditionContext.shakenGrade = grade;
    const m = criticalMessage(a, { failure: true });
    m.flags.spycraft2.weaponQualities = "UNR";
    const r = await a.activateCritical(m, {
      ...criticalOptions,
      kind: "failure",
      payer: b,
      opponent: true,
      lineOfSight: true
    });
    if (grade === 4) {
      assert.equal(r, false);
      assert.equal(b.system.bonusActionDice.mp.remaining, 4);
      assert.equal(m.flags.spycraft2.criticalFailure, undefined);
    } else {
      assert.equal(r.adjustedBaseCost, 0);
      assert.equal(r.surcharge, 2);
      assert.equal(r.cost, 2);
      assert.equal(b.system.bonusActionDice.mp.remaining, 2);
      assert.equal(m.flags.spycraft2.criticalActivation.funding.count, 0);
    }
  }
});

import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
function paidSkillActor(grade = 3, value = 8) {
  const a = actor();
  a.items = [];
  a.system.classLevels = { soldier: 4, schemer: 8 };
  a.system.coreClassIds = ["soldier", "schemer"];
  a.system.abilities.int.value = 18;
  a.system.actionDice = { value, max: 4, die: 8, explodeAt: 7, bonus: 1 };
  a.system.bonusActionDice = {};
  a.system.conditionContext = { shakenGrade: grade };
  a.system.resourceUses = {};
  a.system.skillFeatRules = [];
  a.system.skills = {};
  a.system.focuses = {};
  a.system.skillTotals = Object.fromEntries(
    Object.entries(cfg.skills).map(([k, s]) => [
      k,
      {
        name: s.name,
        ranks: 0,
        cap: 20,
        threat: 20,
        focus: s.focus,
        totals: s.abilities.map(ability => ({ ability, total: a.system.abilities[ability].mod }))
      }
    ])
  );
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  return a;
}
const paidSmash = (a, options = {}) =>
  a.rollSkill("athletics", "str", { check: "smash", gearStatus: "available", synergySkill: "none", ...options });
test("all Hail Mary combinations retain their distinct benefit count instead of inferring it from the total die cost", () => {
  const a = paidSkillActor();
  for (let bits = 0; bits < 8; bits++) {
    const flags = { hailMaryUntrained: !!(bits & 1), hailMaryUncap: !!(bits & 2), hailMaryActive: !!(bits & 4) },
      r = resolveSkillCheck(
        a.system,
        "notice",
        cfg.skills.notice.checks.find(c => c.id === "awareness"),
        { ...flags, gearStatus: "available", synergySkill: "none" }
      );
    assert.equal(r.actionDiceCost, (bits & 1 ? 1 : 0) + (bits & 2 ? 3 : 0) + (bits & 4 ? 4 : 0));
    assert.equal(r.actionDiceBenefits, Number(!!(bits & 1)) + Number(!!(bits & 2)) + Number(!!(bits & 4)));
  }
});
test("equal four-die Hail Mary base costs can owe different Shaken fees for one active benefit versus two selected benefits", async () => {
  let a = paidSkillActor(3, 8),
    m = await paidSmash(a, { hailMaryUntrained: true, hailMaryUncap: true });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(m.flags.spycraft2.preRollFunding.baseCost, 4);
  assert.equal(m.flags.spycraft2.preRollFunding.surcharge, 4);
  assert.equal(m.flags.spycraft2.preRollFunding.benefitCount, 2);
  assert.equal(m.flags.spycraft2.preRollFunding.count, 8);
  assert.equal(formulas.length, 1);
  a = paidSkillActor(3, 8);
  m = await a.rollSkill("notice", "wis", {
    check: "awareness",
    gearStatus: "available",
    synergySkill: "none",
    hailMaryActive: true
  });
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(m.flags.spycraft2.preRollFunding.baseCost, 4);
  assert.equal(m.flags.spycraft2.preRollFunding.surcharge, 2);
  assert.equal(m.flags.spycraft2.preRollFunding.benefitCount, 1);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, true);
  assert.equal(formulas.length, 1);
});
test("all three Hail Mary benefits cost eight base dice plus three Shaken III fees, with only the normal d20 rolled", async () => {
  const a = paidSkillActor(3, 14),
    m = await a.rollSkill("notice", "wis", {
      check: "awareness",
      gearStatus: "available",
      synergySkill: "none",
      hailMaryUntrained: true,
      hailMaryUncap: true,
      hailMaryActive: true
    });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(m.flags.spycraft2.preRollFunding.baseCost, 8);
  assert.equal(m.flags.spycraft2.preRollFunding.surcharge, 6);
  assert.equal(m.flags.spycraft2.preRollFunding.count, 14);
  assert.equal(m.flags.spycraft2.cap, null);
  assert.equal(m.flags.spycraft2.error, 1);
  assert.equal(formulas.length, 1);
  assert.match(formulas[0], /^1d20/);
});
test("a free Cunning Plan combined with Hail Mary consumes one class use but adds no class spending benefit", async () => {
  const a = paidSkillActor(3, 8),
    m = await paidSmash(a, { cunningPlan: true, hailMaryUntrained: true, hailMaryUncap: true });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.cunningPlan.used, 1);
  assert.equal(m.flags.spycraft2.preRollFunding.benefitCount, 2);
  assert.equal(m.flags.spycraft2.preRollFunding.surcharge, 4);
  assert.equal(m.flags.spycraft2.error, 0);
  assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].details.abilities[0], "cunningPlan");
});
test("free INT substitution, declared-natural-20 class effects and bonus-die income remain free while Shaken", async () => {
  let a = paidSkillActor(3, 0),
    m = await paidSmash(a, { allAccordingToPlan: true });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
  assert.equal(m.flags.spycraft2.ability, "int");
  assert.equal(m.flags.spycraft2.preRollFunding, null);
  for (const [classId, id, workflow] of [
    ["soldier", "oneInAMillion", "oneInAMillion"],
    ["scientist", "tenSecondSolution", "tenSecondSolution"]
  ]) {
    a = paidSkillActor(4, 0);
    a.system.classLevels = { [classId]: 14 };
    a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
    const result = await a.useLimitedAbility(id, async () => ({ declaredNatural: 20 }), { workflow });
    assert.equal(result.declaredNatural, 20);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(a.system.resourceUses[id].used, 1);
  }
  a = paidSkillActor(4, 0);
  const p = await a.activateMasterPlan({ freeActionConfirmed: true });
  assert.equal(p.remaining, 4);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.masterPlan.used, 1);
  assert.equal(a.flags.spycraft2?.actionDiePayments, undefined);
});
test("Hail Mary can pay its fee from another unrestricted wallet and insufficient fees never begin a skill roll", async () => {
  let a = paidSkillActor(3, 1);
  a.system.bonusActionDice.mp = masterPlanPool(a.system, masterPlanGainPlan(a.system), { id: "mp" });
  const m = await paidSmash(a, { hailMaryUntrained: true, surchargeBonusPoolId: "mp" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(m.flags.spycraft2.preRollFunding.allocations.length, 2);
  a = paidSkillActor(3, 2);
  assert.equal(await paidSmash(a, { hailMaryUntrained: true, cunningPlan: true }), null);
  assert.equal(a.system.resourceUses.cunningPlan, undefined);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(formulas.length, 0);
});
test("Gambling freezes the actually possessed dice after paying both Hail Mary and the Shaken fee", async () => {
  const a = paidSkillActor(2, 7);
  a.system.activeFeatNames = ["The Dice are Hot"];
  const m = await a.rollSkill("streetwise", "wis", {
    check: "gambling",
    gearStatus: "available",
    synergySkill: "none",
    hailMaryUntrained: true
  });
  assert.equal(a.system.actionDice.value, 5);
  assert.equal(m.flags.spycraft2.gamblingDice.total, 5);
  assert.equal(m.flags.spycraft2.preRollFunding.count, 2);
});
test("Eagle Eye rolls only one selected benefit die, pays its fee separately and consumes one scene use", async () => {
  const a = eagleActor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  const r = await a.useEagleEye({ bonusPoolId: "mp", surchargeBonusPoolId: "" });
  assert.equal(r.rangeIncrease, 30);
  assert.equal(r.funding.count, 1);
  assert.equal(r.funding.surcharge, 2);
  assert.equal(r.funding.totalCost, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
  assert.equal(formulas.length, 1);
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].details.limitedUseSettlement[0].reserved.used, 1);
});
test("taxed Meticulous rerolls pay one class benefit and clear the original pre-roll receipt on the replacement", async () => {
  const a = rerollActor(),
    m = rerollMessage(a);
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  m.flags.spycraft2.preRollFunding = { id: "historical", count: 1 };
  const replacement = await a.rerollCheck(m, { ...rerollOptions, surchargeBonusPoolId: "" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.resourceUses.meticulous.used, 1);
  assert.equal(replacement.flags.spycraft2.preRollFunding, null);
  assert.equal(replacement.flags.spycraft2.rerollFunding.baseCost, 1);
  assert.equal(replacement.flags.spycraft2.rerollFunding.surcharge, 2);
  assert.equal(formulas.length, 1);
});
test("a historical pre-roll receipt cannot impersonate a replacement when the new reroll post fails", async () => {
  const a = rerollActor(),
    m = rerollMessage(a);
  m.flags.spycraft2.preRollFunding = { id: "historical", count: 1 };
  game.messages.push(m);
  postFailure = "before";
  await assert.rejects(a.rerollCheck(m, rerollOptions), /post failed/);
  assert.equal(m.flags.spycraft2.superseded, undefined);
  assert.equal(m.flags.spycraft2.resolved, undefined);
  assert.equal(a.system.resourceUses.meticulous, undefined);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(game.messages.length, 1);
});
test("paid manual core declarations spend their fee without rolling dice and recover a committed chat receipt once", async () => {
  const a = actor();
  a.name = "QA";
  a.system.classLevels = { soldier: 4, raptor: 8 };
  a.system.coreClassIds = ["soldier", "raptor"];
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.system.resourceUses = {};
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 3;
  a.system.bonusActionDice = {};
  postFailure = "after";
  const m = await a.useManualLimitedAbility("raptorCore", { bonusPoolId: "" });
  assert.equal(m.flags.spycraft2.resourceId, "raptorCore");
  assert.equal(m.flags.spycraft2.funding.count, 3);
  assert.equal(m.flags.spycraft2.funding.surcharge, 2);
  assert.equal(a.system.resourceUses.raptorCore.used, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(formulas.length, 0);
  assert.equal(posts.length, 1);
});
test("standalone action-die rolls pay a fee but roll only the chosen primary die and retain its type", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 3;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.actionDice.value = 2;
  const m = await a.rollActionDie({ bonusPoolId: "mp", surchargeBonusPoolId: "" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(formulas.length, 1);
  assert.match(formulas[0], /^1d4x>=3/);
  assert.equal(m.flags.spycraft2.funding.count, 1);
  assert.equal(m.flags.spycraft2.funding.surcharge, 2);
  assert.equal(m.flags.spycraft2.funding.totalCost, 3);
});
test("failed paid class posts refund every wallet and the one use, while committed posts retain the range benefit and payment", async () => {
  for (const fail of ["before", "after"]) {
    const a = eagleActor();
    a.system.conditionContext.shakenGrade = 3;
    a.system.bonusActionDice.mp.remaining = 1;
    a.system.actionDice.value = 2;
    postFailure = fail;
    if (fail === "before")
      await assert.rejects(a.useEagleEye({ bonusPoolId: "mp", surchargeBonusPoolId: "" }), /post failed/);
    else await a.useEagleEye({ bonusPoolId: "mp", surchargeBonusPoolId: "" });
    assert.equal(a.system.actionDice.value, fail === "before" ? 2 : 0);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 1 : 0);
    assert.equal(a.system.resourceUses.eagleEye?.used, fail === "before" ? undefined : 1);
    assert.equal(a.system.eagleEyeBoost?.rangeIncrease, fail === "before" ? undefined : 30);
  }
});
test("a paid ability’s missing final receipt preserves restorable counter evidence before any catch handler runs", async () => {
  const a = eagleActor();
  a.system.conditionContext.shakenGrade = 3;
  const update = a.update;
  a.update = async function (p) {
    if (Object.values(p).some(v => v?.state === "spent")) throw Error("final marker rejected");
    return update.call(this, p);
  };
  await a.useEagleEye({ bonusPoolId: "mp" });
  assert.equal(a.system.bonusActionDice.mp.remaining, 1);
  const review = a.system.actionDiceSettlementReview;
  assert.equal(review.needsReview, true);
  assert.equal(review.limitedUseSettlement[0].before, null);
  assert.equal(review.limitedUseSettlement[0].reserved.used, 1);
  a.update = update;
  await a.update({ "system.eagleEyeBoost": null });
  game.messages = [];
  await a.reviewActionDiceSettlement({
    balance: 4,
    benefitRemains: false,
    restoreLimitedUses: true,
    healthReviewed: true,
    resolution: "Cancelled the activation and cleared the range effect and posted result"
  });
  assert.equal(a.system.resourceUses.eagleEye, undefined);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
});
test("changed Shaken sources during a paid skill or Eagle Eye roll abort without a free result, spent counter or payment", async () => {
  for (const kind of ["skill", "eagleEye"]) {
    const a = kind === "skill" ? paidSkillActor(2, 2) : eagleActor();
    if (kind === "eagleEye") a.system.conditionContext.shakenGrade = 2;
    rollHook = () => {
      a.system.conditionContext.shakenGrade = 3;
    };
    await assert.rejects(
      kind === "skill" ? paidSmash(a, { hailMaryUntrained: true }) : a.useEagleEye({ bonusPoolId: "mp" }),
      /Shaken condition changed/
    );
    assert.equal(a.system.actionDice.value, kind === "skill" ? 2 : 0);
    assert.equal(a.system.bonusActionDice.mp?.remaining, kind === "skill" ? undefined : 4);
    assert.equal(a.system.resourceUses.eagleEye, undefined);
    assert.equal(posts.length, 0);
  }
});

import { surchargeFundingInput, surchargeFundingControl } from "../module/apps/action-die-benefits.mjs";
function splitFeeSetup(a) {
  a.system.conditionContext.shakenGrade = 3;
  a.system.actionDice.value = 1;
  a.system.bonusActionDice.mp.remaining = 1;
  a.system.bonusActionDice.other = { ...clone(a.system.bonusActionDice.mp), id: "other", label: "Other earned grant" };
  return {
    bonusPoolId: "mp",
    surchargeAllocations: [
      { bonusPoolId: "", count: 1 },
      { bonusPoolId: "other", count: 1 }
    ]
  };
}
function assertSplitPaid(a, scope = "general") {
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.bonusActionDice.other.remaining, 0);
  const marker = Object.values(a.flags.spycraft2.actionDiePayments)[0];
  assert.equal(marker.count, 3);
  assert.equal(marker.payments.length, 3);
  assert.equal(marker.allocations[0].scope, scope);
  assert.deepEqual(
    marker.allocations.slice(1).map(p => p.scope),
    ["surcharge", "surcharge"]
  );
}
test("split surcharge payments retain the primary die across three independent wallets for standalone rolls and healing", async () => {
  for (const workflow of ["roll", "heal"]) {
    const a = actor(),
      options = splitFeeSetup(a);
    const r = await (workflow === "roll" ? a.rollActionDie(options) : heal(a, options));
    assert.ok(r);
    assertSplitPaid(a);
    assert.equal(formulas.length, 1);
    assert.match(formulas[0], /^1d4x>=3/);
    if (workflow === "heal") assert.equal(a.system.vitality.value, 7);
  }
});
test("Defense and Refresh use three-wallet fees without extra duration or healing dice", async () => {
  for (const workflow of ["defense", "refresh"]) {
    const a = actor();
    if (workflow === "refresh") await waitingRefresh(a);
    else combatFor(a);
    const options = splitFeeSetup(a);
    const r = await (workflow === "refresh" ? completeRefresh(a, options) : defend(a, options));
    assert.ok(r);
    assertSplitPaid(a);
    assert.equal(formulas.length, 1);
    assert.match(formulas[0], /^1d4x>=3/);
  }
});
test("paid class, reroll and manual core workflows carry split fees through their source counters", async () => {
  for (const workflow of ["eagle", "reroll", "manual"]) {
    const a = workflow === "eagle" ? eagleActor() : workflow === "reroll" ? rerollActor() : actor();
    if (workflow === "manual") {
      a.system.classLevels = { soldier: 4, raptor: 8 };
      a.system.coreClassIds = ["soldier", "raptor"];
      a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
      a.system.resourceUses = {};
    }
    const options = splitFeeSetup(a);
    const r = await (workflow === "eagle"
      ? a.useEagleEye(options)
      : workflow === "reroll"
        ? a.rerollCheck(rerollMessage(a), { ...rerollOptions, ...options })
        : a.useManualLimitedAbility("raptorCore", options));
    assert.ok(r);
    assertSplitPaid(a);
    assert.equal(
      a.system.resourceUses[workflow === "eagle" ? "eagleEye" : workflow === "reroll" ? "meticulous" : "raptorCore"]
        .used,
      1
    );
    assert.equal(formulas.length, workflow === "manual" ? 0 : 1);
  }
});
test("Hail Mary combined with free class effects retains split fee allocations through roll wrappers", async () => {
  for (const cunningPlan of [false, true]) {
    const a = paidSkillActor(3, 1);
    a.system.bonusActionDice.mp = masterPlanPool(a.system, masterPlanGainPlan(a.system), { id: "mp" });
    const options = splitFeeSetup(a);
    const m = await paidSmash(a, { ...options, hailMaryUntrained: true, cunningPlan });
    assert.ok(m);
    assertSplitPaid(a);
    assert.equal(m.flags.spycraft2.preRollFunding.benefitCount, 1);
    assert.equal(formulas.length, 1);
    assert.equal(a.system.resourceUses.cunningPlan?.used, cunningPlan ? 1 : undefined);
  }
});
test("three-wallet callback failure refunds all sources and class uses, while a committed receipt retains all three debits", async () => {
  for (const fail of ["before", "after"]) {
    const a = eagleActor(),
      options = splitFeeSetup(a);
    postFailure = fail;
    if (fail === "before") await assert.rejects(a.useEagleEye(options), /post failed/);
    else await a.useEagleEye(options);
    for (const value of [
      a.system.actionDice.value,
      a.system.bonusActionDice.mp.remaining,
      a.system.bonusActionDice.other.remaining
    ])
      assert.equal(value, fail === "before" ? 1 : 0);
    assert.equal(a.system.resourceUses.eagleEye?.used, fail === "before" ? undefined : 1);
  }
});
test("split fee amounts, eligibility and combined same-wallet budgets are checked before a class use or roll", async () => {
  for (const parts of [
    true,
    [{ count: 1 }],
    [{ count: 3 }],
    [{ count: NaN }],
    [{ count: 0 }, { count: 2 }],
    [{ count: 1.5 }, { count: 0.5 }],
    [{ bonusPoolId: "missing", count: 2 }],
    [{ bonusPoolId: "mp", count: 2 }]
  ]) {
    const a = eagleActor();
    splitFeeSetup(a);
    assert.equal(await a.useEagleEye({ bonusPoolId: "mp", surchargeAllocations: parts }), null);
    assert.equal(a.system.resourceUses.eagleEye, undefined);
    assert.equal(a.system.actionDice.value, 1);
    assert.equal(a.system.bonusActionDice.mp.remaining, 1);
    assert.equal(formulas.length, 0);
  }
  const a = actor();
  splitFeeSetup(a);
  a.system.bonusActionDice.bound = { id: "bound", source: "iKnowWhatDoing", remaining: 2, die: 10 };
  assert.throws(() =>
    actionDieBenefitQuote(a, {
      baseCost: 1,
      bonusPoolId: "mp",
      surchargeAllocations: [{ bonusPoolId: "bound", count: 2 }]
    })
  );
  assert.throws(
    () => actionDieBenefitQuote(a, { baseCost: 1, allocations: [{ count: 3 }], surchargeAllocations: [{ count: 2 }] }),
    /either/
  );
});
test("submitted split fields preserve disappeared and malformed grants instead of silently selecting a different fee source", () => {
  const a = actor();
  splitFeeSetup(a);
  for (const input of [
    { surchargePart__ordinary: "1", surchargePart__pool_gone: "1" },
    { surchargePart__ordinary: "bad" },
    { surchargePart__ordinary: true },
    { surchargePart__ordinary: "-1", surchargePart__pool_other: "3" }
  ])
    assert.throws(() => actionDieBenefitQuote(a, { baseCost: 1, bonusPoolId: "mp", ...surchargeFundingInput(input) }));
  assert.equal(
    surchargeFundingInput({ surchargePart__ordinary: "", surchargePart__pool_other: "0" }).surchargeAllocations,
    undefined
  );
  assert.deepEqual(
    surchargeFundingInput({ surchargePart__ordinary: "1", surchargePart__pool_other: 1 }).surchargeAllocations,
    [
      { bonusPoolId: "", count: 1 },
      { bonusPoolId: "other", count: 1 }
    ]
  );
});
test("split-fee controls show independent balances and preserve confirmed source identifiers", () => {
  const a = actor();
  splitFeeSetup(a);
  const html = surchargeFundingControl(a);
  for (const name of ["surchargePart__ordinary", "surchargePart__pool_mp", "surchargePart__pool_other"])
    assert.ok(html.includes(`name="${name}"`));
  assert.ok(html.includes("benefit dice still use their selected source"));
  const raw = [{ bonusPoolId: "other", count: 2 }];
  assert.equal(surchargeFundingInput({ surchargeAllocations: raw }).surchargeAllocations, raw);
});

import { unrolledPaymentFundingInput, unrolledPaymentFundingControl } from "../module/apps/action-die-benefits.mjs";
function fullHailPayment(grade) {
  const a = paidSkillActor(grade, grade ? 6 : 4);
  a.system.bonusActionDice.mp = masterPlanPool(a.system, masterPlanGainPlan(a.system), { id: "mp" });
  const allocations = [{ count: a.system.actionDice.value }, { bonusPoolId: "mp", count: 4 }];
  if (grade) {
    a.system.bonusActionDice.other = { ...clone(a.system.bonusActionDice.mp), id: "other" };
    allocations.push({ bonusPoolId: "other", count: 4 });
  }
  return { a, options: { hailMaryUntrained: true, hailMaryUncap: true, hailMaryActive: true, allocations } };
}
const fullHailRoll = (a, options) =>
  a.rollSkill("notice", "wis", { check: "awareness", gearStatus: "available", synergySkill: "none", ...options });
test("all Hail Mary benefits can pay base8 and their exact fee across wallets when no wallet covers even the base", async () => {
  for (const grade of [0, 3])
    for (const cunningPlan of [false, true]) {
      const { a, options } = fullHailPayment(grade),
        m = await fullHailRoll(a, { ...options, cunningPlan });
      assert.ok(m, warnings.join("; "));
      assert.equal(a.system.actionDice.value, 0);
      assert.equal(a.system.bonusActionDice.mp.remaining, 0);
      if (grade) assert.equal(a.system.bonusActionDice.other.remaining, 0);
      assert.equal(m.flags.spycraft2.preRollFunding.count, grade ? 14 : 8);
      assert.equal(formulas.length, 1);
      assert.equal(m.flags.spycraft2.cap, null);
      assert.equal(a.system.resourceUses.cunningPlan?.used, cunningPlan ? 1 : undefined);
    }
});
test("declared natural20 wrappers retain the full split Hail Mary payment once", async () => {
  const { a, options } = fullHailPayment(3);
  a.system.actionDice.value = 4;
  options.hailMaryActive = false;
  options.allocations = [{ count: 4 }, { bonusPoolId: "mp", count: 4 }];
  a.system.classLevels.soldier = 14;
  a.system.limitedUses = [
    { id: "oneInAMillion", name: "One in a Million", period: "session", workflow: "oneInAMillion", cost: 0, limit: 1 }
  ];
  const m = await paidSmash(a, { ...options, oneInAMillion: true });
  assert.ok(m);
  assert.equal(m.flags.spycraft2.naturalDie, 20);
  assert.equal(a.system.resourceUses.oneInAMillion.used, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.bonusActionDice.other.remaining, 4);
  assert.equal(Object.values(a.flags.spycraft2.actionDiePayments).length, 1);
});
test("incorrect or stale full Hail Mary contributions never consume free class uses or roll a check", async () => {
  for (const allocations of [
    true,
    [{ count: 13 }],
    [{ count: 0 }, { count: 14 }],
    [{ bonusPoolId: "missing", count: 14 }],
    [{ count: 6 }, { bonusPoolId: "mp", count: 8 }]
  ]) {
    const { a, options } = fullHailPayment(3);
    const m = await fullHailRoll(a, { ...options, cunningPlan: true, allocations });
    assert.equal(m, null);
    assert.equal(a.system.resourceUses.cunningPlan, undefined);
    assert.equal(a.system.actionDice.value, 6);
    assert.equal(a.system.bonusActionDice.mp.remaining, 4);
    assert.equal(formulas.length, 0);
  }
});
test("full Hail Mary split refunds every source after a failed post and keeps every debit after a committed post", async () => {
  for (const fail of ["before", "after"]) {
    const { a, options } = fullHailPayment(3);
    postFailure = fail;
    if (fail === "before") await assert.rejects(fullHailRoll(a, { ...options, cunningPlan: true }), /post failed/);
    else await fullHailRoll(a, { ...options, cunningPlan: true });
    assert.equal(a.system.actionDice.value, fail === "before" ? 6 : 0);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 4 : 0);
    assert.equal(a.system.bonusActionDice.other.remaining, fail === "before" ? 4 : 0);
    assert.equal(a.system.resourceUses.cunningPlan?.used, fail === "before" ? undefined : 1);
    assert.equal(formulas.length, 1);
  }
});
test("unrolled payment fields preserve exact submitted sources and reject unused overpayment or malformed amounts", async () => {
  const { a, options } = fullHailPayment(0);
  const parsed = unrolledPaymentFundingInput({ unrolledPart__ordinary: "4", unrolledPart__pool_mp: "4" });
  assert.deepEqual(parsed.allocations, [
    { bonusPoolId: "", count: 4 },
    { bonusPoolId: "mp", count: 4 }
  ]);
  assert.ok(await fullHailRoll(a, { ...options, ...parsed }));
  for (const input of [
    { unrolledPart__ordinary: "1" },
    { unrolledPart__ordinary: "bad" },
    { allocations: [{ count: 0 }] }
  ]) {
    const b = paidSkillActor(3, 3);
    assert.equal(await paidSmash(b, input), false);
    assert.equal(formulas.length, 0);
    assert.equal(b.system.actionDice.value, 3);
  }
  assert.equal(unrolledPaymentFundingInput({ unrolledPart__ordinary: "0" }).allocations, undefined);
});
test("Eagle Eye cannot override its rolled primary source with an unrolled full-payment allocation", async () => {
  const a = eagleActor();
  a.system.conditionContext.shakenGrade = 3;
  await assert.rejects(
    a.useLimitedAbility("eagleEye", () => assert.fail("must not perform"), {
      workflow: "eagleEye",
      allocations: [{ bonusPoolId: "mp", count: 3 }]
    }),
    /retain one selected benefit die/
  );
  assert.equal(a.system.resourceUses.eagleEye, undefined);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(formulas.length, 0);
});
test("unrolled controls remain available without Shaken and explicitly distinguish whole-cost funding from fee-only splits", () => {
  const a = actor(),
    html = unrolledPaymentFundingControl(a);
  assert.ok(html.includes("unrolledPart__ordinary"));
  assert.ok(html.includes("unrolledPart__pool_mp"));
  assert.ok(html.includes("replace both funding selectors"));
  assert.ok(html.includes("Payment dice are not rolled"));
  assert.ok(a.actionDiceSurchargeControl({ unrolled: true }).includes("Split the full unrolled payment"));
});

test("own boosts split only the remaining check fee while retaining one primary benefit die and its cap", async () => {
  const a = actor(),
    options = splitFeeSetup(a),
    m = boostMessage(a);
  await a.boostCheck(m, { ...options, count: 1 });
  assertSplitPaid(a, "boost");
  assert.equal(m.flags.spycraft2.boostSpent, 1);
  assert.equal(m.flags.spycraft2.lastBoostDice.length, 1);
  assert.equal(m.flags.spycraft2.cap, 30);
  assert.equal(formulas.length, 1);
  assert.match(formulas[0], /^1d4x>=3/);
});
test("compulsory check-bound dice can be boosted with a fee split across unrestricted sources but can never fund that fee", async () => {
  for (const boundFee of [false, true]) {
    const a = actor(),
      m = boostMessage(a);
    splitFeeSetup(a);
    m.flags.spycraft2.requiredBonusPoolId = "bound";
    m.flags.spycraft2.actionDiceAllowed = false;
    a.system.bonusActionDice.bound = {
      id: "bound",
      source: "iKnowWhatDoing",
      label: "Compulsory",
      die: 10,
      granted: 1,
      remaining: 1,
      mandatory: true,
      messageUuid: m.uuid,
      originalMessageUuid: m.uuid,
      skillKey: "athletics",
      ability: "str",
      scene: periods.scene,
      session: periods.session
    };
    const options = {
      bonusPoolId: "bound",
      count: 1,
      surchargeAllocations: [{ count: 1 }, { bonusPoolId: boundFee ? "bound" : "mp", count: 1 }]
    };
    if (boundFee) {
      await assert.rejects(a.boostCheck(m, options));
      assert.equal(formulas.length, 0);
      assert.equal(a.system.actionDice.value, 1);
    } else {
      await a.boostCheck(m, options);
      assert.equal(a.system.actionDice.value, 0);
      assert.equal(a.system.bonusActionDice.mp.remaining, 0);
      assert.equal(m.flags.spycraft2.requiredBonusSpent, true);
      assert.match(formulas[0], /^1d10/);
      assert.equal(m.flags.spycraft2.lastBoostDice.length, 1);
    }
  }
});
test("Generous fee splits always consume the receiving teammate’s sources and roll only the Pointman’s donated die", async () => {
  const f = generousFixture();
  splitFeeSetup(f.target);
  await f.target.boostWithGenerous(f.m, {
    ...f.opts,
    surchargeAllocations: [{ count: 1 }, { bonusPoolId: "mp", count: 1 }]
  });
  assert.equal(f.target.system.actionDice.value, 0);
  assert.equal(f.target.system.bonusActionDice.mp.remaining, 0);
  assert.equal(f.target.system.bonusActionDice.other.remaining, 1);
  assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
  assert.equal(formulas.length, 1);
  assert.equal(f.m.flags.spycraft2.generousBoost.recipientSurcharge.count, 2);
  assert.equal(Object.values(f.target.flags.spycraft2.actionDiePayments)[0].payments.length, 2);
});
test("split Generous and own boost fees remain once per check in either payment order", async () => {
  for (const generousFirst of [false, true]) {
    const f = generousFixture();
    splitFeeSetup(f.target);
    const parts = [{ count: 1 }, { bonusPoolId: "mp", count: 1 }];
    if (generousFirst) {
      await f.target.boostWithGenerous(f.m, { ...f.opts, surchargeAllocations: parts });
      await f.target.boostCheck(f.m, { bonusPoolId: "other", count: 1 });
    } else {
      await f.target.boostCheck(f.m, { bonusPoolId: "other", count: 1, surchargeAllocations: parts });
      await f.target.boostWithGenerous(f.m, f.opts);
    }
    for (const value of [
      f.target.system.actionDice.value,
      f.target.system.bonusActionDice.mp.remaining,
      f.target.system.bonusActionDice.other.remaining
    ])
      assert.equal(value, 0);
    assert.equal(f.donor.system.bonusActionDice.mp.remaining, 3);
    assert.equal(
      Object.values(f.target.flags.spycraft2.actionDiePayments).reduce((n, p) => n + p.details.surcharge, 0),
      2
    );
    assert.equal(f.m.flags.spycraft2.boostSpent, 2);
    assert.equal(formulas.length, 2);
  }
});
test("failed split boost and Generous receipts restore all actual fee wallets while committed results retain their debits", async () => {
  for (const workflow of ["boost", "generous"])
    for (const fail of ["before", "after"]) {
      const f = generousFixture({ fail });
      splitFeeSetup(f.target);
      const m = workflow === "boost" ? boostMessage(f.target, { fail }) : f.m,
        perform = () =>
          workflow === "boost"
            ? f.target.boostCheck(m, {
                bonusPoolId: "other",
                count: 1,
                surchargeAllocations: [{ count: 1 }, { bonusPoolId: "mp", count: 1 }]
              })
            : f.target.boostWithGenerous(m, {
                ...f.opts,
                surchargeAllocations: [{ count: 1 }, { bonusPoolId: "mp", count: 1 }]
              });
      if (fail === "before") await assert.rejects(perform(), /receipt failed/);
      else await perform();
      assert.equal(f.target.system.actionDice.value, fail === "before" ? 1 : 0);
      assert.equal(f.target.system.bonusActionDice.mp.remaining, fail === "before" ? 1 : 0);
      assert.equal(f.target.system.bonusActionDice.other.remaining, workflow === "boost" && fail === "after" ? 0 : 1);
      assert.equal(f.donor.system.bonusActionDice.mp.remaining, workflow === "generous" && fail === "after" ? 3 : 4);
    }
});
test("incorrect split boost fees fail before RNG and cannot overpay an already settled check surcharge", async () => {
  for (const workflow of ["boost", "generous"])
    for (const parts of [
      true,
      [{ count: 1 }],
      [{ count: 3 }],
      [{ count: NaN }],
      [{ count: 0 }, { count: 2 }],
      [{ bonusPoolId: "Actor.donor|mp", count: 2 }]
    ]) {
      const f = generousFixture();
      splitFeeSetup(f.target);
      const result =
        workflow === "boost"
          ? f.target.boostCheck(f.m, { bonusPoolId: "other", count: 1, surchargeAllocations: parts })
          : f.target.boostWithGenerous(f.m, { ...f.opts, surchargeAllocations: parts });
      if (workflow === "boost") await assert.rejects(result);
      else assert.equal(await result, null);
      assert.equal(formulas.length, 0);
      assert.equal(f.target.system.actionDice.value, 1);
      assert.equal(f.donor.system.bonusActionDice.mp.remaining, 4);
    }
  const a = actor(),
    m = boostMessage(a);
  a.system.conditionContext.shakenGrade = 2;
  a.system.actionDice.value = 4;
  await a.boostCheck(m, { count: 1 });
  await assert.rejects(a.boostCheck(m, { count: 1, surchargeAllocations: [{ count: 1 }] }), /remaining 0-die/);
  assert.equal(formulas.length, 1);
  assert.equal(a.system.actionDice.value, 2);
});

import { mixedHealingQuote } from "../module/rules/healing-payments.mjs";
import { mixedHealingFundingInput, mixedHealingFundingControl } from "../module/apps/healing-payments.mjs";
function mixedHealActor(grade = 0) {
  const a = actor();
  a.system.conditionContext.shakenGrade = grade;
  a.system.actionDice.value = grade ? 2 : 1;
  a.system.bonusActionDice.mp.remaining = grade ? 2 : 1;
  return a;
}
const mixedVit = { healingAllocations: [{ vitalityDice: 1 }, { bonusPoolId: "mp", vitalityDice: 1 }] },
  mixedFee = { surchargeAllocations: [{ count: 1 }, { bonusPoolId: "mp", count: 1 }] };
test("healing can combine insufficient individual wallets while retaining each exploding benefit die and modifier", async () => {
  const a = mixedHealActor(),
    r = await a.healWithActionDice(mixedVit);
  assert.equal(r.healedVitality, 6);
  assert.equal(r.cost, 2);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(formulas.length, 1);
  assert.match(formulas[0], /1d8x>=7 \+ \(1\).*1d4x>=3 \+ \(1\)/);
  const funding = posts[0].flags.spycraft2.funding;
  assert.equal(funding.die, null);
  assert.deepEqual(
    funding.healingSources.map(p => p.die),
    [8, 4]
  );
  assert.equal(funding.allocations.length, 2);
  assert.equal(funding.totalCost, 2);
  assert.ok(funding.paymentId);
});
test("Shaken charges one healing fee across multiple benefit sources and fee dice never add vitality results", async () => {
  const a = mixedHealActor(3),
    r = await a.healWithActionDice({ ...mixedVit, ...mixedFee });
  assert.equal(r.baseCost, 2);
  assert.equal(r.benefitCount, 1);
  assert.equal(r.surcharge, 2);
  assert.equal(r.cost, 4);
  assert.equal(r.healedVitality, 6);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(formulas[0].match(/1d/g).length, 2);
  assert.equal(posts[0].flags.spycraft2.funding.healingSources.length, 2);
});
test("mixed-source wound benefits restore exactly two each and never roll their source dice or fee dice", async () => {
  for (const onlyWounds of [false, true]) {
    const a = mixedHealActor(3),
      r = await a.healWithActionDice({
        ...mixedFee,
        healingAllocations: [
          { woundDice: 1 },
          { bonusPoolId: "mp", ...(onlyWounds ? { woundDice: 1 } : { vitalityDice: 1 }) }
        ]
      });
    assert.equal(r.healedWounds, onlyWounds ? 4 : 2);
    assert.equal(r.healedVitality, onlyWounds ? 0 : 3);
    assert.equal(r.surcharge, 2);
    assert.equal(formulas.length, onlyWounds ? 0 : 1);
    if (!onlyWounds) assert.match(formulas[0], /^1d4x>=3/);
  }
});
test("duplicate healing rows budget one source together and preserve exact contribution roles", async () => {
  const a = mixedHealActor(3);
  a.system.bonusActionDice.mp.remaining = 3;
  const r = await a.healWithActionDice({
    healingAllocations: [
      { bonusPoolId: "mp", vitalityDice: 1 },
      { bonusPoolId: "mp", woundDice: 1 }
    ],
    surchargeBonusPoolId: ""
  });
  assert.equal(r.cost, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(posts[0].flags.spycraft2.funding.healingSources.length, 1);
  assert.equal(posts[0].flags.spycraft2.funding.healingSources[0].woundDice, 1);
});
test("malformed, exhausted, bound and incomplete healing allocations reject before RNG or health changes", async () => {
  for (const healingAllocations of [
    true,
    [],
    [{ vitalityDice: 0 }],
    [{ vitalityDice: 1.5 }],
    [{ vitalityDice: true }],
    [{ vitalityDice: "1" }],
    [{ bonusPoolId: "gone", vitalityDice: 1 }],
    [{ vitalityDice: 2 }],
    [
      { bonusPoolId: "mp", vitalityDice: 1 },
      { bonusPoolId: "mp", vitalityDice: 1 }
    ]
  ]) {
    const a = mixedHealActor();
    assert.equal(await a.healWithActionDice({ healingAllocations }), null);
    assert.equal(formulas.length, 0);
    assert.equal(a.system.vitality.value, 4);
    assert.equal(a.system.actionDice.value, 1);
    assert.equal(a.system.bonusActionDice.mp.remaining, 1);
  }
  const a = mixedHealActor();
  a.system.bonusActionDice.bound = { id: "bound", source: "iKnowWhatDoing", die: 10, remaining: 1, granted: 1 };
  assert.equal(await a.healWithActionDice({ healingAllocations: [{ bonusPoolId: "bound", vitalityDice: 1 }] }), null);
  assert.equal(formulas.length, 0);
});
test("mixed healing still prohibits combat, death, full selected resources and Shaken IV before spending", async () => {
  for (const blocked of ["combat", "dead", "full", "iv"]) {
    const a = mixedHealActor(blocked === "iv" ? 4 : 0);
    if (blocked === "combat") combatFor(a);
    if (blocked === "dead") a.statuses.add("dead");
    if (blocked === "full") a.system.vitality.value = a.system.vitality.max;
    assert.equal(await a.healWithActionDice(mixedVit), null);
    assert.equal(a.system.actionDice.value, blocked === "iv" ? 2 : 1);
    assert.equal(formulas.length, 0);
  }
});
test("mixed healing caps the combined gain once at the current maximum without changing wound or fee benefit amounts", async () => {
  const a = mixedHealActor();
  a.system.vitality.max = 7;
  const r = await a.healWithActionDice(mixedVit);
  assert.equal(r.healedVitality, 3);
  assert.equal(a.system.vitality.value, 7);
  assert.equal(a.system.wounds.value, 4);
  assert.equal(r.cost, 2);
});
test("failed mixed healing posts restore each actual wallet and only their own healing while committed posts retain one payment", async () => {
  for (const fail of ["before", "after"]) {
    const a = mixedHealActor(3);
    postFailure = fail;
    postHook = () => {
      a.system.wounds.value--;
    };
    if (fail === "before") await assert.rejects(a.healWithActionDice({ ...mixedVit, ...mixedFee }), /post failed/);
    else await a.healWithActionDice({ ...mixedVit, ...mixedFee });
    assert.equal(a.system.actionDice.value, fail === "before" ? 2 : 0);
    assert.equal(a.system.bonusActionDice.mp.remaining, fail === "before" ? 2 : 0);
    assert.equal(a.system.vitality.value, fail === "before" ? 4 : 10);
    assert.equal(a.system.wounds.value, 3);
    assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, fail === "before" ? "refunded" : "spent");
  }
});
test("changed modifiers or Shaken sources during mixed healing abort and refund without applying health", async () => {
  for (const change of ["bonus", "shaken"]) {
    const a = mixedHealActor(3);
    rollHook = () => {
      if (change === "bonus") a.system.actionDice.bonus++;
      else a.system.conditionContext.shakenGrade = 2;
    };
    await assert.rejects(a.healWithActionDice({ ...mixedVit, ...mixedFee }), /changed/);
    assert.equal(a.system.actionDice.value, 2);
    assert.equal(a.system.bonusActionDice.mp.remaining, 2);
    assert.equal(a.system.vitality.value, 4);
  }
});
test("a changed grant during mixed healing holds its actual payment rather than refunding dice into the replacement", async () => {
  const a = mixedHealActor(3);
  rollHook = () => {
    a.system.bonusActionDice.mp.die = 6;
  };
  await assert.rejects(a.healWithActionDice({ ...mixedVit, ...mixedFee }));
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.bonusActionDice.mp.die, 6);
  assert.equal(a.system.actionDiceSettlementReview.needsReview, true);
});
test("missing final mixed-healing receipts retain the actual health and hold all selected wallets for GC review", async () => {
  const a = mixedHealActor(3),
    update = a.update;
  a.update = async function (p) {
    if (Object.values(p).some(v => v?.state === "spent")) throw Error("final payment marker rejected");
    return update.call(this, p);
  };
  const r = await a.healWithActionDice({ ...mixedVit, ...mixedFee });
  assert.equal(r.healedVitality, 6);
  assert.equal(a.system.vitality.value, 10);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.actionDiceSettlementReview.needsReview, true);
  assert.equal(a.system.actionDiceSettlementReview.healingSources.length, 2);
});
test("mixed-healing form parsing preserves disappeared source identifiers and invalid amounts rather than falling back to ordinary dice", () => {
  const a = mixedHealActor();
  for (const input of [
    { healingVitality__pool_gone: "1" },
    { healingVitality__ordinary: "bad" },
    { healingVitality__ordinary: true },
    { healingVitality__ordinary: "-1", healingWounds__pool_mp: "2" }
  ])
    assert.throws(() => mixedHealingQuote(a, { healingAllocations: mixedHealingFundingInput(input) }));
  assert.equal(mixedHealingFundingInput({ healingVitality__ordinary: "0", healingWounds__pool_mp: "" }), undefined);
  assert.deepEqual(mixedHealingFundingInput({ healingVitality__ordinary: "1", healingWounds__pool_mp: "1" }), [
    { bonusPoolId: "", vitalityDice: 1, woundDice: 0 },
    { bonusPoolId: "mp", vitalityDice: 0, woundDice: 1 }
  ]);
  const html = mixedHealingFundingControl(a);
  assert.ok(html.includes("healingVitality__ordinary"));
  assert.ok(html.includes("healingWounds__pool_mp"));
  assert.ok(html.includes("first nonzero benefit contribution"));
});
test("malformed empty or unknown wallet form identifiers cannot redirect a contribution into ordinary dice", () => {
  const a = mixedHealActor(3);
  for (const key of ["surchargePart__pool_", "surchargePart__unknown"])
    assert.throws(() =>
      actionDieBenefitQuote(a, { baseCost: 1, bonusPoolId: "mp", ...surchargeFundingInput({ [key]: "2" }) })
    );
  for (const key of ["unrolledPart__pool_", "unrolledPart__unknown"])
    assert.throws(() => actionDieBenefitQuote(a, { baseCost: 1, ...unrolledPaymentFundingInput({ [key]: "3" }) }));
  for (const key of ["healingVitality__pool_", "healingVitality__unknown"])
    assert.throws(() =>
      mixedHealingQuote(a, { healingAllocations: mixedHealingFundingInput({ [key]: "1" }), ...mixedFee })
    );
});

test("actual damage roll rechecks target protection before RNG and before posting a result", async () => {
  const old = globalThis.fromUuid;
  const target = {
    uuid: "Actor.protection",
    documentName: "Actor",
    type: "agent",
    system: { armorFeatRules: { sneakAttackImmune: false }, armor: { items: ["vest"] } }
  };
  globalThis.fromUuid = async () => target;
  const { sneakAttackTargetSnapshot } = await import("../module/apps/damage-target.mjs");
  try {
    for (const duringRoll of [false, true]) {
      const a = actor(),
        snapshot = sneakAttackTargetSnapshot(target);
      if (duringRoll)
        rollHook = () => {
          target.system.armorFeatRules.sneakAttackImmune = true;
        };
      else target.system.armorFeatRules.sneakAttackImmune = true;
      await assert.rejects(a.rollCheck("1d6", {}, { checkKind: "damage", sneakAttackTarget: snapshot }), /changed/);
      assert.equal(formulas.length, duringRoll ? 1 : 0);
      assert.equal(posts.length, 0);
      assert.equal(a.system.bonusActionDice.mp.remaining, 4);
      target.system.armorFeatRules.sneakAttackImmune = false;
    }
    const a = actor(),
      snapshot = sneakAttackTargetSnapshot(target);
    await a.rollCheck("1d6", {}, { checkKind: "damage", sneakAttackTarget: snapshot });
    assert.deepEqual(posts[0].flags.spycraft2.sneakAttackTarget, snapshot);
  } finally {
    globalThis.fromUuid = old;
  }
});

test("explicit cancelled paid work restores the selected bonus wallet and every reserved use, while a successful void callback still consumes its declared use", async () => {
  const a = rerollActor();
  a.system.limitedUses.push({
    id: "cancelExtra",
    name: "Additional use",
    period: "scene",
    limit: 1,
    cost: 0,
    workflow: "extra"
  });
  const result = await a.useLimitedAbility("meticulous", async () => null, {
    workflow: "reroll",
    bonusPoolId: "mp",
    additionalUses: [{ id: "cancelExtra", workflow: "extra" }]
  });
  assert.equal(result, null);
  assert.equal(a.system.bonusActionDice.mp.remaining, 4);
  assert.equal(a.system.resourceUses.meticulous, undefined);
  assert.equal(a.system.resourceUses.cancelExtra, undefined);
  assert.equal(a.flags?.spycraft2?.actionDiceSettlementReview?.needsReview ?? false, false);
  const b = rerollActor();
  await b.useLimitedAbility("meticulous", async () => {}, { workflow: "reroll", bonusPoolId: "mp" });
  assert.equal(b.system.bonusActionDice.mp.remaining, 3);
  assert.equal(b.system.resourceUses.meticulous.used, 1);
});
test("cancelled work whose wallet restoration fails remains held for GC review with its reserved class use, rather than appearing cancelled and free to retry", async () => {
  const a = rerollActor();
  a.fail.refundBefore = true;
  await assert.rejects(a.useLimitedAbility("meticulous", async () => null, { workflow: "reroll", bonusPoolId: "mp" }));
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(a.system.resourceUses.meticulous.used, 1);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.limitedUseSettlement[0].id, "meticulous");
});
