/** The Kick action's card controls: its Initiative Count cost and its damage roll (see module/rules/kick.mjs). */
import { shiftCount } from "./dueling.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "kickControls",
  kinds: ["attack"],
  order: 9761,
  chatControls({ message, check, actor }) {
    const kick = check.attackContext?.kick,
      trick = check.attackContext?.kickTrick,
      jab = check.attackContext?.doubleJab;
    if ((!kick && !trick && !jab) || check.superseded) return null;
    const controls = [];
    // Back Flip: a miss leaves the character flat-footed.
    if (trick?.key === "backFlip" && check.successConfirmed === false && !check.backFlipMiss)
      controls.push({
        label: loc`Back Flip miss: become flat-footed`,
        run: async () => {
          await message.update({ "flags.spycraft2.backFlipMiss": true });
          return setConditionStatus(actor, "flat-footed", true, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
        }
      });
    // Double Jab: each hit's damage loses 2 per die.
    const jabWeapon = jab && check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (jab && check.successConfirmed === true && jabWeapon)
      controls.push({
        label: loc`Roll Double Jab damage`,
        run: () => actor.rollDamage(jabWeapon, { doubleJab: true })
      });
    if (!kick) return controls.length ? controls : null;
    if (kick.countCost && !check.kickCount)
      controls.push({
        label: loc`Kick: Initiative Count −2`,
        run: () => shiftCount(message, actor, -kick.countCost, "kickCount", "Kick")
      });
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (check.successConfirmed === true && weapon)
      controls.push({
        label: loc`Roll Kick damage`,
        run: () => actor.rollDamage(weapon, { kick: true, kickTrick: trick?.key ?? null, includeSneakAttack: false })
      });
    return controls.length ? controls : null;
  }
});
