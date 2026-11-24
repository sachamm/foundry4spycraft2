import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "agent-ux.spec.mjs",
    "sheet-scrolling.spec.mjs",
    "skill-dialog-scrolling.spec.mjs",
    "vehicle-sheets.spec.mjs",
    "npc-packages.spec.mjs",
    "ui-tooltips.spec.mjs",
    "ui-lab.spec.mjs",
    "ux-improvements.spec.mjs",
    "readable-dialogs.spec.mjs",
    "guided-play.spec.mjs",
    "accessibility-resolution.spec.mjs",
    "chat-theme.spec.mjs",
    "keep-place.spec.mjs",
    "attribute-abbreviations.spec.mjs"
  ],
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: { browserName: "chromium", headless: true, viewport: { width: 1100, height: 1000 } }
});
