import { NPC_STATS } from "./npcs.mjs";
import { validateNpcFeats } from "./npc-feats.mjs";
import { ruleName } from "./rule-name.mjs";
import { sameValues, stable } from "./equal.mjs";
import { loc } from "../i18n.mjs";

const idOf = item => item.id ?? item._id;
const safeId = value =>
  typeof value === "string" &&
  /^[A-Za-z0-9_-]{1,80}$/.test(value) &&
  !["__proto__", "prototype", "constructor"].includes(value);
const roleOf = system =>
  system.animalPartner || system.promoted || ["special", "villain"].includes(system.npcType) ? "special" : "standard";
export const ownedNpcProfile = actor =>
  actor?._source?.system?.npcProfile ?? actor?.system?.undrainedNpcProfile ?? actor?.system?.npcProfile;
export const npcDrainedBuildSignature = actor =>
  stable({
    profile: ownedNpcProfile(actor),
    role: roleOf(actor.system),
    baseLevel: actor.system.undrainedThreatLevel ?? actor.system.effectiveThreatLevel,
    items: [...actor.items]
      .filter(i => ["feat", "class", "origin"].includes(i.type))
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        system: i.system.toObject?.() ?? i.system
      }))
  });

/** The actor's original profile remains the editor's source. Runtime qualities and bonuses use a temporary view. */
export function readNpcDrained(record) {
  if (!record) return { levels: 0, stack: [], losses: [] };
  if (
    record.kind !== "npc" ||
    record.version !== 1 ||
    !Array.isArray(record.stack) ||
    new Set(record.stack).size !== record.stack.length ||
    record.levels !== record.stack.length
  )
    throw Error(loc`The GC must review this NPC's Drained history.`);
  const losses = record.stack.map(id => {
    const loss = record.losses?.[id];
    if (
      !safeId(id) ||
      !loss ||
      !["standard", "special"].includes(loss.role) ||
      typeof loss.manualStats !== "boolean" ||
      typeof loss.source !== "string" ||
      !loss.source.trim() ||
      !Number.isFinite(loss.at)
    )
      throw Error(loc`Review the original NPC Drained source and its recorded scope.`);
    if (loss.role === "standard") {
      const target = loss.forfeit;
      if (
        !target ||
        !["quality", "feat", "manual", "none"].includes(target.kind) ||
        (["quality", "feat"].includes(target.kind) && !safeId(target.id))
      )
        throw Error(loc`Review the standard NPC's original forfeited quality.`);
    }
    return { ...loss, id };
  });
  return { levels: losses.length, stack: [...record.stack], losses };
}

/** Losing a prerequisite also suspends dependent NPC feats; the owned documents are never deleted. */
export function npcDrainedItems(items, record, profile) {
  const losses = readNpcDrained(record).losses,
    forfeited = new Set(losses.filter(l => l.role === "standard" && l.forfeit.kind === "feat").map(l => l.forfeit.id));
  if (!forfeited.size) return items;
  const catalog = items.filter(i => i.type === "feat"),
    candidates = catalog.filter(i => !forfeited.has(idOf(i))),
    selections = candidates.map(i => ({ id: idOf(i), name: ruleName(i), choice: i.system?.choice ?? "" })),
    qualified = new Set(
      validateNpcFeats(selections, catalog, { qualities: profile?.qualities ?? [] }).qualifiedIds ?? []
    );
  return items.filter(i => i.type !== "feat" || qualified.has(idOf(i)));
}

export function npcDrainedProjection(
  system,
  items,
  record,
  {
    profile = system.npcProfile,
    baseLevel = system.undrainedThreatLevel ?? system.effectiveThreatLevel ?? system.threatLevel
  } = {}
) {
  const state = readNpcDrained(record);
  if (!state.levels)
    return { profile, items, state: { ...state, needsReview: false, baseLevel, effectiveLevel: baseLevel } };
  if (!Number.isSafeInteger(baseLevel) || baseLevel < 1 || baseLevel > 20)
    throw Error(loc`Review this NPC's original Threat Level before applying Drained.`);
  const projected = structuredClone(profile),
    standard = state.losses.filter(l => l.role === "standard"),
    gradeLosses = standard.filter(l => !l.manualStats).length,
    qualityIds = new Set(standard.filter(l => l.forfeit.kind === "quality").map(l => l.forfeit.id)),
    rows = profile?.qualities ?? [];
  for (const id of qualityIds)
    if (rows.filter(q => q.entryId === id).length > 1)
      throw Error(loc`A forfeited quality has duplicate history references. The GC must identify its actual source.`);
  if (projected?.enabled && gradeLosses) {
    for (const key of Object.keys(NPC_STATS)) {
      const grade = projected.grades?.[key];
      if (key === "wealth" && grade === 0) continue;
      if (!Number.isSafeInteger(grade) || grade < 1 || grade > 10)
        throw Error(loc`Review the NPC's original ${key} grade before applying Drained.`);
      projected.grades[key] = Math.max(1, grade - gradeLosses);
    }
    projected.skills = (projected.skills ?? []).map(row => {
      if (!Number.isSafeInteger(row.grade) || row.grade < 1 || row.grade > 10)
        throw Error(loc`Review the NPC's original named skill grades before applying Drained.`);
      return { ...row, grade: Math.max(1, row.grade - gradeLosses) };
    });
  }
  if (projected) projected.qualities = rows.filter(q => !qualityIds.has(q.entryId));
  const effectiveLevel = Math.max(1, baseLevel - state.losses.filter(l => l.role === "special").length),
    missingQuality = [...qualityIds].some(id => !rows.some(q => q.entryId === id));
  return {
    profile: projected,
    items: npcDrainedItems(items, record, profile),
    state: {
      ...state,
      needsReview: false,
      baseLevel,
      effectiveLevel,
      gradeLosses,
      roleChanged: state.losses.some(l => l.role !== roleOf(system)),
      manualRestoration:
        missingQuality ||
        state.losses.some(l => l.manualStats || l.forfeit?.kind === "manual" || l.classOptionsReviewed),
      manualStats: state.losses.some(l => l.manualStats),
      missingQuality
    }
  };
}

