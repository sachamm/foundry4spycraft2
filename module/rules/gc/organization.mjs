/**
 * Organizations (pp.389–395): the Agency and every enduring faction, described by five Power Ratings.
 *
 * - Goals: that many goals from Table 6.18. Once per session the leaders may give one member 2 action dice per goal,
 *   spent on the goal's events or to boost its checks.
 * - History: that many turning points from Table 6.19. Each gives members +2 morale per action die they spend to
 *   boost the turning point's check.
 * - Image: points spent to move the public's awareness of five facets away from "On Record" (Table 6.20). Each
 *   facet's level sets the DC and error range of Canvass Area and Research checks about it; the Leaders and Members
 *   facets also give their people a bonus cover identity or legal immunity Power Rating.
 * - Sites: that many Sites from Table 6.21, each worth +4 on matching Request checks and half the waiting time.
 * - Tools: gear in every category starts at Caliber II; each point raises two categories by one Caliber (V at most),
 *   chosen once.
 *
 * The total of the five Ratings places an Agency on Table 6.22. Pure functions: the record lives in a world setting
 * (module/apps/gc/organizations.mjs).
 */
import { GC_DATA } from "../gc-tables.mjs";
import { loc } from "../../i18n.mjs";

export const ORG = GC_DATA.tables.organizations;
export const RATINGS = ORG.ratings;
const ROMAN = ["I", "II", "III", "IV", "V"];
const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const level = id =>
  ORG.image.levels.find(row => row.id === id) ?? ORG.image.levels.find(row => row.id === ORG.image.default);

export const organizationGoal = id => ORG.goals.find(goal => goal.id === id) ?? null;
export const turningPoint = id => ORG.turningPoints.find(point => point.id === id) ?? null;
export const organizationSite = id => ORG.sites.find(site => site.id === id) ?? null;
export const RATING_LABELS = {
  get goals() {
    return loc`Goals`;
  },
  get history() {
    return loc`History`;
  },
  get image() {
    return loc`Image`;
  },
  get sites() {
    return loc`Sites`;
  },
  get tools() {
    return loc`Tools`;
  }
};

export function defaultOrganization(id = "") {
  return {
    version: 1,
    id,
    name: "",
    agency: false,
    ratings: { goals: 1, history: 1, image: 0, sites: 0, tools: 0 },
    goals: [],
    turningPoints: [],
    image: Object.fromEntries(ORG.image.facets.map(facet => [facet.id, ORG.image.default])),
    sites: [],
    tools: Object.fromEntries(ORG.gearCategories.map(category => [category, 0])),
    notes: ""
  };
}

/** The Image points a set of facet levels uses: 2 for Renowned or Mysterious, 1 for Prominent or Secretive. */
export const imageSpent = image => ORG.image.facets.reduce((sum, facet) => sum + level(image?.[facet.id]).cost, 0);

/** The Caliber each gear category reaches: II, plus the increases given to it, V at most (p.394). */
export function toolsCalibers(tools = {}) {
  return Object.fromEntries(
    ORG.gearCategories.map(category => [
      category,
      Math.min(ORG.maxCaliber, ORG.toolsBaseCaliber + Math.max(0, Math.trunc(Number(tools[category]) || 0)))
    ])
  );
}

/** Table 6.22: where a total of Ratings places an Agency, or null below 11. */
export function ratingPool(total) {
  return ORG.ratingPools.find(pool => total >= pool.min && (pool.max === null || total <= pool.max)) ?? null;
}

/**
 * Check an organization against its own Ratings. Returns the totals and every problem found; `complete` is true when
 * nothing is over its Rating and nothing is left unspent.
 */
