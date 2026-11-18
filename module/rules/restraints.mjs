import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Held/Pinned action restrictions and their Athletics escape exception (p.342). */
export function restraintState(system) {
  return system.conditionContext?.pinned === true ? "pinned" : system.conditionContext?.held === true ? "held" : "";
}
export function restraintActionBlock(system, { passive = false, free = false, escape = false } = {}) {
  if (system.restraintReleaseReview?.needsReview)
    return loc`The GC must review the interrupted grapple release before further actions.`;
  if ((system.pendingRestraintMoves ?? []).length && passive !== true)
    return loc`Complete the immediate Standard Move required by Escape Hold first.`;
  const state = restraintState(system);
  if (!state || passive === true || escape === true || (state === "held" && free === true)) return "";
  return state === "pinned"
    ? loc`Pinned: no actions except the full-action Athletics escape check (p.342).`
    : loc`Held: only free actions or the full-action Athletics escape check are available (p.342).`;
}
export function restraintSkillChecks(system, key, checks = []) {
  const state = restraintState(system);
  if (!state || key !== "athletics") return checks;
  const check = {
    id: "restraint-escape",
    name: state === "pinned" ? loc`Break Pin (opposed Grapple)` : loc`Escape Hold (opposed Grapple)`,
    attributes: ["str"],
    mode: "Active",
    tags: "Armor Check Penalty, Grasp",
    time: "1 Full Action",
    error: 1,
    page: 357,
    synergies: [],
    synergyText: ""
  };
  return [...checks.filter(c => c.id !== "restraint-escape"), check];
}
export function restraintSkillContext(
  system,
  key,
  check,
  { grappleProficient = null, grappleSizeDifference = null, grappleContextConfirmed = false } = {}
) {
  const state = restraintState(system),
    escape = !!state && key === "athletics" && check?.id === "restraint-escape";
  if (!escape)
    return { state, escape: false, check, sizeBonus: 0, errorIncrease: 0, timeLocked: false, blockedReason: "" };
  const valid =
      typeof grappleProficient === "boolean" &&
      Number.isSafeInteger(grappleSizeDifference) &&
      Math.abs(grappleSizeDifference) <= 20 &&
      grappleContextConfirmed === true,
    untrained = valid && grappleProficient === false;
  return {
    state,
    escape: true,
    sizeDifference: valid ? grappleSizeDifference : null,
    sizeBonus: valid ? 4 * Math.max(0, grappleSizeDifference) : 0,
    proficient: valid ? grappleProficient : null,
    errorIncrease: untrained ? 2 : 0,
    timeLocked: untrained,
    blockedReason: valid
      ? ""
      : loc`Confirm the opposed Grapple participants, applicable proficiency and Size difference with the GC.`,
    check: { ...restraintSkillChecks(system, key).at(-1), time: untrained ? "2 Full Actions" : "1 Full Action" }
  };
}

