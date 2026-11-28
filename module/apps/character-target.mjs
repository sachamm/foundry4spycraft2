import { characterTargetPlan, characterTargetsEqual } from "../rules/character-target.mjs";
import { finesseMeleeWeapon } from "../rules/finesse.mjs";
import { loc } from "../i18n.mjs";
import { isSpecialCharacter } from "../rules/campaign-rules.mjs";
import { formDialog, raw as rawHtml } from "./dialog-kit.mjs";
const canRead = a =>
  !!a &&
  (a.isOwner === true ||
    globalThis.game?.user?.isGM === true ||
    a.testUserPermission?.(game.user, "OBSERVER") === true);
const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const data = a => ({
  uuid: a.uuid,
  type: a.type,
  // A villain is special, and so is a standard NPC or animal promoted for this mission (p.398).
  npcType: a.type !== "npc" ? a.system.npcType : isSpecialCharacter(a.system) ? "special" : a.system.npcType,
  createdTime: a._stats?.createdTime ?? null
});
export const cleaveTargetRequired = (actor, weapon) =>
  finesseMeleeWeapon(weapon) &&
  ["Cleave Mastery", "Cleave Supremacy"].some(name => actor.system.activeFeatNames?.includes(name));
export function attackCharacterTargetChoices() {
  const actors = new Map();
  for (const token of values(game.user?.targets))
    if (["agent", "npc"].includes(token.actor?.type) && canRead(token.actor)) actors.set(token.actor.uuid, token.actor);
  for (const c of values(game.combats))
    for (const t of c.turns ?? [])
      if (["agent", "npc"].includes(t.actor?.type) && canRead(t.actor)) actors.set(t.actor.uuid, t.actor);
  for (const a of values(game.actors)) if (["agent", "npc"].includes(a.type) && canRead(a)) actors.set(a.uuid, a);
  return [...actors.values()];
}
export function characterTargetContent(actor, input = {}, { fixedTargetUuid, fixedTargetName } = {}) {
  if (!actor?.system?.activeFeatNames?.some(n => ["Cleave Mastery", "Cleave Supremacy"].includes(n))) return "";
  const esc = foundry.utils.escapeHTML,
    selected =
      input.targetActorUuid ??
      (values(game.user?.targets).length === 1 ? values(game.user.targets)[0].actor?.uuid : "") ??
      "";
  const fixed = fixedTargetUuid !== undefined,
    chosen = attackCharacterTargetChoices().find(a => a.uuid === fixedTargetUuid),
    picker = fixed
      ? `<input name="targetActorUuid" type="hidden" value="${esc(fixedTargetUuid)}" /><p>${loc`Original opponent: ${esc(chosen?.name ?? fixedTargetName ?? "The attacking opponent")}`}</p>`
      : `<label>${loc`Actual target`} <select name="targetActorUuid"><option value="">${loc`Unrecorded target`}</option>${attackCharacterTargetChoices()
          .map(a => `<option value="${esc(a.uuid)}"${a.uuid === selected ? " selected" : ""}>${esc(a.name)}</option>`)
          .join("")}</select></label>`;
  return `<fieldset class="spycraft2-character-target"><legend>${loc`Target for Cleave bonuses`}</legend><p>${loc`Melee threat and critical-cost benefits require a standard character. An observed character sheet supplies its type. For an unrecorded target or animal, enter the GC’s classification. Use Object / non-character for environmental targets.`}</p>${picker}<label>${loc`GC classification for unrecorded target, animal or object`} <select name="targetCharacterType"><option value="">${loc`Use the selected sheet`}</option><option value="standard"${input.targetCharacterType === "standard" ? " selected" : ""}>${loc`Standard character`}</option><option value="special"${input.targetCharacterType === "special" ? " selected" : ""}>${loc`Special character`}</option><option value="object"${input.targetCharacterType === "object" ? " selected" : ""}>${loc`Object / non-character`}</option></select></label><label>${loc`Unrecorded target name`} <input name="targetName" maxlength="200" value="${esc(fixedTargetName ?? input.targetName ?? "")}"${fixed ? " readonly" : ""} /></label></fieldset>`;
}
async function resolve(input) {
  const uuid = input.targetActorUuid ?? "";
  if (typeof uuid !== "string") throw new Error(loc`Choose the actual target.`);
  if (!uuid) return characterTargetPlan(null, input);
  const a = await fromUuid(uuid);
  if (
    a?.documentName !== "Actor" ||
    !["agent", "npc"].includes(a.type) ||
    !canRead(a) ||
    !attackCharacterTargetChoices().some(t => t.uuid === a.uuid)
  )
    throw new Error(
      loc`The selected target is no longer an observed character. Confirm its current source or use the GC’s unrecorded-target classification.`
    );
  return characterTargetPlan(data(a), input);
}
export async function completeCharacterTarget(
  actor,
  weapon,
  input = {},
  { prompt = true, fixedTargetUuid, fixedTargetName } = {}
) {
  if (!cleaveTargetRequired(actor, weapon)) return input;
  let raw = { ...input };
  const fixed = () => {
    if (fixedTargetUuid !== undefined) raw.targetActorUuid = fixedTargetUuid;
    if (fixedTargetName !== undefined) raw.targetName = fixedTargetName;
  };
  fixed();
  try {
    const target = await resolve(raw);
    if (raw.characterTarget && !characterTargetsEqual(raw.characterTarget, target))
      throw new Error(loc`The prepared character target changed. Confirm its current source again.`);
    return {
      ...raw,
      ...(target.source === "actor" && target.npcType === "animal" && target.characterType !== "object"
        ? { targetAnimal: true }
        : {}),
      characterTarget: target
    };
  } catch (error) {
    if (error.code !== "NEED_CHARACTER_TARGET" || !prompt) throw error;
  }
  const answer = await formDialog({
    title: loc`Cleave character target`,
    fields: [rawHtml(characterTargetContent(actor, raw, { fixedTargetUuid, fixedTargetName }))]
  });
  if (!answer) return null;
  raw = { ...raw, ...answer };
  fixed();
  const target = await resolve(raw);
  return {
    ...raw,
    ...(target.source === "actor" && target.npcType === "animal" && target.characterType !== "object"
      ? { targetAnimal: true }
      : {}),
    characterTarget: target
  };
}
export async function validateCharacterTarget(target) {
  if (!target || target.source !== "actor") return;
  const fresh = await resolve({
    targetActorUuid: target.actorUuid,
    targetCharacterType: target.gcCharacterType,
    targetName: ""
  });
  if (!characterTargetsEqual(fresh, target))
    throw new Error(loc`The actual target classification changed during the attack. Confirm it again.`);
}

