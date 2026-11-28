/** Organizations (pp.389–395): the GC records the Agency and its rivals; the console lists them and posts a summary. */
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import {
  ORG,
  RATINGS,
  RATING_LABELS,
  defaultOrganization,
  organizationSummary,
  reviewOrganization
} from "../../rules/gc/organization.mjs";
import { getOrganizations, requireGC, saveOrganization } from "./state.mjs";
import { loc } from "../../i18n.mjs";

const gm = () => ChatMessage.getWhisperRecipients("GM").map(user => user.id);
const checkbox = (name, label, checked, tooltip = "") =>
  `<label${tooltip ? ` data-tooltip="${esc(tooltip)}"` : ""}><input type="checkbox" name="${esc(name)}"${checked ? " checked" : ""} /> ${esc(label)}</label>`;
const whole = value => Math.max(0, Math.trunc(Number(value) || 0));

/** The console's rows: name, total, the pool it falls in and what is still to do. */
export function organizationRows() {
  return Object.entries(getOrganizations())
    .map(([id, org]) => {
      const review = reviewOrganization(org);
      return {
        id,
        name: org.name || loc`Unnamed organization`,
        agency: !!org.agency,
        total: review.total,
        pool: review.pool?.summary ?? "",
        status: review.problems.length
          ? loc`${review.problems.length} problem(s)`
          : review.unspent.length
            ? loc`${review.unspent.length} choice(s) left`
            : loc`complete`,
        bad: review.problems.length > 0,
        // NPCs the GC linked by dropping them on the row: its known people, one click from their sheets.
        npcs: (org.npcs ?? []).map(entry => ({ uuid: entry.uuid, name: entry.name }))
      };
    })
    .sort((a, b) => Number(b.agency) - Number(a.agency) || a.name.localeCompare(b.name));
}

/** Choices made in the dialog, read back into an organization. */
function readForm(input, previous) {
  const org = { ...previous };
  org.name = String(input.name ?? "").trim();
  org.agency = input.agency === true;
  org.ratings = Object.fromEntries(RATINGS.map(key => [key, whole(input[`rating-${key}`])]));
  org.goals = ORG.goals.filter(goal => input[`goal-${goal.id}`] === true).map(goal => goal.id);
  org.turningPoints = ORG.turningPoints
    .filter(point => input[`point-${point.id}`] === true)
    .map(point =>
      point.chooseCheck ? { id: point.id, check: String(input[`check-${point.id}`] ?? "").trim() } : { id: point.id }
    );
  org.image = Object.fromEntries(
    ORG.image.facets.map(facet => [facet.id, input[`image-${facet.id}`] || ORG.image.default])
  );
  org.sites = ORG.sites.filter(site => input[`site-${site.id}`] === true).map(site => site.id);
  org.tools = Object.fromEntries(ORG.gearCategories.map(category => [category, whole(input[`tools-${category}`])]));
  org.notes = String(input.notes ?? "").trim();
  return org;
}

