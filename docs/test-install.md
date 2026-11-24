# Install a test build

A test build is any branch packaged for the test server. It never replaces the stable release.

## Publish one

On GitHub open **Actions → Test build → Run workflow** and pick the branch. The run passes every check a pull request
must pass, then puts a ZIP and a manifest on the rolling `test-build` prerelease. Each run has a higher version than
the last (the system's version with the run number added), and its own ZIP, uploaded before the manifest is replaced.

## Install it

In Foundry's Setup screen, open **Game Systems → Install System**, paste this Manifest URL, and click Install:

```text
https://github.com/sachamm/foundry4spycraft2/releases/download/test-build/system.json
```

Requires Foundry 14. The package keeps the `spycraft2` ID and replaces the installed copy of the system; it does not
install as a second system. Use a disposable test world. If Foundry skips the installation because the system is
already there, unlock the package, uninstall it and install again from this URL. Worlds are not removed with the
system.

After that, each new test build arrives through **Update System** in Setup; reload the browser afterwards.

## Return to stable

Reinstall from the stable manifest:

```text
https://github.com/sachamm/foundry4spycraft2/releases/latest/download/system.json
```

Reinstall explicitly when leaving the test channel: updates do not offer an older stable version, and installing
stable does not undo world data migrations a test build ran.
