# Licensing and provenance

This file records existing license notices and known content sources. It does
not apply a new umbrella license to this repository or grant rights in material
owned by someone else. Public availability and the project's unofficial status
do not by themselves establish permission for every component.

## Files with an existing MPL 2.0 notice

The following files already carry the Mozilla Public License 2.0 source notice:

- `module/sheets/agent-ux.mjs`
- `module/apps/dialog-theme.mjs`
- `module/apps/skill-dialog-ux.mjs`
- `module/apps/ui-verb-icons.mjs`
- `tools/test-agent-ux.mjs`
- `tools/test-dialog-theme-usage.mjs`
- `tools/tests/agent-ux.spec.mjs`

The complete [MPL 2.0 text](LICENSES/MPL-2.0.txt) is included in source and install
archives. Preserve those file-level notices when redistributing or modifying
covered source. These notices do not license the rest of the repository or its
game data, artwork, and music under MPL.

## Rules and imported data

Spycraft is a trademark of Crafty Games. This system is unofficial and is not
affiliated with or endorsed by Crafty Games. The rulebook's protected expression
and other retained rights belong to their respective owners.

Erik Dewey's [Spycraft 2.0 Character Generator spreadsheet](https://www.erikdewey.com/gaming.htm)
was the source of the initial data import, as credited in the README. His page
links [spycraft2generator.zip](https://www.erikdewey.com/spycraft2generator.zip)
and labels it last updated 5/9/07. The retrieved archive contains one file,
`spycraft generator3.xls`, and no separate license or readme. The archive's SHA-256 is
`ddae94ecd09acf6f85a652399a1c644b30c4249ffbc6033fc093f51449602fc7`.
No adaptation or redistribution grant has yet been established for that import;
crediting the spreadsheet author does not establish rights in the underlying
published game or in all imported material.

The project owner reports a rulebook showing 2005 and a PDF filename containing
"second printing." Its exact legal notices and Open Game Content/Product
Identity designations still require verification. No OGL license or publisher
permission is asserted by this document.

The repository's requirements for original summaries remain in
[AGENTS.md](AGENTS.md). Those requirements and the presence of page references
are not a substitute for establishing the rights in imported material.

## Artwork and sample content

Generation records and source claims are maintained with the assets:

- [Compendium icons](assets/icons/README.md)
- [NPC portraits and tokens](assets/npcs/README.md)
- [Sample agents](assets/agents/README.md)
- [Scene backgrounds](assets/scenes/README.md)
- [Interface artwork](assets/ui/functions/README.md)
- [Retro textures and vectors](docs/retro-assets.md)

These records describe provenance rather than applying a new public reuse
license or guaranteeing that generated outputs have copyright protection.
No blanket artwork or sample-content reuse license has been selected here.

## Soundtrack

Sacha Mallais generated the eleven-track soundtrack using Suno, account
`sacham`. On 19 November 2026, the project owner confirmed that every track was
generated while subscribed to Pro or Premier.

The [soundtrack provenance register](assets/audio/provenance.json) records the
distributed files and hashes. Generation dates, Suno song URLs, subscription
records, input rights, remix status, and permitted-download evidence still need
to be recorded or verified. See the [audio README](assets/audio/README.md).

Suno's contractual allocation of output rights is separate from any copyright
that may subsist in the recording or composition. The existing MPL notices do
not apply to the soundtrack, and this document selects no new public audio
reuse license. Applicable terms must be checked against the generation and
download records before making a broader grant.

## Dependencies and distribution

Development dependencies retain their own licenses; the package lock records
their versions. Referring to Foundry's APIs or its bundled Font Awesome glyphs
does not transfer ownership of those components to this project.

Release workflows include this document, `LICENSES/`, the asset provenance
records, and the existing README credits. Their inclusion preserves the
documented notices; it does not resolve outstanding content permissions.
