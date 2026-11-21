/**
 * Rich text on sheets and previews. Every call reads the document it belongs to the same way: secret blocks show only
 * to the document's owners, and links and roll data resolve against that document.
 * @param {string} html
 * @param {foundry.abstract.Document|null} doc the document the text belongs to
 * @param {object} [options] extra enrichHTML options, such as rollData
 * @returns {Promise<string>}
 */
export function enrich(html, doc, options = {}) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
    secrets: doc?.isOwner === true,
    relativeTo: doc ?? undefined,
    ...options
  });
}
