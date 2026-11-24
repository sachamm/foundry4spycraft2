import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INTEL_FEAT_ABILITIES,
  intelTemporaryFeatSource,
  intelTemporaryFeatPlan,
  temporaryFeatActive,
  sameFeatSelection
} from "../module/rules/temporary-feats.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const definitions = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
  classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const trees = {
  "Basic Combat": "basicCombat",
  Chase: "chase",
  Covert: "covert",
  Style: "style",
  Tradecraft: "tradecraft"
};
const feats = definitions
  .filter(f => trees[f.tree])
  .map((f, i) => ({
    id: "catalog" + i,
    _id: "catalog" + i,
    uuid: "Compendium.spycraft2.feats.catalog" + i,
    name: f.name,
    type: "feat",
    system: { ...f, tree: trees[f.tree] }
  }));
const defaultChoice = name =>
  name === "Armor Basics" ? "P" : name === "Armor Mastery" ? "M" : name === "Weapon Focus" ? "rifle" : "";
const feat = name => feats.find(f => f.name === name),
  minimum = id => INTEL_FEAT_ABILITIES[id].minimum;
function source(id, level = minimum(id), epoch = "a") {
  const d = INTEL_FEAT_ABILITIES[id];
  return { level: Math.max(1, level), classLevels: { [d.classId]: level }, usagePeriods: { mission: epoch } };
}
function plan(id, selected, options = {}, s = source(id), items = []) {
  return intelTemporaryFeatPlan(s, items, id, selected, {
    cfg,
    epoch: "a",
    sourceActorUuid: "Actor.fixture",
    intelPhaseConfirmed: true,
    ...options
  });
}
function classItem(key) {
  const d = classes.find(c => c.key === key);
  return { id: key, name: d.name, type: "class", system: { ...d, identifier: key, vitalityDie: d.vitality } };
}
function engineSource(id = "artOfWar", level = 7, epoch = "a") {
  return {
    usagePeriods: { mission: epoch },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
    progression: Array.from({ length: level }, (_, i) => ({
      classId: INTEL_FEAT_ABILITIES[id].classId,
      vitality: 6,
      skills: i < 3 ? { sneak: 2 } : {}
    })),
    proficiencies: { rifle: { proficient: true }, shotgun: { proficient: true } },
    actionDice: { value: 0 },
    resourceUses: {}
  };
}
test("all five Intel grant sources have exact prose milestones, expert/base caps, counts and one-use mission limits", () => {
  assert.deepEqual(Object.keys(INTEL_FEAT_ABILITIES), ["smoothOperator", "blackHat", "swat", "outrider", "artOfWar"]);
  for (const [id, d] of Object.entries(INTEL_FEAT_ABILITIES))
    for (let level = 0; level <= 21; level++) {
      const s = source(id, level),
        p = intelTemporaryFeatSource(s, id),
        earned = level >= d.minimum && level <= d.maximum;
      assert.equal(!!p, earned, `${id}/${level}`);
      const spec = limitedUseAbilities(s, [], cfg).find(s => s.id === id);
      assert.equal(!!spec, earned);
      if (earned) {
        assert.equal(p.count, d.doubleAt && level >= d.doubleAt ? 2 : 1);
        assert.equal(spec.limit, 1);
        assert.equal(spec.period, "mission");
        assert.equal(spec.cost, 0);
        assert.equal(spec.workflow, "intelTemporaryFeat");
      }
    }
  for (const id of ["__proto__", "constructor", "unknown"])
    assert.equal(intelTemporaryFeatSource(source("artOfWar"), id), null);
});
test("every one of the 146 catalog options in all five allowed trees plans a source-scoped temporary mission grant without changing its definition", () => {
  assert.equal(feats.length, 146);
  assert.deepEqual(
    Object.fromEntries(Object.values(trees).map(tree => [tree, feats.filter(f => f.system.tree === tree).length])),
    { basicCombat: 43, chase: 24, covert: 26, style: 37, tradecraft: 16 }
  );
  for (const f of feats) {
    const id = Object.keys(INTEL_FEAT_ABILITIES).find(id => INTEL_FEAT_ABILITIES[id].tree === f.system.tree),
      before = structuredClone(f),
      [g] = plan(id, [f], { featChoices: [defaultChoice(f.name)] });
    assert.equal(g.system.featKind, "temporary", f.name);
    assert.equal(g.system.granted, true);
    assert.equal(g.system.grantSource, INTEL_FEAT_ABILITIES[id].name);
    assert.equal(g.system.temporaryGrant.ability, id);
    assert.equal(g.system.temporaryGrant.sourceFeatUuid, f.uuid);
    assert.equal(g.system.temporaryGrant.epoch, "a");
    assert.equal(g.system.acquisitionSource, "");
    assert.equal(g.system.acquisitionCheck, null);
    assert.equal(temporaryFeatActive({ usagePeriods: { mission: "a" } }, g), true);
    assert.equal(temporaryFeatActive({ usagePeriods: { mission: "b" } }, g), false);
    assert.deepEqual(f, before);
  }
});
test("Intel grants enforce exact batch counts, phase, tree, current source and distinct repeatable selections", () => {
  const two = source("artOfWar", 7);
  for (const selected of [
    [],
    [feat("Guts")],
    [feat("Guts"), feat("Guts")],
    [feat("Guts"), feat("Great Fortitude"), feat("Iron Will")]
  ])
    assert.throws(() => plan("artOfWar", selected, {}, two));
  for (const intelPhaseConfirmed of [false, "true", 1])
    assert.throws(() => plan("artOfWar", [feat("Guts")], { intelPhaseConfirmed }), /Intel/);
  for (const f of feats.filter(f => f.system.tree !== "basicCombat"))
    assert.throws(() => plan("artOfWar", [f]), /basicCombat/);
  assert.throws(() => plan("artOfWar", [feat("Guts")], {}, source("artOfWar", 2)), /earned/);
  assert.throws(() => plan("artOfWar", [feat("Weapon Focus")]), /proficiency/);
  assert.throws(() => plan("artOfWar", [feat("Weapon Focus")], { featChoices: ["unarmed"] }), /proficiency/);
  assert.throws(
    () => plan("artOfWar", [feat("Weapon Focus"), feat("Weapon Focus")], { featChoices: ["rifle", "rifle"] }, two),
    /already/
  );
  assert.equal(
    plan("artOfWar", [feat("Weapon Focus"), feat("Weapon Focus")], { featChoices: ["rifle", "shotgun"] }, two).length,
    2
  );
  const permanent = { ...feat("Weapon Focus"), system: { ...feat("Weapon Focus").system, choice: "rifle" } };
  assert.equal(
    plan("artOfWar", [feat("Weapon Focus")], { featChoices: ["shotgun"] }, source("artOfWar"), [permanent]).length,
    1
  );
  assert.throws(
    () => plan("artOfWar", [feat("Weapon Focus")], { featChoices: ["rifle"] }, source("artOfWar"), [permanent]),
    /already/
  );
});
test("temporary grants contribute actual effects without permanent slots, expire at mission change and preserve different permanent Weapon Focus selections", () => {
  const c = classItem("tactician"),
    s = engineSource(),
    normal = computeAgent(structuredClone(s), [c], cfg),
    grants = plan("artOfWar", [feat("Great Fortitude"), feat("Iron Will")], {}, normal).map((g, i) => ({
      ...g,
      id: "grant" + i
    })),
    active = computeAgent(structuredClone(s), [c, ...grants], cfg),
    expired = computeAgent({ ...structuredClone(s), usagePeriods: { mission: "b" } }, [c, ...grants], cfg);
  assert.equal(active.saves.fort.total, normal.saves.fort.total + 3);
  assert.equal(active.saves.will.total, normal.saves.will.total + 3);
  assert.equal(active.feats.any.spent, normal.feats.any.spent);
  assert.equal(expired.saves.fort.total, normal.saves.fort.total);
  assert.equal(expired.featStatus.grant0.ok, false);
  const permanent = {
      ...structuredClone(feat("Weapon Focus")),
      id: "permanent",
      system: { ...structuredClone(feat("Weapon Focus").system), choice: "rifle", acquiredAtLevel: 1 }
    },
    [temporary] = plan("artOfWar", [feat("Weapon Focus")], { featChoices: ["shotgun"] }, source("artOfWar"), [
      permanent
    ]);
  temporary.id = "temporary";
  const w = computeAgent(structuredClone(s), [c, permanent, temporary], cfg);
  assert.equal(w.proficiencyTotals.rifle.forte, true);
  assert.equal(w.proficiencyTotals.shotgun.forte, true);
  assert.equal(w.featStatus.temporary.ok, true);
  assert.equal(sameFeatSelection(permanent, temporary, cfg), false);
});

