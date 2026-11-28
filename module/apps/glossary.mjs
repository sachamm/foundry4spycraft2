/**
 * Game terms in a line each, in the system's own words, for a GC or player who meets them on a sheet or the console.
 * One list feeds every "?" that explains a term, so a term is worded once. Add a term here, never in a template.
 */
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";
import { systemDialog } from "./dialog-theme.mjs";

/** @returns {{term: string, means: string}[]} in the order a new table meets them. */
export function glossary() {
  return [
    [
      loc`Threat Level`,
      loc`How dangerous the mission is, from 1 to 20. NPC statistics and XP rewards are read at this level.`
    ],
    [
      loc`Caliber`,
      loc`A grade from I to V for a mission's importance and for how good a piece of gear is. A mission's Caliber limits the gear agents may request.`
    ],
    [
      loc`Action dice`,
      loc`A small pool each agent gets every session. A die is rolled and added to a check, or spent to turn a threat into a critical success.`
    ],
    [
      loc`GC's action dice`,
      loc`The GC's own pool for the session. It raises NPC rolls and DCs, pays for NPC criticals and for agents' errors, and buys events.`
    ],
    [
      loc`Threat and error`,
      loc`A natural die result high enough to be a threat may become a critical success; one low enough to be an error may become a critical failure. Each needs an action die to take effect.`
    ],
    [
      loc`Triumph`,
      loc`A check result of 75 or more that also succeeds. On an attack it carries a critical hit, and once a mission it earns the team an XP bonus.`
    ],
    [
      loc`Vitality and wounds`,
      loc`Vitality is the ability to turn a hit into a near miss and is lost first. Wounds are real injury and are lost when vitality is gone or on a critical hit.`
    ],
    [
      loc`Standard and special NPCs`,
      loc`A special NPC has vitality and wounds like an agent. A standard NPC has neither: each hit calls for a Damage save, and failed saves take it out of the fight.`
    ],
    [loc`Damage save`, loc`A standard NPC's roll against DC 10 plus half the damage it has taken this scene.`],
    [loc`Defense`, loc`The number an attack's result must reach to hit.`],
    [loc`Initiative Count`, loc`A combatant's place in the round. Higher Counts act first.`],
    [
      loc`Fluid initiative`,
      loc`Actions such as aiming or delaying move a combatant's Count up or down, applied when the round ends.`
    ],
    [loc`Half and full actions`, loc`Each round a combatant has two half actions, or one full action in their place.`],
    [
      loc`Dramatic scene`,
      loc`A scene the GC marks as a high point. The GC's dice are stronger in it and opponents act sooner.`
    ],
    [
      loc`Disposition`,
      loc`How an NPC feels toward a character, as one of a ladder of grades. It modifies social checks against that NPC.`
    ],
    [
      loc`Standing`,
      loc`Reputation or Net Worth, whichever the campaign uses. It is earned at the end of a mission and lost for exposure.`
    ],
    [
      loc`Exposure`,
      loc`Marks against the team for breaking cover or protocol during a mission. Each costs standing when the mission ends.`
    ],
    [
      loc`Scene, session and mission`,
      loc`The three spans that limited abilities reset on. The console's Next scene, Begin session and Start mission steps begin each one.`
    ],
    [
      loc`Lead`,
      loc`In a chase or other Dramatic Conflict, how far ahead the pursued side is. The conflict ends when the Lead reaches either end of its track.`
    ]
  ].map(([term, means]) => ({ term, means }));
}

/** The definition of one term by its name, for a "?" beside that word; null when the list has none. */
export const termMeans = name =>
  glossary().find(entry => entry.term.toLocaleLowerCase() === String(name).toLocaleLowerCase())?.means ?? null;

/** The whole list as a dialog. */
export function openGlossary() {
  const rows = glossary()
    .map(entry => `<dt>${esc(entry.term)}</dt><dd>${esc(entry.means)}</dd>`)
    .join("");
  return systemDialog.prompt({
    window: { title: loc`Game terms` },
    position: { width: 560 },
    rejectClose: false,
    ok: { label: loc`Close` },
    content: `<div class="spycraft2-roll-options"><dl class="sc2-glossary">${rows}</dl></div>`
  });
}
