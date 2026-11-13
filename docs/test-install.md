# Install the retro test branch

In Foundry's Setup screen, open **Game Systems → Install System**, paste this Manifest URL, and click Install:

```text
https://github.com/sachamm/foundry4spycraft2/releases/download/test-retro/system.json
```

Requires Foundry 14. This package keeps the `spycraft2` ID and replaces any installed Spycraft 2.0 system; it does not install as a second system. Use a disposable test world for visual checks. If already installed and Foundry skips installation, unlock the package and uninstall/reinstall the system using this URL. Keep a backup of any edits made directly in the installed system or its compendiums.

Future successful pushes to `feat/retro-spy-assets` publish a newer version. Use **Update System** from Setup to get it, then reload the browser. No local build, ZIP extraction, or folder copying is needed.

The GitHub workflow builds the compendiums, runs the engine checks, stamps a monotonically increasing prerelease version, and publishes an installable ZIP. The rolling `test-retro` prerelease provides the fixed manifest URL. Each build has a unique ZIP filename; the ZIP is uploaded before replacing the manifest, so previous manifest downloads remain usable. The source manifest and normal stable release channel are unchanged. The rolling tag identifies the first publication; release notes identify the current build's commit.

The test release is explicitly a prerelease and is never marked Latest. To return to stable, reinstall using:

```text
https://github.com/sachamm/foundry4spycraft2/releases/latest/download/system.json
```

Reinstall explicitly when leaving the test channel; automatic updates may not offer an older stable version. Installing stable does not downgrade world data migrations.
