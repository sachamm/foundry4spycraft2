# Remaining work

Written 2026-11-17, after the roll pipeline, gear catalog and vehicles were added (commit `77d9624`).
Items are grouped by area and ordered roughly by how much they block. Tick them off or delete them as they land.

## Verify what was just built

Checked live in Foundry 14.370 on 2026-11-17 (world `spycraft-test`, throwaway actors deleted afterwards).

- [x] Restart Foundry so it loads the new document types (`Item.vehicle`, `Actor.vehicle`) and packs.
- [x] Run `npm run build` and confirm it exits 0 with every pack rebuilt. Built into a scratch folder with
      `SPYCRAFT_PACKS_DIR` (Foundry had the packs open); generated files matched the commit and the live pack counts
      match (gear 382, vehicles 213, vehicle-upgrades 201). `npm test`, `test:packs` and `test:layout` all passed.
- [x] Agent sheet: a skill (named-check list from the pipeline), a save, an attack and damage post chat cards;
      a boost spends an action die and updates the effective result; the error guard still blocks boosting an
      unresolved error. All 89 pipeline contributors are registered, including both chat controls.
- [ ] Live-check **Reroll with ability**, **Resolve Unnerving stress** and **Strut** on a character that has them.
      No sample character qualifies, so only the unit tests cover them so far.
- [x] Agent Gear tab: browse the Gear and Vehicles packs, add an entry, set its pick category and check the mission
      pick totals (an overspent category is flagged).
- [x] Gear item sheet: table values show, **Damage save** rolls and the failed-save count updates.
- [x] Vehicle item sheet: **Place on a scene** creates a Vehicle actor with the same statistics.
- [x] Vehicle actor sheet: drop a character to set the driver, toggle In motion, roll a Damage save with a critical
      hit, check the Vehicle Damage result changes the current ratings, then **Repaired**. Tyre save also checked.
- [x] Put a vehicle token into a combat encounter and confirm the tracker and the combat hooks do not throw.
- [ ] Add Playwright layout fixtures for the vehicle sheet and the two changed item templates.
- [x] Compendium browser summaries ran paragraphs together ("p.276.The printed table…"); `plainText` in
      `module/apps/browser.mjs` now separates block elements.
- [ ] A vehicle in combat rolls its own initiative (`1d20 + 0`); decide whether it should use its driver's or stay
      out of the tracker.

## Gear and vehicle data

- [ ] Cross-check `src/data/gear.json` and `src/data/vehicles.json` against the rulebook PDFs. They were parsed from the
      markdown edition only; wrapped rows were repaired by rule, not by eye.
- [ ] Review every row flagged `noted`: the printed footnote is not represented. Some change how a pick is granted
      (for example one item per team member), which the pick count does not model.
- [ ] Decide the tyre save bonus for Gargantuan vehicles; the Huge value is used because the book lists none (p.290).
- [ ] Extract armor upgrades (Table 4.14) and weapon upgrades (Tables 4.60–4.61).
- [ ] Extract contagions (Table 4.70) if poisons and diseases are to be automated.
- [ ] Write original one-line summaries for gear entries; they currently carry only a table and page reference.
- [ ] Standing-only entries record their Reputation/Net Worth cost as a label; nothing charges it.

## Vehicles in play

- [ ] Chases: have the Dramatic Conflict tracker read Acceleration, Turning and speed from the vehicles involved, and
      track maneuvering room.
- [ ] Defense against a specific attacker: `vehicleDefense` already accepts the attacker's ratings; the sheet does not
      ask for them.
- [ ] Vehicle Damage results that are only reported today: cargo, occupant, weapon or secondary gear, rotors, draft
      animal. Occupant damage needs an occupant list.
- [ ] Occupants and crew: who is aboard, the skeleton crew that comes with a vehicle, entering and leaving, bailing out
      (the DC is in the data, with no control for it).
- [ ] Fuel: Range/Fuel is a label; hours used and lost are not tracked against it.
- [ ] Vehicle qualities are stored as codes with no reference text or effect.
- [ ] Vehicle weapons are reference entries. Make them rollable with the Vehicle Weapon proficiency, including their
      ammunition options.
- [ ] Installing upgrades: count a vehicle's free upgrades and attach upgrade entries to it.
- [ ] Mounts list "NPC" for several columns; link them to an NPC stat block.
- [ ] Control checks: apply the category's skill, Drive focus and untrained penalty when a driver rolls.

## Gear in play

- [ ] Gadgets: combine a housing with mechanisms, enforcing the housing's mechanism limit.
- [ ] Battery life and recharge tracking for electronics.
- [ ] Use Power Rating and result-cap modifiers in the skill checks that the item supports.
- [ ] Repairing broken gear: reset failed saves through the Electronics or Mechanics check.

## Roll pipeline

The registry exists and the validators, reservations, named checks and two chat buttons use it. Still inline:

- [ ] Dialog content and input parsing in `rollSkill`, `rollAttack`, `rollSave` and `rollDamage`: add a dialog phase.
- [ ] Modifier arithmetic in `weaponAttack` and `resolveSkillCheck`: move onto the `modifiers` phase.
- [ ] The main chat-button hook in `spycraft2.mjs`: move onto `chatControls`.
- [ ] The pass-through list of record fields in `rollCheck`: move onto `flags`.
- [ ] Let each rule module register its own contributor instead of listing them centrally in `module/rolls/`.
- [ ] Keep splitting `module/documents/actor.mjs` (still about 395 KB) by workflow.

## Architecture (from the November review)

- [ ] Decide how far feat automation goes before extending the proof/lease/receipt pattern to the remaining feats;
      consider a lighter "declare and remind" tier for most of them.
- [ ] Replace the embedded-Item resource locks with writes routed through the active GM.
- [ ] Give the roughly fifty untyped `ObjectField`s on the agent schema real schemas and a version, and add migrations.
- [ ] Move round-scoped states (stances, Total Defense and similar) to Active Effects with durations.
- [ ] Adopt a formatter and linter and reformat the dense one-line modules in one pass.
- [ ] Tests: discover test files by pattern instead of listing them in `package.json`; make the engine fixtures read
      `src/data` rather than built packs so `npm test` runs while Foundry is open without `SPYCRAFT_PACKS_DIR`.
- [ ] Docs: archive the batch ledgers and QA records; `docs/resume-checkpoint.md` still names the other checkout.
- [ ] Localization: most dialog and sheet text, including everything added for gear and vehicles, is hard-coded English.

## Game areas still missing or thin

- [ ] Map integration: range, cover, flanking, adjacency and blast areas are typed into dialogs, not measured.
- [ ] Baseline combat actions: autofire, burst and strafe, suppressive and cover fire, grapple actions, blast damage.
- [ ] Hazards applied to a character: poison, disease, radiation, fire.
- [ ] Cooperative skill checks.
- [ ] NPC qualities, feats and class abilities are listed for reference and not executed.
