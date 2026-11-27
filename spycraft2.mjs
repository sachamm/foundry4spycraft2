import { installUndo } from "./module/apps/undo.mjs";
import { renderOpenSheet } from "./module/services/refresh.mjs";
import { installUITooltipHooks } from "./module/apps/ui-tooltips.mjs";
import { installSampleAgentHooks } from "./module/sample-agents.mjs";
import { registerGCTableSetup, setupGCTables, inputRollTableClass } from "./module/gc-table-setup.mjs";
import { registerSoundtrackSetup, setupSoundtrack } from "./module/soundtrack.mjs";
import { registerSampleSceneSetup, setupSampleScenes } from "./module/sample-scenes.mjs";
import { registerActorFolderSetup, setupActorFolders } from "./module/actor-folders.mjs";
import { installDialogThemeHooks, registerTableTrustSetting } from "./module/apps/dialog-theme.mjs";
import { installChatSearchHooks } from "./module/apps/chat-search.mjs";
import { installChatDiceHooks } from "./module/apps/chat-dice.mjs";
import { installPowerStanceInitiativeHooks } from "./module/apps/power-stance.mjs";
import { installPoolMaxHooks } from "./module/apps/pool-max.mjs";
import { installFuriousStanceHooks } from "./module/apps/furious-stance.mjs";
import { installCombatStanceHooks } from "./module/apps/combat-stance.mjs";
import { installFallingTimeHooks } from "./module/apps/falling-time.mjs";
import { installShakenInitiativeHooks, shakenCombatantClass } from "./module/apps/shaken-initiative.mjs";
import { rollPipeline } from "./module/rolls/index.mjs";
import { registerMigrationSettings, runWorldMigrations } from "./module/migrations/index.mjs";
import { primaryWriterFor } from "./module/writers.mjs";
import { registerGmLocks } from "./module/rules/gm-locks.mjs";
import { registerMapSettings } from "./module/apps/map.mjs";
import { installRoundStateEffects } from "./module/apps/round-state-effects.mjs";
import { installRoundReminders } from "./module/apps/round-reminders.mjs";
import { installTargetNotices } from "./module/apps/target-response.mjs";
import { renderCheckControls } from "./module/rolls/chat-controls.mjs";
import { compactChatCard } from "./module/rolls/chat-compact.mjs";
import { renderCheckBreakdown } from "./module/rolls/chat-breakdown.mjs";
import {
  startUsagePeriod,
  refreshUsagePeriodActors,
  getUsagePeriodReview,
  reviewUsagePeriod
} from "./module/services/periods.mjs";
import { nativeResourceLocks, periodResourceActors, registerLockRecovery } from "./module/services/transactions.mjs";
import {
  manageGCDice,
  gcDiceStatus,
  initializeGCDice,
  adjustGCDice,
  reviewGCDiceSettlement,
  recordGCHint
} from "./module/services/gc-dice.mjs";
import { SPYCRAFT } from "./module/config.mjs";
import {
  registerGCSettings,
  getMission,
  missionThreatLevel,
  isDramaticScene,
  qualitiesInForce,
  currentCampaignEffects,
  missionXP
} from "./module/apps/gc/state.mjs";
import { openGCConsole, registerGCConsoleTab } from "./module/apps/gc/console.mjs";
import { registerKeybindings } from "./module/apps/keybindings.mjs";
import {
  installFluidInitiativeHooks,
  fluidCombatClass,
  fluidEventDialog,
  recordFluidEvent,
  registerAutomaticFluidSetting,
  rollGroupInitiative,
  surpriseRoundDialog
} from "./module/apps/gc/combat.mjs";
import { spendGCDice, setDramaticScene, doubleOpponentInitiative } from "./module/apps/gc/spend.mjs";
import { startConflictDialog, advanceConflict, manageConflict } from "./module/apps/gc/conflicts.mjs";
import { rollNpcSkill, npcDamageSave, resetDamageTrack, manageDisposition } from "./module/apps/gc/npc-play.mjs";
import * as gcMission from "./module/apps/gc/mission.mjs";
import * as gcTables from "./module/apps/gc/tables.mjs";
import * as dataModels from "./module/data/_module.mjs";
import { SpycraftActor } from "./module/documents/actor.mjs";
import { SpycraftItem } from "./module/documents/item.mjs";
import { SpycraftAgentSheet, SpycraftNpcSheet } from "./module/sheets/actor-sheet.mjs";
import { SpycraftItemSheet } from "./module/sheets/item-sheet.mjs";
import { SpycraftVehicleSheet } from "./module/sheets/vehicle-sheet.mjs";
import * as vehiclePlay from "./module/apps/vehicle-play.mjs";
import { SpycraftBrowser } from "./module/apps/browser.mjs";
import { evaluate, renderTemplate } from "./module/rules/formula.mjs";
import { checkPrerequisites, describe } from "./module/rules/prerequisites.mjs";
import { loc, locKey } from "./module/i18n.mjs";
import { registerSystemHelpers } from "./module/handlebars-helpers.mjs";
import { localizeConfig } from "./module/i18n-data.mjs";
import { registerErrorNotices } from "./module/error-notices.mjs";
import * as gameClock from "./module/apps/game-clock.mjs";
import { installGCRelay, askGC } from "./module/apps/gc-relay.mjs";
import { registerFastPathSetting } from "./module/apps/remembered-choices.mjs";
import { registerQuickResolveSetting } from "./module/apps/damage-application.mjs";
import { installTurnCue } from "./module/apps/turn-cue.mjs";
import { installHotbar, rollFromMacro } from "./module/apps/hotbar.mjs";
import { installCharacterOwnership } from "./module/apps/character-ownership.mjs";
import { installTokenLinks } from "./module/apps/token-links.mjs";

