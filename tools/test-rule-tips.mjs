import test from "node:test";
import assert from "node:assert/strict";
import { chosenPicks, ruleTip, summaryText } from "../module/sheets/rule-tips.mjs";

test("summary text drops tags and secrets, keeps paragraphs apart and reads link labels", () => {
  assert.equal(
    summaryText(
      '<p>One &amp; two.</p><p>Three&nbsp;&#8211; four.</p><section class="secret" id="s1"><p>GC only</p></section>'
    ),
    "One & two. Three – four."
  );
  assert.equal(summaryText("<p>See @UUID[Compendium.spycraft2.feats.Item.abc]{Quick Draw}.</p>"), "See Quick Draw.");
  assert.equal(summaryText(null), "");
});

test("a rule tip leads with the kind and summary, then lists the owner's picks", () => {
  const tip = ruleTip({
    kind: "Talent",
    summary: "<p>+2 to one attribute, –2 to another.</p>",
    picks: [
      { label: "+2 attribute", value: "Dexterity" },
      { label: "Class skill 1", value: "" }
    ]
  });
  assert.equal(tip.text, "Talent: +2 to one attribute, –2 to another. · +2 attribute: Dexterity");
  assert.equal(
    tip.html,
    "<strong>Talent</strong> +2 to one attribute, –2 to another.<br>+2 attribute: <b>Dexterity</b>"
  );
});

test("tip markup escapes item text, and a pick with nothing to say has no tip", () => {
  const tip = ruleTip({ kind: "Chance feat", summary: 'Roll <again> & "keep"' });
  assert.equal(tip.html, "<strong>Chance feat</strong> Roll &amp; &quot;keep&quot;");
  assert.equal(ruleTip({ kind: "Feat", summary: "<p></p>" }), null);
});

test("chosen picks show each option's label and skip blank fields", () => {
  assert.deepEqual(
    chosenPicks([
      { label: "+2 attribute", value: "dex", options: { dex: "Dexterity" } },
      { label: "−2 attribute", value: "", options: { str: "Strength" } },
      { label: "Granted Profession focus", value: "Pilot", text: true, options: null }
    ]),
    [
      { label: "+2 attribute", value: "Dexterity" },
      { label: "Granted Profession focus", value: "Pilot" }
    ]
  );
});
