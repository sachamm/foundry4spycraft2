import { loc } from "../i18n.mjs";
import { crewDamageSaveBonus } from "../rules/driving-feats.mjs";
import { damageSaveAdjustment } from "../rules/gc/npc-damage.mjs";
import { npcQualityEffects } from "../rules/npc-qualities.mjs";
import { npcFeatEffects } from "../rules/npc-feat-effects.mjs";
import { ruleName } from "../rules/rule-name.mjs";
import { cheapShotPenalty, cheapShotRecords, cheapShotSpeedPenalty } from "../rules/cheap-shot-effects.mjs";
import { getActionDieSettlementReview } from "../rules/action-die-payments.mjs";
import { shakenStateFromActor, shakenRules } from "../rules/shaken.mjs";
import { getRestraintReleaseReview, getPendingRestraintMoves } from "../rules/restraints.mjs";
import { getReserveReview } from "../rules/reserve-transactions.mjs";
import {
  conditionContextFromStatuses,
  conditionNpcProfile,
  npcSkillConditionContext
} from "../rules/npc-conditions.mjs";
import { getBaffledReview } from "../rules/baffled.mjs";
import { isResourceLock } from "../services/transactions.mjs";
import { pointmanLevel } from "../rules/action-dice.mjs";
import {
  attributeCollapsePlan,
  attributeDefensePlan,
  conditionAbilityPenalty,
  conditionRollPenalties
} from "../rules/attributes.mjs";
import { sizeRow, sizeWounds } from "../rules/size.mjs";
import { deathThreshold } from "../rules/health.mjs";
import { defaultNpcProfile, computeNpcProfile, npcTableValue } from "../rules/npcs.mjs";
const missionThreatLevelSetting = () => {
  try {
    const m = globalThis.game?.settings?.get("spycraft2", "mission");
    return m?.active && Number.isSafeInteger(m.threatLevel) && m.threatLevel >= 1 && m.threatLevel <= 20
      ? m.threatLevel
      : null;
  } catch {
    return null;
  }
};
import { computeAgent } from "../rules/engine.mjs";
import { vehicleStatFields } from "./vehicle-fields.mjs";
import { record, recordList } from "./record-field.mjs";
import {
  VEHICLE_DAMAGE_COUNTERS,
  breakState,
  vehicleClass,
  vehicleCondition,
  vehicleDefense
} from "../rules/vehicles.mjs";
import {
  entryMovement,
  fuelState,
  hasQuality,
  qualityReference,
  ruggedBonus,
  upgradedStats,
  weaponSpaces
} from "../rules/vehicle-play-rules.mjs";
import { SKILLS } from "../rules/tables.mjs";
import { underminedState } from "../rules/taunt.mjs";
import { mountUpPlan } from "../rules/driving-feats.mjs";
import {
  ANIMAL_PARTNER,
  PERSONAL_LIEUTENANT,
  animalPartnerReview,
  lieutenantReview,
  partnerThreatLevel
} from "../rules/companions.mjs";
import {
  HAZARD_GROUPS,
  accelerationSchedule,
  hazardLine,
  vehicleHazards,
  vehicleSignatures
} from "../rules/vehicle-environment.mjs";

const { ArrayField, BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

const int = (initial = 0, opts = {}) =>
  new NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const str = (initial = "", opts = {}) => new StringField({ required: true, blank: true, initial, ...opts });
const num = (initial = 0, opts = {}) => new NumberField({ required: true, nullable: false, initial, ...opts });
const resource = (initial = 0) => new SchemaField({ value: int(initial, { min: 0 }), max: int(initial, { min: 0 }) });
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const PROF_KEYS = [
  "unarmed",
  "blunt",
  "exoticBlunt",
  "edged",
  "exoticEdged",
  "explosives",
  "guided",
  "handgun",
  "hurled",
  "exoticHurled",
  "indirectFire",
  "rifle",
  "shotgun",
  "submachineGun",
  "tactical",
  "vehicleWeapon"
];

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
      feintBonuses: recordList("feintBonuses"),
      companionOf: record("companionOf", { nullable: true, initial: null }),
      tauntBonuses: recordList("tauntBonuses"),
      undermined: record("undermined", { nullable: true, initial: null }),
      feintHistory: recordList("feintHistory"),
      cheapShots: recordList("cheapShots"),
      /** Contagions at work and a fire burning the character (module/rules/hazards.mjs). */
      hazards: record("hazards", { nullable: true, initial: null }),
      biography: new HTMLField()
    };
  }

  prepareDerivedData() {
    if (this.parent) this.shakenState = shakenStateFromActor(this.parent);
    this.cheapShotActive = cheapShotRecords(this).filter(r => !r.recovered);
    this.cheapShotSpeedPenalty = cheapShotSpeedPenalty(this);
    const shaken = shakenRules(this);
    this.shakenRules = shaken;
    for (const ability of Object.values(this.abilities)) ability.mod = Math.floor((ability.value - 10) / 2);
    // Conditions from the token's statuses, read the same way as an agent's (pp.340–342).
    this.conditionContext ??= npcSkillConditionContext(this.parent);
    // Size (Table 5.13, p.349): Defense, attack and Stealth/Hide modifiers and the death threshold.
    const size = sizeRow(this.qualityEffects?.size);
    this.size = size.size;
    this.sizeModifier = size.modifier;
    this.sizeHideModifier = size.hide;
    this.deathThreshold = deathThreshold(size.size);
    this.attributeCollapse = attributeCollapsePlan(this);
    const conditions = conditionRollPenalties(this),
      drunk = this.conditionContext.drunk === true ? -2 : 0;
    this.conditionPenalties = conditions;
    for (const [key, save] of Object.entries(this.saves)) {
      const ability = CONFIG.SPYCRAFT.saves[key].ability;
      save.total =
        save.base +
        this.abilities[ability].mod +
        conditions.save +
        (["ref", "will"].includes(key) ? shaken.reflexWillPenalty + drunk : 0);
    }
    // Flat-footed, sprawled, stunned, blinded, helpless and the rest take away a positive Dexterity (pp.341–342).
    const defenseState = attributeDefensePlan(this);
    this.helpless = defenseState.helpless;
    this.vulnerable = defenseState.vulnerable;
    this.defense.dexterity = defenseState.dexterity;
    this.defense.total = 10 + this.defense.bonus + defenseState.dexterity + this.sizeModifier;
    this.underminedCombatContext = underminedCombatContext(this);
    this.underminedState = underminedState(this);
    this.initiative.total =
      this.initiative.bonus + this.abilities.dex.mod + shaken.initiativePenalty + drunk - this.underminedState.penalty;
    // conditionRollPenalties' attack figure already holds the Shaken attack penalty.
    const melee = cheapShotPenalty(this, "str") + this.bab + this.abilities.str.mod + this.sizeModifier;
    this.attack = {
      melee: melee + conditions.attack + conditions.meleeAttack,
      unarmed: melee + conditions.attack + conditions.meleeAttack,
      ranged:
        cheapShotPenalty(this, "dex") +
        this.bab +
        this.abilities.dex.mod +
        this.sizeModifier +
        conditions.attack +
        conditionAbilityPenalty(this, "dex")
    };
    this.skillTotals = {};
    this.warnings = [];
  }
}

