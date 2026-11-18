/** Checks a character rolls: skills, Knowledge, saves, attacks, damage and action dice. */
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { rollPipeline } from "../../rolls/index.mjs";
import { formulaWithModifiers } from "../../rules/roll-pipeline.mjs";
import { enhanceSkillDialog } from "../../apps/skill-dialog-ux.mjs";
import { reachIncreaseFeet } from "../../rules/reach.mjs";
import { reachContextContent, reachContextInput } from "../../apps/reach.mjs";
import { fendTiming } from "../../rules/fend.mjs";
import { whirlingAttackProof } from "../../apps/whirling-stance.mjs";
import { validateTripCounterIntent } from "../../apps/counter-trip.mjs";
import { tripAttackContent, tripAttackTargetInput } from "../../apps/trip-attack.mjs";
import { grantedMeleeQuality, meleeTrickSourceFacts } from "../../rules/melee-tricks.mjs";
import { eligibleAttackDamageHits, makeAttackDamageProof } from "../../apps/attack-damage-benefits.mjs";
import { grippingAttackProof } from "../../rules/gripping-stance.mjs";
import { eligibleSideStanceHits, makeSideStanceDamageProof } from "../../apps/side-stance-damage.mjs";
import { combatStanceProof, combatStanceState } from "../../rules/combat-stance.mjs";
import { endCombatStance } from "../../apps/combat-stance.mjs";
import { missTrickSourceFacts } from "../../rules/miss-tricks.mjs";
import { validateCheapShotTarget } from "../../apps/cheap-shot.mjs";
import { conveyanceBullRushContent } from "../../apps/conveyance-bull-rush.mjs";
import { bullRushAttackContent } from "../../apps/bull-rush-attack.mjs";
import { bullRushDefenseContent } from "../../apps/bull-rush.mjs";
import { stillStandingSaveContent } from "../../apps/still-standing.mjs";
import { stillStandingTakedownPlan } from "../../rules/still-standing.mjs";
import { tumblePathContent } from "../../apps/tumble.mjs";
import { feintContent, feintTargetInput } from "../../apps/feint.mjs";
import { tripDefenseContent, tripDefenseTargetInput } from "../../apps/trip.mjs";
import { fallDistanceContent } from "../../apps/fall-distance.mjs";
import { balanceSurfaceContent } from "../../apps/balance.mjs";
import { hideCircumstanceContent } from "../../apps/hide-circumstances.mjs";
import { detectionObserverContext, detectionObserverContent } from "../../apps/detection-observer.mjs";
import { attributeDamageEvidence, validateAttributeDamageProof } from "../../rules/attribute-damage.mjs";
import { targetSkillContext, targetSkillEffectContent } from "../../apps/target-skill-effects.mjs";
import { stoneColdSavePlan } from "../../rules/stone-cold.mjs";
import { oldSchoolContext } from "../../apps/old-school.mjs";
import { oneHandManeuverUseProof } from "../../rules/maneuver-actions.mjs";
import {
  characterTargetContent,
  completeCharacterTarget,
  validateCharacterTarget,
  cleaveTargetRequired,
  attackCharacterTargetChoices,
  observedAttackTargetContent
} from "../../apps/character-target.mjs";
import { validateFinalRoundReservation } from "../../rules/final-round.mjs";
import { dartingStyleState } from "../../rules/darting-state.mjs";
import { superiorCoverState } from "../../rules/superior-cover.mjs";
import { saveCoverPlan } from "../../rules/cover.mjs";
import { saveCoverContent } from "../../apps/save-cover.mjs";
import {
  meleeTrickContent,
  meleeTrickInput,
  bullseyeContent,
  bullseyeInput,
  allOutAttackContent,
  allOutAttackInput,
  meleeFireContextContent,
  quickRangedAimContent,
  quickRangedAimInput,
  quickAttackActionContent,
  quickAttackActionInput
} from "../../apps/standard-attack-context.mjs";
import { cqbRangePlan, cqbRangedWeapon } from "../../rules/cqb.mjs";
import { twoWeaponStyleState } from "../../rules/two-weapon-state.mjs";
import { damageTargetChoices, resolveDamageTarget, sneakAttackTargetSnapshot } from "../../apps/damage-target.mjs";
import { actionDieBenefitQuote } from "../../rules/benefit-payments.mjs";
import { surchargeFundingInput, unrolledPaymentFundingInput } from "../../apps/action-die-benefits.mjs";
import { shakenRules } from "../../rules/shaken.mjs";
import { restraintActionBlock, restraintSourceSnapshot } from "../../rules/restraints.mjs";
import { getBaffledReview } from "../../rules/baffled.mjs";
import { uncannyDodgePlan, evasionPlan, evasionSaveContext } from "../../rules/defense.mjs";
import { sleepingSourceSnapshot } from "../../rules/sleeping.mjs";
import {
  attributeCollapsePlan,
  attributeActionBlock,
  conditionRollPenalties,
  conditionAbilityPenalty
} from "../../rules/attributes.mjs";
import { underwaterCheckPlan } from "../../rules/environment.mjs";
import { unnervingGrade, unnervingEligible, unnervingPlan } from "../../rules/unnerving.mjs";
import { hasFinalDeduction, finalDeductionStudy, finalDeductionPlan } from "../../rules/final-deduction.mjs";
import { globalSearchSource, globalSearchPlan } from "../../rules/global-search.mjs";
import { littleDetailsSource } from "../../rules/little-details.mjs";
import { TERRAIN_TYPES, LOCAL_HERO_OPPOSITION_SKILLS, terrainSavePlan } from "../../rules/terrain.mjs";
import { TRACKING_SURFACES } from "../../rules/tracking.mjs";
import { taskPressureUseProof } from "../../rules/task-pressure.mjs";
import { validateAnalysisTaskRoll } from "../../rules/analysis-tasks.mjs";
import { hasSneakAttackSource, sneakAttackDamagePlan } from "../../rules/sneak-attack.mjs";
import {
  gameHunterAttack,
  oneInAMillionEligible,
  tenSecondSolutionEligible,
  cunningPlanEffect
} from "../../rules/class-checks.mjs";
import { AMBIENT_LIGHT, FOG_SMOKE } from "../../rules/senses.mjs";
import { millionDollarSkillPlan } from "../../rules/sniper.mjs";
import { breakthroughPlan, nestPlan } from "../../rules/breakthrough.mjs";
import { brightIdeaPoolStatus } from "../../rules/bright-idea.mjs";
import { unrestrictedBonusPools, difficultSkillBonusPlan, checkBonusPool } from "../../rules/bonus-pools.mjs";
import { queueResources, isResourceLock } from "../../rules/transactions.mjs";
import { FIRE_MODES, bracedReflexPenalty } from "../../rules/firearms.mjs";
import { checkFlavor, rollEvidence } from "../../rules/outcomes.mjs";
import { specialistApplies } from "../../rules/weapon-specialist.mjs";
import { resourceStatus, resourceUsePlan } from "../../rules/limited-uses.mjs";
import { resolveKnowledgeCheck } from "../../rules/knowledge.mjs";
import {
  weaponAttack,
  weaponDamage,
  equipmentCategory,
  possessionUnavailable,
  cleanAndPolishedApplies
} from "../../rules/gear.mjs";
import { resolveSkillResult } from "../../rules/checks.mjs";
import { resolveSkillCheck } from "../../rules/skills.mjs";

