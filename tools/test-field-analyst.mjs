// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
const state = (level = 8) => ({
  classLevels: { fieldAnalyst: level },
  actionDice: { value: 0 },
  resourceUses: {},
  skillTotals: Object.fromEntries(
    ["analysis", "investigation", "search", "notice"].map(key => [
      key,
      {
        name: key,
        ranks: 4,
        cap: 30,
        threat: 20,
        totals: [
          { ability: "int", total: 5 },
          { ability: "wis", total: 5 }
        ]
      }
    ])
  )
});
const check = {
  id: "test",
  name: "Test Check",
  attributes: ["wis"],
  error: 1,
  mode: "Active",
  time: "1 Minute (Take 10/Take 20)",
  tags: "",
  page: 71
};
test("All the Right Questions is opt-in at the correct milestones and covers all three skills only", () => {
  for (let level = 0; level <= 10; level++)
    for (const key of ["analysis", "investigation", "search", "notice"])
      for (const [timingReduction, required, multiplier, increase] of [
        ["questionsI", 3, 0.5, 1],
        ["questionsII", 7, 0.25, 2]
      ]) {
        const r = resolveSkillCheck(state(level), key, check, { gearStatus: "available", timingReduction });
        if (level < required || key === "notice") assert.equal(r.blocked, true);
        else {
          assert.equal(r.blocked, false);
          assert.equal(r.timeMultiplier, multiplier);
          assert.equal(r.error, 1 + increase);
          assert.equal(r.minimumTimeSeconds, 6);
          assert.equal(r.timeRounding, "down");
        }
      }
  const auto = resolveSkillCheck(state(), "search", check, { gearStatus: "available" });
  assert.equal(auto.error, 1);
  assert.equal(auto.timeMultiplier, 1);
  assert.equal(auto.timeReduction, "none");
});
test("Questions competes with other time reductions, applies error before reductions and respects taking/Cross-Check restrictions", () => {
  const s = state();
  s.classOptionSelections = [{ classId: "snoop", name: "Intelligence Analysis" }];
  s.skillFeatRules = [{ name: "Mark of a Professional", skill: "investigation" }];
  const research = { ...check, id: "research", tags: "Cross-Check" };
  const r = resolveSkillCheck(s, "investigation", research, {
    gearStatus: "available",
    timingReduction: "questionsII",
    unopposed: true,
    usingComputer: true,
    crossCheckActive: true
  });
  assert.equal(r.timeMultiplier, 0.75);
  assert.equal(r.error, 3);
  assert.equal(r.minimumTimeSeconds, 18);
  assert.doesNotMatch(r.notes, /Mark of a Professional: the single/);
  assert.equal(
    resolveSkillCheck(s, "investigation", research, {
      gearStatus: "available",
      timingReduction: "questionsI",
      method: "take20",
      safeToTake: true
    }).blocked,
    true
  );
  s.skillTotals.investigation.errorReduction = 1;
  s.skillTotals.investigation.errorFloor = 1;
  assert.equal(
    resolveSkillCheck(s, "investigation", research, {
      gearStatus: "available",
      timingReduction: "questionsI",
      method: "take20",
      safeToTake: true
    }).blocked,
    false
  );
});
let dice = [],
  dialogs = [],
  chosen = 1,
  messages = [],
  failPost = false;
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.uuid = "Actor.analyst";
    this.system = state();
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
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s, format: s => s } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = {
  utils: { escapeHTML: s => s },
  applications: {
    api: {
      DialogV2: {
        input: async opts => {
          dialogs.push(opts.window.title);
          return { chosen: String(chosen) };
        }
      }
    }
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (failPost) throw Error("post failed");
    messages.push(data);
    return data;
  }
};
globalThis.Roll = class {
  constructor(formula, data) {
    const natural = formula.includes("1d20") ? dice.shift() : 10;
    this.total = natural + (data.total ?? 0);
    this.dice = formula.includes("1d20") ? [{ total: natural }] : [];
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
function reset() {
  dice = [4, 17];
  dialogs = [];
  chosen = 1;
  messages = [];
  failPost = false;
  game.user.isGM = true;
}
test("Eye for Detail rolls every Search twice at level eight, records the preferred natural die and costs no limited use or dice", async () => {
  reset();
  const a = new SpycraftActor(),
    m = await a.rollCheck(
      "1d20 + @total",
      { total: 5 },
      { checkKind: "skill", skillKey: "search", threat: 20, error: 1, cap: 30 }
    ),
    c = m.flags.spycraft2;
  assert.equal(c.rawTotal, 22);
  assert.equal(c.naturalDie, 17);
  assert.equal(c.choiceSource, "Eye for Detail");
  assert.equal(c.alternatives.length, 2);
  assert.equal(dialogs[0], "Eye for Detail: choose the preferred result");
  assert.match(m.flavor, /Eye for Detail: chose roll 2/);
  assert.equal(a.system.actionDice.value, 0);
  assert.deepEqual(a.system.resourceUses, {});
  reset();
  const b = new SpycraftActor();
  b.system.classLevels.fieldAnalyst = 7;
  const one = await b.rollCheck("1d20 + @total", { total: 5 }, { checkKind: "skill", skillKey: "search" });
  assert.equal(one.flags.spycraft2.alternatives, null);
  assert.equal(dialogs.length, 0);
});
test("Eye for Detail covers every Search roll attribute/focus and chooses again on a new eligible roll; fixed and non-Search checks do not duplicate", async () => {
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    reset();
    const a = new SpycraftActor();
    const m = await a.rollCheck(
      "1d20 + @total",
      { total: 0 },
      { checkKind: "skill", skillKey: "search", ability, focus: "custom" }
    );
    assert.equal(m.flags.spycraft2.alternatives.length, 2);
  }
  for (const patch of [{ skillKey: "analysis" }, { checkKind: "knowledge" }, { checkMethod: "take10" }]) {
    reset();
    const a = new SpycraftActor(),
      m = await a.rollCheck("1d20 + @total", { total: 0 }, { checkKind: "skill", skillKey: "search", ...patch });
    assert.equal(m.flags.spycraft2.alternatives, null);
  }
  reset();
  chosen = 0;
  const a = new SpycraftActor();
  const first = await a.rollCheck("1d20 + @total", { total: 0 }, { checkKind: "skill", skillKey: "search" });
  dice = [6, 12];
  chosen = 1;
  const next = await a.rollCheck(first.flags.spycraft2.formula, first.flags.spycraft2.rollData, {
    ...first.flags.spycraft2
  });
  assert.equal(next.flags.spycraft2.naturalDie, 12);
  assert.equal(next.flags.spycraft2.choiceSource, "Eye for Detail");
});
test("secret Eye for Detail is GC-only, failed posts leave resources alone and Bright Idea cannot waste its use on an already-covered Search", async () => {
  reset();
  const a = new SpycraftActor();
  game.user.isGM = false;
  await assert.rejects(
    a.rollCheck("1d20 + @total", { total: 0 }, { checkKind: "skill", skillKey: "search", rollMode: "blindroll" }),
    /GC resolves/
  );
  assert.equal(dice.length, 2);
  game.user.isGM = true;
  failPost = true;
  await assert.rejects(
    a.rollCheck("1d20 + @total", { total: 0 }, { checkKind: "skill", skillKey: "search" }),
    /post failed/
  );
  assert.deepEqual(a.system.resourceUses, {});
  failPost = false;
  const use = cfg.skills.search.checks[0];
  assert.equal(await a.rollSkill("search", false, { gearStatus: "available", check: use.id, brightIdea: true }), false);
  assert.deepEqual(a.system.resourceUses, {});
});
