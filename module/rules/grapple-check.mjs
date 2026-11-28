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
  synergyText: ""
});

export function grappleSkillChecks(key, checks = []) {
  return key === "athletics" ? [...checks.filter(c => c.id !== "grapple"), { ...GRAPPLE_CHECK }] : checks;
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
  const second = grappleHoldingTwo === true || (inGrapple && grappleSecondOpponent === true),
    muting = inGrapple && grappleMuting === true;
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
      ...(second ? [{ source: loc`Second grapple opponent`, value: -4 }] : []),
      ...(muting ? [{ source: loc`Mute grapple benefit`, value: -2 }] : []),
      ...(conversion?.attackPenalty
        ? [{ source: loc`Grapple damage conversion`, value: conversion.attackPenalty }]
        : [])
    ],
    notes = [
      ...(proneStance ? [loc`Prone Stance: +1 on this Grapple check (p.188).`] : []),
      ...(horde ? [loc`Horde Mastery: +1 morale with a 2-to-1 or greater advantage (p.174).`] : []),
      ...(garrote
        ? [loc`Garrote Basics: threat range +2 with the readied garrote; an opponent you hold becomes mute (p.178).`]
        : []),
      ...(jointLock ? [loc`Joint Lock: −4 on this escape check (p.188).`] : []),
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
      bonuses.length || garrote || conversion
        ? {
            version: 1,
            proneStance,
            horde,
            garrote,
            jointLock,
            second,
            muting,
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

rollPipeline.register({
  id: "grappleChecks",
  order: 5058,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => grappleSkillChecks(skillKey, checks)
});

export function grappleCircumstancesContent(actor) {
  const weapons = [...(actor?.items ?? [])].filter(i => i.type === "weapon" && i.system.equipped === true);
  return `<fieldset><legend>${loc`Grapple circumstances (Athletics)`}</legend><label><input name="grappleSecondOpponent" type="checkbox" /> ${loc`This Grapple attempts a second opponent (−4)`}</label><label><input name="grappleHoldingTwo" type="checkbox" /> ${loc`I currently hold two opponents (−4 to Athletics; does not stack with the attempt penalty)`}</label><label><input name="grappleMuting" type="checkbox" /> ${loc`My Mute benefit still applies to this grapple check (−2)`}</label><label><input name="grappleDamageConversion" type="checkbox" /> ${loc`Convert damage for Injure or Use Opponent's Weapon (−4 unless an actual waiver applies)`}</label><label>${loc`My readied weapon for that conversion`} <select name="grappleConversionWeaponId"><option value="">${loc`Unarmed, or another participant's weapon (only my Bludgeon waiver)`}</option>${weapons.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("")}</select></label><label>${loc`Original damage type when no own weapon is selected`} <select name="grappleConversionFrom"><option value="subdual">${loc`Subdual`}</option><option value="lethal">${loc`Lethal`}</option></select></label><p>${loc`Confirm legal holds and the selected benefit at the table. Two opponents is the maximum; the second-opponent and Mute declarations describe the actual current situation.`}</p></fieldset>`;
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
