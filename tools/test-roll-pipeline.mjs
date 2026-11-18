import test from "node:test";
import { tauntSkillChecks } from "../module/rules/taunt.mjs";
import { diversionSkillChecks } from "../module/rules/diversion.mjs";
import { grappleSkillChecks } from "../module/rules/grapple-check.mjs";
import assert from "node:assert/strict";
import {
  RollPipeline,
  formulaWithModifiers,
  describeModifiers,
  planTerms,
  skillPlanTerm
} from "../module/rules/roll-pipeline.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { bullRushAttackSkillChecks } from "../module/rules/bull-rush-attack.mjs";
import { bullRushDefenseSkillChecks } from "../module/rules/bull-rush.mjs";
import { conveyanceBullRushSkillChecks } from "../module/rules/conveyance-bull-rush.mjs";
import { feintSkillChecks } from "../module/rules/feint.mjs";
import { restraintSkillChecks } from "../module/rules/restraints.mjs";
import { taskPressureSkillChecks } from "../module/rules/task-pressure.mjs";
import { terrainSkillChecks } from "../module/rules/terrain.mjs";
import { threatenSkillChecks } from "../module/rules/threaten.mjs";
import { tripAttackSkillChecks, tripCounterSkillCheck } from "../module/rules/trip-attack.mjs";
import { tripDefenseSkillChecks } from "../module/rules/trip.mjs";

/* ---------------------------------------------------------------------- */
/*  The registry on its own                                                */
/* ---------------------------------------------------------------------- */

test("registration rejects malformed and duplicate contributors", () => {
  const pipeline = new RollPipeline();
  assert.throws(() => pipeline.register(null), /must be an object/);
  assert.throws(() => pipeline.register({ validate() {} }), /string id/);
  assert.throws(() => pipeline.register({ id: "a" }), /implements no phase/);
  assert.throws(() => pipeline.register({ id: "a", validate: true }), /validate must be a function/);
  assert.throws(() => pipeline.register({ id: "a", kinds: "attack", validate() {} }), /kinds must be an array/);
  assert.throws(() => pipeline.register({ id: "a", order: "first", validate() {} }), /order must be a finite number/);
  pipeline.register({ id: "a", validate() {} });
  assert.throws(() => pipeline.register({ id: "a", validate() {} }), /already registered/);
  assert.equal(pipeline.has("a"), true);
  assert.equal(pipeline.unregister("a"), true);
  assert.equal(pipeline.unregister("a"), false);
  assert.deepEqual(pipeline.ids, []);
});

test("contributors run in order, then registration order, and only for their check kinds", async () => {
  const pipeline = new RollPipeline(),
    seen = [];
  const note = id => () => {
    seen.push(id);
  };
  pipeline.register({ id: "second", validate: note("second") });
  pipeline.register({ id: "attackOnly", kinds: ["attack"], validate: note("attackOnly") });
  pipeline.register({ id: "first", order: -1, validate: note("first") });
  pipeline.register({ id: "third", validate: note("third") });
  assert.deepEqual(pipeline.ids, ["first", "second", "attackOnly", "third"]);
  await pipeline.validate({ checkKind: "save" });
  assert.deepEqual(seen, ["first", "second", "third"]);
  seen.length = 0;
  await pipeline.validate({ checkKind: "attack" });
  assert.deepEqual(seen, ["first", "second", "attackOnly", "third"]);
});

test("validation stops at the first failure and waits only for asynchronous validators", async () => {
  const pipeline = new RollPipeline(),
    seen = [];
  pipeline.register({
    id: "sync1",
    validate: () => {
      seen.push("sync1");
    }
  });
  pipeline.register({
    id: "sync2",
    validate: () => {
      seen.push("sync2");
    }
  });
  pipeline.register({
    id: "async",
    validate: async () => {
      await null;
      seen.push("async");
    }
  });
  pipeline.register({
    id: "fails",
    validate: () => {
      throw new Error("stale source");
    }
  });
  pipeline.register({
    id: "never",
    validate: () => {
      seen.push("never");
    }
  });
  const pending = pipeline.validate({});
  // Both synchronous validators have already run, with nothing able to interleave between them.
  assert.deepEqual(seen, ["sync1", "sync2"]);
  await assert.rejects(pending, /stale source/);
  assert.deepEqual(seen, ["sync1", "sync2", "async"]);
});

