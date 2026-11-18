import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  knowItAllSource,
  knowItAllChoiceOptions,
  knowItAllPlan,
  selfGrantedTemporaryFeat
} from "../module/rules/temporary-feats.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const definitions = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
  classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  scientist = classes.find(c => c.key === "scientist"),
  classItem = {
    id: "scientist",
    name: scientist.name,
    type: "class",
    system: { ...scientist, identifier: "scientist", vitalityDie: scientist.vitality }
  },
  tree = t =>
    t === "Advanced Skill"
      ? "advancedSkill"
      : t === "Basic Skill"
        ? "basicSkill"
        : t === "Basic Combat"
          ? "basicCombat"
          : t,
  all = definitions.map((f, i) => ({
    id: "f" + i,
    _id: "f" + i,
    uuid: "Compendium.spycraft2.feats.f" + i,
    name: f.name,
    type: "feat",
    system: { ...f, tree: tree(f.tree) }
  })),
  feats = all.filter(f => f.system.tree === "advancedSkill"),
  feat = name => all.find(f => f.name === name);
const state = (level = 20) => ({
  actorUuid: "Actor.scientist",
  level,
  classLevels: { scientist: level },
  usagePeriods: { mission: "a" },
  skillTotals: Object.fromEntries(Object.keys(cfg.skills).map(key => [key, { ranks: 0, maxRanks: level + 3 }]))
});
function source(level = 20, mission = "a") {
  return {
    actorUuid: "Actor.scientist",
    usagePeriods: { mission },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: Array.from({ length: level }, () => ({ classId: "scientist", vitality: 6, skills: {} })),
    actionDice: { value: 0 },
    resourceUses: {}
  };
}
function permanent(name, id = name, patch = {}) {
  const f = structuredClone(feat(name));
  return { ...f, id, system: { ...f.system, acquiredAtLevel: 1, ...patch } };
}
function plan(selected, options = {}, system = state(), items = []) {
  return knowItAllPlan(system, items, selected, { cfg, epoch: "a", sourceActorUuid: "Actor.scientist", ...options });
}
test("Know It All has exact Scientist ten/twenty mission limits and plans all sixteen Advanced Skill options with their required fields", () => {
  assert.equal(feats.length, 16);
  for (let n = 0; n <= 21; n++) {
    const s = state(n),
      p = knowItAllSource(s),
      spec = limitedUseAbilities(s, [], cfg).find(s => s.id === "knowItAll"),
      limit = n < 10 || n > 20 ? 0 : n === 20 ? 2 : 1;
    assert.equal(p?.limit ?? 0, limit);
    assert.equal(spec?.limit ?? 0, limit);
    if (spec) {
      assert.equal(spec.period, "mission");
      assert.equal(spec.cost, 0);
      assert.equal(spec.workflow, "selfAdvancedFeats");
    }
  }
  for (const f of feats) {
    const before = structuredClone(f),
      descriptor = knowItAllChoiceOptions(state(), f, cfg),
      other = feat(f.name === "Attention to Detail" ? "Depth of Study" : "Attention to Detail"),
      choices = descriptor.kind === "basicSkill" ? ["Scholar"] : descriptor.kind === "skill" ? ["analysis"] : [],
      training = descriptor.kind === "training" ? [{ analysis: 5 }] : [],
      [g] = plan([f, other], { featChoices: choices, trainingSkills: training });
    assert.equal(g.system.featKind, "temporary", f.name);
    assert.equal(g.system.temporaryGrant.selfGranted, true);
    assert.equal(g.system.temporaryGrant.sourceFeatUuid, f.uuid);
    assert.equal(g.system.acquisitionSource, "");
    assert.deepEqual(f, before);
  }
  assert.equal(Object.keys(knowItAllChoiceOptions(state(), feat("Advanced Skill Mastery"), cfg).options).length, 15);
  assert.equal(
    Object.keys(
      knowItAllChoiceOptions(
        { ...state(), virtualFeats: [{ name: "Field of Expertise" }] },
        feat("Advanced Skill Mastery"),
        cfg
      ).options
    ).length,
    16
  );
});
test("the grant plan validates exact batches, distinct targeted choices, all skill keys and five-point Training allocations while allowing unrestricted self repeats", () => {
  assert.throws(() => plan([feat("Depth of Study")]), /two/);
  assert.throws(() => plan([feat("Guts"), feat("Depth of Study")]), /Advanced Skill/);
  assert.throws(() => plan([feat("Attention to Detail"), feat("Attention to Detail")]), /already/);
  assert.equal(
    plan([feat("Depth of Study"), feat("Depth of Study")], {}, state(), [permanent("Depth of Study")]).length,
    2
  );
  assert.equal(
    plan([feat("Training"), feat("Training")], { trainingSkills: [{ analysis: 5 }, { analysis: 5 }] }).length,
    2
  );
  for (const allocation of [
    { analysis: 4 },
    { analysis: 6 },
    { analysis: 2.5 },
    JSON.parse('{"constructor":5}'),
    null,
    []
  ])
    assert.throws(() => plan([feat("Training"), feat("Depth of Study")], { trainingSkills: [allocation] }), /Training/);
  assert.throws(
    () =>
      plan([feat("Advanced Skill Mastery"), feat("Advanced Skill Mastery")], { featChoices: ["Scholar", "Scholar"] }),
    /already/
  );
  assert.equal(
    plan([feat("Advanced Skill Mastery"), feat("Advanced Skill Mastery")], { featChoices: ["Scholar", "Techie"] })
      .length,
    2
  );
  for (const choice of ["constructor", "unknown", ""])
    assert.throws(() => plan([feat("Unlocked Potential"), feat("Depth of Study")], { featChoices: [choice] }), /valid/);
});
test("p.171 foreign grants give no extra repeatable benefit, while self-granted Depth/Training and distinct mastery choices follow the feat’s repeatability", () => {
  const s = source(),
    depth = permanent("Depth of Study"),
    base = computeAgent(structuredClone(s), [classItem, depth], cfg),
    own = plan([feat("Depth of Study"), feat("Depth of Study")], {}, base, [depth]).map((g, i) => ({
      ...g,
      id: "own" + i
    })),
    active = computeAgent(structuredClone(s), [classItem, depth, ...own], cfg);
  assert.equal(active.focusPicks.generic.available, base.focusPicks.generic.available + 4);
  const foreign = own.map((g, i) => ({
    ...g,
    id: "foreign" + i,
    system: {
      ...g.system,
      temporaryGrant: {
        ...g.system.temporaryGrant,
        selfGranted: false,
        ability: "otherCharacterAbility",
        sourceActorUuid: "Actor.other"
      }
    }
  }));
  const shared = computeAgent(structuredClone(s), [classItem, depth, ...foreign], cfg);
  assert.equal(shared.focusPicks.generic.available, base.focusPicks.generic.available);
  assert.equal(selfGrantedTemporaryFeat(s, foreign[0]), false);
  const backup = {
    ...own[0],
    system: {
      ...own[0].system,
      temporaryGrant: { ...own[0].system.temporaryGrant, sourceActorUuid: "Actor.preImport" }
    }
  };
  assert.equal(selfGrantedTemporaryFeat(s, backup), true);
  const noPermanent = computeAgent(structuredClone(s), [classItem, ...foreign], cfg),
    normal = computeAgent(structuredClone(s), [classItem], cfg);
  assert.equal(noPermanent.focusPicks.generic.available, normal.focusPicks.generic.available + 2);
  const ws = { ...source(), proficiencies: { rifle: { proficient: true }, shotgun: { proficient: true } } },
    wf = permanent("Weapon Focus", "rifle", { choice: "rifle" }),
    borrowed = {
      ...permanent("Weapon Focus", "borrowed", { choice: "shotgun" }),
      system: {
        ...permanent("Weapon Focus", "borrowed", { choice: "shotgun" }).system,
        featKind: "temporary",
        temporaryGrant: {
          period: "mission",
          epoch: "a",
          sourceActorUuid: "Actor.other",
          ability: "anotherCharacterAbility"
        }
      }
    };
  assert.equal(
    computeAgent(structuredClone(ws), [classItem, wf, borrowed], cfg).proficiencyTotals.shotgun.forte,
    false
  );
  borrowed.system.temporaryGrant = {
    ...borrowed.system.temporaryGrant,
    sourceActorUuid: "Actor.scientist",
    ability: "artOfWar",
    selfGranted: true
  };
  assert.equal(computeAgent(structuredClone(ws), [classItem, wf, borrowed], cfg).proficiencyTotals.shotgun.forte, true);
});

