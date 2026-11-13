# NPC creation

Open an NPC actor and choose **Use graded NPC creation**. Existing NPCs remain in manual mode until explicitly enabled; their stored manual statistics are not migrated or deleted. Turning graded mode off restores those source statistics. Legacy `villain` selections resolve as special NPCs; Minion, Henchman and Mastermind are qualities in new profiles.

## Rules data

`src/data/npcs.json` is the editable source. `npm run build` generates `module/rules/npc-tables.mjs`, which is included in release archives alongside the existing generated tables. `module/rules/npcs.mjs` contains the pure calculator.

The tables were transcribed from the user-supplied `Spycraft_2.0_AI_Rules.md` and compared cell-for-cell with the local Hyperlinked and Second Printing rulebook PDFs. All 1,600 table cells match both PDFs. References use printed page numbers.

- Table 7.11 (pp.444–445): independent Initiative, Attack, Defense, Resilience, Damage Save, vitality/wounds and Competence lookups for grades I–X and TL 1–20.
- Table 7.13 (p.450) and p.452: use the higher of Competence and the individually purchased Skilled bonus. That bonus is the effective skill rank for result caps (existing Table 2.4). Listed skills cost their grade in XP, limited to three for standard NPCs and five for special NPCs. Animals have no Competence and use their restricted skills.
- Equipment (pp.443–445): standard/special NPCs start with one Caliber I weapon and gear pick; a standard group shares one Caliber I vehicle, while a special NPC has its own. Extra picks cost +1 XP each, Caliber upgrades +1 per step, and removal of a starting pick −2. Equipment does not scale with TL; Wealth does not grant picks. Standard/special weapons start with one/three ammunition stockpiles respectively; each additional pair costs +1 XP.
- Qualities (pp.446–451): 71 cost records with type/group restrictions, costs per unit, and parameter controls for class level, Caliber, Foil, limited movement and Removable Quality. Skilled and superior/inferior attributes use dedicated controls to avoid charging twice. Feat and Class Ability acquisition limits are validated; the GC checks their eligibility and target choices.
- Tiers (p.452): I/II/III/IV/V shift effective TL by −4/−2/0/+2/+4, bounded to 1–20. Tier III is the default; other Tiers are for specific rules, not ordinary mission difficulty adjustment. No independent Tier XP surcharge is invented.
- XP (pp.446,452): add numerical statistic grades, including Wealth (None = 0). Apply Skilled, attribute and other quality costs; negative quality adjustments cannot lower this statistic base below half, rounded up. Apply equipment adjustments and clamp the reward to at least zero. Special NPCs contribute four times the displayed NPC reward to the mission; standard NPCs and animals contribute once. Each antagonist type is counted once, not once per individual or appearance. Mission-wide XP scaling remains outside this actor calculator.

The quality floor is applied to the statistic base before equipment adjustment, so removing baseline equipment can still reduce a small NPC reward to zero. The UI shows each component and the floor adjustment. Published worked examples on p.452 (37 XP, and 41 XP after an extra Caliber II weapon plus Minion) are regression tests. Invalid inputs retain their selections but suppress final XP until corrected.

## Printed anomalies

Both supplied PDFs and the markdown show `26/14` at vitality/wounds grade I, TL12, and `45/10` at grade V, TL9. These values are preserved exactly and the affected builds display a GC source note. They have not been silently changed to inferred values.

## Implementation boundaries

The builder resolves the creation tables, base statistics and cost accounting. Attribute modifiers are applied once by the NPC model. It does not execute the other play effects of every quality, selected feat, specialty, talent or class ability. The sheet lists those effects by reference for GC adjudication. Actual equipment documents are managed in the existing item lists; allowances describe authorized picks and do not automatically create, remove or police those documents.

Animal command/action restrictions, complex movement modes, Removable Quality linkage, and feat/class eligibility require GC review. Full special NPCs built with PC rules and their 300-XP-per-scene rule are outside the graded builder. Combat automation, NPC critical activation rules, mission encounter accounting and automatic rest/healing are separate work.

Verification includes numeric comparison against both supplied PDFs, pure calculator tests, mocked sheet/model persistence tests and an isolated browser render of the actual Handlebars partial. A live Foundry world playtest is still needed; an isolated browser render does not exercise Foundry's complete document/form lifecycle.
