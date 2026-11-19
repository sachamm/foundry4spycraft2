# Function icons

Generated with the built-in image generator. Seven 8×8 brass-and-ivory function atlases plus a 4×4 clock atlas retain transparent backgrounds. `catalog.json` maps 362 functions and variants to individual cells; unused generated cells are reserved for future functions.

The clock atlas contains six adjacent plus/minus pairs: round stopwatch, minute hourglass, ten-minute double hourglass, hour clock, eight-hour moon clock, day calendar. Its final row contains custom advance, set date, open clock, and start timer.

`module/apps/ui-button-catalog.mjs` is the runtime lookup, matching `catalog.json`. Data attributes distinguish clock increments, planned/earned XP, shared/group initiative and entry operations. Unknown actions retain their existing presentation until dedicated artwork is registered. Tabs, stat blocks and window headers keep their readable presentation.

Action tooltips use compact labels rather than explanatory boilerplate. Full accessible names remain on controls. Authored HTML rule breakdowns remain intact. The chat atlas received a background-extraction pass to remove a baked checkerboard while preserving icon placement.
