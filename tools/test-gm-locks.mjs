import test from "node:test";
import assert from "node:assert/strict";
import {
  GM_TOKEN_PREFIX,
  LOCK_QUERY,
  LockTable,
  PROBE_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  UNREACHABLE_MEMORY_MS,
  forgetUnreachableGM,
  gmLockingActive,
  lockQueryHandler,
  requestLock
} from "../module/rules/gm-locks.mjs";

test("the lock table grants every key or none, and only the holder can give a key back", () => {
  const table = new LockTable();
  assert.deepEqual(table.acquire(["Actor.a", "Actor.b"], "t1", "u1", 5), { ok: true });
  assert.deepEqual(table.holder("Actor.a"), { token: "t1", userId: "u1", at: 5 });
  // Asking again with the same token is harmless; another token is refused and takes nothing.
  assert.deepEqual(table.acquire(["Actor.a"], "t1", "u1"), { ok: true });
  assert.deepEqual(table.acquire(["Actor.c", "Actor.b"], "t2", "u2"), {
    ok: false,
    busy: ["Actor.b"],
    holders: ["u1"]
  });
  assert.equal(table.holder("Actor.c"), null);
  assert.deepEqual(table.release(["Actor.a", "Actor.b"], "t2"), { ok: true, released: 0 });
  assert.deepEqual(table.release(["Actor.a"], "t1"), { ok: true, released: 1 });
  assert.deepEqual(table.acquire(["Actor.a"], "t2", "u2"), { ok: true });
  assert.equal(table.size, 2);
  assert.equal(table.acquire([], "t3", "u3").ok, false);
  assert.equal(table.acquire(["Actor.z"], "", "u3").ok, false);
});

test("a disconnecting user's locks are dropped, and the GC can clear one by hand", () => {
  const table = new LockTable();
  table.acquire(["Actor.a", "Actor.b"], "t1", "u1");
  table.acquire(["Actor.c"], "t2", "u2");
  assert.equal(table.releaseUser("u1"), 2);
  assert.equal(table.size, 1);
  assert.equal(table.clear("Actor.c"), true);
  assert.equal(table.clear("Actor.c"), false);
});

test("locking is arbitrated only when the world asks for it and a GC is connected", () => {
  const game = (mode, gm) => ({ settings: { get: () => mode }, users: { activeGM: gm } });
  assert.equal(gmLockingActive(game("gm", { id: "gc" })), true);
  assert.equal(gmLockingActive(game("gm", null)), false);
  assert.equal(gmLockingActive(game("items", { id: "gc" })), false);
  assert.equal(
    gmLockingActive({
      settings: {
        get() {
          throw new Error("not registered");
        }
      },
      users: { activeGM: {} }
    }),
    false
  );
  assert.equal(gmLockingActive(null), false);
});

test("the GC's own client answers from its table; a player's request travels as a query", async () => {
  const table = new LockTable(),
    handler = lockQueryHandler(table),
    sent = [];
  const gmGame = { user: { id: "gc" }, users: { activeGM: { isSelf: true } } };
  const playerGame = {
    user: { id: "p1" },
    users: {
      activeGM: {
        isSelf: false,
        query: async (name, data, options) => {
          sent.push([name, options.timeout]);
          return handler(data);
        }
      }
    }
  };
  assert.deepEqual(await requestLock("acquire", ["Actor.a"], "gm:1", { game: gmGame, table }), { ok: true });
  assert.equal(sent.length, 0);
  const refused = await requestLock("acquire", ["Actor.a"], "gm:2", { game: playerGame, table });
  assert.deepEqual(refused, { ok: false, busy: ["Actor.a"], holders: ["gc"] });
  assert.deepEqual(sent, [[LOCK_QUERY, QUERY_TIMEOUT_MS]]);
  assert.ok(QUERY_TIMEOUT_MS <= 1500);
  await requestLock("release", ["Actor.a"], "gm:1", { game: gmGame, table });
  assert.deepEqual(await requestLock("acquire", ["Actor.a"], "gm:2", { game: playerGame, table }), { ok: true });
  assert.equal(table.holder("Actor.a").userId, "p1");
  assert.equal(handler({ action: "steal" }).ok, false);
});

