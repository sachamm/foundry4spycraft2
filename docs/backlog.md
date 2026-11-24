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
| `LR-` | Live review, 2026-11-22, row number in its summary |
| `SGI-` | The five inputs to the style guide, 2026-11-23 (`expert-gc`, `novice-gc`, `novice-player`, `rules-expert`, `seasoned-player`) |
| `JS-`, `HBS-`, `CSS-`, `WEB-`, `R-`, `J`, `H`, `C`, `W` + number | Code council, 2026-11-23 (the single letters are findings carried from the first code council) |
| `SG-` | A row of the style guide's former section 10 audit, with its old id (`SG-G2` was `G2`) |
| `RW-` | The old `remaining-work.md` (now [archive/build-notes-2026-11.md](archive/build-notes-2026-11.md)), by line |

The reports are kept outside the repository, in the project's `reviews/` folder (`council-gc-2026-11-24/`,
`live-2026-11-22/`, `styleguide-2026-11-23/`, `council-2026-11-23/`, `council-2026-11/`).

## Suggested order

1. **P0 table**, top to bottom. B-001 to B-006 are small and each fixes a wrong result a GC would hit in a first
   session.
2. **Run an NPC turn from the console** (B-020 to B-024) together with the tracker menu (B-025). Every reviewer in
   both councils and both earlier live reviews named this as the largest gap in play.
3. **Console safety and stability** (B-030 to B-036): confirmations, undo, keeping state across redraws.
4. **Dialogs** (B-040 to B-046), which share one fix: a dialog shows only the fields for the chosen option, names its
   action on the button and has Cancel.
5. The rest of P1 by area, then P2 when a surface is touched anyway.

## P0: wrong results, lost data, double payment

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-010 | **GC die DC boosts are never capped.** The spend dialog has no named DC, so the count of earlier boosts is always 0. Attach a boost to a named check and keep its remaining allowance. (pp.397–399, 424) | CX-E2, XGC-30 | M | code |
| B-011 | **Promoting a standard NPC does not reach the mission's XP.** The antagonist row keeps the standard reward. Link promotion and scenes appeared in to the antagonist record, with a manual override. (pp.398, 452) | CX-E3 | M | code |
| B-012 | **Reset on a standard NPC restores the sheet but leaves the combatant marked defeated.** Clear the defeat that the failed Damage save caused, and no other. | CX-E5 | S | code |
| B-013 | **Flanking +2 was added for an attacker 10 ft. away**, after the GC accepted "Target beyond Reach", and the card gives no way to remove it. Require adjacency before suggesting it; make it a chip the GC can untick. *GC to confirm.* (pp.176, 341) | XGC-19 | S | live |
| B-014 | **An NPC attack stopped half-resolved and showed a raw database error** (`_id [sc2ResourceLock1] already exists…`) with two GM clients connected. Catch the collision and retry once; never show the internal id; leave the normal Resolve button on the card. | XGC-06, LR-28 | M | live |
| B-015 | **Alt+B spends a GC action die on whichever boostable card is newest**, including another GC's, and cannot be undone. Act on the card under the pointer or the last one this client posted, and say which before spending. | XGC-02, XGC-15 | S | live |
| B-016 | **Next turn can advance the wrong fight.** The console follows whichever combat is viewed and names neither it nor its scene; a combat with no scene shows on every scene. Name the encounter and its scene in the Combat header and warn when it is not this scene's. | UX-02, NGC-43 | S | live |

## P1: running the game

