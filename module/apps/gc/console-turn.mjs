/**
 * Running a turn from the GC Console: what the Combat section shows about the acting combatant and each row, and the
 * actions behind them (open a combatant, attack with the acting character, act for a mob of identical NPCs).
 */
import { loc } from "../../i18n.mjs";
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { quickAttackHasTarget, quickAttackOptions, skipDialog } from "../remembered-choices.mjs";
import { resolveQuickAttack } from "../damage-application.mjs";
import { damageSaveState, npcIsSpecial } from "./npc-play.mjs";
import { halfActionsLeft, trackerRowStates } from "./combat.mjs";

const signed = value => (value >= 0 ? `+${value}` : `${value}`);

/** The names of an actor's conditions, as the status list spells them. */
export function conditionNames(actor) {
  const known = globalThis.CONFIG?.statusEffects ?? [];
  return [...(actor?.statuses ?? [])].map(id => {
    const name = known.find(status => status.id === id)?.name;
    return name ? game.i18n.localize(name) : id;
  });
}

/** One line on how hurt an actor is: vitality and wounds, or a standard NPC's Damage save. */
export function healthLine(actor) {
  const system = actor?.system;
  if (!system) return "";
  if (actor.type === "npc" && !npcIsSpecial(actor)) {
    const save = damageSaveState(actor);
    if (save.track.state && save.track.state !== "active") return loc`Out of the fight (${save.track.state})`;
    return loc`Damage save ${signed(save.bonus)}, next DC ${save.nextDC}`;
  }
  return loc`Vitality ${system.vitality?.value ?? 0}/${system.vitality?.max ?? 0}, wounds ${system.wounds?.value ?? 0}/${system.wounds?.max ?? 0}`;
}

/** What the console shows for the combatant whose turn it is; null before the fight starts. */
export function actingBlock(combat) {
  const combatant = combat?.started ? combat.combatant : null,
    actor = combatant?.actor;
  if (!actor) return null;
  const left = halfActionsLeft(combatant);
  return {
    id: combatant.id,
    name: combatant.name,
    npc: actor.type === "npc",
    standard: actor.type === "npc" && !npcIsSpecial(actor),
    defense: actor.system?.defense?.total ?? null,
    health: healthLine(actor),
    conditions: conditionNames(actor).join(", "),
    halfActions: left === 1 ? loc`1 half action left` : loc`${left} half actions left`,
    weapons: [...(actor.items ?? [])]
      .filter(item => item.type === "weapon")
      .map(item => ({ id: item.id, name: item.name }))
  };
}

/** The combat list, one row per combatant, with the words a GC reads at a glance. */
export function combatRows(combat) {
  if (!combat) return [];
  return combat.turns.map(combatant => {
    const fluid = combatant.flags?.spycraft2?.fluid,
      pending = fluid?.round === combat.round ? fluid.modifiers.reduce((sum, entry) => sum + entry.amount, 0) : 0,
      current = combat.started && combat.combatant?.id === combatant.id;
    const notes = [];
    if (combatant.isDefeated) notes.push(loc`defeated`);
    if (combatant.flags?.spycraft2?.readied) notes.push(loc`readied action`);
    notes.push(...trackerRowStates(combatant.actor, { health: true }));
    if (pending) notes.push(loc`${signed(pending)} at round end`);
    if (combatant.flags?.spycraft2?.mustPress) notes.push(loc`must Press`);
    return {
      id: combatant.id,
      name: combatant.name,
      current,
      defeated: !!combatant.isDefeated,
      count: Number.isFinite(combatant.initiative) ? loc`Count ${combatant.initiative}` : loc`not rolled`,
      notes: notes.join(", "),
      // Kept for callers that read the older fields.
      pending: pending ? signed(pending) : "",
      mustPress: !!combatant.flags?.spycraft2?.mustPress
    };
  });
}

const baseActorId = combatant =>
  combatant.actor?.isToken ? (combatant.token?.baseActor?.id ?? combatant.actorId) : combatant.actorId;

/** Groups of two or more standing standard NPCs of one kind: the mobs a GC can act for in one step. */
export function mobGroups(combat) {
  const groups = new Map();
  for (const combatant of combat?.turns ?? []) {
    const actor = combatant.actor;
    if (!actor || actor.type !== "npc" || npcIsSpecial(actor) || combatant.isDefeated) continue;
    const key = baseActorId(combatant);
    groups.set(key, [...(groups.get(key) ?? []), combatant]);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({
      key,
      name: members[0].token?.baseActor?.name ?? members[0].actor.name,
      count: members.length,
      members
    }));
}

