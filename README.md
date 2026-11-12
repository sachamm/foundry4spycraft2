# Spycraft 2.0 for Foundry VTT

An unofficial game system for [Foundry Virtual Tabletop](https://foundryvtt.com) implementing the core rules and character options of the Spycraft 2.0 RPG.

- **System ID:** `spycraft2`
- **Foundry compatibility:** v13

## Development setup

Foundry loads systems from `{userData}/Data/systems/<id>`. Symlink this folder there so edits show up after a reload:

```bash
# macOS (default user data path)
ln -s "/Volumes/New Master/Users/sacha ON NEW MASTER/Development/Foundry/Spycraft" \
  "$HOME/Library/Application Support/FoundryVTT/Data/systems/spycraft2"
```

Then create a world using the **Spycraft 2.0** system.

## Layout

| Path | Purpose |
| --- | --- |
| `system.json` | Manifest |
| `spycraft2.mjs` | Entry point / init hooks |
| `module/config.mjs` | `CONFIG.SPYCRAFT` constants |
| `module/data/` | Actor & Item TypeDataModels |
| `module/documents/` | Actor & Item document classes |
| `module/sheets/` | ApplicationV2 sheets |
| `templates/` | Handlebars templates |
| `lang/` | Localization |
| `packs/` | Compendium packs |

## Legal

Spycraft is a trademark of Crafty Games. This project is unofficial and not affiliated with or endorsed by Crafty Games. Only Open Game Content may be included in compendiums.

## Installing in Foundry

In Foundry's **Install System** dialog, paste this manifest URL:

```
https://github.com/sachamm/foundry4spycraft2/releases/latest/download/system.json
```

## Releasing

1. Bump `version` in `system.json` and add a `CHANGELOG.md` entry.
2. Commit and push, then publish a GitHub release tagged `v<version>` (e.g. `v0.1.0`).
3. The **Release** workflow attaches `system.json` and `spycraft2.zip` to the release.
