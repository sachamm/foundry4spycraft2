import { loc } from "../i18n.mjs";
import { FEAT_REMINDERS } from "../rules/tables.mjs";
/**
 * World data migrations.
 *
 * The world remembers the schema version its data was last brought to (setting `spycraft2.schemaVersion`).
 * When the system's SCHEMA_VERSION is higher, the active GM's client runs every migration in between, once.
 *
 * To change stored data: raise SCHEMA_VERSION and append an entry to MIGRATIONS.
 *
 *   {
 *     version: 2,
 *     label: "Short description shown to the GC",
 *     actor(source) { … },            // return an update for this actor's source data, or nothing
 *     item(source, parentSource) { … } // the same for an item; parentSource is the owning actor's data, if any
 *   }
 *
 * A migration reads plain source data (document.toObject()) and returns a flat or nested update object. It must be
 * safe to run on data that already has the new shape, because a failed run is retried on the next start.
 */

/** The data schema version this build of the system writes. */
export const SCHEMA_VERSION = 2;

/**
 * Version 2: feats gained `system.reminder`. A feat already on a character or in the world takes the reminder its
 * compendium entry has, unless it has been given one of its own.
 */
export function featReminderUpdate(source, reminders = FEAT_REMINDERS) {
  if (source?.type !== "feat") return null;
  const known = Object.hasOwn(reminders, source.name) ? reminders[source.name] : null;
  if (!known) return null;
  const current = source.system?.reminder;
  if (current?.rolls || current?.text) return null;
  return { "system.reminder": { rolls: known.rolls, text: known.text } };
}

/** Ordered migrations. Version 1 is the first versioned schema, so the list starts at 2. */
export const MIGRATIONS = [{ version: 2, label: loc`feat reminders`, item: source => featReminderUpdate(source) }];

/** Migrations still to run for a world at version `from`, oldest first. */
export function pendingMigrations(from, migrations = MIGRATIONS, to = SCHEMA_VERSION) {
  const current = Number.isSafeInteger(from) && from >= 0 ? from : 0;
  const list = migrations.filter(m => m.version > current && m.version <= to).sort((a, b) => a.version - b.version);
  for (const migration of list) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1) {
      throw new Error(loc`A migration needs a whole-number version of 1 or more.`);
    }
  }
  if (new Set(list.map(m => m.version)).size !== list.length) throw new Error(loc`Two migrations share a version.`);
  return list;
}

const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

/** Apply an update (dotted or nested keys) to a copy of source data, the way a document update would. */
export function applyUpdate(source, update) {
  const result = structuredClone(source);
  const assign = (target, key, value) => {
    const path = key.split(".");
    let node = target;
    for (const part of path.slice(0, -1)) {
      if (!isPlainObject(node[part])) node[part] = {};
      node = node[part];
    }
    const last = path.at(-1);
    if (isPlainObject(value) && isPlainObject(node[last]))
      for (const [k, v] of Object.entries(value)) assign(node[last], k, v);
    else node[last] = structuredClone(value);
  };
  for (const [key, value] of Object.entries(update)) assign(result, key, value);
  return result;
}

/**
 * The combined update one document needs from a list of migrations, or null when none applies.
 * Each migration sees the data as the earlier ones left it.
 * @param {"actor"|"item"} kind
 */
export function documentUpdate(kind, source, parentSource, migrations) {
  let working = source;
  const combined = {};
  for (const migration of migrations) {
    const update = migration[kind]?.(working, parentSource);
    if (update === undefined || update === null) continue;
    if (!isPlainObject(update))
      throw new Error(loc`Migration ${migration.version} returned an invalid ${kind} update.`);
    if (!Object.keys(update).length) continue;
    Object.assign(combined, update);
    working = applyUpdate(working, update);
  }
  return Object.keys(combined).length ? combined : null;
}

/**
 * Bring a world's actors and items up to the current schema version.
 * @param {object} world  { version, actors, items, setVersion(n), notify?(message) } — documents need toObject(),
 *                        update() and, for actors, an `items` collection.
 * @returns {{from: number, to: number, updated: number, failed: number, ran: number[]}}
 */
export async function migrateWorld(world, { migrations = MIGRATIONS, to = SCHEMA_VERSION } = {}) {
  const from = Number.isSafeInteger(world.version) ? world.version : 0;
  const list = pendingMigrations(from, migrations, to);
  const report = { from, to, updated: 0, failed: 0, ran: list.map(m => m.version) };
  if (from >= to) return { ...report, to: from };
  if (list.length) {
    world.notify?.(
      loc`Updating world data for Spycraft 2.0 (${list.map(m => m.label ?? `version ${m.version}`).join("; ")}).`
    );
    const migrate = async (kind, document, parentSource) => {
      try {
        const update = documentUpdate(kind, document.toObject(), parentSource, list);
        if (!update) return;
        await document.update(update, { spycraft2Migration: to });
        report.updated += 1;
      } catch (error) {
        report.failed += 1;
        console.error(loc`Spycraft 2.0 | Could not migrate ${kind} ${document.name ?? document.id}`, error);
      }
    };
    for (const actor of world.actors ?? []) {
      await migrate("actor", actor, null);
      const parentSource = actor.toObject();
      for (const item of actor.items ?? []) await migrate("item", item, parentSource);
    }
    for (const item of world.items ?? []) await migrate("item", item, null);
  }
  // A run with failures keeps the old version, so the same migrations are tried again next time.
  if (!report.failed) await world.setVersion(to);
  else
    world.notify?.(
      loc`${report.failed} document(s) could not be updated; see the console. The update will be retried.`
    );
  return report;
}

/** Every actor that holds its own data: world actors and the synthetic actors of unlinked tokens. */
function worldActors(game) {
  const actors = [...(game.actors ?? [])];
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) if (!token.actorLink && token.actor) actors.push(token.actor);
  }
  return actors;
}

/** Register the version setting. Call during `init`. */
export function registerMigrationSettings() {
  game.settings.register("spycraft2", "schemaVersion", { scope: "world", config: false, type: Number, default: 0 });
}

/** Run pending migrations. Call during `ready`; only the active GM's client does the work. */
export async function runWorldMigrations() {
  if (!game.users?.activeGM?.isSelf) return null;
  const stored = game.settings.get("spycraft2", "schemaVersion");
  if (stored >= SCHEMA_VERSION) return null;
  return migrateWorld({
    version: stored,
    actors: worldActors(game),
    items: [...(game.items ?? [])],
    setVersion: version => game.settings.set("spycraft2", "schemaVersion", version),
    notify: message => ui.notifications?.info(message)
  });
}
