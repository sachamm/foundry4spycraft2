#!/usr/bin/env node
/**
 * Validates this system's data models with Foundry's own field classes, outside the browser.
 * It needs a local Foundry installation, so it is a developer check and not part of `npm test`.
 *
 *   npm run check:schemas
 *   FOUNDRY_APP_PATH=/path/to/resources/app npm run check:schemas
 */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const candidates = [
  process.env.FOUNDRY_APP_PATH,
  "/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app",
  `${process.env.LOCALAPPDATA ?? ""}/Programs/Foundry Virtual Tabletop/resources/app`,
  `${process.env.HOME ?? ""}/foundryvtt/resources/app`
].filter(Boolean);
const app = candidates.find(path => existsSync(`${path}/common/data/fields.mjs`));
if (!app) {
  console.log("Foundry's application files were not found; set FOUNDRY_APP_PATH to its resources/app folder. Skipped.");
  process.exit(0);
}
const load = file => import(pathToFileURL(`${app}/common/${file}`).href);
await load("primitives/_module.mjs");
globalThis.foundry = {
  data: { fields: await load("data/fields.mjs") },
  abstract: await load("abstract/_module.mjs"),
  utils: await load("utils/_module.mjs")
};
globalThis.CONFIG = { SPYCRAFT: (await import("../module/config.mjs")).SPYCRAFT };
const models = await import("../module/data/_module.mjs");

let failed = 0;
for (const [kind, set] of Object.entries({ Actor: models.actor, Item: models.item })) {
  for (const [type, Model] of Object.entries(set)) {
    try {
      const schema = Model.schema;
      const defaults = schema.clean(schema.getInitialValue({}), {});
      const failure = schema.validate(defaults, {});
      const untyped = Object.values(schema.fields).filter(field => field.constructor.name === "ObjectField").length;
      if (failure) throw new Error(String(failure));
      console.log(
        `${kind}.${type}: ${Object.keys(schema.fields).length} fields, defaults valid, ${untyped} untyped object fields`
      );
    } catch (error) {
      failed += 1;
      console.error(`${kind}.${type}: ${error.message}`);
    }
  }
}
process.exitCode = failed ? 1 : 0;
