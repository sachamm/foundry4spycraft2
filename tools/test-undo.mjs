import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { combats: [], user: { id: "gm", isGM: true }, i18n: { localize: String } };
const { flatten, differences, snapshot, undoEntry, movedSince, restoreUpdate, poolsGivenBack, applyUndo } =
  await import("../module/apps/undo.mjs");

const makeActor = (system, flags = {}) => {
  const actor = {
    uuid: "Actor.g",
    name: "Guard",
    isOwner: true,
    system,
    flags: { spycraft2: flags },
    effects: [],
    toObject() {
      return structuredClone({ system: this.system, flags: this.flags });
    },
    async update(change) {
      for (const [path, value] of Object.entries(change)) {
        const keys = path.split(".");
        let target = this;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        const last = keys.at(-1);
        if (last.startsWith("-=")) delete target[last.slice(2)];
        else if (last.startsWith("==")) target[last.slice(2)] = value;
        else target[last] = value;
      }
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.effects = this.effects.filter(effect => !ids.includes(effect.id));
    },
    async createEmbeddedDocuments(_type, rows) {
      this.effects.push(...rows.map(row => ({ id: row._id, ...row, toObject: () => row })));
    }
  };
  actor.effects.get = id => actor.effects.find(effect => effect.id === id);
  return actor;
};

test("only what a step changed is kept, with arrays and null as whole values", () => {
  assert.deepEqual(flatten({ a: { b: 1, c: [1, 2], d: null }, e: "x" }), {
    "a.b": 1,
    "a.c": [1, 2],
    "a.d": null,
    e: "x"
  });
  const diff = differences({ "a.b": 1, "a.c": [1, 2], keep: 5 }, { "a.b": 3, "a.c": [1, 2], keep: 5, fresh: true });
  assert.deepEqual(diff, { restore: { "a.b": 1 }, unset: ["fresh"], expect: { "a.b": 3, fresh: true }, whole: [] });
});

test("a step's writes, new conditions and tracker changes are put back by Undo", async () => {
  const actor = makeActor({ vitality: { value: 20, max: 20 }, wounds: { value: 12, max: 12 } });
  const combatant = {
    id: "c1",
    actor,
    parent: { id: "fight" },
    defeated: false,
    initiative: 14,
    async update(change) {
      Object.assign(this, change);
    }
  };
  const fight = { id: "fight", combatants: Object.assign([combatant], { get: () => combatant }) };
  game.combats = Object.assign([fight], { get: () => fight });
  const before = snapshot(actor);
  assert.equal(undoEntry(actor, before, snapshot(actor)), null, "nothing changed, nothing to undo");

  await actor.update({
    "system.vitality.value": 0,
    "system.wounds.value": 9,
    "flags.spycraft2.nonLethal": { subdual: 4 }
  });
  actor.effects.push({ id: "e1", toObject: () => ({ _id: "e1" }) });
  combatant.defeated = true;
  const entry = undoEntry(actor, before, snapshot(actor));
  assert.deepEqual(entry.restore, [
    ["system.vitality.value", 20],
    ["system.wounds.value", 12]
  ]);
  assert.deepEqual(entry.unset, ["flags.spycraft2.nonLethal"]);
  assert.deepEqual(entry.created, ["e1"]);
  // Only the field the step changed, with what it left: the Count and fluid state are not part of this step.
  assert.deepEqual(entry.combatants, [{ combat: "fight", id: "c1", defeated: false, left: { defeated: true } }]);
  assert.deepEqual(restoreUpdate(entry), {
    "system.vitality.value": 20,
    "system.wounds.value": 12,
    "flags.spycraft2.-=nonLethal": null
  });
  assert.deepEqual(movedSince(entry, actor.toObject()), []);

  globalThis.fromUuid = async () => actor;
  const card = {
    isAuthor: true,
    flags: { spycraft2: { damageAppliedBy: { k1: { targetUuid: "Actor.g" }, k2: { targetUuid: "Actor.other" } } } },
    updates: [],
    async update(change) {
      this.updates.push(change);
    }
  };
  game.messages = { get: () => card };
  const note = {
    flags: {
      spycraft2: {
        undo: { label: "7 lethal", entries: [entry], damageCard: { messageId: "m", targetUuid: "Actor.g" } }
      }
    },
    async update(change) {
      this.changed = change;
    }
  };
  assert.deepEqual(await applyUndo(note), ["Guard"]);
  assert.deepEqual([actor.system.vitality.value, actor.system.wounds.value], [20, 12]);
  assert.equal(actor.flags.spycraft2.nonLethal, undefined);
  assert.equal(actor.effects.length, 0);
  assert.equal(combatant.defeated, false);
  assert.deepEqual(card.updates, [{ "flags.spycraft2.damageAppliedBy.-=k1": null }], "the card may be applied again");
  assert.deepEqual(note.changed, { "flags.spycraft2.undo.done": true });
  note.flags.spycraft2.undo.done = true;
  assert.equal(await applyUndo(note), null, "a note undoes once");
  // A note that recorded its own mark takes that one off, not the newest mark for the same target.
  await actor.update({ "system.vitality.value": 0 });
  card.updates = [];
  card.flags.spycraft2.damageAppliedBy = {
    first00001: { targetUuid: "Actor.g" },
    later00002: { targetUuid: "Actor.g" }
  };
  const own = {
    flags: {
      spycraft2: {
        undo: {
          label: "7 lethal",
          entries: [undoEntry(actor, before, snapshot(actor))],
          damageCard: { messageId: "m", targetUuid: "Actor.g", entryId: "first00001" }
        }
      }
    },
    async update() {}
  };
  await applyUndo(own);
  assert.deepEqual(card.updates, [{ "flags.spycraft2.damageAppliedBy.-=first00001": null }]);
});

