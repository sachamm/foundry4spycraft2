# PC creation and combat rules review

**Continuing review, 27 November 2026:** PC creation **9.9/10**;
combat play **9.8/10**. Implementation continues toward the requested **9.9/10**
in both areas. Earlier reviews are preserved below; the latest pass follows them.
Current branch: `codex/rules-completeness-99`, based on `475afa5`.

Reviewed 26 November 2026 on `codex/rules-completeness`, starting from `cf911e2`
(v0.8.7). An upstream fetch confirmed that revision was current on `origin/main`.
The integration checkout and other task worktrees were left alone.

## Method and scores

These are code-review judgments about rules completeness for assisted core play,
not percentages of every rulebook option automated. Each area has five dimensions
worth two points each. Credit requires executable behavior or a clear workflow;
catalog text and unused helpers do not establish automation. Manual GC handling,
incomplete edge cases and missing native session evidence reduce the score.

The primary reference was the locally supplied second-printing rulebook, read
outside this worktree. Existing independent reference fixtures and the older
[rules review](archive/raw-character-review.md) helped identify test coverage and
remaining limitations. No rulebook text or extracts were added to Git.

| Review pass | PC creation | Combat play | Finding and action |
| --- | ---: | ---: | --- |
| Initial | 7.6/10 | 7.3/10 | Creation validation gaps; disconnected Foibles defenses; underwater damage remained manual. |
| After creation and Foibles changes | 8.1/10 | 7.7/10 | Creation meets the target. Combat still needs the underwater attack-to-damage handoff. |
| Final, after underwater and bonus-order review | **8.1/10** | **8.0/10** | Both meet the requested threshold. Advanced/manual rules remain explicitly outside complete automation. |

## PC creation

| Dimension | Initial /2 | Final /2 | Evidence and limits |
| --- | ---: | ---: | --- |
| Attributes and health | 1.2 | 1.7 | Point costs, origin adjustments, earned increases, per-level vitality and Constitution. Invalid saved choices now stay visible for correction. |
| Origins and classes | 1.7 | 1.7 | All 68 origins have level sweeps; class progression reference fixtures, expert-entry checks and class-choice workflows exist. Some inherited choices remain partial. |
| Skill purchases | 1.7 | 1.7 | Level-local budgets, historical Intelligence, class/cross-class costs, purchase-time rank limits and acquisition-specific grants are checked. Legacy history can still need review. |
| Feats and training | 1.6 | 1.6 | Acquisition prerequisites, inactive invalid feats, granted feats, proficiencies, focuses, contacts and Interests have build accounting. Some source-specific choices and contact benefits remain manual. |
| Gear and finalization | 1.4 | 1.4 | Wealth, Possessions, mission picks, Caliber, affiliation resources and setup guidance have executable paths. Gear exceptions and older imported data still need GC review. |

### Recommendations implemented

1. **Keep illegal base attributes in the setup checklist.** Previously an invalid
   base score warned but contributed zero point-buy cost without its own setup
   error. It now remains an explicit correction task, including before level 1.
2. **Validate earned attribute selections.** A truthy unrecognized value such as
   `strength` previously counted as an assigned increase without increasing an
   attribute. Only the six actual attribute identifiers satisfy the assignment.
3. **Validate saved vitality gains against the class die.** Negative, fractional,
   nonnumeric and out-of-die gains no longer increase derived vitality. They stay
   in saved data for correction and generate a class setup error. Level 1 still
   uses the maximum die; missing later rolls and valid boundary values retain
   their existing rules. Constitution and per-level minimums remain separate.

Implementation: `module/rules/engine.mjs`.
Regression evidence: `tools/test-creation-integrity.mjs`, together with the
existing Main, build-workflow and vitality tests. The targeted run passed all 42
tests, including the all-origin/all-level sweep.

## Combat play

| Dimension | Initial /2 | Final /2 | Evidence and limits |
| --- | ---: | ---: | --- |
| Initiative, actions and movement | 1.7 | 1.7 | Action budgets, movement legality, Count changes, readiness and turn state have executable rules and regressions. Joint Action and vehicle interactions remain incomplete. |
| Attacks and Defense | 1.4 | 1.7 | Proficiency, range, firing actions, cover, defensive declarations and hit resolution exist. Foibles now reaches incoming previews and attack cards; contextual GC declarations still matter. |
| Damage and recovery | 1.4 | 1.7 | Vitality/wounds, armor piercing, subdual/stress, critical effects, injuries and healing have workflows. Conditional Foibles DR and underwater standard damage now execute. Some special-damage/NPC combinations remain manual. |
| Conditions and resources | 1.6 | 1.6 | Condition penalties, thresholds, action dice, limited uses, saved events and rollback have substantial coverage. Not every once-per-trigger guard survives all chat-history changes. |
| Conditional options and environments | 1.2 | 1.3 | Many stances, tricks and class/feat effects execute; underwater damage now follows the attack and applies the correct bonus order. Several specialist rules still have reminder-only support. |

### Recommendations implemented

1. **Connect Weapon Specialist: Foibles to play (p.49).** The existing helper had
   no callers in incoming Defense or applied damage. Attack-card resolution now
   reads the saved incoming proficiency and applies its dodge bonus. The incoming
   Defense preview can select that proficiency, prefilled from the attack card.
   An explicit GC Defense overrides the automatic value. Vulnerability removes
   the dodge bonus; Foibles does not become an unconditional sheet bonus.
2. **Apply its DR throughout damage handling.** Lethal and subdual paths carry the
   proficiency, including subdual ledger events and duplicate-event checks. AP
   reduces DR before subdual doubling; AP(all) bypasses it. Class DR competes with
   natural quality DR rather than stacking on it (p.446). Cards explain the
   conditional source. Saved attack proficiency remains usable if the weapon
   item has since disappeared.
3. **Finish underwater melee damage (p.349).** The attack's declaration now reaches
   its damage roll. Standard damage from a melee weapon applying Strength is
   halved, rounded up. Unarmed, ranged and Dexterity-substituted finesse formulas
   retain their existing behavior. An explicit damage option can correct the
   inherited declaration. The card explains the reduction.
4. **Preserve damage bonus ordering (p.329).** Flat modifiers stay inside the
   reduction; rolled bonuses such as Killer Instinct and separately added sneak
   attack dice remain outside it. A follow-up regression caught and corrected
   Killer Instinct being halved in the first implementation.

Regression evidence includes `tools/test-foibles-defense.mjs`,
`tools/test-damage-workflow.mjs`, `tools/test-subdual-defense.mjs` and
`tools/test-underwater-damage.mjs`. The Foibles review also covered natural-DR
competition, AP, vulnerability, GC overrides and saved-event behavior.

The final review caught an import-order regression: importing the underwater
attack module from damage calculation registered contributors too early. The
formula helper now lives in the existing pure damage-expression module; the
pipeline-order regression passes without changing the expected order.

## Remaining limits

An 8/10 assessment does not establish complete class/feat automation. The older
option inventory still contains substantial manual and partial coverage. The
existing [backlog](backlog.md) remains the source of future work: B-180 covers
campaign-quality effects; B-182 laser behavior; B-186 grapple details; B-187
durable trigger guards; B-189 special NPC effects; B-190 cover; B-191 broader
unimplemented mechanics; B-193 source-to-data auditing. The Foibles row and the
underwater-halving entry were removed only after their implementations landed.

Creation still needs richer source-specific choice validation, confirmed legacy
acquisition history and manual contact/gear adjudication. Combat still needs GC
input for many situational declarations, exceptional maneuvers and specialist
abilities. Neither a complete source-to-data audit of all descriptive options nor
a multiplayer play session was performed in this task.

## Validation

- Dependency installation used this worktree's lockfile; no credentials or live
  worlds were copied.
- `npm test`: all 3,922 tests pass, including data validation and engine fixtures.
- `npm run build`, `npm run bundle` and `npm run test:packs`: pass; 13 pack tests.
- `npm run lint` and `npm run format:check`: pass. Existing allowed warnings remain
  (28 JavaScript and 29 CSS); no style or formatting sweep was added.
- `npm run check:schemas`: passes with the installed Foundry application path,
  including native schema cleaning and sample actor preparation.
- `npm run test:layout`: 219 browser layout tests pass with the installed Chromium
  path. These are standalone layout fixtures, not a running Foundry world.
- `npm run check:copy -- <local rulebook text>`: passes the 12-word prose threshold.
  Its 17 shorter advisory matches predate these changes.
- A pre-existing Windows path-comparison failure in `tools/test-equal.mjs` was
  corrected using `path.join`; it no longer mistakes the shared helper for a
  duplicate of itself.

Live Foundry client behavior, multiple connected players and real campaign data
remain untested. No release, deployment, merge or push was performed.

## Expanded review: PC creation

Current score: **8.7/10**, up from 8.1. Using the original five dimensions, the
scores are attributes/health 1.9, origins/classes 1.7, skills 1.7, feats/training
1.8 and gear/finalization 1.6, each out of 2. This remains an engineering judgment,
not a measured percentage of all rulebook requirements satisfied.

Implemented and re-reviewed:

- Fast/Slow Attributes, Feats, Proficiencies, Interests and Growth now affect the
  engine, sheet and level-up previews. The world policy provider ignores inactive
  mission qualities and reports conflicting settings. Optional attribute
  milestones survive native Foundry cleaning while preserving existing keys.
- The user confirmed that Interest awards retain the first additional pick at
  level 2; Fast/Slow Interests change only the subsequent spacing.
- Campaign feat alternatives consume existing choices. A residual-capacity
  matching algorithm handles combinations of alternative trees without granting
  extra slots. Its allocations agree with exhaustive legal assignments for
  1,296 small configurations. Class-source uniqueness, acquisition timing,
  prerequisites and Scientist source allowances remain in force. Elite Ops does
  not convert an Advanced Skill choice into Basic Skill; fixed grants are not
  treated as discretionary choices.
- Invalid saved vitality now has a working correction path. RNG refuses an
  impossible value; Review vitality can repair it without healing or rerolling,
  preserving the previous value in review history.
- The user confirmed that Fragile replaces the later-level vitality die, then
  adds Constitution normally. The PC engine and sheet apply that rule, retain
  original saved rolls and suppress unnecessary roll prompts. Big Budget's four
  Wealth and Soap's extra Subplot also affect their budgets.
- Every previously fingerprinted property of every standard sample agent remained
  unchanged. The golden fixture gained only the two new derived properties
  `abilityIncreaseLevels` and `campaignEffects`.

Required remaining recommendations before considering 9.9:

1. Finish campaign creation rules beyond the implemented subset: gear Caliber
   shifts, Feat Purchase's once-per-mission XP transaction, affiliation policy
   constraints and the remaining qualities. Fragile's effect on special NPC
   profiles is still outside this PC implementation (B-180).
2. Complete the source-to-data audit for all class abilities, origin exceptions
   and feat acquisition choices. Existing numerical fixtures do not establish
   complete behavior or correct prose summaries (B-193).
3. Verify legacy acquisition histories, inherited class choices and gear/contact
   exceptions through native creation-to-play workflows. Retaining a GC warning
   does not establish that every mechanical outcome is implemented (B-193 and
   the existing option inventory).

## Expanded review: combat play

Current score: **8.5/10**, up from 8.0. The five dimensions are initiative/actions
1.7, attacks/Defense 1.9, damage/recovery 1.9, conditions/resources 1.6 and
conditional options/environments 1.4, each out of 2.

Implemented and re-reviewed:

- Bulletproof and Gritty now change the injury and massive-damage thresholds used
  by applied damage, reports and pending saves. A pending save retains the policy
  from its original hit. Conflicting injury policies stop lethal application
  before health changes. This implements the injury bands, not every other
  effect of either quality.
- Laser attacks now ignore positive dodge while preserving Dexterity, and their
  critical-hit discount reaches zero cost. The saved attack type participates in
  roll-evidence checks. Incoming Defense previews and attack-card resolution use
  the laser rule; explicit GC Defense overrides remain possible.
- Laser damage removes base dice at measured range-increment boundaries and can
  reach zero. Damage dispatch reuses the original attack's effective increment;
  a direct roll requests missing distance, and cancellation rolls nothing.

Required remaining recommendations before considering 9.9:

1. Implement the remaining campaign effects in their actual workflows: skill DCs,
   action-die modes, range/blast changes and other quality-specific rules. Merely
   carrying metadata such as `criticalInjuryActivationCost` or
   `blastIncrementMultiplier` is not execution (B-180).
2. Complete the mechanically partial combat options. The inventory and current
   code still show missing Mobile Defense Count-for-dodge behavior, Containment
   Supremacy, This… is my Boomstick, Dirty Fighting Supremacy tricks, Vital Points
   stances/tricks and Executioner benefits. Verify the applicable printing where
   the local text lacks a heading; do not invent a rule from a feat name.
3. Finish Grapple size restrictions and benefit damage, falling stress, special
   NPC effects, cover interactions and other listed combat mechanics
   (B-183, B-186, B-189–B-191).
4. Move remaining once-per-trigger authority off deletable chat cards and validate
   replay, reconnect and concurrent-client behavior (B-187). Add native
   multiplayer play-through evidence for the completed paths.

## Expanded validation and commits

- Six focused implementation commits: `2342e17`, `a37c48e`, `d82aa1e`, `9a0e720`,
  `571ad28` and `12d4d33`. The prior branch's seven commits are included unchanged.
- All **3,943** Node regressions pass, including data validation, engine fixtures,
  unchanged standard character fingerprints and the new workflow regressions.
- All 13 rebuilt-pack tests pass. Native Foundry schema checks, sample actor
  preparation, the release bundle, lint and formatting pass. Existing allowed
  warning counts remain 28 JavaScript and 29 CSS.
- The copy check passes its 12-word threshold; the shorter advisory matches remain
  unchanged. Rules data and generated tables were rebuilt together.
- All **219** browser layout tests pass using the standalone harness with an
  installed Chromium path. No live campaign or credentials were copied and no
  multiplayer Foundry session was run.

The known gaps above prevent a defensible 9.9 score. This checkpoint does not
claim completion of the requested higher target.

## Continuing implementation and review

The next review scores PC creation **8.8/10** and combat play **8.9/10**. Creation's
gear/finalization dimension rises to 1.7/2 with enforced campaign affiliation;
the other creation dimensions retain the preceding scores. Combat's conditions/
resources dimension rises to 1.7/2 and conditional options/environments to 1.7/2;
the other combat dimensions retain the preceding scores. These judgments remain
bounded by the source-audit and native-play evidence still missing.

Changes now exercised by regression workflows:

- Bulletproof/Gritty modify actual critical-injury activation costs, including
  custom injuries declared explicitly. Live cost revalidation also works for GC
  payments and zero-cost effects. An additional full-suite failure exposed a GC
  wallet lookup regression; it was corrected and the payment/refund tests pass.
- Gunmen and Gladiators affect range/CQB calculations. Campaign range factors
  combine with feat factors under the normal multiplier rule. Blockbuster uses
  the same tripled blast increment in map previews and damage application.
- Bottomless Clip bypasses spending and firing-action ammunition limits for PCs
  and NPCs, preserving stored counts when the quality ends. Source reinspection
  corrected the eligibility test from loaded capacity to printed stockpile size;
  single-shot weapons with a qualifying stockpile are covered.
- Blockbuster successful hazard saves prevent acid, explosive and first-round
  vacuum damage and secondary effects. The recorded-save tool supports all three
  save types, requires an explicit half-damage source declaration, and retains
  Evasion's independent rules. Pending saves retain their original policy.
- Faction/Freelance/Hybrid validate creation and gear acquisition. Mixed Hybrid
  teams receive each character's standing currency; incompatible affiliations
  and conflicting campaign policies stop payouts before paying anyone.
- The user ruled that Fragile retains grade-built NPC Health-table vitality.
  Special NPC sheets flag class-die exceptions for GC review.
- Campaign Medicine error modifiers execute. Comedy of Errors affects tied
  lowest attributes, take-10 timing and the maximum payment for a skill error,
  including Shaken surcharges. Specific normal-time benefits remain available.
- Campaign skill cards can resolve against a confirmed fixed source DC using
  their recorded policy. The adjusted DC feeds outcome confirmation and class
  automatic-success eligibility; the card records the arithmetic. Opposed checks
  use the separate opposing-result workflow.

All **3,969** Node regressions pass after these changes. The native schema/model
checks, 13 pack checks, bundle, formatting and lint also pass; the allowed warning
counts remain unchanged. The last full layout pass passed all 219 tests. This is
standalone-harness evidence, not a native multiplayer session.

Feat Purchase subsequently gained an actual post-mission transaction: 1,000 XP
per career level, a retained level minimum adjusted for Growth, one purchase per
mission, and permanent additional choices with acquisition sources. Receipts
survive the campaign quality ending. All 20 levels, duplicate/concurrent calls,
rejected updates and committed updates with lost responses have regression
coverage. A native Foundry actor source update also preserves the receipt and
extra choice through schema cleaning. The complete Node run now passes **3,973**
tests; all 219 layout checks pass again. Formatting and lint pass after correcting
one file's formatting; the existing warnings remain unchanged.

Campaign gear now transforms Wealth Possessions and mission allowances, including
vehicles, class limits and Big Budget overflow picks linked to a funded source.
Reserve acquisitions and NPC equipment allowances still need separate review.
Companions no longer receive PC-only cadence or alternate feat-tree benefits, or
count as PCs in mission team payouts.

Small Screen now applies its 32-point PC budget and checks the starting attribute
cap after Origin benefits. Historical starting scores have an explicit GC review;
later increases do not make a legal original score illegal. Both manual and
graded NPCs use that review. New blank agents record their original creation-only
campaign policy. Existing history can be reviewed by the GC, and recorded rules
survive later season changes without changing current attributes or health.
The user confirmed that creation-only rules remain with the character and the
GC reviews unknown history. The full Node run passes **3,994** tests; native schema preparation,
formatting, lint and the copied-text check pass.

Modular now has a guarded creation trade: each additional feat costs two
attribute points, or surrendered first-level choices add two points each.
Both budgets and feat acquisition sources update together; later-level choices
and named granted feats are excluded. Invalid records grant no credit, and
existing over-budget choices remain visible for correction. The saved original
policy preserves trades across seasons; later revisions require GC review.
All **3,999** Node tests, 13 pack checks, native schema preparation, formatting,
lint and copied-text checks pass. The actual trade dialog also passes the
720px layout and keyboard-focus check, following the previous full 220-test run.

Remaining creation work includes the Growth limit on level gains between
missions and the source-data audit. These source-verified gaps keep the
scores below the requested threshold; the scores remain **8.8/10** and **8.9/10**.

