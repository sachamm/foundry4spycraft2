/**
 * Renders the system's real .hbs files outside Foundry, for tests. Every template is registered as a partial under
 * its system path, the system's own helpers come from module/handlebars-helpers.mjs, and Foundry's helpers are
 * replaced by small stand-ins that print their inputs, so the output is stable.
 *
 * Two contexts reach every branch between them: `everything()` answers every path with a value that is truthy,
 * iterable and printable (so each {{#if}} and {{#each}} body renders), and `{}` takes each {{else}} and {{#unless}}.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { registerSystemHelpers } from "../../module/handlebars-helpers.mjs";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const SYSTEM_PATH = "systems/spycraft2/";

let strings = null;
const english = () => (strings ??= JSON.parse(readFileSync(join(ROOT, "lang/en.json"), "utf8")));

/** Helpers Foundry registers itself (client/applications/handlebars.mjs), each with a stand-in. */
const FOUNDRY_HELPERS = {
  // Foundry's helper: game.i18n.localize, or game.i18n.format when hash arguments are given.
  localize: (key, options) => {
    const text = String(key)
      .split(".")
      .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), english());
    if (typeof text !== "string") return String(key);
    const hash = options?.hash ?? {};
    return Object.keys(hash).length
      ? text.replace(/\{(\w+)\}/g, (match, name) => (name in hash ? String(hash[name]) : match))
      : text;
  },
  selectOptions: (choices, options) =>
    new Handlebars.SafeString(
      `<option data-stub="selectOptions" data-selected="${Handlebars.escapeExpression(String(options?.hash?.selected ?? ""))}"></option>`
    ),
  checked: value => (value ? "checked" : ""),
  disabled: value => (value ? "disabled" : ""),
  numberFormat: value => String(value),
  ifThen: (test, a, b) => (test ? a : b),
  concat: (...args) => args.slice(0, -1).map(String).join(""),
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  and: (...args) => args.slice(0, -1).every(Boolean),
  or: (...args) => args.slice(0, -1).some(Boolean),
  not: value => !value,
  object: options => options?.hash ?? {},
  json: value => JSON.stringify(value)
};

export const BUILTIN_HELPERS = new Set([
  "if",
  "unless",
  "each",
  "with",
  "lookup",
  "log",
  "blockHelperMissing",
  "helperMissing"
]);

/** Every .hbs file under templates/, as system paths. */
export function templatePaths(dir = join(ROOT, "templates")) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return templatePaths(full);
    return name.endsWith(".hbs") ? [`${SYSTEM_PATH}${relative(ROOT, full).replaceAll("\\", "/")}`] : [];
  });
}

export const sourceOf = path => readFileSync(join(ROOT, path.slice(SYSTEM_PATH.length)), "utf8");

/** A Handlebars environment with the system's helpers, Foundry's stand-ins and every template as a partial. */
export function createEnvironment({ sources = {} } = {}) {
  const hbs = Handlebars.create();
  registerSystemHelpers(hbs);
  for (const [name, fn] of Object.entries(FOUNDRY_HELPERS)) hbs.registerHelper(name, fn);
  const read = path => sources[path] ?? sourceOf(path);
  for (const path of templatePaths()) hbs.registerPartial(path, read(path));
  for (const [path, source] of Object.entries(sources)) hbs.registerPartial(path, source);
  const cache = new Map();
  return {
    hbs,
    render(path, context, data = {}) {
      if (!cache.has(path)) cache.set(path, hbs.compile(read(path)));
      return cache.get(path)(context, { data, allowProtoPropertiesByDefault: false });
    }
  };
}

/** The names a template calls as helpers or partials, read from its parse tree. */
export function templateCalls(source) {
  const helpers = new Set(),
    partials = new Set();
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const named = ["MustacheStatement", "SubExpression", "BlockStatement"].includes(node.type);
    if (named && node.path?.type === "PathExpression" && node.path.parts.length === 1 && !node.path.data) {
      const callsHelper = node.params?.length || node.hash || node.type === "SubExpression";
      if (callsHelper || BUILTIN_HELPERS.has(node.path.original)) helpers.add(node.path.original);
    }
    if (node.type === "PartialStatement" || node.type === "PartialBlockStatement")
      partials.add(node.name.type === "StringLiteral" ? node.name.value : node.name.original);
    for (const [key, value] of Object.entries(node)) if (key !== "loc") visit(value);
  };
  visit(Handlebars.parse(source));
  return { helpers, partials };
}

/** Every name a template reads as a path segment. */
function pathNames(source) {
  const names = new Set();
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === "PathExpression") for (const part of node.parts) names.add(part);
    for (const [key, value] of Object.entries(node)) if (key !== "loc") visit(value);
  };
  visit(Handlebars.parse(source));
  return names;
}

export const foundryHelperNames = () => new Set(Object.keys(FOUNDRY_HELPERS));

/**
 * A context that answers every path: truthy, a two-item list, the text "x" when printed and 1 as a number.
 */
export function everything() {
  // A partial called with a hash gets a copy of its context (Handlebars copies own keys), so the context lists as
  // its own every name a template reads; otherwise the copy would lose them.
  const names = [...new Set(templatePaths().flatMap(path => [...pathNames(sourceOf(path))]))].filter(
    name => !/^\d+$/.test(name) && name !== "length"
  );
  const make = depth =>
    new Proxy([], {
      get(target, key) {
        if (key === "length") return 2;
        if (key === Symbol.iterator)
          return function* () {
            yield make(depth + 1);
            yield make(depth + 1);
          };
        if (key === Symbol.toPrimitive) return hint => (hint === "number" ? 1 : "x");
        if (key === "toString" || key === "toJSON") return () => "x";
        if (key === "valueOf") return () => 1;
        if (typeof key === "symbol" || key === "toHTML" || key === "then" || key === "constructor") return undefined;
        // Array methods work on a real two-item list, so a helper may map or filter what it is given.
        if (typeof Array.prototype[key] === "function")
          return (...args) => Array.prototype[key].apply([make(depth + 1), make(depth + 1)], args);
        if (depth > 12) return "x";
        return make(depth + 1);
      },
      has: (target, key) => typeof key !== "symbol" || key === Symbol.iterator,
      getOwnPropertyDescriptor: (target, key) =>
        key === "length"
          ? Reflect.getOwnPropertyDescriptor(target, key)
          : typeof key === "symbol"
            ? undefined
            : { configurable: true, enumerable: true, writable: true, value: undefined },
      ownKeys: () => ["0", "1", "length", ...names]
    });
  return make(0);
}

/** A template's source with every partial it calls written in place, for tests that search a whole tab's markup. */
export function inlinedSource(path) {
  return sourceOf(path).replace(/\{\{>\s*"([^"]+)"\s*\}\}/g, (match, partial) => inlinedSource(partial));
}
