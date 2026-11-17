import {cheapShotPenalty,cheapShotRecords,cheapShotSpeedPenalty} from '../rules/cheap-shot-effects.mjs';
import {getActionDieSettlementReview} from '../rules/action-die-payments.mjs';
import {shakenStateFromActor,shakenRules} from '../rules/shaken.mjs';
import {getRestraintReleaseReview,getPendingRestraintMoves} from '../rules/restraints.mjs';
import {getReserveReview} from '../rules/reserve-transactions.mjs';
import {conditionNpcProfile,npcSkillConditionContext} from '../rules/npc-conditions.mjs';
import {getBaffledReview} from '../rules/baffled.mjs';
import {isResourceLock} from "../rules/transactions.mjs";
import {pointmanLevel} from "../rules/action-dice.mjs";
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
      feintBonuses: new ArrayField(new ObjectField()),
      feintHistory: new ArrayField(new ObjectField()),
      cheapShots: new ArrayField(new ObjectField()),
      biography: new HTMLField()
    };
  }

  prepareDerivedData() {
    if(this.parent)this.shakenState=shakenStateFromActor(this.parent);
    this.cheapShotActive=cheapShotRecords(this).filter(r=>!r.recovered);this.cheapShotSpeedPenalty=cheapShotSpeedPenalty(this);
    const shaken=shakenRules(this);this.shakenRules=shaken;
    for (const ability of Object.values(this.abilities)) ability.mod = Math.floor((ability.value - 10) / 2);
    for (const [key, save] of Object.entries(this.saves)) {
      const ability = CONFIG.SPYCRAFT.saves[key].ability;
      save.total = save.base + this.abilities[ability].mod + (['ref','will'].includes(key)?shaken.reflexWillPenalty:0);
    }
    this.defense.total = 10 + this.defense.bonus + this.abilities.dex.mod;
    this.initiative.total = this.initiative.bonus + this.abilities.dex.mod + shaken.initiativePenalty;
    this.attack = { melee: cheapShotPenalty(this,'str') + this.bab + this.abilities.str.mod + shaken.attackPenalty, unarmed: cheapShotPenalty(this,'str') + this.bab + this.abilities.str.mod + shaken.attackPenalty, ranged: cheapShotPenalty(this,'dex') + this.bab + this.abilities.dex.mod + shaken.attackPenalty };
    this.skillTotals = {};
    this.warnings = [];
  }
}

