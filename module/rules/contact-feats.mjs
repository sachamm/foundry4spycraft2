import { loc } from "../i18n.mjs";
/** pp.201–205: each feat's initial themed associate, not every contact of that theme. */
export const CONTACT_FEATS = {
  "Academic Contacts": "academic or scholastic",
  "Blue Collar Contacts": "vehicular or tradesman",
  "Criminal Contacts": "criminal",
  "Government Contacts": "legal or government",
  "Grifter Contacts": "grifter or con artist",
  "High-Tech Contacts": "computer or technological",
  "Local Contacts": "exotic or traveling",
  "Media Contacts": "entertainment or media",
  "Medical Contacts": "medical or science",
  "Military Contacts": "military or mercenary",
  "Police Contacts": "law enforcement or security",
  "Research Contacts": "journalist, documentary or librarian",
  "Street Contacts": "street",
  "White Collar Contacts": "business",
  "Wilderness Contacts": "wilderness"
};
const norm = s => (typeof s === "string" ? s.trim().toLowerCase() : "");
export function contactFeatGrants(system) {
  const bindings = system.contactFeatBindings ?? [],
    contacts = system.contacts ?? [],
    networking = networkingContactFeatGrants(system);
  return bindings.map(b => {
    let reason = "";
    const mode = b.mode ?? "associate",
      matches = contacts.filter(c => norm(c.name) && norm(c.name) === norm(b.primaryName)),
      same = bindings.filter(c => norm(c.primaryName) && norm(c.primaryName) === norm(b.primaryName));
    const newCount = same.filter(g => (g.mode ?? "associate") === "associate").length,
      credits = same.reduce((n, g) => n + ((g.mode ?? "associate") === "associate" ? 2 : 1), 0),
      networkingAssociate = networking.some(g => g.valid && norm(g.name) === norm(b.primaryName));
    const minimumGrade = newCount ? credits : (networkingAssociate ? 2 : 1) + credits;
    if (!norm(b.primaryName) || b.primaryName.length > 200 || matches.length !== 1)
      reason = loc`Choose one uniquely named primary contact in the feat’s Choice / target field.`;
    else if (!same.every(g => ["associate", "improve"].includes(g.mode ?? "associate")))
      reason = loc`Choose a new associate or a one-grade Favored Contacts improvement.`;
    else if (new Set(same.map(g => g.name)).size !== same.length || new Set(same.map(g => g.id)).size !== same.length)
      reason = loc`Each contact feat grant may be spent only once.`;
    else if (newCount > 1)
      reason = loc`One contact cannot receive multiple new-associate grants; use an improvement for an existing contact.`;
    else if (
      minimumGrade > 4 ||
      !Number.isSafeInteger(matches[0].rank) ||
      matches[0].rank < minimumGrade ||
      matches[0].rank > 4
    )
      reason = loc`Record the full granted grade increase, up to partner grade; otherwise assign a different contact.`;
    else if (typeof b.theme !== "string" || !b.theme.trim() || b.theme.length > 200 || b.themeConfirmed !== true)
      reason = loc`Describe the contact’s matching theme and obtain GC confirmation of the selected grant mode.`;
    return {
      ...b,
      mode,
      credit: reason ? 0 : mode === "associate" ? 2 : 1,
      minimumGrade,
      valid: !reason,
      reason,
      contact:
        matches.length === 1 ? { name: matches[0].name, rank: matches[0].rank, notes: matches[0].notes ?? "" } : null
    };
  });
}
export const CONTACT_GRADES = {
  1: { summon: 3600, dc: 30, error: 3, responseDice: 4 },
  2: { summon: 1800, dc: 25, error: 2, responseDice: 3 },
  3: { summon: 600, dc: 20, error: 1, responseDice: 2 },
  4: { summon: 60, dc: 15, error: 0, responseDice: 1 }
};
export function contactTimeLabel(seconds) {
  return seconds % 3600 === 0
    ? loc`${seconds / 3600} Hours`
    : seconds % 60 === 0
      ? loc`${seconds / 60} Minutes`
      : loc`${seconds} Seconds`;
}
/** Table 2.35 p.144 supplies the ordinary check, before any contact feat benefit. */
export function contactFeatCheckPlan(system, key, check, { contactName = "", contactThreatLevel = null } = {}) {
  const empty = {
    evidence: null,
    timeChoices: [],
    errorReduction: 0,
    errorIncrease: 0,
    minimumError: 0,
    blockedReason: ""
  };
  if (key !== "networking" || check?.id !== "contact" || !contactName) return empty;
  if (typeof contactName !== "string" || contactName.length > 200)
    return { ...empty, blockedReason: loc`Choose one recorded contact.` };
  const contacts = (system.contacts ?? []).filter(c => norm(c.name) === norm(contactName));
  if (contacts.length !== 1)
    return { ...empty, blockedReason: loc`Choose one uniquely named contact recorded in Training.` };
  const contact = contacts[0],
    grade = CONTACT_GRADES[contact.rank],
    career = system.level,
    threat =
      typeof contactThreatLevel === "number"
        ? contactThreatLevel
        : typeof contactThreatLevel === "string" && contactThreatLevel.trim()
          ? Number(contactThreatLevel)
          : NaN;
  if (!Number.isSafeInteger(contact.rank) || !grade)
    return { ...empty, blockedReason: loc`Review the selected contact’s grade.` };
  if (
    !Number.isSafeInteger(career) ||
    career < 1 ||
    career > 20 ||
    !Number.isSafeInteger(threat) ||
    threat < 1 ||
    threat > 20
  )
    return { ...empty, blockedReason: loc`Enter the current mission Threat Level (1–20) for this Contact check.` };
  const lower = threat < career,
    higher = threat > career,
    mission = lower ? "lower" : higher ? "higher" : "equal",
    baseSeconds = grade.summon * (higher ? 2 : 1),
    errorIncrease = grade.error + (higher ? 2 : lower ? -1 : 0),
    minimumError = lower ? 1 : 0;
  const evidence = {
    version: 1,
    contact: { name: contact.name, rank: contact.rank, notes: contact.notes ?? "" },
    source: null,
    careerLevel: career,
    threatLevel: threat,
    missionComparison: mission,
    dc: grade.dc + (higher ? 5 : lower ? -5 : 0),
    baseSummonSeconds: baseSeconds,
    errorIncrease,
    minimumError,
    response: {
      formula: `${grade.responseDice}d6`,
      unit: "hours",
      missionMultiplier: lower ? 0.5 : higher ? 2 : 1,
      afterSuccessfulCheck: true
    }
  };
  const result = {
    ...empty,
    evidence,
    baseTime: contactTimeLabel(baseSeconds),
    baseSeconds,
    errorIncrease,
    minimumError,
    timeChoices: lower
      ? [
          {
            id: "contactMission",
            name: loc`Lower-Threat mission Contact time`,
            multiplier: 0.5,
            minimum: 0,
            rounding: null
          }
        ]
      : []
  };
  const grants = contactFeatGrants(system)
    .filter(b => norm(b.primaryName) === norm(contactName))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));
  if (!grants.length) return result;
  const invalid = grants.find(g => !g.valid);
  if (invalid) return { ...result, blockedReason: invalid.reason || loc`Review the contact’s feat grant.` };
  const g = grants[0],
    source = grants.map(g => g.name).join(" + "),
    sources = grants.map(g => ({ id: g.id, name: g.name, theme: g.theme.trim(), mode: g.mode, credit: g.credit }));
  return {
    ...result,
    evidence: {
      ...evidence,
      source,
      featId: g.id,
      theme: g.theme.trim(),
      themeConfirmed: true,
      grantMode: grants.length === 1 ? g.mode : "combined",
      ...(grants.length > 1 ? { sources } : {})
    },
    timeChoices: [
      ...result.timeChoices,
      { id: "contactFeat", name: source, multiplier: 0.5, minimum: 0, rounding: "down" }
    ],
    errorReduction: 2 * grants.length
  };
}