/** Conditions this system adds to the token HUD: [id, label, icon]. Labels are read once the language is known. */
const SYSTEM_STATUSES = [
  ["shaken-1", () => loc`Shaken I`],
  ["shaken-2", () => loc`Shaken II`],
  ["shaken-3", () => loc`Shaken III`],
  ["shaken-4", () => loc`Shaken IV`],
  ["sleep", () => loc`Sleeping`],
  ["drunk", () => loc`Drunk`],
  ["crouched", () => loc`Crouched`],
  ["mute", () => loc`Mute`],
  ["held", () => loc`Held`],
  ["pinned", () => loc`Pinned`],
  ["baffled", () => loc`Baffled`],
  ["incompetent", () => loc`Incompetent`],
  ["prone", () => loc`Prone`],
  ["sprawled", () => loc`Sprawled`],
  ["blind", () => loc`Blinded`],
  ["deaf", () => loc`Deafened`],
  ["entangled", () => loc`Entangled`],
  ["nauseated", () => loc`Nauseated`],
  ["sickened", () => loc`Sickened`],
  ["fatigued", () => loc`Fatigued`],
  ["exhausted", () => loc`Exhausted`],
  ["enraged", () => loc`Enraged`],
  ["unconscious", () => loc`Unconscious`],
  ["flat-footed", () => loc`Flat-footed`],
  ["stunned", () => loc`Stunned`],
  ["dazed", () => loc`Dazed`],
  ["helpless", () => loc`Helpless`],
  ["vulnerable", () => loc`Vulnerable`],
  ["paralyzed", () => loc`Paralyzed`],
  ["dying", () => loc`Dying`],
  ["bleeding", () => loc`Bleeding`],
  ["fixated", () => loc`Fixated`],
  ["frightened", () => loc`Frightened`],
  ["terrified", () => loc`Terrified`],
  ["frenzied", () => loc`Frenzied`],
  ["hidden", () => loc`Hidden`],
  ["reeling", () => loc`Reeling`, "icons/svg/daze.svg"]
];
/** Name the system's conditions in the active language. */
function nameSystemStatuses() {
  for (const [id, label] of SYSTEM_STATUSES) {
    const effect = CONFIG.statusEffects.find(entry => entry.id === id);
    if (effect && effect.name === id) effect.name = label();
  }
}

