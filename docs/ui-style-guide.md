# UI style guide

This guide sets how the Spycraft 2.0 system looks, reads and behaves in Foundry VTT v14. It covers sheets, dialogs, chat cards, the combat tracker, the GC Console, the NPC builder, the compendium browser and settings. It applies to **new work and to existing features**: [backlog.md](backlog.md) lists where the current tree still diverges, with a suggested fix for each.

It was written from five table perspectives (a rules expert, an expert GC, a novice GC, a seasoned player and a novice player) and from the live reviews of November 2026. Rule numbers and page references are to the printed rulebook. Nothing from the rulebook is quoted here; see [AGENTS.md](../AGENTS.md).

## Contents

1. [Purpose and use](#1-purpose-and-use)
2. [Principles](#2-principles)
3. [Audiences and modes](#3-audiences-and-modes)
4. [Vocabulary and voice](#4-vocabulary-and-voice)
5. [Visual foundations](#5-visual-foundations)
6. [Components](#6-components)
7. [Surface patterns](#7-surface-patterns)
8. [Automation and GC authority](#8-automation-and-gc-authority)
9. [Accessibility and input](#9-accessibility-and-input)
10. [Audit of existing features](#10-audit-of-existing-features)
11. [Review checklist and lints](#11-review-checklist-and-lints)

---

## 1. Purpose and use

### 1.1 What the guide is for

The system grew feature by feature, and each made sensible local choices. The result is several ways to show a limited use, several names for one resource and cards that disagree about their own state. This guide picks one answer to each such question so that new features and fixes converge.

### 1.2 How to use it

- **New features** follow the guide from the first PR. A reviewer may block a PR that adds a new divergence.
- **Existing features** are brought in line in two ways:
  - when a PR touches a template, stylesheet or string, it fixes the divergences in the lines it touches (no sweeping rewrites hidden inside feature PRs);
  - the open divergences are in [backlog.md](backlog.md) and are worked through as their own PRs, P0 first. The first pass (PR 63) closed 82 of the audit's 120 items; 10.14 lists what it added and where each pattern now lives, so later work reuses it.
- When the guide and the rulebook disagree, the rulebook wins and the guide is wrong. Open a PR against this file.
- When the guide and a GC's ruling disagree at the table, the GC wins. The system must make that ruling possible (section 8).

### 1.3 Changing the guide

Propose a change as a PR that edits this file and nothing else, or that edits this file together with the code that motivates it. State:

- the rule being added, changed or dropped;
- the surfaces it affects and whether existing features then diverge (add them to [backlog.md](backlog.md));
- for vocabulary, the exact term and its banned variants, so the lint in section 11 can be updated.

Keep rule changes small. A guide that changes every week is not a guide.

### 1.4 PR checklist (short form)

Copy into the PR description for any UI change. The full checklist is in section 11.

- [ ] One primary action per region; every other button is secondary or quiet.
- [ ] Terms from the glossary (4.2); no banned variants; strings are whole sentences with placeholders.
- [ ] Colours, sizes and spacing come from `styles/tokens.css`; no new literals.
- [ ] State is never shown by colour alone.
- [ ] Works in light and dark themes, at 1280×720, by keyboard.
- [ ] Controls the user cannot use now are hidden (not theirs) or disabled with a reason (theirs, not now).
- [ ] Any write the system makes from a card can be undone from that card by the GC.
- [ ] No rulebook text; new strings pass `npm run check:copy` locally.

---

## 2. Principles

Ranked. When two conflict, the higher one wins.

1. **The table comes first.** A screen is judged by how fast a real table can play through it. Every click in the core loops (attack, check, damage, next turn) has to earn its place. Budgets are in 7.6.
2. **The GC has the final say.** Automation proposes and the GC disposes. Every automatic result can be overridden or undone by the GC, on the surface where it appeared. Players may be blocked by hard resource rules; the GC is only warned.
3. **Safe to click.** In play mode, a click either rolls, opens a dialog with Cancel, or does something the card can undo. Nothing silently spends a scarce resource or overwrites a stored number.
4. **Show only what applies.** A control for something the character cannot do is not rendered. A control the character has but cannot use right now is shown disabled with the reason. Rare tools sit behind a named disclosure.
5. **One way to do a thing.** One component per job, one name per concept, one place for each action. If two buttons do nearly the same thing, merge them.
6. **Plain words, exact terms.** Use the game's own term for a game concept (Defense, vitality, threat range) and plain English for everything else. Never use developer vocabulary in player-facing text.
7. **Numbers first, prose last.** Rollable figures and current state are values in tiles and tracks. Explanations live in tooltips, disclosures and docs.
8. **Same thing, same look, same place.** A number that rolls looks like it rolls; one that does not, does not. Untrained, spent, over budget and GC-only each have one style everywhere.

---

## 3. Audiences and modes

### 3.1 Who uses which surface

| Audience        | Needs                                                                 | Main surfaces                                              |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Novice player   | What do I roll, am I OK, what happens next. Safety from mistakes.     | Agent sheet Play tab, chat cards, roll dialogs             |
| Seasoned player | Everything rollable in one click; legal builds without friction.      | Play tab, Shift-click, builder, Gear                       |
| Novice GC       | Find the tool; understand each term; a default that is usually right. | GC Console, NPC sheet, combat tracker, docs                |
| Expert GC       | Speed: an NPC turn without changing surface; overrides; hidden rolls. | Console combat panel, NPC stat block, chat cards, keyboard |

Design for the novice first and give the expert a faster path to the same result (Shift-click, keybindings, pinned tools). Never give the expert a different model.

### 3.2 Modes

There are two modes, and a surface is always in exactly one of them.

- **Play** (default for a finished character, every NPC and the console during a session): glance values are read-only text; actions are buttons; build controls are hidden.
- **Prep/Edit** (building a character, editing an NPC, recording a mission): inputs, budgets, browsers and the builder.

The agent and NPC sheets already have the switch (`.play-mode` / `.edit-mode`, `styles/retro.css:145-146`). The GC Console still needs one (7.7); for now it moves Combat to the top while a combat exists. An unfinished agent reopens in Edit; a pregenerated or sample agent opens in Play with no setup reminders.

### 3.3 Progressive disclosure

Every surface has three tiers:

| Tier    | Holds                                                                              | Treatment                                         |
| ------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| Glance  | Health, Defense, conditions, Initiative, saves, action dice; NPC Damage-save state | Top of the surface, large values, never collapsed |
| Act     | What 80% of turns use: attacks, pinned skills, spends, Next turn                   | Directly under the glance tier                    |
| Look up | Rare tools, reference text, review and recovery, rules notes                       | Named `<details>`, closed by default              |

A review or recovery tool belongs in "look up" and is hidden while there is nothing to review. When something needs review it surfaces as one badge in the glance tier ("2 items need GC review") that opens the detail.

---

## 4. Vocabulary and voice

### 4.1 Voice

- Address the user as **you**. Never write in the first person in a label ("I am flanking…") except where a box is genuinely a player's declaration, and then say whose it is.
- Short sentences. A **label** is a noun or verb phrase. A **hint** is one sentence, 160 characters at most. Anything longer goes in docs behind a `?` link.
- Sentence case for labels, buttons, headings and tabs ("Roll damage", "Combat tools"). Upper case is reserved for stamps (6.7).
- US spelling ("Armor", "Defense", "tire").
- A button names its effect and, where it has one, its object: "Apply 6 to Security Guard", not "Apply" or "OK".

### 4.2 Glossary (mandated terms)

Definitions are our own short summaries for the `?` tooltip. They say what the thing is for at the table, not how it is computed. Keep them in one i18n namespace (`SPYCRAFT.Glossary.*`) and reuse the same string everywhere the term appears.

| Use                                                                | Plain-English tooltip (our words)                                                       | Never write                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **GC** (expand once: _Game Control_)                               | The person running the game.                                                            | GM, Game Master, DM, Game Controller, game moderator |
| **action die / action dice**                                       | Your hero resource: add one to a roll, or pay several to turn a threat into a critical. | AD, action points, loose die                         |
| **GC action dice** (short: _GC dice_)                              | The GC's own pool of action dice for NPCs.                                              | GC pool, session pool, GC action-die pool            |
| **vitality**                                                       | Stamina and luck; ordinary damage comes off it first.                                   | VP, HP, hit points                                   |
| **wounds**                                                         | Real injury; damage reaches it when vitality is gone or on a critical hit.              | WP, HP                                               |
| **Defense**                                                        | The number an attack roll must reach to hit you.                                        | AC, armor class, defence                             |
| **flat-footed**                                                    | Caught before acting this fight: no dodge bonus to Defense until you act.               | Flat Footed, flatfooted                              |
| **threat range** / **a threat**                                    | The die faces that may become a critical if the roll also succeeds.                     | crit range, potential crit                           |
| **error range** / **an error**                                     | The die faces that may become a critical failure if the roll also fails.                | fumble (as a label), bare "Error!"                   |
| **critical hit** / **critical miss**                               | An activated threat / error on an attack.                                               | critical success/failure on attack cards             |
| **critical success** / **critical failure**                        | An activated threat / error on any other check.                                         | crit, fumble                                         |
| **half action**, **full action**, **free action**                  | The time an action takes on your turn.                                                  | standard/move action, "Half" alone                   |
| **Initiative Count** (short: _Count_ after first use on a surface) | Where you sit in the turn order this round.                                             | init, initiative score, bare "Count" in headers      |
| **Threat Level** (TL)                                              | How dangerous the mission and its NPCs are.                                             | Threat level                                         |
| **standard NPC** / **special NPC**                                 | Standard NPCs make Damage saves instead of tracking vitality and wounds.                | mook, boss                                           |
| **Damage save**                                                    | A standard NPC's save against the damage it has taken so far.                           | toughness roll                                       |
| **Fortitude / Reflex / Will save**                                 | Your resistance to harm, danger and influence.                                          | saving throw (in labels)                             |
| **Career Level** / **class level**                                 | Total levels / levels in one class.                                                     | character level, total level                         |
| **gear picks**, **Caliber**                                        | What you may requisition for a mission, by category and quality.                        | requisition points, budget                           |
| **subdual**, **stress**                                            | Non-lethal damage to body and mind; each has a threshold.                               | —                                                    |
| **Shaken**, **Baffled**, **Incompetent**                           | Named conditions; show the grade as a Roman numeral (Shaken II).                        | —                                                    |

"GC pool", "session pool", "AD", "HP", "saving throw", "Tyre" and "next GM launch" were removed from user-facing strings in the first pass; the banned-terms lint in 11.2 is what keeps them out.

Capitalisation: **Defense**, **Initiative**, **Threat Level**, **Caliber**, **Career Level** and save names are always capitalised. **vitality**, **wounds**, **flat-footed**, **action dice** are lower case in running text and capitalised only as a field label or heading.

### 4.3 Words that never reach a player

Internal mechanics vocabulary describes how the code works, not what happened at the table. Do not use these in user-facing strings: _receipt, actual, recorded, settlement, candidate, supported, adjudication, RAW, client, relay, lock, flags, record_ (as a noun for game state), _npm_. Write "this attack", "the damage already applied", "the roll on this card" instead. Developer errors (`Roll contributor … flags must return an object`) go to `console.warn`, never to `lang/en.json`.

### 4.4 Numbers and ranges

| Rule                                         | Right                                | Wrong                   |
| -------------------------------------------- | ------------------------------------ | ----------------------- |
| Signed modifiers use a true minus and a plus | +2, −4                               | -4, 2                   |
| Totals, DCs and Defense carry no sign        | Defense 16, DC 15                    | Defense +16             |
| A space between word and number              | minimum 0, by 2, level 4             | minimum0, by2, level4   |
| Ranges use an en dash                        | threat 19–20, error 1–2              | threat 19-20, threat 19 |
| A one-face range prints the face             | threat 20, error 1                   | error 1–1               |
| Dice are lower case                          | 2d6, 1d4 subdual                     | 2D6                     |
| Distance                                     | 30 ft.                               | 30ft, 30'               |
| Grades and Caliber in Roman numerals         | Caliber II, Shaken III               | Caliber 2               |
| Page cites                                   | (p.341), (pp.339, 358), (pp.423–440) | (page 341), (pp.91,352) |
| Change of a value                            | 16 → 25                              | 16 -> 25                |

Use one helper for each: `signed()`, and `formatRange(kind, bound)` in `module/rules/outcome-labels.mjs` for threat and error ranges ("19–20", "20", "1", "1–3", "—"). The skill table, weapon rows, item sheets, dialogs and cards all call it; do not format a range by hand. Weapon rows build their one-line facts ("threat 19–20 · error 1 · range 25 ft.") with `weaponFacts()` in `module/sheets/play-rows.mjs`.

### 4.5 Strings are whole sentences

A label or sentence with a value in it is **one** i18n string with placeholders (`loc` templates already produce `{0}`-style patterns; see `module/i18n.mjs`). Never build a sentence from fragments such as `") · Caliber"` or `": Initiative Count"`: they break when a value is empty and cannot be translated or reordered. A status line made of several facts is a label/value grid (`.sc2-field`), not a sentence.

### 4.6 Help text, warnings and refusals

Every refusal, warning and error answers three things in one or two sentences: **what was stopped, why in plain words, and what to do next**.

| Good                                                           | Bad                                                 |
| -------------------------------------------------------------- | --------------------------------------------------- |
| View a scene first, then add the NPC to it.                    | Choose a listed combatant.                          |
| {name} can't Run while {condition}.                            | This character cannot Run in the current condition. |
| Not done: Defense boosts are declared at the start of a round. | Not done: see the warning.                          |

- A rule refusal is a **warning** (`refuse()`), never a thrown error. A fault is an **error** that ends "Please report this" with the issue tracker link.
- Show the reason where the user is looking: inline under the card button or beside the dialog field, not only in a fading toast.
- Name the thing: the condition, the weapon, the target.

### 4.7 Tooltips

- **Explain, never repeat.** A tooltip equal to the visible label is a defect; rely on `aria-label`.
- **Meaning first, then breakdown.** "Defense: how hard you are to hit." then "10 base + 2 class + 1 Dex …". The breakdown always sums to the shown value.
- Use `data-tooltip` only. Never author `title` (the runtime strips it in `module/apps/ui-tooltips.mjs`, but templates should not rely on that).
- Glossary terms get a visible `fa-circle-question` icon after the caption the first time they appear on a surface (the rail pattern: the vitality, wounds and action-dice captions in `templates/actor/agent-rail.hbs`). Put the `?` on the caption, not on a button.
- Page cites go in tooltips and details, not in labels.
- Roll controls end their tooltip with the fast-path hint ("Shift-click: roll with your last choices").

---

## 5. Visual foundations

All values come from `styles/tokens.css`. A literal colour, size or spacing value in any other stylesheet is a divergence unless it is a one-off geometry value (a grid column width, a container query breakpoint).

### 5.1 Colour roles

| Token                                                 | Role                                                  |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `--sc2-surface`, `-raised`, `-sunk`                   | Window body, tiles and cards, wells and tracks        |
| `--sc2-ink`, `-strong`, `-muted`                      | Body text, values, captions and secondary text        |
| `--sc2-bar`, `--sc2-on-bar`, `--sc2-on-bar-muted`     | The always-dark section bars and window header        |
| `--sc2-on-bar-good`, `--sc2-on-bar-danger`            | State text on a bar (save status, card header stamps) |
| `--sc2-action`, `-strong`, `-tint`, `--sc2-on-action` | Interactive: primary fill, secondary text, hover tint |
| `--sc2-danger`, `--sc2-danger-tint`                   | Harm, refusal, over budget, wounds, destructive       |
| `--sc2-good`                                          | Success, owned, threat                                |
| `--sc2-warn`                                          | Caution, stress/subdual, broken, "needs GC review"    |
| `--sc2-rule`, `--sc2-rule-strong`                     | Dividers (decorative) / control borders (meaningful)  |
| `--sc2-step-1` … `-10`                                | Creation track only                                   |
| `--sc2-focus-color` (falls back to `--sc2-action`)    | Focus rings; `Highlight` under forced colours         |

Rules:

- Use role tokens in new code. The older aliases (`--sc2-paper`, `--sc2-teal`, `--sc2-bad`, `--sc2-brass` …, `tokens.css:28-39`) remain for existing rules; replace them when you touch a line.
- **Danger red is for harm only.** Do not use it for hover, focus or decoration.
- `--sc2-rule` (about 1.5:1 on the surface) is for dividers only. A border that is the only cue for a control's edge uses `--sc2-rule-strong` (3.2:1 light, 3.8:1 dark).
- State never relies on colour alone: pair it with a word, an icon or a shape (5.6).

### 5.2 Light and dark

Tokens are declared light on every system root and overridden dark by the selector list in `tokens.css:76-110`. Sheets follow the application theme; chat cards and the console follow the nearest themed surface (the sidebar's interface theme), as `tools/tests/chat-theme.spec.mjs` checks. A new system root (a new wrapper class) must be added to that list, or nested inside an existing root, or its tokens will stay light in a dark window.

### 5.3 Contrast targets

| Pair                                        | Target  | Light now | Dark now     |
| ------------------------------------------- | ------- | --------- | ------------ |
| `ink` on `surface`                          | ≥ 7:1   | 13.8      | 13.6         |
| `ink-muted` on `surface`/`raised`           | ≥ 4.5:1 | 5.6/6.2   | 9.0/7.8      |
| `action` on `surface`/`raised`              | ≥ 4.5:1 | 6.6/7.3   | 7.0/6.1      |
| `danger` on `surface`/`raised`              | ≥ 4.5:1 | 6.3/6.9   | 5.1/**4.48** |
| `good`, `warn` on `surface`                 | ≥ 4.5:1 | 6.0, 4.6  | 7.8, 8.6     |
| `on-action` on `action`                     | ≥ 4.5:1 | 7.3       | 7.6          |
| `on-bar-muted` on `bar`                     | ≥ 4.5:1 | 8.8       | 10.6         |
| Control border (`rule-strong`) on `surface` | ≥ 3:1   | 3.2       | 3.8          |

Dark `danger` on `raised` is just under target; nudge the dark `--sc2-danger` slightly lighter. `warn` in light is close to the floor; do not use it for small text on `raised` tints. The ui-lab test (`tools/tests/ui-lab.spec.mjs:45-70`) checks ink, captions, on-bar, primary and stamp; extend it to every row of this table.

### 5.4 Typography

| Token              | Size | Use                                                         |
| ------------------ | ---- | ----------------------------------------------------------- |
| `--sc2-text-s`     | 13px | Captions, hints, table heads, chips, stamps — **the floor** |
| `--sc2-text-m`     | 14px | Body text, buttons, inputs                                  |
| `--sc2-text-l`     | 18px | Names, preview titles                                       |
| `--sc2-value-size` | 22px | Tile values                                                 |
| (card total)       | 28px | The one large number on a chat card                         |

- **13px is the minimum for any text that carries information.** 12px is allowed only for decorative labels whose words are not needed to play (the dossier band label). Some rules at 12px remain (see [backlog.md](backlog.md)); the console's section titles and tags are no longer among them.
- Faces: `--font-primary` (Foundry's Signika) for text; `--sc2-num` (system monospace) for values, dice and stamps; `--sc2-bar-font` only for the dossier band.
- Prefer token sizes to `em` sizes. Do not add a new pixel size without adding a token.
- No letter-spaced upper case for buttons or headings. Dialog footer buttons and GC Console section titles used to be exceptions and are now sentence case.

### 5.5 Spacing, radius, sizing

| Token                  | Value             | Use                                                                           |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `--sc2-space-1` … `-4` | 4 / 8 / 12 / 16px | Gaps inside a component / between controls / between groups / around sections |
| `--sc2-radius`         | 2px               | Every box: tiles, buttons, chips, cards                                       |
| `--sc2-control`        | 36px              | Minimum height of a standard button or input                                  |
| (compact)              | 28px              | Minimum for in-row and chat-card buttons                                      |
| (icon only)            | 44px              | Hit area of an icon-only button (`components.css:25-29`)                      |
| `--sc2-icon-size`      | 22px              | Pictogram size                                                                |
| `--sc2-rail`           | 264px             | Agent sheet rail                                                              |

Nothing interactive is smaller than 28px tall. Density comes from tighter text and fewer controls, not smaller targets.

### 5.6 State styles

| State               | Cue (all of)                                                     |
| ------------------- | ---------------------------------------------------------------- |
| Rollable value      | `--sc2-action` 3px lower edge, hover tint, die glyph in tooltip  |
| Untrained           | `.sc2-untrained`: the word "untrained", tooltip, aria text       |
| Spent / used        | Muted, struck through or dashed, count "0/3"                     |
| Over budget         | `danger` border, ⚠ icon, "over by N" text, `aria-describedby`    |
| Disabled (not now)  | `disabled` attribute, 45% icon opacity, tooltip with the reason  |
| GC only             | Small "GC" badge on the control, not just a class                |
| Suggested by system | "suggested" tag beside the pre-filled value                      |
| Pending GC review   | `warn` left border + text "needs GC review"                      |

### 5.7 Icons

- "Text carries data; pictograms carry verbs" (`components.css:1`). Pictograms come from the function atlases (`data-sc2-sheet`, `styles/spycraft2.css:144-167`); Font Awesome glyphs are fallbacks and are hidden when a pictogram exists.
- Every icon-only control has an `aria-label` and a tooltip that explains (4.7).
- Use `data-sc2-display="icon"` only for repeated row verbs (edit, delete, reload). One-off and primary actions show a text label.
- Status icons on tokens are Spycraft conditions only (6.7). `spycraft2.mjs` replaces `CONFIG.statusEffects` with the `SYSTEM_STATUSES` list plus the core entries Foundry itself reads (`CONFIG.specialStatusEffects`, such as defeated and invisible). Add a condition to that list, keep the ids the code reads (`module/data/actor.mjs` lists the aliases), and never append to core's list.

### 5.8 Motion

Motion is limited to colour transitions of 120ms or less, inside `@media (prefers-reduced-motion: no-preference)` (`components.css:221-223`). No animated entrances, no spinners for actions under a second (disable the button and show "Working…", as `chat-action-feedback.mjs` does). The console's disclosure arrow follows this rule (`gc-console.css`).

---

## 6. Components

### 6.1 Buttons

| Role      | Class                                                | Look                                     | Use                                         |
| --------- | ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Primary   | `.sc2-primary-action` (`.gc-primary` in the console) | Filled `--sc2-action`, bold              | The one next step of a region               |
| Secondary | `.sc2-action`                                        | Raised surface, action text, rule border | Every other action                          |
| Roll      | `.sc2-roll`, `.sc2-stat-action`                      | Value face, lower edge in action colour  | A figure or dice expression that rolls      |
| Quiet     | `.sc2-quiet-action`, `.sc2-text-action`              | Text-like                                | Corrections, close outcome, "Resolve again" |
| Danger    | `.sc2-action.sc2-danger` (new)                       | Danger text and border, never filled     | Destructive, irreversible                   |
| GC only   | any of the above + "GC" badge                        | —                                        | Visible only to the GC                      |

- **One primary per region.** A region is a card, a dialog footer, a console section or the sheet's act tier. The primary is the most likely next step, not the first one in code order.
- Every button is a real `<button type="button">` with one of these classes. Do not add new ad hoc button classes; `.sc2-btn` is unused and can go.
- Destructive buttons name what they destroy ("Clear mission record (objectives, antagonists, complications)") and ask once.
- An action with a time cost shows it as a tag (`data-sc2-cost`, `sheet-agent.css:132-135`).

### 6.2 Tiles and stat blocks

A tile is a `.sc2-field`: caption above (`--sc2-text-s`, muted), value below (`--sc2-value-size`, monospace). A tile that rolls is a `button.sc2-field.sc2-stat-action`. A tile that does not roll is a `div` and never looks pressable. A tile whose value is changed by a condition shows a marker and names the condition in its breakdown ("Fatigued −2 Str"); it never silently drops.

Every derived value has a breakdown tooltip that sums to the value. A button that shows a roll bonus carries it on the button itself, at +0 and below as well: one part per line, then a bold total equal to the figure on the button. The parts come from `module/rules/bonus-breakdown.mjs` (which adds an "Other modifiers" row for anything it cannot name, so the lines always add up) and `module/sheets/bonus-tips.mjs` turns them into rows for the `sc2tip` helper. Attributes, saves, Initiative, skills, Knowledge and weapon Attack buttons use it; the other `context.tips` entries in `module/sheets/actor-sheet.mjs` (Defense, Speed, vitality, wounds) are the older form of the same pattern. Still to extend: skill error range and the NPC graded tiles (B-255).

### 6.3 Tabs and the rail

- Tabs are captions with the active one filled `--sc2-bar` (`components.css:194-204`). Sentence case. The tablist is one Tab stop; arrow keys move between tabs; Tab moves into the panel.
- The agent rail is visible on every tab and holds the glance tier (7.1). It never scrolls in Play at 1280×720.

### 6.4 Lists and rows

A row reads: name (opens the item) → facts → actions, with repeated verbs as icon buttons at the far end (`components.css:94-98`). Rows are at least 36px tall. Edit and delete icons are `edit-only`.

### 6.5 Limited-use counters

One partial for every limited use, everywhere (`templates/actor/parts/use-counter.hbs`; `SPYCRAFT.Uses.*` strings):

`[2/3] Name · per session [Use]`

- The count chip (`.sc2-uses`) comes first; it turns `spent` at 0.
- The Use button is disabled at 0, with a tooltip saying when uses return.
- On Play, all limited uses are listed once, under "Abilities in play", grouped Combat / Social / Gear / Other.
- Activations are declared in item data and rendered generically; templates do not branch on item names. (The Play tab list exists; declaring activations in item data is still open, A12.)

### 6.6 Tracks and meters

Vitality and wounds are meters (`.sc2-meter`) with current/max. Damage saves, vehicle condition and similar counts are box tracks (`.sc2-track`, `sheet-npc.css:29-34`) with threshold boxes marked. Each meter states the band it is in with a word ("Unconscious", "Dying") once a band applies.

### 6.7 Stamps and chips

- A **stamp** (`.sc2-stamp`) is a status that must not be missed: a condition, HIT, MISS, THREAT, ERROR. Upper case, monospace, 13px, `currentColor` border. Every stamp has a tooltip with its glossary sentence and current effect.
- A **chip** (`.sc2-chip`) is a passive fact: Career Level, NPC kind, TL, "Cover: Mara".
- Condition stamps use the Spycraft name and grade (Shaken II). `conditionStamps()` in `module/sheets/agent-ux.mjs` builds them with their one-line reminder for the agent rail and the NPC header. Leave the reminder out for a condition whose effect cannot be said in our own words without risk of misstating the rule.

### 6.8 Forms and inputs

- In Play, glance values are read-only text. Correction is through a pencil (`Adjust…`) that opens a small dialog with the old value, the new value and an optional reason. The rail's action dice are the model (`adjustActionDice` in `module/sheets/actor-sheet.mjs`).
- **Exception:** current vitality and wounds stay as inputs on agent and special-NPC sheets, because GCs call damage aloud and players type it. They must not change on mouse wheel.
- Labels sit above or beside their control and are real `<label>`s. Table inputs carry the row name in their accessible label ("Stealth misc").
- Checkboxes have labels of eight words or fewer; the full condition goes in a hint below (`briefOption`, `module/apps/dialog-sections.mjs`).
- A field that only applies to one choice is hidden when another choice is selected. A label ending "(X only)" means hiding is missing.
- Every free-text builder field has an example placeholder. Every budget shows "N left" beside the field that spends it.

### 6.9 Disclosures

Use `<details>`/`<summary>` with a plain-text summary (no headings or controls inside a summary). Summaries are at least 44px tall (`components.css:287`). The summary names the content and, when closed, shows a count or status ("Combat tools · 3 pinned"). Disclosures remember their state per sheet (`data-key`). Rare actions go in a small "More" disclosure beside the common ones: `.rail-more` on the agent rail, "More actions" on the NPC sheet, `.gc-more` ("More mission tools") in the console.

### 6.10 Empty states

An empty list says what goes there and offers the one button that fills it: "No objectives. Add one to set the mission's XP. [Add objective]". Never just "None yet." Use `.sc2-empty`. The console lists and the Play tab ("Nothing needs review.", no trained skills) follow this.

### 6.11 Notifications

- `ui.notifications.info`: something finished elsewhere (a request lapsed, an import completed).
- `warn`: a rule refusal or a needed action. Also shown inline where the user acted (4.6).
- `error`: a fault. Ends with "Please report this".
- Never toast an event that is already visible on a card the user is looking at.

---

## 7. Surface patterns

### 7.1 Agent sheet

**Layout.** Rail (264px) beside the tabs: Play, Skills, Gear, Abilities, Dossier, in that order. Default 860×760, docked left (`module/sheets/sheet-placement.mjs`); below 720px container width the rail folds above the tabs (`sheet-agent.css:80-86`).

**Rail (glance tier), top to bottom, in Play:**

1. Name, code name, active cover identity chip.
2. Conditions as stamps.
3. Vitality and wounds meters with band word; stress and subdual when non-zero.
4. Defense with the flat-footed figure written out beneath it (`flatFootedDefense()`, `.rail-defense-note`) and DR; Initiative; Speed; the three saves. The Defense tile opens the incoming-attack check.
5. Action dice: count (read-only, with a pencil), die type, pips; the one common spend (Boost Defense, disabled with its reason or showing that it is active, from `defenseBoostState()`). Roll action die, Heal and Refresh sit under "More".
6. A single "Setup: N left" chip if setup is unfinished (opens Edit). The checklist itself is Edit only.

**Play tab (act tier, `templates/actor/play/dashboard.hbs`):** round tracker with half-action pips → a "Your turn" strip (Attack with the readied weapon, Skill…, Total Defense, End turn) → attributes → weapons → trained and pinned skills → abilities in play (6.5) → active effects (one chip per running effect, from `activeEffectLines()`; expiry and an End button where the effect has them) → combat tools (disclosures) → reference (closed).

**Weapon row** (`templates/actor/parts/weapon-row.hbs`, shared by the agent Play tab and the NPC sheet): name · "Attack +6 · 19–20" (primary) · damage dice (roll) · range increment or Reach · ammo loaded/capacity · state chips (untrained, not readied). Everything needed to attack without opening the item. Threat range, error range and range print as one facts line under the row.

**Skill row:** name · total(s) as roll buttons (one per attribute option) · threat range · error range only when wider than 1.

**Edit mode:** stepper, budgets (one "spent / available" widget, red with reason when over), browsers. "Next setup step" stays at the top of the rail. The stepper, the next-step button and the checklist read from one task list that ends with "Ready to play".

### 7.2 NPC sheet (stat block)

The NPC sheet is a stat block for play, not an agent-sized form.

- **Size:** default 480×640; minimum width 420px. Per-kind minimums are the `MIN_WIDTHS` table in `module/sheets/sheet-placement.mjs`; the shared 640px minimum is for agents.
- **Header chips:** TL · NPC kind and role · Defense · Initiative · health (V/W for special NPCs; "Save +4 · next DC 14 · ✗✗□" for standard NPCs) · condition stamps.
- **Only the track the NPC uses:** a standard NPC shows its Damage-save track and no vitality/wounds; a special NPC shows vitality/wounds and stress/subdual and no Damage-save track.
- **Attribute tiles** show the full names when they fit and the three-letter abbreviations (STR, DEX…) below a 690px container, with the full name in the button's accessible name and the abbreviation's tooltip. The agent Play strip does the same while the rail squeezes it (721–857px).
- **Weapons first**, each row as in 7.1.
- **Glance values read-only in Play.** BAB, saves, Defense and Initiative inputs are Edit only.
- **Rare actions** (takedown, cheap shot, Shaken, Baffled/Incompetent review) live under "More actions"; a review warning appears only when one fires.
- **A skill roll made openly** prints the result only. The bonus, cap and modifier breakdown goes to the GC-only (secret) card.
- **Edit:** the builder, with a sticky results strip at its top so grade changes show their effect without scrolling (the strip is still open, N11). Delete icons, Reset and hand-typed stats are `edit-only`.
- Grades are Roman numerals everywhere.

### 7.3 Vehicle and item sheets

- Vehicle: speed, handling, Defense, condition track with broken/destroyed boxes marked (`.sc2-track`). Thresholds are one string with placeholders.
- Items: the play figures in a summary row (`.item-summary`) above the form. Developer fields (JSON prerequisites, formula keys such as `@tb.t1`) are GC-only and behind "Technical detail"; item templates test `isGM` from the sheet context. The decorative agency seal is gone from vehicle and item headers and the browser. Choices a feat needs (an armor type, a skill) are made inline on the character's feat row, not on the item sheet.

### 7.4 Roll and option dialogs

**Gestures (the same for every roll control on every sheet):**

| Gesture     | Result                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Click       | Opens the roll's dialog; rolls at once only if the roll has nothing to choose                                   |
| Shift-click | Rolls at once with the last choices and sensible defaults (the client setting can swap these)                   |
| Fallback    | If the defaults cannot be worked out (no target, unknown range), open the dialog. Never post a degraded result. |

This holds for attributes, saves, skills, attacks, damage, initiative and knowledge.

**Anatomy, top to bottom:**

1. One purpose line, if the title is not enough.
2. The decision fields in the order they are decided, most common option preselected, target and measured range filled in.
3. **Situational modifier** (number, default 0) — in every roll dialog, in the quick section. It is never remembered between rolls (`NEVER_REMEMBERED` in `module/apps/remembered-choices.mjs`) and the card's header says when one was applied. Skill and attack dialogs have it; attribute, save and damage rolls do not open a dialog yet (D2, D3).
4. Roll visibility for the GC (public / GC only) on NPC rolls.
5. Named circumstance groups, collapsed, with a "N set" count (`attack-dialog-ux.mjs` is the model).
6. "What the system does for you" disclosure, last and collapsed (`installResolutionGuide(root, kind, { append: true })` in `module/apps/resolution-guide.mjs`).
7. Footer: one primary that names the result ("Roll attack: Beretta 92"), and Cancel. Enter submits; Esc cancels.

- Dropdown options are names; mechanics for the selected option appear as one line under the select. Put the detail on the option as `data-detail`; `module/apps/skill-dialog-ux.mjs` shows it in `.sc2-check-detail`.
- When the GC opens a dialog, its GC confirmations arrive ticked with a note saying how many (`trustConfirmations(element, { asGC })` in `module/apps/dialog-theme.mjs`). _Trust the table_ does the same for everyone.
- An option that depends on the kind of check names that kind: the critical dialog offers "Critical hit (you pay)" on an attack and "Critical success" elsewhere.
- Width 560px for ordinary dialogs, 720px for tables (rosters, references). Height capped by `.sc2-dialog .dialog-content` (the screen height less 200px for header, footer and margins); the footer stays visible and the body is the only scrolling box.
- Remember last choices per dialog and offer "Reset" (`module/apps/remembered-choices.mjs`).

### 7.5 Chat cards

**Fixed anatomy:**

1. **Header bar:** who → whom · what ("Latch → Mercenary · Attack (Tonfa)"). One short display name per person: the code name when there is one, otherwise the name without the role a token name adds, with the full name as the tooltip (`shortSpeakerName()` in `module/rolls/chat-compact.mjs`); "(you)" after the viewer's own character. One line of what; no paragraphs in the header.
2. **Outcome:** a stamp with word and icon (✓ HIT, ✗ MISS, SUCCESS, FAILURE, PENDING), never colour alone.
3. **The number that matters:** the final total large, the natural die beside it, "16 → 25" when action dice changed it, and the comparison ("vs Defense 14: hit by 3"; "capped at 40" when a cap bit). Hovering or focusing the formula and total lists the die, each part of the bonus and the total (`renderCheckBreakdown()` in `module/rolls/chat-breakdown.mjs`); a roll records its parts as `breakdown` on the check. The parts add nothing to the card's height. An NPC's parts show only to someone who may open that NPC (7.2).
4. **Next step:** exactly one primary button for it. The sentence saying who acts next is a hint (ⓘ) on the outcome title, not a paragraph.
5. **Secondary actions** in one wrapping row at intrinsic width.
6. **Why:** modifiers, ranges, feat notes and page cites, then what the system does and what the table decides, in one closed "Details" disclosure at the foot (`compactChatCard()` moves every flavor line after the first there).

**Primary by state:**

| Card state       | Primary                             | Secondary                                        |
| ---------------- | ----------------------------------- | ------------------------------------------------ |
| Pending          | Resolve vs Defense N (with preview) | Spend 1 action die (+1d4) ▾, GC boost, reactions |
| Threat confirmed | Activate critical hit (N dice)      | Resolve, Spend                                   |
| Hit              | Roll damage                         | Resolve again (quiet)                            |
| Damage rolled    | Apply N to {target}                 | Adjust…, Apply to another target…                |
| Damage applied   | —                                   | Undo (GC)                                        |
| Finished         | —                                   | (collapsed to one summary line)                  |

**State words (one set, used by guidance titles, feedback lines and buttons; `checkGuidance()` in `module/rolls/chat-guidance.mjs` returns the title, note, tone and change, and `outcomeLabel()` in `module/rules/outcome-labels.mjs` picks hit/miss or success/failure):** Pending → Hit / Miss or Success / Failure → Damage rolled → Damage applied → Finished. Before confirmation say "Threat, if it succeeds" / "Error, if it fails"; after activation say "Critical hit" (attack) or "Critical success" (other checks), and their failure counterparts.

**Rules:**

- The outcome vocabulary switches on `checkKind`: attacks hit/miss and critical hit/miss; everything else success/failure and critical success/failure. No slash forms on a card that knows which applies.
- Two buttons that do nearly the same thing never share a card; the quick spend and the full boost dialog are one button with a ▾ beside it (`split: true`, `.sc2-split-more`).
- The closing button is "Finish". A button whose wording depends on the card (the critical button, the spend button) sets its own label and has no `SPYCRAFT.RollControl.*` override.
- The line under a pressed button says "Done. The next step is at the top of this card.", "Not done: {reason}", or nothing after a closed dialog (`module/apps/chat-action-feedback.mjs`).
- A control that a keyboard shortcut must find carries a `key` (rendered as `data-roll-key`), as GC boost does.
- Spent controls leave and become a line ("Damage applied: 6 to Mercenary").
- Onlookers see the same card without buttons, and a passive status ("Waiting for the GC to apply 6 to Security Guard").
- A card the system wrote to an actor from keeps an Undo for the GC for as long as the card exists.
- Every system message uses the card skin and one content root (`<div class="spycraft2 chat-note">`).

### 7.6 Combat tracker and turn flow

- Each row shows Initiative Count, half actions left (acting combatant), flat-footed, wound state word, Press/reeling and conditions as text. `trackerRowStates()` in `module/apps/gc/combat.mjs` supplies flat-footed for everyone and the wound state only to someone who may open that sheet; standard NPCs have no wound state.
- Counts use a real plural: two strings ("1 half action left", "{n} half actions left"), never "(s)".
- Context menu: Spend half / full action, Give back, **Delay…**, **Ready**, **Readied action triggered**, Fluid initiative event. Delay moves the turn on. (Delay and Ready are not built yet, T2.)
- The agent's "Your turn" strip has End turn, which refuses with a reason when it is not that character's turn.
- Defeated and unconscious combatants are visibly skipped; the GC can still give them a turn.
- Half actions are marked automatically by posted actions, with undo from the card and a pip to correct by hand. Exceeding the budget warns and does not block.

**Click budgets** (scripted, from the moment the turn starts):

| Action                                           | Budget       |
| ------------------------------------------------ | ------------ |
| NPC attack turn, miss (target, attack, next)     | ≤ 4          |
| NPC attack turn, hit, through applied damage     | ≤ 6          |
| Apply or remove a common condition on a token    | ≤ 2          |
| Advance the turn from wherever the GC is looking | 1 (or a key) |
| Spend a GC die on an open NPC card               | 1            |
| Place a prepared NPC on the scene                | ≤ 3          |
| Answer a player's request                        | 1            |
| Player: plain skill check from Play              | ≤ 2          |

A PR that pushes one of these over budget explains why.

### 7.7 GC Console and tools

- **Prep | Play switch** at the top. Play hides mission editing and keeps one summary line (TL, Caliber, XP so far); Prep shows the mission, objectives, antagonists, complications and campaign qualities.
- **Status strip** (`gc-now`): Scene, GC dice, Round, and "Pending N" (player requests + unresolved attack cards + open threats and errors), which jumps to the oldest. Add the team's action dice. Time already shows on the clock badge.
- **During a combat, Combat comes first**, directly under the strip (`templates/apps/gc-console-combat.hbs`, rendered at the top while a combat exists and in its usual place otherwise). A running fight opens with the **turn bar** (Next turn, Previous turn, Spend GC dice), sticky at the top of the console, so Next turn never moves. Then the acting combatant: Defense, half actions left, health and conditions as one compact block, one button per weapon ("Attack +5 · 2d6", Shift-click semantics against the T-target), "Card: next step" (it reads "Card: apply damage to {target}" while that combatant's newest card is damage not yet applied), Delay and Ready, and the bookkeeping (Spend, Give back, Damage save) under "Turn actions". Alt+1 and Alt+2 press the first two weapon buttons on a standing NPC's turn. Every acting button carries `data-combatant` and does nothing, with a notice, once the turn has moved. The order is a name and Count list; a row press selects and pans to the token, a double press (or the acting name) opens the sheet, and hovering a row lights its token. Before the fight: the Initiative rolls first, then the list, then Begin combat on its own row, which says how many have not rolled; Add selected tokens and Combat references beside each other, and End combat in a closed "Fight tools". With no fight, Combat stays open in Play and offers "Start a fight with the selected tokens". During a fight, End combat sits under the order in danger style.
- **One primary per view and state**, chosen by `primaryAction()` in `module/apps/gc/console-view.mjs`: the first-session step, else Start/Edit mission in Prep; Roll NPC Initiative before a fight and Next turn during one; Begin session, else Spend dice, in Play; End mission, else XP report, in Wrap-up. Section "Add" buttons are secondary and name their object.
- Alt+G opens the console as a window by default, so the chat log stays in the sidebar (client setting "GC Console in its own window"); the sidebar tab sits after Combat.
- Rare tools (Recalculate TL, Clear record, exposure infractions) sit under "More mission tools".
- Facts are label and value pairs in a `.gc-facts` grid of `.sc2-field` tiles (Threat Level, Caliber, standing reward, XP, GC action dice). A value with several parts is one string with placeholders (`SPYCRAFT.Console.*`).
- Row buttons are verbs in sentence case with no dash before them: "Mark done", "Mark faced", "Remove". A toggle carries `aria-pressed` and shows its on state; each row button's accessible name includes the row ("Remove Steal the ledger"). Remove is `.gc-danger`, set apart, shown in Prep only, and leaves an Undo note.
- Section titles are 13px sentence case, set by one rule.
- Every button that changes world state has a tooltip saying what it changes (the `Console.NextSceneHint` style).
- Console search matches labels and hidden synonyms (`data-search-terms`): "npc", "add enemy", "initiative", "turn", "damage", "xp", "dice".
- Each section header has a `?` linking to the matching GC guide section.

### 7.8 NPC builder

Grades and TL at the top, results strip sticky, reference tables behind a disclosure. The two misprinted table cells keep their in-app flag (`module/rules/npcs.mjs:197-203`). "Add NPC to scene" offers "Place N copies" with auto-numbered token names. Prepared NPCs get a token set by kind: standard unlinked, special linked, hostile, bar 1 showing the track the NPC uses.

### 7.9 Compendium browser

Two panes (list, preview). Rows about 36px with name, one-line summary and an Add button; the first row previews by default. Enter adds the focused entry; an option closes the browser after adding. "Qualified only" is on by default only when the browser was opened for a character. Pack tiles have distinct art and the GC-facing packs (NPC templates, sample agents, Glass Wake) sit at the top.

### 7.10 Settings

Name in sentence case; hint one sentence, 160 characters at most, ending with a page cite where the setting chooses between rule readings. Interpretive rules default to the common reading, and the card notes which reading applied. Client conveniences (Shift-click swap, hide the resolution guide) are client scope; table rules are world scope.

---

## 8. Automation and GC authority

### 8.1 Three tiers, declared per rule

| Tier        | When                                                                                     | UI                                                                      |
| ----------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Apply**   | Deterministic and reversible (sums, damage routing, a half action, clearing flat-footed) | Done automatically; the card shows what was done and offers Undo        |
| **Suggest** | Needs a fact the system cannot see, or a ruling (distance, flanking, cover)              | Pre-filled with the best guess, tagged "suggested", one click to change |
| **Remind**  | Outside what the system models                                                           | One line on the card with a page cite and no controls                   |

When the system cannot work something out (range not measured, quality not automated), the card says so in its result line in the warning colour, not in small print.

### 8.2 Defaults, not attestations

A "The GC confirms…" checkbox is a click in the middle of play. There are 159 distinct `…Confirmed` checkbox names across 74 files in `module/`, and 131 "The GC confirms" strings in `lang/en.json`.

- **Target:** replace each with a pre-filled control whose label is the effect ("Flanking +2"), a tooltip with the condition and page, inference from the canvas where possible, and a GC override on the card afterwards.
- **Until then:** when the user is the GC, pre-tick these boxes and say so in one line ("You are the GC: confirmations ticked"). _Trust the table_ does the same for players. Players' dialogs are otherwise unchanged.
- A confirmation is justified only when the step cannot be undone (spending another player's dice, ending a mission, deleting a record).

### 8.3 Overrides and undo

- Every automatic outcome on a card (hit or miss, damage after DR, save DC, flat-footed cleared, a Count change) has a GC override on that card: "Treat as hit", "Adjust amount", "Undo".
- The card records an override visibly ("GC override: DC 14 → 12").
- Any write to an actor from a card stores a before-image on the card and can be undone by the GC, including standard-NPC damage tracks and GC boosts.
- The Reach check is the model: it blocks a player and asks the GC.

### 8.4 Visibility

- GC-only by default: NPC rolls that reveal stats, reference-table results, encounter distance.
- Public: NPC attack results, without the NPC's bonuses or caps unless a world setting allows.
- Per roll: a "GC only" toggle in NPC attack, save and skill dialogs, remembered per world.
- A player's secret check posts a note saying where the result went (kept from the current design).

### 8.5 Player requests

A request to change something the player does not own arrives as a card with Allow and Decline. The pending state lives on the message, so it survives a reload; the timeout is a world setting with a long default; the player is told when a request lapses.

### 8.6 Legality

Only show controls that are legal now (principle 4). Boost Defense outside the round start, Activate critical on a non-threat and Roll damage after damage is applied are disabled with the reason, not refused after the click. A boost that would add nothing because of a cap says so before the die is spent.

---

## 9. Accessibility and input

### 9.1 Keyboard

- Every interactive element is a `<button>`, input, select or summary, in a logical Tab order. Templates no longer author `<a data-action>` (0 today); keep it that way.
- The sheet tablist is one Tab stop that hands off to the panel. Dialogs trap focus and return it on close; focus starts in the first meaningful field, or on the primary if there is none. Enter submits; Esc cancels. Chat card buttons are reachable by Tab.
- Focus is shown by one rule: a 3px `--sc2-focus-color` outline, offset 3px (the `:focus-visible` rule in `components.css`). Do not add other focus styles; the warm ring on icon buttons was the last one and has been removed.

**Keybindings** (registered in `module/apps/keybindings.mjs` with `game.keybindings.register`, all rebindable under Configure Controls, documented in `docs/gc-tools.md`):

| Action                                      | Default   | Who |
| ------------------------------------------- | --------- | --- |
| Next turn / Previous turn                   | Alt+N / P | GC  |
| Open or focus the GC Console                | Alt+G     | GC  |
| Open the active combatant's sheet           | Alt+S     | GC  |
| Press the primary button on the acting combatant's newest card, else the newest card | Alt+Enter | All |
| GC boost on the newest open NPC card (second press confirms) | Alt+B     | GC  |
| Spend GC action dice (acting NPC chosen)    | Alt+D     | GC  |
| Mob attack for the acting NPC's group | Alt+M | GC |
| Attack with the acting NPC's first or second weapon | Alt+1, Alt+2 | GC |

A new shortcut is added to that file's table, marked `restricted` when it is for the GC, and listed in `docs/gc-tools.md`. Card shortcuts find their button by `.sc2-primary-action` or `data-roll-key`, not by its text.

### 9.2 Screen sizes

- Supported: 1366×768 (Foundry's stated minimum) and 1280×720, plus landscape tablets. Phones are not a goal.
- At 1280×720: the agent rail does not scroll in Play; the attack dialog footer is visible; an NPC sheet and the console leave the tokens of a six-token encounter clickable.
- Containers, not viewports, decide layout (`container-type: inline-size` on sheets).

### 9.3 Colour-blind safety and contrast

Contrast targets are in 5.3. Every red/green pair (good/bad, hit/miss, threat/error, owned/unqualified) also differs in a word or icon: ✓/✗, ▲ threat / ▼ error, "over by 2". Screen readers get the same words via `aria-label` or `aria-describedby`. Respect `prefers-contrast: more` and `forced-colors: active` (hooks already exist).

### 9.4 Screen readers

Heading levels do not skip: window title (h1, Foundry), section bars h2, sub-sections h3. Live state (results, meters, conditions) sits in `role="status"` regions. Icon-only controls have names. Inputs in tables carry row context.

---

## 10. Audit of existing features

The audit of 2026-11-23 listed 120 places where the system diverged from this guide. PR 63 fixed 82 of them. The 38 still open moved to [backlog.md](backlog.md) on 2026-11-24, where each keeps its old id with an `SG-` prefix (`G2` is `SG-G2`), beside the findings of the later reviews. **New divergences go in the backlog, not here.**

What stays in this section is what a contributor needs while working: what already complies (10.11), claims that were checked and dropped (10.12), decisions already made (10.13) and the shared pieces to reuse (10.14).

### 10.11 What to keep

**Keep — already compliant, do not regress:**

- The rail plus creation track with "Next setup step" at the top (`agent-rail.hbs`); the inline vitality die on level-up.
- The `?` captions on vitality, wounds and action dice (`agent-rail.hbs`).
- The attack dialog's quick/advanced split with a "N set" counter, `briefOption`, and remembered choices with Reset.
- One-click Resolve with a hit/miss preview; NPC quick resolve against the T-target; the cover selector in Resolve (`damage-application.mjs:208`).
- GC boost and Activate threat (GC dice) on NPC cards, paid from the GC dice.
- Reach: block the player, ask the GC — the model for 8.3.
- "Begin combat" warning with "Roll for NPCs and remind players" as the default (`module/apps/gc/combat.mjs:96-102`) — the model for 4.6 and 6.1.
- _Trust the table_ marking what it ticked, and the same note for a GC (`trustConfirmations` in `dialog-theme.mjs`).
- GC-only reference results whispered; the player's secret-check note.
- Console sections that open by game state; Add NPC to scene with Record for XP separated and explained.
- Token-based theming with chat following the interface theme, tested in `chat-theme.spec.mjs`; container queries; `forced-colors` and `prefers-contrast` hooks; 44px icon targets; one strong focus ring.
- Templates author real buttons (no `<a data-action>` left).

### 10.12 Member claims dropped or corrected

- **No token bars declared** — wrong. `CONFIG.Actor.trackableAttributes` is set in `spycraft2.mjs`; the real gap is the standard NPC's damage track (N14).
- **`spycraft2.css` overrides the danger/good tokens** (earlier HTML/CSS review) — fixed in the current tree; dropped.
- **Chat search uses literal light colours; inline `style=` in dialogs** — fixed (Foundry variables; `.sc2-scroll-list`); dropped.
- **Player Play tab shows review notices all the time** — players see them only when a review is pending (`agent-main.hbs:28-36`); the always-on buttons are in the GC's view (A14).
- **`combat-defense.hbs:24, 31-33`** — the file has 22 lines; the cited buttons are at `:11-13`. The "Apply Initiative Count loss" button was not found; dropped.
- **Misc modifiers "at the bottom of Play"** — they are Edit only; only the raw-key labels stand (A21).
- **Rail tiles "styled the same"** — rolling tiles carry an action-colour lower edge (`components.css:173-178`); downgraded to P2 (A24).
- **Paths:** `rolls.mjs` and `skill-rolls.mjs` are under `module/documents/actor/`; critical-activation lines are in `module/documents/actor/outcomes.mjs`, outcome notes in `module/rules/outcomes.mjs`. The _Trust the table_ default is at `dialog-theme.mjs:72`, not `:71`.

### 10.13 Decisions where members disagreed

| Question                                         | Decision                                                                                 | Why                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Expand GC as "Game Control" or "Game Controller" | **Game Control**, once per surface; "GC" elsewhere                                       | It is the game's own term and already in the code                                  |
| Label errors as "fumble"                         | **No.** "error range" / "Error, if it fails", with a `?` that may compare it to a fumble | Keeps the exact term (principle 6) while the tooltip bridges for newcomers         |
| Vitality/wounds inputs in Play                   | **Keep as inputs** (no wheel); other glance values read-only                             | Damage is called aloud and typed constantly; other values change rarely            |
| Hide or disable unusable controls                | **Hide** if the character lacks it; **disable with reason** if not now                   | Removes noise without hiding when to come back                                     |
| Confirm before spending an action die            | **Undo on the card**, confirm only until undo exists                                     | Confirmations slow every spend; undo protects the novice without taxing the expert |
| Turn bar or console combat panel                 | **Console combat panel first**, poppable; floating bar optional later                    | Reuses the existing surface and its state handling                                 |
| Minimum text size 12px or 13px                   | **13px** for information, 12px decorative only                                           | Stamps and tags carry meaning at the table                                         |
| GC confirmation boxes                            | **Replace with defaults** long term; **pre-tick for the GC** now                         | Fast relief now without blocking the larger rework                                 |

### 10.14 What the first pass added

PR 63 fixed 82 items. The shared pieces it added, to reuse instead of rebuilding:

| Need                                           | Use                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Print a threat or error range                  | `formatRange()` in `module/rules/outcome-labels.mjs`                                        |
| Choose hit/miss or success/failure wording     | `outcomeLabel()` in the same file                                                           |
| Card state title, note, tone and "16 → 25"     | `checkGuidance()` in `module/rolls/chat-guidance.mjs`; `.sc2-outcome-<tone>` in `chat.css`  |
| A weapon row on any sheet                      | `templates/actor/parts/weapon-row.hbs` with `weaponFacts()` from `module/sheets/play-rows.mjs` |
| A limited-use counter                          | `templates/actor/parts/use-counter.hbs`                                                     |
| Condition stamps with reminders                | `conditionStamps()` in `module/sheets/agent-ux.mjs`                                         |
| Flat-footed Defense, Boost Defense state       | `flatFootedDefense()`, `defenseBoostState()` in the same file                               |
| Wound state word (size-aware)                  | `woundState(wounds, deathThreshold)` in `module/rules/damage-application.mjs`               |
| State words on a tracker row                   | `trackerRowStates()` in `module/apps/gc/combat.mjs`                                         |
| A per-kind minimum sheet width                 | `MIN_WIDTHS` in `module/sheets/sheet-placement.mjs`                                         |
| GC confirmations ticked for the GC             | `trustConfirmations()` in `module/apps/dialog-theme.mjs`                                    |
| "What the system does for you" in a dialog     | `installResolutionGuide()` in `module/apps/resolution-guide.mjs`                            |
| Detail line under a select                     | `data-detail` on the option; `.sc2-check-detail` in `module/apps/skill-dialog-ux.mjs`       |
| A keyboard shortcut                            | the table in `module/apps/keybindings.mjs`                                                  |
| Label and value pairs in the console           | `.gc-facts` in `styles/gc-console.css`                                                      |

Two constraints met along the way, for whoever continues:

- `module/sheets/agent-ux.mjs` and `module/apps/skill-dialog-ux.mjs` are inlined into test pages with only their `loc` import rewritten. They must not import anything else; put helpers that need other modules in a file of their own (as `play-rows.mjs` does).
- A partial used by a sheet or the console must be listed in that part's `templates`, and `tools/test-templates.mjs` checks it. Handlebars inline partials are not accepted by that test.

---

## 11. Review checklist and lints

### 11.1 Reviewer checklist

**Structure**

- [ ] Glance / act / look-up tiers respected; rare tools behind a named disclosure.
- [ ] One primary per region; primary is the next step and names its object.
- [ ] Controls the character lacks are not rendered; controls not legal now are disabled with a reason.
- [ ] Play mode: no editable glance values except current vitality/wounds.
- [ ] Every card write is undoable by the GC from the card; automatic results have a GC override.

**Words**

- [ ] Glossary terms only (4.2); no banned variants or internal vocabulary (4.3).
- [ ] Numbers follow 4.4; ranges via `formatRange()`; signed values via `signed()`.
- [ ] Each string is a whole sentence with placeholders; hints ≤ 160 characters.
- [ ] Refusals say what, why and next, inline where the user acted.
- [ ] Tooltips explain rather than repeat; no authored `title`.
- [ ] No rulebook text; `npm run check:copy -- /path/to/rulebook.md` run locally.

**Look**

- [ ] Only tokens from `tokens.css`; no new literals or pixel sizes without a token.
- [ ] Text ≥ 13px; contrast targets in 5.3 met in both themes.
- [ ] No state by colour alone.
- [ ] Danger red only for harm.

**Use**

- [ ] Click / Shift-click behave as 7.4.
- [ ] Keyboard: Tab order, focus trap in dialogs, Enter/Esc, chat buttons reachable.
- [ ] Checked at 1280×720 and 1366×768, light and dark, with a popped-out sheet.
- [ ] Click budgets in 7.6 not exceeded (or justified).

### 11.2 Lints that can run in CI

These do not need the rulebook, so they run in CI with `npm test`, in `tools/test-style-lints.mjs`. Banned terms, Glued numbers, Ranges, developer words, the three template lints and CSS sizes are hard rules: their count is nought and must stay there. Fragment keys, the internal words, First person, string length and CSS literals are ratchets: each has a cap equal to the count of old text still to reword, and a new string may not raise it; lower the cap whenever a count falls. One primary is covered by the console's own view test, and Keybindings by the keybinding tests. The audit ids in the last column are the audit's own.

| Lint                     | Check                                                                                                                                                                                                                      | Audit items  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Banned terms             | `lang/en.json` values must not match `\b(GM\|HP\|VP\|WP\|AD)\b`, `Game Master`, `Game Controller`, `game moderator`, `Threat level`, `GC pool`, `session pool`, `[Ss]aving throw`, `[Ff]lat ?[Ff]ooted`, `defence`, `Tyre` | L1–L7, L15   |
| Glued numbers            | No `\b(by\|minimum\|maximum\|level\|than\|to\|of\|at\|Use)\d` and no `[a-z]{3,}\d+[a-z]` outside dice (`\d*d\d+`)                                                                                                          | L8           |
| Fragment keys            | No value starts with `)`, `·`, `—`, `,`, `/` or ends with `(`, `·`, `—`                                                                                                                                                    | L9           |
| Internal vocabulary      | Values must not contain `receipt`, `RAW`, `npm`, `flags must`; warn on `actual`, `recorded`                                                                                                                                | L10, L13     |
| First person             | Warn on values starting `I ` or containing `I am` unless the key is whitelisted as a player declaration                                                                                                                    | L11          |
| Hint length              | Warn on any value over 160 characters whose key ends `Hint` or which feeds `data-tooltip`                                                                                                                                  | L12          |
| Ranges                   | No `\d+-\d+` between digits in templates or `loc` strings; use the en dash                                                                                                                                                 | A16, C2      |
| Templates: anchors       | No `<a [^>]*data-action` in `templates/`                                                                                                                                                                                   | (keeps 0)    |
| Templates: title         | No `title="` on elements in `templates/` (partial parameters excepted)                                                                                                                                                     | N12, G12     |
| Templates: name branches | No `sc2eq item.name` in `templates/`                                                                                                                                                                                       | A12          |
| CSS literals             | No hex or `rgb(` colours outside `styles/tokens.css` (allow `transparent`, `currentColor`)                                                                                                                                 | S4, S6       |
| CSS sizes                | No `font(-size)?:[^;]*\b(9\|10\|11\|12)px` outside a whitelist                                                                                                                                                             | S7, C13, G10 |
| Keybindings              | `module/` registers at least the 9.1 set                                                                                                                                                                                   | T3           |
| One primary              | Template tests: each rendered card state, dialog footer and console section has at most one `.sc2-primary-action`/`.gc-primary`                                                                                            | C6, G3       |

### 11.3 Layout and behaviour tests (Playwright, `npm run test:layout`)

Extend `tools/tests/`:

- **Contrast:** every pair in 5.3, both themes (`ui-lab.spec.mjs`).
- **Sizes:** at 1280×720, the rail does not scroll in Play and the attack dialog footer is visible.
- **Tab walk:** from the first rail field through the tabs into the Play panel; through the attack dialog and back; across chat card buttons.
- **Card states:** each state in 7.5 renders one primary and the right state word.
- **Undo:** apply damage, undo; actor matches the before-image, including a standard NPC's damage track.
- **Reload:** a pending player request is still answerable after the GC reloads.
- **GC confirmations:** logged in as GC, no dialog shows an unticked GC-confirm box.
- **Palette:** the token status palette lists only Spycraft conditions, with text labels.

### 11.4 Acceptance scripts

Run before a release that touches sheets, cards or the console. Each failing step is a guide violation, not a feature request.

**Newcomer's first turn** (pregen, 1366×768, both themes, mouse-only then keyboard-only): open the sheet and read health, Defense and best attack within 10 seconds with nothing editable by accident; on the turn toast, see half actions left and the "Your turn" strip; target with T and attack with target and range pre-filled; get one primary "Resolve vs Defense 13", then HIT with ✓ and the total after dice, then "Roll damage", then "Apply 6 to Mercenary"; spend a die from one button that names the real dice; find Boost Defense disabled mid-round with the reason; when attacked, see "Mercenary → Vector (you)" and Defense in one line; end the turn from the sheet or the tracker.

**GC's NPC turn** (1366×768, console open): a miss in ≤ 4 actions and a hit through applied damage in ≤ 6, without switching sidebar tabs or opening a sheet.

**Cold start** (new GC, new world): from an empty world to an NPC attack applied to a PC using only on-screen guidance, in 15 minutes or less.
