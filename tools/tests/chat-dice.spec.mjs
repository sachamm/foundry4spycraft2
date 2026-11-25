/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

const css = ["tokens.css", "chat-dice.css"]
  .map(file => readFileSync(new URL(`../../styles/${file}`, import.meta.url), "utf8"))
  .join("\n");
const moduleUrl = uiModuleUrl("module/apps/chat-dice.mjs");

// A stand-in for Foundry's sidebar chat form, its hooks and the chat box's ProseMirror view.
async function mount(page, width, theme = "light") {
  await page.setContent(
    `<style>${css} button { box-sizing: border-box; border: 1px solid #777; }</style>
     <section id="chat" class="themed theme-${theme}" style="width:${width}px;display:flex;flex-direction:column">
       <div class="chat-scroll" style="height:200px"></div>
       <form class="chat-form"><div id="chat-controls"><div id="message-modes" class="split-button">modes</div></div><div id="chat-message"></div></form>
     </section>
     <div id="chat-notifications" class="themed theme-${theme}" style="position:relative;margin-left:120px;width:300px"></div>`
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
    const controls = document.querySelector("#chat-controls");
    const modes = document.querySelector("#message-modes");
    const elements = { "#chat-message": input, "#chat-controls": controls, "#message-modes": modes };
    // Foundry's move between the chat log and the notification area beside the other sidebar tabs.
    window.showChatIn = where => {
      if (where === "log") document.querySelector(".chat-form").append(controls, input);
      else document.querySelector("#chat-notifications").append(input, controls);
      modes.classList.toggle("vertical", where !== "log");
      hooks.renderChatInput(null, elements);
    };
    window.showChatIn("log");
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

test("a modifier chosen before a die survives a draft already in the chat box", async ({ page }) => {
  await mount(page, 300);
  await page.evaluate(() => (window.chatView.text = "see you at the docks"));
  const bar = page.getByRole("region", { name: "Dice" });
  await bar.getByRole("button", { name: "Raise the modifier by 1" }).click();
  await bar.getByRole("button", { name: "Raise the modifier by 1" }).click();
  await expect(bar.locator("output")).toHaveText("+2");
  expect(await page.evaluate(() => window.chatView.text)).toBe("see you at the docks");
  await bar.getByRole("button", { name: "Add a d6 to the roll in the chat box" }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("/r 1d6+2");
});

for (const [theme, ink] of [
  ["light", "#1b2323"],
  ["dark", "#e8e4d8"]
])
  test(`the dice bar takes the system tokens and follows a ${theme} sidebar`, async ({ page }) => {
    await mount(page, 300, theme);
    const value = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".sc2-chat-dice")).getPropertyValue("--sc2-ink").trim().toLowerCase()
    );
    expect(value).toBe(ink);
  });

test("die labels stay inside their buttons with counts showing in a 240px sidebar", async ({ page }) => {
  await mount(page, 240);
  const bar = page.getByRole("region", { name: "Dice" });
  for (const faces of [4, 6, 8, 10, 12, 20])
    for (let i = 0; i < 12; i++)
      await bar.getByRole("button", { name: `Add a d${faces} to the roll in the chat box` }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("/r 12d4+12d6+12d8+12d10+12d12+12d20");
  const spills = await page.evaluate(() =>
    [...document.querySelectorAll(".sc2-chat-dice-dice button")].map(button => {
      const box = button.getBoundingClientRect();
      const face = button.querySelector(".sc2-chat-dice-face").getBoundingClientRect();
      return { faces: button.dataset.faces, inside: face.left >= box.left && face.right <= box.right };
    })
  );
  for (const { faces, inside } of spills) expect(inside, `d${faces}`).toBe(true);
  await expect(bar.getByRole("button", { name: "Add a d20 to the roll in the chat box" })).toContainText("×12");
});

test("on other sidebar tabs the bar sits just above the chat box and keeps the formula", async ({ page }) => {
  await mount(page, 300);
  await page.getByRole("button", { name: "Raise the modifier by 1" }).click();
  await page.evaluate(() => window.showChatIn("notifications"));
  await expect(page.locator(".sc2-chat-dice")).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector(".sc2-chat-dice").nextElementSibling.id)).toBe(
    "chat-message"
  );
  const bar = page.locator("#chat-notifications").getByRole("region", { name: "Dice" });
  await expect(bar.locator("output")).toHaveText("+1");
  await bar.getByRole("button", { name: "Add a d8 to the roll in the chat box" }).click();
  expect(await page.evaluate(() => window.chatView.text)).toBe("/r 1d8+1");
  await bar.getByRole("button", { name: "Roll d20 now" }).click();
  expect(await page.evaluate(() => window.sent)).toEqual(["/r 1d20"]);
  await page.evaluate(() => window.showChatIn("log"));
  expect(await page.evaluate(() => document.querySelector(".sc2-chat-dice").nextElementSibling.id)).toBe(
    "chat-controls"
  );
});
