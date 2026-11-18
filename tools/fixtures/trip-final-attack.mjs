import "./fatigue-actor.mjs"; // sets up the Foundry stand-ins the Actor document needs; keep it first
import { clock, sword, prep } from "./feint.mjs";
import { weaponAttack } from "../../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../../module/config.mjs";
import { SpycraftActor } from "../../module/documents/actor.mjs";
import { limitedUseAbilities } from "../../module/rules/limited-uses.mjs";
import { tripAttackPlan, tripAttackSkillChecks } from "../../module/rules/trip-attack.mjs";
import { tripDefensePlan, tripDefenseSkillChecks } from "../../module/rules/trip.mjs";
import { tripOutcomePlan } from "../../module/rules/trip-outcomes.mjs";
import { rollEvidence } from "../../module/rules/outcomes.mjs";
import { validateTripFinalAttackProof } from "../../module/apps/trip-final-attack.mjs";
let seq = 0;
foundry.utils.escapeHTML = String;
foundry.utils.randomID = () => "tripFinal" + ++seq;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
ui.notifications.warn = () => null;
const flail = () => ({
    ...sword({ meleeFamily: "flail", proficiency: "exoticBlunt", qualities: "" }),
    name: "Actual flail"
  }),
  state = () => ({
    size: "Medium",
    bab: 3,
    activeFeatNames: [],
    classLevels: {},
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
    proficiencyTotals: { exoticBlunt: { proficient: true }, edged: { proficient: true } },
    conditionContext: {},
    wounds: { value: 4 },
    vitality: { value: 4 },
    actionDice: { value: 0 }
  });
globalThis.fromUuidSync = id => [...(game.messages ?? []), ...(game.actors ?? [])].find(x => x.uuid === id) ?? null;
globalThis.fromUuid = async id => fromUuidSync(id);
export function actor() {
  const trick = "doubleTwirl";
  game.user = { id: "gc", isGM: true };
  const w = trick === "doubleTwirl" ? flail() : sword(),
    a = {
      uuid: "Actor.feint",
      type: "agent",
      isOwner: true,
      flags: {},
      system: { ...state(), resourceUses: {} },
      items: [w],
      usagePeriods: { round: "Combat.feint:3", combat: "Combat.feint", scene: "scene" },
      async update(patch) {
        for (const [path, value] of Object.entries(patch)) {
          const keys = path.split(".");
          let o = this;
          for (const key of keys.slice(0, -1)) o = o[key] ??= {};
          const key = keys.at(-1);
          if (key.startsWith("-=")) delete o[key.slice(2)];
          else o[key] = structuredClone(value);
        }
      }
    };
  a.items.get = id => a.items.find(i => i.id === id);
  a.participatingCombat = {
    id: clock().id,
    started: true,
    round: 3,
    turn: 0,
    turns: [{ id: clock().combatantId, actor: a }]
  };
  a.mentalLeapCombatContext = () => ({
    ...clock(),
    round: a.participatingCombat.round,
    turn: a.participatingCombat.turn
  });
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.actionDiceFundingSystem = a.system;
  a.weaponAttack = (w, o = {}) =>
    weaponAttack(prep(a.system, a.items), { ...w.system, id: w.id }, cfg, "agent", {
      ...o,
      cheapShotCombat: a.mentalLeapCombatContext()
    });
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.rollAttack = (w, o) => SpycraftActor.prototype.rollAttack.call(a, w, o);
  a.rollCheck = async (formula, data, opts) => {
    validateTripFinalAttackProof(a, opts.finalAttack, {
      checkKind: opts.checkKind,
      weaponUuid: opts.weaponUuid,
      attackContext: opts.attackContext,
      lease: opts.tripFinalLease,
      rerollOf: opts.rerollOf
    });
    await opts.validateFinalAttack?.();
    await a.drawHook?.();
    await opts.validateFinalAttack?.();
    if (a.cancel) return null;
    if (a.postError === "before") throw Error("unposted");
    const m = {
      id: "posted" + ++seq,
      uuid: "ChatMessage.posted" + seq,
      flags: { spycraft2: { ...opts, actorUuid: a.uuid, rollData: data } }
    };
    game.messages.push(m);
    if (a.postError === "after") throw Error("posted");
    return m;
  };
  const p = tripAttackPlan(a.system, "acrobatics", tripAttackSkillChecks("acrobatics")[0], {
      tripAttackOpponentName: "Actual opponent",
      tripAttackOpponentUuid: "Actor.opponent",
      tripAttackOpponentSize: "Medium",
      tripAttackAdjacent: true,
      tripAttackSizeDifference: 0,
      tripAttackParticipantsConfirmed: true,
      tripAttackHalfActionConfirmed: true,
      tripAttackCombat: clock()
    }).evidence,
    q = tripDefensePlan(a.system, "acrobatics", tripDefenseSkillChecks("acrobatics")[0], {
      tripOpponentName: "Attacker",
      tripOpponentUuid: a.uuid,
      tripOpponentSize: "Medium",
      tripAdjacent: true,
      tripSizeDifference: 0,
      tripIncomingConfirmed: true,
      tripDefenseCombat: { ...clock(), combatantId: "defender", ownTurnIndex: 1 }
    }).evidence,
    base = { checkKind: "skill", skillKey: "acrobatics", resolved: true, checkMethod: "roll", rollData: { total: 2 } },
    x = {
      ...base,
      actorUuid: a.uuid,
      checkId: "trip",
      tripAttack: p,
      successConfirmed: true,
      criticalSuccess: true,
      effectiveTotal: 22,
      naturalDie: 20,
      rawTotal: 79123
    },
    y = {
      ...base,
      actorUuid: "Actor.opponent",
      checkId: "resist-trip",
      tripDefense: q,
      successConfirmed: false,
      effectiveTotal: 12,
      naturalDie: 10
    };
  const make = (id, c) => ({
      id,
      uuid: "ChatMessage." + id,
      flags: { spycraft2: c },
      async update(patch) {
        for (const [k, v] of Object.entries(patch)) this.flags.spycraft2[k.split(".").at(-1)] = structuredClone(v);
        return this;
      },
      async unsetFlag(scope, key) {
        delete this.flags[scope][key];
      }
    }),
    am = make("source", x),
    dm = make("defense", y),
    plan = tripOutcomePlan(x, y, {
      attackerUuid: a.uuid,
      defenderUuid: "Actor.opponent",
      combat: clock(),
      allowCriticalAttackerWin: true
    }),
    settlement = {
      ...plan,
      state: "applied",
      operationId: "tripOperation",
      sourceMessage: am.uuid,
      defenderMessage: dm.uuid,
      sourceEvidence: [x, y].map(c => JSON.parse(rollEvidence(c))),
      wasCondition: false
    };
  x.tripSettlement = structuredClone(settlement);
  y.tripSettlement = structuredClone(settlement);
  game.messages = [am, dm];
  game.messages.get = id => game.messages.find(m => m.id === id);
  game.actors = [
    a,
    {
      uuid: "Actor.opponent",
      type: "npc",
      isOwner: true,
      name: "Actual opponent",
      system: { size: "Medium", npcType: "standard" }
    }
  ];
  game.combats = [];
  return a;
}
