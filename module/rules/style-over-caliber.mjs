/**
 * Style Over Caliber, p.183: when attacking with any pistol, the character may deal 1d10+2 instead of the weapon's
 * standard damage. Only the standard damage is replaced; other damage, qualities and effects stay.
 *
 * A pistol is a Handgun-proficiency weapon from one of the pistol or revolver tables (Tables 4.36–4.42). A weapon
 * the GC built by hand without a source table counts when its proficiency is Handgun.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const STYLE_OVER_CALIBER_DAMAGE = "1d10+2";

export function isPistol(weapon = {}) {
  if (weapon.proficiency !== "handgun") return false;
  const table = String(weapon.sourceTable ?? "");
  return !table || /pistol|revolver/i.test(table);
}

export const styleOverCaliberEligible = (system, weapon) =>
  system?.activeFeatNames?.includes("Style Over Caliber") === true && isPistol(weapon);

/** The weapon as its damage roll sees it: standard damage replaced when the player chose to. */
export function styleOverCaliberWeapon(system, weapon, { styleOverCaliber = false } = {}) {
  if (styleOverCaliber !== true) return weapon;
  if (!styleOverCaliberEligible(system, weapon)) throw new Error(loc`Style Over Caliber needs the feat and a pistol.`);
  return { ...weapon, damage: STYLE_OVER_CALIBER_DAMAGE, styleOverCaliber: true };
}

rollPipeline.register({
  id: "styleOverCaliberContent:damage",
  dialogs: ["damage"],
  order: 32,
  dialog: ({ actor, item }) => [
    {
      at: 46,
      html: styleOverCaliberEligible(actor?.system, item?.system)
        ? `<label><input type="checkbox" name="styleOverCaliber" /> ${loc`Style Over Caliber: deal 1d10+2 instead of this pistol’s standard damage (p.183)`}</label>`
        : ""
    }
  ],
  read: (context, input) => (input?.styleOverCaliber === true ? { styleOverCaliber: true } : null)
});
rollPipeline.register({ id: "styleOverCaliberRecord", order: 9599, record: ["styleOverCaliber"] });
