import { oldSchoolEligible, oldSchoolPlan } from "../rules/old-school.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
/** GC facts support unrecorded NPCs without inferring their hidden class/feat sheets. */
export async function oldSchoolContext(actor, context, options = {}) {
  let input = options.oldSchool;
  if (!Object.hasOwn(options, "oldSchool") && oldSchoolEligible(actor.system, context)) {
    const response = await foundry.applications.api.DialogV2.input({
      window: { title: "Old School — target qualification" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Old School grants +4 when this Charisma-based check targets a character whose Career/Threat Level does not exceed the mission Threat Level and who shares at least one class ability or three feats with you (p.209).</p><label><input name="apply" type="checkbox" /> Apply Old School to this check</label><label>Target character <input name="target" maxlength="200" /></label><label>Target Career/Threat Level <input name="targetLevel" type="number" min="1" step="1" /></label><label>Mission Threat Level <input name="missionThreatLevel" type="number" min="1" step="1" /></label><label>Shared class ability, if any <input name="sharedClassAbility" maxlength="200" /></label><label>Shared feats, one name per line (at least three if no shared class ability)<textarea name="sharedFeats" rows="3"></textarea></label><label><input name="confirmed" type="checkbox" /> The GC confirms this check targets that character, the levels, and the listed abilities/feats are currently shared by us</label><p>Leave Apply unchecked to make this check without the bonus. Closing cancels the check.</p></div>`
    });
    if (!response) return { cancelled: true, evidence: null };
    input =
      response.apply === true
        ? {
            ...response,
            targetLevel: Number(response.targetLevel),
            missionThreatLevel: Number(response.missionThreatLevel),
            sharedFeats: String(response.sharedFeats ?? "")
              .split(/\r?\n/)
              .filter(n => n.trim())
          }
        : null;
  }
  const plan = oldSchoolPlan(actor.system, context, input),
    mission = String(actor.usagePeriods.mission ?? "initial");
  if (
    plan &&
    plan.sharedClassAbility &&
    input.classSource !== undefined &&
    input.classSource !== JSON.stringify(actor.system.classLevels ?? {})
  )
    throw new Error("Old School’s shared class source changed; confirm its target qualification again.");
  if (plan && input.mission !== undefined && input.mission !== mission)
    throw new Error("The mission changed; confirm Old School’s target qualification again.");
  return {
    cancelled: false,
    evidence: plan
      ? {
          ...plan,
          mission,
          ...(plan.sharedClassAbility ? { classSource: JSON.stringify(actor.system.classLevels ?? {}) } : {})
        }
      : null
  };
}
export function validateOldSchool(actor, context, evidence) {
  if (
    evidence &&
    JSON.stringify({
      ...oldSchoolPlan(actor.system, context, evidence),
      mission: String(actor.usagePeriods.mission ?? "initial"),
      ...(evidence.sharedClassAbility ? { classSource: JSON.stringify(actor.system.classLevels ?? {}) } : {})
    }) !== JSON.stringify(evidence)
  )
    throw new Error("Old School’s target facts or source changed before posting the check.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "oldSchool",
  order: 1660,
  validate: ({ actor, oldSchoolScope, oldSchool }) => validateOldSchool(actor, oldSchoolScope, oldSchool)
});
