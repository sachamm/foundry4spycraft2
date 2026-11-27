import { stable } from "./equal.mjs";
import { featAcquisitionLevel } from "./career-zero.mjs";
import { loc } from "../i18n.mjs";
import { rollEvidence } from "./outcomes.mjs";

export const DRAINED_CHOICES = ["proficiencies", "focuses", "skillFortes", "interests", "contacts", "wealthAllocation"];
// Provisional passive classification: the condition names Resolve (Wis), without assigning a check category.
// Preserve the classification with each actual attempt so later rulings cannot reinterpret its dice.
export const DRAINED_RECOVERY_MODE = "Passive";
const plain = value => value?.toObject?.() ?? value;
const whole = n => Number.isSafeInteger(n) && n >= 0;
const reserved = new Set(["__proto__", "prototype", "constructor"]);
export const drainedInterests = system =>
  String(system.interests ?? "")
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);

/** Only owned build choices form this proof; equipment, current health and wallets can change normally. */
export function drainedBuildSignature(system, items) {
  return stable({
    progression: system.progression ?? [],
    abilities: Object.fromEntries(Object.entries(system.abilities ?? {}).map(([k, v]) => [k, v.base])),
    abilityIncreases: plain(system.abilityIncreases),
    choices: Object.fromEntries(DRAINED_CHOICES.map(k => [k, plain(system[k]) ?? null])),
    items: items
      .filter(i => ["class", "origin", "feat"].includes(i.type))
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        system: plain(i.system)
      }))
  });
}

/** List selection references without copying or editing the owned options. Acquisition history is not guessed. */
export function drainedChoiceRows(system, items, effectiveLevel) {
  const rows = [];
  for (const [key, value] of Object.entries(system.proficiencies ?? {}))
    for (const field of ["proficient", "forte"])
      if (value[field] === true) rows.push({ id: `proficiency:${key}:${field}`, label: `${key}: ${field}` });
  for (const [key, values] of Object.entries(system.focuses ?? {}))
    values.forEach((value, index) => rows.push({ id: `focus:${key}:${index}`, label: `${key}: ${value}` }));
  (system.skillFortes ?? []).forEach((row, index) =>
    rows.push({ id: `forte:${index}`, label: `${row.skill}: ${row.focus} ${row.forte}` })
  );
  drainedInterests(system).forEach((label, index) => rows.push({ id: `interest:${index}`, label }));
  (system.contacts ?? []).forEach((row, index) =>
    rows.push({ id: `contact:${index}`, label: `${row.name} (${row.rank})` })
  );
  for (const item of items.filter(i => i.type === "feat"))
    rows.push({
      id: `feat:${item.id}`,
      label: item.name,
      later: featAcquisitionLevel(item.system) > effectiveLevel
    });
  return rows;
}

export function drainedSelection(system, items, effectiveLevel, input) {
  const rows = drainedChoiceRows(system, items, effectiveLevel),
    allowed = new Set(rows.map(r => r.id));
  if (
    !Array.isArray(input?.retained) ||
    new Set(input.retained).size !== input.retained.length ||
    input.retained.some(id => !allowed.has(id) || rows.find(r => r.id === id)?.later)
  )
    throw Error(loc`Review the retained options; a later feat cannot remain active while its level is Drained.`);
  const wealth = input.wealth;
  if (
    !wealth ||
    ["lifestyle", "possessions", "spendingCash"].some(
      k => !whole(wealth[k]) || wealth[k] > (system.wealthAllocation?.[k] ?? 0)
    )
  )
    throw Error(loc`Retain only Wealth ranks from the owned build.`);
  return { retained: [...input.retained], wealth: { ...wealth } };
}

export function drainedOverlay(system, items, effectiveLevel, selection) {
  const selected = drainedSelection(system, items, effectiveLevel, selection),
    kept = new Set(selected.retained),
    proficiencies = Object.fromEntries(
      Object.entries(system.proficiencies ?? {}).map(([k, v]) => [
        k,
        {
          ...plain(v),
          proficient: kept.has(`proficiency:${k}:proficient`),
          forte: kept.has(`proficiency:${k}:forte`)
        }
      ])
    ),
    focuses = Object.fromEntries(
      Object.entries(system.focuses ?? {}).map(([k, values]) => [
        k,
        values.filter((_, i) => kept.has(`focus:${k}:${i}`))
      ])
    );
  return {
    choices: {
      proficiencies,
      focuses,
      skillFortes: (system.skillFortes ?? []).filter((_, i) => kept.has(`forte:${i}`)),
      interests: drainedInterests(system)
        .filter((_, i) => kept.has(`interest:${i}`))
        .join(", "),
      contacts: (system.contacts ?? []).filter((_, i) => kept.has(`contact:${i}`)),
      wealthAllocation: { ...plain(system.wealthAllocation), ...selected.wealth }
    },
    items: items.filter(i => i.type !== "feat" || kept.has(`feat:${i.id}`))
  };
}

