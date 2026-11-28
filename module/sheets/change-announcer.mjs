/**
 * A strip of figures that a redraw replaces whole cannot be a live region: a screen reader would hear all of it, or
 * nothing. This keeps one polite region the redraw leaves in place, and says only the figures that changed.
 */

/** "Caption value" for each figure whose value differs from the last reading; the first reading says nothing. */
export function changedFigures(previous, current) {
  if (!previous) return [];
  return Object.entries(current)
    .filter(([caption, value]) => Object.hasOwn(previous, caption) && previous[caption] !== value)
    .map(([caption, value]) => `${caption} ${value}`);
}

/** Read the `.sc2-field` captions and values inside a strip. */
export function readFigures(strip) {
  const figures = {};
  for (const field of strip?.querySelectorAll?.(".sc2-field") ?? []) {
    const caption = field.querySelector(".sc2-caption")?.textContent?.trim(),
      value = field.querySelector(".sc2-value")?.textContent?.trim();
    if (caption) figures[caption] = value ?? "";
  }
  return figures;
}

/** Announce what changed in `strip` since the holder's last reading, from a region kept on `host`. */
export function announceChanges(holder, host, strip) {
  if (!host?.querySelector || !strip) return "";
  const current = readFigures(strip),
    said = changedFigures(holder._figures, current).join(", ");
  holder._figures = current;
  let live = host.querySelector(":scope > .sc2-live");
  if (!live) {
    live = host.ownerDocument.createElement("p");
    live.className = "sc2-live sc2-visually-hidden";
    live.setAttribute("aria-live", "polite");
    host.append(live);
  }
  if (said && live.textContent !== said) live.textContent = said;
  return said;
}