const hasNpcQuality = (profile, id) => (profile?.qualities ?? []).some(entry => entry?.id === id);

/** A Commander's statistics: the members' build at a Threat Level 2 higher (p.447). */
function commanderBlock(profile, type, threatLevel, abilities) {
  const level = Math.min(20, (Number(threatLevel) || 1) + 2),
    build = computeNpcProfile(profile, type, level, abilities);
  return { threatLevel: level, effectiveLevel: build.effectiveLevel, stats: build.stats, health: build.health };
}

/** The combat an Undermine record is timed in, as the rule reads it. */
function underminedCombatContext(system) {
  const id = system.undermined?.combatId,
    combat = id ? globalThis.game?.combats?.get?.(id) : null;
  return combat ? { id: combat.id, round: combat.round, turn: combat.turn } : null;
}

export class NpcData extends BaseActorData {
  prepareDerivedData() {
    this.worldTime = globalThis.game?.time?.worldTime;
    this.usagePeriods = globalThis.game?.settings?.get("spycraft2", "usagePeriods") ?? {};
    this.conditionContext = npcSkillConditionContext(this.parent);
    // The feats an NPC holds, by rule name, so the attack, damage and Defense rules that look for a feat by name
    // (Sharpshooter, Two-Weapon, Combat Expertise and the rest) treat an NPC's feat as they treat an agent's.
    const featItems = [...(this.parent?.items ?? [])].filter(item => item.type === "feat");
    this.activeFeatNames = [...new Set(featItems.map(item => ruleName(item)))].filter(Boolean);
    // Each feat with its tree, as agents carry them, for the rules that count feats by tree (Gladiators, p.407).
    this.activeFeatSelections = featItems.map(item => ({ name: ruleName(item), tree: item.system?.tree ?? "" }));
    this.baffledApplicationReview = getBaffledReview(this.parent ?? {});
    // A mission's Threat Level scales every NPC that follows it (p.423); others keep their own number.
    const missionTL = this.followMission ? missionThreatLevelSetting() : null;
    this.effectiveThreatLevel = missionTL ?? this.threatLevel;
    this.usesMissionThreatLevel = missionTL !== null;
    // Animal Partner (p.201): a special character at the owner's career level − 2, one health grade higher.
    const partnerOwner =
      this.companionOf?.feat === ANIMAL_PARTNER
        ? (globalThis.fromUuidSync?.(this.companionOf.ownerUuid) ?? null)
        : null;
    this.animalPartner = !!partnerOwner;
    if (partnerOwner) {
      this.effectiveThreatLevel = partnerThreatLevel(partnerOwner.system?.level);
      this.usesMissionThreatLevel = false;
    }
    // Commander (p.447): the squad's leader is built as if the Threat Level were 2 higher.
    const commanderQuality = !!this.npcProfile?.enabled && hasNpcQuality(this.npcProfile, "commander");
    this.isCommander = commanderQuality && this.commander === true;
    if (this.isCommander) this.effectiveThreatLevel = Math.min(20, this.effectiveThreatLevel + 2);
    // p.398: a promoted standard NPC is special until the mission ends.
    this.promoted = !!this.promotion && this.promotion.mission === String(this.usagePeriods?.mission ?? "initial");
    // What the NPC's qualities do at the table (module/rules/npc-qualities.mjs).
    this.qualityEffects = npcQualityEffects(this.npcProfile?.enabled ? this.npcProfile : null, {
      type: this.npcType === "villain" ? "special" : this.npcType,
      threatLevel: this.effectiveThreatLevel,
      abilities: this.abilities
    });
    if (!this.npcProfile?.enabled) {
      super.prepareDerivedData();
      if (!["special", "villain"].includes(this.npcType) && !this.promoted) this.damageSave = this.manualDamageSave;
      this.applyFeatEffects({ health: false });
      return;
    }
    const result = conditionNpcProfile(
      computeNpcProfile(this.npcProfile, this.npcType, this.effectiveThreatLevel, this.abilities),
      this.conditionContext
    );
    this.npcBuild = result;
    // The squad's Commander, worked out beside the members' block so the GC can see both (p.447).
    this.commanderBuild =
      commanderQuality && !this.isCommander
        ? commanderBlock(this.npcProfile, this.npcType, this.effectiveThreatLevel, this.abilities)
        : null;
    const commanderNote = this.qualityEffects?.notes?.find(note => note.id === "commander");
    if (commanderNote && this.isCommander)
      commanderNote.text = loc`This token leads the squad, built at Threat Level ${this.effectiveThreatLevel}.`;
    else if (commanderNote && this.commanderBuild) {
      const { threatLevel, stats } = this.commanderBuild,
        sign = value => (value >= 0 ? `+${value}` : `${value}`);
      commanderNote.text = loc`One squad member leads, built at Threat Level ${threatLevel}: attack ${sign(stats.attack)}, Defense ${sign(stats.defense)}, Initiative ${sign(stats.initiative)}, saves ${sign(stats.resilience)} before attributes.`;
    }
    // Table values are base bonuses. Attribute modifiers are applied once by the base model.
    this.bab = result.stats?.attack ?? 0;
    this.defense.bonus = result.stats?.defense ?? 0;
    this.initiative.bonus = result.stats?.initiative ?? 0;
    for (const save of Object.values(this.saves)) save.base = result.stats?.resilience ?? 0;
    if (result.type === "special" && Array.isArray(result.health)) {
      [this.vitality.max, this.wounds.max] = result.health;
    } else {
      this.vitality.max = 0;
      this.wounds.max = 0;
    }
    super.prepareDerivedData();
    this.damageSave = result.type === "special" ? null : result.health;
    if (this.promoted && result.type !== "special") {
      const health = npcTableValue("health", this.npcProfile.grades?.health, result.effectiveLevel);
      if (Array.isArray(health)) {
        [this.vitality.max, this.wounds.max] = health;
        this.damageSave = null;
      }
    }
    if (partnerOwner) {
      const grade = Math.min(10, (this.npcProfile.grades?.health ?? 1) + 1),
        health = npcTableValue("health", grade, result.effectiveLevel);
      if (Array.isArray(health)) {
        [this.vitality.max, this.wounds.max] = health;
        this.damageSave = null;
      }
    }
    // A special NPC's wounds follow its Size (Table 5.13, p.349); a standard NPC's Damage save does not.
    if (this.wounds.max > 0) this.wounds.max = sizeWounds(this.wounds.max, this.size);
    this.applyFeatEffects({ health: true });
    this.competence = result.competence;
    this.warnings = [
      ...(result.warnings ?? []),
      ...(partnerOwner ? animalPartnerReview(partnerOwner.system, this).warnings : [])
    ];
  }

