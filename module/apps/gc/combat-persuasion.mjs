import { combatPersuasionAttempt, combatPersuasionResult, persuasionKey } from "../../rules/gc/combat-persuasion.mjs";
import { dispositionToward } from "../../rules/gc/disposition.mjs";
import { rollEvidence } from "../../rules/outcomes.mjs";
import { sameValues } from "../../rules/equal.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { withUndo } from "../undo.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";

const recordPath = combat => `flags.spycraft2.combatPersuasion.${persuasionKey(combat.id)}`;
const recordOf = (npc, combat) => npc.flags?.spycraft2?.combatPersuasion?.[persuasionKey(combat.id)];
const participants = combat => [
  ...new Map([...combat.combatants].filter(c => c.actor).map(c => [c.actor.uuid, c.actor])).values()
];
function context(npc, combat) {
  if (!game.user?.isGM || !npc?.isOwner || npc.type !== "npc") throw Error(loc`The GC manages NPC combat persuasion.`);
  if (!combat?.started || game.combats?.get(combat.id) !== combat) throw Error(loc`Choose a current, started combat.`);
  if (
    npc.system.npcType === "villain" ||
    ["minion", "henchman", "mastermind"].includes(npc.system.manualRole) ||
    npc.system.npcProfile?.qualities?.some(q => ["minion", "henchman", "mastermind"].includes(q.id))
  )
    throw Error(loc`Villains ignore combat disposition effects.`);
}
async function write(npc, combat, next) {
  try {
    await npc.update({ [recordPath(combat)]: next });
  } catch (error) {
    if (!sameValues(recordOf(npc, combat), next)) throw error;
  }
}
export async function reserveCombatPersuasion(
  npc,
  { combat = game.combat, actor, assignments, targetId = actor?.id, confirmed } = {}
) {
  context(npc, combat);
  if (confirmed !== true || !actor?.isOwner || actor.uuid === npc.uuid)
    throw Error(loc`The GC must confirm the acting character, side and disposition target.`);
  return queueResources([npc], async () => {
    context(npc, combat);
    const next = combatPersuasionAttempt(recordOf(npc, combat), {
      combatId: combat.id,
      participants: participants(combat).map(a => a.uuid),
      assignments,
      actorUuid: actor.uuid,
      grade: dispositionToward(npc.system.disposition, targetId),
      targetId,
      id: foundry.utils.randomID()
    });
    await withUndo([npc], loc`Reserve ${actor.name}'s side's attempt to persuade ${npc.name}`, () =>
      write(npc, combat, next)
    );
    return next.attempts[persuasionKey(next.sides.find(row => row.actorUuid === actor.uuid).side)];
  });
}
export async function rollCombatPersuasion(npc, { combat = game.combat, claimId, roll } = {}) {
  const claim = await queueResources([npc], async () => {
    context(npc, combat);
    const current = recordOf(npc, combat),
      entry = Object.values(current?.attempts ?? {}).find(a => a.id === claimId);
    if (!entry || !["reserved", "cancelled"].includes(entry.state) || current.winner)
      throw Error(
        loc`This side's roll is already recorded or interrupted. Recover that check instead of rolling again.`
      );
    if (!participants(combat).some(a => a.uuid === entry.actorUuid && a.isOwner))
      throw Error(loc`The acting character must still participate in this combat.`);
    const next = structuredClone(current),
      claim = next.attempts[persuasionKey(entry.side)];
    claim.state = "rolling";
    await write(npc, combat, next);
    return structuredClone(claim);
  });
  const binding = { id: claim.id, npcUuid: npc.uuid, combatId: combat.id, side: claim.side };
  const message = await roll(fromUuidSync(claim.actorUuid), binding);
  if (!message)
    await queueResources([npc], async () => {
      const current = recordOf(npc, combat),
        entry = current?.attempts?.[persuasionKey(claim.side)];
      if (entry?.id !== claim.id || entry.state !== "rolling") return;
      if ([...game.messages].some(m => m.flags?.spycraft2?.combatPersuasion?.id === claim.id)) return;
      // A known cancellation can reopen the same reservation; an exception keeps its unknown roll held.
      const next = structuredClone(current);
      next.attempts[persuasionKey(claim.side)].state = "cancelled";
      await write(npc, combat, next);
    });
  return message;
}
export async function settleCombatPersuasion(npc, message, { combat = game.combat } = {}) {
  context(npc, combat);
  const check = message?.flags?.spycraft2,
    binding = check?.combatPersuasion;
  if (binding?.npcUuid !== npc.uuid || !message.rolls?.length)
    throw Error(loc`Choose the actual check recorded for this NPC's persuasion attempt.`);
  const actor = fromUuidSync(check.actorUuid),
    record = recordOf(npc, combat),
    claim = record?.attempts?.[persuasionKey(binding.side)];
  const result = combatPersuasionResult(claim, binding, check, { actorUuid: actor?.uuid, combatId: combat.id });
  if (claim.state === "complete") {
    if (claim.messageUuid !== message.uuid || claim.evidence !== rollEvidence(check))
      throw Error(loc`The completed persuasion check changed. Ask the GC to review it.`);
    return claim;
  }
  if (record.winner) throw Error(loc`Another side has already persuaded this NPC to join it.`);
  if (!check.resolved) {
    if (check.successConfirmed == null)
      await actor.confirmCheckOutcome(message, {
        succeeded: result.success,
        ...(result.campaignDC ? { campaignDC: result.campaignDC } : {}),
        ...(result.dc === null ? {} : { difficultyClass: result.dc })
      });
    if (message.flags.spycraft2.successConfirmed !== result.success)
      throw Error(loc`The confirmed result disagrees with the NPC's recorded combat disposition.`);
    await actor.finishCheck(message);
  }
  if (!message.flags.spycraft2.resolved || message.flags.spycraft2.successConfirmed !== result.success)
    throw Error(loc`Finish the persuasion check and resolve its action-die decisions first.`);
  const evidence = rollEvidence(message.flags.spycraft2);
  return queueResources([npc], async () => {
    context(npc, combat);
    const current = recordOf(npc, combat),
      entry = current?.attempts?.[persuasionKey(binding.side)];
    const now = combatPersuasionResult(entry, binding, message.flags.spycraft2, {
      actorUuid: actor.uuid,
      combatId: combat.id
    });
    if (entry.state === "complete") {
      if (entry.messageUuid === message.uuid && entry.evidence === evidence) return entry;
      throw Error(loc`This side's attempt already has a different completed result.`);
    }
    if (current.winner || !sameValues(now, result) || rollEvidence(message.flags.spycraft2) !== evidence)
      throw Error(loc`The persuasion result or winning side changed before settlement.`);
    const next = structuredClone(current),
      completed = next.attempts[persuasionKey(binding.side)];
    Object.assign(completed, {
      state: "complete",
      messageUuid: message.uuid,
      evidence,
      total: message.flags.spycraft2.effectiveTotal,
      success: now.success,
      dc: now.dc
    });
    if (now.success) next.winner = binding.side;
    await withUndo([npc], loc`${npc.name}: ${now.success ? loc`joins` : loc`does not join`} ${binding.side}`, () =>
      write(npc, combat, next)
    );
    return completed;
  });
}