function formContent(org) {
  const ratings = RATINGS.map(
    key =>
      `<label>${esc(RATING_LABELS[key])} <input type="number" name="rating-${key}" min="0" max="20" value="${org.ratings?.[key] ?? 0}" /></label>`
  ).join("");
  const chosenPoint = id => (org.turningPoints ?? []).find(entry => (entry.id ?? entry) === id);
  const goals = ORG.goals
    .map(goal => checkbox(`goal-${goal.id}`, goal.name, (org.goals ?? []).includes(goal.id)))
    .join("");
  const points = ORG.turningPoints
    .map(point => {
      const chosen = chosenPoint(point.id);
      const box = checkbox(
        `point-${point.id}`,
        point.name,
        !!chosen,
        point.chooseCheck ? "" : loc`Supports ${point.check}`
      );
      return point.chooseCheck
        ? `${box} <label>${loc`Check it supports`} <input name="check-${point.id}" value="${esc(chosen?.check ?? "")}" placeholder="${loc`e.g. Bureaucracy/Request`}" /></label>`
        : box;
    })
    .join("");
  const levels = ORG.image.levels;
  const image = ORG.image.facets
    .map(
      facet =>
        `<label>${esc(facet.name)} <select name="image-${facet.id}">${levels
          .map(
            row =>
              `<option value="${row.id}"${(org.image?.[facet.id] ?? ORG.image.default) === row.id ? " selected" : ""}>${esc(loc`${row.name} (${row.cost} point(s))`)}</option>`
          )
          .join("")}</select></label>`
    )
    .join("");
  const sites = ORG.sites
    .map(site => checkbox(`site-${site.id}`, site.name, (org.sites ?? []).includes(site.id), site.request))
    .join("");
  const tools = ORG.gearCategories
    .map(
      category =>
        `<label>${esc(category)} <input type="number" name="tools-${category}" min="0" max="${ORG.maxCaliber - ORG.toolsBaseCaliber}" value="${org.tools?.[category] ?? 0}" /></label>`
    )
    .join("");
  return `
    <label>${loc`Name`} <input name="name" value="${esc(org.name ?? "")}" required /></label>
    ${checkbox("agency", loc`This is the team's Agency (its Sites help their Requests)`, !!org.agency)}
    <fieldset><legend>${loc`Power Ratings (p.389)`}</legend>${ratings}<p>${esc(loc`Growth: ${ORG.growth.summary} (p.${ORG.growth.page}).`)}</p></fieldset>
    <details><summary>${loc`Goals: one per Goals point (Table 6.18)`}</summary><div class="sc2-check-grid">${goals}</div></details>
    <details><summary>${loc`Turning points: one per History point (Table 6.19)`}</summary><div class="sc2-check-grid">${points}</div></details>
    <details><summary>${loc`Image: what the public knows (Table 6.20)`}</summary><p>${loc`Prominent and Secretive cost 1 point, Renowned and Mysterious 2.`}</p>${image}</details>
    <details><summary>${loc`Sites: one per Sites point (Table 6.21)`}</summary><div class="sc2-check-grid">${sites}</div></details>
    <details><summary>${loc`Tools: 2 Caliber increases per Tools point (p.394)`}</summary><p>${loc`Every category starts at Caliber II and stops at V.`}</p>${tools}</details>
    <label>${loc`Notes`} <textarea name="notes">${esc(org.notes ?? "")}</textarea></label>`;
}

/** Create or edit an organization. Problems are shown after saving, so a part-built organization can be kept. */
export async function editOrganization(id = null) {
  requireGC();
  const all = getOrganizations(),
    key = id && all[id] ? id : foundry.utils.randomID(),
    previous = all[key] ?? defaultOrganization(key);
  const input = await formDialog({
    title: id ? loc`Edit ${previous.name || loc`organization`}` : loc`Add an organization`,
    fields: [raw(formContent(previous))],
    ok: loc`Save the organization`
  });
  if (!input) return null;
  const org = readForm(input, previous);
  if (!org.name) return refuse(loc`Give the organization a name, then save it again.`);
  // Only one Agency: marking a new one clears the mark on the last.
  if (org.agency)
    for (const [other, entry] of Object.entries(all))
      if (other !== key && entry.agency) await saveOrganization(other, { ...entry, agency: false });
  await saveOrganization(key, org);
  const review = reviewOrganization(org);
  if (review.problems.length) ui.notifications.warn(loc`${org.name} saved with problems: ${review.problems.join(" ")}`);
  return key;
}

/** Link an NPC to an organization, as one of its people. Dropping the same NPC twice links it once. */
export async function linkOrganizationNpc(id, actor) {
  requireGC();
  const org = getOrganizations()[id];
  if (!org) return refuse(loc`That organization is no longer recorded. Add it again from the console.`);
  if (actor?.type !== "npc") return refuse(loc`Only an NPC can be linked to an organization.`);
  const npcs = org.npcs ?? [];
  if (npcs.some(entry => entry.uuid === actor.uuid)) {
    ui.notifications.info(loc`${actor.name} is already linked to ${org.name}.`);
    return null;
  }
  await saveOrganization(id, { ...org, npcs: [...npcs, { uuid: actor.uuid, name: actor.name }] });
  ui.notifications.info(loc`${actor.name} is linked to ${org.name}.`);
  return actor.uuid;
}

/** Take one linked NPC off an organization; the NPC itself is not touched. */
export async function unlinkOrganizationNpc(id, uuid) {
  requireGC();
  const org = getOrganizations()[id];
  if (!org) return null;
  await saveOrganization(id, { ...org, npcs: (org.npcs ?? []).filter(entry => entry.uuid !== uuid) });
  return uuid;
}

export async function removeOrganization(id) {
  requireGC();
  const org = getOrganizations()[id];
  if (!org) return null;
  const ok = await systemDialog.confirm({
    window: { title: loc`Remove ${org.name || loc`organization`}` },
    yes: { label: loc`Remove the organization` },
    no: { label: loc`Cancel` },
    rejectClose: false,
    content: `<p>${esc(loc`Remove ${org.name || loc`this organization`} from the world? Conflicts already started keep their ratings.`)}</p>`
  });
  if (ok) await saveOrganization(id, null);
  return ok ? id : null;
}

/** A GC-only card with the organization's Ratings, the benefits its people carry and what is still to choose. */
export async function organizationCard(id) {
  requireGC();
  const org = getOrganizations()[id];
  if (!org) return refuse(loc`That organization is no longer recorded. Add it again from the console.`);
  const { review, lines, benefits, goalDice } = organizationSummary(org);
  const cover = (who, b) =>
    b.coverIdentity || b.legalImmunity
      ? loc`${who}: cover identity +${b.coverIdentity}, legal immunity +${b.legalImmunity}`
      : "";
  const extras = [
    goalDice ? loc`Once per session the leaders may give one member ${goalDice} action dice for its goals.` : "",
    cover(loc`Leaders`, benefits.leaders),
    cover(loc`Members`, benefits.members),
    review.pool ? loc`Total ${review.total}: ${review.pool.summary} (Table 6.22).` : loc`Total ${review.total}.`
  ].filter(Boolean);
  const issues = [...review.problems, ...review.unspent];
  return ChatMessage.create({
    speaker: { alias: loc`Organization` },
    whisper: gm(),
    content: `<p><b>${esc(org.name)}</b>${org.agency ? ` · ${esc(loc`the Agency`)}` : ""}</p><ul>${lines
      .map(line => `<li>${esc(line)}</li>`)
      .join(
        ""
      )}</ul><p>${extras.map(esc).join("<br>")}</p>${issues.length ? `<details><summary>${esc(loc`Still to settle`)}</summary><ul>${issues.map(line => `<li>${esc(line)}</li>`).join("")}</ul></details>` : ""}${org.notes ? `<p>${esc(org.notes)}</p>` : ""}`
  });
}
