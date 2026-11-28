import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { createEnvironment } from "../lib/hbs-harness.mjs";
const css = systemCss(),
  environment = createEnvironment();
for (const theme of ["light", "dark"])
  for (const state of ["current", "review", "pending", "player"]) {
    test(`Drained ${state} controls respect ownership and remain reachable in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      const gc = state !== "player",
        html = environment.render("systems/spycraft2/templates/actor/parts/hazards.hbs", {
          hazards: {},
          drained: {
            levels: 1,
            effectiveLevel: 4,
            needsReview: state === "review",
            canApply: gc,
            canReview: gc,
            canRoll: gc && state === "current",
            pending: state === "pending" ? [{ mission: "previous-mission", dc: 20, state: "needsReview" }] : []
          }
        });
      await page.setContent(`<style>${css}
        body { margin: 0; } main.application { width: 560px; height: 660px; margin: 8px; display: flex; flex-direction: column; overflow: hidden; }
        main.application > .window-content { display: block; flex: 1; min-height: 0; overflow: auto; padding: 12px; }
        </style><main class="application spycraft2 sheet actor agent theme-${theme}"><div class="window-content">${html}</div></main>`);
      const region = page.locator(".hazards > section").first();
      await expect(region.getByRole("heading", { name: "Drained", exact: true })).toBeVisible();
      await expect(region.locator('[data-action="applyDrained"]')).toHaveCount(gc ? 1 : 0);
      await expect(region.locator('[data-action="rollDrainedRecovery"]')).toHaveCount(state === "current" ? 1 : 0);
      await expect(region.locator('[data-action="reviewDrainedRecovery"]')).toHaveCount(state === "pending" ? 1 : 0);
      if (state === "pending")
        await expect(region.locator('[data-action="reviewDrainedRecovery"]')).toHaveAttribute(
          "data-mission",
          "previous-mission"
        );
      if (gc) {
        const last = region.getByRole("button").last();
        await last.scrollIntoViewIfNeeded();
        await last.focus();
        await expect(last).toBeFocused();
        const rect = await last.boundingBox();
        expect(rect.y + rect.height).toBeLessThanOrEqual(680);
      } else await expect(region.getByRole("button")).toHaveCount(0);
      expect(await region.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });
  }

for (const theme of ["light", "dark"])
  for (const state of ["current", "review", "pending", "player"]) {
    test(`NPC Drained ${state} controls respect ownership and fit in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      const gc = state !== "player",
        html = environment.render("systems/spycraft2/templates/actor/parts/hazards.hbs", {
          hazards: {},
          npcDrained: {
            count: 2,
            gradeLosses: 2,
            effectiveLevel: 8,
            baseLevel: 10,
            specialLosses: true,
            manualStats: true,
            needsReview: state === "review",
            canApply: gc,
            canReview: gc,
            canRoll: gc && state === "current",
            losses: [{ source: "Original stress save", quality: "Damage Resistance" }],
            pending: state === "pending" ? [{ mission: "previous-mission", dc: 25, state: "needsReview" }] : []
          }
        });
      await page.setContent(
        `<style>${css} body { margin: 0; } main.application { width: 560px; height: 660px; margin: 8px; display: flex; flex-direction: column; overflow: hidden; } main.application > .window-content { display: block; flex: 1; min-height: 0; overflow: auto; padding: 12px; }</style><main class="application spycraft2 sheet actor npc theme-${theme}"><div class="window-content">${html}</div></main>`
      );
      const region = page.locator(".npc-drained");
      await expect(region.getByRole("heading", { name: "Drained", exact: true })).toBeVisible();
      await expect(region.locator('[data-action="applyNpcDrained"]')).toHaveCount(gc ? 1 : 0);
      await expect(region.locator('[data-action="rollDrainedRecovery"]')).toHaveCount(state === "current" ? 1 : 0);
      await expect(region.locator('[data-action="reviewDrainedRecovery"]')).toHaveCount(state === "pending" ? 1 : 0);
      if (gc) {
        const last = region.getByRole("button").last();
        await last.scrollIntoViewIfNeeded();
        await last.focus();
        await expect(last).toBeFocused();
        const rect = await last.boundingBox();
        expect(rect.y + rect.height).toBeLessThanOrEqual(680);
      } else await expect(region.getByRole("button")).toHaveCount(0);
      expect(await region.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });
  }
