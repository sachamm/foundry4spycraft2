import { SUBDUAL_ATTACK_KINDS, subdualDefenseSourceSnapshot } from "../rules/subdual-defense.mjs";
import {
  stressDefenseSource,
  stressDefenseSourceSnapshot,
  fireStressDefenseSourceSnapshot
} from "../rules/stress-defense.mjs";
import {
  damageLedgerSnapshot,
  reviewDamageLedgerPlan,
  damageLedgerEventPlan,
  validateDamageLedger
} from "../rules/accumulated-damage.mjs";
import { queueResources } from "../rules/transactions.mjs";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const whole = value => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) return Number(value);
  throw new Error("Enter a nonnegative whole damage total.");
};
const owned = actor => actor?.type === "agent" && actor.isOwner === true;
async function commit(actor, patch, proved) {
  try {
    await actor.update(patch);
  } catch (error) {
    if (!proved()) throw error;
  }
  if (!proved()) throw new Error("Verify the actual damage-ledger receipt before retrying this event.");
}
export async function reviewDamageLedger(actor, options = {}) {
  if (!owned(actor) || !game.user.isGM) return null;
  const expected = damageLedgerSnapshot(actor);
  let input = options;
  if (!Object.keys(input).length) {
    const ledger = expected.ledger,
      esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "GC review — accumulated damage" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Confirm the actual accumulated totals. An uninitialized ledger has no assumed zero balance. Resolve any recovery and conditions separately before recording a correction.</p><label>Stress <input name="stress" type="number" min="0" step="1" value="${ledger ? esc(ledger.stress) : ""}" required /></label><label>Subdual <input name="subdual" type="number" min="0" step="1" value="${ledger ? esc(ledger.subdual) : ""}" required /></label><label>GC review note <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> I checked both actual totals; this does not heal or remove conditions automatically</label></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) return null;
  return queueResources([actor], async () => {
    if (!owned(actor) || !game.user.isGM)
      throw new Error("Only the owning GC may initialize or correct accumulated totals.");
    const id = foundry.utils.randomID(),
      plan = reviewDamageLedgerPlan(
        damageLedgerSnapshot(actor),
        expected,
        { ...input, stress: whole(input.stress), subdual: whole(input.subdual) },
        id,
        game.user.id,
        game.time.worldTime
      );
    await commit(
      actor,
      { "system.accumulatedDamage": plan.ledger, ["flags.spycraft2.damageLedgerReviews." + id]: plan.review },
      () =>
        same(actor.system.accumulatedDamage, plan.ledger) &&
        same(actor.flags?.spycraft2?.damageLedgerReviews?.[id], plan.review)
    );
    return plan.review;
  });
}
export async function applyAccumulatedDamage(actor, options = {}) {
  if (!owned(actor)) return null;
  const expected = damageLedgerSnapshot(actor);
  validateDamageLedger(expected.ledger);
  let input = options,
    defenseBefore = null,
    fireDefenseBefore = null,
    resistanceLabel = "not prepared";
  try {
    defenseBefore = stressDefenseSourceSnapshot(actor.system);
    fireDefenseBefore = fireStressDefenseSourceSnapshot(actor.system);
    resistanceLabel = String(stressDefenseSource(actor.system).resistance);
  } catch {}
  const subdualBefore = {};
  for (const kind of Object.keys(SUBDUAL_ATTACK_KINDS))
    try {
      subdualBefore[kind] = subdualDefenseSourceSnapshot(actor.system, kind);
    } catch {}
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Record stress/subdual damage" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Recorded stress ${expected.ledger.stress}; subdual ${expected.ledger.subdual}. Record one GC-confirmed event. Choose whether the amount is final or still needs the prepared defenses below.</p><label>Unique source reference <input name="source" maxlength="300" required /></label><p>Use the attack/check reference or a distinct GC incident reference. Reusing the same reference cannot apply the same damage twice.</p><label>Type <select name="kind"><option value="stress">Stress</option><option value="subdual">Subdual</option></select></label><label>Damage calculation <select name="damageMode"><option value="net">Final damage after all defenses</option><option value="stressBeforeResistance">Stress before prepared stress resistance</option><option value="fireStressBeforeDefenses">Stress caused by fire, before Firefighter Training and stress resistance</option><option value="subdualBeforeDefenses">Subdual before listed DR and resistance</option></select></label><p>Prepared stress resistance: ${resistanceLabel}. In stress-before-resistance mode, include any other separately adjudicated defenses in the entered amount; do not subtract this prepared resistance yourself. For fire-caused stress, use the fire-stress mode only when the entered amount has not yet been halved by Firefighter Training or reduced by stress resistance. That mode halves the stress (rounded down) before prepared resistance, when the feat is earned. The amount is stress damage, not the underlying fire damage. Final-damage mode applies neither defense again. Stress ignores all DR.</p><fieldset><legend>Subdual defense calculation</legend><label>Actual attack source <select name="attackKind"><option value="">Choose for automatic subdual defenses</option>${Object.entries(
        SUBDUAL_ATTACK_KINDS
      )
        .map(
          ([id, label]) =>
            `<option value="${id}">${label} (DR ${Number.isSafeInteger(actor.system.armorDRByAttack?.[id]) ? actor.system.armorDRByAttack[id] : "unavailable"})</option>`
        )
        .join(
          ""
        )}</select></label><label>Armor-piercing points <input name="armorPiercing" type="number" min="0" step="1" value="0" /></label><label><input name="armorPiercingAll" type="checkbox" /> This damage has AP(all)</label><p>AP reduces the listed DR before it becomes twice as effective. DR stopping the hit still causes1 subdual bruising damage; prepared subdual resistance applies afterward. Use final damage when a special rule changes these defenses or accompanying effects.</p></fieldset><label>New damage amount <input name="newDamage" type="number" min="0" step="1" required /></label><label><input name="criticalHit" type="checkbox" /> This event came from a critical hit</label><label><input name="confirmed" type="checkbox" /> The GC confirmed this event, damage calculation and any separately adjudicated defenses</label><p>Each required save is retained for separate resolution, in order. This records damage, without rolling saves or applying conditions, level loss or recovery.</p></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) return null;
  return queueResources([actor], async () => {
    if (!owned(actor)) throw new Error("Ownership changed before damage was recorded.");
    const id = foundry.utils.randomID(),
      plan = damageLedgerEventPlan(
        actor.system,
        damageLedgerSnapshot(actor),
        expected,
        {
          ...input,
          newDamage: whole(input.newDamage),
          ...(input.damageMode === "subdualBeforeDefenses"
            ? {
                armorPiercing:
                  input.armorPiercing === undefined || input.armorPiercing === "" ? 0 : whole(input.armorPiercing),
                armorPiercingAll: input.armorPiercingAll ?? false
              }
            : {})
        },
        id,
        game.time.worldTime
      );
    if (plan.duplicate) return plan.record;
    if (
      plan.record.request.damageMode === "fireStressBeforeDefenses" &&
      fireStressDefenseSourceSnapshot(actor.system) !== fireDefenseBefore
    )
      throw new Error(
        "Firefighter Training or prepared stress resistance changed while fire stress was being recorded. Review the amount again."
      );
    if (plan.record.defenseContext?.kind === "stress" && stressDefenseSourceSnapshot(actor.system) !== defenseBefore)
      throw new Error("Prepared stress resistance changed while damage was being recorded. Review the amount again.");
    if (
      plan.record.defenseContext?.kind === "subdual" &&
      subdualDefenseSourceSnapshot(actor.system, plan.record.defenseContext.attackKind) !==
        subdualBefore[plan.record.defenseContext.attackKind]
    )
      throw new Error("Prepared subdual defenses changed while damage was being recorded. Review the amount again.");
    await commit(
      actor,
      { "system.accumulatedDamage": plan.ledger, ["flags.spycraft2.damageEvents." + id]: plan.record },
      () =>
        same(actor.system.accumulatedDamage, plan.ledger) &&
        same(actor.flags?.spycraft2?.damageEvents?.[id], plan.record)
    );
    return plan.record;
  });
}
