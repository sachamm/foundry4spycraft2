import { loc } from "../i18n.mjs";
const epoch = (s, key) => String(s.usagePeriods?.[key] ?? "initial");
const text = (value, max = 200) => typeof value === "string" && !!value.trim() && value.length <= max;
const idValid = id => typeof id === "string" && /^house_[A-Za-z0-9_-]+$/.test(id);
export function safeHouseSource(system) {
  if (!system.activeFeatNames?.includes("Safe House")) return null;
  const lifestyle = system.wealth?.lifestyle?.rank,
    limit = (system.activeFeatSelections ?? []).filter(f => f.tree === "tradecraft").length;
  return Number.isSafeInteger(lifestyle) && lifestyle >= 3 && lifestyle <= 10 && limit > 0
    ? { limit, lifestyle, houseRank: lifestyle - 2, mission: epoch(system, "mission"), scene: epoch(system, "scene") }
    : null;
}
/** p.209: declaration facts; the GC supplies the exact location in the following placement step. */
export function safeHouseDeclarationPlan(
  system,
  { atSceneStartConfirmed = false, locationConfirmed = false, currentLocation = "", population } = {}
) {
  const source = safeHouseSource(system);
  if (!source)
    throw new Error(loc`An active Safe House feat, Lifestyle 3+ and an active Tradecraft selection are required.`);
  if (atSceneStartConfirmed !== true || locationConfirmed !== true)
    throw new Error(
      loc`Confirm this is the scene-opening declaration and the GC-confirmed current location and population.`
    );
  if (!text(currentLocation) || !Number.isSafeInteger(population) || population < 0)
    throw new Error(loc`Record the current location and its whole-number city population (0 outside a city).`);
  const records = Object.entries(system.safeHouses ?? {}),
    current = records.filter(([, r]) => r?.epoch === source.mission);
  if (records.some(([, r]) => !r || typeof r.epoch !== "string"))
    throw new Error(loc`The GC must correct the unknown Safe House history before another declaration.`);
  if (current.length >= source.limit)
    throw new Error(loc`All Safe House declarations available this mission are already recorded.`);
  if (current.some(([, r]) => r.scene === source.scene))
    throw new Error(loc`A Safe House was already declared at this scene’s start.`);
  return {
    source,
    record: {
      version: 1,
      source: "Safe House",
      epoch: source.mission,
      scene: source.scene,
      lifestyle: source.lifestyle,
      houseRank: source.houseRank,
      limitAtGrant: source.limit,
      currentLocation: currentLocation.trim(),
      population,
      route: population >= 10000 ? "withinTenMiles" : "nearestCity",
      atSceneStartConfirmed: true,
      locationConfirmed: true,
      placement: null
    }
  };
}
export function safeHouseGrant(plan, { id, missionUse, sceneUse, at = 0 } = {}) {
  if (
    !idValid(id) ||
    missionUse?.epoch !== plan.source.mission ||
    !Number.isSafeInteger(missionUse.used) ||
    missionUse.used < 1 ||
    missionUse.used > plan.source.limit ||
    sceneUse?.epoch !== plan.source.scene ||
    sceneUse.used !== 1
  )
    throw new Error(loc`The Safe House declaration has no valid reserved mission and scene use.`);
  return {
    id,
    ...structuredClone(plan.record),
    missionUse: structuredClone(missionUse),
    sceneUse: structuredClone(sceneUse),
    at
  };
}
export function safeHouseState(system, record, cfg) {
  const r = record,
    home = cfg?.tables?.lifestyle?.[r?.houseRank - 1]?.home;
  const valid =
    !!r &&
    r.version === 1 &&
    r.source === "Safe House" &&
    idValid(r.id) &&
    typeof r.epoch === "string" &&
    typeof r.scene === "string" &&
    Number.isSafeInteger(r.lifestyle) &&
    r.lifestyle >= 3 &&
    r.lifestyle <= 10 &&
    r.houseRank === r.lifestyle - 2 &&
    !!home &&
    Number.isSafeInteger(r.limitAtGrant) &&
    r.limitAtGrant >= 1 &&
    text(r.currentLocation) &&
    Number.isSafeInteger(r.population) &&
    r.population >= 0 &&
    r.route === (r.population >= 10000 ? "withinTenMiles" : "nearestCity") &&
    r.atSceneStartConfirmed === true &&
    r.locationConfirmed === true &&
    r.missionUse?.epoch === r.epoch &&
    Number.isSafeInteger(r.missionUse.used) &&
    r.missionUse.used >= 1 &&
    r.missionUse.used <= r.limitAtGrant &&
    r.sceneUse?.epoch === r.scene &&
    r.sceneUse.used === 1;
  let placementValid = true;
  if (valid && r.placement) {
    try {
      safeHousePlacementPlan(system, r, r.placement, { allowExpired: true });
    } catch {
      placementValid = false;
    }
  }
  const expired = valid && r.epoch !== epoch(system, "mission");
  return {
    baseValid: valid,
    canPlace: valid && !expired,
    valid: valid && placementValid,
    expired,
    active: valid && placementValid && !expired,
    home: home ?? "",
    rank: r?.houseRank ?? null,
    placed: !!r?.placement && placementValid,
    reason:
      !valid || !placementValid
        ? loc`Review this Safe House declaration and its saved use/location history.`
        : expired
          ? loc`Lost at the end of its mission.`
          : ""
  };
}
export function safeHousePlacementPlan(
  system,
  record,
  {
    city = "",
    cityPopulation,
    address = "",
    description = "",
    gcConfirmed = false,
    natureConfirmed = false,
    currentCityConfirmed = false,
    withinTenMilesConfirmed = false,
    nearestCityConfirmed = false
  } = {},
  { allowExpired = false } = {}
) {
  if (
    !record ||
    record.source !== "Safe House" ||
    !idValid(record.id) ||
    !["withinTenMiles", "nearestCity"].includes(record.route)
  )
    throw new Error(loc`Choose a recorded Safe House declaration.`);
  if (!allowExpired && record.epoch !== epoch(system, "mission"))
    throw new Error(loc`This Safe House was lost at the end of its mission.`);
  if (
    gcConfirmed !== true ||
    natureConfirmed !== true ||
    !text(city) ||
    !text(address, 1000) ||
    !text(description, 1000) ||
    !Number.isSafeInteger(cityPopulation) ||
    cityPopulation < 10000
  )
    throw new Error(
      loc`The GC must confirm the city of at least 10,000, exact location, and home description matching its Lifestyle tier.`
    );
  if (record.route === "withinTenMiles" && (currentCityConfirmed !== true || withinTenMilesConfirmed !== true))
    throw new Error(loc`This house must be in the declaration’s current city and within 10 miles.`);
  if (record.route === "nearestCity" && nearestCityConfirmed !== true)
    throw new Error(loc`The GC must choose the nearest city with at least 10,000 people.`);
  return {
    city: city.trim(),
    cityPopulation,
    address: address.trim(),
    description: description.trim(),
    gcConfirmed: true,
    natureConfirmed: true,
    currentCityConfirmed: record.route === "withinTenMiles",
    withinTenMilesConfirmed: record.route === "withinTenMiles",
    nearestCityConfirmed: record.route === "nearestCity"
  };
}
export function safeHouseRows(system, cfg) {
  return Object.entries(system.safeHouses ?? {}).map(([key, record]) => ({
    key,
    record,
    state:
      record?.id === key
        ? safeHouseState(system, record, cfg)
        : { valid: false, active: false, canPlace: false, reason: loc`Review the Safe House declaration identifier.` }
  }));
}
