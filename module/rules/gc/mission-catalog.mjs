import { campaignQuality } from "./campaign.mjs";
import { GC_DATA } from "../gc-tables.mjs";
export const missionCatalog = {
  quality: id => campaignQuality(id),
  security: () => null, // security XP depends on each device's Power Rating; the console stores it as an explicit entry
  gearRestriction: id => GC_DATA.tables.gearRestrictions.find(entry => entry.id === id) ?? null,
  exposure: id => {
    const found = GC_DATA.tables.exposure.find(entry => entry.id === id);
    return found ? { ...found, name: found.objective } : null;
  }
};
