import test from "node:test";
import assert from "node:assert/strict";
import { npcWeaponTraining } from "../module/rules/npc-weapons.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { grappleDamagePlan, grappleDamageAward } from "../module/rules/grapple-damage.mjs";
import { grappleBenefitEligibility } from "../module/rules/combat-actions.mjs";
import { damageApplicationKey } from "../module/rules/attack-damage-hits.mjs";
import {
  reserveGrappleDamage,
  validateGrappleDamage,
  recordGrappleDamageDice,
  settleGrappleDamageRoll,
  rememberGrappleDamage,
  reviewGrappleDamage,
  validateGrappleDamageDelivery
} from "../module/documents/actor/grapple-damage.mjs";
const system = (strength = 2) => ({
  size: "Medium",
  abilities: { str: { mod: strength } },
  activeFeatNames: [],
  classOptionSelections: [],
  unarmed: { die: 4, extraDice: 1, damageBonus: strength + 3 },
  proficiencyTotals: { unarmed: { proficient: true }, edged: { proficient: true } }
});
test("Sprawl, Throw and Injure preserve their actual base damage and the extra Strength minimum", () => {
  for (const strength of [-4, -1, 0, 1, 4]) {
    const s = system(strength),
      injure = grappleDamagePlan(s, "injure"),
      thrown = grappleDamagePlan(s, "throw");
    assert.match(injure.formula, /2d4/);
    assert.equal(
      thrown.formula,
      `${injure.formula} + (${Math.max(1, strength)})`,
      "Throw adds its Strength bonus after standard unarmed minimum damage"
    );
    assert.equal(thrown.profile.kind, "lethal");
    assert.equal(grappleDamagePlan(s, "sprawl").formula, `max(0, 1d4 + (${strength}))`);
  }
  const weapon = {
    id: "blade",
    uuid: "Actor.winner.Item.blade",
    type: "weapon",
    system: { proficiency: "edged", damage: "1d6 lethal", sizeHands: "Tiny/1h", equipped: true }
  };
  assert.equal(grappleDamagePlan(system(), "injure", { weapon }).profile.kind, "lethal");
  assert.throws(() => grappleDamagePlan(system(), "injure", { weapon, kind: "subdual" }), /conversion/);
  assert.equal(
    grappleDamagePlan(system(), "injure", { weapon, kind: "subdual", conversionConfirmed: true }).profile.kind,
    "subdual"
  );
  assert.throws(() => grappleDamagePlan(system(), "throw", { weapon }), /standard unarmed/);
  assert.throws(() => grappleDamagePlan(system(), "useWeapon"), /actual one-handed/);
  weapon.system.sizeHands = "Medium/2h";
  assert.throws(() => grappleDamagePlan(system(), "injure", { weapon }), /one-handed/);
});
test("ordered benefit prerequisites reject a free weapon attack or damage after releasing its target", () => {
  assert.throws(() => grappleBenefitEligibility(["useWeapon"], { loserStatuses: ["held"] }), /actual held or pinned/);
  assert.deepEqual(grappleBenefitEligibility(["pin", "useWeapon"], { loserStatuses: ["held"] }), [
    { heldTarget: true, pinnedTarget: false },
    { heldTarget: true, pinnedTarget: true }
  ]);
  assert.throws(
    () => grappleBenefitEligibility(["throw", "injure"], { loserStatuses: ["held"] }),
    /actual held or pinned/
  );
  assert.throws(() => grappleBenefitEligibility(["breakPin"]), /actual held or pinned/);
});

test("Break Pin preserves Held, including a pin whose separate Held source is missing", () => {
  assert.deepEqual(grappleBenefitEligibility(["breakPin", "escape"], { winnerStatuses: ["pinned"] }), [
    { heldTarget: false, pinnedTarget: false },
    { heldTarget: false, pinnedTarget: false }
  ]);
  assert.throws(
    () => grappleBenefitEligibility(["breakPin", "breakPin"], { winnerStatuses: ["pinned"] }),
    /actual held or pinned/
  );
});
test("an unrestrained winner may free a reviewed third participant in order", () => {
  const recipient = { uuid: "Actor.ally", statuses: ["pinned"] };
  const result = grappleBenefitEligibility(["breakPin", "escape"], {
    recipients: [recipient, recipient],
    recipientsConfirmed: true
  });
  assert.equal(result[0].recipientUuid, "Actor.ally");
  assert.equal(result[1].recipientUuid, "Actor.ally");
  assert.throws(
    () => grappleBenefitEligibility(["breakPin"], { recipients: [recipient] }),
    /Confirm the actual recipient/
  );
  assert.throws(
    () =>
      grappleBenefitEligibility(["injure"], {
        loserStatuses: ["held"],
        recipients: [recipient],
        recipientsConfirmed: true
      }),
    /Only Break Pin/
  );
});
test("assisted release and opponent benefits share the same ordered participant state", () => {
  const context = {
    winnerUuid: "Actor.winner",
    loserUuid: "Actor.foe",
    loserStatuses: ["pinned"],
    recipients: [{ uuid: "Actor.foe" }],
    recipientsConfirmed: true
  };
  assert.equal(grappleBenefitEligibility(["breakPin", "injure"], context)[1].heldTarget, true);
  assert.throws(() => grappleBenefitEligibility(["escape", "injure"], context), /actual held or pinned/);
  assert.throws(
    () =>
      grappleBenefitEligibility(["escape"], {
        recipients: [{ uuid: "Actor.free", statuses: [] }],
        recipientsConfirmed: true
      }),
    /actual held or pinned/
  );
});

