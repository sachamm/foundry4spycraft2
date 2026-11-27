# PC creation and combat rules review

**Continuing review, 26 November 2026:** PC creation **8.8/10**;
combat play **8.9/10**. Implementation continues toward the requested **9.9/10**
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

The next implementation work is campaign gear Caliber handling.
Remaining requirements also include Cakewalk Intel selections, other campaign
effects, the specialist combat options listed above, Grapple benefit settlement,
falling stress, special NPC conditions/damage, cover, durable trigger receipts,
source-to-data auditing and native creation/combat play-throughs. The backlog
remains the authoritative list. Work continues; neither score meets 9.9 yet.
