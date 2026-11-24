import { readSetting } from "../../settings.mjs";
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { installToolSearch } from "../tool-search.mjs";
import { installResolutionGuide } from "../resolution-guide.mjs";
/** The GC Console: sidebar tools for the mission record, scene and action dice, combat, Dramatic Conflicts and reference tables. */
import { gcDiceStatus, manageGCDice } from "../../services/gc-dice.mjs";
import { threatLevel, threatBonusActionDice, missionStanding } from "../../rules/gc/mission.mjs";
import { campaignQuality } from "../../rules/gc/campaign.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import {
  getMission,
  teamActors,
  teamLevels,
  missionXP,
  getSceneState,
  qualitiesInForce,
  currentCampaignEffects,
  fixThreatLevel,
  updateMission
} from "./state.mjs";
import * as mission from "./mission.mjs";
import * as spend from "./spend.mjs";
import * as combat from "./combat.mjs";
import * as conflicts from "./conflicts.mjs";
import * as tables from "./tables.mjs";
import { addNpcToScene } from "./add-npc.mjs";
import * as turn from "./console-turn.mjs";
import { npcDamageSaveWithUndo } from "./npc-play.mjs";
import { pressNewestCard } from "../keybindings.mjs";
import {
  advanceClock,
  advanceClockDialog,
  clockLabel,
  clockSteps,
  openGameClock,
  setClockDateDialog
} from "../game-clock.mjs";
import { loc } from "../../i18n.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;
const ROMAN = ["I", "II", "III", "IV", "V"];
const signed = value => (value >= 0 ? `+${value}` : `${value}`);
/** A console action runs once at a time: a second press while it is still working, or its dialog is open, is dropped. */
const guard = work => {
  let busy = false;
  return async function (event, target) {
    if (busy) return;
    busy = true;
    try {
      await work.call(this, event, target);
    } catch (error) {
      ui.notifications.warn(error.message);
    } finally {
      busy = false;
    }
    this.render();
  };
};