export const ActorRolls = Base =>
  class ActorRolls extends Base {
    /**
     * Roll a d20 check and post it to chat with threat/error annotations.
     * @param {string} formula   e.g. "1d20 + @mod"
     * @param {object} data
     * @param {object} opts      { flavor, threat=20, error=1, cap }
     */
    async rollCheck(formula, data, options = {}) {
      let {
        flavor = "",
        threat = 20,
        error = 1,
        cap = null,
        rollMode,
        actionDiceAllowed = true,
        checkMethod = "roll",
        checkKind = "check",
        ability = "",
        skillKey = "",
        checkId = "",
        focus = "",
        rerollResources = [],
        practiceMakesPerfect = false,
        criticalFailureCostIncrease = 0,
        crossCheck = false,
        chooseTwice = false,
        choiceSource = "Bright Idea",
        choiceResourceId = "",
        weaponUuid = "",
        weaponProficiency = "",
        weaponQualities = "",
        cleanAndPolished = false,
        gearUuid = "",
        gearAttempt = null,
        attackContext = null,
        unarmed = false,
        improvised = false,
        cannotError = false,
        resultSource = "",
        opponentResult = null,
        requiredBonusPoolId = null
      } = options;
      const attributeDamage = attributeDamageEvidence(this.system, checkKind);
      if (Object.hasOwn(options, "attributeDamage"))
        validateAttributeDamageProof(this.system, options.attributeDamage, { checkKind });
      options = { ...options, attributeDamage };
      if (["skill", "knowledge", "attack"].includes(checkKind) && dartingStyleState(this.system).needsReview)
        throw new Error(dartingStyleState(this.system).reason);
      if (["skill", "knowledge", "attack"].includes(checkKind) && superiorCoverState(this.system).needsReview)
        throw new Error(superiorCoverState(this.system).reason);
      if (["skill", "knowledge", "attack"].includes(checkKind) && twoWeaponStyleState(this.system).needsReview)
        throw new Error(twoWeaponStyleState(this.system).reason);
      const conditionDamagePenalty =
        checkKind === "damage" ? (options.conditionDamagePenalty ?? conditionRollPenalties(this.system).damage) : 0;
      if (conditionDamagePenalty && !options.conditionDamageIncluded && !options.drivingStance)
        formula = `max(0, (${formula}) + (${conditionDamagePenalty}))`;
      if (checkKind === "save" && checkMethod !== "roll") {
        if (
          checkMethod !== "take10" ||
          checkId !== "ref" ||
          !evasionPlan(this.system).canTake10 ||
          chooseTwice ||
          options.oneInAMillion ||
          options.tenSecondSolution ||
          !/^1d20\b/.test(formula)
        )
          throw new Error("Only Evasion III may take 10 on a Reflex save, without roll-choice or forced-20 abilities.");
        formula = formula.replace(/^1d20\b/, "10");
        actionDiceAllowed = false;
        resultSource = "evasion";
      }
      if (
        checkKind === "skill" &&
        skillKey === "search" &&
        checkMethod === "roll" &&
        (this.system.classLevels?.fieldAnalyst ?? 0) >= 8
      ) {
        if (rollMode === "blindroll" && !game.user?.isGM)
          throw new Error("The GC resolves Eye for Detail for a secret or passive Search check.");
        chooseTwice = true;
        choiceSource = "Eye for Detail";
      }
      const million = !!options.oneInAMillion,
        solution = !!options.tenSecondSolution,
        twenty = million || solution;
      let cunning = typeof options.cunningPlan === "object" ? options.cunningPlan : null;
      if (options.cunningPlan === true) {
        cunning = cunningPlanEffect(this.system, error);
        if (!options.cunningPlanCommitted) {
          const extras = (options.additionalUses ?? []).filter(s => s.id !== "cunningPlan");
          if (!million && !solution)
            return this.useLimitedAbility(
              "cunningPlan",
              (status, payment) =>
                this.rollCheck(formula, data, {
                  ...options,
                  preRollFunding: this.preRollPaymentReceipt(payment) ?? options.preRollFunding,
                  cunningPlanCommitted: true
                }),
              {
                workflow: "cunningPlan",
                additionalCost: options.additionalCost ?? 0,
                additionalBenefitCount: options.additionalBenefitCount ?? ((options.additionalCost ?? 0) > 0 ? 1 : 0),
                ...surchargeFundingInput(options),
                ...unrolledPaymentFundingInput(options),
                additionalUses: extras,
                bonusPoolId: options.bonusPoolId ?? ""
              }
            );
          options = {
            ...options,
            cunningPlanCommitted: true,
            additionalUses: [...extras, { id: "cunningPlan", workflow: "cunningPlan" }]
          };
        }
        error = cunning.error;
      }

      if (million && solution) throw new Error("Choose one declared natural-20 ability.");
      if (solution && !options.solutionCommitted) {
        if (!tenSecondSolutionEligible(this.system, { ...options, chooseTwice }) || !/^1d20\b/.test(formula))
          throw new Error(
            "10-Second Solution requires Scientist 14 and a standalone rolled Intelligence skill or Knowledge check, without another roll-choice ability."
          );
        if (rollMode === "blindroll" && !game.user?.isGM)
          throw new Error("The GC resolves 10-Second Solution for a secret check.");
        return this.useLimitedAbility(
          "tenSecondSolution",
          (status, payment) => {
            if (!tenSecondSolutionEligible(this.system, { ...options, chooseTwice }))
              throw new Error("10-Second Solution no longer qualifies for this check.");
            if (options.refreshPaidSkill)
              return options.refreshPaidSkill(payment, {
                solutionCommitted: true,
                millionCommitted: options.millionCommitted === true
              });
            return this.rollCheck(formula, data, {
              ...options,
              preRollFunding: this.preRollPaymentReceipt(payment) ?? options.preRollFunding,
              solutionCommitted: true
            });
          },
          {
            workflow: "tenSecondSolution",
            additionalCost: options.additionalCost ?? 0,
            additionalBenefitCount: options.additionalBenefitCount ?? ((options.additionalCost ?? 0) > 0 ? 1 : 0),
            ...surchargeFundingInput(options),
            ...unrolledPaymentFundingInput(options),
            additionalUses: options.additionalUses ?? [],
            bonusPoolId: options.bonusPoolId ?? ""
          }
        );
      }
      if (million && !options.millionCommitted) {
        if (!oneInAMillionEligible(this.system, { ...options, chooseTwice }) || !/^1d20\b/.test(formula))
          throw new Error(
            "One in a Million requires Soldier 14 and a rolled attack, Fortitude save or Strength/Constitution skill check. It cannot combine with Bright Idea."
          );
        if (rollMode === "blindroll" && !game.user?.isGM)
          throw new Error("The GC resolves One in a Million for a secret check.");
        return this.useLimitedAbility(
          "oneInAMillion",
          (status, payment) => {
            if (!oneInAMillionEligible(this.system, { ...options, chooseTwice }))
              throw new Error("This check no longer qualifies for One in a Million.");
            if (options.refreshPaidSkill)
              return options.refreshPaidSkill(payment, {
                millionCommitted: true,
                solutionCommitted: options.solutionCommitted === true
              });
            return this.rollCheck(formula, data, {
              ...options,
              preRollFunding: this.preRollPaymentReceipt(payment) ?? options.preRollFunding,
              millionCommitted: true
            });
          },
          {
            workflow: "oneInAMillion",
            additionalCost: options.additionalCost ?? 0,
            additionalBenefitCount: options.additionalBenefitCount ?? ((options.additionalCost ?? 0) > 0 ? 1 : 0),
            ...surchargeFundingInput(options),
            ...unrolledPaymentFundingInput(options),
            additionalUses: options.additionalUses ?? [],
            bonusPoolId: options.bonusPoolId ?? ""
          }
        );
      }
      // Reservations, validation, modifiers and extra record fields come from the roll pipeline (module/rolls).
      const rollContext = {
        actor: this,
        options,
        checkKind,
        checkId,
        checkMethod,
        formula,
        data,
        weaponUuid,
        weaponProficiency,
        weaponQualities,
        skillKey,
        ability,
        attributeDamage,
        phase: "before"
      };
      const reservation = rollPipeline.acquire(rollContext);
      if (reservation) return reservation(extra => this.rollCheck(formula, data, { ...options, ...extra }));
      const oldSchoolScope = { ability, checkKind, resultSource },
        oldSchoolResult = await oldSchoolContext(this, oldSchoolScope, options);
      if (oldSchoolResult.cancelled) return null;
      const oldSchool = oldSchoolResult.evidence;
      rollContext.oldSchoolScope = oldSchoolScope;
      rollContext.oldSchool = oldSchool;
      for (const payment of [options.preRollFunding, options.rerollFunding])
        if (
          payment?.shakenSignature &&
          payment.shakenSignature !== JSON.stringify(shakenRules(this.actionDiceFundingSystem))
        )
          throw new Error("The Shaken condition changed before this paid check.");
      await rollPipeline.validate(rollContext);
      // Contributor modifiers apply to the dice only; the recorded formula stays as declared so a reroll adds them once.
      const pipelineModifiers = rollPipeline.modifiers(rollContext),
        rollFormula = formulaWithModifiers(formula, pipelineModifiers.total);
      const sleepSnapshot =
        checkKind === "skill" && skillKey === "notice" && checkId === "awareness" ? sleepingSourceSnapshot(this) : null;
      if (checkKind === "attack" && !options.rerollOf && options.attackContext?.ranged === true)
        await endCombatStance(this, this.system.combatStance?.id);
      let roll = await new Roll(twenty ? rollFormula.replace(/^1d20\b/, "20") : rollFormula, data).evaluate();
      let alternatives = null,
        chosenIndex = 0;
      if (chooseTwice) {
        const second = await new Roll(rollFormula, data).evaluate(),
          rolls = [roll, second];
        alternatives = rolls.map(r => ({ total: r.total, naturalDie: r.dice[0]?.total ?? null }));
        const selection = await systemDialog.input({
          window: { title: `${choiceSource}: choose the preferred result` },
          rejectClose: false,
          content: `<label>Result <select name="chosen">${alternatives.map((r, index) => `<option value="${index}">Roll ${index + 1}: ${r.total} (natural ${r.naturalDie})</option>`).join("")}</select></label><p>Closing this dialog keeps the first result.</p>`
        });
        chosenIndex = Number(selection?.chosen) === 1 ? 1 : 0;
        roll = rolls[chosenIndex];
      }
      for (const payment of [options.preRollFunding, options.rerollFunding])
        if (
          payment?.shakenSignature &&
          payment.shakenSignature !== JSON.stringify(shakenRules(this.actionDiceFundingSystem))
        )
          throw new Error("The Shaken condition changed while resolving this paid check.");
      rollContext.phase = "after";
      await rollPipeline.validate(rollContext);
      const die = twenty ? 20 : checkMethod === "roll" && checkKind !== "damage" ? (roll.dice[0]?.total ?? null) : null;
      const minimumAdjustment = practiceMakesPerfect && die !== null && die > error && die < 10 ? 10 - die : 0;
      const normalThreat = threat;
      if (twenty) threat = 20;
      const rawTotal = roll.total + minimumAdjustment + (oldSchool?.bonus ?? 0),
        resolved = resolveSkillResult(rawTotal, die, { cap, threat });
      const rollCombat = this.participatingCombat,
        recordedCombat = rollCombat?.started ? this.mentalLeapCombatContext(rollCombat) : null;
      const shaken = shakenRules(this.system);
      if (
        shaken.needsReview &&
        ["skill", "knowledge", "attack", "ability", "save", "initiative"].includes(options.checkKind)
      )
        throw new Error("Review the current Shaken sources before rolling.");
      const shakenContext = Object.hasOwn(options, "shakenContext")
        ? options.shakenContext
        : shaken.grade && ["skill", "knowledge", "attack", "ability", "save", "initiative"].includes(options.checkKind)
          ? { grade: shaken.grade, totalGrade: shaken.totalGrade, label: shaken.label }
          : null;
      validateAnalysisTaskRoll(this.system, options.analysisTask, {
        now: game.time?.worldTime ?? null,
        checkKind,
        skillKey,
        checkId,
        inCombat: !!this.participatingCombat
      });
      const check = {
        ...rollPipeline.flags(rollContext),
        ...(pipelineModifiers.rows.length ? { pipelineModifiers: pipelineModifiers.rows } : {}),
        attributeDamage,
        oldSchool,
        analysisTask: options.analysisTask
          ? {
              ...options.analysisTask,
              ...(options.analysisTask.stage === "pressure"
                ? {
                    pressureUse: taskPressureUseProof(this.system, options.analysisTask),
                    pressureRollId: foundry.utils.randomID()
                  }
                : {}),
              completedAt: game.time?.worldTime ?? null
            }
          : null,
        wheelFeat: options.wheelFeat
          ? {
              ...options.wheelFeat,
              ...(options.wheelFeat.free && !options.wheelFeat.use
                ? { use: structuredClone(this.system.resourceUses?.oneHandManeuver ?? null) }
                : {})
            }
          : null,
        shakenContext,
        baffledSaveBonus: options.baffledSaveBonus ?? 0,
        rollCombat: recordedCombat
          ? { id: recordedCombat.id, round: recordedCombat.round, combatantId: recordedCombat.combatantId }
          : null,
        sleepSnapshot,
        conditionAbilityAdjustment: options.conditionAbilityAdjustment ?? 0,
        conditionDamagePenalty,
        securityBonus: options.securityBonus ?? 0,
        fatigueBonus: options.fatigueBonus ?? 0,
        fatigueCondition: options.fatigueCondition ?? "",
        unnervingAvailableGrade: options.unnervingAvailableGrade ?? 0,
        littleDetails: options.littleDetails
          ? {
              ...options.littleDetails,
              round: this.system.resourceUses?.littleDetailsRound?.epoch ?? options.littleDetails.round
            }
          : null,
        cunningPlan: cunning,
        gcTakingPermissionConfirmed: options.gcTakingPermissionConfirmed === true,
        requiredBonusPoolId,
        requiredBonusSpent: false,
        cannotError: !!cannotError,
        resultSource,
        opponentResult,
        oneInAMillion: million,
        tenSecondSolution: solution,
        standaloneCheckConfirmed: !!options.standaloneCheckConfirmed,
        forcedThreat: twenty,
        noForcedReroll: twenty,
        normalThreat: options.normalThreat ?? normalThreat,
        rawTotal,
        rolledTotal: roll.total,
        minimumAdjustment,
        practiceMakesPerfect,
        criticalFailureCostIncrease,
        crossCheck,
        alternatives,
        chosenIndex,
        choiceSource: chooseTwice ? choiceSource : null,
        choiceResourceId: chooseTwice ? choiceResourceId : null,
        effectiveTotal: resolved.total,
        actorUuid: this.uuid,
        checkKind,
        ability,
        skillKey,
        checkId,
        focus,
        rerollResources,
        formula,
        rollData: structuredClone(data),
        rollMode,
        weaponUuid,
        weaponProficiency,
        weaponQualities,
        cleanAndPolished,
        gearUuid,
        gearAttempt,
        attackContext,
        unarmed,
        improvised,
        threat,
        error,
        cap,
        baseFlavor: flavor,
        boostTotal: 0,
        boostSpent: 0,
        capped: resolved.limited,
        naturalDie: die,
        checkMethod,
        actionDiceAllowed: checkMethod === "roll" && actionDiceAllowed,
        successConfirmed: null,
        errorConfirmed: false,
        threatConfirmed: false,
        triumphed: false
      };
      try {
        if (check.drivingStance)
          return await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: String(roll.total),
            rolls: [roll],
            blind: check.drivingStance.visibility.blind,
            whisper: check.drivingStance.visibility.whisper,
            flavor: checkFlavor(check),
            flags: { spycraft2: check }
          });
        return await roll.toMessage(
          { speaker: ChatMessage.getSpeaker({ actor: this }), flavor: checkFlavor(check), flags: { spycraft2: check } },
          { rollMode }
        );
      } catch (error) {
        if (check.analysisTask?.pressureRollId) {
          const posted = [...(game.messages ?? [])].find(
            m =>
              m.flags?.spycraft2?.actorUuid === this.uuid &&
              m.flags.spycraft2.analysisTask?.pressureRollId === check.analysisTask.pressureRollId &&
              rollEvidence(m.flags.spycraft2) === rollEvidence(check)
          );
          if (posted) return posted;
        }
        const receipt = check.preRollFunding?.id,
          posted =
            receipt &&
            [...(game.messages ?? [])].find(
              m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags?.spycraft2?.preRollFunding?.id === receipt
            );
        if (posted) return posted;
        throw error;
      }
    }

    async rollAbility(key, options = {}) {
      if (!Object.hasOwn(CONFIG.SPYCRAFT.abilities, key)) return null;
      const blocked =
        restraintActionBlock(this.system) ||
        attributeActionBlock(this.system, {
          kind: "ability",
          ability: key,
          purelyMentalConfirmed: options.purelyMentalConfirmed
        });
      if (blocked) return ui.notifications.warn(blocked);
      const conditionAbilityAdjustment = conditionAbilityPenalty(this.system, key),
        mod = (this.system.abilities[key]?.mod ?? 0) + conditionAbilityAdjustment;
      return this.rollCheck(
        "1d20 + @mod",
        { mod },
        {
          flavor:
            game.i18n.localize(CONFIG.SPYCRAFT.abilities[key]) + (conditionAbilityAdjustment ? " — Drunk −2" : ""),
          checkKind: "ability",
          ability: key,
          conditionAbilityAdjustment,
          ...(Object.hasOwn(options, "oldSchool") ? { oldSchool: options.oldSchool } : {})
        }
      );
    }

    async rollSave(key, options = {}) {
      let input = options;
      if (!CONFIG.SPYCRAFT.saves[key]) return null;
      if (attributeCollapsePlan(this.system).dead || this.system.conditionContext?.dead || this.statuses?.has("dead"))
        return ui.notifications.warn("A dead character cannot make a saving throw.");
      const feats = new Set(this.system.activeFeatNames ?? []),
        manualStandingContent = stillStandingSaveContent(this.system, key),
        stillStandingContent =
          options.takedown && manualStandingContent
            ? "<p>This recorded Fortitude save resists takedown. Earned Still Standing applies automatically.</p>"
            : manualStandingContent;
      if (
        input.askContext &&
        (key === "ref" ||
          feats.has("Swamp Training") ||
          feats.has("Firefighter Training") ||
          feats.has("Disease Basics") ||
          feats.has("Poison Basics") ||
          this.system.mentalLeapState?.fatigueSaveBonus ||
          this.system.conditionContext?.baffled === true ||
          !!stillStandingContent)
      ) {
        input = await systemDialog.input({
          window: { title: game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label) },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${stillStandingContent}${this.system.conditionContext?.baffled === true ? '<label><input type="checkbox" name="resistingBaffled" /> This save resists becoming Baffled (+8)</label>' : ""}${this.system.mentalLeapState?.fatigueSaveBonus ? '<label>Fatigue-related save <select name="fatigueCondition"><option value="">Other save</option><option value="fatigue">Resists becoming fatigued</option><option value="exhaustion">Resists becoming exhausted</option></select></label>' : ""}${key === "ref" ? saveCoverContent(this.system) : ""}${key === "ref" ? '<label><input type="checkbox" name="reflexReducesDamage" /> The source allows this Reflex save to reduce damage</label><label><input type="checkbox" name="flatFooted" /> I am flat-footed against this attack or event</label>' : ""}${key === "ref" && evasionPlan(this.system).canTake10 ? '<label>Method <select name="checkMethod"><option value="roll">Roll d20</option><option value="take10">Take 10 (Evasion III)</option></select></label>' : ""}${key === "ref" && uncannyDodgePlan(this.system).securityBonus ? '<label><input type="checkbox" name="securityDevice" /> This Reflex save avoids a security device (Uncanny Dodge +4)</label>' : ""}${key === "ref" ? '<label><input type="checkbox" name="braced" /> I am currently braced (apply the Brace Reflex penalty)</label><label><input type="checkbox" name="underwater" /> I am underwater</label>' : ""}${feats.has("Swamp Training") || feats.has("Poison Basics") ? '<label><input type="checkbox" name="poison" /> This save resists poison (owned Poison Basics / Swamp Training)</label>' : ""}${feats.has("Disease Basics") ? '<label><input type="checkbox" name="disease" /> This save resists disease (Disease Basics)</label>' : ""}${feats.has("Firefighter Training") && key === "ref" ? '<label><input type="checkbox" name="avoidCatchingFire" /> This Reflex save avoids catching fire (Firefighter Training)</label>' : ""}${feats.has("Firefighter Training") && key === "fort" ? '<label><input type="checkbox" name="smokeInhalation" /> This Fortitude save resists smoke inhalation (Firefighter Training)</label>' : ""}</div>`
        });
        if (!input) return null;
      }
      if (options.takedown) input = { ...input, resistingTakedown: true, takedownAttackConfirmed: true };
      let stillStandingSave;
      try {
        stillStandingSave = stillStandingTakedownPlan(this.system, { ...input, saveKey: key });
      } catch (error) {
        return ui.notifications.warn(error.message);
      }
      const coverSave = saveCoverPlan(key, input, this.system),
        stoneCold = stoneColdSavePlan(this.system, key, this.mentalLeapCombatContext());
      const penalty = key === "ref" && input.braced ? bracedReflexPenalty(this.system) : 0,
        terrainSave = terrainSavePlan(this.system, key, input);
      const underwaterContext = underwaterCheckPlan(this.system, { ...input, kind: "save", saveKey: key });
      const fatigueBonus =
        input.fatigueCondition === "fatigue"
          ? (this.system.mentalLeapState?.fatigueSaveBonus ?? 0)
          : input.fatigueCondition === "exhaustion"
            ? (this.system.mentalLeapState?.exhaustionSaveBonus ?? 0)
            : 0;
      if (input.resistingBaffled === true && getBaffledReview(this).needsReview)
        return ui.notifications.warn("The GC must review the interrupted Baffled event before this resistance save.");
      const baffledSaveBonus =
        this.system.conditionContext?.baffled === true && input.resistingBaffled === true ? 8 : 0;
      const checkMethod = input.checkMethod ?? "roll";
      if (shakenRules(this.system).needsReview)
        return ui.notifications.warn("Review the current Shaken sources before saving throws.");
      if (["take10", "take20"].includes(checkMethod) && shakenRules(this.system).fixedResultsForbidden)
        return ui.notifications.warn("Shaken: taking 10 or 20 is unavailable (p.342).");
      if (checkMethod !== "roll" && (checkMethod !== "take10" || key !== "ref" || !evasionPlan(this.system).canTake10))
        return ui.notifications.warn("Only Evasion III permits taking 10 with a Reflex save.");
      const evasionContext =
        key === "ref"
          ? evasionSaveContext(this.system, {
              flatFooted: input.flatFooted === true,
              reflexReducesDamage: input.reflexReducesDamage === true
            })
          : null;
      const securityBonus =
        key === "ref" && input.securityDevice === true ? uncannyDodgePlan(this.system).securityBonus : 0;
      const total =
        (this.system.saves?.[key]?.total ?? 0) +
        (stillStandingSave?.bonus ?? 0) +
        (stoneCold?.bonus ?? 0) +
        penalty +
        terrainSave.adjustment +
        underwaterContext.penalty +
        fatigueBonus +
        securityBonus +
        baffledSaveBonus +
        (coverSave?.bonus ?? 0);
      return this.rollCheck(
        "1d20 + @total",
        { total },
        {
          flavor:
            game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label) +
            (checkMethod === "take10" ? " — Evasion III: take 10" : "") +
            (options.takedown ? " — Takedown DC" + Number(options.takedown.dc) : "") +
            (options.damageSave ? ` — Damage event DC${Number(options.damageSave.dc)}` : "") +
            (coverSave?.bonus ? ` — Cover/Reflex +${coverSave.bonus}` : "") +
            (securityBonus ? ` — Uncanny Dodge/security device +${securityBonus}` : "") +
            (baffledSaveBonus ? " — Baffled resistance +8" : "") +
            (fatigueBonus ? ` — Fatigue/exhaustion resistance +${fatigueBonus}` : "") +
            (stillStandingSave?.bonus ? " — Still Standing: takedown Fortitude +8" : "") +
            (stoneCold ? " — Stone Cold: combat Will +1" : "") +
            (penalty ? ` — Brace ${penalty}` : "") +
            (underwaterContext.notes.length ? ` — ${underwaterContext.notes.join(" ")}` : "") +
            (terrainSave.notes.length ? ` — ${terrainSave.notes.join(" ")}` : ""),
          takedown: options.takedown ?? null,
          takedownLease: options.takedownLease,
          cheapShotRecovery: options.cheapShotRecovery ?? null,
          validateCheapShotRecovery: options.validateCheapShotRecovery,
          damageSave: options.damageSave ?? null,
          validateDamageSave: options.validateDamageSave,
          coverSave,
          stoneCold,
          stillStandingSave,
          checkMethod,
          evasionContext,
          securityBonus,
          baffledSaveBonus,
          fatigueBonus,
          fatigueCondition: input.fatigueCondition ?? "",
          underwaterContext,
          terrainSave,
          terrainSaveSource: terrainSave.bonuses.length ? { version: 1, checkId: key, plan: terrainSave } : null,
          validateSaveContext:
            terrainSave.bonuses.length || stillStandingSave
              ? () => {
                  if (
                    JSON.stringify(terrainSavePlan(this.system, key, input)) !== JSON.stringify(terrainSave) ||
                    JSON.stringify(stillStandingTakedownPlan(this.system, { ...input, saveKey: key })) !==
                      JSON.stringify(stillStandingSave)
                  )
                    throw new Error(
                      "The conditional save feat, Still Standing source or confirmed save purpose changed before posting."
                    );
                }
              : undefined,
          checkKind: "save",
          checkId: key,
          threat: 0,
          error: 0,
          oneInAMillion: !!input.oneInAMillion
        }
      );
    }

    async rollSkill(key, ability = null, options = {}) {
      if (options.tripCounter) validateTripCounterIntent(this, options.tripCounter, options.tripCounterLease);
      const restraintRollSource = restraintSourceSnapshot(this),
        restraintRollSize = this.system.size;
      const skill = this.system.skillTotals?.[key];
      const optionalRules = game.settings?.get("spycraft2", "linguistics") ? ["linguistics"] : [];
      const checks = rollPipeline.skillChecks(
        { actor: this, checkKind: "skill", skillKey: key, options, optionalRules },
        CONFIG.SPYCRAFT.skills[key]?.checks ?? []
      );
      if (!skill || !checks.length) return null;
      let input = options;
      if (!input.check) {
        const esc = foundry.utils.escapeHTML;
        const choices = checks
          .map(
            check =>
              `<option value="${check.id}"${options.initialCheck === check.id ? " selected" : ""}>${esc(check.name)} (${check.attributes.join("/").toUpperCase()}, ${esc(check.mode)}, error 1–${check.error})</option>`
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
          rejectClose: false,
          ok: { label: "Roll check" },
          render: (event, dialog) => enhanceSkillDialog(event, dialog, checks),
          content: `<div class="spycraft2-roll-options">${key === "athletics" && (this.system.conditionContext?.held || this.system.conditionContext?.pinned) ? '<fieldset><legend>Opposed Grapple escape</legend><label>Applicable proficiency <select name="grappleProficient"><option value="">Choose for this Grapple</option><option value="true">Proficient</option><option value="false">Not proficient: two full actions, error +2</option></select></label><label>My Size categories minus opponent Size categories <input name="grappleSizeDifference" type="number" step="1" min="-20" max="20" value="0" /></label><label><input name="grappleContextConfirmed" type="checkbox" /> The GC confirms the participants, applicable proficiency and Size difference</label><p>Each larger participant gains +4 per Size category on their own check. This check uses Grasp and Armor Check Penalty; static-restraint Escape has separate rules.</p></fieldset>' : ""}${key === "athletics" && restraintRollSource.sources.length ? `<p>Current restraint sources: ${restraintRollSource.sources.map(s => esc(s.name ?? s.id)).join(", ")}.</p>` : ""}${key === "athletics" && restraintRollSource.sources.length > 1 ? '<label><input name="grappleAllSourcesConfirmed" type="checkbox" /> The GC confirms all current Held/Pinned sources belong to this same grapple; unrelated sources require separate adjudication</label>' : ""}<label>Skill check <select name="check">${choices}</select></label>
          <label>Attribute (when permitted) <select name="ability">${abilities}</select></label>
          ${key === "analysis" || (key === "resolve" && Object.values(this.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active")) ? "<details><summary>Complex Analysis Task</summary>" : ""}
            ${key === "analysis" && this.system.activeFeatNames?.some(n => ["Forensic Genius", "Tracking Mastery"].includes(n)) ? `<fieldset><legend>Complex Analysis challenge count</legend><label><input type="checkbox" name="complexAnalysisTask" /> Declare an unrecorded Complex Analysis Task</label><label>GC’s unmodified number of Challenges <input name="analysisBaseChallenges" type="number" min="2" step="1" /></label><p>Forensic Genius reduces the required count by2; Tracking Mastery reduces an Analysis/Forensics task by1(minimum1 after all reductions). A selected recorded task supplies its own count; use this declaration only for an unrecorded task (pp.207,209).</p></fieldset>` : ""}
            ${
              key === "analysis" ||
              (key === "resolve" &&
                Object.values(this.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active"))
                ? `<label>Recorded Complex Analysis Task <select name="analysisTaskId"><option value="">None</option>${Object.entries(
                    this.system.analysisTasks ?? {}
                  )
                    .filter(([, t]) => t.status === "active" && (key === "analysis" || t.pressured))
                    .map(
                      ([id, t]) =>
                        `<option value="${esc(id)}">${esc(t.title)} (${esc(t.completed)}/${esc(t.requiredChallenges)})</option>`
                    )
                    .join("")}</select></label>`
                : ""
            }
            ${key === "resolve" && Object.values(this.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active") ? `<label>Upcoming Challenge DC (Task Pressure only)<input name="taskChallengeDC" type="number" step="1" min="0" /></label><label><input name="taskChallengeDCConfirmed" type="checkbox" /> The GC confirms this is the actual upcoming Challenge DC</label>` : ""}
          ${key === "analysis" || (key === "resolve" && Object.values(this.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active")) ? "</details>" : ""}
          ${["intimidate", "resolve"].includes(key) ? `<details><summary>Threaten action / response (pp.180,361)</summary><p>Choose Threaten (Intimidate/Wis) or Resist Threaten (Resolve/Wis) above. These are opposed checks with Hearing and Language tags; taking10/20 is unavailable. The GC resolves the opposed outcome, stress/fright and next-attack effects.</p><label>Opposing character name <input name="threatenOpponentName" maxlength="200" /></label><label><input name="threatenOpponentConfirmed" type="checkbox" /> The named character is my opponent</label><label><input name="threatenContextConfirmed" type="checkbox" /> The GC confirms these Threaten circumstances and participants</label><label>Held/readied ranged weapon for CQB benefits <select name="threatenWeaponId"><option value="">None</option>${(this.system.readiedRangedWeapons ?? []).map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select></label>${key === "intimidate" ? '<label>Measured target distance (ft.) <input name="threatenDistanceFeet" type="number" min="0" step="any" /></label><label>Vitality lost to my attacks <input name="threatenVitalityLoss" type="number" min="0" step="1" value="0" /></label><label>Wounds lost to my attacks <input name="threatenWoundLoss" type="number" min="0" step="1" value="0" /></label><label><input name="threatenInjuryFromYourAttacksConfirmed" type="checkbox" /> The GC confirms these losses were caused by my attacks</label><p>The target must have lost5vitality or1wound to your attacks. CQB Mastery waives this requirement while you hold a readied ranged weapon. Glint of Madness waives it without requiring a weapon. Use your own Initiative Count.</p>' : '<label><input name="threatenIncomingLegalConfirmed" type="checkbox" /> The GC confirms this responds to a legal incoming Threaten action, including the attacker’s CQB Range and prior-injury requirement or exception</label>'}</details>` : ""}
          ${targetSkillEffectContent(key)}${detectionObserverContent(key)}
          ${conveyanceBullRushContent(key)}${bullRushAttackContent(key)}${bullRushDefenseContent(key)}${tumblePathContent(key)}${tripAttackContent(key, this)}${tripDefenseContent(key, this)}${feintContent(key, this)}${fallDistanceContent(key)}${balanceSurfaceContent(key)}${hideCircumstanceContent(key)}
          ${key === "sneak" && ["side", "stalking"].includes(combatStanceState(this.system)?.key) ? '<label>Combat stance: distance this Hide route adds toward the 20 ft. round limit (ft.; required only for included movement) <input name="stanceDistanceFeet" type="number" min="0" step="any" /></label><p>Check the recorded total on Main; record the completed round total after moving.</p>' : ""}
          ${key === "sneak" ? '<details><summary>Included Hide ground movement</summary><p>For a rolled Sneak/Hide check. This includes the ground movement check modifier and separate error increase. Ghost Basics doubles the included current-Speed allowance. Resolve other movement modes separately.</p><label><input name="hideMovement" type="checkbox" /> Declare movement included in this Hide action</label><label>Counted movement (ft.) <input name="hideDistanceFeet" type="number" min="0" step="any" value="0" /></label><label><input name="hideAdjacentThreat" type="checkbox" /> Starting adjacent to a threatening opponent</label><label><input name="hidePassesThreat" type="checkbox" /> Continuing after entering threatening adjacency</label><label><input name="hideRouteConfirmed" type="checkbox" /> The GC confirms this ordinary ground route, counted distance and terrain costs; no balancing, climbing, swimming or water entry/exit</label><label><input name="hideActionConfirmed" type="checkbox" /> I take the legal action required for this Hide check (normally one full action)</label></details>' : ""}
          ${key === "sneak" && this.system.activeFeatNames?.includes("Ghost Basics") ? '<details><summary>Ghost Basics Hide targets</summary><p>Only Sneak/Hide. Normal strongest-positive synergy stacking applies.</p><label>Hide target type <select name="ghostHideTargetKind"><option value="">No Ghost Basics target synergy</option><option value="sensor">Security sensor</option><option value="living">Living opponent</option><option value="both">Both security sensors and living opponents</option></select></label><label>Actual sensor / living opponent <input name="ghostHideTargetName" maxlength="200" /></label><label><input name="ghostHideConfirmed" type="checkbox" /> The GC confirms this Hide check evades the named target types</label></details>' : ""}
          <details><summary>Focus, forte and synergy</summary>
            <label>Applicable focus (blank uses the check name) <input name="focus" /></label>
            <label><input type="checkbox" name="forte" /> An owned forte applies</label>
            <label>Synergy skill <select name="synergySkill"><option value="auto">Best listed unconditional synergy</option><option value="none">None</option>${Object.entries(
              CONFIG.SPYCRAFT.skills
            )
              .map(([key, skill]) => `<option value="${key}">${esc(skill.name)}</option>`)
              .join("")}</select></label>
            ${key === "impress" && this.system.activeFeatNames?.includes("Professional Driver - Closed Course") ? `<fieldset><legend>Professional Driver — Closed Course</legend><label><input type="checkbox" name="closedCourseSeesYou" /> The target has line of sight to you</label><label><input type="checkbox" name="closedCourseSeesVehicle" /> The target has line of sight to your vehicle</label><p>Both are required for Acrobatics or Drive synergy (p.193).</p></fieldset>` : ""}
            <label>Synergy focus <input name="synergyFocus" /></label>
            <label><input type="checkbox" name="synergyConditionMet" /> Listed synergy circumstances apply</label>
            <label><input type="checkbox" name="gcApprovedSynergy" /> GC approved an additional synergy</label>
          </details>
          <details><summary>Weapon work — Weapon Focus</summary>
            <label><input name="weaponWork" type="checkbox" /> Apply Weapon Focus to this weapon Build, Modify or Repair DC</label>
            <label>Owned target weapon/model <select name="weaponWorkItemId"><option value="">GC-confirmed model or other target below</option>${(this.items?.filter(i => i.type === "weapon") ?? []).map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("")}</select></label>
            <label>Other target weapon/model <input name="weaponWorkName" /></label>
            <label>Other target proficiency <select name="weaponWorkProficiency">${Object.entries(
              CONFIG.SPYCRAFT.proficiencies
            )
              .filter(([k]) => k !== "unarmed")
              .map(([k, n]) => `<option value="${esc(k)}">${esc(n.label ?? n)}</option>`)
              .join("")}</select></label>
            <label>DC before Weapon Focus <input name="weaponWorkDC" type="number" min="0" step="1" /></label>
            <label><input name="weaponWorkConfirmed" type="checkbox" /> The GC confirms the target weapon, proficiency and unmodified DC</label>
            <p>The selected owned weapon supplies its actual proficiency. For an unowned or not-yet-built model, confirm its specifications with the GC. Weapon Focus changes the DC, not the roll total.</p>
          </details>
          <details><summary>Required gear and kits</summary>
            <label>Required gear <select name="gearStatus"><option value="unknown">Confirm for Gear / Gear Only checks</option><option value="available">All required gear is available</option><option value="missing">Required gear is missing</option></select></label>
            <label><input type="checkbox" name="kitAtLocation" /> I am at the selected non-portable kit’s recorded location</label>
            <label>Gear being used <select name="gearItem"><option value="">None</option>${(this.items?.filter(item => ["weapon", "armor", "gear"].includes(item.type) && !isResourceLock(item) && !item.system.reserve && !item.system.destroyed && item.system.quantity !== 0 && !possessionUnavailable(item.system)) ?? []).map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}</select></label>
          </details>
          ${
            key === "networking"
              ? `<label>Contact being called <select name="contactName"><option value="">Unspecified / not a Contact check</option>${(
                  this.system.contacts ?? []
                )
                  .filter(c => c.name?.trim())
                  .map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`)
                  .join(
                    ""
                  )}</select></label><label>Current mission Threat Level (for the selected Contact check) <input name="contactThreatLevel" type="number" min="1" max="20" step="1" /></label><p>For a contact feat’s initial associate, select their uniquely named Training record and configure that feat’s primary contact and GC-approved theme.</p>`
              : ""
          }
          <details><summary>Time and class circumstances</summary>
            <label><input type="checkbox" name="inCombat" /> Additional combat for this Medicine check</label>
            <label><input type="checkbox" name="combatInSight" /> Surgery: combat occurred within line of sight at any time during the check</label>
            <label><input type="checkbox" name="complexTaskNearby" /> Therapy: someone is performing a Complex Task in my presence</label>
            <label><input type="checkbox" name="dramaticConflictNearby" /> Therapy: someone is performing a Dramatic Conflict in my presence</label>
            ${(this.system.originEffects ?? []).some(effect => effect.qualityKey === "seductive") ? '<label><input type="checkbox" name="shiftingDisposition" /> Seductive: this check actually shifts disposition</label><label><input type="checkbox" name="seductionConflict" /> Seductive: this check is part of a seduction Dramatic Conflict</label>' : ""}
            <label><input type="checkbox" name="oneHanded" /> Only one hand available for this Hands-On check</label>
            <label><input type="checkbox" name="noSharedLanguage" /> No shared language or relevant local tongue for this Language check</label>
            <label><input type="checkbox" name="bound" /> Additional bound condition for this check</label>
            <label><input type="checkbox" name="conveyingMessage" /> Innuendo: I am conveying a message (adds Hands-On)</label>
            <label>Ambush preparation (Tactics/Ambush only) <select name="ambushPreparation"><option value="slow">Slow: 10 minutes, no quick-check error increase</option><option value="quick">Quick: 1 minute, error range +2</option></select></label>
            <label>Ambush role <select name="ambushRole"><option value="">Unspecified</option><option value="leader">Leader</option><option value="helper">Helper</option></select></label>
            <label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10</option><option value="take20">Take 20</option></select></label>
            <label><input type="checkbox" name="safeToTake" /> Neither distracted nor endangered</label>
            <label><input type="checkbox" name="gcTakingPermissionConfirmed" /> GC permits taking 10/20 when this named check requires permission</label>
            ${key === "blend" && this.system.activeFeatNames?.some(n => ["Gorgeous", "The Look", "Simply Irresistible"].includes(n)) ? '<label><input type="checkbox" name="manhuntPrey" /> This Blend check is made as the Prey during a manhunt (Gorgeous/The Look/Simply Irresistible)</label>' : ""}
            ${key === "impress" && this.system.activeFeatNames?.includes("Charmer") ? `<fieldset><legend>Charmer — Influence timing (p.202)</legend><label><input type="checkbox" name="charmer" /> Use Charmer</label><label>NPC name <input type="text" name="charmerTarget" maxlength="200" /></label><label>Disposition toward you <select name="charmerDisposition"><option value="">Choose disposition</option><option value="neutral">Neutral</option><option value="intrigued">Intrigued</option><option value="friendly">Friendly</option></select></label><label>Influence duration <select name="charmerDuration"><option value="quick">Quick: scene benefit (normally 1 minute)</option><option value="slow">Slow: mission benefit (normally 10 minutes)</option></select></label><label><input type="checkbox" name="charmerNPCConfirmed" /> GC confirms this named NPC and their disposition toward me</label><p>Select one Influence timing feat. Actions and resulting disposition remain resolved at the table.</p></fieldset>` : ""}
            ${key === "impress" && this.system.activeFeatNames?.includes("Hard Core") ? `<fieldset><legend>Hard Core — Influence timing (p.203)</legend><label><input type="checkbox" name="hardCore" /> Use Hard Core</label><label>NPC name <input type="text" name="hardCoreTarget" maxlength="200" /></label><label>Disposition toward you <select name="hardCoreDisposition"><option value="">Choose disposition</option><option value="aloof">Aloof</option><option value="unfriendly">Unfriendly</option><option value="hostile">Hostile</option></select></label><label>Influence duration <select name="influenceDuration"><option value="quick">Quick: scene benefit (normally 1 minute)</option><option value="slow">Slow: mission benefit (normally 10 minutes)</option></select></label><label><input type="checkbox" name="hardCoreNPCConfirmed" /> GC confirms this named NPC and their disposition toward me</label><p>The single chosen time reduction applies before taking 10/20 or Cross-Check. Actions and resulting disposition remain resolved at the table.</p></fieldset>` : ""}
            ${this.system.activeFeatNames?.includes("One Hand on the Wheel") ? `<fieldset><legend>One Hand on the Wheel</legend><label><input type="checkbox" name="wheelFreeManeuver" /> Use a free Maneuver (${this.limitedUseStatus.find(s => s.id === "oneHandManeuver")?.remaining ?? 0} / ${this.limitedUseStatus.find(s => s.id === "oneHandManeuver")?.limit ?? 0} uses this scene; Maneuver checks only)</label><label><input type="checkbox" name="wheelFreeActionConfirmed" /> The GC confirms this legal Maneuver may be a free action now (my Initiative Count in combat)</label></fieldset>` : ""}
            <label>Time reduction (one source, p.102) <select name="timingReduction"><option value="auto">Choose fastest available (review minima for variable times)</option><option value="none">No reduction</option><option value="take10">Normal-time take 10 (class ability / forte)</option><option value="falseStart">False Start (take 20)</option><option value="professional">Mark of a Professional (unopposed)</option><option value="class">Applicable class time reduction</option><option value="ambushMastery">Ambush Mastery (quick ambush; error +2)</option><option value="ambushSupremacy">Ambush Supremacy (slow ambush; error +2)</option><option value="irresistible">Simply Irresistible (Impress/Networking)</option><option value="contactMission">Lower-Threat mission Contact time</option><option value="contactFeat">Initial contact feat (chosen contact)</option><option value="charmer">Charmer (confirmed Influence NPC)</option><option value="hardCore">Hard Core (confirmed Influence NPC)</option><option value="solution">10-Second Solution (declare below)</option><option value="questionsI">All the Right Questions I (Field Analyst 3; error +1)</option><option value="questionsII">All the Right Questions II (Field Analyst 7; error +2)</option></select></label>
            <label><input type="checkbox" name="unopposed" /> Unopposed check</label>
            ${this.system.activeFeatNames?.some(n => ["Always Get Your Man", "Escape and Evasion Training"].includes(n)) ? '<label>Role for this manhunt check <select name="manhuntRole"><option value="">Not a manhunt</option><option value="predator">Predator</option><option value="prey">Prey</option></select></label><label>Role for this chase Maneuver <select name="chaseRole"><option value="">Not a chase Maneuver</option><option value="predator">Predator</option><option value="prey">Prey</option></select></label>' : ""}
            <label><input type="checkbox" name="crossCheckActive" /> Cross-Check: triple time for an active check</label>
            ${key === "bluff" && this.system.activeFeatNames?.includes("Superior Documentation") ? '<fieldset><legend>Superior Documentation</legend><label><input name="usingCoverIdentity" type="checkbox" /> Use the +1 gear bonus while using a cover identity</label><label>Cover identity name <input name="coverIdentityName" maxlength="200" /></label><label><input name="coverIdentityConfirmed" type="checkbox" /> The GC confirms I am using this cover identity for this Bluff check</label></fieldset>' : ""}
            ${["sleightOfHand", "sneak"].includes(key) && this.system.activeFeatNames?.includes("Bug Basics") ? '<fieldset><legend>Bug Basics — Stash Item only</legend><label><input name="concealingBug" type="checkbox" /> Use the +2 gear bonus to conceal a bug</label><label>Bug name <input name="bugName" maxlength="200" /></label><label><input name="bugConcealmentConfirmed" type="checkbox" /> The GC confirms this Stash Item check conceals this bug</label></fieldset>' : ""}
            <label><input type="checkbox" name="usingComputer" /> Research is being performed using a computer</label>
            <label><input type="checkbox" name="installingTrap" /> Installation is setting a trap</label>
            <label><input type="checkbox" name="surprise" /> This check determines surprise</label>
            <label><input type="checkbox" name="deafened" /> Additional deafness for this check (Improved hearing cannot apply)</label>
            <label><input type="checkbox" name="blinded" /> Additional blindness for this check</label>
            <label><input type="checkbox" name="targetDeafened" /> This check targets a deafened character (Language cap −20)</label>
            <label><input type="checkbox" name="requiresEyesight" /> The GC confirms this check requires eyesight or eye-hand coordination</label>
            <label><input type="checkbox" name="requiresHearing" /> The GC confirms this check requires hearing</label>
            <label><input type="checkbox" name="targetCharacter" /> Night Training: this check targets a character</label>
            <label>Distance to that character (ft., Night Training) <input name="distanceFeet" type="number" min="0" step="any" /></label>
            <label><input type="checkbox" name="scentUsable" /> I can rely on scent for this Tracking check (Improved scent)</label>
            <label>Fog/smoke <select name="obscurant"><option value="">Unspecified</option><option value="fog">Fog</option><option value="smoke">Smoke</option></select></label>
            <label>Fog/smoke density <select name="obscurantDensity"><option value="">Unspecified</option>${Object.entries(
              FOG_SMOKE
            )
              .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
              .join("")}</select></label>
            <label>Ambient light <select name="ambientLight"><option value="">Unspecified / resolve at table</option>${Object.entries(
              AMBIENT_LIGHT
            )
              .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
              .join("")}</select></label>
          </details>
          <details><summary>Terrain feat circumstances</summary>
            <label><input type="checkbox" name="homeTurf" /> Within my home turf: five-block urban radius or one-mile wilderness radius of home</label>
            <label>Local Hero: opposing skill <select name="opposingSkill"><option value="">Choose only for Local Hero opposition</option>${LOCAL_HERO_OPPOSITION_SKILLS.map(key => `<option value="${key}">${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`).join("")}</select></label>
            <label><input type="checkbox" name="targetingYou" /> The opposing check targets me (Local Hero)</label>
            <label>Terrain <select name="terrain"><option value="">Unspecified</option>${Object.entries(TERRAIN_TYPES)
              .map(([id, label]) => `<option value="${id}">${label}</option>`)
              .join("")}</select></label>
            <label><input type="checkbox" name="underwater" /> I am underwater (general check penalty; Aquatic Training circumstances)</label>
            <label><input type="checkbox" name="navigating" /> This check is made to navigate</label>
            <label><input type="checkbox" name="naturalSurface" /> This footing/climbing check uses a natural surface</label>
            <label><input type="checkbox" name="hearingCheck" /> This Notice check uses hearing (Swamp Training)</label>
            <label>City population here (0 outside a city) <input type="number" name="cityPopulation" min="0" step="1" value="0" /></label>
            <label><input type="checkbox" name="nightAmbush" /> This ambush is planned at night or in darkness (Night Training)</label>
          </details>
          <details><summary>Tracking circumstances</summary>
            <label>Surface (required for Survival/Tracking) <select name="trackingSurface"><option value="">Choose the trail surface</option>${Object.entries(
              TRACKING_SURFACES
            )
              .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
              .join("")}</select></label>
            <label>Hours since tracks were left <input type="number" name="trackingAgeHours" min="0" step="any" value="0" /></label>
            <label>Hours of rain/snow since tracks were left <input type="number" name="trackingWeatherHours" min="0" step="any" value="0" /></label>
            <label><input type="checkbox" name="trackingLargeGroup" /> Target group has more than three characters</label>
            <label>Tracking pace <select name="trackingPace"><option value="half">Up to half Speed</option><option value="full">Up to full Speed</option><option value="faster">Faster than full Speed</option></select></label>
            <label><input type="checkbox" name="followingPhysicalTrail" /> I am following a physical trail (Tracking Mastery surprise bonus)</label>
          </details>
          <details><summary>Nest — Sniper Perfect Killer</summary>
            <label><input type="checkbox" name="nest" /> Substitute Tactics skill bonus for Hide to avoid being spotted</label>
            <label><input type="checkbox" name="nestHalfCoverConfirmed" /> I benefit from at least half cover and this check avoids being spotted</label>
            <label>Tactics attribute <select name="nestAbility"><option value="">Tactics default</option><option value="wis">WIS</option><option value="cha">CHA</option></select></label>
          </details>
          ${this.system.activeFeatNames?.includes("I Can Swim") ? '<label><input type="checkbox" name="iCanSwim" /> I Can Swim: spend saved skill points in this skill as a free action before this check</label>' : ""}
          <details><summary>Limited abilities and action dice</summary>
            <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce this error range by INT modifier (once/scene; twice at 7)</label>
            <label><input type="checkbox" name="allAccordingToPlan" /> All According to Plan: Schemer 4, use Intelligence for this check (session uses equal starting action dice)</label>
            <label><input type="checkbox" name="iKnowWhatDoing" /> …I Know What I’m Doing.: Stuntman 8, required bonus d10 for this STR/DEX check (once/scene)</label><label>DC for this bonus <input type="number" name="difficultyClass" step="1" placeholder="Must exceed Career Level +20" /></label>
            <label><input type="checkbox" name="tenSecondSolution" /> 10-Second Solution: Scientist 14, natural 20 on this Intelligence skill (once/session)</label><label><input type="checkbox" name="standaloneCheckConfirmed" /> This check is outside any Complex Task or Dramatic Conflict</label>
            <label><input type="checkbox" name="littleDetails" /> Little Details: Athletics/Smash as a free action (shared session and round limits)</label>
            <label><input type="checkbox" name="oneInAMillion" /> One in a Million: Soldier 14, natural 20 on a STR/CON skill check (once/session)</label>
            <label><input type="checkbox" name="breakthrough" /> Breakthrough: Virtuoso 10, substitute the key skill’s total bonus (once/scene)</label><label>Key skill attribute <select name="breakthroughAbility"><option value="">Key skill default</option>${["str", "dex", "con", "int", "wis", "cha"].map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join("")}</select></label>
            <label>Bright Idea source <select name="brightIdeaSource"><option value="">Automatic available source</option>${this.limitedUseStatus
              .filter(s => s.workflow === "brightIdea")
              .map(s => `<option value="${esc(s.id)}">${esc(s.name)}: ${s.remaining} remaining</option>`)
              .join("")}</select></label>
            <label><input type="checkbox" name="brightIdea" /> Bright Idea: roll twice and choose (INT/WIS skill checks)</label>
            ${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({ perBenefit: true, unrolled: true })}<label><input type="checkbox" name="hailMaryUntrained" /> Hail Mary: remove untrained error increase (1 die)</label>
            <label><input type="checkbox" name="hailMaryUncap" /> Hail Mary: lift the result cap (3 dice)</label>
            <label><input type="checkbox" name="hailMaryActive" /> Hail Mary: make passive/secret check active (4 dice)</label>
          </details>
          ${attributeCollapsePlan(this.system).conditions.includes("Paralyzed") || this.system.conditionContext?.paralyzed ? '<label><input type="checkbox" name="purelyMentalConfirmed" /> The GC confirmed this is a purely mental action (paralysis)</label>' : ""}
          <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
          <label><input type="checkbox" name="secret" /> Secret when the check permits either type</label></div>`
        });
        if (!input) return null;
      }
      for (const field of [
        "stanceDistanceFeet",
        "conveyanceBullRushAllowanceFeet",
        "conveyanceBullRushDistanceFeet",
        "bullRushAttackSizeDifference",
        "bullRushAttackDistanceFeet",
        "bullRushSizeDifference",
        "tumbleDistanceFeet",
        "tumbleAdjacentEnemySquares",
        "tumbleOccupiedSquares",
        "tripAttackSizeDifference",
        "tripSizeDifference",
        "fallDistanceFeet",
        "balanceDistanceFeet",
        "hideAreaPeople",
        "hideDistanceFeet",
        "threatenDistanceFeet",
        "threatenVitalityLoss",
        "threatenWoundLoss"
      ])
        if (typeof input[field] === "string")
          input = { ...input, [field]: input[field].trim() ? Number(input[field]) : null };
      if (typeof input.grappleProficient === "string")
        input = {
          ...input,
          grappleProficient:
            input.grappleProficient === "true" ? true : input.grappleProficient === "false" ? false : null
        };
      if (typeof input.grappleSizeDifference === "string")
        input = {
          ...input,
          grappleSizeDifference: input.grappleSizeDifference.trim() ? Number(input.grappleSizeDifference) : null
        };
      const check = checks.find(c => c.id === input.check);
      const gearItem = input.gearItem ? this.items?.get?.(input.gearItem) : null;
      const workTarget = () =>
        input.weaponWork === true && input.weaponWorkItemId ? this.items?.get?.(input.weaponWorkItemId) : null;
      if (input.weaponWork === true && input.weaponWorkItemId && workTarget()?.type !== "weapon")
        return ui.notifications.warn("Choose an actual target weapon/model or confirm its specifications again.");
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
        return ui.notifications.warn("Choose available gear being used for this check.");
      if (
        check?.id === "restraint-escape" &&
        restraintRollSource.sources.length > 1 &&
        input.grappleAllSourcesConfirmed !== true
      )
        throw new Error("Confirm which restraint sources belong to this grapple before rolling.");
      if (check?.id === "restraint-escape" && this.system.size !== restraintRollSize)
        throw new Error("Size changed while choosing this grapple check.");
      if (
        check?.id === "restraint-escape" &&
        JSON.stringify(restraintSourceSnapshot(this)) !== JSON.stringify(restraintRollSource)
      )
        throw new Error("The grapple sources changed while choosing this check.");
      let result = resolveSkillCheck(this.system, key, check, {
        ...this.sensoryContext(input),
        ...feintTargetInput(input, this),
        ...tripAttackTargetInput(input, this, { key, check }),
        ...tripDefenseTargetInput(input, this, { key, check }),
        ...targetSkillContext(input, key),
        ...detectionObserverContext(input),
        gearItem,
        weaponWorkItem: workTarget(),
        gearCategory: equipmentCategory(gearItem),
        optionalRules,
        ability: input.ability ?? ability
      });
      if (!result) return null;
      if (result.blocked) return ui.notifications.warn(result.blockedReason);
      if (!result.actionDiceCost) {
        const split = unrolledPaymentFundingInput(input),
          fee = surchargeFundingInput(input);
        if (split.allocations !== undefined || fee.surchargeAllocations !== undefined) {
          try {
            actionDieBenefitQuote(this, { baseCost: 0, benefitCount: 0, ...split, ...fee });
          } catch (error) {
            return ui.notifications.warn(error.message);
          }
        }
      }
      if (input.iCanSwim === true) {
        const allocation = await this.spendDeferredSkillPoints(key, {
          ...(input.deferredSkillPoints ?? {}),
          beforeSkillCheckConfirmed: true
        });
        if (!allocation || allocation.review) return null;
        result = resolveSkillCheck(this.system, key, check, {
          ...this.sensoryContext(input),
          ...feintTargetInput(input, this),
          ...tripAttackTargetInput(input, this, { key, check }),
          ...tripDefenseTargetInput(input, this, { key, check }),
          ...targetSkillContext(input, key),
          ...detectionObserverContext(input),
          gearItem,
          weaponWorkItem: workTarget(),
          gearCategory: equipmentCategory(gearItem),
          optionalRules,
          ability: input.ability ?? ability
        });
        if (!result || result.blocked)
          return ui.notifications.warn(result?.blockedReason ?? "This check is no longer available.");
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
        ...(input.cunningPlan ? [{ id: "cunningPlan", workflow: "cunningPlan" }] : [])
      ];
      const esc = foundry.utils.escapeHTML;
      if (
        [input.oneInAMillion, input.brightIdea, input.iKnowWhatDoing, input.tenSecondSolution].filter(Boolean).length >
        1
      )
        throw new Error("Choose one pre-roll class ability for this check.");
      if (input.iKnowWhatDoing) {
        difficultSkillBonusPlan(this.system, result, {
          dc: result.weaponFocusWork?.effectiveDC ?? input.difficultyClass
        });
        if (result.rollMode === "blindroll" && !game.user?.isGM)
          throw new Error("The GC resolves this bonus for a secret or passive check.");
      }
      if (input.brightIdea && key === "search" && (this.system.classLevels?.fieldAnalyst ?? 0) >= 8)
        return ui.notifications.warn(
          "Eye for Detail already rolls Search twice. Clear Bright Idea to preserve its limited use."
        );
      if (input.brightIdea && (result.method !== "roll" || !["int", "wis"].includes(result.ability)))
        return ui.notifications.warn("Bright Idea requires a rolled Intelligence- or Wisdom-based skill check.");
      if (input.brightIdea && result.rollMode === "blindroll" && !game.user?.isGM)
        return ui.notifications.warn("Ask the GC to resolve Bright Idea for this secret or passive check.");
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
          throw new Error("The paid class declaration changed before the skill roll.");
        if (input.weaponWork === true && input.weaponWorkItemId && workTarget()?.type !== "weapon")
          throw new Error("The target weapon/model is no longer available. Confirm the check again.");
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
          throw new Error("The selected gear is no longer available.");
        if (check?.id === "restraint-escape" && this.system.size !== restraintRollSize)
          throw new Error("Size changed before this grapple check.");
        if (
          check?.id === "restraint-escape" &&
          JSON.stringify(restraintSourceSnapshot(this)) !== JSON.stringify(restraintRollSource)
        )
          throw new Error("The grapple sources changed before the roll.");
        const fresh = resolveSkillCheck(this.system, key, check, {
          ...this.sensoryContext(input),
          ...feintTargetInput(input, this),
          ...tripAttackTargetInput(input, this, { key, check }),
          ...tripDefenseTargetInput(input, this, { key, check }),
          ...targetSkillContext(input, key),
          ...detectionObserverContext(input),
          gearItem: currentGear,
          weaponWorkItem: workTarget(),
          gearCategory: equipmentCategory(currentGear),
          optionalRules,
          ability: input.ability ?? ability
        });
        let wheelUseProof = null;
        if (
          !fresh ||
          fresh.blocked ||
          fresh.actionDiceCost !== result.actionDiceCost ||
          fresh.actionDiceBenefits !== result.actionDiceBenefits
        )
          throw new Error(fresh?.blockedReason || "This check’s requirements changed. Review it before rolling again.");
        if (input.brightIdea && key === "search" && (this.system.classLevels?.fieldAnalyst ?? 0) >= 8)
          throw new Error(
            "Eye for Detail now covers this Search check; preserve Bright Idea and roll again without it."
          );
        if (
          input.brightIdea &&
          (fresh.method !== "roll" ||
            !["int", "wis"].includes(fresh.ability) ||
            (fresh.rollMode === "blindroll" && !game.user?.isGM))
        )
          throw new Error("Bright Idea no longer qualifies for this check.");
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
          if (fresh.rollMode === "blindroll" && !game.user?.isGM) throw new Error("The GC resolves this secret bonus.");
        }
        return this.rollCheck(
          fresh.fixedDie ? `${fresh.fixedDie} + @total` : "1d20 + @total",
          { total: fresh.total },
          {
            flavor: `${esc(skill.name)} / ${esc(check.name)} (${fresh.ability.toUpperCase()})<br><small>${esc(fresh.notes)}</small>`,
            ...(Object.hasOwn(input, "oldSchool") ? { oldSchool: input.oldSchool } : {}),
            solutionCommitted,
            millionCommitted,
            tripCounterLease: input.tripCounterLease,
            stalkingStance: fresh.stalkingStance,
            feint: fresh.feint,
            meleeSkillFeats: fresh.meleeSkillFeats,
            conveyanceBullRush: fresh.conveyanceBullRush,
            bullRushAttack: fresh.bullRushAttack,
            bullRushDefense: fresh.bullRushDefense,
            tumblePath: fresh.tumblePath,
            tripAttack: fresh.tripAttack,
            tripDefense: fresh.tripDefense,
            fallDistance: fresh.fallDistance,
            balanceSurface: fresh.balanceSurface,
            hideCircumstances: fresh.hideCircumstances,
            detectionObserver: fresh.detectionObserver,
            hideMovement: fresh.hideMovement,
            targetSkillEffect: fresh.targetSkillEffect,
            rankSynergyFeats: fresh.rankSynergyFeats,
            stoneCold: fresh.stoneCold,
            threaten: fresh.threaten,
            bugConcealment: fresh.bugConcealment,
            documentation: fresh.documentation,
            analysisTask: fresh.analysisTask,
            trackingFeat: fresh.trackingFeat,
            trackingMasteryTask: fresh.trackingMasteryTask,
            forensicGenius: fresh.forensicGenius,
            closedCourseFeat: fresh.closedCourseFeat,
            wheelFeat: fresh.wheelFeat,
            practiceFeat: fresh.practiceFeat,
            fundedTaking: fresh.fundedTaking,
            terrainFeat: fresh.terrainFeat,
            pursuitFeat: fresh.pursuitFeat,
            professionalFeat: fresh.professionalFeat,
            refreshPaidSkill: fresh.gamblingDice
              ? (paid, committed) => perform(requiredBonusPoolId, paid, committed)
              : undefined,
            contactFeat: fresh.contactFeat,
            polyglot: fresh.polyglot,
            charmer: fresh.charmer,
            cardSharkProfession: fresh.cardSharkProfession,
            appearanceModifiers: fresh.appearanceModifiers,
            hardCore: fresh.hardCore,
            validateSkillContext:
              fresh.stalkingStance ||
              fresh.feint ||
              fresh.meleeSkillFeats ||
              fresh.conveyanceBullRush ||
              fresh.bullRushAttack ||
              fresh.bullRushDefense ||
              fresh.tumblePath ||
              fresh.tripDefense ||
              fresh.fallDistance ||
              fresh.balanceSurface ||
              fresh.hideCircumstances ||
              fresh.detectionObserver ||
              fresh.hideMovement ||
              fresh.targetSkillEffect ||
              fresh.rankSynergyFeats ||
              fresh.stoneCold ||
              fresh.threaten ||
              fresh.bugConcealment ||
              fresh.documentation ||
              fresh.analysisTask ||
              fresh.trackingFeat ||
              fresh.trackingMasteryTask ||
              fresh.forensicGenius ||
              fresh.closedCourseFeat ||
              fresh.wheelFeat ||
              fresh.practiceFeat ||
              fresh.fundedTaking ||
              fresh.skillGear?.toolShedKit ||
              fresh.terrainFeat ||
              fresh.pursuitFeat ||
              fresh.professionalFeat ||
              fresh.contactFeat ||
              fresh.polyglot ||
              fresh.gamblingDice ||
              fresh.charmer ||
              fresh.hardCore ||
              fresh.appearanceModifiers ||
              fresh.cardSharkProfession
                ? () => {
                    if (fresh.wheelFeat?.free)
                      wheelUseProof = oneHandManeuverUseProof(this.system, fresh.wheelFeat, wheelUseProof);
                    const liveGear = input.gearItem ? this.items?.get?.(input.gearItem) : null,
                      now = resolveSkillCheck(this.system, key, check, {
                        ...this.sensoryContext(input),
                        ...feintTargetInput(input, this),
                        ...tripAttackTargetInput(input, this, { key, check }),
                        ...tripDefenseTargetInput(input, this, { key, check }),
                        ...targetSkillContext(input, key),
                        ...detectionObserverContext(input),
                        gearItem: liveGear,
                        weaponWorkItem: workTarget(),
                        gearCategory: equipmentCategory(liveGear),
                        optionalRules,
                        ability: input.ability ?? ability
                      });
                    if (
                      !now ||
                      now.blocked ||
                      JSON.stringify([
                        now.stalkingStance,
                        now.feint,
                        now.meleeSkillFeats,
                        now.conveyanceBullRush,
                        now.bullRushAttack,
                        now.bullRushDefense,
                        now.tumblePath,
                        now.tripDefense,
                        now.fallDistance,
                        now.balanceSurface,
                        now.hideCircumstances,
                        now.detectionObserver,
                        now.hideMovement,
                        now.targetSkillEffect,
                        now.rankSynergyFeats,
                        now.stoneCold,
                        now.threaten,
                        now.bugConcealment,
                        now.documentation,
                        now.analysisTask,
                        now.trackingFeat,
                        now.trackingMasteryTask,
                        now.forensicGenius,
                        now.closedCourseFeat,
                        now.wheelFeat,
                        now.practiceFeat,
                        now.fundedTaking,
                        now.skillGear?.toolShedKit,
                        now.terrainFeat,
                        now.pursuitFeat,
                        now.professionalFeat,
                        now.contactFeat,
                        now.polyglot,
                        now.hardCore,
                        now.appearanceModifiers,
                        now.cardSharkProfession,
                        now.charmer,
                        now.gamblingDice
                      ]) !==
                        JSON.stringify([
                          fresh.stalkingStance,
                          fresh.feint,
                          fresh.meleeSkillFeats,
                          fresh.conveyanceBullRush,
                          fresh.bullRushAttack,
                          fresh.bullRushDefense,
                          fresh.tumblePath,
                          fresh.tripDefense,
                          fresh.fallDistance,
                          fresh.balanceSurface,
                          fresh.hideCircumstances,
                          fresh.detectionObserver,
                          fresh.hideMovement,
                          fresh.targetSkillEffect,
                          fresh.rankSynergyFeats,
                          fresh.stoneCold,
                          fresh.threaten,
                          fresh.bugConcealment,
                          fresh.documentation,
                          fresh.analysisTask,
                          fresh.trackingFeat,
                          fresh.trackingMasteryTask,
                          fresh.forensicGenius,
                          fresh.closedCourseFeat,
                          fresh.wheelFeat,
                          fresh.practiceFeat,
                          fresh.fundedTaking,
                          fresh.skillGear?.toolShedKit,
                          fresh.terrainFeat,
                          fresh.pursuitFeat,
                          fresh.professionalFeat,
                          fresh.contactFeat,
                          fresh.polyglot,
                          fresh.hardCore,
                          fresh.appearanceModifiers,
                          fresh.cardSharkProfession,
                          fresh.charmer,
                          fresh.gamblingDice
                        ])
                    )
                      throw new Error(
                        "The declared skill modifiers or their feat sources changed before the check was posted."
                      );
                  }
                : undefined,
            weaponFocusWork: fresh.weaponFocusWork,
            restraintEscape: fresh.restraintEscape
              ? {
                  ...fresh.restraintEscape,
                  sourceSnapshot: restraintRollSource,
                  sourceScopeConfirmed:
                    restraintRollSource.sources.length === 1 || input.grappleAllSourcesConfirmed === true
                }
              : null,
            skillBonusCondition: fresh.skillBonusCondition,
            skillCheckAdjustment: fresh.checkAdjustment,
            gamblingDice: fresh.gamblingDice,
            preRollFunding: this.preRollPaymentReceipt(payment),
            bonusPoolId: input.bonusPoolId ?? "",
            hailMary: {
              untrained: input.hailMaryUntrained === true,
              uncap: input.hailMaryUncap === true,
              active: input.hailMaryActive === true,
              cost: fresh.actionDiceCost
            },
            threat: fresh.threat,
            error: fresh.error,
            cap: fresh.cap,
            rollMode: fresh.rollMode,
            actionDiceAllowed: fresh.actionDiceAllowed,
            checkMethod: fresh.method,
            checkKind: "skill",
            ability: fresh.ability,
            skillKey: key,
            checkId: check.id,
            focus: input.focus || check.name.replace(/ Check$/, ""),
            practiceMakesPerfect: fresh.practiceMakesPerfect,
            criticalFailureCostIncrease: fresh.criticalFailureCostIncrease,
            cleanAndPolished: cleanAndPolishedApplies(this.system, currentGear?.system),
            gearUuid: currentGear?.uuid ?? "",
            crossCheck: fresh.crossCheck,
            requiredBonusPoolId,
            oneInAMillion: !!input.oneInAMillion,
            tenSecondSolution: !!input.tenSecondSolution,
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
            cunningPlan: fresh.cunningPlan,
            attributeSubstitution: fresh.attributeSubstitution,
            localHeroOpposition: fresh.localHeroOpposition,
            terrain: fresh.terrain,
            senses: fresh.senses,
            sensoryConditions: fresh.sensoryConditions,
            tracking: fresh.tracking,
            gcTakingPermissionConfirmed: fresh.gcTakingPermissionConfirmed,
            ambush: fresh.ambush,
            underwaterContext: fresh.underwaterContext,
            qualityChecks: fresh.qualityChecks,
            medical: fresh.medical,
            littleDetails: fresh.littleDetails
              ? { ...fresh.littleDetails, round: this.usagePeriods.round ?? "initial" }
              : null,
            skillTags: fresh.skillTags,
            skillGear: fresh.skillGear,
            fogSmoke: fresh.fogSmoke,
            ambientLight: fresh.ambientLight,
            nest: fresh.nest,
            breakthrough: fresh.breakthrough,
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
            if (this.system.bonusActionDice?.[id]) throw new Error("This bonus-pool identifier already exists.");
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
                    "The skill result may still exist after a bonus-grant failure. Its use and costs remain spent; ask the GC to review the check and bonus before retrying."
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
            purpose: "Hail Mary skill options",
            benefit: "hailMary"
          })
        : perform();
    }

    async useFinalDeduction(options = {}) {
      if (!this.isOwner || !hasFinalDeduction(this.system))
        return ui.notifications.warn("Final Deduction is not currently available.");
      const epoch = String(this.usagePeriods.session ?? "initial"),
        study = finalDeductionStudy(this.flags?.spycraft2?.finalDeduction, epoch),
        esc = foundry.utils.escapeHTML;
      let input = options;
      if (!Object.hasOwn(input, "expectedRound")) {
        input = await systemDialog.input({
          window: { title: "Final Deduction study" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${study ? `Continue ${esc(study.target)} after ${study.rounds} completed full rounds. Interruptions within this session preserve progress.` : "Begin one special-character study this session. First observe the target for at least one round in person or by audio/visual recording."} Each confirmation records one additional completed full round. The GC supplies all revelations; ties and final ordering belong to the GC.</p><label>Target special character <input name="target" value="${esc(study?.target ?? "")}" ${study ? "readonly" : ""} required /></label>${study ? "" : '<label><input name="specialCharacterConfirmed" type="checkbox" /> The target is a special character</label><label><input name="observedRoundConfirmed" type="checkbox" /> I previously observed this target for at least one round</label>'}<label><input name="fullRoundConfirmed" type="checkbox" /> I completed another full round studying this target</label>${(study?.rounds ?? 0) >= 4 ? '<label>Next information <select name="stage"><option value="classes">Next class and level</option><option value="skills">Next skill and ranks</option><option value="remaining">Remaining Subplots and proficiencies</option></select></label><label><input name="allClassesKnownConfirmed" type="checkbox" /> All target class names and levels are already known</label><label><input name="allSkillsKnownConfirmed" type="checkbox" /> All target skill names and ranks are already known</label>' : ""}</div>`
        });
        if (!input) return null;
        input = { ...input, expectedEpoch: epoch, expectedRound: study?.rounds ?? 0 };
      }
      return queueResources([this], async () => {
        if (!this.isOwner) throw new Error("You must own this actor.");
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
        if (!spec) throw new Error("Final Deduction is no longer available.");
        if (plan.starting) {
          const use = resourceUsePlan(
            spec,
            this.system.resourceUses,
            this.usagePeriods,
            this.system.actionDice?.value ?? 0
          );
          if (use.blocked) return ui.notifications.warn(use.reason);
          updates["system.resourceUses.finalDeduction"] = use.record;
        } else {
          const status = resourceStatus(spec, this.system.resourceUses, this.usagePeriods);
          if (status.counterReview || status.used !== 1)
            throw new Error("The GC must review this study’s session use count.");
        }
        await this.update(updates);
        try {
          return await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `Final Deduction: ${esc(plan.target)}, study round ${plan.rounds}. The GC supplies: ${esc(plan.revelation)}.`,
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
      if (!this.isOwner || !source) return ui.notifications.warn("Global Search is not currently available.");
      let input = options;
      if (!input.target) {
        input = await systemDialog.input({
          window: { title: "Record completed Global Search" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>Complete ${source.hoursPerLevel} hours × target level while taking only free actions, then record this use. The GC supplies the city or 20-mile × 20-mile area.</p><label>Target special character <input name="target" required /></label><label>GC-supplied target level <input name="targetLevel" type="number" min="1" step="1" required /></label><label>Hours completed <input name="hoursCompleted" type="number" min="0" step="any" required /></label><label><input name="specialCharacterConfirmed" type="checkbox" /> The target is a special character</label><label><input name="onlyFreeActionsConfirmed" type="checkbox" /> I performed no other non-free actions during the required search time</label></div>`
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
            content: `Global Search: ${foundry.utils.escapeHTML(plan.target)}; ${plan.requiredHours} hours completed. The GC supplies the city or 20-mile × 20-mile area containing this special character.`,
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
        return ui.notifications.warn("Little Details is not currently available.");
      let input = options;
      if (!input.action) {
        input = await systemDialog.input({
          window: { title: "Little Details" },
          rejectClose: false,
          content:
            '<div class="spycraft2-roll-options"><label>Free action <select name="action"><option value="smash">Athletics/Smash</option><option value="disarm">Disarm</option><option value="feint">Feint</option><option value="tire">Tire</option></select></label><label>Target / note <input name="target" /></label><label>Smash situational modifier <input type="number" name="modifier" value="0" /></label><label><input type="checkbox" name="actionLegalConfirmed" /> Normal target/action requirements are satisfied; spend the free action</label><p>Consumes one session use and this round’s allowance. Disarm/Feint/Tire resolution remains at the table. Smash rolls normally, including skill cap/error and any applicable conditions.</p></div>'
        });
        if (!input) return null;
      }
      if (!["smash", "disarm", "feint", "tire"].includes(input.action) || input.actionLegalConfirmed !== true)
        throw new Error("Confirm one legal Little Details action and its normal requirements.");
      if (input.action === "smash")
        return this.rollSkill("athletics", "str", { ...input, check: "smash", littleDetails: true });
      return this.useLimitedAbility(
        "littleDetails",
        () =>
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `Little Details: ${foundry.utils.escapeHTML(input.action)} as a free action${input.target ? " targeting " + foundry.utils.escapeHTML(input.target) : ""}. Resolve the normal action at the table.`,
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
        ui.notifications.warn("The GC must allocate legacy combined Bright Idea uses on Classes first.");
        return null;
      }
      const available = this.limitedUseStatus.filter(s => s.workflow === "brightIdea");
      const source = id ? available.find(s => s.id === id) : (available.find(s => s.remaining > 0) ?? available[0]);
      if (!source) {
        ui.notifications.warn("No matching Bright Idea source is available.");
        return null;
      }
      return source;
    }

    async rollKnowledge(options = {}) {
      let input = options;
      const esc = foundry.utils.escapeHTML;
      if (!input.skill) {
        input = await systemDialog.input({
          window: { title: "Knowledge" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">
        <label>Question or task <input name="topic" /></label><label><input name="underwater" type="checkbox" /> I am underwater (standard skill-check penalty)</label>
        <label>GC-selected relevant skill <select name="skill">${Object.entries(CONFIG.SPYCRAFT.skills)
          .map(([key, skill]) => `<option value="${key}">${esc(skill.name)}</option>`)
          .join("")}</select></label>
        ${this.system.activeFeatNames?.includes("Card Shark") ? '<label>Card Shark gambling Knowledge <select name="gamblingKnowledge"><option value="">Ordinary Knowledge scope</option><option value="rules">Gambling rules</option><option value="people">Major gamblers, their winnings and debts</option><option value="locations">Casinos and other gaming locations</option></select></label><p>A question in a selected Card Shark category is active. Taking 10/20 still requires Photographic Memory.</p>' : ""}
        <label>Relevant focus <input name="focus" /></label>
        <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
        <label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10 — 1 round (Photographic Memory)</option><option value="take20">Take 20 — 1 minute (Photographic Memory)</option></select></label>
        <label><input type="checkbox" name="active" /> Active check (Photographic Memory)</label>
        <label><input type="checkbox" name="safeToTake" /> Neither distracted nor endangered</label>
        <label><input type="checkbox" name="breakthrough" /> Breakthrough: Virtuoso 10, substitute the key skill’s total bonus (once/scene)</label><label>Key skill attribute <select name="breakthroughAbility"><option value="">Key skill default</option>${["str", "dex", "con", "int", "wis", "cha"].map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join("")}</select></label>
            <label>Bright Idea source <select name="brightIdeaSource"><option value="">Automatic available source</option>${this.limitedUseStatus
              .filter(s => s.workflow === "brightIdea")
              .map(s => `<option value="${esc(s.id)}">${esc(s.name)}: ${s.remaining} remaining</option>`)
              .join("")}</select></label>
        <label><input type="checkbox" name="brightIdea" /> Bright Idea: roll twice and choose (uses the same source pool as Skills)</label>
        <label><input type="checkbox" name="tenSecondSolution" /> 10-Second Solution: Scientist 14, natural 20 (same session use as Skills; minimum 1 full action)</label>
        <label><input type="checkbox" name="standaloneCheckConfirmed" /> This check is outside any Complex Task or Dramatic Conflict</label>
        <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce the error range (shared scene uses)</label><p>The GC resolves class abilities on passive Knowledge checks. Named-skill abilities do not apply merely because that skill supplies Knowledge synergy.</p></div>`
        });
        if (!input) return null;
      }
      const result = resolveKnowledgeCheck(this.system, input);
      if (result.blocked) return ui.notifications.warn(result.blockedReason);
      if (input.breakthrough)
        breakthroughPlan(this.system, this.items, CONFIG.SPYCRAFT, result, {
          checkKind: "knowledge",
          sourceAbility: input.breakthroughAbility,
          modifier: input.modifier
        });
      const additionalUses = [
        ...(input.breakthrough ? [{ id: "breakthrough", workflow: "breakthrough" }] : []),
        ...(input.cunningPlan ? [{ id: "cunningPlan", workflow: "cunningPlan" }] : [])
      ];
      if (input.brightIdea && input.tenSecondSolution)
        throw new Error("Choose one pre-roll class ability for Knowledge.");
      if (input.brightIdea && result.method !== "roll")
        throw new Error("Bright Idea requires a rolled Knowledge check.");
      if ((input.brightIdea || input.tenSecondSolution) && result.rollMode === "blindroll" && !game.user?.isGM)
        throw new Error("The GC resolves class abilities for passive Knowledge checks.");
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
          throw new Error("The GC resolves this passive Knowledge ability.");
        return this.rollCheck(
          fresh.fixedDie ? `${fresh.fixedDie} + @total` : "1d20 + @total",
          { total: fresh.total },
          {
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
                      throw new Error("The Knowledge scope, method or supporting feat source changed before posting.");
                  }
                : undefined,
            flavor: `Knowledge${input.topic ? `: ${esc(input.topic)}` : ""}<br><small>${esc(fresh.notes)}</small>`,
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

    async rollAttack(item, options = {}) {
      await validateCheapShotTarget(this, options.cheapShot, {
        targetUuid:
          options.characterTarget?.actorUuid ||
          options.targetActorUuid ||
          options.finalAttack?.opponentUuid ||
          options.finalAttack?.targetUuid
      });
      if (options.freeFinalAttack && options.disarm)
        throw new Error("A final attack cannot combine with a Disarm action.");
      if (
        options.freeFinalAttack &&
        (!(options.twoWeaponFinalAttack || options.finalAttack) || typeof options.validateFinalAttack !== "function")
      )
        throw new Error("Use the final-attack control to reserve this opportunity.");
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
          window: { title: "Attack circumstances" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${reachIncreaseFeet(item.system.qualities ?? "") ? reachContextContent(options) : ""}${cleaveTargetRequired(this, item.system) ? characterTargetContent(this, options) : observedAttackTargetContent(this, options)}<label><input type="checkbox" name="targetFlanked" /> I am flanking this opponent with this attack, satisfying the applicable position, ready-weapon and Reach/CQB requirements (p.341)</label><label><input type="checkbox" name="targetPinnedAdjacent" /> Target is pinned and I am adjacent (+4 melee/unarmed attack)</label><label><input type="checkbox" name="targetAnimal" /> This attack targets an animal (Scout Game Hunter, p.43)</label>${cqbRangedWeapon(item.system) ? meleeFireContextContent(options) + quickRangedAimContent(options) + bullseyeContent(this, options) : quickAttackActionContent(options) + allOutAttackContent(this, options) + meleeTrickContent(this, options)}${needsCQB ? `<label>CQB target distance (feet) <input name="distanceFeet" type="number" min="0" step="any" required value="${Number.isFinite(options.distanceFeet) ? options.distanceFeet : ""}" /></label><label><input name="targetOpponentConfirmed" type="checkbox" /> This attack targets an opponent (CQB Mastery threat benefit)</label>` : ""}</div>`
        });
        if (!input) return null;
        const cqbInput = needsCQB
          ? {
              distanceFeet:
                typeof input.distanceFeet === "number"
                  ? input.distanceFeet
                  : typeof input.distanceFeet === "string" && input.distanceFeet.trim()
                    ? Number(input.distanceFeet)
                    : NaN,
              targetOpponentConfirmed: input.targetOpponentConfirmed === true
            }
          : {};
        if (needsCQB && (!Number.isFinite(cqbInput.distanceFeet) || cqbInput.distanceFeet < 0))
          throw new Error("Enter the actual finite nonnegative CQB attack distance.");
        options = {
          ...options,
          ...(cqbRangedWeapon(item.system) ? quickRangedAimInput(input) : quickAttackActionInput(input)),
          ...reachContextInput(input),
          ...allOutAttackInput(input),
          ...bullseyeInput(input),
          ...meleeTrickInput(input),
          ...cqbInput,
          ...(Object.hasOwn(input, "targetActorUuid")
            ? {
                targetActorUuid: input.targetActorUuid,
                targetCharacterType: input.targetCharacterType,
                targetName: input.targetName,
                characterTarget: undefined
              }
            : {}),
          firingOutOfMelee: input.firingOutOfMelee === true,
          firingIntoMelee: input.firingIntoMelee === true,
          askContext: false,
          targetPinnedAdjacent: input.targetPinnedAdjacent === true,
          targetAnimal: !!input.targetAnimal,
          targetFlanked: !!input.targetFlanked
        };
      }
      if (
        options.disarm?.role !== "defender" &&
        reachIncreaseFeet(item.system.qualities ?? "") &&
        (typeof options.reachAdjacent !== "boolean" || options.reachGeometryConfirmed !== true)
      ) {
        const input = await systemDialog.input({
          window: { title: "Reach weapon — actual target geometry" },
          rejectClose: false,
          content: '<div class="spycraft2-roll-options">' + reachContextContent(options) + "</div>"
        });
        if (!input) return null;
        options = { ...options, ...reachContextInput(input) };
        if (typeof options.reachAdjacent !== "boolean" || options.reachGeometryConfirmed !== true)
          throw Error("Confirm actual target adjacency and legal Reach geometry before this attack.");
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
          (declaredTargetUuid && !attackCharacterTargetChoices().some(a => a.uuid === declaredTargetUuid))
        )
          throw Error("The explicitly selected attack target changed or is no longer an observed character.");
      };
      validateDeclaredTarget();
      let feintBonusProof = null,
        sideStanceProof = null;
      const feintContext = () => ({ ...options, feintBonusProof, sideStanceProof });
      const w = item.system;
      const atk = this.weaponAttack(item, feintContext());
      feintBonusProof = atk.feintBonus.attackBonus
        ? { ...atk.feintBonus, attemptId: foundry.utils.randomID() }
        : atk.feintBonus;
      sideStanceProof = atk.sideStance.dice
        ? { ...atk.sideStance, attemptId: foundry.utils.randomID() }
        : atk.sideStance;
      if (atk.blocked) return ui.notifications.warn(atk.reason);
      if (options.attackAction === "standard" && atk.firearm && atk.fireMode !== "single")
        return ui.notifications.warn("A Standard Attack requires Single-Shot mode.");
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
        if (!current) throw new Error("The attack weapon no longer exists.");
        const preview = this.weaponAttack(current, feintContext());
        if (meleeSnapshot && JSON.stringify(preview.meleeFire) !== meleeSnapshot)
          throw new Error("The ranged melee-fire circumstances or CQB waiver source changed during the attack.");
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
            "The attack weapon, proficiency or Finesse threat source changed during the attack (including conditional weapon qualities and Cleave threat)."
          );
      };
      const cqbSnapshot = atk.cqbRange?.active ? JSON.stringify(atk.cqbRange) : null;
      const validateCQBRange = cqbSnapshot
        ? () => {
            const current = item.id && this.items?.get ? this.items.get(item.id) : item;
            if (!current || JSON.stringify(this.weaponAttack(current, feintContext()).cqbRange) !== cqbSnapshot)
              throw new Error("CQB source, weapon or range changed during this attack.");
          }
        : null;
      const millionDollar = !!options.millionDollarSkill;
      if (millionDollar) {
        const plan = millionDollarSkillPlan(this.system, w, options);
        if (plan.blocked) return ui.notifications.warn(plan.reason);
        if (options.oneInAMillion) return ui.notifications.warn("Choose one attack roll-choice/declaration ability.");
        if (!options.millionDollarSkillCommitted)
          return this.useLimitedAbility(
            "millionDollarSkill",
            () => {
              const current = item.id && this.items?.get ? this.items.get(item.id) : item;
              if (!current) throw new Error("The chosen weapon was removed.");
              const eligible = millionDollarSkillPlan(this.system, current.system, options),
                preview = this.weaponAttack(current, feintContext());
              if (
                eligible.blocked ||
                preview.blocked ||
                (options.attackAction === "standard" && preview.firearm && preview.fireMode !== "single")
              )
                throw new Error(eligible.reason || preview.reason || "The current attack no longer qualifies.");
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
      const message = await this.rollCheck(
        "1d20 + @total",
        { total: atk.total - tripPenalty },
        {
          flavor: `${game.i18n.localize("SPYCRAFT.Attack")}: ${foundry.utils.escapeHTML(item.name)}${tripPenalty ? " — Trip final attack −4" : ""}${atk.trained ? "" : ` — ${game.i18n.localize("SPYCRAFT.Weapon.Untrained")}`}${atk.notes ? `<br><small>${foundry.utils.escapeHTML(atk.notes)}</small>` : ""}`,
          strikingLease: options.strikingLease,
          tripFinalLease: options.tripFinalLease,
          validateCQBRange,
          finalAttackRound: options.finalAttackRound,
          finalAttack: options.finalAttack,
          twoWeaponFinalAttack: options.twoWeaponFinalAttack,
          validateFinalAttack: options.validateFinalAttack,
          validateAttackContext,
          threat: atk.threat,
          error: cunning?.error ?? atk.error,
          cunningPlan: cunning ?? !!options.cunningPlan,
          chooseTwice: millionDollar,
          choiceSource: "Million Dollar Skill",
          choiceResourceId: millionDollar ? "millionDollarSkill" : "",
          oneInAMillion: !!options.oneInAMillion,
          checkKind: "attack",
          ability: atk.ability,
          weaponUuid: item.uuid,
          weaponProficiency: atk.proficiency ?? w.proficiency,
          meleeArmorPiercing: atk.meleeArmorPiercing.evidence,
          weaponQualities: atk.effectiveQualities ?? w.qualities,
          cleanAndPolished: cleanAndPolishedApplies(this.system, w),
          gearUuid: item.uuid,
          attackContext: {
            reach: atk.reach,
            reachAdjacent: options.reachAdjacent ?? null,
            reachGeometryConfirmed: options.reachGeometryConfirmed === true,
            meleeFeatTrick: atk.meleeTrick?.key ?? null,
            meleeTrick: atk.meleeTrick,
            bullseye: atk.bullseye,
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
      return message;
    }

    async useOneInAMillion(options = {}) {
      let input = options;
      if (!input.kind) {
        const esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: "One in a Million: declare before rolling" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>Once per session, Soldier 14 may declare a natural 20 before an attack, Fortitude save or STR/CON skill check. For skills, choose this ability in the skill dialog instead.</p><label>Check <select name="kind"><option value="attack">Weapon attack</option><option value="fort">Fortitude save</option></select></label><label>Weapon for attack <select name="weaponId">${this.items
            .filter(i => i.type === "weapon" && !isResourceLock(i))
            .map(i => `<option value="${i.id}">${esc(i.name)}</option>`)
            .join("")}</select></label></div>`
        });
        if (!input) return null;
      }
      if (input.kind === "fort") return this.rollSave("fort", { oneInAMillion: true });
      const weapon = this.items.get(input.weaponId);
      if (input.kind !== "attack" || !weapon || weapon.type !== "weapon")
        throw new Error("Choose an owned weapon or Fortitude save.");
      return this.rollAttack(weapon, { oneInAMillion: true });
    }

    async rollRangedAttack(item, options = {}) {
      if (!this.isOwner) return null;
      let input = options;
      if (!Object.keys(input).length) {
        const preview = this.weaponAttack(item),
          esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: `Ranged attack: ${item.name}` },
          rejectClose: false,
          content: `
        <p>Range increment ${preview.range} ft. Recoil uses your current Strength. Confirm Aim/Brace conditions for this roll. Action costs and Initiative Count changes are applied at the table.</p>
        <label>Target distance (feet) <input type="number" name="distanceFeet" min="0" step="any" required /></label>
        <div class="spycraft2-roll-options">
        <label><input type="checkbox" name="oneInAMillion" /> One in a Million (Soldier 14; once/session)</label>
        <label><input type="checkbox" name="millionDollarSkill" /> Million Dollar Skill: Sniper 10, roll twice and choose (once/round; eligible weapon)</label><label><input type="checkbox" name="targetVulnerable" /> This opponent is vulnerable against this attack</label>
        <label><input type="checkbox" name="targetFlanked" /> I am flanking this opponent with this attack; applicable position, ready-weapon and Reach/CQB requirements are met (p.341)</label>
        <label><input type="checkbox" name="targetPinnedAdjacent" /> Target is pinned and I am adjacent (+4 melee/unarmed attack)</label><label><input type="checkbox" name="targetOpponentConfirmed" /> This attack targets an opponent (CQB Mastery threat benefit)</label><label><input type="checkbox" name="targetAnimal" /> This attack targets an animal (Scout Game Hunter)</label><label><input type="checkbox" name="targetCrouchedNonAdjacent" /> Target is crouched and I am not adjacent (−1 ranged attack)</label><label><input type="checkbox" name="targetProneNonAdjacent" /> Target is prone and I am not adjacent (−2 ranged attack)</label>
        <label><input type="checkbox" name="targetFlatFooted" /> This opponent is flat-footed against this attack (Surprise Shot)</label>
        <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce error range (shared scene uses)</label>
        <label><input type="checkbox" name="vehicleMounted" /> This weapon is mounted on a vehicle for this attack</label>
        <label>Mounted weapon’s normal firing time <select name="weaponOperationTime"><option value="">Unspecified / use its source</option><option value="half">1 half action</option><option value="full">1 full action</option><option value="twoHalf">2 half actions</option></select></label>
        <label>Fog/smoke <select name="obscurant"><option value="">Unspecified</option><option value="fog">Fog</option><option value="smoke">Smoke</option></select></label>
            <label>Fog/smoke density <select name="obscurantDensity"><option value="">Unspecified</option>${Object.entries(
              FOG_SMOKE
            )
              .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
              .join("")}</select></label>
            <label>Ambient light <select name="ambientLight"><option value="">Unspecified / resolve at table</option>${Object.entries(
              AMBIENT_LIGHT
            )
              .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
              .join("")}</select></label>
        <label><input type="checkbox" name="blinded" /> Additional blindness for this attack</label><label><input type="checkbox" name="deafened" /> Additional deafness for this attack</label><label><input type="checkbox" name="targetCharacter" /> Target is a character (Night Training's nearby hearing exception)</label>
        ${item.system.weaponCategory === "mortar" ? '<label><input name="mortarSpaceConfirmed" type="checkbox" /> Mortar is outdoors or in a very large indoor area suitable for its high-arc trajectory</label>' : ""}${item.system.weaponCategory === "grenadeLauncher" ? '<label><input type="checkbox" name="indirectFire" /> Grenade launcher: indirect fire at a target outside line of sight (Indirect/INT; otherwise Tactical/DEX)</label>' : ""}${["underbarrel", "optionalUnderbarrel"].includes(item.system.mountRequirement) ? '<label><input type="checkbox" name="underbarrelMountConfirmed" /> Underbarrel version is attached to a compatible rifle’s available underbarrel location</label>' : ""}${item.system.mountRequirement === "tripodOrVehicle" ? '<label><input type="checkbox" name="usingIntegralTripod" /> Automatic grenade launcher: integral tripod is in use (or declare vehicle attachment above)</label>' : ""}
        ${meleeFireContextContent(options)}<label>Attack action <select name="attackAction"><option value="other">Other attack (resolve its action modifiers at the table)</option><option value="standard">Standard Attack (Single-Shot for firearms)</option></select></label>
        <label><input type="checkbox" name="aimed" /> Aim remains valid for this target; it has not moved more than 5 ft.</label>
        ${preview.firearm ? `<label><input type="checkbox" name="braced" /> Brace remains valid: I have not moved and the target is in the chosen 90-degree cone</label><label><input type="checkbox" name="stableSurface" /> I have a stable surface to brace against (unnecessary with Marksmanship Basics)</label>` : ""}
        ${preview.firearm ? `<label>Fire mode <select name="fireMode">${preview.modes.map(mode => `<option value="${mode}" ${mode === preview.fireMode ? "selected" : ""}>${esc(FIRE_MODES[mode] ?? mode)}</option>`).join("")}</select></label>` : ""}</div>`
        });
        if (!input) return null;
      }
      if (input.distanceFeet === "" || input.distanceFeet == null)
        return ui.notifications.warn("Enter the target distance before making a measured attack.");
      return this.rollAttack(item, {
        ...input,
        vehicleMounted: !!input.vehicleMounted,
        distanceFeet: Number(input.distanceFeet)
      });
    }

    async resolveUnnerving(message, options = {}) {
      if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid || (message.blind && !game.user.isGM))
        throw new Error("Use an owned visible damage record.");
      if (!unnervingEligible(this.system, message.flags.spycraft2))
        return ui.notifications.warn("Unnerving is not available for this damage record.");
      let input = options;
      if (!input.target) {
        input = await systemDialog.input({
          window: { title: "Unnerving: additional stress" },
          rejectClose: false,
          content:
            '<div class="spycraft2-roll-options"><label>Target <input name="target" required /></label><label><input type="checkbox" name="damageInflictedConfirmed" /> This unarmed/melee attack actually inflicted at least one point of damage after defenses</label><p>Rolls 1d4 stress per selected grade, maximum 3d4. Apply the target’s stress defenses separately. Record each attack’s added stress once.</p></div>'
        });
        if (!input) return null;
      }
      unnervingPlan(this.system, message.flags.spycraft2, input);
      return queueResources(
        [this],
        async () => {
          if (!this.isOwner || message.flags?.spycraft2?.actorUuid !== this.uuid)
            throw new Error("Ownership or the acting character changed.");
          const check = message.flags.spycraft2,
            plan = unnervingPlan(this.system, check, input),
            before = structuredClone(check.unnerving);
          await message.update({ "flags.spycraft2.unnerving": { ...plan, recorded: true } });
          try {
            return await this.rollCheck(plan.formula, this.getRollData(), {
              flavor: `Unnerving: ${foundry.utils.escapeHTML(plan.target)} — ${plan.formula} additional stress damage (p.451). Apply stress defenses separately.`,
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
        const input = await systemDialog.input({
          window: { title: "Mortar damage circumstances" },
          rejectClose: false,
          content:
            '<div class="spycraft2-roll-options"><label><input name="mortarSpaceConfirmed" type="checkbox" /> Mortar fired outdoors or in a very large indoor area suitable for its high-arc trajectory</label></div>'
        });
        if (!input) return null;
        options = { ...options, ...input };
      }
      if (
        item.system.weaponCategory === "grenadeLauncher" &&
        item.system.mountRequirement &&
        /\d*d\d+/i.test(item.system.damage) &&
        !["underbarrelMountConfirmed", "usingIntegralTripod", "vehicleMounted"].some(key => Object.hasOwn(options, key))
      ) {
        const input = await systemDialog.input({
          window: { title: "Launcher damage circumstances" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>Confirm the mount and firing mode used for the attack producing this damage.</p>${["underbarrel", "optionalUnderbarrel"].includes(item.system.mountRequirement) ? '<label><input type="checkbox" name="underbarrelMountConfirmed" /> Underbarrel version was attached to a compatible rifle’s available underbarrel location</label>' : ""}${item.system.mountRequirement === "tripodOrVehicle" ? '<label><input type="checkbox" name="usingIntegralTripod" /> Integral tripod was in use</label><label><input type="checkbox" name="vehicleMounted" /> Launcher was attached to a vehicle</label>' : ""}<label><input type="checkbox" name="indirectFire" /> Target was outside line of sight (Indirect/INT)</label></div>`
        });
        if (!input) return null;
        options = { ...options, ...input };
      }
      if (
        options.includeSneakAttack === undefined &&
        (hasSneakAttackSource(this.system, item.system) || sideHits.length || attackBonusHits.length)
      ) {
        const trickSneakHit = automaticAttackBonus?.proof.sneakDice ? automaticAttackBonus : null;
        const input = await systemDialog.input({
          window: { title: attackBonusHits.length ? "Damage and attack benefits" : "Damage and sneak attack" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>Target sheet <select name="targetActorUuid"><option value="">Manual target: confirm immunities below</option>${targetChoices.actors.map(a => `<option value="${foundry.utils.escapeHTML(a.uuid)}"${(sideHits.length === 1 ? sideHits[0].proof.targetUuid : (automaticAttackBonus?.proof.targetUuid ?? targetChoices.selected)) === a.uuid ? " selected" : ""}>${foundry.utils.escapeHTML(a.name ?? "Character")}</option>`).join("")}</select></label><p>A selected target sheet supplies its known armor protection. Other immunities and reachable vitals still require confirmation.</p>
        ${attackBonusHits.length ? `<label>Recorded attack damage bonus <select name="attackDamageSourceUuid"><option value="">No recorded attack bonus</option>${attackBonusHits.map(h => `<option value="${foundry.utils.escapeHTML(h.message.uuid)}"${automaticAttackBonus === h ? " selected" : ""}>${foundry.utils.escapeHTML(h.proof.source)} ${h.proof.sneakDice ? `+${h.proof.sneakDice}d6 sneak` : `+${h.proof.bonus}`} — ${foundry.utils.escapeHTML(targetChoices.actors.find(a => a.uuid === h.proof.targetUuid)?.name ?? h.proof.manualTargetName ?? "Recorded target")}</option>`).join("")}</select></label><p>Use this exact recorded successful attack and target. Its damage bonus applies once and combines with ordinary weapon modifiers before minimum damage.</p>` : ""}
        <label><input type="checkbox" name="includeSneakAttack"${sideHits.length === 1 || trickSneakHit ? " checked" : ""} /> Include earned sneak attack damage</label>${sideHits.length ? `<label>Side Stance hit <select name="sideStanceSourceUuid"><option value="">Other attack / no Side Stance die</option>${sideHits.map(h => `<option value="${foundry.utils.escapeHTML(h.message.uuid)}"${sideHits.length === 1 ? " selected" : ""}>Round ${h.message.flags.spycraft2.rollCombat?.round ?? "?"} — ${foundry.utils.escapeHTML(targetChoices.actors.find(a => a.uuid === h.proof.targetUuid)?.name ?? "Recorded opponent")}</option>`).join("")}</select></label><p>The selected hit supplies one earned die, once. It is combined with this attack’s other sneak damage; leaving the stance after the hit does not remove its recorded entitlement.</p>` : ""}
        <label><input type="checkbox" name="successfulStandardAttack"${sideHits.length === 1 ? " checked" : ""} /> This was a successful Standard Attack</label>
        <label><input type="checkbox" name="targetCharacter"${sideHits.length === 1 ? " checked" : ""} /> Target is a character, not an object</label>
        <label><input type="checkbox" name="targetFlanked" /> I am flanking this target with this attack</label><label><input type="checkbox" name="targetHelpless" /> Target is helpless</label><label><input type="checkbox" name="targetVulnerable" /> Target is vulnerable</label>
        <label><input type="checkbox" name="targetVitalsConfirmed" /> Target is not immune to critical hits or sneak attack damage, is not hidden to me and has reachable vitals</label>
        <label>Damage type <select name="damageType"><option value="lethal">Lethal</option><option value="subdual">Subdual</option></select></label>
        <label>Conversion <select name="damageConversion"><option value="none">None</option><option value="lethalToSubdual">Lethal to subdual (requires Bludgeon)</option><option value="subdualToLethal">Subdual to lethal (no sneak attack)</option></select></label>
        <label>Ranged target distance (feet) <input type="number" name="distanceFeet" min="0" step="any" /></label>
        <label><input type="checkbox" name="braced" /> I was bracing this two-handed firearm/hurled weapon for this attack (Sniper dice)</label>
      </div>`
        });
        if (!input) return null;
        options = { ...options, ...input, includeSneakAttack: !!input.includeSneakAttack };
      }
      const cqbPreview = cqbRangePlan(this.system, item.system, options, "damage");
      if (cqbPreview.active && cqbPreview.basics && !cqbPreview.known) {
        const input = await systemDialog.input({
          window: { title: "CQB damage target distance" },
          rejectClose: false,
          content:
            '<div class="spycraft2-roll-options"><p>CQB Basics adds1 damage against targets within current CQB Range. Enter the actual target distance for this damage; this does not take another attack or spend dice.</p><label>Target distance (feet) <input name="distanceFeet" type="number" min="0" step="any" required /></label></div>'
        });
        if (!input) return null;
        const n =
          typeof input.distanceFeet === "number"
            ? input.distanceFeet
            : typeof input.distanceFeet === "string" && input.distanceFeet.trim()
              ? Number(input.distanceFeet)
              : NaN;
        if (!Number.isFinite(n) || n < 0) throw new Error("Enter the actual finite nonnegative CQB damage distance.");
        options = { ...options, distanceFeet: n };
      }
      if (
        specialistApplies(this.system, item.system, "Killer Instinct") &&
        !item.system.isMelee &&
        !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(item.system.proficiency) &&
        options.withinCQB === undefined
      ) {
        const input = await systemDialog.input({
          window: { title: "Killer Instinct range" },
          rejectClose: false,
          content: `<label><input type="checkbox" name="withinCQB" /> The target is beyond Reach and within CQB range (${this.system.cqbRange ?? 30} ft.)</label>`
        });
        if (!input) return null;
        options = { ...options, ...input };
      }
      const attackDamageBenefit = options.attackDamageSourceUuid
        ? makeAttackDamageProof(this, item, options.attackDamageSourceUuid, {
            targetUuid: options.targetActorUuid || options.targetActor?.uuid
          })
        : null;
      options = {
        ...options,
        attackDamageBonus: attackDamageBenefit?.bonus ?? 0,
        ...(attackDamageBenefit?.hands ? { hands: attackDamageBenefit.hands } : {})
      };
      const damageWeaponSource = current => ({
        ...current.system,
        id: current.id ?? current._id,
        name: current.name,
        qualities: grantedMeleeQuality(current.system.qualities ?? "", attackDamageBenefit?.grantedQuality)
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
      if (damage?.blocked) return ui.notifications.warn(damage.blockedReason);
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
        if (!current) throw new Error("The finesse damage weapon was removed.");
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
          throw new Error("The finesse damage source or modifier changed during the roll.");
      };
      const cqbDamageSnapshot = damage?.cqbRange?.active ? JSON.stringify(damage.cqbRange) : null,
        validateCQBRange = cqbDamageSnapshot
          ? () => {
              const current = item.id && this.items?.get ? this.items.get(item.id) : item;
              if (!current) throw new Error("The CQB damage weapon was removed.");
              const next = weaponDamage(
                this.system,
                damageWeaponSource(current),
                damageWeaponContext(current),
                this.type
              );
              if (JSON.stringify(next?.cqbRange) !== cqbDamageSnapshot)
                throw new Error("CQB source, weapon or range changed during this damage roll.");
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
          throw Error("Choose the same recorded attack for its damage bonus and Side Stance die.");
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
      const sneak = sneakAttackDamagePlan(
          this.system,
          { ...item.system, range: this.weaponAttack(item, options).range },
          {
            ...options,
            sideStanceDie: !!sideStanceDamage,
            trickSneak:
              options.includeSneakAttack === true && attackDamageBenefit?.sneakDice
                ? { source: attackDamageBenefit.sneakSource, dice: attackDamageBenefit.sneakDice }
                : null,
            whirlingFlankingProof: whirlingAttackProof(this, {
              targetFlanked: options.targetFlanked,
              targetActorUuid: targetActor?.uuid
            }),
            targetSystem: targetActor?.system ?? null
          }
        ),
        sneakAttackTarget = sneak.active ? sneakAttackTargetSnapshot(targetActor) : null;
      const formula = damage?.formula && sneak.active ? `${damage.formula} + ${sneak.formula}` : damage?.formula;
      if (!formula) return ui.notifications.warn(game.i18n.format("SPYCRAFT.Weapon.NoDamage", { name: item.name }));
      return this.rollCheck(formula, this.getRollData(), {
        meleeArmorPiercing: damage.meleeArmorPiercing.evidence,
        attackDamageBenefit,
        sideStanceDamage,
        finesseDamage,
        validateAttackContext: validateFinesseDamage,
        weaponQualities: damage.effectiveQualities,
        flavor: `${game.i18n.localize("SPYCRAFT.Damage")}: ${foundry.utils.escapeHTML(item.name)} (${foundry.utils.escapeHTML(damage.damageText ?? item.system.damage)})${damage.ammunition ? ` — ${foundry.utils.escapeHTML(damage.ammunition)}` : ""}${damage.meleeArmorPiercing.evidence ? `<br><small>${foundry.utils.escapeHTML(damage.meleeArmorPiercing.notes.join(" "))}</small>` : ""}${attackDamageBenefit ? `<br><small>${foundry.utils.escapeHTML(attackDamageBenefit.source)}: recorded attack damage +${attackDamageBenefit.bonus}, once against ${foundry.utils.escapeHTML(attackDamageBenefit.manualTargetName ?? "the recorded target")}.${attackDamageBenefit.sneakDice ? ` ${attackDamageBenefit.sneakSource}: its hit supplies ${attackDamageBenefit.sneakDice} die of sneak attack damage when the sneak attack conditions are met.` : ""}${attackDamageBenefit.grantedQuality === "TKD" ? " Takedown: if a character suffers damage, resolve Fortitude at pre-DR damage (+10 DC if wounds were lost); failure causes sprawled." : ""}</small>` : ""}${sneak.active ? `<br><small>${foundry.utils.escapeHTML(sneak.notes)}</small>` : ""}${damage.cqbRange?.active ? `<br><small>${foundry.utils.escapeHTML(damage.cqbRange.notes.join(" "))}</small>` : ""}${damage.markDamage?.active ? `<br><small>${foundry.utils.escapeHTML(damage.markDamage.note)}</small>` : ""}`,
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
    async rollActionDie(options = {}) {
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      let input = options;
      if (
        !Object.keys(input).length &&
        (shakenRules(this.actionDiceFundingSystem).extraDice ||
          unrestrictedBonusPools(this.actionDiceFundingSystem, this.usagePeriods).some(p => p.available))
      ) {
        input = await systemDialog.input({
          window: { title: "Spend an action die" },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>Roll one benefit die. Surcharge dice are spent without being rolled.</p></div>`
        });
        if (!input) return null;
      }
      return this.spendActionDiceBenefit(
        1,
        async payment => {
          const ad = payment.system.actionDice,
            roll = await new Roll(
              `1d${ad.die}x>=${ad.explodeAt ?? ad.die}${ad.bonus ? ` + ${ad.bonus}` : ""}`
            ).evaluate();
          if (JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken)
            throw new Error("The Shaken condition changed while rolling this action die.");
          const actionDieReceiptId =
            globalThis.foundry?.utils?.randomID?.() ??
            "actionDie-" + (this._actionDieReceiptSequence = (this._actionDieReceiptSequence ?? 0) + 1);
          try {
            return await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              flavor:
                game.i18n.localize("SPYCRAFT.ActionDice.Spend") +
                (payment.surcharge
                  ? ` — ${payment.cost} spent: one benefit die + ${payment.surcharge} Shaken surcharge`
                  : ""),
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "actionDie",
                  actionDieReceiptId,
                  actionDiceAllowed: false,
                  funding: {
                    bonusPoolId: payment.bonusPoolId,
                    die: payment.die,
                    count: 1,
                    ...(payment.surcharge
                      ? {
                          paymentId: payment.id,
                          surcharge: payment.surcharge,
                          totalCost: payment.cost,
                          allocations: payment.allocations
                        }
                      : {})
                  }
                }
              }
            });
          } catch (error) {
            const posted = [...(game.messages ?? [])].find(
              m =>
                m.flags?.spycraft2?.actorUuid === this.uuid &&
                m.flags?.spycraft2?.actionDieReceiptId === actionDieReceiptId
            );
            if (posted) return posted;
            throw error;
          }
        },
        {
          bonusPoolId: input.bonusPoolId ?? "",
          ...surchargeFundingInput(input),
          purpose: "Manual action-die benefit",
          benefit: "manualDie",
          expectedShaken
        }
      );
    }

    /** Attack bonus for a weapon, including proficiency and forte. */
    sensoryContext(options = {}) {
      return {
        ...options,
        spearChargeCombat: this.mentalLeapCombatContext(),
        stalkingCombat: this.mentalLeapCombatContext(),
        cheapShotCombat: this.mentalLeapCombatContext(),
        feintCombat: this.mentalLeapCombatContext(),
        tripAttackCombat: this.mentalLeapCombatContext(),
        tripDefenseCombat: this.mentalLeapCombatContext(),
        conveyanceBullRushCombat: this.mentalLeapCombatContext(),
        bullRushAttackCombat: this.mentalLeapCombatContext(),
        threatenCombat: this.mentalLeapCombatContext(),
        taskWorldTime: game.time?.worldTime ?? null,
        maneuverCombat: this.mentalLeapCombatContext(),
        inCombat: options.inCombat === true || !!this.participatingCombat,
        bound: options.bound === true || !!this.statuses?.has("bound"),
        blinded: !!options.blinded || !!this.statuses?.has("blind") || !!this.statuses?.has("blinded"),
        deafened: !!options.deafened || !!this.statuses?.has("deaf") || !!this.statuses?.has("deafened")
      };
    }

    weaponContext(item, options = {}) {
      const ammunition = item.system.loadedAmmoId ? this.items?.get?.(item.system.loadedAmmoId) : null;
      return {
        ...this.sensoryContext(options),
        whirlingFlankingProof: whirlingAttackProof(this, options),
        ...(options.meleeTrick === "fend" ? { fendTiming: fendTiming(this) } : {}),
        ammunition: ammunition ? { ...ammunition.system, name: ammunition.name } : null
      };
    }

    weaponAttack(item, options = {}) {
      return weaponAttack(
        this.system,
        { ...item.system, id: item.id ?? item._id, name: item.name },
        CONFIG.SPYCRAFT,
        this.type,
        this.weaponContext(item, options)
      );
    }

    /* -------------------------------------------- */
    /*  Character building                            */
    /* -------------------------------------------- */
  };