test("acquire returns the first pending reservation and re-enters with its lease", async () => {
  const pipeline = new RollPipeline(),
    held = new Set();
  const lease = name => ({
    id: name,
    acquire: ({ options }) =>
      options[name]
        ? null
        : next => {
            held.add(name);
            return next({ [name]: true });
          }
  });
  pipeline.register(lease("a")).register(lease("b"));
  pipeline.register({ id: "bad", kinds: ["damage"], acquire: () => "yes" });
  const roll = async options => {
    const pending = pipeline.acquire({ checkKind: "attack", options });
    return pending ? pending(extra => roll({ ...options, ...extra })) : options;
  };
  assert.deepEqual(await roll({}), { a: true, b: true });
  assert.deepEqual([...held], ["a", "b"]);
  assert.equal(pipeline.acquire({ checkKind: "attack", options: { a: true, b: true } }), null);
  assert.throws(
    () => pipeline.acquire({ checkKind: "damage", options: { a: true, b: true } }),
    /must return a function/
  );
});

test("modifiers are summed, labelled and applied to the dice formula only", () => {
  const pipeline = new RollPipeline();
  pipeline.register({
    id: "high",
    modifiers: () => [
      { label: "High ground", value: 1 },
      { label: "Unused", value: 0 }
    ]
  });
  pipeline.register({ id: "smoke", kinds: ["attack"], modifiers: () => [{ label: "Smoke", value: -3 }] });
  pipeline.register({ id: "quiet", modifiers: () => null });
  assert.deepEqual(pipeline.modifiers({ checkKind: "save" }), {
    total: 1,
    rows: [{ id: "high", label: "High ground", value: 1 }]
  });
  const attack = pipeline.modifiers({ checkKind: "attack" });
  assert.equal(attack.total, -2);
  assert.equal(describeModifiers(attack.rows), "High ground +1; Smoke −3");
  assert.equal(formulaWithModifiers("1d20 + @total", attack.total), "1d20 + @total - 2");
  assert.equal(formulaWithModifiers("1d20 + @total", 4), "1d20 + @total + 4");
  assert.equal(formulaWithModifiers("1d20 + @total", 0), "1d20 + @total");
  assert.throws(() => formulaWithModifiers("1d20", 1.5), /whole number/);
  pipeline.register({ id: "broken", modifiers: () => [{ label: "Half", value: 0.5 }] });
  assert.throws(() => pipeline.modifiers({}), /whole-number value/);
});

test("terms are collected in order, see earlier plans, and fold into rows, notes and the first block reason", () => {
  const pipeline = new RollPipeline();
  pipeline.register({
    id: "late",
    kinds: ["attack"],
    order: 2,
    terms: ctx => ({
      key: "late",
      plan: { sawEarly: ctx.plans.early.bonus },
      at: 50,
      rows: [["Late", 1]],
      notes: ["late note"],
      threat: 1,
      blocked: "late reason"
    })
  });
  pipeline.register({
    id: "early",
    kinds: ["attack"],
    order: 1,
    terms: () => ({
      key: "early",
      plan: { bonus: 2 },
      rowAt: 30,
      rows: [
        ["Early", 2],
        ["Early too", 0]
      ],
      noteAt: 5,
      notes: ["early note"],
      threat: 2,
      error: 1,
      blockAt: 90,
      blocked: { blocked: true, reason: "early reason" }
    })
  });
  pipeline.register({ id: "silent", kinds: ["attack"], terms: () => null });
  pipeline.register({ id: "skillOnly", kinds: ["skill"], terms: () => ({ key: "skill", plan: 1, threat: 9 }) });

  const terms = planTerms("attack", { system: {} }, pipeline);
  assert.deepEqual(
    terms.list.map(term => term.id),
    ["early", "late"]
  );
  assert.deepEqual(terms.plans, { early: { bonus: 2 }, late: { sawEarly: 2 } });
  assert.equal(terms.sum("threat"), 3);
  assert.equal(terms.sum("error"), 1);
  assert.equal(terms.sum("missing"), 0);
  assert.deepEqual(
    terms.merge("rows", [
      [10, ["Own first", 4]],
      [40, ["Own last", 5]]
    ]),
    [
      ["Own first", 4],
      ["Early", 2],
      ["Early too", 0],
      ["Own last", 5],
      ["Late", 1]
    ]
  );
  assert.deepEqual(
    terms.merge("notes", [
      [10, ["own a", "own b"]],
      [20, ""],
      [60, "own tail"]
    ]),
    ["early note", "own a", "own b", "late note", "own tail"]
  );
  assert.deepEqual(terms.merge("blocked", [[70, ""]]), ["late reason", { blocked: true, reason: "early reason" }]);

  assert.throws(() => {
    const twice = new RollPipeline();
    twice.register({ id: "a", terms: () => ({ key: "same" }) }).register({ id: "b", terms: () => ({ key: "same" }) });
    planTerms("attack", {}, twice);
  }, /already planned/);
  assert.throws(() => {
    const bad = new RollPipeline();
    bad.register({ id: "a", terms: () => "nope" });
    planTerms("attack", {}, bad);
  }, /must be an object/);
});

