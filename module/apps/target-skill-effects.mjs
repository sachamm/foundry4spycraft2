import { targetSkillEffectApplicable, targetSkillEffectPlan } from "../rules/target-skill-effects.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
const actors = () =>
    Array.isArray(game.actors?.contents)
      ? game.actors.contents
      : typeof game.actors?.values === "function"
        ? [...game.actors.values()]
        : Array.isArray(game.actors)
          ? game.actors
          : [],
  readable = a =>
    a?.isOwner === true || game.user?.isGM === true || a?.testUserPermission?.(game.user, "OBSERVER") === true;
export function targetSkillEffectCandidates(key) {
  return actors().filter(
    a => ["agent", "npc"].includes(a.type) && readable(a) && targetSkillEffectApplicable(a.system, key)
  );
}
/** Caller payloads cannot substitute an invented target system or bypass source permission. */
export function targetSkillContext(input, key) {
  const id = input.targetSkillActorUuid ?? "";
  if (!id)
    return {
      targetSkillSystem: null,
      targetSkillActorUuid: "",
      targetSkillActorName: "",
      targetSkillConfirmed: false,
      targetSkillPurpose: ""
    };
  if (typeof id !== "string") throw new Error("Choose a listed target character.");
  const a = actors().find(a => a.uuid === id);
  if (!a || !["agent", "npc"].includes(a.type) || !readable(a))
    throw new Error("The selected target is unavailable or cannot be read. Ask the GC to resolve this check.");
  if (!targetSkillEffectApplicable(a.system, key))
    throw new Error("The selected target no longer has an applicable source for this skill.");
  return {
    targetSkillSystem: a.system,
    targetSkillActorUuid: a.uuid,
    targetSkillActorName: a.name,
    targetSkillConfirmed: input.targetSkillConfirmed === true,
    targetSkillPurpose: input.targetSkillPurpose ?? ""
  };
}
export function targetSkillEffectContent(key) {
  const candidates = targetSkillEffectCandidates(key);
  if (!candidates.length) return "";
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>Target character’s skill effects</summary><p>For one actual character target. Apply the selected target’s Silver Tongue or Zeroed error modifier, or Faceless information-gathering time. Confirm the actual purpose; a target’s Faceless never triples unrelated checks. Class abilities, Requests and other options remain separate.</p><label>Target character <select name="targetSkillActorUuid"><option value="">No selected target effect</option>${candidates.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label>Information sought about this target (Faceless only) <select name="targetSkillPurpose"><option value="">No Faceless information-gathering effect</option><option value="past">Past</option><option value="location">Current location</option><option value="intentions">Intentions</option><option value="motives">Motives</option></select></label><label><input name="targetSkillConfirmed" type="checkbox" /> The GC confirms this check targets the selected character and any selected information-gathering purpose</label></details>`;
}
export function validateTargetSkillEffectProof(proof, { checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const c = targetSkillContext(
      {
        targetSkillActorUuid: proof.targetActorUuid,
        targetSkillConfirmed: proof.targetConfirmed,
        targetSkillPurpose: proof.purpose ?? ""
      },
      skillKey
    ),
    current = targetSkillEffectPlan(
      c.targetSkillSystem,
      skillKey,
      { id: checkId },
      {
        actorUuid: c.targetSkillActorUuid,
        actorName: c.targetSkillActorName,
        confirmed: c.targetSkillConfirmed,
        purpose: c.targetSkillPurpose
      }
    );
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    current.blockedReason ||
    !current.evidence ||
    JSON.stringify(current.evidence) !== JSON.stringify(proof)
  )
    throw new Error(
      current.blockedReason ||
        "The target character, feat source, Charisma, Covert count or information-gathering purpose changed before posting."
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "targetSkillEffect",
  order: 1230,
  validate: ({ options, checkKind, checkId, skillKey }) =>
    validateTargetSkillEffectProof(options.targetSkillEffect, { checkKind, skillKey, checkId })
});
