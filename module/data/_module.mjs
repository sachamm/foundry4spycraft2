import { AgentData, NpcData } from "./actor.mjs";
import { ClassData, OriginData, FeatData, GearData, WeaponData, ArmorData } from "./item.mjs";

export const actor = { agent: AgentData, npc: NpcData };
export const item = {
  class: ClassData,
  origin: OriginData,
  feat: FeatData,
  gear: GearData,
  weapon: WeaponData,
  armor: ArmorData
};
