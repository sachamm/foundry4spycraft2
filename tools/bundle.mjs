#!/usr/bin/env node
/**
 * Builds the release form of the system's JavaScript: one file in place of several hundred modules.
 *
 *   npm run bundle            writes dist/spycraft2.mjs and its source map
 *
 * Development and the tests use the modules as they are; system.json keeps pointing at spycraft2.mjs. The release
 * workflow puts the bundle at that path in the archive and leaves module/ out, so a client makes one request for
 * the code. Nothing is minified and a source map is shipped, so an error report still names the source file.
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Bundle the entry module. With `write: false` the files are returned in memory (used by the tests). */
export function bundle({ write = true, outfile = join(ROOT, "dist/spycraft2.mjs") } = {}) {
  return build({
    entryPoints: [join(ROOT, "spycraft2.mjs")],
    bundle: true,
    format: "esm",
    target: "es2022",
    // Readable stacks matter more than bytes: the server compresses the file anyway.
    minify: false,
    sourcemap: true,
    // Paths in the map are written as they will sit beside the shipped file.
    sourceRoot: "",
    outfile,
    write,
    logLevel: "silent"
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await bundle();
  for (const warning of result.warnings) console.warn(warning.text);
  console.log("dist/spycraft2.mjs written.");
}
