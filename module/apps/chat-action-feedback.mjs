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
    await run();
    if (status?.isConnected) status.textContent = loc`Action finished. Review the result.`;
  } catch (error) {
    if (!status) throw error;
    status.setAttribute("role", "alert");
    status.textContent = loc`Action failed: ${error?.message ?? String(error)}. Review the settings and try again.`;
  } finally {
    button.disabled = false;
    button.removeAttribute?.("aria-busy");
    // A dialog may deliberately have taken focus. Only recover focus that fell back to the page body.
    if (focused && doc?.activeElement === doc.body) {
      const message = [...doc.querySelectorAll("[data-message-id]")].find(node => node.dataset.messageId === messageId);
      const destination = button.isConnected
        ? button
        : message?.querySelector(".sc2-result-guide h4, button[data-roll-control]");
      if (destination) {
        if (destination.tagName !== "BUTTON") destination.tabIndex = -1;
        destination.focus();
      }
    }
  }
}
