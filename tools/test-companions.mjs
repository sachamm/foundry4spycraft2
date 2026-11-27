import test from "node:test";
import assert from "node:assert/strict";
import {
  animalPartnerCap,
  partnerThreatLevel,
  TRAINED_QUALITIES,
  animalPartnerReview,
  lieutenantReview,
  companionSlots,
  companionLoss
} from "../module/rules/companions.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { npcIsSpecial, spendProfile } from "../module/rules/gc/npc-state.mjs";

const owner = (feats, extra = {}) => ({
  activeFeatNames: feats.map(f => f.name ?? f),
  activeFeatSelections: feats.map(f => (typeof f === "string" ? { name: f, tree: "" } : f)),
  level: 9,
  ...extra
});

test("an Animal Partner uses special-character combat and spend classification while remaining an animal", () => {
  const animal = { system: { npcType: "animal", animalPartner: true, npcProfile: { enabled: true, qualities: [] } } };
  assert.equal(npcIsSpecial(animal), true);
  assert.equal(spendProfile(animal).type, "special");
  assert.equal(spendProfile(animal).baseType, "animal");
  animal.system.animalPartner = false;
  assert.equal(npcIsSpecial(animal), false);
  assert.equal(spendProfile(animal).type, "animal");
});

test("Animal Partner: XP cap from Style and Terrain feats, Threat Level from career level", () => {
  assert.equal(animalPartnerCap(owner(["Animal Partner"])), 35);
  assert.equal(
    animalPartnerCap(
      owner(["Animal Partner", { name: "Urban Training", tree: "terrain" }, { name: "Mark", tree: "style" }])
    ),
    45
  );
  assert.deepEqual([partnerThreatLevel(9), partnerThreatLevel(2)], [7, 1]);
  assert.ok(TRAINED_QUALITIES.includes("attack-on-command"));
  assert.equal(TRAINED_QUALITIES.includes("natural-attack"), false);
});

test("Animal Partner review: an animal with 2 trained qualities within the cap", () => {
  const sys = owner(["Animal Partner"]);
  const npc = (xp, qualities) => ({ npcType: "animal", npcProfile: { qualities }, npcBuild: { xp } });
  const trained = [{ id: "attack-on-command" }, { id: "guard-on-command" }];
  assert.deepEqual(animalPartnerReview(sys, npc(39, trained)).warnings, [], "4 XP of trained qualities are free");
  assert.match(animalPartnerReview(sys, npc(40, trained)).warnings[0], /exceeds 35/);
  assert.match(animalPartnerReview(sys, npc(null, trained)).warnings.join(" "), /XP reward can be checked/);
  assert.match(animalPartnerReview(sys, npc(20, [{ id: "attack-on-command" }])).warnings.join(" "), /2 trained/);
  assert.match(animalPartnerReview(sys, { ...npc(20, trained), npcType: "standard" }).warnings.join(" "), /animal/);
});

test("Personal Lieutenant review, slots and the cost of losing a companion", () => {
  const boss = owner(["Personal Lieutenant", "Animal Partner", "Animal Partner"], { level: 9 });
  const ok = { level: 4, pointBuyBudget: 32, activeFeatNames: [], contacts: [], subplots: [], interests: "" };
  assert.deepEqual(lieutenantReview(ok, boss).warnings, []);
  const bad = lieutenantReview(
    { ...ok, level: 5, pointBuyBudget: 36, activeFeatNames: ["Animal Partner"] },
    boss
  ).warnings;
  assert.equal(bad.length, 3);
  assert.deepEqual(companionSlots(boss, [{ feat: "Animal Partner" }]), { animalPartner: 1, personalLieutenant: 1 });
  assert.equal(companionSlots({ ...boss, level: 5 }, []).personalLieutenant, 0);
  assert.deepEqual(companionLoss(boss), { reputation: 9, netWorth: 450000 });
});

test("a Personal Lieutenant has exactly 1 action die", () => {
  const cls = {
    id: "test",
    type: "class",
    name: "Test",
    system: {
      identifier: "test",
      skillPoints: 4,
      vitalityDie: 6,
      classSkills: [],
      table: [{ level: 1, bab: 1, defense: 1, fort: 0, ref: 0, will: 0, actionDice: 3, actionDie: 4 }]
    }
  };
  const base = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [{ classId: "test", vitality: 6, skills: {} }],
    skills: {},
    focuses: {},
    proficiencies: {},
    misc: {},
    conditionContext: {},
    pointBuyBudget: 32
  };
  const lieutenant = computeAgent(
    {
      ...base,
      companionOf: { ownerUuid: "Actor.o", feat: "Personal Lieutenant" },
      lieutenantOwner: { level: 8, activeFeatNames: ["Personal Lieutenant"] }
    },
    [cls],
    cfg
  );
  assert.equal(lieutenant.actionDice.max, 1);
});

test("Flawless Identity: identities up to the starting action dice; the active one adds its Profession focus", async () => {
  const { identityLimit, identityReview, enterIdentityPlan, professionFocusesWithIdentity, activeIdentity } =
    await import("../module/rules/flawless-identity.mjs");
  const ids = [
    { id: "a", name: "Marco Bell", professionFocus: "Sommelier", interests: ["Opera", "Yachting"] },
    { id: "b", name: "Ida Wren", professionFocus: "", interests: ["Chess"] }
  ];
  const sys = { activeFeatNames: ["Flawless Identity"], actionDice: { max: 3 }, identities: ids, activeIdentity: "a" };
  assert.equal(identityLimit(sys), 3);
  assert.deepEqual(identityReview(sys), ["Ida Wren: choose 1 Profession focus and 2 Interests."]);
  assert.match(identityReview({ ...sys, actionDice: { max: 1 } })[0], /allow 1/);
  assert.equal(activeIdentity(sys).name, "Marco Bell");
  assert.deepEqual(professionFocusesWithIdentity(sys, ["Law"]), ["Law", "Sommelier"]);
  assert.deepEqual(professionFocusesWithIdentity({ ...sys, activeIdentity: "" }, ["Law"]), ["Law"]);
  assert.throws(() => enterIdentityPlan(sys, "a"), /already/);
  assert.equal(enterIdentityPlan(sys, "b").cost, 1);
  assert.throws(() => enterIdentityPlan({ ...sys, activeFeatNames: [] }, "b"), /not been earned/);
});
