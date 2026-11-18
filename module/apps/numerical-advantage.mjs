import { numericalAdvantagePlan } from "../rules/numerical-advantage.mjs";
import { loc } from "../i18n.mjs";
const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const readable = a => a && ["agent", "npc"].includes(a.type) && (a.visible || a.isOwner || game.user.isGM);
export function numericalAdvantageCandidates(actor) {
  const rows = [],
    represented = new Set(),
    scene = globalThis.canvas?.scene ?? game.scenes?.active;
  for (const t of values(scene?.tokens)) {
    if (!t.actor || (t.hidden && !game.user.isGM) || !readable(t.actor)) continue;
    rows.push({ uuid: t.uuid, actorUuid: t.actor.uuid, name: t.name ?? t.actor.name });
    represented.add(t.actor.uuid);
  }
  for (const a of values(game.actors))
    if (a.uuid && readable(a) && !represented.has(a.uuid)) rows.push({ uuid: a.uuid, actorUuid: a.uuid, name: a.name });
  let own = false;
  return rows.map((r, i) => ({
    ...r,
    key: String(i),
    defaultOwn: !own && r.actorUuid === actor.uuid ? ((own = true), 1) : 0
  }));
}
const number = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
export async function checkNumericalAdvantage(actor) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const candidates = numericalAdvantageCandidates(actor),
    esc = foundry.utils.escapeHTML;
  const table = (side, title) =>
    `<fieldset><legend>${title}</legend><table class="sc2-numerical-roster"><thead><tr><th>${loc`Character / group`}</th><th>${loc`Physical count`}</th><th>${loc`Teammate group`}</th><th>${loc`Already counts as`}</th><th>${loc`Other counting ability`}</th></tr></thead><tbody>${candidates.map(c => `<tr data-side="${side}" data-character="${esc(c.actorUuid)}"><td>${esc(c.name)}</td><td><input name="${side}Count__${c.key}" type="number" min="0" step="1" value="${side === "own" ? c.defaultOwn : 0}" /></td><td><input name="${side}Team__${c.key}" value="${side === "own" && c.defaultOwn ? "your-team" : ""}" /></td><td><input name="${side}Base__${c.key}" type="number" min="1" step="1" value="1" /></td><td><input name="${side}Source__${c.key}" /></td></tr>`).join("")}</tbody></table></fieldset>`;
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Check numerical advantage` },
    position: { width: 820 },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Enter physically present characters, not automatic counts of the directory. A group can share one Actor. Use the same teammate-group label only for actual teammates; allies in different groups do not automatically receive Tactical Advantage. Its current feat source is read from the selected character. A zero physical count with a teammate-group label may identify a remote provider.`}</p>${table("own", "Your side")}${table("enemy", "Opposition")}<label><input name="rosterConfirmed" type="checkbox" /> ${loc`The GC confirms physical counts, opposing sides, teammate relationships and other counting sources`}</label></div>`
  });
  if (!input) return null;
  if (!actor.isOwner) throw new Error(loc`You must own the character.`);
  try {
    if (input.rosterConfirmed !== true)
      throw new Error(loc`The GC must confirm the roster and counting circumstances.`);
    const lookup = new Map(candidates.map(c => [c.key, c])),
      side = async prefix => {
        const rows = [];
        for (const [field, value] of Object.entries(input).filter(([k]) => k.startsWith(prefix + "Count__"))) {
          const key = field.slice((prefix + "Count__").length),
            count = number(value),
            team = input[prefix + "Team__" + key] ?? "",
            base = number(input[prefix + "Base__" + key]),
            source = input[prefix + "Source__" + key] ?? "";
          if (!Number.isSafeInteger(count) || count < 0) throw new Error(loc`Use a nonnegative whole physical count.`);
          if (!count && !String(team).trim()) continue;
          const c = lookup.get(key);
          if (!c) throw new Error(loc`A declared roster character is no longer available. Confirm the roster again.`);
          const doc = await fromUuid(c.uuid),
            current = doc?.documentName === "Token" ? doc.actor : doc;
          if (
            !readable(current) ||
            current.uuid !== c.actorUuid ||
            (doc?.documentName === "Token" && doc.hidden && !game.user.isGM)
          )
            throw new Error(loc`A declared roster character changed or became unavailable. Confirm the roster again.`);
          rows.push({
            id: c.uuid,
            name: doc?.documentName === "Token" ? doc.name : current.name,
            characters: count,
            team,
            countsAs: base,
            countingSource: source,
            tacticalAdvantage: current.system.activeFeatNames?.includes("Tactical Advantage") === true
          });
        }
        return rows;
      };
    const own = await side("own"),
      opposition = await side("enemy"),
      plan = numericalAdvantagePlan({ own, opposition, rosterConfirmed: true });
    const details = (side, name) =>
      `<p><b>${loc`${name}: ${side.physical} physical / ${side.effective} counted characters.`}</b></p>${side.rows
        .filter(r => r.characters || (r.tacticalAdvantage && r.team))
        .map(
          r =>
            `<p>${esc(r.name)}: ${r.characters} × ${r.perCharacter} = ${r.effective}${r.team ? `; teammate group ${esc(r.team)}` : ""}${r.tacticalApplies ? "; Tactical Advantage" : ""}${r.countsAs > 1 ? `; ${esc(r.countingSource)}` : ""}.</p>`
        )
        .join("")}`;
    await foundry.applications.api.DialogV2.input({
      window: { title: loc`Numerical advantage — result` },
      position: { width: 720 },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">${details(plan.own, "Your side")}${details(plan.opposition, "Opposition")}<p>${loc`At least 2-to-1: ${plan.twoToOne ? "yes" : "no"}; at least 3-to-1: ${plan.threeToOne ? "yes" : "no"}. ${plan.opponentsPresent ? "" : loc`Both sides need actual opposing characters to evaluate combat thresholds.`}`}</p>${plan.notes.map(n => `<p>${esc(n)}</p>`).join("")}</div>`
    });
    return plan;
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
}
