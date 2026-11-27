/**
 * The Grapple action's opposed Athletics (Str) check as a named check (p.357), so grapple feats apply to it:
 * - Prone Stance (Submission Basics, p.188): +1 on skill checks made as part of a Grapple action.
 * - Horde Mastery (p.174): +1 morale on them, with a GC-confirmed 2-to-1 or greater advantage.
 * - Garrote Basics (p.178): threat range +2 while holding a readied garrote (declared); an opponent the character
 *   holds becomes mute.
 * The bonuses also apply to escaping a hold or breaking a pin. The opposed result is settled on the grapple card.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const GRAPPLE_CHECK = Object.freeze({
  id: "grapple",
  name: "Grapple (opposed)",
  attributes: ["str"],
  mode: "Active",
  tags: "Armor Check Penalty, Grasp",
  time: "1 Full Action",
  error: 1,
  page: 357,
  synergies: [],
  synergyText: ""
});

export function grappleSkillChecks(key, checks = []) {
  return key === "athletics" ? [...checks.filter(c => c.id !== "grapple"), { ...GRAPPLE_CHECK }] : checks;
}

/** The damage of the grapple benefits that deal it (pp.357–358), worked out for this character. */
export function grappleDamageNote(system) {
  const str = Number(system?.abilities?.str?.mod) || 0,
    unarmed = system?.unarmed ?? { die: 3, extraDice: 0, damageBonus: str },
    dice = `${1 + (unarmed.extraDice ?? 0)}d${unarmed.die ?? 3}`,
    signedValue = n => (n < 0 ? `−${-n}` : `+${n}`);
  return loc`Benefits that deal damage: Injure ${dice}${signedValue(unarmed.damageBonus ?? str)} (or a 1-handed weapon's); Throw ${dice}${signedValue((unarmed.damageBonus ?? str) + Math.max(1, str))}, and the opponent is sprawled and free; Sprawl 1d4${signedValue(str)} subdual, and you become prone.`;
}

/**
 * The roll for a grapple benefit that deals damage (pp.357–358). Injure is the winner's unarmed damage: 1d4 lethal
 * with the Unarmed proficiency, otherwise 1d3 subdual, plus Strength (p.329). Throw adds the Strength modifier again
 * (at least 1). Sprawl is 1d4 + Strength subdual. Null for any other benefit, and for Use Weapon, whose damage comes
 * from the weapon's own card. `proficient` overrides the sheet's Unarmed proficiency (an NPC has no such record).
 */
export function grappleBenefitDamage(system, id, { proficient } = {}) {
  const str = Number(system?.abilities?.str?.mod) || 0,
    trained = proficient ?? system?.proficiencyTotals?.unarmed?.proficient === true,
    unarmed = system?.unarmed ?? { die: trained ? 4 : 3, extraDice: 0, damageBonus: str },
    dice = `${1 + (unarmed.extraDice ?? 0)}d${unarmed.die ?? (trained ? 4 : 3)}`,
    bonus = unarmed.damageBonus ?? str,
    kind = trained ? "lethal" : "subdual",
    term = n => (n ? `${n < 0 ? "-" : "+"} ${Math.abs(n)}` : "");
  if (id === "injure") return { formula: `${dice} ${term(bonus)}`.trim(), kind, minimum: 1 };
  if (id === "throw") return { formula: `${dice} ${term(bonus + Math.max(1, str))}`.trim(), kind, minimum: 1 };
  if (id === "sprawl") return { formula: `1d4 ${term(str)}`.trim(), kind: "subdual", minimum: 1 };
  return null;
}

