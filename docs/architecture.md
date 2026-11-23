# Architecture

A short map of the code for someone about to change it. The README's Layout table says what each folder holds;
this page says how the folders depend on each other and where a new ability goes.

## Layers

From the bottom up. A layer may import from the layers below it.

| Layer | Folder | What belongs here | May not |
| --- | --- | --- | --- |
| Rules | `module/rules/` | Pure functions over plain data: the engine, plans for each ability, generated tables | Import from any other layer, open a dialog, post chat, show a notice |
| Data | `module/data/` | Data models and the shapes of stored records | Import apps or sheets |
| Services | `module/services/` | Machinery with no interface: resource transactions and locks, usage periods, GC dice, chat lookups, sheet refresh | Import documents or sheets |
| Documents | `module/documents/` | The Actor and Item classes; Actor methods are split by workflow in `actor/` | Import sheets |
| Rolls | `module/rolls/` | The roll pipeline's contributor index, chat buttons and dialog layouts | Import sheets |
| Apps | `module/apps/` | One file per ability or action (dialog, chat buttons, the steps that spend and record a use), the GC Console, browser, clock | |
| Sheets | `module/sheets/` | ApplicationV2 sheets and their helpers | |

Some imports still point upward (documents and rolls into apps). `tools/test-module-graph.mjs` counts them per pair
of layers and fails if a count grows, so the direction can only improve. Lower a limit there when you remove one.

## How an agent's numbers are derived

`computeAgent` in `module/rules/engine.mjs` runs fifteen steps in order over one `state` object. Each step function
starts by naming what it reads from earlier steps and ends by handing on what later steps need. Feat prerequisites
can depend on derived numbers, so the last step runs the whole pass again until the set of qualifying feats settles.

`tools/test-engine-golden.mjs` fingerprints every derived property of the sample agents. Run it before and after a
change to the engine: a refactor must leave it green, and a rules change should move only the properties you meant
to move. Rewrite the fingerprints with `UPDATE_GOLDEN=1 node --test tools/test-engine-golden.mjs`.

## Adding an ability or action

1. **Rules.** Put the plan (what it costs, when it applies, what it changes) in a module under `module/rules/`,
   with a test. No Foundry calls here.
2. **Workflow.** Add `module/apps/<ability>.mjs` for the dialog, the chat card and the steps that spend the use.
   - A limited-use ability goes through `useLimitedAbility`. Inside its callback, stop a step with `refuseStep()`
     or `decline()` (both return `null`, which hands the use back). Never `return ui.notifications.warn(...)`;
     lint rejects it.
   - An option dialog is a `formDialog({ title, intro, fields })` from `module/apps/dialog-kit.mjs`.
   - A final attack with a per-round or per-combat counter can use `limitedFinalAttack` in
     `module/apps/final-attack.mjs`.
   - Changes to counters, dice or damage run inside a resource transaction (`module/services/transactions.mjs`).
3. **Roll pipeline.** If the ability adds a term to a roll, register a contributor and import the module from
   `module/rolls/index.mjs`, which is the one list of feature modules.
4. **Sheet action.** Add the action name to the right list in `module/sheets/actor-sheet.mjs`: `actorMethods(...)`
   for a method on the Actor, `actorWorkflows({...})` for a function that takes the actor.
5. **Button.** Add the `<button data-action="…">` to the template. `tools/test-templates.mjs` fails if a template
   button has no registered action. A feat's button on the Feats tab comes from the table in
   `module/sheets/feat-actions.mjs`, keyed by the feat's rule name.
6. **Text.** User-visible text in JavaScript uses the `loc` tag; run `npm run strings` afterwards. Follow
   `docs/ui-style-guide.md` for wording and layout, and `AGENTS.md` for what may not be copied from the rulebook.

## Rules of thumb

- Decide behaviour from ids and rule names (`ruleName(item)`, `check.id`), never from a displayed name: display
  names are translated in place when a language loads.
- Read a setting that may not be registered yet with `readSetting(key, fallback)` from `module/settings.mjs`, and
  pass the setting's registered default as the fallback.
- After a world-wide change, reset every affected actor and redraw with `renderOpenSheet(actor)`; skip the redraw of
  a closed sheet, never the reset.
- Rich text written by users is wrapped in `.sc2-prose` so the sheet's heading and table styles do not apply to it.
- Layout tests load the stylesheets with `systemCss()` from `tools/lib/system-css.mjs`, the same set and order a
  world loads.
