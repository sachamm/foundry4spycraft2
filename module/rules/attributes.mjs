import { attributeDamageState } from "./attribute-damage.mjs";
import { dartingStyleState } from "./darting-state.mjs";
import { superiorCoverState } from "./superior-cover.mjs";
import { twoWeaponStyleState } from "./two-weapon-state.mjs";
import { combatExpertiseState } from "./combat-expertise.mjs";
import { shakenRules, shakenSkillPenalty } from "./shaken.mjs";
import { loc } from "../i18n.mjs";
/** Attribute collapse p.15. Negative scores are legal damage results; do not silently clamp to zero. */
const COLLAPSE = {
  str: {
    get label() {
      return loc`Strength`;
    },
    conditions: ["Dazed", "Sprawled", "Helpless"],
    get text() {
      return loc`No actions; dazed, sprawled and helpless. May still speak.`;
    },
    immobile: true
  },
  dex: {
    get label() {
      return loc`Dexterity`;
    },
    conditions: ["Paralyzed"],
    get text() {
      return loc`Paralyzed, but may still speak. Only purely mental actions remain available; no Strength- or Dexterity-based checks.`;
    },
    immobile: true
  },
  con: {
    get label() {
      return loc`Constitution`;
    },
    conditions: ["Dead"],
    get text() {
      return loc`Immediately dies. Saving the character from death and persistent death-state handling require GC adjudication.`;
    },
    immobile: true
  },
  int: {
    get label() {
      return loc`Intelligence`;
    },
    conditions: ["Stunned"],
    get text() {
      return loc`Stunned and incapable of higher thought; no actions.`;
    },
    immobile: true
  },
  wis: {
    get label() {
      return loc`Wisdom`;
    },
    conditions: [],
    get text() {
      return loc`The GC determines Frenzied or Terrified with equal probability every 2d10 minutes. Sleep, stun or unconsciousness doubles the current episode duration.`;
    },
    episode: true
  },
  cha: {
    get label() {
      return loc`Charisma`;
    },
    conditions: ["Unconscious"],
    get text() {
      return loc`Falls into a coma and becomes unconscious; no actions.`;
    },
    immobile: true
  }
};
export function attributeCollapsePlan(system) {
  const entries = [];
  for (const [key, rule] of Object.entries(COLLAPSE)) {
    const score = system.abilities?.[key]?.value;
    if (Number.isFinite(score) && score <= 0) entries.push({ key, score, ...rule, conditions: [...rule.conditions] });
  }
  return {
    entries,
    conditions: [...new Set(entries.flatMap(e => e.conditions))],
    dead: entries.some(e => e.key === "con"),
    immobile: entries.some(e => e.immobile),
    wisdomEpisode: entries.some(e => e.episode)
  };
}
/** p.15: equal-probability mental episode and rolled duration, without inventing a cure or schedule. */
export function wisdomCollapseEpisode(
  system,
  { choiceDie, durationDice, sleeping = false, stunned = false, unconscious = false } = {}
) {
  if (!attributeCollapsePlan(system).wisdomEpisode) throw new Error(loc`Wisdom must currently be zero or lower.`);
  if (
    ![1, 2].includes(choiceDie) ||
    !Array.isArray(durationDice) ||
    durationDice.length !== 2 ||
    durationDice.some(d => !Number.isSafeInteger(d) || d < 1 || d > 10)
  )
    throw new Error(loc`Use one d2 and exactly two d10 results.`);
  if ([sleeping, stunned, unconscious].some(v => typeof v !== "boolean"))
    throw new Error(loc`Declare the applicable condition states.`);
  const collapsed = attributeCollapsePlan(system),
    doubleDuration =
      sleeping ||
      stunned ||
      unconscious ||
      collapsed.conditions.includes("Stunned") ||
      collapsed.conditions.includes("Unconscious"),
    baseMinutes = durationDice[0] + durationDice[1];
  return {
    condition: choiceDie === 1 ? "Frenzied" : "Terrified",
    choiceDie,
    durationDice: [...durationDice],
    baseMinutes,
    doubleDuration,
    minutes: baseMinutes * (doubleDuration ? 2 : 1)
  };
}