  /**
   * Add what the NPC's feat items do to the totals (module/rules/npc-feat-effects.mjs). Stored numbers are left
   * alone, so the sheet's own fields never save a feat's bonus back into them. Vitality and wounds are added only
   * where the maximums are worked out from the NPC's grades rather than typed in.
   */
  applyFeatEffects({ health }) {
    const effects = npcFeatEffects(
      [...(this.parent?.items ?? [])].map(item => ({ type: item.type, name: item.name, system: item.system })),
      {
        level: this.effectiveThreatLevel ?? this.threatLevel,
        base: Object.fromEntries(Object.entries(this.saves).map(([key, save]) => [key, save.base]))
      }
    );
    for (const [key, value] of Object.entries(effects.saves)) this.saves[key].total += value;
    this.initiative.total += effects.initiative;
    if (this.qualityEffects && Number.isFinite(this.qualityEffects.speed)) this.qualityEffects.speed += effects.speed;
    effects.healthApplied = health && this.vitality.max > 0;
    if (effects.healthApplied) {
      this.vitality.max += effects.vitality;
      this.wounds.max += effects.wounds;
    } else if (health && Number.isFinite(this.damageSave) && (effects.vitality || effects.wounds)) {
      // p.452: a standard NPC's Damage save moves by 1 per wound or per 2 vitality a feat adds or takes away.
      effects.damageSaveFromHealth = damageSaveAdjustment(effects);
      this.damageSave += effects.damageSaveFromHealth;
      effects.healthApplied = true;
    }
    this.featEffects = effects;
  }

  static defineSchema() {
    return {
      ...super.defineSchema(),
      threatLevel: int(1, { min: 1 }),
      // A new NPC follows the mission's Threat Level (p.423); one saved before keeps its stored choice.
      followMission: new BooleanField({ initial: true }),
      promotion: record("promotion", { nullable: true, initial: null }),
      manualDamageSave: int(0),
      damageSaveAdjust: int(0),
      damageTrack: record("damageTrack", { nullable: true, initial: null }),
      disposition: record("disposition", { initial: () => ({ base: "neutral", toward: {} }) }),
      manualRole: new StringField({ initial: "", blank: true, choices: ["", "minion", "henchman", "mastermind"] }),
      // This token is the Commander of its Minion squad (p.447).
      commander: new BooleanField({ initial: false }),
      npcType: new StringField({ initial: "standard", choices: ["standard", "special", "villain", "animal"] }),
      npcProfile: record("npcProfile", { initial: () => defaultNpcProfile() })
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Agent (player character) — full character-builder engine                  */
/* -------------------------------------------------------------------------- */

export class AgentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const abilities = {};
    for (const key of ABILITY_KEYS)
      abilities[key] = new SchemaField({ base: int(8, { min: 1, max: 30 }), misc: int(0) });

    const skills = {};
    for (const s of SKILLS) {
      skills[s.key] = new SchemaField({
        ability: str(), // preferred key attribute ("" = best)
        misc: int(0), // misc bonus typed by the player
        classSkill: new BooleanField(), // class-skill override
        classSkillAt: int(1, { min: 1, max: 20 })
      });
    }

    const profs = {};
    for (const k of PROF_KEYS)
      profs[k] = new SchemaField({ proficient: new BooleanField(), forte: new BooleanField() });

    const misc = {};
    for (const k of [
      "bab",
      "fort",
      "ref",
      "will",
      "defense",
      "initiative",
      "wealth",
      "vitality",
      "wounds",
      "speed",
      "actionDice",
      "knowledge",
      "request",
      "gearCheck",
      "gearR",
      "gearT",
      "gearV",
      "gearS",
      "gearG",
      "gearW",
      "gearE"
    ])
      misc[k] = int(0);

    return {
      abilities: new SchemaField(abilities),
      pointBuyBudget: int(36, { min: 0 }),
      /** Which attribute each level-based increase went to: { l4: "int", l8: "", … } */
      abilityIncreases: new SchemaField(Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`l${i + 3}`, str()]))),