### Combat from the console

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-020 | **An acting-combatant block in the console's Combat section**: Defense, vitality and wounds or the damage track, conditions, half actions left, its weapon buttons and "Apply last damage". An NPC turn still crosses the console, the map, a sheet and chat. | DES-02, XGC-07, UX-18, NGC-33, CX-D5, CX-E10, SG-G2, LR-25b, SGI-expert-gc D1 | L | live |
| B-021 | **Combat rows become buttons**: click pans to the token and opens the sheet; the row shows Count, half actions, conditions and "Defeated" as a word, not a strikethrough. Before initiative the row must not read "— Count" with nothing after it. | DES-03, DES-43, CX-U5, CX-E10, SG-G2 | M | live |
| B-022 | **A tool for a mob**: act for a group of identical standard NPCs in one step (one attack roll each against chosen targets, one Next for the group), and make the mob readable on the map (numbered names, a bar). | XGC-08, XGC-17 | L | live |
| B-023 | **Combat setup and end inside the console**: add the selected tokens, show unrolled groups beside Begin combat, End combat. Initiative buttons say who will be rolled and how they are grouped, report what changed, and are disabled with a reason when nobody needs a roll. A late joiner of a type already rolled joins that type's Count, or the GC is asked. | NGC-36, UX-14, XGC-21, CX-D4, CX-N5, CX-E9, CX-U8 | M | live |
| B-024 | **Keyboard shortcuts die after any mouse click on a button**, because focus stays on the button and Foundry then ignores keybindings. Blur after a sheet or card action. Alt+S straight after Alt+N opens the previous combatant's sheet; each Alt+S stacks another sheet. | XGC-01, XGC-12, XGC-07 | S | live |
| B-025 | **Fluid initiative**: show only the chosen event's fields (31 events in one flat list today), preview immediate against round-end movement, show the capped ±10 beside the raw sum, let the GC remove a mistaken event, clear a fulfilled Press, and do not offer the tool before combat starts. Check that automatic events are recorded when the combat is not the active one. (p.324) | UX-39, XGC-22, CX-D14, CX-N9, CX-E13, CX-U10, SG-D10 | M | live |
| B-026 | **Half actions**: count skill checks and movement, or say on the strip which actions are counted; warn before going over, not after; a pip says on hover what marked it; undo from the card. The over-budget toast tells a GC to "Check with the GC". | LR-8, SGI-rules-expert D15, SGI-seasoned-player R11, XGC-06 | M | earlier |
| B-027 | **A late initiative roller sorts above the current turn and loses round 1.** Insert them correctly for the current round. | LR-11 | S | earlier |
| B-028 | **NPC attacks cannot use Burst, Autofire or Suppressive Fire**: the NPC sheet never opens the ranged-attack dialog that has them. Same gap on the agent's Play tab. One attack control with the fire actions. | LR-17, SG-A17, UX-41 | M | earlier |
| B-029 | **Dramatic scene**: starting one is silent; scripted (free) and paid entries sit apart; doubling opponents' Initiative is a separate action that skips unrolled combatants. One place, a visible "Dramatic" state, a preview of who will be doubled, and late Counts covered. (p.424) | UX-10, CX-D13, CX-N8, CX-E14 | M | live |

### Console structure and stability

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-030 | **Every redraw loses the search text and keyboard focus, moves the scroll position about 200px and closes "More mission tools"**, and every console action redraws. One reviewer's real click hit the wrong control because of it. Keep open state, scroll, query and focus across renders; redraw only the part that changed. | DES-14, UX-34, NGC-02, CX-U7 | M | live |
| B-031 | **Prep and Play views.** The console is 1,700 to 3,000px tall in a 300px column, with ten sections of equal weight and eight filled primary buttons; Combat starts 382px down, under a help paragraph and the search box. Split Prep (mission, campaign, NPCs) from Play (combat, scene, dice) and Wrap-up (XP, standing, exposure); one primary per section; move the guide and search below Combat during a fight. | DES-01, DES-04, DES-05, UX-17, XGC-42, NGC-02, CX-D2, CX-U6, SGI-expert-gc R18 | L | live |
| B-032 | **A first-session checklist in the console** that ticks itself from state (record the mission, prepare NPCs, Begin session, Start mission, first combat) and links the quickstart. "What the system does for you" is two abstract sentences; drop it from the console. | NGC-01, CX-D1, CX-N2, SG-O2, SGI-novice-gc D22 | M | live |
| B-033 | **A status strip that answers "where am I"**: mission and its state, scene number and kind, round and whose turn, GC dice left of starting ("4 left of 7"), pending player requests. It repeats the clock today. "Scene" means both the Foundry scene and the scene period; the GC dice numbers disagree on one screen. | UX-09, NGC-06, XGC-29, NGC-10, SG-G6, CX-D15 | M | live |
| B-034 | **Tooltips**: 63 of 66 console controls get a generated tooltip; 30 repeat the label, 15 abbreviate it ("Surprise rd", "Fluid init") and 3 explain. They stay on screen after the control is pressed or redrawn and cover the next button. Write one line on what the button changes; never generate one from the label; dismiss on click and on redraw. | DES-15, UX-08, UX-24, NGC-05, XGC-40, SG-G9, LR-38a | M | live |
| B-035 | **The console and the chat log share one sidebar slot**, so the GC cannot see a tool and its result together. The pop-out is hidden, opens 720×800 over the map and uses the width for nothing. Make the pop-out obvious, give it a two-column layout and a remembered place; echo results (XP report, Planned XP, Begin session done) where the GC is looking. | UX-16, DES-25, DES-24, NGC-29, NGC-40, XGC-41 | M | live |
| B-036 | **Search finds sections, not tools, and misses the words people type** ("XP report" finds one section; "player request" and "disposition" find nothing). Add search terms per action, open nested matches, mark the match, give the field an accessible name. | NGC-03, NGC-04, XGC-39, UX-22, DES-21, CX-U7, SGI-novice-gc R1 | S | live |

