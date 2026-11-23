import { readFileSync } from "node:fs";
import { systemCss } from "../lib/system-css.mjs";
import { test, expect } from "@playwright/test";

// Layout regression fixtures for the vehicle actor sheet and the gear and vehicle item templates. They mount each
// template's real root classes and its section headings inside a Foundry-style fixed-height window, then check that
// the last control can be scrolled into view. They do not replace live Foundry QA.
const css = systemCss();
// Template text lives in lang/en.json; read each template with its English strings filled back in.
const strings = (function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "object") flatten(value, `${prefix}${key}.`, out);
    else out[prefix + key] = value;
  }
  return out;
})(JSON.parse(readFileSync(new URL("../../lang/en.json", import.meta.url), "utf8")));
const template = name =>
  readFileSync(new URL(`../../templates/${name}`, import.meta.url), "utf8").replace(
    /\{\{localize ["']([\w.]+)["']\}\}/g,
    (match, key) => strings[key] ?? match
  );
const rootClass = (source, tag) => new RegExp(`<${tag} class="([^"]+)"`).exec(source)[1];

const FIXTURES = {
  "vehicle actor sheet": {
    file: "actor/vehicle-sheet.hbs",
    tag: "section",
    app: "spycraft2 sheet actor vehicle",
    width: 680,
    controls: [
      "Control check",
      "Damage save",
      "Vehicle Damage result",
      "Tire save",
      "Fuel explosion",
      "Repaired",
      "Jamming on",
      "Record use",
      "Refuel",
      "Bail out",
      "Fire"
    ]
  },
  "gear item sheet": {
    file: "item/item-gear.hbs",
    tag: "section",
    app: "spycraft2 sheet item",
    width: 560,
    controls: ["Damage save", "Repair", "Use", "Recharge", "Signal reception DC", "Pay the cost", "Issue to the team"]
  },
  "vehicle item sheet": {
    file: "item/item-vehicle.hbs",
    tag: "section",
    app: "spycraft2 sheet item",
    width: 560,
    controls: ["Damage save", "Place on a scene", "Pay the cost"]
  }
};

async function mount(page, fixture, height) {
  const source = template(fixture.file);
  const sections = [...source.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m =>
    m[1].replace(/\{\{[^}]*\}\}/g, "Section").trim()
  );
  // Every control the template offers must exist in it; the fixture lists the ones added for vehicles and gear.
  for (const label of fixture.controls) expect(source, `${fixture.file}: ${label}`).toContain(label);
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      .application { display:flex; flex-direction:column; width:${fixture.width}px; height:${height}px; overflow:hidden; }
      .window-header { flex:0 0 30px; }
      .window-content { display:flex; flex-direction:column; flex:1; overflow:hidden; }
      ${css}
    </style>
    <div class="application ${fixture.app}">
      <header class="window-header">${fixture.file}</header>
      <form class="window-content">
        <${fixture.tag} class="${rootClass(source, fixture.tag)}" style="overflow-y:auto; flex:1">
          ${sections.map(title => `<h3>${title}</h3><div style="height:260px">${title} content</div>`).join("")}
          <div style="height:900px">Table values and description</div>
          <p class="controls">${fixture.controls.map(label => `<a>${label}</a>`).join(" · ")}</p>
          <button type="button" class="bottom-control">Last control</button>
        </${fixture.tag}>
      </form>
    </div>`);
}

for (const [name, fixture] of Object.entries(FIXTURES)) {
  // 648 and 696 are the heights a sheet opens at on 1280x720 and 1366x768 screens.
  for (const height of [520, 648, 696, 780]) {
    test(`${name}: the last control is reachable in a ${height}px window`, async ({ page }) => {
      await mount(page, fixture, height);
      const body = page.locator(`form > ${fixture.tag}`);
      expect(await body.evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight > 0)).toBe(true);
      await body.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(body.locator(".bottom-control")).toBeInViewport();
      await expect(page.locator(".window-header")).toBeInViewport();
    });
  }
}
