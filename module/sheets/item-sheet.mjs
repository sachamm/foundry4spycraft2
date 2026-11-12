import { describe as describePrereq } from "../rules/prerequisites.mjs";
import { humanizeTemplate, renderTemplate } from "../rules/formula.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TPL = "systems/spycraft2/templates/item";

export class SpycraftItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "sheet", "item"],
    position: { width: 560, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      addBonus: SpycraftItemSheet.#onAddBonus,
      removeBonus: SpycraftItemSheet.#onRemoveBonus,
      toChat: SpycraftItemSheet.#onToChat
    }
  };

  static PARTS = {
    header: { template: `${TPL}/item-header.hbs` },
    details: { template: `${TPL}/item-gear.hbs`, scrollable: [""] }
  };

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.details = { ...parts.details, template: `${TPL}/item-${this.item.type}.hbs` };
    return parts;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const sys = item.system;
    const cfg = CONFIG.SPYCRAFT;
    Object.assign(context, {
      item, system: sys, config: cfg, editable: this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, { secrets: item.isOwner, relativeTo: item }),
      bonuses: (sys.bonuses ?? []).map((b, i) => ({ ...b, index: i, label: cfg.bonusTargets[b.target] ?? b.target })),
      bonusTargets: cfg.bonusTargets,
      featTrees: cfg.featTrees,
      proficiencies: Object.fromEntries(Object.entries(cfg.proficiencies).map(([k, v]) => [k, v.label])),
      calibers: cfg.calibers,
      pickOptions: Object.fromEntries([["", "—"], ...Object.entries(cfg.gearPicks).map(([k, v]) => [k, `${k} — ${v}`])]),
      originTypes: Object.fromEntries(Object.entries(cfg.originTypes).map(([k, v]) => [k, game.i18n.localize(v)]))
    });

    if (item.type === "feat") {
      context.prereqText = describePrereq(sys.prerequisites) || "—";
      context.prereqJSON = sys.prerequisites ? JSON.stringify(sys.prerequisites, null, 1) : "";
      if (item.actor?.type === "agent") context.status = item.actor.system.featStatus?.[item.id];
    }
    if (item.type === "class") {
      context.classSkills = sys.classSkills.map(k => cfg.skills[k]?.name ?? k).join(", ");
      context.requirementsText = describePrereq(sys.requirements);
      context.lists = (sys.choiceLists ?? []).map(L => ({
        ...L, levels: sys.choiceSchedule.filter(s => s.list === L.key).map(s => s.level).join(", ")
      }));
      const rd = item.actor?.type === "agent" ? item.actor.getRollData() : null;
      context.abilities = (sys.abilities ?? []).map(a => ({ ...a, text: rd ? renderTemplate(a.description, rd) : humanizeTemplate(a.description) }));
      context.grants = (sys.featGrants ?? []).map(g => `${g.feat} (${g.level})`).join(", ");
      context.levelBonuses = (sys.bonuses ?? []).map(b => `${cfg.bonusTargets[b.target] ?? b.target} ${b.value}${b.level ? ` @ ${b.level}` : ""}`).join("; ");
    }
    if (item.type === "origin") context.grantsText = (sys.grants ?? []).join(", ");
    return context;
  }

  _prepareSubmitData(event, form, formData, updateData) {
    const flat = formData.object;
    const bonuses = (this.item.system.bonuses ?? []).map(b => ({ ...b }));
    let changed = false;
    for (const [k, v] of Object.entries(flat)) {
      const m = k.match(/^bonuses\.(\d+)\.(\w+)$/);
      if (m) {
        if (bonuses[m[1]]) bonuses[m[1]][m[2]] = m[2] === "level" ? Number(v) || 0 : v;
        changed = true;
        delete flat[k];
      }
    }
    if (changed) flat["system.bonuses"] = bonuses;
    if ("grantsText" in flat) {
      flat["system.grants"] = String(flat.grantsText).split(",").map(s => s.trim()).filter(Boolean);
      delete flat.grantsText;
    }
    if ("prereqJSON" in flat) {
      const txt = String(flat.prereqJSON).trim();
      try { flat["system.prerequisites"] = txt ? JSON.parse(txt) : null; }
      catch { ui.notifications.error(game.i18n.localize("SPYCRAFT.Feat.BadPrereqJSON")); }
      delete flat.prereqJSON;
    }
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  static #onAddBonus() {
    const bonuses = [...(this.item.system.bonuses ?? []).map(b => ({ ...b })), { target: "", value: "0", level: 0 }];
    return this.item.update({ "system.bonuses": bonuses });
  }

  static #onRemoveBonus(event, target) {
    const bonuses = (this.item.system.bonuses ?? []).map(b => ({ ...b }));
    bonuses.splice(Number(target.dataset.index), 1);
    return this.item.update({ "system.bonuses": bonuses });
  }

  static #onToChat() { return this.item.toChat(); }
}
