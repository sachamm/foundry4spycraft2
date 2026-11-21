#!/usr/bin/env node
/**
 * Checks that a release tag, the changelog and system.json agree before anything is packaged.
 *
 *   node tools/check-release.mjs v0.6.1            (the release workflow runs this with the pushed tag)
 *   npm run release:check -- v0.6.1                (run it yourself before tagging)
 *
 * A stable tag vX.Y.Z needs system.json at version X.Y.Z and a "## X.Y.Z" changelog heading. A prerelease tag
 * vX.Y.Z-rc.1 needs a "## X.Y.Z" heading or an "## Unreleased" section, since its notes are still being written.
 *
 * Run locally, it also scans for wording copied from the rulebook (tools/check-copied-text.mjs) when
 * SPYCRAFT_RULEBOOK_TEXT points at your own text copy. The book is never in the repository, so CI cannot.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

/** The problems with releasing `tag`, given the changelog text and the manifest. Empty when it may go out. */
export function releaseProblems(tag, { changelog, manifest }) {
  const match = /^v(\d+\.\d+\.\d+)(-[0-9A-Za-z.-]+)?$/.exec(tag ?? "");
  if (!match) return [`"${tag}" is not a release tag like v1.2.3 or v1.2.3-rc.1.`];
  const [, version, pre] = match;
  const headings = [...changelog.matchAll(/^## (\S+)/gm)].map(([, heading]) => heading);
  const problems = [];
  if (pre) {
    if (!headings.includes(version) && !headings.includes("Unreleased"))
      problems.push(`CHANGELOG.md has neither a "## ${version}" heading nor an "## Unreleased" section.`);
  } else {
    if (manifest.version !== version)
      problems.push(`system.json is at version ${manifest.version}; bump it to ${version} before tagging ${tag}.`);
    if (!headings.includes(version)) problems.push(`CHANGELOG.md has no "## ${version}" heading.`);
    else if (headings[0] !== version && !(headings[0] === "Unreleased" && headings[1] === version))
      problems.push(`"## ${version}" is not the newest release in CHANGELOG.md.`);
  }
  if (manifest.id !== "spycraft2") problems.push(`system.json id is "${manifest.id}", not spycraft2.`);
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  const problems = releaseProblems(tag, {
    changelog: readFileSync(new URL("CHANGELOG.md", `file://${root}`), "utf8"),
    manifest: JSON.parse(readFileSync(new URL("system.json", `file://${root}`), "utf8"))
  });
  for (const problem of problems) console.error(`✖ ${problem}`);
  if (problems.length) process.exit(1);
  console.log(`${tag}: tag, CHANGELOG.md and system.json agree.`);
  if (!process.env.CI) {
    if (process.env.SPYCRAFT_RULEBOOK_TEXT)
      execFileSync(process.execPath, ["tools/check-copied-text.mjs"], { cwd: root, stdio: "inherit" });
    else
      console.log(
        "Reminder: set SPYCRAFT_RULEBOOK_TEXT to your rulebook text and run this again to scan for copied wording."
      );
  }
}
