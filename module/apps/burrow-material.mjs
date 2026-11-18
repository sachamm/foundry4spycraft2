import { burrowCapabilities, burrowMaterialPlan } from "../rules/environment.mjs";
/** Read-only material check; no token movement, terrain alteration, resource use or follower adjudication. */
export async function checkBurrowMaterial(actor) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const initial = burrowCapabilities(actor.system);
  if (!initial) return ui.notifications.warn("An active Burrow quality and valid Strength are required.");
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: "Burrow — material check" },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>Use the material’s Damage save bonus at one-inch thickness. Strength ${initial.strength} permits a bonus of +${initial.maximumMaterialSave} or less. This checks the rule; it does not move a token or alter the map.</p><label>One-inch material Damage save bonus <input name="damageSaveBonus" type="number" step="1" value="6" /></label><label>Action <select name="action"><option value="move">Move while burrowing</option><option value="run">Run while burrowing</option></select></label><label><input name="followerHasBurrow" type="checkbox" /> The follower also possesses Burrow</label></div>`
  });
  if (!input) return null;
  let plan;
  try {
    if (typeof input.damageSaveBonus === "string" && !input.damageSaveBonus.trim())
      throw new Error("Enter the one-inch material Damage save bonus.");
    plan = burrowMaterialPlan(actor.system, {
      damageSaveBonus: Number(input.damageSaveBonus),
      action: input.action,
      followerHasBurrow: input.followerHasBurrow === true
    });
  } catch (error) {
    ui.notifications.warn(error.message);
    return null;
  }
  const esc = foundry.utils.escapeHTML;
  await foundry.applications.api.DialogV2.input({
    window: { title: "Burrow — result" },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p><b>${plan.allowed ? "Burrowing permitted by this quality." : "Burrowing blocked."}</b></p><p>Strength ${plan.strength}; one-inch material bonus ${plan.damageSaveBonus >= 0 ? "+" : ""}${plan.damageSaveBonus}; maximum +${plan.maximumMaterialSave}.</p>${[...plan.reasons, ...plan.notes].map(note => `<p>${esc(note)}</p>`).join("")}<p>Run actions are always forbidden while burrowing. Apply normal movement conditions and have the GC determine material statistics and follower access (p.446).</p></div>`
  });
  return plan;
}
