/** GC reference tools: security devices (Table 7.9), hazards and nature's fury (Tables 7.2–7.3), events, NPC knowledge (Table 7.15) and random possessions (Table 7.16). */
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { SECURITY_DEVICES, resolveDevice, sensorCheck, trapOutcome } from "../../rules/gc/security.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { requireGC, getMission, getOrganizations } from "./state.mjs";
import {
  knowledgeGrade,
  knowledgeLines,
  knowledgeRole,
  knowsNothingCost,
  npcKnowledge
} from "../../rules/gc/npc-knowledge.mjs";
import { RATINGS, RATING_LABELS } from "../../rules/gc/organization.mjs";
import { loc } from "../../i18n.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";

const T = GC_DATA.tables;
const ask = (title, content, ok) => formDialog({ title, ok, fields: [raw(content)] });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const say = (content, whisper = true) =>
  ChatMessage.create({
    speaker: { alias: loc`Game Control` },
    content,
    ...(whisper ? { whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id) } : {})
  });
const signed = value => (value >= 0 ? `+${value}` : `${value}`);

export function deviceCard(device) {
  const rows = [
    [loc`Target`, device.targetArea],
    [loc`Detect DC (also its Defense)`, device.detectDC],
    [loc`Disable DC`, device.disableDC],
    [loc`Damage save`, device.damageSave === null ? null : signed(device.damageSave)],
    [loc`Open`, device.openDC === null ? null : `${device.openSkill} DC ${device.openDC}`],
    [loc`Awareness`, device.awareness === null ? null : signed(device.awareness)],
    [loc`Opposed by`, device.opposedBy || null],
    [loc`Triggers`, device.autoTrigger ? "automatically unless disabled" : null],
    [
      loc`Attack`,
      device.attack === null
        ? null
        : `${signed(device.attack)} (error 1, threat ${device.threat}${device.threat < 20 ? "–20" : ""})`
    ],
    [loc`Reflex save DC`, device.saveDC],
    [loc`Damage`, device.damage || null],
    [loc`Repeats`, device.repeats ? loc`attacks each round until disabled` : null],
    ["XP", device.xp ?? device.xpPrinted]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return `<b>${esc(device.name)}</b> ${loc`— ${esc(device.kind)}, Power Rating ${device.powerRating} (p.${device.page})`}<br>${rows.map(([label, value]) => `${esc(label)}: ${esc(value)}`).join("<br>")}<br><i>${esc(device.summary)}</i>`;
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
    loc`Security device — Table 7.9`,
    `
    <label>${loc`Device`} <select name="id">${list}</select></label>
    <label>${loc`Power Rating`} <input type="number" name="pr" min="1" value="${Math.max(1, getMission().threatLevel ?? 1)}" /></label>
    <label>${loc`Action`} <select name="action">${options(
      [
        ["show", loc`Show its statistics`],
        ["sensor", loc`Sensor: roll Awareness against an intruder`],
        ["trap", loc`Trap: attack or force a Reflex save`]
      ],
      "show"
    )}</select></label>
    <label>${loc`Intruder's opposed result, or target's Defense`} <input type="number" name="target" value="10" /></label>
    <label>${loc`Reflex save result (save-based traps)`} <input type="number" name="save" /></label>`,
    loc`Look up`
  );
  if (!input) return null;
  let device;
  try {
    device = resolveDevice(input.id, Number(input.pr));
  } catch (error) {
    return refuse(error.message);
  }
  const lines = [deviceCard(device)];
  try {
    if (input.action === "sensor") {
      const roll = await new Roll("1d20").evaluate(),
        result = sensorCheck(device, roll.total, Number(input.target));
      lines.push(
        result.automatic
          ? `<b>${loc`Triggered automatically`}</b> ${loc`unless disabled.`}`
          : result.triggered === null
            ? loc`Resolve by: ${esc(result.manual)}.`
            : `${loc`Awareness d20 ${roll.total} ${signed(device.awareness)} =`} <b>${result.total}</b> ${loc`against ${Number(input.target)}:`} <b>${result.triggered ? "triggered" : loc`not triggered`}</b>${loc`${result.tie ? loc` (tie: break it as an opposed check, p.91)` : ""}. No result cap applies.`}`
      );
    } else if (input.action === "trap") {
      if (device.attack !== null) {
        const roll = await new Roll("1d20").evaluate(),
          result = trapOutcome(device, { roll: roll.total, defense: Number(input.target) });
        lines.push(
          `${loc`Attack d20 ${roll.total} ${signed(device.attack)} =`} <b>${result.total}</b> ${loc`against Defense ${Number(input.target)}:`} <b>${result.hit ? "hit" : "miss"}</b>${loc`${result.threat ? loc` — threat` : ""}${result.error ? loc` — error` : ""}. Damage ${esc(device.damage)}.`}`
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
          loc`Reflex save DC ${result.dc}${Number.isFinite(Number(input.save)) && input.save !== "" ? `: ${result.saved ? loc`saved (half damage)` : "failed"}` : ""}. Damage ${esc(device.damage)}${damage === null ? "" : ` = ${damage}${result.damage !== null && result.saved ? ` → <b>${result.damage}</b>` : ""}`}.`
        );
      } else lines.push(loc`This trap has no attack bonus or save DC; apply its listed effect.`);
    }
  } catch (error) {
    return refuse(error.message);
  }
  return say(lines.join("<br>"));
}