The opening Grapple settlement now enforces the Size limit before applying
conditions. Recorded PC or NPC Size takes precedence over a manual difference;
the GC confirms adjacency, and unrecorded Sizes require a valid explicit
difference. Deleted or self targets are rejected. Grapple crowd limits, benefit
damage and penalties remain open. All **4,001** Node tests and **222** browser
layout checks pass; lint and copied-text checks also pass. This closes only the
opening Size path, so the combat score remains **8.9/10** pending broader work.

The shared final-attack posting path now retains actor-level claims for recorded
triggers, including Cleave/Snap Shot, Combat Instincts, miss tricks and Trip.
Deleting a result or resetting a round counter cannot reopen an already claimed
event. Claims reserve before rolling, void an unposted failed attempt, recognize
committed updates with lost responses, and retain consumption after a posted
attack whose final bookkeeping fails. GC review can close an interrupted claim
without changing health or saved round uses, and cannot release an existing
posted result as unused. Copied actors do not inherit another actor's claims.
The full Node suite passes **4,007** tests; lint, formatting, bundle and copied-text
checks pass. The new actual recovery dialog passes the 720px browser check,
following the prior full **222**-test layout run.

This pass raises creation to **8.9/10** for the verified starting-score, original
policy and Modular/gear accounting paths, and combat to **9.0/10** for durable
trigger consumption. The remaining class/origin history and data audit,
between-mission level limits, falling stress, NPC damage and conditions,
Grapple benefits, broader action cooperation and environmental rules still
prevent the requested 9.9 rating. Native multiplayer session evidence remains
outstanding. Work continues through those gaps.

Mission starts now retain each PC's career level alongside the new mission
period. Ordinary advancement checks the source's one-level limit, Fast Growth's
two-level limit, the active-mission restriction and the Growth-adjusted XP
threshold. Excess XP is retained. New characters can still be built before the
first mission; unknown later history and explicit GC starting-level or level
grants have an audited review. Concurrent requests cannot exceed the ceiling,
and resuming a mission does not refresh it. The full suite passes **4,012** Node
tests and **224** browser checks; native schemas, lint, formatting, bundle and
copied-text checks also pass. Scores remain **8.9/10** and **9.0/10** while the
remaining creation data/history and combat gaps are worked through.

Special NPC failed stress saves now apply Shaken I–IV through the existing
condition application journal. New pending saves preserve numeric tiers and an
event reference; repeated settlement and replacement rolls cannot add another
source for that event. Legacy named Shaken outcomes are supported, successful
saves add nothing, and Constructs retain immunity. Drained and hazard-sourced
NPC stress thresholds remain open. All **4,013** Node tests, lint and copied-text
checks pass. This is a narrow part of the remaining NPC damage work; the scores
remain **8.9/10** and **9.0/10**.

Native Foundry **14.370** testing now uses a fresh isolated QA world and separate
GC/player accounts. The GC's real actor creation, Origin import, class-level
addition, Small Screen cap, Modular purchase and original-policy retention after
season changes have run. The rendered sheet correctly keeps unfinished skill,
feat and other creation choices visible; this is not yet a completed-character
or multiplayer combat play-through.

That pass exposed two runtime failures missed by the stand-ins. Pool-max
bookkeeping ran on unsaved previews and detached database reads, producing
invalid lock work and extra test actors; it now writes only the live world actor
or live synthetic token, including a creation hook after insertion. Modular's
stale-dialog comparison included bookkeeping items and current health; it now
rechecks the actual creation allowances, policy, level and mission context.
The native rerun creates exactly one actor and records no transaction warnings
or page errors. All **4,014** Node tests, formatting and lint pass. Further native
multiplayer and combat checks continue before any higher completeness claim.

A second native pass reproduced obsolete nested fields surviving a GC creation
history correction. Revised creation, starting-score, advancement and trigger
records now use exact replacement patches, and their committed-write proofs
compare values independently of native object key order. A shared helper keeps
the existing action-die restoration behavior unchanged. Native tests now pass
removing old creation effects, switching Modular from surrendering to buying,
changing a level grant into historical review, and deliberately losing the
responses after those writes commit. The resulting records remain valid and
contain no obsolete allowances. All **4,018** Node tests, lint, formatting and
bundle checks pass. Full multiplayer and combat play-through work continues.

The first native two-client pass now succeeds. A player uses the real Modular
dialog; both clients receive the same changed budget and the player sees no GC
history controls. In a disposable encounter, the player posts an attack, the GC
resolves it, the player rolls damage from its chat control, and the GC applies
the rolled amount to an unlinked NPC token. The base NPC remains untouched.
Undo restores the token's vitality. A DC 24 NPC stress save fails, applies one
Shaken IV source, and repeated settlement adds no second source; the base NPC
also remains free of that condition. Neither client reports a page error or
resource-transaction warning in these flows. Rendering uses headless software
graphics, so this does not establish interactive performance.

Native evidence raises the continuing scores to **9.0/10** for creation and
**9.1/10** for combat. Remaining recommendations still include source-data and
history coverage, campaign exceptions, falling, NPC typed damage, Grapple
benefits, cooperation and environment rules. Hazard settlement now confirms and
closes its underlying roll before applying effects. Refused closure applies no
effect; interrupted effects can retry against the frozen roll. Six regression
tests cover that ordering, retained adjudication, retries and rejected stale or
foreign results. All **4,024** Node tests pass, as do the bundle and focused lint
checks. The native two-client attack, damage, Undo and NPC Shaken flow passes
again with no page errors or transaction diagnostics. Other hazard kinds and
cross-client effect receipts still require review. Work continues.
Remaining requirements also include Cakewalk Intel selections, other campaign
effects, the specialist combat options listed above, Grapple benefit settlement,
falling stress, special NPC conditions/damage, cover, durable trigger receipts,
source-to-data auditing and native creation/combat play-throughs. The backlog
remains the authoritative list. Work continues; neither score meets 9.9 yet.

The p.452 review connected feat vitality/wound changes to standard NPC and animal
Damage saves in both graded and manual profiles. Derived bonuses disappear when
their source is removed and never accumulate during preparation. A nonzero
legacy manual adjustment remains unchanged pending explicit accounting review;
the sheet shows the calculated contribution and the available modes. Special
NPCs retain their vitality/wound behavior. Tests exercise actual model preparation
and Damage save totals, including source removal and legacy corrections.
All **4,026** Node tests and **224** layout tests pass. Native schemas, lint and
the text-copy check also pass. Non-feat temporary health effects remain in B-185;
the scores remain **9.0/10** and **9.1/10** pending further coverage.

Cakewalk now has a mission-scoped Intel selection on the PC skill sheet. Actual
skill checks apply its error reduction and normal taking-10 time, including when
other campaign timing rules are present. The recorded Intel Intelligence allowance
survives later attribute changes; a new mission expires the selection. Duplicate,
excess, invalid, companion and NPC selections are rejected. A second selection
requires an owning GC's correction note. The workflow serializes competing choices,
rechecks mission/context changes and recognizes committed writes after lost
responses. All **4,030** Node tests, native schemas and the added 720px dialog
check pass. An actual native skill-sheet button/dialog records two skills and
changes taking-10 time from 2× to 1×, with no page errors or transaction diagnostics.
The review scores remain unchanged while the larger documented gaps are addressed.

The remaining standard-NPC health conversion audit is complete. The actor captures
actual vitality/wound maximum changes in both native Active Effect phases, combines
them with feat bonuses for the p.452 Damage save conversion, and retains the effect's
native duration and suppression behavior. Standard NPCs retain no temporary health
pools. Regression tests cover negative changes, repeated preparation, disabled and
removed sources, and legacy adjustment review. Native Foundry confirms a +4 base
save becomes +5 with the feat and +9 with both phases, then +7 and +5 as effects are
disabled and removed; repeated preparation stays +9 and both pools remain zero.
All **4,032** tests, the 13 rebuilt-pack tests, focused lint, formatting, bundling
and the text-copy check pass. B-185 is closed. Broader specialist and campaign
coverage remains open, so no 9.9 claim is warranted yet.

The next combat pass connects saved Acrobatics/Falling checks to damage and
landing settlement (pp.106,336). It calculates capped d6 impact, per-die source
reductions, the successful-check reduction/minimum, fluid versus solid landings,
qualified dives, actual-height AP and lethal-only stress. Failed checks apply
Sprawled. Separate impact and stress cards use the normal damage application
controls and preserve private visibility; the damage rolls are closed to boosts.
Actor records reserve the event before RNG, retain the dice before posting, recover
lost posting/write responses, and survive deleted cards. An interrupted unknown
roll requires GC entry of its actual dice and a note rather than another roll.

Native play-through closes the check, rolls 3d6 impact, posts six stress damage,
applies Sprawled, applies the impact to health, restores it with Undo and retains
the same result on repeated settlement. It exposed an unconfirmed native outcome
stored as `null`; regression fixtures now include that representation. No page
errors or transaction diagnostics occur in the final native flow. All **4,040**
Node tests, **227** layout tests, lint, formatting, bundle and text-copy checks
pass. The falling UI uses the existing contributor registration path, preserving
the architecture's import limits.

PC creation remains **9.0/10**. Combat rises to **9.2/10** for the connected and
natively verified hazard/damage paths, with remaining B-183 cases still explicit.
The next creation review targets retained vitality history when a level is removed
and rebuilt. Neither area is complete; source-data and inherited-choice auditing,
campaign details and the other combat/environment gaps remain required work.

The creation history pass closes B-106. Removing a career level atomically retains
its raw vitality source; rebuilding the same class/die restores its value, roll
reference, career identity and historical Intelligence. A different class/die
requires raw-result review rather than fresh RNG. Original roll or review evidence
governs the archived source even if the class item's die was edited. Removing an
unresolved rebuild cannot overwrite that original result. Deleted chat receipts,
competing calls and lost removal responses do not permit another vitality roll.

The native test restores an actual recorded Soldier gain with RNG disabled. After
changing d12 to d8, the rebuilt row has no raw value, refuses RNG, hides the Roll
button and retains Review; restoring d12 restores the original result and IDs.
All **4,042** Node tests and **227** layout tests pass, along with native schemas,
lint, formatting, bundling and the text-copy check. Creation rises to **9.1/10**;
combat remains **9.2/10**. Inherited feature effects and the source-data audit are
next; both scores remain below the requested target.

The inherited-feature audit connected four omitted allowances to the actual
limited-use service: borrowed Cold Read, Quick Change, Trap Door and Intercept
Communication. Pointman and Schemer receive only the chosen ability's allowance;
duplicate borrowed sources share it, and actual class takeover retains the
counter identity. The p.40 cross-class Trap Door entry explicitly uses a session
period, while the native Hacker class table uses a mission period (p.36); each
context keeps its printed period. The effects still use the established manual
class-ability workflow and require their stated circumstances at the table.
All **4,044** tests pass. Native Foundry posts the first borrowed Cold Read use,
refuses a second, retains exactly one use and one receipt, and reports no page
errors or transaction diagnostics. Scores remain **9.1/10** and **9.2/10** while
the remaining inherited effects and source-data coverage are reviewed.

The falling follow-up adds an agent/NPC hazard control for an actual landing
without an Acrobatics check. It records an environmental event, retains qualified
distance/per-die benefits, and uses the same durable impact/stress/Sprawled path.
It neither rolls an invented skill check nor consumes a voluntary action. Lost
posting responses recover the event and its cards. Solid and fluid cases have
regressions, and the dialog's final controls remain reachable at 720px. Native
Foundry verifies the real sheet button, a 30-foot solid landing, 3d6 impact, six
stress and Sprawled, with no page errors or transaction diagnostics. All **4,046**
tests and **228** layout checks pass. Multi-round descent and the pending Wire Fu
interpretation remain in B-183; scores remain **9.1/10** and **9.2/10**.

The p.204 review connects Not the Face's Charisma **damage resistance** to the
attribute ledger and hazard loss workflow. It uses the current Charisma modifier
while a defensive declaration is active; resistance is recorded on the original
event, applies before an attribute floor and may prevent the entire loss. Old
ledger events remain valid. Replaying an event after healing, feat loss or expiry
retains its original protection; other attributes are unaffected. This addresses
the resistance previously described as unmodelled Charisma DR in B-191.

Native Foundry verifies incoming five damage minus three resistance, then incoming
three minus two after Charisma falls, and an unprotected loss after the round
expires. The ledger stays valid. That play-through also exposed two local hooks
deleting the same expired display effect; per-actor mirror synchronization now
serializes and re-reads each plan. Regression tests cover competing create/delete
requests and recovery after a failed write. The final native pass has no page
errors or transaction diagnostics. All **4,051** tests, native schemas, lint,
formatting, bundling and the text-copy check pass. Scores remain **9.1/10** and
**9.2/10** while the larger remaining areas are addressed.

The chat-evidence review fixes half of B-192: every choose-twice check now posts
both actual Roll objects in one message creation. The preferred result stays
first, preserving consumers that resolve from the primary roll; the existing
alternative totals and chosen index retain original order. Native message
preparation applies visibility before both rolls are attached. A native blind
check confirms two complete rolls, the second selection as primary, and retained
GC-only visibility. Existing test doubles now model native preparation without
posting, so resource rollback and lost-response tests still exercise the actual
posting boundary. All **4,051** tests, focused lint, formatting and bundling pass.
Delivery-roll attachment and write-failure replay remain the next B-192 work.

The remaining B-192 work now preserves delivery results through interrupted
settlement. A successful Request closes its check and reserves the delivery
before drawing dice. The complete receipt and actual delivery Roll are saved
together. A rejected write reuses the retained Roll; after lost client state the
GC records the actual total and a review note, without drawing new dice. Receipt
validation binds the original check, historical time multiplier, delivery dice
and actor settlement. Native Foundry confirms both ordinary delivery and recovery
through the existing acquisition completion control after a page reload, with
no duplicate payment, page errors or transaction diagnostics. The recovery dialog
also passes keyboard and 720px layout checks. All **4,055** tests pass. B-192 is
closed; the scores remain **9.1/10** for creation and **9.2/10** for combat while
the remaining source audit and play workflows are implemented.

The disposition control now supports persuading an NPC to join combat (B-184,
p.458). The GC records sides before the first check; teammates share one durable
attempt. An actual PC or NPC Impress/Persuasion roll carries the target, combat
and attempt identity. Resolution closes that check, applies the recorded
disposition DC and campaign DC policy, and retains the first winning side.
Adversarial requires an actual Triumph; cooperative helpers cannot replace the
leader's result. Failed attempts leave other sides eligible. Deleted cards and
unknown posting failures retain the attempt, while a known cancellation can
continue the same reservation. Lost write responses and repeated settlement do
not repeat the roll or outcome. GC Undo notes support explicit corrections.

Native Foundry exercises both a PC and a standard NPC through the disposition
dialogs, actual skill rolls and successful settlement, then rejects further
attempts. Both paths finish without page errors or transaction diagnostics.
The large-cast side dialog is keyboard reachable at 720px, and all **230** layout
tests pass. Creation remains **9.1/10**; combat rises to **9.3/10** for this
connected play workflow. The larger source-data audit, remaining environment,
campaign-quality and special-option gaps still prevent either area reaching 9.9.

The reference-fixture audit corrects illegal skill purchases in all three
numerical builds. Each now spends its actual level budget, stays within the
purchase-time rank limits and records independently calculated purchased ranks
at every career level. The Raptor fixture also has its required melee feat and
proficiency, with prerequisites checked before entering the expert class.
Networking contact awards and affected result caps follow the corrected ranks,
including Fit's Athletics cap bonus. The fixture check grows from **482** to
**988** assertions. These remain partial numerical builds with outstanding setup
choices; they are not evidence of completed native PC creation. Scores remain
**9.1/10** and **9.3/10** while that workflow and the larger B-193 audit continue.

The native creation pass exposed Training choices that could consume the final
allowance while leaving no setup task for an invalid selection. Blank or
ambiguous contact names, malformed contact grades, duplicate or blank focuses,
invalid proficiencies, duplicate Interests and over-budget Training selections
now remain explicit setup errors. Saved selections are preserved for correction;
invalid grades cannot provide negative spending, and invalid proficiency values
cannot grant a benefit. Existing temporary-focus provenance warnings also remain
visible in setup rather than disappearing among informational warnings.

The native level-one Soldier now completes all setup tasks with zero warnings,
including its original Small Screen/Big Budget/Modular creation policy, Contract
Pro and Talented choices, class bonus feat, three recorded feat acquisitions,
20 skill points, weapon proficiency/forte picks, all five focus choices, two
Interests, two contacts and five Wealth points. An unnamed contact is first
verified as an error, then corrected through the actual Training field. Reloading
retains the choices and reopens the completed character in Play mode. The 1280×720
pass has no page errors; Foundry itself reports its higher minimum resolution,
so that check establishes this sheet flow rather than general core compatibility
at 720px. All **4,081** tests, **988** fixture assertions, native schemas, lint,
formatting, bundling and the text-copy check pass. Creation rises to **9.2/10**;
combat remains **9.3/10**. Broader source and option coverage remains outstanding.

The Favored Gear audit found a separate starting-dice boundary error: session
reset applied Fortune Favors the Bold to values the engine had already improved.
At Career Level 16–20 that could turn the prepared six d12 starting dice into a
twelve-die balance. Session reset now uses the prepared count and die unchanged.
Regression tests prepare real engine characters in every career die band before
building reset plans; native Foundry confirms a level-16 character retains six
d12 dice in its reset plan, with no page errors or transaction diagnostics.
This fixes the session boundary independently of the continuing Favored Gear work.

Favored Gear's session rules now execute from session start and the Gear planning
controls. The actual item and mission Calibers determine a separate item wallet,
an ordinary-die discard or mission-long loss of access. The session reset marks
unresolved choices before play; cancellation or a failed write retains the item
hold. A durable actor receipt saves the balances and access together, and retries
reuse that record. Restricted wallets fund only the item's skill boosts and
threat activation; other items, attack/damage boosts, general costs and Shaken
fees cannot use them. Fortune Favors the Bold applies once to each new wallet.

GC history review records the original session context and actual remaining
ordinary/item dice, preserves the previous records, retires the superseded
wallets, and corrects access with an Undo note. It does not replay earlier fees
or gains. Native Foundry verifies an item boost, a restricted critical payment,
a one-die discard, preserved armor when paid, and removal of armor DR when
forfeited while retaining class DR. It also verifies actual-history review after
the wallet is spent. The native item snapshot now retains UUIDs: a qualifying
Trademark Gear item is recognized for a two-die boost costing one wallet die.
Both long dialogs remain keyboard reachable at 720px. All **4,106** tests,
**988** fixture assertions and **232** layout tests pass, along with native
schemas, lint, formatting, bundling and the text-copy check.

