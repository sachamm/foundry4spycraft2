/**
 * GC action dice spent straight from an NPC's roll card.
 *
 * NPCs have no action dice of their own; the GC spends from the session pool (pp.397–399, 452). On an NPC's open
 * attack, skill or save card the GC gets two buttons:
 *  - "GC boost (+1dN)" pays one die, rolls the NPC's die type and adds it to the card's total;
 *  - "Activate threat (GC dice)" pays for a confirmed threat and marks the card as a critical success, so the damage roll
 *    and its application carry the critical hit on.
 * Both go through spendGCDice, which checks the pool, the NPC's qualities and posts the spend to the GC.
 */
import { triumphAt } from "../../rules/check-candidates.mjs";
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { gcDieType } from "../../rules/gc/gc-spend.mjs";
import { npcIsSpecial, spendProfile } from "./npc-play.mjs";
import { threatsAutoActivate } from "../../rules/campaign-rules.mjs";
import { spendGCDice } from "./spend.mjs";
import { resolveSkillResult } from "../../rules/checks.mjs";
import { loc } from "../../i18n.mjs";
import { esc } from "../../html.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { criticalHitChoices, npcCriticalPrice } from "../../rules/critical-effects.mjs";
import { checkFlavor } from "../../rules/outcomes.mjs";

/** NPC skill rolls are posted as plain checks that name the skill (module/apps/gc/npc-play.mjs). */
const npcCheckKind = check =>
  ["attack", "skill", "save", "ability", "knowledge"].includes(check.checkKind) || !!check.npcSkill;
/** An activated critical failure can no longer be boosted (the same rule as an agent's boost). */
export const gcBoostable = check =>
  Number.isFinite(check?.rawTotal) && !check.resolved && !check.superseded && !check.criticalFailure;
const npcOpen = ({ check, actor, user }) =>
  user?.isGM === true &&
  actor?.type === "npc" &&
  Number.isFinite(check.rawTotal) &&
  !check.resolved &&
  !check.superseded &&
  npcCheckKind(check);

/**
 * Add a GC boost to the card. The boost is kept in the card's flags, like an agent's boost, and the result is worked
 * out again through the cap, threat and Triumph rules. The card's content is left alone: a roll card shows its dice
 * breakdown only while its content is plain, so appending a line there would hide the dice.
 */
export async function gcBoostCard(message, actor) {
  if (!gcBoostable(message.flags?.spycraft2)) {
    ui.notifications.warn(loc`This card can no longer be boosted.`);
    return null;
  }
  const result = await spendGCDice({ id: "boostRoll", actor, onCard: true });
  if (!result?.die) return null;
  const check = message.flags.spycraft2,
    boostTotal = (check.boostTotal ?? 0) + result.die.total,
    resolved = resolveSkillResult(check.rawTotal, check.naturalDie, {
      cap: check.cap ?? null,
      threat: check.threat ?? 0,
      actionDieBonus: boostTotal,
      triumphAt: triumphAt(check),
      ceiling: check.resultCeiling ?? null
    });
  await message.update({
    "flags.spycraft2.effectiveTotal": resolved.total,
    "flags.spycraft2.boostTotal": boostTotal,
    "flags.spycraft2.capped": resolved.limited,
    "flags.spycraft2.potentialTriumph": ["skill", "knowledge", "attack"].includes(check.checkKind) && resolved.triumph,
    "flags.spycraft2.gcBoosts": [...(check.gcBoosts ?? []), result.die.total],
    flavor: checkFlavor({
      ...check,
      effectiveTotal: resolved.total,
      boostTotal,
      capped: resolved.limited,
      gcBoosts: [...(check.gcBoosts ?? []), result.die.total]
    })
  });
  return resolved.total;
}

/** Whether this NPC may have its attack criticals activated at all (special, or treacherous; p.452). */
const attackCriticalAllowed = actor => {
  try {
    const profile = spendProfile(actor);
    return profile.type === "special" || profile.treacherous === true;
  } catch {
    return false;
  }
};

/**
 * Why this NPC may not have this card's critical activated, or "" when it may (p.452): a standard NPC needs the
 * treacherous quality for an attack and the prodigy quality for a skill check. Bloodbath makes a special
 * character's attack critical on its own.
 */
function criticalRefusal(check, actor) {
  let profile;
  try {
    profile = spendProfile(actor);
  } catch {
    return "";
  }
  if (profile.type === "special") return "";
  const attack = check.checkKind === "attack";
  if (attack ? profile.treacherous === true : profile.prodigy === true) return "";
  return attack
    ? loc`A standard NPC needs the treacherous quality for a critical hit (p.452)`
    : loc`A standard NPC needs the prodigy quality for a critical success (p.452)`;
}

