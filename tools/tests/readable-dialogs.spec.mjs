import { test, expect } from "@playwright/test";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

test("attack groups are searchable without losing collapsed or filtered declarations", async ({ page }) => {
  await page.setContent(`<dialog open><form><div class="spycraft2-roll-options">
    <label>Target <select name="targetActorUuid"><option value="guard">Guard</option></select></label>
    <label>Attack action <select name="attackAction"><option value="standard">Standard</option></select></label>
    <label><input type="checkbox" name="targetFlanked" /> I am flanking the opponent with legal Reach</label>
    <fieldset><legend>Aim, Brace and attack action</legend>
      <label><input type="checkbox" name="aimed" checked /> Aim was taken and remains valid for this target</label>
      <label><input type="checkbox" name="braced" /> Brace was taken and remains valid</label></fieldset>
    <label>Distance <input type="number" name="distanceFeet" value="20" /></label>
    <details><summary>Underwater</summary><label><input type="checkbox" name="submerged" /> Submerged</label></details>
  </div></form></dialog>`);
  const before = await page.locator("form").evaluate(form => [...new FormData(form)].sort());
  await page.evaluate(async url => {
    const { enhanceAttackDialog } = await import(url);
    enhanceAttackDialog(null, { element: document.querySelector("dialog") });
  }, uiModuleUrl("module/apps/attack-dialog-ux.mjs"));
  await expect(page.getByRole("checkbox", { name: "Aim already taken" })).toBeChecked();
  await expect(page.locator('[name="aimed"]')).toHaveAccessibleDescription(
    "Aim was taken and remains valid for this target"
  );
  await page.getByRole("searchbox", { name: "Find an option" }).fill("flanking");
  await expect(page.locator('[name="targetFlanked"]')).toBeVisible();
  await expect(page.locator('[name="aimed"]')).toBeHidden();
  expect(await page.locator("form").evaluate(form => [...new FormData(form)].sort())).toEqual(before);
  await page.getByRole("searchbox", { name: "Find an option" }).fill("no such option");
  await expect(page.getByText("No matching options. Try a shorter search.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator('[name="aimed"]')).toBeVisible();
  await expect(page.locator('[name="aimed"]')).toBeChecked();
  await expect(page.locator('[name="targetFlanked"]')).toBeHidden();
});

test("damage starts with routine fields and preserves critical/armor settings behind disclosures", async ({ page }) => {
  const markup = `<dialog open><form><div class="spycraft2-roll-options">
    <label>Target <select name="targetUuid" required><option value="guard">Guard</option></select></label>
    <label>Damage <input name="damage" type="number" value="10" required /></label>
    <label>Kind <select name="kind"><option value="lethal">Lethal</option></select></label>
    <label>Type <select name="type"><option value="">None</option></select></label>
    <label>Reduction source <select name="attackKind"><option value="ranged">Ranged</option></select></label>
    <label>Armor piercing <input name="armorPiercing" type="number" value="0" /></label>
    <label><input name="armorPiercingAll" type="checkbox" /> Ignore damage reduction</label>
    <label><input name="critical" type="checkbox" /> An activated critical hit applies to wounds</label>
    <label>Critical dice <input name="criticalDice" type="number" value="0" /></label>
    <label><input name="blast" type="checkbox" /> Blast</label></div></form></dialog>`;
  await page.setContent(markup);
  const before = await page.locator("form").evaluate(form => [...new FormData(form)].sort());
  await page.evaluate(async url => {
    const { enhanceDamageDialog } = await import(url);
    enhanceDamageDialog(null, { element: document.querySelector("dialog") });
  }, uiModuleUrl("module/apps/dialog-sections.mjs"));
  await expect(page.locator('[name="damage"]')).toBeVisible();
  await expect(page.locator('[name="attackKind"]')).toBeVisible();
  await expect(page.locator('[name="critical"]')).toBeHidden();
  expect(await page.locator("form").evaluate(form => [...new FormData(form)].sort())).toEqual(before);
  await page.locator(".sc2-damage-options > summary").click();
  await page.getByRole("searchbox", { name: "Find an option" }).fill("critical");
  await page.getByRole("checkbox", { name: "Activated critical hit" }).check();
  await expect(page.locator('[name="critical"]')).toHaveAccessibleDescription(
    "An activated critical hit applies to wounds"
  );
  await expect(page.locator('[name="armorPiercing"]')).toBeHidden();
  await expect(page.locator(".sc2-damage-options > summary")).toContainText("1 set");
  await page.locator(".sc2-damage-options > summary").click();
  expect(await page.locator("form").evaluate(form => new FormData(form).get("critical"))).toBe("on");
});

test("skill option search cannot re-enable or reveal circumstances for a different named check", async ({ page }) => {
  await page.setContent(`<form><div class="spycraft2-roll-options">
    <select name="check"><option value="balance">Balance</option><option value="repair" selected>Repair</option></select>
    <select name="ability"><option value="dex">DEX</option><option value="int" selected>INT</option></select>
    <details><summary>Balance</summary><input name="balanceCircumstances" type="checkbox" checked /></details>
    <details><summary>Gear</summary><input name="gearStatus" value="available" /></details>
  </div><button data-action="ok">Roll</button></form>`);
  await page.evaluate(async url => {
    const { enhanceSkillDialog } = await import(url);
    enhanceSkillDialog(null, { element: document.querySelector("form") }, [
      { id: "balance", attributes: ["dex"], tags: "Vision" },
      { id: "repair", attributes: ["int"], tags: "Gear" }
    ]);
  }, uiModuleUrl("module/apps/skill-dialog-ux.mjs"));
  await page.getByText("Advanced options", { exact: true }).click();
  await page.getByRole("searchbox", { name: "Find an option" }).fill("Balance");
  await expect(page.locator('[name="balanceCircumstances"]')).toBeHidden();
  await expect(page.locator('[name="balanceCircumstances"]')).toBeDisabled();
  expect(await page.locator("form").evaluate(form => new FormData(form).has("balanceCircumstances"))).toBe(false);
});

test("search narrows large groups to matching fields and reveals a filtered invalid field", async ({ page }) => {
  await page.setContent(`<form><details open><summary>Advanced</summary><details><summary>Environment</summary>
    <label>Fog <input name="fog" value="dense" /></label>
    <label>Ambient light <input name="ambientLight" value="bright" /></label>
    <label>Confirmation <input name="confirmation" required /></label>
  </details></details></form>`);
  await page.evaluate(async url => {
    const { organizeOptions } = await import(url);
    organizeOptions(document.querySelector("details"));
  }, uiModuleUrl("module/apps/dialog-sections.mjs"));
  await page.getByRole("searchbox", { name: "Find an option" }).fill("ambient");
  await expect(page.locator('[name="ambientLight"]')).toBeVisible();
  await expect(page.locator('[name="fog"]')).toBeHidden();
  expect(await page.locator("form").evaluate(form => new FormData(form).get("fog"))).toBe("dense");
  await page.locator("form").evaluate(form => form.checkValidity());
  await expect(page.getByRole("searchbox", { name: "Find an option" })).toHaveValue("");
  await expect(page.locator('[name="confirmation"]')).toBeVisible();
  await expect(page.locator('[name="fog"]')).toBeVisible();
});
