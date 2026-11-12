const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

const int = (initial = 0, opts = {}) => new NumberField({ required: true, integer: true, initial, ...opts });
const resource = (initial = 0) => new SchemaField({ value: int(initial, { min: 0 }), max: int(initial, { min: 0 }) });

/** Fields shared by every Spycraft actor. */
class BaseActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const abilities = {};
    for (const key of Object.keys(CONFIG.SPYCRAFT.abilities)) {
      abilities[key] = new SchemaField({ value: int(10, { min: 0 }) });
    }
    return {
      abilities: new SchemaField(abilities),
      vitality: resource(0),
      wounds: resource(0),
      defense: new SchemaField({ bonus: int(0) }),
      initiative: new SchemaField({ bonus: int(0) }),
      bab: int(0),
      saves: new SchemaField({
        fort: new SchemaField({ base: int(0) }),
        ref: new SchemaField({ base: int(0) }),
        will: new SchemaField({ base: int(0) })
      }),
      biography: new HTMLField()
    };
  }

  prepareDerivedData() {
    for (const ability of Object.values(this.abilities)) {
      ability.mod = Math.floor((ability.value - 10) / 2);
    }
    for (const [key, save] of Object.entries(this.saves)) {
      const ability = CONFIG.SPYCRAFT.saves[key].ability;
      save.total = save.base + this.abilities[ability].mod;
    }
    this.defense.total = 10 + this.defense.bonus + this.abilities.dex.mod;
    this.initiative.total = this.initiative.bonus + this.abilities.dex.mod;
  }
}

export class AgentData extends BaseActorData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      level: int(1, { min: 1, max: 20 }),
      xp: int(0, { min: 0 }),
      actionDice: resource(0),
      reputation: int(0),
      netWorth: int(0),
      codename: new StringField({ blank: true })
    };
  }
}

export class NpcData extends BaseActorData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      threatLevel: int(1, { min: 1 }),
      npcType: new StringField({ initial: "standard", choices: ["standard", "special", "villain"] })
    };
  }
}
