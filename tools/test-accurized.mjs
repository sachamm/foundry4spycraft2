import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accurizedAttackPlan as plan, validateAccurizedProof as validate } from "../module/rules/accurized.mjs";
test("ACC adds exactly one threat-range point only when the actual attack is both trained and aimed", () => {
  for (const accurized of [false, true])
    for (const trained of [false, true])
      for (const aimed of [false, true]) {
        const p = plan({ qualities: accurized ? "ACC, MAC (-2)" : "" }, { trained, aimed });
        assert.equal(p.threatIncrease, accurized && trained && aimed ? 1 : 0);
        assert.deepEqual(p, {
          version: 1,
          accurized,
          trained,
          aimed,
          threatIncrease: accurized && trained && aimed ? 1 : 0
        });
      }
});
test("all 26 catalog ACC weapons grant the same quality benefit without inferring it from model names or neighboring quality abbreviations", () => {
  const rows = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons.filter(w =>
    /\bACC\b/.test(w.qualities)
  );
  assert.equal(rows.length, 26);
  for (const w of rows) assert.equal(plan(w, { trained: true, aimed: true }).threatIncrease, 1, w.name);
  for (const qualities of ["", "MAC (-2), INS", "ACCURIZED", "XACC", "ACCENT"])
    assert.equal(plan({ name: "Accurized rifle", qualities }, { trained: true, aimed: true }).threatIncrease, 0);
  assert.equal(plan({ qualities: "ACC, ACC" }, { trained: true, aimed: true }).threatIncrease, 1);
});
test("proficiency and valid Aim must be strict actual booleans and malformed or mutually exclusive quality data requires review", () => {
  for (const patch of [
    { trained: "true" },
    { trained: 1 },
    { trained: null },
    { aimed: "true" },
    { aimed: 1 },
    { aimed: null }
  ])
    assert.throws(() => plan({ qualities: "ACC" }, patch), /Review/);
  for (const qualities of [1, {}, [], true]) assert.throws(() => plan({ qualities }), /Review/);
  for (const qualities of ["ACC, INA (-1)", "IMP, ACC", "ACC, INA (-1), IMP"])
    assert.throws(() => plan({ qualities }, { trained: true, aimed: true }), /mutually exclusive/);
  assert.equal(plan({ qualities: "INA (-1)" }, { trained: true, aimed: true }).threatIncrease, 0);
});
test("the pure plan never alters damage, error, time or resources and reads no unrelated character or weapon data", () => {
  const w = { qualities: "ACC", error: 2, threat: 20, damage: "2d10", quantity: 1 },
    before = structuredClone(w);
  for (const key of ["abilities", "actionDice", "classLevels", "activeFeatNames", "equipped"])
    Object.defineProperty(w, key, {
      get() {
        throw Error("Unused " + key);
      }
    });
  const p = plan(w, { trained: true, aimed: true });
  assert.deepEqual(w, before);
  assert.equal(Object.hasOwn(p, "error"), false);
  assert.equal(Object.hasOwn(p, "damage"), false);
  assert.equal(Object.hasOwn(p, "time"), false);
});
test("immutable proof binds quality gain/loss, current training and valid Aim, accepts native key order and leaves absent older contexts compatible", () => {
  const w = { qualities: "ACC" },
    c = { checkKind: "attack", trained: true, aimed: true },
    p = plan(w, c);
  validate(w, p, c);
  validate(w, Object.fromEntries(Object.entries(p).reverse()), c);
  for (const [weapon, context] of [
    [{ qualities: "" }, c],
    [w, { ...c, trained: false }],
    [w, { ...c, aimed: false }],
    [w, { ...c, checkKind: "damage" }]
  ])
    assert.throws(() => validate(weapon, p, context), /changed/);
  assert.throws(() => validate(w, plan({ qualities: "" }, c), c), /changed/);
  const n = structuredClone(p);
  n.threatIncrease = 99;
  assert.throws(() => validate(w, n, c), /changed/);
  validate(w, null, c);
});
test("ordinary and no-ACC zero proofs retain actual training/Aim facts so late gains or changes cannot silently alter a replacement", () => {
  const w = { qualities: "" },
    c = { checkKind: "attack", trained: false, aimed: false },
    p = plan(w, c);
  validate(w, p, c);
  assert.throws(() => validate(w, p, { ...c, trained: true }), /changed/);
  assert.throws(() => validate(w, p, { ...c, aimed: true }), /changed/);
  assert.throws(() => validate({ qualities: "ACC" }, p, c), /changed/);
});
