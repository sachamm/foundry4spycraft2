import {VEHICLE_RULES} from '../rules/tables.mjs';
import {VEHICLE_DAMAGE_COUNTERS} from '../rules/vehicles.mjs';
import {loadVehicleStats, repairVehicle, rollObjectDamageSave, rollTyreSave, rollVehicleDamageResult} from '../apps/vehicle-play.mjs';

const {HandlebarsApplicationMixin} = foundry.applications.api;
const {ActorSheetV2} = foundry.applications.sheets;

const COUNTER_LABELS = {
  controls: 'Controls', engine: 'Engine', flotation: 'Flotation', fuelHours: 'Fuel lost (hours)', lift: 'Lift', traction: 'Punctured tyres'
};

/** Sheet for a vehicle placed on a scene: its table statistics, current condition and damage rolls. */
export class SpycraftVehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['spycraft2', 'sheet', 'actor', 'vehicle'],
    position: {width: 640, height: 720},
    window: {resizable: true},
    form: {submitOnChange: true},
    actions: {
      damageSave() { return rollObjectDamageSave(this.actor); },
      vehicleDamage() { return rollVehicleDamageResult(this.actor); },
      tyreSave() { return rollTyreSave(this.actor); },
      async repair() {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: {title: `${this.actor.name}: repairs`},
          content: '<p>Clear every failed Damage save and Vehicle Damage result recorded on this vehicle?</p>',
          rejectClose: false
        });
        return confirmed ? repairVehicle(this.actor) : null;
      },
      clearDriver() { return this.actor.update({'system.driver': ''}); },
      openSource: SpycraftVehicleSheet.#onOpenSource
    }
  };

  static PARTS = {main: {template: 'systems/spycraft2/templates/actor/vehicle-sheet.hbs', scrollable: ['']}};

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor, system = actor.system;
    Object.assign(context, {
      actor, system, editable: this.isEditable,
      classOptions: {'': '—', ...Object.fromEntries(VEHICLE_RULES.classes.map(c => [c.code, c.label]))},
      calibers: CONFIG.SPYCRAFT.calibers,
      counters: VEHICLE_DAMAGE_COUNTERS.map(key => ({key, label: COUNTER_LABELS[key], value: system.damage?.[key] ?? 0})),
      control: system.classInfo ? {
        skill: system.classInfo.skill, focus: system.classInfo.focus, untrainedPenalty: system.classInfo.untrainedPenalty
      } : null,
      enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.biography, {secrets: actor.isOwner})
    });
    return context;
  }

  /** A vehicle pick dropped here supplies the statistics. */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;
    if (item.type === 'vehicle') return loadVehicleStats(this.actor, item);
    return super._onDropItem(event, item);
  }

  /** A character dropped here takes the controls. */
  async _onDropActor(event, actor) {
    if (!this.actor.isOwner || !actor?.uuid || actor.type === 'vehicle') return null;
    return this.actor.update({'system.driver': actor.uuid});
  }

  static async #onOpenSource() {
    const item = this.actor.system.sourceItem ? await fromUuid(this.actor.system.sourceItem) : null;
    if (!item) return ui.notifications.warn('The gear pick this vehicle came from is no longer available.');
    return item.sheet.render(true);
  }
}
