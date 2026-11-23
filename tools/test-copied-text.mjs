import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bookIndex, matchingRuns } from "./check-copied-text.mjs";

// Made-up "book" text for the checker's own tests; none of it comes from the rulebook.
const sentence = "the courier leaves the parcel at the old station and waits for a signal from the roof";

test("a run copied word for word is found at its full length", () => {
  const book = bookIndex(`Some filler first. ${sentence}. More filler after.`, 8);
  const [run] = matchingRuns(`Notes: ${sentence}.`, book);
  assert.equal(run.length, 17);
  assert.equal(run.prose, true);
});

test("windows found in different places of the book do not join into one run", () => {
  const w = sentence.split(" ").slice(0, 12);
  // Each 8-word window of the 12-word sentence appears in the book, but never the sentence itself.
  const scattered = [0, 1, 2, 3, 4].map(i => `${w.slice(i, i + 8).join(" ")} zebra quartz`).join(" ");
  const runs = matchingRuns(w.join(" "), bookIndex(scattered, 8));
  assert.ok(runs.length > 0);
  assert.ok(
    runs.every(run => run.length < 12),
    runs.map(run => run.length)
  );
});

test("a match that starts a word later is not hidden by an earlier, shorter one", () => {
  const w = sentence.split(" ");
  // One passage holds words 0-8 of the string, another holds words 1-12: the copied run is 12 words long.
  const book = bookIndex(`${w.slice(0, 9).join(" ")} zebra quartz ${w.slice(1, 13).join(" ")}`, 8);
  const runs = matchingRuns(w.slice(0, 13).join(" "), book);
  assert.equal(runs[0].length, 12);
  assert.equal(runs[0].start, 1);
  assert.ok(runs.every(run => run.length <= 12));
});

test("a long label run does not hide a shorter prose run in the same string", () => {
  const labels =
    "Driving Electronics Mechanics Medicine Notice Search Sneak Tactics Bluff Prestidigitation Analysis Athletics Acrobatics Resolve Sense Motive Survival Falsify Intimidate Manipulate Networking";
  const book = bookIndex(`${labels}. Elsewhere: ${sentence}.`, 8);
  const runs = matchingRuns(`${labels} and then ${sentence}`, book);
  assert.equal(runs[0].prose, false, "the longest run is the label list");
  assert.ok(
    runs.some(run => run.prose && run.length >= 12),
    "the prose run is still reported"
  );
});

test("an explicit rulebook path that does not exist fails instead of skipping", () => {
  const script = fileURLToPath(new URL("./check-copied-text.mjs", import.meta.url));
  assert.throws(
    () => execFileSync(process.execPath, [script, "/no/such/rulebook.md"], { stdio: "pipe" }),
    error => error.status === 1
  );
  const env = { ...process.env };
  delete env.SPYCRAFT_RULEBOOK_TEXT;
  assert.match(execFileSync(process.execPath, [script], { env, encoding: "utf8" }), /skipped/);
});