let mission = "a",
  ability = "artOfWar",
  classLevel = 7,
  posts = [],
  warnings = [],
  createCount = 0,
  failCreationAt = 0,
  failDelete = false,
  failPost = false,
  creationHook = null;
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.intel";
    this.type = "agent";
    this.isOwner = true;
    this.items = [classItem(INTEL_FEAT_ABILITIES[ability].classId)];
    this.system = engineSource(ability, classLevel);
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
    if (createCount === failCreationAt) throw Error("creation failed");
    const out = data.map((d, i) => ({
      ...structuredClone(d),
      id: "created" + createCount + "_" + i,
      uuid: "Actor.intel.Item.created" + createCount + "_" + i
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
globalThis.game = {
  user: { id: "gm", isGM: true },
  packs: new Map([
    [
      "spycraft2.feats",
      {
        async getDocument(id) {
          return feats.find(f => f.id === id);
        },
        async getIndex() {
          return feats;
        }
      }
    ]
  ]),
  settings: { get: () => ({ mission, session: "s" }) }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s), deepClone: structuredClone },
  applications: { api: { DialogV2: { input: async () => null } } }
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
function reset(id = "artOfWar", level = 7) {
  mission = "a";
  ability = id;
  classLevel = level;
  posts = [];
  warnings = [];
  createCount = 0;
  failCreationAt = 0;
  failDelete = false;
  failPost = false;
  creationHook = null;
  return new SpycraftActor();
}
const options = names => ({
  featIds: names.map(n => feat(n).id),
  featChoices: names.map(defaultChoice),
  intelPhaseConfirmed: true
});
test("all five actual grant paths spend one mission use at zero dice; higher Art of War/SWAT grant two feats in one claim", async () => {
  for (const [id, d] of Object.entries(INTEL_FEAT_ABILITIES)) {
    const a = reset(id, d.doubleAt ?? d.minimum),
      count = intelTemporaryFeatSource(a.system, id).count,
      names = feats
        .filter(
          f =>
            f.system.tree === d.tree &&
            f.name !== "Weapon Focus" &&
            a.checkPrerequisites(f.system.prerequisites, { temporary: true }).ok
        )
        .slice(0, count)
        .map(f => f.name),
      created = await a.useIntelTemporaryFeats(id, options(names));
    assert.equal(created.length, count, id);
    assert.equal(a.system.resourceUses[id].used, 1);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].flags.spycraft2.featUuids.length, count);
    await a.deleteEmbeddedDocuments(
      "Item",
      created.map(i => i.id)
    );
    assert.equal(await a.useIntelTemporaryFeats(id, options(names)), null);
    mission = "b";
    a.derive();
    assert.equal((await a.useIntelTemporaryFeats(id, options(names))).length, count);
    assert.equal(a.system.resourceUses[id].epoch, "b");
  }
});
test("ordered temporary prerequisites work, cannot qualify permanent feats, and wrong order or unowned Weapon Focus proficiency is rejected", async () => {
  let a = reset();
  await assert.rejects(
    a.useIntelTemporaryFeats("artOfWar", options(["Armor Mastery", "Armor Basics"])),
    /prerequisites/
  );
  assert.equal(a.items.filter(i => i.type === "feat").length, 0);
  assert.equal(a.system.resourceUses.artOfWar, undefined);
  const created = await a.useIntelTemporaryFeats("artOfWar", options(["Armor Basics", "Armor Mastery"]));
  assert.equal(created.length, 2);
  assert.equal(a.checkPrerequisites({ type: "feat", name: "Armor Basics" }, { temporary: true }).ok, true);
  assert.equal(a.checkPrerequisites({ type: "feat", name: "Armor Basics" }).ok, false);
  a = reset("artOfWar", 3);
  assert.equal(
    (await a.useIntelTemporaryFeats("artOfWar", { ...options(["Weapon Focus"]), featChoices: ["shotgun"] })).length,
    1
  );
  a = reset("artOfWar", 3);
  await assert.rejects(
    a.useIntelTemporaryFeats("artOfWar", { ...options(["Weapon Focus"]), featChoices: ["guided"] }),
    /proficiency/
  );
  assert.equal(a.system.resourceUses.artOfWar, undefined);
});
test("cancelled/stale/invalid choices spend nothing; partial creation and failed posting roll back all granted items and the mission use", async () => {
  let a = reset();
  assert.equal(await a.useIntelTemporaryFeats("artOfWar"), null);
  assert.equal(
    await a.useIntelTemporaryFeats("artOfWar", {
      ...options(["Guts", "Great Fortitude"]),
      intelPhaseConfirmed: "true"
    }),
    false
  );
  await assert.rejects(
    a.useIntelTemporaryFeats("artOfWar", { featIds: ["missing", "missing"], intelPhaseConfirmed: true }),
    /basicCombat/
  );
  failCreationAt = 2;
  await assert.rejects(a.useIntelTemporaryFeats("artOfWar", options(["Guts", "Great Fortitude"])), /creation failed/);
  assert.equal(a.items.filter(i => i.type === "feat").length, 0);
  assert.equal(a.system.resourceUses.artOfWar, undefined);
  failCreationAt = 0;
  failPost = true;
  await assert.rejects(a.useIntelTemporaryFeats("artOfWar", options(["Guts", "Great Fortitude"])), /post failed/);
  assert.equal(a.items.filter(i => i.type === "feat").length, 0);
  assert.equal(a.system.resourceUses.artOfWar, undefined);
  failPost = false;
  a = reset("artOfWar", 2);
  assert.equal(await a.useIntelTemporaryFeats("artOfWar", options(["Guts"])), false);
});
test("cleanup failure retains its spent use and remaining feats, while concurrent claims cannot duplicate a grant", async () => {
  let a = reset();
  failPost = true;
  failDelete = true;
  const kept = await a.useIntelTemporaryFeats("artOfWar", options(["Guts", "Great Fortitude"]));
  assert.equal(kept.length, 2);
  assert.equal(a.system.resourceUses.artOfWar.used, 1);
  assert.match(warnings.at(-1), /use remains spent/);
  a = reset();
  const result = await Promise.all([
    a.useIntelTemporaryFeats("artOfWar", options(["Guts", "Great Fortitude"])),
    a.useIntelTemporaryFeats("artOfWar", options(["Iron Will", "Lightning Reflexes"]))
  ]);
  assert.equal(result.filter(Array.isArray).length, 1);
  assert.equal(a.items.filter(i => i.type === "feat").length, 2);
  assert.equal(a.system.resourceUses.artOfWar.used, 1);
  assert.equal(posts.length, 1);
  assert.equal(a.system.actionDice.value, 0);
});

