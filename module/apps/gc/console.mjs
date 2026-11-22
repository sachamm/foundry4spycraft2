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
const guard = work =>
  async function (event, target) {
    try {
      await work.call(this, event, target);
    } catch (error) {
      ui.notifications.warn(error.message);
    }
    this.render();
  };

export class GCConsole extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = "gc";

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "gc-console"],
    position: { width: 720, height: 800 },
    window: {
      get title() {
        return loc`Game Control console`;
      },
      resizable: true
    },
    actions: {
      editMission: guard(() => mission.editMission()),
      startMission: guard(() => mission.startMission()),
      endMission: guard(() => mission.endMission()),
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

  static PARTS = { main: { template: "systems/spycraft2/templates/apps/gc-console.hbs", scrollable: [""] } };

  _canRender(options) {
    if (!game.user.isGM) return false;
    return super._canRender(options);
  }

  async _prepareContext(options) {
    return { ...(await super._prepareContext(options)), ...consoleContext() };
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
    installToolSearch(this.element, "details.gc-section", loc`Find a GC tool`);
    installResolutionGuide(this.element.querySelector(".gc-console-body"), "gc");
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (!this.isPopout) game.spycraft2.gc.console = this;
  }
}

const SECTION_SETTING = "gcConsoleSections";
function storedSections() {
  try {
    return game.settings.get("spycraft2", SECTION_SETTING) ?? {};
  } catch {
    return {};
  }
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
  return {
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
          combatants: combatNow.turns.map(c => {
            const fluid = c.flags?.spycraft2?.fluid,
              pending =
                fluid?.round === combatNow.round ? fluid.modifiers.reduce((sum, entry) => sum + entry.amount, 0) : 0;
            return {
              name: c.name,
              current: combatNow.started && combatNow.combatant?.id === c.id,
              defeated: !!c.isDefeated,
              count: c.initiative,
              pending: pending ? signed(pending) : "",
              mustPress: !!c.flags?.spycraft2?.mustPress
            };
          })
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

/** Register before Foundry constructs its sidebar applications. */
export function registerGCConsoleTab() {
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
