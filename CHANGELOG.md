# Changelog

## Unreleased

- Invalid saved vitality can now be corrected through Review vitality. Rolling refuses impossible saved values;
  a confirmed correction preserves the previous value in its review history and does not reroll or heal.
- Laser attacks now ignore positive dodge bonuses and receive their critical-hit discount. Laser weapon damage
  uses the attack's measured range to remove base dice, reaching zero when all are lost. Direct damage rolls
  ask for missing distance; cancelled distance entry rolls nothing.
- Bulletproof and Gritty now change injury-save and massive-damage thresholds on damage cards. A pending save
  retains the thresholds used for its hit even if campaign policy changes before the save is rolled. Conflicting
  injury policies require a GC choice before lethal damage can be applied.
- Fast/Slow Attributes, Feats, Proficiencies, Interests and Growth now change character creation and level-up
  calculations. Interest awards keep their first additional pick at level 2, then use the campaign spacing.
  Attribute choices retain their saved level keys when campaign policy changes.
- Underwater melee attacks now carry their declaration into damage. Weapons using Strength deal half standard
  damage, rounded up; separate sneak attack dice retain their own rules. The damage card explains the reduction.
- Foibles now adds its conditional dodge bonus when resolving an incoming attack and its damage reduction when
  applying lethal or subdual damage from a covered weapon. The incoming-attack preview offers the weapon's
  proficiency; attack cards carry it forward automatically. Vulnerability removes the dodge bonus, while
  armor piercing and subdual doubling apply to the damage reduction normally.
- Creation review now keeps invalid base attributes and unassigned attribute increases in the setup checklist.
  Later vitality gains must be whole results within the class die; invalid saved gains need review and no longer
  inflate maximum vitality. Saved choices remain available for correction.

## 0.8.7 — 2026-11-25

- **Tooltips that show where a bonus comes from.** Every button on a character sheet that shows a roll bonus now
  lists its parts on hover or keyboard focus, one per line, ending in a total that matches the button: attributes
  (what the score is made of, then its modifier), saves, Initiative, skills (each total when a skill has two
  attributes), Knowledge and each weapon's Attack button, on the Play tab, the Skills and Gear tabs and the NPC
  sheet. A bonus of +0 or below is explained too. Roll cards in chat do the same on their result: the die, each part
  of the bonus and the total, with anything a rule added at roll time. Damage cards list the parts of their flat
  bonus. The cards are no taller than before. An NPC's parts are shown only to the GC.

## 0.8.0 — 2026-11-25

- **Characters kept on tokens move to the Actors list (world update, schema 7).** An agent or companion whose sheet
  was edited from an unlinked token kept those edits on the token only. The update now copies what each such token
  holds to its character in the Actors list and links the token, without waiting for the GC's link review. It starts
  with the scene the GC is on and covers every scene. A token whose character was deleted from the Actors list gets a
  new character built from what the token holds. When two unlinked tokens of one character both hold changes, only
  the first is copied; the other stays in the link review so neither is overwritten unseen.
- **Agent tokens stay linked.** An agent or companion token placed unlinked is linked as it is created when it holds
  nothing of its own, and Import Data on an agent keeps its token linked even when the file comes from an older
  version with unlinked tokens.
- **Dice bar under the chat log.** **Roll d20** rolls 1d20 straight away. The d4 to d20 buttons and the −/+
  modifier write a roll such as `/r 1d8+2` in the chat box; press **Roll** or Enter to roll it, or edit it first.
  Clicking a die again adds another (`/r 2d6`) and right-clicking takes one away; a right-click on − or + steps the
  other way. Ctrl-click (Cmd-click) on any of them adds the step and rolls at once. Shift-click on any roll
  button rolls with advantage (each die twice, keep the highest) and Option-click (Alt) with disadvantage. The cursor stays in the chat box between clicks, and the bar starts over once the chat box is sent or
  cleared. While another sidebar tab is open, the bar sits just above the chat box there.
