import {
  vitalitySource,
  vitalitySourceEvidence,
  vitalityRollRecord,
  vitalityMessageTag,
  keptVitalityRoll,
  vitalityReviewRecord
} from "../rules/vitality.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
const owned = a => a?.type === "agent" && a.isOwner === true;
const validIndex = (a, i) => Number.isSafeInteger(i) && i > 0 && i < (a.system.progression?.length ?? 0);
const cloneProgression = a => a.system.progression.map(p => structuredClone(p));
function cache() {
  game.spycraft2 ??= {};
  return (game.spycraft2.pendingVitalityRolls ??= {});
}
const cacheKey = (a, id) => a.uuid + "|" + id;
async function commit(actor, patch, proof) {
  try {
    await actor.update(patch);
  } catch (error) {
    if (!proof()) throw error;
  }
  if (!proof()) throw new Error(loc`Review the recorded vitality source before retrying.`);
}
function restoreRoll(record) {
  const roll = Roll.fromJSON(JSON.stringify(record.rollData));
  if (roll._evaluated !== true || roll.formula !== record.formula || roll.total !== record.value)
    throw new Error(loc`Review the stored vitality roll data.`);
  return roll;
}
async function postStoredRoll(actor, record, roll) {
  const tag = vitalityMessageTag(record),
    candidates = [...(game.messages ?? [])].filter(
      m =>
        m.flags?.spycraft2?.vitalityRoll?.actorUuid === actor.uuid &&
        m.flags.spycraft2.vitalityRoll.levelId === record.id
    );
  if (candidates.some(m => !same(m.flags.spycraft2.vitalityRoll, tag)))
    throw new Error(loc`Review the conflicting vitality chat receipt.`);
  let message = candidates.find(m => m.id === record.messageId) ?? candidates[0];
  if (!message) {
    const sourceRoll = roll ?? restoreRoll(record);
    try {
      message = await sourceRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: loc`Original raw vitality — Career Level ${record.careerLevel}, ${foundry.utils.escapeHTML(record.className)} (1d${record.die}); Constitution and other vitality bonuses apply separately.`,
        flags: { spycraft2: { vitalityRoll: tag } }
      });
    } catch (error) {
      message = [...(game.messages ?? [])].find(m => same(m.flags?.spycraft2?.vitalityRoll, tag));
      if (!message) throw error;
    }
  }
  const current = actor.flags?.spycraft2?.vitalityRolls?.[record.id];
  if (!current || current.value !== record.value || current.classId !== record.classId)
    throw new Error(loc`The stored vitality receipt changed before its chat binding.`);
  if (current.messageId !== message.id)
    await commit(
      actor,
      { ["flags.spycraft2.vitalityRolls." + record.id + ".messageId"]: message.id },
      () => actor.flags?.spycraft2?.vitalityRolls?.[record.id]?.messageId === message.id
    );
  return message;
}
async function ensureLevelId(actor, source) {
  if (source.levelId) return source;
  const id = foundry.utils.randomID(),
    progression = cloneProgression(actor);
  progression[source.index].vitalityRollId = id;
  await commit(
    actor,
    { "system.progression": progression },
    () => actor.system.progression[source.index]?.vitalityRollId === id
  );
  return vitalitySource(actor, source.index);
}
export async function rollCareerVitality(actor, index) {
  if (!owned(actor) || !validIndex(actor, index)) return null;
  return queueResources([actor], async () => {
    if (!owned(actor)) throw new Error(loc`You must own the character before rolling vitality.`);
    let source = vitalitySource(actor, index);
    if (source.value > 0) {
      const record = source.levelId && actor.flags?.spycraft2?.vitalityRolls?.[source.levelId];
      if (record)
        try {
          await postStoredRoll(actor, record);
        } catch (error) {
          globalThis.ui?.notifications?.warn?.(loc`Vitality remains recorded. ${error.message}`);
        }
      return { total: source.value, recorded: true, legacy: !record, levelId: source.levelId };
    }
    if (source.reviewId || (source.levelId && actor.flags?.spycraft2?.vitalityRolls?.[source.levelId]))
      throw new Error(
        loc`The current vitality value disagrees with its recorded history. Review it before continuing.`
      );
    const kept = !source.levelId && keptVitalityRoll(actor, source);
    if (kept) {
      const progression = cloneProgression(actor);
      Object.assign(progression[index], { vitality: kept.value, vitalityRollId: kept.id });
      await commit(
        actor,
        { "system.progression": progression },
        () =>
          actor.system.progression[index]?.vitalityRollId === kept.id &&
          actor.system.progression[index]?.vitality === kept.value
      );
      globalThis.ui?.notifications?.info?.(
        loc`Career Level ${kept.careerLevel} keeps its earlier vitality roll of ${kept.value}; it is not rolled again.`
      );
      return { total: kept.value, recorded: true, kept: true, levelId: kept.id };
    }
    source = await ensureLevelId(actor, source);
    const expected = vitalitySourceEvidence(source),
      key = cacheKey(actor, source.levelId),
      pending = cache()[key];
    let record, roll;
    if (pending) {
      if (pending.source !== expected)
        throw new Error(loc`Review the pending raw vitality result after its class/level context changed.`);
      record = pending.record;
      roll = restoreRoll(record);
    } else {
      roll = await new Roll(`1d${source.die}`).evaluate();
      if (!owned(actor) || vitalitySourceEvidence(vitalitySource(actor, index)) !== expected)
        throw new Error(loc`The vitality class/level source changed during the roll.`);
      record = vitalityRollRecord(actor, source, roll, game.time.worldTime);
      cache()[key] = { source: expected, record };
    }
    if (!owned(actor) || vitalitySourceEvidence(vitalitySource(actor, index)) !== expected)
      throw new Error(loc`The vitality source changed before its result was recorded.`);
    const progression = cloneProgression(actor);
    progression[index].vitality = record.value;
    await commit(
      actor,
      { "system.progression": progression, ["flags.spycraft2.vitalityRolls." + record.id]: record },
      () =>
        actor.system.progression[index]?.vitalityRollId === record.id &&
        actor.system.progression[index]?.vitality === record.value &&
        same(actor.flags?.spycraft2?.vitalityRolls?.[record.id], record)
    );
    delete cache()[key];
    try {
      await postStoredRoll(actor, record, roll);
    } catch (error) {
      globalThis.ui?.notifications?.warn?.(loc`Vitality remains recorded. ${error.message}`);
    }
    return roll;
  });
}
export async function reviewCareerVitality(actor, index, options = {}) {
  if (!owned(actor) || !validIndex(actor, index)) return null;
  const expected = vitalitySourceEvidence(vitalitySource(actor, index)),
    initial = vitalitySource(actor, index);
  let input = options;
  if (!Object.keys(input).length) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Record or review raw vitality` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Career Level ${index + 1}, ${esc(initial.className)}, d${initial.die}. Current raw value ${initial.value || loc`not recorded`}. Record an external result or correct the existing record; this does not reroll the die.`}</p><label>${loc`Actual raw die result`} <input name="value" type="number" min="1" max="${initial.die}" step="1" value="${initial.value || ""}" required /></label><label>${loc`Source/review note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this actual raw result and review`}</label><p>${loc`Constitution and other vitality bonuses apply separately. Current vitality is not healed by this review. First-career vitality remains automatic maximum; action dice cannot boost vitality gains (pp.60–61).`}</p></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) return null;
  return queueResources([actor], async () => {
    if (!owned(actor) || vitalitySourceEvidence(vitalitySource(actor, index)) !== expected)
      throw new Error(loc`The vitality source changed before review. Open it again.`);
    const parsed =
      typeof input.value === "number"
        ? input.value
        : typeof input.value === "string" && /^[1-9]\d*$/.test(input.value)
          ? Number(input.value)
          : NaN;
    // Validate everything before assigning an ID or changing a legacy row.
    const id = foundry.utils.randomID(),
      source = vitalitySource(actor, index),
      withId = { ...source, levelId: source.levelId || foundry.utils.randomID() },
      record = vitalityReviewRecord(actor, withId, { ...input, value: parsed }, id, game.time.worldTime),
      progression = cloneProgression(actor);
    Object.assign(progression[index], { vitality: record.value, vitalityRollId: withId.levelId, vitalityReviewId: id });
    await commit(
      actor,
      { "system.progression": progression, ["flags.spycraft2.vitalityReviews." + id]: record },
      () =>
        actor.system.progression[index]?.vitalityRollId === withId.levelId &&
        actor.system.progression[index]?.vitality === record.value &&
        actor.system.progression[index]?.vitalityReviewId === id &&
        same(actor.flags?.spycraft2?.vitalityReviews?.[id], record)
    );
    delete cache()[cacheKey(actor, withId.levelId)];
    return record;
  });
}
