/**
 * A character in a started combat (round 3) who can take free final attacks through the real Actor methods:
 * useLimitedAbility, rollAttack and rollDamage. Posted checks land in `messages` (also game.messages).
 */
import "./fatigue-actor.mjs"; // sets up the Foundry stand-ins the Actor document needs; keep it first
import { clock, sword, prep } from "./feint.mjs";
import { weaponAttack } from "../../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../../module/config.mjs";
import { SpycraftActor } from "../../module/documents/actor.mjs";
import { limitedUseAbilities } from "../../module/rules/limited-uses.mjs";

export function finalAttackActor(feats = []) {
  let seq = 0;
  foundry.utils.escapeHTML = String;
  foundry.utils.randomID = () => "final" + ++seq;
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  game.user = { id: "gc", isGM: true };
  const messages = [];
  messages.get = id => messages.find(m => m.id === id);
  game.messages = messages;
  globalThis.fromUuidSync = id => messages.find(m => m.uuid === id) ?? a.items.find(i => i.uuid === id) ?? null;
  const w = sword({ qualities: "", damage: "1d6" }),
    a = {
      uuid: "Actor.feint",
      type: "agent",
      isOwner: true,
      flags: {},
      system: {
        size: "Medium",
        bab: 6,
        activeFeatNames: feats,
        classLevels: {},
        abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
        proficiencyTotals: { edged: { proficient: true } },
        conditionContext: {},
        wounds: { value: 4 },
        vitality: { value: 4 },
        actionDice: { value: 0 },
        resourceUses: {}
      },
      items: [w],
      usagePeriods: { round: "Combat.feint:3", combat: "Combat.feint", scene: "scene" },
      async update(patch) {
        for (const [path, value] of Object.entries(patch)) {
          const keys = path.split(".");
          let o = this;
          for (const key of keys.slice(0, -1)) o = o[key] ??= {};
          o[keys.at(-1)] = structuredClone(value);
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
  a.mentalLeapCombatContext = () => ({ ...clock() });
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.actionDiceFundingSystem = a.system;
  a.getRollData = () => ({});
  a.weaponContext = () => ({});
  a.weaponAttack = (item, o = {}) =>
    weaponAttack(prep(a.system, a.items), { ...item.system, id: item.id }, cfg, "agent", o);
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.rollAttack = (item, o) => SpycraftActor.prototype.rollAttack.call(a, item, o);
  a.rollDamage = (item, o) => SpycraftActor.prototype.rollDamage.call(a, item, o);
  a.rollCheck = async (formula, data, opts) => {
    await opts.validateFinalAttack?.();
    const m = {
      id: "posted" + ++seq,
      uuid: "ChatMessage.posted" + seq,
      flags: { spycraft2: { ...opts, formula, actorUuid: a.uuid } }
    };
    messages.push(m);
    return m;
  };
  return { a, w, messages };
}
