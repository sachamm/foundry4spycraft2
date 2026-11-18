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

Done on 2026-11-17. The registry is `module/rules/roll-pipeline.mjs`; a rule registers from its own module and
`module/rolls/index.mjs` imports every module that does (a test checks none is missed).

- [x] Dialog phase. The skill, save, Knowledge, attack, ranged attack and damage dialogs are ordered parts in
      `module/rolls/dialogs/`; a rule adds a section with a `dialog` contributor and an `at` position. Thirteen
      rule-owned sections register from their own modules. The HTML of 94 captured dialogs is identical to before.
      The skill dialog's field coercion runs on the `read` phase.
- [x] Modifier rows. The attack bonus (30 parts), the skill total and the save total are labelled rows built by
      `planTotal`, which also lets `stage: "plan"` contributors add to the previewed total; plan rows are recorded on
      the posted check and never counted again at the roll.
- [x] Every chat button comes from a `chatControls` contributor behind one render hook
      (`module/rolls/chat-controls.mjs`).
- [x] The 90 pass-through record fields use `record`: 32 are named by the contributor that validates them, 58 are
      listed in `module/rolls/record-fields.mjs`.
- [x] Contributors register from the module that owns the rule (82 modules). Validation order is unchanged and pinned
      by a test.
- [x] `module/documents/actor.mjs` is a 65-line class composed from seven workflow files in `module/documents/actor/`.

Still inline, and worth doing as rules are next touched:

- [ ] The individual feat terms inside `weaponAttack` and `resolveSkillCheck` are still worked out there, because each
      also feeds threat, error and notes. Moving one out means giving it a plan-stage contributor that returns all of
      those, not just a number.
- [ ] After a dialog closes, the roll methods still build their own plans from the input. Only field coercion is on
      the `read` phase.
- [ ] The small follow-up dialogs (reach geometry, mortar and launcher circumstances, Killer Instinct range) are
      still inline templates.
- [ ] `module/documents/actor/rolls.mjs` is still about 2,400 lines; `rollSkill` is the bulk of it.
- [ ] 58 record fields are in the central list because no contributor owns them yet.

## Architecture (from the November review)

Status after the live checks of 2026-11-17 on Foundry 14.370 (two clients: the GC and a second GM-role user).

- [ ] **Decision needed: how far feat automation goes.** Recommendation: keep the proof/lease/receipt pattern for the
      roughly forty workflows that have it, and stop there. For the rest, add a "declare and remind" tier: a feat
      names the roll kinds it bears on and a one-line reminder; the roll dialog lists the ones that apply, and those
      ticked are noted on the card for the GC to adjudicate. The dialog, read, record and flavor phases already
      support this; it needs a field on feat items and the reminder text for each feat.
- [x] Resource locks. A GM-arbitrated lock exists (`module/rules/gm-locks.mjs`, world setting "Resource locking").
      Checked with two clients: a held character is refused with the usual message, the lock is freed afterwards,
      and no lock document is written. **The document lock stays the default on purpose:** the arbitrated table
      lives in one client, so a GC signed in from two browsers would have two tables. Only the lock is arbitrated;
      the work still runs on the acting client. Routing the writes themselves would mean rewriting each workflow as
      a request the GC's client carries out.
- [x] Schema version and migrations: the world records its schema version and runs pending migrations on start
      (`module/migrations/index.mjs`). The live world was stamped at version 1 by the GC's client.
- [x] Typed records. Every open object field on every actor and item model declares its shape
      (`module/data/record-shapes.mjs`, 67 records; `npm run check:schemas` reports none untyped). The shapes come
      from about 6,000 recorded updates across the test suite, the compendium documents, and the stored test world;
      2,458 recorded writes, 1,921 compendium documents and 1,257 stored records all fit. Thirteen records nothing
      ever wrote list the keys the code reads and are otherwise open. The check stays soft on purpose: a misfit is
      reported once in the console and nothing is rejected or stripped. `CONFIG.debug.spycraft2Records = true`
      makes a misfit fail validation, for use while developing.
- [x] Round-scoped states are shown as Active Effects with a duration (`module/apps/round-state-effects.mjs`),
      kept in step by the GC's client. Checked live: declaring Combat Expertise produced its effect, and the
      effect went when the character's count came round. **The record on the character is still the state**; the
      effect is its display. Making the effect the storage would mean rewriting each state's write, rollback and
      review path, and the rules' own-count clocks do not map onto Foundry's durations.
- [x] Formatter and linter: Prettier and ESLint (`npm run format`, `format:check`, `lint`), run in CI. Every module
      was reformatted in one pass. Lint reports 27 unused-variable warnings and no errors.
- [x] Tests are discovered by pattern (`tools/test-*.mjs`), and the engine fixtures build their documents from
      `src/data`, so `npm test` runs with Foundry open.
- [x] Batch ledgers and QA records moved to `docs/archive/`.
- [x] Localization. Text is translatable, with unchanged English output:
      - Templates read `SPYCRAFT.Template.*` (1,131 strings); chat buttons and settings have their own keys.
      - Text written in JavaScript uses the `loc` template tag (`module/i18n.mjs`): the English stays in the source,
        its pattern is the key, and `npm run strings` collects every pattern into `lang/en.json` (6,551 entries from
        about 6,500 places: dialogs, chat notes, notifications, error messages). A test keeps the file in step.
      - Labels in tables built when a module loads are read through getters, so they follow the language too.
      - Display names from the rules data (skills, named checks, feat trees, pick categories, bonus targets) are
        translated in `CONFIG.SPYCRAFT` when the language loads (`module/i18n-data.mjs`).
      - Rules no longer recognise text by its English wording: the two class timing notes are matched by identity,
        a pending focus choice names its tab, and a stored fatigue event keeps a fixed reason.
      Checked in Foundry 14.370 after the first pass (all strings load; a translation supplied at runtime appears
      in the roll dialog). The last pass (load-time labels, data names, the GC console and the entry point) is
      covered by the test suites only: no world was running to check it in.
- [ ] What a translator will still find in English, by design or for later:
      - Names the rules compare: feats, class abilities, origins and everything in the compendium packs. Foundry
        has no built-in translation for compendium content; that needs a module such as Babele and a mapping.
      - Short labels without a recognised place: entries of plain lists, `name:` values without an id beside them,
        and maps of labels whose keys are not `label`, `text` and the like (about thirty tables).
      - The setup checklist rewords a repeated Versatility choice only in English; other languages get the plain
        "(n choices)" form.
      - Strings were extracted mechanically. A sentence built from several pieces is several entries; the long
        skill-check note is one entry with many numbered slots. These want rewriting before a real translation.
      - If clients use different languages, text stored on a document (a chat card's flavor, a recorded note)
        stays in the language of the client that wrote it.

## Game areas still missing or thin

- [ ] Map integration: range, cover, flanking, adjacency and blast areas are typed into dialogs, not measured.
- [ ] Baseline combat actions: autofire, burst and strafe, suppressive and cover fire, grapple actions, blast damage.
- [ ] Hazards applied to a character: poison, disease, radiation, fire.
- [ ] Cooperative skill checks.
- [ ] NPC qualities, feats and class abilities are listed for reference and not executed.
