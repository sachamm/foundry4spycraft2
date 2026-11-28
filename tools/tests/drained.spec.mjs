import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { createEnvironment } from "../lib/hbs-harness.mjs";
const css = systemCss(),
  environment = createEnvironment();

for (const theme of ["light", "dark"])
  test(`NPC condition tools and pinned health remain usable in a narrow ${theme} sheet`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const html = environment.render("systems/spycraft2/templates/actor/npc-sheet.hbs", {
      actor: { name: "Condition review NPC" },
      editable: true,
      editMode: true,
      system: {
        npcProfile: { enabled: true },
        npcBuild: { xp: 120 },
        effectiveThreatLevel: 10,
        bab: 10,
        defense: { total: 24 },
        initiative: { total: 8 },
        defenseExtras: { misc: 1, dodge: 3 }
      },
      healthChip: "vitality 120/120 · wounds 18/18",
      saves: [
        { label: "Fortitude", total: 10 },
        { label: "Reflex", total: 12 },
        { label: "Will", total: 9 }
      ],
      npcConditions: { speed: 15, canRun: false, fatigue: true, fatigueRest: true }
    });
    await page.setContent(
      `<style>${css} body { margin: 0; } main.application { width: 480px; height: 660px; margin: 8px; display: flex; flex-direction: column; overflow: hidden; } main.application > .window-content { display: block; flex: 1; min-height: 0; overflow: auto; padding: 12px; }</style><main class="application spycraft2 sheet actor npc theme-${theme}"><div class="window-content">${html}</div></main>`
    );
    const health = page.locator(".npc-pinned-health");
    const grid = page.locator(".npc-pinned");
    expect((await health.boundingBox()).width).toBeGreaterThan((await grid.boundingBox()).width * 0.8);
    expect((await grid.boundingBox()).height).toBeLessThan(210);
    const tools = page.locator(".npc-condition-tools");
    await tools.locator("summary").click();
    await expect(tools).toContainText("Speed: 15 ft.");
    await expect(tools).toContainText("Run is unavailable");
    const last = tools.locator('[data-action="completeFatigueRest"]');
    await last.scrollIntoViewIfNeeded();
    await last.focus();
    await expect(last).toBeFocused();
    const box = await last.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(680);
    expect(box.y).toBeGreaterThan((await grid.boundingBox()).y + (await grid.boundingBox()).height);
    await expect(tools.locator('[data-action="completeMentalLeapSleep"]')).toHaveCount(0);
    expect(await tools.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });

for (const theme of ["light", "dark"])
  for (const state of ["held", "pending", "review", "observer"])
    test(`NPC grapple ${state} controls respect ownership and fit in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      const owner = state !== "observer",
        html = environment.render("systems/spycraft2/templates/actor/parts/hazards.hbs", {
          hazards: {},
          npcRestraints: {
            held: state === "held" || state === "observer",
            canEscape: owner && state === "held",
            needsReview: state === "review",
            canReview: owner && state === "review",
            pending: state === "pending" ? [{ messageUuid: "ChatMessage.original", maximum: 30 }] : []
          }
        });
      await page.setContent(
        `<style>${css} main.application { width: 560px; height: 660px; display: flex; flex-direction: column; overflow: hidden; } .window-content { overflow: auto; padding: 12px; }</style><main class="application spycraft2 sheet actor npc theme-${theme}"><div class="window-content">${html}</div></main>`
      );
      await expect(page.locator('[data-action="escapeRestraint"]')).toHaveCount(state === "held" ? 1 : 0);
      await expect(page.locator('[data-action="reviewRestraintRelease"]')).toHaveCount(state === "review" ? 1 : 0);
      await expect(page.locator('[data-action="confirmRestraintEscapeMove"]')).toHaveCount(state === "pending" ? 1 : 0);
      if (state === "pending")
        await expect(page.locator('[data-action="confirmRestraintEscapeMove"]')).toHaveAttribute(
          "data-message-uuid",
          "ChatMessage.original"
        );
      const button = page.locator(".hazard button").last();
      if (owner) {
        await button.scrollIntoViewIfNeeded();
        await button.focus();
        await expect(button).toBeFocused();
        const rect = await button.boundingBox();
        expect(rect.y + rect.height).toBeLessThanOrEqual(680);
      } else await expect(page.locator(".hazard button")).toHaveCount(0);
    });
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
