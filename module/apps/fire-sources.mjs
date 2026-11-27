import { hazardState } from "../rules/hazards.mjs";
import { readFireSource, reviewFireSourcePlan } from "../rules/fire-sources.mjs";
import { queueResources } from "../services/transactions.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";
import { same } from "../rules/equal.mjs";

const write = (actor, hazards) => actor.update({ "system.==hazards": hazards });

/** One original scarring roll per fire, with its intent saved before any dice. */
export async function rollFireSourceSave(actor, id) {
  if (!actor?.isOwner) return null;
  let attempt, previous;
  await queueResources([actor], async () => {
    const state = hazardState(actor.system),
      source = readFireSource(state, id);
    if (source.needsReview || source.scarChecked || source.suffered < 25)
      throw Error(loc`The GC must verify this fire's total and unresolved scarring save before rolling.`);
    if (source.scarRoll) {
      if (
        source.scarRoll.state === "posted" &&
        typeof source.scarRoll.messageUuid === "string" &&
        source.scarRoll.messageUuid
      ) {
        previous = source.scarRoll.messageUuid;
        return;
      }
      throw Error(loc`This fire's scarring roll needs GC review. Keep its actual dice and outcome before continuing.`);
    }
    attempt = foundry.utils.randomID();
    await write(actor, {
      ...state,
      fireSources: {
        ...state.fireSources,
        [id]: { ...source, scarRoll: { attempt, state: "started", messageUuid: null } }
      }
    });
  });
  if (previous) {
    const message = await fromUuid(previous);
    if (!message)
      throw Error(loc`The original scarring card is missing. The GC must verify its outcome without rolling again.`);
    ui.notifications.info(loc`Use this fire's original scarring save; no new dice were rolled.`);
    return message;
  }
  const posted = () =>
    [...(game.messages?.contents ?? game.messages ?? [])]
      .reverse()
      .find(
        message =>
          message.flags?.spycraft2?.actorUuid === actor.uuid &&
          message.flags.spycraft2.hazardSave?.fireAttempt === attempt &&
          !message.flags.spycraft2.superseded
      );
  const settle = async (message, failed = false) =>
    queueResources([actor], async () => {
      const state = hazardState(actor.system),
        source = readFireSource(state, id);
      if (source.scarRoll?.attempt !== attempt)
        throw Error(loc`The fire's scarring history changed. Ask the GC to review its actual save.`);
      const next = { ...source };
      if (message) next.scarRoll = { attempt, state: "posted", messageUuid: message.uuid };
      else if (failed) next.scarRoll = { attempt, state: "needsReview", messageUuid: null };
      else delete next.scarRoll;
      await write(actor, { ...state, fireSources: { ...state.fireSources, [id]: next } });
    });
  try {
    const result = await actor.rollSave("fort", {
      askContext: true,
      hazardSave: { kind: "scar", label: loc`Scarring`, dc: 15, fireSourceId: id, fireAttempt: attempt }
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

export async function markFireSourceScarring(actor, save) {
  return queueResources([actor], async () => {
    const state = hazardState(actor.system),
      source = readFireSource(state, save.fireSourceId);
    if (source.scarChecked || source.scarRoll?.attempt !== save.fireAttempt)
      throw Error(loc`Review this fire's original scarring outcome before applying it again.`);
    await write(actor, {
      ...state,
      ...(state.fire?.sourceId === save.fireSourceId ? { fire: { ...state.fire, scarChecked: true } } : {}),
      fireSources: {
        ...state.fireSources,
        [save.fireSourceId]: { ...source, scarChecked: true, scarRoll: { ...source.scarRoll, state: "resolved" } }
      }
    });
  });
}

export async function reviewFireSource(actor, id) {
  if (!actor?.isOwner || !game.user?.isGM) return null;
  const source = structuredClone(readFireSource(hazardState(actor.system), id));
  const input = await systemDialog.input({
    window: { title: loc`Review fire damage` },
    rejectClose: false,
    ok: { label: loc`Record review` },
    content: `<p>${loc`Verify all damage from this fire, including its first hit. Keep any scarring dice already rolled; apply an uncertain outcome by hand.`}</p><label>${loc`Fire name`} <input name="label" maxlength="100" value="${esc(source.label)}" required /></label><label>${loc`Actual damage suffered from this fire`} <input type="number" name="suffered" min="0" step="1" value="${source.suffered}" required /></label><label><input type="checkbox" name="scarChecked"${source.scarChecked ? " checked" : ""} /> ${loc`The scarring save and its effects are already resolved`}</label><label>${loc`What actually happened`} <textarea name="note" maxlength="500" required></textarea></label>`
  });
  if (!input) return null;
  return queueResources([actor], async () => {
    const state = hazardState(actor.system);
    if (!same(readFireSource(state, id), source))
      throw Error(loc`The fire damage changed while this review was open. Reopen it and verify the current total.`);
    const next = reviewFireSourcePlan(state, id, {
      ...input,
      suffered: Number(input.suffered),
      scarChecked: input.scarChecked === true,
      reviewer: game.user.id,
      at: game.time.worldTime
    });
    await write(actor, next);
    return next.fireSources[id];
  });
}
