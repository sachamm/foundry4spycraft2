/** Baseline combat actions in play: the dialog sections that declare them and the buttons that settle them. */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
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
  grappleBenefitChanges,
  grappleBenefitText,
  grappleOutcome,
  grappleSizeBonus,
  strafeHits
} from "../rules/combat-actions.mjs";
import { parseAmmunitionCode } from "../rules/ammunition.mjs";
import { grappleTrickLines } from "../rules/grapple-tricks.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { spendWeaponShots, weaponAmmunition } from "./ammunition-use.mjs";
import { recentResults, recentResultsHint } from "./opposed-checks.mjs";
import { grappleBenefitDamage, grappleCardFacts } from "../rules/grapple-check.mjs";
import { drForAttack } from "../rules/damage-application.mjs";
import { rollTotal } from "./hazards.mjs";
import { nonLethalDamage } from "./non-lethal-damage.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { askGC, gcAvailable, registerRelay } from "./gc-relay.mjs";
import { loc } from "../i18n.mjs";
import { withUndo } from "./undo.mjs";

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
    counted = weaponAmmunition(item),
    capacity = counted ? counted.loaded : (parseAmmunitionCode(item?.system?.ammo)?.capacity ?? "");
  const option = (value, label, show = true) => (show ? `<option value="${value}">${label}</option>` : "");
  return `<fieldset class="spycraft2-fire-action"><legend>${loc`Fire action`}</legend><label>${loc`Action`} <select name="fireAction">${option("", loc`One attack, as declared above`)}${option("burst", loc`Burst — Burst mode, 3 shots, error +1 (a Standard Attack)`, modes.includes("burst"))}${option("twoShotBurst", loc`Two-Shot Burst — Single-Shot or Burst mode, 2 shots, at most 2 hits (Autofire Basics)`, (modes.includes("single") || modes.includes("burst")) && actor?.system?.activeFeatNames?.includes("Autofire Basics") === true)}${option("autofire", loc`Autofire — Full Auto, 3 shots a volley, –1 a volley, error +2`, modes.includes("auto"))}${option("strafe", loc`Strafe — Full Auto, 3 shots a square, recoil doubled, error +2`, modes.includes("auto"))}${option("coverFire", loc`Cover Fire — 5 shots, the target saves (no attack check)`)}${option("suppressiveFire", loc`Suppressive Fire — 5 shots at an empty square (no attack check)`)}${option("suppressiveFinal", loc`Final attack from Suppressive Fire — 1 shot, –4`)}</select></label><label>${loc`Volleys (Autofire) or squares (Strafe)`} <input type="number" name="fireCount" min="1" max="100" step="1" /></label><label>${loc`Shots left in the weapon`} <input type="number" name="shotsRemaining" min="0" step="1" value="${capacity}"${counted ? " readonly" : ""} /></label><p class="hint">${counted ? loc`Burst, Autofire and Strafe set the fire mode they need. The shots fired are taken from the weapon.` : loc`Burst, Autofire and Strafe set the fire mode they need. Shots are not deducted for you.`}</p></fieldset>`;
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
    return refuse(loc`Cover Fire reaches half the weapon's maximum range: ${Math.floor(preview.maximumRange / 2)} ft.`);
  const shots = whole(input.shotsRemaining);
  if (shots !== null && shots < COVER_FIRE.shots) return refuse(loc`Cover Fire takes 5 shots.`);
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
  await spendWeaponShots(item, COVER_FIRE.shots);
  // The result names the fire action, so the sheet records a full action for it.
  const save = target?.isOwner
    ? await target.rollSave("will", {
        askContext: true,
        hazardSave: { kind: "coverFire", label: loc`Cover Fire`, dc, attackerName: actor.name }
      })
    : null;
  return { fireAction: "coverFire", save };
}

