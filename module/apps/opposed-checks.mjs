/**
 * Opposed checks (p.91): compare a posted check with the other side's result and confirm who won.
 *
 * "Compare with an opposing check" on a skill check lists the recent results in chat. The check is confirmed as a
 * success or failure against the other result; when the viewer also owns the other check, it is confirmed too.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { opposedOutcome } from "../rules/damage-application.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const RECENT = 40;
const visible = message => !message.blind || game.user?.isGM === true;
const plainText = html =>
  String(html ?? "")
    .replace(/<br\s*\/?>.*$/is, "")
    .replace(/<[^>]+>/g, "")
    .trim();

/**
 * Results posted lately that a check can be compared with: this system's checks, and any other roll that has a total.
 * @returns {{message, uuid, name, title, total, bonus, check}[]} newest first
 */
export function recentResults({ exclude = null, limit = RECENT } = {}) {
  const rows = [];
  const messages = [...(game.messages ?? [])].slice(-limit).reverse();
  for (const message of messages) {
    if (message === exclude || !visible(message)) continue;
    const check = message.flags?.spycraft2,
      own = check && Number.isFinite(check.effectiveTotal) && check.checkKind !== "damage" && !check.superseded;
    const total = own ? check.effectiveTotal : message.rolls?.[0]?.total;
    if (!Number.isFinite(total) || (check && !own)) continue;
    rows.push({
      message,
      uuid: message.uuid ?? message.id,
      name: message.speaker?.alias ?? message.alias ?? loc`Unknown`,
      title: plainText(message.flavor).slice(0, 60),
      total,
      bonus: own && Number.isFinite(check.naturalDie) ? check.rawTotal - check.naturalDie : null,
      check: own ? check : null
    });
  }
  return rows;
}

/** One line naming the latest results, for a dialog that asks for typed totals. */
export function recentResultsHint(limit = 6) {
  const rows = recentResults({ limit: 20 }).slice(0, limit);
  if (!rows.length) return "";
  return loc`Latest results in chat: ${rows.map(row => `${esc(row.name)} ${row.total}${row.title ? ` (${esc(row.title)})` : ""}`).join("; ")}.`;
}

async function mark(message, opposed) {
  try {
    await message.update({ "flags.spycraft2.opposed": opposed });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare a posted check with an opposing result.
 * @param {ChatMessage} message  the check being settled
 * @param {object} [options]     { otherUuid } or { total }, and { breakTies }, to skip the dialog
 */
export async function compareOpposed(message, options = {}) {
  const check = message.flags?.spycraft2,
    actor = check?.actorUuid ? fromUuidSync(check.actorUuid) : null;
  if (!actor?.isOwner || !Number.isFinite(check.effectiveTotal)) return null;
  if (check.resolved || check.superseded)
    return ui.notifications.warn(loc`This check has already been resolved or replaced.`);
  const rows = recentResults({ exclude: message }).filter(row => row.check?.actorUuid !== check.actorUuid);
  let input = options;
  if (input.otherUuid === undefined && input.total === undefined) {
    input = await systemDialog.input({
      window: { title: loc`Opposed check: result ${check.effectiveTotal}` },
      rejectClose: false,
      ok: { label: loc`Compare` },
      content: `<div class="spycraft2-roll-options"><label>${loc`Opposing result`} <select name="otherUuid"><option value="">${loc`Not listed (enter the result)`}</option>${rows
        .map(
          row =>
            `<option value="${esc(row.uuid)}">${esc(row.name)} — ${row.total}${row.title ? ` (${esc(row.title)})` : ""}</option>`
        )
        .join(
          ""
        )}</select></label><label>${loc`Result, if not listed`} <input type="number" name="total" step="1" /></label><label><input type="checkbox" name="breakTies" checked /> ${loc`Equal results need a winner: the higher bonus takes it`}</label><p class="hint">${loc`Spend action dice on both checks before comparing them. Neither side may take 10 or 20 on an opposed check.`}</p></div>`
    });
    if (!input) return null;
  }
  const other = input.otherUuid ? rows.find(row => row.uuid === input.otherUuid) : null;
  const total = other ? other.total : Number(input.total);
  if (!Number.isFinite(total) || (!other && (input.total === "" || input.total === null)))
    return ui.notifications.warn(loc`Choose the opposing check or enter its result.`);
  const mine = {
    total: check.effectiveTotal,
    bonus: Number.isFinite(check.naturalDie) ? check.rawTotal - check.naturalDie : null
  };
  let outcome = opposedOutcome(mine, { total, bonus: other?.bonus ?? null }, { breakTies: input.breakTies !== false });
  // Equal results and equal bonuses: a d20 each decides (p.91).
  let rollOff = "";
  const rollOffRolls = [];
  if (outcome === "tie" && input.breakTies !== false && other && Number.isFinite(other.bonus)) {
    let a, b;
    do {
      // Every d20 rolled goes on the roll-off card, so the dice can be seen (and animated) behind the result.
      const first = await new Roll("1d20").evaluate(),
        second = await new Roll("1d20").evaluate();
      rollOffRolls.push(first, second);
      [a, b] = [first.total, second.total];
    } while (a === b);
    outcome = a > b ? "first" : "second";
    rollOff = loc` Roll-off ${a} against ${b}.`;
  }
  const word = outcome === "first" ? "won" : outcome === "second" ? "lost" : "tie";
  await mark(message, { messageUuid: other?.uuid ?? "", name: other?.name ?? "", total, outcome: word });
  if (outcome === "tie") {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spycraft2 chat-note"><p>${loc`Opposed check: ${check.effectiveTotal} against ${total} — a tie.`}</p></div>`
    });
    return { outcome: word, total };
  }
  try {
    await actor.confirmCheckOutcome(message, { succeeded: outcome === "first", difficultyClass: total });
  } catch (error) {
    await message.update({ "flags.spycraft2.-=opposed": null });
    return ui.notifications.warn(error.message);
  }
  // The other side's check, when this user can settle it too.
  const otherActor = other?.check?.actorUuid ? fromUuidSync(other.check.actorUuid) : null;
  if (otherActor?.isOwner && !other.check.resolved && typeof other.check.successConfirmed !== "boolean") {
    await mark(other.message, {
      messageUuid: message.uuid ?? message.id,
      name: actor.name,
      total: check.effectiveTotal,
      outcome: outcome === "first" ? "lost" : "won"
    });
    try {
      await otherActor.confirmCheckOutcome(other.message, {
        succeeded: outcome === "second",
        difficultyClass: check.effectiveTotal
      });
    } catch (error) {
      ui.notifications.warn(loc`The opposing check was not confirmed: ${error.message}`);
    }
  }
  if (rollOff)
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spycraft2 chat-note"><p>${loc`Opposed check tied at ${total} with equal bonuses.`}${rollOff}</p></div>`,
      rolls: rollOffRolls
    });
  return { outcome: word, total };
}

rollPipeline.register({
  id: "opposedCheckControl",
  kinds: ["skill"],
  order: 9155,
  chatControls({ message, check, user }) {
    if (!Number.isFinite(check.rawTotal) || check.resolved || check.superseded) return null;
    // Neither side of an opposed check may take 10 or 20.
    if ((check.checkMethod ?? "roll") !== "roll") return null;
    if (!(message.isAuthor || user.isGM) || check.opposed?.outcome === "won" || check.opposed?.outcome === "lost")
      return null;
    return [{ label: "Compare with an opposing check", placement: "card", run: () => compareOpposed(message) }];
  }
});