Hooks.once("init", () => {
  registerErrorNotices();
  console.log("Field Agent's Handbook | Initializing system");
  installChatSearchHooks();
  installChatDiceHooks();
  installDialogThemeHooks();
  installUITooltipHooks();
  CONFIG.SPYCRAFT = SPYCRAFT;
  registerKeybindings({ openConsole: openGCConsole });
  // The token HUD lists this system's conditions only. Core entries are kept when Foundry itself reads them
  // (defeated, invisible and the like) or when they share an id with one of ours, whose icon is then reused.
  const coreStatuses = CONFIG.statusEffects ?? [];
  const coreSpecial = new Set(Object.values(CONFIG.specialStatusEffects ?? {}));
  const ours = [
    ...SYSTEM_STATUSES.map(([id, , img]) => ({ id, name: id, img })),
    { id: "bound", img: "icons/svg/net.svg" }
  ];
  CONFIG.statusEffects = [
    ...ours.map(({ id, name, img }) => ({
      ...coreStatuses.find(effect => effect.id === id),
      id,
      name: name ?? "SPYCRAFT.Condition.Bound",
      img: img ?? coreStatuses.find(effect => effect.id === id)?.img ?? "icons/svg/downgrade.svg"
    })),
    ...coreStatuses.filter(effect => coreSpecial.has(effect.id) && !ours.some(entry => entry.id === effect.id))
  ];
  game.settings.register("spycraft2", "linguistics", {
    name: locKey`Optional Linguistics checks`,
    hint: locKey`Enable the optional separate-language rule on p.124; the core game uses Cultures focuses.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register("spycraft2", "countAmmunition", {
    name: locKey`Count ammunition`,
    hint: locKey`Attacks take their shots from the weapon, a weapon that is empty must be reloaded, and Reload draws on the loads its ammunition code supplies.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("spycraft2", "usagePeriods", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: refreshUsagePeriodActors
  });
  game.settings.register("spycraft2", "usagePeriodReview", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: refreshUsagePeriodActors
  });
  game.settings.register("spycraft2", "gcActionDice", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange() {
      for (const actor of game.actors ?? []) renderOpenSheet(actor);
    }
  });
  registerGCSettings();
  registerGCConsoleTab();
  registerGCTableSetup();
  CONFIG.RollTable.documentClass = inputRollTableClass(CONFIG.RollTable.documentClass);
  installSampleAgentHooks();
  registerSampleSceneSetup();
  registerActorFolderSetup();
  registerSoundtrackSetup();
  registerMigrationSettings();
  registerGmLocks();
  registerLockRecovery();
  registerMapSettings();
  // The game clock sets how much time a combat round adds (CONFIG.time.roundTime).
  gameClock.installGameClock();
  installGCRelay();
  installUndo();
  registerFastPathSetting();
  registerQuickResolveSetting();
  registerTableTrustSetting();
  installCharacterOwnership();
  installTokenLinks();
  installTurnCue();
  installHotbar();
  registerAutomaticFluidSetting();
  installRoundStateEffects();
  CONFIG.Combat.documentClass = fluidCombatClass(CONFIG.Combat.documentClass);
  installFluidInitiativeHooks();
  installRoundReminders();
  installTargetNotices();
  CONFIG.Combatant.documentClass = shakenCombatantClass(CONFIG.Combatant.documentClass);
  installShakenInitiativeHooks();
  installCombatStanceHooks();
  installFallingTimeHooks();
  installPowerStanceInitiativeHooks();
  installPoolMaxHooks();
  installFuriousStanceHooks();
  CONFIG.Actor.documentClass = SpycraftActor;
  CONFIG.Item.documentClass = SpycraftItem;
  Object.assign(CONFIG.Actor.dataModels, dataModels.actor);
  Object.assign(CONFIG.Item.dataModels, dataModels.item);
  CONFIG.Actor.trackableAttributes = {
    agent: { bar: ["vitality", "wounds", "actionDice"], value: [] },
    npc: { bar: ["vitality", "wounds"], value: [] },
    vehicle: { bar: [], value: ["failedSaves", "defense", "damageSave"] }
  };

  CONFIG.Combat.initiative = { formula: "1d20 + @initiative.total", decimals: 0 };

  game.spycraft2 = {
    gc: {
      open: openGCConsole,
      console: null,
      mission: { ...gcMission, get: getMission, threatLevel: missionThreatLevel, xp: missionXP },
      spend: spendGCDice,
      setDramaticScene,
      isDramaticScene,
      doubleOpponentInitiative,
      fluidEvent: fluidEventDialog,
      recordFluidEvent,
      rollGroupInitiative,
      surpriseRound: surpriseRoundDialog,
      conflicts: { start: startConflictDialog, advance: advanceConflict, manage: manageConflict },
      npc: {
        rollSkill: rollNpcSkill,
        damageSave: npcDamageSave,
        resetDamage: resetDamageTrack,
        disposition: manageDisposition
      },
      campaign: { qualities: qualitiesInForce, effects: currentCampaignEffects },
      tables: gcTables
    },
    resourceLocks: nativeResourceLocks,
    SpycraftBrowser,
    gcDice: {
      status: gcDiceStatus,
      initialize: initializeGCDice,
      adjust: adjustGCDice,
      manage: manageGCDice,
      review: reviewGCDiceSettlement,
      hint: recordGCHint
    },
    resetUsagePeriod: startUsagePeriod,
    getUsagePeriodReview,
    reviewUsagePeriod,
    rules: { evaluate, renderTemplate, checkPrerequisites, describe },
    rollPipeline,
    rollFromMacro,
    vehicles: vehiclePlay,
    askGC,
    clock: {
      open: gameClock.openGameClock,
      label: gameClock.clockLabel,
      advance: gameClock.advanceClock,
      setDate: gameClock.setClockDateDialog,
      addTimer: gameClock.addTimer,
      timers: gameClock.myTimers,
      deleteTimer: gameClock.deleteTimer
    }
  };

  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet("spycraft2", SpycraftAgentSheet, {
    types: ["agent"],
    makeDefault: true,
    label: "SPYCRAFT.Sheet.Agent"
  });
  Actors.registerSheet("spycraft2", SpycraftNpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "SPYCRAFT.Sheet.Npc"
  });
  Actors.registerSheet("spycraft2", SpycraftVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "SPYCRAFT.Sheet.Vehicle"
  });
  Items.registerSheet("spycraft2", SpycraftItemSheet, { makeDefault: true, label: "SPYCRAFT.Sheet.Item" });

  // Partials are loaded by the sheet part that uses them (PARTS.x.templates), when that sheet first renders.
  registerSystemHelpers(Handlebars);
});

