import { attackResolutionNote, opposedNote } from "./damage-application.mjs";
import { dropFollowUpNote } from "./drop-follow-up.mjs";
import { opportunistNote } from "./opportunist.mjs";
import { allOrNothingNote } from "./all-or-nothing.mjs";
import { blackCatNote } from "./black-cat.mjs";
import { reminderNote } from "./feat-reminders.mjs";
import { cooperativeNotes } from "./cooperative.mjs";
import { resolveSkillResult } from "./checks.mjs";
import { describeModifiers } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { formatRange, outcomeLabel } from "./outcome-labels.mjs";
import { checkCandidates, errorDecisionPending, triumphCheck } from "./check-candidates.mjs";
export { checkCandidates, errorDecisionPending };
export function adjudicateCheck(check, succeeded) {
  if (check.manualAdjustment && !succeeded)
    throw new Error(
      loc`Manual Adjustment already reversed this failure. Review its recorded effect before changing the outcome.`
    );
  if (typeof succeeded !== "boolean") throw new Error(loc`Confirm whether the check succeeded or failed.`);
  if (check.checkKind === "attack" && check.effectiveTotal >= 75 && !succeeded)
    throw new Error(
      loc`An attack Triumph is a critical hit (pp.330–331). Correct the recorded result before marking it a miss.`
    );
  if ((check.criticalFailure && succeeded) || (check.criticalSuccess && !succeeded))
    throw new Error(loc`Resolve the activated critical result before changing this outcome.`);
  const cap = Object.hasOwn(check, "boostCap") ? check.boostCap : check.cap;
  const result = resolveSkillResult(check.rawTotal, check.naturalDie, {
    cap,
    threat: check.threat ?? 0,
    actionDieBonus: check.boostTotal ?? 0,
    succeeded
  });
  const candidates = checkCandidates({ ...check, effectiveTotal: result.total });
  return {
    successConfirmed: succeeded,
    errorConfirmed: candidates.negative || ((!succeeded || check.allOrNothing === true) && candidates.naturalError),
    threatConfirmed:
      succeeded && !candidates.negative && (candidates.threat || (check.checkKind === "attack" && candidates.triumph)),
    triumphed: succeeded && triumphCheck(check) && result.triumph,
    effectiveTotal: result.total,
    capped: result.limited
  };
}
/** Preserve roll evidence when boosts or adjudication replace the original chat flavor. */
/**
 * The card text for a viewer whose language differs from the one the check was posted in: the notes worked out
 * from the record are written again in the viewer's language. The line the roller's client composed (the check's
 * name and its own notes) stays as posted. Returns null when the posted text already serves.
 */
export function viewerFlavor(check, viewerLanguage) {
  if (!check?.lang || !viewerLanguage || check.lang === viewerLanguage) return null;
  return checkFlavor(check);
}

