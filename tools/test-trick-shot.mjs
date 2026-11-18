import test from "node:test";
import assert from "node:assert/strict";
import { trickShotEligible, trickShotNote } from "../module/rules/trick-shot.mjs";

const hit = (extra = {}) => ({
  checkKind: "attack",
  successConfirmed: true,
  weaponProficiency: "hurled",
  weaponQualities: "",
  ...extra
});
const owner = { activeFeatNames: ["Trick Shot"] };

test("Trick Shot: offered on a hit with a non-grenade hurled weapon, once", () => {
  assert.ok(trickShotEligible(owner, hit()));
  assert.equal(trickShotEligible({ activeFeatNames: [] }, hit()), false);
  assert.equal(trickShotEligible(owner, hit({ weaponQualities: "BLS (10 ft.)" })), false);
  assert.equal(trickShotEligible(owner, hit({ weaponProficiency: "rifle" })), false);
  assert.equal(trickShotEligible(owner, hit({ successConfirmed: false })), false);
  assert.equal(trickShotEligible(owner, hit({ trickShot: { damage: 5 } })), false);
  assert.match(trickShotNote("Vex", 9), /Vex takes no damage and is held.*DC 9/);
});
