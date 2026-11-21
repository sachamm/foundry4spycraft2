import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const flatten = (node, prefix = "", out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object") flatten(value, `${prefix}${key}.`, out);
    else out[prefix + key] = value;
  }
  return out;
};

test("every translation key a template uses has an English string", async () => {
  const strings = flatten(JSON.parse(await readFile(new URL("lang/en.json", root), "utf8")));
  const files = (await readdir(new URL("templates/", root), { recursive: true })).filter(f => f.endsWith(".hbs"));
  assert.ok(files.length >= 20);
  let used = 0;
  for (const file of files) {
    const source = await readFile(new URL(`templates/${file}`, root), "utf8");
    // A key is either localized in place or handed to a partial as a hash value (label="SPYCRAFT.…").
    const keys = [
      ...source.matchAll(/\{\{localize ["'](SPYCRAFT\.[\w.-]+)["'][^}]*\}\}/g),
      ...[...source.matchAll(/\{\{>[^}]*\}\}/g)].flatMap(([call]) => [...call.matchAll(/\w+="(SPYCRAFT\.[\w.-]+)"/g)])
    ];
    for (const [, key] of keys) {
      used += 1;
      assert.equal(typeof strings[key], "string", `${file}: ${key} is missing from lang/en.json`);
      assert.ok(strings[key].length > 0, `${file}: ${key} is empty`);
    }
  }
  assert.ok(used > 1000, `only ${used} template strings found`);
});

test("template strings hold text, not markup or template code", async () => {
  const table = JSON.parse(await readFile(new URL("lang/en.json", root), "utf8")).SPYCRAFT.Template;
  for (const [file, strings] of Object.entries(table)) {
    for (const [key, text] of Object.entries(strings)) {
      assert.doesNotMatch(text, /\{\{|\}\}|<\/?[a-z]/i, `${file}.${key}`);
      assert.equal(text, text.trim(), `${file}.${key} has surrounding whitespace`);
    }
  }
});
