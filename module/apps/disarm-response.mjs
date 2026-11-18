import { DISARM_SIZES } from "../rules/disarm.mjs";
import { readiedDisarmWeapons } from "../rules/disarm-response.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
export function disarmResponseContent(actor, weaponId = "") {
  const esc = foundry.utils.escapeHTML,
    state = readiedDisarmWeapons(actor.system, actor.items);
  return `<div class="spycraft2-roll-options"><p>Roll the opposed Standard Attack response for the exact readied weapon targeted by an incoming Disarm. Sure Grip gives +3 gear on this defense. Weapon transfer, counter-actions and conditions are resolved after comparing both results.</p><label>Weapon being disarmed <select name="weaponId"><option value="">Choose the targeted weapon</option>${state.weapons.map(w => `<option value="${esc(w.id)}"${w.id === weaponId ? " selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label><label>Actual attacker / weapon <input name="opponentLabel" maxlength="160" required /></label><label>Attacker weapon Size <select name="opponentWeaponSize"><option value="">Choose actual Size</option><option value="Unarmed">Unarmed (attacker Size minus two categories)</option>${DISARM_SIZES.map(s => `<option>${s}</option>`).join("")}</select></label><label>Attacker character Size (only if unarmed) <select name="opponentCharacterSize"><option value="">Choose actual Size</option>${DISARM_SIZES.map(s => `<option>${s}</option>`).join("")}</select></label><label><input name="incomingRanged" type="checkbox" /> The incoming Disarm uses a ranged weapon (no weapon-Size bonus for either participant)</label><label><input name="incomingProficient" type="checkbox" /> The attacker possesses the appropriate weapon proficiency (otherwise the Proficiency tag adds +2 error to both participants’ checks)</label><label><input name="lineOfSightConfirmed" type="checkbox" /> The attacker has line of sight to me</label><label><input name="rangeConfirmed" type="checkbox" /> I am within the attacker’s Reach (melee/unarmed) or CQB Range (ranged)</label><label><input name="confirmed" type="checkbox" /> The GC confirms a legal incoming Disarm targeting exactly this held weapon, the actual Sizes and attack mode</label></div>`;
}
export async function rollDisarmResponse(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const clock = JSON.stringify(expertiseCombatContext(actor));
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Resist Disarm: targeted weapon" },
      rejectClose: false,
      content: disarmResponseContent(actor, input.weaponId)
    });
    if (!input) return null;
  }
  const item = actor.items.get(input.weaponId);
  if (item?.type !== "weapon") throw Error("Choose the actual targeted owned weapon.");
  const context = {
      role: "defender",
      targetWeaponId: input.weaponId,
      ...Object.fromEntries(
        [
          "opponentLabel",
          "opponentWeaponSize",
          "opponentCharacterSize",
          "incomingRanged",
          "incomingProficient",
          "lineOfSightConfirmed",
          "rangeConfirmed",
          "confirmed"
        ].map(k => [k, input[k]])
      )
    },
    opts = { attackAction: "standard", targetAnimal: false, askContext: false, disarm: context },
    preview = actor.weaponAttack(item, opts);
  if (preview.blocked) throw Error(preview.reason);
  if (preview.firearm && preview.fireMode !== "single")
    throw Error("This opposed Standard Attack response requires Single-Shot mode.");
  const snapshot = JSON.stringify(preview),
    validate = () => {
      const current = actor.items.get(item.id);
      if (
        !actor.isOwner ||
        JSON.stringify(expertiseCombatContext(actor)) !== clock ||
        !current ||
        JSON.stringify(actor.weaponAttack(current, opts)) !== snapshot
      )
        throw Error(
          "The targeted weapon, incoming Disarm circumstances or Initiative Count changed. Review the response again."
        );
    };
  validate();
  return actor.rollAttack(item, { ...opts, validateAttackContext: validate });
}
