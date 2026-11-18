import { installSampleAgentHooks } from "./module/sample-agents.mjs";
import { registerGCTableSetup, setupGCTables, inputRollTableClass } from "./module/gc-table-setup.mjs";
import { registerSoundtrackSetup, setupSoundtrack } from "./module/soundtrack.mjs";
import { registerSampleSceneSetup, setupSampleScenes } from "./module/sample-scenes.mjs";
import { registerActorFolderSetup, setupActorFolders } from "./module/actor-folders.mjs";
import { installDialogThemeHooks } from "./module/apps/dialog-theme.mjs";
import { installChatSearchHooks } from "./module/apps/chat-search.mjs";
import { installPowerStanceInitiativeHooks } from "./module/apps/power-stance.mjs";
import { installFuriousStanceHooks } from "./module/apps/furious-stance.mjs";
import { installCombatStanceHooks } from "./module/apps/combat-stance.mjs";
import { installShakenInitiativeHooks, shakenCombatantClass } from "./module/apps/shaken-initiative.mjs";
import { rollPipeline } from "./module/rolls/index.mjs";
import { registerMigrationSettings, runWorldMigrations } from "./module/migrations/index.mjs";
import { registerGmLocks } from "./module/rules/gm-locks.mjs";
import { registerMapSettings } from "./module/apps/map.mjs";
import { installRoundStateEffects } from "./module/apps/round-state-effects.mjs";
import { renderCheckControls } from "./module/rolls/chat-controls.mjs";
import {
  startUsagePeriod,
  refreshUsagePeriodActors,
  getUsagePeriodReview,
  reviewUsagePeriod
} from "./module/rules/periods.mjs";
import { nativeResourceLocks, periodResourceActors } from "./module/rules/transactions.mjs";
import {
  manageGCDice,
  gcDiceStatus,
  initializeGCDice,
  adjustGCDice,
  reviewGCDiceSettlement,
  recordGCHint
} from "./module/rules/gc-dice.mjs";
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
import {
  installFluidInitiativeHooks,
  fluidCombatClass,
  fluidEventDialog,
  recordFluidEvent,
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
import { loc } from "./module/i18n.mjs";
import { localizeConfig } from "./module/i18n-data.mjs";
import { registerErrorNotices } from "./module/error-notices.mjs";

Hooks.once("init", () => {
  registerErrorNotices();
  console.log("Spycraft 2.0 | Initializing system");
  installChatSearchHooks();
  installDialogThemeHooks();
  CONFIG.SPYCRAFT = SPYCRAFT;
  CONFIG.time.roundTime = 6;
  CONFIG.time.turnTime = 0;
  CONFIG.statusEffects ??= [];
  for (const [id, name] of [
    ["shaken-1", "Shaken I"],
    ["shaken-2", "Shaken II"],
    ["shaken-3", "Shaken III"],
    ["shaken-4", "Shaken IV"],
    ["sleep", "Sleeping"],
    ["drunk", "Drunk"],
    ["crouched", "Crouched"],
    ["mute", "Mute"],
    ["held", "Held"],
    ["pinned", "Pinned"],
    ["baffled", "Baffled"],
    ["incompetent", "Incompetent"],
    ["prone", "Prone"],
    ["sprawled", "Sprawled"],
    ["blind", "Blinded"],
    ["deaf", "Deafened"],
    ["entangled", "Entangled"],
    ["nauseated", "Nauseated"],
    ["sickened", "Sickened"],
    ["fatigued", "Fatigued"],
    ["exhausted", "Exhausted"],
    ["enraged", "Enraged"],
    ["unconscious", "Unconscious"],
    ["flat-footed", "Flat-footed"],
    ["stunned", "Stunned"],
    ["dazed", "Dazed"],
    ["helpless", "Helpless"],
    ["vulnerable", "Vulnerable"],
    ["paralyzed", "Paralyzed"],
    ["dying", "Dying"],
    ["bleeding", "Bleeding"],
    ["fixated", "Fixated"],
    ["frightened", "Frightened"],
    ["terrified", "Terrified"],
    ["frenzied", "Frenzied"],
    ["hidden", "Hidden"]
  ])
    if (!CONFIG.statusEffects.some(effect => effect.id === id))
      CONFIG.statusEffects.push({ id, name, img: "icons/svg/downgrade.svg" });
  if (!CONFIG.statusEffects.some(effect => effect.id === "reeling"))
    CONFIG.statusEffects.push({ id: "reeling", name: loc`Reeling`, img: "icons/svg/daze.svg" });
  if (!CONFIG.statusEffects.some(effect => effect.id === "bound"))
    CONFIG.statusEffects.push({ id: "bound", name: "SPYCRAFT.Condition.Bound", img: "icons/svg/net.svg" });
  game.settings.register("spycraft2", "linguistics", {
    name: "Optional Linguistics checks",
    hint: loc`Enable the optional separate-language rule on p.124; the core game uses Cultures focuses.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register("spycraft2", "countAmmunition", {
    name: loc`Count ammunition`,
    hint: loc`Attacks take their shots from the weapon, a weapon that is empty must be reloaded, and Reload draws on the loads its ammunition code supplies.`,
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
      for (const actor of game.actors ?? []) actor.sheet?.render(false);
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
  registerMapSettings();
  installRoundStateEffects();
  CONFIG.Combat.documentClass = fluidCombatClass(CONFIG.Combat.documentClass);
  installFluidInitiativeHooks();
  CONFIG.Combatant.documentClass = shakenCombatantClass(CONFIG.Combatant.documentClass);
  installShakenInitiativeHooks();
  installCombatStanceHooks();
  installPowerStanceInitiativeHooks();
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
    vehicles: vehiclePlay
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

  Handlebars.registerHelper("signed", n => (Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`));
  Handlebars.registerHelper("sc2eq", (a, b) => a == b); // loose on purpose: templates compare numbers with strings
  Handlebars.registerHelper("sc2lt", (a, b) => Number(a) < Number(b));
  // Tooltip attributes for a breakdown: rows of [label, value]. Plain text plus an HTML version with one row per line.
  Handlebars.registerHelper("sc2tip", rows => {
    if (!Array.isArray(rows) || !rows.length) return "";
    const esc = Handlebars.escapeExpression;
    const lines = rows.map(([label, value]) => `${label} ${Number(value) >= 0 ? "+" : ""}${Number(value)}`);
    return new Handlebars.SafeString(
      loc`data-tooltip="${esc(lines.join(" · "))}" data-tooltip-html="${esc(lines.map(esc).join("<br>"))}"`
    );
  });

  foundry.applications.handlebars.loadTemplates([
    "systems/spycraft2/templates/item/parts/bonuses.hbs",
    "systems/spycraft2/templates/actor/npc-builder.hbs",
    "systems/spycraft2/templates/apps/gc-console.hbs",
    "systems/spycraft2/templates/actor/vehicle-sheet.hbs",
    "systems/spycraft2/templates/item/item-vehicle.hbs"
  ]);
});

// Buttons under posted checks come from roll pipeline contributors (module/rolls/chat-controls.mjs).
Hooks.on("renderChatMessageHTML", renderCheckControls);

// Recompute round-based bonuses and counters when combat progresses or ends.
function refreshCombatActorData() {
  for (const actor of periodResourceActors())
    if (actor.type === "agent") {
      actor.reset();
      actor.sheet?.render(false);
    }
}
// Display names that come from the rules data are translated once the language is known.
Hooks.once("i18nInit", () => localizeConfig(CONFIG.SPYCRAFT));
Hooks.once("ready", refreshCombatActorData);
Hooks.once("ready", setupSampleScenes);
Hooks.once("ready", setupActorFolders);
Hooks.once("ready", setupGCTables);
// Bring stored world data up to this build's schema version (module/migrations/index.mjs).
Hooks.once("ready", () => {
  runWorldMigrations().catch(error => {
    console.error(loc`Spycraft 2.0 | World data migration failed`, error);
    ui.notifications?.error(loc`Spycraft 2.0 could not update this world's data. See the console for details.`);
  });
});
Hooks.on("updateWorldTime", refreshCombatActorData);
Hooks.on("updateCombat", (_combat, changed) => {
  if (Object.hasOwn(changed, "round") || Object.hasOwn(changed, "active") || Object.hasOwn(changed, "turn"))
    refreshCombatActorData();
});
Hooks.on("deleteCombat", refreshCombatActorData);
// Preserve the character's completed-round clock before leaving a tracked combat.
function detachMentalLeapClocks(combat) {
  for (const actor of periodResourceActors()) {
    if (actor.type !== "agent" || !(actor.system.mentalLeaps ?? []).some(r => r.combatId === combat.id && !r.detached))
      continue;
    const primary =
      game.users.activeGM ??
      game.users
        .filter(u => u.active && actor.testUserPermission(u, "OWNER"))
        .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (primary?.id !== game.user.id || !actor.isOwner) continue;
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

Hooks.on("updateCombatant", (_combatant, changed) => {
  if (["initiative", "actorId", "tokenId", "sceneId", "group"].some(key => Object.hasOwn(changed, key)))
    refreshCombatActorData();
});
Hooks.on("createCombatant", refreshCombatActorData);
Hooks.on("deleteCombatant", refreshCombatActorData);

// Team references read actual class levels, so a source's advancement/removal refreshes its recipients.
function refreshFortuneRecipients(source) {
  for (const actor of game.actors ?? [])
    if (actor.type === "agent" && actor.system.fortuneTeammateIds?.includes(source.id)) {
      actor.reset();
      actor.sheet?.render(false);
    }
}
Hooks.on("updateActor", (actor, changed) => {
  if (changed.system?.progression || Object.hasOwn(changed, "system.progression")) refreshFortuneRecipients(actor);
});
Hooks.on("deleteActor", refreshFortuneRecipients);
for (const event of ["createItem", "updateItem", "deleteItem"])
  Hooks.on(event, item => {
    if (item.type === "class" && item.parent?.documentName === "Actor") refreshFortuneRecipients(item.parent);
  });

// A mission's Threat Level and campaign qualities affect derived numbers; refresh sheets when a scene or session starts.
Hooks.on("updateSetting", setting => {
  if (setting.key === "spycraft2.usagePeriods") game.spycraft2?.gc?.console?.render(false);
});

Hooks.once("ready", setupSoundtrack);
