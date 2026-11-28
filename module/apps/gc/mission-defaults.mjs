/** Defaults the mission record offers to the per-agent XP settlement dialog (p.440). No Foundry imports, so the actor document can load it in tests. */
import { missionBaseXP } from "../../rules/gc/mission.mjs";
import { campaignQuality } from "../../rules/gc/campaign.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";

export const missionCatalog = {
  quality: id => campaignQuality(id),
  security: () => null, // security XP depends on each device's Power Rating; the console stores it as an explicit entry
  gearRestriction: id => GC_DATA.tables.gearRestrictions.find(entry => entry.id === id) ?? null,
  exposure: id => {
    const found = GC_DATA.tables.exposure.find(entry => entry.id === id);
    return found ? { ...found, name: found.objective } : null;
  }
};

/** The mission's team, as teamActors() in state.mjs reads it: the listed agents, or else every player's agent. */
function missionTeamIds(mission) {
  const agents = [...(globalThis.game?.actors ?? [])].filter(actor => actor.type === "agent"),
    listed = (mission.team ?? []).filter(id => agents.some(actor => actor.id === id));
  return new Set(listed.length ? listed : agents.filter(actor => actor.hasPlayerOwner).map(actor => actor.id));
}

/** Whether a card is a team agent's Triumph since this mission run began (p.331). */
export function teamTriumph(message, mission, team = missionTeamIds(mission)) {
  const check = message?.flags?.spycraft2;
  if (!Number.isFinite(mission?.startedAt)) return false;
  if (!check?.triumphed || check.superseded || (message.timestamp ?? 0) < mission.startedAt) return false;
  const actor = globalThis.game?.actors?.get?.(message.speaker?.actor);
  return actor?.type === "agent" && team.has(actor.id);
}

/**
 * Whether the team has a Triumph this mission run, for the settlement's default. The GC's client records the first
 * on the mission (triumphMessageId), so a player settling sees one made on a whispered or blind card too; a card
 * this client can read is checked again, since an Undo or a reroll can take a Triumph back.
 */
function missionTriumph(mission) {
  if (!Number.isFinite(mission?.startedAt)) return false;
  const team = missionTeamIds(mission),
    messages = globalThis.game?.messages;
  if (mission.triumphMessageId) {
    const recorded = messages?.get?.(mission.triumphMessageId);
    if (!recorded || teamTriumph(recorded, mission, team)) return true;
  }
  return [...(messages ?? [])].some(message => teamTriumph(message, mission, team));
}

export function missionSettlementDefaults() {
  try {
    const mission = globalThis.game?.settings?.get("spycraft2", "mission");
    // An ended mission still settles: its record is kept until the next one starts.
    if (!mission?.active && !mission?.ended) return { baseXP: 0, threatLevel: null, triumph: false };
    // An ended mission settles on the figures it had when it ended.
    const kept = mission.ended ? mission.settlementFigures : null;
    if (kept && Number.isSafeInteger(kept.baseXP))
      return {
        baseXP: kept.baseXP,
        threatLevel: Number.isSafeInteger(kept.threatLevel) ? kept.threatLevel : null,
        triumph: kept.triumph === true
      };
    const season = (globalThis.game.settings.get("spycraft2", "campaign")?.qualities ?? []).map(id => ({
      id,
      scripted: true
    }));
    const xp = missionBaseXP({ ...mission, qualities: [...season, ...(mission.qualities ?? [])] }, missionCatalog);
    return {
      baseXP: xp.total,
      threatLevel: Number.isSafeInteger(mission.threatLevel) ? mission.threatLevel : null,
      triumph: missionTriumph(mission)
    };
  } catch {
    return { baseXP: 0, threatLevel: null, triumph: false };
  }
}
