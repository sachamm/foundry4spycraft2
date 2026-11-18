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

test("Feat-granted Possessions: one each, with the Caliber cap where the feat sets one", async () => {
  const { featPossessionWarnings } = await import("../module/rules/favored-gear.mjs");
  const item = (source, caliber, name = "X") => ({ type: "gear", name, system: { possessionSource: source, caliber } });
  const sys = { level: 6, activeFeatNames: ["Bug Basics", "Disease Basics"] };
  assert.deepEqual(featPossessionWarnings(sys, [item("bugBasics", 2), item("diseaseBasics", 5)]), []);
  assert.match(featPossessionWarnings(sys, [item("bugBasics", 3, "Mic")])[0], /may not exceed 2/);
  assert.match(featPossessionWarnings(sys, [item("poisonBasics", 1, "Pen")])[0], /needs Poison Basics/);
  assert.match(featPossessionWarnings(sys, [item("bugBasics", 1), item("bugBasics", 1)])[0], /grants 1/);
});

test("Request feats add to the claimed bundle", async () => {
  const { requestFeatBonus } = await import("../module/rules/gear-acquisition.mjs");
  const sys = feats => ({ activeFeatNames: feats });
  assert.equal(
    requestFeatBonus(
      sys(["Grenade Basics"]),
      { type: "weapon", name: "Frag grenade", system: { proficiency: "hurled" } },
      2
    ).extra,
    1
  );
  assert.equal(requestFeatBonus(sys(["Bug Basics"]), { type: "gear", name: "Audio bug", system: {} }, 3).extra, 3);
  assert.equal(
    requestFeatBonus(sys(["Poison Basics"]), { type: "gear", name: "Contact poison", system: {} }, 2).extra,
    1
  );
  assert.equal(
    requestFeatBonus(
      sys(["Guided Weapon Basics"]),
      { type: "weapon", name: "ATGM", system: { proficiency: "guided" } },
      1
    ).extra,
    1
  );
  assert.equal(
    requestFeatBonus(
      sys(["Rock and Roll"]),
      { type: "weapon", name: "SMG", system: { fireModes: ["single", "auto"] } },
      1
    ).extra,
    1
  );
  assert.equal(
    requestFeatBonus(
      sys(["Superior Documentation"]),
      { type: "gear", name: "Cover identity", system: { powerRating: "9" } },
      1
    ).powerRating,
    "10"
  );
  assert.equal(
    requestFeatBonus(
      sys(["Superior Documentation"]),
      { type: "gear", name: "Cover identity", system: { powerRating: "10" } },
      1
    ).powerRating,
    "10"
  );
  assert.equal(requestFeatBonus(sys([]), { type: "gear", name: "Audio bug", system: {} }, 3).extra, 0);
});
