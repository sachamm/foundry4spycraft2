import test from "node:test";
import assert from "node:assert/strict";
import { temporaryFeatActive, temporarySharePlan } from "../module/rules/temporary-feats.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const sourceFeat = {
  id: "feat",
  name: "Techie",
  type: "feat",
  system: { tree: "basicSkill", featKind: "permanent", bonuses: [{ target: "wounds", value: "2" }] }
};
const source = { coreClassIds: ["scientist"], actionDice: { max: 2 }, featStatus: { feat: { ok: true } } };
const options = { epoch: "session-a", atSessionStart: true, sourceActorUuid: "Actor.source" };
test("Professor shares eligible permanent Basic Skill feats only, up to starting action dice, once at session start", () => {
  const [copy] = temporarySharePlan(source, [sourceFeat], "professor", ["feat"], options);
  assert.equal(copy.system.featKind, "temporary");
  assert.equal(copy.system.granted, true);
  assert.equal(copy.system.acquisitionCheck, null);
  assert.deepEqual(copy.system.temporaryGrant, {
    period: "session",
    epoch: "session-a",
    sourceActorUuid: "Actor.source",
    ability: "professor"
  });
  assert.equal(sourceFeat.system.featKind, "permanent");
  for (const system of [
    { ...source, coreClassIds: [] },
    { ...source, actionDice: { max: 0 } },
    { ...source, featStatus: {} },
    { ...source, temporaryShares: { professor: { epoch: "session-a" } } }
  ])
    assert.throws(() => temporarySharePlan(system, [sourceFeat], "professor", ["feat"], options));
  for (const kind of ["temporary", "virtual"])
    assert.throws(() =>
      temporarySharePlan(
        source,
        [{ ...sourceFeat, system: { ...sourceFeat.system, featKind: kind } }],
        "professor",
        ["feat"],
        options
      )
    );
  assert.throws(() => temporarySharePlan(source, [sourceFeat], "professor", ["feat", "feat"], options));
  assert.throws(() =>
    temporarySharePlan(source, [sourceFeat], "professor", ["feat"], { ...options, atSessionStart: false })
  );
});
test("Trailblazer uses Terrain feats and remains unavailable without its core class", () => {
  const terrain = { ...sourceFeat, system: { ...sourceFeat.system, tree: "terrain" } },
    scout = { ...source, coreClassIds: ["scout"] };
  assert.equal(temporarySharePlan(scout, [terrain], "trailblazer", ["feat"], options).length, 1);
  assert.throws(() => temporarySharePlan(scout, [sourceFeat], "trailblazer", ["feat"], options));
});
const cls = {
  id: "test",
  type: "class",
  name: "Test",
  system: { identifier: "test", classSkills: [], table: [], vitalityDie: 6, skillPoints: 4 }
};
function sys(epoch = "session-a") {
  return {
    usagePeriods: { session: epoch },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 10 }])),
    progression: [{ classId: "test", vitality: 1, skills: {} }],
    misc: {}
  };
}
test("session expiry removes benefits without deleting player records; permanent and legacy temporary feats remain unaffected", () => {
  const [feat] = temporarySharePlan(source, [sourceFeat], "professor", ["feat"], options);
  feat.id = "temp";
  assert.equal(temporaryFeatActive(sys(), feat), true);
  assert.equal(temporaryFeatActive(sys("session-b"), feat), false);
  const current = computeAgent(sys(), [cls, feat], cfg),
    expired = computeAgent(sys("session-b"), [cls, feat], cfg);
  assert.equal(current.wounds.max, 12);
  assert.equal(expired.wounds.max, 10);
  assert.equal(expired.featStatus.temp.ok, false);
  assert.equal(current.feats.any.spent, 0);
  assert.equal(temporaryFeatActive(sys("session-b"), sourceFeat), true);
  assert.equal(temporaryFeatActive(sys(), { system: { featKind: "temporary" } }), true);
});
test("temporary sharing does not waive prerequisites and cannot qualify permanent feats", () => {
  const [feat] = temporarySharePlan(source, [sourceFeat], "professor", ["feat"], options);
  feat.id = "temp";
  feat.system.prerequisites = { type: "ability", key: "str", min: 13 };
  assert.equal(computeAgent(sys(), [cls, feat], cfg).featStatus.temp.ok, false);
});
globalThis.Actor = class {
  constructor() {
    this.id = "source";
    this.uuid = "Actor.source";
    this.type = "agent";
    this.isOwner = true;
    this.items = [sourceFeat];
    this.system = structuredClone(source);
  }
  async update(data) {
    if (data["system.temporaryShares"]) this.system.temporaryShares = structuredClone(data["system.temporaryShares"]);
  }
};
let appEpoch = "session-a",
  registry = [],
  cards = [],
  serial = 0;
