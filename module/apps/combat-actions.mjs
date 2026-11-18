/** Baseline combat actions in play: the dialog sections that declare them and the buttons that settle them. */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import {
  COVER_FIRE,
  FIRE_ACTIONS,
  GRAPPLE_BENEFITS,
  SUPPRESSIVE_FIRE,
  steelRainWeapon,
  autofireHits,
  blastIncrementFeet,
  blastProfile,
  burstHits,
  coverFireDC,
  grappleBenefitText,
  grappleOutcome,
  grappleSizeBonus,
  strafeHits
} from "../rules/combat-actions.mjs";
import { parseAmmunitionCode } from "../rules/ammunition.mjs";
import { grappleTrickLines } from "../rules/grapple-tricks.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const post = (actor, lines) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("")
  });
const whole = value => (value === "" || value === null || value === undefined ? null : Math.trunc(Number(value)));

/* -------------------------------------------- */
/*  Declaring a fire action                      */
/* -------------------------------------------- */

/** The ranged attack dialog's fire action section, for firearms that can fire more than one shot. */
export function fireActionContent(preview, item, actor = null) {
  if (!preview?.firearm && steelRainWeapon(actor?.system, item?.system)) return steelRainContent();
  if (!preview?.firearm) return "";
  const modes = preview.modes ?? [],
    capacity = parseAmmunitionCode(item?.system?.ammo)?.capacity ?? "";
  const option = (value, label, show = true) => (show ? `<option value="${value}">${label}</option>` : "");
  return `<fieldset class="spycraft2-fire-action"><legend>${loc`Fire action`}</legend><label>${loc`Action`} <select name="fireAction">${option("", loc`One attack, as declared above`)}${option("burst", loc`Burst — Burst mode, 3 shots, error +1 (a Standard Attack)`, modes.includes("burst"))}${option("twoShotBurst", loc`Two-Shot Burst — Single-Shot or Burst mode, 2 shots, at most 2 hits (Autofire Basics)`, (modes.includes("single") || modes.includes("burst")) && actor?.system?.activeFeatNames?.includes("Autofire Basics") === true)}${option("autofire", loc`Autofire — Full Auto, 3 shots a volley, –1 a volley, error +2`, modes.includes("auto"))}${option("strafe", loc`Strafe — Full Auto, 3 shots a square, recoil doubled, error +2`, modes.includes("auto"))}${option("coverFire", loc`Cover Fire — 5 shots, the target saves (no attack check)`)}${option("suppressiveFire", loc`Suppressive Fire — 5 shots at an empty square (no attack check)`)}${option("suppressiveFinal", loc`Final attack from Suppressive Fire — 1 shot, –4`)}</select></label><label>${loc`Volleys (Autofire) or squares (Strafe)`} <input type="number" name="fireCount" min="1" max="100" step="1" /></label><label>${loc`Shots left in the weapon`} <input type="number" name="shotsRemaining" min="0" step="1" value="${capacity}" /></label><p class="hint">${loc`Burst, Autofire and Strafe set the fire mode they need. Shots are not deducted for you.`}</p></fieldset>`;
}

/** Steel Rain's hurled-weapon fire actions: the Burst trick, Cover Fire and Suppressive Fire. */
function steelRainContent() {
  const option = (value, label) => `<option value="${value}">${label}</option>`;
  return `<fieldset class="spycraft2-fire-action"><legend>${loc`Fire action (Steel Rain)`}</legend><label>${loc`Action`} <select name="fireAction">${option("", loc`One attack, as declared above`)}${option("burst", loc`Burst — 3 hurled weapons, error +1 (a Standard Attack)`)}${option("coverFire", loc`Cover Fire — 5 hurled weapons, the target saves (no attack check)`)}${option("suppressiveFire", loc`Suppressive Fire — 5 hurled weapons at an empty square (no attack check)`)}${option("suppressiveFinal", loc`Final attack from Suppressive Fire — 1 hurled weapon, –4`)}</select></label><label>${loc`Hurled weapons of this kind on you`} <input type="number" name="shotsRemaining" min="0" step="1" /></label><p class="hint">${loc`Each “shot” is one hurled weapon thrown. They are not deducted for you (p.182).`}</p></fieldset>`;
}

