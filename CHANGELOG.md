# Changelog

## Unreleased

- Added contextual tooltips across system sheets, dialogs, chat actions and Game Control, including fields, buttons, tabs and expandable sections. Existing authored help is preserved.

Not yet tried in a running Foundry world; see "Clock, timers and the GC relay" in `docs/remaining-work.md`.

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

Not yet tried in a running Foundry world; see `docs/remaining-work.md` for the checks to make.

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
