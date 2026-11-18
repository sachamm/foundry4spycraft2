import { jinxUseSpec } from "./jinx.mjs";
import { markSource } from "./mark.mjs";
import { oneHandManeuverSource } from "./maneuver-actions.mjs";
import { safeHouseSource } from "./safe-house.mjs";
import { taskPressureUseSpec } from "./task-pressure.mjs";
import { toolShedSource } from "./tool-shed.mjs";
import { finalAttackRoundSpec } from "./final-round.mjs";
import { DROP_FOLLOW_UPS } from "./drop-follow-up.mjs";
import { fortunateSpec } from "./fortunate.mjs";
import { allOrNothingSpec } from "./all-or-nothing.mjs";
import { blackCatSpec } from "./black-cat.mjs";
import { berserkerSpec } from "./berserker.mjs";
import { gunslingerSpec } from "./gunslinger.mjs";
import { chanceReactionSpecs } from "./chance-reactions.mjs";
import { fireTeamSupremacySpec } from "./team-feats.mjs";
import { brawlingSupremacySpec } from "./brawling-supremacy.mjs";
import { roundActionSpecs } from "./feat-free-actions.mjs";
import { openStanceSpec } from "./wrestling.mjs";
import { dartingStyleState } from "./darting-state.mjs";
import { twoWeaponStyleState } from "./two-weapon-state.mjs";
import { adrenalineSource } from "./adrenaline.mjs";
import { mentalLeapSource } from "./mental-leap.mjs";
import { ASSISTANT_SOURCES, assistantSource } from "./summoned-assistants.mjs";
import {
  INTEL_FEAT_ABILITIES,
  intelTemporaryFeatSource,
  anyTimeAnyPlaceSource,
  knowItAllSource,
  everydayGeniusSource
} from "./temporary-feats.mjs";
import { hasFinalDeduction } from "./final-deduction.mjs";
import { globalSearchSource } from "./global-search.mjs";
import { littleDetailsSource } from "./little-details.mjs";
import { brightIdeaSources } from "./bright-idea.mjs";
import { requestSources } from "./requests.mjs";
import { hintSources } from "./hints.mjs";
import { hasMasterThief, manualAdjustmentSource } from "./class-checks.mjs";
import { hasImprovisation } from "./class-gear.mjs";
import { resolveFeatChoices } from "./feats.mjs";
import { loc } from "../i18n.mjs";
const norm = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const key = value => encodeURIComponent(value).replaceAll(".", "%2E");
/** Source-scoped benefits, including virtual Field of Expertise focus restrictions. */
export function skillFeatRules(system, items, cfg) {
  const active = new Set(items.filter(i => i.type === "feat" && system.featStatus?.[i.id]?.ok).map(i => i.id));
  const virtuoso = items.find(
    i => i.type === "class" && i.system.identifier === "virtuoso" && system.classLevels?.virtuoso
  );
  const rules = [];
  for (const feat of items.filter(i => active.has(i.id))) {
    const resolved = resolveFeatChoices(feat, system, items, cfg, active);
    if (resolved.pending.length || resolved.warnings.length) continue;
    const basic = Object.keys(cfg.tables.basicSkillFeats ?? {}).find(name => norm(name) === norm(feat.system.choice));
    let skills = cfg.tables.basicSkillFeats?.[basic] ?? [];
    const fieldOfExpertise = norm(feat.system.choice) === "field of expertise" && !!virtuoso;
    if (fieldOfExpertise) skills = [...new Set([virtuoso.system.keySkill, "profession"])];
    for (const skill of skills) {
      const focuses = [];
      if (fieldOfExpertise) {
        if (skill === virtuoso?.system.keySkill && cfg.skills[skill]?.focus)
          focuses.push(virtuoso.system.keyFocus || "__unselected__");
        if (skill === "profession") focuses.push(virtuoso?.system.professionFocus || "__unselected__");
      }
      rules.push({
        name: feat.name,
        choice: fieldOfExpertise ? "Field of Expertise" : (basic ?? feat.system.choice),
        skill,
        focuses
      });
    }
  }
  return rules;
}
export function appliesToSkill(rule, skill, focus = "") {
  return rule.skill === skill && (!rule.focuses?.length || rule.focuses.some(value => norm(value) === norm(focus)));
}
/** Only reviewed limits are registered here; descriptive actions still require their stated circumstances. */
export function limitedUseAbilities(system, items, cfg) {
  const out = [...hintSources(system, items), ...requestSources(system, items)],
    add = entry => out.push({ cost: 0, period: "session", ...entry });
  for (const t of Object.values(system.analysisTasks ?? {})) {
    try {
      const spec = taskPressureUseSpec(t);
      if (spec) add(spec);
    } catch {}
  }
  if (system.activeFeatNames?.includes("Well-Funded"))
    add({
      id: "wellFunded",
      name: loc`Well-Funded (cash at home)`,
      period: "mission",
      limit: 1,
      workflow: "wellFundedCash",
      manualReviewable: true
    });
  const jinx = jinxUseSpec(system);
  if (jinx) add(jinx);
  const mark = markSource(system);
  if (mark)
    add({
      id: "mark",
      name: loc`Mark (three target skill bonuses)`,
      limit: mark.limit,
      workflow: "markObservation",
      manualReviewable: true,
      hidden: true
    });
  const wheel = oneHandManeuverSource(system);
  if (wheel)
    add({
      id: "oneHandManeuver",
      name: loc`One Hand on the Wheel (free Maneuver)`,
      period: "scene",
      limit: wheel.limit,
      workflow: "freeManeuver",
      manualReviewable: true
    });
  const house = safeHouseSource(system);
  if (house) {
    add({
      id: "safeHouseMission",
      name: loc`Safe House declarations`,
      period: "mission",
      limit: house.limit,
      workflow: "safeHouseDeclaration",
      manualReviewable: true,
      hidden: true
    });
    add({
      id: "safeHouseScene",
      name: loc`Safe House scene-opening declaration`,
      period: "scene",
      limit: 1,
      workflow: "safeHouseScene",
      manualReviewable: true,
      hidden: true
    });
  }
  const shed = toolShedSource(system);
  if (shed)
    add({
      id: "toolShed",
      name: loc`Tool Shed (one Grade III kit after one hour at home)`,
      period: "mission",
      limit: shed.limit,
      workflow: "toolShedKit",
      manualReviewable: true
    });
  if (system.activeFeatNames?.includes("Personal Stash"))
    add({
      id: "personalStash",
      name: loc`Personal Stash (Gear check without a Reserve Common Item)`,
      limit: 1,
      workflow: "personalStashGear",
      manualReviewable: true,
      hidden: true
    });
  if (system.activeFeatNames?.includes("Quick Draw"))
    add({
      id: "quickDraw",
      name: loc`Quick Draw (free weapon action)`,
      period: "round",
      limit: 2,
      workflow: "featFreeAction",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  if (system.activeFeatNames?.includes("Surge of Speed")) {
    add({
      id: "surgeOfSpeed",
      name: loc`Surge of Speed (free non-attack half action)`,
      limit: system.actionDice?.max ?? 0,
      workflow: "featFreeAction",
      hidden: true
    });
    add({
      id: "surgeOfSpeedRound",
      name: loc`Surge of Speed round allowance`,
      period: "round",
      limit: 1,
      workflow: "featFreeActionRound",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  }
  for (const spec of roundActionSpecs(system)) add(spec);
  const openStance = openStanceSpec(system);
  if (openStance) add(openStance);
  if (system.activeFeatNames?.includes("Polearm Basics"))
    add({
      id: "strikingStance",
      name: loc`Striking Stance (adjacent entry reaction)`,
      period: "round",
      limit: 1,
      workflow: "strikingStance",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  if (system.activeFeatNames?.includes("Mobile Offense"))
    add({
      id: "mobileOffense",
      name: loc`Mobile Offense during Standard Move`,
      period: "round",
      limit: 1,
      workflow: "mobileOffense",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  if (system.activeFeatNames?.includes("Contempt")) {
    add({
      id: "contempt",
      name: loc`Contempt combat allowance`,
      period: "combat",
      limit: system.actionDice?.max,
      workflow: "contempt",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
    add({
      id: "contemptRound",
      name: loc`Contempt round allowance`,
      period: "round",
      limit: 1,
      workflow: "contemptRound",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  }
  if (system.activeFeatNames?.some(n => ["Flail Basics", "Fencing Basics"].includes(n)))
    add({
      id: "missTrick",
      name: loc`Immediate miss tricks (one per resolved trigger)`,
      period: "round",
      limit: Number.MAX_SAFE_INTEGER,
      workflow: "missTrick",
      combatScoped: true,
      hidden: true
    });
  for (const [key, d] of Object.entries(DROP_FOLLOW_UPS))
    if (system.activeFeatNames?.includes(d.feat))
      add({
        id: key,
        name: loc`${d.name} (extra attack after a drop)`,
        period: "round",
        limit: 1,
        workflow: key,
        combatScoped: true,
        manualReviewable: true,
        hidden: true
      });
  for (const spec of chanceReactionSpecs(system)) add(spec);
  const brawling = brawlingSupremacySpec(system);
  if (brawling) add(brawling);
  const fireTeam = fireTeamSupremacySpec(system);
  if (fireTeam) add(fireTeam);
  const gunslinger = gunslingerSpec(system);
  if (gunslinger) add(gunslinger);
  const rage = berserkerSpec(system);
  if (rage) add(rage);
  const blackCat = blackCatSpec(system);
  if (blackCat) add(blackCat);
  const allOrNothing = allOrNothingSpec(system);
  if (allOrNothing) add(allOrNothing);
  const fortunate = fortunateSpec(system);
  if (fortunate) add(fortunate);
  if (system.activeFeatNames?.includes("Opportunist"))
    add({
      id: "opportunist",
      name: loc`Opportunist (final attack after another opponent drops)`,
      period: "round",
      limit: 1,
      workflow: "opportunist",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  if (system.activeFeatNames?.includes("Combat Instincts"))
    add({
      id: "combatInstincts",
      name: loc`Combat Instincts (immediate final attack)`,
      period: "round",
      limit: 1,
      workflow: "combatInstincts",
      combatScoped: true,
      manualReviewable: true,
      hidden: true
    });
  const darting = dartingStyleState(system);
  if (darting.active)
    add({
      id: "dartingFinalAttack",
      name: loc`Darting Weapon final attacks (recorded declaration)`,
      period: "darting declaration",
      limit: darting.extraAttacks,
      workflow: "dartingFinalAttack",
      hidden: true,
      requiresEpochReceipt: true,
      manualReviewable: true
    });
  const twoWeapon = twoWeaponStyleState(system);
  if (twoWeapon.active)
    add({
      id: "twoWeaponFinalAttack",
      name: loc`Two-weapon final attacks (recorded declaration)`,
      period: "two-weapon declaration",
      limit: twoWeapon.extraAttacks,
      workflow: "twoWeaponFinalAttack",
      hidden: true,
      requiresEpochReceipt: true,
      manualReviewable: true
    });
  const adrenaline = adrenalineSource(system);
  if (adrenaline) add(adrenaline);
  if (hasFinalDeduction(system))
    add({
      id: "finalDeduction",
      name: loc`Final Deduction (one special character; study rounds)`,
      limit: 1,
      workflow: "finalDeduction"
    });
  const search = globalSearchSource(system);
  if (search)
    add({
      id: "globalSearch",
      name: loc`Global Search (completed dedicated search)`,
      period: "mission",
      limit: search.limit,
      workflow: "globalSearch"
    });
  const details = littleDetailsSource(system);
  if (details) {
    add({
      id: "littleDetails",
      name: loc`Little Details (free action; once per round)`,
      limit: details.limit,
      workflow: "littleDetails"
    });
    add({
      id: "littleDetailsRound",
      name: loc`Little Details round allowance`,
      period: "round",
      limit: 1,
      workflow: "littleDetailsRound",
      hidden: true
    });
  }
  if ((system.classLevels?.schemer ?? 0) >= 8)
    add({
      id: "masterPlan",
      name: loc`Master Plan (free action; scene bonus d4s)`,
      period: "mission",
      limit: 1,
      workflow: "masterPlan"
    });
  if ((system.classLevels?.schemer ?? 0) >= 2)
    add({
      id: "cunningPlan",
      name: loc`Cunning Plan (free action, reduce error range)`,
      period: "scene",
      limit: system.classLevels.schemer >= 7 ? 2 : 1,
      workflow: "cunningPlan"
    });
  const genius = everydayGeniusSource(system);
  if (genius)
    add({
      id: "everydayGenius",
      name: loc`Everyday Genius (temporary Basic Skill feat; full action)`,
      period: "mission",
      limit: genius.limit,
      workflow: "sessionBasicFeat"
    });
  for (const id of Object.keys(ASSISTANT_SOURCES)) {
    const source = assistantSource(system, id);
    if (source)
      add({
        id,
        name: loc`${source.name} (city; non-combat assistants)`,
        period: "mission",
        limit: 1,
        workflow: "summonAssistants"
      });
  }
  const mental = mentalLeapSource(system);
  if (mental)
    add({
      id: "mentalLeap",
      name: loc`Mental Leap (temporary DEX/INT/WIS; exhaustion follows)`,
      limit: mental.limit,
      workflow: "mentalLeap"
    });
  const knowAll = knowItAllSource(system);
  if (knowAll)
    add({
      id: "knowItAll",
      name: loc`Know It All (two temporary Advanced Skill feats; free action)`,
      period: "mission",
      limit: knowAll.limit,
      workflow: "selfAdvancedFeats"
    });
  const anyTime = anyTimeAnyPlaceSource(system);
  if (anyTime)
    add({
      id: "anyTimeAnyPlace",
      name: loc`Any Time, Any Place (temporary Terrain feat; free action)`,
      period: "mission",
      limit: anyTime.limit,
      workflow: "selfTerrainFeat"
    });
  if ((system.classLevels?.schemer ?? 0) >= 3)
    add({
      id: "renaissanceMan",
      name: loc`Renaissance Man (temporary Basic Skill feat; free action)`,
      period: "mission",
      limit: system.classLevels.schemer >= 7 ? 2 : 1,
      workflow: "selfTemporaryFeat"
    });
  if ((system.classLevels?.schemer ?? 0) >= 4)
    add({
      id: "allAccordingToPlan",
      name: loc`All According to Plan (substitute INT)`,
      limit: system.actionDice?.max ?? 0,
      workflow: "attributeSubstitution"
    });
  if ((system.classLevels?.sniper ?? 0) >= 10)
    add({
      id: "millionDollarSkill",
      name: loc`Million Dollar Skill (vulnerable opponent; eligible weapon)`,
      period: "round",
      limit: 1,
      workflow: "millionDollarSkill"
    });
  if (system.coreClassIds?.includes("sniper"))
    add({
      id: "eagleEye",
      name: loc`Eagle Eye (range increment for this scene)`,
      period: "scene",
      limit: 1,
      cost: 1,
      workflow: "eagleEye"
    });
  const adjustment = manualAdjustmentSource(system);
  if (adjustment) out.push(adjustment);
  if ((system.classLevels?.stuntman ?? 0) >= 8)
    add({
      id: "iKnowWhatDoing",
      name: loc`…I Know What I’m Doing. (STR/DEX skill, DC > Career Level +20)`,
      period: "scene",
      limit: 1,
      workflow: "difficultSkillBonus"
    });
  if (hasMasterThief(system))
    add({
      id: "masterThief",
      name: loc`Master Thief (opposed Intruder skill, 4+ ranks)`,
      limit: 1,
      workflow: "masterThief"
    });
  if (hasImprovisation(system))
    add({
      id: "improvisation",
      name: loc`Improvisation (full action, one Common Item)`,
      period: "mission",
      limit: system.actionDice?.max ?? 0,
      workflow: "improvisation"
    });
  if ((system.classLevels?.virtuoso ?? 0) >= 10)
    add({
      id: "breakthrough",
      name: loc`Breakthrough (INT/WIS skill or Knowledge)`,
      period: "scene",
      limit: 1,
      workflow: "breakthrough"
    });
  if ((system.classLevels?.scientist ?? 0) >= 14)
    add({
      id: "tenSecondSolution",
      name: loc`10-Second Solution (standalone INT skill or Knowledge)`,
      limit: 1,
      workflow: "tenSecondSolution"
    });
  if ((system.classLevels?.soldier ?? 0) >= 14)
    add({ id: "oneInAMillion", name: loc`One in a Million`, limit: 1, workflow: "oneInAMillion" });
  out.push(...brightIdeaSources(system));
  if (system.coreClassIds?.includes("virtuoso")) {
    const v = items.find(i => i.type === "class" && i.system.identifier === "virtuoso");
    if (cfg.skills[v?.system.keySkill])
      add({
        id: "meticulous",
        name: loc`Meticulous`,
        period: "scene",
        limit: 1,
        cost: 1,
        workflow: "reroll",
        skill: v.system.keySkill,
        focuses: cfg.skills[v.system.keySkill].focus ? [v.system.keyFocus || "__unselected__"] : []
      });
  }
  for (const [classId, name] of [
    ["raptor", "Nimble"],
    ["tactician", "Wily"],
    ["triggerman", "Trigger-Happy"]
  ])
    if (system.coreClassIds?.includes(classId))
      add({ id: classId + "Core", name, period: "round", limit: 1, cost: 1, workflow: "manual" });
  if (system.weaponSpecialist?.proficiencies?.length) {
    if (system.weaponSpecialist.abilities.includes("Mow Down"))
      add({
        id: "mowDown",
        name: loc`Mow Down (selected proficiencies; final attack vs standard character)`,
        period: "round",
        limit: 1,
        workflow: "manual"
      });
    if (system.weaponSpecialist.abilities.includes("Showdown"))
      add({
        id: "showdown",
        name: loc`Showdown (selected proficiencies; Stand Off without action-die cost)`,
        limit: system.actionDice?.max ?? 0,
        workflow: "manual"
      });
  }
  for (const id of Object.keys(INTEL_FEAT_ABILITIES)) {
    const source = intelTemporaryFeatSource(system, id);
    if (source)
      add({
        id,
        name: loc`${source.name} (${source.count} temporary ${source.tree} feat${source.count === 1 ? "" : "s"} during Intel)`,
        period: "mission",
        limit: 1,
        workflow: "intelTemporaryFeat"
      });
  }
  if ((system.classLevels?.stuntman ?? 0) >= 7)
    add({ id: "noFear", name: loc`No Fear II (temporary stress resistance)`, limit: 1, workflow: "noFear" });
  if (system.legacyAbilities?.fortunesOfWar?.grade > 0)
    add({
      id: "fortunesOfWar",
      name: loc`Fortunes of War (double its DR for one full round)`,
      limit: system.actionDice?.max ?? 0,
      workflow: "fortunesOfWar"
    });
  const seen = new Set();
  for (const rule of system.skillFeatRules ?? []) {
    if (!["Advanced Skill Mastery", "Perfect Skill Mastery"].includes(rule.name)) continue;
    const id = key(rule.name + ":" + norm(rule.choice));
    if (seen.has(id)) continue;
    seen.add(id);
    const scoped = (system.skillFeatRules ?? []).filter(
      r => r.name === rule.name && norm(r.choice) === norm(rule.choice)
    );
    add({
      id,
      name: `${rule.name} (${rule.choice})`,
      limit: rule.name === "Perfect Skill Mastery" ? 3 : 1,
      workflow: "reroll",
      mastery: rule.name,
      skills: scoped
    });
  }
  add({
    id: "tripFinalAttack",
    name: loc`Critical Trip final attack (one per earned trigger)`,
    period: "round",
    limit: Number.MAX_SAFE_INTEGER,
    workflow: "tripFinalAttack",
    combatScoped: true,
    hidden: true
  });
  add(finalAttackRoundSpec(system));
  return out;
}
export function resourceStatus(spec, uses = {}, periods = {}) {
  const epoch = String(periods[spec.period] ?? "initial"),
    stored = uses[spec.id];
  const hasRecord = stored !== undefined && stored !== null;
  const unknownEpoch =
    hasRecord &&
    (typeof stored !== "object" || Array.isArray(stored) || typeof stored.epoch !== "string" || !stored.epoch);
  const current = !unknownEpoch && stored?.epoch === epoch;
  const invalidCount = current && (!Number.isSafeInteger(stored.used) || stored.used < 0);
  const counterReview =
    (spec.requiresEpochReceipt === true && !current) ||
    unknownEpoch ||
    invalidCount ||
    !Number.isSafeInteger(spec.limit) ||
    spec.limit < 0;
  const used = current && !invalidCount ? stored.used : 0;
  return {
    ...spec,
    epoch,
    used,
    remaining: counterReview ? 0 : Math.max(0, spec.limit - used),
    ...(counterReview ? { counterReview: true } : {})
  };
}
export function resourceUsePlan(spec, uses, periods, actionDice = 0) {
  if (!spec) return { blocked: true, reason: loc`This ability is not currently available.` };
  const status = resourceStatus(spec, uses, periods);
  if (status.counterReview)
    return { blocked: true, reason: loc`${spec.name}: review its saved use count or limit before spending.` };
  if (!Number.isSafeInteger(spec.cost) || spec.cost < 0 || !Number.isSafeInteger(actionDice) || actionDice < 0)
    return { blocked: true, reason: loc`Review the ability cost and current action-die balance before spending.` };
  if (!status.remaining) return { blocked: true, reason: loc`${spec.name}: no uses remain this ${spec.period}.` };
  if (actionDice < spec.cost) return { blocked: true, reason: loc`${spec.name} requires ${spec.cost} action die.` };
  return { blocked: false, status, record: { epoch: status.epoch, used: status.used + 1 } };
}
export function rerollEligibility(spec, check, { failed = false, criticalFailure = false, forced = false } = {}) {
  if (forced && check?.noForcedReroll) return false;
  if (
    !spec ||
    typeof check?.formula !== "string" ||
    !check.rollData ||
    spec.workflow !== "reroll" ||
    check.checkMethod !== "roll" ||
    check.naturalDie == null ||
    check.checkKind === "damage" ||
    check.resolved ||
    check.superseded
  )
    return false;
  if (spec.mastery && check.successConfirmed === true) return false;
  failed = failed || check.successConfirmed === false;
  if (spec.mastery === "Perfect Skill Mastery")
    return failed && !criticalFailure && !check.criticalFailure && !check.rerollResources?.length;
  if (spec.mastery === "Advanced Skill Mastery")
    return (
      failed &&
      !criticalFailure &&
      !check.criticalFailure &&
      ["skill", "knowledge"].includes(check.checkKind) &&
      spec.skills.some(rule => appliesToSkill(rule, check.skillKey, check.focus))
    );
  return check.checkKind === "skill" && appliesToSkill(spec, check.skillKey, check.focus);
}

/** An explicit GC correction of malformed history, never an automatic refill. */
export function resourceCounterReviewPlan(spec, uses, periods, { used, reason = "", confirmed = false } = {}) {
  if (!spec || !Number.isSafeInteger(spec.limit) || spec.limit < 0)
    throw new Error(loc`Correct this ability’s source/limit before reviewing its use count.`);
  const status = resourceStatus(spec, uses, periods);
  if (!status.counterReview && !spec.manualReviewable) throw new Error(loc`This saved counter no longer needs review.`);
  if (!confirmed || !Number.isSafeInteger(used) || used < 0 || !String(reason).trim())
    throw new Error(loc`Enter the GC-confirmed current-period use count and a reason.`);
  return {
    record: { epoch: status.epoch, used },
    previous: structuredClone(uses?.[spec.id]),
    reason: String(reason).trim(),
    period: spec.period
  };
}

/** Foundry merges ObjectField children: remove keys introduced by the correction when restoring missing history. */
export function resourceCounterRestorePatch(id, previous) {
  if (previous === undefined) return { [`system.resourceUses.-=${id}`]: null };
  const patch = { [`system.resourceUses.${id}`]: previous };
  if (previous && typeof previous === "object" && !Array.isArray(previous))
    for (const key of ["epoch", "used"])
      if (previous[key] === undefined) patch[`system.resourceUses.${id}.-=${key}`] = null;
  return patch;
}