export class GCConsole extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = "gc";

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "gc-console"],
    position: { width: 720, height: 800 },
    window: {
      get title() {
        return loc`GC Console`;
      },
      resizable: true
    },
    actions: {
      editMission: guard(() => mission.editMission()),
      startMission: guard(() => mission.startMission()),
      endMission: guard(() => mission.endMission()),
      resumeMission: guard(() => mission.resumeMission()),
      clearMission: guard(async () => {
        if (
          await systemDialog.confirm({
            window: { title: loc`Clear the mission record` },
            content: `<p>${loc`Remove every objective, complication and antagonist from the mission record?`}</p>`
          })
        )
          await mission.endMission({ clear: true });
      }),
      recalculateTL: guard(() => fixThreatLevel()),
      addObjective: guard(() => mission.addObjective()),
      addAntagonist: guard(() => mission.addAntagonist()),
      addNpcToScene: guard(() => addNpcToScene()),
      // The turn controls also live here, so running NPC turns does not mean flipping to the Combat tab.
      previousTurn: guard(() => game.combat?.previousTurn()),
      nextTurn: guard(() => (game.combat?.started ? game.combat.nextTurn() : game.combat?.startCombat())),
      addComplication: guard(() => mission.addComplication()),
      entry: guard((event, target) =>
        mission.changeEntry(target.dataset.list, target.dataset.key, target.dataset.change)
      ),
      recordInfraction: guard(() => mission.recordInfraction()),
      sessionDice: guard(() => mission.applySessionDiceAdjustments()),
      missionReport: guard((event, target) => mission.missionReport({ planned: target.dataset.planned === "true" })),
      awardStanding: guard(() => mission.awardStanding()),
      seasonQualities: guard(() => mission.editSeasonQualities()),
      caliberIncrease: guard(() => spend.recordCaliberIncrease(getMission().caliber + 1)),
      sceneAdvance: guard(() => updateMission(m => ({ scenesPlayed: (m.scenesPlayed ?? 0) + 1 }))),
      gcDice: guard(() => {
        const m = getMission();
        return manageGCDice({ playersPresent: teamActors(m).length, caliber: m.caliber });
      }),
      beginSession: guard(() => mission.beginSession()),
      nextScene: guard(() => mission.nextScene()),
      spendDice: guard(() => spend.spendGCDice()),
      dramaticOn: guard(() => spend.setDramaticScene(true)),
      dramaticOff: guard(() => spend.setDramaticScene(false)),
      doubleInitiative: guard(() => spend.doubleOpponentInitiative()),
      fluidEvent: guard(() => combat.fluidEventDialog()),
      groupInitiative: guard((event, target) =>
        combat.rollGroupInitiative(game.combat, { single: target.dataset.single === "true" })
      ),
      surprise: guard(() => combat.surpriseRoundDialog()),
      combatReference: guard(() => combat.combatReferenceDialog()),
      openCombatant: guard((event, target) => turn.openCombatant(game.combat, target.dataset.id)),
      actingAttack: guard((event, target) =>
        turn.attackWith(game.combat?.combatant?.actor, target.dataset.id, event, game.combat?.combatant)
      ),
      actingSpend: guard((event, target) => combat.spendTurnAction(game.combat?.combatant, target.dataset.kind)),
      actingDamageSave: guard(() => npcDamageSaveWithUndo(game.combat?.combatant?.actor)),
      actingDelay: guard(() => combat.delayCombatant(game.combat?.combatant)),
      actingReady: guard(() => combat.readyCombatant(game.combat?.combatant)),
      cardNextStep: guard(() => {
        if (!pressNewestCard("button.sc2-primary-action[data-roll-control]"))
          ui.notifications.info(loc`No chat card is waiting for a next step.`);
      }),
      mobAttack: guard((event, target) => turn.mobAttackDialog(game.combat, target.dataset.key)),
      consoleView: guard((event, target) => rememberView(target.dataset.view, viewState())),
      startConflict: guard(() => conflicts.startConflictDialog()),
      advanceConflict: guard((event, target) => conflicts.advanceConflict(target.dataset.id)),
      manageConflict: guard((event, target) => conflicts.manageConflict(target.dataset.id)),
      clockStep: guard((event, target) => advanceClock(Number(target.dataset.seconds))),
      clockAdvance: guard(() => advanceClockDialog()),
      clockDate: guard(() => setClockDateDialog()),
      clockOpen: guard(() => openGameClock()),
      securityDevice: guard(() => tables.securityDeviceDialog()),
      hazards: guard(() => tables.hazardLookupDialog()),
      events: guard(() => tables.eventReferenceDialog()),
      possessions: guard(() => tables.randomPossessionsDialog())
    }
  };

  static PARTS = {
    main: {
      template: "systems/spycraft2/templates/apps/gc-console.hbs",
      templates: ["systems/spycraft2/templates/apps/gc-console-combat.hbs"],
      scrollable: [""]
    }
  };

  _canRender(options) {
    if (!game.user.isGM) return false;
    return super._canRender(options);
  }

  async _prepareContext(options) {
    return { ...(await super._prepareContext(options)), ...consoleContext() };
  }

  /** What the GC was looking at, kept across a redraw: the scroll position, the focused control and open sub-lists. */
  _preRender(context, options) {
    this._kept = captureConsoleState(this.element);
    return super._preRender?.(context, options);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const details of this.element.querySelectorAll("details.gc-section[data-section]")) {
      const key = details.dataset.section,
        initial = context.sections?.[key]?.open;
      // Rendering an open section fires a toggle too; only a change from what was drawn is the GC's choice.
      details.addEventListener("toggle", () => {
        if (details.dataset.toolSearchActive === "true" || details.dataset.searchOpen === String(details.open)) return;
        delete details.dataset.searchOpen;
        if (details.open === initial && !storedSections()[key]) return;
        rememberSection(key, details.dataset.state, details.open);
      });
    }
    installToolSearch(this.element, "details.gc-section", loc`Find a GC tool`, (this._search ??= {}));
    installResolutionGuide(this.element.querySelector(".gc-console-body"), "gc");
    restoreConsoleState(this.element, this._kept);
    this._kept = null;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (!this.isPopout) game.spycraft2.gc.console = this;
  }
}

