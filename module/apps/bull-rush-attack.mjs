import { rollPipeline } from "../rules/roll-pipeline.mjs";
export function bullRushAttackContent(key) {
  if (key !== "athletics") return "";
  return '<details><summary>Bull Rush attack (on foot)</summary><p>Choose Bull Rush above. This is one full action on your Initiative Count, opposed Athletics/STR with Armor Check Penalty. Count direct movement toward the target up to current Speed. The chosen target’s threatening adjacency does not stop this Bull Rush; other threatening opponents still do.</p><label>Actual target <input name="bullRushAttackOpponentName" maxlength="200" /></label><label>My Size categories minus the target’s <input name="bullRushAttackSizeDifference" type="number" min="-1" max="11" step="1" value="0" /></label><label>Counted direct movement (ft.) <input name="bullRushAttackDistanceFeet" type="number" min="0" step="any" /></label><label><input name="bullRushAttackTargetThreatening" type="checkbox" /> The chosen target is threatening</label><label><input name="bullRushAttackOtherThreatAdjacency" type="checkbox" /> Starting adjacent to another threatening opponent</label><label><input name="bullRushAttackPassesOtherThreat" type="checkbox" /> The route continues past another threatening opponent’s adjacency</label><label><input name="bullRushAttackOnFootConfirmed" type="checkbox" /> Both characters are on foot</label><label><input name="bullRushAttackRouteConfirmed" type="checkbox" /> The GC confirms a direct legal route, counted costs and no other threatening adjacency</label><label><input name="bullRushAttackContactConfirmed" type="checkbox" /> This movement legally reaches the chosen target’s square</label><label><input name="bullRushAttackFullActionConfirmed" type="checkbox" /> The GC confirms this full action is available now, with the actual participants and Size difference</label><p>Still Standing applies to resistance, not this attacking roll. Take the full action and resolve token movement, opposed outcome, pushing, damage and other consequences separately.</p></details>';
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "bullRushAttackContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 260, html: bullRushAttackContent(key) }]
});
