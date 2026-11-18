/**
 * Roll options that belong to the roll itself and are copied onto the posted check as they are (null when absent).
 * A rule's own fields are listed with `record` by a contributor in the rule's module.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";

rollPipeline.register({
  id: "recordFields",
  order: 100,
  record: ["rerollOf", "rerollSource"]
});
