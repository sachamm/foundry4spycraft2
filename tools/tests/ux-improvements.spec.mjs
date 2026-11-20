import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const i18n = data(read("module/i18n.mjs"));
const feedback = data(read("module/sheets/save-feedback.mjs").replace('"../i18n.mjs"', JSON.stringify(i18n)));
const attackUX = uiModuleUrl("module/apps/attack-dialog-ux.mjs");
const browserSource = data(
  read("module/apps/browser.mjs")
    .replace('import { describe } from "../rules/prerequisites.mjs";', 'const describe = () => "";')
    .replace('import { VEHICLE_RULES } from "../rules/tables.mjs";', "const VEHICLE_RULES = {};")
    .replace('"../i18n.mjs"', JSON.stringify(i18n))
);
const tooltips = data(
  read("module/apps/ui-tooltips.mjs")
    .replace('"../i18n.mjs"', JSON.stringify(i18n))
    .replace('"./ui-button-catalog.mjs"', JSON.stringify(data(read("module/apps/ui-button-catalog.mjs"))))
    .replace('"./ui-verb-icons.mjs"', JSON.stringify(data(read("module/apps/ui-verb-icons.mjs"))))
);

test("sheet tabs and legacy NPC/catalog actions support keyboard use exactly once", async ({ page }) => {
  await page.setContent(`<main class="spycraft2 application" id="keyboard-test">
    <nav class="sheet-tabs"><a data-action="tab" data-group="primary" data-tab="play" class="active">Play</a>
      <a data-action="tab" data-group="primary" data-tab="skills">Skills</a>
      <a data-action="tab" data-group="primary" data-tab="gear">Gear</a></nav>
    <section class="tab active" data-group="primary" data-tab="play">Combat</section>
    <section class="tab" data-group="primary" data-tab="skills">Skills panel</section>
    <section class="tab" data-group="primary" data-tab="gear">Gear panel</section>
    <a data-action="rollNpcSkill">Skill check</a><a data-action="select">First Aid Kit</a>
    <a href="https://example.com">Reference</a></main>`);
  await page.evaluate(async url => {
    const root = document.querySelector("main");
    window.clicks = { rollNpcSkill: 0, select: 0 };
    root.addEventListener("click", event => {
      const control = event.target.closest("[data-action]");
      if (!control) return;
      if (control.dataset.action === "tab") {
        root.querySelectorAll("nav a").forEach(tab => tab.classList.toggle("active", tab === control));
      } else window.clicks[control.dataset.action]++;
    });
    const { enhanceTooltips } = await import(url);
    enhanceTooltips(root);
    enhanceTooltips(root);
  }, tooltips);
  const play = page.getByRole("tab", { name: "Play", exact: true });
  await play.focus();
  await play.press("End");
  const gear = page.getByRole("tab", { name: "Gear", exact: true });
  await expect(gear).toBeFocused();
  await expect(gear).toHaveAttribute("aria-selected", "true");
  await expect(play).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tabpanel", { name: "Gear" })).toHaveAttribute("aria-hidden", "false");
  await gear.press("ArrowRight");
  await expect(play).toBeFocused();
  await page.getByRole("button", { name: "Skill check", exact: true }).press("Space");
  await page.getByRole("button", { name: "First Aid Kit", exact: true }).press("Enter");
  expect(await page.evaluate(() => window.clicks)).toEqual({ rollNpcSkill: 1, select: 1 });
  await expect(page.getByRole("link", { name: "Reference" })).not.toHaveAttribute("role", "button");
});

test("keyboard catalog selection restores focus to the matching entry after replacement", async ({ page }) => {
  await page.setContent(
    `<main class="spycraft2 application"><input name="search" /><ul class="browser-list"><li data-uuid="kit-2"><a data-action="select">Kit II</a></li></ul></main>`
  );
  await page.evaluate(async url => {
    class Application {
      element = document.querySelector("main");
      async render() {
        this.element.innerHTML =
          '<input name="search" /><ul class="browser-list"><li data-uuid="kit-1"><a data-action="select">Kit I</a></li><li data-uuid="kit-2"><a data-action="select">Kit II</a></li></ul><aside>Preview loaded</aside>';
        this._onRender({}, {});
      }
      _onRender() {}
    }
    window.debounced = [];
    window.foundry = {
      applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: Base => Base } },
      utils: {
        debounce:
          fn =>
          (...args) =>
            window.debounced.push(() => fn(...args))
      }
    };
    const { SpycraftBrowser } = await import(url);
    const browser = new SpycraftBrowser();
    browser._onRender({}, {});
    document.querySelector("input").dispatchEvent(new Event("input", { bubbles: true }));
    await SpycraftBrowser.DEFAULT_OPTIONS.actions.select.call(browser, { detail: 0 }, document.querySelector("a"));
    window.debounced.shift()();
  }, browserSource);
  await expect(page.getByText("Kit II", { exact: true })).toBeFocused();
  await expect(page.getByText("Preview loaded")).toBeVisible();
});

