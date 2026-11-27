import { readSetting } from "../../settings.mjs";
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { installToolSearch } from "../tool-search.mjs";
import { installResolutionGuide } from "../resolution-guide.mjs";
/** The GC Console: sidebar tools for the mission record, scene and action dice, combat, Dramatic Conflicts and reference tables. */
import { gcDiceStatus, manageGCDice } from "../../services/gc-dice.mjs";
import { antagonistReward, threatLevel, threatBonusActionDice, missionStanding } from "../../rules/gc/mission.mjs";
import { campaignQuality } from "../../rules/gc/campaign.mjs";
import { campaignRuleLines } from "../../rules/campaign-rules.mjs";
import { campaignYear, periodMoney, periodMoneyModifier } from "../../rules/period-money.mjs";
import { standingStatus } from "../../rules/standing.mjs";
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
import * as organizations from "./organizations.mjs";
import * as tables from "./tables.mjs";
import { addNpcToScene } from "./add-npc.mjs";
import * as turn from "./console-turn.mjs";
import {
  VIEWS,
  VIEW_SECTIONS,
  consoleView,
  consoleSections,
  firstSessionChecklist,
  primaryAction
} from "./console-view.mjs";
import { npcDamageSaveWithUndo } from "./npc-play.mjs";
import { withUndo } from "../undo.mjs";
import { pressActorCard, shortcutLabel } from "../keybindings.mjs";
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
/**
 * A console action runs once at a time: a second press while it is still working, or its dialog is open, is dropped.
 * A press from the keyboard is remembered before the work starts, so the redraw after a dialog gives the focus back to
 * the same control (or, when the control is gone, to its section) instead of dropping it to the page.
 */