### Safety: confirm, undo, feedback

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-037 | **Undo on every card that wrote to an actor**: applied damage, a standard NPC's failed save, a GC boost, a spent GC die. Keep the before-image on the card; Undo is the only control left on a finished card. Also let the GC override an outcome on the card and record it. | DES-45, XGC-15, UX-05, CX-U12, SG-C10, SGI-expert-gc R13 | L | live |
| B-038 | **Remove on a mission row is immediate, with no undo, 4px from Mark complete**; the icon buttons carry no row name and the "critical" toggle does not show its state. Named buttons, a visible toggle state, Undo after removal, danger styling on destructive actions. | UX-04, XGC-33, DES-08, DES-23, CX-U4 | S | live |
| B-039 | **State-changing buttons give no sign they finished**: Begin session, Next scene, Recalculate Threat Level, Apply starting-dice adjustments, dramatic scene. One GC-only line or toast each. | NGC-29, XGC-41, UX-10, DES-24 | S | live |

### Dialogs opened from the console

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-040 | **One dialog skin for everything**: 400px wide, a lone "Confirm", no Cancel, focus on the submit button with committable defaults (Enter commits something the GC did not choose), 22px inputs under the 36px token, Foundry's 1px focus ring. Name the action on the button, add Cancel, focus the first field, use the system ring, size to content. | DES-28, DES-31, DES-36, UX-03, UX-23 | M | live |
| B-041 | **Dialogs show every field for every choice**: spend dice 11 fields, complications 10, fluid 5, disposition 6. Show the fields for the chosen option only, and keep values when validation fails. | DES-29, NGC-13, CX-U9, SG-D10 | M | live |
| B-042 | **Spend dice does not state the cost before Confirm**, mixes daily spends with rare recovery tools, and some spends are bookkeeping only. One intent at a time with cost, pool before and after, and what the system then does or leaves to the GC. Explain once what GC action dice are for; there are two different ways to spend one. | DES-30, NGC-30, NGC-31, XGC-30, CX-D13, CX-N8 | M | live |
| B-043 | **Pickers list the whole world, not the scene**, and duplicate names cannot be told apart (the world has two each of several sample agents). Scene or combat first, then the rest; show folder or source beside the name. | UX-25, NGC-19, NGC-08, XGC-34, XGC-16 | S | live |
| B-044 | **Select options are sentences in narrow selects; dialog titles follow four patterns; internal identifiers and banned terms appear in GC dialogs.** Short labels with a detail line; one title pattern; plain words. | DES-33, DES-35, UX-26, UX-27, UX-07, DES-13 | S | live |
| B-045 | **Disposition**: the default action changes nothing; the dialog offers everything, refuses after it closes, and the GC cannot overrule. Task-specific fields, the current grade shown, the refusal inside the dialog, a GC override. | NGC-37, UX-06, CX-D16, CX-E15 | M | live |
| B-046 | **Dramatic Conflicts** start easily and then need the book open: step two of a chase is 33 controls in an 867px form, steps are a generic "Next step", totals are typed by hand, an irreversible step hides behind "Confirm", and two fields share one name. Named steps with Back, fields grouped per side, links to the source rolls, private strategy choice for players. Advantage effects other than Lead, Swap, Victory and Halt are reported, not applied; chained pairs and crashes are not modelled. | NGC-39, UX-07, CX-D17, CX-E16, CX-U3, RW-54 | L | live |

