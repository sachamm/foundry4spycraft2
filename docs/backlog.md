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
   actions (B-026) and the NPC fire actions (B-028).
3. **Console safety and stability**: what is left of B-030 to B-037, chiefly undo for a GC boost (B-037).
4. **Dialogs** (B-040 to B-046): sizing, the focus ring and keeping values after a refusal.
5. The rest of P1 by area, then P2 when a surface is touched anyway.

## P0: wrong results, lost data, double payment

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-222 | **Undo: what it trusts and what it leaves.** The note's own chat flag decides which paths a GC's client restores; the changed-since check covers the actor only, not combatants or cards; a step that fails part way leaves no note; Undo leaves a critical shot's source attack marked, leaves a pending massive-damage or threshold save card live, cannot give GC dice back for a deleted NPC or after a new session began, and does not free marks on old cards. Keep the undo record where only the GC can write it, key marks to the step, give dice back first and independently, and close the pending save card. | CX2-U02, CX2-U03, CX2-U04, CX2-U05, CX2-U06, CX2-U07, CX2-U08, CU-08 | L | code |
| B-237 | **Next scene has no way back.** The status strip says when the session began, Begin session stops being the main button once it has and states what the Threat Level gives, and Next scene names every standard NPC whose damage it clears. Still open: an Undo for Next scene (the scene period, the scene count and the dramatic state). | NG2-04, NG2-05, NG2-25 | M | live |

## P1: running the game

### Combat from the console

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-025 | **Fluid initiative**: show only the chosen event's fields (31 events in one flat list today), preview immediate against round-end movement, show the capped ±10 beside the raw sum, let the GC remove a mistaken event, clear a fulfilled Press, and do not offer the tool before combat starts. Check that automatic events are recorded when the combat is not the active one. (p.324) | UX-39, XGC-22, CX-D14, CX-N9, CX-E13, CX-U10, SG-D10 | M | live |
| B-026 | **Half actions**: count skill checks and movement, or say on the strip which actions are counted; warn before going over, not after; a pip says on hover what marked it; undo from the card. | LR-8, SGI-rules-expert D15, SGI-seasoned-player R11, XGC-06 | M | earlier |
| B-028 | **NPC attacks cannot use Burst, Autofire or Suppressive Fire**: the NPC sheet never opens the ranged-attack dialog that has them. Same gap on the agent's Play tab. One attack control with the fire actions. | LR-17, SG-A17, UX-41 | M | earlier |
| B-029 | **Dramatic scene**: starting one is silent; scripted (free) and paid entries sit apart; doubling the Counts already rolled is a separate action (Counts rolled later are now doubled as they come in). One place, a visible "Dramatic" state, and a preview of who will be doubled. (p.424) | UX-10, CX-D13, CX-N8, CX-E14 | M | live |
| B-241 | **Mob attack posts one card per member.** The group now asks about Reach once, names who attacked whom and who was left out, attacks only with members on the acting Count, offers only the other side as targets and charges each member its action. Still open: one card for the group's attacks. | XG2-13 | M | live |
| B-242 | **Tracker and turn details.** A readied trigger gives no way to run the action from the console; the tracker menu and the console name the same action differently. | XG2-17, XG2-29, UX2-23 | S | live |

