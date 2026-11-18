/**
 * Bounce, a proficiency trick (p.355): a hurled-weapon attack ricochets off up to the attacker's Dexterity bonus in
 * surfaces, at −2 attack and +1 error range for each. Grenade Basics (p.181) reduces the attack penalty by 2 when
 * throwing a grenade; Flamethrower Basics (p.181) lets the character Bounce a flamethrower attack.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const hurled = weapon => ["hurled", "exoticHurled"].includes(weapon?.proficiency);
const grenade = weapon => /grenade/i.test(weapon?.name ?? "");

export function bounceAllowed(system, weapon) {
  if (weapon?.weaponCategory === "flamethrower")
    return system?.activeFeatNames?.includes("Flamethrower Basics") === true;
  return hurled(weapon) && system?.proficiencyTotals?.[weapon.proficiency]?.proficient !== false;
}

export function bouncePlan(system, weapon, { bounceSurfaces = 0 } = {}) {
  const n = Number(bounceSurfaces) || 0;
  if (!n) return null;
  if (!bounceAllowed(system, weapon))
    return { blocked: true, reason: loc`Bounce needs a hurled weapon you are proficient with.` };
  const most = Math.max(0, Number(system?.abilities?.dex?.mod) || 0);
  if (!Number.isSafeInteger(n) || n < 0 || n > most)
    return { blocked: true, reason: loc`Bounce off 1 to ${most} surfaces (your Dexterity bonus).` };
  const reduction = grenade(weapon) && system.activeFeatNames?.includes("Grenade Basics") ? 2 : 0,
    attack = -Math.max(0, 2 * n - reduction);
  return {
    blocked: false,
    version: 1,
    surfaces: n,
    attack,
    error: n,
    note: loc`Bounce: off ${n} surface(s); attack ${attack}${reduction ? loc` (Grenade Basics takes 2 off)` : ""}, error range +${n} (p.355).`
  };
}

rollPipeline.register({
  id: "bounceContent:rangedAttack",
  dialogs: ["rangedAttack"],
  order: 77,
  dialog: ({ actor, item }) => [
    {
      at: 67,
      html: bounceAllowed(actor?.system, { ...item?.system, name: item?.name })
        ? `<label>${loc`Bounce: surfaces to ricochet off (up to your Dexterity bonus)`} <input type="number" name="bounceSurfaces" min="0" max="${Math.max(0, actor.system.abilities?.dex?.mod ?? 0)}" step="1" value="0" /></label>`
        : ""
    }
  ],
  read: ({ entered }) => {
    const n = Number(entered?.bounceSurfaces);
    return Number.isSafeInteger(n) && n > 0 ? { bounceSurfaces: n } : null;
  }
});

rollPipeline.register({
  id: "bounceAttackTerm",
  kinds: ["attack"],
  order: 9195,
  terms({ system, weapon, options }) {
    const plan = bouncePlan(system, weapon, { bounceSurfaces: options.bounceSurfaces ?? 0 });
    if (!plan) return null;
    return {
      key: "bounce",
      plan: plan.blocked ? null : plan,
      rowAt: 291,
      rows: plan.blocked ? [] : [[loc`Bounce`, plan.attack]],
      error: plan.blocked ? 0 : plan.error,
      blockAt: 202,
      blocked: plan.blocked ? plan.reason : "",
      noteAt: 503,
      notes: plan.blocked ? [] : [plan.note]
    };
  }
});
