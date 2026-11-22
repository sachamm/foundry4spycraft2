import { refuse } from "../error-notices.mjs";
import { enrich } from "../sheets/enrich.mjs";
import { describe } from "../rules/prerequisites.mjs";
import { VEHICLE_RULES } from "../rules/tables.mjs";
import { loc } from "../i18n.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Compendium packs searched for each item type; gear is spread over several. */
const PACKS = {
  gear: [
    "spycraft2.gear",
    "spycraft2.kits",
    "spycraft2.vehicle-upgrades",
    "spycraft2.equipment-upgrades",
    "spycraft2.contagions"
  ],
  vehicle: "spycraft2.vehicles",
  class: "spycraft2.classes",
  origin: "spycraft2.origins",
  feat: "spycraft2.feats",
  weapon: "spycraft2.weapons",
  armor: "spycraft2.armor"
};
const FIELDS = {
  gear: [
    "system.kitType",
    "system.kitGrade",
    "system.kitSize",
    "system.kitNonPortable",
    "system.weight",
    "system.caliber",
    "system.description",
    "system.gearCategory",
    "system.powerRating",
    "system.streetValue",
    "system.standingOnly",
    "system.standingCost",
    "system.sourceTable"
  ],
  vehicle: [
    "system.vehicleClass",
    "system.caliber",
    "system.sizeLabel",
    "system.occupancy",
    "system.accelerationTurning",
    "system.mph",
    "system.defenseSave",
    "system.standingOnly",
    "system.standingCost"
  ],
  class: [
    "system.identifier",
    "system.expert",
    "system.requirements",
    "system.vitalityDie",
    "system.skillPoints",
    "system.description"
  ],
  origin: ["system.originType", "system.description"],
  feat: [
    "system.tree",
    "system.prerequisites",
    "system.prerequisitesNotChecked",
    "system.repeatable",
    "system.maxSelections",
    "system.description"
  ],
  weapon: [
    "system.proficiency",
    "system.caliber",
    "system.damage",
    "system.errorThreat",
    "system.range",
    "system.qualities"
  ],
  armor: [
    "system.caliber",
    "system.damageReduction",
    "system.damageReductionSubdual",
    "system.defensePenalty",
    "system.armorCheck"
  ]
};

/** Item types an agent can only hold once; the browser won't add a second copy. */
const UNIQUE = new Set(["origin"]);

function focusEntry(root, uuid) {
  const selected = [...root.querySelectorAll('.browser-list [data-action="select"]')].find(
    control => control.closest("[data-uuid]")?.dataset.uuid === uuid
  );
  if (selected) {
    selected.tabIndex = 0;
    selected.focus({ preventScroll: true });
  }
}