export async function manageCombatPersuasion(npc, { targetId, roll } = {}) {
  const combat = game.combat;
  context(npc, combat);
  const actors = participants(combat).filter(a => a.uuid !== npc.uuid),
    record = recordOf(npc, combat);
  if (!actors.length) throw Error(loc`Add an acting character to the combat first.`);
  const messages = [...game.messages].filter(
    m =>
      m.flags?.spycraft2?.combatPersuasion?.npcUuid === npc.uuid &&
      m.flags.spycraft2.combatPersuasion.combatId === combat.id &&
      !m.flags.spycraft2.superseded
  );
  const input = await systemDialog.input({
    window: { title: loc`${npc.name}: persuade to join combat` },
    rejectClose: false,
    ok: { label: loc`Continue persuasion` },
    content: `<div class="spycraft2-roll-options"><p>${loc`Each side has one attempt. The first success closes further attempts. Confirm the sides and disposition target before rolling.`}</p>${record?.winner ? `<p>${esc(loc`Already persuaded to join ${record.winner}.`)}</p>` : ""}<label>${loc`Action`} <select name="action"><option value="settle"${messages.length ? " selected" : ""}>${loc`Resolve a recorded check`}</option><option value="roll"${messages.length ? "" : " selected"}>${loc`Reserve or continue this side's check`}</option></select></label><label data-when="action=roll">${loc`Acting character`} <select name="actorUuid">${actors.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label>${!record ? `<details open><summary>${loc`Combat sides (GC review)`}</summary>${actors.map((a, i) => `<label>${esc(a.name)} <input name="side_${i}" maxlength="80" required /></label>`).join("")}</details>` : `<ul>${record.sides.map(row => `<li>${esc(fromUuidSync(row.actorUuid)?.name ?? row.actorUuid)}: ${esc(row.side)}</li>`).join("")}</ul>`}<label data-when="action=settle">${loc`Recorded Impress/Persuasion check`} <select name="messageUuid"><option value="">${loc`Choose a check`}</option>${messages.map(m => `<option value="${esc(m.uuid)}">${esc(fromUuidSync(m.flags.spycraft2.actorUuid)?.name ?? "")} — ${esc(m.flags.spycraft2.effectiveTotal)} (${esc(m.flags.spycraft2.combatPersuasion.side)})</option>`).join("")}</select></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms the combat sides, acting character and disposition target`}</label></div>`
  });
  if (!input) return null;
  if (input.confirmed !== true) throw Error(loc`The GC must confirm this combat persuasion action.`);
  if (input.action === "settle") {
    const message = messages.find(m => m.uuid === input.messageUuid);
    if (!message) throw Error(loc`Choose a recorded persuasion check.`);
    const result = await settleCombatPersuasion(npc, message, { combat });
    ui.notifications.info(loc`${npc.name}: ${result.success ? loc`joins` : loc`does not join`} ${result.side}.`);
    return result;
  }
  const actor = actors.find(a => a.uuid === input.actorUuid);
  if (!actor) throw Error(loc`Choose an acting character.`);
  let claim = Object.values(record?.attempts ?? {}).find(
    a => a.actorUuid === actor.uuid && ["reserved", "cancelled"].includes(a.state)
  );
  if (!claim)
    claim = await reserveCombatPersuasion(npc, {
      combat,
      actor,
      targetId: targetId || actor.id,
      confirmed: true,
      assignments: participants(combat).map(a => ({
        actorUuid: a.uuid,
        side: a.uuid === npc.uuid ? "Uncommitted NPC" : input[`side_${actors.findIndex(row => row.uuid === a.uuid)}`]
      }))
    });
  const message = await rollCombatPersuasion(npc, { combat, claimId: claim.id, roll });
  if (message)
    ui.notifications.info(
      loc`Finish boosts and critical decisions, then return to Disposition to resolve this persuasion attempt.`
    );
  return message;
}
