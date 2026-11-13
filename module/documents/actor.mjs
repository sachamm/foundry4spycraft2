import { resolveSkillResult, damageAddsStrength, strengthDamageFormula } from "../rules/checks.mjs";
import { grantAcquisitionLevel } from "../rules/progression.mjs";
import { checkPrerequisites } from "../rules/prerequisites.mjs";
import { prerequisiteContext } from "../rules/engine.mjs";

const FEAT_PACK = "spycraft2.feats";

export class SpycraftActor extends Actor {
  /** @override */
  getRollData() {
    return this.system.getRollData?.() ?? { ...super.getRollData() };
  }

  /* -------------------------------------------- */
  /*  Rolls                                        */
  /* -------------------------------------------- */

  /**
   * Roll a d20 check and post it to chat with threat/error annotations.
   * @param {string} formula   e.g. "1d20 + @mod"
   * @param {object} data
   * @param {object} opts      { flavor, threat=20, error=1, cap }
   */
  async rollCheck(formula, data, { flavor = "", threat = 20, error = 1, cap = null } = {}) {
    const roll = await new Roll(formula, data).evaluate();
    const die = roll.dice[0]?.total ?? 0;
    const notes = [];
    if (die >= threat) notes.push(`<span class="spycraft2-threat">${game.i18n.localize("SPYCRAFT.Roll.Threat")}</span>`);
    if (die <= error) notes.push(`<span class="spycraft2-error">${game.i18n.localize("SPYCRAFT.Roll.Error")}</span>`);
    const resolved = resolveSkillResult(roll.total, die, { cap, threat });
    if (resolved.limited) notes.push(`<strong>Effective result: ${resolved.total} (cap ${Number(cap)})</strong>`);
    const range = `<small>${game.i18n.format("SPYCRAFT.Roll.Range", { error, threat })}</small>`;
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${flavor} ${range}${notes.length ? `<br>${notes.join(" ")}` : ""}`,
      flags: { spycraft2: { rawTotal: roll.total, effectiveTotal: resolved.total,
        capped: resolved.limited, naturalDie: die } }
    });
  }

  async rollAbility(key) {
    const mod = this.system.abilities[key]?.mod ?? 0;
    return this.rollCheck("1d20 + @mod", { mod }, { flavor: game.i18n.localize(CONFIG.SPYCRAFT.abilities[key]) });
  }

  async rollSave(key) {
    const total = this.system.saves?.[key]?.total ?? 0;
    return this.rollCheck("1d20 + @total", { total }, { flavor: game.i18n.localize(CONFIG.SPYCRAFT.saves[key].label) });
  }

  async rollSkill(key, ability = null) {
    const sk = this.system.skillTotals?.[key];
    if (!sk) return null;
    const t = sk.totals.find(x => x.ability === (ability ?? sk.ability)) ?? sk.totals[0];
    const abil = game.i18n.localize(CONFIG.SPYCRAFT.abilities[t.ability]);
    return this.rollCheck("1d20 + @total", { total: t.total }, {
      flavor: `${sk.name} (${abil})${sk.isClass ? "" : ` — ${game.i18n.localize("SPYCRAFT.Skill.CrossClass")}`}${sk.untrained ? ` — ${game.i18n.localize("SPYCRAFT.Skill.Untrained")}` : ""}`,
      threat: sk.threat, error: sk.error ?? 1, cap: sk.cap
    });
  }

  async rollAttack(item) {
    const w = item.system;
    const atk = this.weaponAttack(item);
    return this.rollCheck("1d20 + @total", { total: atk.total }, {
      flavor: `${game.i18n.localize("SPYCRAFT.Attack")}: ${item.name}${atk.trained ? "" : ` — ${game.i18n.localize("SPYCRAFT.Weapon.Untrained")}`}`,
      threat: w.threat, error: atk.error
    });
  }

  async rollDamage(item) {
    const formula = item.system.damageFormula;
    if (!formula) return ui.notifications.warn(game.i18n.format("SPYCRAFT.Weapon.NoDamage", { name: item.name }));
    const str = this.weaponDamageBonus(item);
    const roll = await new Roll(strengthDamageFormula(formula, str), this.getRollData()).evaluate();
    const strNote = str ? ` ${game.i18n.format("SPYCRAFT.Weapon.StrengthDamage", { mod: `${str > 0 ? "+" : ""}${str}` })}` : "";
    return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor: `${game.i18n.localize("SPYCRAFT.Damage")}: ${item.name} (${item.system.damage})${strNote}` });
  }

  /** Spend an action die and roll it (action dice explode). */
  async rollActionDie() {
    const ad = this.system.actionDice;
    if (!ad || ad.value <= 0) return ui.notifications.warn(game.i18n.localize("SPYCRAFT.ActionDice.None"));
    await this.update({ "system.actionDice.value": ad.value - 1 });
    const roll = await new Roll(`1d${ad.die}x${ad.bonus ? ` + ${ad.bonus}` : ""}`).evaluate();
    return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor: game.i18n.localize("SPYCRAFT.ActionDice.Spend") });
  }

  /** Strength modifier added to a weapon's damage (melee, unarmed and non-explosive hurled attacks), else 0. */
  weaponDamageBonus(item) {
    const w = item.system;
    return damageAddsStrength(w.proficiency, w.damage) ? (this.system.abilities.str?.mod ?? 0) : 0;
  }

  /** Attack bonus for a weapon, including proficiency and forte. */
  weaponAttack(item) {
    const w = item.system;
    const prof = CONFIG.SPYCRAFT.proficiencies[w.proficiency];
    const abil = prof?.ability ?? (w.isMelee ? "str" : "dex");
    const mod = this.system.abilities[abil]?.mod ?? 0;
    const p = this.system.proficiencies?.[w.proficiency];
    const trained = this.type !== "agent" || !!p?.proficient;
    const forte = p?.forte ? 1 : 0;
    const total = (this.system.bab ?? 0) + mod + forte + (trained ? 0 : w.untrainedPenalty);
    return { total, trained, ability: abil, forte, error: w.error + (trained ? 0 : 2), damageBonus: this.weaponDamageBonus(item) };
  }

  /* -------------------------------------------- */
  /*  Character building                            */
  /* -------------------------------------------- */

  /**
   * Add a career level in a class. Creates the class item on the actor if needed.
   * @param {Item|object} classData  a class Item (world/compendium/embedded) or its data
   */
  async addClassLevel(classData, { promptVitality = true } = {}) {
    if (this.type !== "agent") return;
    const sys = this.system;
    if (sys.progression.length >= 20) return ui.notifications.warn(game.i18n.localize("SPYCRAFT.Class.MaxLevel"));
    const ident = classData.system?.identifier || classData.name;
    let cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === ident);
    if (!cls) {
      const data = classData.toObject?.() ?? foundry.utils.deepClone(classData);
      delete data._id;
      [cls] = await this.createEmbeddedDocuments("Item", [data]);
    }
    if (cls.system.expert && !(sys.classLevels?.[ident])) {
      if (sys.level < 4) ui.notifications.warn(game.i18n.format("SPYCRAFT.Class.ExpertTooEarly", { name: cls.name }));
    }
    // Record eligibility before taking an expert class, not after its own BAB,
    // skill and other progression bonuses have been applied.
    const firstExpertLevel = cls.system.expert && !(sys.classLevels?.[ident]);
    const expertEntry = firstExpertLevel && cls.system.requirements
      ? this.checkPrerequisites(cls.system.requirements) : null;
    const progression = [...sys.progression.map(p => ({ ...p })),
      { classId: ident, vitality: 0, skills: {}, expertEntry }];
    await this.update({ "system.progression": progression });
    await this.syncGrantedFeats();
    if (promptVitality && progression.length > 1 && cls.system.vitalityDie) {
      const roll = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("SPYCRAFT.VitalityRoll") },
        content: `<p>${game.i18n.format("SPYCRAFT.VitalityPrompt", { level: progression.length, name: cls.name, die: cls.system.vitalityDie })}</p>`
      });
      if (roll) await this.rollVitality(progression.length - 1);
    }
    return cls;
  }

  /**
   * Roll the class vitality die for one career level and store the result.
   * @param {number} index  zero-based index into the level progression (level 1 is always the maximum)
   */
  async rollVitality(index) {
    if (this.type !== "agent") return null;
    const entry = this.system.progression[index];
    if (!entry || index < 1) return null;
    const cls = this.items.find(i => i.type === "class" && (i.system.identifier || i.name) === entry.classId);
    const die = cls?.system.vitalityDie;
    if (!die) return null;
    const roll = await new Roll(`1d${die}`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("SPYCRAFT.VitalityFlavor", { level: index + 1, name: cls.name })
    });
    const progression = this.system.progression.map(p => ({ ...p }));
    progression[index].vitality = roll.total;
    await this.update({ "system.progression": progression });
    return roll;
  }

  /** Remove the most recent career level. Deletes the class item when no levels remain. */
  async removeLastLevel() {
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
    this._grantSync = (this._grantSync ?? Promise.resolve()).then(() => this.#syncGrantedFeats()).catch(err => console.error(err));
    return this._grantSync;
  }

  async #syncGrantedFeats() {
    const required = this.requiredGrants();
    const norm = s => s.trim().toLowerCase();
    const have = new Map();
    const toDelete = [];
    const requiredNames = new Set([...required.keys()].map(norm));
    const groups = new Map();
    for (const i of this.items.filter(i => i.type === "feat")) {
      const key = norm(i.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    for (const [key, copies] of groups) {
      // Prefer an explicitly selected feat to an automatically granted copy.
      const manual = copies.find(i => !i.system.granted);
      const grants = copies.filter(i => i.system.granted);
      if (manual) {
        have.set(key, manual);
        toDelete.push(...grants);
      } else if (requiredNames.has(key) && grants.length) {
        have.set(key, grants[0]);
        toDelete.push(...grants.slice(1));
      } else {
        toDelete.push(...grants);
      }
    }
    const toCreate = [];
    const missing = [...required.keys()].filter(n => !have.has(norm(n)));
    if (missing.length) {
      const pack = game.packs.get(FEAT_PACK);
      const index = pack ? await pack.getIndex() : [];
      for (const name of missing) {
        const entry = index.find?.(e => norm(e.name) === norm(name));
        if (entry) {
          const doc = await pack.getDocument(entry._id);
          const data = doc.toObject();
          delete data._id;
          data.system.granted = true;
          data.system.grantSource = required.get(name);
          data.system.acquiredAtLevel = grantAcquisitionLevel(this.items, this.system.progression, name);
          toCreate.push(data);
        } else {
          toCreate.push({ name, type: "feat", system: { granted: true, grantSource: required.get(name),
            acquiredAtLevel: grantAcquisitionLevel(this.items, this.system.progression, name) } });
        }
      }
    }
    const toUpdate = [];
    for (const [key, existing] of have) {
      if (!existing.system.granted || !requiredNames.has(key)) continue;
      const level = grantAcquisitionLevel(this.items, this.system.progression, existing.name);
      if (level && existing.system.acquiredAtLevel !== level) {
        toUpdate.push({ _id: existing.id, "system.acquiredAtLevel": level });
      }
    }
    if (toDelete.length) await this.deleteEmbeddedDocuments("Item", toDelete.map(i => i.id));
    if (toUpdate.length) await this.updateEmbeddedDocuments("Item", toUpdate);
    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
  }

  /** Prerequisite check for an arbitrary feat/class document against this actor. */
  checkPrerequisites(tree) {
    const featNames = new Set(this.items.filter(i => i.type === "feat").map(i => i.name.trim().toLowerCase()));
    const featTrees = {};
    for (const f of this.items.filter(i => i.type === "feat")) featTrees[f.system.tree] = (featTrees[f.system.tree] ?? 0) + f.system.ranks;
    const skillRanks = Object.fromEntries(Object.entries(this.system.skillTotals ?? {}).map(([k, v]) => [k, v.ranks]));
    const ctx = prerequisiteContext(this.system, featNames, featTrees, skillRanks);
    return checkPrerequisites(tree, ctx);
  }
}
