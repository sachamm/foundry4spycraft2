import test from "node:test";
import assert from "node:assert/strict";
import { tooltipText, compactTooltip, buttonIconKind } from "../module/apps/ui-tooltips.mjs";
import { BUTTON_ICONS } from "../module/apps/ui-button-catalog.mjs";
import { readFileSync } from "node:fs";

test("tooltips use compact labels and retain meaningful field distinctions", () => {
  assert.equal(tooltipText({ name: "attackAction" }), "Attack action");
  assert.equal(tooltipText({ name: "aimed" }), "Aim already taken");
  assert.equal(tooltipText({ name: "system.shotsLoaded" }), "Loaded ammo");
  assert.equal(tooltipText({ action: "itemDelete" }), "Remove item");
  assert.equal(tooltipText({ label: "Mission budget", type: "number", min: "0", max: "20" }), "Mission budget (0–20)");
  assert.equal(tooltipText({ label: "+1 round", type: "button" }), "+1 rd");
  assert.equal(tooltipText({ tag: "INPUT" }), "");
  assert.equal(compactTooltip("Use -1 round. Follow any prompts to review the details before confirming."), "-1 rd");
  assert.equal(compactTooltip("+8 hours"), "+8 hr");
  assert.equal(compactTooltip("SPYCRAFT.Round.Label"), "SPYCRAFT.Round.Label");
});

test("each registered function has its own artwork cell", () => {
  const cells = Object.values(BUTTON_ICONS).map(([sheet, index]) => `${sheet}:${index}`);
  assert.equal(new Set(cells).size, cells.length);
  const catalog = JSON.parse(readFileSync(new URL("../assets/ui/functions/catalog.json", import.meta.url)));
  for (const entry of catalog) {
    assert.deepEqual(BUTTON_ICONS[entry.action], [entry.sheet, entry.index]);
  }
});

test("clock increments have distinct paired icons and data variants have dedicated artwork", () => {
  const cells = [];
  for (const seconds of [6, 60, 600, 3600, 28800, 86400]) {
    const plus = buttonIconKind("clockStep", "", { seconds });
    const minus = buttonIconKind("step", "", { seconds: -seconds });
    assert.equal(minus.index, plus.index + 1);
    assert.equal(plus.sheet, "time");
    cells.push(plus.index, minus.index);
  }
  assert.equal(new Set(cells).size, 12);
  assert.notDeepEqual(
    buttonIconKind("missionReport", "", { planned: "true" }),
    buttonIconKind("missionReport", "", { planned: "false" })
  );
  assert.notDeepEqual(
    buttonIconKind("entry", "", { change: "remove" }),
    buttonIconKind("entry", "", { change: "complete" })
  );
});
