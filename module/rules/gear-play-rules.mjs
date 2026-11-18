/**
 * Gear play rules (pp.223–224, 276–281): battery life and recharging, gadget housings and mechanisms, an item's
 * result cap and gear bonus in the checks it supports, and repairs. Pure functions: no Foundry access.
 */
import { GEAR_RULES } from "./tables.mjs";
import { breakState, sizeCode } from "./vehicles.mjs";
import { loc } from "../i18n.mjs";

/* ---------------------------------------------------------------------- */
/*  Battery life (p.223)                                                   */
/* ---------------------------------------------------------------------- */

const TIME_UNITS = {
  min: 1 / 60,
  minute: 1 / 60,
  minutes: 1 / 60,
  hr: 1,
  hrs: 1,
  hour: 1,
  hours: 1,
  round: 1 / 600,
  rounds: 1 / 600
};

/** {kind: 'time', hours} or {kind: 'uses', uses} from a battery label such as "72 hrs.", "3 uses" or "3 doses". */
export function parseBattery(label) {
  const text = String(label ?? "")
    .trim()
    .toLowerCase();
  const time = /^([\d.]+)\s*(min|minutes?|hrs?|hours?|rounds?)\.?$/.exec(text);
  if (time) return { kind: "time", hours: Number(time[1]) * TIME_UNITS[time[2]], label: label.trim() };
  const uses = /^([\d.]+)\s*(uses?|doses?|shots?)(\s+each)?\.?$/.exec(text);
  if (uses) return { kind: "uses", uses: Number(uses[1]), label: label.trim() };
  return null;
}

/** Charge left, and whether the item is past its battery life or has run dry. */
export function batteryState(label, charge = {}) {
  const battery = parseBattery(label);
  if (!battery) return null;
  const capacity = battery.kind === "time" ? battery.hours : battery.uses;
  const used = Math.max(0, Number(charge.used) || 0);
  return {
    ...battery,
    capacity,
    used,
    remaining: Math.max(0, capacity - used),
    depleted: used >= capacity,
    depletedUses: charge.depletedUses ?? 0,
    dry: !!charge.dry
  };
}

/**
 * Using an item past its battery life: the GC rolls 1d20; at or below twice the uses since depletion (this one
 * included), it runs completely dry and the use fails (p.223).
 */
export function depletedUse(roll, depletedUsesBefore) {
  const count = Math.max(0, depletedUsesBefore) + 1;
  return { dry: roll <= 2 * count, count, threshold: 2 * count };
}

/**
 * What a recharge costs: free from a ready power source for rechargeable electronics (taking 1/4 of the battery
 * life); otherwise 1 Common Item or 1/100 of the street value, or without a street value 3 Common Items or a gear
 * pick one Caliber lower (p.224).
 */
export function rechargeCost({ rechargeable = false, streetValue = "", battery = null, caliber = 0 } = {}) {
  if (rechargeable) {
    const b = parseBattery(battery);
    const time = b?.kind === "time" ? b.hours / 4 : null;
    return {
      free: true,
      label: loc`Free from a ready power source${time !== null ? loc`; takes ${formatHours(Math.ceil(time * 60) / 60)}` : ""}.`
    };
  }
  const value = Number(
    String(streetValue ?? "")
      .replace(/^R?\$/, "")
      .replace(/[,]/g, "")
      .match(/^\d+/)?.[0]
  );
  if (Number.isFinite(value) && value > 0)
    return { free: false, label: loc`1 Common Item or $${Math.ceil(value / 100).toLocaleString("en-US")}.` };
  const roman = ["I", "II", "III", "IV", "V"][Math.max(1, (caliber || 1) - 1) - 1];
  return { free: false, label: loc`3 Common Items or 1 Caliber ${roman} gear pick.` };
}
const formatHours = h => (h >= 1 ? `${Math.round(h * 10) / 10} hr.` : `${Math.round(h * 60)} min.`);

/* ---------------------------------------------------------------------- */
/*  Gadgets (pp.278–281)                                                   */
/* ---------------------------------------------------------------------- */

const SIZE_NAMES = {
  N: "Nuisance",
  F: "Fine",
  D: "Diminutive",
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
  C: "Colossal",
  E: "Enormous",
  V: "Vast"
};
const mechanismPR = (gadget, name) =>
  gadget.mechanisms.filter(m => m.name.startsWith(name)).reduce((n, m) => n + (Number(m.powerRating) || 0), 0);

/**
 * A gadget's housing limits and derived values: mechanisms allowed by Size (Table 4.66), Knowledge DC (−2 per
 * mechanism after the first, + Disguised gadget PR), Damage save (the housing's own if it is a gear item, otherwise
 * the table guideline, + Durable gadget PR) and the highest Complexity among its mechanisms.
 */
export function gadgetState(gadget, { itemDamageSave = null } = {}) {
  const size = sizeCode(gadget?.housingSize) || gadget?.housingSize || "";
  const housing = GEAR_RULES.housings.find(h => h.size === SIZE_NAMES[size]);
  if (!housing) return { valid: false, reason: loc`Choose a housing Size of Nuisance or larger.` };
  const count = gadget.mechanisms.length;
  const knowledgeDC = housing.knowledgeDC - 2 * Math.max(0, count - 1) + mechanismPR(gadget, "Disguised gadget");
  const baseSave = Number.isSafeInteger(itemDamageSave) ? itemDamageSave : housing.damageSave;
  const damageSave = baseSave + mechanismPR(gadget, "Durable gadget");
  const complexity =
    gadget.mechanisms
      .map(m => String(m.complexity ?? ""))
      .filter(c => /^\d+/.test(c))
      .sort((a, b) => parseInt(b) - parseInt(a))[0] ?? "";
  return {
    valid: true,
    size,
    sizeName: SIZE_NAMES[size],
    max: housing.maxMechanisms,
    count,
    full: count >= housing.maxMechanisms,
    over: count > housing.maxMechanisms,
    knowledgeDC,
    damageSave,
    complexity
  };
}

