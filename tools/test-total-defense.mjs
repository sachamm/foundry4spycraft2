import test from "node:test";
import assert from "node:assert/strict";
import { totalDefensePlan, totalDefenseState, equilibriumTotalDefenseBonus } from "../module/rules/total-defense.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { takeTotalDefense } from "../module/apps/total-defense.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";
const clock = () => ({ id: "combat", started: true, round: 2, turn: 1, combatantId: "own", ownTurnIndex: 1 });
const record = () => ({ combatId: "combat", combatantId: "own", startRound: 2, dueRound: 3 });
const state = () => ({
  speed: 30,
  canRun: true,
  conditionContext: {},
  postureMovement: { standardMove: true },
  activeFeatNames: [],
  abilities: { dex: { value: 14, mod: 2 } },
  wounds: { value: 4 }
});
const options = () => ({ distanceFeet: 30, routeConfirmed: true, actionConfirmed: true });
test("Total Defense requires the actual own Count and full action, and validates included movement against current Mobility, posture and adjacency", () => {
  const s = state();
  assert.equal(totalDefensePlan(s, clock(), options()).movement.maximumFeet, 30);
  s.activeFeatNames = ["Combat Mobility"];
  assert.equal(totalDefensePlan(s, clock(), { ...options(), distanceFeet: 60 }).movement.maximumFeet, 60);
  assert.throws(() => totalDefensePlan(s, clock(), { ...options(), distanceFeet: 61 }), /allowance/);
  for (const patch of [{ started: false }, { turn: 0 }, { ownTurnIndex: -1 }, { combatantId: "" }, { round: 0 }])
    assert.throws(() => totalDefensePlan(s, { ...clock(), ...patch }, options()), /Initiative/);
  assert.throws(() => totalDefensePlan(s, clock(), { ...options(), actionConfirmed: false }), /full action/);
  assert.throws(() => totalDefensePlan(s, clock(), { ...options(), routeConfirmed: false }), /GC/);
  assert.throws(() => totalDefensePlan(s, clock(), { ...options(), adjacentThreateningOpponent: true }), /Withdraw/);
  s.postureMovement.standardMove = false;
  assert.equal(totalDefensePlan(s, clock(), { ...options(), distanceFeet: 0 }).movement.distanceFeet, 0);
  assert.throws(() => totalDefensePlan(s, clock(), options()), /posture/);
  s.refreshAction = { state: "waiting", combatId: "combat", startRound: 2 };
  assert.throws(() => totalDefensePlan(s, clock(), options()), /Refresh/);
});
test("Total Defense lasts through the next global round until own Count, cannot stack and never transfers to another combatant or combat", () => {
  for (const round of [1, 2, 3, 4])
    for (const turn of [0, 1, 2])
      assert.equal(
        totalDefenseState({ totalDefense: record(), totalDefenseCombatContext: { ...clock(), round, turn } }).active,
        round === 2 || (round === 3 && turn < 1)
      );
  for (const patch of [{ id: "other" }, { combatantId: "other" }, { started: false }, { ownTurnIndex: -1 }])
    assert.equal(
      totalDefenseState({ totalDefense: record(), totalDefenseCombatContext: { ...clock(), ...patch } }).bonus,
      0
    );
  assert.throws(() => totalDefensePlan({ ...state(), totalDefense: record() }, clock(), options()), /already active/);
  assert.equal(
    totalDefensePlan({ ...state(), totalDefense: record() }, { ...clock(), round: 3 }, options()).dueRound,
    4
  );
});
function calculate({ total = false, expertise = false, conditions = {} } = {}) {
  const cls = {
    id: "test",
    type: "class",
    name: "Test",
    system: {
      identifier: "test",
      skillPoints: 4,
      vitalityDie: 6,
      classSkills: [],
      table: [{ level: 1, bab: 1, defense: 4, fort: 0, ref: 0, will: 0 }]
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
      totalDefense: total ? record() : null,
      totalDefenseCombatContext: clock(),
      combatExpertise: expertise ? { ...record(), penalty: 2 } : null,
      expertiseCombatContext: clock()
    },
    [cls],
    cfg
  );
}
test("the actual engine stacks Total Defense with Combat Expertise as dodge, loses the benefit when vulnerable, and does not change attack or skill checks", () => {
  for (const conditions of [
    {},
    { vulnerable: true },
    { flatFooted: true },
    { blinded: true },
    { held: true },
    { helpless: true }
  ])
    for (const expertise of [false, true]) {
      const a = calculate({ conditions, expertise }),
        b = calculate({ conditions, expertise, total: true });
      assert.equal(b.defense.total, a.defense.total + (Object.keys(conditions).length ? 0 : 4));
      assert.equal(b.defense.dodgeBonuses, a.defense.dodgeBonuses + 4);
      assert.deepEqual(b.attack, a.attack);
      assert.deepEqual(b.skillTotals, a.skillTotals);
      assert.deepEqual(b.saves, a.saves);
      assert.equal(b.defense.base, a.defense.base);
    }
  const a = calculate({ total: true, expertise: true }),
    b = calculate();
  assert.equal(a.defense.total, b.defense.total + 6);
  assert.equal(a.attack.melee, b.attack.melee - 2);
  assert.equal(
    incomingDefensePlan(a, { invisibleAttacker: true }).total,
    incomingDefensePlan(b, { invisibleAttacker: true }).total
  );
});
let posts = [],
  warnings = [],
  response = null,
  hook = null,
  postFail = false;
