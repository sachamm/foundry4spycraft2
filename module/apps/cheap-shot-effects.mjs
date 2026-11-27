import { unarmedWeapon } from "../rules/kick.mjs";
import {
  cheapShotApplyPlan,
  cheapShotRecords,
  cheapShotRecoveryPlan,
  validateCheapShotRecoveryProof
} from "../rules/cheap-shot-effects.mjs";
import { queueResources } from "../services/transactions.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { loc } from "../i18n.mjs";
import { withUndo } from "./undo.mjs";
const now = () => game.time.worldTime;
/** The settlement, with one Undo note for both characters; Undo also clears the card's settled mark. */
export function settleCheapShot(actor, message) {
  const actors = [
    actor,
    globalThis.fromUuidSync?.(message?.flags?.spycraft2?.attackContext?.cheapShot?.targetUuid ?? "")
  ].filter(Boolean);
  return withUndo(actors, loc`Cheap Shot: ${actor.name}`, () => settleCheapShotWork(actor, message), {
    cardMarks: [{ messageId: message?.id, key: "cheapShotSettlement" }]
  });
}
async function settleCheapShotWork(actor, message) {
  const original = message?.flags?.spycraft2,
    p = original?.attackContext?.cheapShot;
  if (!actor.isOwner || original?.actorUuid !== actor.uuid || !p?.active)
    throw Error(loc`Choose your recorded Cheap Shot.`);
  const target = original.successConfirmed === false ? null : await fromUuid(p.targetUuid);
  if (original.successConfirmed !== false && !target?.isOwner)
    throw Error(loc`The GC or an owner of the target must apply this Cheap Shot.`);
  return queueResources(
    [actor, target],
    async () => {
      const c = message.flags.spycraft2,
        proof = rollEvidence(c);
      if (
        c.superseded ||
        c.resolved !== true ||
        typeof c.successConfirmed !== "boolean" ||
        !c.attackContext?.cheapShot?.active
      )
        throw Error(loc`Confirm and resolve the attack outcome first.`);
      if (c.cheapShotSettlement) return c.cheapShotSettlement;
      let settlement;
      if (c.successConfirmed) {
        const plan = cheapShotApplyPlan({ ...target.system, usagePeriods: target.usagePeriods }, c, {
          sourceMessage: message.uuid,
          now: now(),
          scene: String(actor.usagePeriods.scene ?? "initial"),
          doubled:
            actor.system.activeFeatNames?.includes("Submission Basics") === true &&
            unarmedWeapon({ proficiency: c.weaponProficiency, qualities: c.weaponQualities }),
          supremacy: actor.system.activeFeatNames?.includes("Submission Supremacy") === true
        });
        if (!plan.existing)
          await target.update({ "system.cheapShots": [...(target.system.cheapShots ?? []), plan.record] });
        settlement = {
          version: 1,
          kind: "hit",
          targetUuid: target.uuid,
          sourceMessage: message.uuid,
          choice: p.choice
        };
      } else {
        await setConditionStatus(actor, "flat-footed", true, {
          label: loc`Flat-footed`,
          aliases: ["flatFooted"],
          operationId: message.uuid
        });
        settlement = { version: 1, kind: "miss", flatFooted: true };
      }
      if (rollEvidence(message.flags.spycraft2) !== proof)
        throw Error(loc`Cheap Shot outcome changed during settlement; review the recorded target state.`);
      await message.update({ "flags.spycraft2.cheapShotSettlement": settlement });
      return settlement;
    },
    { messages: [message] }
  );
}
export async function rollCheapShotRecovery(actor, sourceMessage) {
  if (!actor.isOwner) throw Error(loc`Only an owner may roll this recovery save.`);
  return queueResources([actor], async () => {
    const system = { ...actor.system, usagePeriods: actor.usagePeriods },
      p = cheapShotRecoveryPlan(system, { sourceMessage, now: now() }),
      attemptId = foundry.utils.randomID(),
      rows = structuredClone(actor.system.cheapShots),
      r = rows.find(r => r.sourceMessage === sourceMessage);
    Object.assign(r, { lastSaveAt: p.at, attemptId, attemptResolved: false });
    await actor.update({ "system.cheapShots": rows });
    // Reserve before RNG. A failed roll/post leaves the attempt consumed and auditable.
    const validate = () => {
      const live = cheapShotRecords({ ...actor.system, usagePeriods: actor.usagePeriods }).find(
        r => r.sourceMessage === sourceMessage
      );
      if (!live || live.recovered || live.attemptId !== attemptId || live.lastSaveAt !== p.at)
        throw Error(loc`The Cheap Shot recovery attempt or scene changed.`);
    };
    return actor.rollSave("fort", { cheapShotRecovery: { ...p, attemptId }, validateCheapShotRecovery: validate });
  });
}
export async function settleCheapShotRecovery(actor, message) {
  return queueResources(
    [actor],
    async () => {
      const c = message?.flags?.spycraft2,
        p = c?.cheapShotRecovery;
      if (
        !actor.isOwner ||
        c?.actorUuid !== actor.uuid ||
        c.checkKind !== "save" ||
        c.checkId !== "fort" ||
        !p ||
        c.superseded ||
        c.resolved !== true ||
        typeof c.successConfirmed !== "boolean" ||
        c.successConfirmed !== c.effectiveTotal >= p.dc
      )
        throw Error(loc`Resolve the recorded Fortitude save against its Cheap Shot DC first, including any boosts.`);
      validateCheapShotRecoveryProof(actor, p, {
        checkKind: c.checkKind,
        checkId: c.checkId,
        checkMethod: c.checkMethod ?? "roll",
        allowRecovered: true
      });
      const rows = structuredClone(actor.system.cheapShots ?? []),
        r = cheapShotRecords({ ...actor.system, usagePeriods: actor.usagePeriods }).find(
          r => r.sourceMessage === p.sourceMessage
        );
      if (!r || r.attemptId !== p.attemptId || r.lastSaveAt !== p.at || r.scene !== p.scene)
        throw Error(loc`This recovery save no longer matches the current Cheap Shot attempt.`);
      if (c.cheapShotRecoverySettled) return c.cheapShotRecoverySettled;
      const entry = rows.find(x => x.sourceMessage === p.sourceMessage);
      entry.attemptResolved = true;
      if (c.successConfirmed) {
        entry.recovered = true;
        entry.recoveryMessage = message.uuid;
      }
      await actor.update({ "system.cheapShots": rows });
      const settlement = { version: 1, recovered: c.successConfirmed };
      await message.update({ "flags.spycraft2.cheapShotRecoverySettled": settlement });
      return settlement;
    },
    { messages: [message] }
  );
}
export async function manageCheapShots(actor) {
  if (!actor.isOwner) return null;
  const esc = foundry.utils.escapeHTML,
    ms = [...game.messages].filter(
      m =>
        m.visible !== false &&
        m.isContentVisible !== false &&
        (!m.blind || game.user.isGM) &&
        m.flags?.spycraft2?.actorUuid === actor.uuid
    ),
    pending = ms.filter(
      m =>
        m.flags.spycraft2.attackContext?.cheapShot?.active &&
        !m.flags.spycraft2.cheapShotSettlement &&
        m.flags.spycraft2.resolved &&
        !m.flags.spycraft2.superseded
    ),
    saves = ms.filter(
      m =>
        m.flags.spycraft2.cheapShotRecovery &&
        !m.flags.spycraft2.cheapShotRecoverySettled &&
        m.flags.spycraft2.resolved &&
        !m.flags.spycraft2.superseded
    ),
    effects = cheapShotRecords({ ...actor.system, usagePeriods: actor.usagePeriods }).filter(r => !r.recovered);
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Cheap Shot outcomes and recovery` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`First confirm and resolve the attack or Fortitude save in chat. Apply a hit to the recorded target, or flat-footed to the attacker on a miss. Recovery saves are available once per minute starting immediately at DC 20; finish boosting and resolve the save before applying its result. Recovery does not restore scene eligibility.`}</p><label>${loc`Operation`} <select name="operation"><option value="">${loc`Choose…`}</option>${pending.map(m => `<option value="apply|${esc(m.uuid)}">${loc`Apply resolved Cheap Shot: ${esc(m.flags.spycraft2.attackContext.cheapShot.targetName)}`}</option>`).join("")}${effects.map(r => `<option value="save|${esc(r.sourceMessage)}">${loc`Roll recovery: ${esc(r.choice)}`}</option>`).join("")}${
      game.user.isGM
        ? effects
            .filter(r => r.attemptId && r.attemptResolved !== true)
            .map(
              r =>
                `<option value="review|${esc(r.sourceMessage)}">${loc`GC review interrupted recovery: ${esc(r.choice)}`}</option>`
            )
            .join("")
        : ""
    }${saves.map(m => `<option value="settle|${esc(m.uuid)}">${loc`Apply resolved recovery DC ${esc(m.flags.spycraft2.cheapShotRecovery.dc)}`}</option>`).join("")}</select></label></div>`
  });
  if (!input?.operation) return null;
  const [kind, id] = input.operation.split("|");
  if (kind === "apply") return settleCheapShot(actor, await fromUuid(id));
  if (kind === "save") return rollCheapShotRecovery(actor, id);
  if (kind === "settle") return settleCheapShotRecovery(actor, await fromUuid(id));
  if (kind === "review") return reviewCheapShotRecovery(actor, id);
  throw Error(loc`Choose a listed Cheap Shot operation.`);
}
export async function reviewCheapShotRecovery(actor, sourceMessage, options = {}) {
  if (!actor.isOwner || game.user.isGM !== true)
    throw Error(loc`The GC reviews interrupted Cheap Shot recovery attempts.`);
  let input = options;
  if (input.confirmed !== true) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review interrupted Cheap Shot recovery` },
      rejectClose: false,
      content: `<p>${loc`If a save was posted, finish and apply that existing receipt. If no receipt exists, this review closes the reserved attempt while retaining the minute as spent. It never authorizes another roll during the same minute.`}</p><label><input name="confirmed" type="checkbox" /> ${loc`I reviewed the actual posted saves and reserved attempt`}</label>`
    });
    if (input?.confirmed !== true) return null;
  }
  return queueResources([actor], async () => {
    const rows = structuredClone(actor.system.cheapShots ?? []),
      r = cheapShotRecords({ ...actor.system, usagePeriods: actor.usagePeriods }).find(
        r => r.sourceMessage === sourceMessage
      );
    if (!r || r.recovered || !r.attemptId || r.attemptResolved === true)
      throw Error(loc`Choose a currently interrupted recovery attempt.`);
    const receipt = [...(game.messages ?? [])].find(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.checkKind === "save" &&
        m.flags.spycraft2.checkId === "fort" &&
        m.flags.spycraft2.cheapShotRecovery?.attemptId === r.attemptId &&
        m.flags.spycraft2.cheapShotRecovery.sourceMessage === sourceMessage &&
        !m.flags.spycraft2.superseded
    );
    if (receipt) {
      ui.notifications.info(
        loc`A posted Fortitude save already exists. Finish and apply that recorded save; no new attempt was created.`
      );
      return { existingMessage: receipt.uuid };
    }
    const entry = rows.find(x => x.sourceMessage === sourceMessage);
    entry.attemptResolved = true;
    entry.attemptReview = { at: now(), by: game.user.id, resolution: loc`No posted receipt; reserved minute retained` };
    await actor.update({ "system.cheapShots": rows });
    return { reviewed: true, lastSaveAt: r.lastSaveAt };
  });
}
