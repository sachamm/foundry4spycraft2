/** GC reference tools: security devices (Table 7.9), hazards and nature's fury (Tables 7.2–7.3), events and random possessions (Table 7.16). */
import { SECURITY_DEVICES, resolveDevice, sensorCheck, trapOutcome } from "../../rules/gc/security.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { requireGC, getMission } from "./state.mjs";

const T = GC_DATA.tables;
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const ask = (title, content) =>
  foundry.applications.api.DialogV2.input({
    window: { title },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${content}</div>`
  });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const say = (content, whisper = true) =>
  ChatMessage.create({
    speaker: { alias: "Game Control" },
    content,
    ...(whisper ? { whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id) } : {})
  });
const signed = value => (value >= 0 ? `+${value}` : `${value}`);

export function deviceCard(device) {
  const rows = [
    ["Target", device.targetArea],
    ["Detect DC (also its Defense)", device.detectDC],
    ["Disable DC", device.disableDC],
    ["Damage save", device.damageSave === null ? null : signed(device.damageSave)],
    ["Open", device.openDC === null ? null : `${device.openSkill} DC ${device.openDC}`],
    ["Awareness", device.awareness === null ? null : signed(device.awareness)],
    ["Opposed by", device.opposedBy || null],
    ["Triggers", device.autoTrigger ? "automatically unless disabled" : null],
    [
      "Attack",
      device.attack === null
        ? null
        : `${signed(device.attack)} (error 1, threat ${device.threat}${device.threat < 20 ? "–20" : ""})`
    ],
    ["Reflex save DC", device.saveDC],
    ["Damage", device.damage || null],
    ["Repeats", device.repeats ? "attacks each round until disabled" : null],
    ["XP", device.xp ?? device.xpPrinted]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return `<b>${esc(device.name)}</b> — ${esc(device.kind)}, Power Rating ${device.powerRating} (p.${device.page})<br>${rows.map(([label, value]) => `${esc(label)}: ${esc(value)}`).join("<br>")}<br><i>${esc(device.summary)}</i>`;
}

/** Show a security device's numbers at a Power Rating and optionally roll its Awareness check or attack. */
export async function securityDeviceDialog() {
  requireGC();
  const kinds = ["lock", "sensor", "trap"];
  const list = kinds
    .map(
      kind =>
        `<optgroup label="${kind}s">${options(SECURITY_DEVICES.filter(device => device.kind === kind).map(device => [device.id, device.name]))}</optgroup>`
    )
    .join("");
  const input = await ask(
    "Security device — Table 7.9",
    `
    <label>Device <select name="id">${list}</select></label>
    <label>Power Rating <input type="number" name="pr" min="1" value="${Math.max(1, getMission().threatLevel ?? 1)}" /></label>
    <label>Action <select name="action">${options(
      [
        ["show", "Show its statistics"],
        ["sensor", "Sensor: roll Awareness against an intruder"],
        ["trap", "Trap: attack or force a Reflex save"]
      ],
      "show"
    )}</select></label>
    <label>Intruder's opposed result, or target's Defense <input type="number" name="target" value="10" /></label>
    <label>Reflex save result (save-based traps) <input type="number" name="save" /></label>`
  );
  if (!input) return null;
  let device;
  try {
    device = resolveDevice(input.id, Number(input.pr));
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  const lines = [deviceCard(device)];
  try {
    if (input.action === "sensor") {
      const roll = await new Roll("1d20").evaluate(),
        result = sensorCheck(device, roll.total, Number(input.target));
      lines.push(
        result.automatic
          ? "<b>Triggered automatically</b> unless disabled."
          : result.triggered === null
            ? `Resolve by: ${esc(result.manual)}.`
            : `Awareness d20 ${roll.total} ${signed(device.awareness)} = <b>${result.total}</b> against ${Number(input.target)}: <b>${result.triggered ? "triggered" : "not triggered"}</b>${result.tie ? " (tie: break it as an opposed check, p.91)" : ""}. No result cap applies.`
      );
    } else if (input.action === "trap") {
      if (device.attack !== null) {
        const roll = await new Roll("1d20").evaluate(),
          result = trapOutcome(device, { roll: roll.total, defense: Number(input.target) });
        lines.push(
          `Attack d20 ${roll.total} ${signed(device.attack)} = <b>${result.total}</b> against Defense ${Number(input.target)}: <b>${result.hit ? "hit" : "miss"}</b>${result.threat ? " — threat" : ""}${result.error ? " — error" : ""}. Damage ${esc(device.damage)}.`
        );
      } else if (device.saveDC !== null) {
        const damage = /^\d+d\d+/.test(device.damage)
          ? (await new Roll(device.damage.match(/^\d+d\d+(\s*[+-]\s*\d+)?/)[0]).evaluate()).total
          : null;
        const result = trapOutcome(device, {
          saveResult: input.save === "" || input.save === null ? NaN : Number(input.save),
          damage
        });
        lines.push(
          `Reflex save DC ${result.dc}${Number.isFinite(Number(input.save)) && input.save !== "" ? `: ${result.saved ? "saved (half damage)" : "failed"}` : ""}. Damage ${esc(device.damage)}${damage === null ? "" : ` = ${damage}${result.damage !== null && result.saved ? ` → <b>${result.damage}</b>` : ""}`}.`
        );
      } else lines.push("This trap has no attack bonus or save DC; apply its listed effect.");
    }
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  return say(lines.join("<br>"));
}

/** Hazards and nature's fury are bought with action dice rather than rolled: show the row for the dice spent. */
export async function hazardLookupDialog() {
  requireGC();
  const tables = { hazards: T.lookups.hazards, naturesFury: T.lookups.naturesFury };
  const names = key => [...new Set(tables[key].rows.map(row => row[0]))];
  const input = await ask(
    "Hazards and nature’s fury — Tables 7.2 and 7.3",
    `
    <p>These events cost 1–4 GC action dice (one less if a listed trigger has occurred); the effect depends on the dice spent.</p>
    <label>Hazard <select name="hazard"><option value="">—</option>${options(names("hazards").map(name => [name, name]))}</select></label>
    <label>Nature’s fury <select name="fury"><option value="">—</option>${options(names("naturesFury").map(name => [name, name]))}</select></label>
    <label>Action dice spent <input type="number" name="cost" min="1" max="8" value="1" /></label>`
  );
  if (!input) return null;
  const key = input.hazard ? "hazards" : "naturesFury",
    name = input.hazard || input.fury,
    table = tables[key];
  if (!name) return ui.notifications.warn("Choose a hazard or a nature’s fury effect.");
  const rows = table.rows.filter(row => row[0] === name),
    exact = rows.filter(row => String(row[1]).replace("*", "") === String(Number(input.cost)));
  const shown = exact.length ? exact : rows;
  return say(
    `<b>${esc(table.title)} — ${esc(name)}</b>${exact.length ? "" : " (no row for that cost; all rows shown)"}<br>${shown
      .map(
        row =>
          `${esc(
            table.columns
              .slice(1)
              .map((column, i) => `${column}: ${row[i + 1]}`)
              .join(" · ")
          )}`
      )
      .join("<br>")}${(table.notes ?? []).length ? `<br><i>${table.notes.map(esc).join(" ")}</i>` : ""}`
  );
}

export async function eventReferenceDialog() {
  requireGC();
  const input = await ask(
    "GC events — pp.399–404",
    `<label>Event <select name="id">${options(T.events.map(event => [event.id, event.name]))}</select></label>`
  );
  if (!input) return null;
  const event = T.events.find(entry => entry.id === input.id);
  return say(
    `<b>${esc(event.name)}</b> (p.${event.page}) — ${event.costMin}–${event.costMax} GC action dice, 1 less with a trigger.<br>${esc(event.summary)}${event.triggers?.length ? `<br><b>Triggers:</b> ${event.triggers.map(esc).join("; ")}` : ""}${event.perDie?.length ? `<br><b>Each die buys:</b> ${event.perDie.map(esc).join("; ")}` : ""}${event.intensities?.length ? `<br>${event.intensities.map(step => `${step.cost}: ${esc(step.summary)}`).join("<br>")}` : ""}`
  );
}

/** Roll on Table 7.16 for what a searched or captured NPC is carrying. A printed overlap (minion, 20) yields both rows. */
export async function randomPossessionsDialog() {
  requireGC();
  const input = await ask(
    "Random possessions — Table 7.16",
    `<label>NPC <select name="id">${options(T.rollTables.map(table => [table.id, table.name]))}</select></label><label>Rolls <input type="number" name="count" min="1" max="10" value="1" /></label>`
  );
  if (!input) return null;
  const table = T.rollTables.find(entry => entry.id === input.id),
    lines = [];
  for (let i = 0; i < Math.max(1, Math.min(10, Number(input.count) || 1)); i++) {
    const roll = await new Roll(table.formula).evaluate();
    for (const result of table.results.filter(entry => roll.total >= entry.range[0] && roll.total <= entry.range[1]))
      lines.push(`${roll.total}: ${esc(result.text)}`);
  }
  return say(`<b>${esc(table.name)}</b> (${esc(table.source)}, p.${table.page})<br>${lines.join("<br>")}`);
}
