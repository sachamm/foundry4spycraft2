import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionDicePlan,
  startUsagePeriod,
  refreshUsagePeriodActors,
  getUsagePeriodReview,
  reviewUsagePeriod
} from "../module/services/periods.mjs";
let periods, review, gcPool, serial, failSetting, failActor, warnings;
function actor(id, value, max, type = "agent") {
  return {
    id,
    uuid: `Actor.${id}`,
    name: id,
    type,
    flags: {},
    system: { level: 1, actionDice: { value, max, die: 4 } },
    sheet: { render() {} },
    async update(data) {
      if (failActor === id) throw Error("actor write failed");
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let o = this;
        for (const key of keys.slice(0, -1)) o = o[key] ??= {};
        const key = keys.at(-1);
        if (key.startsWith("-=")) delete o[key.slice(2)];
        else o[key] = structuredClone(value);
      }
    }
  };
}
function reset() {
  periods = { session: "old", scene: "scene", mission: "mission" };
  review = {};
  gcPool = { session: "old", value: 7 };
  serial = 0;
  failSetting = false;
  failActor = "";
  warnings = [];
  globalThis.game = {
    user: { isGM: true },
    actors: [actor("a", 9, 3), actor("b", 0, 6), actor("npc", 8, 0, "npc")],
    scenes: [],
    settings: {
      get: (_s, key) => (key === "usagePeriodReview" ? review : key === "gcActionDice" ? gcPool : periods),
      set: async (_s, key, value) => {
        if (failSetting) throw Error("period write failed");
        if (key === "usagePeriodReview") review = structuredClone(value);
        else if (key === "gcActionDice") gcPool = structuredClone(value);
        else periods = structuredClone(value);
      }
    }
  };
  globalThis.foundry = { utils: { randomID: () => `epoch${++serial}`, escapeHTML: s => String(s) } };
  globalThis.ui = { notifications: { warn: s => warnings.push(s) } };
}
test("session startup replaces surplus/empty ordinary balances with current starting counts and leaves NPCs, XP and other epochs alone", async () => {
  reset();
  game.actors[0].system.xp = 350;
  game.actors[0].system.actionDieAwards = { m: { count: 2 } };
  const result = await startUsagePeriod("session");
  assert.equal(result.session, "epoch1");
  assert.equal(result.scene, "scene");
  assert.equal(result.mission, "mission");
  assert.deepEqual(
    game.actors.map(a => a.system.actionDice.value),
    [3, 6, 8]
  );
  assert.equal(game.actors[0].system.xp, 350);
  assert.deepEqual(game.actors[0].system.actionDieAwards, { m: { count: 2 } });
});
test("scene, mission and round reset counters without replenishing ordinary dice; non-GCs and unknown periods are rejected", async () => {
  for (const period of ["scene", "mission", "round"]) {
    reset();
    await startUsagePeriod(period);
    assert.deepEqual(
      game.actors.map(a => a.system.actionDice.value),
      [9, 0, 8]
    );
    assert.equal(periods.session, "old");
  }
  reset();
  game.user.isGM = false;
  await assert.rejects(startUsagePeriod("session"), /Only the GC/);
  game.user.isGM = true;
  await assert.rejects(startUsagePeriod("combat"), /Unknown/);
  assert.equal(periods.session, "old");
});
test("actor or setting write failures restore prior balances and do not advance the period", async () => {
  for (const failure of ["actor", "setting"]) {
    reset();
    failActor = failure === "actor" ? "b" : "";
    failSetting = failure === "setting";
    await assert.rejects(startUsagePeriod("session"), /write failed/);
    assert.deepEqual(
      game.actors.map(a => a.system.actionDice.value),
      [9, 0, 8]
    );
    assert.equal(periods.session, "old");
  }
});
test("unlinked scene actors get independent starting pools; duplicate token references reset once", async () => {
  reset();
  const token = actor("token", 2, 5);
  token.isToken = true;
  game.scenes = [{ tokens: [{ actor: token }, { actor: token }, { actor: game.actors[0] }] }];
  await startUsagePeriod("session");
  assert.equal(token.system.actionDice.value, 5);
  assert.equal(game.actors[0].system.actionDice.value, 3);
});
test("invalid counts block all changes before the first write and sheet failures do not disguise a committed period as a failed reset", async () => {
  reset();
  game.actors[1].system.actionDice.max = 1.5;
  await assert.rejects(startUsagePeriod("session"), /review/);
  assert.equal(game.actors[0].system.actionDice.value, 9);
  assert.equal(periods.session, "old");
  for (const value of [-1, Infinity, NaN]) assert.throws(() => sessionDicePlan([actor("bad", value, 3)]), /review/);
  reset();
  game.actors[0].sheet.render = () => {
    throw Error("render failed");
  };
  assert.ok(await startUsagePeriod("session"));
  assert.equal(periods.session, "epoch1");
  assert.match(warnings[0], /already recorded/);
});

