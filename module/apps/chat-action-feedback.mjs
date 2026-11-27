import { isRefusal, lastRefusalMessage, refusalCount } from "../error-notices.mjs";
import { loc } from "../i18n.mjs";

/** Keep feedback local to an explicit action, rather than announcing historical chat on render. */
export async function runChatAction(button, run) {
  if (button.disabled) return;
  const doc = button.ownerDocument;
  const focused = doc?.activeElement === button;
  const messageId = button.closest?.("[data-message-id]")?.dataset.messageId;
  let status;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  if (doc) {
    button.nextElementSibling?.matches(".sc2-action-feedback") && button.nextElementSibling.remove();
    status = doc.createElement("p");
    status.className = "spycraft2 sc2-action-feedback";
    status.setAttribute("role", "status");
    status.textContent = loc`Working…`;
    button.after(status);
  }
  try {
    const refusedBefore = refusalCount();
    const result = await run();
    // Three endings. A refusal is already on screen as a notice (see refuse()): the handler returned false, or a
    // nested step refused and its value was lost on the way up. null is a dialog the user closed, which needs no
    // status line. Anything else ran to the end.
    if (!status?.isConnected) return;
    if (refusalCount() > refusedBefore) status.textContent = loc`Not done: ${lastRefusalMessage()}`;
    else if (result === false) status.textContent = loc`Not done: see the notice.`;
    else if (result === null) status.remove();
    // A step that posted a card of its own (Roll damage) continues there, not on this card.
    else if (result?.documentName === "ChatMessage" && result.id !== messageId)
      status.textContent = loc`Done. The next step is on the new card below.`;
    else status.textContent = loc`Done. The next step is at the top of this card.`;
  } catch (error) {
    if (!status) throw error;
    status.setAttribute("role", "alert");
    // A thrown refusal is a rule saying no; anything else is a fault in the code.
    status.textContent = isRefusal(error)
      ? loc`Not done: ${error.message}`
      : loc`Action failed: ${error?.message ?? String(error)}. Review the settings and try again.`;
    if (!isRefusal(error)) console.error(error);
  } finally {
    button.disabled = false;
    button.removeAttribute?.("aria-busy");
    // A dialog may deliberately have taken focus. Only recover focus that fell back to the page body.
    if (focused && doc?.activeElement === doc.body) {
      const message = [...doc.querySelectorAll("[data-message-id]")].find(node => node.dataset.messageId === messageId);
      const destination = button.isConnected
        ? button
        : message?.querySelector(".sc2-result-guide .sc2-guide-title, button[data-roll-control]");
      if (destination) {
        if (destination.tagName !== "BUTTON") destination.tabIndex = -1;
        destination.focus();
      }
    }
  }
}