/** How a control is found again after a redraw: its action and the data that tells it from its neighbours. */
const SAME = ["action", "list", "key", "change", "id", "view", "kind", "seconds", "single", "planned"];
const twins = (root, wanted) =>
  [...(root?.querySelectorAll?.(`[data-action="${wanted.action}"]`) ?? [])].filter(element =>
    SAME.every(name => element.dataset[name] === wanted[name])
  );
const controlKey = (element, root = null) => {
  if (!element?.dataset) return null;
  if (element.matches?.(".sc2-tool-search input")) return { search: true };
  // A section heading has no action of its own: it is found again by its section.
  if (element.matches?.("summary")) {
    const section = element.closest?.("details[data-section]")?.dataset.section;
    return section ? { section } : null;
  }
  const { action, list, key, change, id, view, kind, seconds, single, planned } = element.dataset;
  if (!action) return null;
  const wanted = { action, list, key, change, id, view, kind, seconds, single, planned };
  // The same action can stand in two places (the acting block and the list): the place is kept too.
  return { ...wanted, nth: Math.max(0, twins(root, wanted).indexOf(element)) };
};

/** Read the parts of the console's state that a redraw would otherwise drop. */
export function captureConsoleState(root) {
  if (!root?.querySelector) return null;
  const scroller = root.matches?.(".gc-console-body") ? root : root.querySelector(".gc-console-body");
  const scrolled = [root, scroller, scroller?.parentElement].find(element => element?.scrollTop > 0);
  // Only focus that the keyboard put there is given back: a button clicked with the mouse lets go of it, so the
  // shortcuts keep working.
  const focused = root.contains?.(document.activeElement) ? document.activeElement : null,
    active = focused?.matches?.(":focus-visible") ? focused : null;
  return {
    scrollTop: scrolled?.scrollTop ?? 0,
    focus: controlKey(active, root),
    selection: active?.matches?.("input") ? [active.selectionStart, active.selectionEnd] : null,
    more: [...root.querySelectorAll("details.gc-more")].map(details => details.open)
  };
}

/** Put the kept state back onto a freshly drawn console. */
export function restoreConsoleState(root, kept) {
  if (!root?.querySelector || !kept) return;
  [...root.querySelectorAll("details.gc-more")].forEach((details, index) => {
    if (kept.more[index]) details.open = true;
  });
  if (kept.focus) {
    const same = kept.focus.action ? twins(root, kept.focus) : [];
    const target = kept.focus.search
      ? root.querySelector(".sc2-tool-search input")
      : kept.focus.section
        ? root.querySelector(`details[data-section="${kept.focus.section}"] > summary`)
        : (same[kept.focus.nth ?? 0] ?? same[0]);
    target?.focus?.({ preventScroll: true });
    if (kept.selection && target?.setSelectionRange)
      try {
        target.setSelectionRange(...kept.selection);
      } catch {
        /* a field that holds no text selection */
      }
  }
  const scroller = root.matches?.(".gc-console-body") ? root : root.querySelector(".gc-console-body");
  for (const element of [root, scroller, scroller?.parentElement])
    if (element && element.scrollHeight > element.clientHeight) element.scrollTop = kept.scrollTop;
}

const VIEW_SETTING = "gcConsoleView";
const VIEWS = ["prep", "play", "wrap"];
/** The state the view choice belongs to: a choice made while planning does not hold once a fight is on. */
const viewState = () => {
  const m = getMission();
  return game.combat ? "combat" : m.active ? "active" : m.ended ? "ended" : "planning";
};
/** What the choice was made in: this fight, or outside a fight. A choice made in one fight does not hold in the next. */
const viewKey = () => game.combat?.id ?? null;
/** The view in use: the GC's choice for the current state, or the one that state calls for. */
export function consoleView(state, stored = null, key = null) {
  if (stored && stored.state === state && (stored.key ?? null) === key && VIEWS.includes(stored.view))
    return stored.view;
  return state === "planning" ? "prep" : state === "ended" ? "wrap" : "play";
}
function rememberView(view, state) {
  if (!VIEWS.includes(view)) return null;
  return game.settings.set("spycraft2", VIEW_SETTING, { view, state, key: viewKey() });
}
/** Which sections each view shows. A search looks through all of them. */
const VIEW_SECTIONS = {
  prep: ["mission", "objectives", "antagonists", "complications", "campaign", "reference"],
  play: ["combat", "dice", "objectives", "antagonists", "conflicts", "clock", "reference"],
  wrap: ["mission", "objectives", "antagonists", "campaign"]
};