### Console structure and stability

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-030 | **The console redraws whole on every action.** Scroll, keyboard focus, the search text and open sub-lists are now kept across a redraw; still to do: redraw only the part that changed, and check the kept scroll position on a live sidebar. | DES-14, UX-34, NGC-02, CX-U7 | M | live |
| B-031 | **Prep, Play and Wrap-up views exist; finish the tidy-up inside them.** One primary button per section (several sections still have a filled button each), move the guide and the search below Combat during a fight, and drop the "What the system does for you" paragraph from the console. | DES-01, DES-04, DES-05, UX-17, XGC-42, NGC-02, CX-D2, CX-U6, SGI-expert-gc R18 | L | live |
| B-033 | **The status strip does not show pending player requests.** It now names the mission and its state, the scene period, the round and whose turn, and GC dice left of the starting number. Add a count of waiting requests, and stop "Scene" meaning both the Foundry scene and the scene period elsewhere in the console. | UX-09, NGC-06, XGC-29, NGC-10, SG-G6, CX-D15 | M | live |
| B-034 | **Tooltips**: 63 of 66 console controls get a generated tooltip; 30 repeat the label, 15 abbreviate it ("Surprise rd", "Fluid init") and 3 explain. They stay on screen after the control is pressed or redrawn and cover the next button. Write one line on what the button changes; never generate one from the label; dismiss on click and on redraw. | DES-15, UX-08, UX-24, NGC-05, XGC-40, SG-G9, LR-38a | M | live |
| B-035 | **The console and the chat log share one sidebar slot**, so the GC cannot see a tool and its result together. The pop-out is hidden, opens 720×800 over the map and uses the width for nothing. Make the pop-out obvious, give it a two-column layout and a remembered place; echo results (XP report, Planned XP, Begin session done) where the GC is looking. | UX-16, DES-25, DES-24, NGC-29, NGC-40, XGC-41 | M | live |
| B-233 | **Console layout and first-session list, second pass.** Search brings back an open or closed state saved under another view; the Play view hides Mission, where the quickstart sends the GC to wrap up; the first-session list ticks "make and place" for any NPC and "first combat" for any scene; the dice line drops "of N" when over but does not keep what the session started with. | CX2-D06, CX2-D10, CX2-D11, CX2-D12, CX2-N12, CX2-N13, CX2-N14, CX2-U15, CU-15 | M | code |
| B-244 | **First-session list, live pass.** A remembered view comes back in a later run of the same kind; search does not reach the view buttons. | NG2-02, NG2-03, NG2-13, NG2-14, NG2-22, NG2-28, DS2-09, DS2-10, DS2-11, DS2-12 | M | live |
| B-245 | **Pickers, the rest.** Spend dice, the Fluid event dialog and the target lists now start on the fight in view, skip other scenes' fights and number shared names. Sidebar actors are still listed beside token copies in the Apply damage list when no token is on the scene. | UX2-08, UX2-09, UX2-10, UX2-22, XG2-30 | M | live |

### Safety: confirm, undo, feedback

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-037 | **Undo for a GC boost on a card, and an outcome override.** Alt+B now asks for a second press, but a GC boost still cannot be taken back once spent, because it changes the roll's own record; and the GC cannot yet override an outcome on the card and have that recorded. | DES-45, XGC-15, UX-05, CX-U12, SG-C10, SGI-expert-gc R13 | L | live |
| B-246 | **Undo notes, live pass.** (A GC's note now goes to that GC only, and a player's note names its author.) The note sits apart from the card it undoes, and names the raw damage and the actor's old name; after "Undone." its line still reads "applied" and the save card the damage caused still reads as current; the button's border is 1.48:1. | DS2-30, DS2-31, DS2-32, UX2-16, UX2-17, UX2-18, XG2-25, XG2-26 | M | live |

