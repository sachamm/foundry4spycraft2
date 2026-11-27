# Game Control tools

Open the **GC Console** with Alt+G (it opens as a window beside the chat log), from the sidebar tab after Combat, marked with a spy icon (GC only), or run `game.spycraft2.gc.open()`. Every function is also available under `game.spycraft2.gc` for macros. Page references are printed page numbers.

New to the console? Start with [gc-quickstart.md](gc-quickstart.md).

Foundry already supplies scenes, tokens, journals, roll tables and the combat tracker. These tools add what is specific to this system's rules.

## Running a session

- The console has three views. **Prep** shows the mission record, the opposition and the campaign, with a
  first-session list that ticks itself. **Play** shows combat, the scene and the GC action dice. **Wrap-up** lists
  the closing steps: XP report, exposure, standing, End mission. The console picks the view from the state of play
  (planning, a mission or a fight under way, a mission ended) and keeps your own choice until that state changes. The
  search looks through every section whatever the view.
- The strip at the top names the mission and its state, the scene period, the round and whose turn it is, and the GC
  action dice left of the starting number.
- **Begin session** (top of the console) starts the session's usage period, sets up the GC pool from the team and the
  mission's Caliber, and applies each agent's starting-dice adjustments in one step. **Next scene** starts a new scene
  period and counts the scene on the active mission. **Start mission** also starts a mission period, and rolls the
  liquidation check (p.440) for each agent whose standing is below −20 Reputation or −$1,000,000 Net Worth. An agent
  below 0 is marked burned on the sheet and beside their name in the console, and cannot allocate reserves, make
  Requests or Gear checks.
- Until the GC action dice are set up the console offers **Set up GC action dice**, pre-filled with the players present and the Caliber.
- On an open NPC card the GC gets **GC boost** and **Activate threat (GC dice)**, paid from the GC pool.
- A player's request to change something they do not own (damage to an NPC, treating a teammate) arrives as a card in
  the GC's chat with **Allow** and **Decline**, so play is not stopped by a pop-up. Unanswered requests are declined
  after about two minutes.

World settings that change the flow:

- *Show opponents' Defense to players* (on): players can resolve an attack against the targeted token in one click.
  Off keeps NPC Defense hidden; players pick the target in the resolve dialog.
- *Trust the table* (off): dialogs open with the GC confirmation boxes already ticked, with a note saying so.
- *Record fluid initiative from damage* (on): losing wounds to an applied damage roll records the fluid initiative
  event without a trip to the console.

## Mission record (pp.423–440)

One mission is stored per world.

