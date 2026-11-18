import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { temporaryFocusPlan } from "../module/rules/training.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  scientist = defs.find(c => c.key === "scientist"),
  cls = {
    id: "s",
    name: scientist.name,
    type: "class",
    system: { ...scientist, identifier: "scientist", vitalityDie: scientist.vitality }
  },
  fs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
  depth = fs.find(f => f.name === "Depth of Study");
const source = () => ({
  actorUuid: "Actor.qa",
  usagePeriods: { mission: "a" },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
  progression: Array.from({ length: 20 }, (_, i) => ({
    classId: "scientist",
    vitality: 6,
    skills: i === 0 ? { science: 4 } : {}
  })),
  focuses: { cultures: [], drive: [], science: [], profession: [], fortes: [] },
  actionDice: { value: 0 }
});
const temp = (id = "temp", choices = []) => ({
  id,
  name: "Depth of Study",
  type: "feat",
  system: {
    ...structuredClone(depth),
    tree: "advancedSkill",
    featKind: "temporary",
    acquiredAtLevel: 20,
    focusChoices: choices,
    temporaryGrant: {
      period: "mission",
      epoch: "a",
      ability: "knowItAll",
      selfGranted: true,
      sourceActorUuid: "Actor.qa"
    }
  }
});
const pick = (focus, kind = "focus", forte = "", skill = "science") => ({ kind, skill, focus, forte });
const choices = [pick("Engineering"), pick("Engineering", "forte", "Bridges")];
const compute = (items = [temp()], patch = {}) => computeAgent({ ...source(), ...patch }, [cls, ...items], cfg);
test("temporary focus choices cover every printed focus and free Profession, validate exact ordered pairs and reject invalid/duplicate/unknown selections", () => {
  const f = temp(),
    s = compute();
  let count = 0;
  for (const [skill, focuses] of Object.entries(cfg.focuses))
    for (const focus of focuses) {
      const result = temporaryFocusPlan(
        s,
        f,
        [pick(focus, "focus", "", skill), pick(focus, "forte", "Specific subdivision", skill)],
        cfg
      );
      assert.equal(result[0].focus, focus);
      count++;
    }
  assert.equal(count, 32);
  assert.equal(
    temporaryFocusPlan(
      s,
      f,
      [pick("Locksmith", "focus", "", "profession"), pick("Locksmith", "forte", "Commercial locks", "profession")],
      cfg
    ).length,
    2
  );
  for (const bad of [
    [],
    [choices[0]],
    [...choices, choices[0]],
    [choices[1], choices[0]],
    [choices[0], choices[0]],
    [pick("Invalid focus"), choices[1]],
    [{ ...choices[0], skill: "constructor" }, choices[1]]
  ])
    assert.throws(() => temporaryFocusPlan(s, f, bad, cfg));
  assert.throws(
    () => temporaryFocusPlan(s, { ...f, system: { ...f.system, featKind: "permanent" } }, choices, cfg),
    /active temporary/
  );
});
test("source-scoped focuses and fortes execute checks while preserving permanent arrays and reserving exactly two picks per active source", () => {
  const s = compute([temp("one", choices), temp("two", [pick("Genetics"), pick("Genetics", "forte", "DNA analysis")])]);
  assert.deepEqual(s.focuses.science, []);
  assert.equal(s.skillFortes, undefined);
  assert.deepEqual(s.focusTotals.science, ["Engineering", "Genetics"]);
  assert.equal(s.skillForteTotals.length, 2);
  assert.equal(s.focusPicks.generic.reservedAvailable, 4);
  assert.equal(s.focusPicks.generic.reservedUsed, 4);
  assert.equal(s.focusPicks.generic.unscopedAvailable, 1);
  assert.equal(s.focusPicks.generic.used, 4);
  assert.equal(s.focusPicks.generic.remaining, 1);
  const check = cfg.skills.science.checks.find(c => c.id === "engineering"),
    normal = resolveSkillCheck(s, "science", check, { focus: "Engineering", gearStatus: "available" }),
    forte = resolveSkillCheck(s, "science", check, { focus: "Engineering", forte: true, gearStatus: "available" });
  assert.equal(forte.total, normal.total + 1);
  assert.equal(forte.error, 1);
  assert.ok(s.forcedFocuses.science.includes("Engineering"));
});
test("mission expiry, source removal and invalid source history remove both actual choices and forte bonuses while preserving genuine permanent choices", () => {
  const f = temp("one", choices),
    patch = {
      focuses: { cultures: [], drive: [], profession: [], science: ["Genetics"], fortes: [] },
      skillFortes: [{ skill: "science", focus: "Genetics", forte: "Sequencing" }]
    },
    live = compute([f], patch);
  assert.ok(live.focusTotals.science.includes("Engineering"));
  for (const expired of [
    compute([f], { ...patch, usagePeriods: { mission: "b" } }),
    compute([], patch),
    compute([{ ...f, system: { ...f.system, temporaryGrant: { ...f.system.temporaryGrant, epoch: "wrong" } } }], patch)
  ]) {
    assert.deepEqual(expired.focusTotals.science, ["Genetics"]);
    assert.equal(expired.skillForteTotals.length, 1);
    assert.equal(expired.temporaryFocusGrants.length, 0);
  }
  const invalid = compute([temp("bad", [pick("Engineering"), pick("Bad focus")])]);
  assert.ok(!invalid.focusTotals.science.includes("Engineering"));
  assert.ok(invalid.warnings.some(w => w.includes("Temporary Depth of Study")));
  assert.equal(invalid.temporaryFocusGrants[0].used, 0);
});
test("source picks cannot silently duplicate another grant, permanent focus or forte, and can name an earlier owned focus without requiring another focus purchase", () => {
  const s = compute([temp("first", choices), temp("second", choices)]);
  assert.equal(s.temporaryFocusGrants[1].used, 0);
  assert.equal(s.focusTotals.science.filter(f => f === "Engineering").length, 1);
  assert.equal(s.skillForteTotals.length, 1);
  const base = compute([], {
      focuses: { science: ["Engineering"] },
      skillFortes: [{ skill: "science", focus: "Engineering", forte: "Bridges" }]
    }),
    f = temp();
  base.featStatus[f.id] = { ok: true };
  assert.throws(() => temporaryFocusPlan(base, f, choices, cfg), /already/);
  assert.throws(
    () => temporaryFocusPlan(base, f, [pick("Engineering", "forte", "Bridges"), pick("Genetics")], cfg),
    /already/
  );
  assert.equal(temporaryFocusPlan(base, f, [pick("Engineering", "forte", "Tunnels"), pick("Genetics")], cfg).length, 2);
});
let failPost = false,
  postingHook = null,
  posts = [];
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.qa";
    this.type = "agent";
    this.isOwner = true;
    this.items = [structuredClone(cls), temp()];
    this.items.get = id => this.items.find(i => i.id === id);
    this.system = source();
    for (const f of this.items)
      f.update = async patch => {
        if (patch["system.focusChoices"]) f.system.focusChoices = structuredClone(patch["system.focusChoices"]);
        this.derive();
        return f;
      };
    this.derive();
  }
  derive() {
    computeAgent(this.system, this.items, cfg);
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s), deepClone: structuredClone },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.game = { user: { isGM: true }, settings: { get: () => ({ mission: "a" }) }, combat: null };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  async create(data) {
    if (failPost) throw Error("post failed");
    postingHook?.();
    posts.push(data);
    return data;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actor choice workflow spends no dice, survives derivation, excludes temporary choices from permanent/class prerequisites and supports cancellation/replacement", async () => {
  posts = [];
  const a = new SpycraftActor();
  assert.equal(await a.chooseTemporaryFocuses({ featId: "temp" }), null);
  await a.chooseTemporaryFocuses({ featId: "temp", choices });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses?.knowItAll, undefined);
  const req = { type: "focus", skill: "science", group: "Engineering" };
  assert.equal(a.checkPrerequisites(req, { temporary: true }).ok, true);
  assert.equal(a.checkPrerequisites(req).ok, false);
  assert.equal(a.checkPrerequisites(req, { classEntry: true }).ok, false);
  await a.chooseTemporaryFocuses({ featId: "temp", choices: [pick("Genetics"), pick("Genetics", "forte", "DNA")] });
  assert.ok(!a.system.focusTotals.science.includes("Engineering"));
  assert.ok(a.system.focusTotals.science.includes("Genetics"));
  assert.equal(posts.length, 2);
});
test("invalid choices, missing/expired source and failed posting leave previous source choices intact and no permanent mutations", async () => {
  const a = new SpycraftActor();
  await a.chooseTemporaryFocuses({ featId: "temp", choices });
  await assert.rejects(a.chooseTemporaryFocuses({ featId: "temp", choices: [pick("Genetics"), pick("bad")] }));
  assert.deepEqual(a.items.get("temp").system.focusChoices, choices);
  failPost = true;
  await assert.rejects(
    a.chooseTemporaryFocuses({ featId: "temp", choices: [pick("Genetics"), pick("Genetics", "forte", "DNA")] }),
    /post failed/
  );
  failPost = false;
  assert.deepEqual(a.items.get("temp").system.focusChoices, choices);
  assert.deepEqual(a.system.focuses.science, []);
  a.system.usagePeriods.mission = "b";
  a.derive();
  assert.equal(await a.chooseTemporaryFocuses({ featId: "temp", choices }), null);
  assert.equal(await a.chooseTemporaryFocuses({ featId: "missing", choices }), null);
});

test("fresh state and serialized edits prevent duplicate source benefits, and a mission change during posting rolls back saved choices", async () => {
  const a = new SpycraftActor();
  await Promise.all([
    a.chooseTemporaryFocuses({ featId: "temp", choices }),
    a.chooseTemporaryFocuses({ featId: "temp", choices: [pick("Genetics"), pick("Genetics", "forte", "DNA")] })
  ]);
  assert.deepEqual(a.system.focusTotals.science, ["Genetics"]);
  assert.equal(a.system.skillForteTotals.length, 1);
  postingHook = () => {
    a.system.usagePeriods.mission = "b";
    a.derive();
  };
  await assert.rejects(a.chooseTemporaryFocuses({ featId: "temp", choices }), /source or mission changed/);
  postingHook = null;
  assert.equal(a.system.focusTotals.science.length, 0);
  assert.equal(a.items.get("temp").system.focusChoices[0].focus, "Genetics");
});
