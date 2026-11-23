import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "./bundle.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * Loads an entry file in a fresh process with stand-ins for Foundry's globals, and prints the hooks it registers
 * while loading, in order.
 */
const PROBE = `
const calls = [];
const stand = name => new Proxy(function () {}, {
  get: (target, key) => (key === "prototype" ? target.prototype : key === Symbol.toPrimitive ? () => name : stand(name)),
  apply: () => stand(name),
  construct: () => ({})
});
globalThis.Hooks = { on: name => calls.push("on:" + name), once: name => calls.push("once:" + name) };
for (const name of ["foundry", "CONFIG", "CONST", "game", "ui", "Roll", "Actor", "Item", "ChatMessage", "Combat", "Combatant", "ActiveEffect"])
  globalThis[name] = stand(name);
await import(process.argv[2]);
console.log(JSON.stringify(calls));
`;

function hooksOf(probe, entry) {
  const run = spawnSync(process.execPath, [probe, pathToFileURL(entry).href], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split("\n").at(-1));
}

test("the release bundle is one self-contained file that starts up as the modules do", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sc2-bundle-"));
  try {
    const outfile = join(dir, "spycraft2.mjs");
    const result = await bundle({ write: false, outfile });
    const code = result.outputFiles.find(file => file.path === outfile);
    const map = result.outputFiles.find(file => file.path === `${outfile}.map`);
    assert.ok(code && map, "expected the bundle and its source map");
    // Nothing is left to fetch: the archive ships without module/.
    assert.doesNotMatch(code.text, /^\s*import\s[^;]*from\s+["']\.{1,2}\//m);
    assert.doesNotMatch(code.text, /\bimport\(\s*["']\.{1,2}\//);
    assert.match(code.text, /sourceMappingURL=spycraft2\.mjs\.map/);
    // The code may still fetch data files from module/ at run time; the release workflow must ship every one.
    const workflow = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    assert.match(workflow, /npm run bundle/);
    assert.match(workflow, /find module -type f ! -name '\*\.mjs'/);
    assert.doesNotMatch(workflow, /zip -r[^\n]* module /, "module/ sources are replaced by the bundle");
    assert.ok(JSON.parse(map.text).sources.some(source => source.endsWith("module/rules/engine.mjs")));
    writeFileSync(outfile, code.text);
    const probe = join(dir, "probe.mjs");
    writeFileSync(probe, PROBE);
    const fromSource = hooksOf(probe, join(ROOT, "spycraft2.mjs"));
    assert.ok(fromSource.includes("once:init") && fromSource.includes("once:ready"));
    // Same hooks in the same order: the modules were evaluated in the same sequence.
    assert.deepEqual(hooksOf(probe, outfile), fromSource);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
