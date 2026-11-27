import test from "node:test";
import assert from "node:assert/strict";
import {
  combatPersuasionSides,
  combatPersuasionAttempt,
  persuasionKey
} from "../module/rules/gc/combat-persuasion.mjs";
import {
  reserveCombatPersuasion,
  rollCombatPersuasion,
  settleCombatPersuasion
} from "../module/apps/gc/combat-persuasion.mjs";

const patchDocument = (document, patch) => {
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split(".");
    let node = document;
    for (const key of parts.slice(0, -1)) node = node[key] ??= {};
    node[parts.at(-1)] = structuredClone(value);
  }
};
function fixture({ grade = "neutral", total = 30 } = {}) {
  let serial = 0;
  const actors = ["a", "b", "c"].map(id => ({
    id,
    uuid: `Actor.${id}`,
    name: id,
    isOwner: true,
    type: "agent",
    flags: {},
    system: {}
  }));
  const npc = {
    id: "npc",
    uuid: "Actor.npc",
    name: "NPC",
    type: "npc",
    isOwner: true,
    flags: {},
    system: { npcType: "standard", disposition: { base: grade } },
    effects: []
  };
  npc.update = async patch => {
    patchDocument(npc, patch);
    return npc;
  };
  const combat = { id: "combat", started: true, combatants: actors.map(actor => ({ actor })) };
  const combats = [combat];
  combats.get = id => combats.find(c => c.id === id);
  const messages = [];
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    combat,
    combats,
    messages,
    settings: { get: () => ({}) }
  };
  globalThis.foundry = { utils: { randomID: () => `id${++serial}`, escapeHTML: String } };
  globalThis.ChatMessage = {
    getWhisperRecipients: () => [],
    create: async data => {
      messages.push(data);
      return data;
    }
  };
  globalThis.fromUuidSync = uuid => [npc, ...actors].find(a => a.uuid === uuid);
  const assignments = actors.map(a => ({ actorUuid: a.uuid, side: a.id === "c" ? "Other" : "Team" }));
  let rolls = 0;
  const roll = async (actor, binding) => {
    rolls++;
    const message = {
      uuid: `ChatMessage.${serial}`,
      rolls: [{ formula: "1d20", total: 10 }],
      flags: {
        spycraft2: {
          actorUuid: actor.uuid,
          checkKind: "skill",
          skillKey: "impress",
          checkId: "persuasion",
          rollCombat: { id: combat.id },
          combatPersuasion: binding,
          rawTotal: total,
          effectiveTotal: total,
          naturalDie: 10,
          successConfirmed: null,
          resolved: false
        }
      }
    };
    messages.push(message);
    return message;
  };
  for (const actor of actors) {
    actor.confirmCheckOutcome = async (message, options) => {
      message.flags.spycraft2.successConfirmed = options.succeeded;
      return message;
    };
    actor.finishCheck = async message => {
      message.flags.spycraft2.resolved = true;
      return message;
    };
  }
  const reserve = actor =>
    reserveCombatPersuasion(npc, { combat, actor: actor ?? actors[0], assignments, confirmed: true });
  const begin = async actor => {
    const claim = await reserve(actor);
    const message = await rollCombatPersuasion(npc, { combat, claimId: claim.id, roll });
    return { claim, message };
  };
  return {
    npc,
    actors,
    combat,
    assignments,
    messages,
    reserve,
    begin,
    roll,
    rolls: () => rolls,
    record: () => npc.flags.spycraft2.combatPersuasion.combat
  };
}

