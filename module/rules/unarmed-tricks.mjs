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
  spike: { feat: "Vital Points Moves", name: "Spike", action: "standard", threat: 1, page: 188 },
  roll: { feat: "Rolling Basics", name: "Roll", action: "either", damage: 1, page: 187 },
  palmStrike: { feat: "Spirit Basics", name: "Palm Strike", action: "standard", page: 187 },
  oneTwo: { feat: "Brawling Supremacy", name: "One-Two", action: "standard", doubleMargin: 4, page: 185 },
  vitalize: { feat: "Spirit Moves", name: "Vitalize", action: "standard", page: 187 },
  drivingPunch: {
    feat: "Boxing Supremacy",
    name: "Driving Punch",
    action: "standard",
    threat: 2,
    missFlatFooted: true,
    page: 184
  },
  turningPunch: { feat: "Boxing Supremacy", name: "Turning Punch", action: "standard", damageMultiplier: 3, page: 184 },
  hurricaneKick: { feat: "Kicking Supremacy", name: "Hurricane Kick", action: "kick", damage: -2, page: 186 },
  thrustKick: { feat: "Kicking Supremacy", name: "Thrust Kick", action: "kick", page: 186 }
});

const NOTES = {
  clothesline: () => loc`Clothesline: this attack has takedown, with its Fortitude save DC 4 higher`,
  circle: () => loc`Circle: on a hit, move to any unoccupied square adjacent to the opponent`,
  leap: () => loc`Leap: first move up to your Speed; opponents and the squares around them don’t block you`,
  sway: () => loc`Sway: on a hit, +1 dodge bonus to Defense against the target’s attacks for 1 full round`,
  oneFinger: () => loc`One Finger: only against a flat-footed opponent`,
  spike: () => loc`Spike: threat range +1`,
  roll: () => loc`Roll: move 5 ft. before this attack; +1 damage (roll it from this card)`,
  palmStrike: () =>
    loc`Palm Strike: on a hit, push the opponent 5 ft. away; if that square is occupied or blocked, they take 1d4 subdual instead`,
  oneTwo: () => loc`One-Two: if the result beats the target’s Defense by 4 or more, the damage is doubled`,
  drivingPunch: () =>
    loc`Driving Punch: a full action; move up to your Speed, at least 10 ft. toward the target, first; threat range +2; a miss leaves you flat-footed`,
  turningPunch: () =>
    loc`Turning Punch: a full action; the target’s dodge bonus to Defense counts twice against it; a hit deals triple damage`,
  hurricaneKick: () =>
    loc`Hurricane Kick: one of the 5 Kicks of a full action (once per round), split among adjacent opponents; damage −2 (minimum 1); afterwards each opponent hit is pushed 5 ft., or takes 1d4 subdual if that square is occupied or blocked`,
  thrustKick: () => loc`Thrust Kick: on a hit you may take a Bull Rush against the same opponent as a free action`,
  vitalize: () =>
    loc`Vitalize: aimed at a teammate (once per teammate per scene); on a hit they recover 1 wound point and 1d6 vitality points`
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
    d.action === "kick"
      ? kick === true
      : d.action === "either"
        ? kick === true || attackAction === "standard"
        : kick !== true && attackAction === "standard";
  if (!legal)
    return {
      blocked: true,
      reason:
        d.action === "kick"
          ? loc`${d.name} is made with a Kick.`
          : d.action === "either"
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
    ...(d.qualities ? { qualities: d.qualities } : {}),
    ...(d.damage ? { damageBonus: d.damage } : {})
  };
}

/** The extra damage a trick adds to its hit’s damage roll. */
export const unarmedTrickDamageBonus = trick => UNARMED_TRICKS[trick]?.damage ?? 0;

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
  if (d?.damageMultiplier)
    return loc`${d.name}: the hit deals triple damage, ${d.damageMultiplier * damage} in all (p.${d.page}).`;
  if (d?.doubleMargin)
    return loc`${d.name}: if the attack beat Defense by ${d.doubleMargin} or more, the damage is doubled to ${2 * damage} (p.${d.page}).`;
  return d?.hitSave
    ? loc`${d.name}: the target makes a ${d.hitSave[0]} save, DC ${10 + damage}, or is ${d.hitSave[1]} (p.${d.page}).`
    : "";
}

/** Dirty Fighting Basics: sneak attack damage its owner suffers is halved, rounded up. */
export const halvesSneakDamage = targetSystem =>
  targetSystem?.activeFeatNames?.includes("Dirty Fighting Basics") === true;

export const inReadyStance = system => combatStanceState(system ?? {})?.key === "ready";

/** Coiled Stance (Brawling Basics, p.185): +2 on unarmed attacks against an opponent with a lower Reflex save bonus. */
export const coiledStanceBonus = (system, weapon, { ranged = false, lowerReflex = false } = {}) =>
  !ranged && unarmedWeapon(weapon) && lowerReflex === true && combatStanceState(system ?? {})?.key === "coiled" ? 2 : 0;

rollPipeline.register({
  id: "unarmedTrickContent:attack",
  dialogs: ["attack"],
  order: 73,
  dialog: ({ item, actor }) => {
    const owned = Object.entries(UNARMED_TRICKS).filter(([, d]) => actor?.system?.activeFeatNames?.includes(d.feat));
    const coiled =
      unarmedWeapon(item?.system) && combatStanceState(actor?.system ?? {})?.key === "coiled"
        ? `<label><input type="checkbox" name="coiledLowerReflex" /> ${loc`Coiled Stance: the target’s Reflex save bonus is lower than mine (+2)`}</label>`
        : "";
    return [
      { at: 62, html: coiled },
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
  read: ({ entered }) => ({
    ...(entered?.unarmedTrick
      ? { unarmedTrick: String(entered.unarmedTrick), unarmedTrickFlatFooted: entered.unarmedTrickFlatFooted === true }
      : {}),
    ...(entered?.coiledLowerReflex === true ? { coiledLowerReflex: true } : {})
  })
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
      ready = !ranged && unarmedWeapon(weapon) && inReadyStance(system),
      coiled = coiledStanceBonus(system, weapon, { ranged, lowerReflex: options.coiledLowerReflex === true });
    return {
      key: "unarmedTrick",
      plan: plan && !plan.blocked ? plan : null,
      rowAt: 288,
      rows: [
        ...(plan?.attackBonus ? [[plan.name, plan.attackBonus]] : []),
        ...(coiled ? [[loc`Coiled Stance`, coiled]] : [])
      ],
      threat: plan && !plan.blocked ? plan.threatIncrease : 0,
      grantedQuality: plan && !plan.blocked && plan.qualities === "TKD" ? "TKD" : undefined,
      blockAt: 199,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 499,
      notes: [
        ...(plan && !plan.blocked ? [unarmedTrickNote(plan)] : []),
        ...(ready
          ? [loc`Ready Stance: on a hit, the target suffers −2 to attack checks until the end of the round (p.185).`]
          : []),
        ...(coiled
          ? [
              loc`Coiled Stance: +2 against an opponent with a lower Reflex save bonus; you may take a second bonus 5-ft. step this round (p.185).`
            ]
          : [])
      ]
    };
  }
});