test("a skill rule's usual plan becomes a term with its evidence, bonuses, block reason and one note segment", () => {
  const term = skillPlanTerm(
    "feint",
    { evidence: { id: 1 }, bonuses: [{ value: 2 }], notes: ["a", "b"], blockedReason: "no", sizeBonus: 4 },
    { noteAt: 30, blockAt: 10 }
  );
  assert.deepEqual(term, {
    key: "feint",
    plan: { id: 1 },
    bonuses: [{ value: 2 }],
    segment: "a b ",
    blocked: "no",
    adjustment: 4,
    synergies: [],
    noteAt: 30,
    blockAt: 10
  });
  assert.equal(skillPlanTerm("empty", {}).segment, " ");
  assert.equal(skillPlanTerm("empty", {}).plan, null);
});

test("flags merge, chat controls are collected and named checks are threaded through", () => {
  const pipeline = new RollPipeline();
  pipeline.register({
    id: "one",
    flags: () => ({ shared: 1, one: true }),
    chatControls: () => [{ label: "One", run() {} }]
  });
  pipeline.register({ id: "two", flags: () => ({ shared: 2 }), chatControls: () => null });
  pipeline.register({
    id: "adds",
    kinds: ["skill"],
    skillChecks: (ctx, checks) => [...checks, { id: `${ctx.skillKey}-extra` }]
  });
  assert.deepEqual(pipeline.flags({}), { shared: 2, one: true });
  assert.deepEqual(
    pipeline.chatControls({}).map(c => [c.id, c.label]),
    [["one", "One"]]
  );
  assert.deepEqual(pipeline.skillChecks({ checkKind: "skill", skillKey: "sneak" }, [{ id: "hide" }]), [
    { id: "hide" },
    { id: "sneak-extra" }
  ]);
  assert.deepEqual(pipeline.skillChecks({ checkKind: "attack", skillKey: "sneak" }, [{ id: "hide" }]), [
    { id: "hide" }
  ]);
  pipeline.register({ id: "badFlags", flags: () => [] });
  assert.throws(() => pipeline.flags({}), /flags must return an object/);
  pipeline.register({ id: "badControl", chatControls: () => [{ label: "No handler" }] });
  assert.throws(() => pipeline.chatControls({}), /label and a run function/);
  pipeline.register({ id: "badChecks", kinds: ["skill"], skillChecks: () => null });
  assert.throws(() => pipeline.skillChecks({ checkKind: "skill" }, []), /must return an array/);
});

/* ---------------------------------------------------------------------- */
/*  The system's pipeline, driven through the real Actor document          */
/* ---------------------------------------------------------------------- */

const state = () => ({
  activeFeatNames: [],
  speed: 30,
  conditionContext: {},
  postureMovement: { standardMove: true },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
  skillTotals: Object.fromEntries(
    Object.entries(cfg.skills).map(([key, s]) => [
      key,
      {
        name: s.name,
        ranks: 4,
        cap: 50,
        threat: 20,
        totals: s.abilities.map(ability => ({ ability, total: 10 })),
        bonusEntries: []
      }
    ])
  ),
  focusTotals: {},
  knowledge: 3
});

globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.uuid = "Actor.pipeline";
    this.items = [];
    this.flags = {};
    this.system = state();
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "GC", isGM: true },
  settings: { get: () => false },
  time: { worldTime: 126 },
  combats: [],
  actors: [],
  i18n: { localize: String }
};
globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "id" } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
const rolled = [],
  posts = [];
