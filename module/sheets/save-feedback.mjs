import { loc } from "../i18n.mjs";

const messages = () => ({
  idle: loc`Auto-save on`,
  dirty: loc`Unsaved changes`,
  saving: loc`Saving…`,
  saved: loc`Saved`,
  error: loc`Not saved — edit again to retry`
});

function show(sheet) {
  const root = sheet.element;
  if (!root?.querySelector || !sheet.isEditable) return;
  let badge = root.querySelector(".sc2-save-status");
  if (!badge) {
    const header = root.querySelector(".window-header");
    if (!header) return;
    badge = root.ownerDocument.createElement("span");
    badge.className = "sc2-save-status";
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");
    badge.setAttribute("aria-atomic", "true");
    header.querySelector(".window-title")?.after(badge);
  }
  badge.dataset.state = sheet._saveState ?? "idle";
  badge.textContent = messages()[badge.dataset.state];
}

/** Feedback follows the persistence promise, including rejections and overlapping saves. */
export const SaveFeedback = Base =>
  class extends Base {
    _onRender(context, options) {
      super._onRender(context, options);
      show(this);
      const root = this.element;
      if (!this.isEditable || root.dataset.saveFeedback) return;
      root.dataset.saveFeedback = "true";
      root.addEventListener("input", event => {
        if (!event.target.matches?.("input[name], select[name], textarea[name], prose-mirror[name]")) return;
        this._editRevision = (this._editRevision ?? 0) + 1;
        this._saveState = "dirty";
        show(this);
      });
    }

    /**
     * Resolves once every save already under way has ended, whether it succeeded or not. A button that rewrites a
     * whole list waits for this, so that it builds on the text the user typed just before pressing it.
     */
    async whenSaved() {
      while (this._saving?.size) await Promise.all([...this._saving]);
    }

    async _processSubmitData(...args) {
      const revision = this._editRevision ?? 0;
      this._pendingSaves = (this._pendingSaves ?? 0) + 1;
      this._saveState = "saving";
      show(this);
      let settle;
      const saving = new Promise(resolve => (settle = resolve));
      (this._saving ??= new Set()).add(saving);
      try {
        const result = await super._processSubmitData(...args);
        this._savedRevision = Math.max(this._savedRevision ?? -1, revision);
        if ((this._failedRevision ?? -1) <= revision) this._failedRevision = -1;
        return result;
      } catch (error) {
        this._failedRevision = Math.max(this._failedRevision ?? -1, revision);
        throw error;
      } finally {
        this._saving.delete(saving);
        settle();
        this._pendingSaves--;
        this._saveState = this._pendingSaves
          ? "saving"
          : (this._failedRevision ?? -1) >= (this._savedRevision ?? -1) && (this._failedRevision ?? -1) >= 0
            ? "error"
            : (this._savedRevision ?? -1) >= (this._editRevision ?? 0)
              ? "saved"
              : "dirty";
        show(this);
      }
    }
  };