/** Suppressive Fire: no attack check now; final attacks follow as opponents cross the square. */
export async function suppressiveFire(actor, item, input = {}) {
  const shots = whole(input.shotsRemaining);
  if (shots !== null && shots < SUPPRESSIVE_FIRE.shots) return refuse(loc`Suppressive Fire takes 5 shots.`);
  await post(actor, [
    loc`Suppressive Fire with ${esc(item.name)}: 5 shots into an empty square within maximum range. For a round, anyone hostile crossing the square draws a final attack at –4 (1 more shot each, no Aim) and takes –4 to attack and skill checks until the start of the attacker's next Initiative Count (p.361).`,
    loc`Roll each final attack from the ranged attack dialog with the fire action "Final attack from Suppressive Fire".`
  ]);
  await spendWeaponShots(item, SUPPRESSIVE_FIRE.shots);
  return { fireAction: "suppressiveFire" };
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
      return refuse(loc`Enter up to ${action.squares} Defense values, each 0 or more.`);
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
  if (defense < 0) return refuse(loc`Defense cannot be negative.`);
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

const grappleTargeted = () => {
  const targeted = [...(game.user?.targets ?? [])];
  return targeted.length === 1 ? (targeted[0].actor?.uuid ?? "") : "";
};

/** The conditions a grapple can set or clear on a character the player does not own. */
const GRAPPLE_CONDITIONS = ["held", "pinned", "sprawled", "prone", "mute", "vulnerable", "flat-footed"];

registerRelay("grappleCondition", {
  async describe({ actorUuid, id, active }, user) {
    const who = actorUuid ? await fromUuid(actorUuid) : null;
    if (!who) throw new Error(loc`That character is no longer there.`);
    if (!GRAPPLE_CONDITIONS.includes(id)) throw new Error(loc`A grapple cannot change that condition.`);
    return active
      ? loc`${esc(user.name)}'s grapple makes ${esc(who.name)} ${esc(id)}. Allow it?`
      : loc`${esc(user.name)}'s grapple ends ${esc(who.name)}'s ${esc(id)} condition. Allow it?`;
  },
  async run({ actorUuid, id, active, label }) {
    const who = actorUuid ? await fromUuid(actorUuid) : null;
    if (!who || !GRAPPLE_CONDITIONS.includes(id)) throw new Error(loc`A grapple cannot change that condition.`);
    // The label is free text from the player's client: keep it only when it is a short plain name.
    const plain = typeof label === "string" && /^[\p{L}\p{N} '’-]{1,60}$/u.test(label) ? label : id;
    await setConditionStatus(who, id, active === true, { label: plain });
    return true;
  }
});

/**
 * Set or clear a grapple condition: directly on a character this user owns, otherwise through the GC's client.
 * @returns {Promise<string>} the line that reports it
 */
async function changeGrappleCondition(who, id, active, label) {
  const name = esc(who?.name ?? loc`The other character`);
  if (!who) return active ? loc`${name}: set ${label} by hand.` : loc`${name}: clear ${label} by hand.`;
  try {
    if (who.isOwner) await setConditionStatus(who, id, active, { label });
    else if (gcAvailable()) await askGC("grappleCondition", { actorUuid: who.uuid, id, active, label });
    else return active ? loc`${name}: set ${label} by hand.` : loc`${name}: clear ${label} by hand.`;
    return active ? loc`${name} is now ${label.toLowerCase()}.` : loc`${name} is no longer ${label.toLowerCase()}.`;
  } catch (error) {
    return loc`${name}: ${label} could not be changed (${esc(error.message)}).`;
  }
}

/** Set the conditions an opening grapple check brings (p.356); the GC sets them on characters this user does not own. */
async function grappleConditions(actor, input, outcome) {
  if (!input.opening || outcome.winner === "tie") return [];
  const opponent = input.opponentUuid ? await fromUuid(input.opponentUuid) : null;
  const set = (who, id, label) => changeGrappleCondition(who, id, true, label);
  // Both wrestlers are vulnerable while the hold lasts: the held opponent through Held, the grappler directly (p.356).
  if (outcome.winner === "actor")
    return [
      await set(opponent, "held", loc`Held`),
      await set(actor, "vulnerable", loc`Vulnerable`),
      loc`Clear Vulnerable from ${esc(actor.name)} when the grapple ends.`
    ];
  const decisive = input.opponentCritical === true || input.criticalFailure === true;
  return [decisive ? await set(actor, "sprawled", loc`Sprawled`) : await set(actor, "flat-footed", loc`Flat-footed`)];
}

const CONDITION_LABELS = () => ({
  held: loc`Held`,
  pinned: loc`Pinned`,
  sprawled: loc`Sprawled`,
  prone: loc`Prone`,
  mute: loc`Mute`
});

/**
 * Let the winner of a grapple check take the benefits it earned, and change the conditions they bring on the
 * characters this user owns. `input.benefits` (a list of benefit ids) skips the dialog.
 */
async function grappleBenefitsChosen(actor, input, outcome) {
  if (!outcome.benefits || outcome.winner === "tie") return [];
  const opponent = input.opponentUuid ? await fromUuid(input.opponentUuid) : null;
  const winner = outcome.winner === "actor" ? actor : opponent,
    loser = outcome.winner === "actor" ? opponent : actor;
  let chosen = input.benefits;
  if (!Array.isArray(chosen)) {
    const list = GRAPPLE_BENEFITS.map(benefit => {
      const [name, summary] = grappleBenefitText(benefit.id);
      return `<option value="${benefit.id}">${esc(name)} — ${esc(summary)}</option>`;
    }).join("");
    const picked = await systemDialog.input({
      window: {
        title: loc`${winner?.name ?? loc`The opponent`}: ${outcome.benefits} grapple benefit(s)`
      },
      rejectClose: false,
      ok: { label: loc`Take` },
      content: `<div class="spycraft2-roll-options">${Array.from(
        { length: outcome.benefits },
        (_, index) =>
          `<label>${loc`Benefit ${index + 1}`} <select name="benefit${index}"><option value="">${loc`Decide later`}</option>${list}</select></label>`
      ).join(
        ""
      )}<p class="hint">${loc`Pin, Sprawl, Throw, Mute, Escape Hold and Break Pin change conditions on both characters; the GC is asked for a character you do not own. The others are carried out at the table.`}</p></div>`
    });
    if (!picked) return [];
    chosen = Array.from({ length: outcome.benefits }, (_, index) => picked[`benefit${index}`]).filter(Boolean);
  }
  if (!chosen.length) return [];
  const labels = CONDITION_LABELS(),
    lines = [
      loc`${esc(winner?.name ?? loc`The opponent`)} takes: ${chosen.map(id => esc(grappleBenefitText(id)[0])).join(", ")}.`
    ];
  for (const change of grappleBenefitChanges(chosen)) {
    const who = change.side === "winner" ? winner : loser,
      label = labels[change.id] ?? change.id;
    // Removing a condition the character does not have is nothing to report.
    if (!change.active && who && !who.statuses?.has(change.id)) continue;
    lines.push(await changeGrappleCondition(who, change.id, change.active, label));
  }
  for (const id of chosen) lines.push(...(await grappleBenefitHit(winner, loser, id)));
  if (chosen.includes("useWeapon")) lines.push(loc`Use Weapon: roll the damage from the weapon's card and apply it.`);
  return lines;
}

/** Whether a grapple winner deals lethal unarmed damage: an agent's Unarmed proficiency, or any armed NPC (p.453). */
const unarmedProficient = actor =>
  actor?.type === "agent"
    ? actor.system?.proficiencyTotals?.unarmed?.proficient === true
    : !(actor?.system?.qualities ?? []).some(quality => (quality?.id ?? quality) === "non-combatant");

/**
 * A grapple benefit's damage onto the loser, through the same steps as a damage card: damage reduction, then a
 * Damage save for a standard NPC, vitality and wounds (and a massive damage save) for a special character, or the
 * non-lethal totals. Run on the loser owner's client.
 */
export async function applyGrappleHit(loser, { amount, kind, name }) {
  const { lethalOnSpecial } = await import("./damage-application.mjs");
  const { npcDamageSave, npcIsSpecial } = await import("./gc/npc-play.mjs");
  if (kind === "subdual" && (loser.type === "agent" || npcIsSpecial(loser)))
    return (await nonLethalDamage(loser, "subdual", amount, { source: name, attackKind: "unarmed" })).lines;
  const dr = Math.max(0, Number(drForAttack(loser.system, "unarmed")) || 0);
  if (loser.type !== "agent" && !npcIsSpecial(loser)) {
    // A standard NPC or animal: its Damage save takes what gets past damage reduction (subdual counts it twice).
    const net = Math.max(0, amount - (kind === "subdual" ? 2 * dr : dr));
    if (!net) return [loc`${esc(loser.name)}: damage reduction ${dr} stops all ${amount} damage.`];
    const saved = await npcDamageSave(loser, { damage: net, kind });
    return saved ? [] : [loc`${esc(loser.name)}: ${net} damage after damage reduction; roll its Damage save.`];
  }
  const { lines, pendingSave } = await lethalOnSpecial(loser, { damage: amount, dr }, name);
  if (pendingSave) lines.push(loc`This calls for a Fortitude save against massive damage, DC ${pendingSave.dc}.`);
  return lines;
}

registerRelay("grappleDamage", {
  async describe({ actorUuid, amount, kind }, user) {
    const who = actorUuid ? await fromUuid(actorUuid) : null;
    if (!who) throw new Error(loc`That character is no longer there.`);
    return loc`${esc(user.name)}'s grapple deals ${esc(String(amount))} ${kind === "subdual" ? loc`subdual` : loc`lethal`} damage to ${esc(who.name)}. Allow it?`;
  },
  async run({ actorUuid, amount, kind, name }) {
    const who = actorUuid ? await fromUuid(actorUuid) : null;
    const whole = Math.trunc(Number(amount));
    if (!who || !Number.isSafeInteger(whole) || whole < 1 || whole > 200 || !["lethal", "subdual"].includes(kind))
      throw new Error(loc`That grapple damage cannot be applied.`);
    const plain = typeof name === "string" && /^[\p{L}\p{N} '’-]{1,60}$/u.test(name) ? name : loc`Grapple`;
    return withUndo([who], loc`Grapple damage: ${who.name}`, () =>
      applyGrappleHit(who, { amount: whole, kind, name: plain })
    );
  }
});

/**
 * Roll a damaging grapple benefit (Injure, Throw, Sprawl, pp.357–358) and apply it to the loser, inside the grapple's
 * Undo note when this user owns the loser, otherwise through the GC's client.
 */
async function grappleBenefitHit(winner, loser, id) {
  const damage = winner ? grappleBenefitDamage(winner.system, id, { proficient: unarmedProficient(winner) }) : null;
  if (!damage) return [];
  const [name] = grappleBenefitText(id),
    { total } = await rollTotal(damage.formula),
    amount = Math.max(damage.minimum, total);
  const rolled = loc`${esc(name)}: ${damage.formula} = ${amount} ${damage.kind === "subdual" ? loc`subdual` : loc`lethal`} damage.`;
  if (!loser) return [rolled, loc`Apply it to the opponent from the damage tools.`];
  try {
    if (loser.isOwner) return [rolled, ...(await applyGrappleHit(loser, { amount, kind: damage.kind, name }))];
    if (gcAvailable()) {
      const lines = await askGC("grappleDamage", { actorUuid: loser.uuid, amount, kind: damage.kind, name });
      return [rolled, ...(Array.isArray(lines) ? lines : [loc`Sent to the GC: damage to ${esc(loser.name)}.`])];
    }
  } catch (error) {
    return [rolled, loc`${esc(loser.name)}: the damage could not be applied (${esc(error.message)}).`];
  }
  return [rolled, loc`No GC is here: apply it to ${esc(loser.name)} by hand.`];
}

/** Settle one opposed grapple check and list the benefits the winner may choose from. */
/** Recent check cards a grapple can be settled from: this character's Grapple checks, and everyone else's results. */
function grappleCards(actor) {
  const rows = recentResults().filter(row => row.check),
    grappleFirst = (a, b) => Number(b.check.checkId === "grapple") - Number(a.check.checkId === "grapple");
  return {
    mine: rows.filter(row => row.check.actorUuid === actor.uuid && row.check.skillKey === "athletics"),
    theirs: rows.filter(row => row.check.actorUuid !== actor.uuid).sort(grappleFirst)
  };
}

const cardOption = row =>
  `<option value="${esc(row.uuid)}">${esc(row.name)} — ${row.total}${row.title ? ` (${esc(row.title)})` : ""}</option>`;

/**
 * Fill the totals, criticals and opponent from the picked check cards (U7). A card's total already holds its Size
 * bonus (p.357), so the bonus is reported, never added again. Typed fields stand in for a side with no card.
 */
export function grappleInputFromCards(input, rows) {
  const card = uuid => (uuid ? rows.find(row => row.uuid === uuid) : null),
    mine = card(input.cardUuid),
    theirs = card(input.opponentCardUuid),
    own = grappleCardFacts(mine?.check),
    other = grappleCardFacts(theirs?.check);
  const typed = value => (value === "" || value === null || value === undefined ? NaN : Number(value));
  return {
    ...input,
    total: own ? own.total : typed(input.total),
    opponentTotal: other ? other.total : typed(input.opponentTotal),
    critical: own ? own.critical : input.critical === true,
    criticalFailure: own ? own.criticalFailure : input.criticalFailure === true,
    opponentCritical: other ? other.critical : input.opponentCritical === true,
    opponentCriticalFailure: other ? other.criticalFailure : input.opponentCriticalFailure === true,
    opponentUuid: input.opponentUuid || theirs?.check?.actorUuid || "",
    sizeDifference: Number(input.sizeDifference) || 0,
    cardSizeBonus: own || other ? Math.max(own?.sizeBonus ?? 0, other?.sizeBonus ?? 0) : null
  };
}

export async function settleGrapple(actor, options = {}) {
  let input = options;
  if (input.total === undefined && input.cardUuid === undefined) {
    const cards = grappleCards(actor);
    input = await systemDialog.input({
      window: { title: loc`Grapple: settle the opposed check` },
      rejectClose: false,
      ok: { label: loc`Settle` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Pick the two Grapple check cards. Their totals, criticals and Size bonus are read from the cards (p.357).`}</p><label>${loc`Your Grapple check`} <select name="cardUuid">${cards.mine.map(cardOption).join("")}<option value="">${loc`Not on a card: type it below`}</option></select></label><label>${loc`Opponent's check`} <select name="opponentCardUuid">${cards.theirs.map(cardOption).join("")}<option value="">${loc`Not on a card: type it below`}</option></select></label><label>${loc`Opponent (to set conditions on a character you own)`} <select name="opponentUuid"><option value="">${loc`The one on the opponent's card`}</option>${attackCharacterTargetChoices()
        .filter(a => a.uuid !== actor.uuid)
        .map(
          a =>
            `<option value="${esc(a.uuid)}"${a.uuid === grappleTargeted() ? " selected" : ""}>${esc(a.name)}</option>`
        )
        .join(
          ""
        )}</select></label><label><input type="checkbox" name="opening" checked /> ${loc`This check starts the grapple`}</label><details><summary>${loc`Results not on a card`}</summary><p class="hint">${recentResultsHint()}</p><label>${loc`Your result`} <input type="number" name="total" step="1" /></label><label>${loc`Opponent's result`} <input type="number" name="opponentTotal" step="1" /></label><label><input type="checkbox" name="critical" /> ${loc`Your critical success`}</label><label><input type="checkbox" name="criticalFailure" /> ${loc`Your critical failure`}</label><label><input type="checkbox" name="opponentCritical" /> ${loc`Opponent's critical success`}</label><label><input type="checkbox" name="opponentCriticalFailure" /> ${loc`Opponent's critical failure`}</label><label>${loc`Size categories you are bigger by (negative when smaller), for reference`} <input type="number" name="sizeDifference" value="0" step="1" /></label><p class="hint">${loc`A typed result already includes the bigger side's +4 per Size category; do not add it again.`}</p></details></div>`
    });
    if (!input) return null;
  }
  if (input.cardUuid !== undefined || input.opponentCardUuid !== undefined)
    input = grappleInputFromCards(
      input,
      recentResults().filter(row => row.check)
    );
  else
    input = {
      ...input,
      total: Number(input.total),
      opponentTotal: Number(input.opponentTotal),
      sizeDifference: Number(input.sizeDifference) || 0
    };
  let outcome;
  try {
    outcome = grappleOutcome(input);
  } catch (error) {
    return refuse(error.message);
  }
  const sizeBonus = Number.isFinite(input.cardSizeBonus)
    ? input.cardSizeBonus
    : grappleSizeBonus(Math.abs(input.sizeDifference ?? 0));
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
  // Both wrestlers' conditions go on one Undo note.
  const opponent = input.opponentUuid ? await fromUuid(input.opponentUuid) : null;
  return withUndo([actor, opponent], loc`Grapple: ${actor.name}`, async () => {
    await post(actor, [
      loc`Grapple: ${input.total} against ${input.opponentTotal}.`,
      ...outcome.effects.map(esc),
      sizeBonus ? loc`Size: the bigger character's result includes +${sizeBonus}.` : "",
      ...benefits,
      ...(await grappleConditions(actor, input, outcome))
    ]);
    const taken = await grappleBenefitsChosen(actor, input, outcome);
    if (taken.length) await post(actor, taken);
    return outcome;
  });
}
