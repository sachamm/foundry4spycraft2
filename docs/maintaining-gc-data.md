# Maintaining the GC and NPC data

For whoever edits the system, not for the GC at the table. The GC-facing pages are [gc-tools.md](gc-tools.md) and
[npc-creation.md](npc-creation.md). Page numbers are printed page numbers of the rulebook.

## GC tables, conflicts and campaign qualities

`src/data/gc-core.json`, `gc-tables.json`, `conflicts.json` and `campaign-qualities.json` are the editable sources; `npm run build` generates `module/rules/gc-tables.mjs` and the roll-table pack. Names and numbers are as printed; descriptive text is original summary. Rules live in `module/rules/gc/` and are covered by `tools/test-gc-rules.mjs`; the Foundry-facing layer in `module/apps/gc/` is exercised through stubs in `tools/test-gc-apps.mjs`. Neither replaces a live Foundry playtest.

## NPC tables

`src/data/npcs.json` is the editable source. `npm run build` generates `module/rules/npc-tables.mjs`, which is included in release archives alongside the existing generated tables. `module/rules/npcs.mjs` contains the pure calculator.

The tables were transcribed from the user-supplied `Spycraft_2.0_AI_Rules.md` and compared cell-for-cell with the local Hyperlinked and Second Printing rulebook PDFs. All 1,600 table cells match both PDFs. References use printed page numbers.

## NPC builder verification

Verification includes numeric comparison against both supplied PDFs, pure calculator tests, mocked sheet/model persistence tests and an isolated browser render of the actual Handlebars partial. A live Foundry world playtest is still needed; an isolated browser render does not exercise Foundry's complete document/form lifecycle.

## Template feats

The builder checks the prerequisite feat graph and chosen Basic Skill feats, independently of the list order. It waives numeric requirements under the NPC rules (p.447), checks the purchase limit, and rejects duplicate or unknown selections. Embedded items retain their catalog source IDs and their original prerequisite records; the NPC validation does not rewrite the PC feat catalog.

## Template Common Items

The curated Common Items list for templates is `src/data/npc-common-items.json`.

## Template ammunition

The template builder requires compatible ordinary ammunition and a valid supplied code, and rejects unpriced conversions.

## Threat Level packages

New data is compiled from `src/data/npc-packages.json` through the same builders as fixed templates into `module/data/npc-packages.json`; run `npm run build` after editing it. The file is bundled with the system and loaded when opening the package dialog. Item replacement, the graded profile, the generated equipment/feat biography section and the package receipt are submitted in one Foundry v14 document update.

## Template artwork

Portraits are stored under `assets/npcs/portraits/` and tokens under `assets/npcs/tokens/`; the token PNGs preserve transparency outside the circular border. The actor image and prototype-token texture are separate source fields in `src/data/npc-templates.json`. Generation prompts and provenance are recorded in `assets/npcs/generation-prompts.json`.
