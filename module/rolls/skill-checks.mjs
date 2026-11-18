/**
 * Named checks offered when a skill is rolled, beyond the skill's own list.
 * Each entry receives the list so far and returns the next one; order is significant.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { bullRushAttackSkillChecks } from "../rules/bull-rush-attack.mjs";
import { bullRushDefenseSkillChecks } from "../rules/bull-rush.mjs";
import { conveyanceBullRushSkillChecks } from "../rules/conveyance-bull-rush.mjs";
import { feintSkillChecks } from "../rules/feint.mjs";
import { restraintSkillChecks } from "../rules/restraints.mjs";
import { taskPressureSkillChecks } from "../rules/task-pressure.mjs";
import { terrainSkillChecks } from "../rules/terrain.mjs";
import { threatenSkillChecks } from "../rules/threaten.mjs";
import { tripAttackSkillChecks, tripCounterSkillCheck } from "../rules/trip-attack.mjs";
import { tripDefenseSkillChecks } from "../rules/trip.mjs";

const offer = (id, skillChecks) => rollPipeline.register({ id, kinds: ["skill"], skillChecks });

offer("terrainChecks", ({ actor, skillKey }, checks) => terrainSkillChecks(actor.system, skillKey, checks));
offer("optionalRuleChecks", ({ optionalRules = [] }, checks) =>
  checks.filter(check => !check.optionalRule || optionalRules.includes(check.optionalRule))
);
offer("restraintChecks", ({ actor, skillKey }, checks) => restraintSkillChecks(actor.system, skillKey, checks));
offer("taskPressureChecks", ({ actor, skillKey }, checks) => taskPressureSkillChecks(actor.system, skillKey, checks));
offer("threatenChecks", ({ skillKey }, checks) => threatenSkillChecks(skillKey, checks));
offer("feintChecks", ({ skillKey }, checks) => feintSkillChecks(skillKey, checks));
offer("tripDefenseChecks", ({ skillKey }, checks) => tripDefenseSkillChecks(skillKey, checks));
offer("tripAttackChecks", ({ skillKey }, checks) => tripAttackSkillChecks(skillKey, checks));
offer("bullRushDefenseChecks", ({ skillKey }, checks) => bullRushDefenseSkillChecks(skillKey, checks));
offer("bullRushAttackChecks", ({ skillKey }, checks) => bullRushAttackSkillChecks(skillKey, checks));
offer("conveyanceBullRushChecks", ({ skillKey }, checks) => conveyanceBullRushSkillChecks(skillKey, checks));
offer("tripCounterCheck", ({ skillKey, options }, checks) =>
  skillKey === "acrobatics" && options?.tripCounter ? [...checks, tripCounterSkillCheck()] : checks
);
