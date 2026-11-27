import { hazardState } from "../rules/hazards.mjs";
import {
  acidInjuryDue,
  readAcidSource,
  writeAcidSource,
  reviewAcidSourcePlan,
  legacyAcidSourcePlan
} from "../rules/acid-sources.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
import { esc } from "../html.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { postUndo } from "./undo.mjs";

const write = (actor, hazards) => actor.update({ "system.==hazards": hazards });

/** Reserve the attack's original injury roll before any dice, including after the acid was washed away. */
export async function rollAcidSourceInjury(actor, id) {
  if (!actor?.isOwner) return null;
  let attempt, previous;
  await queueResources([actor], async () => {
    const state = hazardState(actor.system),
      source = readAcidSource(state, id);
    if (Object.values(state.acidSources ?? {}).some(row => row.roundAttempt?.state === "applying"))
      throw Error(loc`Finish or review the interrupted acid round before rolling another injury save.`);
    if (!acidInjuryDue(source) || source.needsReview || source.roundAttempt?.state === "applying")
      throw Error(loc`Verify this attack's actual acid total and any pending round before rolling its injury save.`);
    if (source.injuryRoll) {
      if (source.injuryRoll.state === "posted" && source.injuryRoll.messageUuid) {
        previous = source.injuryRoll.messageUuid;
        return;
      }
      throw Error(loc`This acid attack's injury roll needs GC review. Keep its original dice and outcome.`);
    }
    attempt = foundry.utils.randomID();
    await write(
      actor,
      writeAcidSource(state, id, { ...source, injuryRoll: { attempt, state: "started", messageUuid: null } })
    );
  });
  if (previous) {
    const message = await fromUuid(previous);
    if (!message)
      throw Error(loc`The original acid injury card is missing. The GC must verify its outcome without rolling again.`);
    ui.notifications.info(loc`Use this acid attack's original injury save; no new dice were rolled.`);
    return message;
  }
  const posted = () =>
    [...(game.messages?.contents ?? game.messages ?? [])]
      .reverse()
      .find(
        message =>
          message.flags?.spycraft2?.actorUuid === actor.uuid &&
          message.flags.spycraft2.hazardSave?.acidAttempt === attempt &&
          !message.flags.spycraft2.superseded
      );
  const settle = async (message, failed = false) =>
    queueResources([actor], async () => {
      const state = hazardState(actor.system),
        source = readAcidSource(state, id);
      if (source.injuryRoll?.attempt !== attempt)
        throw Error(loc`The acid injury history changed. The GC must review the actual original save.`);
      const next = { ...source };
      if (message)
        next.injuryRoll = { attempt, state: source.injuryChecked ? "resolved" : "posted", messageUuid: message.uuid };
      else if (failed) next.injuryRoll = { attempt, state: "needsReview", messageUuid: null };
      else delete next.injuryRoll;
      await write(actor, writeAcidSource(state, id, next));
    });
  try {
    const result = await actor.rollSave("fort", {
      askContext: true,
      hazardSave: {
        kind: "typedInjury",
        label: loc`Acid injury`,
        dc: 15,
        type: "acid",
        at: 25,
        ability: "cha",
        where: "acid",
        acidSourceId: id,
        acidAttempt: attempt
      }
    });
    const message = result?.uuid ? result : posted();
    await settle(message);
    return message ?? null;
  } catch (error) {
    const message = posted();
    await settle(message, true);
    if (message) return message;
    throw error;
  }
}

export async function markAcidSourceInjury(actor, save) {
  return queueResources([actor], async () => {
    const state = hazardState(actor.system),
      source = readAcidSource(state, save.acidSourceId);
    if (source.injuryChecked || source.injuryRoll?.attempt !== save.acidAttempt)
      throw Error(loc`Review this acid attack's original injury outcome before applying it again.`);
    await write(
      actor,
      writeAcidSource(state, save.acidSourceId, {
        ...source,
        injuryChecked: true,
        injuryRoll: { ...source.injuryRoll, state: "resolved" }
      })
    );
  });
}

export async function migrateAcidHistory(actor) {
  if (!actor?.isOwner) return null;
  return queueResources([actor], async () => {
    const state = hazardState(actor.system);
    if (!state.acid || Array.isArray(state.acid.sourceIds)) return null;
    const id = `legacy-${foundry.utils.randomID()}`;
    await write(actor, legacyAcidSourcePlan(state, id));
    return id;
  });
}

