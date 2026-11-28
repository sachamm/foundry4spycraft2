# Older Spycraft worktree reconciliation

Reviewed 28 November 2026 against main `3722ca3`, after the completed rules
review was merged and pushed. Reconciliation branch:
`codex/reconcile-older-changes`.

## Result

No missing implementation needed to be copied from the older worktrees. Their
useful changes are already in main or have been superseded by later fixes.
Current main's behavior, generated language data, tests and packaging are
retained. Reapplying the old files would remove newer work or duplicate styles.

The licensing branch's intended changes already shipped in `c2abca8`
(`Ship license notices and soundtrack provenance in releases`, PR #46).
The reconciliation merge records `codex/license-notices` as integrated while
retaining main's tree. Its first-parent tree comparison is empty. This records
the reviewed branch without reverting verified provenance or release packaging.

## Scope and method

| Older source | Baseline / tip | Entries reviewed | Disposition |
| --- | --- | ---: | --- |
| `guided-play` working copy | `551f001` | 37 | Covered by current UI implementations and later improvements. |
| `readable-dialogs` working copy | `551f001` | 28 | Covered; includes shared files already reviewed in guided-play. |
| `ux-improvements` working copy | `551f001` | 17 | Covered; includes older versions of the same dialog and save helpers. |
| `codex/license-notices` | `828b68e` | 8 | Already delivered in PR #46 and subsequently extended. |

The 90 entries cover 44 distinct paths. For the three working copies, the
inventory includes both tracked edits and untracked source/test files; checking
only committed branch history would have missed them. The original checkouts
are preserved, and their content is checked against the comparison snapshots
before publication.

The comparison uses each worktree's original baseline, its edited contents and
current main. Both additions and removals were reviewed. Three-way conflicts
were treated as comparison evidence, not as instructions to replace main.
CSS declarations and language keys were also compared structurally so formatting,
expanded selectors and generated translations did not appear to be missing work.
Private snapshots and comparison output remain outside Git in the isolated
reconciliation runtime directory.

## Feature comparison

| Older intent | Current implementation and reason to retain it |
| --- | --- |
| Clear autosave feedback on agent, NPC, item and vehicle sheets | `module/sheets/save-feedback.mjs` is used by the current sheets. Main additionally waits for pending saves before list changes and keeps scroll position; the older classes would lose those safeguards. |
| Readable attack, skill and damage dialogs | `attack-dialog-ux.mjs`, `skill-dialog-ux.mjs` and `dialog-sections.mjs` already organize the fields. Main adds resolution guidance, shared configured-option counting and the newer rules context. |
| Browser keyboard selection, search and focus preservation | `module/apps/browser.mjs` retains selection and focus while refreshing only results. The old full-render and refocus sequence is superseded; reverting it would also remove year/Caliber filtering and creation validation. |
| Next setup action and Edit/Play controls | `templates/actor/agent-rail.hbs` and the current sheets already expose these controls. Main adds acquisition validation, source-specific setup tasks and save-aware transitions. |
| Guided chat results and resolving an outcome | `module/rolls/chat-guidance.mjs`, chat controls and damage application already provide this flow. Main uses current outcome labels, actual damage receipts, hidden-roll safeguards and pending NPC-defense handling. The older messages and receipt counting would regress those paths. |
| Searchable GC, NPC and vehicle tools | `module/apps/tool-search.mjs` and current callers already provide tool search. Main additionally matches multiple words, tooltips and authored terms, restores disclosure state and marks matching controls. |
| Readable text, large icon targets, visible keyboard focus and hidden sections | The current token and component styles cover these requirements. Main adds contrast roles for dark headers and broader focus/hidden selectors. The one clean three-way CSS candidate only duplicated existing autosave and attack-dialog rules. |
| Updated UI regression tests | The existing guided-play, readable-dialogs, UX and scrolling suites include the older scenarios and newer module imports, layouts and behavior. Older assertions use superseded wording or omit later cases. |
| Native language keys | No introduced non-generated language key is missing from main. Older generated `SPYCRAFT.Text` entries have been superseded by current extraction and language loading; copying them back would reintroduce obsolete strings. |
| Release license notices and soundtrack provenance | Main already contains the same MPL text and audio provenance files, release notices, source credit and packaging tests. Later commits add verified OGL notices, a bundled release and further notice tests. The older branch would remove these additions. |

The UI work is traceable through `a312a0a` and subsequent improvements including
`ab87a47`, `5ec1ec7`, `cec49a7` and `321d528`. Licensing follow-ups include
`a908393` and `2b53928`. These later implementations remain authoritative.

## Preserved older checkouts

The original three UI worktrees still contain their local edits. Those edits
are historical copies of work already represented or superseded in main, not
additional changes awaiting a blind commit or merge. No original checkout was
reset, cleaned, stashed, switched or removed. The licensing checkout is also
preserved; its committed branch is recorded as merged by this reconciliation.

## Validation

The reconciled branch was checked in its own worktree with a fresh pinned
dependency install and independently rebuilt packs. The build produced no
changes to committed generated files.

- All 4,781 Node tests and 988 independent engine fixtures passed.
- All 308 Playwright layout checks and 13 rebuilt-pack checks passed.
- Lint passed at the existing warning caps; formatting and bundle generation passed.
- Native Foundry schemas passed, including 80 NPC template/package systems,
  38 sample actor/companion systems, 36 RollTables and 638 TableResults.
- Syntax checks passed for all 1,190 JavaScript files and the system manifest.
- The required copied-text check found no prose match at its failure threshold.
- The 82 original working-copy entries still matched their saved comparison
  snapshots, and their original branch tips were unchanged.

The reconciliation contains the content-preserving licensing merge and this
comparison record. It introduces no replacement UI implementation, duplicate
styles, obsolete generated translations or runtime configuration.