/** What the section's fields mean for the roll. */
export function fireActionInput(input = {}) {
  const action = input.fireAction ?? "";
  if (!action) return null;
  const countEntered = whole(input.fireCount);
  // Burst needs Burst mode and Autofire or Strafe Full Auto, so the action sets the mode.
  const mode = FIRE_ACTIONS[action]?.mode;
  return {
    fireAction: action,
    ...(mode ? { fireMode: mode } : {}),
    fireVolleys: action === "autofire" ? countEntered : null,
    fireSquares: action === "strafe" ? countEntered : null,
    shotsRemaining: whole(input.shotsRemaining),
    // Each fire action is its own kind of attack action for Aim and Brace.
    ...(["burst", "twoShotBurst"].includes(action) ? { attackAction: "standard" } : {}),
    ...(action === "autofire" ? { attackAction: "autofire" } : {}),
    ...(["strafe", "suppressiveFinal"].includes(action) ? { attackAction: "other", aimed: false } : {})
  };
}

rollPipeline.register({
  id: "fireActionContent:rangedAttack",
  dialogs: ["rangedAttack"],
  order: 9740,
  dialog: ({ preview, item, actor }) => [{ at: 175, html: fireActionContent(preview, item, actor) }],
  read: (context, input) => fireActionInput(input)
});

/** Pummel on the quick attack dialog, for unarmed attacks. */
export function pummelContent(item) {
  const unarmed = item?.system?.proficiency === "unarmed" || /\bNKL\b/.test(item?.system?.qualities ?? "");
  return unarmed
    ? `<label><input type="checkbox" name="pummel" /> ${loc`Pummel: an unarmed Standard Attack taking a full action, for double subdual damage (p.358)`}</label>`
    : "";
}

rollPipeline.register({
  id: "pummelContent:attack",
  dialogs: ["attack"],
  order: 65,
  dialog: ({ item }) => [{ at: 55, html: pummelContent(item) }],
  read: ({ entered }) => (entered?.pummel === true ? { pummel: true, attackAction: "standard" } : null)
});

/* -------------------------------------------- */
/*  Cover Fire and Suppressive Fire              */
/* -------------------------------------------- */

/** An opponent's name in the Cover Fire list; an unlinked token is marked so it is not confused with its sheet. */
export function coverFireTargetLabel(target) {
  if (!target?.isToken) return target?.name ?? "";
  const scene = target.token?.parent?.name;
  return scene ? loc`${target.name} (token on ${scene})` : loc`${target.name} (token)`;
}

/** Cover Fire: no attack check; the chosen opponent makes a Will save. */
export async function coverFire(actor, item, input = {}) {
  const preview = actor.weaponAttack(item, input),
    dc = coverFireDC(actor.system.attack?.ranged ?? 0),
    distance = Number(input.distanceFeet);
  if (preview.maximumRange && Number.isFinite(distance) && distance > Math.floor(preview.maximumRange / 2))
    return ui.notifications.warn(
      loc`Cover Fire reaches half the weapon's maximum range: ${Math.floor(preview.maximumRange / 2)} ft.`
    );
  const shots = whole(input.shotsRemaining);
  if (shots !== null && shots < COVER_FIRE.shots) return ui.notifications.warn(loc`Cover Fire takes 5 shots.`);
  const targets = attackCharacterTargetChoices().filter(a => a.uuid !== actor.uuid),
    targeted = [...(game.user?.targets ?? [])],
    selected = targeted.length === 1 ? (targeted[0].actor?.uuid ?? "") : "";
  const chosen = await systemDialog.input({
    window: { title: loc`Cover Fire` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`A full action and 5 shots. The opponent must not be in melee. Will save DC ${dc}.`}</p><label>${loc`Opponent`} <select name="targetUuid"><option value="">${loc`Not listed — the GC rolls the save`}</option>${targets.map(a => `<option value="${esc(a.uuid)}"${a.uuid === selected ? " selected" : ""}>${esc(coverFireTargetLabel(a))}</option>`).join("")}</select></label></div>`
  });
  if (!chosen) return null;
  const target = chosen.targetUuid ? await fromUuid(chosen.targetUuid) : null;
  await post(actor, [
    loc`Cover Fire with ${esc(item.name)}${target ? loc` at ${esc(target.name)}` : ""}: 5 shots. Will save DC ${dc}. On a failure the opponent takes –4 to attack and skill checks for a round; failing by 5 or more lets the attacker spend an action die on a final attack with this weapon, without Aim (p.355).`
  ]);
  if (target?.isOwner)
    return target.rollSave("will", {
      askContext: true,
      hazardSave: { kind: "coverFire", label: loc`Cover Fire`, dc, attackerName: actor.name }
    });
  return true;
}

/** Suppressive Fire: no attack check now; final attacks follow as opponents cross the square. */
export async function suppressiveFire(actor, item, input = {}) {
  const shots = whole(input.shotsRemaining);
  if (shots !== null && shots < SUPPRESSIVE_FIRE.shots)
    return ui.notifications.warn(loc`Suppressive Fire takes 5 shots.`);
  await post(actor, [
    loc`Suppressive Fire with ${esc(item.name)}: 5 shots into an empty square within maximum range. For a round, anyone hostile crossing the square draws a final attack at –4 (1 more shot each, no Aim) and takes –4 to attack and skill checks until the start of the attacker's next Initiative Count (p.361).`,
    loc`Roll each final attack from the ranged attack dialog with the fire action "Final attack from Suppressive Fire".`
  ]);
  return true;
}

