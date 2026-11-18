import test from "node:test";
import assert from "node:assert/strict";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

test("Baby It, Crew Dog and Venomous Dialogue are once-per-scene uses with the sheet's Use button", () => {
  const specs = limitedUseAbilities({ activeFeatNames: ["Baby It", "Crew Dog", "Venomous Dialogue"] }, [], cfg);
  for (const id of ["babyIt", "crewDog", "venomousDialogue"]) {
    const spec = specs.find(s => s.id === id);
    assert.deepEqual([spec.period, spec.limit, spec.workflow], ["scene", 1, "manual"], id);
  }
  assert.equal(
    limitedUseAbilities({ activeFeatNames: [] }, [], cfg).some(s => s.id === "babyIt"),
    false
  );
});
