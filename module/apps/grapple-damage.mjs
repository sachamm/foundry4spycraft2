import { grappleDamagePlan, grappleDamageAward, GRAPPLE_DAMAGE_BENEFITS } from "../rules/grapple-damage.mjs";
import { grappleBenefitText } from "../rules/combat-actions.mjs";
import { sameValues } from "../rules/equal.mjs";
import { weaponGrip } from "../rules/weapon-use.mjs";
import {
  reserveGrappleDamage,
  validateGrappleDamage,
  recordGrappleDamageDice,
  settleGrappleDamageRoll,
  reviewGrappleDamage
} from "../documents/actor/grapple-damage.mjs";
import { weaponAmmunition, spendWeaponShots } from "./ammunition-use.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

export async function rollGrappleBenefitDamage(source, index, options = {}) {
  const actor = await fromUuid(source.flags?.spycraft2?.grappleBenefits?.winnerUuid);
  if (!actor?.isOwner) throw Error(loc`The winner's owner or GC rolls its earned grapple damage.`);
  const award = grappleDamageAward(source, index, actor.uuid),
    benefit = award.benefit;
  const opponent = await fromUuid(award.targetUuid);
  if (!opponent) throw Error(loc`The recorded grapple opponent is unavailable.`);
  const owner = benefit === "useWeapon" ? opponent : actor;
  const weapons = [...(owner.items ?? [])].filter(
    i => i.type === "weapon" && i.system.equipped === true && weaponGrip(actor.system, i.system).required === 1
  );
  let input = options;
  if (!["sprawl", "throw"].includes(benefit) && !Object.keys(input).length) {
    input = await systemDialog.input({
      window: { title: loc`${grappleBenefitText(benefit)[0]}: earned damage` },
      rejectClose: false,
      ok: { label: loc`Roll this benefit's damage` },
      content: `<div class="spycraft2-roll-options"><p>${loc`One original damage roll is available for this earned benefit against ${opponent.name}. Deleted or interrupted dice are recovered by the GC; they are not rolled again.`}</p><label>${loc`Actual readied weapon`} <select name="weaponUuid"${benefit === "useWeapon" ? " required" : ""}><option value="">${benefit === "useWeapon" ? loc`Choose the opponent's weapon…` : loc`Standard unarmed damage`}</option>${weapons.map(i => `<option value="${esc(i.uuid)}">${esc(i.name)}</option>`).join("")}</select></label><label>${loc`Damage type`} <select name="kind"><option value="">${loc`Its normal damage type`}</option><option value="lethal">${loc`Lethal`}</option><option value="subdual">${loc`Subdual`}</option></select></label><label><input name="conversionConfirmed" type="checkbox" /> ${loc`If changing damage type, the opposed Athletics check included the actual conversion penalty or an applicable feat waiver.`}</label></div>`
    });
    if (!input) return null;
  }
  const selection = {
    weaponUuid: input.weaponUuid ?? "",
    kind: input.kind ?? "",
    conversionConfirmed: input.conversionConfirmed === true
  };
  const selected = selection.weaponUuid ? await fromUuid(selection.weaponUuid) : null;
  if (selection.weaponUuid && (!selected || selected.parent?.uuid !== owner.uuid))
    throw Error(loc`Use the actual weapon belonging to the grapple participant named by this benefit.`);
  const planNow = () => {
    const weapon = selection.weaponUuid
      ? (owner.items.get?.(selected?.id) ?? [...owner.items].find(i => i.uuid === selection.weaponUuid))
      : null;
    if (selection.weaponUuid && !weapon) throw Error(loc`The selected grapple weapon is no longer available.`);
    return grappleDamagePlan(actor.system, benefit, {
      weapon,
      kind: selection.kind,
      conversionConfirmed: selection.conversionConfirmed,
      actorType: actor.type
    });
  };
  const plan = planNow(),
    ammunition = selected && weaponAmmunition(selected);
  if (ammunition && (!owner.isOwner || ammunition.loaded < 1))
    throw Error(loc`The weapon's owner or GC must confirm a loaded shot before this grapple damage is rolled.`);
  const proof = await reserveGrappleDamage(actor, source, index, plan, selection, {
    resources: ammunition ? [owner] : [],
    validate: () => {
      if (!sameValues(planNow(), plan)) throw Error(loc`The grapple damage changed before its roll.`);
    },
    prepare: ammunition
      ? async () => {
          const spent = await spendWeaponShots(selected, 1);
          if (!spent) throw Error(loc`Review this benefit's ammunition before rolling any damage.`);
          return { weaponUuid: selected.uuid, ammunition: spent };
        }
      : null
  });
  try {
    const result = await actor.rollCheck(
      plan.formula,
      {},
      {
        checkKind: "damage",
        checkId: "grapple-benefit",
        threat: 0,
        error: 0,
        grappleDamage: proof,
        weaponUuid: plan.weaponUuid,
        weaponProficiency: plan.weaponProficiency,
        weaponDamageText: `${plan.formula} ${plan.profile.kind}`,
        conditionDamageIncluded: plan.conditionDamageIncluded,
        conditionDamagePenalty: plan.conditionDamagePenalty ?? 0,
        validateAttackContext: () => validateGrappleDamage(actor, proof, planNow()),
        recordRolledResult: result => recordGrappleDamageDice(actor, proof, result),
        flavor: loc`${grappleBenefitText(benefit)[0]}: earned damage against ${esc(opponent.name)}. ${plan.formula}; ${plan.profile.kind}.`,
        actionDiceAllowed: true
      }
    );
    return (await settleGrappleDamageRoll(actor, proof)) ?? result;
  } catch (error) {
    const posted = await settleGrappleDamageRoll(actor, proof);
    if (posted) return posted;
    throw error;
  }
}

