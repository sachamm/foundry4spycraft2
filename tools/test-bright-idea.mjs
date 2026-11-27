// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { brightIdeaSources, brightIdeaPoolStatus, brightIdeaMigrationPlan } from "../module/rules/bright-idea.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = () => ({
  classLevels: { scientist: 7, fieldAnalyst: 4 },
  actionDice: { value: 0 },
  resourceUses: {},
  skillTotals: {
    electronics: { name: "Electronics", ranks: 4, cap: 30, threat: 20, totals: [{ ability: "int", total: 8 }] }
  },
  level: 11
});
test("same-named non-legacy sources have independent IDs and exact native milestones; borrowed sources stay separate by owner class", () => {
  for (let level = 0; level <= 20; level++) {
    const s = brightIdeaSources({ classLevels: { scientist: level } })[0];
    assert.equal(s?.limit ?? 0, level < 3 ? 0 : 2 + 2 * Math.floor((level - 3) / 4));
  }
  for (let level = 0; level <= 10; level++) {
    const s = brightIdeaSources({ classLevels: { fieldAnalyst: level } })[0];
    assert.equal(s?.limit ?? 0, level >= 8 ? 4 : level >= 4 ? 2 : 0);
  }
  const both = brightIdeaSources(state());
  assert.deepEqual(
    both.map(s => [s.id, s.limit]),
    [
      ["brightIdeaScientist", 4],
      ["brightIdeaFieldAnalyst", 2]
    ]
  );
  assert.equal(
    both.reduce((n, s) => n + s.limit, 0),
    6
  );
  const entries = [
    { name: "Scientist: Bright idea (1/session)", ownerClass: "pointman" },
    { name: "Scientist: Bright idea (1/session)", ownerClass: "pointman" },
    { name: "Scientist: Bright idea (1/session)", ownerClass: "other" }
  ];
  assert.equal(brightIdeaSources({ inheritedClassChoices: entries }).length, 2);
  assert.deepEqual(
    brightIdeaSources({ inheritedClassChoices: entries }).map(s => s.limit),
    [1, 1]
  );
  assert.equal(brightIdeaSources({ classLevels: { scientist: 3 }, inheritedClassChoices: entries }).length, 1);
});
test("one-source legacy usage is visible without mutation and migrates without refilling or losing past uses", () => {
  const s = state();
  s.classLevels = { scientist: 7 };
  s.resourceUses = { brightIdea: { epoch: "s", used: 2 }, brightIdeaScientist: { epoch: "s", used: 1 } };
  const status = brightIdeaPoolStatus(s, { session: "s" });
  assert.equal(status.automatic, true);
  assert.equal(status.sources[0].remaining, 1);
  assert.equal(s.resourceUses.brightIdeaScientist.used, 1);
  const plan = brightIdeaMigrationPlan(s, { session: "s" }, undefined, { at: 10, reviewedBy: "single" });
  assert.deepEqual(plan.updates["system.resourceUses.brightIdeaScientist"], { epoch: "s", used: 3 });
  assert.equal(plan.updates["system.resourceUses.-=brightIdea"], null);
  assert.equal(plan.updates["system.resourceUses.brightIdeaLegacyMigration"].history[0].used, 2);
  assert.equal(brightIdeaMigrationPlan(s, { session: "new" }), null);
});
test("ambiguous legacy usage requires an exact allocation within each source allowance, never automatic guessing or extra credit", () => {
  const s = state();
  s.resourceUses.brightIdea = { epoch: "s", used: 3 };
  assert.equal(brightIdeaPoolStatus(s, { session: "s" }).needsReview, true);
  assert.throws(() => brightIdeaMigrationPlan(s, { session: "s" }), /Ask the GC/);
  const p = brightIdeaMigrationPlan(s, { session: "s" }, { brightIdeaScientist: 2, brightIdeaFieldAnalyst: 1 });
  assert.equal(p.updates["system.resourceUses.brightIdeaScientist"].used, 2);
  assert.equal(p.updates["system.resourceUses.brightIdeaFieldAnalyst"].used, 1);
  for (const allocations of [
    { brightIdeaScientist: 2 },
    { brightIdeaScientist: 1, brightIdeaFieldAnalyst: 3 },
    { brightIdeaScientist: 3.5 },
    { unknown: 3 },
    { brightIdeaScientist: -1, brightIdeaFieldAnalyst: 4 }
  ])
    assert.throws(() => brightIdeaMigrationPlan(s, { session: "s" }, allocations));
  s.resourceUses.brightIdea.used = "3";
  assert.equal(brightIdeaPoolStatus(s, { session: "s" }).needsReview, true);
  assert.throws(() => brightIdeaMigrationPlan(s, { session: "s" }, {}), /malformed/);
});
let periods = { session: "s" },
  posts = [],
  rolls = 0,
  failPost = false,
  dialog = null,
  warnings = [];
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.bright";
    this.isOwner = true;
    this.type = "agent";
    this.system = state();
    this.system.limitedUses = limitedUseAbilities(this.system, [], cfg);
    this.items = new Map();
  }
  async update(data) {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.replace(/^system\./, "").split(".");
      let o = this.system;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      const k = keys.at(-1);
      if (k.startsWith("-=")) delete o[k.slice(2)];
      else o[k] = structuredClone(value);
    }
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gm", isGM: true },
  settings: { get: (_s, key) => (key === "linguistics" ? false : periods) },
  i18n: { localize: s => s, format: s => s }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async opts => (dialog ? dialog(opts) : { chosen: "1" }) } } }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return null;
    }
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (failPost) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
globalThis.Roll = class {
  constructor(_formula, data) {
    const n = ++rolls % 2 ? 4 : 12;
    this.total = n + data.total;
    this.dice = [{ total: n }];
  }
  async evaluate() {
    return this;
  }
  async toMessage(data, options = {}) {
    const prepared = { ...data, rolls: [this] };
    return options.create === false ? prepared : ChatMessage.create(prepared);
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const input = { check: "repair", brightIdea: true };
function reset() {
  periods = { session: "s" };
  posts = [];
  rolls = 0;
  failPost = false;
  dialog = null;
  warnings = [];
  game.user.isGM = true;
}
test("actual skill workflow exhausts Scientist and Field Analyst independently, chooses two dice once and records which pool paid", async () => {
  reset();
  const a = new SpycraftActor();
  for (let i = 0; i < 6; i++) await a.rollSkill("electronics", "int", { gearStatus: "available", ...input });
  assert.equal(posts.length, 6);
  assert.equal(rolls, 12);
  assert.deepEqual(
    posts.map(p => p.flags.spycraft2.choiceResourceId),
    [
      "brightIdeaScientist",
      "brightIdeaScientist",
      "brightIdeaScientist",
      "brightIdeaScientist",
      "brightIdeaFieldAnalyst",
      "brightIdeaFieldAnalyst"
    ]
  );
  assert.equal(posts[4].flags.spycraft2.choiceSource, "Bright Idea (Field Analyst)");
  assert.ok(posts[4].flavor.includes("Bright Idea (Field Analyst)"));
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 4);
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst.used, 2);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(await a.rollSkill("electronics", "int", { gearStatus: "available", ...input }), null);
  periods.session = "next";
  await a.rollSkill("electronics", "int", {
    gearStatus: "available",
    ...input,
    brightIdeaSource: "brightIdeaFieldAnalyst"
  });
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst.used, 1);
  assert.equal(a.system.resourceUses.brightIdeaScientist.epoch, "s");
});
test("failed posts refund only the selected source, invalid source choices do not charge and competing final uses post once", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.resourceUses.brightIdeaScientist = { epoch: "s", used: 3 };
  failPost = true;
  await assert.rejects(
    a.rollSkill("electronics", "int", {
      gearStatus: "available",
      ...input,
      brightIdeaSource: "brightIdeaFieldAnalyst"
    }),
    /post failed/
  );
  failPost = false;
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst, undefined);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 3);
  assert.equal(
    await a.rollSkill("electronics", "int", { gearStatus: "available", ...input, brightIdeaSource: "unknown" }),
    null
  );
  await Promise.all([
    a.rollSkill("electronics", "int", { gearStatus: "available", ...input, brightIdeaSource: "brightIdeaScientist" }),
    a.rollSkill("electronics", "int", { gearStatus: "available", ...input, brightIdeaSource: "brightIdeaScientist" })
  ]);
  assert.equal(posts.length, 1);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 4);
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst, undefined);
});
test("ambiguous combined history blocks use until GC allocation; cancellation and non-GC requests change nothing", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.resourceUses.brightIdea = { epoch: "s", used: 3 };
  assert.equal(
    a.limitedUseStatus.filter(s => s.workflow === "brightIdea").every(s => s.remaining === 0 && s.legacyReview),
    true
  );
  assert.equal(await a.rollSkill("electronics", "int", { gearStatus: "available", ...input }), null);
  assert.equal(posts.length, 0);
  game.user.isGM = false;
  await assert.rejects(
    a.migrateBrightIdeaUses({ allocations: { brightIdeaScientist: 2, brightIdeaFieldAnalyst: 1 } }),
    /GC reviews/
  );
  await assert.rejects(a.migrateBrightIdeaUses(), /Ask the GC/);
  game.user.isGM = true;
  dialog = () => null;
  assert.equal(await a.migrateBrightIdeaUses(), null);
  assert.equal(a.system.resourceUses.brightIdea.used, 3);
  dialog = opts => {
    assert.equal(opts.window.title, "Allocate past Bright Idea uses");
    return { source_0: "2", source_1: "1" };
  };
  await a.migrateBrightIdeaUses();
  assert.equal(a.system.resourceUses.brightIdea, undefined);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 2);
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst.used, 1);
  assert.equal(a.system.resourceUses.brightIdeaLegacyMigration.history.length, 1);
  assert.equal(await a.migrateBrightIdeaUses(), null);
  dialog = null;
  await a.rollSkill("electronics", "int", {
    gearStatus: "available",
    ...input,
    brightIdeaSource: "brightIdeaFieldAnalyst"
  });
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst.used, 2);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 2);
});
test("single-source automatic migration preserves past use through failed execution and never charges unrelated resources", async () => {
  reset();
  game.user.isGM = false;
  const a = new SpycraftActor();
  a.system.classLevels = { scientist: 7 };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.system.resourceUses = { brightIdea: { epoch: "s", used: 2 }, other: { epoch: "s", used: 5 } };
  failPost = true;
  await assert.rejects(a.rollSkill("electronics", "int", { gearStatus: "available", ...input }), /post failed/);
  failPost = false;
  assert.equal(a.system.resourceUses.brightIdea, undefined);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 2);
  assert.equal(a.system.resourceUses.brightIdeaLegacyMigration.history[0].used, 2);
  assert.equal(a.system.resourceUses.other.used, 5);
  await a.rollSkill("electronics", "int", { gearStatus: "available", ...input });
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 3);
  assert.equal(a.system.actionDice.value, 0);
});

