import { completeCharacterTarget } from "./character-target.mjs";
import { standardAttackContextContent, standardAttackContextInput } from "./standard-attack-context.mjs";
import { DISARM_SIZES } from "../rules/disarm.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
/** No automatic weapon transfer or opponent-condition writes. */
export async function rollDisarm(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const clock = JSON.stringify(expertiseCombatContext(actor));
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    const esc = foundry.utils.escapeHTML,
      choices = actor.items
        .filter(i => i.type === "weapon")
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await formDialog({
      title: loc`Disarm opposed attack check`,
      intro: loc`This rolls your part of the opposed Standard Attack check. The GC confirms the opponent’s actual held weapon Size and compares both results. A ranged attempt must be within CQB Range; a melee/unarmed attempt within Reach. A ranged weapon gains no weapon-Size bonus. This action is not a final attack.`,
      fields: [
        { select: "weaponId", label: loc`Your readied weapon (or Unarmed Gear entry)`, optionsHtml: raw(choices) },
        { text: "opponentLabel", label: loc`Opponent / actual weapon`, maxlength: 160 },
        raw(standardAttackContextContent(actor, { includeCheapShot: false })),
        {
          select: "opponentWeaponSize",
          label: loc`Opponent weapon Size`,
          options: [["", loc`Choose actual Size`]],
          optionsHtml: raw(DISARM_SIZES.map(s => `<option value="${s}">${s}</option>`).join(""))
        },
        {
          check: "opponentArmedConfirmed",
          label: loc`The opponent holds the declared weapon; unarmed opponents cannot be disarmed`
        },
        { check: "lineOfSightConfirmed", label: loc`I have line of sight to the opponent` },
        { check: "rangeConfirmed", label: loc`The opponent is within my Reach (melee/unarmed) or CQB Range (ranged)` },
        {
          check: "confirmed",
          label: loc`The GC confirms this actual weapon Size, legal Disarm and action/ammunition costs`
        }
      ]
    });
    if (!input) return null;
  }
  const context = Object.fromEntries(
      [
        "confirmed",
        "opponentLabel",
        "opponentWeaponSize",
        "opponentArmedConfirmed",
        "lineOfSightConfirmed",
        "rangeConfirmed"
      ].map(k => [k, input[k]])
    ),
    opts = await completeCharacterTarget(actor, actor.items.get(input.weaponId)?.system, {
      ...standardAttackContextInput(input),
      attackAction: "standard",
      disarm: context
    });
  if (!opts) return null;
  const hasDistance = Number.isFinite(opts.distanceFeet);
  const item = actor.items.get(input.weaponId);
  if (item?.type !== "weapon" || item.system.equipped !== true || item.system.carried === false || item.system.reserve)
    throw new Error(loc`Choose your actual owned readied weapon.`);
  const preview = actor.weaponAttack(item, opts);
  if (
    preview.ranged &&
    (!hasDistance ||
      !Number.isFinite(opts.distanceFeet) ||
      opts.distanceFeet < 0 ||
      opts.distanceFeet > (actor.system.cqbRange ?? 30))
  )
    throw new Error(loc`Enter the actual nonnegative target distance within CQB Range.`);
  if (preview.blocked || (preview.firearm && preview.fireMode !== "single"))
    throw new Error(preview.reason || loc`Disarm requires Single-Shot mode for this Standard Attack check.`);
  const snapshot = JSON.stringify(preview),
    validate = () => {
      const current = actor.items.get(input.weaponId);
      if (
        !actor.isOwner ||
        JSON.stringify(expertiseCombatContext(actor)) !== clock ||
        !current ||
        current.system.equipped !== true ||
        current.system.carried === false ||
        current.system.reserve ||
        JSON.stringify(actor.weaponAttack(current, opts)) !== snapshot
      )
        throw new Error(
          loc`The weapon, Disarm circumstances or Initiative Count changed. Review the opposed check again.`
        );
    };
  validate();
  return actor.rollAttack(item, { ...opts, validateAttackContext: validate });
}
