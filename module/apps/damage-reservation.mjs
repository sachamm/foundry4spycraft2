/**
 * A damage roll that an attack earned once: reserve the use on the actor, run the roll, then either record its
 * chat card as the receipt or remove the reservation. Attack damage bonuses and Side Stance damage keep their
 * uses in different actor fields under different message flags and say different things when refused, and are
 * otherwise the same workflow.
 */
import { queueRuleState } from "./rule-resource-scope.mjs";

const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);

/**
 * @param {object} spec
 * @param {string} spec.field               Actor field holding the use rows, such as "system.attackDamageUses"
 * @param {string} spec.flag                The record's name in the damage card's spycraft2 flags
 * @param {(system: object) => object[]} spec.rows       The current rows, validated
 * @param {(actor: Actor, proof: object) => void} spec.validateSource  Throws if the proof no longer holds
 * @param {WeakMap} spec.leases             The caller's lease registry
 * @param {Map} spec.active                 The caller's registry of reservations in progress
 * @param {() => {taken: string, changed: string, review: string}} spec.messages  Refusal texts
 * @returns {(actor: Actor, proof: object, perform: (lease: object) => Promise<*>) => Promise<*>}
 */
export function reservedDamageUse({ field, flag, rows: readRows, validateSource, leases, active, messages }) {
  return async function withReservedDamage(actor, proof, perform) {
    const lease = {};
    await queueRuleState(actor, async () => {
      validateSource(actor, proof);
      const rows = readRows(actor.system);
      if (rows.some(r => r.rootAttackUuid === proof.rootAttackUuid)) throw Error(messages().taken);
      await actor.update({
        [field]: [
          ...rows,
          {
            version: 1,
            rootAttackUuid: proof.rootAttackUuid,
            attackUuid: proof.attackUuid,
            reservationId: proof.reservationId,
            targetUuid: proof.targetUuid,
            weaponUuid: proof.weaponUuid,
            sourceEvidence: proof.sourceEvidence,
            receiptUuid: null
          }
        ]
      });
    });
    leases.set(lease, { actor, reservationId: proof.reservationId });
    active.set(actor.uuid + ":" + proof.reservationId, lease);
    const posted = () =>
        values(game.messages).find(
          m =>
            m.flags?.spycraft2?.actorUuid === actor.uuid &&
            m.flags.spycraft2.checkKind === "damage" &&
            m.flags.spycraft2[flag]?.reservationId === proof.reservationId
        ),
      settle = receipt =>
        queueRuleState(actor, async () => {
          const rows = readRows(actor.system),
            use = rows.find(r => r.rootAttackUuid === proof.rootAttackUuid);
          if (use?.reservationId !== proof.reservationId) throw Error(messages().changed);
          await actor.update({
            [field]: receipt
              ? rows.map(r => (r.rootAttackUuid === proof.rootAttackUuid ? { ...r, receiptUuid: receipt.uuid } : r))
              : rows.filter(r => r.reservationId !== proof.reservationId)
          });
        });
    try {
      const result = await perform(lease),
        receipt =
          result?.flags?.spycraft2?.[flag]?.reservationId === proof.reservationId && result.uuid ? result : posted();
      await settle(receipt);
      return receipt ?? result;
    } catch (error) {
      const receipt = posted();
      try {
        await settle(receipt);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], messages().review);
      }
      if (receipt) return receipt;
      throw error;
    } finally {
      leases.delete(lease);
      active.delete(actor.uuid + ":" + proof.reservationId);
    }
  };
}