globalThis.game = { user: { id: "gc", isGM: true }, settings: { get: () => ({ session: appEpoch }) } };
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    const card = {
      ...structuredClone(data),
      id: `card${++serial}`,
      uuid: `ChatMessage.card${serial}`,
      isAuthor: true,
      async update(change) {
        if (change["flags.spycraft2.temporaryShare"])
          this.flags.spycraft2.temporaryShare = structuredClone(change["flags.spycraft2.temporaryShare"]);
        if (change.content) this.content = change.content;
      }
    };
    cards.push(card);
    return card;
  }
};
globalThis.fromUuid = async uuid => [...registry, ...cards].find(doc => doc.uuid === uuid);
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function sharingContext() {
  appEpoch = "session-a";
  registry = [];
  cards = [];
  serial = 0;
  game.user.isGM = true;
  const actor = new SpycraftActor();
  registry.push(actor);
  const target = id => {
    const a = {
      uuid: `Actor.${id}`,
      type: "agent",
      isOwner: true,
      items: [],
      system: { level: 1 },
      calls: 0,
      failBefore: false,
      failAfter: false,
      get usagePeriods() {
        return { session: appEpoch };
      },
      async createEmbeddedDocuments(_type, data) {
        this.calls++;
        if (this.failBefore) throw Error("creation failed");
        const docs = data.map(row => ({ ...structuredClone(row), id: `feat${++serial}` }));
        this.items.push(...docs);
        if (this.failAfter) throw Error("response lost");
        return docs;
      },
      async deleteEmbeddedDocuments(_type, ids) {
        this.items = this.items.filter(i => !ids.includes(i.id));
      }
    };
    registry.push(a);
    return a;
  };
  const first = target("first"),
    second = target("second");
  const input = { featIds: ["feat"], recipients: [first, second], atSessionStart: true };
  return { actor, first, second, input };
}

test("interrupted sharing retains delivered grants and its consumed selection until GC recovery", async () => {
  const { actor, first, second, input } = sharingContext();
  second.failBefore = true;
  await assert.rejects(actor.shareTemporaryFeats("professor", input), /creation failed/);
  assert.equal(first.items.length, 1);
  assert.equal(actor.system.temporaryShares.professor.state, "needsReview");
  await assert.rejects(actor.shareTemporaryFeats("professor", input), /interrupted shared-feat/);
  second.failBefore = false;
  await actor.reviewTemporaryShare("professor", {
    confirmed: true,
    action: "finish",
    note: "Second recipient confirmed undelivered"
  });
  assert.equal(first.calls, 1);
  assert.equal(second.items.length, 1);
  assert.equal(actor.system.temporaryShares.professor.state, "complete");
});
test("successful sharing persists the selected source feats and blocks another selection in the session", async () => {
  const { actor, first: target } = sharingContext();
  const input = { featIds: ["feat"], recipients: [target], atSessionStart: true };
  await actor.shareTemporaryFeats("professor", input);
  assert.equal(target.calls, 1);
  assert.deepEqual(actor.system.temporaryShares.professor.featIds, ["feat"]);
  await assert.rejects(actor.shareTemporaryFeats("professor", input), /already been chosen/);
  assert.equal(target.calls, 1);
  const other = { ...target, isOwner: false };
  await assert.rejects(
    new SpycraftActor().shareTemporaryFeats("professor", { ...input, recipients: [other] }),
    /Choose teammates/
  );
});

test("a lost recipient response reconciles its actual grant without creating a duplicate", async () => {
  const { actor, first, input } = sharingContext();
  first.failAfter = true;
  await assert.rejects(actor.shareTemporaryFeats("professor", input), /response lost/);
  assert.equal(first.items.length, 1);
  game.user.isGM = false;
  await assert.rejects(
    actor.reviewTemporaryShare("professor", { confirmed: true, action: "finish", note: "Player retry" }),
    /GC reviews/
  );
  game.user.isGM = true;
  first.failAfter = false;
  await actor.reviewTemporaryShare("professor", {
    confirmed: true,
    action: "finish",
    note: "Actual first grant found; second never delivered"
  });
  assert.equal(first.items.length, 1);
  assert.equal(first.calls, 1);
  assert.equal(actor.system.temporaryShares.professor.delivered.length, 2);
});

test("positive delivery history survives removed feats and deleted chat cards without a free replacement", async () => {
  const { actor, first, input } = sharingContext();
  await actor.shareTemporaryFeats("professor", input);
  first.items = [];
  cards = [];
  await actor.shareTemporaryFeats("professor");
  assert.equal(cards.length, 1);
  assert.equal(first.calls, 1);
  actor.system.temporaryShares.professor.state = "needsReview";
  await actor.reviewTemporaryShare("professor", {
    confirmed: true,
    action: "finish",
    note: "Removed first grant was already delivered"
  });
  assert.equal(first.items.length, 0);
  assert.equal(first.calls, 1);
});