const guard = work => {
  let busy = false;
  return async function (event, target) {
    if (busy) return;
    busy = true;
    if (event?.detail === 0 && this?.element) this._pressed = controlKey(target, this.element);
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

/** What an Undo note calls a turn-action step. */
const stepLabel = (kind, name) =>
  kind === "half"
    ? loc`Half action spent: ${name}`
    : kind === "full"
      ? loc`Full action spent: ${name}`
      : loc`Actions given back: ${name}`;

/**
 * The combatant an acting-block button was drawn for, while it is still the one acting. When the turn has moved on
 * (another GC, a player's Delay, a shortcut), nothing is done and the GC is told: returns false.
 */
function actingCombatant(target) {
  const wanted = target?.dataset?.combatant,
    now = game.combat?.started ? game.combat.combatant : null;
  if (!now) {
    ui.notifications.warn(loc`No combatant is acting now; nothing was done.`);
    return false;
  }
  if (wanted && now.id !== wanted) {
    ui.notifications.warn(loc`The turn has moved to ${now.name}; nothing was done.`);
    return false;
  }
  return now;
}

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
      planNextMission: guard(() => mission.planNextMission()),
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
      previousTurn: guard(() => combat.stepBackTurn(game.combat)),
      nextTurn: guard(() => (game.combat?.started ? game.combat.nextTurn() : game.combat?.startCombat())),
      consoleWindow: guard(() => openGCConsole({ window: true })),
      addComplication: guard(() => mission.addComplication()),
      entry: guard((event, target) =>
        mission.changeEntry(target.dataset.list, target.dataset.key, target.dataset.change, { notify: true })
      ),
      recordInfraction: guard(() => mission.recordInfraction()),
      sessionDice: guard(() => mission.applySessionDiceAdjustments()),
      missionReport: guard((event, target) => mission.missionReport({ planned: target.dataset.planned === "true" })),
      awardStanding: guard(() => mission.awardStanding()),
      seasonQualities: guard(() => mission.editSeasonQualities()),
      caliberIncrease: guard(() => spend.recordCaliberIncrease(getMission().caliber + 1)),
      sceneAdvance: guard(() => mission.correctSceneCount()),
      gcDice: guard(() => {
        const m = getMission();
        return manageGCDice({ playersPresent: teamActors(m).length, caliber: m.caliber });
      }),
      beginSession: guard(async () => {
        if (!(await mission.beginSession())) return;
        const dice = gcDiceStatus();
        ui.notifications.info(
          loc`Session begun: the GC has ${dice.value} action dice, and every agent's action dice and session abilities are reset.`
        );
      }),
      nextScene: guard(async () => {
        if (!(await mission.nextScene())) return;
        const m = getMission();
        ui.notifications.info(
          m.active
            ? loc`Scene ${(m.scenesPlayed ?? 0) + 1} begun: scene abilities are back and standard NPCs' damage is cleared.`
            : loc`New scene begun: scene abilities are back and standard NPCs' damage is cleared.`
        );
      }),
      spendDice: guard(() => spend.spendGCDice()),
      actingSpendDice: guard((event, target) => {
        const acting = actingCombatant(target);
        if (acting === false) return null;
        return spend.spendGCDice({ preferActor: acting?.actor ?? null });
      }),
      dramaticOn: guard(async () => {
        if (await spend.setDramaticScene(true)) ui.notifications.info(loc`This scene is now dramatic (no dice spent).`);
      }),
      dramaticOff: guard(async () => {
        if (await spend.setDramaticScene(false)) ui.notifications.info(loc`This scene is back to standard.`);
      }),
      doubleInitiative: guard(() => spend.doubleOpponentInitiative()),
      fluidEvent: guard(() => combat.fluidEventDialog()),
      groupInitiative: guard((event, target) =>
        combat.rollGroupInitiative(game.combat, { single: target.dataset.single === "true" })
      ),
      surprise: guard(() => combat.surpriseRoundDialog()),
      combatReference: guard(() => combat.combatReferenceDialog()),
      openCombatant: guard((event, target) =>
        turn.openCombatant(game.combat, target.dataset.id, { sheet: target.dataset.sheet === "true" || event.shiftKey })
      ),
      // Each acting button carries the combatant it was drawn for; a turn that has moved since is not acted on.
      actingAttack: guard((event, target) => {
        const acting = actingCombatant(target);
        return acting && turn.attackWith(acting.actor, target.dataset.id, event, acting);
      }),
      actingSpend: guard(async (event, target) => {
        const acting = actingCombatant(target);
        if (!acting) return null;
        const kind = target.dataset.kind;
        const result = await withUndo([acting.actor], stepLabel(kind, acting.name), () =>
          combat.spendTurnAction(acting, kind)
        );
        if (result && target.dataset.kind === "reset")
          ui.notifications.info(loc`${acting.name} has this turn's actions back.`);
        return result;
      }),
      actingDamageSave: guard((event, target) => {
        const acting = actingCombatant(target);
        return acting && npcDamageSaveWithUndo(acting.actor);
      }),
      actingDelay: guard((event, target) => {
        const acting = actingCombatant(target);
        return acting && withUndo([acting.actor], loc`Delay: ${acting.name}`, () => combat.delayCombatant(acting));
      }),
      actingReady: guard((event, target) => {
        const acting = actingCombatant(target);
        return (
          acting && withUndo([acting.actor], loc`Ready an action: ${acting.name}`, () => combat.readyCombatant(acting))
        );
      }),
      actingOutcome: guard((event, target) => {
        const acting = actingCombatant(target);
        return acting && turn.actingOutcome(acting.actor, target.dataset.step);
      }),
      cardNextStep: guard((event, target) => {
        const acting = actingCombatant(target);
        if (!acting) return null;
        return pressActorCard(acting, "button.sc2-primary-action[data-roll-control]");
      }),
      mobAttack: guard((event, target) => turn.mobAttackDialog(game.combat, target.dataset.key)),
      consoleView: guard((event, target) => rememberView(target.dataset.view, viewState())),
      startConflict: guard(() => conflicts.startConflictDialog()),
      addOrganization: guard(() => organizations.editOrganization()),
      editOrganization: guard((event, target) => organizations.editOrganization(target.dataset.id)),
      organizationCard: guard((event, target) => organizations.organizationCard(target.dataset.id)),
      removeOrganization: guard((event, target) => organizations.removeOrganization(target.dataset.id)),
      advanceConflict: guard((event, target) => conflicts.advanceConflict(target.dataset.id)),
      manageConflict: guard((event, target) => conflicts.manageConflict(target.dataset.id)),
      clockStep: guard((event, target) => advanceClock(Number(target.dataset.seconds))),
      clockAdvance: guard(() => advanceClockDialog()),
      clockDate: guard(() => setClockDateDialog()),
      clockOpen: guard(() => openGameClock()),
      securityDevice: guard(() => tables.securityDeviceDialog()),
      hazards: guard(() => tables.hazardLookupDialog()),
      events: guard(() => tables.eventReferenceDialog()),
      possessions: guard(() => tables.randomPossessionsDialog()),
      npcKnowledge: guard(() => tables.npcKnowledgeDialog())
    }
  };

  static PARTS = {
    main: {
      template: "systems/spycraft2/templates/apps/gc-console.hbs",
      templates: [
        "systems/spycraft2/templates/apps/gc-console-combat.hbs",
        "systems/spycraft2/templates/apps/gc-console-session.hbs"
      ],
      scrollable: [""]
    }
  };

  _canRender(options) {
    if (!game.user.isGM) return false;
    return super._canRender(options);
  }

  async _prepareContext(options) {
    return { ...(await super._prepareContext(options)), ...consoleContext(), windowed: !!this.isPopout };
  }

  /** What the GC was looking at, kept across a redraw: the scroll position, the focused control and open sub-lists. */
  _preRender(context, options) {
    this._kept = captureConsoleState(this.element);
    // A keyboard press that opened a dialog left the focus on the page; the pressed control gets it back.
    if (this._kept && this._pressed && !this._kept.focus) this._kept.focus = this._pressed;
    this._pressed = null;
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
    // Combat rows follow the tracker: a double press opens the sheet, and the pointer over a row lights its token.
    for (const row of this.element.querySelectorAll('.gc-combat-rows [data-action="openCombatant"]')) {
      row.addEventListener("dblclick", () => turn.openCombatant(game.combat, row.dataset.id, { sheet: true }));
      row.addEventListener("pointerenter", () => turn.hoverCombatant(game.combat, row.dataset.id, true));
      row.addEventListener("pointerleave", () => turn.hoverCombatant(game.combat, row.dataset.id, false));
    }
    this._wireActorDrops();
    installToolSearch(this.element, "details.gc-section", loc`Find a GC tool`, (this._search ??= {}));
    installResolutionGuide(this.element.querySelector(".gc-console-body"), "gc");
    restoreConsoleState(this.element, this._kept);
    this._kept = null;
  }

  /**
   * An NPC dragged from the Actors directory or a compendium: dropped on Antagonists it is recorded for XP, dropped
   * anywhere else it opens Add NPC to scene with that NPC chosen. Both open their dialog, so nothing happens unasked.
   */
  _wireActorDrops() {
    const body = this.element.querySelector(".gc-console-body");
    if (!body) return;
    body.addEventListener("dragover", event => {
      if ([...(event.dataTransfer?.types ?? [])].includes("text/plain")) event.preventDefault();
    });
    body.addEventListener("drop", async event => {
      let data = null;
      try {
        data = JSON.parse(event.dataTransfer?.getData("text/plain") || "null");
      } catch {
        return;
      }
      if (data?.type !== "Actor" || !data.uuid) return;
      event.preventDefault();
      const actor = await fromUuid(data.uuid);
      if (actor?.type !== "npc") return refuse(loc`Only an NPC can be dropped on the GC Console.`);
      const section = event.target?.closest?.("details[data-section]")?.dataset.section;
      try {
        if (section === "antagonists") await mission.addAntagonist({ uuid: actor.pack ? "" : actor.uuid });
        else await addNpcToScene({ uuid: actor.uuid });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
      this.render();
    });
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
  // The same action can stand in two places (the acting block and the list): the place is kept too. When the
  // control is gone after the redraw (a removed row), the focus goes to its section's heading.
  return {
    ...wanted,
    nth: Math.max(0, twins(root, wanted).indexOf(element)),
    section: element.closest?.("details[data-section]")?.dataset.section ?? null
  };
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
    const heading = kept.focus.section
      ? root.querySelector(`details[data-section="${kept.focus.section}"] > summary`)
      : null;
    const target = kept.focus.search
      ? root.querySelector(".sc2-tool-search input")
      : kept.focus.action
        ? (same[kept.focus.nth ?? 0] ?? same[0] ?? heading)
        : heading;
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
/** The state the view choice belongs to: a choice made while planning does not hold once a fight is on. */
const viewState = () => {
  const m = getMission();
  return game.combat ? "combat" : m.active ? "active" : m.ended ? "ended" : "planning";
};
/** What the choice was made in: this fight, or outside a fight. A choice made in one fight does not hold in the next. */
const viewKey = () => game.combat?.id ?? null;
function rememberView(view, state) {
  if (!VIEWS.includes(view)) return null;
  return game.settings.set("spycraft2", VIEW_SETTING, { view, state, key: viewKey() });
}
const SECTION_SETTING = "gcConsoleSections";
function storedSections() {
  return readSetting(SECTION_SETTING, {}) ?? {};
}
function rememberSection(section, state, open) {
  const stored = { ...storedSections(), [section]: { state, open } };
  return game.settings.set("spycraft2", SECTION_SETTING, stored);
}

/** A tooltip with its shortcut, when one is bound: "Ends this turn (Alt+N)". */
const withKey = (text, id) => {
  const key = shortcutLabel(id);
  return key ? `${text} (${key})` : text;
};

/** A clock time for "Session begun 19:42", in the GC's own locale. */
const timeOfDay = stamp => {
  try {
    return new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export { consoleView, consoleSections, firstSessionChecklist, primaryAction };

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
    started = !!combatNow?.started,
    // Only receipts for the agents on the team now: one who left does not stand in for one who joined.
    paid = team.filter(actor => m.standingPaid?.[actor.id]).length;
  const checklist = firstSessionChecklist({
    mission: m,
    diceCurrent: dice.current,
    npcActors: [...(game.actors ?? [])].filter(actor => actor.type === "npc").length,
    // Read from the world, not from the combat this client happens to view: another GC's fight does not count.
    combatSeen: (m.scenesPlayed ?? 0) > 0 || (m.active && [...(game.combats ?? [])].some(c => c.started))
  });
  // Done once is done for good: a new mission or session does not bring the list back.
  if (readSetting("gcFirstSessionDone", false)) checklist.complete = true;
  else if (checklist.complete && game.user?.isGM)
    Promise.resolve(game.settings.set("spycraft2", "gcFirstSessionDone", true)).catch(() => {});
  // The session's own starting number, once begun: what it was set up with, not what the team would give now.
  const starting =
      dice.current && Number.isSafeInteger(dice.playersPresent)
        ? dice.playersPresent + 2 * (Number(dice.caliber) || m.caliber)
        : team.length + 2 * m.caliber,
    sessionAt = dice.current && dice.startedAt ? timeOfDay(dice.startedAt) : "";
  return {
    primary: primaryAction({
      view,
      checklistShown: view === "prep" && !checklist.complete,
      missionActive: !!m.active,
      missionEnded: !!m.ended,
      diceCurrent: !!dice.current,
      combat: combatNow
        ? { started, unrolled: combatNow.turns.filter(c => !Number.isFinite(c.initiative)).length }
        : null
    }),
    session: {
      begun: !!dice.current,
      at: sessionAt,
      note: dice.current ? (sessionAt ? loc`Session begun ${sessionAt}` : loc`Session begun`) : ""
    },
    // Each tooltip says what the button changes, then its key, so the shortcuts are learnt where they are used.
    tips: {
      nextTurn: withKey(loc`Ends this turn and moves to the next combatant`, "nextTurn"),
      previousTurn: withKey(loc`Steps the fight back one turn`, "previousTurn"),
      spendDice: withKey(loc`Opens Spend dice with the acting NPC chosen`, "spendDice"),
      cardNextStep: withKey(
        loc`Presses the main button (Roll damage, Apply) on the newest chat card about this combatant, and says which`,
        "cardPrimary"
      )
    },
    shortcuts: Object.fromEntries(
      ["nextTurn", "previousTurn", "cardPrimary", "gcConsole", "gcBoost", "activeSheet", "spendDice"].map(id => [
        id,
        shortcutLabel(id)
      ])
    ),
    view,
    views: [
      { id: "prep", label: loc`Prep`, hint: loc`Mission record, opposition and campaign` },
      { id: "play", label: loc`Play`, hint: loc`Combat, scene and GC action dice` },
      { id: "wrap", label: loc`Wrap-up`, hint: loc`XP, standing and exposure` }
    ].map(entry => ({ ...entry, active: entry.id === view })),
    shown: Object.fromEntries(Object.keys(VIEW_SECTIONS).map(id => [id, id === view])),
    hiddenSections: Object.fromEntries(
      // A running fight keeps Combat, and with it Next turn, on screen in every view.
      [...new Set(Object.values(VIEW_SECTIONS).flat())].map(id => [
        id,
        !(VIEW_SECTIONS[view].includes(id) || (id === "combat" && !!combatNow?.started))
      ])
    ),
    checklist,
    status: {
      mission: m.name || loc`No mission recorded`,
      missionState: m.active ? loc`active` : m.ended ? loc`ended` : loc`not started`,
      // The scene's kind, not the campaign's era: "period" reads as the decade in a Historical campaign.
      scene: m.scenesPlayed
        ? scene.dramatic
          ? loc`Scene ${m.scenesPlayed + 1} · dramatic`
          : loc`Scene ${m.scenesPlayed + 1} · standard`
        : scene.dramatic
          ? loc`Dramatic`
          : loc`Standard`,
      turn: combatNow
        ? combatNow.started
          ? loc`Round ${combatNow.round}: ${combatNow.combatant?.name ?? "—"}`
          : loc`Fight not begun`
        : loc`No combat`,
      // Awards can take the pool past its starting number; "left of" would then read oddly.
      dice: !dice.current
        ? loc`not set up`
        : dice.value > starting
          ? loc`${dice.value} left`
          : loc`${dice.value} left of ${starting}`,
      session: dice.current ? (sessionAt ? loc`begun ${sessionAt}` : loc`begun`) : loc`not begun`,
      // While planning, the strip shows what the mission will be, not a fight that cannot be running yet.
      threat: loc`${tl} · Caliber ${ROMAN[m.caliber - 1] ?? m.caliber}`
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
        ? loc`set by hand`
        : `${live.adjust ? loc`team ${live.base}, ${signed(live.adjust)} adjustment` : loc`from the team's levels`}${m.active && m.threatLevel && m.threatLevel !== live.value ? loc`; the team would now be ${live.value}` : ""}`,
      bonusDice: threatBonusActionDice(tl, levels),
      team: team.map(actor => {
        const status = standingStatus(actor.system);
        return {
          name: actor.name,
          level: actor.system.level,
          reputation: actor.system.reputation,
          netWorth: actor.system.netWorth,
          // Negative standing (p.440): shown beside the name, so the GC sees who has lost mission gear.
          standingStatus: status.liquidation ? loc`targeted for liquidation` : status.burned ? loc`burned` : ""
        };
      }),
      standing: { ...standing, netWorthLabel: Number(standing?.netWorth ?? 0).toLocaleString() },
      canRaiseCaliber: m.caliber < 5,
      nextCaliberLabel: ROMAN[m.caliber] ?? m.caliber + 1,
      objectives: m.objectives.map(objective => ({ ...objective, xp: objective.grade * 25 })),
      antagonists: m.antagonists.map(entry => ({
        ...entry,
        perScene: !!(entry.full || entry.promoted),
        moreScenes: (Number(entry.scenes) || 1) > 1,
        reward: antagonistReward(entry)
      })),
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
      // Before the mission starts nothing is earned yet: the figure is what the mission plans to give.
      label: m.active || m.ended ? loc`Base XP earned so far` : loc`Planned base XP`,
      started: !!(m.active || m.ended),
      earned: earned.total,
      planned: planned.total,
      warnings: planned.warnings,
      perScene: m.scenesPlayed ? Math.round(earned.total / m.scenesPlayed) : null
    },
    dice: {
      ...dice,
      expected: starting,
      formula:
        dice.current && Number.isSafeInteger(dice.playersPresent)
          ? loc`${dice.playersPresent} players present + 2 × Caliber ${ROMAN[(Number(dice.caliber) || m.caliber) - 1] ?? m.caliber}`
          : loc`${team.length} agents on the team + 2 × Caliber ${ROMAN[m.caliber - 1] ?? m.caliber}`
    },
    scene,
    season: qualities
      .filter(quality => quality.source === "season")
      .map(quality => ({ name: quality.name, xp: signed(quality.xp), summary: quality.summary })),
    ruleLines: [
      ...campaignRuleLines(effects, { money: amount => periodMoney(amount, { effects }) }),
      ...(effects.historicalMoney
        ? [
            campaignYear() === null
              ? loc`Historical: set the clock's date so money follows Table 7.4.`
              : loc`Money values and costs ×${periodMoneyModifier({ effects })} for ${campaignYear()} (Table 7.4).`
          ]
        : [])
    ],
    effectConflicts,
    combat: combatNow
      ? {
          round: combatNow.round,
          started,
          surprise: combatNow.flags?.spycraft2?.surprise ?? null,
          acting,
          combatants: turn.combatRows(combatNow),
          // Before the fight begins a mob cannot attack: the buttons wait for it.
          mobs: started
            ? turn.mobGroups(combatNow).map(group => ({
                key: group.key,
                label: loc`Mob attack: ${group.name} ×${group.count}`
              }))
            : [],
          unrolled: combatNow.turns.filter(c => !Number.isFinite(c.initiative)).length,
          unrolledNames: combatNow.turns
            .filter(c => !Number.isFinite(c.initiative))
            .map(c => c.name)
            .join(", "),
          scene: combatNow.scene?.name ?? loc`no scene`,
          // The fight the console runs is named when it is not this scene's, so Next turn is not pressed on another.
          elsewhere: !!(combatNow.scene && globalThis.canvas?.scene && combatNow.scene.id !== canvas.scene.id)
        }
      : null,
    conflicts: conflictList,
    organizations: organizations.organizationRows(),
    counts: {
      objectives: `${m.objectives.filter(objective => objective.complete).length}/${m.objectives.length}`,
      antagonists: m.antagonists.length,
      conflicts: conflictList.filter(row => !row.winner).length
    }
  };
}

// The Combat section shows the acting combatant, so the console follows the fight instead of waiting for a press.
let refreshTimer = null;
// A redraw between pressing and releasing a button would swallow the click: it waits for the release.
let pointerHeld = false;
function holdWhilePressed() {
  if (holdWhilePressed.done || !globalThis.document?.addEventListener) return;
  holdWhilePressed.done = true;
  document.addEventListener("pointerdown", event => (pointerHeld = !!event.target?.closest?.(".gc-console-body")), {
    capture: true
  });
  document.addEventListener("pointerup", () => (pointerHeld = false), { capture: true });
  document.addEventListener("pointercancel", () => (pointerHeld = false), { capture: true });
}
function refreshSoon() {
  if (refreshTimer) return;
  holdWhilePressed();
  refreshTimer = setTimeout(function redraw() {
    if (pointerHeld) {
      refreshTimer = setTimeout(redraw, 120);
      return;
    }
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
  for (const hook of ["createCombat", "deleteCombat"]) Hooks.on(hook, refreshSoon);
  // Another scene's fight, run by another GC, does not redraw this console under the pointer.
  const viewed = fight => !game.combat || !fight || fight.id === game.combat.id;
  Hooks.on("updateCombat", fight => viewed(fight) && refreshSoon());
  for (const hook of ["createCombatant", "deleteCombatant", "updateCombatant"])
    Hooks.on(hook, combatant => viewed(combatant?.parent) && refreshSoon());
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
  // Beside the tracker it works with, so Chat keeps its usual place at the front.
  const after = tabs.findIndex(([name]) => name === "combat");
  tabs.splice(after < 0 ? tabs.length : after + 1, 0, [
    "gc",
    { tooltip: loc`GC Console`, icon: "fa-solid fa-user-secret", gmOnly: true }
  ]);
  Sidebar.TABS = Object.fromEntries(tabs);
}

/**
 * Open the console. By default it opens in its own window, so the chat log, where the cards are resolved, stays in
 * the sidebar beside it; the "GC Console in its own window" setting turns that off. The sidebar tab still works.
 */
export async function openGCConsole({ window: windowed = readSetting("gcConsoleWindow", true) } = {}) {
  if (!game.user.isGM) return refuse(loc`The GC Console is for the Game Control.`);
  const instance = ui.gc;
  game.spycraft2.gc.console = instance;
  if (windowed && typeof instance.renderPopout === "function") {
    const popout = (await instance.renderPopout()) ?? instance.popout;
    popout?.bringToFront?.();
    return popout ?? instance;
  }
  await instance.render({ force: true });
  instance.activate();
  return instance;
}
