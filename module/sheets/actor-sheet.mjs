import { renderTemplate } from "../rules/formula.mjs";
import { describe as describePrereq } from "../rules/prerequisites.mjs";
import { SpycraftBrowser } from "../apps/browser.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TPL = "systems/spycraft2/templates/actor";

/* -------------------------------------------------------------------------- */
/*  Agent sheet                                                               */
/* -------------------------------------------------------------------------- */

export class SpycraftAgentSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** Career level whose skill points are being edited on the Skills tab. */
  _skillLevel = null;

  /** Which collapsible header panels (to-do, warnings) are open, so re-renders keep them that way. */
  _open = { todo: true, warnings: false };

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "agent"],
    position: { width: 820, height: 860 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAbility: SpycraftAgentSheet.#onRollAbility,
      rollSave: SpycraftAgentSheet.#onRollSave,
      rollSkill: SpycraftAgentSheet.#onRollSkill,
      rollAttack: SpycraftAgentSheet.#onRollAttack,
      rollDamage: SpycraftAgentSheet.#onRollDamage,
      rollInitiative: SpycraftAgentSheet.#onRollInitiative,
      rollVitality: SpycraftAgentSheet.#onRollVitality,
      todo: SpycraftAgentSheet.#onTodo,
      spendActionDie: SpycraftAgentSheet.#onSpendActionDie,
      refreshActionDice: SpycraftAgentSheet.#onRefreshActionDice,
      addLevel: SpycraftAgentSheet.#onAddLevel,
      removeLevel: SpycraftAgentSheet.#onRemoveLevel,
      browse: SpycraftAgentSheet.#onBrowse,
      itemEdit: SpycraftAgentSheet.#onItemEdit,
      itemDelete: SpycraftAgentSheet.#onItemDelete,
      itemChat: SpycraftAgentSheet.#onItemChat,
      itemEquip: SpycraftAgentSheet.#onItemEquip,
      createItem: SpycraftAgentSheet.#onCreateItem,
      toggleFocus: SpycraftAgentSheet.#onToggleFocus,
      addRow: SpycraftAgentSheet.#onAddRow,
      removeRow: SpycraftAgentSheet.#onRemoveRow,
      skillLevel: SpycraftAgentSheet.#onSkillLevel,
      syncGrants: SpycraftAgentSheet.#onSyncGrants
    }
  };

  static PARTS = {
    header: { template: `${TPL}/agent-header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: `${TPL}/agent-main.hbs`, scrollable: [""] },
    classes: { template: `${TPL}/agent-classes.hbs`, scrollable: [""] },
    skills: { template: `${TPL}/agent-skills.hbs`, scrollable: [""] },
    feats: { template: `${TPL}/agent-feats.hbs`, scrollable: [""] },
    training: { template: `${TPL}/agent-training.hbs`, scrollable: [""] },
    gear: { template: `${TPL}/agent-gear.hbs`, scrollable: [""] },
    bio: { template: `${TPL}/agent-bio.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "main", label: "SPYCRAFT.Tab.Main" },
        { id: "classes", label: "SPYCRAFT.Tab.Classes" },
        { id: "skills", label: "SPYCRAFT.Tab.Skills" },
        { id: "feats", label: "SPYCRAFT.Tab.Feats" },
        { id: "training", label: "SPYCRAFT.Tab.Training" },
        { id: "gear", label: "SPYCRAFT.Tab.Gear" },
        { id: "bio", label: "SPYCRAFT.Tab.Bio" }
      ],
      initial: "main"
    }
  };

  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const sys = actor.system;
    const cfg = CONFIG.SPYCRAFT;
    const rollData = actor.getRollData();
    Object.assign(context, {
      actor, system: sys, source: actor.system._source, config: cfg, editable: this.isEditable,
      tabs: this._prepareTabs("primary"),
      warnings: sys.warnings ?? [], todo: sys.todo ?? [], open: this._open
    });

    // Hover breakdowns: fixed parts first, then every origin/feat/class bonus the engine recorded.
    const src = sys.bonusSources ?? {};
    const misc = sys.misc ?? {};
    const tip = (parts, ...targets) => {
      const rows = parts.filter(([, v]) => v);
      for (const t of targets) for (const s of src[t] ?? []) rows.push([s.source, s.value]);
      return rows;
    };
    const abilTip = k => [k.toUpperCase(), sys.abilities[k].mod];
    const miscLabel = game.i18n.localize("SPYCRAFT.Misc");
    const classLabel = game.i18n.localize("SPYCRAFT.Class.Label");
    const armorLabel = game.i18n.localize("SPYCRAFT.Armor");
    const vitBonus = (src.vitality ?? []).reduce((n, s) => n + s.value, 0);
    const conPart = sys.abilities.con.mod * sys.level;
    context.tips = {
      defense: tip([[game.i18n.localize("SPYCRAFT.Base"), 10], [classLabel, sys.defense.base], abilTip("dex"), [armorLabel, sys.defense.armor], [miscLabel, misc.defense]], "defense"),
      initiative: tip([[classLabel, sys.initiative.base], abilTip("dex"), [miscLabel, misc.initiative]], "initiative"),
      speed: tip([[game.i18n.localize("SPYCRAFT.Base"), 30], [armorLabel, sys.armor?.speed], [miscLabel, misc.speed]], "speed"),
      knowledge: tip([[game.i18n.localize("SPYCRAFT.Level"), sys.level], abilTip("int"), [miscLabel, misc.knowledge]], "knowledge"),
      vitality: tip([[game.i18n.localize("SPYCRAFT.VitalityDice"), sys.vitality.max - vitBonus - conPart - (misc.vitality ?? 0)],
        [`CON × ${sys.level}`, conPart], [miscLabel, misc.vitality]], "vitality"),
      wounds: tip([["CON", sys.abilities.con.value], [miscLabel, misc.wounds]], "wounds"),
      actionDice: tip([[game.i18n.localize("SPYCRAFT.Level"), sys.actionDice.max - (src["actionDice.count"] ?? []).reduce((n, s) => n + s.value, 0) - (misc.actionDice ?? 0)],
        [miscLabel, misc.actionDice]], "actionDice.count")
    };

    // Abilities
    context.abilities = Object.entries(cfg.abilities).map(([key, label]) => ({
      key, label: game.i18n.localize(label), abbr: key.toUpperCase(), ...sys.abilities[key]
    }));
    context.increaseLevels = cfg.abilityIncreaseLevels.map(l => ({
      level: l, key: `l${l}`, value: sys.abilityIncreases[`l${l}`], reached: sys.level >= l
    }));
    context.abilityOptions = Object.fromEntries(Object.entries(cfg.abilities).map(([k, v]) => [k, game.i18n.localize(v)]));

    context.saves = Object.entries(cfg.saves).map(([key, s]) => ({
      key, label: game.i18n.localize(s.label), ...sys.saves[key],
      tip: tip([[classLabel, sys.saves[key].base], abilTip(s.ability), key === "ref" ? [armorLabel, sys.armor?.check] : [armorLabel, 0], [miscLabel, misc[key]]], `saves.${key}`)
    }));

    // Items by type
    const items = actor.items.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const byType = t => items.filter(i => i.type === t);
    context.talent = byType("origin").find(i => i.system.originType === "talent");
    context.specialty = byType("origin").find(i => i.system.originType === "specialty");

    // Classes & progression
    const classItems = byType("class");
    const classById = Object.fromEntries(classItems.map(c => [c.system.identifier || c.name, c]));
    context.progression = sys.progression.map((p, i) => {
      const ci = classById[p.classId];
      const counts = sys.progression.slice(0, i + 1).filter(x => x.classId === p.classId).length;
      return {
        index: i, level: i + 1, classId: p.classId, className: ci?.name ?? p.classId, classLevel: counts,
        vitalityDie: ci?.system.vitalityDie, vitality: p.vitality, first: i === 0, isLast: i === sys.progression.length - 1,
        skillPoints: sys.skillPoints?.[i]
      };
    });
    context.classes = classItems.map(ci => {
      const ident = ci.system.identifier || ci.name;
      const lvl = sys.classLevels?.[ident] ?? 0;
      const lists = Object.fromEntries((ci.system.choiceLists ?? []).map(L => [L.key, L]));
      return {
        item: ci, levels: lvl,
        abilities: (ci.system.abilities ?? []).filter(a => a.level <= lvl).map(a => ({
          ...a, text: renderTemplate(a.description, { ...rollData, classes: { ...rollData.classes } })
        })),
        choices: (ci.system.choiceSchedule ?? []).map((slot, idx) => ({
          idx, level: slot.level, list: lists[slot.list]?.name ?? slot.list, active: slot.level <= lvl,
          value: ci.system.choices?.[idx] ?? "",
          options: Object.fromEntries((lists[slot.list]?.options ?? []).map(o => [o.index, o.name])),
          description: lists[slot.list]?.options?.find(o => o.index === Number(ci.system.choices?.[idx]))?.description ?? ""
        })).filter(c => c.active)
      };
    });
    context.xpNext = sys.xpNext;

    // Skills
    const lvl = Math.clamp(this._skillLevel ?? sys.level, 1, Math.max(1, sys.level));
    context.skillLevel = sys.level ? lvl : null;
    const entry = sys.progression[lvl - 1];
    const lvlClass = entry ? classById[entry.classId] : null;
    context.skillLevelInfo = sys.skillPoints?.[lvl - 1];
    context.skillLevels = sys.progression.map((p, i) => ({ level: i + 1, active: i + 1 === lvl }));
    context.skills = Object.values(sys.skillTotals ?? {}).map(s => ({
      ...s,
      points: entry?.skills?.[s.key] ?? 0,
      classAtLevel: !!(lvlClass?.system.classSkills?.includes(s.key) || s.classOverride),
      abilityLabel: s.abilities.map(a => a.toUpperCase()).join("/"),
      totalsLabel: s.totals.map(t => `${t.total >= 0 ? "+" : ""}${t.total}`).join(" / "),
      bonusTip: tip([[miscLabel, s.misc]], `skills.${s.key}.misc`),
      threatTip: tip([], `skills.${s.key}.threat`),
      capTip: tip([], `skills.${s.key}.cap`),
      totals: s.totals.map(t => ({
        ...t, tip: tip([[game.i18n.localize("SPYCRAFT.Skill.Ranks"), s.ranks], abilTip(t.ability), [miscLabel, s.misc]], `skills.${s.key}.misc`)
      }))
    }));

    // Feats
    context.feats = byType("feat").map(f => ({
      item: f, treeLabel: cfg.featTrees[f.system.tree] ?? f.system.tree,
      status: sys.featStatus?.[f.id] ?? { ok: true, unmet: [] },
      prereqText: describePrereq(f.system.prerequisites)
    })).sort((a, b) => a.treeLabel.localeCompare(b.treeLabel) || a.item.name.localeCompare(b.item.name));
    context.featTrees = Object.entries(sys.feats?.trees ?? {}).filter(([, v]) => v.slots || v.spent || v.owned)
      .map(([k, v]) => ({ key: k, label: cfg.featTrees[k], ...v }));
    context.coreAbilities = sys.coreAbilities ?? [];

    // Training
    context.proficiencies = Object.entries(cfg.proficiencies).map(([k, p]) => ({
      key: k, label: p.label, ...sys.proficiencies[k], hint: sys.proficiencyPicks?.hints?.[k]
    }));
    context.focusGroups = ["cultures", "drive", "science"].map(skill => ({
      skill, label: cfg.skills[skill].name, picks: sys.focusPicks?.[skill],
      options: cfg.focuses[skill].map(name => ({ name, checked: sys.focuses[skill].includes(name) }))
    }));
    context.professionText = sys.focuses.profession.join("\n");
    context.fortesText = sys.focuses.fortes.join("\n");
    context.contactGrades = Object.fromEntries(cfg.tables.contacts.map(c => [c.rank, `${c.rank} — ${c.grade}`]));

    // Gear
    context.weapons = byType("weapon").map(w => ({ item: w, attack: actor.weaponAttack(w), caliber: cfg.calibers[w.system.caliber] }));
    context.armor = byType("armor").map(a => ({ item: a, caliber: cfg.calibers[a.system.caliber] }));
    context.gear = byType("gear").map(g => ({ item: g, caliber: cfg.calibers[g.system.caliber] }));
    context.gearPicks = Object.entries(sys.gearPicks ?? {}).map(([k, v]) => ({ key: k, label: cfg.gearPicks[k], ...v }));
    context.pickOptions = Object.fromEntries([["", "—"], ...Object.entries(cfg.gearPicks).map(([k]) => [k, k])]);

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.biography, { secrets: actor.isOwner, rollData });
    return context;
  }

  /** Remember which header panels the player has opened or closed. */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const d of this.element.querySelectorAll("details[data-key]")) {
      d.addEventListener("toggle", () => { this._open[d.dataset.key] = d.open; });
    }
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */
  /*  Form handling                                */
  /* -------------------------------------------- */

  /** Merge array/embedded edits (progression, contacts, subplots, class choices) before update. */
  _prepareSubmitData(event, form, formData, updateData) {
    const flat = formData.object;
    const sys = this.actor.system;
    const progression = sys.progression.map(p => ({ ...p, skills: { ...p.skills } }));
    const rows = { contacts: sys.contacts.map(r => ({ ...r })), subplots: sys.subplots.map(r => ({ ...r })) };
    const changed = new Set();
    const itemUpdates = {};
    const skillIdx = Math.clamp(this._skillLevel ?? sys.level, 1, Math.max(1, sys.level)) - 1;

    for (const [k, v] of Object.entries(flat)) {
      let m;
      if ((m = k.match(/^progression\.(\d+)\.vitality$/))) {
        if (progression[m[1]]) progression[m[1]].vitality = Number(v) || 0;
        changed.add("progression");
      } else if ((m = k.match(/^skillpts\.(\w+)$/))) {
        if (progression[skillIdx]) {
          const n = Number(v) || 0;
          if (n) progression[skillIdx].skills[m[1]] = n;
          else delete progression[skillIdx].skills[m[1]];
        }
        changed.add("progression");
      } else if ((m = k.match(/^choice\.(\w+)\.(\d+)$/))) {
        (itemUpdates[m[1]] ??= {})[`system.choices.${m[2]}`] = v === "" ? null : Number(v);
      } else if ((m = k.match(/^(contacts|subplots)\.(\d+)\.(\w+)$/))) {
        if (rows[m[1]][m[2]]) rows[m[1]][m[2]][m[3]] = v;
        changed.add(m[1]);
      } else if (k === "professionText" || k === "fortesText") {
        flat[`system.focuses.${k === "professionText" ? "profession" : "fortes"}`] =
          String(v).split(/\n+/).map(s => s.trim()).filter(Boolean);
      } else continue;
      delete flat[k];
    }
    if (changed.has("progression")) flat["system.progression"] = progression;
    for (const key of ["contacts", "subplots"]) if (changed.has(key)) flat[`system.${key}`] = rows[key];
    this._pendingItemUpdates = itemUpdates;
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  async _processSubmitData(event, form, submitData, options) {
    const itemUpdates = Object.entries(this._pendingItemUpdates ?? {}).map(([_id, u]) => ({ _id, ...u }));
    this._pendingItemUpdates = null;
    if (itemUpdates.length) await this.actor.updateEmbeddedDocuments("Item", itemUpdates);
    return super._processSubmitData(event, form, submitData, options);
  }

  /** Dropping a class adds a level; origins replace the existing talent/specialty. */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;
    if (item.parent === this.actor) return super._onDropItem(event, item);
    if (item.type === "class") return this.actor.addClassLevel(item);
    if (item.type === "feat") {
      const data = item.toObject?.() ?? foundry.utils.deepClone(item);
      delete data._id;
      data.system.acquiredAtLevel = Math.max(1, this.actor.system.level ?? 1);
      return this.actor.createEmbeddedDocuments("Item", [data]);
    }
    if (item.type === "origin") {
      const old = this.actor.items.filter(i => i.type === "origin" && i.system.originType === item.system.originType);
      if (old.length) await this.actor.deleteEmbeddedDocuments("Item", old.map(i => i.id));
    }
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */
  /*  Actions                                      */
  /* -------------------------------------------- */

  _item(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
  }

  static #onRollAbility(event, target) { return this.actor.rollAbility(target.dataset.ability); }
  static #onRollSave(event, target) { return this.actor.rollSave(target.dataset.save); }
  static #onRollSkill(event, target) { return this.actor.rollSkill(target.dataset.skill, target.dataset.ability || null); }
  static #onRollAttack(event, target) { return this.actor.rollAttack(this._item(target)); }
  static #onRollDamage(event, target) { return this.actor.rollDamage(this._item(target)); }
  static #onRollInitiative() { return this.actor.rollInitiative({ createCombatants: true }); }
  static async #onRollVitality(event, target) {
    const index = Number(target.dataset.index);
    if (this.actor.system.progression[index]?.vitality) {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("SPYCRAFT.VitalityRoll") },
        content: `<p>${game.i18n.format("SPYCRAFT.VitalityReroll", { level: index + 1 })}</p>`
      });
      if (!ok) return;
    }
    return this.actor.rollVitality(index);
  }
  /** Jump from a to-do entry to the tab where it gets resolved. */
  static #onTodo(event, target) {
    const { tab, skillLevel } = target.dataset;
    if (skillLevel) this._skillLevel = Number(skillLevel);
    this.changeTab(tab, "primary");
    if (skillLevel) return this.render({ parts: ["skills"] });
  }
  static #onSpendActionDie() { return this.actor.rollActionDie(); }
  static #onRefreshActionDice() { return this.actor.update({ "system.actionDice.value": this.actor.system.actionDice.max }); }
  static #onAddLevel() { return new SpycraftBrowser({ actor: this.actor, itemType: "class" }).render(true); }
  static async #onRemoveLevel() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SPYCRAFT.Class.RemoveLevel") },
      content: `<p>${game.i18n.localize("SPYCRAFT.Class.RemoveLevelConfirm")}</p>`
    });
    if (ok) return this.actor.removeLastLevel();
  }
  static #onBrowse(event, target) {
    return new SpycraftBrowser({ actor: this.actor, itemType: target.dataset.type, originType: target.dataset.originType }).render(true);
  }
  static #onItemEdit(event, target) { return this._item(target)?.sheet.render(true); }
  static async #onItemDelete(event, target) { return this._item(target)?.deleteDialog(); }
  static #onItemChat(event, target) { return this._item(target)?.toChat(); }
  static #onItemEquip(event, target) {
    const item = this._item(target);
    if (!item) return;
    if (item.type === "armor" && !item.system.equipped) {
      // Toggle all suits in one embedded-document update, so never count two.
      return this.actor.updateEmbeddedDocuments("Item", [
        ...this.actor.items.filter(i => i.type === "armor" && i.system.equipped)
          .map(i => ({ _id: i.id, "system.equipped": false })),
        { _id: item.id, "system.equipped": true }
      ]);
    }
    return item.update({ "system.equipped": !item.system.equipped });
  }
  static #onCreateItem(event, target) {
    const type = target.dataset.type;
    return this.actor.createEmbeddedDocuments("Item", [{ name: game.i18n.format("DOCUMENT.New", { type: game.i18n.localize(`TYPES.Item.${type}`) }), type }]);
  }
  static #onToggleFocus(event, target) {
    const { skill, value } = target.dataset;
    const list = new Set(this.actor.system.focuses[skill]);
    if (list.has(value)) list.delete(value); else list.add(value);
    return this.actor.update({ [`system.focuses.${skill}`]: [...list] });
  }
  static #onAddRow(event, target) {
    const key = target.dataset.list;
    const row = key === "contacts" ? { name: "", rank: 1, notes: "" } : { name: "", notes: "", complete: false };
    return this.actor.update({ [`system.${key}`]: [...this.actor.system[key].map(r => ({ ...r })), row] });
  }
  static #onRemoveRow(event, target) {
    const key = target.dataset.list;
    const rows = this.actor.system[key].map(r => ({ ...r }));
    rows.splice(Number(target.dataset.index), 1);
    return this.actor.update({ [`system.${key}`]: rows });
  }
  static #onSkillLevel(event, target) {
    this._skillLevel = Number(target.dataset.level);
    return this.render({ parts: ["skills"] });
  }
  static #onSyncGrants() { return this.actor.syncGrantedFeats(); }
}

