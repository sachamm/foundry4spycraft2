/**
 * Turns src/data/*.json into compendium documents and the generated rules modules, in memory.
 * tools/build-packs.mjs writes the result to disk; the engine fixture check reads the documents directly.
 */
import { applyCompendiumIcons } from "./compendium-icons.mjs";
import { buildNpcPackages } from "./npc-packages.mjs";
import { buildNpcTemplates } from "./npc-templates.mjs";
import { firearmDefaults } from "../../module/rules/firearms.mjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { weaponRanges } from "../../module/rules/gear.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @returns {{packs: object, generated: Record<string, string>, system: object}} */
export function buildPacks() {
  const generated = {};
  const read = f => JSON.parse(readFileSync(join(ROOT, "src/data", f), "utf8"));
  const core = read("core.json");
  const npcRules = read("npcs.json");
  generated["module/rules/npc-tables.mjs"] =
    `// GENERATED from src/data/npcs.json by tools/build-packs.mjs.\nexport const NPC_RULES = ${JSON.stringify(npcRules, null, 1)};\n`;
  // Game Control data: hand-kept core numbers plus the transcribed conflict, campaign-quality and mission tables.
  const gcData = {
    core: read("gc-core.json"),
    tables: read("gc-tables.json"),
    conflicts: read("conflicts.json"),
    campaignQualities: read("campaign-qualities.json")
  };
  generated["module/rules/gc-tables.mjs"] =
    `// GENERATED from src/data/gc-core.json, gc-tables.json, conflicts.json and campaign-qualities.json by tools/build-packs.mjs.\nexport const GC_DATA = ${JSON.stringify(gcData, null, 1)};\n`;
  const classes = read("classes.json");
  const origins = read("origins.json");
  const feats = read("feats.json");
  const equipment = read("equipment.json");
  const kits = read("kits.json");
  const ammunition = read("ammunition.json");
  const summaries = read("summaries.json");
  const featReminders = read("feat-reminders.json").feats;
  for (const name of Object.keys(featReminders))
    if (!feats.some(f => f.name === name)) throw new Error(`feat-reminders.json names an unknown feat: ${name}`);
  const gear = read("gear.json");
  const vehicles = read("vehicles.json");
  const upgrades = read("upgrades.json");
  const gearSummaries = read("gear-summaries.json").summaries;
  const contagions = read("contagions.json");
  const system = JSON.parse(readFileSync(join(ROOT, "system.json"), "utf8"));

  const camel = s => {
    const parts = s
      .replace(/[^A-Za-z ]/g, " ")
      .trim()
      .split(/\s+/);
    return (
      parts[0].toLowerCase() +
      parts
        .slice(1)
        .map(p => p[0].toUpperCase() + p.slice(1).toLowerCase())
        .join("")
    );
  };
  const id = (...parts) =>
    createHash("sha1")
      .update(parts.join("|"))
      .digest("base64")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 16);
  const esc = s =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const p = s => (s ? `<p>${esc(s)}</p>` : "");
  const SOURCE = "Spycraft 2.0 (summary)";
  const missing = [];

  /** Loose key for matching table ability names ("Behind the scenes II (DC 20)") to summary keys ("Behind the Scenes"). */
  const loose = s =>
    String(s)
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[“”"'’]/g, "")
      .replace(/\b(i{1,3}|iv|v)\b/g, " ")
      .replace(/[+x×]?\s*\d+(d\d+)?(\/(session|mission|scene))?/g, " ")
      .replace(/[^a-z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  /** Find the summary for a name: exact loose match, prefix match, then small edit distance. */
  function lookupSummary(map, name) {
    const k = loose(name);
    const entries = Object.entries(map).map(([n, v]) => [loose(n), v]);
    let hit = entries.find(([n]) => n === k) ?? entries.find(([n]) => k.startsWith(n) || n.startsWith(k));
    if (!hit) {
      const best = entries.map(e => [lev(e[0], k), e]).sort((a, b) => a[0] - b[0])[0];
      if (best && best[0] <= Math.max(2, Math.floor(k.length / 5))) hit = best[1];
    }
    if (process.env.DEBUG_MATCH && hit && hit[0] !== k) console.log(`  match: "${k}" -> "${hit[0]}"`);
    return hit?.[1] ?? null;
  }

  /* ------------------------------------------------------------------ */
  /*  Rules tables module                                                */
  /* ------------------------------------------------------------------ */
  const tablesSrc = `// GENERATED by tools/build-packs.mjs from src/data (core, ammunition, gear, vehicles) — do not edit by hand.
export const SKILLS = ${JSON.stringify(
    core.skills.map(({ row, ...s }) => s),
    null,
    1
  )};
export const TABLES = ${JSON.stringify({ ...core.tables, ammunitionCatalog: ammunition }, null, 1)};
export const CLASS_FEATURES = ${JSON.stringify(Object.fromEntries(classes.filter(c => !c.expert).map(c => [c.key, { name: c.name, classSkills: c.classSkills, choiceLists: c.choiceLists.map(list => ({ ...list, options: list.options.map(option => ({ ...option, description: option.description ?? summaries.classes[c.name]?.options?.[option.name] ?? "" })) })) }])), null, 1)};
export const GEAR_RULES = ${JSON.stringify({ categories: gear.categories, damageSaves: gear.damageSaves, housings: gear.housings, skillUses: gear.skillUses }, null, 1)};
export const CONTAGIONS = ${JSON.stringify(contagions.contagions, null, 1)};
export const FEAT_REMINDERS = ${JSON.stringify(Object.fromEntries(Object.entries(featReminders).map(([name, rolls]) => [name, { rolls: rolls.join(", "), text: summaries.feats[name] ?? "" }])), null, 1)};
export const VEHICLE_RULES = ${JSON.stringify({ classes: vehicles.classes, damageLocations: vehicles.damageLocations, damagePage: vehicles.damagePage, damageSavePage: vehicles.damageSavePage, tractionSaveBonus: vehicles.tractionSaveBonus, tractionSaveBonusHouseRule: vehicles.tractionSaveBonusHouseRule, qualities: vehicles.qualities, qualitiesPage: vehicles.qualitiesPage, bailOutDC: vehicles.bailOutDC, explosions: vehicles.explosions, accelerationDistance: vehicles.accelerationDistance, signature: vehicles.signature, hazards: vehicles.hazards, smash: vehicles.smash }, null, 1)};
`;
  generated["module/rules/tables.mjs"] = tablesSrc;

  /* ------------------------------------------------------------------ */
  /*  Compendium documents                                               */
  /* ------------------------------------------------------------------ */
  const stats = { coreVersion: system.compatibility.verified, systemId: "spycraft2", systemVersion: system.version };
  function item(pack, name, type, img, sys, folder = null, sort = 0) {
    return {
      _id: id(pack, type, name),
      name,
      type,
      img,
      system: sys,
      effects: [],
      folder,
      sort,
      ownership: { default: 0 },
      // Feats are recognised by name: keep the English name where a rename or translation cannot reach it.
      flags: type === "feat" ? { spycraft2: { ruleName: name } } : {},
      _stats: stats
    };
  }
  function folder(pack, name, sort = 0) {
    return {
      _id: id(pack, "folder", name),
      name,
      type: "Item",
      folder: null,
      sorting: "a",
      sort,
      color: null,
      flags: {},
      _stats: stats
    };
  }

  const PROF = Object.fromEntries(core.tables.proficiencies.map(n => [n.toLowerCase(), camel(n)]));
  const PENALTY = {
    unarmed: -2,
    blunt: -2,
    exoticBlunt: -6,
    edged: -4,
    exoticEdged: -8,
    hurled: -2,
    exoticHurled: -6,
    handgun: -4,
    rifle: -4,
    shotgun: -4,
    submachineGun: -4,
    tactical: -8,
    explosives: -8,
    guided: -10,
    indirectFire: -12,
    vehicleWeapon: 0
  };
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

  const packs = {};

  // Classes
  packs.classes = {
    label: "Classes",
    folders: [folder("classes", "Base Classes", 1), folder("classes", "Expert Classes", 2)],
    docs: []
  };
  for (const c of classes) {
    const sum = summaries.classes[c.name] ?? { core: "", abilities: {}, options: {} };
    if (!summaries.classes[c.name]) missing.push(`class ${c.name}`);
    const coreText = sum.core.replace(/^[^:]+:\s*/, "");
    const abilities = (c.abilities ?? []).map(a => {
      // Split "A, B. C" into components, but not inside quotes ("Any time, any place").
      const parts =
        String(a.name)
          .match(/(?:"[^"]*"|“[^”]*”|\d[,.]\d|[^,.])+/g)
          ?.map(x => x.trim())
          .filter(x => loose(x)) ?? [];
      const text = parts
        .map(part => {
          const t = lookupSummary(sum.abilities, part);
          if (!t) missing.push(`${c.name} ${a.level}: ${part}`);
          return t ? (parts.length > 1 ? `${part.trim()}: ${t}` : t) : "";
        })
        .filter(Boolean)
        .join(" ");
      return { level: a.level, name: a.name, description: text };
    });
    const desc = [
      `<p><strong>Core Ability — ${esc(c.coreAbility.name)}:</strong> ${esc(coreText)}</p>`,
      `<p><strong>Skill points:</strong> ${c.skillPoints} + Int modifier per level (×4 at Career Level 1). <strong>Vitality:</strong> ${c.vitality} + Con modifier per level.</p>`
    ].join("");
    packs.classes.docs.push(
      item(
        "classes",
        c.name,
        "class",
        c.expert ? "icons/svg/upgrade.svg" : "icons/svg/book.svg",
        {
          description: desc,
          source: SOURCE,
          identifier: c.key,
          expert: c.expert,
          skillPoints: c.skillPoints,
          vitalityDie: c.vitality,
          proficiencies: c.proficiencies,
          coreAbility: { name: c.coreAbility.name, description: coreText },
          classSkills: c.classSkills,
          table: c.table,
          abilities,
          choiceLists: c.choiceLists.map(L => ({
            key: L.key,
            name: L.name,
            kind: L.kind,
            options: L.options.map(o => {
              const tree = Object.keys(summaries.feats).length && feats.some(f => f.tree === o.name) ? o.name : null;
              const d =
                lookupSummary(sum.options, o.name) ??
                (tree ? `Gain a${/^[AEIOU]/.test(tree) ? "n" : ""} ${tree} feat.` : null) ??
                { Contact: "Gain a new associate-grade contact.", "Gear Feat": "Gain a Gear feat." }[o.name] ??
                lookupSummary(sum.abilities, o.name);
              if (d === null) missing.push(`${c.name} option ${o.name}`);
              return { ...o, description: o.description ?? d ?? "" };
            })
          })),
          choiceSchedule: c.choiceSchedule ?? [],
          choices: {},
          bonuses: (c.bonuses ?? []).map(b => ({ level: 0, ...b })),
          featGrants: c.featGrants ?? [],
          requirements: c.requirements ?? null
        },
        packs.classes.folders[c.expert ? 1 : 0]._id,
        c.num
      )
    );
  }

  // Origins
  packs.origins = {
    label: "Origins",
    folders: [folder("origins", "Talents", 1), folder("origins", "Specialties", 2)],
    docs: []
  };
  for (const [list, fi] of [
    [origins.talents, 0],
    [origins.specialties, 1]
  ]) {
    for (const o of list) {
      packs.origins.docs.push(
        item(
          "origins",
          o.name,
          "origin",
          fi ? "icons/svg/mystery-man.svg" : "icons/svg/aura.svg",
          {
            description: p(summaries.origins[o.name] ?? (missing.push(`origin ${o.name}`), "")),
            source: SOURCE,
            originType: o.originType,
            bonuses: o.bonuses.map(b => ({ level: 0, ...b })),
            grants: o.grants.map(g => g.feat)
          },
          packs.origins.folders[fi]._id,
          o.num
        )
      );
    }
  }

  // Feats
  const trees = [...new Set(feats.map(f => f.tree))].sort();
  packs.feats = { label: "Feats", folders: trees.map((t, i) => folder("feats", t, i)), docs: [] };
  const featFolder = Object.fromEntries(trees.map((t, i) => [t, packs.feats.folders[i]._id]));
  for (const f of feats) {
    packs.feats.docs.push(
      item(
        "feats",
        f.name,
        "feat",
        "icons/svg/combat.svg",
        {
          description: p(summaries.feats[f.name] ?? (missing.push(`feat ${f.name}`), "")),
          source: SOURCE,
          tree: camel(f.tree),
          prerequisites: f.prerequisites,
          prerequisitesNotChecked: f.notChecked,
          ranks: 1,
          granted: false,
          grantSource: "",
          repeatable: f.repeatable ?? false,
          maxSelections: f.maxSelections ?? 0,
          reminder: featReminders[f.name]
            ? { rolls: featReminders[f.name].join(", "), text: summaries.feats[f.name] ?? "" }
            : { rolls: "", text: "" },
          bonuses: f.bonuses.map(b => ({ level: 0, ...b }))
        },
        featFolder[f.tree],
        f.row
      )
    );
  }

  // Weapons
  const wprofs = [...new Set(equipment.weapons.map(w => w.proficiency))];
  packs.weapons = { label: "Weapons", folders: wprofs.map((n, i) => folder("weapons", n, i)), docs: [] };
  for (const w of equipment.weapons) {
    const prof = PROF[w.proficiency.toLowerCase()] ?? camel(w.proficiency);
    const { error, threat } = weaponRanges(w);
    packs.weapons.docs.push(
      item(
        "weapons",
        w.name,
        "weapon",
        "icons/svg/sword.svg",
        {
          description: p(w.rulesNote),
          source: `Spycraft 2.0 p.${w.sourcePage}`,
          quantity: w.ammunitionOnly ? 1 : (w.bundleSize ?? 1),
          pickCount: 1,
          bundleSize: w.bundleSize ?? 1,
          equipped: false,
          carried: true,
          weight: (Number(w.weight) || 0) * (w.ammunitionOnly ? (w.stockpileSize ?? 1) : 1),
          gearCategory: "W",
          caliber: w.ammunitionOnly ? 0 : (ROMAN[w.caliber] ?? 1),
          pick: "",
          reserve: false,
          common: false,
          proficiency: prof,
          ammunitionOnly: !!w.ammunitionOnly,
          ammunitionKind: w.ammunitionKind ?? "",
          explosiveAmmunition: !!w.explosiveAmmunition,
          stockpileSize: w.stockpileSize ?? 0,
          shotWeight: w.ammunitionOnly ? Number(w.weight) || 0 : 0,
          upgradeCost: w.upgradeCost ?? 0,
          upgradeAllowance: w.upgradeAllowance ?? null,
          commonItemCost: w.commonItemCost ?? 0,
          noStrengthDamage: !!w.noStrengthDamage,
          attackAbility: w.attackAbility ?? "",
          damage: String(w.damage ?? ""),
          error,
          threat,
          errorThreat: String(w.errorThreat ?? ""),
          ...firearmDefaults(w.sourceTable, w.qualities),
          ...(w.fireModes ? { fireModes: w.fireModes } : {}),
          mountRequirement: w.mountRequirement ?? "",
          assemblyHalfActions: w.assemblyHalfActions ?? 0,
          ammo: String(w.ammo ?? ""),
          ammoCodeOptions: w.ammoCodeOptions ?? [],
          ammoChamber: w.ammoChamber ?? "",
          recoil: Number(w.recoil) || 0,
          range: Number(w.range) || 0,
          maxRangeIncrements: w.maxRangeIncrements ?? 0,
          sizeHands: String(w.sizeHands ?? ""),
          qualities: String(w.qualities ?? ""),
          untrainedPenalty: w.untrainedPenalty ?? PENALTY[prof] ?? -4
        },
        packs.weapons.folders[wprofs.indexOf(w.proficiency)]._id,
        w.num
      )
    );
    if (w.legacyName) {
      packs.weapons.docs.at(-1)._id = id("weapons", "weapon", w.legacyName);
      packs.weapons.docs.at(-1).flags.spycraft2 = { legacyName: w.legacyName };
    }
  }

  // Armor
  packs.armor = { label: "Armor", folders: [], docs: [] };
  for (const a of equipment.armor) {
    const [dr = 0, drSub = 0] = String(a.dr ?? "0/0")
      .split("/")
      .map(n => parseInt(n) || 0);
    packs.armor.docs.push(
      item(
        "armor",
        a.name,
        "armor",
        "icons/svg/shield.svg",
        {
          description: "",
          source: `Spycraft 2.0 p.${a.sourcePage}`,
          quantity: 1,
          equipped: false,
          carried: true,
          weight: Number(a.weight) || 0,
          armorType: a.armorType,
          armorSlot: a.armorSlot,
          sealed: a.sealed,
          visionPenalty: a.visionPenalty,
          gearCategory: "S",
          caliber: ROMAN[a.caliber] ?? 0,
          pick: "",
          reserve: false,
          common: false,
          damageReduction: dr,
          damageReductionSubdual: drSub,
          resistances: String(a.resist ?? ""),
          defensePenalty: Number(a.defensePenalty) || 0,
          armorCheck: Number(a.acp) || 0,
          speedPenalty: Number(a.speed) || 0,
          notice: String(a.notice ?? "")
        },
        null,
        a.num
      )
    );
  }

  if (missing.length)
    console.warn(
      `No summary for ${missing.length} entr${missing.length === 1 ? "y" : "ies"}:\n  ${missing.join("\n  ")}`
    );

  // Kits: any matching-Caliber gear pick category may buy one (p.213).
  packs.kits = { label: "Kits", folders: [], docs: [] };
  for (const kit of kits)
    packs.kits.docs.push(
      item("kits", kit.name, "gear", "icons/svg/tool.svg", {
        description:
          p(kit.contents) +
          p(
            `Grade ${kit.grade}: supplies the corresponding Gear tag requirements.${kit.grade >= 2 ? " +1 gear bonus." : ""}${kit.grade === 3 ? " Result cap +5." : ""}${kit.nonPortable ? " Non-portable: choose a location before use." : ""}`
          ),
        source: `Spycraft 2.0 p.${kit.sourcePage}`,
        quantity: 1,
        caliber: kit.grade,
        weight: kit.weight ?? 0,
        carried: !kit.nonPortable,
        equipped: false,
        pick: "",
        gearCategory: "",
        common: false,
        reserve: false,
        kitType: kit.kitType,
        kitGrade: kit.grade,
        kitSize: kit.size,
        kitNonPortable: kit.nonPortable,
        kitLocation: ""
      })
    );

  // Gear picks other than weapons and armor (Tables 4.9–4.12, 4.15, 4.66). Table values only; rules stay in the book.
  const pageNote = (table, page, descriptionsPage, row) =>
    p(`Table ${table}, p.${page}.${descriptionsPage ? ` Rules for this entry start on p.${descriptionsPage}.` : ""}`) +
    (row.optionOf ? p(`An option for ${row.optionOf}.`) : "");
  /** The footnote dictionary for a table: gear (4.9–4.15), vehicles (4.16–4.27) or vehicle upgrades (4.28–4.29). */
  const footnotesFor = table => {
    const n = Number(String(table).split(".")[1]);
    return n === 70
      ? contagions.footnotes
      : n >= 60 || n === 14
        ? upgrades.footnotes
        : n >= 28
          ? vehicles.upgradeFootnotes
          : n >= 16
            ? vehicles.footnotes
            : gear.footnotes;
  };
  /** Footnote codes on a row, turned into their short labels. */
  const footnoteLabels = (row, ...dictionaries) =>
    (row.notes ?? []).map(code => {
      const label = dictionaries.map(d => d?.[code]).find(Boolean);
      if (!label) throw new Error(`No footnote label for "${code}" on ${row.name}`);
      return label;
    });
  /** Give repeated table names a distinguishing suffix so every pack entry has its own name and id. */
  function uniqueNames(rows, qualifier) {
    const count = new Map(),
      seen = new Map();
    for (const r of rows) count.set(r.name, (count.get(r.name) ?? 0) + 1);
    return rows.map(r => {
      let name = count.get(r.name) > 1 ? `${r.name} (${qualifier(r)})` : r.name;
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      if (n > 1) name = `${name} #${n}`;
      return name;
    });
  }
  const caliberLabel = r => (r.caliber ? `Caliber ${r.caliber}` : "Reputation/Net Worth");
  const gearBase = (row, category) => ({
    source: `Spycraft 2.0 p.${row.sourcePage}`,
    quantity: row.bundleSize ?? 1,
    bundleSize: row.bundleSize ?? 1,
    pickCount: 1,
    caliber: ROMAN[row.caliber] ?? 0,
    weight: Number(row.weight) || 0,
    carried: true,
    equipped: false,
    pick: "",
    gearCategory: category,
    common: false,
    reserve: false,
    optionOf: row.optionOf ?? "",
    sourceTable: `Table ${row.sourceTable}`,
    noted: !!row.noted,
    footnotes: footnoteLabels(row, footnotesFor(row.sourceTable)),
    bundled: row.bundled ?? "",
    perTeamMember: (row.notes ?? []).includes("teamIssue")
  });
  /** Our one-line summary for a gear row; every row must have one. */
  const gearSummary = row => {
    const text = gearSummaries[row.name];
    if (!text) throw new Error(`No gear summary for ${row.name}`);
    return text;
  };
  const GEAR_LISTS = [
    ["electronics", "E"],
    ["gadgets", "G"],
    ["resources", "R"],
    ["security", "S"],
    ["tradecraft", "T"]
  ];
  packs.gear = {
    label: "Gear",
    folders: [
      ...GEAR_LISTS.map(([, c], i) => folder("gear", gear.categories[c].label, i)),
      folder("gear", "Gadget Housings", GEAR_LISTS.length)
    ],
    docs: []
  };
  GEAR_LISTS.forEach(([list, category], folderIndex) => {
    const rows = gear[list],
      info = gear.categories[category],
      names = uniqueNames(rows, caliberLabel);
    rows.forEach((row, i) => {
      const stats = row.weightLabel ? [{ label: "Weight", value: row.weightLabel }] : [];
      packs.gear.docs.push(
        item(
          "gear",
          names[i],
          "gear",
          "icons/svg/item-bag.svg",
          {
            ...gearBase(row, category),
            description: p(gearSummary(row)) + pageNote(info.table, row.sourcePage, info.descriptionsPage, row),
            powerRating: row.powerRating ?? "",
            resultCap: row.resultCap ?? "",
            effectRange: row.range ?? "",
            sizeHands: row.sizeHands ?? "",
            battery: row.battery ?? "",
            damageSave: row.damageSave ?? null,
            complexity: row.complexity ?? "",
            year: row.year ?? "",
            streetValue: row.streetValue ?? "",
            restricted: !!row.restricted,
            standingCost: row.standingCost ?? "",
            standingOnly: row.standingOnly ?? !row.caliber,
            stats
          },
          packs.gear.folders[folderIndex]._id,
          i
        )
      );
    });
  });
  gear.housings.forEach((h, i) =>
    packs.gear.docs.push(
      item(
        "gear",
        `Gadget housing, ${h.size}`,
        "gear",
        "icons/svg/item-bag.svg",
        {
          ...gearBase({ sourcePage: h.sourcePage, sourceTable: "4.66" }, "G"),
          description: p(`Table 4.66, p.${h.sourcePage}. A housing size for gadget mechanisms.`),
          damageSave: h.damageSave,
          stats: [
            { label: "Maximum mechanisms", value: String(h.maxMechanisms) },
            { label: "Knowledge DC", value: String(h.knowledgeDC) }
          ]
        },
        packs.gear.folders.at(-1)._id,
        i
      )
    )
  );

  // Vehicles (Tables 4.16–4.27), one folder per vehicle category.
  packs.vehicles = {
    label: "Vehicles",
    folders: vehicles.classes.map((c, i) => folder("vehicles", c.label, i)),
    docs: []
  };
  {
    const names = uniqueNames(vehicles.vehicles, caliberLabel);
    vehicles.vehicles.forEach((v, i) => {
      const cls = vehicles.classes.findIndex(c => c.code === v.vehicleClass);
      packs.vehicles.docs.push(
        item(
          "vehicles",
          names[i],
          "vehicle",
          "icons/svg/wing.svg",
          {
            ...gearBase(v, "V"),
            description: pageNote(v.sourceTable, v.sourcePage, 289, v),
            vehicleClass: v.vehicleClass,
            size: v.size,
            footprint: v.footprint,
            sizeLabel: v.sizeLabel,
            occupancy: v.occupancy,
            crew: v.crew,
            passengers: v.passengers,
            accelerationTurning: v.accelerationTurning,
            acceleration: v.acceleration,
            turning: v.turning,
            mph: v.mph,
            cruiseMph: v.cruiseMph,
            topMph: v.topMph,
            defenseSave: v.defenseSave,
            defense: v.defense,
            damageSave: v.damageSave,
            upgrades: v.upgrades,
            complexity: v.complexity,
            cargo: v.cargo,
            rangeFuel: v.rangeFuel,
            qualities: v.qualities,
            year: v.year,
            streetValue: v.streetValue,
            restricted: !!v.restricted,
            standingCost: v.standingCost,
            standingOnly: !!v.standingOnly
          },
          packs.vehicles.folders[cls]._id,
          i
        )
      );
    });
  }

  // Vehicle upgrades and vehicle weapons (Tables 4.28–4.29): reference entries that cost upgrades, not picks.
  {
    const groups = [...new Set(vehicles.upgrades.map(u => u.group))];
    packs["vehicle-upgrades"] = {
      label: "Vehicle Upgrades",
      folders: [
        ...groups.map((g, i) => folder("vehicle-upgrades", g, i)),
        folder("vehicle-upgrades", "Vehicle Weapons", groups.length)
      ],
      docs: []
    };
    const pack = packs["vehicle-upgrades"],
      stat = (label, value) => (value ? [{ label, value: String(value) }] : []);
    uniqueNames(vehicles.upgrades, u => u.group).forEach((name, i) => {
      const u = vehicles.upgrades[i];
      pack.docs.push(
        item(
          "vehicle-upgrades",
          name,
          "gear",
          "icons/svg/upgrade.svg",
          {
            ...gearBase(u, "V"),
            description: pageNote(u.sourceTable, u.sourcePage, 296, u),
            stats: [
              ...stat("Upgrade cost", u.cost),
              ...[
                ["Ground", u.ground],
                ["Air", u.air],
                ["Water", u.water]
              ].flatMap(([label, t]) => [
                ...stat(`${label}: street value`, t.streetValue),
                ...stat(`${label}: install time`, t.time),
                ...stat(`${label}: Complexity`, t.complexity)
              ])
            ]
          },
          pack.folders[groups.indexOf(u.group)]._id,
          i
        )
      );
    });
    // Vehicle weapons (Table 4.29) are rollable weapons: one per weapon, or one per ammunition type where it lists some.
    const WEAPON_FAMILY = [
      [/^Artillery|^Cannon|^Rocket launcher/, { proficiency: "vehicleWeapon", ability: "dex", untrained: -12 }],
      [/^Bomb/, { proficiency: "indirectFire", ability: "int", untrained: -14 }],
      [/^Missile launcher|^Torpedo/, { proficiency: "guided", ability: "int", untrained: -14 }],
      [/^Grenade launcher/, { proficiency: "vehicleWeapon", ability: "dex", untrained: -6 }],
      [/^(Flamethrower|Gatling gun|Machine gun)/, { proficiency: "vehicleWeapon", ability: "dex", untrained: -8 }]
    ];
    const family = name =>
      WEAPON_FAMILY.find(([re]) => re.test(name))?.[1] ?? {
        proficiency: "vehicleWeapon",
        ability: "dex",
        untrained: -8
      };
    const rangeFeet = text => {
      const m = /([\d.,]+)\s*(ft|mile)/.exec(String(text));
      return m ? Number(m[1].replaceAll(",", "")) * (m[2] === "mile" ? 5280 : 1) : 0;
    };
    const rows = [];
    for (const w of vehicles.weapons.filter(w => !w.optionOf)) {
      const options = vehicles.weapons.filter(o => o.optionOf === w.name);
      if (!options.length) rows.push({ w, o: null, name: w.name });
      for (const o of options) rows.push({ w, o, name: `${w.name} (${o.name.split(": ").slice(1).join(": ")})` });
    }
    rows.forEach(({ w, o, name }, i) => {
      const f = family(w.name),
        damage = o?.damage || w.damage,
        errorThreat = o?.errorThreat || w.errorThreat;
      const { error, threat } = weaponRanges({ errorThreat });
      pack.docs.push(
        item(
          "vehicle-upgrades",
          name,
          "weapon",
          "icons/svg/target.svg",
          {
            ...gearBase(w, "V"),
            description:
              pageNote(w.sourceTable, w.sourcePage, 297, w) +
              (o ? p(`Ammunition: ${o.name.split(": ").slice(1).join(": ")}.`) : ""),
            footnotes: [
              ...footnoteLabels(w, vehicles.upgradeFootnotes),
              ...(o ? footnoteLabels(o, vehicles.upgradeFootnotes) : [])
            ],
            complexity: w.complexity,
            year: w.year,
            streetValue: w.streetValue,
            restricted: !!w.restricted,
            proficiency: f.proficiency,
            attackAbility: f.ability,
            untrainedPenalty: f.untrained,
            damage: String(damage ?? ""),
            errorThreat: String(errorThreat ?? ""),
            error,
            threat,
            ammo: String(w.ammo ?? ""),
            range: rangeFeet(w.range),
            qualities: [w.qualities, o?.qualities].filter(q => q && q !== "—").join(", "),
            weaponCategory: "vehicle",
            fireModes: [],
            equipped: false,
            maxRangeIncrements: 10,
            stats: [
              ...stat("Upgrade cost", w.cost),
              ...stat("Range", w.range),
              ...stat("Install time", w.time),
              ...(o
                ? [...stat("Ammunition upgrade cost", o.cost), ...stat("Ammunition street value", o.streetValue)]
                : [])
            ]
          },
          pack.folders.at(-1)._id,
          i
        )
      );
    });
  }

  // Armor and weapon upgrades and explosive detonators (Tables 4.14, 4.60, 4.61): reference entries with their table values.
  {
    const stat = (label, value) => (value ? [{ label, value: String(value) }] : []);
    const groups = [
      "Armor and Protective Gear Upgrades",
      ...new Set(upgrades.weapons.map(w => `${w.group}`)),
      "Explosive Detonators"
    ];
    const pack = (packs["equipment-upgrades"] = {
      label: "Equipment Upgrades",
      folders: groups.map((g, i) => folder("equipment-upgrades", g, i)),
      docs: []
    });
    const folderOf = g => pack.folders[groups.indexOf(g)]._id;
    upgrades.armor.forEach((u, i) =>
      pack.docs.push(
        item(
          "equipment-upgrades",
          u.name,
          "gear",
          "icons/svg/shield.svg",
          {
            ...gearBase(u, "S"),
            description: pageNote("4.14", u.sourcePage, 285, u),
            weight: parseFloat(u.weight) || 0,
            complexity: u.complexity,
            year: u.year,
            streetValue: u.streetValue,
            footnotes: [...(u.dr ? [upgrades.armorDRNote] : []), ...footnoteLabels(u, upgrades.footnotes)],
            stats: [
              ...stat("Upgrade cost", u.cost),
              ...stat("DR", u.dr),
              ...stat("Resistances", u.resistances),
              ...stat("Defense penalty", u.defensePenalty),
              ...stat("ACP", u.acp),
              ...stat("Speed", u.speed),
              ...stat("Notice/Search DC", u.noticeDC),
              ...stat("Weight", u.weight)
            ]
          },
          folderOf(groups[0]),
          i
        )
      )
    );
    uniqueNames(upgrades.weapons, w => w.group.replace(/ Upgrades$/, "").toLowerCase()).forEach((name, i) => {
      const u = upgrades.weapons[i];
      pack.docs.push(
        item(
          "equipment-upgrades",
          name,
          "gear",
          "icons/svg/upgrade.svg",
          {
            ...gearBase(u, "W"),
            description: pageNote("4.60", u.sourcePage, 315, u),
            weight: parseFloat(u.weight) || 0,
            complexity: u.complexity,
            streetValue: u.streetValue,
            restricted: /^R\$/.test(u.streetValue),
            stats: [
              ...stat("Available for", u.availableFor),
              ...stat("Location", u.location),
              ...stat("Upgrade cost", u.cost),
              ...stat("Install time", u.time),
              ...stat("Weight", u.weight)
            ]
          },
          folderOf(u.group),
          i
        )
      );
    });
    upgrades.detonators.forEach((d, i) =>
      pack.docs.push(
        item(
          "equipment-upgrades",
          d.name,
          "gear",
          "icons/svg/explosion.svg",
          {
            ...gearBase(d, "W"),
            description: pageNote("4.61", d.sourcePage, 312, d),
            weight: parseFloat(d.weight) || 0,
            complexity: d.complexity,
            year: d.year,
            streetValue: d.streetValue,
            restricted: d.restricted,
            sizeHands: d.sizeHands,
            stats: [
              ...stat("Upgrade cost", d.cost),
              ...stat("Damage", d.damage),
              ...stat("Error/Threat", d.errorThreat),
              ...stat("Qualities", d.qualities),
              ...stat("Weight", d.weight)
            ]
          },
          folderOf("Explosive Detonators"),
          i
        )
      )
    );
  }

  // Contagions (Table 4.70): diseases and poisons as reference entries; nothing applies them to a character yet.
  {
    const kinds = {
      disease: "Diseases",
      basic: "Basic Poisons",
      improved: "Improved Poisons",
      advanced: "Advanced Poisons"
    };
    const pack = (packs.contagions = {
      label: "Contagions",
      folders: Object.values(kinds).map((k, i) => folder("contagions", k, i)),
      docs: []
    });
    uniqueNames(contagions.contagions, c => c.grade || c.kind).forEach((name, i) => {
      const c = contagions.contagions[i],
        phase = (label, ph) => [
          { label: `${label}: onset`, value: ph.onset },
          { label: `${label}: Fortitude DC`, value: String(ph.saveDC) },
          { label: `${label}: damage/effect`, value: ph.effect }
        ];
      pack.docs.push(
        item(
          "contagions",
          name,
          "gear",
          c.kind === "disease" ? "icons/svg/biohazard.svg" : "icons/svg/poison.svg",
          {
            ...gearBase({ ...c, caliber: "" }, ""),
            description: p(
              `Table 4.70, p.${c.sourcePage}. ${c.kind === "disease" ? "Disease" : `${c.grade[0].toUpperCase()}${c.grade.slice(1)} poison`}.`
            ),
            complexity: c.complexity,
            standingOnly: false,
            stats: [...phase("Primary", c.primary), ...phase("Secondary", c.secondary)]
          },
          pack.folders[Object.keys(kinds).indexOf(c.kind === "disease" ? "disease" : c.grade)]._id,
          i
        )
      );
    });
  }

  // Native random tables retain their printed dice distributions and use original result summaries.
  packs["gc-tables"] = { label: "GC Tables", type: "RollTable", collection: "tables", folders: [], docs: [] };
  const ruleTables = read("rollable-tables.json").tables;
  const rollTables = [...gcData.tables.rollTables, ...ruleTables];
  for (const table of rollTables) {
    const tableId = id("gc-tables", table.id);
    const results = table.results.map((r, i) => ({
      _id: id("gc-tables", table.id, String(i)),
      type: "text",
      name: "",
      description: p(r.text),
      img: "icons/svg/d20-black.svg",
      weight: r.weight ?? r.range[1] - r.range[0] + 1,
      range: r.range,
      drawn: false,
      flags: {},
      _stats: stats
    }));
    packs["gc-tables"].docs.push({
      _id: tableId,
      name: table.name,
      img: "icons/svg/d20-grey.svg",
      description: p(`${table.source}, p.${table.page}. Roll ${table.formula}. ${table.notes ?? ""}`),
      formula: table.formula,
      replacement: true,
      displayRoll: true,
      results: results.map(r => r._id),
      embedded: { results },
      folder: null,
      sort: 0,
      ownership: { default: 0 },
      flags: { spycraft2: { gcTable: table.id, ...(table.rollInput ? { rollInput: table.rollInput } : {}) } },
      _stats: stats
    });
  }
  generated["module/data/gc-table-catalog.mjs"] =
    `// GENERATED by tools/build-packs.mjs. Stable identities used by world table setup.\nexport const GC_TABLE_CATALOG = ${JSON.stringify(
      rollTables.map(table => ({ id: id("gc-tables", table.id), key: table.id, name: table.name })),
      null,
      2
    )};\n`;

  // Sample scenes contain environment assets only; actor documents and tokens are intentionally absent.
  packs["sample-scenes"] = { label: "Sample Scenes", type: "Scene", collection: "scenes", folders: [], docs: [] };
  for (const slug of ["warehouse-breach", "night-infiltration", "embassy-reception"]) {
    const scene = JSON.parse(readFileSync(join(ROOT, "src/scenes", `${slug}.json`), "utf8"));
    const embedded = {};
    for (const key of ["levels", "walls", "lights", "tokens", "drawings", "tiles", "notes", "sounds", "regions"]) {
      embedded[key] = scene[key] ?? [];
      scene[key] = embedded[key].map(d => d._id);
    }
    packs["sample-scenes"].docs.push({ ...scene, _stats: stats, embedded });
  }

  const soundtrack = read("soundtrack.json");
  const sounds = soundtrack.sounds;
  packs.soundtrack = {
    label: "Soundtrack",
    type: "Playlist",
    collection: "playlists",
    folders: [],
    docs: [{ ...soundtrack, sounds: sounds.map(sound => sound._id), _stats: stats, embedded: { sounds } }]
  };

  const iconData = read("compendium-icons.json");
  applyCompendiumIcons(packs, iconData);

  const npcOptions = {
    iconData,
    id,
    stats,
    skillKeys: new Set(core.skills.map(skill => skill.key)),
    commonCatalog: read("npc-common-items.json").items,
    ammoCatalog: ammunition
  };
  const npcTemplates = read("npc-templates.json");
  packs["core-npcs"] = buildNpcTemplates(npcTemplates, packs, npcOptions);
  const npcPackages = buildNpcPackages(read("npc-packages.json"), npcTemplates, packs, npcOptions);
  generated["module/data/npc-packages.json"] = JSON.stringify(npcPackages) + "\n";

  return { packs, generated, system };
}