// Buttons under posted checks come from roll pipeline contributors (module/rolls/chat-controls.mjs).
Hooks.on("renderChatMessageHTML", renderCheckControls);
// Then the card is shortened: code name in the header, rule notes behind "Details" (module/rolls/chat-compact.mjs).
Hooks.on("renderChatMessageHTML", compactChatCard);
Hooks.on("renderChatMessageHTML", (message, html) => renderCheckBreakdown(message, html));

// Recompute round-based bonuses and counters when combat progresses or ends. Changes arriving together (a round
// advance updates many combatants) are gathered into one pass; a combat change only touches that combat's agents.
let pendingRefresh = null;
function refreshCombatActorData(scope = null) {
  const all = scope === null || !Array.isArray(scope);
  if (!pendingRefresh) {
    pendingRefresh = { all: false, actors: new Set() };
    setTimeout(() => {
      const { all: everyone, actors } = pendingRefresh;
      pendingRefresh = null;
      const chosen = everyone ? periodResourceActors() : actors;
      for (const actor of chosen)
        if (actor?.type === "agent") {
          actor.reset();
          renderOpenSheet(actor);
        }
      game.spycraft2?.gc?.console?.render(false);
    }, 0);
  }
  if (all) pendingRefresh.all = true;
  else for (const actor of scope) pendingRefresh.actors.add(actor);
}
/** The agents taking part in a combat: what a change to that combat can affect. */
const combatActors = combat => [...(combat?.combatants ?? [])].map(combatant => combatant.actor).filter(Boolean);
// Display names that come from the rules data are translated once the language is known.
Hooks.once("i18nInit", () => {
  localizeConfig(CONFIG.SPYCRAFT);
  nameSystemStatuses();
});
Hooks.once("ready", () => refreshCombatActorData());
// One ordered start-up on the lead GC's client: bring stored world data up to this build's schema version
// (module/migrations/index.mjs) first, then add the sample scenes, folders, tables and soundtrack, so nothing is
// imported into data that is still being migrated. "spycraft2.ready" then tells the reconcilers to catch up.
Hooks.once("ready", async () => {
  try {
    await runWorldMigrations();
  } catch (error) {
    console.error(loc`Field Agent's Handbook | World data migration failed`, error);
    ui.notifications?.error(
      loc`The Field Agent's Handbook could not update this world's data. See the console for details.`
    );
  }
  for (const setup of [setupSampleScenes, setupActorFolders, setupGCTables, setupSoundtrack])
    try {
      await setup();
    } catch (error) {
      console.error(loc`Field Agent's Handbook | A first-load setup step failed`, error);
    }
  Hooks.callAll("spycraft2.ready");
});
Hooks.on("updateWorldTime", () => refreshCombatActorData());
Hooks.on("updateCombat", (combat, changed) => {
  if (Object.hasOwn(changed, "round") || Object.hasOwn(changed, "active") || Object.hasOwn(changed, "turn"))
    refreshCombatActorData(combatActors(combat));
});
Hooks.on("deleteCombat", combat => refreshCombatActorData(combatActors(combat)));
// Preserve the character's completed-round clock before leaving a tracked combat.
function detachMentalLeapClocks(combat) {
  for (const actor of periodResourceActors()) {
    if (actor.type !== "agent" || !(actor.system.mentalLeaps ?? []).some(r => r.combatId === combat.id && !r.detached))
      continue;
    if (primaryWriterFor(actor)?.id !== game.user.id || !actor.isOwner) continue;
    actor
      .detachMentalLeapCombat(combat)
      .catch(error => ui.notifications.warn(loc`Mental Leap clock needs review: ${error.message}`));
  }
}
Hooks.on("deleteCombat", detachMentalLeapClocks);
Hooks.on("updateCombat", (combat, changed) => {
  if ((Object.hasOwn(changed, "active") || Object.hasOwn(changed, "round")) && !combat.started)
    detachMentalLeapClocks(combat);
});