export class NpcData extends BaseActorData {
  prepareDerivedData() {
    this.worldTime=globalThis.game?.time?.worldTime;this.usagePeriods=globalThis.game?.settings?.get("spycraft2","usagePeriods")??{};
    this.conditionContext=npcSkillConditionContext(this.parent);
    this.baffledApplicationReview=getBaffledReview(this.parent??{});
    if (!this.npcProfile?.enabled) return super.prepareDerivedData();
    const result = conditionNpcProfile(computeNpcProfile(this.npcProfile, this.npcType, this.threatLevel, this.abilities),this.conditionContext);
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
        classSkill: new BooleanField(), // class-skill override
        classSkillAt: int(1, { min: 1, max: 20 })
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
        careerEntryId: str(),
        vitalityRollId: str(),
        vitalityReviewId: str(),
        /** INT modifier when points were earned; null reconstructs legacy history. */
        intelligenceModifier: new NumberField({ nullable: true, initial: null, integer: true }),
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
      wounds: new SchemaField({ value: int(0) }),
      actionDice: new SchemaField({ value: int(0, { min: 0 }) }),
      fortuneTeammateIds: new ArrayField(new StringField()),
      actionDieAwards: new ObjectField(),
      missionXPRewards: new ObjectField(),
      eagleEyeBoost: new ObjectField({nullable:true,initial:null}),
      sideStanceFeints: new ArrayField(new ObjectField()),
      sideStanceDamageUses: new ArrayField(new ObjectField()),
      attackDamageUses: new ArrayField(new ObjectField()),
      stanceRoundMovement: new ObjectField({nullable:true,initial:null}),
      combatStance: new ObjectField({nullable:true,initial:null}),
      twoWeaponStyle: new ObjectField({nullable:true,initial:null}),
      dartingStyle: new ObjectField({nullable:true,initial:null}),
      totalDefense: new ObjectField({nullable:true,initial:null}),
      combatExpertise: new ObjectField({nullable:true,initial:null}),
      superiorCover: new ObjectField({nullable:true,initial:null}),
      defenseBoost: new ObjectField({nullable:true,initial:null}),
      noFearBoost: new ObjectField({nullable:true,initial:null}),
      attributeDamage: new ObjectField({nullable:true,initial:null}),
      mentalLeaps: new ArrayField(new ObjectField()),
      fatigueRest: new ObjectField({nullable:true,initial:null}),
      drunkSleep: new ObjectField({nullable:true,initial:null}),
      drunkRepositions: new ArrayField(new ObjectField()),
      fatigueApplications: new ArrayField(new ObjectField()),
      mentalLeapFatigueEvents: new ArrayField(new ObjectField()),
      mentalLeapRecovery: new ObjectField({nullable:true,initial:null}),
      mentalLeapSleep: new ObjectField({nullable:true,initial:null}),
      fortunesOfWarBoost: new ObjectField({nullable:true,initial:null}),
      refreshAction: new ObjectField({nullable:true,initial:null}),
      temporaryShares: new ObjectField(),
      assistantGroups: new ArrayField(new ObjectField()),
      accumulatedDamage: new ObjectField({nullable:true,initial:null}),
      resourceUses: new ObjectField(),
      resourcesInitialized: new BooleanField(),
      affiliationType: str("faction", {choices:["faction","freelance"]}),
      analysisTasks: new ObjectField({initial:{}}),
      safeHouses: new ObjectField({initial:{}}),
      careerAgentRewards: new ObjectField({initial:{}}),
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
      skillFortes: new ArrayField(new SchemaField({skill:str(),focus:str(),forte:str()})),
      crossroadsTitle: str(),
      relinquishedInterests: int(0, {min:0}),
      interests: str(),
      contacts: new ArrayField(new SchemaField({ name: str(), rank: int(1, { min: 1, max: 4 }), notes: str(), networkingMilestone:int(0,{min:0}),networkingFeat:str(),networkingTheme:str(),networkingFeatConfirmed:new BooleanField() })),
      subplots: new ArrayField(new SchemaField({ name: str(), notes: str(), complete: new BooleanField() })),
      gearPickLosses: new ObjectField(),
      missionReserves: new ObjectField({nullable:true,initial:null}),
      armorMissionGrant: new ObjectField({nullable:true,initial:null}),
      bigStickMissionPick: new ObjectField({nullable:true,initial:null}),
      missionCaliberPicks: new ObjectField({initial:{}}),
      classGearGrants: new ObjectField({initial:{}}),
      bonusActionDice: new ObjectField({initial:{}}),
      missionReserveHistory: new ArrayField(new ObjectField()),
      wellFundedGrants: new ObjectField({initial:{}}),
      wealthAllocation: new SchemaField({ dressedForLifestyle: new BooleanField({initial:false}), lifestyle: int(0, { min: 0 }), possessions: int(0, { min: 0 }), spendingCash: int(0, { min: 0 }) }),
      misc: new SchemaField(misc),
      feintBonuses: new ArrayField(new ObjectField()),
      feintHistory: new ArrayField(new ObjectField()),
      cheapShots: new ArrayField(new ObjectField()),
      biography: new HTMLField()
    };
  }

  prepareDerivedData() {
    this.actorUuid=this.parent.uuid;
    this.shakenState=shakenStateFromActor(this.parent);
    this.restraintReleaseReview=getRestraintReleaseReview(this.parent);
    this.pendingRestraintMoves=getPendingRestraintMoves(this.parent);
    this.reserveTransactionReview=getReserveReview(this.parent);
    this.baffledApplicationReview=getBaffledReview(this.parent);
    const items = this.parent.items.filter(i=>!isResourceLock(i)).map(i => ({ id: i.id, name: i.name, type: i.type, system: i.system }));
    const combat=this.defenseBoost?.combatId?globalThis.game?.combats?.get?.(this.defenseBoost.combatId):globalThis.game?.combat;
    this.combatContext=combat?{id:combat.id,round:combat.round,started:combat.started}:null;
    const dartingCombat=this.dartingStyle?.combatId?globalThis.game?.combats?.get?.(this.dartingStyle.combatId):this.parent.participatingCombat;
    const dartingOwn=dartingCombat?.turns?.find(c=>c.actor?.uuid===this.parent.uuid&&(!this.dartingStyle?.combatantId||c.id===this.dartingStyle.combatantId));
    this.dartingCombatContext=dartingCombat?{id:dartingCombat.id,started:dartingCombat.started,round:dartingCombat.round,turn:dartingCombat.turn,combatantId:dartingOwn?.id,ownTurnIndex:dartingCombat.turns?.findIndex(c=>c.id===dartingOwn?.id)??-1}:null;
    const twoWeaponCombat=this.twoWeaponStyle?.combatId?globalThis.game?.combats?.get?.(this.twoWeaponStyle.combatId):this.parent.participatingCombat;
    const twoWeaponOwn=twoWeaponCombat?.turns?.find(c=>c.actor?.uuid===this.parent.uuid&&(!this.twoWeaponStyle?.combatantId||c.id===this.twoWeaponStyle.combatantId));
    this.twoWeaponCombatContext=twoWeaponCombat?{id:twoWeaponCombat.id,started:twoWeaponCombat.started,round:twoWeaponCombat.round,turn:twoWeaponCombat.turn,combatantId:twoWeaponOwn?.id,ownTurnIndex:twoWeaponCombat.turns?.findIndex(c=>c.id===twoWeaponOwn?.id)??-1}:null;
    const totalDefenseCombat=this.totalDefense?.combatId?globalThis.game?.combats?.get?.(this.totalDefense.combatId):this.parent.participatingCombat;
    const totalDefenseOwn=totalDefenseCombat?.turns?.find(c=>c.actor?.uuid===this.parent.uuid&&(!this.totalDefense?.combatantId||c.id===this.totalDefense.combatantId));
    this.totalDefenseCombatContext=totalDefenseCombat?{id:totalDefenseCombat.id,started:totalDefenseCombat.started,round:totalDefenseCombat.round,turn:totalDefenseCombat.turn,combatantId:totalDefenseOwn?.id,ownTurnIndex:totalDefenseCombat.turns?.findIndex(c=>c.id===totalDefenseOwn?.id)??-1}:null;
    const superiorCombat=this.superiorCover?.combatId?globalThis.game?.combats?.get?.(this.superiorCover.combatId):this.parent.participatingCombat;
    const superiorOwn=superiorCombat?.turns?.find(c=>c.actor?.uuid===this.parent.uuid&&(!this.superiorCover?.combatantId||c.id===this.superiorCover.combatantId));
    this.superiorCoverCombatContext=superiorCombat?{id:superiorCombat.id,started:superiorCombat.started,round:superiorCombat.round,turn:superiorCombat.turn,combatantId:superiorOwn?.id,ownTurnIndex:superiorCombat.turns?.findIndex(c=>c.id===superiorOwn?.id)??-1}:null;
    const expertiseCombat=this.combatExpertise?.combatId?globalThis.game?.combats?.get?.(this.combatExpertise.combatId):this.parent.participatingCombat;
    const expertiseOwn=expertiseCombat?.turns?.find(c=>c.actor?.uuid===this.parent.uuid&&(!this.combatExpertise?.combatantId||c.id===this.combatExpertise.combatantId));
    this.expertiseCombatContext=expertiseCombat?{id:expertiseCombat.id,started:expertiseCombat.started,round:expertiseCombat.round,turn:expertiseCombat.turn,combatantId:expertiseOwn?.id,ownTurnIndex:expertiseCombat.turns?.findIndex(c=>c.id===expertiseOwn?.id)??-1}:null;
    const warCombat=this.fortunesOfWarBoost?.combatId?globalThis.game?.combats?.get?.(this.fortunesOfWarBoost.combatId):this.parent.participatingCombat;
    const own=warCombat?.turns?.find(c=>this.fortunesOfWarBoost?.combatantId?c.id===this.fortunesOfWarBoost.combatantId:c.actor?.uuid===this.parent.uuid);
    this.fortunesCombatContext=warCombat?{id:warCombat.id,round:warCombat.round,started:warCombat.started,turn:warCombat.turn,combatantId:own?.id,ownTurnIndex:warCombat.turns?.findIndex(c=>c.id===own?.id)??-1}:null;
    const fearCombat=this.noFearBoost?.combatId?globalThis.game?.combats?.get?.(this.noFearBoost.combatId):this.parent.participatingCombat;
    const fearOwn=fearCombat?.turns?.find(c=>c.actor?.uuid===this.parent.uuid&&(!this.noFearBoost?.combatantId||c.id===this.noFearBoost.combatantId));
    this.noFearCombatContext=fearCombat?{id:fearCombat.id,round:fearCombat.round,started:fearCombat.started,turn:fearCombat.turn,combatantId:fearOwn?.id,ownTurnIndex:fearCombat.turns?.findIndex(c=>c.id===fearOwn?.id)??-1}:null;
    this.actionDieAwardReview=this.parent.flags?.spycraft2?.actionDieAwardReview??null;
    this.actionDiceSettlementReview=getActionDieSettlementReview(this.parent);
    this.worldTime=globalThis.game?.time?.worldTime;
    const statuses=this.parent.statuses??new Set();
    this.conditionContext=Object.fromEntries(Object.entries({nauseated:['nauseated'],dazed:['dazed'],stunned:['stunned','stun'],dead:['dead'],paralyzed:['paralyzed','paralysis'],fatigued:['fatigued'],exhausted:['exhausted'],unconscious:['unconscious'],helpless:['helpless'],vulnerable:['vulnerable'],sickened:['sickened'],drunk:['drunk'],crouched:['crouched','crouching'],mute:['mute'],baffled:['baffled'],incompetent:['incompetent'],entangled:['entangled'],bound:['bound'],blinded:['blinded','blind'],deafened:['deafened','deaf'],flatFooted:['flat-footed','flatFooted'],sprawled:['sprawled'],prone:['prone'],held:['held'],pinned:['pinned'],sleeping:['sleeping','sleep','asleep']}).map(([key,ids])=>[key,ids.some(id=>statuses.has(id))]));
    this.bonusPoolChecks={};for(const pool of Object.values(this.bonusActionDice??{})){if(!pool?.messageUuid)continue;const m=globalThis.game?.messages?.get?.(String(pool.messageUuid).split('.').at(-1));if(m)this.bonusPoolChecks[pool.messageUuid]={uuid:m.uuid,flags:{spycraft2:m.flags?.spycraft2}};}
    this.bonusPoolCombats=Object.fromEntries([...(globalThis.game?.combats??[])].map(c=>[c.id,{id:c.id,started:c.started,round:c.round}]));
    this.mentalLeapCombats={};
    for(const record of this.mentalLeaps??[]){if(!record.combatId||this.mentalLeapCombats[record.combatId])continue;const combat=globalThis.game?.combats?.get?.(record.combatId),own=combat?.turns?.find(c=>c.id===record.combatantId&&c.actor?.uuid===this.parent.uuid);if(combat&&own)this.mentalLeapCombats[record.combatId]={id:combat.id,started:combat.started,round:combat.round,turn:combat.turn,combatantId:own.id,ownTurnIndex:combat.turns.findIndex(c=>c.id===own.id)};}
    this.usagePeriods=globalThis.game?.settings?.get("spycraft2","usagePeriods")??{};
    this.fortuneTeammates=[...new Set(this.fortuneTeammateIds??[])].filter(id=>id!==this.parent.id).map(id=>{const actor=globalThis.game?.actors?.get?.(id);return {id,name:actor?.name??'Missing teammate',level:pointmanLevel(actor)};});
    computeAgent(this, items, CONFIG.SPYCRAFT);
  }

  /** Data exposed to roll formulas (@level, @abilities.dex.mod, @skills.sneak.total …). */
  getRollData() {
    const data = { ...this.rollDataExtras };
    data.skills = Object.fromEntries(Object.entries(this.skillTotals ?? {}).map(([k, v]) => [k, { ranks: v.ranks, total: v.total }]));
    data.saves = Object.fromEntries(Object.entries(this.saves ?? {}).map(([k, v]) => [k, { ...v }]));
    data.knowledge = this.knowledge;
    data.defense = this.defense?.total;
    data.initiative = this.initiative;
    data.bab = this.bab;
    return data;
  }
}
