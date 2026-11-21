import {
  queueResourceScope,
  RULE_RESOURCE_LOCK_ID,
  nativeResourceTransactionsEnabled,
  refreshResourceActor,
  refreshRuleStateMessage
} from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
const queues = new Map();
/** A short, independent actor rule-state lock. Never call base resource queues inside it. */
export function queueRuleState(actor, work, { messages = [] } = {}) {
  if (nativeResourceTransactionsEnabled())
    return queueResourceScope(actor, RULE_RESOURCE_LOCK_ID, async () => {
      await refreshResourceActor(actor);
      for (const message of new Set(messages)) await refreshRuleStateMessage(actor, message);
      return work();
    });
  const previous = queues.get(actor.uuid) ?? Promise.resolve(),
    pending = previous
      .catch(() => {})
      .then(() => {
        if (!actor.isOwner) throw Error(loc`Only an owner may change this character’s rule state.`);
        return work();
      });
  queues.set(
    actor.uuid,
    pending.catch(() => {})
  );
  return pending;
}