export function drainedState(system, items, record) {
  const ownedLevel = system.progression?.length ?? 0;
  if (!record || record.levels === 0) return { levels: 0, ownedLevel, effectiveLevel: ownedLevel, needsReview: false };
  if (record.version !== 1 || !whole(record.levels) || record.levels > Math.max(0, ownedLevel - 1))
    throw Error(loc`The GC must correct the Drained level record; a character cannot be reduced below Career Level 1.`);
  const effectiveLevel = ownedLevel - record.levels,
    selection = record.builds?.[`l${effectiveLevel}`],
    signature = drainedBuildSignature(system, items);
  let needsReview = record.signature !== signature || !selection;
  if (!needsReview) {
    try {
      drainedSelection(system, items, effectiveLevel, selection);
    } catch {
      needsReview = true;
    }
  }
  return { levels: record.levels, ownedLevel, effectiveLevel, needsReview, selection: needsReview ? null : selection };
}

export function drainedApplicationPlan(system, items, record, input) {
  if (
    typeof input.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(input.id) ||
    reserved.has(input.id) ||
    !input.source?.trim() ||
    input.confirmed !== true ||
    !input.note?.trim() ||
    !input.reviewer ||
    !Number.isFinite(input.at)
  )
    throw Error(loc`The GC must confirm the Drained source, retained build and review note.`);
  if (record?.applications?.[input.id]) return record;
  if (Object.values(record?.recoveries ?? {}).some(r => r.state !== "completed"))
    throw Error(loc`Finish or review the original mission-end recovery before another Drained application.`);
  const old = drainedState(system, items, record);
  if (old.needsReview) throw Error(loc`Review the current Drained build before another loss.`);
  if (!Number.isSafeInteger(input.levels) || input.levels < 1)
    throw Error(loc`Choose a positive number of Drained levels.`);
  const levels = Math.min(Math.max(0, old.ownedLevel - 1), old.levels + input.levels),
    effectiveLevel = old.ownedLevel - levels;
  if (levels === old.levels && old.ownedLevel > 1)
    throw Error(loc`Drained cannot reduce this character below Career Level 1.`);
  const selection = drainedSelection(system, items, effectiveLevel, input);
  return {
    version: 1,
    ...record,
    levels,
    signature: drainedBuildSignature(system, items),
    builds: { ...record?.builds, [`l${effectiveLevel}`]: selection },
    applications: {
      ...record?.applications,
      [input.id]: {
        source: input.source.trim(),
        requested: input.levels,
        applied: levels - old.levels,
        reviewer: input.reviewer,
        note: input.note.trim(),
        at: input.at
      }
    },
    recoveries: { ...record?.recoveries }
  };
}

/** The engine uses a temporary view; the actual advancement and choices are always restored, even on failure. */
export function computeDrainedAgent(system, items, cfg, options, compute) {
  let state;
  try {
    state = drainedState(system, items, options.drained);
  } catch (error) {
    // Invalid imported flags must not prevent the character from loading for GC correction.
    compute(system, items, cfg, { ...options, drainedProjection: true });
    system.drainedState = { needsReview: true, problem: error.message, ownedLevel: system.progression?.length ?? 0 };
    system.warnings.push(error.message);
    system.todo.unshift({ order: 0, tab: "combat", error: true, always: true, text: error.message });
    return system;
  }
  if (!state.levels) return null;
  const saved = Object.fromEntries(
      ["progression", ...DRAINED_CHOICES].map(k => [k, { present: Object.hasOwn(system, k), value: system[k] }])
    ),
    empty = { retained: [], wealth: { lifestyle: 0, possessions: 0, spendingCash: 0 } },
    overlay = drainedOverlay(system, items, state.effectiveLevel, state.selection ?? empty);
  try {
    system.progression = system.progression.slice(0, state.effectiveLevel);
    Object.assign(system, overlay.choices);
    compute(system, overlay.items, cfg, { ...options, drainedProjection: true });
    system.drainedState = state;
    const text = state.needsReview
      ? loc`Drained history changed. The GC must review retained options before checks or abilities.`
      : loc`Drained: Career Level ${state.effectiveLevel} of ${state.ownedLevel}. The original build remains saved; recovery is available at mission end (pp.340–341).`;
    system.warnings.push(text);
    if (state.needsReview) system.todo.unshift({ order: 0, tab: "combat", error: true, always: true, text });
    return system;
  } finally {
    for (const [key, row] of Object.entries(saved)) {
      if (row.present) system[key] = row.value;
      else delete system[key];
    }
  }
}

export function reviewDrainedPlan(system, items, record, input) {
  const corrected = Object.hasOwn(input, "correctedLevels"),
    levels = corrected ? input.correctedLevels : record?.levels;
  if (
    (!corrected && record?.version !== 1) ||
    !whole(levels) ||
    levels > Math.max(0, (system.progression?.length ?? 0) - 1) ||
    (corrected && input.levelCountVerified !== true)
  )
    throw Error(loc`Review the actual Drained level count before retaining build options.`);
  if (input.confirmed !== true || !input.note?.trim() || !input.reviewer || !Number.isFinite(input.at))
    throw Error(loc`The GC must confirm the retained build and review note.`);
  const level = system.progression.length - levels;
  return {
    ...record,
    version: 1,
    levels,
    signature: drainedBuildSignature(system, items),
    builds: { ...record?.builds, ...(levels ? { [`l${level}`]: drainedSelection(system, items, level, input) } : {}) },
    review: {
      reviewer: input.reviewer,
      note: input.note.trim(),
      at: input.at,
      ...(corrected ? { previousLevels: record?.levels ?? null, previousVersion: record?.version ?? null } : {})
    }
  };
}