/**
 * The first-session steps, ticked from what the world already holds. Shown in the Prep view until all are done.
 */
export function firstSessionChecklist({ mission, diceCurrent, npcActors, combatSeen }) {
  const steps = [
    {
      id: "mission",
      label: loc`Record the mission: name, team and Caliber`,
      done: !!mission.name,
      action: "editMission"
    },
    {
      id: "objectives",
      label: loc`Add at least one objective`,
      done: (mission.objectives ?? []).length > 0,
      action: "addObjective"
    },
    {
      id: "npcs",
      label: loc`Prepare the opposition: make an NPC and place it`,
      done: npcActors > 0,
      action: "addNpcToScene"
    },
    {
      id: "start",
      label: loc`Start mission (fixes the Threat Level)`,
      done: !!mission.active || !!mission.ended,
      action: "startMission"
    },
    {
      id: "session",
      label: loc`Begin session (GC dice and starting action dice)`,
      done: !!diceCurrent,
      action: "beginSession"
    },
    { id: "combat", label: loc`First combat: add tokens to the tracker, roll Initiative`, done: !!combatSeen }
  ];
  const next = steps.find(step => !step.done);
  return {
    steps: steps.map(step => ({ ...step, next: step === next })),
    done: steps.filter(step => step.done).length,
    total: steps.length,
    complete: !next
  };
}

const SECTION_SETTING = "gcConsoleSections";
function storedSections() {
  return readSetting(SECTION_SETTING, {}) ?? {};
}
function rememberSection(section, state, open) {
  const stored = { ...storedSections(), [section]: { state, open } };
  return game.settings.set("spycraft2", SECTION_SETTING, stored);
}

/**
 * Which console sections start open. Each section opens by default when the game state makes it the one in use
 * (the mission before it starts, combat while one runs, and so on). A GC's own choice is kept until that state changes.
 */
export function consoleSections({ missionActive, combat, conflictsRunning }, stored = {}) {
  const states = {
    clock: "always",
    mission: missionActive ? "active" : "planning",
    objectives: missionActive ? "active" : "planning",
    antagonists: missionActive ? "active" : "planning",
    complications: "always",
    dice: missionActive ? "active" : "planning",
    combat: combat ? "running" : "idle",
    conflicts: conflictsRunning ? "running" : "idle",
    campaign: "always",
    reference: "always"
  };
  const defaults = {
    clock: false,
    mission: !missionActive,
    objectives: missionActive,
    antagonists: false,
    complications: false,
    dice: missionActive,
    combat: !!combat,
    conflicts: conflictsRunning,
    campaign: false,
    reference: false
  };
  return Object.fromEntries(
    Object.keys(states).map(key => {
      const choice = stored[key];
      const open = choice && choice.state === states[key] ? !!choice.open : defaults[key];
      return [key, { open, state: states[key] }];
    })
  );
}