Creation rises to **9.3/10**; combat remains **9.3/10**. Current dimensions are
attributes/health 1.95, origins/classes 1.85, skill purchases 1.95, feats/training
1.75 and gear/finalization 1.80 for creation; initiative/actions 1.90,
attacks/Defense 1.90, damage/recovery 1.90, conditions/resources 1.85 and
conditional options/environments 1.75 for combat. The remaining recommendations
are the source audit and additional acquisition histories, current-session
favored-item reselection after advancement, campaign-quality gaps, group combat
actions, environmental rules and the remaining special options in the backlog.

Wire Fu now halves falling impact and associated stress, rounding down, under
the user's confirmed ruling. Other distance, per-die and Acrobatics reductions
apply first; physical fall height, armor piercing and landing conditions retain
their ordinary rules. The quality applies to player and special characters,
including a current NPC promotion. The divisor is saved with the landing's
durable context and shown on its damage cards. Existing results and interrupted
settlements retain that context when the quality later ends.

Native Foundry verifies an actual no-check landing, both reduced cards, impact
application exactly once and Undo, special/standard NPC scope, and replay after
the quality ends. No page errors or transaction diagnostics occur. All **4,110**
tests, **988** fixture assertions and **13** pack checks pass; lint, formatting,
bundling and the text-copy check also pass. Combat rises to **9.4/10**: damage/
recovery is now 1.95 and conditional options/environments 1.80, with the other
dimensions unchanged. Creation remains **9.3/10**. Multi-round descent and
Wire Fu movement still require work; these checks establish the damage rule.

### Continuing pass: Subtle and Violent attack checks

Subtle now reduces actual attack checks and prepared PC/NPC attack figures by
one. Violent widens attack threat ranges by two through the shared weapon
planner, including unarmed and final attacks. These combine with existing feat,
weapon and target-role changes, preserve attacks that cannot threaten, and leave
error ranges and damage unchanged. Chat results retain the declared campaign
policy; a changed policy during an attack invalidates its context.

Actual Foundry PC and NPC attacks verified both changes, the sheet figures and
historical chat results after the qualities ended. All **4,114** Node tests,
**988** independent fixture assertions and **13** pack checks pass. Lint retains
its existing warnings with no errors; formatting, bundling and the text-copy
check pass. Scores remain **PC creation 9.3/10, combat 9.4/10**. Campaign stress,
disposition, movement and action-die details remain open in B-180/B-183.

### Continuing pass: campaign stress and Tense taking 10

Mellow and Tense now change actual PC and NPC stress damage. Their separate
factors combine additively with each other, Firefighter Training and Wire Fu,
then round down once before resistance. Mellow retains its minimum for a
positive hit; resistance can still prevent the damage. Explicit final-damage
entry avoids repeating campaign adjustments. Damage receipts keep the original
calculation, and a saved landing includes its original campaign stress policy.
The standard NPC Damage save records its actual campaign-adjusted amount.

Tense now prevents taking 10 on ordinary skill checks, including when a feat
reduces the time or a GC permits that named use. Taking 20 and rolled checks keep
their existing restrictions. A real Foundry check that otherwise permitted
taking 10 was blocked without rolling. Native PC/special/standard NPC stress,
Wire Fu plus Tense, card application, Undo and landing replay after campaign
changes all passed without browser errors. All **4,122** Node tests, **988**
reference assertions, **233** layout checks and **13** pack checks pass. Lint,
formatting, bundling and the text-copy check pass with the existing warnings.

Review: **PC creation 9.3/10; combat 9.5/10**. The combat dimensions are
initiative/actions 1.90, attacks/Defense 1.90, damage/recovery 1.95,
conditions/resources 1.85 and conditional options/environments 1.90. The increase
credits these executable global campaign rules and their native evidence.
B-180 still covers disposition and other campaign details; B-183 and B-186–191
retain the movement, grappling, source-history, environment and advanced combat
gaps. Neither area has met 9.9/10; implementation continues.

### Continuing pass: favored items chosen with a new career level

The Gear tab now records the complete favored-item selection once when a PC
applies a new career level. Unchanged items retain their actual historical
wallets. Replaced items retire their old restricted dice; the new items receive
neither a session bonus nor a session fee until the next session starts.
Mission forfeits remain recorded against their original items. The history binds
actual active feats, items, Calibers, level, session, reviewer and source note.

A first Favored Gear selection after session start requires the earlier reset
record and GC confirmation that the starting selection was empty. The ordinary
session settlement cannot replay its awards in that known advancement case.
GC balance review preserves recorded level replacements, including a higher
Caliber item that legitimately owes no fee this session. Unknown histories still
require explicit GC review. Complete selections, source freshness, rejected or
lost writes and repeated submissions have focused coverage.

A native PC advanced from level 16 to 17, selected a new Caliber V favored item
through the actual Gear-tab button, retained six ordinary dice and retired its
old two-die wallet. Undo restored the prior receipt and wallet; reapplication and
a later GC review preserved the new selection with no extra cost or award.
There were no browser errors. The full suite passes **4,132** Node tests and
**988** reference assertions; **234** layout checks pass. Lint, formatting,
bundling and the text-copy check pass with the existing warnings.

Review: **PC creation 9.4/10; combat 9.5/10**. Creation's gear/finalization dimension
rises to 1.90; attributes/health 1.95, origins/classes 1.85, skill purchases 1.95 and
feats/training 1.75 remain. B-193 continues the wider source audit and other
class/origin/feat/contact history cases. Both areas remain below 9.9/10, so the
implementation/review cycle continues.

### Continuing pass: invalid and unassigned favored-item choices

Favored Gear now exposes unassigned Favored, Signature and Trademark choices on
the Gear setup checklist. Invalid Calibers, too many favored items, missing
approval and conflicting acquisition sources retain their saved values and an
explicit correction task. They supply no Signature/Trademark bonus or doubled
boost dice. Invalid favored armor is excluded from derived armor defenses.
Correcting an item immediately restores its valid benefits.

Native testing also found a runtime bypass: copying a Foundry DataModel into the
attack/damage planner omitted its computed favored-item availability reason.
The document adapters and pure planners now retain that reason through weapon
copies, so a held or forfeited weapon cannot attack or roll damage through those
paths. Regression coverage uses an inherited computed property, matching the
native DataModel behavior. Unaffected sample-agent golden results remain stable.

Native armor DR changed from 7 to 1 when its favored Caliber was invalid, retaining
class DR, then returned to 7 after correction. An excess favored item removed
Trademark bonuses and blocked the weapon; deleting it restored the valid
assignment. Unassigned choices appeared and cleared on correction. Native checks
reported no browser errors. All **4,136** Node tests and **988** independent
fixture assertions pass; lint, formatting, bundling and text-copy checks pass
with the existing warnings. Review scores remain **PC creation 9.4/10 and
combat 9.5/10**. The broader source audit in B-193 remains open.

### Continuing pass: typed Crossroads attempts and Routine

Subplots now distinguish standard stories from each Crossroads title sought.
Free-text names do not determine that classification. Active Crossroads require
the printed career level, explicitly completed standard Subplots and all lower
GC-confirmed titles; a held title or duplicate active attempt is rejected. Saved
invalid types and titles remain visible for correction. Completed history is
retained rather than retroactively requalified.

Routine prevents new Crossroads choices and puts an existing active attempt on
the setup correction list. An older active row needs classification when Routine
matters. New rows start as standard Subplots. Invalid attempts do not satisfy
Trouble Magnet, while all named unfinished rows still count against the normal
limit. Existing Crossroads titles keep their benefits. Awarding a title and its
mission/session benefit timing and XP adjustment still need further work.

The new controls use the real Training row template in layout checks at 264px
and 480px column widths. Native testing exercised minimum prerequisites, the
Routine hold, a correction through the actual selector, legacy classification and
completed history, with accessible controls at 1280×720. The known Foundry core
minimum-resolution advisory remains; it is not a claim of full core support at
that size. Native favored-item advancement now also checks actual Soldier 17,
not only Career Level 17, and a class-progression mismatch prevents new-level
favored choices.

All **4,143** Node tests, **988** independent fixture assertions, **236** layout
checks, native schema preparation and **13** pack checks pass. Lint and formatting
pass with the existing warnings; bundling and the text-copy check pass. Native
workflows had no browser errors. Scores remain **PC creation 9.4/10 and
combat 9.5/10**. The title award/history gap and broader B-193 source audit remain
open; the implementation/review cycle continues toward 9.9/10 in both areas.

### Continuing pass: Crossroads mission XP eligibility and settlement

Mission starts now capture each PC's held Crossroads title, including an empty
selection. Later titles cannot improve that mission's XP. Older missions and
characters without a usable snapshot require an owning-GC eligibility review;
corrections retain the earlier record and an Undo entry. A review changes
eligibility history only, without replaying an existing XP settlement.

Mission settlement and the GC preview now apply the highest eligible title's
percentage after the normal mission multiplier. **User ruling: round the
Crossroads XP bonus up.** This is separate from other declared post-multiplier
modifiers. If both an automatic Crossroads bonus and other XP are present, the GC
must confirm the other amount excludes Crossroads. The existing user-confirmed
p.440 action-die/base-XP order remains unchanged. Settled missions reject a second
attempt before opening another eligibility review.

The actual Foundry dialogs reviewed a Weathered title, then settled 101 base XP
at Career/Threat Level 7: 707 core XP plus 36 Crossroads XP credited 743 once.
The card retained the breakdown and policy. A repeated settlement was blocked;
subsequent eligibility correction and Undo left paid XP and the original reward
record unchanged. Native checks reported no browser errors.

All **4,155** Node tests, **988** independent fixture assertions, **238** layout
checks and **13** pack checks pass. Lint, formatting, bundling and the text-copy
check pass with the existing warnings. Scores remain **PC creation 9.4/10 and
combat 9.5/10**. Next-session starting-die eligibility and the title-award workflow
remain open, along with the broader source and play gaps in the backlog.

### Continuing pass: Crossroads title dice at the next session

Session resets now capture the held title, including an empty selection. The
engine uses that session's eligible title in starting counts and formulas that
depend on them. A newly earned title first changes dice at the next session.
Reset planning uses the upcoming count, with guards that remain valid while
Foundry prepares the character between the actor write and counter update.
Rollback restores the prior title snapshot along with the dice balance.

Unknown legacy history remains an explicit GC review and preserves existing
counts until reviewed. Session eligibility corrections archive their earlier
record, provide Undo, reject stale dialogs and leave current dice and XP alone.
The owning GC can reach both session and mission title reviews in Play mode.
Invalid saved title values stay visible for correction.

The actual Foundry flow used Bold Soldier 16 with Hardened newly held and
Seasoned eligible at session start: prepared count 7, die d12, saved balance 3.
A session eligibility review and Undo preserved the balance. The actual reset
plan and actor receipt produced 8d12 at the next counter, then remained 8 on
repreparation. Native diagnostics and browser errors were empty. Tests also
cover original-d12 Fortune doubling and Personal Lieutenant's fixed count.

All **4,163** Node tests, **988** independent fixture assertions and **239**
layout checks pass. Lint, formatting, bundling and the copy check pass with the
existing warnings.

Scores remain **PC creation 9.4/10 and combat 9.5/10**. Title awards and the
broader B-193 audit remain open; no credit is claimed for unreviewed mechanics.

### Continuing pass: complete Crossroads and award titles

The owning GC can now choose an unfinished typed Crossroads, confirm the story
and original entry requirements, and complete it with its corresponding title
in one actor write. Current eligibility is preserved before the title changes.
Unknown session or mission history must be reviewed first. Entry levels,
completed standard stories, earlier titles, Routine, duplicate attempts and the
unfinished-story limit are checked again inside the resource transaction.

The receipt keeps the earlier title, selected story, level, period eligibility,
reviewer and note. Repeated completion cannot award another title. Successful
writes with lost responses are recognized, and Undo restores the story, title
and eligibility. Current dice and XP remain unchanged; the normal Subplot XP
still belongs in mission settlement, as the dialog explains.

Native Play-mode controls completed a Weathered Crossroads for actual Soldier 7.
The title and story changed together; current XP 55,000, ordinary dice 3 and
starting count 5 were preserved. Current-mission Crossroads XP stayed 0%; a
new-mission snapshot made it 5%. A repeated completion was blocked, and native
Undo restored Seasoned and the unfinished story. Browser errors and diagnostics
were empty.

All **4,168** Node tests, **988** independent fixture assertions and **240**
layout checks pass. Lint, formatting, bundling and copy checks pass with existing
warnings. Scores remain **PC creation 9.4/10 and combat 9.5/10** pending the
broader source audit and remaining play gaps. The next pass continues that work.

### Continuing pass: Paranoid skill checks and morale penalties

Paranoid now grants its surprise bonus only to player/special characters making
the named Blend/Stealth or Sneak/Hide check for surprise. It applies the social
penalty to the named disposition/persuasion uses and to other checks explicitly
declared to shift disposition or persuade an action. The NPC dialog supports
those declarations, including its role restriction on the surprise bonus.

Negative morale entries and Shaken now share one strongest-penalty calculation.
They stay separate from the skill bonus changed by Baffled or Incompetent.
Positive morale uses normal stacking. PC and NPC rolls retain campaign evidence
and reject applicable campaign or Shaken changes before posting. PC guards also
detect a quality newly introduced after planning an otherwise ordinary check.

Native checks covered a real PC, standard NPC and special NPC. PC persuasion
received one −4 penalty with Shaken present. The actual special-NPC dialog
produced `1d20 + 10` for the surprise check; the Shaken/social roll produced
`1d20 + 2`, rather than applying both −4 penalties. Standard NPCs received no
surprise bonus. Saved cards retained evidence; browser errors and diagnostics
were empty. Existing campaign-skill tests were preserved alongside the new suite.

All **4,174** Node tests, **988** independent fixture assertions, **241** layout
checks and **13** pack checks pass. Lint, formatting, bundling and copy checks
pass with existing warnings. Scores remain **PC creation 9.4/10 and combat
9.5/10**. Disposition effects and the other documented gaps remain under review.

### Continuing pass: actual NPC disposition on PC skill checks

A PC skill dialog can now select one readable NPC target and confirm its
recorded disposition toward the acting character. The actual target document
replaces caller-supplied records. Result, threat and error modifiers apply to
the named Intimacy/Fondness uses; Disposition-tagged ordinary checks use the
priority multiplier. Supportive uses an exact one-third multiplier, with reduced
times rounded up. Diplomatic adds one only to a positive disposition bonus for
an eligible acting character. Negative modifiers remain separate check penalties.

Access checks precede private target reads. Posting guards bind the real acting
character, named check, target, attitude and campaign bonus. Saved rolls retain
their original evidence after an attitude changes. Villain roles are excluded
from persistent-grade effects; their temporary scene rules remain separate.
Misleading text that described villains as immune to all disposition effects
was corrected to identify that distinction.

The real Foundry Persuasion dialog selected Friendly attitude toward the actual
PC, despite the NPC's Adversarial base attitude. Diplomatic changed `1d20 + 1`
to `1d20 + 4`; threat began at 19 and priority was 0.5. A later attitude change
left the card's original evidence intact. Native errors and diagnostics were
empty. The applicable target controls stay beside the named check.

All **4,179** Node tests, **988** independent fixture assertions, **242** layout
checks and **13** pack checks pass; subsequent role/access regressions also pass.
Lint, formatting, bundling and copy checks pass with existing warnings. Scores
remain **PC creation 9.4/10 and combat 9.5/10**. NPC acting checks, the frozen
combat-persuasion target handoff, combined timing and PC/villain scene effects
remain explicit B-180 work. This pass does not claim those paths are complete.

### Continuing pass: named NPC checks and reserved combat disposition

The NPC skill dialog now offers specific named uses alongside general checks.
Named choices apply their default error range, resolve applicable quality and
campaign effects, and can use a confirmed NPC disposition target. Disposition
changes the actual result, threat and error figures; the receipt retains its
priority. Optional Linguistics uses are hidden and rejected while that rule is
off, with another check before posting.

Reserved combat persuasion automatically uses its actual NPC target and saved
attitude, including a recorded group scope. Neither PC nor NPC actors can
substitute a later live attitude or a different target. A changed claim, acting
side, combat or participant roster stops the roll. Unlinked targets resolve to
their synthetic actor; target selection includes readable live-scene actors,
while private scenes are checked before their token data is read.

Disposition and campaign skill facts now belong to settlement evidence. A
changed proof cannot reuse an earlier approval or fall back to an older record
without those facts. The existing safe optional-setting reader handles early
hooks, and the disposition record has a stable place in roll registration.

Native dialogs rolled a special NPC's named Persuasion at `1d20 + 9`, error 1,
threat 19, with Friendly attitude and Diplomatic. Separate PC and NPC combat
flows used actual unlinked targets. Both retained their saved Helpful +6 despite
the targets changing to Adversarial before the roll, settled the saved attempt,
and blocked further attempts after success. Browser errors and diagnostics were
empty. The ordinary PC and NPC target paths and the reserved-target guidance
remain usable at 720px.

All **4,185** Node tests, **988** independent fixture assertions and **243**
layout checks pass. Lint, formatting, bundling and copy checks pass with existing
warnings. Scores remain **PC creation 9.4/10 and combat 9.5/10**; combined timing,
temporary PC/villain scene effects and the broader documented gaps still need
completion and review.

### Additive skill timing review — 27 November 2026

The user confirmed additive multipliers under p.329 and one time-reducing
effect under p.102. Ordinary PC skill checks now combine taking, Cross-Check,
Faceless and disposition using that policy. Competing reductions remain
alternatives. Automatic selection compares the resulting duration, including
the selected source's minimum and rounding. False Start can therefore beat a
percentage reduction when taking 20. Rounding follows the combined factors.

The source audit distinguishes percentage reductions from replacement times.
Charmer, Hard Core and the ambush feats establish fixed duration bases; taking
and other increases apply to those bases. For example, six seconds with taking
10 and Cross-Check becomes 24 seconds, whereas a half-time effect with taking
10 becomes 1.5 times listed time. Ambush Supremacy retains the earlier user
ruling for the standard slow preparation. A saved timing proof records the
policy, chosen reduction, fixed duration when applicable, factors and floor.
Posting and settlement guards bind it without rewriting completed cards.

Native Foundry checks used legal named checks: Athletics/Bind with taking 10
and Cross-Check saved ×4; Impress/Persuasion gathering a Faceless target's past
with taking 10 saved ×4; Friendly NPC priority with taking 10 saved ×1.5.
The Faceless target had actual Con Artist 1 and Blend 3. It is a focused fixture,
not an additional completed-PC creation test. Browser errors and diagnostics
were empty. The broader combination matrix is covered by rule tests.

