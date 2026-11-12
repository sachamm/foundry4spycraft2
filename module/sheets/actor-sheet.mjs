const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SpycraftActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor"],
    position: { width: 640, height: 720 },
    form: { submitOnChange: true },
    actions: { rollAbility: SpycraftActorSheet.#onRollAbility }
  };

  static PARTS = {
    main: { template: "systems/spycraft2/templates/actor/actor-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.config = CONFIG.SPYCRAFT;
    context.isAgent = this.actor.type === "agent";
    return context;
  }

  static async #onRollAbility(event, target) {
    return this.actor.rollAbility(target.dataset.ability);
  }
}
