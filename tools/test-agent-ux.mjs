/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  groupBuildTasks,
  buildSetupGuide,
  combatToolVisibility,
  activeConditionLabels
} from "../module/sheets/agent-ux.mjs";
import { COMBAT_STANCES } from "../module/rules/combat-stance.mjs";
import { systemDialog } from "../module/apps/dialog-theme.mjs";

test("the dialog skin preserves caller options, callbacks, cancellation and rejected operations", async () => {
  const previous = globalThis.foundry,
    render = () => {},
    options = {
      classes: ["custom"],
      content: '<input name="amount" value="2">',
      render,
      window: { title: "Review" },
      rejectClose: false
    };
  const captured = [];
  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          input: async opts => {
            captured.push(opts);
            return null;
          },
          confirm: async opts => {
            captured.push(opts);
            return false;
          }
        }
      }
    }
  };
  try {
    assert.equal(await systemDialog.input(options), null);
    assert.equal(await systemDialog.confirm(options), false);
    for (const result of captured) {
      assert.equal(result.content, options.content);
      assert.equal(result.render, render);
      assert.equal(result.window, options.window);
      assert.equal(result.rejectClose, false);
      assert.deepEqual(result.classes, ["custom", "spycraft2", "sc2-dialog"]);
    }
    assert.deepEqual(options.classes, ["custom"]);
    foundry.applications.api.DialogV2.input = async () => {
      throw new Error("Rejected operation");
    };
    await assert.rejects(systemDialog.input(options), /Rejected operation/);
  } finally {
    globalThis.foundry = previous;
  }
});

test("repeated build choices are counted without merging different destinations or changing engine data", () => {
  const task = {
    tab: "classes",
    text: "Pointman: choose a skill for Versatility at class level 1.",
    plural: count => `Pointman: choose ${count} more skills for Versatility at class level 1.`
  };
  const input = [task, { ...task }, { ...task }, { tab: "skills", text: task.text }];
  const grouped = groupBuildTasks(input);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].text, "Pointman: choose 3 more skills for Versatility at class level 1.");
  assert.equal(grouped[1].count, 1);
  assert.equal(input[0].text, task.text);
});

test("conditions remain visible when detailed condition actions are collapsed", () => {
  assert.deepEqual(
    activeConditionLabels({
      conditionContext: { blinded: true, held: false },
      conditionPenalties: { sickened: 2 },
      mentalLeapState: { fatigued: true },
      shakenState: { label: "Shaken II" }
    }),
    ["Blinded", "Sickened", "Fatigued", "Shaken II"]
  );
  assert.deepEqual(activeConditionLabels(), []);
});

test("setup guide chooses the earliest rules reminder and retains distinct level and browse destinations", () => {
  const tasks = [
    { order: 30, tab: "skills", skillLevel: 4, text: "Spend skill points." },
    { order: 1, tab: "main", browse: { type: "origin", originType: "talent" }, text: "Choose a talent." },
    { order: 30, tab: "skills", skillLevel: 2, text: "Spend skill points." },
    { order: 21, tab: "classes", text: "Choose Versatility." },
    { order: 21, tab: "classes", text: "Choose Versatility." }
  ];
  const before = structuredClone(tasks),
    guide = buildSetupGuide(tasks);
  assert.equal(guide.next.text, "Choose a talent.");
  assert.equal(guide.next.browse.originType, "talent");
  assert.equal(guide.count, 5);
  assert.deepEqual(
    guide.steps.map(step => [step.tab, step.count]),
    [
      ["main", 1],
      ["classes", 2],
      ["skills", 2]
    ]
  );
  assert.deepEqual(
    guide.steps[2].tasks.map(task => task.skillLevel),
    [4, 2]
  );
  assert.deepEqual(tasks, before);
  assert.deepEqual(buildSetupGuide(), { next: null, count: 0, steps: [] });
});

test("combat shortcuts follow earned feats while saved declarations remain accessible after a feat is lost", () => {
  const blank = combatToolVisibility({}, COMBAT_STANCES);
  assert.ok(Object.values(blank).every(value => value === false));
  const earned = combatToolVisibility(
    { activeFeatNames: ["Polearm Basics", "Combat Expertise", "Superior Cover", "Flashing Weapon"] },
    COMBAT_STANCES
  );
  assert.equal(earned.stance, true);
  assert.equal(earned.movement, true);
  assert.equal(earned.striking, true);
  assert.equal(earned.expertise, true);
  assert.equal(earned.cover, true);
  assert.equal(earned.darting, false); // Flashing Weapon alone cannot grant Darting Weapon's action.
  const saved = combatToolVisibility(
    {
      combatStance: { key: "striking" },
      stanceRoundMovement: {},
      dartingStyle: {},
      twoWeaponStyle: {},
      combatExpertise: {},
      superiorCover: {}
    },
    COMBAT_STANCES
  );
  for (const key of ["stance", "movement", "darting", "twoWeapon", "expertise", "cover"])
    assert.equal(saved[key], true);
});

test("feat-specific outcome tools appear only with their feat, unless the GC asks for every tool", () => {
  const intruder = combatToolVisibility({ activeFeatNames: ["Combat Instincts"] }, COMBAT_STANCES);
  for (const key of ["fend", "threadNeedle", "stanceDamage", "drivingStance", "powerStance"])
    assert.equal(intruder[key], false, key);
  const armed = combatToolVisibility(
    { activeFeatNames: ["Polearm Basics", "Staff Basics", "Axe Basics", "Hammer Basics", "Great Sword Basics"] },
    COMBAT_STANCES
  );
  for (const key of ["fend", "threadNeedle", "stanceDamage", "drivingStance", "powerStance"])
    assert.equal(armed[key], true, key);
  assert.equal(combatToolVisibility({ combatStance: { key: "power" } }, COMBAT_STANCES).powerStance, true);
  const all = combatToolVisibility({}, COMBAT_STANCES, { showAll: true });
  assert.ok(Object.values(all).every(value => value === true));
});
