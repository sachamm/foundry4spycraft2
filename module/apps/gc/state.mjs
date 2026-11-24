/** World state for the Game Control tools: the mission record, campaign qualities, scene state and Dramatic Conflicts. */
import { renderOpenSheet } from "../../services/refresh.mjs";
import { defaultMission, threatLevel, threatBonusActionDice, missionBaseXP } from "../../rules/gc/mission.mjs";
import { activeQualities, campaignEffects } from "../../rules/gc/campaign.mjs";
import { missionCatalog } from "./mission-defaults.mjs";
import { loc, locKey } from "../../i18n.mjs";

const SYSTEM = "spycraft2";
const refresh = () => {
  for (const actor of globalThis.game?.actors ?? []) {
    actor.reset();
    renderOpenSheet(actor);
  }
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) if (token.actor?.isToken) token.actor.reset();
  globalThis.game?.spycraft2?.gc?.console?.render(false);
};

/** Scene state and conflicts are shown only in the GC Console; no sheet and no derived number reads them. */
const refreshConsole = () => globalThis.game?.spycraft2?.gc?.console?.render(false);

export function registerGCSettings() {
  const hidden = (initial, onChange = refresh) => ({
    scope: "world",
    config: false,
    type: Object,
    default: initial,
    onChange
  });
  game.settings.register(SYSTEM, "mission", hidden(defaultMission()));
  game.settings.register(SYSTEM, "campaign", hidden({ qualities: [] }));
  game.settings.register(
    SYSTEM,
    "sceneState",
    hidden({ scene: null, dramatic: false, source: null, dcBoosts: 0 }, refreshConsole)
  );
  game.settings.register(SYSTEM, "conflicts", hidden({}, refreshConsole));
  // Which console sections this GC has opened or closed, kept in the browser rather than the world.
  game.settings.register(SYSTEM, "gcConsoleSections", { scope: "client", config: false, type: Object, default: {} });
  // The console view (Prep, Play or Wrap-up) this GC chose, with the state it was chosen in.
  game.settings.register(SYSTEM, "gcConsoleView", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(SYSTEM, "fluidInitiative", {
    name: locKey`Fluid initiative`,
    hint: locKey`Apply recorded Table 5.2 modifiers to Initiative Counts when each combat round ends (p.324).`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SYSTEM, "roundReminders", {
    name: locKey`Round reminders`,
    hint: locKey`Post a card with its button when a burning character's turn begins and, at the end of each round, for every dying character in the fight.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SYSTEM, "startFlatFooted", {
    name: locKey`Start combat flat-footed`,
    hint: locKey`Mark every combatant flat-footed when a combat begins (p.323). It clears by itself as each character’s turn begins or when the character is hit.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

const read = (key, fallback) => {
  try {
    return globalThis.game?.settings?.get(SYSTEM, key) ?? fallback;
  } catch {
    return fallback;
  }
};
export const requireGC = () => {
  if (!game.user?.isGM) throw new Error(loc`Only the GC can do this.`);
};

export const getMission = () => ({ ...defaultMission(), ...read("mission", {}) });
export async function setMission(mission) {
  requireGC();
  await game.settings.set(SYSTEM, "mission", { ...defaultMission(), ...mission });
  return getMission();
}
export const updateMission = change =>
  setMission({ ...getMission(), ...(typeof change === "function" ? change(getMission()) : change) });

/** The team: the mission's listed agents, or every player-owned agent when none are listed. */
export function teamActors(mission = getMission()) {
  const actors = [...(game.actors ?? [])].filter(actor => actor.type === "agent");
  const listed = (mission.team ?? []).map(id => actors.find(actor => actor.id === id)).filter(Boolean);
  return listed.length ? listed : actors.filter(actor => actor.hasPlayerOwner);
}
export const teamLevels = mission =>
  teamActors(mission)
    .map(actor => actor.system.level)
    .filter(level => Number.isSafeInteger(level) && level > 0);

/** The mission's Threat Level, or null when no mission is active (NPCs then keep their own setting). */
export function missionThreatLevel() {
  const mission = read("mission", null);
  if (!mission?.active) return null;
  if (Number.isSafeInteger(mission.threatLevel) && mission.threatLevel >= 1 && mission.threatLevel <= 20)
    return mission.threatLevel;
  return null;
}

/** Recalculate and store the Threat Level from the current team (done at mission start, p.423). */
export async function fixThreatLevel() {
  const mission = getMission(),
    levels = teamLevels(mission),
    tl = threatLevel(mission, levels);
  await setMission({ ...mission, threatLevel: tl.value, threatBase: tl.base, teamLevels: levels });
  return { ...tl, bonusDice: threatBonusActionDice(tl.value, levels) };
}

export const getCampaign = () => ({ qualities: [], ...read("campaign", {}) });
export async function setCampaign(campaign) {
  requireGC();
  await game.settings.set(SYSTEM, "campaign", campaign);
}
export const qualitiesInForce = () =>
  activeQualities(getCampaign().qualities, getMission().active ? getMission().qualities : []);
export const currentCampaignEffects = () => campaignEffects(qualitiesInForce());

/** Mission XP including season-long campaign qualities (which modify every mission of the season, p.435). */
export function missionXP({ planned = false } = {}) {
  const mission = getMission(),
    season = getCampaign().qualities.map(id => ({ id: typeof id === "string" ? id : id.id, scripted: true }));
  return missionBaseXP({ ...mission, qualities: [...season, ...(mission.qualities ?? [])] }, missionCatalog, {
    planned
  });
}

/** Scene state follows the system's scene usage period: a new scene is standard until made dramatic. */
export const sceneEpoch = () => String(read("usagePeriods", {})?.scene ?? "initial");
export function getSceneState() {
  const saved = read("sceneState", {}),
    scene = sceneEpoch();
  return saved?.scene === scene
    ? { dramatic: false, source: null, dcBoosts: 0, ...saved }
    : { scene, dramatic: false, source: null, dcBoosts: 0 };
}
export async function setSceneState(change) {
  requireGC();
  await game.settings.set(SYSTEM, "sceneState", { ...getSceneState(), ...change, scene: sceneEpoch() });
  return getSceneState();
}
export const isDramaticScene = () => getSceneState().dramatic === true;

export const getConflicts = () => ({ ...read("conflicts", {}) });
export async function saveConflict(id, conflict) {
  requireGC();
  const all = getConflicts();
  if (conflict === null) delete all[id];
  else all[id] = conflict;
  // Replace the whole object so removed keys do not linger in the stored setting.
  await game.settings.set(SYSTEM, "conflicts", all);
  return conflict;
}
