import test from "node:test";
import assert from "node:assert/strict";
import {
  cheapShotPlan as plan,
  validateCheapShotProof as validate,
  CHEAP_SHOT_CHOICES
} from "../module/rules/cheap-shot.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { clock, sword, prep } from "./fixtures/feint.mjs";
const flail = (patch = {}) => ({
    ...sword({
      meleeFamily: "flail",
      proficiency: "exoticBlunt",
      qualities: "",
      error: 1,
      threat: 20,
      damage: "1d6",
      range: 0,
      ...patch
    }),
    name: "Reviewed flail"
  }),
  state = (names = ["Flail Basics"]) => ({
    size: "Medium",
    bab: 3,
    activeFeatNames: names,
    classLevels: {},
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
    proficiencyTotals: { exoticBlunt: { proficient: true }, edged: { proficient: true } },
    conditionContext: {},
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  context = (patch = {}) => ({
    choice: "dex",
    targetUuid: "Actor.target",
    targetName: "Actual opponent",
    confirmed: true,
    eligibleConfirmed: true,
    ...patch
  }),
  opts = (patch = {}) => ({ attackAction: "standard", cheapShot: context(), cheapShotCombat: clock(), ...patch }),
  attack = (s, items, o = opts()) =>
    weaponAttack(prep(s, items), { ...items[0].system, id: items[0].id }, cfg, "agent", o);
test("all seven predeclared weaknesses use attack−4 and error+1; Flail adds2only to melee Cheap Shot", () => {
  for (const choice of CHEAP_SHOT_CHOICES) {
    const w = flail(),
      s = state(),
      r = attack(s, [w], opts({ cheapShot: context({ choice }) })),
      plain = attack(s, [w], { attackAction: "standard" });
    assert.equal(r.total, plain.total - 2);
    assert.equal(r.error, plain.error + 1);
    assert.equal(r.cheapShot.choice, choice);
    assert.equal(r.cheapShot.gearBonus, 2);
  }
  assert.equal(attack(state([]), [flail()]).cheapShot.attackBonus, -4);
  const s = prep(state(), [flail()]);
  assert.equal(
    plan(s, { ...flail().system, id: "other" }, { context: context(), ranged: true, combat: clock() }).gearBonus,
    0
  );
  assert.equal(attack(state(), [flail()], { attackAction: "standard" }).cheapShot.active, false);
});
test("strict actual target, declared choice, legal actions and own Initiative Count are mandatory", () => {
  for (const patch of [
    { choice: "" },
    { choice: "defense" },
    { targetUuid: "" },
    { targetName: "" },
    { confirmed: "true" },
    { eligibleConfirmed: false }
  ])
    assert.equal(attack(state(), [flail()], opts({ cheapShot: context(patch) })).blocked, true);
  for (const patch of [
    { attackAction: "other" },
    { cheapShotCombat: null },
    { cheapShotCombat: { ...clock(), turn: 1 } },
    { disarm: {} }
  ])
    assert.equal(attack(state(), [flail()], opts(patch)).blocked, true);
});
test("actual family and held capacity determine the Flail source independently from the attack weapon", () => {
  for (const patch of [{ meleeFamily: "" }, { meleeFamily: "whip" }])
    assert.equal(attack(state(), [flail(patch)]).cheapShot.gearBonus, 0);
  for (const patch of [
    { carried: false },
    { destroyed: true },
    { equipped: false },
    { reserve: true },
    { quantity: 0 }
  ])
    assert.equal(attack(state(), [flail(patch)]).blocked, true);
  assert.equal(attack(state(), [sword(), { ...flail(), id: "second" }]).cheapShot.gearBonus, 2);
  assert.equal(attack(state(), [flail({ useHands: 2 }), { ...sword(), id: "second" }]).blocked, true);
});
test("immutable current proof binds owned source, chosen weakness, clock and scoped null UUIDs", () => {
  const a = { items: [flail()], system: state() },
    p = attack(a.system, a.items).cheapShot,
    c = {
      checkKind: "attack",
      weaponUuid: a.items[0].uuid,
      weaponProficiency: "exoticBlunt",
      attackContext: { attackAction: "standard" },
      combat: clock()
    };
  a.items.get = id => a.items.find(i => i.id === id);
  validate(a, p, c);
  const local = structuredClone(p);
  local.flailBasics.weapons[0].uuid = null;
  validate(a, local, c);
  const foreign = structuredClone(p);
  foreign.flailBasics.weapons[0].uuid = "Actor.other.Item.sword";
  assert.throws(() => validate(a, foreign, c));
  a.items[0].system.equipped = false;
  assert.throws(() => validate(a, p, c));
  a.items[0].system.equipped = true;
  assert.throws(() => validate(a, p, { ...c, combat: { ...clock(), round: 4 } }));
  validate(a, null, c);
});
globalThis.fromUuid = async () => ({
  uuid: "Actor.target",
  type: "agent",
  isOwner: true,
  name: "Actual opponent",
  system: { cheapShots: [] },
  usagePeriods: {}
});
const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs");
foundry.utils.escapeHTML = String;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let hook = async () => {},
  posts = [];
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    await hook();
    return this;
  }
  async toMessage(d) {
    posts.push(d);
    return d;
  }
};
function actor() {
  const a = makeFatigueActor();
  a.uuid = "Actor.feint";
  a.flags = {};
  a.items = [flail()];
  a.items.get = id => a.items.find(i => i.id === id);
  a.system = prep(state(), a.items);
  a.mentalLeapCombatContext = clock;
  return a;
}
test("actual Actor posts authoritative Cheap Shot proof and rejects source or choice drift during RNG", async () => {
  hook = async () => {};
  let a = actor(),
    m = await a.rollAttack(a.items[0], opts());
  assert.equal(m.flags.spycraft2.attackContext.cheapShot.gearBonus, 2);
  assert.equal(m.flags.spycraft2.rollData.total, 3);
  for (const kind of ["feat", "family", "choice", "readiness"]) {
    a = actor();
    posts = [];
    const request = opts();
    hook = async () => {
      if (kind === "feat") a.system.activeFeatNames = [];
      if (kind === "family") a.items[0].system.meleeFamily = "";
      if (kind === "readiness") a.items[0].system.equipped = false;
      if (kind === "choice") request.cheapShot.choice = "str";
      a.system = prep(a.system, a.items);
    };
    await assert.rejects(a.rollAttack(a.items[0], request), /changed/);
    assert.equal(posts.length, 0);
  }
  hook = async () => {};
});

