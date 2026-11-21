/**
 * The static import graph of the system's own modules (spycraft2.mjs and module/**), for structure checks.
 * Only relative specifiers count; bare and URL imports belong to Foundry or the browser.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

const specifiers = source =>
  [
    ...source.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.{1,2}\/[^"']+)["']/gm),
    ...source.matchAll(/^\s*import\s+["'](\.{1,2}\/[^"']+)["']/gm),
    ...source.matchAll(/\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)
  ].map(match => match[1]);

/** Map of repository-relative path to the repository-relative paths it imports. */
export function moduleGraph(base = root) {
  const files = [
    "spycraft2.mjs",
    ...readdirSync(join(base, "module"), { recursive: true })
      .filter(file => file.endsWith(".mjs"))
      .map(file => join("module", file).split("\\").join("/"))
  ];
  const graph = new Map();
  for (const file of files) {
    const deps = specifiers(readFileSync(join(base, file), "utf8"))
      .map(spec => resolve(base, dirname(file), spec))
      .filter(path => existsSync(path))
      .map(path => relative(base, path).split("\\").join("/"));
    graph.set(file, [...new Set(deps)]);
  }
  return graph;
}

/** Strongly connected components with more than one file (import cycles), each sorted, in a stable order. */
export function importCycles(graph) {
  let next = 0;
  const index = new Map(),
    low = new Map(),
    stack = [],
    onStack = new Set(),
    cycles = [];
  const visit = file => {
    index.set(file, next);
    low.set(file, next++);
    stack.push(file);
    onStack.add(file);
    for (const dep of graph.get(file) ?? []) {
      if (!index.has(dep)) {
        visit(dep);
        low.set(file, Math.min(low.get(file), low.get(dep)));
      } else if (onStack.has(dep)) low.set(file, Math.min(low.get(file), index.get(dep)));
    }
    if (low.get(file) !== index.get(file)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== file);
    if (component.length > 1) cycles.push(component.sort());
  };
  for (const file of [...graph.keys()].sort()) if (!index.has(file)) visit(file);
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}