All **4,189** Node tests and **988** independent fixture assertions pass.
All **243** layout checks also pass. Lint, formatting, bundling and copy checks pass with existing warnings.
Scores remain **PC creation 9.4/10 and combat 9.5/10**. Whole-Complex-Task
timing scope, temporary PC/villain effects and the broader documented creation
and combat gaps still require implementation and review.

### Temporary PC/villain disposition review — 27 November 2026

PCs and actual villain roles now use the p.458 temporary effects instead of
persistent NPC attitude grades. The GC records each successful source for one
acting character. The effects advance or cancel one degree at a time, cap at
two degrees, and change Intimacy/Fondness results, ranges and time. They do not
decide player behavior, Loyalty or combat allegiance. Standard NPC grades are
preserved. Agent-built companions are not silently treated as player characters.

The new sheet workflow records the source occurrence once, supports an earlier
remaining duration or explicit early end, and leaves an Undo receipt naming the
source and resulting degree. An expired or ended source is excluded; scene
changes expire all remaining effects. A source ignored at the cap does not
become a deferred extra degree. Retained sources are evaluated in their saved
order when another source expires. The GC still adjudicates the source's success
and records non-timed early endings; the workflow does not claim to resolve all
disposition-changing abilities automatically.

Actual PC and named NPC checks can select readable PC/villain targets. Effects
apply to every Intimacy/Fondness use, including timing for checks without the
Disposition tag. Diplomatic retains its role scope; time reductions follow the
confirmed additive policy. Private targets are checked before their state is
read, supplied target records are replaced from actual documents, and posting
guards detect source changes, expiry and scene changes. Completed cards retain
their recorded effects for settlement.

Native Foundry exercised the GC source dialog at 1280×720, both positive
degrees, cancellation, duplicate rejection, Undo, early end, a two-degree
villain penalty, exact timed expiry and scene expiry. Saved cards remained
unchanged. No browser errors occurred; the only diagnostic was Foundry's known
minimum-resolution warning. All **4,196** Node tests and **988** fixture
assertions pass. The full **243** layout checks and **126** focused dialog
checks pass; the latter include the new source/expiry layout case. Lint,
formatting, bundling and copy checks pass with existing warnings.

Scores remain **PC creation 9.4/10 and combat 9.5/10**. The documented source
audit, creation histories/options and remaining combat rules still prevent a
defensible 9.9 rating. The next pass continues with those gaps.

### Jack-of-All-Trades purchase-history review — 27 November 2026

The source audit found this quality had no executable effect. It now makes all
skills class skills for PC purchases under the applicable season, while keeping
skill-point awards unchanged. New career levels capture that purchase-time
policy. Each earlier allocation uses its recorded policy when calculating ranks;
turning the quality on or off does not reprice those points. Rebuilding the same
retained career slot preserves its recorded policy alongside the retained roll.
Agent-built companions do not receive this player-only benefit.

Unknown earlier history under the active quality produces an always-visible
creation error and prevents relying on invented cheaper ranks. The owning GC
can review each career level, with a source note and Undo. This changes the cost
interpretation and derived ranks, preserving the allocated points. The skill
sheet distinguishes historical costs from the current season. Invalid policy
records need review. Unrelated legacy characters retain their prior output.

Native Foundry tested an actual Soldier level added under the quality, a
cross-class Analysis allocation, legacy review through the real GC dialog,
preserved point budgets, a later season without the quality and Undo. The new
level retained two purchased ranks from two points; the reviewed legacy level
returned to one purchased rank after Undo. These are focused career/history
fixtures, not another fully completed PC. Browser errors and diagnostics were
empty.

All **4,202** Node tests, **988** fixture assertions, **13** pack checks and
**245** layout checks pass. Native schema/package/sample checks, lint,
formatting, bundling and copy checks pass with existing warnings. Scores remain
**PC creation 9.4/10 and combat 9.5/10** pending the broader source audit and
remaining mechanics. The next campaign-skill audit covers Omni-Competent.

### Omni-Competent cap and mode review — 27 November 2026

This quality also had no executable effect. Named PC skill checks now become
active and have no result cap. The current skill sheet shows the uncapped state;
skill ranks, maximum purchase ranks and point budgets stay independent.
Knowledge checks become active without requiring Photographic Memory, while
taking permissions still require their normal source. Manual and grade-built
NPC checks both use the uncapped result. NPC GC-only visibility remains an
explicit choice rather than exposing private statistics.

Campaign skill evidence now records the active/cap policy, alongside Paranoid
when applicable. The actual PC, NPC and Knowledge entry points preserve it and
detect adding or removing the quality before posting. Knowledge's guard now
also covers initially absent campaign policy. Completed cards retain their
original cap/mode evidence after later campaign changes.

Native Foundry produced an active Notice result of **116** above the ordinary
cap of **30**, an active Knowledge card and an uncapped manual NPC card. The
sheet displayed its uncapped figures. Removing the quality restored the live
cap of 30 without changing saved cards. Native testing caught and fixed the
manual-NPC path separately from the already-tested grade-built path. Browser
errors and diagnostics were empty.

All **4,207** Node tests, **988** fixture assertions, **13** pack checks and
**245** layout checks pass; the final manual-NPC correction also passes the
focused **21**-test regression run and native verification. Lint, formatting,
bundling and copy checks pass with existing warnings. Omni-Competent's
per-penalty reduction remains open, including the pending GC rounding ruling.
Scores remain **PC creation 9.4/10 and combat 9.5/10**; work continues.

### Shared NPC Defense boost review — 27 November 2026

The normal GC Defense spend now applies its actual effect. It checks the NPC's
participation, start-of-round declaration and action eligibility, pays one GC
die, uses the NPC's role die and the recorded dramatic-scene explosion policy,
and grants +2 live Defense for the actual rolled duration. The current round
counts toward that duration. Another combat cannot inherit it. An explicit
replacement pays for a new duration without stacking; Undo restores the prior
paid state. The GC's public/private spend choice is preserved.

A source card is reserved before payment/RNG. Each natural result is saved
before another explosion rolls. Known failures before RNG cancel and refund
only their reserved payment. Unknown results or effect-write failures hold the
GC payment and block another delivery for that NPC. GC recovery preserves all
saved natural results, rolls nothing, pays nothing again and keeps the original
round. An unrolled reservation can release only its own held payment. Lost
effect-write responses are recognized; completed deliveries cannot replay after
Undo. Source and payment state changes are guarded before rolling and applying.

New GC Undo notes identify their original session, preventing an old receipt
from crediting a new pool. Legacy unscoped notes still need review. NPCs now
show the shared Defense state through the round-effect display, while numeric
expiry refreshes on combat changes even with that display disabled. The
contributor registers through the existing NPC card module, preserving the
repository's layer limits.

Native Foundry used the real GC dialog, recorded actual dice, changed live
Defense from **10 to 12**, expired it at the recorded round, removed its mirror,
and restored the original state and one die with Undo. An injected effect-write
failure held the saved die/payment; recovery applied the boost without another
charge. Browser errors and diagnostics were empty. The full **4,218**-test run,
**988** fixture assertions, **248** layout checks and native schema checks pass.
The final guards and dramatic-role explosion case also pass **41** focused
tests. Lint, formatting, bundling and copy checks pass with existing warnings.

The dramatic post-hit spend must still integrate before damage/on-hit
settlements; DC boosts still need an actual declared-DC workflow. Neither is
credited as complete. Omni-Competent penalty rounding is also still awaiting
the requested GC ruling. Scores remain **PC creation 9.4/10 and combat 9.5/10**.

## Review 40 — dramatic post-hit NPC Defense

An actual hit against an NPC in a dramatic scene now waits for the GC's
Defense decision before outcome confirmation, damage controls or on-hit
effects. The GC may finalize without spending, or spend successive actual
role dice while the attack still hits. Saved natural results include both
dramatic explosion faces. Each paid result increases only this attack's saved
Defense; live NPC Defense is unchanged. Cover-only misses and multiple-hit
results are recomputed against the new threshold.

The decision records the original attack, target, scene, session and feats.
Only the GC can spend or finalize. Players can request the decision without
reading private NPC rules. Stale simultaneous decisions reject before payment.
An interrupted delivery retains the die and payment for GC recovery without
rerolling or charging again. Pending dice can be undone in reverse order with
same-session refunds; finalized effects cannot be rewound through that receipt.
A failed final cleanup resumes the saved outcome without confirming it twice.
Finalization preserves the later critical and damage steps, while preventing
ordinary re-resolution or a later action-die boost from invalidating the saved
decision. A confirmed result must match the finalized outcome.

Native Foundry exercised the actual weapon attack and GC dialogs. A paid die
turned a hit into a miss, retained the target's flat-footed state and removed
damage entitlement. Undo refunded the die; another actual die was paid and
finalized. A second attack finalized with zero dice, ended flat-footedness and
offered its weapon damage control. Browser errors and diagnostics were empty.
The four new 720px dialog states pass, along with all **252** layout checks.
Focused mechanics and application tests cover exploding dice, cover, burst
hits, stale decisions, private targets, recovery and finalization retries.
All **4,230** Node tests and **988** fixture assertions pass. Lint,
formatting, bundling, native schemas and copy checks also pass with the
existing lint warnings.

PC creation remains **9.4/10** and combat remains **9.5/10**. Declared DC
boosts, later rerolls/GC corrections of finalized Defense, the remaining
campaign mechanics and the documented source-data audits are still open.

## Review 41 — declared skill DC boosts

The GC spend menu now declares an actual character and exact skill/Knowledge
check before paying or rolling. It fixes the source DC and campaign policy,
then rolls actual d12s: one ordinarily, up to three in a dramatic scene. Each
natural and explosion sequence is saved before another roll. Incomplete
delivery retains its payment and known results for GC recovery without
rerolling or paying again.

The next matching check reserves the declaration on its actual actor before
RNG. The claim persists beyond deleted cards and lost responses, rejects
duplicate use and survives legal rerolls with the original DC. A result card
resolves against that saved DC, including any later check boost. It cannot be
recast as an opposed check or confirmed against a different threshold. An
unused declaration has session-scoped Undo; a claimed one requires review of
the actual roll. Uncertain claims remain consumed until the GC reconciles a
posted check, confirms no roll happened or retains the unposted result's
consumption. Private declarations block player rolls and force the GC's
replacement check to GM visibility.

Native Foundry used the real declaration dialog, an actual PC skill, a
three-die dramatic NPC skill and a private Knowledge check. Injected final
application failure retained the actual dice and GC payment; recovery did not
roll or charge again. Undo refunded only the unused declaration. A separate
player client claimed and resolved an active check, synchronized its result
with the GC and was blocked from rolling against a private declaration. The
GC's private check excluded the player. Browser errors and diagnostics were
empty. All **255** layout checks pass.
All **4,244** Node tests and **988** fixture assertions pass. Lint,
formatting, bundling, native schemas and copy checks pass with existing
warnings and no copied run reaching the repository's rejection threshold.

PC creation remains **9.4/10**. Combat advances to **9.6/10**: attacks/Defense
now scores **1.95/2** and conditions/resources **1.90/2**, with the other
dimensions unchanged. Finalized Defense rerolls/corrections, legacy unscoped
GC refunds, the remaining campaign mechanics and source-data audits still
prevent a 9.9 score.

## Review 42 — legacy GC refund history

Undo no longer credits a GC payment when its note lacks a valid original
session. Character restoration still occurs, and the note offers a GC review
of the payment's actual session. A confirmed current-session refund records
one durable pool receipt; an earlier-session payment records the decision
without adding dice. Retries reconcile that receipt, including a failed final
note write. Explicit replacement of a pool in the same session retains these
decisions, while a later session cannot receive an earlier review's credit.

Native Foundry exercised the real review button/dialog, both session choices
and an injected final note-write failure. The pool gained each approved die
once, the earlier payment added none, and recovery did not credit twice.
Browser errors and diagnostics were empty. All **4,248** Node tests and
**988** fixture assertions pass, as do the new 720px dialog check, lint,
formatting, bundling and copy checks. Existing lint warnings remain.

Scores remain **PC creation 9.4/10 and combat 9.6/10**. Remaining partial
Undo failures and event-specific once guards stay in B-187; this closes the
unscoped legacy-refund path without claiming that the wider audit is done.

## Review 43 — paid NPC Defense across legal rerolls

Perfect Skill Mastery can replace a failed attack (p.200). That replacement
now retains its actual original target, recorded Defense, cover and cumulative
GC dice paid against the same attack. It validates the original failed card
before and after RNG and saves the attack's feat snapshot. Live NPC Defense
changes cannot replace that threshold. Further failed replacements retain the
same payment once; a replacement that hits can enter a new dramatic reaction
before its outcome or on-hit effects settle. Newly paid dice add to the prior
history, without charging or counting the earlier dice again.

The card offers resolution against the recorded Defense and preserves hidden
Defense. A manual outcome cannot skip that resolution. The original card is
superseded through the existing reroll workflow, and the actual class/feat
resource is consumed normally. Legacy finalized Defense cards without the
feat snapshot need GC history review; that remaining path and broader GC
corrections stay in B-188.

Native Foundry used a level-18 Soldier with the Scholar mastery chain and its
real Perfect Skill Mastery resource. After an actual paid NPC miss, a legal
reroll consumed one of three uses and resolved against recorded Defense
**31**, while the NPC's live Defense was **128**. The GC pool stayed at
**19**, preserving the original paid die without another charge. Browser
errors and diagnostics were empty. This is a partial high-level combat
fixture, not another completed character-creation acceptance test.
All **4,250** Node tests and **988** fixture assertions pass, along with
lint, formatting, bundling and copy checks. Existing lint warnings remain.

Scores remain **PC creation 9.4/10 and combat 9.6/10** while the remaining
backlog and source audits are addressed.

## Review 44 — Scientist creation and durable shared feats

The creation audit checked the PDF layout for the Brainy and Origin tables
(pp.18–19); the older plain-text table shifts row labels, while the actual
Brainy mechanics agree with the data. Researcher and Scientist creation rules
were checked against pp.25 and 41–42. A second complete native character,
Brainy/Researcher Scientist 1, now has **36/36** attribute points, **52/52**
skill points and no setup tasks. False Start is acquired at level 1 through
the explicitly assigned Intense Study source and its two-level allowance.
Scholar and Depth of Study use the other feat choices; the additional Science
focus and contact allocation remain valid. Editing the contact, entering
Play and reopening after reload preserve the completed character. The 1280px
test emits Foundry's known minimum-resolution warning, with no browser errors.

Professor/Trailblazer sharing previously locked only the source and attempted
to roll back recipients after a failure. It now locks the source and actual
recipients, records the session selection before delivery and journals each
positive grant. Stable source/selection/feat identities reconcile a lost
creation response. A removed feat or deleted card cannot free that selection.
Already possessed selections are retained without adding duplicates. The GC
can complete confirmed undelivered grants or retain consumption when history
is uncertain. Private source cards expose recovery and Undo; restoring a
deleted card does not repeat delivery. Undo removes only that selection's
temporary items and preserves the session choice. Partial withdrawal retries
the remaining grants, and an old card cannot remove the next session's grants.

Native Foundry injected a response loss after the second recipient's actual
item was created. Recovery retained one Scholar per recipient, applied each
Science bonus from **0 to 2** once and undid them back to **0**. A separate
player client delivered the owned character's grant and received a private
receipt; player withdrawal was blocked, while GC Undo synchronized back to
the player. These sharing runs had no browser errors or diagnostics. All
**4,257** Node tests, **988** fixture assertions and **258** layouts pass.
Native schemas, lint, formatting, bundling and copy checks also pass with
existing warnings.

PC creation advances to **9.5/10**: origins/classes **1.90/2** and
feats/training **1.80/2**, with the other dimensions unchanged. Combat stays
**9.6/10**. The broad class/origin/feat and equipment source audits, additional
expert/multiclass creation cases and remaining combat/campaign gaps are still
open; these two complete creation cases do not establish universal coverage.

## Review 45: attack damage belongs to actual hits

The combat review found that damage cards were counted only in chat. Deleting
cards could free apparent hits, the first applied card could take a multi-hit
attack's critical, and the same card could reduce one target's health twice.

Damage now reserves a numbered hit on the attacker before RNG. The journal
retains pending and completed rolls after card deletion, saves actual dice
before posting and reconciles a lost successful response. Known unrolled
cancellations release their slot; uncertain results retain it for GC review.
Recovery restores saved results without rolling again. Older attacks require
a reviewed count of already rolled hits, including deleted results. Critical
activation is frozen with the roll and belongs to hit 1, independently of
application order. Legal damage boosts update the saved result, and damage
profiles survive later weapon edits or deletion. Attack changes stop once
damage begins; damage boosts stop once application begins.

Each target retains a stable hit/application receipt. Concurrent presses and
restored cards cannot repeat that hit's effects. Pending target applications
block further hits until settled or reviewed. Lethal health changes and their
plan are written together under the target's lock. Partial failures retain
Undo evidence and require GC review instead of replaying saves or effects.
The GC can retain actual effects and recover the Undo note, or release a
verified effect-free attempt. Positive health or Undo evidence cannot be
released. Undo preserves the source hit quota and permits applying the same
saved result again, with a new application attempt. Application records are
replaced exactly so Foundry's merge behavior cannot retain an earlier plan.

Native Foundry exercised a real three-hit burst, failed damage-card posting,
saved-result restoration, numbered rolls, a refused fourth roll, out-of-order
application, duplicate refusal after card deletion/restoration, Undo and
reapplication, and a later weapon edit. The actual GC target-review dialog
also completed at 1280 × 720. No browser errors occurred; the only recorded
diagnostic was Foundry's known minimum-resolution warning. Automated checks:
**4,274** Node tests, **988** fixture assertions and **261** layouts pass.
Native schemas, lint, formatting, bundling and copy checks pass with existing
warnings.

PC creation remains **9.5/10** and combat **9.6/10**. This closes a material
damage-delivery gap, but does not close the remaining Count, finalized-Defense
correction, environment/grapple, campaign and broad source-audit gaps. The
9.9 target has not yet been reached.

## Review 46: Count modifiers share round-end settlement

The Count review found that Gunplay, Dueling, Forward Stance, Called Shot,
Kick, Brush and Diversion used a direct initiative update. That bypassed the
shared round-end limit, and a source-card write followed by a failed combatant
write could lose the change. Close or concurrent requests could also race.

