# Operation Glass Wake

Operation Glass Wake is an original first-session scenario for four level-1 agents at Threat Level 1 and Caliber II. The team finds a contact at a reception, locates a missing courier in a service annex and recovers a shipping ledger at Warehouse Nine. The GM notes offer social, covert and combat routes, alternate ways to find essential clues, motives and escape conditions. Encounter difficulty remains a starting point for GC review.

## Import and prepare

Open **Compendium Packs → The Field Agent's Handbook → Operation Glass Wake**, open the adventure and choose **Import Adventure**. No add-on module is required. The imported private GM journal begins with **Start Here — Import and Mission Setup** and includes the session run sheet. The separate Player Briefing has Observer access for players; PCs require player ownership assignments.

The adventure contains three scenes, nine actors, two journals with three pages, one macro and five folders. The reception stages Leila and Luc, Jun, Mara and Luka. The annex stages Niko and four independent watchkeepers. The warehouse stages Milo, four watchkeepers and Ada. Maps retain their walls, doors and lighting. The three scenes start inactive; move the agents between maps according to the route they take.

Run **Glass Wake — Configure Mission** from the Start Here link or the Macros tab. It requires the imported cast, asks before creating an inactive mission and refuses to replace any existing or edited mission record. It checks again after confirmation. It changes only the mission setting; action dice, XP, time, scene activation and player ownership remain separate GC actions. Review the mission in GC Console, start it, initialize the pool for four players at Caliber II (eight GC dice), and apply starting-dice adjustments once as appropriate.

Imported documents have stable IDs distinct from the system's starter cast and blank sample maps. They retain the earlier standalone Glass Wake adventure's IDs so Foundry can identify a reimport. Reimporting can overwrite those previously imported documents after Foundry's warning; preserve campaign edits before accepting it. The built-in compendium is GM-only and is never automatically imported on world launch.

## Authoring and release packaging

`src/data/glass-wake.json` contains the original scenario prose, stable import IDs, mission plan and token staging. `tools/lib/glass-wake.mjs` assembles its actors and maps from the existing sample packs, including current equipment and feats. Antagonist XP is calculated from the current profiles. The courier uses a standard graded civilian profile with Notice and no equipment picks.

`tools/lib/glass-wake-setup.mjs` supplies the self-contained function embedded in the GM macro. It has no runtime dependency on `tools/` or a separate module. The builder packages complete actor inventories and scene geometry inside a native Adventure document.

Run `npm run build` to create `packs/glass-wake` and register it in `system.json`. Every release workflow already packages `packs/` and `assets/`; no separate installation artifact or release trigger is needed. The README and imported journals contain the end-user instructions delivered with the system.

`tools/test-glass-wake.mjs` checks playable builds, links, staging, asset paths, current catalog reuse and mission setup safeguards. `tools/check-glass-wake-pack.mjs`, included in `npm run test:packs`, checks the built LevelDB adventure and release packaging paths. `npm run check:schemas` also validates its actor systems and inventories with the installed Foundry models when available.
