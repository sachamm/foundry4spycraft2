import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildPacks, ROOT } from "./lib/pack-docs.mjs";
import { buildGlassWake } from "./lib/glass-wake.mjs";
import { configureGlassWakeMission } from "./lib/glass-wake-setup.mjs";
import { defaultMission } from "../module/rules/gc/mission.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { computeNpcProfile } from "../module/rules/npcs.mjs";
import { SPYCRAFT } from "../module/config.mjs";

const built = buildPacks(),
  adventure = built.packs["glass-wake"].docs[0],
  data = JSON.parse(readFileSync(new URL("../src/data/glass-wake.json", import.meta.url))),
  stats = adventure._stats;
const setup = {
  mission: data.mission,
  emptyMission: defaultMission(),
  participants: adventure.actors.map(a => ({ id: a._id, key: a.flags.spycraft2.glassWake, type: a.type }))
};

test("Glass Wake has portable document links, private GM notes and fully linked staged encounters", () => {
  assert.equal(adventure._id, "76167ee4038d3ebd");
  assert.equal(adventure.actors.length, 9);
  assert.equal(adventure.scenes.length, 3);
  assert.equal(adventure.journal.length, 2);
  assert.equal(adventure.journal.flatMap(j => j.pages).length, 3);
  assert.deepEqual(
    adventure.scenes.map(s => s.tokens.length),
    [5, 5, 6]
  );
  assert.equal(
    adventure.scenes.reduce((n, s) => n + s.walls.length, 0),
    70
  );
  assert.equal(
    adventure.scenes.reduce((n, s) => n + s.lights.length, 0),
    23
  );
  const roots = new Map(
    Object.entries({
      Actor: adventure.actors,
      Scene: adventure.scenes,
      JournalEntry: adventure.journal,
      Macro: adventure.macros,
      Folder: adventure.folders
    }).map(([type, docs]) => [type, new Map(docs.map(d => [d._id, d]))])
  );
  for (const scene of adventure.scenes) {
    assert.equal(scene.active, false);
    assert.ok(
      roots
        .get("JournalEntry")
        .get(scene.journal)
        .pages.some(p => p._id === scene.journalEntryPage)
    );
    for (const token of scene.tokens) {
      assert.ok(roots.get("Actor").has(token.actorId));
      assert.equal(token.level, scene.initialLevel);
      assert.equal(token.delta, undefined);
      if (token.name.startsWith("Meridian Watch")) assert.equal(token.actorLink, false);
    }
  }
  assert.equal(adventure.journal[0].ownership.default, 0);
  assert.equal(adventure.journal[1].ownership.default, 2);
  const serialized = JSON.stringify(adventure);
  assert.doesNotMatch(serialized, /worlds\/|C:\\|operation-glass-wake\.|Prepared State and Rehearsal/);
  assert.deepEqual(adventure.combats, []);
  for (const [, uuid] of serialized.matchAll(/@UUID\[([^\]]+)\]/g)) {
    if (uuid.startsWith("Compendium.")) continue;
    const [type, id] = uuid.split(".");
    assert.ok(roots.get(type)?.has(id), uuid);
  }
  for (const path of new Set(serialized.match(/systems\/spycraft2\/[^"<>\s]+\.(?:webp|png|svg|jpg)/g)))
    assert.ok(existsSync(`${ROOT}/${path.replace("systems/spycraft2/", "")}`), path);
  assert.doesNotMatch(adventure.journal[1].pages[0].text.content, /North Lantern|Batch GL-09|Milo moved it/);
});

test("Glass Wake pregens remain complete and NPCs use valid current profiles", () => {
  for (const actor of adventure.actors) {
    assert.equal(actor.flags.spycraft2.sampleAgent, undefined);
    assert.equal(actor.flags.spycraft2.sampleNpc, undefined);
    if (actor.type === "agent") {
      const prepared = computeAgent(
        structuredClone(actor.system),
        actor.items.map(i => ({ ...i, id: i._id })),
        SPYCRAFT
      );
      assert.deepEqual(prepared.todo, [], actor.name);
      assert.deepEqual(prepared.warnings, [], actor.name);
      assert.equal(actor.system.vitality.value, prepared.vitality.max);
      assert.equal(actor.system.wounds.value, prepared.wounds.max);
      assert.equal(actor.system.actionDice.value, 3);
    } else {
      assert.equal(
        computeNpcProfile(actor.system.npcProfile, actor.system.npcType, 1, actor.system.abilities).complete,
        true,
        actor.name
      );
      assert.ok(!actor.system.damageTrack);
    }
  }
});

test("Glass Wake follows catalog changes without mutating the source actors or scenes", () => {
  const packs = structuredClone(built.packs);
  const guard = packs["sample-npcs"].docs.find(d => d.flags.spycraft2.sampleNpc === "meridian-guard");
  guard.system.npcProfile.grades.attack++;
  guard.embedded.items[0].system.description = "Updated catalog equipment";
  const before = structuredClone(packs);
  const changed = buildGlassWake(data, packs, { stats }).docs[0];
  const watch = changed.actors.find(a => a.flags.spycraft2.glassWake === "watch");
  assert.equal(watch.system.npcProfile.grades.attack, guard.system.npcProfile.grades.attack);
  assert.equal(watch.items[0].system.description, "Updated catalog equipment");
  assert.deepEqual(packs, before);
  // The embedded mission plan is priced from the updated NPC, rather than the saved scenario's old XP.
  assert.match(changed.macros[0].command, /"xp":50/);
});

test("Glass Wake rejects missing actor, scene and mission bindings during the build", () => {
  for (const mutate of [
    d => {
      d.actors[0].source = "missing";
    },
    d => {
      d.scenes[0].source = "missing";
    },
    d => {
      d.scenes[0].tokens[0].actor = "missing";
    },
    d => {
      d.mission.team[0] = "missing";
    }
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => buildGlassWake(changed, built.packs, { stats }), /Glass Wake/);
  }
});

function context({ current = defaultMission(), confirm = true, gm = true } = {}) {
  const calls = { writes: [], warnings: [], dialogs: 0, opens: 0 };
  let record = structuredClone(current);
  globalThis.game = {
    user: { isGM: gm },
    system: { id: "spycraft2" },
    actors: new Map(adventure.actors.map(a => [a._id, structuredClone({ ...a, id: a._id })])),
    settings: {
      get: (scope, key) => {
        assert.equal(scope, "spycraft2");
        assert.equal(key, "mission");
        return structuredClone(record);
      },
      set: async (scope, key, value) => {
        assert.equal(scope, "spycraft2");
        assert.equal(key, "mission");
        record = structuredClone(value);
        calls.writes.push(value);
      }
    },
    spycraft2: {
      gc: {
        open: async () => {
          calls.opens++;
        }
      }
    }
  };
  globalThis.ui = {
    notifications: { warn: m => calls.warnings.push(m), error: m => calls.warnings.push(m), info: () => {} }
  };
  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          confirm: async () => {
            calls.dialogs++;
            return typeof confirm === "function"
              ? confirm({
                  change: value => {
                    record = value;
                  }
                })
              : confirm;
          }
        }
      }
    }
  };
  return calls;
}

