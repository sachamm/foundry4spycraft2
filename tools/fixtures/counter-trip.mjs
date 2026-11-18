import { makeFatigueActor } from "./fatigue-actor.mjs";
import { sword, prep } from "./feint.mjs";
import { tripAttackPlan, tripAttackSkillChecks } from "../../module/rules/trip-attack.mjs";
import { tripDefensePlan, tripDefenseSkillChecks } from "../../module/rules/trip.mjs";
import { settleTripOutcome } from "../../module/apps/trip-outcomes.mjs";
export const controls = { natural: 10, draws: 0, hook: async () => {}, post: "normal" };
let sequence = 0;
foundry.utils.escapeHTML = String;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
ui.notifications.warn = () => null;
for (const id of ["sprawled", "flat-footed"])
  if (!CONFIG.statusEffects.some(x => x.id === id)) CONFIG.statusEffects.push({ id, name: id });
export function receipt(id, c) {
  return {
    id,
    uuid: "ChatMessage." + id,
    flags: { spycraft2: c },
    async update(p) {
      for (const [k, v] of Object.entries(p)) this.flags.spycraft2[k.split(".").at(-1)] = structuredClone(v);
      return this;
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope][key];
    }
  };
}
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = controls.natural + (data.total ?? 0);
    this.dice = [{ total: controls.natural }];
  }
  async evaluate() {
    controls.draws++;
    await controls.hook();
    return this;
  }
  async toMessage(data) {
    if (controls.post === "before") throw Error("before post");
    const m = receipt("counterRoll" + ++sequence, data.flags.spycraft2);
    game.messages.push(m);
    if (controls.post === "after") throw Error("after post");
    return m;
  }
};
globalThis.fromUuidSync = id => [...(game.messages ?? []), ...(game.actors ?? [])].find(x => x.uuid === id) ?? null;
globalThis.fromUuid = async id => fromUuidSync(id);
export async function fixture(kind = "success") {
  controls.natural = 10;
  controls.draws = 0;
  controls.hook = async () => {};
  controls.post = "normal";
  game.user = { id: "GC", isGM: true };
  game.settings.get = () => false;
  const a = makeFatigueActor(),
    d = makeFatigueActor(),
    combat = { id: "Combat.counter", started: true, round: 3, turn: 0 };
  combat.turns = [
    { id: "original", actor: a },
    { id: "counter", actor: d }
  ];
  combat.combatants = combat.turns;
  for (const [x, id, name, family, feat] of [
    [a, "Actor.original", "Original attacker", "twoHandedSword", "Great Sword Basics"],
    [d, "Actor.counter", "Countering defender", "spear", "Spear Basics"]
  ]) {
    x.uuid = id;
    x.name = name;
    x.flags = {};
    x.raw.proficiencies = { exoticEdged: { proficient: true } };
    const w = sword({
      meleeFamily: family,
      proficiency: "exoticEdged",
      qualities: "",
      damage: "1d6",
      sizeHands: "S/2h",
      useHands: 2
    });
    w.uuid = id + ".Item.sword";
    x.items.push(w);
    x.items.get = id => x.items.find(i => i.id === id);
    const derive = x.derive;
    x.derive = () => {
      derive();
      x.system = prep(
        {
          ...x.system,
          size: "Medium",
          activeFeatNames: [feat],
          conditionContext: {
            ...x.system.conditionContext,
            flatFooted: x.statuses.has("flat-footed"),
            sprawled: x.statuses.has("sprawled")
          }
        },
        x.items
      );
    };
    x.derive();
    x.mentalLeapCombatContext = () => ({
      id: combat.id,
      started: true,
      round: combat.round,
      turn: combat.turn,
      combatantId: combat.turns.find(c => c.actor === x).id,
      ownTurnIndex: combat.turns.findIndex(c => c.actor === x)
    });
    Object.defineProperty(x, "participatingCombat", { get: () => combat });
    Object.defineProperty(x, "usagePeriods", {
      get: () => ({ round: "Combat.counter:" + combat.round, combat: combat.id, session: "session", scene: "scene" })
    });
    const update = x.update;
    x.update = async patch => {
      for (const [path, v] of Object.entries(patch)) {
        if (path.startsWith("system.resourceUses.")) {
          const key = path.slice("system.resourceUses.".length);
          x.raw.resourceUses ??= {};
          if (key.startsWith("-=")) delete x.raw.resourceUses[key.slice(2)];
          else x.raw.resourceUses[key] = structuredClone(v);
        }
        if (path === "system.combatStance") x.raw.combatStance = structuredClone(v);
      }
      return update(patch);
    };
  }
  game.actors = [a, d];
  game.combats = [combat];
  game.combat = combat;
  game.messages = [];
  game.messages.get = id => game.messages.find(m => m.id === id);
  const p = tripAttackPlan(a.system, "acrobatics", tripAttackSkillChecks("acrobatics")[0], {
      tripAttackOpponentUuid: d.uuid,
      tripAttackOpponentName: d.name,
      tripAttackOpponentSize: "Medium",
      tripAttackAdjacent: true,
      tripAttackParticipantsConfirmed: true,
      tripAttackHalfActionConfirmed: true,
      tripAttackSizeDifference: 0,
      tripAttackCombat: a.mentalLeapCombatContext()
    }).evidence,
    q = tripDefensePlan(d.system, "acrobatics", tripDefenseSkillChecks("acrobatics")[0], {
      tripOpponentUuid: a.uuid,
      tripOpponentName: a.name,
      tripOpponentSize: "Medium",
      tripAdjacent: true,
      tripIncomingConfirmed: true,
      tripSizeDifference: 0,
      tripDefenseCombat: d.mentalLeapCombatContext()
    }).evidence,
    base = { checkKind: "skill", skillKey: "acrobatics", checkMethod: "roll", resolved: true, rollData: { total: 2 } },
    am = receipt("parentAttack", {
      ...base,
      actorUuid: a.uuid,
      checkId: "trip",
      successConfirmed: false,
      tripAttack: p,
      effectiveTotal: 10,
      ...(kind === "failure" || kind === "both" ? { criticalFailure: true } : {})
    }),
    dm = receipt("parentDefense", {
      ...base,
      actorUuid: d.uuid,
      checkId: "resist-trip",
      successConfirmed: true,
      tripDefense: q,
      effectiveTotal: 20,
      ...(kind === "success" || kind === "both" ? { criticalSuccess: true } : {})
    });
  game.messages.push(am, dm);
  await settleTripOutcome(a, am, dm, { opposedConfirmed: true });
  return { a, d, am, dm, combat };
}
export const request = patch => ({
  sourceMessage: "ChatMessage.parentDefense",
  immediateConfirmed: true,
  tripAttackSizeDifference: 0,
  tripAttackAdjacent: true,
  tripAttackParticipantsConfirmed: true,
  ...patch
});
export async function finishPair(f, m, { won = true, critical = "" } = {}) {
  const x = m.flags.spycraft2;
  Object.assign(x, { resolved: true, successConfirmed: won, effectiveTotal: won ? 20 : 10 });
  if (critical === "success") x.criticalSuccess = true;
  if (critical === "failure") x.criticalFailure = true;
  const q = tripDefensePlan(f.a.system, "acrobatics", tripDefenseSkillChecks("acrobatics")[0], {
      tripOpponentUuid: f.d.uuid,
      tripOpponentName: f.d.name,
      tripOpponentSize: "Medium",
      tripAdjacent: true,
      tripIncomingConfirmed: true,
      tripSizeDifference: 0,
      tripDefenseCombat: f.a.mentalLeapCombatContext()
    }).evidence,
    dm = receipt("counterDefense", {
      actorUuid: f.a.uuid,
      checkKind: "skill",
      skillKey: "acrobatics",
      checkId: "resist-trip",
      checkMethod: "roll",
      resolved: true,
      successConfirmed: !won,
      effectiveTotal: won ? 10 : 20,
      rollData: { total: 2 },
      tripDefense: q
    });
  game.messages.push(dm);
  return dm;
}
