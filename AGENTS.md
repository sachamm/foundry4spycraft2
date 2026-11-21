# Working on this repository

## Do not use copyrighted material

The Spycraft 2.0 rulebook is not ours and is **not open content**. Nothing from it may be copied into this repository.

- Never commit the rulebook, extracts of it, page images or text dumps, in any format.
- Game data may record **names, numbers, dice, DCs and table values** as bare labels. All descriptive text must be an original summary in our own words; never reuse the book's sentences, examples or flavour text.
- Keep labels short. If a table cell in the book is a sentence, write a brief label or summary instead of transcribing it.
- The same applies to code comments, dialog text, documentation, test fixtures and commit messages.
- When adding or editing data, check new text against the source for copied runs of words before committing, and reword anything that matches. `npm run check:copy -- /path/to/your/rulebook.md` (or `SPYCRAFT_RULEBOOK_TEXT=…`) scans `src/data/*.json` and `lang/en.json` against a local text copy of the book and fails on a copied prose run of 12 or more words. The book never goes in the repository, so CI cannot run this check; run it yourself.
- If something cannot be expressed without the book's wording, leave it out and cite the page number so the GC can look it up.
