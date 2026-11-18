/**
 * The short dialogs a roll opens when one fact is still missing: reach geometry, mortar and launcher circumstances,
 * the CQB damage distance and the Killer Instinct range. Each is a dialog of its own in the roll pipeline, so a
 * rule can add a line to one with a `dialog` contributor, or correct what was entered with a `read` contributor.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { reachContextContent } from "../../apps/reach.mjs";
import { enteredDistance } from "../../rules/cqb.mjs";
import { loc } from "../../i18n.mjs";

/** dialog id → { title(context), parts: [[position, render(context)]] } */
export const FOLLOW_UP_DIALOGS = {
  reachGeometry: {
    title: () => loc`Reach weapon — actual target geometry`,
    parts: [
      [10, () => '<div class="spycraft2-roll-options">'],
      [20, ({ options }) => reachContextContent(options)],
      [90, () => "</div>"]
    ]
  },
  mortarDamage: {
    title: () => loc`Mortar damage circumstances`,
    parts: [
      [10, () => '<div class="spycraft2-roll-options">'],
      [
        20,
        () =>
          `<label><input name="mortarSpaceConfirmed" type="checkbox" /> ${loc`Mortar fired outdoors or in a very large indoor area suitable for its high-arc trajectory`}</label>`
      ],
      [90, () => "</div>"]
    ]
  },
  launcherDamage: {
    title: () => loc`Launcher damage circumstances`,
    parts: [
      [
        10,
        () =>
          `<div class="spycraft2-roll-options"><p>${loc`Confirm the mount and firing mode used for the attack producing this damage.`}</p>`
      ],
      [
        20,
        ({ item }) =>
          ["underbarrel", "optionalUnderbarrel"].includes(item.system.mountRequirement)
            ? `<label><input type="checkbox" name="underbarrelMountConfirmed" /> ${loc`Underbarrel version was attached to a compatible rifle’s available underbarrel location`}</label>`
            : ""
      ],
      [
        30,
        ({ item }) =>
          item.system.mountRequirement === "tripodOrVehicle"
            ? `<label><input type="checkbox" name="usingIntegralTripod" /> ${loc`Integral tripod was in use`}</label><label><input type="checkbox" name="vehicleMounted" /> ${loc`Launcher was attached to a vehicle`}</label>`
            : ""
      ],
      [
        40,
        () =>
          `<label><input type="checkbox" name="indirectFire" /> ${loc`Target was outside line of sight (Indirect/INT)`}</label>`
      ],
      [90, () => "</div>"]
    ]
  },
  cqbDamageDistance: {
    title: () => loc`CQB damage target distance`,
    parts: [
      [
        10,
        () =>
          `<div class="spycraft2-roll-options"><p>${loc`CQB Basics adds1 damage against targets within current CQB Range. Enter the actual target distance for this damage; this does not take another attack or spend dice.`}</p>`
      ],
      [
        20,
        () =>
          `<label>${loc`Target distance (feet)`} <input name="distanceFeet" type="number" min="0" step="any" required /></label>`
      ],
      [90, () => "</div>"]
    ]
  },
  killerInstinct: {
    title: () => loc`Killer Instinct range`,
    parts: [
      [
        10,
        ({ actor }) =>
          `<label><input type="checkbox" name="withinCQB" /> ${loc`The target is beyond Reach and within CQB range (${actor.system.cqbRange ?? 30} ft.)`}</label>`
      ]
    ]
  }
};

for (const [id, { parts }] of Object.entries(FOLLOW_UP_DIALOGS)) {
  rollPipeline.register({
    id: `${id}Dialog`,
    dialogs: [id],
    dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
  });
}

rollPipeline.register({
  id: "cqbDamageDistanceInput",
  dialogs: ["cqbDamageDistance"],
  read: (context, input) => ({ distanceFeet: enteredDistance(input.distanceFeet) })
});

/**
 * Ask for the missing fact. Returns what was entered after the dialog's `read` contributors, or null when closed.
 * @param {object} dialogs  the dialog service (module/apps/dialog-theme.mjs)
 * @param {string} id       a key of FOLLOW_UP_DIALOGS
 * @param {object} context  what the parts need: the acting character, the weapon, the roll options
 */
export async function askFollowUp(dialogs, id, context = {}) {
  const spec = FOLLOW_UP_DIALOGS[id];
  if (!spec) throw new Error(`Unknown follow-up dialog "${id}".`);
  const input = await dialogs.input({
    window: { title: spec.title(context) },
    rejectClose: false,
    content: rollPipeline.dialog({ dialog: id, ...context })
  });
  return input ? rollPipeline.read({ dialog: id, ...context }, input) : null;
}