Hooks.on("updateCombatant", (combatant, changed) => {
  if (["initiative", "actorId", "tokenId", "sceneId", "group"].some(key => Object.hasOwn(changed, key)))
    refreshCombatActorData(combatActors(combatant.parent));
  else game.spycraft2?.gc?.console?.render(false);
});
Hooks.on("createCombatant", combatant => refreshCombatActorData(combatActors(combatant.parent)));
Hooks.on("deleteCombatant", combatant =>
  refreshCombatActorData([...combatActors(combatant.parent), combatant.actor].filter(Boolean))
);

// Team references read actual class levels, so a source's advancement/removal refreshes its recipients.
function refreshFortuneRecipients(source) {
  for (const actor of game.actors ?? [])
    if (actor.type === "agent" && actor.system.fortuneTeammateIds?.includes(source.id)) {
      actor.reset();
      renderOpenSheet(actor);
    }
}
Hooks.on("updateActor", (actor, changed, options) => {
  if (options?.spycraft2Migration) return;
  if (changed.system?.progression || Object.hasOwn(changed, "system.progression")) refreshFortuneRecipients(actor);
});
Hooks.on("deleteActor", refreshFortuneRecipients);
for (const event of ["createItem", "updateItem", "deleteItem"])
  Hooks.on(event, (item, ...rest) => {
    // A migration writes many items at once and changes no class levels a teammate reads.
    if (rest.some(arg => arg?.spycraft2Migration)) return;
    if (item.type === "class" && item.parent?.documentName === "Actor") refreshFortuneRecipients(item.parent);
  });

// A mission's Threat Level and campaign qualities affect derived numbers; refresh sheets when a scene or session starts.
Hooks.on("updateSetting", setting => {
  if (setting.key === "spycraft2.usagePeriods") game.spycraft2?.gc?.console?.render(false);
});
