export class SpycraftItem extends Item {
  /** @override */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (userId !== game.user.id || this.parent?.type !== "agent") return;
    if (this.type === "origin") this.parent.syncGrantedFeats();
  }

  /** @override */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    const actor = this.parent;
    if (userId !== game.user.id || actor?.type !== "agent") return;
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
    const content = `<div class="spycraft2 chat-card"><h3>${this.name}</h3>${this.system.description ?? ""}</div>`;
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.parent }), content });
  }
}
