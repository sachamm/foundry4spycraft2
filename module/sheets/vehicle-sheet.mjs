import { VEHICLE_RULES } from "../rules/tables.mjs";
import { VEHICLE_DAMAGE_COUNTERS } from "../rules/vehicles.mjs";
import {
  bailOutOf,
  boardVehicle,
  fireMountedWeapon,
  leaveVehicle,
  loadVehicleStats,
  refuel,
  repairVehicle,
  rollControlCheck,
  rollFuelExplosion,
  rollObjectDamageSave,
  rollTyreSave,
  rollVehicleDamageResult,
  setOccupantRole,
  skeletonCrewFor,
  spendFuel
} from "../apps/vehicle-play.mjs";
import { HAZARD_GROUPS, hazardOptions } from "../rules/vehicle-environment.mjs";
import { hasQuality, parseQualities } from "../rules/vehicle-play-rules.mjs";
import { getMission, teamActors } from "../apps/gc/state.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const COUNTER_LABELS = {
  controls: "Controls",
  engine: "Engine",
  flotation: "Flotation",
  fuelHours: "Fuel lost (hours)",
  lift: "Lift",
  traction: "Punctured tyres"
};
const hours = n => (Math.round(n * 10) / 10).toLocaleString("en-US");
const HAZARD_LABELS = { terrain: "Terrain", surface: "Surface", weather: "Weather", wind: "Wind" };
const SENSOR_LABELS = { radar: "Radar", sonar: "Sonar", thermal: "Thermal" };
const share = ([n, d]) => `${n}/${d}`;

