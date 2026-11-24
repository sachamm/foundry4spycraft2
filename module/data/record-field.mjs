/**
 * Object fields that carry a declared shape. They behave exactly like Foundry's ObjectField (nothing is stripped,
 * coerced or rejected) and additionally report a value that does not fit its shape, once per problem, in the
 * console. Set CONFIG.debug.spycraft2Records = true to have a misfit fail validation instead while developing.
 */
import { checkRecord } from "../rules/record-check.mjs";
import { RECORD_SHAPES } from "./record-shapes.mjs";
import { loc } from "../i18n.mjs";

const reported = new Set();

/** Report each distinct problem once per session. Returns the problems found. */
export function reportRecord(name, shape, value, log = console.warn) {
  const problems = checkRecord(shape, value);
  for (const { path, problem } of problems) {
    const key = `${name}|${path.replace(/\[\d+\]/g, "[]")}|${problem}`;
    if (reported.has(key)) continue;
    reported.add(key);
    log(
      `Field Agent's Handbook | record "${name}"${path ? ` at ${path}` : ""}: ${problem}. Update module/data/record-shapes.mjs if this is intended.`
    );
  }
  return problems;
}

let RecordField = null;
function recordFieldClass() {
  if (RecordField) return RecordField;
  const { ObjectField } = foundry.data.fields;
  RecordField = class RecordField extends ObjectField {
    constructor(recordName, shape, options, context) {
      super(options, context);
      this.recordName = recordName;
      this.shape = shape;
    }

    /** @override */
    _validateType(value, options) {
      const result = super._validateType(value, options);
      const problems = reportRecord(this.recordName, this.shape, value);
      if (problems.length && globalThis.CONFIG?.debug?.spycraft2Records) {
        throw new Error(
          loc`record "${this.recordName}" does not fit its shape: ${problems[0].path || "value"} ${problems[0].problem}`
        );
      }
      return result;
    }
  };
  return RecordField;
}

/** An object field holding the named record. */
export function record(name, options = {}) {
  const shape = RECORD_SHAPES[name];
  if (shape === undefined) throw new Error(loc`No record shape is declared for "${name}".`);
  return new (recordFieldClass())(name, shape, options);
}

/** A list field whose entries are the named record (the catalog holds the shape as a one-element list). */
export function recordList(name) {
  const shape = RECORD_SHAPES[name];
  if (!Array.isArray(shape)) throw new Error(loc`No list shape is declared for "${name}".`);
  return new foundry.data.fields.ArrayField(new (recordFieldClass())(name, shape[0], {}));
}
