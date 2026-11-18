/**
 * Boxing Basics, p.184 (its +2 wound points are static feat data).
 *
 * - Closed Stance: the character may end movement in an opponent's square; while they share it they are adjacent,
 *   gain DR 2/— against that opponent's attacks and +2 unarmed damage against them, and the opponent takes no bonus
 *   5-ft. steps. The damage roll asks whether the target shares the square; the DR and the step ban are reminders.
 * - Double Jab: as a half action, two unarmed Standard Attacks, each at −2 and dealing 2 fewer points per damage die
 *   (minimum 1 per die).
 */
import { combatStanceState } from "./combat-stance.mjs";
import { unarmedWeapon } from "./kick.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const CLOSED_STANCE_DAMAGE = 2;
export const inClosedStance = system => combatStanceState(system ?? {})?.key === "closed";

/** Each die of a damage expression loses 2, never below 1: NdX becomes (NdXmin3 − 2N). */
export function doubleJabFormula(base) {
  return String(base).replace(/(\d*)d(\d+)/g, (_m, n, x) => {
    const count = Number(n || 1);
    return `(${count}d${x}min3 - ${2 * count})`;
  });
}

export function doubleJabPlan(system, weapon, { doubleJab = false, attackAction = "standard" } = {}) {
  if (doubleJab !== true) return null;
  if (!system?.activeFeatNames?.includes("Boxing Basics"))
    return { blocked: true, reason: loc`Double Jab needs Boxing Basics.` };
  if (!unarmedWeapon(weapon) || attackAction !== "standard")
    return { blocked: true, reason: loc`Double Jab is made with unarmed Standard Attacks.` };
  return {
    blocked: false,
    version: 1,
    attackBonus: -2,
    note: loc`Double Jab: one of 2 unarmed Standard Attacks made as a half action, each at −2; roll its damage from this card for 2 fewer points per die (minimum 1) (p.184).`
  };
}

rollPipeline.register({
  id: "doubleJabContent:attack",
  dialogs: ["attack"],
  order: 70,
  dialog: ({ item, actor }) => [
    {
      at: 60,
      html:
        unarmedWeapon(item?.system) && actor?.system?.activeFeatNames?.includes("Boxing Basics")
          ? `<label><input type="checkbox" name="doubleJab" /> ${loc`Double Jab: 2 unarmed Standard Attacks as a half action, each at −2 and 2 fewer damage per die (roll each attack)`}</label>`
          : ""
    }
  ],
  read: ({ entered }) => (entered?.doubleJab === true ? { doubleJab: true, attackAction: "standard" } : null)
});

rollPipeline.register({
  id: "boxingAttackTerm",
  kinds: ["attack"],
  order: 9180,
  terms({ system, weapon, options, ranged }) {
    const plan = doubleJabPlan(system, weapon, {
      doubleJab: options.doubleJab === true,
      attackAction: options.attackAction ?? "standard"
    });
    const closed = !ranged && unarmedWeapon(weapon) && inClosedStance(system);
    return {
      key: "doubleJab",
      plan: plan && !plan.blocked ? plan : null,
      rowAt: 287,
      rows: plan && !plan.blocked ? [[loc`Double Jab`, plan.attackBonus]] : [],
      blockAt: 198,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 499,
      notes: [
        ...(plan && !plan.blocked ? [plan.note] : []),
        ...(closed
          ? [
              loc`Closed Stance: against an opponent sharing your square you have DR 2/— and +2 unarmed damage, and they take no bonus 5-ft. steps (p.184).`
            ]
          : [])
      ]
    };
  }
});

// The damage roll asks whether the target shares the square in Closed Stance.
rollPipeline.register({
  id: "closedStanceContent:damage",
  dialogs: ["damage"],
  order: 33,
  dialog: ({ actor, item }) => [
    {
      at: 47,
      html:
        unarmedWeapon(item?.system) && inClosedStance(actor?.system)
          ? `<label><input type="checkbox" name="closedStanceTarget" /> ${loc`Closed Stance: the target shares my square (+2 unarmed damage, p.184)`}</label>`
          : ""
    }
  ],
  read: (context, input) => (input?.closedStanceTarget === true ? { closedStanceTarget: true } : null)
});

