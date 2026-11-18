import { compatibleAmmunition, ammunitionStockpilePlan } from "../rules/ammunition.mjs";
import { loc } from "../i18n.mjs";
/** Read-only source calculation. Actual acquisition/payment is recorded separately. */
export async function planAmmunitionStockpile(item, options = {}) {
  const catalog = CONFIG.SPYCRAFT.tables.ammunitionCatalog ?? [],
    choices = compatibleAmmunition(item.system, catalog),
    esc = foundry.utils.escapeHTML;
  if (!choices.length)
    return ui.notifications.warn(
      loc`This weapon needs a supported ammunition category and projectile caliber/model before calculating Table 4.62 stockpiles.`
    );
  let input = options;
  if (!input.ammunitionId) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Stockpile calculation: ${item.name}` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>${loc`Ammunition`} <select name="ammunitionId">${choices.map(a => `<option value="${esc(a.id)}">${esc(a.name)}${a.firstStockpile ? " (first stockpile permitted)" : ""}</option>`).join("")}</select></label><label>${loc`Stockpiles`} <input name="stockpiles" type="number" min="1" step="1" value="1" /></label>${choices.some(a => a.firstStockpile) ? `<label><input name="initial" type="checkbox" /> ${loc`Calculate the included stockpile for one weapon (including a conversion if needed)`}</label>` : ""}<p>${loc`Use the selected supplied ammunition code on the item. Listed prices are per stockpile; weight is per projectile.`}</p></div>`
    });
    if (!input) return null;
    input = { ...input, stockpiles: Number(input.stockpiles), initial: input.initial === true };
  }
  let plan;
  try {
    plan = ammunitionStockpilePlan(item.system, catalog, input);
  } catch (error) {
    ui.notifications.warn(error.message);
    return null;
  }
  if (options.ammunitionId) return plan;
  await foundry.applications.api.DialogV2.input({
    window: { title: loc`Stockpile calculation` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${esc(item.name)}: ${esc(plan.ammunitionName)}</p><p>${loc`${plan.stockpiles} stockpile(s) × ${plan.shotsPerStockpile} shots = ${plan.totalShots} shots. Weight: ${plan.totalWeight.toLocaleString("en-US", { maximumFractionDigits: 6 })} lbs.`}</p><p>${loc`Cost: ${plan.upgradeCost} upgrades${plan.commonItemCost === null ? "" : loc` or ${plan.commonItemCost} Common Items`}.${plan.convertedInitial ? loc` Initial conversion discount included.` : ""}`}</p><p>${loc`Use this calculation when recording the stockpile’s acquisition and payment.`}</p>${plan.reviewNotes.map(note => `<p>${esc(note)}</p>`).join("")}</div>`
  });
  return plan;
}
