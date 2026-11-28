import test from "node:test";
import assert from "node:assert/strict";
import { meleeFirePlan as plan, cqbRangedWeapon } from "../module/rules/cqb.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { standardAttackContextInput } from "../module/apps/standard-attack-context.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import "./fixtures/fatigue-actor.mjs"; // sets up the Foundry stand-ins this file relies on

const { SpycraftActor } = await import("../module/documents/actor.mjs");
const sys = () => ({
    activeFeatNames: ["CQB Basics", "CQB Mastery"],
    cqbRange: 30,
    bab: 6,
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
    conditionContext: {},
    proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }])),
    classLevels: {},
    classOptionSelections: [],
    unarmed: { die: 3, damageBonus: 2 }
  }),
  weapon = (proficiency = "handgun") => ({
    proficiency,
    weaponCategory: "servicePistol",
    sizeHands: "D/1h",
    range: 50,
    fireModes: ["single"],
    fireMode: "single",
    recoil: 0,
    errorThreat: "1/20",
    damage: "1d6"
  });
test("all into/out combinations explicitly stack independently; Basics waives only out, Mastery only into, at any distance", () => {
  for (const basics of [false, true])
    for (const mastery of [false, true])
      for (const out of [false, true])
        for (const into of [false, true])
          for (const distanceFeet of [5, 100]) {
            const s = {
                ...sys(),
                activeFeatNames: [...(basics ? ["CQB Basics"] : []), ...(mastery ? ["CQB Mastery"] : [])]
              },
              p = plan(s, weapon(), { firingOutOfMelee: out, firingIntoMelee: into, distanceFeet }),
              count = Number(out && !basics) + Number(into && !mastery);
            assert.equal(p.attackPenalty, -4 * count);
            assert.equal(p.errorIncrease, 2 * count);
            assert.equal(p.outWaived, out && basics);
            assert.equal(p.intoWaived, into && mastery);
          }
});
test("actual attack totals receive the declared penalties once across every ranged proficiency; melee, unarmed and placement checks receive none", () => {
  for (const key of Object.keys(cfg.proficiencies)) {
    const s = { ...sys(), activeFeatNames: [] },
      w = weapon(key),
      o = { attackAction: "standard", distanceFeet: 5 },
      a = weaponAttack(s, w, cfg, "agent", o),
      b = weaponAttack(s, w, cfg, "agent", { ...o, firingOutOfMelee: true, firingIntoMelee: true }),
      ranged = cqbRangedWeapon(w);
    assert.equal(b.total - a.total, ranged ? -8 : 0, key);
    assert.equal(b.error - a.error, ranged ? 4 : 0, key);
    assert.equal(b.threat, a.threat, key);
    assert.deepEqual(
      weaponDamage(s, w, o),
      weaponDamage(s, w, { ...o, firingOutOfMelee: true, firingIntoMelee: true }),
      key
    );
  }
});
test("melee-fire error increases combine with Disarm and separate untrained/Proficiency modifiers before minimum-limited reductions", () => {
  const s = { ...sys(), activeFeatNames: [] },
    o = {
      attackAction: "standard",
      distanceFeet: 5,
      firingOutOfMelee: true,
      firingIntoMelee: true,
      disarm: {
        confirmed: true,
        lineOfSightConfirmed: true,
        rangeConfirmed: true,
        opponentArmedConfirmed: true,
        opponentWeaponSize: "Tiny"
      }
    };
  assert.equal(weaponAttack(s, weapon(), cfg, "agent", o).error, 7);
  s.proficiencyTotals = {};
  assert.equal(weaponAttack(s, weapon(), cfg, "agent", o).error, 11);
  s.activeFeatNames = ["Grenade Basics"];
  s.proficiencyTotals.hurled = { proficient: true };
  assert.equal(
    weaponAttack(s, { ...weapon("hurled"), name: "Grenade" }, cfg, "agent", { ...o, disarm: undefined }).error,
    3
  );
});
test("the typed shared inputs refuse truthy strings and preserve both factual flags without introducing damage or skill modifiers", () => {
  const p = standardAttackContextInput({ firingOutOfMelee: true, firingIntoMelee: true });
  assert.equal(p.firingOutOfMelee, true);
  assert.equal(p.firingIntoMelee, true);
  for (const key of ["firingOutOfMelee", "firingIntoMelee"])
    for (const value of ["true", 1, null]) {
      assert.throws(() => standardAttackContextInput({ [key]: value }));
      assert.throws(() => plan(sys(), weapon(), { [key]: value }));
    }
});
let response = null;
foundry.utils.escapeHTML = String;
foundry.applications.api.DialogV2.input = async () => {
  return response;
};
game.user = { isGM: true, targets: new Set() };
game.actors = [];
function actor() {
  response = null;
  const a = {
    uuid: "Actor.cqb",
    type: "agent",
    isOwner: true,
    system: sys(),
    items: [{ id: "gun", uuid: "Actor.cqb.Item.gun", name: "Handgun", type: "weapon", system: weapon() }],
    weaponContext: (w, o) => o,
    getRollData: () => ({})
  };
  a.items.get = id => a.items.find(i => i.id === id);
  a.weaponAttack = (w, o) => weaponAttack(a.system, w.system, cfg, "agent", o);
  a.rollCheck = async (formula, data, options) => {
    await options.validateAttackContext?.();
    await options.validateCQBRange?.();
    await a.hook?.();
    await options.validateAttackContext?.();
    await options.validateCQBRange?.();
    return { formula, data, options };
  };
  a.rollAttack = (w, o) => SpycraftActor.prototype.rollAttack.call(a, w, o);
  a.rollDamage = (w, o) => SpycraftActor.prototype.rollDamage.call(a, w, o);
  return a;
}