export function reviewOrganization(org) {
  const problems = [],
    unspent = [];
  const ratings = org?.ratings ?? {};
  for (const key of RATINGS)
    if (!whole(ratings[key], 0, 20)) problems.push(loc`${RATING_LABELS[key]}: enter a Rating from 0 to 20.`);
  const goals = org?.goals ?? [],
    points = org?.turningPoints ?? [],
    sites = org?.sites ?? [];
  const count = (list, rating, label) => {
    if (new Set(list.map(entry => entry.id ?? entry)).size !== list.length)
      problems.push(loc`${label}: each may be chosen once.`);
    if (list.length > (ratings[rating] ?? 0))
      problems.push(
        loc`${label}: ${list.length} chosen, but the ${RATING_LABELS[rating]} Rating allows ${ratings[rating] ?? 0}.`
      );
    else if (list.length < (ratings[rating] ?? 0))
      unspent.push(loc`${label}: ${(ratings[rating] ?? 0) - list.length} still to choose.`);
  };
  count(goals, "goals", loc`Goals`);
  count(points, "history", loc`Turning points`);
  count(sites, "sites", loc`Sites`);
  for (const goal of goals) if (!organizationGoal(goal)) problems.push(loc`Unknown goal: ${goal}.`);
  for (const point of points) {
    const found = turningPoint(point.id ?? point);
    if (!found) problems.push(loc`Unknown turning point: ${point.id ?? point}.`);
    else if (found.chooseCheck && !String(point.check ?? "").trim())
      problems.push(loc`${found.name}: name the skill check it supports (the check of the Triumph behind it).`);
  }
  for (const site of sites) if (!organizationSite(site)) problems.push(loc`Unknown Site: ${site}.`);
  const spent = imageSpent(org?.image);
  if (spent > (ratings.image ?? 0))
    problems.push(loc`Image: the facets use ${spent} points, but the Image Rating is ${ratings.image ?? 0}.`);
  else if (spent < (ratings.image ?? 0))
    unspent.push(loc`Image: ${(ratings.image ?? 0) - spent} point(s) still to allocate.`);
  for (const facet of ORG.image.facets)
    if (!ORG.image.levels.some(row => row.id === (org?.image?.[facet.id] ?? ORG.image.default)))
      problems.push(loc`${facet.name}: choose an awareness level.`);
  const tools = org?.tools ?? {},
    increases = ORG.gearCategories.reduce(
      (sum, category) => sum + Math.max(0, Math.trunc(Number(tools[category]) || 0)),
      0
    ),
    allowed = (ratings.tools ?? 0) * ORG.toolsIncreasesPerPoint;
  for (const category of ORG.gearCategories)
    if (ORG.toolsBaseCaliber + Math.max(0, Math.trunc(Number(tools[category]) || 0)) > ORG.maxCaliber)
      problems.push(loc`Tools: a gear category cannot go above Caliber V.`);
  if (increases > allowed)
    problems.push(
      loc`Tools: ${increases} Caliber increases, but a Tools Rating of ${ratings.tools ?? 0} gives ${allowed}.`
    );
  else if (increases < allowed) unspent.push(loc`Tools: ${allowed - increases} Caliber increase(s) still to give.`);
  const total = RATINGS.reduce((sum, key) => sum + (whole(ratings[key], 0, 20) ? ratings[key] : 0), 0);
  return {
    total,
    pool: ratingPool(total),
    imageSpent: spent,
    toolIncreases: increases,
    problems,
    unspent,
    complete: !problems.length && !unspent.length
  };
}

/**
 * Table 6.20 for one facet: the modifiers to the DC and error range of Canvass Area and Research checks that target
 * this facet of the organization.
 */
export function facetChecks(org, facet) {
  const row = level(org?.image?.[facet]);
  return { level: row.id, name: row.name, canvass: { ...row.canvass }, research: { ...row.research } };
}

/** The bonus cover identity and legal immunity Power Ratings its leaders and members get (Table 6.20). */
export function imageBenefits(org) {
  const leaders = level(org?.image?.leaders),
    members = level(org?.image?.members);
  return {
    leaders: { coverIdentity: leaders.cover.leaders, legalImmunity: leaders.immunity.leaders },
    members: { coverIdentity: members.cover.members, legalImmunity: members.immunity.members }
  };
}

/** The Site that helps this Request, if the organization keeps one: +4 and half the time, rounded up (p.394). */
export function siteForRequest(org, siteId) {
  if (!(org?.sites ?? []).includes(siteId)) return null;
  const site = organizationSite(siteId);
  return site ? { ...site, bonus: ORG.siteRequestBonus, timeFactor: 0.5 } : null;
}

