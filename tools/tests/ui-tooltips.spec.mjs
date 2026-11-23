import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const i18n = `data:text/javascript;base64,${readFileSync(new URL("../../module/i18n.mjs", import.meta.url)).toString("base64")}`;
const catalogUrl = `data:text/javascript;base64,${readFileSync(new URL("../../module/apps/ui-button-catalog.mjs", import.meta.url)).toString("base64")}`;
const verbsUrl = `data:text/javascript;base64,${readFileSync(new URL("../../module/apps/ui-verb-icons.mjs", import.meta.url)).toString("base64")}`;
const source = readFileSync(new URL("../../module/apps/ui-tooltips.mjs", import.meta.url), "utf8")
  .replace('"../i18n.mjs"', JSON.stringify(i18n))
  .replace('"./ui-button-catalog.mjs"', JSON.stringify(catalogUrl))
  .replace('"./ui-verb-icons.mjs"', JSON.stringify(verbsUrl));
const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

test.beforeEach(async ({ page }) => {
  await page.setContent(`<main class="spycraft2">
    <label>Attack action <select name="attackAction"><option>Standard Attack</option></select></label>
    <label>Distance <input type="number" name="distanceFeet" min="0" /></label>
    <div class="form-group"><label>Mission budget <input type="number" min="0" max="10" step="1" /></label><p class="hint">The GC sets the budget.</p></div>
    <button data-action="itemDelete">Remove</button>
    <button data-action="rollAttack" data-tooltip="Attack" title="Attack">Attack</button>
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
  await expect(page.locator('[name="attackAction"]')).toHaveAttribute("data-tooltip", "Attack action");
  await expect(page.locator('[name="distanceFeet"]')).toHaveAttribute("aria-description", "Range (ft)");
  await expect(page.locator(".form-group input")).toHaveAttribute("data-tooltip", "Mission budget (0–10)");
  await expect(page.locator('[data-action="itemDelete"]')).toHaveAttribute("data-tooltip", "Remove item");
  await expect(page.locator('[data-tab="gear"]')).toHaveAttribute("data-tooltip", "Gear");
  await expect(page.locator("#skills-tab")).toHaveAttribute("data-tooltip", "Skills");
  await expect(page.locator("prose-mirror")).toHaveAttribute("data-tooltip", "Biography");
  await expect(page.locator("td input")).toHaveAttribute("data-tooltip", "Skill ranks");
  await expect(page.locator("summary")).toHaveAttribute("data-tooltip", "Extra options");
  await expect(page.locator("#portrait")).toHaveAttribute("data-tooltip", "Change image");
  await expect(page.locator("#icon-only")).toHaveAttribute("data-tooltip", "review Special Case");
  await expect(page.locator("#reference")).toHaveAttribute("data-tooltip", "Reference");
});

test("button help is compact while user values and unrelated applications are preserved", async ({ page }) => {
  await expect(page.locator('[data-action="rollAttack"]')).toHaveAttribute("data-tooltip", "Attack");
  await expect(page.locator('[data-action="rollAttack"]')).not.toHaveAttribute("title");
  await expect(page.locator("#outside")).not.toHaveAttribute("data-tooltip");
  await page.locator('[name="distanceFeet"]').fill("25");
  await page.locator('[data-action="cancel"]').focus();
  await expect(page.locator('[name="distanceFeet"]')).toHaveValue("25");
  await expect(page.locator('[name="distanceFeet"]')).not.toHaveAttribute("data-tooltip", /25/);
});

test("controls added after rendering receive tooltips on focus or hover", async ({ page }) => {
  await page.evaluate(() =>
    document
      .querySelector("main")
      .insertAdjacentHTML("beforeend", '<label>Loaded shots <input name="system.shotsLoaded" id="dynamic" /></label>')
  );
  await page.locator("#dynamic").focus();
  await expect(page.locator("#dynamic")).toHaveAttribute("data-tooltip", "Loaded ammo");
  await page.evaluate(() =>
    document
      .querySelector("main")
      .insertAdjacentHTML("beforeend", '<button data-action="reload" id="reload">Reload</button>')
  );
  await page.locator("#reload").hover();
  await expect(page.locator("#reload")).toHaveAttribute("data-tooltip", "Reload");
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
  expect(result.tip).toBe("Resolve");
});

test("button names survive icon conversion and compact tooltips", async ({ page }) => {
  const attack = page.locator('[data-action="rollAttack"]');
  await expect(attack).toHaveAttribute("aria-label", "Attack");
  await expect(page.locator('[data-action="cancel"]')).toHaveAttribute("aria-label", "Cancel");
  await page.evaluate(() => {
    document.querySelector('[data-action="rollAttack"]').innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
    window.tooltips.enhanceTooltips(document.querySelector("main"));
  });
  await expect(attack).toHaveAccessibleName("Attack");
  await expect(attack).toHaveAttribute("data-tooltip", "Attack");
  await expect(page.locator("#outside")).not.toHaveAttribute("aria-label");
});

test("action buttons show generated icons and retain keyboard access and help", async ({ page }) => {
  const css = readFileSync(new URL("../../styles/spycraft2.css", import.meta.url), "utf8");
  await page.addStyleTag({ content: css });
  const remove = page.getByRole("button", { name: "Remove", exact: true });
  await expect(remove.locator(".sc2-button-icon")).toBeVisible();
  // Unmarked controls show the pictogram beside their label.
  await expect(remove).toHaveAttribute("data-sc2-mode", "both");
  await expect(remove.locator(".sc2-button-content")).toBeVisible();
  await expect(remove).toHaveAttribute("data-tooltip", "Remove item");
  await remove.focus();
  await expect(remove).toBeFocused();
  await expect(page.locator('[data-action="tab"] .sc2-button-icon')).toHaveCount(0);
  await expect(page.locator("#outside .sc2-button-icon")).toHaveCount(0);
  await page.evaluate(() => window.tooltips.enhanceTooltips(document.querySelector("main")));
  await expect(remove.locator(".sc2-button-icon")).toHaveCount(1);
  await expect(remove).not.toHaveAttribute("style", /url\(/);
  await page.screenshot({ path: "test-results/button-icons-preview.png" });
});

test("display modes keep names and numbers readable and reserve icon-only for marked toolbars", async ({ page }) => {
  await page.addStyleTag({ content: readFileSync(new URL("../../styles/spycraft2.css", import.meta.url), "utf8") });
  await page.evaluate(() => {
    document.querySelector("main").insertAdjacentHTML(
      "beforeend",
      `<span class="controls" data-sc2-display="icon"><button data-action="itemChat" id="row-share">Share</button>
         <button data-action="itemEdit" id="row-name">Beretta 92</button>
         <button data-action="reloadWeapon" data-sc2-display="both" id="row-reload">Reload</button></span>
       <button data-action="rollSkill" id="skill">Athletics</button>
       <button data-action="rollAbility" id="mod">+3</button>
       <button data-action="rollDamage" data-sc2-display="icon" id="forced">2d6</button>`
    );
    window.tooltips.enhanceTooltips(document.querySelector("main"));
  });
  await expect(page.locator("#row-share")).toHaveAttribute("data-sc2-mode", "icon");
  await expect(page.locator("#row-share .sc2-button-content")).toBeHidden();
  await expect(page.locator("#row-share")).toHaveAccessibleName("Share");
  // A name stays text even inside an icon-only toolbar; a control's own setting overrides both rules.
  for (const id of ["#row-name", "#skill", "#mod"]) {
    await expect(page.locator(`${id} .sc2-button-icon`)).toHaveCount(0);
    await expect(page.locator(id)).not.toHaveClass(/sc2-icon-button/);
  }
  await expect(page.locator("#skill")).toHaveText("Athletics");
  await expect(page.locator("#mod")).toHaveText("+3");
  await expect(page.locator("#row-reload")).toHaveAttribute("data-sc2-mode", "both");
  await expect(page.locator("#row-reload .sc2-button-content")).toBeVisible();
  await expect(page.locator("#forced")).toHaveAttribute("data-sc2-mode", "icon");
});

test("clock controls that ask for artwork get distinct pictures, compact hover text and unchanged actions", async ({
  page
}) => {
  await page.evaluate(() => {
    document
      .querySelector("main")
      .insertAdjacentHTML(
        "afterbegin",
        `<div id="clock-controls" data-sc2-art>${[6, -6, 60, 600, 3600, 28800, 86400].map(seconds => `<button data-action="clockStep" data-seconds="${seconds}">${seconds === 6 ? "+1 round" : seconds === -6 ? "-1 round" : "+" + seconds + " sec"}</button>`).join("")}</div>`
      );
    window.tooltips.enhanceTooltips(document.querySelector("main"));
  });
  const buttons = page.locator("#clock-controls button");
  const cells = await buttons.evaluateAll(nodes => nodes.map(node => node.dataset.sc2Icon));
  expect(new Set(cells).size).toBe(7);
  await expect(buttons.nth(0)).toHaveAttribute("data-tooltip", "+1 rd");
  await expect(buttons.nth(1)).toHaveAttribute("data-tooltip", "-1 rd");
  await expect(buttons.nth(0)).toHaveAttribute("data-seconds", "6");
});

test("every atlas image loads where a region asks for artwork", async ({ page }) => {
  const catalog = JSON.parse(readFileSync(new URL("../../assets/ui/functions/catalog.json", import.meta.url)));
  await page.route(/\/assets\/ui\/functions\/[^/]+\.webp$/, route => {
    const file = new URL(route.request().url()).pathname.split("/").at(-1);
    return route.fulfill({
      contentType: "image/webp",
      body: readFileSync(new URL(`../../assets/ui/functions/${file}`, import.meta.url))
    });
  });
  await page.addStyleTag({
    content:
      readFileSync(new URL("../../styles/spycraft2.css", import.meta.url), "utf8") +
      `body { background: #29251f; color: #f5ecd5; font: 12px sans-serif; } #gallery { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; } #gallery label { display: flex; gap: 4px; align-items: center; }`
  });
  await page.evaluate(items => {
    document.head.insertAdjacentHTML("afterbegin", '<base href="http://spycraft.test/">');
    const main = document.querySelector("main");
    main.innerHTML = `<div id="clock-gallery" data-sc2-art>${[6, -6, 60, -60, 600, -600, 3600, -3600, 28800, -28800, 86400, -86400].map(seconds => `<button data-action="clockStep" data-seconds="${seconds}">${seconds} sec</button>`).join("")}</div><div id="gallery" data-sc2-art>${items.map(item => `<label><button data-action="${item.action.split(":")[0]}" ${item.action.includes(":") ? `data-${item.action.startsWith("entry") ? "change" : item.action.startsWith("group") ? "single" : "planned"}="${item.action.split(":")[1]}"` : ""}>${item.subject}</button><span>${item.subject}</span></label>`).join("")}</div>`;
    window.tooltips.enhanceTooltips(main);
  }, catalog);
  const loaded = await page.evaluate(async () => {
    // Each atlas address comes from the stylesheet, never from an inline style on the control.
    const urls = new Set(
      [...document.querySelectorAll(".sc2-icon-button > .sc2-button-icon")].map(node =>
        getComputedStyle(node).backgroundImage.slice(5, -2)
      )
    );
    return Promise.all(
      [...urls].map(
        src =>
          new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve({ src, ok: true });
            image.onerror = () => resolve({ src, ok: false });
            image.src = src;
          })
      )
    );
  });
  expect(loaded).toHaveLength(8);
  expect(loaded.every(item => item.ok)).toBe(true);
  await page.screenshot({ path: "test-results/function-icons-preview.png", fullPage: true });
});