test("no GC, a timeout or a broken answer all report the GC as unreachable", async () => {
  assert.equal((await requestLock("acquire", ["k"], "gm:1", { game: { users: {} } })).unreachable, true);
  const failing = {
    user: { id: "p" },
    users: {
      activeGM: {
        isSelf: false,
        query: async () => {
          throw new Error("timeout");
        }
      }
    }
  };
  assert.equal((await requestLock("acquire", ["k"], "gm:1", { game: failing })).unreachable, true);
  const silent = { user: { id: "p" }, users: { activeGM: { isSelf: false, query: async () => undefined } } };
  assert.equal((await requestLock("acquire", ["k"], "gm:1", { game: silent })).unreachable, true);
});

test("a GC that fails to answer is probed briefly for a minute; late grants are released; one notice", async () => {
  forgetUnreachableGM();
  const queries = [],
    notices = [];
  let answering = false;
  const game = {
    user: { id: "p" },
    users: {
      activeGM: {
        id: "gc",
        isSelf: false,
        query: async (name, data, options) => {
          queries.push([data.action, options.timeout]);
          if (!answering) throw new Error("timeout");
          return { ok: true };
        }
      }
    }
  };
  const notify = message => notices.push(message);
  const ask = (action, now) => requestLock(action, ["Actor.a:lock"], "gm:1", { game, now, notify });
  assert.equal((await ask("acquire", 0)).unreachable, true);
  // The timed-out request is released in case the GC grants it late.
  assert.deepEqual(queries.splice(0), [
    ["acquire", QUERY_TIMEOUT_MS],
    ["release", QUERY_TIMEOUT_MS]
  ]);
  // Within the minute the GC is still asked, so its locks are never ignored, but only briefly.
  assert.equal((await ask("acquire", 1000)).unreachable, true);
  assert.deepEqual(queries.splice(0)[0], ["acquire", PROBE_TIMEOUT_MS]);
  assert.ok(PROBE_TIMEOUT_MS < QUERY_TIMEOUT_MS);
  // Each failure restarts the minute; a minute after the last one, the full wait again.
  await ask("acquire", 1000 + UNREACHABLE_MEMORY_MS + 1);
  assert.deepEqual(queries.splice(0)[0], ["acquire", QUERY_TIMEOUT_MS]);
  assert.equal(notices.length, 1, "one notice for the whole stretch");
  // A GC that answers again is used at once, and a later stretch gets its own notice.
  answering = true;
  assert.deepEqual(await ask("acquire", 1000 + UNREACHABLE_MEMORY_MS + 2), { ok: true });
  answering = false;
  await ask("acquire", 1000 + UNREACHABLE_MEMORY_MS + 3);
  assert.equal(notices.length, 2);
  forgetUnreachableGM();
});

test("a client that fell back still respects a lock the recovered GC holds for someone else", async () => {
  forgetUnreachableGM();
  const table = new LockTable(),
    handler = lockQueryHandler(table, { resolve: () => null });
  let up = false;
  const game = {
    user: { id: "p1" },
    users: {
      activeGM: {
        id: "gc",
        isSelf: false,
        query: async (name, data) => {
          if (!up) throw new Error("timeout");
          return handler(data);
        }
      }
    }
  };
  assert.equal(
    (await requestLock("acquire", ["Actor.x:lock"], "gm:a", { game, now: 0, notify() {} })).unreachable,
    true
  );
  // The GC comes back and grants the character to another player.
  up = true;
  table.acquire(["Actor.x:lock"], "gm:b", "p2");
  const answer = await requestLock("acquire", ["Actor.x:lock"], "gm:a2", { game, now: 1000, notify() {} });
  assert.deepEqual(answer, { ok: false, busy: ["Actor.x:lock"], holders: ["p2"] });
  forgetUnreachableGM();
});

