/** Attacks and damage. */
import { targetRoleCriticalRules, threatAgainstRole } from "../../rules/npc-qualities.mjs";
import { refuse } from "../../error-notices.mjs";
import { laserWeapon } from "../../rules/damage-types.mjs";
import { snakeStrikeOpen } from "../../rules/snake-strike.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { enhanceAttackDialog } from "../../apps/attack-dialog-ux.mjs";
import { rollPipeline } from "../../rolls/index.mjs";
import { reachIncreaseFeet } from "../../rules/reach.mjs";
import { reachContextInput } from "../../apps/reach.mjs";
import { whirlingAttackProof } from "../../apps/whirling-stance.mjs";
import { grantedMeleeQuality, meleeTrickSourceFacts } from "../../rules/melee-tricks.mjs";
import { eligibleAttackDamageHits, makeAttackDamageProof } from "../../apps/attack-damage-benefits.mjs";
import { grippingAttackProof } from "../../rules/gripping-stance.mjs";
import { eligibleSideStanceHits, makeSideStanceDamageProof } from "../../apps/side-stance-damage.mjs";
import { combatStanceProof } from "../../rules/combat-stance.mjs";
import { missTrickSourceFacts } from "../../rules/miss-tricks.mjs";
import { validateCheapShotTarget } from "../../apps/cheap-shot.mjs";
import {
  completeCharacterTarget,
  validateCharacterTarget,
  attackCharacterTargetChoices,
  observedAttackTargetChoices
} from "../../apps/character-target.mjs";
import { validateFinalRoundReservation } from "../../rules/final-round.mjs";
import { cqbRangePlan, recordedAttackDistance } from "../../rules/cqb.mjs";
import { damageTargetChoices, resolveDamageTarget, sneakAttackTargetSnapshot } from "../../apps/damage-target.mjs";
import { unnervingGrade, unnervingEligible, unnervingPlan } from "../../rules/unnerving.mjs";
import { hasSneakAttackSource, sneakAttackDamagePlan } from "../../rules/sneak-attack.mjs";
import { gameHunterAttack, cunningPlanEffect } from "../../rules/class-checks.mjs";
import { millionDollarSkillPlan } from "../../rules/sniper.mjs";
import { queueResources, isResourceLock } from "../../services/transactions.mjs";
import { specialistApplies } from "../../rules/weapon-specialist.mjs";
import { weaponDamage, cleanAndPolishedApplies } from "../../rules/gear.mjs";
import { askFollowUp } from "../../rolls/dialogs/follow-ups.mjs";
import { choiceKey, rememberChoices, restoreChoices } from "../../apps/remembered-choices.mjs";
import { measureInto, meleeReach } from "../../apps/map.mjs";
import { esc } from "../../html.mjs";
import { coverFire, suppressiveFire } from "../../apps/combat-actions.mjs";
import { characterReminders } from "../../rules/feat-reminders.mjs";
import { opportunistDamageSource, halvedFormula } from "../../rules/opportunist.mjs";
import { styleOverCaliberEligible, styleOverCaliberWeapon } from "../../rules/style-over-caliber.mjs";
import { kickDamageWeapon, unarmedWeapon } from "../../rules/kick.mjs";
import { inClosedStance } from "../../rules/boxing.mjs";
import { halvesSneakDamage } from "../../rules/unarmed-tricks.mjs";
import { spendWeaponShots, weaponAmmunition } from "../../apps/ammunition-use.mjs";
import { loc } from "../../i18n.mjs";
import { breakdownRows, weaponAttackBreakdown } from "../../rules/bonus-breakdown.mjs";

