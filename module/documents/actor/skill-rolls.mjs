/** Skill and Knowledge checks, and the class abilities resolved through them. */
import { refuse, refuseStep } from "../../error-notices.mjs";
import { orderSkillChecks, needsGear } from "../../rules/skill-check-order.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { rollPipeline } from "../../rolls/index.mjs";
import { choiceKey, rememberChoices, rememberedChoices, restoreChoices } from "../../apps/remembered-choices.mjs";
import { enhanceSkillDialog } from "../../apps/skill-dialog-ux.mjs";
import { validateTripCounterIntent } from "../../apps/counter-trip.mjs";
import { tripAttackTargetInput } from "../../apps/trip-attack.mjs";
import { feintTargetInput } from "../../apps/feint.mjs";
import { tripDefenseTargetInput } from "../../apps/trip.mjs";
import { detectionObserverContext } from "../../apps/detection-observer.mjs";
import { targetSkillContext } from "../../apps/target-skill-effects.mjs";
import { oneHandManeuverUseProof } from "../../rules/maneuver-actions.mjs";
import { actionDieBenefitQuote } from "../../rules/benefit-payments.mjs";
import { surchargeFundingInput, unrolledPaymentFundingInput } from "../../apps/action-die-benefits.mjs";
import { restraintSourceSnapshot } from "../../rules/restraints.mjs";
import { hasFinalDeduction, finalDeductionStudy, finalDeductionPlan } from "../../rules/final-deduction.mjs";
import { globalSearchSource, globalSearchPlan } from "../../rules/global-search.mjs";
import { littleDetailsSource } from "../../rules/little-details.mjs";
import { breakthroughPlan, nestPlan } from "../../rules/breakthrough.mjs";
import { brightIdeaPoolStatus } from "../../rules/bright-idea.mjs";
import { difficultSkillBonusPlan, checkBonusPool } from "../../rules/bonus-pools.mjs";
import { queueResources, isResourceLock } from "../../services/transactions.mjs";
import { resourceStatus, resourceUsePlan } from "../../rules/limited-uses.mjs";
import { resolveKnowledgeCheck } from "../../rules/knowledge.mjs";
import { equipmentCategory, possessionUnavailable, cleanAndPolishedApplies } from "../../rules/gear.mjs";
import { resolveSkillCheck } from "../../rules/skills.mjs";
import { loc } from "../../i18n.mjs";

/** Plan fields a skill check records as the rules returned them. */
const SKILL_PLAN_FIELDS = [
  "stalkingStance",
  "feint",
  "meleeSkillFeats",
  "conveyanceBullRush",
  "bullRushAttack",
  "bullRushDefense",
  "tumblePath",
  "tripAttack",
  "tripDefense",
  "fallDistance",
  "balanceSurface",
  "hideCircumstances",
  "detectionObserver",
  "hideMovement",
  "targetSkillEffect",
  "rankSynergyFeats",
  "stoneCold",
  "threaten",
  "taunt",
  "diversion",
  "bugConcealment",
  "documentation",
  "analysisTask",
  "trackingFeat",
  "trackingMasteryTask",
  "forensicGenius",
  "closedCourseFeat",
  "wheelFeat",
  "practiceFeat",
  "fundedTaking",
  "terrainFeat",
  "pursuitFeat",
  "professionalFeat",
  "contactFeat",
  "polyglot",
  "charmer",
  "cardSharkProfession",
  "appearanceModifiers",
  "hardCore",
  "weaponFocusWork",
  "skillBonusCondition",
  "gamblingDice",
  "threat",
  "error",
  "cap",
  "rollMode",
  "actionDiceAllowed",
  "practiceMakesPerfect",
  "criticalFailureCostIncrease",
  "crossCheck",
  "cunningPlan",
  "attributeSubstitution",
  "localHeroOpposition",
  "terrain",
  "senses",
  "sensoryConditions",
  "tracking",
  "gcTakingPermissionConfirmed",
  "ambush",
  "underwaterContext",
  "qualityChecks",
  "medical",
  "skillTags",
  "skillGear",
  "fogSmoke",
  "ambientLight",
  "nest",
  "breakthrough"
];

/** Plan fields whose sources have to be the same when the check is posted as when it was planned. */
const GUARDED_SKILL_FIELDS = [
  "stalkingStance",
  "feint",
  "meleeSkillFeats",
  "conveyanceBullRush",
  "bullRushAttack",
  "bullRushDefense",
  "tumblePath",
  "tripDefense",
  "fallDistance",
  "balanceSurface",
  "hideCircumstances",
  "detectionObserver",
  "hideMovement",
  "targetSkillEffect",
  "rankSynergyFeats",
  "stoneCold",
  "threaten",
  "taunt",
  "diversion",
  "bugConcealment",
  "documentation",
  "analysisTask",
  "trackingFeat",
  "trackingMasteryTask",
  "forensicGenius",
  "closedCourseFeat",
  "wheelFeat",
  "practiceFeat",
  "fundedTaking",
  "terrainFeat",
  "pursuitFeat",
  "professionalFeat",
  "contactFeat",
  "polyglot",
  "charmer",
  "cardSharkProfession",
  "appearanceModifiers",
  "hardCore",
  "gamblingDice"
];
const guardedFacts = plan =>
  JSON.stringify([...GUARDED_SKILL_FIELDS.map(field => plan[field]), plan.skillGear?.toolShedKit]);