globalThis.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    rolled.push(this.formula);
    return this;
  }
  async toMessage(data) {
    posts.push(data);
    return data;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const { rollPipeline } = await import("../module/rolls/index.mjs");

// The order contributors run in, phase by phase. Validation order decides which failure a player is shown first.
const EXPECTED_ORDER = [
  "grappleContent:skill",
  "meleeFireContextContent:rangedAttack",
  "detectionObserverContent:skill",
  "diversionContent:skill",
  "feintContent:skill",
  "targetSkillEffectContent:skill",
  "tauntContent:skill",
  "tripAttackContent:skill",
  "tripDefenseContent:skill",
  "frenzySaveContent:save",
  "spiderContent:skill",
  "minglingContent:skill",
  "revolverIntimidateContent:skill",
  "skillTrickContent:skill",
  "stashFeatsContent:skill",
  "conveyanceBullRushContent:skill",
  "bullRushAttackContent:skill",
  "bullRushDefenseContent:skill",
  "tumblePathContent:skill",
  "fallDistanceContent:skill",
  "balanceSurfaceContent:skill",
  "hideCircumstanceContent:skill",
  "damageDialog",
  "rangedAttackDialog",
  "rangedAttackDialogInput",
  "attackDialog",
  "knowledgeDialog",
  "saveDialog",
  "skillDialog",
  "skillDialogInput",
  "reachGeometryDialog",
  "mortarDamageDialog",
  "launcherDamageDialog",
  "cqbDamageDistanceDialog",
  "killerInstinctDialog",
  "cqbDamageDistanceInput",
  "attackActionInput",
  "feintBonusLease",
  "attackDamageLease",
  "reachGeometryInput",
  "allOutAttackInput",
  "sideStanceLease",
  "impaleDefenseContent:damage",
  "styleOverCaliberContent:damage",
  "closedStanceContent:damage",
  "teamFeatContent:damage",
  "snakeStrikeContent:damage",
  "bullseyeInput",
  "sideStanceDamageLease",
  "meleeTrickInput",
  "cqbRangeInput",
  "pummelContent:attack",
  "attackDistanceInput",
  "damageConversionContent:attack",
  "unbeatableStanceContent:attack",
  "allOrNothingContent:attack",
  "kickContent:attack",
  "doubleJabContent:attack",
  "attackDialogInput",
  "boxingMovesContent:attack",
  "brushContent:attack",
  "unarmedTrickContent:attack",
  "duelingReachContent:attack",
  "noQuarterContent:attack",
  "calledShotContent:attack",
  "bounceContent:rangedAttack",
  "recordFields",
  "sneakAttackTarget",
  "meleeArmorPiercing",
  "drivingDamage",
  "takedownSave",
  "sideStanceDamage",
  "tripFinalAttack",
  "strikingAttack",
  "callbackFinalAttack",
  "callbackAttackContext",
  "trickSneakSource",
  "attackDamage",
  "meleeTrick",
  "bullseye",
  "meleeTradeoff",
  "grippingAttack",
  "combatStance",
  "feintTarget",
  "sideStanceAttack",
  "feintAttackBonus",
  "callbackCQBRange",
  "analysisTaskRoll",
  "attributeDamage",
  "targetSkillEffect",
  "detectionObserver",
  "reachWeapon",
  "trainedOnlyWeapon",
  "accurizedWeapon",
  "missTrickSources",
  "cheapShotTarget",
  "cheapShot",
  "fencingDisarm",
  "disarmResponse",
  "quirkyWeapon",
  "superiorAccuracyWeapon",
  "axeDisarm",
  "whirlingAttack",
  "whirlingSneakAttack",
  "meleeSkillFeat",
  "stalkingStance",
  "conveyanceBullRush",
  "bullRushAttack",
  "bullRushDefense",
  "stillStandingSave",
  "tumblePath",
  "feint",
  "tripAttack",
  "tripCounter",
  "tripAttackTarget",
  "tripDefense",
  "tripDefenseTarget",
  "fallDistance",
  "balanceSurface",
  "hideCircumstance",
  "hideMovement",
  "rankSynergyFeat",
  "stoneCold",
  "threaten",
  "taunt",
  "diversion",
  "bugConcealment",
  "documentation",
  "trackingFeat",
  "trackingTask",
  "cheapShotRecovery",
  "callbackCheapShotRecovery",
  "callbackSkillContext",
  "callbackRerollContext",
  "oldSchool",
  "damageSaveRoll",
  "callbackDamageSave",
  "coverSaveSource",
  "terrainSaveSource",
  "callbackSaveContext",
  "terrainChecks",
  "optionalRuleChecks",
  "restraintChecks",
  "taskPressureChecks",
  "threatenChecks",
  "tauntChecks",
  "diversionChecks",
  "grappleChecks",
  "feintChecks",
  "tripDefenseChecks",
  "tripAttackChecks",
  "bullRushDefenseChecks",
  "bullRushAttackChecks",
  "conveyanceBullRushChecks",
  "tripCounterCheck",
  "restraintEscapeControl",
  "meleeTradeoffAttackTerm",
  "gearAcquisitionControl",
  "bullseyeAttackTerm",
  "meleeTrickAttackTerm",
  "cheapShotAttackTerm",
  "feintBonusAttackTerm",
  "sideStanceAttackTerm",
  "cleaveAttackTerm",
  "finesseAttackTerm",
  "cqbRangeAttackTerm",
  "flankingAttackTerm",
  "cunningPlanControl",
  "gameHunterAttackTerm",
  "manualAdjustmentControl",
  "sniperAttackTerm",
  "requiredBonusControl",
  "weaponSpecialistAttackTerm",
  "criticalControl",
  "fireActionAttackTerm",
  "boostControl",
  "damageConversionAttackTerm",
  "generousControl",
  "swordBasicsAttackTerm",
  "rerollControl",
  "kickAttackTerm",
  "confirmControl",
  "boxingAttackTerm",
  "finishControl",
  "boxingMovesAttackTerm",
  "wrestlingAttackTerm",
  "unarmedTrickAttackTerm",
  "duelingReachAttackTerm",
  "noQuarterAttackTerm",
  "explosiveBasicsAttackTerm",
  "tauntAttackTerm",
  "calledShotAttackTerm",
  "bounceAttackTerm",
  "intenseStanceAttackTerm",
  "stalkingStanceSkillTerm",
  "feintSkillTerm",
  "meleeSkillFeatsSkillTerm",
  "minglingSkillTerm",
  "stashFeatsSkillTerm",
  "livingCipherSkillTerm",
  "spiderSkillTerm",
  "containmentSkillTerm",
  "skillTrickSkillTerm",
  "grappleSkillTerm",
  "revolverIntimidateSkillTerm",
  "stoneColdIntimidateTerm",
  "conveyanceBullRushSkillTerm",
  "bullRushAttackSkillTerm",
  "bullRushDefenseSkillTerm",
  "tripAttackSkillTerm",
  "tripDefenseSkillTerm",
  "rankSynergyFeatsSkillTerm",
  "threatenSkillTerm",
  "tauntSkillTerm",
  "diversionSkillTerm",
  "bugConcealmentSkillTerm",
  "documentationSkillTerm",
  "polyglotSkillTerm",
  "gutsSkillTerm",
  "cardSharkSkillTerm",
  "stillStandingSaveTerm",
  "stoneColdSaveTerm",
  "braceSaveTerm",
  "terrainSaveTerm",
  "underwaterSaveTerm",
  "fatigueResistanceSaveTerm",
  "securityDeviceSaveTerm",
  "baffledResistanceSaveTerm",
  "coverSaveTerm",
  "frenzySaveTerm",
  "hazardSaveTerm",
  "unnervingControl",
  "strutControl",
  "hazardsRecord",
  "combatActionsRecord",
  "styleOverCaliberRecord",
  "actionDiceRecord",
  "actionDiePaymentsRecord",
  "ambushRecord",
  "appearanceRecord",
  "breakthroughRecord",
  "cardSharkRecord",
  "classChecksRecord",
  "closedCourseRecord",
  "snakeStrikeRecord",
  "contactFeatsRecord",
  "cqbRecord",
  "defenseRecord",
  "detectionObserverRecord",
  "environmentRecord",
  "finalRoundRecord",
  "finesseRecord",
  "firearmsRecord",
  "forensicGeniusRecord",
  "gearChecksRecord",
  "hardCoreRecord",
  "cooperativeCheck",
  "improvisedWeaponsRecord",
  "knowledgeRecord",
  "medicalRecord",
  "cooperativeContent:skill",
  "polyglotRecord",
  "pursuitFeatsRecord",
  "cooperativeControl",
  "tauntControl",
  "diversionControl",
  "qualityChecksRecord",
  "requestsRecord",
  "hazardSaveControl",
  "restraintsRecord",
  "sensesRecord",
  "fireActionContent:rangedAttack",
  "damageConversionContent:rangedAttack",
  "allOrNothingContent:rangedAttack",
  "allOrNothingContent:skill",
  "allOrNothingContent:knowledge",
  "skillConditionsRecord",
  "skillFeatTermsRecord",
  "fireActionControl",
  "opportunistDamageControl",
  "opportunistRecord",
  "skillGearRecord",
  "duelingControls",
  "skillTagsRecord",
  "blastControl",
  "kickControls",
  "wrestlingControls",
  "autofireMasteryControl",
  "chanceReactionControls",
  "sneakAttackRecord",
  "duelingReachControl",
  "brawlingSupremacyControl",
  "noQuarterControl",
  "trickShotControl",
  "handOfGodControl",
  "calledShotControl",
  "targetSkillEffectsRecord",
  "blastMapControl",
  "woundDropControl",
  "shatterWeaponControl",
  "terrainRecord",
  "trackingRecord",
  "twoWeaponStateRecord",
  "unnervingRecord",
  "weaponWorkRecord",
  "featReminders"
];

test("every contributor is registered once, in the documented order", () => {
  assert.deepEqual(rollPipeline.ids, EXPECTED_ORDER);
  assert.equal(new Set(EXPECTED_ORDER).size, EXPECTED_ORDER.length);
});

test("every module that registers a contributor is loaded by the contributor index", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const root = new URL("../module/", import.meta.url);
  const index = await readFile(new URL("rolls/index.mjs", root), "utf8");
  const loaded = new Set(
    [...index.matchAll(/import "([^"]+)";/g)].map(m => new URL(m[1], new URL("rolls/", root)).href)
  );
  const files = (await readdir(root, { recursive: true })).filter(
    f => f.endsWith(".mjs") && f !== "rules/roll-pipeline.mjs"
  );
  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    if (source.includes("rollPipeline.register("))
      assert.ok(loaded.has(new URL(file, root).href), `${file} is not imported by module/rolls/index.mjs`);
  }
});