export const ActorAttackRolls = Base =>
  class ActorAttackRolls extends Base {
    async rollAttack(item, options = {}) {
      // Not blocked: drawing a weapon is the table's call. The player is reminded that it is still stowed.
      if (this.type === "agent" && item?.type === "weapon" && item.system?.equipped === false)
        globalThis.ui?.notifications?.info?.(
          loc`${item.name} is not equipped. The attack goes ahead; equip it on the Gear tab if it should be in hand.`
        );
      await validateCheapShotTarget(this, options.cheapShot, {
        targetUuid:
          options.characterTarget?.actorUuid ||
          options.targetActorUuid ||
          options.finalAttack?.opponentUuid ||
          options.finalAttack?.targetUuid
      });
      if (options.freeFinalAttack && options.disarm)
        throw new Error(loc`A final attack cannot combine with a Disarm action.`);
      if (
        options.freeFinalAttack &&
        (!(options.twoWeaponFinalAttack || options.finalAttack) || typeof options.validateFinalAttack !== "function")
      )
        throw new Error(loc`Use the final-attack control to reserve this opportunity.`);
      if (options.freeFinalAttack) {
        const reservation = this._finalAttackReservation,
          sourceValidator = options.validateFinalAttack;
        validateFinalRoundReservation(this, reservation);
        options = {
          ...options,
          finalAttackRound: { ...reservation.record, nauseated: reservation.nauseated },
          validateFinalAttack: async () => {
            validateFinalRoundReservation(this, reservation);
            await sourceValidator();
            validateFinalRoundReservation(this, reservation);
          }
        };
      }
      if (options.quickEntered && !options.askContext) {
        // Shift-click: the remembered and measured choices are read as if entered in the dialog.
        const { quickEntered, ...rest } = options;
        try {
          options = {
            ...rest,
            ...rollPipeline.read(
              {
                dialog: "attack",
                actor: this,
                item,
                needsCQB: cqbRangePlan(this.system, item.system, rest).active,
                entered: { ...quickEntered }
              },
              {}
            )
          };
        } catch (error) {
          // Something the roll needs could not be remembered or measured (for example the distance, with no
          // single target on the map): the dialog opens so it can be entered, instead of the click doing nothing.
          globalThis.ui?.notifications?.info(
            loc`${item.name}: the quick roll needs more detail (${error.message}) Opening the attack dialog.`
          );
          options = { ...rest, askContext: true };
        }
      }
      const initialCQB = cqbRangePlan(this.system, item.system, options);
      if (
        options.askContext ||
        (gameHunterAttack(this.system).earned && typeof options.targetAnimal !== "boolean") ||
        (initialCQB.active &&
          (!initialCQB.known ||
            (initialCQB.mastery && initialCQB.within && typeof options.targetOpponentConfirmed !== "boolean")))
      ) {
        const needsCQB = cqbRangePlan(this.system, item.system, options).active;
        const input = await systemDialog.input({
          window: { title: loc`Attack circumstances` },
          position: { width: 560 },
          rejectClose: false,
          ok: { label: loc`Roll attack` },
          render: (event, dialog) => {
            restoreChoices(choiceKey("attack", this, item.id), dialog?.element ?? event?.target);
            measureInto(this)(event, dialog);
            enhanceAttackDialog(event, dialog);
          },
          content: rollPipeline.dialog({
            dialog: "attack",
            actor: this,
            item,
            needsCQB,
            options: { attackAction: "standard", ...options }
          })
        });
        if (!input) return null;
        rememberChoices(choiceKey("attack", this, item.id), input);
        // What was entered, as roll options: each group of fields is read by the rule that owns it.
        options = {
          ...options,
          ...rollPipeline.read({ dialog: "attack", actor: this, item, needsCQB, entered: input }, {})
        };
      }
      if (
        options.disarm?.role !== "defender" &&
        reachIncreaseFeet(item.system.qualities ?? "") &&
        (typeof options.reachAdjacent !== "boolean" || options.reachGeometryConfirmed !== true)
      ) {
        const input = await askFollowUp(systemDialog, "reachGeometry", { actor: this, item, options });
        if (!input) return null;
        options = { ...options, ...reachContextInput(input) };
        if (typeof options.reachAdjacent !== "boolean" || options.reachGeometryConfirmed !== true)
          throw Error(loc`Confirm actual target adjacency and legal Reach geometry before this attack.`);
      }
      const completedTarget = await completeCharacterTarget(this, item.system, options, {
        prompt: !options.freeFinalAttack
      });
      if (!completedTarget) return null;
      options = completedTarget;
      const declaredTargetUuid = options.characterTarget?.actorUuid || options.targetActorUuid || null;
      const validateDeclaredTarget = () => {
        if (
          (options.characterTarget?.actorUuid || options.targetActorUuid || null) !== declaredTargetUuid ||
          (declaredTargetUuid &&
            !attackCharacterTargetChoices().some(a => a.uuid === declaredTargetUuid) &&
            // An ordinary attack may also name a token the attacker can see without being able to open its sheet.
            (options.characterTarget || !observedAttackTargetChoices(this).some(a => a.uuid === declaredTargetUuid)))
        )
          throw Error(loc`The explicitly selected attack target changed or is no longer an observed character.`);
      };
      validateDeclaredTarget();
      let feintBonusProof = null,
        sideStanceProof = null;
      const feintContext = () => ({ ...options, feintBonusProof, sideStanceProof });
      const w = item.system;
      // Shots are counted: a fire action is limited by what the weapon holds, and the attack spends its shots.
      const ammunition = weaponAmmunition(item);
      if (ammunition) options = { ...options, shotsRemaining: ammunition.loaded };
      const atk = this.weaponAttack(item, feintContext());
      feintBonusProof = atk.feintBonus.attackBonus
        ? { ...atk.feintBonus, attemptId: foundry.utils.randomID() }
        : atk.feintBonus;
      sideStanceProof = atk.sideStance.dice
        ? { ...atk.sideStance, attemptId: foundry.utils.randomID() }
        : atk.sideStance;
      if (atk.blocked) return refuse(atk.reason);
      // A melee attack only reaches an opponent within Reach (p.327). The map says when the target is further away:
      // a player is stopped, and the GC may go ahead after confirming.
      if (!atk.ranged && w.isMelee && !options.freeFinalAttack) {
        let extraReach = 0;
        try {
          extraReach = reachIncreaseFeet(w.qualities ?? "");
        } catch {
          /* a Reach quality that needs review adds nothing here */
        }
        const reach = meleeReach(this, 5 + extraReach + (options.duelingReach === true ? 5 : 0));
        if (reach && !reach.within) {
          const text = loc`${reach.targetName} is ${reach.distanceFeet} ft. away, beyond the ${reach.reachFeet} ft. Reach of ${item.name} (p.327).`;
          if (!game.user?.isGM) return refuse(loc`${text} Move closer first, or ask the GC.`);
          const go = await systemDialog.confirm({
            window: { title: loc`Target beyond Reach` },
            rejectClose: false,
            // The attacker is named: a group attack asks once for each member.
            content: `<p>${esc(loc`${this.name}:`)} ${esc(text)}</p><p>${loc`Make this melee attack anyway?`}</p>`,
            yes: { label: loc`Attack anyway`, default: true },
            no: { label: loc`Cancel` }
          });
          if (!go) return null;
        }
      }
      const shotsFired = ammunition ? (atk.fireAction?.shots ?? 1) : 0;
      if (shotsFired > (ammunition?.loaded ?? 0))
        return refuse(
          loc`${item.name} holds ${ammunition.loaded} shot(s) and this attack takes ${shotsFired}. Reload first.`
        );
      if (
        options.attackAction === "standard" &&
        atk.firearm &&
        atk.fireMode !== "single" &&
        atk.fireAction?.action !== "burst"
      )
        return refuse(loc`A Standard Attack requires Single-Shot mode, or a declared Burst.`);
      const meleeSnapshot = atk.meleeFire?.applies ? JSON.stringify(atk.meleeFire) : null;
      const trainedOnly = atk.trainedOnly ? { ...atk.trainedOnly, weaponId: item.id ?? item._id ?? null } : null;
      const quirky = atk.quirky ? { ...atk.quirky, weaponId: item.id ?? item._id ?? null } : null;
      const superiorAccuracy = atk.superiorAccuracy
        ? { ...atk.superiorAccuracy, weaponId: item.id ?? item._id ?? null }
        : null;
      const accurized = atk.accurized ? { ...atk.accurized, weaponId: item.id ?? item._id ?? null } : null;
      const finesseSnapshot = JSON.stringify({
        reach: atk.reach,
        whirling: atk.flanking?.whirling ?? null,
        meleeArmorPiercing: atk.meleeArmorPiercing.evidence,
        meleeTrick: meleeTrickSourceFacts(atk.meleeTrick),
        bullseye: atk.bullseye,
        meleeTradeoff: atk.meleeTradeoff,
        sideStance: atk.sideStance,
        feintBonus: atk.feintBonus,
        missTrickSources: missTrickSourceFacts(atk.missTrickSources),
        cheapShot: atk.cheapShot,
        quirky,
        superiorAccuracy,
        trainedOnly,
        accurized,
        increase: atk.finesseThreatIncrease ?? 0,
        cleaveThreat: atk.cleave?.threatIncrease ?? 0,
        ranged: atk.ranged,
        basic: atk.finesseBasic,
        massive: atk.massive
      });
      const validateAttackContext = async () => {
        validateDeclaredTarget();
        await validateCharacterTarget(options.characterTarget);
        await options.validateAttackContext?.();
        await validateCharacterTarget(options.characterTarget);
        const current = item.id && this.items?.get ? this.items.get(item.id) : item;
        if (!current) throw new Error(loc`The attack weapon no longer exists.`);
        const preview = this.weaponAttack(current, feintContext());
        if (meleeSnapshot && JSON.stringify(preview.meleeFire) !== meleeSnapshot)
          throw new Error(loc`The ranged melee-fire circumstances or CQB waiver source changed during the attack.`);
        if (
          JSON.stringify({
            reach: preview.reach,
            whirling: preview.flanking?.whirling ?? null,
            meleeArmorPiercing: preview.meleeArmorPiercing.evidence,
            meleeTrick: meleeTrickSourceFacts(preview.meleeTrick),
            bullseye: preview.bullseye,
            meleeTradeoff: preview.meleeTradeoff,
            sideStance: preview.sideStance,
            feintBonus: preview.feintBonus,
            missTrickSources: missTrickSourceFacts(preview.missTrickSources),
            cheapShot: preview.cheapShot,
            quirky: preview.quirky ? { ...preview.quirky, weaponId: current.id ?? current._id ?? null } : null,
            superiorAccuracy: preview.superiorAccuracy
              ? { ...preview.superiorAccuracy, weaponId: current.id ?? current._id ?? null }
              : null,
            trainedOnly: preview.trainedOnly
              ? { ...preview.trainedOnly, weaponId: current.id ?? current._id ?? null }
              : null,
            accurized: preview.accurized ? { ...preview.accurized, weaponId: current.id ?? current._id ?? null } : null,
            increase: preview.finesseThreatIncrease ?? 0,
            cleaveThreat: preview.cleave?.threatIncrease ?? 0,
            ranged: preview.ranged,
            basic: preview.finesseBasic,
            massive: preview.massive
          }) !== finesseSnapshot
        )
          throw new Error(
            loc`The attack weapon, proficiency or Finesse threat source changed during the attack (including conditional weapon qualities and Cleave threat).`
          );
      };
      const cqbSnapshot = atk.cqbRange?.active ? JSON.stringify(atk.cqbRange) : null;
      const validateCQBRange = cqbSnapshot
        ? () => {
            const current = item.id && this.items?.get ? this.items.get(item.id) : item;
            if (!current || JSON.stringify(this.weaponAttack(current, feintContext()).cqbRange) !== cqbSnapshot)
              throw new Error(loc`CQB source, weapon or range changed during this attack.`);
          }
        : null;
      const millionDollar = !!options.millionDollarSkill;
      if (millionDollar) {
        const plan = millionDollarSkillPlan(this.system, w, options);
        if (plan.blocked) return refuse(plan.reason);
        if (options.oneInAMillion) return refuse(loc`Choose one attack roll-choice/declaration ability.`);
        if (!options.millionDollarSkillCommitted)
          return this.useLimitedAbility(
            "millionDollarSkill",
            () => {
              const current = item.id && this.items?.get ? this.items.get(item.id) : item;
              if (!current) throw new Error(loc`The chosen weapon was removed.`);
              const eligible = millionDollarSkillPlan(this.system, current.system, options),
                preview = this.weaponAttack(current, feintContext());
              if (
                eligible.blocked ||
                preview.blocked ||
                (options.attackAction === "standard" && preview.firearm && preview.fireMode !== "single")
              )
                throw new Error(eligible.reason || preview.reason || loc`The current attack no longer qualifies.`);
              return this.rollAttack(current, { ...options, millionDollarSkillCommitted: true });
            },
            {
              workflow: "millionDollarSkill",
              additionalUses: options.cunningPlan ? [{ id: "cunningPlan", workflow: "cunningPlan" }] : []
            }
          );
      }
      const cunning = millionDollar && options.cunningPlan ? cunningPlanEffect(this.system, atk.error) : null;

      const tripPenalty = options.finalAttack?.source === "trip" ? 4 : 0;
      // A modifier the GC calls for that no rule on the sheet covers, typed into the attack dialog.
      const situational = Math.trunc(Number(options.situationalModifier)) || 0;
      // A villain role on the declared target narrows the threat range and raises the critical's cost (pp.447-448).
      const targetRole = declaredTargetUuid
        ? targetRoleCriticalRules(globalThis.fromUuidSync?.(declaredTargetUuid)?.system)
        : null;
      const message = await this.rollCheck(
        "1d20 + @total",
        { total: atk.total - tripPenalty + situational },
        {
          planModifiers: atk.planModifiers,
          breakdown: breakdownRows([
            ...weaponAttackBreakdown(atk),
            { label: loc`Trip final attack`, value: -tripPenalty },
            { label: loc`Situational modifier`, value: situational }
          ]),
          featReminders: options.featReminders,
          flavor: `${game.i18n.localize("SPYCRAFT.Attack")}: ${foundry.utils.escapeHTML(item.name)}${tripPenalty ? loc` — Trip final attack −4` : ""}${situational ? loc` — situational modifier ${situational > 0 ? `+${situational}` : `−${-situational}`}` : ""}${atk.trained ? "" : ` — ${game.i18n.localize("SPYCRAFT.Weapon.Untrained")}`}${atk.notes ? `<br><small>${foundry.utils.escapeHTML(atk.notes)}</small>` : ""}${targetRole ? `<br><small>${loc`Target is a ${targetRole.label}: threat range ${targetRole.threatRangeReduction} narrower, a critical costs ${targetRole.extraDiceToActivate} more.`}${threatAgainstRole(atk.threat, targetRole) > 20 ? loc` This attack cannot threaten.` : ""}</small>` : ""}`,
          strikingLease: options.strikingLease,
          tripFinalLease: options.tripFinalLease,
          validateCQBRange,
          finalAttackRound: options.finalAttackRound,
          finalAttack: options.finalAttack,
          twoWeaponFinalAttack: options.twoWeaponFinalAttack,
          validateFinalAttack: options.validateFinalAttack,
          validateAttackContext,
          threat: threatAgainstRole(atk.threat, targetRole),
          cap: atk.cap ?? null,
          error: cunning?.error ?? atk.error,
          cunningPlan: cunning ?? !!options.cunningPlan,
          chooseTwice: millionDollar,
          choiceSource: "Million Dollar Skill",
          choiceResourceId: millionDollar ? "millionDollarSkill" : "",
          oneInAMillion: !!options.oneInAMillion,
          allOrNothing: options.allOrNothing === true,
          checkKind: "attack",
          ability: atk.ability,
          weaponUuid: item.uuid,
          weaponProficiency: atk.proficiency ?? w.proficiency,
          meleeArmorPiercing: atk.meleeArmorPiercing.evidence,
          weaponQualities: atk.effectiveQualities ?? w.qualities,
          cleanAndPolished: cleanAndPolishedApplies(this.system, w),
          gearUuid: item.uuid,
          attackContext: {
            laser: laserWeapon(w),
            reach: atk.reach,
            reachAdjacent: options.reachAdjacent ?? null,
            reachGeometryConfirmed: options.reachGeometryConfirmed === true,
            meleeFeatTrick: atk.meleeTrick?.key ?? null,
            meleeTrick: atk.meleeTrick,
            bullseye: atk.bullseye,
            fireAction: atk.fireAction ?? null,
            pummel: atk.pummel ?? null,
            damageConversion: atk.damageConversion ?? null,
            kick: atk.kick ?? null,
            kickTrick: atk.kickTrick ?? null,
            doubleJab: atk.doubleJab ?? null,
            boxingTrick: atk.boxingTrick ?? null,
            brush: atk.brush ?? null,
            unarmedTrick: atk.unarmedTrick ?? null,
            duelingReach: atk.duelingReach ?? null,
            noQuarter: atk.noQuarter ?? null,
            tauntBonus: atk.tauntBonus ?? null,
            calledShot: atk.calledShot ?? null,
            bounce: atk.bounce ?? null,
            meleeTradeoff: atk.meleeTradeoff,
            grippingStance: grippingAttackProof(
              this.system,
              { ...w, id: item.id ?? item._id },
              { ranged: atk.ranged, hands: options.hands ?? w.useHands ?? 0 }
            ),
            sideStance: sideStanceProof,
            feintBonus: feintBonusProof,
            combatStance: combatStanceProof(this.system, { ranged: atk.ranged }),
            targetActorUuid: declaredTargetUuid,
            targetRole,
            missTrickSources: atk.missTrickSources,
            cheapShot: atk.cheapShot?.active ? atk.cheapShot : null,
            quirky,
            superiorAccuracy,
            trainedOnly,
            accurized,
            characterTarget: options.characterTarget ?? null,
            cleaveThreatIncrease: atk.cleave?.threatIncrease ?? 0,
            finesseBasic: atk.finesseBasic,
            massive: atk.massive,
            finesseThreatIncrease: atk.finesseThreatIncrease ?? 0,
            meleeFire: atk.meleeFire?.applies ? atk.meleeFire : null,
            cqbRange: atk.cqbRange?.active ? atk.cqbRange : null,
            disarm: atk.disarm?.active ? atk.disarm : null,
            targetPinnedAdjacent: options.targetPinnedAdjacent === true,
            pinnedTargetBonus: atk.pinnedTargetBonus,
            targetProneNonAdjacent: options.targetProneNonAdjacent === true,
            targetCrouchedNonAdjacent: options.targetCrouchedNonAdjacent === true,
            targetPosturePenalty: atk.targetPosturePenalty,
            sensoryConditions: atk.sensoryConditions,
            mortarOperation: atk.mortarOperation,
            launcherOperation: atk.launcherOperation,
            conditionAttackPenalty: atk.conditionAttackPenalty,
            twoWeaponWaiver: atk.twoWeaponWaiver,
            targetFlanked: options.targetFlanked === true,
            flanking: atk.flanking,
            targetAnimal: options.targetAnimal === true,
            gameHunter: atk.gameHunter,
            fogSmoke: atk.fogSmoke,
            ambientLight: atk.ambientLight,
            targetVulnerable: options.targetVulnerable === true,
            millionDollarSkillDeclared: millionDollar,
            targetFlatFooted: options.targetFlatFooted === true,
            sniper: atk.sniper,
            fireMode: atk.fireMode ?? null,
            recoil: atk.recoil ?? 0,
            recoilStrength: atk.recoilStrength ?? null,
            recoilPenalty: atk.recoilPenalty,
            rangeKnown: atk.rangeKnown,
            distanceFeet: atk.distanceFeet ?? null,
            rangeIncrement: atk.range,
            rangePenalty: atk.rangePenalty,
            rangePenaltyPerIncrement: atk.rangePenaltyPerIncrement,
            rangePenaltyBase: atk.rangePenaltyBase ?? atk.rangePenalty,
            improvedVisionReduction: atk.improvedVisionReduction ?? 0,
            sensoryTarget: atk.sensoryTarget ?? null,
            maximumRange: atk.maximumRange ?? null,
            hands: atk.hands,
            trained: atk.trained,
            ranged: atk.ranged,
            weaponOperation: atk.operation,
            vehicleMounted: typeof options.vehicleMounted === "boolean" ? options.vehicleMounted : undefined,
            aimed: !!atk.stance.aimed,
            braced: !!atk.stance.braced,
            attackAction: atk.stance.attackAction,
            aimBonus: atk.stance.aimBonus,
            braceBonus: atk.stance.braceBonus,
            braceAction: atk.stance.braceAction,
            ammunitionId: w.loadedAmmoId || null
          },
          improvised: !!item.system.improvised
        }
      );
      if (message && shotsFired) await spendWeaponShots(item, shotsFired);
      return message;
    }

    async useOneInAMillion(options = {}) {
      let input = options;
      if (!input.kind) {
        const esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: loc`One in a Million: declare before rolling` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Once per session, Soldier 14 may declare a natural 20 before an attack, Fortitude save or STR/CON skill check. For skills, choose this ability in the skill dialog instead.`}</p><label>${loc`Check`} <select name="kind"><option value="attack">${loc`Weapon attack`}</option><option value="fort">${loc`Fortitude save`}</option></select></label><label>${loc`Weapon for attack`} <select name="weaponId">${this.items
            .filter(i => i.type === "weapon" && !isResourceLock(i))
            .map(i => `<option value="${i.id}">${esc(i.name)}</option>`)
            .join("")}</select></label></div>`
        });
        if (!input) return null;
      }
      if (input.kind === "fort") return this.rollSave("fort", { oneInAMillion: true });
      const weapon = this.items.get(input.weaponId);
      if (input.kind !== "attack" || !weapon || weapon.type !== "weapon")
        throw new Error(loc`Choose an owned weapon or Fortitude save.`);
      return this.rollAttack(weapon, { oneInAMillion: true });
    }

    async rollRangedAttack(item, options = {}) {
      if (!this.isOwner) return null;
      let input = options;
      if (!Object.keys(input).length) {
        const preview = this.weaponAttack(item),
          esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: loc`Ranged attack: ${item.name}` },
          rejectClose: false,
          render: measureInto(this),
          content: rollPipeline.dialog({ dialog: "rangedAttack", actor: this, esc, item, options, preview })
        });
        if (!input) return null;
      }
      input = rollPipeline.read({ dialog: "rangedAttack", actor: this, item }, input);
      const ammunition = weaponAmmunition(item);
      if (ammunition) input = { ...input, shotsRemaining: ammunition.loaded };
      // Cover Fire and Suppressive Fire take the action without an attack check.
      if (input.fireAction === "coverFire") return coverFire(this, item, input);
      if (input.fireAction === "suppressiveFire") return suppressiveFire(this, item, input);
      if (input.distanceFeet === null) return refuse(loc`Enter the target distance before making a measured attack.`);
      return this.rollAttack(item, input);
    }

    async resolveUnnerving(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid || (message.blind && !game.user.isGM))
        throw new Error(loc`Use an owned visible damage record.`);
      if (!unnervingEligible(this.system, message.flags.spycraft2))
        return refuse(loc`Unnerving is not available for this damage record.`);
      let input = options;
      if (!input.target) {
        input = await systemDialog.input({
          window: { title: loc`Unnerving: additional stress` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`Target`} <input name="target" required /></label><label><input type="checkbox" name="damageInflictedConfirmed" /> ${loc`This unarmed/melee attack actually inflicted at least one point of damage after defenses`}</label><p>${loc`Rolls 1d4 stress per selected grade, maximum 3d4. Apply the target’s stress defenses separately. Record each attack’s added stress once.`}</p></div>`
        });
        if (!input) return null;
      }
      unnervingPlan(this.system, message.flags.spycraft2, input);
      return queueResources(
        [this],
        async () => {
          if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid)
            throw new Error(loc`Ownership or the acting character changed.`);
          const check = message.flags.spycraft2,
            plan = unnervingPlan(this.system, check, input),
            before = structuredClone(check.unnerving);
          await message.update({ "flags.spycraft2.unnerving": { ...plan, recorded: true } });
          try {
            return await this.rollCheck(plan.formula, this.getRollData(), {
              flavor: loc`Unnerving: ${foundry.utils.escapeHTML(plan.target)} — ${plan.formula} additional stress damage (p.451). Apply stress defenses separately.`,
              checkKind: "damage",
              unnervingStress: { ...plan, parentMessageUuid: message.uuid ?? message.id },
              unarmed: check.unarmed === true,
              weaponUuid: check.weaponUuid ?? "",
              weaponProficiency: check.weaponProficiency ?? "",
              threat: 0,
              error: 0
            });
          } catch (error) {
            await message.update(
              before === undefined ? { "flags.spycraft2.-=unnerving": null } : { "flags.spycraft2.unnerving": before }
            );
            throw error;
          }
        },
        { messages: [message] }
      );
    }

    async rollDamage(item, options = {}) {
      const targetChoices = damageTargetChoices(),
        sideHits = eligibleSideStanceHits(this, item),
        attackBonusHits = eligibleAttackDamageHits(this, item),
        automaticAttackBonus =
          attackBonusHits.length === 1 &&
          (!sideHits.length ||
            (sideHits.length === 1 && sideHits[0].proof.attackUuid === attackBonusHits[0].proof.attackUuid))
            ? attackBonusHits[0]
            : null;
      if (
        item.system.weaponCategory === "mortar" &&
        /\d*d\d+/i.test(item.system.damage) &&
        !Object.hasOwn(options, "mortarSpaceConfirmed")
      ) {
        const input = await askFollowUp(systemDialog, "mortarDamage", { actor: this, item, options });
        if (!input) return null;
        options = { ...options, ...input };
      }
      if (
        item.system.weaponCategory === "grenadeLauncher" &&
        item.system.mountRequirement &&
        /\d*d\d+/i.test(item.system.damage) &&
        !["underbarrelMountConfirmed", "usingIntegralTripod", "vehicleMounted"].some(key => Object.hasOwn(options, key))
      ) {
        const input = await askFollowUp(systemDialog, "launcherDamage", { actor: this, item, options });
        if (!input) return null;
        options = { ...options, ...input };
      }
      if (
        options.includeSneakAttack === undefined &&
        (hasSneakAttackSource(this.system, item.system) ||
          sideHits.length ||
          attackBonusHits.length ||
          characterReminders(this, { kind: "damage" }).length ||
          (inClosedStance(this.system) && unarmedWeapon(item.system)) ||
          this.system.activeFeatNames?.some(n => ["Horde Supremacy", "Tac-Squad Supremacy"].includes(n)) ||
          styleOverCaliberEligible(this.system, item.system))
      ) {
        const trickSneakHit = automaticAttackBonus?.proof.sneakDice ? automaticAttackBonus : null;
        const input = await systemDialog.input({
          window: { title: attackBonusHits.length ? loc`Damage and attack benefits` : loc`Damage and sneak attack` },
          rejectClose: false,
          content: rollPipeline.dialog({
            dialog: "damage",
            actor: this,
            item,
            attackBonusHits,
            automaticAttackBonus,
            sideHits,
            targetChoices,
            trickSneakHit,
            // What the attack card already recorded, so the damage dialog does not ask for it again.
            attackFacts: options.sourceAttack?.uuid
              ? (fromUuidSync(options.sourceAttack.uuid)?.flags?.spycraft2?.attackContext ?? null)
              : null
          })
        });
        if (!input) return null;
        options = {
          ...options,
          ...rollPipeline.read({ dialog: "damage", actor: this, item }, input),
          includeSneakAttack: !!input.includeSneakAttack
        };
      }
      // The attack card already recorded how far away the target was; the damage roll reuses that distance.
      if (options.distanceFeet === undefined || options.distanceFeet === null || options.distanceFeet === "") {
        const recorded = recordedAttackDistance(
          options.sourceAttack?.uuid ? fromUuidSync(options.sourceAttack.uuid)?.flags?.spycraft2 : null
        );
        if (recorded !== null) options = { ...options, distanceFeet: recorded };
      }
      const cqbPreview = cqbRangePlan(this.system, item.system, options, "damage");
      if (cqbPreview.active && cqbPreview.basics && !cqbPreview.known) {
        const input = await askFollowUp(systemDialog, "cqbDamageDistance", { actor: this, item, options });
        if (!input) return null;
        const n = input.distanceFeet;
        if (!Number.isFinite(n) || n < 0)
          return refuse(
            loc`No damage rolled: enter the target's distance in feet for CQB Basics, then roll damage again.`
          );
        options = { ...options, distanceFeet: n };
      }
      if (
        specialistApplies(this.system, item.system, "Killer Instinct") &&
        !item.system.isMelee &&
        !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(item.system.proficiency) &&
        options.withinCQB === undefined
      ) {
        const input = await askFollowUp(systemDialog, "killerInstinct", { actor: this, item, options });
        if (!input) return null;
        options = { ...options, ...input };
      }
      const attackDamageBenefit = options.attackDamageSourceUuid
        ? makeAttackDamageProof(this, item, options.attackDamageSourceUuid, {
            targetUuid: options.targetActorUuid || options.targetActor?.uuid,
            impaleDefense: options.impaleDefense
          })
        : null;
      options = {
        ...options,
        attackDamageBonus: attackDamageBenefit?.bonus ?? 0,
        ...(attackDamageBenefit?.hands ? { hands: attackDamageBenefit.hands } : {})
      };
      const damageWeaponSource = current => ({
        ...styleOverCaliberWeapon(this.system, current.system, options),
        ...(options.kick === true ? { kick: true } : {}),
        ...(options.closedStanceTarget === true ? { closedStanceTarget: true } : {}),
        ...(options.unarmedTrick ? { unarmedTrick: options.unarmedTrick } : {}),
        ...(options.hordeSupremacy === true ? { hordeSupremacy: true } : {}),
        ...(options.doubleJab === true ? { doubleJab: true } : {}),
        ...(options.brush === true && unarmedWeapon(current.system) ? { damage: "1d6", brush: true } : {}),
        id: current.id ?? current._id,
        name: current.name,
        // Power Kick adds armor-piercing (2) and takedown to the Kick's damage.
        qualities: grantedMeleeQuality(
          options.unarmedTrick === "clothesline"
            ? grantedMeleeQuality(current.system.qualities ?? "", "TKD")
            : options.kick === true
              ? kickDamageWeapon({ qualities: current.system.qualities ?? "" }, options.kickTrick).qualities
              : (current.system.qualities ?? ""),
          attackDamageBenefit?.grantedQuality
        )
      });
      const damageWeaponContext = current => {
        const context = this.weaponContext(current, options),
          p = attackDamageBenefit?.projectile;
        if (p)
          context.ammunition = {
            name: p.label ?? "Recorded " + p.kind,
            ammunitionKind: p.kind,
            ammunitionOnly: p.ammunitionOnly,
            damage: p.damage,
            errorThreat: p.errorThreat,
            explosiveAmmunition: p.explosive,
            quantity: 1
          };
        return context;
      };
      const damage = weaponDamage(this.system, damageWeaponSource(item), damageWeaponContext(item), this.type);
      if (damage?.blocked) return refuse(damage.blockedReason);
      const finesseDamage = {
        meleeArmorPiercing: damage?.meleeArmorPiercing?.evidence,
        formula: damage?.formula,
        damageText: damage?.damageText,
        basic: damage?.finesseBasic,
        used: damage?.finesse,
        bonus: damage?.bonus,
        grip: damage?.grip
      };
      const validateFinesseDamage = async () => {
        await options.validateAttackContext?.();
        const current = item.id && this.items?.get ? this.items.get(item.id) : item;
        if (!current) throw new Error(loc`The finesse damage weapon was removed.`);
        const next = weaponDamage(this.system, damageWeaponSource(current), damageWeaponContext(current), this.type);
        if (
          JSON.stringify({
            meleeArmorPiercing: next?.meleeArmorPiercing?.evidence,
            formula: next?.formula,
            damageText: next?.damageText,
            basic: next?.finesseBasic,
            used: next?.finesse,
            bonus: next?.bonus,
            grip: next?.grip
          }) !== JSON.stringify(finesseDamage)
        )
          throw new Error(loc`The finesse damage source or modifier changed during the roll.`);
      };
      const cqbDamageSnapshot = damage?.cqbRange?.active ? JSON.stringify(damage.cqbRange) : null,
        validateCQBRange = cqbDamageSnapshot
          ? () => {
              const current = item.id && this.items?.get ? this.items.get(item.id) : item;
              if (!current) throw new Error(loc`The CQB damage weapon was removed.`);
              const next = weaponDamage(
                this.system,
                damageWeaponSource(current),
                damageWeaponContext(current),
                this.type
              );
              if (JSON.stringify(next?.cqbRange) !== cqbDamageSnapshot)
                throw new Error(loc`CQB source, weapon or range changed during this damage roll.`);
            }
          : null;
      const sideStanceDamage =
        options.includeSneakAttack === true && options.sideStanceSourceUuid
          ? makeSideStanceDamageProof(this, item, options.sideStanceSourceUuid, {
              targetUuid: options.targetActorUuid || options.targetActor?.uuid
            })
          : null;
      if (sideStanceDamage) {
        if (attackDamageBenefit && attackDamageBenefit.attackUuid !== sideStanceDamage.attackUuid)
          throw Error(loc`Choose the same recorded attack for its damage bonus and Side Stance die.`);
        options = { ...options, targetActorUuid: sideStanceDamage.targetUuid };
      }
      if (attackDamageBenefit)
        options = {
          ...options,
          targetActorUuid: attackDamageBenefit.manualTargetName ? "" : attackDamageBenefit.targetUuid
        };
      const targetUuid = Object.hasOwn(options, "targetActorUuid")
          ? options.targetActorUuid
          : (options.targetActor?.uuid ?? targetChoices.selected),
        targetActor = await resolveDamageTarget(targetUuid);
      // Snake Strike: the drawn weapon's next hit this round on the Feinted opponent adds 1 sneak attack die.
      const snakeStrike =
        options.snakeStrike === true && options.includeSneakAttack === true
          ? snakeStrikeOpen(this.system, {
              combatId: this.participatingCombat?.id,
              round: this.participatingCombat?.round,
              weaponId: item.id,
              targetUuid: targetActor?.uuid ?? "",
              posted: [...(game.messages ?? [])].map(m => m.flags?.spycraft2).filter(Boolean)
            })
          : null;
      if (options.snakeStrike === true && options.includeSneakAttack === true && !snakeStrike)
        throw new Error(
          loc`No open Snake Strike for this weapon and target this round. Record it from the Main tab after the Feint.`
        );
      const sneak = sneakAttackDamagePlan(
          this.system,
          { ...item.system, range: this.weaponAttack(item, options).range },
          {
            ...options,
            sideStanceDie: !!sideStanceDamage,
            trickSneak:
              options.includeSneakAttack === true && attackDamageBenefit?.sneakDice
                ? { source: attackDamageBenefit.sneakSource, dice: attackDamageBenefit.sneakDice }
                : snakeStrike
                  ? { source: "Snake Strike", dice: 1 }
                  : null,
            whirlingFlankingProof: whirlingAttackProof(this, {
              targetFlanked: options.targetFlanked,
              targetActorUuid: targetActor?.uuid
            }),
            targetSystem: targetActor?.system ?? null
          }
        ),
        sneakAttackTarget = sneak.active ? sneakAttackTargetSnapshot(targetActor) : null;
      // Dirty Fighting Basics: sneak attack damage its owner suffers is halved, rounded up (p.185).
      const sneakHalved = sneak.active && halvesSneakDamage(targetActor?.system);
      if (!damage?.formula) return refuse(game.i18n.format("SPYCRAFT.Weapon.NoDamage", { name: item.name }));
      // Pummel: double the standard subdual damage of an unarmed hit (p.358).
      const pummel =
        options.pummel === true &&
        (item.system.proficiency === "unarmed" || /\bNKL\b/.test(item.system.qualities ?? ""));
      if (options.pummel === true && !pummel) return refuse(loc`Pummel is an unarmed attack.`);
      // Only the weapon's damage is doubled: bonus dice such as sneak attack are added after a multiplier (p.329).
      let formula = pummel ? `(${damage.formula}) * 2` : damage.formula;
      if (sneak.active) formula = `${formula} + ${sneakHalved ? `ceil((${sneak.formula}) / 2)` : sneak.formula}`;
      // Opportunist: a hit from its final attack deals half standard damage, rounded up (p.175).
      const opportunistDamage = options.opportunistAttackUuid
        ? opportunistDamageSource(fromUuidSync(options.opportunistAttackUuid), {
            actorUuid: this.uuid,
            weaponUuid: item.uuid,
            messages: game.messages ?? [],
            rerollOf: options.rerollOf
          })
        : null;
      if (opportunistDamage) formula = halvedFormula(formula);
      return this.rollCheck(formula, this.getRollData(), {
        breakdown: damage?.bonusRows,
        featReminders: options.featReminders,
        sourceAttack: options.sourceAttack ?? null,
        pummelDamage: pummel,
        styleOverCaliber: options.styleOverCaliber === true,
        kick: options.kick === true,
        hordeSupremacy: options.hordeSupremacy === true,
        ...(snakeStrike && sneak.active ? { snakeStrike: snakeStrike.id } : {}),
        kickTrick: options.kickTrick ?? null,
        doubleJab: options.doubleJab === true,
        brush: options.brush === true,
        closedStanceTarget: options.closedStanceTarget === true,
        opportunistDamage,
        meleeArmorPiercing: damage.meleeArmorPiercing.evidence,
        attackDamageBenefit,
        sideStanceDamage,
        finesseDamage,
        validateAttackContext: validateFinesseDamage,
        weaponQualities: damage.effectiveQualities,
        flavor: `${game.i18n.localize("SPYCRAFT.Damage")}: ${foundry.utils.escapeHTML(item.name)} (${foundry.utils.escapeHTML(damage.damageText ?? item.system.damage)})${damage.ammunition ? ` — ${foundry.utils.escapeHTML(damage.ammunition)}` : ""}${damage.meleeArmorPiercing.evidence ? `<br><small>${foundry.utils.escapeHTML(damage.meleeArmorPiercing.notes.join(" "))}</small>` : ""}${attackDamageBenefit ? `<br><small>${loc`${foundry.utils.escapeHTML(attackDamageBenefit.source)}: recorded attack damage +${attackDamageBenefit.bonus}, once against ${foundry.utils.escapeHTML(attackDamageBenefit.manualTargetName ?? loc`the recorded target`)}.${attackDamageBenefit.sneakDice ? loc` ${attackDamageBenefit.sneakSource}: its hit supplies ${attackDamageBenefit.sneakDice} die of sneak attack damage when the sneak attack conditions are met.` : ""}${attackDamageBenefit.grantedQuality === "TKD" ? loc` Takedown: if a character suffers damage, resolve Fortitude at pre-DR damage (+10 DC if wounds were lost); failure causes sprawled.` : ""}`}</small>` : ""}${sneak.active ? `<br><small>${foundry.utils.escapeHTML(sneak.notes)}</small>` : ""}${damage.cqbRange?.active ? `<br><small>${foundry.utils.escapeHTML(damage.cqbRange.notes.join(" "))}</small>` : ""}${damage.laser?.note ? `<br><small>${foundry.utils.escapeHTML(damage.laser.note)}</small>` : ""}${damage.markDamage?.active ? `<br><small>${foundry.utils.escapeHTML(damage.markDamage.note)}</small>` : ""}${pummel ? loc` — Pummel: double subdual damage, never lethal` : ""}${options.styleOverCaliber === true ? loc` — Style Over Caliber: 1d10+2 standard damage` : ""}${options.kick === true ? loc` — Kick: Strength modifier added twice` : ""}${options.kickTrick === "powerKick" ? loc` — Power Kick: armor-piercing (2), takedown` : ""}${options.doubleJab === true ? loc` — Double Jab: 2 fewer damage per die (minimum 1)` : ""}${options.brush === true ? loc` — Brush: 1d6 subdual; the target’s Initiative Count drops by this amount` : ""}${sneakHalved ? loc` — Dirty Fighting Basics: the target takes half the sneak attack damage, rounded up` : ""}${options.hordeSupremacy === true ? loc` — Horde Supremacy: +2 morale damage` : ""}${options.closedStanceTarget === true ? loc` — Closed Stance: +2 against the opponent in my square` : ""}${options.kickTrick === "guillotine" ? loc` — Guillotine Kick: the target makes a Fortitude save (DC 10 + this damage) or is sent reeling` : ""}${opportunistDamage ? loc` — Opportunist: half damage, rounded up` : ""}`,
        validateCQBRange,
        cqbRange: damage.cqbRange?.active ? damage.cqbRange : null,
        mortarOperation: damage.mortarOperation?.applicable ? damage.mortarOperation : null,
        launcherOperation: damage.launcherOperation?.applicable ? damage.launcherOperation : null,
        unnervingAvailableGrade: unnervingGrade(this.system),
        weaponUuid: item.uuid,
        weaponProficiency: damage.launcherOperation?.proficiency ?? item.system.proficiency,
        sneakAttackTarget,
        sneakAttack: sneak.active ? sneak : null,
        conditionDamagePenalty: damage.conditionDamagePenalty,
        conditionDamageIncluded: true,
        checkKind: "damage",
        threat: 0,
        error: 0,
        unarmed: item.system.proficiency === "unarmed" || /\bNKL\b/.test(item.system.qualities ?? ""),
        improvised: !!item.system.improvised
      });
    }

    /** Spend and roll the selected action die, retaining the granted die type. */
  };