### Dialogs opened from the console

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-040 | **Dialog sizing and focus ring.** Dialogs built with the shared kit now have Cancel, a named main button on the console's dialogs and the keyboard in the first field. Still to do: inputs are 22px under the 36px token, the focus ring is Foundry's 1px one, every dialog is 400px wide whatever it holds, and the dialogs outside the GC tools still say "Confirm". | DES-28, DES-31, DES-36, UX-03, UX-23 | M | live |
| B-042 | **Spend dice does not state the cost before Confirm**, mixes daily spends with rare recovery tools, and some spends are bookkeeping only. One intent at a time with cost, pool before and after, and what the system then does or leaves to the GC. Explain once what GC action dice are for; there are two different ways to spend one. | DES-30, NGC-30, NGC-31, XGC-30, CX-D13, CX-N8 | M | live |
| B-043 | **Pickers list the whole world, not the scene**, and duplicate names cannot be told apart (the world has two each of several sample agents). Scene or combat first, then the rest; show folder or source beside the name. | UX-25, NGC-19, NGC-08, XGC-34, XGC-16 | S | live |
| B-044 | **Select options are sentences in narrow selects; dialog titles follow four patterns; internal identifiers and banned terms appear in GC dialogs.** Short labels with a detail line; one title pattern; plain words. | DES-33, DES-35, UX-26, UX-27, UX-07, DES-13 | S | live |
| B-045 | **Disposition**: the default action changes nothing; the dialog offers everything and the GC cannot overrule. Task-specific fields, the current grade shown, a GC override. (Refusals now show inside the dialog.) | NGC-37, UX-06, CX-D16, CX-E15 | M | live |
| B-046 | **Dramatic Conflicts** start easily and then need the book open: step two of a chase is 33 controls in an 867px form, steps are a generic "Next step", totals are typed by hand, an irreversible step hides behind "Confirm", and two fields share one name. Named steps with Back, fields grouped per side, links to the source rolls, private strategy choice for players. Advantage effects other than Lead, Swap, Victory and Halt are reported, not applied; chained pairs and crashes are not modelled. | NGC-39, UX-07, CX-D17, CX-E16, CX-U3, RW-54 | L | live |
| B-248 | **Dialogs, live pass.** the attack and apply-damage dialogs skip the shared kit, so they have no Cancel and focus the main button; kit dialogs are 400px wide with 32px inputs; closing a dialog does not return focus to its opener; main buttons do not name their object; titles and option wording vary; tooltips stay up after a dialog closes and cover the next control. | XG2-08, XG2-19, DS2-19, DS2-20, DS2-21, DS2-22, DS2-37, UX2-24 | M | live |

### Mission and campaign

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-050 | **One mission record per world, with no drafts or archive.** "Plan the next mission" files the ended mission as a journal entry under Mission records; there are still no named drafts, duplicate or import. (B-001 is the urgent part.) | XGC-31, CX-D10, CX-N11, CX-U15, XGC-35 | L | live |
| B-052 | **Mission record, the rule checks.** The dialog now puts name, Caliber and team first, folds the rest, shows a live Threat Level line and says what was saved. *GC to confirm* the Threat Level formula as labelled (pp.422–423) and the standing payout when a −2 adjustment cannot lower a Threat Level of 1 (pp.435–440) | NGC-07, NGC-08, NGC-09, DES-06, DES-32, UX-21, XGC-28, CX-E7 | M | live |
| B-054 | **One wrap-up view**: earned XP with its breakdown, unresolved objectives, exposure and standing, each with the person, the amount and the balance before and after, and a settled state. Today an infraction debits at once, a complication counts as earned at once, and the XP report is a long chat message. | CX-D12, CX-N14, CX-E20, NGC-15, NGC-40 | L | code |
| B-055 | "Record an antagonist" uses jargon and a preview that looks wrong. | XGC-27, NGC-14 | S | live |
| B-056 | **Season campaign qualities, the rest.** The dialog and console now tag each quality applied by the system, partly by hand or by hand, and clashing effects read as words. Still open: scope (season, mission, bought in play) and links to the related world settings | DES-34, NGC-17, CX-D11, CX-N15, CX-E17, CX-U16 | M | live |
| B-249 | Mission screen details: Start again refills the GC dice (*GC to confirm*). | NG2-15, NG2-16, NG2-17, NG2-29 | S | live |

