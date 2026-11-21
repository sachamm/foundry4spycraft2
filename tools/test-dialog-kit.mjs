import test from "node:test";
import assert from "node:assert/strict";
import { esc, markup, markupFragment, raw } from "../module/html.mjs";
import { isLeadGM, primaryWriterFor } from "../module/writers.mjs";
import * as kit from "../module/apps/dialog-kit.mjs";

test("esc matches the old local helper: Foundry's escapeHTML on a string, nothing for null", () => {
  const name = `O'Brien & <Sons> "Ltd"`;
  assert.equal(esc(name), "O&#x27;Brien &amp; &lt;Sons&gt; &quot;Ltd&quot;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  // With Foundry loaded, its own function does the work, so output is what the rest of the system writes.
  globalThis.foundry = { utils: { escapeHTML: text => `[${text}]` } };
  try {
    assert.equal(esc("x"), "[x]");
  } finally {
    delete globalThis.foundry;
  }
});

test("markup escapes each value once, joins lists, skips empty values and keeps fragments and raw markup", () => {
  const rows = [{ name: "A & B" }, { name: "<C>" }];
  assert.equal(
    markup`<ul>${rows.map(row => markupFragment`<li>${row.name}</li>`)}</ul>`,
    "<ul><li>A &amp; B</li><li>&lt;C&gt;</li></ul>"
  );
  assert.equal(markup`<p>${null}${undefined}${false}${0}</p>`, "<p>0</p>");
  assert.equal(
    markup`<p title="${'"quoted"'}">${raw("<b>kept</b>")}</p>`,
    '<p title="&quot;quoted&quot;"><b>kept</b></p>'
  );
  // A finished markup string is text to another template, so it is escaped rather than trusted.
  assert.equal(markup`${markup`<b>x</b>`}`, "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(typeof markup`x`, "string");
  assert.equal(String(markupFragment`<i>${"&"}</i>`), "<i>&amp;</i>");
});

test("the dialog kit re-exports the shared helpers under one import", () => {
  for (const name of ["esc", "markup", "markupFragment", "raw", "refuse", "isLeadGM", "primaryWriterFor"])
    assert.equal(typeof kit[name], "function", name);
});

test("one writer per character: the active GC, else the connected owner whose id sorts first", () => {
  const owner = id => ({ id, active: true });
  const actor = { testUserPermission: (user, level) => level === "OWNER" && user.owns !== false };
  const users = [owner("b"), owner("a"), { id: "0", active: false }, { ...owner("c"), owns: false }];
  assert.equal(primaryWriterFor(actor, { users }).id, "a");
  const gm = { id: "gm" };
  assert.equal(primaryWriterFor(actor, { users: Object.assign([...users], { activeGM: gm }) }), gm);
  assert.equal(primaryWriterFor(actor, { users: [] }), null);
  assert.equal(primaryWriterFor(actor, {}), null);
});

test("only the active GC's own client leads", () => {
  assert.equal(isLeadGM({ user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } }), true);
  assert.equal(isLeadGM({ user: { id: "gm2", isGM: true }, users: { activeGM: { id: "gm" } } }), false);
  assert.equal(isLeadGM({ user: { id: "p", isGM: false }, users: { activeGM: { id: "p" } } }), false);
  assert.equal(isLeadGM({ user: { id: "gm", isGM: true }, users: {} }), false);
  assert.equal(isLeadGM({}), false);
});
