/**
 * Unarmed Combat feat tricks that ride an unarmed Standard Attack (or a Kick), pp.185–189. Each changes the attack
 * check or threat range and, where it has one, states its effect on a hit or threat: a save at DC 10 + the damage, or
 * a condition. The effect is posted from the hit’s damage roll for the GC to apply. Tricks of these feats that ride a
 * Trip, Feint or grapple instead are left to the feats’ roll reminders.
 *
 * Also here: Dirty Fighting Basics’ Ready Stance and the halving of sneak attack damage its owner suffers.
 */
import { combatStanceState } from "./combat-stance.mjs";
import { unarmedWeapon } from "./kick.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

/** action: "standard" (an unarmed Standard Attack) or "either" (a Kick or an unarmed Standard Attack). */
export const UNARMED_TRICKS = Object.freeze({
  clothesline: { feat: "Wrestling Moves", name: "Clothesline", action: "standard", qualities: "TKD", page: 189 },
  circle: { feat: "Rolling Moves", name: "Circle", action: "either", page: 187 },
  leap: { feat: "Rolling Moves", name: "Leap", action: "either", page: 187 },
  sway: { feat: "Rolling Moves", name: "Sway", action: "either", page: 187 },
  lowBlow: {
    feat: "Dirty Fighting Basics",
    name: "Low Blow",
    action: "standard",
    hitSave: ["Fortitude", "sickened for 1d4 rounds"],
    page: 185
  },
  eyeGouge: {
    feat: "Dirty Fighting Moves",
    name: "Eye Gouge",
    action: "standard",
    hitSave: ["Reflex", "blinded for 1d4 rounds"],
    page: 185
  },
  rabbitPunch: {
    feat: "Dirty Fighting Moves",
    name: "Rabbit Punch",
    action: "standard",
    attack: -4,
    threat: 1,
    onThreat: "nauseated for 1 round",
    page: 185
  },
  haymaker: {
    feat: "Brawling Moves",
    name: "Haymaker",
    action: "standard",
    hitSave: ["Fortitude", "nauseated for 1 round"],
    page: 185
  },
  nerveJam: {
    feat: "Vital Points Moves",
    name: "Nerve Jam",
    action: "standard",
    attack: -4,
    threat: 1,
    onThreat: "stunned for 1 full round",
    page: 188
  },
  oneFinger: {
    feat: "Vital Points Moves",
    name: "One Finger",
    action: "standard",
    attack: -4,
    threat: 4,
    flatFooted: true,
    page: 188
  },
  spike: { feat: "Vital Points Moves", name: "Spike", action: "standard", threat: 1, page: 188 }
});

const NOTES = {
  clothesline: () => loc`Clothesline: this attack has takedown, with its Fortitude save DC 4 higher`,
  circle: () => loc`Circle: on a hit, move to any unoccupied square adjacent to the opponent`,
  leap: () =>
    loc`Leap: before this attack, move up to your Speed, passing freely through squares adjacent to or occupied by opponents`,
  sway: () => loc`Sway: on a hit, +1 dodge bonus to Defense against the target’s attacks for 1 full round`,
  oneFinger: () => loc`One Finger: only against a flat-footed opponent`,
  spike: () => loc`Spike: threat range +1`
};

export function unarmedTrickPlan(
  system,
  weapon,
  { trick = "", kick = false, attackAction = "standard", flatFootedTarget = false } = {}
) {
  if (!trick) return null;
  const d = Object.hasOwn(UNARMED_TRICKS, trick) ? UNARMED_TRICKS[trick] : null;
  if (!d || !system?.activeFeatNames?.includes(d.feat))
    return { blocked: true, reason: loc`That trick needs its feat.` };
  if (!unarmedWeapon(weapon)) return { blocked: true, reason: loc`${d.name} is an unarmed attack.` };
  const legal =
    d.action === "either" ? kick === true || attackAction === "standard" : kick !== true && attackAction === "standard";
  if (!legal)
    return {
      blocked: true,
      reason:
        d.action === "either"
          ? loc`${d.name} is made with a Kick or an unarmed Standard Attack.`
          : loc`${d.name} is made with an unarmed Standard Attack.`
    };
  if (d.flatFooted && flatFootedTarget !== true)
    return { blocked: true, reason: loc`${d.name} is made against a flat-footed opponent.` };
  return {
    blocked: false,
    version: 1,
    key: trick,
    name: d.name,
    attackBonus: d.attack ?? 0,
    threatIncrease: d.threat ?? 0,
    ...(d.qualities ? { qualities: d.qualities } : {})
  };
}

