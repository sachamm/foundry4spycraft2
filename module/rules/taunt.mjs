/**
 * Taunt, an attack action (p.361), and Undermine (p.205).
 *
 * - A half action on the character's own Initiative Count against 1 opponent within CQB Range: Manipulate (Cha)
 *   opposed by the opponent's Sense Motive (Wis), both with the Hearing and Language tags.
 * - The taunter wins: the opponent must attack the taunter with their next available action. A winning critical
 *   success or losing critical failure also leaves the opponent enraged for 2d4 rounds.
 * - The opponent wins: +1 to their next attack check against the taunter (+2 on a winning critical success or the
 *   taunter's critical failure), lasting until used or until the combat ends. Recorded on the opponent as
 *   `system.tauntBonuses` and added to their attack against the taunter; a later attack carrying the same source uses it.
 * - Undermine: on a successful Taunt the target cannot spend action dice and takes a morale penalty equal to the
 *   taunter's Charisma modifier on Initiative and skill checks, for rounds equal to the taunter's Style feats.
 *   Recorded on the target as `system.undermined`, timed from the Initiative Count of the Taunt.
 */
import { validOwnCountClock } from "./own-count-duration.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const TAUNT_PAGE = 361;

/** The named checks: the Taunt action on Manipulate, the response on Sense Motive. */
export function tauntSkillChecks(key, checks = []) {
  const role = key === "manipulate" ? "attacker" : key === "senseMotive" ? "defender" : null;
  if (!role) return checks;
  const id = role === "attacker" ? "taunt" : "resist-taunt";
  return [
    ...checks.filter(c => c.id !== id),
    {
      id,
      name: role === "attacker" ? "Taunt Action" : "Resist Taunt",
      attributes: [role === "attacker" ? "cha" : "wis"],
      mode: "Active",
      tags: "Hearing, Language",
      error: 1,
      time: role === "attacker" ? "1 Half Action" : "Opposed response",
      page: TAUNT_PAGE,
      synergies: [],
      combatAction: "taunt",
      role
    }
  ];
}

export function tauntCheckPlan(
  system,
  key,
  check,
  {
    method = "roll",
    tauntOpponentUuid = "",
    tauntOpponentName = "",
    tauntInRangeConfirmed = false,
    tauntIncomingLegalConfirmed = false,
    tauntCombat = null
  } = {}
) {
  const role =
      key === "manipulate" && check?.id === "taunt"
        ? "attacker"
        : key === "senseMotive" && check?.id === "resist-taunt"
          ? "defender"
          : null,
    empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (!role) return empty;
  const reject = blockedReason => ({ ...empty, blockedReason });
  if (method !== "roll") return reject(loc`Taunt is opposed; taking 10 or 20 is unavailable (p.91).`);
  if (
    typeof tauntOpponentUuid !== "string" ||
    !tauntOpponentUuid ||
    typeof tauntOpponentName !== "string" ||
    !tauntOpponentName.trim() ||
    tauntOpponentName.length > 200
  )
    return reject(loc`Choose the opposing character.`);
  if (!validOwnCountClock(tauntCombat) || (role === "attacker" && tauntCombat.turn !== tauntCombat.ownTurnIndex))
    return reject(
      role === "attacker"
        ? loc`Take the Taunt attack action during your Initiative Count in a started combat.`
        : loc`Resist a Taunt in a started combat.`
    );
  if (role === "attacker" && tauntInRangeConfirmed !== true)
    return reject(loc`Confirm with the GC that the opponent is within your CQB Range and can hear you.`);
  if (role === "defender" && tauntIncomingLegalConfirmed !== true)
    return reject(loc`The GC must confirm this answers a legal incoming Taunt.`);
  const evidence = {
    version: 1,
    source: "Taunt",
    skillKey: key,
    checkId: check.id,
    role,
    opponentUuid: tauntOpponentUuid,
    opponentName: tauntOpponentName.trim(),
    combat: structuredClone(tauntCombat),
    ...(role === "attacker" ? { inRangeConfirmed: true } : { incomingLegalConfirmed: true })
  };
  return {
    ...empty,
    evidence,
    notes: [
      role === "attacker"
        ? loc`Taunt: Manipulate (Cha) against ${evidence.opponentName}’s Sense Motive (Wis); Hearing and Language; a half action. Settle it from this card once both checks are resolved (p.361).`
        : loc`Resist Taunt: Sense Motive (Wis) against ${evidence.opponentName}’s Manipulate (Cha); Hearing and Language (p.361).`
    ]
  };
}

