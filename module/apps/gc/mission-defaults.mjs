/** Defaults the mission record offers to the per-agent XP settlement dialog (p.440). No Foundry imports, so the actor document can load it in tests. */
import { missionBaseXP } from "../../rules/gc/mission.mjs";
import { campaignQuality } from "../../rules/gc/campaign.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
export { reviewCrossroadsMissionXP, reviewCrossroadsSession, crossroadsXPContext } from "../crossroads-xp.mjs";

export const missionCatalog = {
  quality: id => campaignQuality(id),
  security: () => null, // security XP depends on each device's Power Rating; the console stores it as an explicit entry
  gearRestriction: id => GC_DATA.tables.gearRestrictions.find(entry => entry.id === id) ?? null,
  exposure: id => {
    const found = GC_DATA.tables.exposure.find(entry => entry.id === id);
    return found ? { ...found, name: found.objective } : null;
  }
};

export function missionSettlementDefaults() {
  try {
    const mission = globalThis.game?.settings?.get("spycraft2", "mission");
    // An ended mission still settles: its record is kept until the next one starts.
    if (!mission?.active && !mission?.ended) return { baseXP: 0, threatLevel: null };
    const season = (globalThis.game.settings.get("spycraft2", "campaign")?.qualities ?? []).map(id => ({
      id,
      scripted: true
    }));
    const xp = missionBaseXP({ ...mission, qualities: [...season, ...(mission.qualities ?? [])] }, missionCatalog);
    return { baseXP: xp.total, threatLevel: Number.isSafeInteger(mission.threatLevel) ? mission.threatLevel : null };
  } catch {
    return { baseXP: 0, threatLevel: null };
  }
}
