import { originRuleName, ruleName } from "./rule-name.mjs";
import { loc } from "../i18n.mjs";
const norm = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
export function proficiencyTotals(system, cfg, bonus, available) {
  const totals = {},
    hints = {},
    warnings = [];
  let used = 0;
  // Picks beyond the earned allowance are recorded but give nothing; they are dropped in list order (pp.27–28).
  const unpaid = [];
  const pay = () => used++ < available;
  for (const [key, selected] of Object.entries(system.proficiencies ?? {}))
    if (!Object.hasOwn(cfg.proficiencies, key) && (selected?.proficient || selected?.forte))
      warnings.push(loc`Unknown weapon proficiency ${key}: choose a listed proficiency.`);
  for (const key of Object.keys(cfg.proficiencies)) {
    const selected = system.proficiencies?.[key] ?? {};
    for (const field of ["proficient", "forte"])
      if (selected[field] !== undefined && typeof selected[field] !== "boolean")
        warnings.push(loc`${cfg.proficiencies[key].label}: review the saved ${field} selection.`);
    const selectedProficiency = selected.proficient === true,
      selectedForte = selected.forte === true;
    const granted = bonus(`prof.${key}`) > 0;
    const forteGranted = bonus(`forte.${key}`) > 0;
    const paidProficiency = selectedProficiency && !granted ? pay() : false;
    if (selectedProficiency && !granted && !paidProficiency) unpaid.push(cfg.proficiencies[key].label);
    const proficient = granted || paidProficiency;
    const paidForte = selectedForte && !forteGranted && proficient ? pay() : false;
    if (selectedForte && !forteGranted && proficient && !paidForte)
      unpaid.push(loc`${cfg.proficiencies[key].label} forte`);
    const forte = proficient && (forteGranted || paidForte);
    if ((selectedForte || forteGranted) && !proficient)
      warnings.push(loc`${cfg.proficiencies[key].label}: a forte requires its weapon proficiency.`);
    totals[key] = { proficient, forte, granted, forteGranted };
    hints[key] = granted;
  }
  if (unpaid.length) warnings.push(loc`Not applied until a pick is earned: ${unpaid.join(", ")}.`);
  return { totals, picks: { available, used, remaining: available - used, hints }, warnings };
}

