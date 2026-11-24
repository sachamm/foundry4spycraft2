import { loc } from "../i18n.mjs";
import { FEAT_REMINDERS } from "../rules/tables.mjs";
import { companionRetargets, deltaIsEmpty, isPersonalCharacter } from "../rules/token-delta.mjs";
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
 *
 * Schema version each release writes, so a world from any of them is brought forward by the migrations above it:
 * 0.4.0 → 1, 0.5.x → 2, 0.6.0 → 3, 0.7.0 → 5. Add the new release here when SCHEMA_VERSION changes
 * (tools/test-migrations.mjs checks the list).
 */

/** The data schema version this build of the system writes. */
export const SCHEMA_VERSION = 5;

/** The schema version each published release wrote (see above). */
export const RELEASE_SCHEMAS = Object.freeze({ "0.4.0": 1, "0.5.0": 2, "0.5.2": 2, "0.6.0": 3, "0.7.0": 5 });

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

/**
 * Version 3: agent tokens see. Earlier agents were created with token vision off, which left their players with a
 * black map on any scene that uses token vision.
 */
export function agentSightUpdate(source) {
  if (source?.type !== "agent" || source.prototypeToken?.sight?.enabled === true) return null;
  return { "prototypeToken.sight.enabled": true };
}

/** The same for an agent's token already placed on a scene. `actorSource` is the token's actor data. */
export function agentTokenSightUpdate(source, actorSource) {
  if (actorSource?.type !== "agent" || source?.sight?.enabled === true) return null;
  return { "sight.enabled": true };
}

/**
 * Version 4: the combat tracker skips defeated combatants. Foundry leaves this off, so a downed character still took
 * a turn every round. It is turned on once; a GC who wants it off can turn it off again in the tracker's settings.
 * @param {{settings?: {get: Function, set: Function}}} world
 */
export async function skipDefeatedByDefault(world) {
  const settings = world?.settings;
  if (!settings) return;
  const key = globalThis.Combat?.CONFIG_SETTING ?? "combatTrackerConfig";
  const current = settings.get("core", key) ?? {};
  if (current.skipDefeated === true) return;
  await settings.set("core", key, { ...current, skipDefeated: true });
}

/**
 * Version 5: an agent's token is linked to the agent, and so is an agent's companion's. Agents made before this default had unlinked tokens, so a player
 * who opened the sheet from the token changed only that token's copy and the character in the Actors list never got
 * the change. Future tokens come from the prototype token, which is linked here.
 */
export function agentLinkUpdate(source, _parentSource, { synthetic = false } = {}) {
  // An unlinked token's own copy of the agent has no prototype token to change.
  if (synthetic || !isPersonalCharacter(source) || source.prototypeToken?.actorLink === true) return null;
  return { "prototypeToken.actorLink": true };
}

/**
 * The same for an agent's token already on a scene, when the token holds no changes of its own. A token that does is
 * left for the GC's link review (module/apps/token-links.mjs), which copies its changes to the character first.
 * `actorSource` is the token's base character.
 */
export function agentTokenLinkUpdate(source, actorSource) {
  if (!isPersonalCharacter(actorSource) || source?.actorLink === true) return null;
  if (!deltaIsEmpty(source?.delta, actorSource)) return null;
  return { actorLink: true };
}

/**
 * Also version 5: a companion created from an unlinked agent token's sheet names that token's copy as its owner. Once
 * the token is linked the companion is pointed at the agent itself, so it stays on the agent's sheet.
 * @param {{actors?: Iterable, scenes?: Iterable}} world
 */
export async function retargetTokenCompanions(world) {
  const scenes = new Map([...(world?.scenes ?? [])].map(scene => [scene.id, scene]));
  const linked = (sceneId, tokenId) => scenes.get(sceneId)?.tokens?.get?.(tokenId)?.actorLink === true;
  const actors = [...(world?.actors ?? [])].filter(actor => !actor.isToken);
  for (const { actor, update } of companionRetargets(actors, linked)) await actor.update(update);
}

/** Ordered migrations. Version 1 is the first versioned schema, so the list starts at 2. */
export const MIGRATIONS = [
  { version: 2, label: loc`feat reminders`, item: source => featReminderUpdate(source) },
  { version: 3, label: loc`agent token vision`, actor: agentSightUpdate, token: agentTokenSightUpdate },
  { version: 4, label: loc`skip defeated combatants`, world: skipDefeatedByDefault },
  {
    version: 5,
    label: loc`agent tokens linked to their characters`,
    actor: agentLinkUpdate,
    token: agentTokenLinkUpdate,
    world: retargetTokenCompanions
  }
];

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
 * @param {"actor"|"item"|"token"} kind
 * @param {{synthetic?: boolean}} [context]  `synthetic` is true for the own copy of an actor an unlinked token holds
 */
export function documentUpdate(kind, source, parentSource, migrations, context = {}) {
  let working = source;
  const combined = {};
  for (const migration of migrations) {
    const update = migration[kind]?.(working, parentSource, context);
    if (update === undefined || update === null) continue;
    if (!isPlainObject(update))
      throw new Error(loc`Migration ${migration.version} returned an invalid ${kind} update.`);
    if (!Object.keys(update).length) continue;
    Object.assign(combined, update);
    working = applyUpdate(working, update);
  }
  return Object.keys(combined).length ? combined : null;
}

let migrating = false;
/** True while this client is writing a migration, so reconcilers can wait for it to finish instead of reacting. */
export const worldMigrating = () => migrating;

