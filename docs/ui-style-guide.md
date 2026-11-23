# UI style guide

This guide sets how the Spycraft 2.0 system looks, reads and behaves in Foundry VTT v14. It covers sheets, dialogs, chat cards, the combat tracker, the GC Console, the NPC builder, the compendium browser and settings. It applies to **new work and to existing features**: section 10 lists where the current tree (main at `c2abca8`) diverges, with a suggested fix for each.

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
  - the audit in section 10 is worked through as its own PRs, P0 first.
- When the guide and the rulebook disagree, the rulebook wins and the guide is wrong. Open a PR against this file.
- When the guide and a GC's ruling disagree at the table, the GC wins. The system must make that ruling possible (section 8).

### 1.3 Changing the guide

Propose a change as a PR that edits this file and nothing else, or that edits this file together with the code that motivates it. State:

- the rule being added, changed or dropped;
- the surfaces it affects and whether existing features then diverge (add them to section 10);
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

The agent and NPC sheets already have the switch (`.play-mode` / `.edit-mode`, `styles/retro.css:145-146`). The GC Console needs one (7.7). An unfinished agent reopens in Edit; a pregenerated or sample agent opens in Play with no setup reminders.

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

Use one helper for each: `signed()` (exists), and a `formatRange(kind, bound)` for threat and error ranges, used by the skill table, weapon rows, item sheets and cards.

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
- Use `data-tooltip` only. Never author `title` (the runtime strips it in `module/apps/ui-tooltips.mjs:435-446`, but templates should not rely on that).
- Glossary terms get a visible `fa-circle-question` icon after the caption the first time they appear on a surface (the rail pattern, `templates/actor/agent-rail.hbs:31,34,48`). Put the `?` on the caption, not on a button.
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

