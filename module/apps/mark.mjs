import { markSource, markPlan, markRecordValid, markDisclosurePlan } from "../rules/mark.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
const state = a => ({ ...a.system, usagePeriods: a.usagePeriods }),
  recipients = a =>
    game.users?.filter?.(u => u.isGM || a.testUserPermission?.(u, "OWNER")).map(u => u.id) ?? [game.user.id];
export async function useMark(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  let input = options;
  if (!Object.keys(input).length) {
    const choices = Object.entries(CONFIG.SPYCRAFT.skills)
      .map(([k, s]) => `<option value="${k}">${foundry.utils.escapeHTML(s.name)}</option>`)
      .join("");
    input = await formDialog({
      title: loc`Mark — name three skills`,
      intro: loc`One character in line of sight; three different skills. A free action, usable once per active Style feat per session (p.203). The GC discloses the target’s actual total bonuses after the declaration.`,
      fields: [
        { text: "target", label: loc`Target character`, maxlength: 200 },
        raw(
          [1, 2, 3]
            .map(
              n =>
                `<label>${loc`Skill ${n}`}<select name="skill${n}"><option value="">${loc`Choose a skill`}</option>${choices}</select></label>`
            )
            .join("")
        ),
        { check: "lineOfSightConfirmed", label: loc`The GC confirms this one character is within my line of sight` },
        { check: "freeActionConfirmed", label: loc`This is a legal free action now` }
      ]
    });
    if (!input) return null;
    input = { ...input, skills: [input.skill1, input.skill2, input.skill3] };
  }
  const expected = markPlan(state(actor), CONFIG.SPYCRAFT, actor.mentalLeapCombatContext(), input),
    source = markSource(state(actor));
  return actor.useLimitedAbility(
    "mark",
    async () => {
      const guard = () => {
        if (
          !same(markSource(state(actor)), source) ||
          !same(markPlan(state(actor), CONFIG.SPYCRAFT, actor.mentalLeapCombatContext(), input), expected)
        )
          throw new Error(loc`The Mark source, session, target or free-action timing changed before posting.`);
      };
      guard();
      const records = actor.flags.spycraft2?.markObservations ?? {},
        corrections = actor.flags.spycraft2?.markCorrections ?? [];
      if (
        Object.entries(records).some(([id, r]) => !markRecordValid(r, CONFIG.SPYCRAFT) || id !== r.id) ||
        !Array.isArray(corrections) ||
        corrections.some(r => !r || typeof r.session !== "string")
      )
        throw new Error(loc`The GC must review the saved Mark history before another observation.`);
      if ([...Object.values(records), ...corrections].filter(r => r.session === source.session).length >= source.limit)
        throw new Error(loc`This session’s Mark observations have all been used.`);
      const id = "mark_" + foundry.utils.randomID(),
        use = structuredClone(actor.system.resourceUses.mark),
        record = { id, ...expected, use, at: game.time?.worldTime ?? 0, disclosure: null },
        path = "flags.spycraft2.markObservations." + id;
      if (!markRecordValid(record, CONFIG.SPYCRAFT) || records[id])
        throw new Error(loc`The Mark declaration needs its reserved session use.`);
      try {
        await actor.update({ [path]: record });
        guard();
        if (!same(actor.flags.spycraft2?.markObservations?.[id], record))
          throw new Error(loc`The Mark declaration was not saved.`);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          whisper: recipients(actor),
          content: foundry.utils.escapeHTML(
            loc`Mark: ${record.target}; ${record.skills.map(k => CONFIG.SPYCRAFT.skills[k].name).join(", ")}. Free action; GC disclosure pending.`
          ),
          flags: { spycraft2: { actorUuid: actor.uuid, markObservation: record, actionDiceAllowed: false } }
        });
        return record;
      } catch (error) {
        const posted = postedReceipt(actor, "markObservation", id);
        if (posted) return record;
        if (actor.flags.spycraft2?.markObservations?.[id])
          try {
            await actor.update({ ["flags.spycraft2.markObservations.-=" + id]: null });
          } catch {
            ui.notifications.warn(
              loc`The Mark declaration may still exist; its use remains spent. Ask the GC to review its history and counter.`
            );
            return { ...record, needsReview: true };
          }
        throw error;
      }
    },
    { workflow: "markObservation" }
  );
}
export async function discloseMark(actor, id, options = {}) {
  if (!game.user?.isGM || !actor.isOwner) throw new Error(loc`Only the owning GC can disclose Mark’s target bonuses.`);
  const original = structuredClone(actor.flags.spycraft2?.markObservations?.[id]);
  if (!markRecordValid(original, CONFIG.SPYCRAFT) || original.id !== id || original.disclosure)
    throw new Error(loc`Choose a valid pending Mark observation.`);
  let input = options;
  if (!Object.keys(input).length) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`GC: disclose Mark skill bonuses` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`${esc(original.target)}: disclose the actual total bonuses for the three named skills. Include the relevant attribute/focus or other context where needed; this does not roll checks or disclose the rest of the target’s sheet.`}</p>${original.skills.map(k => `<label>${loc`${esc(CONFIG.SPYCRAFT.skills[k].name)} total bonus`} <input name="bonus_${k}" type="number" step="1" required /></label><label>${loc`Bonus context`} <input name="context_${k}" maxlength="500" /></label>`).join("")}<label><input name="confirmed" type="checkbox" /> ${loc`I confirm these are this target’s actual total skill bonuses when observed`}</label></div>`
    });
    if (!input) return null;
    input = {
      confirmed: input.confirmed,
      bonuses: Object.fromEntries(
        original.skills.map(k => [k, String(input["bonus_" + k] ?? "").trim() ? Number(input["bonus_" + k]) : NaN])
      ),
      contexts: Object.fromEntries(original.skills.map(k => [k, input["context_" + k] ?? ""]))
    };
  }
  const disclosure = {
    ...markDisclosurePlan(original, CONFIG.SPYCRAFT, input),
    reviewedBy: game.user.id,
    at: game.time?.worldTime ?? 0
  };
  return queueResources([actor], async () => {
    if (!game.user?.isGM || !actor.isOwner || !same(actor.flags.spycraft2?.markObservations?.[id], original))
      throw new Error(loc`The Mark observation or GC ownership changed during disclosure.`);
    try {
      await actor.update({ ["flags.spycraft2.markObservations." + id + ".disclosure"]: disclosure });
    } catch (error) {
      if (!same(actor.flags.spycraft2?.markObservations?.[id]?.disclosure, disclosure)) throw error;
    }
    return disclosure;
  });
}
export async function correctMark(actor, id, options = {}) {
  if (
    !game.user?.isGM ||
    !actor.isOwner ||
    typeof id !== "string" ||
    !/^mark_[A-Za-z0-9_-]+$/.test(id) ||
    !Object.hasOwn(actor.flags.spycraft2?.markObservations ?? {}, id)
  )
    throw new Error(loc`Only the owning GC can correct this Mark observation.`);
  const original = structuredClone(actor.flags.spycraft2.markObservations[id]),
    history = structuredClone(actor.flags.spycraft2.markCorrections ?? []);
  let input = options;
  if (!Object.keys(input).length) {
    input = await formDialog({
      title: loc`GC: correct Mark observation`,
      intro: loc`Archive an erroneous observation. This does not refund its spent session use; ordinary counter review remains separate.`,
      fields: [
        { text: "reason", label: loc`Reason`, maxlength: 1000 },
        { check: "confirmed", label: loc`I confirm this observation is erroneous` }
      ]
    });
    if (!input) return null;
  }
  if (
    input.confirmed !== true ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 1000 ||
    !Array.isArray(history)
  )
    throw new Error(loc`Confirm the erroneous observation and explain its correction.`);
  return queueResources([actor], async () => {
    if (
      !game.user?.isGM ||
      !actor.isOwner ||
      !same(actor.flags.spycraft2.markObservations[id], original) ||
      !same(actor.flags.spycraft2.markCorrections ?? [], history)
    )
      throw new Error(loc`The Mark history changed during correction.`);
    const entry = {
      id,
      record: original,
      session:
        typeof original.session === "string" ? original.session : String(actor.usagePeriods.session ?? "initial"),
      reason: input.reason.trim(),
      reviewedBy: game.user.id,
      at: game.time?.worldTime ?? 0
    };
    try {
      await actor.update({
        ["flags.spycraft2.markObservations.-=" + id]: null,
        "flags.spycraft2.markCorrections": [...history, entry]
      });
    } catch (error) {
      if (
        Object.hasOwn(actor.flags.spycraft2?.markObservations ?? {}, id) ||
        !same(actor.flags.spycraft2?.markCorrections, [...history, entry])
      )
        throw error;
    }
    return entry;
  });
}
