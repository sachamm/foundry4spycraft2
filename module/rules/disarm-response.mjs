import { readiedItemsForCheck } from "./readied-replacement.mjs";
import { fencingDisarmPlan } from "./fencing-disarm.mjs";
import { weaponGrip, weaponUnavailable } from "./gear.mjs";
import { DISARM_SIZES, disarmWeaponSize } from "./disarm.mjs";
import { axeDisarmPlan } from "./axe-disarm.mjs";
import { readiedMeleeWeapons } from "./readied-weapons.mjs";
import { ownedWeaponTraining } from "./weapon-training.mjs";
/** Actual held personal weapons; training is not required for Sure Grip. */
export function readiedDisarmWeapons(system, items = []) {
  const weapons = [];
  for (const item of items) {
    const w = item.system ?? {},
      id = item.id ?? item._id;
    if (
      item.type !== "weapon" ||
      w.proficiency === "unarmed" ||
      w.equipped !== true ||
      w.carried === false ||
      weaponUnavailable(w) ||
      !Number.isSafeInteger(w.quantity ?? 1) ||
      (w.quantity ?? 1) < 1
    )
      continue;
    const grip = weaponGrip(system, w);
    if (grip.blocked || ![1, 2].includes(grip.hands) || ![1, 2].includes(grip.required)) continue;
    const qualities = w.qualities === undefined ? "" : w.qualities;
    if (typeof id !== "string" || !id || typeof qualities !== "string")
      return {
        version: 1,
        weapons: [],
        blockedReason: "Review the actual readied weapon identity and qualities before resisting Disarm."
      };
    weapons.push({
      id,
      uuid: item.uuid ?? null,
      name: item.name ?? "",
      proficiency: w.proficiency,
      sizeHands: w.sizeHands,
      qualities,
      hands: grip.hands,
      requiredHands: grip.required,
      quantity: w.quantity ?? 1
    });
  }
  const blockedReason =
    weapons.reduce((n, w) => n + w.hands, 0) > 2 || new Set(weapons.map(w => w.id)).size !== weapons.length
      ? "Review which weapons are actually held: use legal grips within two hands, not every equipped inventory entry."
      : "";
  return { version: 1, weapons: weapons.sort((a, b) => a.id.localeCompare(b.id)), blockedReason };
}
/** p.356 response; the user resolves p.302's skill/attack wording in favor of
 * +3 gear on the targeted weapon's opposed defensive Standard Attack check.
 */