/** Freeze actual active hold/pin sources at roll time; a later grapple cannot inherit an old roll. */
export function restraintSourceSnapshot(actor) {
  const own = [...(actor.effects ?? [])],
    applied = actor.appliedEffects ?? own.filter(e => e.active ?? (!e.disabled && !e.isSuppressed));
  return {
    held: actor.statuses?.has("held") === true,
    pinned: actor.statuses?.has("pinned") === true,
    sources: applied
      .filter(e => e.statuses?.has("held") || e.statuses?.has("pinned"))
      .map(e => ({
        id: e.id,
        name: e.name ?? e.id,
        uuid: e.uuid ?? e.id,
        own: own.includes(e),
        statuses: [...e.statuses].sort(),
        origin: e.origin ?? null,
        operation: e.flags?.spycraft2?.conditionOperation ?? null,
        ...(e.flags?.spycraft2?.threadNeedleHold
          ? { threadNeedleHold: structuredClone(e.flags.spycraft2.threadNeedleHold) }
          : {}),
        duration: e.toObject?.().duration ?? e.duration ?? null
      }))
      .sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)))
  };
}
export function getRestraintReleaseReview(actor) {
  const stored = actor.flags?.spycraft2?.restraintReleaseReview,
    local = globalThis.game?.spycraft2?.pendingRestraintReviews?.[actor.uuid];
  return stored?.needsReview
    ? stored
    : stored?.id === local?.id && stored?.needsReview === false
      ? stored
      : (local ?? stored ?? {});
}
export function restraintReleasePlan(
  actor,
  message,
  { benefit = "", opponentCriticalFailureConfirmed = false, confirmed = false } = {}
) {
  const check = message.flags?.spycraft2,
    source = check?.restraintEscape?.sourceSnapshot,
    current = restraintSourceSnapshot(actor),
    same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!actor.isOwner || check?.actorUuid !== actor.uuid || (message.blind && !globalThis.game?.user?.isGM))
    throw new Error(loc`Choose an owned recorded grapple result; the GC resolves secret results.`);
  if (
    !message.id ||
    !/^[A-Za-z0-9_-]+$/.test(message.id) ||
    ["constructor", "prototype", "__proto__"].includes(message.id) ||
    check.checkKind !== "skill" ||
    check.skillKey !== "athletics" ||
    check.checkId !== "restraint-escape" ||
    !Number.isFinite(check.rawTotal) ||
    !Number.isFinite(check.effectiveTotal) ||
    check.resolved !== true ||
    check.successConfirmed !== true ||
    check.criticalFailure ||
    check.superseded ||
    check.restraintEscape?.kind !== "opposedGrapple" ||
    confirmed !== true
  )
    throw new Error(loc`Finish and confirm the successful opposed Grapple check before applying its benefit.`);
  if (source?.sources?.length > 1 && check.restraintEscape.sourceScopeConfirmed !== true)
    throw new Error(loc`Review which restraint sources belong to this same grapple before releasing any of them.`);
  if (!source || !same(current, source) || !source.sources.length)
    throw new Error(
      loc`The grapple sources changed or were not recorded with this roll. Review the current hold or pin.`
    );
  const state = restraintState({ conditionContext: source });
  if (!state || check.restraintEscape.condition !== state)
    throw new Error(loc`The recorded grapple condition does not match its sources.`);
  if (typeof opponentCriticalFailureConfirmed !== "boolean")
    throw new Error(loc`Confirm the opponent’s critical-failure context.`);
  const twoBenefits = check.criticalSuccess === true || opponentCriticalFailureConfirmed === true;
  if (
    state === "pinned"
      ? !["breakPin", ...(twoBenefits ? ["breakPinAndEscapeHold"] : [])].includes(benefit)
      : benefit !== "escapeHold"
  )
    throw new Error(loc`Choose a grapple escape benefit earned by this result.`);
  const escapeHold = benefit !== "breakPin",
    targetStatuses = new Set(escapeHold ? ["held", "pinned"] : ["pinned"]),
    targets = source.sources.filter(s => s.statuses.some(k => targetStatuses.has(k)));
  if (targets.some(s => !s.own))
    throw new Error(
      loc`A continuing item or foreign source supplies this restraint. Review its source before releasing it.`
    );
  const addHeld = !escapeHold && !source.held;
  if (
    addHeld &&
    targets.some(
      s =>
        (Number.isFinite(s.duration?.value) && s.duration.value > 0) ||
        ["seconds", "rounds", "turns"].some(k => Number.isFinite(s.duration?.[k]) && s.duration[k] > 0)
    )
  )
    throw new Error(loc`Review this timed pin source before converting it to an ongoing hold.`);
  const updates = targets.map(s => ({
    id: s.id,
    before: s.statuses,
    after: [...new Set([...s.statuses.filter(k => !targetStatuses.has(k)), ...(addHeld ? ["held"] : [])])].sort()
  }));
  if (!updates.length) throw new Error(loc`This result has no editable restraint source.`);
  return {
    benefit,
    source,
    updates,
    before: { held: source.held, pinned: source.pinned },
    after: { held: !escapeHold, pinned: false },
    requiredMove: escapeHold,
    benefitsUsed: benefit === "breakPinAndEscapeHold" ? 2 : 1
  };
}

export const getPendingRestraintMoves = actor =>
  Object.values(actor.flags?.spycraft2?.restraintReleases ?? {}).filter(
    r => r?.state === "applied" && r.movement?.state === "required"
  );

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "restraintChecks",
  order: 5030,
  kinds: ["skill"],
  skillChecks: ({ actor, skillKey }, checks) => restraintSkillChecks(actor.system, skillKey, checks)
});