export function validateTauntProof(system, proof, { checkKind, skillKey, checkId, checkMethod = "roll", combat } = {}) {
  if (!proof) return;
  const p = tauntCheckPlan(
    system,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      tauntOpponentUuid: proof.opponentUuid,
      tauntOpponentName: proof.opponentName,
      tauntInRangeConfirmed: proof.inRangeConfirmed === true,
      tauntIncomingLegalConfirmed: proof.incomingLegalConfirmed === true,
      tauntCombat: combat
    }
  );
  if (checkKind !== "skill" || !p.evidence || JSON.stringify(p.evidence) !== JSON.stringify(proof))
    throw new Error(p.blockedReason || loc`The Taunt participants or Initiative Count changed before posting.`);
}

/**
 * Who won the opposed Taunt. `acting` and `defending` are the two posted checks' flags; `defending` may be null when
 * the GC settles without a recorded response (`declared` then gives the result).
 * @returns {{attackerWon:boolean, critical:boolean, bonus:number}}
 */
export function tauntOutcome(acting, defending = null, { declared = "", tieWinner = "" } = {}) {
  if (acting?.taunt?.role !== "attacker" || acting.resolved !== true || acting.superseded)
    throw new Error(loc`Resolve the Taunt check in chat first.`);
  let attackerWon, critical;
  if (defending) {
    const q = defending.taunt;
    if (
      q?.role !== "defender" ||
      defending.resolved !== true ||
      defending.superseded ||
      defending.actorUuid !== acting.taunt.opponentUuid ||
      q.opponentUuid !== acting.actorUuid
    )
      throw new Error(loc`Pair the Taunt with the opponent’s resolved Resist Taunt check.`);
    const a = acting.effectiveTotal,
      d = defending.effectiveTotal;
    if (!Number.isFinite(a) || !Number.isFinite(d)) throw new Error(loc`Both checks need a final result.`);
    if (a === d && !["attacker", "defender"].includes(tieWinner))
      throw new Error(loc`The results are tied: break the tie (p.91) and name the winner.`);
    attackerWon = a > d || (a === d && tieWinner === "attacker");
    critical = attackerWon
      ? acting.criticalSuccess === true || defending.criticalFailure === true
      : defending.criticalSuccess === true || acting.criticalFailure === true;
  } else {
    if (!["won", "wonCritical", "lost", "lostCritical"].includes(declared))
      throw new Error(loc`Choose how the opposed Taunt ended.`);
    attackerWon = declared.startsWith("won");
    critical = declared.endsWith("Critical");
  }
  return { attackerWon, critical, bonus: attackerWon ? 0 : critical ? 2 : 1 };
}

/* -------------------------------------------- */
/*  Undermine                                    */
/* -------------------------------------------- */

/** The Undermine record a successful Taunt puts on its target, or null without the feat or a penalty. */
export function underminePlan(taunter, acting) {
  if (!taunter?.activeFeatNames?.includes("Undermine")) return null;
  const rounds = (taunter.activeFeatSelections ?? []).filter(f => f?.tree === "style").length,
    penalty = Math.max(0, Number(taunter.abilities?.cha?.mod) || 0),
    c = acting.taunt.combat;
  if (rounds < 1) return null;
  return {
    version: 1,
    sourceUuid: acting.actorUuid,
    sourceMessage: acting.messageUuid ?? "",
    combatId: c.id,
    startRound: c.round,
    startTurn: c.turn,
    rounds,
    penalty
  };
}

