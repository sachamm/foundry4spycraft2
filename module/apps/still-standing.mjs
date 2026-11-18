import { stillStandingSource } from "../rules/still-standing.mjs";
import { loc } from "../i18n.mjs";
export function stillStandingSaveContent(system, key) {
  if (key !== "fort") return "";
  try {
    if (!stillStandingSource(system)) return "";
  } catch (error) {
    return `<p>${foundry.utils.escapeHTML(error.message)}</p>`;
  }
  return `<fieldset><legend>${loc`Still Standing`}</legend><p>${loc`Your earned Brawler Ploy gives +8 on one Fortitude save only: the save to stay on your feet when a takedown-quality attack hits.`}</p><label><input name="resistingTakedown" type="checkbox" /> ${loc`This Fortitude save resists that attack’s takedown`}</label><label><input name="takedownAttackConfirmed" type="checkbox" /> ${loc`The GC confirms this legal save follows a real hit from a takedown-quality attack`}</label><p>${loc`Other damage events or effects that resemble takedown do not establish this attack-specific purpose. Resolve the save DC and its outcome separately.`}</p></fieldset>`;
}
