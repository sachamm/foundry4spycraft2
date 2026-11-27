import test from "node:test";
import assert from "node:assert/strict";
import { dartingStyleState as state } from "../module/rules/darting-state.mjs";
import { dartingDeclarationPlan as plan, dartingFinalAttackPlan as finalPlan } from "../module/rules/darting.mjs";
import { declareDarting, reviewDarting, takeDartingFinalAttack } from "../module/apps/darting.mjs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { limitedUseAbilities, resourceStatus } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const clock = () => ({ id: "combat", started: true, round: 2, turn: 1, combatantId: "own", ownTurnIndex: 1 }),
  input = (n = 1) => ({ extraAttacks: n, atStartOfInitiative: true, confirmed: true }),
  base = () => ({
    activeFeatNames: ["Darting Weapon", "Flashing Weapon"],
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
    bab: 12,
    conditionContext: {},
    wounds: { value: 4 },
    dartingStyle: null,
    proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }]))
  }),
  record = (n = 1) => ({ ...plan(base(), clock(), input(n)), id: "declaration" }),
  weapon = (id = "blade", proficiency = "edged") => ({
    id,
    type: "weapon",
    name: id,
    system: {
      proficiency,
      sizeHands: "S/1h",
      equipped: true,
      carried: true,
      quantity: 1,
      errorThreat: "1/20",
      damage: "1d6",
      range: 30,
      maxRangeIncrements: 10
    }
  });
