import { targetSkillEffectApplicable, targetSkillEffectPlan } from "../rules/target-skill-effects.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { SKILLS } from "../rules/tables.mjs";
import { dispositionSkillPlan, hasDispositionCheck } from "../rules/disposition-skills.mjs";
import { npcUsesSceneDisposition } from "../rules/gc/disposition.mjs";
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

export function dispositionTargetCandidates(key) {
  if (!hasDispositionCheck(key)) return [];
  return actors().filter(a => a.type === "npc" && readable(a) && !npcUsesSceneDisposition(a.system));
}
/** Read target state only after permission checks and bind the acting character from its document. */
export function dispositionSkillContext(input, key, acting) {
  const uuid = input.dispositionTargetUuid ?? "";
  if (!uuid) return { dispositionTarget: null };
  const target = actors().find(a => a.uuid === uuid);
  if (typeof uuid !== "string" || !target || target.type !== "npc" || !readable(target))
    throw Error(loc`The disposition target is unavailable or private. Ask the GC to resolve this check.`);
  if (npcUsesSceneDisposition(target.system)) throw Error(loc`Villain disposition uses its separate scene effects.`);
  if (input.targetSkillActorUuid && input.targetSkillActorUuid !== uuid)
    throw Error(loc`Choose the same actual target for disposition and target feat effects.`);
  return {
    dispositionTarget: {
      actorUuid: target.uuid,
      name: target.name,
      type: target.type,
      npcType: target.system.npcType,
      sceneEffects: npcUsesSceneDisposition(target.system),
      actingActorId: acting?.id,
      actingActorUuid: acting?.uuid,
      disposition: target.system.disposition,
      confirmed: input.dispositionTargetConfirmed === true
    }
  };
}
function dispositionTargetContent(key) {
  const candidates = dispositionTargetCandidates(key);
  if (!candidates.length) return "";
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>${loc`NPC disposition toward this character`}</summary><p>${loc`For one actual NPC target. Apply the target's recorded disposition toward the acting character to the applicable named check and Disposition-tagged timing. Private targets require the GC. Player and villain scene effects require separate GC adjudication.`}</p><label>${loc`NPC disposition target`} <select name="dispositionTargetUuid"><option value="">${loc`No selected disposition target`}</option>${candidates.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label><input name="dispositionTargetConfirmed" type="checkbox" /> ${loc`The GC confirms this check targets that NPC and its recorded disposition applies`}</label></details>`;
}
export function validateDispositionSkillProof(proof, { actor, checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const check = SKILLS.find(s => s.key === skillKey)?.checks.find(c => c.id === checkId),
    target = dispositionSkillContext(
      { dispositionTargetUuid: proof.targetActorUuid, dispositionTargetConfirmed: proof.targetConfirmed },
      skillKey,
      actor
    ).dispositionTarget,
    current = dispositionSkillPlan(actor.system, skillKey, check, target);
  if (
    checkKind !== "skill" ||
    !check ||
    current.blockedReason ||
    !current.evidence ||
    JSON.stringify(current.evidence) !== JSON.stringify(proof)
  )
    throw Error(
      current.blockedReason || loc`The target disposition, acting character or campaign bonus changed before posting.`
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
  if (typeof id !== "string") throw new Error(loc`Choose a listed target character.`);
  const a = actors().find(a => a.uuid === id);
  if (!a || !["agent", "npc"].includes(a.type) || !readable(a))
    throw new Error(loc`The selected target is unavailable or cannot be read. Ask the GC to resolve this check.`);
  if (!targetSkillEffectApplicable(a.system, key))
    throw new Error(loc`The selected target no longer has an applicable source for this skill.`);
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
  return `<details><summary>${loc`Target character’s skill effects`}</summary><p>${loc`For one actual character target. Apply the selected target’s Silver Tongue or Zeroed error modifier, or Faceless information-gathering time. Confirm the actual purpose; a target’s Faceless never triples unrelated checks. Class abilities, Requests and other options remain separate.`}</p><label>${loc`Target character`} <select name="targetSkillActorUuid"><option value="">${loc`No selected target effect`}</option>${candidates.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label>${loc`Information sought about this target (Faceless only)`} <select name="targetSkillPurpose"><option value="">${loc`No Faceless information-gathering effect`}</option><option value="past">${loc`Past`}</option><option value="location">${loc`Current location`}</option><option value="intentions">${loc`Intentions`}</option><option value="motives">${loc`Motives`}</option></select></label><label><input name="targetSkillConfirmed" type="checkbox" /> ${loc`The GC confirms this check targets the selected character and any selected information-gathering purpose`}</label></details>`;
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
        loc`The target character, feat source, Charisma, Covert count or information-gathering purpose changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "targetSkillEffect",
  order: 1230,
  validate: ({ options, checkKind, checkId, skillKey }) =>
    validateTargetSkillEffectProof(options.targetSkillEffect, { checkKind, skillKey, checkId })
});
rollPipeline.register({
  id: "dispositionSkill",
  order: 1231,
  validate: context => validateDispositionSkillProof(context.options.dispositionSkill, context)
});

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "targetSkillEffectContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [
    { at: 220, html: targetSkillEffectContent(key) },
    { at: 221, html: dispositionTargetContent(key) }
  ]
});