test("dialog pieces are placed by position and read contributors adjust what was entered", () => {
  const pipeline = new RollPipeline();
  assert.throws(() => pipeline.register({ id: "x", dialog: () => [] }), /dialogs list/);
  pipeline.register({
    id: "base",
    dialogs: ["demo"],
    dialog: () => [
      { at: 10, html: "<a>" },
      { at: 30, html: "</a>" }
    ]
  });
  pipeline.register({
    id: "extra",
    dialogs: ["demo", "other"],
    dialog: ({ show }) => [
      { at: 20, html: show ? "B" : "" },
      { at: 20, html: null }
    ]
  });
  pipeline.register({ id: "tie", dialogs: ["demo"], dialog: () => [{ at: 20, html: "C" }] });
  assert.equal(pipeline.dialog({ dialog: "demo", show: true }), "<a>BC</a>");
  assert.equal(pipeline.dialog({ dialog: "demo", show: false }), "<a>C</a>");
  assert.equal(pipeline.dialog({ dialog: "other", show: true }), "B");
  assert.equal(pipeline.dialog({ dialog: "none" }), "");
  assert.throws(() => pipeline.dialog({}), /names its dialog/);
  pipeline.register({ id: "bad", dialogs: ["broken"], dialog: () => [{ html: "x" }] });
  assert.throws(() => pipeline.dialog({ dialog: "broken" }), /numeric position/);

  pipeline.register({
    id: "numbers",
    dialogs: ["demo"],
    read: (ctx, input) => (typeof input.feet === "string" ? { feet: Number(input.feet) } : null)
  });
  pipeline.register({ id: "double", dialogs: ["demo"], read: (ctx, input) => ({ doubled: input.feet * 2 }) });
  const entered = { feet: "15", name: "x" };
  assert.deepEqual(pipeline.read({ dialog: "demo" }, entered), { feet: 15, name: "x", doubled: 30 });
  assert.deepEqual(entered, { feet: "15", name: "x" });
  const untouched = { feet: 5 };
  assert.equal(pipeline.read({ dialog: "other" }, untouched), untouched);
});