/** Plain text of a stored HTML description (parsed inertly, nothing is loaded or run). */
function plainText(html) {
  if (!html) return "";
  // Separate block elements so adjacent paragraphs do not run together.
  const spaced = String(html).replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "$& ");
  return new DOMParser().parseFromString(spaced, "text/html").body.textContent.replace(/\s+/g, " ").trim();
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
    this.filters = { search: "", group: originType ?? "", qualifiedOnly: false, acquisitionSource: "" };
    /** The entry shown in the preview pane. */
    this.selected = null;
  }

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "browser"],
    position: { width: 900, height: 720 },
    window: { resizable: true },
    actions: {
      select(event, target) {
        const keyboard = event.detail === 0;
        this.selected = target.closest("[data-uuid]")?.dataset.uuid ?? null;
        return this.render().then(() => {
          if (keyboard) focusEntry(this.element, this.selected);
        });
      },
      add: SpycraftBrowser.#onAdd,
      open: SpycraftBrowser.#onOpen
    }
  };

  static PARTS = {
    main: {
      template: "systems/spycraft2/templates/apps/browser.hbs",
      scrollable: [".browser-list", ".browser-preview"]
    }
  };

  get title() {
    return game.i18n.format("SPYCRAFT.Browser.Title", { type: game.i18n.localize(`TYPES.Item.${this.itemType}`) });
  }

  async _prepareContext(options) {
    const packs = [PACKS[this.itemType]]
      .flat()
      .map(id => game.packs.get(id))
      .filter(Boolean);
    const index = (await Promise.all(packs.map(pack => pack.getIndex({ fields: FIELDS[this.itemType] })))).flatMap(
      entries => [...entries]
    );
    const cfg = CONFIG.SPYCRAFT;
    const owned = new Set(this.actor?.items.filter(i => i.type === this.itemType).map(i => i.name.toLowerCase()) ?? []);
    const search = this.filters.search.toLowerCase();

    const freeSources =
      this.itemType === "feat"
        ? (this.actor?.system.featAcquisitionSources ?? []).filter(
            source =>
              !this.actor.items.some(
                item => item.type === "feat" && !item.system.granted && item.system.acquisitionSource === source.id
              )
          )
        : [];
    if (this.filters.acquisitionSource && !freeSources.some(source => source.id === this.filters.acquisitionSource))
      this.filters.acquisitionSource = "";
    const acquisitionSources = Object.fromEntries([
      ["", loc`Career/origin/other feat choice`],
      ...freeSources.map(source => [source.id, source.label])
    ]);
    let groups = {};
    const rows = [];
    for (const e of index) {
      const s = e.system ?? {};
      let group = "",
        groupLabel = "",
        req = null,
        extra = "";
      switch (this.itemType) {
        case "feat":
          group = s.tree;
          groupLabel = cfg.featTrees[s.tree] ?? s.tree;
          req = s.prerequisites;
          break;
        case "class":
          group = s.expert ? "expert" : "base";
          groupLabel = game.i18n.localize(s.expert ? "SPYCRAFT.Class.Expert" : "SPYCRAFT.Class.Base");
          req = s.requirements;
          extra = `d${s.vitalityDie} VP · ${s.skillPoints} SP`;
          break;
        case "origin":
          group = s.originType;
          groupLabel = game.i18n.localize(cfg.originTypes[s.originType]);
          break;
        case "weapon":
          group = s.proficiency;
          groupLabel = cfg.proficiencies[s.proficiency]?.label ?? s.proficiency;
          extra = `${cfg.calibers[s.caliber]} · ${s.damage} · ${s.errorThreat}${s.range ? ` · ${s.range} ft` : ""}`;
          break;
        case "gear":
          if (s.kitGrade) {
            group = `kit:${s.kitType}`;
            groupLabel = loc`Kit — ${s.kitType}`;
            extra = `Grade ${s.kitGrade} · Caliber ${cfg.calibers[s.caliber]} · ${s.kitSize} · ${s.kitNonPortable ? "Non-portable" : s.weight + " lbs."}`;
          } else {
            const upgrade = /^Table 4\.2[89]$/.test(s.sourceTable ?? "");
            group = upgrade ? "vehicleUpgrade" : s.gearCategory || "other";
            groupLabel = upgrade ? loc`Vehicle upgrades` : (cfg.gearPicks[s.gearCategory] ?? loc`Other gear`);
            extra = [
              s.standingOnly
                ? `Reputation/Net Worth${s.standingCost ? ` ${s.standingCost}` : ""}`
                : s.caliber
                  ? `Caliber ${cfg.calibers[s.caliber]}`
                  : "",
              s.powerRating ? `PR ${s.powerRating}` : "",
              s.streetValue
            ]
              .filter(Boolean)
              .join(" · ");
          }
          break;
        case "vehicle": {
          const cls = VEHICLE_RULES.classes.find(c => c.code === s.vehicleClass);
          group = s.vehicleClass;
          groupLabel = cls?.label ?? s.vehicleClass;
          extra = [
            s.standingOnly
              ? `Reputation/Net Worth${s.standingCost ? ` ${s.standingCost}` : ""}`
              : `Caliber ${cfg.calibers[s.caliber]}`,
            s.sizeLabel,
            s.occupancy ? `Occ ${s.occupancy}` : "",
            s.accelerationTurning ? `A/T ${s.accelerationTurning}` : "",
            s.mph ? `${s.mph} MPH` : "",
            s.defenseSave ? `D/S ${s.defenseSave}` : ""
          ]
            .filter(Boolean)
            .join(" · ");
          break;
        }
        case "armor":
          group = String(s.caliber);
          groupLabel = loc`Caliber ${cfg.calibers[s.caliber]}`;
          extra = `DR ${s.damageReduction}/${s.damageReductionSubdual} · Def ${s.defensePenalty} · ACP ${s.armorCheck}`;
          break;
      }
      groups[group] = groupLabel;
      if (this.filters.group && group !== this.filters.group) continue;
      const summary = plainText(s.description);
      if (search && !e.name.toLowerCase().includes(search) && !summary.toLowerCase().includes(search)) continue;
      const check =
        this.actor && (req || this.filters.acquisitionSource)
          ? this.actor.checkPrerequisites(req, {
              classEntry: this.itemType === "class",
              acquisitionSource: this.filters.acquisitionSource,
              featTree: s.tree
            })
          : { ok: true, unmet: [] };
      if (this.filters.qualifiedOnly && !check.ok) continue;
      rows.push({
        uuid: e.uuid,
        id: e._id,
        name: e.name,
        groupLabel,
        extra,
        summary,
        owned: owned.has(e.name.toLowerCase()),
        locked:
          (UNIQUE.has(this.itemType) || (this.itemType === "feat" && !s.repeatable)) && owned.has(e.name.toLowerCase()),
        qualified: check.ok,
        unmet: check.unmet.join("; "),
        prereq: req ? describe(req) : "",
        notChecked: s.prerequisitesNotChecked
      });
    }
    rows.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.name.localeCompare(b.name));
    const chosen = rows.find(row => row.uuid === this.selected) ?? null;
    for (const row of rows) row.selected = row === chosen;
    let preview = null;
    if (chosen) {
      const doc = await fromUuid(chosen.uuid);
      preview = {
        ...chosen,
        img: doc?.img,
        description: await enrich(doc?.system?.description, doc)
      };
    }
    return {
      preview,
      acquisitionSources,
      showAcquisitionSources: this.itemType === "feat" && freeSources.length > 0,
      rows,
      filters: this.filters,
      hasPrereqs: ["feat", "class"].includes(this.itemType),
      groups: Object.fromEntries(Object.entries(groups).sort((a, b) => a[1].localeCompare(b[1]))),
      actor: this.actor,
      missingPack: !packs.length
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    // Typing filters after a short pause; Enter applies a search still waiting on that pause before adding.
    const applySearch = async input => {
      if (this.filters.search === input.value) return;
      this.filters.search = input.value;
      await this.render();
    };
    html.querySelector("[name=search]")?.addEventListener(
      "input",
      foundry.utils.debounce(ev => {
        if (this.filters.search === ev.target.value) return;
        const focused = this.element.ownerDocument.activeElement;
        const selectedUuid = this.element.contains(focused)
          ? focused.closest(".browser-list [data-uuid]")?.dataset.uuid
          : null;
        const restoreSearch = focused === ev.target;
        this.filters.search = ev.target.value;
        this.render().then(() => {
          if (selectedUuid) return focusEntry(this.element, selectedUuid);
          if (!restoreSearch) return;
          const input = this.element.querySelector("[name=search]");
          input?.focus();
          input?.setSelectionRange(input.value.length, input.value.length);
        });
      }, 250)
    );
    // Enter in the search adds the selected entry, or the only one left, without reaching for the mouse.
    html.querySelector("[name=search]")?.addEventListener("keydown", async ev => {
      if (ev.key !== "Enter" || !this.actor) return;
      ev.preventDefault();
      await applySearch(ev.target);
      const rows = [...this.element.querySelectorAll(".browser-list [data-uuid]")];
      const row = rows.find(r => r.dataset.uuid === this.selected) ?? (rows.length === 1 ? rows[0] : null);
      const add = row?.querySelector('[data-action="add"]:not([disabled])');
      if (add) add.click();
      else if (rows.length > 1) ui.notifications.info(loc`Choose an entry first: several match this search.`);
    });
    html.querySelector("[name=acquisitionSource]")?.addEventListener("change", ev => {
      this.filters.acquisitionSource = ev.target.value;
      this.render();
    });
    html.querySelector("[name=group]")?.addEventListener("change", ev => {
      this.filters.group = ev.target.value;
      this.render();
    });
    html.querySelector("[name=qualifiedOnly]")?.addEventListener("change", ev => {
      this.filters.qualifiedOnly = ev.target.checked;
      this.render();
    });
  }

  static async #onAdd(event, target) {
    const doc = await fromUuid(target.closest("[data-uuid]").dataset.uuid);
    if (!doc || !this.actor) return;
    if (
      (UNIQUE.has(doc.type) || (doc.type === "feat" && !doc.system.repeatable)) &&
      this.actor.items.some(i => i.type === doc.type && i.name.toLowerCase() === doc.name.toLowerCase())
    ) {
      return refuse(game.i18n.format(`SPYCRAFT.Browser.Owned.${doc.type}`, { name: doc.name, actor: this.actor.name }));
    }
    if (doc.type === "class") await this.actor.addClassLevel(doc);
    else {
      if (doc.type === "origin") {
        const old = this.actor.items.filter(i => i.type === "origin" && i.system.originType === doc.system.originType);
        if (old.length)
          await this.actor.deleteEmbeddedDocuments(
            "Item",
            old.map(i => i.id)
          );
      }
      const data = doc.toObject();
      delete data._id;
      if (doc.type === "feat") {
        data.system.acquiredAtLevel = Math.max(1, this.actor.system.level ?? 1);
        data.system.acquisitionSource = this.filters.acquisitionSource;
      }
      await this.actor.createEmbeddedDocuments("Item", [data]);
    }
    ui.notifications.info(game.i18n.format("SPYCRAFT.Browser.Added", { name: doc.name, actor: this.actor.name }));
    // A talent or specialty is a single choice, so the browser closes once it is made.
    if (doc.type === "origin") return this.close();
    this.render();
  }

  static async #onOpen(event, target) {
    const doc = await fromUuid(target.closest("[data-uuid]").dataset.uuid);
    doc?.sheet.render(true);
  }
}
