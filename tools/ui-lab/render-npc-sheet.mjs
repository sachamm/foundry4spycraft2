/**
 * Renders the NPC sheet from its real template and stylesheets into PNG snapshots, for UI reviews in a session that
 * has no Foundry server. The contexts below are written by hand to match what the sheet prepares for a built
 * standard NPC and a built special one, in play, at the sheet's default 480px width.
 *
 *   node tools/ui-lab/render-npc-sheet.mjs [outDir]
 *
 * Writes npc-<scenario>.png and npc-<scenario>.html, and npc-measures.json with the sheet's height, where the
 * attack and damage-save buttons sit, and the styles of its section labels (section bars and the folded Items and
 * notes; the More actions disclosure inside Actions is a sub-section, not counted).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createEnvironment, ROOT } from "../lib/hbs-harness.mjs";
import { systemCss } from "../lib/system-css.mjs";

const outDir = process.argv[2] ?? join(ROOT, "tools/ui-lab/out");
mkdirSync(outDir, { recursive: true });

const abilities = ["str", "dex", "con", "int", "wis", "cha"].map((key, index) => ({
  key,
  label: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"][index],
  abbr: key.toUpperCase(),
  value: [12, 14, 12, 10, 10, 8][index],
  mod: [1, 2, 1, 0, 0, -1][index],
  tip: ""
}));
const saves = [
  { key: "fort", label: "Fortitude", base: 2, total: 3 },
  { key: "ref", label: "Reflex", base: 2, total: 4 },
  { key: "will", label: "Will", base: 1, total: 1 }
];
const weapon = (id, name, attack, damage, shots) => ({
  item: { id, name, system: { damage } },
  attack: { total: attack },
  shots,
  facts: "Range 30 ft · Caliber II"
});
const base = special => ({
  appId: "npc-lab",
  editable: true,
  editMode: false,
  isGM: true,
  actor: { name: special ? "Colonel Dragan" : "Guard (Rook)", img: "", shakenSourceEntries: [] },
  system: {
    threatLevel: 6,
    effectiveThreatLevel: 6,
    npcType: special ? "special" : "standard",
    defense: { total: 15 },
    bab: 4,
    initiative: { total: 3 },
    damageSave: 5,
    vitality: { value: 32, max: 40 },
    wounds: { value: 12, max: 12 },
    npcProfile: { enabled: true },
    npcBuild: { xp: special ? 120 : 30 },
    qualityEffects: { notes: [] },
    conditionContext: {},
    cheapShotActive: []
  },
  npcTypes: { standard: "Standard", special: "Special", villain: "Villain" },
  healthChip: special ? "Vitality 32/40 · Wounds 12/12" : "Damage save +5",
  conditionStamps: [],
  abilities,
  saves,
  npc: {
    special,
    result: { stats: { resilience: 3, competence: 4 } },
    skills: [
      { key: "notice", resolved: { bonus: 6 } },
      { key: "athletics", resolved: { bonus: 4 } }
    ],
    skillOptions: { notice: "Notice", athletics: "Athletics" }
  },
  weapons: [weapon("w1", "Pistol", 6, "1d10", { loaded: 7, capacity: 8 }), weapon("w2", "Knife", 5, "1d4")],
  playLabels: { reload: "Reload", stress: "Stress", subdual: "Subdual", rest: "Rest", dying: "Dying" },
  gcPlay: {
    special,
    baseDisposition: " (hostile",
    dispositions: [],
    damage: { bonus: 5, track: { accumulated: 0, failures: 0 }, nextDC: 10, stateLabel: "Unhurt" }
  },
  nonLethal: { stress: 0, subdual: 0 },
  hazards: {},
  otherItems: [
    { id: "i1", name: "Radio", type: "gear" },
    { id: "i2", name: "Body armour", type: "armor" }
  ],
  enrichedBiography: "<p>A guard on the night shift.</p>"
});
const scenarios = { standard: () => base(false), special: () => base(true) };

const environment = createEnvironment();
const css = systemCss();
// A stand-in for Foundry's window: its fonts, colours and default button look, nothing of the system's.
const foundryStandIn = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0a13; font: 14px/1.4 "Signika", system-ui, sans-serif; }
  /* The whole sheet at its natural length, so the snapshot shows how far a GC scrolls. */
  .application { width: 480px; display: flex; flex-direction: column; height: auto !important; }
  .application .window-content, .application .window-content > .spycraft2-sheet { overflow: visible !important; height: auto !important; flex: none !important; }
  .window-header { height: 30px; background: #1b1a22; color: #e7d1b1; padding: 4px 8px; }
  .window-content { padding: 8px; }
  button { font: inherit; min-height: 28px; }
`;

const { chromium } = await import("playwright");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const measures = {};
for (const [name, make] of Object.entries(scenarios)) {
  const body = environment.render("systems/spycraft2/templates/actor/npc-sheet.hbs", make());
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${foundryStandIn}\n${css}</style></head><body class="theme-dark"><form class="application spycraft2 sheet actor npc play-mode"><header class="window-header">NPC</header><section class="window-content">${body}</section></form></body></html>`;
  writeFileSync(join(outDir, `npc-${name}.html`), html);
  const page = await browser.newPage({ viewport: { width: 480, height: 720 } });
  await page.setContent(html);
  measures[name] = await page.evaluate(() => {
    const top = selector => {
      const node = [...document.querySelectorAll(selector)].find(el => el.checkVisibility());
      return node ? Math.round(node.getBoundingClientRect().top) : null;
    };
    const style = node => {
      const s = getComputedStyle(node);
      return `${s.fontSize} ${s.fontWeight} ${s.textTransform} ${s.letterSpacing}`;
    };
    return {
      height: document.documentElement.scrollHeight,
      firstAttackTop: top('[data-action="rollAttack"]'),
      damageSaveTop: top('[data-action="npcDamageSave"]'),
      sectionLabelStyles: [
        ...new Set(
          [...document.querySelectorAll(".spycraft2-sheet h3, .spycraft2-sheet .npc-notes > summary")]
            .filter(el => el.checkVisibility())
            .map(style)
        )
      ]
    };
  });
  await page.screenshot({ path: join(outDir, `npc-${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
writeFileSync(join(outDir, "npc-measures.json"), JSON.stringify(measures, null, 2));
console.log(JSON.stringify(measures, null, 2));