      /** One entry per career level, in order. */
      progression: new ArrayField(
        new SchemaField({
          classId: str(),
          vitality: int(0, { min: 0 }),
          careerEntryId: str(),
          /** The mission period the level was gained in, for the one-level-between-missions limit (p.27). */
          mission: str(),
          vitalityRollId: str(),
          vitalityReviewId: str(),
          /** INT modifier when points were earned; null reconstructs legacy history. */
          intelligenceModifier: new NumberField({ nullable: true, initial: null, integer: true }),
          /** Expert-class entry qualification at the time the level was taken. */
          expertEntry: record("expertEntry", { nullable: true, initial: null }),
          /** Skill points spent at this level: { skillKey: points } */
          skills: record("progressionSkills")
        })
      ),

      xp: int(1000, { min: 0 }),
      codename: str(),
      details: new SchemaField({
        faction: str(),
        gender: str(),
        age: str(),
        height: str(),
        weight: str(),
        eyes: str(),
        hair: str()
      }),

      vitality: new SchemaField({ value: int(0, { min: 0 }) }),
      wounds: new SchemaField({ value: int(0) }),
      actionDice: new SchemaField({ value: int(0, { min: 0 }) }),
      fortuneTeammateIds: new ArrayField(new StringField()),
      actionDieAwards: record("actionDieAwards"),
      missionXPRewards: record("missionXPRewards"),
      eagleEyeBoost: record("eagleEyeBoost", { nullable: true, initial: null }),
      sideStanceFeints: recordList("sideStanceFeints"),
      sideStanceDamageUses: recordList("sideStanceDamageUses"),
      attackDamageUses: recordList("attackDamageUses"),
      stanceRoundMovement: record("stanceRoundMovement", { nullable: true, initial: null }),
      combatStance: record("combatStance", { nullable: true, initial: null }),
      berserkerRage: record("berserkerRage", { nullable: true, initial: null }),
      duelingBasics: record("duelingBasics", { nullable: true, initial: null }),
      fightDefensively: record("fightDefensively", { nullable: true, initial: null }),
      intenseStance: record("intenseStance", { nullable: true, initial: null }),
      woundDrops: record("woundDrops", { nullable: true, initial: null }),
      snakeStrikes: recordList("snakeStrikes"),
      identities: recordList("identities"),
      activeIdentity: str(),
      twoWeaponStyle: record("twoWeaponStyle", { nullable: true, initial: null }),
      dartingStyle: record("dartingStyle", { nullable: true, initial: null }),
      totalDefense: record("totalDefense", { nullable: true, initial: null }),
      combatExpertise: record("combatExpertise", { nullable: true, initial: null }),
      superiorCover: record("superiorCover", { nullable: true, initial: null }),
      defenseBoost: record("defenseBoost", { nullable: true, initial: null }),
      noFearBoost: record("noFearBoost", { nullable: true, initial: null }),
      attributeDamage: record("attributeDamage", { nullable: true, initial: null }),
      mentalLeaps: recordList("mentalLeaps"),
      fatigueRest: record("fatigueRest", { nullable: true, initial: null }),
      drunkSleep: record("drunkSleep", { nullable: true, initial: null }),
      drunkRepositions: recordList("drunkRepositions"),
      fatigueApplications: recordList("fatigueApplications"),
      mentalLeapFatigueEvents: recordList("mentalLeapFatigueEvents"),
      mentalLeapRecovery: record("mentalLeapRecovery", { nullable: true, initial: null }),
      mentalLeapSleep: record("mentalLeapSleep", { nullable: true, initial: null }),
      fortunesOfWarBoost: record("fortunesOfWarBoost", { nullable: true, initial: null }),
      refreshAction: record("refreshAction", { nullable: true, initial: null }),
      temporaryShares: record("temporaryShares"),
      assistantGroups: recordList("assistantGroups"),
      accumulatedDamage: record("accumulatedDamage", { nullable: true, initial: null }),
      /** Contagions at work and a fire burning the character (module/rules/hazards.mjs). */
      hazards: record("hazards", { nullable: true, initial: null }),
      resourceUses: record("resourceUses"),
      resourcesInitialized: new BooleanField(),
      affiliationType: str("faction", { choices: ["faction", "freelance"] }),
      analysisTasks: record("analysisTasks", { initial: {} }),
      safeHouses: record("safeHouses", { initial: {} }),
      careerAgentRewards: record("careerAgentRewards", { initial: {} }),
      reputation: int(2),
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
      startingIntelligenceModifier: new NumberField({ nullable: true, initial: null, integer: true }),
      skillFortes: new ArrayField(new SchemaField({ skill: str(), focus: str(), forte: str() })),
      crossroadsTitle: str(),
      // Feat Purchase and Modular (pp.406–407): feats bought with XP after missions, and feats traded for
      // attribute points at creation (positive: feats bought at 2 points each; negative: feats given up for 2 each).
      featTrades: new SchemaField({
        purchased: int(0, { min: 0 }),
        modular: int(0, { min: -20, max: 20 }),
        // The mission period of the last Feat Purchase: one feat may be bought at the end of each mission (p.407).
        purchaseMission: str()
      }),
      relinquishedInterests: int(0, { min: 0 }),
      interests: str(),
      contacts: new ArrayField(
        new SchemaField({
          name: str(),
          rank: int(1, { min: 1, max: 4 }),
          notes: str(),
          networkingMilestone: int(0, { min: 0 }),
          networkingFeat: str(),
          networkingTheme: str(),
          networkingFeatConfirmed: new BooleanField(),
          // Consultants and specialists this contact knows (pp.458–459); "summoned" holds the mission period used.
          people: new ArrayField(
            new SchemaField({
              kind: str("consultant"),
              grade: int(1, { min: 1, max: 4 }),
              skill: str(),
              ability: str(),
              summoned: str()
            })
          )
        })
      ),
      subplots: new ArrayField(new SchemaField({ name: str(), notes: str(), complete: new BooleanField() })),
      gearPickLosses: record("gearPickLosses"),
      /** Mission gear picks a Gear Restriction takes (Table 7.8, p.437), by category, chosen at Intel. */
      gearRestrictionLosses: record("gearRestrictionLosses"),
      missionReserves: record("missionReserves", { nullable: true, initial: null }),
      armorMissionGrant: record("armorMissionGrant", { nullable: true, initial: null }),
      bigStickMissionPick: record("bigStickMissionPick", { nullable: true, initial: null }),
      missionCaliberPicks: record("missionCaliberPicks", { initial: {} }),
      classGearGrants: record("classGearGrants", { initial: {} }),
      bonusActionDice: record("bonusActionDice", { initial: {} }),
      missionReserveHistory: recordList("missionReserveHistory"),
      wellFundedGrants: record("wellFundedGrants", { initial: {} }),
      wealthAllocation: new SchemaField({
        dressedForLifestyle: new BooleanField({ initial: false }),
        lifestyle: int(0, { min: 0 }),
        possessions: int(0, { min: 0 }),
        spendingCash: int(0, { min: 0 })
      }),
      misc: new SchemaField(misc),
      feintBonuses: recordList("feintBonuses"),
      companionOf: record("companionOf", { nullable: true, initial: null }),
      tauntBonuses: recordList("tauntBonuses"),
      undermined: record("undermined", { nullable: true, initial: null }),
      feintHistory: recordList("feintHistory"),
      cheapShots: recordList("cheapShots"),
      biography: new HTMLField()
    };
  }

  prepareDerivedData() {
    // The fight this character is in is the same for the whole pass, so it is looked up once (each lookup scans
    // every combat) and only if something below asks.
    let foundCombat;
    const participatingCombat = () =>
      foundCombat === undefined ? (foundCombat = this.parent.participatingCombat ?? null) : foundCombat;
    this.actorUuid = this.parent.uuid;
    this.shakenState = shakenStateFromActor(this.parent);
    this.restraintReleaseReview = getRestraintReleaseReview(this.parent);
    this.pendingRestraintMoves = getPendingRestraintMoves(this.parent);
    this.reserveTransactionReview = getReserveReview(this.parent);
    this.baffledApplicationReview = getBaffledReview(this.parent);
    const items = this.parent.items
      .filter(i => !isResourceLock(i))
      .map(i => ({ id: i.id, name: i.name, type: i.type, system: i.system }));
    const combat = this.defenseBoost?.combatId
      ? globalThis.game?.combats?.get?.(this.defenseBoost.combatId)
      : globalThis.game?.combat;
    this.combatContext = combat ? { id: combat.id, round: combat.round, started: combat.started } : null;
    const dartingCombat = this.dartingStyle?.combatId
      ? globalThis.game?.combats?.get?.(this.dartingStyle.combatId)
      : participatingCombat();
    const dartingOwn = dartingCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.dartingStyle?.combatantId || c.id === this.dartingStyle.combatantId)
    );
    this.dartingCombatContext = dartingCombat
      ? {
          id: dartingCombat.id,
          started: dartingCombat.started,
          round: dartingCombat.round,
          turn: dartingCombat.turn,
          combatantId: dartingOwn?.id,
          ownTurnIndex: dartingCombat.turns?.findIndex(c => c.id === dartingOwn?.id) ?? -1
        }
      : null;
    const twoWeaponCombat = this.twoWeaponStyle?.combatId
      ? globalThis.game?.combats?.get?.(this.twoWeaponStyle.combatId)
      : participatingCombat();
    const twoWeaponOwn = twoWeaponCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.twoWeaponStyle?.combatantId || c.id === this.twoWeaponStyle.combatantId)
    );
    this.twoWeaponCombatContext = twoWeaponCombat
      ? {
          id: twoWeaponCombat.id,
          started: twoWeaponCombat.started,
          round: twoWeaponCombat.round,
          turn: twoWeaponCombat.turn,
          combatantId: twoWeaponOwn?.id,
          ownTurnIndex: twoWeaponCombat.turns?.findIndex(c => c.id === twoWeaponOwn?.id) ?? -1
        }
      : null;
    const totalDefenseCombat = this.totalDefense?.combatId
      ? globalThis.game?.combats?.get?.(this.totalDefense.combatId)
      : participatingCombat();
    const totalDefenseOwn = totalDefenseCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.totalDefense?.combatantId || c.id === this.totalDefense.combatantId)
    );
    // Dueling Basics' declaration is timed like Total Defense, from the character's own Count.
    const duelingCombat = this.duelingBasics?.combatId
      ? globalThis.game?.combats?.get?.(this.duelingBasics.combatId)
      : participatingCombat();
    const duelingOwn = duelingCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.duelingBasics?.combatantId || c.id === this.duelingBasics.combatantId)
    );
    this.duelingCombatContext = duelingCombat
      ? {
          id: duelingCombat.id,
          started: duelingCombat.started,
          round: duelingCombat.round,
          turn: duelingCombat.turn,
          combatantId: duelingOwn?.id,
          ownTurnIndex: duelingCombat.turns?.findIndex(c => c.id === duelingOwn?.id) ?? -1
        }
      : null;
    this.underminedCombatContext = underminedCombatContext(this);
    this.currentCombatId = participatingCombat()?.id ?? null;
    // Personal Lieutenant (p.204): the owner's career level and feats, for the lieutenant's limits.
    const lieutenantOwner =
      this.companionOf?.feat === PERSONAL_LIEUTENANT
        ? (globalThis.fromUuidSync?.(this.companionOf.ownerUuid) ?? null)
        : null;
    this.lieutenantOwner = lieutenantOwner
      ? {
          level: lieutenantOwner.system?.level ?? 0,
          activeFeatNames: [...(lieutenantOwner.system?.activeFeatNames ?? [])]
        }
      : null;
    // Death Ride: whether this character is driving a vehicle or riding a mount (its recorded driver).
    this.operatingVehicle = [...(globalThis.game?.actors ?? [])].some(
      a => a.type === "vehicle" && a.system?.driver === this.parent.uuid
    );
    // Fight Defensively lasts 1 full round from the character's own Count.
    const fightCombat = this.fightDefensively?.combatId
      ? globalThis.game?.combats?.get?.(this.fightDefensively.combatId)
      : participatingCombat();
    const fightOwn = fightCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.fightDefensively?.combatantId || c.id === this.fightDefensively.combatantId)
    );
    const intenseCombat = this.intenseStance?.combatId
      ? globalThis.game?.combats?.get?.(this.intenseStance.combatId)
      : participatingCombat();
    const intenseOwn = intenseCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.intenseStance?.combatantId || c.id === this.intenseStance.combatantId)
    );
    this.intenseCombatContext = intenseCombat
      ? {
          id: intenseCombat.id,
          started: intenseCombat.started,
          round: intenseCombat.round,
          turn: intenseCombat.turn,
          combatantId: intenseOwn?.id,
          ownTurnIndex: intenseCombat.turns?.findIndex(c => c.id === intenseOwn?.id) ?? -1
        }
      : null;
    this.fightDefensivelyCombatContext = fightCombat
      ? {
          id: fightCombat.id,
          started: fightCombat.started,
          round: fightCombat.round,
          turn: fightCombat.turn,
          combatantId: fightOwn?.id,
          ownTurnIndex: fightCombat.turns?.findIndex(c => c.id === fightOwn?.id) ?? -1
        }
      : null;
    this.totalDefenseCombatContext = totalDefenseCombat
      ? {
          id: totalDefenseCombat.id,
          started: totalDefenseCombat.started,
          round: totalDefenseCombat.round,
          turn: totalDefenseCombat.turn,
          combatantId: totalDefenseOwn?.id,
          ownTurnIndex: totalDefenseCombat.turns?.findIndex(c => c.id === totalDefenseOwn?.id) ?? -1
        }
      : null;
    const superiorCombat = this.superiorCover?.combatId
      ? globalThis.game?.combats?.get?.(this.superiorCover.combatId)
      : participatingCombat();
    const superiorOwn = superiorCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.superiorCover?.combatantId || c.id === this.superiorCover.combatantId)
    );
    this.superiorCoverCombatContext = superiorCombat
      ? {
          id: superiorCombat.id,
          started: superiorCombat.started,
          round: superiorCombat.round,
          turn: superiorCombat.turn,
          combatantId: superiorOwn?.id,
          ownTurnIndex: superiorCombat.turns?.findIndex(c => c.id === superiorOwn?.id) ?? -1
        }
      : null;
    const expertiseCombat = this.combatExpertise?.combatId
      ? globalThis.game?.combats?.get?.(this.combatExpertise.combatId)
      : participatingCombat();
    const expertiseOwn = expertiseCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid &&
        (!this.combatExpertise?.combatantId || c.id === this.combatExpertise.combatantId)
    );
    this.expertiseCombatContext = expertiseCombat
      ? {
          id: expertiseCombat.id,
          started: expertiseCombat.started,
          round: expertiseCombat.round,
          turn: expertiseCombat.turn,
          combatantId: expertiseOwn?.id,
          ownTurnIndex: expertiseCombat.turns?.findIndex(c => c.id === expertiseOwn?.id) ?? -1
        }
      : null;
    const warCombat = this.fortunesOfWarBoost?.combatId
      ? globalThis.game?.combats?.get?.(this.fortunesOfWarBoost.combatId)
      : participatingCombat();
    const own = warCombat?.turns?.find(c =>
      this.fortunesOfWarBoost?.combatantId
        ? c.id === this.fortunesOfWarBoost.combatantId
        : c.actor?.uuid === this.parent.uuid
    );
    this.fortunesCombatContext = warCombat
      ? {
          id: warCombat.id,
          round: warCombat.round,
          started: warCombat.started,
          turn: warCombat.turn,
          combatantId: own?.id,
          ownTurnIndex: warCombat.turns?.findIndex(c => c.id === own?.id) ?? -1
        }
      : null;
    const fearCombat = this.noFearBoost?.combatId
      ? globalThis.game?.combats?.get?.(this.noFearBoost.combatId)
      : participatingCombat();
    const fearOwn = fearCombat?.turns?.find(
      c =>
        c.actor?.uuid === this.parent.uuid && (!this.noFearBoost?.combatantId || c.id === this.noFearBoost.combatantId)
    );
    this.noFearCombatContext = fearCombat
      ? {
          id: fearCombat.id,
          round: fearCombat.round,
          started: fearCombat.started,
          turn: fearCombat.turn,
          combatantId: fearOwn?.id,
          ownTurnIndex: fearCombat.turns?.findIndex(c => c.id === fearOwn?.id) ?? -1
        }
      : null;
    this.actionDieAwardReview = this.parent.flags?.spycraft2?.actionDieAwardReview ?? null;
    this.actionDiceSettlementReview = getActionDieSettlementReview(this.parent);
    this.worldTime = globalThis.game?.time?.worldTime;
    this.conditionContext = conditionContextFromStatuses(this.parent.statuses);
    this.bonusPoolChecks = {};
    for (const pool of Object.values(this.bonusActionDice ?? {})) {
      if (!pool?.messageUuid) continue;
      const m = globalThis.game?.messages?.get?.(String(pool.messageUuid).split(".").at(-1));
      if (m) this.bonusPoolChecks[pool.messageUuid] = { uuid: m.uuid, flags: { spycraft2: m.flags?.spycraft2 } };
    }
    this.bonusPoolCombats = Object.fromEntries(
      [...(globalThis.game?.combats ?? [])].map(c => [c.id, { id: c.id, started: c.started, round: c.round }])
    );
    this.mentalLeapCombats = {};
    for (const record of this.mentalLeaps ?? []) {
      if (!record.combatId || this.mentalLeapCombats[record.combatId]) continue;
      const combat = globalThis.game?.combats?.get?.(record.combatId),
        own = combat?.turns?.find(c => c.id === record.combatantId && c.actor?.uuid === this.parent.uuid);
      if (combat && own)
        this.mentalLeapCombats[record.combatId] = {
          id: combat.id,
          started: combat.started,
          round: combat.round,
          turn: combat.turn,
          combatantId: own.id,
          ownTurnIndex: combat.turns.findIndex(c => c.id === own.id)
        };
    }
    this.usagePeriods = globalThis.game?.settings?.get("spycraft2", "usagePeriods") ?? {};
    this.fortuneTeammates = [...new Set(this.fortuneTeammateIds ?? [])]
      .filter(id => id !== this.parent.id)
      .map(id => {
        const actor = globalThis.game?.actors?.get?.(id);
        return { id, name: actor?.name ?? "Missing teammate", level: pointmanLevel(actor) };
      });
    computeAgent(this, items, CONFIG.SPYCRAFT);
  }

  /** Data exposed to roll formulas (@level, @abilities.dex.mod, @skills.sneak.total …). */
  getRollData() {
    const data = { ...this.rollDataExtras };
    data.skills = Object.fromEntries(
      Object.entries(this.skillTotals ?? {}).map(([k, v]) => [k, { ranks: v.ranks, total: v.total }])
    );
    data.saves = Object.fromEntries(Object.entries(this.saves ?? {}).map(([k, v]) => [k, { ...v }]));
    data.knowledge = this.knowledge;
    data.defense = this.defense?.total;
    data.initiative = this.initiative;
    data.bab = this.bab;
    return data;
  }
}

