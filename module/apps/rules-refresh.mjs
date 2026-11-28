import { refuse, decline } from "../error-notices.mjs";
import { rulesRefreshChanges, applyRulesRefresh, equivalent } from "../rules/refresh.mjs";
import { loc } from "../i18n.mjs";
import { systemDialog } from "./dialog-theme.mjs";
const PACKS = { gear: "kits", class: "classes", origin: "origins", feat: "feats", weapon: "weapons", armor: "armor" };
const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
/** A stored field name in words: "kitGrade" reads "Kit grade", "name" reads "Name". */
export const refreshFieldLabel = path => {
  const words = path
    .replace(/^system\./, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
/** A value summarised for the GC; lists and records give a count and the names they hold. */
export const refreshValueSummary = value => {
  if (value === undefined || value === null || value === "") return loc`Not set`;
  if (typeof value === "boolean") return value ? loc`Yes` : loc`No`;
  if (typeof value !== "object") return String(value);
  const entries = Array.isArray(value) ? value : Object.values(value);
  const names = entries
    .map(entry => (typeof entry === "object" && entry ? (entry.name ?? entry.label ?? entry.identifier) : entry))
    .filter(name => typeof name === "string" || typeof name === "number")
    .slice(0, 6);
  const count = entries.length === 1 ? loc`1 entry` : loc`${entries.length} entries`;
  return names.length ? `${count}: ${names.join(", ")}${entries.length > names.length ? ", …" : ""}` : count;
};
export async function actorRulesRefreshPreview(actor) {
  const changes = [],
    unmatched = [];
  for (const item of actor.items) {
    if (item.type === "gear" && !item.system.kitType) continue;
    const name = PACKS[item.type];
    if (!name) continue;
    const packId = `spycraft2.${name}`,
      pack = game.packs.get(packId);
    if (!pack) {
      unmatched.push(`${item.name}: rules pack unavailable.`);
      continue;
    }
    const source = item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
    let canonical = null;
    if (source?.startsWith(`Compendium.${packId}.`)) canonical = await pack.getDocument(source.split(".").at(-1));
    else {
      const index = await pack.getIndex({ fields: ["flags.spycraft2.legacyName"] });
      const matches = [...index].filter(
        entry =>
          normal(entry.name) === normal(item.name) || normal(entry.flags?.spycraft2?.legacyName) === normal(item.name)
      );
      if (matches.length === 1) canonical = await pack.getDocument(matches[0]._id);
    }
    if (!canonical) {
      unmatched.push(loc`${item.name}: no unique matching catalog entry; kept unchanged.`);
      continue;
    }
    if (item.type === "class" && item.system.identifier !== canonical.system.identifier) {
      unmatched.push(loc`${item.name}: class identifiers differ; kept unchanged to preserve progression references.`);
      continue;
    }
    changes.push(...rulesRefreshChanges(item, canonical));
  }
  return { changes, unmatched };
}
export async function reviewActorRules(actor, { restore = false } = {}) {
  if (!actor?.isOwner) return refuse(loc`You must own this character.`);
  const esc = foundry.utils.escapeHTML;
  let changes,
    unmatched = [];
  if (restore) {
    const backup = actor.getFlag("spycraft2", "rulesRefreshBackup");
    if (!backup) return decline(loc`No previous rules refresh is available.`);
    changes = backup.changes.flatMap(change => {
      const item = actor.items.get(change.itemId);
      if (!item) return [];
      const current = change.path === "name" ? item.name : item.system[change.path.slice(7)];
      return equivalent(current, change.before)
        ? []
        : [{ ...change, before: structuredClone(current), after: structuredClone(change.before) }];
    });
  } else ({ changes, unmatched } = await actorRulesRefreshPreview(actor));
  if (!changes.length) return decline(unmatched.join("\n") || loc`No catalog changes to apply.`);
  const rows = changes
    .map(
      (change, index) =>
        `<div class="sc2-refresh-change"><input type="checkbox" name="change${index}" checked aria-label="${esc(loc`Apply ${change.itemName}: ${refreshFieldLabel(change.path)}`)}" /><details><summary>${esc(change.itemName)}: ${esc(refreshFieldLabel(change.path))}</summary><dl><dt>${loc`Current`}</dt><dd>${esc(refreshValueSummary(change.before))}</dd><dt>${loc`Proposed`}</dt><dd>${esc(refreshValueSummary(change.after))}</dd></dl><details><summary>${loc`Stored data`}</summary><b>${loc`Current`}</b><pre>${esc(JSON.stringify(change.before, null, 1) ?? loc`Not set`)}</pre><b>${loc`Proposed`}</b><pre>${esc(JSON.stringify(change.after, null, 1) ?? loc`Not set`)}</pre></details></details></div>`
    )
    .join("");
  const input = await systemDialog.input({
    window: { title: restore ? loc`Review previous rules refresh rollback` : loc`Review catalog rules updates` },
    rejectClose: false,
    content: `
  <p>${loc`Select the changes to apply. Build choices, quantities, equipped state, current vitality and wounds, XP and earned resources are preserved. Grant synchronization may add or remove rule-granted feats. A full character JSON backup downloads before applying changes, and a backup of selected fields is stored on the character for quick rollback.`}</p>
  <div class="sc2-scroll-list">${rows}</div>${unmatched.length ? `<p>${unmatched.map(esc).join("<br>")}</p>` : ""}`
  });
  if (!input) return null;
  const selected = changes.filter((_, index) => input[`change${index}`]);
  if (!selected.length) return [];
  actor.exportToJSON?.();
  const result = await applyRulesRefresh(actor, selected);
  await actor.syncGrantedFeats?.();
  return result;
}