/** Undermine in force: no action dice, and a morale penalty on Initiative and skill checks. */
export function underminedState(system) {
  const r = system?.undermined,
    c = system?.underminedCombatContext;
  const off = { active: false, penalty: 0 };
  if (!r || r.version !== 1 || !c || c.id !== r.combatId || !Number.isSafeInteger(c.round)) return off;
  const endRound = r.startRound + r.rounds,
    before = c.round < endRound || (c.round === endRound && c.turn < r.startTurn);
  if (c.round < r.startRound || !before) return off;
  return { active: true, penalty: r.penalty, endRound, sourceUuid: r.sourceUuid };
}

export const underminedSpendBlock = system =>
  underminedState(system).active ? loc`Undermined: this character cannot spend action dice (p.205).` : "";

/* -------------------------------------------- */
/*  The winning opponent's next-attack bonus     */
/* -------------------------------------------- */

/** An unused Taunt bonus this character holds against the target in this combat. `posted` are message flags. */
export function tauntAttackBonus(system, { actorUuid, targetUuid, combatId, posted = [] } = {}) {
  if (!targetUuid || !combatId) return null;
  const used = new Set(
    posted
      .filter(c => c?.actorUuid === actorUuid && c.checkKind === "attack" && !c.superseded)
      .map(c => c.attackContext?.tauntBonus?.sourceMessage)
      .filter(Boolean)
  );
  const row = (system?.tauntBonuses ?? []).find(
    r => r?.targetUuid === targetUuid && r.combatId === combatId && !used.has(r.sourceMessage)
  );
  return row ? { version: 1, sourceMessage: row.sourceMessage, targetUuid, bonus: row.bonus } : null;
}

/* -------------------------------------------- */
/*  Pipeline                                     */
/* -------------------------------------------- */

rollPipeline.register({
  id: "taunt",
  order: 1575,
  record: ["taunt"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey }) =>
    validateTauntProof(actor.system, options.taunt, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      combat: actor.mentalLeapCombatContext()
    })
});
rollPipeline.register({
  id: "tauntChecks",
  order: 5055,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => tauntSkillChecks(skillKey, checks)
});
rollPipeline.register({
  id: "tauntSkillTerm",
  kinds: ["skill"],
  order: 9301,
  terms({ system, skillKey, check, method, input }) {
    const plan = tauntCheckPlan(system, skillKey, check, {
      method,
      tauntOpponentUuid: input.tauntOpponentUuid ?? "",
      tauntOpponentName: input.tauntOpponentName ?? "",
      tauntInRangeConfirmed: input.tauntInRangeConfirmed === true,
      tauntIncomingLegalConfirmed: input.tauntIncomingLegalConfirmed === true,
      tauntCombat: input.tauntCombat ?? null
    });
    return skillPlanTerm("taunt", plan, { noteAt: 191, blockAt: 171 });
  }
});
rollPipeline.register({
  id: "tauntAttackTerm",
  kinds: ["attack"],
  order: 9193,
  terms({ system, options }) {
    const combat = options.tauntBonusCombat,
      plan = tauntAttackBonus(system, {
        actorUuid: options.tauntBonusActorUuid,
        targetUuid: options.characterTarget?.actorUuid || options.targetActorUuid || "",
        combatId: combat?.id,
        posted: [...(globalThis.game?.messages ?? [])].map(m => m.flags?.spycraft2).filter(Boolean)
      });
    if (!plan) return null;
    return {
      key: "tauntBonus",
      plan,
      rowAt: 289,
      rows: [[loc`Won a Taunt against this target`, plan.bonus]],
      noteAt: 501,
      notes: [loc`Taunt: +${plan.bonus} on this attack for winning the opposed Taunt; it is now used (p.361).`]
    };
  }
});
