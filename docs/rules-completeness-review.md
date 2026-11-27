# PC creation and combat rules review

**Continuing review, 27 November 2026:** PC creation **9.4/10**;
combat play **9.5/10**. Implementation continues toward the requested **9.9/10**
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
