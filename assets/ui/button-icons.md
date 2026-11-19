# Button icon atlas

Generated with the built-in image generator. The PNG is a transparent 4 × 4 atlas consumed directly by CSS; no runtime image service is required.

Row order: add, edit, remove, confirm; roll, attack, damage, defense; browse, refresh, mission, heal; chat, continue, settings, cancel.

Action mapping and icon enhancement live in `module/apps/ui-tooltips.mjs`. Existing names, tooltips, event handlers, disabled state and pressed state remain on the original controls. Stat displays, tabs and Foundry window header controls retain their existing presentation.

## Generation prompt

Use case: stylized-concept. Asset type: single UI sprite atlas for a retro espionage tabletop application. Create a precise square 4 by 4 grid sprite sheet, sixteen equally sized cells, transparent background, no grid lines, no text, no numbers. Every symbol centered in its cell, matching scale, generous 22% transparent padding in every cell. Crisp bold ivory and brass pictograms with dark charcoal outlines, subtle engraved metal style, readable at 28 pixels. Row 1 left to right: plus sign (add), pencil (edit), trash bin (remove), check mark (confirm). Row 2: six sided die (roll), crosshair (attack), lightning bolt (damage), shield (defense). Row 3: magnifying glass (browse), curved reload arrow (refresh), folder dossier (mission), medical cross (heal). Row 4: speech bubble (chat), right arrow (continue), gear cog (settings), X mark (cancel). Uniform layout exact 4x4 evenly spaced, each icon wholly within its own cell. No decorative frames, no lettering, no extra symbols.