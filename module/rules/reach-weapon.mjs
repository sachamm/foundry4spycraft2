import { reachAttackPlan } from "./reach.mjs";
import { ownedWeaponTraining, weaponSourceIdentity } from "./weapon-training.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
export function reachWeaponPlan(
  system,
  weapon,
  {
    trained = false,
    ranged = false,
    adjacent = null,
    geometryConfirmed = false,
    defensive = false,
    operatingProficiency = weapon?.proficiency ?? null
  } = {}
) {
  const p = reachAttackPlan(weapon, {
    trained,
    ranged,
    adjacent,
    geometryConfirmed,
    defensive,
    polearmBasics: system.activeFeatNames?.includes("Polearm Basics") === true
  });
  return {
    ...p,
    evidence: {
      ...p.evidence,
      ...weaponSourceIdentity(weapon, { operatingProficiency }),
      sourceFamily: weapon?.meleeFamily ?? ""
    }
  };
}
export function validateReachWeaponProof(actor, proof, context = {}) {
  if (!proof) return;
  if (
    proof.listedFeet &&
    !proof.defensive &&
    ((context.attackContext?.reachAdjacent ?? null) !== proof.adjacent ||
      (context.attackContext?.reachGeometryConfirmed === true) !== proof.geometryConfirmed)
  )
    throw Error("The recorded Reach adjacency or geometry declaration changed.");
  const { weapon, trained, operatingProficiency } = ownedWeaponTraining(actor, proof, context),
    ranged = !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(operatingProficiency);
  if (context.rerollOf) {
    const original =
        globalThis.fromUuidSync?.(context.rerollOf) ??
        [...(globalThis.game?.messages ?? [])].find(m => m.uuid === context.rerollOf),
      c = original?.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      c.weaponUuid !== context.weaponUuid ||
      c.resolved ||
      c.superseded ||
      stable(c.attackContext?.reach) !== stable(proof)
    )
      throw Error("Use the actual owned unresolved Reach attack for its original replacement.");
    // Training/quality guards still apply normally; the earned feat waiver is temporal.
    const s = { ...actor.system, activeFeatNames: proof.polearmWaiver ? ["Polearm Basics"] : [] },
      p = reachWeaponPlan(s, weapon, {
        trained,
        ranged,
        operatingProficiency,
        defensive: context.attackContext?.disarm?.role === "defender",
        adjacent: proof.adjacent,
        geometryConfirmed: proof.geometryConfirmed
      });
    if (p.blocked || stable(p.evidence) !== stable(proof))
      throw Error("The original Reach weapon or actual training changed before replacement.");
    return;
  }
  const c = context.attackContext ?? {},
    p = reachWeaponPlan(actor.system, weapon, {
      trained,
      ranged,
      operatingProficiency,
      defensive: c.disarm?.role === "defender",
      adjacent: c.reachAdjacent ?? null,
      geometryConfirmed: c.reachGeometryConfirmed === true
    });
  if (
    p.blocked ||
    (p.evidence.listedFeet &&
      !p.evidence.defensive &&
      (!p.evidence.geometryConfirmed || p.evidence.adjacent === null)) ||
    stable(p.evidence) !== stable(proof)
  )
    throw Error("The actual Reach weapon, training, polearm feat or confirmed geometry changed before posting.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "reachWeapon",
  order: 1250,
  validate: ({ actor, options, checkKind }) =>
    validateReachWeaponProof(actor, options.attackContext?.reach, {
      checkKind,
      weaponProficiency: options.weaponProficiency,
      weaponUuid: options.weaponUuid,
      attackContext: options.attackContext,
      rerollOf: options.rerollOf
    })
});