export async function reviewAcidSource(actor, id) {
  if (!actor?.isOwner || !game.user?.isGM) return null;
  const original = structuredClone(readAcidSource(hazardState(actor.system), id)),
    p = original.protection ?? {};
  const input = await systemDialog.input({
    window: { title: loc`Review acid attack` },
    rejectClose: false,
    ok: { label: loc`Record review` },
    content: `<p>${loc`Verify one original attack, its actual damage and where it is in the round. Keep original dice. Resolve uncertain effects by hand. If earlier history combines attacks, finish those exposures manually and record no acid remaining; otherwise verify one original attack before continuing.`}</p><label>${loc`Attack name`} <input name="label" maxlength="100" value="${esc(original.label)}" required /></label><label>${loc`Acid remaining before DR`} <input type="number" name="damage" min="0" step="1" value="${original.damage}" required /></label><label>${loc`Actual damage suffered from this attack`} <input type="number" name="suffered" min="0" step="1" value="${original.suffered}" required /></label><label>${loc`Verified timing`} <select name="phase">${[
      ["end", loc`After damage: halve at round end`],
      ["round", loc`After halving: apply next round`],
      ["gone", loc`Gone: keep injury history`]
    ]
      .map(
        ([value, label]) => `<option value="${value}"${original.phase === value ? " selected" : ""}>${label}</option>`
      )
      .join(
        ""
      )}</select></label><label>${loc`Original AP (required while acid remains)`} <input type="number" name="ap" min="1" step="1" value="${p.ap ?? ""}" /></label><label>${loc`Remaining total DR after AP`} <input type="number" name="reduction" min="0" step="1" value="${p.reduction ?? ""}" /></label><label>${loc`Remaining non-armor DR after AP`} <input type="number" name="unarmoredReduction" min="0" step="1" value="${p.unarmoredReduction ?? ""}" /></label><label><input type="checkbox" name="armorHit"${p.armorHit ? " checked" : ""} /> ${loc`The original acid struck armor rather than clothes`}</label><label><input type="checkbox" name="armorPresent"${p.armorPresent ? " checked" : ""} /> ${loc`That armor still supplies DR against this attack`}</label><label><input type="checkbox" name="armorSaveVerified" /> ${loc`The affected armor's actual Damage saves are resolved`}</label><label><input type="checkbox" name="injuryChecked"${original.injuryChecked ? " checked" : ""} /> ${loc`This attack's injury save and effects are already resolved`}</label><label><input type="checkbox" name="singleAttackVerified" /> ${loc`The GC verified that any remaining acid belongs to one original attack`}</label><label>${loc`What actually happened`} <textarea name="note" maxlength="500" required></textarea></label>`
  });
  if (!input) return null;
  return queueResources([actor], async () => {
    const state = hazardState(actor.system);
    if (!same(readAcidSource(state, id), original))
      throw Error(loc`The acid attack changed. Reopen the review and verify the current history.`);
    const next = reviewAcidSourcePlan(state, id, {
      ...input,
      damage: Number(input.damage),
      suffered: Number(input.suffered),
      injuryChecked: input.injuryChecked === true,
      protection: ["ap", "reduction", "unarmoredReduction"].some(
        key => input[key] == null || String(input[key]).trim() === ""
      )
        ? null
        : {
            ap: Number(input.ap),
            reduction: Number(input.reduction),
            unarmoredReduction: Number(input.unarmoredReduction),
            armorHit: input.armorHit === true,
            armorPresent: input.armorPresent === true,
            armorSaveVerified: input.armorSaveVerified === true,
            armorUuid: p.armorUuid ?? ""
          },
      reviewer: game.user.id,
      at: game.time.worldTime
    });
    await write(actor, next);
    const sourcePath = `system.hazards.acidSources.${id}`;
    try {
      await postUndo(loc`Acid attack reviewed: ${original.label}`, [
        {
          uuid: actor.uuid,
          name: actor.name,
          restore: [
            [sourcePath, original],
            ["system.hazards.acid", state.acid]
          ],
          expect: [
            [sourcePath, next.acidSources[id]],
            ["system.hazards.acid", next.acid]
          ],
          whole: [sourcePath, "system.hazards.acid"],
          unset: [],
          created: [],
          removed: [],
          combatants: []
        }
      ]);
    } catch {
      ui.notifications.warn(
        loc`The acid review was saved, but its Undo note could not be posted. Use this review again to correct it.`
      );
    }
    return next.acidSources[id];
  });
}