/** Hazards and nature's fury are bought with action dice rather than rolled: show the row for the dice spent. */
export async function hazardLookupDialog() {
  requireGC();
  const tables = { hazards: T.lookups.hazards, naturesFury: T.lookups.naturesFury };
  const names = key => [...new Set(tables[key].rows.map(row => row[0]))];
  const input = await ask(
    loc`Hazards and nature’s fury — Tables 7.2 and 7.3`,
    `
    <p>${loc`These events cost 1–4 GC action dice (one less if a listed trigger has occurred); the effect depends on the dice spent.`}</p>
    <label>${loc`Hazard`} <select name="hazard"><option value="">—</option>${options(names("hazards").map(name => [name, name]))}</select></label>
    <label>${loc`Nature’s fury`} <select name="fury"><option value="">—</option>${options(names("naturesFury").map(name => [name, name]))}</select></label>
    <label>${loc`Action dice spent`} <input type="number" name="cost" min="1" max="8" value="1" /></label>`,
    loc`Look up`
  );
  if (!input) return null;
  const key = input.hazard ? "hazards" : "naturesFury",
    name = input.hazard || input.fury,
    table = tables[key];
  if (!name) return refuse(loc`Choose a hazard or a nature’s fury effect.`);
  const rows = table.rows.filter(row => row[0] === name),
    exact = rows.filter(row => String(row[1]).replace("*", "") === String(Number(input.cost)));
  const shown = exact.length ? exact : rows;
  return say(
    `<b>${esc(table.title)} — ${esc(name)}</b>${exact.length ? "" : loc` (no row for that cost; all rows shown)`}<br>${shown
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
    loc`GC events — pp.399–404`,
    `<label>${loc`Event`} <select name="id">${options(T.events.map(event => [event.id, event.name]))}</select></label>`,
    loc`Show event`
  );
  if (!input) return null;
  const event = T.events.find(entry => entry.id === input.id);
  return say(
    `<b>${esc(event.name)}</b> ${loc`(p.${event.page}) — ${event.costMin}–${event.costMax} GC action dice, 1 less with a trigger.`}<br>${esc(event.summary)}${event.triggers?.length ? `<br><b>${loc`Triggers:`}</b> ${event.triggers.map(esc).join("; ")}` : ""}${event.perDie?.length ? `<br><b>${loc`Each die buys:`}</b> ${event.perDie.map(esc).join("; ")}` : ""}${event.intensities?.length ? `<br>${event.intensities.map(step => `${step.cost}: ${esc(step.summary)}`).join("<br>")}` : ""}`
  );
}

/** Roll on Table 7.16 for what a searched or captured NPC is carrying. A printed overlap (minion, 20) yields both rows. */
export async function randomPossessionsDialog() {
  requireGC();
  const input = await ask(
    loc`Random possessions — Table 7.16`,
    `<label>${loc`NPC`} <select name="id">${options(T.rollTables.map(table => [table.id, table.name]))}</select></label><label>${loc`Rolls`} <input type="number" name="count" min="1" max="10" value="1" /></label>`,
    loc`Roll`
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

/** Questioning an NPC (p.458, Table 7.15): the opposed check's margin, capped by Competence and the NPC's role. */
export async function npcKnowledgeDialog() {
  requireGC();
  const npcs = [...(game.actors ?? [])].filter(actor => actor.type === "npc"),
    onScene = new Set((globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor?.id));
  npcs.sort((a, b) => Number(onScene.has(b.id)) - Number(onScene.has(a.id)) || a.name.localeCompare(b.name));
  const enemies = Object.entries(getOrganizations()).filter(([, org]) => !org.agency);
  const roles = [
    ["", loc`From the NPC's qualities`],
    ["other", loc`Not one of the mission's villains`],
    ["villain", loc`Villain (minion or other)`],
    ["henchman", loc`Henchman`],
    ["mastermind", loc`Mastermind`]
  ];
  const input = await ask(
    loc`NPC knowledge — Table 7.15`,
    `<p>${loc`The team makes an Impress/Persuasion or Intimidate/Coercion check against the NPC's Competence or Sense Motive (p.458).`}</p>
    <label>${loc`NPC`} <select name="npc"><option value="">${loc`Not listed`}</option>${options(npcs.map(actor => [actor.id, actor.name]))}</select></label>
    <label>${loc`Role`} <select name="role">${options(roles, "")}</select></label>
    <label>${loc`Competence grade, if the NPC is not listed (1–10)`} <input type="number" name="competence" min="1" max="10" value="1" /></label>
    <label>${loc`The team's check result`} <input type="number" name="team" required /></label>
    <label>${loc`The NPC's opposing result`} <input type="number" name="npcResult" required /></label>
    ${enemies.length ? `<label>${loc`Enemy organization`} <select name="organization"><option value="">${loc`None recorded`}</option>${options(enemies.map(([id, org]) => [id, org.name || id]))}</select></label><p>${loc`Ratings to reveal first`}</p><p>${RATINGS.map(key => `<label><input type="checkbox" name="rating-${key}" /> ${esc(RATING_LABELS[key])}</label>`).join(" ")}</p>` : ""}`,
    loc`Find what the NPC knows`
  );
  if (!input) return null;
  const actor = input.npc ? game.actors.get(input.npc) : null,
    profile = actor?.system?.npcProfile ?? {},
    role = input.role || knowledgeRole({ qualities: profile.qualities, npcType: actor?.system?.npcType }),
    competence = actor && profile.enabled ? (profile.grades?.competence ?? 1) : Number(input.competence) || 1;
  if (!Number.isFinite(Number(input.team)) || !Number.isFinite(Number(input.npcResult)))
    return refuse(loc`Enter both check results, then ask again.`);
  const difference = Number(input.team) - Number(input.npcResult),
    result = npcKnowledge({ difference, competence, role });
  const organization = getOrganizations()[input.organization] ?? null,
    chosen = RATINGS.filter(key => input[`rating-${key}`] === true);
  const name = esc(actor?.name ?? loc`The NPC`);
  const cost = knowsNothingCost(role, actor?.system?.npcType === "special" ? "special" : "standard");
  const notes = [
    result.limit === "competence"
      ? loc`Held at grade ${knowledgeGrade(result.grade)} by the NPC's Competence (the margin reached ${knowledgeGrade(result.byMargin)}).`
      : result.limit === "role"
        ? loc`Held at grade ${knowledgeGrade(result.grade)}: only villains go past III, and only henchmen and the mastermind past VII.`
        : "",
    result.flawed ? loc`Grades I–III may be mistaken or a red herring, as the GC decides.` : "",
    cost === null
      ? loc`A mastermind always knows something of value.`
      : loc`Instead, the GC may spend ${cost} GC action dice to rule that ${actor?.name ?? loc`the NPC`} knows nothing.`
  ].filter(Boolean);
  const body = result.grade
    ? `<ul>${knowledgeLines(result, organization, chosen)
        .map(line => `<li>${esc(line)}</li>`)
        .join("")}</ul>`
    : `<p>${esc(loc`The check did not beat the NPC's: nothing is learned.`)}</p>`;
  return say(
    `<b>${loc`${name} talks: grade ${knowledgeGrade(result.grade)}`}</b> ${esc(loc`(margin ${difference}, Table 7.15, p.460)`)}${body}<p>${notes.map(esc).join("<br>")}</p>`
  );
}
