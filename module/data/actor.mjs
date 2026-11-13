import { defaultNpcProfile, computeNpcProfile } from "../rules/npcs.mjs";
import { computeAgent } from "../rules/engine.mjs";
import { SKILLS } from "../rules/tables.mjs";

const { ArrayField, BooleanField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

const int = (initial = 0, opts = {}) => new NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const str = (initial = "", opts = {}) => new StringField({ required: true, blank: true, initial, ...opts });
const resource = (initial = 0) => new SchemaField({ value: int(initial, { min: 0 }), max: int(initial, { min: 0 }) });
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const PROF_KEYS = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "explosives", "guided", "handgun", "hurled",
  "exoticHurled", "indirectFire", "rifle", "shotgun", "submachineGun", "tactical", "vehicleWeapon"];

/* -------------------------------------------------------------------------- */
/*  NPC (simple stat block)                                                   */
/* -------------------------------------------------------------------------- */

class BaseActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const abilities = {};
    for (const key of ABILITY_KEYS) abilities[key] = new SchemaField({ value: int(10, { min: 0 }) });
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
    for (const ability of Object.values(this.abilities)) ability.mod = Math.floor((ability.value - 10) / 2);
    for (const [key, save] of Object.entries(this.saves)) {
      const ability = CONFIG.SPYCRAFT.saves[key].ability;
      save.total = save.base + this.abilities[ability].mod;
    }
    this.defense.total = 10 + this.defense.bonus + this.abilities.dex.mod;
    this.initiative.total = this.initiative.bonus + this.abilities.dex.mod;
    this.attack = { melee: this.bab + this.abilities.str.mod, unarmed: this.bab + this.abilities.str.mod, ranged: this.bab + this.abilities.dex.mod };
    this.skillTotals = {};
    this.warnings = [];
  }
}

export class NpcData extends BaseActorData {
  prepareDerivedData() {
    if (!this.npcProfile?.enabled) return super.prepareDerivedData();
    const result = computeNpcProfile(this.npcProfile, this.npcType, this.threatLevel, this.abilities);
    this.npcBuild = result;
    // Table values are base bonuses. Attribute modifiers are applied once by the base model.
    this.bab = result.stats?.attack ?? 0;
    this.defense.bonus = result.stats?.defense ?? 0;
    this.initiative.bonus = result.stats?.initiative ?? 0;
    for (const save of Object.values(this.saves)) save.base = result.stats?.resilience ?? 0;
    if (result.type === "special" && Array.isArray(result.health)) {
      [this.vitality.max, this.wounds.max] = result.health;
    } else { this.vitality.max = 0; this.wounds.max = 0; }
    super.prepareDerivedData();
    this.damageSave = result.type === "special" ? null : result.health;
    this.competence = result.competence;
    this.warnings = result.warnings;
  }

  static defineSchema() {
    return {
      ...super.defineSchema(),
      threatLevel: int(1, { min: 1 }),
      npcType: new StringField({ initial: "standard", choices: ["standard", "special", "villain", "animal"] }),
      npcProfile: new ObjectField({ initial: () => defaultNpcProfile() })
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Agent (player character) — full character-builder engine                  */
/* -------------------------------------------------------------------------- */

export class AgentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const abilities = {};
    for (const key of ABILITY_KEYS) abilities[key] = new SchemaField({ base: int(8, { min: 1, max: 30 }), misc: int(0) });

    const skills = {};
    for (const s of SKILLS) {
      skills[s.key] = new SchemaField({
        ability: str(),                 // preferred key attribute ("" = best)
        misc: int(0),                   // misc bonus typed by the player
        classSkill: new BooleanField()  // class-skill override ("Oride" column)
      });
    }

    const profs = {};
    for (const k of PROF_KEYS) profs[k] = new SchemaField({ proficient: new BooleanField(), forte: new BooleanField() });

    const misc = {};
    for (const k of ["bab", "fort", "ref", "will", "defense", "initiative", "wealth", "vitality", "wounds", "speed",
      "actionDice", "knowledge", "request", "gearCheck", "gearR", "gearT", "gearV", "gearS", "gearG", "gearW", "gearE"]) misc[k] = int(0);

    return {
      abilities: new SchemaField(abilities),
      pointBuyBudget: int(36, { min: 0 }),
      /** Which attribute each level-based increase went to: { l4: "int", l8: "", … } */
      abilityIncreases: new SchemaField(Object.fromEntries([4, 8, 12, 16, 20].map(l => [`l${l}`, str()]))),

      /** One entry per career level, in order. */
      progression: new ArrayField(new SchemaField({
        classId: str(),
        vitality: int(0, { min: 0 }),
        /** Expert-class entry qualification at the time the level was taken. */
        expertEntry: new ObjectField({ nullable: true, initial: null }),
        /** Skill points spent at this level: { skillKey: points } */
        skills: new ObjectField()
      })),

      xp: int(0, { min: 0 }),
      codename: str(),
      details: new SchemaField({
        faction: str(), gender: str(), age: str(), height: str(), weight: str(), eyes: str(), hair: str()
      }),

      vitality: new SchemaField({ value: int(0, { min: 0 }) }),
      wounds: new SchemaField({ value: int(0, { min: 0 }) }),
      actionDice: new SchemaField({ value: int(0, { min: 0 }) }),
      reputation: int(0),
      netWorth: int(0),

      skills: new SchemaField(skills),
      proficiencies: new SchemaField(profs),
      focuses: new SchemaField({
        cultures: new ArrayField(new StringField()),
        drive: new ArrayField(new StringField()),
        profession: new ArrayField(new StringField()),
        science: new ArrayField(new StringField()),
        /** Extra/generic focuses & fortes, free text */
        fortes: new ArrayField(new StringField())
      }),
      interests: str(),
      contacts: new ArrayField(new SchemaField({ name: str(), rank: int(1, { min: 1, max: 4 }), notes: str() })),
      subplots: new ArrayField(new SchemaField({ name: str(), notes: str(), complete: new BooleanField() })),
      wealthAllocation: new SchemaField({ lifestyle: int(0, { min: 0 }), possessions: int(0, { min: 0 }), spendingCash: int(0, { min: 0 }) }),
      misc: new SchemaField(misc),
      biography: new HTMLField()
    };
  }

  prepareDerivedData() {
    const items = this.parent.items.map(i => ({ id: i.id, name: i.name, type: i.type, system: i.system }));
    computeAgent(this, items, CONFIG.SPYCRAFT);
  }

  /** Data exposed to roll formulas (@level, @abilities.dex.mod, @skills.sneak.total …). */
  getRollData() {
    const data = { ...this.rollDataExtras };
    data.skills = Object.fromEntries(Object.entries(this.skillTotals ?? {}).map(([k, v]) => [k, { ranks: v.ranks, total: v.total }]));
    data.saves = Object.fromEntries(Object.entries(this.saves ?? {}).map(([k, v]) => [k, { ...v }]));
    data.defense = this.defense?.total;
    data.initiative = this.initiative;
    data.bab = this.bab;
    return data;
  }
}
