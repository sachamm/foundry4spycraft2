/** The Called Shot's Initiative Count cost on the attack card (see module/rules/called-shot.mjs). */
import { shiftCount } from "./dueling.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "calledShotControl",
  kinds: ["attack"],
  order: 9769,
  chatControls({ message, check, actor }) {
    const called = check.attackContext?.calledShot;
    if (!called || check.superseded || check.calledShotCount || !actor?.isOwner) return null;
    return [
      {
        label: loc`Called Shot: Initiative Count −${called.countCost}`,
        run: () => shiftCount(message, actor, -called.countCost, "calledShotCount", "Called Shot")
      }
    ];
  }
});
