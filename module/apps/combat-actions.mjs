/** Baseline combat actions in play: the dialog sections that declare them and the buttons that settle them. */
import { esc } from "../html.mjs";
import { grappleBenefitDamageContributor } from "./grapple-damage.mjs";
import { refuse } from "../error-notices.mjs";
import { animalGrappleBenefitAllowed, validateAnimalGrapple } from "../rules/animal-grapple.mjs";
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
  grappleBenefitEligibility,
  grappleBenefitText,
  grappleOutcome,
  grappleOpeningContext,
  grappleSizeBonus,
  strafeHits
} from "../rules/combat-actions.mjs";
import { parseAmmunitionCode } from "../rules/ammunition.mjs";
import { grappleTrickLines } from "../rules/grapple-tricks.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import {
  spendWeaponShots,
  weaponAmmunition,
  weaponHasUnlimitedAmmunition,
  weaponShotsLeft
} from "./ammunition-use.mjs";
import { recentResults, recentResultsHint } from "./opposed-checks.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { askGC, gcAvailable, registerRelay } from "./gc-relay.mjs";
import { loc } from "../i18n.mjs";
import { grappleCardFacts } from "../rules/grapple-check.mjs";
import { withUndo } from "./undo.mjs";

const post = (actor, lines, flags = null) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    ...(flags ? { flags: { spycraft2: flags } } : {}),
    content: lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("")
  });
const whole = value => (value === "" || value === null || value === undefined ? null : Math.trunc(Number(value)));
rollPipeline.register(grappleBenefitDamageContributor);

/* -------------------------------------------- */
/*  Declaring a fire action                      */
/* -------------------------------------------- */

