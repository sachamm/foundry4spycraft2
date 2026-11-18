import test from "node:test";
import assert from "node:assert/strict";
import {
  restraintSourceSnapshot,
  restraintReleasePlan,
  getRestraintReleaseReview,
  getPendingRestraintMoves,
  restraintActionBlock
} from "../module/rules/restraints.mjs";
import {
  applyRestraintEscape,
  reviewRestraintRelease,
  confirmRestraintEscapeMove
} from "../module/apps/restraint-release.mjs";
import { attributeActionBlock } from "../module/rules/attributes.mjs";
globalThis.game = {
  user: { id: "gc", isGM: true },
  time: { worldTime: 0 },
  settings: { get: () => ({}) },
  spycraft2: {}
};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = {
  utils: { escapeHTML: s => s },
  applications: { api: { DialogV2: { input: async () => null } } }
};
let sequence = 0;
function merge(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split(".");
    let o = target;
    for (const key of keys.slice(0, -1)) o = o[key] ??= {};
    const last = keys.at(-1);
    if (last.startsWith("-=")) delete o[last.slice(2)];
    else o[last] = structuredClone(value);
  }
}
function actor(data = [{ _id: "pin", name: "Pin", statuses: ["pinned"], changes: [], flags: { other: { keep: 1 } } }]) {
  const a = {
    uuid: "Actor.release" + ++sequence,
    isOwner: true,
    type: "agent",
    flags: {},
    effects: [],
    foreign: [],
    baseSpeed: 30,
    system: { actionDice: { value: 3 }, wounds: { value: 7 } },
    fail: null
  };
  const effect = d => ({
    ...structuredClone(d),
    id: d._id,
    active: !d.disabled,
    statuses: new Set(d.statuses),
    changes: d.changes ?? [],
    toObject() {
      const { id, active, statuses, toObject, ...rest } = this;
      return { ...structuredClone(rest), statuses: [...statuses].sort() };
    }
  });
  a.effects = data.map(effect);
  Object.defineProperty(a, "appliedEffects", { get: () => [...a.effects, ...a.foreign].filter(e => e.active) });
  a.refresh = () => {
    a.statuses = new Set(a.appliedEffects.flatMap(e => [...e.statuses]));
    a.system.conditionContext = Object.fromEntries(["held", "pinned", "bound"].map(k => [k, a.statuses.has(k)]));
    a.system.speed = ["held", "pinned", "bound"].some(k => a.statuses.has(k)) ? 0 : a.baseSpeed;
    a.system.restraintReleaseReview = getRestraintReleaseReview(a);
    a.system.pendingRestraintMoves = getPendingRestraintMoves(a);
  };
  a.updateEmbeddedDocuments = async (type, rows) => {
    if (a.fail === "updateBefore") {
      a.fail = null;
      throw Error("status update rejected");
    }
    for (const [i, row] of rows.entries()) {
      const e = a.effects.find(e => e.id === row._id);
      if (!e) throw Error("missing source");
      e.statuses = new Set(row.statuses);
      if (a.fail === "partial" && i === 0) {
        a.fail = null;
        a.refresh();
        throw Error("partial status update");
      }
    }
    a.refresh();
    await a.afterEffects?.(rows);
    if (a.fail === "updateAfter") {
      a.fail = null;
      throw Error("status update committed error");
    }
    if (a.fail === "restore" && rows.some(r => r.statuses.includes("pinned"))) throw Error("status restoration failed");
    return rows;
  };
  a.deleteEmbeddedDocuments = async (_type, ids) => {
    if (a.fail === "cleanupBefore") throw Error("cleanup rejected");
    a.effects = a.effects.filter(e => !ids.includes(e.id));
    a.refresh();
    if (a.fail === "cleanupAfter") throw Error("cleanup committed error");
  };
  a.update = async patch => {
    await a.beforeUpdate?.(patch);
    const receipt = Object.keys(patch).some(k => k.startsWith("flags.spycraft2.restraintReleases."));
    if (receipt && a.fail === "receiptBefore") throw Error("actor receipt rejected");
    merge(a, patch);
    a.refresh();
    if (receipt && a.fail === "receiptAfter") {
      a.fail = null;
      throw Error("actor receipt committed error");
    }
    return a;
  };
  a.refresh();
  return a;
}
function message(a, options = {}) {
  const source = restraintSourceSnapshot(a),
    m = {
      id: "roll" + ++sequence,
      uuid: "ChatMessage.roll" + sequence,
      blind: false,
      flags: {
        spycraft2: {
          actorUuid: a.uuid,
          checkKind: "skill",
          skillKey: "athletics",
          checkId: "restraint-escape",
          checkMethod: "roll",
          ability: "str",
          rawTotal: 18,
          effectiveTotal: 18,
          resolved: true,
          successConfirmed: true,
          restraintEscape: {
            condition: source.pinned ? "pinned" : "held",
            kind: "opposedGrapple",
            sourceSnapshot: source,
            sourceScopeConfirmed: source.sources.length === 1
          },
          ...options
        }
      }
    };
  m.update = async patch => {
    if (m.fail === "before") throw Error("chat annotation rejected");
    merge(m, patch);
    if (m.fail === "after") throw Error("chat annotation committed error");
    return m;
  };
  return m;
}
const benefit = (benefit = "breakPin") => ({ benefit, confirmed: true });
test("one successful pin benefit leaves Held; a new successful hold benefit releases it and requires immediate movement", async () => {
  const a = actor(),
    m = message(a);
  const pin = await applyRestraintEscape(a, m, benefit());
  assert.equal(pin.benefitsUsed, 1);
  assert.equal(a.statuses.has("pinned"), false);
  assert.equal(a.statuses.has("held"), true);
  assert.equal(a.system.speed, 0);
  assert.equal(pin.movement, null);
  const hold = message(a),
    free = await applyRestraintEscape(a, hold, benefit("escapeHold"));
  assert.equal(a.statuses.has("held"), false);
  assert.equal(a.system.speed, 30);
  assert.equal(a.effects.length, 0);
  assert.deepEqual(free.movement, { state: "required", minimum: 5, maximum: 30 });
  assert.equal(a.system.pendingRestraintMoves.length, 1);
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.system.wounds.value, 7);
});
test("two escape benefits require a critical success or confirmed opponent critical failure", async () => {
  for (const critical of ["none", "self", "opponent"]) {
    const a = actor(),
      m = message(a, { criticalSuccess: critical === "self" }),
      input = { ...benefit("breakPinAndEscapeHold"), opponentCriticalFailureConfirmed: critical === "opponent" };
    if (critical === "none") {
      await assert.rejects(applyRestraintEscape(a, m, input), /earned/);
      assert.equal(a.statuses.has("pinned"), true);
    } else {
      const r = await applyRestraintEscape(a, m, input);
      assert.equal(r.benefitsUsed, 2);
      assert.equal(a.statuses.size, 0);
      assert.equal(r.movement.state, "required");
    }
  }
});
test("a completed old result cannot clear a new hold, and queued duplicate clicks never apply its benefit twice", async () => {
  const a = actor(),
    m = message(a),
    [x, y] = await Promise.all([applyRestraintEscape(a, m, benefit()), applyRestraintEscape(a, m, benefit())]);
  assert.deepEqual(x, y);
  a.effects[0].origin = "New independent hold";
  a.refresh();
  assert.deepEqual(await applyRestraintEscape(a, m, benefit()), x);
  assert.equal(a.statuses.has("held"), true);
});
test("legacy, replaced, unresolved, failed, foreign, malformed and secret results cannot release conditions", async () => {
  for (const change of ["legacy", "replaced", "unresolved", "failed", "foreign", "secret", "notGrapple", "nonfinite"]) {
    const a = actor(),
      m = message(a);
    if (change === "legacy") delete m.flags.spycraft2.restraintEscape.sourceSnapshot;
    if (change === "replaced") m.flags.spycraft2.superseded = "other";
    if (change === "unresolved") m.flags.spycraft2.resolved = false;
    if (change === "failed") m.flags.spycraft2.successConfirmed = false;
    if (change === "foreign") m.flags.spycraft2.actorUuid = "Actor.other";
    if (change === "secret") {
      m.blind = true;
      game.user.isGM = false;
    }
    if (change === "notGrapple") m.flags.spycraft2.checkId = "escape";
    if (change === "nonfinite") m.flags.spycraft2.rawTotal = NaN;
    try {
      if (change === "foreign") assert.equal(await applyRestraintEscape(a, m, benefit()), null);
      else await assert.rejects(applyRestraintEscape(a, m, benefit()));
      assert.equal(a.statuses.has("pinned"), true);
    } finally {
      game.user.isGM = true;
    }
  }
});
test("changed/replaced/timed/continuing item sources stop release before mutation", async () => {
  for (const change of ["origin", "replacement", "timed", "timedV14", "item"]) {
    const a = actor();
    if (change === "timed") a.effects[0].duration = { rounds: 2 };
    if (change === "timedV14") a.effects[0].duration = { value: 30, units: "seconds" };
    if (change === "item")
      a.foreign = [{ id: "itempin", uuid: "Item.pin", active: true, statuses: new Set(["pinned"]) }];
    a.refresh();
    const m = message(a);
    if (change === "origin") a.effects[0].origin = "new";
    if (change === "replacement") a.effects[0].id = "new";
    await assert.rejects(applyRestraintEscape(a, m, benefit()), /sources|timed|foreign/);
    assert.equal(a.statuses.has("pinned"), true);
    assert.equal(a.flags.spycraft2?.restraintReleases, undefined);
  }
});
test("compound sources preserve independent statuses, stat changes, names, flags and duration", async () => {
  const a = actor([
      {
        _id: "pin",
        name: "Independent conditions",
        statuses: ["pinned", "blind"],
        changes: [{ key: "system.misc.defense", value: "1" }],
        duration: { rounds: 4 },
        flags: { other: { keep: 7 } }
      },
      { _id: "hold", name: "Original hold", statuses: ["held"] }
    ]),
    before = a.effects[0].toObject(),
    m = message(a);
  m.flags.spycraft2.restraintEscape.sourceScopeConfirmed = true;
  await applyRestraintEscape(a, m, benefit());
  assert.deepEqual(a.effects[0].toObject(), { ...before, statuses: ["blind"] });
  assert.equal(a.statuses.has("held"), true);
  assert.equal(a.statuses.has("blind"), true);
});
test("status and actor receipt failures are reconciled before/after commit without duplicate release", async () => {
  for (const failure of ["updateBefore", "updateAfter", "receiptBefore", "receiptAfter"]) {
    const a = actor(),
      m = message(a),
      before = a.effects.map(e => e.toObject());
    a.fail = failure;
    if (["updateBefore", "receiptBefore"].includes(failure)) {
      await assert.rejects(applyRestraintEscape(a, m, benefit()), /rejected/);
      assert.deepEqual(
        a.effects.map(e => e.toObject()),
        before
      );
      assert.equal(getRestraintReleaseReview(a).needsReview, undefined);
      a.fail = null;
      await applyRestraintEscape(a, m, benefit());
    } else assert.equal((await applyRestraintEscape(a, m, benefit())).state, "applied");
    assert.equal(a.statuses.has("held"), true);
    assert.equal(a.statuses.has("pinned"), false);
    assert.equal(Object.keys(a.flags.spycraft2.restraintReleases).length, 1);
  }
});
test("a partial multiple-source update restores only its own changed statuses", async () => {
  const a = actor([
      { _id: "p", name: "Pin", statuses: ["pinned"] },
      { _id: "h", name: "Hold", statuses: ["held"] }
    ]),
    m = message(a, { criticalSuccess: true }),
    before = a.effects.map(e => e.toObject());
  m.flags.spycraft2.restraintEscape.sourceScopeConfirmed = true;
  a.fail = "partial";
  await assert.rejects(applyRestraintEscape(a, m, benefit("breakPinAndEscapeHold")), /partial/);
  assert.deepEqual(
    a.effects.map(e => e.toObject()),
    before
  );
  assert.equal(getRestraintReleaseReview(a).needsReview, undefined);
});
test("independent status changes during failed receipt restoration are preserved and hold the release for GC review", async () => {
  const a = actor(),
    m = message(a);
  a.fail = "receiptBefore";
  a.beforeUpdate = async patch => {
    if (Object.keys(patch).some(k => k.startsWith("flags.spycraft2.restraintReleases."))) {
      a.effects[0].statuses.add("blind");
      a.refresh();
    }
  };
  await assert.rejects(applyRestraintEscape(a, m, benefit()), /GC review/);
  assert.equal(a.statuses.has("blind"), true);
  assert.equal(getRestraintReleaseReview(a).needsReview, true);
  await assert.rejects(applyRestraintEscape(a, m, benefit()), /review/);
  assert.match(attributeActionBlock(a.system), /review/);
  assert.match(restraintActionBlock(a.system), /review/);
  a.fail = null;
  a.beforeUpdate = null;
  const result = await reviewRestraintRelease(a, m, {
    disposition: "keep",
    resolution: "Reviewed preserved sources",
    confirmed: true
  });
  assert.equal(result.state, "reviewed");
  assert.equal(getRestraintReleaseReview(a).needsReview, false);
  assert.equal((await applyRestraintEscape(a, m, benefit())).state, "reviewed");
  assert.equal(a.statuses.has("blind"), true);
});
test("optional cleanup and chat annotation failures do not reverse a committed release or allow another benefit", async () => {
  for (const failure of ["cleanupBefore", "cleanupAfter", "messageBefore", "messageAfter"]) {
    const a = actor([{ _id: "hold", name: "Hold", statuses: ["held"] }]),
      m = message(a);
    if (failure.startsWith("cleanup")) a.fail = failure;
    else m.fail = failure === "messageBefore" ? "before" : "after";
    const r = await applyRestraintEscape(a, m, benefit("escapeHold"));
    assert.equal(r.state, "applied");
    assert.equal(a.statuses.has("held"), false);
    assert.equal((await applyRestraintEscape(a, m, benefit("escapeHold"))).id, r.id);
    assert.equal(a.system.actionDice.value, 3);
  }
});
test("mandatory movement blocks further voluntary actions until actual legal movement is recorded once, including committed receipt errors", async () => {
  const a = actor([{ _id: "h", name: "Hold", statuses: ["held"] }]),
    m = message(a);
  await applyRestraintEscape(a, m, benefit("escapeHold"));
  assert.match(attributeActionBlock(a.system, { kind: "attack" }), /immediate/);
  assert.match(restraintActionBlock(a.system, { free: true }), /immediate/);
  assert.equal(attributeActionBlock(a.system, { passiveAction: true }), "");
  for (const distance of [0, 4, 31, NaN, true])
    await assert.rejects(confirmRestraintEscapeMove(a, m, { distance, confirmed: true }), /Confirm/);
  a.fail = "receiptAfter";
  const result = await confirmRestraintEscapeMove(a, m, { distance: 5, confirmed: true });
  assert.equal(result.movement.state, "completed");
  assert.equal(getPendingRestraintMoves(a).length, 0);
  assert.equal(attributeActionBlock(a.system), "");
  assert.deepEqual(await confirmRestraintEscapeMove(a, m, { distance: 20, confirmed: true }), result);
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.system.wounds.value, 7);
});
test("unknown movement capacity needs the GC and a recorded explanation; known immobility prevents an impossible Escape Hold", async () => {
  const a = actor([{ _id: "h", name: "Hold", statuses: ["held"] }]);
  a.baseSpeed = null;
  const m = message(a);
  await applyRestraintEscape(a, m, benefit("escapeHold"));
  game.user.isGM = false;
  try {
    await assert.rejects(
      confirmRestraintEscapeMove(a, m, {
        distance: 5,
        approvedMaximum: 15,
        resolution: "Reviewed capacity",
        confirmed: true
      }),
      /GC/
    );
  } finally {
    game.user.isGM = true;
  }
  await assert.rejects(
    confirmRestraintEscapeMove(a, m, { distance: 5, approvedMaximum: 15, confirmed: true }),
    /explanation/
  );
  const r = await confirmRestraintEscapeMove(a, m, {
    distance: 5,
    approvedMaximum: 15,
    resolution: "GC verified capacity for this move",
    confirmed: true
  });
  assert.equal(r.movement.maximum, 15);
  const b = actor([{ _id: "h", name: "Hold", statuses: ["held"] }]);
  b.baseSpeed = 0;
  const n = message(b);
  await assert.rejects(applyRestraintEscape(b, n, benefit("escapeHold")), /immobility/);
  assert.equal(b.statuses.has("held"), true);
});
test("GC reviews reject changed source/role/roll state and require movement adjudication for a kept Escape Hold", async () => {
  const a = actor(),
    m = message(a);
  const plan = restraintReleasePlan(a, m, benefit());
  a.flags.spycraft2 = {
    restraintReleaseReview: {
      id: m.id,
      messageUuid: m.uuid,
      evidence: (await import("../module/rules/outcomes.mjs")).rollEvidence(m.flags.spycraft2),
      plan,
      needsReview: true
    }
  };
  a.refresh();
  const original = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => {
      a.effects[0].origin = "new";
      return { disposition: "cancel", resolution: "Reviewed", confirmed: true };
    };
    await assert.rejects(reviewRestraintRelease(a, m), /sources changed/);
  } finally {
    foundry.applications.api.DialogV2.input = original;
  }
  game.user.isGM = false;
  try {
    await assert.rejects(
      reviewRestraintRelease(a, m, { disposition: "cancel", resolution: "Reviewed", confirmed: true }),
      /Only the GC/
    );
  } finally {
    game.user.isGM = true;
  }
});

