/**
 * Called Shot, a trick on a Standard Attack (p.355): while aiming with a ranged weapon, or adjacent to the target
 * with an unarmed attack or a readied melee weapon. The attack takes −3, −6 or −9 for the target's partial, moderate
 * or full armor, −1 more for a helmet; the character's Initiative Count drops by 5; a hit ignores all damage reduction
 * from armor and other gear. Sharpshooter Mastery (p.183) reduces the attack penalty by 3 (minimum 0).
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const CALLED_SHOT_ARMOR = Object.freeze({ none: 0, partial: 3, moderate: 6, full: 9 });
export const CALLED_SHOT_COUNT = 5;

export function calledShotPlan(
  system,
  {
    calledShot = "",
    calledShotHelmet = false,
    calledShotAdjacent = false,
    attackAction = "standard",
    ranged,
    aimed
  } = {}
) {
  if (!calledShot) return null;
  if (!Object.hasOwn(CALLED_SHOT_ARMOR, calledShot))
    return { blocked: true, reason: loc`Choose the target’s armor for the Called Shot.` };
  if (attackAction !== "standard") return { blocked: true, reason: loc`A Called Shot is made with a Standard Attack.` };
  if (ranged && aimed !== true) return { blocked: true, reason: loc`A ranged Called Shot needs an Aim action.` };
  if (!ranged && calledShotAdjacent !== true)
    return { blocked: true, reason: loc`A melee or unarmed Called Shot is made against an adjacent target.` };
  const raw = CALLED_SHOT_ARMOR[calledShot] + (calledShotHelmet === true ? 1 : 0),
    reduction = system?.activeFeatNames?.includes("Sharpshooter Mastery") ? 3 : 0,
    penalty = Math.max(0, raw - reduction);
  return {
    blocked: false,
    version: 1,
    armor: calledShot,
    helmet: calledShotHelmet === true,
    attackPenalty: -penalty,
    countCost: CALLED_SHOT_COUNT,
    note: loc`Called Shot: attack −${penalty}${reduction ? loc` (Sharpshooter Mastery takes 3 off)` : ""}; your Initiative Count drops by 5; a hit ignores all damage reduction from armor and other gear (p.355).`
  };
}

rollPipeline.register({
  id: "calledShotContent:attack",
  dialogs: ["attack", "rangedAttack"],
  order: 76,
  dialog: () => [
    {
      at: 66,
      html: `<details><summary>${loc`Called Shot (p.355)`}</summary><label>${loc`Target’s armor`} <select name="calledShot"><option value="">${loc`No Called Shot`}</option><option value="none">${loc`None (−0)`}</option><option value="partial">${loc`Partial (−3)`}</option><option value="moderate">${loc`Moderate (−6)`}</option><option value="full">${loc`Full (−9)`}</option></select></label><label><input type="checkbox" name="calledShotHelmet" /> ${loc`The target wears a helmet (−1 more)`}</label><label><input type="checkbox" name="calledShotAdjacent" /> ${loc`Melee or unarmed: the target is adjacent`}</label></details>`
    }
  ],
  read: ({ entered }) =>
    entered?.calledShot
      ? {
          calledShot: String(entered.calledShot),
          calledShotHelmet: entered.calledShotHelmet === true,
          calledShotAdjacent: entered.calledShotAdjacent === true
        }
      : null
});

rollPipeline.register({
  id: "calledShotAttackTerm",
  kinds: ["attack"],
  order: 9194,
  terms({ system, options, ranged, stance }) {
    const plan = calledShotPlan(system, {
      calledShot: options.calledShot ?? "",
      calledShotHelmet: options.calledShotHelmet === true,
      calledShotAdjacent: options.calledShotAdjacent === true,
      attackAction: stance?.attackAction ?? options.attackAction ?? "standard",
      ranged,
      aimed: stance?.aimed === true || (stance?.aimBonus ?? 0) > 0
    });
    if (!plan) return null;
    return {
      key: "calledShot",
      plan: plan.blocked ? null : plan,
      rowAt: 290,
      rows: plan.blocked ? [] : [[loc`Called Shot`, plan.attackPenalty]],
      blockAt: 201,
      blocked: plan.blocked ? plan.reason : "",
      noteAt: 502,
      notes: plan.blocked ? [] : [plan.note]
    };
  }
});