/** Whether another mechanism fits the housing; a gadget may not be housed inside another gadget. */
export function canAddMechanism(gadget, mechanism) {
  const state = gadgetState(gadget);
  if (!state.valid) return { ok: false, reason: state.reason };
  if (state.full)
    return {
      ok: false,
      reason: loc`A ${state.sizeName} housing holds at most ${state.max} mechanism${state.max === 1 ? "" : "s"}.`
    };
  if (!mechanism?.name) return { ok: false, reason: loc`Drop a gadget mechanism from the Gear pack.` };
  return { ok: true };
}

/** Each failed Damage save costs a gadget one random mechanism; the housing goes with the last one (p.278). */
export function gadgetDamage(gadget, failed, random = Math.random) {
  const mechanisms = [...gadget.mechanisms],
    lost = [];
  for (let i = 0; i < failed && mechanisms.length; i++)
    lost.push(...mechanisms.splice(Math.floor(random() * mechanisms.length), 1));
  return { mechanisms, lost, destroyed: gadget.mechanisms.length > 0 && mechanisms.length === 0 };
}

/** A Skill check mechanism rolls at PR × 4 with no result cap (p.281). */
export const gadgetSkillBonus = powerRating => 4 * Math.max(0, Number(powerRating) || 0);

/* ---------------------------------------------------------------------- */
/*  Using an item in a skill check                                         */
/* ---------------------------------------------------------------------- */

const baseName = name =>
  String(name ?? "")
    .replace(/\s*\((Caliber [IV]+|Reputation\/Net Worth)\)( #\d+)?$/, "")
    .trim();
const signedNumber = text => {
  const m = /^([+\-–−])?\s*(\d+)$/.exec(String(text ?? "").trim());
  return m ? (m[1] && m[1] !== "+" ? -1 : 1) * Number(m[2]) : 0;
};

/**
 * The result cap modifier and gear bonus an item adds to a check it supports (GEAR_RULES.skillUses), and a block
 * when the item is broken, destroyed or out of power.
 */
export function gearUsePlan(skillKey, checkId, item) {
  const none = { applies: false, capIncrease: 0, bonuses: [], notes: [], blockedReason: "" };
  if (!item?.system || item.system.kitType) return none;
  const s = item.system,
    use = GEAR_RULES.skillUses?.[baseName(item.name)];
  const state = breakState(s.size || sizeCode(s.sizeHands) || "M", s.failedSaves ?? 0);
  if (state.state !== "intact")
    return {
      ...none,
      blockedReason: loc`${item.name} is ${state.state}${state.state === "broken" ? loc` and must be repaired before use` : ""}.`
    };
  if (s.charge?.dry) return { ...none, blockedReason: loc`${item.name} has run dry; recharge it first.` };
  if (!use) return none;
  const supports = use.checks.includes(`${skillKey}/${checkId}`) || use.checks.includes(`${skillKey}/*`);
  if (!supports) return { ...none, notes: [loc`${item.name} does not help with this check.`] };
  const capIncrease = signedNumber(s.resultCap),
    bonus = use.gearBonus ?? 0;
  const notes = [
    `${item.name}:${bonus ? loc` +${bonus} gear bonus` : ""}${capIncrease ? loc`${bonus ? "," : ""} result cap ${capIncrease > 0 ? "+" : ""}${capIncrease}` : ""}${use.note ? ` (${use.note})` : ""}.`
  ];
  return {
    applies: true,
    capIncrease,
    bonuses: bonus ? [{ type: "gear", value: bonus, source: item.name }] : [],
    notes,
    blockedReason: ""
  };
}

/* ---------------------------------------------------------------------- */
/*  Repairs (p.224)                                                        */
/* ---------------------------------------------------------------------- */

/** The skill and DC that repair a broken item: Electronics for electronics and gadgets, Mechanics otherwise. */
export function repairPlan(item) {
  const s = item?.system ?? {};
  const state = breakState(s.size || sizeCode(s.sizeHands) || "M", s.failedSaves ?? 0);
  if (state.state === "destroyed")
    return { possible: false, reason: loc`${item.name} is destroyed and cannot be repaired.` };
  if (state.state === "intact") return { possible: false, reason: loc`${item.name} is not broken.` };
  const skillKey =
    ["E", "G"].includes(s.gearCategory) || /computer|radio|bug|sensor|scanner|camera|recorder/i.test(item.name)
      ? "electronics"
      : "mechanics";
  const dc = Number(String(s.complexity ?? "").match(/^\d+/)?.[0]) || 15;
  return { possible: true, skillKey, dc, fromComplexity: /^\d+/.test(String(s.complexity ?? "")) };
}

/** Signal reception beyond 5 range increments: DC by increments (Table 4.64) less twice the signal's PR (p.276). */
export function signalDC({ increments, powerRating, jamming = 0 }) {
  const pr = Math.max(0, (Number(powerRating) || 0) - Math.max(0, Number(jamming) || 0));
  if (pr <= 0) return { received: false, reason: loc`Jamming drowns the signal out.` };
  if (increments <= 5) return { received: true, automatic: true, dc: null };
  if (increments > 10)
    return { received: false, reason: loc`Beyond 10 range increments the signal cannot be picked up.` };
  const base = { 6: 30, 7: 35, 8: 40, 9: 50, 10: 60 }[increments];
  return { received: true, automatic: false, dc: base - 2 * pr, effectivePR: pr };
}
