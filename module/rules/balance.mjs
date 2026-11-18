import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Table2.10 and Balance p.106; Equilibrium Basics/Mastery p.194. */
export const BALANCE_SURFACES = {
  flat: {
    get label() {
      return loc`Flat, normal surface`;
    },
    dc: 5,
    error: 0,
    mastery: false
  },
  uneven10to20: {
    get label() {
      return loc`Uneven floor, 10°–20°`;
    },
    dc: 15,
    error: 0,
    mastery: true
  },
  uneven21to35: {
    get label() {
      return loc`Uneven floor, 21°–35°`;
    },
    dc: 20,
    error: 1,
    mastery: true
  },
  uneven36to45: {
    get label() {
      return loc`Uneven floor, 36°–45°`;
    },
    dc: 25,
    error: 1,
    mastery: true
  },
  uneven46to60: {
    get label() {
      return loc`Uneven floor, 46°–60°`;
    },
    dc: 30,
    error: 2,
    mastery: true
  },
  narrow7to12: {
    get label() {
      return loc`Narrow walkway, 7–12 in.`;
    },
    dc: 15,
    error: 0,
    mastery: true
  },
  narrow3to6: {
    get label() {
      return loc`Narrow walkway, 3–6 in.`;
    },
    dc: 20,
    error: 1,
    mastery: true
  },
  narrow1to3: {
    get label() {
      return loc`Narrow walkway, 1–3 in. (confirm the row at exactly 3 in.)`;
    },
    dc: 25,
    error: 1,
    mastery: true
  },
  narrowUnder1: {
    get label() {
      return loc`Narrow walkway, under 1 in.`;
    },
    dc: 30,
    error: 2,
    mastery: true
  }
};
export function balanceSurfacePlan(
  system,
  key,
  check,
  {
    balanceCircumstances = false,
    balanceSurface = "",
    balanceDistanceFeet = 0,
    balanceBuckled = false,
    balanceSlippery = false,
    balanceConfirmed = false
  } = {}
) {
  const empty = { evidence: null, check, dc: null, errorIncrease: 0, errorReduction: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (balanceCircumstances === false) return empty;
  if (balanceCircumstances !== true || key !== "acrobatics" || check?.id !== "balance")
    return reject(loc`Declare these surface circumstances only for Acrobatics/Balance.`);
  if (
    balanceConfirmed !== true ||
    typeof balanceSurface !== "string" ||
    !Object.hasOwn(BALANCE_SURFACES, balanceSurface) ||
    typeof balanceBuckled !== "boolean" ||
    typeof balanceSlippery !== "boolean" ||
    typeof balanceDistanceFeet !== "number" ||
    !Number.isFinite(balanceDistanceFeet) ||
    balanceDistanceFeet < 0
  )
    return reject(
      loc`The GC must confirm the actual Balance table row, cumulative surface conditions and legal counted movement. Inclines above60° require Climb, not Balance.`
    );
  if (!Array.isArray(system?.activeFeatNames) || system.activeFeatNames.some(n => typeof n !== "string" || !n.trim()))
    return reject(loc`Review the character’s current qualified Equilibrium sources.`);
  const row = BALANCE_SURFACES[balanceSurface],
    moving = balanceDistanceFeet > 0,
    speed = moving ? system.speed : null;
  if (moving && (!Number.isFinite(speed) || speed <= 0 || balanceDistanceFeet > speed * 2))
    return reject(loc`Enter legal Balance movement up to double current Speed; other movement limits still apply.`);
  const normalHalfSpeed = moving ? Math.floor(speed / 2) : null,
    tableHalfSpeed = moving ? Math.ceil(speed / 2) : null;
  const normalChecks = moving && balanceDistanceFeet > normalHalfSpeed ? 2 : 1,
    basic = normalChecks === 2 && system.activeFeatNames.includes("Equilibrium Basics"),
    mastery = row.mastery && system.activeFeatNames.includes("Equilibrium Mastery");
  const pace =
    moving && balanceDistanceFeet > speed ? "faster" : moving && balanceDistanceFeet > tableHalfSpeed ? "full" : "half";
  const paceDC = pace === "faster" ? 10 : pace === "full" ? 5 : 0,
    errorIncrease = row.error + (balanceSlippery ? 1 : 0) + (pace === "faster" ? 1 : 0),
    errorReduction = mastery ? 1 : 0;
  const dc = row.dc + (balanceBuckled ? 5 : 0) + (balanceSlippery ? 10 : 0) + paceDC - (mastery ? 5 : 0),
    requiredChecks = basic ? 1 : normalChecks;
  const sources = [...(basic ? ["Equilibrium Basics"] : []), ...(mastery ? ["Equilibrium Mastery"] : [])];
  const adjustedCheck = mastery
    ? {
        ...check,
        tags: check.tags
          .split(",")
          .map(t => t.trim())
          .filter(t => t !== "Vision")
          .join(", ")
      }
    : check;
  const evidence = {
    version: 1,
    skillKey: key,
    checkId: check.id,
    surface: balanceSurface,
    distanceFeet: balanceDistanceFeet,
    speed,
    normalHalfSpeed,
    tableHalfSpeed,
    pace,
    buckled: balanceBuckled,
    slippery: balanceSlippery,
    confirmed: true,
    baseDC: row.dc,
    dc,
    errorIncrease,
    errorReduction,
    ignoreVision: mastery,
    normalChecks,
    requiredChecks,
    sources
  };
  return {
    ...empty,
    evidence,
    check: adjustedCheck,
    dc,
    errorIncrease,
    errorReduction,
    notes: [
      loc`Balance: ${row.label}; DC${dc}, error +${errorIncrease}${mastery ? loc`, Equilibrium Mastery error −1 and Vision tag ignored` : ""}; ${requiredChecks} check(s) for this movement (pp.106,194).`,
      ...(basic
        ? [
            loc`Equilibrium Basics replaces the ordinary two movement checks with one; it does not waive the check or expand permitted movement.`
          ]
        : []),
      loc`The GC confirms the applicable row at overlapping width boundaries, legal action/movement and other DC modifiers. This plans one check; resolve all required checks and their outcomes separately.`
    ]
  };
}
export function validateBalanceSurfaceProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const p = balanceSurfacePlan(
    system,
    skillKey,
    { id: checkId, tags: "Armor Check Penalty, Flat-Footed, Hearing, Vision" },
    {
      balanceCircumstances: true,
      balanceSurface: proof.surface,
      balanceDistanceFeet: proof.distanceFeet,
      balanceBuckled: proof.buckled,
      balanceSlippery: proof.slippery,
      balanceConfirmed: proof.confirmed
    }
  );
  const stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map(k => [k, x[k]])
          )
        : x
    );
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(
      loc`The Balance surface, movement, current Speed or qualified Equilibrium source changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "balanceSurface",
  order: 1520,
  record: ["balanceSurface"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateBalanceSurfaceProof(actor.system, options.balanceSurface, { checkKind, skillKey, checkId })
});
