import test from "node:test";
import assert from "node:assert/strict";
import { companionRetargets, deltaChanges, deltaIsEmpty, deltaSource } from "../module/rules/token-delta.mjs";
import {
  applyLinkProposal,
  describeLinkProposal,
  linkProposal,
  pendingLinkProposals,
  reviewTokenLinks
} from "../module/apps/token-links.mjs";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  agentLinkUpdate,
  agentTokenLinkUpdate,
  documentUpdate,
  migrateWorld,
  retargetTokenCompanions
} from "../module/migrations/index.mjs";
import { agentTokenDefaults } from "../module/rules/creation-defaults.mjs";
import { RESOURCE_LOCK_ID } from "../module/rules/resource-locks.mjs";

/** An ActorDelta source as Foundry stores it for a token with no changes of its own. */
const emptyDelta = () => ({
  _id: "d1",
  name: null,
  type: null,
  img: null,
  system: {},
  items: [],
  effects: [],
  ownership: null,
  flags: {}
});

const baseSource = () => ({
  _id: "inez",
  type: "agent",
  name: "Inez Duarte",
  img: "inez.webp",
  ownership: { default: 2, gm: 3, u1: 3 },
  prototypeToken: { actorLink: false, sight: { enabled: true } },
  system: { vitality: { value: 30 }, biography: "" },
  items: [
    { _id: "pistol", name: "Pistol", type: "weapon", system: { equipped: true } },
    { _id: "knife", name: "Knife", type: "weapon", system: {} }
  ],
  effects: []
});

/** A base character and an unlinked token on a scene, recording every write. */
function world({ delta = emptyDelta(), actorLink = false, type = "agent" } = {}) {
  const writes = [];
  const source = { ...baseSource(), type };
  const actor = {
    ...source,
    id: source._id,
    prototypeToken: { ...source.prototypeToken },
    toObject: () => structuredClone(source),
    update: async (data, options) => {
      writes.push(["actor.update", data, options]);
      if (data["prototypeToken.actorLink"] !== undefined)
        actor.prototypeToken.actorLink = data["prototypeToken.actorLink"];
    },
    deleteEmbeddedDocuments: async (name, ids) => writes.push([`delete ${name}`, ids]),
    updateEmbeddedDocuments: async (name, rows) => writes.push([`update ${name}`, rows]),
    createEmbeddedDocuments: async (name, rows, options) => writes.push([`create ${name}`, rows, options.keepId])
  };
  const scene = { id: "warehouse", name: "Warehouse", tokens: [] };
  const token = {
    id: "t1",
    uuid: "Scene.warehouse.Token.t1",
    name: "Inez",
    actorId: actor.id,
    actorLink,
    baseActor: actor,
    parent: scene,
    _source: { delta },
    update: async (data, options) => {
      writes.push(["token.update", data, options]);
      Object.assign(token, data);
    }
  };
  scene.tokens.push(token);
  return { actor, token, scene, writes };
}

test("new agents are created with tokens linked to them", () => {
  assert.equal(agentTokenDefaults({}).actorLink, true);
  // A GC's explicit choice is kept.
  assert.equal(agentTokenDefaults({ actorLink: false })?.actorLink, undefined);
});

test("a token with no changes of its own has an empty delta", () => {
  assert.equal(deltaIsEmpty(null, baseSource()), true);
  assert.equal(deltaIsEmpty(emptyDelta(), baseSource()), true);
  // A name equal to the character's is not a change.
  assert.equal(deltaIsEmpty({ ...emptyDelta(), name: "Inez Duarte" }, baseSource()), true);
  assert.equal(deltaIsEmpty({ ...emptyDelta(), system: { vitality: { value: 12 } } }, baseSource()), false);
  assert.equal(deltaIsEmpty({ ...emptyDelta(), items: [{ _id: "knife", _tombstone: true }] }, baseSource()), false);
  assert.equal(deltaIsEmpty({ ...emptyDelta(), flags: { spycraft2: { note: 1 } } }, baseSource()), false);
});

test("a token's own changes become an update of its character", () => {
  const delta = {
    ...emptyDelta(),
    name: "Inez 'Ghost' Duarte",
    system: { vitality: { value: 12 }, biography: "<p>Edited by her player.</p>" },
    items: [
      { _id: "pistol", name: "Pistol", type: "weapon", system: { equipped: false } },
      { _id: "knife", _tombstone: true },
      { _id: "goggles", name: "Night-vision goggles", type: "gear", system: {} },
      { _id: "gone", _tombstone: true },
      { _id: RESOURCE_LOCK_ID, name: "lock", type: "gear", flags: { spycraft2: { resourceLock: { token: "x" } } } }
    ],
    effects: [{ _id: "e1", name: "Shaken", changes: [] }],
    // u3 has no entry on the character, so the character's default (Observer) is what they have.
    ownership: { default: 0, u1: 3, u2: 3, u3: 1 }
  };
  const changes = deltaChanges(delta, baseSource());
  assert.deepEqual(changes.actor, {
    system: { vitality: { value: 12 }, biography: "<p>Edited by her player.</p>" },
    name: "Inez 'Ghost' Duarte",
    // Ownership is only raised: the lower default and the unchanged owner are left alone.
    ownership: { u2: 3 }
  });
  assert.deepEqual(changes.items.update, [delta.items[0]]);
  assert.deepEqual(changes.items.delete, ["knife"]);
  // A removed item the character never had is ignored, and a resource lock is never copied.
  assert.deepEqual(
    changes.items.create.map(item => item._id),
    ["goggles"]
  );
  assert.deepEqual(changes.effects.create, [delta.effects[0]]);
  assert.equal(changes.count, 3 + 3 + 1);
});