- **13px is the minimum for any text that carries information.** 12px is allowed only for decorative labels whose words are not needed to play (the dossier band label). There are 17 rules at 12px today (section 10.10).
- Faces: `--font-primary` (Foundry's Signika) for text; `--sc2-num` (system monospace) for values, dice and stamps; `--sc2-bar-font` only for the dossier band.
- Prefer token sizes to `em` sizes. Do not add a new pixel size without adding a token.
- No letter-spaced upper case for buttons or headings; dialog footer buttons (`components.css:241`) are the exception to remove.

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
| Untrained           | `.sc2-untrained`: "untrained" word or ⚠ icon, tooltip, aria text |
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
- Status icons on tokens are Spycraft conditions only (6.7, 10.6).

### 5.8 Motion

Motion is limited to colour transitions of 120ms or less, inside `@media (prefers-reduced-motion: no-preference)` (`components.css:221-223`). No animated entrances, no spinners for actions under a second (disable the button and show "Working…", as `chat-action-feedback.mjs` does). The console's disclosure arrow rotation (`gc-console.css:9`) must move inside the same media query.

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

Every derived value has a breakdown tooltip that sums to the value. The `context.tips` pattern in `module/sheets/actor-sheet.mjs` is the model; extend it to weapon rows, skill error range and NPC graded values.

### 6.3 Tabs and the rail

- Tabs are captions with the active one filled `--sc2-bar` (`components.css:194-204`). Sentence case. The tablist is one Tab stop; arrow keys move between tabs; Tab moves into the panel.
- The agent rail is visible on every tab and holds the glance tier (7.1). It never scrolls in Play at 1280×720.

### 6.4 Lists and rows

A row reads: name (opens the item) → facts → actions, with repeated verbs as icon buttons at the far end (`components.css:94-98`). Rows are at least 36px tall. Edit and delete icons are `edit-only`.

### 6.5 Limited-use counters

One partial for every limited use, everywhere:

`[2/3] Name · per session [Use]`

- The count chip (`.sc2-uses`) comes first; it turns `spent` at 0.
- The Use button is disabled at 0, with a tooltip saying when uses return.
- On Play, all limited uses are listed once, under "Abilities in play", grouped Combat / Social / Gear / Other.
- Activations are declared in item data and rendered generically; templates do not branch on item names.

### 6.6 Tracks and meters

Vitality and wounds are meters (`.sc2-meter`) with current/max. Damage saves, vehicle condition and similar counts are box tracks (`.sc2-track`, `sheet-npc.css:29-34`) with threshold boxes marked. Each meter states the band it is in with a word ("Unconscious", "Dying") once a band applies.

### 6.7 Stamps and chips

- A **stamp** (`.sc2-stamp`) is a status that must not be missed: a condition, HIT, MISS, THREAT, ERROR. Upper case, monospace, 13px, `currentColor` border. Every stamp has a tooltip with its glossary sentence and current effect.
- A **chip** (`.sc2-chip`) is a passive fact: Career Level, NPC kind, TL, "Cover: Mara".
- Condition stamps use the Spycraft name and grade (Shaken II).

### 6.8 Forms and inputs

- In Play, glance values are read-only text. Correction is through a pencil (`Adjust…`) that opens a small dialog with the old value, the new value and an optional reason.
- **Exception:** current vitality and wounds stay as inputs on agent and special-NPC sheets, because GCs call damage aloud and players type it. They must not change on mouse wheel.
- Labels sit above or beside their control and are real `<label>`s. Table inputs carry the row name in their accessible label ("Stealth misc").
- Checkboxes have labels of eight words or fewer; the full condition goes in a hint below (`briefOption`, `module/apps/dialog-sections.mjs`).
- A field that only applies to one choice is hidden when another choice is selected. A label ending "(X only)" means hiding is missing.
- Every free-text builder field has an example placeholder. Every budget shows "N left" beside the field that spends it.

### 6.9 Disclosures

Use `<details>`/`<summary>` with a plain-text summary (no headings or controls inside a summary). Summaries are at least 44px tall (`components.css:287`). The summary names the content and, when closed, shows a count or status ("Combat tools · 3 pinned"). Disclosures remember their state per sheet (`data-key`).

### 6.10 Empty states

An empty list says what goes there and offers the one button that fills it: "No objectives. Add one to set the mission's XP. [Add objective]". Never just "None yet." Use `.sc2-empty`.

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
4. Defense with a flat-footed figure ("16 · FF 12") and DR; Initiative; Speed; the three saves.
5. Action dice: count (read-only), die type, pips; the one common spend (Boost Defense, with its state).
6. A single "Setup: N left" chip if setup is unfinished (opens Edit). The checklist itself is Edit only.

**Play tab (act tier):** round tracker with half-action pips → a "Your turn" strip (Attack with the readied weapon, Skill…, Total Defense, End turn) → attributes → weapons → trained and pinned skills → abilities in play (6.5) → active effects (one chip per running effect with its expiry and an End button) → combat tools (disclosures) → reference (closed).

**Weapon row:** name · "Attack +6 · 19–20" (primary) · damage dice (roll) · range increment or Reach · ammo loaded/capacity · state chips (untrained, not readied). Everything needed to attack without opening the item.

**Skill row:** name · total(s) as roll buttons (one per attribute option) · threat range · error range only when wider than 1.

**Edit mode:** stepper, budgets (one "spent / available" widget, red with reason when over), browsers. "Next setup step" stays at the top of the rail. The stepper, the next-step button and the checklist read from one task list that ends with "Ready to play → Begin play".

### 7.2 NPC sheet (stat block)

The NPC sheet is a stat block for play, not an agent-sized form.

- **Size:** default about 480×640; per-kind minimum width 420px (the shared 640px minimum in `sheet-placement.mjs:11` is for agents).
- **Header chips:** TL · NPC kind and role · Defense · Initiative · health (V/W for special NPCs; "Save +4 · next DC 14 · ✗✗□" for standard NPCs) · condition stamps.
- **Only the track the NPC uses:** a standard NPC shows its Damage-save track and no vitality/wounds; a special NPC shows vitality/wounds and stress/subdual and no Damage-save track.
- **Weapons first**, each row as in 7.1.
- **Glance values read-only in Play.** BAB, saves, Defense and Initiative inputs are Edit only.
- **Rare actions** (takedown, cheap shot, Shaken, Baffled/Incompetent review) live under "More actions"; a review warning appears only when one fires.
- **Edit:** the builder, with a sticky results strip at its top so grade changes show their effect without scrolling.
- Grades are Roman numerals everywhere.

### 7.3 Vehicle and item sheets

- Vehicle: speed, handling, Defense, condition track with broken/destroyed boxes marked (`.sc2-track`). Thresholds are one string with placeholders.
- Items: the play figures in a summary row (`.item-summary`) above the form. Developer fields (JSON prerequisites, formula keys such as `@tb.t1`) are GC-only and behind "Technical detail". Choices a feat needs (an armor type, a skill) are made inline on the character's feat row, not on the item sheet.

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
3. **Situational modifier** (number, default 0) — in every roll dialog, in the quick section.
4. Roll visibility for the GC (public / GC only) on NPC rolls.
5. Named circumstance groups, collapsed, with a "N set" count (`attack-dialog-ux.mjs` is the model).
6. "What the system does for you" disclosure, last and collapsed.
7. Footer: one primary that names the result ("Roll attack: Beretta 92"), and Cancel. Enter submits; Esc cancels.

- Dropdown options are names; mechanics for the selected option appear as one line under the select.
- Width 560px for ordinary dialogs, 720px for tables (rosters, references). Height capped by `.sc2-dialog .dialog-content` (the screen height less 200px for header, footer and margins); the footer stays visible and the body is the only scrolling box.
- Remember last choices per dialog and offer "Reset" (`module/apps/remembered-choices.mjs`).

### 7.5 Chat cards

**Fixed anatomy:**

1. **Header bar:** who → whom · what ("Latch → Mercenary · Attack (Tonfa)"). One display name per person; "(you)" after the viewer's own character. No paragraphs in the header.
2. **Outcome:** a stamp with word and icon (✓ HIT, ✗ MISS, SUCCESS, FAILURE, PENDING), never colour alone.
3. **The number that matters:** the final total large, the natural die beside it, "16 → 25" when action dice changed it, and the comparison ("vs Defense 14: hit by 3"; "capped at 40" when a cap bit).
4. **Next step:** one sentence saying who acts next, and exactly one primary button for it.
5. **Secondary actions** in one wrapping row at intrinsic width.
6. **Why:** modifiers, ranges, feat notes and page cites in a collapsed "How this was worked out".

**Primary by state:**

| Card state       | Primary                             | Secondary                                        |
| ---------------- | ----------------------------------- | ------------------------------------------------ |
| Pending          | Resolve vs Defense N (with preview) | Spend 1 action die (+1d4) ▾, GC boost, reactions |
| Threat confirmed | Activate critical hit (N dice)      | Resolve, Spend                                   |
| Hit              | Roll damage                         | Resolve again (quiet)                            |
| Damage rolled    | Apply N to {target}                 | Adjust…, Apply to another target…                |
| Damage applied   | —                                   | Undo (GC)                                        |
| Finished         | —                                   | (collapsed to one summary line)                  |

**State words (one set, used by guidance titles, feedback lines and buttons):** Pending → Hit / Miss or Success / Failure → Damage rolled → Damage applied → Finished. Before confirmation say "Threat, if it succeeds" / "Error, if it fails"; after activation say "Critical hit" (attack) or "Critical success" (other checks), and their failure counterparts.

**Rules:**

- The outcome vocabulary switches on `checkKind`: attacks hit/miss and critical hit/miss; everything else success/failure and critical success/failure. No slash forms on a card that knows which applies.
- Two buttons that do nearly the same thing never share a card; the quick spend and the full boost dialog become one button with a ▾ for options.
- Spent controls leave and become a line ("Damage applied: 6 to Mercenary").
- Onlookers see the same card without buttons, and a passive status ("Waiting for the GC to apply 6 to Security Guard").
- A card the system wrote to an actor from keeps an Undo for the GC for as long as the card exists.
- Every system message uses the card skin and one content root (`<div class="spycraft2 chat-note">`).

### 7.6 Combat tracker and turn flow

- Each row shows Initiative Count, half actions left (acting combatant), flat-footed, wound state word, Press/reeling and conditions as text.
- Context menu: Spend half / full action, Give back, **Delay…**, **Ready**, **Readied action triggered**, Fluid initiative event. Delay moves the turn on.
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
- **During a combat, Combat comes first**, directly under the strip. For the acting combatant it shows a mini stat block: Defense, health, conditions, half actions left, one button per weapon ("Attack +5 · 2d6", Shift-click semantics against the T-target), "Apply last damage to target", and Next. Each list row pans to the token and opens the sheet on click.
- **One primary per section and state:** before the fight, "Roll NPC Initiative"; during it, "Next turn".
- Rare tools (Recalculate TL, Clear record, exposure infractions) sit under "More mission tools".
- Every button that changes world state has a tooltip saying what it changes (the `Console.NextSceneHint` style).
- Console search matches labels and hidden synonyms (`data-search-terms`): "npc", "add enemy", "initiative", "turn", "damage", "xp", "dice".
- Each section header has a `?` linking to the matching GC guide section.

### 7.8 NPC builder

Grades and TL at the top, results strip sticky, reference tables behind a disclosure. The two misprinted table cells keep their in-app flag (`module/rules/npcs.mjs:197-203`). "Add NPC to scene" offers "Place N copies" with auto-numbered token names. Prepared NPCs get a token set by kind: standard unlinked, special linked, hostile, bar 1 showing the track the NPC uses.

### 7.9 Compendium browser

Two panes (list, preview). Rows about 36px with name, one-line summary and an Add button; the first row previews by default. Enter adds the focused entry; an option closes the browser after adding. "Qualified only" is on by default while the builder is active. Pack tiles have distinct art and the GC-facing packs (NPC templates, sample agents, Glass Wake) sit at the top.

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
- Focus is shown by one rule: a 3px `--sc2-focus-color` outline, offset 3px (`components.css:284-286`). Do not add other focus styles (`spycraft2.css:225`, the warm icon ring, is one to remove).

**Keybindings** (registered with `game.keybindings.register`, all rebindable, documented in `docs/gc-tools.md`):

| Action                                      | Who |
| ------------------------------------------- | --- |
| Next turn / Previous turn                   | GC  |
| Open or focus the GC Console                | GC  |
| Open the active combatant's sheet           | GC  |
| Press the primary button on the newest card | All |
| GC boost on the newest open NPC card        | GC  |

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

Line references are to `main` at `c2abca8`. Each item was checked against the tree; member claims that did not hold were dropped or corrected (see 10.12). Priorities:

- **P0:** the UI shows a wrong rule or state, or a newcomer loses a resource or misreads the result.
- **P1:** friction or confusion in a common action, or a direct breach of a principle in sections 2–8.
- **P2:** consistency, polish and hygiene.

"Section" is the guide section the item breaks.

### 10.1 Agent sheet

| ID  | Where                                                                                                        | Divergence                                                                                         | Sec.     | P   | Fix                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------- | --- | ----------------------------------------------------------------------------------------------- |
| A1  | `module/sheets/actor-sheet.mjs:1488`                                                                         | Dying band hard-coded to −1…−9; ignores size (`sys.deathThreshold`)                                | 6.6      | P0  | Use `woundState(value, deathThreshold) === "dying"` (`module/rules/damage-application.mjs:122`) |
| A2  | `templates/actor/agent-rail.hbs:55`; `lang/en.json:623`                                                      | "Loose die": invented term; spends an action die in one click, no undo                             | 2.3, 4.2 | P1  | "Roll action die", under "More", with the cost in the tooltip; undo on the card                 |
| A3  | `templates/actor/agent-rail.hbs:50`                                                                          | Action-dice count is an editable input in Play                                                     | 6.8      | P1  | Read-only with an Adjust… pencil                                                                |
| A4  | `templates/actor/agent-rail.hbs:58`                                                                          | Boost Defense always enabled; refused after the click outside round start                          | 8.6      | P1  | Disable with reason outside the window; show its active state                                   |
| A5  | `templates/actor/agent-rail.hbs:53-60`                                                                       | Five equal buttons (Begin play, Loose die, Heal, Refresh, Boost)                                   | 6.1      | P1  | Boost as the one prominent spend; Heal/Refresh under More; Begin play primary when shown        |
| A6  | `templates/actor/agent-rail.hbs:28`                                                                          | Condition stamps have no tooltip or effect                                                         | 6.7      | P1  | Glossary sentence and current effect per stamp                                                  |
| A7  | `templates/actor/agent-rail.hbs:41`; `play/reference-abilities.hbs:44,46`                                    | No flat-footed figure beside Defense; DR only in the closed reference panel                        | 7.1      | P1  | "16 · FF 12", DR beside it                                                                      |
| A8  | `templates/actor/play/dashboard.hbs` (whole)                                                                 | No skills on Play; every skill roll costs a tab switch                                             | 7.1      | P1  | Trained + pinned skills block after weapons                                                     |
| A9  | `templates/actor/play/dashboard.hbs:15-20`                                                                   | Weapon rows lack threat range, range increment/Reach, readied state; untrained is a bare `*` (:17) | 7.1, 5.6 | P1  | Row as in 7.1; `.sc2-untrained` with word and tooltip                                           |
| A10 | `templates/actor/play/combat-attacks.hbs:7-10`; `play/reference-combat.hbs:23`                               | Disarm, Cheap Shot, Counter-Trip, Trip final attack, Improved Fortune shown to every agent         | 2.4      | P1  | Gate on the feat or a prior result, like `combatTools.striking` (:5)                            |
| A11 | `play/dashboard.hbs:24-27`; `agent-classes.hbs:40`; `agent-feats.hbs:14-16`; `play/combat-attacks.hbs:13,19` | Limited uses in four formats; Use button at `dashboard.hbs:26` is a bare `<button>`                | 6.5      | P1  | One `use-counter` partial from one `limitedUses` context                                        |
| A12 | `templates/actor/agent-feats.hbs:24-27`                                                                      | Feat activations keyed by item name in templates and only on Abilities                             | 6.5      | P1  | Declare activations in data; render in "Abilities in play"                                      |
| A13 | `templates/actor/play/dashboard.hbs:28`                                                                      | "Common actions" are numerical advantage, movement check and Total Defense                         | 7.1      | P1  | "Your turn" strip: Attack, Skill…, Total Defense, End turn                                      |
| A14 | `templates/actor/play/combat-review.hbs:9-11` (GC view)                                                      | Three "Review interrupted…" buttons always shown to the GC, even with nothing to review            | 3.3      | P1  | Render only when a review is pending; otherwise "Nothing needs review"                          |
| A15 | `templates/actor/agent-rail.hbs:63-81`                                                                       | Setup checklist and warnings stay in the rail in Play, pushing action dice down                    | 7.1      | P2  | One "Setup: N left" chip in Play                                                                |
| A16 | `templates/actor/agent-skills.hbs:16,18,30`                                                                  | Headers "GC override" and "Cap" unexplained; threat printed "18-20" with a hyphen                  | 4.4, 4.7 | P2  | "Class skill (manual)", explained "Cap"; `formatRange()`                                        |
| A17 | `templates/actor/agent-gear.hbs:8,10,14`                                                                     | Two attack buttons (Attack, Measured attack); untrained styled `bad`; Error/Threat as bare bounds  | 2.5, 5.6 | P2  | One attack control; `.sc2-untrained`; ranges                                                    |
| A18 | `templates/actor/agent-gear.hbs:69-116`                                                                      | Gear picks, Caliber and gear check buried in a closed panel below inventory                        | 7.1      | P2  | "Mission loadout" panel at the top of Gear                                                      |
| A19 | `templates/actor/play/reference-combat.hbs:19-20`                                                            | Request and Gear check are values, not rolls (Knowledge beside them rolls)                         | 2.8      | P2  | Make them roll tiles                                                                            |
| A20 | `templates/actor/agent-main.hbs:2`                                                                           | Banner built from `{{name}}` + ": Initiative Count" fragment                                       | 4.5      | P2  | One string with `{name}`, `{count}`                                                             |
| A21 | `templates/actor/agent-main.hbs:44`                                                                          | Misc modifier labels are raw schema keys (`{{k}}`)                                                 | 4.1      | P2  | Localised labels                                                                                |
| A22 | `templates/actor/play/combat-defense.hbs:4-9`; `dashboard.hbs:28`                                            | Running effects (Fight Defensively, Total Defense…) shown as prose after their buttons             | 7.1      | P2  | One "Active effects" strip with expiry and End                                                  |
| A23 | `templates/actor/play/identities.hbs`                                                                        | Cover identity only mid-page; not on rail or cards                                                 | 7.1, 7.5 | P2  | Rail chip "Cover: name [Leave]"; identity in card headers                                       |
| A24 | `templates/actor/agent-rail.hbs:41,43` vs `:42,44`                                                           | Rolling and non-rolling tiles differ only by a lower edge                                          | 5.6      | P2  | Add hover tint + "click to roll" tooltip; make Defense open Check Defense                       |

### 10.2 NPC sheet and builder

| ID  | Where                                                                        | Divergence                                                                                     | Sec.     | P   | Fix                                                      |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- | --- | -------------------------------------------------------- |
| N1  | `templates/actor/npc-sheet.hbs:15-18`                                        | Manual (non-graded) standard NPCs show vitality/wounds inputs                                  | 7.2      | P0  | Wrap in `{{#if gcPlay.special}}`                         |
| N2  | `module/sheets/actor-sheet.mjs:2064`                                         | NPC dying band hard-coded, as A1                                                               | 6.6      | P0  | As A1                                                    |
| N3  | `templates/actor/npc-sheet.hbs:59-63`                                        | BAB, saves, Defense, Initiative are inputs in Play (manual NPCs)                               | 6.8      | P1  | Values in Play; inputs `edit-only`                       |
| N4  | `templates/actor/npc-sheet.hbs:9`                                            | Header shows only TL and kind; no Defense, health or conditions; no condition stamps anywhere  | 7.2      | P1  | Header chips as 7.2; reuse rail stamps                   |
| N5  | `templates/actor/npc-sheet.hbs:44-45`; `lang/en.json:1171-1174`              | Damage-save state is a sentence glued from fragments; "Suffer damage" unclear; Reset beside it | 4.5, 6.6 | P1  | Box track; "Roll Damage save" primary; Reset in Edit     |
| N6  | `module/sheets/actor-sheet.mjs:1883`; `module/sheets/sheet-placement.mjs:11` | NPC opens at 800×800; 640px minimum shared with agents                                         | 7.2      | P1  | ~480×640 default; per-kind minimum                       |
| N7  | `templates/actor/npc-graded-play.hbs:15`                                     | Apply/Review Baffled and Incompetent always visible on graded NPCs                             | 3.3      | P1  | Under More actions; review only when the condition is on |
| N8  | `module/apps/gc/npc-play.mjs:169`                                            | NPC skill flavor shows bonus and result cap publicly                                           | 8.4      | P1  | Omit for players unless a setting allows                 |
| N9  | `templates/actor/npc-sheet.hbs:83-84`                                        | Item delete buttons shown in Play (weapons' are `edit-only`, :25)                              | 2.3      | P2  | Make `edit-only`                                         |
| N10 | `templates/actor/npc-sheet.hbs:24`                                           | Weapon rows lack threat range and range, as A9                                                 | 7.1      | P2  | Shared weapon-row partial                                |
| N11 | `templates/actor/npc-sheet.hbs:68`                                           | Builder below the stat block; results not visible while editing grades                         | 7.8      | P2  | Sticky results strip                                     |
| N12 | `templates/actor/npc-sheet.hbs:13`                                           | Authored `title` attribute                                                                     | 4.7      | P2  | `data-tooltip`                                           |
| N13 | `templates/actor/npc-sheet.hbs:30-32`                                        | Bare buttons without a role class                                                              | 6.1      | P2  | `sc2-action`                                             |
| N14 | `spycraft2.mjs:222-226`                                                      | NPC token bars offer vitality/wounds only; a standard NPC's damage track has no bar            | 7.8      | P2  | Expose the Damage-save track as a bar attribute          |

### 10.3 Vehicle sheet, item sheets and browser

| ID  | Where                                                                                                     | Divergence                                                       | Sec. | P   | Fix                               |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---- | --- | --------------------------------- |
| I1  | `templates/item/item-feat.hbs:13,19-20`                                                                   | `prereqJSON` textarea and GC prerequisite box shown to any owner | 7.3  | P1  | GC-only, under "Technical detail" |
| I2  | `templates/actor/vehicle-sheet.hbs:26`; `lang/en.json:1196-1197`                                          | Broken/destroyed thresholds glued from fragments                 | 4.5  | P2  | One string with placeholders      |
| I3  | `lang/en.json:1212`                                                                                       | "Tyre" (UK) in US text                                           | 4.1  | P2  | "Tire"                            |
| I4  | `templates/item/item-header.hbs:3`, `templates/apps/browser.hbs:3`, `templates/actor/vehicle-sheet.hbs:3` | Agency seal `<img>` loaded then hidden (`components.css:214`)    | 5    | P2  | Remove the image or show it       |
| I5  | `module/apps/browser.mjs:116`                                                                             | "Qualified only" off by default in the builder                   | 7.9  | P2  | On while the builder is active    |
| I6  | `styles/sheet-item.css` browser rows                                                                      | Rows about 61px; preview empty until a pick                      | 7.9  | P2  | ~36px rows; preview first row     |

### 10.4 Roll and option dialogs

| ID  | Where                                                                                            | Divergence                                                                                               | Sec.     | P   | Fix                                                                     |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------- | --- | ----------------------------------------------------------------------- |
| D1  | `module/rolls/dialogs/attack.mjs:29-61`                                                          | No situational modifier on attacks                                                                       | 7.4      | P1  | Field in the quick section (`attack-dialog-ux.mjs` keep list)           |
| D2  | `module/documents/actor/rolls.mjs:497-521`, `:529-551`                                           | Attribute checks never open a dialog; saves open one only for Reflex or certain feats                    | 7.4      | P1  | Minimal dialog (modifier, visibility) for both; same gestures           |
| D3  | `module/sheets/actor-sheet.mjs:1731-1736`                                                        | Damage and Initiative ignore Shift                                                                       | 7.4      | P1  | Apply the gesture table                                                 |
| D4  | `module/apps/dialog-theme.mjs:25`                                                                | Confirmation boxes pre-ticked only by _Trust the table_, never because the user is the GC                | 8.2      | P1  | Also pre-tick when `game.user.isGM`, with its own note                  |
| D5  | `module/rolls/dialogs/attack.mjs:42` (and 159 `…Confirmed` names in 74 files)                    | Attestation-length checkbox labels; `briefOption` covers only listed fields                              | 6.8, 8.2 | P1  | Effect labels ("Flanking +2"), detail as hint; `briefOption` by default |
| D6  | `module/documents/actor/outcomes.mjs:698-710`                                                    | Critical activation: slash labels ("critical success / hit"), attestation boxes, typo "−1cost, minimum0" | 4.4, 8.2 | P1  | One label by `checkKind`; infer opponent and line of sight; fix spacing |
| D7  | `module/documents/actor/skill-rolls.mjs:179`                                                     | Skill options carry mechanics ("Climb (STR, Standard, error 1–1)")                                       | 7.4      | P1  | Names only; selected option's details under the select                  |
| D8  | `module/apps/resolution-guide.mjs:38,61` via `attack-dialog-ux.mjs:88`, `skill-dialog-ux.mjs:96` | "Automatic vs table / GC steps" prepended to dialogs                                                     | 7.4      | P2  | Append; rename "What the system does for you"                           |
| D9  | `module/apps/remembered-choices.mjs:93`                                                          | Shift-click documented only in a setting hint                                                            | 4.7      | P2  | Tooltip suffix on roll controls; one-time hint                          |
| D10 | `module/apps/gc/combat.mjs:242-250`, `:577-593`                                                  | Fluid-event and combat-reference dialogs show every field for every choice                               | 6.8      | P2  | Show fields for the chosen event or lookup only                         |
| D11 | `module/apps/rules-refresh.mjs:67`                                                               | Raw field paths and JSON shown to the GC                                                                 | 4.3      | P2  | Field labels from `ui-tooltips.mjs`; JSON under "Technical detail"      |
| D12 | NPC attack and save dialogs (`module/apps/gc/npc-play.mjs:177` has `secret` for skills only)     | No per-roll "GC only" toggle on NPC attacks and saves                                                    | 8.4      | P2  | Add with a remembered default                                           |
| D13 | `styles/components.css:241`                                                                      | Dialog footer buttons upper case and letter-spaced                                                       | 5.4      | P2  | Sentence case                                                           |

### 10.5 Chat cards

| ID  | Where                                                                                      | Divergence                                                                                                      | Sec.     | P   | Fix                                                                      |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------- | --- | ------------------------------------------------------------------------ |
| C1  | `module/rules/outcomes.mjs:111,118`; `module/rolls/chat-guidance.mjs:24-27`                | Attack cards say "Critical success/failure"                                                                     | 4.2, 7.5 | P0  | Shared `outcomeLabel(check)` switching on `checkKind`                    |
| C2  | `module/rules/outcomes.mjs:88`; `lang/en.json:187`                                         | Ranges printed as bare bounds ("Error 2; threat 19.")                                                           | 4.4      | P0  | `formatRange()`; move into the Why section                               |
| C3  | `module/rules/outcomes.mjs:117,121`; `lang/en.json:184-185`                                | "Potential error; confirm the result." in error styling reads as a software fault; "Threat!"/"Error!" elsewhere | 4.2, 7.5 | P1  | "Error, if it fails" / "Threat, if it succeeds" with glossary `?`        |
| C4  | `module/rolls/chat-controls.mjs:146`                                                       | One "Activate critical" label for threats and errors; no cost shown                                             | 7.5      | P1  | "Activate critical hit (N dice)"; error variant shows who pays           |
| C5  | `module/rolls/chat-controls.mjs:152-166`                                                   | "Spend 1 action die (+1dN)" and "Boost before outcome" side by side                                             | 2.5      | P1  | One button with ▾ for options                                            |
| C6  | `styles/chat.css:17-18`                                                                    | Every card button full width; a five-button card is five rows                                                   | 7.5      | P1  | Primary full width; secondaries in a wrapping row                        |
| C7  | `module/rolls/chat-guidance.mjs:18,36-50`; `lang/en.json:335-336`                          | State words overlap: "Outcome closed", "Outcome resolved", "Confirm result", "Damage finalized"                 | 7.5      | P1  | One state set                                                            |
| C8  | `module/apps/chat-action-feedback.mjs:25`                                                  | "Action finished" after any button (even with damage unapplied); "Not done: see the warning."                   | 4.6      | P1  | Name the next step; show the refusal text inline (`refuse()` returns it) |
| C9  | `styles/chat.css:24`; `module/rules/outcomes.mjs:206`                                      | Result guide looks the same for hit and miss; total after dice only in flavor                                   | 7.5, 9.3 | P1  | Outcome class with icon; "16 → 25" in the header                         |
| C10 | `module/apps/damage-application.mjs:692,971,1033,1125`; `module/apps/gc/npc-card-dice.mjs` | No undo for applied damage or GC boosts                                                                         | 8.3      | P1  | Before-image on the card; Undo as the only remaining control             |
| C11 | `module/apps/gc-relay.mjs:71,115,153`                                                      | Pending requests held in memory (lost on reload); 120 s auto-decline                                            | 8.5      | P1  | Persist on the message; timeout as a world setting; notify on lapse      |
| C12 | `styles/chat.css:7`; `module/documents/actor/attack-rolls.mjs:825`                         | Header flavor carries up to ~15 rule notes                                                                      | 7.5      | P1  | Header who/whom/what; notes in the Why disclosure                        |
| C13 | `styles/chat.css:12`                                                                       | Outcome stamps at 12px                                                                                          | 5.4      | P2  | 13px                                                                     |
| C14 | `styles/chat.css:22` vs `:45`                                                              | Two conflicting rules for `.sc2-quiet-action`                                                                   | 5        | P2  | Keep one                                                                 |
| C15 | `module/rolls/chat-guidance.mjs:61`; `styles/chat.css:25`                                  | Guide title is an orphan `h4`                                                                                   | 9.4      | P2  | `h3` or a styled `<p>`                                                   |
| C16 | `module/apps/resolution-guide.mjs` on cards (`chat-guidance.mjs:66`)                       | "Automatic vs table / GC steps" on every card guide                                                             | 3.3      | P2  | Client setting to hide after first open                                  |

### 10.6 Combat tracker and token HUD

| ID  | Where                                      | Divergence                                                                                 | Sec. | P   | Fix                                                                  |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------ | ---- | --- | -------------------------------------------------------------------- |
| T1  | `spycraft2.mjs:139-144`, `:85-99`          | System conditions appended to core's list (66 entries); ids `blind`/`sleep` vs sheet names | 5.7  | P1  | Replace `CONFIG.statusEffects`; keep ids the code reads; text labels |
| T2  | `module/apps/gc/combat.mjs:546-567`        | Context menu lacks Delay…, Ready, Readied action triggered                                 | 7.6  | P1  | Add one-step entries that move the turn                              |
| T3  | `module/` (no `game.keybindings.register`) | No keybindings                                                                             | 9.1  | P1  | Register the 9.1 set                                                 |
| T4  | `module/apps/gc/combat.mjs:541`            | "(N half action(s) left)"; only the active row gets state                                  | 7.6  | P2  | Proper plural; add flat-footed and wound state to rows               |

### 10.7 GC Console

| ID  | Where                                                                    | Divergence                                                                         | Sec. | P   | Fix                                                     |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---- | --- | ------------------------------------------------------- |
| G1  | `templates/apps/gc-console.hbs:63`                                       | Combat is the seventh section; state-driven opening does not move it               | 7.7  | P1  | Combat first while a combat exists; Prep/Play switch    |
| G2  | `templates/apps/gc-console.hbs:67`; `module/apps/gc/console.mjs:296-315` | Combat list is name, Count and pending only; rows do nothing on click              | 7.7  | P1  | Half actions, Defense, health, conditions; pan and open |
| G3  | `templates/apps/gc-console.hbs:66,68`                                    | Two primaries in Combat (Next turn, Roll NPC Initiative)                           | 6.1  | P1  | One primary by state                                    |
| G4  | `templates/apps/gc-console.hbs:18,27,59`; `lang/en.json:1293-1296`       | Mission, XP and pool lines glued from fragments                                    | 4.5  | P1  | Label/value grid with `?` captions                      |
| G5  | `templates/apps/gc-console.hbs:20-29`                                    | Eleven equal buttons in Mission, rare ones included                                | 3.3  | P1  | "More mission tools" disclosure                         |
| G6  | `templates/apps/gc-console.hbs:3`                                        | Status strip repeats the clock; no pending count or team dice                      | 7.7  | P2  | Replace Time with Pending N; team row                   |
| G7  | `templates/apps/gc-console.hbs:36,42,50-54`; `lang/en.json:1310-1320`    | Lower-case verbs after an em dash read as status ("complete", "faced as a threat") | 6.1  | P2  | "Mark complete", "Mark faced", "Remove"                 |
| G8  | `lang/en.json:1314` ("None yet.")                                        | Empty states without a next step                                                   | 6.10 | P2  | What goes here + the Add button                         |
| G9  | `templates/apps/gc-console.hbs` (most buttons)                           | Only Begin session, Next scene and Record for XP have tooltips                     | 7.7  | P2  | One-line "what this changes" tooltip                    |
| G10 | `styles/gc-console.css:70,81`, `:22`                                     | Section title declared twice, 12px upper case; tags 12px                           | 5.4  | P2  | One rule at 13px sentence case                          |
| G11 | `styles/gc-console.css:9-10`                                             | Disclosure arrow transition not guarded by reduced motion                          | 5.8  | P2  | Move into the media query                               |
| G12 | `templates/apps/gc-console.hbs:79`                                       | Authored `title` attribute                                                         | 4.7  | P2  | `data-tooltip`                                          |

### 10.8 Strings (`lang/en.json` and `loc` sources)

Counts are over the 10,332 string values in `lang/en.json`.

| ID  | Where                                                                                                           | Divergence                                                                        | Sec. | P   | Fix                                                         |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---- | --- | ----------------------------------------------------------- |
| L1  | `lang/en.json:4824, 7454, 7764, 9214`                                                                           | "next GM launch"                                                                  | 4.2  | P1  | "the next time the GC opens the world"                      |
| L2  | `lang/en.json:904`                                                                                              | "GC refers to your game moderator."                                               | 4.2  | P1  | Delete; rely on the glossary tooltip                        |
| L3  | "GC pool" (14), "GC dice" (7), "GC action dice" (10), "session pool" (2), "Game Control action dice" (`:4844`)  | Five names for one resource                                                       | 4.2  | P1  | "GC action dice", short "GC dice"                           |
| L4  | `module/apps/ui-tooltips.mjs:33-34`; strings "Heal with AD…", "Spend AD", "Starting AD", "current HP" (`:7536`) | d20 abbreviations                                                                 | 4.2  | P1  | Write out                                                   |
| L5  | `lang/en.json:195`                                                                                              | Says agents "get more" dice each session; they reset to the starting number       | 4.6  | P1  | Say they reset, and the GC can award more                   |
| L6  | `lang/en.json:321`                                                                                              | "Threat level" (used in the NPC header)                                           | 4.2  | P2  | "Threat Level"                                              |
| L7  | `lang/en.json:7469` and 6 others                                                                                | "Saving throw" in labels                                                          | 4.2  | P2  | "Save"                                                      |
| L8  | 28 strings, e.g. `lang/en.json:4693-4694`, `:10110`; `module/rules/jinx.mjs:49`                                 | Number glued to word ("by2", "minimum0", "Use0")                                  | 4.4  | P2  | Restore spaces; lint                                        |
| L9  | ~156 strings start or end with a separator or bracket (e.g. `:1293`, `:1371`)                                   | Fragment keys                                                                     | 4.5  | P2  | Whole-sentence keys                                         |
| L10 | "actual" (487), "recorded" (335), "receipt" (111), "RAW" (`:149`), "Health" section (7)                         | Internal vocabulary; a "Health" section that does not exist                       | 4.3  | P2  | Plain words; name the real place                            |
| L11 | 71 strings start "I ", 27 contain "I am"                                                                        | First person in labels                                                            | 4.1  | P2  | "you", or mark as the player's declaration                  |
| L12 | 46 strings over 300 characters, 335 over 160                                                                    | Walls of text in hints                                                            | 4.1  | P2  | One sentence; rest in docs                                  |
| L13 | `lang/en.json:7342`                                                                                             | Developer error shown to users                                                    | 4.3  | P2  | `console.warn` only                                         |
| L14 | `lang/en.json:2925, 2976, 5927, 9553`                                                                           | Refusals without the fix, or in internal language                                 | 4.6  | P2  | What / why / next                                           |
| L15 | `lang/en.json:347, 349`; `module/apps/gc/console.mjs:59`                                                        | "Game Control's client", "Game Control console": expansion used as a running name | 4.2  | P2  | "GC" in body text; expand once in the console title tooltip |

### 10.9 Visual system

| ID  | Where                                                                                                                                                                            | Divergence                                                                           | Sec. | P   | Fix                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- | --- | --------------------------------- |
| S1  | `styles/spycraft2.css:7`, `styles/retro.css:108-113`, `styles/components.css:90`, `:142-147`                                                                                     | Section heading styled four times; first three mostly overridden                     | 5    | P2  | One rule in components.css        |
| S2  | `styles/retro.css:114-123`, `:157-158` vs `styles/components.css:194-204`                                                                                                        | Tabs styled twice; microfilm border-image set then removed                           | 5    | P2  | One rule                          |
| S3  | `styles/retro.css:107`; `styles/components.css:314`                                                                                                                              | Link and text-action hover turns danger red                                          | 5.1  | P2  | Action colour + underline         |
| S4  | `styles/sheet-agent.css:117`                                                                                                                                                     | `#fff` on `--sc2-bad`: 3.35:1 in dark                                                | 5.3  | P2  | `--sc2-on-action`                 |
| S5  | `styles/spycraft2.css:225`                                                                                                                                                       | Second focus style (warm ring) on icon buttons                                       | 9.1  | P2  | Delete; use the shared rule       |
| S6  | `styles/spycraft2.css:3`, `:199`; `styles/chat-search.css:23`                                                                                                                    | Literal colours and stale fallbacks outside tokens                                   | 5.1  | P2  | Tokens (`--sc2-warn` for hazards) |
| S7  | 17 rules at 12px (`chat-search.css:26-45`, `components.css:183,215`, `gc-console.css:22,35,70,81`, `npc-builder.css:6,22`, `retro.css:44,54,152`, `sheet-agent.css:118,122,133`) | Below the 13px floor                                                                 | 5.4  | P2  | `--sc2-text-s`                    |
| S8  | `styles/tokens.css:104` (dark `--sc2-danger`)                                                                                                                                    | 4.48:1 on `raised`                                                                   | 5.3  | P2  | Lighten slightly; add to ui-lab   |
| S9  | `styles/retro.css:154-156` vs `styles/sheet-agent.css:17`                                                                                                                        | Agent name rules disagree (nowrap 20px vs wrap 17px); retro.css header comment stale | 5    | P2  | One rule; update comment          |
| S10 | `tools/tests/ui-lab.spec.mjs:45-70`                                                                                                                                              | Contrast test omits good, warn, danger-on-raised and borders                         | 5.3  | P2  | Cover every row of 5.3            |

### 10.10 Docs

| ID  | Where                                      | Divergence                                                                   | P   | Fix                                                         |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------- | --- | ----------------------------------------------------------- |
| O1  | `docs/gc-tools.md`                         | No keyboard section; no "running a combat turn" walkthrough; reference-first | P2  | Add both; link from the console `?`                         |
| O2  | `docs/` (none)                             | No first-session path for a new GC                                           | P1  | `docs/gc-quickstart.md` and a dismissible console checklist |
| O3  | `docs/npc-creation.md`, `docs/gc-tools.md` | GC and maintainer content mixed                                              | P2  | Split into GC and maintainer pages                          |

### 10.11 Counts and what to keep

**Totals:** 5 P0, 52 P1, 63 P2 (120 items).

**Keep — already compliant, do not regress:**

- The rail plus creation track with "Next setup step" at the top (`agent-rail.hbs:22-26`); the inline vitality die on level-up.
- The `?` captions on vitality, wounds and action dice (`agent-rail.hbs:31,34,48`).
- The attack dialog's quick/advanced split with a "N set" counter, `briefOption`, and remembered choices with Reset.
- One-click Resolve with a hit/miss preview; NPC quick resolve against the T-target; the cover selector in Resolve (`damage-application.mjs:208`).
- GC boost and GC activate threat on NPC cards, paid from the GC dice.
- Reach: block the player, ask the GC — the model for 8.3.
- "Begin combat" warning with "Roll for NPCs and remind players" as the default (`module/apps/gc/combat.mjs:96-102`) — the model for 4.6 and 6.1.
- _Trust the table_ marking what it ticked (`dialog-theme.mjs:41-57`).
- GC-only reference results whispered; the player's secret-check note.
- Console sections that open by game state; Add NPC to scene with Record for XP separated and explained.
- Token-based theming with chat following the interface theme, tested in `chat-theme.spec.mjs`; container queries; `forced-colors` and `prefers-contrast` hooks; 44px icon targets; one strong focus ring.
- Templates author real buttons (no `<a data-action>` left).

### 10.12 Member claims dropped or corrected

- **No token bars declared** — wrong. `CONFIG.Actor.trackableAttributes` is set at `spycraft2.mjs:222-226`; the real gap is the standard NPC's damage track (N14).
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

These do not need the rulebook, so they can run in CI beside `npm test`. Each can start as a warning and become an error once the matching audit items are done.

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
