/**
 * Display names that come from the rules data rather than from the code: skills, their named checks, feat trees,
 * gear pick categories and bonus targets.
 *
 * They are English in the data. Once the language is known (`i18nInit`), each one that has a translation under
 * SPYCRAFT.Text is replaced in CONFIG.SPYCRAFT, so every sheet and dialog that reads the table shows it translated.
 * The keys of those tables, which the rules use, are never changed. Names the rules compare (feats, class
 * abilities, compendium entries) are deliberately not here.
 */
import { keyOf } from "./i18n.mjs";

/** Every translatable display name in the configuration, as [holder, property] pairs. */
export function configText(cfg) {
  const out = [];
  const plain = (holder, property) => {
    const descriptor = holder && Object.getOwnPropertyDescriptor(holder, property);
    // A getter is already read through `loc` each time it is shown.
    if (descriptor && !descriptor.get && typeof descriptor.value === "string" && descriptor.value)
      out.push([holder, property]);
  };
  for (const skill of Object.values(cfg.skills ?? {})) {
    plain(skill, "name");
    for (const check of skill.checks ?? []) plain(check, "name");
  }
  for (const proficiency of Object.values(cfg.proficiencies ?? {})) plain(proficiency, "label");
  for (const table of ["featTrees", "gearPicks", "bonusTargets"]) {
    for (const key of Object.keys(cfg[table] ?? {})) plain(cfg[table], key);
  }
  return out;
}

/** The English display names, for the language file. */
export function configStrings(cfg) {
  return [...new Set(configText(cfg).map(([holder, property]) => holder[property]))];
}

/** Replace each display name that has a translation. Returns how many changed; English changes nothing. */
export function localizeConfig(cfg, i18n = globalThis.game?.i18n) {
  if (!i18n?.has) return 0;
  let changed = 0;
  for (const [holder, property] of configText(cfg)) {
    const english = holder[property];
    const key = `SPYCRAFT.Text.${keyOf(english)}`;
    if (!i18n.has(key)) continue;
    const translated = i18n.localize(key);
    if (typeof translated === "string" && translated !== key && translated !== english) {
      holder[property] = translated;
      changed += 1;
    }
  }
  return changed;
}
