import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  fightDefensivelyPlan,
  fightDefensivelyState,
  equilibriumSupremacyDodge,
  tribesmanDefense
} from "../module/rules/fight-defensively.mjs";
import { activeRoundStates } from "../module/apps/round-state-effects.mjs";

const context = () => ({ id: "combat", started: true, round: 2, turn: 1, combatantId: "own", ownTurnIndex: 1 });
const record = () => ({ version: 1, combatId: "combat", combatantId: "own", startRound: 2, dueRound: 3 });

function calculate({
  declared = false,
  feats = [],
  specialty = null,
  combat = context(),
  extra = {},
  tree = null
} = {}) {
  const cls = {
    id: "test",
    type: "class",
    name: "Test",
    system: {
      identifier: "test",
      skillPoints: 4,
      vitalityDie: 6,
      classSkills: [],
      table: [{ level: 1, bab: 1, defense: 7, fort: 0, ref: 0, will: 0 }]
    }
  };
  const items = [
    cls,
    ...feats.map((name, i) => ({
      id: "f" + i,
      type: "feat",
      name,
      system: {
        granted: true,
        bonuses: [],
        tree: tree?.(name) ?? (name.startsWith("Equilibrium") || name === "Covert X" ? "covert" : "")
      }
    })),
    ...(specialty
      ? [{ id: "o", type: "origin", name: specialty, system: { originType: "specialty", bonuses: [], grants: [] } }]
      : [])
  ];
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {},
      conditionContext: {},
      fightDefensivelyCombatContext: combat,
      fightDefensively: declared ? record() : null,
      ...extra
    },
    items,
    cfg
  );
}

test("Fight Defensively: a free action on the own Count, confirmed, not while enraged, not twice", () => {
  const plan = fightDefensivelyPlan({}, context(), { confirmed: true });
  assert.deepEqual([plan.startRound, plan.dueRound, plan.combatantId], [2, 3, "own"]);
  assert.throws(() => fightDefensivelyPlan({}, context()), /Confirm/);
  assert.throws(() => fightDefensivelyPlan({}, { ...context(), turn: 0 }), /Initiative Count/);
  assert.throws(() => fightDefensivelyPlan({}, context(), { confirmed: true, enraged: true }), /enraged/);
  assert.throws(() => fightDefensivelyPlan({ fightDefensively: record() }, context(), { confirmed: true }), /already/);
});

test("lasts one full round, to the start of the next own Count", () => {
  for (const round of [1, 2, 3, 4])
    for (const turn of [0, 1, 2])
      assert.equal(
        fightDefensivelyState({
          fightDefensively: record(),
          fightDefensivelyCombatContext: { ...context(), round, turn }
        }).active,
        round === 2 || (round === 3 && turn < 1)
      );
});

test("−4 to attacks and skills, +2 dodge; saves untouched", () => {
  const normal = calculate(),
    s = calculate({ declared: true });
  assert.equal(s.defense.total, normal.defense.total + 2);
  assert.equal(s.attack.melee, normal.attack.melee - 4);
  assert.equal(s.skillTotals.notice.total, normal.skillTotals.notice.total - 4);
  assert.deepEqual(s.saves, normal.saves);
  assert.deepEqual(
    activeRoundStates(s).map(r => r.key),
    ["fightDefensively"]
  );
});

test("Equilibrium Supremacy adds half the Covert feats as dodge; Tribesman adds 1 plus 1 per 5 levels", () => {
  const sel = n => ({
    activeFeatNames: ["Equilibrium Supremacy"],
    activeFeatSelections: Array.from({ length: n }, (_, i) => ({ name: "C" + i, tree: "covert" }))
  });
  assert.deepEqual(
    [1, 2, 3, 5].map(n => equilibriumSupremacyDodge(sel(n))),
    [1, 1, 2, 3]
  );
  assert.equal(equilibriumSupremacyDodge({ ...sel(4), activeFeatNames: [] }), 0);
  assert.deepEqual(
    [1, 4, 5, 9, 10, 20].map(level => tribesmanDefense({ specialtyName: "Tribesman", level })),
    [1, 1, 2, 2, 3, 5]
  );
  assert.equal(tribesmanDefense({ specialtyName: "Wanderer", level: 10 }), 0);
  const normal = calculate(),
    eq = calculate({ declared: true, feats: ["Equilibrium Basics", "Equilibrium Mastery", "Equilibrium Supremacy"] });
  assert.equal(eq.fightDefensivelyState.equilibrium, 2);
  assert.equal(
    eq.defense.total -
      calculate({ feats: ["Equilibrium Basics", "Equilibrium Mastery", "Equilibrium Supremacy"] }).defense.total,
    4
  );
  const tribe = calculate({ declared: true, specialty: "Tribesman" });
  assert.equal(tribe.defense.total, calculate({ specialty: "Tribesman" }).defense.total + 3);
  assert.equal(normal.fightDefensivelyState.active, false);
});

test("Not the Face: Charisma-modifier DR against melee and unarmed attacks only while defending", async () => {
  const { notTheFaceDR } = await import("../module/rules/not-the-face.mjs");
  const owner = (fd, td) => ({
    activeFeatNames: ["Not the Face"],
    fightDefensivelyState: { active: fd },
    totalDefenseState: { active: td }
  });
  assert.equal(notTheFaceDR(owner(true, false), 3), 3);
  assert.equal(notTheFaceDR(owner(false, true), 3), 3);
  assert.equal(notTheFaceDR(owner(false, false), 3), 0);
  assert.equal(notTheFaceDR(owner(true, false), -1), 0);
  assert.equal(notTheFaceDR({ ...owner(true, true), activeFeatNames: [] }, 3), 0);
  const plain = calculate({ feats: ["Not the Face"] }),
    s = calculate({ declared: true, feats: ["Not the Face"] });
  assert.equal(s.notTheFaceDR, 2, "Charisma 14");
  assert.equal(s.armorDRByAttack.unarmed, plain.armorDRByAttack.unarmed + 2);
  assert.equal(s.armorDRByAttack.meleeWeapon, plain.armorDRByAttack.meleeWeapon + 2);
  assert.equal(s.armorDRByAttack.rangedWeapon, plain.armorDRByAttack.rangedWeapon);
  assert.equal(s.armorDRByAttack.hurledWeapon, plain.armorDRByAttack.hurledWeapon);
});

test("Death Ride: DR equal to the Chase feats only while operating a vehicle", () => {
  const feats = ["Death Ride", "Daredevil", "Demolition Derby"],
    tree = () => "chase";
  const off = calculate({ feats, tree }),
    on = calculate({ feats, tree, extra: { operatingVehicle: true } });
  assert.equal(off.deathRideDR, 0);
  assert.equal(on.deathRideDR, 3);
  assert.equal(on.dr.melee, off.dr.melee + 3);
  assert.equal(on.armorDRByAttack.rangedWeapon, off.armorDRByAttack.rangedWeapon + 3);
});

test("Sticky Fingers: DR 5 against an adjacent opponent during Total Defense", async () => {
  const { incomingDefensePlan } = await import("../module/rules/defense.mjs");
  const s = calculate({ feats: ["Rolling Supremacy"] });
  s.totalDefenseState = { active: true };
  const near = incomingDefensePlan(s, { adjacent: true }),
    far = incomingDefensePlan(s, {});
  assert.equal(near.stickyFingersDR, 5);
  assert.equal(near.listedDR.meleeWeapon, far.listedDR.meleeWeapon + 5);
  assert.equal(far.stickyFingersDR, 0);
});
