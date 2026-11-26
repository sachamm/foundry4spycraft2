# The Field Agent's Handbook for Foundry VTT

An unofficial game system for [Foundry Virtual Tabletop](https://foundryvtt.com) for espionage roleplaying. It implements core rules and character options built on Open Game Content; see [Legal](#legal).

- **System ID:** `spycraft2`
- **Foundry compatibility:** v14 (minimum 14, verified on 14.370)

## Sample characters

The **Sample Level-1 Agents** compendium contains 16 fully built agents covering all 12 base classes, including four alternate builds. Each has completed creation choices, an example Caliber-II mission loadout, background, contacts, portrait and matching token. All 16 are copied into the Sample PCs Actor folder on the first GM launch; Tomas also receives his linked animal partner, Bracken. Additional copies can be imported from the compendium. See [the roster and build assumptions](docs/sample-agents.md) and [art gallery](assets/agents/catalog.html).

The built-in **Operation Glass Wake** Adventure compendium prepares a first session for four level-1 agents: three staged encounters, four pregens, five NPCs, private GM notes, a player briefing and a mission-setup macro. Open **Compendium Packs → The Field Agent's Handbook → Operation Glass Wake**, open the adventure and choose **Import Adventure**. Then read **Start Here — Import and Mission Setup** in the imported GM journal. The macro asks before preparing an inactive TL 1 / Caliber II mission and refuses to replace an existing mission record; review and start it through GC Console, then initialize session resources. Import is optional and leaves the active scene unchanged. Reimporting can replace this adventure's previously imported documents after Foundry's overwrite prompt. No separate add-on module is needed.

## Development setup

Foundry loads systems from `{userData}/Data/systems/<id>`. Run this from the repository root to symlink this checkout there so edits show up after a reload:

```bash
# macOS (default user data path)
ln -s "$PWD" \
  "$HOME/Library/Application Support/FoundryVTT/Data/systems/spycraft2"
```

Then create a world using **The Field Agent's Handbook** system.

## Building

Compendium packs are LevelDB folders generated from `src/data/*.json`. After cloning (or pulling changes), run:

```bash
npm install
npm run build   # writes packs/* and module/rules/tables.mjs
npm test        # validates data, engine fixtures and Node regressions
npm run test:packs # checks rebuilt LevelDB content after building
```

The build leaves any pack that another process has open (a running Foundry) untouched and says so; close Foundry and
run it again to refresh those. To build or test somewhere else, set `SPYCRAFT_PACKS_DIR=/some/folder` for
`npm run build`, `npm test` and `npm run test:packs`.

`src/data/*.json` is the source of truth for the rules data (numbers, tables, names and formulas): edit those files
directly. All descriptive text (feats, origins, class abilities) comes from `src/data/summaries.json`: original,
condensed summaries written for this system; none of it is copied from the rulebook. The test fixtures in `tools/fixtures/` are saved
reference results.

## What the character sheet does

**Using the sheets:** **Edit character** (or **Edit NPC**) opens build fields; **Done** returns to play.
The window header reports unsaved edits, saving, successful saves, or a failed save that needs another edit to retry.
Routine attacks show the target, action and range first, with **Standard Attack** selected unless another action was supplied.
**Special circumstances** retains Aim/Brace declarations, tricks and other modifiers; collapsing it preserves entered values.
Required range and Reach declarations stay visible. Sheet tabs support Left/Right, Home/End, Enter and Space;
catalog entries and NPC actions support Enter and Space. Keyboard selection in the catalog retains focus after its preview loads.

Important captions use 13px type with normal capitalization and wrapping. Advanced attack options are grouped by purpose;
attack and skill dialogs provide **Find an option** search. Search only filters the display: selected values remain in the roll.
Short declarations keep their full conditions as visible, accessible help. Damage application starts with target, damage,
kind and reduction source; armor penetration, critical hits and special damage have separate groups with applied-option counts.

**Faster play at the table:**

- **Shift-click** a weapon, save or skill to roll straight away with the choices you made last time for it. A player
  setting, *Roll without the dialog by default*, swaps plain click and Shift-click.
- Roll dialogs remember your last choices for that weapon or skill for the rest of the session, and say how many were
  carried over, with a **Reset** button. Targets, distances, Aim, Brace and anything the GC confirms always start blank.
- Roll cards put the next step first as a highlighted button: **Spend 1 action die**, then **Resolve vs Defense** against
  the targeted token, then **Roll damage** (pre-filled from the attack), then **Apply** to the target or to each targeted
  token. The full dialogs stay one click away for anything unusual. **Finish** is a small button at the end.
- Boost buttons appear only on agents' cards; **Generous teammate die** appears only when you own a Pointman teammate.
- A notice and a highlight on the round tracker tell you when your character's turn comes up (player setting).
- Drag a weapon or a skill from the sheet onto the hotbar to make a macro that rolls it. Shift-click works there too.
- The rail shows XP and a **Level up** button when enough XP is banked; each class block has a **+1 level** button.
  The dashboard lists abilities with uses left this scene, session or mission.
- NPC sheets show weapons under the header, list skills as rollable links, and keep rarer actions under **More actions**.

The agent sheet calculates:

- **Attributes** — 36-point buy with cost table, origin modifiers, level increases at 4/8/12/16/20, misc.
- **Origins** — talents & specialties apply their modifiers (some scale with career level) and grant their feats automatically.
- **Classes** — free multiclassing by career level; BAB, saves, Defense, Initiative, Wealth and mission-gear picks from each
  class table; vitality rolls; class abilities with level-scaled text; class-ability choices (Network, Masks, Bonus Feat…)
  that feed back into feat slots, contacts, etc.; expert-class requirements.
- **Skills** — skill points per level (×4 at level 1), class vs. cross-class ranks by the class taken at that level,
  max ranks, threat ranges, result caps, both key-attribute totals.
- **Feats** — slots by level and by tree, prerequisite checking (with a compendium browser that shows what you qualify for).
- **Training** — weapon proficiencies/fortes, focuses (Cultures, Drive, Profession, Science, generic), interests, contacts, subplots.
- **Gear** — wealth split between lifestyle, possessions and spending cash; weapons with trained/untrained attack bonus;
  armor affecting Defense, Reflex and Speed; mission gear picks by category. The gear browser hides anything newer
  than the game clock's year (Show future gear lists it again) and filters by Caliber and restriction. Entries the
  book leaves undated carry our own dates, and house items cover 1939–1949 where the book has nothing that early.
- **Final totals** — vitality, wounds, stress/subdual thresholds, knowledge/request/gear checks, action dice, carrying capacity.

Build problems are shown as warnings. Executable workflows also reject invalid actions, unavailable gear and insufficient resources. The [RAW review and residual implementation ledger](docs/archive/raw-character-review.md) distinguish verified mechanics from remaining manual rules. Personal gear classification, field acquisition, measured attacks and class resource controls are documented there; catalog presence alone does not establish complete automation.

The [November 26 rules-completeness review](docs/rules-completeness-review.md) includes the original 8/10 pass and
an expanded checkpoint scoring PC creation at 8.7/10 and combat play at 8.5/10. The requested 9.9 target remains
unmet; the report lists implemented fixes, scoring criteria, regression evidence and required remaining work.

Classes also provides ordinary GC action-die awards and once-per-mission XP settlement using the user-selected p.440 formula. Gear records Armor Use armor and reviewed higher-Caliber mission picks; Caliber V upgrades remain separate. Soldier 14 can declare One in a Million before an eligible roll. See the ledger for each workflow’s limits.

Implemented resource controls coordinate multiple Foundry clients. Classes provides GC recovery controls for interrupted actions; check the recorded result and current resources before retrying an interrupted transaction. Complete character exports omit temporary transaction bookkeeping.

**Check numerical advantage** on the agent sheet prefills physical counts from the running combat. It uses that combat's scene and token dispositions to suggest opposing sides, with defeated combatants starting at zero. Neutral or unclear participants and characters outside combat remain available for manual entry. Review the counts and assign teammate groups before confirming: sharing a token disposition does not establish a Tactical Advantage teammate relationship. Players cannot count hidden participants they cannot see, so the GC should review the full roster. Without a running combat, enter the roster manually.

## Game clock and timers

The world keeps the time. A badge above the players list shows it; click it for the **Clock and timers** window
(or `game.spycraft2.clock.open()`). The GC moves the clock from there or from the GC Console, and **Set the date…**
names the present moment without any time passing. Each combat round adds 6 seconds.

Anyone can start a timer: rounds by default, or minutes, hours, days or weeks. A timer kept on a character is an
Active Effect with a duration, so Foundry counts it down, in combat rounds while the character is in a fight and in
game time otherwise, and expires it; a user with no character keeps timers on their own user. The owner is told when
a timer ends with a notice, a sound and a whispered chat card, at once or on the next login. Tick **Show everyone**
to share one. Knockouts and other conditions with a time limit are effects with a duration too, lifted by the GC's
client once Foundry expires them.

The clock uses Foundry's own timekeeping throughout (`game.time`, the world calendar, `CONFIG.time.roundTime`,
effect durations). The one addition is an offset between world time and the date shown, because Foundry can only
set a date by moving world time, which would end every running timer.

