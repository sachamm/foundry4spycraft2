import { criticalInjuryCostShift } from "./campaign-rules.mjs";
/**
 * Ready-made critical effects for attack checks (pp.329–330).
 *
 * A critical miss (Table 5.4) is bought by the attacker's opponent with 1–4 action dice. Each effect needs the
 * attack's final error range to reach a minimum width, and only one effect applies per error. The labels are our own
 * short summaries; the GC still confirms the effect in the activation dialog.
 *
 * A critical hit depends on the target: a special character with vitality left can take the damage on wounds (1 die)
 * or, when the damage beats Constitution, a Table of Ouch injury (2 dice); one at 0 vitality takes an injury for 1
 * die; a standard character, vehicle or item fails 1–4 extra Damage saves, one die each.
 *
 * This module is pure.
 */
import { loc } from "../i18n.mjs";

const MELEE = ["blunt", "exoticBlunt", "edged", "exoticEdged"];
const HURLED = ["hurled", "exoticHurled", "explosives"];

/** The Table 5.4 group an attack belongs to, from the proficiency it was made with. */
export function attackFamily(proficiency) {
  if (proficiency === "unarmed") return "unarmed";
  if (MELEE.includes(proficiency)) return "melee";
  if (HURLED.includes(proficiency)) return "hurled";
  return proficiency ? "firearm" : "";
}

/** Table 5.4: [action dice, minimum error range, id, label getter]. */
const MISSES = {
  unarmed: [
    [1, 1, "sprawl", () => loc`Stumbles and ends up sprawled`],
    [2, 1, "scenery1", () => loc`Thrown into nearby scenery: 1d6 subdual damage`],
    [3, 2, "dazed", () => loc`Dazed: stunned until the end of their Count next round`],
    [4, 3, "scenery2", () => loc`Slammed into scenery: 2d6 subdual damage`]
  ],
  melee: [
    [1, 1, "drop", () => loc`Weapon falls in the attacker's square (half action to pick up)`],
    [2, 1, "stuck", () => loc`Weapon lodged in scenery (full action to free)`],
    [3, 2, "broken", () => loc`Weapon breaks and cannot be used until repaired`],
    [4, 3, "destroyed", () => loc`Weapon ruined, and the blow lands on the attacker`]
  ],
  hurled: [
    [1, 1, "drop", () => loc`Non-explosive weapon falls in the attacker's square (half action to pick up)`],
    [2, 1, "wild", () => loc`Throw goes wild: the GC moves its deviation up to 6 squares`],
    [2, 2, "adjacent", () => loc`Strikes someone next to the target, chosen by the GC (may be the attacker)`],
    [3, 2, "broken", () => loc`Weapon breaks and cannot be used until repaired`],
    [4, 3, "nearby", () => loc`Strikes someone within 30 ft. of the target, chosen by the GC (may be the attacker)`],
    [4, 3, "dropExplosive", () => loc`Explosive falls in the attacker's square (half action to pick up)`]
  ],
  firearm: [
    [1, 1, "dud", () => loc`Dud or misfire: Aim and Brace lost; half action to clear`],
    [2, 1, "jam", () => loc`Jam: Aim and Brace lost; full action to clear`],
    [2, 2, "adjacent", () => loc`Strikes someone next to the target, chosen by the GC (may be the attacker)`],
    [3, 2, "broken", () => loc`Weapon breaks and cannot be used until repaired`],
    [4, 3, "nearby", () => loc`Strikes someone within 30 ft. of the target, chosen by the GC (may be the attacker)`],
    [
      4,
      3,
      "destroyed",
      () => loc`Weapon destroyed; the attacker takes 2d6 lethal and saves (Fort DC 20) or is blinded 1d4 rounds`
    ]
  ]
};

/** Every Table 5.4 row, for tests and reference. */
export const CRITICAL_MISS_TABLE = Object.fromEntries(
  Object.entries(MISSES).map(([family, rows]) => [
    family,
    rows.map(([cost, minimumError, id]) => ({ cost, minimumError, id }))
  ])
);

/**
 * The Table 5.4 effects an opponent may buy for this attack error.
 * @param {object} check  the posted attack check (weaponProficiency, error)
 * @returns {{id: string, cost: number, minimumError: number, label: string}[]}
 */
