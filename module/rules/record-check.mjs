/**
 * Checks a stored record against a declared shape (grammar in module/data/record-shapes.mjs). Pure.
 * Returns a list of problems: [{ path, problem }]. An empty list means the value fits.
 */
const typeOf = value =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "object" ? "object" : typeof value;

const allows = (union, type) => {
  const types = union.split("|");
  return types.includes("any") || types.includes(type);
};

export function checkRecord(shape, value, path = "") {
  if (value === undefined) return [];
  const type = typeOf(value);
  if (typeof shape === "string") {
    return allows(shape, type) ? [] : [{ path, problem: `expected ${shape}, found ${type}` }];
  }
  if (Array.isArray(shape)) {
    if (type !== "array") return [{ path, problem: `expected a list, found ${type}` }];
    return value.flatMap((entry, index) => checkRecord(shape[0] ?? "any", entry, `${path}[${index}]`));
  }
  if (!shape || typeof shape !== "object") return [];
  if (type !== "object") {
    if (shape.$also && allows(shape.$also, type)) return [];
    if (type === "array" && shape.$list !== undefined) return checkRecord([shape.$list], value, path);
    return [{ path, problem: `expected a record, found ${type}` }];
  }
  const problems = [];
  for (const [key, entry] of Object.entries(value)) {
    const expected = Object.hasOwn(shape, key) && !key.startsWith("$") ? shape[key] : shape["*"];
    const where = path ? `${path}.${key}` : key;
    if (expected === undefined) problems.push({ path: where, problem: "undeclared key" });
    else problems.push(...checkRecord(expected, entry, where));
  }
  return problems;
}

/** Whether a shape is well formed: only known type names, and records/lists all the way down. */
export function validShape(shape) {
  const TYPES = new Set(["null", "boolean", "number", "string", "object", "array", "any"]);
  if (typeof shape === "string") return shape.split("|").every(type => TYPES.has(type));
  if (Array.isArray(shape)) return shape.length === 1 && validShape(shape[0]);
  if (!shape || typeof shape !== "object") return false;
  return Object.entries(shape).every(([key, entry]) =>
    key === "$also" ? validShape(entry) && typeof entry === "string" : validShape(entry)
  );
}