These changes now queue in fluid initiative. New checks retain their actual
combat, combatant, round and trigger identity; replacement checks retain the
same trigger. Actor-held claims and atomic combatant delivery receipts retain
positive history after a missing source mark or lost response. A duplicate
trigger cannot add another modifier. Its pending modifier can be withdrawn by
the GC without refilling the trigger. Settled or uncertain history instead
uses a reviewed absolute current Count, with an explanation of later actions.
That correction persists its intent before writes, applies once and can finish
missing conditions without repeating the Count change. Copied actor history
cannot operate on the original character's combatant.

Round settlement now shares the actor lock with pending modifiers, marks
delivery receipts settled in the Count update and retries only unfinished
zero-Count conditions after an interruption. A Count initially at 50 or more
is noticed even without queued modifiers, and actually Pressing clears its
pending Press flag. Player requests use an authenticated GC review before
delivery; this review checks the actual rule, amount and original round.

Native Foundry exercised actual Called Shot attacks, an injected response loss
after the combatant write, repeated requests, withdrawal and round-end
settlement. Three remaining penalties totalled **−15** and changed Count
**49 → 39** once. The actual GC review dialog corrected Count to the zero
threshold, producing **20**, Reeling and Flat-footed. A separate real player
client queued one modifier only after the GC allowed its request; it settled
**20 → 15** once. Both completed runs had no browser errors or diagnostics.
All **4,287** Node tests, **988** fixture assertions and **262** layouts pass.
Native schemas, lint, formatting, bundling and copy checks pass with existing
warnings.

PC creation remains **9.5/10** and combat **9.6/10**. The source text's general
cap and its Delay example disagree about Delay exceeding ten Counts; the
existing Delay behavior remains while that ruling is pending. Malformed and
older Count histories, remaining once-per-trigger paths, broader action
timing, finalized-Defense correction and the other documented source and
combat gaps remain under review. The 9.9 target is still open.

## Pass 47: expert-class qualification and complete multiclass creation

PC creation is **9.6/10**; combat remains **9.6/10**. The class-table source
cross-check covered all 30 classes, 420 level rows and 6,300 numeric fields,
with no differences. This checks progression values, not every ability's behavior.

Expert entry cannot occur before Career Level 5. Recorded original entry and
current requirements now have separate checks. Losing a requirement suspends
class abilities, including the original expert core, conditional combat effects
and new limited-use activations. It retains owned levels, base progression,
health, purchased skill history and acquired feats. Restoring the requirement
restores abilities without replenishing resources. Unknown original entry is
explicitly provisional; malformed or failed entry evidence blocks abilities.
An owning GC can record and restore entry decisions with source notes and
concurrent-history checks, without rewinding later advancement.

Advancing a complete first-level PC now captures its original attribute scores
before later increases. Origin attribute choices participate in the history
signature, while unrelated later skill choices do not invalidate it.

A third complete native PC, Soldier 4/Brawler 1, entered the expert class through
the actual advancement workflow and reloaded in Play with no creation tasks.
Removing and restoring Improved Weapon Proficiency exercised actual damage
boosts: the core produced two dice while qualified and one while suspended.
Base totals, health, purchased ranks and remaining resources were retained.
Actual GC entry review and restore also passed, followed by a clean reload.
There were no browser errors or diagnostic failures.

All **4,299** Node tests, **988** fixture assertions and **263** layouts pass;
schemas, lint, formatting, bundling and copy checks pass with existing warnings.
Partial class-ability unit fixtures explicitly assume qualification; separate
integration tests use real prerequisites and do not use that assumption.
The origins/feats/equipment audit, broader native choices and combat gaps in
the backlog still prevent a 9.9 rating. Treatment of already-running timed
abilities after losing requirements awaits the requested ruling.

## Pass 48: physical fall timing and Wire Fu routes

Both areas remain **9.6/10**. A tracked fall now retains its physical height,
start clock, duration and landing identity beyond reloads. Falls through
150 feet are immediate; longer falls take one full round through 600 feet,
then one additional round for each further 400-foot interval. Damage-distance
reductions do not shorten physical descent. Out-of-turn falls use their actual
triggering Count, rather than the falling character's next turn or a global
round boundary. Noncombat falls follow game time.

Landing settlement refuses early damage RNG. One saved landing identity owns
the descent; competing results cannot repeat its damage. Completion retries
finish the timing receipt without rolling again, and unrelated Undo cannot
rewind the fall journal. A GC can record a catch before impact or review an
ended/changed clock with an actual source note. Already-started landing damage
keeps its saved height and recovery evidence. Existing retrospective landing
records remain available when no start was tracked.

Wire Fu movement now offers aerial and vertical routes, preserves ordinary
movement limits and identifies unstable endings. After confirming completed
movement, the player can start the physical-fall tracker. Token movement and
action expenditure remain table actions, as in the existing route checker.
Its already-implemented impact and stress reduction is unchanged.

Native Foundry exercised the actual start dialog, reload, refusal before the
triggering Count, a 160-foot landing with 16 actual damage dice, repeated
settlement retaining the same result, a three-round 1,001-foot descent, a
catch and actual GC timing review after combat ended. The completed run had
no browser errors or diagnostic failures. All **4,309** Node tests, **988**
fixture assertions and **265** layouts pass, together with schemas, lint,
formatting, bundling and copy checks.

The user confirmed that active expert effects finish their original duration
and consequences after qualification loss; a Mental Leap regression verifies
the retained boost and exhaustion while blocking new activations. The user also
confirmed that Delay keeps its own limits while other round modifiers share
the ten-Count cap, matching the retained behavior. The wider source audit,
remaining combat workflows and legacy histories still prevent a 9.9 score.

## Pass 49: Omni-Competent penalty reduction

Both areas remain **9.6/10**. Omni-Competent now reduces each skill-check
penalty separately using the confirmed magnitude ruling: −3 becomes −1,
with a minimum penalty of −1. Positive bonuses, purchased ranks and other
roll types are unchanged. Named-bonus stacking still selects the strongest
applicable morale penalty. Baffled/Incompetent continue to affect the skill
bonus separately from check penalties and synergy; missing-focus rank
calculations retain their own rule.

The change covers named PC checks, Knowledge, NPC skill rolls, current sheet
figures and individual plan-contributor modifiers. Conditions are decomposed
before reduction so unrelated penalties are not rounded as one aggregate.
Saved campaign policy includes the reduction, and source notes show original
and reduced values. Changing the quality during a roll requires review;
completed checks retain their actual result after the quality ends.

Native Foundry exercised actual PC, Knowledge and private NPC rolls. The PC
check recorded a −5 check adjustment separately from its −3 skill bonus;
the Knowledge check recorded −2 of check adjustments. The NPC's declared
−3 situation became −1. Saved results remained unchanged after removal of
the quality, with no browser errors or diagnostics. Regression cases cover
odd penalties, independent rounding, ability/gear/misc modifiers, stacked
conditions, morale selection, conditioning and agreement between derived
figures and actual rolls. All **4,315** Node tests, **988** fixture assertions,
**265** layouts and **13** pack checks pass; schemas, lint, formatting,
bundling and copy checks also pass. Remaining source auditing and the combat
workflows listed in the backlog continue to prevent the requested 9.9 score.

## Pass 50: visually verified equipment corrections

Both areas remain **9.6/10**. Direct inspection of the supplied second-printing
PDF confirmed 42 field corrections across 40 weapon records. The Chief's Special
is **Caliber I**, printed page **256**, Table **4.40**; its previous Caliber II
and source reference were incorrect. This changes mission-pick eligibility.
The other 39 records contained ammunition-caliber text inside their damage
fields. Their fields now contain the printed damage expressions. Dice, flat
bonuses and genuine AP annotations are retained; the existing parser already
excluded caliber metadata from arithmetic.

Independent source fixtures now record these verified values and PDF page
references. There are 68 weapon correction anchors in total, including earlier
corrections. The catalog regression rejects caliber text in damage fields.
Native Foundry loaded the rebuilt Chief's Special as Caliber I and a backup
revolver. Actual damage rolls from rebuilt M16 and AW Covert entries produced
**4d4** and **2d6**, respectively, without browser errors or diagnostics.
All **4,315** Node tests, **988** fixture assertions and **13** pack checks pass;
schemas, bundling and copy checks pass. The preceding 265-layout pass still
applies; this pass changes data and source fixtures only.

The broad equipment source comparison remains unfinished. Both supplied text
extractions have wrapped and merged table cells; an unmatched row or extraction
disagreement is not evidence of a data bug. Disputed values require PDF layout
inspection. Complete the remaining weapon/armor comparison and origin/feat
mechanics audit, then reassess the scores alongside the open combat workflows.

## Pass 51: missing free origin Resource benefits

Both areas remain **9.6/10**. Privileged and Rescuer previously offered no
executable path for their once-per-mission Caliber II legal-immunity and
medical-assistance Resource picks. Both now appear in the Request workflow,
bind the exact approved Resource and consume one independent mission use.
They need no Reserve allocation and spend no Reserve pick. The confirmed
ruling permits their fixed Caliber II benefit in any mission. The normal
Shaken surcharge still applies after the base action-die waiver.

These benefits do not create a Request check, die or numeric check total.
Their chat action resolves delivery through the existing journaled settlement,
retaining actual dice and providing GC recovery for an interrupted result.
Posting refusal before delivery restores the unrolled ability use; duplicates
cannot consume another benefit. A claimed Resource keeps its acquisition
receipt, spends no mission pick and survives later Reserve allocation.
The legacy Talent spelling is recognized without changing an item's identity.

Native Foundry exercised both actual forms, the translated delivery control,
actual delivery dice and claims. Each used its mission allowance once, rolled
no Request dice, retained one delivery Roll after retry and left all eight
Reserve balances at zero. Duplicate requests were refused. The completed run
had no browser errors or diagnostics. All **4,321** Node tests, **988** fixture
assertions and **267** layouts pass; schemas, lint, formatting, bundling and
copy checks pass. The Omni condition fixtures now use the actual Shaken-grade
field, keeping their morale-source assertions meaningful.

The remaining origin/feat and equipment audit is still open. This work also
identified earlier delivery RNG in the other automatic Request paths, before
their acquisition reservation; those paths still need durable-result review.

## Pass 52: automatic Request reservation and interrupted delivery

Both areas remain **9.6/10**. All automatic Request benefits now reserve their
actual source, period, use and acquisition before random delivery. Immediate
benefits create no Roll. Other automatic benefits post a delivery action without
inventing a Request check or numeric check result. The frozen source survives
later qualification changes, while mismatched sources and periods are refused.

Native Foundry completed a Soldier 1/Advocate 2 with all three skill budgets
spent legally and no remaining setup tasks. Behind the Scenes reserved its
benefit before RNG, survived reload, rolled delivery once and claimed one
Resource. A second case lost the delivery response after the actual roll;
following reload, the actual GC dialog recorded that captured total with a
review note. The saved constant Roll and receipt proved recovery without new
random dice. Retrying spent neither another use nor another Reserve pick.
The recovery action waited for an abandoned startup bookkeeping lock to expire;
no foreground lock was automatically removed. The completed run had no browser
errors or diagnostics.

All **4,324** Node tests, **988** fixture assertions and **267** layouts pass.
Schemas, lint, formatting, bundling and copy checks pass. Four distinct complete
native PC builds now have evidence. Remaining named Resource restrictions,
equipment and feat auditing, legacy histories and combat gaps remain open.

## Pass 53: Political Request option, Power Rating and cost

Both areas remain **9.6/10**. Source review on printed p.204 found that only
Political Clout waives the Request action-die cost. Favors and Immunity now pay
the normal Caliber cost, with ordinary Shaken surcharges and shared funding.
All three still skip the check and delivery wait. Each now requires its named
option and GC confirmation; the two Resources require Power Rating 6.
The saved acquisition binds the option and rating, and a claim with a different
rating is refused. Custom Resource records receive the already declared rating.

All **4,324** Node tests, **988** fixture assertions and **267** layouts pass,
including paid automatic settlement, wrong-option/rating refusal, exhausted
funding, a zero-cost Clout request and no random dice for immediate delivery.
Schemas, lint, formatting, bundling and copy checks pass. The live experiment's
initial stall diagnosis was incorrect: later saved-record inspection proved
that its form had completed. The test was waiting for item specifications during
claim. Pass 55 records the completed claim and the experiment's actual limits.

## Pass 54: special NPC typed damage and hazard threshold reports

Both areas remain **9.6/10**. Weapon damage now routes every supported special
damage type through the shared hazard rules for special NPCs, including stored
acid, exposure and fire state. NPC cold, heat and electrical damage uses the
same running totals and Fortitude-save reports as NPC weapon subdual damage.
Stress caused by lethal hazards now produces its actual Will-save report,
instead of a reminder to compare the total manually. The existing threshold
resolver handles these reports, including Shaken and knockout duration.

Source review also corrected typed armor piercing: cold and heat bypass
character DR, electrical AP equals the original damage, and the weapon handoff
retains automatic damage-type AP for its reduction. Shared subdual handling
applies these rules for agents too. The extracted helper preserves existing
weapon reports and agent ledgers. Duplicate typed-hit delivery is refused by
the target's existing application receipt.

Native grade-built special NPCs took fixed, actually recorded 14-point hits.
Cold, heat and electrical each retained vitality, stored 14 subdual and their
own exposure, and posted Fortitude DC 12. Laser lost 14 vitality, stored 3 stress
and posted Will DC 12. No browser errors or diagnostics occurred. All **4,326**
Node tests, **988** fixture assertions and **267** layouts pass; schema, lint,
formatting, bundling and copy checks pass. Standard-NPC typed damage, hazard
secondary-effect timing, Drained, broader resistance/ability coverage and the
remaining combat gaps still prevent the requested score.

## Pass 55: completing the native Political claim

Both areas remain **9.6/10**. Saved native records proved the actual Political
Clout form selected invitation, used its mission allowance once, reserved one
Security category Charisma pick, waived the base dice cost and created no Roll
or delivery delay. The follow-up supplied the GC-approved specifications that
the earlier test had left unanswered, then claimed the original acquisition.
The item retained its typed invitation receipt; neither the benefit nor Reserve
pick was spent again. The completed run had no browser errors or diagnostics.

This clone is not another complete PC build: resetting its creation-policy flags
and reallocating Networking left attribute/contact setup tasks. Those fixture
limitations do not establish a Freelance creation defect. The four previously
completed distinct builds remain the native completeness evidence. B-193 retains
the broader source audit and additional legal character choices.

## Pass 56: standard NPC sensory damage and durable hazard resolution

Both areas remain **9.6/10**. Bang and flash weapon hits now give standard NPCs
their actual Fortitude saves instead of treating the sensory hit as lethal
damage. Stress from their hazards now rolls the standard NPC Damage save and
updates its real track and condition. Saved campaign stress factors are applied
once. Damage-save execution and pure NPC status helpers were separated from
NPC skill registrations, preserving the established contributor/button order.

Hazard saves now reserve an actor-held record before any effects or secondary
dice. Concurrent delivery, lost responses and partial effects cannot replay the
save. A completed record repairs a missing card marker without reapplying the
outcome. An interrupted record requires owning-GC review: keep actual outcomes,
or release only after explicitly confirming both no effects and no dice.
Source changes and unauthorized reviews are refused. New hits wait for a pending
hazard review, and hazard resolution waits for pending hit applications. Generic
Undo preserves the resolution records. A refused final transaction cannot report
completion.

Native standard-NPC bang resolution reserved its record before the actual stress
and Damage-save dice. An injected loss after those actual effects left a durable
interruption; another application was refused. After reload, the actual GC review
dialog kept the verified outcomes without new rolls or track changes. The native
run also passed at 1280×720; the only diagnostic was Foundry's expected minimum
resolution notice. All **4,333** Node tests, **988** fixture assertions and **267**
layouts pass. Schemas, lint, formatting, bundling and copy checks pass. Remaining
standard-NPC damage types, typed secondary-effect timing, Drained, grapple and
the other documented combat gaps still need implementation and review.

## Pass 57: standard NPC damage kind, AP and secondary stress

Both areas remain **9.6/10**. Damage profiles now recognize every supported type
as a whole name, select subdual for cold/heat/electrical and recognize explicit
stress damage. Application uses the saved profile when no type/kind override
was supplied. Cold/heat/electrical always use their subdual rules; automatic
type AP applies to character DR, including standard NPCs. Acid and laser
conversion is refused before either source or target mutation. The shared form
explains these rules.

Standard NPC collision, electrical and laser Damage saves now add the source's
secondary stress from damage after DR/AP, with the actual separate Damage save.
An NPC already eliminated by the first save makes no additional stress roll.
Both dice and effects remain under the original target-held hit receipt.

Native checks used real DR 8 NPC quality records and an explicit +30 save
adjustment to isolate reduction arithmetic from elimination. Actual d20 saves
ran after the hit reservation. Cold/heat took 14 subdual, electrical 14 subdual
plus 3 stress, laser 14 lethal plus 3 stress, and collision with AP 3 took 9
lethal plus 2 stress. These are controlled workflow fixtures, not assertions
that a +30 adjustment is a printed NPC table value. No browser errors or
diagnostics occurred. All **4,337** Node tests, **988** fixture assertions and
**267** layouts pass; schema, lint, formatting, bundling and copy checks pass.
Standard NPC acid/explosive/vacuum/fire paths, typed critical/secondary timing,
Drained and the wider combat audit remain open.

## Pass 58: complete NPC type routing and original critical-hit context

PC creation remains **9.6/10**. Combat advances to **9.7/10**: supported typed
weapon damage now executes through the same hazard workflows for standard and
special NPCs. Standard acid, explosive, vacuum and fire now roll actual primary
and secondary Damage saves instead of leaving health application as a reminder.
Acid/exposure/fire state and subsequent type-specific saves use the existing
hazard interface. Cold/heat/electrical share net subdual accounting with the
original DR column; exposure and electrical Count consequences use net damage.

A typed hit now freezes critical size, blast, incoming DR category and weapon
proficiency. Delayed acid/explosive/vacuum saves retain that context. Activated
criticals apply to special-character wounds and add the original automatic
failed saves for standard NPCs. Ongoing acid/fire ticks receive no new critical
activation. Invalid context or fractional damage/DR is refused; unowned lethal
damage cannot change health. A zero-point vacuum impact no longer creates new
damage dice. Failed agent-ledger writes stop the typed workflow rather than
claiming that an unapplied event succeeded.

Native checks used actual first-save and Damage-save dice for all four remaining
standard-NPC chains. A delayed acid critical retained size 2 after the actual
successful Reflex save: its remaining 4 damage produced two automatic failures
and death on a standard NPC; a special NPC retained 75 vitality and lost 4
wounds (26 to 22). Native cards retained the complete original hit context.
No browser errors or diagnostics occurred. Controlled +30 standard-NPC save
adjustments isolate ordinary damage arithmetic; they are not printed table
values. All **4,343** Node tests, **988** fixture assertions and **267** layouts
pass; schemas, lint, formatting, bundling and copy checks pass.

