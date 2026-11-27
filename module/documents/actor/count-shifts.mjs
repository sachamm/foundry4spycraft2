import { queueResources } from "../../services/transactions.mjs";
import { loc } from "../../i18n.mjs";
import { thresholds } from "../../rules/gc/fluid-initiative.mjs";
import { setConditionStatus } from "../../rules/condition-status.mjs";

export const COUNT_FLAGS = [
  "calledShotCount",
  "gunplayCount",
  "diversionCount",
  "duelingSupremacy",
  "forwardStance",
  "duelingMastery",
  "kickCount",
  "brushCount"
];
export const countClaims = actor => actor.flags?.spycraft2?.countShifts ?? {};
const flags = document => document?.flags?.spycraft2 ?? {};
const combats = () => [...(globalThis.game?.combats ?? [])];
export function countContextFor(actor) {
  const matches = combats()
    .filter(c => c.started)
    .flatMap(c =>
      [...c.combatants]
        .filter(row => row.actor?.uuid === actor?.uuid)
        .map(row => ({ combatUuid: c.uuid, combatantUuid: row.uuid, round: c.round }))
    );
  return matches.length === 1 ? { ...matches[0], triggerId: foundry.utils.randomID() } : null;
}
const keyFor = (message, flag) => {
  if (!message?.id || !/^[A-Za-z0-9_-]+$/.test(message.id) || !COUNT_FLAGS.includes(flag))
    throw Error(loc`Use the original Count-changing trigger and its recorded rule.`);
  const triggerId = flags(message).countContext?.triggerId;
  if (typeof triggerId !== "string" || !/^[A-Za-z0-9_-]+$/.test(triggerId))
    throw Error(loc`Review this older Count trigger's identity with the GC first.`);
  return `${triggerId}-${flag}`;
};
const updateClaim = (actor, key, row) => actor.update({ [`flags.spycraft2.countShifts.${key}`]: row });
function combatantFor(actor, context) {
  const combat = combats().find(c => c.uuid === context?.combatUuid);
  const rows = [...(combat?.combatants ?? [])].filter(c => c.actor?.uuid === actor.uuid);
  const exact = rows.find(c => c.uuid === context.combatantUuid);
  const combatant = exact ?? (rows.length === 1 ? rows[0] : null);
  if (!combat?.started || !combatant?.isOwner || !Number.isFinite(combatant.initiative))
    throw Error(loc`Choose this character's rolled combatant in the original started combat.`);
  return { combat, combatant };
}

export async function recordCountShift(message, actor, amount, flag, label) {
  if (!actor?.isOwner || !Number.isSafeInteger(amount) || !amount)
    throw Error(loc`Own the character and enter a nonzero whole Count modifier.`);
  const key = keyFor(message, flag);
  const originalCombat = combats().find(
    c => c.uuid === (countClaims(actor)[key]?.combatUuid ?? flags(message).countContext?.combatUuid)
  );
  return queueResources(
    [actor],
    async () => {
      let row = structuredClone(countClaims(actor)[key]);
      if (row?.reviewIntent && row.state !== "reviewed")
        throw Error(loc`Finish this Count modifier's recorded GC correction first.`);
      if (!row && flags(message)[flag])
        throw Error(
          loc`This older Count change is already marked. Review its actual initiative history instead of repeating it.`
        );
      const context = row ?? flags(message).countContext;
      if (!context) throw Error(loc`The GC must review which combat and round this older Count trigger belongs to.`);
      const { combat, combatant } = combatantFor(actor, context);
      const settlement = flags(combatant).fluidSettlement;
      if (settlement?.state === "effectsPending")
        throw Error(loc`Finish this combatant's recorded end-of-round conditions from Fluid initiative event first.`);
      if (!row) {
        if (settlement?.round === context.round && settlement.state === "complete")
          throw Error(loc`This trigger's round already settled. Ask the GC to review its actual Count history.`);
        if (combat.round !== context.round)
          throw Error(loc`This Count trigger belongs to an earlier round. Ask the GC to review it.`);
        row = {
          version: 1,
          id: foundry.utils.randomID(),
          sourceUuid: message.uuid,
          triggerId: context.triggerId,
          actorUuid: actor.uuid,
          flag,
          amount,
          label,
          combatUuid: combat.uuid,
          combatantUuid: combatant.uuid,
          round: combat.round,
          state: "reserved"
        };
        await updateClaim(actor, key, row);
      }
      if (
        row.triggerId !== flags(message).countContext?.triggerId ||
        row.actorUuid !== actor.uuid ||
        row.amount !== amount ||
        row.flag !== flag
      )
        throw Error(loc`The original Count modifier changed. Review its durable receipt.`);
      const receipt = flags(combatant).countEvents?.[row.id];
      if (receipt) {
        if (receipt.key !== key || receipt.amount !== amount || receipt.round !== row.round)
          throw Error(loc`The combatant's Count receipt changed. Ask the GC to review it.`);
        row.state = receipt.state;
      } else {
        if (row.state !== "reserved" || combat.round !== row.round)
          throw Error(loc`Review the interrupted Count modifier; do not move it into a later round automatically.`);
        const saved = flags(combatant).fluid;
        if (saved?.round !== undefined && saved.round !== null && saved.round !== row.round && saved.modifiers?.length)
          throw Error(loc`Settle this combatant's earlier fluid-initiative modifiers first.`);
        const fluid =
          saved?.round === row.round
            ? structuredClone(saved)
            : { round: row.round, modifiers: [], delayed: 0, pressed: false };
        if (fluid.modifiers.some(m => m.eventId === row.id))
          throw Error(loc`This Count modifier lacks its matching delivery receipt. Ask the GC to review it.`);
        fluid.modifiers.push({
          id: flag,
          eventId: row.id,
          label,
          amount,
          uncapped: false,
          immediate: false,
          oncePerRound: false
        });
        await combatant.update({
          "flags.spycraft2.fluid": fluid,
          [`flags.spycraft2.countEvents.${row.id}`]: { key, amount, round: row.round, state: "recorded" }
        });
        row.state = "recorded";
      }
      await updateClaim(actor, key, row);
      await message.update({
        [`flags.spycraft2.${flag}`]: {
          amount,
          combatantId: combatant.id,
          actorUuid: actor.uuid,
          receiptKey: key,
          eventId: row.id,
          round: row.round,
          pending: row.state === "recorded"
        }
      });
      return { key, row, combatant };
    },
    { messages: [message, originalCombat].filter(Boolean) }
  );
}

