/**
 * Roll pipeline: one registry that rule modules join instead of being wired into the Actor document by hand.
 *
 * A contributor is a plain object. Every phase is optional:
 *
 *   {
 *     id: 'takedownSave',            // unique
 *     kinds: ['save'],               // optional: only these check kinds (attack, damage, save, skill, …)
 *     order: 0,                      // optional: lower runs first; ties keep registration order
 *     skillChecks(ctx, checks),      // return the named checks offered for ctx.skillKey
 *     acquire(ctx),                  // return run => … to reserve something before the roll, or nothing
 *     validate(ctx),                 // throw to stop the roll; runs before and after the dice (ctx.phase)
 *     modifiers(ctx),                // return [{label, value}] added to the roll
 *     flags(ctx),                    // return an object merged into the chat message's check record
 *     record: ['takedown'],          // roll options copied onto that record as they are (null when absent)
 *     chatControls(ctx)              // return [{label, run, placement?}] buttons for a posted check
 *   }
 *
 * A rule registers from its own module; module/rolls/index.mjs imports every module that does. Phases are
 * independent: `order` only ranks contributors within the same phase.
 *
 * This module is pure: it knows nothing about Foundry, so it runs under Node tests.
 */

const PHASES = ["skillChecks", "acquire", "validate", "modifiers", "flags", "chatControls"];

export class RollPipeline {
  #contributors = [];
  #sequence = 0;

  /** Add a contributor. Returns the pipeline so registrations can be chained. */
  register(spec) {
    if (!spec || typeof spec !== "object") throw new TypeError("A roll contributor must be an object.");
    const { id } = spec;
    if (typeof id !== "string" || !id) throw new TypeError("A roll contributor needs a non-empty string id.");
    if (this.#contributors.some(c => c.id === id)) throw new Error(`Roll contributor "${id}" is already registered.`);
    if (spec.kinds !== undefined && !(Array.isArray(spec.kinds) && spec.kinds.every(k => typeof k === "string"))) {
      throw new TypeError(`Roll contributor "${id}": kinds must be an array of check kinds.`);
    }
    if (spec.order !== undefined && !Number.isFinite(spec.order)) {
      throw new TypeError(`Roll contributor "${id}": order must be a finite number.`);
    }
    for (const phase of PHASES) {
      if (spec[phase] !== undefined && typeof spec[phase] !== "function") {
        throw new TypeError(`Roll contributor "${id}": ${phase} must be a function.`);
      }
    }
    if (
      spec.record !== undefined &&
      !(Array.isArray(spec.record) && spec.record.every(k => typeof k === "string" && k))
    ) {
      throw new TypeError(`Roll contributor "${id}": record must be an array of option names.`);
    }
    if (!PHASES.some(phase => typeof spec[phase] === "function") && !spec.record?.length) {
      throw new TypeError(`Roll contributor "${id}" implements no phase.`);
    }
    this.#contributors.push({ ...spec, order: spec.order ?? 0, sequence: this.#sequence++ });
    this.#contributors.sort((a, b) => a.order - b.order || a.sequence - b.sequence);
    return this;
  }

  /** Remove a contributor; returns whether it was registered. */
  unregister(id) {
    const index = this.#contributors.findIndex(c => c.id === id);
    if (index < 0) return false;
    this.#contributors.splice(index, 1);
    return true;
  }

  has(id) {
    return this.#contributors.some(c => c.id === id);
  }

  /** Registered ids in running order. */
  get ids() {
    return this.#contributors.map(c => c.id);
  }

  #active(phase, ctx) {
    const kind = ctx?.checkKind;
    return this.#contributors.filter(c => typeof c[phase] === "function" && (!c.kinds || c.kinds.includes(kind)));
  }

  /** Named checks offered for a skill: each contributor receives the list so far and returns the next one. */
  skillChecks(ctx, checks = []) {
    let list = checks;
    for (const c of this.#active("skillChecks", ctx)) {
      list = c.skillChecks(ctx, list);
      if (!Array.isArray(list)) throw new TypeError(`Roll contributor "${c.id}": skillChecks must return an array.`);
    }
    return list;
  }