test("combat sides require exactly one named assignment for every participating character", () => {
  const participants = ["Actor.a", "Actor.b"];
  assert.throws(() => combatPersuasionSides(participants, [{ actorUuid: "Actor.a", side: "Team" }]));
  assert.throws(() =>
    combatPersuasionSides(
      participants,
      participants.map(() => ({ actorUuid: "Actor.a", side: "Team" }))
    )
  );
  assert.throws(() =>
    combatPersuasionSides(
      participants,
      participants.map(actorUuid => ({ actorUuid, side: " " }))
    )
  );
  assert.equal(
    combatPersuasionSides(
      participants,
      participants.map(actorUuid => ({ actorUuid, side: "Team" }))
    ).length,
    2
  );
});
test("one reservation covers the entire side, and participant labels cannot reset it", async () => {
  const f = fixture();
  await f.reserve();
  await assert.rejects(f.reserve(f.actors[1]), /already used/);
  assert.throws(
    () =>
      combatPersuasionAttempt(f.record(), {
        combatId: "combat",
        participants: f.actors.map(a => a.uuid),
        assignments: f.assignments.map(a => ({ ...a, side: "New" })),
        actorUuid: f.actors[1].uuid,
        grade: "neutral",
        id: "new"
      }),
    /already used/
  );
  assert.equal(Object.keys(f.record().attempts).length, 1);
});
test("concurrent reservations for teammates consume one side attempt", async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.reserve(), f.reserve(f.actors[1])]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
});
test("a failed persuasion leaves the opposing side eligible; its first success blocks all other attempts", async () => {
  const f = fixture({ total: 29 }),
    first = await f.begin();
  const failed = await settleCombatPersuasion(f.npc, first.message);
  assert.equal(failed.success, false);
  assert.equal(first.message.flags.spycraft2.resolved, true);
  const second = await f.begin(f.actors[2]);
  second.message.flags.spycraft2.effectiveTotal = 30;
  assert.equal((await settleCombatPersuasion(f.npc, second.message)).success, true);
  assert.equal(f.record().winner, "Other");
  await assert.rejects(f.reserve(), /already been persuaded/);
});
test("Adversarial requires an actual Triumph result, not a checked box or ordinary success", async () => {
  for (const total of [74, 75]) {
    const f = fixture({ grade: "adversarial", total }),
      { message } = await f.begin();
    assert.equal((await settleCombatPersuasion(f.npc, message)).success, total === 75);
  }
});
test("disposition is captured when the side declares its attempt", async () => {
  const f = fixture({ total: 30 }),
    { message } = await f.begin();
  f.npc.system.disposition.base = "hostile";
  assert.equal((await settleCombatPersuasion(f.npc, message)).dc, 30);
});
test("the recorded campaign DC policy changes the actual persuasion outcome", async () => {
  const f = fixture({ total: 29 }),
    { message } = await f.begin();
  message.flags.spycraft2.campaignSkillDCPolicy = { version: 1, skillDC: -5, skillDCMinimum: 10, medicineDC: 0 };
  const result = await settleCombatPersuasion(f.npc, message);
  assert.equal(result.success, true);
  assert.equal(result.dc, 25);
});
test("a cooperative helper cannot replace the actual leader's persuasion result", async () => {
  const f = fixture(),
    { message } = await f.begin();
  message.flags.spycraft2.cooperative = { role: "helper" };
  await assert.rejects(settleCombatPersuasion(f.npc, message), /actual Impress/);
});
test("a posting callback returning no result cannot reopen an already posted claim", async () => {
  const f = fixture(),
    claim = await f.reserve();
  await rollCombatPersuasion(f.npc, {
    claimId: claim.id,
    roll: async (actor, binding) => {
      await f.roll(actor, binding);
      return null;
    }
  });
  await assert.rejects(
    rollCombatPersuasion(f.npc, { claimId: claim.id, roll: f.roll }),
    /already recorded or interrupted/
  );
  assert.equal(f.rolls(), 1);
});
test("known cancellation can continue the same claim; unknown posting failure cannot draw again", async () => {
  const f = fixture(),
    claim = await f.reserve();
  await rollCombatPersuasion(f.npc, { claimId: claim.id, roll: async () => null });
  assert.equal(f.record().attempts.Team.state, "cancelled");
  await assert.rejects(
    rollCombatPersuasion(f.npc, {
      claimId: claim.id,
      roll: async () => {
        throw Error("response lost");
      }
    }),
    /response lost/
  );
  await assert.rejects(
    rollCombatPersuasion(f.npc, { claimId: claim.id, roll: f.roll }),
    /already recorded or interrupted/
  );
  assert.equal(f.rolls(), 0);
});
test("deleted check cards do not free an attempt or allow a new random draw", async () => {
  const f = fixture(),
    { claim } = await f.begin();
  f.messages.length = 0;
  await assert.rejects(
    rollCombatPersuasion(f.npc, { claimId: claim.id, roll: f.roll }),
    /already recorded or interrupted/
  );
  assert.equal(f.rolls(), 1);
});
test("committed reservation and settlement writes recover a lost response without duplicating the attempt", async () => {
  const f = fixture(),
    update = f.npc.update;
  f.npc.update = async patch => {
    await update(patch);
    throw Error("committed response lost");
  };
  const { message } = await f.begin();
  const first = await settleCombatPersuasion(f.npc, message),
    again = await settleCombatPersuasion(f.npc, message);
  assert.deepEqual(again, first);
  assert.equal(f.rolls(), 1);
});
test("a rejected settlement can retry its closed check with no fresh roll", async () => {
  const f = fixture(),
    { message } = await f.begin(),
    update = f.npc.update;
  f.npc.update = async () => {
    throw Error("rejected");
  };
  await assert.rejects(settleCombatPersuasion(f.npc, message), /rejected/);
  assert.equal(message.flags.spycraft2.resolved, true);
  f.npc.update = update;
  await settleCombatPersuasion(f.npc, message);
  assert.equal(f.rolls(), 1);
});
test("wrong target, actor, combat, skill, claim, superseded or missing actual roll evidence is rejected", async () => {
  for (const mutate of [
    m => {
      m.flags.spycraft2.combatPersuasion.npcUuid = "Actor.other";
    },
    m => {
      m.flags.spycraft2.actorUuid = "Actor.b";
    },
    m => {
      m.flags.spycraft2.rollCombat.id = "other";
    },
    m => {
      m.flags.spycraft2.checkId = "influence";
    },
    m => {
      m.flags.spycraft2.combatPersuasion.id = "other";
    },
    m => {
      m.flags.spycraft2.superseded = true;
    },
    m => {
      m.rolls = [];
    }
  ]) {
    const f = fixture(),
      { message } = await f.begin();
    mutate(message);
    await assert.rejects(settleCombatPersuasion(f.npc, message));
    assert.equal(f.record().winner, undefined);
  }
});
test("failed check closure leaves the side held without recruiting the NPC", async () => {
  const f = fixture(),
    { message } = await f.begin();
  f.actors[0].finishCheck = async () => {
    throw Error("check write failed");
  };
  await assert.rejects(settleCombatPersuasion(f.npc, message), /check write failed/);
  assert.equal(f.record().attempts.Team.state, "rolling");
  assert.equal(f.record().winner, undefined);
});
test("a completed check cannot be changed or replaced silently", async () => {
  const f = fixture(),
    { message } = await f.begin();
  await settleCombatPersuasion(f.npc, message);
  message.flags.spycraft2.effectiveTotal++;
  await assert.rejects(settleCombatPersuasion(f.npc, message), /completed persuasion check changed/);
});
test("changed claim identity during check closure cannot recruit the NPC", async () => {
  const f = fixture(),
    { message } = await f.begin();
  f.actors[0].finishCheck = async m => {
    m.flags.spycraft2.resolved = true;
    m.flags.spycraft2.combatPersuasion = { ...m.flags.spycraft2.combatPersuasion, id: "different" };
    return m;
  };
  await assert.rejects(settleCombatPersuasion(f.npc, message), /actual Impress/);
  assert.equal(f.record().winner, undefined);
});
test("PC targets, villains, unstarted combats and unconfirmed declarations cannot consume attempts", async () => {
  for (const mutate of [
    f => {
      f.npc.type = "agent";
    },
    f => {
      f.npc.system.npcType = "villain";
    },
    f => {
      f.combat.started = false;
    },
    f => {
      game.user.isGM = false;
    }
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.reserve());
    assert.equal(f.npc.flags.spycraft2, undefined);
  }
  const f = fixture();
  await assert.rejects(reserveCombatPersuasion(f.npc, { actor: f.actors[0], assignments: f.assignments }));
  assert.equal(persuasionKey("A.B"), "A%2EB");
});
