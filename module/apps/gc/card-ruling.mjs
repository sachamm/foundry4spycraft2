/**
 * A GC ruling recorded on a roll card.
 *
 * The GC may decide a roll counts as a success or a failure whatever the dice say. The ruling is kept on the card with
 * its reason and shown as a line there (right-click the card in the chat log), so the table can see later what was decided and why. It is a record only: the
 * roll's dice, total and any settlement already made are left as they are, and the GC carries the ruling through.
 */
import { checkFlavor } from "../../rules/outcomes.mjs";
import { formDialog } from "../dialog-kit.mjs";
import { loc } from "../../i18n.mjs";

export const RULING_OUTCOMES = ["success", "failure"];

/** The card's flags with a ruling set or, for an empty outcome, taken off. Null when the input is not a ruling. */
export function withGCRuling(check, { outcome = "", note = "" } = {}, by = "") {
  if (outcome === "") {
    const { gcRuling: _gone, ...rest } = check;
    return rest;
  }
  if (!RULING_OUTCOMES.includes(outcome)) return null;
  return {
    ...check,
    gcRuling: {
      outcome,
      note: String(note ?? "")
        .trim()
        .slice(0, 200),
      by
    }
  };
}

export async function recordGCRuling(message, input = null) {
  if (!game.user?.isGM) throw Error(loc`Only the GC records a ruling on a roll.`);
  const check = message.flags?.spycraft2 ?? {};
  input ??= await formDialog({
    title: loc`GC ruling on this roll`,
    ok: loc`Record the ruling`,
    intro: loc`The ruling is written on the card with your reason. The dice and anything already applied stay as they are.`,
    fields: [
      {
        select: "outcome",
        label: loc`This roll counts as`,
        selected: check.gcRuling?.outcome ?? "success",
        options: [
          ["success", loc`A success`],
          ["failure", loc`A failure`],
          ["", loc`What the dice say (remove the ruling)`]
        ]
      },
      { text: "note", label: loc`Reason`, maxlength: 200, value: check.gcRuling?.note ?? "" }
    ]
  });
  if (!input) return null;
  const next = withGCRuling(check, input, game.user.name);
  if (!next) return null;
  await message.update({
    "flags.spycraft2.gcRuling": next.gcRuling ?? null,
    ...(Number.isFinite(check.rawTotal) ? { flavor: checkFlavor(next) } : {})
  });
  return next.gcRuling ?? null;
}

/** The chat log's right-click entry for a roll card, in the shape Foundry 14 reads. Seen by the GC only. */
export function rulingMenuEntry() {
  const card = li => game.messages?.get((li?.dataset ?? li?.[0]?.dataset)?.messageId);
  return {
    label: loc`GC ruling on this roll…`,
    icon: "fa-solid fa-gavel",
    visible: li => {
      const check = card(li)?.flags?.spycraft2;
      return game.user?.isGM === true && Number.isFinite(check?.rawTotal) && !check.superseded;
    },
    onClick: (_event, li) => recordGCRuling(card(li)).catch(error => ui.notifications.warn(error.message))
  };
}

/** Add the ruling entry to the chat log's right-click menu. Call once at setup. */
export function installGCRulingMenu() {
  Hooks.on("getChatMessageContextOptions", (_app, entries) => {
    entries.push(rulingMenuEntry());
  });
}
