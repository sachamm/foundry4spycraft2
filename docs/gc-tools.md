# Game Control tools

Open the **GC Console** from the first sidebar tab, marked with a spy icon (GC only), or run `game.spycraft2.gc.open()`. Every function is also available under `game.spycraft2.gc` for macros. Page references are printed page numbers.

Foundry already supplies scenes, tokens, journals, roll tables and the combat tracker. These tools add what is specific to Spycraft 2.0.

## Running a session

- **Begin session** (top of the console) starts the session's usage period, sets up the GC pool from the team and the
  mission's Caliber, and applies each agent's starting-dice adjustments in one step. **Next scene** starts a new scene
  period and counts the scene on the active mission. **Start mission** also starts a mission period.
- Until the pool is set up the console offers **Set up GC pool**, pre-filled with the players present and the Caliber.
- On an open NPC card the GC gets **GC boost** and **GC: activate threat**, paid from the GC pool.
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
- **Caliber** — I–V. **Caliber +1** also gives the GC pool its 2 dice (p.398).
- **Objectives** — grade × 25 XP, counted when marked complete. Table 7.6's samples are offered when adding one. One critical objective is free; each extra is +25 XP; none is −50 XP.
- **Antagonists** — pick an NPC actor to read its XP reward. Each NPC type counts once; special NPCs count ×4; a ‘full’ or promoted special NPC earns 300 XP per scene. An antagonist counts once it is marked as faced.
- **Complications** — scripted dramatic scenes (first free, +100 XP each extra, −50 XP for none), time limit (+50), campaign qualities, security devices (XP from the device's Power Rating), gear restrictions (Table 7.8), exposure objectives (Table 7.7), mission bundle picks (−10 XP per Caliber, −1 per Common Item) and free-form entries. Marking one **ignored** halves it, rounded up.
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
- **Roll NPC Initiative** makes one roll per NPC type, or one for all.
- **Surprise round** takes each side's opposed result and announces who acts.

Fluid initiative can be turned off in the system settings.

## Standard NPC damage (pp.331–332, 452)

Standard NPCs and animals show a Damage save line on their sheet. **Suffer damage** rolls against DC 10 + half of all damage taken this scene. A failure kills (lethal) or knocks out (subdual, stress); blast damage adds a failed save per 10 points missed; each die spent activating a critical hit is an automatic failure; each *tough* grade ignores one failed save per scene. Accumulated damage clears when a save fails or a new scene starts. The **save adjustment** field holds the +1 per wound / per 2 vitality conversion.

The sheet also has an NPC **skill check** (the higher of Competence and the skilled bonus, which also sets the result cap) and **Disposition**.

## Disposition (pp.457–458)

Each NPC stores a general disposition and one per character. The dialog shifts it (at most two grades either way per mission, one automatic shift per mission), shows the Intimacy and Fondness check modifiers, and rolls Loyalty and join-the-fight decisions, including the foil modifier.

## Dramatic Conflicts (pp.363–388)

All seven types are supported with their printed Strategies, requirements, modifiers and Advantages. The tracker walks each round: both Strategies, the opposed check, the winner's Advantages (1 + 1 per 4 points of margin), outside actions. It applies Lead changes, critical shifts, role swaps and victory. **Manage** shows the type's tables, sets the Lead and handles a concession.

## Campaign qualities (pp.405–408)

All 60 qualities are listed with XP modifier and action die cost. Season qualities apply to every mission; mission qualities are scripted (XP applies) or bought with action dice (no XP).

## Reference

Security devices at any Power Rating with sensor and trap rolls (Table 7.9), hazards and nature's fury by dice spent (Tables 7.2–7.3), event summaries, and random possessions (Table 7.16, also a **GC Tables** roll-table compendium).

## What is left to the GC

- Strategy choices are entered by the GC; players tell the GC their choice privately. Opposed checks are rolled on the sheets and the totals typed in.
- Advantage effects other than Lead, Swap, Victory and Halt are reported, not applied. Chase vehicles, Maneuvering Room and Smash points are not tracked.
- Disposition and campaign-quality modifiers are shown but not added to agents' rolls automatically. Of the campaign qualities, only XP, action die cost and starting action dice are applied; the rest is a reference list.
- Initiative boosts for the dramatic-scene spend change the Count; Defense and DC boosts are reported for the GC to apply.
- Some printed cells are garbled or inconsistent in the source text; each is listed under `anomalies` in `src/data/gc-tables.json` and `src/data/conflicts.json` and kept as printed.

## Data and tests

`src/data/gc-core.json`, `gc-tables.json`, `conflicts.json` and `campaign-qualities.json` are the editable sources; `npm run build` generates `module/rules/gc-tables.mjs` and the roll-table pack. Names and numbers are as printed; descriptive text is original summary. Rules live in `module/rules/gc/` and are covered by `tools/test-gc-rules.mjs`; the Foundry-facing layer in `module/apps/gc/` is exercised through stubs in `tools/test-gc-apps.mjs`. Neither replaces a live Foundry playtest.
