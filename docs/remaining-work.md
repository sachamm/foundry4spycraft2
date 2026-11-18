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

Finished later on 2026-11-17:

- [x] Feat and class terms are out of `weaponAttack` and `resolveSkillCheck`. A new `terms` phase lets a rule return
      its whole part of a planned check: its plan, labelled rows, threat and error changes, notes and block reason,
      each with a position (`planTerms` in `module/rules/roll-pipeline.mjs`). Thirteen attack terms and fifteen skill
      terms register from their own modules. The output of 4,460 recorded plans is unchanged.
      What stays in the two functions changes the check itself rather than adding to it: weapon qualities, grip,
      range, recoil, and the skill rules that alter timing, the synergy list or the error floor.
- [x] After a dialog closes, the save roll folds registered save terms (nine rules) instead of building its own plan,
      and the attack dialogs' fields are read by `read` contributors in the modules that own them.
- [x] The follow-up dialogs (reach geometry, mortar and launcher circumstances, CQB damage distance, Killer Instinct
      range) are pipeline dialogs in `module/rolls/dialogs/follow-ups.mjs`.
- [x] `module/documents/actor/rolls.mjs` is split three ways: `rolls.mjs` (the shared roll, attribute checks, saves,
      action dice; about 700 lines), `skill-rolls.mjs` (about 820) and `attack-rolls.mjs` (about 660). `rollSkill`
      lost its repeated field lists and five copies of the plan call.
- [x] The central record list is down to the roll's own two fields; the other 56 are named by a contributor in the
      module that owns each rule.

## Architecture (from the November review)

Status after the live checks of 2026-11-17 on Foundry 14.370 (two clients: the GC and a second GM-role user).