test("deltaSource reads the stored delta, or a delta document's data", () => {
  assert.deepEqual(deltaSource({ _source: { delta: { system: { a: 1 } } } }), { system: { a: 1 } });
  assert.deepEqual(deltaSource({ delta: { toObject: () => ({ system: { b: 2 } }) } }), { system: { b: 2 } });
  assert.equal(deltaSource({}), null);
});

test("migration 5 links agent prototype tokens, and placed agent tokens that hold no changes", () => {
  assert.ok(SCHEMA_VERSION >= 5);
  assert.ok(MIGRATIONS.some(m => m.version === 5 && m.actor === agentLinkUpdate && m.token === agentTokenLinkUpdate));
  assert.deepEqual(agentLinkUpdate(baseSource()), { "prototypeToken.actorLink": true });
  assert.equal(agentLinkUpdate({ ...baseSource(), prototypeToken: { actorLink: true } }), null);
  assert.equal(agentLinkUpdate({ ...baseSource(), type: "npc" }), null);
  // An agent's animal partner is one particular creature too.
  const partner = { ...baseSource(), type: "npc", system: { companionOf: { ownerUuid: "Actor.inez", feat: "x" } } };
  assert.deepEqual(agentLinkUpdate(partner), { "prototypeToken.actorLink": true });
  assert.deepEqual(agentTokenLinkUpdate({ actorLink: false, delta: emptyDelta() }, partner), { actorLink: true });
  // An unlinked token's own copy of the agent is not given a prototype update.
  assert.equal(agentLinkUpdate(baseSource(), null, { synthetic: true }), null);
  assert.equal(
    documentUpdate(
      "actor",
      baseSource(),
      null,
      MIGRATIONS.filter(m => m.version === 5),
      { synthetic: true }
    ),
    null
  );

  assert.deepEqual(agentTokenLinkUpdate({ actorLink: false, delta: emptyDelta() }, baseSource()), { actorLink: true });
  assert.equal(agentTokenLinkUpdate({ actorLink: true, delta: emptyDelta() }, baseSource()), null);
  assert.equal(agentTokenLinkUpdate({ actorLink: false, delta: emptyDelta() }, { ...baseSource(), type: "npc" }), null);
  // A token holding its own changes is left for the GC's review, so nothing it holds is lost.
  assert.equal(
    agentTokenLinkUpdate(
      { actorLink: false, delta: { ...emptyDelta(), system: { vitality: { value: 5 } } } },
      baseSource()
    ),
    null
  );
});

test("the world migration compares a placed token against its own character, not the token's copy", async () => {
  const { actor, token } = world();
  const tokenWrites = [];
  const doc = (source, writes) => ({
    name: source.name,
    toObject: () => structuredClone(source),
    update: async data => writes.push(data),
    items: []
  });
  const actorWrites = [];
  const base = doc(actor.toObject(), actorWrites);
  const placed = {
    ...doc({ actorLink: false, delta: emptyDelta() }, tokenWrites),
    baseActor: base,
    // The copy an unlinked token shows: a different object from the character.
    actor: doc({ ...actor.toObject(), name: "Copy" }, [])
  };
  const report = await migrateWorld(
    { version: 4, actors: [base], items: [], tokens: [placed], setVersion: async () => {} },
    { migrations: MIGRATIONS.filter(m => m.version === 5), to: 5 }
  );
  assert.equal(report.failed, 0);
  assert.deepEqual(actorWrites, [{ "prototypeToken.actorLink": true }]);
  assert.deepEqual(tokenWrites, [{ actorLink: true }]);
  assert.ok(token);
});

test("only unlinked agent tokens are proposed, and declined ones are not offered again", () => {
  const unlinked = world();
  assert.equal(linkProposal(unlinked.token).actor, unlinked.actor);
  assert.equal(linkProposal(world({ actorLink: true }).token), null);
  assert.equal(linkProposal(world({ type: "npc" }).token), null);
  const partner = world({ type: "npc" });
  partner.actor.system = { companionOf: { ownerUuid: "Actor.inez" } };
  assert.equal(linkProposal(partner.token).actor, partner.actor);
  assert.equal(pendingLinkProposals([unlinked.scene]).length, 1);
  assert.equal(pendingLinkProposals([unlinked.scene], { dismissed: { "Scene.warehouse.Token.t1": true } }).length, 0);
});