export function checkFlavor(check) {
  const esc = v => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const candidates = checkCandidates(check),
    known = typeof check.successConfirmed === "boolean",
    notes = [];
  if (check.twoWeaponFinalAttack)
    notes.push(
      loc`Two-weapon final Standard Attack ${check.twoWeaponFinalAttack.sequence} of ${check.twoWeaponFinalAttack.extraAttacks}; least-used weapon confirmed.`
    );
  if (check.finalAttack?.source === "mobileOffense")
    notes.push(
      loc`Mobile Offense: final Standard Attack at ${check.finalAttack.attackAtFeet} ft. along the ${check.finalAttack.moveDistanceFeet}-ft. counted Standard Move; one round use recorded.`
    );
  if (check.finalAttack?.source === "contempt")
    notes.push(
      loc`Contempt: final Standard Attack against the confirmed standard target; combat use ${check.finalAttack.combatSequence} of ${check.finalAttack.combatAllowance}.`
    );
  if (check.finalAttack?.source === "missTrick")
    notes.push(
      loc`${esc(check.finalAttack.name)}: immediate final Standard Attack with the same weapon against the original opponent; triggering miss recorded.`
    );
  if (check.finalAttack?.source === "combatInstincts")
    notes.push(
      loc`Combat Instincts: immediate final Standard Attack against the adjacent opponent after a miss by ${check.finalAttack.missMargin}; one round use recorded.`
    );
  if (dropFollowUpNote(check.finalAttack)) notes.push(dropFollowUpNote(check.finalAttack));
  if (opportunistNote(check.finalAttack)) notes.push(opportunistNote(check.finalAttack));
  if (allOrNothingNote(check)) notes.push(allOrNothingNote(check));
  if (blackCatNote(check)) notes.push(esc(blackCatNote(check)));
  if (check.featReminders?.length) notes.push(esc(reminderNote(check.featReminders)) + ".");
  notes.push(...cooperativeNotes(check).map(esc));
  if (attackResolutionNote(check)) notes.push(esc(attackResolutionNote(check)));
  if (opposedNote(check)) notes.push(esc(opposedNote(check)));
  if ((check.checkMethod ?? "roll") === "roll" && (check.threat > 0 || check.error > 0))
    notes.push(
      loc`Error range ${formatRange("error", check.error)}; threat range ${formatRange("threat", check.threat)}.`
    );
  if (known) notes.push(check.successConfirmed ? loc`Succeeded.` : loc`Failed.`);
  if (check.campaignDC)
    notes.push(
      loc`Campaign DC: ${Number(check.campaignDC.baseDC)} before campaign modifiers, ${Number(check.campaignDC.dc)} after them; final result ${Number(check.campaignDC.total)}.`
    );
  if (check.cunningPlan)
    notes.push(
      loc`Cunning Plan: free action; error range ${check.cunningPlan.originalError} → ${check.cunningPlan.error}; one scene use spent.`
    );
  if (check.manualAdjustment) {
    const m = check.manualAdjustment;
    notes.push(
      loc`Manual Adjustment: half action; failure reversed at the lowest positive grade against DC ${m.difficultyClass} (class level +20 = ${m.threshold}). Original roll retained; one session use spent.`
    );
  }
  const automatic = check.automaticSkillSuccess ?? check.flawlessSearch;
  if (automatic)
    notes.push(
      loc`${String(automatic.name ?? "Flawless Search")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(
          ">",
          "&gt;"
        )}: automatic success at the lowest positive grade against DC/opposing result ${automatic.difficultyClass} (class level +20 = ${automatic.threshold}). The rolled result is retained.`
    );
  if (check.criticalFailure) notes.push(`<strong>${outcomeLabel(check, "criticalFailure")}.</strong>`);
  else if (check.errorConfirmed) {
    notes.push(`<span class="spycraft2-error">${loc`Error.`}</span>`);
    if (check.criticalFailureCostIncrease)
      notes.push(loc`Critical-failure activation costs +${check.criticalFailureCostIncrease} action dice.`);
  } else if (!known && candidates.error)
    notes.push(`<span class="spycraft2-error">${`${outcomeLabel(check, "error")}.`}</span>`);
  if (check.criticalSuccess) notes.push(`<strong>${outcomeLabel(check, "criticalSuccess")}.</strong>`);
  else if (check.threatConfirmed) notes.push(`<span class="spycraft2-threat">${loc`Threat.`}</span>`);
  else if (!known && candidates.threat)
    notes.push(`<span class="spycraft2-threat">${`${outcomeLabel(check, "threat")}.`}</span>`);
  if (check.triumphed) {
    notes.push(`<strong>${loc`Triumph.`}</strong>`);
    if (check.checkKind === "attack")
      notes.push(
        loc`Includes a one-action-die critical hit; choose its effect before damage, spending only for higher results. At the table: once-per-mission team +10% XP; witnessing opponents suffer the applicable stress damage and make Morale checks (p.331).`
      );
  } else if (!known && candidates.triumph)
    notes.push(
      check.checkKind === "attack"
        ? loc`Attack Triumph: confirm the recorded result to choose its critical effect.`
        : loc`Potential Triumph; success is still required.`
    );
  if (check.criticalActivation) {
    const activation = check.criticalActivation;
    const escaped = String(activation.effect ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
    notes.push(escaped);
    notes.push(
      loc`Activation cost: ${activation.cost} action ${activation.cost === 1 ? "die" : "dice"}${activation.sources?.length ? ` (${activation.sources.map(esc).join("; ")})` : ""}.`
    );
  }
  for (const payment of [check.preRollFunding, check.rerollFunding])
    if (payment?.surcharge)
      notes.push(
        loc`Action-die payment: base ${payment.baseCost}, Shaken surcharge ${payment.surcharge}, total ${payment.count}.`
      );
  if (check.schoolOfHardKnocks)
    notes.push(
      loc`School of Hard Knocks: gained ${check.schoolOfHardKnocks.units} bonus d${check.schoolOfHardKnocks.die} action ${check.schoolOfHardKnocks.units === 1 ? "die" : "dice"}; no award XP.`
    );
  if (check.generousBoost)
    notes.push(
      loc`Generous: donor rolled ${check.generousBoost.dice.join(" + ")} on d${check.generousBoost.die}, modifier ${check.generousBoost.bonusEach} per die; added +${check.generousBoost.added}${check.generousBoost.replaced ? loc` after the donor’s Calculating` : ""}.`
    );
  if (check.oldSchool)
    notes.push(
      loc`Old School: +4 against ${esc(check.oldSchool.target)} (level ${check.oldSchool.targetLevel}; mission Threat Level ${check.oldSchool.missionThreatLevel}), ${esc(check.oldSchool.sharedClassAbility || check.oldSchool.sharedFeats.join(", "))} shared (p.209).`
    );
  if (check.minimumAdjustment)
    notes.push(loc`Practice Makes Perfect: natural ${check.naturalDie} becomes 10 (+${check.minimumAdjustment}).`);
  if (check.requiredBonusPoolId && !check.requiredBonusSpent)
    notes.push(
      check.bonusTransferredTo
        ? loc`The unspent class bonus die follows the replacement check.`
        : check.criticalFailure || check.resolved || check.superseded
          ? loc`The unused compulsory class bonus die is forfeited.`
          : loc`Compulsory class bonus die pending: spend it on this check before resolving.`
    );
  if (check.bonusBoosts?.length)
    notes.push(
      check.bonusBoosts
        .map(
          b =>
            loc`Class bonus: ${String(b.label).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}, ${b.count} d${b.die} spent on this check only.`
        )
        .join(" ")
    );
  if (check.resultSource === "masterThief")
    notes.push(
      loc`Master Thief: opponent’s final result ${check.opponentResult} +1; no error or threat. No die rolled; action dice cannot boost this fixed result (pp.38,61).`
    );
  if (check.tenSecondSolution)
    notes.push(
      loc`10-Second Solution: declared natural 20 on a standalone Intelligence skill or Knowledge check, outside Complex Tasks/Dramatic Conflicts. May become a critical success after confirming success; cannot be forcibly rerolled.`
    );
  if (check.oneInAMillion)
    notes.push(
      loc`One in a Million: declared natural 20; may be activated as a critical success after confirming success. This natural 20 cannot be forcibly rerolled.`
    );
  if (check.alternatives)
    notes.push(
      loc`${String(check.choiceSource ?? "Bright Idea")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(
          ">",
          "&gt;"
        )}: chose roll ${(check.chosenIndex ?? 0) + 1}; alternatives ${check.alternatives.map(r => `${r.total} (natural ${r.naturalDie})`).join(" / ")}.`
    );
  if (check.capped || check.boostTotal || check.oldSchool || known)
    notes.push(
      `<strong>${loc`Effective result: ${check.effectiveTotal}`}</strong>${check.boostTotal ? loc` · action dice ${check.boostTotal >= 0 ? "+" : ""}${check.boostTotal}` : ""}`
    );
  const contributed = [...(check.planModifiers ?? []), ...(check.pipelineModifiers ?? [])];
  if (contributed.length) notes.push(`${esc(describeModifiers(contributed))}.`);
  return `${check.baseFlavor ?? loc`Check`}${notes.length ? `<br>${notes.join(" ")}` : ""}`;
}

/** Decisions made in a dialog must still refer to the same roll when the transaction begins. */
const rollEvidenceFields = check => [
  check.skillBonusCondition,
  check.skillCheckAdjustment,
  check.gamblingDice,
  check.rollCombat,
  check.strutPoolId,
  check.formula,
  check.rollData,
  check.checkKind,
  check.ability,
  check.skillKey,
  check.checkId,
  check.cap,
  check.requiredBonusPoolId,
  check.rerollResources,
  check.error,
  check.cunningPlan?.reduction,
  check.rawTotal,
  check.effectiveTotal,
  check.naturalDie,
  check.boostTotal,
  check.boostSpent,
  check.successConfirmed,
  check.errorConfirmed,
  check.threatConfirmed,
  check.criticalSuccess,
  check.criticalFailure,
  check.superseded,
  check.resolved,
  check.generousBoost?.donorUuid
];
export function rollEvidence(check) {
  return JSON.stringify([
    ...(check.attackContext?.reach
      ? [
          {
            reach: check.attackContext.reach,
            reachAdjacent: check.attackContext.reachAdjacent,
            reachGeometryConfirmed: check.attackContext.reachGeometryConfirmed
          }
        ]
      : []),
    ...(check.attackContext?.flanking?.whirling ? [{ whirlingFlanking: check.attackContext.flanking.whirling }] : []),
    ...(check.tripAttack ? [check.tripAttack] : []),
    ...(check.combatPersuasion
      ? [
          {
            combatPersuasion: check.combatPersuasion,
            campaignSkillDCPolicy: check.campaignSkillDCPolicy,
            cooperative: check.cooperative
          }
        ]
      : []),
    ...(check.attackContext?.damageType ? [{ weaponDamageType: check.attackContext.damageType }] : []),
    ...(check.attackContext?.campaignAttackPolicy
      ? [{ campaignAttackPolicy: check.attackContext.campaignAttackPolicy }]
      : []),
    ...(check.meleeArmorPiercing
      ? [{ meleeArmorPiercing: check.meleeArmorPiercing, weaponQualities: check.weaponQualities }]
      : []),
    ...(check.drivingStance ? [check.drivingStance] : []),
    ...(check.takedown ? [check.takedown] : []),
    ...(check.attackContext?.meleeTrick?.grantedQuality || check.attackDamageBenefit?.grantedQuality
      ? [{ earnedWeaponQualities: check.weaponQualities ?? "" }]
      : []),
    ...(check.attackContext?.meleeTrick ? [check.attackContext.meleeTrick] : []),
    ...(check.attackContext?.bullseye ? [check.attackContext.bullseye] : []),
    ...(check.attackDamageBenefit ? [check.attackDamageBenefit] : []),
    ...(check.attackContext?.meleeTradeoff ? [check.attackContext.meleeTradeoff] : []),
    ...(check.attackContext?.grippingStance ? [check.attackContext.grippingStance] : []),
    ...(check.stalkingStance ? [check.stalkingStance] : []),
    ...(check.sideStanceDamage ? [check.sideStanceDamage] : []),
    ...(check.attackContext?.sideStance ? [check.attackContext.sideStance] : []),
    ...(check.attackContext?.feintBonus ? [check.attackContext.feintBonus] : []),
    ...(check.attackContext?.combatStance ? [check.attackContext.combatStance] : []),
    ...(check.attackContext?.targetActorUuid ? [{ declaredAttackTarget: check.attackContext.targetActorUuid }] : []),
    ...(check.attackContext?.missTrickSources ? [check.attackContext.missTrickSources] : []),
    ...(check.cheapShotRecovery ? [check.cheapShotRecovery] : []),
    ...(check.attackContext?.cheapShot ? [check.attackContext.cheapShot] : []),
    ...(check.feint ? [check.feint] : []),
    ...(check.attackContext?.quirky ? [check.attackContext.quirky] : []),
    ...(check.attackContext?.superiorAccuracy ? [check.attackContext.superiorAccuracy] : []),
    ...(check.attackContext?.trainedOnly ? [check.attackContext.trainedOnly] : []),
    ...(check.attackContext?.accurized ? [check.attackContext.accurized] : []),
    ...(check.meleeSkillFeats ? [check.meleeSkillFeats] : []),
    ...(check.conveyanceBullRush ? [check.conveyanceBullRush] : []),
    ...(check.bullRushAttack ? [check.bullRushAttack] : []),
    ...(check.bullRushDefense ? [check.bullRushDefense] : []),
    ...(check.stillStandingSave ? [check.stillStandingSave] : []),
    ...(check.tumblePath ? [check.tumblePath] : []),
    ...(check.tripDefense ? [check.tripDefense] : []),
    ...(check.fallDistance ? [check.fallDistance] : []),
    ...(check.balanceSurface ? [check.balanceSurface] : []),
    ...(check.hideCircumstances ? [check.hideCircumstances] : []),
    ...(check.detectionObserver ? [check.detectionObserver] : []),
    ...(check.hideMovement ? [check.hideMovement] : []),
    ...(check.attributeDamage ? [check.attributeDamage] : []),
    ...(check.targetSkillEffect ? [check.targetSkillEffect] : []),
    ...(check.dispositionSkill ? [check.dispositionSkill] : []),
    ...(check.skillTiming ? [check.skillTiming] : []),
    ...(check.campaignSkillChecks ? [check.campaignSkillChecks] : []),
    ...(check.rankSynergyFeats ? [check.rankSynergyFeats] : []),
    ...(check.stoneCold ? [check.stoneCold] : []),
    ...(check.threaten ? [check.threaten] : []),
    ...(check.taunt ? [check.taunt] : []),
    ...(check.diversion ? [check.diversion] : []),
    ...(check.bugConcealment ? [check.bugConcealment] : []),
    ...(check.documentation ? [check.documentation] : []),
    ...(check.trackingFeat ? [check.trackingFeat] : []),
    ...(check.trackingMasteryTask ? [check.trackingMasteryTask] : []),
    ...(check.criticalActivation?.jinx ? [check.criticalActivation.jinx] : []),
    ...(check.terrainSaveSource ? [check.terrainSaveSource] : []),
    ...(check.oldSchool ? [check.oldSchool] : []),
    ...(check.analysisTask ? [check.analysisTask] : []),
    ...(check.forensicGenius ? [check.forensicGenius] : []),
    ...(check.closedCourseFeat ? [check.closedCourseFeat] : []),
    ...(check.wheelFeat ? [check.wheelFeat] : []),
    ...(check.requestBenefit ? [check.requestBenefit] : []),
    ...(check.rerollSource ? [check.rerollSource] : []),
    ...(check.practiceFeat ? [check.practiceFeat] : []),
    ...(check.fundedTaking ? [check.fundedTaking] : []),
    ...(check.skillGear?.toolShedKit ? [check.skillGear] : []),
    ...(check.gearAllowance ? [check.gearAllowance] : []),
    ...(check.gearCheckContext ? [check.gearCheckContext] : []),
    ...(check.improvisedSearch ? [check.improvisedSearch] : []),
    ...(check.terrainFeat ? [{ terrainFeat: check.terrainFeat, terrain: check.terrain }] : []),
    ...(check.pursuitFeat ? [check.pursuitFeat] : []),
    ...(check.professionalFeat ? [check.professionalFeat] : []),
    ...(check.contactFeat ? [check.contactFeat] : []),
    ...(check.polyglot ? [check.polyglot] : []),
    ...(check.photographicMemory ? [check.photographicMemory] : []),
    ...(check.charmer ? [check.charmer] : []),
    ...(check.cardSharkKnowledge ? [check.cardSharkKnowledge] : []),
    ...(check.cardSharkProfession ? [check.cardSharkProfession] : []),
    ...(check.appearanceModifiers ? [check.appearanceModifiers] : []),
    ...(check.hardCore ? [check.hardCore] : []),
    ...(check.attackContext?.characterTarget || Object.hasOwn(check.attackContext ?? {}, "cleaveThreatIncrease")
      ? [
          {
            characterTarget: check.attackContext?.characterTarget ?? null,
            cleaveThreatIncrease: check.attackContext?.cleaveThreatIncrease ?? null
          }
        ]
      : []),
    ...(check.finalAttackRound ? [check.finalAttackRound] : []),
    ...(check.finesseDamage ? [check.finesseDamage] : []),
    ...(Object.hasOwn(check.attackContext ?? {}, "finesseThreatIncrease")
      ? [
          {
            finesseBasic: check.attackContext.finesseBasic,
            massive: check.attackContext.massive,
            finesseThreatIncrease: check.attackContext.finesseThreatIncrease,
            ranged: check.attackContext.ranged
          }
        ]
      : []),
    ...(check.damageSave ? [check.damageSave] : []),
    ...(check.coverSave ? [check.coverSave] : []),
    ...(check.attackContext?.meleeFire ? [check.attackContext.meleeFire] : []),
    ...(check.cqbRange ? [check.cqbRange] : []),
    ...(check.attackContext?.cqbRange ? [check.attackContext.cqbRange] : []),
    ...(check.finalAttack ? [check.finalAttack] : []),
    ...(check.attackContext?.disarm ? [check.attackContext.disarm] : []),
    ...(check.twoWeaponFinalAttack ? [check.twoWeaponFinalAttack] : []),
    ...(check.shakenContext ? [check.shakenContext] : []),
    ...(check.restraintEscape ? [check.restraintEscape] : []),
    ...(check.weaponFocusWork ? [check.weaponFocusWork] : []),
    ...(check.sneakAttackTarget ? [check.sneakAttackTarget] : []),
    ...(check.sneakAttack ? [check.sneakAttack] : []),
    ...rollEvidenceFields(check)
  ]);
}
/** Legacy receipts did not include optional condition contexts. Omit only absent contexts, never changed evidence. */
export function rollEvidenceMatches(evidence, check) {
  if (evidence === rollEvidence(check)) return true;
  if (
    check.attackContext?.reach ||
    check.attackContext?.flanking?.whirling ||
    check.tripAttack ||
    check.meleeArmorPiercing ||
    check.drivingStance ||
    check.takedown ||
    check.sideStanceDamage ||
    check.attackContext?.sideStance ||
    check.attackContext?.feintBonus ||
    check.attackContext?.combatStance ||
    check.attackContext?.targetActorUuid ||
    check.attackContext?.missTrickSources ||
    check.cheapShotRecovery ||
    check.attackContext?.cheapShot ||
    check.feint ||
    check.attackContext?.quirky ||
    check.attackContext?.superiorAccuracy ||
    check.attackContext?.trainedOnly ||
    check.attackContext?.accurized ||
    check.meleeSkillFeats ||
    check.conveyanceBullRush ||
    check.bullRushAttack ||
    check.bullRushDefense ||
    check.stillStandingSave ||
    check.tumblePath ||
    check.tripDefense ||
    check.fallDistance ||
    check.balanceSurface ||
    check.hideCircumstances ||
    check.detectionObserver ||
    check.hideMovement ||
    check.attributeDamage ||
    check.targetSkillEffect ||
    check.dispositionSkill ||
    check.skillTiming ||
    check.campaignSkillChecks ||
    check.rankSynergyFeats ||
    check.stoneCold ||
    check.trackingFeat ||
    check.trackingMasteryTask ||
    check.criticalActivation?.jinx ||
    check.terrainSaveSource ||
    check.oldSchool ||
    check.threaten ||
    check.taunt ||
    check.diversion ||
    check.bugConcealment ||
    check.documentation ||
    check.analysisTask ||
    check.forensicGenius ||
    check.closedCourseFeat ||
    check.wheelFeat ||
    check.requestBenefit ||
    check.rerollSource ||
    check.practiceFeat ||
    check.fundedTaking ||
    check.skillGear?.toolShedKit ||
    check.gearAllowance ||
    check.gearCheckContext ||
    check.improvisedSearch ||
    check.terrainFeat ||
    check.pursuitFeat ||
    check.professionalFeat ||
    check.contactFeat ||
    check.polyglot ||
    check.photographicMemory ||
    check.charmer ||
    check.cardSharkKnowledge ||
    check.cardSharkProfession ||
    check.appearanceModifiers ||
    check.hardCore ||
    check.attackContext?.characterTarget ||
    Object.hasOwn(check.attackContext ?? {}, "cleaveThreatIncrease") ||
    check.finalAttackRound ||
    check.finesseDamage ||
    Object.hasOwn(check.attackContext ?? {}, "finesseThreatIncrease") ||
    check.damageSave ||
    check.coverSave ||
    check.attackContext?.meleeFire ||
    check.cqbRange ||
    check.attackContext?.cqbRange ||
    check.finalAttack ||
    check.attackContext?.disarm ||
    check.twoWeaponFinalAttack ||
    check.shakenContext ||
    check.weaponFocusWork ||
    check.sneakAttackTarget ||
    check.sneakAttack
  )
    return false;
  const base = rollEvidenceFields(check),
    variants = [[check.restraintEscape, ...base]];
  if (!check.restraintEscape) variants.push(base, [null, null, ...base]);
  return variants.some(fields => evidence === JSON.stringify(fields));
}
