import { completeCharacterTarget } from "./character-target.mjs";
import { dartingDeclarationPlan, dartingFinalAttackPlan, dartingWeaponEligible } from "../rules/darting.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { finalAttackOptions, postFinalAttack } from "./final-attack.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { loc } from "../i18n.mjs";
const map = v => v !== null && typeof v === "object" && !Array.isArray(v),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  roundKey = c => `${encodeURIComponent(c.id).replaceAll(".", "%2E")}:${c.round}`,
  snapshot = a => JSON.stringify({ record: a.system.dartingStyle ?? null, combat: expertiseCombatContext(a) });
export async function declareDarting(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const before = snapshot(actor);
  let input = options;
  if (!Object.hasOwn(input, "extraAttacks")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Darting / Flashing Weapon` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`At the start of your Initiative Count, gain final melee or hurled attacks and accept the attack/skill penalty until the start of your next Initiative Count. These attacks do not require a particular pair or the least-used weapon. Main tracks the granted attacks; normal weapon, action and ammunition requirements still apply.`}</p><label>${loc`Choice`} <select name="extraAttacks"><option value="1">${loc`Darting Weapon: 1 final attack; −2 attack/skill checks`}</option><option value="2">${loc`Flashing Weapon: 2 final attacks; −4 attack/skill checks`}</option></select></label><label><input name="atStartOfInitiative" type="checkbox" /> ${loc`The GC confirms the start of my Initiative Count`}</label><label><input name="confirmed" type="checkbox" /> ${loc`I accept this penalty for the full round`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner || snapshot(actor) !== before)
      throw new Error(loc`Ownership, declaration or Initiative Count changed. Open the declaration again.`);
    const combat = expertiseCombatContext(actor),
      extraAttacks =
        typeof input.extraAttacks === "string" && input.extraAttacks.trim()
          ? Number(input.extraAttacks)
          : input.extraAttacks,
      plan = dartingDeclarationPlan(actor.system, combat, { ...input, extraAttacks }),
      key = roundKey(combat),
      history =
        actor.flags?.spycraft2?.dartingDeclarations === undefined ? {} : actor.flags.spycraft2.dartingDeclarations,
      reviews = actor.flags?.spycraft2?.dartingReviews === undefined ? {} : actor.flags.spycraft2.dartingReviews;
    if (!map(history) || !map(reviews))
      throw new Error(loc`The GC must review the saved Darting Weapon declaration history.`);
    if (Object.hasOwn(history, key) || Object.values(reviews).some(r => r?.blockedRounds?.includes(key)))
      throw new Error(loc`A Darting Weapon declaration has already been recorded for this combat round.`);
    const record = { ...plan, id: foundry.utils.randomID() },
      patch = {
        "system.dartingStyle": record,
        "system.resourceUses.dartingFinalAttack": { epoch: record.id, used: 0 },
        ["flags.spycraft2.dartingDeclarations." + key]: record.id
      };
    const proof = () =>
      same(actor.system.dartingStyle, record) &&
      same(actor.system.resourceUses?.dartingFinalAttack, { epoch: record.id, used: 0 }) &&
      actor.flags?.spycraft2?.dartingDeclarations?.[key] === record.id;
    try {
      await actor.update(patch);
    } catch (error) {
      if (!proof()) throw error;
    }
    if (!proof()) throw new Error(loc`Review the Darting Weapon declaration before retrying.`);
    return record;
  });
}
export async function takeDartingFinalAttack(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const before = snapshot(actor);
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    const esc = foundry.utils.escapeHTML,
      choices = actor.items
        .filter(i => i.type === "weapon" && dartingWeaponEligible(i.system))
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Darting Weapon final attack` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Take one recorded final Standard Attack with a current melee or hurled weapon. No least-used or original-weapon restriction applies. Normal action and weapon requirements still apply; resolve combined class declarations through their ordinary controls and GC counter review.`}</p><label>${loc`Weapon`} <select name="weaponId">${choices}</select></label>${standardAttackContextContent(actor)}<label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this final attack is legal now`}</label></div>`
    });
    if (!input) return null;
  }
  if (snapshot(actor) !== before)
    throw new Error(loc`The declaration or Initiative Count changed. Review the final attack again.`);
  const attackOptions = await completeCharacterTarget(
    actor,
    actor.items.get(input.weaponId)?.system,
    finalAttackOptions(input)
  );
  if (!attackOptions) return null;
  const plan = dartingFinalAttackPlan(actor.system, expertiseCombatContext(actor), actor.items, input),
    weapon = actor.items.get(plan.weaponId),
    preview = actor.weaponAttack(weapon, attackOptions);
  if (preview.ranged && !Number.isFinite(attackOptions.distanceFeet))
    throw new Error(loc`Enter the actual target distance for the final hurled attack.`);
  if (preview.blocked) throw new Error(preview.reason || loc`This final attack is blocked.`);
  const signature = JSON.stringify(preview),
    receipt = { ...plan, id: foundry.utils.randomID(), source: "dartingWeapon" };
  return actor.useLimitedAbility(
    "dartingFinalAttack",
    async status => {
      const validate = () => {
        if (!actor.isOwner || snapshot(actor) !== before)
          throw new Error(loc`The Darting Weapon declaration or ownership changed.`);
        const fresh = dartingFinalAttackPlan(actor.system, expertiseCombatContext(actor), actor.items, input),
          counter = actor.system.resourceUses?.dartingFinalAttack,
          current = actor.items.get(plan.weaponId);
        if (
          !same(fresh, plan) ||
          counter?.epoch !== plan.declarationId ||
          counter.used !== status.used + 1 ||
          !current ||
          JSON.stringify(actor.weaponAttack(current, attackOptions)) !== signature
        )
          throw new Error(loc`The final attack, weapon or reserved use changed. Review it again.`);
      };
      return postFinalAttack(actor, plan.weaponId, attackOptions, { ...receipt, sequence: status.used + 1 }, validate);
    },
    { workflow: "dartingFinalAttack" }
  );
}
export async function reviewDarting(actor, options = {}) {
  if (!game.user.isGM || !actor.isOwner)
    throw new Error(loc`Only an owning GC can review the Darting Weapon tradeoff.`);
  const capture = () =>
      JSON.stringify({
        source: snapshot(actor),
        history: actor.flags?.spycraft2?.dartingDeclarations,
        reviews: actor.flags?.spycraft2?.dartingReviews
      }),
    before = capture();
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review Darting Weapon tradeoff` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Resolve the actual remaining penalty and attacks at the table before clearing this saved declaration. Review preserves the used round and cannot grant more attacks.`}</p><label>${loc`GC resolution`} <input name="resolution" maxlength="500" /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC resolved the remaining tradeoff`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!game.user.isGM || !actor.isOwner || capture() !== before)
      throw new Error(loc`The Darting Weapon review source or ownership changed.`);
    if (
      input.confirmed !== true ||
      typeof input.resolution !== "string" ||
      !input.resolution.trim() ||
      input.resolution.length > 500
    )
      throw new Error(loc`Confirm the actual GC resolution.`);
    const old = structuredClone(actor.system.dartingStyle ?? null),
      c = expertiseCombatContext(actor),
      history = actor.flags?.spycraft2?.dartingDeclarations,
      reviews = actor.flags?.spycraft2?.dartingReviews,
      unknown = (history !== undefined && !map(history)) || (reviews !== undefined && !map(reviews)),
      original =
        typeof old?.combatId === "string" && old.combatId && Number.isSafeInteger(old.startRound) && old.startRound >= 1
          ? roundKey({ id: old.combatId, round: old.startRound })
          : null,
      current = c?.started && Number.isSafeInteger(c.round) && c.round >= 1 ? roundKey(c) : null,
      blockedRounds = [...new Set([original, ...(unknown || !original ? [current] : [])].filter(Boolean))],
      id = foundry.utils.randomID(),
      audit = {
        id,
        previous: old,
        blockedRounds,
        resolution: input.resolution.trim(),
        userId: game.user.id,
        ...(unknown
          ? {
              historyBefore: {
                declarations: structuredClone(history ?? null),
                reviews: structuredClone(reviews ?? null)
              }
            }
          : {})
      },
      nextHistory = { ...(map(history) ? history : {}), ...Object.fromEntries(blockedRounds.map(k => [k, id])) },
      nextReviews = { ...(map(reviews) ? reviews : {}), [id]: audit };
    const proof = () =>
      actor.system.dartingStyle === null &&
      same(actor.flags?.spycraft2?.dartingReviews?.[id], audit) &&
      blockedRounds.every(k => actor.flags?.spycraft2?.dartingDeclarations?.[k] === id);
    try {
      await actor.update({
        "system.dartingStyle": null,
        "flags.spycraft2.dartingDeclarations": nextHistory,
        "flags.spycraft2.dartingReviews": nextReviews
      });
    } catch (error) {
      if (!proof()) throw error;
    }
    if (!proof()) throw new Error(loc`Review the saved Darting Weapon recovery before retrying.`);
    return audit;
  });
}
