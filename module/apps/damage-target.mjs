import { knownSneakAttackImmunity } from "../rules/sneak-attack.mjs";
const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
export function damageTargetChoices() {
  const targets = values(game.user?.targets),
    actors = new Map();
  for (const token of targets)
    if (token.actor?.uuid)
      actors.set(token.actor.uuid, { uuid: token.actor.uuid, name: token.name ?? token.actor.name });
  for (const actor of values(game.actors))
    if (
      actor.uuid &&
      ["agent", "npc"].includes(actor.type) &&
      (actor.visible || actor.isOwner || game.user.isGM) &&
      !actors.has(actor.uuid)
    )
      actors.set(actor.uuid, { uuid: actor.uuid, name: actor.name });
  return { actors: [...actors.values()], selected: targets.length === 1 ? (targets[0].actor?.uuid ?? "") : "" };
}
export async function resolveDamageTarget(uuid) {
  if (uuid === "" || uuid === undefined || uuid === null) return null;
  if (typeof uuid !== "string") throw new Error("Choose an actual character target or confirm a manual target.");
  const actor = await fromUuid(uuid);
  if (actor?.documentName !== "Actor" || !["agent", "npc"].includes(actor.type) || !actor.system)
    throw new Error("The selected character target is unavailable. Confirm it again.");
  return actor;
}
const protectionSignature = actor =>
  JSON.stringify({
    immune: knownSneakAttackImmunity(actor.system).immune,
    armor: [...(actor.system.armor?.items ?? [])].sort(),
    listedDR: actor.system.armorDRByAttack ?? null
  });
export const sneakAttackTargetSnapshot = actor =>
  actor ? { actorUuid: actor.uuid, protectionSignature: protectionSignature(actor) } : null;
export async function validateSneakAttackTarget(snapshot) {
  if (!snapshot) return;
  if (typeof snapshot.actorUuid !== "string" || typeof snapshot.protectionSignature !== "string")
    throw new Error("Review the saved sneak attack target.");
  const actor = await resolveDamageTarget(snapshot.actorUuid);
  if (!actor || protectionSignature(actor) !== snapshot.protectionSignature)
    throw new Error("The target’s armor or protection changed. Confirm damage again.");
  if (knownSneakAttackImmunity(actor.system).immune) throw new Error("The target is immune to sneak attack damage.");
}
