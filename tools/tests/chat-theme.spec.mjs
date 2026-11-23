/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../../system.json", import.meta.url), "utf8"));
const css = manifest.styles
  .map(path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").replace(/@import[^;]+;/g, ""))
  .join("\n");
const LIGHT_INK = "#1b2323",
  DARK_INK = "#e8e4d8";

// A flagged card, an unflagged note whose content root is a system element, a card with a nested system root, and a
// button row added after the content (target responses and card-placed controls go there).
const messages = `
  <li class="chat-message message sc2-card" data-sc2-tooltip-scope data-testid="card"><header class="message-header">Roll</header>
    <div class="message-content"><div class="spycraft2 roll-controls" data-testid="nested"><button type="button">Next</button></div></div></li>
  <li class="chat-message message" data-testid="plain"><header class="message-header">Note</header>
    <div class="message-content"><div class="spycraft2 chat-note" data-testid="note">Ammunition spent.</div></div>
    <div class="spycraft2 roll-controls" data-testid="outside"><button type="button">Apply</button></div></li>`;
const ink = (page, id) =>
  page.getByTestId(id).evaluate(el => getComputedStyle(el).getPropertyValue("--sc2-ink").trim().toLowerCase());
test("the light and dark ink in this test are the ones tokens.css declares", () => {
  expect(css.match(/--sc2-ink:\s*(#[0-9a-f]+)/i)[1].toLowerCase()).toBe(LIGHT_INK);
  expect(css).toContain(`--sc2-ink: ${DARK_INK}`);
});

for (const [app, ui] of [
  ["light", "light"],
  ["light", "dark"],
  ["dark", "light"],
  ["dark", "dark"]
])
  test(`chat in the sidebar follows the interface theme (application ${app}, interface ${ui})`, async ({ page }) => {
    await page.setContent(
      `<style>${css}</style><body class="theme-${app}"><div id="interface" class="themed theme-${ui}"><ol class="chat-log">${messages}</ol></div>` +
        // A popped-out log is a window outside the interface, so it follows the application theme.
        `<div class="application"><ol class="chat-log">${messages.replaceAll('data-testid="', 'data-testid="pop-')}</ol></div></body>`
    );
    const sidebar = ui === "dark" ? DARK_INK : LIGHT_INK,
      popout = app === "dark" ? DARK_INK : LIGHT_INK;
    for (const id of ["card", "nested", "note", "outside"]) {
      expect(await ink(page, id), `sidebar ${id}`).toBe(sidebar);
      expect(await ink(page, `pop-${id}`), `popout ${id}`).toBe(popout);
    }
  });

test("a popped-out log with its own theme overrides the application theme", async ({ page }) => {
  for (const [app, own, expected] of [
    ["dark", "light", LIGHT_INK],
    ["light", "dark", DARK_INK]
  ]) {
    await page.setContent(
      `<style>${css}</style><body class="theme-${app}"><div class="application theme-${own}"><ol class="chat-log">${messages}</ol></div></body>`
    );
    for (const id of ["card", "nested", "note", "outside"])
      expect(await ink(page, id), `${app}/${own} ${id}`).toBe(expected);
  }
});

test("system sheets still follow the application theme, not the interface theme", async ({ page }) => {
  await page.setContent(
    `<style>${css}</style><body class="theme-dark"><div id="interface" class="themed theme-light"></div><div class="spycraft2 application" data-testid="sheet"><div class="spycraft2-roll-options" data-testid="inner"></div></div></body>`
  );
  expect(await ink(page, "sheet")).toBe(DARK_INK);
  expect(await ink(page, "inner")).toBe(DARK_INK);
});

test("a card's primary action takes a full row and its secondary actions share a wrapping row", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 700 });
  await page.setContent(
    `<style>${css}</style><ol id="chat-log" style="width:300px;list-style:none;padding:0"><li class="chat-message sc2-card"><div class="message-content"><div class="spycraft2 roll-controls"><p id="next">The GC rolls damage next.</p><button type="button" class="sc2-primary-action" id="primary">Roll damage</button><button type="button" id="a">Spend die</button><button type="button" id="b">Reroll</button><button type="button" class="sc2-quiet-action" id="c">Close</button></div></div></li></ol>`
  );
  const box = async id => page.locator(`#${id}`).boundingBox();
  const [row, next, primary, a, b, c] = await Promise.all(
    ["next", "next", "primary", "a", "b", "c"].map((id, i) =>
      i === 0 ? page.locator(".roll-controls").boundingBox() : box(id)
    )
  );
  // The sentence and the primary button each fill the row.
  expect(next.width).toBeGreaterThan(row.width - 2);
  expect(primary.width).toBeGreaterThan(row.width - 2);
  // The secondaries sit side by side below it, each as wide as its label needs and at least 28px tall.
  expect(a.y).toBeGreaterThanOrEqual(primary.y + primary.height);
  expect(b.y).toBe(a.y);
  expect(c.y).toBe(a.y);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x);
  expect(a.width).toBeLessThan(row.width / 2);
  for (const button of [a, b, c]) expect(button.height).toBeGreaterThanOrEqual(28);
  // Nothing spills out of the card.
  expect(c.x + c.width).toBeLessThanOrEqual(row.x + row.width + 0.5);
});
