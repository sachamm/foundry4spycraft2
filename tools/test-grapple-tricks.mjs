import test from "node:test";
import assert from "node:assert/strict";
import { GRAPPLE_TRICKS, grappleTrickLines } from "../module/rules/grapple-tricks.mjs";

test("the grapple card lists only owned tricks, with the character's numbers", () => {
  assert.deepEqual(grappleTrickLines({ activeFeatNames: [] }), []);
  const sub = grappleTrickLines({ activeFeatNames: ["Submission Moves"] });
  assert.equal(sub.length, 3);
  assert.match(sub[1], /−4 on skill checks to escape/);
  const [clobber] = grappleTrickLines({ activeFeatNames: ["Battering Blows", "Darting Weapon", "Flashing Weapon"] });
  assert.match(clobber, /weapon’s damage 3 time\(s\)/);
  assert.match(grappleTrickLines({ activeFeatNames: ["Battering Blows"] })[0], /1 time\(s\)/);
  const [sleeper] = grappleTrickLines({ activeFeatNames: ["Brawling Supremacy"], abilities: { str: { mod: 3 } } });
  assert.match(sleeper, /1d6 \+ 3 minutes/);
  assert.equal(new Set(GRAPPLE_TRICKS.map(t => t.id)).size, GRAPPLE_TRICKS.length);
  for (const t of GRAPPLE_TRICKS) assert.match(t.text({}), /\S/);
});
