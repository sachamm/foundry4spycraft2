/**
 * The "damage" roll dialog as ordered parts. Each part is one piece of the form; a rule adds its own piece by
 * registering a `dialog` contributor for "damage" with an `at` between the parts it belongs with.
 * DAMAGE_DIALOG.anchors gives the position just inside the end of each named section.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { loc } from "../../i18n.mjs";

/** [position, render(context)] — context holds the acting character and the values the roll has worked out so far. */
const parts = [
  [
    10,
    () =>
      `<div class="spycraft2-roll-options"><label>${loc`Target sheet`} <select name="targetActorUuid"><option value="">${loc`Manual target: confirm immunities below`}</option>`
  ],
  [
    20,
    ({ automaticAttackBonus, sideHits, targetChoices }) =>
      targetChoices.actors
        .map(
          a =>
            `<option value="${foundry.utils.escapeHTML(a.uuid)}"${(sideHits.length === 1 ? sideHits[0].proof.targetUuid : (automaticAttackBonus?.proof.targetUuid ?? targetChoices.selected)) === a.uuid ? " selected" : ""}>${foundry.utils.escapeHTML(a.name ?? "Character")}</option>`
        )
        .join("")
  ],
  [
    30,
    () => `</select></label><p>${loc`A selected target sheet supplies its known armor protection. Other immunities and reachable vitals still require confirmation.`}</p>
        `
  ],
  [
    40,
    ({ attackBonusHits, automaticAttackBonus, targetChoices }) =>
      attackBonusHits.length
        ? `<label>${loc`Recorded attack damage bonus`} <select name="attackDamageSourceUuid"><option value="">${loc`No recorded attack bonus`}</option>${attackBonusHits.map(h => `<option value="${foundry.utils.escapeHTML(h.message.uuid)}"${automaticAttackBonus === h ? " selected" : ""}>${foundry.utils.escapeHTML(h.proof.source)} ${h.proof.sneakDice ? `+${h.proof.sneakDice}d6 sneak` : `+${h.proof.bonus}`} — ${foundry.utils.escapeHTML(targetChoices.actors.find(a => a.uuid === h.proof.targetUuid)?.name ?? h.proof.manualTargetName ?? "Recorded target")}</option>`).join("")}</select></label><p>${loc`Use this exact recorded successful attack and target. Its damage bonus applies once and combines with ordinary weapon modifiers before minimum damage.`}</p>`
        : ""
  ],
  [
    50,
    () => `
        <label><input type="checkbox" name="includeSneakAttack"`
  ],
  [60, ({ sideHits, trickSneakHit }) => (sideHits.length === 1 || trickSneakHit ? " checked" : "")],
  [70, () => ` ${loc`/> Include earned sneak attack damage`}</label>`],
  [
    80,
    ({ sideHits, targetChoices }) =>
      sideHits.length
        ? `<label>${loc`Side Stance hit`} <select name="sideStanceSourceUuid"><option value="">${loc`Other attack / no Side Stance die`}</option>${sideHits.map(h => `<option value="${foundry.utils.escapeHTML(h.message.uuid)}"${sideHits.length === 1 ? " selected" : ""}>${loc`Round ${h.message.flags.spycraft2.rollCombat?.round ?? "?"} — ${foundry.utils.escapeHTML(targetChoices.actors.find(a => a.uuid === h.proof.targetUuid)?.name ?? "Recorded opponent")}`}</option>`).join("")}</select></label><p>${loc`The selected hit supplies one earned die, once. It is combined with this attack’s other sneak damage; leaving the stance after the hit does not remove its recorded entitlement.`}</p>`
        : ""
  ],
  [
    90,
    () => `
        <label><input type="checkbox" name="successfulStandardAttack"`
  ],
  [
    100,
    ({ sideHits, attackFacts }) => (sideHits.length === 1 || attackFacts?.attackAction === "standard" ? " checked" : "")
  ],
  [
    110,
    () => ` ${loc`/> This was a successful Standard Attack`}</label>
        <label><input type="checkbox" name="targetCharacter"`
  ],
  [120, ({ sideHits, attackFacts }) => (sideHits.length === 1 || attackFacts?.targetActorUuid ? " checked" : "")],
  [
    130,
    ({ attackFacts }) => ` ${loc`/> Target is a character, not an object`}</label>
        <label><input type="checkbox" name="targetFlanked"${attackFacts?.targetFlanked ? " checked" : ""} /> ${loc`I am flanking this target with this attack`}</label><label><input type="checkbox" name="targetHelpless" /> ${loc`Target is helpless`}</label><label><input type="checkbox" name="targetVulnerable" /> ${loc`Target is vulnerable`}</label>
        <label><input type="checkbox" name="targetVitalsConfirmed" /> ${loc`Target is not immune to critical hits or sneak attack damage, is not hidden to me and has reachable vitals`}</label>
        <label>${loc`Damage type`} <select name="damageType"><option value="lethal">${loc`Lethal`}</option><option value="subdual">${loc`Subdual`}</option></select></label>
        <label>${loc`Conversion`} <select name="damageConversion"><option value="none">${loc`None`}</option><option value="lethalToSubdual">${loc`Lethal to subdual (requires Bludgeon)`}</option><option value="subdualToLethal">${loc`Subdual to lethal (no sneak attack)`}</option></select></label>
        <label>${loc`Ranged target distance (feet)`} <input type="number" name="distanceFeet" min="0" step="any"${Number.isFinite(attackFacts?.distanceFeet) ? ` value="${attackFacts.distanceFeet}"` : ""} /></label>
        <label><input type="checkbox" name="braced"${attackFacts?.braced ? " checked" : ""} /> ${loc`I was bracing this two-handed firearm/hurled weapon for this attack (Sniper dice)`}</label>
      </div>`
  ]
];

export const DAMAGE_DIALOG = Object.freeze({ id: "damage", anchors: Object.freeze({}) });

rollPipeline.register({
  id: "damageDialog",
  dialogs: ["damage"],
  dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
});