/* -------------------------------------------------------------------------- */
/*  Vehicle (a gear pick placed on a scene)                                   */
/* -------------------------------------------------------------------------- */

export class VehicleActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...vehicleStatFields(),
      caliber: int(0, { min: 0, max: 5 }),
      /** UUID of the gear pick this vehicle was deployed from, if any. */
      sourceItem: str(),
      /** UUID of the character at the controls; their Dexterity modifier counts while the vehicle moves (p.289). */
      driver: str(),
      moving: new BooleanField(),
      /** Travelling faster than its cruising MPH: lowers its signature (p.292) and doubles fuel use (p.225). */
      aboveCruising: new BooleanField(),
      /** Burning: a Fuel damage result makes its fuel explode (Table 4.73, p.291). */
      onFire: new BooleanField(),
      /** Jamming gear switched on: a larger radar signature (p.294). */
      jamming: new BooleanField(),
      /** Terrain, surface, weather and wind it travels through (Table 4.76), and the hazard an "any one" tolerance ignores. */
      hazards: new SchemaField({ ...Object.fromEntries(HAZARD_GROUPS.map(group => [group, str()])), tolerance: str() }),
      /** Damage saves failed so far (p.224). */
      failedSaves: int(0, { min: 0 }),
      /** Vehicle Damage results recorded so far (Table 4.72, p.290). */
      damage: new SchemaField(Object.fromEntries(VEHICLE_DAMAGE_COUNTERS.map(key => [key, int(0, { min: 0 })]))),
      /** Everyone aboard besides the driver (p.289). */
      occupants: new ArrayField(
        new SchemaField({ uuid: str(), role: str("passenger", { choices: ["crew", "passenger"] }) })
      ),
      /** How the vehicle was acquired, which sets the size of its skeleton crew (p.289). */
      acquiredAs: str("", { choices: ["", "possession", "mission"] }),
      /** Hours of fuel used since the last refuel (p.225); combat and chase rounds use a minute each. */
      fuelUsed: num(0, { min: 0 }),
      /** UUID of the NPC whose statistics a mount uses where its table entry says "NPC" (p.236). */
      mountNpc: str(),
      /** UUID of an attacking vehicle, to show this vehicle's Defense against it (p.289). */
      attacker: str(),
      biography: new HTMLField()
    };
  }

  /** A vehicle on a scene is one particular vehicle: its tokens share its fuel, damage and occupants. */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate?.(data, options, user);
    if (allowed === false) return false;
    if (data.prototypeToken?.actorLink === undefined) this.parent.updateSource({ "prototypeToken.actorLink": true });
  }

  prepareDerivedData() {
    this.classInfo = vehicleClass(this.vehicleClass);
    // Installed upgrades (Tables 4.28–4.29) are embedded items with an upgrade cost.
    const upgrades = [...(this.parent?.items ?? [])]
      .filter(item => /^Table 4\.2[89]/.test(item.system?.sourceTable ?? ""))
      .map(item => ({
        id: item.id,
        name: item.name,
        cost: Number(item.system.stats?.find(s => s.label === "Upgrade cost")?.value) || 0,
        weapon: item.system.sourceTable === "Table 4.29"
      }));
    this.upgradeList = upgrades;
    this.upgraded = upgradedStats(this, upgrades);
    const stats = {
      ...this,
      acceleration: this.upgraded.acceleration,
      turning: this.upgraded.turning,
      topMph: this.upgraded.topMph,
      runFlat: !!this.upgraded.runFlat
    };
    this.condition = vehicleCondition(stats, this.damage);
    this.qualitiesNow = this.upgraded.qualities;
    this.qualityList = qualityReference(this.qualitiesNow);
    this.breakState = breakState(this.size || this.sizeLabel, this.failedSaves);
    const resolve = uuid => (uuid ? (globalThis.fromUuidSync?.(uuid) ?? null) : null);
    const driver = resolve(this.driver),
      mount = resolve(this.mountNpc),
      attacker = resolve(this.attacker);
    this.driverName = driver?.name ?? "";
    this.mountName = mount?.name ?? "";
    this.attackerName = attacker?.name ?? "";
    // A mount whose table entry says "NPC" takes its Defense and Damage save from the linked NPC.
    let baseDefense = Number.isSafeInteger(this.defense) ? this.defense : (mount?.system?.defense?.total ?? null);
    // Mount Up (p.192): a ridden mount uses the rider's Defense and Reflex save bonus when they are higher.
    this.mountUp = mountUpPlan(this, driver?.system, mount?.system);
    if (this.mountUp && Number.isSafeInteger(baseDefense)) baseDefense = Math.max(baseDefense, this.mountUp.defense);
    const baseSave = Number.isSafeInteger(this.upgraded.damageSave)
      ? this.upgraded.damageSave
      : (mount?.system?.damageSave ?? null);
    const attackerNow = attacker?.type === "vehicle" ? attacker.system.condition : null;
    this.defenseNow = vehicleDefense({
      defense: baseDefense,
      moving: this.moving,
      driverDexMod: driver?.system?.abilities?.dex?.mod ?? 0,
      acceleration: this.condition.acceleration,
      turning: this.condition.turning,
      attacker: attackerNow
    });
    // Rugged adds to every Damage save the vehicle makes (p.294); so do the crew's Chase feats (pp.192–193).
    this.crewSave = crewDamageSaveBonus(
      driver?.system,
      (this.occupants ?? []).map(o => resolve(o.uuid)?.system).filter(Boolean)
    );
    this.damageSaveNow = Number.isSafeInteger(baseSave)
      ? baseSave +
        (hasQuality(this.qualitiesNow, "RGD") ? ruggedBonus(this.size || this.sizeLabel) : 0) +
        this.crewSave.bonus
      : null;
    this.fuel = fuelState(this.rangeFuel, {
      used: this.fuelUsed,
      lost: this.damage.fuelHours,
      extraHours: this.upgraded.fuelHours
    });
    this.occupantList = this.occupants.map((o, index) => ({ index, ...o, name: resolve(o.uuid)?.name ?? "(missing)" }));
    this.crewCount = this.crew ?? 0;
    this.entryFeet = entryMovement(this);
    this.weaponSpaces = weaponSpaces(this.size || this.sizeLabel);
    // Surroundings (pp.291–293): terrain and weather, sensor signature and acceleration.
    this.hazardEffect = vehicleHazards(this, this.hazards);
    this.hazardSummary = hazardLine(this.hazardEffect);
    this.signatures = vehicleSignatures(this, { fasterThanCruising: this.aboveCruising, jamming: this.jamming });
    this.accelerationTable = accelerationSchedule({
      acceleration: this.condition.acceleration,
      topMph: this.condition.topMph
    });
  }

  /**
   * Vehicles act on their driver's Initiative Count (p.289). Rolled on its own, a vehicle uses its driver's
   * Initiative bonus; a combat hook then copies the driver's actual result when the driver is in the fight.
   */
  getRollData() {
    const driver = this.driver ? (globalThis.fromUuidSync?.(this.driver) ?? null) : null;
    return {
      initiative: { total: driver?.system?.initiative?.total ?? 0 },
      defense: this.defenseNow?.total ?? this.defense ?? 0,
      damageSave: this.damageSaveNow ?? this.damageSave ?? 0
    };
  }
}