test("scene starts advance a safe duration sequence without changing other periods or dice; malformed/overflow history blocks before writes", async () => {
  reset();
  await startUsagePeriod("scene");
  assert.equal(periods.sceneSequence, 1);
  await startUsagePeriod("scene");
  assert.equal(periods.sceneSequence, 2);
  await startUsagePeriod("mission");
  assert.equal(periods.sceneSequence, 2);
  assert.deepEqual(
    game.actors.map(a => a.system.actionDice.value),
    [9, 0, 8]
  );
  for (const invalid of [-1, 1.5, "1", Number.MAX_SAFE_INTEGER]) {
    reset();
    periods.sceneSequence = invalid;
    await assert.rejects(startUsagePeriod("scene"), /scene sequence/);
    assert.equal(periods.scene, "scene");
    assert.deepEqual(
      game.actors.map(a => a.system.actionDice.value),
      [9, 0, 8]
    );
  }
});

test("period-change derivation refresh reaches each world/unlinked actor once, keeps other actors after a broken sheet and changes no resource balance", () => {
  reset();
  const token = actor("token", 2, 5);
  token.isToken = true;
  game.scenes = [{ tokens: [{ actor: token }, { actor: token }, { actor: game.actors[0] }] }];
  const calls = [];
  for (const a of [...game.actors, token]) a.reset = () => calls.push(a.id);
  game.actors[0].sheet.render = () => {
    throw Error("broken sheet");
  };
  refreshUsagePeriodActors();
  assert.deepEqual(calls.sort(), ["a", "b", "npc", "token"]);
  assert.deepEqual(
    game.actors.map(a => a.system.actionDice.value),
    [9, 0, 8]
  );
  assert.equal(token.system.actionDice.value, 2);
  assert.match(warnings.at(-1), /did not refresh/);
});