/** Show a combatant: centre the map on its token, select it and open its sheet. */
export async function openCombatant(combat, id) {
  const combatant = combat?.combatants?.get(id);
  if (!combatant) return null;
  const token = combatant.token?.object;
  if (token && globalThis.canvas?.ready) {
    token.control?.({ releaseOthers: true });
    await canvas.animatePan?.({ x: token.center.x, y: token.center.y, duration: 250 });
  }
  combatant.actor?.sheet?.render(true);
  return combatant;
}

/** Attack with one of the acting character's weapons: straight to hit or miss with one target, else the dialog. */
export async function attackWith(actor, itemId, event = null) {
  const item = actor?.items?.get(itemId);
  if (!item) return refuse(loc`That weapon is no longer on the sheet.`);
  if (skipDialog(event) && quickAttackHasTarget(actor))
    return resolveQuickAttack(await actor.rollAttack(item, quickAttackOptions(actor, item)));
  return actor.rollAttack(item, { askContext: true });
}

/** Share targets among attackers in turn: the first attacker takes the first target, and so on round the list. */
export function shareTargets(attackers, targets) {
  if (!targets.length) return [];
  return attackers.map((attacker, index) => [attacker, targets[index % targets.length]]);
}

/**
 * Act for a mob: every standing member of one group makes one attack with the same weapon, the targets shared out
 * in order, and the turn then moves past the group.
 */
export async function mobAttackDialog(combat, key = null) {
  if (!combat?.started) return refuse(loc`Start the combat first.`);
  const groups = mobGroups(combat);
  if (!groups.length) return refuse(loc`No group of two or more standard NPCs of one kind is in this fight.`);
  const group = groups.find(entry => entry.key === key) ?? groups[0];
  const weapons = [...(group.members[0].actor.items ?? [])].filter(item => item.type === "weapon");
  if (!weapons.length) return refuse(loc`${group.name} has no weapon on its sheet.`);
  const foes = combat.turns.filter(
    combatant => combatant.actor && !combatant.isDefeated && !group.members.includes(combatant) && combatant.token
  );
  if (!foes.length) return refuse(loc`There is nobody else in the fight to attack.`);
  const likely = foes.filter(combatant => combatant.actor.type === "agent");
  const input = await formDialog({
    title: loc`Mob attack — ${group.name} ×${group.count}`,
    ok: loc`Roll ${group.count} attacks`,
    fields: [
      raw(`<p>${loc`Each standing member makes one attack. Ticked targets are shared out in order, measured from each attacker on the map.`}</p>
      <label>${loc`Weapon`} <select name="weapon">${weapons.map(item => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join("")}</select></label>
      <fieldset><legend>${loc`Targets`}</legend>${foes
        .map(
          combatant =>
            `<label><input type="checkbox" name="target-${combatant.id}"${likely.includes(combatant) ? " checked" : ""} /> ${esc(combatant.name)}</label>`
        )
        .join("")}</fieldset>
      <label><input type="checkbox" name="advance" checked /> ${loc`Then move the turn past the group`}</label>`)
    ]
  });
  if (!input) return null;
  const targets = foes.filter(combatant => input[`target-${combatant.id}`]);
  if (!targets.length) return refuse(loc`Tick at least one target.`);
  const before = [...(game.user?.targets ?? [])].map(token => token.id);
  let rolled = 0;
  try {
    for (const [attacker, target] of shareTargets(group.members, targets)) {
      const actor = attacker.actor,
        item = [...(actor.items ?? [])].find(entry => entry.type === "weapon" && entry.name === input.weapon);
      if (!item) continue;
      // The quick attack reads the one targeted token, so each attacker's target is set just before its roll.
      target.token.object?.setTarget?.(true, { releaseOthers: true });
      const message = await actor.rollAttack(
        item,
        quickAttackHasTarget(actor) ? quickAttackOptions(actor, item) : { targetActorUuid: target.actor.uuid }
      );
      if (message) {
        await resolveQuickAttack(message);
        rolled++;
      }
    }
  } finally {
    // Leave the GC's own targets as they were.
    for (const token of [...(game.user?.targets ?? [])]) token.setTarget?.(false, { releaseOthers: false });
    for (const id of before) canvas?.tokens?.get?.(id)?.setTarget?.(true, { releaseOthers: false });
  }
  if (input.advance) await passGroup(combat, group.members);
  return rolled;
}

/** Move the turn on until it reaches someone outside the group, within the round. */
export async function passGroup(combat, members) {
  const ids = new Set(members.map(member => member.id));
  let steps = 0;
  while (ids.has(combat.combatant?.id) && steps++ < ids.size) {
    const round = combat.round;
    await combat.nextTurn();
    if (combat.round !== round) break;
  }
  return steps;
}
