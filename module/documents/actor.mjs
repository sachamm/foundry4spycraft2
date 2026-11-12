export class SpycraftActor extends Actor {
  /** Roll an ability check. */
  async rollAbility(key) {
    const mod = this.system.abilities[key]?.mod ?? 0;
    const roll = await new Roll("1d20 + @mod", { mod }).evaluate();
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize(CONFIG.SPYCRAFT.abilities[key])
    });
  }
}
