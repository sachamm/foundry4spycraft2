import test from "node:test";
import assert from "node:assert/strict";
import { preferredInitiativeRoll } from "../module/apps/initiative-choice.mjs";
import { shakenCombatantClass } from "../module/apps/shaken-initiative.mjs";
let totals, draws, posts, input, dialogHook, rollHook;
class Roll {
  constructor(total = totals.shift()) {
    this.drawn = total;
    this.total = null;
    this.formula = "1d20 + 3";
    this.options = {};
  }
  clone() {
    return new Roll();
  }
  async evaluate() {
    draws++;
    await rollHook?.(draws);
    this.total = this.drawn;
    return this;
  }
  toJSON() {
    return { class: "Roll", formula: this.formula, total: this.total };
  }
  async toMessage(data, options) {
    const p = { data, options, total: this.total };
    posts.push(p);
    return p;
  }
}
globalThis.foundry = {
  applications: {
    api: {
      DialogV2: {
        input: async () => {
          await dialogHook?.();
          return input;
        }
      }
    }
  }
};
function setup() {
  totals = [8, 19];
  draws = 0;
  posts = [];
  input = { chosen: "1" };
  dialogHook = rollHook = null;
}
test("the native-compatible Roll keeps either preferred result, including the lower one, and records both original rolls in chat evidence", async () => {
  for (const chosen of ["0", "1", 0, 1]) {
    setup();
    input = { chosen };
    const r = preferredInitiativeRoll(new Roll(), { actorUuid: "Actor.a", combatantUuid: "Combatant.a" });
    assert.ok(r instanceof Roll);
    assert.equal(r.total, null);
    assert.equal(await r.evaluate(), r);
    assert.equal(r.total, Number(chosen) === 0 ? 8 : 19);
    assert.equal(draws, 2);
    const m = await r.toMessage(
      { flavor: "Initiative", flags: { core: { initiativeRoll: true }, spycraft2: { existing: true } } },
      { create: false, messageMode: "gm" }
    );
    assert.equal(m.total, r.total);
    assert.equal(m.data.flags.spycraft2.initiativeChoice.chosenIndex, Number(chosen));
    assert.deepEqual(
      m.data.flags.spycraft2.initiativeChoice.alternatives.map(r => r.total),
      [8, 19]
    );
    assert.equal(m.data.flags.core.initiativeRoll, true);
    assert.equal(m.data.flags.spycraft2.existing, true);
    assert.deepEqual(m.options, { create: false, messageMode: "gm" });
    assert.equal(r.toJSON().total, r.total);
    assert.equal(draws, 2);
  }
});
test("closing keeps the higher draw, concurrent evaluation cannot create more dice, and invalid result identifiers cannot select a new result", async () => {
  setup();
  input = null;
  const r = preferredInitiativeRoll(new Roll());
  await Promise.all([r.evaluate(), r.evaluate()]);
  assert.equal(r.total, 19, "the higher of 8 and 19");
  assert.equal(draws, 2);
  await r.toMessage();
  assert.equal(draws, 2);
  for (const chosen of ["", -1, 2, "01", true]) {
    setup();
    input = { chosen };
    const p = preferredInitiativeRoll(new Roll());
    await assert.rejects(p.evaluate(), /original/);
    assert.equal(posts.length, 0);
    assert.equal(draws, 2);
  }
  setup();
  assert.throws(() => preferredInitiativeRoll(new Roll()).evaluateSync(), /asynchronous/);
});
test("validation blocks stale rolls before RNG, during either draw, after the choice and before posting without changing Count", async () => {
  for (const stage of ["before", "first", "second", "choice", "post"]) {
    setup();
    let valid = stage !== "before";
    const r = preferredInitiativeRoll(new Roll(), {
      validate: () => {
        if (!valid) throw Error("stale");
      }
    });
    rollHook = n => {
      if ((stage === "first" && n === 1) || (stage === "second" && n === 2)) valid = false;
    };
    dialogHook = () => {
      if (stage === "choice") valid = false;
    };
    if (stage === "post") {
      await r.evaluate();
      valid = false;
      await assert.rejects(r.toMessage(), /stale/);
    } else await assert.rejects(r.evaluate(), /stale/);
    assert.equal(posts.length, 0);
    assert.equal(draws, stage === "before" ? 0 : stage === "first" ? 1 : 2);
  }
});
function combatant() {
  class Base {
    getInitiativeRoll() {
      return new Roll();
    }
  }
  const C = shakenCombatantClass(Base),
    c = new C();
  c.uuid = "Combatant.a";
  c.actor = {
    uuid: "Actor.a",
    effects: [],
    appliedEffects: [],
    system: { activeFeatNames: ["Lightning Reflexes"], initiative: { total: 3 }, classLevels: {} }
  };
  c.initiative = null;
  c.flags = {};
  c.isOwner = true;
  c.parent = { id: "combat", round: 0, turn: null, started: false };
  return c;
}
test("the actual Combatant override preserves ordinary native rolls and freezes Lightning Reflexes eligibility, Count, modifier, Shaken and combat state", async () => {
  setup();
  let c = combatant();
  c.actor.system.activeFeatNames = [];
  const normal = c.getInitiativeRoll();
  await normal.evaluate();
  assert.equal(draws, 1);
  for (const cause of ["feat", "count", "modifier", "role", "combat", "shaken"]) {
    setup();
    c = combatant();
    const r = c.getInitiativeRoll();
    dialogHook = () => {
      if (cause === "feat") c.actor.system.activeFeatNames = [];
      if (cause === "count") c.initiative = 20;
      if (cause === "modifier") c.actor.system.initiative.total = 4;
      if (cause === "role") c.isOwner = false;
      if (cause === "combat") c.parent.round = 1;
      if (cause === "shaken") {
        c.actor.effects = [
          {
            id: "new",
            uuid: "Effect.new",
            active: true,
            statuses: new Set(["shaken-1"]),
            flags: { spycraft2: { shakenGrade: 1 } }
          }
        ];
        c.actor.appliedEffects = c.actor.effects;
      }
    };
    await assert.rejects(r.evaluate(), /changed/);
    assert.equal(posts.length, 0);
  }
});
