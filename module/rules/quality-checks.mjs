export const CAMOUFLAGE_TERRAINS = {
  aquatic: "Aquatic",
  arctic: "Arctic",
  desert: "Desert",
  forest: "Forest",
  jungle: "Jungle",
  mountain: "Mountain",
  plains: "Plains",
  swamp: "Swamp"
};
export function camouflageTerrain(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return Object.hasOwn(CAMOUFLAGE_TERRAINS, key) ? key : null;
}
/** Test Subject's selected Fearless/Strong-Minded grades and Seductive circumstances, pp.446–447,450–451. Not general saving-throw bonuses. */
export function qualitySkillChecks(
  system,
  key,
  check,
  { shiftingDisposition = false, seductionConflict = false, terrain = "" } = {}
) {
  const count = quality =>
      Math.min(5, (system.originEffects ?? []).filter(effect => effect.qualityKey === quality).length),
    bonuses = [],
    notes = [];
  const fearless = key === "resolve" && check.id === "morale" ? 4 * count("fearless") : 0;
  const strongMinded =
    (key === "resolve" && ["resist-impress", "resist-intimidate"].includes(check.id)) ||
    (key === "senseMotive" && check.id === "resist-manipulate")
      ? 4 * count("strongMinded")
      : 0;
  const seductive =
    (system.originEffects ?? []).some(effect => effect.qualityKey === "seductive") &&
    (shiftingDisposition === true || seductionConflict === true)
      ? 4
      : 0;
  const camouflaged =
    ((key === "blend" && check.id === "stealth") || (key === "sneak" && check.id === "hide")) &&
    (system.originEffects ?? []).some(
      effect => effect.qualityKey === "camouflaged" && effect.terrain && effect.terrain === terrain
    )
      ? 4
      : 0;
  for (const [source, value] of [
    ["Camouflaged", camouflaged],
    ["Fearless", fearless],
    ["Strong-Minded", strongMinded],
    ["Seductive", seductive]
  ])
    if (value) {
      bonuses.push({ source, value, type: "" });
      notes.push(
        `${source}: +${value} to this ${source === "Seductive" ? "declared disposition/seduction" : "named"} check.`
      );
    }
  return {
    bonuses,
    notes,
    fearless,
    strongMinded,
    seductive,
    camouflaged,
    terrain,
    shiftingDisposition: shiftingDisposition === true,
    seductionConflict: seductionConflict === true
  };
}
