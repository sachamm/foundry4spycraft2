/**
 * Reservations that must be held while a roll is made.
 * Each entry returns a function when its reservation is still needed; the roll re-enters with the lease added.
 * A reroll reuses the original roll's reservation, so none is taken for it.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { hasAttackDamageLease, withAttackDamageBenefit } from "../apps/attack-damage-benefits.mjs";
import { hasFeintBonusLease, withFeintAttackBonus } from "../apps/feint-bonus.mjs";
import { hasSideStanceDamageLease, withSideStanceDamage } from "../apps/side-stance-damage.mjs";
import { hasSideStanceLease, withSideStanceAttack } from "../apps/side-stance.mjs";

rollPipeline.register({
  id: "feintBonusLease",
  acquire({ actor, options }) {
    const proof = options.attackContext?.feintBonus;
    if (proof?.attackBonus !== 2 || options.rerollOf || hasFeintBonusLease(actor, proof, options.feintBonusLease))
      return null;
    return next => withFeintAttackBonus(actor, proof, lease => next({ feintBonusLease: lease }));
  }
});

rollPipeline.register({
  id: "attackDamageLease",
  acquire({ actor, options }) {
    const proof = options.attackDamageBenefit;
    if (!proof || options.rerollOf || hasAttackDamageLease(actor, proof, options.attackDamageLease)) return null;
    return next => withAttackDamageBenefit(actor, proof, lease => next({ attackDamageLease: lease }));
  }
});

rollPipeline.register({
  id: "sideStanceLease",
  acquire({ actor, options }) {
    const proof = options.attackContext?.sideStance;
    if (proof?.dice !== 1 || options.rerollOf || hasSideStanceLease(actor, proof, options.sideStanceLease)) return null;
    return next => withSideStanceAttack(actor, proof, lease => next({ sideStanceLease: lease }));
  }
});

rollPipeline.register({
  id: "sideStanceDamageLease",
  acquire({ actor, options }) {
    const proof = options.sideStanceDamage;
    if (!proof || options.rerollOf || hasSideStanceDamageLease(actor, proof, options.sideStanceDamageLease))
      return null;
    return next => withSideStanceDamage(actor, proof, lease => next({ sideStanceDamageLease: lease }));
  }
});
