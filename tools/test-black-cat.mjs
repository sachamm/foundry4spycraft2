import test from "node:test";
import assert from "node:assert/strict";
import { actor, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import {
  blackCatSpec,
  activeBlackCat,
  blackCatPlan,
  blackCatRollEffect,
  blackCatNote
} from "../module/rules/black-cat.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { inlinedSource } from "./lib/hbs-harness.mjs";

const periods = { scene: "s1", session: "n1" };
const source = (chance = ["Black Cat", "Fortunate"], extra = []) => ({
  activeFeatNames: [...chance, ...extra],
  activeFeatSelections: [
    ...chance.map(name => ({ name, tree: "Chance" })),
    ...extra.map(name => ({ name, tree: "Chance" }))
  ]
});
const opponent = (uuid, mark) => ({ uuid, name: uuid.split(".")[1], mark });
const plan = (src, targets, extra = {}) =>
  blackCatPlan(src, targets, { sourceUuid: "Actor.cat", sourceName: "Cat", periods, sightConfirmed: true, ...extra });

test("once per scene, up to one opponent per Chance feat, never the user", () => {
  assert.deepEqual(blackCatSpec(source()), {
    id: "blackCat",
    name: "Black Cat",
    period: "scene",
    limit: 1,
    workflow: "blackCat"
  });
  assert.equal(blackCatSpec({ activeFeatNames: [] }), null);
  assert.ok(limitedUseAbilities(source(), [], cfg).some(s => s.id === "blackCat"));
  const marks = plan(source(), [opponent("Actor.a"), opponent("Actor.b")]);
  assert.equal(marks.length, 2);
  assert.deepEqual(marks[0].mark, {
    version: 1,
    sourceUuid: "Actor.cat",
    sourceName: "Cat",
    scene: "s1",
    toughLuck: false,
    at: 0
  });
  assert.throws(() => plan(source(), [opponent("Actor.a"), opponent("Actor.b"), opponent("Actor.c")]), /at most 2/);
  assert.throws(() => plan(source(), [opponent("Actor.cat")]), /not yourself/);
  assert.throws(() => plan(source(), [opponent("Actor.a"), opponent("Actor.a")]), /each opponent once/);
  assert.throws(() => plan(source(), []), /at least one/);
  assert.throws(() => plan(source(), [opponent("Actor.a")], { sightConfirmed: false }), /line of sight/);
  assert.throws(() => plan({ activeFeatNames: [] }, [opponent("Actor.a")]), /not been earned/);
});

test("no character carries two Black Cats; a mark from an earlier scene has lapsed", () => {
  const live = { version: 1, sourceUuid: "Actor.other", scene: "s1" },
    old = { ...live, scene: "s0" };
  assert.equal(activeBlackCat(live, periods), live);
  assert.equal(activeBlackCat(old, periods), null);
  assert.equal(activeBlackCat({ ...live, version: 2 }, periods), null);
  assert.throws(() => plan(source(), [opponent("Actor.a", live)]), /already carries a Black Cat/);
  assert.equal(plan(source(), [opponent("Actor.a", old)]).length, 1);
});

test("a marked character's rolls carry +2 error range this scene; rolls without an error range are unchanged", () => {
  const mark = { version: 1, sourceUuid: "Actor.cat", sourceName: "Cat", scene: "s1", toughLuck: true };
  assert.deepEqual(blackCatRollEffect(mark, periods, 1), {
    error: 3,
    record: { sourceUuid: "Actor.cat", sourceName: "Cat", toughLuck: true }
  });
  assert.equal(blackCatRollEffect(mark, periods, 18).error, 19);
  assert.equal(blackCatRollEffect(mark, periods, 0), null);
  assert.equal(blackCatRollEffect(mark, { scene: "s2" }, 1), null);
  assert.equal(blackCatRollEffect(null, periods, 1), null);
  assert.match(
    blackCatNote({ blackCat: { sourceName: "Cat", toughLuck: true } }),
    /Cat\): error range \+2.*Tough Luck/
  );
  assert.equal(blackCatNote({}), "");
});

test("Tough Luck is recorded with the mark and adds 1 to activating the target's threats", () => {
  const marks = plan(source(["Black Cat", "Fortunate"], ["Tough Luck"]), [opponent("Actor.a")]);
  assert.equal(marks[0].mark.toughLuck, true);
  const threat = blackCat => ({
    checkKind: "skill",
    threatConfirmed: true,
    ...(blackCat ? { blackCat } : {})
  });
  const cost = check =>
    criticalPlan({ activeFeatNames: [] }, check, {
      kind: "success",
      baseCost: 1,
      effect: "Effect",
      effectConfirmed: true,
      samePayer: true,
      available: 5
    });
  assert.equal(cost(threat(null)).cost, 1);
  assert.equal(cost(threat({ toughLuck: false })).cost, 1);
  const tough = cost(threat({ toughLuck: true }));
  assert.equal(tough.cost, 2);
  assert.ok(tough.sources.some(s => /Tough Luck/.test(s)));
});

test("a marked character's attack posts with the wider error range, and a reroll does not add it again", async () => {
  const a = actor();
  a.system = prep(a.system, a.items);
  const plain = (await a.rollAttack(a.items[0], opts())).flags.spycraft2;
  a.flags = {
    spycraft2: { blackCat: { version: 1, sourceUuid: "Actor.cat", sourceName: "Cat", scene: "initial" } }
  };
  const marked = (await a.rollAttack(a.items[0], opts())).flags.spycraft2;
  assert.equal(marked.error, plain.error + 2);
  assert.deepEqual(marked.blackCat, { sourceUuid: "Actor.cat", sourceName: "Cat", toughLuck: false });
  // A replacement roll carries the widened error already, so rollCheck must not add the 2 again.
  const skill = extra => a.rollCheck("1d20 + 2", {}, { checkKind: "skill", error: 3, threat: 20, ...extra });
  assert.equal((await skill({})).flags.spycraft2.error, 5);
  const replaced = (await skill({ blackCatApplied: true, blackCat: marked.blackCat })).flags.spycraft2;
  assert.equal(replaced.error, 3);
  assert.deepEqual(replaced.blackCat, marked.blackCat);
});

test("the Main tab shows the GC's control", async () => {
  const html = inlinedSource("systems/spycraft2/templates/actor/agent-main.hbs");
  assert.match(html, /data-action="applyBlackCat"/);
  assert.match(html, /gc-review\.hbs" resource="blackCat"/);
});