import { queueResources } from "../module/services/transactions.mjs";
import { spendGCDice } from "../module/services/gc-dice.mjs";
async function pendingStart() {
  reset();
  const a = game.actors[0],
    update = a.update.bind(a),
    set = game.settings.set;
  game.settings.set = async (scope, key, value) => {
    if (key === "usagePeriods") throw Error("startup setting failed");
    return set(scope, key, value);
  };
  a.update = async patch => {
    if (patch["system.actionDice.value"] === 9 && Object.hasOwn(patch, "flags.spycraft2.-=sessionDiceReset"))
      throw Error("starting rollback failed");
    return update(patch);
  };
  try {
    await assert.rejects(startUsagePeriod("session"), /startup setting failed/);
  } finally {
    a.update = update;
    game.settings.set = set;
  }
  assert.equal(getUsagePeriodReview().needsReview, true);
  return a;
}
test("session actor-credit and epoch-setting errors after commitment complete exactly one new start", async () => {
  for (const phase of ["actor", "setting"]) {
    reset();
    const a = game.actors[0],
      update = a.update.bind(a),
      set = game.settings.set;
    let once = true;
    if (phase === "actor")
      a.update = async patch => {
        await update(patch);
        if (once && patch["flags.spycraft2.sessionDiceReset"]) {
          once = false;
          throw Error("actor reset committed");
        }
      };
    else
      game.settings.set = async (scope, key, value) => {
        await set(scope, key, value);
        if (once && key === "usagePeriods") {
          once = false;
          throw Error("epoch committed");
        }
      };
    try {
      const result = await startUsagePeriod("session");
      assert.equal(result.session, "epoch1");
      assert.equal(periods.session, "epoch1");
      assert.deepEqual(
        game.actors.map(a => a.system.actionDice.value),
        [3, 6, 8]
      );
      assert.equal(a.flags.spycraft2.sessionDiceReset.session, "epoch1");
      assert.equal(gcPool.value, 7);
      assert.equal(gcPool.session, "old");
      assert.notEqual(getUsagePeriodReview().needsReview, true);
    } finally {
      game.settings.set = set;
    }
  }
});
test("startup rollback reconciles committed errors and preserves later independent currency changes", async () => {
  for (const variant of ["rollbackCommit", "laterChange"]) {
    reset();
    const a = game.actors[0],
      update = a.update.bind(a),
      set = game.settings.set;
    game.settings.set = async (scope, key, value) => {
      if (key === "usagePeriods") {
        if (variant === "laterChange") a.system.actionDice.value += 2;
        throw Error("period write failed");
      }
      return set(scope, key, value);
    };
    if (variant === "rollbackCommit")
      a.update = async patch => {
        await update(patch);
        if (Object.hasOwn(patch, "flags.spycraft2.-=sessionDiceReset")) throw Error("rollback committed");
      };
    try {
      await assert.rejects(startUsagePeriod("session"), /period write failed/);
      assert.equal(a.system.actionDice.value, variant === "laterChange" ? 11 : 9);
      assert.equal(game.actors[1].system.actionDice.value, 0);
      assert.equal(periods.session, "old");
      assert.notEqual(getUsagePeriodReview().needsReview, true);
    } finally {
      game.settings.set = set;
    }
  }
});
test("uncertain session restoration blocks resource use, GC spending and new period changes until review", async () => {
  const a = await pendingStart();
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(game.actors[1].system.actionDice.value, 0);
  assert.equal(periods.session, "old");
  let ran = false;
  assert.equal(
    await queueResources([a], () => {
      ran = true;
    }),
    null
  );
  assert.equal(ran, false);
  await assert.rejects(
    spendGCDice(1, async () => {}),
    /interrupted start/
  );
  await assert.rejects(startUsagePeriod("scene"), /interrupted start/);
});
test("GC can retain or cancel a failed session using exact confirmed balances without adding a second pool", async () => {
  for (const keepStart of [true, false]) {
    await pendingStart();
    const result = await reviewUsagePeriod({
      keepStart,
      balances: { "Actor.a": keepStart ? 3 : 9, "Actor.b": keepStart ? 6 : 0 },
      confirmed: true,
      resolution: "Reviewed the actual start"
    });
    assert.equal(result.needsReview, false);
    assert.deepEqual(
      game.actors.map(a => a.system.actionDice.value),
      keepStart ? [3, 6, 8] : [9, 0, 8]
    );
    assert.equal(periods.session, keepStart ? "epoch1" : "old");
    assert.equal(game.actors[0].flags.spycraft2.sessionDiceReset?.session, keepStart ? "epoch1" : undefined);
    assert.notEqual(getUsagePeriodReview().needsReview, true);
  }
});
test("an interrupted reconciliation remains active and absolute-balance retry cannot double reset a character", async () => {
  await pendingStart();
  const opts = {
      keepStart: true,
      balances: { "Actor.a": 3, "Actor.b": 6 },
      confirmed: true,
      resolution: "Complete the new session"
    },
    b = game.actors[1],
    update = b.update.bind(b);
  let once = true;
  b.update = async patch => {
    if (once) {
      once = false;
      throw Error("review actor failed");
    }
    return update(patch);
  };
  await assert.rejects(reviewUsagePeriod(opts), /review actor failed/);
  assert.equal(getUsagePeriodReview().needsReview, true);
  assert.equal(game.actors[0].system.actionDice.value, 3);
  b.update = update;
  await reviewUsagePeriod(opts);
  assert.deepEqual(
    game.actors.map(a => a.system.actionDice.value),
    [3, 6, 8]
  );
});
test("a committed final review marker is recovered and no active local fallback remains", async () => {
  await pendingStart();
  const set = game.settings.set;
  game.settings.set = async (scope, key, value) => {
    await set(scope, key, value);
    if (key === "usagePeriodReview" && value.needsReview === false) throw Error("review marker committed");
  };
  try {
    await reviewUsagePeriod({
      keepStart: true,
      balances: { "Actor.a": 3, "Actor.b": 6 },
      confirmed: true,
      resolution: "Verified"
    });
    assert.equal(getUsagePeriodReview().needsReview, false);
    assert.equal(game.spycraft2.pendingUsagePeriodReview, undefined);
  } finally {
    game.settings.set = set;
  }
});
test("review rejects changed balances, receipt state, roster, counters or GC role after its dialog", async () => {
  for (const change of ["balance", "receipt", "roster", "period", "role"]) {
    const a = await pendingStart(),
      original = foundry.applications;
    foundry.applications = {
      api: {
        DialogV2: {
          input: async () => {
            if (change === "balance") a.system.actionDice.value++;
            if (change === "receipt") a.flags.spycraft2.sessionDiceReset.note = "changed";
            if (change === "roster") game.actors.push(actor("new", 0, 3));
            if (change === "period") periods.scene = "changed";
            if (change === "role") game.user.isGM = false;
            return { mode: "new", dice_0: 3, dice_1: 6, confirmed: true, resolution: "Review" };
          }
        }
      }
    };
    try {
      await assert.rejects(reviewUsagePeriod(), change === "role" ? /Only the GC/ : /changed/);
      assert.equal(getUsagePeriodReview().needsReview, true);
    } finally {
      foundry.applications = original;
      game.user.isGM = true;
    }
  }
});
test("removed participants require GC acknowledgement; a character added during the interruption keeps its confirmed dice", async () => {
  await pendingStart();
  game.actors = game.actors.filter(a => a.id !== "b");
  await assert.rejects(
    reviewUsagePeriod({ keepStart: true, balances: { "Actor.a": 3 }, confirmed: true, resolution: "Review" }),
    /missing participants/
  );
  await reviewUsagePeriod({
    keepStart: true,
    balances: { "Actor.a": 3 },
    missingReviewed: true,
    confirmed: true,
    resolution: "Participant removed"
  });
  assert.equal(periods.session, "epoch1");
  assert.deepEqual(review.removedParticipants, ["Actor.b"]);
  await pendingStart();
  const n = actor("new", 0, 3);
  game.actors.push(n);
  await reviewUsagePeriod({
    keepStart: true,
    balances: { "Actor.a": 3, "Actor.b": 6, "Actor.new": 2 },
    confirmed: true,
    resolution: "New character added"
  });
  assert.equal(n.system.actionDice.value, 2);
});
test("a level-zero character with an old unclaimed creation entry gets starting dice at a session start like everyone else", async () => {
  reset();
  const a = game.actors[1];
  a.system.level = 0;
  a.system.actionDice.max = 3;
  a.flags = { spycraft2: { startingDiceCreation: { id: "newCreation", session: "old", claimed: false } } };
  await startUsagePeriod("session");
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.flags.spycraft2.sessionDiceReset.session, "epoch1");
});
test("pending character settlements and a stale queued start cannot silently expire unresolved currencies or reset a second session", async () => {
  reset();
  game.actors[0].flags = { spycraft2: { actionDiceSettlementReview: { needsReview: true } } };
  await assert.rejects(startUsagePeriod("session"), /interrupted character resources/);
  assert.equal(periods.session, "old");
  reset();
  const a = game.actors[0];
  let release;
  a._actionDieQueue = new Promise(resolve => {
    release = resolve;
  });
  const first = startUsagePeriod("session"),
    second = startUsagePeriod("session");
  release();
  await first;
  await assert.rejects(second, /counters or participating characters changed/);
  assert.equal(periods.session, "epoch1");
});

test("an unresolved Grapple release or required Escape Hold move prevents changing periods", async () => {
  for (const kind of ["review", "movement"]) {
    reset();
    const actor = game.actors[0];
    actor.flags = {
      spycraft2:
        kind === "review"
          ? { restraintReleaseReview: { id: "roll", needsReview: true } }
          : { restraintReleases: { roll: { state: "applied", movement: { state: "required" } } } }
    };
    await assert.rejects(startUsagePeriod("scene"), /resources/);
    assert.equal(periods.scene, "scene");
  }
});

test("a period change refreshes unlinked NPC tokens too, though only agent tokens are locked for it", async () => {
  reset();
  const { periodResourceActors } = await import("../module/services/transactions.mjs");
  const minion = actor("minion", 0, 0, "npc");
  minion.isToken = true;
  game.scenes = [{ tokens: [{ actor: minion }] }];
  const calls = [];
  for (const a of [...game.actors, minion]) a.reset = () => calls.push(a.id);
  refreshUsagePeriodActors();
  assert.ok(calls.includes("minion"));
  assert.ok(!periodResourceActors().some(a => a.id === "minion"));
});
