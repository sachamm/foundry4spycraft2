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
 * Search phrases for the tools another view holds, each with a line naming that view: a search only looks through
 * the sections on screen, so a miss says where to look instead of "no matching tools".
 */
export function searchOtherViews(view) {
  const here = new Set(VIEW_SECTIONS[view] ?? []);
  const away = [
    ["mission", loc`mission caliber threat level team start mission`, loc`Mission tools are in the Prep view.`],
    ["complications", loc`complication complications`, loc`Complications are in the Prep view.`],
    ["organizations", loc`organization organizations faction`, loc`Organizations are in the Prep view.`],
    ["campaign", loc`campaign quality qualities season`, loc`Campaign tools are in the Prep and Wrap-up views.`],
    ["combat", loc`combat fight initiative turn round surprise`, loc`Combat tools are in the Play view.`],
    ["dice", loc`action dice die spend`, loc`The GC's action dice are in the Play view.`],
    ["conflicts", loc`chase conflict dramatic conflicts`, loc`Dramatic Conflicts are in the Play view.`],
    ["clock", loc`clock time hour day`, loc`The clock is in the Play view.`]
  ];
  const lines = Object.fromEntries(
    away.filter(([section]) => !here.has(section)).map(([, words, line]) => [words, line])
  );
  if (view !== "wrap") lines[loc`end mission xp report wrap up`] = loc`Ending the mission is in the Wrap-up view.`;
  return lines;
}

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
      label: loc`First combat: in Play, select the tokens, start a fight, roll Initiative`,
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
    // The done steps by their short names, so the count in the heading says which ones.
    doneNames: steps
      .filter(step => step.done)
      .map(step => step.label.split(/[:(]/)[0].trim())
      .join(", "),
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
export function primaryAction({
  view,
  checklistShown,
  missionActive,
  missionEnded,
  diceCurrent,
  combat,
  settled = false
}) {
  if (combat?.started) return "nextTurn";
  if (view === "prep")
    return checklistShown
      ? "checklist"
      : missionActive
        ? "editMission"
        : missionEnded
          ? "planNextMission"
          : "startMission";
  // Once the mission has ended and every agent's standing is paid, what is left is the next mission.
  if (view === "wrap")
    return missionActive ? "endMission" : missionEnded && settled ? "planNextMission" : "missionReport";
  if (combat) return combat.unrolled ? "groupInitiative" : "nextTurn";
  // Between fights a session moves scene by scene; the dice are spent from the turn bar or the dice section.
  return diceCurrent ? "nextScene" : "beginSession";
}

/**
 * Effects the system only reminds the GC of: a call at the table, a subplot, a return from death, or a feat tree the
 * sheets do not grant. Every other campaign effect is applied by the rolls, sheets or dice themselves.
 */
const BY_HAND = new Set([
  "goodAndEvil",
  "revolvingDoor",
  "catchPhrase",
  "noCrossroads",
  "debtSubplot",
  "subplotLimitBonus",
  "bonusFeatTree",
  "gearRules"
]);

/** How a campaign quality is handled: "auto", "partly" (some of it by hand) or "hand". */
export function qualityHandling(quality) {
  const keys = Object.keys(quality?.effects ?? {});
  const hand = keys.filter(key => BY_HAND.has(key)).length;
  return !keys.length || hand === keys.length ? "hand" : hand ? "partly" : "auto";
}

/** An effect's internal key as words for a GC ("gearCaliberShift" reads "gear Caliber shift"). */
export const effectLabel = key =>
  String(key ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\bcaliber\b/g, "Caliber")
    .replace(/\bxp\b/g, "XP")
    .replace(/\bcqb\b/g, "CQB");

/**
 * One line on what each console button changes, for the buttons whose template gives none (style guide: a tooltip
 * says what the control does, never repeats its label). Read when the console draws, so the words are translated.
 */
export const consoleButtonTips = () => ({
  surprise: loc`Marks a surprise round for the side that won the opposed check; only its members act in it`,
  fluidEvent: loc`Records something that moves a Count: now for Delay, Press and Ready, at the round's end for the rest`,
  combatReference: loc`Opens the action, modifier and cover tables; changes nothing`,
  addNpcToScene: loc`Places numbered copies of an NPC on the map, and can add them to the fight and the antagonist list`,
  recordInfraction: loc`Adds exposure to the agents who were seen or caught; each row has an Undo`,
  awardStanding: loc`Pays the mission's Reputation or Net Worth to each agent once; leaves an Undo note`,
  refitDice: loc`Sets the GC's pool to what this mission's Caliber and the players present give`,
  dramaticOff: loc`Ends the dramatic scene: GC dice stop exploding on a 1; Counts already doubled stay`,
  doubleInitiative: loc`Doubles the Count of each opponent not yet doubled in this fight, to 50 at most`,
  dramaticOn: loc`Opens the choice of a scripted or a paid dramatic scene, with the Counts that will double`,
  clockStep: loc`Moves the game clock by this much; timers and timed effects follow`,
  clockAdvance: loc`Moves the game clock by an amount you type`,
  clockDate: loc`Sets the game clock's date and time outright`,
  clockOpen: loc`Opens the clock's own window with its timers`,
  editMission: loc`Opens the mission record: name, Caliber, team, Threat Level adjustment and XP extras`,
  sceneAdvance: loc`Corrects the number of scenes counted toward XP; Next scene keeps it otherwise`,
  "missionReport:false": loc`Posts what the mission has earned so far, with each part of the sum`,
  "missionReport:true": loc`Posts what the mission would pay if every objective were met`,
  recalculateTL: loc`Works the Threat Level out again from the team's levels as they are now`,
  clearMission: loc`Empties the mission record; the agents keep what they were paid`,
  caliberIncrease: loc`Raises the mission's Caliber by one: more reserves for the team and 2 more GC dice; leaves an Undo note`,
  sessionDice: loc`Adds the Threat Level and campaign-quality changes to each agent's starting dice, once a session`,
  addObjective: loc`Adds an objective with its grade; critical ones cost exposure if left undone`,
  pasteObjectives: loc`Adds several objectives at once, one per line`,
  quickObjective: loc`Adds the objective typed in the field beside it`,
  addComplication: loc`Adds a complication or event to the mission; it counts toward XP at once`,
  startConflict: loc`Starts a Dramatic Conflict (chase, infiltration and the rest) and tracks its Lead`,
  seasonQualities: loc`Chooses the campaign qualities in force all season; the rules that read them follow at once`,
  securityDevice: loc`Rolls up a lock, sensor or other device and posts its DCs`,
  hazards: loc`Applies fire, falling, poison and other hazards to a character`,
  events: loc`Rolls or picks a mission event and posts it to the GC`,
  possessions: loc`Rolls what an NPC is carrying`,
  npcKnowledge: loc`Looks up what an NPC of a given kind knows on a subject`,
  openControls: loc`Opens Foundry's key bindings, where the console's shortcuts can be changed`
});

/** Give each console button without help of its own its one line; a button the template wrote help for is left. */
export function applyConsoleButtonTips(root, tips = consoleButtonTips()) {
  for (const button of root?.querySelectorAll?.("button[data-action]") ?? []) {
    if (button.hasAttribute("data-tooltip") && !button.hasAttribute("data-sc2-tip-generated")) continue;
    const action = button.dataset.action,
      tip = tips[`${action}:${button.dataset.planned}`] ?? tips[action];
    if (!tip) continue;
    button.setAttribute("data-tooltip", tip);
    button.removeAttribute("data-sc2-tip-generated");
  }
}
