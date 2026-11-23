import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { sheetPlacement } from "../../module/sheets/sheet-placement.mjs";

const read = name => readFileSync(new URL(`../../styles/${name}.css`, import.meta.url), "utf8");
const baseCSS = read("spycraft2");
const retroCSS = read("retro");
const agentCSS = read("sheet-agent");
const tabs = ["play", "skills", "gear", "abilities", "dossier"];
const templates = { play: "main", skills: "skills", gear: "gear", abilities: "abilities", dossier: "dossier" };
// Exercise real part root classes inside a Foundry-style fixed-height flex window.
// This is a layout regression fixture, not a replacement for live Foundry QA.
const roots = Object.fromEntries(
  tabs.map(id => {
    const source = readFileSync(new URL(`../../templates/actor/agent-${templates[id]}.hbs`, import.meta.url), "utf8");
    const classes = /<section class="([^"]+)"/.exec(source)[1].replace("{{tab.cssClass}}", "");
    return [id, classes];
  })
);

async function mount(page, { width = 980, height = 760, rail = 300, css = agentCSS } = {}) {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      .application { display:flex; flex-direction:column; width:${width}px; height:${height}px; overflow:hidden; }
      .window-header { flex:0 0 30px; }
      .window-content { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; }
      .sheet-tabs { display:flex; }
      .tab { display:none; }
      .tab.active { display:block; }
      ${read("tokens")}
      ${baseCSS}
      ${retroCSS}
      ${css}
    </style>
    <div class="application spycraft2 sheet actor agent">
      <header class="window-header">Character</header>
      <form class="window-content">
        <aside class="sheet-rail"><div style="height:${rail}px">Identity, vitals and checklist</div><button type="button" class="rail-bottom">Last rail control</button></aside>
        <nav class="sheet-tabs">${tabs.map(id => `<button type="button" data-tab="${id}">${id}</button>`).join("")}</nav>
        ${tabs
          .map(
            (id, i) => `<section class="${roots[id]} ${i ? "" : "active"}" data-tab="${id}">
          <div style="height:1800px">Long ${id} content</div>
          <button type="button" class="bottom-control">Last ${id} control</button>
        </section>`
          )
          .join("")}
      </form>
    </div>`);
  await page.locator("nav button").evaluateAll(buttons => {
    for (const button of buttons)
      button.addEventListener("click", () => {
        for (const tab of document.querySelectorAll("section.tab"))
          tab.classList.toggle("active", tab.dataset.tab === button.dataset.tab);
      });
  });
}

for (const height of [520, 760]) {
  for (const rail of [300, 1200]) {
    test(`every tab scrolls beside the rail: ${height}px window, ${rail}px rail`, async ({ page }) => {
      await mount(page, { height, rail });
      for (const id of tabs) {
        await page.locator(`nav button[data-tab="${id}"]`).click();
        const active = page.locator(`section[data-tab="${id}"]`);
        expect(await active.evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight > 0)).toBe(true);
        await active.evaluate(el => {
          el.scrollTop = el.scrollHeight;
        });
        await expect(active.locator(".bottom-control")).toBeInViewport();
        // The rail and the tab row stay put while a tab scrolls.
        await expect(page.locator(".sheet-rail")).toBeInViewport();
        await expect(page.locator("nav")).toBeInViewport();
        await expect(page.locator("section.tab:not(.active)")).toHaveCount(tabs.length - 1);
        for (const hidden of await page.locator("section.tab:not(.active)").all()) await expect(hidden).toBeHidden();
      }
      // A rail taller than the window scrolls on its own.
      await page.locator(".rail-bottom").scrollIntoViewIfNeeded();
      await expect(page.locator(".rail-bottom")).toBeInViewport();
      const [railBox, tabBox] = await Promise.all([
        page.locator(".sheet-rail").boundingBox(),
        page.locator("section.tab.active").boundingBox()
      ]);
      expect(railBox.x + railBox.width).toBeLessThanOrEqual(tabBox.x);
    });
  }
}

test("a narrow window folds the rail above the tabs and still reaches every final control", async ({ page }) => {
  await mount(page, { width: 560, height: 620 });
  const [railBox, navBox] = await Promise.all([
    page.locator(".sheet-rail").boundingBox(),
    page.locator("nav").boundingBox()
  ]);
  expect(railBox.y + railBox.height).toBeLessThanOrEqual(navBox.y);
  for (const id of tabs) {
    await page.locator(`nav button[data-tab="${id}"]`).scrollIntoViewIfNeeded();
    await page.locator(`nav button[data-tab="${id}"]`).click();
    const active = page.locator(`section[data-tab="${id}"]`);
    expect(await active.evaluate(el => el.clientHeight)).toBeGreaterThanOrEqual(80);
    await active.locator(".bottom-control").scrollIntoViewIfNeeded();
    await expect(active.locator(".bottom-control")).toBeInViewport();
    await active.locator(".bottom-control").click();
  }
  expect(await page.locator(".window-content").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("fixture reproduces the inaccessible bottom without the rail layout", async ({ page }) => {
  const beforeFix = agentCSS
    .replace(/\/\* -+ Layout: a rail[\s\S]*?(?=\/\* -+ Rail -+ \*\/)/, "")
    .replace(/@container \(max-width: 720px\) \{[\s\S]*?\n\}/, "");
  await mount(page, { height: 520, css: beforeFix });
  const tab = page.locator("section.tab.active");
  await tab.evaluate(el => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(tab.locator(".bottom-control")).not.toBeInViewport();
});

// The two screens the system is laid out for. The window is the size the sheet opens at on that screen (beside the
// scene controls and the 348px sidebar), and the styles are the full set a world loads, in the manifest's order.
for (const [screenWidth, screenHeight] of [
  [1280, 720],
  [1366, 768]
]) {
  test(`on a ${screenWidth}x${screenHeight} screen the agent sheet keeps its rail, and every tab scrolls to its end`, async ({
    page
  }) => {
    const { width, height } = sheetPlacement(
      { width: 860, height: 760 },
      { width: screenWidth, height: screenHeight, sidebar: 348, open: 0 }
    );
    await page.setViewportSize({ width: screenWidth, height: screenHeight });
    await mount(page, { width, height, css: systemCss() });
    for (const id of tabs) {
      await page.locator(`nav button[data-tab="${id}"]`).click();
      const active = page.locator(`section[data-tab="${id}"]`);
      await active.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(active.locator(".bottom-control")).toBeInViewport();
      await expect(page.locator(".sheet-rail")).toBeInViewport();
      await expect(page.locator("nav")).toBeInViewport();
    }
    const [railBox, tabBox, appBox] = await Promise.all([
      page.locator(".sheet-rail").boundingBox(),
      page.locator("section.tab.active").boundingBox(),
      page.locator(".application").boundingBox()
    ]);
    // Rail and content sit side by side inside the window, with nothing pushed out of it.
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(tabBox.x);
    expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(appBox.x + appBox.width + 0.5);
    expect(await page.locator(".application").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

// The NPC sheet is one part; its root must scroll inside the fixed-height window.
const npcRoot = /<section class="([^"]+)"/.exec(
  readFileSync(new URL("../../templates/actor/npc-sheet.hbs", import.meta.url), "utf8")
)[1];

async function mountNpc(page, { height = 800, css = baseCSS } = {}) {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      .application { display:flex; flex-direction:column; width:800px; height:${height}px; overflow:hidden; }
      .window-header { flex:0 0 30px; }
      .window-content { display:flex; flex-direction:column; flex:1; overflow:hidden; }
      ${css}
      ${retroCSS}
    </style>
    <form class="application spycraft2 sheet actor npc">
      <header class="window-header">NPC</header>
      <section class="window-content">
        <section class="${npcRoot}">
          <div style="height:2000px">Long graded NPC builder</div>
          <button type="button" class="bottom-control">Last NPC control</button>
        </section>
      </section>
    </form>`);
}

for (const height of [520, 800]) {
  test(`NPC sheet reaches its final control: ${height}px window`, async ({ page }) => {
    await mountNpc(page, { height });
    const root = page.locator(".window-content > section");
    expect(await root.evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight > 0)).toBe(true);
    await root.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(root.locator(".bottom-control")).toBeInViewport();
  });
}

test("NPC fixture reproduces the inaccessible bottom without the viewport fix", async ({ page }) => {
  const beforeFix = baseCSS.replace(/\/\* NPC sheet viewport\.[\s\S]*?(?=\/\* Biography )/, "");
  await mountNpc(page, { css: beforeFix });
  const root = page.locator(".window-content > section");
  await root.evaluate(el => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(root.locator(".bottom-control")).not.toBeInViewport();
});
