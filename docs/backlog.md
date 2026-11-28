# Backlog

One list of everything still to do. It was consolidated on 2026-11-24 from every review and to-do note that existed
then, and it replaces the audit tables that used to be section 10 of the [UI style guide](ui-style-guide.md) and the
old `docs/remaining-work.md`. Add new work here; delete a row when it lands.

## How to read it

- **Priority.** P0: the system gives a wrong result, loses data or pays twice. P1: major friction or a misleading
  screen in a common action. P2: polish, consistency and hygiene.
- **Effort.** S: hours. M: a day or two. L: several days, or it touches stored data.
- **Evidence.** `live`: seen in a running Foundry 14.370 world on 2026-11-24. `code`: read from the code, not seen
  running. `earlier`: from an earlier review and re-checked against the code on 2026-11-24. Anything marked
  *GC to confirm* is a rules question that needs the book; page numbers are printed pages.
- **Sources.** The ids point at the report that has the detail, the steps and the file names:

| Prefix | Report |
| --- | --- |
| `DES-`, `NGC-`, `XGC-`, `UX-` | GC-side live council, 2026-11-24: designer, novice GC, expert GC, UI/UX expert |
| `CX-D`, `CX-N`, `CX-E`, `CX-U` | Parallel ChatGPT Codex council, 2026-11-24 (rendered from the layout harness and read from code; no Foundry server) |
| `CM-`, `CC-`, `CU-` | Second GC-side code council, 2026-11-24: mission and NPCs, combat, console and undo |
| `CX2-D`, `CX2-N`, `CX2-E`, `CX2-U` | Second ChatGPT Codex council, 2026-11-24 (same method as the first) |
| `NG2-`, `XG2-`, `DS2-`, `UX2-` | Second GC-side live council, 2026-11-25, on test build 0.8.0.3: novice GC, expert GC, designer, UI/UX expert |
| `LR-` | Live review, 2026-11-22, row number in its summary |
| `SGI-` | The five inputs to the style guide, 2026-11-23 (`expert-gc`, `novice-gc`, `novice-player`, `rules-expert`, `seasoned-player`) |
| `JS-`, `HBS-`, `CSS-`, `WEB-`, `R-`, `J`, `H`, `C`, `W` + number | Code council, 2026-11-23 (the single letters are findings carried from the first code council) |
| `SG-` | A row of the style guide's former section 10 audit, with its old id (`SG-G2` was `G2`) |
| `RW-` | The old `remaining-work.md` (now [archive/build-notes-2026-11.md](archive/build-notes-2026-11.md)), by line |

The reports are kept outside the repository, in the project's `reviews/` folder (`council-ui-2026-11-27/`, `council-gc-2026-11-24/`, `council-gc-2026-11-24b/`,
`live-2026-11-22/`, `styleguide-2026-11-23/`, `council-2026-11-23/`, `council-2026-11/`).

## Suggested order

1. **P0 table**, top to bottom: what is left there gives a GC a wrong result or loses work.
2. **Finish the console turn**: combat setup and end inside the console (B-023), fluid initiative (B-025), half
   actions (B-026).
3. **Console safety and stability**: what is left of B-035 to B-037, chiefly undo for a GC boost (B-037).
4. **Dialogs** (B-040 to B-046): sizing, the focus ring and keeping values after a refusal.
5. The rest of P1 by area, then P2 when a surface is touched anyway.

## P0: wrong results, lost data, double payment

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

## P1: running the game

### Combat from the console

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### Console structure and stability

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### Safety: confirm, undo, feedback

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### Dialogs opened from the console

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### Mission and campaign

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### NPCs

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### Chat cards the GC works

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

### Accessibility and input

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

## P1: player side, carried from earlier reviews

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |

## P2: polish

### GC surfaces

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-120 | Console: icons on buttons follow no rule; vague or mismatched labels. (Its type sizes now come from the three text tokens, and the search field takes the system's input style.) | DES-11, DES-13 | S |
| B-121 | Mission facts were measured stacking as full-width tiles (564px). `.gc-facts` is an auto-fill grid now; confirm in a live console and find what overrides it if they still stack. | DES-06 | S |
| B-122 | Raw `COMBAT.RollAll` / `COMBAT.RollNPC` tooltips on the tracker: probably Foundry core with a missing translation; confirm in a live world before working around it. | LR-30 | S |
| B-124 | `game.spycraft2.gc` functions open dialogs and take no arguments; GC tools cannot be dropped on the hotbar; the token HUD and token right-click add nothing. | XGC-36, XGC-37, XGC-38 | M |
| B-129 | Settings: related combat and approval choices sit among long hints; link a short policy summary from campaign setup. | CX-D18, CX-E17 | S |
| B-130 | Reduced motion and theme: measured oddities whose source was not found. | UX-36 | S |

### Agent sheet, builder and browser

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-139 | Browser rows about 61px; preview empty until a pick; the browser stays open after adding (except talents and specialties); a row click redraws list and preview; prerequisites recomputed on every draw. | SG-I6, LR-24b, LR-24f, HBS-04 | M |
| B-140 | Stepper and sheet tabs are two navigations; steps may open browsers inconsistently (live check). | LR-21e, LR-21f | M |
| B-255 | **Breakdown tooltips, the rest.** Roll buttons and roll cards now list the parts of their bonus. Still without one: the NPC graded tiles (Initiative, attack base, saves, Damage save), skill error range, the vehicle sheet's figures, and initiative cards (Foundry posts those without the system's check record). A damage card lists its flat bonus but not where each extra die came from. Action dice added after the roll show as "16 → 25" on the card, not as tooltip rows. | PR for bonus tooltips, 2026-11-25 | S |
| B-142 | Wounds help does not name the bands; thresholds on the Play reference grid are unexplained; no line saying what two half actions buy. | LR-23b, SGI-rules-expert D3, SGI-novice-player D10 | S |
| B-143 | Sheets cover the map: the agent sheet opens 860 wide; no compact Play width; tablet width untested. | LR-15a, SGI-seasoned-player D24 | M |
| B-144 | Prone sits four actions deep; the Play tab's button count needs a recount. | LR-38d, SGI-seasoned-player D10, LR-38c | S |
| B-146 | One format for limited uses everywhere: combat groups, the round counter and the Feats tab still write their own sentences (eight abilities are hand-written). | SGI-seasoned-player D5, HBS-06, H8 | M |
| B-149 | All compendium tiles share one banner. | LR-18c | S |

