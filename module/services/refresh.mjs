/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Redraw a document's sheet if it is open. Reading `document.sheet` builds a sheet for a document that never had
 * one, so a world-wide refresh first looks at the sheet already held, and a closed sheet is left alone: it reads
 * fresh data when it is next opened. Resetting the document's derived data is the caller's job and is never
 * skipped here.
 */
export function renderOpenSheet(document) {
  if (!document) return false;
  const sheet = "_sheet" in document ? document._sheet : document.sheet;
  if (!sheet || sheet.rendered === false) return false;
  sheet.render(false);
  return true;
}
