/**
 * The "attack" roll dialog as ordered parts. Each part is one piece of the form; a rule adds its own piece by
 * registering a `dialog` contributor for "attack" with an `at` between the parts it belongs with.
 * ATTACK_DIALOG.anchors gives the position just inside the end of each named section.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { reachContextContent } from "../../apps/reach.mjs";
import { reachIncreaseFeet } from "../../rules/reach.mjs";
import {
  observedAttackTargetContent,
  cleaveTargetRequired,
  characterTargetContent
} from "../../apps/character-target.mjs";
import {
  quickAttackActionContent,
  quickRangedAimContent,
  meleeFireContextContent,
  allOutAttackContent,
  meleeTrickContent,
  bullseyeContent
} from "../../apps/standard-attack-context.mjs";
import { cqbRangedWeapon } from "../../rules/cqb.mjs";
import { loc } from "../../i18n.mjs";

/** A weapon with a range increment, whose attack takes a range modifier when the distance is known. */
const rangedWeapon = item => Number(item?.system?.range) > 0;

/** [position, render(context)] — context holds the acting character and the values the roll has worked out so far. */
const parts = [
  [10, () => `<div class="spycraft2-roll-options">`],
  [20, ({ item, options }) => (reachIncreaseFeet(item.system.qualities ?? "") ? reachContextContent(options) : "")],
  [
    30,
    ({ actor, item, options }) =>
      cleaveTargetRequired(actor, item.system)
        ? characterTargetContent(actor, options)
        : observedAttackTargetContent(actor, options)
  ],
  [
    40,
    () =>
      `<label><input type="checkbox" name="targetFlanked" /> ${loc`I am flanking this opponent with this attack, satisfying the applicable position, ready-weapon and Reach/CQB requirements (p.341)`}</label><label><input type="checkbox" name="targetPinnedAdjacent" /> ${loc`Target is pinned and I am adjacent (+4 melee/unarmed attack)`}</label><label><input type="checkbox" name="targetAnimal" /> ${loc`This attack targets an animal (Scout Game Hunter, p.43)`}</label>`
  ],
  [
    50,
    ({ actor, item, options }) =>
      cqbRangedWeapon(item.system)
        ? meleeFireContextContent(options) + quickRangedAimContent(options) + bullseyeContent(actor, options)
        : quickAttackActionContent(options) + allOutAttackContent(actor, options) + meleeTrickContent(actor, options)
  ],
  [
    60,
    ({ item, needsCQB, options }) =>
      needsCQB
        ? `<label>${loc`CQB target distance (feet)`} <input name="distanceFeet" type="number" min="0" step="any" required value="${Number.isFinite(options.distanceFeet) ? options.distanceFeet : ""}" /></label><label><input name="targetOpponentConfirmed" type="checkbox" /> ${loc`This attack targets an opponent (CQB Mastery threat benefit)`}</label>`
        : rangedWeapon(item)
          ? `<label>${loc`Target distance in feet (optional; leave empty for a quick roll without a range modifier)`} <input name="distanceFeet" type="number" min="0" step="any" value="${Number.isFinite(options.distanceFeet) ? options.distanceFeet : ""}" /></label>`
          : ""
  ],
  [
    66,
    ({ options }) =>
      `<label>${loc`Situational modifier`} <input name="situationalModifier" type="number" step="1" value="${Number(options.situationalModifier) || 0}" /></label>`
  ],
  // The measured-shot conditions the Gear tab's second attack button used to open a dialog of its own for: light,
  // fog, mounts, bracing and the rest. Folded shut, so a plain shot is still one glance.
  [68, context => measuredShotContent(context)],
  [70, () => `</div>`]
];

const fieldNames = html => new Set([...String(html).matchAll(/\bname="([^"]+)"/g)].map(match => match[1]));
let nesting = false;
/**
 * Every field of the "rangedAttack" dialog that the attack dialog does not already hold, inside one disclosure.
 * Built from the ranged dialog's own pieces, so a rule that adds a field there shows here without more work.
 */
export function measuredShotContent(context) {
  if (nesting || !rangedWeapon(context?.item)) return "";
  nesting = true;
  try {
    const { actor, item, options = {} } = context;
    // An unfinished character may have no figures to preview the weapon with: the section then leaves out fire modes.
    let preview = {};
    try {
      preview = actor?.weaponAttack?.(item) ?? {};
    } catch {
      preview = {};
    }
    const mine = fieldNames(rollPipeline.dialog({ ...context, dialog: "attack" }));
    const ranged = rollPipeline.dialog({ dialog: "rangedAttack", actor, item, options, preview, esc: escapeText });
    const labels = (ranged.match(/<label\b[\s\S]*?<\/label>/g) ?? []).filter(label => {
      const names = [...fieldNames(label)];
      return names.length && names.every(name => !mine.has(name));
    });
    if (!labels.length) return "";
    return `<details class="sc2-measured-shot"><summary>${loc`Light, fog, mounts and bracing`}</summary><p class="hint">${loc`Leave these alone for an ordinary shot. Fill in what applies when the shot is measured: the range modifier comes from the distance above.`}</p>${labels.join("")}</details>`;
  } finally {
    nesting = false;
  }
}
const escapeText = value => globalThis.foundry?.utils?.escapeHTML?.(String(value)) ?? String(value);

/** The names of the measured-shot fields this dialog shows for a weapon, to know which entered values are theirs. */
export function measuredShotFields(context) {
  return fieldNames(measuredShotContent(context));
}

export const ATTACK_DIALOG = Object.freeze({ id: "attack", anchors: Object.freeze({}) });

rollPipeline.register({
  id: "attackDialog",
  dialogs: ["attack"],
  dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
});

// The dialog's own fields: the chosen target and the plain circumstance boxes.
rollPipeline.register({
  id: "attackDialogInput",
  dialogs: ["attack"],
  order: 70,
  read: ({ entered }) => ({
    ...(Object.hasOwn(entered, "targetActorUuid")
      ? {
          targetActorUuid: entered.targetActorUuid,
          targetCharacterType: entered.targetCharacterType,
          targetName: entered.targetName,
          characterTarget: undefined
        }
      : {}),
    situationalModifier: Math.trunc(Number(entered.situationalModifier)) || 0,
    firingOutOfMelee: entered.firingOutOfMelee === true,
    firingIntoMelee: entered.firingIntoMelee === true,
    askContext: false,
    targetPinnedAdjacent: entered.targetPinnedAdjacent === true,
    targetAnimal: !!entered.targetAnimal,
    targetFlanked: !!entered.targetFlanked
  })
});

// The optional distance of a quick ranged attack (the CQB section reads its own, required, distance).
rollPipeline.register({
  id: "attackDistanceInput",
  dialogs: ["attack"],
  order: 65,
  read({ item, needsCQB, entered }) {
    if (needsCQB || !rangedWeapon(item)) return null;
    const value = entered.distanceFeet;
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return null;
    const distanceFeet = Number(value);
    if (!Number.isFinite(distanceFeet) || distanceFeet < 0)
      throw new Error(loc`Enter a nonnegative target distance, or leave it empty.`);
    return { distanceFeet };
  }
});
