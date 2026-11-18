/** Fire-Team Supremacy’s free final attack from the Main tab (see module/rules/team-feats.mjs). */
import { postFinalAttack, finalAttackOptions, finalWeaponReady } from "./final-attack.mjs";
import { fireTeamSupremacyPlan } from "../rules/team-feats.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { loc } from "../i18n.mjs";

export async function takeFireTeamSupremacy(actor, options = {}) {
  if (!actor.isOwner) return null;
  let input = options;
  if (!Object.hasOwn(input, "advantageConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      weapons = actor.items
        .filter(finalWeaponReady)
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Fire-Team Supremacy` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Once per round, make 1 final attack as a free action while your side has a 2-to-1 or greater advantage (p.174).`}</p><label>${loc`Your readied weapon`} <select name="weaponId">${weapons}</select></label>${standardAttackContextContent(actor)}<label><input name="advantageConfirmed" type="checkbox" /> ${loc`The GC confirms a 2-to-1 or greater advantage`}</label><label><input name="confirmed" type="checkbox" /> ${loc`This final attack is legal now`}</label></div>`
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
  return actor.useLimitedAbility(
    "fireTeamSupremacy",
    async status => {
      const validate = () => {
        const w = actor.items.get(item.id),
          counter = actor.system.resourceUses?.fireTeamSupremacy;
        if (
          JSON.stringify(plan()) !== JSON.stringify(original) ||
          !finalWeaponReady(w) ||
          JSON.stringify(actor.weaponAttack(w, opts)) !== signature ||
          counter?.epoch !== status.epoch ||
          counter.used !== status.used + 1
        )
          throw new Error(loc`The weapon, declaration or reserved use changed. Review it again.`);
      };
      return postFinalAttack(actor, item.id, opts, receipt, validate);
    },
    { workflow: "fireTeamSupremacy" }
  );
}
