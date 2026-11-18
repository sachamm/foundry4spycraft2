import test from "node:test";
import assert from "node:assert/strict";
import "../module/rules/explosive-basics.mjs";
import { planTerms } from "../module/rules/roll-pipeline.mjs";

const owner = feats => ({ activeFeatNames: feats });

test("Explosive Basics: setting an explosive reduces the error range by 2 and records the raised DCs", () => {
  const terms = planTerms("attack", {
    system: owner(["Explosive Basics"]),
    weapon: { proficiency: "explosives" },
    options: {}
  });
  assert.equal(terms.sum("errorReduction"), 2);
  assert.deepEqual(terms.plans.explosiveBasics ?? terms.list.find(t => t?.key === "explosiveBasics").plan, {
    version: 1,
    errorReduction: 2,
    reflexDC: 2,
    locateDC: 4
  });
  for (const [feats, proficiency] of [
    [[], "explosives"],
    [["Explosive Basics"], "hurled"]
  ])
    assert.equal(
      planTerms("attack", { system: owner(feats), weapon: { proficiency }, options: {} }).sum("errorReduction"),
      0
    );
});
