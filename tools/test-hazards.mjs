import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRE_AP,
  SCAR_SAVE_DC,
  SCAR_THRESHOLD,
  attributeLoss,
  burningRoundPlan,
  contagionDue,
  contagionLabel,
  contagionSaveOutcome,
  contagionSavePlan,
  cureContagion,
  dosePenalty,
  exposurePlan,
  fireAP,
  fireDamagePlan,
  hazardState,
  ignitePlan,
  lethalDamagePlan,
  parseEffects,
  parseOnset,
  reduceFire,
  rollOnGround,
  scarChecked
} from "../module/rules/hazards.mjs";
import { CONTAGIONS } from "../module/rules/tables.mjs";
import { checkRecord } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";
import { planTerms } from "../module/rules/roll-pipeline.mjs";

const find = (name, grade = "") => CONTAGIONS.find(c => c.name === name && (c.grade ?? "") === grade);
const DAY = 86400;

test("every onset time and effect in the Contagions table can be read", () => {
  assert.ok(CONTAGIONS.length >= 70);
  const kinds = new Set();
  for (const contagion of CONTAGIONS)
    for (const phase of [contagion.primary, contagion.secondary]) {
      const onset = parseOnset(phase.onset);
      assert.match(onset.formula, /^\d+(d\d+)?$/, `${contagion.name}: ${phase.onset}`);
      assert.ok(onset.seconds > 0);
      const effects = parseEffects(phase.effect);
      assert.ok(effects.length, `${contagion.name}: ${phase.effect}`);
      for (const effect of effects) {
        assert.notEqual(effect.kind, "note", `${contagion.name}: unread effect "${phase.effect}"`);
        kinds.add(effect.kind);
      }
    }
  assert.deepEqual([...kinds].sort(), ["attribute", "condition", "lethal"]);
});

test("onset times and effects parse to dice, units, attributes and permanence", () => {
  assert.deepEqual(parseOnset("3d4 days"), { formula: "3d4", unit: "day", seconds: DAY });
  assert.deepEqual(parseOnset("1d4 rounds"), { formula: "1d4", unit: "round", seconds: 6 });
  assert.equal(parseOnset("2d4 months").seconds, 30 * DAY);
  assert.throws(() => parseOnset("soon"), /Unreadable onset/);
  assert.deepEqual(parseEffects("1d4 Con (half permanent), 1d6 Str, 1 Cha"), [
    { kind: "attribute", formula: "1d4", ability: "con", permanent: "half" },
    { kind: "attribute", formula: "1d6", ability: "str", permanent: "none" },
    { kind: "attribute", formula: "1", ability: "cha", permanent: "none" }
  ]);
  assert.deepEqual(parseEffects("2d6 Con (permanent)"), [
    { kind: "attribute", formula: "2d6", ability: "con", permanent: "all" }
  ]);
  assert.deepEqual(parseEffects("Stunned for 1d6 rounds"), [
    { kind: "condition", condition: "stunned", formula: "1d6", unit: "round", seconds: 6 }
  ]);
  assert.deepEqual(parseEffects("2d6 lethal damage"), [{ kind: "lethal", formula: "2d6" }]);
  assert.deepEqual(parseEffects("Something odd"), [{ kind: "note", text: "Something odd" }]);
  assert.deepEqual(parseEffects(""), []);
});

test("an attribute loss splits into permanent and temporary parts, half permanent rounding down", () => {
  const con = permanent => ({ ability: "con", permanent });
  assert.deepEqual(attributeLoss(con("none"), 3), [{ ability: "con", kind: "temporary", amount: 3 }]);
  assert.deepEqual(attributeLoss(con("all"), 3), [{ ability: "con", kind: "permanent", amount: 3 }]);
  assert.deepEqual(attributeLoss(con("half"), 5), [
    { ability: "con", kind: "permanent", amount: 2 },
    { ability: "con", kind: "temporary", amount: 3 }
  ]);
  assert.deepEqual(attributeLoss(con("half"), 1), [{ ability: "con", kind: "temporary", amount: 1 }]);
  assert.deepEqual(attributeLoss(con("none"), 0), []);
});

