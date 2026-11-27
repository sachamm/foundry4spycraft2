import { loc } from "../i18n.mjs";

export const acidSourceId = id =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id);
const whole = value => Number.isSafeInteger(value) && value >= 0;
const phases = ["end", "round", "gone"];

/** Remaining DR is declared after this attack's original AP and the affected armor's actual Damage saves. */
export function acidProtection(value) {
  if (
    !value ||
    !Number.isSafeInteger(value.ap) ||
    value.ap < 1 ||
    !whole(value.reduction) ||
    !whole(value.unarmoredReduction) ||
    value.unarmoredReduction > value.reduction ||
    typeof value.armorHit !== "boolean" ||
    typeof value.armorPresent !== "boolean" ||
    typeof value.armorSaveVerified !== "boolean"
  )
    throw Error(loc`Verify this acid attack's AP, remaining DR and affected armor before continuing.`);
  if ((!value.armorHit || !value.armorPresent) && value.reduction !== value.unarmoredReduction)
    throw Error(loc`Acid on clothes or after armor removal cannot use worn-armor DR.`);
  if (value.armorHit && value.armorPresent && !value.armorSaveVerified)
    throw Error(loc`Resolve the affected armor's Damage saves before using its DR against acid.`);
  return { ...value };
}

export function readAcidSource(hazards, id) {
  const source = acidSourceId(id) && Object.hasOwn(hazards?.acidSources ?? {}, id) ? hazards.acidSources[id] : null;
  if (
    !source ||
    source.version !== 1 ||
    typeof source.label !== "string" ||
    !source.label.trim() ||
    source.label.length > 100 ||
    !whole(source.damage) ||
    !whole(source.suffered) ||
    !whole(source.rounds) ||
    !phases.includes(source.phase) ||
    typeof source.injuryChecked !== "boolean" ||
    typeof source.needsReview !== "boolean" ||
    typeof source.provenSingleAttack !== "boolean" ||
    (!source.provenSingleAttack && !source.needsReview && (source.damage > 0 || !source.injuryChecked)) ||
    (source.damage === 0) !== (source.phase === "gone")
  )
    throw Error(loc`Review this acid attack's name, damage, timing and injury history before continuing.`);
  if (!source.needsReview && (source.damage > 0 || source.protection != null)) acidProtection(source.protection);
  return source;
}

export const acidInjuryDue = source => source.suffered >= 25 && !source.injuryChecked;

/** Compatibility summary only: each attack keeps its own defenses and injury threshold. Never apply this sum. */
export function writeAcidSource(hazards, id, source) {
  const acidSources = { ...hazards?.acidSources, [id]: source },
    current = { ...hazards, acidSources },
    active = Object.keys(acidSources)
      .map(key => [key, readAcidSource(current, key)])
      .filter(([, row]) => row.damage > 0);
  const acid = active.length
    ? {
        version: 2,
        sourceIds: active.map(([key]) => key),
        damage: active.reduce((sum, [, row]) => sum + row.damage, 0),
        suffered: active.reduce((sum, [, row]) => sum + row.suffered, 0),
        injuryChecked: active.every(([, row]) => row.injuryChecked),
        startedAt: active[0][1].startedAt ?? null
      }
    : null;
  return { ...hazards, acidSources, acid };
}

/** The first exposure starts its own attack record after the actual damage has been settled. */
export function acidAttackPlan(
  hazards,
  { id, label, damage, suffered, protection, at = null, combat = null, hitContext = {} } = {}
) {
  if (
    !acidSourceId(id) ||
    Object.hasOwn(hazards?.acidSources ?? {}, id) ||
    typeof label !== "string" ||
    !label.trim() ||
    label.length > 100 ||
    !whole(damage) ||
    damage < 1 ||
    !whole(suffered) ||
    suffered > damage
  )
    throw Error(
      loc`Record a new acid attack with its actual initial damage; do not merge or repeat an earlier attack.`
    );
  if (hazards?.acid && !Array.isArray(hazards.acid.sourceIds))
    throw Error(loc`Review the older merged acid history before recording another attack.`);
  const source = {
    version: 1,
    provenSingleAttack: true,
    label: label.trim(),
    damage,
    suffered,
    protection: protection == null ? null : acidProtection(protection),
    startedAt: at,
    phase: "end",
    rounds: 0,
    injuryChecked: false,
    needsReview: protection == null,
    lastCombat: combat,
    hitContext: { ...hitContext }
  };
  return { hazards: writeAcidSource(hazards, id, source), source };
}

