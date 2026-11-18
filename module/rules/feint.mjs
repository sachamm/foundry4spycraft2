import { combatStanceProof } from "./combat-stance.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { fencingDisarmPlan as readiedFencingPlan } from "./fencing-disarm.mjs";
import { readiedItemsForCheck } from "./readied-replacement.mjs";
import { readiedMeleeFeatSource, readiedMeleeWeapons } from "./readied-weapons.mjs";
import { readiedDisarmWeapons } from "./disarm-response.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
/** Ordinary Feint p.357. Alternative skills, free actions and outcomes are separate. */
export function feintSkillChecks(key, checks = []) {
  const acting = key === "sleightOfHand",
    defending = key === "notice";
  if (!acting && !defending) return checks;
  const id = acting ? "feint" : "resist-feint";
  return [
    ...checks.filter(c => c.id !== id),
    {
      id,
      name: acting ? "Feint Action" : "Resist Feint",
      attributes: [acting ? "dex" : "wis"],
      mode: "Active",
      tags: acting ? "Hands-On, Vision" : "Vision",
      error: 2,
      time: acting ? "1 Half Action" : "Opposed response",
      page: 357,
      synergies: [],
      combatAction: "feint",
      role: acting ? "attacker" : "defender"
    }
  ];
}
export function feintCheckPlan(
  system,
  key,
  check,
  {
    method = "roll",
    feintOpponentName = "",
    feintOpponentUuid = "",
    feintAdjacent = false,
    feintTargetEligibleConfirmed = false,
    feintLegalConfirmed = false,
    feintCombat = null
  } = {}
) {
  const role =
      key === "sleightOfHand" && check?.id === "feint"
        ? "attacker"
        : key === "notice" && check?.id === "resist-feint"
          ? "defender"
          : null,
    empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (!role) return empty;
  const reject = blockedReason => ({ ...empty, blockedReason });
  if (method !== "roll") return reject("Feint is an opposed combat action; taking10/20 is unavailable (pp.91,352).");
  if (!validOwnCountClock(feintCombat) || (role === "attacker" && feintCombat.turn !== feintCombat.ownTurnIndex))
    return reject(
      "Use a started combat with this participant; take the ordinary Feint half action during your Initiative Count."
    );
  if (
    typeof feintOpponentName !== "string" ||
    !feintOpponentName.trim() ||
    feintOpponentName.trim().length > 200 ||
    ![feintAdjacent, feintTargetEligibleConfirmed, feintLegalConfirmed].every(v => v === true)
  )
    return reject(
      "Name the adjacent opponent and confirm the legal Feint and that its target has not already been targeted by a successful Feint this round (p.357)."
    );
  let fencingBasics, flailBasics;
  try {
    fencingBasics = readiedFencingPlan(system);
    flailBasics = readiedMeleeFeatSource(system, { name: "Flail Basics", family: "flail", bonus: 2 });
    if (flailBasics) {
      const ready = system.disarmWeapons;
      if (
        !ready ||
        ready.blockedReason ||
        flailBasics.weapons.some(w => !ready.weapons.some(r => r.id === w.id && r.hands === w.hands))
      )
        throw Error(ready?.blockedReason || "Review the actual held flail and legal grip.");
    }
  } catch (error) {
    return reject(error.message);
  }
  if (typeof feintOpponentUuid !== "string" || feintOpponentUuid.length > 500)
    return reject("Choose an actual opposing character.");
  const evidence = {
    ...(feintOpponentUuid ? { opponentUuid: feintOpponentUuid, combatStance: combatStanceProof(system) } : {}),
    version: feintOpponentUuid ? 3 : 2,
    skillKey: key,
    checkId: check.id,
    role,
    opponentName: feintOpponentName.trim(),
    adjacent: true,
    targetEligibleConfirmed: true,
    legalConfirmed: true,
    combat: structuredClone(feintCombat),
    fencingBasics,
    flailBasics
  };
  return {
    ...empty,
    evidence,
    bonuses: [
      ...(fencingBasics ? [{ source: "Fencing Basics (Feint)", type: "gear", value: 2 }] : []),
      ...(flailBasics ? [{ source: "Flail Basics (Feint)", type: "gear", value: 2 }] : [])
    ],
    notes: [
      ...(flailBasics
        ? [
            "Flail Basics: +2 gear with this Feint skill check while holding a reviewed readied flail; gear bonuses do not stack (p.178)."
          ]
        : []),
      `Feint: opposed ${role === "attacker" ? "Sleight of Hand(DEX), Hands-On and Vision; one half action" : "Notice(WIS), Vision; response to the incoming half action"}; base error1 plus action error+1 on both checks (pp.352,357).`,
      ...(fencingBasics
        ? [
            "Fencing Basics: +2 gear with this Feint skill check while holding a readied one-handed FIN sword; gear bonuses do not stack (p.178)."
          ]
        : []),
      "The GC confirms that the Feint target has not been targeted by a successful Feint this round. The loser becomes flat-footed. A winning critical success or losing critical failure gives the winner +2 with the next attack against the loser, expiring at the end of the following round if unused. Resolve opposed results, critical activation, conditions, the target restriction and next-attack benefits separately."
    ]
  };
}
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
export function validateFeintProof(
  actor,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", ability, attributeSubstitution, combat } = {}
) {
  if (!proof) return;
  // Skill rerolls never waive destroyed inventory. Only canonical local IDs are
  // normalized; explicit UUIDs remain exact and all Items belong to this actor.
  const items = readiedItemsForCheck(actor, {
      disarm: {
        fencingBasics: { weapons: [...(proof.fencingBasics?.weapons ?? []), ...(proof.flailBasics?.weapons ?? [])] }
      }
    }),
    system = {
      ...actor.system,
      readiedMeleeWeapons: readiedMeleeWeapons(actor.system, items),
      disarmWeapons: readiedDisarmWeapons(actor.system, items)
    },
    p = feintCheckPlan(
      system,
      skillKey,
      { id: checkId },
      {
        method: checkMethod,
        feintOpponentName: proof.opponentName,
        feintOpponentUuid: proof.opponentUuid ?? "",
        feintAdjacent: proof.adjacent,
        feintTargetEligibleConfirmed: proof.targetEligibleConfirmed,
        feintLegalConfirmed: proof.legalConfirmed,
        feintCombat: combat
      }
    );
  const base = skillKey === "sleightOfHand" ? "dex" : "wis",
    substituted =
      attributeSubstitution?.source === "All According to Plan" &&
      attributeSubstitution.originalAbility === base &&
      attributeSubstitution.ability === "int" &&
      (actor.system.classLevels?.schemer ?? 0) >= 4;
  if (ability !== undefined && ability !== (substituted ? "int" : base))
    throw Error("The Feint key attribute or actual substitution source changed before posting.");
  const candidate = p.evidence ? structuredClone(p.evidence) : null;
  if (candidate && proof.version === 1) {
    candidate.version = 1;
    delete candidate.flailBasics;
  }
  if (checkKind !== "skill" || p.blockedReason || !candidate || stable(candidate) !== stable(proof))
    throw Error(
      "The Feint participants, eligibility declaration, Initiative Count or readied Feint gear source changed before posting."
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "feint",
  order: 1450,
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey, ability }) =>
    validateFeintProof(actor, options.feint, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      ability,
      attributeSubstitution: options.attributeSubstitution,
      combat: actor.mentalLeapCombatContext()
    })
});
rollPipeline.register({
  id: "feintChecks",
  order: 5060,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => feintSkillChecks(skillKey, checks)
});
