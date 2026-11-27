import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "../rules/equal.mjs";
rollPipeline.register({
  id: "drainedBuildReview",
  order: -2000,
  record: ["drainedRecovery"],
  skillChecks: ({ skillKey, options }, checks) =>
    skillKey === "resolve" && options?.drainedRecovery
      ? [
          {
            id: "drained-recovery",
            name: loc`Drained recovery (DC ${options.drainedRecovery.dc})`,
            attributes: ["wis"],
            tags: "",
            mode: options.drainedRecovery.mode,
            error: 1,
            page: 341,
            time: "1 Free Action",
            synergies: []
          }
        ]
      : checks,
  validate: context => {
    const { actor, options = {}, phase, checkKind, skillKey, ability, checkId, checkMethod } = context;
    if (actor?.system?.drainedState?.needsReview)
      throw Error(loc`The GC must review the changed Drained build before rolling.`);
    if (actor && phase) {
      const policy = stable(actor.system.drainedState ?? null);
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
        checkMethod !== "roll" ||
        recovery?.attempt !== source.attempt ||
        recovery.dc !== source.dc ||
        recovery.mode !== source.mode ||
        (recovery.mode === "Passive" && !globalThis.game?.user?.isGM) ||
        recovery.levels !== source.levels ||
        !["rolling", "posted"].includes(recovery.state)
      )
        throw Error(loc`Use the original reserved Resolve (Wis) recovery check.`);
    }
  }
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
