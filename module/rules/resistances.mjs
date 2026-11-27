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
  for (const entry of system.qualityEffects?.resistances ?? []) {
    const key = resistanceType(entry.type);
    if (key && Number.isSafeInteger(entry.value) && entry.value > 0)
      out[key] = Math.min(8, (out[key] ?? 0) + entry.value);
  }
  return out;
}

/** Unclassified custom types and excess applications need GC review instead of invisible protection. */
export function qualityResistanceReview(system) {
  const entries = system.qualityEffects?.resistances ?? [],
    warnings = [];
  if (entries.some(row => !resistanceType(row.type)))
    warnings.push(
      loc`NPC damage resistance: choose a recognized damage type or adjudicate the custom protection with the GC.`
    );
  if (entries.reduce((total, row) => total + row.value, 0) > 8)
    warnings.push(
      loc`NPC damage resistance exceeds eight quality applications; review this build with the GC (p.447).`
    );
  return warnings;
}

/** Keep the prepared resistance used by a pending damage save, independent of later gear changes. */
export function damageResistanceSource(system, type) {
  const key = resistanceType(type);
  if (!key) throw new Error(loc`Choose a known damage-resistance type.`);
  return { version: 1, key, ...preparedResistanceSource(system, key) };
}

/** p.333: subtract resistance after DR; reducing damage to zero also prevents its accompanying effects. */
export function damageResistancePlan(system, type, damage, source = damageResistanceSource(system, type)) {
  const valid = value => value === "all" || (Number.isSafeInteger(value) && value >= 0);
  if (
    !Number.isSafeInteger(damage) ||
    damage < 0 ||
    source?.version !== 1 ||
    source.key !== resistanceType(type) ||
    !valid(source.resistance) ||
    !valid(source.armorResistance) ||
    !Array.isArray(source.sources) ||
    source.sources.some(row => !row || typeof row.source !== "string" || !valid(row.value))
  )
    throw new Error(loc`Review the original damage and prepared resistance before applying it.`);
  const net = source.resistance === "all" ? 0 : Math.max(0, damage - source.resistance);
  return {
    damage,
    net,
    resisted: damage - net,
    source: structuredClone(source),
    negatesEffects: net === 0 && (source.resistance === "all" || (damage > 0 && source.resistance > 0))
  };
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
