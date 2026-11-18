import { validOwnCountClock } from "./own-count-duration.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
/** Threaten p.361 is a combat action, separate from Coercion/Domination pp.134–135. */
export function threatenSkillChecks(key, checks = []) {
  const role = key === "intimidate" ? "attacker" : key === "resolve" ? "defender" : null;
  if (!role) return checks;
  const id = role === "attacker" ? "threaten" : "resist-threaten";
  return [
    ...checks.filter(c => c.id !== id),
    {
      id,
      name: role === "attacker" ? "Threaten Action" : "Resist Threaten",
      attributes: ["wis"],
      mode: "Active",
      tags: "Hearing, Language",
      error: 1,
      time: role === "attacker" ? "1 Half Action" : "Opposed response",
      page: 361,
      synergies: [],
      combatAction: "threaten",
      role
    }
  ];
}
/** GC confirms target identity/injury provenance; the prepared weapon list proves an actually held ranged weapon. */
export function threatenCheckPlan(
  system,
  key,
  check,
  {
    method = "roll",
    threatenOpponentName = "",
    threatenOpponentConfirmed = false,
    threatenContextConfirmed = false,
    threatenDistanceFeet = null,
    threatenVitalityLoss = 0,
    threatenWoundLoss = 0,
    threatenInjuryFromYourAttacksConfirmed = false,
    threatenIncomingLegalConfirmed = false,
    threatenWeaponId = "",
    threatenCombat = null
  } = {}
) {
  const role =
      key === "intimidate" && check.id === "threaten"
        ? "attacker"
        : key === "resolve" && check.id === "resist-threaten"
          ? "defender"
          : null,
    empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (!role) return empty;
  const reject = blockedReason => ({ ...empty, blockedReason });
  if (method !== "roll") return reject("Threaten is opposed; taking10/20 is unavailable (p.91).");
  if (
    threatenOpponentConfirmed !== true ||
    threatenContextConfirmed !== true ||
    typeof threatenOpponentName !== "string" ||
    !threatenOpponentName.trim() ||
    threatenOpponentName.trim().length > 200
  )
    return reject("Name the opposing character and confirm the Threaten circumstances with the GC.");
  if (
    role === "attacker" &&
    (!validOwnCountClock(threatenCombat) || threatenCombat.turn !== threatenCombat.ownTurnIndex)
  )
    return reject("Take the Threaten attack action during your Initiative Count in a started combat.");
  if (role === "defender" && threatenIncomingLegalConfirmed !== true)
    return reject("The GC must confirm this is the Resolve(Wis) response to a legal incoming Threaten action.");
  const basics = system.activeFeatNames?.includes("CQB Basics") === true,
    mastery = system.activeFeatNames?.includes("CQB Mastery") === true,
    glint = system.activeFeatNames?.includes("Glint of Madness") === true,
    candidates = system.readiedRangedWeapons ?? [];
  if (typeof threatenWeaponId !== "string")
    return reject("Choose a held/readied ranged weapon, or leave the selection empty.");
  const weapon = threatenWeaponId ? candidates.find(w => w.id === threatenWeaponId) : null;
  if (threatenWeaponId && !weapon) return reject("The selected ranged weapon is no longer held/readied and available.");
  let target = null;
  if (role === "attacker") {
    if (
      !Number.isFinite(threatenDistanceFeet) ||
      threatenDistanceFeet < 0 ||
      !Number.isFinite(system.cqbRange) ||
      system.cqbRange < 0 ||
      threatenDistanceFeet > system.cqbRange
    )
      return reject("Confirm a nonnegative measured target distance within your current CQB Range.");
    if (![threatenVitalityLoss, threatenWoundLoss].every(n => Number.isSafeInteger(n) && n >= 0))
      return reject("Enter nonnegative whole vitality/wound losses caused by your attacks.");
    const injuryQualified =
        threatenInjuryFromYourAttacksConfirmed === true && (threatenVitalityLoss >= 5 || threatenWoundLoss >= 1),
      injuryWaived = glint || (mastery && !!weapon);
    if (!injuryQualified && !injuryWaived)
      return reject(
        "The target must have lost5vitality or1wound to your attacks, or have Glint of Madness, or hold a readied ranged weapon with CQB Mastery."
      );
    target = {
      distanceFeet: threatenDistanceFeet,
      cqbRange: system.cqbRange,
      vitalityLoss: threatenVitalityLoss,
      woundLoss: threatenWoundLoss,
      injuryFromYourAttacksConfirmed: threatenInjuryFromYourAttacksConfirmed === true,
      injuryQualified,
      injuryWaived: !injuryQualified && injuryWaived
    };
  }
  const gearBonus = basics && weapon ? 2 : 0,
    evidence = {
      version: 1,
      source: "Threaten",
      skillKey: key,
      checkId: check.id,
      role,
      opponentName: threatenOpponentName.trim(),
      opponentConfirmed: true,
      contextConfirmed: true,
      basics,
      mastery,
      ...(glint ? { glintOfMadness: true } : {}),
      weapon: weapon ? structuredClone(weapon) : null,
      target,
      ...(role === "attacker" ? { combat: structuredClone(threatenCombat) } : { incomingLegalConfirmed: true }),
      gearBonus
    };
  return {
    evidence,
    bonuses: gearBonus ? [{ source: "CQB Basics (Threaten)", type: "gear", value: 2 }] : [],
    blockedReason: "",
    notes: [
      `Threaten: ${role === "attacker" ? "Intimidate(Wis), half attack action" : "Resolve(Wis), opposed response"}; Hearing/Language, error modifier+0. ${gearBonus ? "CQB Basics adds+2gear from the selected held/readied ranged weapon. " : ""}${target?.injuryWaived ? (glint ? "Glint of Madness waives the prior-injury requirement without requiring a weapon. " : "CQB Mastery waives the prior-injury requirement. ") : ""}Compare the opposed results and resolve stress, fright and next-attack effects with the GC (pp.180,361).`
    ]
  };
}

/** Replacement/direct rolls retain the exact participants, source, weapon, range and own Count. */
export function validateThreatenProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", combat = null } = {}
) {
  if (!proof) return;
  const t = proof.target,
    p = threatenCheckPlan(
      system,
      skillKey,
      { id: checkId },
      {
        method: checkMethod,
        threatenOpponentName: proof.opponentName,
        threatenOpponentConfirmed: proof.opponentConfirmed,
        threatenContextConfirmed: proof.contextConfirmed,
        threatenDistanceFeet: t?.distanceFeet,
        threatenVitalityLoss: t?.vitalityLoss,
        threatenWoundLoss: t?.woundLoss,
        threatenInjuryFromYourAttacksConfirmed: t?.injuryFromYourAttacksConfirmed,
        threatenIncomingLegalConfirmed: proof.incomingLegalConfirmed,
        threatenWeaponId: proof.weapon?.id ?? "",
        threatenCombat: combat
      }
    );
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    !p.evidence ||
    JSON.stringify(p.evidence) !== JSON.stringify(proof)
  )
    throw new Error(
      p.blockedReason || "The Threaten participants, CQB source, weapon or Initiative Count changed before posting."
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "threaten",
  order: 1570,
  record: ["threaten"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey }) =>
    validateThreatenProof(actor.system, options.threaten, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      combat: actor.mentalLeapCombatContext()
    })
});
rollPipeline.register({
  id: "threatenChecks",
  order: 5050,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => threatenSkillChecks(skillKey, checks)
});
