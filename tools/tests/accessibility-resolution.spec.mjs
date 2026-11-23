import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";
const css = systemCss();

test("unlabelled numeric table fields get row and column context without overriding authored names", async ({
  page
}) => {
  await page.setContent(
    '<form class="spycraft2 application"><table><thead><tr><th>Attribute</th><th>Base</th><th>Misc</th></tr></thead><tbody><tr><th><button>Strength</button></th><td><input name="system.abilities.str.base" value="10"></td><td><input aria-label="Custom modifier" value="0"></td></tr></tbody></table><label>Target <select><option>Guard</option></select></label><input name="system.codename"></form>'
  );
  await page.evaluate(
    async url => (await import(url)).enhanceTooltips(document.querySelector("form")),
    uiModuleUrl("module/apps/ui-tooltips.mjs")
  );
  await expect(page.getByRole("textbox", { name: "Strength: Base", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Custom modifier", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Target", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "codename", exact: true })).toBeVisible();
});

test("automation guides are keyboard operable, preserve data and explain confirmation and GC ownership", async ({
  page
}) => {
  await page.setContent(
    `<style>${css}</style><form class="spycraft2 application"><input name="amount" value="11"></form>`
  );
  const before = await page.locator("form").evaluate(form => [...new FormData(form)]);
  await page.evaluate(async url => {
    const { installResolutionGuide } = await import(url);
    installResolutionGuide(document.querySelector("form"), "damage");
    installResolutionGuide(document.querySelector("form"), "damage");
  }, uiModuleUrl("module/apps/resolution-guide.mjs"));
  await expect(page.locator(".sc2-resolution-guide")).toHaveCount(1);
  await page.locator("summary").press("Enter");
  await expect(page.getByText(/After Apply, uses the selected target/)).toBeVisible();
  await expect(page.getByText(/target you do not own is sent to the GC/)).toBeVisible();
  expect(await page.locator("form").evaluate(form => [...new FormData(form)])).toEqual(before);
});

test("failed chat actions announce the error, reenable the control and allow one explicit retry", async ({ page }) => {
  await page.setContent('<article data-message-id="m1"><button>Apply</button></article>');
  await page.evaluate(async url => {
    const { runChatAction } = await import(url);
    window.calls = 0;
    document.querySelector("button").onclick = event =>
      runChatAction(event.currentTarget, async () => {
        window.calls++;
        if (window.calls === 1) throw Error("Target no longer available");
      });
  }, uiModuleUrl("module/apps/chat-action-feedback.mjs"));
  await page.getByRole("button").press("Enter");
  await expect(page.getByRole("alert")).toContainText("Target no longer available");
  await expect(page.getByRole("button")).toBeEnabled();
  await page.getByRole("button").press("Enter");
  await expect(page.getByRole("status")).toContainText("Action finished");
  expect(await page.evaluate(() => window.calls)).toBe(2);
});

test("chat replacement restores keyboard focus to the updated result without stealing it from dialogs", async ({
  page
}) => {
  await page.setContent('<article data-message-id="m1"><button>Resolve</button></article>');
  await page.evaluate(async url => {
    const { runChatAction } = await import(url);
    document.querySelector("button").onclick = event =>
      runChatAction(event.currentTarget, async () => {
        document.querySelector("article").innerHTML =
          '<section class="sc2-result-guide"><h4>Success confirmed</h4></section>';
      });
  }, uiModuleUrl("module/apps/chat-action-feedback.mjs"));
  await page.getByRole("button").press("Enter");
  await expect(page.getByRole("heading", { name: "Success confirmed" })).toBeFocused();
  await page.evaluate(async url => {
    const { runChatAction } = await import(url);
    document.querySelector("article").innerHTML = '<button>Open</button><dialog><input aria-label="Defense"></dialog>';
    document.querySelector("button").onclick = event =>
      runChatAction(event.currentTarget, async () => {
        const dialog = document.querySelector("dialog");
        dialog.showModal();
        dialog.querySelector("input").focus();
      });
  }, uiModuleUrl("module/apps/chat-action-feedback.mjs"));
  await page.getByRole("button", { name: "Open" }).press("Enter");
  await expect(page.getByRole("textbox", { name: "Defense" })).toBeFocused();
});

for (const theme of ["light", "dark"])
  test(`origin controls remain reachable at 200% text size in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(
      `<style>${css}</style><div class="theme-${theme}"><form class="spycraft2 sheet agent application" style="width:460px"><aside class="sheet-rail" style="width:240px"><div class="rail-id"><span class="origin sc2-chip"><button data-action="itemEdit">Long talent name</button><button class="sc2-icon-button" data-sc2-mode="icon" aria-label="Change talent">+</button><button class="sc2-icon-button" data-sc2-mode="icon" aria-label="Remove talent">×</button></span></div></aside></form></div>`
    );
    await page.evaluate(() => {
      for (const control of document.querySelectorAll("button"))
        control.style.fontSize = `${parseFloat(getComputedStyle(control).fontSize) * 2}px`;
    });
    for (const control of await page.getByRole("button").all()) {
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await control.press("Tab");
    }
    expect(await page.locator(".sheet-rail").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "Change talent" }).press("Shift+Tab");
    expect(
      await page.getByRole("button", { name: "Long talent name" }).evaluate(e => getComputedStyle(e).outlineStyle)
    ).toBe("solid");
    await page.emulateMedia({ forcedColors: "active" });
    expect(
      await page.getByRole("button", { name: "Long talent name" }).evaluate(e => getComputedStyle(e).outlineWidth)
    ).toBe("3px");
  });
