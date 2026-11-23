/**
 * A sheet saves on every change and redraws its parts, and other people's actions redraw it too. Foundry puts focus
 * back on a field that has an id or a name, but not the text still being typed there, and not on a button at all.
 * These helpers carry both across a redraw of one part.
 */

const TEXT_TYPES = new Set(["text", "search", "url", "tel", "password", "email", "number"]);
const escape = value => globalThis.CSS?.escape?.(String(value)) ?? String(value).replace(/["\\]/g, "\\$&");

/** A selector for a control that has no id or name: its action and the data that tells it from its neighbours. */
function controlSelector(control) {
  const data = Object.entries(control.dataset ?? {}).filter(([key]) => !key.startsWith("sc2") && key !== "tooltip");
  if (!data.length) return null;
  const tag = control.tagName.toLowerCase();
  const attribute = key => `data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
  const own = data.map(([key, value]) => `[${attribute(key)}="${escape(value)}"]`).join("");
  // A row verb (edit, remove) repeats for every item; the row's item id tells the rows apart.
  const row = control.closest("[data-item-id]");
  return `${row && row !== control ? `[data-item-id="${escape(row.dataset.itemId)}"] ` : ""}${tag}${own}`;
}

/**
 * What to carry across a redraw of `prior`: the focused field's unsaved text and caret, or the focused button.
 * @param {HTMLElement} prior  The part about to be replaced
 * @param {{name: string, value: string}|null} [committed]  The field and text of the change being saved, if any
 * @returns {object|null}
 */
export function capturePlace(prior, committed = null) {
  const active = prior?.ownerDocument?.activeElement;
  if (!active || !prior.contains(active)) return null;
  const typing =
    active.tagName === "TEXTAREA" ||
    (active.tagName === "INPUT" && TEXT_TYPES.has(active.type)) ||
    active.tagName === "SELECT";
  if (typing && (active.name || active.id)) {
    // Only text the document does not hold yet needs carrying; a clean field takes the new value.
    // Text that was just sent for saving is not carried either: the document may correct it (a clamped number).
    const sent = committed && committed.name === active.name && committed.value === active.value;
    const dirty = active.tagName !== "SELECT" && active.value !== active.defaultValue && !sent;
    if (!dirty) return null;
    const place = {
      selector: active.id ? `#${escape(active.id)}` : `${active.tagName.toLowerCase()}[name="${escape(active.name)}"]`,
      value: active.value
    };
    try {
      place.caret = [active.selectionStart, active.selectionEnd, active.selectionDirection];
    } catch {
      // A number field has no caret to read.
    }
    return place;
  }
  if (active.id || active.name) return null;
  const selector = controlSelector(active);
  if (!selector) return null;
  // Several controls can share one description; remember which of them had focus.
  return { selector, index: [...prior.querySelectorAll(selector)].indexOf(active), focusOnly: true };
}

/**
 * Put back what capturePlace() kept, in the freshly drawn part.
 * @param {HTMLElement} fresh
 * @param {object|null} place
 */
export function restorePlace(fresh, place) {
  if (!place || !fresh?.querySelectorAll) return;
  const matches = [...fresh.querySelectorAll(place.selector)];
  const target = place.focusOnly ? (matches[place.index] ?? matches[0]) : matches[0];
  if (!target || target.disabled) return;
  if (!place.focusOnly) {
    target.value = place.value;
    // A browser reports a change only for text the user typed into this element, and this text was typed into the
    // one it replaced. Report the change on leaving the field unless further typing has made the browser do so.
    let reported = false;
    target.addEventListener("change", () => (reported = true), { once: true });
    target.addEventListener(
      "blur",
      () => {
        if (!reported && target.isConnected && target.value !== target.defaultValue)
          target.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { once: true }
    );
    target.focus({ preventScroll: true });
    if (place.caret?.[0] !== null && place.caret?.[0] !== undefined)
      try {
        target.setSelectionRange(...place.caret);
      } catch {
        // Not a field with a caret.
      }
    return;
  }
  target.focus({ preventScroll: true });
}

/** Sheets that keep the user's place across a redraw. Wrap the Handlebars mixin, which owns the part hooks. */
export const KeepPlace = Base =>
  class extends Base {
    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      if (!root?.addEventListener || root.dataset.sc2KeepPlace) return;
      root.dataset.sc2KeepPlace = "true";
      // Remember what each change sent, so the redraw that follows does not write it back over the saved value.
      root.addEventListener(
        "change",
        event => {
          const field = event.target;
          if (field?.name) this._committedField = { name: field.name, value: field.value };
        },
        true
      );
      root.addEventListener("input", () => (this._committedField = null), true);
    }

    _preSyncPartState(partId, newElement, priorElement, state) {
      super._preSyncPartState?.(partId, newElement, priorElement, state);
      state.sc2Place = capturePlace(priorElement, this._committedField);
    }

    _syncPartState(partId, newElement, priorElement, state) {
      super._syncPartState?.(partId, newElement, priorElement, state);
      restorePlace(newElement, state.sc2Place);
    }
  };