export function disarmResponsePlan(
  system,
  weapon,
  { grip, trained = true, ranged = false, action = "standard", context } = {}
) {
  const empty = { active: false, attackBonus: 0, errorIncrease: 0, notes: [] };
  if (context?.role !== "defender") return empty;
  const reject = reason => ({ ...empty, active: true, blocked: true, reason });
  if (action !== "standard" || typeof trained !== "boolean" || typeof ranged !== "boolean")
    return reject("Resist Disarm uses the actual opposed Standard Attack check.");
  if (
    context.confirmed !== true ||
    context.lineOfSightConfirmed !== true ||
    context.rangeConfirmed !== true ||
    typeof context.incomingRanged !== "boolean" ||
    typeof context.incomingProficient !== "boolean" ||
    typeof context.opponentLabel !== "string" ||
    !context.opponentLabel.trim() ||
    context.opponentLabel.trim().length > 160
  )
    return reject(
      "Name the attacker and confirm a legal incoming Disarm, its ranged/melee mode, line of sight and attacker Reach/CQB range."
    );
  const state = system.disarmWeapons;
  if (!state || state.version !== 1 || !Array.isArray(state.weapons) || state.blockedReason)
    return reject(state?.blockedReason || "Prepare the actual held weapons before resisting Disarm.");
  const target = state.weapons.find(w => w.id === weapon.id),
    ownSize = disarmWeaponSize(system, weapon);
  if (
    !target ||
    context.targetWeaponId !== weapon.id ||
    weapon.proficiency === "unarmed" ||
    ownSize === null ||
    target.hands !== grip?.hands ||
    target.requiredHands !== grip?.required
  )
    return reject(
      "Choose the exact owned, readied weapon targeted by this Disarm; an unarmed character cannot be disarmed."
    );
  let opponentSize = DISARM_SIZES.indexOf(context.opponentWeaponSize);
  if (context.opponentWeaponSize === "Unarmed") {
    const body = DISARM_SIZES.indexOf(context.opponentCharacterSize);
    if (body < 0 || context.incomingRanged) return reject("Confirm the actual Size of an unarmed melee attacker.");
    opponentSize = body - 2;
  } else if (opponentSize < 0) return reject("Confirm the incoming attacker’s actual weapon Size.");
  let axeBasics, fencingBasics;
  try {
    axeBasics = axeDisarmPlan(system, { ranged });
    fencingBasics = fencingDisarmPlan(system, { ranged });
  } catch (error) {
    return reject(error.message);
  }
  const sureGrip = /\bSUR\b/.test(target.qualities),
    sureGripBonus = sureGrip ? 3 : 0,
    gearBonus = Math.max(sureGripBonus, axeBasics?.gearBonus ?? 0, fencingBasics?.gearBonus ?? 0),
    expert = system.activeFeatNames?.includes("Expert Disarm") === true,
    expertBonus = expert ? 2 : 0,
    twoHandBonus = grip.hands === 2 ? 4 : 0,
    sizeBonus = context.incomingRanged ? 0 : 4 * Math.max(0, ownSize - opponentSize),
    errorIncrease = 2 + (context.incomingProficient ? 0 : 2);
  return {
    version: 1,
    active: true,
    role: "defender",
    weaponId: weapon.id,
    source: target,
    held: state.weapons.map(w => ({ id: w.id, hands: w.hands })),
    trained,
    ranged,
    ownSize,
    opponentSize,
    opponentWeaponSize: context.opponentWeaponSize,
    opponentCharacterSize: context.opponentWeaponSize === "Unarmed" ? context.opponentCharacterSize : null,
    opponentLabel: context.opponentLabel.trim(),
    incomingRanged: context.incomingRanged,
    incomingProficient: context.incomingProficient,
    confirmed: true,
    lineOfSightConfirmed: true,
    rangeConfirmed: true,
    sureGrip,
    sureGripBonus,
    gearBonus,
    fencingBasics,
    ...(axeBasics ? { axeBasics } : {}),
    expert,
    expertBonus,
    twoHandBonus,
    sizeBonus,
    attackBonus: gearBonus + expertBonus + twoHandBonus + sizeBonus,
    errorIncrease,
    actionCost: "Opposed response to incoming Disarm; resolve the attacker’s action costs separately",
    shots: 0,
    requiresOpposedStandardAttack: true,
    loseFlatFooted: false,
    loseBonusDisarm: false,
    loseFinalAttackStillPossible: false,
    notes: [
      `Resist Disarm: targeted weapon ${target.name}; opposed Standard Attack, +${twoHandBonus} two-hand grip, +${sizeBonus} weapon Size, +${expertBonus} Expert Disarm; action error +${errorIncrease} (pp.352,356).`,
      ...(sureGrip
        ? [
            "Sure Grip (SUR): +3 gear only when this exact readied weapon is targeted; applies only when this weapon is targeted (p.302)."
          ]
        : []),
      ...(fencingBasics?.gearBonus
        ? [
            "Fencing Basics: +2 gear with the melee opposed Disarm check while holding a readied one-handed FIN sword (p.178)."
          ]
        : []),
      ...(gearBonus ? ["Disarm gear bonuses use the highest applicable bonus; they do not stack."] : []),
      context.incomingRanged
        ? "Incoming ranged Disarm: neither participant receives a weapon-Size bonus."
        : "Weapon Size includes an unarmed attacker’s Size minus two categories.",
      "The GC compares opposed results and resolves weapon landing/transfer, flat-footed, counter-Disarm and final attacks separately. This response does not initiate a Disarm or spend ammunition."
    ]
  };
}
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
export function validateDisarmResponseProof(actor, proof, context = {}) {
  if (!proof || (proof.role !== "defender" && proof.version !== 1 && !Object.hasOwn(proof, "sureGrip"))) return;
  const { weapon, operatingProficiency, trained } = ownedWeaponTraining(actor, proof, context),
    items = readiedItemsForCheck(actor, { rerollOf: context.rerollOf, disarm: proof }),
    source = items.find(i => (i.id ?? i._id) === proof.weaponId),
    effective = { ...weapon, ...source?.system, proficiency: operatingProficiency },
    system = {
      ...actor.system,
      readiedMeleeWeapons: readiedMeleeWeapons(actor.system, items),
      disarmWeapons: readiedDisarmWeapons(actor.system, items)
    },
    p = disarmResponsePlan(system, effective, {
      grip: weaponGrip(system, effective, { hands: context.attackContext?.hands }),
      trained,
      ranged: !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(operatingProficiency),
      context: { ...proof, targetWeaponId: proof.weaponId },
      action: context.attackContext?.attackAction
    });
  if (p.blocked || !p.active || stable(p) !== stable(proof))
    throw Error(
      "The targeted readied weapon, Sure Grip, Disarm response or current attack sources changed before posting."
    );
}
