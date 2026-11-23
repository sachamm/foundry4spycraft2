# Function icons

Generated with the built-in image generator. Seven 8×8 brass-and-ivory function atlases plus a 4×4 clock atlas retain transparent backgrounds. `catalog.json` maps 362 functions and variants to individual cells; unused generated cells are reserved for future functions.

The clock atlas contains six adjacent plus/minus pairs: round stopwatch, minute hourglass, ten-minute double hourglass, hour clock, eight-hour moon clock, day calendar. Its final row contains custom advance, set date, open clock, and start timer.

`module/apps/ui-button-catalog.mjs` is the runtime lookup, matching `catalog.json`. Data attributes distinguish clock increments, planned/earned XP, shared/group initiative and entry operations. Unknown actions retain their existing presentation until dedicated artwork is registered. Tabs, stat blocks and window headers keep their readable presentation.

Action tooltips use compact labels rather than explanatory boilerplate. Full accessible names remain on controls. Authored HTML rule breakdowns remain intact. The chat atlas received a background-extraction pass to remove a baked checkerboard while preserving icon placement.

## Role in the interface

Common verbs (edit, remove, share, reload, add and the like) now use the single-colour Font Awesome glyphs that ship
with Foundry, mapped in `module/apps/ui-verb-icons.mjs`. The painted atlases here are illustrations: a control shows
one only when it sits inside a region marked `data-sc2-art`, or when an icon-only control has no glyph of its own.

The atlases are stored as 512×512 WebP (64px cells in the 8×8 sheets), about three times the largest size an
icon is drawn at.
