/** Shots spent by attacks and restored by Reload actions; the rules are in module/rules/ammunition-use.mjs. */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import {
  ammunitionState,
  reloadPlan,
  resupplyPlan,
  spendShotsPlan,
  unlimitedAmmunition
} from "../rules/ammunition-use.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";
import { loc } from "../i18n.mjs";

/** World setting "Count ammunition"; on unless turned off. */
export function ammunitionCounted() {
  try {
    return globalThis.game?.settings?.get?.("spycraft2", "countAmmunition") !== false;
  } catch {
    return true;
  }
}

/** A weapon item's ammunition state, or null when shots are not counted for it. */
export const weaponHasUnlimitedAmmunition = item =>
  item?.type === "weapon" && unlimitedAmmunition(item.system, currentCampaignRules().effects);

export function weaponAmmunition(item) {
  if (!ammunitionCounted() || item?.type !== "weapon" || typeof item.update !== "function" || !item.parent) return null;
  const state = ammunitionState(item.system);
  if (weaponHasUnlimitedAmmunition(item)) return null;
  return state.tracked ? state : null;
}

/** Take shots out of a weapon after an attack. Returns the plan, or null when shots are not counted. */
export async function spendWeaponShots(item, shots) {
  const state = weaponAmmunition(item);
  if (!state || !shots) return null;
  let plan;
  try {
    plan = spendShotsPlan(state, shots);
  } catch (error) {
    ui.notifications.warn(`${item.name}: ${error.message}`);
    return null;
  }
  await item.update({ "system.shotsLoaded": plan.shotsLoaded, "system.shotsSpare": plan.shotsSpare });
  if (plan.shotsLoaded === 0) ui.notifications.info(loc`${item.name} is empty.`);
  return plan;
}

/** One Reload action (a half action, p.359). */
export async function reloadWeapon(item) {
  if (!item?.isOwner) return null;
  if (unlimitedAmmunition(item.system, currentCampaignRules().effects))
    return refuse(loc`Bottomless Clip supplies this weapon without a Reload.`);
  let plan;
  try {
    plan = reloadPlan(ammunitionState(item.system));
  } catch (error) {
    return refuse(`${item.name}: ${error.message}`);
  }
  await item.update({ "system.shotsLoaded": plan.shotsLoaded, "system.shotsSpare": plan.shotsSpare });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: item.parent }),
    content: `<div class="spycraft2 chat-note"><p>${loc`Reload: ${esc(item.name)} takes ${plan.moved} shot(s) — ${plan.shotsLoaded} loaded, ${plan.shotsSpare} in reserve. A half action.`}</p></div>`
  });
  return plan;
}

/** Restore a weapon's printed supply, between missions or when the GC hands out more. */
export async function resupplyWeapon(item) {
  if (!item?.isOwner) return null;
  try {
    const plan = resupplyPlan(ammunitionState(item.system));
    await item.update({ "system.shotsLoaded": plan.shotsLoaded, "system.shotsSpare": plan.shotsSpare });
  } catch (error) {
    return refuse(`${item.name}: ${error.message}`);
  }
  return true;
}