test("the GC refuses a lock while the character carries a document lock from a client that fell back", () => {
  const items = new Map([
    ["sc2ResourceLock1", { id: "sc2ResourceLock1", flags: { spycraft2: { resourceLock: { token: "t" } } } }]
  ]);
  const actors = { "Actor.a": { items }, "Scene.s.Token.t.Actor.b": { items: new Map() } };
  const table = new LockTable(),
    handler = lockQueryHandler(table, { resolve: uuid => actors[uuid] ?? null });
  assert.deepEqual(handler({ action: "acquire", keys: ["Actor.a:sc2ResourceLock1"], token: "gm:1", userId: "p1" }), {
    ok: false,
    busy: ["Actor.a:sc2ResourceLock1"],
    holders: []
  });
  assert.equal(table.size, 0);
  // A different scope on the same character, and a token actor without a lock, are free.
  assert.equal(
    handler({ action: "acquire", keys: ["Actor.a:sc2RuleStateLk01"], token: "gm:1", userId: "p1" }).ok,
    true
  );
  assert.equal(
    handler({ action: "acquire", keys: ["Scene.s.Token.t.Actor.b:sc2ResourceLock1"], token: "gm:2", userId: "p1" }).ok,
    true
  );
  // An item that only reuses the id, with no lock token, is not a lock.
  items.set("sc2GCResourceLk1", { id: "sc2GCResourceLk1", flags: {} });
  assert.equal(
    handler({ action: "acquire", keys: ["Actor.a:sc2GCResourceLk1"], token: "gm:3", userId: "p1" }).ok,
    true
  );
  // A resolver that throws on a malformed uuid leaves the key to the table.
  const throwing = lockQueryHandler(new LockTable(), {
    resolve: () => {
      throw new Error("bad uuid");
    }
  });
  assert.equal(
    throwing({ action: "acquire", keys: ["nonsense:sc2ResourceLock1"], token: "gm:4", userId: "p1" }).ok,
    true
  );
});

/* ---- Through the transaction layer ---- */

const created = [];
const actorFor = uuid => ({
  uuid,
  name: uuid,
  isOwner: true,
  isToken: false,
  items: new Map(),
  async createEmbeddedDocuments(type, data) {
    created.push([uuid, data[0]._id]);
    this.items.set(data[0]._id, { ...data[0], id: data[0]._id });
    return [{ ...data[0], id: data[0]._id }];
  },
  async deleteEmbeddedDocuments(type, ids) {
    for (const id of ids) this.items.delete(id);
  },
  updateSource() {}
});
let mode = "gm",
  gmPresent = true;
globalThis.foundry = {
  utils: {
    randomID: (() => {
      let n = 0;
      return () => `id${++n}`;
    })()
  }
};
globalThis.ui = { notifications: { warn: () => null, info: () => null } };
globalThis.game = {
  user: { id: "gc", isGM: true },
  settings: { get: (scope, key) => (key === "lockMode" ? mode : {}) },
  get users() {
    return { activeGM: gmPresent ? { isSelf: true } : null, get: () => null };
  }
};
const { queueResourceScope, RULE_RESOURCE_LOCK_ID } = await import("../module/services/transactions.mjs");
const { lockTable } = await import("../module/rules/gm-locks.mjs");

test("an arbitrated transaction writes nothing to the character and frees its lock, even on failure", async () => {
  const actor = actorFor("Actor.locked");
  created.length = 0;
  let seen = null;
  const result = await queueResourceScope(actor, RULE_RESOURCE_LOCK_ID, async () => {
    seen = lockTable.holder(`Actor.locked:${RULE_RESOURCE_LOCK_ID}`);
    return "done";
  });
  assert.equal(result, "done");
  assert.ok(seen.token.startsWith(GM_TOKEN_PREFIX));
  assert.equal(created.length, 0);
  assert.equal(lockTable.size, 0);
  await assert.rejects(
    queueResourceScope(actor, RULE_RESOURCE_LOCK_ID, async () => {
      throw new Error("work failed");
    }),
    /work failed/
  );
  assert.equal(lockTable.size, 0);
});

test("a character another client holds is reported busy; document locks are used when no GC is connected", async () => {
  const actor = actorFor("Actor.shared");
  const key = `Actor.shared:${RULE_RESOURCE_LOCK_ID}`;
  created.length = 0;
  // Another client already holds this character's lock in the GC's table.
  lockTable.acquire([key], "gm:other-client", "p2");
  assert.equal(await queueResourceScope(actor, RULE_RESOURCE_LOCK_ID, async () => "second"), null);
  assert.equal(lockTable.holder(key).userId, "p2");
  lockTable.release([key], "gm:other-client");
  assert.equal(await queueResourceScope(actor, RULE_RESOURCE_LOCK_ID, async () => "second"), "second");
  assert.equal(created.length, 0);

  gmPresent = false;
  try {
    assert.equal(
      await queueResourceScope(actorFor("Actor.offline"), RULE_RESOURCE_LOCK_ID, async () => "native"),
      "native"
    );
    assert.deepEqual(created, [["Actor.offline", RULE_RESOURCE_LOCK_ID]]);
  } finally {
    gmPresent = true;
  }
  mode = "items";
  created.length = 0;
  await queueResourceScope(actorFor("Actor.items"), RULE_RESOURCE_LOCK_ID, async () => "native");
  assert.equal(created.length, 1);
  mode = "gm";
});
