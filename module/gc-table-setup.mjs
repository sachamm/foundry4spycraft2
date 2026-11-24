import { isLeadGM } from "./writers.mjs";
import { loc } from "./i18n.mjs";
import { systemDialog } from "./apps/dialog-theme.mjs";
import { GC_TABLE_CATALOG } from "./data/gc-table-catalog.mjs";
const SYSTEM = "spycraft2";
const PACK = "spycraft2.gc-tables";
const SETTING = "gcTableSetup";
let pending;

export function registerGCTableSetup() {
  game.settings.register(SYSTEM, SETTING, { scope: "world", config: false, type: Object, default: {} });
}

const sourceUuid = id => `Compendium.${PACK}.RollTable.${id}`;
const sourceMatches = (table, entry) =>
  table.getFlag(SYSTEM, "gcTable") === entry.key ||
  table._stats?.compendiumSource === sourceUuid(entry.id) ||
  table.getFlag("core", "sourceId") === sourceUuid(entry.id);

/** Remember each delivered source separately: new releases add tables, and deliberate deletions stay deleted. */
export async function setupGCTables() {
  if (!isLeadGM()) return;
  if (pending) return pending;
  pending = importMissingTables();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}

async function importMissingTables() {
  try {
    const saved = game.settings.get(SYSTEM, SETTING) ?? {};
    const installed = new Set(Array.isArray(saved.installed) ? saved.installed : []);
    const missing = GC_TABLE_CATALOG.filter(entry => !installed.has(entry.key));
    if (!missing.length) return { created: 0 };
    const pack = game.packs.get(PACK);
    if (!pack || pack.documentName !== "RollTable") throw Error(loc`GC Tables compendium is unavailable.`);
    const documents = await pack.getDocuments();
    for (const entry of missing)
      if (!documents.some(doc => doc.id === entry.id)) throw Error(loc`GC Tables compendium is incomplete.`);
    let folder,
      created = 0;
    for (const entry of missing) {
      if (!game.tables.some(table => sourceMatches(table, entry))) {
        folder ??= game.folders.find(f => f.type === "RollTable" && f.getFlag(SYSTEM, "gcTables"));
        folder ??= game.folders.find(f => f.type === "RollTable" && f.name === "GC Tables" && !f.folder);
        folder ??= await globalThis.Folder.create({
          name: "GC Tables",
          type: "RollTable",
          flags: { spycraft2: { gcTables: true } }
        });
        const data = documents.find(doc => doc.id === entry.id).toObject();
        delete data._id;
        data.folder = folder.id;
        data.ownership = { default: 0 };
        data.flags = { ...data.flags, spycraft2: { ...data.flags?.spycraft2, gcTable: entry.key } };
        data._stats = { ...data._stats, compendiumSource: sourceUuid(entry.id) };
        await globalThis.RollTable.create(data);
        created++;
      }
      installed.add(entry.key);
      await game.settings.set(SYSTEM, SETTING, { installed: [...installed] });
    }
    if (created) ui.notifications.info(loc`${created} GC tables added to the Rollable Tables tab.`);
    return { created };
  } catch (error) {
    console.error("Field Agent's Handbook | GC table setup failed", error);
    ui.notifications.warn(
      loc`GC table setup could not finish. Missing tables will retry the next time the GC opens the world.`
    );
    return { error };
  }
}

/** Only the marked injury table needs input. Native draw, drawMany, chat and compendium behavior stay available. */
export function inputRollTableClass(Base) {
  return class SpycraftRollTable extends Base {
    async roll(options = {}) {
      if (this.getFlag(SYSTEM, "rollInput") !== "criticalInjury" || options.roll) return super.roll(options);
      const input = await systemDialog.input({
        window: { title: loc`The Table of Ouch` },
        rejectClose: false,
        content: `<div class="spycraft2-roll-options"><p>${loc`Use after a valid critical-injury trigger. This draw posts the result without changing an actor. For tracked injuries, use the actor's injury workflow.`}</p><label>${loc`Damage suffered`} <input name="damage" type="number" min="0" step="1" required /></label><label>${loc`Injury die`} <select name="die"><option value="20">${loc`Normal: d20`}</option><option value="10">${loc`Guts applies: d10`}</option></select></label></div>`
      });
      // The v14 sheet reads roll.total even with no results. Zero is outside this table and uses no RNG.
      if (!input) return { roll: await new Roll("0").evaluate(), results: [] };
      const damage = input.damage === "" || input.damage == null ? NaN : Number(input.damage);
      const die = Number(input.die);
      if (
        !Number.isSafeInteger(damage) ||
        damage < 0 ||
        damage > Number.MAX_SAFE_INTEGER - 20 ||
        ![10, 20].includes(die)
      )
        throw Error(loc`Enter nonnegative whole damage and choose the actual injury die.`);
      return super.roll({ ...options, roll: new Roll(`1d${die} + @damage`, { damage }) });
    }
  };
}