globalThis.game = { settings: { get: () => ({}) } };
globalThis.foundry = {
  utils: { randomID: () => "total" },
  applications: {
    api: {
      DialogV2: {
        input: async () => {
          await hook?.();
          return response;
        }
      }
    }
  }
};
globalThis.ui = { notifications: { warn: s => warnings.push(s) } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async d => {
    if (postFail) throw Error("post failed");
    posts.push(d);
    return d;
  }
};
function actor() {
  posts = [];
  warnings = [];
  response = null;
  hook = null;
  postFail = false;
  const a = {
    uuid: "Actor.total",
    type: "agent",
    isOwner: true,
    system: state(),
    participatingCombat: { id: "combat", started: true, round: 2, turn: 1, turns: [] },
    async update(p) {
      if (this.failBefore) throw Error("before write");
      this.system.totalDefense = structuredClone(p["system.totalDefense"]);
      if (this.failAfter) throw Error("committed write");
      return this;
    }
  };
  a.participatingCombat.turns = [
    { id: "other", actor: { uuid: "Actor.other" } },
    { id: "own", actor: a }
  ];
  return a;
}
test("the actual Total Defense declaration handles cancellation and rechecks Count, ownership, route Speed and action availability", async () => {
  let a = actor();
  assert.equal(await takeTotalDefense(a), null);
  assert.equal(a.system.totalDefense, undefined);
  for (const change of ["count", "owner", "speed", "refresh"]) {
    a = actor();
    response = options();
    hook = () => {
      if (change === "count") a.participatingCombat.turn = 0;
      if (change === "owner") a.isOwner = false;
      if (change === "speed") a.system.speed = 10;
      if (change === "refresh") a.system.refreshAction = { state: "waiting", combatId: "combat", startRound: 2 };
    };
    await assert.rejects(takeTotalDefense(a));
    assert.equal(a.system.totalDefense, undefined);
  }
  a = actor();
  response = { ...options(), distanceFeet: "" };
  await assert.rejects(takeTotalDefense(a), /distance/);
});
test("queued declarations record the actual full action once and retain proven writes when a response or notice fails", async () => {
  for (const failure of ["none", "write", "post"]) {
    const a = actor();
    a.failAfter = failure === "write";
    postFail = failure === "post";
    const results = await Promise.allSettled([takeTotalDefense(a, options()), takeTotalDefense(a, options())]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "rejected");
    assert.equal(a.system.totalDefense.movement.distanceFeet, 30);
    assert.equal(a.system.totalDefense.actionConfirmed, true);
    if (failure === "post") {
      assert.equal(posts.length, 0);
      assert.equal(warnings.length, 1);
    } else assert.equal(posts[0].flags.spycraft2.totalDefense.id, "total");
  }
  const a = actor();
  a.failBefore = true;
  await assert.rejects(takeTotalDefense(a, options()), /before write/);
  assert.equal(a.system.totalDefense, undefined);
  assert.equal(posts.length, 0);
});

