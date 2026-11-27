/**
 * What the GC Console shows in each state, as pure functions of plain data: the view, the sections each view holds,
 * which sections start open, the first-session steps and the one filled button. No Foundry needed, so the console
 * snapshot tool (tools/ui-lab/render-gc-console.mjs) and the tests use them as the console does.
 */
import { loc } from "../../i18n.mjs";

export const VIEWS = ["prep", "play", "wrap"];

/** The view in use: the GC's choice for the current state, or the one that state calls for. */
export function consoleView(state, stored = null, key = null) {
  if (stored && stored.state === state && (stored.key ?? null) === key && VIEWS.includes(stored.view))
    return stored.view;
  return state === "planning" ? "prep" : state === "ended" ? "wrap" : "play";
}

/** Which sections each view shows. A search looks through all of them. */
export const VIEW_SECTIONS = {
  prep: ["mission", "objectives", "antagonists", "complications", "organizations", "campaign", "reference"],
  play: ["combat", "dice", "objectives", "antagonists", "conflicts", "clock", "reference"],
  // The Wrap-up panel holds the mission's end steps, so the Mission section stays in Prep.
  wrap: ["objectives", "antagonists", "campaign"]
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
      action: "editMission",
      button: loc`Edit mission…`
    },
    {
      id: "objectives",
      label: loc`Add at least one objective`,
      done: (mission.objectives ?? []).length > 0,
      action: "addObjective",
      button: loc`Add objective…`
    },
    {
      id: "npcs",
      label: loc`Prepare the opposition: make an NPC and place it`,
      done: npcActors > 0,
      action: "addNpcToScene",
      button: loc`Add NPC to scene…`
    },
    {
      id: "start",
      label: loc`Start mission (fixes the Threat Level)`,
      done: !!mission.active || !!mission.ended,
      action: "startMission",
      button: loc`Start mission`
    },
    {
      id: "session",
      label: loc`Begin session (GC dice and starting action dice)`,
      done: !!diceCurrent,
      action: "beginSession",
      button: loc`Begin session`
    },
    {
      id: "combat",
      label: loc`First combat: select the tokens, start a fight here, roll Initiative`,
      done: !!combatSeen,
      action: "consoleView",
      button: loc`Go to Play`,
      view: "play"
    }
  ];
  const next = steps.find(step => !step.done);
  return {
    steps: steps.map(step => ({ ...step, next: step === next })),
    done: steps.filter(step => step.done).length,
    total: steps.length,
    complete: !next,
    // The Mission section's own Start mission button steps aside while the list offers it.
    startIsNext: next?.id === "start"
  };
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
    organizations: "always",
    campaign: "always",
    reference: "always"
  };
  const defaults = {
    clock: false,
    mission: !missionActive,
    // During a fight the objectives close, so the dice and the conflicts sit closer to the turn.
    objectives: missionActive && !combat,
    antagonists: false,
    complications: false,
    // During a fight the turn bar holds Spend GC dice, so the dice section closes; between fights Combat stays open,
    // so Start a fight is one press away.
    dice: missionActive && !combat,
    combat: !!combat || missionActive,
    conflicts: conflictsRunning,
    organizations: false,
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

/**
 * The one filled button a view shows: the step the GC most likely takes next in that view and state.
 * @returns {string} the button's data-action (a checklist step uses "checklist")
 */
export function primaryAction({ view, checklistShown, missionActive, missionEnded, diceCurrent, combat }) {
  if (combat?.started) return "nextTurn";
  if (view === "prep")
    return checklistShown
      ? "checklist"
      : missionActive
        ? "editMission"
        : missionEnded
          ? "planNextMission"
          : "startMission";
  if (view === "wrap") return missionActive ? "endMission" : "missionReport";
  if (combat) return combat.unrolled ? "groupInitiative" : "nextTurn";
  // Between fights a session moves scene by scene; the dice are spent from the turn bar or the dice section.
  return diceCurrent ? "nextScene" : "beginSession";
}