### NPCs

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-061 | **Add NPC to scene: finish the picker.** It now places N numbered copies on free squares, hostile by default, hidden if wanted, joined to a running fight, with an optional XP record, and is reachable from the Play view. Still to do: show effective Threat Level and XP beside each name, and give the placed tokens a bar (see B-062). | XGC-09, UX-29, UX-20, NGC-26, CX-D9, CX-N16, CX-E18, SGI-expert-gc D19 | M | live |
| B-062 | **NPC prototype tokens get no defaults**: hostile, linked by kind (special linked, standard not), a useful bar shown, name on hover for the GC. A scratch NPC's default token could not be seen on a pale map (confirm on a visible client). The standard NPC's damage track has no token bar; subdual is not on the token. | NGC-25, UX-29, SG-N14, LR-36a, SGI-expert-gc R19 | M | live |
| B-064 | **Importing a template closes the sheet, drops a second same-named actor at the root and says nothing.** Open the imported actor in Edit with the name selected; file it in a folder. | NGC-20 | S | live |
| B-065 | **NPC builder: finish the first-run path.** In Edit the builder now comes first, under a pinned strip of the numbers it produces (Threat Level, attack, Defense, Initiative, saves, health, XP), and its switch says what it does. Still to do: show each grade's resulting number beside the grade, replace the internal keys with words, and start from "template or from scratch". | NGC-22, NGC-23, DES-39, DES-40, UX-30, XGC-43, CX-D8, CX-N17, SG-N11 | M | live |
| B-068 | **Standard NPC damage**: "Next DC" is the DC before the new injury; the sheet dialog wants damage after reduction while chat applies reduction itself; the header hides the damage carried; the form opens at damage 1. Put track and roll together, preview the DC, say which path does what. | XGC-24, CX-D6, CX-N7, CX-U12, NGC-42 | M | live |
| B-069 | **Numbers on the sheet do not match the roll** (Attack base +1 beside weapon Attack +3); "Follow mission TL" leaves a live, wrong number in the Threat Level box. Label base against effective; grey out the overridden field. | NGC-28, XGC-26, CX-E19 | S | live |
| B-070 | **Per-roll "GC only" on NPC attacks and saves**, with a remembered default (skills have it). | SG-D12, CX-U12 | S | earlier |
| B-071 | **Reusing NPCs across missions works by accident**: Add NPC reuses an imported actor silently. Say "already in this world" and offer a fresh copy. | XGC-35, CX-E18 | S | live |
| B-230 | **Add NPC to scene: placement, the rest.** Placement now stays inside the scene rectangle, skips squares behind a wall from the centre of the view, and unlinks a second copy of a linked NPC. Still open: non-square grids; a compendium pick reuses a world actor imported from that entry even after the GC rebuilt it; the list is ten rows tall for two results. | CX2-E11, CX2-E13, CX2-D15, CM-17, CM-18, CM-20 | M | code |
| B-231 | **NPC vitality and wounds at the edges.** Duplicating an NPC at 0 vitality fills the copy; an old unlinked NPC promoted before its first check keeps empty pools; an Animal Partner prepared before its owner at world load may be healed (not seen running); two wounded unlinked tokens of one NPC can follow a Threat Level change differently. Give each token its own recorded maximums and prepare partners after their owners. | CX2-E14, CX2-E15, CM-06, CM-09 | M | code |
| B-232 | **Renaming an NPC: gaps.** Quick renames in a row can leave a token with an older name; a number the GC typed by hand is treated as a generated one; Foundry's own "Name (2)" form is not followed; a player who renames an NPC they own cannot update its tokens. Accept both number forms and do the token updates on the lead GC's client. | CX2-E16, CM-21 | S | code |
| B-251 | Add NPC to scene, the rest: an unlinked token's rename shows two names for one combatant | NG2-10, DS2-17, DS2-18, XG2-22 | S | live |

