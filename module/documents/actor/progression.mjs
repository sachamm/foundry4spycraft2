/** Career levels, vitality, granted feats and prerequisite checks. */
import { refuse, refuseStep } from "../../error-notices.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { rollCareerVitality, reviewCareerVitality } from "../../apps/vitality.mjs";
import { deferredSkillDeadline } from "../../rules/deferred-skills.mjs";
import { queueResources, isResourceLock } from "../../services/transactions.mjs";
import { featAcquisition, captureFeatAcquisition } from "../../rules/feat-acquisition.mjs";
import { checkPrerequisites, prerequisitesUseSkills } from "../../rules/prerequisites.mjs";
import { prerequisiteContext, computeAgent } from "../../rules/engine.mjs";
import { FEAT_PACK } from "./shared.mjs";
import { loc } from "../../i18n.mjs";
import { esc } from "../../html.mjs";
import { currentCampaignRules } from "../../rules/gc/campaign.mjs";
import { campaignVitalityDie, campaignCharacterEffects } from "../../rules/campaign-creation.mjs";
import { featPurchasePlan } from "../../rules/feat-purchase.mjs";
import { sameValues as same } from "../../rules/equal.mjs";
import { modularCreationPlan } from "../../rules/modular-creation.mjs";
import { advancementPlan } from "../../rules/advancement.mjs";
import { recordReplacementPatch } from "../../rules/record-patch.mjs";
import { retainedVitality, removedVitalityKey, removedVitalityRecord } from "../../rules/retained-vitality.mjs";
import {
  CREATION_ABILITIES,
  startingAttributeSignature,
  startingAttributeRecord
} from "../../rules/starting-attributes.mjs";
import {
  CREATION_QUALITIES,
  creationEffectsForQualities,
  creationPolicyRecord,
  creationRole,
  characterCampaignPolicy
} from "../../rules/creation-policy.mjs";

