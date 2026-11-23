# Working on this repository

## Do not use copyrighted material

The Spycraft 2.0 rulebook is not ours. This project uses the book's game mechanics as Open Game Content under the OGL 1.0a, but much of the book is reserved Product Identity (see [LICENSING.md](LICENSING.md)). Never use the book's setting, characters, organizations, stories or art. As a house rule, nothing from its text may be copied into this repository either.

- Never commit the rulebook, extracts of it, page images or text dumps, in any format.
- Game data may record **names, numbers, dice, DCs and table values** as bare labels. All descriptive text must be an original summary in our own words; never reuse the book's sentences, examples or flavour text.
- Keep labels short. If a table cell in the book is a sentence, write a brief label or summary instead of transcribing it.
- The same applies to code comments, dialog text, documentation, test fixtures and commit messages.
- When adding or editing data, check new text against the source for copied runs of words before committing, and reword anything that matches. `npm run check:copy -- /path/to/your/rulebook.md` (or `SPYCRAFT_RULEBOOK_TEXT=…`) scans `src/data/*.json` and `lang/en.json` against a local text copy of the book and fails on a copied prose run of 12 or more words. The book never goes in the repository, so CI cannot run this check; run it yourself.
- If something cannot be expressed without the book's wording, leave it out and cite the page number so the GC can look it up.

## Follow the UI style guide

Any change to sheets, dialogs, chat cards, the combat tracker, the GC Console or user-facing strings follows [docs/ui-style-guide.md](docs/ui-style-guide.md). When you touch an existing surface, fix the guide's divergences in the lines you change; the audit in its section 10 lists the known ones.