/** Everything the console shows, as plain data (also used by tests). */
export function consoleContext() {
  const m = getMission(),
    team = teamActors(m),
    levels = teamLevels(m),
    live = threatLevel(m, levels);
  const tl = m.active && m.threatLevel ? m.threatLevel : live.value;
  const earned = missionXP(),
    planned = missionXP({ planned: true }),
    standing = missionStanding(m),
    dice = gcDiceStatus(),
    scene = getSceneState();
  const qualities = qualitiesInForce(),
    { effects, conflicts: effectConflicts } = currentCampaignEffects();
  const named = (list, find) =>
    (list ?? []).map(entry => ({
      ...entry,
      key: entry.key ?? entry.id,
      name: entry.name ?? find?.(entry.id) ?? entry.id
    }));
  const T = GC_DATA.tables,
    combatNow = game.combat ?? null,
    conflictList = conflicts.conflictRows();
  const state = combatNow ? "combat" : m.active ? "active" : m.ended ? "ended" : "planning",
    view = consoleView(state, readSetting(VIEW_SETTING, null), viewKey());
  const acting = turn.actingBlock(combatNow),
    // Only receipts for the agents on the team now: one who left does not stand in for one who joined.
    paid = team.filter(actor => m.standingPaid?.[actor.id]).length;
  const checklist = firstSessionChecklist({
    mission: m,
    diceCurrent: dice.current,
    npcActors: [...(game.actors ?? [])].filter(actor => actor.type === "npc").length,
    combatSeen: !!combatNow || (m.scenesPlayed ?? 0) > 0
  });
  // Done once is done for good: a new mission or session does not bring the list back.
  if (readSetting("gcFirstSessionDone", false)) checklist.complete = true;
  else if (checklist.complete && game.user?.isGM)
    Promise.resolve(game.settings.set("spycraft2", "gcFirstSessionDone", true)).catch(() => {});
  return {
    view,
    views: [
      { id: "prep", label: loc`Prep`, hint: loc`Mission record, opposition and campaign` },
      { id: "play", label: loc`Play`, hint: loc`Combat, scene and GC action dice` },
      { id: "wrap", label: loc`Wrap-up`, hint: loc`XP, standing and exposure` }
    ].map(entry => ({ ...entry, active: entry.id === view })),
    shown: Object.fromEntries(Object.keys(VIEW_SECTIONS).map(id => [id, id === view])),
    hiddenSections: Object.fromEntries(
      [...new Set(Object.values(VIEW_SECTIONS).flat())].map(id => [id, !VIEW_SECTIONS[view].includes(id)])
    ),
    checklist,
    status: {
      mission: m.name || loc`No mission recorded`,
      missionState: m.active ? loc`active` : m.ended ? loc`ended` : loc`not started`,
      scene: `${m.scenesPlayed ? loc`Scene ${m.scenesPlayed}, ` : ""}${scene.dramatic ? loc`dramatic` : loc`standard`}`,
      turn: combatNow
        ? combatNow.started
          ? loc`Round ${combatNow.round}: ${combatNow.combatant?.name ?? "—"}`
          : loc`Fight not begun`
        : loc`No combat`,
      // Awards can take the pool past its starting number; "left of" would then read oddly.
      dice: !dice.current
        ? loc`not set up`
        : dice.value > team.length + 2 * m.caliber
          ? loc`${dice.value} left`
          : loc`${dice.value} left of ${team.length + 2 * m.caliber}`
    },
    wrap: {
      standing:
        team.length && paid >= team.length
          ? loc`Standing: everyone paid`
          : loc`Standing: ${Math.min(paid, team.length)} of ${team.length} paid`,
      infractions: (m.infractions ?? []).length
    },
    isGM: game.user.isGM,
    sections: consoleSections(
      {
        missionActive: !!m.active,
        combat: !!combatNow,
        conflictsRunning: conflictList.some(row => !row.winner)
      },
      storedSections()
    ),
    clock: {
      title: loc`Game clock`,
      now: clockLabel(),
      steps: clockSteps(),
      advance: loc`Move the clock…`,
      setDate: loc`Set the date…`,
      open: loc`Timers`
    },
    mission: {
      ...m,
      caliberLabel: ROMAN[m.caliber - 1] ?? m.caliber,
      threatLevel: tl,
      threatNote: m.threatOverride
        ? "fixed"
        : `${live.base}${live.adjust ? ` ${signed(live.adjust)}` : ""}${m.active && m.threatLevel && m.threatLevel !== live.value ? loc`; the team would now be ${live.value}` : ""}`,
      bonusDice: threatBonusActionDice(tl, levels),
      team: team.map(actor => ({
        name: actor.name,
        level: actor.system.level,
        reputation: actor.system.reputation,
        netWorth: actor.system.netWorth
      })),
      standing,
      canRaiseCaliber: m.caliber < 5,
      objectives: m.objectives.map(objective => ({ ...objective, xp: objective.grade * 25 })),
      antagonists: m.antagonists,
      qualities: named(m.qualities, id => campaignQuality(id)?.name).map(entry => ({
        ...entry,
        xp: entry.scripted === false ? 0 : (campaignQuality(entry.id)?.xp ?? 0),
        added: entry.scripted === false
      })),
      security: named(m.security),
      gearRestrictions: named(m.gearRestrictions, id => T.gearRestrictions.find(row => row.id === id)?.name),
      exposure: named(m.exposure, id => T.exposure.find(row => row.id === id)?.objective),
      bundle: named(m.bundle),
      otherComplications: named(m.otherComplications),
      infractions: (m.infractions ?? []).map(entry => ({
        ...entry,
        actorName: game.actors.get(entry.actor)?.name ?? entry.actor
      }))
    },
    xp: {
      earned: earned.total,
      planned: planned.total,
      warnings: planned.warnings,
      perScene: m.scenesPlayed ? Math.round(earned.total / m.scenesPlayed) : null
    },
    dice: { ...dice, expected: team.length + 2 * m.caliber },
    scene,
    season: qualities
      .filter(quality => quality.source === "season")
      .map(quality => ({ name: quality.name, xp: signed(quality.xp), summary: quality.summary })),
    effects: Object.entries(effects).map(([key, value]) => ({ key, value: JSON.stringify(value) })),
    effectConflicts,
    combat: combatNow
      ? {
          round: combatNow.round,
          started: combatNow.started,
          surprise: combatNow.flags?.spycraft2?.surprise ?? null,
          acting,
          combatants: turn.combatRows(combatNow),
          mobs: turn.mobGroups(combatNow).map(group => ({
            key: group.key,
            label: loc`Mob attack: ${group.name} ×${group.count}`
          })),
          unrolled: combatNow.turns.filter(c => !Number.isFinite(c.initiative)).length
        }
      : null,
    conflicts: conflictList,
    counts: {
      objectives: `${m.objectives.filter(objective => objective.complete).length}/${m.objectives.length}`,
      antagonists: m.antagonists.length,
      conflicts: conflictList.filter(row => !row.winner).length
    }
  };
}