test("source downgrade during a multi-feat claim rolls back its partial grant, and all fifteen Weapon Focus proficiency choices are available only when possessed", async () => {
  let a = reset();
  creationHook = actor => {
    actor.system.progression = actor.system.progression.slice(0, 3);
    actor.derive();
  };
  await assert.rejects(
    a.useIntelTemporaryFeats("artOfWar", options(["Guts", "Great Fortitude"])),
    /source or mission changed/
  );
  assert.equal(a.items.filter(i => i.type === "feat").length, 0);
  assert.equal(a.system.resourceUses.artOfWar, undefined);
  assert.equal(a.system.classLevels.tactician, 3);
  for (const key of Object.keys(cfg.proficiencies).filter(k => k !== "unarmed")) {
    a = reset("artOfWar", 3);
    // Level 3 earns one proficiency pick, so the agent holds only the one being focused.
    a.system.proficiencies = { [key]: { proficient: true } };
    a.derive();
    const [created] = await a.useIntelTemporaryFeats("artOfWar", { ...options(["Weapon Focus"]), featChoices: [key] });
    assert.equal(created.system.choice, key);
    assert.equal(a.system.proficiencyTotals[key].forte, true, key);
  }
});
test("temporary armor choices grant actual wearing benefits, expire without rewriting the armor and reject duplicate types before keeping a claim", async () => {
  let a = reset(),
    armor = {
      id: "worn",
      name: "Corrections vest",
      type: "armor",
      system: {
        equipped: true,
        carried: true,
        quantity: 1,
        armorSlot: "body",
        armorType: "P",
        damageReduction: 4,
        damageReductionSubdual: 2,
        defensePenalty: -2,
        armorCheck: -1,
        speedPenalty: 0,
        notice: "12"
      }
    };
  a.items.push(armor);
  a.derive();
  await a.useIntelTemporaryFeats("artOfWar", options(["Armor Basics", "Armor Mastery"]));
  assert.equal(a.system.armor.defensePenalty, 0);
  assert.equal(a.system.armor.defenseBonus, 1);
  assert.equal(a.system.armor.check, 0);
  assert.equal(armor.system.defensePenalty, -2);
  mission = "b";
  a.derive();
  assert.equal(a.system.armor.defensePenalty, -2);
  assert.equal(a.system.armor.defenseBonus, 0);
  assert.equal(a.items.filter(i => i.type === "feat").length, 2);
  a = reset();
  await assert.rejects(
    a.useIntelTemporaryFeats("artOfWar", { ...options(["Armor Basics", "Armor Mastery"]), featChoices: ["P", "P"] }),
    /different/
  );
  assert.equal(a.items.filter(i => i.type === "feat").length, 0);
  assert.equal(a.system.resourceUses.artOfWar, undefined);
});
