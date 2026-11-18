/** The GC Console: one window for the mission record, scene and action dice, combat, Dramatic Conflicts and reference tables. */
import { gcDiceStatus, manageGCDice } from "../../rules/gc-dice.mjs";
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

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
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

export class GCConsole extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "spycraft2-gc-console",
    classes: ["spycraft2", "gc-console"],
    position: { width: 720, height: 800 },
    window: { title: "Game Control console", resizable: true },
    actions: {
      editMission: guard(() => mission.editMission()),
      startMission: guard(() => mission.startMission()),
      endMission: guard(() => mission.endMission()),
      clearMission: guard(async () => {
        if (
          await foundry.applications.api.DialogV2.confirm({
            window: { title: "Clear the mission record" },
            content: "<p>Remove every objective, complication and antagonist from the mission record?</p>"
          })
        )
          await mission.endMission({ clear: true });
      }),
      recalculateTL: guard(() => fixThreatLevel()),
      addObjective: guard(() => mission.addObjective()),
      addAntagonist: guard(() => mission.addAntagonist()),
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
      gcDice: guard(() => manageGCDice()),
      spendDice: guard(() => spend.spendGCDice()),
      dramaticOn: guard(() => spend.setDramaticScene(true)),
      dramaticOff: guard(() => spend.setDramaticScene(false)),
      doubleInitiative: guard(() => spend.doubleOpponentInitiative()),
      fluidEvent: guard(() => combat.fluidEventDialog()),
      groupInitiative: guard((event, target) =>
        combat.rollGroupInitiative(game.combat, { single: target.dataset.single === "true" })
      ),
      surprise: guard(() => combat.surpriseRoundDialog()),
      startConflict: guard(() => conflicts.startConflictDialog()),
      advanceConflict: guard((event, target) => conflicts.advanceConflict(target.dataset.id)),
      manageConflict: guard((event, target) => conflicts.manageConflict(target.dataset.id)),
      securityDevice: guard(() => tables.securityDeviceDialog()),
      hazards: guard(() => tables.hazardLookupDialog()),
      events: guard(() => tables.eventReferenceDialog()),
      possessions: guard(() => tables.randomPossessionsDialog())
    }
  };

  static PARTS = { main: { template: "systems/spycraft2/templates/apps/gc-console.hbs", scrollable: [""] } };

  async _prepareContext() {
    return consoleContext();
  }
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
    combatNow = game.combat ?? null;
  return {
    isGM: game.user.isGM,
    mission: {
      ...m,
      caliberLabel: ROMAN[m.caliber - 1] ?? m.caliber,
      threatLevel: tl,
      threatNote: m.threatOverride
        ? "fixed"
        : `${live.base}${live.adjust ? ` ${signed(live.adjust)}` : ""}${m.active && m.threatLevel && m.threatLevel !== live.value ? `; the team would now be ${live.value}` : ""}`,
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
              count: c.initiative,
              pending: pending ? signed(pending) : "",
              mustPress: !!c.flags?.spycraft2?.mustPress
            };
          })
        }
      : null,
    conflicts: conflicts.conflictRows()
  };
}

let instance = null;
export function openGCConsole() {
  if (!game.user.isGM) return ui.notifications.warn("The GC Console is for the Game Control.");
  instance ??= new GCConsole();
  game.spycraft2.gc.console = instance;
  return instance.render(true);
}