/**
 * Bring a world's actors and items up to the current schema version.
 * @param {object} world  { version, actors, items, tokens?, setVersion(n), notify?(message), progress?(done, total) }
 *                        — documents need toObject(), update() and, for actors, an `items` collection; an actor
 *                        with updateEmbeddedDocuments() has its items written in one request.
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
    const options = { spycraft2Migration: to };
    const failed = (kind, document, error) => {
      report.failed += 1;
      console.error(loc`Spycraft 2.0 | Could not migrate ${kind} ${document.name ?? document.id}`, error);
    };
    const migrate = async (kind, document, parentSource) => {
      try {
        const update = documentUpdate(kind, document.toObject(), parentSource, list, {
          synthetic: document.isToken === true
        });
        if (!update) return;
        await document.update(update, options);
        report.updated += 1;
      } catch (error) {
        failed(kind, document, error);
      }
    };
    // An actor's items go in one request. If that request fails, each item is tried alone, so one bad item never
    // holds back the others and the count of failures stays exact.
    const migrateItems = async actor => {
      const parentSource = actor.toObject();
      const items = [...(actor.items ?? [])];
      if (typeof actor.updateEmbeddedDocuments !== "function" || items.length < 2) {
        for (const item of items) await migrate("item", item, parentSource);
        return;
      }
      const updates = [];
      for (const item of items) {
        try {
          const update = documentUpdate("item", item.toObject(), parentSource, list);
          if (update) updates.push({ item, update });
        } catch (error) {
          failed("item", item, error);
        }
      }
      if (!updates.length) return;
      try {
        await actor.updateEmbeddedDocuments(
          "Item",
          updates.map(({ item, update }) => ({ _id: item.id, ...update })),
          options
        );
        report.updated += updates.length;
      } catch (error) {
        console.warn(loc`Spycraft 2.0 | Retrying the items of ${actor.name ?? actor.id} one at a time`, error);
        for (const { item, update } of updates)
          try {
            await item.update(update, options);
            report.updated += 1;
          } catch (itemError) {
            failed("item", item, itemError);
          }
      }
    };
    const actors = [...(world.actors ?? [])],
      worldItems = [...(world.items ?? [])],
      tokens = [...(world.tokens ?? [])].filter(token => token.baseActor ?? token.actor),
      total = actors.length + worldItems.length + tokens.length;
    let done = 0;
    const step = () => world.progress?.(++done, total);
    migrating = true;
    try {
      for (const actor of actors) {
        await migrate("actor", actor, null);
        await migrateItems(actor);
        step();
      }
      for (const item of worldItems) {
        await migrate("item", item, null);
        step();
      }
      for (const token of tokens) {
        // The token's own character, not the copy an unlinked token shows, so a migration can compare against it.
        await migrate("token", token, (token.baseActor ?? token.actor).toObject());
        step();
      }
      // World-wide settings a migration changes, after the documents.
      for (const migration of list.filter(m => typeof m.world === "function"))
        try {
          await migration.world(world);
        } catch (error) {
          report.failed += 1;
          console.error(loc`Spycraft 2.0 | Could not apply the ${migration.label ?? migration.version} setting`, error);
        }
    } finally {
      migrating = false;
    }
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

/**
 * Actors and items kept in the world's own compendiums. A locked compendium cannot be written, so it is left as it
 * is and named in `skipped`; the system's own packs are rebuilt with each release and need no migration.
 * @param {Iterable} packs  compendium collections: { documentName, locked, metadata: { packageType, label },
 *                          getDocuments() }
 */
export async function worldCompendiumDocuments(packs) {
  const actors = [],
    items = [],
    skipped = [];
  for (const pack of packs ?? []) {
    if (pack?.metadata?.packageType !== "world" || !["Actor", "Item"].includes(pack.documentName)) continue;
    if (pack.locked) {
      skipped.push(pack.metadata.label ?? pack.collection ?? "");
      continue;
    }
    try {
      const documents = await pack.getDocuments();
      (pack.documentName === "Actor" ? actors : items).push(...documents);
    } catch (error) {
      skipped.push(pack.metadata.label ?? pack.collection ?? "");
      console.error(loc`Spycraft 2.0 | Could not read a compendium for migration`, error);
    }
  }
  return { actors, items, skipped };
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
  const packed = await worldCompendiumDocuments(game.packs);
  // One notification that fills as the world is updated, where this Foundry version can show progress.
  let bar = null;
  const report = await migrateWorld({
    version: stored,
    actors: [...worldActors(game), ...packed.actors],
    items: [...(game.items ?? []), ...packed.items],
    tokens: [...(game.scenes ?? [])].flatMap(scene => [...(scene.tokens ?? [])]),
    scenes: game.scenes,
    settings: game.settings,
    setVersion: version => game.settings.set("spycraft2", "schemaVersion", version),
    notify: message => {
      if (bar) return ui.notifications?.info(message);
      bar = ui.notifications?.info(message, { progress: true }) ?? null;
    },
    progress: (done, total) => {
      if (typeof bar?.update === "function") bar.update({ pct: total ? done / total : 1 });
    }
  });
  if (typeof bar?.update === "function") bar.update({ pct: 1 });
  if (packed.skipped.length)
    ui.notifications?.warn(
      loc`These world compendiums were not updated because they are locked or unreadable: ${packed.skipped.join(", ")}. Unlock them and import their entries again, or update the entries by hand.`,
      { permanent: true }
    );
  return { ...report, skippedPacks: packed.skipped };
}