export function focusTotals(system, items, cfg, bonus, { level, startingIntelligence, activeFeatIds = new Set() }) {
  const aliases = cfg.tables.focusAliases ?? {};
  const canonical = value => (typeof value === "string" ? String(aliases[value.trim()] ?? value).trim() : "");
  const groups = ["cultures", "drive", "profession", "science"];
  const totals = {};
  const forced = Object.fromEntries(groups.map(key => [key, new Set()]));
  const warnings = [],
    pending = [],
    forteGrants = [];
  for (const key of groups) {
    const seen = new Set();
    totals[key] = [];
    for (const value of system.focuses?.[key] ?? []) {
      const focus = canonical(value),
        normalized = norm(focus);
      if (!focus || focus.length > 200) {
        warnings.push(loc`${key}: name each focus with 1–200 characters.`);
        continue;
      }
      if (seen.has(normalized)) {
        warnings.push(loc`${key}: ${focus} is listed more than once; choose distinct focuses.`);
        continue;
      }
      seen.add(normalized);
      totals[key].push(focus);
    }
  }
  for (const item of items.filter(i => i.type === "origin")) {
    const rules = cfg.tables.originFocuses?.[originRuleName(item)] ?? {};
    for (const [key, values] of Object.entries(rules.fixed ?? {}))
      for (const value of values) {
        forced[key].add(value);
        if (!totals[key].includes(value)) totals[key].push(value);
      }
    let focus = "",
      skill = rules.choiceSkill;
    if (skill) {
      const selected = String(item.system.originChoices?.grantedFocus ?? "").trim();
      if (!selected) pending.push({ tab: "main", text: loc`${item.name}: choose its granted ${skill} focus on Main.` });
      else if (rules.domain && !rules.domain.includes(canonical(selected)))
        warnings.push(loc`${item.name}: its granted focus must come from the permitted vehicle category.`);
      else {
        focus = canonical(selected);
        forced[skill].add(focus);
        if (!totals[skill].some(value => norm(value) === norm(focus))) totals[skill].push(focus);
      }
    } else if (rules.forte) {
      const entry = Object.entries(rules.fixed ?? {})[0];
      if (entry) {
        skill = entry[0];
        focus = entry[1][0];
      }
    }
    if (rules.forte) forteGrants.push({ name: item.name, skill, focus });
  }
  // A forte must name an owned focus and a subdivision of it, once (p.98). Rows that don't give no bonus.
  const seen = new Set(),
    fortes = [];
  for (const row of system.skillFortes ?? []) {
    const valid =
      groups.includes(row.skill) &&
      totals[row.skill].some(value => norm(value) === norm(canonical(row.focus))) &&
      !!row.forte?.trim();
    if (!valid) {
      warnings.push(loc`A skill forte must name an owned focus and one of its subdivisions.`);
      continue;
    }
    const key = `${row.skill}|${norm(canonical(row.focus))}|${norm(row.forte)}`;
    if (seen.has(key)) {
      warnings.push(loc`The ${row.forte.trim()} forte is listed twice; it counts once.`);
      continue;
    }
    seen.add(key);
    fortes.push(row);
  }
  const picks = {};
  let genericUsed = (system.focuses?.fortes ?? []).length;
  for (const key of groups) {
    const rankPicks = Math.floor(
      (system.skillTotals?.[key]?.purchasedRanks ?? system.skillTotals?.[key]?.ranks ?? 0) / 4
    );
    const base = (level > 0 ? 1 : 0) + rankPicks + bonus(`focus.${key}`);
    const reservedFortes = bonus(`focusForte.${key}`);
    const selectedFortes = fortes.filter(row => row.skill === key).length;
    const claimed = new Set(),
      grants = forteGrants.filter(grant => grant.skill === key);
    for (const grant of grants) {
      const index = fortes.findIndex(
        (row, index) =>
          !claimed.has(index) &&
          row.skill === key &&
          row.forte?.trim() &&
          grant.focus &&
          norm(canonical(row.focus)) === norm(grant.focus)
      );
      if (index >= 0) claimed.add(index);
      else pending.push(loc`${grant.name}: choose its granted forte in ${grant.focus || "the granted focus"}.`);
    }
    const unrestricted = Math.max(0, reservedFortes - grants.length);
    const otherEligible = fortes.filter(
      (row, index) =>
        !claimed.has(index) &&
        row.skill === key &&
        row.forte?.trim() &&
        totals[key].some(value => norm(value) === norm(canonical(row.focus)))
    ).length;
    const reservedUsed = claimed.size + Math.min(unrestricted, otherEligible);
    const spent = totals[key].length + Math.max(0, selectedFortes - reservedUsed);
    const general = Math.max(0, spent - base);
    genericUsed += general;
    picks[key] = {
      baseAvailable: base,
      available: base + general + reservedFortes,
      used: totals[key].length + selectedFortes,
      remaining: Math.max(0, base - spent) + Math.max(0, reservedFortes - reservedUsed),
      genericSpent: general
    };
    if (unrestricted > otherEligible)
      pending.push(loc`${key}: choose ${unrestricted - otherEligible} granted forte(s) relating to the granted focus.`);
  }
  const unscopedUsed = genericUsed;
  picks.generic = {
    available: (level > 0 ? Math.max(0, startingIntelligence) : 0) + bonus("focus.generic"),
    used: genericUsed
  };
  picks.generic.remaining = picks.generic.available - genericUsed;
  if (picks.generic.remaining < 0)
    warnings.push(loc`Focuses/fortes: ${-picks.generic.remaining} more flexible picks spent than available.`);
  const temporaryGrants = [],
    activeFortes = fortes.map(row => ({ ...row }));
  for (const feat of items.filter(
    i =>
      i.type === "feat" &&
      ruleName(i) === "Depth of Study" &&
      i.system.featKind === "temporary" &&
      activeFeatIds.has(i.id)
  )) {
    const source = { itemId: feat.id, name: feat.name, available: 2, used: 0, choices: [] };
    temporaryGrants.push(source);
    try {
      const choices = temporaryFocusPlan(
        { ...system, featStatus: { ...system.featStatus, [feat.id]: { ok: true } } },
        feat,
        feat.system.focusChoices ?? [],
        cfg,
        { ownedFocuses: totals, ownedFortes: activeFortes, allowPartial: true }
      );
      for (const row of choices) {
        if (row.kind === "focus") {
          totals[row.skill].push(row.focus);
          forced[row.skill].add(row.focus);
        } else activeFortes.push({ ...row, sourceItemId: feat.id });
        picks[row.skill].used++;
        picks[row.skill].available++;
      }
      source.choices = choices;
      source.used = choices.length;
    } catch (error) {
      warnings.push(loc`Temporary Depth of Study (${feat.id}): ${error.message}`);
    }
    if (source.used < 2)
      pending.push(
        loc`Temporary Depth of Study (${feat.id}): choose ${2 - source.used} source-scoped focus/forte pick(s) on Training.`
      );
  }
  picks.generic.reservedAvailable = temporaryGrants.length * 2;
  picks.generic.reservedUsed = temporaryGrants.reduce((n, g) => n + g.used, 0);
  picks.generic.unscopedAvailable = picks.generic.available - picks.generic.reservedAvailable;
  picks.generic.unscopedRemaining = picks.generic.unscopedAvailable - unscopedUsed;
  picks.generic.used += picks.generic.reservedUsed;
  picks.generic.remaining = picks.generic.available - picks.generic.used;
  if (picks.generic.reservedAvailable && picks.generic.unscopedRemaining < 0)
    warnings.push(
      loc`Ordinary focus selections exceed their permanent allowance; temporary Depth of Study choices must use their source on Training. Review legacy choice provenance.`
    );
  return { totals, forced, picks, warnings, pending, temporaryGrants, activeFortes };
}

