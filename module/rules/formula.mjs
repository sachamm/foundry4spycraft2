/**
 * Small, safe formula evaluator for bonus values such as "@tb.t1", "max(1, @abilities.cha.mod)"
 * or "(4 + (@level - 1))". Only numbers, arithmetic and a few Math functions are allowed.
 */
const ALLOWED_FN = ["floor", "ceil", "round", "max", "min", "abs"];
const SAFE = /^[\d\s+\-*/().,]*$/;

function lookup(data, path) {
  let v = data;
  for (const k of path.split(".")) {
    if (v === null || v === undefined) return 0;
    v = v[k];
  }
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/** Evaluate a formula string (or number) against roll data. Returns 0 on any error. */
export function evaluate(formula, data = {}) {
  if (typeof formula === "number") return formula;
  if (formula === null || formula === undefined || formula === "") return 0;
  let expr = String(formula).replace(/@([A-Za-z0-9_.]+)/g, (_, p) => `(${lookup(data, p)})`);
  const stripped = expr.replace(new RegExp(`\\b(${ALLOWED_FN.join("|")})\\b`, "g"), "");
  if (!SAFE.test(stripped)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...ALLOWED_FN, `return (${expr});`);
    const v = fn(...ALLOWED_FN.map(f => Math[f]));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/** Replace [[formula]] placeholders in descriptive text with evaluated numbers. */
export function renderTemplate(text, data = {}) {
  return String(text ?? "").replace(/\[\[(.+?)\]\]/g, (_, f) => String(evaluate(f, data)));
}

/** VLOOKUP-style approximate lookup in a [[key, value], ...] table sorted by key. */
export function stepLookup(table, key) {
  let out = 0;
  for (const [k, v] of table) {
    if (k <= key) out = v;
    else break;
  }
  return out;
}

const HUMAN = [
  [/^@level$/, "career level"],
  [/^@actionDice\.max$/, "action dice"],
  [/^@classes\.\w+\.levels$/, "class level"],
  [/^@abilities\.(\w+)\.mod$/, (m, a) => `${a[0].toUpperCase()}${a.slice(1)} modifier`],
  [/^@abilities\.(\w+)\.value$/, (m, a) => `${a[0].toUpperCase()}${a.slice(1)} score`]
];

/** Describe [[formula]] placeholders in words (for sheets with no actor context). */
export function humanizeTemplate(text) {
  return String(text ?? "").replace(/\[\[(.+?)\]\]/g, (_, f) => {
    const words = f.trim().replace(/@[A-Za-z0-9_.]+/g, tok => {
      for (const [re, rep] of HUMAN) if (re.test(tok)) return tok.replace(re, rep);
      return tok.slice(1);
    });
    return `[${words.replace(/^\((.*)\)$/, "$1")}]`;
  });
}
