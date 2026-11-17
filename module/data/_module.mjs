import { AgentData, NpcData, VehicleActorData } from "./actor.mjs";
import { ClassData, OriginData, FeatData, GearData, WeaponData, ArmorData, VehicleData } from "./item.mjs";

export const actor = { agent: AgentData, npc: NpcData, vehicle: VehicleActorData };
export const item = {
  class: ClassData,
  origin: OriginData,
  feat: FeatData,
  gear: GearData,
  weapon: WeaponData,
  armor: ArmorData,
  vehicle: VehicleData
};
