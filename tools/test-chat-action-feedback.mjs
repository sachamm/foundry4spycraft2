import test from "node:test";
import assert from "node:assert/strict";

globalThis.ui = { notifications: { warn: () => ({ native: true }), info: () => ({ native: true }) } };
const { runChatAction } = await import("../module/apps/chat-action-feedback.mjs");
const { refuse, refuseStep, decline, Refusal, isRefusal } = await import("../module/error-notices.mjs");

/** The few DOM members runChatAction touches. */
function card() {
  const doc = { activeElement: null, body: {}, querySelectorAll: () => [] };
  const button = {
    disabled: false,
    isConnected: true,
    ownerDocument: doc,
    nextElementSibling: null,
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    closest: () => null,
    after(node) {
      node.isConnected = true;
      this.status = node;
    }
  };
  doc.createElement = () => ({
    isConnected: false,
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    remove() {
      this.isConnected = false;
    }
  });
  return button;
}

test("a chat-card action reports finished, refused or cancelled, and nothing else", async () => {
  let button = card();
  await runChatAction(button, async () => ({ done: true }));
  assert.match(button.status.textContent, /^Action finished/);
  assert.equal(button.disabled, false);

  button = card();
  await runChatAction(button, async () => undefined);
  assert.match(button.status.textContent, /^Action finished/);

  // A refusal names its reason beside the button, whatever the handler went on to return.
  for (const refusal of [() => refuse("Roll the save first."), () => refuseStep("Roll the save first.")]) {
    button = card();
    await runChatAction(button, async () => refusal());
    assert.equal(button.status.textContent, "Not done: Roll the save first.");
  }
  button = card();
  await runChatAction(button, async () => {
    refuseStep("The character is busy.");
    return { swallowed: true };
  });
  assert.equal(button.status.textContent, "Not done: The character is busy.");
  button = card();
  await runChatAction(button, async () => decline("Nothing is awaiting review."));
  assert.equal(button.status.textContent, "Not done: Nothing is awaiting review.");
  button = card();
  await runChatAction(button, async () => false);
  assert.match(button.status.textContent, /^Not done/);

  // A closed dialog leaves no status line.
  button = card();
  await runChatAction(button, async () => null);
  assert.equal(button.status.isConnected, false);

  button = card();
  await runChatAction(button, async () => {
    throw new Refusal("Choose a target first.");
  });
  assert.equal(button.status.textContent, "Not done: Choose a target first.");
  assert.equal(button.status.attributes.role, "alert");

  button = card();
  const error = console.error;
  console.error = () => {};
  await runChatAction(button, async () => null.missing);
  console.error = error;
  assert.match(button.status.textContent, /^Action failed/);
});

test("refusal helpers return the value a limited-use callback needs, and Refusal is told apart from a fault", () => {
  assert.equal(refuse("x"), false);
  assert.equal(refuseStep("x"), null);
  assert.equal(decline("x"), null);
  assert.ok(isRefusal(new Refusal("x")));
  assert.ok(isRefusal(new Error("x")));
  assert.ok(!isRefusal(new TypeError("x")));
});
