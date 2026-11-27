import { loc } from "../../i18n.mjs";
import { dispositionGrade, persuadeToJoin } from "./disposition.mjs";
import { sameValues } from "../equal.mjs";
import { campaignSkillDCPlan } from "../campaign-skill-dc.mjs";

export const persuasionKey = value => encodeURIComponent(value).replaceAll(".", "%2E");
export function combatPersuasionSides(participants, assignments) {
  const actors = [...new Set(participants)].sort();
  if (!actors.length || !Array.isArray(assignments) || assignments.length !== actors.length)
    throw Error(loc`Record a side for every character in this combat.`);
  const rows = assignments.map(row => ({ actorUuid: row.actorUuid, side: String(row.side ?? "").trim() }));
  if (!sameValues(rows.map(row => row.actorUuid).sort(), actors) || rows.some(row => !row.side || row.side.length > 80))
    throw Error(loc`Each combat character needs one named side, up to 80 characters.`);
  return rows.sort((a, b) => a.actorUuid.localeCompare(b.actorUuid));
}
export function combatPersuasionAttempt(
  record,
  { combatId, participants, assignments, actorUuid, grade, targetId, id }
) {
  const sides = record?.sides ?? combatPersuasionSides(participants, assignments);
  combatPersuasionSides(
    sides.map(row => row.actorUuid),
    sides
  );
  if (record && (record.version !== 1 || record.combatId !== combatId))
    throw Error(loc`The combat persuasion history needs GC review.`);
  if (record?.winner) throw Error(loc`This NPC has already been persuaded to join a side in this combat.`);
  if (!participants.includes(actorUuid)) throw Error(loc`Choose an acting character in this combat.`);
  const side = sides.find(row => row.actorUuid === actorUuid)?.side;
  if (!side) throw Error(loc`The acting character has no recorded side. The GC must review the combat sides.`);
  const key = persuasionKey(side);
  if (record?.attempts?.[key]) throw Error(loc`This side has already used its persuasion attempt in this combat.`);
  if (dispositionGrade(grade).id !== grade) throw Error(loc`Review the NPC's disposition before persuading it.`);
  return {
    version: 1,
    combatId,
    sides,
    attempts: {
      ...(record?.attempts ?? {}),
      [key]: { id, actorUuid, side, grade, targetId, state: "reserved" }
    }
  };
}
export function combatPersuasionResult(claim, binding, check, { actorUuid, combatId }) {
  if (
    !claim ||
    !["rolling", "complete"].includes(claim.state) ||
    binding?.id !== claim.id ||
    binding?.combatId !== combatId ||
    binding?.side !== claim.side ||
    !sameValues(binding, check?.combatPersuasion) ||
    claim.actorUuid !== actorUuid ||
    check?.actorUuid !== actorUuid ||
    check.rollCombat?.id !== combatId ||
    check.checkKind !== "skill" ||
    check.skillKey !== "impress" ||
    check.checkId !== "persuasion" ||
    check.cooperative?.role === "helper" ||
    check.superseded ||
    !Number.isFinite(check.effectiveTotal)
  )
    throw Error(loc`Choose this attempt's actual Impress/Persuasion check from this combat.`);
  const result = persuadeToJoin(claim.grade, check.effectiveTotal, { triumph: check.effectiveTotal >= 75 });
  if (result.dc === null || !check.campaignSkillDCPolicy) return result;
  const campaignDC = campaignSkillDCPlan(check, { baseDC: result.dc, confirmed: true });
  return { ...result, dc: campaignDC.dc, success: campaignDC.succeeded, campaignDC };
}