/* -------------------------------------------------------------------------- */
/*  NPC sheet (simple stat block)                                             */
/* -------------------------------------------------------------------------- */

export class SpycraftNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "actor", "npc"],
    position: { width: 600, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAbility: SpycraftNpcSheet.#onRollAbility,
      rollSave: SpycraftNpcSheet.#onRollSave,
      rollAttack: SpycraftNpcSheet.#onRollAttack,
      rollDamage: SpycraftNpcSheet.#onRollDamage,
      itemEdit: SpycraftNpcSheet.#onItemEdit,
      itemDelete: SpycraftNpcSheet.#onItemDelete
    }
  };

  static PARTS = { main: { template: `${TPL}/npc-sheet.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.actor.system;
    Object.assign(context, {
      actor: this.actor, system: sys, config: CONFIG.SPYCRAFT, editable: this.isEditable,
      abilities: Object.entries(CONFIG.SPYCRAFT.abilities).map(([key, label]) => ({ key, label: game.i18n.localize(label), ...sys.abilities[key] })),
      saves: Object.entries(CONFIG.SPYCRAFT.saves).map(([key, s]) => ({ key, label: game.i18n.localize(s.label), ...sys.saves[key] })),
      weapons: this.actor.items.filter(i => i.type === "weapon").map(w => ({ item: w, attack: this.actor.weaponAttack(w) })),
      otherItems: this.actor.items.filter(i => i.type !== "weapon"),
      npcTypes: { standard: "Standard", special: "Special", villain: "Villain" },
      enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.biography, { secrets: this.actor.isOwner })
    });
    return context;
  }

  _item(target) { return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId); }
  static #onRollAbility(event, target) { return this.actor.rollAbility(target.dataset.ability); }
  static #onRollSave(event, target) { return this.actor.rollSave(target.dataset.save); }
  static #onRollAttack(event, target) { return this.actor.rollAttack(this._item(target)); }
  static #onRollDamage(event, target) { return this.actor.rollDamage(this._item(target)); }
  static #onItemEdit(event, target) { return this._item(target)?.sheet.render(true); }
  static #onItemDelete(event, target) { return this._item(target)?.deleteDialog(); }
}
