/**
 * Registers every roll contributor. Importing this module once is enough; the Actor document does so.
 * A new rule joins the pipeline by registering from its own module and being imported here.
 */
import "./leases.mjs";
import "./check-validators.mjs";
import "./skill-checks.mjs";
import "./chat-controls.mjs";

export { rollPipeline } from "../rules/roll-pipeline.mjs";
