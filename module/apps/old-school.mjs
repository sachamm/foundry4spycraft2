import { oldSchoolEligible, oldSchoolPlan } from "../rules/old-school.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** GC facts support unrecorded NPCs without inferring their hidden class/feat sheets. */
export async function oldSchoolContext(actor, context, options = {}) {
  let input = options.oldSchool;
  if (!Object.hasOwn(options, "oldSchool") && oldSchoolEligible(actor.system, context)) {
    const response = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Old School — target qualification` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Old School grants +4 when this Charisma-based check targets a character whose Career/Threat Level does not exceed the mission Threat Level and who shares at least one class ability or three feats with you (p.209).`}</p><label><input name="apply" type="checkbox" /> ${loc`Apply Old School to this check`}</label><label>${loc`Target character`} <input name="target" maxlength="200" /></label><label>${loc`Target Career/Threat Level`} <input name="targetLevel" type="number" min="1" step="1" /></label><label>${loc`Mission Threat Level`} <input name="missionThreatLevel" type="number" min="1" step="1" /></label><label>${loc`Shared class ability, if any`} <input name="sharedClassAbility" maxlength="200" /></label><label>${loc`Shared feats, one name per line (at least three if no shared class ability)`}<textarea name="sharedFeats" rows="3"></textarea></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this check targets that character, the levels, and the listed abilities/feats are currently shared by us`}</label><p>${loc`Leave Apply unchecked to make this check without the bonus. Closing cancels the check.`}</p></div>`
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
    throw new Error(loc`Old School’s shared class source changed; confirm its target qualification again.`);
  if (plan && input.mission !== undefined && input.mission !== mission)
    throw new Error(loc`The mission changed; confirm Old School’s target qualification again.`);
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
    throw new Error(loc`Old School’s target facts or source changed before posting the check.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "oldSchool",
  order: 1660,
  validate: ({ actor, oldSchoolScope, oldSchool }) => validateOldSchool(actor, oldSchoolScope, oldSchool)
});
