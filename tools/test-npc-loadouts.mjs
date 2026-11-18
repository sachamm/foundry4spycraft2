import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildPacks } from "./lib/pack-docs.mjs";
import { buildNpcLoadout } from "./lib/npc-loadouts.mjs";
import { ammunitionConfiguration, ammunitionStockpilePlan } from "../module/rules/ammunition.mjs";
import { computeNpcProfile } from "../module/rules/npcs.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const source = read("npc-templates");
const { packs } = buildPacks();
const commonCatalog = read("npc-common-items").items;
const ammoCatalog = read("ammunition");
const options = {
  id: (...parts) => createHash("sha256").update(parts.join("/")).digest("hex").slice(0, 16),
  stats: {},
  commonCatalog,
  ammoCatalog
};
const armed = source.templates.find(t => t.name === "Soldier");
const build = (template = armed, extra = {}) => buildNpcLoadout(template, packs, { ...options, ...extra });

test("each template separates priced picks, Common Items and supplied stockpiles", () => {
  for (const actor of packs["core-npcs"].docs) {
    const template = source.templates.find(t => t.id === actor.flags.spycraft2.npcTemplate);
    const items = actor.embedded.items;
    const pick = items.filter(i => i.flags.spycraft2?.npcEquipment?.kind === "pick");
    const common = items.filter(i => i.flags.spycraft2?.npcEquipment?.kind === "common");
    assert.equal(pick.length, template.loadout.length);
    assert.equal(common.length, template.commonItems.length);
    assert.ok(common.length > 0);
    for (const item of common) {
      assert.equal(item.system.common, true);
      assert.equal(item.system.caliber, 0);
      assert.equal(item.flags.spycraft2.npcEquipment.weightNeedsReview, true);
      assert.deepEqual(item.effects, []);
      assert.equal(item.flags.core?.sourceId, undefined);
    }
    const firearms = pick.filter(i => i.flags.spycraft2.npcStockpileId);
    const ammo = items.filter(i => i.flags.spycraft2?.npcEquipment?.kind === "ammunition");
    assert.equal(ammo.length, firearms.length);
    for (const weapon of firearms) {
      const stockpile = ammo.find(i => i._id === weapon.flags.spycraft2.npcStockpileId);
      const meta = stockpile.flags.spycraft2.npcEquipment;
      const plan = ammunitionStockpilePlan(weapon.system, ammoCatalog, {
        ammunitionId: meta.ammunitionId,
        initial: true
      });
      assert.equal(ammunitionConfiguration(weapon.system).needsReview, false);
      assert.equal(stockpile.system.quantity, 1);
      assert.equal(stockpile.system.weight, plan.totalWeight);
      assert.equal(meta.shotsPerStockpile, plan.shotsPerStockpile);
      assert.equal(meta.weaponId, weapon._id);
      assert.equal(stockpile.type, "gear");
      assert.equal(stockpile.system.common, false);
      assert.equal(stockpile.system.caliber, 0);
    }
    assert.equal(actor.system.npcProfile.extraAmmoPairs, 0);
  }
});

test("Common Items and ordinary ammunition do not consume picks or change XP", () => {
  const withCommon = build();
  const withoutCommon = build({ ...armed, commonItems: [] });
  assert.deepEqual(withCommon.equipment, withoutCommon.equipment);
  assert.equal(withCommon.extraAmmoPairs, 0);
  const actor = packs["core-npcs"].docs.find(a => a.name === armed.name);
  const profile = structuredClone(actor.system.npcProfile);
  const base = computeNpcProfile(profile, "standard", 1, actor.system.abilities).xp;
  const extra = structuredClone(armed);
  extra.loadout.find(i => i.ammunition).ammunition.stockpiles = 3;
  const result = build(extra);
  assert.equal(result.extraAmmoPairs, 1);
  assert.deepEqual(result.equipment, withCommon.equipment);
  profile.extraAmmoPairs = result.extraAmmoPairs;
  assert.equal(computeNpcProfile(profile, "standard", 1, actor.system.abilities).xp, base + 1);
  const special = structuredClone(armed);
  delete special.loadout.find(i => i.ammunition).ammunition.stockpiles;
  const specialResult = build(special, { type: "special" });
  assert.equal(specialResult.extraAmmoPairs, 0);
  assert.equal(
    specialResult.items.find(i => i.flags.spycraft2?.npcEquipment?.kind === "ammunition").system.quantity,
    3
  );
});

test("invalid ammunition and inventory declarations stop the pack build", () => {
  const change = (mutate, pattern) => {
    const template = structuredClone(armed);
    mutate(
      template,
      template.loadout.find(i => i.ammunition)
    );
    assert.throws(() => build(template), pattern);
  };
  change((t, w) => delete w.ammunition, /choose ammunition/);
  change((t, w) => {
    w.ammunition.id = "unknown";
  }, /ordinary included-stockpile/);
  change((t, w) => {
    w.ammunition.code = "1M1";
  }, /valid supplied ammunition code/);
  change((t, w) => {
    w.ammunition.stockpiles = 0;
  }, /at least 1/);
  change((t, w) => {
    w.ammunition.stockpiles = 2;
  }, /pairs of stockpiles/);
  change((t, w) => {
    w.category = "gear";
  }, /not a gear pick/);
  change(t => {
    t.commonItems.push("unknown");
  }, /missing or duplicate Common Item/);
  change(t => {
    t.commonItems.push(t.commonItems[0]);
  }, /missing or duplicate Common Item/);
  change(t => {
    t.loadout.find(i => i.name === "Dagger/survival knife").ammunition = { id: "unknown" };
  }, /supported ammunition family/);
});
