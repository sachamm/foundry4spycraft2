/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * One stand-in for the Foundry globals a unit test needs, so tests stop writing their own and disagreeing about
 * them (an `escapeHTML` that escapes nothing cannot catch a missing escape). Use it in new tests and move an old
 * test to it when you touch that test.
 *
 *   const world = installFoundry({ user: { isGM: true }, settings: { trustTheTable: true } });
 *   ...
 *   world.notices        // [{ level: "warn", message }]
 *   world.messages       // chat messages created through ChatMessage.create
 *   world.dialogs        // options of every dialog opened
 *   world.restore()      // put the previous globals back
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
/** The same five characters Foundry's own escapeHTML replaces. */
export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ESCAPES[character]);

let serial = 0;
/** A 16-character id, different on every call and the same from run to run. */
export const randomID = () => `id${String((serial += 1)).padStart(14, "0")}`;

/**
 * @param {object} [options]
 * @param {object} [options.user]      merged over `{ id: "user1", isGM: false }`
 * @param {object} [options.settings]  stored values by key; a key not listed throws on read, as an unregistered
 *                                     setting does
 * @param {object[]} [options.actors]
 * @param {Function} [options.dialog]  answers a dialog: receives `(kind, options)` and returns its result
 *                                     (default: every dialog is closed, which resolves to null)
 */
export function installFoundry({ user = {}, settings = {}, actors = [], dialog = () => null } = {}) {
  const prior = Object.fromEntries(
    ["game", "ui", "foundry", "ChatMessage", "Hooks", "CONFIG"].map(key => [key, globalThis[key]])
  );
  const world = { notices: [], messages: [], dialogs: [], hooks: {}, settings: { ...settings }, registered: {} };
  const notice = level => message => {
    world.notices.push({ level, message: String(message) });
  };
  const open = kind => async options => {
    world.dialogs.push({ kind, options });
    return dialog(kind, options);
  };
  globalThis.game = {
    user: { id: "user1", isGM: false, ...user },
    users: { activeGM: user.isGM ? { id: user.id ?? "user1", isSelf: true } : null },
    actors,
    messages: world.messages,
    combats: [],
    combat: null,
    i18n: { has: () => false, localize: key => key, format: key => key },
    settings: {
      register: (scope, key, config) => {
        world.registered[key] = config;
        if (!(key in world.settings)) world.settings[key] = config.default;
      },
      get: (scope, key) => {
        if (!(key in world.settings)) throw new Error(`"${scope}.${key}" is not a registered game setting`);
        return world.settings[key];
      },
      set: async (scope, key, value) => {
        world.settings[key] = value;
        world.registered[key]?.onChange?.(value);
        return value;
      }
    }
  };
  globalThis.ui = { notifications: { info: notice("info"), warn: notice("warn"), error: notice("error") } };
  globalThis.foundry = {
    utils: {
      escapeHTML,
      randomID,
      deepClone: value => structuredClone(value),
      duplicate: value => JSON.parse(JSON.stringify(value))
    },
    applications: {
      api: { DialogV2: { input: open("input"), confirm: open("confirm"), prompt: open("prompt"), wait: open("wait") } }
    }
  };
  globalThis.ChatMessage = {
    create: async data => {
      const message = { id: randomID(), ...data };
      world.messages.push(message);
      return message;
    },
    getSpeaker: ({ actor } = {}) => ({ actor: actor?.id ?? null, alias: actor?.name ?? "" })
  };
  globalThis.Hooks = {
    on: (name, handler) => (world.hooks[name] ??= []).push(handler),
    once: (name, handler) => (world.hooks[name] ??= []).push(handler),
    callAll: (name, ...args) => (world.hooks[name] ?? []).forEach(handler => handler(...args))
  };
  world.restore = () => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
  return world;
}
