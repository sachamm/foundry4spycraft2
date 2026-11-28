import { loc } from "../i18n.mjs";
import { skillPenaltyEntries, skillPenaltyDivisor } from "./skill-penalties.mjs";
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
 *     dialogs: ['skill'],            // which roll dialogs `dialog` and `read` take part in
 *     dialog(ctx),                   // return [{at, html}] pieces of that dialog's form, placed by `at`
 *     read(ctx, input),              // return fields to merge into what the player entered (coercion, lookups)
 *     acquire(ctx),                  // return run => … to reserve something before the roll, or nothing
 *     validate(ctx),                 // throw to stop the roll; runs before and after the dice (ctx.phase)
 *     terms(ctx),                    // return this rule's part of a planned check (see planTerms), or nothing
 *     modifiers(ctx),                // return [{label, value}] added to the roll
 *     stage: 'plan',                 // when `modifiers` applies: 'plan' (part of the previewed total) or 'roll' (default)
 *     flags(ctx),                    // return an object merged into the chat message's check record
 *     record: ['takedown'],          // roll options copied onto that record as they are (null when absent)
 *     chatControls(ctx)              // return [{label, run, placement?, emphasis?, disabled?}] buttons for a posted check;
 *                                    // emphasis "primary" marks the card's next step, "quiet" a minor one
 *   }
 *
 * A rule registers from its own module; module/rolls/index.mjs imports every module that does. Phases are
 * independent: `order` only ranks contributors within the same phase.
 *
 * This module is pure: it knows nothing about Foundry, so it runs under Node tests.
 */

const PHASES = ["skillChecks", "dialog", "read", "acquire", "validate", "terms", "modifiers", "flags", "chatControls"];

export class RollPipeline {
  #contributors = [];
  #sequence = 0;

