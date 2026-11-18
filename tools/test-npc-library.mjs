import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { buildNpcTemplates } from "./lib/npc-templates.mjs";
import { computeNpcProfile, NPC_CATEGORIES } from "../module/rules/npcs.mjs";
import { checkRecord } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";

const source = JSON.parse(readFileSync(new URL("../src/data/npc-templates.json", import.meta.url)));
const { packs } = buildPacks();
const pack = packs["core-npcs"];
const expected = [
  "Security Guard",
  "Police Officer",
  "Detective",
  "Bodyguard",
  "Soldier",
  "Commando",
  "Mercenary",
  "Street Tough",
  "Criminal Enforcer",
  "Burglar",
  "Contract Killer",
  "Enemy Agent",
  "Analyst",
  "Hacker",
  "Scientist",
  "Medic",
  "Driver",
  "Executive",
  "Journalist",
  "Ordinary Civilian"
];

test("the library contains the twenty core roles as reusable, private NPC actors", () => {
  assert.equal(pack.type, "Actor");
  assert.equal(pack.collection, "actors");
  assert.deepEqual(
    pack.docs.map(doc => doc.name),
    expected
  );
  assert.equal(new Set(pack.docs.map(doc => doc._id)).size, 20);
  assert.ok(pack.folders.length >= 4);
  for (const doc of pack.docs) {
    assert.match(doc._id, /^[a-zA-Z0-9]{16}$/);
    assert.equal(doc.type, "npc");
    assert.equal(doc.system.npcType, "standard");
    assert.equal(doc.system.npcProfile.enabled, true);
    assert.equal(doc.system.npcProfile.tier, 3);
    assert.equal(doc.system.followMission, true);
    assert.equal(doc.prototypeToken.actorLink, false);
    assert.equal(doc.ownership.default, 0);
    assert.ok(pack.folders.some(folder => folder._id === doc.folder && folder.type === "Actor"));
    assert.equal(checkRecord(RECORD_SHAPES.npcProfile, doc.system.npcProfile).length, 0);
    assert.ok(doc.flags.spycraft2.npcTemplate);
    assert.match(doc.system.biography, /Campaign choices/);
  }
});

test("every profile resolves under the actual NPC calculator at all twenty Threat Levels", () => {
  for (const doc of pack.docs) {
    let originalXP;
    for (let tl = 1; tl <= 20; tl++) {
      const result = computeNpcProfile(doc.system.npcProfile, doc.system.npcType, tl, doc.system.abilities);
      assert.deepEqual(result.warnings, [], `${doc.name} at TL${tl}`);
      assert.equal(result.complete, true, doc.name);
      assert.ok(Number.isInteger(result.xp) && result.xp >= 0, doc.name);
      assert.equal(result.effectiveLevel, tl);
      originalXP ??= result.xp;
      assert.equal(result.xp, originalXP, `${doc.name}: the template reward must not drift with TL`);
      assert.equal(result.missionXP, result.xp);
      for (const skill of result.skills) assert.equal(skill.bonus, Math.max(skill.competence, skill.listed));
      assert.equal(doc.system.npcProfile.skills.length <= 3, true);
    }
  }
});

test("included equipment has stable embedded IDs and exactly matches its priced picks", () => {
  for (const doc of pack.docs) {
    const template = source.templates.find(row => row.id === doc.flags.spycraft2.npcTemplate);
    const included = doc.embedded.items;
    assert.deepEqual(
      doc.items,
      included.map(item => item._id)
    );
    assert.equal(new Set(doc.items).size, doc.items.length);
    for (const category of NPC_CATEGORIES) {
      const loadout = template.loadout.filter(row => row.category === category);
      assert.deepEqual(
        loadout.map(row => packs[row.pack].docs.find(item => item.name === row.name).system.caliber),
        doc.system.npcProfile.equipment[category],
        `${doc.name}: ${category}`
      );
    }
    for (const item of included.filter(item => item.flags.spycraft2?.npcEquipment?.kind === "pick")) {
      assert.equal(item.folder, null);
      assert.match(item.flags.core.sourceId, /^Compendium\.spycraft2\.[\w-]+\.Item\.[a-zA-Z0-9]{16}$/);
      assert.equal(item.system.carried, true);
      assert.equal(item.system.reserve, false);
      assert.ok(!item._id.startsWith("Actor."));
    }
    assert.ok(included.filter(item => item.type === "weapon" && item.system.equipped).length <= 1);
    if (doc.system.npcProfile.qualities.some(quality => quality.id === "non-combatant"))
      assert.equal(
        included.some(item => item.type === "weapon"),
        false,
        doc.name
      );
  }
  const second = buildPacks().packs["core-npcs"];
  assert.deepEqual(
    second.docs.map(doc => [doc._id, doc.items]),
    pack.docs.map(doc => [doc._id, doc.items])
  );
});

test("missing loadout references are reported instead of silently publishing incomplete templates", () => {
  const broken = structuredClone(source);
  broken.templates = [broken.templates[0]];
  broken.templates[0].loadout[0].name = "Missing item";
  assert.throws(
    () =>
      buildNpcTemplates(broken, packs, {
        id: () => "test",
        stats: {},
        skillKeys: new Set(["notice", "search", "resolve"])
      }),
    /missing loadout item/
  );
});