test("Cheap Shot remains a permitted trick on a properly reserved final Standard Attack outside the acting Count (p.329)", () => {
  const r = attack(state(), [flail()], opts({ freeFinalAttack: true, cheapShotCombat: { ...clock(), turn: 1 } }));
  assert.equal(r.blocked, false);
  assert.equal(r.cheapShot.finalAttack, true);
  assert.equal(r.cheapShot.attackBonus, -2);
});
test("shared final-attack controls parse an explicit Cheap Shot declaration and keep its actual opponent fixed", async () => {
  const { standardAttackContextInput } = await import("../module/apps/standard-attack-context.mjs"),
    { validateCheapShotTarget } = await import("../module/apps/cheap-shot.mjs");
  const prior = game.actors;
  game.actors = [{ uuid: "Actor.target", type: "agent", name: "Actual opponent", isOwner: true }];
  try {
    const raw = {
        declareCheapShot: true,
        cheapShotChoice: "speed",
        cheapShotTargetUuid: "Actor.target",
        cheapShotLegalConfirmed: true,
        cheapShotEligibleConfirmed: true
      },
      parsed = standardAttackContextInput(raw);
    assert.equal(parsed.cheapShot.choice, "speed");
    assert.equal(parsed.cheapShot.targetName, "Actual opponent");
    for (const patch of [
      { declareCheapShot: "true" },
      { cheapShotChoice: "defense" },
      { cheapShotEligibleConfirmed: false }
    ])
      assert.throws(() => standardAttackContextInput({ ...raw, ...patch }));
    const a = actor();
    await assert.rejects(
      validateCheapShotTarget(a, parsed.cheapShot, { targetUuid: "Actor.other" }),
      /actual opponent/
    );
    await assert.rejects(a.rollAttack(a.items[0], { ...opts(), freeFinalAttack: true }), /final-attack control/);
    a.system.resourceUses = { finalAttackRound: { epoch: "initial", used: 1 } };
    a._finalAttackReservation = { record: { epoch: "initial", used: 1 }, nauseated: false };
    a.mentalLeapCombatContext = () => ({ ...clock(), turn: 1 });
    hook = async () => {};
    const m = await a.rollAttack(a.items[0], {
      ...opts(),
      freeFinalAttack: true,
      finalAttack: { id: "final", opponentUuid: "Actor.target" },
      validateFinalAttack: () => {}
    });
    assert.equal(m.flags.spycraft2.attackContext.cheapShot.finalAttack, true);
    assert.equal(m.flags.spycraft2.finalAttackRound.used, 1);
    const previousTargets = game.user.targets;
    try {
      const synthetic = {
        uuid: "Scene.qa.Token.qa.Actor.target",
        type: "npc",
        name: "Synthetic opponent",
        isOwner: true
      };
      game.actors = [];
      game.user.targets = new Set([{ actor: synthetic }]);
      const selected = standardAttackContextInput({ ...raw, cheapShotTargetUuid: synthetic.uuid });
      assert.equal(selected.cheapShot.targetUuid, synthetic.uuid);
      assert.equal(selected.cheapShot.targetName, synthetic.name);
    } finally {
      game.user.targets = previousTargets;
    }
  } finally {
    game.actors = prior;
  }
});

test("only authenticated provisional improvised destruction may be viewed as available for a replacement Cheap Shot", () => {
  const a = actor();
  a.items[0].system.improvised = true;
  a.system = prep(a.system, a.items);
  const proof = attack(a.system, a.items).cheapShot,
    c = {
      checkKind: "attack",
      weaponUuid: a.items[0].uuid,
      weaponProficiency: "exoticBlunt",
      attackContext: { attackAction: "standard" },
      combat: clock(),
      rerollOf: "ChatMessage.original"
    },
    original = {
      uuid: c.rerollOf,
      flags: {
        spycraft2: {
          actorUuid: a.uuid,
          weaponUuid: a.items[0].uuid,
          checkKind: "attack",
          improvised: true,
          errorConfirmed: true,
          attackContext: { cheapShot: proof }
        }
      }
    },
    prior = globalThis.fromUuidSync;
  globalThis.fromUuidSync = id => (id === c.rerollOf ? original : null);
  try {
    a.items[0].system.destroyed = true;
    a.items[0].system.destroyedByRoll = c.rerollOf;
    validate(a, proof, c);
    assert.equal(a.items[0].system.destroyed, true);
    original.flags.spycraft2.actorUuid = "Actor.foreign";
    assert.throws(() => validate(a, proof, c));
    original.flags.spycraft2.actorUuid = a.uuid;
    original.flags.spycraft2.criticalFailure = true;
    assert.throws(() => validate(a, proof, c));
  } finally {
    globalThis.fromUuidSync = prior;
  }
});