let mission = "a",
  level = 20,
  sequence = 0,
  createCount = 0,
  failCreateAt = 0,
  failPost = false,
  failDelete = false,
  creationHook = null,
  posts = [],
  warnings = [];
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.scientist";
    this.type = "agent";
    this.isOwner = true;
    this.items = [
      structuredClone(classItem),
      permanent("Scholar"),
      permanent("Depth of Study", "depth", { acquiredAtLevel: 3 })
    ];
    this.system = source(level);
    this.derive();
  }
  derive() {
    this.system.usagePeriods = { mission };
    computeAgent(this.system, this.items, cfg);
  }
  async update(patch) {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.replace(/^system\./, "").split(".");
      let o = this.system;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      const k = keys.at(-1);
      if (k.startsWith("-=")) delete o[k.slice(2)];
      else o[k] = structuredClone(value);
    }
    this.derive();
  }
  async createEmbeddedDocuments(_type, data) {
    createCount++;
    if (createCount === failCreateAt) throw Error("creation failed");
    const out = data.map(d => ({
      ...structuredClone(d),
      id: "created" + ++sequence,
      uuid: "Actor.scientist.Item.created" + sequence
    }));
    this.items.push(...out);
    this.derive();
    creationHook?.(this);
    return out;
  }
  async deleteEmbeddedDocuments(_type, ids) {
    if (failDelete) throw Error("cleanup failed");
    this.items = this.items.filter(i => !ids.includes(i.id));
    this.derive();
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s), deepClone: structuredClone },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.game = {
  user: { id: "gm", isGM: true },
  packs: new Map([
    [
      "spycraft2.feats",
      {
        async getDocument(id) {
          return all.find(f => f.id === id);
        },
        async getIndex() {
          return all;
        }
      }
    ]
  ]),
  settings: { get: () => ({ mission, session: "s" }) },
  combat: null
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
  async create(data) {
    if (failPost) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function reset(n = 20) {
  mission = "a";
  level = n;
  sequence = 0;
  createCount = 0;
  failCreateAt = 0;
  failPost = false;
  failDelete = false;
  creationHook = null;
  posts = [];
  warnings = [];
  game.combat = null;
  return new SpycraftActor();
}
const options = names => ({ featIds: names.map(n => feat(n).id), freeActionConfirmed: true }),
  depths = () => options(["Depth of Study", "Depth of Study"]),
  training = () => ({ ...options(["Training", "Training"]), trainingSkills: [{ analysis: 5 }, { analysis: 5 }] });
test("Scientist twenty grants four temporary feats in two claims at zero dice, retains deleted-use history and resets benefits/allowance by mission", async () => {
  const a = reset(),
    focus = a.system.focusPicks.generic.available,
    spent = a.system.feats.any.spent;
  assert.equal((await a.useKnowItAll(depths())).length, 2);
  assert.equal(a.system.focusPicks.generic.available, focus + 4);
  assert.equal((await a.useKnowItAll(training())).length, 2);
  assert.equal(a.system.skillTotals.analysis.ranks, 10);
  assert.equal(a.system.resourceUses.knowItAll.used, 2);
  assert.equal(a.system.feats.any.spent, spent);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(await a.useKnowItAll(options(["Attention to Detail", "I Can Swim"])), null);
  await a.deleteEmbeddedDocuments(
    "Item",
    a.items.filter(i => i.system.featKind === "temporary").map(i => i.id)
  );
  assert.equal(a.system.resourceUses.knowItAll.used, 2);
  assert.equal(await a.useKnowItAll(depths()), null);
  mission = "b";
  a.derive();
  assert.equal((await a.useKnowItAll(training())).length, 2);
  assert.equal(a.system.resourceUses.knowItAll.used, 1);
  mission = "c";
  a.derive();
  assert.equal(a.system.skillTotals.analysis.ranks, 0);
  assert.equal(a.system.focusPicks.generic.available, focus);
});
test("temporary Training ranks cannot qualify permanent feats/classes, and a second allocation cannot exceed the current rank limit", async () => {
  let a = reset();
  await a.useKnowItAll(training());
  const requirement = { type: "skill", key: "analysis", min: 6 };
  assert.equal(a.checkPrerequisites(requirement, { temporary: true }).ok, true);
  assert.equal(a.checkPrerequisites(requirement).ok, false);
  assert.equal(a.checkPrerequisites(requirement, { classEntry: true }).ok, false);
  a = reset();
  a.system.progression = a.system.progression.map((p, i) => ({
    ...p,
    skills: { analysis: i === 0 ? 4 : i < 15 ? 1 : 0 }
  }));
  a.derive();
  assert.equal(a.system.skillTotals.analysis.ranks, 18);
  await assert.rejects(a.useKnowItAll(training()), /rank limit/);
  assert.equal(a.system.skillTotals.analysis.ranks, 18);
  assert.equal(a.items.filter(i => i.system.featKind === "temporary").length, 0);
  assert.equal(a.system.resourceUses.knowItAll, undefined);
});
test("ordered mastery/False Start prerequisites and every Basic Skill target work, while reversed/mismatched chains and level-one-only feats remain invalid", async () => {
  for (const name of Object.keys(cfg.tables.basicSkillFeats)) {
    const a = reset();
    a.items = a.items.filter(i => i.name !== "Scholar");
    a.items.push(permanent(name));
    a.derive();
    const g = await a.useKnowItAll({
      ...options(["Advanced Skill Mastery", "False Start"]),
      featChoices: [name, name]
    });
    assert.equal(g.length, 2, name);
    assert.ok(g.every(i => a.system.featStatus[i.id].ok));
  }
  let a = reset();
  const g = await a.useKnowItAll({
    ...options(["Advanced Skill Mastery", "Grand Skill Mastery"]),
    featChoices: ["Scholar", "Scholar"]
  });
  assert.equal(g.length, 2);
  assert.equal(a.system.skillTotals.science.threat, 17);
  a = reset();
  await assert.rejects(
    a.useKnowItAll({
      ...options(["Grand Skill Mastery", "Advanced Skill Mastery"]),
      featChoices: ["Scholar", "Scholar"]
    }),
    /prerequisite/
  );
  a = reset();
  a.items.push(permanent("Techie"));
  a.derive();
  await assert.rejects(
    a.useKnowItAll({ ...options(["False Start", "Mark of a Professional"]), featChoices: ["Scholar", "Techie"] }),
    /same Basic Skill/
  );
  assert.equal(a.items.filter(i => i.system.featKind === "temporary").length, 0);
  for (const name of ["Photographic Memory", "Unlocked Potential"]) {
    a = reset(10);
    await assert.rejects(
      a.useKnowItAll({ ...options([name, "Attention to Detail"]), featChoices: ["analysis", ""] }),
      /prerequisites/
    );
    assert.equal(a.system.resourceUses.knowItAll, undefined);
  }
});
test("cancelled/invalid/out-of-turn choices spend nothing and partial creation or failed posting rolls back the entire claim", async () => {
  let a = reset();
  assert.equal(await a.useKnowItAll(), null);
  assert.equal(await a.useKnowItAll({ ...depths(), freeActionConfirmed: "true" }), null);
  assert.equal(await a.useKnowItAll({ featIds: [], freeActionConfirmed: true }), null);
  await assert.rejects(a.useKnowItAll(options(["Guts", "Depth of Study"])), /Advanced Skill/);
  failCreateAt = 2;
  await assert.rejects(a.useKnowItAll(depths()), /creation failed/);
  assert.equal(a.items.filter(i => i.system.featKind === "temporary").length, 0);
  assert.equal(a.system.resourceUses.knowItAll, undefined);
  failCreateAt = 0;
  failPost = true;
  await assert.rejects(a.useKnowItAll(depths()), /post failed/);
  assert.equal(a.items.filter(i => i.system.featKind === "temporary").length, 0);
  failPost = false;
  game.combat = {
    started: true,
    combatants: [{ actor: { uuid: a.uuid } }],
    combatant: { actor: { uuid: "Actor.other" } }
  };
  await assert.rejects(a.useKnowItAll(depths()), /initiative/);
  assert.equal(a.system.resourceUses.knowItAll, undefined);
  game.combat.combatant.actor.uuid = a.uuid;
  assert.equal((await a.useKnowItAll(depths())).length, 2);
  game.combat = null;
});
test("cleanup failures retain the spent use, source downgrades roll back partial grants, and concurrent final claims cannot duplicate an allowance", async () => {
  let a = reset();
  failPost = true;
  failDelete = true;
  assert.equal((await a.useKnowItAll(depths())).length, 2);
  assert.equal(a.system.resourceUses.knowItAll.used, 1);
  assert.match(warnings.at(-1), /use remains spent/);
  a = reset();
  await a.useKnowItAll(depths());
  creationHook = actor => {
    actor.system.progression = actor.system.progression.slice(0, 19);
    actor.derive();
  };
  await assert.rejects(a.useKnowItAll(training()), /source or mission changed/);
  assert.equal(a.system.resourceUses.knowItAll.used, 1);
  assert.equal(a.items.filter(i => i.system.featKind === "temporary").length, 2);
  a = reset();
  await a.useKnowItAll(depths());
  const results = await Promise.all([
    a.useKnowItAll(training()),
    a.useKnowItAll(options(["Attention to Detail", "I Can Swim"]))
  ]);
  assert.equal(results.filter(Array.isArray).length, 1);
  assert.equal(a.system.resourceUses.knowItAll.used, 2);
  assert.equal(a.items.filter(i => i.system.featKind === "temporary").length, 4);
  assert.equal(posts.length, 2);
  assert.equal(a.system.actionDice.value, 0);
});

test("I Can Swim acquired first permits unspent Training points, while the reverse order must allocate all five", async () => {
  let a = reset();
  const created = await a.useKnowItAll({ ...options(["I Can Swim", "Training"]), trainingSkills: [{}, {}] });
  assert.equal(created.length, 2);
  assert.equal(a.system.activeFeatNames.includes("I Can Swim"), true);
  assert.deepEqual(created[1].system.trainingSkills, {});
  assert.ok(a.system.todo.some(t => t.text.includes("5 skill point(s) to allocate")));
  a = reset();
  await assert.rejects(
    a.useKnowItAll({ ...options(["Training", "I Can Swim"]), trainingSkills: [{}, {}] }),
    /five Training/
  );
  assert.equal(a.system.resourceUses.knowItAll, undefined);
});
