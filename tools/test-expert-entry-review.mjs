import test from "node:test";
import assert from "node:assert/strict";
import { ActorProgression } from "../module/documents/actor/progression.mjs";

let input = null;
globalThis.game = { user: { id: "gc", isGM: true }, settings: { get: () => false } };
globalThis.foundry = {
  utils: { escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => (typeof input === "function" ? input() : input) } } }
};
class Base {
  constructor(firstExpert = 5) {
    this.type = "agent";
    this.uuid = "Actor.review";
    this.isOwner = true;
    this.items = [
      {
        id: "brawler",
        name: "Brawler",
        type: "class",
        system: {
          identifier: "brawler",
          expert: true,
          requirements: { type: "feat", name: "Improvised Weapon Basics" }
        }
      }
    ];
    this.system = {
      progression: Array.from({ length: firstExpert }, (_, index) => ({
        classId: index === firstExpert - 1 ? "brawler" : "soldier",
        careerEntryId: `career${index + 1}`,
        vitality: 6,
        skills: {},
        expertEntry: null
      }))
    };
  }
  async update(patch) {
    if (patch["system.progression"]) this.system.progression = structuredClone(patch["system.progression"]);
  }
}
const Reviewed = ActorProgression(Base);
const decision = {
  classId: "brawler",
  decision: "review",
  confirmed: true,
  metAtEntry: true,
  note: "Reviewed the original career sheet before expert entry"
};

test("GC entry review records historical qualification and restores only that record after later levels", async () => {
  const actor = new Reviewed(),
    original = structuredClone(actor.system.progression);
  const result = await actor.reviewExpertEntry(decision);
  assert.equal(result.ok, true);
  assert.equal(result.review.career, 5);
  assert.equal(result.review.reviewedBy, "gc");
  actor.system.progression.push({ classId: "soldier", careerEntryId: "later", vitality: 7, skills: { intimidate: 1 } });
  await actor.reviewExpertEntry({ classId: "brawler", decision: "restore", confirmed: true });
  assert.deepEqual(actor.system.progression.slice(0, 5), original);
  assert.equal(actor.system.progression[5].careerEntryId, "later");
});

test("review does not grant an illegally early expert entry or waive confirmation and source notes", async () => {
  await assert.rejects(new Reviewed(4).reviewExpertEntry(decision), /before Career Level 5/);
  const actor = new Reviewed();
  await assert.rejects(actor.reviewExpertEntry({ ...decision, confirmed: false }), /confirm the GC/);
  await assert.rejects(actor.reviewExpertEntry({ ...decision, note: "" }), /identify the reviewed source/);
  await assert.rejects(actor.reviewExpertEntry({ ...decision, decision: "other" }), /Choose an entry-history/);
  game.user.isGM = false;
  await assert.rejects(actor.reviewExpertEntry(decision), /owning GC/);
  game.user.isGM = true;
  await actor.reviewExpertEntry({ ...decision, metAtEntry: false });
  assert.equal(actor.system.progression[4].expertEntry.ok, false);
});

test("a changed career prefix or class definition during review cannot overwrite another history", async () => {
  const actor = new Reviewed();
  input = () => {
    actor.system.progression[0].skills.intimidate = 1;
    return decision;
  };
  await assert.rejects(actor.reviewExpertEntry(), /history changed/);
  assert.equal(actor.system.progression[4].expertEntry, null);
  input = () => {
    actor.items[0].system.requirements = { type: "never" };
    return decision;
  };
  await assert.rejects(actor.reviewExpertEntry(), /history changed/);
  input = null;
});

test("concurrent GC decisions cannot both replace the same original entry", async () => {
  const actor = new Reviewed();
  const results = await Promise.allSettled([
    actor.reviewExpertEntry(decision),
    actor.reviewExpertEntry({ ...decision, metAtEntry: false })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(actor.system.progression[4].expertEntry.ok, true);
});
