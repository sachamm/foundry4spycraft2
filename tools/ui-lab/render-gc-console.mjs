/**
 * Renders the GC Console from its real templates and stylesheets into PNG snapshots, for UI reviews in a session that
 * has no Foundry server. The context comes from the console test world (tools/test-gc-apps.mjs writes it when
 * GC_CONTEXT_OUT is set); each scenario then sets the view, the mission state and a fight on top of it.
 *
 *   node tools/ui-lab/render-gc-console.mjs [outDir]
 *
 * Writes <scenario>-sidebar.png (the 300px sidebar at 1366×768) and <scenario>-popout.png (the 720px pop-out), plus
 * <scenario>.html and a measures.json with the fold positions a reviewer asks about. Foundry's own styles are not
 * loaded, so only a small stand-in for its sidebar look is applied.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createEnvironment, ROOT } from "../lib/hbs-harness.mjs";
import { systemCss } from "../lib/system-css.mjs";

const outDir = process.argv[2] ?? join(ROOT, "tools/ui-lab/out");
mkdirSync(outDir, { recursive: true });
const contextFile = join(outDir, "context.json");
execFileSync(process.execPath, ["--test", "--test-reporter=dot", join(ROOT, "tools/test-gc-apps.mjs")], {
  env: { ...process.env, GC_CONTEXT_OUT: contextFile },
  stdio: "ignore"
});
const base = JSON.parse(readFileSync(contextFile, "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

const VIEWS = { prep: "Prep", play: "Play", wrap: "Wrap-up" };
function withView(context, view, combatStarted = false) {
  context.view = view;
  context.views = context.views.map(entry => ({ ...entry, active: entry.id === view }));
  context.shown = { prep: view === "prep", play: view === "play", wrap: view === "wrap" };
  // Mirrors VIEW_SECTIONS in module/apps/gc/console.mjs.
  const sections = {
    prep: ["mission", "objectives", "antagonists", "complications", "organizations", "campaign", "reference"],
    play: ["combat", "dice", "objectives", "antagonists", "conflicts", "clock", "reference"],
    wrap: ["mission", "objectives", "antagonists", "campaign"]
  };
  for (const id of Object.keys(context.hiddenSections))
    context.hiddenSections[id] = !((sections[view] ?? []).includes(id) || (id === "combat" && combatStarted));
  return context;
}

const names = [
  ["Agent Morrow", 22, ""],
  ["Agent Vasquez", 19, ""],
  ["Guard (Rook)", 17, "wounded"],
  ["Guard (Rook)", 17, ""],
  ["Guard (Rook)", 14, ""],
  ["Colonel Dragan", 12, ""],
  ["Agent Okafor", 9, "readied action"],
  ["Driver", 5, ""]
];
function fight(context, { started = true } = {}) {
  context.combat = {
    round: 2,
    started,
    surprise: null,
    acting: started
      ? {
          defeated: false,
          id: "c3",
          name: "Guard (Rook)",
          npc: true,
          standard: true,
          defense: 14,
          health: "Wound points 0 of 12",
          conditions: "flat-footed",
          halfActions: "2 half actions left",
          weapons: [
            { id: "w1", name: "Service pistol" },
            { id: "w2", name: "Truncheon" }
          ],
          outcomes: ["TripOutcomes", "FeintOutcomes", "SettleAGrapple", "AnticipateResult", "StandOff"].map(key => ({
            step: key,
            label: `SPYCRAFT.Template.ActorAgentMain.${key}`
          }))
        }
      : null,
    combatants: names.map(([name, count, notes], index) => ({
      id: `c${index + 1}`,
      name,
      current: started && index === 2,
      defeated: false,
      count: `Count ${count}`,
      notes
    })),
    mobs: [{ key: "guard", label: "Mob attack: Guard (Rook) ×3" }],
    unrolled: started ? 0 : 3
  };
  context.sections.combat = { open: true, state: "open" };
  context.status.turn = started ? "Round 2: Guard (Rook)" : "Fight not begun";
  return context;
}

const scenarios = {
  "prep-first-session": () => {
    const c = withView(clone(base), "prep");
    c.mission.active = false;
    c.mission.ended = false;
    c.status.missionState = "not started";
    c.checklist.complete = false;
    return c;
  },
  "prep-planned": () => {
    const c = withView(clone(base), "prep");
    c.mission.active = false;
    c.status.missionState = "not started";
    c.checklist.complete = true;
    return c;
  },
  "play-no-fight": () => {
    const c = withView(clone(base), "play");
    c.checklist.complete = true;
    return c;
  },
  "play-fight-setup": () => {
    const c = fight(withView(clone(base), "play"), { started: false });
    c.checklist.complete = true;
    return c;
  },
  "play-fight": () => {
    const c = fight(withView(clone(base), "play", true), { started: true });
    c.checklist.complete = true;
    return c;
  },
  wrap: () => {
    const c = withView(clone(base), "wrap");
    c.mission.active = false;
    c.mission.ended = true;
    c.status.missionState = "ended";
    c.checklist.complete = true;
    return c;
  }
};

const environment = createEnvironment();
const template = context => environment.render("systems/spycraft2/templates/apps/gc-console.hbs", context);
const css = systemCss();
// A stand-in for Foundry's dark sidebar: its fonts, colours and default button look, nothing of the system's.
const foundryStandIn = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0a13; color: #e7d1b1; font: 14px/1.4 "Signika", system-ui, sans-serif; }
  #sidebar { width: 300px; min-height: 768px; background: rgba(11,10,19,.9); border-left: 1px solid #302831; }
  #popout { width: 720px; background: #1b1a22; padding: 8px; }
  button { font: inherit; color: inherit; background: rgba(255,255,255,.05); border: 1px solid #5d5a52; border-radius: 4px; min-height: 28px; padding: 2px 8px; margin: 2px; cursor: pointer; }
  button:disabled { opacity: .5; }
  details > summary { cursor: pointer; }
  h3 { font-size: 16px; margin: 6px 0; }
`;

const { chromium } = await import("playwright");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const measures = {};
for (const [name, make] of Object.entries(scenarios)) {
  const context = make();
  const body = template(context);
  for (const [frame, width, height] of [
    ["sidebar", 300, 768],
    ["popout", 720, 800]
  ]) {
    const wrapper =
      frame === "sidebar"
        ? `<div id="sidebar" class="sidebar-tab">${body}</div>`
        : `<div id="popout" class="application">${body}</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${foundryStandIn}\n${css}</style></head><body class="theme-dark">${wrapper}</body></html>`;
    if (frame === "sidebar") writeFileSync(join(outDir, `${name}.html`), html);
    const page = await browser.newPage({ viewport: { width: frame === "sidebar" ? 300 : 720, height } });
    await page.setContent(html);
    // The fold of a 1366×768 screen, less Foundry's sidebar tab bar, drawn so a reviewer sees what needs a scroll.
    if (frame === "sidebar")
      await page.evaluate(() =>
        document.body.insertAdjacentHTML(
          "beforeend",
          '<div style="position:absolute;left:0;right:0;top:728px;border-top:2px dashed #e33;pointer-events:none"></div>'
        )
      );
    measures[`${name}-${frame}`] = await page.evaluate(() => {
      const top = selector => {
        const node = document.querySelector(selector);
        return node ? Math.round(node.getBoundingClientRect().top) : null;
      };
      return {
        contentHeight: document.body.scrollHeight,
        statusStripHeight: Math.round(document.querySelector(".gc-now")?.getBoundingClientRect().height ?? 0),
        nextTurnTop: top('[data-action="nextTurn"]'),
        primaryButtons: [...document.querySelectorAll(".gc-primary")]
          .filter(node => node.offsetParent)
          .map(node => node.textContent.trim()),
        visibleButtons: [...document.querySelectorAll("button")].filter(node => node.offsetParent).length
      };
    });
    await page.screenshot({ path: join(outDir, `${name}-${frame}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
writeFileSync(join(outDir, "measures.json"), JSON.stringify(measures, null, 2));
console.log(`Wrote ${Object.keys(scenarios).length * 2} snapshots to ${outDir}`);