/** Save intent before health changes or NPC dice. A pending round cannot be replayed. */
export function beginAcidRound(
  hazards,
  id,
  { attempt, protection, combat = null, resistanceSource, bruiseResistanceSource } = {}
) {
  const old = readAcidSource(hazards, id);
  if (old.needsReview || old.roundAttempt?.state === "applying")
    throw Error(loc`The GC must review this acid attack's interrupted or unknown history.`);
  if (old.phase !== "round") throw Error(loc`Finish the acid's end-of-round halving before applying its next round.`);
  if (!acidSourceId(attempt)) throw Error(loc`Record this acid round's application before changing health.`);
  const defenses = acidProtection(protection);
  if (defenses.ap !== old.protection.ap || defenses.armorHit !== old.protection.armorHit)
    throw Error(loc`This acid keeps its original AP and armor-or-clothes hit. Use GC review to correct that history.`);
  if (
    combat?.id &&
    combat.id === old.lastCombat?.id &&
    (!Number.isSafeInteger(combat.round) || combat.round <= old.lastCombat.round)
  )
    throw Error(loc`This acid already applied during that combat round. Wait for the next round.`);
  const reduction = defenses.reduction,
    net = Math.max(0, old.damage - reduction),
    source = {
      ...old,
      protection: defenses,
      roundAttempt: {
        attempt,
        state: "applying",
        damage: old.damage,
        reduction,
        net,
        combat,
        ...(resistanceSource ? { resistanceSource } : {}),
        ...(bruiseResistanceSource ? { bruiseResistanceSource } : {})
      }
    };
  return {
    hazards: writeAcidSource(hazards, id, source),
    damage: old.damage,
    reduction,
    net,
    stopped: old.damage > 0 && net === 0
  };
}

export function settleAcidRound(hazards, id, { attempt, suffered, effectsPrevented = false } = {}) {
  const old = readAcidSource(hazards, id),
    pending = old.roundAttempt;
  if (pending?.state !== "applying" || pending.attempt !== attempt || !whole(suffered) || suffered > pending.net)
    throw Error(loc`Review this acid round's original application and actual damage before continuing.`);
  const source = {
    ...old,
    suffered: old.suffered + suffered,
    rounds: old.rounds + 1,
    phase: effectsPrevented ? "gone" : "end",
    damage: effectsPrevented ? 0 : old.damage,
    lastCombat: pending.combat,
    roundAttempt: { ...pending, state: "complete", suffered }
  };
  return { hazards: writeAcidSource(hazards, id, source), source, injurySaveDue: acidInjuryDue(source) };
}

/** Natural halving happens once per round. Washing is a separate full action and preserves the round phase. */
export function halveAcidSource(hazards, id, step) {
  const old = readAcidSource(hazards, id);
  if (old.needsReview || old.roundAttempt?.state === "applying")
    throw Error(loc`Review this acid attack before reducing its remaining damage.`);
  if (!["end", "wash"].includes(step) || old.phase === "gone" || (step === "end" && old.phase !== "end"))
    throw Error(loc`This acid has already ended or received its end-of-round halving.`);
  const damage = Math.floor(old.damage / 2),
    source = { ...old, damage, phase: !damage ? "gone" : step === "end" ? "round" : old.phase };
  return { hazards: writeAcidSource(hazards, id, source), source };
}

/** Preserve legacy totals as uncertain history, without guessing how many original attacks or saves they combine. */
export function legacyAcidSourcePlan(hazards, id) {
  if (!hazards?.acid || Array.isArray(hazards.acid.sourceIds)) return hazards;
  if (!acidSourceId(id) || Object.hasOwn(hazards.acidSources ?? {}, id))
    throw Error(loc`Choose a new reference for the older acid history.`);
  const old = hazards.acid;
  if (!whole(old.damage) || !whole(old.suffered ?? 0))
    throw Error(loc`The GC must verify the older acid amounts before migration.`);
  return writeAcidSource(hazards, id, {
    version: 1,
    provenSingleAttack: false,
    label: loc`Earlier acid attacks`,
    damage: old.damage,
    suffered: old.suffered ?? 0,
    phase: old.damage ? "end" : "gone",
    rounds: 0,
    injuryChecked: old.injuryChecked === true,
    needsReview: true,
    protection: null,
    startedAt: old.startedAt ?? null,
    lastCombat: null,
    hitContext: {}
  });
}

/** Record an explicit historical correction; original saves and health changes are resolved before this review. */
export function reviewAcidSourcePlan(
  hazards,
  id,
  { label, damage, suffered, phase, injuryChecked, protection, note, reviewer, at, singleAttackVerified = false } = {}
) {
  const old = readAcidSource(hazards, id);
  const provenSingleAttack = old.provenSingleAttack || singleAttackVerified === true;
  if (!provenSingleAttack && (damage > 0 || injuryChecked !== true))
    throw Error(
      loc`Verify one original attack, or finish the merged exposures and injury outcomes by hand before closing this history.`
    );
  if (
    typeof label !== "string" ||
    !label.trim() ||
    label.length > 100 ||
    !whole(damage) ||
    !whole(suffered) ||
    !phases.includes(phase) ||
    (damage === 0) !== (phase === "gone") ||
    typeof injuryChecked !== "boolean" ||
    !String(note ?? "").trim() ||
    !reviewer ||
    !Number.isFinite(at)
  )
    throw Error(loc`Verify the actual acid totals, timing, injury outcome and review reason.`);
  const source = {
    ...old,
    provenSingleAttack,
    label: label.trim(),
    damage,
    suffered,
    phase,
    injuryChecked,
    protection: damage === 0 && protection == null ? null : acidProtection(protection),
    needsReview: false,
    review: { note: String(note).trim(), reviewer, at }
  };
  if (source.roundAttempt?.state === "applying") source.roundAttempt = { ...source.roundAttempt, state: "reviewed" };
  return writeAcidSource(hazards, id, source);
}
