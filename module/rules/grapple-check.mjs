import { grappleDamagePlan } from "./grapple-damage.mjs";
import { npcWeaponTraining } from "./npc-weapons.mjs";
import { grapplerLimit } from "./combat-actions.mjs";
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
import { damageConversionPlan } from "./damage-conversion.mjs";
import { weaponGrip, weaponUnavailable } from "./weapon-use.mjs";
import { esc } from "../html.mjs";

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
  cooperative: { max: 7 },
  synergyText: ""
});

export function grappleSkillChecks(key, checks = []) {
  return key === "athletics" ? [...checks.filter(c => c.id !== "grapple"), { ...GRAPPLE_CHECK }] : checks;
}

/** The damage of the grapple benefits that deal it (pp.357–358), worked out for this character. */
export function grappleDamageNote(system) {
  const str = Number(system?.abilities?.str?.mod) || 0,
    trained = system.npcType
      ? npcWeaponTraining(system, { proficiency: "unarmed" }).trained
      : system.proficiencyTotals?.unarmed?.proficient === true,
    unarmed = system?.unarmed ?? { die: trained ? 4 : 3, extraDice: 0, damageBonus: str },
    dice = `${1 + (unarmed.extraDice ?? 0)}d${unarmed.die ?? 3}`,
    signedValue = n => (n < 0 ? `−${-n}` : `+${n}`);
  return loc`Benefits that deal damage: Injure ${dice}${signedValue(unarmed.damageBonus ?? str)} (or a 1-handed weapon's); Throw ${dice}${signedValue((unarmed.damageBonus ?? str) + Math.max(1, str))}, and the opponent is sprawled and free; Sprawl 1d4${signedValue(str)} subdual, and you become prone.`;
}

/**
 * The roll for a grapple benefit that deals damage (pp.357–358). Injure is the winner's unarmed damage: 1d4 lethal
 * with the Unarmed proficiency, otherwise 1d3 subdual, plus Strength (p.329). Throw adds the Strength modifier again
 * (at least 1). Sprawl is 1d4 + Strength subdual. Null for any other benefit, and for Use Weapon, whose damage comes
 * from the weapon's own card. `proficient` overrides the sheet's Unarmed proficiency (an NPC has no such record).
 * `convert` switches Injure and Throw between lethal and subdual (p.345); Sprawl stays subdual.
 */
export function grappleBenefitDamage(system, id, { proficient, convert = false } = {}) {
  if (!["injure", "throw", "sprawl"].includes(id)) return null;
  if (id === "throw" && convert)
    throw Error(loc`Throw retains standard unarmed damage; conversion belongs to benefits that explicitly allow it.`);
  const data = {
    activeFeatNames: [],
    classOptionSelections: [],
    ...system,
    ...(typeof proficient === "boolean"
      ? { proficiencyTotals: { ...system.proficiencyTotals, unarmed: { proficient } } }
      : {})
  };
  const actorType = typeof proficient === "boolean" ? "agent" : system.npcType ? "npc" : "agent";
  let plan = grappleDamagePlan(data, id, { actorType });
  if (id === "injure" && convert)
    plan = grappleDamagePlan(data, id, {
      actorType,
      kind: plan.profile.kind === "lethal" ? "subdual" : "lethal",
      conversionConfirmed: true
    });
  return {
    formula: plan.formula,
    kind: plan.profile.kind,
    minimum: id === "sprawl" ? 0 : id === "throw" ? 1 + Math.max(1, system.abilities.str.mod) : 1
  };
}

