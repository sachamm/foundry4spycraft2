import test from "node:test";
import assert from "node:assert/strict";
import {
  GM_TOKEN_PREFIX,
  LOCK_QUERY,
  LockTable,
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
  assert.deepEqual(sent, [[LOCK_QUERY, 5000]]);
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
const { queueResourceScope, RULE_RESOURCE_LOCK_ID } = await import("../module/rules/transactions.mjs");
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