export function grappleCheckPlan(
  system,
  key,
  check,
  {
    grappleAdvantageConfirmed = false,
    grappleGarrote = false,
    grappleJointLock = false,
    grappleSizeDifference = 0,
    grappleSecondOpponent = false,
    grappleMute = false,
    grappleOthers = 0
  } = {}
) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [], threatIncrease: 0 };
  if (key !== "athletics" || !["grapple", "restraint-escape"].includes(check?.id)) return empty;
  const feats = system?.activeFeatNames ?? [],
    proneStance = system.combatStance?.key === "prone" && feats.includes("Submission Basics"),
    horde = feats.includes("Horde Mastery") && grappleAdvantageConfirmed === true,
    garrote = feats.includes("Garrote Basics") && grappleGarrote === true,
    // Joint Lock (Submission Moves, p.188): the grappler's trick gives −4 to this character's escape checks.
    jointLock = check.id === "restraint-escape" && grappleJointLock === true;
  // Size (p.357): an opponent at most 1 category bigger; the bigger side gains +4 per category of difference.
  const sizeDifference = Math.trunc(Number(grappleSizeDifference) || 0);
  if (check.id === "grapple" && sizeDifference > 1)
    return {
      ...empty,
      blockedReason: loc`A Grapple can target an opponent at most 1 Size category bigger than you (p.357).`
    };
  // p.357: at most 2 grapplers on a smaller target, 4 on one of the same Size and 8 on one a category bigger.
  const others = Math.max(0, Math.trunc(Number(grappleOthers) || 0)),
    mostGrapplers = sizeDifference < 0 ? 2 : sizeDifference === 0 ? 4 : 8;
  if (check.id === "grapple" && others + 1 > mostGrapplers)
    return {
      ...empty,
      blockedReason: loc`At most ${mostGrapplers} characters can grapple a target of that Size, and ${others} already are (p.357).`
    };
  const sizeBonus = check.id === "grapple" && sizeDifference < 0 ? 4 * -sizeDifference : 0,
    // Grapple Second Opponent and Mute (pp.357–358): −4 while taking on or holding two, −2 with a hand over a mouth.
    secondOpponent = grappleSecondOpponent === true,
    mute = grappleMute === true;
  const bonuses = [
      ...(proneStance ? [{ source: "Prone Stance (Grapple)", value: 1 }] : []),
      ...(horde ? [{ source: "Horde Mastery (Grapple)", type: "morale", value: 1 }] : []),
      ...(jointLock ? [{ source: "Joint Lock", value: -4 }] : []),
      ...(sizeBonus ? [{ source: loc`Bigger than the opponent`, value: sizeBonus }] : []),
      ...(secondOpponent ? [{ source: loc`Second grapple opponent`, value: -4 }] : []),
      ...(mute ? [{ source: loc`Hand over the opponent's mouth`, value: -2 }] : [])
    ],
    notes = [
      ...(proneStance ? [loc`Prone Stance: +1 on this Grapple check (p.188).`] : []),
      ...(horde ? [loc`Horde Mastery: +1 morale with a 2-to-1 or greater advantage (p.174).`] : []),
      ...(garrote
        ? [loc`Garrote Basics: threat range +2 with the readied garrote; an opponent you hold becomes mute (p.178).`]
        : []),
      ...(jointLock ? [loc`Joint Lock: −4 on this escape check (p.188).`] : []),
      ...(sizeBonus ? [loc`Size: +${sizeBonus} for being ${-sizeDifference} category(ies) bigger (p.357).`] : []),
      ...(check.id === "grapple" && sizeDifference === 1
        ? [loc`Size: the opponent is a category bigger and gains +4 on its check (p.357).`]
        : []),
      ...(secondOpponent ? [loc`Second opponent: −4 while grappling or holding two (p.357).`] : []),
      ...(mute ? [loc`Mute: −2 on Athletics checks while the hand stays over the mouth (p.358).`] : []),
      ...(check.id === "grapple" ? [grappleDamageNote(system)] : [])
    ];
  return {
    ...empty,
    evidence:
      bonuses.length || garrote
        ? {
            version: 1,
            proneStance,
            horde,
            garrote,
            jointLock,
            sizeDifference,
            secondOpponent,
            mute,
            checkId: check.id
          }
        : null,
    bonuses,
    notes,
    threatIncrease: garrote ? 2 : 0
  };
}

/**
 * What settling a grapple needs from a posted check: its total, its activated criticals and the Size bonus already
 * inside the total (p.357), so the bonus is never added a second time.
 */
export function grappleCardFacts(check) {
  if (!check || !Number.isFinite(check.effectiveTotal)) return null;
  const difference = Math.trunc(Number(check.grappleFeats?.sizeDifference) || 0);
  return {
    total: check.effectiveTotal,
    critical: check.criticalSuccess === true,
    criticalFailure: check.criticalFailure === true,
    grapple: check.checkId === "grapple",
    sizeBonus: check.checkId === "grapple" && difference < 0 ? 4 * -difference : 0
  };
}

// The Grapple feats' record, Size included, goes on the check card for the grapple to be settled from it.
rollPipeline.register({ id: "grappleRecord", order: 9238, record: ["grappleFeats"] });

rollPipeline.register({
  id: "grappleChecks",
  order: 5058,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => grappleSkillChecks(skillKey, checks)
});

rollPipeline.register({
  id: "grappleContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => {
    const feats = actor?.system?.activeFeatNames ?? [];
    if (key !== "athletics") return [];
    return [
      {
        at: 207,
        html: `<details><summary>${loc`Grapple`}</summary><label>${loc`Opponent's Size compared with mine`} <select name="grappleSizeDifference"><option value="0">${loc`The same`}</option><option value="-1">${loc`1 smaller`}</option><option value="-2">${loc`2 smaller`}</option><option value="-3">${loc`3 smaller`}</option><option value="1">${loc`1 bigger`}</option><option value="2">${loc`2 or more bigger (no Grapple)`}</option></select></label><label>${loc`Others already grappling this opponent`} <input name="grappleOthers" type="number" min="0" max="7" step="1" value="0" class="w-2" /></label><label><input name="grappleSecondOpponent" type="checkbox" /> ${loc`I am grappling or holding a second opponent (−4)`}</label><label><input name="grappleMute" type="checkbox" /> ${loc`My hand is over an opponent's mouth (−2)`}</label><label><input name="grappleJointLock" type="checkbox" /> ${loc`Escaping: my grappler used Joint Lock on me (−4)`}</label>${feats.includes("Horde Mastery") ? `<label><input name="grappleAdvantageConfirmed" type="checkbox" /> ${loc`Horde Mastery: the GC confirms a 2-to-1 or greater advantage`}</label>` : ""}${feats.includes("Garrote Basics") ? `<label><input name="grappleGarrote" type="checkbox" /> ${loc`Garrote Basics: I hold a readied garrote`}</label>` : ""}</details>`
      }
    ];
  }
});

rollPipeline.register({
  id: "grappleSkillTerm",
  kinds: ["skill"],
  order: 9237,
  terms({ system, skillKey, check, input }) {
    const plan = grappleCheckPlan(system, skillKey, check, input ?? {});
    return {
      ...skillPlanTerm("grappleFeats", plan, { noteAt: 47, bonusAt: 123 }),
      threatIncrease: plan.threatIncrease
    };
  }
});
