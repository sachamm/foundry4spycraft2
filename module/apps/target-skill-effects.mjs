import { targetSkillEffectApplicable, targetSkillEffectPlan } from "../rules/target-skill-effects.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { SKILLS } from "../rules/tables.mjs";
import { dispositionSkillPlan, hasDispositionCheck } from "../rules/disposition-skills.mjs";
import { usesSceneDisposition } from "../rules/scene-disposition.mjs";
import { readSetting } from "../settings.mjs";
import { persuasionKey } from "../rules/gc/combat-persuasion.mjs";
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
const documents = collection =>
  Array.isArray(collection?.contents)
    ? collection.contents
    : typeof collection?.values === "function"
      ? [...collection.values()]
      : Array.isArray(collection)
        ? collection
        : [];
const readableScene = scene => game.user?.isGM === true || scene?.testUserPermission?.(game.user, "OBSERVER") === true;
function dispositionActors() {
  const all = [...actors()],
    liveScenes = new Set([
      globalThis.canvas?.scene?.id,
      ...documents(game.combats)
        .filter(c => c.started)
        .map(c => c.scene?.id)
    ]);
  for (const scene of documents(game.scenes)) {
    if (!(scene.active || liveScenes.has(scene.id)) || !readableScene(scene)) continue;
    for (const token of documents(scene.tokens))
      if (token.actorLink === false) {
        const actor = token.actor;
        if (actor) all.push(actor);
      }
  }
  return [...new Map(all.map(actor => [actor.uuid, actor])).values()];
}
export function targetSkillEffectCandidates(key) {
  return actors().filter(
    a => ["agent", "npc"].includes(a.type) && readable(a) && targetSkillEffectApplicable(a.system, key)
  );
}

export function dispositionTargetCandidates(key) {
  if (!hasDispositionCheck(key)) return [];
  return dispositionActors().filter(a => readable(a) && (a.type === "npc" || usesSceneDisposition(a.type, a.system)));
}
/** Read target state only after permission checks and bind the acting character from its document. */
export function dispositionSkillContext(input, key, acting) {
  const binding = input.combatPersuasion,
    uuid = binding?.npcUuid ?? input.dispositionTargetUuid ?? "";
  if (!uuid) return { dispositionTarget: null };
  let target = typeof uuid === "string" ? dispositionActors().find(a => a.uuid === uuid) : null;
  if (!target && typeof uuid === "string")
    try {
      target = globalThis.fromUuidSync?.(uuid);
    } catch {}
  if (
    typeof uuid !== "string" ||
    !target ||
    target.uuid !== uuid ||
    !["agent", "npc"].includes(target.type) ||
    !readable(target) ||
    (target.isToken && !readableScene(target.token?.parent))
  )
    throw Error(loc`The disposition target is unavailable or private. Ask the GC to resolve this check.`);
  const sceneEffects = usesSceneDisposition(target.type, target.system);
  if (target.type === "agent" && !sceneEffects)
    throw Error(loc`Agent-built companions require their NPC disposition rules.`);
  if (binding && sceneEffects) throw Error(loc`PCs and villains do not use combat disposition decisions.`);
  if (input.targetSkillActorUuid && input.targetSkillActorUuid !== uuid)
    throw Error(loc`Choose the same actual target for disposition and target feat effects.`);
  let disposition = target.system.disposition,
    frozen = null;
  if (binding) {
    const record = target.flags?.spycraft2?.combatPersuasion?.[persuasionKey(String(binding.combatId))],
      claim = record?.attempts?.[persuasionKey(String(binding.side))],
      combat = game.combats?.get?.(binding.combatId);
    if (
      key !== "impress" ||
      (input.dispositionTargetUuid && input.dispositionTargetUuid !== uuid) ||
      record?.version !== 1 ||
      record.combatId !== binding.combatId ||
      claim?.id !== binding.id ||
      claim.actorUuid !== acting?.uuid ||
      claim.side !== binding.side ||
      !combat?.started ||
      !documents(combat.combatants).some(c => c.actor?.uuid === acting?.uuid) ||
      !["rolling", "complete"].includes(claim.state)
    )
      throw Error(loc`Review the reserved combat-persuasion target and acting side before rolling.`);
    disposition = { base: claim.grade, toward: {} };
    frozen = {
      id: claim.id,
      npcUuid: target.uuid,
      combatId: binding.combatId,
      side: claim.side,
      targetId: claim.targetId ?? ""
    };
  }
  return {
    dispositionTarget: {
      actorUuid: target.uuid,
      name: target.name,
      type: target.type,
      npcType: target.system.npcType,
      sceneEffects,
      actingActorId: acting?.id,
      actingActorUuid: acting?.uuid,
      disposition,
      ...(sceneEffects
        ? {
            sceneDisposition: target.flags?.spycraft2?.sceneDisposition ?? null,
            scene: String(readSetting("usagePeriods", {})?.scene ?? "initial"),
            worldTime: game.time?.worldTime ?? 0
          }
        : {}),
      ...(frozen ? { combatPersuasion: frozen } : {}),
      confirmed: !!frozen || input.dispositionTargetConfirmed === true
    }
  };
}
export function dispositionTargetContent(key) {
  const candidates = dispositionTargetCandidates(key);
  if (!candidates.length) return "";
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>${loc`Disposition toward this character`}</summary><p>${loc`Select one actual target. NPCs use their recorded attitude; PCs and villains use active scene effects for this acting character. The GC records successful sources and ends them early when required. Private targets require the GC.`}</p><label>${loc`Disposition target`} <select name="dispositionTargetUuid"><option value="">${loc`No selected disposition target`}</option>${candidates.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label><input name="dispositionTargetConfirmed" type="checkbox" /> ${loc`The GC confirms this check targets that character and its recorded disposition effects apply`}</label></details>`;
}
export function validateDispositionSkillProof(proof, { actor, checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const check = SKILLS.find(s => s.key === skillKey)?.checks.find(c => c.id === checkId),
    target = dispositionSkillContext(
      {
        dispositionTargetUuid: proof.targetActorUuid,
        dispositionTargetConfirmed: proof.targetConfirmed,
        ...(proof.combatPersuasion ? { combatPersuasion: proof.combatPersuasion } : {})
      },
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
  dialog: ({ key, combatPersuasion }) => [
    { at: 220, html: targetSkillEffectContent(key) },
    {
      at: 221,
      html: combatPersuasion
        ? `<p class="hint">${loc`Combat persuasion uses the target and attitude confirmed for this side's attempt.`}</p>`
        : dispositionTargetContent(key)
    }
  ]
});