test("extra doses lower the saves by 1 each, to -10", () => {
  assert.equal(dosePenalty(1), 0);
  assert.equal(dosePenalty(2), -1);
  assert.equal(dosePenalty(11), -10);
  assert.equal(dosePenalty(40), -10);
  assert.equal(dosePenalty(undefined), 0);
});

test("exposure starts the primary onset; a further dose joins the active case without a new clock", () => {
  const ecoli = find("E coli");
  const first = exposurePlan(hazardState({}), ecoli, { id: "c1", worldTime: 1000, onsetRoll: 7 });
  assert.equal(first.added, true);
  assert.equal(first.entry.dueAt, 1000 + 7 * DAY);
  assert.equal(first.entry.phase, "primary");
  assert.equal(contagionDue(first.entry, 1000 + 7 * DAY - 1), false);
  assert.equal(contagionDue(first.entry, 1000 + 7 * DAY), true);
  const again = exposurePlan(first.hazards, ecoli, { id: "c2", worldTime: 5000, onsetRoll: 3, doses: 2 });
  assert.equal(again.added, false);
  assert.deepEqual(Object.keys(again.hazards.contagions), ["c1"]);
  assert.equal(again.entry.doses, 3);
  assert.equal(again.entry.dueAt, first.entry.dueAt);
  assert.deepEqual(contagionSavePlan(again.entry), {
    id: "c1",
    label: "E coli",
    phase: "primary",
    dc: 12,
    dosePenalty: -2,
    suitBonus: 0,
    effect: "1 Con"
  });
  assert.throws(() => exposurePlan(hazardState({}), ecoli, { id: "x", worldTime: 0, onsetRoll: 0 }), /Roll the onset/);
  assert.throws(() => exposurePlan(hazardState({}), ecoli, { id: "x", worldTime: 0, onsetRoll: 2, doses: 0 }), /doses/);
  assert.throws(
    () => exposurePlan(hazardState({}), null, { id: "x", worldTime: 0, onsetRoll: 2 }),
    /Choose a contagion/
  );
  assert.equal(checkRecord(RECORD_SHAPES.hazards, first.hazards).length, 0, "the stored record fits its shape");
});

test("a failed save applies the phase's effect and starts the secondary clock; a success ends the contagion", () => {
  const typhus = find("Typhus fever");
  const { hazards, entry } = exposurePlan(hazardState({}), typhus, { id: "c1", worldTime: 0, onsetRoll: 5 });
  assert.equal(contagionSavePlan(entry).dc, 14);
  const failed = contagionSaveOutcome(hazards, "c1", { succeeded: false, worldTime: 5 * DAY, onsetRoll: 4 });
  assert.equal(failed.recovered, false);
  assert.deepEqual(
    failed.effects.map(e => `${e.formula} ${e.ability}`),
    ["1 con", "1 str"]
  );
  assert.equal(failed.entry.phase, "secondary");
  assert.equal(failed.entry.dueAt, 9 * DAY);
  assert.equal(contagionSavePlan(failed.entry).dc, 16);
  // The secondary phase repeats until a save succeeds.
  const again = contagionSaveOutcome(failed.hazards, "c1", { succeeded: false, worldTime: 9 * DAY, onsetRoll: 3 });
  assert.equal(again.entry.phase, "secondary");
  assert.equal(again.entry.saves, 2);
  assert.deepEqual(
    again.effects.map(e => e.formula),
    ["1d4", "1d4"]
  );
  const cured = contagionSaveOutcome(again.hazards, "c1", { succeeded: true });
  assert.equal(cured.recovered, true);
  assert.deepEqual(cured.hazards.contagions, {});
  assert.throws(() => contagionSaveOutcome(cured.hazards, "c1", { succeeded: true }), /no longer being tracked/);
  assert.throws(() => contagionSaveOutcome(hazards, "c1", {}), /needs a result/);
  assert.throws(() => contagionSaveOutcome(hazards, "c1", { succeeded: false, worldTime: 1 }), /Roll the onset/);
});