test("Undo notices a value that moved again after the step", () => {
  const entry = {
    expect: [
      ["system.vitality.value", 5],
      ["system.wounds.value", 9]
    ]
  };
  assert.deepEqual(movedSince(entry, { system: { vitality: { value: 2 }, wounds: { value: 9 } } }), [
    "system.vitality.value"
  ]);
});

test("an empty record that a step filled is put back whole, and the note survives a chat message's key expansion", async () => {
  // A standard NPC's first Damage save: the track goes from nothing to a record with parts.
  const actor = makeActor({ damageTrack: null, wounds: { value: 3 } });
  const before = snapshot(actor);
  actor.system.damageTrack = { accumulated: 9, failed: 1 };
  const entry = undoEntry(actor, before, snapshot(actor));
  assert.deepEqual(entry.whole, ["system.damageTrack"]);
  assert.deepEqual(restoreUpdate(entry), { "system.==damageTrack": null }, "one key, no parts removed beside it");
  // Stored on a chat message, dotted keys inside objects become nests; pairs do not.
  const stored = JSON.parse(JSON.stringify(entry));
  assert.deepEqual(movedSince(stored, actor.toObject()), [], "nothing moved, so Undo does not ask");
  actor.system.damageTrack.accumulated = 12;
  assert.deepEqual(movedSince(stored, actor.toObject()), ["system.damageTrack.accumulated"]);
  await actor.update(restoreUpdate(stored));
  assert.equal(actor.system.damageTrack, null);

  // The reverse: a record a step cleared comes back with its parts.
  const full = makeActor({ promotion: { scene: 2, by: "gc" } });
  const was = snapshot(full);
  full.system.promotion = null;
  const cleared = undoEntry(full, was, snapshot(full));
  assert.deepEqual(restoreUpdate(cleared), { "system.==promotion": { scene: 2, by: "gc" } });
});

test("two presses of one Undo run once; a fluid initiative event the step recorded is taken back", async () => {
  const actor = makeActor({ vitality: { value: 20 } });
  const combatant = {
    id: "c1",
    actor,
    parent: { id: "fight" },
    defeated: false,
    initiative: 10,
    flags: {},
    updates: [],
    async update(change) {
      this.updates.push(change);
    }
  };
  const fight = { id: "fight", combatants: Object.assign([combatant], { get: () => combatant }) };
  game.combats = Object.assign([fight], { get: () => fight });
  const before = snapshot(actor);
  actor.system.vitality.value = 4;
  combatant.flags = { spycraft2: { fluid: { modifiers: [{ id: "wounds", value: -2 }] } } };
  const entry = undoEntry(actor, before, snapshot(actor));
  globalThis.fromUuid = async () => actor;
  game.messages = { get: () => null };
  let marked = 0;
  const note = {
    id: "note1",
    flags: { spycraft2: { undo: { label: "x", entries: [entry] } } },
    async update() {
      marked += 1;
    }
  };
  const [first, second] = await Promise.all([applyUndo(note), applyUndo(note)]);
  assert.deepEqual([first, second], [["Guard"], null]);
  assert.equal(marked, 1);
  assert.deepEqual(combatant.updates, [{ "flags.spycraft2.-=fluid": null }]);
  game.combats = [];
});