The increase reflects executable typed damage/criticals and durable resolution
across both NPC health models. Drained, typed secondary-effect/recovery timing,
remaining resistance/ability interactions, grapple, cover and coordinated-action
gaps still prevent 9.9. Character source/gear audits and additional complete
native builds remain necessary for the creation score.

## Pass 59: Animal Partner construction and special-character health

PC creation remains **9.6/10** and combat **9.7/10**. The Animal Partner creator
used the animal NPC type and special health table, while combat classified that
same creature as standard. Shared classification, spend context and Wire Fu
scope now recognize its actual derived owner link. Ordinary and typed hits use
vitality/wounds; standard Damage saves are refused. The animal type is retained.

The creation path also inherited human INT and ordinary equipment picks, making
its XP reward unverifiable. It now starts with animal INT 2 and no ordinary
equipment picks. Trained qualities remain actual GC choices. An uncomputed XP
reward produces a review warning. Manually entered partners retain special
health and explicitly require XP review instead of silently passing validation.

Native Foundry used a complete Soldier 1/Advocate 2 owner variant with a legal
Survival 4 purchase and Animal Partner in its career-level-3 feat slot. Its
20/20, 6/6 and 6/6 skill budgets and recorded creation policy persisted, with no
setup tasks. The actual companion creator produced an animal; two selected
trained qualities yielded verified XP 5 against allowance 40, without warnings.
An actual 2-point hit reduced vitality from 4 to 2 and retained 14 wounds, with
no standard Damage save. Manual-profile review and Wire Fu classification pass.
The run had no browser errors or diagnostics. All **4,345** Node tests and **988**
fixture assertions pass, as do schema, lint, formatting, bundling and copy checks.
This is additional feat-choice evidence for an existing complete class build.

Size-dependent Wolf Pack Mastery/Evasion delivery and broader companion ability
and owner-funding behavior still need review. They are not claimed complete by
the corrected health and XP workflow.
The free origin paths added here use deferred, journaled delivery instead.
Neither score yet meets the requested 9.9 target.

## Pass 60: Companion size benefits and frozen Reflex damage policy

PC creation remains **9.6/10** and combat **9.7/10**. Animal Partners now derive
their free size benefit: Small or smaller receives Evasion I; Medium or larger
receives the canonical Wolfpack Mastery benefit without buying another feat.
Unknown Size requires GC review. A temporarily unreadable owner retains the
saved Threat Level and special health, with an explicit review warning. New
partners do not follow mission Threat Level.

Acid and explosive Reflex saves now declare their damage-reducing purpose and
settle against the Evasion policy recorded when the actual save was rolled.
Successful Evasion avoids impact; Evasion II halves failed-save impact, with
ordinary flat-footed restrictions. Earlier acid remains; explosive stress and
the separate Fortitude save remain. Receipts seal the original Evasion policy,
and legacy completed receipts can still repair their cards without replay.
Unrecorded old Reflex policies require GC handling instead of silently using
current abilities. Save-dialog omission of a disabled source checkbox cannot
remove the known damage-reducing purpose.

Native Foundry verified a complete owner and its existing legal partner at both
Sizes, including an actual successful acid save (19 against 2). Changing Size
between rolling and applying preserved Evasion and prevented damage. Removing
and restoring owner readability preserved health and cleared the review warning.
The Small build had verified XP 2 against allowance 40 with no build warnings.
The run reported no browser errors or diagnostics. The full suite passed all
**4,349** tests; the additional actual-save regression also passes. Focused
coverage includes failed/flat-footed Evasion, secondary explosive effects,
receipt-policy tampering and legacy receipt repair. Schema, lint, bundle and
copy checks pass. Broader companion owner funding, recovery timing, source-data
comparisons and the remaining backlog still prevent either 9.9 score.

## Pass 61: Acid armor coverage and independent protection

PC creation remains **9.6/10** and combat **9.7/10**. Typed weapon damage now
reads the actual equipped body armor's coverage and rolls the acid coverage die.
A clothing hit bypasses worn armor while retaining the correct natural/class
maximum, independent feat protection and applicable class defenses. AP is
applied to that remaining protection. Armor-training bonuses disappear with the
armor. Explicitly removing armor uses the non-armor amount and retains a clear
next-Count action/unequip instruction. Standalone declarations cannot silently
discard unknown non-armor DR, use fractional actions or remove armor for free.
Item Damage saves and action expenditure remain table responsibilities.

Native Foundry equipped an actual Corrections vest, rolled coverage 1, and
captured DR 3 after AP 1. The actual Reflex result 13 halved six damage to three;
the captured protection stopped it, retaining 36 vitality. Regression coverage
also proves a clothing hit retains natural/independent DR after AP, and validates
armor removal before any dice. All **4,353** Node tests and **988** reference
assertions pass. The golden update was checked across every row: only the armor
fingerprint changed, for the added coverage field. Schema, lint, formatting,
bundle and copy checks pass; the native run had no errors or diagnostics.

Continue with initial fire scarring/recovery timing, orphaned hazard recovery,
broader NPC resistance delivery and the outstanding source-data/build audits.

## Pass 62: Interrupted hazard review survives source deletion

PC creation remains **9.6/10** and combat **9.7/10**. Owning GCs can now review
interrupted hazards from both character sheets. The list shows the saved hazard
and identifies missing source cards. Review uses the original card when present;
after deletion it uses the actor-held evidence, records that the source was
missing, and closes only the receipt. Keeping never replays effects or dice;
release still needs explicit no-effects/no-dice verification and a GC note.
Players and non-owners cannot use this correction.

Native Foundry created a failed sensory save with two actual secondary dice,
injected a response loss after effects, deleted the source, and reloaded. At
1280×720 the NPC sheet's actual review button was reachable. The actual GC
dialog retained the existing track and saved a completed receipt with missing-
source evidence, without recreating the card. The only diagnostic was Foundry's
minimum-resolution warning. All **4,356** Node tests pass, including missing-
source keep/release, player refusal and normal-card sheet review. Continue the
remaining hazard mechanics, resistance delivery and source/build audits.

## Pass 63: Prepared resistance reaches typed lethal and sensory damage

PC creation remains **9.6/10** and combat **9.7/10**. NPCs now prepare survival
resistance totals from their quality benefits and relevant feats, respecting the
quality/gear maximum and independent feat additions. Unclassified custom types
and more than eight quality applications require GC review. Typed lethal damage
subtracts resistance after DR, for both NPC health models and agents. Bang and
flash reduce their effective save DCs before rolling. Complete protection avoids
unnecessary saves and negates accompanying effects. Acid, explosive and vacuum
pending saves retain original resistance alongside their saved hit policy;
unrecorded legacy policies require GC handling rather than current-policy replay.

Resistance can stop new acid persistence, explosive stress/stun, vacuum exposure
and fire ignition. Ongoing acid and fire use current resistance, count only damage
getting through, and end when resistance negates that continuing damage. A new
fully resisted acid hit leaves earlier acid unchanged. Partial resistance retains
the remaining consequences and standard-character actual Damage saves.

Native Foundry verified 14 cases: acid, explosive, vacuum, fire, laser, bang and
flash on standard and special NPCs. Each used a real eight-point resistance
quality. Pending acid/explosive/vacuum results survived removal of that quality
before settlement. A failed standard explosive Reflex save produced three lethal
and one stress damage plus the separate stun save; successful special Reflex
damage was fully resisted with no follow-up save. Vacuum took six damage after
resistance, fire three, and sensory save DCs became six. Standard Damage saves
used an explicit QA-only +30 adjustment to isolate damage accounting; first saves
used their actual normal modifiers and dice. These are controlled combat cases,
not additional complete PC builds. No browser errors or diagnostics occurred.

All **4,361** Node tests and **988** reference assertions pass, with schema,
lint, formatting, bundling and copy checks. Cold/heat/electrical and ordinary NPC
stress/subdual resistance still need delivery; initial fire totals, broader
recovery timing and the remaining source/build audits remain open. Neither area
meets 9.9 yet.

## Pass 64: NPC stress/subdual resistance and pre-roll validation

PC creation remains **9.6/10** and combat **9.7/10**. Standard NPC Damage saves
now apply prepared stress/subdual resistance after campaign adjustment and DR
already applied by the incoming hit. Full protection creates a no-save report,
including critical hits, without changing the Damage-save track or rolling dice.
The returned net amount drives typed exposure and electrical consequences.
Special NPC running totals use the same resistance ordering; their subdual DR
leaves one bruising point before resistance, with unresolved critical bruising
requiring GC review. Fully resisted cold/heat/electrical subdual does not create
new exposure or follow-up saves. Their type-specific resistance is still open.

The standard Damage-save controller validates damage, bonus, critical size and
boolean circumstances before RNG. The manual form now states that prepared
stress/subdual resistance is applied here. Campaign adjustments apply once and
precede resistance, including caller-supplied already-adjusted stress.

Native Foundry verified eight combinations of standard/special, stress/subdual
and full/partial resistance. Full six-point critical hits against resistance 8
rolled no dice; partial fourteen-point standard hits rolled exactly one actual
Damage save. Stress ignored DR and became ten after resistance 4; subdual used
DR 3 twice, then resistance 4, leaving four. Special totals matched those values
without losing vitality or wounds. Standard saves used an explicit QA-only +30
save adjustment. The run reported no browser errors or diagnostics.
All **4,366** Node tests and **988** reference assertions pass, with schema,
lint, formatting, bundle and copy checks.

Continue type-specific cold/heat/electrical resistance and standard-character
bruising when DR stops a hit; the latter remains inconsistent with the corrected
special-character path. Other documented recovery/timing and source/build audits
still prevent the requested 9.9 scores.

## Pass 65: Type-specific subdual defenses and a complete Test Subject

PC creation remains **9.6/10**; combat rises to **9.8/10**. Cold, heat and
electrical damage now applies its specific resistance as well as ordinary
subdual resistance after AP and doubled DR. Agent ledger requests retain the
damage type and original defense proof, reject changed defenses before commit,
and preserve completed events across later gear changes. Both NPC health models
use the same ordering; full protection prevents exposure and accompanying saves.
The prepared Not the Face DR increment is accepted when validating a real
incoming subdual event instead of rejecting an otherwise consistent defense.

Standard NPCs now resolve the one-point subdual bruise from an ordinary injury
fully stopped by DR, with subdual resistance afterward. Unresolved critical
bruising that survives resistance requires GC handling before a save is rolled.
Typed lethal hits stopped by DR still need alignment; this pass does not claim
that remaining case complete.

Native Foundry verified twelve legal standard/special NPC builds across cold,
heat and electrical damage. Their resistance qualities used at most eight total
applications. Full critical hits rolled no dice; partial hits left eight subdual
and correctly tracked exposure. Standard electrical damage additionally rolled
its actual stress Damage save. Two more native cases proved ordinary lethal
damage stopped by DR produces a one-point subdual Damage save, while resistance
1 prevents that save without RNG. Those runs had no browser errors/diagnostics.

A Brainy/Test Subject Scientist 1 variant also reaches Play with **36/36**
attribute points, **52/52** skill points, legal contacts, and no setup tasks. Its
two actual origin choices prepare cold/electrical resistance 4. Replacing the
Researcher allowance correctly required a rank-1 contact instead of rank 2.
At 1280×720 Play and the complete build survived reload. An actual three-point
cold hit recorded zero damage; six electrical damage recorded two subdual with
the origin's source proof and correct exposure, leaving vitality/wounds intact.
The only diagnostics were Foundry's expected minimum-resolution notices. This
adds an origin-choice variant, not a fifth distinct complete class build.

All **4,370** Node tests and **988** reference assertions pass, as do schema,
lint, formatting, bundle and copy checks. Remaining source/data audits constrain
PC creation's score. Continue typed lethal bruising, initial fire totals,
injury/recovery timing and Drained, alongside the existing broader backlog.

## Pass 66: Independent weapon-table audit and usable source annotations

PC creation rises to **9.7/10**; combat remains **9.8/10**. All **455** entries
from the main weapon tables now have an independent second-printing comparison
of nine stored fields: Caliber, damage, error/threat, ammunition code, Size/hands,
qualities, recoil, base range increment and weight (**4,095** comparisons).
Wrapped model names, shared caliber headings, alternate E/T punctuation and
footnote-derived damage types were resolved against the PDF, with rendered-page
checks for ambiguous cells. Reference fingerprints retain mechanical evidence
without adding source extracts. They require checking the source before changes.
The three shield/arrow records outside these tables retain their older separate
reference coverage. Broader exceptional footnotes and equipment behavior remain
part of the continuing review.

Two genuine omissions were corrected: both Daewoo USAS-12 loads now offer
`10M4 or 20D2`, and eight raw explosive charges turn their printed footnote into
an explicit executable explosive damage type. Existing supplied-code choice and
stockpile calculations handle the alternative without granting extra ammunition.
Only the two outdated Daewoo cells changed in the older independent reference.

Native Foundry loaded rebuilt compendiums, selected the 20-round drum through
the actual weapon sheet, and calculated forty supplied shots. Actual dynamite
damage rolled exactly 3d12, totaling 19, without an attribute bonus. Applying its
card without a type override called the real explosive Reflex and Fortitude
saves. A successful Reflex result reduced vitality by nine, from 75 to 66.
The run reported no browser errors or diagnostics; it is a controlled gear test,
not an additional complete PC build.

All **4,373** Node tests, **988** engine reference assertions and **13** built-pack
checks pass. Schema, lint, formatting, bundle and copy checks also pass. Continue
the armor audit, broader feat/origin choices, compound damage types, initial fire
totals and the remaining injury/recovery rules before either 9.9 score.

## Pass 67: Both flash/bang components reach actual saves

PC creation remains **9.7/10**; combat remains **9.8/10**. A shared flash/bang
roll now delivers separate flash and bang Fortitude saves at the full rolled DC,
with each type's own resistance and immunity. The application saves each
component's delivery before moving on. Cancelling the second save leaves an
interrupted application for GC review; another Apply cannot replace either roll.
GC review displays component delivery and cannot release a hit with a delivered
component. This closes the catalog's sole shared-roll compound damage entry;
other separately rolled combinations still require separate applications.

Native Foundry used the actual packed grenade and actual saves against a complete
Scientist clone, a standard NPC and a special NPC. Rolled DCs 14, 12 and 8 each
reached both saves unchanged; all three failed flash and passed bang, leaving
Blinded without bang's conditions. Delivery evidence retained both original save
UUIDs. No browser errors or diagnostics were reported.

All **4,375** full-suite tests and **988** engine comparisons passed before the
final GC-release guard; its additional regression and the affected workflows
then passed in a **64-test** run. Schema, lint, formatting, bundle and copy checks
also pass. Continue the newly identified missing protective-gear records, typed
lethal bruising, fire totals and the remaining documented creation/combat gaps.

## Pass 68: Complete protective-gear profiles and source availability

PC creation rises to **9.8/10**; combat remains **9.8/10**. All 44 armor profiles
now retain thirteen independently checked table fields (**572 comparisons**).
The original 37 combat profiles matched. Seven omitted entries were added:
radiation and biohazard suits, four NBC levels, and the tactical shield. A further
29 availability dates disagreed with the printed tables. Source dates now live
on every armor entry; the obsolete estimated armor-date map was removed.
Existing compendium identities were retained and the new entries use existing
icons. The source fingerprints cover the entire expanded armor catalog.

NBC gear's +1/+3/+6/+10 bonuses now reach Primary Phase contagion saves. Radiation
and space suits supply +10 against primary radiation saves without requiring the
wearer to declare the same protection again. Secondary Phase saves receive
neither benefit; a declared suit cannot double its equipped bonus. Reserve and
unavailable armor do not supply protection. The actual armor sheet exposes both
bonuses for GC corrections. Included gas masks and air supplies have concise
reference summaries; their separate management still belongs to the GC.

Native Foundry equipped all eight relevant profiles on a Scientist clone and
rolled six actual contagion saves. The four NBC grades supplied 1/3/6/10 and both
radiation/space suits supplied 10, with the rebuilt dates and resistance values.
The NBC IV item sheet displayed its editable bonus at 1280×720, entirely within
the viewport. This is equipment evidence, not another complete PC build.
A separate attempted grade-built NPC gear test exposed that owned armor does not
yet feed its shared armor aggregate; address this before claiming NPC equipment
protection. Existing NPC quality-built defenses remain separately covered.

All **4,378** Node tests, **988** engine checks, **13** packed-data tests and
**267** layout cases pass, as do schema, lint, formatting, bundle and copy checks.
Only the armor column changed in 28 sample-engine fingerprints, reflecting the
corrected dates and declared equipment properties; other derived columns were
verified unchanged. Continue NPC equipment preparation, typed lethal bruising,
fire totals, injury/recovery timing and broader creation choices toward 9.9.

## Pass 69: NPC equipment reaches shared protection and penalties

Both areas remain **9.8/10**. Equipped NPC armor now prepares the same slots,
availability, training, defenses, resistances and Primary Phase bonuses used by
agents. Its Defense, Reflex and Speed penalties apply after grade/manual base
statistics, and skill checks can read the shared armor aggregate. Non-armor
quality DR takes its maximum against armor rather than being added twice; acid
can still read the protected character's separate non-armor DR. Training feats
are read through native document accessors and retain their selected armor type.
Removing a feat, choosing another type or unequipping/reserving armor removes the
corresponding benefits on the next preparation. Repeated preparation does not
accumulate adjustments. Slot and availability warnings reach the NPC sheet.

The model regression covers manual and grade-built standard/special/animal
characters, repeat preparation and removal. Native Foundry equipped all eight
protective profiles on a special NPC and verified six actual contagion-save
bonuses. Two further actual shotgun hits exercised standard and special health.
With quality DR 3 and Armor Basics (partial), the native vest gave melee DR 5,
ranged DR 3 and non-armor DR 3. Rolled hits 14 and 15 became 11 and 12 after
protection; the special NPC's vitality fell from 75 to 63. Unequipping the vest
restored quality-only DR. Both native runs reported no browser errors.

All **4,380** Node tests and **988** engine assertions pass. Schema, lint,
formatting and bundle checks pass; the previous **13** pack and **267** layout
checks remain applicable. Continue typed lethal bruising, initial fire totals,
injury/recovery timing, Drained and broader creation-choice evidence.

## Pass 70: Typed lethal bruising and protected secondary effects

Both areas remain **9.8/10**. Initial acid, collision, explosive, fire and laser
hits stopped by DR now leave the required one subdual bruising point. Agents use
their ledger; special NPCs use running totals; standard NPCs make their actual
subdual Damage save. Subdual resistance applies after the bruise, without taking
DR off again. A penetrating critical bruise still requires GC review before
mutation; fully resisted bruising requires no replacement dice.

