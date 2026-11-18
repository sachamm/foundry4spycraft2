import { toolShedKitState } from "./tool-shed.mjs";
import { loc } from "../i18n.mjs";
/** Intruder Criminal Mind: Improvisation, p.38. Generated objects do not spend foresight reserves. */
export function hasImprovisation(system) {
  return (system.classOptionSelections ?? []).some(e => e.classId === "intruder" && e.name === "Improvisation");
}
export function improvisationPlan(
  system,
  {
    name = "",
    weight = 0,
    description = "",
    commonConfirmed = false,
    fullActionConfirmed = false,
    id = "",
    at = 0
  } = {}
) {
  if (!hasImprovisation(system)) throw new Error(loc`An earned Intruder Improvisation option is required.`);
  if (commonConfirmed !== true || fullActionConfirmed !== true)
    throw new Error(loc`Confirm this is a Common Item and spend the required full action.`);
  name = String(name).trim();
  weight = Number(weight);
  if (!name || !Number.isFinite(weight) || weight < 0)
    throw new Error(loc`Name the Common Item and enter its nonnegative weight in pounds.`);
  if (!/^[A-Za-z0-9_-]+$/.test(id) || system.classGearGrants?.[id])
    throw new Error(loc`A new unique grant identifier is required.`);
  const epoch = String(system.usagePeriods?.mission ?? "initial");
  return {
    id,
    epoch,
    name,
    weight,
    description: String(description),
    stamp: { id, epoch, source: "improvisation" },
    record: { epoch, source: "improvisation", name, at }
  };
}
export function managedClassGearGrant(system, item) {
  if (item?.system?.classGearGrant?.source === "toolShed") return toolShedKitState(system, item).valid;
  const ref = item?.system?.classGearGrant,
    record = system.classGearGrants?.[ref?.id],
    gear = item?.system;
  return (
    !!ref &&
    !!record &&
    record.source === "improvisation" &&
    ref.source === record.source &&
    ref.epoch === record.epoch &&
    record.itemId === item.id &&
    item.type === "gear" &&
    gear.common === true &&
    gear.caliber === 0 &&
    (gear.quantity ?? 1) <= 1 &&
    !gear.pick &&
    !gear.possessionSource &&
    !gear.reserveAcquisition &&
    !gear.reserve
  );
}
export function classGearWarnings(system, items) {
  const warnings = [],
    epoch = String(system.usagePeriods?.mission ?? "initial");
  for (const item of items.filter(i => i.system?.classGearGrant)) {
    const tool = toolShedKitState(system, item);
    if (tool.applicable) {
      if (tool.blockedReason) warnings.push(`${item.name}: ${tool.blockedReason}`);
      continue;
    }
    if (!managedClassGearGrant(system, item))
      warnings.push(
        loc`${item.name}: review its class-granted Common Item provenance and conflicting acquisition fields.`
      );
    if ((item.system.quantity ?? 1) > 1)
      warnings.push(loc`${item.name}: Improvisation grants one object; review its excess quantity.`);
    if (item.system.classGearGrant.epoch !== epoch)
      warnings.push(
        loc`${item.name}: improvised during an earlier mission; review its disposition before the next mission.`
      );
  }
  return warnings;
}
