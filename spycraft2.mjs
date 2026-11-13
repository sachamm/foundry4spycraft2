import { SPYCRAFT } from "./module/config.mjs";
import * as dataModels from "./module/data/_module.mjs";
import { SpycraftActor } from "./module/documents/actor.mjs";
import { SpycraftItem } from "./module/documents/item.mjs";
import { SpycraftAgentSheet, SpycraftNpcSheet } from "./module/sheets/actor-sheet.mjs";
import { SpycraftItemSheet } from "./module/sheets/item-sheet.mjs";
import { SpycraftBrowser } from "./module/apps/browser.mjs";
import { evaluate, renderTemplate } from "./module/rules/formula.mjs";
import { checkPrerequisites, describe } from "./module/rules/prerequisites.mjs";

Hooks.once("init", () => {
  console.log("Spycraft 2.0 | Initializing system");
  CONFIG.SPYCRAFT = SPYCRAFT;

  CONFIG.Actor.documentClass = SpycraftActor;
  CONFIG.Item.documentClass = SpycraftItem;
  Object.assign(CONFIG.Actor.dataModels, dataModels.actor);
  Object.assign(CONFIG.Item.dataModels, dataModels.item);
  CONFIG.Actor.trackableAttributes = {
    agent: { bar: ["vitality", "wounds", "actionDice"], value: [] },
    npc: { bar: ["vitality", "wounds"], value: [] }
  };

  CONFIG.Combat.initiative = { formula: "1d20 + @initiative.total", decimals: 0 };

  game.spycraft2 = { SpycraftBrowser, rules: { evaluate, renderTemplate, checkPrerequisites, describe } };

  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet("spycraft2", SpycraftAgentSheet, { types: ["agent"], makeDefault: true, label: "SPYCRAFT.Sheet.Agent" });
  Actors.registerSheet("spycraft2", SpycraftNpcSheet, { types: ["npc"], makeDefault: true, label: "SPYCRAFT.Sheet.Npc" });
  Items.registerSheet("spycraft2", SpycraftItemSheet, { makeDefault: true, label: "SPYCRAFT.Sheet.Item" });

  Handlebars.registerHelper("signed", n => (Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`));
  Handlebars.registerHelper("sc2eq", (a, b) => a == b); // eslint-disable-line eqeqeq
  Handlebars.registerHelper("sc2lt", (a, b) => Number(a) < Number(b));
  // Tooltip attributes for a breakdown: rows of [label, value]. Plain text plus an HTML version with one row per line.
  Handlebars.registerHelper("sc2tip", rows => {
    if (!Array.isArray(rows) || !rows.length) return "";
    const esc = Handlebars.escapeExpression;
    const lines = rows.map(([label, value]) => `${label} ${Number(value) >= 0 ? "+" : ""}${Number(value)}`);
    return new Handlebars.SafeString(`data-tooltip="${esc(lines.join(" · "))}" data-tooltip-html="${esc(lines.map(esc).join("<br>"))}"`);
  });

  foundry.applications.handlebars.loadTemplates([
    "systems/spycraft2/templates/item/parts/bonuses.hbs",
    "systems/spycraft2/templates/actor/npc-builder.hbs"
  ]);
});
