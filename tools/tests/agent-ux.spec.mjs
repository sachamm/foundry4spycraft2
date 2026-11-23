/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { readFileSync } from "node:fs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";
import { createEnvironment } from "../lib/hbs-harness.mjs";
const sheetUX = readFileSync(new URL("../../module/sheets/agent-ux.mjs", import.meta.url), "utf8");
const skillUX = readFileSync(new URL("../../module/apps/skill-dialog-ux.mjs", import.meta.url), "utf8");
const css = systemCss();

// The modules import the translation tag; a page script cannot resolve that path, so it is inlined.
const i18n = readFileSync(new URL("../../module/i18n.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
const inline = source =>
  source
    .replace(/^import \{ loc(?:, locKey)? \} from "[^"]+";\n/m, `${i18n}\n`)
    .replace('"./dialog-sections.mjs"', JSON.stringify(uiModuleUrl("module/apps/dialog-sections.mjs")))
    .replace('"./resolution-guide.mjs"', JSON.stringify(uiModuleUrl("module/apps/resolution-guide.mjs")));

async function load(page, source, name) {
  await page.addScriptTag({ type: "module", content: `${inline(source)}\nwindow.${name}=${name};` });
  await page.waitForFunction(name => typeof window[name] === "function", name);
}

test("Play/Edit preserves resource access, disables build fields and supports keyboard actions and skill filtering", async ({
  page
}) => {
  await page.setContent(`<style>${css}</style><div class="spycraft2 application sheet agent">
    <input name="system.vitality.value" value="11" />
    <div class="edit-only"><input name="system.abilities.str.base" value="10" /><input name="granted" disabled /></div>
    <input class="edit-only" name="system.xp" value="0" />
    <button type="button" class="sc2-action" data-action="rollSave" data-save="fort">Fortitude</button>
    <button type="button" class="sc2-action" data-action="itemDelete" data-tooltip="SPYCRAFT.Origin.Remove" aria-label="Remove talent"><i aria-hidden="true"></i></button>
    <div class="play-only" data-testid="play-dashboard">Combat tools</div>
    <input class="skill-search" /><input class="trained-filter" type="checkbox" /><span class="skill-count"></span>
    <table class="skills-table"><tbody><tr data-skill-name="Athletics STR/CON" data-trained="true"><td>Athletics</td></tr><tr data-skill-name="Bluff CHA" data-trained="false"><td>Bluff</td></tr></tbody></table>
  </div>`);
  await load(page, sheetUX, "enhanceAgentSheet");
  await page.evaluate(() => {
    window.state = { _skillSearch: "", _trainedOnly: false };
    window.root = document.querySelector(".agent");
    window.enhanceAgentSheet(window.root, { editMode: false }, window.state);
  });
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeHidden();
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeDisabled();
  await expect(page.locator('[name="system.xp"]')).toBeDisabled();
  await expect(page.locator('[name="system.vitality.value"]')).toBeEnabled();
  const action = page.getByRole("button", { name: "Fortitude" });
  await expect(page.getByRole("button", { name: "Remove talent" })).toBeVisible();
  await expect(page.getByTestId("play-dashboard")).toBeVisible();
  await action.focus();
  await expect(action).toBeFocused();
  await page.locator(".skill-search").fill("CHA");
  await expect(page.locator('[data-skill-name="Athletics STR/CON"]')).toBeHidden();
  await expect(page.locator(".skill-count")).toHaveText("1 of 2 skills");
  await page.locator(".skill-search").fill("");
  await page.locator(".trained-filter").check();
  await expect(page.locator('[data-skill-name="Bluff CHA"]')).toBeHidden();
  await page.evaluate(() => window.enhanceAgentSheet(window.root, { editMode: true }, window.state));
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeVisible();
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeEnabled();
  await expect(page.locator('[name="granted"]')).toBeDisabled();
  await expect(page.getByTestId("play-dashboard")).toBeHidden();
  await expect(page.locator(".trained-filter")).toBeChecked();
});

test("named check changes show relevant circumstances, omit stale inputs and update the roll button", async ({
  page
}) => {
  await page.setContent(`<form><div class="spycraft2-roll-options">
    <select name="check"><option value="balance">Balance Check</option><option value="tumble">Tumble Check</option><option value="repair">Repair Check</option></select>
    <select name="ability"><option value="dex">DEX</option><option value="int">INT</option></select>
    <details><summary>Balance</summary><input name="balanceCircumstances" type="checkbox" /><input name="balanceSurface" value="slippery" /></details>
    <details><summary>Tumble</summary><input name="tumbleCircumstances" type="checkbox" /></details>
    <details><summary>Gear</summary><select name="gearStatus"><option value="unknown">Choose gear</option></select></details>
    <details><summary>Timing</summary><label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10</option></select></label></details>
    <input name="modifier" value="0" />
  </div><button type="button" data-action="ok">Confirm</button></form>`);
  await load(page, skillUX, "enhanceSkillDialog");
  await page.evaluate(() =>
    window.enhanceSkillDialog(null, { element: document.querySelector("form") }, [
      { id: "balance", attributes: ["dex"], tags: "Vision" },
      { id: "tumble", attributes: ["dex"], tags: "Vision" },
      { id: "repair", attributes: ["int"], tags: "Gear" }
    ])
  );
  await expect(page.locator(".sc2-check-context summary")).toHaveText("Balance");
  await expect(page.locator('[data-action="ok"]')).toHaveText("Roll Balance Check");
  await expect(page.locator('[name="method"]')).toBeVisible();
  await page.locator("details.sc2-check-context").evaluate(el => (el.open = true));
  await page.locator('[name="balanceCircumstances"]').check();
  await page.locator('[name="check"]').selectOption("tumble");
  await expect(page.locator('[name="balanceCircumstances"]')).toBeDisabled();
  await expect(page.locator(".sc2-check-context summary")).toHaveText("Tumble");
  const data = await page.locator("form").evaluate(form => Object.fromEntries(new FormData(form)));
  expect(data).not.toHaveProperty("balanceCircumstances");
  expect(data).not.toHaveProperty("balanceSurface");
  await page.locator('[name="check"]').selectOption("repair");
  await expect(page.locator('[name="ability"]')).toHaveValue("int");
  await expect(page.locator(".sc2-check-context summary")).toHaveText("Gear");
  await page.locator(".sc2-advanced-options").evaluate(el => (el.open = true));
  await page.locator('[name="method"]').selectOption("take10");
  await expect(page.locator('[data-action="ok"]')).toHaveText("Take 10: Repair Check");
  await expect(page.locator('[data-action="ok"]')).toHaveAccessibleName("Take 10: Repair Check");
});

test("combat disclosures retain independent open states across a complete sheet render", async ({ page }) => {
  const markup = `<div class="spycraft2 application sheet agent"><details data-key="combat-attacks"><summary>Attacks and reactions</summary><button type="button" class="sc2-action" data-action="rollDisarm">Disarm</button></details><details data-key="combat-review"><summary>GC review</summary><button type="button" class="sc2-action" data-action="reviewCounterTrip">Recover counter-Trip</button></details></div>`;
  await page.setContent(`<style>${css}</style>${markup}`);
  await load(page, sheetUX, "enhanceAgentSheet");
  await page.evaluate(() => {
    window.preferences = { _skillSearch: "", _trainedOnly: false };
    window.enhanceAgentSheet(document.querySelector(".agent"), { editMode: false }, window.preferences);
  });
  await page.getByText("GC review", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Recover counter-Trip" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.preferences._open["combat-review"])).toBe(true);
  await page.evaluate(markup => {
    document.querySelector(".agent").outerHTML = markup;
    window.enhanceAgentSheet(document.querySelector(".agent"), { editMode: false }, window.preferences);
  }, markup);
  await expect(page.getByRole("button", { name: "Recover counter-Trip" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disarm", exact: true })).toBeHidden();
  await page.getByText("GC review", { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.preferences._open["combat-review"])).toBe(false);
});

test("setup navigation opens the correct collapsed controls without focusing the skill search or changing resources", async ({
  page
}) => {
  await page.setContent(`<div class="spycraft2 application sheet agent">
    <input name="system.vitality.value" value="11" />
    <section data-tab="gear"><details><summary>Mission planning</summary><input name="system.wealthAllocation.lifestyle" value="0" /></details></section>
    <section data-tab="skills"><input class="skill-search" /><input name="skillpts.athletics" value="0" /></section>
    <section data-tab="training"><input name="system.proficiencies.edged.proficient" type="checkbox" /><textarea name="system.interests"></textarea></section>
  </div>`);
  await load(page, sheetUX, "focusSetupTask");
  await page.evaluate(() => window.focusSetupTask(document.querySelector(".agent"), { tab: "gear", order: "60" }));
  await expect(page.locator('[name="system.wealthAllocation.lifestyle"]')).toBeFocused();
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await page.evaluate(() => window.focusSetupTask(document.querySelector(".agent"), { tab: "skills", order: "30" }));
  await expect(page.locator('[name="skillpts.athletics"]')).toBeFocused();
  await page.evaluate(() => window.focusSetupTask(document.querySelector(".agent"), { tab: "training", order: "52" }));
  await expect(page.locator('[name="system.interests"]')).toBeFocused();
  await expect(page.locator('[name="system.vitality.value"]')).toHaveValue("11");
  await expect(page.locator('[name="skillpts.athletics"]')).toHaveValue("0");
});

for (const width of [560, 820])
  test(`primary rolls and combat tools have usable targets without horizontal overflow at ${width}px`, async ({
    page
  }) => {
    await page.setContent(`<style>*{box-sizing:border-box}${css}</style><div class="spycraft2 application sheet agent play-mode" style="width:${width}px">
    <div class="window-content"><div class="defense-summary"><div class="stat-grid">
      <button type="button" class="stat sc2-stat-action" data-action="rollSave"><span>Fortitude</span><b>+2</b></button>
      <div class="stat">Defense<b>13</b></div>
    </div></div>
    <button type="button" class="sc2-primary-action sc2-action" data-action="rollAttack">Attack: A weapon with a long but ordinary descriptive name</button>
    <div class="combat-tool-groups"><details class="combat-tool-group" data-key="combat-outcomes"><summary><span>Recorded outcomes</span><small>Resolve an attack already rolled</small></summary><div class="tool-actions"><button type="button" class="sc2-action" data-action="manageTakedown">Takedown saves/outcomes</button><button type="button" class="sc2-action" data-action="manageMeleeTradeoff">Recorded attack benefits</button></div></details><details class="combat-tool-group"><summary>Defense and damage</summary></details></div>
    </div></div>`);
    await load(page, sheetUX, "enhanceAgentSheet");
    await page.evaluate(() => {
      window.prefs = {};
      window.enhanceAgentSheet(document.querySelector(".agent"), { editMode: false }, window.prefs);
      window.rolls = 0;
      document.querySelector('[data-action="rollSave"]').addEventListener("click", () => window.rolls++);
    });
    const save = page.getByRole("button", { name: "Fortitude +2" });
    expect((await save.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await save.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.rolls)).toBe(2);
    expect((await page.locator('[data-action="rollAttack"]').boundingBox()).height).toBeGreaterThanOrEqual(32);
    await page.getByText("Recorded outcomes", { exact: true }).click();
    expect(
      (await page.getByRole("button", { name: "Takedown saves/outcomes" }).boundingBox()).height
    ).toBeGreaterThanOrEqual(32);
    expect(await page.locator(".window-content").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

const settings = readFileSync(new URL("../../module/settings.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
const dialogUX = readFileSync(new URL("../../module/apps/dialog-theme.mjs", import.meta.url), "utf8").replace(
  /^import \{ readSetting \} from "[^"]+";\n/m,
  `${settings}\n`
);

for (const height of [600, 800])
  test(`system dialogs keep the dossier theme and confirmation reachable with expanded content at ${height}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 1000, height });
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}.application{display:flex;flex-direction:column;position:fixed;left:20px;top:20px;width:560px;padding:0;margin:0}.window-header{padding:8px}.window-content{padding:12px}.standard-form{display:flex;flex-direction:column;gap:12px}footer{display:flex}input,button{font:16px sans-serif}${css}</style>
  <dialog open class="application dialog" id="system-dialog"><header class="window-header">Skill check</header><div class="window-content"><form class="dialog-form standard-form"><div class="dialog-content"><div class="spycraft2-roll-options"><label>Modifier <input name="modifier" value="2"></label><input name="unavailable" value="ignored" disabled><details><summary>Advanced options</summary><div style="height:900px">Long options</div><label>Last option <input name="last" value="unchanged"></label></details></div></div><footer class="form-footer"><button type="button" data-action="ok">Roll selected check</button></footer></form></div></dialog>
  <div class="application dialog" id="unrelated" style="left:650px;width:250px"><div class="window-content">Unrelated Foundry dialog</div></div>`);
    await load(page, dialogUX, "themeSystemDialog");
    const before = await page.locator("form").evaluate(form => Object.fromEntries(new FormData(form)));
    await page.evaluate(() => {
      window.themeSystemDialog({ element: document.querySelector("#system-dialog") });
      window.themeSystemDialog({ element: document.querySelector("#unrelated") });
    });
    await expect(page.locator("#system-dialog")).toHaveClass(/sc2-dialog/);
    await expect(page.locator("#unrelated")).not.toHaveClass(/spycraft2/);
    await page.getByText("Advanced options", { exact: true }).click();
    await page.getByLabel("Last option").scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Last option")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Roll selected check" })).toBeInViewport();
    expect(await page.locator("form").evaluate(form => Object.fromEntries(new FormData(form)))).toEqual(before);
  });

test("the gear tab's own markup names its controls and keeps each item action on its row", async ({ page }) => {
  // The real template, so the names under test are the ones the sheet authors, not a copy of them.
  const weapon = {
    item: {
      id: "weapon",
      name: `Reviewed weapon ${"Descriptive ".repeat(12)}`,
      system: { equipped: true, damage: "1d10+1" }
    },
    attack: { trained: true, total: 3, range: 25, firearm: true, fireModeLabel: "Single-Shot", error: 1, threat: 20 },
    caliber: 2
  };
  const gear = createEnvironment().render("systems/spycraft2/templates/actor/agent-gear.hbs", {
    weapons: [weapon],
    armor: [{ item: { id: "armor", name: "Wide armor", system: { equipped: false } } }]
  });
  await page.setContent(
    `<style>*{box-sizing:border-box}${css}</style><div class="spycraft2 application sheet agent" style="width:560px">${gear}</div>`
  );
  await load(page, sheetUX, "enhanceAgentSheet");
  await page.evaluate(() => {
    window.enhanceAgentSheet(document.querySelector(".agent"), { editMode: true }, {});
    window.clicked = null;
    document.querySelector(".agent").addEventListener("click", event => {
      const action = event.target.closest("[data-action]");
      if (action)
        window.clicked = { action: action.dataset.action, item: action.closest("[data-item-id]")?.dataset.itemId };
    });
  });
  await expect(page.getByRole("button", { name: "Browse gear", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add gear", exact: true })).toBeVisible();
  await page.locator(".inventory-weapon summary").click();
  const remove = page.getByRole("button", { name: /^Remove Reviewed weapon/ });
  await expect(remove).toHaveText("Remove weapon");
  const unequip = page.getByRole("button", { name: /^Unequip Reviewed weapon/ });
  await expect(unequip).toHaveText("Unequip");
  await expect(unequip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Equip Wide armor" })).toHaveText("Equip");
  await remove.click();
  expect(await page.evaluate(() => window.clicked)).toEqual({ action: "itemDelete", item: "weapon" });
  await page.getByRole("button", { name: "Remove Wide armor" }).click();
  expect(await page.evaluate(() => window.clicked)).toEqual({ action: "itemDelete", item: "armor" });
  // Nothing the sheet ran afterwards turned a button back into a link or dropped its type.
  expect(await page.locator(".gear a[data-action], .gear button:not([type=button])").count()).toBe(0);
  expect(await page.locator(".gear").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("pinned tools are copied to the top of Play, and pin mode chooses instead of using", async ({ page }) => {
  await page.setContent(`<style>${css}</style><div class="spycraft2 application sheet agent play-mode">
    <div class="pinned-tools tool-actions" hidden></div>
    <section class="combat-toolbox"><input class="combat-tool-search" /><p class="combat-tool-empty" hidden></p>
      <div class="combat-tool-groups"><details class="combat-tool-group" open><summary>Attacks</summary><div class="tool-actions">
        <button type="button" class="sc2-action" data-action="rollDisarm">Disarm</button><button type="button" class="sc2-action" data-action="takeTotalDefense">Total Defense</button>
        <button type="button" class="sc2-action" data-action="setMovementCondition" data-condition="prone">Prone</button>
        <button type="button" class="gc-review sc2-action" data-action="reviewLimitedUseCounter" data-resource="contempt">Review</button>
      </div></details></div>
    </section></div>`);
  await load(page, sheetUX, "enhanceAgentSheet");
  const render = context =>
    page.evaluate(context => {
      window.used ??= [];
      window.pins ??= [];
      window.sheet ??= { togglePin: tool => window.pins.push(tool) };
      const root = document.querySelector(".agent");
      if (!root.dataset.wired) {
        root.dataset.wired = "1";
        root.addEventListener("click", event => {
          const control = event.target.closest("[data-action]");
          if (control) window.used.push(control.dataset.action);
        });
      }
      window.enhanceAgentSheet(root, { editMode: false, ...context }, window.sheet);
    }, context);
  await render({
    pinnedTools: ["setMovementCondition:prone"],
    actionCosts: { rollDisarm: "Half", takeTotalDefense: "Full" }
  });
  const pinned = page.locator(".pinned-tools");
  await expect(pinned).toBeVisible();
  await expect(pinned.getByRole("button")).toHaveText(["Prone"]);
  // The time an action takes is shown only where the rules give one.
  await expect(page.locator('.combat-toolbox [data-action="rollDisarm"]')).toHaveAttribute("data-sc2-cost", "Half");
  await expect(page.locator('.combat-toolbox [data-action="setMovementCondition"]')).not.toHaveAttribute(
    "data-sc2-cost"
  );
  await pinned.getByRole("button", { name: "Prone" }).click();
  expect(await page.evaluate(() => window.used)).toEqual(["setMovementCondition"]);
  // In pin mode a choice pins the tool and does not run it; GC review controls cannot be pinned.
  await render({ pinnedTools: ["setMovementCondition:prone"], pinMode: true });
  await page.locator('.combat-toolbox [data-action="rollDisarm"]').click();
  expect(await page.evaluate(() => [window.used, window.pins])).toEqual([["setMovementCondition"], ["rollDisarm"]]);
  await expect(page.locator(".combat-toolbox .gc-review")).not.toHaveAttribute("data-tool");
  await render({ pinnedTools: [] });
  await expect(pinned).toBeHidden();
});

test("the creation track counts reminders per step and marks only the first waiting step as the start", async ({
  page
}) => {
  await page.setContent("<main></main>");
  await load(page, sheetUX, "buildCreationTrack");
  const track = await page.evaluate(() =>
    window.buildCreationTrack([
      { tab: "skills", order: 30, text: "Skill points", skillLevel: 2 },
      { tab: "main", order: 4, text: "Origin choice" },
      { tab: "training", order: 54, text: "Subplot" },
      { tab: "training", order: 52, text: "Interests" },
      { tab: "training", order: 52, text: "Interests" }
    ])
  );
  expect(track.steps.map(step => step.key)).toEqual([
    "attributes",
    "origin",
    "class",
    "skills",
    "feats",
    "interests",
    "subplot",
    "derived",
    "describe",
    "gear"
  ]);
  const by = Object.fromEntries(track.steps.map(step => [step.key, step]));
  expect([by.origin.count, by.skills.count, by.interests.count, by.subplot.count, by.attributes.count]).toEqual([
    1, 1, 2, 1, 0
  ]);
  expect(track.steps.filter(step => step.start).map(step => step.key)).toEqual(["origin"]);
  expect(by.skills.skillLevel).toBe(2);
  expect(by.derived.automatic).toBe(true);
  // A step with nothing waiting still lands on its own pane.
  expect([by.class.tab, by.describe.tab, by.gear.tab]).toEqual(["classes", "bio", "gear"]);
  expect(track.waiting).toBe(5);
});
