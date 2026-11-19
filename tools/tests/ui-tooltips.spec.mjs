import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const i18n = `data:text/javascript;base64,${readFileSync(new URL("../../module/i18n.mjs", import.meta.url)).toString("base64")}`;
const source = readFileSync(new URL("../../module/apps/ui-tooltips.mjs", import.meta.url), "utf8").replace(
  '"../i18n.mjs"',
  JSON.stringify(i18n)
);
const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

test.beforeEach(async ({ page }) => {
  await page.setContent(`<main class="spycraft2">
    <label>Attack action <select name="attackAction"><option>Standard Attack</option></select></label>
    <label>Distance <input type="number" name="distanceFeet" min="0" /></label>
    <div class="form-group"><label>Mission budget <input type="number" min="0" max="10" step="1" /></label><p class="hint">The GC sets the budget.</p></div>
    <button data-action="itemDelete">Remove</button>
    <button data-action="rollAttack" data-tooltip="Existing breakdown" title="Existing title">Attack</button>
    <button data-action="tab" data-tab="gear">Gear</button>
    <a data-tab="skills" id="skills-tab">Skills</a>
    <button data-action="cancel" aria-label="Cancel"><i></i></button>
    <details><summary>Extra options</summary><label>Notes <textarea name="notes"></textarea></label></details>
    <prose-mirror name="system.biography"></prose-mirror>
    <img data-edit="img" id="portrait" />
    <button data-action="reviewSpecialCase" id="icon-only"><i></i></button>
    <a href="https://example.com" id="reference">Reference</a>
    <table><thead><tr><th>Skill ranks</th></tr></thead><tbody><tr><td><input type="number" /></td></tr></tbody></table>
  </main><aside><button id="outside">Another module</button></aside>`);
  await page.evaluate(async moduleUrl => {
    window.tooltipHooks = new Map();
    window.Hooks = { on: (name, callback) => window.tooltipHooks.set(name, callback) };
    window.tooltips = await import(moduleUrl);
    window.tooltips.installUITooltipHooks();
    window.tooltipHooks.get("renderApplicationV2")({ element: document.querySelector("main") });
  }, url);
});

test("system fields, actions, tabs, editors and compact table cells receive contextual help", async ({ page }) => {
  await expect(page.locator('[name="attackAction"]')).toHaveAttribute("data-tooltip", /Standard Attack/);
  await expect(page.locator('[name="distanceFeet"]')).toHaveAttribute("aria-description", /distance.*feet/);
  await expect(page.locator(".form-group input")).toHaveAttribute(
    "title",
    /GC sets the budget.*Minimum: 0.*Maximum: 10.*whole numbers/
  );
  await expect(page.locator('[data-action="itemDelete"]')).toHaveAttribute("title", /Remove this item/);
  await expect(page.locator('[data-tab="gear"]')).toHaveAttribute("title", /Gear section/);
  await expect(page.locator("#skills-tab")).toHaveAttribute("title", /Skills section/);
  await expect(page.locator("prose-mirror")).toHaveAttribute("title", /background/);
  await expect(page.locator("td input")).toHaveAttribute("title", /Skill ranks/);
  await expect(page.locator("summary")).toHaveAttribute("title", /Expand or collapse/);
  await expect(page.locator("#portrait")).toHaveAttribute("title", /different image/);
  await expect(page.locator("#icon-only")).toHaveAttribute("title", /review Special Case/);
  await expect(page.locator("#reference")).toHaveAttribute("title", "Open Reference.");
});

test("existing help, user values, and unrelated applications are preserved", async ({ page }) => {
  await expect(page.locator('[data-action="rollAttack"]')).toHaveAttribute("data-tooltip", "Existing breakdown");
  await expect(page.locator('[data-action="rollAttack"]')).toHaveAttribute("title", "Existing title");
  await expect(page.locator("#outside")).not.toHaveAttribute("data-tooltip");
  await page.locator('[name="distanceFeet"]').fill("25");
  await page.locator('[data-action="cancel"]').focus();
  await expect(page.locator('[name="distanceFeet"]')).toHaveValue("25");
  await expect(page.locator('[name="distanceFeet"]')).not.toHaveAttribute("title", /25/);
});

test("controls added after rendering receive tooltips on focus or hover", async ({ page }) => {
  await page.evaluate(() =>
    document
      .querySelector("main")
      .insertAdjacentHTML("beforeend", '<label>Loaded shots <input name="system.shotsLoaded" id="dynamic" /></label>')
  );
  await page.locator("#dynamic").focus();
  await expect(page.locator("#dynamic")).toHaveAttribute("data-tooltip", /Attacks spend/);
  await page.evaluate(() =>
    document
      .querySelector("main")
      .insertAdjacentHTML("beforeend", '<button data-action="reload" id="reload">Reload</button>')
  );
  await page.locator("#reload").hover();
  await expect(page.locator("#reload")).toHaveAttribute("title", /spare ammunition/);
});

test("system chat gets help without changing other chat cards", async ({ page }) => {
  const result = await page.evaluate(() => {
    const card = document.createElement("section");
    card.innerHTML = '<button data-roll-control="finishControl">Outcome resolved</button>';
    window.tooltipHooks.get("renderChatMessageHTML")({ flags: {} }, card);
    const untouched = !card.querySelector("button").hasAttribute("data-tooltip");
    window.tooltipHooks.get("renderChatMessageHTML")({ flags: { spycraft2: {} } }, card);
    return { untouched, tip: card.querySelector("button").dataset.tooltip };
  });
  expect(result.untouched).toBe(true);
  expect(result.tip).toContain("outcome as resolved");
});

test("button names survive icon conversion and existing tooltips", async ({ page }) => {
  const attack = page.locator('[data-action="rollAttack"]');
  await expect(attack).toHaveAttribute("aria-label", "Attack");
  await expect(page.locator('[data-action="cancel"]')).toHaveAttribute("aria-label", "Cancel");
  await page.evaluate(() => {
    document.querySelector('[data-action="rollAttack"]').innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
    window.tooltips.enhanceTooltips(document.querySelector("main"));
  });
  await expect(attack).toHaveAccessibleName("Attack");
  await expect(attack).toHaveAttribute("data-tooltip", "Existing breakdown");
  await expect(page.locator("#outside")).not.toHaveAttribute("aria-label");
});

test("action buttons show generated icons and retain keyboard access and help", async ({ page }) => {
  const css = readFileSync(new URL("../../styles/spycraft2.css", import.meta.url), "utf8");
  const image = readFileSync(new URL("../../assets/ui/button-icons.png", import.meta.url)).toString("base64");
  await page.addStyleTag({ content: css.replace("../assets/ui/button-icons.png", `data:image/png;base64,${image}`) });
  const remove = page.getByRole("button", { name: "Remove", exact: true });
  await expect(remove.locator(".sc2-button-icon")).toBeVisible();
  await expect(remove.locator(".sc2-button-content")).toBeHidden();
  await expect(remove).toHaveAttribute("title", /Remove this item/);
  await remove.focus();
  await expect(remove).toBeFocused();
  await expect(page.locator('[data-action="tab"] .sc2-button-icon')).toHaveCount(0);
  await expect(page.locator("#outside .sc2-button-icon")).toHaveCount(0);
  await page.evaluate(() => window.tooltips.enhanceTooltips(document.querySelector("main")));
  await expect(remove.locator(".sc2-button-icon")).toHaveCount(1);
  await page.screenshot({ path: "test-results/button-icons-preview.png" });
});
