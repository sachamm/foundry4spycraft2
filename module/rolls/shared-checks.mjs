/**
 * Roll checks that belong to no single rule module: callbacks a caller passes with its roll options, and checks
 * that need more than one rule module. Everything else registers from the module that owns the rule.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { validateAxeDisarmProof } from "../rules/axe-disarm.mjs";
import { disarmMeleeSystemForCheck } from "../rules/readied-replacement.mjs";

rollPipeline.register({
  id: "callbackFinalAttack",
  order: 1080,
  validate: async ({ options }) => options.validateFinalAttack?.()
});
rollPipeline.register({
  id: "callbackAttackContext",
  order: 1090,
  validate: async ({ options }) => options.validateAttackContext?.()
});
rollPipeline.register({
  id: "callbackCQBRange",
  order: 1200,
  validate: async ({ options }) => options.validateCQBRange?.()
});
rollPipeline.register({
  id: "axeDisarm",
  order: 1350,
  validate: ({ actor, options, checkKind }) =>
    validateAxeDisarmProof(
      options.rerollOf ? disarmMeleeSystemForCheck(actor, options) : actor.system,
      options.attackContext?.disarm,
      { checkKind, weaponProficiency: options.weaponProficiency, rerollOf: options.rerollOf }
    )
});
rollPipeline.register({
  id: "callbackCheapShotRecovery",
  order: 1630,
  validate: async ({ options }) => options.validateCheapShotRecovery?.()
});
rollPipeline.register({
  id: "callbackSkillContext",
  order: 1640,
  validate: async ({ options }) => options.validateSkillContext?.()
});
rollPipeline.register({
  id: "callbackRerollContext",
  order: 1650,
  validate: async ({ options }) => options.validateRerollContext?.()
});
rollPipeline.register({
  id: "callbackDamageSave",
  order: 1680,
  validate: async ({ options }) => options.validateDamageSave?.()
});
rollPipeline.register({
  id: "callbackSaveContext",
  order: 1710,
  validate: async ({ options }) => options.validateSaveContext?.()
});
