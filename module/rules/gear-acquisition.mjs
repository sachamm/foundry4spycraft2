import { gearCheckPlan } from "./gear-checks.mjs";
import { shakenActionDieCost } from "./shaken.mjs";
import {
  priorityRequestBonus,
  localHeroRequestBonus,
  requestBenefitContext,
  ORIGIN_RESOURCE_PICKS
} from "./requests.mjs";
import { resourceUsePlan } from "./limited-uses.mjs";
import { managedClassGearGrant } from "./class-gear.mjs";
import { loc } from "../i18n.mjs";
import { campaignAffiliationProblem } from "./campaign-affiliation.mjs";
/** Mission reserves and field acquisition, pp.219–220. */
export const PICK_CATEGORIES = ["R", "T", "V", "S", "G", "W", "E", "CHA"];
/** Delivery for a Request that is immediately available (Political Clout, Favors and Immunity). */
export const IMMEDIATE_DELIVERY = Object.freeze({
  formula: "0",
  unit: "minutes",
  get label() {
    return loc`Immediately available`;
  }
});
export const DELIVERY = {
  largeCity: {
    formula: "3d20",
    unit: "minutes",
    get label() {
      return loc`City, 10,000+ people`;
    }
  },
  smallCity: {
    formula: "1d6",
    unit: "hours",
    get label() {
      return loc`City, fewer than 10,000 people`;
    }
  },
  nearCity: {
    formula: "2d6",
    unit: "hours",
    get label() {
      return loc`Within 100 miles of a city`;
    }
  },
  remote: {
    formula: "3d6",
    unit: "hours",
    get label() {
      return loc`101–500 miles from a city`;
    }
  },
  isolated: {
    formula: "4d6",
    unit: "hours",
    get label() {
      return loc`501+ miles from a city`;
    }
  }
};
export const hasProcure = system =>
  (system.classOptionSelections ?? []).some(e => e.classId === "intruder" && e.name === "Procure");