test("multiple restraint sources require confirmation that they belong to this same grapple, and cannot silently erase independent holds", async () => {
  const a = actor([
      { _id: "one", name: "First holder", statuses: ["held"] },
      { _id: "two", name: "Independent holder", statuses: ["held"] }
    ]),
    m = message(a);
  await assert.rejects(applyRestraintEscape(a, m, benefit("escapeHold")), /same grapple/);
  assert.equal(a.effects.length, 2);
  assert.equal(a.statuses.has("held"), true);
});

test("a rejected movement receipt leaves the same mandatory move pending without changing effects or resources", async () => {
  const a = actor([{ _id: "h", name: "Hold", statuses: ["held"] }]),
    m = message(a);
  await applyRestraintEscape(a, m, benefit("escapeHold"));
  a.fail = "receiptBefore";
  await assert.rejects(confirmRestraintEscapeMove(a, m, { distance: 5, confirmed: true }), /receipt rejected/);
  assert.equal(getPendingRestraintMoves(a).length, 1);
  assert.equal(a.statuses.size, 0);
  assert.equal(a.system.actionDice.value, 3);
  a.fail = null;
  const result = await confirmRestraintEscapeMove(a, m, { distance: 5, confirmed: true });
  assert.equal(result.movement.distance, 5);
});
test("GC release recovery requires separate movement adjudication and reconciles committed final review writes without altering actual effects", async () => {
  for (const disposition of ["keep", "cancel"]) {
    const a = actor([{ _id: "h", name: "Hold", statuses: ["held"] }]),
      m = message(a);
    a.fail = "receiptBefore";
    a.beforeUpdate = async patch => {
      if (Object.keys(patch).some(k => k.startsWith("flags.spycraft2.restraintReleases."))) {
        a.effects[0].statuses.add("blind");
        a.refresh();
      }
    };
    await assert.rejects(applyRestraintEscape(a, m, benefit("escapeHold")), /GC review/);
    a.fail = null;
    a.beforeUpdate = null;
    const before = a.effects.map(e => e.toObject());
    if (disposition === "keep")
      await assert.rejects(
        reviewRestraintRelease(a, m, { disposition, resolution: "Reviewed actual release", confirmed: true }),
        /movement/
      );
    a.fail = "receiptAfter";
    const result = await reviewRestraintRelease(a, m, {
      disposition,
      resolution: "Reviewed actual release and movement separately",
      movementResolvedConfirmed: true,
      confirmed: true
    });
    assert.equal(result.state, disposition === "keep" ? "reviewed" : "cancelled");
    assert.deepEqual(
      a.effects.map(e => e.toObject()),
      before
    );
    assert.equal(getRestraintReleaseReview(a).needsReview, false);
    assert.equal(getPendingRestraintMoves(a).length, 0);
    assert.equal((await applyRestraintEscape(a, m, benefit("escapeHold"))).state, result.state);
    assert.equal(a.system.actionDice.value, 3);
  }
});

test("an already applied grapple benefit rejects later source-proof additions instead of accepting legacy evidence during replay", async () => {
  for (const patch of [
    { trackingFeat: { version: 1 } },
    { trackingMasteryTask: { version: 1 } },
    { criticalActivation: { jinx: { version: 1 } } },
    { terrainSaveSource: { version: 1 } },
    { oldSchool: { version: 1 } }
  ]) {
    const a = actor(),
      m = message(a),
      r = await applyRestraintEscape(a, m, benefit()),
      before = structuredClone(a.flags.spycraft2),
      effects = a.effects.map(e => e.toObject());
    Object.assign(m.flags.spycraft2, patch);
    await assert.rejects(() => applyRestraintEscape(a, m, benefit()), /changed/);
    assert.deepEqual(a.flags.spycraft2, before);
    assert.deepEqual(
      a.effects.map(e => e.toObject()),
      effects
    );
    assert.equal(a.statuses.has("held"), true);
    assert.equal(a.statuses.has("pinned"), false);
    assert.equal(r.benefit, "breakPin");
  }
});
