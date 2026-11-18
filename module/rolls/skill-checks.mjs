/**
 * Named-check steps that belong to no single rule module. Rule modules register the checks they add themselves.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";

rollPipeline.register({
  id: "optionalRuleChecks",
  order: 5020,
  kinds: ["skill"],
  skillChecks: ({ optionalRules = [] }, checks) =>
    checks.filter(check => !check.optionalRule || optionalRules.includes(check.optionalRule))
});
