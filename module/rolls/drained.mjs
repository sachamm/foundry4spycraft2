import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "../rules/equal.mjs";
import { drainedRecoveryMethodAllowed, drainedRecoveryCheck } from "../rules/drained.mjs";
import { npcDrainedBuildSignature } from "../rules/npc-drained.mjs";
export function validateDrainedRoll(context) {
  const { actor, options = {}, phase, checkKind, skillKey, ability, checkId, checkMethod } = context;
  if (actor?.system?.drainedState?.needsReview)
    throw Error(loc`The GC must review the changed Drained build before rolling.`);
  if (actor && phase) {
    const policy = stable({
      state: actor.system.drainedState ?? null,
      npcBuild: actor.type === "npc" && actor.system.drainedState?.levels ? npcDrainedBuildSignature(actor) : null
    });
    if (phase === "before") context.drainedPolicy = policy;
    else if (context.drainedPolicy !== policy)
      throw Error(loc`Drained benefits changed during this roll. Keep the actual dice for GC review.`);
  }
  if (options.drainedRecovery) {
    const source = options.drainedRecovery,
      recovery = actor?.flags?.spycraft2?.drained?.recoveries?.[source.mission];
    if (
      checkKind !== "skill" ||
      skillKey !== "resolve" ||
      ability !== "wis" ||
      checkId !== "drained-recovery" ||
      !drainedRecoveryMethodAllowed(recovery?.mode, checkMethod) ||
      recovery?.attempt !== source.attempt ||
      recovery.dc !== source.dc ||
      recovery.mode !== source.mode ||
      ((recovery.mode === "Passive" || actor.type === "npc") && !globalThis.game?.user?.isGM) ||
      recovery.levels !== source.levels ||
      !["rolling", "posted"].includes(recovery.state)
    )
      throw Error(loc`Use the original reserved Resolve (Wis) recovery check.`);
  }
}
rollPipeline.register({
  id: "drainedBuildReview",
  order: -2000,
  record: ["drainedRecovery"],
  skillChecks: ({ skillKey, options }, checks) =>
    skillKey === "resolve" && options?.drainedRecovery ? [drainedRecoveryCheck(options.drainedRecovery)] : checks,
  validate: validateDrainedRoll
});
// Other contributors add ordinary Resolve choices. A reserved recovery offers only its own actual check.
rollPipeline.register({
  id: "drainedRecoveryCheck",
  order: 5900,
  kinds: ["skill"],
  skillChecks: ({ skillKey, options }, checks) =>
    skillKey === "resolve" && options?.drainedRecovery
      ? checks.filter(check => check.id === "drained-recovery")
      : checks
});
