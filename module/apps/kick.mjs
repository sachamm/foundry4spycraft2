/** The Kick action's card controls: its Initiative Count cost and its damage roll (see module/rules/kick.mjs). */
import { shiftCount } from "./dueling.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "kickControls",
  kinds: ["attack"],
  order: 9761,
  chatControls({ message, check, actor }) {
    const kick = check.attackContext?.kick;
    if (!kick || check.superseded) return null;
    const controls = [];
    if (kick.countCost && !check.kickCount)
      controls.push({
        label: loc`Kick: Initiative Count −2`,
        run: () => shiftCount(message, actor, -kick.countCost, "kickCount", "Kick")
      });
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (check.successConfirmed === true && weapon)
      controls.push({
        label: loc`Roll Kick damage`,
        run: () => actor.rollDamage(weapon, { kick: true, includeSneakAttack: false })
      });
    return controls.length ? controls : null;
  }
});