export function knownCharacterTargetInput(uuid, input = {}, characterType = "") {
  const observed = attackCharacterTargetChoices().some(a => a.uuid === uuid);
  return {
    ...input,
    targetActorUuid: observed ? uuid : "",
    ...(characterType ? { targetCharacterType: characterType } : {}),
    targetName: input.targetName || (observed ? "" : `Target ${uuid}`)
  };
}

/**
 * Who an ordinary attack can name as its target: the targeted token, then the tokens in view on the scene and the
 * combatants. People with no token there are listed only when nobody else can be chosen. The attacker is left out.
 * A token the user can see is listed by its token name even when its sheet cannot be opened.
 * @returns {{uuid: string, name: string}[]}
 */
export function observedAttackTargetChoices(actor) {
  const rows = new Map(),
    isGM = globalThis.game?.user?.isGM === true;
  const add = (a, name) => {
    if (!a || !["agent", "npc"].includes(a.type) || a.uuid === actor?.uuid || rows.has(a.uuid)) return;
    rows.set(a.uuid, { uuid: a.uuid, name: name || a.name || "" });
  };
  for (const token of values(game.user?.targets)) add(token.actor, token.name ?? token.document?.name);
  for (const token of values(globalThis.canvas?.scene?.tokens)) {
    const inView = isGM || (token.hidden !== true && token.object?.visible !== false);
    if (inView || canRead(token.actor)) add(token.actor, token.name);
  }
  for (const c of values(game.combats))
    for (const t of c.turns ?? []) if (canRead(t.actor)) add(t.actor, t.token?.name ?? t.name);
  if (!rows.size) for (const a of values(game.actors)) if (canRead(a)) add(a, a.name);
  // Identical tokens are numbered so they can be told apart.
  const totals = new Map(),
    seen = new Map();
  for (const row of rows.values()) totals.set(row.name, (totals.get(row.name) ?? 0) + 1);
  return [...rows.values()].map(row => {
    if (totals.get(row.name) < 2) return row;
    const n = (seen.get(row.name) ?? 0) + 1;
    seen.set(row.name, n);
    return { ...row, name: `${row.name} ${n}` };
  });
}

/** Optional actual target for attacks that do not require Cleave classification. */
export function observedAttackTargetContent(actor, input = {}) {
  const esc = foundry.utils.escapeHTML,
    targets = observedAttackTargetChoices(actor),
    targeted = values(game.user?.targets),
    selected = input.targetActorUuid ?? (targeted.length === 1 ? targeted[0].actor?.uuid : "") ?? "";
  return `<label>${loc`Actual opponent (optional; retain in the attack receipt)`} <select name="targetActorUuid"><option value="">${loc`Unrecorded / GC-confirmed target`}</option>${targets.map(a => `<option value="${esc(a.uuid)}"${a.uuid === selected ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>`;
}
