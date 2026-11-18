/** Checks a character rolls: the shared roll itself, attribute checks, saves and action dice. */
import { blackCatRollEffect } from "../../rules/black-cat.mjs";
import { allOrNothingEligible, allOrNothingRanges } from "../../rules/all-or-nothing.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { rollPipeline } from "../../rolls/index.mjs";
import { formulaWithModifiers, planTerms, planTotal } from "../../rules/roll-pipeline.mjs";
import { fendTiming } from "../../rules/fend.mjs";
import { whirlingAttackProof } from "../../apps/whirling-stance.mjs";
import { endCombatStance } from "../../apps/combat-stance.mjs";
import { stillStandingSaveContent } from "../../apps/still-standing.mjs";
import { attributeDamageEvidence, validateAttributeDamageProof } from "../../rules/attribute-damage.mjs";
import { oldSchoolContext } from "../../apps/old-school.mjs";
import { dartingStyleState } from "../../rules/darting-state.mjs";
import { superiorCoverState } from "../../rules/superior-cover.mjs";
import { twoWeaponStyleState } from "../../rules/two-weapon-state.mjs";
import { surchargeFundingInput, unrolledPaymentFundingInput } from "../../apps/action-die-benefits.mjs";
import { shakenRules } from "../../rules/shaken.mjs";
import { restraintActionBlock } from "../../rules/restraints.mjs";
import { evasionPlan, evasionSaveContext } from "../../rules/defense.mjs";
import { sleepingSourceSnapshot } from "../../rules/sleeping.mjs";
import {
  attributeCollapsePlan,
  attributeActionBlock,
  conditionRollPenalties,
  conditionAbilityPenalty
} from "../../rules/attributes.mjs";
import { taskPressureUseProof } from "../../rules/task-pressure.mjs";
import { validateAnalysisTaskRoll } from "../../rules/analysis-tasks.mjs";
import { oneInAMillionEligible, tenSecondSolutionEligible, cunningPlanEffect } from "../../rules/class-checks.mjs";
import { unrestrictedBonusPools } from "../../rules/bonus-pools.mjs";
import { checkFlavor, rollEvidence } from "../../rules/outcomes.mjs";
import { weaponAttack } from "../../rules/gear.mjs";
import { resolveSkillResult } from "../../rules/checks.mjs";
import { featReminders } from "../../rules/feat-reminders.mjs";
import { loc } from "../../i18n.mjs";

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
          throw new Error(
            loc`Only Evasion III may take 10 on a Reflex save, without roll-choice or forced-20 abilities.`
          );
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
          throw new Error(loc`The GC resolves Eye for Detail for a secret or passive Search check.`);
        chooseTwice = true;
        choiceSource = "Eye for Detail";
      }
      const million = !!options.oneInAMillion,
        solution = !!options.tenSecondSolution,
        twenty = million || solution;
      // All or Nothing, p.189: reserve its session use with whichever declaration reserves first, then widen ranges.
      const allOrNothing = options.allOrNothing === true;
      if (allOrNothing) {
        if (!allOrNothingEligible(this.system, { checkKind, checkMethod, formula }))
          throw new Error(loc`All or Nothing applies to a rolled skill check, Knowledge check or attack.`);
        if (!options.allOrNothingCommitted) {
          const extras = [...(options.additionalUses ?? []), { id: "allOrNothing", workflow: "allOrNothing" }];
          if (million || solution || (options.cunningPlan === true && !options.cunningPlanCommitted))
            options = { ...options, allOrNothingCommitted: true, additionalUses: extras };
          else
            return this.useLimitedAbility(
              "allOrNothing",
              (status, payment) =>
                this.rollCheck(formula, data, {
                  ...options,
                  preRollFunding: this.preRollPaymentReceipt(payment) ?? options.preRollFunding,
                  allOrNothingCommitted: true
                }),
              {
                workflow: "allOrNothing",
                additionalCost: options.additionalCost ?? 0,
                additionalBenefitCount: options.additionalBenefitCount ?? ((options.additionalCost ?? 0) > 0 ? 1 : 0),
                ...surchargeFundingInput(options),
                ...unrolledPaymentFundingInput(options),
                additionalUses: options.additionalUses ?? [],
                bonusPoolId: options.bonusPoolId ?? ""
              }
            );
        }
      }
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

      if (million && solution) throw new Error(loc`Choose one declared natural-20 ability.`);
      if (solution && !options.solutionCommitted) {
        if (!tenSecondSolutionEligible(this.system, { ...options, chooseTwice }) || !/^1d20\b/.test(formula))
          throw new Error(
            loc`10-Second Solution requires Scientist 14 and a standalone rolled Intelligence skill or Knowledge check, without another roll-choice ability.`
          );
        if (rollMode === "blindroll" && !game.user?.isGM)
          throw new Error(loc`The GC resolves 10-Second Solution for a secret check.`);
        return this.useLimitedAbility(
          "tenSecondSolution",
          (status, payment) => {
            if (!tenSecondSolutionEligible(this.system, { ...options, chooseTwice }))
              throw new Error(loc`10-Second Solution no longer qualifies for this check.`);
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
            loc`One in a Million requires Soldier 14 and a rolled attack, Fortitude save or Strength/Constitution skill check. It cannot combine with Bright Idea.`
          );
        if (rollMode === "blindroll" && !game.user?.isGM)
          throw new Error(loc`The GC resolves One in a Million for a secret check.`);
        return this.useLimitedAbility(
          "oneInAMillion",
          (status, payment) => {
            if (!oneInAMillionEligible(this.system, { ...options, chooseTwice }))
              throw new Error(loc`This check no longer qualifies for One in a Million.`);
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
      if (allOrNothing && !options.allOrNothingRangesApplied)
        ({ threat, error } = allOrNothingRanges({ threat, error }));
      // Black Cat, p.189: a marked character's checks carry +2 error range this scene. A replacement roll already has it.
      const blackCat = options.blackCatApplied
        ? (options.blackCat ?? null)
        : blackCatRollEffect(this.flags?.spycraft2?.blackCat, this.usagePeriods, error);
      if (blackCat?.error !== undefined) error = blackCat.error;
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
          throw new Error(loc`The Shaken condition changed before this paid check.`);
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
          window: { title: loc`${choiceSource}: choose the preferred result` },
          rejectClose: false,
          content: `<label>${loc`Result`} <select name="chosen">${alternatives.map((r, index) => `<option value="${index}">${loc`Roll ${index + 1}: ${r.total} (natural ${r.naturalDie})`}</option>`).join("")}</select></label><p>${loc`Closing this dialog keeps the first result.`}</p>`
        });
        chosenIndex = Number(selection?.chosen) === 1 ? 1 : 0;
        roll = rolls[chosenIndex];
      }
      for (const payment of [options.preRollFunding, options.rerollFunding])
        if (
          payment?.shakenSignature &&
          payment.shakenSignature !== JSON.stringify(shakenRules(this.actionDiceFundingSystem))
        )
          throw new Error(loc`The Shaken condition changed while resolving this paid check.`);
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
        throw new Error(loc`Review the current Shaken sources before rolling.`);
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
        // Rows contributors added while the total was planned are already inside the total; they are recorded only.
        ...(options.planModifiers?.length ? { planModifiers: options.planModifiers } : {}),
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
        ...(allOrNothing ? { allOrNothing: true } : {}),
        ...(blackCat ? { blackCat: blackCat.record ?? blackCat } : {}),
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
        // The language the card's text was written in: a viewer in another language gets its notes redone.
        lang: game.i18n?.lang ?? "en",
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
            game.i18n.localize(CONFIG.SPYCRAFT.abilities[key]) + (conditionAbilityAdjustment ? loc` — Drunk −2` : ""),
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
        return ui.notifications.warn(loc`A dead character cannot make a saving throw.`);
      const feats = new Set(this.system.activeFeatNames ?? []),
        manualStandingContent = stillStandingSaveContent(this.system, key),
        stillStandingContent =
          options.takedown && manualStandingContent
            ? `<p>${loc`This recorded Fortitude save resists takedown. Earned Still Standing applies automatically.`}</p>`
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
          !!stillStandingContent ||
          featReminders(this.items, { kind: "save", saveKey: key }).length > 0)
      ) {
        input = await systemDialog.input({
          window: { title: game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label) },
          rejectClose: false,
          content: rollPipeline.dialog({ dialog: "save", actor: this, feats, key, stillStandingContent })
        });
        if (!input) return null;
      }
      input = rollPipeline.read({ dialog: "save", actor: this, key }, input);
      if (options.takedown) input = { ...input, resistingTakedown: true, takedownAttackConfirmed: true };
      // Each rule's part of the save (cover, Stone Cold, bracing, terrain, …) is a term it registers itself.
      const terms = planTerms("save", { actor: this, system: this.system, saveKey: key, input, options });
      const blocked = terms.merge("blocked")[0];
      if (blocked) return ui.notifications.warn(blocked);
      const checkMethod = input.checkMethod ?? "roll";
      if (shakenRules(this.system).needsReview)
        return ui.notifications.warn(loc`Review the current Shaken sources before saving throws.`);
      if (["take10", "take20"].includes(checkMethod) && shakenRules(this.system).fixedResultsForbidden)
        return ui.notifications.warn(loc`Shaken: taking 10 or 20 is unavailable (p.342).`);
      if (checkMethod !== "roll" && (checkMethod !== "take10" || key !== "ref" || !evasionPlan(this.system).canTake10))
        return ui.notifications.warn(loc`Only Evasion III permits taking 10 with a Reflex save.`);
      const evasionContext =
        key === "ref"
          ? evasionSaveContext(this.system, {
              flatFooted: input.flatFooted === true,
              reflexReducesDamage: input.reflexReducesDamage === true
            })
          : null;
      const { total, planModifiers } = planTotal(
        "save",
        { actor: this, system: this.system, saveKey: key, input },
        terms.merge("rows", [[10, [loc`Save bonus`, this.system.saves?.[key]?.total ?? 0]]])
      );
      const guards = terms.list.filter(term => typeof term.facts === "function"),
        planned = guards.map(term => term.facts());
      return this.rollCheck(
        "1d20 + @total",
        { total },
        {
          planModifiers,
          featReminders: input.featReminders,
          flavor: terms
            .merge("flavor", [
              [10, game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label)],
              [20, checkMethod === "take10" ? loc` — Evasion III: take 10` : ""],
              [30, options.takedown ? loc` — Takedown DC${Number(options.takedown.dc)}` : ""],
              [40, options.damageSave ? loc` — Damage event DC${Number(options.damageSave.dc)}` : ""]
            ])
            .join(""),
          takedown: options.takedown ?? null,
          takedownLease: options.takedownLease,
          cheapShotRecovery: options.cheapShotRecovery ?? null,
          validateCheapShotRecovery: options.validateCheapShotRecovery,
          damageSave: options.damageSave ?? null,
          validateDamageSave: options.validateDamageSave,
          ...Object.assign({}, ...terms.all("options")),
          checkMethod,
          evasionContext,
          validateSaveContext: terms.list.some(term => term.guarded)
            ? () => {
                if (guards.some((term, index) => term.facts() !== planned[index]))
                  throw new Error(
                    loc`The conditional save feat, Still Standing source or confirmed save purpose changed before posting.`
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

    async rollActionDie(options = {}) {
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      let input = options;
      if (
        !Object.keys(input).length &&
        (shakenRules(this.actionDiceFundingSystem).extraDice ||
          unrestrictedBonusPools(this.actionDiceFundingSystem, this.usagePeriods).some(p => p.available))
      ) {
        input = await systemDialog.input({
          window: { title: loc`Spend an action die` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>${loc`Roll one benefit die. Surcharge dice are spent without being rolled.`}</p></div>`
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
            throw new Error(loc`The Shaken condition changed while rolling this action die.`);
          const actionDieReceiptId =
            globalThis.foundry?.utils?.randomID?.() ??
            "actionDie-" + (this._actionDieReceiptSequence = (this._actionDieReceiptSequence ?? 0) + 1);
          try {
            return await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              flavor:
                game.i18n.localize("SPYCRAFT.ActionDice.Spend") +
                (payment.surcharge
                  ? loc` — ${payment.cost} spent: one benefit die + ${payment.surcharge} Shaken surcharge`
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
          purpose: loc`Manual action-die benefit`,
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
