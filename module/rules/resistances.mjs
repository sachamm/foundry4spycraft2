import { loc } from "../i18n.mjs";
/** Armor codes p.225 and damage types pp.333–340. AC in Table 4.13 denotes the same acid type as AD. */
export const RESISTANCE_TYPES = {
  AD: "Acid",
  BN: "Bang",
  CD: "Cold",
  collision: "Collision",
  CN: "Contagion",
  EL: "Electrical",
  EX: "Explosive",
  FA: "Falling",
  FR: "Fire",
  FL: "Flash",
  HT: "Heat",
  LA: "Laser",
  sneakAttack: "Sneak attack",
  stress: "Stress",
  subdual: "Subdual",
  VC: "Vacuum"
};
const normalize = value =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ _-]+/g, " ");
export function resistanceType(value) {
  const n = normalize(value);
  if (n === "ac") return "AD";
  if (["electric", "electricity"].includes(n)) return "EL";
  return (
    Object.keys(RESISTANCE_TYPES).find(key => normalize(key) === n || normalize(RESISTANCE_TYPES[key]) === n) ?? null
  );
}
/** Repeated quality applications combine; p.446 forbids combining them with identical gear/class benefits. */
export function qualityResistances(system) {
  const out = {};
  for (const effect of system.originEffects ?? [])
    if (effect.qualityKey === "damageResistance" && Object.hasOwn(RESISTANCE_TYPES, effect.resistanceType))
      out[effect.resistanceType] = (out[effect.resistanceType] ?? 0) + 4;
  return out;
}

/** Read the actual prepared aggregate and its audit without adding nonstacking sources again. */
export function preparedResistanceSource(system, kind) {
  if (!Object.hasOwn(RESISTANCE_TYPES, kind)) throw new Error(loc`Choose a known prepared resistance type.`);
  const stats = system.survivalStats;
  if (!stats || !stats.resistances || typeof stats.resistances !== "object" || Array.isArray(stats.resistances))
    throw new Error(loc`Prepare the character’s current ${kind} resistance before applying it.`);
  const valid = value => value === "all" || (Number.isSafeInteger(value) && value >= 0),
    value = Object.hasOwn(stats.resistances, kind) ? stats.resistances[kind] : 0,
    armor = system.armor?.resistances?.[kind] ?? 0;
  if (!valid(value) || !valid(armor)) throw new Error(loc`Review the prepared ` + kind + " resistance.");
  const all = stats.resistanceSources ?? [];
  if (!Array.isArray(all)) throw new Error(loc`Review the resistance source details.`);
  const sources = all
    .filter(r => r.key === kind)
    .map(r => {
      if (typeof r.source !== "string" || !valid(r.value)) throw new Error(loc`Review the resistance source details.`);
      return { source: r.source, value: r.value };
    })
    .sort((a, b) => a.source.localeCompare(b.source) || String(a.value).localeCompare(String(b.value)));
  return { resistance: value, armorResistance: armor, sources };
}