- [x] **How far feat automation goes.** The recommendation was adopted: the forty-odd proof/lease/receipt workflows
      stay, and the rest get a "declare and remind" tier (`module/rules/feat-reminders.mjs`). A feat item has
      `system.reminder` (the rolls it bears on, and a line of text). Roll dialogs list the character's matching
      feats; the ones ticked are noted on the posted check for the GC. Seventy-two feats the rules never mention
      ship with reminders (`src/data/feat-reminders.json`, text from the existing summaries); the fields are on the
      feat sheet for home-made feats. Schema version 2 gives feats already in a world their reminder.
      Initiative and plain attribute checks open no dialog, so they cannot remind.
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
- [x] Translator leftovers, worked through in the second pass:
      - Feats are recognised by a stored rule name (`flags.spycraft2.ruleName`, set when the packs are built), or by
        the original name the Babele module keeps, so a renamed or translated feat still works
        (`module/rules/rule-name.mjs`). The system ships no compendium translations and does not need Babele.
      - 162 more labels in the sheets and apps are tagged: option lists, breakdown rows, tab and tooltip maps, GC
        tool choices.
      - The setup checklist's wording for several choices at once comes from the rule that asks, in any language.
      - Thirty-two sentences that were built by adding pieces together are single entries with their values in
        place, and the long skill-check note is a run of separate segments.
      - A check posted by a client in another language has the notes worked out from its record written again in
        the viewer's language.
      Still English, on purpose:
      - Class abilities, origins and gear are matched by name or key from the rules data, not by item name, and are
        not translated. Names of weapons, gear and other compendium entries are display text only.
      - Text a client composed and stored (a check's own title line, chat cards the tools post, recorded notes)
        stays in the language it was written in.
      - Label tables inside `module/rules` whose strings are also identifiers (sizes, conditions, feat and ability
        names) were left alone.

## Game areas added (2026-11-17, second pass)

Checked in Foundry 14.370 on 2026-11-17; see "To check in Foundry" below.

- [x] Map integration (`module/rules/map.mjs`, `module/apps/map.mjs`). With a token for the character and one token
      targeted, the attack dialogs open with the measured distance, the flanking box set from tokens on opposite
      sides, reach adjacency and the target chosen, and say what cover walls give. A blast lists every token it
      reaches and the damage each takes. Client setting "Measure attacks from the map", on by default.
      Not done: cover from other tokens or scenery items, drawing the blast on the scene, and measuring for skill
      dialogs. Blast listing ignores walls.
- [x] Baseline combat actions (`module/rules/combat-actions.mjs`). Burst, Autofire and Strafe are fire actions on the
      ranged attack dialog, with their shot counts, penalties and error ranges, and a button on the posted attack
      that counts the shots that hit. Cover Fire and Suppressive Fire post their terms (Cover Fire rolls the
      target's Will save when you own the target). Pummel doubles an unarmed hit's subdual damage. "Settle a grapple
      check" gives the result of an opposed check and the benefit list. Blast damage tapers by distance from a
      damage roll. Not done: ammunition is not deducted, and Held, Pinned and the –4 penalties are recorded by hand.
- [x] Hazards on a character (`module/rules/hazards.mjs`): contagions from Table 4.70 with onset times, phase saves,
      dose penalties, attribute damage (temporary and permanent), matching stress, conditions and antidotes;
      radiation poison with the sealed-suit bonus; fire with its armor-piercing value, catching fire, damage each
      round, stress, fighting the fire and the scarring save. Agents only; NPC sheets have no hazards block.
      Not done: a fire spreading across squares, contagious diseases passing between characters, other damage
      types (acid, cold, electrical, vacuum).
- [x] Cooperative skill checks (`module/rules/cooperative.mjs`): helper limits from Table 2.9 on every named check,
      leader and helper roles in the skill dialog, the helpers' DC, and a button on the leader's check that adds
      the helpers' results. Team and directed checks are not modelled.
- [x] NPC qualities (`module/rules/npc-qualities.mjs`): every quality an NPC holds says what it does on the sheet,
      with its numbers. Speed, Size, damage reduction, resistances, senses and forced-save DCs are worked out;
      Fearless, Meek and Strong-Minded apply to the NPC's skill checks, and situational ones are boxes on that
      dialog; Unnerving and Improved Vision feed the same rules an agent's origin does. NPC feats and class
      abilities are still names: a feat item on an NPC gets the reminder tier on attack rolls.

## To check in Foundry

Run on 2026-11-17 in Foundry 14.370 (world "spycraft test"), with a throwaway agent, NPC and scene that were deleted
afterwards. Unit tests: 3,313 of 3,314 pass; the one failure is the sample-scenes pack check, which cannot open the
pack while Foundry holds it (LEVEL_LOCKED), so it needs Foundry closed.

- [x] The world migrates to schema version 2 and owned feats gain reminders. The world is at 2; none of its 14 owned
      feats has a reminder in the data, so nothing changed there. A feat with its reminder cleared regained it.
- [x] A skill, save, attack and damage dialog each list the feats to keep in mind; ticked ones show on the card.
      Fixed: in the skill dialog the reminder box overlapped the "Situational modifier" and "Secret" rows, because
      the dialog body let its blocks shrink (`styles/retro.css`).
- [x] Attack dialogs fill in distance, flanking and target from the scene; the blast button lists tokens.
- [x] Burst, Autofire and Strafe from the ranged attack dialog; the hit counter; Cover Fire's Will save.
- [x] Expose an agent to a contagion and to fire; roll and apply the saves; check attribute damage and stress.
      Fixed: every hazard write (exposure, save, fire, antidote) reset the whole character to default values,
      because the update was non-recursive (`module/apps/hazards.mjs`). `tools/test-update-shapes.mjs` now guards
      against non-recursive document updates.
- [x] A cooperative check with a leader and two helpers; the leader's result rises.
- [x] An NPC with qualities shows them in play; its skill check takes the modifiers.
- [x] A save roll, an attack and a skill check still read as before (the roll code was reorganised).

Small things seen while checking, since fixed and checked in Foundry:
- The quick "Attack circumstances" dialog has an optional distance field for ranged weapons, filled from the map,
  so its card gives the range modifier. Left empty, it stays a quick roll with no range modifier.
- Choosing Burst, Autofire or Strafe sets the fire mode the action needs.
- The Strafe note gives the doubled recoil penalty in all (the recoil line still shows the single value).
- Cover Fire's opponent list preselects the targeted token and marks an unlinked token as "(token on <scene>)", so
  it is not confused with its sheet.
- The hit counter refuses a negative Defense.

## Combat chapter sweep (2026-11-18)

Chapter 5 was read section by section against the system. What was missing is now in place; each piece joins an
existing hook rather than adding a new path.

- [x] Critical effects (`module/rules/critical-effects.mjs`): the critical activation dialog offers Table 5.4's
      critical misses for the attack's family (unarmed, melee, hurled, firearm), filtered by the attack's final error
      range, and the critical hit choices by target type (wounds, Table of Ouch, extra failed Damage saves). Picking
      one sets the effect text and base cost; every existing cost adjustment still applies.
- [x] Other damage types (`module/rules/damage-types.mjs`, `module/apps/damage-types.mjs`): acid (armor roll, Reflex
      save, lingering and halving, washing, scarring), bang and flash (Fortitude DC, stunned/deafened/blinded, 1d4
      stress, takedown over 20), explosive (Reflex with movement bonus or forced failure, half damage minimum 1,
      Fortitude stun, 1d4 + quarter stress), electrical (subdual, nausea and Count loss or unconsciousness, injuries at
      25 and 50), cold and heat (subdual on the temperature schedule, fatigue and temporary attribute damage, armor
      penalty against heat, injury at 50), vacuum (5d6, first-round save halves, injury at 25), collision and laser
      stress. Saves run through the hazard save hook (`hazardSaveResolvers` in `module/apps/hazards.mjs`); stress and
      subdual go through the damage ledger. "Other damage types" on the agent sheet's Hazards line.
- [x] Survival saves (p.349): suffocation, smoke, sleep loss, starvation, thirst and water pressure, each DC rising
      by 1 per save until the hazard ends. "Survival save" on the Hazards line.
- [x] Underwater attacks (`module/rules/underwater-combat.mjs`): an attack dialog box; melee and explosives take the
      Athletics-based penalty and error +2, unarmed none, other weapons need underwater gear; Aquatic is immune.
- [x] Actions (`module/rules/combat-options.mjs`, `module/apps/combat-options.mjs`): Anticipate, Joint Action, Stand
      Off and Tire are named checks on Sense Motive, Tactics and Resolve. "Anticipate result" records the dodge bonus
      against one opponent for a full round and the incoming-Defense check offers it; "Stand off" rolls the entry
      Reflex save or a lost round's stress; "Tire result" applies subdual or flat-footed; "Survive a Coup de Grace"
      and "Cancel a readied action" roll their saves.
- [x] GC console "Combat references" (`module/rules/gc/combat-reference.mjs`): base encounter distance (Table 5.1,
      capped by the farthest sense range on the scene), deviation (Table 5.11 and ricochet), gas cloud growth and
      clearing with wind, and special surface movement (Table 5.3).

Not done, left to the table: the laser's lower critical cost (the attack record does not know its damage type),
halving Strength damage underwater (noted on the card), the Joint Action's shared Count in the tracker, Terminal
Situations, and spreading fire or gas across squares.

To check in Foundry (Foundry was running, so these were covered by unit tests only): the new sheet links and
dialogs, a hazard save card's "Apply this save's result" for each new kind, the Anticipate box in the incoming
Defense check, the ready-made effects in the critical activation dialog, and the GC console button.

## The main loop joined up (2026-11-18)

Attacks, damage, ammunition, healing and opposed checks each worked alone; the numbers were carried between them by
hand. They are now linked. Rules are in `module/rules/damage-application.mjs` and `module/rules/ammunition-use.mjs`;
the Foundry side is in `module/apps/damage-application.mjs`, `healing.mjs`, `opposed-checks.mjs` and
`ammunition-use.mjs`.

- [x] **Hit or miss.** "Resolve against Defense" on an attack card reads the target's Defense from its sheet (or takes
      one typed in, for cover and declared defenses), counts the shots of a Burst or Autofire that land, confirms the
      check's outcome and ends the target's flat-footedness on a hit. A Strafe keeps its own counter.
- [x] **Damage onto the target.** A hit offers "Roll damage", which carries the target and the attack. "Apply damage
      to a target" on a damage card takes lethal damage off a special character's vitality and wounds after damage
      reduction and armor-piercing (a critical hit goes to wounds while vitality remains), sets fatigued, unconscious,
      dying or dead, reports bruising and the Fortitude save for a hit of 25 or more, sends stress and subdual damage
      to an agent's ledger, rolls a standard NPC's Damage save with the critical dice and blast, and rolls a vehicle's
      Damage save. Whoever applies damage must own the target: the GC, or the target's own player.
- [x] **Ammunition.** A weapon with an ammunition code counts shots loaded and in reserve (`shotsLoaded`,
      `shotsSpare`; empty means the printed supply). Attacks, bursts, autofire, Cover Fire and Suppressive Fire spend
      them, an attack the weapon cannot feed is refused, and "Reload" on the sheets refills from the reserve (3 shots
      at a time for an internal supply). World setting "Count ammunition", on by default.
- [x] **Conditions.** Stunned, dazed, helpless, vulnerable, paralyzed, dying, bleeding, fixated, frightened,
      terrified, frenzied and hidden are token statuses; the ones the rules engine already understood now reach it.
      An opening grapple check sets Held on the opponent, or Sprawled or Flat-footed on the loser, when you own them.
- [x] **Healing.** "Rest and recover" applies the natural rates (with Treatment and failed Foraging) for the hours and
      days entered and lifts fatigue after 8 hours. A successful First Aid check offers "Apply First Aid to the
      patient" (once per patient per scene; DC 20 also stops bleeding), and Stabilize stops a dying patient at 0
      wounds. "Dying: roll to stabilize" makes the end-of-round d% roll.
- [x] **Opposed checks.** "Compare with an opposing check" on a rolled skill check lists the recent results in chat
      (or takes a typed one), settles ties by bonus and then a roll-off, and confirms both checks when you own both.
      The grapple and Dramatic Conflict dialogs show the latest results beside their typed totals.

Finished later on 2026-11-18 (the items first left to the table):

- [x] **Saves a report calls for.** A hit of 25 or more posts its report as a card with "Roll the Fortitude save":
      the button makes the character's save through the usual save roll (its dialog opens where the character has
      one), and the save card's "Apply this save's result" rolls the critical injury on a failure and drops wounds
      to –9 for a hit of 50 or more.
