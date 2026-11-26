import test from "node:test";
import assert from "node:assert/strict";
import { unlimitedAmmunition } from "../module/rules/ammunition-use.mjs";
import { weaponAmmunition, spendWeaponShots, reloadWeapon } from "../module/apps/ammunition-use.mjs";
import { planTerms } from "../module/rules/roll-pipeline.mjs";
import "../module/rules/combat-actions.mjs";

test("Bottomless Clip removes declared shot limits in the attack plan without removing firing-mode requirements", () => {
  const context = {
    system: { campaignEffects: { bottomlessClip: true } },
    weapon: { ammo: "1S5" },
    firing: { firearm: true, fireMode: "auto", recoilPenalty: 0 },
    stance: { attackAction: "autofire" },
    options: { fireAction: "autofire", fireVolleys: 4, shotsRemaining: 0 }
  };
  const term = () => planTerms("attack", context).list.find(t => t.key === "fireAction");
  assert.equal(term().blocked, "");
  assert.equal(term().plan.shots, 12);
  context.system.campaignEffects = {};
  assert.ok(term().blocked);
  context.system.campaignEffects = { bottomlessClip: true };
  context.firing.fireMode = "single";
  assert.ok(term().blocked);
});

test("Bottomless Clip uses the five-shot printed stockpile threshold, including empty and single-shot weapons", () => {
  for (const [ammo, expected] of [
    ["4M1", false],
    ["1S5", true],
    ["4M3", true],
    ["5M3", true],
    ["6S2", true],
    ["—", false]
  ]) {
    const weapon = { ammo, shotsLoaded: 0, shotsSpare: 0 };
    assert.equal(unlimitedAmmunition(weapon, { bottomlessClip: true }), expected);
    assert.equal(unlimitedAmmunition(weapon), false);
  }
});

test("campaign activation bypasses attack limits and writes for PC and NPC weapons; deactivation restores saved counts", async () => {
  let active = true;
  globalThis.game = {
    settings: {
      get: (_system, key) =>
        key === "campaign" ? { qualities: active ? ["bottomless-clip"] : [] } : key === "mission" ? {} : true
    }
  };
  globalThis.ui = { notifications: { warn() {} } };
  for (const type of ["agent", "npc"]) {
    const item = {
      type: "weapon",
      isOwner: true,
      parent: { type },
      system: { ammo: "5M2", shotsLoaded: 0, shotsSpare: 3 },
      async update() {
        throw Error("Supply must not change");
      }
    };
    const before = structuredClone(item.system);
    active = true;
    assert.equal(weaponAmmunition(item), null);
    assert.equal(await spendWeaponShots(item, 20), null);
    assert.equal(await reloadWeapon(item), false);
    active = false;
    assert.equal(weaponAmmunition(item).loaded, 0);
    assert.equal(weaponAmmunition(item).spare, 3);
    assert.deepEqual(item.system, before);
  }
  delete globalThis.game;
  delete globalThis.ui;
});