test("standard Grapple damage follows actual proficiency for PCs, ordinary NPCs, Non-Combatants and animals", () => {
  for (const [actorType, fields, kind, die] of [
    ["agent", { proficiencyTotals: { unarmed: { proficient: true } } }, "lethal", 4],
    ["agent", {}, "subdual", 3],
    ["npc", { npcType: "standard", npcProfile: { enabled: true, qualities: [] } }, "lethal", 4],
    ["npc", { npcType: "standard", npcProfile: { enabled: true, qualities: [{ id: "non-combatant" }] } }, "subdual", 3],
    ["npc", { npcType: "animal", npcProfile: { enabled: true, qualities: [] } }, "subdual", 3]
  ]) {
    const s = { abilities: { str: { mod: 2 } }, activeFeatNames: [], ...fields };
    for (const benefit of ["injure", "throw"]) {
      const p = grappleDamagePlan(s, benefit, { actorType });
      assert.equal(p.profile.kind, kind);
      assert.match(p.formula, new RegExp("1d" + die));
    }
  }
});
test("animals receive proficiency only for their own granted weapon, not its entire proficiency family", () => {
  const s = {
    npcType: "animal",
    npcProfile: { enabled: true, qualities: [{ id: "natural-attack", details: "Claw" }] },
    npcBuiltIn: { sources: [{ key: "natural-attack", itemType: "weapon", itemId: "claw" }] }
  };
  assert.equal(npcWeaponTraining(s, { id: "claw", proficiency: "unarmed" }).trained, true);
  assert.equal(npcWeaponTraining(s, { id: "fist", proficiency: "unarmed" }).trained, false);
  assert.equal(npcWeaponTraining(s, { id: "pistol", proficiency: "handgun" }).trained, false);
});
test("legacy and current Laser flags apply one critical discount", () => {
  const check = {
    checkKind: "attack",
    successConfirmed: true,
    threatConfirmed: true,
    effectiveTotal: 20,
    attackContext: { laser: true, damageType: "laser" }
  };
  const plan = criticalPlan({}, check, {
    baseCost: 3,
    effect: "Reviewed effect",
    effectConfirmed: true,
    beforeDamage: true,
    available: 10
  });
  assert.equal(plan.blocked, false, plan.reason);
  assert.equal(plan.cost, 2);
  assert.equal(plan.sources.filter(s => s.includes("Laser")).length, 1);
});
const registry = new Map(),
  messages = [];