/* -------------------------------------------- */
/*  Counting hits                                */
/* -------------------------------------------- */

/** Ask the target's Defense (or the targets', for a Strafe) and report how many shots hit. */
export async function countFireActionHits(message) {
  const check = message.flags?.spycraft2,
    action = check?.attackContext?.fireAction;
  if (!action) return null;
  const total = check.effectiveTotal,
    feats = fromUuidSync(check.actorUuid)?.system?.activeFeatNames ?? [],
    supreme = feats.includes("Autofire Supremacy");
  if (action.action === "strafe") {
    const input = await systemDialog.input({
      window: { title: loc`Strafe: targets in order` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Attack result ${total}. Enter each target's Defense from one end of the chain to the other, separated by commas.`}</p><label>${loc`Defenses`} <input name="defenses" placeholder="14, 16, 13" required /></label></div>`
    });
    if (!input) return null;
    const defenses = String(input.defenses)
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    if (!defenses.length || defenses.some(d => !Number.isFinite(d) || d < 0) || defenses.length > action.squares)
      return ui.notifications.warn(loc`Enter up to ${action.squares} Defense values, each 0 or more.`);
    const results = strafeHits(total, defenses, { step: supreme ? 1 : 2 });
    return post(fromUuidSync(check.actorUuid), [
      loc`Strafe, result ${total}:`,
      ...results.map(r =>
        r.hit
          ? loc`Target ${r.index + 1}: Defense ${r.defense} (${r.raised} with the strafe bonus) — hit.`
          : loc`Target ${r.index + 1}: Defense ${r.defense} (${r.raised} with the strafe bonus) — miss.`
      ),
      loc`Each target hit takes the weapon's standard damage.`
    ]);
  }
  const input = await systemDialog.input({
    window: {
      title: ["burst", "twoShotBurst"].includes(action.action)
        ? loc`Burst: shots that hit`
        : loc`Autofire: shots that hit`
    },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Attack result ${total}.`}</p><label>${loc`Target's Defense`} <input type="number" name="defense" min="0" step="1" required /></label></div>`
  });
  if (!input) return null;
  const defense = Number(input.defense);
  if (!Number.isFinite(defense)) return null;
  if (defense < 0) return ui.notifications.warn(loc`Defense cannot be negative.`);
  const hits =
    action.action === "burst"
      ? burstHits(total, defense)
      : action.action === "twoShotBurst"
        ? burstHits(total, defense, 2)
        : autofireHits(total, defense, action.volleys, { perPoints: supreme ? 3 : 4 });
  return post(fromUuidSync(check.actorUuid), [
    hits
      ? loc`${action.action === "autofire" ? loc`Autofire` : loc`Burst`}: result ${total} against Defense ${defense} — ${hits} shot(s) hit. Roll damage once for each; a critical hit sends only the first to wounds.`
      : loc`${action.action === "autofire" ? loc`Autofire` : loc`Burst`}: result ${total} against Defense ${defense} — a miss.`
  ]);
}

rollPipeline.register({
  id: "fireActionControl",
  kinds: ["attack"],
  order: 9750,
  chatControls({ message, check, actor }) {
    const controls = [];
    const action = check.attackContext?.fireAction;
    if (action && ["burst", "twoShotBurst", "autofire", "strafe"].includes(action.action) && !check.superseded)
      controls.push({ label: loc`Count the shots that hit`, run: () => countFireActionHits(message) });
    if (check.attackContext?.pummel && !check.superseded) {
      const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
      if (weapon)
        controls.push({
          label: loc`Roll Pummel damage`,
          run: () => actor.rollDamage(weapon, { pummel: true, includeSneakAttack: false })
        });
    }
    return controls.length ? controls : null;
  }
});

/* -------------------------------------------- */
/*  Blast                                        */
/* -------------------------------------------- */

/** Post how a rolled blast tapers with distance. */
export async function postBlastProfile(message) {
  const check = message.flags?.spycraft2,
    total = check?.effectiveTotal ?? message.rolls?.[0]?.total;
  if (!Number.isFinite(total)) return null;
  const increment = blastIncrementFeet(check.weaponQualities),
    rows = blastProfile(total, increment);
  return post(fromUuidSync(check.actorUuid), [
    loc`Blast, ${total} damage at Ground Zero, increment ${increment} ft. (p.343):`,
    ...rows.map(row =>
      row.increment === 0
        ? loc`Ground Zero (within ${row.toFeet} ft.): ${row.damage}`
        : loc`${row.fromFeet}–${row.toFeet} ft.: ${row.damage}`
    ),
    loc`Blast goes straight out and is stopped by cover that makes its Damage save.`
  ]);
}

rollPipeline.register({
  id: "blastControl",
  kinds: ["damage"],
  order: 9760,
  chatControls({ message, check }) {
    if (!/\bBLS\b/.test(check.weaponQualities ?? "")) return null;
    return [{ label: loc`Blast damage by distance`, run: () => postBlastProfile(message) }];
  }
});

/* -------------------------------------------- */
/*  Grapple                                      */
/* -------------------------------------------- */

/** Settle one opposed grapple check and list the benefits the winner may choose from. */
export async function settleGrapple(actor, options = {}) {
  let input = options;
  if (input.total === undefined) {
    input = await systemDialog.input({
      window: { title: loc`Grapple: settle the opposed check` },
      rejectClose: false,
      ok: { label: loc`Settle` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Both sides roll Athletics (Str); the Grasp tag and the Armor Check Penalty tag apply. The bigger character adds +4 for each Size category of difference (p.356). Enter the two results.`}</p><label><input type="checkbox" name="opening" checked /> ${loc`This check starts the grapple`}</label><label>${loc`Your result`} <input type="number" name="total" step="1" required /></label><label>${loc`Opponent's result`} <input type="number" name="opponentTotal" step="1" required /></label><label><input type="checkbox" name="critical" /> ${loc`Your critical success`}</label><label><input type="checkbox" name="criticalFailure" /> ${loc`Your critical failure`}</label><label><input type="checkbox" name="opponentCritical" /> ${loc`Opponent's critical success`}</label><label><input type="checkbox" name="opponentCriticalFailure" /> ${loc`Opponent's critical failure`}</label><label>${loc`Size categories you are bigger by (negative when smaller), for reference`} <input type="number" name="sizeDifference" value="0" step="1" /></label></div>`
    });
    if (!input) return null;
    input = {
      ...input,
      total: Number(input.total),
      opponentTotal: Number(input.opponentTotal),
      sizeDifference: Number(input.sizeDifference) || 0
    };
  }
  let outcome;
  try {
    outcome = grappleOutcome(input);
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  const sizeBonus = grappleSizeBonus(Math.abs(input.sizeDifference ?? 0));
  const benefits = outcome.benefits
    ? [
        loc`Grapple benefits to choose from:`,
        `<ul>${GRAPPLE_BENEFITS.map(benefit => grappleBenefitText(benefit.id))
          .map(([name, summary]) => `<li><b>${esc(name)}</b> — ${esc(summary)}</li>`)
          .join("")}</ul>`
      ]
    : [];
  const tricks = grappleTrickLines(actor.system);
  if (tricks.length)
    benefits.push(loc`Your grapple tricks:`, `<ul>${tricks.map(line => `<li>${esc(line)}</li>`).join("")}</ul>`);
  await post(actor, [
    loc`Grapple: ${input.total} against ${input.opponentTotal}.`,
    ...outcome.effects.map(esc),
    sizeBonus ? loc`Size: the bigger character's result includes +${sizeBonus}.` : "",
    ...benefits,
    loc`Record Held, Pinned, Sprawled or Flat-footed with the sheet's condition controls.`
  ]);
  return outcome;
}