  /** Add a contributor. Returns the pipeline so registrations can be chained. */
  register(spec) {
    if (!spec || typeof spec !== "object") throw new TypeError(loc`A roll contributor must be an object.`);
    const { id } = spec;
    if (typeof id !== "string" || !id) throw new TypeError(loc`A roll contributor needs a non-empty string id.`);
    if (this.#contributors.some(c => c.id === id))
      throw new Error(loc`Roll contributor "${id}" is already registered.`);
    if (spec.kinds !== undefined && !(Array.isArray(spec.kinds) && spec.kinds.every(k => typeof k === "string"))) {
      throw new TypeError(loc`Roll contributor "${id}": kinds must be an array of check kinds.`);
    }
    if (spec.stage !== undefined && !["plan", "roll"].includes(spec.stage)) {
      throw new TypeError(loc`Roll contributor "${id}": stage must be "plan" or "roll".`);
    }
    if (spec.order !== undefined && !Number.isFinite(spec.order)) {
      throw new TypeError(loc`Roll contributor "${id}": order must be a finite number.`);
    }
    for (const phase of PHASES) {
      if (spec[phase] !== undefined && typeof spec[phase] !== "function") {
        throw new TypeError(loc`Roll contributor "${id}": ${phase} must be a function.`);
      }
    }
    if (
      (spec.dialog || spec.read) &&
      !(Array.isArray(spec.dialogs) && spec.dialogs.length && spec.dialogs.every(d => typeof d === "string"))
    ) {
      throw new TypeError(
        loc`Roll contributor "${id}": dialog and read need a dialogs list naming the dialogs they join.`
      );
    }
    if (
      spec.record !== undefined &&
      !(Array.isArray(spec.record) && spec.record.every(k => typeof k === "string" && k))
    ) {
      throw new TypeError(loc`Roll contributor "${id}": record must be an array of option names.`);
    }
    if (!PHASES.some(phase => typeof spec[phase] === "function") && !spec.record?.length) {
      throw new TypeError(loc`Roll contributor "${id}" implements no phase.`);
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

  /** Ids of the contributors that implement `phase`, in running order (for example, the chat-card buttons). */
  idsFor(phase) {
    if (!PHASES.includes(phase)) throw new TypeError(loc`Unknown roll pipeline phase "${phase}".`);
    return this.#contributors.filter(c => typeof c[phase] === "function").map(c => c.id);
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
      if (!Array.isArray(list)) throw new TypeError(loc`Roll contributor "${c.id}": skillChecks must return an array.`);
    }
    return list;
  }

  #inDialog(phase, ctx) {
    if (typeof ctx?.dialog !== "string" || !ctx.dialog) throw new TypeError(loc`A dialog context names its dialog.`);
    return this.#contributors.filter(c => typeof c[phase] === "function" && c.dialogs.includes(ctx.dialog));
  }

  /**
   * The HTML of a roll dialog's form: every contributor's pieces for `ctx.dialog`, in `at` order.
   * Pieces with the same `at` keep contributor order. An empty or missing piece adds nothing.
   */
  dialog(ctx) {
    const pieces = [];
    for (const c of this.#inDialog("dialog", ctx)) {
      const result = c.dialog(ctx);
      if (result === undefined || result === null) continue;
      if (!Array.isArray(result)) throw new TypeError(loc`Roll contributor "${c.id}": dialog must return an array.`);
      for (const piece of result) {
        if (!piece || !Number.isFinite(piece.at)) {
          throw new TypeError(loc`Roll contributor "${c.id}": each dialog piece needs a numeric position.`);
        }
        const html = piece.html === undefined || piece.html === null || piece.html === false ? "" : String(piece.html);
        if (html) pieces.push({ at: piece.at, html, sequence: pieces.length });
      }
    }
    pieces.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
    return pieces.map(piece => piece.html).join("");
  }

  /** What the player entered, after every contributor for `ctx.dialog` has added or corrected its fields. */
  read(ctx, input) {
    let current = input;
    for (const c of this.#inDialog("read", ctx)) {
      const patch = c.read(ctx, current);
      if (patch === undefined || patch === null) continue;
      if (typeof patch !== "object" || Array.isArray(patch)) {
        throw new TypeError(loc`Roll contributor "${c.id}": read must return an object of fields.`);
      }
      if (Object.keys(patch).length) current = { ...current, ...patch };
    }
    return current;
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
        throw new TypeError(loc`Roll contributor "${c.id}": acquire must return a function.`);
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

  /**
   * The parts of a planned check that rules own, in contributor order: [{id, key?, plan?, …}].
   * A term with a `key` is also stored on `ctx.plans`, so a later contributor can read an earlier one's plan.
   * What the other fields mean is up to the check that asks (see planTerms).
   */
  terms(ctx) {
    const list = [];
    if (ctx && !ctx.plans) ctx.plans = {};
    for (const c of this.#active("terms", ctx)) {
      const result = c.terms(ctx);
      if (result === undefined || result === null) continue;
      for (const term of Array.isArray(result) ? result : [result]) {
        if (!term || typeof term !== "object" || Array.isArray(term)) {
          throw new TypeError(loc`Roll contributor "${c.id}": each term must be an object.`);
        }
        if (term.key !== undefined && (typeof term.key !== "string" || !term.key)) {
          throw new TypeError(loc`Roll contributor "${c.id}": a term key must be a non-empty string.`);
        }
        if (term.key) {
          if (Object.hasOwn(ctx.plans, term.key)) {
            throw new Error(loc`Roll contributor "${c.id}": the term "${term.key}" is already planned.`);
          }
          ctx.plans[term.key] = term.plan ?? null;
        }
        list.push({ ...term, id: c.id });
      }
    }
    return list;
  }

  /**
   * Numeric adjustments from contributors: {total, rows: [{id, label, value}]}. Zero-value rows are dropped.
   * `ctx.stage` selects which contributors answer: "plan" while a total is being worked out (so previews and the
   * roll agree), "roll" when the dice are thrown. A contributor belongs to exactly one stage, so nothing counts twice.
   */
  modifiers(ctx) {
    const stage = ctx?.stage ?? "roll";
    const rows = [];
    for (const c of this.#active("modifiers", ctx)) {
      if ((c.stage ?? "roll") !== stage) continue;
      const result = c.modifiers(ctx);
      if (result === undefined || result === null) continue;
      if (!Array.isArray(result)) throw new TypeError(loc`Roll contributor "${c.id}": modifiers must return an array.`);
      for (const row of result) {
        if (!row || typeof row.label !== "string" || !row.label || !Number.isSafeInteger(row.value)) {
          throw new TypeError(loc`Roll contributor "${c.id}": each modifier needs a label and a whole-number value.`);
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
      // A contributor's mistake is for the console, not the table: its flags are left off and the roll goes on.
      if (typeof result !== "object" || Array.isArray(result)) {
        console.warn(`Field Agent's Handbook | Roll contributor "${c.id}": flags must return an object.`);
        continue;
      }
      Object.assign(merged, result);
    }
    return merged;
  }

  /** Buttons to show under a posted check: [{id, label, run, placement, hint?}]; the hint is the button's tooltip. */
  chatControls(ctx) {
    const controls = [];
    for (const c of this.#active("chatControls", ctx)) {
      const result = c.chatControls(ctx);
      if (result === undefined || result === null) continue;
      if (!Array.isArray(result))
        throw new TypeError(loc`Roll contributor "${c.id}": chatControls must return an array.`);
      for (const control of result) {
        if (!control || typeof control.label !== "string" || !control.label || typeof control.run !== "function") {
          throw new TypeError(loc`Roll contributor "${c.id}": each chat control needs a label and a run function.`);
        }
        controls.push({
          id: c.id,
          label: control.label,
          run: control.run,
          placement: control.placement ?? "plain",
          ...(typeof control.labelKey === "string" && control.labelKey ? { labelKey: control.labelKey } : {}),
          ...(typeof control.hint === "string" && control.hint ? { hint: control.hint } : {}),
          ...(typeof control.key === "string" && control.key ? { key: control.key } : {}),
          // A reason the control is not legal now: it is shown disabled with that reason (style guide 8.6).
          ...(typeof control.disabled === "string" && control.disabled ? { disabled: control.disabled } : {}),
          ...(["primary", "quiet"].includes(control.emphasis) ? { emphasis: control.emphasis } : {})
        });
      }
    }
    return controls;
  }
}

/** Apply a pipeline modifier total to a roll formula without disturbing the formula recorded for rerolls. */
export function formulaWithModifiers(formula, total) {
  if (!Number.isSafeInteger(total)) throw new TypeError(loc`A roll modifier total must be a whole number.`);
  if (total === 0) return formula;
  return `${formula} ${total < 0 ? "-" : "+"} ${Math.abs(total)}`;
}

/** One line of chat text for the modifiers a roll received, or an empty string. */
export function describeModifiers(rows = []) {
  return rows.map(row => `${row.label} ${row.value >= 0 ? "+" : "−"}${Math.abs(row.value)}`).join("; ");
}

/** The pipeline every roll on this system goes through. */
export const rollPipeline = new RollPipeline();

/**
 * Work out a roll's bonus from labelled parts, then let plan-stage contributors add theirs.
 * @param {string} kind       check kind ("attack", "skill", "save", …)
 * @param {object} context    what a contributor may need (system, weapon, skillKey, options, …)
 * @param {Array<[string, number]>} entries  the rule's own [label, value] parts
 * @returns {{total: number, modifiers: object[], planModifiers: object[]}} the sum, its non-zero rows, and the
 *   rows contributors added (recorded on the posted check)
 */
export function planTotal(kind, context, entries, pipeline = rollPipeline) {
  let total = 0;
  const modifiers = [];
  for (const [label, value] of entries) {
    total += value;
    if (value) modifiers.push({ label, value });
  }
  const added = pipeline.modifiers({ ...context, checkKind: kind, stage: "plan" });
  if (kind === "skill" && skillPenaltyDivisor(context.system) === 2) {
    const rows = skillPenaltyEntries(context.system, added.rows);
    added.total += rows.reduce((n, row, i) => n + row.value - added.rows[i].value, 0);
    added.rows = rows.map(row =>
      row.originalValue !== undefined
        ? { ...row, label: loc`${row.label} (Omni-Competent: ${row.originalValue} → ${row.value})` }
        : row
    );
  }
  return { total: total + added.total, modifiers: [...modifiers, ...added.rows], planModifiers: added.rows };
}

/**
 * Ask every rule for its part of a planned check and fold the answers.
 *
 * A term is a plain object. Every field is optional:
 *
 *   {
 *     key: "sniper", plan: {…},     // returned to the caller under `plans.sniper` (evidence, proofs, …)
 *     at: 420,                      // where its rows, notes and block reason sit among the check's own
 *     rows: [[label, value]],       // labelled parts of the bonus       (position: rowAt ?? at)
 *     notes: ["…"],                 // text for the posted check          (position: noteAt ?? at)
 *     blocked: "reason",            // stops the check; first by position (position: blockAt ?? at)
 *     threat: 1, error: 1, …        // any number a check sums with `sum(field)`
 *   }
 *
 * @param {string} kind     check kind ("attack", "skill", "save", …)
 * @param {object} context  the facts a rule may need (system, weapon, options, …)
 * @returns {{list: object[], plans: object, sum: Function, merge: Function}}
 */
export function planTerms(kind, context, pipeline = rollPipeline) {
  const ctx = { ...context, checkKind: kind, stage: "plan", plans: {} };
  const list = pipeline.terms(ctx);
  const position = { rows: "rowAt", notes: "noteAt", segment: "noteAt", blocked: "blockAt", bonuses: "bonusAt" };
  return {
    list,
    plans: ctx.plans,
    /** The total of a numeric field over every term. */
    sum: field => list.reduce((total, term) => total + (Number(term[field]) || 0), 0),
    /** Every term's values of a field, in contributor order (arrays are flattened once). */
    all: field => list.flatMap(term => (term[field] === undefined || term[field] === null ? [] : term[field])),
    /**
     * The check's own positioned items and the terms' items for one list, in position order.
     * @param {"rows"|"notes"|"blocked"} field
     * @param {Array<[number, *]>} own  [position, item or items]; ties keep the check's own items first
     */
    merge(field, own = []) {
      const entries = [];
      for (const [at, value] of own) entries.push({ at, value, sequence: entries.length });
      for (const term of list) {
        const value = term[field];
        if (value === undefined || value === null || value === "" || value === false) continue;
        entries.push({ at: term[position[field] ?? `${field}At`] ?? term.at ?? 0, value, sequence: entries.length });
      }
      entries.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
      // Rows are [label, value] pairs: a term's list of rows is flattened, a single own pair is not.
      if (field === "rows")
        return entries.flatMap(entry =>
          Array.isArray(entry.value[0]) || !entry.value.length ? entry.value : [entry.value]
        );
      return entries
        .flatMap(entry => entry.value)
        .filter(item => item !== "" && item !== null && item !== undefined && item !== false);
    }
  };
}

/**
 * The term of a skill check plan for a rule that answers in the usual shape:
 * {evidence, bonuses, notes, blockedReason, sizeBonus, synergies}. Its notes become one segment of the check's
 * note text, followed by a space.
 * @param {string} key        the field the evidence is returned under
 * @param {object} plan       what the rule's plan function returned
 * @param {object} positions  {noteAt, blockAt, bonusAt}: where its notes, block reason and bonuses sit
 */
export function skillPlanTerm(key, plan, positions = {}) {
  return {
    key,
    plan: plan.evidence ?? null,
    bonuses: plan.bonuses ?? [],
    segment: `${(plan.notes ?? []).join(" ")} `,
    blocked: plan.blockedReason ?? "",
    adjustment: plan.sizeBonus ?? 0,
    synergies: plan.synergies ?? [],
    ...positions
  };
}
