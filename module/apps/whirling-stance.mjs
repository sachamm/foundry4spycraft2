import { uncannyDodgePlan } from "../rules/defense.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { characterCareerLevel, whirlingStancePlan } from "../rules/whirling-stance.mjs";
import { combatStanceState } from "../rules/combat-stance.mjs";
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
export function whirlingAttackProof(actor, input = {}) {
  if (input.targetFlanked !== true) return null;
  const targetUuid = input.characterTarget?.actorUuid || input.targetActorUuid;
  if (!targetUuid) return null;
  const target = attackCharacterTargetChoices().find(a => a.uuid === targetUuid && a.uuid !== actor.uuid);
  if (!target) throw Error("Choose the current observed flanking target.");
  const attackerLevel = characterCareerLevel(actor.type, actor.system),
    defender = {
      ...target.system,
      ...(target.type === "npc" ? { level: characterCareerLevel("npc", target.system) } : {})
    },
    plan = whirlingStancePlan(defender, { flanked: true, attackerLevel });
  return { version: 1, targetUuid: target.uuid, targetType: target.type, attackerLevel, ...plan };
}
export function validateWhirlingAttackProof(
  actor,
  proof,
  { checkKind, attackContext = {}, rerollOf, sneakAttack } = {}
) {
  if (!proof) return;
  if (
    !["attack", "damage"].includes(checkKind) ||
    attackContext.targetFlanked !== true ||
    proof.targetUuid !== (attackContext.characterTarget?.actorUuid || attackContext.targetActorUuid)
  )
    throw Error("The Whirling flanking proof belongs to its actual attack and target.");
  if (rerollOf) {
    const original = globalThis.fromUuidSync?.(rerollOf),
      c = original?.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== checkKind ||
      c.resolved ||
      c.superseded ||
      stable(checkKind === "attack" ? c.attackContext?.flanking?.whirling : c.sneakAttack?.whirling) !== stable(proof)
    )
      throw Error("Use the original owned unresolved flanking attack for its replacement.");
    return;
  }
  const current = whirlingAttackProof(actor, attackContext);
  if (
    stable(current) !== stable(proof) ||
    (current?.prevented && (checkKind === "attack" || sneakAttack?.targetFlanked !== false))
  )
    throw Error("The actual target’s Whirling Stance or the characters’ career levels changed. Review flanking again.");
}
export function whirlingDefenseContent(actor) {
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>Whirling Stance — flanking attacker</summary><p>While in Whirling Stance, characters with a lower career level cannot flank you. For this incoming attack, choose its actual attacker; the GC still confirms all ordinary flanking geometry and other participants. NPC career level uses current Threat Level, not its Tier-adjusted statistics (pp.179,452).</p><label>Actual attacker <select name="whirlingAttackerUuid"><option value="">Unrecorded attacker; GC level below</option>${attackCharacterTargetChoices()
    .filter(a => a.uuid !== actor.uuid)
    .map(a => '<option value="' + esc(a.uuid) + '">' + esc(a.name) + "</option>")
    .join(
      ""
    )}</select></label><label>Career level of unrecorded flanking attacker <input name="whirlingAttackerLevel" type="number" min="1" max="20" step="1" /></label><label><input name="whirlingLevelConfirmed" type="checkbox" /> The GC confirms the unrecorded attacker’s actual career level</label></details>`;
}
export function whirlingDefensePreview(actor, input = {}) {
  const active = combatStanceState(actor.system)?.key === "whirling",
    flanked = input.flanked === true && !uncannyDodgePlan(actor.system).cannotBeFlanked;
  let attacker = null,
    level = null;
  if (active && flanked) {
    if (input.whirlingAttackerUuid) {
      attacker = attackCharacterTargetChoices().find(
        a => a.uuid === input.whirlingAttackerUuid && a.uuid !== actor.uuid
      );
      if (!attacker) throw Error("Choose the actual observed flanking attacker.");
      level = characterCareerLevel(attacker.type, attacker.system);
    } else {
      level =
        typeof input.whirlingAttackerLevel === "number"
          ? input.whirlingAttackerLevel
          : typeof input.whirlingAttackerLevel === "string" && input.whirlingAttackerLevel.trim()
            ? Number(input.whirlingAttackerLevel)
            : null;
      if (input.whirlingLevelConfirmed !== true)
        throw Error("The GC must confirm an unrecorded flanking attacker’s actual career level.");
    }
  }
  return {
    plan: whirlingStancePlan(actor.system, { flanked, attackerLevel: level }),
    attackerUuid: attacker?.uuid ?? null,
    attackerType: attacker?.type ?? null
  };
}
export function validateWhirlingDefensePreview(actor, input, proof) {
  if (stable(whirlingDefensePreview(actor, input)) !== stable(proof))
    throw Error(
      "Whirling Stance, its qualified feat or the actual flanking attacker’s career level changed. Reopen the Defense preview."
    );
}
export function validateWhirlingIncomingIdentity(proof, otherAttackerUuids = []) {
  if (!proof?.plan?.stance || !proof.plan.declared) return;
  for (const uuid of otherAttackerUuids.filter(Boolean))
    if (uuid !== proof.attackerUuid)
      throw Error(
        "Whirling Stance, cover and invisibility must refer to the same actual incoming attacker; select that observed character for its career level."
      );
}
