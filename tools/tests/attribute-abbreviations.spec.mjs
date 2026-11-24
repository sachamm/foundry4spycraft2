import { readFileSync } from "node:fs";
import { systemCss } from "../lib/system-css.mjs";
import { test, expect } from "@playwright/test";

// The attribute tiles on the NPC stat block and the agent Play strip show three-letter abbreviations when the sheet is
// too narrow for the full names. These fixtures mount the real tile markup and stylesheets in a window of each width
// and check that every tile shows exactly one label, the expected one, and that it is not cut off.
const css = systemCss();
const en = JSON.parse(readFileSync(new URL("../../lang/en.json", import.meta.url), "utf8")).SPYCRAFT;
const keys = ["str", "dex", "con", "int", "wis", "cha"];
const read = name => readFileSync(new URL(`../../templates/${name}`, import.meta.url), "utf8");
const tile = (source, start, end) => {
  const from = source.indexOf(start);
  return source.slice(from, source.indexOf(end, from) + end.length);
};
const fill = (markup, key) =>
  markup
    .replace(/\{\{label\}\}/g, en.Ability[key])
    .replace(/\{\{abbr\}\}/g, en.AbilityAbbr[key])
    .replace(/\{\{key\}\}/g, key)
    .replace(/\{\{signed mod\}\}/g, "+1")
    .replace(/\{\{value\}\}/g, "12")
    .replace(/\{\{#if[^}]*\}\}.*?\{\{\/if\}\}/g, "")
    .replace(/\{\{[^}]*\}\}/g, "");

const npcTile = tile(read("actor/npc-sheet.hbs"), '<div class="ability">', "</div>");
const agentTile = tile(read("actor/play/dashboard.hbs"), '<button type="button" class="stat', "</button>");

async function mount(page, kind, width) {
  const tiles = keys.map(key => fill(kind === "npc" ? npcTile : agentTile, key)).join("");
  const body =
    kind === "npc"
      ? `<section class="spycraft2-sheet npc"><div class="abilities-row">${tiles}</div></section>`
      : `<aside class="sheet-rail" style="flex:0 0 264px"></aside><section class="tab active" style="flex:1;min-width:0">
          <div class="play-dashboard"><div class="ability-strip"><div class="stat-grid">${tiles}</div></div></div></section>`;
  // Above 720px the agent rail sits beside the tabs, which is what squeezes the strip.
  const row = kind === "agent" && width > 720;
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      .application { display:flex; flex-direction:column; width:${width}px; }
      .window-content { display:flex; flex-direction:${row ? "row" : "column"}; padding:10px 12px; }
      ${css}
    </style>
    <div class="application spycraft2 sheet actor ${kind} play-mode"><form class="window-content">${body}</form></div>`);
}

const labels = page =>
  page.locator("[data-action=rollAbility]").evaluateAll(buttons =>
    buttons.map(button => {
      const shown = [...button.querySelectorAll(".ability-name, .ability-abbr")].filter(
        el => el.getClientRects().length
      );
      const tileBox = button.closest(".ability, .stat").getBoundingClientRect();
      const cut =
        shown.length !== 1 ||
        button.scrollWidth > button.clientWidth + 0.5 ||
        shown[0].getBoundingClientRect().right > tileBox.right + 0.5;
      return cut ? "cut" : shown[0].textContent;
    })
  );

const full = keys.map(key => en.Ability[key]);
const short = keys.map(key => en.AbilityAbbr[key]);

for (const [kind, cases] of Object.entries({
  npc: { 320: short, 400: short, 480: short, 640: short, 720: full, 860: full },
  agent: { 600: full, 720: full, 760: short, 840: short, 900: full }
})) {
  for (const [width, expected] of Object.entries(cases)) {
    test(`${kind} sheet at ${width}px shows ${expected === full ? "full attribute names" : "abbreviations"}`, async ({
      page
    }) => {
      await mount(page, kind, Number(width));
      expect(await labels(page)).toEqual(expected);
    });
  }
}

test("each attribute tile keeps its full name for screen readers", () => {
  expect(npcTile).toContain("aria-label=\"{{localize 'SPYCRAFT.Action.RollNamed' name=label}}\"");
  expect(agentTile).toContain("aria-label=\"{{localize 'SPYCRAFT.Action.RollNamed' name=label}}\"");
});