export const missionEpoch = system => String(system.usagePeriods?.mission ?? "initial");
export function currentReserves(system) {
  return system.missionReserves?.epoch === missionEpoch(system) ? system.missionReserves : null;
}
/** A free Stash attempt needs a durable claim ledger but does not allocate mission resources. */
export function provisionalReserves(system, initializationSource = "personalStash") {
  const caliber =
    Number.isSafeInteger(system.missionCaliber) && system.missionCaliber >= 1 && system.missionCaliber <= 5
      ? system.missionCaliber
      : 1;
  return {
    epoch: missionEpoch(system),
    initialized: false,
    initializationSource,
    caliber,
    procureAtIntel: false,
    picks: Object.fromEntries(PICK_CATEGORIES.map(k => [k, 0])),
    spent: Object.fromEntries(PICK_CATEGORIES.map(k => [k, 0])),
    charismaPicks: Object.fromEntries(PICK_CATEGORIES.filter(k => k !== "CHA").map(k => [k, 0])),
    common: 0,
    spentCommon: 0,
    attempts: {}
  };
}
function validateProvisionalReserves(record) {
  const zeroMap = value =>
    value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(n => n === 0);
  if (
    !["personalStash", "originFreePick"].includes(record.initializationSource) ||
    record.common !== 0 ||
    record.spentCommon !== 0 ||
    !["picks", "spent", "charismaPicks"].every(k => zeroMap(record[k])) ||
    !record.attempts ||
    typeof record.attempts !== "object" ||
    Array.isArray(record.attempts) ||
    Object.entries(record.attempts).some(
      ([id, a]) =>
        !a ||
        a.id !== id ||
        a.epoch !== record.epoch ||
        !(
          (a.kind === "common" && a.gearAbility === "personalStash" && a.commonCost === 0 && a.cost === 0) ||
          (a.kind === "request" &&
            a.freePick === true &&
            a.automatic === true &&
            a.category === "R" &&
            a.pick === "" &&
            a.caliber === 2 &&
            ORIGIN_RESOURCE_PICKS[a.requestAbility]?.resource === a.originResource &&
            a.baseCost === 0 &&
            Number.isSafeInteger(a.cost) &&
            a.cost >= 0 &&
            a.cost === a.surcharge)
        )
    )
  )
    throw new Error(loc`Review the provisional free-acquisition ledger before allocating or using mission resources.`);
}
export function reserveAllocations(system) {
  const record = currentReserves(system);
  return Object.fromEntries(
    PICK_CATEGORIES.map(key => [key, record ? (record.picks?.[key] ?? 0) + (record.spent?.[key] ?? 0) : 0])
  );
}
export function reserveInitialization(
  system,
  items,
  { picks = {}, charismaPicks = {}, common = 0, caliber = 1, intelComplete = false, procureAtIntel = false } = {}
) {
  const affiliationProblem = campaignAffiliationProblem(system, system.campaignEffects);
  if (affiliationProblem) throw new Error(affiliationProblem);
  const provisional = currentReserves(system);
  if (provisional && provisional.initialized !== false)
    throw new Error(
      loc`Reserves have already been set for this mission. Start a new mission before allocating them again.`
    );
  if (provisional) validateProvisionalReserves(provisional);
  if (!intelComplete) throw new Error(loc`Choose reserves at the end of the Intel Phase.`);
  if (!Number.isSafeInteger(caliber) || caliber < 1 || caliber > 5) throw new Error(loc`Mission Caliber must be I–V.`);
  if (items.some(i => ["weapon", "armor", "gear"].includes(i.type) && i.system.reserve))
    throw new Error(loc`Review legacy reserved-item checkboxes before allocating unassigned reserves.`);
  const selected = {};
  for (const key of PICK_CATEGORIES) {
    const value = Number(picks[key] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0 || value > (system.gearPicks?.[key]?.remaining ?? 0))
      throw new Error(loc`Choose available whole-number ${key} picks.`);
    selected[key] = value;
  }
  const allowed = system.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"];
  const cha = {};
  for (const key of PICK_CATEGORIES.filter(k => k !== "CHA")) {
    const value = Number(charismaPicks[key] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0 || (value && !allowed.includes(key)))
      throw new Error(loc`Assign Charisma reserves to categories allowed by the affiliation.`);
    cha[key] = value;
  }
  if (Object.values(cha).reduce((a, b) => a + b, 0) !== selected.CHA)
    throw new Error(loc`Assign every reserved Charisma pick to its category during the Intel Phase.`);
  if (!Number.isSafeInteger(common) || common < 0)
    throw new Error(loc`Choose a nonnegative whole number of Reserve Common Items.`);
  const used = items
    .filter(i => ["weapon", "armor", "gear"].includes(i.type) && i.system.common && !managedClassGearGrant(system, i))
    .reduce((n, i) => n + (i.system.quantity ?? 1), 0);
  const available = Math.max(0, (system.commonItems?.count ?? 0) + (system.commonItems?.perMission ?? 0) - used);
  if (common > available) throw new Error(loc`Not enough unchosen Common Items remain.`);
  if (procureAtIntel && !hasProcure(system))
    throw new Error(loc`Only an earned Intruder Procure option grants extra city reserves.`);
  if (
    common + Object.values(selected).reduce((a, b) => a + b, 0) >
    (system.reserveCapacity ?? 0) + (procureAtIntel ? 2 : 0)
  )
    throw new Error(loc`Combined reserves exceed the Wisdom-modifier limit.`);
  return {
    epoch: missionEpoch(system),
    initialized: true,
    initializationSource: "intel",
    caliber,
    procureAtIntel: !!procureAtIntel,
    picks: selected,
    charismaPicks: cha,
    common,
    spent: Object.fromEntries(PICK_CATEGORIES.map(k => [k, 0])),
    spentCommon: 0,
    attempts: structuredClone(provisional?.attempts ?? {})
  };
}
export function gearAcquisitionPlan(
  system,
  {
    kind = "request",
    pick = "",
    category = "",
    caliber = 1,
    name = "",
    location = "largeCity",
    rapidCommunication = false,
    minuteAvailable = false,
    commonConfirmed = false,
    categoryConfirmed = false,
    notIntel = false,
    useProcure = false,
    availableFunding = system.actionDice?.value ?? 0,
    requestAbility = "",
    originResource = "",
    originResourceConfirmed = false,
    politicalOption = "",
    politicalPowerRating = null,
    politicalOptionConfirmed = false,
    networkConfirmed = false,
    hourAvailable = false,
    homeTurf = false,
    sourcesOption = "",
    sourcesOptionConfirmed = false,
    atHome = false,
    usePersonalStash = false
  } = {}
) {
  const benefit =
    kind === "request" && requestAbility
      ? (system.limitedUses ?? []).find(s => s.id === requestAbility && s.workflow === "requestBenefit")
      : null;
  const freePick = benefit?.freePick === true;
  const existing = currentReserves(system),
    waiver = (kind === "common" && usePersonalStash === true) || freePick;
  const affiliationProblem = campaignAffiliationProblem(system, system.campaignEffects);
  if (affiliationProblem) throw new Error(affiliationProblem);
  if ((!existing || existing.initialized === false) && !waiver)
    throw new Error(loc`Allocate reserves for the current mission first.`);
  const record = existing ?? provisionalReserves(system, freePick ? "originFreePick" : "personalStash");
  if (record.initialized === false) validateProvisionalReserves(record);
  if (!notIntel) throw new Error(loc`Field acquisition takes place after the Intel Phase.`);
  if (!String(name).trim()) throw new Error(loc`Name the exact item or option before rolling.`);
  if (["standard arrow", "explosive arrow"].includes(String(name).trim().toLowerCase()))
    throw new Error(
      loc`These are ammunition stockpiles, purchased with their listed upgrade/Common Item cost rather than one Reserve pick or one Reserve Common Item.`
    );
  if (kind === "common" && requestAbility)
    throw new Error(loc`A Request benefit cannot apply to a Common Item Gear check.`);
  if (kind === "common") {
    if (!commonConfirmed) throw new Error(loc`The GC must confirm the desired object is a Common Item.`);
    const gearCheckContext = gearCheckPlan(system, { atHome });
    if (typeof usePersonalStash !== "boolean")
      throw new Error(loc`Choose whether to spend the Personal Stash allowance.`);
    let abilityRecord = null;
    if (usePersonalStash) {
      if (!gearCheckContext.personalStash || atHome !== true)
        throw new Error(loc`Personal Stash requires an active feat and a Gear check inside your home.`);
      const spec = system.limitedUses?.find(s => s.id === "personalStash" && s.workflow === "personalStashGear"),
        use = resourceUsePlan(spec, system.resourceUses, system.usagePeriods, system.actionDice?.value ?? 0);
      if (use.blocked) throw new Error(use.reason);
      abilityRecord = use.record;
    } else if (record.common < 1) throw new Error(loc`No Reserve Common Items remain.`);
    const commonCost = usePersonalStash ? 0 : 1;
    return {
      kind,
      name: String(name).trim(),
      cost: 0,
      commonCost,
      provisionalCreated: !existing,
      abilityId: usePersonalStash ? "personalStash" : null,
      gearAbility: usePersonalStash ? "personalStash" : null,
      abilityName: usePersonalStash ? "Personal Stash" : null,
      abilityRecord,
      dc: 21,
      bonus: gearCheckContext.bonus,
      gearCheckContext,
      bonusSources: gearCheckContext.personalStashBonus
        ? [{ name: loc`Personal Stash (inside home)`, value: gearCheckContext.personalStashBonus }]
        : [],
      record: { ...record, common: record.common - commonCost, spentCommon: (record.spentCommon ?? 0) + commonCost },
      delivery: null
    };
  }
  if (usePersonalStash) throw new Error(loc`Personal Stash waives a Common Item Gear check, not a Request.`);
  if (kind !== "request") throw new Error(loc`Choose a Request or Gear check.`);
  if (requestAbility && !benefit) throw new Error(loc`This Request benefit is not currently available.`);
  if (
    freePick &&
    (!ORIGIN_RESOURCE_PICKS[benefit.id] ||
      originResource !== benefit.originResource ||
      originResourceConfirmed !== true ||
      caliber !== benefit.fixedCaliber)
  )
    throw Error(
      loc`Confirm the origin's exact Caliber II Resource: legal immunity for Privileged, or medical assistance for Rescuer.`
    );
  if (benefit?.category && benefit.category !== category)
    throw new Error(loc`This Request benefit requires its specified equipment category.`);
  if (
    benefit?.requestOption &&
    (politicalOption !== benefit.requestOption ||
      politicalOptionConfirmed !== true ||
      (benefit.powerRating !== null && Number(politicalPowerRating) !== benefit.powerRating))
  )
    throw Error(
      loc`Confirm the Political feat's exact option: invitation, extradition or legal immunity. Resource benefits require Power Rating 6.`
    );
  if (benefit?.automatic && !networkConfirmed)
    throw new Error(loc`The GC must confirm the Faction or Freelance network can fulfill this Request.`);
  if (benefit?.city && location !== "largeCity")
    throw new Error(loc`Behind the Scenes requires a city of at least 10,000 people with quick contact.`);
  if (benefit?.hour && !hourAvailable)
    throw new Error(loc`${benefit.name} requires one hour of preparation before the Request.`);
  if (benefit?.consultSources && (!benefit.requestOptions.includes(sourcesOption) || sourcesOptionConfirmed !== true))
    throw new Error(
      loc`Confirm a source-listed dossier, skill-training or legal-immunity Request permitted by the earned Sources grade.`
    );
  if (benefit?.maximumDC && 10 * caliber > benefit.maximumDC)
    throw new Error(loc`This Behind the Scenes grade is limited to Request DC ${benefit.maximumDC}.`);
  const use = benefit
    ? resourceUsePlan(benefit, system.resourceUses, system.usagePeriods, system.actionDice?.value ?? 0)
    : null;
  if (use?.blocked) throw new Error(use.reason);
  const baseCost = benefit && !benefit.requestCost ? 0 : caliber,
    costPlan = shakenActionDieCost(system, { baseCost, payer: false });
  if (costPlan.blocked) throw new Error(costPlan.reason);
  const cost = costPlan.cost,
    surcharge = costPlan.surcharge;
  if (!benefit?.consultSources && (!rapidCommunication || !minuteAvailable))
    throw new Error(loc`A Request requires one full minute of rapid communication.`);
  if (useProcure && (!hasProcure(system) || location !== "largeCity"))
    throw new Error(
      loc`Procure requires the earned Intruder option, a city of at least 10,000 people and quick communication (pp.30,38).`
    );
  // Total Control (p.209): Requests may be for Caliber V gear.
  const maxCaliber = system.activeFeatNames?.includes("Total Control") ? 5 : 4;
  if (
    !Number.isSafeInteger(caliber) ||
    caliber < 1 ||
    caliber > maxCaliber ||
    (!benefit?.ignoreMissionCaliber && caliber > record.caliber + (useProcure ? 1 : 0))
  )
    throw new Error(
      maxCaliber === 5
        ? loc`A Request must be Caliber I–V and cannot exceed the current mission Caliber.`
        : loc`A Request must be Caliber I–IV and cannot exceed the current mission Caliber.`
    );
  if (!freePick && (!PICK_CATEGORIES.includes(pick) || (record.picks?.[pick] ?? 0) < 1))
    throw new Error(loc`Choose an available Reserve gear pick.`);
  if (!PICK_CATEGORIES.includes(category) || category === "CHA" || (!categoryConfirmed && !benefit?.outsideFaction))
    throw new Error(loc`Confirm the item’s actual equipment category and Faction availability.`);
  const allowed = system.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"];
  if (!freePick && (pick === "CHA" ? !allowed.includes(category) : pick !== category))
    throw new Error(loc`The Reserve pick must match the requested category and affiliation restrictions.`);
  if (!freePick && pick === "CHA" && (record.charismaPicks?.[category] ?? 0) < 1)
    throw new Error(
      loc`No Charisma Reserve pick remains in this category; its category was fixed during the Intel Phase.`
    );
  if (!DELIVERY[location]) throw new Error(loc`Choose a source-listed delivery location.`);
  if (!Number.isSafeInteger(availableFunding) || availableFunding < cost)
    throw new Error(loc`Not enough action dice remain in the selected funding.`);
  const priority = priorityRequestBonus(system, category),
    local = localHeroRequestBonus(system, { homeTurf }),
    requestBase =
      (system.requestCheck ?? 0) + (benefit?.requestLevel != null ? benefit.requestLevel - (system.level ?? 0) : 0);
  return {
    requestBenefit: requestBenefitContext(system, requestAbility),
    sourcesOption: benefit?.consultSources ? sourcesOption : "",
    politicalOption: benefit?.requestOption ?? "",
    politicalPowerRating: benefit?.powerRating ?? null,
    outsideFaction: !!benefit?.outsideFaction,
    requestLevel: benefit?.requestLevel ?? null,
    homeTurf: local.homeTurf,
    localHeroFeats: local.feats,
    kind,
    name: String(name).trim(),
    pick: freePick ? "" : pick,
    freePick,
    ...(freePick ? { provisionalCreated: !existing } : {}),
    originResource: freePick ? originResource : "",
    category,
    caliber,
    cost,
    baseCost,
    surcharge,
    requestAbility: benefit?.id ?? "",
    abilityName: benefit?.name ?? "",
    preparationHours: benefit?.hour ? 1 : 0,
    abilityRecord: use?.record,
    automatic: !!benefit?.automatic,
    dc: 10 * caliber,
    bonus: requestBase + priority.bonus + local.bonus,
    bonusSources: [...priority.sources, ...local.sources],
    location,
    deliveryMultiplier: useProcure ? 0.5 : 1,
    delivery: benefit?.immediate ? IMMEDIATE_DELIVERY : DELIVERY[location],
    record: freePick
      ? structuredClone(record)
      : {
          ...record,
          charismaPicks:
            pick === "CHA"
              ? { ...record.charismaPicks, [category]: record.charismaPicks[category] - 1 }
              : record.charismaPicks,
          picks: { ...record.picks, [pick]: record.picks[pick] - 1 },
          spent: { ...record.spent, [pick]: (record.spent?.[pick] ?? 0) + 1 }
        }
  };
}
export function acquisitionOutcome(attempt, total) {
  if (attempt.freePick === true) {
    if (
      !attempt.automatic ||
      attempt.kind !== "request" ||
      attempt.caliber !== 2 ||
      attempt.category !== "R" ||
      ORIGIN_RESOURCE_PICKS[attempt.requestAbility]?.resource !== attempt.originResource
    )
      throw Error(loc`Review the saved automatic origin Resource benefit.`);
    return { success: true, status: "succeeded" };
  }
  if (attempt.automatic === true) {
    const saved = attempt.automaticSource,
      source = saved?.source;
    if (
      attempt.kind !== "request" ||
      typeof attempt.requestAbility !== "string" ||
      !attempt.requestAbility ||
      saved?.version !== 1 ||
      saved.id !== attempt.requestAbility ||
      source?.id !== attempt.requestAbility ||
      source.workflow !== "requestBenefit" ||
      source.automatic !== true ||
      typeof saved.epoch !== "string" ||
      !saved.epoch ||
      (source.period === "mission" && saved.epoch !== attempt.epoch) ||
      (source.category && source.category !== attempt.category) ||
      (source.requestOption &&
        (source.requestOption !== attempt.politicalOption || source.powerRating !== attempt.politicalPowerRating)) ||
      !Number.isSafeInteger(attempt.caliber) ||
      attempt.caliber < 1 ||
      attempt.caliber > 5 ||
      (source.maximumDC && 10 * attempt.caliber > source.maximumDC)
    )
      throw Error(loc`Review the original automatic Request source before settling its delivery.`);
    return { success: true, status: "succeeded" };
  }
  if (!Number.isFinite(total)) throw new Error(loc`A finite final check result is required.`);
  return { success: total >= attempt.dc, status: total >= attempt.dc ? "succeeded" : "failed" };
}

