import test from "node:test";
import assert from "node:assert/strict";
import { npcBuiltInPlan, npcWeaponTraining, validateNpcWeaponTraining } from "../module/rules/npc-weapons.mjs";
import { npcDefensePlan } from "../module/rules/npc-defense.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
import { validateReachWeaponProof } from "../module/rules/reach-weapon.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const weapon = {
  id: "blade",
  name: "Wrist blade",
  proficiency: "edged",
  damage: "1d6",
  errorThreat: "1/20",
  sizeHands: "S/1h",
  qualities: "FIN"
};
const owned = [{ id: "blade", uuid: "Actor.npc.Item.blade", name: weapon.name, type: "weapon", system: weapon }];
const system = (qualities = []) => {
  const npcProfile = { enabled: true, qualities };
  return {
    size: "Medium",
    bab: 3,
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 18, mod: 4 } },
    activeFeatNames: [],
    classLevels: {},
    npcProfile,
    npcBuiltIn: npcBuiltInPlan(npcProfile, owned)
  };
};

test("NPC carried-weapon proficiency yields to Non-Combatant and actual built-in exceptions", () => {
  const ordinary = weaponAttack(system(), weapon, cfg, "npc");
  const untrained = system([{ id: "non-combatant" }]);
  const attack = weaponAttack(untrained, weapon, cfg, "npc");
  assert.equal(attack.total, ordinary.total - 4);
  assert.equal(attack.error, ordinary.error + 2);
  const actor = { type: "npc", system: untrained, items: owned };
  assert.doesNotThrow(() =>
    validateReachWeaponProof(actor, attack.reach.evidence, {
      checkKind: "attack",
      weaponUuid: owned[0].uuid,
      weaponProficiency: weapon.proficiency,
      attackContext: { reach: attack.reach.evidence }
    })
  );
  assert.equal(weaponDamage(untrained, { ...weapon, useFinesse: true }, {}, "npc").bonus, 2);
  for (const id of ["augmented", "natural-attack"]) {
    const sys = system([{ id: "non-combatant" }, { id, entryId: "source", details: weapon.name }]);
    assert.equal(weaponAttack(sys, weapon, cfg, "npc").total, ordinary.total);
    assert.equal(weaponAttack(sys, weapon, cfg, "npc").error, ordinary.error);
    assert.equal(weaponDamage(sys, { ...weapon, useFinesse: true }, {}, "npc").bonus, 4);
    assert.equal(npcWeaponTraining(sys, { id: "other" }).trained, false);
  }
});

test("built-in choices are explicit, unique, typed and do not mutate owned data", () => {
  const profile = { enabled: true, qualities: [{ id: "natural-attack", details: " Wrist Blade " }] };
  const original = structuredClone({ profile, owned });
  assert.equal(npcBuiltInPlan(profile, owned).sources[0].itemId, "blade");
  assert.equal(npcBuiltInPlan(profile, [...owned, { ...owned[0], id: "duplicate" }]).sources.length, 0);
  assert.equal(npcBuiltInPlan(profile, [{ ...owned[0], type: "gear" }]).unresolved.length, 1);
  assert.equal(npcBuiltInPlan({ ...profile, enabled: false }, owned).warnings.length, 0);
  const unresolved = system([{ id: "non-combatant" }, { id: "augmented", details: "Missing item" }]);
  assert.equal(weaponAttack(unresolved, weapon, cfg, "npc").blocked, true);
  assert.deepEqual({ profile, owned }, original);
});

test("an NPC attack keeps its actual proficiency evidence and rejects a changed source after dice", () => {
  const actor = {
    type: "npc",
    system: system([{ id: "non-combatant" }, { id: "natural-attack", details: weapon.name }]),
    items: owned
  };
  const context = { actor, checkKind: "attack", options: { weaponUuid: owned[0].uuid }, phase: "before" };
  validateNpcWeaponTraining(context);
  assert.equal(rollPipeline.flags(context).npcWeaponTraining.source.itemId, "blade");
  actor.system = system([{ id: "non-combatant" }]);
  context.phase = "after";
  assert.throws(() => validateNpcWeaponTraining(context), /changed during this attack/);
  assert.equal(context.npcTraining.trained, true, "original dice evidence remains intact");
  actor.items = [];
  assert.throws(() => validateNpcWeaponTraining(context), /original weapon is no longer present/);
});

test("vulnerable NPC Defense drops positive Dexterity and dodge but retains penalties and other modifiers", () => {
  const sys = { abilities: { dex: { value: 18, mod: 4 } }, defenseExtras: { misc: 2, dodge: 3 } };
  assert.equal(npcDefensePlan(sys).adjustment, 5);
  sys.conditionContext = { held: true };
  assert.equal(npcDefensePlan(sys).adjustment, -2);
  assert.equal(npcDefensePlan(sys).dodgeLost, 3);
  sys.abilities.dex.mod = -2;
  sys.defenseExtras.dodge = -1;
  assert.equal(npcDefensePlan(sys).adjustment, 1);
  assert.equal(npcDefensePlan(sys).dexterity, -2);
  sys.defenseExtras.dodge = 3;
  sys.abilities.dex.mod = 4;
  sys.conditionContext = { flatFooted: true };
  sys.uncannyDodge = { grade: 1 };
  assert.equal(npcDefensePlan(sys).adjustment, 2, "Uncanny Dodge I preserves Dexterity, not dodge bonuses");
  sys.uncannyDodge.grade = 5;
  assert.equal(npcDefensePlan(sys).adjustment, 5);
});
