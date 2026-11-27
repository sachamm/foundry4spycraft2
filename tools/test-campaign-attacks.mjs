import test from "node:test";
import assert from "node:assert/strict";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { activeQualities, campaignEffects } from "../module/rules/gc/campaign.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { attackBreakdown } from "../module/rules/bonus-breakdown.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import "./fixtures/fatigue-actor.mjs";
const { SpycraftActor } = await import("../module/documents/actor.mjs");
foundry.utils.escapeHTML = String;
game.user = { isGM: true, targets: new Set() };
const system = () => ({
  bab: 5,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }])),
  unarmed: { die: 3, damageBonus: 2, threat: 20 },
  activeFeatNames: [],
  conditionContext: {},
  classLevels: {},
  classOptionSelections: []
});
const weapon = proficiency => ({
  proficiency,
  sizeHands: "S/1h",
  damage: "1d6",
  errorThreat: "1/20",
  range: 50,
  fireModes: ["single"],
  fireMode: "single",
  recoil: 0
});

test("Subtle and Violent reach every PC/NPC weapon proficiency once without changing error or damage", () => {
  const effects = campaignEffects(activeQualities(["subtle", "violent"], ["subtle", "violent"])).effects;
  assert.deepEqual(effects, { attackModifier: -1, attackThreatIncrease: 2 });
  for (const type of ["agent", "npc"])
    for (const proficiency of Object.keys(cfg.proficiencies)) {
      const plain = system(),
        changed = { ...system(), campaignEffects: effects },
        w = weapon(proficiency);
      const a = weaponAttack(plain, w, cfg, type),
        b = weaponAttack(changed, w, cfg, type);
      assert.equal(b.total, a.total - 1, `${type}/${proficiency}`);
      assert.equal(b.threat, a.threat - 2);
      assert.equal(b.error, a.error);
      assert.equal(weaponDamage(changed, w).bonus, weaponDamage(plain, w).bonus);
      assert.match(b.notes, /Violent campaign/);
      assert.equal(b.modifiers.filter(r => r.label === "Subtle campaign quality").length, 1);
    }
});

test("Violent combines with feat threat increments, preserves no-threat attacks and stops at natural one", () => {
  const s = {
    ...system(),
    campaignEffects: { attackThreatIncrease: 2 },
    activeFeatNames: ["Finesse Mastery", "Finesse Supremacy"]
  };
  assert.equal(weaponAttack(s, weapon("edged"), cfg).threat, 16);
  assert.equal(weaponAttack(s, { ...weapon("edged"), errorThreat: "1/—", threat: 0 }, cfg).threat, 0);
  assert.equal(weaponAttack(s, { ...weapon("edged"), errorThreat: "1/2-20" }, cfg).threat, 1);
});

test("Subtle appears once in prepared PC attack figures and their labelled breakdown", () => {
  const source = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [],
    misc: {}
  };
  const normal = computeAgent(structuredClone(source), [], cfg),
    changed = computeAgent(structuredClone(source), [], cfg, { campaignEffects: { attackModifier: -1 } });
  for (const key of ["unarmed", "melee", "ranged"]) {
    assert.equal(changed.attack[key], normal.attack[key] - 1);
    const rows = attackBreakdown(changed, key);
    assert.equal(rows.find(r => r.label === "Subtle campaign quality").value, -1);
    assert.equal(
      rows.reduce((sum, r) => sum + r.value, 0),
      changed.attack[key]
    );
  }
});

function actor(type = "agent") {
  const a = {
    uuid: "Actor.campaign",
    type,
    isOwner: true,
    system: { ...system(), campaignEffects: { attackModifier: -1, attackThreatIncrease: 2 } },
    getRollData: () => ({})
  };
  a.items = [
    { id: "blade", uuid: "Actor.campaign.Item.blade", type: "weapon", name: "Blade", system: weapon("edged") }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.weaponContext = (_w, o) => o;
  a.weaponAttack = (w, o) => weaponAttack(a.system, w.system, cfg, a.type, o);
  a.rollCheck = async (formula, data, options) => {
    await options.validateAttackContext();
    await a.hook?.();
    await options.validateAttackContext();
    return { formula, data, options };
  };
  a.rollAttack = (w, o) => SpycraftActor.prototype.rollAttack.call(a, w, o);
  return a;
}
test("actual PC and NPC attacks save their policy and reject campaign changes during RNG", async () => {
  for (const type of ["agent", "npc"]) {
    const a = actor(type),
      preview = a.weaponAttack(a.items[0]),
      r = await a.rollAttack(a.items[0], { targetAnimal: false });
    assert.equal(r.data.total, preview.total);
    assert.equal(r.options.threat, 18);
    assert.deepEqual(r.options.attackContext.campaignAttackPolicy, { attackModifier: -1, attackThreatIncrease: 2 });
    const evidence = rollEvidence(r.options);
    r.options.attackContext.campaignAttackPolicy.attackThreatIncrease = 0;
    assert.equal(rollEvidenceMatches(evidence, r.options), false);
    for (const key of ["attackModifier", "attackThreatIncrease"]) {
      const b = actor(type);
      b.hook = () => {
        b.system.campaignEffects[key] = 0;
      };
      await assert.rejects(b.rollAttack(b.items[0], { targetAnimal: false }), /campaign attack modifiers changed/);
    }
  }
});