const covert = (count = 3) => [
  { name: "Equilibrium Basics", tree: "covert", choice: "" },
  ...Array.from({ length: count - 1 }, (_, i) => ({ name: "Covert " + i, tree: "covert", choice: "" }))
];
test("Equilibrium Basics adds actual Covert selections including itself once, requires a valid current source, and leaves historical declarations unchanged", () => {
  for (let count = 1; count <= 30; count++) {
    const s = {
        ...state(),
        activeFeatNames: ["Equilibrium Basics", "Equilibrium Basics"],
        activeFeatSelections: [...covert(count), { name: "Other tree", tree: "chance" }],
        totalDefense: record(),
        totalDefenseCombatContext: clock()
      },
      p = equilibriumTotalDefenseBonus(s);
    s.totalDefense.equilibrium = p.evidence;
    const before = structuredClone(s);
    assert.equal(p.bonus, count);
    assert.equal(p.evidence.covertFeats.length, count);
    assert.equal(totalDefenseState(s).bonus, 4 + count);
    assert.deepEqual(s, before);
    s.activeFeatNames = [];
    assert.equal(totalDefenseState(s).bonus, 4);
    s.activeFeatNames = ["Equilibrium Basics"];
    s.activeFeatSelections = covert(1);
    assert.equal(totalDefenseState(s).bonus, 5);
    s.totalDefense.equilibrium = { bonus: 99 };
    assert.equal(totalDefenseState(s).needsReview, true);
  }
  for (const selections of [
    undefined,
    {},
    [],
    [null],
    [{ name: "Other", tree: "covert" }],
    [{ name: "Equilibrium Basics", tree: "covert", choice: {} }]
  ]) {
    const s = { ...state(), activeFeatNames: ["Equilibrium Basics"], activeFeatSelections: selections };
    assert.match(equilibriumTotalDefenseBonus(s).blockedReason, /Review/);
    assert.throws(() => totalDefensePlan(s, clock(), options()), /Review/);
    const active = {
      ...s,
      totalDefense: {
        ...record(),
        equilibrium: {
          version: 1,
          source: "Equilibrium Basics",
          bonus: 1,
          covertFeats: [{ name: "Equilibrium Basics", choice: "" }]
        }
      },
      totalDefenseCombatContext: clock(),
      defense: { total: 16, dodgeBonuses: 4 }
    };
    assert.equal(totalDefenseState(active).needsReview, true);
    assert.throws(() => incomingDefensePlan(active), /Review/);
  }
});
function equilibriumEngine({ total = true, expertise = false, conditions = {} } = {}) {
  const cls = {
      id: "test",
      type: "class",
      name: "Test",
      system: {
        identifier: "test",
        skillPoints: 4,
        vitalityDie: 6,
        classSkills: [],
        table: [{ level: 1, bab: 1, defense: 4, fort: 0, ref: 0, will: 0 }]
      }
    },
    feats = covert(3).map((row, i) => ({
      id: "feat" + i,
      name: row.name,
      type: "feat",
      system: { tree: "covert", bonuses: [], granted: true, acquiredAtLevel: 1 }
    }));
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      conditionContext: conditions,
      totalDefense: total
        ? {
            ...record(),
            equilibrium: {
              version: 1,
              source: "Equilibrium Basics",
              bonus: 3,
              covertFeats: covert(3).map(({ name, choice }) => ({ name, choice }))
            }
          }
        : null,
      totalDefenseCombatContext: clock(),
      combatExpertise: expertise ? { ...record(), penalty: 2 } : null,
      expertiseCombatContext: clock()
    },
    [cls, ...feats],
    cfg
  );
}
test("engine stacks base Total Defense and Equilibrium as separate dodge sources, loses both to vulnerability and leaves attack/skill/save math unchanged", () => {
  for (const conditions of [
    {},
    { vulnerable: true },
    { flatFooted: true },
    { blinded: true },
    { held: true },
    { helpless: true },
    { unconscious: true }
  ])
    for (const expertise of [false, true]) {
      const base = equilibriumEngine({ total: false, expertise, conditions }),
        active = equilibriumEngine({ total: true, expertise, conditions });
      assert.equal(active.totalDefenseState.bonus, 7);
      assert.equal(active.defense.total, base.defense.total + (Object.keys(conditions).length ? 0 : 7));
      assert.equal(active.defense.dodgeBonuses, base.defense.dodgeBonuses + 7);
      assert.deepEqual(active.attack, base.attack);
      assert.deepEqual(active.skillTotals, base.skillTotals);
      assert.deepEqual(active.saves, base.saves);
      assert.equal(
        incomingDefensePlan(active, { invisibleAttacker: true }).total,
        incomingDefensePlan(base, { invisibleAttacker: true }).total
      );
    }
  const s = equilibriumEngine();
  assert.equal(s.bonusSources.defense.find(e => e.source === "Total Defense").value, 4);
  assert.equal(s.bonusSources.defense.find(e => e.source === "Equilibrium Basics").value, 3);
});
test("Equilibrium dodge expires on the same own Count as the base action and never transfers to another combatant/combat", () => {
  const s = {
    ...state(),
    activeFeatNames: ["Equilibrium Basics"],
    activeFeatSelections: covert(3),
    totalDefense: {
      ...record(),
      equilibrium: {
        version: 1,
        source: "Equilibrium Basics",
        bonus: 3,
        covertFeats: covert(3).map(({ name, choice }) => ({ name, choice }))
      }
    }
  };
  for (const [c, bonus] of [
    [clock(), 7],
    [{ ...clock(), round: 3, turn: 0 }, 7],
    [{ ...clock(), round: 3, turn: 1 }, 0],
    [{ ...clock(), id: "other" }, 0],
    [{ ...clock(), combatantId: "other" }, 0],
    [{ ...clock(), started: false }, 0]
  ])
    assert.equal(totalDefenseState({ ...s, totalDefenseCombatContext: c }).bonus, bonus);
  assert.equal(totalDefensePlan({ ...s, totalDefense: null }, clock(), options()).equilibrium.bonus, 3);
});
test("actual declaration previews and records Equilibrium’s current count, rechecks dialog source drift and handles committed source-proof key order", async () => {
  let a = actor();
  a.system.activeFeatNames = ["Equilibrium Basics"];
  a.system.activeFeatSelections = covert(3);
  let r = await takeTotalDefense(a, options());
  assert.equal(r.equilibrium.bonus, 3);
  assert.match(posts[0].content, /\+7 dodge.*Equilibrium Basics \+3/);
  a = actor();
  a.system.activeFeatNames = ["Equilibrium Basics"];
  a.system.activeFeatSelections = covert(3);
  response = options();
  hook = () => {
    a.system.activeFeatSelections.pop();
  };
  await assert.rejects(takeTotalDefense(a), /Covert count changed/);
  assert.equal(a.system.totalDefense, undefined);
  a = actor();
  a.system.activeFeatNames = ["Equilibrium Basics"];
  a.system.activeFeatSelections = covert(3);
  a.update = async function (p) {
    this.system.totalDefense = Object.fromEntries(Object.entries(p["system.totalDefense"]).reverse());
    this.system.totalDefense.equilibrium = Object.fromEntries(
      Object.entries(this.system.totalDefense.equilibrium).reverse()
    );
    throw Error("Committed but rejected");
  };
  r = await takeTotalDefense(a, options());
  assert.equal(r.equilibrium.bonus, 3);
  assert.equal(posts.length, 1);
});
test("a new ordinary Total Defense explicitly removes an expired declaration’s old Equilibrium proof under native nested merge semantics", async () => {
  const a = actor();
  a.system.totalDefense = {
    ...record(),
    startRound: 1,
    dueRound: 2,
    equilibrium: { version: 1, source: "Equilibrium Basics", bonus: 3, covertFeats: covert(3) }
  };
  a.update = async function (p) {
    this.lastPatch = structuredClone(p);
    Object.assign(this.system.totalDefense, structuredClone(p["system.totalDefense"]));
    if (Object.hasOwn(p, "system.totalDefense.-=equilibrium")) delete this.system.totalDefense.equilibrium;
    return this;
  };
  const r = await takeTotalDefense(a, options());
  assert.equal(r.equilibrium, undefined);
  assert.equal(a.system.totalDefense.equilibrium, undefined);
  assert.equal(a.lastPatch["system.totalDefense.-=equilibrium"], null);
  assert.match(posts[0].content, /\+4 dodge/);
});

test("restoring or gaining Equilibrium after an ordinary declaration cannot grant a bonus that was not earned at that action", () => {
  const s = {
    ...state(),
    activeFeatNames: ["Equilibrium Basics"],
    activeFeatSelections: covert(3),
    totalDefense: record(),
    totalDefenseCombatContext: clock()
  };
  assert.equal(totalDefenseState(s).bonus, 4);
  assert.equal(totalDefenseState(s).equilibrium, undefined);
  const earned = totalDefensePlan({ ...s, totalDefense: null }, clock(), options());
  s.totalDefense = earned;
  assert.equal(totalDefenseState(s).bonus, 7);
  s.activeFeatNames = [];
  assert.equal(totalDefenseState(s).bonus, 4);
  s.activeFeatNames = ["Equilibrium Basics"];
  assert.equal(totalDefenseState(s).bonus, 7);
  s.totalDefense.equilibrium.covertFeats = [];
  assert.equal(totalDefenseState(s).needsReview, true);
});