export function npcDrainedApplicationPlan(system, items, record, input, qualityIds = []) {
  const old = npcDrainedProjection(system, items, record),
    role = roleOf(system);
  if (
    !safeId(input.id) ||
    input.id.length > 70 ||
    typeof input.source !== "string" ||
    !input.source.trim() ||
    input.source.length > 1000 ||
    input.confirmed !== true ||
    !input.reviewer ||
    !Number.isFinite(input.at) ||
    !Number.isSafeInteger(input.levels) ||
    input.levels < 1
  )
    throw Error(loc`The GC must confirm the NPC Drained source and actual loss.`);
  if (record?.applications?.[input.id]) return { record, profile: system.npcProfile, applied: 0, duplicate: true };
  if (Object.values(record?.recoveries ?? {}).some(r => r?.state !== "completed"))
    throw Error(loc`Finish or review the NPC's original recovery attempt before another Drained loss.`);
  if (old.profile?.enabled && old.profile.qualities?.some(q => q.id === "construct"))
    throw Error(loc`Constructs cannot gain Drained.`);
  const manualStats = system.npcProfile?.enabled !== true;
  if (manualStats && input.manualStatsHandled !== true)
    throw Error(loc`The GC must adjust this manual NPC's lost statistics separately before recording Drained.`);
  const classOptions =
    items.some(i => ["class", "origin"].includes(i.type)) ||
    (system.npcProfile?.qualities ?? []).some(q => ["classAbility", "talented", "specialty"].includes(q.id));
  if (classOptions && input.classOptionsReviewed !== true)
    throw Error(loc`Review the NPC's class-supplied and Origin benefits separately before recording their forfeiture.`);
  const profile = structuredClone(system.npcProfile),
    rows = profile?.qualities ?? [];
  if (
    qualityIds.length !== rows.length ||
    new Set(qualityIds).size !== qualityIds.length ||
    qualityIds.some(id => !safeId(id))
  )
    throw Error(loc`Review the owned quality references before recording this loss.`);
  rows.forEach((row, index) => {
    row.entryId = qualityIds[index];
  });
  const stack = [...old.state.stack],
    losses = { ...record?.losses },
    applied = role === "standard" ? 1 : Math.min(input.levels, Math.max(0, old.state.effectiveLevel - 1));
  let forfeit = null;
  if (role === "standard") {
    if (input.levels !== 1) throw Error(loc`Resolve each standard NPC Drained application separately.`);
    const target = input.forfeit;
    const forfeitedFeats = new Set(old.state.losses.filter(l => l.forfeit?.kind === "feat").map(l => l.forfeit.id));
    if (target?.kind === "quality") {
      const index = Number(target.index),
        chosen = rows[index];
      if (
        !Number.isSafeInteger(index) ||
        !chosen ||
        system.npcProfile?.enabled !== true ||
        !old.profile?.qualities?.some(q => sameValues(q, system.npcProfile.qualities[index]))
      )
        throw Error(loc`Choose a quality the NPC has not already forfeited.`);
      forfeit = { kind: "quality", id: chosen.entryId, before: structuredClone(chosen) };
    } else if (target?.kind === "feat") {
      const feat = items.find(i => i.type === "feat" && idOf(i) === target.id && !forfeitedFeats.has(idOf(i)));
      if (!feat) throw Error(loc`Choose an owned NPC feat that has not already been forfeited.`);
      forfeit = { kind: "feat", id: idOf(feat), name: feat.name };
    } else if (target?.kind === "manual" && input.manualQualityHandled === true) {
      forfeit = { kind: "manual", note: String(input.note ?? "").trim() };
      if (!forfeit.note) throw Error(loc`Record the actual quality loss handled by the GC.`);
    } else if (
      target?.kind === "none" &&
      !(old.profile?.enabled && old.profile.qualities.length) &&
      !items.some(i => i.type === "feat" && !forfeitedFeats.has(idOf(i))) &&
      !system.manualRole &&
      input.noQualityConfirmed === true
    )
      forfeit = { kind: "none" };
    else throw Error(loc`Choose the actual forfeited quality, or verify that none remains.`);
  }
  for (let index = 0; index < applied; index++) {
    const id = `${input.id}_${index}`;
    stack.push(id);
    losses[id] = {
      role,
      source: input.source.trim(),
      at: input.at,
      reviewer: input.reviewer,
      manualStats,
      classOptionsReviewed: classOptions,
      ...(forfeit ? { forfeit } : {})
    };
  }
  const next = {
    version: 1,
    kind: "npc",
    ...record,
    levels: stack.length,
    stack,
    losses,
    applications: {
      ...record?.applications,
      [input.id]: { source: input.source.trim(), requested: input.levels, applied, role, at: input.at }
    },
    recoveries: { ...record?.recoveries }
  };
  npcDrainedProjection({ ...system, npcProfile: profile }, items, next);
  return { record: next, profile, applied };
}
