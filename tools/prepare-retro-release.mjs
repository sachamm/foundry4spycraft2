/** Stamp only the built package; the checked-in stable manifest is unchanged. */
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const env = process.env;
for (const key of ["GITHUB_RUN_NUMBER", "GITHUB_RUN_ATTEMPT", "GITHUB_RUN_ID"]) {
  if (!/^\d+$/.test(env[key] ?? "")) throw new Error(`Missing or invalid ${key}`);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? "")) throw new Error("Invalid GITHUB_REPOSITORY");
if (!/^[a-z0-9-]+$/.test(env.TEST_TAG ?? "")) throw new Error("Invalid TEST_TAG");
if (!env.GITHUB_ENV) throw new Error("Missing GITHUB_ENV");

const manifest = JSON.parse(readFileSync("system.json", "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(manifest.version);
if (!match) throw new Error("Expected a stable major.minor.patch source version");
const version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}-retro.${env.GITHUB_RUN_NUMBER}.${env.GITHUB_RUN_ATTEMPT}`;
const archive = `spycraft2-retro-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}.zip`;
const base = `https://github.com/${env.GITHUB_REPOSITORY}/releases/download/${env.TEST_TAG}`;
Object.assign(manifest, {
  title: "Spycraft 2.0 — Retro Test",
  version,
  manifest: `${base}/system.json`,
  download: `${base}/${archive}`
});
writeFileSync("system.json", `${JSON.stringify(manifest, null, 2)}\n`);
appendFileSync(env.GITHUB_ENV, `TEST_VERSION=${version}\nTEST_ARCHIVE=${archive}\n`);
console.log(`Prepared ${version}; manifest: ${manifest.manifest}`);
