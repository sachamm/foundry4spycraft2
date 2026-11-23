import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../module/sheets/keep-place.mjs", import.meta.url), "utf8");
const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

const part = (str, name) => `<section data-application-part="main">
  <label>Strength <input type="number" name="system.abilities.str" value="${str}" /></label>
  <label>Codename <input type="text" name="system.codename" value="${name}" /></label>
  <ul>
    <li data-item-id="a"><button type="button" data-action="itemEdit">Edit</button></li>
    <li data-item-id="b"><button type="button" data-action="itemEdit">Edit</button></li>
  </ul>
  <button type="button" data-action="toggleHalfAction" data-index="0">First half action</button>
  <button type="button" data-action="toggleHalfAction" data-index="1">Second half action</button>
</section>`;

/** Redraw the part the way a sheet does: build the new element, keep the place, swap, put the place back. */
async function redraw(page, html, committed = null) {
  await page.evaluate(
    async ([moduleUrl, markup, sent]) => {
      const { capturePlace, restorePlace } = await import(moduleUrl);
      const prior = document.querySelector("section");
      const template = document.createElement("template");
      template.innerHTML = markup;
      const fresh = template.content.firstElementChild;
      const place = capturePlace(prior, sent);
      prior.replaceWith(fresh);
      restorePlace(fresh, place);
    },
    [url, html, committed]
  );
}

test.beforeEach(async ({ page }) => {
  await page.setContent(part(12, "Vector"));
});

test("text still being typed survives a redraw, with its caret, and still saves on leaving the field", async ({
  page
}) => {
  const field = page.locator('[name="system.codename"]');
  await field.focus();
  await field.press("End");
  await page.keyboard.type(" Prime");
  await page.keyboard.press("ArrowLeft");
  // Someone else's action redraws the sheet with the saved name.
  await redraw(page, part(14, "Vector"));
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Vector Prime");
  expect(await field.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([11, 11]);
  await expect(page.locator('[name="system.abilities.str"]')).toHaveValue("14");
  await page.evaluate(() =>
    document.addEventListener("change", event => (window.saved = [event.target.name, event.target.value]))
  );
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => window.saved)).toEqual(["system.codename", "Vector Prime"]);
});

test("a value just sent for saving takes the document's answer, and an untouched field takes the new value", async ({
  page
}) => {
  const strength = page.locator('[name="system.abilities.str"]');
  await strength.fill("99");
  // The document clamps the number; the redraw that follows the save must show the clamped value.
  await redraw(page, part(18, "Vector"), { name: "system.abilities.str", value: "99" });
  await expect(strength).toHaveValue("18");
  await page.locator('[name="system.codename"]').focus();
  await redraw(page, part(18, "Latch"));
  await expect(page.locator('[name="system.codename"]')).toHaveValue("Latch");
});

test("a pressed button keeps keyboard focus across a redraw, on the same row", async ({ page }) => {
  await page.locator('[data-index="1"]').focus();
  await redraw(page, part(12, "Vector"));
  await expect(page.locator('[data-index="1"]')).toBeFocused();
  await page.locator('[data-item-id="b"] button').focus();
  await redraw(page, part(12, "Vector"));
  await expect(page.locator('[data-item-id="b"] button')).toBeFocused();
});
