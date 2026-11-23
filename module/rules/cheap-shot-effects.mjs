import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
const choices = ["str", "dex", "con", "int", "wis", "cha", "speed"];
export const cheapShotScene = system => String(system.usagePeriods?.scene ?? "initial");
export function cheapShotRecords(system) {
  const rows = system.cheapShots ?? [];
  if (
    !Array.isArray(rows) ||
    rows.some(
      r =>
        !r ||
        r.version !== 1 ||
        typeof r.scene !== "string" ||
        !r.scene ||
        typeof r.sourceMessage !== "string" ||
        !r.sourceMessage ||
        !choices.includes(r.choice) ||
        !Number.isFinite(r.madeAt) ||
        r.madeAt < 0 ||
        typeof r.recovered !== "boolean" ||
        (r.lastSaveAt !== null && (!Number.isFinite(r.lastSaveAt) || r.lastSaveAt < r.madeAt)) ||
        (r.doubled !== undefined && typeof r.doubled !== "boolean") ||
        (r.repeat !== undefined && typeof r.repeat !== "boolean")
    )
  )
    throw Error(loc`The GC must review malformed Cheap Shot history.`);
  const current = rows.filter(r => r.scene === cheapShotScene(system));
  // Submission Supremacy (p.188) allows further Cheap Shots in a scene, each with a different penalty.
  if (
    current.length > 1 &&
    (current.slice(1).some(r => r.repeat !== true) || new Set(current.map(r => r.choice)).size !== current.length)
  )
    throw Error(loc`The GC must review competing successful Cheap Shots in this scene.`);
  return current;
}
/** Submission Basics (p.188): the penalties of a Cheap Shot on a successful unarmed attack are doubled. */
const factor = r => (r.doubled === true ? 2 : 1);
export function cheapShotPenalty(system, ability) {
  const r = cheapShotRecords(system).find(r => !r.recovered && r.choice === ability);
  return r ? -2 * factor(r) : 0;
}
export function cheapShotSpeedPenalty(system) {
  const r = cheapShotRecords(system).find(r => !r.recovered && r.choice === "speed");
  return r ? -10 * factor(r) : 0;
}
export function cheapShotApplyPlan(
  system,
  check,
  { sourceMessage, now, scene, doubled = false, supremacy = false } = {}
) {
  const p = check?.attackContext?.cheapShot;
  if (
    check?.checkKind !== "attack" ||
    check.superseded ||
    check.resolved !== true ||
    check.successConfirmed !== true ||
    !p?.active ||
    !choices.includes(p.choice) ||
    typeof sourceMessage !== "string" ||
    !sourceMessage ||
    !Number.isFinite(now) ||
    now < 0 ||
    p.scene !== scene ||
    scene !== cheapShotScene(system) ||
    !Number.isFinite(p.madeAt) ||
    p.madeAt > now
  )
    throw Error(loc`Use a resolved successful Cheap Shot from this current scene.`);
  const rows = cheapShotRecords(system),
    prior = rows.find(r => r.sourceMessage === sourceMessage);
  if (prior) {
    if (prior.choice !== p.choice || prior.madeAt !== p.madeAt || prior.attackerUuid !== check.actorUuid)
      throw Error(loc`The applied Cheap Shot receipt changed; review its original target history.`);
    return { record: prior, existing: true };
  }
  if (rows.length && !(supremacy === true && !rows.some(r => r.choice === p.choice)))
    throw Error(
      supremacy === true
        ? loc`Submission Supremacy: choose a penalty this combatant has not already suffered this scene.`
        : loc`This combatant already suffered a successful Cheap Shot this scene, even if its penalty has ended.`
    );
  return {
    existing: false,
    record: {
      version: 1,
      scene,
      sourceMessage,
      attackerUuid: check.actorUuid,
      choice: p.choice,
      madeAt: p.madeAt,
      recovered: false,
      lastSaveAt: null,
      attemptId: null,
      ...(doubled === true ? { doubled: true } : {}),
      ...(rows.length ? { repeat: true } : {})
    }
  };
}
export function cheapShotRecoveryPlan(system, { sourceMessage, now } = {}) {
  const r = cheapShotRecords(system).find(r => r.sourceMessage === sourceMessage);
  if (!r || r.recovered) throw Error(loc`Choose an active Cheap Shot from the current scene.`);
  if (r.attemptId && r.attemptResolved !== true)
    throw Error(loc`Resolve or review the previous reserved recovery attempt first.`);
  if (!Number.isFinite(now) || now < r.madeAt || (r.lastSaveAt !== null && now < r.lastSaveAt + 60))
    throw Error(loc`A Cheap Shot recovery save is available once per minute, available immediately at DC 20.`);
  return {
    version: 1,
    sourceMessage,
    scene: r.scene,
    choice: r.choice,
    madeAt: r.madeAt,
    at: now,
    dc: 20 - 2 * Math.floor((now - r.madeAt) / 60)
  };
}
export function validateCheapShotRecoveryProof(
  actor,
  proof,
  { checkKind, checkId, checkMethod = "roll", allowRecovered = false } = {}
) {
  if (!proof) return;
  const r = cheapShotRecords({ ...actor.system, usagePeriods: actor.usagePeriods }).find(
    r => r.sourceMessage === proof.sourceMessage
  );
  if (
    checkKind !== "save" ||
    checkId !== "fort" ||
    checkMethod !== "roll" ||
    !r ||
    (r.recovered && !allowRecovered) ||
    r.attemptId !== proof.attemptId ||
    typeof proof.attemptId !== "string" ||
    !proof.attemptId ||
    r.lastSaveAt !== proof.at ||
    r.scene !== proof.scene ||
    r.choice !== proof.choice ||
    r.madeAt !== proof.madeAt ||
    proof.at < r.madeAt ||
    proof.version !== 1 ||
    proof.dc !== 20 - 2 * Math.floor((proof.at - r.madeAt) / 60)
  )
    throw Error(loc`The recorded Cheap Shot recovery source, attempt or Fortitude DC changed.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "cheapShotRecovery",
  order: 1620,
  record: ["cheapShotRecovery"],
  validate: ({ actor, options, checkKind, checkId, checkMethod }) =>
    validateCheapShotRecoveryProof(actor, options.cheapShotRecovery, { checkKind, checkId, checkMethod })
});
