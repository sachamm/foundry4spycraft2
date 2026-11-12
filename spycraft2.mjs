import { SPYCRAFT } from "./module/config.mjs";
import * as dataModels from "./module/data/_module.mjs";
import { SpycraftActor } from "./module/documents/actor.mjs";
import { SpycraftItem } from "./module/documents/item.mjs";
import { SpycraftActorSheet } from "./module/sheets/actor-sheet.mjs";

Hooks.once("init", () => {
  console.log("Spycraft 2.0 | Initializing system");
  CONFIG.SPYCRAFT = SPYCRAFT;

  CONFIG.Actor.documentClass = SpycraftActor;
  CONFIG.Item.documentClass = SpycraftItem;
  Object.assign(CONFIG.Actor.dataModels, dataModels.actor);
  Object.assign(CONFIG.Item.dataModels, dataModels.item);

  CONFIG.Combat.initiative = { formula: "1d20 + @initiative.total", decimals: 0 };

  const { Actors } = foundry.documents.collections;
  Actors.registerSheet("spycraft2", SpycraftActorSheet, {
    types: ["agent", "npc"],
    makeDefault: true,
    label: "SPYCRAFT.Sheet.Actor"
  });
});
