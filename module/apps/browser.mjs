import { checkPrerequisites, describe } from "../rules/prerequisites.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PACKS = { class: "spycraft2.classes", origin: "spycraft2.origins", feat: "spycraft2.feats", weapon: "spycraft2.weapons", armor: "spycraft2.armor" };
const FIELDS = {
  class: ["system.identifier", "system.expert", "system.requirements", "system.vitalityDie", "system.skillPoints", "system.description"],
  origin: ["system.originType", "system.description"],
  feat: ["system.tree", "system.prerequisites", "system.prerequisitesNotChecked", "system.description"],
  weapon: ["system.proficiency", "system.caliber", "system.damage", "system.errorThreat", "system.range", "system.qualities"],
  armor: ["system.caliber", "system.damageReduction", "system.damageReductionSubdual", "system.defensePenalty", "system.armorCheck"]
};

/** Item types an agent can only hold once; the browser won't add a second copy. */
const UNIQUE = new Set(["feat", "origin"]);

/** Plain text of a stored HTML description (parsed inertly, nothing is loaded or run). */
function plainText(html) {
  if (!html) return "";
  return new DOMParser().parseFromString(String(html), "text/html").body.textContent.replace(/\s+/g, " ").trim();
}

/**
 * Compendium browser that shows which options a character
 * qualifies for (feats, expert classes) and lets the player add them in one click.
 */
export class SpycraftBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ actor, itemType = "feat", originType = null, ...options } = {}) {
    super(options);
    this.actor = actor;
    this.itemType = itemType;
    this.filters = { search: "", group: originType ?? "", qualifiedOnly: false };
  }

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "browser"],
    position: { width: 640, height: 720 },
    window: { resizable: true },
    actions: {
      add: SpycraftBrowser.#onAdd,
      open: SpycraftBrowser.#onOpen
    }
  };

  static PARTS = {
    main: { template: "systems/spycraft2/templates/apps/browser.hbs", scrollable: [".browser-list"] }
  };

  get title() {
    return game.i18n.format("SPYCRAFT.Browser.Title", { type: game.i18n.localize(`TYPES.Item.${this.itemType}`) });
  }

  async _prepareContext(options) {
    const pack = game.packs.get(PACKS[this.itemType]);
    const index = pack ? await pack.getIndex({ fields: FIELDS[this.itemType] }) : [];
    const cfg = CONFIG.SPYCRAFT;
    const owned = new Set(this.actor?.items.filter(i => i.type === this.itemType).map(i => i.name.toLowerCase()) ?? []);
    const search = this.filters.search.toLowerCase();

    let groups = {};
    const rows = [];
    for (const e of index) {
      const s = e.system ?? {};
      let group = "", groupLabel = "", req = null, extra = "";
      switch (this.itemType) {
        case "feat": group = s.tree; groupLabel = cfg.featTrees[s.tree] ?? s.tree; req = s.prerequisites; break;
        case "class": group = s.expert ? "expert" : "base"; groupLabel = game.i18n.localize(s.expert ? "SPYCRAFT.Class.Expert" : "SPYCRAFT.Class.Base");
          req = s.requirements; extra = `d${s.vitalityDie} VP · ${s.skillPoints} SP`; break;
        case "origin": group = s.originType; groupLabel = game.i18n.localize(cfg.originTypes[s.originType]); break;
        case "weapon": group = s.proficiency; groupLabel = cfg.proficiencies[s.proficiency]?.label ?? s.proficiency;
          extra = `${cfg.calibers[s.caliber]} · ${s.damage} · ${s.errorThreat}${s.range ? ` · ${s.range} ft` : ""}`; break;
        case "armor": group = String(s.caliber); groupLabel = `Caliber ${cfg.calibers[s.caliber]}`;
          extra = `DR ${s.damageReduction}/${s.damageReductionSubdual} · Def ${s.defensePenalty} · ACP ${s.armorCheck}`; break;
      }
      groups[group] = groupLabel;
      if (this.filters.group && group !== this.filters.group) continue;
      const summary = plainText(s.description);
      if (search && !e.name.toLowerCase().includes(search) && !summary.toLowerCase().includes(search)) continue;
      const check = req && this.actor ? this.actor.checkPrerequisites(req) : { ok: true, unmet: [] };
      if (this.filters.qualifiedOnly && !check.ok) continue;
      rows.push({
        uuid: e.uuid, id: e._id, name: e.name, groupLabel, extra, summary,
        owned: owned.has(e.name.toLowerCase()),
        locked: UNIQUE.has(this.itemType) && owned.has(e.name.toLowerCase()),
        qualified: check.ok, unmet: check.unmet.join("; "), prereq: req ? describe(req) : "",
        notChecked: s.prerequisitesNotChecked
      });
    }
    rows.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.name.localeCompare(b.name));
    return {
      rows, filters: this.filters, hasPrereqs: ["feat", "class"].includes(this.itemType),
      groups: Object.fromEntries(Object.entries(groups).sort((a, b) => a[1].localeCompare(b[1]))),
      actor: this.actor, missingPack: !pack
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    html.querySelector("[name=search]")?.addEventListener("input", foundry.utils.debounce(ev => {
      this.filters.search = ev.target.value;
      this.render().then(() => {
        const input = this.element.querySelector("[name=search]");
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      });
    }, 250));
    html.querySelector("[name=group]")?.addEventListener("change", ev => { this.filters.group = ev.target.value; this.render(); });
    html.querySelector("[name=qualifiedOnly]")?.addEventListener("change", ev => { this.filters.qualifiedOnly = ev.target.checked; this.render(); });
  }

  static async #onAdd(event, target) {
    const doc = await fromUuid(target.closest("[data-uuid]").dataset.uuid);
    if (!doc || !this.actor) return;
    if (UNIQUE.has(doc.type) && this.actor.items.some(i => i.type === doc.type && i.name.toLowerCase() === doc.name.toLowerCase())) {
      return ui.notifications.warn(game.i18n.format(`SPYCRAFT.Browser.Owned.${doc.type}`, { name: doc.name, actor: this.actor.name }));
    }
    if (doc.type === "class") await this.actor.addClassLevel(doc);
    else {
      if (doc.type === "origin") {
        const old = this.actor.items.filter(i => i.type === "origin" && i.system.originType === doc.system.originType);
        if (old.length) await this.actor.deleteEmbeddedDocuments("Item", old.map(i => i.id));
      }
      const data = doc.toObject();
      delete data._id;
      if (doc.type === "feat") data.system.acquiredAtLevel = Math.max(1, this.actor.system.level ?? 1);
      await this.actor.createEmbeddedDocuments("Item", [data]);
    }
    ui.notifications.info(game.i18n.format("SPYCRAFT.Browser.Added", { name: doc.name, actor: this.actor.name }));
    this.render();
  }

  static async #onOpen(event, target) {
    const doc = await fromUuid(target.closest("[data-uuid]").dataset.uuid);
    doc?.sheet.render(true);
  }
}
