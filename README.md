# Spycraft 2.0 for Foundry VTT

An unofficial game system for [Foundry Virtual Tabletop](https://foundryvtt.com) implementing the core rules and character options of the Spycraft 2.0 RPG.

- **System ID:** `spycraft2`
- **Foundry compatibility:** v14 (minimum 14, verified on 14.370)

## Development setup

Foundry loads systems from `{userData}/Data/systems/<id>`. Run this from the repository root to symlink this checkout there so edits show up after a reload:

```bash
# macOS (default user data path)
ln -s "$PWD" \
  "$HOME/Library/Application Support/FoundryVTT/Data/systems/spycraft2"
```

Then create a world using the **Spycraft 2.0** system.

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
  armor affecting Defense, Reflex and Speed; mission gear picks by category.
- **Final totals** — vitality, wounds, stress/subdual thresholds, knowledge/request/gear checks, action dice, carrying capacity.

Build problems are shown as warnings. Executable workflows also reject invalid actions, unavailable gear and insufficient resources. The [RAW review and residual implementation ledger](docs/raw-character-review.md) distinguish verified mechanics from remaining manual rules. Personal gear classification, field acquisition, measured attacks and class resource controls are documented there; catalog presence alone does not establish complete automation.

Classes also provides ordinary GC action-die awards and once-per-mission XP settlement using the user-selected p.440 formula. Gear records Armor Use armor and reviewed higher-Caliber mission picks; Caliber V upgrades remain separate. Soldier 14 can declare One in a Million before an eligible roll. See the ledger for each workflow’s limits.

Implemented resource controls coordinate multiple Foundry clients. Classes provides GC recovery controls for interrupted actions; check the recorded result and current resources before retrying an interrupted transaction. Complete character exports omit temporary transaction bookkeeping.

## Chat search

The Chat Messages sidebar has a text search and Character / Roll type filters. Filters combine and search the full readable history, including older messages that are not currently rendered. Text search ignores case and accents and matches every entered word. Results show newest first; use **Open message** to view the original card, **Show more matches** for additional results, or **Clear** (Escape in a filter) to return to ordinary chat. Private messages and hidden roll results remain subject to Foundry's visibility rules. Older untyped rolls are classified from their displayed labels where possible.

## Layout

| Path | Purpose |
| --- | --- |
| `system.json` | Manifest |
| `spycraft2.mjs` | Entry point / init hooks |
| `module/config.mjs` | `CONFIG.SPYCRAFT` constants |
| `module/data/` | Actor & Item TypeDataModels |
| `module/documents/` | Actor & Item document classes |
| `module/sheets/` | ApplicationV2 sheets |
| `templates/` | Handlebars templates |
| `lang/` | Localization |
| `module/rules/` | Rules engine (`engine.mjs`), prerequisite checks, formula evaluator, generated tables |
| `module/rolls/` | Roll pipeline contributors: reservations, validators, named checks and chat buttons (registry in `module/rules/roll-pipeline.mjs`) |
| `module/apps/` | Compendium browser |
| `src/data/` | Rules data (source of truth; edit directly) |
| `tools/` | Pack build and engine test scripts |
| `packs/` | Compendium packs (generated by `npm run build`) |

## Credits

Thanks to Erik Dewey, whose *Spycraft 2.0 Character Builder* inspired this system and who authored the ruleset that
was initially imported into it.

## Legal

Spycraft is a trademark of Crafty Games. This project is unofficial and not affiliated with or endorsed by Crafty Games.

The Spycraft 2.0 rulebook is copyrighted and is not open content. This repository must not contain its text: data files hold names, numbers and table values as bare labels, and every description is an original summary. You need the rulebook to play. Contributors, see [AGENTS.md](AGENTS.md).

## Installing in Foundry

In Foundry's **Install System** dialog, paste this manifest URL:

```
https://github.com/sachamm/foundry4spycraft2/releases/latest/download/system.json
```

## Releasing

1. Bump `version` in `system.json` and add a `CHANGELOG.md` entry.
2. Commit and push, then publish a GitHub release tagged `v<version>` (e.g. `v0.1.0`).
3. The **Release** workflow attaches `system.json` and `spycraft2.zip` to the release.

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

Every roll made through the Actor's `rollCheck` (skill, Knowledge, attack, damage, save and ability rolls) passes through one
registry, `module/rules/roll-pipeline.mjs`. A rule joins it by
registering a contributor from `module/rolls/` instead of being edited into the Actor document. A contributor may:
offer named skill checks, hold a reservation while the roll is made, validate before and after the dice, add a labelled
modifier, add fields to the posted check, and add buttons under it. The existing validators, reservations, named-check
additions and two of the chat buttons run this way; dialog content and most modifier arithmetic are still inside
`rollSkill`, `rollAttack` and `weaponAttack`. `game.spycraft2.rollPipeline` exposes the registry to macros and modules.

## NPC creation

NPC actors now offer opt-in graded creation, source-backed core tables, equipment allowances, quality cost controls, Tier resolution and an XP breakdown. Existing NPC stat blocks keep manual mode. See [NPC creation and implementation boundaries](docs/npc-creation.md).

## Game Control tools

The GC Console (button in the Actors sidebar) covers the mission record and XP, GC action dice, dramatic scenes, fluid initiative, standard NPC Damage saves, disposition, Dramatic Conflicts, campaign qualities and the security, hazard and possession tables. See [Game Control tools](docs/gc-tools.md) for what each does and what remains manual.

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

Spycraft roll and character dialogs use the dossier palette, readable inputs and
a confirmation footer outside the scrolling options. Unrelated Foundry dialogs
keep their normal appearance. Toolbars include visible action labels, and compact
icon controls have contextual names and tooltips.
