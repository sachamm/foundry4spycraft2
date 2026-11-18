import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT } from "../module/config.mjs";
import { computeNpcProfile } from "../module/rules/npcs.mjs";
import { animalPartnerReview } from "../module/rules/companions.mjs";
import { missionCaliberMatches } from "../module/rules/mission-gear.mjs";
const data = JSON.parse(readFileSync(new URL("../src/data/sample-agents.json", import.meta.url)));
const built = buildPacks(),
  pack = built.packs["sample-agents"];
const derive = doc =>
  computeAgent(
    structuredClone(doc.system),
    doc.embedded.items.map(item => ({ ...structuredClone(item), id: item._id })),
    SPYCRAFT
  );
test("sixteen complete level-1 agents cover every base class, with four distinct role variants", () => {
  assert.equal(pack.docs.length, 16);
  assert.equal(pack.folders.length, 12);
  const base = built.packs.classes.docs
    .filter(c => !c.system.expert)
    .map(c => c.system.identifier)
    .sort();
  assert.deepEqual([...new Set(pack.docs.map(a => a.flags.spycraft2.sampleClass))].sort(), base);
  for (const doc of pack.docs) {
    const s = derive(doc);
    assert.equal(s.level, 1);
    assert.equal(s.pointBuy.spent, 36);
    assert.equal(s.pointBuy.remaining, 0);
    assert.deepEqual(s.todo, [], doc.name);
    assert.deepEqual(s.warnings, [], doc.name);
    assert.equal(s.skillPoints[0].remaining, 0);
    assert.equal(s.proficiencyPicks.remaining, 0);
    assert.equal(s.contactPicks.remaining, 0);
    assert.equal(s.interestPicks.remaining, 0);
    assert.equal(s.wealth.remaining, 0);
    assert.ok(Object.values(s.wealth.possessions.budget.remaining).every(n => n === 0));
    assert.equal(s.wealth.possessions.budget.unfunded, 0);
    assert.equal(s.proficiencyPicks.used, s.proficiencyPicks.available);
    assert.equal(doc.system.vitality.value, s.vitality.max);
    assert.equal(doc.system.wounds.value, s.wounds.max);
    assert.equal(doc.system.actionDice.value, s.actionDice.max);
    assert.equal(doc.system.resourcesInitialized, true);
    assert.equal(doc.system.reputation, 2);
    assert.equal(doc.system.netWorth, 0);
    assert.equal(doc.prototypeToken.actorLink, true);
  }
  for (const key of ["faceman", "scout", "soldier", "wheelman"])
    assert.equal(pack.docs.filter(a => a.flags.spycraft2.sampleClass === key).length, 2);
});
test("focus choices use printed domains and every forte belongs to an owned focus", () => {
  for (const doc of pack.docs) {
    const s = derive(doc);
    for (const group of ["cultures", "science", "drive"])
      for (const focus of s.focusTotals[group])
        assert.ok(SPYCRAFT.tables.focuses[group].includes(focus), `${doc.name}: ${group}/${focus}`);
    for (const forte of doc.system.skillFortes) {
      assert.ok(s.focusTotals[forte.skill].includes(forte.focus));
      assert.ok(forte.forte.trim());
    }
    for (const value of Object.values(s.focusPicks)) assert.equal(value.remaining, 0, doc.name);
  }
});
test("paid feats meet prerequisites; only actual origin or class grants waive their requirements", () => {
  for (const doc of pack.docs) {
    const s = derive(doc);
    for (const item of doc.embedded.items.filter(i => i.type === "feat")) {
      assert.equal(s.featStatus[item._id].ok, true, doc.name + ": " + item.name);
      if (item.system.granted) {
        const origins = doc.embedded.items.filter(i => i.type === "origin").flatMap(i => i.system.grants ?? []);
        const classes = doc.embedded.items
          .filter(i => i.type === "class")
          .flatMap(i => (i.system.featGrants ?? []).filter(g => g.level <= 1).map(g => g.feat));
        assert.ok([...origins, ...classes].includes(item.name));
      }
    }
  }
  for (const doc of pack.docs.filter(d => d.flags.spycraft2.sampleClass === "faceman")) {
    const s = derive(doc);
    assert.equal(doc.system.identities.length, s.actionDice.max);
    for (const identity of doc.system.identities) {
      assert.ok(identity.name);
      assert.ok(identity.professionFocus);
      assert.equal(identity.interests.length, 2);
    }
  }
});
test("all initial gear allowances are accounted for and ammunition is one included ordinary stockpile", () => {
  for (const doc of pack.docs) {
    const s = derive(doc);
    for (const budget of Object.values(s.gearPicks)) assert.equal(budget.remaining, 0, doc.name);
    assert.equal(s.wealth.possessions.budget.unfunded, 0);
    const common = doc.embedded.items.filter(i => i.system.common);
    assert.equal(common.length, s.commonItems.count);
    assert.equal(new Set(common.map(i => i.flags.spycraft2.sampleCommonItem)).size, common.length);
    for (const item of doc.embedded.items) {
      if (item.flags.spycraft2?.sampleAmmunition) {
        const a = item.flags.spycraft2.sampleAmmunition;
        assert.equal(a.includedStockpiles, 1);
        assert.equal(a.upgradeCost, 0);
        assert.equal(a.commonItemCost, 0);
        assert.ok(a.shots > 0);
        assert.equal(item.system.quantity, 1);
        assert.ok(doc.items.includes(a.weaponId));
      }
      if (item.system.pick === "CHA") assert.ok(["G", "T", "R", "V"].includes(item.system.gearCategory));
      if (item.system.pick && item.system.caliber > data.missionCaliber)
        assert.ok(missionCaliberMatches(s, { ...item, id: item._id }));
      if (item.system.possessionSource) assert.equal(item.system.pick, "");
    }
  }
  const pilot = pack.docs.find(d => d.flags.spycraft2.sampleAgent === "noor-al-masri");
  assert.ok(
    pilot.embedded.items.some(
      i => i.name === "Helicopter, observation" && i.system.missionCaliberGrant.source === "customRide"
    )
  );
});
test("the included animal partner has legal paid XP, two free trained qualities, bite and free size grant", () => {
  assert.equal(pack.companions.length, 1);
  const pet = pack.companions[0],
    owner = pack.docs.find(d => d.flags.spycraft2.sampleAgent === pet.flags.spycraft2.sampleOwner),
    s = derive(owner);
  const result = computeNpcProfile(pet.system.npcProfile, "animal", 1, pet.system.abilities),
    review = animalPartnerReview(s, { ...pet.system, npcBuild: result });
  assert.deepEqual(review.warnings, []);
  assert.equal(review.xp, 39);
  assert.equal(review.cap, 40);
  assert.deepEqual(pet.flags.spycraft2.companionFreeTraining, ["rescue", "seek-on-command"]);
  assert.ok(pet.embedded.items.some(i => i.name === "Wolfpack Mastery" && i.system.granted));
  assert.ok(pet.embedded.items.some(i => i.name === "Bite II" && i.system.damage === "1d8"));
  assert.match(pet.system.companionOf.ownerUuid, new RegExp(owner._id + "$"));
  assert.equal(pet.system.followMission, false);
});
test("all character and companion art is local, compressed, and referenced by the package", () => {
  for (const doc of [...pack.docs, ...pack.companions])
    for (const path of [doc.img, doc.prototypeToken.texture.src]) {
      assert.match(path, /^systems\/spycraft2\/assets\/agents\/[a-z-]+\/(portrait|token)\.webp$/);
      assert.ok(existsSync(new URL("../" + path.replace("systems/spycraft2/", ""), import.meta.url)), path);
    }
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url)));
  const sample = manifest.packs.find(p => p.name === "sample-agents");
  assert.equal(sample.type, "Actor");
  assert.equal(sample.ownership.PLAYER, "OBSERVER");
});
