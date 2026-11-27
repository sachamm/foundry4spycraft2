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

/** Whether an agent's card shows a Triumph since this mission run began (p.331), for the settlement's default. */
function missionTriumph(mission) {
  if (!Number.isFinite(mission?.startedAt)) return false;
  return [...(globalThis.game?.messages ?? [])].some(message => {
    const check = message.flags?.spycraft2;
    if (!check?.triumphed || check.superseded || (message.timestamp ?? 0) < mission.startedAt) return false;
    const actor = globalThis.game?.actors?.get?.(message.speaker?.actor);
    return actor?.type === "agent";
  });
}

export function missionSettlementDefaults() {
  try {
    const mission = globalThis.game?.settings?.get("spycraft2", "mission");
    // An ended mission still settles: its record is kept until the next one starts.
    if (!mission?.active && !mission?.ended) return { baseXP: 0, threatLevel: null, triumph: false };
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
