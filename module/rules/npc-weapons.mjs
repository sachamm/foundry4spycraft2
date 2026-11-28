import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { sameValues, stable } from "./equal.mjs";

const norm = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const labels = { augmented: () => loc`Augmented`, "natural-attack": () => loc`Natural Attack` };

/** NPC quality Details explicitly name an owned item. Duplicate/missing names never grant a guessed exception. */
export function npcBuiltInPlan(profile, items = []) {
  if (profile?.enabled !== true) return { sources: [], unresolved: [], warnings: [] };
  const sources = [],
    unresolved = [],
    warnings = [];
  for (const [index, quality] of (profile.qualities ?? []).entries()) {
    if (!quality || !Object.hasOwn(labels, quality.id)) continue;
    const name = norm(quality.details),
      candidates = items.filter(
        item =>
          norm(item.name) === name &&
          (quality.id === "natural-attack"
            ? item.type === "weapon"
            : ["weapon", "gear", "armor", "vehicle"].includes(item.type))
      );
    if (!name || candidates.length !== 1 || !(candidates[0].id ?? candidates[0]._id)) {
      unresolved.push({
        qualityId: quality.entryId ?? null,
        qualityIndex: index,
        key: quality.id,
        details: String(quality.details ?? "")
      });
      warnings.push(
        loc`${labels[quality.id]()} needs one uniquely named owned item in its Details. Resolve missing or duplicate choices with the GC.`
      );
      continue;
    }
    const item = candidates[0];
    sources.push({
      qualityId: quality.entryId ?? null,
      qualityIndex: index,
      key: quality.id,
      itemId: item.id ?? item._id,
      itemType: item.type,
      name: item.name
    });
  }
  return { sources, unresolved, warnings };
}

export function npcWeaponTraining(system, weapon = {}) {
  const nonCombatant =
      system.npcProfile?.enabled === true && system.npcProfile.qualities?.some(q => q.id === "non-combatant"),
    source = system.npcBuiltIn?.sources?.find(
      row => row.itemType === "weapon" && row.itemId === (weapon.id ?? weapon._id)
    ),
    builtIn = source ? labels[source.key]() : "",
    unresolved = !!nonCombatant && (system.npcBuiltIn?.unresolved?.length ?? 0) > 0;
  return {
    nonCombatant: !!nonCombatant,
    trained: (!nonCombatant && system.npcType !== "animal") || !!source,
    builtIn,
    source: source ? { ...source } : null,
    blockedReason: unresolved
      ? loc`Resolve this Non-Combatant NPC's actual built-in choices before deciding weapon proficiency.`
      : ""
  };
}

export function validateNpcWeaponTraining(context) {
  const { actor, options = {}, phase } = context;
  if (actor?.type !== "npc" || !options.weaponUuid) return;
  const item = [...(actor.items ?? [])].find(row => row.uuid === options.weaponUuid);
  if (!item && context.npcTrainingProof)
    throw Error(loc`The NPC's original weapon is no longer present. Keep the actual dice for GC review.`);
  if (!item) return; // A manual attack without an owned weapon remains a separate GC declaration.
  const training = npcWeaponTraining(actor.system, { ...item.system, id: item.id });
  if (training.blockedReason) throw Error(training.blockedReason);
  const proof = stable(training);
  if (phase === "before") {
    context.npcTrainingProof = proof;
    context.npcTraining = training;
  } else if (phase === "after" && !sameValues(context.npcTrainingProof, proof))
    throw Error(
      loc`The NPC's weapon proficiency or built-in source changed during this attack. Keep the actual dice for GC review.`
    );
}

rollPipeline.register({
  id: "npcWeaponTraining",
  order: -1999,
  kinds: ["attack"],
  validate: validateNpcWeaponTraining,
  flags: context => (context.npcTraining ? { npcWeaponTraining: context.npcTraining } : {})
});
