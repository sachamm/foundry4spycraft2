import test from "node:test";
import assert from "node:assert/strict";
import { standardAttackContextInput as input } from "../module/apps/standard-attack-context.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const system = () => ({
    size: "Medium",
    bab: 4,
    abilities: { str: { mod: 1, value: 12 }, dex: { mod: 1, value: 12 } },
    activeFeatNames: [],
    classLevels: {},
    proficiencyTotals: { handgun: { proficient: true } },
    conditionContext: {}
  }),
  weapon = {
    proficiency: "handgun",
    sizeHands: "D/1h",
    weaponCategory: "serviceRevolver",
    fireModes: ["single"],
    fireMode: "single",
    range: 50,
    recoil: 14,
    errorThreat: "1/20"
  };
test("shared declarations preserve exact checked circumstances and prior Aim/Brace, while refusing fabricated boolean/distance/select values", () => {
  const parsed = input({
    targetAnimal: true,
    aimed: true,
    braced: true,
    stableSurface: true,
    distanceFeet: "30",
    ambientLight: "dim",
    weaponId: "ignored",
    oneInAMillion: true,
    freeFinalAttack: true,
    attackAction: "autofire"
  });
  assert.equal(parsed.distanceFeet, 30);
  assert.equal(parsed.targetAnimal, true);
  assert.equal(parsed.aimed, true);
  assert.equal(parsed.attackAction, undefined);
  assert.equal(parsed.oneInAMillion, undefined);
  assert.equal(parsed.freeFinalAttack, undefined);
  for (const value of ["true", 1, {}, null]) assert.throws(() => input({ aimed: value }));
  for (const value of [true, -1, Infinity, "oops"]) assert.throws(() => input({ distanceFeet: value }));
  assert.equal(input({ distanceFeet: "  " }).distanceFeet, undefined);
  assert.throws(() => input({ obscurant: "unknown" }));
  assert.throws(() => input({ ambientLight: "unknown" }));
});
test("ordinary Standard Attack benefits apply once to final/Disarm contexts without creating setup actions: prior Aim, valid Brace, recoil and current character options remain authoritative", () => {
  const s = system(),
    base = weaponAttack(s, weapon, cfg, "agent", { attackAction: "standard", distanceFeet: 30 }),
    prior = weaponAttack(s, weapon, cfg, "agent", {
      ...input({ distanceFeet: "30", aimed: true, braced: true, stableSurface: true }),
      attackAction: "standard"
    });
  assert.equal(prior.stance.aimBonus, 1);
  assert.equal(prior.stance.braceBonus, 1);
  assert.equal(prior.recoilPenalty, 0);
  assert.equal(prior.total - base.total, 3);
  const noSurface = weaponAttack(s, weapon, cfg, "agent", {
    ...input({ braced: true, distanceFeet: 30 }),
    attackAction: "standard"
  });
  assert.equal(noSurface.blocked, true);
  s.activeFeatNames = ["Marksmanship Basics", "Marksmanship Mastery"];
  const trained = weaponAttack(s, weapon, cfg, "agent", {
    ...input({ aimed: true, braced: true, distanceFeet: 30 }),
    attackAction: "standard"
  });
  assert.equal(trained.blocked, false);
  assert.equal(trained.stance.aimBonus, 2);
  assert.equal(trained.stance.braceBonus, 1);
});
test("target and sensory declarations preserve real conditions; false extra-blindness cannot remove an actual blinded source", () => {
  const s = system();
  s.conditionContext.blinded = true;
  const p = weaponAttack(s, weapon, cfg, "agent", {
    ...input({ distanceFeet: 30, blinded: false, targetProneNonAdjacent: true }),
    attackAction: "standard"
  });
  assert.equal(p.targetPosturePenalty, -2);
  assert.equal(p.sensoryConditions.blinded, true);
});