A player who needs to change a character they do not own (damage to an NPC, First Aid on a teammate) sends the
request to the GC's client, which asks the GC to allow it. World settings: "Advance the clock each combat round",
"Show the clock to players", "Apply players' requests without asking".

## Chat search

The Chat Messages sidebar has a text search and Character / Roll type filters. Filters combine and search the full readable history, including older messages that are not currently rendered. Text search ignores case and accents and matches every entered word. Results show newest first; use **Open message** to view the original card, **Show more matches** for additional results, or **Clear** (Escape in a filter) to return to ordinary chat. Private messages and hidden roll results remain subject to Foundry's visibility rules. Older untyped rolls are classified from their displayed labels where possible.

## Layout

| Path | Purpose |
| --- | --- |
| `system.json` | Manifest |
| `spycraft2.mjs` | Entry point / init hooks |
| `module/config.mjs` | `CONFIG.SPYCRAFT` constants |
| `module/data/` | Actor & Item TypeDataModels; `record-shapes.mjs` declares the shape of each stored record |
| `module/documents/` | Actor & Item document classes; the Actor's methods are split by workflow in `module/documents/actor/` |
| `module/sheets/` | ApplicationV2 sheets |
| `templates/` | Handlebars templates |
| `lang/` | Localization; `text-template.json` and the `SPYCRAFT.Text` section of `en.json` are generated by `npm run strings` |
| `module/rules/` | Rules engine (`engine.mjs`), prerequisite checks, formula evaluator, generated tables |
| `module/rolls/` | Roll pipeline: the contributor index, chat buttons, dialog layouts and checks that belong to no single rule |
| `module/migrations/` | World data schema version and migrations |
| `module/apps/` | Everything with a window or a workflow of its own: one file per ability or action (its dialog, its chat-card buttons and the steps that spend and record its use), the damage and healing workflows, the GC Console (`gc/`), the compendium browser, the game clock, tooltips and the shared dialog and theme helpers |
| `module/services/` | Shared machinery with no interface: resource transactions and locks, usage periods, GC dice, chat-message lookups |
| `src/data/` | Rules data (source of truth; edit directly) |
| `tools/` | Pack build and engine test scripts |
| `packs/` | Compendium packs (generated by `npm run build`) |

