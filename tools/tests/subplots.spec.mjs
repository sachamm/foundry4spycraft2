import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { systemCss } from "../lib/system-css.mjs";
const source = readFileSync(new URL("../../templates/actor/agent-training.hbs", import.meta.url), "utf8");
const fragment = source.match(/<ul class="rows">\s*{{#each subplotRows}}[\s\S]*?<\/ul>/)?.[0];
if (!fragment) throw Error("The real Subplot rows were not found");
const hbs = Handlebars.create();
hbs.registerHelper("checked", value => (value ? "checked" : ""));
hbs.registerHelper("localize", () => "Remove Subplot");
const html = hbs.compile(fragment)({
  appId: "qa",
  subplotCompleteLabel: "Completed Subplot",
  subplotNameLabel: "Subplot name",
  subplotKindLabel: "Subplot type",
  subplotNotesLabel: "Subplot notes",
  subplotRows: Array.from({ length: 9 }, (_, i) => ({
    name: `Actual story ${i}`,
    notes: "Saved story notes",
    complete: false,
    kinds: [
      { value: "standard", label: "Standard Subplot", selected: true },
      { value: "seasoned", label: "Crossroads: Seasoned", disabled: true }
    ]
  }))
});
for (const width of [264, 480])
  test(`actual Subplot rows keep their name, type, notes and remove control aligned in a ${width}px column at720px`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setContent(
      `<style>${systemCss()}</style><form class="spycraft2 agent application"><div class="pane training" style="width:${width}px;max-height:640px;overflow:auto">${html}</div></form>`
    );
    const rows = page.locator(".subplot-row"),
      last = rows.last();
    await last.locator("select").scrollIntoViewIfNeeded();
    const boxes = await last.evaluate(row =>
      Object.fromEntries(
        ["input[type=checkbox]", "input[name$='.name']", "select", "input[name$='.notes']", "button"].map(selector => {
          const r = row.querySelector(selector).getBoundingClientRect();
          return [selector, { x: r.x, y: r.y, width: r.width, height: r.height }];
        })
      )
    );
    const checkbox = boxes["input[type=checkbox]"],
      name = boxes["input[name$='.name']"],
      remove = boxes.button;
    expect(Math.abs(checkbox.y + checkbox.height / 2 - (name.y + name.height / 2))).toBeLessThan(2);
    expect(Math.abs(remove.y + remove.height / 2 - (name.y + name.height / 2))).toBeLessThan(2);
    expect(boxes.select.y).toBeGreaterThanOrEqual(name.y + name.height);
    expect(await last.evaluate(row => row.scrollWidth <= row.clientWidth + 1)).toBe(true);
    await last.getByRole("combobox", { name: "Subplot type" }).selectOption("standard");
    expect(boxes.select.y).toBeGreaterThanOrEqual(0);
    expect(boxes.select.y + boxes.select.height).toBeLessThanOrEqual(720);
  });