DR-stopped acid adds no lingering exposure and protected fire does not demand a
new catch-fire save. Explosives preserve their explicit independent stress and
follow-up save. Evasion that prevents the incoming impact does not create a
bruise. Pending acid/explosive saves retain the original subdual-resistance proof;
changed resistance or a legacy save without that proof requires actual-outcome
GC review rather than silently applying current defenses.

Native Foundry verified ten controlled standard/special cases across all five
types, including actual acid/explosive saves and standard bruising Damage saves.
No lethal health was lost; protected acid/fire left no new exposure. An additional
Scientist clone wearing an actual vest recorded one collision bruise through the
real agent ledger without lethal or stress loss. No browser errors were reported.

All **4,382** full-suite tests and **988** engine checks passed; a final critical
bruise regression then passed with the **55** affected workflow tests. Schema,
lint, formatting, bundle and copy checks pass. Ongoing acid's DR/source tracking,
initial fire totals and scarring, wider injury/recovery timing, Drained and the
remaining creation-choice evidence still constrain the requested final scores.

## Pass 71: Initial fire damage, separate sources and durable scarring

Both areas remain **9.8/10**. Named fire sources now retain actual damage after
DR/resistance from the first exposure onward. Catching fire carries that initial
total into later rounds; different fires keep separate totals and a hotter new
fire uses its own history. Extinguishing, a successful catch-fire save and reload
preserve any scarring save already owed. Weapon fire cards supply stable source
identities; the standalone fire dialog can reuse a named fire. Source totals and
scarring actions remain available on both character sheets without an active
burning condition. Fire conversion is refused before applying a hit.

A scarring roll reserves its source before dice, reuses an existing card, retains
posted results after response loss and blocks uncertain replacements. Cancellation
before a roll releases the unused claim. Actual hazard outcomes remain guarded
by the existing resolution journal. GC correction records a verified total and
scarring outcome, rejects stale forms, and retains original dice evidence.
Legacy burning records preserve known totals but require review of the unknown
initial damage; no historical starting damage is invented. Delayed catch-fire
saves cannot recreate a source removed by an earlier correction or Undo.

Native Foundry used controlled manual NPC stat lines. An initial 25 damage was
retained despite a successful catch-fire save (57). The actual sheet action rolled
scarring once (63), duplicate requests reused that card, and the actual GC review
form saved its note. A separate failed catch-fire save retained the initial 12;
two later rounds reached 36. Extinguishing and reloading preserved both histories.
The scarring button ended at 483px in a 720px viewport. This run also exposed a
minimal legacy NPC-profile rendering defect: absent builder arrays/grades now
render without assigning new choices or changing manual combat values.

All **4,396** Node tests, **988** engine checks and **269** layout cases pass,
alongside schema, lint, formatting, bundle and copy checks. Continue ongoing acid
DR/source tracking, remaining secondary-effect/recovery rules, Drained and the
creation-choice evidence before either requested 9.9 score.

## Pass 72: Personal Lieutenant restrictions and original saved allocations

Both areas remain **9.8/10**. Personal Lieutenants now exclude class core
abilities, personal Wealth ranks and allowances, contacts, Interests, Subplots
and mission picks. The user's ruling resolves the contradictory Wealth wording
on p.204: the owner supplies all equipment. Gear Requests, free Resource benefits
and old pending deliveries cannot bypass that restriction. Saved allocations
remain available for GC correction, with explicit setup errors and owner access.
Ordinary class progression remains intact.

Lieutenants retain one starting action die. Ordinary awards, bonus pools and
their producers cannot grant extra dice, and old additional balances require
review before spending. Actual core-feature suppression also removes their core
grant paths. Early Origin-granted Personal Lieutenant is now accepted; normal
feat acquisition retains its prerequisite checks. A lieutenant cannot create
another companion through a prohibited feat.

The full pre-final-guard suite passed **4,397** tests and **988** engine checks;
nine focused companion cases also verify the final producer guards. Lint and
format checks pass. Advancement cadence, Career Level 0 readiness, companion
death/replacement safety and native lieutenant creation still need completion;
these remain reasons to withhold either requested 9.9 score.

## Pass 73: Captured lieutenant advancement and early Origin creation

Both scores remain **9.8/10**. A lieutenant now uses the owner's recorded Career
Level at feat acquisition for its initial level and subsequent two-level cadence.
For example, acquisition at owner level 7 produces lieutenant level 3 through
owner level 8, then level 4 at owner level 9. Under-level builds also receive a
setup task. New companions capture known feat history; unknown legacy history
requires the GC's review rather than a guessed acquisition level. The actual
review form preserves the existing class build and rejects stale links, invalid
levels and an owner without the active feat.

Known early Origin grants permit a Career Level 0 lieutenant with six vitality.
Such characters retain their real Origin-choice setup tasks instead of hiding
them behind the ordinary first-class prompt. Native Foundry verified a complete
Brainy/Playboy Scientist 1 owner and a complete 32-point Brainy/Celebrity level 0
lieutenant. Both had no remaining setup tasks. The actual GC history form repaired
an intentionally unknown acquisition record, and the build and review survived
reload at 1280×720. This is an additional Origin variant, not another class build.
Other early Origin feat/skill choices still need a separate review.

All **4,403** Node tests, **988** engine checks and **269** layout cases pass.
Continue companion death/replacement safety and the other recorded rules gaps
before awarding either requested 9.9 score.

## Pass 74: Companion loss, replacement and interrupted creation

Both areas remain **9.8/10**. Companion deaths now retain the original actor
and owner link. An owner-held intent precedes a single atomic balance/result
write. Concurrent or repeated clicks cannot charge twice. An uncertain debit
holds its slot across mission changes and actor deletion until the GC verifies
the actual outcome. Known losses release their slot next mission; Animal Partner
selections and the single lieutenant allowance still limit replacements.

Creation is serialized per owner, records its intent before creating an actor,
and binds a replacement to its original loss. Interrupted or missing responses
block further creation. The GC must find that attempt's actual actor, or explicitly
verify that none exists; a known candidate prevents a false cancellation.
Replacement history also makes an old death Undo warn before restoring another
surviving companion. Excess linked companions receive an explicit review notice.

Losses and both recovery forms provide sparse GC Undo. A review records the
verified present balance instead of replaying an uncertain debit. Stale forms
cannot overwrite a changed balance, loss, creation or replacement record. Missing
chat delivery preserves the durable result and does not charge or create again.

Native Foundry verified the actual death confirmation, Reputation 30→29, repeated
click protection, same-mission refusal, chat Undo to 30, then a replacement after
a controlled mission-epoch change. Reload preserved the charge, both actor links
and replacement receipt. A separate run injected creation-finalization and debit
delivery failures. The actual GC forms bound the existing actor and resolved the
pending charge; native Undo restored both original pending records, including
removing later review fields. The loss-review final control ended at 619px in a
720px viewport. Fourteen focused cases cover these workflows and freelance costs.

All **4,417** Node tests, **988** engine checks and **269** layout cases pass,
alongside schema, lint, formatting, bundle and copy checks. Continue Career Level
0 owner/Origin-choice cases and the recorded combat gaps before awarding 9.9.

## Pass 75: Explicit Career Level 0 creation and feat history

Both areas remain **9.8/10**. A GC setting allows Origin-only creation at Career
Level 0 while ordinary new characters retain first-class guidance. All actual
Origin choices remain in readiness. An explicit feat-history flag distinguishes
real level-0 acquisitions from legacy unknown levels. The browser, native item
creation, prerequisite snapshots, source timing, grant synchronization and later
advancement preserve that distinction. Candidate still requires acquisition at
level 1, matching its explicit prerequisite on p.208.

Training at level 0 retains five points without granting ranks above the table's
zero cap. The Skills tab states that allowance; the first class level applies its
recorded allocations once under the normal rank limits. Its feat text specifies
the purchase benefit without requiring an immediate purchase. No class history
or higher skill rank is invented for a classless character.

Native Foundry verified a complete 36-point Brainy/Researcher level 0 character,
including the actual GC creation checkbox, a chosen Training feat with recorded
level-0 eligibility, Science focus, Interests, contact and Wealth allocation.
It had no setup tasks, zero ranks and five retained Training points. Advancing
to Soldier 1 applied the five saved points and preserved the original feat history;
that later unallocated class build is not counted as another complete PC.
A complete Brainy/Playboy level 0 owner also created a complete 32-point
Brainy/Celebrity lieutenant 0. Both had no setup tasks. Owner level 1 retained
lieutenant level 0; owner level 2 produced the level-1 advancement task. Reload
preserved both characters' original acquisition records.

All **4,419** Node tests, **988** engine checks and **269** layout cases pass,
alongside schema, lint, formatting, bundle and copy checks. The golden comparison
adds only the new retained-Training field: every prior property of all 64 sample
agent/level cases is unchanged. The isolated catalog keyboard fixture now loads
the actual new rules dependency and passes. Continue ongoing acid protection,
secondary effects, Drained and remaining conditional creation-option auditing.

## Pass 76: Acid's minimum armor penetration

Both scores remain **9.8/10**. Printed pp.333–334 confirm that acid always has
at least AP 1. A generic or older damage profile could instead supply AP 0.
Profiles now show the minimum, and the final application enforces it before
capturing the damage receipt and pending save. Stronger declared AP remains.

Workflow tests now verify the corrected reduction through standard NPC Damage
saves, special/agent vitality, activated critical wounds and delayed resistance
changes. For the retained-resistance cases, damage 14 against DR 3 becomes 12
after AP 1, then 4 after the original resistance 8. The original resistance is
still used even when current gear changes. Explicit AP 0 is recorded as AP 1.

Native Foundry used a special NPC with natural DR 3 and no worn armor. A legacy
zero-AP card and explicit zero input produced a receipt with AP 1 and retained
DR 2. Its actual Reflex result of 17 halved six damage to three; vitality then
fell 75→74. All **4,419** Node tests and **988** engine checks pass, alongside
lint, formatting and bundle checks. The latest **269** layout cases and native
schema checks remain applicable; no layout or schema changed in this pass.
Ongoing acid still needs per-attack protection, timing and injury history.

## Pass 77: Independent acid attacks, armor saves and retained injuries

PC creation remains **9.8/10**; combat remains **9.8/10**. The acid workflow
now retains each original attack separately. Round damage uses its captured AP,
original contact layer, current declared post-AP protection and captured current
resistance. Actual armor Damage saves are declared before the character save;
a failed save or removed armor leaves non-armor protection intact. Equipment
corrosion and washing remain separately adjudicated on the affected item.

Each attack has guarded start/end/wash phases, a durable round intent before
health or secondary dice, and actual damage totals for its own 25-point injury
threshold. Washing to zero retains an owed Fortitude save. Its original save
claim survives lost responses; a repeated click cannot create replacement dice.
Legacy merged histories require explicit GC review and proof of one original
attack before further automatic damage. Closing unknown merged exposures does
not invent historical AP or roll an injury from their combined total.

GC correction and sparse Undo preserve unrelated action-die and ability use.
Changed armor during confirmation is refused before damage; resistance is frozen
when the round begins. Interrupted rounds block overlapping hit/hazard delivery
until the GC verifies the actual health, dice and source history. Old pure acid
helpers reject the modern compatibility summary instead of modifying a merged
exposure. Per-attack labels and equipment reminders appear on both actor sheets.

Native Foundry verified separate totals, real round damage, Undo, washing,
one original injury save after washing, actual GC correction and persistence.
Separate native armor runs used an equipped EOD suit with explicitly controlled
object-save bonuses: actual failing and passing object saves selected the
correct protection before actual Reflex and health changes. These bonuses are
test controls, not assertions about the suit's printed save bonus. No unexpected
runtime errors were observed. The correction form's last control was reachable
at 669.5px in a 720px viewport.

All **4,435** Node tests, **988** engine checks and **275** layout cases pass,
with schema, lint, formatting, bundle and copy checks. Continue Drained,
secondary-effect timing and the remaining conditional creation-option audit.

## Pass 78: Drained PC benefits, original career preservation and recovery

Both scores remain **9.8/10**. Printed pp.340–341 require forfeiting the newest
career levels and their benefits, with a floor of Career Level 1. Agents now
prepare a temporary reduced build. Their original advancement entries, owned
feat items and saved choices remain intact. GC-selected retained proficiencies,
focuses, fortes, Interests, contacts and Wealth allocations resolve acquisition
history that older records cannot establish. The ordinary engine computes the
reduced attacks, saves, skills, attributes, class features, active feats and
health limits. Grant synchronization cannot delete temporarily forfeited feats.

A changed owned build requires fresh GC review before checks or limited abilities.
Malformed imported counts remain loadable and have an explicit count-correction
form. Automatic advancement and career deletion are held while Drained; this is
a limitation requiring GC handling, not a claim that the book forbids advancement.
The live rules for new levels gained during forfeiture still need a reviewed
history model. Existing timed effects and item-supplied benefits require the GC's
separate review when confirming the temporary build.

Failed tier-five stress saves now enter the actual Drained review, with source
receipts preventing a second loss after interrupted settlement. Inconsistent
finished saves are refused before changing benefits. An open review cannot apply
an outcome after its original save or ledger changes. Older explicit manual
settlements remain supported.

Mission-end recovery reserves one original Resolve (Wis) check before RNG, at
DC 15 + 5 per lost level. Success restores one level; failure consumes that
mission's opportunity. The named recovery and final skill roll retain the same
identity. Lost posting responses reuse actual dice. Interrupted and earlier
mission attempts have GC outcome/release review; known dice cannot be released
as unused. Undo retains the original attempt and cannot permit replacement dice.
These writes preserve unrelated action-die and ability use. Normal pool tracking
maintains damage and spent dice when a maximum changes.

The check category is **provisionally Passive**, based on involuntary condition
recovery. The source does not expressly classify it; a question was sent and no
answer was yet received. This is an implementation assumption, not a user ruling.
Its category is saved with the original attempt. Passive handling requires a GC,
uses Wisdom, and prevents ordinary synergies, action-die boosts and taking 10/20.

Native Foundry verified actual retained-choice confirmation, active level 5→4,
vitality maximum 48→37, all five original career entries, all owned feats, grant
synchronization, a reachable final control at 669.5px, and reload. A controlled
+50 Resolve modifier produced an actual capped result 40 against DC 20. Original
settlement restored level 5 and maximum 48; Undo, reuse of the same roll and
settlement again retained exactly one original check. A separate native run used
actual Undo and a controlled interrupted-receipt state, then the actual GC review
form. Its last control ended at 637.6px; completion, review note and the original
career survived reload without new dice. Native testing found and fixed a missing
check-tag field and a missing identity handoff to the final skill roll; meaningful
integration tests now cover both boundaries. Resource refusal also stops before
RNG even when no reservation callback ran.

All **4,455** Node tests, **988** engine checks and **283** layout cases pass,
alongside schema, lint, formatting, bundle and copy checks. Standard NPC quality/
grade forfeiture, grade-built special characters and further conditional creation
cases remain before another score increase.

## Pass 79: Complete conditional skill build and fresh creation review

### PC creation: 9.9/10

The creation score increases under the existing assisted-core-play rubric. The
mandatory creation paths now have source comparisons, executable validation and
native complete-build evidence across attributes, Origins, base/expert classes,
purchased and bonus ranks, feats, training, Wealth, contacts and equipment.
The small remaining deduction covers unusual imported histories and exceptional
option/gear adjudication. It does not mean every feat's later use is automated.

A new native Gifted/Student Snoop 4 / Field Analyst 1 used the actual level-gain
API, actual vitality rolls and real feat creation at each acquisition. All five
career budgets are spent: 48 + 12 + 12 + 12 + 12 = 96 points, plus five separately
allocated Training points at Career Level 3. Its 36-point attribute purchase,
four flexible focus selections, proficiencies, Interests, contacts and Wealth
allocations leave no setup tasks or warnings. The actual Play control and reload
preserve that completed state.

Gifted's selected Athletics remains a class skill in every purchase row; its five
Training ranks have result cap 35. Analysis has eight ranks and threat 16 at
Career Level 5, matching Advanced Skill Mastery's base 18 and Gifted's two-point
threat adjustment. Field Analyst entry retains actual eligibility evidence. Its
Advanced Skill Mastery (Examiner) grant is active at Career Level 5, as its first
class feature explicitly provides, despite that feat's ordinary Career Level 6
prerequisite. Student's I Can Swim grant and all three chosen feats retain their
actual acquisition levels and the Snoop bonus-feat source.

The source review independently checked Gifted (p.19), Training (p.201),
I Can Swim (p.200), Advanced Skill Mastery (p.199), Field Analyst's first grant
(p.70), and the first-base/first-expert core-ability rule (p.28). Training's
one-point-per-rank exception also applies to cross-class skills; no extra cost
was introduced. I Can Swim explicitly requires spending the old balance before
another level; the implementation's deadline is correct.

Two native negative cases verify the actual advancement boundary. A Snoop 4
without Examiner cannot enter Field Analyst and gains no class item or level.
An I Can Swim character with one unspent point from level 1 cannot advance;
all original entries remain unchanged. These incomplete control clones are not
counted as complete PCs. An initially overspent attribute purchase and unassigned
flexible focuses also remained explicit setup tasks until corrected.

### Combat play: 9.8/10

Combat still needs its remaining Drained NPC handling and the recorded grapple,
cover and secondary-effect cases. Automatic advancement during Drained remains
held for GC review rather than rewriting the owned career. Recovery's category
remains the documented provisional Passive assumption pending a table ruling.

## Pass 80: NPC Drained profiles and the recovery rulings

### PC creation: 9.9/10

The score and complete-build evidence from Pass 79 remain unchanged. No owned
career, acquired feat or original NPC build is deleted to represent Drained.

### Combat play: 9.8/10

The source review checked the standard-character exception on p.341, stat and
named-skill grades on p.441, and NPC career level on p.452. Standard NPCs now
forfeit one GC-selected quality or owned feat and temporarily lower all seven
stat grades plus named skill grades. Grade I and Wealth None stay at their
floors; equipment Calibers remain separate. Dependent feats become inactive
through the existing prerequisite validator. The original items and profile stay
saved. Stable quality references distinguish repeated instances of a quality.

Special NPC losses lower only their effective career/Threat Level, stopping at
level 1. Shared mission Threat Level and the original profile remain intact.
Manual NPC statistics and class/Origin exceptions require explicit GC handling.
Construct immunity, missing sources, malformed histories, duplicate applications,
stale forms and interrupted writes have executable checks. The NPC builder edits
the original inputs while its results use the current temporary profile.