test("a disease that can be caught once is remembered; an antidote before it takes hold is not immunity", () => {
  const pox = CONTAGIONS.find(c => c.notes.includes("oneTime"));
  assert.ok(pox, "the table has a one-time disease");
  const label = contagionLabel(pox);
  const exposed = exposurePlan(hazardState({}), pox, { id: "c1", worldTime: 0, onsetRoll: 2 });
  const early = cureContagion(exposed.hazards, "c1");
  assert.deepEqual(early.recovered, []);
  const failed = contagionSaveOutcome(exposed.hazards, "c1", { succeeded: false, worldTime: 10, onsetRoll: 2 });
  const recovered = contagionSaveOutcome(failed.hazards, "c1", { succeeded: true });
  assert.deepEqual(recovered.hazards.recovered, [label]);
  assert.throws(
    () => exposurePlan(recovered.hazards, pox, { id: "c2", worldTime: 20, onsetRoll: 2 }),
    /cannot be caught a second time/
  );
  assert.deepEqual(cureContagion(failed.hazards, "c1").recovered, [label]);
  assert.equal(cureContagion(failed.hazards, "missing"), failed.hazards);
});

test("radiation poison comes in three grades and a sealed suit helps only its first save", () => {
  const grades = CONTAGIONS.filter(c => c.name === "Radiation poison").map(c => c.grade);
  assert.deepEqual(grades, ["basic", "improved", "advanced"]);
  const { hazards, entry } = exposurePlan(hazardState({}), find("Radiation poison", "basic"), {
    id: "r",
    worldTime: 0,
    onsetRoll: 4
  });
  assert.equal(entry.label, "Radiation poison (basic)");
  assert.equal(entry.dueAt, 24);
  assert.equal(contagionSavePlan(entry, { sealedSuit: true }).suitBonus, 10);
  const failed = contagionSaveOutcome(hazards, "r", { succeeded: false, worldTime: 24, onsetRoll: 4 });
  assert.deepEqual(failed.effects, [{ kind: "lethal", formula: "1d6" }]);
  assert.equal(contagionSavePlan(failed.entry, { sealedSuit: true }).suitBonus, 0);
  const ecoli = exposurePlan(hazardState({}), find("E coli"), { id: "e", worldTime: 0, onsetRoll: 4 });
  assert.equal(contagionSavePlan(ecoli.entry, { sealedSuit: true }).suitBonus, 0);
});

test("fire's armor-piercing value follows its temperature (Table 5.7)", () => {
  assert.deepEqual(
    FIRE_AP.map(band => band.ap),
    [4, 8, 12, 16, 20, 24, 28]
  );
  assert.equal(fireAP(200), 0);
  assert.equal(fireAP(451), 4);
  assert.equal(fireAP(500), 4);
  assert.equal(fireAP(501), 8);
  assert.equal(fireAP(900), 12);
  assert.equal(fireAP(1100), 16);
  assert.equal(fireAP(2400), 20);
  assert.equal(fireAP(4500), 24);
  assert.equal(fireAP(50000), 28);
});