export function criticalMissChoices(check) {
  if (check?.checkKind !== "attack") return [];
  const family = attackFamily(check.weaponProficiency),
    error = Number(check.error) || 0;
  return (MISSES[family] ?? [])
    .filter(([, minimumError]) => error >= minimumError)
    .map(([cost, minimumError, id, label]) => ({
      id: `miss.${family}.${id}`,
      cost,
      minimumError,
      label: loc`${label()} (Table 5.4)`
    }));
}

/** The critical hit effects (p.329), for every kind of target; the GC picks the one that fits. */
export function criticalHitChoices(check, { injuryCostShift = criticalInjuryCostShift() } = {}) {
  if (check?.checkKind !== "attack") return [];
  // Bulletproof (+1) and Gritty (−1, minimum 0) change what a Table of Ouch injury costs (p.406).
  const ouch = base => Math.max(0, base + injuryCostShift),
    shifted = injuryCostShift
      ? loc` (campaign quality ${injuryCostShift > 0 ? "+" : "−"}${Math.abs(injuryCostShift)})`
      : "";
  return [
    { id: "hit.wounds", cost: 1, label: loc`Special character with vitality left: the damage goes to wounds` },
    {
      id: "hit.ouch",
      baseCost: 2,
      cost: ouch(2),
      label: `${loc`Special character with vitality left, damage above Constitution: a Table of Ouch injury`}${shifted}`
    },
    {
      id: "hit.ouchAtZero",
      baseCost: 1,
      cost: ouch(1),
      label: `${loc`Special character at 0 vitality: also a Table of Ouch injury`}${shifted}`
    },
    ...[1, 2, 3, 4].map(n => ({
      id: `hit.saves${n}`,
      cost: n,
      label: loc`Standard character, vehicle or item: automatically fails ${n} more Damage save(s)`
    }))
  ];
}

/** The ready-made effects for a result kind ("success" or "failure"). */
export function criticalEffectChoices(check, kind) {
  return kind === "failure" ? criticalMissChoices(check) : criticalHitChoices(check);
}

/**
 * Fill a critical activation request from a chosen ready-made effect. The effect text and base cost come from the
 * choice; a text the GC wrote is kept after it.
 */
export function applyCriticalChoice(check, input = {}) {
  if (!input.preset) return input;
  const choice = criticalEffectChoices(check, input.kind).find(c => c.id === input.preset);
  if (!choice) throw new Error(loc`That ready-made effect does not apply to this result.`);
  const extra = String(input.effect ?? "").trim();
  return {
    ...input,
    baseCost: choice.baseCost ?? choice.cost,
    effect: extra ? `${choice.label} — ${extra}` : choice.label
  };
}

/**
 * What the GC pays to activate an NPC's critical: the effect's table cost (1 for a skill check), less 1 for laser
 * damage (p.338, only for an NPC allowed to activate attack criticals), plus 1 against a Black Cat's Tough Luck and
 * the extra dice for a Henchman or Mastermind target (pp.447–448), never below 0. Under Bloodbath (p.406) a special
 * character's attack critical is free. `sources` names each change, as on an agent's activation.
 */
export function npcCriticalPrice(check, baseCost = 1, { laser = false, bloodbath = false } = {}) {
  const attack = check?.checkKind === "attack";
  if (attack && bloodbath) return { cost: 0, baseCost, sources: [loc`Bloodbath: a critical hit at no cost (p.406)`] };
  const sources = [];
  let adjustment = 0;
  if (attack && laser) {
    adjustment--;
    sources.push(loc`Laser damage –1`);
  }
  if (check?.blackCat?.toughLuck === true) {
    adjustment++;
    sources.push(loc`Tough Luck (Black Cat target) +1`);
  }
  const role = check?.attackContext?.targetRole;
  if (attack && Number.isSafeInteger(role?.extraDiceToActivate) && role.extraDiceToActivate > 0) {
    adjustment += role.extraDiceToActivate;
    sources.push(loc`${role.label} target +${role.extraDiceToActivate}`);
  }
  return { cost: Math.max(0, baseCost + adjustment), baseCost, sources };
}
