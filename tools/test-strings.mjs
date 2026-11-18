import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fill, hashOf, keyOf, loc, patternOf, slugOf } from "../module/i18n.mjs";
import { collectStrings } from "./extract-strings.mjs";

const withI18n = async (i18n, work) => {
  const previous = globalThis.game;
  globalThis.game = { i18n };
  try {
    return await work();
  } finally {
    globalThis.game = previous;
  }
};

test("without a translation, a tagged template gives exactly what the plain template gives", async () => {
  const name = "Ben",
    n = 3,
    nothing = null,
    missing = undefined,
    list = [1, 2];
  assert.equal(loc`Total Defense`, "Total Defense");
  assert.equal(loc`${name}: ${n} dice left`, `${name}: ${n} dice left`);
  assert.equal(loc`a ${nothing} b ${missing} c ${list} d ${{}}`, `a ${nothing} b ${missing} c ${list} d ${{}}`);
  assert.equal(loc`line one\nline two`, "line one\nline two");
  // Stand-ins used by the test suites: no i18n, an identity localize, or a `has` that says yes to everything.
  await withI18n(undefined, () => assert.equal(loc`Boost before outcome`, "Boost before outcome"));
  await withI18n({ localize: String }, () => assert.equal(loc`Boost before outcome`, "Boost before outcome"));
  await withI18n({ has: () => true, localize: key => key }, () => assert.equal(loc`Roll ${n}`, "Roll 3"));
});

test("a translation is used when the language has one, and may reorder the values", async () => {
  const strings = {};
  const i18n = { has: key => key in strings, localize: key => strings[key] ?? key };
  const say = (who, count) => loc`${who} spends ${count} action dice`;
  const key = "SPYCRAFT.Text." + keyOf("{0} spends {1} action dice");
  await withI18n(i18n, () => {
    assert.equal(say("Ben", 2), "Ben spends 2 action dice");
    strings[key] = "{1} dés d'action dépensés par {0}";
    assert.equal(say("Ben", 2), "2 dés d'action dépensés par Ben");
    strings[key] = "Dés dépensés";
    assert.equal(say("Ben", 2), "Dés dépensés");
  });
});

test("patterns, slugs and keys are stable", () => {
  const strings = Object.assign(["Roll ", ": ", " (natural ", ")"], { raw: [] });
  assert.equal(patternOf(strings), "Roll {0}: {1} (natural {2})");
  assert.equal(fill("Roll {0}: {1} (natural {2})", [1, 15, 12]), "Roll 1: 15 (natural 12)");
  assert.equal(fill("{1} then {0} and {5}", ["a", "b"]), "b then a and {5}");
  assert.equal(slugOf("<strong>Failed</strong> {0} saves: now {1}"), "FailedSavesNow");
  assert.equal(slugOf("— …"), "Text");
  assert.equal(hashOf("Total Defense"), hashOf("Total Defense"));
  assert.notEqual(hashOf("Total Defense"), hashOf("Total defense"));
  assert.match(keyOf("Focus, forte and synergy"), /^FocusForteAndSynergy_[0-9a-z]{7}$/);
});

test("lang/en.json holds exactly the strings written in the source", async () => {
  const lang = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
  const inSource = Object.fromEntries(collectStrings());
  assert.ok(Object.keys(inSource).length > 5000, "expected thousands of source strings");
  assert.deepEqual(lang.SPYCRAFT.Text, inSource, "run `npm run strings` to refresh lang/en.json");
  for (const [key, pattern] of Object.entries(inSource)) {
    assert.match(key, /^[A-Za-z0-9]+_[0-9a-z]{7}$/, key);
    // Placeholders are numbered from 0 without gaps, so a translator can see every value.
    const used = [...pattern.matchAll(/\{(\d+)\}/g)].map(m => Number(m[1]));
    assert.deepEqual(
      [...new Set(used)].sort((a, b) => a - b),
      [...Array(new Set(used).size).keys()],
      pattern
    );
  }
});

test("display names from the rules data are translated in place, and only when a translation exists", async () => {
  const { configStrings, configText, localizeConfig } = await import("../module/i18n-data.mjs");
  const cfg = {
    skills: { sneak: { key: "sneak", name: "Sneak", checks: [{ id: "hide", name: "Hide" }] } },
    proficiencies: {
      blunt: {
        get label() {
          return "Blunt";
        }
      },
      edged: { label: "Edged" }
    },
    featTrees: { chase: "Chase" },
    gearPicks: { V: "Vehicles" },
    bonusTargets: { "skills.sneak.misc": "Sneak" }
  };
  assert.deepEqual(configStrings(cfg), ["Sneak", "Hide", "Edged", "Chase", "Vehicles"]);
  assert.equal(configText(cfg).length, 6);
  assert.equal(localizeConfig(cfg, undefined), 0);
  const strings = { ["SPYCRAFT.Text." + keyOf("Sneak")]: "Discrétion", ["SPYCRAFT.Text." + keyOf("Chase")]: "Chase" };
  const i18n = { has: key => key in strings, localize: key => strings[key] };
  assert.equal(localizeConfig(cfg, i18n), 2);
  assert.equal(cfg.skills.sneak.name, "Discrétion");
  assert.equal(cfg.skills.sneak.key, "sneak");
  assert.equal(cfg.bonusTargets["skills.sneak.misc"], "Discrétion");
  assert.equal(cfg.skills.sneak.checks[0].name, "Hide");
  assert.equal(cfg.featTrees.chase, "Chase");
  // The real configuration lists its names, and every one is in the language file.
  const { SPYCRAFT } = await import("../module/config.mjs");
  const names = configStrings(SPYCRAFT);
  assert.ok(names.length > 150, `only ${names.length} data names`);
  const lang = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8")).SPYCRAFT.Text;
  for (const name of names) assert.equal(lang[keyOf(name)], name, name);
});
