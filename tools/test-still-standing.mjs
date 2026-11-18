import test from "node:test";
import assert from "node:assert/strict";
import {
  stillStandingSource as source,
  stillStandingResistancePlan as resistance,
  stillStandingTakedownPlan as save,
  validateStillStandingResistanceProof as validateResistance,
  validateStillStandingSaveProof as validateSave
} from "../module/rules/still-standing.mjs";
const sys = (level = 3, slot = 3) => ({
    classLevels: { brawler: level },
    classOptionSelections: slot ? [{ classId: "brawler", name: "Still Standing", level: slot }] : []
  }),
  context = { checkKind: "save", checkId: "fort" },
  input = { resistingTakedown: true, takedownAttackConfirmed: true };
test("only an actual earned current Brawler Ploy selection supplies Still Standing, once, at every legal Ploy slot", () => {
  for (let level = 0; level <= 10; level++)
    for (const slot of [3, 5, 7, 9]) {
      const s = sys(level, slot);
      if (slot > level && level >= 3) {
        assert.throws(() => source(s));
        continue;
      }
      const p = source(s);
      assert.equal(!!p, level >= 3);
      if (p)
        assert.deepEqual(p, {
          version: 1,
          classId: "brawler",
          ability: "Still Standing",
          classLevel: level,
          selectionLevel: slot
        });
    }
  for (const s of [
    { activeFeatNames: ["Still Standing"] },
    sys(3, 0),
    { ...sys(), classOptionSelections: [{ classId: "soldier", name: "Still Standing", level: 3 }] },
    { ...sys(), classOptionSelections: [{ classId: "brawler", name: "Strut", level: 3 }] }
  ])
    assert.equal(source(s), null);
});
test("both actual resistance types receive exactly four unnamed points, independent of Covert count and other bonuses", () => {
  for (const response of ["trip", "bull-rush"]) {
    assert.equal(resistance(sys(), response).bonus, 4);
    assert.equal(resistance(sys(3, 0), response).bonus, 0);
    const s = sys();
    Object.defineProperty(s, "activeFeatSelections", {
      get() {
        throw Error("Unrelated Covert count read");
      }
    });
    assert.equal(resistance(s, response).bonus, 4);
  }
  for (const response of ["", null, "balance", "attack", "Trip"]) assert.throws(() => resistance(sys(), response));
});
test("only a strictly confirmed actual takedown-attack Fortitude save receives eight, not generic damage or another save", () => {
  assert.equal(save(sys(), input).bonus, 8);
  assert.equal(save(sys(3, 0), input).bonus, 0);
  for (const patch of [
    { saveKey: "will" },
    { saveKey: "ref" },
    { resistingTakedown: "true" },
    { takedownAttackConfirmed: false },
    { takedownAttackConfirmed: "true" }
  ])
    assert.throws(() => save(sys(), { ...input, ...patch }));
});
test("unselected saves and unearned low-level sources do not read private selections or unrelated resources", () => {
  const s = {
    classLevels: { brawler: 2 },
    get classOptionSelections() {
      throw Error("Private selection read");
    }
  };
  assert.equal(source(s), null);
  assert.equal(save(s, { resistingTakedown: false, takedownAttackConfirmed: "old" }), null);
  const hidden = {
    get classLevels() {
      throw Error("Private class read");
    }
  };
  assert.equal(save(hidden), null);
  const actual = sys();
  for (const key of ["abilities", "actionDice", "bonusActionDice", "wounds"])
    Object.defineProperty(actual, key, {
      get() {
        throw Error("Unrelated " + key + " read");
      }
    });
  assert.equal(save(actual, input).bonus, 8);
});
test("malformed class levels, selections and impossible/duplicate Ploy slots require review", () => {
  for (const level of [-1, 11, 3.5, "3", NaN, Infinity]) assert.throws(() => source(sys(level)));
  for (const classOptionSelections of [
    null,
    "Still Standing",
    [null],
    [{ classId: "brawler", name: "Still Standing" }],
    [{ classId: "brawler", name: "Still Standing", level: 4 }],
    [
      { classId: "brawler", name: "Still Standing", level: 3 },
      { classId: "brawler", name: "Still Standing", level: 3 }
    ]
  ])
    assert.throws(() => source({ ...sys(), classOptionSelections }));
});
test("proof binds actual source/slot/level and save or response scope, supports native object order and leaves source data unchanged", () => {
  const s = sys(),
    before = structuredClone(s),
    r = resistance(s, "trip"),
    v = save(s, input),
    reverse = x =>
      Array.isArray(x)
        ? x.map(reverse)
        : x && typeof x === "object"
          ? Object.fromEntries(
              Object.entries(x)
                .reverse()
                .map(([k, n]) => [k, reverse(n)])
            )
          : x;
  validateResistance(s, r, "trip");
  validateResistance(s, reverse(r), "trip");
  validateSave(s, v, context);
  validateSave(s, reverse(v), context);
  for (const target of [sys(3, 0), sys(5)]) {
    assert.throws(() => validateResistance(target, r, "trip"));
    assert.throws(() => validateSave(target, v, context));
  }
  assert.throws(() => validateResistance(s, r, "bull-rush"));
  assert.throws(() => validateSave(s, v, { ...context, checkId: "will" }));
  assert.throws(() => validateSave(s, v, { ...context, checkKind: "skill" }));
  for (const [k, proof] of [
    ["resistance", r],
    ["save", v]
  ])
    for (const field of Object.keys(proof)) {
      const n = structuredClone(proof);
      n[field] = "changed";
      assert.throws(
        () => (k === "resistance" ? validateResistance(s, n, "trip") : validateSave(s, n, context)),
        k + "/" + field
      );
    }
  assert.deepEqual(s, before);
  validateResistance(s, null, "trip");
  validateSave(s, null, context);
});