- [x] **Special NPCs' stress and subdual damage.** Two running totals on the NPC (shown on its sheet, editable).
      Damage reduction counts twice against subdual damage; when a threshold or a critical hit calls for a save the
      report carries the Will or Fortitude button, and a failed subdual save sets unconscious with its duration.
- [x] **Special damage types.** The apply dialog has a "Special damage type" choice, filled in from the weapon. For an
      agent it hands the damage to that type's own rules (the existing dialog opens with the type, amount and
      remaining damage reduction filled in); fire goes to the fire hazard.
- [x] **Blasts.** "Apply the blast to everyone caught" on a blast weapon's damage card lists the characters you own,
      with distances measured from the targeted token when there is a scene, and settles each at its halved damage.
- [x] **Grapple benefits.** After a check that earns benefits the winner picks them; Pin, Sprawl, Throw, Mute, Escape
      Hold and Break Pin change the conditions on both sides.
- [x] **Stress and subdual recovery.** "Rest and recover" wears both off over the time rested, at the rate the
      current total sets (faster as it falls), for agents and special NPCs.

Still left to the table: a player cannot apply damage to a character they do not own; a failed stress save on a
special NPC names the Shaken grade and leaves it to "Apply Shaken"; a special damage type on an NPC is applied as
ordinary damage with its other effects by hand; blast distances ignore walls and cover; a grapple benefit's damage
(Injure, Throw, Sprawl) is rolled from the weapon card and applied separately.

To check in Foundry (Foundry was running, so these were covered by unit tests only): each new chat button on a live
card, the reload line on the agent and NPC sheets, the shot fields on the weapon sheet, the new token statuses, a
player without ownership of the target being refused, the save buttons on a damage report and the save card that
follows, the blast dialog with and without a targeted token, the grapple benefit dialog, and the stress and subdual
fields on a special NPC's sheet.
