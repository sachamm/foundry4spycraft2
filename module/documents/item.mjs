/**
 * Identifies this browser session. The same user can be logged in from several clients at once, so comparing user ids
 * is not enough to make sure only the client that made a change follows it up.
 */
const CLIENT_ID = foundry.utils.randomID();

export class SpycraftItem extends Item {
  /** @override */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    options.spycraft2Client = CLIENT_ID;
  }

  /** @override */
  async _preDelete(options, user) {
    if ((await super._preDelete(options, user)) === false) return false;
    options.spycraft2Client = CLIENT_ID;
  }

  /** Did this client start the operation? (_preCreate/_preDelete only run on the originating client.) */
  static #isOrigin(options, userId) {
    return userId === game.user.id && options?.spycraft2Client === CLIENT_ID;
  }

  /** @override */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (!SpycraftItem.#isOrigin(options, userId) || this.parent?.type !== "agent") return;
    if (this.type === "origin") this.parent.syncGrantedFeats();
  }

  /** @override */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    const actor = this.parent;
    if (!SpycraftItem.#isOrigin(options, userId) || actor?.type !== "agent") return;
    if (this.type === "origin") actor.syncGrantedFeats();
    if (this.type === "class") {
      // Deleting a class item removes its levels from the progression.
      const id = this.system.identifier || this.name;
      const progression = actor.system.progression.filter(p => p.classId !== id);
      if (progression.length !== actor.system.progression.length) {
        actor.update({ "system.progression": progression }).then(() => actor.syncGrantedFeats());
      }
    }
  }

  /** Post the item's description to chat. */
  async toChat() {
    const content = `<div class="spycraft2 chat-card"><h3>${foundry.utils.escapeHTML(this.name)}</h3>${this.system.description ?? ""}</div>`;
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.parent }), content });
  }
}