### Mission and campaign

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-050 | **One mission record per world, with no drafts, history, archive or export.** A GC cannot prepare the next mission beside the current one, and Clear wipes the only copy. Named drafts, an active run, completed snapshots, duplicate, export. (B-001 is the urgent part.) | XGC-31, CX-D10, CX-N11, CX-U15, XGC-35 | L | live |
| B-051 | **Entering a mission is one modal per line**: about 44 actions and 12 dialogs for 5 objectives, 4 antagonists and 3 complications. Objectives, antagonists and complications are not in Edit mission and rows cannot be edited. Inline add and edit in the list; paste several lines; drag an NPC onto Antagonists. | XGC-32, NGC-11, NGC-12, DES-07 | M | live |
| B-052 | **The mission record dialog is 1,989px of form in a 568px scroller**, with an unlabelled team list. Threat Level is never explained ("Threat Level 1 / 1"), has no preview and gives no feedback on Confirm. Show requested against applied adjustment. *GC to confirm* the Threat Level formula as labelled (pp.422–423) and the standing payout when a −2 adjustment cannot lower a Threat Level of 1 (pp.435–440). | NGC-07, NGC-08, NGC-09, DES-06, DES-32, UX-21, XGC-28, CX-E7 | M | live |
| B-053 | **Scenes are counted twice**: Next scene and "Count a scene played" raise the same tally, which skews XP per scene. Show which scene was counted, make the manual one a correction, ask about the final scene at wrap-up. (p.440) | CX-D3, CX-N4, CX-E8, XGC-44 | S | code |
| B-054 | **One wrap-up view**: earned XP with its breakdown, unresolved objectives, exposure and standing, each with the person, the amount and the balance before and after, and a settled state. Today an infraction debits at once, a complication counts as earned at once, and the XP report is a long chat message. | CX-D12, CX-N14, CX-E20, NGC-15, NGC-40 | L | code |
| B-055 | **Special NPC XP reads two ways**: the Antagonists list says 84 XP, the report adds 336 (×4). Show "84 × 4 = 336" in the list and say what the 4 is. *GC to confirm* the multiplier (p.452). "Record an antagonist" uses jargon and a preview that looks wrong. | XGC-27, NGC-14 | S | live |
| B-056 | **Season campaign qualities are 60 checkboxes, 4,634px of list in a 495px box**, with no search, no scope (season, mission, bought in play) and no word on which the system applies. The console prints internal effect names. Search, selected first, scope and "applied by the system / by hand" labels, links to the related world settings. | DES-34, NGC-17, CX-D11, CX-N15, CX-E17, CX-U16 | M | live |
| B-057 | **Changing Caliber leaves the GC dice out of step with no prompt.** When current and starting numbers disagree before a die is spent, show one line with the button that fixes it. | NGC-10, XGC-29 | S | live |

### NPCs

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-060 | **Add NPC to scene: the 12-row list is drawn 32px tall**, one row visible, because core CSS overrides the `size`. Four reviewers hit it. Enter on an empty search closes the dialog silently. | DES-27, NGC-18, XGC-10, UX-28, XGC-11, CX-U17 | S | live |
| B-061 | **Add NPC places one token per dialog, on the same square, outside the fight, with mixed dispositions and no bar.** "Place N copies" with numbered names, spread on free squares, hostile by default, hidden if wanted, joined to the combat if one is running. Show type, effective Threat Level, XP and source in the picker. Reach it from Scene and Combat, not only under Antagonists (whose list is the XP record); offer "Record for XP" after placing. | XGC-09, UX-29, UX-20, NGC-26, CX-D9, CX-N16, CX-E18, SGI-expert-gc D19 | M | live |
| B-062 | **NPC prototype tokens get no defaults**: hostile, linked by kind (special linked, standard not), a useful bar shown, name on hover for the GC. A scratch NPC's default token could not be seen on a pale map (confirm on a visible client). The standard NPC's damage track has no token bar; subdual is not on the token. | NGC-25, UX-29, SG-N14, LR-36a, SGI-expert-gc R19 | M | live |
| B-063 | **Renaming an NPC does not rename its token**, so the tracker, cards and sheet title keep the old name. Rename the prototype when it still equals the old actor name. | NGC-21 | S | live |
| B-064 | **Importing a template closes the sheet, drops a second same-named actor at the root and says nothing.** Open the imported actor in Edit with the name selected; file it in a folder. | NGC-20 | S | live |
| B-065 | **The NPC builder is hard to find and gives no feedback**: it is called "Use graded NPC creation", sits 940px down a 4,219px Edit scroll, grades show no resulting numbers, the XP total is far below, and it shows internal keys. Edit opens on the builder; a sticky results strip (attack, Defense, saves, XP, effective Threat Level); start from "template or from scratch". | NGC-22, NGC-23, DES-39, DES-40, UX-30, XGC-43, CX-D8, CX-N17, SG-N11 | M | live |
| B-066 | **Nothing says how to give an NPC a weapon** (a novice was stuck about 3 minutes). An "Add weapon" control on the Weapons heading, which today renders empty. | NGC-24, LR-39a | S | live |
| B-067 | **NPC sheet at its default 480px**: attribute names clip (the abbreviation container query never fires), the play sheet is 1,586px long, section labels come in three styles, Tab order contradicts the visual order (abilities are shown above weapons but visited after), and it opens over the tokens and the console at 1280×720. | DES-38, DES-41, DES-16, UX-31, UX-32, DES-26, NGC-27, CX-D7 | M | live |
| B-068 | **Standard NPC damage**: the Damage save button is below the fold while its bonus is at the top; "Next DC" is the DC before the new injury; the sheet dialog wants damage after reduction while chat applies reduction itself; the header hides the damage carried; the form opens at damage 1. Put track and roll together, preview the DC, say which path does what. The docs say "Suffer damage", the sheet says "Roll Damage save…". | XGC-24, CX-D6, CX-N7, CX-U12, NGC-42 | M | live |
| B-069 | **Numbers on the sheet do not match the roll** (Attack base +1 beside weapon Attack +3); "Follow mission TL" leaves a live, wrong number in the Threat Level box. Label base against effective; grey out the overridden field. | NGC-28, XGC-26, CX-E19 | S | live |
| B-070 | **Per-roll "GC only" on NPC attacks and saves**, with a remembered default (skills have it). | SG-D12, CX-U12 | S | earlier |
| B-071 | **Reusing NPCs across missions works by accident**: Add NPC reuses an imported actor silently. Say "already in this world" and offer a fresh copy. | XGC-35, CX-E18 | S | live |