/**
 * Boxing Moves, p.185: Knock Out (an unarmed Standard Attack whose damage exceeds a standard character’s
 * Constitution score leaves them unconscious for 1d4 minutes) and Wallop (a successful unarmed Standard Attack forces
 * a Reflex save, DC 10 + the damage, or the target is drunk for 1d4 rounds). Weather the Storm is a round action
 * (module/rules/feat-free-actions.mjs).
 */
/** Only one unarmed feat trick applies to an action. */
export function unarmedTrickClash(options = {}) {
  const tricks = [
    options.doubleJab === true,
    !!options.boxingTrick,
    !!options.kickTrick,
    options.brush === true,
    !!options.unarmedTrick
  ].filter(Boolean).length;
  return tricks > 1 ? loc`Only one Unarmed Combat feat trick may apply to this action.` : "";
}

export const BOXING_TRICKS = Object.freeze({ knockOut: "Knock Out", wallop: "Wallop" });

export function boxingTrickPlan(system, weapon, { trick = "", attackAction = "standard" } = {}) {
  if (!trick) return null;
  if (!Object.hasOwn(BOXING_TRICKS, trick) || !system?.activeFeatNames?.includes("Boxing Moves"))
    return { blocked: true, reason: loc`That trick needs Boxing Moves.` };
  if (!unarmedWeapon(weapon) || attackAction !== "standard")
    return { blocked: true, reason: loc`${BOXING_TRICKS[trick]} is made with an unarmed Standard Attack.` };
  return { blocked: false, version: 1, key: trick, name: BOXING_TRICKS[trick] };
}

/** The damage card’s line for a Boxing Moves hit, given the damage dealt and the target, if known. */
export function boxingTrickDamageNote(trick, damage, target = null) {
  if (trick === "wallop")
    return loc`Wallop: the target makes a Reflex save, DC ${10 + damage}, or is drunk for 1d4 rounds (p.185).`;
  if (trick !== "knockOut") return "";
  const con = target?.system?.abilities?.con?.value;
  return Number.isFinite(con)
    ? damage > con
      ? loc`Knock Out: ${damage} damage exceeds the target’s Constitution ${con}; a standard character falls unconscious for 1d4 minutes (p.185).`
      : loc`Knock Out: ${damage} damage does not exceed the target’s Constitution ${con} (p.185).`
    : loc`Knock Out: if ${damage} damage exceeds a standard character’s Constitution score, they fall unconscious for 1d4 minutes (p.185).`;
}

rollPipeline.register({
  id: "boxingMovesContent:attack",
  dialogs: ["attack"],
  order: 71,
  dialog: ({ item, actor }) => [
    {
      at: 61,
      html:
        unarmedWeapon(item?.system) && actor?.system?.activeFeatNames?.includes("Boxing Moves")
          ? `<label>${loc`Boxing Moves trick`} <select name="boxingTrick"><option value="">${loc`None`}</option>${Object.entries(
              BOXING_TRICKS
            )
              .map(([k, n]) => `<option value="${k}">${n}</option>`)
              .join("")}</select></label>`
          : ""
    }
  ],
  read: ({ entered }) => (entered?.boxingTrick ? { boxingTrick: String(entered.boxingTrick) } : null)
});

rollPipeline.register({
  id: "boxingMovesAttackTerm",
  kinds: ["attack"],
  order: 9181,
  terms({ system, weapon, options }) {
    const plan = boxingTrickPlan(system, weapon, {
        trick: options.boxingTrick ?? "",
        attackAction: options.attackAction ?? "standard"
      }),
      clash = unarmedTrickClash(options);
    return {
      key: "boxingTrick",
      plan: plan && !plan.blocked ? plan : null,
      blockAt: 199,
      blocked: clash || (plan?.blocked ? plan.reason : ""),
      noteAt: 499,
      notes:
        plan && !plan.blocked
          ? [loc`${plan.name}: roll this hit’s damage from the card to see its effect (p.185).`]
          : []
    };
  }
});
