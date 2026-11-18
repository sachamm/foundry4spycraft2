/**
 * Diversion, an Initiative action (p.357): a half action against 1 opponent in mutual line of sight. Bluff (Dex)
 * opposed by Sense Motive (Wis), both with the Vision tag; the action adds +1 to the error range.
 * - Win: the opponent's Initiative Count drops by 1d4+1 (2d4+2 on a winning critical or the opponent's critical failure).
 * - Loss: the character becomes flat-footed; on the opponent's critical success or the character's critical failure
 *   the opponent also gains +2 on their next attack against the character until the end of the following round
 *   (recorded with the Taunt bonuses, limited to that round).
 * Fan Service (p.203): Impress (Cha) may replace Bluff, and a full-action Diversion may target every opponent in range.
 */
import { validOwnCountClock } from "./own-count-duration.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const DIVERSION_PAGE = 357;
const acting = (key, system) =>
  key === "bluff" || (key === "impress" && system?.activeFeatNames?.includes("Fan Service") === true);

export function diversionSkillChecks(key, checks = [], system = null) {
  const role = acting(key, system) ? "attacker" : key === "senseMotive" ? "defender" : null;
  if (!role) return checks;
  const id = role === "attacker" ? "diversion" : "resist-diversion";
  return [
    ...checks.filter(c => c.id !== id),
    {
      id,
      name: role === "attacker" ? "Diversion Action" : "Resist Diversion",
      attributes: [role === "defender" ? "wis" : key === "impress" ? "cha" : "dex"],
      mode: "Active",
      tags: "Vision",
      error: 2,
      time: role === "attacker" ? "1 Half Action" : "Opposed response",
      page: DIVERSION_PAGE,
      synergies: [],
      combatAction: "diversion",
      role
    }
  ];
}

export function diversionCheckPlan(
  system,
  key,
  check,
  {
    method = "roll",
    diversionOpponentUuid = "",
    diversionOpponentName = "",
    diversionSightConfirmed = false,
    diversionIncomingLegalConfirmed = false,
    diversionCombat = null
  } = {}
) {
  const role =
      acting(key, system) && check?.id === "diversion"
        ? "attacker"
        : key === "senseMotive" && check?.id === "resist-diversion"
          ? "defender"
          : null,
    empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (!role) return empty;
  const reject = blockedReason => ({ ...empty, blockedReason });
  if (method !== "roll") return reject(loc`Diversion is opposed; taking 10 or 20 is unavailable (p.91).`);
  if (!diversionOpponentUuid || typeof diversionOpponentName !== "string" || !diversionOpponentName.trim())
    return reject(loc`Choose the opposing character.`);
  if (
    !validOwnCountClock(diversionCombat) ||
    (role === "attacker" && diversionCombat.turn !== diversionCombat.ownTurnIndex)
  )
    return reject(
      role === "attacker"
        ? loc`Take the Diversion during your Initiative Count in a started combat.`
        : loc`Resist a Diversion in a started combat.`
    );
  if (role === "attacker" && diversionSightConfirmed !== true)
    return reject(loc`Confirm with the GC that you and the opponent can see each other.`);
  if (role === "defender" && diversionIncomingLegalConfirmed !== true)
    return reject(loc`The GC must confirm this answers a legal incoming Diversion.`);
  const evidence = {
    version: 1,
    source: "Diversion",
    skillKey: key,
    checkId: check.id,
    role,
    opponentUuid: diversionOpponentUuid,
    opponentName: diversionOpponentName.trim(),
    combat: structuredClone(diversionCombat),
    ...(role === "attacker" ? { sightConfirmed: true } : { incomingLegalConfirmed: true })
  };
  return {
    ...empty,
    evidence,
    notes: [
      role === "attacker"
        ? loc`Diversion: ${key === "impress" ? loc`Impress (Cha) through Fan Service` : loc`Bluff (Dex)`} against ${evidence.opponentName}’s Sense Motive (Wis); Vision; error +1; a half action${key === "impress" ? loc`, or a full action against every opponent in range, each resisting separately` : ""}. Settle it from this card (p.357).`
        : loc`Resist Diversion: Sense Motive (Wis) against ${evidence.opponentName}; Vision; error +1 (p.357).`
    ]
  };
}

export function validateDiversionProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", combat } = {}
) {
  if (!proof) return;
  const p = diversionCheckPlan(
    system,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      diversionOpponentUuid: proof.opponentUuid,
      diversionOpponentName: proof.opponentName,
      diversionSightConfirmed: proof.sightConfirmed === true,
      diversionIncomingLegalConfirmed: proof.incomingLegalConfirmed === true,
      diversionCombat: combat
    }
  );
  if (checkKind !== "skill" || !p.evidence || JSON.stringify(p.evidence) !== JSON.stringify(proof))
    throw new Error(p.blockedReason || loc`The Diversion participants or Initiative Count changed before posting.`);
}

/** Who won; mirrors the Taunt outcome on the `diversion` evidence. */
export function diversionOutcome(acting, defending = null, { declared = "", tieWinner = "" } = {}) {
  if (acting?.diversion?.role !== "attacker" || acting.resolved !== true || acting.superseded)
    throw new Error(loc`Resolve the Diversion check in chat first.`);
  let attackerWon, critical;
  if (defending) {
    const q = defending.diversion;
    if (
      q?.role !== "defender" ||
      defending.resolved !== true ||
      defending.superseded ||
      defending.actorUuid !== acting.diversion.opponentUuid ||
      q.opponentUuid !== acting.actorUuid
    )
      throw new Error(loc`Pair the Diversion with the opponent’s resolved Resist Diversion check.`);
    const a = acting.effectiveTotal,
      d = defending.effectiveTotal;
    if (a === d && !["attacker", "defender"].includes(tieWinner))
      throw new Error(loc`The results are tied: break the tie (p.91) and name the winner.`);
    attackerWon = a > d || (a === d && tieWinner === "attacker");
    critical = attackerWon
      ? acting.criticalSuccess === true || defending.criticalFailure === true
      : defending.criticalSuccess === true || acting.criticalFailure === true;
  } else {
    if (!["won", "wonCritical", "lost", "lostCritical"].includes(declared))
      throw new Error(loc`Choose how the opposed Diversion ended.`);
    attackerWon = declared.startsWith("won");
    critical = declared.endsWith("Critical");
  }
  return { attackerWon, critical, countLoss: attackerWon ? (critical ? "2d4+2" : "1d4+1") : null };
}

rollPipeline.register({
  id: "diversion",
  order: 1576,
  record: ["diversion"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey }) =>
    validateDiversionProof(actor.system, options.diversion, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      combat: actor.mentalLeapCombatContext()
    })
});
rollPipeline.register({
  id: "diversionChecks",
  order: 5056,
  kinds: ["skill"],
  skillChecks: ({ skillKey, actor }, checks) => diversionSkillChecks(skillKey, checks, actor?.system)
});
rollPipeline.register({
  id: "diversionSkillTerm",
  kinds: ["skill"],
  order: 9302,
  terms({ system, skillKey, check, method, input }) {
    const plan = diversionCheckPlan(system, skillKey, check, {
      method,
      diversionOpponentUuid: input.diversionOpponentUuid ?? "",
      diversionOpponentName: input.diversionOpponentName ?? "",
      diversionSightConfirmed: input.diversionSightConfirmed === true,
      diversionIncomingLegalConfirmed: input.diversionIncomingLegalConfirmed === true,
      diversionCombat: input.diversionCombat ?? null
    });
    return skillPlanTerm("diversion", plan, { noteAt: 192, blockAt: 172 });
  }
});
