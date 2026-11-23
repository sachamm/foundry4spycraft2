/**
 * Finding chat messages by what the system recorded on them. Workflows post a card carrying a receipt, and after
 * a failure look for that card to learn whether the post went through; these are the shared forms of that search.
 */

/**
 * The first message in the log that an actor posted with a given receipt: `flags.spycraft2[key].id === id`.
 * @param {{uuid: string}} actor
 * @param {string} key  The record's name in the message's spycraft2 flags, such as "finalAttack"
 * @param {string} id   The receipt id
 */
export function postedReceipt(actor, key, id) {
  const messages = globalThis.game?.messages;
  const carries = message => {
    const flags = message.flags?.spycraft2;
    return flags?.actorUuid === actor.uuid && flags[key]?.id === id;
  };
  // Foundry's collection searches itself without being copied into an array first.
  return typeof messages?.find === "function" ? messages.find(carries) : [...(messages ?? [])].find(carries);
}
