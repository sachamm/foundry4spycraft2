import { refuse } from "../error-notices.mjs";
import { enrich } from "../sheets/enrich.mjs";
import { describe } from "../rules/prerequisites.mjs";
import { VEHICLE_RULES } from "../rules/tables.mjs";
import { loc } from "../i18n.mjs";
import { availableIn, historicalCaliber } from "../rules/gear-era.mjs";
import { campaignRules } from "../rules/campaign-rules.mjs";
import { clockYear } from "./game-clock.mjs";

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
    "system.sourceTable",
    "system.year",
    "system.restricted"
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
    "system.standingCost",
    "system.year",
    "system.restricted"
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
    "system.qualities",
    "system.year"
  ],
  armor: [
    "system.caliber",
    "system.damageReduction",
    "system.damageReductionSubdual",
    "system.defensePenalty",
    "system.armorCheck",
    "system.year"
  ]
};

/** Item types filtered by the game clock's year, Caliber and (where the tables mark it) restriction. */
const DATED = new Set(["gear", "weapon", "armor", "vehicle"]);
const RESTRICTABLE = new Set(["gear", "vehicle"]);

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

/** One line on what the game clock's year is doing to the list. */
function eraStatus(year, later, showFuture) {
  if (!Number.isSafeInteger(year)) return loc`Set a date on the game clock to hide gear that did not exist yet.`;
  if (!later) return loc`Everything listed was available by ${year}.`;
  if (showFuture)
    return later === 1
      ? loc`1 item marked "Not yet" came out after ${year}.`
      : loc`${later} items marked "Not yet" came out after ${year}.`;
  return later === 1
    ? loc`1 item that came out after ${year} is hidden.`
    : loc`${later} items that came out after ${year} are hidden.`;
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
    // With a character open, start with what that character may take; the box is one click from the full list.
    this.filters = {
      search: "",
      group: originType ?? "",
      qualifiedOnly: !!actor,
      acquisitionSource: "",
      showFuture: false,
      caliber: "",
      restricted: ""
    };
    /** The entry shown in the preview pane. */
    this.selected = null;
    /** Plain-text descriptions by uuid: parsing each one is the costly part of building the list. */
    this.summaries = new Map();
  }

  static DEFAULT_OPTIONS = {
    classes: ["spycraft2", "browser"],
    position: { width: 900, height: 720 },
    window: { resizable: true },
    actions: {
      select(event, target) {
        const keyboard = event.detail === 0;
        this.selected = target.closest("[data-uuid]")?.dataset.uuid ?? null;
        return this.renderResults().then(() => {
          if (keyboard) focusEntry(this.element, this.selected);
        });
      },
      add: SpycraftBrowser.#onAdd,
      open: SpycraftBrowser.#onOpen
    }
  };

  // Two parts, so that searching, filtering and choosing a row redraw the results and leave the search box, with
  // the text and caret in it, alone.
  static PARTS = {
    filters: { template: "systems/spycraft2/templates/apps/browser-filters.hbs" },
    results: {
      template: "systems/spycraft2/templates/apps/browser-results.hbs",
      scrollable: [".browser-list", ".browser-preview"]
    }
  };

  /** Redraw the list and the preview only. */
  renderResults() {
    return this.render({ parts: ["results"] });
  }

  /** The game clock's date changed: gear newer than its year comes and goes. */
  refreshForClock() {
    if (DATED.has(this.itemType)) return this.renderResults();
  }

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
    const dated = DATED.has(this.itemType),
      year = dated ? clockYear() : null,
      effects = campaignRules(),
      caliber = Number(this.filters.caliber) || 0;
    let later = 0;

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
      // Historical (p.407): an item newer than the year is still on offer, as a gadget one Caliber higher (never past V).
      const era = dated ? historicalCaliber(s, { effects, year }) : { caliber: Number(s.caliber), gadget: false };
      if (this.filters.group && group !== this.filters.group) continue;
      if (caliber && (era.caliber ?? Number(s.caliber)) !== caliber) continue;
      if (this.filters.restricted === "hide" && s.restricted) continue;
      if (this.filters.restricted === "only" && !s.restricted) continue;
      const future = dated && !availableIn(s.year, year) && !(era.gadget && era.available);
      if (future) later += 1;
      if (future && !this.filters.showFuture) continue;
      if (dated && s.year) extra = extra ? loc`${extra} · from ${s.year}` : loc`From ${s.year}`;
      const gadget = era.gadget && era.available ? loc`Gadget, Caliber ${cfg.calibers[era.caliber]}` : "";
      let summary = this.summaries.get(e.uuid);
      if (summary === undefined) this.summaries.set(e.uuid, (summary = plainText(s.description)));
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
        notChecked: s.prerequisitesNotChecked,
        future,
        gadget
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
      missingPack: !packs.length,
      dated,
      restrictable: RESTRICTABLE.has(this.itemType),
      calibers: Object.fromEntries([1, 2, 3, 4, 5].map(n => [String(n), loc`Caliber ${cfg.calibers[n]}`])),
      restrictedOptions: { hide: loc`Hide restricted`, only: loc`Restricted only` },
      era: dated ? eraStatus(year, later, this.filters.showFuture) : "",
      // With no date on the clock nothing is newer than it, so the box could change nothing.
      futureReason: dated && !Number.isSafeInteger(year) ? loc`Set a date on the game clock first.` : ""
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    // Only the results part is redrawn on a search or a clock change, so keep the future-gear box in step here.
    const future = html.querySelector("[name=showFuture]");
    if (future) {
      future.disabled = Boolean(context.futureReason);
      if (context.futureReason) future.closest("label").dataset.tooltip = context.futureReason;
      else delete future.closest("label").dataset.tooltip;
    }
    // The filter controls are drawn once and keep their listeners; only a full draw replaces them.
    const search = html.querySelector("[name=search]");
    if (!search || search.dataset.sc2Wired) return;
    search.dataset.sc2Wired = "true";
    // Typing filters after a short pause; Enter applies a search still waiting on that pause before adding.
    const applySearch = async input => {
      if (this.filters.search === input.value) return;
      this.filters.search = input.value;
      await this.renderResults();
    };
    search.addEventListener(
      "input",
      foundry.utils.debounce(ev => {
        if (this.filters.search === ev.target.value) return;
        const focused = this.element.ownerDocument.activeElement;
        const selectedUuid = this.element.contains(focused)
          ? focused.closest(".browser-list [data-uuid]")?.dataset.uuid
          : null;
        this.filters.search = ev.target.value;
        // The search box is not redrawn, so only focus that was on a list entry needs putting back.
        this.renderResults().then(() => {
          if (selectedUuid) focusEntry(this.element, selectedUuid);
        });
      }, 250)
    );
    // Enter in the search adds the selected entry, or the only one left, without reaching for the mouse.
    search.addEventListener("keydown", async ev => {
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
      this.renderResults();
    });
    html.querySelector("[name=group]")?.addEventListener("change", ev => {
      this.filters.group = ev.target.value;
      this.renderResults();
    });
    html.querySelector("[name=qualifiedOnly]")?.addEventListener("change", ev => {
      this.filters.qualifiedOnly = ev.target.checked;
      this.renderResults();
    });
    html.querySelector("[name=showFuture]")?.addEventListener("change", ev => {
      this.filters.showFuture = ev.target.checked;
      this.renderResults();
    });
    for (const key of ["caliber", "restricted"])
      html.querySelector(`[name=${key}]`)?.addEventListener("change", ev => {
        this.filters[key] = ev.target.value;
        this.renderResults();
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