// The Combat section shows the acting combatant, so the console follows the fight instead of waiting for a press.
let refreshTimer = null;
function refreshSoon() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    // The sidebar console and a popped-out copy both follow the fight.
    for (const instance of new Set([game.spycraft2?.gc?.console, ui.gc, ui.gc?.popout]))
      if (instance?.rendered) instance.render();
  }, 120);
}
const inFight = actor =>
  !!actor && [...(game.combat?.combatants ?? [])].some(combatant => combatant.actor?.uuid === actor.uuid);

/** Register before Foundry constructs its sidebar applications. */
export function registerGCConsoleTab() {
  for (const hook of [
    "createCombat",
    "deleteCombat",
    "updateCombat",
    "createCombatant",
    "deleteCombatant",
    "updateCombatant"
  ])
    Hooks.on(hook, refreshSoon);
  Hooks.on("updateActor", actor => {
    if (inFight(actor)) refreshSoon();
  });
  for (const hook of ["createActiveEffect", "deleteActiveEffect"])
    Hooks.on(hook, effect => {
      if (inFight(effect?.parent)) refreshSoon();
    });
  // A weapon added, changed or removed, or an effect switched on or off, changes what the acting block offers.
  for (const hook of ["updateActiveEffect", "createItem", "updateItem", "deleteItem"])
    Hooks.on(hook, document => {
      if (inFight(document?.parent)) refreshSoon();
    });
  CONFIG.ui.gc = GCConsole;
  const Sidebar = CONFIG.ui.sidebar;
  const tabs = Object.entries(Sidebar.TABS).filter(([name]) => name !== "gc");
  tabs.unshift(["gc", { tooltip: loc`GC Console`, icon: "fa-solid fa-user-secret", gmOnly: true }]);
  Sidebar.TABS = Object.fromEntries(tabs);
}

export async function openGCConsole() {
  if (!game.user.isGM) return refuse(loc`The GC Console is for the Game Control.`);
  const instance = ui.gc;
  game.spycraft2.gc.console = instance;
  await instance.render({ force: true });
  instance.activate();
  return instance;
}