test("declaration requires earned one/two-attack choice and start of own Count, without requiring a pair or an already-readied weapon", () => {
  for (const n of [1, 2]) assert.equal(plan(base(), clock(), input(n)).penalty, n * 2);
  for (const patch of [
    { atStartOfInitiative: false },
    { confirmed: false },
    { extraAttacks: 3 },
    { extraAttacks: 1.5 }
  ])
    assert.throws(() => plan(base(), clock(), { ...input(), ...patch }));
  assert.throws(() => plan({ ...base(), activeFeatNames: ["Darting Weapon"] }, clock(), input(2)), /Flashing/);
  assert.throws(() => plan({ ...base(), activeFeatNames: [] }, clock(), input()), /earned/);
  for (const c of [
    { ...clock(), turn: 0 },
    { ...clock(), started: false }
  ])
    assert.throws(() => plan(base(), c, input()), /start/);
  assert.throws(() => plan({ ...base(), dartingStyle: record() }, clock(), input()), /already active/);
});
test("accepted penalty and grant survive feat loss, span the global round boundary and end precisely at next own Count", () => {
  for (const n of [1, 2])
    for (const [round, turn, active] of [
      [2, 1, true],
      [2, 2, true],
      [3, 0, true],
      [3, 1, false],
      [4, 0, false]
    ]) {
      const s = {
          ...base(),
          activeFeatNames: [],
          dartingStyle: record(n),
          dartingCombatContext: { ...clock(), round, turn }
        },
        r = state(s);
      assert.equal(r.active, active);
      assert.equal(r.penalty, active ? 2 * n : 0);
      assert.equal(r.extraAttacks, active ? n : 0);
    }
  assert.equal(state({ ...base(), dartingStyle: { ...record(), penalty: 3 } }).needsReview, true);
});
function calculate(n = 0, conditions = {}) {
  const cls = {
    id: "test",
    type: "class",
    name: "Test",
    system: {
      identifier: "test",
      skillPoints: 4,
      vitalityDie: 6,
      classSkills: [],
      table: [{ level: 1, bab: 1, defense: 3, fort: 0, ref: 0, will: 0 }]
    }
  };
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {},
      conditionContext: conditions,
      dartingStyle: n ? record(n) : null,
      dartingCombatContext: clock()
    },
    [cls],
    cfg
  );
}
test("all attacks and every named skill/Knowledge get exactly the timed penalty after transformations, with no save/damage/Defense/Initiative penalty", () => {
  for (const n of [1, 2])
    for (const c of [{}, { baffled: true }, { incompetent: true }]) {
      const a = calculate(n, c),
        b = calculate(0, c);
      for (const [key, s] of Object.entries(cfg.skills))
        for (const check of s.checks ?? [])
          assert.equal(
            resolveSkillCheck(a, key, check, {}).total,
            resolveSkillCheck(b, key, check, {}).total - 2 * n,
            key + "/" + check.id
          );
      assert.equal(
        resolveKnowledgeCheck(a, { skill: "search" }).total,
        resolveKnowledgeCheck(b, { skill: "search" }).total - 2 * n
      );
      for (const key of Object.keys(cfg.proficiencies)) {
        const w = weapon("w", key).system;
        assert.equal(weaponAttack(a, w, cfg).total, weaponAttack(b, w, cfg).total - 2 * n, key);
        assert.equal(weaponDamage(a, w).bonus, weaponDamage(b, w).bonus, key);
      }
      for (const key of ["fort", "ref", "will"]) assert.equal(a.saves[key].total, b.saves[key].total);
      assert.equal(a.defense.total, b.defense.total);
      assert.equal(a.initiative.total, b.initiative.total);
    }
});
test("final attack permits any currently usable melee/unarmed/hurled weapon, including a newly readied one, without least-used restriction", () => {
  const s = { ...base(), activeFeatNames: [], dartingStyle: record(2) };
  for (const key of Object.keys(cfg.proficiencies)) {
    const w = weapon("new", key),
      call = () => finalPlan(s, clock(), [w], { weaponId: "new", confirmed: true });
    if (["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "hurled", "exoticHurled"].includes(key))
      assert.equal(call().weaponId, "new");
    else assert.throws(call, /melee or hurled/);
  }
  assert.throws(
    () => finalPlan(s, { ...clock(), turn: 0 }, [weapon()], { weaponId: "blade", confirmed: true }),
    /Count/
  );
  assert.throws(() =>
    finalPlan({ ...s, conditionContext: { pinned: true } }, clock(), [weapon()], { weaponId: "blade", confirmed: true })
  );
  assert.ok(
    finalPlan({ ...s, conditionContext: { held: true } }, clock(), [weapon()], { weaponId: "blade", confirmed: true })
  );
});
let serial = 0,
  response = null;
foundry.utils.escapeHTML = String;
foundry.utils.randomID = () => `dart${++serial}`;
foundry.applications.api.DialogV2.input = async () => (typeof response === "function" ? response() : response);
game.messages = [];
game.user = { id: "gc", isGM: true };
function actor(n = 0) {
  serial = 0;
  response = null;
  game.messages = [];
  game.user.isGM = true;
  const a = {
    uuid: "Actor.darting",
    type: "agent",
    isOwner: true,
    flags: {},
    items: [weapon(), weapon("throw", "hurled")],
    system: {
      ...base(),
      dartingStyle: n ? record(n) : null,
      dartingCombatContext: clock(),
      actionDice: { value: 0 },
      resourceUses: n ? { dartingFinalAttack: { epoch: "declaration", used: 0 } } : {}
    },
    participatingCombat: { ...clock(), turns: [] },
    async update(patch) {
      if (this.fail === "before") {
        this.fail = null;
        throw Error("before write");
      }
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let object = this;
        for (const key of keys.slice(0, -1)) object = object[key] ??= {};
        object[keys.at(-1)] = structuredClone(value);
      }
      this.system.limitedUses = limitedUseAbilities(this.system, [], cfg);
      if (this.fail === "after") {
        this.fail = null;
        throw Error("committed write");
      }
      return this;
    }
  };
  a.participatingCombat.turns = [
    { id: "other", actor: { uuid: "Actor.other" } },
    { id: "own", actor: a }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.weaponAttack = (w, o) => weaponAttack(a.system, w.system, cfg, "agent", o);
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.actionDiceFundingSystem = a.system;
  Object.defineProperty(a, "usagePeriods", { get: () => ({ "darting declaration": a.system.dartingStyle?.id }) });
  a.rollAttack = async (_w, o) => {
    await o.validateFinalAttack();
    assert.equal(o.freeFinalAttack, true);
    assert.equal(o.attackAction, "standard");
    await a.hook?.();
    await o.validateFinalAttack();
    if (a.cancel) return null;
    if (a.postError === "before") throw Error("unposted");
    const m = { id: `post${++serial}`, flags: { spycraft2: { actorUuid: a.uuid, finalAttack: o.finalAttack } } };
    game.messages.push(m);
    if (a.postError === "after") throw Error("posted");
    return m;
  };
  return a;
}
const finalInput = { weaponId: "blade", confirmed: true };
test("real declaration serializes duplicate clicks, seeds the receipt epoch, retains committed writes and rejects stale dialog/source or malformed history", async () => {
  let a = actor();
  const r = await Promise.allSettled([declareDarting(a, input(2)), declareDarting(a, input(2))]);
  assert.equal(r.filter(r => r.status === "fulfilled").length, 1);
  assert.deepEqual(a.system.resourceUses.dartingFinalAttack, { epoch: a.system.dartingStyle.id, used: 0 });
  a = actor();
  a.fail = "after";
  assert.ok(await declareDarting(a, input()));
  for (const invalid of [null, [], 4]) {
    a = actor();
    a.flags.spycraft2 = { dartingDeclarations: invalid };
    await assert.rejects(declareDarting(a, input()), /history/);
  }
  a = actor();
  response = () => {
    a.isOwner = false;
    return input();
  };
  await assert.rejects(declareDarting(a), /Ownership/);
});
test("real resource transaction allows exactly the recorded one/two final attacks across concurrent requests, even after source loss and under Shaken IV", async () => {
  for (const n of [1, 2]) {
    const a = actor(n);
    a.system.activeFeatNames = [];
    a.system.conditionContext = { shakenGrade: 4 };
    const result = await Promise.allSettled(Array.from({ length: 4 }, () => takeDartingFinalAttack(a, finalInput)));
    assert.equal(game.messages.length, n);
    assert.equal(a.system.resourceUses.dartingFinalAttack.used, n);
    assert.equal(result.filter(r => r.status === "fulfilled" && r.value?.id).length, n);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(new Set(game.messages.map(m => m.flags.spycraft2.finalAttack.sequence)).size, n);
  }
});
test("cancelled/unposted final attacks refund their use; posted responses retain the original receipt, while stale weapon/Count/source rejects before posting", async () => {
  for (const kind of ["cancel", "before", "after"]) {
    const a = actor();
    await declareDarting(a, input());
    a.cancel = kind === "cancel";
    a.postError = kind;
    const run = () => takeDartingFinalAttack(a, finalInput);
    if (kind === "after") {
      assert.ok(await run());
      assert.equal(a.system.resourceUses.dartingFinalAttack.used, 1);
    } else {
      await assert.rejects(run());
      assert.equal(a.system.resourceUses.dartingFinalAttack.used, 0);
    }
  }
  for (const change of [
    a => (a.items[0].system.equipped = false),
    a => (a.participatingCombat.turn = 0),
    a => (a.isOwner = false)
  ]) {
    const a = actor(1);
    a.hook = () => change(a);
    await assert.rejects(takeDartingFinalAttack(a, finalInput));
    assert.equal(game.messages.length, 0);
    assert.equal(a.system.resourceUses.dartingFinalAttack.used, 0);
  }
});
test("hurled attacks require actual distance before reservation; invalid nested declarations or missing receipts cannot invent available attacks", async () => {
  const a = actor(2);
  await assert.rejects(takeDartingFinalAttack(a, { ...finalInput, weaponId: "throw" }), /distance/);
  assert.equal(a.system.resourceUses.dartingFinalAttack.used, 0);
  await assert.rejects(takeDartingFinalAttack(a, { ...finalInput, disarm: { active: true } }), /Standard Attack/);
  const spec = a.system.limitedUses.find(s => s.id === "dartingFinalAttack");
  for (const uses of [
    {},
    { dartingFinalAttack: { epoch: "old", used: 0 } },
    { dartingFinalAttack: { epoch: "declaration", used: "0" } }
  ])
    assert.equal(resourceStatus(spec, uses, a.usagePeriods).counterReview, true);
  assert.ok(await takeDartingFinalAttack(a, { ...finalInput, weaponId: "throw", distanceFeet: 30 }));
});
test("owning GC review resolves remaining tradeoff without reopening the used round, including unknown history; new rounds retain legitimate choices", async () => {
  let a = actor();
  await declareDarting(a, input());
  await reviewDarting(a, { confirmed: true, resolution: "Remaining attacks and penalty resolved at table" });
  assert.equal(a.system.dartingStyle, null);
  await assert.rejects(declareDarting(a, input()), /already been recorded/);
  a.participatingCombat.round = 3;
  a.system.dartingCombatContext.round = 3;
  assert.ok(await declareDarting(a, input()));
  a = actor(2);
  a.flags.spycraft2 = { dartingDeclarations: null };
  await reviewDarting(a, { confirmed: true, resolution: "Review unknown history and resolve remaining tradeoff" });
  await assert.rejects(declareDarting(a, input()), /already been recorded/);
});
test("malformed saved tradeoffs hold actual attack/skill/Knowledge checks before RNG without preventing independent damage", async () => {
  const a = makeFatigueActor();
  a.raw.dartingStyle = { ...record(), penalty: 3 };
  a.raw.dartingCombatContext = clock();
  a.derive();
  assert.equal(a.system.dartingStyleState.needsReview, true);
  await assert.rejects(a.rollCheck("1d20", {}, { checkKind: "attack" }), /review/);
  assert.equal(resolveKnowledgeCheck(a.system, { skill: "search" }).blocked, true);
  assert.equal(resolveSkillCheck(a.system, "athletics", cfg.skills.athletics.checks[0], {}).blocked, true);
  assert.equal(weaponAttack(a.system, weapon().system, cfg).blocked, true);
  assert.ok(weaponDamage(a.system, weapon().system).formula);
});

test("Darting penalties stack with independent tradeoffs; Both Guns Blazing waives only its own two-weapon penalty", () => {
  const s = calculate(2),
    b = calculate();
  s.classLevels.triggerman = s.activeClassLevels.triggerman = 10;
  s.twoWeaponCombatContext = clock();
  s.twoWeaponStyle = {
    id: "two",
    combatId: "combat",
    combatantId: "own",
    startRound: 2,
    dueRound: 3,
    weaponIds: ["first", "second"],
    weaponProficiencies: ["handgun", "handgun"],
    penalty: 2,
    extraAttacks: 1,
    atStartOfInitiative: true,
    armedConfirmed: true
  };
  s.expertiseCombatContext = clock();
  s.combatExpertise = { combatId: "combat", combatantId: "own", startRound: 2, dueRound: 3, penalty: 2 };
  s.superiorCoverCombatContext = clock();
  s.superiorCover = {
    version: 1,
    id: "cover",
    combatId: "combat",
    combatantId: "own",
    startRound: 2,
    dueRound: 3,
    personalCover: 1,
    sceneryCover: 0,
    reflexBonus: 1,
    coverLost: false
  };
  assert.equal(
    weaponAttack(s, weapon("gun", "handgun").system, cfg).total,
    weaponAttack(b, weapon("gun", "handgun").system, cfg).total - 8
  );
  assert.equal(
    resolveKnowledgeCheck(s, { skill: "search" }).total,
    resolveKnowledgeCheck(b, { skill: "search" }).total - 8
  );
  assert.equal(weaponAttack(s, weapon().system, cfg).total, weaponAttack(b, weapon().system, cfg).total - 10);
});