### Chat cards the GC works

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-075 | **After "Roll damage" the attack card says the next step is at the top of this card; it is on a new card below.** One hit makes three cards and about 1,160px of chat, and the middle one points at nothing. Point at the right card, or keep the hit on one card. | DES-44, UX-11, DES-48, UX-12 | M | live |
| B-076 | **The top button on an attack card is "Check Defense for …", which opens a 27-field expert dialog**; "Resolve vs Defense N" is second and both are styled primary. Resolve is the one primary; Check Defense is secondary with a one-line summary first. The docs say the main button is the next step. | NGC-34, DES-47, SGI-novice-player D8, LR-9 | S | live |
| B-077 | **Card header**: a paragraph with up to 15 rule notes that never says "who → whom". Header is who, whom and what; notes go in the Why disclosure; say where damage reduction came from; show the arithmetic for subdual after reduction. | DES-46, UX-13, NGC-35, XGC-23, SG-C12, LR-23c, LR-36b | M | live |
| B-078 | **Finished cards keep live buttons** and do not collapse; "Finish" sits above the primary on the damage card; a GC boost leaves the card contradicting itself. A finished card collapses to one line with its receipts. "Confirm result" may stay after a confirmed result (live check owed). | XGC-14, XGC-03, DES-47, SGI-expert-gc R9, LR-13e | M | live |
| B-079 | **Player requests**: held in memory, so a GC reload loses them; the GC deadline is 110 s and the caller's 120 s; the card gives no time limit or context and makes Allow the primary even when it flags a concern; "Allowed" is recorded before the change succeeds. Persist on the message, timeout as a world setting, a pending count in the console, Applied or Failed as the final state, a clear message for a player without the "Query users" permission. | UX-38, CX-D15, CX-N10, CX-E12, CX-U11, SG-C11, LR-12, RW-408 | L | live |
| B-080 | **Critical activation**: the dialog still makes the GC pick the obvious preset and reads the wrong wallet; three confirm boxes remain; "Activate critical miss" is shown to the roller, who cannot pay it. | XGC-13, LR-13c, LR-13f | S | live |
| B-081 | **The beyond-reach warning is a second modal after "Roll attack"**; the attack dialog's title and footer do not name the attack; a stale target is kept silently if it changes while the dialog is open. | DES-49, DES-50, UX-41, LR-15b | S | live |
| B-082 | **"Automatic vs table / GC steps" guide on every card.** A client setting to hide it after the first open. | SG-C16 | S | earlier |
| B-083 | **Quick resolve with several targets**: current targets can override the resolved target in quick apply, and the batch re-reads the selection at click time. Keep the resolved target fixed and name the recipients. Show what the Shift-click fast path assumed (cover, no boost) before damage. | CX-N6, CX-E11 | M | code |

### Accessibility and input

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-085 | **The focus ring is about 1.05:1 on teal primary buttons** and inconsistent elsewhere; scroll containers clip it; the checkbox draws a second ring. | UX-33, CSS-09, C13 | S | live |
| B-086 | **Keyboard order contradicts visual order** in the console (Previous turn before Next turn, Edit mission before Start mission, Spend dice) and on the NPC sheet, because CSS reorders them. Put the DOM in visual order. | DES-16, CX-N3, CX-U1 | S | live |
| B-087 | **Disabled buttons look exactly like enabled ones; secondary button borders are 1.69:1 dark and 1.48:1 light** (`--sc2-rule` where `--sc2-rule-strong` is meant); primaries have no hover change and secondaries a 0.5 s `transition: all`. | DES-17, DES-18, DES-19, DES-51 | S | live |
| B-088 | **Names and roles**: special NPC health inputs read "Vitality / 16" and "Vitality /"; weapon buttons omit their numbers; defeat is styling only; mission row buttons have no row identity; headings skip levels (1 h2, 52 h3). | CX-U2, CX-U13, CX-U5, CX-U4, UX-35, C14, C3 | M | code |
| B-089 | **Click targets**: section-bar controls 22px (under the 24px minimum), console icons 26px and row icons 36px against the guide's 44px icon area, agent tabs 32px; button rows mix 36px and 44px. | DES-09, DES-12, CX-U18, CSS-14 | S | live |
| B-090 | **Dark `--sc2-danger` on raised is 4.48:1**; step hues have no dark values; the contrast test omits good, warn, danger-on-raised and borders. | SG-S8, SG-S10, CSS-10, CX-U18 | S | earlier |
| B-091 | **Results are not announced**: no live region for request state, initiative results or search counts. | CX-U11, CX-U17, UX-35 | S | code |
| B-092 | **At 200% zoom the console works but a sheet buries it**; the chat log moves under the pointer. | UX-37, UX-40 | S | live |

