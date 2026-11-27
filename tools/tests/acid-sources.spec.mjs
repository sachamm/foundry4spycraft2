import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { createEnvironment } from "../lib/hbs-harness.mjs";

const css = systemCss(),
  environment = createEnvironment();
for (const theme of ["light", "dark"])
  for (const state of ["active", "owed", "legacy"]) {
    test(`acid ${state} controls preserve their source and remain reachable at 720px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      const source = {
        id: "original-attack",
        label: "Original acid attack against the character's protective equipment",
        damage: state === "active" ? 8 : 0,
        suffered: state === "active" ? 12 : 30,
        canRound: state === "active",
        armorAffected: state === "active",
        canWash: state === "active",
        canInjury: state === "owed",
        canReview: true
      };
      const html = environment.render("systems/spycraft2/templates/actor/parts/hazards.hbs", {
        isGM: true,
        hazards: {
          acidLegacyNeedsReview: state === "legacy",
          acidCanReview: true,
          acidNeedsAttention: true,
          acidSources: state === "legacy" ? [] : [source]
        }
      });
      await page.setContent(`<style>${css}
      body { margin: 0; } main.application { width: 560px; height: 660px; margin: 8px; display: flex; flex-direction: column; overflow: hidden; }
      main.application > .window-content { display: block; flex: 1; min-height: 0; overflow: auto; padding: 12px; }
      </style><main class="application spycraft2 sheet actor agent play-mode theme-${theme}"><div class="window-content">${html}</div></main>`);
      const sourceRegion = state === "legacy" ? page.locator(".hazards") : page.locator("details.acid-sources");
      const review = sourceRegion.locator('[data-action="acidStep"][data-step="review"]');
      await review.scrollIntoViewIfNeeded();
      await review.focus();
      await expect(review).toBeFocused();
      const rect = await review.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(8);
      expect(rect.y + rect.height).toBeLessThanOrEqual(680);
      expect(await sourceRegion.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(sourceRegion.locator('[data-step="round"]')).toHaveCount(state === "active" ? 1 : 0);
      await expect(sourceRegion.locator('[data-step="injury"]')).toHaveCount(state === "owed" ? 1 : 0);
      if (state !== "legacy") await expect(review).toHaveAttribute("data-acid-source", "original-attack");
    });
  }
