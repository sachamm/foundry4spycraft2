import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseCSS = readFileSync(new URL("../../styles/spycraft2.css", import.meta.url), "utf8");
const retroCSS = readFileSync(new URL("../../styles/retro.css", import.meta.url), "utf8");
const tabs = ["main", "classes", "skills", "feats", "training", "gear", "bio"];
// Exercise real part root classes inside a Foundry-style fixed-height flex window.
// This is a layout regression fixture, not a replacement for live Foundry QA.
const roots = Object.fromEntries(tabs.map(id => {
  const source = readFileSync(new URL(`../../templates/actor/agent-${id}.hbs`, import.meta.url), "utf8");
  const classes = /<section class="([^"]+)"/.exec(source)[1].replace("{{tab.cssClass}}", "");
  return [id, classes];
}));

async function mount(page, { height = 860, header = 180, css = baseCSS } = {}) {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      .application { display:flex; flex-direction:column; width:820px; height:${height}px; overflow:hidden; }
      .window-header { flex:0 0 30px; }
      .window-content { display:flex; flex-direction:column; flex:1; overflow:hidden; }
      .sheet-top { height:${header}px; }
      .sheet-tabs { display:flex; }
      .tab { display:none; }
      .tab.active { display:block; }
      ${css}
      ${retroCSS}
    </style>
    <div class="application spycraft2 sheet actor agent">
      <header class="window-header">Character</header>
      <form class="window-content">
        <div class="sheet-top">Dossier, resources and expanded checklist</div>
        <nav class="sheet-tabs">${tabs.map(id => `<button type="button" data-tab="${id}">${id}</button>`).join("")}</nav>
        ${tabs.map((id, i) => `<section class="${roots[id]} ${i ? "" : "active"}" data-tab="${id}">
          <div style="height:1800px">Long ${id} content</div>
          <button type="button" class="bottom-control">Last ${id} control</button>
        </section>`).join("")}
      </form>
    </div>`);
  await page.locator("nav button").evaluateAll(buttons => {
    for (const button of buttons) button.addEventListener("click", () => {
      for (const tab of document.querySelectorAll("section.tab")) tab.classList.toggle("active", tab.dataset.tab === button.dataset.tab);
    });
  });
}

for (const height of [520, 860]) {
  for (const header of [180, 320]) {
    test(`all tabs reach their final control: ${height}px window, ${header}px header`, async ({ page }) => {
      await mount(page, { height, header });
      for (const id of tabs) {
        await page.locator(`nav button[data-tab="${id}"]`).click();
        const active = page.locator(`section[data-tab="${id}"]`);
        expect(await active.evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight > 0)).toBe(true);
        await active.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect(active.locator(".bottom-control")).toBeInViewport();
        await expect(page.locator(".sheet-top")).toBeInViewport();
        await expect(page.locator("nav")).toBeInViewport();
        await expect(page.locator("section.tab:not(.active)")).toHaveCount(6);
        for (const hidden of await page.locator("section.tab:not(.active)").all()) await expect(hidden).toBeHidden();
      }
    });
  }
}

test("fixture reproduces the inaccessible bottom without the viewport fix", async ({ page }) => {
  const beforeFix = baseCSS.replace(/\/\* Agent tab viewport\.[\s\S]*?(?=\/\* Header \*\/)/, "");
  await mount(page, { height: 520, css: beforeFix });
  const tab = page.locator("section.tab.active");
  await tab.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(tab.locator(".bottom-control")).not.toBeInViewport();
});