## P1: player side, carried from earlier reviews

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-100 | Disarm, Cheap Shot, Counter-Trip, Trip final attack and Improved Fortune are shown to every agent. Gate each on the feat or a prior result. | SG-A10 | S | earlier |
| B-101 | Feat activations are keyed by item name in templates and appear only on Abilities. Declare activations in data; render them in "Abilities in play". | SG-A12 | M | earlier |
| B-102 | Attribute checks never open a dialog; saves open one only for Reflex or certain feats; Initiative has none, so feat reminders cannot show. A minimal dialog (modifier, visibility) with the same gestures. | SG-D2, RW-137 | M | earlier |
| B-103 | Damage and Initiative ignore Shift. Apply the gesture table. | SG-D3 | S | earlier |
| B-104 | Attestation-length checkbox labels (159 `…Confirmed` names in 74 files); Fight Defensively still needs a confirm tick; Aim is an honour-system tick box with no Aim action. Effect labels ("Flanking +2") with the detail as a hint; defaults, not attestations. | SG-D5, LR-20b, LR-32 | L | earlier |
| B-105 | Initiative offers no action-die boost. | LR-34b | S | earlier |
| B-106 | Removing and re-adding a level re-rolls vitality. Keep the roll. | LR-33b | S | earlier |
| B-107 | Reaction controls: the target's button disappears once the attack is resolved; the card has no "incoming attack on …" heading. | LR-9 | S | earlier |
| B-108 | One person, three names: sample agents are "Name — Class 1 (role)", and cards use the speaker name with no code name. | LR-27 | S | earlier |
| B-109 | No one-step "New agent for player…" (create, own, assign) and no hint on a player's empty Actors tab. | LR-35 | S | earlier |
| B-110 | `?` explanations for game terms on the console and NPC sheet, from one glossary; a `?` in each surface header that opens the matching doc page. | SGI-novice-gc R6, SGI-novice-gc R24, NGC-07 | M | earlier |
| B-111 | Level-up as one guided path: after the vitality die, chain skill points, feat and choices, then return to Play. Feat and ability choices made inline on the row, not on the item sheet. | SGI-seasoned-player R16, SGI-seasoned-player R17, LR-24d | M | earlier |

## P2: polish

### GC surfaces

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-120 | Console type scale has seven sizes, two off-token; icons on buttons follow no rule; vague or mismatched labels; the search field is styled by Foundry. | DES-10, DES-11, DES-13, DES-20 |S |
| B-121 | Mission facts stack as full-width tiles (564px); list rows are run-on sentences with a double marker; "— Count" and "· grade" fragments. Say "Initiative Count" once and "objective grade". | DES-06, DES-07, SGI-rules-expert D22 | S |
| B-122 | Tracker state text is an unstyled bracketed line that adds 11px a row; raw `COMBAT.RollAll` / `COMBAT.RollNPC` tooltips on the tracker (probably Foundry core; confirm). | DES-43, LR-30 | S |
| B-123 | "Clock and timers" is a different dialog family. | DES-37 | S |
| B-124 | `game.spycraft2.gc` functions open dialogs and take no arguments; GC tools cannot be dropped on the hotbar; the token HUD and token right-click add nothing. | XGC-36, XGC-37, XGC-38 | M |
| B-125 | No way to ask a player for a skill check from the GC side. | NGC-38 | M |
| B-126 | Turn-start reminders as one line per combatant, not a chat card each. | SGI-novice-gc R21 | S |
| B-127 | Shift-click is documented only in a setting hint. Tooltip suffix on roll controls; done on NPC skill buttons, not on the attack button. | SG-D9, UX-24 | S |
| B-128 | Rules-refresh dialog shows raw field paths and JSON to the GC. | SG-D11 | S |
| B-129 | Settings: related combat and approval choices sit among long hints; link a short policy summary from campaign setup. | CX-D18, CX-E17 | S |
| B-130 | Reduced motion and theme: measured oddities whose source was not found. | UX-36 | S |

