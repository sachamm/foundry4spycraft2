import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

test("tool search reveals matching sections and restores current disclosure choices without submitting data", async ({
  page
}) => {
  await page.setContent(`<form><details open><summary>Driving</summary><label>Fuel <input name="fuel" value="3" /></label></details>
    <details><summary>Equipment</summary><button type="button">Refuel</button></details></form>`);
  await page.evaluate(async url => {
    const { installToolSearch } = await import(url);
    installToolSearch(document.querySelector("form"), "details");
    window.saved = [];
    for (const section of document.querySelectorAll("details"))
      section.addEventListener("toggle", () => {
        if (section.dataset.toolSearchActive !== "true" && section.dataset.searchOpen !== String(section.open))
          window.saved.push(section.open);
      });
  }, uiModuleUrl("module/apps/tool-search.mjs"));
  await page.locator("summary").first().click();
  await expect.poll(() => page.evaluate(() => window.saved.length)).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.saved = [];
  });
  const input = page.getByRole("searchbox", { name: "Find a tool" });
  await input.fill("refuel");
  await expect(page.getByRole("button", { name: "Refuel" })).toBeVisible();
  await expect(page.locator("details").first()).toBeHidden();
  await page.getByText("Equipment", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Refuel" })).toBeHidden();
  await input.fill("nothing-matches");
  await expect(page.getByRole("status")).toHaveText("No matching tools");
  await input.press("Escape");
  await expect(input).toBeFocused();
  await expect(page.locator("details[open]")).toHaveCount(0);
  expect(await page.locator("form").evaluate(form => [...new FormData(form)])).toEqual([["fuel", "3"]]);
  expect(await page.evaluate(() => window.saved)).toEqual([]);
});

test("guidance respects blind and hidden rolls and avoids duplicate cards", async ({ page }) => {
  await page.setContent('<article><div class="message-content"></div></article>');
  const url = uiModuleUrl("module/rolls/chat-guidance.mjs");
  for (const message of [
    { isAuthor: false },
    { isAuthor: true, blind: true },
    { isAuthor: true, isContentVisible: false }
  ]) {
    await page.evaluate(
      async ({ url, message }) => {
        (await import(url)).renderCheckGuidance(
          message,
          { rawTotal: 20, checkKind: "skill" },
          document.querySelector("article"),
          {
            isGM: false
          }
        );
      },
      { url, message }
    );
    await expect(page.locator(".sc2-result-guide")).toHaveCount(0);
  }
  await page.evaluate(async url => {
    const { renderCheckGuidance } = await import(url);
    for (let i = 0; i < 2; i++)
      renderCheckGuidance({ isAuthor: true }, { rawTotal: 20, checkKind: "skill" }, document.querySelector("article"), {
        isGM: false
      });
  }, url);
  await expect(page.locator(".sc2-guide-title", { hasText: "Pending" })).toHaveCount(1);
});

test("vehicle section choices and active search survive a sheet replacement", async ({ page }) => {
  await page.setContent(
    '<main><details><summary>Statistics</summary><label>Speed <input name="speed" value="20" /></label></details><details open><summary>Condition</summary></details></main>'
  );
  await page.evaluate(async url => {
    window.installSearch = (await import(url)).installToolSearch;
    window.toolState = {};
    window.markup = document.querySelector("main").innerHTML;
    window.installSearch(document.querySelector("main"), "details", "Find a tool", window.toolState);
  }, uiModuleUrl("module/apps/tool-search.mjs"));
  await page.getByText("Statistics", { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.toolState.open.Statistics)).toBe(true);
  await page.getByRole("searchbox").fill("speed");
  await page.evaluate(() => {
    document.querySelector("main").innerHTML = window.markup;
    window.installSearch(document.querySelector("main"), "details", "Find a tool", window.toolState);
  });
  await expect(page.getByRole("searchbox")).toHaveValue("speed");
  await expect(page.locator('[name="speed"]')).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator("details[open]")).toHaveCount(2);
});

for (const theme of ["light", "dark"])
  test(`frequent icon targets are 44px and fit a compact rail in ${theme} mode`, async ({ page }) => {
    const css = systemCss();
    await page.setContent(
      `<style>${css}</style><div class="theme-${theme}"><div class="spycraft2 application" style="width:240px"><div style="display:flex;flex-wrap:wrap;gap:4px">${Array.from({ length: 6 }, (_, i) => `<button class="sc2-icon-button" data-sc2-mode="icon" aria-label="Action ${i}">+</button>`).join("")}</div></div></div>`
    );
    for (const button of await page.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator(".application").evaluate(root => root.scrollWidth <= root.clientWidth)).toBe(true);
  });