/** Current incapacities constrain character actions; involuntary saves and old damage settlement are separate. */
export function attributeActionBlock(
  system,
  { kind = "skill", ability = "", purelyMentalConfirmed = false, passiveAction = false } = {}
) {
  const damage = attributeDamageState(system);
  if (damage.needsReview) return damage.reason;
  if (shakenRules(system).needsReview)
    return loc`The GC must review the current Shaken sources before checks or actions.`;
  if (system.restraintReleaseReview?.needsReview)
    return loc`The GC must review the interrupted grapple release before further actions.`;
  if ((system.pendingRestraintMoves ?? []).length && passiveAction !== true)
    return loc`Complete the immediate Standard Move required by Escape Hold first.`;
  const collapse = attributeCollapsePlan(system),
    manual = system.conditionContext ?? {},
    conditions = new Set([
      ...collapse.conditions,
      ...(system.mentalLeapState?.unconscious || manual.unconscious ? ["Unconscious"] : []),
      ...(manual.dazed ? ["Dazed"] : []),
      ...(manual.stunned ? ["Stunned"] : []),
      ...(manual.dead ? ["Dead"] : [])
    ]);
  const unable = ["Dead", "Unconscious", "Stunned", "Dazed"].find(c => conditions.has(c));
  if (unable) return loc`${unable}: this character may take no actions.`;
  if (manual.sleeping === true && passiveAction !== true)
    return loc`Sleeping: only passive actions are available (p.342).`;
  if (collapse.conditions.includes("Paralyzed") || manual.paralyzed) {
    if (kind === "knowledge" || kind === "mentalAbility") return "";
    if (kind === "attack" || ["str", "dex"].includes(ability))
      return loc`Paralyzed: no attacks or Strength-/Dexterity-based checks; only purely mental actions are available.`;
    if (purelyMentalConfirmed !== true)
      return loc`Paralyzed: the GC must confirm this skill check is a purely mental action.`;
  }
  return "";
}

/** pp.341–342: vulnerability removes positive Dexterity and dodge bonuses, never penalties. */
export function attributeDefensePlan(system, { dodgeEntries = [] } = {}) {
  const collapse = system.attributeCollapse ?? attributeCollapsePlan(system),
    manual = system.conditionContext ?? {};
  const helpless =
    system.mentalLeapState?.unconscious === true ||
    ["helpless", "unconscious", "paralyzed", "sleeping", "bound"].some(k => manual[k] === true) ||
    collapse.conditions.some(c => ["Helpless", "Paralyzed", "Unconscious"].includes(c));
  const otherVulnerability =
    helpless ||
    !!system.encumbrance?.condition ||
    ["vulnerable", "blinded", "stunned", "sprawled", "held", "pinned"].some(k => manual[k] === true) ||
    collapse.conditions.some(c => ["Stunned", "Sprawled"].includes(c));
  const grade = system.uncannyDodge?.grade ?? 0,
    flatFooted = manual.flatFooted === true && grade < 5,
    vulnerable = otherVulnerability || flatFooted;
  const dexterity = system.abilities?.dex?.mod ?? 0,
    dodgeBonuses = dodgeEntries.filter(e => e.type === "dodge" && e.value > 0).reduce((n, e) => n + e.value, 0),
    dodgeLost = vulnerable ? dodgeBonuses : 0;
  return {
    helpless,
    vulnerable,
    dexterity: otherVulnerability || (flatFooted && grade < 1) ? Math.min(0, dexterity) : dexterity,
    dodgeLost,
    dodgeBonuses
  };
}

/** Sickened p.342: a single condition penalty, independent of attribute penalties. */
export function conditionRollPenalties(system) {
  const shaken = shakenRules(system);
  const sickened = system.conditionContext?.sickened === true,
    bound = system.conditionContext?.bound === true,
    entangled = bound || system.conditionContext?.entangled === true,
    value = sickened ? -2 : 0;
  const sprawled =
      system.conditionContext?.sprawled === true ||
      (system.attributeCollapse ?? attributeCollapsePlan(system)).conditions.includes("Sprawled"),
    prone = system.conditionContext?.prone === true;
  return {
    sprawled,
    prone,
    // Prone Stance (Submission Basics, p.188): no attack penalty for being prone.
    meleeAttack:
      prone && !(system.combatStance?.key === "prone" && system.activeFeatNames?.includes("Submission Basics"))
        ? -2
        : 0,
    sickened,
    bound,
    entangled,
    attack:
      value -
      twoWeaponStyleState(system).penalty -
      combatExpertiseState(system).penalty -
      superiorCoverState(system).penalty -
      dartingStyleState(system).penalty +
      shaken.attackPenalty +
      (entangled ? -2 : 0) +
      (sprawled ? -2 : 0),
    skill: value,
    save: value,
    damage: value,
    dexSkill: entangled ? -4 : 0
  };
}

/** Drunk p.341 affects checks using Dexterity or Wisdom, without changing either score. */
export function conditionAbilityPenalty(system, ability) {
  return system.conditionContext?.drunk === true && ["dex", "wis"].includes(ability) ? -2 : 0;
}
export function conditionSkillPenalty(system, ability) {
  return (
    -twoWeaponStyleState(system).skillPenalty -
    combatExpertiseState(system).penalty -
    superiorCoverState(system).penalty -
    dartingStyleState(system).penalty +
    (ability === "dex" ? conditionRollPenalties(system).dexSkill : 0) +
    conditionAbilityPenalty(system, ability) +
    shakenSkillPenalty(system, ability)
  );
}