/** Later new Networking contacts gain one extra grade; ordinary improvements do not. */
export function networkingContactFeatGrants(system) {
  const contacts = system.contacts ?? [],
    bindings = system.contactFeatBindings ?? [],
    ranks = system.skillTotals?.networking?.purchasedRanks ?? 0;
  return contacts
    .filter(c => c.networkingFeat || c.networkingMilestone)
    .map(c => {
      const source = bindings.find(b => b.name === c.networkingFeat),
        milestone = c.networkingMilestone,
        earned = (system.skillPoints ?? []).find(s => (s.skills?.networking?.purchasedRanks ?? 0) >= milestone)?.level;
      let reason = "";
      if (!norm(c.name) || contacts.filter(r => norm(r.name) === norm(c.name)).length !== 1)
        reason = loc`Give this new Networking contact a unique name.`;
      else if (!source || !Object.hasOwn(CONTACT_FEATS, c.networkingFeat))
        reason = loc`Choose an earned contact feat for this Networking upgrade.`;
      else if (
        !Number.isSafeInteger(ranks) ||
        ranks < 0 ||
        !Number.isSafeInteger(milestone) ||
        milestone < 4 ||
        milestone % 4 ||
        milestone > ranks ||
        !earned
      )
        reason = loc`Choose an earned four-purchased-rank Networking milestone.`;
      else if (contacts.filter(r => r.networkingMilestone === milestone).length !== 1)
        reason = loc`Each Networking milestone can grant only one new contact or improvement.`;
      else if ((source.acquiredAtLevel ?? 0) > earned)
        reason = loc`This Networking contact was earned before the selected contact feat.`;
      else if (
        bindings.some(
          b =>
            norm(b.primaryName) === norm(c.name) &&
            (b.name === c.networkingFeat || (b.mode ?? "associate") !== "improve")
        )
      )
        reason = loc`A new Networking contact cannot also receive the same feat’s primary grant or another new-associate grant.`;
      else if (
        bindings.some(
          b =>
            norm(b.primaryName) === norm(c.name) &&
            (b.mode ?? "associate") === "improve" &&
            (b.acquiredAtLevel ?? 0) > 0 &&
            b.acquiredAtLevel < earned
        )
      )
        reason = loc`The selected Favored Contacts improvement predates this new Networking contact.`;
      else if (
        (system.skillPurchaseIssues ?? []).some(
          i => (i.skill === "networking" || ["career-budget", "training-budget"].includes(i.code)) && i.level <= earned
        )
      )
        reason = loc`Review the Networking purchases that earned this contact.`;
      else if (!Number.isSafeInteger(c.rank) || c.rank < 2 || c.rank > 4)
        reason = loc`Record this new contact at associate grade or better.`;
      else if (
        typeof c.networkingTheme !== "string" ||
        !c.networkingTheme.trim() ||
        c.networkingTheme.length > 200 ||
        c.networkingFeatConfirmed !== true
      )
        reason = loc`The GC must confirm a new contact gained after taking the feat, with its matching theme.`;
      return {
        name: c.name,
        source: c.networkingFeat,
        milestone,
        earnedAtLevel: earned ?? null,
        featId: source?.id ?? null,
        featAcquiredAtLevel: source?.acquiredAtLevel ?? null,
        theme: c.networkingTheme ?? "",
        valid: !reason,
        reason,
        extraGrades: reason ? 0 : 1
      };
    });
}
