import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateNpcFeats, npcFeatLimit } from "../module/rules/npc-feats.mjs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { computeNpcProfile } from "../module/rules/npcs.mjs";

const source = JSON.parse(readFileSync(new URL("../src/data/npc-templates.json", import.meta.url)));
const { packs } = buildPacks();
const feats = packs.feats.docs;
const selections = names => names.map(name => ({ name }));
const validate = names => validateNpcFeats(selections(names), feats);

test("NPCs waive numeric requirements but must hold prerequisite feats", () => {
  assert.equal(validate(["CQB Basics", "Ghost Basics", "Charmer"]).ok, true);
  assert.equal(validate(["Marksmanship Mastery"]).ok, false);
  assert.equal(validate(["Marksmanship Mastery", "Marksmanship Basics"]).ok, true);
  assert.equal(validate(["Ghost Mastery"]).ok, false);
  assert.equal(validate(["Ghost Mastery", "Ghost Basics"]).ok, true);
  assert.equal(validate(["Driving Instincts"]).ok, false);
  assert.equal(validate(["Driving Instincts", "Defensive Driving"]).ok, true);
});

test("skill mastery and False Start must name a possessed Basic Skill feat", () => {
  const selection = { name: "Advanced Skill Mastery", choice: "Techie" };
  assert.equal(validateNpcFeats([selection, { name: "Techie" }], feats).ok, true);
  assert.equal(validateNpcFeats([selection, { name: "Scholar" }], feats).ok, false);
  assert.equal(validateNpcFeats([{ name: "Advanced Skill Mastery" }, { name: "Techie" }], feats).ok, false);
  assert.equal(validateNpcFeats([{ name: "False Start", choice: "Techie" }, { name: "Techie" }], feats).ok, true);
  assert.equal(
    validateNpcFeats([{ name: "False Start", choice: "Ghost Basics" }, { name: "Ghost Basics" }], feats).ok,
    false
  );
  assert.equal(
    validateNpcFeats(
      [
        { name: "Techie" },
        { name: "Scholar" },
        { name: "Advanced Skill Mastery", choice: "Techie" },
        { name: "Grand Skill Mastery", choice: "Scholar" }
      ],
      feats
    ).ok,
    false
  );
});

test("each template gets its actual feat items and exactly one priced quality per purchase", () => {
  for (const actor of packs["core-npcs"].docs) {
    const template = source.templates.find(template => template.id === actor.flags.spycraft2.npcTemplate);
    const owned = actor.embedded.items.filter(item => item.type === "feat");
    const priced = actor.system.npcProfile.qualities.filter(quality => quality.id === "feat");
    assert.ok(owned.length >= 1 && owned.length <= 5, actor.name);
    assert.equal(owned.length, template.feats.length, actor.name);
    assert.equal(priced.length, owned.length, actor.name);
    assert.equal(validateNpcFeats(template.feats, feats).ok, true, actor.name);
    for (let index = 0; index < owned.length; index++) {
      assert.equal(owned[index].name, template.feats[index].name);
      assert.equal(owned[index].system.choice, template.feats[index].choice ?? "");
      assert.equal(owned[index].system.featKind, "permanent");
      assert.equal(owned[index].flags.spycraft2.ruleName, owned[index].name);
      assert.match(owned[index].flags.core.sourceId, /^Compendium\.spycraft2\.feats\.Item\./);
      assert.ok(actor.items.includes(owned[index]._id));
      assert.equal(priced[index].units, 1);
    }
    for (let tl = 1; tl <= 20; tl++) {
      const profile = actor.system.npcProfile;
      const without = { ...profile, qualities: profile.qualities.filter(quality => quality.id !== "feat") };
      for (const type of ["standard", "special"]) {
        const before = computeNpcProfile(without, type, tl, actor.system.abilities);
        const after = computeNpcProfile(profile, type, tl, actor.system.abilities);
        // Some other qualities are deliberately standard-only; check compatible conversions.
        if (!before.complete || !after.complete) continue;
        assert.equal(after.qualityXP - before.qualityXP, 2 * owned.length, actor.name);
        assert.equal(after.xp - before.xp, 2 * owned.length, actor.name);
        assert.equal(after.missionXP - before.missionXP, (type === "special" ? 4 : 1) * 2 * owned.length, actor.name);
      }
    }
  }
});

test("unknown feats, duplicate purchases, self-qualification and dependency cycles are rejected", () => {
  assert.equal(validate(["Not A Feat"]).ok, false);
  assert.equal(validate(["Observer", "Observer"]).ok, false);
  const catalog = [
    { name: "A", system: { prerequisites: { type: "feat", name: "B" } } },
    { name: "B", system: { prerequisites: { type: "feat", name: "A" } } },
    { name: "Self", system: { prerequisites: { type: "feat", name: "Self" } } }
  ];
  assert.equal(validateNpcFeats(selections(["A", "B"]), catalog).ok, false);
  assert.equal(validateNpcFeats(selections(["Self"]), catalog).ok, false);
});

test("feat limits and the restriction on granting NPC qualities are enforced", () => {
  assert.equal(npcFeatLimit(), 5);
  assert.equal(npcFeatLimit([{ id: "foil" }]), 10);
  assert.equal(npcFeatLimit([{ id: "henchman" }]), 10);
  assert.equal(npcFeatLimit([{ id: "mastermind" }]), 15);
  const many = selections(["Observer", "Scholar", "Techie", "Advisor", "Diplomat", "Examiner"]);
  assert.equal(validateNpcFeats(many, feats).ok, false);
  const forbidden = { name: "Test Quality Grant", system: { grantsNpcQuality: true } };
  assert.equal(validateNpcFeats(selections([forbidden.name]), [forbidden]).ok, false);
});

test("alternative feat prerequisites and selected feat choices retain their structure", () => {
  const catalog = [
    { name: "A", system: {} },
    { name: "B", system: {} },
    {
      name: "Either",
      system: {
        prerequisites: {
          type: "any",
          of: [
            { type: "ability", key: "str", min: 30 },
            { type: "feat", name: "A" },
            { type: "feat", name: "B" }
          ]
        }
      }
    },
    { name: "Chosen", system: { prerequisites: { type: "featChoice", name: "A", choice: "x" } } }
  ];
  assert.equal(validateNpcFeats(selections(["Either"]), catalog).ok, false);
  assert.equal(validateNpcFeats(selections(["Either", "B"]), catalog).ok, true);
  assert.equal(validateNpcFeats([{ name: "A", choice: "y" }, { name: "Chosen" }], catalog).ok, false);
  assert.equal(validateNpcFeats([{ name: "A", choice: "x" }, { name: "Chosen" }], catalog).ok, true);
});
