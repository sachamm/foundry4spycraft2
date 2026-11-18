import test from "node:test";
import assert from "node:assert/strict";
import {
  twoWeaponDeclarationPlan as plan,
  twoWeaponFinalAttackPlan as finalPlan
} from "../module/rules/two-weapon.mjs";
import { twoWeaponStyleState as state } from "../module/rules/two-weapon-state.mjs";
import { declareTwoWeapon, reviewTwoWeapon, takeTwoWeaponFinalAttack } from "../module/apps/two-weapon.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
const clock = () => ({ id: "combat", started: true, round: 2, turn: 1, combatantId: "own", ownTurnIndex: 1 });
const basics = "Two-Weapon Basics",
  mastery = "Two-Weapon Mastery";
const weapon = (id, proficiency = "handgun", patch = {}) => ({
  id,
  name: id,
  type: "weapon",
  system: {
    proficiency,
    sizeHands: "T/1h",
    equipped: true,
    carried: true,
    quantity: 1,
    damage: "1d6",
    range: proficiency === "handgun" ? 50 : 0,
    errorThreat: "1/20",
    fireMode: "single",
    fireModes: ["single"],
    recoil: 1,
    ...patch
  }
});
const pair = () => [weapon("one"), weapon("two", "edged")];
const base = () => ({
  activeFeatNames: [basics, mastery],
  classLevels: {},
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  conditionContext: {},
  size: "Medium",
  wounds: { value: 4 }
});
const input = () => ({ weaponIds: ["one", "two"], extraAttacks: 1, atStartOfInitiative: true, armedConfirmed: true });
const record = (extraAttacks = 1, proficiencies = ["handgun", "edged"]) => ({
  id: "declaration",
  combatId: "combat",
  combatantId: "own",
  startRound: 2,
  dueRound: 3,
  weaponIds: ["one", "two"],
  weaponProficiencies: proficiencies,
  penalty: extraAttacks * 2,
  extraAttacks,
  atStartOfInitiative: true,
  armedConfirmed: true
});
test("Basics/Mastery grant the exact one/two-attack tradeoffs at the start of own Count and reject unavailable abilities or forfeited actions", () => {
  for (const n of [1, 2]) {
    const p = plan(base(), clock(), pair(), { ...input(), extraAttacks: n });
    assert.equal(p.penalty, n * 2);
    assert.equal(p.extraAttacks, n);
    assert.equal(p.dueRound, 3);
  }
  for (const change of [{ started: false }, { turn: 0 }, { ownTurnIndex: -1 }])
    assert.throws(() => plan(base(), { ...clock(), ...change }, pair(), input()));
  for (const patch of [
    { extraAttacks: 0 },
    { extraAttacks: 3 },
    { extraAttacks: "2" },
    { atStartOfInitiative: false },
    { armedConfirmed: false }
  ])
    assert.throws(() => plan(base(), clock(), pair(), { ...input(), ...patch }));
  assert.throws(() => plan({ ...base(), activeFeatNames: [] }, clock(), pair(), input()), /earned/);
  assert.throws(
    () => plan({ ...base(), activeFeatNames: [basics] }, clock(), pair(), { ...input(), extraAttacks: 2 }),
    /Mastery/
  );
  assert.throws(
    () =>
      plan(
        { ...base(), refreshAction: { state: "waiting", combatId: "combat", startRound: 2 } },
        clock(),
        pair(),
        input()
      ),
    /Refresh/
  );
  for (const c of ["pinned", "stunned", "dead", "dazed", "paralyzed", "sleeping"])
    assert.throws(() => plan({ ...base(), conditionContext: { [c]: true } }, clock(), pair(), input()), c);
  assert.equal(plan({ ...base(), conditionContext: { held: true } }, clock(), pair(), input()).penalty, 2);
});
test("only two distinct actually readied one-handed weapons in usable separate hands qualify, preserving Size and possession rules", () => {
  for (const patch of [
    { equipped: false },
    { carried: false },
    { reserve: true },
    { destroyed: true },
    { quantity: 0 },
    { sizeHands: "M/2h" },
    { useHands: 2 }
  ]) {
    const p = pair();
    Object.assign(p[1].system, patch);
    assert.throws(() => plan(base(), clock(), p, input()));
  }
  assert.throws(() => plan({ ...base(), size: "Small" }, clock(), pair(), input()), /Size/);
  assert.throws(() => plan(base(), clock(), pair(), { ...input(), weaponIds: ["one", "one"] }), /distinct/);
  const p = pair();
  p[1].name = p[0].name;
  assert.equal(plan(base(), clock(), p, input()).extraAttacks, 1);
});
test("accepted penalties survive source loss, do not stack and expire exactly at next own Count; the already-granted opportunities remain bounded to the original declaration", () => {
  for (const round of [1, 2, 3, 4])
    for (const turn of [0, 1, 2]) {
      const s = { ...base(), twoWeaponStyle: record(2), twoWeaponCombatContext: { ...clock(), round, turn } },
        r = state(s);
      assert.equal(r.active, round === 2 || (round === 3 && turn < 1));
      assert.equal(r.penalty, r.active ? 4 : 0);
    }
  const s = { ...base(), twoWeaponStyle: record(2), twoWeaponCombatContext: clock() };
  assert.throws(() => plan(s, clock(), pair(), input()), /already active/);
  s.activeFeatNames = [basics];
  assert.equal(state(s).allowedAttacks, 2);
  assert.equal(state(s).penalty, 4);
  s.activeFeatNames = [];
  assert.equal(state(s).allowedAttacks, 2);
  assert.equal(state(s).penalty, 4);
});
function calculate({ extra = 0, conditions = {} } = {}) {
  const cls = {
      id: "test",
      type: "class",
      name: "Test",
      system: {
        identifier: "test",
        skillPoints: 4,
        vitalityDie: 6,
        classSkills: [],
        table: [{ level: 1, bab: 9, defense: 4, fort: 2, ref: 2, will: 2 }]
      }
    },
    feats = [basics, mastery].map((name, i) => ({
      id: "feat" + i,
      type: "feat",
      name,
      system: { granted: true, bonuses: [] }
    }));
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {},
      conditionContext: conditions,
      twoWeaponStyle: extra ? record(extra) : null,
      twoWeaponCombatContext: clock()
    },
    [cls, ...feats],
    cfg
  );
}
test("all weapons, named skill uses and Knowledge receive the penalty once after skill-bonus transforms, while damage/saves/Defense/Initiative remain unchanged", () => {
  for (const extra of [1, 2])
    for (const conditions of [{}, { baffled: true }, { incompetent: true }]) {
      const a = calculate({ conditions }),
        b = calculate({ extra, conditions });
      for (const [key, skill] of Object.entries(cfg.skills))
        for (const check of skill.checks ?? []) {
          const options = { gearStatus: "available" },
            x = resolveSkillCheck(a, key, check, options),
            y = resolveSkillCheck(b, key, check, options);
          assert.equal(y.total, x.total - extra * 2, key + "/" + check.id);
        }
      assert.equal(
        resolveKnowledgeCheck(b, { skill: "search" }).total,
        resolveKnowledgeCheck(a, { skill: "search" }).total - extra * 2
      );
      for (const p of Object.keys(cfg.proficiencies)) {
        const w = weapon("test", p).system;
        assert.equal(weaponAttack(b, w, cfg).total, weaponAttack(a, w, cfg).total - extra * 2, p);
        assert.deepEqual(weaponDamage(b, w), weaponDamage(a, w));
      }
      assert.deepEqual(b.saves, a.saves);
      assert.deepEqual(b.defense, a.defense);
      assert.deepEqual(b.initiative, a.initiative);
      assert.equal(b.bab, a.bab);
    }
});
test("Both Guns Blazing waives only this penalty on actual handgun attacks and skills for an all-handgun declaration, retaining unrelated penalties; mixed scope remains held", () => {
  const s = {
      ...base(),
      bab: 9,
      proficiencyTotals: { handgun: { proficient: true }, edged: { proficient: true } },
      classLevels: { triggerman: 10 },
      twoWeaponStyle: record(2, ["handgun", "handgun"]),
      twoWeaponCombatContext: clock()
    },
    normal = { ...s, twoWeaponStyle: null };
  assert.equal(state(s).skillPenalty, 0);
  assert.equal(weaponAttack(s, weapon("g").system, cfg).total, weaponAttack(normal, weapon("g").system, cfg).total);
  assert.equal(
    weaponAttack(s, weapon("blade", "edged").system, cfg).total,
    weaponAttack(normal, weapon("blade", "edged").system, cfg).total - 4
  );
  s.conditionContext = { sickened: true };
  const gun = weaponAttack(s, weapon("g").system, cfg);
  assert.equal(gun.conditionAttackPenalty, -2);
  assert.equal(gun.twoWeaponWaiver, 4);
  assert.equal(
    gun.total,
    weaponAttack({ ...normal, conditionContext: { sickened: true } }, weapon("g").system, cfg).total
  );
  const mixed = { ...s, twoWeaponStyle: record(2) };
  assert.equal(state(mixed).needsReview, true);
  assert.throws(() => plan({ ...base(), classLevels: { triggerman: 10 } }, clock(), pair(), input()), /pending scope/);
  assert.equal(weaponAttack(mixed, weapon("g").system, cfg).blocked, true);
  assert.equal(weaponDamage(mixed, weapon("g").system).blocked, false);
});
let notices = [],
  posts = [],
  response = null,
  hook = null,
  postFail = false,
  sequence = 0;
