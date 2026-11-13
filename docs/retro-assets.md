# Retro espionage art

Original artwork and interface details for a restrained 1960s spy-film dossier aesthetic: ivory paper, petrol teal, antique brass, and burgundy warnings.

| Asset | Used by |
| --- | --- |
| `assets/retro/dossier-paper.webp` | Agent, NPC, item, and browser window backgrounds |
| `assets/retro/surveillance-header.webp` | Decorative dossier bands on all four surfaces |
| `assets/retro/agency-seal.svg` | Decorative emblem in each dossier band |
| `assets/retro/microfilm.svg` | Character sheet tab navigation border |

`system.json` loads `styles/retro.css` after the original sheet CSS. Asset paths are relative to the stylesheet, except the seal's Foundry system URL. Assets ship with the existing release workflow. No external image host or font service is needed. The two WebP images total approximately 65 KB.

The ivory sheet palette is intentionally consistent in light and dark Foundry surroundings. Keyboard focus uses an explicit burgundy outline. Decorative header content is hidden from assistive technology. Increased-contrast preferences remove the paper texture. Existing portrait selection, roll actions, fields, and tab identifiers are preserved.

## Provenance and generation prompts

The paper and surveillance art were created with the built-in image generation tool, then resized and encoded as WebP for distribution. The SVG emblem and film perforations are original vector artwork created for this project. No source material from existing film franchises was used.

Paper prompt:

> Use case: stylized-concept. Asset type: production background texture for a dense tabletop RPG character sheet. Create a flat orthographic scan of blank ivory dossier paper from a 1960s intelligence archive, portrait aspect ratio 2:3. Very subtle fine natural paper fibres, faint warm age at outer edges, extremely restrained irregular wear. The entire central 90 percent must be clean nearly uniform pale cream for dark small text overlaid by the application. Sophisticated vintage espionage film art direction, archival stationery. No text, no markings, no stamps, no objects, no borders, no folds, no shadows or lighting gradients, no mockup. Edge to edge paper only.

Header prompt:

> Use case: stylized-concept. Asset type: wide background artwork for retro spy tabletop RPG sheet headers. A sophisticated abstract 1960s espionage film title sequence, widescreen 3:1 aspect ratio. Deep midnight petrol teal background with very faint film grain, thin muted antique brass concentric surveillance rings and elliptical radar geometry concentrated at the rightmost quarter, a few long diagonal graphic lines in teal. The left three quarters must remain very dark and visually quiet as negative space for application interface controls. Restrained screenprinted cinematic graphic design, tactile matte ink. No text, letters, numbers, logos, people, weapons, symbols from existing franchises, objects, or bright white highlights. Edge to edge flat artwork, no mockup, no frame.

## Validation

- `npm ci`, `npm run build`, then `npm test`: 471/471 checks pass across three fixtures. On a fresh checkout the tests require the pack build first.
- All Handlebars templates precompile successfully, including the four modified templates.
- Actual agent, NPC, item, and browser templates render with sample contexts and localization helpers outside Foundry.
- Confirmed each asset reference resolves to a local file and both WebP files decode.
- Browser screenshot validation was blocked by the environment's socket restrictions; no live Foundry runtime was available. In-Foundry visual verification remains required: check all agent tabs, NPCs, each item type, the browser, light/dark surroundings, long names, resizing, keyboard focus, portrait editing, and rich-text editing.
