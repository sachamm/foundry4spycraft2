import { loc } from "../i18n.mjs";
import { campaignMedicineDC } from "./campaign-rules.mjs";
/** Table 5.5 p.332; injury rolls p.331; Guts p.174. Higher totals have no printed row. */
const rows = [
  [35, "bleeding", "Bleeding", 20, "1 scene", "Gain 1d8 stress damage; heals when the scene ends."],
  [
    40,
    "brokenLimb",
    "Broken limb",
    20,
    "1d4 missions",
    "The GC determines the limb: lose use of an arm or reduce Speed by 20 ft."
  ],
  [
    45,
    "internalRupture",
    "Internal rupture",
    25,
    "1d4 missions",
    "Permanent −2 to the highest of STR, DEX or CON; the GC randomly resolves ties."
  ],
  [
    50,
    "maimedLimb",
    "Maimed limb",
    30,
    "1d6 missions",
    "The GC determines the limb: lose use of an arm or reduce Speed by 20 ft."
  ],
  [
    55,
    "brainDamage",
    "Brain damage",
    35,
    "1d4 missions",
    "Permanent −2 to the highest of INT, WIS or CHA; the GC randomly resolves ties."
  ],
  [60, "massiveSystemTrauma", "Massive system trauma", 40, "1d4 missions", "Permanently sickened."],
  [65, "nerveDamage", "Nerve damage", 45, "1d3 missions", "Permanently nauseated."],
  [
    70,
    "spinalInjury",
    "Spinal injury",
    50,
    "1 mission",
    "Permanently paralyzed; surgery after the current mission is assumed."
  ]
];
export const CRITICAL_INJURY_HEALING_NOTE =
  "Healing advances one increment per mission started and per whole month of downtime. Successful Medicine/Surgery at the listed DC reduces healing time by 2; at 0 the injury heals. Bleeding instead heals at the end of the current scene.";
const idOK = id =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !["__proto__", "prototype", "constructor"].includes(id);
export function criticalInjuryRollPlan(system, { id, damage, source = "", confirmed = false } = {}) {
  if (
    !idOK(id) ||
    !Number.isSafeInteger(damage) ||
    damage < 0 ||
    damage > Number.MAX_SAFE_INTEGER - 20 ||
    typeof source !== "string" ||
    !source.trim() ||
    source.length > 500 ||
    confirmed !== true
  )
    throw new Error(
      loc`Confirm the actual Table of Ouch trigger, event reference, source and nonnegative whole damage suffered.`
    );
  const die = system.activeFeatNames?.includes("Guts") ? 10 : 20;
  return { id, damage, source: source.trim(), die, formula: `1d${die} + ${damage}` };
}
export function criticalInjuryResult(plan, dieResult) {
  if (
    !plan ||
    ![10, 20].includes(plan.die) ||
    !Number.isSafeInteger(plan.damage) ||
    plan.damage < 0 ||
    plan.damage > Number.MAX_SAFE_INTEGER - 20 ||
    !Number.isSafeInteger(dieResult) ||
    dieResult < 1 ||
    dieResult > plan.die
  )
    throw new Error(loc`Use the actual original injury die within its frozen range.`);
  const total = plan.damage + dieResult,
    row = rows.find(r => total <= r[0]);
  return {
    total,
    dieResult,
    listed: !!row,
    injuryId: row?.[1] ?? null,
    name: row?.[2] ?? loc`Unlisted result — GC adjudication required`,
    // The table's own Surgery DC, kept stable so a saved record still validates when the campaign qualities change.
    // surgeryDCNow() gives the DC in force today.
    surgeryDC: row?.[3] ?? null,
    healingTime: row?.[4] ?? null,
    notes:
      row?.[5] ??
      loc`The printed table ends at 70. This total is preserved without assigning an invented or capped injury.`
  };
}
/**
 * The Surgery DC for an injury result as the campaign stands now: Surgery is a Medicine check, so the Medicine and
 * skill DC qualities move it (pp.406–407).
 */
export const surgeryDCNow = result =>
  Number.isFinite(result?.surgeryDC) ? campaignMedicineDC(result.surgeryDC) : (result?.surgeryDC ?? null);

export function validateCriticalInjuryRecord(record) {
  const plan = criticalInjuryRollPlan(
    { activeFeatNames: record?.die === 10 ? ["Guts"] : [] },
    { ...record, confirmed: true }
  );
  if (record.formula !== plan.formula || !["awaitingRoll", "rolled"].includes(record.state))
    throw new Error(loc`Review the saved critical injury record.`);
  if (record.state === "awaitingRoll") return { plan, result: null };
  const result = criticalInjuryResult(plan, record.dieResult);
  let data;
  try {
    data = JSON.parse(record.rollJSON);
  } catch {
    throw new Error(loc`Review the saved original injury roll.`);
  }
  const [die, operator, damage] = data.terms ?? [];
  if (
    data.class !== "Roll" ||
    die?.evaluated !== true ||
    operator?.class !== "OperatorTerm" ||
    operator.evaluated !== true ||
    damage?.evaluated !== true ||
    data.formula !== plan.formula ||
    data.total !== result.total ||
    data.evaluated !== true ||
    data.terms.length !== 3 ||
    die?.class !== "Die" ||
    die.number !== 1 ||
    die.faces !== plan.die ||
    die.results?.length !== 1 ||
    die.results[0].result !== result.dieResult ||
    die.results[0].active !== true ||
    die.modifiers?.length ||
    operator?.operator !== "+" ||
    damage?.class !== "NumericTerm" ||
    damage.number !== plan.damage ||
    JSON.stringify(record.result) !== JSON.stringify(result)
  )
    throw new Error(loc`The original injury roll and recorded result disagree.`);
  return { plan, result };
}
export function recoveredInjuryRollJSON(plan, dieResult) {
  const result = criticalInjuryResult(plan, dieResult);
  return JSON.stringify({
    class: "Roll",
    options: {},
    dice: [],
    formula: plan.formula,
    terms: [
      {
        class: "Die",
        options: {},
        evaluated: true,
        number: 1,
        faces: plan.die,
        modifiers: [],
        results: [{ result: dieResult, active: true }]
      },
      { class: "OperatorTerm", options: {}, evaluated: true, operator: "+" },
      { class: "NumericTerm", options: {}, evaluated: true, number: plan.damage }
    ],
    total: result.total,
    evaluated: true
  });
}
