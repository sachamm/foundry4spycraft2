/**
 * Uses for GC action dice (pp.397–399, 424, 452) and what each costs.
 * The pool itself is managed by module/services/gc-dice.mjs.
 */
import { GC_DATA } from "../gc-tables.mjs";
import { loc } from "../../i18n.mjs";

const G = GC_DATA.core.gcDice;
export const GC_SPENDS = G.spends;
const whole = (value, min = 0) => Number.isSafeInteger(value) && value >= min;

/** Facts the spend rules need from an NPC: type, villain role, story-critical grades and critical-enabling qualities. */
export function npcSpendProfile({ type = "standard", qualities = [], promoted = false } = {}) {
  const ids = qualities.map(quality => quality.id);
  const units = id =>
    qualities.filter(quality => quality.id === id).reduce((sum, quality) => sum + (quality.units ?? 1), 0);
  const role = ["mastermind", "henchman", "minion"].find(id => ids.includes(id)) ?? "none";
  const base = type === "villain" ? "special" : type;
  return {
    type: promoted && base === "standard" ? "special" : base,
    baseType: base,
    promoted: !!promoted,
    role,
    storyCritical: units("story-critical"),
    prodigy: ids.includes("prodigy"),
    treacherous: ids.includes("treacherous"),
    tough: units("tough")
  };
}

/** p.452: d4, or d6 minion / d8 henchman / d10 mastermind; each story-critical grade raises it one type (maximum d12). */
export function gcDieType(profile) {
  const start = G.dieSteps.indexOf(G.dieByRole[profile?.role ?? "none"] ?? G.dieByRole.none);
  return G.dieSteps[Math.min(G.dieSteps.length - 1, start + Math.max(0, profile?.storyCritical ?? 0))];
}

/**
 * Check one spend and return its cost and the die to roll (null when nothing is rolled).
 * context: {npc: npcSpendProfile, dramatic, dice (for variable costs), checkKind: 'attack'|'skill',
 *           alreadyBoostedDC, eventCost, triggered, qualityCost, lastScene}
 */
export function planSpend(id, context = {}) {
  const spend = G.spends.find(entry => entry.id === id);
  if (!spend) throw new Error(loc`Unknown GC action die use.`);
  const { npc = null, dramatic = false } = context;
  if (spend.needsNpc && !npc) throw new Error(loc`Choose the NPC this applies to.`);
  if (spend.dramaticOnly && !dramatic)
    throw new Error(loc`This use is only available during a dramatic scene (p.424).`);
  let cost = spend.cost,
    die = spend.rolls === "d12" ? G.dcBoostDie : spend.rolls === "npc" ? gcDieType(npc) : null,
    notes = [];
  switch (id) {
    case "boostDC": {
      const limit = dramatic ? G.dramaticDcBoostLimit : G.dcBoostLimit;
      if ((context.alreadyBoostedDC ?? 0) >= limit)
        throw new Error(
          loc`Only ${limit} action di${limit === 1 ? "e" : "ce"} may boost one DC ${dramatic ? loc` in a dramatic scene` : ""}.`
        );
      break;
    }
    case "activateThreat": {
      const kind = context.checkKind === "attack" ? "attack" : "skill";
      // p.452: a standard NPC's criticals cannot be activated without treacherous (attacks) or prodigy (skills).
      if (npc.type !== "special" && !(kind === "attack" ? npc.treacherous : npc.prodigy))
        throw new Error(
          loc`A standard NPC needs the ${kind === "attack" ? "treacherous" : "prodigy"} quality before the GC may activate its ${kind === "attack" ? loc`critical hits` : loc`critical successes`} (p.452).`
        );
      cost = whole(context.dice, 1) ? context.dice : 1;
      break;
    }
    case "activateError":
      cost = whole(context.dice, 1) ? context.dice : 1;
      break;
    case "promote":
      if (npc.baseType !== "standard" || npc.promoted)
        throw new Error(loc`Only a standard NPC that is not already promoted can be promoted.`);
      notes.push(
        loc`Special for the rest of the mission; if defeated, XP is 300 per scene as a ‘full’ special NPC (p.452).`
      );
      break;
    case "saveNpc":
      if (npc.type !== "special") throw new Error(loc`Only a special NPC can be saved from death or capture.`);
      if (dramatic && context.fromDeath !== false)
        throw new Error(loc`A character who dies in a dramatic scene cannot be saved (p.424).`);
      cost = Math.max(0, spend.cost - (G.saveDiscount[npc.role] ?? 0));
      notes.push(loc`XP is awarded as if the NPC were defeated; the NPC may not return this mission.`);
      break;
    case "campaignQuality":
      if (!whole(context.qualityCost, 1))
        throw new Error(loc`This campaign quality lists no die cost, so it cannot be bought mid-mission.`);
      cost = context.qualityCost;
      notes.push(loc`Stays for the rest of the mission; XP reward unchanged.`);
      break;
    case "dramaticScene":
      if (dramatic) throw new Error(loc`The current scene is already dramatic.`);
      notes.push(loc`Does not change the mission XP reward.`);
      break;
    case "event": {
      if (context.free) {
        cost = 0;
        break;
      } // prompted by a Subplot or another rule
      if (!whole(context.eventCost, 1) || context.eventCost > 4)
        throw new Error(loc`Choose an event intensity from 1 to 4 dice.`);
      cost = Math.max(0, context.eventCost - (context.triggered ? 1 : 0));
      break;
    }
    case "knowsNothing":
      if (npc.role === "mastermind") throw new Error(loc`A mastermind always knows something valuable.`);
      cost = npc.type === "special" || npc.role === "henchman" ? 2 : 1;
      break;
    case "terminalSituation":
      if (context.inCombat) throw new Error(loc`A Terminal Situation can only be declared outside combat (p.350).`);
      notes.push(
        loc`The victim has no way out and an opponent can see them: set unconscious, or wounds to −9, on the sheet.`
      );
      break;
    case "healNpc":
      notes.push(
        npc.type === "special"
          ? loc`Restores vitality equal to the die result, or 2 wounds.`
          : loc`Reduces accumulated damage by the die result.`
      );
      if (context.inCombat) notes.push(loc`In combat this needs a Refresh action and only 1 die.`);
      break;
    case "boostDefense":
      notes.push(loc`+2 Defense; rounds = die result; only one such boost at once.`);
      break;
    default:
  }
  return { id, label: spend.label, cost, die, explodeLow: !!dramatic && die !== null, notes, page: spend.page };
}

/**
 * Total of one exploding action die given the natural results in order.
 * A dramatic scene makes GC dice explode on the lowest result as well as the highest (p.424).
 */
export function actionDieTotal(faces, rolls, { explodeLow = false } = {}) {
  let total = 0,
    used = 0;
  for (const roll of rolls) {
    if (!whole(roll, 1) || roll > faces) throw new Error(loc`Invalid action die result.`);
    total += roll;
    used += 1;
    if (!(roll === faces || (explodeLow && roll === 1))) return { total, used, complete: true };
  }
  return { total, used, complete: false };
}
