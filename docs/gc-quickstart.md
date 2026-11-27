# First session as GC

A short path from an empty world to the first combat. [gc-tools.md](gc-tools.md) is the full reference; page numbers
are printed page numbers of the rulebook.

## The console in one minute

Press **Alt+G** to open the GC Console. It opens in its own window, so the chat log, where you resolve the cards,
stays in the sidebar beside it. (The GC tab after Combat in the sidebar opens it there instead; the setting "GC
Console in its own window" changes what Alt+G does.)

The console has three views, chosen for you from the state of the game and switched with the buttons under the
status strip:

- **Prep**: the mission record, objectives, antagonists, complications, organizations and campaign qualities.
- **Play**: the fight, the scene and the GC action dice.
- **Wrap-up**: the XP report, exposure, standing and End mission.

Each view has one filled button: the step you most likely take next. The **First session** list at the top of Prep
mirrors this page, shows only the steps left, and goes away once every step is done; each step has its own button. Every button's
tooltip says what it changes, and its key when it has one. The keys are listed under Reference.

## Before the players arrive (Prep)

1. **Make or import the agents.** Each player creates an agent actor and follows the setup list on its sheet. The
   Sample Agents compendium has finished characters if you want to start at once.
2. **Record the mission.** Press **Edit mission** and enter the name, the team and the Caliber. Add objectives
   (**Add objective**) and any complications you have planned; these set the XP award. A row's **Remove** leaves an
   Undo note in the chat, so a slip costs nothing.
3. **Prepare the opposition.** Create NPC actors (see [npc-creation.md](npc-creation.md)) and place them with
   **Add NPC to scene** in the Antagonists section.

## When play begins

1. Press **Start mission** in Prep's Mission section the first time the mission is played. This fixes the Threat
   Level from the team. The console then opens in Play.
2. Press **Begin session** at the start of every session (once one has begun, the button reads **Begin a new
   session…**). It asks how many player characters are at the table (the GC's pool counts those present, p.397),
   then starts the session, sets up the GC action dice and
   gives each agent its starting action dice, with any Threat Level bonus. The status strip then shows when the
   session began. The two can be pressed in either order: whichever comes second adds only what the first could not.
3. Press **Next scene** each time the scene changes; between fights it is Play's filled button. A notice confirms it.

## The first combat

1. Select the tokens on the map and press **Start a fight with the selected tokens** in the console's Combat
   section (**Add selected tokens** brings in late arrivals). Players roll Initiative from their sheets.
2. Press **Roll NPC Initiative by type**, then **Begin combat**. Until everyone has rolled, the button says how many
   have not.
3. The **turn bar** at the top of the fight holds **Next turn** (Alt+N), **Previous turn** (Alt+P) and **Spend GC
   dice** with the acting NPC already chosen (Alt+D).
4. On an NPC's turn, the acting block under it has an **Attack** button for each weapon, with its bonus and damage
   (Shift-click with one target goes straight to hit or miss; Alt+1 and Alt+2 attack with the first two, and Alt+M
   opens the mob attack for the acting mob; in some browsers Alt with a digit switches tabs, so rebind it in Configure
   Controls if it clashes), then
   **Card: next step**, which presses the main button of that combatant's newest card and says which one, and
   **Delay** and **Ready**. Spending actions and the Damage save are under **Turn actions**. A player's turn is rolled
   from their own sheet; the card's top line names its state and its main button is the next step. During a fight
   Alt+Enter presses the acting combatant's newest card, or your own newest card when that combatant has none waiting,
   and marks the card it pressed.
5. For an NPC's result, **GC boost** on its card spends a GC action die. Alt+B does the same: the first press marks
   the card it would boost, a second press within three seconds spends the die.
6. Click a name in the order to select its token and centre the map on it; double-click to open its sheet.

When the fight is over, **End combat…** under the order closes it; Foundry asks first.

## After the session (Wrap-up)

The Wrap-up view's filled button is **End mission** while the mission runs, and **XP report** once it has ended.
Exposure infractions and the standing payout are in the same list. When everyone is paid, **Plan the next mission**
files the record as a journal entry under Mission records and starts a new one with the same team and Caliber; it is
then Prep's filled button too.

## What stays with you

The system does the arithmetic and keeps the records. Rulings, descriptions and anything a card marks as a GC step
remain your call; the list is at the end of [gc-tools.md](gc-tools.md).
