import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { releaseProblems } from "./check-release.mjs";

const changelog = "# Changelog\n\n## Unreleased\n\n- next\n\n## 0.6.0 — 2026-11-20\n\n## 0.5.2 — 2026-11-18\n";
const manifest = { id: "spycraft2", version: "0.6.0" };

test("a stable tag needs the manifest version and the newest changelog heading to match", () => {
  assert.deepEqual(releaseProblems("v0.6.0", { changelog, manifest }), []);
  assert.match(releaseProblems("v0.6.1", { changelog, manifest }).join("\n"), /bump it to 0\.6\.1/);
  assert.match(releaseProblems("v0.6.1", { changelog, manifest }).join("\n"), /no "## 0\.6\.1" heading/);
  assert.match(
    releaseProblems("v0.5.2", { changelog, manifest: { ...manifest, version: "0.5.2" } }).join("\n"),
    /not the newest release/
  );
});

test("a prerelease may go out from the Unreleased section; malformed tags and other systems are refused", () => {
  assert.deepEqual(releaseProblems("v0.6.1-rc.1", { changelog, manifest }), []);
  assert.equal(releaseProblems("v0.7.0-rc.1", { changelog: "## 0.6.0\n", manifest }).length, 1);
  assert.match(releaseProblems("0.6.0", { changelog, manifest })[0], /not a release tag/);
  assert.match(releaseProblems("v0.6.0", { changelog, manifest: { ...manifest, id: "other" } })[0], /not spycraft2/);
});

test("the repository as committed is releasable at its own version", () => {
  const root = new URL("../", import.meta.url);
  const current = JSON.parse(readFileSync(new URL("system.json", root), "utf8"));
  assert.deepEqual(
    releaseProblems(`v${current.version}`, {
      changelog: readFileSync(new URL("CHANGELOG.md", root), "utf8"),
      manifest: current
    }),
    []
  );
});