test("a record the step created is removed at its own key, leaving no empty shell", () => {
  const before = flatten({ flags: { spycraft2: { damageEvents: {}, kept: 1 } } }),
    after = flatten({
      flags: { spycraft2: { damageEvents: { ev1: { version: 1, request: { amount: 6 }, context: {} } }, kept: 1 } }
    });
  const found = differences(before, after);
  assert.deepEqual(found.unset, ["flags.spycraft2.damageEvents.ev1"]);
  assert.deepEqual(found.restore, {});
  // No record at all before: the first new key under what existed is the one removed.
  const fresh = differences(flatten({ flags: { spycraft2: { kept: 1 } } }), after);
  assert.deepEqual(fresh.unset, ["flags.spycraft2.damageEvents"]);
});

test("a pool that moved again gets back what the step took, not its old number", () => {
  const entry = {
    restore: [
      ["system.vitality.value", 6],
      ["system.wounds.value", 19]
    ],
    expect: [
      ["system.vitality.value", 0],
      ["system.wounds.value", 15]
    ]
  };
  // The maximums rose from 6 and 19 to 18 and 20, and the values followed to 12 and 16.
  const raised = { system: { vitality: { value: 12, max: 18 }, wounds: { value: 16, max: 20 } } };
  assert.deepEqual(poolsGivenBack(entry, raised), { "system.vitality.value": 18, "system.wounds.value": 20 });
  // Untouched since the step: the plain restore stands.
  const still = { system: { vitality: { value: 0, max: 6 }, wounds: { value: 15, max: 19 } } };
  assert.deepEqual(poolsGivenBack(entry, still), {});
});

test("undoing a first spend leaves a later spend on the same turn in place", async () => {
  const actor = makeActor({ vitality: { value: 20 } });
  const combatant = {
    id: "c1",
    name: "Guard",
    actor,
    parent: { id: "fight" },
    defeated: false,
    initiative: 10,
    flags: { spycraft2: { actions: { half: 2 } } },
    updates: [],
    async update(change) {
      this.updates.push(change);
    }
  };
  const fight = { id: "fight", combatants: Object.assign([combatant], { get: () => combatant }) };
  game.combats = Object.assign([fight], { get: () => fight });
  const before = snapshot(actor);
  combatant.flags = { spycraft2: { actions: { half: 1 } } };
  const entry = undoEntry(actor, before, snapshot(actor));
  // A second spend after the step: the first one's Undo must not hand both half actions back.
  combatant.flags = { spycraft2: { actions: { half: 0 } } };
  globalThis.fromUuid = async () => actor;
  game.messages = { get: () => null };
  let warned = 0;
  globalThis.ui = { notifications: { warn: () => (warned += 1), info: () => null } };
  const note = { id: "note2", flags: { spycraft2: { undo: { label: "x", entries: [entry] } } }, async update() {} };
  await applyUndo(note);
  assert.equal(warned, 1);
  assert.ok(combatant.updates.every(change => !Object.keys(change).some(key => key.includes("actions"))));
  game.combats = [];
});

test("undoing an action spend leaves a later Count change and fluid event in place", async () => {
  const actor = makeActor({ vitality: { value: 20 } });
  const combatant = {
    id: "c1",
    name: "Guard",
    actor,
    parent: { id: "fight" },
    defeated: false,
    initiative: 12,
    flags: { spycraft2: { actions: { half: 2 } } },
    updates: [],
    async update(change) {
      this.updates.push(change);
    }
  };
  const fight = { id: "fight", combatants: Object.assign([combatant], { get: () => combatant }) };
  game.combats = Object.assign([fight], { get: () => fight });
  const before = snapshot(actor);
  combatant.flags = { spycraft2: { actions: { half: 1 } } };
  const entry = undoEntry(actor, before, snapshot(actor));
  // Later in the turn a fluid event moves the Count; the spend's Undo must keep it.
  combatant.initiative = 8;
  combatant.flags.spycraft2.fluid = { modifiers: [{ id: "x", value: -4 }] };
  globalThis.fromUuid = async () => actor;
  game.messages = { get: () => null };
  globalThis.ui = { notifications: { warn: () => null, info: () => null } };
  const note = { id: "note3", flags: { spycraft2: { undo: { label: "x", entries: [entry] } } }, async update() {} };
  await applyUndo(note);
  assert.deepEqual(combatant.updates, [{ "flags.spycraft2.==actions": { half: 2 } }]);
  game.combats = [];
});

