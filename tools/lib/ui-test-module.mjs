import { readFileSync } from "node:fs";

const cache = new Map();
/** Bundle the UI helpers' relative ES imports for the isolated browser fixtures. */
export function uiModuleUrl(path) {
  const file = path instanceof URL ? path : new URL(`../../${path}`, import.meta.url);
  if (cache.has(file.href)) return cache.get(file.href);
  const source = readFileSync(file, "utf8").replace(
    /(from\s+)(["'])(\.[^"']+)\2/g,
    (_match, prefix, _quote, dependency) => prefix + JSON.stringify(uiModuleUrl(new URL(dependency, file)))
  );
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  cache.set(file.href, url);
  return url;
}