/** Contacts spend whole grades; incomplete or ambiguous rows stay visible for correction. */
export function contactChoices(contacts = []) {
  const warnings = [],
    names = new Map();
  let used = 0;
  for (const [index, contact] of contacts.entries()) {
    const name = typeof contact?.name === "string" ? contact.name.trim() : "";
    if (!name || name.length > 200) warnings.push(loc`Contact ${index + 1}: enter a name with 1–200 characters.`);
    else names.set(norm(name), [...(names.get(norm(name)) ?? []), index + 1]);
    if (!Number.isSafeInteger(contact?.rank) || contact.rank < 1 || contact.rank > 4)
      warnings.push(loc`Contact ${index + 1}: choose a whole grade from acquaintance (1) to partner (4).`);
    else used += contact.rank;
  }
  for (const rows of names.values())
    if (rows.length > 1)
      warnings.push(loc`Contacts ${rows.join(", ")}: use distinct names so each contact can be identified.`);
  return { used, warnings };
}

/** pp.98,171,200: temporary Depth of Study owns its two choices, never permanent selections. */
export function temporaryFocusPlan(
  system,
  feat,
  choices,
  cfg,
  {
    ownedFocuses = system.focusTotals ?? system.focuses ?? {},
    ownedFortes = system.skillForteTotals ?? system.skillFortes ?? [],
    allowPartial = false
  } = {}
) {
  if (
    feat?.type !== "feat" ||
    ruleName(feat) !== "Depth of Study" ||
    feat.system.featKind !== "temporary" ||
    system.featStatus?.[feat.id]?.ok !== true
  )
    throw new Error(loc`Choose an active temporary Depth of Study feat.`);
  if (!Array.isArray(choices) || choices.length > 2 || (!allowPartial && choices.length !== 2))
    throw new Error(loc`Choose exactly two focuses or fortes for this temporary feat.`);
  const owned = Object.fromEntries(
      ["cultures", "drive", "profession", "science"].map(key => [key, [...(ownedFocuses[key] ?? [])]])
    ),
    fortes = ownedFortes.map(row => ({ ...row })),
    out = [];
  const canonical = value => cfg.tables.focusAliases?.[value] ?? value;
  for (const row of choices) {
    if (
      !row ||
      !["focus", "forte"].includes(row.kind) ||
      !Object.hasOwn(owned, row.skill) ||
      typeof row.focus !== "string" ||
      !row.focus.trim()
    )
      throw new Error(loc`Each temporary choice needs a focus skill, a focus, and its choice type.`);
    const focus = canonical(row.focus.trim()),
      forte = String(row.forte ?? "").trim();
    if (row.skill !== "profession" && !cfg.focuses[row.skill]?.includes(focus))
      throw new Error(loc`Choose a focus from the skill’s printed list.`);
    if (row.kind === "focus") {
      if (owned[row.skill].some(v => norm(v) === norm(focus)))
        throw new Error(loc`This focus is already possessed or selected.`);
      if (forte) throw new Error(loc`A focus choice cannot also select a forte.`);
      owned[row.skill].push(focus);
    } else {
      if (!owned[row.skill].some(v => norm(v) === norm(focus)) || !forte)
        throw new Error(loc`A forte needs a previously owned focus and a named subdivision.`);
      if (fortes.some(v => v.skill === row.skill && norm(v.focus) === norm(focus) && norm(v.forte) === norm(forte)))
        throw new Error(loc`This forte is already possessed or selected.`);
      fortes.push({ skill: row.skill, focus, forte });
    }
    out.push({ kind: row.kind, skill: row.skill, focus, forte });
  }
  return out;
}
