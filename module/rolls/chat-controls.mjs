/**
 * Buttons added under a posted check. The caller has already confirmed that the viewer owns the acting
 * character and may see the result; each entry adds its own conditions.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { hasStrut } from "../rules/strut.mjs";
import { unnervingEligible } from "../rules/unnerving.mjs";

// A damaging attack's added stress may be recorded after its ordinary outcome is resolved.
rollPipeline.register({
  id: "unnervingControl",
  chatControls({ message, check, actor, user }) {
    if (!(message.isAuthor || user.isGM) || !unnervingEligible(actor.system, check)) return null;
    return [{ label: "Resolve Unnerving stress", run: () => actor.resolveUnnerving(message) }];
  }
});

// Strut can follow a resolved attack, so it has a separate receipt control.
rollPipeline.register({
  id: "strutControl",
  kinds: ["attack"],
  chatControls({ message, check, actor }) {
    if (
      !hasStrut(actor.system) ||
      check.superseded ||
      check.strutPoolId ||
      !(check.threatConfirmed || check.criticalSuccess)
    )
      return null;
    if (
      !(check.unarmed || check.weaponProficiency === "unarmed" || check.attackContext?.ranged === false) ||
      !check.rollCombat?.id
    )
      return null;
    return [{ label: "Strut: posture next half action", run: () => actor.useStrut(message) }];
  }
});