test("Undo removes only this selection's temporary grants and retains the once-per-session selection", async () => {
  const { actor, first, second, input } = sharingContext();
  first.items = [{ ...structuredClone(sourceFeat), id: "owned" }];
  await actor.shareTemporaryFeats("professor", input);
  assert.equal(first.calls, 0);
  assert.equal(second.items.length, 1);
  await actor.withdrawTemporaryShare("professor", { confirmed: true });
  assert.equal(first.items[0].id, "owned");
  assert.equal(second.items.length, 0);
  assert.equal(actor.system.temporaryShares.professor.state, "withdrawn");
  await assert.rejects(actor.shareTemporaryFeats("professor", input), /already been chosen/);
});

test("two sharing sources serialize recipient writes instead of granting a duplicate selection", async () => {
  const { actor, first } = sharingContext(),
    other = new SpycraftActor();
  other.id = "other";
  other.uuid = "Actor.other";
  registry.push(other);
  const input = { featIds: ["feat"], recipients: [first], atSessionStart: true };
  await Promise.all([actor.shareTemporaryFeats("professor", input), other.shareTemporaryFeats("professor", input)]);
  assert.equal(first.items.length, 1);
  assert.equal(first.calls, 1);
  assert.equal(other.system.temporaryShares.professor.delivered[0].outcome, "alreadyOwned");
});

test("a new session permits a fresh selection; undoing the old card preserves the new grant", async () => {
  const { actor, first, input } = sharingContext();
  input.recipients = [first];
  await actor.shareTemporaryFeats("professor", input);
  const old = cards[0].uuid;
  appEpoch = "session-b";
  await actor.shareTemporaryFeats("professor", input);
  assert.equal(first.items.length, 2);
  const activeId = actor.system.temporaryShares.professor.id;
  await actor.withdrawTemporaryShare("professor", { confirmed: true, messageUuid: old });
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].system.temporaryGrant.grantId, activeId);
  assert.equal(actor.system.temporaryShares.professor.state, "complete");
});

test("GC consumption review retains an undelivered recipient's selection without granting it", async () => {
  const { actor, first, second, input } = sharingContext();
  second.failBefore = true;
  await assert.rejects(actor.shareTemporaryFeats("professor", input));
  await actor.reviewTemporaryShare("professor", {
    confirmed: true,
    action: "consume",
    note: "History uncertain; keep actual grants without issuing another"
  });
  assert.equal(first.items.length, 1);
  assert.equal(second.items.length, 0);
  assert.equal(actor.system.temporaryShares.professor.delivered[1].outcome, "reviewedMissing");
  assert.equal(actor.system.temporaryShares.professor.state, "complete");
  assert.deepEqual(cards[0].whisper, ["gc"]);
});

test("partial withdrawal retries only remaining grants and never resets the source selection", async () => {
  const { actor, first, second, input } = sharingContext();
  await actor.shareTemporaryFeats("professor", input);
  const remove = second.deleteEmbeddedDocuments;
  second.deleteEmbeddedDocuments = async () => {
    throw Error("delete interrupted");
  };
  await assert.rejects(actor.withdrawTemporaryShare("professor", { confirmed: true }), /delete interrupted/);
  assert.equal(first.items.length, 0);
  assert.equal(second.items.length, 1);
  second.deleteEmbeddedDocuments = remove;
  await actor.withdrawTemporaryShare("professor", { confirmed: true });
  assert.equal(second.items.length, 0);
  await assert.rejects(actor.shareTemporaryFeats("professor", input), /already been chosen/);
});

test("temporary feat numerical bonuses cannot qualify permanent feats or expert class entry", () => {
  const temporary = {
    id: "temp",
    name: "Temporary strength",
    type: "feat",
    system: { featKind: "temporary", granted: true, bonuses: [{ target: "abilities.str", value: "4" }] }
  };
  const permanent = {
    id: "permanent",
    name: "Permanent feat",
    type: "feat",
    system: { prerequisites: { type: "ability", key: "str", min: 13 }, bonuses: [{ target: "wounds", value: "10" }] }
  };
  const result = computeAgent(sys(), [cls, temporary, permanent], cfg);
  assert.equal(result.abilities.str.value, 14);
  assert.equal(result.featStatus.permanent.ok, false);
  assert.equal(result.wounds.max, 10);
});

test("legacy expert-entry review excludes temporary and explicit virtual numeric bonuses", () => {
  const expert = {
    id: "expert",
    name: "Test Expert",
    type: "class",
    system: {
      identifier: "expert",
      expert: true,
      requirements: { type: "ability", key: "str", min: 13 },
      classSkills: [],
      table: [],
      skillPoints: 4,
      vitalityDie: 6
    }
  };
  for (const featKind of ["temporary", "virtual"]) {
    const grant = {
      id: "bonus",
      name: "Borrowed strength",
      type: "feat",
      system: { featKind, granted: featKind === "temporary", bonuses: [{ target: "abilities.str", value: "4" }] }
    };
    const input = sys();
    input.progression.push({ classId: "expert", vitality: 1, skills: {} });
    const result = computeAgent(input, [cls, expert, grant], cfg);
    assert.equal(result.abilities.str.value, 14);
    assert.ok(
      result.expertClassStatus.expert.active === false && result.expertClassStatus.expert.current.ok === false,
      featKind
    );
  }
});
