/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ruleName } from "../rules/rule-name.mjs";

/**
 * The play buttons a feat offers on the Feats tab, by the name the rules know the feat by (so a renamed or
 * translated item keeps its buttons). `label` is a language key; `gcOnly` buttons are shown to the GC alone.
 */
const FEAT_ACTIONS = Object.freeze({
  "Everyday Genius": [
    { action: "useEverydayGenius", label: "SPYCRAFT.Template.ActorAgentFeats.GainATemporaryBasicSkillFeat" }
  ],
  "Quick Draw": [
    {
      action: "useFeatFreeAction",
      resource: "quickDraw",
      label: "SPYCRAFT.Template.ActorAgentFeats.FreeWeaponActionTwiceRound"
    }
  ],
  "Surge of Speed": [
    {
      action: "useFeatFreeAction",
      resource: "surgeOfSpeed",
      label: "SPYCRAFT.Template.ActorAgentFeats.FreeNonAttackHalfAction"
    }
  ],
  "Silver Tongue": [
    {
      action: "settleSilverTongueVictory",
      label: "SPYCRAFT.Template.ActorAgentFeats.GCSettleSeductionVictory",
      gcOnly: true
    }
  ],
  Mark: [{ action: "useMark", label: "SPYCRAFT.Template.ActorAgentFeats.ObserveThreeSkillsFreeAction" }]
});

/** Buttons for one feat row: none unless its prerequisites are met. */
export function featActions(item, { qualified = true, isGM = false } = {}) {
  if (!qualified) return [];
  return (FEAT_ACTIONS[ruleName(item)] ?? []).filter(entry => !entry.gcOnly || isGM);
}
