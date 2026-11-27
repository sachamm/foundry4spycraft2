import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUND_STATES,
  activeRoundStates,
  planRoundStateEffects,
  syncRoundStateEffects
} from "../module/apps/round-state-effects.mjs";

const states = [
  {
    key: "stance",
    field: "stance",
    read: s => (s.stance ? { key: s.stance, name: s.stance } : null),
    label: st => `Stance: ${st.name}`,
    rounds: null
  },
  {
    key: "defense",
    field: "defense",
    read: s => ({ active: !!s.defense, bonus: 4 }),
    label: st => `Total Defense +${st.bonus}`,
    rounds: 1
  },
  { key: "boost", field: "boost", read: s => s.boost ?? null, label: () => "Boost", rounds: 1 },
  {
    key: "broken",
    field: "broken",
    read: () => {
      throw new Error("needs review");
    },
    label: () => "Broken",
    rounds: 1
  }
];

test("every mirrored state names a distinct field and can be read from an empty character", () => {
  assert.equal(new Set(ROUND_STATES.map(s => s.key)).size, ROUND_STATES.length);
  assert.equal(new Set(ROUND_STATES.map(s => s.field)).size, ROUND_STATES.length);
  assert.deepEqual(activeRoundStates({ activeFeatNames: [] }), []);
});

test("a state is in force when its rule says active, names a stance, or returns a record", () => {
  assert.deepEqual(activeRoundStates({}, states), []);
  assert.deepEqual(activeRoundStates({ stance: "Side", defense: true, boost: { id: "b" } }, states), [
    { key: "stance", label: "Stance: Side", rounds: null },
    { key: "defense", label: "Total Defense +4", rounds: 1 },
    { key: "boost", label: "Boost", rounds: 1 }
  ]);
});

test("the plan creates what is missing, removes what ended or is duplicated, and renames what changed", () => {
  const desired = [
    { key: "stance", label: "Stance: Side", rounds: null },
    { key: "defense", label: "Total Defense +4", rounds: 1 }
  ];
  assert.deepEqual(planRoundStateEffects([], desired), { create: desired, remove: [], rename: [] });
  const existing = [
    { id: "e1", name: "Stance: Power", key: "stance" },
    { id: "e2", name: "Stance: Power", key: "stance" },
    { id: "e3", name: "Boost", key: "boost" }
  ];
  assert.deepEqual(planRoundStateEffects(existing, desired), {
    create: [desired[1]],
    remove: ["e2", "e3"],
    rename: [{ id: "e1", name: "Stance: Side" }]
  });
  assert.deepEqual(planRoundStateEffects([{ id: "e1", name: "Stance: Side", key: "stance" }], [desired[0]]), {
    create: [],
    remove: [],
    rename: []
  });
});

test("syncing writes only the differences and leaves other effects alone", async () => {
  const calls = [];
  const actor = {
    uuid: "Actor.a",
    system: { stance: "Side", defense: true },
    effects: [
      { id: "shaken", name: "Shaken I", flags: {} },
      { id: "old", name: "Boost", flags: { spycraft2: { roundState: "boost" } } }
    ],
    async deleteEmbeddedDocuments(type, ids) {
      calls.push(["delete", type, ids]);
    },
    async updateEmbeddedDocuments(type, updates) {
      calls.push(["update", type, updates]);
    },
    async createEmbeddedDocuments(type, data) {
      calls.push(["create", type, data]);
    }
  };
  await syncRoundStateEffects(actor, { states });
  assert.deepEqual(calls[0], ["delete", "ActiveEffect", ["old"]]);
  assert.equal(calls[1][0], "create");
  const created = calls[1][2];
  assert.deepEqual(
    created.map(e => e.name),
    ["Stance: Side", "Total Defense +4"]
  );
  assert.equal(created[0].duration, undefined);
  assert.deepEqual(created[1].duration, { value: 1, units: "rounds" });
  assert.deepEqual(
    created.map(e => e.flags.spycraft2.roundState),
    ["stance", "defense"]
  );
  assert.equal(calls.length, 2);

  // Nothing to do: nothing written.
  calls.length = 0;
  actor.effects = created.map((e, i) => ({ id: `n${i}`, name: e.name, flags: e.flags }));
  await syncRoundStateEffects(actor, { states });
  assert.deepEqual(calls, []);
});

test("overlapping actor and combat updates cannot delete an expired mirror twice or create duplicate mirrors", async () => {
  let deleted = 0,
    created = 0;
  const actor = {
    uuid: "Actor.race",
    system: { stance: "Side", defense: true },
    effects: [{ id: "old", name: "Expired", flags: { spycraft2: { roundState: "boost" } } }],
    async deleteEmbeddedDocuments(_type, ids) {
      await Promise.resolve();
      for (const id of ids) {
        assert.ok(
          this.effects.some(e => e.id === id),
          "delete must target a still-existing effect"
        );
        this.effects = this.effects.filter(e => e.id !== id);
        deleted++;
      }
    },
    async updateEmbeddedDocuments() {
      throw Error("unexpected rename");
    },
    async createEmbeddedDocuments(_type, rows) {
      await Promise.resolve();
      this.effects.push(...rows.map(row => ({ ...row, id: `new${++created}` })));
    }
  };
  await Promise.all([
    syncRoundStateEffects(actor, { states }),
    syncRoundStateEffects(actor, { states }),
    syncRoundStateEffects(actor, { states })
  ]);
  assert.equal(deleted, 1);
  assert.equal(created, 2);
  assert.equal(new Set(actor.effects.map(e => e.flags.spycraft2.roundState)).size, 2);
});

test("a failed mirror write does not poison later synchronization", async () => {
  let failures = 1;
  const actor = {
    system: {},
    effects: [{ id: "old", name: "Expired", flags: { spycraft2: { roundState: "boost" } } }],
    async deleteEmbeddedDocuments() {
      if (failures--) throw Error("interrupted deletion");
      this.effects = [];
    }
  };
  await assert.rejects(syncRoundStateEffects(actor, { states }), /interrupted deletion/);
  await syncRoundStateEffects(actor, { states });
  assert.deepEqual(actor.effects, []);
});