The user resolved both pending recovery questions. New Resolve (Wis) recovery
checks are **Active**, with ordinary eligible benefits. Existing attempts retain
their recorded category. PC recovery uses the actual skill options, including
eligible taking 10/20 with ordinary safety, error-range, Shaken and campaign
restrictions. Closing the context dialog before rolling releases only the
definitely unused claim; uncertain results still require GC review.

For standard NPCs, each Drained application counts as one recovery level. The
mission-end DC is 15 + 5 per current loss; success restores only the newest loss,
including its quality and grade step. Special NPCs regain one effective level.
Both use durable original-attempt records and the actual NPC skill bonus/result
cap. Taking a fixed result prevents action-die boosts. A successful manual or
exceptional restoration requires a GC attestation and source note. Failed checks
retain all losses. Corrections, Undo and repeat settlement retain original dice.

Native Foundry verified a standard NPC with two independent losses: original
grades VII remained saved, current grades became V and named skill IX became
VII. Repeated preparation did not compound penalties. An actual Active take-20
Resolve (Wis) recovery scored 34 against DC 25 and restored only the latest
quality and grade step. Undo returned to two losses; re-settlement reused the
same sole original result. Reload preserved one remaining loss, grade VI and
original grade VII. The actual application control was reachable at 669.5px in
a 1280×720 viewport.

A separate native PC review used the actual Active recovery skill dialog. Its
original result was 40 against DC 20, with ordinary action-die eligibility. The
complete five-level career remained owned beneath the temporary level-4 view;
recovery restored level 5 and vitality maximum 48. Undo and re-settlement reused
one result. The previously verified Passive attempt was not reclassified.

Validation: 4,476 Node tests, 988 engine fixtures and 291 layout checks, plus
schemas, lint, formatting, bundle and copied-text checks. JS/CSS warnings remain
at their existing caps. Combat stays at 9.8 pending the remaining NPC damage
handoffs, grapple limits/benefits, cover and secondary-effect cases. Automatic
advancement during Drained and manual item/timed benefits remain explicit GC
reviews rather than guessed changes to owned history.

## Pass 81: Special-NPC stress-to-Drained handoff

### PC creation: 9.9/10

The creation assessment remains supported by Pass 79's complete native builds.

### Combat play: 9.8/10

The special-NPC stress report now records its numerical tier and routes a failed
fifth-tier save into the actual NPC Drained review. Legacy reports with the
Drained outcome label use the same path. The handoff verifies the finished
original save again after the GC form, rejecting changed totals, sources,
ownership or outcomes. A cancelled review cannot silently complete the effect;
the existing interrupted-hazard review retains its original dice. The saved
source identity makes duplicate application harmless.

Native Foundry created an actual special NPC and posted 100 stress damage. Its
real Will result, 15 against DC 28, entered the GC Drained form. Completing that
form lowered actor-specific effective level 10→9 and Health-table vitality
60→54, while preserving all 100 stress, the original grade-VII profile and the
shared mission. Repeated settlement retained one application. Reload preserved
the loss and completed original save. The final form control was at 583.36px
within 1280×720. A separate active standard NPC's editor continued to expose its
original grade VII while its prepared current grade was VI.

Validation: 4,478 Node tests and 988 engine fixtures; lint, formatting, bundle
and copied-text checks pass. The prior 291 layout cases remain unchanged. No new
browser errors occurred. Continue the remaining grapple, cover and broader
secondary-effect review before increasing the combat score.

## Pass 82: Grapple limits, modifiers and NPC named-check penalties

### PC creation: 9.9/10

The completed creation evidence remains unchanged.

### Combat play: 9.8/10

The source comparison checked the crowd/benefit rules on pp.357–358 and the
damage-conversion rule on p.345. Opening settlement now validates the actual
other-grappler count against the acting character's Size-based limit: two on a
smaller target, four on an equal target, eight on a target one category larger.
Mixed Sizes still require the GC to check every participant. Existing hold counts
also matter: a second new hold requires the earned benefit and an existing held,
not pinned, opponent; a third new hold is refused before conditions or chat.

PC and NPC Athletics now apply the declared second-opponent penalty once, the
remaining Mute penalty, and the damage-conversion penalty. Holding two applies
to every Athletics use. Bludgeon and an actual available readied Club Basics
weapon use their existing conversion waivers. Missing, unavailable or illegally
gripped conversion weapons cannot supply a waiver. The posted roll retains the
applied circumstances and conversion direction, and checks for changed sources.
NPC named checks now apply the same armor/encumbrance and armor-vision penalties
as PCs. Omni-Competent adjusts each negative modifier separately.

The native review found a UI relevance bug: without Horde Mastery or Garrote
Basics, the escape-only Joint Lock field hid the entire grapple section. The
Athletics-wide holding-two context now takes precedence. New light/dark tests
verify that the section is visible for an ordinary grappler and stays available
when switching to Climb. Excess or unknown benefit selections are rejected
before an opening changes conditions. Damage guidance is per selected benefit;
Throw now adds at least +1 beyond standard unarmed damage even with negative
Strength, and requires an empty adjacent destination.

Native Foundry verified the actual PC skill dialog: base modifier 4 became −6
with the three declared penalties. An armored special NPC's named Grapple went
from 14 to 4 with the same penalties, including its actual −3 armor check
penalty. Both saved their original applied metadata across reload. The actual
opening form refused a fifth equal-Size grappler before Held changed, then
accepted a legal fourth grappler using the second-opponent benefit. With
Strength modifier −1, the actual Throw report showed +1 additional damage and
the opponent became sprawled and ceased being held. Final controls were at
682.78px and 669.5px within 1280×720. No browser errors occurred.

Validation: 4,487 Node tests, 988 engine fixtures and 293 layout checks, with
schemas, lint, formatting, bundle and copied-text checks passing. Continue NPC
named-check categories/condition restrictions, benefit damage execution, cover
penetration/blast routing and the broader secondary-effect cases before raising
combat to the requested score. Counts and manual grapple circumstances remain
GC declarations; no unseen combat relationship is inferred from a token alone.

## Pass 83: NPC check categories, conditions and original escape sources

### PC creation: 9.9/10

PC creation retains its completed-build evidence. The PC status aliases now
come from the same pure mapping as NPCs, preserving their previous meanings.

### Combat play: 9.8/10

The review found that NPC preparation exposed only Baffled and Incompetent to
shared condition rules. NPCs now expose the complete existing PC alias set,
including Held/Pinned, sleeping, paralysis, incapacity, senses and posture.
Standard-NPC elimination also exposes its dead/unconscious state. Original
effects and NPC profiles stay saved; repeated preparation does not alter them.

Named NPC checks now retain their actual Active/Passive/Secret category. Passive
checks are blind, GC-only and ineligible for action-die boosts. The active-check
campaign rule is honored, while a previously reserved Drained attempt keeps its
saved category. The NPC-specific GC boost path also checks action-die permission
and the rolled method before payment or RNG; its earlier bypass is closed.

Shared rules now enforce legal actions and skill tags before rolling: sleeping,
incapacity, purely mental actions during paralysis, Held/Pinned escape limits,
Bound/Hands-On/Grasp, Mute/Language and Nauseated/Concentration. NPC checks apply
the existing Sickened, Drunk, entanglement, style and related check penalties,
with Shaken combined once through morale handling. Named sight/hearing checks
use the shared blinded/deafened modifiers and result caps, including a sleeping
NPC's Vision checks. Explicit one-hand, language and sensory declarations use
the same existing rule helpers as PCs. Changing relevant conditions, category,
skill bonus or restraint sources invalidates the pending context.

Held/Pinned NPCs now receive the actual opposed Athletics escape choice. Its
proficiency, Size difference, error range, required full actions and current
effect sources are recorded on the roll. The existing release workflow removes
only those original sources and records the immediate Escape Hold move. NPC
preparation preserves interrupted-release review and pending-move guards, and
the NPC sheet exposes escape, movement confirmation and GC review controls.

Native Foundry verified that Held blocks an ordinary NPC Grapple and weapon
attack before a roll. The actual escape form recorded a +4 Size bonus, one full
action and its single original hold source. Its real result, 35, earned the
confirmed escape benefit. Release cleared Held and recorded a required 5–30-ft.
move; another active check was blocked until the actual movement confirmation.
Reload preserved the completed move and no remaining hold or pending movement.
Both final controls fit 1280×720, at 669.5px and 559.19px.

A sleeping NPC's actual Notice/Awareness card remained Passive and blind, with
action-die permission false, the −8 sight modifier and −20 cap adjustment. Active
checks were blocked while asleep; Stunned also blocked the passive check. A
separate native review verified that the saved passive card exposes no GC boost
control and its actual boost API refuses without changing the original result,
messages or GC pool. A legacy open take-20 context is also refused, while an
ordinary active NPC card remains boostable. No browser errors occurred.

Validation: 4,499 Node tests, 988 engine fixtures and 303 layout checks, plus
schemas, lint, formatting, bundle and copied-text checks. The broader source
review identified the remaining NPC proficiency/conditional Defense questions
recorded in B-256. Continue that work and the remaining B-186/B-190 cases before
raising the combat score; the newly shared context is not itself evidence that
all NPC derived statistics already incorporate every condition.
Continue implementing and reviewing combat before completing this goal.

No product code changed during this pass. The existing **4,455** Node tests,
**988** engine checks, **283** layouts and native schema/lint/format/bundle/copy
checks remain applicable. The additional native creation, persistence and
negative advancement cases passed without unexpected runtime errors.

## Pass 84: NPC proficiency sources and vulnerable Defense

**PC creation: 9.9/10. Combat: 9.8/10.** The score stays unchanged while
known condition-stat and benefit/cover cases remain under review.

The source review confirmed that ordinary NPCs are proficient with their carried
weapons (p.452), Non-Combatant removes that assumption (p.449), and Augmented and
Natural Attack retain their own proficiency exceptions (pp.446,448). Quality
Details now identify the actual uniquely named owned item; unresolved or duplicate
built-in choices require GC review rather than granting an invented exception.
Attack penalties, error ranges, Finesse damage and the shared final weapon checks
use the same training decision. Posted attacks retain the actual source evidence;
changed or removed weapons are rejected while retaining the original dice.

NPC Defense now uses the shared vulnerable calculation (pp.341–342). Separate
saved other/dodge adjustments let positive dodge bonuses disappear alongside
positive Dexterity while retaining penalties and untyped adjustments. Both manual
and graded builds prepare repeatedly without accumulating the adjustment, and
removing the condition restores the original value. Build warnings are owner-only.

Native Foundry verified actual untrained and built-in attack cards on
Actor.iel1cnNBFO5rPDC8 (ChatMessage.TuK0BPKldOgPytal and
ChatMessage.WQBxde93PtD43BK4). An unknown built-in choice created no attack card.
Held reduced Defense from 19 to 12, removing Dexterity +4 and dodge +3; repeated
preparation was stable. Reload retained the original adjustments, source item and
Defense 19. The real adjustment control fit at 413.69px in a 1280×720 viewport,
after dismissing Foundry's known minimum-resolution notice. No browser errors.

Validation: 4,504 Node tests, 988 engine fixtures, 303 layouts, native schemas,
lint, formatting, bundle and copied-text checks. B-256 is resolved. The next NPC
condition-stat findings are tracked in B-257; continue those and B-186/B-190.

## Pass 85: NPC fatigue, movement and recovery

**PC creation: 9.9/10. Combat: 9.8/10.** Continue the blast/cover and grapple
benefit review before raising combat's score.

NPCs now project Fatigued/Exhausted Strength and Dexterity penalties from their
original scores, with earned Guts and the shared +6 resistance-save benefits
(pp.340–342). Native attribute effects remain included. Repeated preparation,
condition removal and effect removal preserve the original scores. NPC Edit
inputs retain source scores while Play and rolls use the current values, so
submitting another field cannot save a temporary penalty as a new base score.

PCs and NPCs now share the current movement projection. Healthy NPCs can use the
existing Run controller; fatigue, exhaustion, entanglement, posture, restraint,
blindness and incapacitation constrain movement consistently. Multiple Speed
halves still require the same explicit GC ruling as PCs, rather than guessing.
NPCs also use the existing idempotent fatigue application, ordinary rest/Drunk
recovery and repeated-exhaustion sleep workflows. Stored history and review
warnings remain visible; class-specific Mental Leap activation is unchanged.
A Conditions and movement disclosure offers the applicable NPC tools.

Native Foundry on Actor.eQI7nWpUmeJzjxh8 verified a legal 120-ft. Run, first
fatigue, duplicate application refusal, exhaustion and blocked Run, then repeated
exhaustion with Speed 0. ChatMessage.EddaAM9EmQ0gVGjX retained the real +6
resistance save; ChatMessage.MQV8S7U6AP7lm6Uw retained an actual 8-hour sleep
requirement. Repeating sleep preparation reused that requirement. Actual rest,
sleep completion and reload restored Dexterity 18, Speed 30 and Run permission
while retaining all three application records. Editing another sheet field while
fatigued preserved the original Dexterity 18.

A separate native effect cycle verified Dexterity 18 → 20 with an owned effect,
18 with fatigue, 16 after removing only that effect, and 18 after actual recovery.
Reload preserved the restored score and Run permission. Visual QA also corrected
the narrow pinned Health tile: it now spans the available row. The real condition
button was exposed to pointer and keyboard use in both themes at 1280×720,
ending at 489.5px; the pinned summary was 216.30px high. No browser errors.

Validation: 4,508 Node tests, 988 engine fixtures, 305 layouts, native schema
cleaning/preparation, lint, formatting, bundle and copied-text checks. B-257 is
resolved. B-186 and B-190 remain the next core-play review targets.

## Pass 86: Blast distances, cover and shared-token positions

**PC creation: 9.9/10. Combat: 9.8/10.** Continue the direct-cover and grapple
benefit paths before completing the requested review.

Missing, nonfinite, negative or coerced distances no longer become Ground Zero.
Blast application validates the complete target list before changing anyone's
health. It requires the selected shape and direct paths to be confirmed, offers
clear/blocked/breached routes, and records the cover and actual failed-save
declaration for a breached route (p.343). Intact character or scenery cover can
exclude a target; a failed cover save preserves the ordinary ring damage rather
than introducing another damage half. Geometry, numeric cover saves and contained
blast increases remain explicit GC adjudication, not fabricated dice.

Each reviewed proposal is appended under its own source-card key, with strict
relay validation of the computed ring damage. Original review records survive
later proposals. A source result/increment changed while the form is open is
refused. Missing targets and invalid later rows are refused before earlier rows
can receive damage. Several linked tokens sharing one actor now require an
actual position choice instead of letting the last outer-ring token overwrite
that character's distance. The dialog prioritizes scene/combat targets and keeps
off-scene fallback available when needed.

Native Foundry verified the real form against three special NPCs and an actual
12-point damage roll (ChatMessage.l6PZPzFuOORXGOEo). The clear path dealt 12,
intact cover dealt zero, and a GC-declared breached path one increment away dealt
6. The source roll, cone selection, three route records and health totals
28/40/34 survived reload. The wall began excluded and marked as blocking cover;
the GC explicitly reviewed the intact/breached save outcomes. These declarations
did not generate or replace cover-save dice. An invalid later target changed no
health, messages or application records. The real Apply control fit at 669.5px
in 1280×720; light/dark layout checks also passed. No browser errors occurred.

Validation: 4,515 Node tests, 988 engine fixtures, 307 layouts, native schemas,
lint, formatting, bundle and copied-text checks. B-190 now describes the remaining
direct-cover and map-assistance work, rather than the corrected blast omissions.

## Pass 87: Attack Triumphs and the cover-interception foundation

**PC creation: 9.9/10. Combat: 9.8/10.** The connected GC cover workflow still
needs implementation and native verification; its backend receives no new
workflow-completeness credit yet.

The source review found a separate hit-resolution defect: a 75+ attack could be
reported as a miss against unusually high Defense, contradicting the included
critical hit (pp.330–331). The resolver now retains at least one hit for a valid
single, burst, two-shot or autofire attack Triumph. NPC reaction records accept
that outcome. Raising Defense may reduce extra shots but cannot eliminate the
remaining Triumph hit; the UI and pre-spend guard stop an ineffective further
reaction before payment or dice. The card explains a hit despite higher Defense.

Native Foundry verified an actual 105 result against Defense 200 on
ChatMessage.WzPZSkivwbchtP5y, using a clone of the complete Pass-79 PC. It hit,
retained its included one-die critical, paid zero additional action dice and
survived reload; no target damage was applied. A dramatic-scene native review on
ChatMessage.X3S7rUjIJ78CRp5n (111) and ChatMessage.broKjlc1tUEEsIss (104) also
refused a useless boost without changing the GC pool or posting replacement dice.
The actual decision form finalized one hit, explained Triumph in both themes
and fit 1280×720 at 517.09px. No browser errors occurred.

The cover foundation now distinguishes direct and intercepted shots individually
(p.345), including a burst with direct hits and additional shots striking cover.
Total cover intercepts even an otherwise successful shot. Reviewed damage retains
the original card and amount, forbids invented increases, and keeps unreviewed
saves pending. A changed original attack is refused. A raised NPC Defense can
request an additional cover decision while preserving all original damage.

The user's ruling is preserved: an attack Triumph strikes cover critically and
still needs penetration to reach the protected character. The model distinguishes
that cover critical from a protected-target critical. The pending damage bridge
uses the existing once-per-hit reservation/history, retains its original basis
across later adjudication, and blocks early protected-target damage and mutation
of damage frozen for cover saves. The GC selection/review controls and complete
remaining-damage delivery remain B-190; they are not yet exposed by the resolver.

Validation: 4,526 Node tests, 988 engine fixtures, native schemas, lint,
formatting, bundle and copied-text checks. The existing 307 layout checks were
last run in Pass 86; this pass's changed NPC reaction form was verified natively
in light and dark at 1280×720. Continue B-190 and B-186 before completing the goal.

## Pass 88: Critical scope for intercepted attacks

Scores remain PC creation **9.9/10**, combat **9.8/10**. The user's further
ruling makes an intercepted would-hit shot a successful attack before damage,
allowing threat/error activation against its actual cover. Critical pricing now
uses that first contact's character type and role, preserving the protected
target's original context. Villain NPCs are correctly classified as special
characters by the shared target classifier. A cover critical is recorded on the
activation and original damage claim; delivery to another target cannot inherit
its critical damage or injury. Changing that scope invalidates open decisions.

Validation: 4,528 Node tests, 988 engine fixtures, lint, formatting, bundle and
copied-text checks passed. Connected cover controls remain the next B-190 work;
the new scope is not yet credited as a complete playable workflow.