/** The card’s line for the trick on the attack. */
export function unarmedTrickNote(plan) {
  const d = UNARMED_TRICKS[plan?.key];
  if (!d) return "";
  const parts = [
    ...(d.attack ? [loc`${d.name}: attack ${d.attack}`] : []),
    ...(d.threat && !NOTES[plan.key] ? [loc`threat range +${d.threat}`] : []),
    ...(d.hitSave
      ? [
          loc`${d.name}: on a hit the target makes a ${d.hitSave[0]} save (DC 10 + damage) or is ${d.hitSave[1]}; roll the damage from this card`
        ]
      : []),
    ...(d.onThreat ? [loc`on a threat or critical hit the target is ${d.onThreat}`] : []),
    ...(NOTES[plan.key] ? [NOTES[plan.key]()] : [])
  ];
  return `${parts.join("; ")} (p.${d.page}).`;
}

/** The damage card’s line for a trick with a save on a hit. */
export function unarmedTrickDamageNote(trick, damage) {
  const d = UNARMED_TRICKS[trick];
  return d?.hitSave
    ? loc`${d.name}: the target makes a ${d.hitSave[0]} save, DC ${10 + damage}, or is ${d.hitSave[1]} (p.${d.page}).`
    : "";
}

/** Dirty Fighting Basics: sneak attack damage its owner suffers is halved, rounded up. */
export const halvesSneakDamage = targetSystem =>
  targetSystem?.activeFeatNames?.includes("Dirty Fighting Basics") === true;

export const inReadyStance = system => combatStanceState(system ?? {})?.key === "ready";

rollPipeline.register({
  id: "unarmedTrickContent:attack",
  dialogs: ["attack"],
  order: 73,
  dialog: ({ item, actor }) => {
    const owned = Object.entries(UNARMED_TRICKS).filter(([, d]) => actor?.system?.activeFeatNames?.includes(d.feat));
    return [
      {
        at: 63,
        html:
          unarmedWeapon(item?.system) && owned.length
            ? `<label>${loc`Unarmed trick`} <select name="unarmedTrick"><option value="">${loc`None`}</option>${owned
                .map(([k, d]) => `<option value="${k}">${d.name} (${d.feat})</option>`)
                .join(
                  ""
                )}</select></label><label><input type="checkbox" name="unarmedTrickFlatFooted" /> ${loc`The target is flat-footed (One Finger)`}</label>`
            : ""
      }
    ];
  },
  read: ({ entered }) =>
    entered?.unarmedTrick
      ? { unarmedTrick: String(entered.unarmedTrick), unarmedTrickFlatFooted: entered.unarmedTrickFlatFooted === true }
      : null
});

rollPipeline.register({
  id: "unarmedTrickAttackTerm",
  kinds: ["attack"],
  order: 9183,
  terms({ system, weapon, options, ranged }) {
    const plan = unarmedTrickPlan(system, weapon, {
        trick: options.unarmedTrick ?? "",
        kick: options.kick === true,
        attackAction: options.attackAction ?? "standard",
        flatFootedTarget: options.unarmedTrickFlatFooted === true
      }),
      ready = !ranged && unarmedWeapon(weapon) && inReadyStance(system);
    return {
      key: "unarmedTrick",
      plan: plan && !plan.blocked ? plan : null,
      rowAt: 288,
      rows: plan?.attackBonus ? [[plan.name, plan.attackBonus]] : [],
      threat: plan && !plan.blocked ? plan.threatIncrease : 0,
      grantedQuality: plan && !plan.blocked && plan.qualities === "TKD" ? "TKD" : undefined,
      blockAt: 199,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 499,
      notes: [
        ...(plan && !plan.blocked ? [unarmedTrickNote(plan)] : []),
        ...(ready
          ? [loc`Ready Stance: on a hit, the target suffers −2 to attack checks until the end of the round (p.185).`]
          : [])
      ]
    };
  }
});