### Agent sheet, builder and browser

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-135 | Two attack buttons (Attack, Measured attack); untrained styled as bad; Error/Threat as bare bounds. | SG-A17 | S |
| B-136 | Gear picks, Caliber and gear check buried in a closed panel below inventory. "Mission loadout" at the top of Gear. | SG-A18 | S |
| B-137 | Request and Gear check are values, not rolls. | SG-A19 | S |
| B-138 | Cover identity only mid-page; not on the rail or cards. | SG-A23 | S |
| B-139 | Browser rows about 61px; preview empty until a pick; the browser stays open after adding (except talents and specialties); a row click redraws list and preview; prerequisites recomputed on every draw. | SG-I6, LR-24b, LR-24f, HBS-04 | M |
| B-140 | Stepper and sheet tabs are two navigations; steps may open browsers inconsistently (live check). | LR-21e, LR-21f | M |
| B-141 | Weapon row shows no "not readied" state before the click. | LR-22b, SGI-seasoned-player D12 | S |
| B-142 | Wounds help does not name the bands; thresholds on the Play reference grid are unexplained; no line saying what two half actions buy. | LR-23b, SGI-rules-expert D3, SGI-novice-player D10 | S |
| B-143 | Sheets cover the map: the agent sheet opens 860 wide; no compact Play width; tablet width untested. | LR-15a, SGI-seasoned-player D24 | M |
| B-144 | Prone sits four actions deep; the Dying button is duplicated; the Play tab's button count needs a recount. | LR-38d, SGI-seasoned-player D10, LR-38c | S |
| B-145 | Skills on Play: let a player pin an untrained skill; show a widened error range on skill rows. | SGI-seasoned-player D1, SGI-rules-expert D2 | S |
| B-146 | One format for limited uses everywhere: combat groups, the round counter and the Feats tab still write their own sentences (eight abilities are hand-written). | SGI-seasoned-player D5, HBS-06, H8 | M |
| B-147 | Over-budget step: icon and "over by N" in the badge and the aria-label, not colour alone. | SGI-novice-player D17 | S |
| B-148 | Example placeholders in the remaining free-text builder fields. | SGI-novice-player R21 | S |
| B-149 | All compendium tiles share one banner. | LR-18c | S |

### Strings

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-155 | About 156 strings start or end with a separator or bracket (fragment keys); sentences split into fragments. | SG-L9, H5 | M |
| B-156 | Internal vocabulary: "actual" (487), "recorded" (335), "receipt" (111), "RAW", a "Health" section that does not exist. | SG-L10 | M |
| B-157 | First person in labels: 71 strings start "I ", 27 contain "I am". | SG-L11 | M |
| B-158 | 46 strings over 300 characters, 335 over 160. | SG-L12 | M |
| B-159 | A developer error shown to users; four refusals without the fix or in internal language; the Charisma gear-pick warning shows a letter, not the category or the fix. | SG-L13, SG-L14, LR-40c | S |
| B-160 | At least 20 strings still have numbers glued to words ("adds1 damage", "lost5vitality or1wound"). | SGI-rules-expert D18 | S |
| B-161 | Abbreviation leftovers: "Current VP", "Current WP", "DR", "Codename", "VP · SP" in the class browser; the formula hint under Bonuses shows to every owner. | SGI-novice-gc D17, LR-40b, LR-39b | S |
| B-162 | English literals in context builders; hard-coded English in attributes; raw schema keys as labels; text localised at load time stays English (migration labels, the console tab tooltip). | HBS-11, H6, WEB-09 | S |

### Visual system

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-165 | Section heading styled four times; tabs styled twice; agent name rules disagree; three design passes stacked (25 repeated selectors); dead selectors (`.setup-next`, `.condition-summary`). | SG-S1, SG-S2, SG-S9, C6, CSS-11 | M |
| B-166 | Literal colours and stale fallbacks outside tokens; two token vocabularies (`--sc2-bad`, `--sc2-teal`, `--sc2-paper-*`, `--sc2-border`); about 20 font sizes in three units. | SG-S6, C11, CSS-12, LR-38b | S |
| B-167 | Agent breakpoints measure the window, not the pane; nested scroll areas in dialogs; one `[hidden]` base rule in place of seven repairs. | CSS-07, C9, C7 | S |

### Docs

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-170 | GC and maintainer content are mixed in `npc-creation.md` and `gc-tools.md`. Split them. | SG-O3 | S |
| B-171 | Docs and UI disagree: "Suffer damage" against "Roll Damage save…", who NPC initiative rolls for, Begin session and Start mission order, "the main button is the next step". | NGC-41, NGC-42 | S |
| B-172 | Document: the persisted `acquiredAtLevel` and `expertEntry` fields; which open steps a chat flush discards; that feats with no acquisition level default to level 1; that action dice always add above the result cap (p.88), or add a setting. | RW (audit-2026-11), WEB-07, R-11 | S |