export const ActorProgression = Base =>
  class ActorProgression extends Base {
    async reviewAdvancement(options = {}) {
      if (this.type !== "agent" || !this.isOwner || !game.user?.isGM)
        throw new Error(loc`The owning GC reviews level advancement history and grants.`);
      const current = () => this.flags?.spycraft2?.advancementReview ?? null;
      const previous = structuredClone(current());
      const level = this.system.progression.length;
      const mission = String(game.settings?.get("spycraft2", "usagePeriods")?.mission ?? "initial");
      let input = options;
      if (!input.mode) {
        input = await systemDialog.input({
          window: { title: loc`Review level advancement` },
          rejectClose: false,
          ok: { label: loc`Record level review` },
          content: `<div class="spycraft2-roll-options"><p>${loc`Review the level this character had when the last mission began, or explicitly approve a starting level or special level grant. This records permission for this mission period and changes no levels or XP.`}</p><label>${loc`Review type`} <select name="mode"><option value="history">${loc`Original level at the last mission's start`}</option><option value="grant">${loc`Starting level or GC level grant`}</option></select></label><label>${loc`Original career level`} <input name="baseline" type="number" min="0" max="${level}" value="${level}" step="1" /></label><label>${loc`Approved career level ceiling`} <input name="ceiling" type="number" min="${level}" max="20" value="${Math.min(20, level + 1)}" step="1" /></label><label>${loc`Source or ruling note`} <input name="note" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms the history or this explicit level grant`}</label></div>`
        });
        if (!input) return null;
        for (const field of ["baseline", "ceiling"])
          input[field] = String(input[field] ?? "").trim() ? Number(input[field]) : NaN;
      }
      return queueResources([this], async () => {
        if (
          !this.isOwner ||
          !game.user?.isGM ||
          !same(current(), previous) ||
          this.system.progression.length !== level ||
          String(game.settings?.get("spycraft2", "usagePeriods")?.mission ?? "initial") !== mission
        )
          throw new Error(
            loc`The character's levels, mission period or prior review changed. Review the current history again.`
          );
        const value = input.mode === "history" ? input.baseline : input.ceiling;
        if (
          !["history", "grant"].includes(input.mode) ||
          input.confirmed !== true ||
          typeof input.note !== "string" ||
          !input.note.trim() ||
          !Number.isSafeInteger(value) ||
          value < 0 ||
          value > 20 ||
          (input.mode === "history" ? value > level : value < level)
        )
          throw new Error(loc`Confirm a valid original level or approved ceiling and record the source or ruling.`);
        const record = {
          version: 1,
          mission,
          mode: input.mode,
          ...(input.mode === "history" ? { baseline: value } : { ceiling: value }),
          confirmed: true,
          note: input.note.trim(),
          at: Date.now(),
          reviewedBy: game.user.id ?? "GC"
        };
        try {
          await this.update(recordReplacementPatch("flags.spycraft2.advancementReview", record, current()));
        } catch (error) {
          if (!same(current(), record)) throw error;
        }
        return record;
      });
    }

    async configureModularCreation(options = {}) {
      if (this.type !== "agent" || !this.isOwner || this.system.companionOf?.ownerUuid) return null;
      const context = () => ({
        system: this.system.toObject?.() ?? structuredClone(this.system),
        items: this.items
          .filter(i => !isResourceLock(i))
          .map(i => ({
            id: i.id,
            name: i.name,
            type: i.type,
            system: i.system.toObject?.() ?? structuredClone(i.system)
          })),
        effects: currentCampaignRules().effects,
        policy: this.flags?.spycraft2?.creationPolicy ?? null,
        trade: this.flags?.spycraft2?.modularTrade ?? null,
        mission: game.settings?.get("spycraft2", "mission") ?? {},
        period: String(this.usagePeriods?.mission ?? "initial")
      });
      const expected = context();
      const allowed = () =>
        this.isOwner &&
        !this.system.companionOf?.ownerUuid &&
        (game.user?.isGM ||
          (this.system.level <= 1 &&
            String(this.usagePeriods?.mission ?? "initial") === "initial" &&
            !game.settings?.get("spycraft2", "mission")?.active));
      if (!allowed()) throw new Error(loc`Only the GC can revise Modular trades after character creation.`);
      const prepare = context =>
        computeAgent(structuredClone(context.system), context.items, CONFIG.SPYCRAFT, {
          campaignEffects: context.effects,
          creationPolicy: context.policy,
          modularTrade: null,
          creationAttributes: this.flags?.spycraft2?.creationAttributes,
          featPurchases: this.flags?.spycraft2?.featPurchases
        });
      const prepared = prepare(expected);
      const signature = (context, prepared) => ({
        level: context.system.progression?.length ?? context.system.level,
        companionOf: context.system.companionOf ?? null,
        effects: context.effects,
        policy: context.policy,
        trade: context.trade,
        mission: context.mission,
        period: context.period,
        available: prepared.modularCreation?.available,
        budget: prepared.modularCreation?.originalBudget
      });
      const expectedSignature = signature(expected, prepared);
      if (!prepared.campaignEffects.modularCreation)
        throw new Error(loc`Modular must be part of this character's original creation rules.`);
      const available = prepared.modularCreation.available,
        budget = prepared.modularCreation.originalBudget;
      let input = options;
      if (input.bought === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Modular creation trade` },
          rejectClose: false,
          ok: { label: loc`Record creation trade` },
          content: `<div class="spycraft2-roll-options"><p>${loc`Each additional feat costs 2 attribute points. Alternatively, each surrendered creation feat choice adds 2 attribute points. Named granted feats and later-level choices cannot be surrendered.`}</p><label>${loc`Additional feats`} <input name="bought" type="number" min="0" max="${Math.floor(budget / 2)}" step="1" value="${Number(expected.trade?.bought ?? 0)}" /></label>${Object.entries(
            available
          )
            .filter(([, count]) => count > 0)
            .map(
              ([tree, count]) =>
                `<label>${esc(tree === "any" ? loc`Any feat choices surrendered` : loc`${CONFIG.SPYCRAFT.featTrees[tree]} choices surrendered`)} <input name="surrender-${tree}" type="number" min="0" max="${count}" step="1" value="${Number(expected.trade?.surrendered?.[tree] ?? 0)}" /></label>`
            )
            .join(
              ""
            )}<label>${loc`Source or review note`} <input name="note" required /></label><label><input type="checkbox" name="confirmed" /> ${loc`Confirm this original creation trade and review the resulting attribute and feat budgets`}</label></div>`
        });
        if (!input) return null;
        input.bought = String(input.bought ?? "").trim() ? Number(input.bought) : NaN;
        input.surrendered = Object.fromEntries(
          Object.keys(available).map(tree => [tree, Number(input[`surrender-${tree}`] ?? 0)])
        );
      }
      return queueResources([this], async () => {
        const current = context();
        if (!allowed() || !same(signature(current, prepare(current)), expectedSignature))
          throw new Error(loc`The character, campaign or trade changed. Review the current creation trade again.`);
        const record = {
          version: 1,
          bought: input.bought,
          surrendered: input.surrendered,
          confirmed: input.confirmed,
          note: typeof input.note === "string" ? input.note.trim() : "",
          at: Date.now(),
          reviewedBy: game.user.id ?? "creator"
        };
        const plan = modularCreationPlan(record, available, budget, true);
        if (!plan.valid) throw new Error(plan.warnings.join(" "));
        try {
          await this.update(
            recordReplacementPatch("flags.spycraft2.modularTrade", record, this.flags?.spycraft2?.modularTrade)
          );
        } catch (error) {
          if (!same(this.flags?.spycraft2?.modularTrade, record)) throw error;
        }
        return record;
      });
    }

    async reviewCreationPolicy(options = {}) {
      if (!["agent", "npc"].includes(this.type) || !this.isOwner) return null;
      if (!game.user?.isGM) throw new Error(loc`The GC reviews original campaign creation rules.`);
      const current = () => this.flags?.spycraft2?.creationPolicy ?? null;
      const previous = structuredClone(current());
      let input = options;
      if (!Array.isArray(input.qualityIds)) {
        input = await systemDialog.input({
          window: { title: loc`Review original creation rules` },
          rejectClose: false,
          ok: { label: loc`Record creation rules` },
          content: `<div class="spycraft2-roll-options"><p>${loc`Select the qualities and character type that applied at creation. Creation allowances follow this record across seasons. Current campaign rules govern advancement and play.`}</p>${CREATION_QUALITIES.map(q => `<label><input type="checkbox" name="quality-${q.id}"${previous?.qualityIds?.includes(q.id) ? " checked" : ""} /> ${esc(q.name)}</label>`).join("")}<label>${loc`Character type at creation`} <select name="role">${[
            ["pc", loc`Player character`],
            ["special", loc`Special NPC`],
            ["standard", loc`Standard NPC`]
          ]
            .map(
              ([value, label]) =>
                `<option value="${value}"${(previous?.role ?? creationRole(this.type, this.system)) === value ? " selected" : ""}>${label}</option>`
            )
            .join(
              ""
            )}</select></label><label>${loc`Source or review note`} <input name="note" required /></label><label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms the character's original creation rules`}</label></div>`
        });
        if (!input) return null;
        input.qualityIds = CREATION_QUALITIES.filter(q => input[`quality-${q.id}`] === true).map(q => q.id);
      }
      return queueResources([this], async () => {
        if (!game.user?.isGM || !this.isOwner || !same(current(), previous))
          throw new Error(loc`The creation-rule review or permissions changed. Review the current record again.`);
        const record = creationPolicyRecord(creationEffectsForQualities(input.qualityIds), {
          ...input,
          role: input.role ?? creationRole(this.type, this.system),
          at: Date.now(),
          reviewedBy: game.user.id ?? "GC"
        });
        try {
          await this.update(recordReplacementPatch("flags.spycraft2.creationPolicy", record, current()));
        } catch (error) {
          if (!same(current(), record)) throw error;
        }
        return record;
      });
    }

    async reviewStartingAttributes(options = {}) {
      if (!["agent", "npc"].includes(this.type) || !this.isOwner) return null;
      if (!game.user?.isGM) throw new Error(loc`The GC reviews original starting attribute scores.`);
      const currentCap = () =>
        characterCampaignPolicy(this.system, currentCampaignRules().effects, this.flags?.spycraft2?.creationPolicy)
          .effects.startingAttributeCap;
      const cap = currentCap();
      if (!cap) throw new Error(loc`No campaign starting-attribute cap is active.`);
      const items = () => [...this.items];
      const current = () => this.flags?.spycraft2?.creationAttributes ?? null;
      const previous = structuredClone(current());
      const expected = startingAttributeSignature(this.system, items());
      let input = options;
      if (!input.scores) {
        const values =
          this.system.startingAttributeReview?.scores ??
          previous?.scores ??
          Object.fromEntries(CREATION_ABILITIES.map(k => [k, this.system.abilities[k].value]));
        const historical =
          this.system.level === 1
            ? `<label><input type="checkbox" name="alreadyInPlay" /> ${loc`This Career Level 1 character is already in play; these are reconstructed original scores`}</label>`
            : "";
        input = await systemDialog.input({
          window: { title: loc`Review starting attribute scores` },
          rejectClose: false,
          ok: { label: loc`Record starting scores` },
          content: `<div class="spycraft2-roll-options"><p>${loc`Record the original scores including Origin benefits, before later increases, damage or temporary effects. This review changes no current attribute or health value.`}</p>${CREATION_ABILITIES.map(k => `<label>${loc`${k.toUpperCase()} starting score`} <input type="number" name="${k}" min="1" max="${cap}" step="1" value="${Number(values[k])}" required /></label>`).join("")}${historical}<label>${loc`Source or review note`} <input name="note" required /></label><label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms these original starting scores`}</label></div>`
        });
        if (!input) return null;
        input.scores = Object.fromEntries(
          CREATION_ABILITIES.map(k => [k, String(input[k] ?? "").trim() === "" ? NaN : Number(input[k])])
        );
      }
      return queueResources([this], async () => {
        if (!game.user?.isGM || !this.isOwner)
          throw new Error(loc`The GC must own the character to record starting scores.`);
        if (
          startingAttributeSignature(this.system, items()) !== expected ||
          !same(current(), previous) ||
          currentCap() !== cap
        )
          throw new Error(
            loc`The character's creation choices, prior review or campaign cap changed. Review the current data again.`
          );
        const record = startingAttributeRecord(this.system, items(), {
          ...input,
          cap,
          reviewedBy: game.user.id ?? "GC",
          at: Date.now()
        });
        try {
          await this.update(recordReplacementPatch("flags.spycraft2.creationAttributes", record, current()));
        } catch (error) {
          if (!same(current(), record)) throw error;
        }
        return record;
      });
    }
    /** One permanent extra choice bought from post-mission XP; the existing Feats workflow selects it. */
    async purchaseFeatChoice(options = {}) {
      if (this.type !== "agent" || !this.isOwner || this.system.companionOf?.ownerUuid) return null;
      const context = () => ({
        mission: String(this.usagePeriods.mission ?? "initial"),
        missionActive: game.settings?.get("spycraft2", "mission")?.active === true,
        level: this.system.level,
        xp: this.system.xp,
        effects: currentCampaignRules().effects,
        receipts: this.flags?.spycraft2?.featPurchases ?? {},
        xpReview: this.flags?.spycraft2?.missionXPReview?.needsReview === true
      });
      const expected = structuredClone(context());
      if (expected.xpReview) throw new Error(loc`Review interrupted mission XP before purchasing a feat choice.`);
      const quote = featPurchasePlan(this.system, expected.receipts, CONFIG.SPYCRAFT, {
        ...expected,
        missionCompleteConfirmed: true
      });
      let input = options;
      if (input.missionCompleteConfirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Purchase a feat choice` },
          rejectClose: false,
          ok: { label: loc`Spend XP and gain choice` },
          content: `<div class="spycraft2-roll-options"><p>${loc`Cost: ${quote.record.cost} XP. XP: ${quote.record.beforeXP} → ${quote.record.afterXP}. Required minimum: ${quote.record.minimumXP}.`}</p><p>${loc`One additional permanent feat choice, once for this mission. Choose a qualifying feat on the Feats tab after purchasing. Normal prerequisites and acquisition timing still apply.`}</p><label><input type="checkbox" name="missionCompleteConfirmed" /> ${loc`The GC confirms this mission has ended and its XP settlement is complete`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        if (!same(context(), expected))
          throw new Error(loc`Mission, XP, level or campaign rules changed. Review the feat purchase again.`);
        const plan = featPurchasePlan(this.system, expected.receipts, CONFIG.SPYCRAFT, {
          ...expected,
          missionCompleteConfirmed: input.missionCompleteConfirmed === true,
          at: Date.now()
        });
        const path = `flags.spycraft2.featPurchases.${plan.key}`;
        try {
          await this.update({ "system.xp": plan.record.afterXP, [path]: plan.record });
        } catch (error) {
          if (
            this.system.xp !== plan.record.afterXP ||
            !same(this.flags?.spycraft2?.featPurchases?.[plan.key], plan.record)
          )
            throw error;
        }
        return plan.record;
      });
    }
    /**
     * Add a career level in a class. Creates the class item on the actor if needed.
     * @param {Item|object} classData  a class Item (world/compendium/embedded) or its data
     */
    async addClassLevel(classData, { promptVitality = true } = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let level;
      const cls = await queueResources([this], async () => {
        const before = this.system.progression.length,
          result = await this._addClassLevel(classData);
        if (this.system.progression.length > before) level = this.system.progression.length;
        return result;
      });
      if (
        level &&
        promptVitality &&
        level > 1 &&
        !this.system.progression[level - 1].vitality &&
        !this.system.progression[level - 1].vitalityHistoryId &&
        cls?.system.vitalityDie &&
        campaignVitalityDie(cls.system.vitalityDie, currentCampaignRules().effects) === null
      ) {
        const roll = await systemDialog.confirm({
          window: { title: game.i18n.localize("SPYCRAFT.VitalityRoll") },
          content: `<p>${game.i18n.format("SPYCRAFT.VitalityPrompt", { level, name: esc(cls.name), die: esc(cls.system.vitalityDie) })}</p>`
        });
        if (roll) await this.rollVitality(level - 1);
      }
      return cls;
    }

    async _addClassLevel(classData) {
      if (this.type !== "agent") return;
      const sys = this.system;
      if (sys.skillPurchaseIssues?.length)
        return refuseStep(
          loc`Repair invalid skill-purchase history before gaining a level: ${sys.skillPurchaseIssues.map(issue => issue.message).join("; ")}`
        );
      const deferred = deferredSkillDeadline(sys, [...this.items]);
      if (deferred.length)
        return refuseStep(
          loc`Spend all deferred skill points before gaining another level (I Can Swim, p.200): ${deferred.join("; ")}.`
        );
      if (sys.progression.length >= 20) return refuseStep(game.i18n.localize("SPYCRAFT.Class.MaxLevel"));
      const advancementContext = () => ({
        actorUuid: this.uuid,
        periods: game.settings?.get("spycraft2", "usagePeriods") ?? {},
        missionActive: game.settings?.get("spycraft2", "mission")?.active === true,
        effects: currentCampaignRules().effects,
        review: this.flags?.spycraft2?.advancementReview
      });
      const advancement = advancementPlan(sys, CONFIG.SPYCRAFT, advancementContext());
      if (!advancement.allowed) return refuseStep(advancement.reason);
      const ident = classData.system?.identifier || classData.name;
      let cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === ident);
      const definition = cls?.system ?? classData.system;
      // A class has as many levels as its table: 10 for an expert class, 20 for a base class (pp.26, 64).
      const classMax = definition.table?.length || (definition.expert ? 10 : 20);
      if ((sys.classLevels?.[ident] ?? 0) >= classMax)
        return refuseStep(loc`${classData.name} has only ${classMax} levels; choose another class.`);
      const firstExpertLevel = definition.expert && !sys.classLevels?.[ident];
      if (firstExpertLevel && sys.level < 4)
        return refuseStep(game.i18n.format("SPYCRAFT.Class.ExpertTooEarly", { name: classData.name }));
      const expertEntry =
        firstExpertLevel && definition.requirements
          ? this.checkPrerequisites(definition.requirements, { classEntry: true })
          : null;
      if (expertEntry && !expertEntry.ok)
        return refuseStep(loc`Expert-class entry requirements are not met: ${expertEntry.unmet.join("; ")}.`);
      const retained = retainedVitality(
        this.flags?.spycraft2?.removedLevelVitality,
        sys.progression.length + 1,
        ident,
        definition.vitalityDie
      );
      if (!cls) {
        const data = classData.toObject?.() ?? foundry.utils.deepClone(classData);
        delete data._id;
        [cls] = await this.createEmbeddedDocuments("Item", [data]);
      }
      const progression = [
        ...sys.progression.map(p => ({ ...p })),
        { classId: ident, careerEntryId: foundry.utils.randomID(), vitality: 0, skills: {}, expertEntry }
      ];
      if (retained)
        Object.assign(progression.at(-1), retained, {
          careerEntryId: retained.careerEntryId || progression.at(-1).careerEntryId
        });
      const preview = this.system.toObject?.() ?? foundry.utils.deepClone(this.system);
      Object.assign(preview, this.attributeRuleContext);
      preview.progression = progression;
      computeAgent(
        preview,
        this.items.map(item => ({ id: item.id, name: item.name, type: item.type, system: item.system })),
        CONFIG.SPYCRAFT,
        {
          campaignEffects: currentCampaignRules().effects,
          featPurchases: this.flags?.spycraft2?.featPurchases,
          creationAttributes: this.flags?.spycraft2?.creationAttributes,
          creationPolicy: this.flags?.spycraft2?.creationPolicy,
          modularTrade: this.flags?.spycraft2?.modularTrade
        }
      );
      progression.at(-1).intelligenceModifier =
        retained?.intelligenceModifier ??
        Math.floor(
          (preview.abilities.int.value -
            (preview.abilities.int.misc ?? 0) -
            (preview.abilities.int.temporaryBonus ?? 0) -
            10) /
            2
        );
      const freshAdvancement = advancementPlan(this.system, CONFIG.SPYCRAFT, advancementContext());
      if (!same(advancement, freshAdvancement))
        return refuseStep(loc`The mission, XP or advancement permission changed. Review the level again.`);
      await this.update({ "system.progression": progression });
      await this.syncGrantedFeats();
      for (const feat of this.items.filter(
        item =>
          item.type === "feat" &&
          !item.system.granted &&
          !item.system.acquisitionCheck &&
          (item.system.acquiredAtLevel || 1) === progression.length
      ))
        await feat.update({ "system.acquisitionCheck": captureFeatAcquisition(this, feat.system, feat.id) });
      return cls;
    }

    /**
     * Roll the class vitality die for one career level and store the result.
     * @param {number} index  zero-based index into the level progression (level 1 is always the maximum)
     */
    rollVitality(index) {
      return rollCareerVitality(this, index);
    }

    reviewVitality(index, options = {}) {
      return reviewCareerVitality(this, index, options);
    }

    /** Remove the most recent career level. Deletes the class item when no levels remain. */
    async removeLastLevel() {
      if (this.type !== "agent" || !this.isOwner) return null;
      return queueResources([this], () => this._removeLastLevel());
    }

    async _removeLastLevel() {
      const progression = [...this.system.progression];
      const last = progression.pop();
      if (!last) return;
      const cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === last.classId);
      const evidence =
        this.flags?.spycraft2?.vitalityReviews?.[last.vitalityReviewId] ??
        this.flags?.spycraft2?.vitalityRolls?.[last.vitalityRollId];
      const held = !last.vitality && last.vitalityHistoryId;
      if (!held && evidence && evidence.value !== last.vitality)
        throw Error(
          loc`Review vitality that disagrees with its original roll or correction before removing this level.`
        );
      const record = held
        ? null
        : removedVitalityRecord(
            { ...last, classId: evidence?.classId ?? last.classId },
            progression.length + 1,
            evidence?.die ?? cls?.system.vitalityDie,
            foundry.utils.randomID(),
            Date.now()
          );
      const key = record && removedVitalityKey(record.careerLevel, record.classId, record.die);
      try {
        await this.update({
          "system.progression": progression,
          ...(record
            ? recordReplacementPatch(
                `flags.spycraft2.removedLevelVitality.${key}`,
                record,
                this.flags?.spycraft2?.removedLevelVitality?.[key]
              )
            : {})
        });
      } catch (error) {
        if (
          !same(this.system.progression, progression) ||
          (record && !same(this.flags?.spycraft2?.removedLevelVitality?.[key], record))
        )
          throw error;
      }
      if (!progression.some(p => p.classId === last.classId)) {
        if (cls) await cls.delete();
      }
      await this.syncGrantedFeats();
    }

    async initializeStartingResources({ keepCurrent = false } = {}) {
      if (!this.isOwner || this.type !== "agent") return null;
      if (this.system.resourcesInitialized)
        return refuse(loc`Starting resources have already been initialized; current earnings are preserved.`);
      if (keepCurrent) return this.update({ "system.resourcesInitialized": true });
      if (![0, 2].includes(this.system.reputation) || ![0, 100000].includes(this.system.netWorth))
        return refuse(loc`These values contain existing earnings. Use 'Keep current resources' to preserve them.`);
      const freelance = this.system.affiliationType === "freelance";
      return this.update({
        "system.reputation": freelance ? 0 : 2,
        "system.netWorth": freelance ? 100000 : 0,
        "system.resourcesInitialized": true
      });
    }

    /** Feat names currently granted by origins and class levels → source label. */
    requiredGrants() {
      const out = new Map();
      for (const i of this.items) {
        if (i.type === "origin") for (const f of i.system.grants ?? []) out.set(f, i.name);
        if (i.type === "class") {
          const lvl = this.system.classLevels?.[i.system.identifier || i.name] ?? 0;
          for (const g of i.system.featGrants ?? []) if (g.level <= lvl) out.set(g.feat, `${i.name} ${g.level}`);
        }
      }
      return out;
    }

    /** Create/remove "granted" feat items so they match origins & class levels (calls are serialized). */
    syncGrantedFeats() {
      if (this.type !== "agent" || !this.isOwner) return Promise.resolve();
      this._grantSync = (this._grantSync ?? Promise.resolve())
        .then(() => this.#syncGrantedFeats())
        .catch(err => console.error(err));
      return this._grantSync;
    }

    /** Specific grants, including the chosen Basic Skill feat for mastery grants. */
    requiredGrantSpecs() {
      const specs = new Map();
      const add = spec => {
        const key = `${spec.name.trim().toLowerCase()}|${(spec.choice ?? "").trim().toLowerCase()}`;
        if (!specs.has(key) || spec.level < specs.get(key).level) specs.set(key, spec);
      };
      for (const item of this.items) {
        if (item.type === "origin")
          for (const name of item.system.grants ?? []) add({ name, source: item.name, level: 1 });
        if (item.type !== "class") continue;
        const id = item.system.identifier || item.name;
        for (const grant of item.system.featGrants ?? []) {
          let count = 0;
          for (const [index, entry] of this.system.progression.entries()) {
            if (entry.classId !== id) continue;
            if (++count < grant.level) continue;
            add({
              name: grant.feat,
              choice: grant.choice ?? "",
              source: `${item.name} ${grant.level}`,
              level: index + 1
            });
            break;
          }
        }
      }
      for (const grant of this.system.inheritedFeatureGrants ?? []) add(grant);
      return [...specs.values()];
    }

    async #syncGrantedFeats() {
      const required = this.requiredGrantSpecs();
      const norm = s =>
        String(s ?? "")
          .trim()
          .toLowerCase();
      const feats = this.items.filter(i => i.type === "feat");
      const kept = new Set(),
        toCreate = [],
        toUpdate = [];
      const missing = [];
      for (const spec of required) {
        const copies = feats.filter(
          f =>
            norm(f.name) === norm(spec.name) &&
            f.system.featKind !== "temporary" &&
            (!spec.choice || norm(f.system.choice) === norm(spec.choice))
        );
        const existing = copies.find(f => !f.system.granted) ?? copies[0];
        if (!existing) {
          missing.push(spec);
          continue;
        }
        kept.add(existing.id);
        if (existing.system.granted) {
          const update = { _id: existing.id };
          if (existing.system.acquiredAtLevel !== spec.level) update["system.acquiredAtLevel"] = spec.level;
          if (existing.system.grantSource !== spec.source) update["system.grantSource"] = spec.source;
          if (Object.keys(update).length > 1) toUpdate.push(update);
        }
      }
      if (missing.length) {
        const pack = game.packs.get(FEAT_PACK);
        const index = pack ? await pack.getIndex() : [];
        for (const spec of missing) {
          const entry = index.find?.(e => norm(e.name) === norm(spec.name));
          let data;
          if (entry) {
            const doc = await pack.getDocument(entry._id);
            data = doc.toObject();
            delete data._id;
          } else data = { name: spec.name, type: "feat", system: {} };
          Object.assign(data.system, { granted: true, grantSource: spec.source, acquiredAtLevel: spec.level });
          if (spec.choice) data.system.choice = spec.choice;
          toCreate.push(data);
        }
      }
      const toDelete = feats
        .filter(f => f.system.granted && f.system.featKind !== "temporary" && !kept.has(f.id))
        .map(f => f.id);
      if (toDelete.length) await this.deleteEmbeddedDocuments("Item", toDelete);
      if (toUpdate.length) await this.updateEmbeddedDocuments("Item", toUpdate);
      if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
    }

    /** Prerequisite check for an arbitrary feat/class document against this actor. */
    checkPrerequisites(
      tree,
      {
        classEntry = false,
        temporary = false,
        acquisitionSource = "",
        featTree = "",
        manualConfirmed = false,
        excludeFeatId = null
      } = {}
    ) {
      // Temporary feats only qualify temporary feats; virtual feats cannot qualify classes.
      const feats = this.items.filter(
        i =>
          i.type === "feat" &&
          i.id !== excludeFeatId &&
          (temporary || i.system.featKind !== "temporary") &&
          (!classEntry || i.system.featKind !== "virtual") &&
          ((i.system.granted && i.system.featKind !== "temporary") || this.system.featStatus?.[i.id]?.ok !== false)
      );
      const virtual = classEntry ? [] : (this.system.virtualFeats ?? []);
      const featNames = new Set([
        ...feats.map(i => i.name.trim().toLowerCase()),
        ...virtual.map(f => f.name.trim().toLowerCase())
      ]);
      const featTrees = {};
      for (const f of feats) featTrees[f.system.tree] = (featTrees[f.system.tree] ?? 0) + 1;
      for (const f of virtual) featTrees[f.tree] = (featTrees[f.tree] ?? 0) + 1;
      const skillRanks = Object.fromEntries(
        Object.entries(this.system.skillTotals ?? {}).map(([k, v]) => [k, v.ranks])
      );
      let contextSystem = this.system;
      const rebuild =
        classEntry ||
        (!temporary && this.items.some(item => item.type === "feat" && item.system.featKind === "temporary")) ||
        (excludeFeatId && this.items.some(item => item.id === excludeFeatId));
      if (rebuild) {
        contextSystem = this.system.toObject?.() ?? foundry.utils.deepClone(this.system);
        contextSystem.usagePeriods = this.usagePeriods;
        Object.assign(contextSystem, this.attributeRuleContext);
        computeAgent(
          contextSystem,
          this.items
            .filter(
              item =>
                item.id !== excludeFeatId &&
                (item.type !== "feat" ||
                  ((temporary || item.system.featKind !== "temporary") &&
                    (!classEntry || item.system.featKind !== "virtual")))
            )
            .map(item => ({ id: item.id, name: item.name, type: item.type, system: item.system })),
          CONFIG.SPYCRAFT,
          {
            campaignEffects: currentCampaignRules().effects,
            featPurchases: this.flags?.spycraft2?.featPurchases,
            creationAttributes: this.flags?.spycraft2?.creationAttributes,
            creationPolicy: this.flags?.spycraft2?.creationPolicy,
            modularTrade: this.flags?.spycraft2?.modularTrade
          }
        );
        featNames.clear();
        for (const key of Object.keys(featTrees)) delete featTrees[key];
        for (const feat of feats.filter(
          feat =>
            (feat.system.granted && feat.system.featKind !== "temporary") || contextSystem.featStatus?.[feat.id]?.ok
        )) {
          featNames.add(feat.name.trim().toLowerCase());
          featTrees[feat.system.tree] = (featTrees[feat.system.tree] ?? 0) + 1;
        }
        for (const feat of classEntry ? [] : (contextSystem.virtualFeats ?? [])) {
          featNames.add(feat.name.trim().toLowerCase());
          featTrees[feat.tree] = (featTrees[feat.tree] ?? 0) + 1;
        }
      }
      // A broken skill history only matters to prerequisites that read skill ranks.
      if (contextSystem.skillPurchaseIssues?.length && prerequisitesUseSkills(tree))
        return {
          ok: false,
          unmet: contextSystem.skillPurchaseIssues.map(issue => `Repair skill history: ${issue.message}`)
        };
      const ctx = prerequisiteContext(
        contextSystem,
        featNames,
        featTrees,
        rebuild
          ? Object.fromEntries(
              Object.entries(contextSystem.skillTotals ?? {}).map(([key, skill]) => [key, skill.ranks])
            )
          : skillRanks,
        {
          featTree: classEntry ? "" : featTree,
          featChoices: feats.filter(
            f =>
              !rebuild ||
              (f.system.granted && f.system.featKind !== "temporary") ||
              contextSystem.featStatus?.[f.id]?.ok
          )
        }
      );
      if (acquisitionSource && !classEntry) {
        const acquisition = featAcquisition(
          {
            id: excludeFeatId ?? "__preview__",
            type: "feat",
            system: { acquisitionSource, tree: featTree, acquiredAtLevel: this.system.level }
          },
          this.system.featAcquisitionSources ?? [],
          this.items.filter(() => true),
          { preview: true, campaignEffects: campaignCharacterEffects(this.system, currentCampaignRules().effects) }
        );
        if (!acquisition.ok) return { ok: false, unmet: [acquisition.reason] };
        ctx.prerequisiteLevel = acquisition.effectiveLevel;
        ctx.acquisitionLevel = this.system.level;
      }
      ctx.manualConfirmed = manualConfirmed;
      return checkPrerequisites(tree, ctx);
    }
  };
