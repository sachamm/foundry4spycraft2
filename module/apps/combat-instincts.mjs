import { completeCharacterTarget, knownCharacterTargetInput } from "./character-target.mjs";
import { limitedFinalAttack } from "./final-attack.mjs";
import { combatInstinctsPlan } from "../rules/combat-instincts.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent, standardAttackContextInput } from "./standard-attack-context.mjs";
import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
export async function takeCombatInstincts(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  for (const key of [
    "disarm",
    "oneInAMillion",
    "millionDollarSkill",
    "cunningPlan",
    "additionalUses",
    "additionalCost"
  ])
    if (options[key])
      throw new Error(
        loc`This control resolves one Standard Attack; use normal class controls and GC use-count review for combined class declarations.`
      );
  const combat = expertiseCombatContext(actor),
    clock = JSON.stringify(combat);
  let input = options;
  if (!Object.hasOwn(input, "triggerConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      choices = [...(game.messages ?? [])]
        .filter(
          m =>
            m.visible !== false &&
            m.isContentVisible !== false &&
            (!m.blind || game.user.isGM) &&
            m.flags?.spycraft2?.checkKind === "attack" &&
            m.flags.spycraft2.actorUuid !== actor.uuid &&
            m.flags.spycraft2.rollCombat?.id === combat?.id &&
            m.flags.spycraft2.rollCombat?.round === combat?.round &&
            m.flags.spycraft2.successConfirmed === false &&
            m.flags.spycraft2.resolved === true &&
            !m.flags.spycraft2.superseded &&
            !m.flags.spycraft2.attackContext?.disarm?.active
        )
        .map(
          m =>
            `<option value="${esc(m.id)}">${esc(m.speaker?.alias ?? m.flags.spycraft2.actorUuid)}: ${m.flags.spycraft2.effectiveTotal} (${esc(m.id)})</option>`
        )
        .join(""),
      weapons = actor.items
        .filter(i => i.type === "weapon")
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await formDialog({
      title: loc`Combat Instincts immediate final attack`,
      intro: loc`Once per round, immediately attack the adjacent opponent who just missed you by at least 5 while you were not flat-footed. First resolve that actual attack as a miss in chat. The GC confirms the victim, adjacency and timing; this does not infer token geometry.`,
      fields: [
        {
          select: "messageId",
          label: loc`Recorded missed attack`,
          options: [["", loc`Choose the actual attack`]],
          optionsHtml: raw(choices)
        },
        {
          number: "defenseTotal",
          label: loc`Your actual incoming Defense for that attack`,
          step: "any",
          required: true
        },
        { select: "weaponId", label: loc`Your readied weapon`, optionsHtml: raw(weapons) },
        raw(standardAttackContextContent(actor, { includeCharacterTarget: false })),
        { check: "triggerConfirmed", label: loc`The GC confirms the selected attack targeted this character` },
        { check: "adjacentConfirmed", label: loc`That opponent is adjacent` },
        { check: "notFlatFootedConfirmed", label: loc`I was not flat-footed when that attack missed` },
        {
          check: "immediateConfirmed",
          label: loc`This is the immediate reaction to that miss against that same opponent`
        },
        raw(
          game.user.isGM
            ? `<label>${loc`GC timing resolution (required if a recorded flat-footed source now conflicts)`} <input name="gcTimingResolution" maxlength="500" /></label>`
            : ""
        ),
        {
          note: loc`One free-action Standard Attack, including outside own Count; set Single-Shot mode first. No adjustments or other action combinations. Other class attack controls may be used with GC review of the feat counter.`
        }
      ]
    });
    if (!input) return null;
  }
  const defenseTotal =
      typeof input.defenseTotal === "number"
        ? input.defenseTotal
        : typeof input.defenseTotal === "string" && input.defenseTotal.trim()
          ? Number(input.defenseTotal)
          : NaN,
    timing = game.user.isGM && typeof input.gcTimingResolution === "string" ? input.gcTimingResolution.trim() : "";
  if (timing.length > 500) throw new Error(loc`Keep the GC timing resolution within 500 characters.`);
  const event = () => {
    const message = game.messages.get(input.messageId),
      check = message?.flags?.spycraft2,
      now = expertiseCombatContext(actor);
    if (
      !message ||
      message.visible === false ||
      message.isContentVisible === false ||
      (message.blind && !game.user.isGM) ||
      check?.actorUuid === actor.uuid ||
      !actor.participatingCombat?.turns?.some(
        t => t.id === check?.rollCombat?.combatantId && t.actor?.uuid === check.actorUuid
      )
    )
      throw new Error(loc`Choose the visible actual opponent’s attack from this combat.`);
    return {
      message,
      plan: combatInstinctsPlan(actor.system, now, check, { ...input, defenseTotal, gcTimingResolution: timing })
    };
  };
  if (JSON.stringify(expertiseCombatContext(actor)) !== clock)
    throw new Error(loc`The Initiative Count changed. Review the immediate reaction again.`);
  const original = event(),
    evidence = rollEvidence(original.message.flags.spycraft2),
    targetInput = knownCharacterTargetInput(original.plan.opponentUuid, {
      ...standardAttackContextInput(input),
      targetName: input.targetName || String(original.message.speaker?.alias || "The attacking opponent").slice(0, 200)
    }),
    opts = await completeCharacterTarget(
      actor,
      actor.items.get(input.weaponId)?.system,
      { ...targetInput, attackAction: "standard", freeFinalAttack: true },
      {
        fixedTargetUuid: targetInput.targetActorUuid,
        fixedTargetName: targetInput.targetActorUuid ? undefined : targetInput.targetName
      }
    ),
    item = actor.items.get(input.weaponId),
    ready = w => w?.type === "weapon" && w.system.equipped === true && w.system.carried !== false && !w.system.reserve;
  if (!opts) return null;
  if (!ready(item)) throw new Error(loc`Choose an owned readied weapon for the final attack.`);
  const preview = actor.weaponAttack(item, opts);
  if (
    (preview.ranged && !Number.isFinite(opts.distanceFeet)) ||
    preview.blocked ||
    (preview.firearm && preview.fireMode !== "single")
  )
    throw new Error(
      preview.reason || loc`A ranged final Standard Attack requires measured distance and Single-Shot mode.`
    );
  const signature = JSON.stringify(preview),
    receipt = {
      ...original.plan,
      weaponId: item.id,
      weaponUuid: item.uuid,
      id: foundry.utils.randomID(),
      triggerMessageUuid: original.message.uuid ?? original.message.id,
      triggerEvidence: evidence
    };
  return limitedFinalAttack(actor, "combatInstincts", {
    weaponId: input.weaponId,
    options: opts,
    receipt,
    check() {
      if (!actor.isOwner || JSON.stringify(expertiseCombatContext(actor)) !== clock || (timing && !game.user.isGM))
        throw new Error(loc`The immediate reaction, ownership or GC timing review changed.`);
    },
    changed() {
      const fresh = event(),
        w = actor.items.get(input.weaponId);
      return (
        JSON.stringify(fresh.plan) !== JSON.stringify(original.plan) ||
        rollEvidence(fresh.message.flags.spycraft2) !== evidence ||
        !ready(w) ||
        JSON.stringify(actor.weaponAttack(w, opts)) !== signature
      );
    },
    changedMessage: loc`The triggering miss, weapon or reserved reaction changed. Review it again.`
  });
}