## Rules gaps and steps still left to the GC

None of these was checked against the book by the reviewers. Wiring one is a rules change: one per PR, shown as its
own line on the card, and checked against the page first.

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |
| B-180 | Campaign qualities change no number in play beyond XP, action-die cost and starting dice; injury thresholds are fixed at 25/50, so the damage card can post the wrong save prompt under some qualities. Disposition modifiers are not added to rolls. (pp.406–407) | R-01 | M |
| B-181 | Weapon Specialist +1 Defense / +1 damage reduction never applied. | R-02 | S |
| B-182 | Laser: die loss per range increment is reminder text; its lower critical cost is not applied (the attack record does not carry the damage type). (p.338) | R-03, RW-286 | S |
| B-183 | Falling stress not applied. (p.336) | R-04 | S |
| B-184 | No control for persuading an NPC to join a fight. | R-05 | S |
| B-185 | Standard NPC Damage save is not adjusted automatically for vitality or wound changes; a manual field exists. *GC to confirm.* (p.452) | R-06 | S |
| B-186 | Grapple Size limits not enforced; grapple benefit damage (Injure, Throw, Sprawl) is rolled from the weapon card and applied separately; the −4 penalties are by hand. (p.357) | R-07, RW-210, RW-346 | M |
| B-187 | "Once per trigger" guards hold only while the chat card exists. Put receipts on the actor. | R-08, JS-08 | M |
| B-188 | Dramatic-scene Defense and DC boosts are reported for the GC to apply. | RW (gc-tools) | S |
| B-189 | NPC feats and class abilities beyond plain numbers (threat ranges, abilities) stay reminders; a failed stress save on a special NPC leaves Shaken to a button; stress thresholds from a hazard; special damage types other than bang, flash and explosive are applied as ordinary damage. | RW-223, RW-344, RW-345, RW-411 | M |
| B-190 | Cover from characters in the line of fire is named, not valued; scenery is not considered; blast ignores cover other than walls; no distance measuring for skill dialogs. | RW-203, RW-204, RW-346, RW-410 | M |
| B-191 | Not modelled: team and directed checks; Joint Action's shared Count; Terminal Situations beyond the GC die spend; fire or gas spreading across squares; contagious diseases passing between characters; halving Strength damage underwater; weapons as gadget housings; damage reduction against Charisma damage; Table 5.6 Size modifiers to armor-piercing; dice gained or cost against mission Caliber for favoured gear; conveyance bull-rush reading vehicle actors; unarmed Trip, Feint and grapple variants. | RW-82, RW-215, RW-219, RW-287, code comments | L |
| B-192 | Second delivery roll and the unchosen roll of a choose-twice check are not attached to the chat message. | J7 | S |
| B-193 | Data semantics: feat summaries, class features, weapon and armor numbers have no recorded source-to-data audit (gear and vehicles were cross-checked); reference fixtures include invalid rank allocations. | RW (audit-2026-11) | L |

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
| B-210 | Reconcile hooks let every owner client write; `isLeadGM` and the scheduler are copied. | WEB-11, W12 | S |
| B-211 | Settings registered in 19 files with no key list; rule code still keyed on display names in places; test-only rule exports are unmarked. | WEB-10, JS-09, JS-16 | S |
| B-212 | Templates: play mode renders all edit markup and hides it; acquisition block copied into three item templates; review notices duplicated; disclosure memory and search implemented three times; selectors passed through the translation tag; 43 hand-written `<option selected>`; `signed` helper unprefixed; `enrichHTML` options differ; decoration pass walks the whole app. | HBS-03, HBS-08, HBS-09, HBS-10, HBS-12, HBS-14, HBS-15, H3, H7, H9, H13 | M each |
| B-213 | Templates are unformatted and outside the formatter (439 lines over 200 characters). Do last, one file per PR. | HBS-13 | M |
| B-214 | Tests and tooling: 164 test files build their own Foundry stub; no automated test inside Foundry; five layout specs not on `systemCss()`; no `checkJs`; 28 unused-variable warnings capped, not cleared; chat cards skinned only when flagged (111 `ChatMessage.create` calls, no helper); sheet submit guard checks flat keys only. | WEB-08, CSS-05, W13, C4, J5 | M |
| B-215 | The CI lints of style guide 11.2 (banned terms, glued numbers, fragment keys, first person, hint length, ranges, template and CSS checks, one primary). None is written. | SGI-rules-expert Part C | M |

## Live checks owed

Short passes in a running world. Delete a line when it has been seen working, or move it up if it fails.

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