### Chat cards the GC works

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-076 | **Check Defense opens a 27-field expert dialog.** (It is now a plain button whenever the same person can Resolve the attack.) A one-line summary should come first. | NGC-34, DES-47, SGI-novice-player D8, LR-9 | S | live |
| B-077 | **Card header never says "who → whom".** The rule notes now sit in the closed Details disclosure; the header still needs the target, and damage cards should say where damage reduction came from and show the arithmetic for subdual after reduction. | DES-46, UX-13, NGC-35, XGC-23, SG-C12, LR-23c, LR-36b | M | live |
| B-078 | **Finished cards keep live buttons** and do not collapse; "Finish" sits above the primary on the damage card; a GC boost leaves the card contradicting itself. A finished card collapses to one line with its receipts. "Confirm result" may stay after a confirmed result (live check owed). | XGC-14, XGC-03, DES-47, SGI-expert-gc R9, LR-13e | M | live |
| B-079 | **Player requests**: held in memory, so a GC reload loses them; the GC deadline is 110 s and the caller's 120 s; the card gives no time limit or context and makes Allow the primary even when it flags a concern; "Allowed" is recorded before the change succeeds. Persist on the message, timeout as a world setting, a pending count in the console, Applied or Failed as the final state, a clear message for a player without the "Query users" permission. | UX-38, CX-D15, CX-N10, CX-E12, CX-U11, SG-C11, LR-12, RW-408 | L | live |
| B-080 | **Critical activation**: the dialog still makes the GC pick the obvious preset and reads the wrong wallet; three confirm boxes remain; "Activate critical miss" is shown to the roller, who cannot pay it. | XGC-13, LR-13c, LR-13f | S | live |
| B-081 | **The beyond-reach warning is a second modal after "Roll attack"**; the attack dialog's title and footer do not name the attack; a stale target is kept silently if it changes while the dialog is open. | DES-49, DES-50, UX-41, LR-15b | S | live |
| B-083 | **Quick resolve with several targets**: current targets can override the resolved target in quick apply, and the batch re-reads the selection at click time. Keep the resolved target fixed and name the recipients. Show what the Shift-click fast path assumed (cover, no boost) before damage. | CX-N6, CX-E11 | M | code |
| B-252 | Chat cards, live pass: the Damage save card has no success or failure stamp; attack headers say "Succeeded" or "Failed" where the stamp says hit or miss; raw formulas show; an NPC Defense boost is reported and not shown; on the damage card Finish comes before Apply, with no gap; "Roll damage" stays a live main button after damage is rolled; the card says "listed below" with no list; with the console in the sidebar every chat message becomes a notification over the map. | DS2-28, DS2-29, DS2-33, DS2-34, DS2-36, XG2-27, XG2-28, UX2-02, UX2-26 | M | live |

