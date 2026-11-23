/** Preview and explicitly apply a package; no mission/TL hook changes inventories. */
import { refuse } from "../error-notices.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";
import { computeNpcProfile } from "../rules/npcs.mjs";
import { npcPackageBands, recommendedNpcPackage, planNpcPackage, npcPackageStamp } from "../rules/npc-packages.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";

let catalogPromise;
const busy = new WeakSet();
const esc = value =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export async function loadNpcPackages() {
  if (!catalogPromise)
    catalogPromise = fetch("systems/spycraft2/module/data/npc-packages.json")
      .then(response => {
        if (!response.ok) throw new Error(loc`NPC packages could not be loaded. Rebuild the system data.`);
        return response.json();
      })
      .catch(error => {
        catalogPromise = null;
        throw error;
      });
  return catalogPromise;
}
const tlFor = actor => actor.system.effectiveThreatLevel ?? actor.system.threatLevel;
const effectiveTL = actor =>
  computeNpcProfile(actor.system.npcProfile, actor.system.npcType, tlFor(actor), actor.system.abilities).effectiveLevel;
const list = items =>
  `<ul>${items.map(i => `<li>${esc(i.name)}${i.type === "feat" && i.system.choice ? ` (${esc(i.system.choice)})` : ""}${i.flags?.spycraft2?.npcEquipment?.kind === "ammunition" ? ` × ${i.system.quantity} ${loc`stockpiles`}` : ""}</li>`).join("")}</ul>`;

export function npcPackagePreview(plan) {
  return `<div class="spycraft2-roll-options"><p><strong>${esc(plan.label)}</strong> · ${loc`Effective TL`} ${plan.after.effectiveLevel}</p>
    <p>${loc`NPC reward`}: ${plan.before.xp} → <strong>${plan.after.xp} XP</strong> (${loc`change`}: ${plan.after.xp - plan.before.xp >= 0 ? "+" : ""}${plan.after.xp - plan.before.xp}). ${loc`Mission contribution`}: ${plan.before.missionXP} → ${plan.after.missionXP} XP.</p>
    <p>${loc`Applying replaces the listed template items, including edited quantities and ammunition. Additional items and purchases are retained when their allowances and feat prerequisites remain valid. Apply between encounters; existing effects are retained.`}</p>
    <h3>${loc`Replace current template items`}</h3>${list(plan.replaced)}
    <h3>${loc`Include from package`}</h3>${list(plan.added)}
    <h3>${loc`Retain other items`}</h3>${list(plan.retained)}
    <h3>${loc`Resulting XP calculation`}</h3><table><tbody>${plan.after.breakdown.map(r => `<tr><td>${esc(r.label)}</td><td>${r.xp}</td></tr>`).join("")}</tbody></table>
    <p>${loc`Equipment uses catalog Calibers. Each feat purchase costs 2 XP, including prerequisite feats. Threat Level bands are optional suggestions, not additional core rules.`}</p></div>`;
}

/** A single v14 document update keeps item replacement and its XP profile together. */
export async function applyNpcPackage(actor, data, packageId, expectedStamp) {
  if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only the GC may apply NPC packages.`);
  const snapshot = actor.toObject();
  if (npcPackageStamp(snapshot, tlFor(actor)) !== expectedStamp)
    throw new Error(loc`The NPC or mission Threat Level changed. Preview the package again.`);
  const plan = planNpcPackage(snapshot, data, packageId, { threatLevel: tlFor(actor) });
  const updated = await actor.update({
    items: foundry.data.operators.ForcedReplacement.create(plan.items),
    "system.npcProfile": plan.profile,
    "system.biography": plan.biography,
    "flags.spycraft2.npcPackage": plan.receipt
  });
  if (!updated) throw new Error(loc`The NPC update was canceled. The package was not applied.`);
  return plan;
}

export async function manageNpcPackages(actor, { editBands = false, data = null } = {}) {
  if (!game.user.isGM || !actor.isOwner) return refuse(loc`Only the GC may apply NPC packages.`);
  if (busy.has(actor)) return null;
  busy.add(actor);
  try {
    data ??= await loadNpcPackages();
    const role = data.roles[actor.flags?.spycraft2?.npcTemplate];
    if (!role) throw new Error(loc`This actor is not one of the core NPC templates.`);
    const snapshot = actor.toObject(),
      stamp = npcPackageStamp(snapshot, tlFor(actor));
    const bands = npcPackageBands(role, snapshot.flags?.spycraft2?.npcPackageBands);
    if (editBands) {
      const input = await formDialog({
        title: loc`NPC package TL bands`,
        intro: loc`Set suggested ranges covering Threat Levels 1–20 without gaps or overlaps. Saving changes suggestions only.`,
        fields: [
          raw(
            bands
              .map(
                p =>
                  `<fieldset><legend>${esc(p.label)}</legend><label>${loc`Minimum TL`}<input type="number" min="1" max="20" name="${p.id}Min" value="${p.minTL}" required></label><label>${loc`Maximum TL`}<input type="number" min="1" max="20" name="${p.id}Max" value="${p.maxTL}" required></label></fieldset>`
              )
              .join("")
          )
        ]
      });
      if (!input) return null;
      const overrides = Object.fromEntries(
        bands.map(p => [p.id, { minTL: Number(input[`${p.id}Min`]), maxTL: Number(input[`${p.id}Max`]) }])
      );
      npcPackageBands(role, overrides);
      if (npcPackageStamp(actor.toObject(), tlFor(actor)) !== stamp)
        throw new Error(loc`The NPC changed. Open the bands again.`);
      await actor.update({ "flags.spycraft2.npcPackageBands": overrides });
      return overrides;
    }
    const current = snapshot.flags?.spycraft2?.npcPackage?.id ?? "fixed";
    const recommended = recommendedNpcPackage(role, effectiveTL(actor), snapshot.flags?.spycraft2?.npcPackageBands);
    const input = await systemDialog.input({
      window: { title: loc`Optional NPC package` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${esc(role.name)} · ${loc`Effective TL`} ${effectiveTL(actor)}. ${loc`Current package`}: ${esc(role.packages.find(p => p.id === current)?.label ?? current)}.</p><p>${loc`Fixed loadouts remain the default. Changing Threat Level does not apply a package. Select one to preview its changes.`}</p><label>${loc`Package`}<select name="packageId">${role.packages
        .map(p => {
          const band = bands.find(b => b.id === p.id);
          return `<option value="${p.id}" ${p.id === current ? "selected" : ""}>${esc(p.label)}${band ? ` (TL ${band.minTL}–${band.maxTL})` : ""}${p.id === recommended ? ` — ${loc`suggested`}` : ""}</option>`;
        })
        .join("")}</select></label></div>`
    });
    if (!input) return null;
    const plan = planNpcPackage(snapshot, data, input.packageId, { threatLevel: tlFor(actor) });
    const confirmed = await systemDialog.confirm({
      window: { title: loc`Apply NPC package?` },
      yes: { label: loc`Apply package` },
      no: { label: loc`Cancel` },
      content: npcPackagePreview(plan),
      rejectClose: false
    });
    if (!confirmed) return null;
    const result = await applyNpcPackage(actor, data, input.packageId, stamp);
    ui.notifications.info(loc`NPC package applied: ${result.label}. Reward: ${result.after.xp} XP.`);
    return result;
  } catch (error) {
    ui.notifications.warn(error.message);
    return null;
  } finally {
    busy.delete(actor);
  }
}
