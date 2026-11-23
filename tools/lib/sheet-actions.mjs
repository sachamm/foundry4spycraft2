/**
 * The action names an application registers, read from its source: the keys of every `actions: { … }` object,
 * including names passed to helpers spread into it (`...actorMethods("a", "b")`, `...actorWorkflows({ c, d: fn })`).
 */
import * as espree from "espree";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const sources = dir =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".mjs") ? [path] : [];
  });

const keyName = key => (key.type === "Identifier" ? key.name : typeof key.value === "string" ? key.value : null);

function namesIn(object, names) {
  for (const property of object.properties) {
    if (property.type === "Property") {
      const name = property.computed ? null : keyName(property.key);
      if (name) names.add(name);
    } else if (property.type === "SpreadElement" && property.argument.type === "CallExpression") {
      for (const argument of property.argument.arguments) {
        if (argument.type === "Literal" && typeof argument.value === "string") names.add(argument.value);
        else if (argument.type === "ObjectExpression") namesIn(argument, names);
      }
    }
  }
}

/** Every action name registered by the modules under the given directories. */
export function registeredActions(...dirs) {
  const names = new Set();
  for (const file of dirs.flatMap(sources)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("actions")) continue;
    const ast = espree.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    (function visit(node) {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "Property" && !node.computed && keyName(node.key) === "actions") {
        if (node.value.type === "ObjectExpression") namesIn(node.value, names);
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    })(ast);
  }
  return names;
}
