import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { combats: [], user: { id: "gm", isGM: true }, i18n: { localize: String } };
const { flatten, differences, snapshot, undoEntry, movedSince, restoreUpdate, applyUndo } =
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
  assert.deepEqual(diff, { restore: { "a.b": 1 }, unset: ["fresh"], expect: { "a.b": 3, fresh: true } });
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
  assert.deepEqual(entry.restore, { "system.vitality.value": 20, "system.wounds.value": 12 });
  assert.deepEqual(entry.unset, ["flags.spycraft2.nonLethal.subdual"]);
  assert.deepEqual(entry.created, ["e1"]);
  assert.deepEqual(entry.combatants, [{ combat: "fight", id: "c1", defeated: false, initiative: 14 }]);
  assert.deepEqual(restoreUpdate(entry), {
    "system.vitality.value": 20,
    "system.wounds.value": 12,
    "flags.spycraft2.nonLethal.-=subdual": null
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
  assert.equal(actor.flags.spycraft2.nonLethal.subdual, undefined);
  assert.equal(actor.effects.length, 0);
  assert.equal(combatant.defeated, false);
  assert.deepEqual(card.updates, [{ "flags.spycraft2.damageAppliedBy.-=k1": null }], "the card may be applied again");
  assert.deepEqual(note.changed, { "flags.spycraft2.undo.done": true });
  note.flags.spycraft2.undo.done = true;
  assert.equal(await applyUndo(note), null, "a note undoes once");
});

test("Undo notices a value that moved again after the step", () => {
  const entry = { expect: { "system.vitality.value": 5, "system.wounds.value": 9 } };
  assert.deepEqual(movedSince(entry, { system: { vitality: { value: 2 }, wounds: { value: 9 } } }), [
    "system.vitality.value"
  ]);
});
