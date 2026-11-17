# Changelog

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
