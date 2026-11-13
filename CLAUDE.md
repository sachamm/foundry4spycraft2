# Spycraft 2.0 for Foundry VTT — notes for Claude

Unofficial Foundry game system, id `spycraft2`. Plain ES modules, no bundler.

## Commands

- `npm install` once, then `npm run build` to generate `module/rules/tables.mjs` and the compendium packs from `src/data/`.
- `npm test` runs data validation, the engine fixture checks and the unit tests. Run it before every commit.
- `npm run test:layout` runs the Playwright layout tests (not part of `npm test`).

## Layout

- `module/rules/` is the rules engine. It is pure JavaScript with no Foundry globals so it can run in Node. Keep it that way; put new rules logic in pure functions and test them in `tools/test-audit.mjs` or `tools/test-engine.mjs`.
- `module/documents/`, `module/sheets/`, `module/apps/`, `templates/` are the Foundry side.
- `src/data/*.json` is the source of truth for rules data. `src/data/summaries.json` holds all descriptive text.
- `module/rules/tables.mjs` and `packs/` are generated. Change `src/data/` and rebuild; never edit them by hand.

## Rules for this project

- **Target the latest stable Foundry, currently v14.** No v13 support. Use no API that v14 marks deprecated: `foundry.data.operators` instead of `-=key`, `messageMode` instead of `rollMode`.
- **Check rules against the rulebook, not memory.** Quote the table or page when changing a number.
- **Rule violations are warnings, never blocks.** The sheet tells the player; it does not stop them.
- **Descriptions are original summaries.** Never paste rulebook text; only Open Game Content may go in compendiums.
- **Data is maintained by hand.** Do not add import or conversion tooling, and never add office files (`*.xls`, `*.xlsx`). The only credit for the original data source is the "Credits" section of the README.
- A template part must render exactly one root element.
- Do not use `collaborate="true"` on `<prose-mirror>` in sheets that re-render on every change.
- The same user can be logged in from two browsers. Follow-up writes in `_onCreate` / `_onDelete` must be limited to the client that started the change (see `CLIENT_ID` in `module/documents/item.mjs`).
- Saved fixtures in `tools/fixtures/` are reference results. If a rules fix changes an expected value, update the fixture and say why in the commit.

## Testing in Foundry

- Foundry loads the system from `{userData}/Data/systems/spycraft2`. For development that must be a symlink to this folder, not an installed release. If `/systems/spycraft2/package.json` returns 404 from the running server, it is serving an installed copy and your edits are not loaded.
- JavaScript, template and CSS edits need a browser reload. `system.json` changes need the world relaunched. Packs are locked while a world is open: return to setup before `npm run build`.
- Automated tests do not replace a check in a running world. After changing sheets or rolls, create an agent, add a class, origins and feats, and roll from the sheet with the browser console open.

## Git and releases

- Commit only when asked. Never force-push without being asked.
- To release: bump `version` in `system.json`, add a `CHANGELOG.md` section, push, then publish a GitHub release tagged `v<version>`. The Release workflow builds the packs and attaches `system.json` and `spycraft2.zip`. Do not mark it as a pre-release, or the manifest URL will not find it.