test("roll options named by `record` are copied onto every posted check, null when absent", async () => {
  const actor = new SpycraftActor();
  posts.length = 0;
  const check = (await actor.rollCheck("1d20", {}, { checkKind: "check", polyglot: { languages: 3 } })).flags.spycraft2;
  assert.deepEqual(check.polyglot, { languages: 3 });
  for (const field of ["takedown", "tripAttack", "feint", "sneakAttack", "rerollOf", "breakthrough"]) {
    assert.equal(check[field], null, field);
  }
  // Computed fields still come from the roll itself and are not overwritten by a same-named option.
  assert.equal(check.checkKind, "check");
  assert.equal(check.actorUuid, "Actor.pipeline");
});

test("named skill checks match the original fixed composition for every skill", () => {
  const actor = new SpycraftActor();
  const legacy = (key, options, optionalRules) => {
    const base = terrainSkillChecks(actor.system, key, cfg.skills[key]?.checks ?? []).filter(
      check => !check.optionalRule || optionalRules.includes(check.optionalRule)
    );
    const checks = conveyanceBullRushSkillChecks(
      key,
      bullRushAttackSkillChecks(
        key,
        bullRushDefenseSkillChecks(
          key,
          tripAttackSkillChecks(
            key,
            tripDefenseSkillChecks(
              key,
              feintSkillChecks(
                key,
                grappleSkillChecks(
                  key,
                  diversionSkillChecks(
                    key,
                    tauntSkillChecks(
                      key,
                      threatenSkillChecks(
                        key,
                        taskPressureSkillChecks(actor.system, key, restraintSkillChecks(actor.system, key, base))
                      )
                    ),
                    actor.system
                  )
                )
              )
            )
          )
        )
      )
    );
    if (key === "acrobatics" && options.tripCounter) checks.push(tripCounterSkillCheck());
    return checks;
  };
  for (const key of Object.keys(cfg.skills)) {
    for (const options of [{}, { tripCounter: { id: "counter" } }]) {
      for (const optionalRules of [[], ["linguistics"]]) {
        const offered = rollPipeline.skillChecks(
          { actor, checkKind: "skill", skillKey: key, options, optionalRules },
          cfg.skills[key].checks ?? []
        );
        assert.deepEqual(offered, legacy(key, options, optionalRules), key);
      }
    }
  }
});