export function beginDrainedRecovery(system, items, record, { mission, attempt, confirmed, at } = {}) {
  const state = drainedState(system, items, record);
  if (
    !state.levels ||
    state.needsReview ||
    confirmed !== true ||
    typeof mission !== "string" ||
    !mission ||
    reserved.has(mission) ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(attempt ?? "") ||
    !Number.isFinite(at)
  )
    throw Error(loc`Verify the current Drained build and actual end of this mission before recovery.`);
  if (record.recoveries?.[mission])
    throw Error(loc`This mission already has a Drained recovery attempt. Keep its original dice.`);
  if (Object.values(record.recoveries ?? {}).some(r => r.state !== "completed"))
    throw Error(loc`Finish or review the previous mission's original recovery attempt first.`);
  const recovery = {
    attempt,
    mission,
    levels: state.levels,
    dc: 15 + 5 * state.levels,
    mode: DRAINED_RECOVERY_MODE,
    state: "rolling",
    at
  };
  return { ...record, recoveries: { ...record.recoveries, [mission]: recovery } };
}

export function settleDrainedRecovery(system, items, record, mission, message, at) {
  const state = drainedState(system, items, record),
    recovery = record?.recoveries?.[mission],
    check = message?.flags?.spycraft2;
  if (recovery?.state === "completed") return record;
  if (
    !state.levels ||
    state.needsReview ||
    state.levels !== recovery?.levels ||
    !["rolling", "posted", "needsReview"].includes(recovery?.state) ||
    check?.drainedRecovery?.attempt !== recovery.attempt ||
    check.drainedRecovery.mission !== mission ||
    check.drainedRecovery.dc !== recovery.dc ||
    check.drainedRecovery.mode !== recovery.mode ||
    check.drainedRecovery.levels !== recovery.levels ||
    check.checkKind !== "skill" ||
    check.skillKey !== "resolve" ||
    check.ability !== "wis" ||
    check.checkId !== "drained-recovery" ||
    check.checkMethod !== "roll" ||
    check.resolved !== true ||
    typeof check.successConfirmed !== "boolean" ||
    check.superseded ||
    !Number.isFinite(check.effectiveTotal) ||
    !Number.isFinite(at)
  )
    throw Error(
      loc`Finish the original Resolve (Wis) recovery check and review the unchanged Drained history before settlement.`
    );
  if (
    !check.criticalSuccess &&
    !check.criticalFailure &&
    check.successConfirmed !== check.effectiveTotal >= recovery.dc
  )
    throw Error(loc`The confirmed recovery outcome disagrees with its actual result and original DC.`);
  return {
    ...record,
    levels: record.levels - (check.successConfirmed ? 1 : 0),
    recoveries: {
      ...record.recoveries,
      [mission]: {
        ...recovery,
        state: "completed",
        messageUuid: message.uuid,
        succeeded: check.successConfirmed,
        evidence: rollEvidence(check),
        completedAt: at
      }
    }
  };
}

export function reviewDrainedRecoveryPlan(system, items, record, mission, input) {
  const state = drainedState(system, items, record),
    recovery = record?.recoveries?.[mission];
  if (
    !recovery ||
    recovery.state === "completed" ||
    state.needsReview ||
    state.levels !== recovery.levels ||
    !input.reviewer ||
    !Number.isFinite(input.at) ||
    !input.note?.trim()
  )
    throw Error(loc`Review the original unfinished recovery and unchanged Drained build.`);
  const recoveries = { ...record.recoveries },
    review = {
      attempt: recovery.attempt,
      mission,
      reviewer: input.reviewer,
      note: input.note.trim(),
      at: input.at,
      mode: input.mode
    };
  if (input.mode === "unused") {
    if (input.noDiceConfirmed !== true || input.noEffectsConfirmed !== true)
      throw Error(
        loc`Verify both that no recovery dice were rolled and no level was restored before releasing the unused attempt.`
      );
    delete recoveries[mission];
  } else {
    if (!["success", "failure"].includes(input.mode) || input.actualOutcomeConfirmed !== true)
      throw Error(loc`The GC must verify the original recovery dice and actual outcome before recording it.`);
    recoveries[mission] = {
      ...recovery,
      state: "completed",
      succeeded: input.mode === "success",
      review,
      completedAt: input.at
    };
  }
  return {
    ...record,
    recoveries,
    levels: record.levels - (input.mode === "success" ? 1 : 0),
    recoveryReviews: [...(record.recoveryReviews ?? []), review]
  };
}