game.user = { id: "gc", isGM: true };
foundry.utils.escapeHTML = s => String(s);
foundry.utils.randomID = () => "style" + ++sequence;
foundry.applications.api.DialogV2.input = async () => {
  await hook?.();
  return response;
};
ui.notifications.warn = s => {
  notices.push(s);
  return null;
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (postFail) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
function actor() {
  notices = [];
  posts = [];
  response = null;
  hook = null;
  postFail = false;
  game.user.isGM = true;
  const a = {
    uuid: "Actor.style",
    type: "agent",
    isOwner: true,
    flags: {},
    items: pair(),
    system: { ...base(), twoWeaponCombatContext: clock() },
    participatingCombat: { id: "combat", started: true, round: 2, turn: 1, turns: [] },
    async update(p) {
      if (this.fail === "before") {
        this.fail = null;
        throw Error("before write");
      }
      for (const [path, value] of Object.entries(p)) {
        const keys = path.split(".");
        let obj = this;
        for (const key of keys.slice(0, -1)) obj = obj[key] ??= {};
        obj[keys.at(-1)] = structuredClone(value);
      }
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
  return a;
}
test("the real declaration controller validates stale ownership/Count and settles one durable tradeoff despite duplicate clicks or post/write errors", async () => {
  let a = actor();
  assert.equal(await declareTwoWeapon(a), null);
  for (const cause of ["count", "owner"]) {
    a = actor();
    response = input();
    hook = () => {
      if (cause === "count") a.participatingCombat.turn = 0;
      else a.isOwner = false;
    };
    await assert.rejects(declareTwoWeapon(a));
    assert.equal(a.system.twoWeaponStyle, undefined);
  }
  for (const failure of ["none", "after", "post"]) {
    a = actor();
    if (failure === "after") a.fail = "after";
    if (failure === "post") postFail = true;
    const results = await Promise.allSettled([declareTwoWeapon(a, input()), declareTwoWeapon(a, input())]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "rejected");
    assert.equal(a.system.twoWeaponStyle.penalty, 2);
    assert.equal(a.flags.spycraft2.twoWeaponDeclarations["combat:2"], a.system.twoWeaponStyle.id);
    if (failure === "post") assert.equal(notices.length, 1);
  }
  a = actor();
  a.fail = "before";
  await assert.rejects(declareTwoWeapon(a, input()), /before write/);
  assert.equal(a.system.twoWeaponStyle, undefined);
});
test("GC review freezes the remaining tradeoff and records its resolution without granting another declaration this round", async () => {
  const a = actor();
  await declareTwoWeapon(a, input());
  const audit = await reviewTwoWeapon(a, {
    confirmed: true,
    resolution: "Verified remaining penalty and final attacks; resolved at the table"
  });
  assert.equal(a.system.twoWeaponStyle, null);
  assert.equal(audit.combatRound, "combat:2");
  assert.ok(a.flags.spycraft2.twoWeaponReviews[audit.id]);
  await assert.rejects(declareTwoWeapon(a, input()), /already been recorded/);
  delete a.flags.spycraft2.twoWeaponDeclarations["combat:2"];
  await assert.rejects(declareTwoWeapon(a, input()), /already been recorded/);
  const b = actor();
  await declareTwoWeapon(b, input());
  response = { confirmed: true, resolution: "Verified" };
  hook = () => {
    b.participatingCombat.turn = 0;
  };
  await assert.rejects(reviewTwoWeapon(b), /changed/);
  game.user.isGM = false;
  await assert.rejects(reviewTwoWeapon(b, { confirmed: true, resolution: "Verified" }), /GC/);
});
test("malformed declarations hold affected checks for GC review before RNG while injury damage remains independently resolvable", async () => {
  const a = makeFatigueActor();
  a.raw.twoWeaponStyle = { ...record(), penalty: 1 };
  a.raw.twoWeaponCombatContext = clock();
  a.derive();
  assert.equal(a.system.twoWeaponStyleState.needsReview, true);
  await assert.rejects(a.rollCheck("1d20", {}, { checkKind: "attack" }), /review/);
  assert.equal(resolveKnowledgeCheck(a.system, { skill: "search" }).blocked, true);
  assert.equal(resolveSkillCheck(a.system, "athletics", cfg.skills.athletics.checks[0], {}).blocked, true);
  assert.ok(weaponDamage(a.system, weapon("g").system).formula);
});

test("clearing a known expired declaration preserves its original round without consuming a new round’s choice", async () => {
  const a = actor();
  await declareTwoWeapon(a, input());
  a.participatingCombat.round = 3;
  a.system.twoWeaponCombatContext = { ...clock(), round: 3 };
  assert.equal(state(a.system).active, false);
  const audit = await reviewTwoWeapon(a, { confirmed: true, resolution: "Verified old round declaration is over" });
  assert.equal(audit.combatRound, "combat:2");
  const r = await declareTwoWeapon(a, input());
  assert.equal(r.startRound, 3);
});

test("malformed declaration history never invents an unused choice and explicit GC recovery retains the unknown old history", async () => {
  const a = actor();
  a.flags = { spycraft2: { twoWeaponDeclarations: 7 } };
  await assert.rejects(declareTwoWeapon(a, input()), /review.*history/);
  assert.equal(a.system.twoWeaponStyle, undefined);
  const audit = await reviewTwoWeapon(a, {
    confirmed: true,
    resolution: "Verified actual remaining tradeoff and unknown saved history; no extra current-round use"
  });
  assert.equal(audit.historyBefore.declarations, 7);
  assert.ok(audit.blockedRounds.includes("combat:2"));
  await assert.rejects(declareTwoWeapon(a, input()), /already been recorded/);
  a.participatingCombat.round = 3;
  a.system.twoWeaponCombatContext = { ...clock(), round: 3 };
  assert.equal((await declareTwoWeapon(a, input())).startRound, 3);
});

const { SpycraftActor } = await import("../module/documents/actor.mjs");
const { limitedUseAbilities, resourceStatus, resourceCounterReviewPlan } =
  await import("../module/rules/limited-uses.mjs");
function finalActor(n = 1) {
  const a = actor();
  a.system.twoWeaponStyle = record(n);
  a.system.resourceUses = { twoWeaponFinalAttack: { epoch: "declaration", used: 0 } };
  a.system.actionDice = { value: 0 };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.items.get = id => a.items.find(i => i.id === id);
  for (const item of a.items) item.system.maxRangeIncrements = 10;
  a.weaponAttack = (item, opts) => weaponAttack(a.system, item.system, cfg, "agent", opts);
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.actionDiceFundingSystem = a.system;
  a.usagePeriods = { "two-weapon declaration": "declaration" };
  a.rollAttack = async (item, opts) => {
    await opts.validateFinalAttack();
    assert.equal(opts.attackAction, "standard");
    assert.equal(opts.freeFinalAttack, true);
    await a.drawHook?.();
    await opts.validateFinalAttack();
    const m = {
      id: "final" + ++sequence,
      flags: { spycraft2: { actorUuid: a.uuid, twoWeaponFinalAttack: opts.twoWeaponFinalAttack } }
    };
    if (a.cancel) return null;
    if (a.postError === "before") throw Error("unposted");
    game.messages.push(m);
    if (a.postError === "after") throw Error("posted");
    return m;
  };
  game.messages = [];
  return a;
}
const finalInput = { weaponId: "one", leastUsedConfirmed: true, distanceFeet: 30 };
test("final attacks retain the accepted grant after source removal, require own Count and the least-used original ready weapon, and allow Held free actions but never Pinned", () => {
  const s = { ...base(), activeFeatNames: [], twoWeaponStyle: record(2) };
  assert.equal(finalPlan(s, clock(), pair(), finalInput).attackAction, "standard");
  const p = pair();
  p[1].system.equipped = false;
  assert.ok(finalPlan(s, clock(), p, finalInput));
  p[0].system.equipped = false;
  assert.throws(() => finalPlan(s, clock(), p, finalInput), /readied/);
  for (const patch of [{ leastUsedConfirmed: false }, { weaponId: "other" }])
    assert.throws(() => finalPlan(s, clock(), pair(), { ...finalInput, ...patch }));
  assert.throws(() => finalPlan(s, { ...clock(), turn: 0 }, pair(), finalInput), /Count/);
  for (const c of ["pinned", "stunned", "sleeping"])
    assert.throws(() => finalPlan({ ...s, conditionContext: { [c]: true } }, clock(), pair(), finalInput));
  assert.ok(finalPlan({ ...s, conditionContext: { held: true } }, clock(), pair(), finalInput));
  const held = { ...s, conditionContext: { held: true }, twoWeaponCombatContext: clock() };
  assert.equal(weaponAttack(held, pair()[0].system, cfg, "agent", { freeFinalAttack: true }).blocked, false);
  assert.equal(weaponAttack(held, pair()[0].system, cfg).blocked, true);
});
test("old declarations require verified use history; new declarations atomically seed their own epoch and GC can record attacks resolved outside this control", async () => {
  const a = finalActor(2),
    spec = a.system.limitedUses.find(s => s.id === "twoWeaponFinalAttack");
  for (const uses of [
    {},
    { twoWeaponFinalAttack: { epoch: "old", used: 0 } },
    { twoWeaponFinalAttack: { epoch: "declaration", used: "0" } }
  ])
    assert.equal(resourceStatus(spec, uses, a.usagePeriods).counterReview, true);
  assert.equal(resourceStatus({ ...spec, requiresEpochReceipt: false }, {}, a.usagePeriods).counterReview, undefined);
  assert.deepEqual(
    resourceCounterReviewPlan(spec, a.system.resourceUses, a.usagePeriods, {
      used: 2,
      reason: "Two attacks through class controls",
      confirmed: true
    }).record,
    { epoch: "declaration", used: 2 }
  );
  const b = actor();
  const r = await declareTwoWeapon(b, input());
  assert.deepEqual(b.system.resourceUses.twoWeaponFinalAttack, { epoch: r.id, used: 0 });
});
test("the real resource transaction enforces one/two final attacks across duplicate clicks and source changes without spending action dice, including Shaken IV", async () => {
  for (const n of [1, 2]) {
    const a = finalActor(n);
    a.system.activeFeatNames = [];
    a.system.conditionContext = { shakenGrade: 4 };
    const out = await Promise.allSettled(Array.from({ length: 4 }, () => takeTwoWeaponFinalAttack(a, finalInput)));
    assert.equal(game.messages.length, n);
    assert.equal(a.system.resourceUses.twoWeaponFinalAttack.used, n);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(out.filter(r => r.status === "fulfilled" && r.value?.id).length, n);
    assert.equal(new Set(game.messages.map(m => m.flags.spycraft2.twoWeaponFinalAttack.sequence)).size, n);
  }
});
test("cancelled and unposted technical failures refund only the reserved attack; a committed chat response failure retains the use", async () => {
  for (const mode of ["cancel", "before", "after"]) {
    const a = finalActor();
    if (mode === "cancel") a.cancel = true;
    else a.postError = mode;
    const result = await Promise.allSettled([takeTwoWeaponFinalAttack(a, finalInput)]);
    assert.equal(a.system.resourceUses.twoWeaponFinalAttack.used, mode === "after" ? 1 : 0);
    assert.equal(result[0].status, mode === "after" ? "fulfilled" : "rejected");
  }
});
test("weapon, Count, permission and declaration changes during the roll prevent a stale final benefit; unsupported nested class declarations fail before reserving", async () => {
  for (const change of [
    a => (a.items[0].system.equipped = false),
    a => (a.participatingCombat.turn = 0),
    a => (a.isOwner = false),
    a => (a.system.twoWeaponStyle.penalty = 4)
  ]) {
    const a = finalActor();
    a.drawHook = () => change(a);
    await assert.rejects(takeTwoWeaponFinalAttack(a, finalInput));
    assert.equal(a.system.resourceUses.twoWeaponFinalAttack.used, 0);
    assert.equal(game.messages.length, 0);
  }
  for (const key of ["oneInAMillion", "millionDollarSkill", "cunningPlan"]) {
    const a = finalActor();
    await assert.rejects(takeTwoWeaponFinalAttack(a, { ...finalInput, [key]: true }), /class/);
    assert.equal(a.system.resourceUses.twoWeaponFinalAttack.used, 0);
  }
});

test("final ranged attacks require measured distance and invalid prior setup is rejected before any use reservation", async () => {
  for (const patch of [
    { distanceFeet: undefined },
    { distanceFeet: -1 },
    { braced: true, stableSurface: false },
    { aimed: "true" }
  ]) {
    const a = finalActor();
    await assert.rejects(takeTwoWeaponFinalAttack(a, { ...finalInput, ...patch }));
    assert.equal(a.system.resourceUses.twoWeaponFinalAttack.used, 0);
    assert.equal(game.messages.length, 0);
  }
});