test("a registered contributor validates before and after the dice, adjusts them once and records its facts", async () => {
  const actor = new SpycraftActor(),
    phases = [];
  rollPipeline.register({
    id: "testHighGround",
    kinds: ["attack"],
    validate: ({ phase, options }) => {
      phases.push(phase);
      if (options.staleAfterRoll && phase === "after") throw new Error("High ground changed.");
    },
    modifiers: ({ options }) => (options.highGround ? [{ label: "High ground", value: 1 }] : []),
    flags: ({ options }) => ({ highGround: options.highGround === true })
  });
  try {
    rolled.length = 0;
    posts.length = 0;
    const message = await actor.rollCheck(
      "1d20 + @total",
      { total: 5 },
      { checkKind: "attack", flavor: "Attack", highGround: true }
    );
    const check = message.flags.spycraft2;
    assert.deepEqual(phases, ["before", "after"]);
    assert.deepEqual(rolled, ["1d20 + @total + 1"]);
    assert.equal(check.formula, "1d20 + @total");
    assert.equal(check.highGround, true);
    assert.deepEqual(check.pipelineModifiers, [{ id: "testHighGround", label: "High ground", value: 1 }]);
    assert.match(message.flavor, /High ground \+1\./);

    // Another check kind is untouched and carries no pipeline record.
    rolled.length = 0;
    phases.length = 0;
    const save = (
      await actor.rollCheck(
        "1d20 + @total",
        { total: 5 },
        { checkKind: "save", checkId: "will", flavor: "Will", highGround: true }
      )
    ).flags.spycraft2;
    assert.deepEqual(rolled, ["1d20 + @total"]);
    assert.deepEqual(phases, []);
    assert.equal(Object.hasOwn(save, "pipelineModifiers"), false);
    assert.equal(Object.hasOwn(save, "highGround"), false);

    // A failure after the dice posts nothing.
    posts.length = 0;
    await assert.rejects(
      actor.rollCheck("1d20 + @total", { total: 5 }, { checkKind: "attack", staleAfterRoll: true }),
      /High ground changed/
    );
    assert.equal(posts.length, 0);
  } finally {
    rollPipeline.unregister("testHighGround");
  }
});