- **Shorter check cards.** The header names the roller by code name (or the name without the token's role), with
  the full name as its tooltip, and keeps one line of what was rolled. Rule notes such as error and threat ranges,
  and the System / You and GC reminder, move into a closed **Details** at the foot of the card. The next-step
  sentence under Pending, Hit and the other states is now a hint on the ⓘ beside the title.
- **Second council, live part.** Four reviewers ran the GC side on a test build. Fixed from what they saw:
  - Undoing subdual or stress damage on an agent no longer leaves a damaged record that blocked every later hit of
    that kind. Vitality and wounds that moved again since the step get back what the step took. A hit that could
    not be recorded does not mark its card as applied.
  - Alt+B boosts the card under the pointer in a popped-out chat log too. A boost or critical bought from a card
    leaves no Undo note, because the note could not take it off the card.
  - A readied action that goes off after the combatant's turn, or a Delay on someone who has already acted, no
    longer gives a second turn in the round. Previous turn stops at the first turn of round 1.
  - The console's Game clock heading no longer collapses to one letter a line. Combat stays on screen in every
    view while a fight runs, a defeated combatant gets no action buttons, and another scene's fight does not
    redraw the console.
  - Begin session and Next scene say when a session has begun or a fight is running. A listed antagonist is marked
    faced when it is in a started fight.
  - The Damage save card's large number is the save total. Add NPC to scene starts in the search field and shows
    the chosen row. Delay and Ready lines for NPCs go to the GCs only.

- **Gear by the game clock's year.** Every gear, weapon, armor and vehicle entry now has the year it came out: the
  book's Year column where it prints one, and our own dates (from public history) for the rest. The browser hides
  anything newer than the year on the game clock; **Show future gear** lists it again, marked "Not yet". With no
  date on the clock nothing is hidden and the box is greyed out, with a note to set a date. The browser also filters by Caliber, and gear and vehicles by restriction.
- **Period gear.** Twenty house items fill gaps where a kind of gear had nothing from 1939–1949: a 60mm mortar,
  a wired bug, a radio homing beacon, an infrared viewer, an early parabolic microphone, a police-band receiver, an
  early portable radar, an early phone tap, a polygraph, a flare pistol, a line-throwing gun, dried plasma,
  amphetamine tablets, sulfa and field dressings, a subminiature camera, a 16mm movie camera, a wire recorder, an
  early helicopter, an early infrared sight and a time-pencil detonator. Each is marked as a house item and names the
  book entry its numbers come from.
- **World update (schema 6).** Gear, weapons, armor and vehicles already in a world or on a character take their
  compendium entry's year. A world that keeps its own imported copies of a gear compendium gets copies of the new
  period items too.
- **Second council, fixes to the changes above** (none of them had been released):
  - End mission, Resume and the mission dialog no longer write back an old copy of the mission, so an objective
    ticked while a question is open is kept. The standing award re-reads who was paid after its dialog and cannot pay
    an agent twice from two dialogs. Start mission refuses on an active mission, and asks before clearing any record
    that holds results, including one ended by an older version.
  - A wounded NPC whose maximum falls and comes back (End then Resume, or a type switched and switched back) gets
    its damage back instead of being healed.
  - Undo works on a standard NPC's first Damage save, asks only when a value really changed again, runs once however
    often it is pressed, takes back the fluid initiative event the damage recorded, and is visible to the GC for a
    step a player took.
  - The turn stays with the acting character when a readied action goes off, someone delays off-turn or Initiative
    is rolled mid-fight. Mob attack runs only on the group's turn, with the members whose turn has not passed.
  - A hidden dialog field can no longer hold the main button, Cancel always closes, console buttons run once at a
    time, and a view chosen in one fight does not hide Combat in the next.
  - A threat range closed by a Henchman or Mastermind prints as none, not "20".
- **Test builds.** A "Test build" workflow packages any branch for the test server; see `docs/test-install.md`.
- **Ending a mission is safe.** End mission asks first and says what it does, the console shows the mission as
  ended, and **Resume mission** reopens it with nothing changed. The ended record still feeds the XP report and each
  agent's XP settlement. **Start again** on an ended mission asks, then clears the last run's completed objectives,
  antagonists faced, infractions, scenes and standing payout, so old results cannot count twice.
- **The standing award pays each agent once per mission.** The dialog lists who has been paid, a second press pays
  only those still unpaid, and a correction box pays again on purpose.
- **Threat Level bonus dice arrive whichever button comes first.** Begin session and Start mission can be pressed in
  either order; the second gives only the dice the first could not. The quickstart now lists Start mission first.
- **A new special NPC starts unhurt.** An NPC's vitality and wounds now follow their maximums the way an agent's do:
  a new NPC that becomes a special character starts full, a Threat Level change moves a hurt NPC by the same amount,
  and existing NPCs keep their current values.
- **The combat tracker's right-click menu is back on Foundry 14**, with new one-step entries: **Delay 1 Count**,
  **Delay…**, **Ready an action** and **Readied action triggered**. A readied combatant is marked on its row.
- **Henchman and Mastermind critical rules are applied.** An attack that names such an NPC as its target threatens
  on a narrower range and its critical hit costs more action dice; the attack card says so.
- **A fight begun by any GM starts flat-footed.** The lead GM marks the fight whoever pressed Begin combat.
- **Group Initiative rolls NPCs only.** An agent no player owns is named in the report instead of being rolled.
- **The GC Console has Prep, Play and Wrap-up views.** It picks one from the state of play and keeps your choice
  until that state changes. Prep carries a first-session list that ticks itself; Wrap-up lists the closing steps.
  The strip at the top now names the mission, the scene period, the round and whose turn, and GC dice left of the
  starting number.
- **The console can run a turn.** Its Combat section shows the acting combatant with Defense, health, conditions,
  half actions left and a button per weapon, and follows the fight as turns change. Each row opens that combatant.
  **Mob attack** rolls one attack for every standing member of a group of identical standard NPCs and moves the turn
  past them.
- **The console keeps its place.** A redraw no longer drops the scroll position, keyboard focus, search text or the
  open "More mission tools" list.
- **Shortcuts keep working after a mouse click.** Alt+B now acts on the card under the pointer or on your own newest
  card, never another GC's, and names the card. Alt+S waits for a turn change and follows the turn with one sheet.
- **Undo for steps that changed a character.** Applying damage, a standard NPC's Damage save and a GC action-dice
  spend each leave a one-line note, whispered to whoever did it, with an **Undo** button. Undo puts back the
  numbers, conditions and tracker state from before the step, returns the GC dice, lets the damage card be applied
  again, and warns first if a value has changed since.
- **The NPC builder comes first in Edit**, under a pinned strip of the numbers the choices produce. Renaming an NPC
  renames its prototype token and its placed tokens that still carry the old name, numbered ones included.
- **Console dialogs have a Cancel button, a named main button and the cursor in the first field.** The spend-dice,
  complication, fluid initiative, combat reference and disposition dialogs show only the fields for the option
  chosen.
- **Add NPC to scene places a group.** The list shows its rows, and the dialog takes a number of copies, placed on
  free squares with numbered names, hostile by default, hidden if wanted, joined to a running fight on its kind's
  Count, and optionally recorded for mission XP. It is also on the Play view.

## 0.7.0 — 2026-11-23

- **New agents start at full vitality, wounds and action dice.** A new agent starts at the Career Level 0
  maximums, and every build choice that changes a maximum (a class level, a vitality roll, Constitution, an origin,
  a feat) moves the current value by the same amount. In play, a raised maximum adds the increase and leaves damage
  already taken; a lowered one removes the same amount but never knocks a character out by itself. Existing agents
  keep their current values. The **Begin play** button is gone, since there is nothing left for it to fill. GC
  action-die awards no longer wait for it, and a new agent's first session start gives starting dice as for anyone.
  A character still opens in Edit mode while it has setup reminders and has not been through a session.
- **The system is now The Field Agent's Handbook.** Its rules data is used as Open Game Content under the Open
  Game License 1.0a, which forbids using another publisher's trademark to signal compatibility. The system's
  title, descriptions, sheet names, compendium folder and messages use the new name. The package id stays
  `spycraft2`, so existing worlds keep working. The OGL and its copyright notices ship in `LICENSES/`, and
  `LICENSING.md` lists which content is Open Game Content.
- **Agent tokens are the agent.** A player who opened an agent from its token on a scene could edit a copy that
  belonged to that token alone, so the character in the Actors list never got the changes. Agents and animal
  partners are now always placed with linked tokens. On the first load, existing agents and companions are switched
  to linked tokens, and so are placed tokens with no changes of their own. Any placed token that does hold changes
  is listed for the GC: a ticked row copies the token's changes to the character, then links the token.
- **Players can change their pictures.** Foundry's file browser needs the "Use File Browser" permission, which
  players do not have by default, so clicking a portrait did nothing. Players now get a small dialog that takes a web
  address or a Data folder path, with a preview. Users who can browse files still get Foundry's picker.
- **The ownership review says what it did.** After the GC applies it, the GC is told who now owns which character,
  and the player sees a notice that they can now edit the sheet. The review's rows no longer split the description
  into a separate column.
- **Style-guide audit, rules and results.** The Dying button follows the character's size instead of a fixed
  −1 to −9 band. A standard NPC built by hand no longer shows vitality and wounds boxes it does not use. Attack
  cards say "Critical hit" and "Critical miss"; other checks keep "Critical success" and "Critical failure". Threat
  and error ranges print as die faces ("threat range 19–20", "error range 1"). An unconfirmed result reads "Threat,
  if it succeeds" or "Error, if it fails".
- **Chat cards use one set of state words.** The guide at the top of a card reads Pending, Hit, Miss, Success,
  Failure, Damage rolled, Damage applied or Finished, with an icon and an edge colour for the outcome and "16 → 25"
  when action dice changed the total. The closing button is "Finish". The critical button names what it activates,
  and the full action-dice dialog is a ▾ beside the one-click spend.
- **Agent sheet in play.** Conditions on the rail carry a one-line reminder of what they change. The Defense tile
  opens the incoming-attack check and shows the flat-footed value. Action dice are read-only with a pencil for
  corrections; rarer rail actions sit under "More". Weapon rows show threat range, error range and range as one line,
  and untrained weapons say so in words. The Play tab lists trained skills, abilities with limited uses, active
  effects, and a "Your turn" strip with End turn.
- **NPC sheet reads as a stat block.** Health and conditions are in the header, the Damage save is one primary
  button with the track beside it, and editing controls appear only in Edit mode. The NPC window opens at 480px
  and can be narrowed to 420px. Skill rolls made openly no longer print the bonus breakdown to players.
- **Dialogs.** Attack dialogs have a Situational modifier field. Named skill checks list names only and show the
  selected check's detail under the list. Attack, skill and damage dialogs end with "What the system does for you".
  The critical dialog names the result it activates. A GC opening a dialog finds the GC confirmations ticked, with a
  note saying how many. Footer buttons use sentence case.
- **Items and vehicles.** Feat confirmation boxes and prerequisite data are shown to the GC only. The vehicle
  thresholds line is one sentence. "Tyre" is spelled "tire". The item browser opened without a character no longer
  hides unqualified entries. Numbers glued to words in about sixty messages have their spaces back.
- **Combat tracker and keyboard.** The token HUD lists this system's conditions only, by their sheet names, plus the
  few core entries Foundry itself reads. Tracker rows say "flat-footed" and, for characters you may open, the wound
  state; the half-action count uses a proper plural. Six rebindable shortcuts are registered: next and previous
  turn, the GC Console, the acting character's sheet, the main button of the newest card, and GC boost
  (see `docs/gc-tools.md`).
- **GC Console.** Combat moves to the top while a combat exists and has one primary button. Mission, XP and GC
  action dice read as labelled values instead of one glued line. Rare mission buttons sit under "More mission
  tools". Row buttons are verbs ("Mark complete", "Mark faced", "Remove"), and empty lists say what to press.
  Section titles are 13px sentence case.
- **One name for the GC's dice.** Messages say "GC action dice" where they said "GC pool" or "session pool";
  "AD", "HP", "saving throw" and "next GM launch" are written out in the table's own terms.
- **Docs.** `docs/gc-quickstart.md` walks a new GC from an empty world to the first combat; `docs/gc-tools.md`
  gains "Running a combat turn" and a keyboard table.
- **Chat-card buttons tell the truth.** The line under a chat-card button said "Action finished" when the action had
  been refused, when the character was busy and when the dialog was closed. It now says "Not done" with the reason
  for a refusal, shows nothing after a closed dialog, and says "Action finished" only when the action ran. A refused
  step inside a limited-use ability now hands the use back.
- **Hover help written for a button is shown.** A pass that runs after each draw replaced the help written for a
  button with a short label, often the button's own text. Written help now stays, in full; the short label is used
  only where no help was written.
- **Buttons answer the pointer.** Secondary buttons in sheets and dialogs had lost their hover colours to an older
  style rule.
- **Dark theme: tabs and section bars are visible.** The bar colour was almost the same as the dark background. The
  rule under the tabs and table heads, the edge of section bars and portraits, and a mark on the current tab now use
  colours that stand out. The light theme is unchanged.
- **Typing is not lost to a redraw.** When a sheet redraws while a field is being typed in, the unsaved text and the
  caret are kept. A button pressed with the keyboard keeps focus after the redraw. Adding or removing a row waits for
  the save already under way, so text typed just before the click is kept.
- **Taller roll dialogs.** A dialog's body used to stop at half the screen height (360px at 1280×720). It now uses
  the height left after the header and footer, and scrolls as one box.

- **Shorter chat cards.** A card's main button still fills the row; its other buttons now share one wrapping row
  instead of taking a row each.
- **Hover is not a warning.** Links and text buttons turned red on hover, the colour kept for harm. They now take the
  action colour and an underline. The over-budget badge on the creation track is readable in the dark theme, and
  the GC Console's section arrow no longer animates for people who ask for reduced motion. Twenty labels set at
  12px (chat search results, console and builder captions) are now 13px, the smallest size the style guide allows.

- **Under the hood: tooling.** Layout tests now load the same stylesheets, in the same order, as a world does, and
  check the agent sheet at the sizes it opens at on 1280×720 and 1366×768 screens. Lint fails if the number of
  warnings grows, and a test stops template lines from getting longer. `npm run check:schemas` no longer exits
  cleanly when it could not find Foundry. Dependabot watches npm and the CI actions. `docs/architecture.md` maps the
  layers and lists what to touch when adding an ability. Seven style rules that matched nothing were removed. The stylesheets are now formatted by
  Prettier and checked by stylelint; the reformat changes no rule.

- **Fewer redraws during a conflict.** A change to scene state or to a Dramatic Conflict used to recalculate every
  character and redraw every sheet on every client; it now redraws the GC Console only. A mission or campaign change
  still recalculates everyone, but redraws only the sheets that are open.
- **Under the hood.** The function that derives an agent's numbers is split into fifteen named steps; a new test
  fingerprints every derived property of the sixteen sample agents at four levels and fails if any of them moves.

- **Text you write looks like text.** A heading in a biography or an item description was drawn as a sheet section
  bar, tables were centred, and links turned red on hover. Rich text now keeps plain headings, left-aligned tables
  and the normal link colour.
- **Lighter icon artwork.** The painted icon sheets went from 18.5 MB to 1.3 MB with no change at the sizes they
  are drawn. Four images nothing used were removed.
- **Renamed or translated feats keep their buttons.** Feat buttons on the Feats tab, the focus a named skill check
  falls under, and the Size modifier on Hide were chosen from displayed English names. They now use the rule name
  and the check's id, so a translation cannot switch them off.

- **The browser keeps the search box while you type.** Typing in a browser's search or changing a filter redrew the
  whole window, filters included. Only the result list is redrawn now, and each entry's summary is worked out once
  per open window. Prerequisites are still checked on every draw.
- **Smaller downloads at start-up.** A release now ships its code as one script instead of several hundred files,
  and the English language file holds only the 34 strings Foundry reads by key (the full list for translators moved
  to `lang/text-template.json`, which is not shipped).
- **Under the hood.** One dialog builder (`formDialog`) now draws 52 option dialogs with the same markup as before;
  shared helpers replace repeated copies of the final-attack flow, the damage reservation, equality checks and
  receipt lookups; sheet actions are registered from lists and a test fails if a template button has no handler.

- **Attack dialogs open on a Standard Attack.** The ranged attack dialog, and the quick melee and CQB attack
  controls, used to start on "Other attack", so Aim, Burst and miss tricks were refused until the action was changed.
  They now start on Standard Attack; Other is still one click away and a remembered choice is kept.
- **Players can observe new characters.** A new agent now gives every player Observer access (world setting
  "Default player access to new characters": None, Limited or Observer).
- **Character ownership review.** When the world loads, and when an agent is created, renamed or assigned to a
  player, the GC is offered any missing ownership in one dialog: the default player access, and Owner for the player
  the agent is assigned to or whose user name appears in its name ("Breakwater (Sacha)"). Nothing changes until the
  GC applies it; unticked rows are not offered again unless the proposal changes. World setting "Review character
  ownership" turns it off.
- **Flat-footed ends when a character acts.** It used to clear only when the character was hit, so anyone who had
  already acted was still attacked at their flat-footed Defense for the rest of the round. It now also clears as the
  combatant's turn begins (p.342), except in a surprise round their side did not win.
- **CQB damage reuses the attack's distance.** Rolling damage from an attack card no longer asks again for the target
  distance that card already recorded. When a distance really is missing and is left blank, the roll now says so on
  screen instead of quietly posting nothing.
- **Melee attacks check Reach on the map.** With one token targeted, a melee attack on a target beyond the weapon's
  Reach (p.327) is stopped for players, with a note to move closer or ask the GC. The GC is asked to confirm before
  going ahead.
- **Delay no longer skips anyone.** When the acting character delays, the turn now passes to whoever is next, so the
  characters between the old and new Count still act (p.356).

- **Critical hits on damage cards, follow-up fixes.** A Table of Ouch critical on a special NPC now rolls and reports
  the injury on the spot instead of leaving an ordinary hit. A player whose agent was hit by someone else's attack can
  now roll the Ouch injury from the row they already use to take the damage, and applying a critical Burst or Autofire
  to their own agent now marks the first shot as used, so later shots no longer default to critical. An Ouch critical
  marks the first shot as used too. The extra failed saves a standard NPC takes from a critical now follow the effect
  bought, even when a discount and a Shaken surcharge both changed the price.
- **Chat theme:** button rows added below a card in a dark chat log now use the dark colours as well.
- **Copied-text check:** a label match no longer hides a copied sentence in the same string, a run is only reported
  when it continues one place in the book, and a rulebook path that does not exist now fails instead of passing.
- **GC-arbitrated locking recovers faster.** With "Resource locking" set to the GC's client, a GC tab that is in the
  background or frozen used to make every spend wait five seconds before falling back. The wait is now under two
  seconds; for the next minute the GC is asked only briefly (under half a second) before falling back, and the player
  sees one notice instead of a delay on each spend. A GC that answers again is used at once, so the locks it holds are
  respected, and the GC refuses its own lock on a character that already carries a character lock. The default setting
  is unchanged.
- **Module layout (no change in play).** The transaction, GC dice and period services moved from `module/rules/` to
  `module/services/`, so the rules folder holds only rules that run without Foundry. Macros or modules that import
  `systems/spycraft2/module/rules/transactions.mjs`, `gc-dice.mjs` or `periods.mjs` need the new folder name.
  Three import cycles between rule files are gone, an unused progression helper was removed, and a test now fails on a
  new import cycle or on a chat-card button changing position.
- **Faster first load after an update.** When a new version updates a world's data, each character's items are
  written together instead of one at a time, one notification shows how far it has got, and the shaken and Power
  Stance trackers catch up once at the end instead of reacting to every write. The sample scenes, folders, GC tables
  and soundtrack are added only after the update finishes. An item that cannot be updated still never holds back the
  others; the update is retried next time, as before.
- **Release pipeline:** a release now runs every check a pull request runs (lint, formatting, packs and sheet
  layouts) before packaging, refuses a tag that does not match `system.json` and the changelog, and attaches
  checksums. Prereleases are packaged by the same workflow. `npm run release:check` does the same check locally and
  scans for copied rulebook wording. CI also fails when the build changes committed generated files. Four one-off
  workflows for old tags and deleted branches are gone, and lint now rejects Foundry's deprecated globals.
- **Refusals are reported as refusals.** About 200 places that warned and stopped ("roll the save first", "no
  helper has posted yet") used to hand back the warning itself, which the code treated as success: a chat button
  said "Action finished", and a follow-up step carried on with the warning as its result. They now report "Not done:
  see the warning" and stop cleanly. Warnings themselves are unchanged.
- **Safer chat text.** Class names in the vitality prompt, hazard names on save cards, and attack and activation
  sources in check notes are escaped. A check card shown in another language keeps only simple formatting from the
  poster's record.
- **Chat theme:** system messages in the chat log now follow the interface theme, like the messages around them, so
  a dark sidebar no longer shows paper-coloured cards when the windows use the light theme (or the other way round).
  A popped-out chat log follows its own window. Short system notes (ammunition, healing, round reminders and the
  like) now pick up the dark colours too; they used to keep light-theme text colours on a dark background. Their
  size is unchanged.
- **Dialogs:** the blast, numerical-advantage and timer dialogs name every field for screen readers (each row says
  which character it is about), and the numerical-advantage side headings are translatable. Icons beside button
  text are hidden from screen readers so each button is announced once. The agent sheet no longer rewrites its
  markup on every render, since its templates now author buttons themselves.
- **GC console:** its row actions (complete, faced, ignore, remove, next step, manage) are real buttons, and section
  titles are plain text inside each disclosure, so screen readers announce one toggle per section instead of a
  heading buried in a button. The console looks the same.
- **Item sheets and the catalog: real buttons.** Pay, refund, issue, repair, battery, signal, gadget and planning
  actions on item sheets, and entries in the catalog list, are now buttons that still read as text in their sentence.
  Bonus and mechanism rows have named add and remove buttons, and the catalog's search and group fields are labelled.
- **NPC and vehicle sheets: real buttons.** Their actions (and the hazard tools shared with the agent sheet) are now
  proper buttons that take Tab, Enter and Space everywhere, with names for the icon-only ones (remove, leave the
  vehicle, unlink driver or mount). Hovering one now behaves like the agent sheet's buttons. Name, type, attribute
  and Base Attack Bonus fields are labelled for screen readers.
- **Agent sheet: clearer for keyboard and screen-reader users.** The skill-level picker shows which level you are
  spending points at again (it lost its highlight in an earlier redesign) and announces it as pressed. Icon-only
  buttons (vitality roll and record, share, remove, add and remove rows, refresh grants) have proper names; the
  ability and skill table fields say which ability or skill they belong to; and the remaining English-only labels on
  weapon and gear rows are translatable. The sheet looks and works the same otherwise.
- **One palette for every surface.** The older sheet styles kept their own blue, red and green, which showed on some
  light-theme cards instead of the system's palette. They now use the shared colours, so warnings read a slightly
  deeper red and confirmations a deeper green. Small labels (outcome stamps, round pips, panel captions, chat search)
  are at least 12px. Keyboard focus shows the same ring everywhere, and chat search follows Foundry's theme.
- **Rules refresh review:** ticking a change no longer opens or closes its details.
- **Origin text on the agent sheet** now hides GC-only secret blocks from players and resolves its links, like other
  rich text.
- **Shorter buttons on attack and damage cards.** Labels that were cut off in the chat column are now a few words
  (for example "Resolve vs Defense 15: hit", "Check Defense", "Lucky Break: it misses"), and hovering a button shows
  its full wording, including the target's name. A label that is still too long wraps inside its button instead of
  being clipped.
- **No more stuck "resource transaction is in progress" after a closed tab.** The Shaken Initiative bookkeeping that
  runs when someone joins briefly marks a character as busy. If that browser closed mid-step the mark stayed, and
  every action-die spend on the character was refused until the GC recovered it by hand. Such a bookkeeping mark is
  now cleared automatically once it is 30 seconds old. A mark left by an interrupted player action still waits for
  the GC, as before.
- **The builder holds its place on an overspent budget.** Spending more attribute points or skill points than the
  budget, or buying skill ranks over the maximum, now adds a red reminder on that step. The step badge turns red and
  "Next setup step" stays on it until the spend is legal again, instead of moving on as if the step were finished.
- **One starting point on a blank sheet.** Talent and specialty reminders now belong to the Origin step, so the creation
  track and the "Next setup step" button both start at Attributes. Weapon proficiency picks count toward the Class step.
- **The Feats badge counts open slots,** not reminder lines, so three open slots read 3.
- **Begin play asks first on an unfinished character.** It lists how many setup reminders are still open, because
  starting action dice are granted only once. A finished build says "Ready to play" in the setup panel.
- **A new agent's first weapon arrives equipped.** Later weapons still arrive unequipped.
- **Agents made with Create Actor get a friendly, linked, sighted token,** like the sample agents, so the map token and
  the sheet are the same character.
- **Skill-history problems no longer block unrelated feats.** A feat whose prerequisites do not read skill ranks is no
  longer marked unmet because of an over-cap skill elsewhere.
- **Half actions are counted for you.** Attacks, Disarm, reloads and Total Defense taken from a character's sheet
  on that character's own turn now mark their time on the round tracker. If the turn had too little left the action
  still stands, and the player is told to check with the GC. Pips can still be clicked to correct the count.
- **Begin combat names anyone without Initiative.** The GC can roll for the NPCs and send the players a reminder
  first, or begin anyway. Someone who rolls after the start would otherwise miss the first round.
- **Skill checks open on one a player can simply roll.** Active checks come first, then passive, then secret ones,
  and checks that need particular gear come last and say so.
- **Attacks on your agent.** The attack card's button now reads "Check Defense for (name)", and it starts with what
  the card already knows: a ranged attack is ticked and the recorded distance is filled in. The player also gets a
  notice when the card is posted. "Boost Defense" is gone from the card, because an action-die boost is declared at
  the start of a round (p.62), not against one attack.
- **Critical hits are easier to activate.** "Damage has not been rolled" now starts ticked while no damage card
  answers the attack. The list of paying agents now shows only the agents in the fight or on the scene.
- **Total Defense in place needs no route confirmation.** Only movement needs the GC to confirm a route, and the
  full-action box now starts ticked.
- **Refusals are warnings.** A rule refusal ("roll the save first") now shows as a yellow warning, without an error
  and stack trace in the console. Real faults still show as errors.
- **Shift-click attacks need a target.** With no single target, the attack dialog opens instead, so the range can be
  entered. Before, the attack posted with no range penalty.
- **Tab works on sheets, dialogs and chat cards.** Inside the system's own windows, Tab now moves focus. Foundry's
  view-cycling key no longer takes it once focus reaches a sheet tab or a card button. Dialogs keep focus inside
  them: Tab past the last control wraps to the first, and Shift+Tab goes the other way.
- **One primary button per card.** After an attack is resolved, "Resolve against Defense again" is a quiet
  correction, not a second main button. "Roll damage" stops being primary once every hit has its damage card. A
  damage card with nobody to apply to in one press makes "Apply damage to a target…" its main step. Once damage is
  applied, the card stops offering boosts.
- **Cover when resolving an attack.** "Cover, other target or Defense…" now has a cover choice (one-quarter to
  three-quarters, +2 to +6 Defense, p.345). The card records the cover, and a miss caused only by the cover says the
  shot hits the cover.
- **Add NPC to scene.** The GC console's Antagonists section has a new button. It opens a searchable list of world
  and compendium NPCs and places the chosen one at the centre of the view. A compendium NPC is imported once and
  reused after that. The old Add button is now "Record for XP", which is all it ever did.
- **Sheets open where you left them.** Agent and NPC sheets remember where this browser last closed one and open
  there, fitted to the window, so a sheet moved off the map stays off it.
- **Light theme:** the save status in a sheet's title bar and the mission state in the GC console are readable on
  the dark bars (they were 2.5:1).
- **Vitality and Wounds explain themselves** on hover, in one line each.
- **Turn controls in the GC console.** The Combat section has Previous turn and Next turn (or Begin combat), and it
  marks whose turn it is and who is defeated, so running NPC turns no longer means flipping to the Combat tab.
- **Defeated combatants are skipped.** The world update turns on the combat tracker's "skip defeated" setting once.
  A GC who prefers the old behaviour can turn it off again in the tracker's settings.
- **Lightning Reflexes starts on the higher Initiative roll,** and closing its dialog keeps the higher roll.
- **Accurate and other two-dice boosts say so.** The quick boost button shows the dice actually rolled (+2d4, not
  +1d4), and the chat note says "rolled 2 dice".
- **Levels above the character's XP get a warning** from Career Level 2 up (Table 1.3, p.27). The GC can still grant
  levels directly.
- **An unfinished agent opens ready for building:** with setup reminders open and play not yet begun, the sheet
  opens in edit mode.
- **Browsers:** Enter in the search box adds the selected entry, or the only one that matches. Choosing a talent or
  specialty closes the browser.
- **Attacking with a stowed weapon** now shows a reminder that it is not equipped. The attack still goes ahead.
- **Busy-character notices wait a moment.** When a resource transaction is still running, the system now waits up
  to about a second before reporting it, so a player who just opened a sheet rarely sees the notice.
- **Text:** the talent is now spelled "Privileged". It keeps its compendium id, and a character who already has it
  takes the new spelling from Review rules on the sheet. The missing-compendium message no longer tells players to
  run a build command. The Shaken review line on a sheet now names the character instead of starting with an empty
  name.
- **Full-action attacks are recorded as full actions.** Autofire, Strafe, Cover Fire, Suppressive Fire, Pummel and an
  untrained Disarm now use up the whole turn on the combat tracker. Before, every attack counted as a half action.
- **Hidden attacks stay hidden.** When the GC makes a blind or whispered attack on a player's agent, the player no
  longer gets the "is attacking" notice.
- **Resolve again without cover** now clears the cover chosen the first time. Before, the old cover bonus stayed on
  the card, and a miss could still say the shot hit the cover.
- **Add NPC to scene:** when a search finds no NPCs, nothing stays selected. Before, the NPC selected earlier could
  still be placed.
- **The one-click boost button** now shows the right dice when a class ability doubles them in the opening round.
- **Browser search:** pressing Enter straight after typing now applies the new search before adding an entry.

## 0.6.0 — 2026-11-20

- **Fixes from the live play review.**
  - Agent tokens now have vision, so players no longer get a black map on scenes that use token vision. New agents,
    the sample agents and (through a one-time world update) existing agents and their placed tokens are covered.
  - **Begin play** fills the empty Vitality and Wounds of a character who has never played, as well as granting the
    starting action dice.
  - A Shift-click attack that cannot measure what it needs (a CQB distance with no single target, for example) opens
    the attack dialog with a notice instead of doing nothing.
  - The player whose agent is attacked gets buttons on the attack card (check Defense, boost Defense with an action
    die) and on its damage card (apply the damage).
  - Resolving an attack: an attacker can no longer be its own target; the target list shows the tokens in view and
    the combatants, with people who are not on the scene only as a fallback; a token a player can see can be named as
    the target even when its sheet cannot be opened; and with one token targeted the Resolve button settles against
    it without the picker. The one-click Resolve button says whether the roll hits.
  - A quick (Shift-click) NPC attack on a targeted token is resolved as soon as it is rolled (client setting
    "Resolve quick NPC attacks at once", on by default).
  - The builder's "Next setup step" and the creation track's "Start here" now always name the same step, and the next
    step sits at the top of the rail where a small screen still shows it.
  - Stress and subdual damage: the report says how much got through and the running total against the threshold,
    and the totals have meters beside Vitality and Wounds once any has been taken.
  - A player's own secret check carries a note saying the result went to the GC.
  - Sheets open at the left, no wider than the room beside the sidebar (agent sheet 860 px by default), and a
    minimised sheet no longer leaves part of its content on the map.
  - Chat cards and the GC console take their background and text colours from the same tokens as the sheets, which
    fixes text that was too faint or dark on dark; the card's next step is the filled button wherever it sits.
  - Roll visibility uses Foundry 14's `messageMode` option, and the GC no longer gets a "resource transaction in
    progress" warning from background bookkeeping while a player's own action is running.

- Added **Operation Glass Wake** as a built-in Adventure compendium: three staged encounters, four level-1 pregens, five NPCs, GM notes, player briefing and an opt-in mission-setup macro. Its agents, NPCs and maps are assembled from the current system catalogs. Import does not activate a scene or replace an existing mission record.

- **Class ability reminders.** Roll dialogs now list the character's class abilities that the system does not work
  out, next to the feat reminders, once the character reaches them in that class (`classAbilities` in
  `src/data/feat-reminders.json`): Alpha Strike, Put Your Backs Into It, Gunplay, Gun-Fu, Hostile Negotiator, Fatal
  Attack, Insane Stunt, Cheat Death, Wuxia, Cyclone, Quick Change, Bald-Faced Lie, Master Cracker, Ghost in the
  Machine and Master Tracker. Ticked ones are noted on the posted check for the GC.
- **Dead to Rights** (Grunt) adds 1d4 to tactical weapon damage from 2nd level and 2d4 from 7th. **Whatever's Handy**
  (Brawler) now rises to +2 at 5th and +3 at 9th instead of staying at +1.
- **NPC feats by name.** An NPC's feat items now count for the attack, damage and Defense rules that look a feat up by
  name, as an agent's do.
- **Maneuvers against characters you do not own.** Settling a Trip or a Feint against an NPC, and the conditions an
  opening grapple check or a grapple benefit brings to it, are sent to the GC's client to carry out instead of being
  left to set by hand.
- **Round reminders.** When a round ends the GC's client posts a card for each dying character, and when a burning
  character's turn begins a card for it; the card's button makes the roll for the character's owner. World setting
  "Round reminders", on by default.

- **Counted class abilities.** Class abilities with a number of uses per session, mission, scene or combat now appear
  under limited uses with a Use button and their count for the character's level (`module/rules/class-ability-uses.mjs`).
- **More class ability reminders** for the abilities the system still leaves to the table, including Short Con, Shill,
  Bookworm, Interpreter, Overland Shortcut, Go Native, Filed in Triplicate, Smartgun, Behind Closed Doors, Trust Me and
  Vehicle Familiarity.
- **Gunplay** (Triggerman) raises the attacker's Initiative Count on a handgun hit. **Stratagem** (Tactician) gets a
  start-of-round card whose button raises the team's Counts. **Juggernaut** (Brawler) can turn up to half of lethal damage
  taken into subdual in the damage dialog. **Fall Guy** (Stuntman) lowers each falling damage die by 2.
- **Whatever's Handy** now adds its bonus to Defense while an improvised weapon is readied.
- **Terminal Situation** is a GC action die use outside combat (1 die).
- **Career Level 0** agents have 6 vitality until their first class level.
- A **Press** adds a half action to the turn's count. **Take the Hit** reminds on Reflex saves.
- **Bang, flash and explosive damage on special NPCs** use the same typed-damage handling as agents.
- **Actions per turn.** The combat tracker's menu can spend a half or full action for a combatant, refuses more than a
  turn holds, and shows what the acting combatant has left. It starts over each round.
- Preserve existing MPL file licenses in install archives, document licensing
  scope, and record the owner-confirmed Suno soundtrack provenance.

- Added contextual tooltips across system sheets, dialogs, chat actions and Game Control, including fields, buttons, tabs and expandable sections. Existing authored help is preserved.

Not yet tried in a running Foundry world; see "Clock, timers and the GC relay" in `docs/archive/build-notes-2026-11.md`.

- **Game clock.** The world keeps the time. A badge above the players list shows it and opens the Clock window; the
  GC moves it on in steps (a round, a minute, ten minutes, an hour, eight hours, a day) or by any amount, from that
  window or the GC Console, and can name the present date and time without any time passing. Each combat round adds
  6 seconds (world setting "Advance the clock each combat round", on by default); going back a round takes them off.
  World setting "Show the clock to players".
- **Timers.** Anyone can start a timer from the Clock window: rounds by default, or minutes, hours, days or weeks.
  A timer kept on a character is one of that character's Active Effects with a duration, so Foundry itself counts
  it down (in combat rounds while the character is in a fight, in game time otherwise), shows the time left and
  expires it. A user with no character keeps timers on their own user instead. When a timer ends its owner gets a
  notice that stays on screen, a sound and a whispered chat card; one that ended while its owner was away is
  announced when the owner next joins. A timer can be shown to everyone, and its end is then posted to all.
- **Timed conditions.** A knockout from a failed subdual save is an effect with a duration, for agents and special
  NPCs: Foundry expires it and the GC's client lifts the condition. The Clock window lists conditions with time
  left. A character at 0 wounds or fewer stays unconscious. An owner is told when a contagion's next save comes due.
- **GC relay.** A player can apply damage to a character they do not own, and First Aid or Stabilize to another
  player's agent: the request goes to the GC's client, which asks the GC to allow it (world setting "Apply players'
  requests without asking"). Blasts do the same for each character caught.
- **Hazards on NPCs.** The NPC sheet has the Hazards line: contagions, fire, the other damage types and survival
  saves. Attribute damage lowers the NPC's score; stress goes to a special NPC's running total.
- **NPC feats.** Feat items on an NPC add their plain-number bonuses to its saves, Initiative, Speed and skill
  checks, and to vitality and wounds where those are worked out from grades. The sheet lists what was added and
  names the feats it could not work out.
- **Interface fixes.** Checkboxes on system windows match the parchment skin (paper box, teal tick) instead of
  Foundry's dark squares. Field borders are darker so each control's edge stands out on the paper. The feat browser
  marks unqualified entries with a "Not qualified" tag instead of greying and striking them through. Chat search is a
  single line; its character and roll-type filters open from a filter button and stay open while one is set. The
  clock shows hours and minutes, with seconds only during combat. Seven remaining dialogs (Baffled, companions,
  reserve review, rules refresh, restraint release, GC dice and resource transactions) now use the system's dialog
  skin, and a test keeps new dialogs from skipping it. NPC feat bonuses name skills properly ("Sense Motive", not a
  code key). A vehicle with no fuel range no longer shows "()", and its empty Acceleration and MPH show a dash.
- **Sheet layout.** The NPC sheet has the agent sheet's play and edit views. Play shows the header, an Actions
  group, the play strip, attributes, defences and weapons first; graded NPCs show their statistics, current vitality
  and wounds and listed skill bonuses there. The NPC builder appears only under Edit NPC, and a new NPC with nothing
  built opens in edit. The agent header puts the edit toggle on the name row and the counters beside the origins,
  roughly halving its height, and the tab bar is slimmer.
- **Combat tools.** The Main tab's combat tools sit below Attributes and have a search field. Fend, Thread the
  Needle, stance damage, Driving Stance and Power Stance tools appear only for characters with the feat or stance
  behind them; the GC can tick "Show all tools" to see every one.
- **GC console.** Each console section folds. Sections open to suit the game: the mission before it starts, combat
  while one runs, Dramatic Conflicts while one is under way. A GC's own choice is remembered in their browser until
  that state changes. Each section leads with one main action, and the clock folds to a single line.
- **Map.** A blast marks who stands behind a wall and leaves them unticked, outlines its rings on the scene and
  pings Ground Zero. Attack dialogs name the characters standing in the line of fire.
- World migrations now cover the world's own Actor and Item compendiums; locked ones are named and left.

Fixes:

- The save button on a damage report, "Apply this save's result" and the healing buttons no longer fail, and can no
  longer be repeated, when the card was posted by someone else. "Apply helpers' results" is offered only to the
  leader's player and the GC.
- A standard NPC's damage reduction now counts against subdual damage (twice over) as a special NPC's does.
- Resting or First Aid back above 0 wounds lifts Unconscious; a character who dies loses Dying.
- A thrown melee weapon uses the hurled-weapon damage reduction column.
- Biographies and item descriptions show their enriched text (`@UUID` links, rolls, secrets) with an edit button,
  instead of an always-open editor showing the raw markup.
- Condition names, the Linguistics setting and the damage reduction categories can be translated; a tooltip's HTML
  attributes are no longer a translatable string.

## 0.5.2 — 2026-11-18

- Starter Actors: one mastermind, three henchmen, eight minion profiles and all 16 sample PCs are copied into their Actor folders on the first GM launch after installation or upgrade. Interrupted setup resumes without duplicates; later edits and deletions are preserved.
- Added the Sample Villains & Minions compendium, with the original Glass Meridian cast and eight reusable minion profiles. Renamed the default sample character folder to Sample PCs.

Fixes from a live test of 0.5.0:

- A failed subdual save on an agent now settles: the agent is knocked unconscious for the band's time × half the
  margin. Drained and GC-decided outcomes settle once the GC ticks "applied by hand"; before, all three stayed
  pending for good.
- New agents and agents imported from a compendium start with stress and subdual totals of 0, so subdual and stress
  damage record straight away. Agents already in a world still need "Review accumulated totals" once, and the
  message now says so.
- A refused sheet, dialog or chat button now shows its reason on screen instead of only in the browser console.
- Lethal damage from explosive, acid and the other special damage types, fire, contagions and survival failures now
  sets fatigued, unconscious, dying and dead like any other lethal hit.
- The explosive takedown counts the damage left after the Reflex save.
- A grenade or other blast uses the "other damage" column of damage reduction instead of "non-grenade hurled".
- Winning an opening grapple also makes the grappler vulnerable.
- The settle dialog for a subdual save no longer talks about stress and Shaken.

## 0.5.0 — 2026-11-18

- Added the Sample Level-1 Agents compendium: 16 complete characters across all 12 base classes, four alternate builds, matching compressed WebP portraits and tokens, and a linked Scout animal partner created on import.

Not yet tried in a running Foundry world; see `docs/backlog.md` for the checks still to make.

- Attacks resolve against a target: "Resolve against Defense" on an attack card, "Roll damage" on a hit, and "Apply
  damage to a target" on a damage card (vitality and wounds, damage reduction, critical hits, conditions, standard NPC
  and vehicle Damage saves).
- Ammunition is counted: attacks spend shots, an empty weapon must be reloaded, and Reload draws on the reserve. New
  weapon fields `system.shotsLoaded` and `system.shotsSpare`; world setting "Count ammunition" (on by default).
- Healing: "Rest and recover", First Aid and Stabilize applied from their checks, and a dying character's roll.
- Opposed checks: "Compare with an opposing check" on a rolled skill check.
- More token statuses (stunned, dazed, helpless, dying and others); an opening grapple check sets its conditions.
- A damage report that calls for a save (a hit of 25 or more, a special NPC's stress or subdual threshold) carries a
  button that rolls the character's save; the save card applies the critical injury, –9 wounds or knockout.
- Special NPCs keep stress and subdual totals (`flags.spycraft2.nonLethal`), shown on their sheet.
- The apply-damage dialog can hand a special damage type to an agent's own rules, and "Apply the blast to everyone
  caught" settles each character in a blast.
- Grapple benefits the winner picks change conditions; "Rest and recover" wears off stress and subdual damage.
- Feat reminders: feats the system does not work out are listed in roll dialogs for the rolls they bear on, and the
  ones ticked are noted on the check. New feat field `system.reminder`; schema version 2 fills it for feats already
  in a world.
- Cooperative skill checks: leader and helper roles, helper DCs and limits, and a tally on the leader's check.
- Hazards on agents: contagions (disease, poison, radiation) and fire. New agent field `system.hazards`.
- Combat actions: Burst, Autofire, Strafe, Cover Fire, Suppressive Fire, Pummel, grapple checks and blast damage by
  distance.
- Attack dialogs take distance, flanking, adjacency and the target from the scene (client setting, on by default).
- NPC qualities say what they do on the sheet and apply to statistics and skill checks.
- Roll pipeline: a `terms` phase; feat, class and save terms registered from their own modules; follow-up dialogs
  and attack dialog input moved into the pipeline; the roll code split into three files.
- Translation: feats keep a stored rule name so items can be renamed or translated; more labels tagged; sentences
  built from pieces merged; a check's notes follow the viewer's language.

## 0.4.0 — 2026-11-17

- Bundled starter scenes and moved Game Control to the first sidebar tab.

- Roll pipeline completed: dialog sections, input coercion, modifier rows with a plan stage, record fields and every
  chat button are contributors, registered from the module that owns each rule. Dialogs and rolls are unchanged.
- The Actor document is split into workflow files under `module/documents/actor/`.
- Stances, Total Defense, Combat Expertise and similar round effects are shown as Active Effects on the token
  (world setting, on by default; display only).
- Optional resource locking arbitrated by the Game Control's client (world setting, off by default).
- World data now carries a schema version, with a migration runner for future changes.
- Translatable text throughout: templates, chat buttons, settings, and the JavaScript's dialogs, notes, notifications
  and error messages (written in place with the `loc` tag; `npm run strings` collects them into `lang/en.json`).
- Every open record field on the actor and item models declares its shape; a value that does not fit is reported in
  the console.
- Development: Prettier and ESLint with CI checks; tests discovered by pattern; engine fixtures no longer need built
  packs; `npm run check:schemas`; batch ledgers moved to `docs/archive/`.

## 0.3.2 — 2026-11-17

- Chat history search with combined character, roll-type and text filters, newest-first results, pagination and original-message popouts. Searches respect message and secret visibility.
- Revised Play/Edit character sheets, setup guidance, skill search and grouped combat controls.
- Game Control tools for missions, initiative, NPC play and Dramatic Conflicts.
- Expanded character rules workflows and regression coverage since 0.3.1.

- Roll pipeline: rules register reservations, validators, modifiers, record fields, named skill checks and chat buttons
  in `module/rolls/` instead of being wired into the Actor document. Existing behaviour is unchanged.
- Gear pack: Electronics, Gadgets, Resources, Security and Tradecraft picks with their table values, and gadget housings.
- Vehicles: a Vehicle item type and pack (213 vehicles in twelve categories), a Vehicle Upgrades pack (upgrades and
  vehicle weapons), and a Vehicle actor with its own sheet that can be placed on a scene from a pick.
- Damage saves for gear and vehicles, with breakage by Size, blast and critical-hit failures, Vehicle Damage results
  and tyre saves.
- The compendium browser searches the new packs; the agent Gear tab lists vehicles.
- `npm run build` no longer deletes a pack that Foundry has open; `SPYCRAFT_PACKS_DIR` builds and tests elsewhere.
- New persisted fields: gear items gain table-value fields, `failedSaves` and `stats`; new document types
  `Item.vehicle` and `Actor.vehicle`. Existing documents need no migration.

## 0.3.0

- Now requires Foundry VTT v14 (verified on 14.370).
- Fixed the agent sheet failing to open ("header must render a single HTML element").
- Fixed the Graceful talent applying −2 Intelligence; it is −2 Constitution.
- Fixed granted feats being added twice when the same user is logged in from two browsers; syncing grants also
  removes surplus copies.
- Fixed an editor error when the agent sheet re-rendered twice in quick succession (the biography editor is no longer
  collaborative).
- "Still to do" checklist in the agent sheet header: unspent attribute points, skill points, feat slots, proficiencies,
  focuses, interests, contacts, wealth, unmade class-ability choices and unrolled vitality. Each entry jumps to its tab.
  (Unassigned attribute increases and missing vitality rolls moved here from the warnings list.)
- Talent and specialty in the header can be opened, swapped or removed.
- Compendium browser shows each entry's summary, searches it, and no longer adds a second copy of a feat or origin.
- Vitality roll button per career level, and an offer to roll when a level is added.
- Hover breakdowns showing where saves, Defense, Initiative, Speed, vitality, wounds, action dice and skill bonuses come from.
- Bio tab no longer shows a stray "level" field.

## 0.2.0

- Full character-builder engine: point-buy attributes,
  origins, multiclass progression, class tables, class-ability choices, skills, feat slots & prerequisites,
  proficiencies, focuses, interests, contacts, subplots, wealth, mission gear picks and final totals.
- New tabbed agent sheet, item sheets for every item type, and a compendium browser that flags what an agent qualifies for.
- Descriptions for feats, origins, class abilities and class-ability options are original summaries of the
  Spycraft 2.0 rules text (src/data/summaries.json).
- Compendium packs: 30 classes, 68 talents & specialties, 314 feats, 394 weapons, 37 armor.
- Skill, save, attack, damage and action-die rolls with threat/error ranges.
- Engine regression tests against saved reference fixtures (`npm test`).

## 0.1.0

- Initial scaffold.