/** Half a Request's waiting time, rounded up, for a Site that serves it. */
export const siteRequestTime = time => (Number.isFinite(time) && time > 0 ? Math.ceil(time / 2) : time);

/** Once per session: 2 action dice per goal for one member, spent on that goal's events or checks (p.389). */
export const goalDice = org => (org?.goals ?? []).length * ORG.goalDicePerGoal;

/** What each goal supports, as a line for the GC. */
export function goalLines(org) {
  const events = GC_DATA.tables.events;
  return (org?.goals ?? []).map(id => {
    const goal = organizationGoal(id);
    if (!goal) return id;
    const what =
      goal.supports.kind === "event"
        ? loc`${events.find(event => event.id === goal.supports.event)?.name ?? goal.supports.event} events`
        : goal.supports.label;
    return loc`${goal.name}: ${what}`;
  });
}

/** Each turning point with the check its +2 morale per boosting action die applies to (p.390). */
export function turningPointLines(org) {
  return (org?.turningPoints ?? []).map(entry => {
    const point = turningPoint(entry.id ?? entry);
    if (!point) return entry.id ?? entry;
    return loc`${point.name}: +${ORG.turningPointMorale} morale per action die boosting ${point.chooseCheck ? entry.check || loc`a check to choose` : point.check}`;
  });
}

/** The morale bonus a member's boost gets from turning points that support this check ("Skill/Use"). */
export function turningPointBoost(org, check, dice = 1) {
  const norm = value =>
    String(value ?? "")
      .trim()
      .toLowerCase();
  const matching = (org?.turningPoints ?? []).filter(entry => {
    const point = turningPoint(entry.id ?? entry);
    return point && norm(point.chooseCheck ? entry.check : point.check) === norm(check);
  });
  // Morale bonuses do not stack with each other: one turning point's bonus applies, whichever matches.
  return matching.length ? ORG.turningPointMorale * Math.max(0, Math.trunc(dice)) : 0;
}

/** The Ratings a Dramatic Conflict asks for (pp.363–388), by the names its tables print. */
export function conflictRatings(org) {
  const r = org?.ratings ?? {};
  return {
    "Organization Goals Rating": r.goals ?? 0,
    "Organization History Rating": r.history ?? 0,
    "Organization Image Rating": r.image ?? 0,
    "Organization Sites Rating": r.sites ?? 0,
    "Organization Tools Rating": r.tools ?? 0,
    "Goals Rating": r.goals ?? 0,
    "History Rating": r.history ?? 0,
    "Image Rating": r.image ?? 0,
    "Sites Rating": r.sites ?? 0,
    "Tools Rating": r.tools ?? 0
  };
}

/**
 * Table 7.15 reveals "all details about N of the enemy organization's Ratings": the facts behind each Rating, in the
 * order the GC lists them.
 */
export function ratingDetails(org, key) {
  const r = org?.ratings ?? {};
  switch (key) {
    case "goals":
      return loc`Goals ${r.goals ?? 0}: ${goalLines(org).join("; ") || loc`none chosen`}`;
    case "history":
      return loc`History ${r.history ?? 0}: ${turningPointLines(org).join("; ") || loc`none chosen`}`;
    case "image":
      return loc`Image ${r.image ?? 0}: ${ORG.image.facets.map(facet => loc`${facet.name} ${facetChecks(org, facet.id).name}`).join(", ")}`;
    case "sites":
      return loc`Sites ${r.sites ?? 0}: ${(org?.sites ?? []).map(id => organizationSite(id)?.name ?? id).join(", ") || loc`none chosen`}`;
    case "tools": {
      const calibers = toolsCalibers(org?.tools);
      return loc`Tools ${r.tools ?? 0}: ${ORG.gearCategories.map(category => `${category}–${ROMAN[calibers[category] - 1]}`).join(", ")}`;
    }
    default:
      return "";
  }
}

/** The organization's summary, as lines for a chat card or the console. */
export function organizationSummary(org) {
  const review = reviewOrganization(org);
  return {
    review,
    lines: RATINGS.map(key => ratingDetails(org, key)),
    benefits: imageBenefits(org),
    goalDice: goalDice(org)
  };
}
