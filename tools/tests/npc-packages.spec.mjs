import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildPacks } from "../lib/pack-docs.mjs";
import { planNpcPackage } from "../../module/rules/npc-packages.mjs";
import { manageNpcPackages, npcPackagePreview } from "../../module/apps/npc-packages.mjs";

const built = buildPacks();
const data = JSON.parse(built.generated["module/data/npc-packages.json"]);
const doc = built.packs["core-npcs"].docs.find(a => a.name === "Commando");
const snapshot = { ...doc, items: doc.embedded.items };
const actor = {
  isOwner: true,
  system: snapshot.system,
  flags: snapshot.flags,
  toObject: () => structuredClone(snapshot)
};
const dialogs = [];
globalThis.game = { user: { isGM: true } };
globalThis.foundry = {
  applications: {
    api: {
      DialogV2: {
        input: async options => {
          dialogs.push(options.content);
          return null;
        }
      }
    }
  }
};
globalThis.ui = {
  notifications: {
    warn: message => {
      throw Error(message);
    }
  }
};
await manageNpcPackages(actor, { data });
await manageNpcPackages(actor, { data, editBands: true });
const preview = npcPackagePreview(planNpcPackage(snapshot, data, "veteran", { threatLevel: 15 }));
const css = ["spycraft2.css", "retro.css"]
  .map(name => readFileSync(new URL(`../../styles/${name}`, import.meta.url), "utf8"))
  .join("\n");

for (const height of [560, 900]) {
  test(`package selection, editable bands and preview remain reachable at ${height}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 900, height });
    const mount = async content =>
      page.setContent(`<style>
      * {box-sizing:border-box} body {margin:8px} .application {width:620px;display:flex;flex-direction:column}
      .window-content {display:flex;flex-direction:column;padding:12px} .dialog-content {min-height:0}
      ${css}</style><div class="application spycraft2 sc2-dialog"><header class="window-header">NPC package</header>
      <div class="window-content"><form class="dialog-form"><div class="dialog-content">${content}</div>
      <footer class="form-footer"><button type="button">Cancel</button><button type="button" data-action="yes">Apply package</button></footer></form></div></div>`);
    await mount(dialogs[0]);
    await expect(page.locator('select[name="packageId"]')).toHaveValue("fixed");
    await expect(page.locator('option[value="basic"]')).toContainText("suggested");
    await page.locator('select[name="packageId"]').selectOption("veteran");
    await expect(page.getByRole("button", { name: "Apply package" })).toBeInViewport();
    await mount(dialogs[1]);
    for (const name of ["basicMin", "basicMax", "establishedMin", "establishedMax", "veteranMin", "veteranMax"])
      await expect(page.locator(`[name="${name}"]`)).toBeVisible();
    await page.locator('[name="veteranMin"]').fill("14");
    await expect(page.locator('[name="veteranMin"]')).toHaveValue("14");
    await mount(preview);
    await expect(page.getByText("Replace current template items")).toBeVisible();
    const region = page.locator(".dialog-content");
    expect(await region.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await region.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByText(/Equipment uses catalog Calibers/)).toBeInViewport();
    await expect(page.getByRole("button", { name: "Apply package" })).toBeInViewport();
    expect(await page.locator(".application").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sc2-npc-package-preview-${height}.png`) });
  });
}
