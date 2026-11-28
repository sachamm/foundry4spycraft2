import { cheapShotRecords } from "../rules/cheap-shot-effects.mjs";
import { CHEAP_SHOT_CHOICES } from "../rules/cheap-shot.mjs";
import { standardAttackContextContent, standardAttackContextInput } from "./standard-attack-context.mjs";
import { completeCharacterTarget, attackCharacterTargetChoices } from "./character-target.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
export async function rollCheapShot(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    const esc = foundry.utils.escapeHTML;
    input = await formDialog({
      title: loc`Cheap Shot Standard Attack`,
      intro: loc`Choose the opponent and attribute or Speed before this Standard Attack. Cheap Shot costs a free action, attack−4 and error+1. Flail Basics grants +2 gear on a melee check while a reviewed readied flail is held.`,
      fields: [
        {
          select: "weaponId",
          label: loc`Readied weapon`,
          optionsHtml: raw(
            actor.items
              .filter(i => i.type === "weapon" && i.system.equipped === true)
              .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
              .join("")
          )
        },
        {
          select: "cheapShotTargetUuid",
          label: loc`Actual opponent`,
          options: [["", loc`Choose opponent`]],
          optionsHtml: raw(
            attackCharacterTargetChoices()
              .filter(a => a.uuid !== actor.uuid)
              .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
              .join("")
          )
        },
        {
          select: "cheapShotChoice",
          label: loc`Chosen weakness`,
          optionsHtml: raw(CHEAP_SHOT_CHOICES.map(k => `<option value="${k}">${k.toUpperCase()}</option>`).join(""))
        },
        raw(standardAttackContextContent(actor, { includeCheapShot: false, includeCharacterTarget: false })),
        { check: "eligibleConfirmed", label: loc`The target has suffered no successful Cheap Shot this scene` },
        {
          check: "confirmed",
          label: loc`The GC confirms this legal Standard Attack, range/line of sight, free action and ammunition costs`
        }
      ]
    });
    if (!input) return null;
  }
  const target = await fromUuid(input.cheapShotTargetUuid);
  if (!target || !["agent", "npc"].includes(target.type) || target.uuid === actor.uuid)
    throw Error(loc`Choose the actual opposing character.`);
  const item = actor.items.get(input.weaponId);
  if (item?.type !== "weapon" || item.system.equipped !== true || item.system.carried === false || item.system.reserve)
    throw Error(loc`Choose the actual readied weapon.`);
  const opts = await completeCharacterTarget(
    actor,
    item.system,
    {
      ...standardAttackContextInput(input),
      attackAction: "standard",
      cheapShot: {
        choice: input.cheapShotChoice,
        targetUuid: target.uuid,
        targetName: target.name,
        confirmed: input.confirmed,
        eligibleConfirmed: input.eligibleConfirmed
      }
    },
    { fixedTargetUuid: target.uuid, fixedTargetName: target.name }
  );
  if (!opts) return null;
  const clock = JSON.stringify(actor.mentalLeapCombatContext()),
    preview = actor.weaponAttack(item, opts);
  if (preview.blocked || (preview.firearm && preview.fireMode !== "single"))
    throw Error(preview.reason || loc`Cheap Shot uses Single-Shot Standard Attack.`);
  const snapshot = JSON.stringify(preview);
  const validate = () => {
    const current = actor.items.get(item.id);
    if (
      !actor.isOwner ||
      !current ||
      current.system.equipped !== true ||
      JSON.stringify(actor.mentalLeapCombatContext()) !== clock ||
      JSON.stringify(actor.weaponAttack(current, opts)) !== snapshot
    )
      throw Error(loc`The Cheap Shot source or circumstances changed.`);
  };
  validate();
  return actor.rollAttack(item, { ...opts, validateAttackContext: validate });
}

export async function validateCheapShotTarget(actor, context, { targetUuid } = {}) {
  if (!context) return;
  if (targetUuid && targetUuid !== context.targetUuid)
    throw Error(loc`Cheap Shot must use this attack’s actual opponent.`);
  const target = await fromUuid(context.targetUuid);
  if (
    !target ||
    !["agent", "npc"].includes(target.type) ||
    target.uuid === actor.uuid ||
    target.name !== context.targetName ||
    !(target.isOwner || game.user.isGM || target.testUserPermission?.(game.user, "OBSERVER"))
  )
    throw Error(loc`The actual Cheap Shot opponent changed or is no longer observable.`);
  const prior = cheapShotRecords({ ...target.system, usagePeriods: target.usagePeriods ?? actor.usagePeriods });
  // Submission Supremacy (p.188): further Cheap Shots in a scene, each with a different penalty.
  const supremacy = actor.system?.activeFeatNames?.includes("Submission Supremacy") === true;
  if (prior.length && !(supremacy && !prior.some(r => r.choice === context.choice)))
    throw Error(
      supremacy
        ? loc`Submission Supremacy: choose a penalty this combatant has not already suffered this scene.`
        : loc`This combatant already suffered a successful Cheap Shot this scene.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "cheapShotTarget",
  order: 1290,
  validate: ({ actor, options }) =>
    validateCheapShotTarget(actor, options.attackContext?.cheapShot, {
      targetUuid:
        options.attackContext?.characterTarget?.actorUuid ||
        options.finalAttack?.opponentUuid ||
        options.finalAttack?.targetUuid
    })
});
