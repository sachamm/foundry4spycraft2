# GC roll tables and world setup

The installable system includes a 36-table **GC Tables** compendium. At world startup, the elected active GM imports missing tables into a **GC Tables** folder in the Rollable Tables tab. This also upgrades established worlds; it does not depend on an empty world. Players receive no default ownership of the imported tables.

Each source has a stable identity and a separate delivery receipt. Existing copies imported through Foundry are recognized by compendium provenance. Their names, results, formulas and folders are preserved. Setup can resume after an interrupted import without duplicating completed tables. A table deleted after successful delivery stays deleted; future releases can still deliver new tables. A missing or incomplete pack leaves setup retryable on the next GM launch.

## Rulebook coverage

Reviewed the second-printing rulebook's numbered table index across all seven chapters: 1.1–1.36, 2.1–2.49, 3.1–3.2, 4.1–4.81, 5.1–5.15, 6.1–6.22 and 7.1–7.16. This distinguishes random-result charts from deterministic reference tables. Source text and page renders are not distributed.

| Source (printed page) | Included tables | Count |
| --- | --- | ---: |
| Character description, p.60 | Standard and broad random age | 2 |
| Table 1.18, p.61 | Male and female height with correlated weight calculation | 2 |
| Table 4.67, p.281 | Bag Full of Guns at Calibers I–V | 5 |
| Table 4.72, p.290 | Vehicle damage for each of the twelve vehicle categories | 12 |
| Table 5.1, p.323 | Four outdoor encounter-distance groups | 4 |
| Table 5.5, p.332 | The Table of Ouch | 1 |
| Table 5.11 and Deviation Diagram, p.346 | Five distance dice and one relative direction chart | 6 |
| Table 7.16, pp.460–461 | Civilian, minion, henchman and mastermind possessions | 4 |
| **Total** | | **36** |

Age and direction are explicit random procedures in the surrounding text rather than additional numbered charts. Indoors, encounter distance is line of sight and does not require a die. Lookup charts for DCs, grades, prices, purchased events, action-die costs and progression are not assigned invented random probabilities. Skill timing and damage dice within those reference charts remain part of their existing rules workflows.

## Rolling details

Use the native table Roll button. Printed dice formulas determine probabilities; do not normalize these tables to a uniform distribution. All allow replacement. The original minion-possession overlap at 20 remains intact and returns both matching results.

Height uses 2d12. Its selected row includes an inline weight calculation using that same height increase and a separate 2d4 multiplier. Encounter distances retain their feet multipliers and require the visibility/hearing limit to be applied. Deviation directions rotate with the attack: 1 points past the target, 5 points back toward the attacker. Vehicle damage requires a re-roll when the selected component cannot apply.

The Table of Ouch asks for actual damage suffered and offers the normal d20 or the Guts d10. Totals above 70 remain unlisted and require GC adjudication. The table posts a reference result; it does not spend action dice, grant gear or alter actor health, injuries or vehicle damage. Use the existing actor injury workflow for tracked effects.

## Build and install

`src/data/rollable-tables.json` defines the additional charts; the four possession tables remain in `src/data/gc-tables.json`. The builder writes the compendium and `module/data/gc-table-catalog.mjs`, which supplies setup with the exact stable source IDs. Every table uses an existing generated compressed icon.

Run `npm run build` before packaging. Release workflows include `spycraft2.mjs`, `module/`, `packs/` and `assets/`, so both the startup importer and the complete table pack are included in the install archive. World imports happen on the next GM launch after installing that build.