const hasGuardedFacts = plan => GUARDED_SKILL_FIELDS.some(field => plan[field]) || !!plan.skillGear?.toolShedKit;

export const ActorSkillRolls = Base =>
  class ActorSkillRolls extends Base {
    async rollSkill(key, ability = null, options = {}) {
      if (options.tripCounter) validateTripCounterIntent(this, options.tripCounter, options.tripCounterLease);
      const restraintRollSource = restraintSourceSnapshot(this),
        restraintRollSize = this.system.size;
      const skill = this.system.skillTotals?.[key];
      const optionalRules = game.settings?.get("spycraft2", "linguistics") ? ["linguistics"] : [];
      // Open checks first, so the dialog and Shift-click start on one a player can simply roll.
      const checks = orderSkillChecks(
        rollPipeline.skillChecks(
          { actor: this, checkKind: "skill", skillKey: key, options, optionalRules },
          CONFIG.SPYCRAFT.skills[key]?.checks ?? []
        )
      );
      if (!skill || !checks.length) return null;
      let input = options;
      const memoryKey = choiceKey("skill", this, key);
      if (!input.check && input.quick) {
        // Shift-click: the check chosen last time for this skill (or its first check), rolled straight away.
        const saved = rememberedChoices(memoryKey) ?? {};
        const check = checks.some(c => c.id === saved.check) ? saved.check : checks[0].id;
        // Taking 10 or 20 needs this moment's safety declared in the dialog, so the fast path always rolls.
        input = { ...options, ...saved, check, ability: ability ?? saved.ability ?? skill.ability, method: "roll" };
      }
      if (!input.check) {
        const esc = foundry.utils.escapeHTML;
        const choices = checks
          .map(
            check =>
              `<option value="${check.id}"${options.initialCheck === check.id ? " selected" : ""}>${loc`${esc(check.name)} (${check.attributes.join("/").toUpperCase()}, ${esc(check.mode)}, error 1–${check.error})`}${needsGear(check) ? ` · ${loc`needs gear`}` : ""}</option>`
          )
          .join("");
        const abilities = skill.totals
          .map(
            t =>
              `<option value="${t.ability}"${t.ability === (ability ?? skill.ability) ? " selected" : ""}>${t.ability.toUpperCase()}</option>`
          )
          .join("");
        input = await systemDialog.input({
          window: { title: skill.name },
          position: { width: 560 },
          rejectClose: false,
          ok: { label: loc`Roll check` },
          render: (event, dialog) => {
            if (!options.initialCheck) restoreChoices(memoryKey, dialog?.element ?? event?.target);
            enhanceSkillDialog(event, dialog, checks);
          },
          content: rollPipeline.dialog({
            dialog: "skill",
            actor: this,
            abilities,
            choices,
            esc,
            key,
            restraintRollSource,
            skill
          })
        });
        if (!input) return null;
        rememberChoices(memoryKey, { check: input.check, ability: input.ability, method: input.method });
      }
      // Field coercion and lookups registered for this dialog (module/rolls/dialogs/skill.mjs and rule modules).
      input = rollPipeline.read({ dialog: "skill", actor: this, key }, input);
      const check = checks.find(c => c.id === input.check);
      const gearItem = input.gearItem ? this.items?.get?.(input.gearItem) : null;
      const workTarget = () =>
        input.weaponWork === true && input.weaponWorkItemId ? this.items?.get?.(input.weaponWorkItemId) : null;
      if (input.weaponWork === true && input.weaponWorkItemId && workTarget()?.type !== "weapon")
        return refuse(loc`Choose an actual target weapon/model or confirm its specifications again.`);
      if (
        input.gearItem &&
        (!gearItem ||
          !["weapon", "armor", "gear"].includes(gearItem.type) ||
          isResourceLock(gearItem) ||
          gearItem.system.reserve ||
          gearItem.system.destroyed ||
          gearItem.system.quantity === 0 ||
          possessionUnavailable(gearItem.system))
      )
        return refuse(loc`Choose available gear being used for this check.`);
      if (
        check?.id === "restraint-escape" &&
        restraintRollSource.sources.length > 1 &&
        input.grappleAllSourcesConfirmed !== true
      )
        throw new Error(loc`Confirm which restraint sources belong to this grapple before rolling.`);
      if (check?.id === "restraint-escape" && this.system.size !== restraintRollSize)
        throw new Error(loc`Size changed while choosing this grapple check.`);
      if (
        check?.id === "restraint-escape" &&
        JSON.stringify(restraintSourceSnapshot(this)) !== JSON.stringify(restraintRollSource)
      )
        throw new Error(loc`The grapple sources changed while choosing this check.`);
      // The check as the rules resolve it for what was entered, with the gear currently in hand.
      const plan = gear =>
        resolveSkillCheck(this.system, key, check, {
          ...this.sensoryContext(input),
          ...feintTargetInput(input, this),
          ...tripAttackTargetInput(input, this, { key, check }),
          ...tripDefenseTargetInput(input, this, { key, check }),
          ...targetSkillContext(input, key),
          ...detectionObserverContext(input),
          gearItem: gear,
          weaponWorkItem: workTarget(),
          gearCategory: equipmentCategory(gear),
          optionalRules,
          ability: input.ability ?? ability
        });
      let result = plan(gearItem);
      if (!result) return null;
      if (result.blocked) return refuse(result.blockedReason);
      if (!result.actionDiceCost) {
        const split = unrolledPaymentFundingInput(input),
          fee = surchargeFundingInput(input);
        if (split.allocations !== undefined || fee.surchargeAllocations !== undefined) {
          try {
            actionDieBenefitQuote(this, { baseCost: 0, benefitCount: 0, ...split, ...fee });
          } catch (error) {
            return refuse(error.message);
          }
        }
      }
      if (input.iCanSwim === true) {
        const allocation = await this.spendDeferredSkillPoints(key, {
          ...(input.deferredSkillPoints ?? {}),
          beforeSkillCheckConfirmed: true
        });
        if (!allocation || allocation.review) return null;
        result = plan(gearItem);
        if (!result || result.blocked) return refuse(result?.blockedReason ?? loc`This check is no longer available.`);
      }

      if (input.breakthrough)
        breakthroughPlan(this.system, this.items, CONFIG.SPYCRAFT, result, {
          sourceAbility: input.breakthroughAbility,
          modifier: input.modifier
        });
      if (input.nest)
        nestPlan(this.system, CONFIG.SPYCRAFT, result, {
          skillKey: key,
          checkId: check.id,
          halfCoverConfirmed: input.nestHalfCoverConfirmed,
          sourceAbility: input.nestAbility,
          breakthrough: !!input.breakthrough
        });
      const additionalUses = [
        ...(result.analysisTask?.stage === "pressure"
          ? [{ id: result.analysisTask.pressureUseId, workflow: "taskPressure" }]
          : []),
        ...(input.wheelFreeManeuver === true ? [{ id: "oneHandManeuver", workflow: "freeManeuver" }] : []),
        ...(input.littleDetails === true
          ? [
              { id: "littleDetails", workflow: "littleDetails" },
              { id: "littleDetailsRound", workflow: "littleDetailsRound" }
            ]
          : []),
        ...(input.breakthrough ? [{ id: "breakthrough", workflow: "breakthrough" }] : []),
        ...(input.allAccordingToPlan ? [{ id: "allAccordingToPlan", workflow: "attributeSubstitution" }] : []),
        ...(input.cunningPlan ? [{ id: "cunningPlan", workflow: "cunningPlan" }] : []),
        ...(input.allOrNothing === true ? [{ id: "allOrNothing", workflow: "allOrNothing" }] : [])
      ];
      const esc = foundry.utils.escapeHTML;
      if (
        [input.oneInAMillion, input.brightIdea, input.iKnowWhatDoing, input.tenSecondSolution].filter(Boolean).length >
        1
      )
        throw new Error(loc`Choose one pre-roll class ability for this check.`);
      if (input.iKnowWhatDoing) {
        difficultSkillBonusPlan(this.system, result, {
          dc: result.weaponFocusWork?.effectiveDC ?? input.difficultyClass
        });
        if (result.rollMode === "blindroll" && !game.user?.isGM)
          throw new Error(loc`The GC resolves this bonus for a secret or passive check.`);
      }
      if (input.brightIdea && key === "search" && (this.system.classLevels?.fieldAnalyst ?? 0) >= 8)
        return refuse(loc`Eye for Detail already rolls Search twice. Clear Bright Idea to preserve its limited use.`);
      if (input.brightIdea && (result.method !== "roll" || !["int", "wis"].includes(result.ability)))
        return refuse(loc`Bright Idea requires a rolled Intelligence- or Wisdom-based skill check.`);
      if (input.brightIdea && result.rollMode === "blindroll" && !game.user?.isGM)
        return refuse(loc`Ask the GC to resolve Bright Idea for this secret or passive check.`);
      const brightSource = input.brightIdea ? this.resolveBrightIdeaSource(input.brightIdeaSource) : null;
      if (input.brightIdea && !brightSource) return null;
      let difficultGain = null;
      const perform = (
        requiredBonusPoolId = null,
        payment = null,
        { solutionCommitted = false, millionCommitted = false } = {}
      ) => {
        if (
          (solutionCommitted && input.tenSecondSolution !== true) ||
          (millionCommitted && input.oneInAMillion !== true)
        )
          throw new Error(loc`The paid class declaration changed before the skill roll.`);
        if (input.weaponWork === true && input.weaponWorkItemId && workTarget()?.type !== "weapon")
          throw new Error(loc`The target weapon/model is no longer available. Confirm the check again.`);
        const currentGear = input.gearItem ? this.items?.get?.(input.gearItem) : null;
        if (
          input.gearItem &&
          (!currentGear ||
            isResourceLock(currentGear) ||
            currentGear.system.reserve ||
            currentGear.system.destroyed ||
            currentGear.system.quantity === 0 ||
            possessionUnavailable(currentGear.system))
        )
          throw new Error(loc`The selected gear is no longer available.`);
        if (check?.id === "restraint-escape" && this.system.size !== restraintRollSize)
          throw new Error(loc`Size changed before this grapple check.`);
        if (
          check?.id === "restraint-escape" &&
          JSON.stringify(restraintSourceSnapshot(this)) !== JSON.stringify(restraintRollSource)
        )
          throw new Error(loc`The grapple sources changed before the roll.`);
        const fresh = plan(currentGear);
        let wheelUseProof = null;
        if (
          !fresh ||
          fresh.blocked ||
          fresh.actionDiceCost !== result.actionDiceCost ||
          fresh.actionDiceBenefits !== result.actionDiceBenefits
        )
          throw new Error(
            fresh?.blockedReason || loc`This check’s requirements changed. Review it before rolling again.`
          );
        if (input.brightIdea && key === "search" && (this.system.classLevels?.fieldAnalyst ?? 0) >= 8)
          throw new Error(
            loc`Eye for Detail now covers this Search check; preserve Bright Idea and roll again without it.`
          );
        if (
          input.brightIdea &&
          (fresh.method !== "roll" ||
            !["int", "wis"].includes(fresh.ability) ||
            (fresh.rollMode === "blindroll" && !game.user?.isGM))
        )
          throw new Error(loc`Bright Idea no longer qualifies for this check.`);
        if (input.breakthrough)
          Object.assign(
            fresh,
            breakthroughPlan(this.system, this.items, CONFIG.SPYCRAFT, fresh, {
              sourceAbility: input.breakthroughAbility,
              modifier: input.modifier
            })
          );
        if (input.nest)
          Object.assign(
            fresh,
            nestPlan(this.system, CONFIG.SPYCRAFT, fresh, {
              skillKey: key,
              checkId: check.id,
              halfCoverConfirmed: input.nestHalfCoverConfirmed,
              sourceAbility: input.nestAbility,
              breakthrough: !!input.breakthrough
            })
          );
        if (input.iKnowWhatDoing) {
          difficultGain = difficultSkillBonusPlan(this.system, fresh, {
            dc: fresh.weaponFocusWork?.effectiveDC ?? input.difficultyClass
          });
          if (fresh.rollMode === "blindroll" && !game.user?.isGM)
            throw new Error(loc`The GC resolves this secret bonus.`);
        }
        return this.rollCheck(
          fresh.fixedDie ? `${fresh.fixedDie} + @total` : "1d20 + @total",
          { total: fresh.total },
          {
            planModifiers: fresh.planModifiers,
            flavor: `${esc(skill.name)} / ${esc(check.name)} (${fresh.ability.toUpperCase()})<br><small>${esc(fresh.notes)}</small>`,
            ...(Object.hasOwn(input, "oldSchool") ? { oldSchool: input.oldSchool } : {}),
            featReminders: input.featReminders,
            // A leader's check remembers the synergy already in it: helpers' synergy does not stack with it.
            cooperative:
              input.cooperative?.role === "leader"
                ? { ...input.cooperative, priorSynergy: fresh.synergyBonus }
                : (input.cooperative ?? null),
            solutionCommitted,
            millionCommitted,
            tripCounterLease: input.tripCounterLease,
            ...Object.fromEntries(SKILL_PLAN_FIELDS.map(field => [field, fresh[field]])),
            refreshPaidSkill: fresh.gamblingDice
              ? (paid, committed) => perform(requiredBonusPoolId, paid, committed)
              : undefined,
            validateSkillContext: hasGuardedFacts(fresh)
              ? () => {
                  if (fresh.wheelFeat?.free)
                    wheelUseProof = oneHandManeuverUseProof(this.system, fresh.wheelFeat, wheelUseProof);
                  const liveGear = input.gearItem ? this.items?.get?.(input.gearItem) : null,
                    now = plan(liveGear);
                  if (!now || now.blocked || guardedFacts(now) !== guardedFacts(fresh))
                    throw new Error(
                      loc`The declared skill modifiers or their feat sources changed before the check was posted.`
                    );
                }
              : undefined,
            restraintEscape: fresh.restraintEscape
              ? {
                  ...fresh.restraintEscape,
                  sourceSnapshot: restraintRollSource,
                  sourceScopeConfirmed:
                    restraintRollSource.sources.length === 1 || input.grappleAllSourcesConfirmed === true
                }
              : null,
            skillCheckAdjustment: fresh.checkAdjustment,
            preRollFunding: this.preRollPaymentReceipt(payment),
            bonusPoolId: input.bonusPoolId ?? "",
            hailMary: {
              untrained: input.hailMaryUntrained === true,
              uncap: input.hailMaryUncap === true,
              active: input.hailMaryActive === true,
              cost: fresh.actionDiceCost
            },
            checkMethod: fresh.method,
            checkKind: "skill",
            ability: fresh.ability,
            skillKey: key,
            checkId: check.id,
            focus: input.focus || check.name.replace(/ Check$/, ""),
            cleanAndPolished: cleanAndPolishedApplies(this.system, currentGear?.system),
            gearUuid: currentGear?.uuid ?? "",
            requiredBonusPoolId,
            oneInAMillion: !!input.oneInAMillion,
            tenSecondSolution: !!input.tenSecondSolution,
            ...(input.allOrNothing === true ? { allOrNothing: true, allOrNothingCommitted: true } : {}),
            standaloneCheckConfirmed: !!input.standaloneCheckConfirmed,
            inComplexTask:
              !!input.inComplexTask ||
              !!fresh.analysisTask ||
              (key === "analysis" && input.complexAnalysisTask === true),
            inDramaticConflict:
              input.inDramaticConflict === true ||
              input.seductionConflict === true ||
              !!input.manhuntRole ||
              !!input.chaseRole ||
              input.manhuntPrey === true,
            additionalCost: fresh.actionDiceCost,
            additionalBenefitCount: fresh.actionDiceBenefits,
            ...surchargeFundingInput(input),
            ...unrolledPaymentFundingInput(input),
            additionalUses,
            littleDetails: fresh.littleDetails
              ? { ...fresh.littleDetails, round: this.usagePeriods.round ?? "initial" }
              : null,
            chooseTwice: !!input.brightIdea,
            choiceSource: brightSource?.name,
            choiceResourceId: brightSource?.id,
            weaponUuid: currentGear?.type === "weapon" ? currentGear.uuid : "",
            weaponQualities: currentGear?.type === "weapon" ? currentGear.system.qualities : ""
          }
        );
      };
      if (input.iKnowWhatDoing)
        return this.useLimitedAbility(
          "iKnowWhatDoing",
          async (status, payment) => {
            const id = foundry.utils.randomID();
            if (this.system.bonusActionDice?.[id]) throw new Error(loc`This bonus-pool identifier already exists.`);
            let message;
            try {
              message = await perform(id, payment);
              const check = message.flags?.spycraft2,
                pool = checkBonusPool(this.system, difficultGain, {
                  id,
                  messageUuid: message.uuid ?? message.id,
                  skillKey: key,
                  ability: check.ability,
                  periods: this.usagePeriods
                });
              await this.update({ [`system.bonusActionDice.${id}`]: pool });
              return message;
            } catch (error) {
              if (message) {
                try {
                  await message.delete();
                } catch (cleanupError) {
                  ui.notifications.warn(
                    loc`The skill result may still exist after a bonus-grant failure. Its use and costs remain spent; ask the GC to review the check and bonus before retrying.`
                  );
                  return message;
                }
              }
              if (this.system.bonusActionDice?.[id]) await this.update({ [`system.bonusActionDice.-=${id}`]: null });
              throw error;
            }
          },
          {
            workflow: "difficultSkillBonus",
            additionalCost: result.actionDiceCost,
            additionalBenefitCount: result.actionDiceBenefits,
            ...surchargeFundingInput(input),
            ...unrolledPaymentFundingInput(input),
            additionalUses,
            bonusPoolId: input.bonusPoolId ?? ""
          }
        );
      if (input.oneInAMillion || input.tenSecondSolution) return perform();
      if (input.brightIdea)
        return this.useLimitedAbility(brightSource.id, (status, payment) => perform(null, payment), {
          workflow: "brightIdea",
          additionalCost: result.actionDiceCost,
          additionalBenefitCount: result.actionDiceBenefits,
          ...surchargeFundingInput(input),
          ...unrolledPaymentFundingInput(input),
          additionalUses,
          bonusPoolId: input.bonusPoolId ?? ""
        });
      if (additionalUses.length) {
        const [first, ...others] = additionalUses;
        return this.useLimitedAbility(first.id, (status, payment) => perform(null, payment), {
          workflow: first.workflow,
          additionalCost: result.actionDiceCost,
          additionalBenefitCount: result.actionDiceBenefits,
          ...surchargeFundingInput(input),
          ...unrolledPaymentFundingInput(input),
          additionalUses: others,
          bonusPoolId: input.bonusPoolId ?? ""
        });
      }
      return result.actionDiceCost
        ? this.spendActionDiceBenefit(result.actionDiceCost, payment => perform(null, payment), {
            benefitCount: result.actionDiceBenefits,
            bonusPoolId: input.bonusPoolId ?? "",
            ...surchargeFundingInput(input),
            ...unrolledPaymentFundingInput(input),
            purpose: loc`Hail Mary skill options`,
            benefit: "hailMary"
          })
        : perform();
    }

    async useFinalDeduction(options = {}) {
      if (!this.isOwner || !hasFinalDeduction(this.system))
        return refuse(loc`Final Deduction is not currently available.`);
      const epoch = String(this.usagePeriods.session ?? "initial"),
        study = finalDeductionStudy(this.flags?.spycraft2?.finalDeduction, epoch),
        esc = foundry.utils.escapeHTML;
      let input = options;
      if (!Object.hasOwn(input, "expectedRound")) {
        input = await systemDialog.input({
          window: { title: loc`Final Deduction study` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`${study ? loc`Continue ${esc(study.target)} after ${study.rounds} completed full rounds. Interruptions within this session preserve progress.` : loc`Begin one special-character study this session. First observe the target for at least one round in person or by audio/visual recording.`} Each confirmation records one additional completed full round. The GC supplies all revelations; ties and final ordering belong to the GC.`}</p><label>${loc`Target special character`} <input name="target" value="${esc(study?.target ?? "")}" ${study ? "readonly" : ""} required /></label>${study ? "" : `<label><input name="specialCharacterConfirmed" type="checkbox" /> ${loc`The target is a special character`}</label><label><input name="observedRoundConfirmed" type="checkbox" /> ${loc`I previously observed this target for at least one round`}</label>`}<label><input name="fullRoundConfirmed" type="checkbox" /> ${loc`I completed another full round studying this target`}</label>${(study?.rounds ?? 0) >= 4 ? `<label>${loc`Next information`} <select name="stage"><option value="classes">${loc`Next class and level`}</option><option value="skills">${loc`Next skill and ranks`}</option><option value="remaining">${loc`Remaining Subplots and proficiencies`}</option></select></label><label><input name="allClassesKnownConfirmed" type="checkbox" /> ${loc`All target class names and levels are already known`}</label><label><input name="allSkillsKnownConfirmed" type="checkbox" /> ${loc`All target skill names and ranks are already known`}</label>` : ""}</div>`
        });
        if (!input) return null;
        input = { ...input, expectedEpoch: epoch, expectedRound: study?.rounds ?? 0 };
      }
      return queueResources([this], async () => {
        if (!this.isOwner) throw new Error(loc`You must own this actor.`);
        const currentEpoch = String(this.usagePeriods.session ?? "initial"),
          before = structuredClone(this.flags?.spycraft2?.finalDeduction),
          plan = finalDeductionPlan(this.system, before, currentEpoch, input),
          updates = {
            "flags.spycraft2.finalDeduction": {
              epoch: plan.epoch,
              target: plan.target,
              rounds: plan.rounds,
              stage: plan.stage
            }
          };
        const previousUse = structuredClone(this.system.resourceUses?.finalDeduction);
        const spec = this.system.limitedUses?.find(s => s.id === "finalDeduction" && s.workflow === "finalDeduction");
        if (!spec) throw new Error(loc`Final Deduction is no longer available.`);
        if (plan.starting) {
          const use = resourceUsePlan(
            spec,
            this.system.resourceUses,
            this.usagePeriods,
            this.system.actionDice?.value ?? 0
          );
          if (use.blocked) return refuseStep(use.reason);
          updates["system.resourceUses.finalDeduction"] = use.record;
        } else {
          const status = resourceStatus(spec, this.system.resourceUses, this.usagePeriods);
          if (status.counterReview || status.used !== 1)
            throw new Error(loc`The GC must review this study’s session use count.`);
        }
        await this.update(updates);
        try {
          return await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Final Deduction: ${esc(plan.target)}, study round ${plan.rounds}. The GC supplies: ${esc(plan.revelation)}.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "informationRequest",
                actionDiceAllowed: false,
                finalDeduction: plan
              }
            }
          });
        } catch (error) {
          await this.update({
            ...(before ? { "flags.spycraft2.finalDeduction": before } : { "flags.spycraft2.-=finalDeduction": null }),
            ...(plan.starting
              ? previousUse === undefined
                ? { "system.resourceUses.-=finalDeduction": null }
                : { "system.resourceUses.finalDeduction": previousUse }
              : {})
          });
          throw error;
        }
      });
    }

    async useGlobalSearch(options = {}) {
      const source = globalSearchSource(this.system);
      if (!this.isOwner || !source) return refuse(loc`Global Search is not currently available.`);
      let input = options;
      if (!input.target) {
        input = await systemDialog.input({
          window: { title: loc`Record completed Global Search` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Complete ${source.hoursPerLevel} hours × target level while taking only free actions, then record this use. The GC supplies the city or 20-mile × 20-mile area.`}</p><label>${loc`Target special character`} <input name="target" required /></label><label>${loc`GC-supplied target level`} <input name="targetLevel" type="number" min="1" step="1" required /></label><label>${loc`Hours completed`} <input name="hoursCompleted" type="number" min="0" step="any" required /></label><label><input name="specialCharacterConfirmed" type="checkbox" /> ${loc`The target is a special character`}</label><label><input name="onlyFreeActionsConfirmed" type="checkbox" /> ${loc`I performed no other non-free actions during the required search time`}</label></div>`
        });
        if (!input) return null;
      }
      globalSearchPlan(this.system, input);
      return this.useLimitedAbility(
        "globalSearch",
        () => {
          const plan = globalSearchPlan(this.system, input);
          return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Global Search: ${foundry.utils.escapeHTML(plan.target)}; ${plan.requiredHours} hours completed. The GC supplies the city or 20-mile × 20-mile area containing this special character.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "informationRequest",
                actionDiceAllowed: false,
                globalSearch: plan
              }
            }
          });
        },
        { workflow: "globalSearch" }
      );
    }

    async useLittleDetails(options = {}) {
      if (!this.isOwner || !littleDetailsSource(this.system))
        return refuse(loc`Little Details is not currently available.`);
      let input = options;
      if (!input.action) {
        input = await systemDialog.input({
          window: { title: loc`Little Details` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`Free action`} <select name="action"><option value="smash">${loc`Athletics/Smash`}</option><option value="disarm">${loc`Disarm`}</option><option value="feint">${loc`Feint`}</option><option value="tire">${loc`Tire`}</option></select></label><label>${loc`Target / note`} <input name="target" /></label><label>${loc`Smash situational modifier`} <input type="number" name="modifier" value="0" /></label><label><input type="checkbox" name="actionLegalConfirmed" /> ${loc`Normal target/action requirements are satisfied; spend the free action`}</label><p>${loc`Consumes one session use and this round’s allowance. Disarm/Feint/Tire resolution remains at the table. Smash rolls normally, including skill cap/error and any applicable conditions.`}</p></div>`
        });
        if (!input) return null;
      }
      if (!["smash", "disarm", "feint", "tire"].includes(input.action) || input.actionLegalConfirmed !== true)
        throw new Error(loc`Confirm one legal Little Details action and its normal requirements.`);
      if (input.action === "smash")
        return this.rollSkill("athletics", "str", { ...input, check: "smash", littleDetails: true });
      return this.useLimitedAbility(
        "littleDetails",
        () =>
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Little Details: ${foundry.utils.escapeHTML(input.action)} as a free action${input.target ? " targeting " + foundry.utils.escapeHTML(input.target) : ""}. Resolve the normal action at the table.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "actionDeclaration",
                actionDiceAllowed: false,
                littleDetails: {
                  action: input.action,
                  target: String(input.target ?? ""),
                  round: this.system.resourceUses?.littleDetailsRound?.epoch ?? this.usagePeriods.round ?? "initial",
                  freeAction: true
                }
              }
            }
          }),
        { workflow: "littleDetails", additionalUses: [{ id: "littleDetailsRound", workflow: "littleDetailsRound" }] }
      );
    }

    resolveBrightIdeaSource(id = "") {
      const status = brightIdeaPoolStatus(this.system, this.usagePeriods);
      if (status.needsReview) {
        ui.notifications.warn(loc`The GC must allocate legacy combined Bright Idea uses on Classes first.`);
        return null;
      }
      const available = this.limitedUseStatus.filter(s => s.workflow === "brightIdea");
      const source = id ? available.find(s => s.id === id) : (available.find(s => s.remaining > 0) ?? available[0]);
      if (!source) {
        ui.notifications.warn(loc`No matching Bright Idea source is available.`);
        return null;
      }
      return source;
    }

    async rollKnowledge(options = {}) {
      let input = options;
      const esc = foundry.utils.escapeHTML;
      if (!input.skill) {
        input = await systemDialog.input({
          window: { title: loc`Knowledge` },
          rejectClose: false,
          content: rollPipeline.dialog({ dialog: "knowledge", actor: this, esc })
        });
        if (!input) return null;
      }
      input = rollPipeline.read({ dialog: "knowledge", actor: this }, input);
      const result = resolveKnowledgeCheck(this.system, input);
      if (result.blocked) return refuse(result.blockedReason);
      if (input.breakthrough)
        breakthroughPlan(this.system, this.items, CONFIG.SPYCRAFT, result, {
          checkKind: "knowledge",
          sourceAbility: input.breakthroughAbility,
          modifier: input.modifier
        });
      const additionalUses = [
        ...(input.breakthrough ? [{ id: "breakthrough", workflow: "breakthrough" }] : []),
        ...(input.cunningPlan ? [{ id: "cunningPlan", workflow: "cunningPlan" }] : []),
        ...(input.allOrNothing === true ? [{ id: "allOrNothing", workflow: "allOrNothing" }] : [])
      ];
      if (input.brightIdea && input.tenSecondSolution)
        throw new Error(loc`Choose one pre-roll class ability for Knowledge.`);
      if (input.brightIdea && result.method !== "roll")
        throw new Error(loc`Bright Idea requires a rolled Knowledge check.`);
      if ((input.brightIdea || input.tenSecondSolution) && result.rollMode === "blindroll" && !game.user?.isGM)
        throw new Error(loc`The GC resolves class abilities for passive Knowledge checks.`);
      const brightSource = input.brightIdea ? this.resolveBrightIdeaSource(input.brightIdeaSource) : null;
      if (input.brightIdea && !brightSource) return null;
      const perform = () => {
        const fresh = resolveKnowledgeCheck(this.system, input);
        if (fresh.blocked) throw new Error(fresh.blockedReason);
        if (input.breakthrough)
          Object.assign(
            fresh,
            breakthroughPlan(this.system, this.items, CONFIG.SPYCRAFT, fresh, {
              checkKind: "knowledge",
              sourceAbility: input.breakthroughAbility,
              modifier: input.modifier
            })
          );
        if ((input.brightIdea || input.tenSecondSolution) && fresh.rollMode === "blindroll" && !game.user?.isGM)
          throw new Error(loc`The GC resolves this passive Knowledge ability.`);
        return this.rollCheck(
          fresh.fixedDie ? `${fresh.fixedDie} + @total` : "1d20 + @total",
          { total: fresh.total },
          {
            planModifiers: fresh.planModifiers,
            featReminders: input.featReminders,
            photographicMemory: fresh.photographicMemory,
            cardSharkKnowledge: fresh.cardSharkKnowledge,
            validateSkillContext:
              fresh.cardSharkKnowledge || fresh.photographicMemory
                ? () => {
                    const now = resolveKnowledgeCheck(this.system, input);
                    if (
                      now.blocked ||
                      JSON.stringify([now.cardSharkKnowledge, now.photographicMemory]) !==
                        JSON.stringify([fresh.cardSharkKnowledge, fresh.photographicMemory])
                    )
                      throw new Error(
                        loc`The Knowledge scope, method or supporting feat source changed before posting.`
                      );
                  }
                : undefined,
            flavor: `${loc`Knowledge${input.topic ? `: ${esc(input.topic)}` : ""}`}<br><small>${esc(fresh.notes)}</small>`,
            threat: fresh.threat,
            error: fresh.error,
            cap: fresh.cap,
            rollMode: fresh.rollMode,
            actionDiceAllowed: fresh.actionDiceAllowed,
            checkMethod: fresh.method,
            checkKind: "knowledge",
            ...(Object.hasOwn(input, "oldSchool") ? { oldSchool: input.oldSchool } : {}),
            skillBonusCondition: fresh.skillBonusCondition,
            skillCheckAdjustment: fresh.checkAdjustment,
            underwaterContext: fresh.underwaterContext,
            skillKey: input.skill,
            focus: input.focus || "",
            ability: "int",
            cunningPlan: fresh.cunningPlan,
            breakthrough: fresh.breakthrough,
            additionalUses,
            chooseTwice: !!input.brightIdea,
            choiceSource: brightSource?.name,
            choiceResourceId: brightSource?.id,
            tenSecondSolution: !!input.tenSecondSolution,
            ...(input.allOrNothing === true ? { allOrNothing: true, allOrNothingCommitted: true } : {}),
            standaloneCheckConfirmed: !!input.standaloneCheckConfirmed,
            inComplexTask: !!input.inComplexTask,
            inDramaticConflict: !!input.inDramaticConflict
          }
        );
      };
      if (input.brightIdea)
        return this.useLimitedAbility(brightSource.id, () => perform(), { workflow: "brightIdea", additionalUses });
      if (additionalUses.length && !input.tenSecondSolution) {
        const [first, ...others] = additionalUses;
        return this.useLimitedAbility(first.id, () => perform(), { workflow: first.workflow, additionalUses: others });
      }
      return perform();
    }
  };