/** The ranged attack dialog's fire action section, for firearms that can fire more than one shot. */
export function fireActionContent(preview, item, actor = null) {
  if (!preview?.firearm && steelRainWeapon(actor?.system, item?.system)) return steelRainContent();
  if (!preview?.firearm) return "";
  const modes = preview.modes ?? [],
    counted = weaponAmmunition(item),
    known = weaponShotsLeft(item),
    bottomless = !counted && known !== null,
    capacity = weaponHasUnlimitedAmmunition(item)
      ? (weaponShotsLeft(item) ?? parseAmmunitionCode(item.system.ammo)?.capacity ?? "")
      : counted
        ? counted.loaded
        : (known ?? parseAmmunitionCode(item?.system?.ammo)?.capacity ?? "");
  const option = (value, label, show = true) => (show ? `<option value="${value}">${label}</option>` : "");
  return `<fieldset class="spycraft2-fire-action"><legend>${loc`Fire action`}</legend><label>${loc`Action`} <select name="fireAction">${option("", loc`One attack, as declared above`)}${option("burst", loc`Burst — Burst mode, 3 shots, error +1 (a Standard Attack)`, modes.includes("burst"))}${option("twoShotBurst", loc`Two-Shot Burst — Single-Shot or Burst mode, 2 shots, at most 2 hits (Autofire Basics)`, (modes.includes("single") || modes.includes("burst")) && actor?.system?.activeFeatNames?.includes("Autofire Basics") === true)}${option("autofire", loc`Autofire — Full Auto, 3 shots a volley, –1 a volley, error +2`, modes.includes("auto"))}${option("strafe", loc`Strafe — Full Auto, 3 shots a square, recoil doubled, error +2`, modes.includes("auto"))}${option("coverFire", loc`Cover Fire — 5 shots, the target saves (no attack check)`)}${option("suppressiveFire", loc`Suppressive Fire — 5 shots at an empty square (no attack check)`)}${option("suppressiveFinal", loc`Final attack from Suppressive Fire — 1 shot, –4`)}</select></label><label>${loc`Volleys (Autofire) or squares (Strafe)`} <input type="number" name="fireCount" min="1" max="100" step="1" /></label><label>${loc`Shots left in the weapon`} <input type="number" name="shotsRemaining" min="0" step="1" value="${capacity}"${known !== null || counted || weaponHasUnlimitedAmmunition(item) ? " readonly" : ""} /></label><p class="hint">${counted ? loc`Burst, Autofire and Strafe set the fire mode they need. The shots fired are taken from the weapon.` : bottomless ? loc`Bottomless Clip: this weapon retains its ammunition.` : loc`Burst, Autofire and Strafe set the fire mode they need. Shots are not deducted for you.`}</p></fieldset>`;
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

// The same section on the ordinary attack dialog, so an NPC's or a Play-tab attack reaches Burst, Autofire, Strafe,
// Cover Fire and Suppressive Fire from its one attack button.
rollPipeline.register({
  id: "fireActionContent:attack",
  dialogs: ["attack"],
  order: 9740,
  dialog: ({ actor, item }) => {
    let preview = null;
    try {
      preview = actor?.weaponAttack?.(item) ?? null;
    } catch {
      return null;
    }
    const html = fireActionContent(preview, item, actor);
    return html ? [{ at: 65, html }] : null;
  },
  read: ({ entered }) => fireActionInput(entered ?? {})
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
  const shots = weaponHasUnlimitedAmmunition(item) ? null : whole(input.shotsRemaining);
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
  const shots = weaponHasUnlimitedAmmunition(item) ? null : whole(input.shotsRemaining);
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
    await withUndo([who], loc`Grapple: ${who.name} ${plain}`, () =>
      setConditionStatus(who, id, active === true, { label: plain })
    );
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
    if (who.isOwner)
      await withUndo([who], loc`Grapple: ${who.name} ${label}`, () => setConditionStatus(who, id, active, { label }));
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
  let chosen = input.benefits,
    recipientUuids = input.benefitRecipients ?? [],
    recipientsConfirmed = input.benefitRecipientsConfirmed === true;
  if (!Array.isArray(chosen)) {
    const list = GRAPPLE_BENEFITS.filter(benefit => animalGrappleBenefitAllowed(winner?.system, benefit.id))
      .map(benefit => {
        const [name, summary] = grappleBenefitText(benefit.id);
        return `<option value="${benefit.id}">${esc(name)} — ${esc(summary)}</option>`;
      })
      .join("");
    const recipients = attackCharacterTargetChoices()
      .filter(a => a.uuid !== winner?.uuid && (a.statuses?.has("held") || a.statuses?.has("pinned")))
      .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
      .join("");
    const picked = await systemDialog.input({
      position: { width: 520, height: 600 },
      window: {
        title: loc`${winner?.name ?? loc`The opponent`}: ${outcome.benefits} grapple benefit(s)`
      },
      rejectClose: false,
      ok: { label: loc`Take` },
      content: `<div class="spycraft2-roll-options">${winner?.system?.npcType === "animal" ? `<p class="hint">${loc`Animal Grapple damage is unarmed. Equipment, gear manipulation and second opponents are unavailable (p.445).`}</p>` : ""}${Array.from(
        { length: outcome.benefits },
        (_, index) =>
          `<label>${loc`Benefit ${index + 1}`} <select name="benefit${index}"><option value="">${loc`Decide later`}</option>${list}</select></label>`
      ).join(
        ""
      )}<details><summary>${loc`Help another participant`}</summary><p class="hint">${loc`Break Pin and Escape Hold can help another character in this grapple. Other benefits use the winner and opponent.`}</p>${Array.from({ length: outcome.benefits }, (_, index) => `<label>${loc`Recipient for benefit ${index + 1}`} <select name="benefitRecipient${index}"><option value="">${esc(winner?.name ?? loc`The winner`)}</option>${recipients}</select></label>`).join("")}<label><input type="checkbox" name="benefitRecipientsConfirmed" /> ${loc`The GC confirms each selected recipient belongs to this grapple and reviews all sources of Held and Pinned`}</label></details><p class="hint">${loc`The GC is asked for condition changes on a character you do not own. Equipment choices and movement need table review.`}</p></div>`
    });
    if (!picked) return [];
    const slots = Array.from({ length: outcome.benefits }, (_, index) => index).filter(
      index => picked[`benefit${index}`]
    );
    chosen = slots.map(index => picked[`benefit${index}`]);
    recipientUuids = slots.map(index => picked[`benefitRecipient${index}`] || "");
    recipientsConfirmed = picked.benefitRecipientsConfirmed === true;
  }
  if (!chosen.length) return [];
  if (chosen.length > outcome.benefits || chosen.some(id => !GRAPPLE_BENEFITS.some(b => b.id === id)))
    throw new Error(loc`Choose only the number of listed grapple benefits actually earned.`);
  const labels = CONDITION_LABELS(),
    lines = [
      loc`${esc(winner?.name ?? loc`The opponent`)} takes: ${chosen.map(id => esc(grappleBenefitText(id)[0])).join(", ")}.`
    ];
  if (!Array.isArray(recipientUuids) || recipientUuids.length > chosen.length)
    throw Error(loc`Choose one recipient for each earned benefit.`);
  const recipients = await Promise.all(
    chosen.map(async (_id, index) => {
      const uuid = recipientUuids[index];
      if (!uuid || uuid === winner?.uuid) return winner;
      const recipient = await fromUuid(uuid);
      if (!recipient || !["agent", "npc"].includes(recipient.type))
        throw Error(loc`Choose an actual character participating in this grapple.`);
      return recipient;
    })
  );
  const eligibility = grappleBenefitEligibility(chosen, {
    winnerSystem: winner?.system,
    winnerUuid: winner?.uuid,
    loserUuid: loser?.uuid,
    winnerStatuses: winner?.statuses ?? [],
    loserStatuses: loser?.statuses ?? [],
    recipients: recipients.map(a => ({ uuid: a?.uuid, statuses: a?.statuses ?? [] })),
    recipientsConfirmed
  });
  await withUndo(
    [...new Set([winner, loser, ...recipients])].filter(who => who?.isOwner),
    loc`Grapple: ${actor.name}`,
    async () => {
      for (const [index, id] of chosen.entries()) {
        const recipient = recipients[index];
        if (["breakPin", "escape"].includes(id))
          lines.push(loc`${esc(grappleBenefitText(id)[0])}: ${esc(recipient?.name ?? loc`The winner`)}.`);
        for (const change of grappleBenefitChanges([id])) {
          const who = change.side === "winner" ? (["breakPin", "escape"].includes(id) ? recipient : winner) : loser,
            label = labels[change.id] ?? change.id;
          if (!change.active && who && !who.statuses?.has(change.id)) continue;
          lines.push(await changeGrappleCondition(who, change.id, change.active, label));
        }
        if (id === "escape")
          lines.push(
            loc`${esc(recipient?.name ?? loc`The freed participant`)} must immediately make a Standard Move of at least 5 ft., up to Speed. The GC reviews other holds, the group's exits in Initiative order and clearing Vulnerable when the grapple ends (p.357).`
          );
      }
    }
  );
  const strength = winner?.system?.abilities?.str?.mod;
  for (const id of chosen) {
    if (id === "sprawl")
      lines.push(
        Number.isFinite(strength)
          ? loc`Sprawl Opponent damage: 1d4 + (${strength}) subdual, before defenses; roll and apply this benefit once.`
          : loc`Sprawl Opponent: verify Strength, then roll 1d4 + Strength subdual damage before defenses.`
      );
    else if (id === "throw")
      lines.push(
        Number.isFinite(strength)
          ? loc`Throw damage: standard unarmed damage + ${Math.max(1, strength)} additional damage before defenses. The extra Strength bonus has a minimum of +1; use an empty adjacent destination.`
          : loc`Throw: verify standard unarmed damage and add the Strength bonus again, at least +1, before defenses. Use an empty adjacent destination.`
      );
    else if (["injure", "useWeapon"].includes(id))
      lines.push(
        loc`Roll the selected legal weapon or unarmed damage once for this benefit and apply it before defenses. Any lethal/subdual conversion penalty belongs on the opposed Athletics check, with the actual feat waiver.`
      );
  }
  return { lines, chosen, winner, loser, eligibility };
}

/** Settle one opposed grapple check and list the benefits the winner may choose from. */
const GRAPPLE_CARD_CHECKS = ["grapple", "restraint-escape"];

/** Recent check cards a grapple can be settled from: this character's Grapple checks, and everyone else's results. */
function grappleCards(actor) {
  const rows = recentResults().filter(row => row.check),
    grappleFirst = (a, b) => Number(b.check.checkId === "grapple") - Number(a.check.checkId === "grapple");
  return {
    // Only this character's Grapple or escape checks, so a later Climb or Jump is never the default.
    mine: rows.filter(row => row.check.actorUuid === actor.uuid && GRAPPLE_CARD_CHECKS.includes(row.check.checkId)),
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
    // The character's own card must be a Grapple or escape check; any other result is left for the typed total.
    found = card(input.cardUuid),
    mine = GRAPPLE_CARD_CHECKS.includes(found?.check?.checkId) ? found : null,
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
    cardSizeBonus: own || other ? Math.max(own?.sizeBonus ?? 0, other?.sizeBonus ?? 0) : null,
    convertDamage: own ? own.convertDamage : input.convertDamage === true,
    opponentConvertDamage: other ? other.convertDamage : input.opponentConvertDamage === true
  };
}

export async function settleGrapple(actor, options = {}) {
  if (!actor?.isOwner) return null;
  let input = options;
  if (input.total === undefined && !input.cardUuid && !input.opponentCardUuid) {
    const cards = grappleCards(actor);
    input = await systemDialog.input({
      window: { title: loc`Grapple: settle the opposed check` },
      rejectClose: false,
      ok: { label: loc`Settle` },
      content: `<div class="spycraft2-roll-options"><label>${loc`Your Grapple check card`} <select name="cardUuid"><option value="">${loc`Enter result below`}</option>${cards.mine.map(cardOption).join("")}</select></label><label>${loc`Opponent check card`} <select name="opponentCardUuid"><option value="">${loc`Enter result below`}</option>${cards.theirs.map(cardOption).join("")}</select></label><p>${loc`Both sides roll Athletics (Str); the Grasp tag and the Armor Check Penalty tag apply. The bigger character adds +4 for each Size category of difference (p.356). Enter the two results.`}</p><p class="hint">${recentResultsHint()}</p><label>${loc`Opponent (to set conditions on a character you own)`} <select name="opponentUuid"><option value="">${loc`Not listed`}</option>${attackCharacterTargetChoices()
        .filter(a => a.uuid !== actor.uuid)
        .map(
          a =>
            `<option value="${esc(a.uuid)}"${a.uuid === grappleTargeted() ? " selected" : ""}>${esc(a.name)}</option>`
        )
        .join(
          ""
        )}</select></label><label><input type="checkbox" name="opening" checked /> ${loc`This check starts the grapple`}</label><label>${loc`Your result`} <input type="number" name="total" step="1" /></label><label>${loc`Opponent's result`} <input type="number" name="opponentTotal" step="1" /></label><label><input type="checkbox" name="critical" /> ${loc`Your critical success`}</label><label><input type="checkbox" name="criticalFailure" /> ${loc`Your critical failure`}</label><label><input type="checkbox" name="opponentCritical" /> ${loc`Opponent's critical success`}</label><label><input type="checkbox" name="opponentCriticalFailure" /> ${loc`Opponent's critical failure`}</label><label>${loc`Size difference when a participant has no recorded Size (negative when smaller)`} <input type="number" name="sizeDifference" value="0" min="-9" max="9" step="1" /></label><label>${loc`Opponents I already hold`} <input name="heldOpponents" type="number" value="0" min="0" max="2" step="1" /></label><label><input name="secondOpponentBenefit" type="checkbox" /> ${loc`This opening uses an earned second-opponent benefit; my current opponent is held, not pinned, and my result includes the −4 Athletics penalty`}</label><label>${loc`Other characters already grappling this target`} <input name="otherGrapplers" type="number" value="0" min="0" max="7" step="1" /></label><p>${loc`Target smaller than you: at most 2 grapplers; same Size: 4; one Size larger: 8. The GC checks every participant when Sizes differ.`}</p><label><input name="grappleContextConfirmed" type="checkbox" /> ${loc`For an opening grapple, the GC confirms adjacency, current Sizes and the actual other-grappler count; recorded character Sizes take precedence`}</label></div>`
    });
    if (!input) return null;
    input = {
      ...input,
      total: Number(input.total),
      opponentTotal: Number(input.opponentTotal),
      sizeDifference: Number(input.sizeDifference),
      otherGrapplers: Number(input.otherGrapplers ?? 0),
      heldOpponents: Number(input.heldOpponents ?? 0)
    };
  }
  if (input.cardUuid || input.opponentCardUuid)
    input = grappleInputFromCards(
      input,
      recentResults().filter(row => row.check)
    );
  let outcome, openingContext;
  try {
    if (input.opening) {
      const opponent = input.opponentUuid ? await fromUuid(input.opponentUuid) : null;
      if (
        input.opponentUuid &&
        (!opponent || opponent.uuid === actor.uuid || !["agent", "npc"].includes(opponent.type))
      )
        throw new Error(loc`Choose the other current grapple participant.`);
      openingContext = grappleOpeningContext(actor.system, opponent?.system, input);
      input = { ...input, sizeDifference: openingContext.difference };
    }
    outcome = grappleOutcome(input);
    if (Array.isArray(input.benefits)) {
      const winner =
        outcome.winner === "actor" ? actor : input.opponentUuid ? await fromUuid(input.opponentUuid) : null;
      validateAnimalGrapple(winner?.system, { benefits: input.benefits });
    }
    if (
      Array.isArray(input.benefits) &&
      (input.benefits.length > outcome.benefits || input.benefits.some(id => !GRAPPLE_BENEFITS.some(b => b.id === id)))
    )
      throw new Error(loc`Choose only the number of listed grapple benefits actually earned.`);
  } catch (error) {
    return refuse(error.message);
  }
  const sizeBonus = input.cardSizeBonus ?? grappleSizeBonus(Math.abs(input.sizeDifference ?? 0));
  const winningSystem =
    outcome.winner === "actor"
      ? actor.system
      : input.opponentUuid
        ? (await fromUuid(input.opponentUuid))?.system
        : null;
  const selectableBenefits = GRAPPLE_BENEFITS.filter(benefit => animalGrappleBenefitAllowed(winningSystem, benefit.id));
  const benefits = outcome.benefits
    ? [
        loc`Grapple benefits to choose from:`,
        `<ul>${selectableBenefits
          .map(benefit => grappleBenefitText(benefit.id))
          .map(([name, summary]) => `<li><b>${esc(name)}</b> — ${esc(summary)}</li>`)
          .join("")}</ul>`
      ]
    : [];
  const tricks = grappleTrickLines(actor.system);
  if (tricks.length)
    benefits.push(loc`Your grapple tricks:`, `<ul>${tricks.map(line => `<li>${esc(line)}</li>`).join("")}</ul>`);
  await post(actor, [
    loc`Grapple: ${input.total} against ${input.opponentTotal}.`,
    openingContext
      ? openingContext.recorded
        ? loc`Opening Sizes: ${openingContext.size} against ${openingContext.otherSize}; adjacency confirmed.`
        : loc`Opening Size difference: ${openingContext.difference}; the GC confirmed unrecorded Sizes and adjacency.`
      : "",
    openingContext
      ? loc`This target has ${openingContext.grapplers} grappler(s), including this character, against a Size-based limit of ${openingContext.limit}.`
      : "",
    openingContext?.secondOpponent
      ? loc`Second-opponent benefit: the current opponent was held, not pinned, and the opposed Athletics result includes the −4 penalty.`
      : "",
    ...outcome.effects.map(esc),
    sizeBonus ? loc`Size: the bigger character's result includes +${sizeBonus}.` : "",
    ...benefits,
    ...(await withUndo(
      [actor, input.opponentUuid ? await fromUuid(input.opponentUuid) : null].filter(who => who?.isOwner),
      loc`Grapple: ${actor.name}`,
      () => grappleConditions(actor, input, outcome)
    ))
  ]);
  const taken = await grappleBenefitsChosen(actor, input, outcome);
  if (taken?.lines?.length)
    await post(
      actor,
      taken.lines,
      taken.winner && taken.loser
        ? {
            actorUuid: taken.winner.uuid,
            checkKind: "grappleBenefits",
            grappleBenefits: {
              version: 1,
              winnerUuid: taken.winner.uuid,
              loserUuid: taken.loser.uuid,
              benefits: taken.chosen,
              eligibility: taken.eligibility
            }
          }
        : null
    );
  return outcome;
}
