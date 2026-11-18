import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { npcQualityEffects, npcSkillOptionsFor, npcSkillQualityPlan } from "../module/rules/npc-qualities.mjs";
import { unnervingGrade } from "../module/rules/unnerving.mjs";
import { improvedVisionRangePlan } from "../module/rules/senses.mjs";

const catalog = JSON.parse(readFileSync(new URL("../src/data/npcs.json", import.meta.url), "utf8")).qualities;
const profile = (...qualities) => ({
  qualities: qualities.map(q => (typeof q === "string" ? { id: q, units: 1 } : q))
});
const effects = (qualities, context = {}) => npcQualityEffects(profile(...qualities), context);

test("an NPC with no qualities has the plain statistics and nothing to note", () => {
  const plain = npcQualityEffects(null);
  assert.equal(plain.speed, 30);
  assert.equal(plain.flySpeed, 0);
  assert.equal(plain.size, "Medium");
  assert.equal(plain.damageReduction, 0);
  assert.deepEqual(plain.notes, []);
  assert.deepEqual(plain.skillOptions, []);
  assert.deepEqual(plain.saveCalls, []);
  assert.equal(plain.role, null);
});

test("every quality in the catalog says what it does, except the three priced by their own controls", () => {
  const dedicated = ["skilled", "superior-attribute", "inferior-attribute"];
  for (const quality of catalog) {
    const result = effects([{ id: quality.id, units: 1, details: "forest" }], { type: "special", threatLevel: 5 });
    if (dedicated.includes(quality.id)) continue;
    assert.ok(
      result.notes.some(note => note.id === quality.id),
      `${quality.id} has a note`
    );
  }
  for (const note of effects(
    catalog.map(q => ({ id: q.id, units: 1, details: "x" })),
    { type: "special" }
  ).notes) {
    assert.ok(note.name && note.text, note.id);
    assert.ok(Number.isSafeInteger(note.page) && note.page >= 446 && note.page <= 452, `${note.id}: page ${note.page}`);
    assert.ok(note.text.length <= 230, `${note.id}: a short summary (${note.text.length})`);
  }
});

test("Fleet, Sluggish and Flight set Speed; Hulking and Undersized shift Size", () => {
  assert.equal(effects([{ id: "fleet", units: 2 }]).speed, 50);
  assert.equal(effects([{ id: "fleet", units: 9 }]).speed, 90, "Fleet adds 60 ft. at most");
  assert.equal(effects([{ id: "sluggish", units: 1 }]).speed, 20);
  assert.equal(effects([{ id: "sluggish", units: 5 }]).speed, 10, "never below 10 ft.");
  assert.equal(effects([{ id: "flight", units: 3 }]).flySpeed, 60);
  assert.equal(effects([{ id: "flight", units: 9 }]).flySpeed, 100);
  assert.equal(effects([{ id: "hulking", units: 2 }]).size, "Huge");
  assert.equal(effects([{ id: "undersized", units: 1 }]).size, "Small");
  assert.equal(effects([{ id: "hulking", units: 1 }, "undersized"]).sizeSteps, 0);
});

test("damage qualities give reduction, resistances by type, susceptibilities, Tough uses and Unnerving dice", () => {
  const result = effects([
    { id: "damage-reduction", units: 3 },
    { id: "damage-resistance", units: 4, details: "fire" },
    { id: "damage-resistance", units: 12, details: "cold" },
    { id: "achilles-heel", units: 1, details: "silver" },
    { id: "tough", units: 2 },
    { id: "unnerving", units: 5 }
  ]);
  assert.equal(result.damageReduction, 3);
  assert.deepEqual(result.resistances, [
    { type: "fire", value: 4 },
    { type: "cold", value: 8 }
  ]);
  assert.deepEqual(result.susceptibilities, ["silver"]);
  assert.equal(result.toughPerScene, 2);
  assert.equal(result.unnervingDice, 3);
  assert.equal(effects([{ id: "damage-reduction", units: 20 }]).damageReduction, 8);
});

test("an NPC's Unnerving quality and Improved Vision feed the same rules an agent's origin does", () => {
  assert.equal(unnervingGrade({ qualityEffects: { unnervingDice: 2 } }), 2);
  assert.equal(
    unnervingGrade({ originEffects: [{ qualityKey: "unnerving" }], qualityEffects: { unnervingDice: 0 } }),
    1
  );
  assert.equal(unnervingGrade({}), 0);
  const system = { qualityEffects: effects(["improved-vision"]), conditionContext: {} };
  assert.equal(improvedVisionRangePlan(system, -6).rangePenalty, -4);
  assert.equal(improvedVisionRangePlan({ conditionContext: {} }, -6).rangePenalty, -6);
});