test("a player's note restores only that player's characters and character paths, never mission-wide parts", async () => {
  const { trustedRecord } = await import("../module/apps/undo.mjs");
  const player = { id: "p", isGM: false };
  globalThis.fromUuidSync = uuid => ({
    testUserPermission: (user, level) => uuid === "Actor.mine" && level === "OWNER"
  });
  const record = {
    label: "x",
    gcDice: 3,
    placedTokens: { ids: ["t"] },
    entries: [
      {
        uuid: "Actor.mine",
        restore: [
          ["system.vitality.value", 5],
          ["ownership.default", 3]
        ],
        expect: [],
        unset: ["name"]
      },
      { uuid: "Actor.theirs", restore: [["system.vitality.value", 5]], expect: [] }
    ]
  };
  const kept = trustedRecord(record, player);
  assert.equal(kept.gcDice, undefined);
  assert.equal(kept.placedTokens, undefined);
  assert.deepEqual(
    kept.entries.map(entry => [entry.uuid, entry.restore, entry.unset]),
    [["Actor.mine", [["system.vitality.value", 5]], []]]
  );
  assert.equal(trustedRecord(record, { isGM: true }), record, "a GC's own note is taken as written");
  delete globalThis.fromUuidSync;
});

test("a step that fails part way still leaves a note for what it wrote, then reports the failure", async () => {
  const { withUndo } = await import("../module/apps/undo.mjs");
  const actor = makeActor({ vitality: { value: 10 } });
  const posted = [];
  globalThis.ChatMessage = { create: async data => (posted.push(data), data), getWhisperRecipients: () => [] };
  await assert.rejects(
    withUndo([actor], "Spend", async () => {
      actor.system.vitality.value = 4;
      throw new Error("second write refused");
    }),
    /second write refused/
  );
  assert.equal(posted.length, 1);
  assert.match(posted[0].flags.spycraft2.undo.label, /stopped part way/);
});

test("Next scene can be taken back until a later scene begins", async () => {
  const { scenePeriodRevert } = await import("../module/services/periods.mjs");
  const change = { before: { scene: "s1", sceneSequence: 3 }, after: "s2" };
  assert.deepEqual(scenePeriodRevert({ scene: "s2", sceneSequence: 4, session: "x" }, change).target, {
    scene: "s1",
    sceneSequence: 3,
    session: "x"
  });
  // The very first scene had no period of its own.
  assert.deepEqual(
    scenePeriodRevert({ scene: "s2", sceneSequence: 1 }, { before: { scene: null, sceneSequence: null }, after: "s2" })
      .target,
    {}
  );
  assert.ok(scenePeriodRevert({ scene: "s3", sceneSequence: 5 }, change).reason);
  assert.ok(scenePeriodRevert({}, {}).reason);
});

test("a GC boost comes off its card only while the card stands as the boost left it (B-037)", async () => {
  const { cardBoostRefusal } = await import("../module/apps/undo.mjs");
  const boost = { messageId: "m", after: { boostTotal: 5, count: 1 } };
  const card = flags => ({ flags: { spycraft2: { boostTotal: 5, gcBoosts: [5], ...flags } } });
  assert.equal(cardBoostRefusal(card({}), boost), "");
  assert.match(cardBoostRefusal(null, boost), /gone/);
  assert.match(cardBoostRefusal(card({ attackResolution: { hit: true } }), boost), /settled/);
  assert.match(cardBoostRefusal(card({ resolved: true }), boost), /settled/);
  assert.match(cardBoostRefusal(card({ boostTotal: 9, gcBoosts: [5, 4] }), boost), /later boost/);
});
