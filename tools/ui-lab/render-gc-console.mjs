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
import {
  VIEWS,
  VIEW_SECTIONS,
  consoleSections,
  firstSessionChecklist,
  primaryAction
} from "../../module/apps/gc/console-view.mjs";

const outDir = process.argv[2] ?? join(ROOT, "tools/ui-lab/out");
mkdirSync(outDir, { recursive: true });
const contextFile = join(outDir, "context.json");
execFileSync(process.execPath, ["--test", "--test-reporter=dot", join(ROOT, "tools/test-gc-apps.mjs")], {
  env: { ...process.env, GC_CONTEXT_OUT: contextFile },
  stdio: "ignore"
});
const base = JSON.parse(readFileSync(contextFile, "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

/**
 * Set a scenario's state and work out everything that follows from it with the console's own rules
 * (module/apps/gc/console-view.mjs): the view's sections, which start open, the checklist and the one filled button.
 */
function withState(context, { view, active, ended, combat = null, firstSession = null }) {
  context.view = view;
  context.views = context.views.map(entry => ({ ...entry, active: entry.id === view }));
  context.shown = Object.fromEntries(VIEWS.map(id => [id, id === view]));
  context.mission.active = active;
  context.mission.ended = ended;
  context.status.missionState = active ? "active" : ended ? "ended" : "not started";
  context.xp.label = active || ended ? "Base XP earned so far" : "Planned base XP";
  context.xp.started = active || ended;
  for (const id of Object.keys(context.hiddenSections))
    context.hiddenSections[id] = !(VIEW_SECTIONS[view].includes(id) || (id === "combat" && !!combat?.started));
  context.sections = consoleSections({ missionActive: active, combat: !!combat, conflictsRunning: false });
  if (firstSession) {
    context.checklist = firstSessionChecklist({ mission: context.mission, ...firstSession });
    if (!firstSession.diceCurrent) {
      context.session = { begun: false, at: "", note: "" };
      context.status.dice = "none until Begin session";
      context.status.session = "not begun";
      context.dice.current = false;
    }
  } else context.checklist.complete = true;
  context.primary = primaryAction({
    view,
    checklistShown: view === "prep" && !context.checklist.complete,
    missionActive: active,
    missionEnded: ended,
    diceCurrent: !!context.dice.current,
    combat
  });
  return context;
}

const names = [
  ["Agent Morrow", 22, ""],
  ["Agent Vasquez", 19, ""],
  ["Guard (Rook) #1", 17, "wounded", "warn"],
  ["Guard (Rook) #2", 17, ""],
  ["Guard (Rook) #3", 14, ""],
  ["Colonel Dragan", 12, ""],
  ["Agent Okafor", 9, "readied", "muted"],
  ["Driver", 5, ""]
];
function fight(context, { started = true, applyTarget = "" } = {}) {
  context.combat = {
    round: 2,
    started,
    surprise: null,
    acting: started
      ? {
          defeated: false,
          id: "c3",
          name: "Guard (Rook) #1",
          npc: true,
          standard: true,
          defense: 14,
          health: "Wound points 0 of 12",
          conditions: "flat-footed",
          halfActions: "2 half actions left",
          next: "Guard (Rook) #2 · count 17",
          applyTarget,
          weapons: [
            {
              id: "w1",
              name: "Service pistol",
              facts: "+4 · 2d6",
              key: "Alt+1",
              tip: "Opens the attack dialog (Alt+1)"
            },
            { id: "w2", name: "Truncheon", facts: "+3 · 1d6", key: "Alt+2", tip: "Opens the attack dialog (Alt+2)" }
          ],
          outcomes: ["TripOutcomes", "FeintOutcomes", "SettleAGrapple", "AnticipateResult", "StandOff"].map(key => ({
            step: key,
            label: `SPYCRAFT.Template.ActorAgentMain.${key}`
          }))
        }
      : null,
    combatants: names.map(([name, count, notes, tone], index) => ({
      id: `c${index + 1}`,
      name,
      current: started && index === 2,
      defeated: false,
      count: `Count ${count}`,
      countValue: started || index < 5 ? String(count) : "—",
      notes,
      tags: notes ? [{ text: notes, tone }] : []
    })),
    mobs: started ? [{ key: "guard", label: "Mob attack: Guard (Rook) ×3", short: "Mob: Guard (Rook) ×3" }] : [],
    initiativeTip: "Rolls for Guard (Rook) ×3, Colonel Dragan, Driver. Rolling from their own sheets: Agent Okafor.",
    unrolled: started ? 0 : 3,
    unrolledNames: started ? "" : "Colonel Dragan, Agent Okafor, Driver",
    scene: "Embassy",
    elsewhere: false
  };
  return context;
}

const scenarios = {
  "prep-first-session": () =>
    withState(clone(base), {
      view: "prep",
      active: false,
      ended: false,
      // A world on its first evening: the mission recorded and its NPCs placed, nothing started yet.
      firstSession: { diceCurrent: false, npcActors: 3, combatSeen: false }
    }),
  "prep-planned": () => withState(clone(base), { view: "prep", active: false, ended: false }),
  "play-no-fight": () => withState(clone(base), { view: "play", active: true, ended: false }),
  "play-fight-setup": () =>
    fight(
      withState(clone(base), { view: "play", active: true, ended: false, combat: { started: false, unrolled: 3 } }),
      { started: false }
    ),
  "play-fight": () =>
    fight(
      withState(clone(base), { view: "play", active: true, ended: false, combat: { started: true, unrolled: 0 } }),
      { started: true }
    ),
  // Damage rolled on the acting NPC's card and not applied yet: the card button leads the row.
  "play-fight-damage": () =>
    fight(
      withState(clone(base), { view: "play", active: true, ended: false, combat: { started: true, unrolled: 0 } }),
      { started: true, applyTarget: "Agent Morrow" }
    ),
  "wrap-active": () => withState(clone(base), { view: "wrap", active: true, ended: false }),
  wrap: () => withState(clone(base), { view: "wrap", active: false, ended: true })
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
  for (const [frame, , height] of [
    ["sidebar", 300, 768],
    ["popout", 720, 800]
  ]) {
    const wrapper =
      frame === "sidebar"
        ? `<div id="sidebar"><section class="spycraft2 gc-console sidebar-tab active">${body}</section></div>`
        : `<div id="popout" class="spycraft2 gc-console sidebar-tab sidebar-popout application">${body}</div>`;
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
          .filter(node => node.checkVisibility())
          .map(node => node.textContent.trim()),
        visibleButtons: [...document.querySelectorAll("button")].filter(node => node.checkVisibility()).length
      };
    });
    await page.screenshot({ path: join(outDir, `${name}-${frame}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
writeFileSync(join(outDir, "measures.json"), JSON.stringify(measures, null, 2));
console.log(`Wrote ${Object.keys(scenarios).length * 2} snapshots to ${outDir}`);
