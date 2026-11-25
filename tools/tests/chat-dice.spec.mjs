/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

const css = readFileSync(new URL("../../styles/chat-dice.css", import.meta.url), "utf8");
const moduleUrl = uiModuleUrl("module/apps/chat-dice.mjs");

// A stand-in for Foundry's sidebar chat form, its hooks and the chat box's ProseMirror view.
async function mount(page, width) {
  await page.setContent(
    `<style>${css} button { box-sizing: border-box; border: 1px solid #777; }</style>
     <section id="chat" style="width:${width}px;display:flex;flex-direction:column">
       <div class="chat-scroll" style="height:200px"></div>
       <form class="chat-form"><div id="chat-controls">modes</div><div id="chat-message"></div></form>
     </section>`
  );
  await page.evaluate(async url => {
    const hooks = {};
    window.Hooks = { on: (name, fn) => (hooks[name] = fn) };
    window.sent = [];
    window.ui = { chat: { processMessage: async text => window.sent.push(text) } };
    window.foundry = {
      prosemirror: {
        Plugin: class {
          constructor(spec) {
            this.spec = spec;
          }
        }
      }
    };
    const view = {
      text: "",
      get state() {
        const text = this.text;
        return {
          doc: { textContent: text, content: { size: text.length } },
          schema: { nodes: { paragraph: { create: (_attrs, content) => content ?? "" } }, text: value => value },
          tr: { replaceWith: (_from, _to, paragraph) => paragraph }
        };
      },
      dispatch(paragraph) {
        this.text = paragraph;
        this.watcher?.update();
      },
      focus() {}
    };
    window.chatView = view;
    const { installChatDiceHooks } = await import(url);
    installChatDiceHooks();
    const input = document.querySelector("#chat-message");
    const event = new Event("plugins");
    event.plugins = {};
    input.dispatchEvent(event);
    view.watcher = event.plugins.sc2ChatDice.spec.view(view);
    hooks.renderChatInput(null, { "#chat-message": input, "#chat-controls": document.querySelector("#chat-controls") });
  }, moduleUrl);
}

test("the dice bar builds a /r formula in the chat box and rolls d20 at once", async ({ page }) => {
  await mount(page, 300);
  const bar = page.getByRole("region", { name: "Dice" });
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Raise the modifier by 1" }).click();
  await bar.getByRole("button", { name: "Raise the modifier by 1" }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("");
  await bar.getByRole("button", { name: "Add a d6 to the roll in the chat box" }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("/r 1d6+2");
  await bar.getByRole("button", { name: "Add a d6 to the roll in the chat box" }).click();
  await bar.getByRole("button", { name: "Add a d8 to the roll in the chat box" }).click();
  for (let i = 0; i < 5; i++) await bar.getByRole("button", { name: "Lower the modifier by 1" }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("/r 2d6+1d8-3");
  await expect(bar.locator("output")).toHaveText("−3");
  await expect(bar.getByRole("button", { name: "Add a d6 to the roll in the chat box" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  // Sending clears the chat box; the bar starts over.
  await page.evaluate(() => window.chatView.dispatch(""));
  await expect(bar.locator("output")).toHaveText("+0");
  await bar.getByRole("button", { name: "Add a d20 to the roll in the chat box" }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("/r 1d20");
  await bar.getByRole("button", { name: "Roll d20 now" }).click();
  expect(await page.evaluate(() => window.sent)).toEqual(["/r 1d20"]);
  // The bar sits above the chat controls.
  expect(await page.evaluate(() => document.querySelector(".sc2-chat-dice").nextElementSibling.id)).toBe(
    "chat-controls"
  );
});

for (const width of [240, 300])
  test(`the dice bar fits a ${width}px sidebar with 28px targets`, async ({ page }) => {
    await mount(page, width);
    const sizes = await page.evaluate(() => {
      const bar = document.querySelector(".sc2-chat-dice");
      return {
        overflow: bar.scrollWidth - bar.clientWidth,
        right: Math.max(...[...bar.querySelectorAll("button, output")].map(node => node.getBoundingClientRect().right)),
        barRight: bar.getBoundingClientRect().right,
        heights: [...bar.querySelectorAll("button")].map(node => node.getBoundingClientRect().height)
      };
    });
    expect(sizes.overflow).toBeLessThanOrEqual(0);
    expect(sizes.right).toBeLessThanOrEqual(sizes.barRight + 0.5);
    for (const height of sizes.heights) expect(height).toBeGreaterThanOrEqual(28);
  });