export function grappleCheckPlan(
  system,
  key,
  check,
  {
    grappleAdvantageConfirmed = false,
    grappleGarrote = false,
    grappleJointLock = false,
    grappleSecondOpponent = false,
    grappleHoldingTwo = false,
    grappleMuting = false,
    grappleMute = false,
    grappleOpponentSize = null,
    grappleOthers = null,
    grappleConvertDamage = false,
    grappleParticipantConfirmed = false,
    grappleDamageConversion = false,
    grappleConversionWeaponId = "",
    grappleConversionWeapon = null,
    grappleConversionFrom = "subdual"
  } = {}
) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [], threatIncrease: 0 };
  if (key !== "athletics") return empty;
  const inGrapple = ["grapple", "restraint-escape"].includes(check?.id);
  if (!inGrapple && !grappleHoldingTwo) return empty;
  let legacySizeBonus = 0,
    legacySize = null;
  if (inGrapple && grappleOpponentSize !== null) {
    legacySize = Number(grappleOpponentSize);
    if (!Number.isSafeInteger(legacySize) || Math.abs(legacySize) > 20)
      return { ...empty, blockedReason: loc`Confirm the actual Size difference.` };
    if (check.id === "grapple" && legacySize > 1)
      return { ...empty, blockedReason: loc`Opening: the opponent may be at most 1 Size category larger.` };
    if (check.grappleProficiency && check.grappleProficiency.sizeDifference !== -legacySize)
      return { ...empty, blockedReason: loc`The declared Size differs from the recorded Grapple context.` };
    legacySizeBonus = check.grappleProficiency ? 0 : 4 * Math.max(0, -legacySize);
  }
  if (check?.id === "grapple" && grappleOthers !== null) {
    const others = Number(grappleOthers),
      limit = grapplerLimit(legacySize ?? 0);
    if (!Number.isSafeInteger(others) || others < 0 || others >= limit)
      return { ...empty, blockedReason: loc`At most ${limit} participants may grapple this target at these Sizes.` };
  }
  if (grappleConvertDamage === true && check?.id === "grapple") {
    grappleDamageConversion = true;
    grappleConversionFrom = (
      system.npcType
        ? npcWeaponTraining(system, { proficiency: "unarmed" }).trained
        : system.proficiencyTotals?.unarmed?.proficient === true
    )
      ? "lethal"
      : "subdual";
  }
  const second = grappleHoldingTwo === true || (inGrapple && grappleSecondOpponent === true),
    muting = inGrapple && (grappleMuting === true || grappleMute === true);
  let conversion = null;
  if (inGrapple && grappleDamageConversion === true) {
    if (!["lethal", "subdual"].includes(grappleConversionFrom))
      return { ...empty, blockedReason: loc`Confirm the original lethal or subdual damage before converting it.` };
    const weapon = grappleConversionWeapon?.system;
    if (
      grappleConversionWeaponId &&
      (!weapon ||
        grappleConversionWeapon.type !== "weapon" ||
        grappleConversionWeapon.id !== grappleConversionWeaponId ||
        weapon.equipped !== true ||
        weaponUnavailable(weapon) ||
        (weapon.proficiency !== "unarmed" &&
          (weaponGrip(system, weapon).hands !== 1 || weaponGrip(system, weapon).blocked)))
    )
      return {
        ...empty,
        blockedReason: loc`Choose the actual available one-handed weapon in hand, or unarmed damage, for this grapple conversion.`
      };
    conversion = damageConversionPlan(
      system,
      weapon ?? { proficiency: "unarmed", damage: `1 ${grappleConversionFrom}` },
      grappleConversionWeapon,
      { convert: true }
    );
    if (conversion.blocked) return { ...empty, blockedReason: conversion.reason };
  }
  const feats = system?.activeFeatNames ?? [],
    proneStance = inGrapple && system.combatStance?.key === "prone" && feats.includes("Submission Basics"),
    horde = inGrapple && feats.includes("Horde Mastery") && grappleAdvantageConfirmed === true,
    garrote = inGrapple && feats.includes("Garrote Basics") && grappleGarrote === true,
    // Joint Lock (Submission Moves, p.188): the grappler's trick gives −4 to this character's escape checks.
    jointLock = check?.id === "restraint-escape" && grappleJointLock === true;
  const bonuses = [
      ...(proneStance ? [{ source: "Prone Stance (Grapple)", value: 1 }] : []),
      ...(horde ? [{ source: "Horde Mastery (Grapple)", type: "morale", value: 1 }] : []),
      ...(jointLock ? [{ source: "Joint Lock", value: -4 }] : []),
      ...(legacySizeBonus ? [{ source: loc`Size (Grapple)`, value: legacySizeBonus }] : []),
      ...(second ? [{ source: loc`Second grapple opponent`, value: -4 }] : []),
      ...(muting ? [{ source: loc`Mute grapple benefit`, value: -2 }] : []),
      ...(conversion?.attackPenalty
        ? [{ source: loc`Grapple damage conversion`, value: conversion.attackPenalty }]
        : [])
    ],
    notes = [
      ...(typeof check?.grappleProficiency?.proficient === "boolean"
        ? [
            check.grappleProficiency.proficient
              ? loc`Grapple: one full action (pp.347,357).`
              : loc`Untrained Grapple: two full actions, time reduction unavailable, error range +2 (p.347).`,
            loc`Grapple Size bonus: +${4 * Math.max(0, check.grappleProficiency.sizeDifference ?? 0)} on this participant's Athletics check.`
          ]
        : []),
      ...(proneStance ? [loc`Prone Stance: +1 on this Grapple check (p.188).`] : []),
      ...(horde ? [loc`Horde Mastery: +1 morale with a 2-to-1 or greater advantage (p.174).`] : []),
      ...(garrote
        ? [loc`Garrote Basics: threat range +2 with the readied garrote; an opponent you hold becomes mute (p.178).`]
        : []),
      ...(jointLock ? [loc`Joint Lock: −4 on this escape check (p.188).`] : []),
      ...(legacySize === 1 ? [loc`The larger opponent gains +4 on its own check.`] : []),
      ...(check?.id === "grapple" ? [grappleDamageNote(system)] : []),
      ...(second
        ? [loc`Attempting a second hold or holding two opponents: −4 to Athletics, applied once (p.357).`]
        : []),
      ...(muting
        ? [loc`Your Mute benefit: −2 during its remaining grapple scope; the opponent's winning check ends it (p.358).`]
        : []),
      ...(conversion
        ? [
            loc`Grapple conversion: ${conversion.from} to ${conversion.to}; Athletics penalty ${conversion.attackPenalty}${conversion.waivedBy ? ` (${conversion.waivedBy})` : ""} (pp.345,357–358).`
          ]
        : [])
    ];
  return {
    ...empty,
    evidence:
      bonuses.length ||
      garrote ||
      conversion ||
      check?.grappleProficiency ||
      legacySize !== null ||
      (inGrapple && grappleParticipantConfirmed === true)
        ? {
            version: 1,
            proneStance,
            horde,
            garrote,
            jointLock,
            ...(legacySize !== null ? { sizeDifference: legacySize } : {}),
            ...(grappleConvertDamage ? { convertDamage: true } : {}),
            second,
            muting,
            ...(grappleParticipantConfirmed === true ? { participantConfirmed: true } : {}),
            ...(check?.grappleProficiency ? { proficiency: structuredClone(check.grappleProficiency) } : {}),
            conversion,
            conversionWeaponId: grappleConversionWeaponId,
            checkId: check?.id ?? ""
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
  const recorded = check.grappleFeats?.proficiency?.sizeDifference;
  const difference = Number.isSafeInteger(recorded)
    ? -recorded
    : Math.trunc(Number(check.grappleFeats?.sizeDifference) || 0);
  return {
    total: check.effectiveTotal,
    critical: check.criticalSuccess === true,
    criticalFailure: check.criticalFailure === true,
    grapple: check.checkId === "grapple",
    convertDamage:
      check.checkId === "grapple" && (check.grappleFeats?.convertDamage === true || !!check.grappleFeats?.conversion),
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

export function grappleCircumstancesContent(actor) {
  const weapons = [...(actor?.items ?? [])].filter(i => i.type === "weapon" && i.system.equipped === true);
  return `<fieldset><legend>${loc`Grapple circumstances (Athletics)`}</legend><label><input name="grappleParticipantConfirmed" type="checkbox" /> ${loc`Held or pinned: the GC confirms I am a participant making the opposed Athletics check within an actual grapple (p.357).`}</label><label><input name="grappleSecondOpponent" type="checkbox" /> ${loc`This Grapple attempts a second opponent (−4)`}</label><label><input name="grappleHoldingTwo" type="checkbox" /> ${loc`I currently hold two opponents (−4 to Athletics; does not stack with the attempt penalty)`}</label><label><input name="grappleMuting" type="checkbox" /> ${loc`My Mute benefit still applies to this grapple check (−2)`}</label><label><input name="grappleDamageConversion" type="checkbox" /> ${loc`Convert damage for Injure or Use Opponent's Weapon (−4 unless an actual waiver applies)`}</label><label>${loc`My readied weapon for that conversion`} <select name="grappleConversionWeaponId"><option value="">${loc`Unarmed, or another participant's weapon (only my Bludgeon waiver)`}</option>${weapons.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("")}</select></label><label>${loc`Original damage type when no own weapon is selected`} <select name="grappleConversionFrom"><option value="subdual">${loc`Subdual`}</option><option value="lethal">${loc`Lethal`}</option></select></label><p>${loc`Confirm legal holds and the selected benefit at the table. Two opponents is the maximum; the second-opponent and Mute declarations describe the actual current situation.`}</p></fieldset>`;
}

rollPipeline.register({
  id: "grappleContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => {
    const feats = actor?.system?.activeFeatNames ?? [];
    if (key !== "athletics") return [];
    return [
      {
        at: 207,
        html: `<details><summary>${loc`Grapple circumstances and feats`}</summary>${grappleCircumstancesContent(actor)}<label><input name="grappleJointLock" type="checkbox" /> ${loc`Escaping: my grappler used Joint Lock on me (−4)`}</label>${feats.includes("Horde Mastery") ? `<label><input name="grappleAdvantageConfirmed" type="checkbox" /> ${loc`Horde Mastery: the GC confirms a 2-to-1 or greater advantage`}</label>` : ""}${feats.includes("Garrote Basics") ? `<label><input name="grappleGarrote" type="checkbox" /> ${loc`Garrote Basics: I hold a readied garrote`}</label>` : ""}</details>`
      }
    ];
  }
});

rollPipeline.register({
  id: "grappleSkillTerm",
  record: ["grappleFeats"],
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
