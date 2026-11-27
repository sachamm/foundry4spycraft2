import test from "node:test";
import assert from "node:assert/strict";

// The gear browser under Historical (p.407): gear newer than the clock's year is listed as a gadget one Caliber up.
class StubApp {}
globalThis.foundry = {
  utils: {},
  applications: { api: { HandlebarsApplicationMixin: Base => Base, ApplicationV2: StubApp } }
};
globalThis.DOMParser = class {
  parseFromString(text) {
    return { body: { textContent: String(text).replace(/<[^>]*>/g, "") } };
  }
};
const index = [
  { uuid: "a", _id: "a", name: "Old pistol", system: { proficiency: "handgun", caliber: 2, year: "1950s" } },
  { uuid: "b", _id: "b", name: "New pistol", system: { proficiency: "handgun", caliber: 2, year: "1970s" } },
  { uuid: "c", _id: "c", name: "New cannon", system: { proficiency: "handgun", caliber: 5, year: "1980s" } }
];
globalThis.game = {
  packs: { get: () => ({ getIndex: async () => index }) },
  settings: { get: (_system, key) => (key === "clock" ? { epoch: 0 } : undefined) },
  time: { worldTime: 0, calendar: { timeToComponents: () => ({ year: 1962 }) } },
  i18n: { localize: key => key, format: key => key }
};
const { SPYCRAFT } = await import("../module/config.mjs");
globalThis.CONFIG = { SPYCRAFT };
const { SpycraftBrowser } = await import("../module/apps/browser.mjs");
const { setCampaignRulesSource } = await import("../module/rules/campaign-rules.mjs");

async function rows(effects, filters = {}) {
  setCampaignRulesSource(() => effects);
  try {
    const browser = new SpycraftBrowser({ itemType: "weapon" });
    Object.assign(browser.filters, filters);
    return (await browser._prepareContext({})).rows;
  } finally {
    setCampaignRulesSource(null);
  }
}

test("without Historical, gear newer than the clock's year is hidden", async () => {
  assert.deepEqual(
    (await rows({})).map(r => r.name),
    ["Old pistol"]
  );
});

test("under Historical, newer gear is listed as a gadget one Caliber up, and gear that would pass V stays hidden", async () => {
  const list = await rows({ historicalGear: true });
  assert.deepEqual(
    list.map(r => [r.name, r.gadget, r.future]),
    [
      ["New pistol", "Gadget, Caliber III", false],
      ["Old pistol", "", false]
    ]
  );
  assert.deepEqual(
    (await rows({ historicalGear: true }, { caliber: "3" })).map(r => r.name),
    ["New pistol"],
    "the Caliber filter reads the gadget's Caliber"
  );
  const all = await rows({ historicalGear: true }, { showFuture: true });
  assert.equal(all.find(r => r.name === "New cannon").future, true);
});