### Accessibility and input

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-085 | **Scroll containers clip the focus ring** (filled buttons now take an ink ring, and checkboxes show one ring). | UX-33, CSS-09, C13 | S | live |
| B-086 | **Keyboard order on the NPC sheet**: check that its grid places controls in markup order. (The console's main button and the agent Play reference now lead in the markup as on screen; no CSS `order` remains.) | DES-16, CX-N3, CX-U1 | S | live |
| B-088 | **Names and roles**: special NPC health inputs read "Vitality / 16" and "Vitality /"; weapon buttons omit their numbers; defeat is styling only; mission row buttons have no row identity; headings skip levels (1 h2, 52 h3). | CX-U2, CX-U13, CX-U5, CX-U4, UX-35, C14, C3 | M | code |
| B-089 | **Click targets**: button rows still mix 36px and 44px heights. (Section-bar controls, the console's row icons, round pips and the clock badge now meet the 28px and 44px sizes.) | DES-09, DES-12, CX-U18, CSS-14 | S | live |
| B-091 | **Results are not announced**: no live region for request state, initiative results or search counts. | CX-U11, CX-U17, UX-35 | S | code |
| B-092 | **At 200% zoom the console works but a sheet buries it**; the chat log moves under the pointer. | UX-37, UX-40 | S | live |
| B-235 | **Console and NPC strip status regions are replaced whole on every redraw**, so a turn or grade change is not announced as a change, and the console's focus release also acts on Foundry's own sidebar buttons. Update the status text in place and limit the release to the console's buttons. (Redraws already wait while a pointer is down.) | CU-11, CU-19, CX2-U11 | M | code |
| B-253 | Card buttons' accessible names do not contain their visible labels; section summaries carry a generated description with the title and note run together. The view switcher has no hover state, is 32px tall and its selected fill is 1.28:1; the console's focus ring has no offset. Check focus after Undo and closing a dialog in a live world. | UX2-05, UX2-06, UX2-13, UX2-14, UX2-20, UX2-25, UX2-28, DS2-05, DS2-06, DS2-07, DS2-08, XG2-18 | M | live |

## P1: player side, carried from earlier reviews

| ID | Item | Sources | Effort | Evidence |
| --- | --- | --- | --- | --- |
| B-100 | Improved Fortune teammates is shown to every agent; show it only when a teammate or the agent has Improved Fortune. (Counter-Trip and the Trip final attack now show only while one is earned; Disarm and Cheap Shot are actions anyone may take, p.355.) | SG-A10 | S | earlier |
| B-101 | Feat activations are keyed by item name in templates and appear only on Abilities. Declare activations in data; render them in "Abilities in play". | SG-A12 | M | earlier |
| B-102 | Attribute checks never open a dialog; saves open one only for Reflex or certain feats; Initiative has none, so feat reminders cannot show and Shift has nothing to skip. A minimal dialog (modifier, visibility) with the same gestures. (Damage now takes Shift: no optional extras, no dialog.) | SG-D2, RW-137 | M | earlier |
| B-104 | Attestation-length checkbox labels (159 `…Confirmed` names in 74 files); Fight Defensively still needs a confirm tick; Aim is an honour-system tick box with no Aim action. Effect labels ("Flanking +2") with the detail as a hint; defaults, not attestations. | SG-D5, LR-20b, LR-32 | L | earlier |
| B-105 | Initiative offers no action-die boost. | LR-34b | S | earlier |
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
| B-255 | **Breakdown tooltips, the rest.** Roll buttons and roll cards now list the parts of their bonus. Still without one: the NPC graded tiles (Initiative, attack base, saves, Damage save), skill error range, the vehicle sheet's figures, and initiative cards (Foundry posts those without the system's check record). A damage card lists its flat bonus but not where each extra die came from. Action dice added after the roll show as "16 → 25" on the card, not as tooltip rows. | PR for bonus tooltips, 2026-11-25 | S |
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
| B-236 | Console and undo wording, second pass: "record" and "settlement" in the end-mission texts and "{count} recorded" on the wrap-up strip; plurals glued from pieces in the undo tooltip and the GC dice spend label; the scene status glued from two parts; the Add NPC summary joined with "; " and reading "1 × Guard"; `h3` headings in the console with no `h2` above; and Undo still lives on its own whispered note instead of on the card that made the change (7.5, 8.3). | CU-16, CU-17 | S |
| B-254 | Words a new GC cannot place ("Caliber", "faced", "standing", "usage period" and others listed in the report), tooltips that repeat their label, and the status strip's wording. | NG2-20, NG2-26, NG2-27, NG2-30 | S |

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
| B-187 | "Once per trigger" guards hold only while the chat card exists. Put receipts on the actor. | R-08, JS-08 | M |
| B-188 | Dramatic-scene Defense and DC boosts are reported for the GC to apply. | RW (gc-tools) | S |
| B-189 | NPC feats and class abilities beyond plain numbers (threat ranges, abilities) stay reminders; a failed stress save on a special NPC leaves Shaken to a button; stress thresholds from a hazard; special damage types other than bang, flash and explosive are applied as ordinary damage. | RW-223, RW-344, RW-345, RW-411 | M |
| B-190 | Cover from characters in the line of fire is named, not valued; scenery is not considered; blast ignores cover other than walls; no distance measuring for skill dialogs. | RW-203, RW-204, RW-346, RW-410 | M |
| B-191 | Not modelled: team and directed checks; Joint Action's shared Count; Terminal Situations beyond the GC die spend; fire or gas spreading across squares; contagious diseases passing between characters; halving Strength damage underwater; weapons as gadget housings; damage reduction against Charisma damage; Table 5.6 Size modifiers to armor-piercing; dice gained or cost against mission Caliber for favoured gear; conveyance bull-rush reading vehicle actors; unarmed Trip, Feint and grapple variants. | RW-82, RW-215, RW-219, RW-287, code comments | L |
| B-258 | A Table of Ouch injury is now a sheet row with Surgery and Healed (pp.142, 332), but its healing time is not rolled or counted down per mission, its effects (lost limb use, a permanent attribute drop, sickened) are applied by hand, and a special NPC's injury is only posted. | U6 (rules council 2026-11-27) | M |
| B-192 | Second delivery roll and the unchosen roll of a choose-twice check are not attached to the chat message. | J7 | S |
| B-256 | An agent's Size modifies its Sneak/Hide checks but not its Blend/Stealth checks; the Size table applies to both (p.349). NPCs now take it on both. Agents' Size is also only Small, Medium or Large. | council-rules 2026-11-27 S2 | S |
| B-257 | A Minion squad's Commander is marked only when Add NPC to scene places the squad; the NPC sheet has no control to mark or clear a token as Commander, and a linked Minion cannot carry the mark (p.447). | council-rules 2026-11-27 R7, E4 | S |
| B-193 | Data semantics: feat summaries, class features, weapon and armor numbers have no recorded source-to-data audit (gear and vehicles were cross-checked); reference fixtures include invalid rank allocations. | RW (audit-2026-11) | L |
| B-259 | Weapons now carry the year printed in the weapon tables (pp.250–271) instead of our date. World copies and agents' weapons that the version 6 migration dated earlier keep the old year; correcting them needs a migration, and so a system version bump. | R1 (council-rules-2026-11-27) | S |
| B-260 | Mission Caliber (p.398): before an agent allocates reserves, the sheet does not check mission picks against the mission's Caliber, because the engine reads it only from the reserves record. The Undo left by a Caliber increase puts the team's reserves back but not the mission record or the GC's dice. | R4 (council-rules-2026-11-27) | S |
| B-261 | Historical (p.407): an item not yet introduced is checked at its gadget Caliber, but the sheet does not ask for it to be taken as a gadget Housing or effect with a G pick; dropping one onto a sheet from outside the browser shows no tag. | E1 (council-rules-2026-11-27) | M |
| B-262 | Liquidation (p.440): a hit on the Start mission roll names the Marked for Death event (p.399) in chat but does not add it to the mission as a scripted event. Standing at exactly 0 after a negative spell counts as no longer burned. | R6 (council-rules-2026-11-27) | S |
| B-263 | Bloodbath (p.406): the critical is free but not automatic; the attacker's 1-die refusal is not offered, and every critical effect is free, so an agent can make a standard NPC fail 4 extra Damage saves at no cost. | S10, E9 (council-rules-2026-11-27) | S |
| B-264 | Cakewalk (p.406): each agent's Intel Phase picks (skills up to the Intelligence modifier, error −2 to a minimum of 1, normal take-10 time) have no picker or rule yet. | S5 (council-rules-2026-11-27) | M |
| B-265 | Blast in a confined space (p.343): the extra damage for each cut-off blast increment is not modelled, so Blockbuster's exemption from it has nothing to act on. | N3 (council-rules-2026-11-27, round 2) | S |
| B-266 | Triumph (p.331): its effect on witnesses (stress and Morale checks) is only a note on the card. | R10 (council-rules-2026-11-27, round 2) | S |
| B-267 | The settlement's Triumph default reads the chat cards the settling client can see, so a player misses whispered or blind Triumphs; record them on the mission instead. | N5 (council-rules-2026-11-27, round 2) | S |
| B-269 | Animals (p.445): the list of combat actions an animal may take is not checked when it acts. | rules seat (council-rules-2026-11-27, round 2) | S |

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

- Bonus breakdown tooltips in a running world: hover an attribute, a save, a skill and a weapon's Attack button on
  an agent and an NPC, then the result on an attack, skill, save and damage card; check the lines add up to the
  figure shown, that the tooltip does not cover the button being pressed, and that a player sees no parts on an
  NPC's card. (B-255)
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