async function reviewOriginalDamage(actor, source) {
  const rows = Object.entries(actor.flags?.spycraft2?.grappleDamage ?? {}).filter(
    ([, r]) => r.proof.sourceUuid === source.uuid
  );
  if (!rows.length) return null;
  const input = await systemDialog.input({
    window: { title: loc`Review original grapple damage` },
    rejectClose: false,
    ok: { label: loc`Record review` },
    content: `<div class="spycraft2-roll-options"><label>${loc`Earned benefit`} <select name="key">${rows.map(([key, row]) => `<option value="${esc(key)}">${esc(grappleBenefitText(row.proof.benefit)[0])} ${row.proof.index + 1}: ${esc(row.state)}</option>`).join("")}</select></label><label>${loc`Decision`} <select name="decision"><option value="restore">${loc`Restore the saved actual dice; no new roll`}</option><option value="keep">${loc`Keep this benefit consumed after reviewing its actual effects`}</option></select></label><label>${loc`Actual effects and review note`} <textarea name="note" maxlength="2048"></textarea></label></div>`
  });
  return input ? reviewGrappleDamage(actor, input.key, input) : null;
}

export const grappleBenefitDamageContributor = {
  id: "grappleBenefitDamage",
  order: 9601,
  record: ["grappleDamage"],
  flags: ({ actor, options, checkKind }) => {
    if (checkKind !== "damage" || !options.grappleDamage) return null;
    const row = actor.flags?.spycraft2?.grappleDamage?.[options.grappleDamage.key];
    return row ? { damageProfile: structuredClone(row.plan.profile) } : null;
  },
  chatControls({ actor, message, check, user }) {
    const award = check.grappleBenefits;
    if (!actor?.isOwner || !award || check.checkKind !== "grappleBenefits" || award.winnerUuid !== actor.uuid)
      return null;
    const controls = [];
    for (const [index, benefit] of award.benefits.entries()) {
      if (!GRAPPLE_DAMAGE_BENEFITS.includes(benefit)) continue;
      const row = actor.flags?.spycraft2?.grappleDamage?.[`${message.id}-${index}`];
      if (!row || row.state === "cancelled")
        controls.push({
          label: loc`Roll ${grappleBenefitText(benefit)[0]} damage (${index + 1})`,
          placement: "card",
          ...(controls.length ? {} : { emphasis: "primary" }),
          run: () => rollGrappleBenefitDamage(message, index)
        });
    }
    if (
      user?.isGM &&
      Object.values(actor.flags?.spycraft2?.grappleDamage ?? {}).some(r => r.proof.sourceUuid === message.uuid)
    )
      controls.push({
        label: loc`GC: review original grapple damage`,
        placement: "card",
        run: () => reviewOriginalDamage(actor, message)
      });
    return controls;
  }
};