test("required Reach/range declarations stay visible and supplied action/modifier values survive grouping", async ({
  page
}) => {
  await page.setContent(`<dialog open><form><div class="spycraft2-roll-options">
    <label>Target <select name="targetActorUuid"><option value="guard">Guard</option></select></label>
    <fieldset><legend>Reach</legend><label>Adjacency <select name="reachAdjacency"><option value="nonadjacent">Nonadjacent</option></select></label><label><input name="reachGeometryConfirmed" type="checkbox" checked /> Legal geometry</label></fieldset>
    <fieldset><legend>Aim and action</legend><label>Action <select name="attackAction"><option value="standard">Standard</option><option value="autofire" selected>Autofire</option></select></label><label><input name="aimed" type="checkbox" checked /> Aim already taken</label></fieldset>
    <label>Range <input type="number" name="distanceFeet" value="20" required /></label>
  </div></form></dialog>`);
  const values = await page.locator("form").evaluate(form => [...new FormData(form)].sort());
  await page.evaluate(async url => {
    const { enhanceAttackDialog } = await import(url);
    enhanceAttackDialog(null, { element: document.querySelector("dialog") });
  }, attackUX);
  await expect(page.locator('.sc2-attack-quick [name="reachAdjacency"]')).toBeVisible();
  await expect(page.locator('.sc2-attack-quick [name="reachGeometryConfirmed"]')).toBeChecked();
  await expect(page.locator('.sc2-attack-quick [name="distanceFeet"]')).toHaveAttribute("required", "");
  await expect(page.locator('[name="attackAction"]')).toHaveValue("autofire");
  await expect(page.locator(".sc2-attack-circumstances")).toHaveAttribute("open", "");
  expect(await page.locator("form").evaluate(form => [...new FormData(form)].sort())).toEqual(values);
  await expect(page.locator(".sc2-attack-quick")).toContainText("Range is required");
});

test("autosave reports pending, newer unsaved edits, failures and successful retry truthfully", async ({ page }) => {
  await page.setContent(
    `<form class="spycraft2 application"><header class="window-header"><h1 class="window-title">Agent</h1></header><input name="system.codename" /></form>`
  );
  await page.evaluate(async url => {
    window.saves = [];
    class Sheet {
      element = document.querySelector("form");
      isEditable = true;
      _onRender() {}
      _processSubmitData() {
        return new Promise((resolve, reject) => window.saves.push({ resolve, reject }));
      }
    }
    const { SaveFeedback } = await import(url);
    window.sheet = new (SaveFeedback(Sheet))();
    window.sheet._onRender();
    window.sheet._onRender();
  }, feedback);
  const status = page.getByRole("status");
  await expect(status).toHaveText("Auto-save on");
  await page.locator("input").fill("First edit");
  await expect(status).toHaveText("Unsaved changes");
  await page.evaluate(() => {
    window.pending = window.sheet._processSubmitData().catch(() => {});
  });
  await expect(status).toHaveText("Saving…");
  await page.locator("input").fill("Newer edit");
  await page.evaluate(async () => {
    window.saves.shift().resolve();
    await window.pending;
  });
  await expect(status).toHaveText("Unsaved changes");
  await page.evaluate(() => {
    window.pending = window.sheet._processSubmitData().catch(() => {});
  });
  await page.evaluate(async () => {
    window.saves.shift().reject(new Error("Save failed"));
    await window.pending;
  });
  await expect(status).toHaveText("Not saved — edit again to retry");
  await page.evaluate(() => {
    window.pending = window.sheet._processSubmitData();
  });
  await expect(status).toHaveText("Saving…");
  await page.evaluate(async () => {
    window.saves.shift().resolve();
    await window.pending;
  });
  await expect(status).toHaveText("Saved");
});

test("overlapping saves stay pending until both settle and never hide an unsaved failure", async ({ page }) => {
  await page.setContent(
    `<form class="spycraft2 application"><header class="window-header"><h1 class="window-title">Agent</h1></header><input name="name" /></form>`
  );
  await page.evaluate(async url => {
    window.saves = [];
    class Sheet {
      element = document.querySelector("form");
      isEditable = true;
      _onRender() {}
      _processSubmitData() {
        return new Promise((resolve, reject) => window.saves.push({ resolve, reject }));
      }
    }
    const { SaveFeedback } = await import(url);
    window.sheet = new (SaveFeedback(Sheet))();
    window.sheet._onRender();
    window.first = window.sheet._processSubmitData().catch(() => {});
    window.second = window.sheet._processSubmitData();
  }, feedback);
  await page.evaluate(async () => {
    window.saves[1].resolve();
    await window.second;
  });
  await expect(page.getByRole("status")).toHaveText("Saving…");
  await page.evaluate(async () => {
    window.saves[0].reject(new Error("Save failed"));
    await window.first;
  });
  await expect(page.getByRole("status")).toHaveText("Not saved — edit again to retry");
});