### Strings

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-161 | The formula hint under Bonuses shows to every owner (not found in the current templates; recheck live). (The VP, WP, DR, Qty and Codename labels and the class browser's "VP · SP" are now words.) | SGI-novice-gc D17, LR-40b, LR-39b | S |
| B-162 | English literals in context builders; hard-coded English in attributes; raw schema keys as labels; text localised at load time stays English (migration labels, the console tab tooltip). | HBS-11, H6, WEB-09 | S |
| B-254 | Words a new GC cannot place ("Caliber", "faced", "standing", "usage period" and others listed in the report), tooltips that repeat their label, and the status strip's wording. | NG2-20, NG2-26, NG2-27, NG2-30 | S |

### Visual system

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-165 | Section heading styled four times; tabs styled twice; agent name rules disagree; three design passes stacked (25 repeated selectors). | SG-S1, SG-S2, SG-S9, C6, CSS-11 | M |
| B-166 | Literal colours and stale fallbacks outside tokens; two token vocabularies (`--sc2-bad`, `--sc2-teal`, `--sc2-paper-*`, `--sc2-border`); about 20 font sizes in three units. | SG-S6, C11, CSS-12, LR-38b | S |
| B-167 | Agent breakpoints measure the window, not the pane; nested scroll areas in dialogs. | CSS-07, C9, C7 | S |

### Docs

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

## Rules gaps and steps still left to the GC

These rows distinguish completed rules paths from remaining GC decisions or future assistance. Consult the cited
page before changing an adjudication, and show each rules change clearly on its card.

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-180 | Campaign qualities still need remaining disposition paths, ranged-quality details, reserve/NPC gear Caliber and action-die effects (pp.406–408). PC checks now apply a confirmed, readable NPC target's actual disposition result/ranges, ordinary priority timing and Diplomatic. Named NPC checks now apply disposition result/ranges and Diplomatic, preserving priority in their record. Combat persuasion binds its captured grade for PC/NPC actors, including unlinked targets and settlement evidence. Ordinary PC checks now combine taking, Cross-Check, Faceless and disposition timing additively under the user ruling, selecting one reduction and retaining fixed-duration bases. PC/villain scene effects now have GC source recording, per-character degrees, cancellation, fixed earlier expiry or explicit early end, scene expiry, Undo, actual skill modifiers/timing and posting guards. Underlying source success remains GC-adjudicated; whole-task timing scope remains open. Omni-Competent now lifts PC/NPC result caps and makes named PC/Knowledge checks active, with saved policy, posting guards and uncapped sheet figures; its per-penalty reduction now applies the confirmed magnitude rounding independently across named PC, Knowledge, NPC and plan-contributor modifiers, including readable source notes, current sheet totals and saved posting policy. Jack-of-All-Trades now captures purchase-time class costs per new PC level, supports GC review/Undo for unknown history, preserves recorded ranks across later seasons and leaves point budgets unchanged. Paranoid now changes PC/NPC surprise, disposition and persuasion checks with role scope, named morale stacking, saved evidence and posting guards. Routine holds active Crossroads attempts, requires relevant legacy classification and retains completed stories/titles. Crossroads entry, GC title awards and deferred benefits execute. Mellow/Tense stress executes for PC/NPC damage, combines factors with Firefighter Training and saved Wire Fu landings, preserves final-damage entry/history, and Tense blocks skill taking10. Subtle changes actual PC/NPC attacks and sheet figures; Violent widens actual attack threats, including shared unarmed/final attacks. These rolls save campaign policy; changes during RNG require review, and completed results retain it. Cakewalk Intel selections reduce actual error ranges and taking-10 time for the recorded mission, with historical Intelligence allowance and GC corrections. Creation cadences, Growth XP and between-mission level limits with captured/reviewed history, alternate feat choices, Feat Purchase XP/entitlements, Small Screen budget/starting-cap review, recorded creation-only policy, Modular feat/attribute trades, PC Fragile vitality, Big Budget Wealth, Wealth/mission gear allowances and funded overflow picks, Soap Subplots, affiliation/standing, range/CQB/blast, Bottomless Clip, Blockbuster hazard/recorded-save protection, injury thresholds/costs, campaign fixed-DC resolution, Medicine errors and Comedy timing/error/payment limits now execute. User ruling: Fragile retains grade-built NPC Health-table vitality, with GC review notices for class-die exceptions. | R-01, rules-completeness-99 | M |
| B-183 | Recorded Acrobatics/Falling checks and actual no-check landings now settle capped impact dice, source reductions, successful-check reductions, dives, solid/fluid damage, actual-height AP, lethal-only stress and Sprawled, with durable results and applicable cards. Wire Fu saves its player/special-character damage modifier with the landing; user ruling halves both impact and stress, rounded down. Native damage, Undo, NPC scope and replay pass. Tracked physical falls now retain round/Count or game-time starts, enforce descent duration before damage, bind one landing identity across retries and support GC clock/catch review. Wire Fu routes support aerial/vertical movement and offer the fall tracker after confirmed unstable endings. Token movement/action expenditure remain table actions; review additional interrupted and historical fall cases (pp.106–107,336,408). | R-04, rules-completeness-99 | M |
| B-186 | Advanced Grapple map assistance remains: mixed-Size crowds, actual positions, joining actions and forced movement require explicit GC review. Core opening/ongoing checks, proficiency timing/errors, cooperative tally, ordered benefits, assisted recipients, original damage/recovery, ammunition and Undo have native proof. Animal equipment and second-opponent exceptions now refuse before dice or condition changes; legal unarmed benefits remain available. Review broader animal action permissions with the GC (p.445); automatic menu filtering outside Grapple is future assistance. See review Passes 91–97 (pp.347,357–358). | R-07, RW-210, RW-346 | M |
| B-187 | Audit remaining once-per-trigger workflows and partial Undo failures. Final attacks and shared-feat grants now retain actor-level claims after deleted cards or lost responses, with GC recovery. NPC Defense and declared DC delivery preserve actual dice/payment; legacy GC refunds require session review with atomic receipts. Shared-feat Undo retains the session choice. Attack damage now retains numbered hit claims and actual rolls beyond deleted cards; target-held application receipts prevent replay, preserve partial Undo evidence and support GC recovery. Count modifiers now retain combat/round/trigger identity across replacements, queue under the shared end-of-round cap, reconcile positive delivery, preserve consumption after withdrawal and support journaled GC corrections. Hazard saves now reserve actor-held resolution records before effects or secondary dice, reject concurrent replay, repair completed card markers, preserve receipts through generic Undo and require GC keep/release review after interruptions. Release requires both no-effects and no-dice confirmations; native reload and actual GC review retain existing NPC stress/Damage-save results without new dice. Pending hazards and hit applications block overlapping resolution. Owning GCs now review interrupted hazards from PC/NPC sheets even after source deletion, using saved evidence and recording missing-source status; native reload and actual reachable review retain existing dice/track without recreating the card. Remaining action timing, other event-specific paths and malformed legacy histories still need review. All automatic Request paths now reserve the original source, use and acquisition before delivery RNG. Native reload, actual lost-result GC review and repeated settlement preserve one actual delivery and one payment; immediate benefits roll no dice. | R-08, JS-08 | M |
| B-188 | Implement GC corrections and legacy feat-history review for finalized NPC Defense decisions. Legal failed-attack rerolls now retain the original target, Defense and cumulative paid dice, including later reaction dice. Normal Defense and dramatic post-hit Defense execute actual paid dice with recovery and guarded Undo. DC boosts now declare one character/check before RNG, spend actual d12s within the 1/3-die limit, freeze campaign DC changes, retain durable one-use claims and resolve the actual check. Private declarations require GC rolls and preserve visibility; interrupted dice and uncertain check claims have GC recovery. | RW (gc-tools) | M |
| B-189 | Audit remaining NPC feats and class abilities beyond shared numeric/runtime support. Special NPC weapon damage now routes all supported special types through stored hazards. Cold/heat/electrical use shared running subdual totals and executable Fortitude reports; lethal hazards generate stress totals and Will reports. Native four-type delivery and duplicate target receipts pass. Character cold/heat AP(all), electrical AP(original damage) and typed weapon AP handoff now execute. Standard-NPC bang/flash now use actual Fortitude saves, and standard-NPC hazard stress rolls its actual Damage save with campaign factors once. Damage profiles now recognize all supported types and explicit stress; cold/heat/electrical use subdual and automatic type AP, and acid/laser conversion is refused before mutation. Standard NPC collision/electrical/laser now add secondary stress after actual DR/AP, with no additional roll after elimination. Native controlled DR 8 cases and target-held RNG reservations pass. All supported weapon types now route through shared hazards for both NPC health models, including actual standard-NPC acid/explosive/vacuum/fire saves. Original critical size, blast and DR scope survive delayed saves; special wounds and standard automatic failures execute, with no new critical on ongoing ticks. Net subdual drives exposure/Count consequences; fractional inputs are refused and zero vacuum impact creates no replacement damage dice. Native actual save chains and delayed two-die criticals pass. Acid/explosive damage now uses the original recorded Evasion policy, including companion Evasion I, flat-footed restrictions and failed-save Evasion II. Earlier acid and separate explosive stress/stun remain; versioned hazard receipts seal the policy. Acid weapon delivery now rolls actual body-armor coverage, preserves non-armor protection on clothing hits/removal, and applies original AP to the remaining components; standalone unknown DR requires declaration before RNG. Acid profiles and the final controller now enforce AP 1 as the minimum, including old or manually lowered AP 0 inputs; native corrected DR, actual Reflex and vitality pass. Acid now retains independent attacks, captured AP/contact layer, declared actual armor-save outcomes, current post-AP protection, durable round intent, phase guards, actual injury totals after washing, original injury dice and GC review of legacy merged history. Native separate totals, Undo, washed injury, GC correction, reload and actual passing/failing equipped-armor saves pass. Item corrosion and washing remain separate GC actions. Prepared NPC quality/feat resistances now reach typed lethal and sensory damage, with original resistance captured for pending acid/explosive/vacuum saves, DR-before-resistance ordering, no unnecessary saves for complete protection, and suppression of accompanying effects. Native fourteen-case standard/special coverage passes. Ongoing acid/fire count actual resisted damage and can end when resistance prevents it. Ordinary NPC stress/subdual resistance now reaches standard Damage saves and special running totals after campaign adjustment/DR, with zero-RNG full protection, actual net exposure and pre-roll input checks. Eight native standard/special full/partial cases pass. Type-specific cold/heat/electrical resistance now combines with subdual resistance after AP/DR for agents and both NPC health models. Agent events retain type/source evidence and guard changed defenses; Not the Face passes prepared-DR validation. Twelve native legal NPC quality builds and a complete Test Subject Scientist pass. Standard ordinary DR-stopped injuries now produce one subdual bruising point before resistance, with two native cases; critical bruising still requires GC adjudication when it penetrates. Shared-roll flash/bang now delivers both actual full-DC saves, with independent resistances and component-level delivery evidence. Native agent/standard/special cases pass; interrupted second saves block replacement dice and retain GC review. Owned NPC armor now prepares shared slots, training, DR, resistances, primary save bonuses and Defense/Reflex/Speed penalties across manual and graded profiles. Quality DR and worn armor take their maximum; native standard/special incoming hits, six actual protection saves and unequipping pass. Initial typed lethal DR-stopped hits now produce one subdual bruise across all health models, after subdual resistance. Acid/fire secondary protection, explosive exceptions, original pending bruise-resistance proof and critical GC guards execute; eleven native cases pass. Named fire sources now retain initial and later actual damage, survive successful catch-fire saves/extinguishing/reload, and supply source-bound scarring claims plus GC history correction. Lost responses and concurrent/duplicate clicks cannot replace dice; unknown legacy starting damage requires GC review. Native initial-25 and cumulative-36 cases and actual sheet/GC controls pass. Per-source acid protection and Drained now retain original sources, losses and recovery evidence. NPC named checks now preserve categories, enforce shared condition/tag restrictions and sensory penalties/caps, and retain original escape/movement sources. Continue other compound damage recipes, remaining recovery timing and broader ability coverage. Failed stress saves now apply Shaken I–IV through the audited condition workflow, once per saved event, with Construct immunity and legacy-card support. | RW-223, RW-344, RW-345, RW-411 | M |
| B-190 | Future cover-value and skill-distance map assistance. Blast geometry, numeric cover and contained-blast increments remain explicit GC decisions. Direct interception has native zero/nonzero penetration, pre-damage cover-scoped criticals, paid NPC reactions, original per-shot dice, save/remaining-damage review, duplicate prevention and reload proof. Interrupted or combined contacts retain explicit GC review. See review Passes 86–96. | RW-203, RW-204, RW-346, RW-410 | M |
| B-191 | Not modelled: team and directed checks; Joint Action's shared Count; Terminal Situations beyond the GC die spend; fire or gas spreading across squares; contagious diseases passing between characters; weapons as gadget housings; Table 5.6 Size modifiers to armor-piercing; conveyance bull-rush reading vehicle actors; unarmed Trip, Feint and grapple variants. Favored Gear now settles actual mission-Caliber session dice, scoped skill boosts and threats, discards, mission-long access loss, durable retries and GC actual-history review. Not the Face's Charisma damage resistance applies in the attribute ledger and hazard workflow. | RW-82, RW-215, RW-219, RW-287, code comments, rules-completeness-99 | L |
| B-193 | Complete the source-to-data audit of class/origin/feat mechanics and weapon/armor values; utility gear and vehicles have cross-checks. Native Soldier 1 and Brainy/Researcher Scientist 1 now reach Play with no setup tasks and persist edits. Native Soldier 4/Brawler 1 now reaches Play without setup tasks, exercises prerequisite loss/restoration and GC original-entry corrections, and preserves starting attributes before advancement. All 30 class progression tables (420 rows, 6,300 numeric fields) match the source. Visual second-printing inspection corrected the Chief's Special to Caliber I on p.256/Table 4.40 and removed ammunition-caliber text from 39 rifle damage fields; rebuilt native compendium classification and actual damage dice pass. All 455 main-table weapon records now have 4,095 independent comparisons of nine stored combat/Caliber fields, with reference fingerprints and visual checks for ambiguous cells. Corrected both Daewoo shotgun feed alternatives and made eight raw charges explicitly explosive; actual drum selection/forty-shot calculation and a native 3d12 charge with explosive saves pass. The three shield/arrow records outside those tables retain older reference coverage. All 44 armor profiles now have 572 independent source comparisons, including seven missing protective-gear records and 29 corrected availability dates. Native PC equipment and actual NBC/radiation Primary Phase bonuses pass; secondary saves and unavailable gear exclude them. Review remaining exceptional footnotes/behavior and separate included gas-mask/air-supply management. Expert abilities now suspend when requirements fail while owned progression, purchased skills and acquired feats remain. Privileged and Rescuer now execute their once-per-mission free Caliber II Resources without Reserve allocation/pick costs or Request RNG, using the confirmed any-mission ruling and journaled delivery. Both actual forms, delivery controls and claims have native coverage. A complete native Soldier 1/Advocate 2 now spends all three skill budgets, reaches Play without setup tasks and exercises Behind the Scenes through reservation, reload, delivery, claim and GC interrupted-result review. Political Request feats now bind their named option and Resource Power Rating 6; only Clout waives the base action-die cost. Automated rules and layouts pass. Saved native form results and the completed typed invitation claim prove the Clout waiver, immediate availability and single mission use/pick. Its earlier stall was an unanswered specifications dialog, not a Freelance setup defect; that clone is not counted as another complete PC build. Animal Partner now creates a valid animal baseline (INT 2, no ordinary equipment picks), requires review of uncomputed XP, and uses special health, spend classification and Wire Fu scope through its real owner link, including manual profiles. A complete native Soldier/Advocate owner with legal Survival 4 and Animal Partner spends 32/32 skill points; the actual creator and two chosen trained qualities produce verified XP 5/cap 40, and incoming damage takes vitality. Size-dependent Wolfpack Mastery/Evasion delivery now derives from the built animal without extra purchases; native actual Reflex settlement preserves captured Evasion through later Size changes. Unreadable owner links retain saved Threat Level and special health with GC review. Broader companion abilities/owner funding remain. A complete Brainy/Test Subject Scientist variant now spends 36/36 attributes and 52/52 skills, adjusts the reduced contact allowance legally, persists Play and applies both selected origin resistances through the real ledger. A complete native Gifted/Student Snoop 4 / Field Analyst 1 now spends 36/36 attribute points, all 96 career skill points and five Training points through actual advancement and feat creation; the actual Play control and reload retain its valid expert-entry history, named mastery grant, Gifted class skill/cap and threat adjustments. Missing Examiner and an old I Can Swim balance refuse real advancement without changing the career. Creation review now scores 9.9/10 for assisted core play. Continue exceptional origin/feat/equipment footnotes and imported histories as maintenance; later feat-use automation remains a combat concern. Crossroads typed entry, GC completion/title awards, next-session starting dice and mission XP now execute, using captured/reviewed history and user-confirmed upward XP rounding; standard Subplot XP remains part of ordinary mission settlement. Favored/Signature/Trademark choices, item availability, session and new-level histories have native coverage. | RW (audit-2026-11), rules-completeness-99 | L |

| B-194 | Companion restrictions, acquisition cadence, loss/replacement recovery and sparse Undo have native coverage, including failures and persistence. Explicit Origin-only Career Level 0 creation now supports a complete Researcher with a chosen Training feat and a complete Playboy owner/lieutenant pair. Known zero-level feat history survives first-class advancement and reload; legacy numeric zero remains unknown without the explicit record. Training retains its five points until ranks become available instead of exceeding the level-0 cap. Review further imported classless histories and conditional Origin choices as part of B-193; do not infer a past level-0 game from the ordinary unknown-level value. | Rules pp.27,201,204; rules-completeness-99 | M |

| B-195 | Drained PCs preserve original careers and feats beneath a GC-reviewed temporary build. New mission-end recovery checks are Active under the table ruling; original attempts retain their recorded category. Standard NPCs now lose a selected quality/feat and stat/named-skill grades through a saved temporary profile; special NPCs lose actor-specific effective levels without changing mission Threat Level. Recovery restores the latest loss, keeps original dice, requires review of manual statistics/exceptions and supports sparse Undo/reload. Failed special-NPC fifth-tier stress saves now enter that actual review, validate the original source and cannot replay a loss. Continue contagion handoffs, advancement while Drained, and existing item/timed-benefit review. Do not delete original career history or NPC grades to simulate forfeiture. | Rules pp.340–341,441,452; rules-completeness-99 | M |

## Code health (code council, 2026-11-23)

Do these when touching the area. The council's conditions still apply: equality tests first, one family per PR.

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-200 | No code throws `Refusal` (0 against about 2,459 plain throws), so every plain `Error` is still treated as a refusal and catch blocks cannot tell a refusal from a bug. | JS-03, JS-06, WEB-14 | M |
| B-201 | `resolveSkillCheck` takes about 150 options in 1,121 lines. Split by family. | JS-02 | L |
| B-202 | About 196 dialogs are still single-line HTML strings (`combat-stance.mjs:30` is one 5,306-character line that prints all 19 stances); about 70 direct `DialogV2` calls bypass the themed wrappers. | WEB-01, CSS-13, UX-05 (code council), HBS-05 | L |
| B-203 | Final-attack workflow: 9 abilities not yet on `limitedFinalAttack`; damage reservation still exists in more than one form. | JS-13, WEB-02, WEB-03 | M |
| B-204 | Action-die spend still makes about 10 round trips; nothing was measured. | JS-04 | M |
| B-205 | About 22 chat-log scans remain with no maintained index. | JS-08, WEB-07 | M |
| B-206 | Helper copies: 95 `esc` aliases, 16 `whole`, 8 `say`, 6 `post`; about 284 `JSON.stringify` equality uses; no lint for `innerHTML`. | JS-05, JS-07, J13, W7 | M |
| B-207 | Actor mixins mix persistence, rollback and dialog HTML. | JS-12 | L |
| B-208 | Derived data: mission and campaign changes reset every actor; `prepareDerivedData` scans combats and actors repeatedly; engine hot path re-sorts bonuses on every add. | JS-14, JS-15, W4 | M |
| B-209 | Layering: documents and rolls import from apps (62 and 60 edges); two services import `dialog-theme`; the sheet has 105 imports and no per-feature manifest. | WEB-06, WEB-04, W9, JS-11 | L |
| B-211 | Settings registered in 19 files with no key list; rule code still keyed on display names in places; test-only rule exports are unmarked. | WEB-10, JS-09, JS-16 | S |
| B-212 | Templates: play mode renders all edit markup and hides it; acquisition block copied into three item templates; review notices duplicated; disclosure memory and search implemented three times; selectors passed through the translation tag; 43 hand-written `<option selected>`; `signed` helper unprefixed; `enrichHTML` options differ; decoration pass walks the whole app. | HBS-03, HBS-08, HBS-09, HBS-10, HBS-12, HBS-14, HBS-15, H3, H7, H9, H13 | M each |
| B-213 | Templates are unformatted and outside the formatter (439 lines over 200 characters). Do last, one file per PR. | HBS-13 | M |
| B-214 | Tests and tooling: 164 test files build their own Foundry stub; no automated test inside Foundry; five layout specs not on `systemCss()`; no `checkJs`; 28 unused-variable warnings capped, not cleared; chat cards skinned only when flagged (111 `ChatMessage.create` calls, no helper); sheet submit guard checks flat keys only. | WEB-08, CSS-05, W13, C4, J5 | M |

## Live checks owed

Short passes in a running world. Delete a line when it has been seen working, or move it up if it fails.

- Bonus breakdown tooltips in a running world: hover an attribute, a save, a skill and a weapon's Attack button on
  an agent and an NPC, then the result on an attack, skill, save and damage card; check the lines add up to the
  figure shown, that the tooltip does not cover the button being pressed, and that a player sees no parts on an
  NPC's card. (B-255)
- The console keeps its scroll position across a redraw when it is docked in a live sidebar. (B-030)
- Dialogs after the 2026-11-28 pass: Cancel on the attack and apply-damage dialogs, focus back on the opener after
  closing, the main button's name, and the Spend dice cost line. (B-248, B-042)
- Undo of a GC boost on an NPC's card, the GC ruling from a card's right-click menu, and Show the card on an Undo
  note. (B-037, B-246)
- The five from the old to-do file: the clock hidden when "Show the clock to players" is off; First Aid on another
  player's agent from the medic's own client; the save dialog from the player's button; a blast across a wall and its
  outline; a player without "Query users" getting a clear message. (RW-404 to RW-408)
- Never seen in Foundry: the combat sweep's new sheet links and dialogs, a hazard save card's "Apply this save's
  result" for each kind, the Anticipate box, the ready-made critical effects, each new chat button of the main-loop
  work, the reload line on agent and NPC sheets, the shot fields on the weapon sheet, the grapple benefit dialog, the
  stress and subdual fields on a special NPC's sheet. (RW-290, RW-349)
- The last localisation pass with a runtime translation. (RW-173)
- From the 2026-11-22 live review, not decidable from code: critical retry until damage is applied (13d); "Confirm
  result" after a confirmed result (13e); feat source default in the browser (24c); the minimised NPC title (39c);
  a wall-blocked drag showing a valid ruler (41); the page error when the GM saves a colour scheme.
- From the code council: UX-02, UX-03, J8, header buttons (CSS-01).
- From this council: a real player client for request approval; GC threat activation; Threat Level packages; agent XP
  settlement after a mission; canvas drag and the token HUD; light theme (the test world forces dark); Begin session,
  Next scene and End mission in a one-GC world, since four GCs shared this one.
- Still untested live in any review: vehicles, chases with vehicles, social and intrusion subsystems, more than one GC
  by design, touch devices, a screen reader, Foundry's mobile layout.

## Closed on 2026-11-28, with notes

Every row that left the tables above in the 2026-11-28 pass, and why. "Done" rows landed in code; "Dropped" rows
were judged not worth doing, with the reason.

| ID | Was | Outcome | Notes |
| --- | --- | --- | --- |
| B-222 | Undo and old cards | Done | Undo of damage applied from a card made before marks were keyed now takes that target's newest record off the card's old array (through the GC for a player), so the card can be applied again. |
| B-237 | Next scene has no way back | Done | Next scene leaves an Undo note. It returns the scene period to the scene before, which brings back that scene's uses, dramatic state and standard NPCs' damage, and takes the scene off the mission's count. It refuses once a later scene has begun. |
| B-025 | Fluid initiative | Done | The event dialog shows a line saying whether the chosen event moves the Count now or at the round's end, each combatant's pending sum with what the ±10 limit leaves of it, and a Corrections entry that takes back a recorded event (with Undo). Events were already grouped, fields shown per event, Press cleared when paid, and the tool offered only in a started fight. Also restored: Counts given up to Delay use up the same ±10 limit (p.324), which the 2026-11-27 merge had dropped from the end-of-round pass. |
| B-026 | Half actions | Done | Each spent pip now says on hover what marked it (Attack, Reload, Total Defense, Disarm, the GC Console, Mob attack, or a click). A sheet action taken with too little of the turn left warns before it opens, not after. The strip's hint already lists which actions are counted, and a click on the last spent pip takes a mark back, which serves as the undo; skill checks and movement stay uncounted on purpose, since their cost varies by check. |
| B-028 | The Gear tab's second attack button | Done | A ranged weapon's ordinary attack dialog now has a folded "Light, fog, mounts and bracing" section holding every field the older ranged dialog had and the attack dialog lacked, read by the same rules. The Gear tab's Measured attack button is gone; `rollRangedAttack` stays for macros. Also fixed in the old dialog: a rule's piece could land inside the ambient light list. Not seen live. |
| B-029 | Dramatic scene | Done | One button, "Make this scene dramatic…", opens a dialog that offers the scripted (free) and paid (4 GC dice) ways together, lists each opponent whose Count will double with its before and after, lets the GC untick any, doubles on OK and whispers what began to the GC. The status strip already shows the dramatic state. This follows the suggested answer to the open question on automating dramatic initiative. |
| B-241 | Mob attack posts one card per member | Dropped | One card for a whole mob's attacks would take Resolve, damage and Undo away from the single attacks, which each need their own card. The group already asks once, attacks in one pass and posts one summary of who attacked whom (same reasoning as B-270, closed in PR 90). |
| B-242 | Tracker and turn details | Done | While a combatant holds a readied action, the console shows "Readied action triggered: (name)" under the order, on anyone's turn, with the trigger in its tooltip and an Undo note. The tracker's right-click menu now uses the console's names for spending and giving back actions. |
| B-034 | Tooltips | Done | Each console button has a written one-line tip on what it changes; a generated tooltip that repeats or abbreviates a button's visible words is no longer added (sheet-wide); tooltips close on press and on console redraw. |
| B-031 | Prep, Play and Wrap-up views exist; finish the tidy-up inside them | Done | Already on main: each section has one primary button, the session block moves below Combat during a fight, and the explainer paragraph is gone. Checked 2026-11-28. |
| B-030 | The console redraws whole on every action | Dropped | Scroll, focus, search text and open lists already survive a redraw, so a partial redraw would buy nothing a GC can see for a large rewrite. The live scroll check moved to Live checks owed. |
| B-035 | The console and the chat log share one sidebar slot | Done | Already on main: the console opens in its own window by default, beside the chat log, with a labelled button in the sidebar copy and a remembered place. This pass: the window opens 480 wide, not 720, since its single column used the extra width for nothing. A two-column layout was dropped: the sticky turn bar and the long sections do not split cleanly. |
| B-244 | First-session list, live pass | Done | A view choice made outside a fight now belongs to its mission, so it no longer comes back in the next mission's planning or wrap-up. A search that finds nothing on the current view names the view that holds the tool. Seeing both in a live console stays under Live checks owed. |
| B-245 | Pickers, the rest | Done | A sidebar actor is no longer listed beside its own unlinked token copies in the target lists (Apply damage, Resolve attack); the rest of the row was already on main. |
| B-037 | Undo for a GC boost on a card, and an outcome override | Done | A GC boost on an NPC's card now leaves an Undo note: while the roll is unsettled and not boosted again, Undo returns the die to the pool and the card to its earlier total. The GC can also record a ruling on any roll card from its right-click menu in the chat log (counts as a success or a failure, with a reason); it is shown on the card and is a record only, so settled damage is corrected by hand. |
| B-246 | Undo notes, live pass | Done | An Undo note for a step that changed a card has a Show the card button that scrolls to it and outlines it; once undone, the note's own line is struck through; the quiet button's outline takes the action colour (was 1.48:1). The save card a damage step caused was already closed on undo. Left as is: the note's wording of raw damage and of a since-renamed actor. |
| B-236 | Undo still lives on its own whispered note instead of on the card that | Dropped | Moving Undo onto the card that made the change would mean every card searching the chat log for its notes. The note now links to its card instead (see B-246). |
| B-040 | Dialog sizing and focus ring | Done | Dialog text boxes and lists take the 36px control height; a main button still carrying the stock Confirm now takes its dialog's title, in every system dialog. Already on main: kit dialogs are 560px wide and the system's own focus ring applies in dialogs. |
| B-043 | Pickers list the whole world, not the scene | Done | Already on main (see B-245): target and spend pickers start on the fight in view, skip other scenes' fights, number shared names and, from this pass, leave out a sidebar actor whose token copies are listed. |
| B-042 | Spend dice does not state the cost before Confirm | Done | The Spend dice dialog opens with one line on what the GC's dice are for and shows, before the button is pressed, the cost, the pool before and after, the die rolled and what the rules attach to the spend; the line follows every change to the entry. Splitting the list into daily and rare uses was dropped: one list with page numbers is quicker to scan than two. |
| B-045 | Disposition | Done | Already on main: each target shows its current grade, fields appear only for the chosen action, refusals show inside the dialog and Set a grade is the GC's override. This pass: the dialog opens on Shift by grades, so its default action changes something. |
| B-046 | Dramatic Conflicts | Parked | Each step's dialog is already titled with the conflict, the side and the step; this pass names each step's main button (Lock in this Strategy, Compare the results, Apply these Advantages). The larger redesign (Back, per-side field groups, private Strategy choice on a player's client, the other Advantage effects, chained pairs and crashes) is a feature of its own: it needs a design Sacha agrees to and a live chase to test against. |
| B-215 | The CI lints of style guide 11.2 (banned terms, glued numbers, fragmen | Done | Written as tools/test-style-lints.mjs and run by npm test. Hard rules (count nought): banned terms, glued numbers, hyphen ranges, developer words, template anchors, authored title attributes, name branches, text under 13px. Ratchets that may fall but not rise: fragment keys, receipt, actual, recorded, first person, strings over 160 and over 300 characters, literal colours. Fixing the hits found 17 glued numbers, 3 uses of a banned term, 2 of RAW and 5 authored titles. |
| B-155 | About 156 strings start or end with a separator or bracket (fragment k | Parked | 159 fragment strings remain. The count is now a ratchet in tools/test-style-lints.mjs, so it cannot grow; reword them when their surface is touched and lower the cap. |
| B-156 | Internal vocabulary: "actual" (487), "recorded" (335), "receipt" (111) | Parked | The internal words are now ratchets in tools/test-style-lints.mjs (actual 742, recorded 454, receipt 132) and RAW is banned outright. Rewording 1,300 strings blind would change wording the rule tests depend on; do it surface by surface. |
| B-157 | First person in labels: 71 strings start "I ", 27 contain "I am" | Parked | 90 first-person strings remain, most of them player declarations the guide allows. The count is a ratchet in tools/test-style-lints.mjs. |
| B-158 | 46 strings over 300 characters, 335 over 160 | Parked | 410 strings over 160 characters and 51 over 300 remain; both counts are ratchets in tools/test-style-lints.mjs. Shorten them when their dialog is next reworked (see B-202). |
| B-044 | Select options are sentences in narrow selects; dialog titles follow four patterns; int… | Parked | The checks that can be automated are now lints (B-215): banned terms and developer words fail the build, and long strings cannot grow in number. Shortening the existing select options and settling one title pattern is a wording pass over about 30 GC dialogs that should be read on screen; do it with B-248's live pass. |
| B-248 | Dialogs, live pass | Done | Every system option dialog now has a Cancel button that answers like closing it; a stock Confirm takes the dialog's title; closing a dialog hands the keyboard back to the control that opened it and takes down any tooltip left up; inputs are 36px and kit dialogs 560px wide. Wording of titles and options is parked with B-044. A look at these in a live world is under Live checks owed. |
| B-054 | One wrap-up view | Done | Already on main: a Wrap-up view with the end steps in order, each beside its current figure (XP earned, infractions, standing paid). This pass adds the count of objectives still open, said first. Left as is: an infraction and a complication take effect when recorded, which matches how they are awarded at the table, and both can be undone. |
| B-050 | One mission record per world, with no drafts or archive | Parked | Named drafts, duplicate and import are a feature of their own (a mission library), not a fix: the world holds one mission and files each ended one as a journal entry. Reopen if Sacha wants to prepare several missions ahead. |
| B-249 | Start again and the GC's dice, live check | Done | The rule is in code and tested (the GC's dice come with each session; Start mission and Start again leave the pool alone). Seeing it in a live world moved to Live checks owed. |
| B-056 | Season campaign qualities, the rest | Done | The Campaign qualities section now lists the season's qualities and this mission's separately, tags each mission quality as scripted or bought in play, and has a Table settings button that opens the system's settings. |
| B-061 | Add NPC to scene: finish the picker | Done | The picker now shows each world NPC's XP reward beside its kind (a compendium entry has none until imported; the Threat Level is the mission's and is the same for all). Token bars came with B-062. |
| B-062 | NPC prototype tokens get no defaults | Done | An NPC made by hand gets a hostile token whose name the GC sees on hover; a special NPC's token is also linked and shows vitality and wounds bars to the GC. A standard NPC stays unlinked and has no bar: its damage is a count of failed saves, not a pool, so there is nothing a bar could track. Imports and companions keep their own token settings. Whether a default token shows on a pale map is under Live checks owed. |
| B-064 | Importing a template, live check | Done | The import path is in code and tested; confirming that the header Import button goes through it moved to Live checks owed. |
| B-231 | Unlinked NPC tokens and their pools, live check | Done | In code and tested; the check on an old unlinked NPC promoted to special moved to Live checks owed. |
| B-230 | Add NPC to scene on a hex grid | Done | Copies are moved onto the hexes as they are laid out, so two never share a hex and a squad comes out at full size. A look on a hex scene is under Live checks owed. |
| B-251 | Add NPC to scene, the rest: an unlinked token's rename shows two names | Done | An unlinked copy's own actor now carries the token's name from the moment it is placed, and takes a new name when its token is renamed on the map, so the tracker, the sheet and the chat cards agree. |
| B-068 | Standard NPC damage | Done | The Damage save dialog opens with the damage empty, shows the DC the new injury will be rolled against with its sum, and says that it expects damage after Damage Reduction while Apply damage on a card subtracts it itself. The sheet and console now call the old figure the DC before a new hit. The track and the roll button already sit together under the weapons. |
| B-065 | NPC builder: finish the first-run path | Done | Each statistic in the builder now shows what its chosen grade is worth at the NPC's Threat Level (for example +6, or 45 vitality, 19 wounds). Already on main: the builder comes first in Edit under a pinned strip of results, and its switch says what it does. Dropped: a template-or-scratch first step, since Add NPC to scene and the compendium Import already are the template path. |
| B-076 | Check Defense opens a 27-field expert dialog | Done | The Check Defense dialog now opens on one line giving the character's Defense as the sheet stands, with a named main button; the cover block is folded away unless the map already measured cover. The remaining tick boxes stay visible because each one changes the number. |
| B-077 | Card header never says "who → whom" | Done | An attack card's first line now names its target once one is declared or the attack is settled. Damage cards already show the arithmetic (damage less damage reduction, and what is left); naming each source of the reduction on the card was left out, since the target's sheet lists them. |
| B-078 | Finished cards keep live buttons | Done | Already on main: a resolved card shows no outcome buttons, Finish is a quiet button placed after the main one, Roll damage goes once every hit has its damage card, and a GC boost rewrites the card's total and marks together. Collapsing a finished card to one line was dropped: the card is the record the table scrolls back to. Confirm result after a confirmed result stays under Live checks owed. |
| B-080 | Critical activation, the rest | Done | Choosing who pays for an error now ticks the opponent and line-of-sight boxes, which can be unticked; they also start ticked whenever the card holds only an error. A button for players on an NPC's error card was left out: the GC activates it from the card and picks the paying agent, which keeps the spend in one place. |
| B-252 | Chat cards, live pass: the Damage save card has no success or failure  | Done | An attack card's line now says Hit or Missed, as its stamp does. Already on main: Roll damage goes once damage is rolled, Finish is placed after the main button, and no card says listed below any more. Not changed: a standard NPC's Damage save is a plain roll message with its result in words; chat notifications over the map are Foundry's own and stop when the chat tab is in view or the console is in its window (the default). The remaining look-and-feel points are under Live checks owed. |
| B-085 | Scroll containers clip the focus ring | Done | Roll-option dialogs, the scrolling box most dialogs use, now keep 6px of padding on every side, so the focus ring (3px wide, 3px out) is no longer cut off at the edges. The console body already had the room. |
| B-086 | Keyboard order on the NPC sheet | Done | Checked: the NPC sheet and builder stylesheets use no order, no reversed direction and no explicit grid placement beyond one full-width row, so the keyboard follows the markup as the screen does. |
| B-253 | Card buttons' accessible names do not contain their visible labels; se | Done | A card button's accessible name now always contains the words on its face, and a button with no fuller wording gets neither a second name nor a tooltip repeating it; section headings no longer get a generated description; the view switcher has a hover state, an underline on the chosen view and the 36px control height; the console's controls take the system's offset focus ring. Focus after Undo and after closing a dialog is under Live checks owed. |
| B-089 | Click targets | Parked | Section bars, row icons, pips and the clock badge meet their sizes; what is left is rows that mix 36px and 44px buttons. Evening those out changes the height of every sheet row, so it wants a look at the sheets in Foundry, with B-143's compact Play width. |
| B-092 | At 200% zoom the console works but a sheet buries it | Parked | At 200% zoom Foundry lays its own windows over the sidebar; a sheet covering the console is Foundry's window stacking, and the console now opens as a movable window by default. Nothing to change in the system without a live look at what a GC at 200% needs. |
| B-101 | Feat activations are keyed by item name in templates and appear only o | Done | Already on main: feat buttons are declared in data (module/sheets/feat-actions.mjs) and no template branches on an item's name, which is now a lint. This pass also shows those buttons on the Play tab under Abilities in play, each with its feat's name as the tooltip. |
| B-102 | Attribute checks never open a dialog; saves open one only for Reflex o | Done | A click on an attribute check or a save now opens a small dialog with the modifier the GC set (it joins the total and the card's breakdown); Shift-click rolls at once, as for skills and attacks. Saves rolled for the player by a hazard or a damage event still ask only when the save has a choice. Not added: a visibility choice, since Foundry's own roll-mode selector above the chat box already sets it, and an Initiative dialog, since Initiative is rolled from the tracker or the console for the whole fight. |
| B-104 | Attestation-length checkbox labels (159 `…Confirmed` names in 74 files | Parked | The honour-system boxes are softened, not removed: Trust the table ticks every one for the players, and they open ticked for the GC. Turning 159 attestations in 74 rule modules into defaults changes what each roll records, and each needs its rule reread; do it family by family with B-201. |
| B-110 | `?` explanations for game terms on the console and NPC sheet, from one | Done | A shared list of game terms (module/apps/glossary.mjs), each explained in one line in the system's own words: opened from Game terms in the console's Reference section, and shown as the tooltip on Threat Level, Caliber and Standing in the mission facts. Sheets can read a term from the same list. A ? in each header linking to the docs was dropped: the docs live on GitHub, not in the world. |
| B-111 | Level-up as one guided path: after the vitality die, chain skill point | Done | Adding a level in a class the agent already has now turns the sheet to Edit with the To do list open, which lists what the level leaves to choose (skill points, a feat, class choices), each a button that goes to its step. Choosing feats inline on the row instead of from the browser was left out: the browser is where prerequisites are checked and explained. |

## Parked, with the reason

| Item | Sources | Why |
| --- | --- | --- |
| One `_prepareContext` per sheet part; Play tab as several parts | WEB-05, H2 | The gain does not follow, since a document update renders every part. Reopen with a measurement on a level-10 agent. |
| GC-arbitrated lock as the default | JS-04 part 3, W1 | The arbitrated table lives in one client. Reason kept in the build notes. |
| Token roots with `light-dark()`; `@layer` | C5, C7 | Invisible to users and fragile in mixed-theme setups. |
| GM relay trusting a client-supplied user id | W2 | Nothing more can be done until core passes the sender to the query handler. |
| Strict data-model schemas | W10 | A stricter schema can invalidate actors on load. Reopen with `migrateData`, one record at a time, on a copy of a live world. |
| Removing the re-render after a usage-period reset | W16 | That render is what refreshes the counters. |
| Roll dialogs as `.hbs` templates | HBS-05 part 3 | Rule modules assemble those dialogs field by field. |
| Shrinking the agent tabs | CSS-14 (half) | Declined; only the too-small targets are in B-089. |

## Decisions the reviewers left open

These need Sacha's call before the matching work starts.

| Question | Positions | Suggested |
| --- | --- | --- |
| Prep and Play as views of one console, or separate windows | Designer, novice and UX want visible Prepare, Play and Wrap-up; the expert wants one stable console with fast access to everything | One console with a view switch and action-level search; expert shortcuts untouched |
| Group initiative | One prominent control, or both modes side by side | Both while NPCs still need a roll, with counts; collapse to a status line after |
| Fast attacks against confirmation | Novice wants review before damage; expert wants Shift-click kept | Keep the fast path for one stable target and show what it assumed; review for target changes, batches and corrections |
| Placing an NPC and recording it for XP | One step, or two | Two decisions; offer "Record for XP" right after placing |
| Automating dramatic-scene initiative | Finish it on activation, or leave it to the GC | Preview who will be doubled; the GC corrects the list |
| Mission history | Several stored missions, or export and import of one | Stored drafts and completed snapshots (B-050); it changes stored data, so plan a migration |