test("malformed source counters and invalid costs fail closed without migrating or granting uses", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.resourceUses.brightIdeaScientist = { epoch: "s", used: "bad" };
  assert.equal(a.limitedUseStatus.find(s => s.id === "brightIdeaScientist").counterReview, true);
  assert.equal(a.limitedUseStatus.find(s => s.id === "brightIdeaScientist").remaining, 0);
  await assert.rejects(
    a.rollSkill("electronics", "int", { gearStatus: "available", ...input, brightIdeaSource: "brightIdeaScientist" }),
    /saved use count/
  );
  assert.equal(posts.length, 0);
  const b = new SpycraftActor();
  b.system.classLevels = { scientist: 7 };
  b.system.limitedUses = limitedUseAbilities(b.system, [], cfg);
  b.system.resourceUses.brightIdea = { epoch: "s", used: 2 };
  await assert.rejects(
    b.useLimitedAbility("brightIdeaScientist", () => true, { workflow: "brightIdea", additionalCost: -1 }),
    /Invalid additional/
  );
  assert.equal(b.system.resourceUses.brightIdea.used, 2);
  assert.equal(b.system.resourceUses.brightIdeaScientist, undefined);
});

test("Knowledge and Skills spend the same Bright Idea source; passive choices remain GC-only and failed Knowledge posts refund", async () => {
  reset();
  const a = new SpycraftActor(),
    k = { skill: "electronics", brightIdea: true, brightIdeaSource: "brightIdeaFieldAnalyst" };
  const m = await a.rollKnowledge(k);
  assert.equal(m.flags.spycraft2.checkKind, "knowledge");
  assert.equal(m.flags.spycraft2.choiceResourceId, k.brightIdeaSource);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(rolls, 2);
  await a.rollSkill("electronics", "int", { gearStatus: "available", ...input, brightIdeaSource: k.brightIdeaSource });
  assert.equal(a.system.resourceUses.brightIdeaFieldAnalyst.used, 2);
  assert.equal(await a.rollKnowledge(k), null);
  game.user.isGM = false;
  await assert.rejects(a.rollKnowledge({ ...k, brightIdeaSource: "brightIdeaScientist" }), /GC resolves/);
  assert.equal(a.system.resourceUses.brightIdeaScientist, undefined);
  a.system.activeFeatNames = ["Photographic Memory"];
  await a.rollKnowledge({ ...k, active: true, brightIdeaSource: "brightIdeaScientist" });
  assert.equal(posts.at(-1).flags.spycraft2.actionDiceAllowed, true);
  game.user.isGM = true;
  failPost = true;
  await assert.rejects(a.rollKnowledge({ ...k, brightIdeaSource: "brightIdeaScientist" }), /post failed/);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 1);
  failPost = false;
  await assert.rejects(a.rollKnowledge({ ...k, method: "take10", safeToTake: true }), /rolled Knowledge/);
  a.system.classLevels.scientist = 14;
  await assert.rejects(
    a.rollKnowledge({ ...k, tenSecondSolution: true, standaloneCheckConfirmed: true }),
    /Choose one/
  );
});