test("a burning character takes the fire's damage each round until it is put out", () => {
  let hazards = ignitePlan(hazardState({}), { damage: 13, ap: 16, worldTime: 60 });
  assert.deepEqual(hazards.fire, { damage: 13, ap: 16, suffered: 0, scarChecked: false, startedAt: 60 });
  assert.equal(checkRecord(RECORD_SHAPES.hazards, hazards).length, 0);
  const first = burningRoundPlan(hazards);
  assert.equal(first.damage, 13);
  assert.equal(first.fire.suffered, 13);
  assert.equal(first.scarSaveDue, false);
  const second = burningRoundPlan(first.hazards);
  assert.equal(second.fire.suffered, 26);
  assert.equal(second.scarSaveDue, true, `${SCAR_THRESHOLD} points from one fire call for the DC ${SCAR_SAVE_DC} save`);
  hazards = scarChecked(second.hazards);
  assert.equal(burningRoundPlan(hazards).scarSaveDue, false, "the save is made once per fire");
  // Rolling halves, rounded down; water and blankets take dice off; at 0 the fire is out.
  hazards = rollOnGround(hazards);
  assert.equal(hazards.fire.damage, 6);
  hazards = reduceFire(hazards, 4);
  assert.equal(hazards.fire.damage, 2);
  hazards = rollOnGround(hazards);
  assert.equal(hazards.fire.damage, 1);
  assert.equal(rollOnGround(hazards).fire, null);
  assert.equal(reduceFire(hazards, 5).fire, null);
  assert.throws(() => burningRoundPlan(hazardState({})), /not on fire/);
});

test("a hotter fire replaces a cooler one and keeps the running total; fire in a square counts only while burning", () => {
  const cool = ignitePlan(hazardState({}), { damage: 5, ap: 4 });
  const tracked = { ...cool, fire: { ...cool.fire, suffered: 12 } };
  assert.equal(ignitePlan(tracked, { damage: 3, ap: 4 }), tracked);
  const hot = ignitePlan(tracked, { damage: 9, ap: 12 });
  assert.equal(hot.fire.damage, 9);
  assert.equal(hot.fire.ap, 12);
  assert.equal(hot.fire.suffered, 12);
  assert.equal(ignitePlan(hazardState({}), { damage: 0 }).fire, null);
  assert.throws(() => ignitePlan(hazardState({}), { damage: 2.5 }), /whole number/);
  assert.deepEqual(fireDamagePlan(null, 11), { fire: null, damage: 11, scarSaveDue: false });
});

test("lethal damage comes off vitality first, then wounds", () => {
  const system = { vitality: { value: 10 }, wounds: { value: 12 } };
  assert.deepEqual(lethalDamagePlan(system, 4), { vitality: 6, wounds: 12, vitalityLoss: 4, woundLoss: 0 });
  assert.deepEqual(lethalDamagePlan(system, 15), { vitality: 0, wounds: 7, vitalityLoss: 10, woundLoss: 5 });
  assert.deepEqual(lethalDamagePlan(system, 30), { vitality: 0, wounds: -8, vitalityLoss: 10, woundLoss: 20 });
  assert.deepEqual(lethalDamagePlan(system, 0), { vitality: 10, wounds: 12, vitalityLoss: 0, woundLoss: 0 });
});

test("a save against a hazard carries the hazard's DC, dose penalty and suit bonus as a term of the save", () => {
  const terms = planTerms("save", {
    actor: { mentalLeapCombatContext: () => null, flags: {} },
    system: { conditionContext: {}, classLevels: {}, activeFeatNames: [] },
    saveKey: "fort",
    input: {},
    options: { hazardSave: { kind: "contagion", label: "E coli", dc: 12, dosePenalty: -2, suitBonus: 10 } }
  });
  const term = terms.list.find(t => t.id === "hazardSaveTerm");
  assert.deepEqual(term.rows, [
    ["Extra doses", -2],
    ["Protective gear", 10]
  ]);
  assert.equal(term.flavor, " — E coli DC 12");
  assert.equal(
    planTerms("save", {
      actor: { mentalLeapCombatContext: () => null, flags: {} },
      system: { conditionContext: {}, classLevels: {}, activeFeatNames: [] },
      saveKey: "fort",
      input: {},
      options: {}
    }).list.some(t => t.id === "hazardSaveTerm"),
    false
  );
});
