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
const { buildPacks } = await import("./lib/pack-docs.mjs");
const built = buildPacks();
const npcTemplates = built.packs["core-npcs"].docs;
const packageData = JSON.parse(built.generated["module/data/npc-packages.json"]);
for (const [roleId, role] of Object.entries(packageData.roles)) {
  const original = npcTemplates.find(doc => doc.flags.spycraft2.npcTemplate === roleId);
  for (const variant of role.packages.filter(p => p.id !== "fixed"))
    npcTemplates.push({
      ...original,
      name: `${role.name} / ${variant.label}`,
      system: { ...original.system, npcProfile: variant.profile },
      embedded: { items: variant.items }
    });
}
const samplePack = built.packs["sample-agents"];
const sampleActors = [...samplePack.docs, ...samplePack.companions, ...built.packs["sample-npcs"].docs];
for (const doc of [...npcTemplates, ...sampleActors]) {
  for (const [kind, type, data, label] of [
    ["Actor", doc.type, doc.system, doc.name],
    ...doc.embedded.items.map(item => ["Item", item.type, item.system, `${doc.name}: ${item.name}`])
  ]) {
    try {
      const schema = (kind === "Actor" ? models.actor : models.item)[type].schema;
      const clean = schema.clean(structuredClone(data), {});
      const failure = schema.validate(clean, {});
      if (failure) throw new Error(String(failure));
    } catch (error) {
      failed += 1;
      console.error(`${label}: ${error.message}`);
    }
  }
}
console.log(
  `Validated ${npcTemplates.length} NPC template/package systems and ${sampleActors.length} sample actor/companion systems, with all embedded item systems.`
);
// Exercise v14's actual embedded collection replacement, including deletion and schema-cleaned inputs.
try {
  const assert = (await import("node:assert/strict")).default;
  globalThis.CONST = await load("constants.mjs");
  foundry.data.operators = await load("data/operators.mjs");
  foundry.packages = await load("packages/_module.mjs");
  foundry.documents = await load("documents/_module.mjs");
  for (const kind of ["Actor", "Item", "ActiveEffect", "Folder", "Token", "RollTable", "TableResult"])
    CONFIG[kind] = { documentClass: foundry.documents[`Base${kind}`], dataModels: models[kind.toLowerCase()] ?? {} };
  globalThis.game = {
    system: { id: "spycraft2", documentTypes: { Actor: ["npc", "agent"], Item: Object.keys(models.item) } },
    modules: new Map(),
    model: { Actor: { npc: {}, agent: {} }, Item: Object.fromEntries(Object.keys(models.item).map(type => [type, {}])) }
  };
  const { planNpcPackage } = await import("../module/rules/npc-packages.mjs");
  for (const original of npcTemplates.slice(0, 20)) {
    const { embedded, ...source } = original;
    const actor = new foundry.documents.BaseActor({ ...source, items: embedded.items });
    for (const packageId of ["basic", "veteran", "veteran", "fixed"]) {
      const plan = planNpcPackage(actor.toObject(), packageData, packageId);
      actor.updateSource({
        items: foundry.data.operators.ForcedReplacement.create(plan.items),
        "system.npcProfile": plan.profile,
        "flags.spycraft2.npcPackage": plan.receipt
      });
      assert.deepEqual(actor.items.map(item => item.id).sort(), plan.items.map(item => item._id).sort());
      assert.equal(
        actor.system.npcProfile.qualities.filter(q => q.id === "feat").length,
        plan.profile.qualities.filter(q => q.id === "feat").length
      );
      assert.deepEqual(actor.system.npcProfile.equipment, plan.profile.equipment);
    }
  }
  console.log("Validated native Foundry package replacement and fixed-loadout restoration for all 20 templates.");
  game.packs = new Map(
    Object.entries(built.packs).map(([name, pack]) => [`spycraft2.${name}`, { documentName: pack.type ?? "Item" }])
  );
  for (const original of sampleActors) {
    const { embedded, ...source } = original;
    const actor = new foundry.documents.BaseActor({ ...source, items: embedded.items });
    assert.equal(actor.items.size, embedded.items.length);
    if (actor.type === "agent") {
      const { computeAgent } = await import("../module/rules/engine.mjs");
      const prepared = computeAgent(
        actor.system.toObject(),
        actor.items.map(item => ({ ...item.toObject(), id: item.id })),
        CONFIG.SPYCRAFT
      );
      assert.deepEqual(prepared.todo, [], original.name);
      assert.deepEqual(prepared.warnings, [], original.name);
      assert.equal(actor.system.vitality.value, prepared.vitality.max);
      assert.equal(actor.system.wounds.value, prepared.wounds.max);
      assert.equal(actor.system.actionDice.value, prepared.actionDice.max);
    }
  }
  console.log("Validated native sample actor documents and complete preparation after schema cleaning.");
  game.model.TableResult = Object.fromEntries(Object.values(CONST.TABLE_RESULT_TYPES).map(type => [type, {}]));
  let tableResults = 0;
  for (const { embedded, ...source } of built.packs["gc-tables"].docs) {
    const table = new foundry.documents.BaseRollTable({ ...source, results: embedded.results });
    assert.equal(table.formula, source.formula);
    assert.equal(table.results.size, embedded.results.length);
    assert.deepEqual(table.ownership, { default: 0 });
    for (const result of table.results) {
      const expected = embedded.results.find(row => row._id === result.id);
      assert.deepEqual(result.range, expected.range);
      assert.equal(result.weight, expected.weight);
      assert.equal(result.description, expected.description);
      tableResults++;
    }
  }
  console.log(`Validated ${built.packs["gc-tables"].docs.length} native RollTables and ${tableResults} TableResults.`);
} catch (error) {
  failed += 1;
  console.error(`Native package replacement: ${error.stack}`);
}
process.exitCode = failed ? 1 : 0;
