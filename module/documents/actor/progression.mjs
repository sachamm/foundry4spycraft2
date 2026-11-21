/** Career levels, vitality, granted feats and prerequisite checks. */
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { rollCareerVitality, reviewCareerVitality } from "../../apps/vitality.mjs";
import { deferredSkillDeadline } from "../../rules/deferred-skills.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { featAcquisition, captureFeatAcquisition } from "../../rules/feat-acquisition.mjs";
import { checkPrerequisites } from "../../rules/prerequisites.mjs";
import { prerequisiteContext, computeAgent } from "../../rules/engine.mjs";
import { FEAT_PACK } from "./shared.mjs";
import { loc } from "../../i18n.mjs";
import { esc } from "../../html.mjs";

export const ActorProgression = Base =>
  class ActorProgression extends Base {
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
      if (level && promptVitality && level > 1 && cls?.system.vitalityDie) {
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
        return ui.notifications.warn(
          loc`Repair invalid skill-purchase history before gaining a level: ${sys.skillPurchaseIssues.map(issue => issue.message).join("; ")}`
        );
      const deferred = deferredSkillDeadline(sys, [...this.items]);
      if (deferred.length)
        return ui.notifications.warn(
          loc`Spend all deferred skill points before gaining another level (I Can Swim, p.200): ${deferred.join("; ")}.`
        );
      if (sys.progression.length >= 20) return ui.notifications.warn(game.i18n.localize("SPYCRAFT.Class.MaxLevel"));
      const ident = classData.system?.identifier || classData.name;
      let cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === ident);
      const definition = cls?.system ?? classData.system;
      const firstExpertLevel = definition.expert && !sys.classLevels?.[ident];
      if (firstExpertLevel && sys.level < 4)
        return ui.notifications.warn(game.i18n.format("SPYCRAFT.Class.ExpertTooEarly", { name: classData.name }));
      const expertEntry =
        firstExpertLevel && definition.requirements
          ? this.checkPrerequisites(definition.requirements, { classEntry: true })
          : null;
      if (expertEntry && !expertEntry.ok)
        return ui.notifications.warn(
          loc`Expert-class entry requirements are not met: ${expertEntry.unmet.join("; ")}.`
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
      const preview = this.system.toObject?.() ?? foundry.utils.deepClone(this.system);
      Object.assign(preview, this.attributeRuleContext);
      preview.progression = progression;
      computeAgent(
        preview,
        this.items.map(item => ({ id: item.id, name: item.name, type: item.type, system: item.system })),
        CONFIG.SPYCRAFT
      );
      progression.at(-1).intelligenceModifier = Math.floor(
        (preview.abilities.int.value -
          (preview.abilities.int.misc ?? 0) -
          (preview.abilities.int.temporaryBonus ?? 0) -
          10) /
          2
      );
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
      await this.update({ "system.progression": progression });
      if (!progression.some(p => p.classId === last.classId)) {
        const cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === last.classId);
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
          CONFIG.SPYCRAFT
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
      if (contextSystem.skillPurchaseIssues?.length)
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
          { preview: true }
        );
        if (!acquisition.ok) return { ok: false, unmet: [acquisition.reason] };
        ctx.prerequisiteLevel = acquisition.effectiveLevel;
        ctx.acquisitionLevel = this.system.level;
      }
      ctx.manualConfirmed = manualConfirmed;
      return checkPrerequisites(tree, ctx);
    }
  };