test("Fearless and Meek change Morale checks, Strong-Minded the Resist checks, each to a limit of 20", () => {
  const brave = effects([{ id: "fearless", units: 2 }]);
  assert.equal(brave.moraleModifier, 8);
  assert.deepEqual(npcSkillQualityPlan(brave, { skillKey: "resolve", checkId: "morale" }), {
    modifier: 8,
    errorIncrease: 0,
    rows: [{ label: "Fearless", value: 8 }]
  });
  assert.equal(npcSkillQualityPlan(brave, { skillKey: "resolve", checkId: "concentration" }).modifier, 0);
  assert.equal(effects([{ id: "meek", units: 3 }]).moraleModifier, -12);
  assert.equal(effects([{ id: "fearless", units: 9 }]).moraleModifier, 20);
  assert.equal(
    effects([
      { id: "fearless", units: 2 },
      { id: "meek", units: 1 }
    ]).moraleModifier,
    4
  );
  const stubborn = effects([{ id: "strong-minded", units: 2 }]);
  assert.equal(npcSkillQualityPlan(stubborn, { skillKey: "resolve", checkId: "resist-impress" }).modifier, 8);
  assert.equal(npcSkillQualityPlan(stubborn, { skillKey: "senseMotive", checkId: "resist-manipulate" }).modifier, 8);
  assert.equal(npcSkillQualityPlan(stubborn, { skillKey: "resolve", checkId: "morale" }).modifier, 0);
});

test("situational qualities are offered for the skills they bear on and apply only when chosen", () => {
  const result = effects([
    { id: "camouflaged", units: 1, details: "swamp" },
    "improved-hearing",
    "all-thumbs",
    "nocturnal"
  ]);
  assert.deepEqual(
    npcSkillOptionsFor(result, "sneak").map(o => o.id),
    ["camouflaged:swamp", "all-thumbs", "nocturnal"]
  );
  assert.deepEqual(
    npcSkillOptionsFor(result, "notice").map(o => o.id),
    ["improved-hearing", "all-thumbs", "nocturnal"]
  );
  assert.equal(npcSkillQualityPlan(result, { skillKey: "sneak" }).modifier, 0, "nothing chosen");
  const chosen = npcSkillQualityPlan(result, {
    skillKey: "sneak",
    chosen: ["camouflaged:swamp", "improved-hearing", "all-thumbs", "nocturnal"]
  });
  assert.equal(chosen.modifier, 4 - 4, "Improved Hearing does not bear on Sneak");
  assert.equal(chosen.errorIncrease, 2);
});

test("improved senses scale with Wisdom, and forced saves are DC 10 + Threat Level", () => {
  const sharp = effects(["improved-hearing", "improved-scent", "improved-vision", "low-light-vision"], {
    abilities: { wis: { value: 14 } }
  });
  assert.deepEqual(sharp.senses, { hearing: 140, scent: 140, vision: 280, lowLight: true });
  assert.equal(sharp.rangePenaltyReduction, 2);
  const dread = effects(["captivating", "fearsome", "horrific"], { type: "special", threatLevel: 7 });
  assert.deepEqual(
    dread.saveCalls.map(call => [call.id, call.dc]),
    [
      ["captivating", 17],
      ["fearsome", 17],
      ["horrific", 17]
    ]
  );
});

test("villain roles set the GC's die and what it costs to hurt them; Story-Critical raises the die", () => {
  assert.deepEqual(effects(["mastermind"], { type: "special" }).role, {
    id: "mastermind",
    actionDie: "d10",
    threatRangeReduction: 2,
    extraDiceToActivate: 2,
    saveFromDeathDiscount: 2,
    featLimit: 15
  });
  assert.equal(effects(["henchman"], { type: "special" }).role.actionDie, "d8");
  assert.equal(effects(["minion"]).role.actionDie, "d6");
  assert.equal(effects(["minion", { id: "story-critical", units: 2 }]).role.actionDie, "d10");
  assert.equal(effects(["mastermind", { id: "story-critical", units: 5 }], { type: "special" }).role.actionDie, "d12");
  assert.deepEqual(effects(["prodigy", "treacherous"], { type: "standard" }).canCriticalWithoutDice, {
    skill: true,
    attack: true
  });
  assert.equal(effects(["treacherous"], { type: "special" }).canCriticalWithoutDice.attack, false);
});