/** Sheet for a vehicle placed on a scene: its table statistics, current condition, people aboard and play actions. */
export class SpycraftVehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "vehicle"],
    position: { width: 680, height: 780 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      damageSave() {
        return rollObjectDamageSave(this.actor);
      },
      vehicleDamage() {
        return rollVehicleDamageResult(this.actor);
      },
      tyreSave() {
        return rollTyreSave(this.actor);
      },
      fuelExplosion() {
        return rollFuelExplosion(this.actor);
      },
      async repair() {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: `${this.actor.name}: repairs` },
          content: "<p>Clear every failed Damage save and Vehicle Damage result recorded on this vehicle?</p>",
          rejectClose: false
        });
        return confirmed ? repairVehicle(this.actor) : null;
      },
      clearDriver() {
        return this.actor.update({ "system.driver": "" });
      },
      clearMount() {
        return this.actor.update({ "system.mountNpc": "" });
      },
      controlCheck() {
        return rollControlCheck(this.actor);
      },
      spendFuel() {
        return spendFuel(this.actor);
      },
      refuel() {
        return refuel(this.actor);
      },
      leave(event, target) {
        return leaveVehicle(this.actor, Number(target.dataset.index));
      },
      toggleRole(event, target) {
        const index = Number(target.dataset.index),
          current = this.actor.system.occupants[index]?.role;
        return setOccupantRole(this.actor, index, current === "crew" ? "passenger" : "crew");
      },
      bailOut(event, target) {
        return bailOutOf(this.actor, target.dataset.uuid);
      },
      fireWeapon(event, target) {
        return fireMountedWeapon(this.actor, target.dataset.itemId);
      },
      removeItem(event, target) {
        return this.actor.items.get(target.dataset.itemId)?.delete();
      },
      openItem(event, target) {
        return this.actor.items.get(target.dataset.itemId)?.sheet.render(true);
      },
      openSource: SpycraftVehicleSheet.#onOpenSource
    }
  };

  static PARTS = { main: { template: "systems/spycraft2/templates/actor/vehicle-sheet.hbs", scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor,
      system = actor.system;
    const team = (() => {
      try {
        return teamActors(getMission()).length;
      } catch {
        return 0;
      }
    })();
    const crew = skeletonCrewFor(actor, team);
    const items = [...actor.items];
    Object.assign(context, {
      actor,
      system,
      editable: this.isEditable,
      classOptions: { "": "—", ...Object.fromEntries(VEHICLE_RULES.classes.map(c => [c.code, c.label])) },
      calibers: CONFIG.SPYCRAFT.calibers,
      acquiredOptions: { "": "—", possession: "Possession", mission: "Mission gear" },
      attackerOptions: {
        "": "— none —",
        ...Object.fromEntries(
          [...game.actors].filter(a => a.type === "vehicle" && a !== actor).map(a => [a.uuid, a.name])
        )
      },
      counters: VEHICLE_DAMAGE_COUNTERS.map(key => ({
        key,
        label: COUNTER_LABELS[key],
        value: system.damage?.[key] ?? 0
      })),
      control: system.classInfo
        ? {
            skill: system.classInfo.skill,
            focus: system.classInfo.focus,
            untrainedPenalty: system.classInfo.untrainedPenalty
          }
        : null,
      skeletonCrew:
        crew === null
          ? null
          : {
              count: crew,
              source:
                system.acquiredAs === "mission"
                  ? `crew ${system.crew ?? 0} − team of ${Math.max(1, team)}`
                  : `crew ${system.crew ?? 0} − 1`
            },
      fuel: system.fuel
        ? { ...system.fuel, remainingLabel: hours(system.fuel.remaining), capacityLabel: hours(system.fuel.capacity) }
        : null,
      upgrades: items
        .filter(i => i.system.sourceTable === "Table 4.28")
        .map(i => ({ id: i.id, name: i.name, cost: system.upgradeList.find(u => u.id === i.id)?.cost ?? 0 })),
      weapons: items
        .filter(i => i.type === "weapon")
        .map(i => ({ id: i.id, name: i.name, damage: i.system.damage, errorThreat: i.system.errorThreat })),
      otherItems: items.filter(i => i.type !== "weapon" && i.system.sourceTable !== "Table 4.28"),
      hazardFields: HAZARD_GROUPS.map(group => ({
        group,
        label: HAZARD_LABELS[group],
        value: system.hazards?.[group] ?? "",
        options: { "": "—", ...Object.fromEntries(hazardOptions(group)) }
      })),
      toleranceChoice: parseQualities(system.qualitiesNow).some(q => q.code === "ENV" && /any/i.test(q.param))
        ? {
            value: system.hazards?.tolerance ?? "",
            options: { "": "— choose —", ...Object.fromEntries(HAZARD_GROUPS.flatMap(g => hazardOptions(g))) }
          }
        : null,
      hasJamming: hasQuality(system.qualitiesNow, "JAM"),
      signatures: (system.signatures ?? []).map(s => ({
        label: SENSOR_LABELS[s.sensor],
        value: s.value ?? "—",
        detail: s.rows
          .map(r => `${r.label}${r === s.rows[0] ? ` ${r.value}` : ` ${r.value >= 0 ? "+" : ""}${r.value}`}`)
          .join(", ")
      })),
      acceleration: system.accelerationTable
        ? {
            ...system.accelerationTable,
            firstShare: share(system.accelerationTable.firstShare),
            laterShare: share(system.accelerationTable.laterShare),
            rounds: system.accelerationTable.speeds.length
          }
        : null,
      upgradesOver: system.upgraded.used > system.upgraded.free,
      weaponsOver: items.filter(i => i.type === "weapon").length > system.weaponSpaces,
      enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.biography, {
        secrets: actor.isOwner
      })
    });
    return context;
  }

  /** A vehicle pick dropped here supplies the statistics; upgrades and weapons are installed. */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;
    if (item.type === "vehicle") return loadVehicleStats(this.actor, item);
    return super._onDropItem(event, item);
  }

  /** A character dropped here comes aboard: at the controls if nobody drives, otherwise as crew or passenger. */
  async _onDropActor(event, actor) {
    if (!this.actor.isOwner || !actor?.uuid || actor.type === "vehicle") return null;
    return boardVehicle(this.actor, actor);
  }

  static async #onOpenSource() {
    const item = this.actor.system.sourceItem ? await fromUuid(this.actor.system.sourceItem) : null;
    if (!item) return ui.notifications.warn("The gear pick this vehicle came from is no longer available.");
    return item.sheet.render(true);
  }
}