test("a reservation contributor makes the roll re-enter with its lease before any dice", async () => {
  const actor = new SpycraftActor(),
    events = [];
  rollPipeline.register({
    id: "testLease",
    order: -10,
    acquire: ({ options }) =>
      options.testLease
        ? null
        : async next => {
            events.push("reserve");
            try {
              return await next({ testLease: "held" });
            } finally {
              events.push("release");
            }
          },
    validate: ({ options, phase }) => {
      events.push(`${phase}:${options.testLease}`);
    }
  });
  try {
    rolled.length = 0;
    await actor.rollCheck("1d20", {}, { checkKind: "check" });
    assert.deepEqual(events, ["reserve", "before:held", "after:held", "release"]);
    assert.equal(rolled.length, 1);
  } finally {
    rollPipeline.unregister("testLease");
  }
});

test("plan-stage contributors change the previewed total once, are recorded, and never count again at the roll", async () => {
  const { planTotal } = await import("../module/rules/roll-pipeline.mjs");
  const pipeline = new RollPipeline();
  pipeline.register({
    id: "plan",
    kinds: ["attack"],
    stage: "plan",
    modifiers: () => [{ label: "High ground", value: 1 }]
  });
  pipeline.register({ id: "roll", kinds: ["attack"], modifiers: () => [{ label: "Smoke", value: -2 }] });
  assert.throws(() => pipeline.register({ id: "bad", stage: "later", modifiers: () => [] }), /stage must be/);
  assert.deepEqual(
    pipeline.modifiers({ checkKind: "attack", stage: "plan" }).rows.map(r => r.id),
    ["plan"]
  );
  assert.deepEqual(
    pipeline.modifiers({ checkKind: "attack" }).rows.map(r => r.id),
    ["roll"]
  );
  const planned = planTotal(
    "attack",
    {},
    [
      ["Base attack bonus", 5],
      ["Range", -2],
      ["Unused", 0]
    ],
    pipeline
  );
  assert.equal(planned.total, 4);
  assert.deepEqual(
    planned.modifiers.map(r => `${r.label} ${r.value}`),
    ["Base attack bonus 5", "Range -2", "High ground 1"]
  );
  assert.deepEqual(planned.planModifiers, [{ id: "plan", label: "High ground", value: 1 }]);
  assert.equal(planTotal("save", {}, [["Save bonus", 3]], pipeline).total, 3);

  // Through the real documents: the weapon's previewed total and the posted roll agree.
  const { weaponAttack } = await import("../module/rules/gear.mjs");
  const system = { ...new SpycraftActor().system, bab: 4, proficiencies: { edged: { proficient: true } } };
  const sword = {
    proficiency: "edged",
    damage: "1d8",
    error: 1,
    threat: 20,
    qualities: "",
    quantity: 1,
    carried: true,
    equipped: true
  };
  const before = weaponAttack(system, sword, cfg);
  rollPipeline.register({
    id: "testPlanAttack",
    kinds: ["attack"],
    stage: "plan",
    modifiers: ({ weapon }) => (weapon.proficiency === "edged" ? [{ label: "Test edge", value: 2 }] : [])
  });
  try {
    const after = weaponAttack(system, sword, cfg);
    assert.equal(after.total, before.total + 2);
    assert.deepEqual(after.planModifiers, [{ id: "testPlanAttack", label: "Test edge", value: 2 }]);
    assert.ok(after.modifiers.some(r => r.label === "Base attack bonus" && r.value === 4));
    rolled.length = 0;
    const actor = new SpycraftActor();
    const message = await actor.rollCheck(
      "1d20 + @total",
      { total: after.total },
      { checkKind: "attack", flavor: "Attack", planModifiers: after.planModifiers }
    );
    assert.deepEqual(rolled, ["1d20 + @total"]);
    assert.deepEqual(message.flags.spycraft2.planModifiers, after.planModifiers);
    assert.match(message.flavor, /Test edge \+2\./);
  } finally {
    rollPipeline.unregister("testPlanAttack");
  }
});
