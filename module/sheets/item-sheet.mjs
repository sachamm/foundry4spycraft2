import { CANDIDATE_CHOICES, candidatePlan } from "../rules/candidate.mjs";
import { reviewCandidate } from "../apps/candidate.mjs";
import { historicalFeatEligibility } from "../rules/feat-acquisition.mjs";
import { CONTACT_FEATS } from "../rules/contact-feats.mjs";
import { armorTrainingAdjustments } from "../rules/armor-training.mjs";
import { planAmmunitionStockpile } from "../apps/ammunition-planner.mjs";
import { ammunitionConfiguration, compatibleAmmunition } from "../rules/ammunition.mjs";
import { FIRE_MODES, FIREARM_CATEGORIES, weaponFireModes } from "../rules/firearms.mjs";
import { equipmentCategory, armorSlot } from "../rules/gear.mjs";
import { describe as describePrereq } from "../rules/prerequisites.mjs";
import { humanizeTemplate, renderTemplate } from "../rules/formula.mjs";
import { VEHICLE_RULES } from "../rules/tables.mjs";
import { breakState, vehicleClass } from "../rules/vehicles.mjs";
import { deployVehicle, objectSize, rollObjectDamageSave } from "../apps/vehicle-play.mjs";
import {
  issueToTeam,
  chargeStandingCost,
  refundStandingCost,
  useBattery,
  rechargeItem,
  addMechanism,
  removeMechanism,
  rollGadgetSkillCheck,
  repairItem,
  signalCheck
} from "../apps/gear-play.mjs";
import { batteryState, gadgetState, repairPlan } from "../rules/gear-play-rules.mjs";
import { parseStandingCost } from "../rules/standing.mjs";
import { qualityReference } from "../rules/vehicle-play-rules.mjs";
import { loc } from "../i18n.mjs";

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
      reviewCandidate() {
        return reviewCandidate(this.item);
      },
      planAmmunition() {
        return planAmmunitionStockpile(this.item);
      },
      addBonus: SpycraftItemSheet.#onAddBonus,
      removeBonus: SpycraftItemSheet.#onRemoveBonus,
      toChat: SpycraftItemSheet.#onToChat,
      damageSave() {
        return rollObjectDamageSave(this.item);
      },
      deployVehicle() {
        return deployVehicle(this.item);
      },
      issueToTeam() {
        return issueToTeam(this.item);
      },
      chargeStanding() {
        return chargeStandingCost(this.item);
      },
      refundStanding() {
        return refundStandingCost(this.item);
      },
      useBattery() {
        return useBattery(this.item);
      },
      recharge() {
        return rechargeItem(this.item);
      },
      repair() {
        return repairItem(this.item);
      },
      signal() {
        return signalCheck(this.item);
      },
      removeMechanism(event, target) {
        return removeMechanism(this.item, Number(target.dataset.index));
      },
      gadgetSkill(event, target) {
        return rollGadgetSkillCheck(this.item, Number(target.dataset.index));
      }
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

  _onRender(context, options) {
    super._onRender?.(context, options);
    const zone = this.element.querySelector(".gadget-drop");
    if (!zone || !this.isEditable) return;
    zone.addEventListener("dragover", event => event.preventDefault());
    zone.addEventListener("drop", async event => {
      event.preventDefault();
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if (data?.type !== "Item") return;
      const mechanism = await fromUuid(data.uuid);
      if (mechanism) await addMechanism(this.item, mechanism);
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const sys = item.system;
    const cfg = CONFIG.SPYCRAFT;
    Object.assign(context, {
      item,
      system: sys,
      config: cfg,
      editable: this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
        secrets: item.isOwner,
        relativeTo: item
      }),
      bonuses: (sys.bonuses ?? []).map((b, i) => ({ ...b, index: i, label: cfg.bonusTargets[b.target] ?? b.target })),
      bonusTargets: cfg.bonusTargets,
      featTrees: cfg.featTrees,
      proficiencies: Object.fromEntries(Object.entries(cfg.proficiencies).map(([k, v]) => [k, v.label])),
      calibers: cfg.calibers,
      canPlanAmmunition: compatibleAmmunition(sys, cfg.tables?.ammunitionCatalog ?? []).length > 0,
      ammunitionConfiguration: ammunitionConfiguration(sys),
      ammunitionCodeOptions: Object.fromEntries(
        ammunitionConfiguration(sys).options.map(option => [option.code, option.label])
      ),
      hasCollapsibleStock: /\bCLS\b/.test(sys.qualities ?? ""),
      firearmCategories: {
        other: "Other / not a firearm",
        ...Object.fromEntries(Object.entries(FIREARM_CATEGORIES).map(([key, value]) => [key, value.label]))
      },
      fireModeOptions: Object.fromEntries(
        weaponFireModes({ ...sys }, item.parent?.system ?? {}).map(key => [key, FIRE_MODES[key] ?? key])
      ),
      usesProjectiles: item.type === "weapon" && /as (arrow|bolt)/i.test(sys.damage ?? ""),
      ammunitionOptions: Object.fromEntries([
        ["", "Choose ammunition…"],
        ...(item.parent?.items
          ?.filter(
            i =>
              i.type === "weapon" && (i.system.ammunitionOnly || ["Standard arrow", "Explosive arrow"].includes(i.name))
          )
          .map(i => [i.id, `${i.name} (${i.system.ammunitionKind || "arrow"})`]) ?? [])
      ]),
      meleeFamilies: {
        "": "Unclassified / no family bonus",
        axe: "Axe",
        spear: "Spear",
        whip: "Whip",
        staff: "Staff",
        hammer: "Hammer",
        twoHandedSword: "Two-handed sword",
        oneHandedSword: "One-handed sword",
        polearm: "Polearm",
        flail: "Flail",
        knife: "Knife"
      },
      gripOptions: { 0: "Normal required grip", 1: "One hand", 2: "Both hands" },
      pickOptions: Object.fromEntries([
        ["", "—"],
        ...Object.entries(cfg.gearPicks).map(([k, v]) => [k, `${k} — ${v}`])
      ]),
      originTypes: Object.fromEntries(Object.entries(cfg.originTypes).map(([k, v]) => [k, game.i18n.localize(v)]))
    });

    if (sys.ammunitionOnly) {
      context.calibers = { ...cfg.calibers, 0: loc`Ammunition stockpile (no Caliber pick)` };
      context.pickOptions = { "": loc`— (upgrade/Common Item stockpile)` };
      if (sys.pick) context.pickOptions[sys.pick] = `${sys.pick} — review legacy ammunition pick`;
    }
    if (sys.fireMode && !Object.hasOwn(context.fireModeOptions, sys.fireMode))
      context.fireModeOptions[sys.fireMode] = loc`Unavailable mode — review choice`;
    if (sys.loadedAmmoId && !Object.hasOwn(context.ammunitionOptions, sys.loadedAmmoId))
      context.ammunitionOptions[sys.loadedAmmoId] = loc`Missing ammunition — review link`;
    if (["weapon", "armor", "gear"].includes(item.type)) {
      const category = equipmentCategory(item);
      if (category)
        context.pickOptions = Object.fromEntries(
          Object.entries(context.pickOptions).filter(([key]) => !key || key === "CHA" || key === category)
        );
      if (sys.pick && !Object.hasOwn(context.pickOptions, sys.pick))
        context.pickOptions[sys.pick] = `${sys.pick} — review category`;
    }
    if (item.type === "armor" && item.actor) {
      const adjusted = armorTrainingAdjustments(item, item.actor.system.armorTraining, armorSlot(item));
      if (adjusted.applies) context.armorTraining = adjusted;
    }
    if (item.type === "feat") {
      context.acquisitionSources = Object.fromEntries([
        ["", "Career/origin/other feat choice"],
        ...(item.actor?.system.featAcquisitionSources ?? []).map(source => [source.id, source.label])
      ]);
      context.trainingSkills =
        item.name === "Training"
          ? Object.entries(cfg.skills).map(([key, value]) => ({
              key,
              name: value.name,
              points: sys.trainingSkills?.[key] ?? 0
            }))
          : null;
      const basicChoices = Object.keys(cfg.tables.basicSkillFeats ?? {});
      if (item.actor?.system.classLevels?.virtuoso) basicChoices.push("Field of Expertise");
      const choiceLists = {
        Candidate: CANDIDATE_CHOICES,
        "Armor Basics": { P: "Partial", M: "Moderate", F: "Full" },
        "Armor Mastery": { P: "Partial", M: "Moderate", F: "Full" },
        "Extra Gear": {
          E: "Electronics",
          G: "Gadgets",
          R: "Resources",
          S: "Security",
          T: "Tradecraft",
          V: "Vehicles",
          W: "Weapons"
        },
        "Weapon Focus": Object.fromEntries(
          Object.entries(cfg.proficiencies)
            .filter(([key]) => key !== "unarmed")
            .map(([key, v]) => [key, v.label])
        ),
        "Martial Arts": cfg.abilities,
        "Unlocked Potential": Object.fromEntries(Object.entries(cfg.skills).map(([key, v]) => [key, v.name]))
      };
      for (const name of [
        "Advanced Skill Mastery",
        "Grand Skill Mastery",
        "Perfect Skill Mastery",
        "Talented",
        "False Start",
        "Mark of a Professional",
        "Practice Makes Perfect"
      ])
        choiceLists[name] = Object.fromEntries(basicChoices.map(name => [name, name]));
      context.choiceOptions = choiceLists[item.name];
      if (item.name === "Candidate") {
        context.candidateBasis = sys.candidateBasis;
        context.canReviewCandidate = item.isOwner && game.user?.isGM && item.parent?.type === "agent";
        try {
          candidatePlan(item.parent?.system ?? {}, item);
        } catch (error) {
          context.candidateReview = error.message;
        }
      }
      if (Object.hasOwn(CONTACT_FEATS, item.name)) {
        context.contactFeatTheme = CONTACT_FEATS[item.name];
        const names = (item.actor?.system.contacts ?? []).map(c => c.name).filter(n => n?.trim());
        if (names.length) {
          context.choiceOptions = Object.fromEntries(names.map(n => [n, n]));
          if (sys.choice && !Object.hasOwn(context.choiceOptions, sys.choice))
            context.choiceOptions[sys.choice] = sys.choice + " — review contact";
        }
      }
      if (
        ["Armor Basics", "Armor Mastery"].includes(item.name) &&
        sys.choice &&
        !Object.hasOwn(context.choiceOptions, sys.choice)
      )
        context.choiceOptions = {
          ...context.choiceOptions,
          [sys.choice]: sys.choice + loc` — existing choice; review its type`
        };
      context.historicalReview = !!item.actor && (!sys.acquisitionCheck?.ok || !historicalFeatEligibility(sys).ok);
      context.featKinds = { permanent: "Permanent", temporary: "Temporary", virtual: "Virtual" };
      context.prereqText = describePrereq(sys.prerequisites) || "—";
      context.prereqJSON = sys.prerequisites ? JSON.stringify(sys.prerequisites, null, 1) : "";
      if (item.actor?.type === "agent") context.status = item.actor.system.featStatus?.[item.id];
    }
    if (item.type === "class") {
      context.classSkills = sys.classSkills.map(k => cfg.skills[k]?.name ?? k).join(", ");
      context.requirementsText = describePrereq(sys.requirements);
      context.lists = (sys.choiceLists ?? []).map(L => ({
        ...L,
        levels: sys.choiceSchedule
          .filter(s => s.list === L.key)
          .map(s => s.level)
          .join(", ")
      }));
      const rd = item.actor?.type === "agent" ? item.actor.getRollData() : null;
      context.abilities = (sys.abilities ?? []).map(a => ({
        ...a,
        text: rd ? renderTemplate(a.description, rd) : humanizeTemplate(a.description)
      }));
      context.grants = (sys.featGrants ?? []).map(g => `${g.feat} (${g.level})`).join(", ");
      context.levelBonuses = (sys.bonuses ?? [])
        .map(b => `${cfg.bonusTargets[b.target] ?? b.target} ${b.value}${b.level ? ` @ ${b.level}` : ""}`)
        .join("; ");
    }
    if (item.type === "origin") context.grantsText = (sys.grants ?? []).join(", ");
    // Gear table values, vehicle statistics and Damage save state.
    if (["gear", "vehicle"].includes(item.type)) {
      const size = objectSize(item);
      context.hasGearStats =
        [
          "powerRating",
          "resultCap",
          "effectRange",
          "sizeHands",
          "battery",
          "complexity",
          "year",
          "streetValue",
          "standingCost"
        ].some(key => sys[key]) ||
        sys.damageSave !== null ||
        sys.stats.length > 0;
      context.hasDamageSave = Number.isSafeInteger(sys.damageSave);
      context.breakState = breakState(size, sys.failedSaves ?? 0);
      const standingCost = parseStandingCost(sys.standingCost),
        standingCharge = item.getFlag("spycraft2", "standingCharge");
      context.standing =
        standingCost && item.parent
          ? {
              cost: standingCost,
              netWorthLabel: `$${standingCost.netWorth.toLocaleString("en-US")}`,
              charge: standingCharge,
              canCharge: item.parent.isOwner && !standingCharge,
              canRefund: game.user.isGM && !!standingCharge
            }
          : null;
      // Battery life, gadget housing, repairs and signals (pp.223–224, 276–281).
      const battery = batteryState(sys.battery, sys.charge);
      context.battery = battery
        ? {
            ...battery,
            remainingLabel: Math.round(battery.remaining * 100) / 100,
            unit: battery.kind === "time" ? "hours" : "uses"
          }
        : null;
      context.gadget =
        item.type === "gear"
          ? {
              ...gadgetState(
                { housingSize: sys.gadget?.housingSize || "", mechanisms: sys.gadget?.mechanisms ?? [] },
                { itemDamageSave: sys.damageSave }
              ),
              mechanisms: (sys.gadget?.mechanisms ?? []).map((m, index) => ({
                ...m,
                index,
                skillCheck: /^Skill check/.test(m.name)
              })),
              canHouse: !(sys.gearCategory === "G" && !/^Gadget housing/.test(item.name))
            }
          : null;
      context.housingOptions = {
        "": "—",
        N: "Nuisance",
        F: "Fine",
        D: "Diminutive",
        T: "Tiny",
        S: "Small",
        M: "Medium",
        L: "Large",
        H: "Huge",
        G: "Gargantuan",
        C: "Colossal",
        E: "Enormous",
        V: "Vast"
      };
      const repair = repairPlan(item);
      context.repair = repair.possible && item.parent ? repair : null;
      context.hasSignal = Number(sys.powerRating) > 0 && !!sys.effectRange && sys.gearCategory === "E";
      context.canIssueTeam =
        game.user.isGM && !!item.parent && sys.perTeamMember && !item.getFlag("spycraft2", "issuedFrom");
    }
    if (item.type === "vehicle") {
      context.vehicleClassOptions = {
        "": "—",
        ...Object.fromEntries(VEHICLE_RULES.classes.map(c => [c.code, c.label]))
      };
      context.vehicleClassInfo = vehicleClass(sys.vehicleClass);
      context.vehicleQualities = qualityReference(sys.qualities);
      context.pickOptions = Object.fromEntries(
        Object.entries(context.pickOptions).filter(([key]) => !key || key === "V" || key === "CHA")
      );
    }
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
      flat["system.grants"] = String(flat.grantsText)
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      delete flat.grantsText;
    }
    if ("prereqJSON" in flat) {
      const txt = String(flat.prereqJSON).trim();
      try {
        flat["system.prerequisites"] = txt ? JSON.parse(txt) : null;
      } catch {
        ui.notifications.error(game.i18n.localize("SPYCRAFT.Feat.BadPrereqJSON"));
      }
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

  static #onToChat() {
    return this.item.toChat();
  }
}