test("buttons expose one hover tooltip and one accessible name", async ({ page }) => {
  const attack = page.locator('[data-action="rollAttack"]');
  await expect(attack).toHaveAttribute("data-tooltip", "Attack");
  await expect(attack).not.toHaveAttribute("title");
  await expect(attack).toHaveAccessibleName("Attack");
  const button = page.locator('[data-action="itemDelete"]');
  await expect(button).toHaveAttribute("data-tooltip", "Remove item");
  await expect(button).not.toHaveAttribute("title");
  await expect(button).not.toHaveAttribute("aria-description");
  await expect(button).toHaveAccessibleName("Remove");
  const icon = button.locator(".sc2-button-icon");
  await expect(icon).toHaveAttribute("aria-hidden", "true");
  for (const attribute of ["title", "alt", "aria-label", "data-tooltip"]) {
    await expect(icon).not.toHaveAttribute(attribute);
  }
  await page.evaluate(() => window.tooltips.enhanceTooltips(document.querySelector("main")));
  await expect(button).not.toHaveAttribute("title");
  await expect(button).not.toHaveAttribute("aria-description");
});

test("Tab walks a sheet past its tabs and stays inside a dialog, whatever Foundry binds to Tab", async ({ page }) => {
  await page.setContent(`<div class="application spycraft2" id="sheet">
      <nav class="sheet-tabs"><a data-action="tab" data-tab="play" data-group="primary" class="active">Play</a><a data-action="tab" data-tab="gear" data-group="primary">Gear</a></nav>
      <section class="tab" data-tab="play" data-group="primary"><button id="attack">Attack</button><button id="damage">Damage</button></section>
    </div>
    <dialog class="application dialog" id="dialog" open><div class="spycraft2-roll-options"><label>Target <input id="target" /></label><label>Range <input id="range" /></label></div><button id="roll">Roll attack</button></dialog>`);
  await page.evaluate(async moduleUrl => {
    // Stand-in for Foundry's window-level Tab keybinding (cycle views), which takes Tab away from the page.
    window.addEventListener("keydown", event => event.key === "Tab" && event.preventDefault());
    const tooltips = await import(moduleUrl);
    tooltips.enhanceTooltips(document.querySelector("#sheet"));
    tooltips.enhanceTooltips(document.querySelector("#dialog .spycraft2-roll-options"));
  }, url);
  await page.locator('[data-tab="play"]').first().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#attack")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#damage")).toBeFocused();
  await page.locator("#roll").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#target")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#roll")).toBeFocused();
});

test("help written in a template survives the render pass and later hover passes, unshortened", async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector("main").insertAdjacentHTML(
      "beforeend",
      `<button data-action="itemDelete" id="authored" data-tooltip="Use this once the round has ended.">Remove</button>
         <button data-action="itemDelete" id="generated">Remove</button>`
    );
    window.tooltipHooks.get("renderApplicationV2")({ element: document.querySelector("main") });
  });
  const authored = page.locator("#authored");
  await expect(authored).toHaveAttribute("data-tooltip", "Use this once the round has ended.");
  await authored.hover();
  await authored.focus();
  await expect(authored).toHaveAttribute("data-tooltip", "Use this once the round has ended.");
  // Where a template wrote nothing, the catalogue still answers, on every pass.
  await page.locator("#generated").hover();
  await expect(page.locator("#generated")).toHaveAttribute("data-tooltip", "Remove item");
});
