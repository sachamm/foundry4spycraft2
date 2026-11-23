/** Fire-Team Supremacy’s free final attack from the Main tab (see module/rules/team-feats.mjs). */
import { limitedFinalAttack, finalAttackOptions, finalWeaponReady } from "./final-attack.mjs";
import { fireTeamSupremacyPlan } from "../rules/team-feats.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { formDialog, raw, weaponField } from "./dialog-kit.mjs";
import { loc } from "../i18n.mjs";

export async function takeFireTeamSupremacy(actor, options = {}) {
  if (!actor.isOwner) return null;
  let input = options;
  if (!Object.hasOwn(input, "advantageConfirmed")) {
    input = await formDialog({
      title: loc`Fire-Team Supremacy`,
      intro: loc`Once per round, make 1 final attack as a free action while your side has a 2-to-1 or greater advantage (p.174).`,
      fields: [
        weaponField(actor, loc`Your readied weapon`, { ready: finalWeaponReady }),
        raw(standardAttackContextContent(actor)),
        { check: "advantageConfirmed", label: loc`The GC confirms a 2-to-1 or greater advantage` },
        { check: "confirmed", label: loc`This final attack is legal now` }
      ]
    });
    if (!input) return null;
  }
  const opts = finalAttackOptions(input),
    item = actor.items.get(input.weaponId);
  if (!finalWeaponReady(item)) throw new Error(loc`Choose an owned readied weapon for the final attack.`);
  const plan = () => fireTeamSupremacyPlan(actor.system, expertiseCombatContext(actor), input),
    original = plan(),
    preview = actor.weaponAttack(item, opts);
  if (preview.blocked || (preview.ranged && !Number.isFinite(opts.distanceFeet)))
    throw new Error(preview.reason || loc`Enter the measured distance for a ranged final attack.`);
  const signature = JSON.stringify(preview),
    receipt = { ...original, weaponId: item.id, weaponUuid: item.uuid, id: foundry.utils.randomID() };
  // No Initiative Count check here: the plan pins the combat, round and combatant, and the feat is not held to the
  // character's own Count (p.174).
  return limitedFinalAttack(actor, "fireTeamSupremacy", {
    weaponId: item.id,
    options: opts,
    receipt,
    changed() {
      const w = actor.items.get(item.id);
      return (
        JSON.stringify(plan()) !== JSON.stringify(original) ||
        !finalWeaponReady(w) ||
        JSON.stringify(actor.weaponAttack(w, opts)) !== signature
      );
    },
    changedMessage: loc`The weapon, declaration or reserved use changed. Review it again.`
  });
}
