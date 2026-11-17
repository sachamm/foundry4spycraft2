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
- [x] Live-check **Reroll with ability**, **Resolve Unnerving stress** and **Strut** (2026-11-17, throwaway copies
      of a sample agent: Virtuoso Meticulous, Test Subject with Unnerving, Brawler 3 with the Strut ploy in a combat).
      Each button appeared on the live card, ran, recorded its result once and then disappeared.
- [x] Agent Gear tab: browse the Gear and Vehicles packs, add an entry, set its pick category and check the mission
      pick totals (an overspent category is flagged).
- [x] Gear item sheet: table values show, **Damage save** rolls and the failed-save count updates.
- [x] Vehicle item sheet: **Place on a scene** creates a Vehicle actor with the same statistics.
- [x] Vehicle actor sheet: drop a character to set the driver, toggle In motion, roll a Damage save with a critical
      hit, check the Vehicle Damage result changes the current ratings, then **Repaired**. Tyre save also checked.
- [x] Put a vehicle token into a combat encounter and confirm the tracker and the combat hooks do not throw.
- [x] Add Playwright layout fixtures for the vehicle sheet and the two changed item templates
      (`tools/tests/vehicle-sheets.spec.mjs`; root classes and scroll reach, like the other fixtures).
- [x] Compendium browser summaries ran paragraphs together ("p.276.The printed table…"); `plainText` in
      `module/apps/browser.mjs` now separates block elements.
- [x] A vehicle in combat takes its driver's initiative: rolled alone it uses the driver's bonus, and a combat hook
      copies the driver's result. New vehicle actors get linked tokens so fuel and damage stay on the vehicle.
- [x] Rebuild the real packs (`npm run build`, with no world open): every pack rebuilt; `test:packs` passes.

## Gear and vehicle data

- [x] Cross-check against the PDF text (both printings). Gear tables matched. Vehicle fixes: Turning lost behind
      PD/PC/wind Acceleration, the "3.4" A/T misprint, bundled extras moved out of the Size label, the repeated
      tractor-trailer rows, trailers made tractor-trailer options, wrapped missile launcher names, two upgrade name typos
      and "EVN" for ENV.
- [x] Footnotes are codes with short labels of our own per table (`footnotes` in gear.json and vehicles.json), shown on
      item sheets. Team-wide picks get "Issue to the team" (GC).
- [x] Gargantuan tyre save bonus: +5, recorded as a house rule between Huge (+4) and Colossal (+6).
- [x] Armor upgrades (Table 4.14), weapon upgrades (4.60) and detonators (4.61): `src/data/upgrades.json`, Equipment
      Upgrades pack.
- [x] Contagions (Table 4.70): `src/data/contagions.json` and a Contagions pack, reference only.
- [x] Original one-line summaries for every gear pick (`src/data/gear-summaries.json`).
- [x] Standing-only entries: "Pay the cost" in Reputation or Net Worth, recorded once, GC refund.

## Vehicles in play

- [x] Chases: the tracker takes each side's vehicle (or a character on foot) and the Maneuvering Room, fills in ratings
      and starting Lead, shows distance, chase speed, fastest-vehicle bonus and Crisis DC, refreshes ratings and uses
      fuel each round, and lets the GC change the room. Not modelled: chained pairs, crashes.
- [x] Defense against a specific attacker: choose the attacking vehicle on the sheet.
- [x] Cargo, occupant, weapon/gear and draft-animal results report the damage passed on (armor-piercing included);
      occupants are picked from the people aboard; rotors roll their own save; results that cannot apply are rerolled.
- [x] Occupants and crew: driver plus crew and passengers, skeleton crew from how the vehicle was acquired, entry
      movement, bail-out Reflex save (ejection seats +6).
- [x] Fuel: hours used (double above cruising), a minute per combat or chase round, losses, refuel.
- [x] Qualities: reference labels on the vehicle sheets; Rugged, Heavy Armor, Flammable, Tracked, Forgiving,
      Unforgiving, Trained Only, Drone, Crew/Capital Scale and the Hot/Luxury loss note take effect.
- [x] Vehicle weapons are weapon items (Vehicle Weapon, Guided or Indirect Fire), one per ammunition type; installed
      on a vehicle, "Fire" gives the gunner a vehicle-mounted copy.
- [x] Upgrades: drop upgrades on the vehicle; free upgrades and weapon spaces are counted; rating, speed, save and
      quality changes apply.
- [x] Mounts: drop an NPC on a mount whose statistics say "NPC" to use its Defense and Damage save.
- [x] Control checks: the driver rolls the category's skill and Drive focus, with the untrained penalty and error
      increases from qualities and Lift damage.
- [x] Hazards (Table 4.76): terrain, surface, weather and wind chosen on the vehicle sheet feed its control checks
      (off-road/tracked figures, error increase, impassable ground, speed cut, Size relief, Stabilized, tolerance).
- [x] Fuel explosions (Table 4.73): a Fuel result on a burning vehicle (or from fire damage) rolls the explosion
      multiplied by the remaining fuel hours; also a sheet button. Alcohol and propane use the gas column (house rule).
- [x] Signature (Table 4.75) per sensor from Size, HOB/LOB sizes, jamming and speed; acceleration to distance (4.74).
- [x] Smash: the chase tracker records who holds Smash points, moves them with opposed checks, lets the winner spend
      one, and shows the range Lead against the holder.
- Tables 4.73 and 4.75 print Colossal above Gargantuan; the data follows Size order instead (Gargantuan smaller).

## Gear in play

- [x] Gadgets: set a housing Size on an item, drop mechanisms within the housing's limit; Knowledge DC, Damage save
      and Complexity follow; a failed save costs a random mechanism. Weapons cannot be housings yet.
- [x] Battery life: use by hours or uses, the d20 dry-out roll past battery life, recharge with its cost.
- [x] Items add their result cap (and gear bonus where printed) to the checks they support when chosen as the gear
      in use; broken or dry items block the check. Gadget Skill check mechanisms roll at PR × 4; signal reception DC
      from range increments and jamming.
- [x] Repairs: an Electronics or Mechanics Repair check against the item's Complexity DC clears its failed saves.

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