export function managedAcquisition(system, item) {
  const reference = item.system?.reserveAcquisition;
  if (!reference) return false;
  // Earlier mission records remain inventory history, with a separate review warning.
  if (reference.epoch !== missionEpoch(system)) return true;
  const attempt = currentReserves(system)?.attempts?.[reference.attemptId];
  return (
    !!attempt?.success &&
    attempt.epoch === reference.epoch &&
    attempt.claimedItemId === item.id &&
    item.system.pick === (attempt.kind === "request" ? attempt.pick : "")
  );
}

/**
 * Feats that change what a Request yields (pp.181–209), as an extra quantity on the claimed bundle:
 * Grenade Basics +1 grenade; Bug Basics doubles bugs; Poison Basics +1 poison dose; Guided Weapon Basics doubles
 * guided weapons and their ammunition; Rock and Roll! doubles weapons that fire Full Auto and their ammunition.
 * Superior Documentation raises a requested cover identity's Power Rating by 1 (maximum 10).
 */
export function requestFeatBonus(system, item, quantity) {
  const feats = system?.activeFeatNames ?? [],
    s = item?.system ?? {},
    name = String(item?.name ?? ""),
    has = f => feats.includes(f),
    sources = [];
  let extra = 0;
  if (
    item?.type === "weapon" &&
    ["hurled", "exoticHurled"].includes(s.proficiency) &&
    /grenade/i.test(name) &&
    has("Grenade Basics")
  ) {
    extra += 1;
    sources.push("Grenade Basics");
  }
  if (/\bbugs?\b/i.test(name) && has("Bug Basics")) {
    extra += quantity;
    sources.push("Bug Basics");
  }
  if (/poison/i.test(name) && has("Poison Basics")) {
    extra += 1;
    sources.push("Poison Basics");
  }
  if (
    (s.proficiency === "guided" || (s.ammunitionOnly && /guided|missile/i.test(name))) &&
    has("Guided Weapon Basics")
  ) {
    extra += quantity;
    sources.push("Guided Weapon Basics");
  }
  if (
    ((s.fireModes ?? []).includes("auto") || (s.ammunitionOnly && s.autofireAmmunition === true)) &&
    has("Rock and Roll")
  ) {
    extra += quantity;
    sources.push("Rock and Roll");
  }
  const pr = Number(s.powerRating);
  const powerRating =
    /cover identity/i.test(name) && has("Superior Documentation") && Number.isFinite(pr)
      ? String(Math.min(10, pr + 1))
      : null;
  if (powerRating !== null) sources.push("Superior Documentation");
  return { extra, powerRating, sources };
}

/** Office Gossip (p.209): the character may take 10 with Request checks. */
export const officeGossipTake10 = (system, kind, input = {}) =>
  kind === "request" && input?.requestTake10 === true && system?.activeFeatNames?.includes("Office Gossip") === true;