  /**
   * The first reservation that still has to be taken before this roll, or null.
   * The returned function receives `next(extraOptions)`, which must re-enter the roll with those options added.
   */
  acquire(ctx) {
    for (const c of this.#active("acquire", ctx)) {
      const pending = c.acquire(ctx);
      if (pending === undefined || pending === null || pending === false) continue;
      if (typeof pending !== "function")
        throw new TypeError(`Roll contributor "${c.id}": acquire must return a function.`);
      return pending;
    }
    return null;
  }

  /**
   * Run every validator in order; the first one to throw stops the roll.
   * Synchronous validators are not awaited, so nothing else can run between two of them.
   */
  async validate(ctx) {
    for (const c of this.#active("validate", ctx)) {
      const result = c.validate(ctx);
      if (result && typeof result.then === "function") await result;
    }
  }

  /** Numeric adjustments to the roll: {total, rows: [{id, label, value}]}. Zero-value rows are dropped. */
  modifiers(ctx) {
    const rows = [];
    for (const c of this.#active("modifiers", ctx)) {
      const result = c.modifiers(ctx);
      if (result === undefined || result === null) continue;
      if (!Array.isArray(result)) throw new TypeError(`Roll contributor "${c.id}": modifiers must return an array.`);
      for (const row of result) {
        if (!row || typeof row.label !== "string" || !row.label || !Number.isSafeInteger(row.value)) {
          throw new TypeError(`Roll contributor "${c.id}": each modifier needs a label and a whole-number value.`);
        }
        if (row.value !== 0) rows.push({ id: c.id, label: row.label, value: row.value });
      }
    }
    return { total: rows.reduce((sum, row) => sum + row.value, 0), rows };
  }

  /**
   * Extra fields for the posted check record: every `record` option first (whatever the check kind, so a record
   * always has the same fields), then each contributor's own `flags`. Later contributors win on a shared key.
   */
  flags(ctx) {
    const merged = {};
    for (const c of this.#contributors) for (const key of c.record ?? []) merged[key] = ctx?.options?.[key] ?? null;
    for (const c of this.#active("flags", ctx)) {
      const result = c.flags(ctx);
      if (result === undefined || result === null) continue;
      if (typeof result !== "object" || Array.isArray(result)) {
        throw new TypeError(`Roll contributor "${c.id}": flags must return an object.`);
      }
      Object.assign(merged, result);
    }
    return merged;
  }

  /** Buttons to show under a posted check: [{id, label, run, placement}]. */
  chatControls(ctx) {
    const controls = [];
    for (const c of this.#active("chatControls", ctx)) {
      const result = c.chatControls(ctx);
      if (result === undefined || result === null) continue;
      if (!Array.isArray(result)) throw new TypeError(`Roll contributor "${c.id}": chatControls must return an array.`);
      for (const control of result) {
        if (!control || typeof control.label !== "string" || !control.label || typeof control.run !== "function") {
          throw new TypeError(`Roll contributor "${c.id}": each chat control needs a label and a run function.`);
        }
        controls.push({ id: c.id, label: control.label, run: control.run, placement: control.placement ?? "plain" });
      }
    }
    return controls;
  }
}

/** Apply a pipeline modifier total to a roll formula without disturbing the formula recorded for rerolls. */
export function formulaWithModifiers(formula, total) {
  if (!Number.isSafeInteger(total)) throw new TypeError("A roll modifier total must be a whole number.");
  if (total === 0) return formula;
  return `${formula} ${total < 0 ? "-" : "+"} ${Math.abs(total)}`;
}

/** One line of chat text for the modifiers a roll received, or an empty string. */
export function describeModifiers(rows = []) {
  return rows.map(row => `${row.label} ${row.value >= 0 ? "+" : "−"}${Math.abs(row.value)}`).join("; ");
}

/** The pipeline every roll on this system goes through. */
export const rollPipeline = new RollPipeline();