## Credits

Erik Dewey created the [character generator spreadsheet](https://www.erikdewey.com/gaming.htm)
used for the initial data import. Its source archive is
[spycraft2generator.zip](https://www.erikdewey.com/spycraft2generator.zip).

## Legal

This project is unofficial and is not affiliated with or endorsed by any game publisher. Trademarks belong to their owners.

This project contains Open Game Content, used under the
[Open Game License 1.0a](LICENSES/OGL-1.0a.txt). [LICENSING.md](LICENSING.md)
identifies which parts are Open Game Content.

See [Licensing and provenance](LICENSING.md) for existing file-level licenses,
asset sources, soundtrack provenance, and unresolved permission questions.

The source rulebook's text must not be copied into this repository. Contributions must use bare labels and original summaries as required by [AGENTS.md](AGENTS.md). Outstanding licensing exceptions are listed in [LICENSING.md](LICENSING.md). Rules descriptions here are short summaries with page references, so the GC needs the full printed rules to play.

## Installing in Foundry

In Foundry's **Install System** dialog, paste this manifest URL:

```
https://github.com/sachamm/foundry4spycraft2/releases/latest/download/system.json
```

## Releasing

1. Bump `version` in `system.json` and turn the `## Unreleased` notes in `CHANGELOG.md` into a `## <version>` entry.
2. Run `SPYCRAFT_RULEBOOK_TEXT=/path/to/your/rulebook.md npm run release:check -- v<version>`. It confirms the tag,
   changelog and manifest agree, and scans the data and strings for wording copied from the book (the book never
   goes in the repository, so CI cannot run that scan).
3. Commit and push, then publish a GitHub release tagged `v<version>` (e.g. `v0.6.1`). Mark it as a prerelease for a
   release candidate (`v0.6.1-rc.1`); its manifest then points at itself and does not replace the stable one.
4. The **Release** workflow runs every validation check, repeats the tag check, and attaches `system.json`,
   `spycraft2.zip` and `SHA256SUMS.txt` to the release.

## Gear catalog and vehicles

The **Gear** pack lists the Electronics, Gadgets, Resources, Security and Tradecraft picks with their table values
(Caliber, Power Rating, range, Size/hands, battery, Damage save, Complexity, year, street value, Reputation/Net Worth
cost), plus gadget housing sizes. The **Vehicles** pack holds every vehicle from the twelve vehicle tables, and
**Vehicle Upgrades** holds upgrades and vehicle weapons. Entries carry numbers and page references only; the rules for
each item are in the book. The agent sheet's Gear tab browses all three, and anything given a pick category counts
against mission gear picks as weapons and armor already do.

A vehicle is an Item (the pick) with its own sheet. **Place on a scene** creates a Vehicle actor with the same
statistics, so it can have a token. The Vehicle sheet tracks failed Damage saves, shows whether the vehicle is intact,
broken or destroyed for its Size, and applies recorded Vehicle Damage results to its current Acceleration, Turning and
speeds. Drop a character on it to set the driver, whose Dexterity modifier counts toward Defense while the vehicle is
in motion. **Damage save** (also on gear items that list a save bonus) asks for the damage, rolls against DC 10 + half
of it, and counts extra failures for blast damage and critical hits; a critical hit on a vehicle also rolls its
Vehicle Damage result. Results that affect cargo, occupants, weapons, rotors or draft animals are reported for the GC
rather than applied. Chases do not read vehicle statistics yet, and armor, weapon and vehicle upgrades are reference
entries: nothing installs them onto an item.

## Roll pipeline

Every roll made through the Actor's `rollCheck` (skill, Knowledge, attack, damage, save and ability rolls) passes
through one registry, `module/rules/roll-pipeline.mjs`. A rule joins it by registering a contributor from its own
module; `module/rolls/index.mjs` imports every module that does. A contributor may:

- offer named skill checks (`skillChecks`);
- add a section to a roll dialog at a position (`dialog`) and adjust what was entered (`read`);
- hold a reservation while the roll is made (`acquire`);
- validate before and after the dice (`validate`);
- return its part of a planned check (`terms`): a plan, labelled rows, threat and error changes, notes and a block
  reason, each with a position among the check's own;
- add a labelled modifier, either to the previewed total (`stage: "plan"`) or at the roll (`modifiers`);
- copy a roll option onto the posted check (`record`) or add computed fields (`flags`);
- add a button under the posted check (`chatControls`).

The six main roll dialogs and the short follow-up dialogs live in `module/rolls/dialogs/` as ordered parts.
`game.spycraft2.rollPipeline` exposes the registry to macros and modules. Feat and class terms of an attack, a skill
check and a save are registered from the rule's own module; `weaponAttack`, `resolveSkillCheck` and `rollSave` fold
them with `planTerms`.

## Rules in play

- **Feat reminders.** A feat the system does not work out can name the rolls it bears on (`system.reminder` on the
  feat item: for example `attack, skill:sneak, save:will`). Roll dialogs list the character's matching feats; ticked
  ones are noted on the posted check for the GC. Seventy-two feats ship with reminders.
- **Cooperative checks.** Choose leader or helper in the skill dialog. Helpers roll against the DC the leader's
  check sets; a button on the leader's check adds their results. Helper limits come from the skills table.
- **Hazards.** The agent sheet's Main tab tracks contagions (diseases, poisons, radiation) with their onset times
  and saves, and a fire burning the character.
- **Combat actions.** The ranged attack dialog offers Burst, Autofire, Strafe, Cover Fire and Suppressive Fire; an
  unarmed attack offers Pummel; the sheet settles grapple checks; a blast weapon's damage tapers by distance.
- **Hits and damage.** An attack card has "Resolve against Defense": pick the target and the check is settled
  against its Defense. A hit offers "Roll damage", and the damage card has "Apply damage to a target", which changes
  vitality and wounds, rolls a standard NPC's or vehicle's Damage save, and sets the conditions that follow. You can
  apply damage to characters you own; the GC can apply it to anyone. A report that calls for a save has a button that
  rolls it, and a blast weapon's damage card can settle everyone caught in the blast.
- **Ammunition.** Weapons with an ammunition code count their shots. Attacks spend them and "Reload" refills from the
  reserve. World setting "Count ammunition".
- **Healing.** "Rest and recover" on the Main tab; a successful First Aid or Stabilize check offers to apply itself
  to a patient.
- **Opposed checks.** "Compare with an opposing check" on a skill check picks the other side's result from chat.
- **Map measurement.** With a token for the character and one token targeted, attack dialogs open with the distance,
  flanking and adjacency the scene shows, and say what cover walls give. Client setting, on by default.
- **NPC qualities.** An NPC's qualities are listed on its sheet with what each does, and apply to its statistics and
  skill checks where they are plain numbers.

## Code style and checks

```bash
npm run format        # Prettier over every .mjs and .css file
npm run lint          # ESLint, then stylelint over styles/ (npm run lint:css)
npm run strings       # collect the loc`…` text in the source into lang/en.json
npm run check:schemas # validate the data models with a local Foundry installation's field classes
```

## Translating

User-visible text written in JavaScript uses a template tag, with the English left in place:

```js
import { loc } from "../i18n.mjs";
ui.notifications.warn(loc`${actor.name}: not enough action dice remain.`);
```

The pattern (`{0}: not enough action dice remain.`) is the entry in `lang/text-template.json` under
`SPYCRAFT.Text`; a translation may move the numbered values. English needs no entry, because the text is already in
the source, so that file is not loaded by any client and is left out of releases. After adding or changing text, run
`npm run strings`; a test fails if the generated files are out of date. Templates use
`{{localize "SPYCRAFT.Template.…"}}`. A new language is `lang/en.json` merged with `lang/text-template.json`,
translated and listed in `system.json`. Text that Foundry localises by itself and that is fixed in `init`, such as a
setting's name, hint and choices, uses `locKey` instead of `loc`; those few entries are kept in `lang/en.json`. Feats are recognised by a stored rule name, so a feat item may be renamed or translated.
Use `loc` inside functions. Text built while a module loads is fixed before the language is known; in a table,
write a getter instead (`get label() { return loc`Handgun`; }`). Display names held in the rules data (skills,
named checks, feat trees) are translated when the language loads, by `module/i18n-data.mjs`.

CI runs `lint`, `format:check`, the build, `npm test`, `npm run test:packs` and `npm run bundle`, and a second job
runs the Playwright layout tests (`npm run test:layout`). `npm run check:schemas` needs a local Foundry installation and
is not run in CI; it exits with an error when Foundry is not found, so a skipped check cannot pass for a clean one.

[docs/architecture.md](docs/architecture.md) maps the layers and lists the places to touch when adding an ability. [docs/backlog.md](docs/backlog.md) is the one list of work still to do.

A release ships the JavaScript as one file: `npm run bundle` (esbuild, not minified, with a source map) writes
`dist/spycraft2.mjs`, and the release workflow puts it at the manifest's entry path in place of `module/`. Development
and the tests load the modules directly, so nothing needs building to work on the system.

## NPC creation

The **Core NPC Templates** compendium supplies 20 nameless starting actors: guards, police, soldiers, criminals, agents and civilian specialists. Import a copy and customize it for the campaign. Equipment is included and profiles follow the active mission’s Threat Level.

NPC actors now offer opt-in graded creation, source-backed core tables, equipment allowances, quality cost controls, Tier resolution and an XP breakdown. Existing NPC stat blocks keep manual mode. See [NPC creation and implementation boundaries](docs/npc-creation.md).

## Game Control tools

The GC Console (the first sidebar tab, marked with a spy icon) covers the mission record and XP, GC action dice, dramatic scenes, fluid initiative, standard NPC Damage saves, disposition, Dramatic Conflicts, campaign qualities and the security, hazard and possession tables. See [Game Control tools](docs/gc-tools.md) for what each does and what remains manual.

## Character sheet views

Agent sheets open in **Play** with saves, Defense, Initiative, weapon attacks and
common actions at the top of Main. **Edit character** exposes attribute creation,
skill purchases, class choices, training and other build controls; **Done editing**
returns to Play. This view switch changes no character data. Vitality, wounds,
action dice and biography remain available during play.

Skills supports a name/attribute search and a **Trained skills only** filter.
Build reminders group repeated choices and open the relevant tab in Edit.
The Main tab keeps current condition labels visible while detailed condition
and combat tools are collapsed. Gear shows inventory before wealth and mission
planning; Classes keeps ability use ahead of the collapsed GC tools.

Skill dialogs show circumstances for the selected named check and put general
modifiers under **Advanced options**. Changing the check disables inputs specific
to the previous check so they cannot accidentally apply to the next roll. Required
gear controls stay visible for checks with a Gear tag. The roll button names the
selected check or taking-10/20 method; existing validation still applies.

Main groups combat tools into attacks/reactions, earned stances and attack styles,
defense/damage, recorded outcomes, conditions/recovery and GC review. Unowned
feat declarations are omitted; existing saved styles retain their controls so
they can be reviewed. Recorded outcomes and GC recovery tools remain available.
Open tool groups are remembered while the sheet stays open. Saves and Initiative
use the whole stat card as a roll button; weapon attacks have a primary button.

In Edit, Main starts with attribute creation rather than combat tools. The setup
guide highlights the earliest outstanding rules reminder and groups the remaining
reminders by tab. **Continue setup** opens the relevant tab or choice browser,
selects the reminder's skill level where applicable, and focuses the matching
build controls. The checklist reports outstanding reminders, not a completion
percentage; character-building warnings remain separate.

Weapons on Gear use individual cards: attack and damage controls come first,
followed by firing mode, error/threat and range. **Equipment & ammunition** holds
ammunition planning and equip/remove controls. Printed stockpile sizes are labelled
separately from ammunition remaining. Armor, gear and vehicles retain tables with
clear action labels, empty-state guidance and contained scrolling at narrow widths.

Roll and character dialogs use the dossier palette, readable inputs and
a confirmation footer outside the scrolling options. Unrelated Foundry dialogs
keep their normal appearance. Toolbars include visible action labels, and compact
icon controls have contextual names and tooltips.

Level-zero agents open in Edit with one next setup action above the full checklist.
The GC console has a local tool search. Vehicle sheets group condition, surroundings,
crew, fuel and reference fields into searchable sections; local search and disclosure
choices survive sheet updates. Searches preserve form values and clear with Escape.
Frequent sheet toolbar icons and origin edit/change/remove actions have 44px targets.
Supported roll cards show pending, confirmed, closed and damage-application states
above the dice, with instructions tied to the recorded outcome and viewer permissions.
The “Automatic vs table / GC steps” disclosures on Play, GC and vehicle tools, roll
dialogs and supported chat cards explain which calculations and updates the system
performs and which declarations, rulings and handoffs still need people. Unlabelled
form fields receive accessible names, including row/column context in tables. Skill
rolls and weapon reload actions have specific names. Keyboard focus is visible on
fields and disclosure controls; chat actions expose busy/error feedback and recover
focus to an updated result after replacement without taking focus from an open dialog.

### Sample scenes

The system includes a **Sample Scenes** compendium with Warehouse Breach, Night Infiltration and Embassy Reception. Import any of them into your world for backgrounds with walls, doors and lighting already configured. Add your own actors and tokens. See [scene notes](assets/scenes/README.md) for setup details and art provenance.

New empty worlds receive these three scenes automatically on the first GM launch. Setup runs once, so deleted samples stay deleted. Existing worlds are left as they are; import samples from the compendium when wanted. Interrupted setup resumes on the next GM launch.

### Starter Actors

On the first GM launch after installation or upgrade, the system copies one sample mastermind, three henchmen, eight minion profiles and all 16 sample PCs into the Actors tab. The folders are **Masterminds**, **Henchmen**, **Minions** and **Sample PCs**. The Scout's animal partner is included and linked to its PC. The former Sample Level-1 Agents world folder is renamed to Sample PCs.

Recognizable sample PCs already imported into the world are reused. Setup resumes after an interruption without making duplicate copies, and later launches preserve your edits, moves and deletions. The **Sample Villains & Minions** and **Sample Level-1 Agents** compendiums remain available for additional imports. See [the starter cast](docs/sample-cast.md).