/** The price of each critical hit on the p.329 list for this NPC's attack, after its discounts and surcharges. */
const pricedChoices = (check, terms) =>
  criticalHitChoices(check).map(choice => ({ ...choice, price: npcCriticalPrice(check, choice.cost, terms) }));

/** Ask which critical hit an NPC's attack buys (p.329), at what the GC pays for it; null when the GC backs out. */
async function chooseNpcCritical(check, terms, preset) {
  const choices = pricedChoices(check, terms);
  if (!choices.length) return null;
  if (preset) return choices.find(choice => choice.id === preset) ?? null;
  const dice = n => (n === 1 ? loc`1 die` : loc`${n} dice`);
  const picked = await systemDialog.input({
    window: { title: loc`Activate the NPC's critical hit` },
    rejectClose: false,
    ok: { label: loc`Activate critical hit` },
    content: `<div class="spycraft2-roll-options"><label>${loc`Effect`} <select name="preset">${choices
      .map(
        choice =>
          `<option value="${esc(choice.id)}">${esc(`${choice.price.cost ? dice(choice.price.cost) : loc`Free`} — ${choice.label}`)}</option>`
      )
      .join("")}</select></label>${
      choices[0].price.sources.length
        ? `<p class="hint">${esc(loc`Price changes: ${choices[0].price.sources.join("; ")}.`)}</p>`
        : ""
    }<p class="hint">${loc`Choose by the target: a special character with vitality left, one at 0 vitality, or a standard character (p.329).`}</p></div>`
  });
  return picked ? (choices.find(choice => choice.id === picked.preset) ?? null) : null;
}

/**
 * Pay for an NPC's confirmed threat from the GC pool and record the critical on its card. An attack's critical is
 * chosen from the p.329 list at its own price; a skill check's costs 1 die. Laser damage, Tough Luck, a Henchman or
 * Mastermind target and Bloodbath change the price (npcCriticalPrice); a price of 0 is recorded without a spend.
 */
export async function gcActivateThreat(message, actor, { preset = null } = {}) {
  const check = message.flags.spycraft2,
    attack = check.checkKind === "attack",
    allowed = attack ? attackCriticalAllowed(actor) : true,
    terms = {
      // Laser damage (p.338) only helps an NPC that may activate attack criticals at all.
      laser: attack && check.attackContext?.laser === true && allowed,
      // Bloodbath (p.406): a special character's attack threat becomes a critical hit without paying a die.
      bloodbath: attack && threatsAutoActivate() && !!actor && npcIsSpecial(actor)
    };
  const choice = attack ? await chooseNpcCritical(check, terms, preset) : null;
  if (attack && !choice) return null;
  const price = choice?.price ?? npcCriticalPrice(check, 1, terms);
  const record = async cost => {
    const criticalActivation = {
        cost,
        payer: "gc",
        ...(choice ? { kind: "success", effect: choice.label, preset: choice.id, baseCost: choice.cost } : {}),
        ...(price.sources.length ? { sources: price.sources } : {})
      },
      next = { ...check, criticalSuccess: true, criticalActivation };
    await message.update({
      "flags.spycraft2.criticalSuccess": true,
      "flags.spycraft2.criticalActivation": criticalActivation,
      flavor: checkFlavor(next)
    });
    return true;
  };
  if (price.cost === 0) {
    // A free critical still needs an NPC that may score one (p.452); Bloodbath is its own permission.
    if (!terms.bloodbath && !allowed) {
      ui.notifications.warn(
        loc`A standard NPC needs the treacherous quality before the GC may activate its critical hits (p.452).`
      );
      return null;
    }
    return record(0);
  }
  const result = await spendGCDice({
    id: "activateThreat",
    actor,
    onCard: true,
    dice: price.cost,
    checkKind: attack ? "attack" : "skill"
  });
  if (!result?.plan) return null;
  return record(result.plan.cost);
}

rollPipeline.register({
  id: "gcNpcDiceControl",
  order: 9136,
  chatControls(ctx) {
    if (!npcOpen(ctx)) return null;
    const { message, check, actor } = ctx;
    let die = 4;
    try {
      die = gcDieType(spendProfile(actor));
    } catch {
      /* an incomplete NPC profile rolls the basic die */
    }
    const controls = gcBoostable(check)
      ? [
          {
            label: loc`GC boost (+1d${die})`,
            key: "gcBoost",
            placement: "card",
            run: () => gcBoostCard(message, actor)
          }
        ]
      : [];
    if (check.threatConfirmed && !check.criticalSuccess && !check.criticalFailure)
      controls.unshift({
        label: loc`Activate threat (GC dice)`,
        placement: "card",
        disabled: criticalRefusal(check, actor),
        run: () => gcActivateThreat(message, actor)
      });
    return controls.length ? controls : null;
  }
});
