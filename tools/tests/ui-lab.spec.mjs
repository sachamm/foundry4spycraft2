import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("system.json"));
// The lab loads the stylesheets exactly as the manifest orders them.
const css = manifest.styles.map(path => read(path).replace(/@import[^;]+;/g, "")).join("\n");
const i18n = `data:text/javascript;base64,${Buffer.from(read("module/i18n.mjs")).toString("base64")}`;
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const tooltips = data(
  read("module/apps/ui-tooltips.mjs")
    .replace('"../i18n.mjs"', JSON.stringify(i18n))
    .replace('"./ui-button-catalog.mjs"', JSON.stringify(data(read("module/apps/ui-button-catalog.mjs"))))
    .replace('"./ui-verb-icons.mjs"', JSON.stringify(data(read("module/apps/ui-verb-icons.mjs"))))
);

async function openLab(page, width = 980) {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(read("tools/ui-lab/index.html"));
  // Colours are read at rest, so state fades are switched off.
  await page.addStyleTag({ content: `${css}\n* { transition: none !important; }` });
  await page.evaluate(async url => {
    window.Hooks = { on() {} };
    const { enhanceTooltips } = await import(url);
    document.querySelectorAll(".lab-app").forEach(enhanceTooltips);
  }, tooltips);
}

const rgb = value =>
  value
    .match(/\d+(\.\d+)?/g)
    .slice(0, 3)
    .map(Number);
const luminance = ([r, g, b]) =>
  [r, g, b]
    .map(v => v / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const theme of ["light", "dark"])
  test(`components keep readable contrast and their roles in the ${theme} theme`, async ({ page }) => {
    await openLab(page);
    const app = page.locator(`.lab-app[data-theme="${theme}"]`);
    const colours = await app.evaluate(root => {
      const style = (selector, property) => getComputedStyle(root.querySelector(selector))[property];
      return {
        surface: style(".window-content", "backgroundColor"),
        text: style(".window-content", "color"),
        bar: style("h3", "backgroundColor"),
        onBar: style("h3", "color"),
        caption: style(".sc2-caption", "color"),
        primary: style(".sc2-primary-action", "backgroundColor"),
        onPrimary: style(".sc2-primary-action", "color"),
        stamp: style(".sc2-stamp", "color")
      };
    });
    expect(contrast(colours.text, colours.surface), "text: " + JSON.stringify(colours)).toBeGreaterThanOrEqual(7);
    expect(contrast(colours.onBar, colours.bar), "onBar: " + JSON.stringify(colours)).toBeGreaterThanOrEqual(7);
    expect(contrast(colours.caption, colours.surface), "caption: " + JSON.stringify(colours)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrast(colours.onPrimary, colours.primary),
      "onPrimary: " + JSON.stringify(colours)
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colours.stamp, colours.surface), "stamp: " + JSON.stringify(colours)).toBeGreaterThanOrEqual(4.5);
    // Verbs carry a single-colour glyph; names and numbers stay text.
    await expect(app.locator('[data-action="itemDelete"]')).toHaveAttribute("data-sc2-sheet", "glyph");
    await expect(app.locator('[data-action="itemDelete"] .sc2-button-icon')).toHaveClass(/fa-trash/);
    await expect(app.locator('[data-action="itemDelete"] .sc2-button-content')).toBeHidden();
    await expect(app.locator('[data-action="rollSkill"] .sc2-button-icon')).toHaveCount(0);
    // A tool with no common verb is a plain labelled button, without painted artwork.
    await expect(app.locator('[data-action="takeTotalDefense"] .sc2-button-icon')).toHaveCount(0);
    await app.screenshot({ path: `test-results/ui-lab-${theme}.png` });
  });

test("components fit a narrow window without horizontal overflow", async ({ page }) => {
  await openLab(page, 460);
  for (const app of await page.locator(".lab-app .window-content").all())
    expect(await app.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const theme of ["light", "dark"])
  test(`important captions are at least 13px and use normal capitalization in the ${theme} theme`, async ({ page }) => {
    await openLab(page);
    const captions = await page.locator(`.lab-app[data-theme="${theme}"] .sc2-caption`).evaluateAll(elements =>
      elements.map(element => ({
        size: parseFloat(getComputedStyle(element).fontSize),
        transform: getComputedStyle(element).textTransform
      }))
    );
    expect(captions.length).toBeGreaterThan(0);
    for (const caption of captions) {
      expect(caption.size).toBeGreaterThanOrEqual(13);
      expect(caption.transform).toBe("none");
    }
  });