- **Threat Level** — sum of the team's career levels ÷ 5, rounded up, with an optional −2…+2 adjustment or a fixed value for published missions. It is calculated when you press **Start mission** and stays fixed until you recalculate it.
- **Caliber** — I–V. **Raise Caliber to …** (under More mission tools) also gives the GC pool its 2 dice (p.398).
- **Objectives** — grade × 25 XP, counted when marked complete. Table 7.6's samples are offered when adding one. One critical objective is free; each extra is +25 XP; none is −50 XP.
- **Antagonists** — pick an NPC actor to read its XP reward. Each NPC type counts once; special NPCs count ×4; a ‘full’ or promoted special NPC earns 300 XP per scene. An antagonist counts once it is marked as faced.
- **Complications** — scripted dramatic scenes (first free, +100 XP each extra, −50 XP for none), time limit (+50), campaign qualities, security devices (XP from the device's Power Rating), gear restrictions (Table 7.8), exposure objectives (Table 7.7), mission bundle picks (−10 XP per Caliber, −1 per Common Item) and free-form entries. Marking one **ignored** halves it, rounded up. While the mission runs, a gear restriction takes its picks off every agent's sheet, where the player (or the GC, as the row says) records which categories lose them; for the two list restrictions, enter the allowed weapons or Mechanisms one per line and the sheet flags picks that are not on the list.
- **XP report** — posts the base reward and each character's total: (base + 25 per awarded action die, capped at 25 × level) × the lower of career level and Threat Level. The agent sheet's **Settle mission XP** dialog is pre-filled from the record; settlement itself is unchanged.
- **Exposure** — recording an infraction immediately lowers that agent's Reputation or Net Worth; committing it to prevent an equal or worse one costs half, rounded up.
- **Standing** — pays Table 7.10's reward by Caliber, shifted by Table 7.5 when the Threat Level was adjusted.
- **Starting-dice adjustments** — applies the p.61 Threat Level bonus and campaign-quality changes to each team member's current action dice, once per session. Use it after starting the session.

NPCs with **Follow mission TL** ticked use the active mission's Threat Level instead of their own number. Existing NPCs are unticked and unchanged.

## Scene and GC action dice (pp.397–399, 424, 452)

The session pool is the existing one (players present + 2 × Caliber). **Spend dice** covers every listed use, charges the pool and rolls the right die:

- d4, or d6 for a minion, d8 for a henchman, d10 for a mastermind; each story-critical grade raises it one type, to d12 at most.
- Boosting a DC uses a d12, once per DC (three times in a dramatic scene).
- A standard NPC's threats cannot be activated without *treacherous* (attacks) or *prodigy* (skills).
- Promote a standard NPC (2 dice), save a special NPC (4; 3 for a henchman, 2 for a mastermind; never from death in a dramatic scene), add a campaign quality (its listed cost), prompt a dramatic scene (4), prompt an event (1–4, one less with a trigger).

A **dramatic scene** lasts until the next scene starts. While it lasts, GC dice explode on a natural 1 as well as the maximum, the extra spends appear, and **Double opponents' Initiative** doubles each non-player Count once, to at most 50.

## Combat (pp.323–324)

- Combatants start flat-footed (world setting).
- Order is Count, then Initiative bonus, then a stored d20 roll-off.
- **Fluid initiative event** (console, or the combatant's context menu) records a Table 5.2 modifier. When the round advances the recorded modifiers are applied, limited to ±10; a Count of 0 or less causes reeling and flat-footed and gains 20; 50 or more flags a forced Press. Delay, Press and a triggered Ready change the Count at once.
- **Roll NPC Initiative** makes one roll per NPC type, or one for all. It rolls NPCs only; an agent no player owns
  is named in the report so it can be rolled from its sheet.
- The tracker's right-click menu has **Spend a half action**, **Spend a full action**, **Give back this round's
  actions**, **Delay 1 Count**, **Delay…**, **Ready an action**, **Readied action triggered** and **Fluid initiative
  event…**. A readied combatant is marked on its row until the action goes off or its next turn comes. Delay is
  refused for a combatant whose turn has already passed this round; a readied action that goes off after the
  combatant's turn uses up the turn it would get at the new Count. Delay and Ready lines for an NPC no player
  runs are whispered to the GCs.
- A Henchman or Mastermind named as an attack's target narrows the threat range and raises the critical's cost; the
  attack card says so. Apply the same rule by hand to skill checks aimed at them.
- **Surprise round** takes each side's opposed result and announces who acts.

Fluid initiative can be turned off in the system settings.

### Running a combat turn

1. The tracker row of the acting combatant shows the half actions it has left; rows also say "flat-footed", and
   the wound state of characters whose sheet you may open.
2. Open the acting character's sheet (shortcut below) and roll from its Play tab or stat block. A plain click opens
   the roll's dialog; a Shift-click rolls at once with the last choices.
3. Work down the chat card: the guide at the top names the state (Pending, Hit, Miss and so on) and the main
   button is the next step. Press **Finish** when nothing is left to do on the card.
4. Record spent actions from the combatant's context menu if the roll did not do so, then press **Next turn**.

The console's Combat section can run the same turn without the sheet. The **acting block** names the combatant
whose turn it is, with Defense, health, conditions and half actions left, a button for each weapon (with one token
targeted it goes straight to hit or miss), Delay, Ready, the standard NPC's Damage save and **Next step on the newest
card**. A defeated combatant gets no attack or action buttons. Each row of the list is a button that centers the
map on the token and opens the sheet. While a fight runs, the Combat section stays on screen in every view, and
**Previous turn** stops at the first turn of round 1.

**Mob attack** appears when two or more standing standard NPCs of one kind are in the fight. Pick the weapon and
tick the targets: every member makes one attack, the targets are shared out in order, and the turn then moves past
the group.

### Keyboard

These shortcuts are listed under Configure Controls, where each can be changed or cleared.

| Shortcut  | Action                                             | Who |
| --------- | -------------------------------------------------- | --- |
| Alt+N     | Next turn                                          | GC  |
| Alt+P     | Previous turn                                      | GC  |
| Alt+G     | Open the GC Console (as a window, by default)      | GC  |
| Alt+S     | Open the sheet of the combatant whose turn it is   | GC  |
| Alt+Enter | Press the main button on the acting combatant's newest card during a fight, else on the newest card | All |
| Alt+B     | GC boost on the card under the pointer, else your newest NPC card; press twice (the first press marks the card) | GC  |
| Alt+D     | Spend GC action dice, with the acting NPC chosen   | GC  |

A button clicked with the mouse lets go of the focus, so the shortcuts keep working after a click. Alt+S follows the
turn: the sheet it opened last closes when it opens the next one.

Every control is also reachable with Tab; Enter submits a dialog and Esc cancels it.

### Undo

Applying damage from a card, rolling a standard NPC's Damage save and spending GC action dice each leave a short
note in chat, whispered to you and the GCs, with an **Undo** button. Undo restores what the step changed on the character
(vitality, wounds, the damage track, conditions it added or removed, a defeated mark, an Initiative Count), gives
back the GC dice, and frees the damage card to be applied again. If a number has moved again since, it asks first;
vitality and wounds then get back the amount the step took, counted from where they stand now. A GC boost or a
critical bought from a card changes the card itself and leaves no Undo note.

## Standard NPC damage (pp.331–332, 452)

Standard NPCs and animals show a Damage save line on their sheet. **Suffer damage** rolls against DC 10 + half of all damage taken this scene. A failure kills (lethal) or knocks out (subdual, stress); blast damage adds a failed save per 10 points missed; each die spent activating a critical hit is an automatic failure; each *tough* grade ignores one failed save per scene. Accumulated damage clears when a save fails or a new scene starts. The **save adjustment** field holds the +1 per wound / per 2 vitality conversion.

The sheet also has an NPC **skill check** (the higher of Competence and the skilled bonus, which also sets the result cap) and **Disposition**.

## Disposition (pp.457–458)

Each NPC stores a general disposition and one per character. The dialog shifts it (at most two grades either way per mission, one automatic shift per mission), shows the Intimacy and Fondness check modifiers, and rolls Loyalty and join-the-fight decisions, including the foil modifier. A skill dialog for an Intimacy or Fondness check asks for the targeted NPC's disposition (filled in from the target when the player can see it) and adds its modifier, threat and error changes, plus Diplomatic's +1; villains are immune.

## Dramatic Conflicts (pp.363–388)

All seven types are supported with their printed Strategies, requirements, modifiers and Advantages. The tracker walks each round: both Strategies, the opposed check, the winner's Advantages (1 + 1 per 4 points of margin), outside actions. It applies Lead changes, critical shifts, role swaps and victory. **Manage** shows the type's tables, sets the Lead and handles a concession.

## Campaign qualities (pp.405–408)

All 60 qualities are listed with XP modifier and action die cost. Season qualities apply to every mission; mission qualities are scripted (XP applies) or bought with action dice (no XP).

The qualities in force change the rolls themselves: threat and attack modifiers (Violent, Subtle), Triumph thresholds (the Spectacle qualities), range and blast increments (Gunmen), critical injury bands and costs (Bloodbath and its kin), stress (Tense, Mellow), falling damage (Wire-Fu), the skill caps (Omni-Competent), surprise and persuasion modifiers (Paranoid), error ranges (Comedy of Errors), action dice (Spirited), Lead Advantage and challenge counts (Speed-Frame, Thriller) and the honor exposure penalty (Virtuous, Corrupt). Season qualities that change characters reach the sheets too: the growth schedules (Fast and Slow Attributes, Feats, Interests, Proficiencies and Growth), Small Screen's 32 points, Fragile's fixed vitality, Jack-of-All-Trades, the tree qualities (a feat from that tree may fill another tree's choice), and Big Budget's +4 Wealth. Big Budget and Shoe-String Budget move the Caliber a mission gear pick or Request may reach. Under Historical, money follows Table 7.4 for the year the game clock shows (×0.1 in the 1950s up to ×0.6 in the 1980s): Net Worth awards, Net Worth request costs and Spending Cash. Gear newer than that year stays in the gear browser as a gadget one Caliber up, and mission picks and Requests are checked at that Caliber; an item that would pass Caliber V cannot be had. Play qualities with effects of their own are applied as well: Bottomless Clip stops counting shots in weapons of 5 or more, Omni-Competent halves skill penalties, Comedy of Errors caps skill error activation at 2 dice and slows take 10, Common Spectacle's Triumph share goes into mission XP (with the Crossroads share), and Gladiators sets CQB Range to 20 ft. and gives +1 Defense against ranged attacks per Melee or Unarmed Combat feat, NPCs included. Catch Phrase adds a reminder to threat cards. Feat Purchase puts a **Buy a feat** button on the feats pane (1,000 XP per career level, never below the level's minimum), Modular trades feats for attribute points at 2 each, Soap allows one more Subplot, and Routine turns off Crossroads Titles. The Campaign qualities section lists each change in force.

## Organizations (pp.389–395)

**Add organization** records the Agency or a rival with its five Power Ratings, goals, turning points, Image facets, Sites and Tools. The console shows each one's total and what is over or under its Ratings; **Post summary** whispers its Ratings, the Canvass and Research levels of each facet, the cover and immunity bonuses its people carry, and its goal dice. Marking one as the Agency puts its Sites on the Request dialog (+4 and half the delivery time in the categories each Site serves), and either side of a Dramatic Conflict can take its Ratings from a recorded organization. An NPC built from grades can name its organization; its Tools then cap the Caliber of each equipment pick.

## Reference

Security devices at any Power Rating with sensor and trap rolls (Table 7.9), hazards and nature's fury by dice spent (Tables 7.2–7.3), event summaries, and random possessions (Table 7.16, also a **GC Tables** roll-table compendium).

## What is left to the GC

- Strategy choices are entered by the GC; players tell the GC their choice privately. Opposed checks are rolled on the sheets and the totals typed in.
- Advantage effects other than Lead, Swap, Victory and Halt are reported, not applied.
- Campaign qualities that need a ruling at the table (a DC the GC calls aloud, which side a scene favors, Black & White's sides, a Revolving Door return) appear as card notes or in the Campaign qualities section.
- Organization goal dice and turning-point morale are listed on the summary card; the GC grants them.
- Initiative boosts for the dramatic-scene spend change the Count; Defense and DC boosts are reported for the GC to apply.
- Some printed cells are garbled or inconsistent in the source text; each is listed under `anomalies` in `src/data/gc-tables.json` and `src/data/conflicts.json` and kept as printed.

## Data and tests

`src/data/gc-core.json`, `gc-tables.json`, `conflicts.json` and `campaign-qualities.json` are the editable sources; `npm run build` generates `module/rules/gc-tables.mjs` and the roll-table pack. Names and numbers are as printed; descriptive text is original summary. Rules live in `module/rules/gc/` and are covered by `tools/test-gc-rules.mjs`; the Foundry-facing layer in `module/apps/gc/` is exercised through stubs in `tools/test-gc-apps.mjs`. Neither replaces a live Foundry playtest.
