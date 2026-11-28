import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { blastTargetRows, blastGeometryFields, measuredBlastActors } from "../../module/apps/blast-dialog.mjs";

const css = systemCss(),
  actors = Array.from({ length: 6 }, (_, index) => ({
    uuid: "Actor." + index,
    name: "Blast target " + index,
    isOwner: true
  })),
  caught = actors.map((actor, index) => ({
    actor,
    name: actor.name,
    ring: index,
    damage: Math.floor(40 / 2 ** index),
    behindWall: index === 1
  }));
caught.push({ ...caught[2], name: "Second token for target 2", ring: 0, damage: 40 });

for (const theme of ["light", "dark"])
  test(`blast shape, cover evidence and position choices fit in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setContent(
      `<style>${css} body { margin: 0; } main.application { width: 700px; max-height: 680px; margin: 8px; display: flex; flex-direction: column; } .window-content { overflow: auto; min-height: 0; padding: 12px; }</style><main class="application spycraft2 sc2-dialog theme-${theme}"><div class="window-content"><form><div class="spycraft2-roll-options"><table><thead><tr><th>Character</th><th>Feet from Ground Zero</th><th>Before cover</th><th>Blast path</th></tr></thead><tbody>${blastTargetRows(actors, measuredBlastActors(caught), 5)}</tbody></table>${blastGeometryFields()}</div><footer><button type="submit">Apply to those ticked</button></footer></form></div></main>`
    );
    await expect(page.locator('[name="hit0"]')).toBeChecked();
    await expect(page.locator('[name="hit1"]')).not.toBeChecked();
    await expect(page.locator('[name="route1"]')).toHaveValue("blocked");
    await expect(page.locator('[name="feet2"]')).toHaveValue("");
    await expect(page.locator('[name="hit2"]')).not.toBeChecked();
    await expect(page.getByText(/Multiple tokens share this character/)).toBeVisible();
    await page.locator('[name="route1"]').selectOption("breached");
    const evidence = page
      .locator("tr")
      .filter({ has: page.locator('[name="route1"]') })
      .locator("details");
    await evidence.locator("summary").click();
    await evidence.locator("input").fill("Reviewed actual failed cover save");
    await page.locator('[name="shape"]').selectOption("cone");
    await page.locator('[name="routeConfirmed"]').check();
    const apply = page.getByRole("button", { name: "Apply to those ticked" });
    await apply.scrollIntoViewIfNeeded();
    await apply.focus();
    await expect(apply).toBeFocused();
    const rect = await apply.boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(700);
    expect(await page.locator(".window-content").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
