import test from "node:test";
import assert from "node:assert/strict";
import { stashFeatPlan } from "../module/rules/stash-feats.mjs";

const stash = { id: "stash-item" };

test("Steel Rain: +4 gear to stash a declared hurled weapon; Concealed Carry states the frisk rule", () => {
  const rain = stashFeatPlan({ activeFeatNames: ["Steel Rain"] }, "sleightOfHand", stash, { stashHurledWeapon: true });
  assert.deepEqual(rain.bonuses, [{ source: "Steel Rain (hurled weapon)", type: "gear", value: 4 }]);
  assert.deepEqual(stashFeatPlan({ activeFeatNames: ["Steel Rain"] }, "sleightOfHand", stash, {}).bonuses, []);
  const carry = stashFeatPlan({ activeFeatNames: ["Concealed Carry"] }, "sleightOfHand", stash, {});
  assert.match(carry.notes.join(" "), /2 Size categories smaller/);
  assert.deepEqual(stashFeatPlan({ activeFeatNames: ["Concealed Carry"] }, "sneak", stash, {}).notes, []);
});

test("Living Cipher: the Decipher card states the counted Power Rating", async () => {
  const { livingCipherPlan } = await import("../module/rules/living-cipher.mjs");
  const plan = livingCipherPlan({ activeFeatNames: ["Living Cipher"], abilities: { int: { mod: 3 } } }, "analysis", {
    id: "decipher"
  });
  assert.match(plan.notes[0], /Power Rating 3/);
  assert.deepEqual(livingCipherPlan({ activeFeatNames: [] }, "analysis", { id: "decipher" }).notes, []);
});

test("Containment Basics: the Ambush card states the extended benefits", async () => {
  const { containmentAmbushPlan } = await import("../module/rules/containment.mjs");
  const owner = { activeFeatNames: ["Containment Basics"] };
  assert.match(containmentAmbushPlan(owner, "tactics", { id: "ambush" }).notes[0], /first 3 rounds/);
  assert.deepEqual(containmentAmbushPlan(owner, "tactics", { id: "other" }).notes, []);
});