export async function undoCountShift(actor, key) {
  if (!game.user?.isGM || !actor?.isOwner) throw Error(loc`The GC reviews a recorded Count modifier.`);
  return queueResources([actor], async () => {
    const row = countClaims(actor)[key];
    if (!row || row.actorUuid !== actor.uuid)
      throw Error(loc`The original Count receipt is unavailable for this character.`);
    const { combat, combatant } = combatantFor(actor, row);
    const receipt = flags(combatant).countEvents?.[row.id];
    if (receipt?.state === "undone") {
      await updateClaim(actor, key, { ...row, state: "undone" });
      return row;
    }
    const fluid = structuredClone(flags(combatant).fluid);
    if (receipt?.state !== "recorded" || combat.round !== row.round || fluid?.round !== row.round)
      throw Error(
        loc`This modifier is no longer pending in its original round. Review the current Count and later actions with the GC.`
      );
    await combatant.update({
      "flags.spycraft2.fluid": { ...fluid, modifiers: fluid.modifiers.filter(m => m.eventId !== row.id) },
      [`flags.spycraft2.countEvents.${row.id}.state`]: "undone"
    });
    await updateClaim(actor, key, { ...row, state: "undone" });
    return row;
  });
}

/** Included in the same Combatant update that settles the round's Count. */
export function settledCountEvents(combatant, round) {
  return Object.fromEntries(
    Object.entries(flags(combatant).countEvents ?? {})
      .filter(([, r]) => r.round === round && r.state === "recorded")
      .map(([id]) => [`flags.spycraft2.countEvents.${id}.state`, "settled"])
  );
}

export async function reviewCountShift(actor, key, { note, correct = false, currentCount = null } = {}) {
  if (!game.user?.isGM || !actor?.isOwner || typeof correct !== "boolean" || typeof note !== "string" || !note.trim())
    throw Error(loc`The GC must record the actual Count history and any later actions before correcting it.`);
  const original = countClaims(actor)[key];
  if (!original || original.actorUuid !== actor.uuid)
    throw Error(loc`The original Count receipt is unavailable for this character.`);
  const parent = combats().find(c => c.uuid === original.combatUuid);
  return queueResources(
    [actor],
    async () => {
      let row = structuredClone(countClaims(actor)[key]);
      const combat = combats().find(c => c.uuid === row.combatUuid);
      const combatant = [...(combat?.combatants ?? [])].find(c => c.uuid === row.combatantUuid);
      if (correct && (!combat?.started || !combatant?.isOwner || !Number.isSafeInteger(currentCount)))
        throw Error(loc`Enter the reviewed whole Count for the original combatant in its started combat.`);
      const decision = { correct, currentCount: correct ? currentCount : null, note: note.trim() };
      if (row.state === "reviewed") {
        if (JSON.stringify(row.reviewIntent?.decision) !== JSON.stringify(decision))
          throw Error(loc`This trigger's Count review is complete. Review later initiative changes separately.`);
        return row;
      }
      if (row.reviewIntent && JSON.stringify(row.reviewIntent.decision) !== JSON.stringify(decision))
        throw Error(loc`Finish the recorded Count correction before preparing a different one.`);
      if (!row.reviewIntent) {
        row.reviewIntent = {
          id: foundry.utils.randomID(),
          decision,
          before: combatant?.initiative ?? null,
          result: correct ? thresholds(currentCount) : null
        };
        row.state = "reviewPending";
        await updateClaim(actor, key, row);
      }
      const intent = row.reviewIntent,
        applied = flags(combatant).countEvents?.[row.id];
      if (combatant && applied?.reviewId !== intent.id) {
        if (combatant.initiative !== intent.before)
          throw Error(loc`The Count changed during this correction. Review later actions before continuing.`);
        const fluid = flags(combatant).fluid;
        await combatant.update({
          ...(correct ? { initiative: intent.result.count, "flags.spycraft2.mustPress": intent.result.mustPress } : {}),
          ...(fluid
            ? { "flags.spycraft2.fluid": { ...fluid, modifiers: fluid.modifiers.filter(m => m.eventId !== row.id) } }
            : {}),
          [`flags.spycraft2.countEvents.${row.id}`]: {
            key,
            amount: row.amount,
            round: row.round,
            state: "reviewed",
            reviewId: intent.id
          }
        });
      }
      if (intent.result?.reeling) {
        await setConditionStatus(actor, "reeling", true, { label: loc`Reeling`, operationId: `${intent.id}-reeling` });
        await setConditionStatus(actor, "flat-footed", true, {
          label: loc`Flat-footed`,
          operationId: `${intent.id}-flat-footed`
        });
      }
      await updateClaim(actor, key, { ...row, state: "reviewed" });
      return row;
    },
    { messages: [parent].filter(Boolean) }
  );
}