test("normal and class/API attack roots freeze both melee-fire facts and source waivers alongside independent CQB range bonuses", async () => {
  let a = actor();
  a.system.activeFeatNames = [];
  const base = await a.rollAttack(a.items[0], {
    attackAction: "standard",
    distanceFeet: 5,
    targetAnimal: false,
    firingOutOfMelee: true,
    firingIntoMelee: true
  });
  assert.equal(base.data.total, 0);
  assert.equal(base.options.error, 5);
  assert.equal(base.options.attackContext.meleeFire.attackPenalty, -8);
  a = actor();
  const waived = await a.rollAttack(a.items[0], {
    attackAction: "standard",
    distanceFeet: 100,
    targetAnimal: false,
    firingOutOfMelee: true,
    firingIntoMelee: true
  });
  assert.equal(waived.options.error, 1);
  assert.equal(waived.options.attackContext.meleeFire.outWaived, true);
  assert.equal(waived.options.attackContext.meleeFire.intoWaived, true);
  assert.equal(waived.options.attackContext.cqbRange.within, false);
});
test("the ordinary Gear context forwards both flags and changes only the scope permitted by each earned CQB feat", async () => {
  const a = actor();
  a.system.activeFeatNames = ["CQB Basics"];
  response = {
    distanceFeet: "10",
    targetOpponentConfirmed: true,
    targetAnimal: false,
    firingOutOfMelee: true,
    firingIntoMelee: true
  };
  const m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(m.data.total, 5);
  assert.equal(m.options.error, 3);
  assert.equal(m.options.attackContext.meleeFire.outWaived, true);
  assert.equal(m.options.attackContext.meleeFire.intoWaived, false);
});
test("melee-fire source or weapon changes during RNG invalidate the actual attack even without an initial CQB range bonus, while existing Disarm-style validators still run", async () => {
  for (const change of [a => (a.system.activeFeatNames = ["CQB Mastery"]), a => a.items.splice(0)]) {
    const a = actor();
    a.system.activeFeatNames = [];
    a.hook = () => change(a);
    await assert.rejects(
      a.rollAttack(a.items[0], { distanceFeet: 10, targetAnimal: false, firingIntoMelee: true }),
      /melee-fire|attack weapon no longer exists/
    );
  }
  const a = actor();
  let checks = 0;
  await a.rollAttack(a.items[0], {
    distanceFeet: 10,
    targetOpponentConfirmed: true,
    targetAnimal: false,
    firingIntoMelee: true,
    validateAttackContext: () => {
      checks++;
    }
  });
  assert.equal(checks, 2);
});
test("frozen outcome evidence cannot accept changed firing facts or waiver sources, and unspecified facts preserve the original unengaged calculation", async () => {
  const a = actor(),
    m = await a.rollAttack(a.items[0], {
      distanceFeet: 10,
      targetOpponentConfirmed: true,
      targetAnimal: false,
      firingIntoMelee: true
    }),
    e = rollEvidence(m.options);
  m.options.attackContext.meleeFire.intoWaived = false;
  assert.equal(rollEvidenceMatches(e, m.options), false);
  const s = { ...sys(), activeFeatNames: [] },
    w = weapon();
  assert.equal(
    weaponAttack(s, w, cfg).total,
    weaponAttack(s, w, cfg, "agent", { firingOutOfMelee: false, firingIntoMelee: false }).total
  );
});