test("the serialized GM macro creates only an inactive mission after confirmation and refuses a second setup", async () => {
  const calls = context();
  const execute = new (Object.getPrototypeOf(async function () {}).constructor)(adventure.macros[0].command);
  await execute();
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].active, false);
  assert.equal(calls.writes[0].caliber, 2);
  assert.deepEqual(calls.writes[0].team, setup.mission.team);
  assert.equal(calls.opens, 1);
  await execute();
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.dialogs, 1);
  assert.match(calls.warnings.at(-1), /will not replace/);
});

test("setup preserves named, active, unnamed edited and unknown future mission state", async () => {
  for (const patch of [
    { name: "Campaign" },
    { active: true },
    { notes: "Unfinished prep" },
    { team: ["another"] },
    { caliber: 3 },
    { futureField: true }
  ]) {
    const calls = context({ current: { ...defaultMission(), ...patch } });
    await configureGlassWakeMission(setup);
    assert.deepEqual(calls.writes, []);
    assert.equal(calls.dialogs, 0);
  }
});

test("setup cancellation, player invocation and partial imports do not write or change resources", async () => {
  let calls = context({ confirm: false });
  await configureGlassWakeMission(setup);
  assert.deepEqual(calls.writes, []);
  calls = context({ gm: false });
  await configureGlassWakeMission(setup);
  assert.equal(calls.dialogs, 0);
  assert.deepEqual(calls.writes, []);
  for (const remove of [
    a => game.actors.delete(a.id),
    a => {
      game.actors.get(a.id).flags.spycraft2.glassWake = "another";
    }
  ]) {
    calls = context();
    remove(setup.participants[0]);
    await configureGlassWakeMission(setup);
    assert.equal(calls.dialogs, 0);
    assert.deepEqual(calls.writes, []);
  }
});

test("setup rechecks the mission and imported actors after the confirmation dialog", async () => {
  for (const confirm of [
    ({ change }) => {
      change({ ...defaultMission(), notes: "Another GM edited this" });
      return true;
    },
    () => {
      game.actors.clear();
      return true;
    }
  ]) {
    const calls = context({ confirm });
    await configureGlassWakeMission(setup);
    assert.deepEqual(calls.writes, []);
    assert.equal(calls.opens, 0);
    assert.match(calls.warnings[0], /changed/);
  }
});
