import { refuse, decline } from "../error-notices.mjs";
import { rulesRefreshChanges, applyRulesRefresh, equivalent } from "../rules/refresh.mjs";
import { loc } from "../i18n.mjs";
import { systemDialog } from "./dialog-theme.mjs";
const PACKS = { gear: "kits", class: "classes", origin: "origins", feat: "feats", weapon: "weapons", armor: "armor" };
const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
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
        `<div class="sc2-refresh-change"><input type="checkbox" name="change${index}" checked aria-label="${esc(loc`Apply ${change.itemName}: ${change.path}`)}" /><details><summary>${esc(change.itemName)} — ${esc(change.path)}</summary><div><b>${loc`Current`}</b><pre>${esc(JSON.stringify(change.before, null, 1) ?? "Not set")}</pre><b>${loc`Proposed`}</b><pre>${esc(JSON.stringify(change.after, null, 1) ?? "Not set")}</pre></div></details></div>`
    )
    .join("");
  const input = await systemDialog.input({
    window: { title: restore ? loc`Review previous rules refresh rollback` : loc`Review catalog rules updates` },
    rejectClose: false,
    content: `
  <p>${loc`Select the changes to apply. Build choices, quantities, equipped state, current HP, XP and earned resources are preserved. Grant synchronization may add or remove rule-granted feats. A full character JSON backup downloads before applying changes, and a backup of selected fields is stored on the character for quick rollback.`}</p>
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
