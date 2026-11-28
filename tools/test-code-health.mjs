/**
 * Code-health ratchets (docs/backlog.md, code council rows). A count here may fall but never rise; when it falls,
 * lower it in the same change.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
const sources = ["spycraft2.mjs"].concat(
  fs
    .readdirSync(new URL("module", root), { recursive: true })
    .filter(name => name.endsWith(".mjs"))
    .map(name => path.posix.join("module", name.split(path.sep).join("/")))
);

/**
 * Every world or client setting the system registers, and the file that owns it. A new setting is added here in the
 * same change, so this stays the one list of keys.
 */
const SETTINGS = {
  actorFolderSetup: "module/actor-folders.mjs",
  advanceClockInCombat: "module/apps/game-clock.mjs",
  autoFluidEvents: "module/apps/gc/combat.mjs",
  campaign: "module/apps/gc/state.mjs",
  characterDefaultOwnership: "module/apps/character-ownership.mjs",
  clock: "module/apps/game-clock.mjs",
  clockVisibleToPlayers: "module/apps/game-clock.mjs",
  conflicts: "module/apps/gc/state.mjs",
  countAmmunition: "spycraft2.mjs",
  fluidInitiative: "module/apps/gc/state.mjs",
  gcActionDice: "spycraft2.mjs",
  gcConsolePosition: "module/apps/gc/state.mjs",
  gcConsoleSections: "module/apps/gc/state.mjs",
  gcConsoleView: "module/apps/gc/state.mjs",
  gcConsoleWindow: "module/apps/gc/state.mjs",
  gcFirstCombatSeen: "module/apps/gc/state.mjs",
  gcFirstSessionDone: "module/apps/gc/state.mjs",
  gcTableSetup: "module/gc-table-setup.mjs",
  linguistics: "spycraft2.mjs",
  lockMode: "module/rules/gm-locks.mjs",
  mapMeasure: "module/apps/map.mjs",
  mission: "module/apps/gc/state.mjs",
  organizations: "module/apps/gc/state.mjs",
  ownershipReviewDismissed: "module/apps/character-ownership.mjs",
  quickNpcResolve: "module/apps/damage-application.mjs",
  relayAutoApprove: "module/apps/gc-relay.mjs",
  relayTimeout: "module/apps/gc-relay.mjs",
  reviewCharacterOwnership: "module/apps/character-ownership.mjs",
  roundReminders: "module/apps/gc/state.mjs",
  roundStateEffects: "module/apps/round-state-effects.mjs",
  sampleActorSetup: "module/actor-folders.mjs",
  sampleSceneSetup: "module/sample-scenes.mjs",
  sceneState: "module/apps/gc/state.mjs",
  schemaVersion: "module/migrations/index.mjs",
  showDefenseToPlayers: "module/apps/gc-relay.mjs",
  skipRollDialogs: "module/apps/remembered-choices.mjs",
  soundtrackSetup: "module/soundtrack.mjs",
  startFlatFooted: "module/apps/gc/state.mjs",
  tokenLinkReviewDismissed: "module/apps/token-links.mjs",
  trustTheTable: "module/apps/dialog-theme.mjs",
  turnNotice: "module/apps/turn-cue.mjs",
  usagePeriodReview: "spycraft2.mjs",
  usagePeriods: "spycraft2.mjs"
};

test("every registered setting is on the key list, in the file the list names", () => {
  const found = {};
  for (const file of sources) {
    const text = read(file);
    for (const match of text.matchAll(/settings\.register\(\s*(?:[\w.]+|"[^"]+"),\s*("[^"]+"|[A-Z_]+)/g)) {
      let key = match[1];
      if (!key.startsWith('"')) {
        const constant = text.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]+)"`));
        assert.ok(constant, `${file}: the setting key ${key} is not a string constant in the same file`);
        key = constant[1];
      } else key = key.slice(1, -1);
      assert.equal(found[key], undefined, `the setting ${key} is registered twice`);
      found[key] = file;
    }
  }
  assert.deepEqual(found, SETTINGS);
});

test("innerHTML assignments do not grow", () => {
  const uses = sources.flatMap(file =>
    read(file)
      .split("\n")
      .filter(line => /\.innerHTML\s*=/.test(line))
      .map(() => file)
  );
  assert.ok(uses.length <= 4, `${uses.length} innerHTML assignments: ${[...new Set(uses)].join(", ")}`);
});