test("the review row says where the token is and what linking it copies", () => {
  const { token } = world({ delta: { ...emptyDelta(), system: { vitality: { value: 12 } } } });
  assert.equal(
    describeLinkProposal(linkProposal(token)),
    "Inez on Warehouse: copy the 1 change(s) made through this token to Inez Duarte, then link it."
  );
  assert.equal(
    describeLinkProposal(linkProposal(world().token)),
    "Inez on Warehouse: link to Inez Duarte. The token has no changes of its own."
  );
});

test("linking copies the token's changes to the character first, then links the token and its prototype", async () => {
  const delta = {
    ...emptyDelta(),
    system: { vitality: { value: 12 } },
    items: [
      { _id: "knife", _tombstone: true },
      { _id: "pistol", name: "Pistol", type: "weapon", system: { equipped: false } },
      { _id: "goggles", name: "Goggles", type: "gear", system: {} }
    ]
  };
  const { token, writes, actor } = world({ delta });
  await applyLinkProposal(linkProposal(token));
  assert.deepEqual(
    writes.map(([what]) => what),
    ["actor.update", "delete Item", "update Item", "create Item", "token.update", "actor.update"]
  );
  assert.deepEqual(writes[0][1], { system: { vitality: { value: 12 } } });
  assert.equal(writes[3][2], true, "created items keep their ids");
  assert.deepEqual(writes[4][1], { actorLink: true });
  assert.equal(actor.prototypeToken.actorLink, true);
});

test("a failed copy leaves the token unlinked, so its changes are not lost", async () => {
  const { token, actor, writes } = world({ delta: { ...emptyDelta(), system: { vitality: { value: 12 } } } });
  actor.update = async () => {
    throw new Error("offline");
  };
  await assert.rejects(applyLinkProposal(linkProposal(token)), /offline/);
  assert.equal(token.actorLink, false);
  assert.equal(writes.length, 0);
});

test("the GC review links ticked rows and remembers unticked ones", async () => {
  const saved = {};
  const first = world({ delta: { ...emptyDelta(), system: { vitality: { value: 12 } } } });
  const second = world();
  second.token.uuid = "Scene.warehouse.Token.t2";
  let content = "";
  globalThis.game = {
    settings: { get: () => ({}), set: async (_s, key, value) => (saved[key] = value) }
  };
  globalThis.ui = { notifications: { info() {}, error() {} } };
  globalThis.foundry = {
    utils: { escapeHTML: s => String(s) },
    applications: {
      api: {
        DialogV2: {
          input: async options => {
            content = options.content;
            return { "link-0": true, "link-1": false };
          }
        }
      }
    }
  };
  const result = await reviewTokenLinks([linkProposal(first.token), linkProposal(second.token)]);
  assert.deepEqual(result, { linked: 1, failed: 0 });
  assert.equal(first.token.actorLink, true);
  assert.equal(second.token.actorLink, false);
  assert.deepEqual(saved.tokenLinkReviewDismissed, { "Scene.warehouse.Token.t2": true });
  assert.match(content, /do not reach the character in the Actors list/);
  delete globalThis.game;
  delete globalThis.ui;
});

test("companions made from an unlinked token's sheet follow the agent once the token is linked", async () => {
  const fromToken = {
    system: { companionOf: { ownerUuid: "Scene.warehouse.Token.t1.Actor.inez" } },
    writes: [],
    update: async function (data) {
      this.writes.push(data);
    }
  };
  const fromAgent = { ...fromToken, system: { companionOf: { ownerUuid: "Actor.inez" } }, writes: [] };
  const otherToken = {
    ...fromToken,
    system: { companionOf: { ownerUuid: "Scene.warehouse.Token.t9.Actor.x" } },
    writes: []
  };
  const retargets = companionRetargets(
    [fromToken, fromAgent, otherToken],
    (scene, id) => scene === "warehouse" && id === "t1"
  );
  assert.deepEqual(
    retargets.map(r => [r.actor, r.update]),
    [[fromToken, { "system.companionOf.ownerUuid": "Actor.inez" }]]
  );

  // The world migration does the same for every token that is linked by then.
  const tokens = new Map([
    ["t1", { actorLink: true }],
    ["t9", { actorLink: false }]
  ]);
  await retargetTokenCompanions({ actors: [fromToken, fromAgent, otherToken], scenes: [{ id: "warehouse", tokens }] });
  assert.deepEqual(fromToken.writes, [{ "system.companionOf.ownerUuid": "Actor.inez" }]);
  assert.deepEqual([fromAgent.writes, otherToken.writes], [[], []]);

  // And linking a token in the review points its companions at the agent.
  const { token } = world();
  const companion = { ...fromToken, writes: [] };
  globalThis.game = { actors: [companion] };
  await applyLinkProposal(linkProposal(token));
  assert.deepEqual(companion.writes.at(-1), { "system.companionOf.ownerUuid": "Actor.inez" });
  delete globalThis.game;
});
