/**
 * Unarmed Combat feat tricks that ride a Trip, Bull Rush or Feint skill check (pp.185–189). Each is declared in the
 * skill dialog; the check gains any bonus and the card states the effect on success, with the character's
 * standard unarmed damage worked out, for the players and GC to apply.
 *
 *   Trip (Acrobatics)        Body Slam (Brawling Moves), Hip Toss (Wrestling Moves), Double Hurl (Wrestling Supremacy)
 *   Bull Rush (Athletics)    Torpedo (Rolling Supremacy): +2 to the check
 *   Feint                    Mud in Your Eye (Dirty Fighting Moves): +4, once per opponent per combat;
 *                            Fake Out (Brawling Moves)
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

/** The character's standard unarmed damage as a formula, e.g. "1d4+2". */
export function unarmedDamageFormula(system) {
  const u = system?.unarmed ?? {},
    dice = 1 + (Number(u.extraDice) || 0),
    bonus = Number(u.damageBonus) || 0;
  return `${dice}d${u.die ?? 3}${bonus ? (bonus > 0 ? "+" : "") + bonus : ""}`;
}

export const SKILL_TRICKS = Object.freeze({
  bodySlam: { feat: "Brawling Moves", name: "Body Slam", check: "trip", page: 185 },
  hipToss: { feat: "Wrestling Moves", name: "Hip Toss", check: "trip", page: 189 },
  doubleHurl: { feat: "Wrestling Supremacy", name: "Double Hurl", check: "trip", page: 189 },
  torpedo: { feat: "Rolling Supremacy", name: "Torpedo", check: "bull-rush", bonus: 2, page: 187 },
  mudInYourEye: { feat: "Dirty Fighting Moves", name: "Mud in Your Eye", check: "feint", bonus: 4, page: 185 },
  fakeOut: { feat: "Brawling Moves", name: "Fake Out", check: "feint", page: 185 }
});

const EFFECTS = {
  bodySlam: u =>
    loc`Body Slam: on success you may become sprawled to deal ${u} × 2 extra subdual damage (double your unarmed damage) to the target`,
  hipToss: u =>
    loc`Hip Toss: on success the target also takes your unarmed damage (${u}) and makes a Fortitude save (DC 10 + that damage) or is fatigued for 1d4 rounds`,
  doubleHurl: u =>
    loc`Double Hurl: on success the target also takes double your unarmed damage (${u} × 2), plus the same amount of flash and of bang damage`,
  torpedo: u =>
    loc`Torpedo: a full-action Bull Rush at +2; on success the target takes double your unarmed damage (${u} × 2)`,
  mudInYourEye: () => loc`Mud in Your Eye: +4 on this Feint (once per opponent per combat)`,
  fakeOut: () =>
    loc`Fake Out: if this Feint succeeds, your Defense against the target’s attacks rises by 2 for 1 full round`
};

const CHECKS = { trip: ["acrobatics"], "bull-rush": ["athletics"], feint: ["sleightOfHand", "impress"] };

export function skillTrickPlan(system, key, check, { skillTrick = "", skillTrickOnceConfirmed = false } = {}) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (!skillTrick) return empty;
  const d = Object.hasOwn(SKILL_TRICKS, skillTrick) ? SKILL_TRICKS[skillTrick] : null;
  if (!d || !system?.activeFeatNames?.includes(d.feat))
    return { ...empty, blockedReason: loc`That trick needs its feat.` };
  if (check?.id !== d.check || !CHECKS[d.check].includes(key))
    return { ...empty, blockedReason: loc`${d.name} rides a different check.` };
  if (skillTrick === "mudInYourEye" && skillTrickOnceConfirmed !== true)
    return {
      ...empty,
      blockedReason: loc`Confirm Mud in Your Eye has not been used against this opponent this combat.`
    };
  return {
    evidence: { version: 1, key: skillTrick, feat: d.feat, bonus: d.bonus ?? 0 },
    bonuses: [],
    sizeBonus: d.bonus ?? 0,
    blockedReason: "",
    notes: [`${EFFECTS[skillTrick](unarmedDamageFormula(system))} (p.${d.page}).`]
  };
}

rollPipeline.register({
  id: "skillTrickContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => {
    const owned = Object.entries(SKILL_TRICKS).filter(
      ([, d]) => CHECKS[d.check].includes(key) && actor?.system?.activeFeatNames?.includes(d.feat)
    );
    return [
      {
        at: 206,
        html: owned.length
          ? `<details><summary>${loc`Unarmed trick on this check`}</summary><label>${loc`Trick`} <select name="skillTrick"><option value="">${loc`None`}</option>${owned
              .map(([k, d]) => `<option value="${k}">${d.name} (${d.feat})</option>`)
              .join(
                ""
              )}</select></label>${owned.some(([k]) => k === "mudInYourEye") ? `<label><input name="skillTrickOnceConfirmed" type="checkbox" /> ${loc`Mud in Your Eye: not yet used against this opponent this combat`}</label>` : ""}</details>`
          : ""
      }
    ];
  }
});

rollPipeline.register({
  id: "skillTrickSkillTerm",
  kinds: ["skill"],
  order: 9236,
  terms({ system, skillKey, check, input }) {
    return skillPlanTerm("skillTrick", skillTrickPlan(system, skillKey, check, input ?? {}), {
      noteAt: 46,
      blockAt: 23
    });
  }
});