function update(patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split(".");
    let at = this;
    for (const key of keys.slice(0, -1)) at = at[key] ??= {};
    const last = keys.at(-1);
    if (last.startsWith("-=")) delete at[last.slice(2)];
    else at[last] = structuredClone(value);
  }
  return Promise.resolve(this);
}
let serial = 0;
globalThis.game = { user: { isGM: true, id: "gc" }, messages, settings: { get: () => ({}) } };
globalThis.foundry = { utils: { randomID: () => "claim" + ++serial, escapeHTML: String } };
globalThis.fromUuid = async uuid => registry.get(uuid);
globalThis.fromUuidSync = uuid => registry.get(uuid);
globalThis.Roll = {
  fromJSON: json => {
    const r = JSON.parse(json);
    return { ...r, toJSON: () => r };
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    const m = { ...data, id: "restored" + ++serial, uuid: "ChatMessage.restored" + serial, update };
    messages.push(m);
    registry.set(m.uuid, m);
    return m;
  }
};
function fixture() {
  registry.clear();
  messages.length = 0;
  const actor = { uuid: "Actor.winner", isOwner: true, system: system(), flags: {}, update };
  const source = {
    id: "award",
    uuid: "ChatMessage.award",
    flags: {
      spycraft2: {
        actorUuid: actor.uuid,
        checkKind: "grappleBenefits",
        grappleBenefits: {
          version: 1,
          winnerUuid: actor.uuid,
          loserUuid: "Actor.loser",
          benefits: ["sprawl", "injure"],
          eligibility: [
            { heldTarget: true, pinnedTarget: false },
            { heldTarget: true, pinnedTarget: false }
          ]
        }
      }
    }
  };
  registry.set(actor.uuid, actor);
  registry.set(source.uuid, source);
  return { actor, source };
}
test("each earned benefit reserves once, stores actual dice and restores deleted cards without RNG or a new application identity", async () => {
  const { actor, source } = fixture(),
    plan = grappleDamagePlan(actor.system, "sprawl");
  const proof = await reserveGrappleDamage(actor, source, 0, plan, {});
  await assert.rejects(() => reserveGrappleDamage(actor, source, 0, plan, {}), /already has original/);
  await validateGrappleDamage(actor, proof, plan);
  const check = {
    checkKind: "damage",
    actorUuid: actor.uuid,
    grappleDamage: proof,
    effectiveTotal: 5,
    damageProfile: plan.profile
  };
  const roll = { toJSON: () => ({ formula: "1d4+2", total: 5, terms: [{ results: [{ result: 3 }] }] }) };
  await recordGrappleDamageDice(actor, proof, { check, roll, alternativeRolls: [] });
  await settleGrappleDamageRoll(actor, proof);
  const restored = await reviewGrappleDamage(actor, proof.key);
  assert.equal(restored.rolls[0].total, 5);
  assert.equal(damageApplicationKey(restored.flags.spycraft2, restored.id), "grapple-" + proof.claimId);
  assert.equal((await validateGrappleDamageDelivery(restored, "Actor.loser")).benefit, "sprawl");
  await assert.rejects(() => validateGrappleDamageDelivery(restored, "Actor.other"), /recorded opponent/);
  restored.flags.spycraft2.effectiveTotal = 7;
  await assert.rejects(() => validateGrappleDamageDelivery(restored, "Actor.loser"), /original earned/);
  await rememberGrappleDamage(actor, restored, restored.flags.spycraft2);
  assert.equal((await validateGrappleDamageDelivery(restored, "Actor.loser")).benefit, "sprawl");
  const stored = actor.flags.spycraft2.grappleDamage[proof.key];
  restored.flags.spycraft2.damageApplicationStarted = { targetUuid: "Actor.loser" };
  await rememberGrappleDamage(actor, restored, restored.flags.spycraft2);
  messages.length = 0;
  registry.delete(restored.uuid);
  const again = await reviewGrappleDamage(actor, proof.key);
  assert.equal(again.flags.spycraft2.damageApplicationStarted.targetUuid, "Actor.loser");
  assert.equal(damageApplicationKey(again.flags.spycraft2, again.id), "grapple-" + proof.claimId);
  assert.deepEqual(again.rolls[0].toJSON(), stored.actualRolls[0]);
  const second = await reserveGrappleDamage(actor, source, 1, grappleDamagePlan(actor.system, "injure"), {});
  assert.notEqual(second.claimId, proof.claimId);
});
test("changed awards or recipes reject before dice; an unknown started roll stays consumed until GC review", async () => {
  const { actor, source } = fixture(),
    plan = grappleDamagePlan(actor.system, "sprawl");
  const proof = await reserveGrappleDamage(actor, source, 0, plan, {});
  await assert.rejects(() => validateGrappleDamage(actor, proof, { ...plan, formula: "99d6" }), /changed/);
  await validateGrappleDamage(actor, proof, plan);
  await settleGrappleDamageRoll(actor, proof);
  assert.equal(actor.flags.spycraft2.grappleDamage[proof.key].state, "needsReview");
  await assert.rejects(() => reviewGrappleDamage(actor, proof.key), /no saved actual dice/);
  await reviewGrappleDamage(actor, proof.key, {
    decision: "keep",
    note: "GC checked actual effects; original dice unknown"
  });
  await assert.rejects(() => reserveGrappleDamage(actor, source, 0, plan, {}), /already has original/);
  source.flags.spycraft2.grappleBenefits.winnerUuid = "Actor.other";
  assert.throws(() => grappleDamageAward(source, 1, actor.uuid), /actual winner/);
});

test("animals cannot select equipment or second-opponent Grapple benefits, even with higher Intelligence and Augmented", () => {
  const animal = {
    ...system(),
    npcType: "animal",
    abilities: { str: { mod: 2 }, int: { value: 6 } },
    npcBuiltIn: { sources: [{ itemId: "weapon", key: "augmented" }] }
  };
  const context = { winnerSystem: animal, winnerStatuses: ["held"], loserStatuses: ["pinned"] };
  for (const id of ["draw", "second", "gear", "useWeapon"])
    assert.throws(() => grappleBenefitEligibility([id], context), /Animals cannot/);
  for (const id of ["disarm", "escape", "injure", "move", "mute", "pin", "sprawl", "throw"])
    assert.equal(grappleBenefitEligibility([id], context).length, 1, id);
  assert.throws(() => grappleDamagePlan(animal, "useWeapon", { actorType: "npc" }), /Animals cannot/);
  assert.throws(
    () => grappleDamagePlan(animal, "injure", { weapon: { id: "weapon" }, actorType: "npc" }),
    /Animals cannot/
  );
  assert.equal(grappleDamagePlan(animal, "injure", { actorType: "npc" }).profile.kind, "subdual");
  assert.equal(grappleBenefitEligibility(["gear"], { ...context, winnerSystem: { npcType: "special" } }).length, 1);
});
