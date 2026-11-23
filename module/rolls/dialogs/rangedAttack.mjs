/**
 * The "rangedAttack" roll dialog as ordered parts. Each part is one piece of the form; a rule adds its own piece by
 * registering a `dialog` contributor for "rangedAttack" with an `at` between the parts it belongs with.
 * RANGED_ATTACK_DIALOG.anchors gives the position just inside the end of each named section.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { FOG_SMOKE, AMBIENT_LIGHT } from "../../rules/senses.mjs";
import { FIRE_MODES } from "../../rules/firearms.mjs";
import { loc } from "../../i18n.mjs";

/** [position, render(context)] — context holds the acting character and the values the roll has worked out so far. */
const parts = [
  [
    10,
    () => `
        <p>${loc`Range increment`} `
  ],
  [20, ({ preview }) => preview.range],
  [
    30,
    () => ` ${loc`ft. Recoil uses your current Strength. Confirm Aim/Brace conditions for this roll. Action costs and Initiative Count changes are applied at the table.`}</p>
        <label>${loc`Target distance (feet)`} <input type="number" name="distanceFeet" min="0" step="any" required /></label>
        <div class="spycraft2-roll-options">
        <label><input type="checkbox" name="oneInAMillion" /> ${loc`One in a Million (Soldier 14; once/session)`}</label>
        <label><input type="checkbox" name="millionDollarSkill" /> ${loc`Million Dollar Skill: Sniper 10, roll twice and choose (once/round; eligible weapon)`}</label><label><input type="checkbox" name="targetVulnerable" /> ${loc`This opponent is vulnerable against this attack`}</label>
        <label><input type="checkbox" name="targetFlanked" /> ${loc`I am flanking this opponent with this attack; applicable position, ready-weapon and Reach/CQB requirements are met (p.341)`}</label>
        <label><input type="checkbox" name="targetPinnedAdjacent" /> ${loc`Target is pinned and I am adjacent (+4 melee/unarmed attack)`}</label><label><input type="checkbox" name="targetOpponentConfirmed" /> ${loc`This attack targets an opponent (CQB Mastery threat benefit)`}</label><label><input type="checkbox" name="targetAnimal" /> ${loc`This attack targets an animal (Scout Game Hunter)`}</label><label><input type="checkbox" name="targetCrouchedNonAdjacent" /> ${loc`Target is crouched and I am not adjacent (−1 ranged attack)`}</label><label><input type="checkbox" name="targetProneNonAdjacent" /> ${loc`Target is prone and I am not adjacent (−2 ranged attack)`}</label>
        <label><input type="checkbox" name="targetFlatFooted" /> ${loc`This opponent is flat-footed against this attack (Surprise Shot)`}</label>
        <label><input type="checkbox" name="cunningPlan" /> ${loc`Cunning Plan: Schemer 2, free action to reduce error range (shared scene uses)`}</label>
        <label><input type="checkbox" name="vehicleMounted" /> ${loc`This weapon is mounted on a vehicle for this attack`}</label>
        <label>${loc`Mounted weapon’s normal firing time`} <select name="weaponOperationTime"><option value="">${loc`Unspecified / use its source`}</option><option value="half">${loc`1 half action`}</option><option value="full">${loc`1 full action`}</option><option value="twoHalf">${loc`2 half actions`}</option></select></label>
        <label>${loc`Fog/smoke`} <select name="obscurant"><option value="">${loc`Unspecified`}</option><option value="fog">${loc`Fog`}</option><option value="smoke">${loc`Smoke`}</option></select></label>
            <label>${loc`Fog/smoke density`} <select name="obscurantDensity"><option value="">${loc`Unspecified`}</option>`
  ],
  [
    40,
    () =>
      Object.entries(FOG_SMOKE)
        .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
        .join("")
  ],
  [
    50,
    () => `</select></label>
            <label>${loc`Ambient light`} <select name="ambientLight"><option value="">${loc`Unspecified / resolve at table`}</option>`
  ],
  [
    60,
    () =>
      Object.entries(AMBIENT_LIGHT)
        .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
        .join("")
  ],
  [
    70,
    () => `</select></label>
        <label><input type="checkbox" name="blinded" /> ${loc`Additional blindness for this attack`}</label><label><input type="checkbox" name="deafened" /> ${loc`Additional deafness for this attack`}</label><label><input type="checkbox" name="targetCharacter" /> ${loc`Target is a character (Night Training's nearby hearing exception)`}</label>
        `
  ],
  [
    80,
    ({ item }) =>
      item.system.weaponCategory === "mortar"
        ? `<label><input name="mortarSpaceConfirmed" type="checkbox" /> ${loc`Mortar is outdoors or in a very large indoor area suitable for its high-arc trajectory`}</label>`
        : ""
  ],
  [
    90,
    ({ item }) =>
      item.system.weaponCategory === "grenadeLauncher"
        ? `<label><input type="checkbox" name="indirectFire" /> ${loc`Grenade launcher: indirect fire at a target outside line of sight (Indirect/INT; otherwise Tactical/DEX)`}</label>`
        : ""
  ],
  [
    100,
    ({ item }) =>
      ["underbarrel", "optionalUnderbarrel"].includes(item.system.mountRequirement)
        ? `<label><input type="checkbox" name="underbarrelMountConfirmed" /> ${loc`Underbarrel version is attached to a compatible rifle’s available underbarrel location`}</label>`
        : ""
  ],
  [
    110,
    ({ item }) =>
      item.system.mountRequirement === "tripodOrVehicle"
        ? `<label><input type="checkbox" name="usingIntegralTripod" /> ${loc`Automatic grenade launcher: integral tripod is in use (or declare vehicle attachment above)`}</label>`
        : ""
  ],
  [
    120,
    () => `
        `
  ],
  [
    140,
    () => `<label>${loc`Attack action`} <select name="attackAction"><option value="standard" selected>${loc`Standard Attack (Single-Shot for firearms)`}</option><option value="other">${loc`Other attack (resolve its action modifiers at the table)`}</option></select></label>
        <label><input type="checkbox" name="aimed" /> ${loc`Aim remains valid for this target; it has not moved more than 5 ft.`}</label>
        `
  ],
  [
    150,
    ({ preview }) =>
      preview.firearm
        ? `<label><input type="checkbox" name="braced" /> ${loc`Brace remains valid: I have not moved and the target is in the chosen 90-degree cone`}</label><label><input type="checkbox" name="stableSurface" /> ${loc`I have a stable surface to brace against (unnecessary with Marksmanship Basics)`}</label>`
        : ""
  ],
  [
    160,
    () => `
        `
  ],
  [
    170,
    ({ esc, preview }) =>
      preview.firearm
        ? `<label>${loc`Fire mode`} <select name="fireMode">${preview.modes.map(mode => `<option value="${mode}" ${mode === preview.fireMode ? "selected" : ""}>${esc(FIRE_MODES[mode] ?? mode)}</option>`).join("")}</select></label>`
        : ""
  ],
  [180, () => `</div>`]
];

export const RANGED_ATTACK_DIALOG = Object.freeze({ id: "rangedAttack", anchors: Object.freeze({}) });

rollPipeline.register({
  id: "rangedAttackDialog",
  dialogs: ["rangedAttack"],
  dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
});

// The measured distance as a number (null when none was entered) and the vehicle mount as a yes or no.
rollPipeline.register({
  id: "rangedAttackDialogInput",
  dialogs: ["rangedAttack"],
  read: (context, input) => ({
    vehicleMounted: !!input.vehicleMounted,
    distanceFeet: input.distanceFeet === "" || input.distanceFeet == null ? null : Number(input.distanceFeet)
  })
});
