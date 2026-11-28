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

## Where it stands

On 2026-11-28 every row was worked through: checked against the code, then built, dropped or parked. The tables
below are empty and take new work. What happened to each old row is in
[Closed on 2026-11-28, with notes](#closed-on-2026-11-28-with-notes). A row marked Parked there is still a true
statement about the system and says what would reopen it; bring one back into a table when its time comes. What is
owed now is the [live checks](#live-checks-owed) and the [open decisions](#decisions-the-reviewers-left-open).

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

### Agent sheet, builder and browser

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

### Strings

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

### Visual system

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

### Docs

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

## Rules gaps and steps still left to the GC

These rows distinguish completed rules paths from remaining GC decisions or future assistance. Consult the cited
page before changing an adjudication, and show each rules change clearly on its card.

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

## Code health (code council, 2026-11-23)

Do these when touching the area. The council's conditions still apply: equality tests first, one family per PR.

| ID | Item | Sources | Effort |
| --- | --- | --- | --- |

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

Every row that left the tables above in the 2026-11-28 pass, and why. "Done" rows landed in code, "Dropped" rows
were judged not worth doing, and "Parked" rows are still true but wait for the reason given.

| ID | Was | Outcome | Notes |
| --- | --- | --- | --- |
| B-222 | Undo and old cards | Done | Undo of damage applied from a card made before marks were keyed now takes that target's newest record off the card's old array (through the GC for a player), so the card can be applied again. |
| B-237 | Next scene has no way back | Done | Next scene leaves an Undo note. It returns the scene period to the scene before, which brings back that scene's uses, dramatic state and standard NPCs' damage, and takes the scene off the mission's count. It refuses once a later scene has begun, or once a standard NPC has taken damage in the new scene, because that replaced its earlier record. |
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
| B-124 | `game.spycraft2.gc` functions open dialogs and take no arguments; GC t | Done | Any console button that needs no row or combatant can be dragged to the hotbar, where it becomes a macro that runs game.spycraft2.gc.run with the tool's name; the same call works in a hand-written macro. Functions that take arguments already do (spend, recordFluidEvent, the NPC tools). The token HUD and token right-click were left alone: the console's acting block and the tracker's menu already hold those steps. |
| B-120 | Console: icons on buttons follow no rule; vague or mismatched labels.  | Done | Already on main: console buttons are text only (the one icon is Open in a window), so there is no icon rule left to break; this pass wrote a one-line tip for each button (B-034). |
| B-121 | Mission facts were measured stacking as full-width tiles (564px). `.gc | Done | The mission facts are an auto-fill grid in the stylesheet; confirming they no longer stack in a live console moved to Live checks owed. |
| B-122 | Raw `COMBAT.RollAll` / `COMBAT.RollNPC` tooltips on the tracker: proba | Dropped | The raw COMBAT.RollAll and COMBAT.RollNPC keys are Foundry core's tracker buttons, not the system's. If they still show in a live world it is a core translation gap; noted under Live checks owed. |
| B-129 | Settings: related combat and approval choices sit among long hints; li | Done | The Campaign qualities section has a Table settings button that opens the system's settings (see B-056). Shortening the setting hints themselves falls under the string-length ratchet. |
| B-130 | Reduced motion and theme: measured oddities whose source was not found | Dropped | The review measured oddities in reduced motion and theme but found no source and gave no steps to reproduce. Nothing to fix until one is seen again; light theme is under Live checks owed. |
| B-142 | Wounds help does not name the bands; thresholds on the Play reference  | Done | The stress and subdual thresholds on the Play reference grid now explain themselves on hover. Already on main: the round pips' hint says what two half actions buy, and the wounds help says when damage reaches wounds and what 0 means. Wound bands are not a rule this system tracks, so there is nothing to name. |
| B-140 | Stepper and sheet tabs are two navigations; steps may open browsers in | Parked | Whether the creation stepper and the sheet tabs read as two navigations, and whether each step opens its browser the same way, has to be judged on screen; listed under Live checks owed. |
| B-143 | Sheets cover the map: the agent sheet opens 860 wide; no compact Play  | Parked | A compact Play width and a tablet layout are a sheet redesign that has to be drawn and tried in Foundry; nothing in the tests can stand in for it. The console already opens narrower (480px). |
| B-144 | Prone sits four actions deep; the Play tab's button count needs a reco | Done | Drop prone (Stand up while prone) is now among the Your turn buttons at the top of the Play tab. The Play tab's parts hold 107 buttons in all, most inside closed groups; the recount is recorded here and trimming them belongs with B-143. |
| B-146 | One format for limited uses everywhere: combat groups, the round count | Parked | The shared use counter draws most limited uses; the eight hand-written sentences each say something the counter cannot (a condition on the use). Folding them in means a richer counter format, best done when the Feats tab is next reworked. |
| B-149 | All compendium tiles share one banner | Parked | A banner per compendium is artwork, not code: docs/compendium-icons.md says how the tiles are made. Needs images Sacha chooses or commissions. |
| B-161 | The formula hint under Bonuses shows to every owner (not found in the  | Dropped | No formula hint under Bonuses exists in the templates any more (checked 2026-11-28), and the labels named in the row are already words. |
| B-162 | English literals in context builders; hard-coded English in attributes | Done | Fixed the English literals found in the GC dialogs (Spend dice, Disposition, conflict Strategies). New ones are caught as they are written only by review; text localised at load time (migration labels) was left, since a migration runs once and its label is seen by the GC who ran it. |
| B-254 | Words a new GC cannot place ("Caliber", "faced", "standing", "usage pe | Done | The words a new GC could not place now have a one-line meaning in Game terms and on the mission facts (B-110); a generated tooltip that repeats its label is no longer added anywhere (B-034, B-253). The status strip's wording was left as it is. |
| B-139 | Browser rows about 61px; preview empty until a pick; the browser stays | Parked | The browser's row height, empty preview and redraw-on-click are one piece of work on module/apps/browser.mjs that needs to be seen with a full compendium loaded; nothing here is wrong, only slower and taller than it could be. |
| B-166 | Literal colours and stale fallbacks outside tokens; two token vocabula | Done | The first design pass's colour names (teal, bad, paper, brass) are replaced by the role tokens in every stylesheet and removed from tokens.css; a lint keeps them out. Literal colours outside the tokens are capped at the 16 that remain, and text under 13px is a hard lint. The font sizes in three units were left: each is a token reference or an em tied to its parent. |
| B-167 | Agent breakpoints measure the window, not the pane; nested scroll area | Done | Already on main: the agent sheet's breakpoints are container queries on the pane. Roll-option dialogs are a single scrolling box with room for the focus ring (B-085). |
| B-165 | Section heading styled four times; tabs styled twice; agent name rules | Parked | Repeated selectors from three design passes still stack (section headings, tabs, the agent name). Merging them is a cascade change that can shift any sheet by a pixel; do it with a before-and-after screenshot run in Foundry, one component per pull request, as the code council asked. |
| B-255 | Breakdown tooltips, the rest | Done | The NPC builder now shows what each graded statistic is worth beside its grade (B-065), which covers the graded tiles. Still without a parts list, and left so: skill error range, the vehicle sheet's figures, initiative cards (Foundry posts those itself) and the extra dice on a damage card. The live check of the tooltips that exist stays under Live checks owed. |
| B-263 | Bloodbath (p.406): free critical, every effect free, no refusal | Done | Row lost in the 2026-11-27 merge, and the Bloodbath handling was lost with it (the quality did nothing). Restored in criticalPlan: under Bloodbath an agent's or special character's critical hit has its one die included, a dearer effect pays the difference, a standard NPC pays as usual, and a Triumph's included critical is the same die. The card names the attacker's 1-die refusal; spending that die is done by hand. |
| B-264 | Cakewalk (p.406) | Done | Row lost in the 2026-11-27 merge. Already in code: module/apps/cakewalk.mjs. |
| B-192 | Unchosen roll of a choose-twice check not attached to the message | Done | Row lost in the 2026-11-27 merge. The unchosen roll of a choose-twice check is attached to the message (rolls.mjs, alternativeRolls). A second delivery roll is its own card. |
| B-269 | Animals (p.445): combat action list not checked | Parked | Row lost in the 2026-11-27 merge. Already checked: the skill checks an animal may make, and the grapple benefits it may not choose. The rest of the p.445 action list has nowhere to be checked, because an NPC's combat action is not chosen from a list; it waits on B-191's action model. |
| B-258 | Table of Ouch healing time not rolled or counted down (pp.142, 332) | Parked | Row lost in the 2026-11-27 merge and still true. The injury row shows its healing time and takes Surgery and Healed; rolling the time and counting it down per mission needs the mission-start hook to own injuries, a medium change kept for its own pull request. |
| B-261 | Historical (p.407): dated item not taken as a gadget pick | Parked | Row lost in the 2026-11-27 merge and still true: an item not yet introduced is priced at its gadget Caliber but not taken as a gadget pick. Needs the gadget-housing model B-191 lists. |
| B-265 | Blast in a confined space (p.343) | Parked | Row lost in the 2026-11-27 merge and still true. Blast geometry is a GC decision by design (B-190), so cut-off increments have no source; the GC adds the extra damage by hand (p.343). |
| B-266 | Triumph (p.331): effect on witnesses is a card note | Parked | Row lost in the 2026-11-27 merge and still true: the Triumph card names its effect on witnesses (p.331) and the GC asks for the checks. Who witnessed it is a table call. |
| B-180 | Campaign qualities: remaining paths (pp.406–408) | Parked | A running status row, not one task. Everything it lists as executing is in code. What remains is by design the GC's call (whether the source of a scene effect succeeded; how much of a long task a timing change covers) or waits on the gear model (reserve and NPC gear Caliber). Bloodbath was found lost in a merge and restored under B-263. New gaps get their own small row. |
| B-183 | Falling: interrupted and historical cases | Parked | Falling is settled end to end. Token movement and the action a fall costs stay table actions by design; no interrupted or historical case is known to fail, so nothing is left to schedule. |
| B-186 | Advanced Grapple map assistance | Parked | Core Grapple is complete. The remainder (crowds of mixed Size, positions, joining, forced movement) needs token positions the system does not read; the GC reviews these by hand. Animal permissions outside Grapple are under B-269. |
| B-187 | Audit of once-per-trigger workflows and partial Undo | Parked | An open-ended audit. Every once-per-trigger path the reviews named now keeps its claim through reload, deletion and Undo. No failing case is on record; a new one gets its own row with the steps. |
| B-188 | GC corrections for finalized NPC Defense decisions | Parked | Defense boosts and DC boosts execute with recovery and Undo. Correcting an already finalized NPC Defense decision is rare and is done today with Undo plus a fresh roll; a correction tool waits for a table that needs it. |
| B-189 | Audit of remaining NPC feats and class abilities | Parked | A running audit of NPC feats and class abilities. Shared numeric support, special damage types, conditions and stress saves execute. What remains is ability-by-ability coverage with no ranked list; each gap found in play gets its own row. |
| B-190 | Cover-value and skill-distance map assistance | Parked | By design: blast geometry, numeric cover and contained blasts are GC decisions, because the system does not read walls or positions. Map assistance is a feature for after the first campaign. |
| B-191 | Rules not modelled | Parked | A list of rules not modelled, kept as the record of what the GC runs by hand: team and directed checks, Joint Action's shared Count, Terminal Situations, spreading fire or gas, contagion, weapons as gadget housings, conveyance bull rush, unarmed Trip, Feint and grapple variants. Each is a feature of its own. Table 5.6's Size change to armor-piercing needs a ruling first: the table and its example disagree (see the open decisions). |
| B-193 | Source-to-data audit of classes, origins, feats and gear | Parked | The data audit reached 9.9 of 10 for assisted core play. The remainder is maintenance: footnotes on unusual origins, feats and gear, and imported histories, fixed as they are met. |
| B-194 | Companions and Origin-only creation: imported histories | Parked | Companions and Origin-only creation execute with reload and Undo. Imported classless histories are reviewed case by case; none is waiting. |
| B-195 | Drained: contagion, advancement and held benefits | Parked | Drained executes for PCs and NPCs with recovery and Undo. Still by hand: passing it on by contagion (not modelled, B-191), gaining a level while Drained, and reviewing items or timed benefits held at the time. |
| B-200 | No code throws Refusal | Parked | About 2,400 throw sites would each need a judgement on whether the message is a refusal meant for the user or a fault. No bug is traced to it today. Do it one module at a time when a catch block next hides a real fault. |
| B-201 | resolveSkillCheck takes about 150 options | Parked | A large refactor of the most-tested function, with no change a player would see. Not before the first campaign; split one family at a time, behind the existing golden tests. |
| B-202 | Dialogs built as single-line HTML strings | Parked | Mechanical and large. This pass moved every input dialog onto one Cancel, a named main button and focus return through the themed wrapper, which was the user-facing part. The string-built bodies are reworked when each dialog is next touched. |
| B-203 | Final-attack workflow not unified | Parked | Nine abilities still use their own final-attack path, each with its own passing tests. Moving one is a careful change to a paid, once-only workflow; do one ability per pull request. |
| B-204 | Action-die spend makes about 10 round trips | Parked | Needs a measurement inside Foundry first, which a cloud session cannot take. Reopen with timings from a live table if a spend feels slow. |
| B-205 | Chat-log scans with no index | Parked | No slowness is reported, and an index would have to be kept correct through deletes and Undo. Reopen with a measurement on a long chat log. |
| B-206 | Helper copies and no innerHTML lint | Done | A new tools/test-code-health.mjs caps innerHTML assignments at the 4 that exist. The helper copies (esc, whole, say, post) are one-line aliases; merging them is churn across 100 files with no behaviour change, so they stay. |
| B-207 | Actor mixins mix persistence, rollback and dialog HTML | Parked | A large restructuring of the actor mixins with no visible change. Not before the first campaign. |
| B-208 | Derived data recomputed too often | Parked | A performance row with no measurement. Reopen with a profile from a world of table size; the reset on mission change is what keeps sheets correct today. |
| B-209 | Layering: documents and rolls import from apps | Parked | The import counts are capped by tools/test-module-graph.mjs so they cannot grow. Lowering them means moving dialogs out of documents and rolls, which is B-207's work. |
| B-211 | Settings registered with no key list | Done | tools/test-code-health.mjs now holds the one list of all 43 settings with the file that owns each, and fails when a setting is added, moved or registered twice without the list. Keying by display name and unmarked test-only exports stay as they are: no fault is traced to either. |
| B-212 | Template duplication and hidden edit markup | Parked | Eleven separate template clean-ups, each a medium change with layout risk. None changes what a player sees. Take one when its template is next opened. |
| B-213 | Templates outside the formatter | Parked | The row itself says to do this last and one file per pull request, because it rewrites every template line and hides other diffs. |
| B-214 | Tests and tooling | Done | The 28 unused-variable warnings are cleared and the lint now allows none. One of them was a leftover Hybrid currency helper already replaced by the campaign policy. Still open by choice: a shared Foundry stub for the test files, a test inside Foundry, checkJs and a chat-card helper are each their own project. |

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
| Mission history | Several stored missions, or export and import of one | Stored drafts and completed snapshots (B-050); it changes stored data, so plan a migration |
| Bloodbath and dearer critical effects (p.406) | The page makes the threat a critical hit for free; it does not say whether a 2 to 4 die effect is free too | As built on 2026-11-28: the one-die critical is included and a dearer effect pays the difference. Say so if every effect should be free |
| Bloodbath: declining the critical | Spend the attacker's die from the card, or by hand | By hand today; a card button if the quality sees play |
| Table 5.6 Size change to armor-piercing (p.335) | The table and its worked example disagree on whose Size counts | Left to the GC until Sacha rules |
| Work the 2026-11-27 merge set aside | That merge joined two lines with no shared history and kept the reviewed one where they differed, so some of main's work from 25 to 27 November is no longer in the code. Bloodbath, the Delay line and eight backlog rows were found and recovered | Sacha says whether a file-by-file comparison against commit 75b2b1b is wanted; nothing is known to be broken |
